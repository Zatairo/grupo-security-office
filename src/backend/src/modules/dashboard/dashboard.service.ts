import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AclService,
  AccessContext,
  LEVEL_RANK,
  ROLE_ASSIGNMENT_PREFIX,
  normalizeLevel,
} from '../../common/acl/acl.service';

export const MY_LISTAS_DEFAULT_TAKE = 12;
export const RECENT_ACTIVITY_TAKE = 10;
export const RECENT_ACTIVITY_WINDOW_DAYS = 30;

export interface MyListaSummary {
  id: string;
  code: string;
  name: string;
  currency: string;
  level: string | null;
  isResponsible: boolean;
  productCount: number;
  updatedAt: Date;
}

export interface MyActivityEntry {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  result: string | null;
  createdAt: Date;
}

export interface MyWorkspace {
  scope: 'GLOBAL' | 'ASSIGNED';
  kpis: {
    listas: number;
    products: number;
    pendingPublication: number;
    recentActivity: number;
  };
  listas: MyListaSummary[];
  recentActivity: MyActivityEntry[];
}

@Injectable()
export class DashboardService {
  constructor(
    private prisma: PrismaService,
    private acl: AclService,
  ) {}

  /**
   * Resumen del espacio de trabajo del usuario autenticado, resuelto en una sola
   * llamada HTTP (el dashboard anterior componia varias desde el frontend, patron
   * que ya provoco 429s en el wizard de importacion).
   *
   * El scope depende del rol: `GLOBAL` para admins de Listas (Super Admin y
   * Admin Comercial, que ven todas), `ASSIGNED` para el resto, que solo ve las
   * Listas donde tiene un assignment activo (directo o por rol).
   */
  async getMyWorkspace(
    ctx: AccessContext,
    params: { take?: number } = {},
  ): Promise<MyWorkspace> {
    const take = params.take ?? MY_LISTAS_DEFAULT_TAKE;
    const userId = ctx.userId;
    const allowedListaIds = await this.acl.getAllowedListaIds(
      userId,
      ctx.roles,
      'view',
    );
    const scope: 'GLOBAL' | 'ASSIGNED' =
      allowedListaIds === null ? 'GLOBAL' : 'ASSIGNED';

    // Solo Listas operables: activas y no archivadas (misma regla que el listado
    // de productos, ver FIX-PRODUCTS-ACTIVE-LISTA-FILTER-001).
    const listaWhere = {
      isActive: true,
      archivedAt: null,
      ...(allowedListaIds !== null && { id: { in: allowedListaIds } }),
    };

    const since = new Date(
      Date.now() - RECENT_ACTIVITY_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    );

    // Sin ninguna Lista accesible no hay nada que agregar sobre el catalogo, pero
    // la actividad del usuario sigue siendo suya: se omiten solo las queries de
    // Listas/productos y se devuelve el resto coherente.
    if (allowedListaIds !== null && allowedListaIds.length === 0) {
      const [recentActivityCount, recentActivity] = await Promise.all([
        this.getRecentActivityCount(userId, since),
        this.getRecentActivity(userId),
      ]);
      return {
        scope,
        kpis: {
          listas: 0,
          products: 0,
          pendingPublication: 0,
          recentActivity: recentActivityCount,
        },
        listas: [],
        recentActivity,
      };
    }

    const [
      listasCount,
      listas,
      productsCount,
      pendingPublication,
      recentActivityCount,
      recentActivity,
    ] = await Promise.all([
      this.prisma.lista.count({ where: listaWhere }),
      this.prisma.lista.findMany({
        where: listaWhere,
        orderBy: { updatedAt: 'desc' },
        take,
        select: {
          id: true,
          code: true,
          name: true,
          currency: true,
          responsibleId: true,
          updatedAt: true,
        },
      }),
      this.prisma.product.count({ where: { lista: listaWhere } }),
      this.prisma.product.count({
        where: { lista: listaWhere, isVisible: false },
      }),
      this.getRecentActivityCount(userId, since),
      this.getRecentActivity(userId),
    ]);

    const listaIds = listas.map((l) => l.id);
    const [counts, levelByLista] = await Promise.all([
      listaIds.length
        ? this.prisma.product.groupBy({
            by: ['listaId'],
            where: { listaId: { in: listaIds } },
            _count: { _all: true },
          })
        : Promise.resolve([] as Array<{ listaId: string | null; _count: { _all: number } }>),
      this.getLevelsForListas(listaIds, ctx),
    ]);

    const countByLista = new Map<string, number>();
    for (const row of counts) {
      if (row.listaId) countByLista.set(row.listaId, row._count._all);
    }

    return {
      scope,
      kpis: {
        listas: listasCount,
        products: productsCount,
        pendingPublication,
        recentActivity: recentActivityCount,
      },
      listas: listas.map((l) => ({
        id: l.id,
        code: l.code,
        name: l.name,
        currency: l.currency,
        level: levelByLista.get(l.id) ?? null,
        isResponsible: !!userId && l.responsibleId === userId,
        productCount: countByLista.get(l.id) ?? 0,
        updatedAt: l.updatedAt,
      })),
      recentActivity,
    };
  }

  private async getRecentActivityCount(
    userId: string | undefined,
    since: Date,
  ): Promise<number> {
    if (!userId) return 0;
    return this.prisma.auditLog.count({
      where: { userId, createdAt: { gte: since } },
    });
  }

  private async getRecentActivity(
    userId: string | undefined,
  ): Promise<MyActivityEntry[]> {
    if (!userId) return [];
    const logs = await this.prisma.auditLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: RECENT_ACTIVITY_TAKE,
      select: {
        id: true,
        action: true,
        entity: true,
        entityId: true,
        result: true,
        createdAt: true,
      },
    });
    return logs;
  }

  /**
   * Mejor nivel efectivo del usuario sobre cada Lista, en una sola query.
   * Los admins de Listas no tienen assignments propios: su nivel efectivo es
   * `manage_access` por rol, no por asignacion.
   */
  private async getLevelsForListas(
    listaIds: string[],
    ctx: AccessContext,
  ): Promise<Map<string, string>> {
    const result = new Map<string, string>();
    if (!listaIds.length) return result;

    if (this.acl.isListasAdmin(ctx.roles)) {
      for (const id of listaIds) result.set(id, 'manage_access');
      return result;
    }
    if (!ctx.userId) return result;

    const roleResourceIds = ctx.roles.map(
      (r) => `${ROLE_ASSIGNMENT_PREFIX}${r}`,
    );
    const assignments = await this.prisma.assignment.findMany({
      where: {
        resourceType: 'LISTA',
        isActive: true,
        OR: [
          { userId: ctx.userId, resourceId: { in: listaIds } },
          ...(roleResourceIds.length
            ? [{ resourceId: { in: roleResourceIds } }]
            : []),
        ],
      },
      select: { resourceId: true, level: true },
    });

    // Los grants por rol aplican a toda Lista accesible, no a un resourceId concreto.
    let bestRoleLevel: string | null = null;
    for (const a of assignments) {
      const level = normalizeLevel(a.level);
      if (!level) continue;

      if (a.resourceId.startsWith(ROLE_ASSIGNMENT_PREFIX)) {
        if ((LEVEL_RANK[level] ?? 0) > (LEVEL_RANK[bestRoleLevel ?? ''] ?? -1)) {
          bestRoleLevel = level;
        }
        continue;
      }
      const current = result.get(a.resourceId);
      if (!current || (LEVEL_RANK[level] ?? 0) > (LEVEL_RANK[current] ?? 0)) {
        result.set(a.resourceId, level);
      }
    }

    if (bestRoleLevel) {
      for (const id of listaIds) {
        const current = result.get(id);
        if (
          !current ||
          (LEVEL_RANK[bestRoleLevel] ?? 0) > (LEVEL_RANK[current] ?? 0)
        ) {
          result.set(id, bestRoleLevel);
        }
      }
    }

    return result;
  }
}
