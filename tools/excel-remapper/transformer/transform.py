"""
transformer/transform.py
-------------------------
Module responsible for applying mappings to actual data,
producing a clean DataFrame ready for export.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any

import pandas as pd

from mapper.mapping import ColumnMapping, MappingConfig

logger = logging.getLogger(__name__)


@dataclass
class TransformResult:
    """Result of a transformation operation."""

    success: bool
    dataframe: pd.DataFrame | None = None
    rows_processed: int = 0
    rows_output: int = 0
    warnings: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)
    applied_defaults: list[str] = field(default_factory=list)
    ignored_columns: list[str] = field(default_factory=list)

    def summary(self) -> dict[str, Any]:
        return {
            "success": self.success,
            "rows_processed": self.rows_processed,
            "rows_output": self.rows_output,
            "warnings": self.warnings,
            "errors": self.errors,
            "applied_defaults": self.applied_defaults,
            "ignored_columns": self.ignored_columns,
        }


def _read_source_data(
    file_path: str,
    sheet_name: str,
    header_row: int,
) -> pd.DataFrame:
    """Read source data from Excel or CSV.

    Args:
        file_path: Path to source file.
        sheet_name: Sheet name (or '(default)' for CSV).
        header_row: 0-indexed row number of headers in the raw file.

    Returns:
        DataFrame with proper headers.

    Raises:
        ValueError: If file format not supported.
        RuntimeError: If read fails.
    """
    from pathlib import Path

    path = Path(file_path)
    ext = path.suffix.lower()

    try:
        if ext == ".xlsx":
            df = pd.read_excel(
                str(path),
                sheet_name=sheet_name if sheet_name != "(default)" else 0,
                header=None,
                skiprows=header_row,
                engine="openpyxl",
            )
            # Set proper column names from the first row after skip
            if len(df) > 0:
                headers = df.iloc[0].tolist()
                df = df.iloc[1:].reset_index(drop=True)
                # Clean headers
                clean: list[str] = []
                seen: dict[str, int] = {}
                for i, h in enumerate(headers):
                    name = str(h).strip() if not pd.isna(h) else f"col_{i}"
                    if name in seen:
                        seen[name] += 1
                        name = f"{name}_{seen[name]}"
                    else:
                        seen[name] = 0
                    clean.append(name)
                df.columns = clean
            return df

        elif ext == ".csv":
            df = pd.read_csv(
                str(path),
                header=None,
                skiprows=header_row,
                encoding="utf-8",
            )
            if len(df) > 0:
                headers = df.iloc[0].tolist()
                df = df.iloc[1:].reset_index(drop=True)
                clean_csv: list[str] = []
                seen_csv: dict[str, int] = {}
                for i, h in enumerate(headers):
                    name = str(h).strip() if not pd.isna(h) else f"col_{i}"
                    if name in seen_csv:
                        seen_csv[name] += 1
                        name = f"{name}_{seen_csv[name]}"
                    else:
                        seen_csv[name] = 0
                    clean_csv.append(name)
                df.columns = clean_csv
            return df

        else:
            raise ValueError(f"Unsupported file type: {ext}")

    except Exception as e:
        raise RuntimeError(f"Failed to read source data: {e}") from e


def apply_mapping(
    config: MappingConfig,
) -> TransformResult:
    """Apply a mapping configuration to source data and produce clean output.

    Args:
        config: MappingConfig with source file, sheet, header info and mappings.

    Returns:
        TransformResult with the transformed DataFrame and metadata.
    """
    result = TransformResult(success=False)

    # Read source data
    try:
        df_source = _read_source_data(
            config.file_path if hasattr(config, "file_path") else config.source_file,
            config.sheet_name,
            config.header_row,
        )
    except Exception as e:
        result.errors.append(f"Failed to read source: {e}")
        return result

    result.rows_processed = len(df_source)

    # Build output columns
    output_data: dict[str, list[Any]] = {}
    active_mappings = [m for m in config.mappings if not m.ignored]

    for mapping in active_mappings:
        dest = mapping.destination_field
        if not dest:
            continue

        if mapping.source_column and mapping.source_column in df_source.columns:
            series = df_source[mapping.source_column].copy()
            output_data[dest] = series.tolist()
        elif mapping.source_column and mapping.source_column not in df_source.columns:
            result.warnings.append(
                f"Source column '{mapping.source_column}' not found in data. "
                f"Using default for '{dest}'."
            )
            if mapping.default_value:
                output_data[dest] = [mapping.default_value] * len(df_source)
                result.applied_defaults.append(dest)
            else:
                output_data[dest] = [None] * len(df_source)
        else:
            # No source column - use default only
            if mapping.default_value:
                output_data[dest] = [mapping.default_value] * len(df_source)
                result.applied_defaults.append(dest)
            else:
                output_data[dest] = [None] * len(df_source)

    # Track ignored columns
    for m in config.mappings:
        if m.ignored and m.source_column:
            result.ignored_columns.append(m.source_column)

    if not output_data:
        result.errors.append("No output columns produced from mapping.")
        return result

    df_output = pd.DataFrame(output_data)
    result.dataframe = df_output
    result.rows_output = len(df_output)
    result.success = True

    logger.info(
        "Transform complete: %d rows processed -> %d rows output, %d warnings",
        result.rows_processed,
        result.rows_output,
        len(result.warnings),
    )
    return result
