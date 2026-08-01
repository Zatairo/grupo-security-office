/**
 * Parser de formato numérico colombiano.
 *
 * Formatos soportados:
 * - "1.500.000" → 1500000 (punto como separador de miles)
 * - "1500000" → 1500000 (sin separadores)
 * - "$1.500.000" → 1500000 (con símbolo de moneda)
 * - "1.500.000,50" → 1500000.50 (coma como separador decimal)
 * - "1500000.50" → 1500000.50 (formato internacional)
 * - "€1.500" → 1500 (con símbolo de moneda europeo)
 * - "COP 1500000" → 1500000 (con prefijo de moneda)
 * - "1,500,000.00" → 1500000 (formato US, coma como miles, punto decimal)
 *
 * Reglas de detección:
 * 1. Si hay coma Y punto: el ÚLTIMO separador determina el decimal
 *    - "1,500,000.50" → punto es decimal (formato US)
 *    - "1.500.000,50" → coma es decimal (formato CO)
 * 2. Si solo hay punto: asumir separador de miles (formato CO)
 * 3. Si solo hay coma: podría ser decimal o separador de miles
 *    - Si después de la coma hay exactamente 2 dígitos → decimal
 *    - Si hay 3 dígitos → separador de miles (formato US)
 */

export interface ParseNumericOptions {
  /** Moneda detectada (para decidir formato) */
  currency?: string;

  /** Si se conoce el formato del archivo */
  format?: 'colombian' | 'international';
}

/**
 * Parsea un valor numérico en formato colombiano/internacional a number.
 * Retorna null si el valor no es parseable.
 */
export function parseNumericValue(
  value: unknown,
  options?: ParseNumericOptions,
): number | null {
  if (value === null || value === undefined) return null;

  // Ya es número
  if (typeof value === 'number') {
    return isNaN(value) ? null : value;
  }

  let str = String(value).trim();
  if (!str) return null;

  // Remover símbolos de moneda y espacios
  str = str.replace(/[\s]/g, '');
  str = str.replace(/^(COP|USD|EUR|\$|€|£)\s*/i, '');
  str = str.replace(/\s*(COP|USD|EUR|\$|€|£)$/i, '');
  str = str.replace(/^[€£]\s*/, '');

  if (!str) return null;

  // Detectar formato basado en patrón de separadores
  const hasDot = str.includes('.');
  const hasComma = str.includes(',');

  if (hasDot && hasComma) {
    // Ambos presentes: el último determina el decimal
    const lastDotIndex = str.lastIndexOf('.');
    const lastCommaIndex = str.lastIndexOf(',');

    if (lastDotIndex > lastCommaIndex) {
      // Punto es decimal (formato US): "1,500,000.50"
      str = str.replace(/,/g, '');
    } else {
      // Coma es decimal (formato CO): "1.500.000,50"
      str = str.replace(/\./g, '').replace(',', '.');
    }
  } else if (hasComma) {
    // Solo coma: detectar si es decimal o miles
    const parts = str.split(',');
    const lastPart = parts[parts.length - 1];

    if (lastPart.length === 2) {
      // Probablemente decimal: "1500000,50"
      str = str.replace(',', '.');
    } else if (lastPart.length === 3 && parts.length > 1) {
      // Probablemente separador de miles: "1,500"
      str = str.replace(/,/g, '');
    } else if (parts.length === 1) {
      // Una sola coma: tratar como decimal
      str = str.replace(',', '.');
    } else {
      // Múltiples comas con 3 dígitos: separador de miles
      str = str.replace(/,/g, '');
    }
  } else if (hasDot) {
    // Solo punto: detectar si es decimal o miles
    const parts = str.split('.');
    const lastPart = parts[parts.length - 1];

    if (lastPart.length <= 2 && parts.length === 2) {
      // Probablemente decimal: "1500000.50"
      // No hacer nada
    } else if (lastPart.length === 3 && parts.length > 1) {
      // Probablemente separador de miles (formato CO): "1.500.000"
      str = str.replace(/\./g, '');
    } else {
      // Un solo punto con >2 dímetros después: decimal
      // Ej: "3.14" → 3.14 (no cambiar)
    }
  }

  const result = parseFloat(str);
  return isNaN(result) ? null : result;
}

/**
 * Detecta si un valor parece ser numérico (aunque no esté parseado).
 * Útil para identificar columnas de precios.
 */
export function isNumericLike(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'number') return true;

  const str = String(value).trim();
  if (!str) return false;

  // Remover símbolos de moneda y espacios
  const cleaned = str.replace(/[\s$€£COPUSD]/gi, '').trim();
  if (!cleaned) return false;

  // Verificar que después de limpiar, quede un número válido
  return !isNaN(parseFloat(cleaned));
}

/**
 * Extrae el valor numérico puro de un string con formato.
 * Retorna el string limpio sin formato, para uso en displays.
 */
export function formatNumericDisplay(value: number): string {
  return new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}
