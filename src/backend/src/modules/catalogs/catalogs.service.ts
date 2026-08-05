import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCatalogDto } from './dto/create-catalog.dto';
import { UpdateCatalogDto } from './dto/update-catalog.dto';

@Injectable()
export class CatalogsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const catalogs = await this.prisma.catalog.findMany({
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

  async findMine() {
    const catalogs = await this.prisma.catalog.findMany({
      where: { isActive: true },
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

  async findOne(id: string) {
    const catalog = await this.prisma.catalog.findUnique({
      where: { id },
      include: {
        _count: { select: { products: true } },
      },
    });

    if (!catalog) throw new NotFoundException('Catálogo no encontrado');
    return {
      ...catalog,
      productCount: catalog._count.products,
    };
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

    const updated = await this.prisma.catalog.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });

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
