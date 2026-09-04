import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';

describe('PermissionsGuard', () => {
  let guard: PermissionsGuard;
  let mockReflector: jest.Mocked<Pick<Reflector, 'getAllAndOverride'>>;

  beforeEach(async () => {
    mockReflector = {
      getAllAndOverride: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionsGuard,
        { provide: Reflector, useValue: mockReflector },
      ],
    }).compile();

    guard = module.get<PermissionsGuard>(PermissionsGuard);
  });

  const createMockContext = (user?: any) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    }) as any;

  describe('canActivate', () => {
    it('retorna true cuando el usuario posee el permiso requerido', () => {
      mockReflector.getAllAndOverride.mockReturnValue(['listas:delete']);

      const result = guard.canActivate(
        createMockContext({
          roles: ['Admin Comercial'],
          permissions: ['listas:delete'],
        }),
      );

      expect(result).toBe(true);
    });

    it('retorna false cuando el usuario no posee el permiso requerido', () => {
      mockReflector.getAllAndOverride.mockReturnValue(['listas:delete']);

      const result = guard.canActivate(
        createMockContext({ roles: ['Admin Comercial'], permissions: ['listas:create'] }),
      );

      expect(result).toBe(false);
    });

    it('retorna true cuando requirements es null (sin metadata)', () => {
      mockReflector.getAllAndOverride.mockReturnValue(null);

      expect(guard.canActivate(createMockContext({ roles: ['Operador'], permissions: [] }))).toBe(true);
    });

    it('retorna true cuando requirements es array vacío', () => {
      mockReflector.getAllAndOverride.mockReturnValue([]);

      expect(guard.canActivate(createMockContext({ roles: ['Operador'], permissions: [] }))).toBe(true);
    });

    it('retorna false cuando no hay usuario en request', () => {
      mockReflector.getAllAndOverride.mockReturnValue(['listas:delete']);

      expect(guard.canActivate(createMockContext(undefined))).toBe(false);
    });

    it('retorna false cuando user.permissions es undefined', () => {
      mockReflector.getAllAndOverride.mockReturnValue(['listas:delete']);

      expect(guard.canActivate(createMockContext({ roles: ['Admin Comercial'] }))).toBe(false);
    });

    it('exige que todos los permisos requeridos se cumplan (every)', () => {
      mockReflector.getAllAndOverride.mockReturnValue(['listas:delete', 'assignments:manage']);

      const result = guard.canActivate(
        createMockContext({ roles: ['Admin Comercial'], permissions: ['listas:delete'] }),
      );

      expect(result).toBe(false);
    });

    describe('excepción Super Admin', () => {
      it('retorna true aunque la lista de permisos esté vacía', () => {
        mockReflector.getAllAndOverride.mockReturnValue(['listas:delete']);

        expect(
          guard.canActivate(createMockContext({ roles: ['Super Admin'], permissions: [] })),
        ).toBe(true);
      });

      it('retorna true aunque falte el permiso requerido', () => {
        mockReflector.getAllAndOverride.mockReturnValue(['assignments:manage']);

        expect(
          guard.canActivate(
            createMockContext({ roles: ['Super Admin'], permissions: ['products:read'] }),
          ),
        ).toBe(true);
      });
    });

    describe('compatibilidad legacy publish:manage → products:publish', () => {
      it('acepta publish:manage como equivalente a products:publish', () => {
        mockReflector.getAllAndOverride.mockReturnValue(['products:publish']);

        expect(
          guard.canActivate(
            createMockContext({ roles: ['Supervisor'], permissions: ['publish:manage'] }),
          ),
        ).toBe(true);
      });

      it('no trata publish:manage como equivalente a otros permisos (listas:publish)', () => {
        mockReflector.getAllAndOverride.mockReturnValue(['listas:publish']);

        expect(
          guard.canActivate(
            createMockContext({ roles: ['Supervisor'], permissions: ['publish:manage'] }),
          ),
        ).toBe(false);
      });
    });
  });
});