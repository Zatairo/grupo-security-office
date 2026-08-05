import { createPrismaMock } from '../../__test__/mocks/prisma.mock';

const mockPrisma = createPrismaMock();

jest.mock('../../prisma/prisma.service', () => ({
  PrismaService: jest.fn().mockImplementation(() => mockPrisma),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { CatalogsService } from './catalogs.service';
import { PrismaService } from '../../prisma/prisma.service';

const mockCatalog = {
  id: 'catalog-1',
  name: 'Catálogo General',
  code: 'CAT-DEFAULT',
  description: 'Catálogo principal',
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockCatalogWithCount = {
  ...mockCatalog,
  _count: { products: 197 },
};

describe('CatalogsService', () => {
  let service: CatalogsService;

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CatalogsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<CatalogsService>(CatalogsService);
  });

  describe('findAll', () => {
    it('debe listar catálogos con conteo de productos', async () => {
      mockPrisma.catalog.findMany.mockResolvedValue([mockCatalogWithCount]);

      const result = await service.findAll();

      expect(result.data).toHaveLength(1);
      expect(result.data[0].productCount).toBe(197);
    });
  });

  describe('findMine', () => {
    it('debe listar solo catálogos activos', async () => {
      mockPrisma.catalog.findMany.mockResolvedValue([mockCatalogWithCount]);

      const result = await service.findMine();

      expect(mockPrisma.catalog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isActive: true }),
        }),
      );
      expect(result.data[0].productCount).toBe(197);
    });
  });

  describe('findOne', () => {
    it('debe retornar catálogo con conteo de productos', async () => {
      mockPrisma.catalog.findUnique.mockResolvedValue(mockCatalogWithCount);

      const result = await service.findOne('catalog-1');

      expect(result.id).toBe('catalog-1');
      expect(result.productCount).toBe(197);
    });

    it('debe lanzar NotFoundException cuando el catálogo no existe', async () => {
      mockPrisma.catalog.findUnique.mockResolvedValue(null);

      await expect(service.findOne('no-existe')).rejects.toThrow(NotFoundException);
      await expect(service.findOne('no-existe')).rejects.toThrow('Catálogo no encontrado');
    });
  });

  describe('create', () => {
    it('debe crear un catálogo', async () => {
      mockPrisma.catalog.findUnique.mockResolvedValueOnce(null);
      mockPrisma.catalog.create.mockResolvedValue(mockCatalog);

      const dto = { name: 'Catálogo General', code: 'CAT-DEFAULT', description: 'Catálogo principal' };
      const result = await service.create(dto);

      expect(result.name).toBe('Catálogo General');
      expect(result.code).toBe('CAT-DEFAULT');
    });

    it('debe rechazar código duplicado con ConflictException', async () => {
      mockPrisma.catalog.findUnique.mockResolvedValue(mockCatalog);

      const dto = { name: 'Duplicado', code: 'CAT-DEFAULT' };

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
      await expect(service.create(dto)).rejects.toThrow('Ya existe un catálogo con ese código');
    });
  });

  describe('update', () => {
    it('debe actualizar nombre, descripción y isActive', async () => {
      mockPrisma.catalog.findUnique.mockResolvedValueOnce(mockCatalog);
      mockPrisma.catalog.update.mockResolvedValue({ ...mockCatalog, name: 'Catálogo Ventas', isActive: false });

      const dto = { name: 'Catálogo Ventas', isActive: false };
      const result = await service.update('catalog-1', dto);

      expect(result.name).toBe('Catálogo Ventas');
      expect(result.isActive).toBe(false);
      expect(mockPrisma.catalog.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ name: 'Catálogo Ventas', isActive: false }) }),
      );
    });

    it('debe lanzar NotFoundException si el catálogo no existe', async () => {
      mockPrisma.catalog.findUnique.mockResolvedValue(null);

      await expect(service.update('no-existe', { name: 'Nope' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('debe eliminar un catálogo sin productos', async () => {
      mockPrisma.catalog.findUnique.mockResolvedValue({
        ...mockCatalog,
        _count: { products: 0 },
      });
      mockPrisma.catalog.delete.mockResolvedValue(mockCatalog);

      await service.remove('catalog-1');

      expect(mockPrisma.catalog.delete).toHaveBeenCalledWith({ where: { id: 'catalog-1' } });
    });

    it('debe lanzar ConflictException si el catálogo tiene productos', async () => {
      mockPrisma.catalog.findUnique.mockResolvedValue({
        ...mockCatalog,
        _count: { products: 3 },
      });

      await expect(service.remove('catalog-1')).rejects.toThrow(ConflictException);
      await expect(service.remove('catalog-1')).rejects.toThrow('No se puede eliminar un catálogo con productos asignados');
    });

    it('debe lanzar NotFoundException si el catálogo no existe', async () => {
      mockPrisma.catalog.findUnique.mockResolvedValue(null);

      await expect(service.remove('no-existe')).rejects.toThrow(NotFoundException);
    });
  });
});
