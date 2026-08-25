import { Logger } from '@nestjs/common';
import { createPrismaMock } from '../../__test__/mocks/prisma.mock';

jest.mock('../../prisma/prisma.service', () => ({
  PrismaService: jest.fn().mockImplementation(() => mockPrisma),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { ProductsService } from './products.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AclService } from '../../common/acl/acl.service';
import { AuditService } from '../audit/audit.service';

const mockPrisma = createPrismaMock();
mockPrisma.price.deleteMany = jest.fn();

const mockAudit = { log: jest.fn().mockResolvedValue(undefined) };
const mockMasterKey = { validateMasterKey: jest.fn().mockResolvedValue(false) };

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

function scheduledProduct(overrides: Record<string, any> = {}) {
  return {
    id: 'p1',
    sku: 'CAM-SCH',
    name: 'Cámara Programada',
    categoryId: 'cat-1',
    brandId: 'brand-1',
    listaId: 'lista-1',
    isActive: true,
    isVisible: false,
    publishStatus: 'listo',
    lifecycleStatus: 'SCHEDULED',
    publishedAt: null,
    publishAt: new Date(Date.now() - 2 * 60 * 1000),
    unpublishAt: null,
    publishedById: null,
    unpublishReason: null,
    ...overrides,
  };
}

describe('ProductsService — scheduler P6 (cron cada minuto)', () => {
  let service: ProductsService;
  let loggerWarnSpy: jest.SpyInstance;

  beforeEach(async () => {
    jest.resetAllMocks();
    loggerWarnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    mockPrisma.lista.findUnique.mockResolvedValue({ id: 'lista-1', isActive: true, archivedAt: null });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AclService, useValue: mockAcl },
        { provide: AuditService, useValue: mockAudit },
        { provide: Object, useValue: mockMasterKey },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
  });

  afterEach(() => {
    loggerWarnSpy.mockRestore();
  });

  describe('processScheduledPublishes', () => {
    it('publica los SCHEDULED vencidos, audita publish y reporta publishOk', async () => {
      mockPrisma.product.findMany.mockResolvedValue([
        { id: 'p1', sku: 'CAM-SCH', name: 'Cámara Programada' },
      ]);
      mockPrisma.product.findUnique.mockResolvedValue(scheduledProduct());
      mockPrisma.price.count.mockResolvedValue(1);
      mockPrisma.productImage.count.mockResolvedValue(1);
      mockPrisma.stock.findUnique.mockResolvedValue(null);
      mockPrisma.product.update.mockResolvedValue(scheduledProduct({ lifecycleStatus: 'PUBLISHED' }));

      const result = await service.handleLifecycleTick();

      expect(result.skipped).toBe(false);
      expect(result.publishOk).toBe(1);
      expect(result.publishFailed).toHaveLength(0);
      // Query candidata condicional: solo SCHEDULED con publishAt <= now.
      expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            lifecycleStatus: 'SCHEDULED',
            publishAt: { lte: expect.any(Date) },
          }),
        }),
      );
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'publish', entity: 'Product', entityId: 'p1' }),
      );
      expect(mockPrisma.product.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'p1' },
          data: expect.objectContaining({ lifecycleStatus: 'PUBLISHED' }),
        }),
      );
    });

    it('checklist fallido → NO cambia estado, registra warn y cuenta en publishFailed', async () => {
      mockPrisma.product.findMany.mockResolvedValue([
        { id: 'p1', sku: 'CAM-SCH', name: 'Cámara Programada' },
      ]);
      mockPrisma.product.findUnique.mockResolvedValue(scheduledProduct({ isActive: false }));
      // Lista archivada + sin precios ni imágenes: fallan (a),(b),(c),(d).
      mockPrisma.lista.findUnique.mockResolvedValue({ id: 'lista-1', isActive: true, archivedAt: new Date() });
      mockPrisma.price.count.mockResolvedValue(0);
      mockPrisma.productImage.count.mockResolvedValue(0);
      mockPrisma.stock.findUnique.mockResolvedValue(null);

      const result = await service.processScheduledPublishes();

      expect(result.publishOk).toBe(0);
      expect(result.publishFailed).toHaveLength(1);
      expect(result.publishFailed[0].id).toBe('p1');
      expect(result.publishFailed[0].reasons).toMatch(/lista destino|no está activo|precio vigente|imagen/);
      expect(mockPrisma.product.update).not.toHaveBeenCalled();
      expect(loggerWarnSpy).toHaveBeenCalledWith(expect.stringContaining('[scheduler]'));
    });

    it('no procesa productos con publishAt futuro (query condicional excluye)', async () => {
      mockPrisma.product.findMany.mockResolvedValue([]);

      const result = await service.processScheduledPublishes();

      expect(result.publishOk).toBe(0);
      expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            lifecycleStatus: 'SCHEDULED',
            publishAt: { lte: expect.any(Date) },
          }),
        }),
      );
      expect(mockPrisma.product.update).not.toHaveBeenCalled();
    });

    it('idempotencia: un producto ya publicado no se vuelve a procesar en el siguiente tick', async () => {
      mockPrisma.product.findMany
        .mockResolvedValueOnce([{ id: 'p1', sku: 'CAM-SCH', name: 'Cámara Programada' }]) // tick 1
        .mockResolvedValueOnce([]); // tick 2: ya no es SCHEDULED (publishAt null), no matchea
      mockPrisma.product.findUnique.mockResolvedValue(scheduledProduct());
      mockPrisma.price.count.mockResolvedValue(1);
      mockPrisma.productImage.count.mockResolvedValue(1);
      mockPrisma.stock.findUnique.mockResolvedValue(null);
      mockPrisma.product.update.mockResolvedValue(scheduledProduct({ lifecycleStatus: 'PUBLISHED' }));

      const first = await service.handleLifecycleTick();
      const second = await service.handleLifecycleTick();

      expect(first.publishOk).toBe(1);
      expect(second.publishOk).toBe(0);
      // Solo un update (la doble ejecución no pisa: la query condicional no lo re-pickea).
      expect(mockPrisma.product.update).toHaveBeenCalledTimes(1);
      expect(mockAudit.log).toHaveBeenCalledTimes(1);
    });
  });

  describe('processAutoUnpublishes', () => {
    it('despublica PUBLISHED con unpublishAt vencido (reason auto + audit unpublish)', async () => {
      mockPrisma.product.findMany.mockResolvedValue([
        { id: 'p1', sku: 'CAM-SCH', name: 'Cámara Programada' },
      ]);
      mockPrisma.product.findUnique.mockResolvedValue(
        scheduledProduct({ lifecycleStatus: 'PUBLISHED', publishStatus: 'publicado', unpublishAt: new Date(Date.now() - 1000) }),
      );
      mockPrisma.product.update.mockResolvedValue(
        scheduledProduct({ lifecycleStatus: 'DRAFT', publishStatus: 'borrador', unpublishReason: 'auto' }),
      );

      const result = await service.handleLifecycleTick();

      expect(result.unpublishOk).toBe(1);
      expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            lifecycleStatus: 'PUBLISHED',
            unpublishAt: { lte: expect.any(Date) },
          }),
        }),
      );
      const data = mockPrisma.product.update.mock.calls[0][0].data;
      expect(data).toMatchObject({ lifecycleStatus: 'DRAFT', unpublishReason: 'auto' });
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'unpublish', entity: 'Product', entityId: 'p1' }),
      );
    });
  });

  describe('handleLifecycleTick — lock en memoria', () => {
    it('descarta el tick si el anterior aún corre (skipped: true, sin consultas)', async () => {
      (service as any).lifecycleTickRunning = true;

      const result = await service.handleLifecycleTick();

      expect(result.skipped).toBe(true);
      expect(mockPrisma.product.findMany).not.toHaveBeenCalled();
    });

    it('libera el lock al terminar (finally)', async () => {
      mockPrisma.product.findMany.mockResolvedValue([]);
      mockPrisma.product.findUnique.mockResolvedValue(null);

      await service.handleLifecycleTick();

      expect((service as any).lifecycleTickRunning).toBe(false);
    });
  });
});