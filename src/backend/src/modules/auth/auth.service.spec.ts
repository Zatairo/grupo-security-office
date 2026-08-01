// ---------------------------------------------------------------------------
// Mock de bcrypt — evita error de binding nativo en Windows
// ---------------------------------------------------------------------------
jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
  genSalt: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Mock de PrismaService — evita depender de prisma generate
// ---------------------------------------------------------------------------
import { createPrismaMock } from '../../__test__/mocks/prisma.mock';

const mockPrisma = createPrismaMock();

jest.mock('../../prisma/prisma.service', () => ({
  PrismaService: jest.fn().mockImplementation(() => mockPrisma),
}));

// ---------------------------------------------------------------------------
// Imports reales
// ---------------------------------------------------------------------------
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  buildActiveUser,
  buildInactiveUser,
  buildAdminRole,
  buildOperatorRole,
  buildUserWithRoles,
  buildExpectedUserData,
} from '../../__test__/fixtures/auth.fixture';

// ---------------------------------------------------------------------------
// Escenarios cubiertos:
// ✅ validateUser - usuario existe, activo y password correcto → datos del usuario
// ✅ validateUser - email con mayúsculas → normalizado a lowercase
// ✅ validateUser - usuario no existe → 401
// ✅ validateUser - usuario inactivo → 401
// ✅ validateUser - password incorrecto → 401
// ✅ validateUser - roles múltiples y permisos → deduplicados correctamente
// ✅ login - retorna JWT token + datos del usuario
// ✅ login - error de firma JWT → propagado
// ✅ getProfile - usuario válido → datos del usuario
// ✅ getProfile - usuario no existe → 401
// ⚠  getProfile - usuario inactivo → NO verifica isActive (riesgo documentado)
// ---------------------------------------------------------------------------

const mockJwtService = {
  sign: jest.fn().mockReturnValue('jwt-token-mock'),
  verify: jest.fn(),
  decode: jest.fn(),
};

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(async () => {
    // Limpiar mocks entre tests
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
  });

  // -----------------------------------------------------------------------
  //  validateUser
  // -----------------------------------------------------------------------

  describe('validateUser', () => {
    /**
     * HAPPY PATH: usuario activo con password válido.
     * Riesgo: si este flujo se rompe, NADIE puede loguearse.
     * El sistema queda completamente inoperable.
     */
    it('debe retornar datos del usuario cuando email y password son correctos', async () => {
      const user = buildActiveUser();
      const adminRole = buildAdminRole();
      const permissions = [
        'products:read',
        'products:write',
        'products:publish',
        'categories:read',
        'categories:write',
        'brands:read',
        'brands:write',
        'users:read',
        'users:write',
        'roles:read',
        'roles:write',
        'prices:read',
        'prices:write',
        'audit:read',
      ];

      const userWithRoles = buildUserWithRoles(user, [{ role: adminRole, permissions }]);

      mockPrisma.user.findUnique.mockResolvedValue(userWithRoles);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await authService.validateUser(
        'admin@grupo-security.com',
        'password123',
      );

      expect(result).toEqual(buildExpectedUserData());
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'admin@grupo-security.com' },
        include: {
          roles: {
            include: {
              role: {
                include: {
                  permissions: true,
                },
              },
            },
          },
        },
      });
    });

    /**
     * HAPPY PATH / SEGURIDAD: email normalizado a lowercase.
     * Riesgo: usuarios que escriben su email con mayúsculas
     * (ej. "Admin@Grupo-Security.com") no podrían autenticarse
     * si la query no normaliza.
     */
    it('debe normalizar email a lowercase antes de consultar', async () => {
      const user = buildActiveUser();
      const userWithRoles = buildUserWithRoles(user, [
        { role: buildAdminRole(), permissions: [] },
      ]);

      mockPrisma.user.findUnique.mockResolvedValue(userWithRoles);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await authService.validateUser('ADMIN@GRUPO-SECURITY.COM', 'password123');

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'admin@grupo-security.com' },
        include: expect.any(Object),
      });
    });

    /**
     * ERROR PATH: usuario no existe en BD.
     * Riesgo de seguridad: el mensaje de error debe ser genérico
     * ("Credenciales inválidas") para prevenir user enumeration.
     */
    it('debe lanzar 401 cuando el usuario no existe', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        authService.validateUser('no-existe@test.com', 'password123'),
      ).rejects.toThrow(UnauthorizedException);

      await expect(
        authService.validateUser('no-existe@test.com', 'password123'),
      ).rejects.toThrow('Credenciales inválidas');
    });

    /**
     * ERROR PATH: usuario existe pero está desactivado.
     * El mensaje debe ser idéntico al de "usuario no existe"
     * para no filtrar información sobre usuarios inactivos.
     */
    it('debe lanzar 401 cuando el usuario está inactivo', async () => {
      const inactiveUser = buildInactiveUser();
      mockPrisma.user.findUnique.mockResolvedValue(inactiveUser);

      await expect(
        authService.validateUser('inactivo@grupo-security.com', 'password123'),
      ).rejects.toThrow(UnauthorizedException);

      await expect(
        authService.validateUser('inactivo@grupo-security.com', 'password123'),
      ).rejects.toThrow('Credenciales inválidas');
    });

    /**
     * ERROR PATH: password incorrecto.
     * Mismo error genérico — no revelar si el email existe.
     */
    it('debe lanzar 401 cuando el password es incorrecto', async () => {
      const user = buildActiveUser();
      const userWithRoles = buildUserWithRoles(user, [
        { role: buildAdminRole(), permissions: [] },
      ]);

      mockPrisma.user.findUnique.mockResolvedValue(userWithRoles);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        authService.validateUser('admin@grupo-security.com', 'wrong-password'),
      ).rejects.toThrow(UnauthorizedException);

      await expect(
        authService.validateUser('admin@grupo-security.com', 'wrong-password'),
      ).rejects.toThrow('Credenciales inválidas');
    });

    /**
     * PERMISOS: deduplicación con roles superpuestos.
     * Riesgo: si dos roles comparten permisos (ej. Admin y Operator
     * tienen ambos 'products:read'), el array final debe tener
     * cada permiso una sola vez para evitar bugs en la UI.
     */
    it('debe deduplicar permisos cuando el usuario tiene múltiples roles', async () => {
      const user = buildActiveUser();
      const adminRole = buildAdminRole();
      const operatorRole = buildOperatorRole();

      const adminPermissions = ['products:read', 'products:write', 'products:publish'];
      const operatorPermissions = ['products:read', 'categories:read'];

      const userWithRoles = buildUserWithRoles(user, [
        { role: adminRole, permissions: adminPermissions },
        { role: operatorRole, permissions: operatorPermissions },
      ]);

      mockPrisma.user.findUnique.mockResolvedValue(userWithRoles);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await authService.validateUser(
        'admin@grupo-security.com',
        'password123',
      );

      // 'products:read' debe aparecer una sola vez
      expect(result.permissions).toEqual([
        'products:read',
        'products:write',
        'products:publish',
        'categories:read',
      ]);
    });

    /**
     * ERROR PATH: email null/undefined.
     * El servicio no debe asumir que el DTO siempre envía strings.
     * Aunque el ValidationPipe lo atrape en controller,
     * proteger el servicio es defensivo.
     */
    it('debe lanzar error cuando email es null/undefined', async () => {
      await expect(
        authService.validateUser(null as any, 'password123'),
      ).rejects.toThrow();

      await expect(
        authService.validateUser(undefined as any, 'password123'),
      ).rejects.toThrow();
    });
  });

  // -----------------------------------------------------------------------
  //  login
  // -----------------------------------------------------------------------

  describe('login', () => {
    /**
     * HAPPY PATH: login retorna token JWT + datos del usuario.
     * Verifica que el payload del JWT contiene TODOS los campos
     * necesarios para autorización (sub, email, name, roles, permissions).
     */
    it('debe retornar token JWT y datos del usuario con payload completo', async () => {
      const userData = buildExpectedUserData();

      const result = await authService.login(userData);

      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('user');
      expect(result.user).toEqual(userData);
      expect(result.token).toBe('jwt-token-mock');

      expect(mockJwtService.sign).toHaveBeenCalledWith({
        sub: userData.id,
        email: userData.email,
        name: userData.name,
        roles: userData.roles,
        permissions: userData.permissions,
      });
    });

    /**
     * ERROR PATH: fallo en firma JWT (ej. secret no configurado).
     * El error no debe ser capturado silenciosamente.
     */
    it('debe propagar error si JwtService.sign falla', async () => {
      mockJwtService.sign.mockImplementationOnce(() => {
        throw new Error('JWT signing failed');
      });

      const userData = buildExpectedUserData();

      await expect(authService.login(userData)).rejects.toThrow(
        'JWT signing failed',
      );
    });
  });

  // -----------------------------------------------------------------------
  //  getProfile
  // -----------------------------------------------------------------------

  describe('getProfile', () => {
    /**
     * HAPPY PATH: usuario válido → retorna datos del perfil.
     */
    it('debe retornar perfil del usuario cuando existe', async () => {
      const user = buildActiveUser();
      const userWithRoles = buildUserWithRoles(user, [
        {
          role: buildAdminRole(),
          permissions: ['products:read', 'products:write'],
        },
      ]);

      mockPrisma.user.findUnique.mockResolvedValue(userWithRoles);

      const result = await authService.getProfile(user.id);

      expect(result).toMatchObject({
        id: user.id,
        email: user.email,
        name: user.name,
        roles: ['Admin'],
        permissions: ['products:read', 'products:write'],
      });
    });

    /**
     * ERROR PATH: usuario no encontrado (eliminado, ID inválido).
     */
    it('debe lanzar 401 cuando el usuario no existe', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        authService.getProfile('id-inexistente'),
      ).rejects.toThrow(UnauthorizedException);

      await expect(
        authService.getProfile('id-inexistente'),
      ).rejects.toThrow('Usuario no encontrado');
    });

    /**
     * ⚠ RIESGO DOCUMENTADO: getProfile NO verifica isActive.
     * Un usuario desactivado (isActive: false) con un JWT aún vivo
     * puede obtener su perfil exitosamente. Esto no representa un
     * riesgo de seguridad crítico porque JwtStrategy.validate sí
     * verifica isActive, pero es una inconsistencia.
     */
    it('NO verifica isActive — RIESGO: usuario desactivado con token vivo aún accede a profile', async () => {
      const inactiveUser = buildInactiveUser();
      const userWithRoles = buildUserWithRoles(inactiveUser, [
        { role: buildAdminRole(), permissions: [] },
      ]);

      mockPrisma.user.findUnique.mockResolvedValue(userWithRoles);

      const result = await authService.getProfile(inactiveUser.id);

      expect(result).toBeDefined();
      expect(result.id).toBe(inactiveUser.id);
      // ⚠ Riesgo: getProfile no lanza error aunque user.isActive === false
    });
  });

  // -----------------------------------------------------------------------
  //  Cenarios de acceso real — escenarios de seguridad críticos
  // -----------------------------------------------------------------------

  describe('Cenarios de acceso real', () => {
    it('debe rechazar login de usuario inactivo', async () => {
      const inactiveUser = buildInactiveUser();
      mockPrisma.user.findUnique.mockResolvedValue(inactiveUser);

      await expect(
        authService.validateUser('inactivo@grupo-security.com', 'password123'),
      ).rejects.toThrow(UnauthorizedException);

      await expect(
        authService.validateUser('inactivo@grupo-security.com', 'password123'),
      ).rejects.toThrow('Credenciales inválidas');
    });

    it('debe rechazar login con contraseña incorrecta', async () => {
      const user = buildActiveUser();
      const userWithRoles = buildUserWithRoles(user, [
        { role: buildAdminRole(), permissions: [] },
      ]);

      mockPrisma.user.findUnique.mockResolvedValue(userWithRoles);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        authService.validateUser('admin@grupo-security.com', 'wrong-password'),
      ).rejects.toThrow(UnauthorizedException);

      await expect(
        authService.validateUser('admin@grupo-security.com', 'wrong-password'),
      ).rejects.toThrow('Credenciales inválidas');
    });

    it('debe rechazar login de usuario inexistente', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        authService.validateUser('no-existe@test.com', 'password123'),
      ).rejects.toThrow(UnauthorizedException);

      await expect(
        authService.validateUser('no-existe@test.com', 'password123'),
      ).rejects.toThrow('Credenciales inválidas');
    });

    it('debe retornar user con roles y permissions en login exitoso', async () => {
      const user = buildActiveUser();
      const adminRole = buildAdminRole();
      const permissions = ['products:read', 'products:write', 'users:read'];

      const userWithRoles = buildUserWithRoles(user, [
        { role: adminRole, permissions },
      ]);

      mockPrisma.user.findUnique.mockResolvedValue(userWithRoles);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await authService.validateUser(
        'admin@grupo-security.com',
        'password123',
      );

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('email');
      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('roles');
      expect(result).toHaveProperty('permissions');
      expect(result.id).toBe(user.id);
      expect(result.email).toBe('admin@grupo-security.com');
      expect(result.name).toBe('Admin Principal');
      expect(result.roles).toEqual(['Admin']);
      expect(result.permissions).toEqual(permissions);
    });
  });
});
