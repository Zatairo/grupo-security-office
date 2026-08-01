import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../../services/api';
import type { MappingPreset } from '../types/import.types';

export function useImportMappings() {
  return useQuery<MappingPreset[]>({
    queryKey: ['import-mappings'],
    queryFn: async () => {
      const { data } = await api.get('/products/import/mappings');
      return data;
    },
  });
}

export function useSaveImportMapping() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { name: string; mapping: any; isDefault?: boolean }) => {
      const { data } = await api.post('/products/import/mappings', params);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['import-mappings'] });
    },
  });
}

export function useDeleteImportMapping() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/products/import/mappings/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['import-mappings'] });
    },
  });
}
