import os
import shutil
import tempfile
from pathlib import Path
from typing import List, Optional
from fastapi import FastAPI, File, Form, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from ocr import OCRConfig, OCRPipeline

app = FastAPI(title="RepliCoach OCR API", version="1.0")

# Autoriser le CORS pour le frontend React
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # En production, mettre l'URL du frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

import re

@app.post("/api/ocr")
async def perform_ocr(
    file: UploadFile = File(...),
    characters: str = Form(...),  # Liste stricte obligatoire de personnages (séparés par des virgules)
    acts: int = Form(...),        # Nombre d'actes attendus (obligatoire)
    title: Optional[str] = Form(None)
):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Seuls les fichiers PDF sont supportés.")

    # Parsing des personnages de référence obligatoires et extraction des alias du type "NOM (ALIAS)"
    characters_str = characters
    user_chars = []
    user_aliases = {}
    for item in characters_str.split(','):
        item = item.strip()
        if not item:
            continue
        match = re.match(r"^(.*?)\s*\((.*?)\)$", item)
        if match:
            main_name = match.group(1).strip().upper()
            alias = match.group(2).strip().upper()
            user_chars.append(main_name)
            user_aliases[alias] = main_name
        else:
            user_chars.append(item.upper())

    if not user_chars:
        raise HTTPException(status_code=400, detail="Au moins un personnage de référence est requis.")

    # Configuration OCR avec la liste stricte et les abréviations
    config = OCRConfig.for_theater_play(character_names=user_chars)
    config.correction.character_abbreviations = user_aliases
    pipeline = OCRPipeline(config)

    # Sauvegarde temporaire du PDF uploadé
    fd, tmp_pdf_path = tempfile.mkstemp(suffix=".pdf")
    os.close(fd)
    
    tmp_dir = tempfile.mkdtemp()
    output_dir = Path(tmp_dir)

    try:
        with open(tmp_pdf_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Lancer le pipeline
        result = pipeline.run(
            pdf_path=Path(tmp_pdf_path),
            output_dir=output_dir, # on demande au pipeline de générer le JSON
            title=title or "Script",
        )

        # Injecter les métadonnées obligatoires d'actes et de scènes
        result.script.metadata["expected_acts"] = acts

        # On peut renvoyer directement le dictionnaire généré par export ou l'objet Script
        # Mais le plus simple est de lire le .json généré par l'Exporter
        json_path = output_dir / f"{Path(tmp_pdf_path).stem}.json"
        
        # On lit aussi le Markdown généré
        md_path = output_dir / f"{Path(tmp_pdf_path).stem}.md"
        markdown_text = ""
        if md_path.exists():
            with open(md_path, "r", encoding="utf-8") as f:
                markdown_text = f.read()
        else:
            markdown_text = result.script.to_markdown()

        # Si le JSON n'est pas trouvé (bizarre), on reconstruit
        json_data = {
            "title": result.script.title,
            "characters": result.script.characters,
            "avg_confidence": result.script.avg_confidence,
            "elements": [
                {
                    "type": e.element_type.value,
                    "text": e.text,
                    "character": e.character,
                    "confidence": e.confidence,
                    "page": e.page_number
                }
                for e in result.script.all_elements
            ]
        }
        
        if json_path.exists():
            import json
            with open(json_path, "r", encoding="utf-8") as f:
                json_data = json.load(f)

        return {
            "markdown": markdown_text,
            "json": json_data,
            "confidence": result.script.avg_confidence * 100
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        # Nettoyage
        if os.path.exists(tmp_pdf_path):
            os.remove(tmp_pdf_path)
        shutil.rmtree(tmp_dir, ignore_errors=True)

@app.post("/api/extract-premium")
async def extract_premium(
    file: UploadFile = File(...),
    characters: Optional[str] = Form(None),
    acts: Optional[int] = Form(None),
    title: Optional[str] = Form(None)
):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Seuls les fichiers PDF sont supportés.")

    user_chars = []
    user_aliases = {}
    if characters:
        for item in characters.split(','):
            item = item.strip()
            if not item:
                continue
            match = re.match(r"^(.*?)\s*\((.*?)\)$", item)
            if match:
                main_name = match.group(1).strip().upper()
                alias = match.group(2).strip().upper()
                user_chars.append(main_name)
                user_aliases[alias] = main_name
            else:
                user_chars.append(item.upper())

    config = OCRConfig.for_theater_play(character_names=user_chars or None)
    if user_aliases:
        config.correction.character_abbreviations = user_aliases
    pipeline = OCRPipeline(config)

    fd, tmp_pdf_path = tempfile.mkstemp(suffix=".pdf")
    os.close(fd)
    
    tmp_dir = tempfile.mkdtemp()
    output_dir = Path(tmp_dir)

    try:
        with open(tmp_pdf_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        result = pipeline.run(
            pdf_path=Path(tmp_pdf_path),
            output_dir=output_dir,
            title=title or file.filename.rsplit('.', 1)[0],
        )

        if acts:
            result.script.metadata["expected_acts"] = acts

        from ocr.models import ElementType
        
        detected_chars = [{"name": c} for c in result.script.characters]
        
        replicas = []
        for elem in result.script.all_elements:
            if elem.element_type == ElementType.DIALOGUE:
                replicas.append({
                    "character": elem.character or "INCONNU",
                    "text": elem.text
                })

        return {
            "title": result.script.title or title or file.filename.rsplit('.', 1)[0],
            "characters": detected_chars,
            "replicas": replicas,
            "confidence": result.script.avg_confidence * 100
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if os.path.exists(tmp_pdf_path):
            os.remove(tmp_pdf_path)
        shutil.rmtree(tmp_dir, ignore_errors=True)

@app.get("/api/health")
def health_check():
    return {"status": "ok", "message": "OCR API is running"}
