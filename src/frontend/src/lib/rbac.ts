import { useAuthStore } from '../stores/auth.store'

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
  return permissions.some(p => user?.permissions?.includes(p)) ?? false
}
