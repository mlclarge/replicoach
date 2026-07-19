"""
Tests unitaires — context_correction.py

Aucune dépendance PaddleOCR requise pour ces tests.
"""

import unittest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from ocr.context_correction import ContextCorrector, OCR_SUBSTITUTIONS
from ocr.config import CorrectionConfig
from ocr.models import BoundingBox, RawTextBlock


def _block(text: str, conf: float = 0.6) -> RawTextBlock:
    """Crée un RawTextBlock de test."""
    return RawTextBlock(
        text=text,
        bbox=BoundingBox(0, 0, 100, 20),
        confidence=conf,
        page_number=1,
    )


class TestOCRSubstitutions(unittest.TestCase):
    """Teste chaque règle de substitution individuellement."""

    def setUp(self):
        cfg = CorrectionConfig(enable=True, confidence_threshold=0.9)
        self.corrector = ContextCorrector(cfg)

    def test_apostrophe_normalization(self):
        self.assertEqual(self.corrector.apply_ocr_substitutions("l`eau"), "l'eau")
        self.assertEqual(self.corrector.apply_ocr_substitutions("c'est"), "c'est")

    def test_l_oeil_correction(self):
        result = self.corrector.apply_ocr_substitutions("dans l'eil")
        self.assertIn("l'œil", result)

    def test_I_apostrophe(self):
        result = self.corrector.apply_ocr_substitutions("I'aime")
        self.assertEqual(result, "l'aime")

    def test_rn_to_m(self):
        result = self.corrector.apply_ocr_substitutions("fernrne")
        self.assertIn("m", result)

    def test_zero_in_word(self):
        result = self.corrector.apply_ocr_substitutions("b0njour")
        self.assertEqual(result, "bonjour")

    def test_nbsp_normalized(self):
        result = self.corrector.apply_ocr_substitutions("a\u00a0b")
        self.assertEqual(result, "a b")

    def test_multi_space(self):
        result = self.corrector.apply_ocr_substitutions("un   deux")
        self.assertEqual(result, "un deux")


class TestCharacterNameCorrection(unittest.TestCase):

    def setUp(self):
        cfg = CorrectionConfig(
            character_names=["JACQUES", "LUCIE", "CORINNE", "JEAN", "MICHEL"],
            fuzzy_match_threshold=75,
        )
        self.corrector = ContextCorrector(cfg)

    def test_exact_match(self):
        name, corrected = self.corrector.correct_character_name("JACQUES")
        self.assertEqual(name, "JACQUES")
        self.assertFalse(corrected)

    def test_partial_caps(self):
        """JAcQUEs doit être reconnu comme JACQUES."""
        name, corrected = self.corrector.correct_character_name("JAcQUEs")
        self.assertEqual(name, "JACQUES")
        self.assertTrue(corrected)

    def test_one_char_error(self):
        """JACQUCS (typo) doit être corrigé en JACQUES."""
        name, corrected = self.corrector.correct_character_name("JACQUCS")
        self.assertEqual(name, "JACQUES")
        self.assertTrue(corrected)

    def test_no_match_returns_original(self):
        """Un nom totalement différent ne doit pas être corrigé."""
        name, corrected = self.corrector.correct_character_name("TOTO")
        self.assertEqual(name, "TOTO")
        self.assertFalse(corrected)

    def test_empty_known_list(self):
        cfg = CorrectionConfig(character_names=[])
        corrector = ContextCorrector(cfg)
        name, corrected = corrector.correct_character_name("JACQUES")
        self.assertEqual(name, "JACQUES")
        self.assertFalse(corrected)

    def test_lucie_exact(self):
        name, _ = self.corrector.correct_character_name("lucie")
        self.assertEqual(name, "LUCIE")

    def test_corinne_with_accent_noise(self):
        """CORINNC → CORINNE (1 char différent)."""
        name, corrected = self.corrector.correct_character_name("CORINNC")
        self.assertEqual(name, "CORINNE")
        self.assertTrue(corrected)


class TestCorrectBlocks(unittest.TestCase):

    def setUp(self):
        cfg = CorrectionConfig(
            enable=True,
            confidence_threshold=0.5,
            high_confidence_threshold=0.95,
        )
        self.corrector = ContextCorrector(cfg)

    def test_high_confidence_not_modified(self):
        """Un bloc à haute confiance ne doit jamais être modifié."""
        block = _block("I'ai faim", conf=0.98)
        result = self.corrector.correct_blocks([block])[0]
        self.assertEqual(result.text, "I'ai faim")  # invariant : non modifié

    def test_low_confidence_corrected(self):
        """Un bloc à faible confiance doit subir les corrections."""
        block = _block("I'aime le riz", conf=0.3)
        result = self.corrector.correct_blocks([block])[0]
        self.assertEqual(result.text, "l'aime le riz")

    def test_disabled_no_correction(self):
        cfg = CorrectionConfig(enable=False)
        corrector = ContextCorrector(cfg)
        block = _block("I'aime", conf=0.3)
        result = corrector.correct_blocks([block])[0]
        self.assertEqual(result.text, "I'aime")

    def test_medium_confidence_vocab_corrected(self):
        """Le vocabulaire est corrigé même à confiance moyenne."""
        block = _block("C'est une scene importante", conf=0.7)
        result = self.corrector.correct_blocks([block])[0]
        # "scene" → "scène"
        self.assertIn("scène", result.text)


class TestTheaterVocab(unittest.TestCase):

    def setUp(self):
        cfg = CorrectionConfig(enable=True)
        self.corrector = ContextCorrector(cfg)

    def test_scene_correction(self):
        result = self.corrector.correct_theater_vocab("La scene commence")
        self.assertIn("scène", result)

    def test_rideau_correction(self):
        result = self.corrector.correct_theater_vocab("ridcau final")
        self.assertIn("rideau", result)

    def test_normal_word_unchanged(self):
        result = self.corrector.correct_theater_vocab("bonjour monde")
        self.assertEqual(result, "bonjour monde")


if __name__ == "__main__":
    unittest.main(verbosity=2)
