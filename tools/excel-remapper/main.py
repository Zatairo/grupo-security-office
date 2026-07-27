"""
main.py
-------
Entry point for the Excel/CSV Remapper tool.
Launches the Tkinter GUI application.

Usage:
    python main.py
"""

from __future__ import annotations

import logging
import sys
from pathlib import Path

# Ensure the project root is on sys.path
PROJECT_ROOT = Path(__file__).resolve().parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


def setup_logging(level: int = logging.INFO) -> None:
    """Configure basic logging for the application."""
    logging.basicConfig(
        level=level,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%H:%M:%S",
    )


def main() -> None:
    """Launch the Remapper application."""
    setup_logging()
    logger = logging.getLogger(__name__)
    logger.info("Starting Excel/CSV Remapper")

    try:
        from ui.app import RemapperApp

        app = RemapperApp()
        app.run()
    except ImportError as e:
        print(f"Missing dependency: {e}", file=sys.stderr)
        print("Install requirements: pip install -r requirements.txt", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        logger.error("Fatal error: %s", e, exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
