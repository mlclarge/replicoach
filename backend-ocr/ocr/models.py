"""
Modèles de données du pipeline OCR.

Hiérarchie des structures :
  RawTextBlock    — bloc brut sorti du moteur OCR (bbox + texte + confiance)
  TextLine        — ligne reconstruite depuis plusieurs blocs
  PageRawResult   — résultat OCR brut d'une page entière
  ScriptElement   — élément structuré (personnage, réplique, didascalie…)
  Scene           — scène contenant des éléments
  Act             — acte contenant des scènes
  Script          — pièce complète structurée
  PipelineResult  — résultat final du pipeline (script + métriques)
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional


# ─── Enumerations ─────────────────────────────────────────────────────────────


class BlockType(Enum):
    """Classification d'un bloc OCR individuel."""

    CHARACTER = "character"
    DIALOGUE = "dialogue"
    STAGE_DIRECTION = "stage_direction"
    PAGE_NUMBER = "page_number"
    ACT_HEADING = "act_heading"
    SCENE_HEADING = "scene_heading"
    TITLE = "title"
    UNKNOWN = "unknown"


class ElementType(Enum):
    """Classification d'un élément structuré de la pièce."""

    CHARACTER = "character"
    DIALOGUE = "dialogue"
    STAGE_DIRECTION = "stage_direction"
    PAGE_NUMBER = "page_number"
    ACT_HEADING = "act_heading"
    SCENE_HEADING = "scene_heading"
    TITLE = "title"
    BLANK = "blank"


# ─── Structures de bas niveau (résultats bruts OCR) ───────────────────────────


@dataclass
class BoundingBox:
    """Rectangle englobant en coordonnées pixel."""

    x1: float
    y1: float
    x2: float
    y2: float

    @property
    def width(self) -> float:
        return self.x2 - self.x1

    @property
    def height(self) -> float:
        return self.y2 - self.y1

    @property
    def center_x(self) -> float:
        return (self.x1 + self.x2) / 2.0

    @property
    def center_y(self) -> float:
        return (self.y1 + self.y2) / 2.0

    @classmethod
    def from_quad(cls, points: List[List[float]]) -> "BoundingBox":
        """
        Construit depuis les 4 coins d'un quadrilatère (format PaddleOCR).

        PaddleOCR retourne [[x1,y1],[x2,y2],[x3,y3],[x4,y4]] dans le sens horaire.
        On prend l'enveloppe rectangulaire.
        """
        xs = [p[0] for p in points]
        ys = [p[1] for p in points]
        return cls(min(xs), min(ys), max(xs), max(ys))

    def to_dict(self) -> Dict[str, float]:
        return {"x1": self.x1, "y1": self.y1, "x2": self.x2, "y2": self.y2}


@dataclass
class RawTextBlock:
    """Bloc de texte brut sorti du moteur OCR, avant tout traitement."""

    text: str
    bbox: BoundingBox
    confidence: float              # Score 0.0 – 1.0
    page_number: int               # 1-based
    raw_quad: Optional[List[List[float]]] = None   # 4 coins originaux PaddleOCR


@dataclass
class TextLine:
    """
    Ligne de texte reconstruite à partir de blocs OCR proches sur l'axe Y.

    La propriété `text` gère automatiquement les césures (endi- + manchée → endimanchée).
    """

    blocks: List[RawTextBlock]
    page_number: int

    @property
    def text(self) -> str:
        """Texte de la ligne, blocs triés gauche→droite, césures résolues."""
        if not self.blocks:
            return ""
        sorted_blocks = sorted(self.blocks, key=lambda b: b.bbox.x1)
        parts: List[str] = []
        for block in sorted_blocks:
            word = block.text
            if (
                parts
                and parts[-1].endswith("-")
                and word
                and word[0].islower()
            ):
                # Césure détectée : joindre sans espace ni tiret
                parts[-1] = parts[-1][:-1] + word
            else:
                parts.append(word)
        return " ".join(parts)

    @property
    def confidence(self) -> float:
        if not self.blocks:
            return 0.0
        return sum(b.confidence for b in self.blocks) / len(self.blocks)

    @property
    def bbox(self) -> BoundingBox:
        if not self.blocks:
            raise ValueError("TextLine sans blocs")
        return BoundingBox(
            x1=min(b.bbox.x1 for b in self.blocks),
            y1=min(b.bbox.y1 for b in self.blocks),
            x2=max(b.bbox.x2 for b in self.blocks),
            y2=max(b.bbox.y2 for b in self.blocks),
        )


@dataclass
class PageRawResult:
    """Résultat OCR complet d'une page (après prétraitement + OCR + correction)."""

    page_number: int
    width: int                             # pixels, après rendu DPI
    height: int
    rotation_detected: float              # angle corrigé en degrés
    blocks: List[RawTextBlock]
    processing_time_ms: float
    preprocessing_applied: List[str]      # étapes appliquées, ex: ["clahe","deskew(1.0°)"]

    @property
    def avg_confidence(self) -> float:
        if not self.blocks:
            return 0.0
        return sum(b.confidence for b in self.blocks) / len(self.blocks)


# ─── Structures de haut niveau (après analyse de structure) ──────────────────


@dataclass
class ScriptElement:
    """Élément structuré d'une pièce de théâtre."""

    element_type: ElementType
    text: str
    character: Optional[str]              # Nom propre du personnage si applicable
    confidence: float
    page_number: int
    corrected: bool = False               # True si correction contextuelle appliquée
    original_text: Optional[str] = None  # Texte avant correction

    def to_dict(self) -> Dict[str, Any]:
        return {
            "type": self.element_type.value,
            "text": self.text,
            "character": self.character,
            "confidence": round(self.confidence, 4),
            "page": self.page_number,
            "corrected": self.corrected,
            "original": self.original_text,
        }


@dataclass
class Scene:
    """Scène d'un acte."""

    number: Optional[int]
    title: Optional[str]
    elements: List[ScriptElement] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "number": self.number,
            "title": self.title,
            "elements": [e.to_dict() for e in self.elements],
        }


@dataclass
class Act:
    """Acte de la pièce."""

    number: Optional[int]
    title: Optional[str]
    scenes: List[Scene] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "number": self.number,
            "title": self.title,
            "scenes": [s.to_dict() for s in self.scenes],
        }


@dataclass
class Script:
    """Pièce de théâtre complète, structurée et annotée."""

    title: Optional[str]
    acts: List[Act] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    page_results: List[PageRawResult] = field(default_factory=list)

    @property
    def all_elements(self) -> List[ScriptElement]:
        elements: List[ScriptElement] = []
        for act in self.acts:
            for scene in act.scenes:
                elements.extend(scene.elements)
        return elements

    @property
    def characters(self) -> List[str]:
        """Noms de personnages distincts détectés qui parlent au moins une fois, triés alphabétiquement."""
        names = {
            e.character
            for e in self.all_elements
            if e.character and e.element_type == ElementType.DIALOGUE
        }
        return sorted(names)

    @property
    def avg_confidence(self) -> float:
        elems = self.all_elements
        if not elems:
            return 0.0
        return sum(e.confidence for e in elems) / len(elems)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "title": self.title,
            "metadata": self.metadata,
            "characters": self.characters,
            "avg_confidence": round(self.avg_confidence, 4),
            "acts": [a.to_dict() for a in self.acts],
        }


# ─── Résultat final du pipeline ───────────────────────────────────────────────


@dataclass
class PipelineResult:
    """Résultat complet retourné par OCRPipeline.run()."""

    script: Script
    total_pages: int
    total_time_ms: float
    config_summary: Dict[str, Any]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "total_pages": self.total_pages,
            "total_time_ms": round(self.total_time_ms, 1),
            "config": self.config_summary,
            "script": self.script.to_dict(),
        }
