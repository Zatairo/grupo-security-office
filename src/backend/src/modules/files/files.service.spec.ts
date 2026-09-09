import { createPrismaMock } from '../../__test__/mocks/prisma.mock';

const mockPrisma = createPrismaMock();

jest.mock('../../prisma/prisma.service', () => ({
  PrismaService: jest.fn().mockImplementation(() => mockPrisma),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { FilesService } from './files.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('FilesService', () => {
  let service: FilesService;

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [FilesService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<FilesService>(FilesService);
  });

  describe('store', () => {
    it('debe guardar los bytes y devolver la URL pública', async () => {
      mockPrisma.uploadedFile.create.mockResolvedValue({
        id: 'file-1',
        mimeType: 'image/png',
        data: Buffer.from('bytes'),
        createdAt: new Date(),
      });

      const result = await service.store(Buffer.from('bytes'), 'image/png');

      expect(result).toEqual({ id: 'file-1', url: '/api/files/file-1' });
      expect(mockPrisma.uploadedFile.create).toHaveBeenCalledWith({
        data: { mimeType: 'image/png', data: Buffer.from('bytes') },
      });
    });
  });

  describe('get', () => {
    it('debe devolver los bytes y el mimeType si el archivo existe', async () => {
      mockPrisma.uploadedFile.findUnique.mockResolvedValue({
        id: 'file-1',
        mimeType: 'image/png',
        data: Buffer.from('bytes'),
        createdAt: new Date(),
      });

      const result = await service.get('file-1');

      expect(result).toEqual({ data: Buffer.from('bytes'), mimeType: 'image/png' });
    });

    it('debe devolver null si el archivo no existe', async () => {
      mockPrisma.uploadedFile.findUnique.mockResolvedValue(null);

      const result = await service.get('no-existe');

      expect(result).toBeNull();
    });
  });

  describe('deleteByUrl', () => {
    it('debe borrar el archivo cuando la URL apunta a este almacén', async () => {
      mockPrisma.uploadedFile.delete.mockResolvedValue({});

      await service.deleteByUrl('/api/files/file-1');

      expect(mockPrisma.uploadedFile.delete).toHaveBeenCalledWith({ where: { id: 'file-1' } });
    });

    it('no debe hacer nada si la URL es externa (no gestionada por este almacén)', async () => {
      await service.deleteByUrl('https://example.com/logo.png');

      expect(mockPrisma.uploadedFile.delete).not.toHaveBeenCalled();
    });

    it('no debe hacer nada si la URL es null o undefined', async () => {
      await service.deleteByUrl(null);
      await service.deleteByUrl(undefined);

      expect(mockPrisma.uploadedFile.delete).not.toHaveBeenCalled();
    });

    it('no debe lanzar si el archivo ya no existe en BD', async () => {
      mockPrisma.uploadedFile.delete.mockRejectedValue(new Error('Record not found'));

      await expect(service.deleteByUrl('/api/files/no-existe')).resolves.toBeUndefined();
    });
  });
});
