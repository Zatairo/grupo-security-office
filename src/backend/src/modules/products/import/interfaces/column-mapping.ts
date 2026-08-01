/**
 * Campos estándar del sistema que pueden mapearse desde columnas del archivo.
 */
export type SystemField =
  | 'sku'
  | 'name'
  | 'description'
  | 'category'
  | 'brand'
  | 'technicalSpecs'
  | 'price_instalador_iva'
  | 'price_tienda_iva'
  | 'price_dpp_oro_iva'
  | 'price_dpp_platino_iva'
  | 'price_cliente_final_iva'
  | 'price_oro_sin_iva'
  | 'price_installer_sin_iva'
  | '__skip'
  | '__extra';

/**
 * Mapping de una columna del archivo a un campo del sistema.
 */
export interface ColumnMappingEntry {
  /** Header original detectado en el archivo */
  sourceColumn: string;

  /** Campo del sistema al que mapea */
  targetField: SystemField;

  /** ¿Es un campo requerido? (solo informativo para UI) */
  isRequired: boolean;

  /** Confianza del matching automático (0-1) */
  confidence: number;
}

/**
 * Mapping completo de columnas para una importación.
 */
export interface ColumnMapping {
  /** Lista de mapeos */
  entries: ColumnMappingEntry[];

  /** ¿Fue confirmado por el usuario? */
  confirmed: boolean;
}

/**
 * Preset de mapping guardado por el usuario.
 */
export interface MappingPreset {
  /** ID del preset */
  id: string;

  /** Nombre descriptivo */
  name: string;

  /** Mapeos guardados */
  mappings: Array<{
    sourceColumn: string;
    targetField: SystemField;
  }>;

  /** ID del usuario que lo creó */
  userId: string;

  /** Fecha de creación */
  createdAt: string;

  /** ¿Es el preset por defecto? */
  isDefault: boolean;
}

/**
 * Configuración de detección de headers.
 */
export interface HeaderDetectionConfig {
  /** Fila donde buscar headers (default: 0) */
  headerRowIndex: number;

  /** Número de filas de muestra para detectar headers */
  sampleRows: number;

  /** Umbral mínimo de confianza para matching automático (0-1) */
  confidenceThreshold: number;

  /** ¿Permitir headers en filas superiores a la detectada? */
  allowCustomHeaderRow: boolean;
}

/**
 * Resultado de la detección de headers.
 */
export interface HeaderDetectionResult {
  /** Headers detectados */
  headers: string[];

  /** Fila donde se encontraron los headers */
  headerRowIndex: number;

  /** Mapeos automáticos sugeridos */
  suggestedMappings: ColumnMappingEntry[];

  /** Headers que no pudieron mapearse */
  unmappedHeaders: string[];

  /** Nivel de confianza general (0-1) */
  overallConfidence: number;
}
