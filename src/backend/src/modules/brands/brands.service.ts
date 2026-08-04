import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';
import { UPLOADS_DIR, UPLOADS_URL_PREFIX } from '../../common/uploads-path';

const ALLOWED_BRAND_IMAGE_MIMETYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};
const MAX_BRAND_IMAGE_SIZE = 8 * 1024 * 1024; // 8 MB

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

  async toggleActive(id: string) {
    const brand = await this.prisma.brand.findUnique({ where: { id } });
    if (!brand) throw new NotFoundException('Marca no encontrada');

    return this.prisma.brand.update({
      where: { id },
      data: { isActive: !brand.isActive },
    });
  }

  /**
   * Sube el logo de una marca: valida mimetype (png/jpeg/webp) y tamaño
   * máximo (8 MB), guarda el archivo en UPLOADS_DIR con nombre único y
   * borra el logo anterior si era un upload interno.
   */
  async uploadLogo(id: string, file: Express.Multer.File) {
    const brand = await this.prisma.brand.findUnique({ where: { id } });
    if (!brand) throw new NotFoundException('Marca no encontrada');

    if (!file) {
      throw new BadRequestException('Archivo requerido en el campo "file"');
    }

    const ext = ALLOWED_BRAND_IMAGE_MIMETYPES[file.mimetype];
    if (!ext) {
      throw new BadRequestException('Tipo de archivo no permitido. Use PNG, JPEG o WEBP.');
    }

    if (file.size > MAX_BRAND_IMAGE_SIZE) {
      throw new BadRequestException('El archivo excede el tamaño máximo de 8MB');
    }

    const filename = `${randomUUID()}.${ext}`;
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }
    await fs.promises.writeFile(path.join(UPLOADS_DIR, filename), file.buffer);

    const url = `${UPLOADS_URL_PREFIX}/${filename}`;

    if (brand.logo?.startsWith(UPLOADS_URL_PREFIX)) {
      const oldPath = path.join(UPLOADS_DIR, path.basename(brand.logo));
      try {
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      } catch {
        // El logo anterior puede no existir en disco; no bloquea la actualización.
      }
    }

    return this.prisma.brand.update({
      where: { id },
      data: { logo: url },
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
