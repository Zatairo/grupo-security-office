import { createPrismaMock } from '../../__test__/mocks/prisma.mock';
import { randomUUID } from 'crypto';

import {
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { SuppliersService } from './suppliers.service';

type AnyMock = ReturnType<typeof createPrismaMock>;

const ADMIN = { userId: 'admin-1', roles: ['Super Admin'] };
const COMMERCIAL = { userId: 'com-1', roles: ['Admin Comercial'] };

const mockSupplier = {
  id: 'supp-1',
  name: 'Distribuidora Hikvision Colombia SAS',
  nit: '900123456-7',
  contact: null,
  category: 'VIDEO',
  status: 'active',
  rating: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockProduct = {
  id: 'prod-1',
  sku: 'CAM-001',
  name: 'Cámara IP',
  listaId: 'list-1',
};

const mockStock = {
  id: 'stock-1',
  productId: 'prod-1',
  availableQty: 42,
  reservedQty: 0,
  location: 'BODEGA-PEREIRA',
  updatedAt: new Date(),
};

const mockOrder = {
  id: 'po-1',
  code: 'PO-ABCD',
  supplierId: 'supp-1',
  status: 'solicitada',
  requestedById: 'admin-1',
  items: {},
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function buildPrisma(): AnyMock {
  const p = createPrismaMock();
  p.supplier.findUnique.mockImplementation(async (args: any) => {
    const id = args?.where?.id;
    const nit = args?.where?.nit;
    if (id === mockSupplier.id) return mockSupplier;
    if (id === 'supp-other') return { ...mockSupplier, id: 'supp-other', nit: '111111111-1' };
    if (id === 'with-orders') return { ...mockSupplier, id: 'with-orders' };
    if (nit === mockSupplier.nit) return mockSupplier;
    return null;
  });
  p.supplier.findMany.mockResolvedValue([mockSupplier]);
  p.supplier.create.mockImplementation(async (args: any) => ({
    id: randomUUID(),
    ...args.data,
    contact: args.data.contact ?? null,
    rating: args.data.rating ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }));
  p.supplier.update.mockImplementation(async (args: any) => ({
    ...mockSupplier,
    ...args.data,
    updatedAt: new Date(),
  }));
  p.supplier.delete.mockResolvedValue({ id: 'supp-1' });
  p.supplierEvaluation.findMany.mockResolvedValue([]);
  p.supplierEvaluation.create.mockImplementation(async (args: any) => ({
    id: randomUUID(),
    ...args.data,
    createdAt: new Date(),
  }));
  p.purchaseOrder.count.mockResolvedValue(0);
  p.purchaseOrder.findMany.mockResolvedValue([mockOrder]);
  p.purchaseOrder.findUnique.mockResolvedValue(mockOrder);
  p.purchaseOrder.create.mockImplementation(async (args: any) => ({
    id: randomUUID(),
    ...args.data,
    createdAt: new Date(),
    updatedAt: new Date(),
  }));
  p.purchaseOrder.update.mockImplementation(async (args: any) => ({
    ...mockOrder,
    ...args.data,
    updatedAt: new Date(),
  }));
  p.purchaseOrder.delete.mockResolvedValue(mockOrder);
  p.product.findUnique.mockImplementation(async (args: any) => {
    if (args?.where?.id === mockProduct.id) return mockProduct;
    return null;
  });
  p.stock.findUnique.mockImplementation(async (args: any) =>
    args?.where?.id === mockStock.id ? mockStock : null,
  );
  p.stock.findMany.mockResolvedValue([mockStock]);
  p.stock.upsert.mockImplementation(async (args: any) => ({
    id: randomUUID(),
    ...(args.update ?? {}),
    ...args.create,
    updatedAt: new Date(),
  }));
  p.stock.update.mockImplementation(async (args: any) => ({
    ...mockStock,
    ...args.data,
    updatedAt: new Date(),
  }));
  p.stock.delete.mockResolvedValue(mockStock);
  return p;
}

describe('SuppliersService — módulo proveedores (OLA 7A)', () => {
  let service: SuppliersService;
  let mockPrisma: AnyMock;
  let mockAudit: { log: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma = buildPrisma();
    mockAudit = { log: jest.fn().mockResolvedValue({}) };
    service = new SuppliersService(mockPrisma as any, mockAudit as any);
  });

  // ---------- Suppliers ----------

  it('crea un proveedor (201) y audita create', async () => {
    mockPrisma.supplier.findUnique.mockResolvedValueOnce(null);
    const res = await service.createSupplier(
      { name: 'Nuevo Proveedor', nit: '999', category: 'ACCESO' },
      ADMIN,
    );
    expect(res.nit).toBe('999');
    expect(res.status).toBe('active');
    expect(mockPrisma.supplier.create).toHaveBeenCalled();
    expect(mockAudit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'create', entity: 'Supplier', userId: ADMIN.userId }),
    );
  });

  it('rechaza NIT duplicado con 409', async () => {
    await expect(
      service.createSupplier({ name: 'Otra', nit: mockSupplier.nit, category: 'X' }, ADMIN),
    ).rejects.toThrow(ConflictException);
    await expect(
      service.createSupplier({ name: 'Otra', nit: mockSupplier.nit, category: 'X' }, ADMIN),
    ).rejects.toThrow('Ya existe un proveedor con ese NIT');
  });

  it('lista proveedores con evaluationCount y aplica search/status', async () => {
    mockPrisma.supplier.findMany.mockResolvedValue([
      { ...mockSupplier, _count: { evaluations: 2 } },
    ]);
    const res = await service.findAllSuppliers({ search: 'hik', status: 'active' });
    expect(res.data).toHaveLength(1);
    expect(res.data[0].evaluationCount).toBe(2);
    expect(mockPrisma.supplier.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'active',
          OR: expect.arrayContaining([
            expect.objectContaining({ name: expect.objectContaining({ contains: 'hik', mode: 'insensitive' }) }),
          ]),
        }),
      }),
    );
  });

  it('obtiene detalle de proveedor con conteos', async () => {
    mockPrisma.supplier.findUnique.mockResolvedValueOnce({
      ...mockSupplier,
      _count: { evaluations: 1, purchaseOrders: 0 },
    });
    const res = await service.findOneSupplier('supp-1');
    expect(res.id).toBe('supp-1');
    expect(res._count.evaluations).toBe(1);
  });

  it('404 si el proveedor no existe', async () => {
    mockPrisma.supplier.findUnique.mockResolvedValueOnce(null);
    await expect(service.findOneSupplier('no-existe')).rejects.toThrow(NotFoundException);
  });

  it('actualiza proveedor (parcial) y audita update', async () => {
    const res = await service.updateSupplier('supp-1', { status: 'inactive' }, COMMERCIAL);
    expect(res.status).toBe('inactive');
    expect(mockAudit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'update', entity: 'Supplier', entityId: 'supp-1' }),
    );
  });

  it('409 al actualizar a un NIT ya existente de otro proveedor', async () => {
    const promise = service.updateSupplier('supp-other', { nit: mockSupplier.nit }, COMMERCIAL);
    await expect(promise).rejects.toThrow(ConflictException);
    await expect(promise).rejects.toThrow('Ya existe un proveedor con ese NIT');
  });

  it('404 al actualizar un proveedor inexistente', async () => {
    mockPrisma.supplier.findUnique.mockResolvedValueOnce(null);
    await expect(service.updateSupplier('no-existe', { name: 'X' }, COMMERCIAL)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('elimina proveedor sin órdenes de compra (200) y audita delete', async () => {
    mockPrisma.purchaseOrder.count.mockResolvedValueOnce(0);
    const res = await service.removeSupplier('supp-1', ADMIN);
    expect(res.message).toBe('Proveedor eliminado exitosamente');
    expect(mockPrisma.supplier.delete).toHaveBeenCalledWith({ where: { id: 'supp-1' } });
    expect(mockAudit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'delete', entity: 'Supplier' }),
    );
  });

  it('409 al eliminar proveedor con órdenes de compra (FK Restrict)', async () => {
    mockPrisma.purchaseOrder.count.mockResolvedValueOnce(3);
    const promise = service.removeSupplier('supp-1', ADMIN);
    await expect(promise).rejects.toThrow(ConflictException);
    await expect(promise).rejects.toThrow('No se puede eliminar el proveedor: tiene 3 orden(es) de compra asociadas');
    expect(mockPrisma.supplier.delete).not.toHaveBeenCalled();
  });

  it('404 al eliminar proveedor inexistente', async () => {
    mockPrisma.supplier.findUnique.mockResolvedValueOnce(null);
    await expect(service.removeSupplier('no-existe', ADMIN)).rejects.toThrow(NotFoundException);
  });

  // ---------- Evaluaciones ----------

  it('crea evaluación (201) con evaluatedById = actor', async () => {
    const res = await service.createEvaluation(
      'supp-1',
      { criteria: { delivery: 4, quality: 5 }, score: 4.5 },
      COMMERCIAL,
    );
    expect(res.evaluatedById).toBe(COMMERCIAL.userId);
    expect(res.score).toBe(4.5);
    expect(mockAudit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'create', entity: 'SupplierEvaluation' }),
    );
  });

  it('404 al crear evaluación de proveedor inexistente', async () => {
    mockPrisma.supplier.findUnique.mockResolvedValueOnce(null);
    await expect(
      service.createEvaluation('no-existe', { criteria: { q: 1 }, score: 5 }, COMMERCIAL),
    ).rejects.toThrow(NotFoundException);
  });

  it('lista evaluaciones con evaluador', async () => {
    mockPrisma.supplierEvaluation.findMany.mockResolvedValueOnce([
      {
        id: 'eval-1',
        supplierId: 'supp-1',
        evaluatedById: 'admin-1',
        date: new Date(),
        criteria: { q: 1 },
        score: 4.5,
        observations: null,
        evaluatedBy: { id: 'admin-1', name: 'Admin', email: 'admin@x.com' },
      },
    ]);
    const res = await service.findEvaluations('supp-1');
    expect(res.data).toHaveLength(1);
    expect(res.data[0].evaluatedBy.name).toBe('Admin');
  });

  it('404 al listar evaluaciones de proveedor inexistente', async () => {
    mockPrisma.supplier.findUnique.mockResolvedValueOnce(null);
    await expect(service.findEvaluations('no-existe')).rejects.toThrow(NotFoundException);
  });

  // ---------- Stock ----------

  it('crea stock por upsert (productId nuevo) y audita create', async () => {
    mockPrisma.stock.findUnique.mockResolvedValueOnce(null);
    const res = await service.upsertStock('prod-1', { quantity: 10, location: 'BODEGA-1' }, COMMERCIAL);
    expect(res.availableQty).toBe(10);
    expect(mockPrisma.stock.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { productId: 'prod-1' },
        create: expect.objectContaining({ availableQty: 10 }),
      }),
    );
    expect(mockAudit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'create', entity: 'Stock' }),
    );
  });

  it('actualiza stock existente por upsert y audita update', async () => {
    mockPrisma.stock.findUnique.mockResolvedValueOnce(mockStock);
    const res = await service.upsertStock('prod-1', { quantity: 50 }, COMMERCIAL);
    expect(res.availableQty).toBe(50);
    expect(mockAudit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'update', entity: 'Stock' }),
    );
  });

  it('404 al crear stock de producto inexistente', async () => {
    mockPrisma.product.findUnique.mockResolvedValueOnce(null);
    await expect(
      service.upsertStock('no-existe', { quantity: 1 }, COMMERCIAL),
    ).rejects.toThrow(NotFoundException);
  });

  it('lista stock de un producto', async () => {
    const res = await service.findStockByProduct('prod-1');
    expect(res.data).toHaveLength(1);
    expect(res.data[0].availableQty).toBe(42);
  });

  it('404 al listar stock de producto inexistente', async () => {
    mockPrisma.product.findUnique.mockResolvedValueOnce(null);
    await expect(service.findStockByProduct('no-existe')).rejects.toThrow(NotFoundException);
  });

  it('actualiza stock (PATCH parcial) y audita update', async () => {
    const res = await service.updateStock('stock-1', { quantity: 55 }, COMMERCIAL);
    expect(res.availableQty).toBe(55);
    expect(mockAudit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'update', entity: 'Stock', entityId: 'stock-1' }),
    );
  });

  it('404 al actualizar stock inexistente', async () => {
    mockPrisma.stock.findUnique.mockResolvedValueOnce(null);
    await expect(service.updateStock('no-existe', { quantity: 1 }, COMMERCIAL)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('elimina stock y audita delete', async () => {
    const res = await service.removeStock('stock-1', ADMIN);
    expect(res.message).toBe('Stock eliminado exitosamente');
    expect(mockPrisma.stock.delete).toHaveBeenCalledWith({ where: { id: 'stock-1' } });
    expect(mockAudit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'delete', entity: 'Stock' }),
    );
  });

  it('404 al eliminar stock inexistente', async () => {
    mockPrisma.stock.findUnique.mockResolvedValueOnce(null);
    await expect(service.removeStock('no-existe', ADMIN)).rejects.toThrow(NotFoundException);
  });

  // ---------- Órdenes de compra ----------

  it('crea orden de compra con status default solicitada y audita create', async () => {
    const res = await service.createPurchaseOrder({ supplierId: 'supp-1' }, COMMERCIAL);
    expect(res.status).toBe('solicitada');
    expect(res.requestedById).toBe(COMMERCIAL.userId);
    expect(res.code).toMatch(/^PO-/);
    expect(mockAudit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'create', entity: 'PurchaseOrder' }),
    );
  });

  it('crea orden de compra con status aprobada explícito', async () => {
    const res = await service.createPurchaseOrder(
      { supplierId: 'supp-1', status: 'aprobada', notes: 'Urgente' },
      COMMERCIAL,
    );
    expect(res.status).toBe('aprobada');
    expect(res.notes).toBe('Urgente');
  });

  it('400 al crear orden con status inválido', async () => {
    const promise = service.createPurchaseOrder(
      { supplierId: 'supp-1', status: 'enviada' },
      COMMERCIAL,
    );
    await expect(promise).rejects.toThrow(BadRequestException);
  });

  it('404 al crear orden de proveedor inexistente', async () => {
    mockPrisma.supplier.findUnique.mockResolvedValueOnce(null);
    await expect(
      service.createPurchaseOrder({ supplierId: 'no-existe' }, COMMERCIAL),
    ).rejects.toThrow(NotFoundException);
  });

  it('lista órdenes filtradas por status incluyendo proveedor', async () => {
    mockPrisma.purchaseOrder.findMany.mockResolvedValueOnce([
      { ...mockOrder, supplier: { id: 'supp-1', name: 'Proveedor', nit: '9001' } },
    ]);
    const res = await service.findPurchaseOrders({ status: 'solicitada' });
    expect(res.data).toHaveLength(1);
    expect(res.data[0].supplier.name).toBe('Proveedor');
    expect(mockPrisma.purchaseOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: 'solicitada' }) }),
    );
  });

  it('actualiza status a recibida y audita update', async () => {
    const res = await service.updatePurchaseOrderStatus(
      'po-1',
      { status: 'recibida' },
      COMMERCIAL,
    );
    expect(res.status).toBe('recibida');
    expect(mockAudit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'update',
        entity: 'PurchaseOrder',
        oldValues: { status: 'solicitada' },
        newValues: { status: 'recibida' },
      }),
    );
  });

  it('400 al actualizar status inválido', async () => {
    const promise = service.updatePurchaseOrderStatus('po-1', { status: 'x' }, COMMERCIAL);
    await expect(promise).rejects.toThrow(BadRequestException);
  });

  it('404 al actualizar status de orden inexistente', async () => {
    mockPrisma.purchaseOrder.findUnique.mockResolvedValueOnce(null);
    await expect(
      service.updatePurchaseOrderStatus('no-existe', { status: 'recibida' }, COMMERCIAL),
    ).rejects.toThrow(NotFoundException);
  });

  it('elimina orden de compra y audita delete', async () => {
    const res = await service.removePurchaseOrder('po-1', ADMIN);
    expect(res.message).toBe('Orden de compra eliminada exitosamente');
    expect(mockAudit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'delete', entity: 'PurchaseOrder' }),
    );
  });

  it('404 al eliminar orden inexistente', async () => {
    mockPrisma.purchaseOrder.findUnique.mockResolvedValueOnce(null);
    await expect(service.removePurchaseOrder('no-existe', ADMIN)).rejects.toThrow(NotFoundException);
  });
});