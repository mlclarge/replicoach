"""
Tests unitaires — cloudOcrService.py

Tous les appels Google Cloud (Storage, Vision) sont mockés : aucun test
ne réalise de vrai appel réseau ni ne requiert de credentials GCP.
"""

import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from ocr.cloudOcrService import CloudVisionError, extract_text_via_cloud_vision


def _make_json_blob(name: str, text: str):
    """Crée un mock de blob de sortie Cloud Vision contenant `text`."""
    blob = MagicMock()
    blob.name = name
    payload = {"responses": [{"fullTextAnnotation": {"text": text}}]}
    blob.download_as_bytes.return_value = json.dumps(payload).encode("utf-8")
    return blob


def _make_bucket(output_blobs):
    """Crée un mock de bucket dont list_blobs renvoie `output_blobs`."""
    bucket = MagicMock()
    bucket.list_blobs.return_value = output_blobs
    return bucket


class TestExtractTextViaCloudVision(unittest.TestCase):

    def setUp(self):
        self._tmp = tempfile.NamedTemporaryFile(suffix=".pdf", delete=False)
        self._tmp.write(b"%PDF-1.4 fake content")
        self._tmp.close()
        self.pdf_path = self._tmp.name

    def tearDown(self):
        Path(self.pdf_path).unlink(missing_ok=True)

    # ── Validation des paramètres ───────────────────────────────────────────

    def test_missing_bucket_raises(self):
        with patch.dict("os.environ", {}, clear=True):
            with self.assertRaises(CloudVisionError):
                extract_text_via_cloud_vision(self.pdf_path, bucket_name=None)

    def test_missing_pdf_file_raises(self):
        with self.assertRaises(CloudVisionError):
            extract_text_via_cloud_vision("/chemin/inexistant.pdf", bucket_name="my-bucket")

    # ── Cas de succès ────────────────────────────────────────────────────────

    @patch("google.cloud.vision_v1.ImageAnnotatorClient")
    @patch("google.cloud.storage.Client")
    def test_success_returns_concatenated_text(self, mock_storage_client_cls, mock_vision_client_cls):
        output_blobs = [
            _make_json_blob("cloud-ocr-tmp/x/output/1.json", "Page un. "),
            _make_json_blob("cloud-ocr-tmp/x/output/2.json", "Page deux."),
        ]
        bucket = _make_bucket(output_blobs)
        mock_storage_client_cls.return_value.bucket.return_value = bucket

        mock_operation = MagicMock()
        mock_vision_client_cls.return_value.async_batch_annotate_files.return_value = mock_operation

        text = extract_text_via_cloud_vision(self.pdf_path, bucket_name="my-bucket")

        self.assertEqual(text, "Page un. Page deux.")
        mock_operation.result.assert_called_once()

    @patch("google.cloud.vision_v1.ImageAnnotatorClient")
    @patch("google.cloud.storage.Client")
    def test_uses_bucket_name_from_env_var_when_omitted(self, mock_storage_client_cls, mock_vision_client_cls):
        output_blobs = [_make_json_blob("cloud-ocr-tmp/x/output/1.json", "Texte.")]
        bucket = _make_bucket(output_blobs)
        mock_storage_client_cls.return_value.bucket.return_value = bucket
        mock_vision_client_cls.return_value.async_batch_annotate_files.return_value = MagicMock()

        with patch.dict("os.environ", {"GCS_BUCKET_NAME": "env-bucket"}, clear=False):
            extract_text_via_cloud_vision(self.pdf_path, bucket_name=None)

        mock_storage_client_cls.return_value.bucket.assert_called_once_with("env-bucket")

    @patch("google.cloud.vision_v1.ImageAnnotatorClient")
    @patch("google.cloud.storage.Client")
    def test_input_blob_name_is_unique_per_call(self, mock_storage_client_cls, mock_vision_client_cls):
        output_blobs = [_make_json_blob("out/1.json", "Texte.")]
        bucket = _make_bucket(output_blobs)
        mock_storage_client_cls.return_value.bucket.return_value = bucket
        mock_vision_client_cls.return_value.async_batch_annotate_files.return_value = MagicMock()

        extract_text_via_cloud_vision(self.pdf_path, bucket_name="my-bucket")
        extract_text_via_cloud_vision(self.pdf_path, bucket_name="my-bucket")

        first_call_name = bucket.blob.call_args_list[0].args[0]
        second_call_name = bucket.blob.call_args_list[1].args[0]
        self.assertNotEqual(first_call_name, second_call_name)

    @patch("google.cloud.vision_v1.ImageAnnotatorClient")
    @patch("google.cloud.storage.Client")
    def test_temporary_blobs_are_deleted_after_success(self, mock_storage_client_cls, mock_vision_client_cls):
        output_blobs = [_make_json_blob("out/1.json", "Texte.")]
        bucket = _make_bucket(output_blobs)
        input_blob = MagicMock()
        bucket.blob.return_value = input_blob
        mock_storage_client_cls.return_value.bucket.return_value = bucket
        mock_vision_client_cls.return_value.async_batch_annotate_files.return_value = MagicMock()

        extract_text_via_cloud_vision(self.pdf_path, bucket_name="my-bucket")

        input_blob.delete.assert_called_once()
        output_blobs[0].delete.assert_called_once()

    # ── Cas d'échec ──────────────────────────────────────────────────────────

    @patch("google.cloud.vision_v1.ImageAnnotatorClient")
    @patch("google.cloud.storage.Client")
    def test_operation_timeout_raises_explicit_error(self, mock_storage_client_cls, mock_vision_client_cls):
        bucket = _make_bucket([])
        input_blob = MagicMock()
        bucket.blob.return_value = input_blob
        mock_storage_client_cls.return_value.bucket.return_value = bucket

        mock_operation = MagicMock()
        mock_operation.result.side_effect = TimeoutError("délai dépassé")
        mock_vision_client_cls.return_value.async_batch_annotate_files.return_value = mock_operation

        with self.assertRaises(CloudVisionError):
            extract_text_via_cloud_vision(self.pdf_path, bucket_name="my-bucket")

        # Le fichier d'entrée temporaire doit être nettoyé même en cas d'échec.
        input_blob.delete.assert_called_once()

    @patch("google.cloud.vision_v1.ImageAnnotatorClient")
    @patch("google.cloud.storage.Client")
    def test_no_output_blobs_raises_explicit_error(self, mock_storage_client_cls, mock_vision_client_cls):
        bucket = _make_bucket([])  # Aucun résultat produit
        mock_storage_client_cls.return_value.bucket.return_value = bucket
        mock_vision_client_cls.return_value.async_batch_annotate_files.return_value = MagicMock()

        with self.assertRaises(CloudVisionError):
            extract_text_via_cloud_vision(self.pdf_path, bucket_name="my-bucket")

    @patch("google.cloud.vision_v1.ImageAnnotatorClient")
    @patch("google.cloud.storage.Client")
    def test_upload_failure_raises_explicit_error(self, mock_storage_client_cls, mock_vision_client_cls):
        bucket = MagicMock()
        input_blob = MagicMock()
        input_blob.upload_from_filename.side_effect = RuntimeError("réseau indisponible")
        bucket.blob.return_value = input_blob
        mock_storage_client_cls.return_value.bucket.return_value = bucket

        with self.assertRaises(CloudVisionError):
            extract_text_via_cloud_vision(self.pdf_path, bucket_name="my-bucket")


if __name__ == "__main__":
    unittest.main(verbosity=2)
