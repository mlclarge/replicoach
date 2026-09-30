import asyncio
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from fastapi import HTTPException
import httpx

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

import main
from ocr.auth import get_premium_user


class TestPremiumOcrApi(unittest.TestCase):
    def setUp(self):
        main.app.dependency_overrides.clear()

    def tearDown(self):
        main.app.dependency_overrides.clear()

    def post(self, path, **kwargs):
        async def send_request():
            transport = httpx.ASGITransport(app=main.app)
            async with httpx.AsyncClient(
                transport=transport, base_url="http://testserver"
            ) as client:
                return await client.post(path, **kwargs)

        return asyncio.run(send_request())

    def test_premium_endpoint_rejects_anonymous_upload(self):
        response = self.post(
            "/api/extract-premium",
            files={"file": ("script.pdf", b"%PDF-1.4", "application/pdf")},
        )

        self.assertEqual(response.status_code, 401)

    def test_premium_endpoint_rejects_non_premium_user(self):
        def reject_user():
            raise HTTPException(status_code=403, detail="Premium requis.")

        main.app.dependency_overrides[get_premium_user] = reject_user
        response = self.post(
            "/api/extract-premium",
            files={"file": ("script.pdf", b"%PDF-1.4", "application/pdf")},
        )

        self.assertEqual(response.status_code, 403)

    def test_premium_endpoint_returns_structured_extraction(self):
        main.app.dependency_overrides[get_premium_user] = lambda: {"id": "user-id"}
        extraction = {
            "title": "La pièce",
            "characters": ["FIGARO"],
            "replicas": [{"character": "FIGARO", "text": "Bonjour."}],
        }
        with patch.object(
            main, "extract_script_with_gemini", return_value=extraction
        ):
            response = self.post(
                "/api/extract-premium",
                files={"file": ("script.pdf", b"%PDF-1.4", "application/pdf")},
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {
                "title": "La pièce",
                "characters": [{"name": "FIGARO"}],
                "replicas": [{"character": "FIGARO", "text": "Bonjour."}],
            },
        )

    def test_legacy_server_ocr_endpoint_is_not_available(self):
        response = self.post("/api/ocr")

        self.assertEqual(response.status_code, 404)

    def test_pdf_upload_size_limit_is_enforced(self):
        async def run_save():
            with tempfile.TemporaryDirectory() as temp_dir:
                destination = Path(temp_dir) / "upload.pdf"
                with patch.object(main, "MAX_PDF_SIZE_BYTES", 3):
                    with self.assertRaises(HTTPException) as context:
                        await main._save_uploaded_pdf(
                            SimpleNamespace(read=AsyncMock(return_value=b"1234")),
                            destination,
                        )
                self.assertEqual(context.exception.status_code, 413)
                self.assertEqual(destination.read_bytes(), b"")

        asyncio.run(run_save())


if __name__ == "__main__":
    unittest.main()
