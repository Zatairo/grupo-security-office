import { useState } from 'react';
import { useImportStore } from '../store/import.store';
import { useSaveImportMapping } from '../hooks/useImportMappings';

export default function ImportStepConfirm() {
  const preview = useImportStore((s) => s.preview);
  const columnMappings = useImportStore((s) => s.columnMappings);
  const ivaMode = useImportStore((s) => s.ivaMode);
  const setIvaMode = useImportStore((s) => s.setIvaMode);
  const setStep = useImportStore((s) => s.setStep);
  const fileName = useImportStore((s) => s.fileName);

  const [savePreset, setSavePreset] = useState(false);
  const [presetName, setPresetName] = useState('');

  const saveMappingMutation = useSaveImportMapping();

  const handleExecute = async () => {
    if (savePreset && presetName.trim()) {
      await saveMappingMutation.mutateAsync({
        name: presetName.trim(),
        mapping: columnMappings,
      });
    }
    setStep('execution');
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
      <div>
        <h2 className="text-lg font-semibold text-security-900">
          Confirmar Importacion
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Revise el resumen antes de ejecutar la importacion.
        </p>
      </div>

      <div className="border border-gray-200 rounded-lg p-5">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Resumen</h3>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <dt className="text-gray-500">Archivo:</dt>
          <dd className="font-medium text-security-900">{fileName}</dd>

          <dt className="text-gray-500">Total filas:</dt>
          <dd className="font-medium text-security-900">{preview.totalRows}</dd>

          <dt className="text-gray-500">A crear:</dt>
          <dd className="font-medium text-green-700">{preview.breakdown.toCreate}</dd>

          <dt className="text-gray-500">A actualizar:</dt>
          <dd className="font-medium text-security-700">{preview.breakdown.toUpdate}</dd>

          <dt className="text-gray-500">Omitidas:</dt>
          <dd className="font-medium text-gray-600">{preview.breakdown.skipped}</dd>

          <dt className="text-gray-500">Errores:</dt>
          <dd className="font-medium text-security-600">{preview.invalidRows}</dd>

          <dt className="text-gray-500">Columnas mapeadas:</dt>
          <dd className="font-medium text-security-900">{columnMappings.length}</dd>
        </dl>
      </div>

      <div className="border border-gray-200 rounded-lg p-5">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Modo IVA</h3>
        <div className="flex flex-col gap-2">
          {([
            { value: 'with_iva' as const, label: 'Con IVA', description: 'Los precios incluyen IVA' },
            { value: 'without_iva' as const, label: 'Sin IVA', description: 'Los precios no incluyen IVA' },
            { value: 'mixed' as const, label: 'Mixto', description: 'Mezcla de precios con y sin IVA' },
          ]).map((option) => (
            <label
              key={option.value}
              className={`
                flex items-start gap-3 p-3 rounded-md border cursor-pointer transition-colors
                ${ivaMode === option.value
                  ? 'border-security-700 bg-security-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
                }
              `}
            >
              <input
                type="radio"
                name="iva-mode"
                value={option.value}
                checked={ivaMode === option.value}
                onChange={() => setIvaMode(option.value)}
                className="mt-0.5 text-security-700 focus:ring-brand-primary/30 focus:border-brand-primary"
              />
              <div>
                <span className="text-sm font-medium text-security-900">
                  {option.label}
                </span>
                <span className="block text-xs text-gray-500 mt-0.5">
                  {option.description}
                </span>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div className="border border-gray-200 rounded-lg p-5">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={savePreset}
            onChange={(e) => setSavePreset(e.target.checked)}
            className="text-security-700 focus:ring-brand-primary/30 focus:border-brand-primary rounded"
          />
          <span className="text-sm font-medium text-gray-700">
            Guardar mapeo como preset
          </span>
        </label>

        {savePreset && (
          <div className="mt-3">
            <input
              type="text"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="Nombre del preset"
              className="w-full max-w-sm px-3 py-2 text-sm border border-gray-300 rounded-md bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary focus:border-security-500"
            />
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleExecute}
          disabled={savePreset && saveMappingMutation.isPending}
          className={`
            inline-flex items-center gap-2 px-6 py-2.5 text-sm font-medium rounded-md transition-colors
            ${savePreset && saveMappingMutation.isPending
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : 'bg-security-500 text-white hover:bg-security-600'
            }
          `}
        >
          {savePreset && saveMappingMutation.isPending ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Guardando preset...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
              Ejecutar Importacion
            </>
          )}
        </button>
      </div>
    </div>
  );
}
