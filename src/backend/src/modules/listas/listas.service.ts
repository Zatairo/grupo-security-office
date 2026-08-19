import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AclService, AccessContext, LEVEL_RANK } from '../../common/acl/acl.service';
import { AuditService } from '../audit/audit.service';
import { CreateListaDto } from './dto/create-lista.dto';
import { UpdateListaDto } from './dto/update-lista.dto';
import { randomBytes } from 'crypto';

@Injectable()
export class ListasService {
  constructor(
    private prisma: PrismaService,
    private acl: AclService,
    private audit: AuditService,
  ) {}

  /** Lista de Listas autorizadas (deny-by-default). */
  async findAll(ctx: AccessContext, params?: { isActive?: boolean; includeExpired?: boolean }) {
    const allowed = await this.acl.getAllowedListaIds(ctx.userId, ctx.roles, 'view');

    const where: {
      isActive?: boolean;
      id?: { in: string[] };
      OR?: Array<{ validUntil: null } | { validUntil: { gte: Date } }>;
    } = {
      ...(params?.isActive === true && { isActive: true }),
      // deny-by-default: usuario no-admin sin assignments → id: { in: [] } (0 resultados).
      // Super Admin: allowed === null → sin filtro de id (ve todo).
      ...(allowed !== null && { id: { in: allowed.length ? allowed : [] } }),
    };

    // Decisión documentada (OLA 6): el frontend actual NO espera filtrado por vencimiento
    // en el listado, por lo que POR DEFECTO se devuelven TODAS las Listas (incluidas las
    // vencidas) para no romper el consumo existente. El filtrado de vencidas se deja como
    // opción explícita (includeExpired: false) y NO se activa por defecto. Se conservan las
    // Listas sin validUntil (no tienen vigencia → no están vencidas).
    if (params?.includeExpired === false) {
      where.OR = [{ validUntil: null }, { validUntil: { gte: new Date() } }];
    }

    const listas = await this.prisma.lista.findMany({
      where,
      include: { _count: { select: { products: true } } },
      orderBy: { updatedAt: 'desc' },
    });

    return {
      data: listas.map((l) => ({
        ...l,
        productCount: l._count.products,
        ...this.computeExpiry(l.validUntil),
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
    return {
      ...lista,
      productCount: lista._count.products,
      ...this.computeExpiry(lista.validUntil),
    };
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

    // Niveles (checklist 29/30): view ve la Lista SIN precios; los precios solo se
    // incluyen si el usuario tiene edit_prices o superior sobre la Lista.
    const canSeePrices = await this.userCanSeePrices(id, ctx);

    const include: Record<string, unknown> = {
      category: { select: { id: true, name: true, slug: true } },
      brand: { select: { id: true, name: true, slug: true } },
      images: { where: { isPrimary: true }, take: 1 },
    };
    if (canSeePrices) {
      include.prices = { include: { priceList: true } };
    }

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.product.count({ where }),
    ]);

    return { data: products, meta: { total } };
  }

  /** Precios de productos de una Lista (scoped + deny-by-default; exige edit_prices). */
  async findPrices(id: string, ctx: AccessContext) {
    await this.acl.assertListaAccess(id, ctx, 'edit_prices');

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

  /**
   * Precios de una Lista próximos a vencer (scoped + deny-by-default).
   * Solo precios con validUntil dentro de [now, now + days]; devuelve cada uno
   * con `daysRemaining` (ceil). El interceptor global envuelve la respuesta en `{ data }`.
   */
  async findExpiringPrices(listaId: string, ctx: AccessContext, days = 30) {
    await this.acl.assertListaAccess(listaId, ctx, 'edit_prices');

    const lista = await this.prisma.lista.findUnique({
      where: { id: listaId },
      select: { id: true },
    });
    if (!lista) throw new NotFoundException('Lista no encontrada');

    const now = Date.now();
    const prices = await this.prisma.price.findMany({
      where: {
        listaId,
        validUntil: { not: null, lte: new Date(now + days * 86400000), gte: new Date(now) },
      },
      include: {
        product: { select: { id: true, sku: true, name: true } },
        priceList: { select: { id: true, name: true, code: true } },
      },
      orderBy: { validUntil: 'asc' },
    });

    return {
      data: prices.map((p) => ({
        ...p,
        daysRemaining: Math.ceil((new Date(p.validUntil!).getTime() - now) / 86400000),
      })),
      count: prices.length,
      days,
    };
  }

  /**
   * Campos calculados de vigencia (OLA 6) — solo en la respuesta, no en schema.
   * - isExpired: validUntil ya pasó.
   * - isExpiringSoon: no vencida y vence en <= 30 días.
   * - daysUntilExpiry: ceil de días restantes (negativo si venció); null sin validUntil.
   */
  private computeExpiry(validUntil: Date | null) {
    if (!validUntil) {
      return { isExpired: false, isExpiringSoon: false, daysUntilExpiry: null };
    }
    const diffMs = new Date(validUntil).getTime() - Date.now();
    return {
      isExpired: diffMs < 0,
      isExpiringSoon: diffMs >= 0 && diffMs <= 30 * 86400000,
      daysUntilExpiry: Math.ceil(diffMs / 86400000),
    };
  }

  /** Accesos (assignments LISTA) de una Lista — requiere manage_access (checklist 30). */
  async findAssignments(id: string, ctx: AccessContext) {
    await this.acl.assertListaAccess(id, ctx, 'manage_access');
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

  /** Crear Lista — Super Admin y Admin Comercial (el creador queda auto-asignado con manage_access; otros accesos los gestiona después el Super Admin). */
  async create(dto: CreateListaDto, ctx: AccessContext) {
    const canCreate = ['Super Admin', 'Admin Comercial'].some((r) => ctx.roles?.includes(r));
    if (!canCreate) {
      throw new ForbiddenException('Solo Super Admin o Admin Comercial pueden crear Listas');
    }

    const existing = await this.prisma.lista.findUnique({
      where: { code: dto.code },
      select: { id: true },
    });
    if (existing) throw new ConflictException('Ya existe una Lista con ese código');

    if (dto.codigo) {
      const dupCodigo = await this.prisma.lista.findUnique({
        where: { codigo: dto.codigo },
        select: { id: true },
      });
      if (dupCodigo) throw new ConflictException('Ya existe una Lista con ese código de identificación');
    }

    await this.validateResponsible(dto.responsibleId);
    await this.validateSupplier(dto.supplierId);
    this.assertCoherentValidity(dto.validFrom, dto.validUntil);

    const created = await this.prisma.lista.create({
      data: {
        code: dto.code,
        codigo: dto.codigo ?? null,
        name: dto.name,
        description: dto.description ?? null,
        currency: dto.currency ?? 'COP',
        isActive: dto.isActive ?? true,
        type: dto.type ?? null,
        defaultVisibility: dto.defaultVisibility ?? false,
        responsibleId: dto.responsibleId ?? null,
        supplierId: dto.supplierId ?? null,
        validFrom: dto.validFrom ? new Date(dto.validFrom) : null,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
        createdById: ctx.userId,
      },
    });

    await this.audit.log({
      userId: ctx.userId,
      action: 'create',
      entity: 'LISTA',
      entityId: created.id,
      newValues: {
        code: created.code,
        codigo: created.codigo,
        name: created.name,
        currency: created.currency,
        isActive: created.isActive,
        type: created.type,
        defaultVisibility: created.defaultVisibility,
        responsibleId: created.responsibleId,
        supplierId: created.supplierId,
        validFrom: created.validFrom,
        validUntil: created.validUntil,
      },
    });

    // Auto-asignación del creador (deny-by-default del findAll): sin este
    // assignment, una Lista creada por un Admin Comercial no aparece en su
    // propio listado. Es su recurso recién creado, no un otorgamiento a
    // terceros (la anti-escalada del módulo assignments aplica a terceros).
    await this.prisma.assignment.upsert({
      where: {
        userId_resourceType_resourceId: {
          userId: ctx.userId,
          resourceType: 'LISTA',
          resourceId: created.id,
        },
      },
      create: {
        userId: ctx.userId,
        resourceType: 'LISTA',
        resourceId: created.id,
        level: 'manage_access',
        isActive: true,
      },
      update: { level: 'manage_access', isActive: true },
    });

    return created;
  }

  // Límites prudenciales (schema sin maxLength en code/name; Postgres text sin tope).
  private readonly LISTA_NAME_MAX = 120;
  private readonly LISTA_CODE_MAX = 60;
  private readonly COPIA_SUFFIX = '-COPIA-';

  /**
   * Duplicar una Lista — requiere edit+ sobre la Lista origen (mismo patrón de
   * escritura del módulo). Crea una copia de CONFIGURACIÓN:
   * - Mismo name + " (copia)", code único nuevo (`code + "-COPIA-XXXX"`).
   * - Mismos currency/description/type/defaultVisibility/validFrom/validUntil/responsibleId.
   * - isActive: false — decisión documentada (OLA 6): la copia nace INACTIVA, es un molde
   *   que el operador debe revisar y activar explícitamente antes de publicar precios.
   * - NO copia productos, precios ni assignments: es un molde de configuración que se
   *   puebla después a conveniencia (evita duplicar datos transaccionales por error).
   */
  async duplicateLista(id: string, ctx: AccessContext) {
    const source = await this.prisma.lista.findUnique({ where: { id } });
    if (!source) throw new NotFoundException('Lista no encontrada');
    await this.acl.assertListaAccess(id, ctx, 'manage');

    const nameSuffix = ' (copia)';
    const name = `${source.name.slice(0, this.LISTA_NAME_MAX - nameSuffix.length)}${nameSuffix}`;
    const code = await this.generateUniqueCode(source.code);

    const created = await this.prisma.lista.create({
      data: {
        code,
        name,
        description: source.description,
        currency: source.currency,
        type: source.type,
        defaultVisibility: source.defaultVisibility,
        validFrom: source.validFrom,
        validUntil: source.validUntil,
        responsibleId: source.responsibleId,
        supplierId: source.supplierId,
        isActive: false,
        createdById: ctx.userId ?? null,
        updatedById: ctx.userId ?? null,
      },
    });

    await this.audit.log({
      userId: ctx.userId,
      action: 'duplicate',
      entity: 'LISTA',
      entityId: created.id,
      oldValues: { sourceId: id },
      newValues: { code, name, isActive: created.isActive, currency: created.currency },
    });

    return { ...created, productCount: 0, ...this.computeExpiry(created.validUntil) };
  }

  /** Genera un code único `base-COPIA-XXXX` (4 chars alfanuméricos sin ambiguos). */
  private async generateUniqueCode(sourceCode: string): Promise<string> {
    const base = sourceCode.slice(0, this.LISTA_CODE_MAX - this.COPIA_SUFFIX.length - 4);
    let candidate = `${base}${this.COPIA_SUFFIX}${this.randomSuffix()}`;
    for (let attempt = 0; attempt < 5; attempt++) {
      const exists = await this.prisma.lista.findUnique({
        where: { code: candidate },
        select: { id: true },
      });
      if (!exists) return candidate;
      candidate = `${base}${this.COPIA_SUFFIX}${this.randomSuffix()}`;
    }
    // Último recurso (colisión improbable): sufijo timestamp para garantizar unicidad.
    return `${base}${this.COPIA_SUFFIX}${Date.now().toString(36).toUpperCase()}`;
  }

  private randomSuffix(): string {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin I,O,0,1 (evita ambigüedad visual)
    const bytes = randomBytes(4);
    let out = '';
    for (let i = 0; i < 4; i++) out += alphabet[bytes[i] % alphabet.length];
    return out;
  }

  /** Editar Lista (campos) — requiere edit+. Archivar (archivedAt) — requiere manage. */
  async update(id: string, dto: UpdateListaDto, ctx: AccessContext) {
    const lista = await this.prisma.lista.findUnique({ where: { id } });
    if (!lista) throw new NotFoundException('Lista no encontrada');

    const oldValues = {
      name: lista.name,
      code: lista.code,
      codigo: lista.codigo,
      description: lista.description,
      currency: lista.currency,
      isActive: lista.isActive,
      archivedAt: lista.archivedAt,
      type: lista.type,
      defaultVisibility: lista.defaultVisibility,
      responsibleId: lista.responsibleId,
      supplierId: lista.supplierId,
      validFrom: lista.validFrom,
      validUntil: lista.validUntil,
    };

    // El nivel requerido depende de si se está archivando/restaurando.
    // Niveles (checklist 29/30): editar campos → edit_products; archivar/restaurar → manage.
    // Para archivar/restaurar se usa assertListaRestoreAccess: NO exige isActive/archivedAt,
    // así una Lista ya archivada (isActive=false) puede restaurarse (BUG-3).
    const requiresManage = dto.archivedAt !== undefined;
    if (requiresManage) {
      await this.acl.assertListaRestoreAccess(id, ctx, 'manage');
    } else {
      await this.acl.assertListaAccess(id, ctx, 'edit_products');
    }

    if (dto.code && dto.code !== lista.code) {
      const dup = await this.prisma.lista.findUnique({ where: { code: dto.code }, select: { id: true } });
      if (dup) throw new ConflictException('Ya existe una Lista con ese código');
    }

    if (dto.codigo !== undefined && dto.codigo !== lista.codigo) {
      if (dto.codigo) {
        const dup = await this.prisma.lista.findUnique({ where: { codigo: dto.codigo }, select: { id: true } });
        if (dup) throw new ConflictException('Ya existe una Lista con ese código de identificación');
      }
    }

    await this.validateResponsible(dto.responsibleId);
    if (dto.supplierId !== undefined) {
      await this.validateSupplier(dto.supplierId);
    }
    this.assertCoherentValidity(dto.validFrom, dto.validUntil);

    const data: Record<string, unknown> = {};
    if (dto.name) data.name = dto.name;
    if (dto.code) data.code = dto.code;
    if (dto.codigo !== undefined) data.codigo = dto.codigo ?? null;
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
    if (dto.supplierId !== undefined) data.supplierId = dto.supplierId ?? null;
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

  /** Activar / desactivar Lista — requiere edit_products (checklist 29/30). */
  async toggleActive(id: string, ctx: AccessContext) {
    const lista = await this.prisma.lista.findUnique({ where: { id } });
    if (!lista) throw new NotFoundException('Lista no encontrada');
    await this.acl.assertListaAccess(id, ctx, 'edit_products');

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

  /** Restaurar (desarchivar) — requiere manage (assertListaRestoreAccess: la Lista archivada/inactiva no bloquea). */
  async restore(id: string, ctx: AccessContext) {
    const lista = await this.prisma.lista.findUnique({ where: { id } });
    if (!lista) throw new NotFoundException('Lista no encontrada');
    await this.acl.assertListaRestoreAccess(id, ctx, 'manage');

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

  /**
   * Eliminación física de una Lista — Super Admin y Admin Comercial (isListasAdmin).
   *
   * Bloqueada (409) si la Lista tiene datos asociados: productos, precios,
   * accesos (assignments) o historial de auditoría. El conteo de historial
   * EXCLUYE el evento `create` (decisión OLA 7A): toda Lista creada por API
   * genera un audit de creación, y permitir borrar una Lista vacía recién
   * creada exige que ese evento no bloquee; el historial significativo
   * (update/archive/restore/duplicate/toggle) sí bloquea. Se audita la
   * eliminación ANTES de borrar para capturar id/nombre en el log.
   *
   * Fix H9: solo los accesos ACTIVOS de terceros bloquean. Las assignments
   * soft-deleted (isActive=false) son ruido interno y NO bloquean el borrado,
   * y al eliminar la Lista se hace hard-delete de TODAS sus assignments
   * (Assignment no tiene FK a Lista) para no dejar registros huérfanos.
   */
  async removeLista(id: string, ctx: AccessContext) {
    if (!this.acl.isListasAdmin(ctx.roles)) {
      throw new ForbiddenException('Solo Super Admin o Admin Comercial pueden eliminar Listas');
    }

    const lista = await this.prisma.lista.findUnique({
      where: { id },
      select: { id: true, name: true, code: true },
    });
    if (!lista) throw new NotFoundException('Lista no encontrada');

    const [products, prices, assignments, auditLogs] = await Promise.all([
      this.prisma.product.count({ where: { listaId: id } }),
      this.prisma.price.count({ where: { listaId: id } }),
      // Fix H9: solo accesos ACTIVOS de terceros bloquean. La auto-asignación del
      // propio actor (create → manage_access del creador) y las assignments
      // soft-deleted (isActive=false) son ruido interno y NO bloquean, de modo que
      // el creador (Super Admin o Admin Comercial) puede eliminar su Lista vacía.
      this.prisma.assignment.count({
        where: {
          resourceType: 'LISTA',
          resourceId: id,
          isActive: true,
          ...(ctx.userId ? { NOT: { userId: ctx.userId } } : {}),
        },
      }),
      this.prisma.auditLog.count({ where: { entity: 'LISTA', entityId: id, action: { not: 'create' } } }),
    ]);

    const impact: string[] = [];
    if (products > 0) impact.push(`${products} producto${products === 1 ? '' : 's'}`);
    if (prices > 0) impact.push(`${prices} precio${prices === 1 ? '' : 's'}`);
    if (assignments > 0) impact.push(`${assignments} accesos`);
    if (auditLogs > 0) impact.push(`${auditLogs} registros de historial`);

    if (impact.length > 0) {
      throw new ConflictException(
        `La Lista tiene ${impact.join(' y ')}. Archívela o elimine los datos asociados primero.`,
      );
    }

    await this.audit.log({
      userId: ctx.userId,
      action: 'delete',
      entity: 'LISTA',
      entityId: lista.id,
      newValues: { code: lista.code, name: lista.name },
    });

    // Fix H9: hard-delete de las assignments de la Lista (Assignment no tiene FK a
    // Lista) para no dejar registros huérfanos, sean activos o soft-deleted.
    await this.prisma.assignment.deleteMany({
      where: { resourceType: 'LISTA', resourceId: id },
    });

    await this.prisma.lista.delete({ where: { id } });
    return { message: 'Lista eliminada exitosamente' };
  }

  /** Alias interno: require manage (incluye deny-by-default por inactiva/archivada). */
  private async assertManage(id: string, ctx: AccessContext): Promise<void> {
    await this.acl.assertListaAccess(id, ctx, 'manage');
  }

  /**
   * ¿El usuario puede ver precios sobre una Lista? Requiere edit_prices o superior
   * (checklist 29/30). Super Admin siempre.
   */
  private async userCanSeePrices(listaId: string, ctx: AccessContext): Promise<boolean> {
    if (this.acl.isListasAdmin(ctx.roles)) return true;
    const level = await this.acl.getUserLevel(ctx.userId!, listaId, ctx.roles);
    return !!level && (LEVEL_RANK[level] ?? 0) >= (LEVEL_RANK['edit_prices'] ?? 0);
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
   * Valida que el proveedor exista cuando se envía supplierId (no aplica a null).
   */
  private async validateSupplier(supplierId?: string | null): Promise<void> {
    if (!supplierId) return;
    const supplier = await this.prisma.supplier.findUnique({
      where: { id: supplierId },
      select: { id: true },
    });
    if (!supplier) throw new NotFoundException('Proveedor no encontrado');
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
