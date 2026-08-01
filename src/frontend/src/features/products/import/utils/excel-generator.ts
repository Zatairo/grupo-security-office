import type { ValidationRowError } from '../types/import.types';

export async function exportValidationErrors(errors: ValidationRowError[], fileName: string): Promise<void> {
  const XLSX = await import('xlsx');

  const data = errors.map(err => ({
    'Fila Excel': err.excelRow,
    'SKU': err.sku || 'N/A',
    'Errores': err.errors.map(e => e.message).join('; '),
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Errores');

  ws['!cols'] = [
    { wch: 10 },
    { wch: 20 },
    { wch: 60 },
  ];

  XLSX.writeFile(wb, `${fileName.replace(/\.[^.]+$/, '')}_errores.xlsx`);
}

export async function exportImportSummary(
  params: {
    created: number;
    updated: number;
    skipped: number;
    errors: Array<{ sku: string; error: string }>;
  },
  fileName: string,
): Promise<void> {
  const XLSX = await import('xlsx');

  const summaryData = [
    { Concepto: 'Productos creados', Valor: params.created },
    { Concepto: 'Productos actualizados', Valor: params.updated },
    { Concepto: 'Filas omitidas', Valor: params.skipped },
    { Concepto: 'Errores', Valor: params.errors.length },
  ];

  const ws1 = XLSX.utils.json_to_sheet(summaryData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws1, 'Resumen');

  if (params.errors.length > 0) {
    const errorData = params.errors.map(e => ({
      SKU: e.sku,
      Error: e.error,
    }));
    const ws2 = XLSX.utils.json_to_sheet(errorData);
    XLSX.utils.book_append_sheet(wb, ws2, 'Errores');
  }

  XLSX.writeFile(wb, `${fileName.replace(/\.[^.]+$/, '')}_reporte.xlsx`);
}
