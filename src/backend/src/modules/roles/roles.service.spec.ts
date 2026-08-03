import { createPrismaMock } from '../../__test__/mocks/prisma.mock';

const mockPrisma = createPrismaMock();

jest.mock('../../prisma/prisma.service', () => ({
  PrismaService: jest.fn().mockImplementation(() => mockPrisma),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { RolesService } from './roles.service';
import { PrismaService } from '../../prisma/prisma.service';

const mockRole = {
  id: 'role-1',
  name: 'Super Admin',
  description: 'Acceso total al sistema',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockRoleWithPermissions = {
  ...mockRole,
  permissions: [
    { roleId: 'role-1', permission: 'products:read' },
    { roleId: 'role-1', permission: 'products:write' },
  ],
  _count: { users: 3 },
};

const mockRoleWithUsers = {
  ...mockRole,
  permissions: [
    { roleId: 'role-1', permission: 'products:read' },
  ],
  users: [
    { userId: 'u1', roleId: 'role-1', user: { id: 'u1', name: 'User 1', email: 'user1@test.com' } },
  ],
};

describe('RolesService', () => {
  let service: RolesService;

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<RolesService>(RolesService);
  });

  describe('findAll', () => {
    it('debe listar roles con permisos y conteo de usuarios', async () => {
      mockPrisma.role.findMany.mockResolvedValue([mockRoleWithPermissions]);

      const result = await service.findAll();

      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe('Super Admin');
      expect(result.data[0].permissions).toEqual(['products:read', 'products:write']);
      expect(result.data[0].userCount).toBe(3);
    });
  });

  describe('findOne', () => {
    it('debe retornar rol por id con permisos y usuarios', async () => {
      mockPrisma.role.findUnique.mockResolvedValue(mockRoleWithUsers);

      const result = await service.findOne('role-1');

      expect(result.name).toBe('Super Admin');
      expect(result.permissions).toEqual(['products:read']);
      expect(result.users).toHaveLength(1);
    });

    it('debe lanzar NotFoundException cuando el rol no existe', async () => {
      mockPrisma.role.findUnique.mockResolvedValue(null);

      await expect(service.findOne('no-existe')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('debe crear un rol con permisos asociados', async () => {
      mockPrisma.role.findUnique.mockResolvedValue(null);
      mockPrisma.role.create.mockResolvedValue({
        ...mockRole,
        permissions: [
          { roleId: 'role-1', permission: 'products:read' },
        ],
      });

      const dto = { name: 'Editor', description: 'Editor de contenido', permissions: ['products:read'] };
      const result = await service.create(dto);

      expect(result.name).toBe('Super Admin');
      expect(result.permissions).toContain('products:read');
      expect(mockPrisma.role.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Editor',
            permissions: expect.objectContaining({
              create: expect.arrayContaining([{ permission: 'products:read' }]),
            }),
          }),
        }),
      );
    });

    it('debe rechazar nombre duplicado con ConflictException', async () => {
      mockPrisma.role.findUnique.mockResolvedValue(mockRole);

      const dto = { name: 'Super Admin' };

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
      await expect(service.create(dto)).rejects.toThrow('Ya existe un rol con ese nombre');
    });
  });

  describe('update', () => {
    it('debe actualizar un rol', async () => {
      mockPrisma.role.findUnique.mockResolvedValueOnce(mockRole);
      mockPrisma.role.findUnique.mockResolvedValueOnce(null);
      mockPrisma.rolePermission.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.role.update.mockResolvedValue({
        ...mockRoleWithPermissions,
        name: 'Super Admin',
      });

      const dto = { name: 'Super Admin', permissions: ['products:read', 'products:write'] };
      const result = await service.update('role-1', dto);

      expect(result.name).toBe('Super Admin');
    });

    it('debe lanzar NotFoundException si el rol no existe', async () => {
      mockPrisma.role.findUnique.mockResolvedValue(null);

      await expect(service.update('no-existe', { name: 'Nope' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('debe eliminar un rol sin usuarios asignados', async () => {
      mockPrisma.role.findUnique.mockResolvedValue({ ...mockRoleWithPermissions, users: [] });
      mockPrisma.rolePermission.deleteMany.mockResolvedValue({ count: 2 });
      mockPrisma.role.delete.mockResolvedValue(mockRole);

      const result = await service.remove('role-1');

      expect(result.message).toBe('Rol eliminado exitosamente');
    });

    it('debe lanzar ConflictException si el rol tiene usuarios asignados', async () => {
      mockPrisma.role.findUnique.mockResolvedValue(mockRoleWithUsers);

      await expect(service.remove('role-1')).rejects.toThrow(ConflictException);
      await expect(service.remove('role-1')).rejects.toThrow('No se puede eliminar un rol asignado a usuarios');
    });

    it('debe lanzar NotFoundException si el rol no existe', async () => {
      mockPrisma.role.findUnique.mockResolvedValue(null);

      await expect(service.remove('no-existe')).rejects.toThrow(NotFoundException);
    });
  });
});
