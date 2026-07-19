"""
Étape 3 : Prétraitement des images par OpenCV.

Pourquoi OpenCV :
• Standard de facto, implémenté en C++ → très rapide sur CPU
• CLAHE, seuillage adaptatif, morphologie, rotation — tous natifs
• Interface NumPy directe, zéro copie inutile

Architecture :
• Fonctions atomiques et pures : (image → image)
• PreprocessingResult : image + journal des étapes appliquées
• PreprocessingPipeline : orchestre selon PreprocessingConfig

Ordre d'application fixe et justifié :
  1. grayscale       — simplification, moins de bruit chromatique
  2. clahe           — contraste local avant corrections géométriques
  3. deskew          — alignement avant débruitage (bruit amplifié par rotation)
  4. perspective     — correction de déformation (optionnel)
  5. remove_margins  — suppression des bordures noires de scan
  6. denoise         — NLM : préserve les contours du texte
  7. sharpen         — unsharp mask pour clarté des lettres
  8. binarize        — seuillage adaptatif : image binaire pour l'OCR
  9. remove_spots    — nettoyage des artefacts post-binarisation
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import List, Optional, Tuple

import cv2
import numpy as np

from .config import PreprocessingConfig
from .exceptions import PreprocessingError

logger = logging.getLogger("ocr_pipeline.preprocessing")


# ─── Fonctions atomiques ──────────────────────────────────────────────────────


def to_grayscale(image: np.ndarray) -> np.ndarray:
    """Convertit BGR / BGRA / RGB en niveaux de gris. Idempotent."""
    if image.ndim == 2:
        return image
    n_channels = image.shape[2]
    if n_channels == 3:
        return cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    if n_channels == 4:
        return cv2.cvtColor(image, cv2.COLOR_BGRA2GRAY)
    raise PreprocessingError(f"Format d'image non supporté : shape={image.shape}")


def apply_clahe(
    image: np.ndarray,
    clip_limit: float = 2.0,
    tile_grid_size: Tuple[int, int] = (8, 8),
) -> np.ndarray:
    """
    CLAHE (Contrast Limited Adaptive Histogram Equalization).

    Améliore le contraste localement sans sur-exposer les zones déjà nettes.
    Particulièrement efficace sur les pages jaunies ou à éclairage inégal.

    Pourquoi CLAHE plutôt que equalizeHist :
    • equalizeHist est global → sur-contraste sur zones déjà contrastées
    • CLAHE divise en tuiles et limite le gain → résultat plus homogène
    """
    if image.ndim != 2:
        raise PreprocessingError("CLAHE requiert une image en niveaux de gris")
    clahe = cv2.createCLAHE(clipLimit=clip_limit, tileGridSize=tile_grid_size)
    return clahe.apply(image)


def denoise(
    image: np.ndarray,
    h: int = 10,
    template_window: int = 7,
    search_window: int = 21,
) -> np.ndarray:
    """
    Débruitage Non-Local Means (NLM).

    Pourquoi NLM plutôt que GaussianBlur :
    • Préserve les contours et les bords des lettres
    • Efficace sur le bruit granulaire des photocopies et scans anciens
    • h=10 : bon compromis entre débruitage et préservation du texte
    """
    if image.ndim != 2:
        raise PreprocessingError("denoise requiert une image en niveaux de gris")
    return cv2.fastNlMeansDenoising(
        image,
        None,
        h=h,
        templateWindowSize=template_window,
        searchWindowSize=search_window,
    )


def deskew(
    image: np.ndarray,
    max_angle: float = 5.0,
) -> Tuple[np.ndarray, float]:
    """
    Corrige l'inclinaison par méthode des profils de projection.

    Algorithme :
    1. Binarisation Otsu (texte blanc sur fond noir)
    2. Pour chaque angle candidat dans [-max_angle, +max_angle] par pas de 0.5°
       → rotation rapide de l'image binaire (INTER_NEAREST)
       → calcul de la variance des sommes de lignes
    3. L'angle maximisant la variance = lignes de texte les plus nettes
    4. Correction finale avec interpolation cubique (qualité)

    Pourquoi profils de projection plutôt que Hough :
    • Hough est sensible au bruit et aux lignes verticales (encadrements)
    • Profils de projection fonctionne même si peu de lignes horizontales
    • Plus précis pour les angles faibles (< 5°) typiques des scans

    :returns: (image_corrigée, angle_détecté_en_degrés)
    """
    if image.ndim != 2:
        raise PreprocessingError("deskew requiert une image en niveaux de gris")

    _, binary = cv2.threshold(image, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

    h, w = binary.shape
    cx, cy = w / 2.0, h / 2.0

    best_angle = 0.0
    best_score = -1.0

    # Pré-calculer les matrices de rotation (optimisation)
    angles = np.arange(-max_angle, max_angle + 0.01, 0.5)
    for angle in angles:
        angle = float(angle)
        M = cv2.getRotationMatrix2D((cx, cy), angle, 1.0)
        rot = cv2.warpAffine(
            binary, M, (w, h),
            flags=cv2.INTER_NEAREST,
            borderMode=cv2.BORDER_CONSTANT,
            borderValue=0,
        )
        row_sums = rot.sum(axis=1).astype(np.float64)
        score = float(np.var(row_sums))
        if score > best_score:
            best_score = score
            best_angle = angle

    if abs(best_angle) < 0.3:
        return image, 0.0

    M_final = cv2.getRotationMatrix2D((cx, cy), best_angle, 1.0)
    corrected = cv2.warpAffine(
        image, M_final, (w, h),
        flags=cv2.INTER_CUBIC,
        borderMode=cv2.BORDER_CONSTANT,
        borderValue=255,
    )
    logger.debug(f"Deskew : angle détecté = {best_angle:+.1f}°")
    return corrected, best_angle


def correct_perspective(image: np.ndarray) -> np.ndarray:
    """
    Correction de perspective par détection du quadrilatère de page.

    Utile si la page a été photographiée en angle (téléphone, scanner penché).
    Désactivé par défaut car risqué sur les scans sans bords nets.

    Algorithme : détection de contours → plus grand quadrilatère → homographie.
    Retourne l'image inchangée si aucun quadrilatère net n'est détecté.
    """
    gray = image if image.ndim == 2 else cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blurred, 50, 150)

    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return image

    largest = max(contours, key=cv2.contourArea)
    peri = cv2.arcLength(largest, True)
    approx = cv2.approxPolyDP(largest, 0.02 * peri, True)

    if len(approx) != 4:
        return image  # Pas de quadrilatère net

    pts_src = _order_points(approx.reshape(4, 2).astype(np.float32))
    img_h, img_w = image.shape[:2]
    pts_dst = np.array(
        [[0, 0], [img_w - 1, 0], [img_w - 1, img_h - 1], [0, img_h - 1]],
        dtype=np.float32,
    )
    M = cv2.getPerspectiveTransform(pts_src, pts_dst)
    return cv2.warpPerspective(image, M, (img_w, img_h))


def remove_margins(image: np.ndarray, margin_pct: float = 0.02) -> np.ndarray:
    """
    Recadre en supprimant les bandes noires ou blanches de marge de scan.

    Algorithme :
    • Binarisation Otsu inversée → texte en blanc
    • findNonZero → coordonnées du contenu
    • boundingRect → boîte englobante du texte + marge de sécurité

    Retourne l'image inchangée si aucun contenu n'est trouvé.
    """
    if image.ndim != 2:
        raise PreprocessingError("remove_margins requiert une image en niveaux de gris")

    _, binary = cv2.threshold(image, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    coords = cv2.findNonZero(binary)
    if coords is None:
        return image

    x, y, bw, bh = cv2.boundingRect(coords)
    img_h, img_w = image.shape
    margin = int(min(img_h, img_w) * margin_pct)

    x1 = max(0, x - margin)
    y1 = max(0, y - margin)
    x2 = min(img_w, x + bw + margin)
    y2 = min(img_h, y + bh + margin)

    return image[y1:y2, x1:x2]


def adaptive_binarize(
    image: np.ndarray,
    block_size: int = 35,
    c: int = 10,
) -> np.ndarray:
    """
    Binarisation adaptative gaussienne.

    Pourquoi adaptative plutôt que globale (Otsu) :
    • Otsu calcule un seuil unique → échoue sur pages à éclairage inégal
    • Seuillage adaptatif calcule un seuil local par région
    • block_size=35 : adapté au texte 10-14pt à 300 dpi
    • c=10 : valeur empirique pour pages légèrement grises

    :param block_size: taille du voisinage (doit être impair)
    :param c: constante soustraite du seuil calculé
    """
    if image.ndim != 2:
        raise PreprocessingError("adaptive_binarize requiert une image en niveaux de gris")
    bs = block_size if block_size % 2 == 1 else block_size + 1
    return cv2.adaptiveThreshold(
        image, 255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        bs, c,
    )


def sharpen(image: np.ndarray, strength: float = 1.5) -> np.ndarray:
    """
    Amélioration de la netteté par filtre unsharp mask.

    Formule : sharpened = (1 + s) × original - s × gaussien
    Améliore la lisibilité des lettres légèrement floues (scans < 400dpi).
    """
    if image.ndim != 2:
        raise PreprocessingError("sharpen requiert une image en niveaux de gris")
    blurred = cv2.GaussianBlur(image, (0, 0), 3)
    sharpened = cv2.addWeighted(image, 1.0 + strength, blurred, -strength, 0)
    return np.clip(sharpened, 0, 255).astype(np.uint8)


def remove_small_spots(image: np.ndarray, min_area: int = 30) -> np.ndarray:
    """
    Supprime les petites taches résiduelles après binarisation.

    Utilise l'analyse de composants connexes (connected components) :
    • Chaque région blanche (texte) est étiquetée
    • Les composants d'aire < min_area px² sont supprimés
    • Les composants plus grands (lettres) sont conservés

    :param min_area: aire minimale en pixels² pour conserver un composant
    """
    if image.ndim != 2:
        raise PreprocessingError("remove_small_spots requiert une image en niveaux de gris")

    inv = cv2.bitwise_not(image)  # texte en blanc
    num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(inv, connectivity=8)

    mask = np.zeros_like(inv)
    for i in range(1, num_labels):  # 0 = fond
        if stats[i, cv2.CC_STAT_AREA] >= min_area:
            mask[labels == i] = 255

    return cv2.bitwise_not(mask)


# ─── Pipeline ─────────────────────────────────────────────────────────────────


@dataclass
class PreprocessingResult:
    """Résultat du prétraitement avec journal des étapes appliquées."""

    image: np.ndarray
    applied_steps: List[str] = field(default_factory=list)
    skew_angle: float = 0.0                # angle corrigé, 0 si non appliqué


class PreprocessingPipeline:
    """
    Orchestre le prétraitement image selon la configuration.

    Chaque étape est optionnelle et indépendante.
    L'ordre est fixe et optimisé pour la qualité OCR sur documents anciens.

    Usage::

        pipeline = PreprocessingPipeline(cfg.preprocessing)
        result = pipeline.process(image)
        ocr_engine.recognize(result.image)
    """

    def __init__(self, cfg: PreprocessingConfig) -> None:
        self._cfg = cfg

    def process(self, image: np.ndarray) -> PreprocessingResult:
        """
        Applique le pipeline complet sur une image NumPy.

        :param image: H×W (gray) ou H×W×3 (BGR) uint8
        :returns: PreprocessingResult avec image traitée et log des étapes
        :raises PreprocessingError: si une étape échoue
        """
        result = PreprocessingResult(image=image.copy())
        cfg = self._cfg

        try:
            if cfg.grayscale:
                result.image = to_grayscale(result.image)
                result.applied_steps.append("grayscale")

            if cfg.clahe and result.image.ndim == 2:
                result.image = apply_clahe(
                    result.image,
                    clip_limit=cfg.clahe_clip_limit,
                    tile_grid_size=cfg.clahe_tile_grid_size,
                )
                result.applied_steps.append("clahe")

            if cfg.deskew and result.image.ndim == 2:
                result.image, result.skew_angle = deskew(result.image)
                if abs(result.skew_angle) >= 0.3:
                    result.applied_steps.append(f"deskew({result.skew_angle:+.1f}°)")

            if cfg.correct_perspective:
                result.image = correct_perspective(result.image)
                result.applied_steps.append("perspective")

            if cfg.remove_margins and result.image.ndim == 2:
                result.image = remove_margins(result.image)
                result.applied_steps.append("remove_margins")

            if cfg.denoise and result.image.ndim == 2:
                result.image = denoise(
                    result.image,
                    h=cfg.denoise_h,
                    template_window=cfg.denoise_template_window,
                    search_window=cfg.denoise_search_window,
                )
                result.applied_steps.append("denoise")

            if cfg.sharpen and result.image.ndim == 2:
                result.image = sharpen(result.image, strength=cfg.sharpen_strength)
                result.applied_steps.append("sharpen")

            if cfg.adaptive_binarization and result.image.ndim == 2:
                result.image = adaptive_binarize(
                    result.image,
                    block_size=cfg.binarization_block_size,
                    c=cfg.binarization_c,
                )
                result.applied_steps.append("binarize")

            if cfg.remove_small_spots and result.image.ndim == 2:
                result.image = remove_small_spots(
                    result.image, min_area=cfg.min_spot_area
                )
                result.applied_steps.append("remove_spots")

        except PreprocessingError:
            raise
        except Exception as exc:
            raise PreprocessingError(
                f"Erreur inattendue de prétraitement : {exc}"
            ) from exc

        logger.debug(
            "Prétraitement : %s",
            ", ".join(result.applied_steps) if result.applied_steps else "aucun",
        )
        return result


# ─── Helpers privés ───────────────────────────────────────────────────────────


def _order_points(pts: np.ndarray) -> np.ndarray:
    """Ordonne 4 points dans l'ordre (tl, tr, br, bl)."""
    rect = np.zeros((4, 2), dtype=np.float32)
    s = pts.sum(axis=1)
    rect[0] = pts[np.argmin(s)]   # tl : somme minimale
    rect[2] = pts[np.argmax(s)]   # br : somme maximale
    diff = np.diff(pts, axis=1)
    rect[1] = pts[np.argmin(diff)]  # tr
    rect[3] = pts[np.argmax(diff)]  # bl
    return rect
