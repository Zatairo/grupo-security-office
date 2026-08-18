export type SystemField =
  | 'sku' | 'name' | 'description' | 'category' | 'brand' | 'technicalSpecs'
  | 'price_instalador_iva' | 'price_tienda_iva' | 'price_dpp_oro_iva'
  | 'price_dpp_platino_iva' | 'price_cliente_final_iva' | 'price_oro_sin_iva'
  | 'price_installer_sin_iva' | '__skip' | '__extra';

export interface ColumnMappingEntry {
  sourceColumn: string;
  targetField: SystemField;
  isRequired: boolean;
  confidence: number;
}

export interface ColumnMapping {
  entries: ColumnMappingEntry[];
  confirmed: boolean;
}

export interface ImportPreviewResult {
  importId: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  breakdown: { toCreate: number; toUpdate: number; skipped: number };
  validationErrors: ValidationRowError[];
  warnings: string[];
  columnMapping: Record<string, string>;
  detectedHeaders: string[];
  completedStage: string;
}

export interface ValidationRowError {
  rowIndex: number;
  excelRow: number;
  sku: string;
  errors: Array<{ field: string; code: string; message: string }>;
}

export interface ImportExecutionResult {
  importId: string;
  summary: { total: number; created: number; updated: number; skipped: number; errors: number };
  executionErrors: Array<{ rowIndex: number; sku: string; error: string }>;
  durationMs: number;
  completedAt: string;
}

export interface MappingPreset {
  id: string;
  name: string;
  mappings: Array<{ sourceColumn: string; targetField: SystemField }>;
  userId: string;
  createdAt: string;
  isDefault: boolean;
}

export type ImportStep = 'sections' | 'upload' | 'headers' | 'mapping' | 'validation' | 'confirm' | 'execution' | 'result';

export interface ImportWizardState {
  currentStep: ImportStep;
  file: File | null;
  fileBuffer: ArrayBuffer | null;
  fileName: string;
  preview: ImportPreviewResult | null;
  executionResult: ImportExecutionResult | null;
  columnMappings: Array<{ sourceColumn: string; targetField: SystemField }>;
  ivaMode: 'with_iva' | 'without_iva' | 'mixed';
  listaId: string | null;
  isLoading: boolean;
  error: string | null;
}
