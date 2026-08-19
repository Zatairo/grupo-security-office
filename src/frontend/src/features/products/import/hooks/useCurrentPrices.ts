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

/** Consulta el precio vigente de un SKU dentro de la lista destino.
 *  Contrato: GET /products/import/current-price?sku=&listaId= → { data: {...} | null }.
 *  `data:null` o `exists:false` o `price:null` ⇒ no hay precio actual (se muestra "—"). */
export async function fetchCurrentPrice(
  sku: string,
  listaId: string | null,
): Promise<CurrentPriceInfo | null> {
  const params: Record<string, string> = { sku };
  if (listaId) params.listaId = listaId;
  const res = await api.get('/products/import/current-price', { params });
  const body = res.data as { data?: CurrentPriceResponseData | null } | null;
  const info = body?.data;
  if (!info || info.exists === false || typeof info.price !== 'number') return null;
  return { value: info.price, currency: info.currency ?? '', code: '' };
}

/** Obtiene los precios actuales de un set de SKUs conservando el orden de entrada. */
export async function fetchCurrentPrices(
  skus: string[],
  listaId: string | null,
): Promise<(CurrentPriceInfo | null)[]> {
  const results = await Promise.all(
    skus.map((sku) => fetchCurrentPrice(sku, listaId).catch(() => null)),
  );
  return results;
}
