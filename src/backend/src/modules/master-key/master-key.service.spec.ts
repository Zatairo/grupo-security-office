jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
  genSalt: jest.fn(),
}));

import { createPrismaMock } from '../../__test__/mocks/prisma.mock';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { MasterKeyService } from './master-key.service';
import { MasterKeyController } from './master-key.controller';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';

type AnyMock = ReturnType<typeof createPrismaMock>;

const mockAudit = { log: jest.fn().mockResolvedValue({}) };

const mockRecord = {
  id: 'global',
  keyHash: '$2b$10$hash-almacenado',
  updatedAt: new Date('2026-08-19T00:00:00Z'),
  updatedById: 'user-1',
};

const ADMIN = { userId: 'admin-1', roles: ['Super Admin'] };

describe('MasterKeyService', () => {
  let service: MasterKeyService;
  let mockPrisma: AnyMock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma = createPrismaMock();
    service = new MasterKeyService(mockPrisma as any, mockAudit as any);
  });

  describe('getStatus', () => {
    it('sin clave configurada → configured false, sin updatedAt/updatedBy y NUNCA expone hash', async () => {
      mockPrisma.masterKey.findUnique.mockResolvedValue(null);

      const res = await service.getStatus();

      expect(res.data).toEqual({ configured: false, updatedAt: null, updatedBy: null });
      expect(JSON.stringify(res)).not.toContain('keyHash');
    });

    it('con clave configurada → configured true, updatedAt y updatedBy resuelto (sin hash)', async () => {
      mockPrisma.masterKey.findUnique.mockResolvedValue(mockRecord);
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', name: 'Admin Root' });

      const res = await service.getStatus();

      expect(res.data.configured).toBe(true);
      expect(res.data.updatedAt).toEqual(mockRecord.updatedAt);
      expect(res.data.updatedBy).toEqual({ id: 'user-1', name: 'Admin Root' });
      expect(JSON.stringify(res)).not.toContain('keyHash');
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        select: { id: true, name: true },
      });
    });

    it('con clave configurada y updatedById inexistente → updatedBy null', async () => {
      mockPrisma.masterKey.findUnique.mockResolvedValue(mockRecord);
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const res = await service.getStatus();

      expect(res.data.updatedBy).toBeNull();
    });
  });

  describe('setMasterKey', () => {
    it('sin clave existente → hashea, hace upsert del id global y audita create', async () => {
      mockPrisma.masterKey.findUnique.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('$2b$10$nuevo-hash');
      mockPrisma.masterKey.upsert.mockResolvedValue({ ...mockRecord, keyHash: '$2b$10$nuevo-hash' });

      const res = await service.setMasterKey({ masterKey: 'nueva-clave' }, ADMIN);

      expect(bcrypt.hash).toHaveBeenCalledWith('nueva-clave', 10);
      expect(mockPrisma.masterKey.upsert).toHaveBeenCalledWith({
        where: { id: 'global' },
        create: { id: 'global', keyHash: '$2b$10$nuevo-hash', updatedById: ADMIN.userId },
        update: { keyHash: '$2b$10$nuevo-hash', updatedById: ADMIN.userId },
      });
      expect(res.data.configured).toBe(true);
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'create',
          entity: 'MasterKey',
          entityId: 'global',
          newValues: { configured: true },
        }),
      );
      // La audit nunca guarda el hash ni la clave en claro.
      const auditCall = mockAudit.log.mock.calls[0][0];
      expect(JSON.stringify(auditCall)).not.toContain('keyHash');
      expect(JSON.stringify(auditCall)).not.toContain('nueva-clave');
    });

    it('con clave existente y currentMasterKey correcta → actualiza y audita update', async () => {
      mockPrisma.masterKey.findUnique.mockResolvedValue(mockRecord);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('$2b$10$nuevo-hash');
      mockPrisma.masterKey.upsert.mockResolvedValue({ ...mockRecord, keyHash: '$2b$10$nuevo-hash' });

      await service.setMasterKey({ masterKey: 'nueva-clave', currentMasterKey: 'actual' }, ADMIN);

      expect(bcrypt.compare).toHaveBeenCalledWith('actual', mockRecord.keyHash);
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'update', entity: 'MasterKey', newValues: { configured: true } }),
      );
    });

    it('con clave existente y currentMasterKey incorrecta → 403 (Clave maestra actual incorrecta)', async () => {
      mockPrisma.masterKey.findUnique.mockResolvedValue(mockRecord);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.setMasterKey({ masterKey: 'nueva-clave', currentMasterKey: 'mala' }, ADMIN),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.setMasterKey({ masterKey: 'nueva-clave', currentMasterKey: 'mala' }, ADMIN),
      ).rejects.toThrow('Clave maestra actual incorrecta');
      expect(mockPrisma.masterKey.upsert).not.toHaveBeenCalled();
      expect(mockAudit.log).not.toHaveBeenCalled();
    });

    it('con clave existente y SIN currentMasterKey → 403', async () => {
      mockPrisma.masterKey.findUnique.mockResolvedValue(mockRecord);

      await expect(
        service.setMasterKey({ masterKey: 'nueva-clave' }, ADMIN),
      ).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.masterKey.upsert).not.toHaveBeenCalled();
    });
  });

  describe('removeMasterKey', () => {
    it('con clave configurada → elimina y audita delete', async () => {
      mockPrisma.masterKey.findUnique.mockResolvedValue(mockRecord);
      mockPrisma.masterKey.delete.mockResolvedValue(mockRecord);

      const res = await service.removeMasterKey(ADMIN);

      expect(res.data.configured).toBe(false);
      expect(mockPrisma.masterKey.delete).toHaveBeenCalledWith({ where: { id: 'global' } });
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'delete', entity: 'MasterKey', entityId: 'global' }),
      );
    });

    it('sin clave configurada → 404', async () => {
      mockPrisma.masterKey.findUnique.mockResolvedValue(null);

      await expect(service.removeMasterKey(ADMIN)).rejects.toThrow(NotFoundException);
      expect(mockPrisma.masterKey.delete).not.toHaveBeenCalled();
    });
  });

  describe('validateMasterKey', () => {
    it('con registro → true si bcrypt.compare coincide', async () => {
      mockPrisma.masterKey.findUnique.mockResolvedValue(mockRecord);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const ok = await service.validateMasterKey('clave-correcta');

      expect(ok).toBe(true);
      expect(bcrypt.compare).toHaveBeenCalledWith('clave-correcta', mockRecord.keyHash);
    });

    it('con registro → false si bcrypt.compare no coincide', async () => {
      mockPrisma.masterKey.findUnique.mockResolvedValue(mockRecord);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const ok = await service.validateMasterKey('clave-mala');

      expect(ok).toBe(false);
    });

    it('sin registro (clave no configurada) → false sin llamar bcrypt', async () => {
      mockPrisma.masterKey.findUnique.mockResolvedValue(null);

      const ok = await service.validateMasterKey('cualquiera');

      expect(ok).toBe(false);
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });
  });

  describe('roles — solo Super Admin (decorators del controller)', () => {
    it('GET/PUT/DELETE exponen @Roles(Super Admin)', () => {
      expect(Reflect.getMetadata(ROLES_KEY, MasterKeyController.prototype.getStatus)).toEqual([
        'Super Admin',
      ]);
      expect(Reflect.getMetadata(ROLES_KEY, MasterKeyController.prototype.set)).toEqual([
        'Super Admin',
      ]);
      expect(Reflect.getMetadata(ROLES_KEY, MasterKeyController.prototype.remove)).toEqual([
        'Super Admin',
      ]);
    });
  });
});