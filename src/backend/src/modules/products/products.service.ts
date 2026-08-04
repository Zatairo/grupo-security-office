import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { PriceInputDto } from './dto/price-input.dto';
import { Prisma } from '@prisma/client';
import * as XLSX from 'xlsx';
import { UPLOADS_DIR, UPLOADS_URL_PREFIX } from '../../common/uploads-path';

const ALLOWED_IMAGE_MIMETYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};
const MAX_IMAGE_SIZE = 8 * 1024 * 1024; // 8 MB

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  private trendingCache: { data: any; timestamp: number } | null = null;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutos de expiración de caché

  /**
   * Cachea productos tendencia por 5 minutos
   */
  private getFromTrendingCache(): any | null {
    if (!this.trendingCache) return null;
    if (Date.now() - this.trendingCache.timestamp > this.CACHE_TTL) {
      this.trendingCache = null;
    }
    return this.trendingCache?.data || null;
  }

  private setTrendingCache(data: any): void {
    this.trendingCache = {
      data,
      timestamp: Date.now(),
    };
  }

  /**
   * Obtiene productos tendencia (últimos 30 días visibles y activos)
   */
  async findTrending(params?: {
    take?: number;
    categoryId?: string;
    search?: string;
    forceReload?: boolean;
  }): Promise<{
    data: any;
    meta: { total: number; take?: number }
  }> {
    if (params?.forceReload || !this.getFromTrendingCache()) {
      const take = params?.take || 5;

      const where: Prisma.ProductWhereInput = {
        isVisible: true,
        isActive: true,
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        ...(params?.categoryId && { categoryId: params.categoryId }),
        ...(params?.search && {
          OR: [
            { name: { contains: params.search, mode: 'insensitive' } },
            { sku: { contains: params.search, mode: 'insensitive' } },
            { description: { contains: params.search, mode: 'insensitive' } },
          ],
        }),
      };

      const [products, total] = await Promise.all([
        this.prisma.product.findMany({
          where,
          take,
          orderBy: { createdAt: 'desc' },
          include: {
            category: { select: { id: true, name: true, slug: true } },
            brand: { select: { id: true, name: true, slug: true } },
            images: { where: { isPrimary: true }, take: 1 },
            prices: { include: { priceList: { select: { id: true, name: true, code: true } } } },
          },
        }),
        this.prisma.product.count({ where }),
      ]);

      this.setTrendingCache({
        data: products,
        meta: { total, take },
      });
    }

    const cached = this.getFromTrendingCache();
    return {
      data: cached?.data || [],
      meta: cached?.meta || { total: 0, take: params?.take || 5 },
    };
  }

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

    await this.validatePriceLists(dto.prices);

    const product = await this.prisma.product.create({
      data: {
        sku: dto.sku,
        name: dto.name,
        description: dto.description,
        categoryId: dto.categoryId,
        brandId: dto.brandId,
        technicalSpecs: dto.technicalSpecs,
        extraAttributes: dto.extraAttributes,
        isActive: dto.isActive ?? false,
        isVisible: dto.isVisible ?? false,
      },
      include: {
        category: { select: { id: true, name: true } },
        brand: { select: { id: true, name: true } },
      },
    });

    if (dto.prices && dto.prices.length > 0) {
      await this.upsertPrices(product.id, dto.prices);
    }

    return product;
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

    await this.validatePriceLists(dto.prices);

    const updated = await this.prisma.product.update({
      where: { id },
      data: {
        ...(dto.sku && { sku: dto.sku }),
        ...(dto.name && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.categoryId && { categoryId: dto.categoryId }),
        ...(dto.brandId && { brandId: dto.brandId }),
        ...(dto.technicalSpecs !== undefined && { technicalSpecs: dto.technicalSpecs }),
        ...(dto.extraAttributes !== undefined && { extraAttributes: dto.extraAttributes }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.isVisible !== undefined && { isVisible: dto.isVisible }),
      },
      include: {
        category: { select: { id: true, name: true } },
        brand: { select: { id: true, name: true } },
      },
    });

    if (dto.prices && dto.prices.length > 0) {
      await this.upsertPrices(id, dto.prices);
    }

    return updated;
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

    const images = await this.prisma.productImage.findMany({ where: { productId: id } });

    await this.prisma.price.deleteMany({ where: { productId: id } });
    await this.prisma.productImage.deleteMany({ where: { productId: id } });
    await this.prisma.product.delete({ where: { id } });

    for (const image of images) {
      const filename = path.basename(image.url);
      const filePath = path.join(UPLOADS_DIR, filename);
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch {
        // El archivo puede no existir en disco; no bloquea el borrado lógico.
      }
    }

    return { message: 'Producto eliminado exitosamente' };
  }

  /**
   * Sube una imagen para un producto y registra la fila ProductImage.
   * Valida tipo (jpeg/png/webp/gif) y tamaño máximo (8 MB).
   */
  async uploadImage(productId: string, file: Express.Multer.File, isPrimary = false) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException('Producto no encontrado');

    if (!file) {
      throw new BadRequestException('Archivo requerido en el campo "file"');
    }

    const ext = ALLOWED_IMAGE_MIMETYPES[file.mimetype];
    if (!ext) {
      throw new BadRequestException('Tipo de archivo no permitido. Use JPEG, PNG, WEBP o GIF.');
    }

    if (file.size > MAX_IMAGE_SIZE) {
      throw new BadRequestException('El archivo excede el tamaño máximo de 8MB');
    }

    const filename = `${randomUUID()}.${ext}`;
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }
    await fs.promises.writeFile(path.join(UPLOADS_DIR, filename), file.buffer);

    const url = `${UPLOADS_URL_PREFIX}/${filename}`;

    if (isPrimary) {
      await this.prisma.productImage.updateMany({
        where: { productId, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    return this.prisma.productImage.create({
      data: {
        productId,
        url,
        alt: file.originalname || null,
        isPrimary,
        sortOrder: 0,
      },
    });
  }

  /**
   * Elimina una imagen: borra el registro y el archivo del disco si existe.
   */
  async deleteImage(imageId: string) {
    const image = await this.prisma.productImage.findUnique({ where: { id: imageId } });
    if (!image) throw new NotFoundException('Imagen no encontrada');

    const filename = path.basename(image.url);
    const filePath = path.join(UPLOADS_DIR, filename);
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch {
      // El archivo puede no existir en disco; no bloquea el borrado lógico.
    }

    await this.prisma.productImage.delete({ where: { id: imageId } });
    return { message: 'Imagen eliminada exitosamente' };
  }

  /**
   * Valida que todos los priceListId existan en BD.
   */
  private async validatePriceLists(prices?: PriceInputDto[]): Promise<void> {
    if (!prices || prices.length === 0) return;

    const ids = [...new Set(prices.map((p) => p.priceListId))];
    const found = await this.prisma.priceList.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    });
    const foundIds = new Set(found.map((pl) => pl.id));
    const missing = ids.filter((id) => !foundIds.has(id));

    if (missing.length > 0) {
      throw new NotFoundException(
        `Listas de precios no encontradas: ${missing.join(', ')}`,
      );
    }
  }

  /**
   * Upsert individual por (productId, priceListId) dentro de una transacción.
   * No borra precios no enviados para no perder datos.
   */
  private async upsertPrices(productId: string, prices: PriceInputDto[]): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      for (const price of prices) {
        const validFrom = price.validFrom ? new Date(price.validFrom) : undefined;
        const validUntil = price.validUntil ? new Date(price.validUntil) : undefined;

        await tx.price.upsert({
          where: { productId_priceListId: { productId, priceListId: price.priceListId } },
          update: {
            value: price.value,
            ...(price.currency && { currency: price.currency }),
            ...(price.validFrom !== undefined && { validFrom: validFrom ?? null }),
            ...(price.validUntil !== undefined && { validUntil: validUntil ?? null }),
          },
          create: {
            productId,
            priceListId: price.priceListId,
            value: price.value,
            currency: price.currency ?? 'COP',
            ...(validFrom && { validFrom }),
            ...(validUntil && { validUntil }),
          },
        });
      }
    });
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
