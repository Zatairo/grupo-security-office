# PROJECT_STATUS.md — Estado del Proyecto FINANZAS 1:1

> Mantenido por `finance-orchestrator`. Actualizado en cada transición de fase/tarea.

---

## Estado actual

| Campo | Valor |
|-------|-------|
| **Fase activa** | **Fase 0: Descubrimiento y configuración** |
| **Gate actual** | **Gate 0: Validación equipo de agentes** |
| **Fecha inicio** | 2026-09-01 |
| **Última actualización** | 2026-09-01 |
| **Próximo hito** | Aprobación usuario para iniciar Fase 1 |

---

## Progreso por fase

### Fase 0: Descubrimiento y configuración ✅ COMPLETADA (Correcciones aplicadas)

| Tarea | Estado | Responsable | Evidencia |
|-------|--------|-------------|-----------|
| Inventario repositorio | ✅ Completado | finance-orchestrator | `docs/WORKFLOW.md` sección inventario |
| Localizar FINANZAS-1_1.xlsx | ⚠️ Pendiente (usuario debe proveer) | finance-orchestrator | `data/import/` preparado, `.gitignore` configurado |
| Crear 8 agentes especializados | ✅ Completado | finance-orchestrator | `.opencode/agents/*.md` (8 archivos + 4 legacy) |
| Crear AGENTS.md (raíz) | ✅ Completado | finance-orchestrator | `AGENTS.md` (con decisiones aprobadas) |
| Eliminar docs/AGENTS.md duplicado | ✅ Completado | finance-orchestrator | Solo existe `./AGENTS.md` |
| Crear docs/AGENT_TEAM.md | ✅ Completado | finance-orchestrator | `docs/AGENT_TEAM.md` |
| Crear docs/WORKFLOW.md | ✅ Completado | finance-orchestrator | `docs/WORKFLOW.md` |
| Crear docs/PROJECT_STATUS.md | ✅ Completado | finance-orchestrator | `docs/PROJECT_STATUS.md` |
| Crear docs/DECISIONS.md | ✅ Completado | finance-orchestrator | `docs/DECISIONS.md` + 4 ADRs aprobados |
| Validar configuración OpenCode | ✅ Completado | finance-orchestrator | `opencode.json` + frontmatter 8 agentes válidos |
| Ajustar permisos solution-architect | ✅ Completado | finance-orchestrator | Agente + AGENTS.md + opencode.json alineados |
| Preparar data/import/ | ✅ Completado | finance-orchestrator | `.gitkeep`, `README.md`, `.gitignore` interno |

**Gate 0**: ✅ **Correcciones aplicadas — Solicitando aprobación definitiva**

---

### Fase 1: Arquitectura y contratos ⏳ PENDIENTE

| Tarea | Estado | Responsable | Evidencia |
|-------|--------|-------------|-----------|
| Requisitos funcionales/no funcionales | ⏳ | solution-architect | - |
| Modelo de dominio + ERD | ⏳ | solution-architect | - |
| ADR: ORM choice (SQLAlchemy vs SQLModel) | ⏳ | solution-architect | - |
| ADR: Auth strategy (JWT + refresh) | ⏳ | solution-architect | - |
| ADR: File storage interface | ⏳ | solution-architect | - |
| JSON canónico ingestión v1 | ⏳ | solution-architect + ai-integration-engineer | - |
| OpenAPI inicial | ⏳ | solution-architect + backend-engineer | - |
| Modelo amenazas (STRIDE) | ⏳ | solution-architect + qa-security-reviewer | - |
| Módulos y límites | ⏳ | solution-architect | - |

**Gate 1**: ⏳ Pendiente aprobación arquitectura.

---

### Fase 2: Datos y migración ⏳ PENDIENTE

| Tarea | Estado | Responsable | Evidencia |
|-------|--------|-------------|-----------|
| Informe calidad Excel | ⏳ | data-migration-engineer | - |
| Catálogos canónicos | ⏳ | data-migration-engineer | - |
| Esquema PostgreSQL + Alembic | ⏳ | data-migration-engineer + backend-engineer | - |
| Importador idempotente | ⏳ | data-migration-engineer | - |
| Conciliación totales mes a mes | ⏳ | data-migration-engineer | - |
| Rollback lógico | ⏳ | data-migration-engineer | - |
| Reporte excepciones | ⏳ | data-migration-engineer | - |

**Gate 2**: ⏳ Pendiente conciliación y backup.

---

### Fase 3: Backend MVP ⏳ PENDIENTE

| Módulo | Estado | Responsable | Evidencia |
|--------|--------|-------------|-----------|
| Auth (JWT, refresh, RBAC) | ⏳ | backend-engineer | - |
| Users/Profiles | ⏳ | backend-engineer | - |
| Households/Groups | ⏳ | backend-engineer | - |
| Categories/Subcategories | ⏳ | backend-engineer | - |
| Accounts/PaymentMethods | ⏳ | backend-engineer | - |
| Transactions (CRUD, tipos, estados) | ⏳ | backend-engineer | - |
| TransactionItems (multi-categoría) | ⏳ | backend-engineer | - |
| TransactionSplits (suma = total) | ⏳ | backend-engineer | - |
| Attachments (validación, storage interface) | ⏳ | backend-engineer | - |
| Ingestion/Validation (JSON canónico v1) | ⏳ | backend-engineer + ai-integration-engineer | - |
| Budgets | ⏳ | backend-engineer | - |
| AuditLog (inmutable) | ⏳ | backend-engineer | - |
| Exports (Sheets, Excel) | ⏳ | backend-engineer | - |
| Tests unitarias + integración | ⏳ | backend-engineer | - |

**Gate 3**: ⏳ Pendiente revisión qa-security-reviewer + aprobación usuario.

---

### Fase 4: PWA MVP ⏳ PENDIENTE

| Pantalla | Estado | Responsable | Evidencia |
|----------|--------|-------------|-----------|
| Auth (Login, Register, Reset, WebAuthn) | ⏳ | frontend-pwa-engineer | - |
| Onboarding (Hogar, Invitación, COP) | ⏳ | frontend-pwa-engineer | - |
| Registro rápido (FAB) | ⏳ | frontend-pwa-engineer | - |
| Bandeja validación | ⏳ | frontend-pwa-engineer | - |
| Historial + Filtros + Detalle | ⏳ | frontend-pwa-engineer | - |
| Dashboard mensual | ⏳ | frontend-pwa-engineer | - |
| Presupuestos | ⏳ | frontend-pwa-engineer | - |
| Configuración | ⏳ | frontend-pwa-engineer | - |
| PWA (SW, Manifest, Install, Offline) | ⏳ | frontend-pwa-engineer | - |
| Tests unit + E2E (Playwright) | ⏳ | frontend-pwa-engineer | - |
| Test real iOS Safari + Android Chrome | ⏳ | frontend-pwa-engineer | - |

**Gate 4**: ⏳ Pendiente test real dispositivos + qa-security-reviewer.

---

### Fase 5: IA e integraciones ⏳ PENDIENTE

| Componente | Estado | Responsable | Evidencia |
|------------|--------|-------------|-----------|
| Pipeline OCR → LLM → JSON canónico | ⏳ | ai-integration-engineer | - |
| Workers background (sin Redis) | ⏳ | ai-integration-engineer | - |
| Deduplicación (pHash + idempotency) | ⏳ | ai-integration-engineer | - |
| Bandeja validación API + tipos | ⏳ | ai-integration-engineer + frontend-pwa-engineer | - |
| WhatsApp webhook (feature flag) | ⏳ | ai-integration-engineer | - |
| Export Google Sheets + Excel | ⏳ | ai-integration-engineer + backend-engineer | - |
| Privacidad (anonimización) | ⏳ | ai-integration-engineer | - |

**Gate 5**: ⏳ Pendiente.

---

### Fase 6: Endurecimiento y entrega ⏳ PENDIENTE

| Área | Estado | Responsable | Evidencia |
|------|--------|-------------|-----------|
| E2E flujos críticos | ⏳ | qa-security-reviewer + todos | - |
| Seguridad (pen test, deps, secrets) | ⏳ | qa-security-reviewer + devops-release-engineer | - |
| Backup/Restore probado | ⏳ | devops-release-engineer | - |
| CI/CD pipeline verde | ⏳ | devops-release-engineer | - |
| Runbooks completos | ⏳ | devops-release-engineer | - |
| Observabilidad (logs sin PII, métricas, alertas) | ⏳ | devops-release-engineer | - |
| Deploy producción autorizado | ⏳ | devops-release-engineer + usuario | - |

**Gate 6**: ⏳ Pendiente — **ENTREGA FINAL**.

---

## Backlog priorizado (próximas tareas accionables)

| Prioridad | Tarea | Fase | Owner | Dependencias |
|-----------|-------|------|-------|--------------|
| 1 | Localizar/confirmar FINANZAS-1_1.xlsx | 0 | finance-orchestrator | Usuario provee archivo |
| 2 | Validar sintaxis agentes OpenCode | 0 | finance-orchestrator | - |
| 3 | Gate 0: Aprobación usuario → Iniciar Fase 1 | 0 | Usuario | Tareas 1-2 |
| 4 | ADR: ORM choice (SQLAlchemy 2.x vs SQLModel) | 1 | solution-architect | Gate 0 |
| 5 | Modelo dominio + ERD | 1 | solution-architect | Gate 0 |
| 6 | JSON canónico ingestión v1 | 1 | solution-architect + ai-integration-engineer | Gate 0 |
| 7 | Modelo amenazas STRIDE | 1 | solution-architect + qa-security-reviewer | Gate 0 |

---

## Riesgos y bloqueos activos

| ID | Riesgo/Bloqueo | Severidad | Impacto | Mitigación / Acción | Owner |
|----|----------------|-----------|---------|---------------------|-------|
| R001 | **FINANZAS-1_1.xlsx no encontrado en repo** | Alto | Bloquea Fase 2 (migración) | Usuario debe confirmar ubicación o proveer archivo en `data/import/` | finance-orchestrator / Usuario |
| R002 | Stack actual repo es NestJS/React (Grupo Security), no FastAPI/React | Medio | Confusión potencial | Documentar claro: este AGENTS.md es SOLO para FINANZAS 1:1 | finance-orchestrator |
| R003 | Código legacy Grupo Security en `.opencode/agents/` (4 archivos extra) | Bajo | Confusión agentes | Mantener separados; no usar para FINANZAS 1:1 | finance-orchestrator |

---

## Deuda técnica conocida

| ID | Descripción | Fase origen | Prioridad | Plan |
|----|-------------|-------------|-----------|------|
| DT001 | Repo tiene código legado Grupo Security (NestJS) | 0 | Baja | Aislar en carpeta separada o ignorar; no mezclar stacks | finance-orchestrator |

---

## Decisiones pendientes (requieren aprobación)

| ID | Decisión | Opciones | Recomendación | Estado |
|----|----------|----------|---------------|--------|
| D001 | **Moneda**: COP en `NUMERIC(18,2)` + `Decimal` Python (nunca float) | Ya definido en stack baseline | Confirmar como ADR explícito | ⏳ Para Fase 1 (ADR) |
| D002 | **Soft delete** + auditoría inmutable | `deleted_at` + `deleted_by` en entidades financieras | Hard delete solo Super Admin + clave maestra + audit | ⏳ Para Fase 1 (ADR) |
| D003 | **Idempotency**: header key + storage TTL + scope | Header `Idempotency-Key` obligatorio en mutaciones | TTL 24h, scope por usuario + endpoint | ⏳ Para Fase 1 (ADR) |
| D004 | **JSON canónico ingestión v1** | Definir esquema exacto, versionado semver | Ver `ai-integration-engineer` spec | ⏳ Para Fase 1 (ADR) |

---

## Active Locks (propiedad temporal de archivos)

> Gestionado por finance-orchestrator. Un archivo = un owner.

```
## Active Locks
- AGENTS.md → finance-orchestrator (expira: 2026-09-05)
- docs/AGENT_TEAM.md → finance-orchestrator (expira: 2026-09-05)
- docs/WORKFLOW.md → finance-orchestrator (expira: 2026-09-05)
- docs/PROJECT_STATUS.md → finance-orchestrator (expira: 2026-09-05)
- docs/DECISIONS.md → finance-orchestrator (expira: 2026-09-05)
- .opencode/agents/*.md → finance-orchestrator (expira: 2026-09-05)
```

---

## Métricas de salud

| Métrica | Actual | Target | Tendencia |
|---------|--------|--------|-----------|
| Fases completadas | 0/6 | 6/6 | ⏳ Inicio |
| Gates aprobados | 0/6 | 6/6 | ⏳ Inicio |
| Agentes operativos | 8/8 | 8/8 | ✅ |
| Docs coordinación | 5/5 | 5/5 | ✅ |
| Hallazgos QA bloqueantes | 0 | 0 | ✅ |
| Deuda técnica documentada | 1 | < 5 | ✅ |

---

## Próximas acciones

1. **Usuario**: Confirmar ubicación `FINANZAS-1_1.xlsx` o proveer archivo en `data/import/`
2. **Usuario**: Aprobar Gate 0 definitivo → "Equipo listo para Fase 1"
3. **Arquitecto**: Iniciar Fase 1 — Modelo dominio, ERD, JSON canónico v1, OpenAPI inicial, Threat model

---

## Historial de cambios

| Fecha | Fase | Cambio | Autor |
|-------|------|--------|-------|
| 2026-09-01 | 0 | Creación inicial estado proyecto | finance-orchestrator |
| 2026-09-01 | 0 | Correcciones Gate 0: AGENTS.md a raíz, permisos solution-architect, data/import/.gitignore, 4 ADRs aprobados, opencode.json validado | finance-orchestrator |