"""
Étape 1 & 2 : Lecture du PDF et rendu haute résolution.

Pourquoi PyMuPDF (fitz) plutôt que pdf2image / poppler :
• Rendu 2-5× plus rapide (moteur C/C++ natif, sans process externe)
• Contrôle précis de la résolution via fitz.Matrix
• Accès aux métadonnées de page (rotation, dimensions, texte natif)
• Gestion robuste des PDF partiellement corrompus
• Sortie directe en tableau NumPy (zéro copie inutile)

Architecture :
• PDFInfo   : structure immuable décrivant le PDF
• PDFReader : lecture + rendu, ouverture unique du document pour iter_pages()
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Iterator, List, Optional, Tuple

import fitz  # PyMuPDF
import numpy as np

from .config import PerformanceConfig
from .exceptions import PDFReadError

logger = logging.getLogger("ocr_pipeline.reader")


@dataclass
class PDFInfo:
    """Métadonnées structurelles d'un PDF (sans rendu des pages)."""

    path: Path
    num_pages: int
    page_sizes: List[Tuple[float, float]]    # (width_pt, height_pt) par page
    rotations: List[float]                   # degrés par page (0, 90, 180, 270)
    is_image_pdf: bool                       # True si aucun texte natif significatif

    def __str__(self) -> str:
        max_rot = max(abs(r) for r in self.rotations) if self.rotations else 0
        return (
            f"PDFInfo(pages={self.num_pages}, "
            f"image_pdf={self.is_image_pdf}, "
            f"size_pt={self.page_sizes[0] if self.page_sizes else 'N/A'}, "
            f"rotation_max={max_rot:.0f}°)"
        )


class PDFReader:
    """
    Lit un PDF scanné et rend chaque page en tableau NumPy.

    Usage::

        reader = PDFReader(cfg.performance)
        info = reader.analyse(Path("piece.pdf"))
        for page_num, image in reader.iter_pages(Path("piece.pdf")):
            preprocess(image)
    """

    def __init__(self, cfg: PerformanceConfig) -> None:
        self._cfg = cfg

    # ── API publique ──────────────────────────────────────────────────────────

    def analyse(self, pdf_path: Path) -> PDFInfo:
        """
        Analyse le PDF sans rendre les pages (rapide même pour 500 pages).

        Détecte :
        - Nombre de pages et dimensions
        - Rotations encodées dans les métadonnées
        - Si le PDF est un PDF-image (aucun texte natif)

        :raises PDFReadError: fichier absent, illisible ou non-PDF
        """
        pdf_path = Path(pdf_path)
        self._validate_path(pdf_path)

        try:
            doc = fitz.open(str(pdf_path))
        except Exception as exc:
            raise PDFReadError(f"Impossible d'ouvrir {pdf_path} : {exc}") from exc

        sizes: List[Tuple[float, float]] = []
        rotations: List[float] = []
        total_chars = 0

        for page in doc:
            sizes.append((page.rect.width, page.rect.height))
            rotations.append(float(page.rotation))
            total_chars += len(page.get_text("text").strip())

        num_pages = len(doc)
        doc.close()

        # Heuristique PDF-image : moins de 50 caractères natifs par page en moyenne
        avg_chars = total_chars / max(num_pages, 1)
        is_image_pdf = avg_chars < 50

        info = PDFInfo(
            path=pdf_path,
            num_pages=num_pages,
            page_sizes=sizes,
            rotations=rotations,
            is_image_pdf=is_image_pdf,
        )

        logger.info(str(info))

        if not is_image_pdf:
            logger.warning(
                f"Ce PDF contient {avg_chars:.0f} caractères natifs par page en moyenne. "
                "L'OCR peut être inutile ou redondant."
            )

        return info

    def render_page(
        self,
        pdf_path: Path,
        page_index: int,
        dpi: Optional[int] = None,
        grayscale: bool = True,
    ) -> np.ndarray:
        """
        Rend une page en tableau NumPy.

        :param page_index: index 0-based
        :param dpi: résolution (défaut cfg.dpi, plafonné à cfg.max_dpi)
        :param grayscale: True → H×W uint8 | False → H×W×3 uint8 (BGR)
        :raises PDFReadError: si le rendu échoue
        """
        dpi = self._clamp_dpi(dpi)
        scale = dpi / 72.0

        try:
            doc = fitz.open(str(pdf_path))
            page = doc[page_index]
            mat = fitz.Matrix(scale, scale)
            cs = fitz.csGRAY if grayscale else fitz.csRGB
            pix = page.get_pixmap(matrix=mat, colorspace=cs, alpha=False)
            doc.close()
        except Exception as exc:
            raise PDFReadError(
                f"Erreur rendu page {page_index + 1} de «{pdf_path.name}» : {exc}"
            ) from exc

        arr = np.frombuffer(pix.samples, dtype=np.uint8).copy()
        return (
            arr.reshape(pix.height, pix.width)
            if grayscale
            else arr.reshape(pix.height, pix.width, 3)
        )

    def iter_pages(
        self,
        pdf_path: Path,
        page_range: Optional[range] = None,
        dpi: Optional[int] = None,
        grayscale: bool = True,
    ) -> Iterator[Tuple[int, np.ndarray]]:
        """
        Itère sur les pages, yielding ``(page_number_1based, array)``.

        Ouvre le document **une seule fois** (optimisation I/O).
        Gère les pages défectueuses avec un warning plutôt qu'une exception fatale.

        :param page_range: plage d'indices 0-based (défaut : toutes les pages)
        """
        dpi = self._clamp_dpi(dpi)
        scale = dpi / 72.0
        pdf_path = Path(pdf_path)
        self._validate_path(pdf_path)

        try:
            doc = fitz.open(str(pdf_path))
        except Exception as exc:
            raise PDFReadError(f"Impossible d'ouvrir {pdf_path} : {exc}") from exc

        num_pages = len(doc)
        if page_range is None:
            page_range = range(num_pages)

        mat = fitz.Matrix(scale, scale)
        cs = fitz.csGRAY if grayscale else fitz.csRGB

        try:
            for idx in page_range:
                if idx >= num_pages:
                    logger.warning(
                        f"Index de page {idx} hors limites (total={num_pages}), arrêt."
                    )
                    break
                try:
                    pix = doc[idx].get_pixmap(matrix=mat, colorspace=cs, alpha=False)
                    arr = np.frombuffer(pix.samples, dtype=np.uint8).copy()
                    arr = (
                        arr.reshape(pix.height, pix.width)
                        if grayscale
                        else arr.reshape(pix.height, pix.width, 3)
                    )
                    # Libération mémoire stricte du pixmap
                    del pix
                    import gc
                    gc.collect()
                    
                    yield idx + 1, arr
                except Exception as exc:
                    logger.warning(f"Page {idx + 1} : rendu impossible ({exc}), ignorée.")
        finally:
            doc.close()

    # ── Privé ─────────────────────────────────────────────────────────────────

    def _validate_path(self, path: Path) -> None:
        if not path.exists():
            raise PDFReadError(f"Fichier introuvable : {path}")
        if path.suffix.lower() != ".pdf":
            raise PDFReadError(
                f"Extension non reconnue : {path.suffix!r} (attendu .pdf)"
            )

    def _clamp_dpi(self, dpi: Optional[int]) -> int:
        requested = dpi if dpi is not None else self._cfg.dpi
        clamped = min(requested, self._cfg.max_dpi)
        if clamped != requested:
            logger.debug(f"DPI plafonné de {requested} à {clamped}")
        return clamped
