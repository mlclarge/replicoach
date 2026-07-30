"""
Ticket 1 — Spike technique
--------------------------
Compare Google Document AI (processeur "Enterprise Document OCR", mode
batch) et Google Cloud Vision (mode batch async) sur un document scanné,
en dehors de l'application RépliCoach, pour trancher lequel des deux
utiliser pour la Voie B ("Scan Express IA").

Pourquoi le mode batch (et pas le mode synchrone "rapide") :
  - Document AI Enterprise OCR : 15 pages max en synchrone, 500 en batch.
  - Cloud Vision : même logique, le PDF doit passer par un bucket GCS.
  Notre document (55 pages / 41 Mo) dépasse largement le mode synchrone.

Installation :
  pip install google-cloud-documentai google-cloud-vision google-cloud-storage --break-system-packages

Usage :
  python spike_document_ai_vs_vision.py \
      --pdf "TU M CONNAIS.pdf" \
      --bucket replicoach-ocr-spike \
      --project-id VOTRE_PROJECT_ID \
      --location eu \
      --processor-id VOTRE_PROCESSOR_ID
"""

import argparse
import json
import re
import time
from pathlib import Path

from google.cloud import documentai_v1 as documentai
from google.cloud import storage
from google.cloud import vision_v1 as vision

# Les 10 personnages fermés, tels que saisis dans la pop-up utilisateur.
KNOWN_CHARACTERS = [
    "JOHN", "CHARLIE", "SAM", "JEFF PATERSON", "William FARELL",
    "MARY", "LOLA", "NOLAN", "JULIA", "JACKIE",
]


def upload_to_gcs(bucket_name: str, local_path: str, dest_blob_name: str) -> str:
    client = storage.Client()
    bucket = client.bucket(bucket_name)
    blob = bucket.blob(dest_blob_name)
    blob.upload_from_filename(local_path)
    return f"gs://{bucket_name}/{dest_blob_name}"


def _split_gcs_uri(gcs_uri: str):
    match = re.match(r"gs://([^/]+)/(.+)", gcs_uri)
    if not match:
        raise ValueError(f"URI GCS invalide : {gcs_uri}")
    return match.group(1), match.group(2)


def run_document_ai_batch(project_id, location, processor_id, gcs_input_uri, gcs_output_prefix):
    client = documentai.DocumentProcessorServiceClient(
        client_options={"api_endpoint": f"{location}-documentai.googleapis.com"}
    )
    name = client.processor_path(project_id, location, processor_id)

    input_config = documentai.BatchDocumentsInputConfig(
        gcs_documents=documentai.GcsDocuments(
            documents=[documentai.GcsDocument(gcs_uri=gcs_input_uri, mime_type="application/pdf")]
        )
    )
    output_config = documentai.DocumentOutputConfig(
        gcs_output_config=documentai.DocumentOutputConfig.GcsOutputConfig(gcs_uri=gcs_output_prefix)
    )
    request = documentai.BatchProcessRequest(
        name=name, input_documents=input_config, document_output_config=output_config
    )

    print("[Document AI] Lancement du traitement batch...")
    start = time.time()
    operation = client.batch_process_documents(request)
    operation.result(timeout=900)  # jusqu'à 15 min d'attente
    elapsed = time.time() - start
    print(f"[Document AI] Terminé en {elapsed:.1f}s")

    out_bucket_name, out_prefix = _split_gcs_uri(gcs_output_prefix)
    out_bucket = storage.Client().bucket(out_bucket_name)

    full_text = ""
    for blob in out_bucket.list_blobs(prefix=out_prefix):
        if blob.name.endswith(".json"):
            doc = documentai.Document.from_json(blob.download_as_bytes(), ignore_unknown_fields=True)
            full_text += doc.text

    return full_text, elapsed


def run_cloud_vision_batch(gcs_input_uri, gcs_output_prefix):
    client = vision.ImageAnnotatorClient()

    feature = vision.Feature(type_=vision.Feature.Type.DOCUMENT_TEXT_DETECTION)
    input_config = vision.InputConfig(
        gcs_source=vision.GcsSource(uri=gcs_input_uri), mime_type="application/pdf"
    )
    output_config = vision.OutputConfig(
        gcs_destination=vision.GcsDestination(uri=gcs_output_prefix), batch_size=20
    )
    async_request = vision.AsyncAnnotateFileRequest(
        features=[feature], input_config=input_config, output_config=output_config
    )

    print("[Cloud Vision] Lancement du traitement batch...")
    start = time.time()
    operation = client.async_batch_annotate_files(requests=[async_request])
    operation.result(timeout=900)
    elapsed = time.time() - start
    print(f"[Cloud Vision] Terminé en {elapsed:.1f}s")

    out_bucket_name, out_prefix = _split_gcs_uri(gcs_output_prefix)
    out_bucket = storage.Client().bucket(out_bucket_name)

    full_text = ""
    for blob in sorted(out_bucket.list_blobs(prefix=out_prefix), key=lambda b: b.name):
        if blob.name.endswith(".json"):
            response = json.loads(blob.download_as_bytes())
            for resp in response.get("responses", []):
                full_text += resp.get("fullTextAnnotation", {}).get("text", "")

    return full_text, elapsed


def count_known_characters(text: str, known_characters=KNOWN_CHARACTERS) -> dict:
    """Compte grossièrement les occurrences de chaque personnage connu dans le texte OCR."""
    normalized_text = text.upper()
    return {
        name: len(re.findall(re.escape(name.upper()), normalized_text))
        for name in known_characters
    }


def main():
    parser = argparse.ArgumentParser(description="Spike Document AI vs Cloud Vision")
    parser.add_argument("--pdf", required=True, help="Chemin local vers le PDF de test")
    parser.add_argument("--bucket", required=True, help="Nom du bucket GCS (sans gs://)")
    parser.add_argument("--project-id", required=True)
    parser.add_argument("--location", default="eu")
    parser.add_argument("--processor-id", required=True, help="ID du processeur Document AI")
    args = parser.parse_args()

    pdf_name = Path(args.pdf).name
    gcs_input_uri = upload_to_gcs(args.bucket, args.pdf, f"spike-input/{pdf_name}")
    print(f"PDF uploadé : {gcs_input_uri}\n")

    docai_text, docai_time = run_document_ai_batch(
        args.project_id, args.location, args.processor_id,
        gcs_input_uri, f"gs://{args.bucket}/spike-output/docai/",
    )
    Path("output_document_ai.txt").write_text(docai_text, encoding="utf-8")

    vision_text, vision_time = run_cloud_vision_batch(
        gcs_input_uri, f"gs://{args.bucket}/spike-output/vision/",
    )
    Path("output_cloud_vision.txt").write_text(vision_text, encoding="utf-8")

    print("\n=== Résumé comparatif ===")
    print(f"Document AI  : {docai_time:.1f}s — {len(docai_text)} caractères extraits (voir output_document_ai.txt)")
    print(f"Cloud Vision : {vision_time:.1f}s — {len(vision_text)} caractères extraits (voir output_cloud_vision.txt)")

    print("\nOccurrences des 10 personnages connus :")
    docai_counts = count_known_characters(docai_text)
    vision_counts = count_known_characters(vision_text)
    print(f"{'Personnage':<20}{'Document AI':<15}{'Cloud Vision':<15}")
    for name in KNOWN_CHARACTERS:
        print(f"{name:<20}{docai_counts[name]:<15}{vision_counts[name]:<15}")

    print(
        "\nA regarder à l'oeil ensuite dans les .txt : la ponctuation des "
        "didascalies, la reconnaissance des passages manuscrits en marge, "
        "et surtout si 'William FARELL :' ressort de façon exploitable "
        "(casse, espace, retour à la ligne) pour la logique de résolution "
        "déjà en place."
    )


if __name__ == "__main__":
    main()
