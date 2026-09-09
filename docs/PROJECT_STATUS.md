# PROJECT_STATUS.md — Estado del Proyecto Grupo Security Office

> Plataforma Comercial Grupo Security. Coordinador estratégico: **Usuario + Claude Code**.

## Identidad activa

| Campo | Valor |
|-------|-------|
| **Proyecto** | Grupo Security Office / Plataforma Comercial Grupo Security |
| **Coordinador estratégico** | Usuario + Claude Code |
| **Ejecutores técnicos** | Kilo Code (reglas `.kilo/`) y OpenCode (perfiles `.opencode/`) |
| **Coordinación técnica OpenCode** | tech-lead-orchestrator (no reemplaza al coordinador) |

## Stack activo

| Capa | Tecnología |
|------|------------|
| Frontend | React + TypeScript + Tailwind CSS + Vite |
| Backend | NestJS + TypeScript |
| Database | PostgreSQL 16 |
| ORM | Prisma 5.x |
| Auth | JWT + bcrypt + RBAC |
| ERP | Yéminus (integración PENDIENTE de confirmación API) |

**Python**: auxiliar únicamente para parsing/mapping/validación/importación de Excel. No es backend primario.

## Estado del proyecto

| Campo | Valor |
|-------|-------|
| **Fase activa** | FSM de ciclo de vida de Product validada (616 tests, 30 suites, 14 migraciones sin drift, 230 productos). Próximo: Etapa 8.1 (migración de lecturas/escrituras a `lifecycleStatus` sin destructivas) |
| **Última actualización** | 2026-09-09 |

---

## Riesgos y bloqueos activos

| ID | Riesgo/Bloqueo | Severidad | Owner |
|----|----------------|-----------|-------|
| R001 | Integración ERP Yéminus sin confirmación de API | Medio | Coordinador (usuario + Claude Code) — decisión de alcance |
| R002 | `cleanup-orphaned-list-products.ts` sin validar | Alto | Coordinador (usuario + Claude Code) — autorizar ejecución solo con tarea explícita y aprobación del usuario |
| R003 | Throttler 429 agresivo en login | Bajo | Coordinador — proponer ajuste específico |
| R004 | `limit` no válido en `/api/products` (usa `skip`/`take`) | Bajo | Coordinador — normalizar query params |
| R005 | Scripts residuales `check-*.cjs`/`qa_*.js` en Temp/opencode | Bajo | Coordinador — limpiar post-QA |
| R006 | Email seed `admin@gruposecurity.co` vs docs `admin@grupo-security.com` | Bajo | Coordinador — alinear en Etapa 8.1 |

---

## Script de limpieza Prisma

- **Archivo**: `src/backend/prisma/cleanup-orphaned-list-products.ts`
- **Estado**: `UNVERIFIED — DO NOT EXECUTE WITHOUT EXPLICIT COORDINATOR (USER + CLAUDE CODE) TASK AND USER APPROVAL`
- **Nota**: Es un script administrativo destructivo (borrado físico en transacción). No se ejecuta sin autorización explícita.

---

## Deuda técnica conocida

| ID | Descripción | Prioridad |
|----|-------------|-----------|
| DT001 | Historial de perfiles FINANZAS 1:1 removidos; `finance-orchestrator.md` conservado como inactivo | Baja |

---

## Próximas acciones

1. **Etapa 8.1** (no destructiva): inventario y migración de lecturas/escrituras a `lifecycleStatus` en import, trending, Listas, lazy repair, `allowedActions` en listado; dual-write mantenido; docs/tests actualizados; email canónico (`admin@grupo-security.com`).
2. **Resolver hallazgos menores** (R003-R006): throttler 429, query params normalizados, scripts cleanup, email alineado.
3. **Evaluar Context7 y SkillsMP** (seguimiento): MCP de documentación actualizada de librerías y marketplace de skills por dominio para reforzar cada agente.
4. **Monitoreo activo**: ver `docs/agent-coordination/issues/` para tareas en vuelo; no dejar este archivo obsoleto — actualizar con nueva fase cuando Etapa 8.1 cierre.

**Ticket abierto**: `FSM-LIFECYCLE-MIGRATION-8.1-001` (`docs/agent-coordination/issues/fsm-lifecycle-migration-8-1-001.md`), status `pending`, asignado a `opencode`/`backend-engineer`.

---

## Gobernanza de documentación

| Recurso | Rol |
|---------|-----|
| `docs/README.md` | Punto de entrada canónico de la documentación |
| `docs/agent-coordination/` | Fuente de coordinación de ejecución (estado, ownership, work-log) |
| `docs/adr/` | Única ubicación para nuevas decisiones de arquitectura (ADR) |

- La documentación heredada de **OpenClaw** y **FINANZAS 1:1** (incluyendo
  FastAPI, SQLAlchemy, Alembic, Pydantic y el ORQUESTADOR heredado) fue eliminada
  en la tarea `DOCS-CLEANUP-001`.
- Los documentos de modelo de datos, arquitectura backend, autenticación, testing,
  seguridad, alcance MVP y despliegue **requieren reconciliación verificada**
  posterior (identificado en `DOCS-AUDIT-001`). No se tratan como verificados hasta
  contrastarlos contra el código y la historia reciente de Git.

---

## Historial de cambios

| Fecha | Cambio | Autor |
|-------|--------|-------|
| 2026-09-09 | Reestructuración de documentación: coordinador = usuario + Claude Code; OpenCode 11 agentes, Kilo 2 agentes; tablero de issues en `docs/agent-coordination/issues/`; Etapa 8.1 como próximo paso; hallazgos menores añadidos a riesgos | agente Haiku (plan enumerated-whistling-rivest) |
| 2026-09-03 | Reconciliación de identidad a Grupo Security Office; stack NestJS/Prisma/React; finance-orchestrator inactivo; script Prisma marcado UNVERIFIED | tech-lead-orchestrator |