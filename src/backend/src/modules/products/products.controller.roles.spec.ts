import 'reflect-metadata';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { ProductsController } from './products.controller';

describe('ProductsController — matriz de roles (contrato)', () => {
  const rolesOf = (method: Function): string[] =>
    Reflect.getMetadata(ROLES_KEY, method) ?? [];

  it('PATCH :id/publish incluye Supervisor (publish:manage) y roles de escritura', () => {
    const roles = rolesOf(ProductsController.prototype.publish);
    expect(roles).toContain('Supervisor');
    expect(roles).toEqual(expect.arrayContaining(['Super Admin', 'Supervisor', 'Admin Comercial']));
  });

  it('PATCH :id/unpublish incluye Supervisor (publish:manage)', () => {
    const roles = rolesOf(ProductsController.prototype.unpublish);
    expect(roles).toContain('Supervisor');
    expect(roles).toEqual(expect.arrayContaining(['Super Admin', 'Supervisor', 'Admin Comercial']));
  });

  it('DELETE :id incluye Admin Comercial (products:delete) y Super Admin', () => {
    const roles = rolesOf(ProductsController.prototype.remove);
    expect(roles).toContain('Admin Comercial');
    expect(roles).toContain('Super Admin');
  });
});
