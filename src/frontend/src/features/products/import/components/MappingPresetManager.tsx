import { useState } from 'react';
import { useImportStore } from '../store/import.store';
import {
  useImportMappings,
  useSaveImportMapping,
  useDeleteImportMapping,
} from '../hooks/useImportMappings';

export default function MappingPresetManager() {
  const columnMappings = useImportStore((s) => s.columnMappings);
  const setColumnMappings = useImportStore((s) => s.setColumnMappings);

  const { data: presets, isLoading } = useImportMappings();
  const saveMutation = useSaveImportMapping();
  const deleteMutation = useDeleteImportMapping();

  const [showSaveInput, setShowSaveInput] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');

  const handleSave = async () => {
    if (!newPresetName.trim()) return;
    await saveMutation.mutateAsync({
      name: newPresetName.trim(),
      mapping: columnMappings,
    });
    setNewPresetName('');
    setShowSaveInput(false);
  };

  const handleLoad = (mappings: Array<{ sourceColumn: string; targetField: any }>) => {
    setColumnMappings(
      mappings.map((m) => ({
        sourceColumn: m.sourceColumn,
        targetField: m.targetField,
      })),
    );
  };

  const handleDelete = async (id: string) => {
    await deleteMutation.mutateAsync(id);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        {!showSaveInput ? (
          <button
            type="button"
            onClick={() => setShowSaveInput(true)}
            disabled={columnMappings.length === 0}
            className={`
              inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors
              ${columnMappings.length > 0
                ? 'text-security-700 bg-security-50 hover:bg-security-100'
                : 'text-gray-400 bg-gray-100 cursor-not-allowed'
              }
            `}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
            Guardar como preset
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newPresetName}
              onChange={(e) => setNewPresetName(e.target.value)}
              placeholder="Nombre del preset"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave();
                if (e.key === 'Escape') {
                  setShowSaveInput(false);
                  setNewPresetName('');
                }
              }}
              autoFocus
              className="px-2 py-1 text-xs border border-gray-300 rounded-md bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary focus:border-security-500"
            />
            <button
              type="button"
              onClick={handleSave}
              disabled={!newPresetName.trim() || saveMutation.isPending}
              className="px-2 py-1 text-xs font-medium text-white bg-security-700 rounded-md hover:bg-security-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {saveMutation.isPending ? 'Guardando...' : 'Guardar'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowSaveInput(false);
                setNewPresetName('');
              }}
              className="px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
            >
              Cancelar
            </button>
          </div>
        )}
      </div>

      {isLoading && (
        <p className="text-xs text-gray-400">Cargando presets...</p>
      )}

      {presets && presets.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {presets.map((preset) => (
            <div
              key={preset.id}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-md text-xs"
            >
              <span className="font-medium text-security-900">
                {preset.name}
              </span>
              {preset.isDefault && (
                <span className="text-[10px] text-gray-500">(predeterminado)</span>
              )}
              <button
                type="button"
                onClick={() => handleLoad(preset.mappings)}
                className="ml-1 text-security-700 hover:text-security-900 underline"
              >
                Cargar
              </button>
              <button
                type="button"
                onClick={() => handleDelete(preset.id)}
                disabled={deleteMutation.isPending}
                className="text-gray-400 hover:text-security-600 transition-colors"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
