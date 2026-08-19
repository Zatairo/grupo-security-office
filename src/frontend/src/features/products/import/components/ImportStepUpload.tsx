import { useCallback, useState } from 'react';
import { useImportStore } from '../store/import.store';
import { useFileParser } from '../hooks/useFileParser';
import { useImportPreview } from '../hooks/useImportPreview';

const ACCEPTED_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
];
const ACCEPTED_EXTENSIONS = ['.xlsx', '.xls', '.csv'];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isValidFileType(file: File): boolean {
  if (ACCEPTED_TYPES.includes(file.type)) return true;
  const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
  return ACCEPTED_EXTENSIONS.includes(ext);
}

export default function ImportStepUpload() {
  const setFile = useImportStore((s) => s.setFile);
  const setPreview = useImportStore((s) => s.setPreview);
  const nextStep = useImportStore((s) => s.nextStep);
  const setError = useImportStore((s) => s.setError);

  const { parsedFile, isParsing, parseError, parseFile } = useFileParser();
  const previewMutation = useImportPreview();

  const [isDragOver, setIsDragOver] = useState(false);

  const handleFile = useCallback(async (file: File) => {
    setError(null);

    if (!isValidFileType(file)) {
      setError('Formato de archivo no soportado. Use .xlsx, .xls o .csv');
      return;
    }

    const buffer = await file.arrayBuffer();
    setFile(file, buffer);
    await parseFile(file);
  }, [setFile, parseFile, setError]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  }, [handleFile]);

  const handleContinue = useCallback(async () => {
    if (!parsedFile) return;

    const store = useImportStore.getState();
    previewMutation.mutate(
      {
        fileBuffer: store.fileBuffer!,
        fileName: store.fileName,
        listaId: store.listaId ?? undefined,
      },
      {
        onSuccess: (result) => {
          setPreview(result);
          store.setColumnMappings(
            result.detectedHeaders.map((h) => ({
              sourceColumn: h,
              targetField: (result.columnMapping[h] || '__skip') as any,
            })),
          );
          nextStep();
        },
        onError: (err) => {
          setError(err.message || 'Error al procesar archivo en el servidor');
        },
      },
    );
  }, [parsedFile, previewMutation, setPreview, nextStep, setError]);

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="text-center">
        <h2 className="text-lg font-semibold text-security-900">
          Seleccionar archivo a importar
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Formatos soportados: .xlsx, .xls, .csv
        </p>
      </div>

      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`
          w-full max-w-lg border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer
          ${isDragOver
            ? 'border-security-500 bg-security-50'
            : 'border-gray-300 bg-gray-50 hover:border-security-400 hover:bg-security-50'
          }
        `}
      >
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleInputChange}
          className="hidden"
          id="file-upload-input"
        />

        {isParsing ? (
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-3 border-security-700 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-security-700 font-medium">
              Procesando archivo...
            </span>
          </div>
        ) : parsedFile ? (
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 flex items-center justify-center rounded-full bg-security-50">
              <svg className="w-6 h-6 text-security-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-security-900">
                {parsedFile.fileName}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {formatFileSize(parsedFile.fileSize)} - {parsedFile.rows.length} filas detectadas - {parsedFile.headers.length} columnas
              </p>
            </div>
            <label
              htmlFor="file-upload-input"
              className="text-sm text-security-700 underline cursor-pointer hover:text-security-800"
            >
              Seleccionar otro archivo
            </label>
          </div>
        ) : (
          <label htmlFor="file-upload-input" className="cursor-pointer flex flex-col items-center gap-3">
            <div className="w-12 h-12 flex items-center justify-center rounded-full bg-security-50">
              <svg className="w-6 h-6 text-security-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-security-900">
                Arrastre el archivo aqui
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                o haga clic para seleccionar
              </p>
            </div>
          </label>
        )}
      </div>

      {parseError && (
        <div className="w-full max-w-lg p-3 bg-security-50 border border-security-200 rounded-md">
          <p className="text-sm text-security-700">{parseError}</p>
        </div>
      )}

      {previewMutation.isError && (
        <div className="w-full max-w-lg p-3 bg-security-50 border border-security-200 rounded-md">
          <p className="text-sm text-security-700">
            {previewMutation.error?.message || 'Error al enviar archivo al servidor'}
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={handleContinue}
        disabled={!parsedFile || previewMutation.isPending}
        className={`
          px-6 py-2.5 text-sm font-medium rounded-md transition-colors
          ${parsedFile && !previewMutation.isPending
            ? 'bg-security-700 text-white hover:bg-security-800'
            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }
        `}
      >
        {previewMutation.isPending ? 'Procesando...' : 'Siguiente'}
      </button>
    </div>
  );
}
