import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditService } from '../../../modules/audit/audit.service';
import { ExcelAdapter } from './sources/excel-adapter';
import { HeaderDetectorService } from './pipeline/header-detector.service';
import { ColumnMapperService } from './pipeline/column-mapper.service';
import { RowValidatorService } from './pipeline/row-validator.service';
import { RowNormalizerService } from './pipeline/row-normalizer.service';
import { BatchExecutorService } from './pipeline/batch-executor.service';
import {
  ImportContext,
  NormalizedRow,
  ValidatedRow,
  IvaMode,
} from './interfaces/import-context';
import { RawRow } from './interfaces/import-source.adapter';
import {
  ImportPreviewResult,
  ImportExecutionResult,
  ImportProgressResult,
  CurrentPriceResult,
  ValidationRowError,
} from './interfaces/import-result';
import {
  ColumnMapping,
  MappingPreset,
  SystemField,
} from './interfaces/column-mapping';
import { ColumnMappingDto, SectionDecisionDto } from './dto/preview-import.dto';
import { generateSlug } from './helpers/text-normalizer';

/**
 * Servicio orquestador del pipeline de importación.
 *
 * Coordina todas las etapas del pipeline:
 * Parse → Header Detection → Column Mapping → Validation → Normalization → Execution
 *
 * Expone dos modos de uso:
 * - Preview (dry-run): analiza el archivo sin modificar la BD
 * - Execute (commit): ejecuta la importación real con transacciones
 *
 * También gestiona presets de mapping y progreso de importación.
 */
@Injectable()
export class ImportService {
  private readonly logger = new Logger(ImportService.name);

  /** Cache de contextos de importación activos (por importId) */
  private importContexts = new Map<string, ImportContext>();

  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private excelAdapter: ExcelAdapter,
    private headerDetector: HeaderDetectorService,
    private columnMapper: ColumnMapperService,
    private rowValidator: RowValidatorService,
    private rowNormalizer: RowNormalizerService,
    private batchExecutor: BatchExecutorService,
  ) {}

  /**
   * FASE 1: Preview — Analiza el archivo y retorna lo que se importaría.
   * No modifica la base de datos.
   */
  async preview(
    file: Buffer,
    fileName: string,
    userId: string,
    dto?: {
      headerRowIndex?: number;
      columnMappings?: ColumnMappingDto[];
      presetId?: string;
      listaId?: string;
    },
  ): Promise<ImportPreviewResult> {
    const importId = randomUUID();

    // 1. Parsear archivo
    const parseResult = this.excelAdapter.parse(file, fileName);

    // 2. Detectar headers
    const headerRowIndex = dto?.headerRowIndex ?? 0;
    const detection = this.headerDetector.detect(
      parseResult.headers,
      parseResult.rows.slice(0, 5),
      { headerRowIndex },
    );

    // 3. Determinar mapping
    let columnMapping: ColumnMapping;

    if (dto?.columnMappings && dto.columnMappings.length > 0) {
      // Mapping manual del usuario
      columnMapping = this.columnMapper.confirmMapping(
        this.columnMapper.createFromDetection(detection),
        dto.columnMappings.map((m) => ({
          sourceColumn: m.sourceColumn,
          targetField: m.targetField as SystemField,
        })),
      );
    } else if (dto?.presetId) {
      // Aplicar preset guardado
      const preset = await this.getPreset(dto.presetId);
      if (!preset) {
        throw new BadRequestException('Preset de mapping no encontrado');
      }
      const presetMapping = this.columnMapper.applyPreset(
        preset,
        parseResult.headers,
      );
      if (!presetMapping) {
        throw new BadRequestException(
          'El preset no es compatible con este archivo. Las columnas del preset no se encuentran en el archivo.',
        );
      }
      columnMapping = presetMapping;
    } else {
      // Auto-mapping
      columnMapping = this.columnMapper.createFromDetection(detection);
    }

    // 4. El mapping puede estar incompleto aquí — el frontend muestra
    //    el paso de mapping para que el usuario ajuste antes de execute.
    //    La validación completa se hace en execute().

    // 5. Validar filas (solo si el mapping tiene los campos básicos)
    const validatedRows = parseResult.rows.map((raw, index) => ({
      rowIndex: index,
      rawData: raw,
      isValid: true,
      errors: [],
      warnings: [],
    }));

    const ctx: ImportContext = {
      importId,
      userId,
      fileName,
      fileSize: parseResult.fileSize,
      rawRows: parseResult.rows,
      headers: parseResult.headers,
      columnMapping,
      ivaMode: (dto?.columnMappings ? 'mixed' : 'with_iva') as IvaMode,
      listaId: dto?.listaId,
      validatedRows,
      normalizedRows: [],
      pipelineErrors: [],
      startedAt: new Date(),
      currentStage: 'validation',
    };

    const validated = this.rowValidator.validateAll(ctx);
    ctx.validatedRows = validated;

    // 6. Normalizar (para detectar updates vs creates)
    const normalized = this.rowNormalizer.normalizeAll(ctx);
    ctx.normalizedRows = normalized;

    // 6b. Resolver existencia de SKUs en DB para preview correcto
    await this.resolveExistingProductFlags(normalized);

    // Guardar contexto para la fase de ejecución
    this.importContexts.set(importId, ctx);

    // 7. Construir resultado de preview
    const toCreate = normalized.filter((n) => !n.isUpdate).length;
    const toUpdate = normalized.filter((n) => n.isUpdate).length;
    const skipped = validated.filter((r) => !r.isValid).length;

    const validationErrors: ValidationRowError[] = validated
      .filter((r) => !r.isValid)
      .map((r) => ({
        rowIndex: r.rowIndex,
        excelRow: r.rowIndex + 2,
        sku: this.extractSku(r, columnMapping),
        errors: r.errors.map((e) => ({
          field: e.field,
          code: e.code,
          message: e.message,
        })),
      }));

    return {
      importId,
      totalRows: parseResult.totalRows,
      validRows: normalized.length,
      invalidRows: skipped,
      breakdown: { toCreate, toUpdate, skipped },
      validationErrors,
      warnings: [],
      columnMapping: Object.fromEntries(
        columnMapping.entries.map((e) => [e.sourceColumn, e.targetField]),
      ),
      detectedHeaders: detection.headers,
      distinctValuesByColumn: this.computeDistinctValues(parseResult.rows, parseResult.headers),
      completedStage: 'validation',
    };
  }

  /**
   * FASE 2: Execute — Ejecuta la importación real.
   * Modifica la base de datos dentro de transacciones.
   */
  async execute(
    importId: string,
    dto: {
      columnMappings: ColumnMappingDto[];
      ivaMode?: IvaMode;
      headerRowIndex?: number;
      presetName?: string;
      listaId?: string;
      sections?: SectionDecisionDto[];
      fixedValues?: Partial<Record<SystemField, string>>;
    },
    userId: string,
  ): Promise<ImportExecutionResult> {
    const ctx = this.importContexts.get(importId);
    if (!ctx) {
      throw new BadRequestException(
        'Importación no encontrada. Ejecute primero el endpoint de preview.',
      );
    }

    // Actualizar IVA mode si se especificó
    if (dto.ivaMode) {
      ctx.ivaMode = dto.ivaMode;
    }

    // Lista destino: si se envía en execute, reemplaza la del preview;
    // si no se envía, se conserva la del preview (o cae a LISTA-GENERAL en batch).
    if (dto.listaId !== undefined) {
      ctx.listaId = dto.listaId;
    }

    // Valores fijos por campo: se aplican a todas las filas durante la
    // re-normalización (columna mapeada no vacía > fixedValue > inferencia).
    if (dto.fixedValues !== undefined) {
      ctx.fixedValues = dto.fixedValues;
    }

    // Decisiones de secciones del wizard: mapear sourceValue normalizado → decisión.
    // La clave se normaliza con generateSlug para comparar de forma consistente
    // con resolveCategory en batch execution.
    if (dto.sections && dto.sections.length > 0) {
      const decisions: NonNullable<ImportContext['sectionDecisions']> = {};
      for (const section of dto.sections) {
        const key = generateSlug(section.sourceValue);
        if (key) {
          decisions[key] = { targetName: section.targetName, action: section.action };
        }
      }
      ctx.sectionDecisions = decisions;
    }

    // Actualizar mapping si se proporcionó uno nuevo
    if (dto.columnMappings && dto.columnMappings.length > 0) {
      ctx.columnMapping = this.columnMapper.confirmMapping(
        ctx.columnMapping,
        dto.columnMappings.map((m) => ({
          sourceColumn: m.sourceColumn,
          targetField: m.targetField as SystemField,
        })),
      );
    }

    // Validar que el mapping tenga los campos requeridos ANTES de ejecutar
    const missingFields = this.columnMapper.validateMapping(ctx.columnMapping);
    if (missingFields.length > 0) {
      throw new BadRequestException(
        `Mapping incompleto. Campos requeridos faltantes: ${missingFields.join(', ')}. ` +
        `Use el endpoint de preview para ver los headers disponibles y ajuste el mapeo.`,
      );
    }

    // Re-validar filas con el mapping confirmado
    const validatedRows = ctx.rawRows.map((raw, index) => ({
      rowIndex: index,
      rawData: raw,
      isValid: true,
      errors: [],
      warnings: [],
    }));
    ctx.validatedRows = validatedRows;
    const revalidated = this.rowValidator.validateAll(ctx);
    ctx.validatedRows = revalidated;

    // Re-normalizar con el mapping actualizado
    const renormalized = this.rowNormalizer.normalizeAll(ctx);
    ctx.normalizedRows = renormalized;

    // Resolver existencia de SKUs en DB
    await this.resolveExistingProductFlags(renormalized);

    ctx.currentStage = 'batch_execution';
    ctx.userId = userId;

    // Ejecutar batch
    const result = await this.batchExecutor.execute(
      ctx.normalizedRows,
      ctx,
    );

    ctx.executionResult = result;
    ctx.currentStage = 'batch_execution';

    // Guardar preset si se solicita
    if (dto.presetName) {
      await this.savePreset(
        ctx.columnMapping,
        dto.presetName,
        userId,
      );
    }

    // Limpiar contexto
    this.importContexts.delete(importId);

    return {
      importId,
      summary: {
        total: result.total,
        created: result.created,
        updated: result.updated,
        skipped: result.skipped,
        errors: result.errors.length,
        defaultsByMissingInference: result.defaultsByMissingInference ?? { category: 0, brand: 0 },
      },
      executionErrors: result.errors,
      durationMs: result.durationMs,
      completedAt: new Date().toISOString(),
    };
  }

  /**
   * Obtiene el progreso de una importación activa.
   */
  getProgress(importId: string): ImportProgressResult {
    const ctx = this.importContexts.get(importId);

    if (!ctx) {
      return {
        importId,
        status: 'completed',
        progress: 100,
        currentStage: 'batch_execution',
        message: 'Importación completada',
      };
    }

    const progress = this.calculateProgress(ctx);

    return {
      importId,
      status: 'processing',
      progress,
      currentStage: ctx.currentStage,
      message: this.getStageMessage(ctx.currentStage),
    };
  }

  // === Presets de Mapping ===

  /**
   * Precio vigente por SKU para el wizard de importación.
   *
   * 1. Busca el producto por SKU exacto (case-insensitive) dentro de la lista
   *    destino (listaId opcional; si no viene, toma el primero que encuentre).
   * 2. Si no existe producto → `{ data: null }`.
   * 3. Si existe producto → precio vigente con el mismo criterio de vigencia que
   *    prices.service (`validFrom <= hoy <= validUntil`, límites abiertos con
   *    null); si hay múltiples, el más reciente (orderBy updatedAt desc).
   * 4. Sin precio vigente → `{ data: { ...producto, exists: false } }`.
   */
  async getCurrentPriceBySku(
    sku: string,
    listaId?: string,
  ): Promise<{ data: CurrentPriceResult | null }> {
    const skuTrimmed = sku?.trim();
    if (!skuTrimmed) return { data: null };

    const products = await this.prisma.product.findMany({
      where: {
        sku: { equals: skuTrimmed, mode: 'insensitive' },
        ...(listaId ? { listaId } : {}),
      },
      select: { id: true, sku: true, name: true },
      take: 1,
    });

    const product = products[0];
    if (!product) return { data: null };

    // Precios del producto: primero filtrados por la lista destino (listaId).
    // Los precios importados viven con `listaId: null` y se vinculan vía
    // `priceListId` (PriceList no tiene relación FK con Lista, así que no es
    // trazable a una lista concreta sin migración). Si no hay ningún precio con
    // el listaId de la lista, se hace fallback al precio vigente global del
    // producto (sin filtro de listaId) para que el wizard compare "precio
    // actual" aunque el precio se importó sin listaId.
    let prices = await this.prisma.price.findMany({
      where: {
        productId: product.id,
        ...(listaId ? { listaId } : {}),
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (listaId && prices.length === 0) {
      prices = await this.prisma.price.findMany({
        where: { productId: product.id },
        orderBy: { updatedAt: 'desc' },
      });
    }

    const now = new Date();
    const vigentes = prices.filter(
      (p) =>
        (!p.validFrom || p.validFrom <= now) &&
        (!p.validUntil || p.validUntil >= now),
    );
    // "Más reciente": el vigente con updatedAt más nuevo (determinista).
    const vigente = vigentes.reduce<typeof prices[number] | null>(
      (best, p) =>
        !best || (p.updatedAt?.getTime() ?? 0) >= (best.updatedAt?.getTime() ?? 0)
          ? p
          : best,
      null,
    );

    if (!vigente) {
      return {
        data: {
          sku: product.sku,
          productId: product.id,
          name: product.name,
          price: null,
          currency: null,
          validUntil: null,
          exists: false,
        },
      };
    }

    return {
      data: {
        sku: product.sku,
        productId: product.id,
        name: product.name,
        price: Number(vigente.value),
        currency: vigente.currency,
        validUntil: vigente.validUntil ?? null,
        exists: true,
      },
    };
  }

  /**
   * Lista todos los presets del usuario.
   */
  async listPresets(userId: string): Promise<MappingPreset[]> {
    const presets = await this.prisma.importMapping.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return presets.map((p) => ({
      id: p.id,
      name: p.name,
      mappings: p.mappings as Array<{ sourceColumn: string; targetField: SystemField }>,
      userId: p.userId,
      createdAt: p.createdAt.toISOString(),
      isDefault: p.isDefault,
    }));
  }

  /**
   * Obtiene un preset por ID.
   */
  async getPreset(presetId: string): Promise<MappingPreset | null> {
    const preset = await this.prisma.importMapping.findUnique({
      where: { id: presetId },
    });

    if (!preset) return null;

    return {
      id: preset.id,
      name: preset.name,
      mappings: preset.mappings as Array<{ sourceColumn: string; targetField: SystemField }>,
      userId: preset.userId,
      createdAt: preset.createdAt.toISOString(),
      isDefault: preset.isDefault,
    };
  }

  /**
   * Guarda un nuevo preset de mapping.
   *
   * Normaliza la entrada antes de persistir:
   * - Array plano `[{ sourceColumn, targetField }]` (lo que envía la UI:
   *   MappingPresetManager, ImportStepConfirm, ListaDetailPage) → se convierte
   *   al formato interno `{ entries: [...], confirmed: true }`.
   * - Formato interno `{ entries, confirmed }` (lo que usa execute() al guardar
   *   el mapping del contexto) → se conserva tal cual.
   * El formato de LECTURA no cambia: GET devuelve `mappings: [{sourceColumn, targetField}]`
   * (el contrato que el frontend ya parsea al cargar presets).
   */
  async savePreset(
    mapping: ColumnMapping | Array<{ sourceColumn: string; targetField: SystemField }>,
    name: string,
    userId: string,
    isDefault = false,
  ): Promise<MappingPreset> {
    const presetData = this.columnMapper.toPreset(
      this.normalizeMappingForPreset(mapping),
      name,
      userId,
      isDefault,
    );

    const preset = await this.prisma.importMapping.create({
      data: {
        name: presetData.name,
        mappings: presetData.mappings as any,
        userId: presetData.userId,
        isDefault: presetData.isDefault,
      },
    });

    return {
      id: preset.id,
      name: preset.name,
      mappings: preset.mappings as Array<{ sourceColumn: string; targetField: SystemField }>,
      userId: preset.userId,
      createdAt: preset.createdAt.toISOString(),
      isDefault: preset.isDefault,
    };
  }

  /**
   * Elimina un preset.
   */
  async deletePreset(presetId: string, userId: string): Promise<void> {
    const preset = await this.prisma.importMapping.findUnique({
      where: { id: presetId },
    });

    if (!preset || preset.userId !== userId) {
      throw new BadRequestException('Preset no encontrado');
    }

    await this.prisma.importMapping.delete({ where: { id: presetId } });
  }

  // === Helpers privados ===

  /**
   * Normaliza un mapping recibido al formato interno `ColumnMapping`.
   * Soporta el array plano `[{ sourceColumn, targetField }]` que envía la UI
   * y el formato interno `{ entries, confirmed }` que usa el pipeline.
   */
  private normalizeMappingForPreset(
    mapping: ColumnMapping | Array<{ sourceColumn: string; targetField: SystemField }>,
  ): ColumnMapping {
    if (Array.isArray(mapping)) {
      return {
        entries: mapping.map((m) => ({
          sourceColumn: m.sourceColumn,
          targetField: m.targetField,
          isRequired: ['sku', 'name'].includes(m.targetField),
          confidence: 1.0,
        })),
        confirmed: true,
      };
    }
    return mapping;
  }

  /**
   * Resuelve isUpdate y existingProductId en filas normalizadas
   * consultando la DB por SKUs existentes.
   */
  private async resolveExistingProductFlags(rows: NormalizedRow[]): Promise<void> {
    const skus = rows.map((r) => r.sku);
    if (skus.length === 0) return;

    const existingProducts = await this.prisma.product.findMany({
      where: { sku: { in: skus } },
      select: { id: true, sku: true },
    });

    const skuToId = new Map(existingProducts.map((p) => [p.sku, p.id]));

    for (const row of rows) {
      const existingId = skuToId.get(row.sku);
      if (existingId) {
        row.isUpdate = true;
        row.existingProductId = existingId;
      }
    }
  }

  private extractSku(validatedRow: ValidatedRow, mapping: ColumnMapping): string {
    const skuEntry = mapping.entries.find((e) => e.targetField === 'sku');
    if (!skuEntry) return 'N/A';
    const val = validatedRow.rawData[skuEntry.sourceColumn];
    return val ? String(val).trim() : 'N/A';
  }

  /**
   * Valores únicos por columna (top 50 por frecuencia desc) para que el wizard
   * detecte las secciones/categorías que trae el archivo. Excluye celdas vacías.
   */
  private computeDistinctValues(
    rows: RawRow[],
    headers: string[],
  ): Record<string, Array<{ value: string; count: number }>> {
    const out: Record<string, Array<{ value: string; count: number }>> = {};

    for (const header of headers) {
      const counts = new Map<string, number>();
      for (const row of rows) {
        const raw = row[header];
        if (raw === null || raw === undefined) continue;
        const value = String(raw).trim();
        if (!value) continue;
        counts.set(value, (counts.get(value) ?? 0) + 1);
      }
      out[header] = [...counts.entries()]
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
        .slice(0, 50);
    }

    return out;
  }

  private calculateProgress(ctx: ImportContext): number {
    const stageWeights: Record<string, number> = {
      parse: 10,
      header_detection: 20,
      column_mapping: 30,
      validation: 50,
      normalization: 70,
      batch_execution: 90,
    };

    return stageWeights[ctx.currentStage] ?? 0;
  }

  private getStageMessage(stage: string): string {
    const messages: Record<string, string> = {
      parse: 'Parseando archivo...',
      header_detection: 'Detectando columnas...',
      column_mapping: 'Mapeando columnas...',
      validation: 'Validando datos...',
      normalization: 'Normalizando datos...',
      batch_execution: 'Ejecutando importación...',
    };

    return messages[stage] ?? 'Procesando...';
  }
}
