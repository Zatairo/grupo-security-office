import { createPrismaMock } from '../../__test__/mocks/prisma.mock';
import { randomUUID } from 'crypto';

import {
  ConflictException,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
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
    ...args.create,
    ...(args.update ?? {}),
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

  it('C3: persiste rating 0-100 normalizado (80 → 8) y el GET lo expone ×10 (80)', async () => {
    mockPrisma.supplier.findUnique.mockResolvedValueOnce(null);
    const res = await service.createSupplier(
      { name: 'Rated Supplier', nit: '888', category: 'VIDEO', rating: 80 },
      ADMIN,
    );
    expect(mockPrisma.supplier.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ rating: 8 }) }),
    );
    expect(res.rating).toBe(80);

    mockPrisma.supplier.findMany.mockResolvedValueOnce([
      { ...mockSupplier, rating: 8, _count: { evaluations: 0 } },
    ]);
    const list = await service.findAllSuppliers({});
    expect(list.data[0].rating).toBe(80);

    mockPrisma.supplier.findUnique.mockResolvedValueOnce({
      ...mockSupplier,
      rating: 8,
      _count: { evaluations: 0, purchaseOrders: 0 },
    });
    const detail = await service.findOneSupplier('supp-1');
    expect(detail.rating).toBe(80);

    const updated = await service.updateSupplier('supp-1', { rating: 90 }, COMMERCIAL);
    expect(mockPrisma.supplier.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ rating: 9 }) }),
    );
    expect(updated.rating).toBe(90);

    const cleared = await service.updateSupplier('supp-1', { rating: null }, COMMERCIAL);
    expect(mockPrisma.supplier.update).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ rating: null }) }),
    );
    expect(cleared.rating).toBeNull();
  });

  it('C3-FIX: create y update (PUT /api/suppliers/:id) devuelven rating en escala 0-100', async () => {
    mockPrisma.supplier.findUnique.mockResolvedValueOnce(null);
    const created = await service.createSupplier(
      { name: 'Proveedor Rateado', nit: '777777777-7', category: 'VIDEO', rating: 75 },
      ADMIN,
    );
    expect(created.rating).toBe(75);

    const updated = await service.updateSupplier('supp-1', { rating: 60 }, COMMERCIAL);
    expect(updated.rating).toBe(60);
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

  it('actualiza status a aprobada (transición válida) y audita status_change', async () => {
    const res = await service.updatePurchaseOrderStatus(
      'po-1',
      { status: 'aprobada' },
      COMMERCIAL,
    );
    expect(res.status).toBe('aprobada');
    expect(mockAudit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'status_change',
        entity: 'PurchaseOrder',
        oldValues: { status: 'solicitada' },
        newValues: expect.objectContaining({ status: 'aprobada', movedByUserId: COMMERCIAL.userId }),
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

describe('SuppliersService — Tanda 1C (stock avanzado, PO flujo completo, dashboard, reportes)', () => {
  let service: SuppliersService;
  let mockPrisma: AnyMock;
  let mockAudit: { log: jest.Mock; findByEntity?: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma = buildPrisma();
    mockAudit = { log: jest.fn().mockResolvedValue({}) };
    service = new SuppliersService(mockPrisma as any, mockAudit as any);
  });

  // ---------- Stock: movimientos y alertas ----------

  it('registra movement_in en upsert con adjustmentType=in (trazabilidad en audit)', async () => {
    mockPrisma.stock.findUnique.mockResolvedValueOnce(mockStock); // availableQty 42
    const res = await service.upsertStock(
      'prod-1',
      { quantity: 5, adjustmentType: 'in', reason: 'Compra proveedor' },
      COMMERCIAL,
    );
    expect(res.availableQty).toBe(47);
    expect(mockAudit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'movement_in',
        entity: 'Stock',
        newValues: expect.objectContaining({
          adjustmentType: 'in',
          reason: 'Compra proveedor',
          quantityAntes: 42,
          quantityDespues: 47,
        }),
      }),
    );
  });

  it('registra movement_out y ajuste (adjust) con cantidades antes/después', async () => {
    mockPrisma.stock.findUnique.mockResolvedValueOnce(mockStock); // 42
    await service.upsertStock('prod-1', { quantity: 2, adjustmentType: 'out', reason: 'Venta' }, COMMERCIAL);
    expect(mockAudit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'movement_out',
        newValues: expect.objectContaining({ quantityAntes: 42, quantityDespues: 40 }),
      }),
    );

    mockPrisma.stock.findUnique.mockResolvedValueOnce(mockStock); // 42
    const res = await service.upsertStock('prod-1', { quantity: 9, adjustmentType: 'adjust' }, COMMERCIAL);
    expect(res.availableQty).toBe(9);
    expect(mockAudit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'adjust',
        newValues: expect.objectContaining({ quantityAntes: 42, quantityDespues: 9 }),
      }),
    );
  });

  it('400 si una salida deja el stock negativo', async () => {
    mockPrisma.stock.findUnique.mockResolvedValueOnce(mockStock); // 42
    await expect(
      service.upsertStock('prod-1', { quantity: 100, adjustmentType: 'out' }, COMMERCIAL),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.upsertStock('prod-1', { quantity: 100, adjustmentType: 'out' }, COMMERCIAL),
    ).rejects.toThrow('Stock insuficiente');
  });

  it('persiste minQuantity en auditoría (sin migración) al crear/actualizar stock', async () => {
    const res = await service.upsertStock('prod-1', { quantity: 10, minQuantity: 5 }, COMMERCIAL);
    expect(mockAudit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'settings',
        entity: 'Stock',
        entityId: res.id,
        newValues: expect.objectContaining({ minQuantity: 5 }),
      }),
    );
  });

  it('lista alertas de stock (out_of_stock / below_min desde audit settings)', async () => {
    mockPrisma.stock.findMany.mockResolvedValueOnce([
      { id: 's1', productId: 'prod-1', availableQty: 0, location: 'A', updatedAt: new Date() },
      { id: 's2', productId: 'prod-2', availableQty: 3, location: 'B', updatedAt: new Date() },
      { id: 's3', productId: 'prod-3', availableQty: 10, location: 'C', updatedAt: new Date() },
    ]);
    mockPrisma.auditLog.findMany.mockResolvedValueOnce([
      { entityId: 's2', newValues: { minQuantity: 5 } },
    ]);
    mockPrisma.product.findMany.mockResolvedValueOnce([
      { id: 'prod-1', sku: 'CAM-001', name: 'Cámara' },
      { id: 'prod-2', sku: 'CAM-002', name: 'Cámara 2' },
      { id: 'prod-3', sku: 'CAM-003', name: 'Cámara 3' },
    ]);
    const res = await service.findStockAlerts();
    expect(res.data.map((a: any) => a.reason)).toEqual(['out_of_stock', 'below_min']);
  });

  it('404 al listar alertas si el producto referenciado no existe (se omite sin romper)', async () => {
    mockPrisma.stock.findMany.mockResolvedValueOnce([
      { id: 's1', productId: 'prod-ghost', availableQty: 0, location: 'A', updatedAt: new Date() },
    ]);
    mockPrisma.auditLog.findMany.mockResolvedValueOnce([]);
    mockPrisma.product.findMany.mockResolvedValueOnce([]);
    const res = await service.findStockAlerts();
    expect(res.data[0].productId).toBe('prod-ghost');
    expect(res.data[0].name).toBeNull();
  });

  // ---------- Órdenes de compra: matriz de transiciones ----------

  it('400 al pasar de solicitada a recibida (transición inválida)', async () => {
    const promise = service.updatePurchaseOrderStatus('po-1', { status: 'recibida' }, COMMERCIAL);
    await expect(promise).rejects.toThrow(BadRequestException);
    await expect(promise).rejects.toThrow('No se puede pasar de solicitada a recibida');
  });

  it('400 al pasar de aprobada a recibida (debe ir por en_transito)', async () => {
    mockPrisma.purchaseOrder.findUnique.mockResolvedValueOnce({ ...mockOrder, status: 'aprobada' });
    await expect(
      service.updatePurchaseOrderStatus('po-1', { status: 'recibida' }, COMMERCIAL),
    ).rejects.toThrow(BadRequestException);
  });

  it('400 al moverse desde un estado terminal (cerrada)', async () => {
    mockPrisma.purchaseOrder.findUnique.mockResolvedValueOnce({ ...mockOrder, status: 'cerrada' });
    await expect(
      service.updatePurchaseOrderStatus('po-1', { status: 'recibida' }, COMMERCIAL),
    ).rejects.toThrow(BadRequestException);
  });

  it('Admin Comercial puede cancelar una orden (C4: AC = Super Admin del área comercial)', async () => {
    const res = await service.updatePurchaseOrderStatus(
      'po-1',
      { status: 'cancelada', comment: 'No aplica' },
      COMMERCIAL,
    );
    expect(res.status).toBe('cancelada');
    expect(mockAudit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'status_change',
        entity: 'PurchaseOrder',
        newValues: expect.objectContaining({ status: 'cancelada', comment: 'No aplica' }),
      }),
    );
  });

  it('Admin Comercial puede cerrar una orden recibida (recibida → cerrada)', async () => {
    mockPrisma.purchaseOrder.findUnique.mockResolvedValueOnce({ ...mockOrder, status: 'recibida' });
    const res = await service.updatePurchaseOrderStatus('po-1', { status: 'cerrada' }, COMMERCIAL);
    expect(res.status).toBe('cerrada');
    expect(mockAudit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'status_change',
        entity: 'PurchaseOrder',
        oldValues: { status: 'recibida' },
        newValues: expect.objectContaining({ status: 'cerrada' }),
      }),
    );
  });

  it('403 al cancelar/cerrar una orden sin rol de escritura (Operador)', async () => {
    const operador = { userId: 'op-1', roles: ['Operador'] };
    await expect(
      service.updatePurchaseOrderStatus('po-1', { status: 'cancelada' }, operador),
    ).rejects.toThrow(ForbiddenException);
    mockPrisma.purchaseOrder.findUnique.mockResolvedValueOnce({ ...mockOrder, status: 'recibida' });
    await expect(
      service.updatePurchaseOrderStatus('po-1', { status: 'cerrada' }, operador),
    ).rejects.toThrow(ForbiddenException);
  });

  it('Super Admin puede cancelar una orden', async () => {
    const res = await service.updatePurchaseOrderStatus('po-1', { status: 'cancelada', comment: 'Ya no se necesita' }, ADMIN);
    expect(res.status).toBe('cancelada');
    expect(mockAudit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'status_change',
        entity: 'PurchaseOrder',
        oldValues: { status: 'solicitada' },
        newValues: expect.objectContaining({ status: 'cancelada', comment: 'Ya no se necesita' }),
      }),
    );
  });

  it('409 al aprobar PO con item de producto sin stock disponible (confirmación de disponibilidad)', async () => {
    const order = { ...mockOrder, items: { productId: 'prod-1', quantity: 5 } };
    mockPrisma.purchaseOrder.findUnique.mockResolvedValueOnce(order);
    mockPrisma.stock.findMany.mockResolvedValueOnce([
      { id: 'stock-1', productId: 'prod-1', availableQty: 0 },
    ]);
    mockPrisma.product.findMany.mockResolvedValueOnce([
      { id: 'prod-1', sku: 'CAM-001', name: 'Cámara IP' },
    ]);

    const promise = service.updatePurchaseOrderStatus('po-1', { status: 'aprobada' }, COMMERCIAL);
    await expect(promise).rejects.toThrow(ConflictException);
    await expect(promise).rejects.toThrow('No se puede aprobar la orden de compra');
    await expect(promise).rejects.toMatchObject({
      response: {
        details: ['Producto Cámara IP (CAM-001) sin stock disponible (availableQty=0)'],
      },
    });
    expect(mockPrisma.purchaseOrder.update).not.toHaveBeenCalled();
  });

  it('aprueba PO cuando el producto no tiene registro de stock (sin datos = no bloquea)', async () => {
    const order = { ...mockOrder, items: { productId: 'prod-1', quantity: 5 } };
    mockPrisma.purchaseOrder.findUnique.mockResolvedValueOnce(order);
    mockPrisma.stock.findMany.mockResolvedValueOnce([]);
    mockPrisma.product.findMany.mockResolvedValueOnce([
      { id: 'prod-1', sku: 'CAM-001', name: 'Cámara IP' },
    ]);

    const res = await service.updatePurchaseOrderStatus('po-1', { status: 'aprobada' }, COMMERCIAL);
    expect(res.status).toBe('aprobada');
    expect(mockPrisma.purchaseOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'aprobada' } }),
    );
  });

  it('al recibir la orden incrementa el stock de los items y audita movement_in', async () => {
    const orderInTransit = {
      ...mockOrder,
      status: 'en_transito',
      code: 'PO-RECV',
      items: { productId: 'prod-1', quantity: 10 },
    };
    mockPrisma.purchaseOrder.findUnique.mockResolvedValueOnce(orderInTransit);
    mockPrisma.stock.findUnique.mockResolvedValueOnce(mockStock); // availableQty 42

    const res = await service.updatePurchaseOrderStatus(
      'po-1',
      { status: 'recibida', comment: 'Recibido en bodega' },
      COMMERCIAL,
    );
    expect(res.status).toBe('recibida');
    expect(mockPrisma.stock.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { productId: 'prod-1' },
        update: { availableQty: 52 },
      }),
    );
    expect(mockAudit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'movement_in',
        entity: 'Stock',
        newValues: expect.objectContaining({
          productId: 'prod-1',
          reason: 'orden de compra PO-RECV',
          quantityAntes: 42,
          quantityDespues: 52,
        }),
      }),
    );
    expect(mockAudit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'status_change',
        entity: 'PurchaseOrder',
        newValues: expect.objectContaining({ status: 'recibida', comment: 'Recibido en bodega' }),
      }),
    );
  });

  it('detalle de orden con historial desde auditoría (checklist 49)', async () => {
    mockPrisma.purchaseOrder.findUnique.mockResolvedValueOnce(mockOrder);
    (mockAudit as any).findByEntity = jest.fn().mockResolvedValue({
      data: [
        { id: 'log-1', action: 'create', newValues: { code: 'PO-ABCD' } },
        { id: 'log-2', action: 'status_change', newValues: { status: 'aprobada' } },
      ],
    });
    const res = await service.findOnePurchaseOrder('po-1');
    expect(res.data.id).toBe('po-1');
    expect(res.data.history).toHaveLength(2);
    expect(res.data.history[1].action).toBe('status_change');
  });

  // ---------- Panel de compras ----------

  it('panel de compras con shape exacto (checklist 50)', async () => {
    const now = new Date();
    mockPrisma.purchaseOrder.findMany.mockResolvedValueOnce([
      { id: 'po-a', code: 'PO-A', status: 'solicitada', supplierId: 'supp-1', items: {}, createdAt: now, supplier: { id: 'supp-1', name: 'Prov', nit: '900' } },
      { id: 'po-b', code: 'PO-B', status: 'recibida', supplierId: 'supp-1', items: { productId: 'prod-1', quantity: 4 }, createdAt: now, supplier: { id: 'supp-1', name: 'Prov', nit: '900' } },
      { id: 'po-c', code: 'PO-C', status: 'cancelada', supplierId: 'supp-1', items: {}, createdAt: now, supplier: { id: 'supp-1', name: 'Prov', nit: '900' } },
      { id: 'po-d', code: 'PO-D', status: 'cerrada', supplierId: 'supp-1', items: {}, createdAt: now, supplier: { id: 'supp-1', name: 'Prov', nit: '900' } },
    ]);
    mockPrisma.supplier.findMany.mockResolvedValueOnce([
      { id: 'supp-1', name: 'Prov', nit: '900', category: 'X', status: 'active' },
      { id: 'supp-2', name: 'Prov2', nit: '901', category: 'X', status: 'active' },
    ]);
    mockPrisma.supplierEvaluation.findMany.mockResolvedValueOnce([
      { supplierId: 'supp-1', date: new Date('2020-01-01') },
    ]);
    mockPrisma.price.count.mockResolvedValueOnce(3);
    mockPrisma.stock.findMany.mockResolvedValueOnce([]);
    mockPrisma.auditLog.findMany.mockResolvedValueOnce([]);
    mockPrisma.product.findMany.mockResolvedValueOnce([
      { id: 'prod-1', sku: 'CAM-001', name: 'Cámara' },
    ]);

    const res = await service.getPurchaseOrderDashboard();
    expect(res.data.openOrders).toBe(2);
    expect(res.data.ordersByStatus).toEqual({ solicitada: 1, recibida: 1, cancelada: 1, cerrada: 1 });
    expect(res.data.expiringPrices).toBe(3);
    expect(res.data.lowStock).toBe(0);
    expect(res.data.pendingSupplierEvaluations.count).toBe(2);
    expect(res.data.recentOrders).toHaveLength(4);
    expect(res.data.recentOrders[1].products[0]).toEqual({ id: 'prod-1', sku: 'CAM-001', name: 'Cámara' });
  });

  // ---------- Proveedor ↔ producto (asociación por POs) ----------

  it('resuelve productos de un proveedor desde los items de sus POs (distinct)', async () => {
    mockPrisma.purchaseOrder.findMany.mockResolvedValueOnce([
      { ...mockOrder, items: [{ productId: 'prod-1', quantity: 5 }, { productId: 'prod-2', quantity: 3 }] },
      { ...mockOrder, items: { productId: 'prod-1', quantity: 2 } },
    ]);
    mockPrisma.product.findMany.mockResolvedValueOnce([
      { id: 'prod-1', sku: 'CAM-001', name: 'Cámara' },
      { id: 'prod-2', sku: 'DVR-001', name: 'DVR' },
    ]);
    const res = await service.findSupplierProducts('supp-1');
    expect(res.data).toHaveLength(2);
    const p1 = res.data.find((p: any) => p.productId === 'prod-1');
    expect(p1.totalOrdered).toBe(7);
  });

  it('resuelve proveedores de un producto desde sus POs', async () => {
    mockPrisma.purchaseOrder.findMany.mockResolvedValueOnce([
      { supplierId: 'supp-1', items: { productId: 'prod-1', quantity: 1 }, createdAt: new Date('2026-08-01'), supplier: { id: 'supp-1', name: 'A', nit: '1', category: 'X' } },
      { supplierId: 'supp-2', items: { productId: 'prod-2', quantity: 1 }, createdAt: new Date('2026-08-02'), supplier: { id: 'supp-2', name: 'B', nit: '2', category: 'X' } },
    ]);
    const res = await service.findProductSuppliers('prod-1');
    expect(res.data).toHaveLength(1);
    expect(res.data[0].id).toBe('supp-1');
  });

  // ---------- Promedio, alertas y reporte ----------

  it('incluye averageScore y lastEvaluationDate en el detalle del proveedor', async () => {
    mockPrisma.supplier.findUnique.mockResolvedValueOnce({
      ...mockSupplier,
      _count: { evaluations: 2, purchaseOrders: 1 },
    });
    mockPrisma.supplierEvaluation.findMany.mockResolvedValueOnce([
      { supplierId: 'supp-1', score: 80, date: new Date('2026-08-01') },
      { supplierId: 'supp-1', score: 60, date: new Date('2026-07-01') },
    ]);
    const res = await service.findOneSupplier('supp-1');
    expect(res.averageScore).toBe(70);
    expect(res.lastEvaluationDate).toEqual(new Date('2026-08-01'));
  });

  it('alertas de proveedores con motivo bajo_score / sin_evaluacion_reciente', async () => {
    mockPrisma.supplier.findMany.mockResolvedValueOnce([
      { id: 'supp-1', name: 'A', nit: '1', category: 'X', status: 'active' },
      { id: 'supp-2', name: 'B', nit: '2', category: 'X', status: 'active' },
      { id: 'supp-3', name: 'C', nit: '3', category: 'X', status: 'active' },
    ]);
    mockPrisma.supplierEvaluation.findMany.mockResolvedValueOnce([
      { supplierId: 'supp-1', score: 50, date: new Date('2026-08-01') },
      { supplierId: 'supp-2', score: 90, date: new Date('2026-08-01') },
      { supplierId: 'supp-3', score: 85, date: new Date('2020-01-01') },
    ]);
    const res = await service.findSupplierAlerts(60);
    const byId = Object.fromEntries(res.data.map((a: any) => [a.id, a]));
    expect(byId['supp-1'].reason).toBe('bajo_score');
    expect(byId['supp-3'].reason).toBe('sin_evaluacion_reciente');
    expect(byId['supp-2']).toBeUndefined();
  });

  it('reporte comparativo por categoría ordenado por averageScore desc (checklist 40)', async () => {
    mockPrisma.supplier.findMany.mockResolvedValueOnce([
      { id: 'supp-1', name: 'A', nit: '1', category: 'VIDEO', status: 'active' },
      { id: 'supp-2', name: 'B', nit: '2', category: 'VIDEO', status: 'active' },
    ]);
    mockPrisma.supplierEvaluation.findMany.mockResolvedValueOnce([
      { supplierId: 'supp-1', score: 80 },
      { supplierId: 'supp-2', score: 50 },
    ]);
    mockPrisma.purchaseOrder.findMany.mockResolvedValueOnce([
      { supplierId: 'supp-1', status: 'recibida', items: { productId: 'prod-1', quantity: 10 } },
      { supplierId: 'supp-2', status: 'cancelada', items: { productId: 'prod-1', quantity: 99 } },
    ]);
    const res = await service.getSupplierReport('VIDEO');
    expect(res.data.category).toBe('VIDEO');
    expect(res.data.suppliers[0].name).toBe('A');
    expect(res.data.suppliers[0].averageScore).toBe(80);
    expect(res.data.suppliers[0].totalOrdered).toBe(10);
    expect(res.data.suppliers[1].totalOrdered).toBe(0); // cancelada no suma
    expect(res.data.ranking[0].rank).toBe(1);
  });
});