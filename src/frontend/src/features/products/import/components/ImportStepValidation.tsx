import { useCallback } from 'react';
import { useImportStore } from '../store/import.store';
import { exportValidationErrors } from '../utils/excel-generator';
import ValidationRow from './ValidationRow';

export default function ImportStepValidation() {
  const preview = useImportStore((s) => s.preview);
  const fileName = useImportStore((s) => s.fileName);
  const nextStep = useImportStore((s) => s.nextStep);

  const handleExportErrors = useCallback(async () => {
    if (!preview || preview.validationErrors.length === 0) return;
    await exportValidationErrors(preview.validationErrors, fileName);
  }, [preview, fileName]);

  if (!preview) {
    return (
      <div className="text-center text-gray-500 py-8">
        No hay datos de validacion disponibles.
      </div>
    );
  }

  const hasValidRows = preview.validRows > 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-security-900">
          Resultado de Validacion
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Revision de los datos antes de ejecutar la importacion.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="border border-gray-200 rounded-lg p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Total filas
          </p>
          <p className="mt-1 text-2xl font-bold text-security-900">
            {preview.totalRows}
          </p>
        </div>
        <div className="border border-green-200 bg-green-50 rounded-lg p-4">
          <p className="text-xs font-medium text-green-700 uppercase tracking-wide">
            Validas
          </p>
          <p className="mt-1 text-2xl font-bold text-green-800">
            {preview.validRows}
          </p>
        </div>
        <div className="border border-security-200 bg-security-50 rounded-lg p-4">
          <p className="text-xs font-medium text-security-700 uppercase tracking-wide">
            Invalidas
          </p>
          <p className="mt-1 text-2xl font-bold text-security-800">
            {preview.invalidRows}
          </p>
        </div>
        <div className="border border-gray-200 rounded-lg p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Omitidas
          </p>
          <p className="mt-1 text-2xl font-bold text-security-900">
            {preview.breakdown.skipped}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="border border-security-200 bg-security-50 rounded-lg p-4">
          <p className="text-xs font-medium text-security-700 uppercase tracking-wide">
            A crear
          </p>
          <p className="mt-1 text-xl font-bold text-security-800">
            {preview.breakdown.toCreate}
          </p>
        </div>
        <div className="border border-security-200 bg-security-50 rounded-lg p-4">
          <p className="text-xs font-medium text-security-700 uppercase tracking-wide">
            A actualizar
          </p>
          <p className="mt-1 text-xl font-bold text-security-800">
            {preview.breakdown.toUpdate}
          </p>
        </div>
      </div>

      {preview.validationErrors.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-700">
              Errores de validacion ({preview.validationErrors.length})
            </h3>
            <button
              type="button"
              onClick={handleExportErrors}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-security-700 bg-security-50 rounded-md hover:bg-security-100 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Exportar errores
            </button>
          </div>

          <div className="border border-gray-200 rounded-lg overflow-hidden max-h-80 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium text-gray-700">
                    Fila
                  </th>
                  <th className="px-4 py-2.5 text-left font-medium text-gray-700">
                    SKU
                  </th>
                  <th className="px-4 py-2.5 text-left font-medium text-gray-700">
                    Errores
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {preview.validationErrors.map((err) => (
                  <ValidationRow
                    key={`${err.rowIndex}-${err.sku}`}
                    rowIndex={err.excelRow}
                    sku={err.sku}
                    errors={err.errors}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {preview.warnings.length > 0 && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
          <p className="text-xs font-medium text-yellow-800 mb-1">Advertencias:</p>
          <ul className="text-xs text-yellow-700 list-disc list-inside space-y-0.5">
            {preview.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={nextStep}
          disabled={!hasValidRows}
          className={`
            px-6 py-2.5 text-sm font-medium rounded-md transition-colors
            ${hasValidRows
              ? 'bg-security-700 text-white hover:bg-security-800'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }
          `}
        >
          Confirmar
        </button>
      </div>
    </div>
  );
}
