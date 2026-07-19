"""
Exceptions personnalisées pour le pipeline OCR théâtral.

Hiérarchie :
  OCRError
  ├── PDFReadError          — lecture/rendu du PDF
  ├── PreprocessingError    — traitement OpenCV
  ├── OCREngineError        — moteur PaddleOCR
  ├── ContextCorrectionError— correction contextuelle
  ├── LayoutAnalysisError   — analyse de structure
  ├── ExportError           — écriture des résultats
  └── ConfigurationError    — paramètres invalides
"""


class OCRError(Exception):
    """Exception racine du pipeline OCR."""


class PDFReadError(OCRError):
    """Erreur lors de l'ouverture, l'analyse ou le rendu du PDF."""


class PreprocessingError(OCRError):
    """Erreur lors du prétraitement image OpenCV."""


class OCREngineError(OCRError):
    """Erreur lors de l'initialisation ou de l'exécution de PaddleOCR."""


class ContextCorrectionError(OCRError):
    """Erreur lors de la correction contextuelle post-OCR."""


class LayoutAnalysisError(OCRError):
    """Erreur lors de l'analyse de structure de la pièce."""


class ExportError(OCRError):
    """Erreur lors de la sérialisation ou de l'écriture des résultats."""


class ConfigurationError(OCRError):
    """Paramètre de configuration invalide ou manquant."""
