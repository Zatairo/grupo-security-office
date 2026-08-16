import { useQueryClient } from '@tanstack/react-query';
import api from '../../../../services/api';

type CurrentPriceInfo = { value: number; currency: string; code: string };

/** Hook que memoiza la consulta de precios actuales por productId.
 *  Usa queryKey único por productId y cache de React Query (staleTime 30 min).
 *  Evita bombardear el API cuando el wizard procesa muchas filas. */
export function useCurrentPrices(productIds: string[]) {
  const queryClient = useQueryClient();

  // Garantizar que cada ID tenga su consulta en cache (30 min stale)
  productIds.forEach((id) => {
    void queryClient.ensureQueryData({
      queryKey: ['current-price', id],
      queryFn: async (): Promise<CurrentPriceInfo | null> => {
        const res = await api.get(`/prices/product/${id}`);
        const data = res.data as { value: number; currency: string; priceList: { code: string } } | null;
        if (!data || data.value === undefined) return null;
        return { value: data.value, currency: data.currency, code: data.priceList.code };
      },
      staleTime: 30 * 60 * 1000, // 30 minutos
    });
  });

  // Retornar precios en el mismo orden que los IDs entrantes
  return productIds.map((id) => {
    const cached = queryClient.getQueryData<CurrentPriceInfo | null>(['current-price', id]);
    return cached ?? null;
  });
}