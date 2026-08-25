import { createPrismaMock } from '../../__test__/mocks/prisma.mock';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';

const mockPrisma = createPrismaMock();

jest.mock('../../prisma/prisma.service', () => ({
  PrismaService: jest.fn().mockImplementation(() => mockPrisma),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { ProductsService } from './products.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AclService } from '../../common/acl/acl.service';
import { AuditService } from '../audit/audit.service';
import { LifecycleStatus } from './lifecycle.types';

const mockAudit = { log: jest.fn().mockResolvedValue(undefined) };

const mockAcl = {
  isSuperAdmin: jest.fn().mockReturnValue(false),
  isListasAdmin: jest.fn().mockReturnValue(false),
  levelsAtLeast: jest.fn().mockReturnValue(['manage']),
  getAllowedListaIds: jest.fn().mockResolvedValue([]),
  getUserLevel: jest.fn().mockResolvedValue(null),
  assertListaAccess: jest.fn().mockResolvedValue(undefined),
  assertProductAccess: jest.fn().mockResolvedValue({ listaId: 'lista-1' }),
  assertPriceAccess: jest.fn().mockResolvedValue(undefined),
  can: jest.fn().mockResolvedValue(true),
};

/** Producto base con estado FSM + columnas legacy (dual-write). */
function mkProduct(status: LifecycleStatus, overrides: Record<string, any> = {}) {
  const legacyByStatus: Record<LifecycleStatus, Record<string, any>> = {
    DRAFT: { isActive: true, isVisible: false, publishStatus: 'borrador', publishAt: null, publishedAt: null, unpublishAt: null },
    READY: { isActive: true, isVisible: false, publishStatus: 'listo', publishAt: null, publishedAt: null, unpublishAt: null },
    SCHEDULED: { isActive: true, isVisible: false, publishStatus: 'listo', publishAt: new Date(Date.now() + 86400000), publishedAt: null, unpublishAt: null },
    PUBLISHED: { isActive: true, isVisible: true, publishStatus: 'publicado', publishAt: null, publishedAt: new Date(), unpublishAt: null },
    HIDDEN: { isActive: true, isVisible: false, publishStatus: 'publicado', publishAt: null, publishedAt: new Date(), unpublishAt: null },
    DISCONTINUED: { isActive: false, isVisible: true, publishStatus: 'publicado', publishAt: null, publishedAt: new Date(), unpublishAt: null },
    ARCHIVED: { isActive: false, isVisible: false, publishStatus: 'archivado', publishAt: null, publishedAt: null, unpublishAt: null },
  };
  return {
    id: 'prod-1',
    sku: 'CAM-001',
    name: 'Cámara IP',
    description: 'Cámara de seguridad',
    categoryId: 'cat-1',
    brandId: 'brand-1',
    listaId: 'lista-1',
    technicalSpecs: {},
    lifecycleStatus: status,
    unpublishReason: null,
    publishedById: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...legacyByStatus[status],
    ...overrides,
  };
}

/** Mockea el checklist de publicación como cumplido. */
function mockPublishChecklistOk() {
  mockPrisma.lista.findUnique.mockResolvedValue({ id: 'lista-1', isActive: true, archivedAt: null });
  mockPrisma.price.count.mockResolvedValue(1);
  mockPrisma.productImage.count.mockResolvedValue(1);
  mockPrisma.stock.findUnique.mockResolvedValue(null);
}

const FUTURE = () => new Date(Date.now() + 86400000).toISOString();

describe('ProductsService — FSM ciclo de vida (Etapa 2)', () => {
  let service: ProductsService;

  beforeEach(async () => {
    jest.resetAllMocks();

    mockAcl.isListasAdmin.mockReturnValue(false);
    mockAcl.assertProductAccess.mockResolvedValue({ listaId: 'lista-1' });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AclService, useValue: mockAcl },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
  });

  describe('transiciones válidas (matriz desde → evento → hacia)', () => {
    async function expectTransition(status: LifecycleStatus, dto: any, nextStatus: LifecycleStatus) {
      const product = mkProduct(status);
      mockPrisma.product.findUnique.mockResolvedValue(product);
      mockPrisma.product.update.mockResolvedValue({ ...product, lifecycleStatus: nextStatus });
      const result = await service.transition('prod-1', dto);
      expect(result.lifecycleStatus).toBe(nextStatus);
      return mockPrisma.product.update.mock.calls[0][0].data;
    }

    it('PREPARE: DRAFT → READY (dual-write: isActive true, publishStatus listo)', async () => {
      const data = await expectTransition('DRAFT', { event: 'PREPARE' }, 'READY');
      expect(data).toMatchObject({ lifecycleStatus: 'READY', isActive: true, publishStatus: 'listo', publishAt: null });
    });

    it('SCHEDULE: READY → SCHEDULED con publishAt futuro (checklist ok)', async () => {
      mockPublishChecklistOk();
      const data = await expectTransition('READY', { event: 'SCHEDULE', publishAt: FUTURE() }, 'SCHEDULED');
      expect(data).toMatchObject({ lifecycleStatus: 'SCHEDULED', isActive: true, publishStatus: 'listo' });
      expect(new Date(data.publishAt).getTime()).toBeGreaterThan(Date.now());
      expect(mockAudit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'schedule_publish' }));
    });

    it('CANCEL_SCHEDULE: SCHEDULED → DRAFT', async () => {
      const data = await expectTransition('SCHEDULED', { event: 'CANCEL_SCHEDULE' }, 'DRAFT');
      expect(data).toMatchObject({ lifecycleStatus: 'DRAFT', isActive: true, publishStatus: 'borrador' });
    });

    it('PUBLISH: DRAFT → PUBLISHED (dual-write: visible + publicado + publishedAt)', async () => {
      mockPublishChecklistOk();
      const data = await expectTransition('DRAFT', { event: 'PUBLISH' }, 'PUBLISHED');
      expect(data).toMatchObject({ lifecycleStatus: 'PUBLISHED', isActive: true, isVisible: true, publishStatus: 'publicado' });
      expect(mockAudit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'publish' }));
    });

    it('HIDE: PUBLISHED → HIDDEN (isVisible false, publishStatus conservado publicado)', async () => {
      const data = await expectTransition('PUBLISHED', { event: 'HIDE' }, 'HIDDEN');
      expect(data).toMatchObject({ lifecycleStatus: 'HIDDEN', isVisible: false, publishStatus: 'publicado' });
      expect(mockAudit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'hide' }));
    });

    it('SHOW: HIDDEN → PUBLISHED (isVisible true)', async () => {
      const data = await expectTransition('HIDDEN', { event: 'SHOW' }, 'PUBLISHED');
      expect(data).toMatchObject({ lifecycleStatus: 'PUBLISHED', isActive: true, isVisible: true, publishStatus: 'publicado' });
      expect(mockAudit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'show' }));
    });

    it('UNPUBLISH: PUBLISHED → DRAFT con razón (audit unpublish)', async () => {
      const data = await expectTransition('PUBLISHED', { event: 'UNPUBLISH', reason: 'Campaña finalizada' }, 'DRAFT');
      expect(data).toMatchObject({ lifecycleStatus: 'DRAFT', publishStatus: 'borrador', unpublishReason: 'Campaña finalizada' });
      expect(mockAudit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'unpublish' }));
    });

    it('DISCONTINUE: PUBLISHED → DISCONTINUED (isActive false, publishStatus conservado)', async () => {
      const data = await expectTransition('PUBLISHED', { event: 'DISCONTINUE', reason: 'Fin de línea' }, 'DISCONTINUED');
      expect(data).toMatchObject({ lifecycleStatus: 'DISCONTINUED', isActive: false, publishStatus: 'publicado' });
      expect(mockAudit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'discontinue' }));
    });

    it('REACTIVATE (P1): DISCONTINUED con publishStatus publicado → PUBLISHED SIN tocar publishedAt', async () => {
      const publishedAt = new Date('2026-01-01T00:00:00Z');
      mockPrisma.product.findUnique.mockResolvedValue(mkProduct('DISCONTINUED', { publishedAt }));
      mockPrisma.product.update.mockResolvedValue(mkProduct('PUBLISHED', { publishedAt }));
      const result = await service.transition('prod-1', { event: 'REACTIVATE' });
      const data = mockPrisma.product.update.mock.calls[0][0].data;
      expect(result.lifecycleStatus).toBe('PUBLISHED');
      expect(data).toMatchObject({ lifecycleStatus: 'PUBLISHED', isActive: true, isVisible: true, publishStatus: 'publicado' });
      expect(data).not.toHaveProperty('publishedAt'); // P1: no se toca el publishedAt existente
      expect(mockAudit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'reactivate' }));
    });

    it('REACTIVATE (P1): DISCONTINUED sin venir publicado → DRAFT', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(mkProduct('DISCONTINUED', { publishStatus: 'borrador' }));
      mockPrisma.product.update.mockResolvedValue(mkProduct('DRAFT'));
      const result = await service.transition('prod-1', { event: 'REACTIVATE' });
      const data = mockPrisma.product.update.mock.calls[0][0].data;
      expect(result.lifecycleStatus).toBe('DRAFT');
      expect(data).toMatchObject({ lifecycleStatus: 'DRAFT', isActive: true, publishStatus: 'borrador' });
    });

    it('ARCHIVE: PUBLISHED → ARCHIVED con motivo y confirm (isActive/isVisible false, archivado)', async () => {
      const data = await expectTransition('PUBLISHED', { event: 'ARCHIVE', reason: 'Baja definitiva', confirm: true }, 'ARCHIVED');
      expect(data).toMatchObject({ lifecycleStatus: 'ARCHIVED', isActive: false, isVisible: false, publishStatus: 'archivado' });
      expect(mockAudit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'archive' }));
    });

    it('RESTORE: ARCHIVED → DRAFT con motivo y confirm', async () => {
      const data = await expectTransition('ARCHIVED', { event: 'RESTORE', reason: 'Reactivación', confirm: true }, 'DRAFT');
      expect(data).toMatchObject({ lifecycleStatus: 'DRAFT', isActive: true, publishStatus: 'borrador' });
      expect(mockAudit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'restore' }));
    });
  });

  describe('transición inválida → 400 con mensaje claro', () => {
    it('UNPUBLISH desde DRAFT → 400', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(mkProduct('DRAFT'));
      await expect(service.transition('prod-1', { event: 'UNPUBLISH', reason: 'x' })).rejects.toThrow(
        /No se puede pasar de DRAFT a DRAFT con el evento UNPUBLISH/,
      );
    });

    it('PUBLISH desde DISCONTINUED → 400 (debe usarse REACTIVATE)', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(mkProduct('DISCONTINUED'));
      await expect(service.transition('prod-1', { event: 'PUBLISH' })).rejects.toThrow(
        /No se puede pasar de DISCONTINUED a PUBLISHED con el evento PUBLISH/,
      );
    });

    it('HIDE desde DRAFT → 400', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(mkProduct('DRAFT'));
      await expect(service.transition('prod-1', { event: 'HIDE' })).rejects.toThrow(BadRequestException);
    });

    it('SHOW desde PUBLISHED → 400', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(mkProduct('PUBLISHED'));
      await expect(service.transition('prod-1', { event: 'SHOW' })).rejects.toThrow(BadRequestException);
    });

    it('404 si el producto no existe', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(null);
      await expect(service.transition('no-existe', { event: 'PREPARE' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('guardas de datos → 400', () => {
    it('UNPUBLISH sin reason → 400', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(mkProduct('PUBLISHED'));
      await expect(service.transition('prod-1', { event: 'UNPUBLISH' })).rejects.toThrow(/requiere un motivo/);
    });

    it('DISCONTINUE sin reason → 400', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(mkProduct('PUBLISHED'));
      await expect(service.transition('prod-1', { event: 'DISCONTINUE' })).rejects.toThrow(/requiere un motivo/);
    });

    it('ARCHIVE sin reason → 400', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(mkProduct('PUBLISHED'));
      await expect(service.transition('prod-1', { event: 'ARCHIVE', confirm: true })).rejects.toThrow(/requiere un motivo/);
    });

    it('ARCHIVE sin confirm → 400', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(mkProduct('PUBLISHED'));
      await expect(service.transition('prod-1', { event: 'ARCHIVE', reason: 'x' })).rejects.toThrow(/requiere confirmación/);
    });

    it('RESTORE sin confirm → 400', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(mkProduct('ARCHIVED'));
      await expect(service.transition('prod-1', { event: 'RESTORE', reason: 'x' })).rejects.toThrow(/requiere confirmación/);
    });

    it('SCHEDULE sin publishAt → 400', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(mkProduct('DRAFT'));
      await expect(service.transition('prod-1', { event: 'SCHEDULE' })).rejects.toThrow(/requiere publishAt/);
    });

    it('SCHEDULE con publishAt en el pasado → 400', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(mkProduct('DRAFT'));
      await expect(
        service.transition('prod-1', { event: 'SCHEDULE', publishAt: new Date(Date.now() - 1000).toISOString() }),
      ).rejects.toThrow(/publishAt debe ser una fecha futura/);
    });
  });

  describe('RBAC → 403', () => {
    const OPERADOR = { userId: 'u1', roles: ['Operador'] };

    it('PREPARE con Operador (sin products:write) → 403', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(mkProduct('DRAFT'));
      await expect(service.transition('prod-1', { event: 'PREPARE' }, OPERADOR)).rejects.toThrow(ForbiddenException);
    });

    it('PUBLISH con Operador (sin publish:manage) → 403', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(mkProduct('DRAFT'));
      await expect(service.transition('prod-1', { event: 'PUBLISH' }, OPERADOR)).rejects.toThrow(ForbiddenException);
    });

    it('ARCHIVE con Supervisor (no Super Admin/Admin Comercial) → 403', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(mkProduct('PUBLISHED'));
      await expect(
        service.transition('prod-1', { event: 'ARCHIVE', reason: 'x', confirm: true }, { userId: 'u2', roles: ['Supervisor'] }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('ACL → 403', () => {
    it('PUBLISH con rol válido pero sin nivel ACL manage → 403', async () => {
      mockAcl.assertProductAccess.mockRejectedValue(new ForbiddenException('No tienes permisos suficientes sobre esta Lista'));
      mockPrisma.product.findUnique.mockResolvedValue(mkProduct('DRAFT'));
      await expect(
        service.transition('prod-1', { event: 'PUBLISH' }, { userId: 'u1', roles: ['Super Admin'] }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('SCHEDULED_PUBLISH (evento interno del scheduler, P6)', () => {
    it('rechazado por la API pública (transition) → 400', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(mkProduct('SCHEDULED'));
      await expect(service.transition('prod-1', { event: 'SCHEDULED_PUBLISH' })).rejects.toThrow(
        /SCHEDULED_PUBLISH es interno del scheduler/,
      );
    });

    it('applyScheduledPublish: SCHEDULED → PUBLISHED re-validando checklist (audit publish)', async () => {
      mockPublishChecklistOk();
      mockPrisma.product.findUnique.mockResolvedValue(mkProduct('SCHEDULED'));
      mockPrisma.product.update.mockResolvedValue(mkProduct('PUBLISHED'));

      const result = await service.applyScheduledPublish('prod-1');

      expect(result.lifecycleStatus).toBe('PUBLISHED');
      const data = mockPrisma.product.update.mock.calls[0][0].data;
      expect(data).toMatchObject({ lifecycleStatus: 'PUBLISHED', isVisible: true, publishStatus: 'publicado' });
      expect(mockAudit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'publish' }));
    });
  });

  describe('allowedActions(product, ctx)', () => {
    const SA = { userId: 'admin', roles: ['Super Admin'] };
    const OPERADOR = { userId: 'op', roles: ['Operador'] };
    const SUPERVISOR = { userId: 'sup', roles: ['Supervisor'] };

    it('DRAFT + Super Admin → PREPARE, SCHEDULE, PUBLISH, DISCONTINUE, ARCHIVE', async () => {
      const allowed = await service.allowedActions(mkProduct('DRAFT'), SA);
      expect(allowed).toEqual(expect.arrayContaining(['PREPARE', 'SCHEDULE', 'PUBLISH', 'DISCONTINUE', 'ARCHIVE']));
      expect(allowed).toHaveLength(5);
    });

    it('DRAFT + Operador → [] (sin RBAC)', async () => {
      const allowed = await service.allowedActions(mkProduct('DRAFT'), OPERADOR);
      expect(allowed).toEqual([]);
    });

    it('PUBLISHED + Super Admin → HIDE, UNPUBLISH, DISCONTINUE, ARCHIVE', async () => {
      const allowed = await service.allowedActions(mkProduct('PUBLISHED'), SA);
      expect(allowed).toEqual(['HIDE', 'UNPUBLISH', 'DISCONTINUE', 'ARCHIVE']);
    });

    it('PUBLISHED + Supervisor → solo HIDE/UNPUBLISH (publish:manage, sin products:write)', async () => {
      const allowed = await service.allowedActions(mkProduct('PUBLISHED'), SUPERVISOR);
      expect(allowed).toEqual(['HIDE', 'UNPUBLISH']);
    });

    it('HIDDEN + Super Admin → SHOW, UNPUBLISH, DISCONTINUE, ARCHIVE', async () => {
      const allowed = await service.allowedActions(mkProduct('HIDDEN'), SA);
      expect(allowed).toEqual(['SHOW', 'UNPUBLISH', 'DISCONTINUE', 'ARCHIVE']);
    });

    it('DISCONTINUED + Super Admin → REACTIVATE, ARCHIVE', async () => {
      const allowed = await service.allowedActions(mkProduct('DISCONTINUED'), SA);
      expect(allowed).toEqual(['REACTIVATE', 'ARCHIVE']);
    });

    it('ARCHIVED + Super Admin → RESTORE', async () => {
      const allowed = await service.allowedActions(mkProduct('ARCHIVED'), SA);
      expect(allowed).toEqual(['RESTORE']);
    });

    it('DRAFT + Super Admin sin ACL suficiente → []', async () => {
      mockAcl.assertProductAccess.mockRejectedValue(new ForbiddenException('Acceso restringido'));
      const allowed = await service.allowedActions(mkProduct('DRAFT'), SA);
      expect(allowed).toEqual([]);
    });

    it('sin ctx → []', async () => {
      const allowed = await service.allowedActions(mkProduct('DRAFT'));
      expect(allowed).toEqual([]);
    });
  });

  describe('bulkTransition(ids, dto, ctx)', () => {
    it('aplica a los válidos y rechaza los inválidos (applied/rejected)', async () => {
      mockPublishChecklistOk();
      // prod-ok: DRAFT → PUBLISHED válido; prod-bad: DISCONTINUED → PUBLISH inválido.
      mockPrisma.product.findUnique
        .mockResolvedValueOnce(mkProduct('DRAFT', { id: 'prod-ok' }))
        .mockResolvedValueOnce(mkProduct('DISCONTINUED', { id: 'prod-bad' }));
      mockPrisma.product.update.mockResolvedValue(mkProduct('PUBLISHED', { id: 'prod-ok' }));

      const result = await service.bulkTransition(['prod-ok', 'prod-bad'], { event: 'PUBLISH' });

      expect(result.applied).toEqual([{ id: 'prod-ok', lifecycleStatus: 'PUBLISHED' }]);
      expect(result.rejected).toHaveLength(1);
      expect(result.rejected[0].id).toBe('prod-bad');
      expect(result.rejected[0].reason).toMatch(/No se puede pasar de DISCONTINUED/);
    });

    it('producto inexistente va a rejected sin romper el lote', async () => {
      mockPublishChecklistOk();
      mockPrisma.product.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mkProduct('DRAFT', { id: 'prod-ok' }));
      mockPrisma.product.update.mockResolvedValue(mkProduct('PUBLISHED', { id: 'prod-ok' }));

      const result = await service.bulkTransition(['no-existe', 'prod-ok'], { event: 'PUBLISH' });

      expect(result.applied).toHaveLength(1);
      expect(result.rejected).toHaveLength(1);
      expect(result.rejected[0].id).toBe('no-existe');
    });
  });
});