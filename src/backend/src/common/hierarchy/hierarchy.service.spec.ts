import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { HierarchyService } from './hierarchy.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('HierarchyService', () => {
  let service: HierarchyService;
  let prismaMock: any;

  beforeEach(async () => {
    prismaMock = {
      $queryRaw: jest.fn(),
      user: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HierarchyService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = module.get<HierarchyService>(HierarchyService);
  });

  describe('getSubordinateIds', () => {
    it('3-level chain returns all subordinates', async () => {
      prismaMock.$queryRaw.mockResolvedValueOnce([
        { id: 'b', depth: 1 },
        { id: 'c', depth: 2 },
      ]);
      const result = await service.getSubordinateIds('a');
      expect(result).toContain('b');
      expect(result).toContain('c');
    });

    it('includeSelf true returns self', async () => {
      prismaMock.$queryRaw.mockResolvedValueOnce([
        { id: 'b', depth: 1 },
      ]);
      const result = await service.getSubordinateIds('a', { includeSelf: true });
      expect(result).toContain('a');
      expect(result).toContain('b');
    });
  });

  describe('getAncestorIds', () => {
    it('returns ancestors', async () => {
      prismaMock.$queryRaw.mockResolvedValueOnce([
        { id: 'b', depth: 1 },
        { id: 'c', depth: 2 },
      ]);
      const result = await service.getAncestorIds('a');
      expect(result).toContain('b');
      expect(result).toContain('c');
    });
  });

  describe('assertCanViewUser', () => {
    it('Super Admin can view anyone', async () => {
      const ctx = { userId: 'admin-id', roles: ['Super Admin'] };
      await expect(service.assertCanViewUser(ctx, 'any-user-id')).resolves.not.toThrow();
    });

    it('user can view self', async () => {
      const ctx = { userId: 'user-id', roles: ['Operador'] };
      await expect(service.assertCanViewUser(ctx, 'user-id')).resolves.not.toThrow();
    });

    it('supervisor can view subordinate', async () => {
      prismaMock.$queryRaw.mockResolvedValueOnce([
        { id: 'sub-id', depth: 1 },
      ]);
      const ctx = { userId: 'sup-id', roles: ['Supervisor'] };
      await expect(service.assertCanViewUser(ctx, 'sub-id')).resolves.not.toThrow();
    });

    it('denies unrelated user', async () => {
      prismaMock.$queryRaw.mockResolvedValueOnce([]);
      const ctx = { userId: 'user-id', roles: ['Operador'] };
      await expect(service.assertCanViewUser(ctx, 'other-id')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('assertCanSetSupervisor', () => {
    it('allows null supervisor', async () => {
      await expect(service.assertCanSetSupervisor('a', null)).resolves.not.toThrow();
    });

    it('allows valid supervisor', async () => {
      prismaMock.$queryRaw.mockResolvedValueOnce([]);
      await expect(service.assertCanSetSupervisor('a', 'b')).resolves.not.toThrow();
    });

    it('prevents direct cycle', async () => {
      prismaMock.$queryRaw.mockResolvedValueOnce([
        { id: 'a', depth: 1 },
      ]);
      await expect(service.assertCanSetSupervisor('a', 'b')).rejects.toThrow(ConflictException);
    });

    it('prevents indirect cycle', async () => {
      prismaMock.$queryRaw.mockResolvedValueOnce([
        { id: 'b', depth: 1 },
        { id: 'a', depth: 2 },
      ]);
      await expect(service.assertCanSetSupervisor('a', 'c')).rejects.toThrow(ConflictException);
    });
  });
});
