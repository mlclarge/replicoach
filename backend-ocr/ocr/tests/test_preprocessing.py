"""
Tests unitaires — preprocessing.py

Stratégie : fonctions pures (image → image), donc testables sans OCR.
On vérifie les propriétés de l'image résultante plutôt que les valeurs pixel.
"""

import unittest

import cv2
import numpy as np

import sys
from pathlib import Path

# Permet l'import depuis le répertoire parent
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from ocr.preprocessing import (
    PreprocessingPipeline,
    adaptive_binarize,
    apply_clahe,
    denoise,
    deskew,
    remove_margins,
    remove_small_spots,
    sharpen,
    to_grayscale,
)
from ocr.config import PreprocessingConfig
from ocr.exceptions import PreprocessingError


def _make_gray(h: int = 200, w: int = 300, val: int = 180) -> np.ndarray:
    """Image grise uniforme pour les tests."""
    return np.full((h, w), val, dtype=np.uint8)


def _make_text_image() -> np.ndarray:
    """Image simulant une page avec texte (fond blanc, texte noir)."""
    img = np.full((300, 400), 240, dtype=np.uint8)
    cv2.putText(img, "JACQUES", (50, 80), cv2.FONT_HERSHEY_SIMPLEX, 1.5, 0, 3)
    cv2.putText(img, "Bonjour monde", (50, 160), cv2.FONT_HERSHEY_SIMPLEX, 0.9, 50, 2)
    return img


class TestToGrayscale(unittest.TestCase):

    def test_bgr_to_gray(self):
        bgr = np.zeros((10, 10, 3), dtype=np.uint8)
        result = to_grayscale(bgr)
        self.assertEqual(result.ndim, 2)

    def test_already_gray_unchanged(self):
        gray = _make_gray()
        result = to_grayscale(gray)
        self.assertEqual(result.shape, gray.shape)
        np.testing.assert_array_equal(result, gray)

    def test_bgra_to_gray(self):
        bgra = np.zeros((10, 10, 4), dtype=np.uint8)
        result = to_grayscale(bgra)
        self.assertEqual(result.ndim, 2)

    def test_unsupported_raises(self):
        img = np.zeros((10, 10, 2), dtype=np.uint8)
        with self.assertRaises(PreprocessingError):
            to_grayscale(img)


class TestApplyCLAHE(unittest.TestCase):

    def test_output_same_shape(self):
        img = _make_gray()
        result = apply_clahe(img)
        self.assertEqual(result.shape, img.shape)
        self.assertEqual(result.dtype, np.uint8)

    def test_requires_grayscale(self):
        bgr = np.zeros((10, 10, 3), dtype=np.uint8)
        with self.assertRaises(PreprocessingError):
            apply_clahe(bgr)

    def test_increases_std_on_low_contrast(self):
        """CLAHE doit augmenter l'écart-type sur une image à faible contraste."""
        low_contrast = np.full((100, 100), 128, dtype=np.uint8)
        # Ajouter un gradient très léger
        for i in range(100):
            low_contrast[i, :] = 120 + (i * 5 // 100)
        result = apply_clahe(low_contrast, clip_limit=3.0)
        self.assertGreaterEqual(result.std(), low_contrast.std())


class TestDenoise(unittest.TestCase):

    def test_output_same_shape(self):
        img = _make_text_image()
        result = denoise(img)
        self.assertEqual(result.shape, img.shape)
        self.assertEqual(result.dtype, np.uint8)

    def test_requires_grayscale(self):
        bgr = np.zeros((10, 10, 3), dtype=np.uint8)
        with self.assertRaises(PreprocessingError):
            denoise(bgr)


class TestDeskew(unittest.TestCase):

    def test_zero_angle_no_change(self):
        """Une image droite doit retourner angle ≈ 0."""
        img = _make_text_image()
        _, angle = deskew(img, max_angle=5.0)
        self.assertAlmostEqual(angle, 0.0, delta=0.5)

    def test_output_same_size(self):
        img = _make_text_image()
        corrected, _ = deskew(img)
        self.assertEqual(corrected.shape, img.shape)

    def test_requires_grayscale(self):
        bgr = np.zeros((50, 50, 3), dtype=np.uint8)
        with self.assertRaises(PreprocessingError):
            deskew(bgr)

    def test_rotated_image_corrected(self):
        """Un texte incliné doit être redressé (angle non nul détecté)."""
        img = _make_text_image()
        # Appliquer une rotation de 3°
        h, w = img.shape
        M = cv2.getRotationMatrix2D((w / 2, h / 2), 3.0, 1.0)
        rotated = cv2.warpAffine(img, M, (w, h), borderValue=255)
        _, detected_angle = deskew(rotated, max_angle=5.0)
        # On accepte ±2° d'imprécision
        self.assertAlmostEqual(abs(detected_angle), 3.0, delta=2.0)


class TestAdaptiveBinarize(unittest.TestCase):

    def test_output_is_binary(self):
        img = _make_text_image()
        result = adaptive_binarize(img)
        unique_vals = np.unique(result)
        self.assertTrue(set(unique_vals).issubset({0, 255}))

    def test_output_same_shape(self):
        img = _make_gray()
        result = adaptive_binarize(img)
        self.assertEqual(result.shape, img.shape)

    def test_block_size_forced_odd(self):
        """block_size pair doit être converti en impair sans erreur."""
        img = _make_text_image()
        result = adaptive_binarize(img, block_size=34)  # pair → forcé à 35
        self.assertEqual(result.shape, img.shape)

    def test_requires_grayscale(self):
        bgr = np.zeros((50, 50, 3), dtype=np.uint8)
        with self.assertRaises(PreprocessingError):
            adaptive_binarize(bgr)


class TestSharpen(unittest.TestCase):

    def test_output_same_shape_dtype(self):
        img = _make_text_image()
        result = sharpen(img)
        self.assertEqual(result.shape, img.shape)
        self.assertEqual(result.dtype, np.uint8)

    def test_values_clipped(self):
        img = _make_gray(val=200)
        result = sharpen(img, strength=5.0)
        self.assertLessEqual(result.max(), 255)
        self.assertGreaterEqual(result.min(), 0)

    def test_requires_grayscale(self):
        bgr = np.zeros((50, 50, 3), dtype=np.uint8)
        with self.assertRaises(PreprocessingError):
            sharpen(bgr)


class TestRemoveSmallSpots(unittest.TestCase):

    def test_isolated_pixel_removed(self):
        """Un pixel noir isolé sur fond blanc doit disparaître."""
        img = np.full((50, 50), 255, dtype=np.uint8)
        img[25, 25] = 0  # pixel noir isolé (taille 1 px²)
        result = remove_small_spots(img, min_area=10)
        # Après suppression, doit être entièrement blanc
        self.assertEqual(result[25, 25], 255)

    def test_large_region_kept(self):
        """Un grand rectangle noir doit être conservé."""
        img = np.full((100, 100), 255, dtype=np.uint8)
        img[20:60, 20:80] = 0  # grand rectangle noir
        result = remove_small_spots(img, min_area=10)
        # La région doit toujours être présente
        self.assertEqual(result[40, 50], 0)

    def test_requires_grayscale(self):
        bgr = np.zeros((50, 50, 3), dtype=np.uint8)
        with self.assertRaises(PreprocessingError):
            remove_small_spots(bgr)


class TestRemoveMargins(unittest.TestCase):

    def test_crops_surrounding_white(self):
        """L'image recadrée doit être plus petite que l'originale avec marges."""
        img = np.full((200, 300), 255, dtype=np.uint8)
        # Texte au centre
        cv2.rectangle(img, (100, 80), (200, 120), 0, -1)
        result = remove_margins(img)
        self.assertLessEqual(result.shape[0], img.shape[0])
        self.assertLessEqual(result.shape[1], img.shape[1])

    def test_empty_image_unchanged(self):
        """Image entièrement blanche : retournée telle quelle."""
        img = np.full((100, 100), 255, dtype=np.uint8)
        result = remove_margins(img)
        self.assertEqual(result.shape, img.shape)


class TestPreprocessingPipeline(unittest.TestCase):

    def test_full_pipeline_runs(self):
        """Le pipeline complet doit tourner sans exception sur une image texte."""
        cfg = PreprocessingConfig()
        pipeline = PreprocessingPipeline(cfg)
        img = _make_text_image()
        result = pipeline.process(img)
        self.assertIsNotNone(result.image)
        self.assertEqual(result.image.ndim, 2)
        self.assertGreater(len(result.applied_steps), 0)

    def test_all_disabled(self):
        """Pipeline avec toutes étapes désactivées doit retourner l'image telle quelle."""
        cfg = PreprocessingConfig(
            grayscale=False,
            clahe=False,
            deskew=False,
            correct_perspective=False,
            remove_margins=False,
            denoise=False,
            sharpen=False,
            adaptive_binarization=False,
            remove_small_spots=False,
        )
        pipeline = PreprocessingPipeline(cfg)
        img = _make_gray()
        result = pipeline.process(img)
        self.assertEqual(result.applied_steps, [])
        np.testing.assert_array_equal(result.image, img)

    def test_skew_angle_zero_on_straight_image(self):
        cfg = PreprocessingConfig(deskew=True)
        pipeline = PreprocessingPipeline(cfg)
        img = _make_text_image()
        result = pipeline.process(img)
        self.assertAlmostEqual(result.skew_angle, 0.0, delta=0.5)


if __name__ == "__main__":
    unittest.main(verbosity=2)
