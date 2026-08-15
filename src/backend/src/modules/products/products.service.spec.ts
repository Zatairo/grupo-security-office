import { createPrismaMock } from '../../__test__/mocks/prisma.mock';

jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  unlinkSync: jest.fn(),
}));

import * as fs from 'fs';

const mockPrisma = createPrismaMock();
mockPrisma.price.deleteMany = jest.fn();

jest.mock('../../prisma/prisma.service', () => ({
  PrismaService: jest.fn().mockImplementation(() => mockPrisma),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { ProductsService } from './products.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AclService } from '../../common/acl/acl.service';

const mockAcl = {
  isSuperAdmin: jest.fn().mockReturnValue(false),
  levelsAtLeast: jest.fn().mockReturnValue(['manage']),
  getAllowedListaIds: jest.fn().mockResolvedValue([]),
  getUserLevel: jest.fn().mockResolvedValue(null),
  assertListaAccess: jest.fn().mockResolvedValue(undefined),
  assertProductAccess: jest.fn().mockResolvedValue(undefined),
  assertPriceAccess: jest.fn().mockResolvedValue(undefined),
  can: jest.fn().mockResolvedValue(false),
};

const mockProduct = {
  id: 'prod-1',
  sku: 'CAM-001',
  name: 'Cámara IP',
  description: 'Cámara de seguridad',
  categoryId: 'cat-1',
  brandId: 'brand-1',
  technicalSpecs: { resolution: '4MP' },
  isActive: true,
  isVisible: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockProductWithRelations = {
  ...mockProduct,
  category: { id: 'cat-1', name: 'CCTV', slug: 'cctv' },
  brand: { id: 'brand-1', name: 'Hikvision', slug: 'hikvision' },
  images: [{ id: 'img-1', url: 'img.jpg', isPrimary: true }],
  prices: [
    { id: 'price-1', value: 1500000, priceList: { id: 'pl-1', name: 'Lista 1', code: 'L1' } },
  ],
};

describe('ProductsService', () => {
  let service: ProductsService;

  beforeEach(async () => {
    jest.resetAllMocks();

    // Fallback LISTA-GENERAL para crear/update sin listaId explícito.
    mockPrisma.lista.findUnique.mockResolvedValue({ id: 'lista-1', code: 'LISTA-GENERAL', defaultVisibility: false });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AclService, useValue: mockAcl },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
  });

  describe('findAll', () => {
    it('debe listar productos con filtros básicos', async () => {
      mockPrisma.product.findMany.mockResolvedValue([mockProductWithRelations]);
      mockPrisma.product.count.mockResolvedValue(1);

      const result = await service.findAll({ skip: 0, take: 50 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].sku).toBe('CAM-001');
      expect(result.meta.total).toBe(1);
    });

    it('debe filtrar por categoryId y brandId', async () => {
      mockPrisma.product.findMany.mockResolvedValue([]);
      mockPrisma.product.count.mockResolvedValue(0);

      await service.findAll({ categoryId: 'cat-1', brandId: 'brand-1' });

      expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ categoryId: 'cat-1', brandId: 'brand-1' }),
        }),
      );
    });

    it('debe filtrar por catalogId', async () => {
      mockPrisma.product.findMany.mockResolvedValue([]);
      mockPrisma.product.count.mockResolvedValue(0);

      await service.findAll({ catalogId: 'catalog-2' });

      expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ catalogId: 'catalog-2' }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('debe retornar producto por id', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(mockProductWithRelations);

      const result = await service.findOne('prod-1');

      expect(result.id).toBe('prod-1');
    });

    it('debe lanzar NotFoundException cuando el producto no existe', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(null);

      await expect(service.findOne('no-existe')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('debe crear un producto válido', async () => {
      mockPrisma.product.findUnique.mockResolvedValueOnce(null);
      mockPrisma.category.findUnique.mockResolvedValue({ id: 'cat-1', name: 'CCTV' });
      mockPrisma.brand.findUnique.mockResolvedValue({ id: 'brand-1', name: 'Hikvision' });
      mockPrisma.catalog.findUnique.mockResolvedValue({ id: 'cat-def', code: 'CAT-DEFAULT' });
      mockPrisma.product.create.mockResolvedValue(mockProductWithRelations);

      const dto = {
        sku: 'CAM-001',
        name: 'Cámara IP',
        description: 'Cámara de seguridad',
        categoryId: 'cat-1',
        brandId: 'brand-1',
        technicalSpecs: { resolution: '4MP' },
      };

      const result = await service.create(dto);

      expect(result.sku).toBe('CAM-001');
      expect(mockPrisma.product.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ catalogId: 'cat-def', listaId: 'lista-1' }),
        }),
      );
    });

    it('debe usar el catalogId enviado en el create', async () => {
      mockPrisma.product.findUnique.mockResolvedValueOnce(null);
      mockPrisma.category.findUnique.mockResolvedValue({ id: 'cat-1', name: 'CCTV' });
      mockPrisma.brand.findUnique.mockResolvedValue({ id: 'brand-1', name: 'Hikvision' });
      mockPrisma.catalog.findUnique.mockResolvedValue({ id: 'catalog-2', code: 'CAT-VENTAS' });
      mockPrisma.product.create.mockResolvedValue(mockProductWithRelations);

      const dto = {
        sku: 'CAM-001',
        name: 'Cámara IP',
        categoryId: 'cat-1',
        brandId: 'brand-1',
        catalogId: 'catalog-2',
      };

      await service.create(dto);

      expect(mockPrisma.catalog.findUnique).toHaveBeenCalledWith({ where: { id: 'catalog-2' } });
      expect(mockPrisma.product.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ catalogId: 'catalog-2' }),
        }),
      );
    });

    it('debe lanzar NotFoundException si el catálogo enviado no existe', async () => {
      mockPrisma.product.findUnique.mockResolvedValueOnce(null);
      mockPrisma.category.findUnique.mockResolvedValue({ id: 'cat-1', name: 'CCTV' });
      mockPrisma.brand.findUnique.mockResolvedValue({ id: 'brand-1', name: 'Hikvision' });
      mockPrisma.catalog.findUnique.mockResolvedValue(null);

      const dto = {
        sku: 'CAM-001',
        name: 'Cámara IP',
        categoryId: 'cat-1',
        brandId: 'brand-1',
        catalogId: 'no-existe',
      };

      await expect(service.create(dto)).rejects.toThrow(NotFoundException);
      await expect(service.create(dto)).rejects.toThrow('Catálogo no encontrado');
    });

    it('debe rechazar SKU duplicado con ConflictException', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(mockProduct);

      const dto = {
        sku: 'CAM-001',
        name: 'Duplicado',
        categoryId: 'cat-1',
        brandId: 'brand-1',
      };

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
      await expect(service.create(dto)).rejects.toThrow('Ya existe un producto con ese SKU');
    });

    it('debe lanzar NotFoundException si la categoría no existe', async () => {
      mockPrisma.product.findUnique.mockResolvedValueOnce(null);
      mockPrisma.category.findUnique.mockResolvedValue(null);

      const dto = {
        sku: 'CAM-002',
        name: 'Test',
        categoryId: 'cat-no-existe',
        brandId: 'brand-1',
      };

      await expect(service.create(dto)).rejects.toThrow(NotFoundException);
    });

    it('debe persistir extraAttributes y precios inline', async () => {
      mockPrisma.product.findUnique.mockResolvedValueOnce(null);
      mockPrisma.category.findUnique.mockResolvedValue({ id: 'cat-1', name: 'CCTV' });
      mockPrisma.brand.findUnique.mockResolvedValue({ id: 'brand-1', name: 'Hikvision' });
      mockPrisma.catalog.findUnique.mockResolvedValue({ id: 'cat-def', code: 'CAT-DEFAULT' });
      mockPrisma.priceList.findMany.mockResolvedValue([{ id: 'pl-1' }]);
      mockPrisma.product.create.mockResolvedValue(mockProductWithRelations);
      mockPrisma.$transaction.mockImplementation(async (cb: any) => cb(mockPrisma));

      const dto = {
        sku: 'CAM-003',
        name: 'Cámara IP',
        categoryId: 'cat-1',
        brandId: 'brand-1',
        extraAttributes: { garantia: '1 año', ip: '127.0.0.1' },
        prices: [{ priceListId: 'pl-1', value: 1500000, currency: 'COP' }],
      };

      await service.create(dto as any);

      expect(mockPrisma.product.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ extraAttributes: dto.extraAttributes }),
        }),
      );
      expect(mockPrisma.priceList.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['pl-1'] } },
        select: { id: true },
      });
      expect(mockPrisma.price.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { productId_priceListId: { productId: 'prod-1', priceListId: 'pl-1' } },
          create: expect.objectContaining({ priceListId: 'pl-1', value: 1500000, currency: 'COP' }),
        }),
      );
    });

    it('debe rechazar precios con lista de precios inexistente', async () => {
      mockPrisma.product.findUnique.mockResolvedValueOnce(null);
      mockPrisma.category.findUnique.mockResolvedValue({ id: 'cat-1', name: 'CCTV' });
      mockPrisma.brand.findUnique.mockResolvedValue({ id: 'brand-1', name: 'Hikvision' });
      mockPrisma.catalog.findUnique.mockResolvedValue({ id: 'cat-def', code: 'CAT-DEFAULT' });
      mockPrisma.priceList.findMany.mockResolvedValue([]);

      const dto = {
        sku: 'CAM-004',
        name: 'Cámara',
        categoryId: 'cat-1',
        brandId: 'brand-1',
        prices: [{ priceListId: 'pl-inexistente', value: 1000 }],
      };

      await expect(service.create(dto as any)).rejects.toThrow(NotFoundException);
    });

    it('debe asociar el listaId enviado al crear un producto', async () => {
      mockPrisma.product.findUnique.mockResolvedValueOnce(null); // sku libre
      mockPrisma.category.findUnique.mockResolvedValue({ id: 'cat-1', name: 'CCTV' });
      mockPrisma.brand.findUnique.mockResolvedValue({ id: 'brand-1', name: 'Hikvision' });
      mockPrisma.catalog.findUnique.mockResolvedValue({ id: 'cat-def', code: 'CAT-DEFAULT' });
      mockPrisma.lista.findUnique.mockResolvedValue({ id: 'lista-x', code: 'LISTA-X', defaultVisibility: false });
      mockPrisma.product.create.mockResolvedValue(mockProductWithRelations);

      const dto = {
        sku: 'CAM-010',
        name: 'Cámara',
        categoryId: 'cat-1',
        brandId: 'brand-1',
        catalogId: 'cat-def',
        listaId: 'lista-x',
      };

      await service.create(dto as any);

      expect(mockPrisma.lista.findUnique).toHaveBeenCalledWith({ where: { id: 'lista-x' }, select: { id: true, defaultVisibility: true } });
      expect(mockPrisma.product.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ catalogId: 'cat-def', listaId: 'lista-x' }) }),
      );
    });

    it('debe rechazar crear producto con listaId inexistente', async () => {
      mockPrisma.product.findUnique.mockResolvedValueOnce(null); // sku libre
      mockPrisma.category.findUnique.mockResolvedValue({ id: 'cat-1', name: 'CCTV' });
      mockPrisma.brand.findUnique.mockResolvedValue({ id: 'brand-1', name: 'Hikvision' });
      mockPrisma.catalog.findUnique.mockResolvedValue({ id: 'cat-def', code: 'CAT-DEFAULT' });
      mockPrisma.lista.findUnique.mockResolvedValue(null); // lista no existe

      const dto = {
        sku: 'CAM-011',
        name: 'Cámara',
        categoryId: 'cat-1',
        brandId: 'brand-1',
        catalogId: 'cat-def',
        listaId: 'lista-inexistente',
      };

      await expect(service.create(dto as any)).rejects.toThrow('Lista no encontrada');
    });

    it('debe usar LISTA-GENERAL como fallback cuando no se envía listaId', async () => {
      mockPrisma.product.findUnique.mockResolvedValueOnce(null); // sku libre
      mockPrisma.category.findUnique.mockResolvedValue({ id: 'cat-1', name: 'CCTV' });
      mockPrisma.brand.findUnique.mockResolvedValue({ id: 'brand-1', name: 'Hikvision' });
      mockPrisma.catalog.findUnique.mockResolvedValue({ id: 'cat-def', code: 'CAT-DEFAULT' });
      mockPrisma.lista.findUnique.mockResolvedValue({ id: 'lista-1', code: 'LISTA-GENERAL', defaultVisibility: false });
      mockPrisma.product.create.mockResolvedValue(mockProductWithRelations);

      const dto = { sku: 'CAM-012', name: 'Cámara', categoryId: 'cat-1', brandId: 'brand-1' };

      await service.create(dto as any);

      expect(mockPrisma.lista.findUnique).toHaveBeenCalledWith({ where: { code: 'LISTA-GENERAL' }, select: { id: true, defaultVisibility: true } });
      expect(mockPrisma.product.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ listaId: 'lista-1' }) }),
      );
    });

    it('debe usar defaultVisibility de la Lista como isVisible cuando no se envía isVisible explícito', async () => {
      mockPrisma.product.findUnique.mockResolvedValueOnce(null); // sku libre
      mockPrisma.category.findUnique.mockResolvedValue({ id: 'cat-1', name: 'CCTV' });
      mockPrisma.brand.findUnique.mockResolvedValue({ id: 'brand-1', name: 'Hikvision' });
      mockPrisma.catalog.findUnique.mockResolvedValue({ id: 'cat-def', code: 'CAT-DEFAULT' });
      mockPrisma.lista.findUnique.mockResolvedValue({ id: 'lista-v', code: 'LISTA-VISIBLE', defaultVisibility: true });
      mockPrisma.product.create.mockResolvedValue(mockProductWithRelations);

      const dto = { sku: 'CAM-013', name: 'Cámara', categoryId: 'cat-1', brandId: 'brand-1', listaId: 'lista-v' };

      await service.create(dto as any);

      expect(mockPrisma.product.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ listaId: 'lista-v', isVisible: true }),
        }),
      );
    });

    it('debe respetar isVisible explícito aunque la Lista tenga defaultVisibility opuesto', async () => {
      mockPrisma.product.findUnique.mockResolvedValueOnce(null); // sku libre
      mockPrisma.category.findUnique.mockResolvedValue({ id: 'cat-1', name: 'CCTV' });
      mockPrisma.brand.findUnique.mockResolvedValue({ id: 'brand-1', name: 'Hikvision' });
      mockPrisma.catalog.findUnique.mockResolvedValue({ id: 'cat-def', code: 'CAT-DEFAULT' });
      mockPrisma.lista.findUnique.mockResolvedValue({ id: 'lista-v', code: 'LISTA-VISIBLE', defaultVisibility: true });
      mockPrisma.product.create.mockResolvedValue(mockProductWithRelations);

      const dto = { sku: 'CAM-014', name: 'Cámara', categoryId: 'cat-1', brandId: 'brand-1', listaId: 'lista-v', isVisible: false };

      await service.create(dto as any);

      expect(mockPrisma.product.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ listaId: 'lista-v', isVisible: false }),
        }),
      );
    });
  });

  describe('update', () => {
    it('debe actualizar un producto', async () => {
      mockPrisma.product.findUnique.mockResolvedValueOnce(mockProduct);
      mockPrisma.product.findUnique.mockResolvedValueOnce(null);
      mockPrisma.category.findUnique.mockResolvedValue({ id: 'cat-1', name: 'CCTV' });
      mockPrisma.brand.findUnique.mockResolvedValue({ id: 'brand-1', name: 'Hikvision' });
      mockPrisma.product.update.mockResolvedValue({ ...mockProductWithRelations, name: 'Cámara IP Pro' });

      const dto = { name: 'Cámara IP Pro' };
      const result = await service.update('prod-1', dto);

      expect(result.name).toBe('Cámara IP Pro');
    });

    it('debe lanzar NotFoundException si el producto no existe', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(null);

      await expect(service.update('no-existe', { name: 'Nope' })).rejects.toThrow(NotFoundException);
    });

    it('debe actualizar extraAttributes y hacer upsert de precios', async () => {
      mockPrisma.product.findUnique.mockResolvedValueOnce(mockProduct);
      mockPrisma.product.findUnique.mockResolvedValueOnce(null);
      mockPrisma.category.findUnique.mockResolvedValue({ id: 'cat-1', name: 'CCTV' });
      mockPrisma.brand.findUnique.mockResolvedValue({ id: 'brand-1', name: 'Hikvision' });
      mockPrisma.priceList.findMany.mockResolvedValue([{ id: 'pl-1' }]);
      mockPrisma.product.update.mockResolvedValue({ ...mockProductWithRelations, name: 'Cámara IP Pro' });
      mockPrisma.$transaction.mockImplementation(async (cb: any) => cb(mockPrisma));

      const dto = {
        name: 'Cámara IP Pro',
        extraAttributes: { garantia: '2 años' },
        prices: [{ priceListId: 'pl-1', value: 2000000 }],
      };

      const result = await service.update('prod-1', dto as any);

      expect(result.name).toBe('Cámara IP Pro');
      expect(mockPrisma.product.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ extraAttributes: { garantia: '2 años' } }),
        }),
      );
      expect(mockPrisma.price.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { productId_priceListId: { productId: 'prod-1', priceListId: 'pl-1' } },
        }),
      );
    });
  });

  describe('toggleVisibility', () => {
    it('debe alternar isVisible', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(mockProduct);
      mockPrisma.product.update.mockResolvedValue({ ...mockProduct, isVisible: false });

      const result = await service.toggleVisibility('prod-1');

      expect(result.isVisible).toBe(false);
      expect(mockPrisma.product.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { isVisible: false } }),
      );
    });

    it('debe lanzar NotFoundException si el producto no existe', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(null);

      await expect(service.toggleVisibility('no-existe')).rejects.toThrow(NotFoundException);
    });
  });

  describe('toggleActive', () => {
    it('debe alternar isActive', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(mockProduct);
      mockPrisma.product.update.mockResolvedValue({ ...mockProduct, isActive: false });

      const result = await service.toggleActive('prod-1');

      expect(result.isActive).toBe(false);
      expect(mockPrisma.product.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { isActive: false } }),
      );
    });

    it('debe lanzar NotFoundException si el producto no existe', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(null);

      await expect(service.toggleActive('no-existe')).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('debe eliminar un producto, sus relaciones y sus archivos de imagen en disco', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(mockProduct);
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      mockPrisma.productImage.findMany.mockResolvedValue([
        { id: 'img-1', url: '/uploads/img-1.png' },
        { id: 'img-2', url: '/uploads/img-2.png' },
      ]);
      mockPrisma.price.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.productImage.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.product.delete.mockResolvedValue(mockProduct);

      const result = await service.remove('prod-1');

      expect(result.message).toBe('Producto eliminado exitosamente');
      expect(mockPrisma.price.deleteMany).toHaveBeenCalledWith({ where: { productId: 'prod-1' } });
      expect(mockPrisma.productImage.deleteMany).toHaveBeenCalledWith({ where: { productId: 'prod-1' } });
      expect(fs.unlinkSync).toHaveBeenCalledWith(expect.stringContaining('img-1.png'));
      expect(fs.unlinkSync).toHaveBeenCalledWith(expect.stringContaining('img-2.png'));
    });

    it('debe borrar el producto aunque el archivo de imagen no exista en disco', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(mockProduct);
      mockPrisma.productImage.findMany.mockResolvedValue([{ id: 'img-1', url: '/uploads/img-1.png' }]);
      mockPrisma.price.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.productImage.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.product.delete.mockResolvedValue(mockProduct);
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      const result = await service.remove('prod-1');

      expect(result.message).toBe('Producto eliminado exitosamente');
      expect(fs.unlinkSync).not.toHaveBeenCalled();
    });

    it('debe lanzar NotFoundException si el producto no existe', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(null);

      await expect(service.remove('no-existe')).rejects.toThrow(NotFoundException);
    });
  });

  // --- ACL deny-by-default (AclService real, sin stub) ---
  describe('ACL deny-by-default', () => {
    const LISTA_ID = 'list-1';
    const ADMIN = { userId: 'admin-1', roles: ['Super Admin'] };
    const VIEWER = { userId: 'pepito-1', roles: ['Operador'] }; // view sobre LISTA-ID
    const NOAUTH = { userId: 'none-1', roles: ['Operador'] }; // sin assignments

    const listaAssignments: Record<string, { resourceId: string; level: string; isActive: boolean }[]> = {
      [VIEWER.userId]: [{ resourceId: LISTA_ID, level: 'view', isActive: true }],
      [ADMIN.userId]: [],
      [NOAUTH.userId]: [],
    };
    let acl: AclService;
    let svc: ProductsService;

    beforeEach(() => {
      acl = new AclService(mockPrisma as any);
      svc = new ProductsService(mockPrisma as any, acl);
      mockPrisma.assignment.findMany.mockImplementation(async (args: any) => {
        const u = args?.where?.userId;
        const rt = args?.where?.resourceType;
        const rid = args?.where?.resourceId;
        const active = args?.where?.isActive;
        const levels = args?.where?.level?.in;
        let out = (listaAssignments[u] ?? []).filter((_a) => rt === undefined || rt === 'LISTA') as any[];
        if (rid) out = out.filter((a) => a.resourceId === rid);
        if (active === true) out = out.filter((a) => a.isActive);
        if (levels) out = out.filter((a) => levels.includes(a.level));
        return out;
      });
      mockPrisma.lista.findUnique.mockResolvedValue({ id: LISTA_ID, code: 'LISTA-GENERAL', isActive: true, archivedAt: null });
    });

    it('findAll scopia a LISTA-GENERAL para view y deniega (lista vacía) a usuario sin assignment', async () => {
      mockPrisma.product.findMany.mockResolvedValue([mockProduct]);
      mockPrisma.product.count.mockResolvedValue(1);

      const authed = await svc.findAll({ skip: 0, take: 50 }, VIEWER);
      expect(authed.data).toHaveLength(1);
      expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ listaId: { in: [LISTA_ID] } }) }),
      );

      mockPrisma.product.findMany.mockResolvedValue([]);
      mockPrisma.product.count.mockResolvedValue(0);
      const denied = await svc.findAll({ skip: 0, take: 50 }, NOAUTH);
      expect(denied.data).toHaveLength(0);
    });

    it('findAll: Super Admin ve todo (sin filtro de listaId)', async () => {
      mockPrisma.product.findMany.mockResolvedValue([mockProduct]);
      mockPrisma.product.count.mockResolvedValue(1);

      const res = await svc.findAll({ skip: 0, take: 50 }, ADMIN);
      expect(res.data).toHaveLength(1);
      const call = mockPrisma.product.findMany.mock.calls[0][0];
      expect(call.where).not.toHaveProperty('listaId');
    });

    it('findOne: usuario sin assignment recibe 404 (no revela existencia)', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({ ...mockProduct, listaId: LISTA_ID });
      await expect(svc.findOne('prod-1', NOAUTH)).rejects.toThrow(NotFoundException);
    });

    it('findOne: view ve producto de su Lista', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({ ...mockProductWithRelations, listaId: LISTA_ID });
      const res = await svc.findOne('prod-1', VIEWER);
      expect(res.id).toBe('prod-1');
    });

    it('view no edita (toggleVisibility exige manage → 403)', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({ ...mockProduct, listaId: LISTA_ID });
      await expect(svc.toggleVisibility('prod-1', VIEWER)).rejects.toThrow(ForbiddenException);
    });

    it('create: usuario view sobre la Lista no puede crear producto (403, falta edit)', async () => {
      mockPrisma.product.findUnique.mockResolvedValueOnce(null);
      mockPrisma.category.findUnique.mockResolvedValue({ id: 'cat-1', name: 'CCTV' });
      mockPrisma.brand.findUnique.mockResolvedValue({ id: 'brand-1', name: 'Hikvision' });
      mockPrisma.catalog.findUnique.mockResolvedValue({ id: 'cat-def', code: 'CAT-DEFAULT' });
      mockPrisma.lista.findUnique.mockResolvedValue({ id: LISTA_ID, code: 'LISTA-GENERAL', isActive: true, archivedAt: null });

      const dto = { sku: 'NEW-1', name: 'X', categoryId: 'cat-1', brandId: 'brand-1', listaId: LISTA_ID };
      await expect(svc.create(dto as any, VIEWER)).rejects.toThrow(ForbiddenException);
    });
  });
});
