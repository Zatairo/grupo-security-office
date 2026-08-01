import { PipelineStage } from './import-context';

/**
 * Resultado de una operación de preview (dry-run).
 * Muestra qué pasaría sin ejecutar cambios en la BD.
 */
export interface ImportPreviewResult {
  /** ID de la importación */
  importId: string;

  /** Total de filas en el archivo */
  totalRows: number;

  /** Filas válidas (se importarían) */
  validRows: number;

  /** Filas con errores (se omitirían) */
  invalidRows: number;

  /** Desglose por tipo de operación */
  breakdown: {
    /** Productos que se crearían (SKU nuevo) */
    toCreate: number;
    /** Productos que se actualizarían (SKU existente) */
    toUpdate: number;
    /** Filas que se omitirían (errores de validación) */
    skipped: number;
  };

  /** Lista de errores de validación */
  validationErrors: ValidationRowError[];

  /** Lista de warnings */
  warnings: string[];

  /** Mapeo de columnas usado */
  columnMapping: Record<string, string>;

  /** Headers detectados */
  detectedHeaders: string[];

  /** Etapa del pipeline donde se detuvo */
  completedStage: PipelineStage;
}

/**
 * Error de validación de una fila para el endpoint de preview.
 */
export interface ValidationRowError {
  /** Índice de la fila (0-based) */
  rowIndex: number;

  /** Número de fila en Excel (1-based, incluyendo header) */
  excelRow: number;

  /** SKU de la fila (si está disponible) */
  sku: string;

  /** Lista de errores */
  errors: Array<{
    field: string;
    code: string;
    message: string;
  }>;
}

/**
 * Resultado de una operación de ejecución (commit).
 */
export interface ImportExecutionResult {
  /** ID de la importación */
  importId: string;

  /** Resumen de la ejecución */
  summary: {
    /** Total procesado */
    total: number;
    /** Creados exitosamente */
    created: number;
    /** Actualizados exitosamente */
    updated: number;
    /** Omitidos */
    skipped: number;
    /** Errores */
    errors: number;
  };

  /** Errores durante la ejecución */
  executionErrors: Array<{
    rowIndex: number;
    sku: string;
    error: string;
  }>;

  /** Duración total en ms */
  durationMs: number;

  /** Timestamp de finalización */
  completedAt: string;
}

/**
 * Resultado del endpoint de progreso de importación.
 */
export interface ImportProgressResult {
  /** ID de la importación */
  importId: string;

  /** Estado actual */
  status: 'pending' | 'processing' | 'completed' | 'failed';

  /** Progreso (0-100) */
  progress: number;

  /** Etapa actual */
  currentStage: PipelineStage;

  /** Mensaje descriptivo del progreso */
  message: string;

  /** Resultado final (solo si status es 'completed' o 'failed') */
  result?: ImportExecutionResult;
}
