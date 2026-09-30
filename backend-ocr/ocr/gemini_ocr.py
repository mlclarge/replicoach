"""Premium script extraction with Gemini Vision."""

from __future__ import annotations

import json
import logging
import os
import time
from pathlib import Path
from typing import Any, Dict, List

logger = logging.getLogger("ocr_pipeline.gemini")

DEFAULT_MODEL = "gemini-3.8-flash"
FILE_PROCESSING_TIMEOUT_SECONDS = 60
MAX_OUTPUT_TOKENS = 65536

EXTRACTION_PROMPT = """Analyse intégralement le PDF de cette pièce de théâtre.
Retourne uniquement un objet JSON valide conforme à ce schéma :
{
  "title": "Titre de la pièce",
  "characters": ["PERSONNAGE 1", "PERSONNAGE 2"],
  "replicas": [
    {"character": "PERSONNAGE 1", "text": "Texte complet de la réplique"}
  ]
}

Consignes impératives :
- Parcours toutes les pages dans l'ordre et extrais chaque réplique sans résumé,
  omission ni réorganisation. Conserve fidèlement l'orthographe, la ponctuation,
  les accents, les didascalies utiles et les retours de sens.
- Détecte tous les personnages qui parlent. Donne à chacun un nom canonique
  unique en majuscules et rattache ses abréviations/alias au même nom.
- Le champ character de chaque réplique doit correspondre exactement à un nom
  de characters. N'invente pas de texte manquant ; si l'attribution est
  réellement impossible, utilise le nom INCONNU et ajoute-le à characters.
- Ignore les numéros de page, en-têtes/pieds de page et éléments qui ne sont
  manifestement pas du texte de la pièce.
- Les scènes/actes et didascalies peuvent rester dans le texte des répliques
  lorsque leur emplacement structure le dialogue. Ne les transforme pas en
  personnages.
- Produis un JSON compact : pas d'indentation ni de retours à la ligne inutiles,
  une réplique par objet sur une seule ligne, afin de limiter la taille de la réponse.
- Aucun texte ni commentaire en dehors du JSON."""


class GeminiOCRError(Exception):
    """Gemini Vision processing or response validation failed."""


def _state_name(file_state: Any) -> str:
    return str(getattr(file_state, "name", file_state)).rsplit(".", 1)[-1].upper()


def _wait_until_file_active(client: Any, uploaded_file: Any) -> Any:
    file_name = getattr(uploaded_file, "name", None)
    if not file_name:
        raise GeminiOCRError("Gemini n'a pas fourni l'identifiant du fichier importé.")

    deadline = time.monotonic() + FILE_PROCESSING_TIMEOUT_SECONDS
    while True:
        current_file = client.files.get(name=file_name)
        state = _state_name(getattr(current_file, "state", ""))
        if state == "ACTIVE":
            return current_file
        if state == "FAILED":
            raise GeminiOCRError("Gemini n'a pas pu lire le document PDF.")
        if state != "PROCESSING":
            raise GeminiOCRError(
                f"État de traitement Gemini inattendu pour le PDF : {state or 'inconnu'}."
            )
        if time.monotonic() >= deadline:
            raise GeminiOCRError("Le traitement du PDF par Gemini a dépassé le délai prévu.")
        time.sleep(1)


def parse_gemini_response(response_text: str, fallback_title: str) -> Dict[str, Any]:
    try:
        payload = json.loads(response_text)
    except (TypeError, json.JSONDecodeError) as exc:
        raise GeminiOCRError("Gemini a renvoyé une réponse qui n'est pas un JSON valide.") from exc

    if not isinstance(payload, dict):
        raise GeminiOCRError("La réponse Gemini doit être un objet JSON.")

    title = payload.get("title")
    if not isinstance(title, str) or not title.strip():
        title = fallback_title

    raw_characters = payload.get("characters")
    raw_replicas = payload.get("replicas")
    if not isinstance(raw_characters, list) or not isinstance(raw_replicas, list):
        raise GeminiOCRError("La réponse Gemini ne contient pas les personnages et répliques attendus.")

    characters: List[str] = []
    character_by_normalized_name: Dict[str, str] = {}
    for raw_character in raw_characters:
        if not isinstance(raw_character, str) or not raw_character.strip():
            continue
        character = raw_character.strip().upper()
        normalized_name = character.casefold()
        if normalized_name not in character_by_normalized_name:
            character_by_normalized_name[normalized_name] = character
            characters.append(character)

    replicas: List[Dict[str, str]] = []
    for raw_replica in raw_replicas:
        if not isinstance(raw_replica, dict):
            raise GeminiOCRError("Gemini a renvoyé une réplique au format invalide.")
        raw_character = raw_replica.get("character")
        text = raw_replica.get("text")
        if not isinstance(raw_character, str) or not isinstance(text, str) or not text.strip():
            raise GeminiOCRError("Gemini a renvoyé une réplique sans personnage ou sans texte.")
        normalized_name = raw_character.strip().casefold()
        character = character_by_normalized_name.get(normalized_name)
        if not character:
            raise GeminiOCRError(
                "Une réplique renvoie vers un personnage absent de la liste détectée."
            )
        replicas.append({"character": character, "text": text.strip()})

    if not characters or not replicas:
        raise GeminiOCRError("Aucun personnage ou aucune réplique n'a été détecté dans ce PDF.")

    return {
        "title": title.strip(),
        "characters": characters,
        "replicas": replicas,
    }


def extract_script_with_gemini(pdf_path: Path, title: str | None = None) -> Dict[str, Any]:
    """Upload a PDF to Gemini, extract its structured dialogue, then delete the upload."""
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise GeminiOCRError("La clé GEMINI_API_KEY n'est pas configurée sur le serveur.")

    try:
        from google import genai
        from google.genai import types
    except ImportError as exc:
        raise GeminiOCRError(
            "Le SDK Google GenAI n'est pas installé sur le serveur OCR."
        ) from exc

    pdf_path = Path(pdf_path)
    fallback_title = title or pdf_path.stem
    model = os.environ.get("GEMINI_OCR_MODEL", DEFAULT_MODEL)
    client = genai.Client(api_key=api_key)
    uploaded_file = None
    try:
        uploaded_file = client.files.upload(
            file=str(pdf_path),
            config=types.UploadFileConfig(mime_type="application/pdf"),
        )
        active_file = _wait_until_file_active(client, uploaded_file)
        file_uri = getattr(active_file, "uri", None)
        mime_type = getattr(active_file, "mime_type", None) or "application/pdf"
        if not file_uri:
            raise GeminiOCRError("Gemini n'a pas fourni l'URI du PDF importé.")

        response = client.models.generate_content(
            model=model,
            contents=[
                types.Part.from_uri(file_uri=file_uri, mime_type=mime_type),
                EXTRACTION_PROMPT,
            ],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0,
                max_output_tokens=MAX_OUTPUT_TOKENS,
                # Le raisonnement interne ("thinking") de gemini-3.8-flash consomme
                # une grande partie du budget de tokens de sortie, ce qui tronquait
                # le JSON avant sa fin sur les scripts longs (finish_reason=MAX_TOKENS).
                # Cette tâche est une extraction structurée : le thinking n'apporte
                # rien et doit être désactivé pour garantir une réponse complète.
                thinking_config=types.ThinkingConfig(thinking_budget=0),
            ),
        )
        candidate = response.candidates[0] if getattr(response, "candidates", None) else None
        finish_reason = str(getattr(candidate, "finish_reason", "")).rsplit(".", 1)[-1].upper()
        if finish_reason == "MAX_TOKENS":
            logger.error(
                "Gemini response truncated (MAX_TOKENS) for %s: usage=%s",
                pdf_path.name,
                getattr(response, "usage_metadata", None),
            )
            raise GeminiOCRError(
                "Ce script est trop long pour être analysé en une seule fois. "
                "Essayez avec un extrait du PDF."
            )
        response_text = getattr(response, "text", None)
        if not response_text:
            raise GeminiOCRError("Gemini n'a renvoyé aucun contenu pour ce document.")
        return parse_gemini_response(response_text, fallback_title)
    except GeminiOCRError:
        raise
    except Exception as exc:
        logger.exception("Gemini Vision extraction failed for %s", pdf_path.name)
        raise GeminiOCRError("Le traitement Gemini Vision a échoué.") from exc
    finally:
        if uploaded_file is not None and getattr(uploaded_file, "name", None):
            try:
                client.files.delete(name=uploaded_file.name)
            except Exception:
                logger.warning(
                    "Unable to delete temporary Gemini upload %s",
                    uploaded_file.name,
                    exc_info=True,
                )
