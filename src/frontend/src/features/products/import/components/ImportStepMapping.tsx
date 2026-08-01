import { useMemo } from 'react';
import { useImportStore } from '../store/import.store';
import type { SystemField } from '../types/import.types';
import MappingLine from './MappingLine';
import MappingPresetManager from './MappingPresetManager';

const REQUIRED_FIELDS: SystemField[] = ['sku', 'name'];

export default function ImportStepMapping() {
  const columnMappings = useImportStore((s) => s.columnMappings);
  const updateMapping = useImportStore((s) => s.updateMapping);
  const preview = useImportStore((s) => s.preview);
  const nextStep = useImportStore((s) => s.nextStep);

  const allColumns = useMemo(() => {
    if (!preview) return [];
    return preview.detectedHeaders;
  }, [preview]);

  const mappingEntries = useMemo(() => {
    return allColumns.map((col) => {
      const existing = columnMappings.find((m) => m.sourceColumn === col);
      return {
        sourceColumn: col,
        targetField: existing?.targetField || '__skip',
        confidence: existing ? 1.0 : 0,
        isRequired: REQUIRED_FIELDS.includes(existing?.targetField as SystemField),
      };
    });
  }, [allColumns, columnMappings]);

  // Conteo de mapeos por tipo
  const mappingSummary = useMemo(() => {
    let mapped = 0;
    let extras = 0;
    let skipped = 0;
    for (const entry of mappingEntries) {
      if (entry.targetField === '__extra') extras++;
      else if (entry.targetField === '__skip') skipped++;
      else mapped++;
    }
    return { mapped, extras, skipped, total: mappingEntries.length };
  }, [mappingEntries]);

  const requiredMapped = useMemo(() => {
    return REQUIRED_FIELDS.every((field) =>
      columnMappings.some((m) => m.targetField === field),
    );
  }, [columnMappings]);

  const handleMappingChange = (sourceColumn: string, targetField: SystemField) => {
    updateMapping(sourceColumn, targetField);
  };

  if (!preview) {
    return (
      <div className="text-center text-gray-500 py-8">
        No hay datos disponibles.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-security-900">
            Mapeo de Columnas
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Asigne cada columna del archivo a un campo del sistema.
            Las columnas sin mapeo se guardarán como atributos adicionales del proveedor.
          </p>
          <p className="mt-1 text-xs text-gray-400">
            Si el archivo no contiene columnas de Categoría o Marca, se usarán defaults ("Sin categoría" / "Sin marca").
          </p>
        </div>
        <MappingPresetManager />
      </div>

      <div className="flex items-center gap-2 text-xs text-gray-500">
        <span className="inline-block w-2 h-2 rounded-full bg-security-500" />
        Campo requerido
        {!requiredMapped && (
          <span className="ml-2 text-security-600 font-medium">
            Faltan campos requeridos por mapear
          </span>
        )}
      </div>

      {/* Resumen de mapeo */}
      <div className="flex items-center gap-4 text-xs text-gray-600 bg-gray-50 rounded-lg px-4 py-2">
        <span><strong className="text-gray-900">{mappingSummary.mapped}</strong> campos del sistema</span>
        {mappingSummary.extras > 0 && (
          <span className="text-purple-700"><strong>{mappingSummary.extras}</strong> atributos del proveedor</span>
        )}
        {mappingSummary.skipped > 0 && (
          <span><strong>{mappingSummary.skipped}</strong> no importados</span>
        )}
        <span className="ml-auto text-gray-400">{mappingSummary.total} columnas totales</span>
      </div>

      <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
        {mappingEntries.map((entry) => (
          <MappingLine
            key={entry.sourceColumn}
            sourceColumn={entry.sourceColumn}
            targetField={entry.targetField}
            confidence={entry.confidence}
            isRequired={entry.isRequired}
            onChange={handleMappingChange}
          />
        ))}
      </div>

      {/* Info box */}
      {mappingSummary.extras > 0 && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg px-4 py-3 text-sm text-purple-800">
          <strong>{mappingSummary.extras} columnas</strong> se guardarán como atributos adicionales del proveedor
          en el campo <code>extraAttributes</code> del producto. Estos valores son consultables
          pero no afectan el catálogo de precios canónico.
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={nextStep}
          disabled={!requiredMapped}
          className={`
            px-6 py-2.5 text-sm font-medium rounded-md transition-colors
            ${requiredMapped
              ? 'bg-security-700 text-white hover:bg-security-800'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }
          `}
        >
          Validar
        </button>
      </div>
    </div>
  );
}
