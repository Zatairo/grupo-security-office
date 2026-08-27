/**
 * FSM de ciclo de vida de Product (contrato canónico consolidado).
 *
 * Estados canónicos: DRAFT, PUBLISHED, ARCHIVED.
 * La columna `lifecycleStatus` (String, schema.prisma) es la fuente de verdad;
 * las columnas legacy `isActive`, `isVisible`, `publishStatus`, `publishAt`,
 * `unpublishAt`, `publishedAt`, `publishedById`, `unpublishReason` se conservan
 * SIN ser eliminadas y se escriben únicamente como espejo del estado canónico
 * (dual-write) para compatibilidad de lecturas legacy.
 *
 * Lectura compatible sin migración de datos: filas con estados almacenados
 * `READY`/`SCHEDULED`/`HIDDEN` se normalizan a DRAFT;
 * `DISCONTINUED` se normaliza a ARCHIVED.
 * Nunca se escriben ni exponen estados legacy por API.
 *
 * Programación: solo publicación. Un producto permanece en DRAFT con
 * `publishAt` futura; al llegar la fecha el scheduler interno aplica PUBLISH.
 * No existe auto-despublicación (`unpublishAt` se conserva como columna sin uso).
 */

export type LifecycleStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export const LIFECYCLE_STATUSES: LifecycleStatus[] = ['DRAFT', 'PUBLISHED', 'ARCHIVED'];

/** Eventos públicos canónicos que un usuario puede disparar. */
export type LifecycleEvent = 'PUBLISH' | 'UNPUBLISH' | 'ARCHIVE' | 'RESTORE';

export const LIFECYCLE_EVENTS: LifecycleEvent[] = ['PUBLISH', 'UNPUBLISH', 'ARCHIVE', 'RESTORE'];

export interface TransitionGuard {
  /** Roles autorizados por RBAC (matriz de permisos del seed). */
  roles: string[];
  /** Nivel ACL mínimo (edit_products | manage) sobre el producto/Lista. */
  aclLevel: string;
  /** ARCHIVE/RESTORE exigen motivo (reason). */
  reasonRequired?: boolean;
  /** ARCHIVE/RESTORE exigen confirm: true. */
  confirmRequired?: boolean;
}

export interface TransitionRule {
  /** Estados origen desde los que el evento es válido. */
  from: LifecycleStatus[];
  /** Estado destino. */
  to: LifecycleStatus;
  guard: TransitionGuard;
}

/** Roles con `publish:manage` (Super Admin, Supervisor, Admin Comercial). */
export const PUBLISH_MANAGE_ROLES = ['Super Admin', 'Supervisor', 'Admin Comercial'];
/** Roles con `products:write` / `products:delete` (Super Admin, Admin Comercial). */
export const PRODUCTS_WRITE_ROLES = ['Super Admin', 'Admin Comercial'];
/** Roles autorizados para ARCHIVE/RESTORE (Super Admin, Admin Comercial). */
export const ARCHIVE_ROLES = ['Super Admin', 'Admin Comercial'];

/**
 * Matriz de transiciones canónicas (desde → evento → hacia) + guardas.
 * DELETE queda declarado en `LifecycleEvent` legacy y se gestiona aparte
 * (borrado físico con clave maestra), fuera de esta matriz.
 */
export const TRANSITION_RULES: Record<LifecycleEvent, TransitionRule> = {
  PUBLISH: {
    from: ['DRAFT'],
    to: 'PUBLISHED',
    guard: { roles: PUBLISH_MANAGE_ROLES, aclLevel: 'manage' },
  },
  UNPUBLISH: {
    from: ['PUBLISHED'],
    to: 'DRAFT',
    guard: { roles: PUBLISH_MANAGE_ROLES, aclLevel: 'manage' },
  },
  ARCHIVE: {
    from: ['DRAFT', 'PUBLISHED'],
    to: 'ARCHIVED',
    guard: { roles: ARCHIVE_ROLES, aclLevel: 'manage', reasonRequired: true, confirmRequired: true },
  },
  RESTORE: {
    from: ['ARCHIVED'],
    to: 'DRAFT',
    guard: { roles: ARCHIVE_ROLES, aclLevel: 'manage', reasonRequired: true, confirmRequired: true },
  },
};

/** Acción de auditoría por evento (minúsculas, compatible con filtros existentes). */
export const EVENT_AUDIT_ACTION: Record<LifecycleEvent, string> = {
  PUBLISH: 'publish',
  UNPUBLISH: 'unpublish',
  ARCHIVE: 'archive',
  RESTORE: 'restore',
};