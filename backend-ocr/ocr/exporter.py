"""
Étape 7 : Export dans plusieurs formats.

Trois exporteurs indépendants :
• TextExporter     — texte brut, typographie théâtrale conventionnelle
• JSONExporter     — structure complète avec toutes les métadonnées de confiance
• MarkdownExporter — Markdown avec balisage (gras pour les noms, italique pour
                     les didascalies), compatible Obsidian / GitHub

Façade Exporter : exporte dans les trois formats en un seul appel.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

from .exceptions import ExportError
from .models import ElementType, PipelineResult, Script, ScriptElement

logger = logging.getLogger("ocr_pipeline.exporter")


# ─── Exporteur TXT ────────────────────────────────────────────────────────────


class TextExporter:
    """Export en texte brut avec mise en forme théâtrale."""

    SEP_ACT = "═" * 60
    SEP_SCENE = "─" * 40

    def export(self, script: Script) -> str:
        """Génère le texte formaté."""
        lines: list[str] = []

        if script.title:
            lines += [script.title.upper(), "=" * len(script.title), ""]

        for act in script.acts:
            if act.title:
                lines += ["", self.SEP_ACT, act.title.upper(), self.SEP_ACT, ""]

            for scene in act.scenes:
                if scene.title:
                    lines += ["", scene.title, self.SEP_SCENE, ""]

                for elem in scene.elements:
                    lines.extend(self._format_element(elem))

        return "\n".join(lines)

    def _format_element(self, elem: ScriptElement) -> list[str]:
        t = elem.element_type
        if t == ElementType.CHARACTER:
            return ["", elem.text]
        if t == ElementType.STAGE_DIRECTION:
            return [f"  {elem.text}"]
        if t == ElementType.DIALOGUE:
            return [elem.text]
        if t == ElementType.PAGE_NUMBER:
            return []  # Pas de numéro dans le TXT final
        return [elem.text]

    def save(self, script: Script, path: Path) -> None:
        """Sauvegarde en .txt UTF-8."""
        path = Path(path)
        try:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(self.export(script), encoding="utf-8")
            logger.info("Export TXT → %s", path)
        except Exception as exc:
            raise ExportError(f"Impossible d'écrire {path} : {exc}") from exc


# ─── Exporteur JSON ───────────────────────────────────────────────────────────


class JSONExporter:
    """Export JSON avec toutes les métadonnées (confiance, corrections, pages)."""

    def export(self, result: PipelineResult) -> dict:
        """Retourne le dictionnaire sérialisable."""
        return result.to_dict()

    def save(self, result: PipelineResult, path: Path) -> None:
        """Sauvegarde en .json UTF-8, indenté."""
        path = Path(path)
        try:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(
                json.dumps(self.export(result), ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
            logger.info("Export JSON → %s", path)
        except Exception as exc:
            raise ExportError(f"Impossible d'écrire {path} : {exc}") from exc


# ─── Exporteur Markdown ───────────────────────────────────────────────────────


class MarkdownExporter:
    """Export Markdown lisible avec balisage typographique."""

    def export(self, script: Script) -> str:
        """Génère le Markdown."""
        lines: list[str] = []

        if script.title:
            lines += [f"# {script.title}", ""]

        for act in script.acts:
            if act.title:
                lines += [f"## {act.title}", ""]

            for scene in act.scenes:
                if scene.title:
                    lines += [f"### {scene.title}", ""]

                for elem in scene.elements:
                    lines.extend(self._format_element(elem))

        return "\n".join(lines)

    def _format_element(self, elem: ScriptElement) -> list[str]:
        t = elem.element_type
        if t == ElementType.CHARACTER:
            return ["", f"**{elem.text}**", ""]
        if t == ElementType.STAGE_DIRECTION:
            return [f"*{elem.text}*", ""]
        if t == ElementType.DIALOGUE:
            return [elem.text, ""]
        if t == ElementType.PAGE_NUMBER:
            return []
        return [elem.text, ""]

    def save(self, script: Script, path: Path) -> None:
        """Sauvegarde en .md UTF-8."""
        path = Path(path)
        try:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(self.export(script), encoding="utf-8")
            logger.info("Export Markdown → %s", path)
        except Exception as exc:
            raise ExportError(f"Impossible d'écrire {path} : {exc}") from exc


# ─── Façade ───────────────────────────────────────────────────────────────────


class Exporter:
    """
    Façade combinant les trois exporteurs.

    Usage::

        exporter = Exporter()
        exporter.save_all(result, Path("./output"), stem="tout_bascule")
        # Crée : output/tout_bascule.txt, .json, .md
    """

    def __init__(self) -> None:
        self._txt = TextExporter()
        self._json = JSONExporter()
        self._md = MarkdownExporter()

    def save_all(
        self,
        result: PipelineResult,
        output_dir: Path,
        stem: str = "output",
    ) -> None:
        """Exporte dans les trois formats dans output_dir."""
        output_dir = Path(output_dir)
        self._txt.save(result.script, output_dir / f"{stem}.txt")
        self._json.save(result, output_dir / f"{stem}.json")
        self._md.save(result.script, output_dir / f"{stem}.md")
        logger.info("Tous les exports dans %s", output_dir)
