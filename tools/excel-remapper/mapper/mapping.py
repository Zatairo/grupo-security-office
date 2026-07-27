"""
mapper/mapping.py
-----------------
Module responsible for loading, validating, and managing
column mappings (source column -> destination field).
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class ColumnMapping:
    """Mapping for a single column from source to destination."""

    source_column: str
    destination_field: str
    default_value: str = ""
    ignored: bool = False

    def to_dict(self) -> dict[str, Any]:
        return {
            "source_column": self.source_column,
            "destination_field": self.destination_field,
            "default_value": self.default_value,
            "ignored": self.ignored,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> ColumnMapping:
        return cls(
            source_column=data.get("source_column", ""),
            destination_field=data.get("destination_field", ""),
            default_value=data.get("default_value", ""),
            ignored=data.get("ignored", False),
        )


@dataclass
class MappingConfig:
    """Complete mapping configuration."""

    source_file: str = ""
    sheet_name: str = ""
    header_row: int = 0
    mappings: list[ColumnMapping] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "source_file": self.source_file,
            "sheet_name": self.sheet_name,
            "header_row": self.header_row,
            "mappings": [m.to_dict() for m in self.mappings],
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> MappingConfig:
        mappings = [
            ColumnMapping.from_dict(m) for m in data.get("mappings", [])
        ]
        return cls(
            source_file=data.get("source_file", ""),
            sheet_name=data.get("sheet_name", ""),
            header_row=data.get("header_row", 0),
            mappings=mappings,
        )


def save_mapping(config: MappingConfig, output_path: str | Path) -> Path:
    """Save a mapping configuration to a JSON file.

    Args:
        config: MappingConfig to save.
        output_path: Path where the JSON will be written.

    Returns:
        Path to the saved file.
    """
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)

    data = config.to_dict()
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    logger.info("Mapping saved to %s", path)
    return path


def load_mapping(file_path: str | Path) -> MappingConfig:
    """Load a mapping configuration from a JSON file.

    Args:
        file_path: Path to the JSON mapping file.

    Returns:
        MappingConfig loaded from file.

    Raises:
        FileNotFoundError: If file not found.
        ValueError: If JSON is invalid or missing required fields.
    """
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"Mapping file not found: {path}")

    with open(path, "r", encoding="utf-8") as f:
        try:
            data = json.load(f)
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid JSON in {path}: {e}") from e

    config = MappingConfig.from_dict(data)
    logger.info("Mapping loaded from %s (%d mappings)", path, len(config.mappings))
    return config


def _normalize_for_match(text: str) -> str:
    """Normalize a string for fuzzy matching: lowercase, remove accents, keep alphanumeric."""
    import unicodedata

    text = text.lower().strip()
    # Remove accents
    nfkd = unicodedata.normalize("NFKD", text)
    ascii_text = "".join(c for c in nfkd if not unicodedata.combining(c))
    # Keep only alphanumeric and spaces
    result = "".join(c for c in ascii_text if c.isalnum() or c.isspace())
    return result


def _word_overlap_score(source: str, target: str) -> float:
    """Calculate a word overlap score between source and target strings.

    Returns a score between 0.0 and 1.0 based on how many words from the
    source appear in the target (and vice versa).
    """
    src_words = set(_normalize_for_match(source).split())
    tgt_words = set(_normalize_for_match(target).split())

    if not src_words or not tgt_words:
        return 0.0

    # Remove common stop words
    stop = {"de", "del", "la", "el", "los", "las", "un", "una", "y", "o", "en"}
    src_words -= stop
    tgt_words -= stop

    if not src_words or not tgt_words:
        return 0.0

    intersection = src_words & tgt_words
    union = src_words | tgt_words
    return len(intersection) / len(union) if union else 0.0


def build_mapping_from_analysis(
    source_columns: list[str],
    schema_fields: list[str],
) -> list[ColumnMapping]:
    """Build a default mapping list by matching source columns to schema fields.

    Matching priority:
    1. Exact match (case-insensitive, normalized)
    2. Substring containment
    3. Word overlap scoring (best score above threshold)

    Unmatched columns are marked as ignored.

    Args:
        source_columns: List of source column names.
        schema_fields: List of destination field names from schema.

    Returns:
        List of ColumnMapping with best-effort assignments.
    """
    mappings: list[ColumnMapping] = []
    used_fields: set[str] = set()
    WORD_SCORE_THRESHOLD = 0.25

    for col in source_columns:
        col_normalized = _normalize_for_match(col)
        matched_field = ""

        # 1. Try exact match (case-insensitive, normalized)
        for field_name in schema_fields:
            if col_normalized == _normalize_for_match(field_name):
                matched_field = field_name
                break

        # 2. Try partial/substring match if no exact match
        if not matched_field:
            for field_name in schema_fields:
                field_normalized = _normalize_for_match(field_name)
                if col_normalized in field_normalized or field_normalized in col_normalized:
                    matched_field = field_name
                    break

        # 3. Try word overlap scoring
        if not matched_field:
            best_score = 0.0
            for field_name in schema_fields:
                score = _word_overlap_score(col, field_name)
                if score > best_score and score >= WORD_SCORE_THRESHOLD:
                    best_score = score
                    matched_field = field_name

        if matched_field and matched_field not in used_fields:
            mappings.append(
                ColumnMapping(
                    source_column=col,
                    destination_field=matched_field,
                    ignored=False,
                )
            )
            used_fields.add(matched_field)
        else:
            mappings.append(
                ColumnMapping(
                    source_column=col,
                    destination_field="",
                    ignored=True,
                )
            )

    # Add unmapped schema fields with defaults
    for field_name in schema_fields:
        if field_name not in used_fields:
            mappings.append(
                ColumnMapping(
                    source_column="",
                    destination_field=field_name,
                    ignored=False,
                )
            )

    return mappings


def validate_mapping(
    config: MappingConfig,
    schema_fields: list[str],
) -> list[str]:
    """Validate a mapping configuration against a target schema.

    Args:
        config: MappingConfig to validate.
        schema_fields: Expected destination fields from schema.

    Returns:
        List of validation error messages. Empty if valid.
    """
    errors: list[str] = []
    mapped_fields: set[str] = set()

    for m in config.mappings:
        if m.ignored:
            continue
        if not m.source_column and not m.default_value:
            errors.append(
                f"Field '{m.destination_field}' has no source and no default value."
            )
        if not m.destination_field:
            errors.append(
                f"Source column '{m.source_column}' has no destination field."
            )
        if m.destination_field in mapped_fields:
            errors.append(
                f"Duplicate destination field: '{m.destination_field}'."
            )
        mapped_fields.add(m.destination_field)

    # Check for missing required fields
    for field_name in schema_fields:
        if field_name not in mapped_fields:
            errors.append(
                f"Required schema field '{field_name}' is not mapped."
            )

    return errors
