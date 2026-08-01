import { Injectable } from '@nestjs/common';
import {
  NormalizedRow,
  PriceEntry,
  ValidatedRow,
  ImportContext,
  IvaMode,
} from '../interfaces/import-context';
import { SystemField } from '../interfaces/column-mapping';
import { RawRow } from '../interfaces/import-source.adapter';
import {
  normalizeSku,
  normalizeProductName,
  normalizeCategoryName,
  normalizeBrandName,
  normalizeDescription,
} from '../helpers/text-normalizer';
import { parseNumericValue } from '../helpers/numeric-parser';

/**
 * Mapeo de campos de precio a códigos de lista de precios.
 */
const PRICE_FIELD_MAP: Record<string, { code: string; name: string; ivaMode: IvaMode }> = {
  price_instalador_iva: { code: 'INSTALADOR_IVA', name: 'Instalador (con IVA)', ivaMode: 'with_iva' },
  price_tienda_iva: { code: 'TIENDA_IVA', name: 'Tienda (con IVA)', ivaMode: 'with_iva' },
  price_dpp_oro_iva: { code: 'DPP_ORO_IVA', name: 'DPP Oro (con IVA)', ivaMode: 'with_iva' },
  price_dpp_platino_iva: { code: 'DPP_PLATINO_IVA', name: 'DPP Platino (con IVA)', ivaMode: 'with_iva' },
  price_cliente_final_iva: { code: 'CLIENTE_FINAL_IVA', name: 'Cliente Final (con IVA)', ivaMode: 'with_iva' },
  price_oro_sin_iva: { code: 'ORO_SIN_IVA', name: 'Oro (sin IVA)', ivaMode: 'without_iva' },
  price_installer_sin_iva: { code: 'INSTALLER_SIN_IVA', name: 'Installer (sin IVA)', ivaMode: 'without_iva' },
};

/**
 * Servicio de normalización de filas.
 *
 * Toma filas validadas y las convierte en objetos NormalizedRow
 * listos para inserción en base de datos.
 *
 * Responsabilidades:
 * - Normalizar texto (trim, capitalización, Unicode)
 * - Parsear precios a números
 * - Detectar si es actualización (SKU existente)
 * - Resolver categorías y marcas a IDs (en batch execution)
 */
@Injectable()
export class RowNormalizerService {
  /**
   * Normaliza todas las filas validadas del contexto.
   * Solo procesa filas válidas (isValid = true).
   */
  normalizeAll(ctx: ImportContext): NormalizedRow[] {
    return ctx.validatedRows
      .filter((row) => row.isValid)
      .map((row) => this.normalizeRow(row, ctx));
  }

  /**
   * Normaliza una fila individual.
   */
  normalizeRow(validatedRow: ValidatedRow, ctx: ImportContext): NormalizedRow {
    const raw = validatedRow.rawData;
    const mapping = ctx.columnMapping;

    // Extraer valores mapeados
    const getValue = (field: SystemField): unknown => {
      const entry = mapping.entries.find((e) => e.targetField === field);
      if (!entry) return null;
      return raw[entry.sourceColumn] ?? null;
    };

    // Normalizar campos de texto
    const sku = normalizeSku(getValue('sku'));
    const name = normalizeProductName(getValue('name'));
    const description = normalizeDescription(getValue('description'));
    const categoryName = normalizeCategoryName(getValue('category'));
    const brandName = normalizeBrandName(getValue('brand'));

    // Normalizar precios
    const prices = this.normalizePrices(getValue, mapping.entries);

    // Normalizar specs técnicas
    const technicalSpecs = this.normalizeSpecs(getValue('technicalSpecs'));

    // NUEVO: Recolectar atributos extra (columnas mapeadas a __extra)
    const extraAttributes = this.normalizeExtras(raw, mapping.entries);

    // Detectar si el SKU ya existe (se resolverá en batch execution)
    const isUpdate = false; // Se resolve en batch executor
    const existingProductId = undefined; // Se resolve en batch executor

    return {
      rowIndex: validatedRow.rowIndex,
      sku,
      name,
      description: description || undefined,
      categoryName,
      brandName,
      prices,
      technicalSpecs,
      extraAttributes,
      isUpdate,
      existingProductId,
    };
  }

  /**
   * Extrae y normaliza todos los precios de una fila.
   */
  private normalizePrices(
    getValue: (field: SystemField) => unknown,
    _entries: Array<{ targetField: SystemField }>,
  ): PriceEntry[] {
    const prices: PriceEntry[] = [];

    for (const [field, config] of Object.entries(PRICE_FIELD_MAP)) {
      const rawValue = getValue(field as SystemField);
      if (rawValue === null || rawValue === undefined || rawValue === '') continue;

      const numericValue = parseNumericValue(rawValue);
      if (numericValue === null) continue;

      // Solo incluir precios con valor > 0
      if (numericValue <= 0) continue;

      prices.push({
        priceListCode: config.code,
        priceListName: config.name,
        value: numericValue,
        ivaMode: config.ivaMode,
        currency: 'COP',
      });
    }

    return prices;
  }

  /**
   * Intenta parsear specs técnicas desde un valor crudo.
   * Si ya es un objeto, lo retorna tal cual.
   * Si es un string JSON válido, lo parsea.
   * Si no, retorna undefined.
   */
  private normalizeSpecs(
    value: unknown,
  ): Record<string, unknown> | undefined {
    if (!value) return undefined;

    if (typeof value === 'object' && value !== null) {
      return value as Record<string, unknown>;
    }

    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (typeof parsed === 'object' && parsed !== null) {
          return parsed;
        }
      } catch {
        // No es JSON válido, ignorar
      }
    }

    return undefined;
  }

  /**
   * NUEVO: Recolecta columnas mapeadas a __extra y las normaliza
   * en un objeto plano de atributos del proveedor.
   *
   * Reglas:
   * - Solo valores primitivos (string, number, boolean)
   * - Keys normalizadas a UPPER_SNAKE_CASE
   * - Máximo 50 entradas
   * - Se ignora vacío/null/undefined
   */
  private normalizeExtras(
    raw: RawRow,
    entries: Array<{ sourceColumn: string; targetField: SystemField }>,
  ): Record<string, string | number | boolean> | undefined {
    const extras: Record<string, string | number | boolean> = {};
    const MAX_EXTRAS = 50;
    let count = 0;

    for (const entry of entries) {
      if (entry.targetField !== '__extra') continue;
      if (count >= MAX_EXTRAS) break;

      const value = raw[entry.sourceColumn];
      if (value === null || value === undefined || value === '') continue;

      // Normalizar key: UPPER_SNAKE_CASE, solo alfanuméricos y guiones bajos
      const key = entry.sourceColumn
        .trim()
        .replace(/[\r\n]+/g, ' ')
        .replace(/\s+/g, '_')
        .replace(/[^a-zA-Z0-9_]/g, '')
        .toUpperCase();

      if (!key) continue;

      // Normalizar valor a primitivo
      const numericParsed = parseNumericValue(String(value));
      if (numericParsed !== null && numericParsed > 0) {
        extras[key] = numericParsed;
      } else {
        const str = String(value).trim();
        if (str) {
          extras[key] = str;
        }
      }
      count++;
    }

    return Object.keys(extras).length > 0 ? extras : undefined;
  }
}
