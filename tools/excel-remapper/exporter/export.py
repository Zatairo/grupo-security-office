"""
exporter/export.py
------------------
Module responsible for exporting transformed DataFrames
to clean Excel or CSV files.
"""

from __future__ import annotations

import logging
from pathlib import Path

import pandas as pd

logger = logging.getLogger(__name__)


def export_to_excel(
    df: pd.DataFrame,
    output_path: str | Path,
) -> Path:
    """Export a DataFrame to an Excel (.xlsx) file.

    Args:
        df: DataFrame to export.
        output_path: Destination file path.

    Returns:
        Path to the exported file.
    """
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)

    df.to_excel(str(path), index=False, engine="openpyxl")
    logger.info("Exported %d rows to %s", len(df), path)
    return path


def export_to_csv(
    df: pd.DataFrame,
    output_path: str | Path,
) -> Path:
    """Export a DataFrame to a CSV file.

    Args:
        df: DataFrame to export.
        output_path: Destination file path.

    Returns:
        Path to the exported file.
    """
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)

    df.to_csv(str(path), index=False, encoding="utf-8")
    logger.info("Exported %d rows to %s", len(df), path)
    return path


def export_data(
    df: pd.DataFrame,
    output_path: str | Path,
) -> Path:
    """Export a DataFrame to the appropriate format based on extension.

    Args:
        df: DataFrame to export.
        output_path: Destination file path (.xlsx or .csv).

    Returns:
        Path to the exported file.

    Raises:
        ValueError: If output format not supported.
    """
    path = Path(output_path)
    ext = path.suffix.lower()

    if ext == ".xlsx":
        return export_to_excel(df, path)
    elif ext == ".csv":
        return export_to_csv(df, path)
    else:
        raise ValueError(
            f"Unsupported output format: {ext}. Use .xlsx or .csv"
        )
