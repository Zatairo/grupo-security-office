# QA — Fase 1 Stabilization

## Resultado de ejecución

| Resultado | Valor |
|-----------|-------|
| Test Suites | 4 passed, 4 total |
| Tests | 37 passed, 37 total |
| Snapshots | 0 |
| Tiempo | ~19 s |
| Estado | ✅ 100% passing |

---

## Tests existentes por módulo

### auth (3 spec files — cubierto)
| Archivo | Tests |
|---------|-------|
| `src/modules/auth/auth.controller.spec.ts` | — |
| `src/modules/auth/auth.service.spec.ts` | — |
| `src/modules/auth/jwt.strategy.spec.ts` | — |
| **Total auth** | **~33 tests** (mayoría del total) |

### guards (comunes)
| Archivo | Tests |
|---------|-------|
| `src/common/guards/roles.guard.spec.ts` | — |
| **Total guards** | **~4 tests** |

### Módulos sin tests
| Módulo | Archivos productivos sin spec |
|--------|-------------------------------|
| users | `users.controller.ts`, `users.service.ts` |
| roles | `roles.controller.ts`, `roles.service.ts` |
| products | `products.controller.ts`, `products.service.ts` |
| categories | `categories.controller.ts`, `categories.service.ts` |
| brands | `brands.controller.ts`, `brands.service.ts` |
| prices | `prices.controller.ts`, `prices.service.ts` |
| audit | `audit.controller.ts`, `audit.service.ts` |
| health | `health.controller.ts` |
| guards | `permissions.guard.ts` |
| decorators | `roles.decorator.ts`, `permissions.decorator.ts`, `public.decorator.ts` |
| filters | `http-exception.filter.ts` |
| interceptors | `transform.interceptor.ts` |

---

## Priorización de creación de pruebas por riesgo

| Prioridad | Módulo | Justificación |
|-----------|--------|---------------|
| **P0** | auth / guards / jwt | Sin autenticación no funciona nada. Ya cubierto. |
| **P1** | `common/guards/permissions.guard.ts` | Complemento del RBAC, sin test. |
| **P1** | `users` (service + controller) | Base del RBAC. CRUD de usuarios crítico. |
| **P1** | `roles` (service + controller) | Base del RBAC. CRUD de roles crítico. |
| **P2** | `products` (service + controller) | Negocio principal. |
| **P2** | `categories` (service + controller) | Negocio principal (dependiente de productos). |
| **P2** | `brands` (service + controller) | Negocio principal (dependiente de productos). |
| **P3** | `prices` (service + controller) | Negocio secundario. |
| **P4** | `audit` (service + controller) | Transversal, no bloqueante. |
| **P5** | `health` (controller) | Endpoint de monitoreo, sin lógica de negocio. |
| **P5** | decorators / filters / interceptors | Utilidades, bajo riesgo. |

### Orden recomendado de escritura

```
Iteración 1 (P1) → permissions.guard.spec.ts, users.*.spec.ts, roles.*.spec.ts
Iteración 2 (P2) → products.*.spec.ts, categories.*.spec.ts, brands.*.spec.ts
Iteración 3 (P3) → prices.*.spec.ts
Iteración 4 (P4) → audit.*.spec.ts
Iteración 5 (P5) → health.*.spec.ts + decorators/filters/interceptors
```

---

## Tests faltantes por módulo (detalle)

### P1 — Alto riesgo
- `src/common/guards/permissions.guard.spec.ts`
- `src/modules/users/users.controller.spec.ts`
- `src/modules/users/users.service.spec.ts`
- `src/modules/roles/roles.controller.spec.ts`
- `src/modules/roles/roles.service.spec.ts`

### P2 — Riesgo medio
- `src/modules/products/products.controller.spec.ts`
- `src/modules/products/products.service.spec.ts`
- `src/modules/categories/categories.controller.spec.ts`
- `src/modules/categories/categories.service.spec.ts`
- `src/modules/brands/brands.controller.spec.ts`
- `src/modules/brands/brands.service.spec.ts`

### P3 — Riesgo bajo
- `src/modules/prices/prices.controller.spec.ts`
- `src/modules/prices/prices.service.spec.ts`

### P4 — Riesgo muy bajo
- `src/modules/audit/audit.controller.spec.ts`
- `src/modules/audit/audit.service.spec.ts`

### P5 — Riesgo mínimo
- `src/modules/health/health.controller.spec.ts`
- `src/common/decorators/*.spec.ts`
- `src/common/filters/http-exception.filter.spec.ts`
- `src/common/interceptors/transform.interceptor.spec.ts`

---

## Checklist manual de regresión

> Ejecutar antes de cada merge a `main` o `develop`.

### Autenticación
- [ ] Login con credenciales válidas → 200 + cookie HttpOnly
- [ ] Login con credenciales inválidas → 401
- [ ] Acceso a ruta protegida sin token → 401
- [ ] Acceso a ruta protegida con token válido → 200
- [ ] Logout → cookie eliminada

### Usuarios
- [ ] Crear usuario (admin) → 201
- [ ] Listar usuarios → 200
- [ ] Obtener usuario por ID → 200
- [ ] Actualizar usuario → 200
- [ ] Eliminar usuario → 200 / 204
- [ ] Usuario sin rol no puede crear usuarios → 403

### Roles
- [ ] Crear rol con permisos → 201
- [ ] Listar roles → 200
- [ ] Obtener rol por ID → 200
- [ ] Actualizar rol → 200
- [ ] Eliminar rol → 200 / 204

### Productos
- [ ] Crear producto → 201
- [ ] Listar productos → 200
- [ ] Obtener producto por ID → 200
- [ ] Actualizar producto → 200
- [ ] Eliminar producto → 200 / 204

### Categorías
- [ ] CRUD básico (Create, Read, Update, Delete) → 200/201
- [ ] Categoría padre-hijo (si aplica)

### Marcas (Brands)
- [ ] CRUD básico → 200/201

### Precios
- [ ] Crear precio para producto → 201
- [ ] Listar precios por producto → 200
- [ ] Actualizar precio → 200
- [ ] Eliminar precio → 200 / 204

### Auditoría
- [ ] Listar eventos de auditoría → 200
- [ ] Filtrar por usuario/entidad/fecha → 200

### Health
- [ ] GET /health → 200 OK

### General
- [ ] 404 en rutas inexistentes
- [ ] Errores 500 manejados con formato consistente

---

## Criterios de "Fase 1 estable"

1. **`npm test` pasa 100%** —  4 suites, 37 tests → ✅ YA CUMPLE
2. **Cada módulo de negocio tiene al menos 1 spec con casos básicos:**
   - [ ] `users` — al menos 1 spec
   - [ ] `roles` — al menos 1 spec
   - [ ] `products` — al menos 1 spec
   - [ ] `categories` — al menos 1 spec
   - [ ] `brands` — al menos 1 spec
   - [ ] `prices` — al menos 1 spec
   - [ ] `audit` — al menos 1 spec
   - [ ] `health` — al menos 1 spec
3. **Checklist de regresión manual documentado y ejecutable** — ✅ Este documento cumple.
4. **Sin tests rotos** — No se debe mergear código que rompa tests existentes.
5. **Todo PR de backend debe incluir o actualizar tests del módulo afectado** — Regla de solidez.

---

## Fix: Cookie Auth (ITERACIÓN ACTUAL)

### Problema
- Los endpoints protegidos retornaban 500 body vacío cuando se usaba cookie `access_token`
- Con `Authorization: Bearer <token>` funcionaban correctamente

### Causa raíz
En `jwt-auth.guard.ts`, el método `handleRequest` lanzaba `new Error('No autorizado')` en lugar de `new UnauthorizedException('No autorizado')`. Express convierte errores genéricos `Error` en 500, mientras que `UnauthorizedException` se mapea a 401.

### Fix aplicado
1. `jwt-auth.guard.ts`: Cambiar `new Error(...)` por `new UnauthorizedException(...)`
2. `jwt.strategy.ts`: Agregar parsing manual de cookie header como fallback
3. `package.json`: Corregir scripts de start a `dist/src/main`

### Verificación
- [x] npm test: 116/116 tests pasan
- [x] npm run build: compilación limpia
- [x] Login → cookie seteada correctamente
- [x] GET /api/auth/profile con Cookie → 200
- [x] GET /api/categories con Cookie → 200
- [x] GET /api/brands con Cookie → 200
- [x] GET /api/products con Cookie → 200
- [x] GET /api/prices/lists con Cookie → 200
- [x] GET /api/users con Cookie → 200
- [x] GET /api/audit con Cookie → 200
- [x] Logout → cookie limpiada
- [x] Re-login → nueva sesión funciona
- [x] Bearer auth sigue funcionando

### Nota
Los tests de cookie requieren `System.Net.HttpWebRequest` o `WebClient` en PowerShell ya que `Invoke-WebRequest -Headers @{Cookie=...}` no envía el header Cookie correctamente en Windows PowerShell 5.1.

---

## Resumen

| Métrica | Valor |
|---------|-------|
| Suites existentes | 4 |
| Tests existentes | 37 |
| Módulos sin tests | 8 de 9 (solo auth cubierto) |
| Specs faltantes mínimo | ~16 (controller + service por módulo) |
| Prioridad máxima | P1: permissions.guard, users, roles |
| Estado Fase 1 estable | ❌ No alcanzado (faltan specs de negocio) |

---

## Iteración: Credenciales + RBAC Visual

**Fecha:** 2026-07-24
**Auditor:** QA Agent (automated)

### Auditoría de Credenciales

| Check | Estado | Detalle |
|-------|--------|---------|
| No hay `admin@grupo-security.com` hardcodeado en componentes | ⚠️ PLACEHOLDER | `Login.tsx:92` — usado como `placeholder=""` en input. No es credencial funcional, pero revela formato del email admin. |
| No hay `admin123` en componentes frontend | ✅ PASS | Zero instances en `src/frontend` |
| No hay passwords hardcodeadas en .ts/.tsx frontend | ✅ PASS | Solo `useState('')` vacío y `type="password"` en Login |
| Credenciales solo en docs/backend (seed, tests, DTOs) | ✅ PASS | `seed.ts`, `auth.fixture.ts`, `*.spec.ts`, `*dto.ts` — todos aceptables |

**Veredicto auditoría credenciales:** ✅ PASS con observación menor (placeholder en Login.tsx)

### RBAC Visual

| Check | Estado | Detalle |
|-------|--------|---------|
| `src/lib/rbac.ts` creado | ✅ PASS | hasRole, hasPermission, hasAnyRole, hasAnyPermission — todas implementadas |
| Lee de Zustand auth store | ✅ PASS | `useAuthStore.getState().user` con null safety |
| Productos: Import/Export condicionado en `products:write` | ✅ PASS | `ProductsPage.tsx:32,43` |
| Productos: Edit/Active/Delete condicionado | ✅ PASS | `ProductCard.tsx:36,53,65` + `ProductTableRow.tsx:57,68` |
| Categorías: Create/Delete condicionado | ✅ PASS | `CategoriesPage.tsx:30,78` |
| Marcas: Create/Delete condicionado | ✅ PASS | `BrandsPage.tsx:30,78` |
| Precios: Create/Add/Delete condicionado | ✅ PASS | `PricesPage.tsx:105,151,158,212,258` |
| Usuarios: Página completa condicionada en `users:read` o Admin | ✅ PASS | `UsersPage.tsx:20` — `hasRole('Admin') \|\| hasPermission('users:read')` |
| Auditoría: Página completa condicionada en `audit:read` o Admin | ✅ PASS | `AuditPage.tsx:22` — `hasRole('Admin') \|\| hasPermission('audit:read')` |
| Header: Nav items condicionados | ✅ PASS | `Header.tsx:116,119` — Usuarios/Auditoría gated |

**Fallback:** Todos los componentes usan rendering condicional (hidden by default), no errores. ✅

### Contrato Backend Confirmado

| Endpoint | Response Shape |
|----------|---------------|
| Login `POST /auth/login` | `{ user: { id, email, name, roles, permissions } }` |
| Profile `GET /auth/profile` | `{ id, email, name, roles, permissions }` |
| JWT payload | `{ sub, email, name, roles, permissions }` |
| Tests backend | 37/37 pasando |

### Build Verification

| Check | Estado |
|-------|--------|
| `tsc -b` (TypeScript) | ✅ Clean |
| `vite build` | ✅ 14.29s, 347KB bundle |
| Warnings | 0 |

### Resumen Final

| Area | Resultado |
|------|-----------|
| Credenciales | ✅ PASS (1 observación menor: placeholder) |
| RBAC Utility | ✅ PASS (4/4 funciones correctas) |
| RBAC Visual | ✅ PASS (9/9 componentes verificados) |
| Build | ✅ PASS (compilación limpia) |
| Documentación | ✅ Actualizada |
