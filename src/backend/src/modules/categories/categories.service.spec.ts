import { createPrismaMock } from '../../__test__/mocks/prisma.mock';

const mockPrisma = createPrismaMock();

jest.mock('../../prisma/prisma.service', () => ({
  PrismaService: jest.fn().mockImplementation(() => mockPrisma),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { PrismaService } from '../../prisma/prisma.service';

const mockCategory = {
  id: 'cat-1',
  name: 'CCTV',
  slug: 'cctv',
  description: 'Cámaras de vigilancia',
  parentId: null,
  sortOrder: 0,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockCategoryWithRelations = {
  ...mockCategory,
  parent: null,
  _count: { products: 5, children: 2 },
};

const mockChildCategory = {
  ...mockCategory,
  id: 'cat-2',
  name: 'Cámaras IP',
  slug: 'camaras-ip',
  parentId: 'cat-1',
  parent: { id: 'cat-1', name: 'CCTV' },
  _count: { products: 3, children: 0 },
};

describe('CategoriesService', () => {
  let service: CategoriesService;

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
  });

  describe('findAll', () => {
    it('debe listar categorías con padre e hijo y conteos', async () => {
      mockPrisma.category.findMany.mockResolvedValue([mockCategoryWithRelations, mockChildCategory]);

      const result = await service.findAll();

      expect(result.data).toHaveLength(2);
      expect(result.data[0].productCount).toBe(5);
      expect(result.data[0].childrenCount).toBe(2);
    });
  });

  describe('findOne', () => {
    it('debe retornar categoría por id', async () => {
      mockPrisma.category.findUnique.mockResolvedValue(mockCategoryWithRelations);

      const result = await service.findOne('cat-1');

      expect(result.id).toBe('cat-1');
      expect(result.name).toBe('CCTV');
    });

    it('debe lanzar NotFoundException cuando la categoría no existe', async () => {
      mockPrisma.category.findUnique.mockResolvedValue(null);

      await expect(service.findOne('no-existe')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('debe crear una categoría', async () => {
      mockPrisma.category.findUnique.mockResolvedValueOnce(null);
      mockPrisma.category.create.mockResolvedValue(mockCategory);

      const dto = { name: 'CCTV', slug: 'cctv', description: 'Cámaras de vigilancia' };
      const result = await service.create(dto);

      expect(result.name).toBe('CCTV');
      expect(result.slug).toBe('cctv');
    });

    it('debe rechazar slug duplicado con ConflictException', async () => {
      mockPrisma.category.findUnique.mockResolvedValue(mockCategory);

      const dto = { name: 'CCTV', slug: 'cctv' };

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
      await expect(service.create(dto)).rejects.toThrow('Ya existe una categoría con ese slug');
    });

    it('debe validar parentId existente', async () => {
      mockPrisma.category.findUnique.mockResolvedValueOnce(null);
      mockPrisma.category.findUnique.mockResolvedValueOnce(mockCategory);
      mockPrisma.category.create.mockResolvedValue(mockChildCategory);

      const dto = { name: 'Cámaras IP', slug: 'camaras-ip', parentId: 'cat-1' };
      const result = await service.create(dto);

      expect(result.parentId).toBe('cat-1');
    });

    it('debe lanzar NotFoundException si parentId no existe', async () => {
      mockPrisma.category.findUnique.mockResolvedValueOnce(null);
      mockPrisma.category.findUnique.mockResolvedValueOnce(null);

      const dto = { name: 'Subcat', slug: 'subcat', parentId: 'no-existe' };

      await expect(service.create(dto)).rejects.toThrow(NotFoundException);
      await expect(service.create(dto)).rejects.toThrow('Categoría padre no encontrada');
    });
  });

  describe('update', () => {
    it('debe actualizar una categoría', async () => {
      mockPrisma.category.findUnique.mockResolvedValueOnce(mockCategory);
      mockPrisma.category.findUnique.mockResolvedValueOnce(null);
      mockPrisma.category.update.mockResolvedValue({ ...mockCategory, name: 'CCTV Profesional' });

      const dto = { name: 'CCTV Profesional' };
      const result = await service.update('cat-1', dto);

      expect(result.name).toBe('CCTV Profesional');
    });

    it('debe lanzar NotFoundException si la categoría no existe', async () => {
      mockPrisma.category.findUnique.mockResolvedValue(null);

      await expect(service.update('no-existe', { name: 'Nope' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('debe eliminar una categoría sin productos ni subcategorías', async () => {
      mockPrisma.category.findUnique.mockResolvedValue({
        ...mockCategory,
        products: [],
        children: [],
      });
      mockPrisma.category.delete.mockResolvedValue(mockCategory);

      const result = await service.remove('cat-1');

      expect(result.message).toBe('Categoría eliminada exitosamente');
    });

    it('debe lanzar ConflictException si la categoría tiene productos', async () => {
      mockPrisma.category.findUnique.mockResolvedValue({
        ...mockCategory,
        products: [{ id: 'p1' }],
        children: [],
      });

      await expect(service.remove('cat-1')).rejects.toThrow(ConflictException);
      await expect(service.remove('cat-1')).rejects.toThrow('No se puede eliminar una categoría con productos');
    });

    it('debe lanzar ConflictException si la categoría tiene subcategorías', async () => {
      mockPrisma.category.findUnique.mockResolvedValue({
        ...mockCategory,
        products: [],
        children: [{ id: 'child-1' }],
      });

      await expect(service.remove('cat-1')).rejects.toThrow(ConflictException);
      await expect(service.remove('cat-1')).rejects.toThrow('No se puede eliminar una categoría con subcategorías');
    });

    it('debe lanzar NotFoundException si la categoría no existe', async () => {
      mockPrisma.category.findUnique.mockResolvedValue(null);

      await expect(service.remove('no-existe')).rejects.toThrow(NotFoundException);
    });
  });
});
