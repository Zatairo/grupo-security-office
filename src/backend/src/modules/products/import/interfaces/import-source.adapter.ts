/**
 * Interfaz abstracta para adaptadores de fuentes de importación.
 * Permite soportar múltiples formatos (Excel, CSV, ERP Yéminus, etc.)
 * sin acoplar el pipeline a una fuente específica.
 *
 * Cada adaptador:
 * 1. Parsea el buffer crudo en un array de filas genéricas (Record<string, unknown>)
 * 2. Detecta y reporta los headers encontrados
 * 3. Retorna metadatos del archivo (nombre, tamaño, cantidad de filas)
 */
export interface RawRow {
  [columnHeader: string]: unknown;
}

export interface ParseResult {
  /** Filas de datos parseadas (excluyendo headers) */
  rows: RawRow[];
  /** Headers detectados en el archivo */
  headers: string[];
  /** Nombre original del archivo */
  fileName: string;
  /** Tamaño del archivo en bytes */
  fileSize: number;
  /** Cantidad total de filas de datos (sin contar headers) */
  totalRows: number;
}

export interface ImportSourceAdapter {
  /** Nombre identificador del adaptador (ej: 'excel', 'csv', 'yeminus') */
  readonly name: string;

  /** Tipos de archivo soportados (extensiones) */
  readonly supportedExtensions: string[];

  /**
   * Parsea el buffer crudo del archivo y retorna filas genéricas.
   * @param buffer - Contenido del archivo como Buffer
   * @param fileName - Nombre original del archivo
   * @throws Si el formato no es soportado o el archivo está corrupto
   */
  parse(buffer: Buffer, fileName: string): ParseResult;
}
