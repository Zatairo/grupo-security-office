import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const categories = await this.prisma.category.findMany({
      include: {
        parent: { select: { id: true, name: true } },
        _count: { select: { products: true, children: true } },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    return {
      data: categories.map((c) => ({
        ...c,
        productCount: c._count.products,
        childrenCount: c._count.children,
      })),
    };
  }

  async findTree() {
    const categories = await this.prisma.category.findMany({
      where: { parentId: null },
      include: {
        children: {
          include: {
            children: true,
            _count: { select: { products: true } },
          },
        },
        _count: { select: { products: true } },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    return { data: categories };
  }

  async findOne(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        parent: { select: { id: true, name: true } },
        children: { select: { id: true, name: true } },
        _count: { select: { products: true } },
      },
    });

    if (!category) throw new NotFoundException('Categoría no encontrada');
    return category;
  }

  async create(dto: CreateCategoryDto) {
    const existing = await this.prisma.category.findUnique({
      where: { slug: dto.slug },
    });
    if (existing) throw new ConflictException('Ya existe una categoría con ese slug');

    if (dto.parentId) {
      const parent = await this.prisma.category.findUnique({ where: { id: dto.parentId } });
      if (!parent) throw new NotFoundException('Categoría padre no encontrada');
    }

    const category = await this.prisma.category.create({
      data: {
        name: dto.name,
        description: dto.description,
        slug: dto.slug,
        parentId: dto.parentId,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
    });

    return category;
  }

  async update(id: string, dto: UpdateCategoryDto) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) throw new NotFoundException('Categoría no encontrada');

    if (dto.slug && dto.slug !== category.slug) {
      const existing = await this.prisma.category.findUnique({ where: { slug: dto.slug } });
      if (existing) throw new ConflictException('Ya existe una categoría con ese slug');
    }

    if (dto.parentId) {
      const parent = await this.prisma.category.findUnique({ where: { id: dto.parentId } });
      if (!parent) throw new NotFoundException('Categoría padre no encontrada');
    }

    const updated = await this.prisma.category.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.slug && { slug: dto.slug }),
        ...(dto.parentId !== undefined && { parentId: dto.parentId }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });

    return updated;
  }

  async remove(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: { products: true, children: true },
    });

    if (!category) throw new NotFoundException('Categoría no encontrada');
    if (category.products.length > 0) {
      throw new ConflictException('No se puede eliminar una categoría con productos');
    }
    if (category.children.length > 0) {
      throw new ConflictException('No se puede eliminar una categoría con subcategorías');
    }

    await this.prisma.category.delete({ where: { id } });
    return { message: 'Categoría eliminada exitosamente' };
  }
}
