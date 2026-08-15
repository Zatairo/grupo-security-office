import { useAuthStore } from '../stores/auth.store'
import { ROLES } from './roles'

export function hasRole(role: string): boolean {
  const user = useAuthStore.getState().user
  return user?.roles?.includes(role) ?? false
}

export function hasPermission(permission: string): boolean {
  const user = useAuthStore.getState().user
  return user?.permissions?.includes(permission) ?? false
}

export function hasAnyRole(roles: string[]): boolean {
  const user = useAuthStore.getState().user
  return roles.some(r => user?.roles?.includes(r)) ?? false
}

export function hasAnyPermission(permissions: string[]): boolean {
  const user = useAuthStore.getState().user
  return permissions.some((p) => user?.permissions?.includes(p)) ?? false
}

// --- Listas: visibilidad basada en rol (el nivel granular view/edit/manage
//     por Lista se enerva server-side en AclService; el frontend reacciona a 403/404). ---
export function canCreateLista(): boolean {
  return hasRole(ROLES.SUPER_ADMIN)
}

export function canManageListas(): boolean {
  return hasRole(ROLES.SUPER_ADMIN) || hasRole(ROLES.ADMIN_COMERCIAL)
}

export function canViewListas(): boolean {
  return hasAnyRole([
    ROLES.SUPER_ADMIN,
    ROLES.SUPERVISOR,
    ROLES.ADMIN_COMERCIAL,
    ROLES.OPERADOR,
    ROLES.CONSULTA,
  ])
}

