import asyncio
import logging
import os
import shutil
import tempfile
from pathlib import Path
from typing import Any, Dict, Optional

from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from ocr.auth import get_premium_user
from ocr.gemini_ocr import GeminiOCRError, extract_script_with_gemini

logger = logging.getLogger("replicoach.ocr_api")
app = FastAPI(title="RepliCoach OCR API", version="2.0")

MAX_PDF_SIZE_BYTES = 50 * 1024 * 1024


async def _save_uploaded_pdf(file: UploadFile, destination: Path) -> None:
    size = 0
    with destination.open("wb") as output:
        while chunk := await file.read(1024 * 1024):
            size += len(chunk)
            if size > MAX_PDF_SIZE_BYTES:
                raise HTTPException(
                    status_code=413, detail="Le PDF doit faire moins de 50 Mo."
                )
            output.write(chunk)

    if size == 0:
        raise HTTPException(status_code=400, detail="Le fichier PDF est vide.")


configured_origins = os.environ.get("FRONTEND_ORIGINS", "")
allowed_origins = [
    origin.strip() for origin in configured_origins.split(",") if origin.strip()
] or ["http://localhost:5173", "http://127.0.0.1:5173"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/api/extract-premium")
async def extract_premium(
    file: UploadFile = File(...),
    title: Optional[str] = Form(default=None),
    user: Dict[str, Any] = Depends(get_premium_user),
):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Seuls les fichiers PDF sont supportés.")

    tmp_dir = tempfile.mkdtemp()
    tmp_pdf_path = Path(tmp_dir) / "uploaded.pdf"

    try:
        await _save_uploaded_pdf(file, tmp_pdf_path)
        result = await asyncio.to_thread(
            extract_script_with_gemini,
            tmp_pdf_path,
            title or Path(file.filename).stem,
        )
        return {
            "title": result["title"],
            "characters": [{"name": name} for name in result["characters"]],
            "replicas": result["replicas"],
        }
    except HTTPException:
        raise
    except GeminiOCRError as exc:
        logger.warning("Gemini OCR failed for user %s: %s", user["id"], exc)
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Premium OCR request failed for user %s", user["id"])
        raise HTTPException(
            status_code=500, detail="Le traitement OCR Premium a échoué."
        ) from exc
    finally:
        try:
            shutil.rmtree(tmp_dir)
        except FileNotFoundError:
            pass
        except OSError:
            logger.exception("Unable to remove temporary OCR directory %s", tmp_dir)

@app.get("/api/health")
def health_check():
    return {"status": "ok", "message": "OCR API is running"}
