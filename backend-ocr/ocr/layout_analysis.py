"""
Étape 6 : Analyse de structure d'une pièce de théâtre.

Deux classes principales :

LineReconstructor
  Regroupe les blocs OCR bruts en lignes de texte cohérentes.
  Problème clé : PaddleOCR retourne des fragments (bounding boxes individuels).
  "JACQUES (gémissant)" peut être retourné comme 2 ou 3 blocs proches.
  → Grouper par proximité Y (tolérance = fraction de la hauteur de page).

LineClassifier
  Classifie chaque ligne reconstruite :
  • ALL CAPS + court (≤ N mots)   → CHARACTER
  • Débute et finit par (...)      → STAGE_DIRECTION
  • Chiffre seul                   → PAGE_NUMBER
  • Mots-clés acte/scène           → ACT_HEADING / SCENE_HEADING
  • Tout le reste                  → DIALOGUE

LayoutAnalyzer
  Orchestre reconstruction + classification + construction de l'arbre Script.
  Gère l'état courant (acte en cours, scène en cours, personnage en cours).
"""

from __future__ import annotations

import logging
import re
from typing import List, Optional, Tuple

from .config import CorrectionConfig, LayoutConfig
from .context_correction import ContextCorrector
from .exceptions import LayoutAnalysisError
from .models import (
    Act,
    ElementType,
    PageRawResult,
    RawTextBlock,
    Scene,
    Script,
    ScriptElement,
    TextLine,
)

logger = logging.getLogger("ocr_pipeline.layout")

# ─── Regex compilées ─────────────────────────────────────────────────────────

_RE_PAGE_NUM = re.compile(r"^\s*-?\s*\d{1,4}\s*-?\s*$")
_RE_STAGE_DIR_FULL = re.compile(r"^\s*\(.*\)\s*$", re.DOTALL)
_RE_LETTERS = re.compile(r"[a-zA-ZÀ-ÿœæŒÆ]")
_RE_UPPER_LETTERS = re.compile(r"[A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸŒÆ]")
_RE_INLINE_STAGE = re.compile(r"\s*\(.*?\)\s*$")   # didascalie en fin de ligne

# Format "PERSONNAGE [(stage)] - réplique" sur une seule ligne
# Exemples : "JACQUES (gémissant) - Mais qu'est-ce...", "LUCIE - Enfin chéri...", "QQ. - ..."
_RE_CHAR_DIALOGUE = re.compile(
    r"^([A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸŒÆ][A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸŒÆ-]*\s*\.?\s*"
    r"(?:\s+[A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸŒÆ][A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸŒÆ-]*\s*\.?\s*){0,2})"
    r"(?:\s*\([^)]*\))*"   # zéro ou plusieurs stages entre ()
    r"\s*(?:[-\u2013\u2014]\s+|:\s*)"  # tiret séparateur ou deux-points
    r"(.+)$",
    re.DOTALL | re.IGNORECASE,
)


class LineReconstructor:
    """
    Regroupe les blocs OCR bruts en lignes de texte.

    Algorithme :
    1. Trier les blocs par Y1 (coordonnée du haut)
    2. Pour chaque bloc, vérifier si son centre Y est proche du centre Y
       de la ligne en cours (tolérance = page_height × line_merge_y_tolerance)
    3. Si oui → ajouter à la ligne ; sinon → nouvelle ligne
    4. Dans chaque ligne, trier les blocs par X1
    """

    def __init__(self, cfg: LayoutConfig) -> None:
        self._cfg = cfg

    def reconstruct(
        self, blocks: List[RawTextBlock], page_height: int
    ) -> List[TextLine]:
        """
        Regroupe les blocs en lignes de texte.

        :param blocks: blocs OCR bruts triés par (y1, x1)
        :param page_height: hauteur de la page en pixels
        :returns: liste de TextLine triées top→bottom
        """
        if not blocks:
            return []

        y_tolerance = page_height * self._cfg.line_merge_y_tolerance

        # Trier par Y1 d'abord
        sorted_blocks = sorted(blocks, key=lambda b: b.bbox.y1)

        lines_of_blocks: List[List[RawTextBlock]] = []
        current_group: List[RawTextBlock] = [sorted_blocks[0]]
        current_center_y = sorted_blocks[0].bbox.center_y

        for block in sorted_blocks[1:]:
            if abs(block.bbox.center_y - current_center_y) <= y_tolerance:
                current_group.append(block)
                # Mettre à jour le centre Y (moyenne glissante pour robustesse)
                current_center_y = sum(b.bbox.center_y for b in current_group) / len(
                    current_group
                )
            else:
                lines_of_blocks.append(current_group)
                current_group = [block]
                current_center_y = block.bbox.center_y

        lines_of_blocks.append(current_group)

        result = []
        for group in lines_of_blocks:
            # Trier les blocs de la ligne par X
            group.sort(key=lambda b: b.bbox.x1)
            result.append(
                TextLine(blocks=group, page_number=group[0].page_number)
            )

        return result


class LineClassifier:
    """
    Classifie chaque ligne reconstruite en type structurel.

    Retourne un triplet (ElementType, texte_normalisé, nom_du_personnage_ou_None).
    """

    def __init__(
        self,
        cfg: LayoutConfig,
        corrector: Optional[ContextCorrector] = None,
    ) -> None:
        self._cfg = cfg
        self._corrector = corrector
        self._act_kw = [k.lower() for k in cfg.act_keywords]
        self._scene_kw = [k.lower() for k in cfg.scene_keywords]

    def classify(self, line: TextLine) -> Tuple[ElementType, str, Optional[str]]:
        """
        Classifie une ligne.

        :returns: (ElementType, texte, nom_personnage_ou_None)
        """
        text = line.text.strip()
        if not text:
            return ElementType.BLANK, "", None

        text_lower = text.lower()

        # ── Numéro de page ────────────────────────────────────────────────────
        if _RE_PAGE_NUM.match(text):
            return ElementType.PAGE_NUMBER, text, None

        # ── Acte ──────────────────────────────────────────────────────────────
        if (
            any(text_lower.startswith(kw) for kw in self._act_kw)
            and len(text.split()) <= 5
        ):
            return ElementType.ACT_HEADING, text, None

        # ── Scène ─────────────────────────────────────────────────────────────
        if (
            any(text_lower.startswith(kw) for kw in self._scene_kw)
            and len(text.split()) <= 5
        ):
            return ElementType.SCENE_HEADING, text, None

        # ── Didascalie complète (ligne entière entre parenthèses) ─────────────
        if _RE_STAGE_DIR_FULL.match(text):
            return ElementType.STAGE_DIRECTION, text, None

        # ── Format inline "PERSONNAGE [(stage)] - réplique" ───────────────────
        # Doit être testé AVANT la détection de nom seul car le texte contient
        # le nom + la réplique sur la même ligne.
        char_name = self._try_detect_inline_char_dialogue(text)
        if char_name is not None:
            return ElementType.DIALOGUE, text, char_name

        # ── Nom de personnage seul ────────────────────────────────────────────
        char_name = self._try_detect_character(text)
        if char_name is not None:
            return ElementType.CHARACTER, text, char_name

        # ── Dialogue (par défaut) ─────────────────────────────────────────────
        return ElementType.DIALOGUE, text, None

    # ── Privé ─────────────────────────────────────────────────────────────────

    def _try_detect_inline_char_dialogue(self, text: str) -> Optional[str]:
        """
        Détecte le format « PERSONNAGE [(stage)] - réplique » sur une seule ligne.

        Retourne le nom du personnage si détecté, None sinon.
        Ce format est courant dans les pièces de comédie françaises modernes.
        """
        m = _RE_CHAR_DIALOGUE.match(text)
        if not m:
            return None

        # Nettoyage robuste de tous les points abréviaitfs et espaces (ex: "QQ ." ou "QQ." -> "QQ")
        candidate = m.group(1).replace(".", "").strip()

        # Si l'on a une liste connue de personnages, s'appuyer dessus de manière dynamique et insensible à la casse
        if self._corrector and self._corrector._known_chars:
            for known in self._corrector._known_chars:
                if candidate.lower().strip() == known.lower().strip():
                    return known

        # Sinon, logique générique
        letters = _RE_LETTERS.findall(candidate)
        if len(letters) < 2:
            return None
            
        # On applique la vérification du ratio de majuscules si le nom n'est pas dans la liste connue
        uppers = _RE_UPPER_LETTERS.findall(candidate)
        if len(uppers) / len(letters) < self._cfg.character_caps_min_ratio:
            return None

        # Correction fuzzy si corrector disponible
        if self._corrector:
            corrected, _ = self._corrector.correct_character_name(candidate)
            return corrected

        return candidate

    def _try_detect_character(self, text: str) -> Optional[str]:
        """
        Détecte si la ligne est un nom de personnage.

        Critères cumulatifs :
        1. Le « corps » (hors didascalie inline en fin) ne dépasse pas
           character_max_words mots
        2. La proportion de lettres MAJUSCULES ≥ character_caps_min_ratio
        3. Au moins 2 lettres (évite les chiffres seuls)

        Si un corrector est disponible, on tente le fuzzy matching du nom
        pour corriger les OCR partiels (ex: "JAcQUEs" → "JACQUES").
        """
        # Extraire le corps : supprimer la didascalie inline en fin de ligne
        # "JACQUES (gémissant)" → core = "JACQUES"
        core = _RE_INLINE_STAGE.sub("", text).strip()
        if not core:
            return None

        # Nettoyage des ponctuations de fin de nom courantes (point, deux-points, point-virgule, tirets)
        core_cleaned = core.strip().rstrip(". :;-—–_")
        
        # S'il reste d'autres ponctuations typiques de phrases (? ou ! ou ...) on rejette
        if re.search(r"[?!]|\.\.\.", core_cleaned):
            return None
        
        candidate = core_cleaned.strip().strip("-—–_")
        
        # Si après nettoyage il ne reste rien ou c'est un mot de liaison seul (très improbable comme personnage)
        if not candidate or candidate.upper() in ["ET", "OU", "LE", "LA", "LES", "UN", "UNE", "DES"]:
            return None

        # Vérification dynamique par rapport aux personnages connus d'abord (insensible à la casse)
        if self._corrector and self._corrector._known_chars:
            for known in self._corrector._known_chars:
                if candidate.lower().strip() == known.lower().strip():
                    return known

        # Validation par nombre de mots et lettres
        words = candidate.split()
        if len(words) > self._cfg.character_max_words:
            return None

        letters = _RE_LETTERS.findall(candidate)
        if len(letters) < 2:
            return None

        # On applique la vérification du ratio de majuscules si le nom n'est pas dans la liste connue
        uppers = _RE_UPPER_LETTERS.findall(candidate)
        ratio = len(uppers) / len(letters)
        if ratio < self._cfg.character_caps_min_ratio:
            return None

        # Tentative de correction fuzzy (via dictionnaire connu si fourni)
        if self._corrector:
            corrected, _ = self._corrector.correct_character_name(candidate)
            return corrected

        return candidate


# ─── Fonctions d'aide à la correction globale des personnages ──────────────────

def log_debug_ocr(msg: str) -> None:
    """
    Imprime le message dans la console et l'écrit automatiquement dans un fichier log
    sur le disque afin que l'utilisateur puisse le consulter en temps réel dans VS Code.
    """
    print(msg)
    # Tenter d'écrire dans le dossier du projet principal ou en relatif
    paths = [
        "D:\\Dev\\replicoach-starter\\replicoach-starter\\backend-ocr\\ocr_scan.log",
        "ocr_scan.log"
    ]
    for path in paths:
        try:
            with open(path, "a", encoding="utf-8") as f:
                f.write(msg + "\n")
            break
        except Exception:
            continue


def split_compound_character(char_name: Optional[str]) -> List[str]:
    """
    Découpe un nom de personnage combiné (ex: "JACQUES ET JEAN", "JACQUES, JEAN")
    en personnages individuels distincts.
    """
    if not char_name:
        return []
    # Ne pas découper "TOUS" ou d'autres désignations collectives simples
    if char_name.upper().strip() in ["TOUS", "TOUTES", "LA FOULE", "CHOEUR"]:
        return [char_name.strip()]
        
    # Séparateurs courants : " ET ", " / ", " + ", ","
    normalized = char_name.replace("+", " ET ").replace("/", " ET ")
    normalized = normalized.replace(",", " ET ")
    
    # Découper par " ET "
    parts = re.split(r"\bET\b", normalized, flags=re.IGNORECASE)
    
    result = []
    for p in parts:
        cleaned = p.strip()
        if cleaned:
            result.append(cleaned)
            
    if len(result) > 1:
        log_debug_ocr(f"[DEBUG OCR] Découpage personnage composé : '{char_name}' -> {result}")
        
    return result


def is_abbreviation(rare: str, frequent: List[str]) -> Optional[str]:
    """
    Détecte si un nom rare court (ex: "QQ" ou "M. Q") est une abréviation ou 
    un alias d'un personnage fréquent (ex: "QUERROCHOT").
    Retourne le nom fréquent si trouvé, sinon None.
    """
    r_clean = re.sub(r"\b(M\.|MME|MR|DR|PR)\.?\s*", "", rare.upper()).strip()
    if not r_clean:
        return None
        
    # On nettoie la liste des frequents pour la recherche
    freq_map = {}
    for f in frequent:
        f_clean = re.sub(r"\b(M\.|MME|MR|DR|PR)\.?\s*", "", f.upper()).strip()
        if f_clean:
            freq_map[f_clean] = f
            
    # Si le rare est très court (1 à 3 lettres)
    if len(r_clean) <= 3:
        # 1. Préfixe direct UNIQUE (ex: "QU" pour "QUERROCHOT", mais pas "L" pour "LUCIE" et "LAURA")
        prefix_matches = []
        for f_clean, original in freq_map.items():
            if f_clean.startswith(r_clean):
                prefix_matches.append(original)
        if len(prefix_matches) == 1:
            return prefix_matches[0]
                
        # 2. Unicité par première lettre (ex: "QQ" ou "Q." -> seul "QUERROCHOT" commence par Q)
        same_start = [f_clean for f_clean in freq_map.keys() if f_clean.startswith(r_clean[0])]
        if len(same_start) == 1:
            return freq_map[same_start[0]]
            
    return None


class LayoutAnalyzer:
    """
    Analyse complète : reconstruit les lignes, classifie, construit l'arbre Script.

    Usage::

        analyzer = LayoutAnalyzer(cfg.layout, cfg.correction)
        script = analyzer.build_script(page_results, title="Tout bascule")
    """

    def __init__(
        self,
        layout_cfg: LayoutConfig,
        correction_cfg: CorrectionConfig,
    ) -> None:
        self._corrector = ContextCorrector(correction_cfg)
        self._reconstructor = LineReconstructor(layout_cfg)
        self._classifier = LineClassifier(layout_cfg, self._corrector)

    def build_script(
        self,
        page_results: List[PageRawResult],
        title: Optional[str] = None,
    ) -> Script:
        """
        Construit un Script structuré depuis les résultats OCR bruts.

        Gère l'état de parsing : acte courant, scène courante, personnage courant.
        Les éléments orphelins (avant le premier acte/scène déclaré) sont
        placés dans un Acte 1 / Scène 1 implicites.
        """
        script = Script(title=title, page_results=page_results)

        current_act: Optional[Act] = None
        current_scene: Optional[Scene] = None
        last_characters: List[str] = []
        pending: List[ScriptElement] = []

        def _ensure_context() -> None:
            """Crée acte et scène implicites si nécessaire."""
            nonlocal current_act, current_scene
            if current_act is None:
                current_act = Act(number=1, title=None)
                script.acts.append(current_act)
            if current_scene is None:
                current_scene = Scene(number=1, title=None)
                current_act.scenes.append(current_scene)

        def _flush(elements: List[ScriptElement]) -> None:
            """Déverse les éléments en attente dans la scène courante."""
            if not elements:
                return
            _ensure_context()
            current_scene.elements.extend(elements)
            elements.clear()

        for page_result in page_results:
            lines = self._reconstructor.reconstruct(
                page_result.blocks, page_result.height
            )

            for line in lines:
                elem_type, text, char_name = self._classifier.classify(line)

                if elem_type == ElementType.BLANK:
                    continue

                if elem_type == ElementType.ACT_HEADING:
                    _flush(pending)
                    act_num = _extract_number(text)
                    current_act = Act(number=act_num, title=text)
                    script.acts.append(current_act)
                    current_scene = None
                    last_characters = []

                elif elem_type == ElementType.SCENE_HEADING:
                    _flush(pending)
                    scene_num = _extract_number(text)
                    # S'assurer que l'acte existe (sans créer de scène implicite)
                    if current_act is None:
                        current_act = Act(number=1, title=None)
                        script.acts.append(current_act)
                    current_scene = Scene(number=scene_num, title=text)
                    current_act.scenes.append(current_scene)
                    last_characters = []

                elif elem_type == ElementType.CHARACTER:
                    chars = split_compound_character(char_name)
                    if len(chars) > 1:
                        log_debug_ocr(f"[DEBUG OCR] Ligne CHARACTER composée détectée et éclatée : '{char_name}'")
                        # Si composé, on crée un marqueur de personnage pour chaque comédien
                        for c in chars:
                            pending.append(
                                ScriptElement(
                                    element_type=ElementType.CHARACTER,
                                    text=c,
                                    character=c,
                                    confidence=line.confidence,
                                    page_number=line.page_number,
                                )
                            )
                        last_characters = chars
                    else:
                        pending.append(
                            ScriptElement(
                                element_type=ElementType.CHARACTER,
                                text=text,
                                character=char_name,
                                confidence=line.confidence,
                                page_number=line.page_number,
                            )
                        )
                        last_characters = [char_name] if char_name else []

                elif elem_type == ElementType.DIALOGUE:
                    # char_name non-None si format inline "PERSONNAGE - réplique"
                    if char_name is not None:
                        effective_chars = split_compound_character(char_name)
                        last_characters = effective_chars
                    else:
                        effective_chars = last_characters

                    # Si plusieurs personnages disent la réplique ensemble, 
                    # on la duplique pour chacun d'eux (générique et parfait pour l'apprentissage)
                    if effective_chars:
                        for c in effective_chars:
                            pending.append(
                                ScriptElement(
                                    element_type=ElementType.DIALOGUE,
                                    text=text,
                                    character=c,
                                    confidence=line.confidence,
                                    page_number=line.page_number,
                                )
                            )
                    else:
                        # Pas de personnage associé (réplique orpheline ou didascalie lue comme dialogue)
                        pending.append(
                            ScriptElement(
                                element_type=ElementType.DIALOGUE,
                                text=text,
                                character=None,
                                confidence=line.confidence,
                                page_number=line.page_number,
                            )
                        )

                else:
                    # STAGE_DIRECTION, PAGE_NUMBER, etc.
                    pending.append(
                        ScriptElement(
                            element_type=elem_type,
                            text=text,
                            character=None,
                            confidence=line.confidence,
                            page_number=line.page_number,
                        )
                    )

        _flush(pending)

        # Auto-correction post-structure : fusionner les personnages rares avec les fréquents
        self._auto_merge_characters(script)

        logger.info(
            "Structure : %d acte(s), %d scène(s), %d éléments | "
            "Personnages : %s",
            len(script.acts),
            sum(len(a.scenes) for a in script.acts),
            len(script.all_elements),
            script.characters or ["(aucun détecté)"],
        )

        return script

    def _auto_merge_characters(self, script: Script) -> None:
        from collections import Counter
        from rapidfuzz import fuzz, process
        import time

        # Récupérer la liste stricte et obligatoire de référence fournie par l'utilisateur
        reference_chars = self._corrector._known_chars

        if not reference_chars:
            # LOGIQUE DE REPLI (si pas de liste stricte, ex: lors d'un test unitaire) :
            # On utilise l'algorithme universel de fusion globale vers l'alias dominant.
            char_counts = Counter(
                e.character 
                for e in script.all_elements 
                if e.character and e.element_type == ElementType.DIALOGUE
            )
            if not char_counts:
                return

            all_chars = sorted(char_counts.keys())
            replacements = {}
            resolved_merges = {}

            for i in range(len(all_chars)):
                for j in range(i + 1, len(all_chars)):
                    char_a = all_chars[i]
                    char_b = all_chars[j]

                    count_a = char_counts[char_a]
                    count_b = char_counts[char_b]
                    
                    if count_a >= count_b:
                        dominant, rare = char_a, char_b
                    else:
                        dominant, rare = char_b, char_a

                    is_fuzzy_match = fuzz.ratio(dominant.upper(), rare.upper()) >= 80
                    is_abbrev = False
                    matched_abbrev = is_abbreviation(rare, [dominant])
                    if matched_abbrev == dominant:
                        is_abbrev = True

                    if is_fuzzy_match or is_abbrev:
                        replacements[rare] = dominant

            for rare, dominant in replacements.items():
                curr = dominant
                visited = {rare}
                while curr in replacements and curr not in visited:
                    visited.add(curr)
                    curr = replacements[curr]
                resolved_merges[rare] = curr

            if resolved_merges:
                for element in script.all_elements:
                    if element.character in resolved_merges:
                        new_char = resolved_merges[element.character]
                        element.character = new_char
                        if new_char is not None and element.element_type == ElementType.CHARACTER:
                            element.text = new_char
                        if new_char is None and element.element_type == ElementType.CHARACTER:
                            element.element_type = ElementType.DIALOGUE

            updated_char_counts = Counter(
                e.character 
                for e in script.all_elements 
                if e.character and e.element_type == ElementType.DIALOGUE
            )
            active_characters = {c for c, count in updated_char_counts.items() if count > 0}

            for act in script.acts:
                for scene in act.scenes:
                    scene.elements = [
                        e for e in scene.elements
                        if not (e.element_type == ElementType.CHARACTER and e.character not in active_characters)
                    ]
            return

        # NOUVEAU SCAN : Initialisation et écriture de l'en-tête du log sur le disque
        log_debug_ocr(f"\n=================== NOUVEAU SCAN OCR ({time.strftime('%Y-%m-%d %H:%M:%S')}) ===================")
        log_debug_ocr(f"[DEBUG OCR] Liste stricte et obligatoire des comédiens de référence : {reference_chars}")

        # 1. Collecter tous les personnages bruts d'abord
        all_detected_chars = {
            e.character 
            for e in script.all_elements 
            if e.character
        }

        replacements = {}

        # 2. Associer chaque personnage détecté à l'un des comédiens de la liste de référence (filtrage strict insensible à la casse / .strip())
        for raw_char in all_detected_chars:
            raw_char_clean = raw_char.lower().strip()
            raw_char_up = raw_char.upper().strip()
            
            # Étape 0 : Correspondance via la table d'abréviations/alias explicites de l'utilisateur (priorité maximale !)
            if raw_char_up in self._corrector._abbreviations:
                resolved_name = self._corrector._abbreviations[raw_char_up]
                log_debug_ocr(f"[DEBUG OCR] Abréviation/Alias explicite résolu : '{raw_char}' -> '{resolved_name}'")
                replacements[raw_char] = resolved_name
                continue
            
            # Match exact direct insensible à la casse
            matched_ref = None
            for ref in reference_chars:
                if ref.lower().strip() == raw_char_clean:
                    matched_ref = ref
                    break
            
            if matched_ref:
                replacements[raw_char] = matched_ref
                continue

            # Étape A : Essai d'abréviation/alias (ex: QQ -> QUERROCHOT, LU -> LUCIE)
            matched_abbrev = is_abbreviation(raw_char_up, [r.upper() for r in reference_chars])
            if matched_abbrev:
                for ref in reference_chars:
                    if ref.upper() == matched_abbrev:
                        matched_ref = ref
                        break
                if matched_ref:
                    log_debug_ocr(f"[DEBUG OCR] Association par abréviation détectée : '{raw_char}' -> '{matched_ref}'")
                    replacements[raw_char] = matched_ref
                    continue

            # Étape B : Fuzzy matching d'alignement avec la liste de référence (seuil de tolérance élevé = 75%)
            best_match = process.extractOne(
                raw_char_clean,
                [r.lower() for r in reference_chars],
                scorer=fuzz.ratio,
                score_cutoff=75
            )

            if best_match:
                matched_char_lower, score, index = best_match
                matched_char = reference_chars[index]
                log_debug_ocr(f"[DEBUG OCR] Rapprochement fuzzy : '{raw_char}' -> '{matched_char}' (score fuzzy={score:.1f}%)")
                replacements[raw_char] = matched_char
            else:
                # Rejet pur et simple (hors liste de référence)
                log_debug_ocr(f"[DEBUG OCR] Rejet sémantique strict (hors liste de référence) : '{raw_char}'")
                replacements[raw_char] = None

        log_debug_ocr(f"[DEBUG OCR] Mappings finaux de personnages appliqués : {replacements}")

        # 3. Supprimer complètement les éléments (en-têtes et répliques) des personnages rejetés
        for act in script.acts:
            for scene in act.scenes:
                scene.elements = [
                    e for e in scene.elements
                    if not (e.character in replacements and replacements[e.character] is None)
                ]

        # Mettre à jour le nom des personnages restants avec leur nom de référence d'origine
        for element in script.all_elements:
            if element.character in replacements:
                new_char = replacements[element.character]
                element.character = new_char
                # Écraser physiquement le texte de l'élément CHARACTER par le nom officiel de référence si validé
                if new_char is not None and element.element_type == ElementType.CHARACTER:
                    element.text = new_char

        # 4. Élimination complète des en-têtes CHARACTER fantômes ou rejetés (None ou pas dans la liste obligatoire)
        for act in script.acts:
            for scene in act.scenes:
                original_len = len(scene.elements)
                scene.elements = [
                    e for e in scene.elements
                    if not (e.element_type == ElementType.CHARACTER and e.character not in reference_chars)
                ]
                removed_count = original_len - len(scene.elements)
                if removed_count > 0:
                    log_debug_ocr(f"[DEBUG OCR] Supprimé {removed_count} en-têtes CHARACTER inactifs ou rejetés de la scène.")

        # 5. Balayage global (Catch-All) des alias fusionnés au début du texte des répliques
        log_debug_ocr(f"[DEBUG OCR] Début du balayage global (Catch-All) des alias pour : {self._corrector._abbreviations}")
        for act in script.acts:
            for scene in act.scenes:
                for element in scene.elements:
                    if not element.text:
                        continue
                    for alias, main_name in self._corrector._abbreviations.items():
                        # Cherche l'alias au début de la chaîne, gère les points, espaces et tirets
                        pattern = r"^\s*" + re.escape(alias) + r"\b[\s\.\-:]+(.*)"
                        match = re.search(pattern, element.text, re.IGNORECASE)
                        if match:
                            dialogue_part = match.group(1).strip()
                            log_debug_ocr(f"[DEBUG OCR] Catch-All résolu : '{element.text}' -> '{main_name}\n{dialogue_part}'")
                            
                            # Forcer l'écriture en place avec un saut de ligne physique \n pour l'exportation
                            element.text = f"{main_name}\n{dialogue_part}"
                            element.character = main_name
                            element.element_type = ElementType.DIALOGUE
                            break


# ─── Helpers ─────────────────────────────────────────────────────────────────

_ROMAN = {
    "X": 10, "IX": 9, "VIII": 8, "VII": 7, "VI": 6,
    "V": 5, "IV": 4, "III": 3, "II": 2, "I": 1,
}


def _extract_number(text: str) -> Optional[int]:
    """
    Extrait le premier nombre (arabe ou romain) d'un titre.

    "ACTE II" → 2  |  "Scène 3" → 3  |  "Prologue" → None
    """
    # Nombre arabe
    m = re.search(r"\b(\d+)\b", text)
    if m:
        return int(m.group(1))
    # Nombre romain (les plus longs en premier)
    for rom, val in sorted(_ROMAN.items(), key=lambda x: -len(x[0])):
        if re.search(rf"\b{rom}\b", text.upper()):
            return val
    return None
