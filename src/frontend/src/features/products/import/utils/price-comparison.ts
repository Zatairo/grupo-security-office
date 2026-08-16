import type { SystemField } from '../types/import.types';
import type { Product } from '../../types/product.types';

/** Mapeo campo de precio del wizard → código de lista de precios (espejo del backend). */
export const PRICE_FIELD_TO_LIST_CODE: Record<string, string> = {
  price_instalador_iva: 'INSTALADOR_IVA',
  price_tienda_iva: 'TIENDA_IVA',
  price_dpp_oro_iva: 'DPP_ORO_IVA',
  price_dpp_platino_iva: 'DPP_PLATINO_IVA',
  price_cliente_final_iva: 'CLIENTE_FINAL_IVA',
  price_oro_sin_iva: 'ORO_SIN_IVA',
  price_installer_sin_iva: 'INSTALLER_SIN_IVA',
};

export const PRICE_FIELD_LABELS: Record<string, string> = {
  price_instalador_iva: 'Instalador (IVA)',
  price_tienda_iva: 'Tienda (IVA)',
  price_dpp_oro_iva: 'DPP Oro (IVA)',
  price_dpp_platino_iva: 'DPP Platino (IVA)',
  price_cliente_final_iva: 'Cliente Final (IVA)',
  price_oro_sin_iva: 'Oro (sin IVA)',
  price_installer_sin_iva: 'Installer (sin IVA)',
};

/** Límite de filas comparadas para no degradar la vista previa con archivos grandes. */
export const PRICE_COMPARISON_LIMIT = 50;

/** Límite máximo de filas con precio a mostrar en la vista previa. */
export const MAX_ROWS_WITH_PRICE_PREVIEW = 100;

export interface PriceComparisonRowField {
  field: SystemField;
  listCode: string;
  label: string;
  newPrice: number | null;
  currentPrice: { value: number; code: string } | null;
  /** Texto formateado del delta (null cuando no hay delta calculable). */
  deltaDisplay: string | null;
}

export interface PriceComparisonRow {
  excelRow: number;
  sku: string;
  fields: PriceComparisonRowField[];
}

export interface PriceComparisonResult {
  rows: PriceComparisonRow[];
  totalRowsWithPrices: number;
  truncated: boolean;
}

const PRICE_FIELDS: SystemField[] = [
  'price_instalador_iva',
  'price_tienda_iva',
  'price_dpp_oro_iva',
  'price_dpp_platino_iva',
  'price_cliente_final_iva',
  'price_oro_sin_iva',
  'price_installer_sin_iva',
];

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

/** Devuelve true si la fila del archivo tiene al menos un precio numérico mapeado. */
export function rowHasPrice(
  rawRow: Record<string, unknown>,
  columnMappings: Array<{ sourceColumn: string; targetField: string }>,
): boolean {
  return PRICE_FIELDS.some((field) => {
    const entry = columnMappings.find((m) => m.targetField === field);
    if (!entry) return false;
    return toNumber(rawRow[entry.sourceColumn]) !== null;
  });
}

/**
 * Extrae las filas del archivo con precios para comparar, aplicando el mapeo
 * de columnas ya confirmado por el usuario. Solo se analizan las primeras
 * PRICE_COMPARISON_LIMIT filas con precio (cota defensiva).
 */
export async function parsePriceRows(
  fileBuffer: ArrayBuffer,
  columnMappings: Array<{ sourceColumn: string; targetField: string }>,
): Promise<PriceComparisonResult> {
  const XLSX = await import('xlsx');
  const workbook = XLSX.read(fileBuffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { rows: [], totalRowsWithPrices: 0, truncated: false };
  }
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    return { rows: [], totalRowsWithPrices: 0, truncated: false };
  }
  const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: null,
  });

  const skuEntry = columnMappings.find((m) => m.targetField === 'sku');

  const rows: PriceComparisonRow[] = [];
  let totalRowsWithPrices = 0;
  let truncated = false;

  for (let i = 0; i < data.length; i++) {
    const rawRow = data[i];
    if (!rawRow) continue;
    if (!rowHasPrice(rawRow, columnMappings)) continue;

    totalRowsWithPrices++;

    if (rows.length >= PRICE_COMPARISON_LIMIT) {
      truncated = true;
      continue;
    }

    const rawSku = skuEntry ? rawRow[skuEntry.sourceColumn] : null;
    const sku = rawSku ? String(rawSku).trim().toUpperCase() : '';

    const fields: PriceComparisonRowField[] = [];
    for (const field of PRICE_FIELDS) {
      const entry = columnMappings.find((m) => m.targetField === field);
      if (!entry) continue;
      const newPrice = toNumber(rawRow[entry.sourceColumn]);
      if (newPrice === null) continue;
      fields.push({
        field,
        listCode: PRICE_FIELD_TO_LIST_CODE[field] ?? field,
        label: PRICE_FIELD_LABELS[field] ?? field,
        newPrice,
        currentPrice: null,
        deltaDisplay: null,
      });
    }

    if (fields.length > 0) {
      rows.push({ excelRow: i + 2, sku, fields });
    }
  }

  return { rows, totalRowsWithPrices, truncated };
}

/** Completa los precios actuales de cada fila desde el mapa SKU → producto. */
export function enrichWithCurrentPrices(
  rows: PriceComparisonRow[],
  productsBySku: Map<string, Product>,
): PriceComparisonRow[] {
  return rows.map((row) => {
    const product = productsBySku.get(row.sku);
    if (!product) return row;
    return {
      ...row,
      fields: row.fields.map((f) => {
        const price = product.prices.find((p) => p.priceList.code === f.listCode);
        const currentPrice = price
          ? { value: Number(price.value), code: price.priceList.code }
          : null;
        return {
          ...f,
          currentPrice,
          deltaDisplay: formatDeltaDisplay(
            computeDeltaPercent(currentPrice?.value ?? null, f.newPrice),
            currentPrice,
          ),
        };
      }),
    };
  });
}

export function computeDeltaPercent(
  currentPrice: number | null,
  newPrice: number | null,
): number | null {
  if (currentPrice === null || newPrice === null || currentPrice === 0) return null;
  return ((newPrice - currentPrice) / currentPrice) * 100;
}

/** Formatea la visualización del delta para mostrar al usuario.
 *  Retorna strings como:
 *  - "Nuevo $10 (antes $12)" cuando hay precio actual
 *  - "SIN PRECIO ACTUAL" cuando no hay precio actual
 *  - "NUEVO" cuando solo hay precio nuevo (usado en el badge) */
export function formatDeltaDisplay(
  delta: number | null,
  currentPriceInfo?: { value: number; code: string } | null,
): string | null {
  if (delta === null) return null;

  if (!currentPriceInfo) {
    // No hay precio actual en el catálogo
    return 'SIN PRECIO ACTUAL';
  }

  const currentValue = currentPriceInfo.value;
  const newValue = currentValue * (1 + delta / 100);

  // Mostrar: "Nuevo $10 (antes $12)"
  return `Nuevo $${newValue.toFixed(2)} (antes $${currentValue.toFixed(2)})`;
}