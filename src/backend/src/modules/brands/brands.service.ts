import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';

@Injectable()
export class BrandsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const brands = await this.prisma.brand.findMany({
      include: {
        _count: { select: { products: true } },
      },
      orderBy: { name: 'asc' },
    });

    return {
      data: brands.map((b) => ({
        ...b,
        productCount: b._count.products,
      })),
    };
  }

  async findOne(id: string) {
    const brand = await this.prisma.brand.findUnique({
      where: { id },
      include: {
        products: { select: { id: true, name: true, sku: true } },
        _count: { select: { products: true } },
      },
    });

    if (!brand) throw new NotFoundException('Marca no encontrada');
    return brand;
  }

  async create(dto: CreateBrandDto) {
    const existingName = await this.prisma.brand.findUnique({ where: { name: dto.name } });
    if (existingName) throw new ConflictException('Ya existe una marca con ese nombre');

    const existingSlug = await this.prisma.brand.findUnique({ where: { slug: dto.slug } });
    if (existingSlug) throw new ConflictException('Ya existe una marca con ese slug');

    return this.prisma.brand.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        logo: dto.logo,
        description: dto.description,
        website: dto.website,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async update(id: string, dto: UpdateBrandDto) {
    const brand = await this.prisma.brand.findUnique({ where: { id } });
    if (!brand) throw new NotFoundException('Marca no encontrada');

    if (dto.name && dto.name !== brand.name) {
      const existing = await this.prisma.brand.findUnique({ where: { name: dto.name } });
      if (existing) throw new ConflictException('Ya existe una marca con ese nombre');
    }

    if (dto.slug && dto.slug !== brand.slug) {
      const existing = await this.prisma.brand.findUnique({ where: { slug: dto.slug } });
      if (existing) throw new ConflictException('Ya existe una marca con ese slug');
    }

    return this.prisma.brand.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.slug && { slug: dto.slug }),
        ...(dto.logo !== undefined && { logo: dto.logo }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.website !== undefined && { website: dto.website }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async remove(id: string) {
    const brand = await this.prisma.brand.findUnique({
      where: { id },
      include: { products: true },
    });

    if (!brand) throw new NotFoundException('Marca no encontrada');
    if (brand.products.length > 0) {
      throw new ConflictException('No se puede eliminar una marca con productos');
    }

    await this.prisma.brand.delete({ where: { id } });
    return { message: 'Marca eliminada exitosamente' };
  }
}
