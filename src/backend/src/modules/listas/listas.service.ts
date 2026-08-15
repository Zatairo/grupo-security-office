import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AclService, AccessContext } from '../../common/acl/acl.service';
import { AuditService } from '../audit/audit.service';
import { CreateListaDto } from './dto/create-lista.dto';
import { UpdateListaDto } from './dto/update-lista.dto';

@Injectable()
export class ListasService {
  constructor(
    private prisma: PrismaService,
    private acl: AclService,
    private audit: AuditService,
  ) {}

  /** Lista de Listas autorizadas (deny-by-default). */
  async findAll(ctx: AccessContext, params?: { isActive?: boolean }) {
    const allowed = await this.acl.getAllowedListaIds(ctx.userId, ctx.roles, 'view');

    const where: { isActive?: boolean; id?: { in: string[] } } = {
      ...(params?.isActive === true && { isActive: true }),
      // deny-by-default: usuario no-admin sin assignments → id: { in: [] } (0 resultados).
      // Super Admin: allowed === null → sin filtro de id (ve todo).
      ...(allowed !== null && { id: { in: allowed.length ? allowed : [] } }),
    };

    const listas = await this.prisma.lista.findMany({
      where,
      include: { _count: { select: { products: true } } },
      orderBy: { updatedAt: 'desc' },
    });

    return {
      data: listas.map((l) => ({
        ...l,
        productCount: l._count.products,
      })),
    };
  }

  /** Detalle de Lista (deny-by-default; admin ve incluso inactivas/archivadas). */
  async findOne(id: string, ctx: AccessContext) {
    await this.acl.assertListaAccess(id, ctx, 'view');
    const lista = await this.prisma.lista.findUnique({
      where: { id },
      include: { _count: { select: { products: true } } },
    });
    if (!lista) throw new NotFoundException('Lista no encontrada');
    return { ...lista, productCount: lista._count.products };
  }

  /** Productos de una Lista (scoped + deny-by-default). */
  async findProducts(
    id: string,
    ctx: AccessContext,
    params?: { search?: string; categoryId?: string; isActive?: boolean; isVisible?: boolean },
  ) {
    await this.acl.assertListaAccess(id, ctx, 'view');

    const where: Record<string, unknown> = { listaId: id };
    if (params?.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { sku: { contains: params.search, mode: 'insensitive' } },
      ];
    }
    if (params?.categoryId) where.categoryId = params.categoryId;
    if (params?.isActive !== undefined) where.isActive = params.isActive;
    if (params?.isVisible !== undefined) where.isVisible = params.isVisible;

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: {
          category: { select: { id: true, name: true, slug: true } },
          brand: { select: { id: true, name: true, slug: true } },
          images: { where: { isPrimary: true }, take: 1 },
          prices: { include: { priceList: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.product.count({ where }),
    ]);

    return { data: products, meta: { total } };
  }

  /** Precios de productos de una Lista (scoped + deny-by-default). */
  async findPrices(id: string, ctx: AccessContext) {
    await this.acl.assertListaAccess(id, ctx, 'view');

    const prices = await this.prisma.price.findMany({
      where: { product: { listaId: id } },
      include: {
        product: { select: { id: true, sku: true, name: true } },
        priceList: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return { data: prices };
  }

  /** Accesos (assignments LISTA) de una Lista — requiere manage. */
  async findAssignments(id: string, ctx: AccessContext) {
    await this.acl.assertListaAccess(id, ctx, 'manage');
    const assignments = await this.prisma.assignment.findMany({
      where: { resourceType: 'LISTA', resourceId: id },
      orderBy: { createdAt: 'desc' },
    });
    return { data: assignments };
  }

  /** Auditoría de una Lista — requiere manage. */
  async findAudit(id: string, ctx: AccessContext) {
    await this.assertManage(id, ctx);
    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: { entity: 'LISTA', entityId: id },
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditLog.count({ where: { entity: 'LISTA', entityId: id } }),
    ]);
    return { data: logs, meta: { total } };
  }

  /** Crear Lista — exclusivo Super Admin. */
  async create(dto: CreateListaDto, ctx: AccessContext) {
    if (!this.acl.isSuperAdmin(ctx.roles)) {
      throw new ForbiddenException('Solo Super Admin puede crear Listas');
    }

    const existing = await this.prisma.lista.findUnique({
      where: { code: dto.code },
      select: { id: true },
    });
    if (existing) throw new ConflictException('Ya existe una Lista con ese código');

    await this.validateResponsible(dto.responsibleId);
    this.assertCoherentValidity(dto.validFrom, dto.validUntil);

    const created = await this.prisma.lista.create({
      data: {
        code: dto.code,
        name: dto.name,
        description: dto.description ?? null,
        currency: dto.currency ?? 'COP',
        isActive: dto.isActive ?? true,
        type: dto.type ?? null,
        defaultVisibility: dto.defaultVisibility ?? false,
        responsibleId: dto.responsibleId ?? null,
        validFrom: dto.validFrom ? new Date(dto.validFrom) : null,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
      },
    });

    await this.audit.log({
      userId: ctx.userId,
      action: 'create',
      entity: 'LISTA',
      entityId: created.id,
      newValues: {
        code: created.code,
        name: created.name,
        currency: created.currency,
        isActive: created.isActive,
        type: created.type,
        defaultVisibility: created.defaultVisibility,
        responsibleId: created.responsibleId,
        validFrom: created.validFrom,
        validUntil: created.validUntil,
      },
    });

    return created;
  }

  /** Editar Lista (campos) — requiere edit+. Archivar (archivedAt) — requiere manage. */
  async update(id: string, dto: UpdateListaDto, ctx: AccessContext) {
    const lista = await this.prisma.lista.findUnique({ where: { id } });
    if (!lista) throw new NotFoundException('Lista no encontrada');

    const oldValues = {
      name: lista.name,
      code: lista.code,
      description: lista.description,
      currency: lista.currency,
      isActive: lista.isActive,
      archivedAt: lista.archivedAt,
      type: lista.type,
      defaultVisibility: lista.defaultVisibility,
      responsibleId: lista.responsibleId,
      validFrom: lista.validFrom,
      validUntil: lista.validUntil,
    };

    // El nivel requerido depende de si se está archivando/restaurando.
    const requiresManage = dto.archivedAt !== undefined;
    const requiredLevel = requiresManage ? 'manage' : 'edit';
    await this.acl.assertListaAccess(id, ctx, requiredLevel);

    if (dto.code && dto.code !== lista.code) {
      const dup = await this.prisma.lista.findUnique({ where: { code: dto.code }, select: { id: true } });
      if (dup) throw new ConflictException('Ya existe una Lista con ese código');
    }

    await this.validateResponsible(dto.responsibleId);
    this.assertCoherentValidity(dto.validFrom, dto.validUntil);

    const data: Record<string, unknown> = {};
    if (dto.name) data.name = dto.name;
    if (dto.code) data.code = dto.code;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.currency) data.currency = dto.currency;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.archivedAt !== undefined) {
      data.archivedAt = dto.archivedAt ? new Date(dto.archivedAt) : null;
      if (dto.archivedAt) data.isActive = false;
    }
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.defaultVisibility !== undefined) data.defaultVisibility = dto.defaultVisibility;
    if (dto.responsibleId !== undefined) data.responsibleId = dto.responsibleId ?? null;
    if (dto.validFrom !== undefined) data.validFrom = dto.validFrom ? new Date(dto.validFrom) : null;
    if (dto.validUntil !== undefined) data.validUntil = dto.validUntil ? new Date(dto.validUntil) : null;

    const updated = await this.prisma.lista.update({ where: { id }, data });

    await this.audit.log({
      userId: ctx.userId,
      action: requiresManage ? (dto.archivedAt ? 'restore' : 'archive') : 'update',
      entity: 'LISTA',
      entityId: id,
      oldValues,
      newValues: data,
    });

    return updated;
  }

  /** Activar / desactivar Lista — requiere edit+. */
  async toggleActive(id: string, ctx: AccessContext) {
    const lista = await this.prisma.lista.findUnique({ where: { id } });
    if (!lista) throw new NotFoundException('Lista no encontrada');
    await this.acl.assertListaAccess(id, ctx, 'edit');

    const updated = await this.prisma.lista.update({
      where: { id },
      data: { isActive: !lista.isActive },
    });

    await this.audit.log({
      userId: ctx.userId,
      action: 'toggleActive',
      entity: 'LISTA',
      entityId: id,
      oldValues: { isActive: lista.isActive },
      newValues: { isActive: updated.isActive },
    });

    return updated;
  }

  /** Archivar lógicamente — requiere manage. */
  async archive(id: string, ctx: AccessContext) {
    const lista = await this.prisma.lista.findUnique({ where: { id } });
    if (!lista) throw new NotFoundException('Lista no encontrada');
    await this.acl.assertListaAccess(id, ctx, 'manage');

    const updated = await this.prisma.lista.update({
      where: { id },
      data: { archivedAt: new Date(), isActive: false },
    });

    await this.audit.log({
      userId: ctx.userId,
      action: 'archive',
      entity: 'LISTA',
      entityId: id,
      oldValues: { archivedAt: lista.archivedAt, isActive: lista.isActive },
      newValues: { archivedAt: updated.archivedAt, isActive: updated.isActive },
    });

    return updated;
  }

  /** Restaurar (desarchivar) — requiere manage. */
  async restore(id: string, ctx: AccessContext) {
    const lista = await this.prisma.lista.findUnique({ where: { id } });
    if (!lista) throw new NotFoundException('Lista no encontrada');
    await this.acl.assertListaAccess(id, ctx, 'manage');

    const updated = await this.prisma.lista.update({
      where: { id },
      data: { archivedAt: null },
    });

    await this.audit.log({
      userId: ctx.userId,
      action: 'restore',
      entity: 'LISTA',
      entityId: id,
      oldValues: { archivedAt: lista.archivedAt, isActive: lista.isActive },
      newValues: { archivedAt: updated.archivedAt, isActive: updated.isActive },
    });

    return updated;
  }

  /** Alias interno: require manage (incluye deny-by-default por inactiva/archivada). */
  private async assertManage(id: string, ctx: AccessContext): Promise<void> {
    await this.acl.assertListaAccess(id, ctx, 'manage');
  }

  /**
   * Valida que el responsable exista cuando se envía responsableId (no aplica a null).
   */
  private async validateResponsible(responsibleId?: string | null): Promise<void> {
    if (!responsibleId) return;
    const responsible = await this.prisma.user.findUnique({
      where: { id: responsibleId },
      select: { id: true },
    });
    if (!responsible) throw new NotFoundException('Usuario responsable no encontrado');
  }

  /**
   * Coherencia de vigencias: si vienen ambas (validFrom y validUntil),
   * validFrom debe ser <= validUntil. Validación manual en el service
   * (más simple que @ValidateIf en los DTOs, evita duplicar lógica en create/update).
   */
  private assertCoherentValidity(validFrom?: string | null, validUntil?: string | null): void {
    if (validFrom && validUntil) {
      const from = new Date(validFrom).getTime();
      const until = new Date(validUntil).getTime();
      if (from > until) {
        throw new BadRequestException('validFrom debe ser menor o igual que validUntil');
      }
    }
  }
}
