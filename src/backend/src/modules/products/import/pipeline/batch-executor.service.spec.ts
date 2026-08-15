import { createPrismaMock } from '../../../../__test__/mocks/prisma.mock';
import { NotFoundException } from '@nestjs/common';
import { BatchExecutorService } from './batch-executor.service';
import { PrismaService } from '../../../../prisma/prisma.service';
import { AuditService } from '../../../audit/audit.service';
import { ImportContext } from '../interfaces/import-context';

const mockPrisma = createPrismaMock();

describe('BatchExecutorService — Lista destino (listaId)', () => {
  let service: BatchExecutorService;

  const auditService = {
    log: jest.fn().mockResolvedValue(undefined),
  };

  const normalizedRow = {
    rowIndex: 0,
    sku: 'SKU-1',
    name: 'Cámara IP',
    description: 'desc',
    categoryName: 'CCTV',
    brandName: 'Hikvision',
    prices: [],
    technicalSpecs: {},
    extraAttributes: {},
    isUpdate: false,
  };

  const makeCtx = (overrides?: Partial<ImportContext>): ImportContext => ({
    importId: 'import-1',
    userId: 'user-1',
    fileName: 'test.xlsx',
    fileSize: 1024,
    rawRows: [],
    headers: ['REFERENCIA', 'DESCRIPCION'],
    columnMapping: {
      entries: [
        { sourceColumn: 'REFERENCIA', targetField: 'sku', isRequired: true, confidence: 1.0 },
        { sourceColumn: 'DESCRIPCION', targetField: 'name', isRequired: true, confidence: 1.0 },
      ],
      confirmed: true,
    },
    ivaMode: 'with_iva',
    validatedRows: [],
    normalizedRows: [],
    pipelineErrors: [],
    startedAt: new Date(),
    currentStage: 'batch_execution',
    ...overrides,
  });

  beforeEach(() => {
    jest.resetAllMocks();
    service = new BatchExecutorService(
      mockPrisma as unknown as PrismaService,
      auditService as unknown as AuditService,
    );

    mockPrisma.category.findMany.mockResolvedValue([]);
    mockPrisma.brand.findMany.mockResolvedValue([]);
    mockPrisma.priceList.findMany.mockResolvedValue([]);
    mockPrisma.$transaction.mockImplementation(async (cb: any) => cb(mockPrisma));
    mockPrisma.product.findMany.mockResolvedValue([]);
    mockPrisma.category.create.mockResolvedValue({ id: 'cat-1', name: 'CCTV', slug: 'cctv' });
    mockPrisma.brand.create.mockResolvedValue({ id: 'brand-1', name: 'Hikvision', slug: 'hikvision' });
    mockPrisma.product.create.mockResolvedValue({
      id: 'prod-1',
      sku: 'SKU-1',
      name: 'Cámara IP',
      listaId: 'lista-x',
      isVisible: false,
    });
  });

  it('crea productos asignados a la Lista del contexto (listaId)', async () => {
    mockPrisma.lista.findUnique.mockResolvedValue({ id: 'lista-x', defaultVisibility: false });

    const result = await service.execute([normalizedRow], makeCtx({ listaId: 'lista-x' }));

    expect(result.created).toBe(1);
    expect(mockPrisma.lista.findUnique).toHaveBeenCalledWith({
      where: { id: 'lista-x' },
      select: { id: true, defaultVisibility: true },
    });
    expect(mockPrisma.product.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ listaId: 'lista-x' }),
      }),
    );
    expect(mockPrisma.product.create.mock.calls[0][0].data).not.toHaveProperty('catalogId');
  });

  it('lanza NotFoundException si el listaId del contexto no existe', async () => {
    mockPrisma.lista.findUnique.mockResolvedValue(null);

    await expect(service.execute([normalizedRow], makeCtx({ listaId: 'lista-inexistente' }))).rejects.toThrow(
      NotFoundException,
    );
  });

  it('asigna LISTA-GENERAL cuando el contexto no trae listaId', async () => {
    mockPrisma.lista.findUnique.mockResolvedValue({ id: 'lista-general-1', defaultVisibility: false });

    const result = await service.execute([normalizedRow], makeCtx());

    expect(result.created).toBe(1);
    expect(mockPrisma.lista.findUnique).toHaveBeenCalledWith({
      where: { code: 'LISTA-GENERAL' },
      select: { id: true, defaultVisibility: true },
    });
    expect(mockPrisma.product.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ listaId: 'lista-general-1' }),
      }),
    );
  });

  it('propaga defaultVisibility de la Lista como isVisible del producto creado', async () => {
    mockPrisma.lista.findUnique.mockResolvedValue({ id: 'lista-v', defaultVisibility: true });

    await service.execute([normalizedRow], makeCtx({ listaId: 'lista-v' }));

    expect(mockPrisma.product.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ listaId: 'lista-v', isVisible: true }),
      }),
    );
  });

  it('no asigna catalogId al producto creado (catálogo eliminado)', async () => {
    mockPrisma.lista.findUnique.mockResolvedValue({ id: 'lista-x', defaultVisibility: false });

    await service.execute([normalizedRow], makeCtx({ listaId: 'lista-x' }));

    expect(mockPrisma.product.create.mock.calls[0][0].data).not.toHaveProperty('catalogId');
  });
});