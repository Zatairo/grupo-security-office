import { useMutation } from '@tanstack/react-query';
import api from '../../../../services/api';
import type { ImportExecutionResult } from '../types/import.types';

interface ExecuteParams {
  importId: string;
  columnMappings: Array<{ sourceColumn: string; targetField: string }>;
  ivaMode?: string;
  presetName?: string;
}

export function useImportExecution() {
  return useMutation<ImportExecutionResult, Error, ExecuteParams>({
    mutationFn: async ({ importId, columnMappings, ivaMode, presetName }) => {
      const { data } = await api.post('/products/import/execute', {
        importId,
        columnMappings,
        ivaMode,
        presetName,
      });
      return data;
    },
  });
}
