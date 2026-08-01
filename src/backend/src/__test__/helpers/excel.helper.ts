import * as XLSX from 'xlsx';

/**
 * Helper para generar buffers de Excel/CSV mock en tests.
 * Utiliza SheetJS (xlsx) para crear buffers reales.
 */

export const HIKVISION_MOCK_HEADERS = [
  'REFERENCIA',
  'DESCRIPCION',
  'PRECIO INSTALADOR CON IVA',
  'PRECIO TIENDA CON IVA',
  'PRECIO DPP ORO CON IVA',
  'PRECIO DPP PLATINO CON IVA',
  'PRECIO CLIENTE FINAL CON IVA',
  'ORO SIN IVA',
  'INSTALLER SIN IVA',
];

/**
 * Crea un buffer Excel (.xlsx) a partir de headers y filas.
 */
export function createExcelBuffer(
  headers: string[],
  rows: Record<string, unknown>[],
): Buffer {
  const ws = XLSX.utils.json_to_sheet(rows, { header: headers });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Hoja1');
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}

/**
 * Crea un buffer CSV a partir de headers y filas.
 */
export function createCsvBuffer(
  headers: string[],
  rows: Record<string, unknown>[],
): Buffer {
  const ws = XLSX.utils.json_to_sheet(rows, { header: headers });
  const csv = XLSX.utils.sheet_to_csv(ws);
  return Buffer.from(csv, 'utf-8');
}

/**
 * Crea un buffer Excel vacío (solo headers, sin filas de datos).
 */
export function createEmptyExcelBuffer(): Buffer {
  return createExcelBuffer(['SKU', 'Nombre'], []);
}

/**
 * Crea un buffer corrupto (datos basura).
 */
export function createCorruptedBuffer(): Buffer {
  return Buffer.from('esto no es un archivo Excel válido, solo texto random');
}

/**
 * Genera filas mock que simulan datos reales del proveedor Hikvision.
 */
export function createHikvisionMockRows(count: number): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];

  for (let i = 1; i <= count; i++) {
    rows.push({
      REFERENCIA: `DS-2CD2${String(i).padStart(3, '0')}G2-I`,
      DESCRIPCION: `Cámara IP Bullet ${i}MP - Hikvision Turbo`,
      'PRECIO INSTALADOR CON IVA': `${1500000 + i * 10000}`,
      'PRECIO TIENDA CON IVA': `${1800000 + i * 12000}`,
      'PRECIO DPP ORO CON IVA': `${1200000 + i * 8000}`,
      'PRECIO DPP PLATINO CON IVA': `${1100000 + i * 7000}`,
      'PRECIO CLIENTE FINAL CON IVA': `${2200000 + i * 15000}`,
      'ORO SIN IVA': `${1050000 + i * 6000}`,
      'INSTALLER SIN IVA': `${1300000 + i * 9000}`,
    });
  }

  return rows;
}

/**
 * Crea un buffer Excel con el formato completo de Hikvision (incluyendo columnas basura).
 */
export function createHikvisionMockExcel(
  dataRows: number = 3,
  includeGarbageColumns: boolean = true,
): Buffer {
  const rows = createHikvisionMockRows(dataRows);

  if (includeGarbageColumns) {
    // Agregar columnas "Unnamed" y basura como en el archivo real
    for (const row of rows) {
      (row as any)['Unnamed: 9'] = '';
      (row as any)['Columna1'] = 'basura';
      (row as any)['Columna3'] = 'otra basura';
    }
  }

  const headers = includeGarbageColumns
    ? [...HIKVISION_MOCK_HEADERS, 'Unnamed: 9', 'Columna1', 'Columna3']
    : HIKVISION_MOCK_HEADERS;

  return createExcelBuffer(headers, rows);
}
