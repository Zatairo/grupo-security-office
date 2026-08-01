import { createPrismaMock } from '../../__test__/mocks/prisma.mock';

const mockPrisma = createPrismaMock();

jest.mock('../../prisma/prisma.service', () => ({
  PrismaService: jest.fn().mockImplementation(() => mockPrisma),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { PricesService } from './prices.service';
import { PrismaService } from '../../prisma/prisma.service';

const mockPriceList = {
  id: 'pl-1',
  name: 'Lista Mayorista',
  code: 'MAYORISTA',
  currency: 'COP',
  isActive: true,
  validFrom: null,
  validUntil: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockPriceListWithCount = {
  ...mockPriceList,
  _count: { prices: 3 },
};

const mockPriceListWithPrices = {
  ...mockPriceList,
  prices: [
    {
      id: 'price-1',
      productId: 'prod-1',
      priceListId: 'pl-1',
      value: 1500000,
      currency: 'COP',
      validFrom: null,
      validUntil: null,
      product: { id: 'prod-1', sku: 'CAM-001', name: 'Cámara IP' },
    },
  ],
};

const mockPrice = {
  id: 'price-1',
  productId: 'prod-1',
  priceListId: 'pl-1',
  value: 1500000,
  currency: 'COP',
  validFrom: null,
  validUntil: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockPriceWithRelations = {
  ...mockPrice,
  product: { id: 'prod-1', sku: 'CAM-001', name: 'Cámara IP' },
  priceList: { id: 'pl-1', name: 'Lista Mayorista', code: 'MAYORISTA' },
};

describe('PricesService', () => {
  let service: PricesService;

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PricesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<PricesService>(PricesService);
  });

  describe('findAllPriceLists', () => {
    it('debe listar listas de precio con conteo', async () => {
      mockPrisma.priceList.findMany.mockResolvedValue([mockPriceListWithCount]);

      const result = await service.findAllPriceLists();

      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe('Lista Mayorista');
      expect(result.data[0].priceCount).toBe(3);
    });
  });

  describe('findOnePriceList', () => {
    it('debe retornar lista de precio por id', async () => {
      mockPrisma.priceList.findUnique.mockResolvedValue(mockPriceListWithPrices);

      const result = await service.findOnePriceList('pl-1');

      expect(result.name).toBe('Lista Mayorista');
      expect(result.prices).toHaveLength(1);
    });

    it('debe lanzar NotFoundException cuando la lista no existe', async () => {
      mockPrisma.priceList.findUnique.mockResolvedValue(null);

      await expect(service.findOnePriceList('no-existe')).rejects.toThrow(NotFoundException);
    });
  });

  describe('createPriceList', () => {
    it('debe crear una lista de precio', async () => {
      mockPrisma.priceList.findUnique.mockResolvedValue(null);
      mockPrisma.priceList.create.mockResolvedValue(mockPriceList);

      const dto = { name: 'Lista Mayorista', code: 'MAYORISTA' };
      const result = await service.createPriceList(dto);

      expect(result.name).toBe('Lista Mayorista');
      expect(result.code).toBe('MAYORISTA');
    });

    it('debe rechazar código duplicado con ConflictException', async () => {
      mockPrisma.priceList.findUnique.mockResolvedValue(mockPriceList);

      const dto = { name: 'Otra Lista', code: 'MAYORISTA' };

      await expect(service.createPriceList(dto)).rejects.toThrow(ConflictException);
      await expect(service.createPriceList(dto)).rejects.toThrow('Ya existe una lista con ese código');
    });
  });

  describe('updatePriceList', () => {
    it('debe actualizar una lista de precio', async () => {
      mockPrisma.priceList.findUnique.mockResolvedValueOnce(mockPriceList);
      mockPrisma.priceList.findUnique.mockResolvedValueOnce(null);
      mockPrisma.priceList.update.mockResolvedValue({ ...mockPriceList, name: 'Lista Minorista' });

      const dto = { name: 'Lista Minorista' };
      const result = await service.updatePriceList('pl-1', dto);

      expect(result.name).toBe('Lista Minorista');
    });

    it('debe lanzar NotFoundException si la lista no existe', async () => {
      mockPrisma.priceList.findUnique.mockResolvedValue(null);

      await expect(service.updatePriceList('no-existe', { name: 'Nope' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('removePriceList', () => {
    it('debe eliminar una lista sin precios asociados', async () => {
      mockPrisma.priceList.findUnique.mockResolvedValue({ ...mockPriceListWithCount, _count: { prices: 0 } });
      mockPrisma.priceList.delete.mockResolvedValue(mockPriceList);

      const result = await service.removePriceList('pl-1');

      expect(result.message).toBe('Lista de precios eliminada exitosamente');
    });

    it('debe lanzar ConflictException si la lista tiene precios', async () => {
      mockPrisma.priceList.findUnique.mockResolvedValue(mockPriceListWithCount);

      await expect(service.removePriceList('pl-1')).rejects.toThrow(ConflictException);
      await expect(service.removePriceList('pl-1')).rejects.toThrow('No se puede eliminar una lista con precios asociados');
    });

    it('debe lanzar NotFoundException si la lista no existe', async () => {
      mockPrisma.priceList.findUnique.mockResolvedValue(null);

      await expect(service.removePriceList('no-existe')).rejects.toThrow(NotFoundException);
    });
  });

  describe('createPrice', () => {
    it('debe crear un precio para producto', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({ id: 'prod-1' });
      mockPrisma.priceList.findUnique.mockResolvedValue({ id: 'pl-1' });
      mockPrisma.price.findUnique.mockResolvedValue(null);
      mockPrisma.price.create.mockResolvedValue(mockPriceWithRelations);

      const dto = { productId: 'prod-1', priceListId: 'pl-1', value: 1500000 };
      const result = await service.createPrice(dto);

      expect(result.value).toBe(1500000);
    });

    it('debe rechazar duplicado producto+lista con ConflictException', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({ id: 'prod-1' });
      mockPrisma.priceList.findUnique.mockResolvedValue({ id: 'pl-1' });
      mockPrisma.price.findUnique.mockResolvedValue(mockPrice);

      const dto = { productId: 'prod-1', priceListId: 'pl-1', value: 1500000 };

      await expect(service.createPrice(dto)).rejects.toThrow(ConflictException);
      await expect(service.createPrice(dto)).rejects.toThrow('Ya existe un precio para este producto en esta lista');
    });

    it('debe lanzar NotFoundException si el producto no existe', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(null);

      const dto = { productId: 'no-existe', priceListId: 'pl-1', value: 1000 };

      await expect(service.createPrice(dto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updatePrice', () => {
    it('debe actualizar un precio', async () => {
      mockPrisma.price.findUnique.mockResolvedValue(mockPrice);
      mockPrisma.price.update.mockResolvedValue({ ...mockPriceWithRelations, value: 1600000 });

      const dto = { value: 1600000 };
      const result = await service.updatePrice('price-1', dto);

      expect(result.value).toBe(1600000);
    });

    it('debe lanzar NotFoundException si el precio no existe', async () => {
      mockPrisma.price.findUnique.mockResolvedValue(null);

      await expect(service.updatePrice('no-existe', { value: 1000 })).rejects.toThrow(NotFoundException);
    });
  });

  describe('removePrice', () => {
    it('debe eliminar un precio', async () => {
      mockPrisma.price.findUnique.mockResolvedValue(mockPrice);
      mockPrisma.price.delete.mockResolvedValue(mockPrice);

      const result = await service.removePrice('price-1');

      expect(result.message).toBe('Precio eliminado exitosamente');
    });

    it('debe lanzar NotFoundException si el precio no existe', async () => {
      mockPrisma.price.findUnique.mockResolvedValue(null);

      await expect(service.removePrice('no-existe')).rejects.toThrow(NotFoundException);
    });
  });
});
