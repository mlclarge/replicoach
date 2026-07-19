"""
Configuration centrale du pipeline OCR.

Aucun paramètre n'est codé en dur dans les modules fonctionnels —
tout transite par cette classe. Utiliser `OCRConfig.for_theater_play()`
pour obtenir un profil précalibré pour les pièces scannées.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional


# ─── Sous-configurations par domaine ─────────────────────────────────────────


@dataclass
class PreprocessingConfig:
    """Paramètres de prétraitement image (OpenCV)."""

    grayscale: bool = True
    enhance_contrast: bool = True          # CLAHE activé via clahe=True
    denoise: bool = True
    deskew: bool = True
    correct_perspective: bool = False      # Désactivé par défaut (risqué)
    remove_margins: bool = True
    adaptive_binarization: bool = True
    sharpen: bool = True
    clahe: bool = True
    remove_small_spots: bool = True

    # Paramètres fins CLAHE
    clahe_clip_limit: float = 2.0
    clahe_tile_grid_size: tuple = (8, 8)

    # Paramètres fins débruitage NLM
    denoise_h: int = 10
    denoise_template_window: int = 7
    denoise_search_window: int = 21

    # Paramètres fins netteté
    sharpen_strength: float = 1.5

    # Paramètres fins binarisation
    binarization_block_size: int = 35      # Impair, taille du voisinage
    binarization_c: int = 10              # Constante soustraite du seuil

    # Suppression petites taches (après binarisation)
    min_spot_area: int = 30               # pixels² minimum pour garder un composant


@dataclass
class OCREngineConfig:
    """Paramètres du moteur PaddleOCR 3.x.

    Justification des valeurs par défaut :
    - text_det_thresh=0.3       : seuil bas → détecte plus de zones, moins de manqués
    - text_det_unclip_ratio=1.8 : expansion boîtes → capture les caractères aux bords
    - use_textline_orientation  : corrige les lignes à 90°/180°/270° (scans mal orientés)
    - enable_mkldnn=False       : oneDNN désactivé (bug PaddlePaddle 3.3 sur Windows)
    - use_doc_orientation_classify=False : pas de classification globale du doc (inutile)
    - use_doc_unwarping=False            : pas de dépliage de page (images plates)
    """

    language: str = "fr"
    use_gpu: bool = False
    device: str = "cpu"
    use_textline_orientation: bool = True
    use_doc_orientation_classify: bool = False
    use_doc_unwarping: bool = False
    text_det_thresh: float = 0.3
    text_det_box_thresh: float = 0.5
    text_det_unclip_ratio: float = 1.8
    text_recognition_batch_size: int = 6
    cpu_threads: int = 4
    enable_mkldnn: bool = False           # Désactivé : bug oneDNN sur Windows


@dataclass
class CorrectionConfig:
    """Paramètres de correction contextuelle post-OCR."""

    enable: bool = True
    confidence_threshold: float = 0.5      # En-dessous : substitutions OCR appliquées
    high_confidence_threshold: float = 0.95  # Au-dessus : aucune correction

    character_names: List[str] = field(default_factory=list)
    character_abbreviations: Dict[str, str] = field(default_factory=dict)

    # Seuil RapidFuzz 0-100 pour accepter une correction de nom de personnage
    fuzzy_match_threshold: int = 78

    theater_vocabulary: List[str] = field(default_factory=lambda: [
        "didascalie", "acte", "scène", "rideau", "tableau",
        "réplique", "monologue", "tirade", "aparté",
    ])


@dataclass
class LayoutConfig:
    """Paramètres d'analyse de structure de la pièce."""

    enable: bool = True

    # Détection des noms de personnages
    character_caps_min_ratio: float = 0.70   # ≥70% de lettres en majuscules
    character_max_words: int = 5             # Nom de personnage = phrase courte

    # Reconstruction des lignes depuis les bounding boxes
    line_merge_y_tolerance: float = 0.012    # fraction de la hauteur de page

    # Mots-clés de structure (insensibles à la casse)
    act_keywords: List[str] = field(default_factory=lambda: [
        "acte", "act", "partie", "prologue", "épilogue", "epilogue",
    ])
    scene_keywords: List[str] = field(default_factory=lambda: [
        "scène", "scene", "tableau",
    ])


@dataclass
class PerformanceConfig:
    """Paramètres de performance et de reprise."""

    dpi: int = 300                          # Résolution de rendu (minimum recommandé)
    max_dpi: int = 600                      # Plafond configurable
    num_threads: int = 4
    enable_cache: bool = True               # Cache par page (reprise après coupure)
    cache_dir: Optional[Path] = None        # Défaut : .ocr_cache/ à côté du script
    resume: bool = True                     # Réutilise le cache existant


@dataclass
class LoggingConfig:
    """Paramètres de journalisation."""

    level: str = "INFO"
    file: Optional[Path] = None
    log_per_page_timing: bool = True
    log_confidence: bool = True


# ─── Configuration principale ─────────────────────────────────────────────────


@dataclass
class OCRConfig:
    """
    Point d'entrée unique de toute la configuration du pipeline.

    Usage rapide::

        cfg = OCRConfig.for_theater_play(
            character_names=["JACQUES", "LUCIE", "CORINNE"]
        )
    """

    preprocessing: PreprocessingConfig = field(default_factory=PreprocessingConfig)
    engine: OCREngineConfig = field(default_factory=OCREngineConfig)
    correction: CorrectionConfig = field(default_factory=CorrectionConfig)
    layout: LayoutConfig = field(default_factory=LayoutConfig)
    performance: PerformanceConfig = field(default_factory=PerformanceConfig)
    logging: LoggingConfig = field(default_factory=LoggingConfig)

    @classmethod
    def for_theater_play(
        cls,
        character_names: Optional[List[str]] = None,
        dpi: int = 200,
        use_gpu: bool = False,
    ) -> "OCRConfig":
        """
        Profil précalibré pour pièces de théâtre scannées.

        Active : CLAHE, deskew, sharpen (léger).
        Désactive : denoise (lent, inutile pour PP-OCRv6),
                    binarisation adaptive (nuit à PP-OCRv6 qui préfère niveaux de gris).
        DPI 200 : suffisant pour PP-OCRv6 PP-OCRv6 (vs 300 = 2x plus lent sans gain).

        :param character_names: liste des noms de personnages connus
        :param dpi: résolution de rendu (300 = bon compromis qualité/vitesse)
        :param use_gpu: True si GPU PaddlePaddle disponible
        """
        cfg = cls()

        # Prétraitement léger : PaddleOCR PP-OCRv6 travaille mieux sur images
        # en niveaux de gris (pas binarisées). Seules corrections géométriques
        # (deskew) et de contraste (clahe, sharpen) sont bénéfiques.
        cfg.preprocessing.deskew = True
        cfg.preprocessing.clahe = True
        cfg.preprocessing.denoise = False           # Lent (NLM) et inutile pour PP-OCRv6
        cfg.preprocessing.adaptive_binarization = False  # Nuit à PP-OCRv6 (préfère gris)
        cfg.preprocessing.sharpen = True
        cfg.preprocessing.remove_small_spots = False  # Inutile sans binarisation

        # Moteur OCR précis
        # Désactivé : l'orientation est déjà gérée par le deskew OpenCV, 
        # ce qui fait gagner ~30% de temps de traitement OCR !
        cfg.engine.use_textline_orientation = False
        cfg.engine.text_det_unclip_ratio = 1.8
        cfg.engine.use_gpu = use_gpu
        cfg.engine.device = "gpu" if use_gpu else "cpu"

        # Correction contextuelle
        cfg.correction.enable = True
        if character_names:
            cfg.correction.character_names = [n.upper() for n in character_names]

        # Structure
        cfg.layout.enable = True

        # Performance : 200 DPI suffisant pour PP-OCRv6 sur scans de théâtre
        cfg.performance.dpi = dpi
        cfg.performance.enable_cache = True

        return cfg
