import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCatalogDto } from './dto/create-catalog.dto';
import { UpdateCatalogDto } from './dto/update-catalog.dto';

@Injectable()
export class CatalogsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Construye el where de catálogos según la capa ACL (adicional al RBAC).
   * Regla:
   *  - Super Admin → todos los catálogos (baseWhere).
   *  - Usuario con asignaciones activas de tipo CATALOG → solo esos catálogos.
   *  - Usuario sin asignaciones de tipo CATALOG → todos (baseWhere).
   */
  private async buildAclWhere(
    userId: string | undefined,
    roles: string[],
    onlyActive: boolean,
  ): Promise<Record<string, unknown>> {
    const baseWhere: Record<string, unknown> = onlyActive ? { isActive: true } : {};

    if (!userId || roles.includes('Super Admin')) {
      return baseWhere;
    }

    const assignments = await this.prisma.assignment.findMany({
      where: { userId, resourceType: 'CATALOG', isActive: true },
      select: { resourceId: true },
    });

    if (assignments.length === 0) {
      return baseWhere;
    }

    return {
      ...baseWhere,
      id: { in: assignments.map((a) => a.resourceId) },
    };
  }

  async findAll(userId?: string, roles: string[] = []) {
    const where = await this.buildAclWhere(userId, roles, false);
    const catalogs = await this.prisma.catalog.findMany({
      where,
      include: {
        _count: { select: { products: true } },
      },
      orderBy: { name: 'asc' },
    });

    return {
      data: catalogs.map((c) => ({
        ...c,
        productCount: c._count.products,
      })),
    };
  }

  async findMine(userId?: string, roles: string[] = []) {
    const where = await this.buildAclWhere(userId, roles, true);
    const catalogs = await this.prisma.catalog.findMany({
      where,
      include: {
        _count: { select: { products: true } },
      },
      orderBy: { name: 'asc' },
    });

    return {
      data: catalogs.map((c) => ({
        ...c,
        productCount: c._count.products,
      })),
    };
  }

  async findOne(id: string, userId?: string, roles: string[] = []) {
    const catalog = await this.prisma.catalog.findUnique({
      where: { id },
      include: {
        _count: { select: { products: true } },
      },
    });

    if (!catalog) throw new NotFoundException('Catálogo no encontrado');

    await this.assertCatalogAccess(id, userId, roles);

    return {
      ...catalog,
      productCount: catalog._count.products,
    };
  }

  /**
   * ACL por recurso para GET /:id (misma regla que findAll/findMine):
   *  - Super Admin → acceso total.
   *  - Usuario con asignaciones activas CATALOG → solo sus resourceId (404 si no).
   *  - Usuario sin asignaciones CATALOG → acceso abierto.
   */
  private async assertCatalogAccess(
    resourceId: string,
    userId?: string,
    roles: string[] = [],
  ): Promise<void> {
    if (!userId || roles.includes('Super Admin')) {
      return;
    }

    const assignments = await this.prisma.assignment.findMany({
      where: { userId, resourceType: 'CATALOG', isActive: true },
      select: { resourceId: true },
    });

    if (assignments.length === 0) {
      return;
    }

    const allowedIds = assignments.map((a) => a.resourceId);
    if (!allowedIds.includes(resourceId)) {
      throw new NotFoundException('Catálogo no encontrado');
    }
  }

  async create(dto: CreateCatalogDto) {
    const existing = await this.prisma.catalog.findUnique({
      where: { code: dto.code },
    });
    if (existing) throw new ConflictException('Ya existe un catálogo con ese código');

    const catalog = await this.prisma.catalog.create({
      data: {
        name: dto.name,
        code: dto.code,
        description: dto.description,
        isActive: dto.isActive ?? true,
      },
    });

    return catalog;
  }

  async update(id: string, dto: UpdateCatalogDto) {
    const catalog = await this.prisma.catalog.findUnique({ where: { id } });
    if (!catalog) throw new NotFoundException('Catálogo no encontrado');

    const isActiveChanged =
      dto.isActive !== undefined && dto.isActive !== catalog.isActive;

    const updated = await this.prisma.catalog.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });

    if (isActiveChanged) {
      await this.prisma.product.updateMany({
        where: { catalogId: id },
        data: { isActive: dto.isActive! },
      });
    }

    return updated;
  }

  async remove(id: string) {
    const catalog = await this.prisma.catalog.findUnique({
      where: { id },
      include: { _count: { select: { products: true } } },
    });

    if (!catalog) throw new NotFoundException('Catálogo no encontrado');
    if (catalog._count.products > 0) {
      throw new ConflictException('No se puede eliminar un catálogo con productos asignados');
    }

    await this.prisma.catalog.delete({ where: { id } });
  }
}
