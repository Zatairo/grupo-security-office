import type { SystemField, ColumnMappingEntry } from '../types/import.types';

export interface ClientValidationError {
  field: string;
  code: string;
  message: string;
}

export function validateRowClient(
  rawRow: Record<string, unknown>,
  mappings: ColumnMappingEntry[],
  seenSkus: Map<string, number>,
  rowIndex: number,
): ClientValidationError[] {
  const errors: ClientValidationError[] = [];

  const getValue = (field: SystemField): unknown => {
    const entry = mappings.find(m => m.targetField === field);
    if (!entry) return null;
    return rawRow[entry.sourceColumn] ?? null;
  };

  const skuValue = getValue('sku');
  const sku = skuValue ? String(skuValue).trim().toUpperCase() : '';

  if (!sku) {
    errors.push({ field: 'sku', code: 'SKU_REQUIRED', message: 'El SKU es requerido' });
  } else {
    const existingRow = seenSkus.get(sku);
    if (existingRow !== undefined) {
      errors.push({ field: 'sku', code: 'SKU_DUPLICATE', message: `SKU duplicado en fila ${existingRow + 2}` });
    } else {
      seenSkus.set(sku, rowIndex);
    }
  }

  const nameValue = getValue('name');
  const name = nameValue ? String(nameValue).trim() : '';
  if (!name) {
    errors.push({ field: 'name', code: 'NAME_REQUIRED', message: 'El nombre es requerido' });
  }

  const categoryValue = getValue('category');
  const category = categoryValue ? String(categoryValue).trim() : '';
  if (!category) {
    errors.push({ field: 'category', code: 'CATEGORY_REQUIRED', message: 'La categoría es requerida' });
  }

  const brandValue = getValue('brand');
  const brand = brandValue ? String(brandValue).trim() : '';
  if (!brand) {
    errors.push({ field: 'brand', code: 'BRAND_REQUIRED', message: 'La marca es requerida' });
  }

  return errors;
}
