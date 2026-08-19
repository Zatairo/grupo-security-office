"""
transformer/transform.py
------------------------
Module responsible for applying mappings to actual data,
producing a clean DataFrame ready for export.

Reglas aplicadas sobre el resultado de mapear:
- El output SIEMPRE tiene las 13 columnas de la plantilla canónica de Grupo
  Security en el orden exacto (CANONICAL_OUTPUT_COLUMNS); si el perfil no mapea
  alguna, la columna sale vacía.
- Se descartan filas de sección: SKU vacío o SKU con patrón de título
  ("1. VARIADORES DE FRECUENCIA.", "15.1 TRANSFORMADORES.") -> regex
  `^\\d+(\\.\\d+)*\\.?\\s` (numeral + opcional sub-numeración + espacio).
- NOMBRE se rellena desde la columna de descripción/nombre del origen si el
  campo name queda vacío.
- Los precios se redondean a 2 decimales.
- Se emite un warning (no bloqueante) si hay SKUs duplicados con valores
  distintos.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from typing import Any

import pandas as pd

from mapper.mapping import (
    CANONICAL_OUTPUT_COLUMNS,
    MappingConfig,
    PRICE_FIELDS,
)

logger = logging.getLogger(__name__)

# Patrón de títulos/subtítulos de sección tipo "1. VARIADORES DE FRECUENCIA."
# o "15.1 TRANSFORMADORES." (numeral con sub-numeración opcional).
# Cubre tanto "N. TÍTULO" como "N.N. SUBTÍTULO" / "N.N. TÍTULO".
SECTION_SKU_RE = re.compile(r"^\d+(\.\d+)*\.?\s")


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


def _is_empty_value(value: Any) -> bool:
    """Return True if a value is empty (None, NaN, or blank string)."""
    if value is None:
        return True
    if isinstance(value, float) and pd.isna(value):
        return True
    text = str(value).strip()
    return text == "" or text.lower() == "nan"


def _is_section_row(sku_value: Any) -> bool:
    """Detect a section-row: empty SKU or a numbered title like '1. VARIADORES'.

    Estas filas no son productos (no tienen precios) y se descartan.
    """
    if _is_empty_value(sku_value):
        return True
    text = str(sku_value).strip()
    return bool(SECTION_SKU_RE.match(text))


def _round_prices(df: pd.DataFrame) -> None:
    """Round all numeric price columns to 2 decimal places, in place."""
    for price_field in PRICE_FIELDS:
        if price_field in df.columns:
            numeric = pd.to_numeric(df[price_field], errors="coerce")
            df[price_field] = numeric.round(2)


def _detect_duplicate_skus(df: pd.DataFrame) -> list[str]:
    """Detect duplicated SKUs and return warning messages.

    A warning is raised for each SKU that appears more than once with
    different values in any other column (duplicate with identical values
    is reported as informational).
    """
    if "sku" not in df.columns:
        return []

    skus = df["sku"].astype(str).str.strip()
    valid = skus[skus.ne("") & skus.ne("nan")]
    counts = valid.value_counts()

    warnings: list[str] = []
    for sku, count in counts[counts > 1].items():
        rows = df[skus == sku]
        others = rows.drop(columns=["sku"])
        # Fingerprint robusto ante tipos mixtos (float/str/NaN)
        fingerprints = others.apply(
            lambda r: tuple(str(x) for x in r.tolist()), axis=1
        )
        distinct = fingerprints.nunique()
        if distinct > 1:
            warnings.append(
                f"SKU duplicado '{sku}' ({int(count)} ocurrencias) "
                f"con valores distintos entre sí."
            )
        else:
            warnings.append(
                f"SKU duplicado '{sku}' ({int(count)} ocurrencias) "
                f"con valores idénticos."
            )
    return warnings


def apply_mapping(
    config: MappingConfig,
) -> TransformResult:
    """Apply a mapping configuration to source data and produce clean output.

    El output es un DataFrame con las 13 columnas canónicas en orden exacto,
    precios redondeados a 2 decimales y sin filas de sección.

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

    # --- Filtro de filas de sección (SKU vacío o patrón 'N. Título') ---
    if "sku" in output_data:
        mask = [not _is_section_row(v) for v in output_data["sku"]]
        dropped = len(mask) - sum(mask)
        if dropped:
            result.warnings.append(
                f"{dropped} fila(s) de sección descartadas "
                f"(SKU vacío o título tipo 'N. Sección')."
            )
        for key in list(output_data.keys()):
            output_data[key] = [
                v for v, keep in zip(output_data[key], mask) if keep
            ]

    rows = len(next(iter(output_data.values())))

    # --- NOMBRE: si el campo name quedó vacío, rellenar desde description ---
    if "name" in output_data and "description" in output_data:
        filled = [
            d if _is_empty_value(n) else n
            for n, d in zip(output_data["name"], output_data["description"])
        ]
        output_data["name"] = filled

    # --- Construcción del DataFrame con las 13 columnas canónicas en orden ---
    canonical_data: dict[str, list[Any]] = {}
    for dest_field, _header in CANONICAL_OUTPUT_COLUMNS:
        canonical_data[dest_field] = output_data.get(dest_field, [None] * rows)

    df_output = pd.DataFrame(canonical_data)

    # --- Redondeo de precios a 2 decimales ---
    _round_prices(df_output)

    # --- Warning de SKUs duplicados (antes de renombrar a headers canónicos) ---
    result.warnings.extend(_detect_duplicate_skus(df_output))

    # --- Renombrar a headers canónicos exactos (orden preservado) ---
    rename_map = {dest: header for dest, header in CANONICAL_OUTPUT_COLUMNS}
    df_output = df_output.rename(columns=rename_map)

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