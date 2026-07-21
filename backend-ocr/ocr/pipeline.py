"""
Orchestrateur du pipeline OCR complet.

Coordonne les étapes 1-7 :
  1. Analyse du PDF (PDFReader.analyse)
  2. Rendu haute résolution page par page (PDFReader.iter_pages)
  3. Prétraitement OpenCV (PreprocessingPipeline)
  4. OCR PaddleOCR (PaddleOCREngine)
  5. Correction contextuelle (ContextCorrector)
  6. Analyse de structure (LayoutAnalyzer)
  7. Export (Exporter)

Fonctionnalités de robustesse :
  • Cache par page (pickle) : reprise après interruption sans re-OCR
  • Journalisation détaillée : temps par page, confiance, étapes
  • Gestion des erreurs par page : une page défectueuse n'arrête pas le pipeline
"""

from __future__ import annotations

import hashlib
import logging
import pickle
import time
from pathlib import Path
from typing import List, Optional

from .config import OCRConfig
from .context_correction import ContextCorrector
from .exceptions import OCRError
from .exporter import Exporter
from .layout_analysis import LayoutAnalyzer
from .models import PageRawResult, PipelineResult
from .ocr_engine import PaddleOCREngine
from .preprocessing import PreprocessingPipeline
from .reader import PDFReader
from .utils import ensure_dir, setup_logging, timer

logger = logging.getLogger("ocr_pipeline")


class OCRPipeline:
    """
    Pipeline OCR complet pour pièces de théâtre scannées.

    Usage minimal::

        config = OCRConfig.for_theater_play(
            character_names=["JACQUES", "LUCIE", "CORINNE", "JEAN"]
        )
        pipeline = OCRPipeline(config)
        result = pipeline.run(
            Path("tout_bascule.pdf"),
            output_dir=Path("./output"),
            title="Tout Bascule",
        )
        print(result.script.characters)
    """

    def __init__(self, config: OCRConfig) -> None:
        self._cfg = config
        setup_logging(config.logging)

        self._reader = PDFReader(config.performance)
        self._preprocessor = PreprocessingPipeline(config.preprocessing)
        self._engine = PaddleOCREngine(config.engine)
        self._corrector = ContextCorrector(config.correction)
        self._analyzer = LayoutAnalyzer(config.layout, config.correction)
        self._exporter = Exporter()

        # Répertoire de cache
        self._cache_dir: Optional[Path] = None
        if config.performance.enable_cache:
            cache_path = config.performance.cache_dir or Path(".ocr_cache")
            self._cache_dir = ensure_dir(cache_path)

    # ── API publique ──────────────────────────────────────────────────────────

    def run(
        self,
        pdf_path: Path,
        output_dir: Optional[Path] = None,
        page_range: Optional[range] = None,
        title: Optional[str] = None,
    ) -> PipelineResult:
        """
        Exécute le pipeline complet sur un PDF.

        :param pdf_path: chemin du PDF à traiter
        :param output_dir: si fourni, export automatique TXT/JSON/MD
        :param page_range: plage d'indices 0-based (défaut : toutes les pages)
        :param title: titre de la pièce (optionnel, enrichit les métadonnées)
        :returns: PipelineResult contenant le Script structuré + métriques
        :raises PDFReadError: si le fichier est inaccessible
        :raises OCREngineError: si PaddleOCR n'est pas installé
        """
        pdf_path = Path(pdf_path)
        t_total_start = time.perf_counter()

        # ── Étape 1 : analyse du PDF ──────────────────────────────────────
        pdf_info = self._reader.analyse(pdf_path)

        if page_range is None:
            page_range = range(pdf_info.num_pages)

        # Calculer le nombre de pages effectif (sans dépasser le total du PDF)
        total_pages = sum(1 for i in page_range if i < pdf_info.num_pages)
        logger.info("Démarrage pipeline : %d pages à traiter", total_pages)

        # ── Étapes 2–5 : traitement page par page ─────────────────────────
        page_results: List[PageRawResult] = []

        for i, (page_num, image) in enumerate(
            self._reader.iter_pages(pdf_path, page_range), start=1
        ):
            logger.info("[%d/%d] Page %d…", i, total_pages, page_num)

            # Reprise depuis le cache
            cached = self._load_page_cache(pdf_path, page_num)
            if cached is not None:
                logger.info("  → depuis cache")
                page_results.append(cached)
                continue

            t_page = time.perf_counter()

            try:
                # Étape 3 : prétraitement
                with timer(f"prétraitement p{page_num}") as t_pre:
                    pre = self._preprocessor.process(image)

                # Étape 4 : OCR
                with timer(f"OCR p{page_num}") as t_ocr:
                    blocks = self._engine.recognize(
                        pre.image,
                        page_number=page_num,
                        confidence_threshold=self._cfg.correction.confidence_threshold,
                    )

                # Étape 5 : correction contextuelle
                blocks = self._corrector.correct_blocks(blocks)

            except OCRError as exc:
                logger.error("Page %d : erreur pipeline (%s), page ignorée", page_num, exc)
                continue

            h, w = image.shape[:2]
            proc_ms = (time.perf_counter() - t_page) * 1000.0

            page_result = PageRawResult(
                page_number=page_num,
                width=w,
                height=h,
                rotation_detected=pre.skew_angle,
                blocks=blocks,
                processing_time_ms=proc_ms,
                preprocessing_applied=pre.applied_steps,
            )

            logger.info(
                "  %d blocs | conf=%.2f | %.0f ms "
                "(pré=%.0f ms, ocr=%.0f ms) | %s",
                len(blocks),
                page_result.avg_confidence,
                proc_ms,
                t_pre["elapsed_ms"],
                t_ocr["elapsed_ms"],
                ", ".join(pre.applied_steps) or "aucun prétraitement",
            )

            page_results.append(page_result)
            self._save_page_cache(pdf_path, page_num, page_result)

            # Libération explicite de la mémoire pour éviter les crashs OOM
            if "image" in locals():
                del image
            if "pre" in locals():
                del pre
            if "blocks" in locals():
                del blocks
            if "page_result" in locals():
                del page_result
            import gc
            gc.collect()

        # ── Étape 6 : analyse de structure ────────────────────────────────
        logger.info("Analyse de structure…")
        script = self._analyzer.build_script(page_results, title=title)

        total_ms = (time.perf_counter() - t_total_start) * 1000.0
        logger.info(
            "Pipeline terminé : %d pages | %.1f s | confiance moy=%.1f%%",
            len(page_results),
            total_ms / 1000.0,
            script.avg_confidence * 100,
        )

        result = PipelineResult(
            script=script,
            total_pages=len(page_results),
            total_time_ms=total_ms,
            config_summary=self._config_summary(),
        )

        # ── Étape 7 : export ──────────────────────────────────────────────
        if output_dir:
            stem = pdf_path.stem
            self._exporter.save_all(result, Path(output_dir), stem=stem)

        return result

    def warmup(self) -> None:
        """
        Précharge le moteur OCR avant le traitement.
        Recommandé pour éviter la latence sur la première page.
        """
        self._engine.warmup()

    # ── Cache ──────────────────────────────────────────────────────────────

    def _cache_key(self, pdf_path: Path, page_num: int) -> str:
        """Clé unique robuste basée sur la signature du contenu (MD5) et la taille, pour gérer les fichiers temporaires."""
        stat = pdf_path.stat()
        dpi = self._cfg.performance.dpi
        
        try:
            # Hash basé sur la taille + le début/fin du fichier (ultra-rapide et stable)
            with open(pdf_path, "rb") as f:
                header = f.read(8192)
                if stat.st_size > 8192:
                    f.seek(-8192, 2)
                    footer = f.read(8192)
                else:
                    footer = b""
            content_sig = hashlib.md5(header + footer).hexdigest()
            raw = f"{stat.st_size}|{content_sig}|dpi{dpi}"
        except Exception:
            # Fallback sécurisé en cas d'erreur de lecture
            raw = f"{pdf_path.name}|{stat.st_size}|dpi{dpi}"
            
        pdf_hash = hashlib.md5(raw.encode()).hexdigest()[:10]
        return f"{pdf_hash}_p{page_num:04d}"

    def _cache_path(self, key: str) -> Optional[Path]:
        if self._cache_dir is None:
            return None
        return self._cache_dir / f"{key}.pkl"

    def _load_page_cache(
        self, pdf_path: Path, page_num: int
    ) -> Optional[PageRawResult]:
        if not self._cfg.performance.enable_cache:
            return None
        path = self._cache_path(self._cache_key(pdf_path, page_num))
        if path and path.exists():
            try:
                with path.open("rb") as f:
                    return pickle.load(f)
            except Exception as exc:
                logger.warning("Cache corrompu page %d (%s), recalcul", page_num, exc)
        return None

    def _save_page_cache(
        self, pdf_path: Path, page_num: int, result: PageRawResult
    ) -> None:
        if not self._cfg.performance.enable_cache:
            return
        path = self._cache_path(self._cache_key(pdf_path, page_num))
        if path is None:
            return
        try:
            tmp = path.with_suffix(".tmp")
            with tmp.open("wb") as f:
                pickle.dump(result, f)
            tmp.replace(path)
        except Exception as exc:
            logger.warning("Impossible d'écrire le cache page %d : %s", page_num, exc)

    def _config_summary(self) -> dict:
        return {
            "dpi": self._cfg.performance.dpi,
            "language": self._cfg.engine.language,
            "use_gpu": self._cfg.engine.use_gpu,
            "preprocessing": {
                "clahe": self._cfg.preprocessing.clahe,
                "deskew": self._cfg.preprocessing.deskew,
                "denoise": self._cfg.preprocessing.denoise,
                "binarize": self._cfg.preprocessing.adaptive_binarization,
            },
            "correction": {
                "enabled": self._cfg.correction.enable,
                "known_characters": self._cfg.correction.character_names,
            },
        }
