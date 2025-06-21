"""Clone Brief Builder – Package initialisation."""
from importlib.metadata import version

from .metadata import build_template, extract_metadata, fetch_page

__all__ = ["build_template", "extract_metadata", "fetch_page"]
__version__ = version(__name__) 