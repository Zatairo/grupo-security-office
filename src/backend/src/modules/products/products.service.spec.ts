import { createPrismaMock } from '../../__test__/mocks/prisma.mock';
import * as XLSX from 'xlsx';

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn().mockReturnValue(true),
  unlinkSync: jest.fn()}));

jest.mock('bcrypt', () => ({
  compare: jest.fn().mockResolvedValue(false),
  hash: jest.fn().mockResolvedValue('$2b$10$mockhash')}));

import * as bcrypt from 'bcrypt';

import * as fs from 'fs';

const mockPrisma = createPrismaMock();
mockPrisma.price.deleteMany = jest.fn();

jest.mock('../../prisma/prisma.service', () => ({
  PrismaService: jest.fn().mockImplementation(() => mockPrisma)}));

import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { ProductsService } from './products.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AclService } from '../../common/acl/acl.service';
import { AuditService } from '../audit/audit.service';

const mockAudit = { log: jest.fn().mockResolvedValue(undefined) };

const mockAcl = {
  isSuperAdmin: jest.fn().mockReturnValue(false),
  levelsAtLeast: jest.fn().mockReturnValue(['manage']),
  getAllowedListaIds: jest.fn().mockResolvedValue([]),
  getUserLevel: jest.fn().mockResolvedValue(null),
  assertListaAccess: jest.fn().mockResolvedValue(undefined),
  assertProductAccess: jest.fn().mockResolvedValue(undefined),
  assertPriceAccess: jest.fn().mockResolvedValue(undefined),
  can: jest.fn().mockResolvedValue(false)};

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
  publishStatus: 'borrador',
  publishedAt: null,
  publishAt: null,
  unpublishAt: null,
  publishedById: null,
  unpublishReason: null,
  createdAt: new Date(),
  updatedAt: new Date()};

const mockProductWithRelations = {
  ...mockProduct,
  category: { id: 'cat-1', name: 'CCTV', slug: 'cctv' },
  brand: { id: 'brand-1', name: 'Hikvision', slug: 'hikvision' },
  images: [{ id: 'img-1', url: 'img.jpg', isPrimary: true }],
  prices: [
    { id: 'price-1', value: 1500000, priceList: { id: 'pl-1', name: 'Lista 1', code: 'L1' } },
  ]};

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
        { provide: AuditService, useValue: mockAudit },
      ]}).compile();

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
          where: expect.objectContaining({ categoryId: 'cat-1', brandId: 'brand-1' })}),
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
      mockPrisma.product.create.mockResolvedValue(mockProductWithRelations);

      const dto = {
        sku: 'CAM-001',
        name: 'Cámara IP',
        description: 'Cámara de seguridad',
        categoryId: 'cat-1',
        brandId: 'brand-1',
        technicalSpecs: { resolution: '4MP' }};

      const result = await service.create(dto);

      expect(result.sku).toBe('CAM-001');
      expect(mockPrisma.product.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ listaId: 'lista-1' })}),
      );
    });

    it('debe rechazar SKU duplicado con ConflictException', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(mockProduct);

      const dto = {
        sku: 'CAM-001',
        name: 'Duplicado',
        categoryId: 'cat-1',
        brandId: 'brand-1'};

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
        brandId: 'brand-1'};

      await expect(service.create(dto)).rejects.toThrow(NotFoundException);
    });

    it('debe persistir extraAttributes y precios inline', async () => {
      mockPrisma.product.findUnique.mockResolvedValueOnce(null);
      mockPrisma.category.findUnique.mockResolvedValue({ id: 'cat-1', name: 'CCTV' });
      mockPrisma.brand.findUnique.mockResolvedValue({ id: 'brand-1', name: 'Hikvision' });
      mockPrisma.priceList.findMany.mockResolvedValue([{ id: 'pl-1' }]);
      mockPrisma.product.create.mockResolvedValue(mockProductWithRelations);
      mockPrisma.$transaction.mockImplementation(async (cb: any) => cb(mockPrisma));

      const dto = {
        sku: 'CAM-003',
        name: 'Cámara IP',
        categoryId: 'cat-1',
        brandId: 'brand-1',
        extraAttributes: { garantia: '1 año', ip: '127.0.0.1' },
        prices: [{ priceListId: 'pl-1', value: 1500000, currency: 'COP' }]};

      await service.create(dto as any);

      expect(mockPrisma.product.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ extraAttributes: dto.extraAttributes })}),
      );
      expect(mockPrisma.priceList.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['pl-1'] } },
        select: { id: true }});
      expect(mockPrisma.price.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { productId_priceListId: { productId: 'prod-1', priceListId: 'pl-1' } },
          create: expect.objectContaining({ priceListId: 'pl-1', value: 1500000, currency: 'COP' })}),
      );
    });

    it('debe persistir documents al crear un producto', async () => {
      mockPrisma.product.findUnique.mockResolvedValueOnce(null);
      mockPrisma.category.findUnique.mockResolvedValue({ id: 'cat-1', name: 'CCTV' });
      mockPrisma.brand.findUnique.mockResolvedValue({ id: 'brand-1', name: 'Hikvision' });
      mockPrisma.product.create.mockResolvedValue(mockProductWithRelations);

      const dto = {
        sku: 'CAM-DOC',
        name: 'Cámara',
        categoryId: 'cat-1',
        brandId: 'brand-1',
        documents: [
          { name: 'ficha-tecnica.pdf', url: '/uploads/doc-1.pdf', type: 'application/pdf', size: 204800 },
        ]};

      await service.create(dto as any);

      expect(mockPrisma.product.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ documents: dto.documents })}),
      );
    });

    it('debe rechazar precios con lista de precios inexistente', async () => {
      mockPrisma.product.findUnique.mockResolvedValueOnce(null);
      mockPrisma.category.findUnique.mockResolvedValue({ id: 'cat-1', name: 'CCTV' });
      mockPrisma.brand.findUnique.mockResolvedValue({ id: 'brand-1', name: 'Hikvision' });
      mockPrisma.priceList.findMany.mockResolvedValue([]);

      const dto = {
        sku: 'CAM-004',
        name: 'Cámara',
        categoryId: 'cat-1',
        brandId: 'brand-1',
        prices: [{ priceListId: 'pl-inexistente', value: 1000 }]};

      await expect(service.create(dto as any)).rejects.toThrow(NotFoundException);
    });

    it('debe asociar el listaId enviado al crear un producto', async () => {
      mockPrisma.product.findUnique.mockResolvedValueOnce(null); // sku libre
      mockPrisma.category.findUnique.mockResolvedValue({ id: 'cat-1', name: 'CCTV' });
      mockPrisma.brand.findUnique.mockResolvedValue({ id: 'brand-1', name: 'Hikvision' });
      mockPrisma.lista.findUnique.mockResolvedValue({ id: 'lista-x', code: 'LISTA-X', defaultVisibility: false });
      mockPrisma.product.create.mockResolvedValue(mockProductWithRelations);

      const dto = {
        sku: 'CAM-010',
        name: 'Cámara',
        categoryId: 'cat-1',
        brandId: 'brand-1',
        listaId: 'lista-x'};

      await service.create(dto as any);

      expect(mockPrisma.lista.findUnique).toHaveBeenCalledWith({ where: { id: 'lista-x' }, select: { id: true, defaultVisibility: true } });
      expect(mockPrisma.product.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ listaId: 'lista-x' }) }),
      );
    });

    it('debe rechazar crear producto con listaId inexistente', async () => {
      mockPrisma.product.findUnique.mockResolvedValueOnce(null); // sku libre
      mockPrisma.category.findUnique.mockResolvedValue({ id: 'cat-1', name: 'CCTV' });
      mockPrisma.brand.findUnique.mockResolvedValue({ id: 'brand-1', name: 'Hikvision' });
      mockPrisma.lista.findUnique.mockResolvedValue(null); // lista no existe

      const dto = {
        sku: 'CAM-011',
        name: 'Cámara',
        categoryId: 'cat-1',
        brandId: 'brand-1',
        listaId: 'lista-inexistente'};

      await expect(service.create(dto as any)).rejects.toThrow('Lista no encontrada');
    });

    it('debe usar LISTA-GENERAL como fallback cuando no se envía listaId', async () => {
      mockPrisma.product.findUnique.mockResolvedValueOnce(null); // sku libre
      mockPrisma.category.findUnique.mockResolvedValue({ id: 'cat-1', name: 'CCTV' });
      mockPrisma.brand.findUnique.mockResolvedValue({ id: 'brand-1', name: 'Hikvision' });
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
      mockPrisma.lista.findUnique.mockResolvedValue({ id: 'lista-v', code: 'LISTA-VISIBLE', defaultVisibility: true });
      mockPrisma.product.create.mockResolvedValue(mockProductWithRelations);

      const dto = { sku: 'CAM-013', name: 'Cámara', categoryId: 'cat-1', brandId: 'brand-1', listaId: 'lista-v' };

      await service.create(dto as any);

      expect(mockPrisma.product.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ listaId: 'lista-v', isVisible: true })}),
      );
    });

    it('debe respetar isVisible explícito aunque la Lista tenga defaultVisibility opuesto', async () => {
      mockPrisma.product.findUnique.mockResolvedValueOnce(null); // sku libre
      mockPrisma.category.findUnique.mockResolvedValue({ id: 'cat-1', name: 'CCTV' });
      mockPrisma.brand.findUnique.mockResolvedValue({ id: 'brand-1', name: 'Hikvision' });
      mockPrisma.lista.findUnique.mockResolvedValue({ id: 'lista-v', code: 'LISTA-VISIBLE', defaultVisibility: true });
      mockPrisma.product.create.mockResolvedValue(mockProductWithRelations);

      const dto = { sku: 'CAM-014', name: 'Cámara', categoryId: 'cat-1', brandId: 'brand-1', listaId: 'lista-v', isVisible: false };

      await service.create(dto as any);

      expect(mockPrisma.product.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ listaId: 'lista-v', isVisible: false })}),
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
        prices: [{ priceListId: 'pl-1', value: 2000000 }]};

      const result = await service.update('prod-1', dto as any);

      expect(result.name).toBe('Cámara IP Pro');
      expect(mockPrisma.product.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ extraAttributes: { garantia: '2 años' } })}),
      );
      expect(mockPrisma.price.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { productId_priceListId: { productId: 'prod-1', priceListId: 'pl-1' } }}),
      );
    });

    it('debe persistir documents al actualizar un producto', async () => {
      mockPrisma.product.findUnique.mockResolvedValueOnce(mockProduct);
      mockPrisma.product.update.mockResolvedValue({ ...mockProductWithRelations, documents: [] });

      const dto = {
        documents: [{ name: 'manual.pdf', url: '/uploads/doc-2.pdf', type: 'application/pdf', size: 51200 }]};

      await service.update('prod-1', dto as any);

      expect(mockPrisma.product.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ documents: dto.documents })}),
      );
    });
  });

  describe('clave por usuario (assertClave)', () => {
    it('update: NO exige clave si el usuario no tiene claveHash', async () => {
      mockPrisma.product.findUnique.mockResolvedValueOnce(mockProduct);
      mockPrisma.product.findUnique.mockResolvedValueOnce(null);
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1'});
      mockPrisma.product.update.mockResolvedValue({ ...mockProductWithRelations, name: 'Cámara IP Pro' });

      const result = await service.update('prod-1', { name: 'Cámara IP Pro' }, { userId: 'u1', roles: ['Admin Comercial'] });

      expect(result.name).toBe('Cámara IP Pro');
    });

    it('update: 409 CLAVE_USUARIO_REQUERIDA si tiene claveHash pero no envía clave', async () => {
      mockPrisma.product.findUnique.mockResolvedValueOnce(mockProduct);
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', claveHash: '$2b$10$hashvalido' });

      await expect(
        service.update('prod-1', { name: 'Cámara IP Pro' }, { userId: 'u1', roles: ['Admin Comercial'] }),
      ).rejects.toThrow(ConflictException);
    });

    it('update: 403 CLAVE_USUARIO_INCORRECTA si la clave enviada no coincide', async () => {
      mockPrisma.product.findUnique.mockResolvedValueOnce(mockProduct);
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', claveHash: '$2b$10$hashvalido' });

      await expect(
        service.update('prod-1', { name: 'Cámara IP Pro'}, { userId: 'u1', roles: ['Admin Comercial'] }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('update: permite si la clave enviada coincide', async () => {
      mockPrisma.product.findUnique.mockResolvedValueOnce(mockProduct);
      mockPrisma.product.findUnique.mockResolvedValueOnce(null);
      ;(bcrypt.compare as jest.Mock).mockResolvedValueOnce(true);
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', claveHash: '$2b$10$hashvalido' });
      mockPrisma.product.update.mockResolvedValue({ ...mockProductWithRelations, name: 'Cámara IP Pro' });

      const result = await service.update('prod-1', { name: 'Cámara IP Pro'}, { userId: 'u1', roles: ['Admin Comercial'] });

      expect(result.name).toBe('Cámara IP Pro');
    });

    it('remove: 409 CLAVE_USUARIO_REQUERIDA antes del chequeo de masterKey', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({ ...mockProduct, listaId: 'lista-1' });
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', claveHash: '$2b$10$hashvalido' });

      await expect(
        service.remove('prod-1', { confirm: true }, { userId: 'u1', roles: ['Admin Comercial'] }),
      ).rejects.toThrow(ConflictException);
    });

    it('transition (FSM): 409 CLAVE_USUARIO_REQUERIDA si tiene clave y no la envía', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({ ...mockProduct, listaId: 'lista-1' });
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', claveHash: '$2b$10$hashvalido' });

      await expect(
        service.transition('prod-1', { event: 'PUBLISH' }, { userId: 'u1', roles: ['Admin Comercial'] }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('toggleVisibility', () => {
    it('oculta un producto publicado (PUBLISHED → HIDDEN) vía FSM', async () => {
      const published = { ...mockProduct, publishStatus: 'publicado', isVisible: true, lifecycleStatus: 'PUBLISHED' };
      mockPrisma.product.findUnique.mockResolvedValue(published);
      mockPrisma.product.update.mockResolvedValue({ ...published, isVisible: false, lifecycleStatus: 'HIDDEN' });

      const result = await service.toggleVisibility('prod-1');

      expect(result.lifecycleStatus).toBe('HIDDEN');
      expect(result.isVisible).toBe(false);
      expect(mockPrisma.product.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ lifecycleStatus: 'HIDDEN', isVisible: false, publishStatus: 'publicado' })}),
      );
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'hide', entity: 'Product', entityId: 'prod-1' }),
      );
    });

    it('no alterna visibilidad si el producto no está publicado (400)', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({ ...mockProduct, lifecycleStatus: 'DRAFT' });

      await expect(service.toggleVisibility('prod-1')).rejects.toThrow(BadRequestException);
    });

    it('debe lanzar NotFoundException si el producto no existe', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(null);

      await expect(service.toggleVisibility('no-existe')).rejects.toThrow(NotFoundException);
    });
  });

  describe('toggleActive', () => {
    it('desactiva un producto activo (DRAFT → DISCONTINUED) vía FSM', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({ ...mockProduct, lifecycleStatus: 'DRAFT' });
      mockPrisma.product.update.mockResolvedValue({ ...mockProduct, isActive: false, lifecycleStatus: 'DISCONTINUED' });

      const result = await service.toggleActive('prod-1');

      expect(result.isActive).toBe(false);
      expect(result.lifecycleStatus).toBe('DISCONTINUED');
      expect(mockPrisma.product.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isActive: false, lifecycleStatus: 'DISCONTINUED' })}),
      );
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'discontinue', entity: 'Product', entityId: 'prod-1' }),
      );
    });

    it('debe lanzar NotFoundException si el producto no existe', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(null);

      await expect(service.toggleActive('no-existe')).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove (borrado físico P4)', () => {
    function noData() {
      mockPrisma.price.count.mockResolvedValue(0);
      mockPrisma.productImage.count.mockResolvedValue(0);
      mockPrisma.stock.findUnique.mockResolvedValue(null);
      mockPrisma.auditLog.count.mockResolvedValue(0);
      mockPrisma.purchaseOrder.findMany.mockResolvedValue([]);
    }

    it('debe eliminar un producto sin datos asociados con confirm: true y auditar delete', async () => {
      noData();
      mockPrisma.product.findUnique.mockResolvedValue(mockProduct);
      mockPrisma.productImage.findMany.mockResolvedValue([
        { id: 'img-1', url: '/uploads/img-1.png' },
        { id: 'img-2', url: '/uploads/img-2.png' },
      ]);
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      mockPrisma.price.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.productImage.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.product.delete.mockResolvedValue(mockProduct);

      const result = await service.remove('prod-1', { confirm: true });

      expect(result.message).toBe('Producto eliminado exitosamente');
      expect(mockPrisma.price.deleteMany).toHaveBeenCalledWith({ where: { productId: 'prod-1' } });
      expect(mockPrisma.productImage.deleteMany).toHaveBeenCalledWith({ where: { productId: 'prod-1' } });
      expect(fs.unlinkSync).toHaveBeenCalledWith(expect.stringContaining('img-1.png'));
      expect(fs.unlinkSync).toHaveBeenCalledWith(expect.stringContaining('img-2.png'));
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'delete',
          entity: 'Product',
          entityId: 'prod-1',
          oldValues: expect.objectContaining({ sku: 'CAM-001', name: 'Cámara IP' })}),
      );
    });

    it('debe borrar el producto aunque el archivo de imagen no exista en disco', async () => {
      noData();
      mockPrisma.product.findUnique.mockResolvedValue(mockProduct);
      mockPrisma.productImage.findMany.mockResolvedValue([{ id: 'img-1', url: '/uploads/img-1.png' }]);
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      mockPrisma.price.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.productImage.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.product.delete.mockResolvedValue(mockProduct);

      const result = await service.remove('prod-1', { confirm: true });

      expect(result.message).toBe('Producto eliminado exitosamente');
      expect(fs.unlinkSync).not.toHaveBeenCalled();
    });

    it('debe lanzar NotFoundException si el producto no existe', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(null);

      await expect(service.remove('no-existe', { confirm: true })).rejects.toThrow(NotFoundException);
    });

    it('400 si falta confirm: true', async () => {
      noData();
      mockPrisma.product.findUnique.mockResolvedValue(mockProduct);

      await expect(service.remove('prod-1', {})).rejects.toThrow(BadRequestException);
      await expect(service.remove('prod-1', {})).rejects.toThrow(/confirm/);
      expect(mockPrisma.product.delete).not.toHaveBeenCalled();
    });

    it('403 si el rol no tiene products:write', async () => {
      noData();
      mockPrisma.product.findUnique.mockResolvedValue(mockProduct);
      const ctx = { userId: 'u1', roles: ['Operador'] };

      await expect(service.remove('prod-1', { confirm: true }, ctx)).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.product.delete).not.toHaveBeenCalled();
    });

    it('403 si el ACL no permite nivel manage sobre el producto', async () => {
      noData();
      mockPrisma.product.findUnique.mockResolvedValue({ ...mockProduct, listaId: 'lista-1' });
      mockAcl.assertProductAccess.mockRejectedValue(new ForbiddenException('ACL denegado'));
      const ctx = { userId: 'u1', roles: ['Super Admin'] };

      await expect(service.remove('prod-1', { confirm: true }, ctx)).rejects.toThrow(ForbiddenException);
      expect(mockAcl.assertProductAccess).toHaveBeenCalledWith('prod-1', ctx, 'manage');
      expect(mockPrisma.product.delete).not.toHaveBeenCalled();
    });

    it('409 si hay datos asociados y falta masterKey', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({ ...mockProduct, listaId: 'lista-1' });
      mockPrisma.price.count.mockResolvedValue(1);
      mockPrisma.productImage.count.mockResolvedValue(0);
      mockPrisma.stock.findUnique.mockResolvedValue(null);
      mockPrisma.auditLog.count.mockResolvedValue(0);
      mockPrisma.purchaseOrder.findMany.mockResolvedValue([]);

      const ctx = { userId: 'u1', roles: ['Super Admin'] };
      await expect(service.remove('prod-1', { confirm: true }, ctx)).rejects.toThrow(ConflictException);
      await expect(service.remove('prod-1', { confirm: true }, ctx)).rejects.toThrow(/clave maestra/);
      expect(mockPrisma.product.delete).not.toHaveBeenCalled();
    });

    it('403 si hay datos asociados y la masterKey es incorrecta', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({ ...mockProduct, listaId: 'lista-1' });
      mockPrisma.price.count.mockResolvedValue(1);
      mockPrisma.productImage.count.mockResolvedValue(0);
      mockPrisma.stock.findUnique.mockResolvedValue(null);
      mockPrisma.auditLog.count.mockResolvedValue(0);
      mockPrisma.purchaseOrder.findMany.mockResolvedValue([]);

      const ctx = { userId: 'u1', roles: ['Super Admin'] };
      await expect(
        service.remove('prod-1', { confirm: true}, ctx),
      ).rejects.toThrow(ForbiddenException);
      
      expect(mockPrisma.product.delete).not.toHaveBeenCalled();
    });

    it('200 con datos asociados + masterKey correcta + confirm, y audita delete', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({
        ...mockProduct,
        listaId: 'lista-1',
        lifecycleStatus: 'PUBLISHED',
        publishStatus: 'publicado'});
      mockPrisma.price.count.mockResolvedValue(1);
      mockPrisma.productImage.count.mockResolvedValue(1);
      mockPrisma.stock.findUnique.mockResolvedValue({ id: 'stock-1', availableQty: 3 });
      mockPrisma.auditLog.count.mockResolvedValue(2);
      mockPrisma.purchaseOrder.findMany.mockResolvedValue([
        { id: 'po-1', items: { productId: 'prod-1', quantity: 5 } },
        { id: 'po-2', items: { productId: 'otro', quantity: 2 } },
      ]);
      mockPrisma.productImage.findMany.mockResolvedValue([]);
      mockPrisma.price.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.productImage.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.product.delete.mockResolvedValue(mockProduct);

      const ctx = { userId: 'u1', roles: ['Admin Comercial'] };
      const result = await service.remove('prod-1', { confirm: true}, ctx);

      expect(result.message).toBe('Producto eliminado exitosamente');
      
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'u1',
          action: 'delete',
          entity: 'Product',
          entityId: 'prod-1',
          oldValues: expect.objectContaining({
            sku: 'CAM-001',
            name: 'Cámara IP',
            lifecycleStatus: 'PUBLISHED',
            isActive: true,
            isVisible: true,
            publishStatus: 'publicado'})}),
      );
      expect(mockPrisma.product.delete).toHaveBeenCalledWith({ where: { id: 'prod-1' } });
    });

    it('detecta referencias en items de órdenes de compra (array de items)', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({ ...mockProduct, listaId: 'lista-1' });
      mockPrisma.price.count.mockResolvedValue(0);
      mockPrisma.productImage.count.mockResolvedValue(0);
      mockPrisma.stock.findUnique.mockResolvedValue(null);
      mockPrisma.auditLog.count.mockResolvedValue(0);
      mockPrisma.purchaseOrder.findMany.mockResolvedValue([
        { id: 'po-a', items: [{ productId: 'prod-1', quantity: 5 }, { productId: 'prod-2', quantity: 3 }] },
      ]);

      const ctx = { userId: 'u1', roles: ['Super Admin'] };
      await expect(service.remove('prod-1', { confirm: true }, ctx)).rejects.toThrow(ConflictException);
    });

    it('DELETE válido desde distintos estados FSM (publicado/oculto/archivado)', async () => {
      for (const status of ['PUBLISHED', 'HIDDEN', 'ARCHIVED']) {
        noData();
        mockPrisma.product.findUnique.mockResolvedValue({ ...mockProduct, listaId: 'lista-1', lifecycleStatus: status });
        mockPrisma.productImage.findMany.mockResolvedValue([]);
        mockPrisma.price.deleteMany.mockResolvedValue({ count: 0 });
        mockPrisma.productImage.deleteMany.mockResolvedValue({ count: 0 });
        mockPrisma.product.delete.mockResolvedValue(mockProduct);

        const ctx = { userId: 'u1', roles: ['Super Admin'] };
        const result = await service.remove('prod-1', { confirm: true }, ctx);
        expect(result.message).toBe('Producto eliminado exitosamente');
      }
    });
  });

  // --- Publicación: estados, programación, validaciones y lazy unpublish ---
  describe('publish', () => {
    function readyProduct(overrides: Record<string, any> = {}) {
      return {
        id: 'p1',
        sku: 'CAM-PUB',
        name: 'Cámara Publicable',
        categoryId: 'cat-1',
        brandId: 'brand-1',
        listaId: 'lista-1',
        isActive: true,
        isVisible: false,
        publishStatus: 'borrador',
        publishedAt: null,
        publishAt: null,
        unpublishAt: null,
        publishedById: null,
        unpublishReason: null,
        ...overrides};
    }

    it('publica un producto que cumple todos los requisitos', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(readyProduct());
      mockPrisma.lista.findUnique.mockResolvedValue({ id: 'lista-1', isActive: true, archivedAt: null });
      mockPrisma.price.count.mockResolvedValue(1);
      mockPrisma.productImage.count.mockResolvedValue(1);
      mockPrisma.stock.findUnique.mockResolvedValue(null);
      mockPrisma.product.update.mockResolvedValue(readyProduct({ publishStatus: 'publicado' }));

      const result = await service.publish('p1', {});

      expect(result.publishStatus).toBe('publicado');
      expect(mockPrisma.product.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            publishStatus: 'publicado',
            publishAt: null,
            publishedById: null})}),
      );
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'publish', entity: 'Product', entityId: 'p1' }),
      );
    });

    it('rechaza publicación con 400 listando TODOS los requisitos incumplidos', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(readyProduct({ isActive: false }));
      // Lista archivada y sin precios ni imágenes: fallan (a),(b),(c),(d).
      mockPrisma.lista.findUnique.mockResolvedValue({ id: 'lista-1', isActive: true, archivedAt: new Date() });
      mockPrisma.price.count.mockResolvedValue(0);
      mockPrisma.productImage.count.mockResolvedValue(0);
      mockPrisma.stock.findUnique.mockResolvedValue(null);

      await expect(service.publish('p1', {})).rejects.toThrow(BadRequestException);
      await expect(service.publish('p1', {})).rejects.toThrow(
        /lista destino|no está activo|precio vigente|imagen/,
      );
      expect(mockPrisma.product.update).not.toHaveBeenCalled();
    });

    it('rechaza publicar un producto ya publicado con 409', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(readyProduct({ publishStatus: 'publicado' }));

      await expect(service.publish('p1', {})).rejects.toThrow(ConflictException);
      await expect(service.publish('p1', {})).rejects.toThrow('ya está publicado');
    });

    it('no bloquea por stock cuando no existe registro de stock (decisión documentada)', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(readyProduct());
      mockPrisma.lista.findUnique.mockResolvedValue({ id: 'lista-1', isActive: true, archivedAt: null });
      mockPrisma.price.count.mockResolvedValue(1);
      mockPrisma.productImage.count.mockResolvedValue(1);
      mockPrisma.stock.findUnique.mockResolvedValue(null);
      mockPrisma.product.update.mockResolvedValue(readyProduct({ publishStatus: 'publicado' }));

      const result = await service.publish('p1', {});
      expect(result.publishStatus).toBe('publicado');
    });

    it('bloquea por stock cuando existe registro con availableQty <= 0', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(readyProduct());
      mockPrisma.lista.findUnique.mockResolvedValue({ id: 'lista-1', isActive: true, archivedAt: null });
      mockPrisma.price.count.mockResolvedValue(1);
      mockPrisma.productImage.count.mockResolvedValue(1);
      mockPrisma.stock.findUnique.mockResolvedValue({ productId: 'p1', availableQty: 0, reservedQty: 0 });

      await expect(service.publish('p1', {})).rejects.toThrow(BadRequestException);
      await expect(service.publish('p1', {})).rejects.toThrow(/stock/);
    });

    it('programa publicación futura dejando el producto en listo', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(readyProduct());
      mockPrisma.lista.findUnique.mockResolvedValue({ id: 'lista-1', isActive: true, archivedAt: null });
      mockPrisma.price.count.mockResolvedValue(1);
      mockPrisma.productImage.count.mockResolvedValue(1);
      mockPrisma.stock.findUnique.mockResolvedValue(null);
      const future = new Date(Date.now() + 86400000).toISOString();
      mockPrisma.product.update.mockResolvedValue(readyProduct({ publishStatus: 'listo' }));

      const result = await service.publish('p1', { publishAt: future });

      expect(result.publishStatus).toBe('listo');
      expect(mockPrisma.product.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ publishStatus: 'listo', publishedAt: null })}),
      );
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'schedule_publish', entity: 'Product' }),
      );
    });

    it('publica con precio importado (listaId null) usando el fallback global de precio vigente', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(readyProduct());
      mockPrisma.lista.findUnique.mockResolvedValue({ id: 'lista-1', isActive: true, archivedAt: null });
      // Sin precio con el listaId de la lista → fallback sin filtro → 1 vigente.
      mockPrisma.price.count.mockResolvedValueOnce(0).mockResolvedValueOnce(1);
      mockPrisma.productImage.count.mockResolvedValue(1);
      mockPrisma.stock.findUnique.mockResolvedValue(null);
      mockPrisma.product.update.mockResolvedValue(readyProduct({ publishStatus: 'publicado' }));

      const result = await service.publish('p1', {});

      expect(result.publishStatus).toBe('publicado');
      expect(mockPrisma.price.count).toHaveBeenCalledTimes(2);
    });

    it('publica con precio explícito en la lista (listaId) sin fallback', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(readyProduct());
      mockPrisma.lista.findUnique.mockResolvedValue({ id: 'lista-1', isActive: true, archivedAt: null });
      mockPrisma.price.count.mockResolvedValueOnce(1);
      mockPrisma.productImage.count.mockResolvedValue(1);
      mockPrisma.stock.findUnique.mockResolvedValue(null);
      mockPrisma.product.update.mockResolvedValue(readyProduct({ publishStatus: 'publicado' }));

      const result = await service.publish('p1', {});

      expect(result.publishStatus).toBe('publicado');
      expect(mockPrisma.price.count).toHaveBeenCalledTimes(1);
    });

    it('sigue bloqueando (400) cuando no hay precio vigente ni con listaId ni global', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(readyProduct());
      mockPrisma.lista.findUnique.mockResolvedValue({ id: 'lista-1', isActive: true, archivedAt: null });
      mockPrisma.price.count.mockResolvedValue(0);
      mockPrisma.productImage.count.mockResolvedValue(1);
      mockPrisma.stock.findUnique.mockResolvedValue(null);

      await expect(service.publish('p1', {})).rejects.toThrow(BadRequestException);
      await expect(service.publish('p1', {})).rejects.toThrow(/precio vigente/);
    });
  });

  describe('unpublish', () => {
    it('despublica a borrador con razón y audita', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({
        ...mockProduct,
        id: 'p1',
        listaId: 'lista-1',
        publishStatus: 'publicado'});
      mockPrisma.product.update.mockResolvedValue({ ...mockProduct, id: 'p1', publishStatus: 'borrador' });

      const result = await service.unpublish('p1', { reason: 'Campaña finalizada' });

      expect(result.publishStatus).toBe('borrador');
      expect(mockPrisma.product.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ publishStatus: 'borrador', unpublishReason: 'Campaña finalizada' })}),
      );
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'unpublish',
          entity: 'Product',
          entityId: 'p1',
          newValues: expect.objectContaining({ publishStatus: 'borrador', unpublishReason: 'Campaña finalizada' })}),
      );
    });

    it('lanza 404 si el producto no existe', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(null);
      await expect(service.unpublish('no-existe', {})).rejects.toThrow(NotFoundException);
    });
  });

  describe('lazy unpublish (runtime, sin cron)', () => {
    it('findOne despublica en runtime si unpublishAt ya venció', async () => {
      const expired = { ...mockProduct, id: 'p1', listaId: 'lista-1', publishStatus: 'publicado', unpublishAt: new Date(Date.now() - 1000) };
      mockPrisma.product.findUnique.mockResolvedValue(expired);
      mockPrisma.product.update.mockResolvedValue({ ...expired, publishStatus: 'borrador', unpublishReason: 'auto' });

      const result = await service.findOne('p1');

      expect(result.publishStatus).toBe('borrador');
      expect(result.unpublishReason).toBe('auto');
      expect(mockPrisma.product.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ publishStatus: 'borrador', unpublishReason: 'auto' }) }),
      );
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'unpublish', entity: 'Product', entityId: 'p1' }),
      );
    });

    it('findOne no toca un producto publicado sin vencer', async () => {
      const active = { ...mockProduct, id: 'p1', listaId: 'lista-1', publishStatus: 'publicado', unpublishAt: new Date(Date.now() + 86400000) };
      mockPrisma.product.findUnique.mockResolvedValue(active);

      const result = await service.findOne('p1');

      expect(result.publishStatus).toBe('publicado');
      expect(mockPrisma.product.update).not.toHaveBeenCalled();
    });
  });

  describe('findPublishScheduled', () => {
    it('lista productos programados entre from y to', async () => {
      mockPrisma.product.findMany.mockResolvedValue([
        { id: 'p1', sku: 'CAM-001', name: 'Cámara', publishAt: new Date('2026-09-01'), unpublishAt: null, lista: { id: 'l1', name: 'Lista 1', code: 'L1' } },
      ]);

      const result = await service.findPublishScheduled('2026-08-01', '2026-10-01');

      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toHaveProperty('sku', 'CAM-001');
      expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ publishStatus: 'listo' })}),
      );
    });
  });

  // --- Regresión post-Catalog (entidad eliminada) ---
  describe('catálogo eliminado (regresión)', () => {
    it('findAll no filtra por catalogId', async () => {
      mockPrisma.product.findMany.mockResolvedValue([]);
      mockPrisma.product.count.mockResolvedValue(0);

      await service.findAll({ catalogId: 'id-antiguo' } as any);

      const call = mockPrisma.product.findMany.mock.calls[0][0];
      expect(call.where).not.toHaveProperty('catalogId');
    });

    it('findAll filtra por search', async () => {
      mockPrisma.product.findMany.mockResolvedValue([]);
      mockPrisma.product.count.mockResolvedValue(0);

      await service.findAll({ search: 'cámara' });

      expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ OR: expect.any(Array) })}),
      );
    });

    it('findAll filtra por isVisible e isActive', async () => {
      mockPrisma.product.findMany.mockResolvedValue([]);
      mockPrisma.product.count.mockResolvedValue(0);

      await service.findAll({ isVisible: true, isActive: true });

      expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isVisible: true, isActive: true })}),
      );
    });

    it('findOne no incluye la relación catalog en el include', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(mockProductWithRelations);

      await service.findOne('prod-1');

      const call = mockPrisma.product.findUnique.mock.calls[0][0];
      expect(call.include).not.toHaveProperty('catalog');
    });

    it('create no persiste catalogId', async () => {
      mockPrisma.product.findUnique.mockResolvedValueOnce(null);
      mockPrisma.category.findUnique.mockResolvedValue({ id: 'cat-1', name: 'CCTV' });
      mockPrisma.brand.findUnique.mockResolvedValue({ id: 'brand-1', name: 'Hikvision' });
      mockPrisma.lista.findUnique.mockResolvedValue({ id: 'lista-1', code: 'LISTA-GENERAL', defaultVisibility: false });
      mockPrisma.product.create.mockResolvedValue(mockProductWithRelations);

      await service.create({
        sku: 'CAM-X',
        name: 'X',
        categoryId: 'cat-1',
        brandId: 'brand-1',
        catalogId: 'id-antiguo'} as any);

      const call = mockPrisma.product.create.mock.calls[0][0];
      expect(call.data).not.toHaveProperty('catalogId');
    });

    it('update no persiste catalogId', async () => {
      mockPrisma.product.findUnique.mockResolvedValueOnce(mockProduct);
      mockPrisma.product.findUnique.mockResolvedValueOnce(null); // sku check
      mockPrisma.category.findUnique.mockResolvedValue({ id: 'cat-1', name: 'CCTV' });
      mockPrisma.brand.findUnique.mockResolvedValue({ id: 'brand-1', name: 'Hikvision' });
      mockPrisma.product.update.mockResolvedValue(mockProductWithRelations);

      await service.update('prod-1', { name: 'X', catalogId: 'id-antiguo' } as any);

      const call = mockPrisma.product.update.mock.calls[0][0];
      expect(call.data).not.toHaveProperty('catalogId');
    });

    it('update reasigna listaId al actualizar', async () => {
      mockPrisma.product.findUnique.mockResolvedValueOnce(mockProduct);
      mockPrisma.lista.findUnique.mockResolvedValue({ id: 'lista-nueva', defaultVisibility: false });
      mockPrisma.product.update.mockResolvedValue({ ...mockProductWithRelations, listaId: 'lista-nueva' });

      await service.update('prod-1', { listaId: 'lista-nueva' });

      expect(mockPrisma.product.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ listaId: 'lista-nueva' }) }),
      );
    });

    it('update rechaza listaId inexistente', async () => {
      mockPrisma.product.findUnique.mockResolvedValueOnce(mockProduct);
      mockPrisma.lista.findUnique.mockResolvedValue(null);

      await expect(service.update('prod-1', { listaId: 'no-existe' })).rejects.toThrow('Lista no encontrada');
    });

    it('bloquea con 400 intentos de cambiar estado vía PUT (FSM es la única vía)', async () => {
      await expect(service.update('prod-1', { isActive: true } as any)).rejects.toThrow(BadRequestException);
      await expect(service.update('prod-1', { publishStatus: 'publicado' } as any)).rejects.toThrow(
        /POST \/transition/,
      );
      await expect(service.update('prod-1', { publishAt: '2026-12-01' } as any)).rejects.toThrow(
        /POST \/transition/,
      );
      expect(mockPrisma.product.findUnique).not.toHaveBeenCalled();
      expect(mockPrisma.product.update).not.toHaveBeenCalled();
    });
  });

  describe('findTrending', () => {
    it('retorna productos tendencia activos y visibles', async () => {
      mockPrisma.product.findMany.mockResolvedValue([mockProductWithRelations]);
      mockPrisma.product.count.mockResolvedValue(1);

      const res = await service.findTrending({ take: 5 });

      expect(res.data).toHaveLength(1);
      expect(res.meta.total).toBe(1);
    });

    it('usa caché: una segunda llamada sin forceReload no consulta la BD', async () => {
      mockPrisma.product.findMany.mockResolvedValue([mockProductWithRelations]);
      mockPrisma.product.count.mockResolvedValue(1);

      await service.findTrending({ take: 5 });
      await service.findTrending({ take: 5 });

      expect(mockPrisma.product.findMany).toHaveBeenCalledTimes(1);
    });

    it('forceReload vuelve a consultar la BD', async () => {
      mockPrisma.product.findMany.mockResolvedValue([mockProductWithRelations]);
      mockPrisma.product.count.mockResolvedValue(1);

      await service.findTrending({ take: 5 });
      await service.findTrending({ take: 5, forceReload: true });

      expect(mockPrisma.product.findMany).toHaveBeenCalledTimes(2);
    });
  });

  describe('importFromExcel', () => {
    function buildXlsxBuffer(rows: (string | number)[][]): Buffer {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
      return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    }

    beforeEach(() => {
      mockPrisma.category.findMany.mockResolvedValue([]);
      mockPrisma.brand.findMany.mockResolvedValue([]);
      mockPrisma.category.create.mockResolvedValue({ id: 'cat-1', name: 'CCTV', slug: 'cctv' });
      mockPrisma.brand.create.mockResolvedValue({ id: 'brand-1', name: 'Hikvision', slug: 'hikvision' });
      mockPrisma.lista.findUnique.mockResolvedValue({ id: 'lista-1', code: 'LISTA-GENERAL', defaultVisibility: false });
      mockPrisma.product.findUnique.mockResolvedValue(null);
    });

    it('importa productos válidos asociados a LISTA-GENERAL sin catalogId', async () => {
      mockPrisma.product.create.mockResolvedValue({ id: 'prod-1', sku: 'SKU-1' });

      const buffer = buildXlsxBuffer([
        ['SKU', 'Nombre', 'Categoría', 'Marca'],
        ['SKU-1', 'Cámara IP', 'CCTV', 'Hikvision'],
      ]);

      const result = await service.importFromExcel(buffer);

      expect(result.created).toBe(1);
      expect(mockPrisma.product.create.mock.calls[0][0].data).not.toHaveProperty('catalogId');
      expect(mockPrisma.product.create.mock.calls[0][0].data).toHaveProperty('listaId', 'lista-1');
    });

    it('rechaza un archivo vacío (solo encabezados)', async () => {
      const buffer = buildXlsxBuffer([['SKU', 'Nombre']]);

      await expect(service.importFromExcel(buffer)).rejects.toThrow('El archivo está vacío');
    });

    it('salta filas sin SKU', async () => {
      const buffer = buildXlsxBuffer([
        ['SKU', 'Nombre', 'Categoría', 'Marca'],
        ['', 'Cámara', 'CCTV', 'Hikvision'],
      ]);

      const result = await service.importFromExcel(buffer);

      expect(result.created).toBe(0);
      expect(result.skipped).toBe(1);
      expect(result.errors[0].error).toBe('SKU vacío');
    });

    it('salta filas sin nombre', async () => {
      const buffer = buildXlsxBuffer([
        ['SKU', 'Nombre', 'Categoría', 'Marca'],
        ['SKU-1', '', 'CCTV', 'Hikvision'],
      ]);

      const result = await service.importFromExcel(buffer);

      expect(result.skipped).toBe(1);
      expect(result.errors[0].error).toBe('Nombre vacío');
    });

    it('salta SKU ya existente', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({ id: 'existing', sku: 'SKU-1' });

      const buffer = buildXlsxBuffer([
        ['SKU', 'Nombre', 'Categoría', 'Marca'],
        ['SKU-1', 'Cámara', 'CCTV', 'Hikvision'],
      ]);

      const result = await service.importFromExcel(buffer);

      expect(result.created).toBe(0);
      expect(result.skipped).toBe(1);
      expect(result.errors[0].error).toBe('SKU ya existe');
    });

    it('crea categoría y marca inexistentes durante la importación', async () => {
      mockPrisma.category.create.mockResolvedValue({ id: 'cat-new', name: 'CCTV', slug: 'cctv' });
      mockPrisma.brand.create.mockResolvedValue({ id: 'brand-new', name: 'Hikvision', slug: 'hikvision' });
      mockPrisma.product.create.mockResolvedValue({ id: 'prod-1', sku: 'SKU-1' });

      const buffer = buildXlsxBuffer([
        ['SKU', 'Nombre', 'Categoría', 'Marca'],
        ['SKU-1', 'Cámara', 'CCTV', 'Hikvision'],
      ]);

      const result = await service.importFromExcel(buffer);

      expect(result.created).toBe(1);
      expect(mockPrisma.category.create).toHaveBeenCalled();
      expect(mockPrisma.brand.create).toHaveBeenCalled();
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
      [NOAUTH.userId]: []};
    let acl: AclService;
    let svc: ProductsService;

    beforeEach(() => {
      acl = new AclService(mockPrisma as any);
      svc = new ProductsService(mockPrisma as any, acl, mockAudit as any);
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

    it('view no edita (toggleVisibility de publicado exige publish:manage → 403)', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({
        ...mockProduct,
        listaId: LISTA_ID,
        publishStatus: 'publicado',
        isVisible: true,
        lifecycleStatus: 'PUBLISHED'});
      await expect(svc.toggleVisibility('prod-1', VIEWER)).rejects.toThrow(ForbiddenException);
    });

    it('create: usuario view sobre la Lista no puede crear producto (403, falta edit)', async () => {
      mockPrisma.product.findUnique.mockResolvedValueOnce(null);
      mockPrisma.category.findUnique.mockResolvedValue({ id: 'cat-1', name: 'CCTV' });
      mockPrisma.brand.findUnique.mockResolvedValue({ id: 'brand-1', name: 'Hikvision' });
      mockPrisma.lista.findUnique.mockResolvedValue({ id: LISTA_ID, code: 'LISTA-GENERAL', isActive: true, archivedAt: null });

      const dto = { sku: 'NEW-1', name: 'X', categoryId: 'cat-1', brandId: 'brand-1', listaId: LISTA_ID };
      await expect(svc.create(dto as any, VIEWER)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('stockStatus calculado (Tanda 1C)', () => {
    it('findAll: in_stock con availableQty > 0', async () => {
      mockPrisma.product.findMany.mockResolvedValue([mockProductWithRelations]);
      mockPrisma.product.count.mockResolvedValue(1);
      mockPrisma.stock.findMany.mockResolvedValue([{ id: 's1', productId: 'prod-1', availableQty: 5 }]);

      const res = await service.findAll({ skip: 0, take: 50 });
      expect(res.data[0].stockStatus).toBe('in_stock');
    });

    it('findAll: out_of_stock con availableQty 0', async () => {
      mockPrisma.product.findMany.mockResolvedValue([mockProductWithRelations]);
      mockPrisma.product.count.mockResolvedValue(1);
      mockPrisma.stock.findMany.mockResolvedValue([{ id: 's1', productId: 'prod-1', availableQty: 0 }]);

      const res = await service.findAll({ skip: 0, take: 50 });
      expect(res.data[0].stockStatus).toBe('out_of_stock');
    });

    it('findAll: no_stock_data sin registro de stock', async () => {
      mockPrisma.product.findMany.mockResolvedValue([mockProductWithRelations]);
      mockPrisma.product.count.mockResolvedValue(1);
      mockPrisma.stock.findMany.mockResolvedValue([]);

      const res = await service.findAll({ skip: 0, take: 50 });
      expect(res.data[0].stockStatus).toBe('no_stock_data');
    });

    it('findOne: incluye stockStatus calculado', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(mockProductWithRelations);
      mockPrisma.stock.findUnique.mockResolvedValue({ id: 's1', productId: 'prod-1', availableQty: 8 });

      const res = await service.findOne('prod-1');
      expect(res.stockStatus).toBe('in_stock');
    });
  });

  // --- PATCH de imágenes (Tanda 1C): alt y principal ---
  describe('updateImage (PATCH imágenes)', () => {
    const image = {
      id: 'img-1',
      productId: 'prod-1',
      url: '/uploads/img-1.png',
      alt: 'Cámara IP',
      isPrimary: false,
      sortOrder: 0};

    it('actualiza el alt de la imagen y audita', async () => {
      mockPrisma.productImage.findUnique.mockResolvedValue(image);
      mockPrisma.$transaction.mockImplementation(async (cb: any) => cb(mockPrisma));
      mockPrisma.productImage.update.mockResolvedValue({ ...image, alt: 'Cámara IP frontal' });

      const result = await service.updateImage('img-1', { alt: 'Cámara IP frontal' });

      expect(result.alt).toBe('Cámara IP frontal');
      expect(mockPrisma.productImage.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'img-1' },
          data: { alt: 'Cámara IP frontal' }}),
      );
      expect(mockPrisma.productImage.updateMany).not.toHaveBeenCalled();
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'update',
          entity: 'ProductImage',
          entityId: 'img-1',
          oldValues: expect.objectContaining({ isPrimary: false }),
          newValues: expect.objectContaining({ alt: 'Cámara IP frontal' })}),
      );
    });

    it('marca como principal y desmarca las demás imágenes del producto', async () => {
      mockPrisma.productImage.findUnique.mockResolvedValue(image);
      mockPrisma.$transaction.mockImplementation(async (cb: any) => cb(mockPrisma));
      mockPrisma.productImage.update.mockResolvedValue({ ...image, isPrimary: true });

      const result = await service.updateImage('img-1', { isPrimary: true });

      expect(result.isPrimary).toBe(true);
      expect(mockPrisma.productImage.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { productId: 'prod-1', isPrimary: true },
          data: { isPrimary: false }}),
      );
      expect(mockPrisma.productImage.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ isPrimary: true }) }),
      );
    });

    it('lanza 404 si la imagen no existe', async () => {
      mockPrisma.productImage.findUnique.mockResolvedValue(null);

      await expect(service.updateImage('no-existe', { alt: 'x' })).rejects.toThrow(NotFoundException);
    });
  });
});
