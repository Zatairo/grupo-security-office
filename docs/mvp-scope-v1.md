# MVP Scope v1 - Grupo Security, Fase 1: Panel Administrativo Interno

**Version:** 1.0
**Fecha:** 22 de julio de 2026 (Revisión contrato FSM productos: 2026-08-28)
**Estado:** Aprobado  
**Alcance:** Cerrado

> **Nota 2026-08-28:** La sección de Products (filtros `isActive`/`isVisible`) y el Publish Module descritos abajo corresponden al modelo **legacy**. El contrato vigente es la **FSM canónica de tres estados** (`DRAFT`, `PUBLISHED`, `ARCHIVED`; eventos `PUBLISH`, `UNPUBLISH`, `ARCHIVE`, `RESTORE`), con publicación programada solo vía `DRAFT + publishAt` y sin auto-despublicación. Ver `data-model-v1.md` y `04-Cierre-FSM-2026-08-20.md`.

---

## Contexto

**Grupo Security** es una empresa colombiana de seguridad electrónica con sedes en Pereira, Armenia, Manizales y Cali. Ofrece soluciones de CCTV (videovigilancia), sistemas de alarma, control de acceso y smart home.

Actualmente opera con el ERP **Yéminus** (gestión comercial, logística, inventarios, cotizaciones, pedidos). La nueva plataforma web será una capa comercial integrada con Yéminus.

**Objetivo del MVP:** Crear un panel administrativo interno que permita a los usuarios internos gestionar el catálogo de productos, precios, categorías, marcas, usuarios y roles, con auditoría de cambios y control de acceso por roles (RBAC).

---

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | React + TypeScript + Tailwind CSS + Vite |
| Backend | NestJS + TypeScript |
| Base de datos | PostgreSQL + Prisma ORM |
| Autenticación | JWT (HttpOnly cookies) + bcrypt |
| Autorización | RBAC con 4 roles predefinidos |
| Validación | class-validator (backend), Zod solo donde sea necesario |
| Documentación | Swagger (OpenAPI) auto-generado |

### Restricciones Fase 1

- **No Redis/cache** — se omiten capas de caché en esta fase.
- **No Docker** — desarrollo local únicamente. Despliegue futuro se definirá en Fase 2.
- **No integración ERP** — Yéminus queda como dependencia pendiente de confirmación técnica.

---

## Alcance del MVP (Fase 1)

### Módulos Backend

#### 1. Auth Module
- `POST /auth/login` — Inicio de sesión, retorna JWT en HttpOnly cookie.
- `POST /auth/register` — Registro de usuario (solo Admin).
- `GET /auth/me` — Información del usuario autenticado.
- `POST /auth/logout` — Cierre de sesión, invalida cookie.
- JWT con refresh token opcional ( HttpOnly cookie, sameSite strict ).

#### 2. Users Module
- CRUD completo de usuarios.
- Asignación de roles (solo Admin).
- Campos: id, nombre, email, passwordHash, isActive, roleId, createdAt, updatedAt.
- Búsqueda y paginación.

#### 3. Roles Module
- CRUD de roles.
- Asignación de permisos (solo Admin).
- Roles predefinidos: Admin, Gerente, Operator, Viewer.
- Campos: id, name, permissions (JSON), createdAt, updatedAt.

#### 4. Products Module
- CRUD de productos.
- Filtros: categoría, marca, búsqueda por nombre/SKU. (El filtro por ciclo de vida usa el estado FSM canónico: `DRAFT`, `PUBLISHED`, `ARCHIVED`.)
- Paginación con offset.
- Auto-generación de SKU único.
- Campos: id, name, description, slug, sku, categoryId, brandId, lifecycleStatus, isActive (legacy espejo), isVisible (legacy espejo), images (JSON), createdAt, updatedAt.

#### 5. Categories Module
- CRUD de categorías.
- Jerarquía auto-referencial (árbol de categorías).
- Generación de slug automático.
- Campos: id, name, description, slug, parentId, sortOrder, isActive, createdAt, updatedAt.

#### 6. Brands Module
- CRUD de marcas.
- Subida de logo (URL local en MVP, cloud en Fase 2).
- Campos: id, name, description, logoUrl, isActive, createdAt, updatedAt.

#### 7. Price Lists Module
- CRUD de listas de precios.
- Campos: id, name, currency (COP únicamente en MVP), startDate, endDate, isActive, createdAt, updatedAt.

#### 8. Prices Module
- Asignación y actualización de precios por producto y lista de precios.
- Relación producto ↔ lista de precios (muchos a muchos con precio).
- Campos: id, productId, priceListId, value, currency, createdAt, updatedAt.

#### 9. Audit Module
- Logs de todas las operaciones CREATE, UPDATE y DELETE en entidades críticas.
- Entidades auditadas: Products, Users, Roles, Categories, Brands, Price Lists.
- Campos: id, userId, action, entity, entityId, changes (JSON diff), timestamp.
- Consulta filtrada por entidad, usuario, fecha.

#### 10. Publish Module (FSM canónica)
- Gestión de ciclo de vida de productos vía `POST /products/:id/transition` y `POST /products/bulk-transition`: `PUBLISH`, `UNPUBLISH`, `ARCHIVE`, `RESTORE`.
- `PUBLISH` habilita y muestra; `UNPUBLISH` deshabilita y oculta; `ARCHIVE`/`RESTORE` requieren motivo y confirmación.
- Publicación programada: `DRAFT + publishAt` futura; el scheduler interno aplica `PUBLISH`. No hay estado `SCHEDULED` ni auto-despublicación.
- Los endpoints legacy `toggle-visibility`/`toggle-active` quedan obsoletos (`toggle-active` responde `410 Gone`).

---

### Páginas Frontend

| # | Página | Descripción |
|---|--------|-------------|
| 1 | **Login** | Formulario de inicio de sesión con email/password. |
| 2 | **Dashboard** | Resumen de productos, productos recientes, acciones rápidas. |
| 3 | **Products - List** | Tabla con filtros (categoría, marca, estado, búsqueda), paginación. |
| 4 | **Products - Create** | Formulario de creación de producto. |
| 5 | **Products - Edit** | Formulario de edición de producto. |
| 6 | **Products - Detail** | Vista detallada del producto con precios asignados. |
| 7 | **Categories - Tree** | Vista de árbol de categorías con drag & drop para orden. |
| 8 | **Categories - Create/Edit** | Formulario de categoría con selección de padre. |
| 9 | **Brands - Grid/Table** | Vista de marcas en cuadrícula o tabla. |
| 10 | **Brands - Create/Edit** | Formulario de marca con upload de logo. |
| 11 | **Price Lists - List** | Lista de listas de precios con estado. |
| 12 | **Price Lists - Create/Edit** | Formulario de lista de precios. |
| 13 | **Prices - Assign** | Asignación de precios a productos por lista. |
| 14 | **Users - List** | Tabla de usuarios con rol y estado. |
| 15 | **Users - Create/Edit** | Formulario de usuario con selección de rol. |
| 16 | **Roles - List** | Lista de roles (solo lectura en MVP, roles predefinidos). |

---

### Datos Semilla (Seed Data)

#### Roles por defecto
- **Admin** — Acceso total al panel y configuración.
- **Gerente** — Gestión de productos, precios, publicación, reportes.
- **Operator** — Lectura/edición limitada de productos, consulta de precios.
- **Viewer** — Solo lectura del catálogo interno.

#### Usuario admin por defecto
- Email: `admin@grupo-security.com`
- Password: `admin123`
- Rol: Admin

#### Categorías de ejemplo
- CCTV
- Alarmas
- Control de Acceso
- Smart Home

#### Marcas de ejemplo
- Hikvision
- Dahua
- Ajax
- Intelbras
- Bosch

---

## Fuera de Alcance (Fase 1)

| Item | Razón | Fase |
|------|-------|------|
| E-commerce público | Requiere Fase 1 completada | Fase 2 |
| Portal de cliente | Requiere Fase 2 completada | Fase 3 |
| Redis / caché | No esencial para MVP interno | Futura |
| Despliegue Docker | Desarrollo local suficiente | Futura |
| Upload de imágenes a cloud | URLs locales en MVP | Fase 2 |
| Integración ERP Yéminus | Pendiente confirmación de API | Futura |
| Notificaciones en tiempo real | No esencial para panel interno | Futura |
| Reportes avanzados | Mínimo viable sin reportes complejos | Futura |
| Multi-idioma | Solo español en MVP | Futura |
| Multi-moneda | Solo COP en MVP | Futura |
| MFA / 2FA | Recomendado pero no bloqueante | Futura |
| Tests E2E | Unit y integration tests priorizados | Futura |

---

## Criterios de Éxito

| # | Criterio | Validación |
|---|----------|-----------|
| 1 | El admin puede iniciar sesión y ver el dashboard | Flujo completo login → dashboard funcional |
| 2 | El admin puede CRUD de productos, categorías y marcas | Todas las operaciones CRUD funcionan sin errores |
| 3 | El admin puede gestionar usuarios y roles | Asignación de roles y permisos verificada |
| 4 | El admin puede gestionar listas de precios y asignar precios | Precios visibles por producto y lista |
| 5 | Todas las operaciones CRUD generan logs de auditoría | Tabla de auditoría registra cambios con diff |
| 6 | RBAC funciona correctamente | Viewer solo lee, Operator limitado, Gerente publica, Admin total |
| 7 | Documentación API auto-generada | Swagger UI accesible en `/api/docs` |
| 8 | Panel admin responsive | Funcional en desktop y tablet |

---

## Timeline Estimada (8 semanas)

| Semana | Entregable | Detalles |
|--------|-----------|----------|
| **Semana 1** | Setup del proyecto | NestJS + Prisma + schema DB, React + Vite + Tailwind, estructura de carpetas, config ESLint/Prettier. |
| **Semana 2** | Auth Module | Login, JWT cookies, middleware de auth, guards de roles, seed de roles y usuario admin. |
| **Semana 3** | Users + Roles CRUD | Endpoints CRUD, validación, RBAC en cada endpoint, frontend de usuarios. |
| **Semana 4** | Products + Categories + Brands CRUD | Endpoints CRUD, filtros, paginación, generación de SKU y slug, frontend de productos. |
| **Semana 5** | Price Lists + Prices | CRUD listas de precios, asignación de precios por producto, frontend de precios. |
| **Semana 6** | Frontend: Login + Dashboard + Products | Páginas de login, dashboard con métricas, tabla de productos con filtros. |
| **Semana 7** | Frontend: Categories, Brands, Prices, Users | Árbol de categorías, grid de marcas, asignación de precios, gestión de usuarios. |
| **Semana 8** | Audit + Testing + Polish | Logs de auditoría, tests unitarios/integración, seed data completo, bug fixes, documentación Swagger. |

---

## Decisiones Registradas

| Fecha | Decisión | Justificación |
|-------|----------|---------------|
| 2026-07-21 | Fase 1 = panel admin interno, no e-commerce público | El panel interno es prerequisite para la capa comercial |
| 2026-07-21 | Integración Yéminus como dependencia pendiente | No hay confirmación de API REST disponible |
| 2026-07-21 | RBAC con 4 roles (Admin, Gerente, Operator, Viewer) | Necesidades de uso interno definidas |
| 2026-07-21 | Stack: React+TS+Tailwind, NestJS+TS, PostgreSQL+Prisma | Consistencia de lenguaje, ecosistema maduro, tipado fuerte |
| 2026-07-22 | JWT con HttpOnly cookies (no Bearer token en localStorage) | Mejor práctica de seguridad, previene XSS |
| 2026-07-22 | Solo COP en MVP, multi-moneda en fase futura | Simplifica lógica de precios en Fase 1 |

---

## Notas

- Este documento define el alcance **cerrado** del MVP. Cualquier adición requiere revisión de impacto en timeline.
- La integración con Yéminus queda registrada como dependencia externa pendiente. No se implementa ningún conector hasta confirmación de API.
- El despliegue a producción no está contemplado en esta fase. El foco es desarrollo funcional completo con datos de prueba.
