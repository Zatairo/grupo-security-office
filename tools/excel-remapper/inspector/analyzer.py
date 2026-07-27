"""
inspector/analyzer.py
---------------------
Module responsible for inspecting Excel/CSV files:
- Detect sheets
- Detect probable header row
- Detect columns with sample values
"""

from __future__ import annotations

import logging
import shutil
import tempfile
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import pandas as pd

logger = logging.getLogger(__name__)

SUPPORTED_EXTENSIONS = {".xlsx", ".csv"}


@dataclass
class ColumnInfo:
    """Information about a single detected column."""

    index: int
    name: str
    sample_values: list[Any] = field(default_factory=list)
    dtype: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "index": self.index,
            "name": self.name,
            "sample_values": [str(v) for v in self.sample_values],
            "dtype": self.dtype,
        }


@dataclass
class SheetInfo:
    """Information about a single sheet within a workbook."""

    name: str
    header_row: int
    columns: list[ColumnInfo] = field(default_factory=list)
    total_rows: int = 0

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "header_row": self.header_row,
            "columns": [c.to_dict() for c in self.columns],
            "total_rows": self.total_rows,
        }


@dataclass
class FileAnalysis:
    """Complete analysis result for a file."""

    file_path: str
    file_type: str
    sheets: list[SheetInfo] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "file_path": self.file_path,
            "file_type": self.file_type,
            "sheets": [s.to_dict() for s in self.sheets],
        }


def _sanitize_path(file_path: str | Path) -> Path:
    """Sanitize a file path by removing problematic characters.

    Handles paths with newlines (from terminal wrapping or copy-paste),
    extra spaces, or other characters that can come from OneDrive.

    Args:
        file_path: Raw path string or Path object.

    Returns:
        Sanitized Path object.
    """
    raw = str(file_path)
    # Remove carriage returns and leading/trailing whitespace
    cleaned = raw.replace("\r", "").strip()
    # Replace newlines within the path with nothing (they're artifacts)
    # But preserve the actual filename structure
    lines = [line.strip() for line in cleaned.split("\n") if line.strip()]
    cleaned = "".join(lines) if len(lines) > 1 else lines[0] if lines else raw
    return Path(cleaned)


def _copy_to_temp(file_path: Path, max_retries: int = 3) -> Path:
    """Copy a locked file to a temp location to work around permission issues.

    This handles cases where OneDrive or Excel has locked the file.

    Args:
        file_path: Path to the locked file.
        max_retries: Number of retry attempts.

    Returns:
        Path to the temporary copy.

    Raises:
        PermissionError: If file remains locked after all retries.
    """
    temp_dir = Path(tempfile.mkdtemp(prefix="excel_remapper_"))
    temp_file = temp_dir / file_path.name

    last_error: Exception | None = None
    for attempt in range(max_retries):
        try:
            shutil.copy2(str(file_path), str(temp_file))
            logger.info("Copied file to temp location: %s", temp_file)
            return temp_file
        except PermissionError as e:
            last_error = e
            wait = 2 ** attempt  # 1s, 2s, 4s
            logger.warning(
                "Attempt %d/%d: File locked, retrying in %ds...",
                attempt + 1, max_retries, wait,
            )
            time.sleep(wait)

    raise PermissionError(
        f"Cannot access file (it may be open in Excel or locked by OneDrive):\n"
        f"{file_path}\n"
        f"Tip: Close the file in Excel and try again."
    ) from last_error


def validate_file(file_path: str | Path) -> Path:
    """Validate that the file exists and has a supported extension.

    Handles paths with special characters (newlines, spaces from OneDrive).
    If the file is locked, attempts to copy it to a temp location.

    Args:
        file_path: Path to the file to validate.

    Returns:
        Validated Path object (original or temp copy if locked).

    Raises:
        FileNotFoundError: If file does not exist.
        ValueError: If file extension is not supported.
        PermissionError: If file remains locked after retries.
    """
    path = _sanitize_path(file_path)

    if not path.exists():
        raise FileNotFoundError(f"File not found: {path}")
    if path.suffix.lower() not in SUPPORTED_EXTENSIONS:
        raise ValueError(
            f"Unsupported file type: {path.suffix}. "
            f"Supported: {', '.join(sorted(SUPPORTED_EXTENSIONS))}"
        )

    # Test if file is readable (catch OneDrive/Excel locks early)
    try:
        with open(path, "rb") as f:
            f.read(1)
    except PermissionError:
        logger.warning("File is locked, attempting temp copy...")
        path = _copy_to_temp(path)

    return path


def _detect_header_row(df_raw: pd.DataFrame, max_scan_rows: int = 20) -> int:
    """Heuristic to detect the most probable header row.

    Scans the first `max_scan_rows` rows and picks the one with
    the most non-null string values that differ from each other,
    which is a strong signal for a header row.

    Args:
        df_raw: Raw DataFrame without header assumption.
        max_scan_rows: How many rows to scan from the top.

    Returns:
        0-indexed row number of the detected header.
    """
    scan_limit = min(max_scan_rows, len(df_raw))
    if scan_limit == 0:
        return 0

    scores: list[tuple[int, float]] = []

    for row_idx in range(scan_limit):
        row = df_raw.iloc[row_idx]
        non_null_count = row.notna().sum()
        unique_count = row.nunique()
        # Score: reward unique non-null values (strings preferred)
        str_count = sum(
            1 for v in row if isinstance(v, str) and v.strip()
        )
        score = unique_count + str_count * 0.5
        scores.append((row_idx, float(score)))

    if not scores:
        return 0

    scores.sort(key=lambda x: x[1], reverse=True)
    best_row = scores[0][0]
    logger.info("Detected probable header row: %d (score: %.1f)", best_row, scores[0][1])
    return best_row


def _extract_columns(
    df: pd.DataFrame, header_row: int, sample_count: int = 5
) -> list[ColumnInfo]:
    """Extract column information from a DataFrame starting at a given header row.

    Args:
        df: Raw DataFrame.
        header_row: 0-indexed row to use as header.
        sample_count: Number of sample values per column.

    Returns:
        List of ColumnInfo objects.
    """
    # Build the dataframe with proper headers
    headers = df.iloc[header_row].tolist()
    data = df.iloc[header_row + 1 :].reset_index(drop=True)

    # Clean header names
    clean_headers: list[str] = []
    seen: dict[str, int] = {}
    for i, h in enumerate(headers):
        if pd.isna(h) or str(h).strip() == "":
            name = f"column_{i}"
        else:
            name = str(h).strip()
        # Deduplicate
        if name in seen:
            seen[name] += 1
            name = f"{name}_{seen[name]}"
        else:
            seen[name] = 0
        clean_headers.append(name)

    data.columns = clean_headers

    columns: list[ColumnInfo] = []
    for idx, col_name in enumerate(clean_headers):
        col_data = data[col_name]
        samples = col_data.dropna().head(sample_count).tolist()
        dtype_str = str(col_data.dtype)
        columns.append(
            ColumnInfo(
                index=idx,
                name=col_name,
                sample_values=samples,
                dtype=dtype_str,
            )
        )

    return columns


def analyze_file(file_path: str | Path) -> FileAnalysis:
    """Analyze an Excel or CSV file to detect sheets, headers, and columns.

    Args:
        file_path: Path to the Excel or CSV file.

    Returns:
        FileAnalysis with full inspection results.

    Raises:
        FileNotFoundError: If file not found.
        ValueError: If unsupported format.
        RuntimeError: If analysis fails.
    """
    path = validate_file(file_path)
    ext = path.suffix.lower()
    analysis = FileAnalysis(file_path=str(path), file_type=ext)

    try:
        if ext == ".xlsx":
            xls = pd.ExcelFile(str(path), engine="openpyxl")
            sheet_names = xls.sheet_names
            for sheet_name in sheet_names:
                df_raw = pd.read_excel(
                    xls, sheet_name=sheet_name, header=None, nrows=30
                )
                header_row = _detect_header_row(df_raw)
                # Re-read with detected header
                df_typed = pd.read_excel(
                    xls,
                    sheet_name=sheet_name,
                    header=None,
                    skiprows=header_row,
                )
                total_rows = len(df_typed)
                columns = _extract_columns(df_typed, header_row=0)

                sheet_info = SheetInfo(
                    name=sheet_name,
                    header_row=header_row,
                    columns=columns,
                    total_rows=total_rows,
                )
                analysis.sheets.append(sheet_info)
                logger.info(
                    "Sheet '%s': header_row=%d, columns=%d, rows=%d",
                    sheet_name,
                    header_row,
                    len(columns),
                    total_rows,
                )

        elif ext == ".csv":
            df_raw = pd.read_csv(str(path), header=None, nrows=30, encoding="utf-8")
            header_row = _detect_header_row(df_raw)
            df_typed = pd.read_csv(
                str(path), header=None, skiprows=header_row, encoding="utf-8"
            )
            total_rows = len(df_typed)
            columns = _extract_columns(df_typed, header_row=0)

            sheet_info = SheetInfo(
                name="(default)",
                header_row=header_row,
                columns=columns,
                total_rows=total_rows,
            )
            analysis.sheets.append(sheet_info)
            logger.info(
                "CSV: header_row=%d, columns=%d, rows=%d",
                header_row,
                len(columns),
                total_rows,
            )

    except PermissionError as e:
        logger.error("Permission denied for file %s: %s", path, e)
        raise PermissionError(
            f"Cannot access the file (it may be open in Excel or locked by OneDrive):\n"
            f"{path}\n\n"
            f"Solutions:\n"
            f"1. Close the file in Excel if it's open\n"
            f"2. Wait for OneDrive to finish syncing\n"
            f"3. Copy the file to your Desktop and try again"
        ) from e
    except Exception as e:
        logger.error("Failed to analyze file %s: %s", path, e)
        raise RuntimeError(f"Analysis failed for {path}: {e}") from e

    return analysis
