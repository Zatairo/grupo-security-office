import { BadRequestException } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { ImportSourceAdapter, ParseResult, RawRow } from '../interfaces/import-source.adapter';

/**
 * Adaptador de importación para archivos Excel (.xlsx, .xls) y CSV (.csv).
 *
 * Utiliza SheetJS (xlsx) para parsear archivos en modo array (header: 1)
 * y auto-detecta la fila de headers buscando la fila con más celdas de texto no vacías.
 *
 * Esto permite manejar archivos donde la primera fila contiene metadata
 * (como "Ya", "$4,850") y los headers reales están en filas posteriores.
 *
 * Soporta:
 * - Archivos .xlsx (Office Open XML)
 * - Archivos .xls (Office 97-2003)
 * - Archivos .csv (valores separados por coma/tab/punto y coma)
 * - Múltiples hojas (usa la primera hoja por defecto)
 * - Headers vacíos, "Unnamed", "__EMPTY" (los omite)
 * - Auto-detección de fila de headers (hasta 10 filas)
 */
export class ExcelAdapter implements ImportSourceAdapter {
  readonly name = 'excel';
  readonly supportedExtensions = ['.xlsx', '.xls', '.csv'];

  /** Máximo de filas a examinar para auto-detectar headers */
  private readonly MAX_HEADER_SCAN_ROWS = 10;

  parse(buffer: Buffer, fileName: string): ParseResult {
    if (!buffer || buffer.length === 0) {
      throw new BadRequestException('El archivo está vacío');
    }

    // Validar extensión
    const ext = this.getExtension(fileName);
    if (!this.supportedExtensions.includes(ext)) {
      throw new BadRequestException(
        `Formato no soportado: ${ext}. Use: ${this.supportedExtensions.join(', ')}`,
      );
    }

    // Validar tamaño máximo (10MB)
    const MAX_SIZE = 10 * 1024 * 1024;
    if (buffer.length > MAX_SIZE) {
      throw new BadRequestException(
        `El archivo excede el tamaño máximo de ${MAX_SIZE / 1024 / 1024}MB`,
      );
    }

    let workbook: XLSX.WorkBook;
    try {
      workbook = XLSX.read(buffer, { type: 'buffer' });
    } catch {
      throw new BadRequestException(
        'No se pudo leer el archivo. Verifique que no esté corrupto.',
      );
    }

    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      throw new BadRequestException('El archivo no contiene hojas de cálculo');
    }

    // Usar la primera hoja
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    if (!sheet) {
      throw new BadRequestException('La hoja de cálculo está vacía');
    }

    // PASO 1: Parsear como arrays (cada fila es un array de celdas)
    // raw: false → valores formateados como strings
    // header: 1 → retorna arrays, no objetos
    const rawArrays: unknown[][] = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: null,
      raw: false,
    });

    if (rawArrays.length === 0) {
      throw new BadRequestException('La hoja de cálculo no contiene datos');
    }

    // PASO 2: Auto-detectar la fila de headers
    const headerRowIndex = this.detectHeaderRow(rawArrays);

    // PASO 3: Extraer headers de esa fila
    const headerRow = rawArrays[headerRowIndex];
    if (!headerRow || headerRow.length === 0) {
      throw new BadRequestException('No se pudieron detectar headers en el archivo');
    }

    // PASO 4: Limpiar headers
    const cleanHeaders = this.cleanHeaders(headerRow);

    // PASO 5: Construir objetos de datos desde las filas restantes
    const dataRows = rawArrays.slice(headerRowIndex + 1);
    const rows: RawRow[] = [];

    for (const rawRow of dataRows) {
      const obj: RawRow = Object.create(null) as RawRow;
      let hasData = false;

      for (let colIdx = 0; colIdx < cleanHeaders.length; colIdx++) {
        const header = cleanHeaders[colIdx];
        const value = colIdx < rawRow.length ? rawRow[colIdx] : null;

        if (value !== null && value !== undefined && String(value).trim() !== '') {
          hasData = true;
        }
        // Mitigación Prototype Pollution: objeto sin prototipo + denylist ya filtrada en cleanHeaders
        obj[header] = value;
      }

      // Solo incluir filas con al menos un dato
      if (hasData) {
        rows.push(obj);
      }
    }

    if (rows.length === 0) {
      throw new BadRequestException('La hoja de cálculo no contiene datos después de los headers');
    }

    return {
      rows,
      headers: cleanHeaders,
      fileName,
      fileSize: buffer.length,
      totalRows: rows.length,
    };
  }

  /**
   * Auto-detecta la fila que contiene los headers.
   *
   * Estrategia: para cada una de las primeras N filas, cuenta cuántas celdas
   * contienen texto no vacío (no numérico puro). La fila con más celdas
   * de texto gana. Esto descarta filas de metadata que suelen tener
   * solo 1-2 valores numéricos o de texto corto.
   */
  private detectHeaderRow(rawArrays: unknown[][]): number {
    const maxRows = Math.min(this.MAX_HEADER_SCAN_ROWS, rawArrays.length);
    let bestRow = 0;
    let bestScore = -1;

    for (let i = 0; i < maxRows; i++) {
      const row = rawArrays[i];
      if (!row) continue;

      const score = this.scoreHeaderRow(row);
      if (score > bestScore) {
        bestScore = score;
        bestRow = i;
      }
    }

    return bestRow;
  }

  /**
   * Evalúa qué tan probable es que una fila sea la fila de headers.
   *
   * Estrategia: cuenta celdas no vacías de texto (no numérico puro) y
   * aplica bonificaciones. No penaliza celdas vacías al final de la fila
   * (trailing nulls) ya que los archivos Excel suelen tener columnas vacías
   * al final de cada fila. Solo penaliza gaps vacíos ENTRE datos.
   *
   * Filas de metadata típicas ("Ya", "$4,850") → pocos valores de texto → score bajo.
   * Filas de headers ("REFERENCIA", "DESCRIPCION", "PRECIO INSTALADOR") → score alto.
   */
  private scoreHeaderRow(row: unknown[]): number {
    // Recortar trailing nulls/empty
    let lastNonEmpty = row.length - 1;
    while (lastNonEmpty >= 0 && (row[lastNonEmpty] === null || row[lastNonEmpty] === undefined || String(row[lastNonEmpty]).trim() === '')) {
      lastNonEmpty--;
    }
    const trimmedRow = row.slice(0, lastNonEmpty + 1);

    if (trimmedRow.length === 0) return -1;

    let score = 0;
    let nonEmptyCells = 0;
    let textCells = 0;

    for (const cell of trimmedRow) {
      if (cell === null || cell === undefined || String(cell).trim() === '') {
        // Gap penalty: -0.3 for empty cells (but not as harsh as before)
        score -= 0.3;
        continue;
      }

      nonEmptyCells++;
      const strVal = String(cell).trim();

      // Si es puramente numérico/monetario, es menos probable que sea header
      const isNumeric = /^[\d.,\s$€£]+$/.test(strVal);
      if (isNumeric) {
        score += 0.2;
      } else {
        // Texto no numérico → más probable que sea header
        score += 1;
        textCells++;
      }

      // Bonus por longitud razonable de header (>2 chars)
      if (strVal.length > 2) {
        score += 0.3;
      }
    }

    // Strong bonus: headers suelen tener muchas celdas de texto
    if (textCells >= 10) {
      score += 5;
    } else if (textCells >= 5) {
      score += 3;
    } else if (textCells >= 3) {
      score += 1;
    }

    // Strong bonus: ratio de celdas no vacías sobre total (trailing-recortado)
    const fillRatio = nonEmptyCells / trimmedRow.length;
    if (fillRatio > 0.5) {
      score += 3;
    } else if (fillRatio > 0.3) {
      score += 1;
    }

    return score;
  }

  /**
   * Limpia y normaliza los headers extraídos de una fila.
   *
   * Reglas:
   * - Colapsar newlines y whitespace múltiple en un espacio
   * - Filtrar headers vacíos, "Unnamed", "__EMPTY"
   * - Deduplicar headers que colapsan al mismo nombre
   * - Mantener el orden original
   */
  private cleanHeaders(headerRow: unknown[]): string[] {
    const cleaned: string[] = [];
    const seen = new Set<string>();
    // Mitigación CVE xlsx Prototype Pollution (GHSA-4r6h-8v6p-xvw6): denylist de keys peligrosas
    const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

    for (const cell of headerRow) {
      if (cell === null || cell === undefined) continue;

      let header = String(cell).trim();
      if (!header) continue;

      // Mitigación Prototype Pollution: descartar headers peligrosos
      if (DANGEROUS_KEYS.has(header)) continue;
      if (DANGEROUS_KEYS.has(header.toLowerCase())) continue;

      // Colapsar newlines y whitespace
      header = header.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();

      // Filtrar basura de SheetJS
      if (!header) continue;
      if (header.startsWith('Unnamed')) continue;
      if (header.startsWith('__EMPTY')) continue;
      if (header.toLowerCase() === 'nan') continue;
      if (header.toLowerCase() === 'undefined') continue;

      // Deduplicar (si ya vimos este header limpio, agregar sufijo)
      let finalHeader = header;
      let suffix = 1;
      while (seen.has(finalHeader)) {
        finalHeader = `${header}_${suffix}`;
        suffix++;
      }

      seen.add(finalHeader);
      cleaned.push(finalHeader);
    }

    return cleaned;
  }

  /**
   * Extrae la extensión del archivo (en minúsculas, con punto).
   */
  private getExtension(fileName: string): string {
    const lastDot = fileName.lastIndexOf('.');
    if (lastDot === -1) return '';
    return fileName.slice(lastDot).toLowerCase();
  }
}
