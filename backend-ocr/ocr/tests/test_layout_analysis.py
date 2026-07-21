"""
Tests unitaires — layout_analysis.py

Simule des résultats OCR bruts sans faire appel à PaddleOCR.
"""

import unittest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from ocr.layout_analysis import LayoutAnalyzer, LineClassifier, LineReconstructor, _extract_number
from ocr.config import CorrectionConfig, LayoutConfig
from ocr.models import BoundingBox, ElementType, PageRawResult, RawTextBlock, TextLine


# ─── Helpers ──────────────────────────────────────────────────────────────────


def _block(text: str, x1: float, y1: float, x2: float = None, y2: float = None,
           conf: float = 0.85, page: int = 1) -> RawTextBlock:
    x2 = x2 or x1 + len(text) * 10
    y2 = y2 or y1 + 20
    return RawTextBlock(
        text=text,
        bbox=BoundingBox(x1, y1, x2, y2),
        confidence=conf,
        page_number=page,
    )


def _page(blocks: list, page_num: int = 1, h: int = 3000) -> PageRawResult:
    return PageRawResult(
        page_number=page_num,
        width=2400,
        height=h,
        rotation_detected=0.0,
        blocks=blocks,
        processing_time_ms=100.0,
        preprocessing_applied=["grayscale", "clahe"],
    )


# ─── Tests LineReconstructor ──────────────────────────────────────────────────


class TestLineReconstructor(unittest.TestCase):

    def setUp(self):
        cfg = LayoutConfig(line_merge_y_tolerance=0.012)
        self.rec = LineReconstructor(cfg)

    def test_same_y_grouped(self):
        """Deux blocs à la même hauteur → une seule ligne."""
        blocks = [
            _block("JACQUES", 50, 100),
            _block("(gémissant)", 200, 100),
        ]
        lines = self.rec.reconstruct(blocks, page_height=3000)
        self.assertEqual(len(lines), 1)
        self.assertIn("JACQUES", lines[0].text)
        self.assertIn("(gémissant)", lines[0].text)

    def test_different_y_separate_lines(self):
        """Deux blocs à des hauteurs très différentes → deux lignes."""
        blocks = [
            _block("LUCIE", 50, 100),
            _block("Bonjour monde", 50, 300),
        ]
        lines = self.rec.reconstruct(blocks, page_height=3000)
        self.assertEqual(len(lines), 2)

    def test_blocks_sorted_by_x_within_line(self):
        """Les blocs dans une ligne doivent être triés gauche→droite."""
        blocks = [
            _block("monde", 200, 100),
            _block("Bonjour", 50, 100),
        ]
        lines = self.rec.reconstruct(blocks, page_height=3000)
        self.assertEqual(len(lines), 1)
        self.assertTrue(lines[0].text.startswith("Bonjour"))

    def test_empty_input(self):
        lines = self.rec.reconstruct([], page_height=3000)
        self.assertEqual(lines, [])

    def test_three_lines(self):
        blocks = [
            _block("NOM1", 50, 100),
            _block("texte1", 50, 150),
            _block("NOM2", 50, 250),
        ]
        lines = self.rec.reconstruct(blocks, page_height=3000)
        self.assertEqual(len(lines), 3)


# ─── Tests LineClassifier ─────────────────────────────────────────────────────


class TestLineClassifier(unittest.TestCase):

    def _make_line(self, text: str, y: float = 100.0) -> TextLine:
        block = _block(text, 50, y)
        return TextLine(blocks=[block], page_number=1)

    def setUp(self):
        from ocr.context_correction import ContextCorrector
        cfg = LayoutConfig()
        corr_cfg = CorrectionConfig(
            character_names=["JACQUES", "LUCIE", "CORINNE"],
            fuzzy_match_threshold=75,
        )
        corrector = ContextCorrector(corr_cfg)
        self.clf = LineClassifier(cfg, corrector)

    def test_character_name(self):
        line = self._make_line("JACQUES")
        t, _, char = self.clf.classify(line)
        self.assertEqual(t, ElementType.CHARACTER)
        self.assertEqual(char, "JACQUES")

    def test_character_with_inline_stage(self):
        """LUCIE (sortant) doit être classifié CHARACTER avec char=LUCIE."""
        line = self._make_line("LUCIE (sortant)")
        t, _, char = self.clf.classify(line)
        self.assertEqual(t, ElementType.CHARACTER)
        self.assertEqual(char, "LUCIE")

    def test_dialogue(self):
        line = self._make_line("Bonjour, comment allez-vous aujourd'hui ?")
        t, _, _ = self.clf.classify(line)
        self.assertEqual(t, ElementType.DIALOGUE)

    def test_stage_direction_full(self):
        line = self._make_line("(Il entre en courant et s'effondre)")
        t, _, _ = self.clf.classify(line)
        self.assertEqual(t, ElementType.STAGE_DIRECTION)

    def test_page_number(self):
        for s in ["12", "- 42 -", " 7 "]:
            line = self._make_line(s)
            t, _, _ = self.clf.classify(line)
            self.assertEqual(t, ElementType.PAGE_NUMBER, f"'{s}' devrait être PAGE_NUMBER")

    def test_act_heading(self):
        for s in ["ACTE I", "Acte II", "ACTE 3"]:
            line = self._make_line(s)
            t, _, _ = self.clf.classify(line)
            self.assertEqual(t, ElementType.ACT_HEADING, f"'{s}' devrait être ACT_HEADING")

    def test_scene_heading(self):
        for s in ["Scène 1", "SCÈNE II", "scène première"]:
            line = self._make_line(s)
            t, _, _ = self.clf.classify(line)
            self.assertEqual(t, ElementType.SCENE_HEADING, f"'{s}' devrait être SCENE_HEADING")

    def test_blank_line(self):
        line = self._make_line("   ")
        t, _, _ = self.clf.classify(line)
        self.assertEqual(t, ElementType.BLANK)

    def test_fuzzy_character_correction(self):
        """JAcQUEs (OCR approximatif) doit être corrigé en JACQUES."""
        line = self._make_line("JAcQUEs")
        t, _, char = self.clf.classify(line)
        self.assertEqual(t, ElementType.CHARACTER)
        self.assertEqual(char, "JACQUES")

    def test_lowercase_dialogue_not_character(self):
        """Un texte en minuscules ne peut pas être un personnage."""
        line = self._make_line("bonjour comment allez-vous")
        t, _, _ = self.clf.classify(line)
        self.assertEqual(t, ElementType.DIALOGUE)


# ─── Tests LayoutAnalyzer ─────────────────────────────────────────────────────


class TestLayoutAnalyzer(unittest.TestCase):

    def _make_analyzer(self, characters=None):
        layout_cfg = LayoutConfig()
        corr_cfg = CorrectionConfig(
            character_names=characters or ["JACQUES", "LUCIE"],
        )
        return LayoutAnalyzer(layout_cfg, corr_cfg)

    def test_simple_dialogue_structure(self):
        """Une séquence simple : personnage → réplique → personnage → réplique."""
        blocks = [
            _block("JACQUES", 50, 100),
            _block("Bonjour Lucie.", 50, 140),
            _block("LUCIE", 50, 250),
            _block("Bonjour Jacques.", 50, 290),
        ]
        page = _page(blocks)
        analyzer = self._make_analyzer()
        script = analyzer.build_script([page], title="Test")

        # Vérifier qu'il y a bien 2 personnages
        self.assertIn("JACQUES", script.characters)
        self.assertIn("LUCIE", script.characters)

        # Vérifier que les répliques ont le bon character associé
        elems = script.all_elements
        dialogues = [e for e in elems if e.element_type == ElementType.DIALOGUE]
        self.assertEqual(dialogues[0].character, "JACQUES")
        self.assertEqual(dialogues[1].character, "LUCIE")

    def test_act_scene_structure(self):
        """Les actes et scènes doivent créer l'arborescence correcte."""
        blocks = [
            _block("ACTE I", 50, 50),
            _block("Scène 1", 50, 100),
            _block("JACQUES", 50, 200),
            _block("Premier acte.", 50, 240),
        ]
        page = _page(blocks)
        analyzer = self._make_analyzer()
        script = analyzer.build_script([page])

        self.assertEqual(len(script.acts), 1)
        self.assertEqual(script.acts[0].number, 1)
        self.assertEqual(len(script.acts[0].scenes), 1)

    def test_dialogue_inherits_last_character(self):
        """Les lignes de dialogue doivent hériter du dernier personnage vu."""
        blocks = [
            _block("LUCIE", 50, 100),
            _block("Première réplique.", 50, 140),
            _block("Suite de la réplique.", 50, 180),
        ]
        page = _page(blocks)
        analyzer = self._make_analyzer()
        script = analyzer.build_script([page])

        dialogues = [
            e for e in script.all_elements
            if e.element_type == ElementType.DIALOGUE
        ]
        for d in dialogues:
            self.assertEqual(d.character, "LUCIE")

    def test_implicit_act_scene_created(self):
        """Si aucun acte/scène explicite, un contexte implicite doit être créé."""
        blocks = [
            _block("JACQUES", 50, 100),
            _block("Texte sans contexte.", 50, 140),
        ]
        page = _page(blocks)
        analyzer = self._make_analyzer()
        script = analyzer.build_script([page])

        # Doit avoir au moins 1 acte et 1 scène
        self.assertGreater(len(script.acts), 0)
        self.assertGreater(len(script.acts[0].scenes), 0)

    def test_stage_direction_no_character(self):
        """Les didascalies ne doivent pas avoir de character assigné."""
        blocks = [
            _block("JACQUES", 50, 100),
            _block("(Il sort en courant)", 50, 180),
        ]
        page = _page(blocks)
        analyzer = self._make_analyzer()
        script = analyzer.build_script([page])

        stage_dirs = [
            e for e in script.all_elements
            if e.element_type == ElementType.STAGE_DIRECTION
        ]
        self.assertTrue(all(e.character is None for e in stage_dirs))


# ─── Tests _extract_number ────────────────────────────────────────────────────


class TestExtractNumber(unittest.TestCase):

    def test_arabic_number(self):
        self.assertEqual(_extract_number("ACTE 3"), 3)
        self.assertEqual(_extract_number("Scène 12"), 12)

    def test_roman_numeral(self):
        self.assertEqual(_extract_number("ACTE II"), 2)
        self.assertEqual(_extract_number("Acte IV"), 4)
        self.assertEqual(_extract_number("Acte VIII"), 8)

    def test_no_number(self):
        self.assertIsNone(_extract_number("Prologue"))

    def test_roman_priority_over_letters(self):
        """'I' seul dans un titre doit être reconnu comme chiffre romain 1."""
        self.assertEqual(_extract_number("ACTE I"), 1)


class TestAdvancedOptimizations(unittest.TestCase):

    def test_split_compound_character(self):
        from ocr.layout_analysis import split_compound_character
        self.assertEqual(split_compound_character("JACQUES ET JEAN"), ["JACQUES", "JEAN"])
        self.assertEqual(split_compound_character("JACQUES, JEAN, MICHEL"), ["JACQUES", "JEAN", "MICHEL"])
        self.assertEqual(split_compound_character("TOUS"), ["TOUS"])
        self.assertEqual(split_compound_character(None), [])

    def test_is_abbreviation(self):
        from ocr.layout_analysis import is_abbreviation
        frequent = ["QUERROCHOT", "LUCIE", "CORINNE"]
        self.assertEqual(is_abbreviation("QQ", frequent), "QUERROCHOT")
        self.assertEqual(is_abbreviation("LU", frequent), "LUCIE")
        self.assertEqual(is_abbreviation("M. Q", frequent), "QUERROCHOT")
        # "CO" commence par 'C'. Comme seule "CORINNE" commence par 'C' dans les fréquents, l'unification est automatique :
        self.assertEqual(is_abbreviation("CO", frequent), "CORINNE")
        # Si par contre plusieurs fréquents commencent par la même lettre (ex: LUCIE et LAURA), alors "LU" reste unique mais "L" ne le serait pas :
        self.assertEqual(is_abbreviation("LU", ["LUCIE", "LAURA"]), "LUCIE")
        self.assertIsNone(is_abbreviation("L", ["LUCIE", "LAURA"]))

    def test_build_script_with_compound_and_typos(self):
        # On va simuler un script qui contient :
        # - Des comédiens fréquents: JACQUES (3 répliques), LUCIE (3 répliques)
        # - Un comédien rare avec faute d'OCR : JACQUE (1 réplique) -> doit être fusionné en JACQUES
        # - Un comédien fantôme : CQ (0 réplique) -> doit être retiré de la liste finale
        # - Une réplique collective : JACQUES ET LUCIE (1 réplique) -> doit dupliquer la réplique pour chacun
        # NOTE: On met un espacement vertical de 80px entre les noms de personnages et leurs répliques
        # pour éviter qu'ils ne soient fusionnés sur la même ligne par LineReconstructor (seuil = 36px)
        blocks = [
            _block("CQ", 50, 50), # comédien fantôme
            _block("JACQUES", 50, 150),
            _block("Réplique Jacques 1", 50, 230),
            _block("JACQUES", 50, 310),
            _block("Réplique Jacques 2", 50, 390),
            _block("JACQUES", 50, 470),
            _block("Réplique Jacques 3", 50, 550),
            
            _block("LUCIE", 50, 650),
            _block("Réplique Lucie 1", 50, 730),
            _block("LUCIE", 50, 810),
            _block("Réplique Lucie 2", 50, 890),
            _block("LUCIE", 50, 970),
            _block("Réplique Lucie 3", 50, 1050),
            
            _block("JACQUE", 50, 1150), # rare typo
            _block("Réplique Jacques rare", 50, 1230),
            
            _block("JACQUES ET LUCIE", 50, 1330), # collective
            _block("Réplique collective", 50, 1410),
        ]
        page = _page(blocks)
        cfg_layout = LayoutConfig()
        cfg_corr = CorrectionConfig()
        analyzer = LayoutAnalyzer(cfg_layout, cfg_corr)
        script = analyzer.build_script([page])
        
        # 1. Vérifier que CQ n'est pas dans la liste des personnages (0 réplique)
        self.assertNotIn("CQ", script.characters)
        
        # 2. Vérifier que JACQUE a bien été fusionné dans JACQUES
        self.assertNotIn("JACQUE", script.characters)
        
        # 3. Vérifier que la distribution contient exactement 2 personnages : JACQUES et LUCIE
        self.assertEqual(script.characters, ["JACQUES", "LUCIE"])
        
        # 4. Vérifier que la réplique collective a bien été dupliquée
        elems = script.all_elements
        dialogues = [e for e in elems if e.element_type == ElementType.DIALOGUE]
        
        # On attend :
        # - 3 répliques JACQUES
        # - 3 répliques LUCIE
        # - 1 réplique JACQUE fusionnée en JACQUES (total jacques = 4)
        # - 1 réplique collective dupliquée en 2 (1 pour JACQUES, 1 pour LUCIE)
        # Total répliques attendu = 3 + 3 + 1 + 2 = 9 répliques.
        self.assertEqual(len(dialogues), 9)
        
        # Compter les répliques par personnage
        jacques_replies = [d for d in dialogues if d.character == "JACQUES"]
        lucie_replies = [d for d in dialogues if d.character == "LUCIE"]
        self.assertEqual(len(jacques_replies), 5) # 3 de base + 1 typo + 1 collective
        self.assertEqual(len(lucie_replies), 4) # 3 de base + 1 collective

    def test_case_sensitivity_and_strict_filtering(self):
        """
        Teste que la détection accepte la casse mixte (William FARELL)
        et que le filtrage strict élimine les faux positifs (FETE DU VILLAGE).
        """
        blocks = [
            _block("William FARELL: Bonjour... Alors Ça gaze ou j'vous tase ?", 50, 100),
            _block("FETE DU VILLAGE (MUSIQUE + LUMIERE)", 50, 200),
        ]
        page = _page(blocks)
        
        layout_cfg = LayoutConfig()
        corr_cfg = CorrectionConfig(
            character_names=["JOHN", "CHARLIE", "SAM", "JEFF PATERSON", "William FARELL", "MARY", "LOLA", "NOLAN", "JULIA", "JACKIE"]
        )
        analyzer = LayoutAnalyzer(layout_cfg, corr_cfg)
        script = analyzer.build_script([page])

        # "William FARELL" doit être présent dans les personnages avec sa casse originale
        self.assertIn("William FARELL", script.characters)
        
        # "FETE DU VILLAGE" ne doit PAS être présent dans le script final car non fourni dans la liste utilisateur
        self.assertNotIn("FETE DU VILLAGE", script.characters)
        
        # Vérification des éléments de dialogue
        elems = script.all_elements
        dialogues = [e for e in elems if e.element_type == ElementType.DIALOGUE]
        
        # Seule la réplique de William FARELL est un dialogue
        self.assertEqual(len(dialogues), 1)
        self.assertEqual(dialogues[0].character, "William FARELL")
        
        # FETE DU VILLAGE retombe dans le flux de texte classique comme didascalie
        stage_dirs = [e for e in elems if e.element_type == ElementType.STAGE_DIRECTION]
        self.assertEqual(len(stage_dirs), 1)
        self.assertEqual(stage_dirs[0].text, "FETE DU VILLAGE (MUSIQUE + LUMIERE)")


if __name__ == "__main__":
    unittest.main(verbosity=2)
