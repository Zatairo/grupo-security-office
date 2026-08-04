import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePriceDto } from './dto/create-price.dto';
import { UpdatePriceDto } from './dto/update-price.dto';
import { CreatePriceListDto } from './dto/create-price-list.dto';

/** Monedas permitidas para listas y precios (ISO 4217). */
const ALLOWED_CURRENCIES = ['COP', 'USD', 'EUR'] as const;

@Injectable()
export class PricesService {
  constructor(private prisma: PrismaService) {}

  /** Valida que la moneda (si se envía) esté en la whitelist. */
  private validateCurrency(currency?: string): void {
    if (currency && !(ALLOWED_CURRENCIES as readonly string[]).includes(currency)) {
      throw new BadRequestException(
        `Moneda no permitida. Use una de: ${ALLOWED_CURRENCIES.join(', ')}`,
      );
    }
  }

  /**
   * Valida que validUntil >= validFrom (si ambos están presentes).
   * Acepta Date (valor persistido) o string ISO (DTO).
   */
  private validatePriceListDates(
    validFrom: Date | string | null,
    validUntil: Date | string | null,
  ): void {
    if (!validFrom || !validUntil) return;
    const from = validFrom instanceof Date ? validFrom : new Date(validFrom);
    const until = validUntil instanceof Date ? validUntil : new Date(validUntil);
    if (until.getTime() < from.getTime()) {
      throw new BadRequestException(
        'La fecha de fin (validUntil) no puede ser anterior a la fecha de inicio (validFrom)',
      );
    }
  }

  async findAllPriceLists() {
    const lists = await this.prisma.priceList.findMany({
      include: {
        _count: { select: { prices: true } },
      },
      orderBy: { name: 'asc' },
    });

    return {
      data: lists.map((l) => ({
        ...l,
        priceCount: l._count.prices,
      })),
    };
  }

  async findOnePriceList(id: string) {
    const list = await this.prisma.priceList.findUnique({
      where: { id },
      include: {
        prices: {
          include: {
            product: { select: { id: true, sku: true, name: true } },
          },
        },
      },
    });

    if (!list) throw new NotFoundException('Lista de precios no encontrada');
    return list;
  }

  async createPriceList(dto: CreatePriceListDto) {
    const existing = await this.prisma.priceList.findUnique({ where: { code: dto.code } });
    if (existing) throw new ConflictException('Ya existe una lista con ese código');

    this.validateCurrency(dto.currency);
    this.validatePriceListDates(dto.validFrom ?? null, dto.validUntil ?? null);

    return this.prisma.priceList.create({
      data: {
        name: dto.name,
        code: dto.code,
        currency: dto.currency ?? 'COP',
        isActive: dto.isActive ?? true,
        validFrom: dto.validFrom,
        validUntil: dto.validUntil,
      },
    });
  }

  async updatePriceList(id: string, dto: Partial<CreatePriceListDto>) {
    const list = await this.prisma.priceList.findUnique({ where: { id } });
    if (!list) throw new NotFoundException('Lista de precios no encontrada');

    if (dto.code && dto.code !== list.code) {
      const existing = await this.prisma.priceList.findUnique({ where: { code: dto.code } });
      if (existing) throw new ConflictException('Ya existe una lista con ese código');
    }

    this.validateCurrency(dto.currency);

    const validFrom = dto.validFrom !== undefined ? dto.validFrom : list.validFrom;
    const validUntil = dto.validUntil !== undefined ? dto.validUntil : list.validUntil;
    this.validatePriceListDates(validFrom ?? null, validUntil ?? null);

    return this.prisma.priceList.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.code && { code: dto.code }),
        ...(dto.currency && { currency: dto.currency }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.validFrom !== undefined && { validFrom: dto.validFrom }),
        ...(dto.validUntil !== undefined && { validUntil: dto.validUntil }),
      },
    });
  }

  async togglePriceListActive(id: string) {
    const list = await this.prisma.priceList.findUnique({ where: { id } });
    if (!list) throw new NotFoundException('Lista de precios no encontrada');

    return this.prisma.priceList.update({
      where: { id },
      data: { isActive: !list.isActive },
    });
  }

  async removePriceList(id: string) {
    const list = await this.prisma.priceList.findUnique({
      where: { id },
      include: { _count: { select: { prices: true } } },
    });

    if (!list) throw new NotFoundException('Lista de precios no encontrada');
    if (list._count.prices > 0) {
      throw new ConflictException('No se puede eliminar una lista con precios asociados');
    }

    await this.prisma.priceList.delete({ where: { id } });
    return { message: 'Lista de precios eliminada exitosamente' };
  }

  async findPricesByProduct(productId: string) {
    const prices = await this.prisma.price.findMany({
      where: { productId },
      include: { priceList: true },
    });

    return { data: prices };
  }

  async findPricesByPriceList(priceListId: string) {
    const prices = await this.prisma.price.findMany({
      where: { priceListId },
      include: {
        product: { select: { id: true, sku: true, name: true } },
      },
    });

    return { data: prices };
  }

  async createPrice(dto: CreatePriceDto) {
    const product = await this.prisma.product.findUnique({ where: { id: dto.productId } });
    if (!product) throw new NotFoundException('Producto no encontrado');

    const priceList = await this.prisma.priceList.findUnique({ where: { id: dto.priceListId } });
    if (!priceList) throw new NotFoundException('Lista de precios no encontrada');

    const existing = await this.prisma.price.findUnique({
      where: {
        productId_priceListId: {
          productId: dto.productId,
          priceListId: dto.priceListId,
        },
      },
    });

    if (existing) {
      throw new ConflictException('Ya existe un precio para este producto en esta lista');
    }

    this.validateCurrency(dto.currency);

    return this.prisma.price.create({
      data: {
        productId: dto.productId,
        priceListId: dto.priceListId,
        value: dto.value,
        currency: dto.currency ?? 'COP',
        validFrom: dto.validFrom,
        validUntil: dto.validUntil,
      },
      include: {
        product: { select: { id: true, sku: true, name: true } },
        priceList: true,
      },
    });
  }

  async updatePrice(id: string, dto: UpdatePriceDto) {
    const price = await this.prisma.price.findUnique({ where: { id } });
    if (!price) throw new NotFoundException('Precio no encontrado');

    this.validateCurrency(dto.currency);

    return this.prisma.price.update({
      where: { id },
      data: {
        ...(dto.value !== undefined && { value: dto.value }),
        ...(dto.currency && { currency: dto.currency }),
        ...(dto.validFrom !== undefined && { validFrom: dto.validFrom }),
        ...(dto.validUntil !== undefined && { validUntil: dto.validUntil }),
      },
      include: {
        product: { select: { id: true, sku: true, name: true } },
        priceList: true,
      },
    });
  }

  async removePrice(id: string) {
    const price = await this.prisma.price.findUnique({ where: { id } });
    if (!price) throw new NotFoundException('Precio no encontrado');

    await this.prisma.price.delete({ where: { id } });
    return { message: 'Precio eliminado exitosamente' };
  }
}
