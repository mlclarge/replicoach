import asyncio
import json
import logging
import os
import shutil
import tempfile
from pathlib import Path
from typing import Any, Dict, Optional

from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from ocr.auth import get_premium_user
from ocr.gemini_ocr import GeminiOCRError, extract_script_with_gemini

try:
    # Charge backend-ocr/.env en développement local uniquement (no-op si le
    # fichier est absent, par ex. en production sur Render où les variables
    # sont injectées directement par la plateforme).
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:  # pragma: no cover - dépendance optionnelle en prod
    pass

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


def _progress_event(stage: str) -> str:
    return f"event: progress\ndata: {json.dumps({'stage': stage}, ensure_ascii=False)}\n\n"


def _result_event(result: Dict[str, Any]) -> str:
    payload = {
        "title": result["title"],
        "characters": [{"name": name} for name in result["characters"]],
        "replicas": result["replicas"],
    }
    return f"event: result\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"


def _error_event(message: str) -> str:
    return f"event: error\ndata: {json.dumps({'detail': message}, ensure_ascii=False)}\n\n"


async def _cleanup_after_extraction(task: asyncio.Task, tmp_dir: str) -> None:
    try:
        await task
    except Exception:
        logger.exception("Premium OCR task failed after the client disconnected")
    try:
        shutil.rmtree(tmp_dir)
    except FileNotFoundError:
        pass
    except OSError:
        logger.exception("Unable to remove temporary OCR directory %s", tmp_dir)


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
    except Exception:
        try:
            shutil.rmtree(tmp_dir)
        except OSError:
            logger.exception("Unable to remove temporary OCR directory %s", tmp_dir)
        raise
    finally:
        await file.close()

    async def stream_extraction():
        extraction_task = None
        deferred_cleanup = False
        loop = asyncio.get_running_loop()
        progress_queue: asyncio.Queue[str] = asyncio.Queue()

        def report_progress(stage: str) -> None:
            loop.call_soon_threadsafe(progress_queue.put_nowait, stage)

        try:
            yield _progress_event("upload_received")

            extraction_task = asyncio.create_task(
                asyncio.to_thread(
                    extract_script_with_gemini,
                    tmp_pdf_path,
                    title or Path(file.filename).stem,
                    report_progress,
                )
            )
            while not extraction_task.done():
                try:
                    stage = await asyncio.wait_for(progress_queue.get(), timeout=0.5)
                    yield _progress_event(stage)
                except asyncio.TimeoutError:
                    continue

            result = await extraction_task
            while not progress_queue.empty():
                yield _progress_event(progress_queue.get_nowait())
            yield _progress_event("result_validated")
            yield _result_event(result)
        except asyncio.CancelledError:
            if extraction_task is not None and not extraction_task.done():
                deferred_cleanup = True
                asyncio.create_task(_cleanup_after_extraction(extraction_task, tmp_dir))
            raise
        except GeminiOCRError as exc:
            logger.warning("Gemini OCR failed for user %s: %s", user["id"], exc)
            yield _error_event(str(exc))
        except Exception:
            logger.exception("Premium OCR request failed for user %s", user["id"])
            yield _error_event("Le traitement OCR Premium a échoué.")
        finally:
            if not deferred_cleanup:
                try:
                    shutil.rmtree(tmp_dir)
                except FileNotFoundError:
                    pass
                except OSError:
                    logger.exception(
                        "Unable to remove temporary OCR directory %s", tmp_dir
                    )

    return StreamingResponse(
        stream_extraction(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )

@app.get("/api/health")
def health_check():
    return {"status": "ok", "message": "OCR API is running"}
