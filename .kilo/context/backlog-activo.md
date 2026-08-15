# Backlog activo — Plataforma Comercial

## Fuente funcional
La documentación funcional se encuentra en Notion:

Grupo Security — Proyecto Plataforma Comercial
> Desarrollo complementario del área comercial
> Checklist técnico — Desarrollo complementario del área comercial

## Incremento activo
Incremento 0 — Modelo de datos y reglas base.

## Fases del incremento
- **Fase A — Esquema no destructivo:** entidad `Lista` como raíz de `Producto`, sin eliminar ni romper entidades actuales. ← COMPLETADA.
- **Fase B — Seed y backfill controlado:** `LISTA-GENERAL` + backfill Catalog→Lista, Product, Price, Assignments. ← COMPLETADA.
- **Fase C — Compatibilidad temporal (lectura/escritura):** aceptar `listaId` en Producto/Precio, invariante `Price.listaId == Product.listaId`, fallback legado, auditoría mínima, tests. ← COMPLETADA.
- Fase D — Retiro gradual de `Catalog`/`PriceList` (pendiente, futuro, con aprobación explícita).

## Estado actual
**COMPLETADO (Incremento 0 — Fases A, B y C).** La ejecución estuvo autorizada en modo autónomo supervisado para ambente LOCAL. Véase `.kilo/context/reporte-ejecucion-incremento-0.md`.

## Estado por fase

### Fase A — Esquema no destructivo (COMPLETADA)
- Ambiente detectado: **LOCAL** (`DATABASE_URL=...localhost:5432/...`). Se aplicaron migraciones y backfill tras backup verificable.
- `src/backend/prisma/schema.prisma`: modelo `Lista` (`listas`); `Product.listaId` (+ índice); `Price.listaId` (+ índice); `Assignment.roleId` (+ índice, `userId` conservado NOT NULL); relaciones inversas `User.createdListas/updatedListas` y `Role.assignments`. Se preservan `Catalog`, `PriceList`, `Product.catalogId`, `Price.priceListId` y la restricción `@@unique([productId, priceListId])`.
- `src/backend/prisma/migrations/20260814171500_lista_entidad_raiz/migration.sql`: migración no destructiva (crea `listas`; columnas nullable `listaId`/`roleId` con FK `ON DELETE SET NULL` + índices). No crea `LISTA-GENERAL`, no hace backfill.
- Validación: `prisma format`/`validate` OK; `prisma generate` OK; `nest build` OK; `prisma migrate status` → "Database schema is up to date".

### Fase B — Lista General y backfill (COMPLETADA)
- Backup verificable: `C:\Users\sopor\AppData\Local\Temp\gs-backups\grupo_security_baseline_20260814_124932.sql` (355 KB, pg_dump).
- Script idempotente/transaccional: `src/backend/prisma/scripts/backfill-catalog-to-lista.ts` (NO modifica `seed.ts`).
- Backfill: `CAT-DEFAULT` → reutiliza `LISTA-GENERAL` (no duplica; decisiones 8/14). 197 productos y 1379 precios asociados; 1 assignment `CATALOG`→`LISTA` (level `view` preservado).
- Validación de integridad: 0 productos sin `listaId`, 0 precios con `listaId` distinto al del producto, 0 SKUs/code duplicados, 0 violaciones FK, `priceListId` preservado (1379). Re-ejecución idempotente: 0 asignaciones nuevas.

### Fase C — Compatibilidad (COMPLETADA)
- DTOs: `CreateProductDto`/`UpdateProductDto` aceptan `listaId` opcional (UUID). `CreatePriceDto`/`UpdatePriceDto` aceptan `listaId` opcional y `value >= 0` (`@Min(0)`).
- `ProductsService`: `resolveListaId` (valida Lista enviada / fallback `LISTA-GENERAL`); `create`/`update` persisten `listaId`; `upsertPrices` propaga `listaId` del producto al precio. `importFromExcel` setea `listaId` (fallback `LISTA-GENERAL`). No elimina `catalogId`.
- `PricesService`: invariante `Price.listaId == Product.listaId` (rechaza con `ConflictException`); `validatePrice` (value≥0, `validFrom ≤ validUntil`); conserva `priceListId`.
- Mock: `createPrismaMock` completa el bloque `lista` y añade `product.updateMany`/`user.deleteMany`/`userRole.deleteMany`.
- Tests: 242/242 pass (17 suites); `npx tsc --noEmit` limpio; `nest build` OK. Se añadieron covers para producto-con-Lista, fallback legado, precio con Lista correcta, rechazo de Lista inconsistente, valor negativo y backfill idempotente (verificado empíricamente).

### Fase D — Retiro gradual (PENDIENTE, futuro)
Sin aprobación explícita. No se borran físicamente `Catalog`/`PriceList`; se marcarían inactivas en su momento.

## Objetivo actual
Incremento 0 finalizado (Fases A/B/C). Incremento 1 — **Fase 1A planificada; Fase 1B IMPLEMENTADA y validada.** Ver `.kilo/context/reporte-incremento-1.md`.

## Incremento 1 — Gestión de Listas + ACL real deny-by-default + UI (Fase 1B — COMPLETADA)
- **Backend** (LOCAL): módulo `listas` (controller/service/DTOs) con endpoints CRUD + activate/desactivate + archive/restore + resumen productos + precios + accesos + auditoría; `AclService` centralizado (`common/acl/acl.service.ts` + `acl.module.ts`) con `view/edit/manage` y deny-by-default sobre Listas, Productos y Precios; `Assignment.resourceType` admite `LISTA`; `AssignmentsController/Service` autorizan inline (Super Admin → todo; Admin Comercial → manage-scoped sobre su Lista; Operador/Consulta → lectura). Auditoría ligera en Lista.
- **Frontend**: rutas `/commercial/lists` y `/commercial/lists/:id`; `ListasPage`, `ListaDetailPage` (pestañas Productos/Precios/Accesos/Auditoría), `ListasFormModal`; tab "Listas" en `CommercialLayout`; helpers RBAC `canCreateLista`/`canManageListas`/`canViewListas`; estado vacío "No tienes Listas asignadas". Vista Catálogos preservada (legacy).
- **Validación (LOCAL)**: `tsc --noEmit` limpio; `nest build` OK; `prisma format/validate` OK; jest **272/272 pass** (18 suites), incluye T1–T20 para Listas + casos ACL para Products/Prices. `ListasService` usa AclService real. Frontend `tsc` + `vite build` OK.
- **Datos**: migración Incremento 0 preservada (aplicada LOCAL). No se corrieron `migrate reset/db push/DELETE/TRUNCATE/DROP`. No se tocaron secretos/.env. No se hicieron deploy/commits.

## Restricciones respetadas (este incremento)
- No se modificó el modelo Prisma ni migraciones (solo código aplicación). Se preservan `Catalog`, `PriceList`, `Product.catalogId`, `Price.priceListId`.
- No se construyó UI nueva que reemplace Catálogos; la vista Catálogos sigue activa como legado.
- No se implementó: permisos por rol en Assignment (`roleId` XOR), excepciones por producto, PriceHistory, importación masiva por Lista, publicación programada, proveedores/stock/compras/órdenes, borrado físico de Listas (se usa archivo lógico).
- ACL `ctx` en servicios: opcional; el controlador es el punto de autorización (siempre pasa ctx). Ausente → comportamiento legacy (no rompe callers/tests existentes).

