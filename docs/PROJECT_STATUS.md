# PROJECT_STATUS.md — Estado del Proyecto Grupo Security Office

> Plataforma Comercial Grupo Security. Coordinador estratégico: **Perplexity**.

## Identidad activa

| Campo | Valor |
|-------|-------|
| **Proyecto** | Grupo Security Office / Plataforma Comercial Grupo Security |
| **Coordinador estratégico** | Perplexity |
| **Ejecutores técnicos** | Kilo Code (reglas `.kilo/`) y OpenCode (perfiles `.opencode/`) |
| **Coordinación técnica OpenCode** | tech-lead-orchestrator (no reemplaza a Perplexity) |

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
| **Fase activa** | Fase 1: Sistema interno modular (panel administrativo) |
| **Última actualización** | 2026-09-03 |

---

## Riesgos y bloqueos activos

| ID | Riesgo/Bloqueo | Severidad | Owner |
|----|----------------|-----------|-------|
| R001 | Integración ERP Yéminus sin confirmación de API | Medio | Perplexity (decisión de alcance) |
| R002 | `cleanup-orphaned-list-products.ts` sin validar | Alto | Perplexity (autorizar ejecución solo con tarea explícita y aprobación del usuario) |

---

## Script de limpieza Prisma

- **Archivo**: `src/backend/prisma/cleanup-orphaned-list-products.ts`
- **Estado**: `UNVERIFIED — DO NOT EXECUTE WITHOUT EXPLICIT PERPLEXITY TASK AND USER APPROVAL`
- **Nota**: Es un script administrativo destructivo (borrado físico en transacción). No se ejecuta sin autorización explícita.

---

## Deuda técnica conocida

| ID | Descripción | Prioridad |
|----|-------------|-----------|
| DT001 | Historial de perfiles FINANZAS 1:1 removidos; `finance-orchestrator.md` conservado como inactivo | Baja |

---

## Próximas acciones

1. **Perplexity**: confirmar próximo incremento comercial (Fase 1).
2. **Revisión**: validar baseline de coordinación reconciliado (tarea COORD-VERIFY posterior).
3. **Ejecutores**: esperar asignación de Perplexity con alcance estricto y ownership de archivos.

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
| 2026-09-03 | Reconciliación de identidad a Grupo Security Office; stack NestJS/Prisma/React; finance-orchestrator inactivo; script Prisma marcado UNVERIFIED | tech-lead-orchestrator |