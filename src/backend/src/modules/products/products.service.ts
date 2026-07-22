import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Prisma } from '@prisma/client';
import * as XLSX from 'xlsx';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  async findAll(params?: {
    skip?: number;
    take?: number;
    search?: string;
    categoryId?: string;
    brandId?: string;
    isVisible?: boolean;
    isActive?: boolean;
  }) {
    const { skip = 0, take = 50, search, categoryId, brandId, isVisible, isActive } = params || {};

    const where: Prisma.ProductWhereInput = {
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { sku: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      }),
      ...(categoryId && { categoryId }),
      ...(brandId && { brandId }),
      ...(isVisible !== undefined && { isVisible }),
      ...(isActive !== undefined && { isActive }),
    };

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take,
        include: {
          category: { select: { id: true, name: true, slug: true } },
          brand: { select: { id: true, name: true, slug: true } },
          images: { where: { isPrimary: true }, take: 1 },
          prices: {
            include: { priceList: { select: { id: true, name: true, code: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      data: products,
      meta: { total, skip, take },
    };
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        brand: true,
        images: { orderBy: { sortOrder: 'asc' } },
        prices: {
          include: { priceList: true },
        },
      },
    });

    if (!product) throw new NotFoundException('Producto no encontrado');
    return product;
  }

  async create(dto: CreateProductDto) {
    const existingSku = await this.prisma.product.findUnique({ where: { sku: dto.sku } });
    if (existingSku) throw new ConflictException('Ya existe un producto con ese SKU');

    const category = await this.prisma.category.findUnique({ where: { id: dto.categoryId } });
    if (!category) throw new NotFoundException('Categoría no encontrada');

    const brand = await this.prisma.brand.findUnique({ where: { id: dto.brandId } });
    if (!brand) throw new NotFoundException('Marca no encontrada');

    return this.prisma.product.create({
      data: {
        sku: dto.sku,
        name: dto.name,
        description: dto.description,
        categoryId: dto.categoryId,
        brandId: dto.brandId,
        technicalSpecs: dto.technicalSpecs,
        isActive: dto.isActive ?? false,
        isVisible: dto.isVisible ?? false,
      },
      include: {
        category: { select: { id: true, name: true } },
        brand: { select: { id: true, name: true } },
      },
    });
  }

  async update(id: string, dto: UpdateProductDto) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException('Producto no encontrado');

    if (dto.sku && dto.sku !== product.sku) {
      const existing = await this.prisma.product.findUnique({ where: { sku: dto.sku } });
      if (existing) throw new ConflictException('Ya existe un producto con ese SKU');
    }

    if (dto.categoryId) {
      const category = await this.prisma.category.findUnique({ where: { id: dto.categoryId } });
      if (!category) throw new NotFoundException('Categoría no encontrada');
    }

    if (dto.brandId) {
      const brand = await this.prisma.brand.findUnique({ where: { id: dto.brandId } });
      if (!brand) throw new NotFoundException('Marca no encontrada');
    }

    return this.prisma.product.update({
      where: { id },
      data: {
        ...(dto.sku && { sku: dto.sku }),
        ...(dto.name && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.categoryId && { categoryId: dto.categoryId }),
        ...(dto.brandId && { brandId: dto.brandId }),
        ...(dto.technicalSpecs !== undefined && { technicalSpecs: dto.technicalSpecs }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.isVisible !== undefined && { isVisible: dto.isVisible }),
      },
      include: {
        category: { select: { id: true, name: true } },
        brand: { select: { id: true, name: true } },
      },
    });
  }

  async toggleVisibility(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException('Producto no encontrado');

    return this.prisma.product.update({
      where: { id },
      data: { isVisible: !product.isVisible },
    });
  }

  async toggleActive(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException('Producto no encontrado');

    return this.prisma.product.update({
      where: { id },
      data: { isActive: !product.isActive },
    });
  }

  async remove(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException('Producto no encontrado');

    await this.prisma.price.deleteMany({ where: { productId: id } });
    await this.prisma.productImage.deleteMany({ where: { productId: id } });
    await this.prisma.product.delete({ where: { id } });

    return { message: 'Producto eliminado exitosamente' };
  }

  async importFromExcel(file: Buffer) {
    if (!file) {
      throw new BadRequestException('No se proporcionó archivo');
    }

    const workbook = XLSX.read(file, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet);

    if (rows.length === 0) {
      throw new BadRequestException('El archivo está vacío');
    }

    const results = {
      total: rows.length,
      created: 0,
      skipped: 0,
      errors: [] as { row: number; sku: string; error: string }[],
    };

    // Get existing categories and brands for name-to-id mapping
    const categories = await this.prisma.category.findMany();
    const brands = await this.prisma.brand.findMany();

    const categoryMap = new Map(categories.map(c => [c.name.toLowerCase(), c.id]));
    const brandMap = new Map(brands.map(b => [b.name.toLowerCase(), b.id]));

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] as any;
      const rowNum = i + 2; // Excel row number (1-based + header)

      try {
        // Map Excel columns to product fields
        // Expected columns: SKU, Nombre, Descripción, Categoría, Marca
        const sku = String(row['SKU'] || row['sku'] || row['Código'] || row['codigo'] || '').trim();
        const name = String(row['Nombre'] || row['nombre'] || row['Name'] || row['name'] || '').trim();
        const description = String(row['Descripción'] || row['descripcion'] || row['Description'] || row['description'] || '').trim();
        const categoryName = String(row['Categoría'] || row['categoria'] || row['Category'] || row['category'] || '').trim();
        const brandName = String(row['Marca'] || row['marca'] || row['Brand'] || row['brand'] || '').trim();

        // Validate required fields
        if (!sku) {
          results.errors.push({ row: rowNum, sku: 'N/A', error: 'SKU vacío' });
          results.skipped++;
          continue;
        }

        if (!name) {
          results.errors.push({ row: rowNum, sku, error: 'Nombre vacío' });
          results.skipped++;
          continue;
        }

        // Find or create category
        let categoryId = categoryMap.get(categoryName.toLowerCase());
        if (!categoryId && categoryName) {
          const newCategory = await this.prisma.category.create({
            data: {
              name: categoryName,
              slug: categoryName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
              isActive: true,
            },
          });
          categoryId = newCategory.id;
          categoryMap.set(categoryName.toLowerCase(), categoryId);
        }

        if (!categoryId) {
          results.errors.push({ row: rowNum, sku, error: 'Categoría no especificada' });
          results.skipped++;
          continue;
        }

        // Find or create brand
        let brandId = brandMap.get(brandName.toLowerCase());
        if (!brandId && brandName) {
          const newBrand = await this.prisma.brand.create({
            data: {
              name: brandName,
              slug: brandName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
              isActive: true,
            },
          });
          brandId = newBrand.id;
          brandMap.set(brandName.toLowerCase(), brandId);
        }

        if (!brandId) {
          results.errors.push({ row: rowNum, sku, error: 'Marca no especificada' });
          results.skipped++;
          continue;
        }

        // Check if SKU already exists
        const existingProduct = await this.prisma.product.findUnique({ where: { sku } });
        if (existingProduct) {
          results.errors.push({ row: rowNum, sku, error: 'SKU ya existe' });
          results.skipped++;
          continue;
        }

        // Create product
        await this.prisma.product.create({
          data: {
            sku,
            name,
            description: description || null,
            categoryId,
            brandId,
            isActive: true,
            isVisible: false,
          },
        });

        results.created++;
      } catch (error) {
        results.errors.push({
          row: rowNum,
          sku: row['SKU'] || row['sku'] || 'N/A',
          error: error.message || 'Error desconocido',
        });
        results.skipped++;
      }
    }

    return results;
  }
}
