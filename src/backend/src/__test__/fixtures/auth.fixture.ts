/**
 * Auth fixtures — datos de prueba reutilizables para tests de autenticación.
 *
 * Los fixtures se adhieren a los tipos Prisma generados para evitar
 * falsos positivos por diferencias de estructura.
 */

import { Role, User } from '@prisma/client';

/**
 * Usuario activo con roles y permisos completos.
 * Simula un Admin con todos los permisos del sistema.
 */
export const buildActiveUser = (overrides: Partial<User> = {}): User => ({
  id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  email: 'admin@grupo-security.com',
  name: 'Admin Principal',
  password: '$2b$10$hash_del_password_valido', // bcrypt hash
  isActive: true,
  createdAt: new Date('2025-01-01T00:00:00Z'),
  updatedAt: new Date('2025-01-01T00:00:00Z'),
  ...overrides,
});

/**
 * Usuario inactivo (desactivado).
 */
export const buildInactiveUser = (overrides: Partial<User> = {}): User => ({
  id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
  email: 'inactivo@grupo-security.com',
  name: 'Usuario Inactivo',
  password: '$2b$10$hash_del_password_valido',
  isActive: false,
  createdAt: new Date('2025-01-01T00:00:00Z'),
  updatedAt: new Date('2025-01-01T00:00:00Z'),
  ...overrides,
});

/**
 * Rol Admin con permisos completos.
 */
export const buildAdminRole = (overrides: Partial<Role> = {}): Role => ({
  id: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
  name: 'Admin',
  description: 'Administrador del sistema',
  createdAt: new Date('2025-01-01T00:00:00Z'),
  updatedAt: new Date('2025-01-01T00:00:00Z'),
  ...overrides,
});

/**
 * Rol Operator con permisos limitados.
 */
export const buildOperatorRole = (overrides: Partial<Role> = {}): Role => ({
  id: 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44',
  name: 'Operator',
  description: 'Operador de catálogo',
  createdAt: new Date('2025-01-01T00:00:00Z'),
  updatedAt: new Date('2025-01-01T00:00:00Z'),
  ...overrides,
});

/**
 * Estructura completa de Prisma para user con roles incluidos.
 * Este es el formato que devuelve prisma.user.findUnique({ include: { roles: { include: { role: { include: { permissions: true } } } } } })
 */
export const buildUserWithRoles = (
  user: User,
  roles: Array<{ role: Role; permissions: string[] }>,
) => ({
  ...user,
  roles: roles.map(({ role, permissions }) => ({
    userId: user.id,
    roleId: role.id,
    createdAt: new Date(),
    role: {
      ...role,
      permissions: permissions.map((p) => ({
        roleId: role.id,
        permission: p,
        createdAt: new Date(),
      })),
    },
  })),
});

/**
 * Resultado esperado de validateUser para un Admin.
 */
export const buildExpectedUserData = () => ({
  id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  email: 'admin@grupo-security.com',
  name: 'Admin Principal',
  roles: ['Admin'],
  permissions: [
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
  ],
});
