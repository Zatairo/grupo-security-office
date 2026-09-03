# DECISIONS.md — Índice de ADR (Architecture Decision Records)

> Registro de decisiones arquitectónicas del proyecto **FINANZAS 1:1**.
> Mantenido por `finance-orchestrator` y `solution-architect`.
> Formato: `docs/decisions/NNNN-titulo-corto.md`

## Plantilla ADR obligatoria

Cada ADR debe seguir esta estructura:

```markdown
# ADR NNNN: Título corto

**Fecha**: YYYY-MM-DD
**Estado**: Propuesto | Aprobado | Rechazado | Obsoleto
**Decisores**: @solution-architect, @finance-orchestrator, [otros]
**Contexto**: Qué problema resuelve, restricciones, supuestos
**Opciones consideradas**:
1. Opción A — Pros / Contras
2. Opción B — Pros / Contras
3. Opción C — Pros / Contras
**Decisión**: Opción elegida + justificación
**Consecuencias**: Impacto en código, tests, ops, equipo, deuda técnica
**Seguimiento**: Tareas derivadas, revisión programada
```

---

## Índice de ADR

| ID | Título | Estado | Fecha | Decisores | Archivo |
|----|--------|--------|-------|-----------|---------|
| 0001 | Stack baseline: Frontend React + Vite, Backend FastAPI, DB PostgreSQL | **Aprobado (Fase 0)** | 2026-09-01 | Usuario, finance-orchestrator | `docs/decisions/0001-stack-baseline.md` |
| 0002 | Monolito modular (sin microservicios, Redis, colas, K8s en MVP) | **Aprobado (Fase 0)** | 2026-09-01 | Usuario, finance-orchestrator | `docs/decisions/0002-monolith-modular.md` |
| 0003 | Persistencia: SQLAlchemy 2.x + Pydantic v2 (no SQLModel) | **Aprobado (Fase 0)** | 2026-09-01 | Usuario, finance-orchestrator, solution-architect | `docs/decisions/0001-orm-sqlalchemy-pydantic.md` |
| 0004 | Autenticación PWA: Sesión por cookie segura (HttpOnly, SameSite=Lax, CSRF, rotación, sesiones revocables en PG) | **Aprobado (Fase 0)** | 2026-09-01 | Usuario, finance-orchestrator, solution-architect, backend-engineer | `docs/decisions/0002-auth-cookie-session.md` |
| 0005 | Archivos: Interfaz abstracta StorageBackend (LocalFS dev, S3-compatible prod), BD metadatos, validación MIME/tamaño/hash, nada público | **Aprobado (Fase 0)** | 2026-09-01 | Usuario, finance-orchestrator, solution-architect, backend-engineer, devops-release-engineer | `docs/decisions/0003-file-storage-interface.md` |
| 0006 | Identificadores: UUIDv7 como PK interno (tipo nativo PG uuid), IDs externos separados (Excel, WhatsApp, OCR) | **Aprobado (Fase 0)** | 2026-09-01 | Usuario, finance-orchestrator, solution-architect, data-migration-engineer, backend-engineer | `docs/decisions/0004-identifiers-uuidv7.md` |
| 0007 | JSON canónico ingestión v1 (estructura, versionado) | ⏳ **Pendiente (Fase 1)** | - | solution-architect, ai-integration-engineer | - |
| 0008 | Moneda: COP en `NUMERIC(18,2)` + `Decimal` Python (nunca float) | ⏳ **Pendiente (Fase 1)** | - | solution-architect, data-migration-engineer, backend-engineer | - |
| 0009 | Soft delete + auditoría inmutable | ⏳ **Pendiente (Fase 1)** | - | solution-architect, backend-engineer, qa-security-reviewer | - |
| 0010 | Idempotency: header key + storage TTL + scope | ⏳ **Pendiente (Fase 1)** | - | solution-architect, backend-engineer | - |
| 0011 | WhatsApp: Feature flag + plantillas + límite mensual | ⏳ **Pendiente (Fase 5)** | - | solution-architect, ai-integration-engineer, finance-orchestrator | - |
| 0012 | OCR/IA: Proveedor local (Tesseract+LLM local) vs cloud | ⏳ **Pendiente (Fase 5)** | - | solution-architect, ai-integration-engineer | - |

---

## Decisiones de Fase 0 (Baseline - Pre-aprobadas por usuario)

### ADR 0001: Stack Baseline
**Decisión**: React 18 + TypeScript + Vite (PWA) | FastAPI + Python 3.11+ | PostgreSQL 16 | Alembic | Sesión cookie segura (ADR-0004) | TanStack Query | Zustand/Context | Tailwind + Radix/shadcn | pytest + Vitest + Playwright | GitHub Actions | Docker Compose | Google Sheets API (export only) | Meta WhatsApp Business (opt-in) | StorageBackend interface (ADR-0005) | pydantic-settings + env vars | UUIDv7 PK (ADR-0006)

**Justificación**: Stack moderno, tipado end-to-end, PWA mobile-first, monolito modular operable por equipo pequeño, sin dependencias externas complejas para MVP.

### ADR 0002: Monolito Modular
**Decisión**: Un solo deployable (backend + frontend estático servido por nginx), módulos internos con límites claros (domain-driven), sin Redis, colas, microservicios, Kubernetes en MVP. Background tasks con `asyncio`/`BackgroundTasks` de FastAPI.

**Justificación**: Reduce complejidad operativa, latencia, coste. MVP no necesita escalamiento horizontal. Módulos pueden extraerse luego si crece.

### ADR 0003: Persistencia — SQLAlchemy 2.x + Pydantic v2
Ver `docs/decisions/0001-orm-sqlalchemy-pydantic.md`

### ADR 0004: Autenticación PWA — Sesión por Cookie Segura
Ver `docs/decisions/0002-auth-cookie-session.md`

### ADR 0005: Archivos — Interfaz Abstracta StorageBackend
Ver `docs/decisions/0003-file-storage-interface.md`

### ADR 0006: Identificadores — UUIDv7 como PK Interno
Ver `docs/decisions/0004-identifiers-uuidv7.md`

---

## Decisiones pendientes para Fase 1 (requieren ADR)

### D007 — Moneda: COP en `NUMERIC(18,2)` + `Decimal` Python (nunca float)
*Ya definido en ADR-0003 stack y ADR-0001 orm; confirmar como decisión explícita*

### D008 — Soft delete + auditoría inmutable
**Decisión base**: `deleted_at` + `deleted_by` en todas las entidades financieras. Hard delete solo Super Admin con clave maestra + auditoría expresa. Audit log inmutable (append-only, sin UPDATE/DELETE).

### D009 — Idempotency: header key + storage TTL + scope
**Decisión base**: Header `Idempotency-Key: <uuid>` obligatorio en POST/PATCH/PUT/DELETE. Almacenar en `idempotency_keys` (key, hash_request, response_status, response_body, expires_at). TTL 24h. Scope: por usuario + endpoint.

### D010 — JSON canónico ingestión v1
**Requiere**: Definir esquema exacto (ver `ai-integration-engineer` spec), versionado semver, validación `jsonschema`, evolución backward-compatible.

---

## Cómo crear un nuevo ADR

1. **Orquestador** detecta decisión faltante → presenta máx. 3 opciones con recomendación.
2. **Usuario** aprueba o pide cambios.
3. **Arquitecto** redacta ADR en `docs/decisions/NNNN-titulo.md` usando plantilla.
4. **Orquestador** actualiza este índice (`DECISIONS.md`) y `PROJECT_STATUS.md`.
5. **Equipo** alinea implementación a la decisión.

---

## Convenciones de numeración

- `0001-0009`: Decisiones baseline / arquitectura global (Fase 0-1)
- `0010-0019`: Dominio datos / migración (Fase 2)
- `0020-0039`: Backend API / módulos (Fase 3)
- `0040-0059`: Frontend PWA / UX (Fase 4)
- `0060-0079`: IA / Integraciones (Fase 5)
- `0080-0099`: Infra / Seguridad / Operaciones (Fase 6)

---

## Historial de cambios

| Fecha | Cambio | Autor |
|-------|--------|-------|
| 2026-09-01 | Creación índice ADR con decisiones baseline (0001, 0002) y pendientes Fase 1 | finance-orchestrator |