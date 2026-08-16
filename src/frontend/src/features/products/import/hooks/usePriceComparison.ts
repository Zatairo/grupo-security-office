import { useQuery } from '@tanstack/react-query';
import api from '../../../../services/api';
import type { Product } from '../../types/product.types';
import { useImportStore } from '../store/import.store';
import { useCurrentPrices } from '../hooks/useCurrentPrices';
import {
  parsePriceRows,
  PriceComparisonRowField,
  PriceComparisonResult,
  computeDeltaPercent,
  formatDeltaDisplay,
} from '../utils/price-comparison';

const MAX_ROWS_WITH_PRICE = 100;

export function usePriceComparison() {
  const fileBuffer = useImportStore((s) => s.fileBuffer);
  const fileName = useImportStore((s) => s.fileName);
  const columnMappings = useImportStore((s) => s.columnMappings);

  const productsQuery = useQuery({
    queryKey: ['all-products-for-price-comparison'],
    queryFn: async (): Promise<Map<string, Product>> => {
      const map = new Map<string, Product>();
      let skip = 0;
      let pageSize = 500;
      let total = Number.POSITIVE_INFINITY;

      while (skip < total) {
        const res = await api.get('/products', { params: { skip, take: pageSize } });
        const body = res.data as {
          data?: Product[];
          meta?: { total?: number };
        } | Product[];
        const list = Array.isArray(body) ? body : (body?.data ?? []);
        for (const p of list) {
          if (p?.sku) {
            map.set(String(p.sku).trim().toUpperCase(), p);
          }
        }
        const metaTotal = !Array.isArray(body) ? body?.meta?.total : undefined;
        total = typeof metaTotal === 'number' ? metaTotal : list.length;
        if (list.length === 0 || list.length < pageSize) break;
        skip += list.length;
      }

      return map;
    },
    enabled: Boolean(fileBuffer),
    staleTime: 5 * 60 * 1000,
  });

  const comparisonQuery = useQuery({
    queryKey: ['price-comparison', fileName, columnMappings],
    queryFn: async (): Promise<PriceComparisonResult> => {
      if (!fileBuffer) {
        return { rows: [], totalRowsWithPrices: 0, truncated: false };
      }

      const parsed = await parsePriceRows(fileBuffer, columnMappings);

      // Obtener los SKU únicos de las filas con precio
      const rowsWithPrice = parsed.rows.filter(
        (row) => row.fields.some((f) => f.newPrice !== null),
      );

      // Limitar a las primeras 100 filas con precio
      const limitedRows = rowsWithPrice.slice(0, MAX_ROWS_WITH_PRICE);
      const totalRowsWithPrices = Math.min(parsed.totalRowsWithPrices, MAX_ROWS_WITH_PRICE);

      // Collect unique SKUs from limited rows
      const uniqueSkus = [...new Set(limitedRows.map((row) => row.sku).filter(Boolean))];

      // Fetch current prices using the memoization hook
      const priceDataMap = useCurrentPrices(uniqueSkus);

      // Build a map of SKU -> price info from the fetched data
      const skuPriceMap = new Map<string, { value: number; currency: string; code: string }>();
      for (let i = 0; i < uniqueSkus.length; i++) {
        const sku = uniqueSkus[i];
        const price = priceDataMap[i];
        if (sku && price) {
          skuPriceMap.set(sku, price);
        }
      }

      // Enriquecer rows con precios actuales y calcular deltas
      const enrichedRows = limitedRows.map((row) => {
        const priceInfo = skuPriceMap.get(row.sku) ?? null;
        const newFields: PriceComparisonRowField[] = [];

        for (const field of row.fields) {
          const delta = computeDeltaPercent(priceInfo?.value ?? null, field.newPrice);

          newFields.push({
            ...field,
            currentPrice: priceInfo
              ? { value: priceInfo.value, code: priceInfo.code }
              : null,
            deltaDisplay: formatDeltaDisplay(delta, priceInfo),
          });
        }

        return {
          ...row,
          fields: newFields,
        };
      });

      return {
        rows: enrichedRows,
        totalRowsWithPrices,
        truncated: parsed.totalRowsWithPrices > MAX_ROWS_WITH_PRICE,
      };
    },
    enabled: Boolean(fileBuffer) && Boolean(productsQuery.data),
    staleTime: 10 * 60 * 1000,
  });

  return {
    comparison: comparisonQuery.data,
    isLoading: productsQuery.isLoading || comparisonQuery.isLoading,
    error: productsQuery.error ?? comparisonQuery.error,
  };
}