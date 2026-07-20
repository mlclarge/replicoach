"""
Utilitaires partagés : journalisation, mesure du temps, helpers filesystem.
"""

from __future__ import annotations

import logging
import time
from contextlib import contextmanager
from pathlib import Path
from typing import Generator, Optional

from .config import LoggingConfig


def setup_logging(cfg: LoggingConfig) -> logging.Logger:
    """
    Configure et retourne le logger racine ``ocr_pipeline``.

    Appelé une seule fois par OCRPipeline.__init__().
    Idempotent : si les handlers sont déjà en place, ne les duplique pas.
    """
    logger = logging.getLogger("ocr_pipeline")
    logger.setLevel(getattr(logging, cfg.level.upper(), logging.INFO))

    if logger.handlers:
        return logger  # Déjà configuré

    fmt = logging.Formatter(
        "%(asctime)s [%(levelname)-7s] %(name)s — %(message)s",
        datefmt="%H:%M:%S",
    )

    # Handler console
    ch = logging.StreamHandler()
    ch.setFormatter(fmt)
    logger.addHandler(ch)

    # Handler fichier optionnel
    if cfg.file:
        fh = logging.FileHandler(cfg.file, encoding="utf-8")
        fh.setFormatter(fmt)
        logger.addHandler(fh)

    return logger


@contextmanager
def timer(
    label: str,
    logger: Optional[logging.Logger] = None,
) -> Generator[dict, None, None]:
    """
    Mesure le temps d'exécution d'un bloc de code.

    Usage::

        with timer("OCR page 5", logger) as t:
            do_something()
        print(t["elapsed_ms"])  # millisecondes
    """
    result: dict = {"elapsed_ms": 0.0}
    start = time.perf_counter()
    try:
        yield result
    finally:
        elapsed = (time.perf_counter() - start) * 1000.0
        result["elapsed_ms"] = elapsed
        if logger:
            logger.debug(f"{label} : {elapsed:.1f} ms")


def ensure_dir(path: Path) -> Path:
    """Crée le répertoire (et ses parents) si absent, retourne le chemin."""
    path = Path(path)
    path.mkdir(parents=True, exist_ok=True)
    return path
