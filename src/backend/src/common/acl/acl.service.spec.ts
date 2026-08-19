import { createPrismaMock } from '../../__test__/mocks/prisma.mock';

const mockPrisma = createPrismaMock();

jest.mock('../../prisma/prisma.service', () => ({
  PrismaService: jest.fn().mockImplementation(() => mockPrisma),
}));

import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AclService, LEVEL_RANK, normalizeLevel, ROLE_ASSIGNMENT_PREFIX } from './acl.service';

const LISTA_ID = 'list-1';
const LISTA_2_ID = 'list-2';

interface AssignmentFixture {
  userId: string;
  resourceType: string;
  resourceId: string;
  level: string;
  isActive: boolean;
}

function buildAssignmentMock(assignments: AssignmentFixture[]) {
  mockPrisma.assignment.findMany.mockImplementation(async (args: any) => {
    const w = args?.where ?? {};
    let out = assignments.filter((a) => {
      if (w.userId !== undefined && a.userId !== w.userId) return false;
      if (w.resourceType !== undefined && a.resourceType !== w.resourceType) return false;
      if (w.resourceId !== undefined) {
        if (w.resourceId && w.resourceId.in) {
          if (!w.resourceId.in.includes(a.resourceId)) return false;
        } else if (Array.isArray(w.resourceId)) {
          if (!w.resourceId.includes(a.resourceId)) return false;
        } else if (a.resourceId !== w.resourceId) return false;
      }
      if (w.isActive !== undefined && a.isActive !== w.isActive) return false;
      if (w.level?.in && !w.level.in.includes(a.level)) return false;
      return true;
    });
    return out;
  });
}

describe('AclService (TANDA 1B)', () => {
  let acl: AclService;

  const VIEWER = { userId: 'pepito-1', roles: ['Operador'] };
  // Niveles vía assignments: el rol NO es Admin Comercial (deny-by-default de la política
  // nueva aplica); el nivel lo dan los assignments del fixture, no el rol.
  const EDIT_PRICES = { userId: 'price-editor', roles: ['Operador'] };
  const SUPER = { userId: 'admin-1', roles: ['Super Admin'] };
  const NOAUTH = { userId: 'none-1', roles: ['Operador'] };

  beforeEach(() => {
    jest.resetAllMocks();
    acl = new AclService(mockPrisma as any);

    mockPrisma.product.findUnique.mockResolvedValue({ id: 'prod-1', listaId: LISTA_ID });
    mockPrisma.lista.findUnique.mockResolvedValue({
      id: LISTA_ID,
      isActive: true,
      archivedAt: null,
    });
    mockPrisma.lista.findMany.mockResolvedValue([
      { id: LISTA_ID },
      { id: LISTA_2_ID },
    ]);
  });

  describe('niveles reales (checklist 29/30)', () => {
    it('LEVEL_RANK ordena view < edit_prices < edit_products < manage < manage_access', () => {
      expect(LEVEL_RANK.view).toBe(0);
      expect(LEVEL_RANK.edit_prices).toBe(1);
      expect(LEVEL_RANK.edit_products).toBe(2);
      expect(LEVEL_RANK.manage).toBe(3);
      expect(LEVEL_RANK.manage_access).toBe(4);
      expect(LEVEL_RANK.edit).toBe(2); // alias legacy
    });

    it('normalizeLevel: edit → edit_products, niveles válidos intactos, inválidos null', () => {
      expect(normalizeLevel('edit')).toBe('edit_products');
      expect(normalizeLevel('view')).toBe('view');
      expect(normalizeLevel('manage_access')).toBe('manage_access');
      expect(normalizeLevel('bogus')).toBeNull();
      expect(normalizeLevel(null)).toBeNull();
    });

    it('levelsAtLeast devuelve el nivel y todos los superiores', () => {
      const result = acl.levelsAtLeast('edit_prices');
      expect(result).toContain('edit_prices');
      expect(result).toContain('edit_products');
      expect(result).toContain('manage_access');
      expect(result).not.toContain('view');
    });
  });

  describe('assertProductAccess (checklist 17/31)', () => {
    it('404 si el producto no existe o no tiene Lista dueña', async () => {
      mockPrisma.product.findUnique.mockResolvedValueOnce(null);
      await expect(acl.assertProductAccess('no-existe', VIEWER)).rejects.toThrow(NotFoundException);

      mockPrisma.product.findUnique.mockResolvedValueOnce({ id: 'prod-1', listaId: null });
      await expect(acl.assertProductAccess('prod-1', VIEWER)).rejects.toThrow(NotFoundException);
    });

    it('RESTRICCIÓN EXPLÍCITA prevalece: assignment PRODUCT isActive=false → 403 aunque la Lista permita', async () => {
      buildAssignmentMock([
        { userId: VIEWER.userId, resourceType: 'LISTA', resourceId: LISTA_ID, level: 'manage', isActive: true },
        { userId: VIEWER.userId, resourceType: 'PRODUCT', resourceId: 'prod-1', level: 'view', isActive: false },
      ]);

      await expect(acl.assertProductAccess('prod-1', VIEWER)).rejects.toThrow(ForbiddenException);
    });

    it('excepción positiva: assignment PRODUCT activo permite aunque la Lista deniegue', async () => {
      buildAssignmentMock([
        { userId: EDIT_PRICES.userId, resourceType: 'PRODUCT', resourceId: 'prod-1', level: 'edit_prices', isActive: true },
      ]);

      const res = await acl.assertProductAccess('prod-1', EDIT_PRICES, 'view');
      expect(res.listaId).toBe(LISTA_ID);
    });

    it('excepción positiva con nivel insuficiente → cae a Lista (404 si sin assignment)', async () => {
      buildAssignmentMock([
        { userId: EDIT_PRICES.userId, resourceType: 'PRODUCT', resourceId: 'prod-1', level: 'view', isActive: true },
      ]);

      await expect(acl.assertProductAccess('prod-1', EDIT_PRICES, 'edit_prices')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('sin excepción por producto → usa acceso de la Lista dueña', async () => {
      buildAssignmentMock([
        { userId: VIEWER.userId, resourceType: 'LISTA', resourceId: LISTA_ID, level: 'view', isActive: true },
      ]);

      const res = await acl.assertProductAccess('prod-1', VIEWER, 'view');
      expect(res.listaId).toBe(LISTA_ID);
    });

    it('sin assignment → 404 (no revela existencia)', async () => {
      buildAssignmentMock([]);
      await expect(acl.assertProductAccess('prod-1', NOAUTH)).rejects.toThrow(NotFoundException);
    });
  });

  describe('grants por rol (ROLE:{nombre})', () => {
    it('getAllowedListaIds: grant por rol con nivel suficiente → TODAS las Listas activas', async () => {
      const ROLE_USER = { userId: 'comercial-1', roles: ['Operador'] };
      buildAssignmentMock([
        {
          userId: 'admin-1', // actor que creó el grant
          resourceType: 'LISTA',
          resourceId: `${ROLE_ASSIGNMENT_PREFIX}Operador`,
          level: 'manage',
          isActive: true,
        },
      ]);

      const ids = await acl.getAllowedListaIds(ROLE_USER.userId, ROLE_USER.roles, 'view');

      expect(ids).toContain(LISTA_ID);
      expect(ids).toContain(LISTA_2_ID);
    });

    it('getAllowedListaIds: grant por rol con nivel insuficiente NO abre todas las Listas', async () => {
      const ROLE_USER = { userId: 'comercial-1', roles: ['Operador'] };
      buildAssignmentMock([
        {
          userId: 'admin-1',
          resourceType: 'LISTA',
          resourceId: `${ROLE_ASSIGNMENT_PREFIX}Operador`,
          level: 'view',
          isActive: true,
        },
        {
          userId: ROLE_USER.userId,
          resourceType: 'LISTA',
          resourceId: LISTA_ID,
          level: 'manage',
          isActive: true,
        },
      ]);

      const ids = await acl.getAllowedListaIds(ROLE_USER.userId, ROLE_USER.roles, 'edit_prices');

      expect(ids).toEqual([LISTA_ID]);
      expect(ids).not.toContain(LISTA_2_ID);
    });

    it('getUserLevel toma el nivel máximo entre assignments del usuario y grants por rol', async () => {
      const ROLE_USER = { userId: 'comercial-1', roles: ['Operador'] };
      buildAssignmentMock([
        {
          userId: ROLE_USER.userId,
          resourceType: 'LISTA',
          resourceId: LISTA_ID,
          level: 'view',
          isActive: true,
        },
        {
          userId: 'admin-1',
          resourceType: 'LISTA',
          resourceId: `${ROLE_ASSIGNMENT_PREFIX}Operador`,
          level: 'manage_access',
          isActive: true,
        },
      ]);

      const level = await acl.getUserLevel(ROLE_USER.userId, LISTA_ID, ROLE_USER.roles);

      expect(level).toBe('manage_access');
    });
  });

  describe('assertListaAccess con niveles', () => {
    it('nivel insuficiente → 403', async () => {
      buildAssignmentMock([
        { userId: VIEWER.userId, resourceType: 'LISTA', resourceId: LISTA_ID, level: 'view', isActive: true },
      ]);

      await expect(acl.assertListaAccess(LISTA_ID, VIEWER, 'edit_prices')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('sin assignment → 404', async () => {
      buildAssignmentMock([]);
      await expect(acl.assertListaAccess(LISTA_ID, NOAUTH)).rejects.toThrow(NotFoundException);
    });

    it('Lista inactiva/archivada → 404 para no-admin', async () => {
      buildAssignmentMock([
        { userId: VIEWER.userId, resourceType: 'LISTA', resourceId: LISTA_ID, level: 'manage', isActive: true },
      ]);
      mockPrisma.lista.findUnique.mockResolvedValueOnce({ id: LISTA_ID, isActive: false, archivedAt: null });

      await expect(acl.assertListaAccess(LISTA_ID, VIEWER)).rejects.toThrow(NotFoundException);
    });
  });

  describe('gestión de accesos (anti-escalada soporte)', () => {
    it('canAdministerAccessOnLista: manage → true, edit → false', async () => {
      buildAssignmentMock([
        { userId: EDIT_PRICES.userId, resourceType: 'LISTA', resourceId: LISTA_ID, level: 'manage', isActive: true },
      ]);
      expect(await acl.canAdministerAccessOnLista(LISTA_ID, EDIT_PRICES)).toBe(true);

      buildAssignmentMock([
        { userId: EDIT_PRICES.userId, resourceType: 'LISTA', resourceId: LISTA_ID, level: 'edit', isActive: true },
      ]);
      expect(await acl.canAdministerAccessOnLista(LISTA_ID, EDIT_PRICES)).toBe(false);
    });

    it('canManageAccessOnLista: manage_access → true, manage → false', async () => {
      buildAssignmentMock([
        { userId: EDIT_PRICES.userId, resourceType: 'LISTA', resourceId: LISTA_ID, level: 'manage_access', isActive: true },
      ]);
      expect(await acl.canManageAccessOnLista(LISTA_ID, EDIT_PRICES)).toBe(true);

      buildAssignmentMock([
        { userId: EDIT_PRICES.userId, resourceType: 'LISTA', resourceId: LISTA_ID, level: 'manage', isActive: true },
      ]);
      expect(await acl.canManageAccessOnLista(LISTA_ID, EDIT_PRICES)).toBe(false);
    });

    it('canManageAccessOnProduct resuelve vía la Lista dueña', async () => {
      buildAssignmentMock([
        { userId: EDIT_PRICES.userId, resourceType: 'LISTA', resourceId: LISTA_ID, level: 'manage_access', isActive: true },
      ]);
      expect(await acl.canManageAccessOnProduct('prod-1', EDIT_PRICES)).toBe(true);
    });
  });

  describe('actionsForLevel (matrix viewer)', () => {
    it('view: solo ver', () => {
      const a = acl.actionsForLevel('view');
      expect(a.ver).toBe(true);
      expect(a.verPrecios).toBe(false);
      expect(a.editarPrecios).toBe(false);
      expect(a.editarProductos).toBe(false);
      expect(a.administrarAccesos).toBe(false);
    });

    it('manage_access: todas las acciones', () => {
      const a = acl.actionsForLevel('manage_access');
      expect(a.ver).toBe(true);
      expect(a.verPrecios).toBe(true);
      expect(a.editarProductos).toBe(true);
      expect(a.administrar).toBe(true);
      expect(a.administrarAccesos).toBe(true);
    });

    it('sin nivel: sin acciones', () => {
      const a = acl.actionsForLevel(null);
      expect(a.ver).toBe(false);
      expect(a.administrarAccesos).toBe(false);
    });
  });

  describe('Super Admin', () => {
    it('assertListaAccess nunca bloquea a Super Admin', async () => {
      mockPrisma.lista.findUnique.mockResolvedValueOnce({ id: LISTA_ID, isActive: false, archivedAt: null });
      await expect(acl.assertListaAccess(LISTA_ID, SUPER, 'manage_access')).resolves.toBeUndefined();
    });

    it('getAllowedListaIds devuelve null (sin filtro) para Super Admin', async () => {
      expect(await acl.getAllowedListaIds(SUPER.userId, SUPER.roles, 'view')).toBeNull();
    });
  });

  describe('Admin Comercial (isListasAdmin — contenedor de compras)', () => {
    const COMERCIAL = { userId: 'comercial-1', roles: ['Admin Comercial'] };

    it('isListasAdmin es true para Admin Comercial y false para otros roles no-admin', () => {
      expect(acl.isListasAdmin(['Admin Comercial'])).toBe(true);
      expect(acl.isListasAdmin(['Operador'])).toBe(false);
      expect(acl.isListasAdmin(undefined)).toBe(false);
    });

    it('getAllowedListaIds devuelve null (ve TODAS las listas) sin consultar assignments', async () => {
      expect(await acl.getAllowedListaIds(COMERCIAL.userId, COMERCIAL.roles, 'view')).toBeNull();
      expect(mockPrisma.assignment.findMany).not.toHaveBeenCalled();
    });

    it('assertListaAccess no bloquea a Admin Comercial (incluida Lista inactiva/archivada)', async () => {
      mockPrisma.lista.findUnique.mockResolvedValueOnce({ id: LISTA_ID, isActive: false, archivedAt: null });
      await expect(acl.assertListaAccess(LISTA_ID, COMERCIAL, 'manage_access')).resolves.toBeUndefined();
    });

    it('assertListaRestoreAccess no bloquea a Admin Comercial', async () => {
      mockPrisma.lista.findUnique.mockResolvedValueOnce({ id: LISTA_ID });
      await expect(
        acl.assertListaRestoreAccess(LISTA_ID, COMERCIAL, 'manage'),
      ).resolves.toBeUndefined();
    });

    it('assertProductAccess permite a Admin Comercial sobre cualquier producto', async () => {
      const res = await acl.assertProductAccess('prod-1', COMERCIAL, 'manage_access');
      expect(res.listaId).toBe(LISTA_ID);
    });

    it('can / canManageAccessOnLista / canManageAccessOnProduct / canAdministerAccessOnLista → true sin assignments', async () => {
      expect(await acl.can(LISTA_ID, COMERCIAL, 'manage_access')).toBe(true);
      expect(await acl.canManageAccessOnLista(LISTA_ID, COMERCIAL)).toBe(true);
      expect(await acl.canManageAccessOnProduct('prod-1', COMERCIAL)).toBe(true);
      expect(await acl.canAdministerAccessOnLista(LISTA_ID, COMERCIAL)).toBe(true);
      expect(mockPrisma.assignment.findMany).not.toHaveBeenCalled();
    });
  });
});