# AGENTS.md — Reglas del Proyecto Grupo Security Office

> Configuración de agentes y reglas operativas para la Plataforma Comercial Grupo Security
> (panel administrativo interno + catálogo comercial integrado con ERP Yéminus).

## Idioma

- **Documentación, reportes, commits, PRs, issues**: Español.
- **Código, nombres técnicos, APIs, variables, tablas, enums**: Inglés consistente (snake_case BD, camelCase TS/JS, PascalCase tipos, UPPER_SNAKE_CONSTANTS).

## Autoridad de coordinación

- **Perplexity**: único coordinador estratégico. Define alcance, dependencias, propiedad de archivos, criterios de aceptación y secuencia de tareas.
- **Kilo Code**: ejecutor técnico bajo las reglas de `.kilo/`.
- **OpenCode**: ejecutor técnico bajo los perfiles de `.opencode/` y los archivos de coordinación compartidos.
- **`tech-lead-orchestrator`**: agente de coordinación de OpenCode únicamente. No reemplaza a Perplexity como autoridad estratégica.

## Equipo de agentes (OpenCode)

| Agente | Rol | Modo | Permisos clave |
|--------|-----|------|----------------|
| `tech-lead-orchestrator` | Coordinación técnica OpenCode | Ejecución | Secuencia tareas, análisis de dependencias, validación de handoff; **no autoridad estratégica sobre Perplexity**; **no implementa código producto** |
| `solution-architect` | Arquitectura y contratos | **Solo análisis/diseño** | Revisión de arquitectura, contratos cross-layer, diseño técnico; **sin autoridad independiente de implementación** |
| `data-migration-engineer` | Datos / import / migración | Implementación | Análisis import/export y planificación de migración para PostgreSQL/Prisma; **sin Alembic ni SQLAlchemy**; **no toca prod** |
| `backend-engineer` | Backend NestJS | Implementación | `src/backend/**`, tests backend, lint/typecheck/prisma validate, **no secretos**, **no deploy prod** |
| `frontend-pwa-engineer` | Frontend React PWA | Implementación | `src/frontend/**`, tests frontend, a11y/PWA, **no modifica contratos backend sin aprobación** |
| `ai-integration-engineer` | IA/integración opcional | Implementación | Integración IA opcional, **no reglas financieras**, **no ownership de esquema de datos primario** |
| `qa-security-reviewer` | QA / Seguridad | **Independiente** | Lee todo, escribe tests/reportes, **no aprueba su propio trabajo**, **no despliega** |
| `devops-release-engineer` | DevOps / Release | Implementación | Infra local/reversible, Docker, CI; **no deploy prod ni cambios de credenciales sin aprobación humana** |

## Excel / importación

- `excel-mapping-architect`: define el mapeo canónico Excel/CSV, reglas de validación, reporte de filas rechazadas y contrato de mapeo. **No implementa**.
- `python-excel-toolsmith`: implementa únicamente la utilidad Python definida por el contrato de mapeo aprobado. **No decide política de mapeo**.
- `GS Excel Import Implementer` (Kilo): integra el resultado aprobado en la aplicación comercial NestJS/Prisma.
- `data-migration-engineer`: planificación de migración/import y revisión de riesgo de datos PostgreSQL/Prisma.

Ningún agente puede ser dueño simultáneo de la política de mapeo y de la integración a la aplicación sin una tarea separada de Perplexity.

## Reglas globales obligatorias

### Flujo de trabajo
- **Una tarea o incremento a la vez**. No avanzar sin la designación y aprobación correspondiente.
- **Antes de editar**: inspeccionar archivo(s), resumir impacto, definir criterios de aceptación.
- **Evitar cambios masivos** no solicitados.
- **No cambiar stack** sin decisión documentada y aprobación explícita.
- **No guardar secretos** (tokens, passwords, API keys, teléfonos, comprobantes reales, PII) en Git. Usar variables de entorno.
- **Datos ficticios** en fixtures, tests, seeding, desarrollo.
- **No comandos destructivos** en ambientes no desechables: `rm -rf`, `git push --force`, `git reset --hard`, `DROP TABLE`, `DROP DATABASE`, `docker volume rm`, reescritura historia.
- **No commits ni push** sin autorización explícita del usuario.
- **Cada tarea** debe incluir pruebas y documentación proporcional al cambio.
- **Funcionalidad comercial** debe probar: integridad, autorización (RBAC, ownership), y consistencia (invariantes de Lista/Producto/Precio).
- **Ningún agente declara "terminado" solo porque compila**. Requiere: validación, revisión independiente, evidencia documentada.
- **Decisiones importantes faltantes**: presentar máx. 3 opciones con recomendación y **detenerse** hasta aprobación.
- **Reportes breves**: hecho, evidencia, riesgos, siguiente paso.

### Protección de archivos
- El coordinador (Perplexity) asigna **propiedad temporal** de archivos/módulos a un solo agente a la vez.
- No dos agentes editando el mismo archivo simultáneamente.
- El registro de propiedad vive en `docs/agent-coordination/file-ownership.md`.

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

## Stack aprobado

| Capa | Tecnología | Nota |
|------|------------|------|
| Frontend | React + TypeScript + Vite + Tailwind CSS | Panel admin + catálogo, mobile-first |
| Backend | NestJS + TypeScript | Módulos productos, listas, precios, usuarios, roles, auditoría |
| Database | PostgreSQL 16 | Única fuente de verdad |
| ORM | **Prisma 5.x** | Migraciones versionadas |
| Auth | JWT + bcrypt + RBAC | Roles: Admin, Gerente, Operator, Viewer |
| Data Fetching | TanStack Query (React Query) | Server state |
| Estado UI | Zustand | Client state |
| API docs | Swagger (OpenAPI) | — |
| Testing | Jest/Vitest + Playwright | Backend + frontend |
| CI/CD | GitHub Actions | Lint, test, build, security |
| Contenedores | Docker + Docker Compose | Local/dev |
| Python | **Solo auxiliar** (Excel parsing, mapping, validación, import) | No es backend primario |
| ERP | Yéminus | **Pendiente confirmación API; no asumir CRUD** |

Python (pandas/openpyxl) se utiliza únicamente como herramienta auxiliar de análisis/mapping/importación de Excel. El backend primario es NestJS + Prisma.

## Archivos de coordinación

- `docs/agent-coordination/README.md` — Protocolo de coordinación Kilo/OpenCode.
- `docs/agent-coordination/agent-status.md` — Estado actual de cada ejecutor.
- `docs/agent-coordination/file-ownership.md` — Reservas activas y liberadas.
- `docs/agent-coordination/work-log.md` — Evidencia append-only de tareas completadas.
- `docs/AGENT_TEAM.md` — Matriz de responsabilidades y escalamiento.
- `docs/WORKFLOW.md` — Fases, puertas y contratos de delegación.
- `docs/PROJECT_STATUS.md` — Estado por fase, tareas, bloqueos, evidencia.

> **Nota**: El proyecto **FINANZAS 1:1**, **FastAPI**, **SQLAlchemy**, **Alembic** y el agente **`finance-orchestrator`** no forman parte de este repositorio. El perfil `finance-orchestrator.md` se conserva únicamente como registro histórico inactivo.