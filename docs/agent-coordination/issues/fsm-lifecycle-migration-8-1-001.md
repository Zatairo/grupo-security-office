---
id: FSM-LIFECYCLE-MIGRATION-8.1-001
title: "Etapa 8.1 — Inventario y migración no destructiva de lecturas/escrituras a lifecycleStatus"
status: pending
assigned_tool: opencode
assigned_agent: backend-engineer
created_by: esnaideridrobo2@gmail.com
created_at: 2026-09-09T18:33:46Z
---

## Scope (Contrato de delegación)

### Objetivo único
Inventariar y migrar las lecturas/escrituras que aún dependen de las columnas legacy (`isActive`, `isVisible`, `publishStatus`) hacia `lifecycleStatus` como fuente de verdad, en import, trending/listado con `allowedActions`, Listas y lazy repair — manteniendo dual-write, sin ninguna migración destructiva ni `DROP COLUMN`.

### Contexto (Etapa 8 congelada)
- Etapa 8 completa está **congelada**. Esta tarea cubre solo **8.1 (no destructiva)**.
- **8.2** (destructiva: búsqueda de referencias cero, `DROP COLUMN` legacy, desactivar dual-write, QA de regresión con rollback) queda para una iteración separada (`feat/fsm-legacy-removal-prep`) y **no se ejecuta en este ticket bajo ninguna circunstancia**.
- Referencia: `docs/04-Cierre-FSM-2026-08-20.md` (contrato canónico de 3 estados, compatibilidad legacy de solo lectura) y `docs/PROJECT_STATUS.md` (Próximas acciones, Etapa 8.1).
- Estado FSM actual: canónico implementado en código (`lifecycleStatus` en `schema.prisma:156`), 616 tests / 30 suites en verde, 14 migraciones sin drift, 230 productos.

### Archivos permitidos
- `src/backend/src/modules/products/import/**` (pipeline de import: batch-executor, row-validator, row-normalizer, column-mapper)
- `src/backend/src/modules/products/products.service.ts`, `products.controller.ts`, `lifecycle.types.ts` (solo las secciones de lectura de estado usadas por `allowedActions` en listado y lazy repair; NO tocar la máquina de estados FSM ya validada)
- `src/backend/src/modules/listas/listas.service.ts`, `listas.controller.ts`, `dto/create-lista.dto.ts`, `dto/update-lista.dto.ts`
- Tests `*.spec.ts` correspondientes a los archivos anteriores
- `src/backend/prisma/seed.ts`, `src/backend/scripts/dev-admin-bootstrap.ts` (únicamente para alinear el email admin canónico a `admin@grupo-security.com`; ver riesgo R006 en `docs/PROJECT_STATUS.md`)
- `docs/04-Cierre-FSM-2026-08-20.md`, `docs/PROJECT_STATUS.md` (actualizar estado al cerrar)
- `docs/agent-coordination/agent-status.md`, `docs/agent-coordination/file-ownership.md`, `docs/agent-coordination/work-log.md`

### Archivos prohibidos
- `src/backend/prisma/schema.prisma` (ninguna alteración de columnas; dual-write se mantiene intacto)
- Cualquier migración Prisma nueva que borre o altere columnas legacy (`isActive`, `isVisible`, `publishStatus`, `unpublishAt`)
- `src/backend/prisma/cleanup-orphaned-list-products.ts` (script `UNVERIFIED`, fuera de alcance)
- `.env`, credenciales, secretos
- `src/frontend/**` (fuera de alcance de este ticket; si se detecta una lectura legacy equivalente en frontend, documentarla como hallazgo, no modificarla aquí)

### Entradas disponibles
- `docs/04-Cierre-FSM-2026-08-20.md` — contrato canónico FSM y reglas de compatibilidad legacy
- `docs/PROJECT_STATUS.md` — riesgos R003-R006 y próximas acciones
- `CLAUDE.md` — decisiones vigentes (Etapa 8 congelada, alcance 8.1/8.2)
- Código actual: `products.service.ts` (métodos `effectiveLifecycleStatus`/normalización legacy ya existentes), `lifecycle.types.ts`

### Salida esperada
1. Documento de inventario (nuevo archivo, p. ej. `docs/agent-coordination/issues/fsm-lifecycle-migration-8-1-001-inventario.md` o sección en este mismo issue al completarlo) listando cada lectura/escritura legacy encontrada, archivo:línea, y el cambio propuesto.
2. Cambios de código que hagan que import, `allowedActions` en listado, Listas y lazy repair lean/escriban `lifecycleStatus` como fuente de verdad, preservando el dual-write hacia las columnas legacy (ninguna lectura legacy debe eliminarse todavía, solo dejar de ser la fuente primaria).
3. Email admin canónico alineado a `admin@grupo-security.com` en seed y bootstrap (coordinar con dato real ya en Neon DEV; si hay conflicto de datos, documentarlo como riesgo y no ejecutar cambios destructivos en BD).
4. Tests actualizados/nuevos que cubran el comportamiento migrado.
5. Documentación actualizada (`docs/04-Cierre-FSM-2026-08-20.md`, `docs/PROJECT_STATUS.md`) reflejando el cierre de 8.1.

### Criterios de aceptación
- [ ] Inventario completo entregado (archivo:línea de cada lectura/escritura legacy relevante en import/Listas/allowedActions/lazy repair)
- [ ] Import, Listas, `allowedActions` de listado y lazy repair usan `lifecycleStatus` como fuente de verdad
- [ ] Dual-write hacia columnas legacy se mantiene sin cambios de esquema
- [ ] Ninguna migración destructiva ni `DROP COLUMN` ejecutada
- [ ] Email admin canónico `admin@grupo-security.com` reflejado en seed/bootstrap (documentando cualquier discrepancia con BD real)
- [ ] Suite de tests completa en verde (o solo con los mismos fallos preexistentes ya documentados en work-log, explícitamente identificados)
- [ ] `docs/04-Cierre-FSM-2026-08-20.md` y `docs/PROJECT_STATUS.md` actualizados

### Comandos de validación
```bash
cd src/backend
npx tsc --noEmit
npx prisma validate
npm run build
npm test
```

### Riesgos conocidos
- R006 (email seed `admin@gruposecurity.co` vs docs `admin@grupo-security.com`): verificar contra el usuario real ya bootstrapeado en Neon DEV antes de cambiar seed, para no crear un admin duplicado.
- Cambiar la fuente de verdad en lecturas sin tocar escrituras legacy puede introducir inconsistencias si algún flujo no cubierto todavía escribe directamente sobre `isActive`/`isVisible`/`publishStatus` sin pasar por la FSM — el inventario debe cubrir esto antes de migrar.
- No ejecutar `cleanup-orphaned-list-products.ts` ni ninguna operación destructiva bajo ningún pretexto de este ticket.
- Dependencia con hallazgos R003-R005 (throttler, query params, scripts residuales): quedan fuera de este ticket salvo que bloqueen la validación de 8.1.

## Resultado (al completar)

<!-- completed_at: -->
<!-- ### result_summary -->
