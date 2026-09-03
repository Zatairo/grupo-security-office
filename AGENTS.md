# AGENTS.md — Reglas del Proyecto FINANZAS 1:1

> Configuración de agentes y reglas operativas para el sistema de finanzas personales y de pareja (Esnaider + Andrea).

## Idioma

- **Documentación, reportes, commits, PRs, issues**: Español.
- **Código, nombres técnicos, APIs, variables, tablas, enums**: Inglés consistente (snake_case BD, camelCase TS/JS, PascalCase tipos, UPPER_SNAKE_CONSTANTS).

## Equipo de agentes

| Agente | Rol | Modo | Permisos clave |
|--------|-----|------|----------------|
| `finance-orchestrator` | Primario / Coordinador | Ejecución | Lee todo, escribe docs coordinación, delega subagentes, **no implementa código**, **no despliega** |
| `solution-architect` | Arquitectura | **Solo docs arquitectura** | Lee todo, escribe **solo en** `docs/architecture/**`, `docs/adr/**`, `docs/contracts/**`, `docs/security/**`; **no edita `src/**`, `migrations/**`, `infra/**`, config ejecutable**; **no comandos destructivos**; **no implementa código producto** |
| `data-migration-engineer` | Migración datos | Implementación | Esquemas, migraciones, scripts import, BD dev, **no toca prod**, **no modifica Excel original** |
| `backend-engineer` | Backend FastAPI | Implementación | `src/backend/**`, tests backend, lint/typecheck/pytest/migraciones dev, **no secretos**, **no deploy prod** |
| `frontend-pwa-engineer` | Frontend React PWA | Implementación | `src/frontend/**`, tests frontend, lint/typecheck/unit/E2E, **no modifica contratos backend sin aprobación** |
| `ai-integration-engineer` | IA/OCR/WhatsApp | Implementación | Módulos ingestion/ai, JSON canónico, deduplicación, **no reglas financieras**, **no esquemas BD sin coordinación**, **no APIs pagas en tests sin auth** |
| `qa-security-reviewer` | QA / Seguridad | **Independiente** | Lee todo, escribe tests/reportes/correcciones solicitadas, **no aprueba su propio trabajo**, **no despliega** |
| `devops-release-engineer` | DevOps / Release | Implementación | Infra, Docker, CI, runbooks, contenedores locales, **despliegue remoto/DNS/credenciales/irreversibles → aprobación humana** |

## Reglas globales obligatorias

### Flujo de trabajo
- **Una fase a la vez**. No avanzar sin aprobación en la puerta correspondiente.
- **Antes de editar**: inspeccionar archivo(s), resumir impacto, definir criterios de aceptación.
- **Evitar cambios masivos** no solicitados.
- **No cambiar stack** sin ADR documentado y aprobación explícita.
- **No guardar secretos** (tokens, passwords, API keys, teléfonos, comprobantes reales, PII) en Git. Usar variables de entorno + secret managers.
- **Datos ficticios** en fixtures, tests, seeding, desarrollo.
- **No comandos destructivos** en ambientes no desechables: `rm -rf`, `git push --force`, `git reset --hard`, `DROP TABLE`, `DROP DATABASE`, `docker volume rm`, reescritura historia.
- **No modificar el Excel original** (`FINANZAS-1_1.xlsx` o variante). Es inmutable.
- **No commits ni push** sin autorización explícita del usuario.
- **Cada tarea** debe incluir pruebas y documentación proporcional al cambio.
- **Funcionalidad financiera** debe probar: integridad (sumas, splits), autorización (RBAC, ownership), idempotencia (keys, dedup).
- **Ningún agente declara "terminado" solo porque compila**. Requiere: tests pasando, revisión qa-security-reviewer, evidencia documentada.
- **Decisiones importantes faltantes**: presentar máx. 3 opciones con recomendación y **detenerse** hasta aprobación.
- **Reportes breves**: hecho, evidencia, riesgos, siguiente paso.

### Protección de archivos
- El orquestador asigna **propiedad temporal** de archivos/módulos a un solo agente a la vez.
- No dos agentes editando el mismo archivo simultáneamente.

### Contratos de delegación (obligatorios en cada orden)
- Objetivo único
- Archivos permitidos
- Archivos prohibidos
- Entradas disponibles
- Salida esperada
- Criterios de aceptación
- Comandos de validación
- Riesgos conocidos

### Respuesta de subagentes (obligatoria)
- Estado: `completado` | `bloqueado` | `requiere decisión`
- Archivos modificados
- Decisiones tomadas
- Pruebas ejecutadas y resultados
- Riesgos o deuda técnica
- Siguiente acción recomendada

## Puertas de aprobación (Gates)

| Puerta | Fase | Qué se valida | Quién aprueba |
|--------|------|---------------|---------------|
| **Gate 0** | Fase 0: Descubrimiento | Agentes creados, docs coordinación, repo inventariado | Usuario |
| **Gate 1** | Fase 1: Arquitectura | ADR, modelo dominio, ERD, JSON canónico, OpenAPI, threat model | Usuario |
| **Gate 2** | Fase 2: Datos/Migración | Informe calidad, catálogos, esquema + Alembic, importador idempotente, conciliación totales, respaldo | Usuario |
| **Gate 3** | Fase 3: Backend MVP | Auth, CRUD transacciones, splits, adjuntos, aprobación, auditoría, tests | Usuario + qa-security-reviewer |
| **Gate 4** | Fase 4: PWA MVP | Login, registro rápido, bandeja validación, historial, dashboard, iOS/Android real | Usuario + qa-security-reviewer |
| **Gate 5** | Fase 5: IA/Integraciones | OCR/IA tras interfaces, ingestión versionada, export Sheets/Excel, WhatsApp opcional controlado | Usuario + qa-security-reviewer |
| **Gate 6** | Fase 6: Endurecimiento | E2E completo, seguridad, backup/restore probado, CI verde, runbooks, deploy autorizado | Usuario |

## Criterios de calidad MVP (No negociables)

El sistema **NO está listo** si falla **cualquiera** de estos:

- [ ] Un usuario accede a datos de otro grupo sin autorización
- [ ] Se puede crear dos veces el mismo movimiento por reintento (falta idempotencia)
- [ ] Los repartos (splits) no cuadran **exactamente** con el total
- [ ] Se usa `float` / `double` / `real` para dinero (solo `Decimal` / `NUMERIC`)
- [ ] Se puede modificar o borrar un movimiento financiero sin auditoría
- [ ] OCR/IA puede aprobar por sí solo datos ambiguos (sin humano en el loop)
- [ ] Un archivo no validado puede ejecutarse o exponerse públicamente
- [ ] Los totales migrados no concuerdan con la fuente (conciliación mes a mes)
- [ ] La PWA no permite completar el flujo principal en **iOS Safari** y **Android Chrome**
- [ ] Una falla de red puede duplicar una operación (falta retry seguro + idempotency)
- [ ] Hay secretos o datos personales en el repositorio o logs
- [ ] Las pruebas críticas no son reproducibles (determinísticas, aisladas, rápidas)

## Stack aprobado (Fase 0 - Baseline)

| Capa | Tecnología | Decisión |
|------|------------|----------|
| Frontend | React 18 + TypeScript + Vite | PWA, mobile-first |
| Backend | FastAPI + Python 3.11+ | Monolito modular |
| Database | PostgreSQL 16 | Única fuente verdad |
| ORM | **SQLAlchemy 2.x** + **Pydantic v2** | ADR-0001: SQLAlchemy 2.x como ORM, Pydantic v2 para contratos/validación. No SQLModel. |
| Migraciones | Alembic | Versionadas, expand-contract |
| Auth | Cookie segura (Secure, HttpOnly, SameSite=Lax) + CSRF + Sesiones PG revocables | ADR-0002: Sesión por cookie, no localStorage. Rotación en login. Tokens integraciones: post-MVP. |
| Data Fetching | TanStack Query (React Query) | Server state |
| Estado UI | Zustand o React Context | Client state |
| Estilos | Tailwind CSS | Utility-first |
| UI Components | Radix UI / shadcn patterns / propios | Accesibles, headless |
| Testing Backend | pytest + pytest-asyncio | Unit + Integración |
| Testing Frontend | Vitest + React Testing Library + Playwright | Unit + E2E cross-browser |
| CI/CD | GitHub Actions | Lint, test, build, security, deploy |
| Contenedores | Docker + Docker Compose | Multi-stage, non-root |
| Archivos | Interfaz `StorageBackend` (LocalFS dev, S3-compatible prod) | ADR-0003: DB guarda metadatos/referencias, no binarios. Validar MIME, ext, tamaño, hash. Nada público. |
| Secrets | pydantic-settings + env vars | Nunca en código/Git |
| Export | Google Sheets API (append-only) + Excel (openpyxl) | Unidireccional |
| WhatsApp | Meta Business API (webhook) | Feature flag, opcional, minimizar coste |
| OCR/IA | Configurable (local/cloud) | Tras interfaces, JSON canónico v1 |
| IDs internos | **UUIDv7** (tipo nativo PG `uuid`) | ADR-0004: UUIDv7 como PK interno. IDs externos (Excel, WhatsApp, etc.) separados, no PK. |

## Archivos de coordinación (mantenidos por finance-orchestrator)

- `docs/PROJECT_STATUS.md` — Estado por fase, tareas, bloqueos, evidencia
- `docs/DECISIONS.md` — Índice de ADR (`docs/decisions/NNNN-titulo.md`)
- `docs/AGENT_TEAM.md` — Esta matriz de responsabilidades y escalamiento
- `docs/WORKFLOW.md` — Fases, gates, contratos de delegación
- Backlog priorizado (en `docs/PROJECT_STATUS.md` o tool externo)

## Ubicación de agentes

`.opencode/agents/` — Un archivo `.md` por agente con frontmatter YAML (name, description, model, color, tools).

## Skills disponibles

- `.opencode/skills/grupo-security/` — Contexto proyecto Grupo Security Office (referencia, no aplicable a FINANZAS 1:1 salvo lecciones aprendidas).

---

> **Nota**: Este `AGENTS.md` es específico del proyecto **FINANZAS 1:1**. Las reglas del proyecto **Grupo Security Office** (en `CLAUDE.md`) no aplican aquí salvo donde se referencie explícitamente.