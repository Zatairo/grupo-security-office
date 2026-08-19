import 'reflect-metadata';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { UsersController } from './users.controller';

describe('UsersController — matriz de roles (contrato)', () => {
  const rolesOf = (method: Function): string[] =>
    Reflect.getMetadata(ROLES_KEY, method) ?? [];

  it('GET /api/users incluye Admin Comercial (users:read) y Super Admin', () => {
    const roles = rolesOf(UsersController.prototype.findAll);
    expect(roles).toContain('Admin Comercial');
    expect(roles).toContain('Super Admin');
    expect(roles).toEqual(['Super Admin', 'Admin Comercial']);
  });

  it('GET /api/users/:id sigue siendo SOLO Super Admin (lectura de detalle)', () => {
    const roles = rolesOf(UsersController.prototype.findOne);
    expect(roles).toEqual(['Super Admin']);
  });

  it('POST /api/users (crear) sigue siendo SOLO Super Admin', () => {
    const roles = rolesOf(UsersController.prototype.create);
    expect(roles).toEqual(['Super Admin']);
  });

  it('PUT /api/users/:id (editar) sigue siendo SOLO Super Admin', () => {
    const roles = rolesOf(UsersController.prototype.update);
    expect(roles).toEqual(['Super Admin']);
  });

  it('DELETE /api/users/:id (eliminar) sigue siendo SOLO Super Admin', () => {
    const roles = rolesOf(UsersController.prototype.remove);
    expect(roles).toEqual(['Super Admin']);
  });
});