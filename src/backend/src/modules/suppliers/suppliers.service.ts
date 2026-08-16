import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AccessContext } from '../../common/acl/acl.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { CreateEvaluationDto } from './dto/create-evaluation.dto';
import { CreateStockDto } from './dto/create-stock.dto';
import { UpdateStockDto } from './dto/update-stock.dto';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { UpdatePurchaseOrderStatusDto, PO_STATUSES } from './dto/update-purchase-order-status.dto';
import { randomBytes } from 'crypto';

/** Matriz de transiciones válidas del flujo de órdenes de compra (checklist 45-49). */
const PO_TRANSITIONS: Record<string, string[]> = {
  solicitada: ['aprobada', 'cancelada'],
  aprobada: ['en_transito', 'cancelada'],
  en_transito: ['recibida', 'cancelada'],
  recibida: ['cerrada'],
  cerrada: [],
  cancelada: [],
};

/**
 * Quién mueve cada estado de una orden de compra:
 * - solicitada / aprobada / en_transito / recibida: roles de escritura (Super Admin, Admin Comercial).
 * - cerrada / cancelada: solo Super Admin.
 */
const PO_STATUS_ROLES: Record<string, string[]> = {
  solicitada: ['Super Admin', 'Admin Comercial'],
  aprobada: ['Super Admin', 'Admin Comercial'],
  en_transito: ['Super Admin', 'Admin Comercial'],
  recibida: ['Super Admin', 'Admin Comercial'],
  cerrada: ['Super Admin'],
  cancelada: ['Super Admin'],
};

/** Días sin evaluación para considerar a un proveedor "sin evaluación reciente". */
const EVALUATION_STALENESS_DAYS = 90;

@Injectable()
export class SuppliersService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  // ============================== Suppliers ==============================

  /** Lista proveedores (filtro por name/nit contains y status exacto). */
  async findAllSuppliers(params?: { search?: string; status?: string }) {
    const where: Record<string, unknown> = {};
    if (params?.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { nit: { contains: params.search, mode: 'insensitive' } },
      ];
    }
    if (params?.status) where.status = params.status;

    const suppliers = await this.prisma.supplier.findMany({
      where,
      include: { _count: { select: { evaluations: true } } },
      orderBy: { name: 'asc' },
    });
    const scores = await this.supplierScoreMap();

    return {
      data: suppliers.map((s) => ({
        ...s,
        evaluationCount: s._count.evaluations,
        averageScore: scores.get(s.id)?.averageScore ?? null,
      })),
    };
  }

  /** Detalle de un proveedor (incluye promedio y fecha de última evaluación). */
  async findOneSupplier(id: string) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id },
      include: { _count: { select: { evaluations: true, purchaseOrders: true } } },
    });
    if (!supplier) throw new NotFoundException('Proveedor no encontrado');
    const score = (await this.supplierScoreMap()).get(id);
    return {
      ...supplier,
      averageScore: score?.averageScore ?? null,
      lastEvaluationDate: score?.lastEvaluationDate ?? null,
    };
  }

  /** Crear proveedor — nit único (409 si duplicado). */
  async createSupplier(dto: CreateSupplierDto, ctx: AccessContext) {
    const existing = await this.prisma.supplier.findUnique({
      where: { nit: dto.nit },
      select: { id: true },
    });
    if (existing) throw new ConflictException('Ya existe un proveedor con ese NIT');

    const created = await this.prisma.supplier.create({
      data: {
        name: dto.name,
        nit: dto.nit,
        contact: (dto.contact ?? undefined) as any,
        category: dto.category,
        status: dto.status ?? 'active',
        rating: dto.rating,
      },
    });

    await this.audit.log({
      userId: ctx.userId,
      action: 'create',
      entity: 'Supplier',
      entityId: created.id,
      newValues: {
        name: created.name,
        nit: created.nit,
        category: created.category,
        status: created.status,
      },
    });

    return created;
  }

  /** Actualizar proveedor (parcial) — nit único si cambia. */
  async updateSupplier(id: string, dto: UpdateSupplierDto, ctx: AccessContext) {
    const supplier = await this.prisma.supplier.findUnique({ where: { id } });
    if (!supplier) throw new NotFoundException('Proveedor no encontrado');

    if (dto.nit && dto.nit !== supplier.nit) {
      const dup = await this.prisma.supplier.findUnique({
        where: { nit: dto.nit },
        select: { id: true },
      });
      if (dup) throw new ConflictException('Ya existe un proveedor con ese NIT');
    }

    const data: Record<string, unknown> = {};
    if (dto.name) data.name = dto.name;
    if (dto.nit) data.nit = dto.nit;
    if (dto.contact !== undefined) data.contact = dto.contact;
    if (dto.category) data.category = dto.category;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.rating !== undefined) data.rating = dto.rating;

    const updated = await this.prisma.supplier.update({ where: { id }, data });

    await this.audit.log({
      userId: ctx.userId,
      action: 'update',
      entity: 'Supplier',
      entityId: id,
      oldValues: {
        name: supplier.name,
        nit: supplier.nit,
        category: supplier.category,
        status: supplier.status,
      },
      newValues: data,
    });

    return updated;
  }

  /** Eliminar proveedor — bloqueado (409) si tiene órdenes de compra (FK Restrict). */
  async removeSupplier(id: string, ctx: AccessContext) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id },
      select: { id: true, name: true, nit: true },
    });
    if (!supplier) throw new NotFoundException('Proveedor no encontrado');

    const purchaseOrderCount = await this.prisma.purchaseOrder.count({
      where: { supplierId: id },
    });
    if (purchaseOrderCount > 0) {
      throw new ConflictException(
        `No se puede eliminar el proveedor: tiene ${purchaseOrderCount} orden(es) de compra asociadas`,
      );
    }

    await this.audit.log({
      userId: ctx.userId,
      action: 'delete',
      entity: 'Supplier',
      entityId: supplier.id,
      newValues: { name: supplier.name, nit: supplier.nit },
    });

    await this.prisma.supplier.delete({ where: { id } });
    return { message: 'Proveedor eliminado exitosamente' };
  }

  // ============================ Evaluaciones ============================

  /** Evaluaciones de un proveedor (incluye evaluador). */
  async findEvaluations(supplierId: string) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id: supplierId },
      select: { id: true },
    });
    if (!supplier) throw new NotFoundException('Proveedor no encontrado');

    const evaluations = await this.prisma.supplierEvaluation.findMany({
      where: { supplierId },
      include: { evaluatedBy: { select: { id: true, name: true, email: true } } },
      orderBy: { date: 'desc' },
    });

    return { data: evaluations };
  }

  /** Crear evaluación de proveedor — evaluatedById = actor. */
  async createEvaluation(supplierId: string, dto: CreateEvaluationDto, ctx: AccessContext) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id: supplierId },
      select: { id: true, name: true },
    });
    if (!supplier) throw new NotFoundException('Proveedor no encontrado');

    const created = await this.prisma.supplierEvaluation.create({
      data: {
        supplierId,
        evaluatedById: ctx.userId ?? null,
        date: dto.date ? new Date(dto.date) : undefined,
        criteria: dto.criteria as any,
        score: dto.score,
        observations: dto.observations ?? null,
      },
    });

    await this.audit.log({
      userId: ctx.userId,
      action: 'create',
      entity: 'SupplierEvaluation',
      entityId: created.id,
      newValues: {
        supplierId,
        supplierName: supplier.name,
        score: created.score,
        criteria: created.criteria,
      },
    });

    return created;
  }

  // ================================ Stock ================================

  /** Stock de un producto. */
  async findStockByProduct(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });
    if (!product) throw new NotFoundException('Producto no encontrado');

    const stock = await this.prisma.stock.findMany({ where: { productId } });
    return { data: stock };
  }

  /**
   * Crea o actualiza (upsert por productId) el stock de un producto.
   * Si viene `adjustmentType` (in/out/adjust) registra un movimiento de stock
   * en auditoría (trazabilidad entradas/salidas/ajustes con usuario y fecha,
   * checklist 44). `minQuantity` se persiste vía auditoría (sin migración).
   */
  async upsertStock(productId: string, dto: CreateStockDto, ctx: AccessContext) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, sku: true, name: true },
    });
    if (!product) throw new NotFoundException('Producto no encontrado');

    const existing = await this.prisma.stock.findUnique({ where: { productId } });
    const before = existing?.availableQty ?? 0;

    let targetQty = dto.quantity;
    let movement: string | null = null;

    if (dto.adjustmentType) {
      if (dto.adjustmentType === 'in') {
        targetQty = before + dto.quantity;
      } else if (dto.adjustmentType === 'out') {
        targetQty = before - dto.quantity;
        if (targetQty < 0) {
          throw new BadRequestException(
            `Stock insuficiente: salida de ${dto.quantity} sobre ${before} disponibles`,
          );
        }
      } else {
        targetQty = dto.quantity;
      }
      movement =
        dto.adjustmentType === 'in'
          ? 'movement_in'
          : dto.adjustmentType === 'out'
            ? 'movement_out'
            : 'adjust';
    }

    const stock = await this.prisma.stock.upsert({
      where: { productId },
      create: {
        productId,
        availableQty: targetQty,
        location: dto.location ?? null,
      },
      update: {
        availableQty: targetQty,
        ...(dto.location !== undefined && { location: dto.location }),
      },
    });

    if (movement) {
      await this.audit.log({
        userId: ctx.userId,
        action: movement,
        entity: 'Stock',
        entityId: stock.id,
        newValues: {
          productId,
          productSku: product.sku,
          adjustmentType: dto.adjustmentType,
          reason: dto.reason ?? null,
          quantityAntes: before,
          quantityDespues: stock.availableQty,
        },
      });
    } else {
      await this.audit.log({
        userId: ctx.userId,
        action: existing ? 'update' : 'create',
        entity: 'Stock',
        entityId: stock.id,
        newValues: {
          productId,
          productSku: product.sku,
          availableQty: stock.availableQty,
          location: stock.location,
        },
      });
    }

    if (dto.minQuantity !== undefined) {
      await this.audit.log({
        userId: ctx.userId,
        action: 'settings',
        entity: 'Stock',
        entityId: stock.id,
        newValues: { productId, minQuantity: dto.minQuantity },
      });
    }

    return stock;
  }

  /** Actualización parcial de un registro de stock (soporta movimientos). */
  async updateStock(id: string, dto: UpdateStockDto, ctx: AccessContext) {
    const stock = await this.prisma.stock.findUnique({ where: { id } });
    if (!stock) throw new NotFoundException('Stock no encontrado');

    let targetQty: number | undefined;
    let movement: string | null = null;

    if (dto.adjustmentType) {
      if (dto.quantity === undefined) {
        throw new BadRequestException('quantity es requerida cuando se envía adjustmentType');
      }
      const before = stock.availableQty;
      if (dto.adjustmentType === 'in') {
        targetQty = before + dto.quantity;
      } else if (dto.adjustmentType === 'out') {
        targetQty = before - dto.quantity;
        if (targetQty < 0) {
          throw new BadRequestException(
            `Stock insuficiente: salida de ${dto.quantity} sobre ${before} disponibles`,
          );
        }
      } else {
        targetQty = dto.quantity;
      }
      movement =
        dto.adjustmentType === 'in'
          ? 'movement_in'
          : dto.adjustmentType === 'out'
            ? 'movement_out'
            : 'adjust';
    } else if (dto.quantity !== undefined) {
      targetQty = dto.quantity;
    }

    const data: Record<string, unknown> = {};
    if (targetQty !== undefined) data.availableQty = targetQty;
    if (dto.location !== undefined) data.location = dto.location;

    const updated = await this.prisma.stock.update({ where: { id }, data });

    if (movement) {
      await this.audit.log({
        userId: ctx.userId,
        action: movement,
        entity: 'Stock',
        entityId: id,
        newValues: {
          productId: stock.productId,
          adjustmentType: dto.adjustmentType,
          reason: dto.reason ?? null,
          quantityAntes: stock.availableQty,
          quantityDespues: updated.availableQty,
        },
      });
    } else {
      await this.audit.log({
        userId: ctx.userId,
        action: 'update',
        entity: 'Stock',
        entityId: id,
        oldValues: {
          availableQty: stock.availableQty,
          location: stock.location,
        },
        newValues: data,
      });
    }

    if (dto.minQuantity !== undefined) {
      await this.audit.log({
        userId: ctx.userId,
        action: 'settings',
        entity: 'Stock',
        entityId: id,
        newValues: { productId: stock.productId, minQuantity: dto.minQuantity },
      });
    }

    return updated;
  }

  /** Elimina un registro de stock. */
  async removeStock(id: string, ctx: AccessContext) {
    const stock = await this.prisma.stock.findUnique({
      where: { id },
      select: { id: true, productId: true, availableQty: true },
    });
    if (!stock) throw new NotFoundException('Stock no encontrado');

    await this.audit.log({
      userId: ctx.userId,
      action: 'delete',
      entity: 'Stock',
      entityId: stock.id,
      newValues: { productId: stock.productId, availableQty: stock.availableQty },
    });

    await this.prisma.stock.delete({ where: { id } });
    return { message: 'Stock eliminado exitosamente' };
  }

  /**
   * Alertas de stock mínimo (checklist 43): productos con availableQty <= minQuantity
   * (o 0 sin mínimo configurado). `thresholdDays` marca stock sin actualizaciones
   * recientes (riesgo de dato obsoleto). El minQuantity vive en auditoría (sin migración).
   */
  async findStockAlerts(thresholdDays?: number) {
    const [stocks, minMap] = await Promise.all([
      this.prisma.stock.findMany(),
      this.getStockMinMap(),
    ]);

    const ids = stocks.map((s) => s.productId);
    const products = ids.length
      ? await this.prisma.product.findMany({
          where: { id: { in: ids } },
          select: { id: true, sku: true, name: true },
        })
      : [];
    const productMap = new Map(products.map((p) => [p.id, p]));

    const cutoff =
      thresholdDays && thresholdDays > 0
        ? Date.now() - thresholdDays * 24 * 60 * 60 * 1000
        : null;

    const data = stocks
      .map((s) => {
        const min = minMap.get(s.id) ?? 0;
        const product = productMap.get(s.productId);
        let reason: string | null = null;
        if (s.availableQty <= 0) reason = 'out_of_stock';
        else if (min > 0 && s.availableQty <= min) reason = 'below_min';
        else if (cutoff && s.updatedAt < new Date(cutoff)) reason = 'no_recent_movement';
        if (!reason) return null;
        return {
          stockId: s.id,
          productId: s.productId,
          sku: product?.sku ?? null,
          name: product?.name ?? null,
          availableQty: s.availableQty,
          location: s.location,
          minQuantity: min,
          reason,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    return { data };
  }

  // ============================ Órdenes de compra ============================

  /** Lista órdenes de compra (filtro por status; incluye proveedor y solicitante). */
  async findPurchaseOrders(params?: { status?: string }) {
    const where: Record<string, unknown> = {};
    if (params?.status) where.status = params.status;

    const orders = await this.prisma.purchaseOrder.findMany({
      where,
      include: {
        supplier: { select: { id: true, name: true, nit: true } },
        requestedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return { data: orders };
  }

  /** Detalle de una orden de compra con historial completo (checklist 49). */
  async findOnePurchaseOrder(id: string) {
    const order = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        supplier: { select: { id: true, name: true, nit: true } },
        requestedBy: { select: { id: true, name: true, email: true } },
      },
    });
    if (!order) throw new NotFoundException('Orden de compra no encontrada');

    const history = await this.audit.findByEntity('PurchaseOrder', id);
    return { data: { ...order, history: history.data } };
  }

  /** Crear orden de compra — code único generado; status default 'solicitada'. */
  async createPurchaseOrder(dto: CreatePurchaseOrderDto, ctx: AccessContext) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id: dto.supplierId },
      select: { id: true, name: true },
    });
    if (!supplier) throw new NotFoundException('Proveedor no encontrado');

    const status = dto.status ?? 'solicitada';
    this.assertPoStatus(status);

    const created = await this.prisma.purchaseOrder.create({
      data: {
        code: await this.generatePoCode(),
        supplierId: dto.supplierId,
        status,
        requestedById: ctx.userId ?? null,
        items: (dto.items ?? {}) as any,
        notes: dto.notes ?? null,
      },
    });

    await this.audit.log({
      userId: ctx.userId,
      action: 'create',
      entity: 'PurchaseOrder',
      entityId: created.id,
      newValues: {
        code: created.code,
        supplierId: supplier.id,
        supplierName: supplier.name,
        status: created.status,
        items: created.items,
        notes: created.notes,
      },
    });

    return created;
  }

  /**
   * Actualiza el status de una orden de compra validando la matriz de transiciones
   * y quién puede mover cada estado. Al pasar a 'recibida' incrementa el stock
   * de los productos del pedido y registra movimientos de entrada.
   */
  async updatePurchaseOrderStatus(id: string, dto: UpdatePurchaseOrderStatusDto, ctx: AccessContext) {
    const order = await this.prisma.purchaseOrder.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Orden de compra no encontrada');

    this.assertPoStatus(dto.status);
    this.assertPoTransition(order.status, dto.status);
    this.assertPoStatusRole(dto.status, ctx.roles);

    if (dto.status === 'aprobada') {
      await this.assertPoAvailability(order);
    }

    if (dto.status === 'recibida') {
      await this.applyPoStockIncrease(order, ctx);
    }

    const updated = await this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: dto.status },
    });

    await this.audit.log({
      userId: ctx.userId,
      action: 'status_change',
      entity: 'PurchaseOrder',
      entityId: id,
      oldValues: { status: order.status },
      newValues: {
        status: updated.status,
        movedByUserId: ctx.userId ?? null,
        ...(dto.comment ? { comment: dto.comment } : {}),
      },
    });

    return updated;
  }

  /** Elimina una orden de compra. */
  async removePurchaseOrder(id: string, ctx: AccessContext) {
    const order = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      select: { id: true, code: true, status: true },
    });
    if (!order) throw new NotFoundException('Orden de compra no encontrada');

    await this.audit.log({
      userId: ctx.userId,
      action: 'delete',
      entity: 'PurchaseOrder',
      entityId: order.id,
      newValues: { code: order.code, status: order.status },
    });

    await this.prisma.purchaseOrder.delete({ where: { id } });
    return { message: 'Orden de compra eliminada exitosamente' };
  }

  /**
   * Panel de compras (checklist 50): indicadores agregados para el dashboard.
   * - pendingSupplierEvaluations: proveedores sin evaluación o con última evaluación > 90 días.
   * - expiringPrices: precios con validUntil en los próximos 30 días.
   * - lowStock: productos sin stock (availableQty <= minQuantity configurado o 0).
   */
  async getPurchaseOrderDashboard() {
    const now = new Date();
    const cutoff30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const cutoff90 = new Date(now.getTime() - EVALUATION_STALENESS_DAYS * 24 * 60 * 60 * 1000);

    const [orders, suppliers, evals, expiring, stocks, settingsLogs] = await Promise.all([
      this.prisma.purchaseOrder.findMany({
        include: { supplier: { select: { id: true, name: true, nit: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.supplier.findMany({ include: { _count: { select: { evaluations: true } } } }),
      this.prisma.supplierEvaluation.findMany({ select: { supplierId: true, date: true } }),
      this.prisma.price.count({ where: { validUntil: { gte: now, lte: cutoff30 } } }),
      this.prisma.stock.findMany(),
      this.prisma.auditLog.findMany({
        where: { entity: 'Stock', action: 'settings' },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const ordersByStatus: Record<string, number> = {};
    for (const o of orders) {
      ordersByStatus[o.status] = (ordersByStatus[o.status] ?? 0) + 1;
    }

    const openOrders = orders.filter(
      (o) => o.status !== 'cerrada' && o.status !== 'cancelada',
    ).length;

    const lastEvalBySupplier = new Map<string, Date>();
    for (const ev of evals) {
      const prev = lastEvalBySupplier.get(ev.supplierId);
      if (!prev || ev.date > prev) lastEvalBySupplier.set(ev.supplierId, ev.date);
    }
    const pendingSuppliers = suppliers.filter((s) => {
      const last = lastEvalBySupplier.get(s.id);
      return !last || last < cutoff90;
    });
    const pendingSupplierEvaluations = {
      count: pendingSuppliers.length,
      suppliers: pendingSuppliers.map((s) => ({
        id: s.id,
        name: s.name,
        nit: s.nit,
        lastEvaluationDate: lastEvalBySupplier.get(s.id) ?? null,
      })),
    };

    const minMap = new Map<string, number>();
    for (const log of settingsLogs) {
      const v = (log.newValues as any)?.minQuantity;
      if (!minMap.has(log.entityId) && typeof v === 'number') minMap.set(log.entityId, v);
    }
    const lowStock = stocks.filter((s) => s.availableQty <= (minMap.get(s.id) ?? 0)).length;

    const recentOrders = orders.slice(0, 5);
    const recentProductIds = [
      ...new Set(recentOrders.flatMap((o) => this.parsePoItems(o.items).map((i) => i.productId))),
    ];
    const recentProducts = recentProductIds.length
      ? await this.prisma.product.findMany({
          where: { id: { in: recentProductIds } },
          select: { id: true, sku: true, name: true },
        })
      : [];
    const productMap = new Map(recentProducts.map((p) => [p.id, p]));
    const recentOrdersOut = recentOrders.map((o) => ({
      id: o.id,
      code: o.code,
      status: o.status,
      supplierId: o.supplierId,
      supplier: o.supplier,
      createdAt: o.createdAt,
      products: this.parsePoItems(o.items)
        .map((i) => productMap.get(i.productId))
        .filter((p): p is NonNullable<typeof p> => !!p)
        .map((p) => ({ id: p.id, sku: p.sku, name: p.name })),
    }));

    return {
      data: {
        openOrders,
        ordersByStatus,
        pendingSupplierEvaluations,
        expiringPrices: expiring,
        lowStock,
        recentOrders: recentOrdersOut,
      },
    };
  }

  // ===================== Proveedor ↔ producto (sin migración) =====================

  /**
   * Asociación proveedor ↔ producto materializada vía órdenes de compra (checklist 37).
   * Sin migración: los productos de un proveedor se resuelven desde los items de sus POs.
   */
  async findSupplierProducts(supplierId: string) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id: supplierId },
      select: { id: true },
    });
    if (!supplier) throw new NotFoundException('Proveedor no encontrado');

    const orders = await this.prisma.purchaseOrder.findMany({ where: { supplierId } });
    const byProduct = new Map<string, { lastOrderedAt: Date; totalOrdered: number }>();
    for (const o of orders) {
      for (const item of this.parsePoItems(o.items)) {
        const cur = byProduct.get(item.productId) ?? { lastOrderedAt: o.createdAt, totalOrdered: 0 };
        cur.totalOrdered += item.quantity;
        if (o.createdAt > cur.lastOrderedAt) cur.lastOrderedAt = o.createdAt;
        byProduct.set(item.productId, cur);
      }
    }

    const ids = [...byProduct.keys()];
    const products = ids.length
      ? await this.prisma.product.findMany({
          where: { id: { in: ids } },
          select: { id: true, sku: true, name: true },
        })
      : [];
    const productMap = new Map(products.map((p) => [p.id, p]));

    const data = ids
      .map((id) => {
        const product = productMap.get(id);
        if (!product) return null;
        const meta = byProduct.get(id)!;
        return {
          productId: id,
          sku: product.sku,
          name: product.name,
          lastOrderedAt: meta.lastOrderedAt,
          totalOrdered: meta.totalOrdered,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    return { data };
  }

  /** Proveedores que han comprado (POs) un producto dado. */
  async findProductSuppliers(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });
    if (!product) throw new NotFoundException('Producto no encontrado');

    const orders = await this.prisma.purchaseOrder.findMany({
      include: { supplier: { select: { id: true, name: true, nit: true, category: true } } },
    });

    const bySupplier = new Map<string, { supplier: any; lastOrderAt: Date }>();
    for (const o of orders) {
      const has = this.parsePoItems(o.items).some((i) => i.productId === productId);
      if (!has) continue;
      const cur = bySupplier.get(o.supplierId) ?? { supplier: o.supplier, lastOrderAt: o.createdAt };
      if (o.createdAt > cur.lastOrderAt) cur.lastOrderAt = o.createdAt;
      bySupplier.set(o.supplierId, cur);
    }

    const data = [...bySupplier.values()].map(({ supplier, lastOrderAt }) => ({
      ...supplier,
      lastOrderAt,
    }));
    return { data };
  }

  // ============================ Alertas y reportes ============================

  /**
   * Alertas de evaluación (checklist 39): proveedores con averageScore < minScore
   * (motivo 'bajo_score') o sin evaluación reciente (> 90 días, motivo 'sin_evaluacion_reciente').
   */
  async findSupplierAlerts(minScore = 60) {
    const [suppliers, evals] = await Promise.all([
      this.prisma.supplier.findMany({ include: { _count: { select: { evaluations: true } } } }),
      this.prisma.supplierEvaluation.findMany({
        select: { supplierId: true, score: true, date: true },
      }),
    ]);
    const cutoff = new Date(Date.now() - EVALUATION_STALENESS_DAYS * 24 * 60 * 60 * 1000);

    const bySupplier = new Map<string, { scores: number[]; last: Date | null }>();
    for (const ev of evals) {
      const cur = bySupplier.get(ev.supplierId) ?? { scores: [], last: null };
      cur.scores.push(Number(ev.score));
      if (!cur.last || ev.date > cur.last) cur.last = ev.date;
      bySupplier.set(ev.supplierId, cur);
    }

    const data = suppliers
      .map((s) => {
        const info = bySupplier.get(s.id);
        const evaluationCount = info ? info.scores.length : 0;
        const lastEvaluationDate = info?.last ?? null;
        const averageScore = evaluationCount
          ? Number((info!.scores.reduce((a, b) => a + b, 0) / evaluationCount).toFixed(2))
          : null;

        let reason: string | null = null;
        if (evaluationCount === 0 || !lastEvaluationDate || lastEvaluationDate < cutoff) {
          reason = 'sin_evaluacion_reciente';
        } else if (averageScore !== null && averageScore < minScore) {
          reason = 'bajo_score';
        }

        return reason
          ? {
              id: s.id,
              name: s.name,
              nit: s.nit,
              category: s.category,
              status: s.status,
              averageScore,
              evaluationCount,
              lastEvaluationDate,
              reason,
            }
          : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    return { data };
  }

  /**
   * Reporte comparativo de proveedores por categoría (checklist 40),
   * ordenado por averageScore desc.
   */
  async getSupplierReport(category: string) {
    const suppliers = await this.prisma.supplier.findMany({
      where: { category },
      include: { _count: { select: { evaluations: true } } },
    });
    const ids = suppliers.map((s) => s.id);

    const [evals, orders] = await Promise.all([
      this.prisma.supplierEvaluation.findMany({
        where: { supplierId: { in: ids } },
        select: { supplierId: true, score: true },
      }),
      this.prisma.purchaseOrder.findMany({
        where: { supplierId: { in: ids } },
        select: { supplierId: true, status: true, items: true },
      }),
    ]);

    const scoreBySupplier = new Map<string, number[]>();
    for (const ev of evals) {
      const arr = scoreBySupplier.get(ev.supplierId) ?? [];
      arr.push(Number(ev.score));
      scoreBySupplier.set(ev.supplierId, arr);
    }

    const orderBySupplier = new Map<string, { count: number; total: number }>();
    for (const o of orders) {
      const cur = orderBySupplier.get(o.supplierId) ?? { count: 0, total: 0 };
      cur.count += 1;
      if (o.status !== 'cancelada') {
        for (const item of this.parsePoItems(o.items)) cur.total += item.quantity;
      }
      orderBySupplier.set(o.supplierId, cur);
    }

    const rows = suppliers.map((s) => {
      const scores = scoreBySupplier.get(s.id) ?? [];
      const averageScore = scores.length
        ? Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2))
        : null;
      const orderInfo = orderBySupplier.get(s.id) ?? { count: 0, total: 0 };
      return {
        id: s.id,
        name: s.name,
        nit: s.nit,
        averageScore,
        evaluationCount: scores.length,
        ordersCount: orderInfo.count,
        totalOrdered: orderInfo.total,
      };
    });

    rows.sort((a, b) => {
      const av = (a.averageScore ?? -1) - (b.averageScore ?? -1);
      if (av === 0) return a.name.localeCompare(b.name);
      return av < 0 ? 1 : -1;
    });

    const ranking = rows.map((r, idx) => ({ id: r.id, name: r.name, rank: idx + 1 }));

    return { data: { category, suppliers: rows, ranking } };
  }

  // ================================ Helpers ================================

  private assertPoStatus(status: string): void {
    if (!(PO_STATUSES as readonly string[]).includes(status)) {
      throw new BadRequestException(
        `Estado no válido. Use uno de: ${PO_STATUSES.join(', ')}`,
      );
    }
  }

  /** Valida la matriz de transiciones de la orden (400 si la transición es inválida). */
  private assertPoTransition(from: string, to: string): void {
    const allowed = PO_TRANSITIONS[from] ?? [];
    if (!allowed.includes(to)) {
      throw new BadRequestException(`No se puede pasar de ${from} a ${to}`);
    }
  }

  /** Valida el rol requerido para mover la orden al estado destino (403 si no autorizado). */
  private assertPoStatusRole(to: string, roles: string[]): void {
    const allowed = PO_STATUS_ROLES[to] ?? ['Super Admin'];
    if (!roles.some((r) => allowed.includes(r))) {
      throw new ForbiddenException(`El estado '${to}' requiere rol: ${allowed.join(' o ')}`);
    }
  }

  /**
   * Confirmación de disponibilidad como paso obligatorio antes de aprobar una PO
   * (checklist pendiente). Regla sin migración:
   * - Producto CON registro de stock y availableQty <= 0 → bloquea la aprobación (409)
   *   con detalle por item.
   * - Producto SIN registro de stock → no bloquea (sin datos = no confirmable; documentado).
   */
  private async assertPoAvailability(order: any): Promise<void> {
    const items = this.parsePoItems(order.items).filter((i) => i.productId);
    if (!items.length) return;

    const productIds = [...new Set(items.map((i) => i.productId))];
    const [stocks, products] = await Promise.all([
      this.prisma.stock.findMany({ where: { productId: { in: productIds } } }),
      this.prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, name: true, sku: true },
      }),
    ]);
    const stockByProduct = new Map(stocks.map((s) => [s.productId, s]));
    const productMap = new Map(products.map((p) => [p.id, p]));

    const blocked = items
      .map((item) => {
        const stock = stockByProduct.get(item.productId);
        if (stock && stock.availableQty <= 0) {
          const product = productMap.get(item.productId);
          return `Producto ${product?.name ?? 'Desconocido'} (${product?.sku ?? item.productId}) sin stock disponible (availableQty=${stock.availableQty})`;
        }
        return null;
      })
      .filter((x): x is string => x !== null);

    if (blocked.length) {
      throw new ConflictException({
        message: 'No se puede aprobar la orden de compra: hay productos sin stock disponible',
        details: blocked,
      });
    }
  }

  /** Al recibir una orden, suma las cantidades de sus items al stock (checklist 47). */
  private async applyPoStockIncrease(order: any, ctx: AccessContext): Promise<void> {
    const items = this.parsePoItems(order.items);
    for (const item of items) {
      if (!item.productId || item.quantity <= 0) continue;
      const existing = await this.prisma.stock.findUnique({
        where: { productId: item.productId },
      });
      const before = existing?.availableQty ?? 0;
      const after = before + item.quantity;
      const stock = await this.prisma.stock.upsert({
        where: { productId: item.productId },
        create: {
          productId: item.productId,
          availableQty: item.quantity,
          location: existing?.location ?? null,
        },
        update: { availableQty: after },
      });
      await this.audit.log({
        userId: ctx.userId,
        action: 'movement_in',
        entity: 'Stock',
        entityId: stock.id,
        newValues: {
          productId: item.productId,
          adjustmentType: 'in',
          reason: `orden de compra ${order.code}`,
          quantityAntes: before,
          quantityDespues: stock.availableQty,
        },
      });
    }
  }

  /** Map stockId -> minQuantity desde auditoría (acción 'settings', última por stock). */
  private async getStockMinMap(): Promise<Map<string, number>> {
    const logs =
      (await this.prisma.auditLog.findMany({
        where: { entity: 'Stock', action: 'settings' },
        orderBy: { createdAt: 'desc' },
      })) ?? [];
    const map = new Map<string, number>();
    for (const log of logs) {
      const v = (log.newValues as any)?.minQuantity;
      if (!map.has(log.entityId) && typeof v === 'number') map.set(log.entityId, v);
    }
    return map;
  }

  /** Promedio y última fecha de evaluación por proveedor. */
  private async supplierScoreMap(): Promise<
    Map<string, { averageScore: number | null; lastEvaluationDate: Date | null }>
  > {
    const evals = await this.prisma.supplierEvaluation.findMany({
      select: { supplierId: true, score: true, date: true },
    });
    const map = new Map<string, { scores: number[]; last: Date | null }>();
    for (const ev of evals) {
      const cur = map.get(ev.supplierId) ?? { scores: [], last: null };
      cur.scores.push(Number(ev.score));
      if (!cur.last || ev.date > cur.last) cur.last = ev.date;
      map.set(ev.supplierId, cur);
    }
    const out = new Map<string, { averageScore: number | null; lastEvaluationDate: Date | null }>();
    for (const [id, cur] of map) {
      out.set(id, {
        averageScore: cur.scores.length
          ? Number((cur.scores.reduce((a, b) => a + b, 0) / cur.scores.length).toFixed(2))
          : null,
        lastEvaluationDate: cur.last,
      });
    }
    return out;
  }

  /**
   * Normaliza el campo `items` (JSONB) de una orden de compra a una lista de
   * { productId, quantity }. Soporta array de items, objeto único o { items: [...] }.
   */
  private parsePoItems(items: unknown): Array<{ productId: string; quantity: number }> {
    if (!items) return [];
    if (Array.isArray(items)) {
      return items
        .filter(
          (i): i is Record<string, unknown> =>
            !!i && typeof i === 'object' && typeof (i as any).productId === 'string',
        )
        .map((i) => ({
          productId: i.productId as string,
          quantity: Number((i as any).quantity ?? (i as any).qty ?? 0),
        }));
    }
    if (typeof items === 'object') {
      const obj = items as Record<string, unknown>;
      if (Array.isArray(obj.items)) return this.parsePoItems(obj.items);
      if (typeof obj.productId === 'string') {
        return [{ productId: obj.productId, quantity: Number(obj.quantity ?? obj.qty ?? 0) }];
      }
    }
    return [];
  }

  /** Genera un code único `PO-XXXX` (4 chars alfanuméricos sin ambiguos). */
  private async generatePoCode(): Promise<string> {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for (let attempt = 0; attempt < 5; attempt++) {
      const bytes = randomBytes(4);
      let out = '';
      for (let i = 0; i < 4; i++) out += alphabet[bytes[i] % alphabet.length];
      const candidate = `PO-${out}`;
      const exists = await this.prisma.purchaseOrder.findUnique({
        where: { code: candidate },
        select: { id: true },
      });
      if (!exists) return candidate;
    }
    return `PO-${Date.now().toString(36).toUpperCase()}`;
  }
}