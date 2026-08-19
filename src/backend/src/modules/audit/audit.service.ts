import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

/**
 * Entidades del ámbito comercial (contenedor de compras). El Admin Comercial puede
 * ver SOLO auditoría de estas entidades; las entidades globales (User, Role,
 * Assignment) le están vedadas por diseño.
 */
export const COMERCIAL_ENTITIES = [
  'LISTA',
  'Product',
  'Category',
  'Brand',
  'Price',
  'Supplier',
  'SupplierEvaluation',
  'PurchaseOrder',
  'Stock',
] as const;

/** Contexto opcional de auditoría: roles del JWT actual. */
export interface AuditContext {
  roles?: string[];
}

/**
 * Formas canónicas de las entidades auditadas (clave = mayúsculas sin espacios).
 * Permite normalizar queries del frontend como `entity=Lista` → 'LISTA' o
 * `entity=Price list` → 'PriceList' contra lo que realmente guardan los servicios.
 */
const ENTITY_CANONICAL_MAP: Record<string, string> = {
  LISTA: 'LISTA',
  PRODUCT: 'Product',
  PRODUCTIMAGE: 'ProductImage',
  CATEGORY: 'Category',
  BRAND: 'Brand',
  PRICE: 'Price',
  PRICELIST: 'PriceList',
  SUPPLIER: 'Supplier',
  SUPPLIEREVALUATION: 'SupplierEvaluation',
  PURCHASEORDER: 'PurchaseOrder',
  STOCK: 'Stock',
  USER: 'User',
  ROLE: 'Role',
  ASSIGNMENT: 'Assignment',
  USERROLE: 'UserRole',
  ROLEPERMISSION: 'RolePermission',
  IMPORTMAPPING: 'ImportMapping',
};

/** Normaliza el parámetro `entity` del query a su forma canónica. */
export function normalizeEntity(entity?: string): string | undefined {
  if (!entity) return undefined;
  const key = entity.trim().toUpperCase().replace(/\s+/g, '');
  return ENTITY_CANONICAL_MAP[key] ?? entity;
}

/**
 * Normaliza el parámetro `action` del query a minúsculas (el frontend envía
 * `CREATE|UPDATE|DELETE`; la BD guarda `create/update/...`). Excepción: la
 * acción del importador se guarda en mayúsculas (`IMPORT_PRODUCTS`).
 */
export function normalizeAction(action?: string): string | undefined {
  if (!action) return undefined;
  const lower = action.trim().toLowerCase();
  if (lower === 'import_products') return 'IMPORT_PRODUCTS';
  return lower;
}

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(params: {
    userId?: string;
    action: string;
    entity: string;
    entityId: string;
    oldValues?: any;
    newValues?: any;
    ipAddress?: string;
    userAgent?: string;
  }) {
    return this.prisma.auditLog.create({
      data: {
        userId: params.userId,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        oldValues: params.oldValues ?? undefined,
        newValues: params.newValues ?? undefined,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      },
    });
  }

  /**
   * ¿El usuario ve auditoría GLOBAL (Super Admin / Supervisor)?
   * Solo estos dos roles ven todo; el resto (p.ej. Admin Comercial) se limita a
   * las entidades comerciales, sin importar el filtro `entity` del query.
   */
  private isGlobalAuditor(roles?: string[]): boolean {
    return !!roles && (roles.includes('Super Admin') || roles.includes('Supervisor'));
  }

  async findAll(
    params?: {
      skip?: number;
      take?: number;
      entity?: string;
      entityId?: string;
      userId?: string;
      action?: string;
    },
    ctx?: AuditContext,
  ) {
    const { skip = 0, take = 50, entity, entityId, userId, action } = params || {};
    const global = this.isGlobalAuditor(ctx?.roles);

    // C9: normaliza la entidad a su forma canónica (p.ej. 'Lista' → 'LISTA').
    const entityFilter = normalizeEntity(entity);
    // C8: normaliza la acción a minúsculas (p.ej. 'CREATE' → 'create').
    const actionFilter = normalizeAction(action);

    // Admin Comercial (no global): scope SOLO a entidades comerciales.
    // - Sin entity query → todas las comerciales.
    // - entity comercial → filtra por esa entidad.
    // - entity NO comercial (p.ej. User/Role/Assignment) → 0 filas (deny, no revela).
    let entityWhere: Prisma.AuditLogWhereInput = {};
    if (global) {
      if (entityFilter) entityWhere.entity = entityFilter;
    } else if (entityFilter) {
      entityWhere.entity = (COMERCIAL_ENTITIES as readonly string[]).includes(entityFilter)
        ? entityFilter
        : { in: [] };
    } else {
      entityWhere.entity = { in: [...COMERCIAL_ENTITIES] };
    }

    const where: Prisma.AuditLogWhereInput = {
      ...entityWhere,
      ...(entityId && { entityId }),
      ...(userId && { userId }),
      ...(actionFilter && { action: actionFilter }),
    };

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take,
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data: logs,
      meta: { total, skip, take },
    };
  }

  async findByEntity(entity: string, entityId: string, ctx?: AuditContext) {
    // C9: normaliza la entidad a su forma canónica (p.ej. 'Lista' → 'LISTA').
    const entityFilter = normalizeEntity(entity);

    // Admin Comercial no puede consultar auditoría de entidades globales:
    // si pide una entidad no comercial → devuelve vacío (no revela existencia).
    if (!this.isGlobalAuditor(ctx?.roles)) {
      if (!(COMERCIAL_ENTITIES as readonly string[]).includes(entityFilter)) {
        return { data: [] };
      }
    }

    const logs = await this.prisma.auditLog.findMany({
      where: { entity: entityFilter, entityId },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return { data: logs };
  }
}