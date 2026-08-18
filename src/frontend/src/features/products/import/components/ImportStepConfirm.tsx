import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useImportStore } from '../store/import.store';
import { useSaveImportMapping } from '../hooks/useImportMappings';
import { usePriceComparison } from '../hooks/usePriceComparison';
import { fetchListas } from '../../../../services/listas.service';
import { fetchSuppliers } from '../../../../services/suppliers.service';
import {
  PRICE_FIELD_LABELS,
  computeDeltaPercent,
} from '../utils/price-comparison';
import { formatCurrency } from '../../../../lib/format';
import { getApiErrorMessage } from '../../../../lib/apiError';
import { Alert } from '../../../../components/ui';

const PRICE_FIELDS = [
  'price_instalador_iva',
  'price_tienda_iva',
  'price_dpp_oro_iva',
  'price_dpp_platino_iva',
  'price_cliente_final_iva',
  'price_oro_sin_iva',
  'price_installer_sin_iva',
];

function PriceComparisonSection() {
  const fileBuffer = useImportStore((s) => s.fileBuffer);
  const columnMappings = useImportStore((s) => s.columnMappings);
  const { comparison, isLoading, error } = usePriceComparison();

  const priceMapped = columnMappings.some((m) => PRICE_FIELDS.includes(m.targetField));

  if (!priceMapped) {
    return (
      <div className="border border-gray-200 rounded-lg p-5">
        <h3 className="text-sm font-medium text-gray-700 mb-1">Comparación de precios</h3>
        <p className="text-sm text-gray-500">
          No hay columnas de precio mapeadas. Mapea al menos una columna de precio en el paso
          anterior para comparar con el catálogo actual.
        </p>
      </div>
    );
  }

  if (!fileBuffer) {
    return (
      <div className="border border-gray-200 rounded-lg p-5">
        <h3 className="text-sm font-medium text-gray-700 mb-1">Comparación de precios</h3>
        <p className="text-sm text-gray-500">
          Vuelve a cargar el archivo para habilitar la comparación de precios con el catálogo.
        </p>
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded-lg p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-700">Comparación de precios</h3>
        {comparison && comparison.totalRowsWithPrices > 0 && (
          <span className="text-xs text-gray-400">
            {comparison.rows.length} de {comparison.totalRowsWithPrices} filas con precio
          </span>
        )}
      </div>

      {isLoading && (
        <p className="text-sm text-gray-400">Cargando comparación de precios...</p>
      )}

      {error && !isLoading && (
        <Alert variant="warning">
          No se pudo cargar la comparación: {getApiErrorMessage(error, 'Error de red')}
        </Alert>
      )}

      {!isLoading && !error && comparison && (
        comparison.rows.length === 0 ? (
          <p className="text-sm text-gray-500">
            Sin filas con precio para comparar en el archivo.
          </p>
        ) : (
          <>
            {comparison.truncated && (
              <p className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-md p-2 mb-2">
                Comparación limitada a las primeras {comparison.rows.length} filas con precio.
              </p>
            )}
            <div className="overflow-x-auto border border-gray-200 rounded-lg max-h-72 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Fila</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">SKU</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Tarifa</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-700">Precio actual</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-700">Precio nuevo</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-700">Δ%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {comparison.rows.map((row) =>
                    row.fields.map((f, idx) => {
                      const delta = computeDeltaPercent(f.currentPrice?.value ?? null, f.newPrice);
                      return (
                        <tr key={`${row.excelRow}-${idx}`}>
                          <td className="px-3 py-2 text-gray-500">{row.excelRow}</td>
                          <td className="px-3 py-2 font-medium text-gray-800">{row.sku || 'N/A'}</td>
                          <td className="px-3 py-2 text-gray-600">
                            {PRICE_FIELD_LABELS[f.field] ?? f.label}
                          </td>
                          <td className="px-3 py-2 text-right text-gray-600 tabular-nums">
                            {f.currentPrice === null ? (
                              <span className="text-amber-600 font-medium">SIN PRECIO ACTUAL</span>
                            ) : (
                              formatCurrency(f.currentPrice.value)
                            )}
                          </td>
                          <td className="px-3 py-2 text-right font-medium text-security-800 tabular-nums">
                            {formatCurrency(f.newPrice ?? 0)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {delta === null ? (
                              <span className="text-gray-300">—</span>
                            ) : (
                              <span className={delta > 0 ? 'text-red-600' : delta < 0 ? 'text-green-600' : 'text-gray-600'}>
                                {delta > 0 ? '+' : ''}{delta.toFixed(1)}%
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    }),
                  )}
                </tbody>
              </table>
            </div>
          </>
        )
      )}
    </div>
  );
}

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
  const listaId = useImportStore((s) => s.listaId);
  const supplierId = useImportStore((s) => s.supplierId);
  const supplierName = useImportStore((s) => s.supplierName);
  const { data: listas } = useQuery({ queryKey: ['listas'], queryFn: fetchListas });
  const { data: suppliers } = useQuery({ queryKey: ['suppliers'], queryFn: () => fetchSuppliers() });
  const listaDestino = (listas ?? []).find((l) => l.id === listaId);
  const proveedor = supplierId
    ? (suppliers ?? []).find((s) => s.id === supplierId) ?? (supplierName ? { id: supplierId, name: supplierName } : undefined)
    : undefined;

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

          <dt className="text-gray-500">Lista destino:</dt>
          <dd className="font-medium text-security-900">
            {listaDestino ? `${listaDestino.name} (${listaDestino.code})` : 'Sin lista'}
          </dd>

          <dt className="text-gray-500">Proveedor:</dt>
          <dd className="font-medium text-security-900">
            {proveedor ? (proveedor as { name: string }).name : 'Sin proveedor'}
          </dd>
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

      <PriceComparisonSection />

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
