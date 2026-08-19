import { useMutation } from '@tanstack/react-query';
import api from '../../../../services/api';
import { useImportStore } from '../store/import.store';
import type { ImportExecutionResult, ImportSectionDecision } from '../types/import.types';

interface ExecuteParams {
  importId: string;
  columnMappings: Array<{ sourceColumn: string; targetField: string }>;
  ivaMode?: string;
  presetName?: string;
  listaId?: string;
  sections?: ImportSectionDecision[];
}

/**
 * Defensivo: el backend usa ValidationPipe con forbidNonWhitelisted=true.
 * Si el runtime aún no acepta `sections` (campo nuevo en desarrollo), el 400
 * reintenta sin el campo, igual que se hace con codigo/supplierId en createLista.
 */
function isSectionsNotWhitelisted(err: unknown): boolean {
  const status = (err as { response?: { status?: number } })?.response?.status;
  if (status !== 400) return false;
  const data = JSON.stringify((err as { response?: { data?: unknown } })?.response?.data ?? '');
  return data.includes('sections');
}

export function useImportExecution() {
  return useMutation<ImportExecutionResult, Error, ExecuteParams>({
    mutationFn: async ({ importId, columnMappings, ivaMode, presetName, listaId, sections }) => {
      const hasSections = Array.isArray(sections) && sections.length > 0;
      const fixedValues = useImportStore.getState().fixedValues;
      const body: Record<string, unknown> = {
        importId,
        columnMappings,
        ivaMode,
        presetName,
        ...(listaId ? { listaId } : {}),
      };
      if (hasSections) body.sections = sections;
      if (fixedValues && Object.keys(fixedValues).length > 0) body.fixedValues = fixedValues;

      try {
        const { data } = await api.post('/products/import/execute', body);
        return data;
      } catch (err) {
        if (hasSections && isSectionsNotWhitelisted(err)) {
          const retryBody = { ...body };
          delete retryBody.sections;
          const { data } = await api.post('/products/import/execute', retryBody);
          return data;
        }
        throw err;
      }
    },
  });
}
