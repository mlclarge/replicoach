"""
Extraction de texte via Google Cloud Vision (mode batch asynchrone).

Utilisé par la Voie B ("Scan Premium") pour les PDF scannés volumineux
qui dépassent la limite du mode synchrone de Cloud Vision (le PDF doit
alors transiter par un bucket GCS). Logique reprise de
`ocr-spike/spike_document_ai_vs_vision.py::run_cloud_vision_batch`, avec :
un nom d'objet GCS unique par appel (évite les collisions entre requêtes
concurrentes), un nettoyage systématique des objets GCS temporaires
(entrée + sortie) dans un bloc `finally`, et une exception explicite en
cas d'échec ou de timeout de l'opération batch.

Dépendances Google Cloud importées à l'appel (pas au chargement du
module) afin de ne pas alourdir la voie OCR Tesseract/PaddleOCR
existante, qui ne les requiert pas.
"""

from __future__ import annotations

import json
import logging
import os
import uuid
from pathlib import Path
from typing import List, Optional

from .exceptions import OCRError

logger = logging.getLogger("ocr_pipeline.cloud_vision")

DEFAULT_TIMEOUT_SECONDS = 900


class CloudVisionError(OCRError):
    """Erreur lors de l'extraction de texte via Google Cloud Vision."""


def extract_text_via_cloud_vision(
    pdf_path: str,
    bucket_name: Optional[str] = None,
    timeout: int = DEFAULT_TIMEOUT_SECONDS,
) -> str:
    """
    Extrait le texte intégral d'un PDF scanné via Google Cloud Vision
    (DOCUMENT_TEXT_DETECTION, mode batch asynchrone).

    :param pdf_path: chemin local vers le PDF à traiter
    :param bucket_name: bucket GCS à utiliser pour le fichier temporaire ;
        si omis, lu depuis la variable d'environnement GCS_BUCKET_NAME
    :param timeout: délai maximum (secondes) d'attente de l'opération batch
    :returns: texte intégral extrait, pages concaténées dans l'ordre
    :raises CloudVisionError: bucket non configuré, fichier introuvable,
        échec ou timeout de l'opération Cloud Vision, ou absence de résultat
    """
    try:
        from google.cloud import storage
        from google.cloud import vision_v1 as vision
    except ImportError as exc:
        raise CloudVisionError(
            "google-cloud-vision et google-cloud-storage non installés. "
            "Exécuter : pip install google-cloud-vision google-cloud-storage"
        ) from exc

    resolved_bucket = bucket_name or os.environ.get("GCS_BUCKET_NAME")
    if not resolved_bucket:
        raise CloudVisionError(
            "Aucun bucket GCS configuré : passez bucket_name ou définissez "
            "la variable d'environnement GCS_BUCKET_NAME."
        )

    pdf_file = Path(pdf_path)
    if not pdf_file.is_file():
        raise CloudVisionError(f"Fichier PDF introuvable : {pdf_path}")

    request_id = uuid.uuid4().hex
    input_blob_name = f"cloud-ocr-tmp/{request_id}/{pdf_file.name}"
    output_prefix = f"cloud-ocr-tmp/{request_id}/output/"

    storage_client = storage.Client()
    bucket = storage_client.bucket(resolved_bucket)

    uploaded_blobs: List[object] = []
    try:
        input_blob = bucket.blob(input_blob_name)
        input_blob.upload_from_filename(str(pdf_file))
        uploaded_blobs.append(input_blob)

        gcs_input_uri = f"gs://{resolved_bucket}/{input_blob_name}"
        gcs_output_uri = f"gs://{resolved_bucket}/{output_prefix}"

        logger.info(
            f"[Cloud Vision] Lancement du traitement batch de {pdf_file.name} "
            f"({request_id})"
        )

        vision_client = vision.ImageAnnotatorClient()
        feature = vision.Feature(type_=vision.Feature.Type.DOCUMENT_TEXT_DETECTION)
        input_config = vision.InputConfig(
            gcs_source=vision.GcsSource(uri=gcs_input_uri), mime_type="application/pdf"
        )
        output_config = vision.OutputConfig(
            gcs_destination=vision.GcsDestination(uri=gcs_output_uri), batch_size=20
        )
        async_request = vision.AsyncAnnotateFileRequest(
            features=[feature], input_config=input_config, output_config=output_config
        )

        operation = vision_client.async_batch_annotate_files(requests=[async_request])
        operation.result(timeout=timeout)

        output_blobs = list(bucket.list_blobs(prefix=output_prefix))
        uploaded_blobs.extend(output_blobs)

        full_text_parts = []
        for blob in sorted(output_blobs, key=lambda b: b.name):
            if not blob.name.endswith(".json"):
                continue
            response = json.loads(blob.download_as_bytes())
            for resp in response.get("responses", []):
                full_text_parts.append(resp.get("fullTextAnnotation", {}).get("text", ""))

        if not full_text_parts:
            raise CloudVisionError(
                f"Aucun résultat Cloud Vision trouvé sous gs://{resolved_bucket}/{output_prefix} "
                f"({request_id})"
            )

        logger.info(f"[Cloud Vision] Traitement terminé ({request_id})")
        return "".join(full_text_parts)

    except CloudVisionError:
        raise
    except Exception as exc:
        raise CloudVisionError(
            f"Échec de l'extraction Cloud Vision ({request_id}) : {exc}"
        ) from exc
    finally:
        _cleanup_blobs(uploaded_blobs, request_id)


def _cleanup_blobs(blobs: List[object], request_id: str) -> None:
    """Supprime les objets GCS temporaires, sans lever d'exception en cas d'échec partiel."""
    for blob in blobs:
        try:
            blob.delete()
        except Exception as exc:
            logger.warning(
                f"[Cloud Vision] Nettoyage échoué pour {getattr(blob, 'name', blob)} "
                f"({request_id}) : {exc}"
            )
