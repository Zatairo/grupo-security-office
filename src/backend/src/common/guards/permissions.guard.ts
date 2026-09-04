import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

/**
 * Super Admin tiene acceso global por excepción (BE-RBAC-001). No depende de
 * que el seed le otorgue cada permiso individual: la excepción aplica aunque la
 * lista de permisos del JWT esté incompleta o haya cambiado.
 */
const SUPER_ADMIN_ROLE = 'Super Admin';

/**
 * Compatibilidad temporal `publish:manage` → `products:publish` (BE-RBAC-001).
 *
 * Contexto: el seed histórico otorga `publish:manage` a Supervisor/Admin Comercial/
 * Super Admin. El catálogo nuevo define `products:publish`. Mientras los roles se
 * migran al nombre canónico, un JWT que porte `publish:manage` se considera
 * equivalente a `products:publish`. Esta es una regla de transición explícita y
 * temporal; se retira cuando `publish:manage` deje de emitirse en seed/login.
 */
const LEGACY_PERMISSION_ALIASES: Record<string, string[]> = {
  'products:publish': ['publish:manage'],
};

/**
 * Expande el permiso requerido a sus alias legacy y comprueba si el usuario
 * posee al menos uno. Mantiene la semántica "every(required)" del guard original:
 * cada permiso requerido debe cumplirse por sí mismo o por un alias suyo.
 */
function resolveGrantedPermissions(userPermissions: string[] = []): Set<string> {
  const granted = new Set(userPermissions);
  for (const [canonical, aliases] of Object.entries(LEGACY_PERMISSION_ALIASES)) {
    if (granted.has(canonical)) continue;
    if (aliases.some((alias) => granted.has(alias))) {
      granted.add(canonical);
    }
  }
  return granted;
}

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user) return false;

    // Excepción global Super Admin: no se evalúa lista de permisos.
    if (Array.isArray(user.roles) && user.roles.includes(SUPER_ADMIN_ROLE)) {
      return true;
    }

    const granted = resolveGrantedPermissions(user.permissions);

    return requiredPermissions.every((permission) => granted.has(permission));
  }
}