import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import { AclService, AccessContext, LEVEL_RANK } from '../../common/acl/acl.service';
import { AuditService } from '../audit/audit.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { PublishProductDto } from './dto/publish-product.dto';
import { UnpublishProductDto } from './dto/unpublish-product.dto';
import { PriceInputDto } from './dto/price-input.dto';
import { Prisma } from '@prisma/client';
import * as XLSX from 'xlsx';
import { UPLOADS_DIR, UPLOADS_URL_PREFIX } from '../../common/uploads-path';

const ALLOWED_IMAGE_MIMETYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};
const MAX_IMAGE_SIZE = 8 * 1024 * 1024; // 8 MB

@Injectable()
export class ProductsService {
  constructor(
    private prisma: PrismaService,
    private acl: AclService,
    private audit: AuditService,
  ) {}

  private trendingCache: { data: any; timestamp: number } | null = null;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutos de expiración de caché

  /**
   * Cachea productos tendencia por 5 minutos
   */
  private getFromTrendingCache(): any | null {
    if (!this.trendingCache) return null;
    if (Date.now() - this.trendingCache.timestamp > this.CACHE_TTL) {
      this.trendingCache = null;
    }
    return this.trendingCache?.data || null;
  }

  private setTrendingCache(data: any): void {
    this.trendingCache = {
      data,
      timestamp: Date.now(),
    };
  }

  /**
   * Estado calculado de stock para un conjunto de productos (checklist 42):
   * 'in_stock' (availableQty > 0), 'out_of_stock' (availableQty 0), 'no_stock_data'
   * (sin registro de stock). No oculta productos automáticamente: la regla de
   * negocio para ocultar por falta de stock queda pendiente de decisión.
   */
  private async getStockStatusMap(
    productIds: string[],
  ): Promise<Map<string, 'in_stock' | 'out_of_stock' | 'no_stock_data'>> {
    if (!productIds.length) return new Map();
    const stocks = (await this.prisma.stock.findMany({
      where: { productId: { in: productIds } },
    })) ?? [];
    const map = new Map<string, 'in_stock' | 'out_of_stock' | 'no_stock_data'>();
    for (const s of stocks) {
      map.set(s.productId, s.availableQty > 0 ? 'in_stock' : 'out_of_stock');
    }
    return map;
  }

  /**
   * Obtiene productos tendencia (últimos 30 días visibles y activos)
   */
  async findTrending(params?: {
    take?: number;
    categoryId?: string;
    search?: string;
    forceReload?: boolean;
  }): Promise<{
    data: any;
    meta: { total: number; take?: number }
  }> {
    if (params?.forceReload || !this.getFromTrendingCache()) {
      const take = params?.take || 5;

      const where: Prisma.ProductWhereInput = {
        isVisible: true,
        isActive: true,
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        ...(params?.categoryId && { categoryId: params.categoryId }),
        ...(params?.search && {
          OR: [
            { name: { contains: params.search, mode: 'insensitive' } },
            { sku: { contains: params.search, mode: 'insensitive' } },
            { description: { contains: params.search, mode: 'insensitive' } },
          ],
        }),
      };

      const [products, total] = await Promise.all([
        this.prisma.product.findMany({
          where,
          take,
          orderBy: { createdAt: 'desc' },
          include: {
            category: { select: { id: true, name: true, slug: true } },
            brand: { select: { id: true, name: true, slug: true } },
            images: { where: { isPrimary: true }, take: 1 },
            prices: { include: { priceList: { select: { id: true, name: true, code: true } } } },
          },
        }),
        this.prisma.product.count({ where }),
      ]);

      this.setTrendingCache({
        data: products,
        meta: { total, take },
      });
    }

    const cached = this.getFromTrendingCache();
    return {
      data: cached?.data || [],
      meta: cached?.meta || { total: 0, take: params?.take || 5 },
    };
  }

  async findAll(
    params?: {
      skip?: number;
      take?: number;
      search?: string;
      categoryId?: string;
      brandId?: string;
      isVisible?: boolean;
      isActive?: boolean;
    },
    ctx?: AccessContext,
  ) {
    const { skip = 0, take = 50, search, categoryId, brandId, isVisible, isActive } = params || {};

    // Lazy unpublish: si algún producto publicado venció su unpublishAt, se despublica
    // en runtime (evaluación perezosa, sin cron). Ver autoUnpublishDueProducts().
    await this.autoUnpublishDueProducts();

    // ACL por Lista (deny-by-default) cuando se provee contexto de usuario.
    // ctx opcional: los llamadores legacy/tests sin ctx conservan el comportamiento abierto.
    let allowedListaIds: string[] | null = null;
    if (ctx) {
      allowedListaIds = await this.acl.getAllowedListaIds(ctx.userId, ctx.roles, 'view');
    }

    const where: Prisma.ProductWhereInput = {
      ...(allowedListaIds !== null && { listaId: { in: allowedListaIds.length ? allowedListaIds : [] } }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { sku: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      }),
      ...(categoryId && { categoryId }),
      ...(brandId && { brandId }),
      ...(isVisible !== undefined && { isVisible }),
      ...(isActive !== undefined && { isActive }),
    };

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take,
        include: {
          category: { select: { id: true, name: true, slug: true } },
          brand: { select: { id: true, name: true, slug: true } },
          images: { where: { isPrimary: true }, take: 1 },
          prices: {
            include: { priceList: { select: { id: true, name: true, code: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.product.count({ where }),
    ]);

    // Filtrado por restricción explícita de assignment PRODUCT (checklist 17/31).
    // Si el usuario tiene assignment PRODUCT con isActive=false sobre algún producto,
    // ese producto debe ser denegado (403) en findOne y excluido en findAll.
    // Si el usuario tiene assignment PRODUCT activo con nivel suficiente, se permite.
    let productAssignmentsCache: { resourceId: string; level: string; isActive: boolean }[] = [];
    if (ctx) {
      productAssignmentsCache = await this.prisma.assignment.findMany({
        where: { userId: ctx.userId, resourceType: 'PRODUCT' },
        select: { resourceId: true, level: true, isActive: true },
      });
    }

    const deniedProductIds = new Set<string>();
    const activeAssignmentsByProduct = new Map<string, string[]>();
    if (productAssignmentsCache?.length > 0) {
      for (const a of productAssignmentsCache) {
        if (!a.isActive) {
          deniedProductIds.add(a.resourceId);
        } else {
          const levels = activeAssignmentsByProduct.get(a.resourceId) || [];
          levels.push(a.level);
          activeAssignmentsByProduct.set(a.resourceId, levels);
        }
      }
    }

    const filteredProducts = products.filter((p) => {
      // Si el producto está en la lista de denegación por isActive=false, excluirlo
      if (deniedProductIds.has(p.id)) return false;
      // Si el usuario tiene assignment PRODUCT activo, verificar nivel
      if (activeAssignmentsByProduct.has(p.id)) {
        const productLevels = activeAssignmentsByProduct.get(p.id)!;
        const hasSufficientLevel = productLevels.some((lvl) => {
          const rank = (LEVEL_RANK[lvl] ?? 0);
          return rank >= (LEVEL_RANK['view'] ?? 0);
        });
        if (!hasSufficientLevel) return false;
      }
      return true;
    });

    const stockStatusMap = await this.getStockStatusMap(filteredProducts.map((p) => p.id));

    return {
      data: filteredProducts.map((p) => ({
        ...p,
        stockStatus: stockStatusMap.get(p.id) ?? 'no_stock_data',
      })),
      meta: { total: filteredProducts.length, skip, take },
    };
  }

  async findOne(id: string, ctx?: AccessContext) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        brand: true,
        images: { orderBy: { sortOrder: 'asc' } },
        prices: {
          include: { priceList: true },
        },
      },
    });

    if (!product) throw new NotFoundException('Producto no encontrado');

    // Lazy unpublish (sin cron): si el producto publicado venció su unpublishAt,
    // se despublica en runtime antes de devolverlo.
    if (product.publishStatus === 'publicado' && product.unpublishAt && product.unpublishAt <= new Date()) {
      await this.autoUnpublishOne(product.id);
      product.publishStatus = 'borrador';
      product.unpublishReason = 'auto';
      product.publishAt = null;
      product.publishedAt = null;
    }

    // Deny-by-default con restricción explícita por producto (checklist 17/31):
    // assertProductAccess evalúa assignments PRODUCT (deny prevalece) y cae a la
    // Lista dueña si no hay excepción por producto.
    if (ctx) {
      if (!product.listaId) throw new NotFoundException('Producto no encontrado');
      await this.acl.assertProductAccess(id, ctx, 'view');
    }

    const stock = await this.prisma.stock.findUnique({ where: { productId: id } });
    return {
      ...product,
      stockStatus: stock ? (stock.availableQty > 0 ? 'in_stock' : 'out_of_stock') : 'no_stock_data',
    };
  }

  async create(dto: CreateProductDto, ctx?: AccessContext) {
    const existingSku = await this.prisma.product.findUnique({ where: { sku: dto.sku } });
    if (existingSku) throw new ConflictException('Ya existe un producto con ese SKU');

    const category = await this.prisma.category.findUnique({ where: { id: dto.categoryId } });
    if (!category) throw new NotFoundException('Categoría no encontrada');

    const brand = await this.prisma.brand.findUnique({ where: { id: dto.brandId } });
    if (!brand) throw new NotFoundException('Marca no encontrada');

    await this.validatePriceLists(dto.prices);

    // Compatibilidad: toda creación de producto debe quedar asociada a una Lista.
    // Si se envía listaId se valida su existencia; si falta, se asigna LISTA-GENERAL
    // (fallback explícito y documentado para registros legados).  [decisiones 8/14]
    // La Lista también expone defaultVisibility: si no viene dto.isVisible explícito,
    // el producto nuevo hereda la visibilidad por defecto de su Lista.
    const lista = await this.resolveLista(dto.listaId);

    // ACL: crear producto exige `edit_products` sobre la Lista destino (checklist 29/30).
    if (ctx) await this.acl.assertListaAccess(lista.id, ctx, 'edit_products');

    const product = await this.prisma.product.create({
      data: {
        sku: dto.sku,
        name: dto.name,
        description: dto.description,
        categoryId: dto.categoryId,
        brandId: dto.brandId,
        listaId: lista.id,
        technicalSpecs: dto.technicalSpecs,
        extraAttributes: dto.extraAttributes,
        isActive: dto.isActive ?? false,
        isVisible: dto.isVisible ?? lista.defaultVisibility,
        ...(dto.publishStatus !== undefined && { publishStatus: dto.publishStatus }),
        ...(dto.publishAt !== undefined && { publishAt: dto.publishAt ? new Date(dto.publishAt) : null }),
        ...(dto.unpublishAt !== undefined && { unpublishAt: dto.unpublishAt ? new Date(dto.unpublishAt) : null }),
      },
      include: {
        category: { select: { id: true, name: true } },
        brand: { select: { id: true, name: true } },
      },
    });

    if (dto.prices && dto.prices.length > 0) {
      await this.upsertPrices(product.id, lista.id, dto.prices);
    }

    return product;
  }

  async update(id: string, dto: UpdateProductDto, ctx?: AccessContext) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException('Producto no encontrado');

    // ACL: editar producto exige `edit_products` sobre el producto/Lista (checklist 29/30).
    // assertProductAccess evalúa restricción explícita por producto + Lista dueña.
    if (ctx && product.listaId) {
      await this.acl.assertProductAccess(id, ctx, 'edit_products');
    }
    // Si se reasigna listaId, se autoriza además sobre la nueva Lista.
    let listaId: string | null = product.listaId ?? null;
    if (dto.listaId !== undefined) {
      const newLista = await this.resolveLista(dto.listaId);
      if (ctx && newLista.id !== product.listaId) {
        await this.acl.assertListaAccess(newLista.id, ctx, 'edit_products');
      }
      listaId = newLista.id;
    }

    if (dto.sku && dto.sku !== product.sku) {
      const existing = await this.prisma.product.findUnique({ where: { sku: dto.sku } });
      if (existing) throw new ConflictException('Ya existe un producto con ese SKU');
    }

    if (dto.categoryId) {
      const category = await this.prisma.category.findUnique({ where: { id: dto.categoryId } });
      if (!category) throw new NotFoundException('Categoría no encontrada');
    }

    if (dto.brandId) {
      const brand = await this.prisma.brand.findUnique({ where: { id: dto.brandId } });
      if (!brand) throw new NotFoundException('Marca no encontrada');
    }

    await this.validatePriceLists(dto.prices);

    const updated = await this.prisma.product.update({
      where: { id },
      data: {
        ...(dto.sku && { sku: dto.sku }),
        ...(dto.name && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.categoryId && { categoryId: dto.categoryId }),
        ...(dto.brandId && { brandId: dto.brandId }),
        ...(dto.listaId !== undefined && { listaId }),
        ...(dto.technicalSpecs !== undefined && { technicalSpecs: dto.technicalSpecs }),
        ...(dto.extraAttributes !== undefined && { extraAttributes: dto.extraAttributes }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.isVisible !== undefined && { isVisible: dto.isVisible }),
        ...(dto.publishStatus !== undefined && { publishStatus: dto.publishStatus }),
        ...(dto.publishAt !== undefined && { publishAt: dto.publishAt ? new Date(dto.publishAt) : null }),
        ...(dto.unpublishAt !== undefined && { unpublishAt: dto.unpublishAt ? new Date(dto.unpublishAt) : null }),
      },
      include: {
        category: { select: { id: true, name: true } },
        brand: { select: { id: true, name: true } },
      },
    });

    if (dto.prices && dto.prices.length > 0) {
      await this.upsertPrices(id, listaId, dto.prices);
    }

    return updated;
  }

  async toggleVisibility(id: string, ctx?: AccessContext) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException('Producto no encontrado');

    // Publicar/ocultar exige `edit_products` sobre el producto (checklist 29/30).
    if (ctx && product.listaId) {
      await this.acl.assertProductAccess(id, ctx, 'edit_products');
    }

    return this.prisma.product.update({
      where: { id },
      data: { isVisible: !product.isVisible },
    });
  }

  async toggleActive(id: string, ctx?: AccessContext) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException('Producto no encontrado');

    // Activar/desactivar exige `edit_products` sobre el producto (checklist 29/30).
    if (ctx && product.listaId) {
      await this.acl.assertProductAccess(id, ctx, 'edit_products');
    }

    return this.prisma.product.update({
      where: { id },
      data: { isActive: !product.isActive },
    });
  }

  /**
   * Lazy unpublish (decisión documentada, sin cron):
   * al leer productos (findOne/findAll) o al consultar publish-scheduled se evalúa
   * en runtime si `unpublishAt <= now && publishStatus == 'publicado'`. Si aplica,
   * el producto pasa a 'borrador' con unpublishReason 'auto'. Así la auto-despublicación
   * se resuelve en la primera lectura posterior a la fecha límite.
   */
  private async autoUnpublishOne(id: string): Promise<void> {
    await this.prisma.product.update({
      where: { id },
      data: { publishStatus: 'borrador', unpublishReason: 'auto', publishAt: null, publishedAt: null },
    });
    await this.audit.log({
      action: 'unpublish',
      entity: 'Product',
      entityId: id,
      oldValues: { publishStatus: 'publicado', unpublishReason: null },
      newValues: { publishStatus: 'borrador', unpublishReason: 'auto' },
    });
  }

  /**
   * Lazy unpublish en lote: procesa todos los productos publicados cuya
   * fecha de auto-despublicación ya venció (evaluación perezosa, sin cron).
   */
  private async autoUnpublishDueProducts(where: Prisma.ProductWhereInput = {}): Promise<void> {
    const due = (await this.prisma.product.findMany({
      where: {
        ...where,
        publishStatus: 'publicado',
        unpublishAt: { lte: new Date() },
      },
      select: { id: true },
    })) ?? [];

    if (due.length === 0) return;

    await this.prisma.product.updateMany({
      where: { id: { in: due.map((d) => d.id) } },
      data: { publishStatus: 'borrador', unpublishReason: 'auto', publishAt: null, publishedAt: null },
    });

    for (const d of due) {
      await this.audit.log({
        action: 'unpublish',
        entity: 'Product',
        entityId: d.id,
        oldValues: { publishStatus: 'publicado', unpublishReason: null },
        newValues: { publishStatus: 'borrador', unpublishReason: 'auto' },
      });
    }
  }

  /**
   * Checklist previo a publicación (documentado):
   *  (a) Lista destino activa y no archivada.
   *  (b) Producto activo (isActive).
   *  (c) Al menos 1 precio vigente (validFrom nulo o <= now y validUntil nulo o futuro) en la Lista.
   *  (d) Al menos 1 imagen.
   *  (e) Stock: si existe registro de stock, exige availableQty > 0.
   *      Si NO existe registro de stock, NO se bloquea (decisión documentada).
   * Devuelve la lista de TODOS los requisitos fallidos (mensaje 400 detallado).
   */
  private async validatePublishRequirements(product: {
    id: string;
    listaId: string | null;
    isActive: boolean;
  }): Promise<string[]> {
    const failures: string[] = [];
    const now = new Date();

    // (a) Lista destino activa y no archivada.
    let lista = null;
    if (product.listaId) {
      lista = await this.prisma.lista.findUnique({ where: { id: product.listaId } });
    }
    if (!lista || !lista.isActive || lista.archivedAt) {
      failures.push('La lista destino no está activa o está archivada');
    }

    // (b) Producto activo.
    if (!product.isActive) {
      failures.push('El producto no está activo');
    }

    // (c) Al menos 1 precio vigente en la Lista.
    const priceCount = await this.prisma.price.count({
      where: {
        productId: product.id,
        ...(product.listaId ? { listaId: product.listaId } : {}),
        AND: [
          { OR: [{ validFrom: null }, { validFrom: { lte: now } }] },
          { OR: [{ validUntil: null }, { validUntil: { gt: now } }] },
        ],
      },
    });
    if (priceCount === 0) {
      failures.push('El producto no tiene al menos un precio vigente en su lista');
    }

    // (d) Al menos 1 imagen.
    const imageCount = await this.prisma.productImage.count({ where: { productId: product.id } });
    if (imageCount === 0) {
      failures.push('El producto no tiene al menos una imagen');
    }

    // (e) Stock: solo bloquea si existe registro de stock con availableQty <= 0.
    const stock = await this.prisma.stock.findUnique({ where: { productId: product.id } });
    if (stock && stock.availableQty <= 0) {
      failures.push('El producto tiene stock registrado pero sin unidades disponibles (availableQty <= 0)');
    }

    return failures;
  }

  /**
   * Publica o programa publicación de un producto.
   *  - publishAt futuro: valida requisitos y deja en 'listo' (programado).
   *  - sin publishAt: valida requisitos y publica de inmediato ('publicado', publishedAt=now).
   * Si el producto ya está 'publicado' y se intenta publicar de nuevo → 409.
   */
  async publish(id: string, dto: PublishProductDto, ctx?: AccessContext) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException('Producto no encontrado');

    // Lazy unpublish primero: si venció su auto-despublicación, pasa a 'borrador'.
    if (product.publishStatus === 'publicado' && product.unpublishAt && product.unpublishAt <= new Date()) {
      await this.autoUnpublishOne(id);
      product.publishStatus = 'borrador';
      product.unpublishReason = 'auto';
      product.publishAt = null;
      product.publishedAt = null;
    }

    if (product.publishStatus === 'publicado') {
      throw new ConflictException('El producto ya está publicado');
    }

    // Publicar/programar exige `manage` sobre el producto/Lista (contrato publicación TANDA 1A).
    if (ctx && product.listaId) {
      await this.acl.assertProductAccess(id, ctx, 'manage');
    }

    const failures = await this.validatePublishRequirements(product);
    if (failures.length > 0) {
      const detail = failures.map((f, i) => `${i + 1}) ${f}`).join('; ');
      throw new BadRequestException(`No se puede publicar. Requisitos incumplidos: ${detail}`);
    }

    const now = new Date();
    const unpublishAt = dto.unpublishAt ? new Date(dto.unpublishAt) : null;

    // Publicación programada (futura).
    if (dto.publishAt) {
      const publishAt = new Date(dto.publishAt);
      const updated = await this.prisma.product.update({
        where: { id },
        data: {
          publishStatus: 'listo',
          publishAt,
          unpublishAt,
          publishedAt: null,
          unpublishReason: null,
          publishedById: ctx?.userId ?? null,
        },
      });

      await this.audit.log({
        userId: ctx?.userId,
        action: 'schedule_publish',
        entity: 'Product',
        entityId: id,
        oldValues: { publishStatus: product.publishStatus, publishAt: product.publishAt, unpublishAt: product.unpublishAt },
        newValues: { publishStatus: 'listo', publishAt, unpublishAt },
      });

      return updated;
    }

    // Publicación inmediata.
    const updated = await this.prisma.product.update({
      where: { id },
      data: {
        publishStatus: 'publicado',
        publishedAt: now,
        publishAt: null,
        unpublishAt,
        unpublishReason: null,
        publishedById: ctx?.userId ?? null,
      },
    });

    await this.audit.log({
      userId: ctx?.userId,
      action: 'publish',
      entity: 'Product',
      entityId: id,
      oldValues: { publishStatus: product.publishStatus, unpublishAt: product.unpublishAt },
      newValues: { publishStatus: 'publicado', publishedAt: now, publishAt: null, unpublishAt },
    });

    return updated;
  }

  /**
   * Despublica un producto: pasa a 'borrador' con unpublishReason.
   * Decisión documentada: 'archivado' es estado final de producto (archivar es aparte);
   * la despublicación normal usa 'borrador' + razón.
   */
  async unpublish(id: string, dto: UnpublishProductDto, ctx?: AccessContext) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException('Producto no encontrado');

    if (ctx && product.listaId) {
      await this.acl.assertProductAccess(id, ctx, 'manage');
    }

    const reason = dto.reason || 'Despublicado manualmente';

    const updated = await this.prisma.product.update({
      where: { id },
      data: {
        publishStatus: 'borrador',
        unpublishReason: reason,
        publishAt: null,
        publishedAt: null,
        unpublishAt: null,
      },
    });

    await this.audit.log({
      userId: ctx?.userId,
      action: 'unpublish',
      entity: 'Product',
      entityId: id,
      oldValues: { publishStatus: product.publishStatus, unpublishReason: product.unpublishReason },
      newValues: { publishStatus: 'borrador', unpublishReason: reason },
    });

    return updated;
  }

  /**
   * Lista productos programados (publishStatus 'listo') con publishAt en el rango
   * [from, to]. Si no vienen from/to, usa [now, now+7 días]. También aplica lazy unpublish.
   */
  async findPublishScheduled(from?: string, to?: string) {
    await this.autoUnpublishDueProducts();

    const now = new Date();
    const fromDate = from ? new Date(from) : now;
    const toDate = to ? new Date(to) : new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const products = (await this.prisma.product.findMany({
      where: {
        publishStatus: 'listo',
        publishAt: { gte: fromDate, lte: toDate },
      },
      select: {
        id: true,
        sku: true,
        name: true,
        publishAt: true,
        unpublishAt: true,
        lista: { select: { id: true, name: true, code: true } },
      },
      orderBy: { publishAt: 'asc' },
    })) ?? [];

    return { data: products };
  }

  async remove(id: string, ctx?: AccessContext) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException('Producto no encontrado');

    // Eliminar exige `edit_products` sobre el producto (checklist 29/30).
    if (ctx && product.listaId) {
      await this.acl.assertProductAccess(id, ctx, 'edit_products');
    }

    const images = await this.prisma.productImage.findMany({ where: { productId: id } });

    await this.prisma.price.deleteMany({ where: { productId: id } });
    await this.prisma.productImage.deleteMany({ where: { productId: id } });
    await this.prisma.product.delete({ where: { id } });

    for (const image of images) {
      const filename = path.basename(image.url);
      const filePath = path.join(UPLOADS_DIR, filename);
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch {
        // El archivo puede no existir en disco; no bloquea el borrado lógico.
      }
    }

    return { message: 'Producto eliminado exitosamente' };
  }

  /**
   * Sube una imagen para un producto y registra la fila ProductImage.
   * Valida tipo (jpeg/png/webp/gif) y tamaño máximo (8 MB).
   */
  async uploadImage(
    productId: string,
    file: Express.Multer.File,
    isPrimary = false,
    ctx?: AccessContext,
  ) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException('Producto no encontrado');

    // Subir imagen exige `edit_products` sobre el producto (checklist 29/30).
    if (ctx && product.listaId) {
      await this.acl.assertProductAccess(productId, ctx, 'edit_products');
    }

    if (!file) {
      throw new BadRequestException('Archivo requerido en el campo "file"');
    }

    const ext = ALLOWED_IMAGE_MIMETYPES[file.mimetype];
    if (!ext) {
      throw new BadRequestException('Tipo de archivo no permitido. Use JPEG, PNG, WEBP o GIF.');
    }

    if (file.size > MAX_IMAGE_SIZE) {
      throw new BadRequestException('El archivo excede el tamaño máximo de 8MB');
    }

    const filename = `${randomUUID()}.${ext}`;
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }
    await fs.promises.writeFile(path.join(UPLOADS_DIR, filename), file.buffer);

    const url = `${UPLOADS_URL_PREFIX}/${filename}`;

    if (isPrimary) {
      await this.prisma.productImage.updateMany({
        where: { productId, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    return this.prisma.productImage.create({
      data: {
        productId,
        url,
        alt: file.originalname || null,
        isPrimary,
        sortOrder: 0,
      },
    });
  }

  /**
   * Elimina una imagen: borra el registro y el archivo del disco si existe.
   */
  async deleteImage(imageId: string, ctx?: AccessContext) {
    const image = await this.prisma.productImage.findUnique({ where: { id: imageId } });
    if (!image) throw new NotFoundException('Imagen no encontrada');

    // Eliminar imagen exige `edit_products` sobre el producto dueño (checklist 29/30).
    if (ctx && image.productId) {
      await this.acl.assertProductAccess(image.productId, ctx, 'edit_products');
    }

    const filename = path.basename(image.url);
    const filePath = path.join(UPLOADS_DIR, filename);
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch {
      // El archivo puede no existir en disco; no bloquea el borrado lógico.
    }

    await this.prisma.productImage.delete({ where: { id: imageId } });
    return { message: 'Imagen eliminada exitosamente' };
  }

  /**
   * Resuelve la Lista a la que pertenece un producto.
   * Si se envía listaId, valida su existencia; si falta, asigna LISTA-GENERAL (fallback documentado).
   * Retorna también defaultVisibility para propagarla al crear productos sin isVisible explícito.
   * [decisiones 8/14]
   */
  private async resolveLista(listaId?: string): Promise<{ id: string; defaultVisibility: boolean }> {
    if (listaId) {
      const lista = await this.prisma.lista.findUnique({
        where: { id: listaId },
        select: { id: true, defaultVisibility: true },
      });
      if (!lista) throw new NotFoundException('Lista no encontrada');
      return lista;
    }

    const defaultLista = await this.prisma.lista.findUnique({
      where: { code: 'LISTA-GENERAL' },
      select: { id: true, defaultVisibility: true },
    });
    if (!defaultLista) throw new NotFoundException('Lista por defecto (LISTA-GENERAL) no encontrada');
    return defaultLista;
  }

  /**
   * Valida que todos los priceListId existan en BD.
   */
  private async validatePriceLists(prices?: PriceInputDto[]): Promise<void> {
    if (!prices || prices.length === 0) return;

    const ids = [...new Set(prices.map((p) => p.priceListId))];
    const found = await this.prisma.priceList.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    });
    const foundIds = new Set(found.map((pl) => pl.id));
    const missing = ids.filter((id) => !foundIds.has(id));

    if (missing.length > 0) {
      throw new NotFoundException(
        `Listas de precios no encontradas: ${missing.join(', ')}`,
      );
    }
  }

  /**
   * Upsert individual por (productId, priceListId) dentro de una transacción.
   * No borra precios no enviados para no perder datos.
   * Asocia el precio a la misma Lista del producto (invariante Price.listaId == Product.listaId).
   */
  private async upsertPrices(
    productId: string,
    listaId: string | null | undefined,
    prices: PriceInputDto[],
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      for (const price of prices) {
        const validFrom = price.validFrom ? new Date(price.validFrom) : undefined;
        const validUntil = price.validUntil ? new Date(price.validUntil) : undefined;

        await tx.price.upsert({
          where: { productId_priceListId: { productId, priceListId: price.priceListId } },
          update: {
            value: price.value,
            ...(price.currency && { currency: price.currency }),
            ...(validFrom && { validFrom }),
            ...(validUntil && { validUntil }),
            ...(listaId ? { listaId } : {}),
          },
          create: {
            productId,
            priceListId: price.priceListId,
            ...(listaId ? { listaId } : {}),
            value: price.value,
            currency: price.currency ?? 'COP',
            ...(validFrom && { validFrom }),
            ...(validUntil && { validUntil }),
          },
        });
      }
    });
  }

  async importFromExcel(file: Buffer) {
    if (!file) {
      throw new BadRequestException('No se proporcionó archivo');
    }

    const workbook = XLSX.read(file, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet);

    if (rows.length === 0) {
      throw new BadRequestException('El archivo está vacío');
    }

    const results = {
      total: rows.length,
      created: 0,
      skipped: 0,
      errors: [] as { row: number; sku: string; error: string }[],
    };

    // Get existing categories and brands for name-to-id mapping
    const categories = await this.prisma.category.findMany();
    const brands = await this.prisma.brand.findMany();

    // Fallback explícito documentado: LISTA-GENERAL (lista semilla) para productos importados.
    const defaultLista = await this.prisma.lista.findUnique({
      where: { code: 'LISTA-GENERAL' },
      select: { id: true },
    });
    const defaultListaId = defaultLista?.id ?? null;

    const categoryMap = new Map(categories.map(c => [c.name.toLowerCase(), c.id]));
    const brandMap = new Map(brands.map(b => [b.name.toLowerCase(), b.id]));

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] as any;
      const rowNum = i + 2; // Excel row number (1-based + header)

      try {
        // Map Excel columns to product fields
        // Expected columns: SKU, Nombre, Descripción, Categoría, Marca
        const sku = String(row['SKU'] || row['sku'] || row['Código'] || row['codigo'] || '').trim();
        const name = String(row['Nombre'] || row['nombre'] || row['Name'] || row['name'] || '').trim();
        const description = String(row['Descripción'] || row['descripcion'] || row['Description'] || row['description'] || '').trim();
        const categoryName = String(row['Categoría'] || row['categoria'] || row['Category'] || row['category'] || '').trim();
        const brandName = String(row['Marca'] || row['marca'] || row['Brand'] || row['brand'] || '').trim();

        // Validate required fields
        if (!sku) {
          results.errors.push({ row: rowNum, sku: 'N/A', error: 'SKU vacío' });
          results.skipped++;
          continue;
        }

        if (!name) {
          results.errors.push({ row: rowNum, sku, error: 'Nombre vacío' });
          results.skipped++;
          continue;
        }

        // Find or create category
        let categoryId = categoryMap.get(categoryName.toLowerCase());
        if (!categoryId && categoryName) {
          const newCategory = await this.prisma.category.create({
            data: {
              name: categoryName,
              slug: categoryName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
              isActive: true,
            },
          });
          categoryId = newCategory.id;
          categoryMap.set(categoryName.toLowerCase(), categoryId);
        }

        if (!categoryId) {
          results.errors.push({ row: rowNum, sku, error: 'Categoría no especificada' });
          results.skipped++;
          continue;
        }

        // Find or create brand
        let brandId = brandMap.get(brandName.toLowerCase());
        if (!brandId && brandName) {
          const newBrand = await this.prisma.brand.create({
            data: {
              name: brandName,
              slug: brandName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
              isActive: true,
            },
          });
          brandId = newBrand.id;
          brandMap.set(brandName.toLowerCase(), brandId);
        }

        if (!brandId) {
          results.errors.push({ row: rowNum, sku, error: 'Marca no especificada' });
          results.skipped++;
          continue;
        }

        // Check if SKU already exists
        const existingProduct = await this.prisma.product.findUnique({ where: { sku } });
        if (existingProduct) {
          results.errors.push({ row: rowNum, sku, error: 'SKU ya existe' });
          results.skipped++;
          continue;
        }

         await this.prisma.product.create({
           data: {
             sku,
             name,
             description: description || null,
             categoryId,
             brandId,
             listaId: defaultListaId,
             isActive: true,
             isVisible: false,
           },
         });

        results.created++;
      } catch (error) {
        results.errors.push({
          row: rowNum,
          sku: row['SKU'] || row['sku'] || 'N/A',
          error: error.message || 'Error desconocido',
        });
        results.skipped++;
      }
    }

    return results;
  }
}
