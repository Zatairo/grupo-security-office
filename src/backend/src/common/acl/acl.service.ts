import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Niveles de acceso y su ranking (view < edit < manage).
 * Un assignment de nivel superior implica los niveles inferiores.
 */
export const LEVEL_RANK: Record<string, number> = {
  view: 0,
  edit: 1,
  manage: 2,
};

export const ASSIGNMENT_LEVELS = Object.keys(LEVEL_RANK);

export interface AccessContext {
  userId?: string;
  roles: string[];
}

/**
 * Servicio centralizado de autorización por Lista (ACL).
 *
 * Política:
 *  - Super Admin → acceso total (sin filtro, incluye Listas inactivas/archivadas).
 *  - Usuario autenticado sin assignment activo a una Lista → deny (no ve Lista,
 *    Producto ni Precio asociado; se devuelve 404 para ocultar existencia).
 *  - Assignment inactivo → tratado como inexistente.
 *  - Niveles aplicables: view (lectura), edit (lectura + edición de producto/precio),
 *    manage (administración de Lista + asignaciones + publicación).
 */
@Injectable()
export class AclService {
  constructor(private prisma: PrismaService) {}

  isSuperAdmin(roles: string[] | undefined): boolean {
    return !!roles && roles.includes('Super Admin');
  }

  /** Niveles con ranking >= al nivel solicitado. */
  levelsAtLeast(level: string): string[] {
    const target = LEVEL_RANK[level] ?? 0;
    return Object.keys(LEVEL_RANK).filter((l) => LEVEL_RANK[l] >= target);
  }

  /**
   * IDs de Listas a las que el usuario puede acceder con nivel >= `level`.
   * Devuelve `null` para Super Admin (sin filtro) o un arreglo (posiblemente vacío).
   */
  async getAllowedListaIds(
    userId: string | undefined,
    roles: string[],
    level: string = 'view',
  ): Promise<string[] | null> {
    if (!userId || this.isSuperAdmin(roles)) return null;

    const levels = this.levelsAtLeast(level);
    const assignments = await this.prisma.assignment.findMany({
      where: {
        userId,
        resourceType: 'LISTA',
        isActive: true,
        level: { in: levels },
      },
      select: { resourceId: true },
    });

    return assignments.map((a) => a.resourceId);
  }

  /** Nivel máximo efectivo del usuario sobre una Lista concreta (null si no tiene assignment activo). */
  async getUserLevel(userId: string, listaId: string): Promise<string | null> {
    const assignments = await this.prisma.assignment.findMany({
      where: {
        userId,
        resourceType: 'LISTA',
        resourceId: listaId,
        isActive: true,
      },
      select: { level: true },
    });

    if (assignments.length === 0) return null;

    return assignments.reduce<string>((best, a) => {
      const bestRank = LEVEL_RANK[best] ?? 0;
      const curRank = LEVEL_RANK[a.level] ?? 0;
      return curRank > bestRank ? a.level : best;
    }, assignments[0].level);
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
    if (this.isSuperAdmin(ctx.roles)) return;

    const userLevel = await this.getUserLevel(ctx.userId!, listaId);
    if (!userLevel) {
      throw new NotFoundException('Lista no encontrada');
    }

    if (LEVEL_RANK[userLevel] < (LEVEL_RANK[level] ?? 0)) {
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
   * Verifica acceso a un Producto exigiendo `level` sobre la Lista dueña del producto.
   * No revela existencia del producto si la Lista no está autorizada.
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
    if (this.isSuperAdmin(ctx.roles)) return true;
    const userLevel = await this.getUserLevel(ctx.userId!, listaId);
    if (!userLevel) return false;
    return LEVEL_RANK[userLevel] >= (LEVEL_RANK[level] ?? 0);
  }
}
