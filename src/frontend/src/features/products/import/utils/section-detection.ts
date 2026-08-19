import type { ImportColumnValueInfo, ImportSection, ImportSectionDecision } from '../types/import.types';

export interface DistinctValue {
  value: string;
  count: number;
}

/** Normaliza un nombre de categoría para comparar equivalencias (sin tildes/espacios/guiones). */
export function normalizeSectionName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[-_/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Obtiene los valores distintos (con conteo) de la columna mapeada a categoría.
 * Orden defensivo:
 *   1. distinctByColumn (contrato real del preview, prioridad máxima).
 *   2. columnInfo.distinctValues (contrato legacy).
 *   3. columnInfo.sample_values (fallback del contrato legacy).
 *   4. parseo local del fileBuffer con xlsx (defensivo: el runtime actual no lo entrega).
 */
export async function detectSectionValues(
  buffer: ArrayBuffer | null,
  sourceColumn: string | undefined,
  columnInfo?: ImportColumnValueInfo,
  distinctByColumn?: Array<{ value: string; count: number }>,
): Promise<DistinctValue[]> {
  if (sourceColumn) {
    if (distinctByColumn && distinctByColumn.length > 0) {
      return distinctByColumn
        .map((v) => ({ value: String(v.value ?? '').trim(), count: Number(v.count) || 0 }))
        .filter((v) => v.value !== '')
        .slice(0, 50);
    }
    if (columnInfo?.distinctValues && columnInfo.distinctValues.length > 0) {
      return columnInfo.distinctValues
        .map((v) => ({ value: String(v.value ?? '').trim(), count: Number(v.count) || 0 }))
        .filter((v) => v.value !== '')
        .slice(0, 50);
    }
    if (columnInfo?.sample_values && columnInfo.sample_values.length > 0) {
      const unique = Array.from(new Set(columnInfo.sample_values.map((v) => String(v ?? '').trim()).filter(Boolean)));
      return unique.map((value) => ({ value, count: 1 }));
    }
  }

  if (!buffer || !sourceColumn) return [];

  try {
    const XLSX = await import('xlsx');
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return [];
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return [];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });

    const counts = new Map<string, number>();
    for (const row of rows) {
      let raw = row[sourceColumn];
      if (raw === null || raw === undefined) {
        raw = row[Object.keys(row).find((k) => k.toLowerCase() === sourceColumn.toLowerCase()) ?? ''];
      }
      if (raw === null || raw === undefined) continue;
      const val = String(raw).trim();
      if (!val) continue;
      counts.set(val, (counts.get(val) ?? 0) + 1);
    }

    return Array.from(counts.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 50);
  } catch {
    return [];
  }
}

export function buildSectionsFromValues(
  values: DistinctValue[],
  categories: Array<{ id: string; name: string }>,
): ImportSection[] {
  const existing = new Map(categories.map((c) => [normalizeSectionName(c.name), c.id]));
  return values.map((v, index) => {
    const normalized = normalizeSectionName(v.value);
    const matchId = existing.get(normalized);
    return {
      key: `section-${index}-${normalized}`,
      values: [v.value],
      name: v.value,
      count: v.count,
      exists: Boolean(matchId),
      existingCategoryId: matchId,
      selected: true,
      original: true,
    };
  });
}

/**
 * Convierte las secciones del store en las decisiones que el backend espera en el execute.
 * - Una sección fusionada genera UN item por cada valor fuente original (`values[]`),
 *   todos con el mismo `targetName` final (todas las filas que traen cualquiera de esos
 *   valores terminan en la categoría final).
 * - `sourceValue` usa el valor exacto de la celda (trim), sin normalizar: el backend
 *   normaliza case-insensitive por su cuenta.
 * - `action` se deriva de `selected` (skip si está descartada) y `exists` (reuse vs create).
 */
export function buildImportSectionDecisions(sections: ImportSection[]): ImportSectionDecision[] {
  const decisions: ImportSectionDecision[] = [];
  for (const section of sections) {
    const action: ImportSectionDecision['action'] = !section.selected
      ? 'skip'
      : section.exists
        ? 'reuse'
        : 'create';
    const targetName = section.name.trim();
    for (const raw of section.values) {
      const sourceValue = raw.trim();
      if (!sourceValue) continue;
      decisions.push({ sourceValue, targetName, action });
    }
  }
  return decisions;
}