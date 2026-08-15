import { useMutation } from '@tanstack/react-query';
import api from '../../../../services/api';
import type { ImportPreviewResult } from '../types/import.types';

interface PreviewParams {
  fileBuffer: ArrayBuffer;
  fileName: string;
  headerRowIndex?: number;
  columnMappings?: Array<{ sourceColumn: string; targetField: string }>;
  presetId?: string;
  listaId?: string;
}

export function useImportPreview() {
  return useMutation<ImportPreviewResult, Error, PreviewParams>({
    mutationFn: async ({ fileBuffer, fileName, headerRowIndex, columnMappings, presetId, listaId }) => {
      const formData = new FormData();
      const blob = new Blob([fileBuffer], {
        type: fileName.endsWith('.csv') ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      formData.append('file', blob, fileName);

      if (headerRowIndex !== undefined) {
        formData.append('headerRowIndex', String(headerRowIndex));
      }
      if (columnMappings) {
        formData.append('columnMappings', JSON.stringify(columnMappings));
      }
      if (presetId) {
        formData.append('presetId', presetId);
      }
      if (listaId) {
        formData.append('listaId', listaId);
      }

      const { data } = await api.post('/products/import/preview', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data;
    },
  });
}
