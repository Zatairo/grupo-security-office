import { createPrismaMock } from '../../__test__/mocks/prisma.mock';

jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  unlinkSync: jest.fn(),
  mkdirSync: jest.fn(),
  promises: {
    writeFile: jest.fn().mockResolvedValue(undefined),
  },
}));

import * as fs from 'fs';

const mockPrisma = createPrismaMock();

jest.mock('../../prisma/prisma.service', () => ({
  PrismaService: jest.fn().mockImplementation(() => mockPrisma),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { BrandsService } from './brands.service';
import { PrismaService } from '../../prisma/prisma.service';

const mockBrand = {
  id: 'brand-1',
  name: 'Hikvision',
  slug: 'hikvision',
  logo: 'https://example.com/logo.png',
  description: 'Líder en videovigilancia',
  website: 'https://www.hikvision.com',
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockBrandWithCount = {
  ...mockBrand,
  _count: { products: 10 },
};

const mockBrandWithProducts = {
  ...mockBrand,
  products: [
    { id: 'p1', name: 'Cámara IP', sku: 'CAM-001' },
  ],
  _count: { products: 1 },
};

describe('BrandsService', () => {
  let service: BrandsService;

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BrandsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<BrandsService>(BrandsService);
  });

  describe('findAll', () => {
    it('debe listar marcas con conteo de productos', async () => {
      mockPrisma.brand.findMany.mockResolvedValue([mockBrandWithCount]);

      const result = await service.findAll();

      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe('Hikvision');
      expect(result.data[0].productCount).toBe(10);
    });
  });

  describe('findOne', () => {
    it('debe retornar marca por id', async () => {
      mockPrisma.brand.findUnique.mockResolvedValue(mockBrandWithProducts);

      const result = await service.findOne('brand-1');

      expect(result.name).toBe('Hikvision');
      expect(result.products).toHaveLength(1);
    });

    it('debe lanzar NotFoundException cuando la marca no existe', async () => {
      mockPrisma.brand.findUnique.mockResolvedValue(null);

      await expect(service.findOne('no-existe')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('debe crear una marca', async () => {
      mockPrisma.brand.findUnique.mockResolvedValueOnce(null);
      mockPrisma.brand.findUnique.mockResolvedValueOnce(null);
      mockPrisma.brand.create.mockResolvedValue(mockBrand);

      const dto = { name: 'Hikvision', slug: 'hikvision' };
      const result = await service.create(dto);

      expect(result.name).toBe('Hikvision');
    });

    it('debe rechazar nombre duplicado con ConflictException', async () => {
      mockPrisma.brand.findUnique.mockResolvedValue(mockBrand);

      const dto = { name: 'Hikvision', slug: 'hikvision' };

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
      await expect(service.create(dto)).rejects.toThrow('Ya existe una marca con ese nombre');
    });

    it('debe rechazar slug duplicado con ConflictException', async () => {
      mockPrisma.brand.findUnique.mockResolvedValueOnce(null);
      mockPrisma.brand.findUnique.mockResolvedValueOnce(mockBrand);

      const dto = { name: 'Otra Marca', slug: 'hikvision' };

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
    });
  });

  describe('update', () => {
    it('debe actualizar una marca', async () => {
      mockPrisma.brand.findUnique.mockResolvedValueOnce(mockBrand);
      mockPrisma.brand.findUnique.mockResolvedValueOnce(null);
      mockPrisma.brand.findUnique.mockResolvedValueOnce(null);
      mockPrisma.brand.update.mockResolvedValue({ ...mockBrand, name: 'Hikvision Pro' });

      const dto = { name: 'Hikvision Pro', slug: 'hikvision-pro' };
      const result = await service.update('brand-1', dto);

      expect(result.name).toBe('Hikvision Pro');
    });

    it('debe lanzar NotFoundException si la marca no existe', async () => {
      mockPrisma.brand.findUnique.mockResolvedValue(null);

      await expect(service.update('no-existe', { name: 'Nope' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('debe eliminar una marca sin productos', async () => {
      mockPrisma.brand.findUnique.mockResolvedValue({ ...mockBrand, products: [] });
      mockPrisma.brand.delete.mockResolvedValue(mockBrand);

      const result = await service.remove('brand-1');

      expect(result.message).toBe('Marca eliminada exitosamente');
    });

    it('debe lanzar ConflictException si la marca tiene productos', async () => {
      mockPrisma.brand.findUnique.mockResolvedValue(mockBrandWithProducts);

      await expect(service.remove('brand-1')).rejects.toThrow(ConflictException);
      await expect(service.remove('brand-1')).rejects.toThrow('No se puede eliminar una marca con productos');
    });

    it('debe lanzar NotFoundException si la marca no existe', async () => {
      mockPrisma.brand.findUnique.mockResolvedValue(null);

      await expect(service.remove('no-existe')).rejects.toThrow(NotFoundException);
    });
  });

  describe('toggleActive', () => {
    it('debe alternar isActive', async () => {
      mockPrisma.brand.findUnique.mockResolvedValue(mockBrand);
      mockPrisma.brand.update.mockResolvedValue({ ...mockBrand, isActive: false });

      const result = await service.toggleActive('brand-1');

      expect(result.isActive).toBe(false);
      expect(mockPrisma.brand.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { isActive: false } }),
      );
    });

    it('debe lanzar NotFoundException si la marca no existe', async () => {
      mockPrisma.brand.findUnique.mockResolvedValue(null);

      await expect(service.toggleActive('no-existe')).rejects.toThrow(NotFoundException);
    });
  });

  describe('uploadLogo', () => {
    const validFile = {
      originalname: 'logo.png',
      mimetype: 'image/png',
      buffer: Buffer.from('fake-image-bytes'),
      size: 1024,
    } as Express.Multer.File;

    it('debe guardar el logo y actualizar la marca', async () => {
      mockPrisma.brand.findUnique.mockResolvedValue(mockBrand);
      mockPrisma.brand.update.mockResolvedValue({ ...mockBrand, logo: '/uploads/logo-nuevo.png' });

      const result = await service.uploadLogo('brand-1', validFile);

      expect(result.logo).toMatch(/^\/uploads\/.+\.png$/);
      expect(fs.promises.writeFile).toHaveBeenCalledTimes(1);
      expect(mockPrisma.brand.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { logo: expect.stringMatching(/^\/uploads\//) } }),
      );
    });

    it('debe borrar el logo anterior cuando es un upload interno', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      mockPrisma.brand.findUnique.mockResolvedValue({ ...mockBrand, logo: '/uploads/anterior.png' });
      mockPrisma.brand.update.mockResolvedValue({ ...mockBrand, logo: '/uploads/nuevo.png' });

      await service.uploadLogo('brand-1', validFile);

      expect(fs.unlinkSync).toHaveBeenCalledWith(expect.stringContaining('anterior.png'));
    });

    it('no debe intentar borrar logos externos (no gestionados)', async () => {
      mockPrisma.brand.findUnique.mockResolvedValue(mockBrand);
      mockPrisma.brand.update.mockResolvedValue({ ...mockBrand, logo: '/uploads/nuevo.png' });

      await service.uploadLogo('brand-1', validFile);

      expect(fs.unlinkSync).not.toHaveBeenCalled();
    });

    it('debe lanzar BadRequestException con mimetype no permitido', async () => {
      mockPrisma.brand.findUnique.mockResolvedValue(mockBrand);
      const txt = { ...validFile, mimetype: 'text/plain', originalname: 'logo.txt' } as Express.Multer.File;

      await expect(service.uploadLogo('brand-1', txt)).rejects.toThrow(BadRequestException);
      await expect(service.uploadLogo('brand-1', txt)).rejects.toThrow('Tipo de archivo no permitido');
    });

    it('debe lanzar NotFoundException si la marca no existe', async () => {
      mockPrisma.brand.findUnique.mockResolvedValue(null);

      await expect(service.uploadLogo('no-existe', validFile)).rejects.toThrow(NotFoundException);
    });
  });
});
