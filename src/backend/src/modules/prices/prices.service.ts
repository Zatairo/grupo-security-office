import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AclService, AccessContext } from '../../common/acl/acl.service';
import { CreatePriceDto } from './dto/create-price.dto';
import { UpdatePriceDto } from './dto/update-price.dto';
import { CreatePriceListDto } from './dto/create-price-list.dto';

/** Monedas permitidas para listas y precios (ISO 4217). */
const ALLOWED_CURRENCIES = ['COP', 'USD', 'EUR'] as const;

@Injectable()
export class PricesService {
  constructor(private prisma: PrismaService, private acl: AclService) {}

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

  /**
   * Valida invariantes de precio:
   *  - valor no negativo (value >= 0).
   *  - vigencia coherente (validFrom <= validUntil), combinando el valor nuevo
   *    con el persistido cuando solo se envía uno.
   */
  private validatePrice(
    value: number | undefined,
    validFrom?: string,
    validUntil?: string,
    existingFrom?: Date | string | null,
    existingUntil?: Date | string | null,
  ): void {
    if (value !== undefined && value < 0) {
      throw new BadRequestException('El valor del precio no puede ser negativo');
    }

    const from = validFrom ? new Date(validFrom) : existingFrom ? new Date(existingFrom as any) : null;
    const until = validUntil ? new Date(validUntil) : existingUntil ? new Date(existingUntil as any) : null;
    if (from && until && until.getTime() < from.getTime()) {
      throw new BadRequestException(
        'La fecha de fin (validUntil) no puede ser anterior a la fecha de inicio (validFrom)',
      );
    }
  }

  async findAllPriceLists() {
    // PriceList es metadato de tarifa (Majorista/Detalle/Oro/...); no contiene precios.
    // Se expone a roles autenticados (no se filtra por Lista).
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

  async findOnePriceList(id: string, ctx?: AccessContext) {
    // ACL: los precios incluidos deben filtrarse por las Listas autorizadas (deny-by-default).
    let allowedListaIds: string[] | null = null;
    if (ctx) {
      allowedListaIds = await this.acl.getAllowedListaIds(ctx.userId, ctx.roles, 'view');
    }

    const pricesWhere =
      allowedListaIds === null
        ? undefined
        : { product: { listaId: { in: allowedListaIds } } };

    const list = await this.prisma.priceList.findUnique({
      where: { id },
      include: {
        prices: {
          ...(pricesWhere ? { where: pricesWhere } : {}),
          include: { product: { select: { id: true, sku: true, name: true } } },
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

  async findPricesByProduct(productId: string, ctx?: AccessContext) {
    // Deny-by-default: exigir acceso a la Lista del producto.
    if (ctx) await this.acl.assertProductAccess(productId, ctx, 'view');

    const prices = await this.prisma.price.findMany({
      where: { productId },
      include: { priceList: true },
    });

    return { data: prices };
  }

  async findPricesByPriceList(priceListId: string, ctx?: AccessContext) {
    // Deny-by-default: solo precios cuyo producto pertenece a una Lista autorizada.
    let pricesWhere: { priceListId: string; product?: { listaId: { in: string[] } } } = { priceListId };
    if (ctx) {
      const allowed = await this.acl.getAllowedListaIds(ctx.userId, ctx.roles, 'view');
      if (allowed !== null) {
        pricesWhere.product = { listaId: { in: allowed } };
      }
    }

    const prices = await this.prisma.price.findMany({
      where: pricesWhere,
      include: {
        product: { select: { id: true, sku: true, name: true } },
      },
    });

    return { data: prices };
  }

  async createPrice(dto: CreatePriceDto, ctx?: AccessContext) {
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
      select: { id: true, listaId: true },
    });
    if (!product) throw new NotFoundException('Producto no encontrado');

    const priceList = await this.prisma.priceList.findUnique({ where: { id: dto.priceListId } });
    if (!priceList) throw new NotFoundException('Lista de precios no encontrada');

    // ACL: crear precio exige `edit` sobre la Lista del producto.
    if (ctx && product.listaId) await this.acl.assertListaAccess(product.listaId, ctx, 'edit');

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

    // Invariante: Price.listaId == Product.listaId.
    const productListaId = product.listaId ?? null;
    if (dto.listaId !== undefined && dto.listaId !== productListaId) {
      throw new ConflictException('El listaId del precio no coincide con la Lista del producto');
    }

    this.validateCurrency(dto.currency);
    this.validatePrice(dto.value, dto.validFrom, dto.validUntil);

    return this.prisma.price.create({
      data: {
        productId: dto.productId,
        priceListId: dto.priceListId,
        ...(productListaId ? { listaId: dto.listaId ?? productListaId } : {}),
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

  async updatePrice(id: string, dto: UpdatePriceDto, ctx?: AccessContext) {
    const price = await this.prisma.price.findUnique({ where: { id } });
    if (!price) throw new NotFoundException('Precio no encontrado');

    // ACL: actualizar precio exige `edit` sobre la Lista del producto dueño.
    if (ctx) {
      await this.acl.assertProductAccess(price.productId, ctx, 'edit');
    }

    // Invariante: si se cambia el listaId, debe coincidir con la Lista del producto.
    if (dto.listaId !== undefined) {
      const product = await this.prisma.product.findUnique({
        where: { id: price.productId },
        select: { id: true, listaId: true },
      });
      if (!product) throw new NotFoundException('Producto asociado al precio no encontrado');
      const productListaId = product.listaId ?? null;
      if (dto.listaId !== productListaId) {
        throw new ConflictException('El listaId del precio no coincide con la Lista del producto');
      }
    }

    this.validateCurrency(dto.currency);
    this.validatePrice(
      dto.value,
      dto.validFrom,
      dto.validUntil,
      price.validFrom,
      price.validUntil,
    );

    return this.prisma.price.update({
      where: { id },
      data: {
        ...(dto.value !== undefined && { value: dto.value }),
        ...(dto.listaId !== undefined && { listaId: dto.listaId }),
        ...(dto.currency && { currency: dto.currency }),
        ...(dto.validFrom !== undefined && { validFrom: dto.validFrom ?? null }),
        ...(dto.validUntil !== undefined && { validUntil: dto.validUntil ?? null }),
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
