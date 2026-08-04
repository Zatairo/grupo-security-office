import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../prisma/prisma.service';
import { AuditService } from '../../../audit/audit.service';
import {
  NormalizedRow,
  PriceEntry,
  BatchExecutionResult,
  BatchError,
  ImportContext,
} from '../interfaces/import-context';

/**
 * Configuración de batch execution.
 */
interface BatchConfig {
  /** Tamaño de cada batch (filas por transacción) */
  batchSize: number;
  /** Máximo de reintentos por batch */
  maxRetries: number;
  /** Delay entre batches en ms (para no saturar la DB) */
  delayBetweenBatches: number;
}

const DEFAULT_BATCH_CONFIG: BatchConfig = {
  batchSize: 50,
  maxRetries: 2,
  delayBetweenBatches: 100,
};

/**
 * Servicio de ejecución en batch.
 *
 * Ejecuta la inserción/actualización de productos en la BD
 * usando transacciones Prisma de a 50 filas.
 *
 * Responsabilidades:
 * - Resolver categorías y marcas (find or create)
 * - Detectar SKUs existentes (create vs update)
 * - Ejecutar en batches con $transaction
 * - Crear/actualizar listas de precios y precios
 * - Registrar auditoría
 * - Reintentar batches fallidos
 */
@Injectable()
export class BatchExecutorService {
  private readonly logger = new Logger(BatchExecutorService.name);

  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  /**
   * Ejecuta la importación completa de filas normalizadas.
   */
  async execute(
    normalizedRows: NormalizedRow[],
    ctx: ImportContext,
    config?: Partial<BatchConfig>,
  ): Promise<BatchExecutionResult> {
    const batchConfig = { ...DEFAULT_BATCH_CONFIG, ...config };
    const startTime = Date.now();

    const result: BatchExecutionResult = {
      total: normalizedRows.length,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [],
      productIds: [],
      durationMs: 0,
      defaultsByMissingInference: { category: 0, brand: 0 },
    };

    // Pre-cargar categorías y marcas existentes
    const [existingCategories, existingBrands, existingPriceLists] = await Promise.all([
      this.prisma.category.findMany({ select: { id: true, name: true, slug: true } }),
      this.prisma.brand.findMany({ select: { id: true, name: true, slug: true } }),
      this.prisma.priceList.findMany({ select: { id: true, code: true, name: true } }),
    ]);

    const categoryMap = new Map<string, { id: string; name: string; slug: string }>(
      existingCategories.map((c) => [c.name.toLowerCase(), c]),
    );
    const brandMap = new Map<string, { id: string; name: string; slug: string }>(
      existingBrands.map((b) => [b.name.toLowerCase(), b]),
    );
    const priceListMap = new Map<string, { id: string; code: string; name: string }>(
      existingPriceLists.map((pl) => [pl.code, pl]),
    );

    // Procesar en batches
    const batches = this.chunk(normalizedRows, batchConfig.batchSize);

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];

      try {
        const batchResult = await this.executeBatch(
          batch,
          categoryMap,
          brandMap,
          priceListMap,
          ctx,
        );

        result.created += batchResult.created;
        result.updated += batchResult.updated;
        result.skipped += batchResult.skipped;
        result.productIds.push(...batchResult.productIds);
        result.errors.push(...batchResult.errors);
        result.defaultsByMissingInference.category += batchResult.defaults.category;
        result.defaultsByMissingInference.brand += batchResult.defaults.brand;

        this.logger.log(
          `Batch ${batchIndex + 1}/${batches.length} completado: ` +
          `+${batchResult.created} ~${batchResult.updated} ⏭${batchResult.skipped}`,
        );
      } catch (error) {
        this.logger.error(
          `Error en batch ${batchIndex + 1}/${batches.length}: ${error.message}`,
        );

        // Marcar todo el batch como errores
        for (const row of batch) {
          result.errors.push({
            rowIndex: row.rowIndex,
            sku: row.sku,
            error: `Error en batch: ${error.message}`,
          });
          result.skipped++;
        }
      }

      // Delay entre batches (excepto el último)
      if (batchIndex < batches.length - 1) {
        await this.delay(batchConfig.delayBetweenBatches);
      }
    }

    result.durationMs = Date.now() - startTime;

    // Registrar auditoría
    await this.auditImport(ctx, result);

    return result;
  }

  /**
   * Ejecuta un batch individual dentro de una transacción Prisma.
   */
  private async executeBatch(
    batch: NormalizedRow[],
    categoryMap: Map<string, { id: string; name: string; slug: string }>,
    brandMap: Map<string, { id: string; name: string; slug: string }>,
    priceListMap: Map<string, { id: string; code: string; name: string }>,
    ctx: ImportContext,
  ): Promise<{
    created: number;
    updated: number;
    skipped: number;
    productIds: string[];
    errors: BatchError[];
    defaults: { category: number; brand: number };
  }> {
    return this.prisma.$transaction(async (tx) => {
      const batchResult = {
        created: 0,
        updated: 0,
        skipped: 0,
        productIds: [] as string[],
        errors: [] as BatchError[],
        defaults: { category: 0, brand: 0 },
      };

      // Pre-cargar SKUs existentes en este batch
      const skus = batch.map((r) => r.sku);
      const existingProducts = await tx.product.findMany({
        where: { sku: { in: skus } },
        select: { id: true, sku: true },
      });
      const existingSkuMap = new Map<string, string>(
        existingProducts.map((p) => [p.sku, p.id]),
      );

      for (const row of batch) {
        try {
          // Resolver categoría (siempre retorna un ID — default "Sin categoría" si vacío)
          const categoryResult = await this.resolveCategory(
            tx,
            row.categoryName,
            row.categoryInferredSlug,
            categoryMap,
            batchResult.defaults,
          );

          // Resolver marca (siempre retorna un ID — default "Sin marca" si vacío)
          const brandResult = await this.resolveBrand(
            tx,
            row.brandName,
            row.brandInferredSlug,
            brandMap,
            batchResult.defaults,
          );

          const existingProductId = existingSkuMap.get(row.sku);

          if (existingProductId) {
            // UPDATE: producto ya existe
            await tx.product.update({
              where: { id: existingProductId },
              data: {
                name: row.name,
                description: row.description ?? undefined,
                categoryId: categoryResult.id,
                brandId: brandResult.id,
                technicalSpecs: (row.technicalSpecs as Prisma.InputJsonValue) ?? Prisma.JsonNull,
                extraAttributes: (row.extraAttributes as Prisma.InputJsonValue) ?? Prisma.JsonNull,
              },
            });

            // Actualizar precios
            if (row.prices.length > 0) {
              await this.upsertPrices(tx, existingProductId, row.prices, priceListMap);
            }

            batchResult.updated++;
            batchResult.productIds.push(existingProductId);
          } else {
            // CREATE: producto nuevo
            const newProduct = await tx.product.create({
              data: {
                sku: row.sku,
                name: row.name,
                description: row.description ?? undefined,
                categoryId: categoryResult.id,
                brandId: brandResult.id,
                technicalSpecs: (row.technicalSpecs as Prisma.InputJsonValue) ?? Prisma.JsonNull,
                extraAttributes: (row.extraAttributes as Prisma.InputJsonValue) ?? Prisma.JsonNull,
                isActive: true,
                isVisible: false,
              },
            });

            // Crear precios
            if (row.prices.length > 0) {
              await this.upsertPrices(tx, newProduct.id, row.prices, priceListMap);
            }

            batchResult.created++;
            batchResult.productIds.push(newProduct.id);
          }
        } catch (error) {
          batchResult.errors.push({
            rowIndex: row.rowIndex,
            sku: row.sku,
            error: error.message || 'Error desconocido',
          });
          batchResult.skipped++;
        }
      }

      return batchResult;
    });
  }

  /**
   * Resuelve una categoría por nombre: busca existente o crea nueva.
   * Si el nombre está vacío, retorna la categoría default "Sin categoría".
   *
   * Si viene un slug inferido, solo se usa la categoría EXISTENTE por slug;
   * si no existe, se cae al default y se cuenta como "default por falta de inferencia".
   */
  private async resolveCategory(
    tx: any,
    name: string,
    inferredSlug: string | undefined,
    categoryMap: Map<string, { id: string; name: string; slug: string }>,
    defaults: { category: number; brand: number },
  ): Promise<{ id: string }> {
    const normalizedName = name?.toLowerCase().trim() ?? '';

    // Inferencia: solo usar categoría existente por slug
    if (inferredSlug) {
      const found = await tx.category.findFirst({ where: { slug: inferredSlug } });
      if (found) return found;
      defaults.category++;
      return this.resolveDefaultCategory(tx, categoryMap);
    }

    // Si no hay nombre, usar default "Sin categoría"
    if (!normalizedName) {
      defaults.category++;
      return this.resolveDefaultCategory(tx, categoryMap);
    }

    const existing = categoryMap.get(normalizedName);
    if (existing) return existing;

    // Crear nueva categoría
    const slug = normalizedName
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    const newCategory = await tx.category.create({
      data: {
        name: name.trim(),
        slug,
        isActive: true,
      },
    });

    categoryMap.set(normalizedName, newCategory);
    return newCategory;
  }

  /**
   * Retorna (creando si hace falta) la categoría default "Sin categoría".
   */
  private async resolveDefaultCategory(
    tx: any,
    categoryMap: Map<string, { id: string; name: string; slug: string }>,
  ): Promise<{ id: string }> {
    const defaultSlug = 'sin-categoria';
    const existing = categoryMap.get('sin categoría');
    if (existing) return existing;

    const found = await tx.category.findFirst({ where: { slug: defaultSlug } });
    if (found) {
      categoryMap.set('sin categoría', found);
      return found;
    }

    const created = await tx.category.create({
      data: { name: 'Sin categoría', slug: defaultSlug, isActive: true },
    });
    categoryMap.set('sin categoría', created);
    return created;
  }

  /**
   * Resuelve una marca por nombre: busca existente o crea nueva.
   * Si el nombre está vacío, retorna la marca default "Sin marca".
   *
   * Si viene un slug inferido, solo se usa la marca EXISTENTE por slug;
   * si no existe, se cae al default y se cuenta como "default por falta de inferencia".
   */
  private async resolveBrand(
    tx: any,
    name: string,
    inferredSlug: string | undefined,
    brandMap: Map<string, { id: string; name: string; slug: string }>,
    defaults: { category: number; brand: number },
  ): Promise<{ id: string }> {
    const normalizedName = name?.toLowerCase().trim() ?? '';

    // Inferencia: solo usar marca existente por slug
    if (inferredSlug) {
      const found = await tx.brand.findFirst({ where: { slug: inferredSlug } });
      if (found) return found;
      defaults.brand++;
      return this.resolveDefaultBrand(tx, brandMap);
    }

    // Si no hay nombre, usar default "Sin marca"
    if (!normalizedName) {
      defaults.brand++;
      return this.resolveDefaultBrand(tx, brandMap);
    }

    const existing = brandMap.get(normalizedName);
    if (existing) return existing;

    const slug = normalizedName
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    const newBrand = await tx.brand.create({
      data: {
        name: name.trim(),
        slug,
        isActive: true,
      },
    });

    brandMap.set(normalizedName, newBrand);
    return newBrand;
  }

  /**
   * Retorna (creando si hace falta) la marca default "Sin marca".
   */
  private async resolveDefaultBrand(
    tx: any,
    brandMap: Map<string, { id: string; name: string; slug: string }>,
  ): Promise<{ id: string }> {
    const defaultSlug = 'sin-marca';
    const existing = brandMap.get('sin marca');
    if (existing) return existing;

    const found = await tx.brand.findFirst({ where: { slug: defaultSlug } });
    if (found) {
      brandMap.set('sin marca', found);
      return found;
    }

    const created = await tx.brand.create({
      data: { name: 'Sin marca', slug: defaultSlug, isActive: true },
    });
    brandMap.set('sin marca', created);
    return created;
  }

  /**
   * Upsert de precios para un producto.
   * Crea o actualiza precios en las listas correspondientes.
   */
  private async upsertPrices(
    tx: any,
    productId: string,
    prices: PriceEntry[],
    priceListMap: Map<string, { id: string; code: string; name: string }>,
  ): Promise<void> {
    for (const price of prices) {
      let priceList = priceListMap.get(price.priceListCode);

      // Crear lista de precios si no existe
      if (!priceList) {
        const newPriceList = await tx.priceList.create({
          data: {
            name: price.priceListName,
            code: price.priceListCode,
            currency: price.currency,
            isActive: true,
          },
        });
        priceList = newPriceList;
        priceListMap.set(price.priceListCode, newPriceList);
      }

      // Upsert del precio
      const existingPrice = await tx.price.findUnique({
        where: {
          productId_priceListId: {
            productId,
            priceListId: priceList.id,
          },
        },
      });

      if (existingPrice) {
        await tx.price.update({
          where: { id: existingPrice.id },
          data: { value: price.value },
        });
      } else {
        await tx.price.create({
          data: {
            productId,
            priceListId: priceList.id,
            value: price.value,
            currency: price.currency,
          },
        });
      }
    }
  }

  /**
   * Registra auditoría de la importación completa.
   */
  private async auditImport(
    ctx: ImportContext,
    result: BatchExecutionResult,
  ): Promise<void> {
    try {
      // NUEVO: extraer columnas mapeadas vs skipped vs extra
      const columnsMapped: string[] = [];
      const columnsExtra: string[] = [];
      const columnsSkipped: string[] = [];

      for (const entry of ctx.columnMapping.entries) {
        if (entry.targetField === '__skip') {
          columnsSkipped.push(entry.sourceColumn);
        } else if (entry.targetField === '__extra') {
          columnsExtra.push(entry.sourceColumn);
        } else {
          columnsMapped.push(`${entry.sourceColumn}→${entry.targetField}`);
        }
      }

      await this.auditService.log({
        userId: ctx.userId,
        action: 'IMPORT_PRODUCTS',
        entity: 'Product',
        entityId: ctx.importId,
        newValues: {
          fileName: ctx.fileName,
          totalRows: result.total,
          created: result.created,
          updated: result.updated,
          skipped: result.skipped,
          errors: result.errors.length,
          durationMs: result.durationMs,
          defaultsByMissingInference: result.defaultsByMissingInference,
          columnsMapped,
          columnsExtra,
          columnsSkipped,
        },
      });
    } catch (error) {
      this.logger.warn(`Error al registrar auditoría: ${error.message}`);
    }
  }

  /**
   * Divide un array en chunks del tamaño especificado.
   */
  private chunk<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Delay asíncrono.
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
