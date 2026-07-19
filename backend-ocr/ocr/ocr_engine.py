"""
Étape 4 : Moteur OCR PaddleOCR 3.x (PP-OCRv6).

Pourquoi PaddleOCR plutôt qu'EasyOCR (retour d'expérience sur tout_bascule) :
• PP-OCRv6 : taux d'erreur ~3-4% vs ~10-15% EasyOCR sur documents anciens
• Détecteur DB++ : bounding boxes nettement plus précises → meilleure
  reconstruction des lignes (fin des «JAcQUEs» et fusions intempestives)
• Classifier d'orientation de ligne : corrige 0°/90°/180°/270°
• Couvre les diacritiques français (é, è, à, ç, œ, æ…)
• Architecture découplée (det / textline_ori / rec) : chaque composant remplaçable

Note API PaddleOCR 3.x vs 2.x :
  - use_angle_cls    → use_textline_orientation
  - det_db_thresh    → text_det_thresh
  - det_db_unclip_ratio → text_det_unclip_ratio
  - Résultats : OCRResult.rec_texts / rec_scores / rec_polys (plus de [[bbox,(t,c)]])
  - enable_mkldnn=False requis sur Windows (bug oneDNN PaddlePaddle 3.3)

Remplacement futur par Surya ou Tesseract :
  Implémenter l'interface (recognize → List[RawTextBlock]) dans une nouvelle
  classe et passer cette classe à OCRPipeline. Aucun autre module à modifier.
"""

from __future__ import annotations

import logging
from typing import List, Optional

import cv2
import numpy as np

from .config import OCREngineConfig
from .exceptions import OCREngineError
from .models import BoundingBox, RawTextBlock

logger = logging.getLogger("ocr_pipeline.engine")


class PaddleOCREngine:
    """
    Encapsulation du moteur PaddleOCR.

    Lazy-loading : PaddleOCR est initialisé à la première utilisation
    (chargement des modèles ~3-10 s la première fois).

    Usage::

        engine = PaddleOCREngine(cfg.engine)
        blocks = engine.recognize(preprocessed_image, page_number=1)
    """

    def __init__(self, cfg: OCREngineConfig) -> None:
        self._cfg = cfg
        self._engine: Optional[object] = None   # PaddleOCR instance

    # ── API publique ──────────────────────────────────────────────────────────

    def recognize(
        self,
        image: np.ndarray,
        page_number: int = 1,
        confidence_threshold: float = 0.3,
    ) -> List[RawTextBlock]:
        """
        OCR sur une image, retourne les blocs triés ordre de lecture.

        :param image: H×W uint8 (grayscale) ou H×W×3 uint8 (BGR)
        :param page_number: numéro de page (1-based) pour les métadonnées
        :param confidence_threshold: seuil de confiance minimum [0.0, 1.0]
        :returns: liste de RawTextBlock triés top→bottom, left→right
        :raises OCREngineError: si le moteur n'est pas disponible ou échoue
        """
        self._ensure_loaded()

        img_bgr = self._to_bgr(image)

        try:
            raw = list(self._engine.predict(img_bgr))
        except Exception as exc:
            raise OCREngineError(
                f"Erreur OCR page {page_number} : {exc}"
            ) from exc

        # PaddleOCR 3.x / PaddleX : predict() retourne une liste de dict-like OCRResult
        # Structure : result['rec_texts'], result['rec_scores'], result['dt_polys']
        # (NB : rec_polys n'existe PAS dans cette version — utiliser dt_polys)
        if not raw:
            logger.info(f"Page {page_number} : aucun texte détecté")
            return []

        blocks: List[RawTextBlock] = []

        for ocr_result in raw:
            if ocr_result is None:
                continue

            # Accès dict (OCRResult étend dict dans PaddleX 3.7)
            if hasattr(ocr_result, "keys"):
                texts = ocr_result.get("rec_texts") or []
                scores = ocr_result.get("rec_scores") or []
                polys = ocr_result.get("dt_polys") or []
            else:
                # Fallback attributs (versions futures éventuelles)
                texts = getattr(ocr_result, "rec_texts", None) or []
                scores = getattr(ocr_result, "rec_scores", None) or []
                polys = (getattr(ocr_result, "dt_polys", None)
                         or getattr(ocr_result, "rec_polys", None) or [])

            for text, conf, poly in zip(texts, scores, polys):
                conf = float(conf)
                if conf < confidence_threshold:
                    continue
                text = str(text).strip()
                if not text:
                    continue

                # poly est un ndarray shape=(4, 2) → convertir en list de points
                quad = poly.tolist() if hasattr(poly, "tolist") else list(poly)
                bbox = BoundingBox.from_quad(quad)
                blocks.append(
                    RawTextBlock(
                        text=text,
                        bbox=bbox,
                        confidence=conf,
                        page_number=page_number,
                        raw_quad=quad,
                    )
                )

        # Tri ordre de lecture : Y d'abord, puis X
        blocks.sort(key=lambda b: (b.bbox.y1, b.bbox.x1))

        avg_conf = (
            sum(b.confidence for b in blocks) / len(blocks) if blocks else 0.0
        )
        logger.debug(
            f"Page {page_number} : {len(blocks)} blocs, confiance moy={avg_conf:.3f}"
        )
        return blocks

    def warmup(self) -> None:
        """
        Force le chargement des modèles PaddleOCR.

        Appeler au démarrage pour éviter la latence sur la première page.
        """
        self._ensure_loaded()
        logger.info("Moteur OCR prêt.")

    # ── Privé ─────────────────────────────────────────────────────────────────

    def _ensure_loaded(self) -> None:
        """Initialise PaddleOCR à la première utilisation (lazy loading)."""
        if self._engine is not None:
            return

        logger.info(
            "Chargement PaddleOCR "
            f"(lang={self._cfg.language}, device={self._cfg.device}, "
            f"textline_ori={self._cfg.use_textline_orientation})…"
        )
        try:
            from paddleocr import PaddleOCR
        except ImportError as exc:
            raise OCREngineError(
                "paddleocr non installé. "
                "Exécuter : pip install paddleocr paddlepaddle"
            ) from exc

        try:
            import warnings
            warnings.filterwarnings("ignore", category=DeprecationWarning)

            self._engine = PaddleOCR(
                lang='fr',
                use_angle_cls=False,
                enable_mkldnn=False,
                det_limit_side_len=2048,
                det_limit_type='max',
                ir_optim=False,
            )
        except Exception as exc:
            raise OCREngineError(
                f"Erreur d'initialisation PaddleOCR : {exc}"
            ) from exc

        logger.info("PaddleOCR chargé avec succès.")

    @staticmethod
    def _to_bgr(image: np.ndarray) -> np.ndarray:
        """
        Convertit en BGR 3-canaux pour PaddleOCR.

        PaddleOCR accepte BGR ou RGB mais requiert 3 canaux.
        """
        if image.ndim == 2:
            return cv2.cvtColor(image, cv2.COLOR_GRAY2BGR)
        if image.ndim == 3 and image.shape[2] == 1:
            return cv2.cvtColor(image[:, :, 0], cv2.COLOR_GRAY2BGR)
        return image
