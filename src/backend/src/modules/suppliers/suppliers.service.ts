import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
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

    return {
      data: suppliers.map((s) => ({
        ...s,
        evaluationCount: s._count.evaluations,
      })),
    };
  }

  /** Detalle de un proveedor. */
  async findOneSupplier(id: string) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id },
      include: { _count: { select: { evaluations: true, purchaseOrders: true } } },
    });
    if (!supplier) throw new NotFoundException('Proveedor no encontrado');
    return supplier;
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

  /** Crea o actualiza (upsert por productId) el stock de un producto. */
  async upsertStock(productId: string, dto: CreateStockDto, ctx: AccessContext) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, sku: true, name: true },
    });
    if (!product) throw new NotFoundException('Producto no encontrado');

    const existing = await this.prisma.stock.findUnique({ where: { productId } });
    const action = existing ? 'update' : 'create';

    const stock = await this.prisma.stock.upsert({
      where: { productId },
      create: {
        productId,
        availableQty: dto.quantity,
        location: dto.location ?? null,
      },
      update: {
        availableQty: dto.quantity,
        ...(dto.location !== undefined && { location: dto.location }),
      },
    });

    await this.audit.log({
      userId: ctx.userId,
      action,
      entity: 'Stock',
      entityId: stock.id,
      newValues: {
        productId,
        productSku: product.sku,
        availableQty: stock.availableQty,
        location: stock.location,
      },
    });

    return stock;
  }

  /** Actualización parcial de un registro de stock. */
  async updateStock(id: string, dto: UpdateStockDto, ctx: AccessContext) {
    const stock = await this.prisma.stock.findUnique({ where: { id } });
    if (!stock) throw new NotFoundException('Stock no encontrado');

    const data: Record<string, unknown> = {};
    if (dto.quantity !== undefined) data.availableQty = dto.quantity;
    if (dto.location !== undefined) data.location = dto.location;

    const updated = await this.prisma.stock.update({ where: { id }, data });

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

  /** Actualiza el status de una orden de compra (enum validado). */
  async updatePurchaseOrderStatus(id: string, dto: UpdatePurchaseOrderStatusDto, ctx: AccessContext) {
    const order = await this.prisma.purchaseOrder.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Orden de compra no encontrada');

    this.assertPoStatus(dto.status);

    const updated = await this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: dto.status },
    });

    await this.audit.log({
      userId: ctx.userId,
      action: 'update',
      entity: 'PurchaseOrder',
      entityId: id,
      oldValues: { status: order.status },
      newValues: { status: updated.status },
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

  // ================================ Helpers ================================

  private assertPoStatus(status: string): void {
    if (!(PO_STATUSES as readonly string[]).includes(status)) {
      throw new BadRequestException(
        `Estado no válido. Use uno de: ${PO_STATUSES.join(', ')}`,
      );
    }
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