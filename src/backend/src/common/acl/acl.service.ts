import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Niveles de acceso reales (checklist 29/30) y su ranking.
 * Un assignment de nivel superior implica los niveles inferiores.
 *
 *  view:0           → ver Lista SIN precios.
 *  edit_prices:1    → view + ver precios + editar precios.
 *  edit_products:2  → edit_prices + editar productos.
 *  edit:2           → ALIAS legacy de edit_products (compatibilidad OLA 4/7A).
 *  manage:3         → todo + archivar/duplicar/eliminar Lista + gestionar accesos de nivel inferior.
 *  manage_access:4  → manage + administrar accesos (otorgar manage/manage_access).
 */
export const LEVEL_RANK: Record<string, number> = {
  view: 0,
  edit_prices: 1,
  edit_products: 2,
  edit: 2,
  manage: 3,
  manage_access: 4,
};

export const ASSIGNMENT_LEVELS = Object.keys(LEVEL_RANK);

/** Convierte un nivel a su forma canónica (edit → edit_products). */
export function normalizeLevel(level?: string | null): string | null {
  if (!level) return null;
  if (level === 'edit') return 'edit_products';
  return LEVEL_RANK[level] !== undefined ? level : null;
}

export interface AccessContext {
  userId?: string;
  roles: string[];
}

/** Prefijo para assignments por rol: resourceId = 'ROLE:{nombreDelRol}'. */
export const ROLE_ASSIGNMENT_PREFIX = 'ROLE:';

/**
 * Servicio centralizado de autorización por Lista (ACL).
 *
 * Política:
 *  - Super Admin → acceso total (sin filtro, incluye Listas inactivas/archivadas).
 *  - Admin Comercial (isListasAdmin) → mismo comportamiento que Super Admin sobre
 *    Listas/Productos/Precios (contenedor de compras): ve/administra TODAS las Listas.
 *    NO aplica a recursos globales (usuarios, roles, grants por rol, tipos legacy).
 *  - Usuario autenticado sin assignment activo a una Lista → deny (no ve Lista,
 *    Producto ni Precio asociado; se devuelve 404 para ocultar existencia).
 *  - Assignment inactivo → tratado como inexistente (salvo excepciones por PRODUCTO,
 *    donde isActive=false es una RESTRICCIÓN EXPLÍCITA que prevalece sobre la Lista).
 *  - Grants por rol: un assignment con resourceId='ROLE:{rol}' (resourceType LISTA)
 *    otorga ese nivel al usuario en TODAS las Listas. Convención documentada (OLA 1B):
 *    el modelo Assignment no permite userId null (schema), así que los grants por rol
 *    se materializan con resourceId especial y userId = actor que los creó.
 */
@Injectable()
export class AclService {
  constructor(private prisma: PrismaService) {}

  isSuperAdmin(roles: string[] | undefined): boolean {
    return !!roles && roles.includes('Super Admin');
  }

  /**
   * Admin del área comercial (contenedor de compras): es el "Super Admin de Listas/
   * Productos/Precios". Ve/administra TODAS las listas como Super Admin, pero NO
   * gestiona recursos globales (usuarios, roles, grants por rol, tipos legacy).
   */
  isListasAdmin(roles: string[] | undefined): boolean {
    return this.isSuperAdmin(roles) || !!roles?.includes('Admin Comercial');
  }

  /** Niveles con ranking >= al nivel solicitado. */
  levelsAtLeast(level: string): string[] {
    const target = LEVEL_RANK[level] ?? 0;
    return Object.keys(LEVEL_RANK).filter((l) => LEVEL_RANK[l] >= target);
  }

  /**
   * IDs de Listas a las que el usuario puede acceder con nivel >= `level`.
   * Devuelve `null` para Super Admin (sin filtro) o un arreglo (posiblemente vacío).
   * Incluye los grants por rol ('ROLE:{rol}') del usuario.
   */
  async getAllowedListaIds(
    userId: string | undefined,
    roles: string[],
    level: string = 'view',
  ): Promise<string[] | null> {
    if (!userId || this.isListasAdmin(roles)) return null;

    const levels = this.levelsAtLeast(level);
    const roleResourceIds = roles.map((r) => `${ROLE_ASSIGNMENT_PREFIX}${r}`);

    const [userAssignments, roleAssignments] = await Promise.all([
      this.prisma.assignment.findMany({
        where: {
          userId,
          resourceType: 'LISTA',
          isActive: true,
          level: { in: levels },
        },
        select: { resourceId: true },
      }),
      roleResourceIds.length
        ? this.prisma.assignment.findMany({
            where: {
              resourceType: 'LISTA',
              isActive: true,
              level: { in: levels },
            },
            select: { resourceId: true },
          })
        : Promise.resolve([]),
    ]);

    const ids = userAssignments.map((a) => a.resourceId);

    // Grant global por rol: si el usuario tiene un assignment ROLE:{rol} con nivel
    // suficiente, accede a TODAS las Listas activas a ese nivel.
    const hasRoleGrant = roleAssignments.some((a) =>
      roleResourceIds.includes(a.resourceId),
    );
    if (hasRoleGrant) {
      const all = await this.prisma.lista.findMany({
        where: { isActive: true, archivedAt: null },
        select: { id: true },
      });
      return all.map((l) => l.id);
    }

    return ids;
  }

  /**
   * Nivel máximo efectivo del usuario sobre una Lista concreta (null si no tiene
   * assignment activo). Considera assignments por usuario y grants por rol.
   */
  async getUserLevel(
    userId: string,
    listaId: string,
    roles: string[] = [],
  ): Promise<string | null> {
    const roleResourceIds = roles.map((r) => `${ROLE_ASSIGNMENT_PREFIX}${r}`);

    const [userLevels, roleLevels] = await Promise.all([
      this.prisma.assignment.findMany({
        where: {
          userId,
          resourceType: 'LISTA',
          resourceId: listaId,
          isActive: true,
        },
        select: { level: true },
      }),
      roleResourceIds.length
        ? this.prisma.assignment.findMany({
            where: {
              resourceType: 'LISTA',
              resourceId: { in: roleResourceIds },
              isActive: true,
            },
            select: { level: true },
          })
        : Promise.resolve([]),
    ]);

    const all = [...userLevels, ...roleLevels];
    if (all.length === 0) return null;

    return all.reduce<string>((best, a) => {
      const bestRank = LEVEL_RANK[best] ?? 0;
      const curRank = LEVEL_RANK[a.level] ?? 0;
      return curRank > bestRank ? a.level : best;
    }, all[0].level);
  }

  /**
   * Verifica acceso a una Lista concreta exigiendo `level` (default view).
   * - Super Admin: siempre autorizado (ve incluso Listas inactivas/archivadas).
   * - Sin assignment activo → NotFoundException (se oculta la existencia).
   * - Assignment activo pero nivel insuficiente → ForbiddenException.
   * - Lista inactiva/archivada para no-admin → NotFoundException.
   */
  async assertListaAccess(
    listaId: string,
    ctx: AccessContext,
    level: string = 'view',
  ): Promise<void> {
    if (this.isListasAdmin(ctx.roles)) return;

    const userLevel = await this.getUserLevel(ctx.userId!, listaId, ctx.roles);
    if (!userLevel) {
      throw new NotFoundException('Lista no encontrada');
    }

    if ((LEVEL_RANK[userLevel] ?? 0) < (LEVEL_RANK[level] ?? 0)) {
      throw new ForbiddenException('No tienes permisos suficientes sobre esta Lista');
    }

    const lista = await this.prisma.lista.findUnique({
      where: { id: listaId },
      select: { isActive: true, archivedAt: true },
    });
    if (!lista) throw new NotFoundException('Lista no encontrada');
    if (!lista.isActive || lista.archivedAt) {
      throw new NotFoundException('Lista no encontrada');
    }
  }

/**
   * Verifica acceso para restaurar/actualizar una Lista archivada.
   * Valida SOLO: existencia de la lista (404 si no existe) y nivel suficiente
   * (getUserLevel >= 'manage' o Super Admin). **No exige** isActive/archivedAt,
   * por lo que una Lista archivada (isActive=false, archivedAt set) puede restaurarse.
   * Este método está pensado para restore/update donde body incluye archivedAt: null.
   *
   * A diferencia de assertListaAccess: este NO lanza 404 si la lista está archivada,
   * permite la operación sobre Listas archivadas/inactivas.
   */
  async assertListaRestoreAccess(
    listaId: string,
    ctx: AccessContext,
    level: string = 'manage',
  ): Promise<void> {
    if (this.isListasAdmin(ctx.roles)) return;

    const lista = await this.prisma.lista.findUnique({
      where: { id: listaId },
      select: { id: true },
    });
    if (!lista) throw new NotFoundException('Lista no encontrada');

    const userLevel = await this.getUserLevel(ctx.userId!, listaId, ctx.roles);
    if (!userLevel) {
      throw new NotFoundException('Lista no encontrada');
    }

    if ((LEVEL_RANK[userLevel] ?? 0) < (LEVEL_RANK[level] ?? 0)) {
      throw new ForbiddenException('No tienes permisos suficientes sobre esta Lista');
    }
  }

  /**
   * Verifica acceso a un Producto con prioridad de restricción explícita (checklist 17/31).
   *
   * Algoritmo:
   *  1. El producto debe existir y tener Lista dueña (404 si no).
   *  2. Asignaciones PRODUCT del usuario sobre el producto (activas e inactivas).
   *  3. RESTRICCIÓN EXPLÍCITA PREVALE: si existe assignment PRODUCT con isActive=false
   *     → 403, aunque la Lista del producto permita.
   *  4. Excepción positiva: si existe assignment PRODUCT activo con nivel >= requerido
   *     → permite (usa el más alto), aunque la Lista deniegue.
   *  5. Sin assignment de producto → cae al acceso de la Lista dueña (legacy).
   */
  async assertProductAccess(
    productId: string,
    ctx: AccessContext,
    level: string = 'view',
  ): Promise<{ listaId: string | null }> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { listaId: true },
    });
    if (!product) throw new NotFoundException('Producto no encontrado');
    if (!product.listaId) throw new NotFoundException('Producto no encontrado');

    if (this.isListasAdmin(ctx.roles)) return { listaId: product.listaId };

    // 1. Excepciones por producto del usuario (activas e inactivas).
    const productAssignments = await this.prisma.assignment.findMany({
      where: {
        userId: ctx.userId,
        resourceType: 'PRODUCT',
        resourceId: productId,
      },
      select: { level: true, isActive: true },
    });

    // 2. Restricción explícita (isActive=false) prevalece sobre la Lista.
    if (productAssignments.some((a) => !a.isActive)) {
      throw new ForbiddenException('Acceso restringido a este producto');
    }

    // 3. Excepción positiva: assignment PRODUCT activo con el nivel más alto.
    const best = productAssignments
      .filter((a) => a.isActive)
      .reduce<string | null>((b, a) => {
        const cur = LEVEL_RANK[a.level] ?? 0;
        const bestRank = b ? LEVEL_RANK[b] ?? 0 : -1;
        return cur > bestRank ? a.level : b;
      }, null);

    if (best && (LEVEL_RANK[best] ?? 0) >= (LEVEL_RANK[level] ?? 0)) {
      return { listaId: product.listaId };
    }

    // 4. Sin excepción por producto → acceso de la Lista dueña (legacy + grants por rol).
    await this.assertListaAccess(product.listaId, ctx, level);
    return { listaId: product.listaId };
  }

  /**
   * Verifica acceso a un Precio exigiendo `level` sobre la Lista del producto dueño.
   * No revela existencia del precio si la Lista no está autorizada.
   */
  async assertPriceAccess(
    priceId: string,
    ctx: AccessContext,
    level: string = 'view',
  ): Promise<{ listaId: string }> {
    const price = await this.prisma.price.findUnique({
      where: { id: priceId },
      select: { product: { select: { listaId: true } } },
    });
    if (!price) throw new NotFoundException('Precio no encontrado');
    const listaId = price.product?.listaId;
    if (!listaId) throw new NotFoundException('Precio no encontrado');
    await this.assertListaAccess(listaId, ctx, level);
    return { listaId };
  }

  /** Devuelve true si el contexto (usuario/rol) puede operar sobre recursos de la Lista. */
  async can(
    listaId: string,
    ctx: AccessContext,
    level: string,
  ): Promise<boolean> {
    if (this.isListasAdmin(ctx.roles)) return true;
    const userLevel = await this.getUserLevel(ctx.userId!, listaId, ctx.roles);
    if (!userLevel) return false;
    return (LEVEL_RANK[userLevel] ?? 0) >= (LEVEL_RANK[level] ?? 0);
  }

  /**
   * ¿El contexto puede ADMINISTRAR ACCESOS sobre una Lista (manage_access)?
   * Super Admin siempre. Se usa para matrix/preview y audit de accesos.
   */
  async canManageAccessOnLista(
    listaId: string,
    ctx: AccessContext,
  ): Promise<boolean> {
    if (this.isListasAdmin(ctx.roles)) return true;
    const userLevel = await this.getUserLevel(ctx.userId!, listaId, ctx.roles);
    return (
      !!userLevel &&
      (LEVEL_RANK[userLevel] ?? 0) >= (LEVEL_RANK['manage_access'] ?? 0)
    );
  }

  /**
   * ¿El contexto puede ADMINISTRAR ACCESOS sobre un Producto (manage_access sobre
   * la Lista dueña)? Super Admin siempre.
   */
  async canManageAccessOnProduct(
    productId: string,
    ctx: AccessContext,
  ): Promise<boolean> {
    if (this.isListasAdmin(ctx.roles)) return true;
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { listaId: true },
    });
    if (!product?.listaId) return false;
    return this.canManageAccessOnLista(product.listaId, ctx);
  }

  /**
   * ¿El contexto puede GESTIONAR ACCESOS sobre una Lista (manage o superior)?
   * Mínimo para crear/actualizar/revocar assignments (anti-escalada lo acota).
   */
  async canAdministerAccessOnLista(
    listaId: string,
    ctx: AccessContext,
  ): Promise<boolean> {
    if (this.isListasAdmin(ctx.roles)) return true;
    const userLevel = await this.getUserLevel(ctx.userId!, listaId, ctx.roles);
    return (
      !!userLevel &&
      (LEVEL_RANK[userLevel] ?? 0) >= (LEVEL_RANK['manage'] ?? 0)
    );
  }

  /** Acciones permitidas para un nivel efectivo (matrix viewer). */
  actionsForLevel(level?: string | null) {
    const rank = level ? (LEVEL_RANK[level] ?? -1) : -1;
    return {
      ver: rank >= 0,
      verPrecios: rank >= 1,
      editarPrecios: rank >= 1,
      editarProductos: rank >= 2,
      administrar: rank >= 3,
      administrarAccesos: rank >= 4,
    };
  }
}