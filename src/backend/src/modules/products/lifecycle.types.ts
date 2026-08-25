/**
 * FSM de ciclo de vida de Product (Etapa 2 — núcleo backend).
 *
 * `lifecycleStatus` es la fuente de verdad del estado; las columnas legacy
 * (isActive, isVisible, publishStatus, publishAt, unpublishAt, publishedAt)
 * se "espejan" en cada transición (dual-write) para que lecturas/UI/import
 * actuales sigan funcionando hasta las etapas 7/8.
 *
 * Fuente de verdad del negocio (NO modificar):
 *  - P1: REACTIVATE desde DISCONTINUED → PUBLISHED si el producto venía
 *        publicado (legacy publishStatus === 'publicado'), si no → DRAFT.
 *  - P2: HIDDEN = publicado pero oculto (isActive true, isVisible false);
 *        DISCONTINUED = baja comercial (isActive false).
 *  - P3: UNPUBLISH → DRAFT (con razón obligatoria).
 *  - P4: ARCHIVE/RESTORE exigen ACL manage + motivo + confirm.
 *  - P5: PUBLICAR valida reglas (checklist); stock bloquea solo si existe
 *        registro con availableQty <= 0.
 *  - P6: SCHEDULED_PUBLISH queda preparado para el scheduler interno
 *        (próxima tanda); aquí solo se declara y se rechaza por API pública.
 */

export type LifecycleStatus =
  | 'DRAFT'
  | 'READY'
  | 'SCHEDULED'
  | 'PUBLISHED'
  | 'HIDDEN'
  | 'DISCONTINUED'
  | 'ARCHIVED';

export const LIFECYCLE_STATUSES: LifecycleStatus[] = [
  'DRAFT',
  'READY',
  'SCHEDULED',
  'PUBLISHED',
  'HIDDEN',
  'DISCONTINUED',
  'ARCHIVED',
];

export type LifecycleEvent =
  | 'CREATE'
  | 'PREPARE'
  | 'SCHEDULE'
  | 'CANCEL_SCHEDULE'
  | 'PUBLISH'
  | 'SCHEDULED_PUBLISH'
  | 'HIDE'
  | 'SHOW'
  | 'UNPUBLISH'
  | 'DISCONTINUE'
  | 'REACTIVATE'
  | 'ARCHIVE'
  | 'RESTORE'
  | 'DELETE';

export const LIFECYCLE_EVENTS: LifecycleEvent[] = [
  'CREATE',
  'PREPARE',
  'SCHEDULE',
  'CANCEL_SCHEDULE',
  'PUBLISH',
  'SCHEDULED_PUBLISH',
  'HIDE',
  'SHOW',
  'UNPUBLISH',
  'DISCONTINUE',
  'REACTIVATE',
  'ARCHIVE',
  'RESTORE',
  'DELETE',
];

export interface TransitionGuard {
  /** Roles autorizados por RBAC (matriz de permisos del seed). */
  roles: string[];
  /** Nivel ACL mínimo (edit_products | manage) sobre el producto/Lista. */
  aclLevel: string;
  /** UNPUBLISH/DISCONTINUE/ARCHIVE exigen motivo (reason). */
  reasonRequired?: boolean;
  /** ARCHIVE/RESTORE exigen confirm: true. */
  confirmRequired?: boolean;
  /** SCHEDULE exige publishAt futuro. */
  publishAtRequired?: boolean;
  /** Evento interno (scheduler): rechazado por la API pública. */
  internalOnly?: boolean;
}

export interface TransitionRule {
  /** Estados origen desde los que el evento es válido. */
  from: LifecycleStatus[];
  /** Estado destino (REACTIVATE es dinámico: PUBLISHED o DRAFT). */
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
 * Matriz de transiciones (desde → evento → hacia) + guardas.
 * DELETE queda declarado en los tipos pero NO en la matriz: su implementación
 * con clave maestra llega en la siguiente tanda.
 */
export const TRANSITION_RULES: Partial<Record<LifecycleEvent, TransitionRule>> = {
  CREATE: {
    from: [],
    to: 'DRAFT',
    guard: { roles: PRODUCTS_WRITE_ROLES, aclLevel: 'edit_products' },
  },
  PREPARE: {
    from: ['DRAFT'],
    to: 'READY',
    guard: { roles: PRODUCTS_WRITE_ROLES, aclLevel: 'edit_products' },
  },
  SCHEDULE: {
    from: ['DRAFT', 'READY'],
    to: 'SCHEDULED',
    guard: { roles: PUBLISH_MANAGE_ROLES, aclLevel: 'manage', publishAtRequired: true },
  },
  CANCEL_SCHEDULE: {
    from: ['SCHEDULED'],
    to: 'DRAFT',
    guard: { roles: PRODUCTS_WRITE_ROLES, aclLevel: 'edit_products' },
  },
  PUBLISH: {
    from: ['DRAFT', 'READY', 'SCHEDULED'],
    to: 'PUBLISHED',
    guard: { roles: PUBLISH_MANAGE_ROLES, aclLevel: 'manage' },
  },
  SCHEDULED_PUBLISH: {
    from: ['SCHEDULED'],
    to: 'PUBLISHED',
    guard: { roles: PUBLISH_MANAGE_ROLES, aclLevel: 'manage', internalOnly: true },
  },
  HIDE: {
    from: ['PUBLISHED'],
    to: 'HIDDEN',
    guard: { roles: PUBLISH_MANAGE_ROLES, aclLevel: 'manage' },
  },
  SHOW: {
    from: ['HIDDEN'],
    to: 'PUBLISHED',
    guard: { roles: PUBLISH_MANAGE_ROLES, aclLevel: 'manage' },
  },
  UNPUBLISH: {
    from: ['READY', 'SCHEDULED', 'PUBLISHED', 'HIDDEN'],
    to: 'DRAFT',
    guard: { roles: PUBLISH_MANAGE_ROLES, aclLevel: 'manage', reasonRequired: true },
  },
  DISCONTINUE: {
    from: ['DRAFT', 'READY', 'SCHEDULED', 'PUBLISHED', 'HIDDEN'],
    to: 'DISCONTINUED',
    guard: { roles: PRODUCTS_WRITE_ROLES, aclLevel: 'edit_products', reasonRequired: true },
  },
  // REACTIVATE → PUBLISHED si el producto venía publicado (P1), si no → DRAFT.
  REACTIVATE: {
    from: ['DISCONTINUED'],
    to: 'DRAFT',
    guard: { roles: PRODUCTS_WRITE_ROLES, aclLevel: 'edit_products' },
  },
  ARCHIVE: {
    from: ['DRAFT', 'READY', 'SCHEDULED', 'PUBLISHED', 'HIDDEN', 'DISCONTINUED'],
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
  CREATE: 'create',
  PREPARE: 'prepare',
  SCHEDULE: 'schedule_publish',
  CANCEL_SCHEDULE: 'cancel_schedule',
  PUBLISH: 'publish',
  SCHEDULED_PUBLISH: 'publish',
  HIDE: 'hide',
  SHOW: 'show',
  UNPUBLISH: 'unpublish',
  DISCONTINUE: 'discontinue',
  REACTIVATE: 'reactivate',
  ARCHIVE: 'archive',
  RESTORE: 'restore',
  DELETE: 'delete',
};