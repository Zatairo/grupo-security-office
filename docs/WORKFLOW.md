# WORKFLOW.md — Fases, Puertas de Aprobación y Contratos de Delegación

> Flujo de trabajo obligatorio del proyecto **FINANZAS 1:1**. Mantenido por `finance-orchestrator`.

## Visión general de fases

```
Fase 0: Descubrimiento y configuración ──────► GATE 0
Fase 1: Arquitectura y contratos ───────────► GATE 1
Fase 2: Datos y migración ──────────────────► GATE 2
Fase 3: Backend MVP ────────────────────────► GATE 3
Fase 4: PWA MVP ────────────────────────────► GATE 4
Fase 5: IA e integraciones ─────────────────► GATE 5
Fase 6: Endurecimiento y entrega ───────────► GATE 6 (DONE)
```

**Regla de oro**: Una fase a la vez. No avanzar sin aprobación explícita en la puerta correspondiente.

---

## Fase 0 — Descubrimiento y configuración (ACTUAL)

### Objetivo
Inventariar repositorio, detectar stack/archivos existentes, crear agentes, reglas y documentación de coordinación. **Sin código de producto.**

### Tareas
- [x] Inventario repositorio (estructura, stack actual, archivos fuente)
- [x] Localizar `FINANZAS-1_1.xlsx` (confirmar existencia, no modificar)
- [x] Crear 8 agentes especializados en `.opencode/agents/`
- [x] Crear/actualizar `AGENTS.md` específico FINANZAS 1:1
- [x] Crear `docs/AGENT_TEAM.md` (matriz responsabilidades)
- [x] Crear `docs/WORKFLOW.md` (este documento)
- [x] Crear `docs/PROJECT_STATUS.md` (estado inicial Fase 0)
- [x] Crear `docs/DECISIONS.md` (índice ADR vacío)
- [ ] Validar sintaxis agentes y configuración OpenCode

### Entregables
- 8 archivos agente válidos
- 5 archivos docs de coordinación
- Árbol de archivos creado documentado

### Gate 0 — Validación equipo
**Qué se valida**: Agentes creados, docs coordinación completos, repo inventariado, sin código producto.
**Quién aprueba**: Usuario
**Criterio**: Usuario confirma "Equipo listo para Fase 1"

---

## Fase 1 — Arquitectura y contratos

### Objetivo
Definir arquitectura completa, modelo de dominio, contratos de datos, API y amenazas. **Solo lectura/análisis + docs.**

### Tareas (solution-architect lead)
1. **Requisitos funcionales/no funcionales** → `docs/requirements.md`
2. **Modelo de dominio** (entidades, relaciones, invariantes) → `docs/data-model.md`
3. **ERD** (Mermaid/PlantUML) → `docs/erd.md`
4. **ADR stack** (ORM choice, auth, etc.) → `docs/decisions/0001-stack-choices.md`
5. **JSON canónico ingestión v1** → `docs/contracts/ingestion-v1.json` + schema
6. **OpenAPI inicial** → `docs/api/openapi.yaml`
7. **Modelo amenazas** (STRIDE) → `docs/security/threat-model.md`
8. **Módulos y límites** → `docs/architecture/modules.md`

### Entregables Gate 1
- ADR documentados (mínimo: ORM, Auth strategy, File storage interface)
- Modelo dominio validado con data-migration-engineer
- Contrato JSON ingestión v1 aprobado por ai-integration-engineer
- OpenAPI base para backend-engineer + frontend-pwa-engineer
- Threat model revisado por qa-security-reviewer

### Gate 1 — Aprobación arquitectura
**Qué se valida**: ADR completos, modelo dominio/ERD, JSON canónico, OpenAPI, threat model.
**Quién aprueba**: Usuario (con input qa-security-reviewer en threat model)
**Criterio**: Usuario firma "Arquitectura aprobada, iniciar Fase 2"

---

## Fase 2 — Datos y migración

### Objetivo
Auditar Excel, diseñar esquema BD, crear migraciones, importador idempotente, conciliar totales.

### Tareas (data-migration-engineer lead)
1. **Informe calidad Excel** → `docs/migration/quality-report.md`
   - Perfil: filas, columnas, nulos, duplicados, catálogos, totales mes
   - Problemas: IDs dup, grupos mezclados, pagos heterogéneos, validación contaminada, multi-categoría, pagador vs responsable
2. **Catálogos canónicos** → `docs/migration/catalogs/` (users, categories, payment_methods, groups)
3. **Esquema PostgreSQL + Alembic** → `src/backend/alembic/versions/` + `src/backend/models/`
   - Coordinar con solution-architect (ADR ORM) y backend-engineer (modelos código)
4. **Importador idempotente** → `scripts/migrate/import.py`
   - Lee Excel → valida → transforma → upsert BD con idempotency key (hash fila + versión)
   - Registros ambiguos → tabla `migration_review` + reporte
5. **Conciliación** → Script compara: filas fuente vs BD, totales mes fuente vs BD
6. **Rollback lógico** → Script `scripts/migrate/rollback.py` (soft-delete por batch_id)
7. **Reporte excepciones** → `docs/migration/exceptions-report.md`

### Reglas obligatorias migración
- Excel **inmutable** (solo lectura)
- Idempotente: re-ejecutar mismo archivo = mismo estado BD
- No corrección silenciosa: ambiguos → revisión
- Conciliación **mes a mes** antes/después documentada
- Backup BD antes de primera carga real

### Gate 2 — Listo para migrar datos reales
**Qué se valida**: Informe calidad, catálogos, esquema+Alembic, importador idempotente probado con datos sintéticos, conciliación OK, backup existe.
**Quién aprueba**: Usuario
**Criterio**: "Totales cuadran, respaldo OK, migración autorizada"

---

## Fase 3 — Backend MVP

### Objetivo
Implementar API completa: auth, CRUD transacciones, splits, adjuntos, aprobación, auditoría.

### Módulos (backend-engineer lead)
| Módulo | Endpoints clave | Reglas críticas |
|--------|-----------------|-----------------|
| **Auth** | POST /auth/login, /register, /refresh, /logout | JWT + refresh, bcrypt, rate limit, secure cookies |
| **Users/Profiles** | GET/PATCH /me, /users/:id | Ownership, RBAC hogar |
| **Households** | POST /households, POST /invite, PATCH /members/:id | Roles: admin/miembro, invitación token |
| **Categories** | CRUD /categories, /subcategories | Jerarquía, iconos, colores, default per hogar |
| **Accounts/PaymentMethods** | CRUD /accounts | Tipo: cash, card, bank, digital; saldo actual |
| **Transactions** | CRUD /transactions | Tipo: income/expense/transfer/adjustment; estado: draft/approved/rejected/voided |
| **TransactionItems** | POST /transactions/:id/items | Multi-categoría por comprobante |
| **TransactionSplits** | POST /transactions/:id/splits | **Suma = total exacto**; pagador ≠ responsables |
| **Attachments** | POST /attachments (presigned), GET /attachments/:id | Validación MIME/tamaño, nombre seguro, scan opcional |
| **Ingestion/Validation** | POST /ingest, GET /ingest/:id, POST /ingest/:id/approve\|reject\|correct | JSON canónico v1, deduplicación, bandeja validación |
| **Budgets** | CRUD /budgets | Periodo, categoría, alerta umbral |
| **AuditLog** | GET /audit | Filtros, inmutable, paginación cursor |
| **Exports** | POST /exports/sheets, /exports/excel | Jobs async, unidireccional |

### Transversal (todos los módulos)
- **Idempotency**: Header `Idempotency-Key` obligatorio en POST/PATCH/PUT/DELETE
- **Auditoría**: Auto-en service layer (entity, action, old/new, user, ip, request_id)
- **Soft delete**: `deleted_at` + `deleted_by`; hard delete solo admin + master key + audit
- **Validación splits**: En service, no solo BD constraint
- **Decimal**: `NUMERIC(18,2)` BD, `Decimal` Python, **nunca float**
- **Tests**: Unitarias (servicios) + Integración (endpoints) + Contrato (OpenAPI)

### Gate 3 — Backend MVP listo
**Qué se valida**: Auth completo, CRUD transacciones+splits+adjuntos, aprobación flujo, auditoría, tests pasando, OpenAPI actualizado.
**Quién aprueba**: Usuario + qa-security-reviewer (revisión seguridad/integridad)
**Criterio**: "Backend funcional, seguro, probado"

---

## Fase 4 — PWA MVP

### Objetivo
Frontend completo mobile-first: login, registro rápido, bandeja validación, historial, dashboard, instalación iOS/Android.

### Pantallas (frontend-pwa-engineer lead)
1. **Auth**: Login, Register, Password reset, Biometría (WebAuthn opcional)
2. **Onboarding**: Crear hogar, invitar pareja, definir moneda COP
3. **Registro rápido (FAB)**: Gasto/Ingreso/Transferencia/Ajuste < 3 taps
4. **Bandeja validación**: Lista extracciones, Aprobar/Corregir/Rechazar, Diff visual
5. **Historial**: Filtros avanzados, lista virtualizada, detalle completo
6. **Detalle transacción**: Editar (draft), splits, adjuntos, auditoría, anular
7. **Dashboard mensual**: Resumen, top categorías, presupuesto vs real, deudas internas
8. **Presupuestos**: CRUD, alertas visuales, rollover
9. **Configuración**: Perfil, hogar, miembros, categorías, cuentas, notificaciones, export

### Estados UX obligatorios
- Loading: Skeletons (no spinners)
- Error: Toast accionable + retry inline (red/validación/servidor/auth)
- Vacío: Ilustración + CTA clara
- Offline: Banner persistente, cola IndexedDB, sync auto + deduplicación
- Retry seguro: Idempotency keys en mutaciones offline, backoff exponencial + jitter

### Accesibilidad (WCAG 2.1 AA)
- Contraste ≥ 4.5:1 texto, 3:1 UI
- Foco visible, orden Tab lógico
- ARIA labels, `role="alert"`, `aria-live`
- Formularios: `<label>`, `aria-describedby`
- Texto escalable (rem), funcional 200% zoom

### Testing cross-browser
- Unit: Vitest + RTL
- E2E: Playwright (Chrome, Firefox, WebKit, Mobile Chrome, Mobile Safari)
- Real: iOS Safari (Simulator/device) + Android Chrome (device)

### Gate 4 — PWA MVP lista
**Qué se valida**: Login, registro rápido, bandeja, historial, dashboard, instalación real iOS/Android, offline queue, accesibilidad AA.
**Quién aprueba**: Usuario + qa-security-reviewer
**Criterio**: "Flujo principal completa en iOS y Android, PWA instalable"

---

## Fase 5 — IA e integraciones

### Objetivo
OCR/IA tras interfaces, ingestión versionada, export Sheets/Excel, WhatsApp opcional controlado.

### Tareas (ai-integration-engineer lead)
1. **Pipeline ingestión**: Imagen/PDF → OCR → LLM estructurado → JSON canónico v1
2. **Workers background**: `fastapi.BackgroundTasks` / `asyncio` (sin Redis MVP)
3. **Deduplicación**: pHash imagen + `idempotency_key` en `extraction_jobs`
4. **Bandeja validación API**: Endpoints approve/reject/correct + tipos compartidos frontend
5. **WhatsApp**: Meta Business API webhook (entrante), plantillas salientes (feature flag `WHATSAPP_ENABLED=false` default)
6. **Export**: Google Sheets API (append-only) + Excel (openpyxl) jobs async
7. **Privacidad**: Anonimización antes de IA externa, preferir local/on-prem

### Reglas críticas
- IA/OCR **nunca** escribe directo en tablas financieras → solo propone a bandeja
- Reglas determinísticas validan (suma splits, categoría existe, usuario en hogar, monto > 0)
- Confianza por campo: umbral configurable (0.85 simple, splits/pagador siempre revisión)
- WhatsApp saliente: solo alertas presupuesto, recordatorio cierre, confirmación recepción → **minimizar coste**

### Gate 5 — Integraciones listas
**Qué se valida**: OCR/IA tras interfaces, JSON canónico v1, deduplicación, bandeja validación funcional, export Sheets/Excel, WhatsApp opcional con feature flag y límite mensajes.
**Quién aprueba**: Usuario + qa-security-reviewer
**Criterio**: "Ingestión completa sin escritura directa, export funciona, WhatsApp controlado"

---

## Fase 6 — Endurecimiento y entrega

### Objetivo
E2E completo, seguridad, backup/restore probado, CI verde, runbooks, deploy autorizado.

### Tareas (todos, devops-release-engineer lead en infra)
1. **E2E crítico**: Flujos completos usuario real (registro → gasto → split → validación → dashboard → export)
2. **Seguridad**: Pen test ligero, dependency audit, secret scan, CSP/HSTS headers, rate limits
3. **Backup/Restore**: `pg_restore` test documentado, RPO/RTO definidos, runbook probado
4. **CI/CD**: Pipeline verde (lint, typecheck, tests, build, security scan, deploy staging)
5. **Runbooks**: Incident response, DB restore, migration failure, secret rotation, capacity
6. **Observabilidad**: Logs estructurados sin PII/financieros, métricas RED + business, alertas
7. **Deploy producción**: Autorización humana + 2 aprobadores, rollback automático health check fail

### Gate 6 — Entrega autorizada
**Qué se valida**: E2E verde, seguridad sin hallazgos bloqueantes/altos, backup/restore probado, CI verde, runbooks completos, deploy autorizado.
**Quién aprueba**: Usuario
**Criterio**: "Sistema listo para producción"

---

## Ciclo obligatorio por tarea (todas las fases)

```
1. PLAN BREVE
   - Objetivo único, archivos objetivo, criterios aceptación

2. CRITERIOS ACEPTACIÓN VERIFICABLES
   - Métricas, tests, evidencias esperadas

3. IMPLEMENTACIÓN (especialista)
   - Código + tests + docs proporcionales

4. PRUEBAS AUTOMÁTICAS
   - lint, typecheck, unit, integración, contract

5. REVISIÓN qa-security-reviewer
   - Hallazgos por severidad, reporte documentado

6. CORRECCIONES
   - Fix bloqueantes/altos en misma iteración

7. INFORME EVIDENCIA
   - Qué se hizo, tests pasan, riesgos residuales

8. APROBACIÓN ANTES DE SIGUIENTE PUERTA
   - Usuario valida evidencia
```

---

## Contrato de delegación (plantilla obligatoria)

Cada orden del orquestador a subagente **debe incluir**:

| Campo | Descripción |
|-------|-------------|
| **Objetivo único** | Una frase, resultado observable |
| **Archivos permitidos** | Paths exactos o glob patterns |
| **Archivos prohibidos** | Paths que NO debe tocar |
| **Entradas disponibles** | Docs, specs, schemas, código existente |
| **Salida esperada** | Archivos nuevos/modificados, tests, docs |
| **Criterios de aceptación** | Lista verificable (comandos, assertions) |
| **Comandos de validación** | Exactos para ejecutar y verificar |
| **Riesgos conocidos** | Técnicos, de dependencia, de alcance |

---

## Respuesta de subagente (formato obligatorio)

Cada subagente **debe responder** con:

| Campo | Descripción |
|-------|-------------|
| **Estado** | `completado` \| `bloqueado` \| `requiere decisión` |
| **Archivos modificados** | Lista paths relativos |
| **Decisiones tomadas** | Qué se decidió y por qué (trade-offs) |
| **Pruebas ejecutadas y resultados** | Comando + output resumen (passed/failed/coverage) |
| **Riesgos o deuda técnica** | Queda pendiente, known issues |
| **Siguiente acción recomendada** | Qué debería pasar ahora |

---

## Protección de archivos (concurrencia)

- Orquestador asigna **propiedad temporal** (lock) en `docs/PROJECT_STATUS.md#active-locks`
- Formato: `archivo → agente (expira: YYYY-MM-DD)`
- Un archivo = un owner. Conflicto → escalamiento Nivel 1.
- Lock expira auto al completar tarea o fecha.

---

## Versionado de contratos

| Contrato | Versionado | Ubicación | Romper requiere |
|----------|------------|-----------|-----------------|
| JSON ingestión | Semver (v1, v1.1, v2) | `docs/contracts/ingestion-v{major}.json` | ADR + Gate 1/5 |
| OpenAPI | Semver en `info.version` | `docs/api/openapi.yaml` | ADR + coordinación FE/BE |
| Esquema BD | Migraciones Alembic | `src/backend/alembic/versions/` | Migración expand-contract |
| API interno (services) | Semver interno | Código | Coordinación módulos |

---

## Métricas de salud del proceso

| Métrica | Target | Dónde se mide |
|---------|--------|---------------|
| Tiempo medio gate-to-gate | < 2 semanas/fase | `docs/PROJECT_STATUS.md` |
| Hallazgos bloqueantes/altos en Gate | 0 | Reportes QA |
| Cobertura tests críticos | > 90% | CI (pytest + playwright) |
| Tiempo build CI | < 15 min total | GitHub Actions |
| Deuda técnica conocida | Documentada en PROJECT_STATUS | `docs/PROJECT_STATUS.md#tech-debt` |

---

## Historial de cambios

| Fecha | Cambio | Autor |
|-------|--------|-------|
| 2026-09-01 | Creación inicial workflow FINANZAS 1:1 | finance-orchestrator |