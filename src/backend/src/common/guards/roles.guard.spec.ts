import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  let rolesGuard: RolesGuard;
  let mockReflector: jest.Mocked<Pick<Reflector, 'getAllAndOverride'>>;

  beforeEach(async () => {
    mockReflector = {
      getAllAndOverride: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesGuard,
        {
          provide: Reflector,
          useValue: mockReflector,
        },
      ],
    }).compile();

    rolesGuard = module.get<RolesGuard>(RolesGuard);
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
    it('debe retornar true cuando el usuario tiene el rol requerido', () => {
      mockReflector.getAllAndOverride.mockReturnValue(['Admin']);

      const result = rolesGuard.canActivate(
        createMockContext({ roles: ['Admin', 'Operator'] }),
      );

      expect(result).toBe(true);
      expect(mockReflector.getAllAndOverride).toHaveBeenCalled();
    });

    it('debe retornar false cuando el usuario no tiene el rol requerido', () => {
      mockReflector.getAllAndOverride.mockReturnValue(['Admin']);

      const result = rolesGuard.canActivate(
        createMockContext({ roles: ['Operator'] }),
      );

      expect(result).toBe(false);
    });

    it('debe retornar true cuando requiredRoles es null (sin metadata)', () => {
      mockReflector.getAllAndOverride.mockReturnValue(null);

      const result = rolesGuard.canActivate(
        createMockContext({ roles: ['Admin'] }),
      );

      expect(result).toBe(true);
    });

    it('debe retornar true cuando requiredRoles es array vacío', () => {
      mockReflector.getAllAndOverride.mockReturnValue([]);

      const result = rolesGuard.canActivate(
        createMockContext({ roles: ['Admin'] }),
      );

      expect(result).toBe(true);
    });

    it('debe retornar false cuando no hay usuario en request', () => {
      mockReflector.getAllAndOverride.mockReturnValue(['Admin']);

      const result = rolesGuard.canActivate(createMockContext(undefined));

      expect(result).toBe(false);
    });

    it('debe retornar false cuando user.roles es undefined', () => {
      mockReflector.getAllAndOverride.mockReturnValue(['Admin']);

      const result = rolesGuard.canActivate(createMockContext({}));

      expect(result).toBe(false);
    });

    it('debe retornar false cuando user.roles es null', () => {
      mockReflector.getAllAndOverride.mockReturnValue(['Admin']);

      const result = rolesGuard.canActivate(createMockContext({ roles: null }));

      expect(result).toBe(false);
    });

    it('debe retornar true cuando el usuario tiene uno de los roles requeridos', () => {
      mockReflector.getAllAndOverride.mockReturnValue(['Admin', 'SuperAdmin']);

      const result = rolesGuard.canActivate(
        createMockContext({ roles: ['Operator', 'SuperAdmin'] }),
      );

      expect(result).toBe(true);
    });
  });
});