"""
Point d'entrée public du module ocr.

Import minimal recommandé::

    from ocr import OCRConfig, OCRPipeline

Import complet pour les intégrateurs avancés::

    from ocr import (
        OCRConfig, OCRPipeline, PipelineResult,
        Script, Act, Scene, ScriptElement,
        ElementType, BlockType, OCRError
    )
"""

from .config import (
    CorrectionConfig,
    LayoutConfig,
    LoggingConfig,
    OCRConfig,
    OCREngineConfig,
    PerformanceConfig,
    PreprocessingConfig,
)
from .exceptions import (
    ConfigurationError,
    ContextCorrectionError,
    ExportError,
    LayoutAnalysisError,
    OCREngineError,
    OCRError,
    PDFReadError,
    PreprocessingError,
)
from .models import (
    Act,
    BlockType,
    BoundingBox,
    ElementType,
    PageRawResult,
    PipelineResult,
    RawTextBlock,
    Scene,
    Script,
    ScriptElement,
    TextLine,
)
from .pipeline import OCRPipeline

__all__ = [
    # Pipeline principal
    "OCRPipeline",
    # Configuration
    "OCRConfig",
    "PreprocessingConfig",
    "OCREngineConfig",
    "CorrectionConfig",
    "LayoutConfig",
    "PerformanceConfig",
    "LoggingConfig",
    # Modèles
    "Script",
    "Act",
    "Scene",
    "ScriptElement",
    "TextLine",
    "RawTextBlock",
    "BoundingBox",
    "PageRawResult",
    "PipelineResult",
    "ElementType",
    "BlockType",
    # Exceptions
    "OCRError",
    "PDFReadError",
    "PreprocessingError",
    "OCREngineError",
    "ContextCorrectionError",
    "LayoutAnalysisError",
    "ExportError",
    "ConfigurationError",
]
