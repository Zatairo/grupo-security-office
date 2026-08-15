import { createPrismaMock } from '../../__test__/mocks/prisma.mock';
import { randomUUID } from 'crypto';

import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { AclService } from '../../common/acl/acl.service';
import { ListasService } from './listas.service';
import { PrismaService } from '../../prisma/prisma.service';

type AnyMock = ReturnType<typeof createPrismaMock>;

const ADMIN = { userId: 'admin-1', roles: ['Super Admin'] };
const VIEWER = { userId: 'pepito-1', roles: ['Operador'] }; // view sobre LISTA-GENERAL
const EDITER = { userId: 'editer-1', roles: ['Admin Comercial'] }; // edit sobre LISTA-GENERAL
const MANAGER = { userId: 'manager-1', roles: ['Admin Comercial'] }; // manage sobre LISTA-GENERAL
const NOAUTH = { userId: 'none-1', roles: ['Operador'] }; // sin assignments

const LISTA_ID = 'list-1';
const OTHER_LISTA_ID = 'list-other';

const mockLista = {
  id: LISTA_ID,
  code: 'LISTA-GENERAL',
  name: 'Lista General',
  description: 'Raíz',
  currency: 'COP',
  isActive: true,
  archivedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  _count: { products: 3 },
};

const mockListaInactiva = { ...mockLista, isActive: false };
const mockListaArchivada = { ...mockLista, archivedAt: new Date() };
const mockOtherLista = { id: OTHER_LISTA_ID, code: 'OTHER', name: 'Otra', description: null, currency: 'COP', isActive: true, archivedAt: null, createdAt: new Date(), updatedAt: new Date(), _count: { products: 0 } };

// Assignments activos por usuario (resourceType LISTA).
const assignments: Record<
  string,
  { resourceType: string; resourceId: string; level: string; isActive: boolean }[]
> = {
  [VIEWER.userId]: [{ resourceType: 'LISTA', resourceId: LISTA_ID, level: 'view', isActive: true }],
  [EDITER.userId]: [{ resourceType: 'LISTA', resourceId: LISTA_ID, level: 'edit', isActive: true }],
  [MANAGER.userId]: [{ resourceType: 'LISTA', resourceId: LISTA_ID, level: 'manage', isActive: true }],
  [NOAUTH.userId]: [],
};

function buildPrisma(): AnyMock {
  const p = createPrismaMock();
  p.assignment.findMany.mockImplementation(async (args: any) => {
    const u = args?.where?.userId;
    const pool = u ? (assignments[u] ?? []) : Object.values(assignments).flat();
    const rt = args?.where?.resourceType;
    const rid = args?.where?.resourceId;
    const active = args?.where?.isActive;
    const levels = args?.where?.level?.in;
    let out = pool as any[];
    if (rid) out = out.filter((a) => a.resourceId === rid);
    if (rt) out = out.filter((a) => a.resourceType === rt);
    if (active === true) out = out.filter((a) => a.isActive);
    if (levels) out = out.filter((a) => levels.includes(a.level));
    return out;
  });
  p.lista.findUnique.mockImplementation(async (args: any) => {
    const id = args?.where?.id;
    if (id === LISTA_ID) return mockLista;
    if (id === 'inactive') return mockListaInactiva;
    if (id === 'archived') return mockListaArchivada;
    if (id === OTHER_LISTA_ID) return mockOtherLista;
    return null;
  });
  p.lista.findMany.mockResolvedValue([mockLista]);
  p.lista.count.mockResolvedValue(1);
  p.lista.update.mockImplementation(async (args: any) => {
    const id = args?.where?.id;
    const data = args?.data ?? {};
    const base = id === LISTA_ID ? mockLista : mockOtherLista;
    return { id, ...base, ...data, updatedAt: new Date() };
  });
  p.lista.create.mockImplementation(async (args: any) => ({
    id: randomUUID(),
    ...args.data,
    createdAt: new Date(),
    updatedAt: new Date(),
  }));
  p.product.findMany.mockResolvedValue([]);
  p.product.count.mockResolvedValue(0);
  p.price.findMany.mockResolvedValue([]);
  p.auditLog.findMany.mockResolvedValue([]);
  p.auditLog.count.mockResolvedValue(0);
  return p;
}

describe('ListasService — ACL (T1–T20)', () => {
  let service: ListasService;
  let acl: AclService;
  let mockPrisma: AnyMock;
  let mockAudit: { log: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma = buildPrisma();
    mockAudit = { log: jest.fn().mockResolvedValue({}) };
    acl = new AclService(mockPrisma as any);
    service = new ListasService(mockPrisma as any, acl, mockAudit as any);
  });

  // T1: Super Admin sin assignment ve todas las Listas
  it('T1 - Super Admin lista todas las Listas (sin consultar assignments)', async () => {
    mockPrisma.lista.findMany.mockResolvedValue([mockLista, mockOtherLista]);
    const res = await service.findAll(ADMIN);
    expect(res.data).toHaveLength(2);
    expect(mockPrisma.assignment.findMany).not.toHaveBeenCalled();
  });

  // T2: Super Admin accede a una Lista por ID
  it('T2 - Super Admin accede a Lista por ID', async () => {
    mockPrisma.lista.findUnique.mockResolvedValue(mockLista);
    const res = await service.findOne(LISTA_ID, ADMIN);
    expect(res.id).toBe(LISTA_ID);
    expect(mockPrisma.assignment.findMany).not.toHaveBeenCalled();
  });

  // T3: Usuario sin assignment → lista vacía (deny)
  it('T3 - usuario sin assignment ve lista vacía (deny-by-default)', async () => {
    mockPrisma.lista.findMany.mockResolvedValue([]);
    const res = await service.findAll(NOAUTH);
    expect(res.data).toHaveLength(0);
    expect(mockPrisma.assignment.findMany).toHaveBeenCalled();
  });

  // T4: Usuario sin assignment → 404 al obtener una Lista por ID
  it('T4 - usuario sin assignment recibe 404 por Lista ajena', async () => {
    await expect(service.findOne(LISTA_ID, NOAUTH)).rejects.toThrow(NotFoundException);
  });

  // T5/T6: Usuario view → ve solo su Lista
  it('T5/T6 - usuario view ve su Lista y 404 para Lista ajena', async () => {
    mockPrisma.lista.findUnique.mockResolvedValueOnce(mockLista);
    const own = await service.findOne(LISTA_ID, VIEWER);
    expect(own.id).toBe(LISTA_ID);

    mockPrisma.lista.findUnique.mockResolvedValueOnce(mockOtherLista);
    await expect(service.findOne(OTHER_LISTA_ID, VIEWER)).rejects.toThrow(NotFoundException);
  });

  // T7:Usuario view no puede crear Lista
  it('T7 - usuario view no crea Lista (403)', async () => {
    await expect(service.create({ code: 'X', name: 'X' }, VIEWER)).rejects.toThrow(ForbiddenException);
  });

  // T8: usuario view no edita Lista (403)
  it('T8 - usuario view no edita Lista (403)', async () => {
    mockPrisma.lista.findUnique.mockResolvedValueOnce(mockLista);
    await expect(service.update(LISTA_ID, { name: 'Nuevo' }, VIEWER)).rejects.toThrow(
      ForbiddenException,
    );
  });

  // T9: usuario edit puede editar Lista
  it('T9 - usuario edit edita Lista', async () => {
    mockPrisma.lista.findUnique.mockResolvedValueOnce(mockLista);
    const res = await service.update(LISTA_ID, { name: 'Nuevo' }, EDITER);
    expect(res.name).toBe('Nuevo');
  });

  // T11: usuario edit no archivo (403)
  it('T11 - usuario edit no archiva Lista (403)', async () => {
    await expect(service.archive(LISTA_ID, EDITER)).rejects.toThrow(ForbiddenException);
  });

  // T12: usuario manage archivo/restaura
  it('T12 - usuario manage archivo y restaura', async () => {
    mockPrisma.lista.findUnique.mockResolvedValueOnce(mockLista);
    const archived = await service.archive(LISTA_ID, MANAGER);
    expect(archived.archivedAt).toBeDefined();

    mockPrisma.lista.findUnique.mockResolvedValueOnce({ ...mockLista, archivedAt: new Date() });
    const restored = await service.restore(LISTA_ID, MANAGER);
    expect(restored.archivedAt).toBeNull();
  });

  // T13: usuario manage gestiona accesos (findAssignments)
  it('T13 - usuario manage ve accesos de su Lista', async () => {
    const res = await service.findAssignments(LISTA_ID, MANAGER);
    // Un manager ve todas las asignaciones de su Lista (>= 1).
    expect(res.data.length).toBeGreaterThanOrEqual(1);
    expect(res.data.every((a) => a.resourceId === LISTA_ID)).toBe(true);
  });

  // T14: usuario manage 404 sobre Lista no asignada
  it('T14 - usuario manage 404 sobre Lista no asignada', async () => {
    await expect(service.findOne(OTHER_LISTA_ID, MANAGER)).rejects.toThrow(NotFoundException);
  });

  // T16: assignment inactivo no autoriza
  it('T16 - assignment inactivo no autoriza (deny)', async () => {
    // Forzar assignment inactivo para VIEWER
    assignments[VIEWER.userId] = [{ resourceType: 'LISTA', resourceId: LISTA_ID, level: 'view', isActive: false }];
    await expect(service.findOne(LISTA_ID, VIEWER)).rejects.toThrow(NotFoundException);
  });

  // T17: Lista inactiva → 404 para no-admin
  it('T17 - Lista inactiva → 404 para usuario no-admin', async () => {
    mockPrisma.lista.findUnique.mockImplementation(async (args: any) => {
      if (args?.where?.id === LISTA_ID) return mockListaInactiva;
      return null;
    });
    await expect(service.findOne(LISTA_ID, VIEWER)).rejects.toThrow(NotFoundException);
  });

  // T18: Lista archivada → 404 para no-admin
  it('T18 - Lista archivada → 404 para usuario no-admin', async () => {
    mockPrisma.lista.findUnique.mockImplementation(async (args: any) => {
      if (args?.where?.id === LISTA_ID) return mockListaArchivada;
      return null;
    });
    await expect(service.findOne(LISTA_ID, VIEWER)).rejects.toThrow(NotFoundException);
  });

  // T1/T2 refuerzo: Super Admin ve Lista inactiva/archivada
  it('Super Admin ve Lista inactiva/archivada', async () => {
    mockPrisma.lista.findUnique.mockResolvedValueOnce(mockListaInactiva);
    const res = await service.findOne(LISTA_ID, ADMIN);
    expect(res.id).toBe(LISTA_ID);
  });

  // T19/T20: acceso directo por producto/precio no salta ACL (products service)
  it('T19 - producto de Lista no asignada → 404 (via acl.assertProductAccess)', async () => {
    mockPrisma.product.findUnique.mockResolvedValueOnce({ listaId: LISTA_ID });
    await expect(
      acl.assertProductAccess('prod-x', NOAUTH, 'view'),
    ).rejects.toThrow(NotFoundException);
  });

  // Validaciones de creación
  it('crea Lista con moneda y estado válidos (Super Admin)', async () => {
    const res = await service.create({ code: 'NUEVA', name: 'Lista Nueva', currency: 'USD', isActive: true }, ADMIN);
    expect(res.code).toBe('NUEVA');
    expect(res.currency).toBe('USD');
    expect(mockPrisma.lista.create).toHaveBeenCalled();
    expect(mockAudit.log).toHaveBeenCalled();
  });

  it('rechaza código de Lista duplicado (Super Admin)', async () => {
    mockPrisma.lista.findUnique.mockResolvedValueOnce({ id: 'dup' });
    await expect(
      service.create({ code: 'LISTA-GENERAL', name: 'X' }, ADMIN),
    ).rejects.toThrow(ConflictException);
  });

  // ---- Campos nuevos (type, defaultVisibility, responsibleId, validFrom, validUntil) ----

  it('crea Lista con type/defaultVisibility/validFrom/validUntil y los persiste', async () => {
    const res = await service.create(
      {
        code: 'NEW-FIELDS',
        name: 'Lista Campos',
        type: 'COMERCIAL',
        defaultVisibility: true,
        validFrom: '2026-01-01T00:00:00Z',
        validUntil: '2026-12-31T23:59:59Z',
      },
      ADMIN,
    );
    expect(res.type).toBe('COMERCIAL');
    expect(res.defaultVisibility).toBe(true);
    expect(res.validFrom).toBeInstanceOf(Date);
    expect(res.validUntil).toBeInstanceOf(Date);
    expect(mockPrisma.lista.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'COMERCIAL',
          defaultVisibility: true,
          validFrom: expect.any(Date),
          validUntil: expect.any(Date),
        }),
      }),
    );
  });

  it('crea Lista con responsibleId existente (valida usuario)', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: 'user-responsible' });
    const res = await service.create(
      { code: 'RESP', name: 'Lista Resp', responsibleId: 'user-responsible' },
      ADMIN,
    );
    expect(res.responsibleId).toBe('user-responsible');
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-responsible' },
      select: { id: true },
    });
  });

  it('crea Lista con responsibleId inexistente → 404', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(null);
    await expect(
      service.create({ code: 'RESP-BAD', name: 'X', responsibleId: 'no-existe' }, ADMIN),
    ).rejects.toThrow(NotFoundException);
  });

  it('crea Lista con vigencias inválidas (validUntil < validFrom) → 400', async () => {
    await expect(
      service.create(
        { code: 'BAD-DATES', name: 'X', validFrom: '2026-12-31', validUntil: '2026-01-01' },
        ADMIN,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('update persiste type/defaultVisibility/responsibleId/vigencias y audita old/new', async () => {
    mockPrisma.lista.findUnique.mockResolvedValueOnce(mockLista);
    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: 'user-responsible' });
    const res = await service.update(
      LISTA_ID,
      {
        type: 'PROMOCIONAL',
        defaultVisibility: true,
        responsibleId: 'user-responsible',
        validFrom: '2026-01-01T00:00:00Z',
        validUntil: '2026-12-31T23:59:59Z',
      },
      EDITER,
    );
    expect(res.type).toBe('PROMOCIONAL');
    expect(res.defaultVisibility).toBe(true);
    expect(res.responsibleId).toBe('user-responsible');
    expect(mockAudit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        oldValues: expect.objectContaining({
          type: mockLista.type,
          defaultVisibility: mockLista.defaultVisibility,
          responsibleId: mockLista.responsibleId,
          validFrom: mockLista.validFrom,
          validUntil: mockLista.validUntil,
        }),
        newValues: expect.objectContaining({
          type: 'PROMOCIONAL',
          defaultVisibility: true,
          responsibleId: 'user-responsible',
          validFrom: expect.any(Date),
          validUntil: expect.any(Date),
        }),
      }),
    );
  });

  it('update con validUntil < validFrom → error de validación (400)', async () => {
    mockPrisma.lista.findUnique.mockResolvedValueOnce(mockLista);
    await expect(
      service.update(LISTA_ID, { validFrom: '2026-12-31', validUntil: '2026-01-01' }, EDITER),
    ).rejects.toThrow(BadRequestException);
  });

  // ---- Cobertura complementaria (reemplaza ACL de la entidad Catalog eliminada) ----
  // El test T16 muta assignments[VIEWER.userId] a inactivo; se restaura por suite.
  describe('cobertura complementaria (reemplaza entidad Catalog eliminada)', () => {
    beforeEach(() => {
      assignments[VIEWER.userId] = [{ resourceType: 'LISTA', resourceId: LISTA_ID, level: 'view', isActive: true }];
    });

    it('findAll filtra por isActive=true', async () => {
      mockPrisma.lista.findMany.mockResolvedValue([mockLista]);

      await service.findAll(VIEWER, { isActive: true });

      expect(mockPrisma.lista.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isActive: true, id: { in: [LISTA_ID] } }),
        }),
      );
    });

    it('findProducts scopea por listaId y aplica search/categoryId', async () => {
      mockPrisma.product.findMany.mockResolvedValue([{ id: 'prod-1', sku: 'S', name: 'Cam' }]);

      const res = await service.findProducts(LISTA_ID, VIEWER, { search: 'cam', categoryId: 'cat-1' });

      expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            listaId: LISTA_ID,
            categoryId: 'cat-1',
            OR: expect.any(Array),
          }),
        }),
      );
      expect(res.data).toHaveLength(1);
    });

    it('findPrices scopea precios por la Lista del producto', async () => {
      mockPrisma.price.findMany.mockResolvedValue([{ id: 'price-1', value: 1000 }]);

      const res = await service.findPrices(LISTA_ID, VIEWER);

      expect(mockPrisma.price.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ product: expect.objectContaining({ listaId: LISTA_ID }) }),
        }),
      );
      expect(res.data).toHaveLength(1);
    });

    it('findAssignments exige manage (403 para view)', async () => {
      await expect(service.findAssignments(LISTA_ID, VIEWER)).rejects.toThrow(ForbiddenException);
    });

    it('findAudit exige manage (403 para view)', async () => {
      await expect(service.findAudit(LISTA_ID, VIEWER)).rejects.toThrow(ForbiddenException);
    });

    it('update con archivedAt requiere manage (403 para edit)', async () => {
      mockPrisma.lista.findUnique.mockResolvedValueOnce(mockLista);
      await expect(
        service.update(LISTA_ID, { archivedAt: '2026-01-01T00:00:00Z' }, EDITER),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('vigencias calculadas (OLA 6)', () => {
    it('findOne añade isExpired/isExpiringSoon/daysUntilExpiry (vence en 10 días)', async () => {
      const validUntil = new Date(Date.now() + 10 * 86400000);
      mockPrisma.lista.findUnique.mockResolvedValueOnce({ ...mockLista, validUntil });
      const res = await service.findOne(LISTA_ID, ADMIN);
      expect(res.isExpired).toBe(false);
      expect(res.isExpiringSoon).toBe(true);
      expect(res.daysUntilExpiry).toBe(10);
    });

    it('findOne marca vencida una Lista con validUntil en el pasado', async () => {
      const validUntil = new Date(Date.now() - 2 * 86400000);
      mockPrisma.lista.findUnique.mockResolvedValueOnce({ ...mockLista, validUntil });
      const res = await service.findOne(LISTA_ID, ADMIN);
      expect(res.isExpired).toBe(true);
      expect(res.isExpiringSoon).toBe(false);
      expect(res.daysUntilExpiry).toBeLessThan(0);
    });

    it('findOne sin validUntil → no vencida y daysUntilExpiry null', async () => {
      mockPrisma.lista.findUnique.mockResolvedValueOnce(mockLista);
      const res = await service.findOne(LISTA_ID, ADMIN);
      expect(res.isExpired).toBe(false);
      expect(res.isExpiringSoon).toBe(false);
      expect(res.daysUntilExpiry).toBeNull();
    });

    it('findAll mapea los campos calculados en cada Lista', async () => {
      const validUntil = new Date(Date.now() + 40 * 86400000);
      mockPrisma.lista.findMany.mockResolvedValue([{ ...mockLista, validUntil }]);
      const res = await service.findAll(ADMIN);
      expect(res.data[0].productCount).toBe(3);
      expect(res.data[0].isExpired).toBe(false);
      expect(res.data[0].isExpiringSoon).toBe(false);
      expect(res.data[0].daysUntilExpiry).toBe(40);
    });
  });

  describe('findExpiringPrices (OLA 6)', () => {
    it('devuelve precios próximos a vencer con daysRemaining y respeta ventana', async () => {
      const validUntil = new Date(Date.now() + 10 * 86400000);
      mockPrisma.price.findMany.mockResolvedValueOnce([
        {
          id: 'price-1',
          productId: 'prod-1',
          priceListId: 'pl-1',
          listaId: LISTA_ID,
          value: 1000,
          currency: 'COP',
          validFrom: null,
          validUntil,
          createdAt: new Date(),
          updatedAt: new Date(),
          product: { id: 'prod-1', sku: 'SKU1', name: 'Camara' },
          priceList: { id: 'pl-1', name: 'Lista General', code: 'LG' },
        },
      ]);

      const res = await service.findExpiringPrices(LISTA_ID, VIEWER, 30);

      expect(mockPrisma.price.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            listaId: LISTA_ID,
            validUntil: { not: null, lte: expect.any(Date), gte: expect.any(Date) },
          },
        }),
      );
      expect(res.count).toBe(1);
      expect(res.days).toBe(30);
      expect(res.data[0].daysRemaining).toBe(10);
      expect(res.data[0].product.name).toBe('Camara');
    });

    it('no devuelve precios ya vencidos (validUntil >= now en la query)', async () => {
      mockPrisma.price.findMany.mockResolvedValueOnce([]);

      const res = await service.findExpiringPrices(LISTA_ID, VIEWER, 30);

      const where = mockPrisma.price.findMany.mock.calls[0][0].where;
      const gte = (where.validUntil.gte as Date).getTime();
      expect(gte).toBeLessThanOrEqual(Date.now() + 1000);
      expect(where.validUntil.not).toBeNull();
      expect(res.data).toHaveLength(0);
      expect(res.count).toBe(0);
    });

    it('sin precios → data vacía, count 0', async () => {
      mockPrisma.price.findMany.mockResolvedValueOnce([]);
      const res = await service.findExpiringPrices(LISTA_ID, VIEWER);
      expect(res.data).toEqual([]);
      expect(res.count).toBe(0);
      expect(res.days).toBe(30);
    });

    it('lista inexistente → 404', async () => {
      await expect(service.findExpiringPrices('no-existe', VIEWER)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('lista no autorizada → 404', async () => {
      mockPrisma.lista.findUnique.mockResolvedValueOnce(null);
      await expect(service.findExpiringPrices(OTHER_LISTA_ID, VIEWER)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('duplicateLista (OLA 6 complemento)', () => {
    // Fuente rica con todos los campos de configuración a copiar.
    const fullSource = {
      ...mockLista,
      type: 'COMERCIAL',
      defaultVisibility: true,
      responsibleId: 'user-responsible',
      validFrom: new Date('2026-01-01T00:00:00Z'),
      validUntil: new Date('2026-12-31T23:59:59Z'),
    };

    it('duplica con code único nuevo e isActive false, productCount 0', async () => {
      mockPrisma.lista.findUnique.mockResolvedValueOnce(fullSource);
      const res = await service.duplicateLista(LISTA_ID, ADMIN);

      expect(res.isActive).toBe(false);
      expect(res.productCount).toBe(0);
      expect(res.name).toBe('Lista General (copia)');
      expect(res.code).toMatch(/^LISTA-GENERAL-COPIA-[A-Z0-9]{4}$/);
      const data = (mockPrisma.lista.create.mock.calls[0][0] as any).data;
      expect(data.code).toBe(res.code);
      expect(data.isActive).toBe(false);
      // Unicidad: verifica que no reutiliza el code del origen.
      expect(data.code).not.toBe('LISTA-GENERAL');
    });

    it('copia la configuración (type/defaultVisibility/vigencias/responsable/currency) y el actor', async () => {
      mockPrisma.lista.findUnique.mockResolvedValueOnce(fullSource);
      await service.duplicateLista(LISTA_ID, ADMIN);

      expect(mockPrisma.lista.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'COMERCIAL',
            defaultVisibility: true,
            validFrom: fullSource.validFrom,
            validUntil: fullSource.validUntil,
            responsibleId: 'user-responsible',
            currency: 'COP',
            description: 'Raíz',
            createdById: ADMIN.userId,
            updatedById: ADMIN.userId,
          }),
        }),
      );
    });

    it('NO copia productos, precios ni assignments (molde de configuración)', async () => {
      mockPrisma.lista.findUnique.mockResolvedValueOnce(fullSource);
      await service.duplicateLista(LISTA_ID, ADMIN);

      expect(mockPrisma.price.create).not.toHaveBeenCalled();
      expect(mockPrisma.price.upsert).not.toHaveBeenCalled();
      expect(mockPrisma.product.create).not.toHaveBeenCalled();
      expect(mockPrisma.assignment.create).not.toHaveBeenCalled();
    });

    it('audita la acción duplicate', async () => {
      mockPrisma.lista.findUnique.mockResolvedValueOnce(fullSource);
      await service.duplicateLista(LISTA_ID, ADMIN);

      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'duplicate',
          entity: 'LISTA',
          oldValues: { sourceId: LISTA_ID },
        }),
      );
    });

    it('404 si la Lista origen no existe', async () => {
      mockPrisma.lista.findUnique.mockResolvedValueOnce(null);
      await expect(service.duplicateLista('no-existe', ADMIN)).rejects.toThrow(NotFoundException);
    });

    it('403 si el usuario solo tiene view (exige edit+)', async () => {
      await expect(service.duplicateLista(LISTA_ID, VIEWER)).rejects.toThrow(ForbiddenException);
    });

    it('404 si el usuario no tiene assignment sobre la Lista (deny-by-default)', async () => {
      await expect(service.duplicateLista(LISTA_ID, NOAUTH)).rejects.toThrow(NotFoundException);
    });

    it('regenera el code si el candidato inicial ya existe (colisión)', async () => {
      const codeCheck = jest.fn();
      mockPrisma.lista.findUnique.mockImplementation(async (args: any) => {
        if (args?.where?.id === LISTA_ID) return fullSource;
        codeCheck();
        // primera comprobación de code → colisión; siguientes → libres
        return codeCheck.mock.calls.length === 1 ? { id: 'dup' } : null;
      });

      const res = await service.duplicateLista(LISTA_ID, ADMIN);

      expect(codeCheck.mock.calls.length).toBeGreaterThanOrEqual(2);
      expect(res.code).toMatch(/^LISTA-GENERAL-COPIA-[A-Z0-9]{4}$/);
      const data = (mockPrisma.lista.create.mock.calls[0][0] as any).data;
      expect(data.code).toBe(res.code);
    });

    it('trunca name y code a límites razonables en fuentes largas', async () => {
      const longSource = {
        ...fullSource,
        name: 'X'.repeat(300),
        code: 'L'.repeat(80),
      };
      mockPrisma.lista.findUnique.mockResolvedValueOnce(longSource);

      const res = await service.duplicateLista(LISTA_ID, ADMIN);

      expect(res.name.length).toBeLessThanOrEqual(121);
      expect(res.name.endsWith('(copia)')).toBe(true);
      expect(res.code.length).toBeLessThanOrEqual(60);
      expect(res.code).toMatch(/^L+-COPIA-[A-Z0-9]{4}$/);
    });
  });

  describe('removeLista — eliminación física (OLA 7A)', () => {
    it('delete exitoso (Lista vacía) → 200 y audita delete ANTES de borrar', async () => {
      mockPrisma.lista.findUnique.mockResolvedValueOnce(mockLista);
      mockPrisma.product.count.mockResolvedValueOnce(0);
      mockPrisma.price.count.mockResolvedValueOnce(0);
      mockPrisma.assignment.count.mockResolvedValueOnce(0);
      mockPrisma.auditLog.count.mockResolvedValueOnce(0);

      const res = await service.removeLista(LISTA_ID, ADMIN);

      expect(res.message).toBe('Lista eliminada exitosamente');
      expect(mockPrisma.lista.delete).toHaveBeenCalledWith({ where: { id: LISTA_ID } });
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'delete',
          entity: 'LISTA',
          entityId: LISTA_ID,
          newValues: expect.objectContaining({ code: mockLista.code, name: mockLista.name }),
        }),
      );
    });

    it('409 cuando la Lista tiene productos', async () => {
      mockPrisma.lista.findUnique.mockResolvedValueOnce(mockLista);
      mockPrisma.product.count.mockResolvedValueOnce(3);
      mockPrisma.price.count.mockResolvedValueOnce(0);
      mockPrisma.assignment.count.mockResolvedValueOnce(0);
      mockPrisma.auditLog.count.mockResolvedValueOnce(0);

      const promise = service.removeLista(LISTA_ID, ADMIN);
      await expect(promise).rejects.toThrow(ConflictException);
      await expect(promise).rejects.toThrow(
        'La Lista tiene 3 productos. Archívela o elimine los datos asociados primero.',
      );
      expect(mockPrisma.lista.delete).not.toHaveBeenCalled();
    });

    it('409 cuando la Lista tiene precios (mensaje combinado productos+precios)', async () => {
      mockPrisma.lista.findUnique.mockResolvedValueOnce(mockLista);
      mockPrisma.product.count.mockResolvedValueOnce(3);
      mockPrisma.price.count.mockResolvedValueOnce(5);
      mockPrisma.assignment.count.mockResolvedValueOnce(0);
      mockPrisma.auditLog.count.mockResolvedValueOnce(0);

      const promise = service.removeLista(LISTA_ID, ADMIN);
      await expect(promise).rejects.toThrow(ConflictException);
      await expect(promise).rejects.toThrow(
        'La Lista tiene 3 productos y 5 precios. Archívela o elimine los datos asociados primero.',
      );
    });

    it('409 cuando la Lista tiene accesos o historial', async () => {
      mockPrisma.lista.findUnique.mockResolvedValueOnce(mockLista);
      mockPrisma.product.count.mockResolvedValueOnce(0);
      mockPrisma.price.count.mockResolvedValueOnce(0);
      mockPrisma.assignment.count.mockResolvedValueOnce(2);
      mockPrisma.auditLog.count.mockResolvedValueOnce(4);

      const promise = service.removeLista(LISTA_ID, ADMIN);
      await expect(promise).rejects.toThrow(ConflictException);
      await expect(promise).rejects.toThrow(
        'La Lista tiene 2 accesos y 4 registros de historial. Archívela o elimine los datos asociados primero.',
      );
    });

    it('404 si la Lista no existe', async () => {
      mockPrisma.lista.findUnique.mockResolvedValueOnce(null);
      await expect(service.removeLista('no-existe', ADMIN)).rejects.toThrow(NotFoundException);
    });

    it('403 si el usuario no es Super Admin', async () => {
      mockPrisma.lista.findUnique.mockResolvedValueOnce(mockLista);
      mockPrisma.product.count.mockResolvedValueOnce(0);
      mockPrisma.price.count.mockResolvedValueOnce(0);
      mockPrisma.assignment.count.mockResolvedValueOnce(0);
      mockPrisma.auditLog.count.mockResolvedValueOnce(0);
      await expect(service.removeLista(LISTA_ID, MANAGER)).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.lista.delete).not.toHaveBeenCalled();
    });
  });
});
