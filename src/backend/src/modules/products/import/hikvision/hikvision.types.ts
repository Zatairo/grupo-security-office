/**
 * Contratos tipados para el adaptador Hikvision.
 * Sin `any`, sin `unknown` sin estrechamiento.
 * Todos los campos toleran ausencia de datos en la API origen.
 */

export type HikvisionCatalogSource = 'HITOOLS_DESIGNER_API';

export type HikvisionLookupStatus =
  | 'FOUND'
  | 'NOT_FOUND'
  | 'AMBIGUOUS'
  | 'UNCONFIGURED'
  | 'UPSTREAM_ERROR'
  | 'INVALID_SKU';

export type HikvisionAssetType = 'IMAGE' | 'DATASHEET' | 'MANUAL' | 'BROCHURE' | 'OTHER';

export interface HikvisionAssetCandidate {
  url: string;
  type: HikvisionAssetType;
  title: string | null;
  mimeType: string | null;
  isPrimaryCandidate: boolean;
}

export interface HikvisionProductCandidate {
  manufacturerSku: string;
  name: string | null;
  description: string | null;
  category: string | null;
  subCategory: string | null;
  technicalAttributes: Record<string, string | number | boolean | null>;
  assets: HikvisionAssetCandidate[];
  sourceUrl: string | null;
}

export interface HikvisionLookupResult {
  requestedSku: string;
  normalizedSku: string | null;
  source: HikvisionCatalogSource;
  status: HikvisionLookupStatus;
  candidates: HikvisionProductCandidate[];
  message: string | null;
  queriedAt: string;
}
