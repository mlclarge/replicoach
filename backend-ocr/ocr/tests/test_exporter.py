"""
Tests unitaires — exporter.py

Vérifie que chaque exporteur produit un résultat structurellement correct,
sans dépendance à PaddleOCR ni à des fichiers externes.
"""

import json
import unittest
import tempfile
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from ocr.exporter import JSONExporter, MarkdownExporter, TextExporter, Exporter
from ocr.models import (
    Act, ElementType, PipelineResult, Scene, Script, ScriptElement
)


# ─── Fixtures ─────────────────────────────────────────────────────────────────


def _make_script() -> Script:
    """Crée un Script minimal pour les tests."""
    elem_char = ScriptElement(
        element_type=ElementType.CHARACTER,
        text="JACQUES",
        character="JACQUES",
        confidence=0.92,
        page_number=1,
    )
    elem_stage = ScriptElement(
        element_type=ElementType.STAGE_DIRECTION,
        text="(Il entre en boitant)",
        character=None,
        confidence=0.88,
        page_number=1,
    )
    elem_dialogue = ScriptElement(
        element_type=ElementType.DIALOGUE,
        text="Bonjour tout le monde.",
        character="JACQUES",
        confidence=0.95,
        page_number=1,
    )
    elem_char2 = ScriptElement(
        element_type=ElementType.CHARACTER,
        text="LUCIE",
        character="LUCIE",
        confidence=0.90,
        page_number=1,
    )
    elem_dialogue2 = ScriptElement(
        element_type=ElementType.DIALOGUE,
        text="Bonjour Jacques !",
        character="LUCIE",
        confidence=0.91,
        page_number=1,
    )

    scene = Scene(number=1, title="Scène 1", elements=[
        elem_char, elem_stage, elem_dialogue,
        elem_char2, elem_dialogue2,
    ])
    act = Act(number=1, title="ACTE I", scenes=[scene])
    return Script(title="Tout Bascule", acts=[act])


def _make_result(script: Script = None) -> PipelineResult:
    s = script or _make_script()
    return PipelineResult(
        script=s,
        total_pages=5,
        total_time_ms=12345.6,
        config_summary={"dpi": 300, "language": "fr"},
    )


# ─── Tests TextExporter ───────────────────────────────────────────────────────


class TestTextExporter(unittest.TestCase):

    def setUp(self):
        self.exporter = TextExporter()
        self.script = _make_script()

    def test_title_in_output(self):
        text = self.exporter.export(self.script)
        self.assertIn("TOUT BASCULE", text)

    def test_character_names_present(self):
        text = self.exporter.export(self.script)
        self.assertIn("JACQUES", text)
        self.assertIn("LUCIE", text)

    def test_dialogue_present(self):
        text = self.exporter.export(self.script)
        self.assertIn("Bonjour tout le monde.", text)

    def test_stage_direction_indented(self):
        text = self.exporter.export(self.script)
        # Les didascalies doivent être indentées (commencent par des espaces)
        lines = text.split("\n")
        stage_lines = [l for l in lines if "(Il entre" in l]
        self.assertTrue(any(l.startswith("  ") for l in stage_lines))

    def test_page_numbers_excluded(self):
        """Les numéros de page ne doivent pas apparaître dans le TXT."""
        script = _make_script()
        script.acts[0].scenes[0].elements.append(
            ScriptElement(ElementType.PAGE_NUMBER, "42", None, 0.9, 1)
        )
        text = self.exporter.export(script)
        # "42" ne doit pas apparaître seul sur une ligne
        lines = [l.strip() for l in text.split("\n")]
        self.assertNotIn("42", lines)

    def test_save_creates_file(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "test.txt"
            self.exporter.save(self.script, path)
            self.assertTrue(path.exists())
            content = path.read_text(encoding="utf-8")
            self.assertIn("JACQUES", content)


# ─── Tests JSONExporter ───────────────────────────────────────────────────────


class TestJSONExporter(unittest.TestCase):

    def setUp(self):
        self.exporter = JSONExporter()
        self.result = _make_result()

    def test_valid_json(self):
        data = self.exporter.export(self.result)
        # Doit être sérialisable sans erreur
        json_str = json.dumps(data, ensure_ascii=False)
        parsed = json.loads(json_str)
        self.assertIsInstance(parsed, dict)

    def test_contains_script_key(self):
        data = self.exporter.export(self.result)
        self.assertIn("script", data)

    def test_contains_characters(self):
        data = self.exporter.export(self.result)
        chars = data["script"]["characters"]
        self.assertIn("JACQUES", chars)
        self.assertIn("LUCIE", chars)

    def test_contains_metrics(self):
        data = self.exporter.export(self.result)
        self.assertIn("total_pages", data)
        self.assertIn("total_time_ms", data)
        self.assertEqual(data["total_pages"], 5)

    def test_confidence_in_elements(self):
        data = self.exporter.export(self.result)
        elements = data["script"]["acts"][0]["scenes"][0]["elements"]
        for elem in elements:
            self.assertIn("confidence", elem)
            self.assertGreaterEqual(elem["confidence"], 0.0)
            self.assertLessEqual(elem["confidence"], 1.0)

    def test_save_creates_valid_json_file(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "test.json"
            self.exporter.save(self.result, path)
            self.assertTrue(path.exists())
            with path.open(encoding="utf-8") as f:
                data = json.load(f)
            self.assertIn("script", data)


# ─── Tests MarkdownExporter ───────────────────────────────────────────────────


class TestMarkdownExporter(unittest.TestCase):

    def setUp(self):
        self.exporter = MarkdownExporter()
        self.script = _make_script()

    def test_title_as_h1(self):
        md = self.exporter.export(self.script)
        self.assertIn("# Tout Bascule", md)

    def test_act_as_h2(self):
        md = self.exporter.export(self.script)
        self.assertIn("## ACTE I", md)

    def test_scene_as_h3(self):
        md = self.exporter.export(self.script)
        self.assertIn("### Scène 1", md)

    def test_character_bold(self):
        md = self.exporter.export(self.script)
        self.assertIn("**JACQUES**", md)
        self.assertIn("**LUCIE**", md)

    def test_stage_direction_italic(self):
        md = self.exporter.export(self.script)
        self.assertIn("*(Il entre en boitant)*", md)

    def test_dialogue_plain(self):
        md = self.exporter.export(self.script)
        self.assertIn("Bonjour tout le monde.", md)

    def test_save_creates_file(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "test.md"
            self.exporter.save(self.script, path)
            self.assertTrue(path.exists())


# ─── Tests Exporter (façade) ──────────────────────────────────────────────────


class TestExporter(unittest.TestCase):

    def test_save_all_creates_three_files(self):
        exporter = Exporter()
        result = _make_result()
        with tempfile.TemporaryDirectory() as tmpdir:
            output_dir = Path(tmpdir)
            exporter.save_all(result, output_dir, stem="piece")
            self.assertTrue((output_dir / "piece.txt").exists())
            self.assertTrue((output_dir / "piece.json").exists())
            self.assertTrue((output_dir / "piece.md").exists())

    def test_all_files_non_empty(self):
        exporter = Exporter()
        result = _make_result()
        with tempfile.TemporaryDirectory() as tmpdir:
            output_dir = Path(tmpdir)
            exporter.save_all(result, output_dir, stem="piece")
            for ext in ["txt", "json", "md"]:
                path = output_dir / f"piece.{ext}"
                self.assertGreater(path.stat().st_size, 0, f"{ext} vide")


if __name__ == "__main__":
    unittest.main(verbosity=2)
