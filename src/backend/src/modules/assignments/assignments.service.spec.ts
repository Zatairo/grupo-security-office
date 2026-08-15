import { createPrismaMock } from '../../__test__/mocks/prisma.mock';

const mockPrisma = createPrismaMock();

jest.mock('../../prisma/prisma.service', () => ({
  PrismaService: jest.fn().mockImplementation(() => mockPrisma),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { AssignmentsService } from './assignments.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AclService } from '../../common/acl/acl.service';
import { AuditService } from '../audit/audit.service';

const mockAudit = { log: jest.fn().mockResolvedValue(undefined) };

const mockAcl = {
  isSuperAdmin: jest.fn().mockReturnValue(false),
  levelsAtLeast: jest.fn().mockReturnValue([]),
  getAllowedListaIds: jest.fn().mockResolvedValue([]),
  getUserLevel: jest.fn().mockResolvedValue(null),
  assertListaAccess: jest.fn().mockResolvedValue(undefined),
  assertProductAccess: jest.fn().mockResolvedValue(undefined),
  assertPriceAccess: jest.fn().mockResolvedValue(undefined),
  can: jest.fn().mockResolvedValue(false),
};

const mockAssignment = {
  id: 'assign-1',
  userId: 'user-1',
  resourceType: 'LISTA',
  resourceId: 'lista-1',
  level: 'view',
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('AssignmentsService', () => {
  let service: AssignmentsService;

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssignmentsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AclService, useValue: mockAcl },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();

    service = module.get<AssignmentsService>(AssignmentsService);
  });

  describe('findAll', () => {
    it('debe listar asignaciones sin filtros', async () => {
      mockPrisma.assignment.findMany.mockResolvedValue([mockAssignment]);

      const result = await service.findAll();

      expect(result.data).toHaveLength(1);
      expect(mockPrisma.assignment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({}) }),
      );
    });

    it('debe filtrar por userId y resourceType', async () => {
      mockPrisma.assignment.findMany.mockResolvedValue([mockAssignment]);

      await service.findAll({ userId: 'user-1', resourceType: 'LISTA' });

      expect(mockPrisma.assignment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: 'user-1', resourceType: 'LISTA' }),
        }),
      );
    });
  });

  describe('create', () => {
    it('debe crear una asignación con level por defecto view', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
      mockPrisma.lista.findUnique.mockResolvedValue({ id: 'lista-1' });
      mockPrisma.assignment.findUnique.mockResolvedValue(null);
      mockPrisma.assignment.create.mockResolvedValue(mockAssignment);

      const dto = { userId: 'user-1', resourceType: 'LISTA', resourceId: 'lista-1' };
      const result = await service.create(dto);

      expect(result.id).toBe('assign-1');
      expect(mockPrisma.assignment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ level: 'view' }),
        }),
      );
    });

    it('debe lanzar 404 si el usuario no existe', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const dto = { userId: 'no-existe', resourceType: 'LISTA', resourceId: 'lista-1' };
      await expect(service.create(dto)).rejects.toThrow(NotFoundException);
      await expect(service.create(dto)).rejects.toThrow('Usuario no encontrado');
    });

    it('debe rechazar resourceType CATALOG como tipo de recurso no soportado', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1' });

      const dto = { userId: 'user-1', resourceType: 'CATALOG', resourceId: 'catalog-1' };
      await expect(service.create(dto)).rejects.toThrow(NotFoundException);
      await expect(service.create(dto)).rejects.toThrow('Tipo de recurso no soportado: CATALOG');
    });

    it('debe lanzar 404 si el recurso LISTA no existe', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
      mockPrisma.lista.findUnique.mockResolvedValue(null);

      const dto = { userId: 'user-1', resourceType: 'LISTA', resourceId: 'no-existe' };
      await expect(service.create(dto)).rejects.toThrow(NotFoundException);
      await expect(service.create(dto)).rejects.toThrow('El recurso LISTA no existe');
    });

    it('debe lanzar 404 si el recurso PRICE_LIST no existe', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
      mockPrisma.priceList.findUnique.mockResolvedValue(null);

      const dto = { userId: 'user-1', resourceType: 'PRICE_LIST', resourceId: 'no-existe' };
      await expect(service.create(dto)).rejects.toThrow(NotFoundException);
      await expect(service.create(dto)).rejects.toThrow('El recurso PRICE_LIST no existe');
    });

    it('debe lanzar 404 si el recurso CATEGORY no existe', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
      mockPrisma.category.findUnique.mockResolvedValue(null);

      const dto = { userId: 'user-1', resourceType: 'CATEGORY', resourceId: 'no-existe' };
      await expect(service.create(dto)).rejects.toThrow(NotFoundException);
      await expect(service.create(dto)).rejects.toThrow('El recurso CATEGORY no existe');
    });

    it('debe lanzar 409 si ya existe una asignación activa', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
      mockPrisma.lista.findUnique.mockResolvedValue({ id: 'lista-1' });
      mockPrisma.assignment.findUnique.mockResolvedValue(mockAssignment);

      const dto = { userId: 'user-1', resourceType: 'LISTA', resourceId: 'lista-1' };
      await expect(service.create(dto)).rejects.toThrow(ConflictException);
      await expect(service.create(dto)).rejects.toThrow('Ya existe una asignación activa para ese recurso');
    });

    it('debe reactivar un par desactivado (soft-delete) sin colisión', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
      mockPrisma.lista.findUnique.mockResolvedValue({ id: 'lista-1' });
      mockPrisma.assignment.findUnique.mockResolvedValue({
        ...mockAssignment,
        isActive: false,
      });
      mockPrisma.assignment.update.mockResolvedValue({
        ...mockAssignment,
        isActive: true,
        level: 'edit',
      });

      const dto = { userId: 'user-1', resourceType: 'LISTA', resourceId: 'lista-1', level: 'edit' };
      const result = await service.create(dto);

      expect(result.isActive).toBe(true);
      expect(mockPrisma.assignment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isActive: true, level: 'edit' }),
        }),
      );
      expect(mockPrisma.assignment.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('debe actualizar level', async () => {
      mockPrisma.assignment.findUnique.mockResolvedValue(mockAssignment);
      mockPrisma.assignment.update.mockResolvedValue({ ...mockAssignment, level: 'manage' });

      const result = await service.update('assign-1', { level: 'manage' });

      expect(result.level).toBe('manage');
      expect(mockPrisma.assignment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ level: 'manage' }),
        }),
      );
    });

    it('debe actualizar isActive', async () => {
      mockPrisma.assignment.findUnique.mockResolvedValue(mockAssignment);
      mockPrisma.assignment.update.mockResolvedValue({ ...mockAssignment, isActive: false });

      const result = await service.update('assign-1', { isActive: false });

      expect(result.isActive).toBe(false);
    });

    it('debe lanzar NotFoundException si la asignación no existe', async () => {
      mockPrisma.assignment.findUnique.mockResolvedValue(null);

      await expect(service.update('no-existe', { level: 'manage' })).rejects.toThrow(NotFoundException);
      await expect(service.update('no-existe', { level: 'manage' })).rejects.toThrow('Asignación no encontrada');
    });
  });

  describe('remove', () => {
    it('debe desactivar lógicamente la asignación', async () => {
      mockPrisma.assignment.findUnique.mockResolvedValue(mockAssignment);
      mockPrisma.assignment.update.mockResolvedValue({ ...mockAssignment, isActive: false });

      await service.remove('assign-1');

      expect(mockPrisma.assignment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'assign-1' },
          data: expect.objectContaining({ isActive: false }),
        }),
      );
    });

    it('no debe actualizar si ya está inactiva', async () => {
      mockPrisma.assignment.findUnique.mockResolvedValue({ ...mockAssignment, isActive: false });

      await service.remove('assign-1');

      expect(mockPrisma.assignment.update).not.toHaveBeenCalled();
    });

    it('debe lanzar NotFoundException si la asignación no existe', async () => {
      mockPrisma.assignment.findUnique.mockResolvedValue(null);

      await expect(service.remove('no-existe')).rejects.toThrow(NotFoundException);
    });
  });
});
