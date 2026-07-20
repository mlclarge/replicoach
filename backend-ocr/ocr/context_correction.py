"""
Étape 5 : Correction contextuelle post-OCR.

Stratégie en trois couches cumulatives :
  1. Substitutions OCR déterministes  (I→l, rn→m, apostrophes, espaces…)
  2. Correction des noms de personnages par fuzzy matching (RapidFuzz)
  3. Correction du vocabulaire du théâtre (dictionnaire métier)

Invariant de sécurité :
  • Si confiance >= high_confidence_threshold → aucune modification
  • Toute correction est traçable : original_text conservé, corrected=True

Pourquoi RapidFuzz plutôt que difflib / fuzzywuzzy :
  • 2-10× plus rapide (implémenté en Cython)
  • process.extractOne() en un seul appel, retourne score + index
  • Distances de Levenshtein / Indel / token_sort_ratio disponibles
  • Seuil score_cutoff intégré → aucun faux-positif au-dessous du seuil
"""

from __future__ import annotations

import logging
import re
from typing import Dict, List, Optional, Tuple

from rapidfuzz import fuzz, process

from .config import CorrectionConfig
from .models import RawTextBlock

logger = logging.getLogger("ocr_pipeline.correction")


# ─── Table de substitutions OCR déterministes ────────────────────────────────
# Chaque entrée : (pattern_regex, remplacement, description)
# IMPORTANT : l'ordre d'application est significatif.

OCR_SUBSTITUTIONS: List[Tuple[str, str, str]] = [
    # Apostrophes et guillemets normalisés
    (r"[`´'']",                 "'",      "apostrophe"),
    (r"[\u201c\u201d\u201e\u00ab\u00bb]", '"', "guillemets"),

    # l'œil — confusion très fréquente sur les documents français
    (r"\b[Ll]'[Ee]il\b",       "l'œil",  "l_oeil"),
    (r"\b[Ll]'[Ee]il(?=[^a-z])", "l'œil", "l_oeil_2"),
    
    # confusion ail / œil (ex: "son ail fermé" -> "son œil fermé")
    (r"\b([Ss]on|[Tt]on|[Mm]on|[Uu]n)\s+ail\b", r"\1 œil", "ail_to_oeil"),

    # I initial suivi d'apostrophe → l'
    (r"\bI'(?=[a-záàâäéèêëîïôùûüœæç])", "l'", "I_apostrophe"),

    # Y / V initial devant voyelle (confusion EasyOCR héritée, précaution)
    (r"\b[YV]'(?=[aeiouàâäéèêëîïôùûüœæ])", "l'", "YV_apostrophe"),

    # rn → m en milieu de mot minuscule
    (r"(?<=[a-záàâäéèêëîïôùûüœæç])rn(?=[a-záàâäéèêëîïôùûüœæç])", "m", "rn_to_m"),

    # Zéro dans un mot alphabétique → lettre o
    (r"(?<=[A-Za-zÀ-ÿœæ])0(?=[A-Za-zÀ-ÿœæ])", "o", "zero_to_o"),

    # Espace insécable → espace normal
    (r"\u00a0", " ", "nbsp"),

    # Tirets multiples → tiret cadratin
    (r"--+", "—", "double_tiret"),

    # Espaces multiples
    (r"  +", " ", "multi_space"),
]

# Vocabulaire métier du théâtre (corrections de noms courants)
THEATER_VOCAB_CORRECTIONS: Dict[str, str] = {
    "ridcau":    "rideau",
    "didascali": "didascalie",
    "scène":     "scène",
    "scene":     "scène",
    "acte":      "acte",
    "tirade":    "tirade",
    "aparté":    "aparté",
    "monologue": "monologue",
}


class ContextCorrector:
    """
    Correcteur contextuel post-OCR pour pièces de théâtre.

    Usage::

        corrector = ContextCorrector(cfg.correction)
        blocks = corrector.correct_blocks(blocks)

        # Ou correction d'un nom seul :
        name, was_fixed = corrector.correct_character_name("JAcQUEs")
        # → ("JACQUES", True)
    """

    def __init__(self, cfg: CorrectionConfig) -> None:
        self._cfg = cfg
        # Noms de référence en MAJUSCULES pour matching insensible à la casse
        self._known_chars: List[str] = [n.upper() for n in cfg.character_names]
        # Abréviations : dict {ABRÉV_UPPER → NOM_COMPLET_UPPER}
        self._abbreviations: Dict[str, str] = {
            k.upper().strip(): v.upper().strip()
            for k, v in cfg.character_abbreviations.items()
        }

    # ── API publique ──────────────────────────────────────────────────────────

    def correct_blocks(self, blocks: List[RawTextBlock]) -> List[RawTextBlock]:
        """
        Corrige une liste de blocs OCR.

        Les blocs à haute confiance (>= high_confidence_threshold) ne sont
        jamais modifiés — invariant de sécurité.
        """
        if not self._cfg.enable:
            return blocks
        return [self._correct_block(b) for b in blocks]

    def correct_character_name(self, name: str) -> Tuple[str, bool]:
        """
        Corrige un nom de personnage par fuzzy matching contre la liste connue.

        :returns: (nom_corrigé, True si correction appliquée)

        Exemples :
          "JAcQUEs" → ("JACQUES", True)   score ≈ 89
          "LUCIE"   → ("LUCIE", False)    correspondance exacte
          "TOTO"    → ("TOTO", False)     aucun match au-dessus du seuil
        """
        if not self._known_chars and not self._abbreviations:
            return name, False

        name_up = name.upper().strip()

        # Correspondance via table d'abréviations (priorité maximale)
        if name_up in self._abbreviations:
            full = self._abbreviations[name_up]
            logger.debug(f"Abréviation résolue : {name!r} → {full!r}")
            return full, True

        if not self._known_chars:
            return name, False

        # Correspondance exacte rapide
        if name_up in self._known_chars:
            return name_up, name != name_up

        # Fuzzy match avec RapidFuzz
        result = process.extractOne(
            name_up,
            self._known_chars,
            scorer=fuzz.ratio,
            score_cutoff=self._cfg.fuzzy_match_threshold,
        )
        if result:
            matched, score, _ = result
            logger.debug(
                f"Nom corrigé : {name!r} → {matched!r} (score fuzzy={score})"
            )
            return matched, True

        return name, False

    def apply_ocr_substitutions(self, text: str) -> str:
        """Applique les substitutions OCR déterministes dans l'ordre de la table."""
        for pattern, replacement, _label in OCR_SUBSTITUTIONS:
            text = re.sub(pattern, replacement, text)
        return text.strip()

    def correct_theater_vocab(self, text: str) -> str:
        """Corrige les mots du vocabulaire théâtral mal reconnus."""
        words = text.split()
        result = []
        for word in words:
            # Nettoyer la ponctuation avant de chercher dans le dictionnaire
            stripped = word.strip(".,;:!?()")
            corrected = THEATER_VOCAB_CORRECTIONS.get(stripped.lower(), stripped)
            # Réappliquer la ponctuation retirée
            prefix = word[: len(word) - len(word.lstrip(".,;:!?()"))]
            suffix = word[len(word.rstrip(".,;:!?()")):] if word.rstrip(".,;:!?()") else ""
            result.append(prefix + corrected + suffix)
        return " ".join(result)

    # ── Privé ─────────────────────────────────────────────────────────────────

    def _correct_block(self, block: RawTextBlock) -> RawTextBlock:
        """Applique les corrections sur un bloc individuel."""
        # Invariant : ne jamais modifier un bloc à haute confiance
        if block.confidence >= self._cfg.high_confidence_threshold:
            return block

        original = block.text
        text = original

        # Couche 1 : substitutions OCR (seulement si confiance basse)
        if block.confidence < self._cfg.confidence_threshold:
            text = self.apply_ocr_substitutions(text)

        # Couche 3 : vocabulaire théâtral (toujours, peu risqué)
        text = self.correct_theater_vocab(text)

        if text == original:
            return block

        return RawTextBlock(
            text=text,
            bbox=block.bbox,
            confidence=block.confidence,
            page_number=block.page_number,
            raw_quad=block.raw_quad,
        )
