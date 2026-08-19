"""
main.py
-------
Entry point for the Excel/CSV Remapper tool.

Usage (GUI):
    python main.py

Usage (CLI - transformar con un perfil guardado):
    python main.py transform --profile <perfil.json> --output <salida.xlsx>
"""

from __future__ import annotations

import argparse
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


def run_transform(profile_path: str, output_path: str) -> int:
    """Run a batch transformation using a saved profile (CLI mode).

    Args:
        profile_path: Path to a MappingConfig JSON profile.
        output_path: Destination file (.xlsx or .csv).

    Returns:
        Exit code (0 = success, 1 = failure).
    """
    logger = logging.getLogger(__name__)

    try:
        from exporter.export import export_data
        from mapper.mapping import load_mapping
        from transformer.transform import apply_mapping
    except ImportError as e:
        print(f"Missing dependency: {e}", file=sys.stderr)
        return 1

    profile = Path(profile_path)
    out = Path(output_path)

    try:
        config = load_mapping(profile)
    except Exception as e:
        logger.error("Cannot load profile %s: %s", profile, e)
        return 1

    logger.info("Profile '%s' loaded: sheet=%s header_row=%d (%d mappings)",
                profile.name, config.sheet_name, config.header_row,
                len(config.mappings))

    result = apply_mapping(config)
    if not result.success or result.dataframe is None:
        logger.error("Transformation failed: %s", "; ".join(result.errors))
        return 1

    out.parent.mkdir(parents=True, exist_ok=True)
    saved = export_data(result.dataframe, out)

    # Resumen por consola (trazabilidad visible y reproducible)
    print("\n=== RESUMEN TRANSFORMACIÓN ===")
    print(f"Perfil:           {profile}")
    print(f"Fuente:           {config.source_file} [{config.sheet_name}]")
    print(f"Salida:           {saved}")
    print(f"Filas procesadas: {result.rows_processed}")
    print(f"Filas de salida:  {result.rows_output}")
    print(f"Columnas salida:  {result.dataframe.shape[1]} "
          f"({', '.join(result.dataframe.columns)})")
    print(f"Defaults aplicados: {', '.join(result.applied_defaults) or '(ninguno)'}")
    print(f"Columnas ignoradas: {', '.join(result.ignored_columns) or '(ninguna)'}")

    if result.warnings:
        print("\n--- ADVERTENCIAS ---")
        for w in result.warnings:
            print(f"  [WARN] {w}")
    else:
        print("\nSin advertencias.")

    return 0


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="remapper",
        description="Remapper Excel/CSV — Grupo Security (plantilla canónica).",
    )
    sub = parser.add_subparsers(dest="command")

    p_transform = sub.add_parser(
        "transform",
        help="Aplicar un perfil de mapeo y exportar el archivo ajustado.",
    )
    p_transform.add_argument(
        "--profile", "-p", required=True, help="Ruta al perfil JSON (MappingConfig)."
    )
    p_transform.add_argument(
        "--output", "-o", required=True, help="Ruta del archivo de salida (.xlsx/.csv)."
    )
    return parser


def main() -> None:
    """Run the CLI transform or launch the GUI."""
    setup_logging()
    logger = logging.getLogger(__name__)

    parser = _build_parser()
    args = parser.parse_args()

    if args.command == "transform":
        code = run_transform(args.profile, args.output)
        sys.exit(code)

    logger.info("Starting Excel/CSV Remapper (GUI)")

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