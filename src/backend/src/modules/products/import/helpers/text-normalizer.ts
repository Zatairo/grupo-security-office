/**
 * Normalización de texto para importación de productos.
 *
 * Limpieza estándar aplicada a todos los campos de texto:
 * - Trim de espacios
 * - Colapso de espacios múltiples
 * - Normalización de caracteres especiales
 * - Capitalización de nombres propios (marcas, categorías)
 */

/**
 * Normaliza un campo de texto genérico.
 * Aplica limpieza básica: trim, colapso de espacios, normalización Unicode.
 */
export function normalizeText(value: unknown): string {
  if (value === null || value === undefined) return '';

  let str = String(value).trim();

  // Normalizar Unicode (NFC) para consistencia
  str = str.normalize('NFC');

  // Colapsar espacios múltiples en uno solo
  str = str.replace(/\s+/g, ' ');

  // Remover caracteres de control (excepto newline)
  str = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  return str.trim();
}

/**
 * Normaliza un SKU: trim, mayúsculas, sin espacios internos.
 */
export function normalizeSku(value: unknown): string {
  if (value === null || value === undefined) return '';

  return String(value)
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .normalize('NFC');
}

/**
 * Normaliza un nombre de marca: trim, capitalización de primera letra.
 * Ejemplo: "hikvision" → "Hikvision", "HIKVISION" → "Hikvision"
 */
export function normalizeBrandName(value: unknown): string {
  const text = normalizeText(value);
  if (!text) return '';

  return capitalizeFirst(text);
}

/**
 * Normaliza un nombre de categoría: trim, capitalización de primera letra.
 * Ejemplo: "cctv" → "Cctv", "CÁMARAS IP" → "Cámaras ip"
 */
export function normalizeCategoryName(value: unknown): string {
  const text = normalizeText(value);
  if (!text) return '';

  return capitalizeFirst(text);
}

/**
 * Normaliza un nombre de producto: trim, espacios colapsados.
 * NO aplica capitalización (los nombres de producto pueden tener formato propio).
 */
export function normalizeProductName(value: unknown): string {
  return normalizeText(value);
}

/**
 * Normaliza una descripción: trim, espacios colapsados, preserva newlines.
 */
export function normalizeDescription(value: unknown): string {
  if (value === null || value === undefined) return '';

  let str = String(value).trim();

  // Normalizar Unicode
  str = str.normalize('NFC');

  // Colapsar espacios pero preservar saltos de línea
  str = str.replace(/[^\S\n]+/g, ' ');

  // Colapsar múltiples newlines en uno solo
  str = str.replace(/\n{3,}/g, '\n\n');

  // Remover caracteres de control (excepto newline y tab)
  str = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  return str.trim();
}

/**
 * Genera un slug a partir de un nombre.
 * Minúsculas, sin acentos, espacios→guiones, sin caracteres especiales.
 *
 * Ejemplo:
 * - "Cámaras IP Hikvision" → "camaras-ip-hikvision"
 * - "  LED  Bulb  " → "led-bulb"
 * - "Control de Acceso" → "control-de-acceso"
 */
export function generateSlug(value: unknown): string {
  const text = normalizeText(value);
  if (!text) return '';

  return text
    .toLowerCase()
    // Normalizar acentos
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // Reemplazar caracteres no alfanuméricos con guiones
    .replace(/[^a-z0-9]+/g, '-')
    // Colapsar guiones múltiples
    .replace(/-+/g, '-')
    // Remover guiones al inicio y final
    .replace(/^-|-$/g, '');
}

/**
 * Capitaliza la primera letra de un string.
 * "hikvision" → "Hikvision"
 * "HIKVISION" → "Hikvision" (primera mayúscula, resto minúsculas)
 */
function capitalizeFirst(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}
