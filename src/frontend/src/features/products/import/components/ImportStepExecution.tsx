import { useEffect } from 'react';
import { useImportStore } from '../store/import.store';
import { useImportExecution } from '../hooks/useImportExecution';

interface ImportStepExecutionProps {
  onComplete: () => void;
}

export default function ImportStepExecution({ onComplete }: ImportStepExecutionProps) {
  const preview = useImportStore((s) => s.preview);
  const columnMappings = useImportStore((s) => s.columnMappings);
  const ivaMode = useImportStore((s) => s.ivaMode);
  const setExecutionResult = useImportStore((s) => s.setExecutionResult);
  const setStep = useImportStore((s) => s.setStep);
  const nextStep = useImportStore((s) => s.nextStep);
  const setError = useImportStore((s) => s.setError);

  const executionMutation = useImportExecution();

  useEffect(() => {
    if (!preview) return;

    executionMutation.mutate(
      {
        importId: preview.importId,
        columnMappings: columnMappings.map((m) => ({
          sourceColumn: m.sourceColumn,
          targetField: m.targetField,
        })),
        ivaMode,
      },
      {
        onSuccess: (result) => {
          setExecutionResult(result);
          nextStep();
          onComplete();
        },
        onError: (err) => {
          setError(err.message || 'Error durante la ejecucion de la importacion');
          setStep('confirm');
        },
      },
    );
  }, []);

  return (
    <div className="flex flex-col items-center justify-center gap-8 py-12">
      <div className="flex flex-col items-center gap-4">
        <div className="w-16 h-16 flex items-center justify-center rounded-full bg-security-50">
          <div className="w-10 h-10 border-3 border-security-700 border-t-transparent rounded-full animate-spin" />
        </div>
        <div className="text-center">
          <h2 className="text-lg font-semibold text-security-900">
            Ejecutando importacion
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Procesando {preview?.totalRows || 0} filas. Esto puede tomar unos momentos.
          </p>
        </div>
      </div>

      <div className="w-full max-w-md">
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full bg-security-700 rounded-full animate-indeterminate" />
        </div>
      </div>

      {executionMutation.isPending && (
        <p className="text-xs text-gray-400">
          No cierre esta ventana mientras se procesa la importacion.
        </p>
      )}

      {executionMutation.isError && (
        <div className="w-full max-w-md p-4 bg-security-50 border border-security-200 rounded-md">
          <p className="text-sm text-security-700">
            {executionMutation.error?.message || 'Error durante la importacion'}
          </p>
          <button
            type="button"
            onClick={() => setStep('confirm')}
            className="mt-3 text-sm font-medium text-security-700 underline hover:text-security-800"
          >
            Volver a confirmar
          </button>
        </div>
      )}
    </div>
  );
}
