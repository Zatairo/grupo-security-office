import api from '../../../../services/api';

export type CurrentPriceInfo = { value: number; currency: string; code: string };

interface CurrentPriceResponseData {
  sku: string;
  productId: string;
  name: string;
  price: number | null;
  currency: string | null;
  validUntil: string | null;
  exists: boolean;
}

/** Obtiene los precios actuales de un set de SKUs en una sola petición
 *  (conserva el orden de entrada). N llamadas individuales en paralelo
 *  agotaban el rate-limit global con listas grandes (>20 filas) y tumbaban
 *  el paso siguiente del wizard (execute) por 429 en cascada. */
export async function fetchCurrentPrices(
  skus: string[],
  listaId: string | null,
): Promise<(CurrentPriceInfo | null)[]> {
  if (skus.length === 0) return [];
  try {
    const res = await api.post('/products/import/current-prices', { skus, listaId });
    const body = res.data as { data?: (CurrentPriceResponseData | null)[] } | null;
    const results = body?.data ?? [];
    return skus.map((_, i) => {
      const info = results[i];
      if (!info || info.exists === false || typeof info.price !== 'number') return null;
      return { value: info.price, currency: info.currency ?? '', code: '' };
    });
  } catch {
    return skus.map(() => null);
  }
}
