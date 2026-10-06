import os
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from ocr.gemini_ocr import (
    GeminiOCRError,
    _merge_chunk_results,
    extract_script_with_gemini,
    parse_gemini_response,
)


class TestParseGeminiResponse(unittest.TestCase):
    def test_normalizes_characters_and_preserves_replica_order(self):
        result = parse_gemini_response(
            """{
              "title": "La pièce",
              "characters": [" Figaro ", "Juliette", "FIGARO"],
              "replicas": [
                {"character": "figaro", "text": " M'entendez-vous ? "},
                {"character": "JULIETTE", "text": "Oh !"}
              ]
            }""",
            "fallback",
        )

        self.assertEqual(result["title"], "La pièce")
        self.assertEqual(result["characters"], ["FIGARO", "JULIETTE"])
        self.assertEqual(
            result["replicas"],
            [
                {"character": "FIGARO", "text": "M'entendez-vous ?"},
                {"character": "JULIETTE", "text": "Oh !"},
            ],
        )

    def test_uses_filename_when_model_returns_no_title(self):
        result = parse_gemini_response(
            '{"title":"","characters":["FIGARO"],"replicas":[{"character":"FIGARO","text":"Bonjour."}]}',
            "mon-script",
        )

        self.assertEqual(result["title"], "mon-script")

    def test_rejects_invalid_json(self):
        with self.assertRaises(GeminiOCRError):
            parse_gemini_response("pas du JSON", "fallback")

    def test_rejects_replica_with_undeclared_character(self):
        with self.assertRaises(GeminiOCRError):
            parse_gemini_response(
                '{"title":"Pièce","characters":["FIGARO"],"replicas":[{"character":"JULIETTE","text":"Bonjour."}]}',
                "fallback",
            )

    def test_rejects_empty_extraction(self):
        with self.assertRaises(GeminiOCRError):
            parse_gemini_response(
                '{"title":"Pièce","characters":[],"replicas":[]}',
                "fallback",
            )

    def test_uploads_extracts_and_deletes_temporary_gemini_file(self):
        with (
            patch.dict(os.environ, {"GEMINI_API_KEY": "test-key"}),
            patch("google.genai.Client") as client_class,
            tempfile.TemporaryDirectory() as temp_dir,
        ):
            client = client_class.return_value
            client.files.upload.return_value = SimpleNamespace(
                name="files/script",
                state="ACTIVE",
                uri="https://generativelanguage.googleapis.com/files/script",
                mime_type="application/pdf",
            )
            client.files.get.return_value = SimpleNamespace(
                state="ACTIVE",
                uri="https://generativelanguage.googleapis.com/files/script",
                mime_type="application/pdf",
            )
            client.models.generate_content.return_value = SimpleNamespace(
                text=(
                    '{"title":"La pièce","characters":["FIGARO"],'
                    '"replicas":[{"character":"FIGARO","text":"Bonjour."}]}'
                )
            )
            pdf_path = Path(temp_dir) / "script.pdf"
            pdf_path.write_bytes(b"%PDF-1.4")

            progress_stages = []
            result = extract_script_with_gemini(
                pdf_path,
                progress_callback=progress_stages.append,
            )

        self.assertEqual(result["characters"], ["FIGARO"])
        self.assertEqual(
            progress_stages,
            [
                "gemini_uploading",
                "gemini_uploaded",
                "gemini_ready",
                "generation_started",
                "response_received",
            ],
        )
        client.files.delete.assert_called_once_with(name="files/script")


class TestMergeChunks(unittest.TestCase):
    def test_merges_characters_and_keeps_chunk_order(self):
        merged = _merge_chunk_results(
            [
                {"title": "Pièce", "characters": ["JOHN"], "replicas": [{"character": "JOHN", "text": "A"}]},
                {"title": "x", "characters": ["John", "SAM"], "replicas": [{"character": "SAM", "text": "B"}, {"character": "JOHN", "text": "C"}]},
            ],
            "fallback",
        )
        self.assertEqual(merged["title"], "Pièce")
        self.assertEqual(merged["characters"], ["JOHN", "SAM"])
        self.assertEqual([r["text"] for r in merged["replicas"]], ["A", "B", "C"])


    def test_attaches_orphan_start_of_chunk_to_previous_replica(self):
        merged = _merge_chunk_results(
            [
                {"title": "P", "characters": ["JEFF"], "replicas": [{"character": "JEFF", "text": "Début"}]},
                {"title": "P", "characters": ["INCONNU", "SAM"], "replicas": [{"character": "INCONNU", "text": "suite."}, {"character": "SAM", "text": "Oui."}]},
            ],
            "fallback",
        )
        self.assertEqual(merged["replicas"][0], {"character": "JEFF", "text": "Début suite."})
        self.assertEqual(merged["characters"], ["JEFF", "SAM"])


if __name__ == "__main__":
    unittest.main()
