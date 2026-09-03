/**
 * Normalización pura de SKU Hikvision.
 *
 * Reglas:
 * - Convertir a mayúsculas.
 * - Eliminar espacios al inicio/final y espacios internos.
 * - Convertir guion largo/en dash/em dash a `-`.
 * - Convertir `_` a `-`.
 * - Colapsar guiones consecutivos en uno solo.
 * - No eliminar letras, números, puntos, paréntesis ni sufijos.
 * - No recortar ni inferir variantes regionales.
 * - Devolver `null` cuando el SKU sea vacío tras normalización.
 * - Mantener el SKU original sin alteración en los contratos de resultado (responsabilidad del caller).
 */

export function normalizeHikvisionSku(value: unknown): string | null {
  if (value === null || value === undefined) return null;

  let str = String(value);

  // Trim inicial/final
  str = str.trim();

  if (!str) return null;

  // Normalizar Unicode NFC para consistencia
  str = str.normalize('NFC');

  // Convertir guion largo / en dash (U+2013) y em dash (U+2014) y otros variantes a "-"
  // Incluye: \u2010 hyphen, \u2011 non-breaking hyphen, \u2012 figure dash, \u2013 en dash, \u2014 em dash, \u2212 minus sign
  str = str.replace(/[\u2010\u2011\u2012\u2013\u2014\u2212\u2015\uFE58\uFE63\uFF0D]/g, '-');

  // Convertir "_" a "-"
  str = str.replace(/_/g, '-');

  // Eliminar todos los espacios internos (incluye tabs, etc.)
  str = str.replace(/\s+/g, '');

  // Colapsar guiones consecutivos en uno solo
  str = str.replace(/-+/g, '-');

  // Convertir a mayúsculas
  str = str.toUpperCase();

  // Si tras normalización queda vacío o solo guiones, tratar como null si era solo espacios/guiones?
  // Spec: devolver null cuando SKU vacío tras normalización. Un "-" solo vendría de " - " → después de trim y colapso queda "-"
  // Consideramos "-" como SKU válido técnicamente, pero si original era solo guiones/espacios lo dejamos como "-"?
  // La spec dice vacío o solo espacios → null. Mantenemos "-" como normalizado (no vacío).
  if (!str) return null;

  // Si queda cadena vacía tras eliminar todo (no debería pasar), null
  // Adicional: si solo contenía espacios ya retornamos null arriba.
  return str;
}
