# Grupo Security Office — Plataforma Comercial Interna

Panel administrativo + catálogo comercial integrado con ERP Yéminus para Grupo Security (CCTV, alarmas, control de acceso, smart home).

## Estado Actual

| Aspecto | Estado |
|---|---|
| **Fase** | FSM de ciclo de vida de Product validada (616 tests, 14 migraciones, 230 productos) |
| **Próximo** | **Etapa 8.1** — Migración no destructiva a `lifecycleStatus` (dual-write mantenido) |
| **Coordinador estratégico** | Usuario + Claude Code |
| **Ejecutores técnicos** | OpenCode (11 agentes) + Kilo Code (2 agentes) |
| **Última actualización** | 2026-09-09 — Reestructuración de documentación y coordinación |

## Stack Tecnológico

| Capa | Tecnología | Nota |
|---|---|---|
| Frontend | React 18 + TypeScript + Tailwind CSS + Vite | Panel admin + catálogo, mobile-first |
| Backend | NestJS 11 + TypeScript | Módulos: productos, listas, precios, usuarios, roles, auditoría, suppliers |
| Database | PostgreSQL 16 + Prisma 5.x | Migraciones versionadas, Neon adapter |
| Auth | JWT + bcrypt + RBAC | 5 roles: Super Admin, Supervisor, Admin Comercial, Operador, Consulta |
| State Management | TanStack Query + Zustand | Server state + client state |
| Testing | Jest + Vitest + Playwright | 616 tests, E2E coverage |
| CI/CD | GitHub Actions | Lint, test, build, security checks |
| ERP | Yéminus | **Integración pendiente de confirmación API** |
| Python (auxiliar) | pandas + openpyxl | Solo para Excel parsing/mapping/validation, no es backend primario |

## Gobernanza y Coordinación

### Autoridad Estratégica
- **Usuario + Claude Code**: define alcance, dependencias, propiedad de archivos, criterios de aceptación, secuencia de tareas
- Decisiones documentadas en `docs/agent-coordination/` y en historial de cambios

### Ejecutores Técnicos

**OpenCode** (11 agentes, implementación exclusiva):
- `tech-lead-orchestrator` — Coordinación técnica OpenCode
- `solution-architect` — Diseño y contratos
- `backend-engineer`, `frontend-pwa-engineer`, `ai-integration-engineer` — Implementación
- `data-migration-engineer`, `devops-release-engineer`, `qa-security-reviewer` — Datos, DevOps, QA
- `excel-mapping-architect`, `python-excel-toolsmith` — Pipeline de Excel
- `finance-orchestrator` — Histórico inactivo

**Kilo Code** (2 agentes, router + especialista):
- `comercial-dev` — Gatekeeper: valida alcance y remite a OpenCode o coordinador
- `excel-import-implementer` — Integra resultados aprobados del pipeline Excel a la app NestJS/Prisma

### Flujo de Trabajo
1. Coordinador crea issue en `docs/agent-coordination/issues/<TASK_ID>.md` con alcance explícito
2. Orca descubre issues `pending`, abre worktree, invoca agente correspondiente
3. Agente ejecuta, prueba, cierra issue con `result_summary`
4. Validación pasa → PR automático → Merge requiere aprobación humana explícita del coordinador

**Referencia**: `AGENTS.md` (autoridad, roster, contratos), `docs/agent-coordination/worktree-issue-pr-procedure.md` (detalles técnicos)

## Roles del Sistema (RBAC)

| Rol | Permisos Clave |
|---|---|
| **Super Admin** | Productos, categorías, marcas, precios, usuarios, roles, auditoría, publicación |
| **Supervisor** | Lectura de productos, gestión de publicación, auditoría |
| **Admin Comercial** | CRUD productos, categorías, marcas, precios, publicación |
| **Operador** | Lectura de productos, categorías, marcas, precios |
| **Consulta** | Solo lectura (productos, categorías, marcas, precios) |

Decoradores: `@Roles()` (backend), `hasPermission()` (frontend), ACL guard en endpoints sensibles.

## Estructura del Repositorio

```
grupo-security-office/
├── src/
│   ├── frontend/                    # React + TypeScript + Tailwind
│   │   ├── src/
│   │   │   ├── pages/              # ProductsPage, DashboardPage, etc.
│   │   │   ├── features/           # Módulos de features (products, listas, etc.)
│   │   │   ├── components/ui/      # Design system (CSS variables, componentes)
│   │   │   ├── lib/                # Utilidades (RBAC, API errors, lifecycle)
│   │   │   └── services/           # API clients (trending, product-detail, etc.)
│   │   └── vite.config.ts
│   ├── backend/                     # NestJS + Prisma + PostgreSQL
│   │   ├── src/
│   │   │   ├── modules/            # Productos, listas, precios, usuarios, suppliers, audit, auth
│   │   │   ├── common/             # Guards (JWT, RBAC), decoradores (@Roles, @CurrentUser, @Permissions)
│   │   │   ├── prisma/             # Schema, migrations, seed
│   │   │   └── main.ts
│   │   ├── prisma/
│   │   │   ├── schema.prisma       # Modelo de datos (7 estados lifecycle)
│   │   │   └── migrations/         # 14 migraciones sin drift
│   │   └── package.json
│   └── graphify-out/               # Knowledge graph (2564 nodos, 6202 edges)
├── docs/
│   ├── agent-coordination/         # Gobernanza operativa
│   │   ├── README.md               # Protocolo Kilo/OpenCode
│   │   ├── issues/                 # Tablero centralizado de tareas (NEW)
│   │   ├── agent-status.md         # Estado de ejecutores
│   │   ├── file-ownership.md       # Reservas activas/liberadas
│   │   ├── work-log.md             # Append-only: tareas completadas
│   │   ├── worktree-issue-pr-procedure.md  # Detalles técnicos
│   │   └── decisiones-historicas.md # Historial de decisiones (NEW)
│   ├── adr/                        # Architecture Decision Records
│   ├── PROJECT_STATUS.md           # Estado de fase, riesgos, próximos pasos
│   ├── AGENT_TEAM.md               # Matriz de responsabilidades
│   ├── WORKFLOW.md                 # Fases, puertas, contratos
│   └── README.md                   # Entrada de documentación
├── .opencode/
│   ├── agents/                     # 11 perfiles (OpenCode ejecutores)
│   │   └── *.md                    # Cada agente con alcance, permisos, restricciones
│   └── opencode.json               # Configuración (instrucciones + issues/README.md)
├── .kilo/
│   ├── agents/                     # 2 perfiles (Kilo ejecutores)
│   │   ├── comercial-dev.md        # Router/gatekeeper
│   │   └── excel-import-implementer.md  # Integrador Excel
│   ├── rules/                      # Reglas globales de Kilo (autorización)
│   ├── context/                    # Contexto de Kilo
│   └── kilo.jsonc                  # Configuración
├── AGENTS.md                       # Autoridad de coordinación, roster, stack, reglas obligatorias
├── CLAUDE.md                       # Idioma, estilo, graphify, decisiones vigentes
├── opencode.json                   # Instrucciones para agentes OpenCode
└── README.md                       # Este archivo
```

## Conocimiento Indexado: graphify

**Graph**: `graphify-out/graph.json` (2564 nodos, 6202 edges, 168 comunidades)

**Cómo consultar**:
```bash
# Consultas en INGLÉS o identificadores técnicos exactos (required)
graphify query "Who is the strategic coordinator"
graphify query "How does the Product lifecycle FSM work"
graphify query "What are the 5 RBAC roles"

# Rastrear relaciones
graphify path "Backend" "PostgreSQL"
graphify path "Coordinator_User_ClaudeCode" "OpenCode"

# Explicar conceptos
graphify explain "lifecycleStatus"
graphify explain "RBAC"

# Actualizar tras cambios (AST-only, sin costo LLM)
graphify update .
```

**Outputs**:
- `graph.json` — Grafo en formato GraphRAG-ready (3.5MB)
- `graph.html` — Visualización interactiva sin servidor
- `wiki/index.md` + 178 artículos — Navegación por comunidades
- `GRAPH_REPORT.md` — Análisis de arquitectura y comunidades

**⚠️ Importante**: Las consultas deben formularse en **inglés** o con identificadores técnicos exactos (`lifecycleStatus`, `AclService`, `RBAC`). Los nodos de documentación se indexaron con labels en inglés. La respuesta al usuario sigue siendo en español.

## Cómo Empezar

### Desarrollo Local

```bash
# Instalar dependencias
npm install --workspace=src/frontend
npm install --workspace=src/backend

# Variables de entorno (copiar .env.example)
cp .env.example .env
# Editar con credenciales Neon, JWT_SECRET, etc.

# Migraciones y seed
cd src/backend
npm run db:migrate
npm run db:seed

# Iniciar dev
npm run dev --workspace=src/backend   # puerto 3000
npm run dev --workspace=src/frontend  # puerto 5173
```

### Verificar Estado

```bash
# Agentes cargando correctamente (OpenCode)
opencode agent list

# Conocimiento indexado
graphify query "Product lifecycle states"

# Tests pasando
npm test --workspace=src/backend
npm test --workspace=src/frontend

# Build sin errores
npm run build --workspace=src/backend
npm run build --workspace=src/frontend
```

## Documentación Clave

| Documento | Propósito |
|---|---|
| **[AGENTS.md](AGENTS.md)** | Autoridad, roster de agentes, stack aprobado, reglas obligatorias |
| **[CLAUDE.md](CLAUDE.md)** | Idioma (español docs, inglés código), graphify, decisiones vigentes |
| **[docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md)** | Estado de fase, riesgos, próximas acciones (Etapa 8.1) |
| **[docs/agent-coordination/README.md](docs/agent-coordination/README.md)** | Protocolo de coordinación Kilo/OpenCode |
| **[docs/agent-coordination/worktree-issue-pr-procedure.md](docs/agent-coordination/worktree-issue-pr-procedure.md)** | Detalles técnicos: branch naming, worktree, PR, merge rules |
| **[docs/agent-coordination/decisiones-historicas.md](docs/agent-coordination/decisiones-historicas.md)** | Historial completo de decisiones arquitectónicas y operativas |
| **[docs/agent-coordination/issues/README.md](docs/agent-coordination/issues/README.md)** | Tablero centralizado de tareas (status, assigned_tool, scope) |

## Seguridad

- **HTTPS** obligatorio en producción
- **RBAC** con 5 roles (Super Admin, Supervisor, Admin Comercial, Operador, Consulta)
- **JWT** + bcrypt para autenticación
- **Decoradores** `@Roles()` + `@Permissions()` + ACL guard en endpoints sensibles
- **AuditLog** para todas las mutaciones (create, update, delete, status_change)
- **Validación** class-validator (backend) + zod (auxiliar)
- **Contratos de delegación** obligatorios en cada tarea (scope, archivos permitidos/prohibidos, criterios de aceptación)
- **Sin secretos en Git** — usar variables de entorno (.env, GitHub Secrets)
- **No comandos destructivos** sin aprobación explícita (`DROP TABLE`, `git push --force`, etc.)

## Próximos Pasos

### Etapa 8.1 (No destructiva, próxima)
- Inventario y migración de lecturas/escrituras a `lifecycleStatus`
- En: import, trending, Listas, lazy repair, `allowedActions` en listado
- Dual-write mantenido (columnas legacy como read-model)
- Tests y docs actualizados
- Email canónico alineado

### Etapa 8.2 (Destructiva, futura)
- Búsqueda de referencias a legacy columns = cero
- `DROP COLUMN` legacy, desactivar dual-write
- QA regresión completa con rollback plan

### Evaluación Futura
- **Context7** — MCP para documentación actualizada de librerías (React 18, NestJS 11, Prisma 5)
- **SkillsMP** — Marketplace de skills por dominio (frontend, backend, QA, devops)

## Historial Reciente

| Fecha | Cambio |
|---|---|
| 2026-09-09 | Reestructuración completa: coordinador = usuario + Claude Code; OpenCode 11 agentes, Kilo 2 agentes; graphify regenerado (2564 nodos); tablero de issues creado |
| 2026-08-20 | Cierre FSM de ciclo de vida de Product: 616 tests, 14 migraciones, 230 productos validados |
| 2026-08-15 | Tanda 1C: suppliers, stock avanzado, PO flujo completo, panel compras, reportes |
| 2026-08-03 | Migración RBAC: 5 roles en español (Super Admin, Supervisor, Admin Comercial, Operador, Consulta) |
| 2026-07-31 | Dashboard.tsx mejorado: productos tendencia dinámicos, accesibilidad WCAG AA |

## Preguntas Frecuentes

**¿Quién es el coordinador?**
Usuario + Claude Code. Define alcance, dependencias, propiedad de archivos y aprueba merges. Ver `AGENTS.md` L13.

**¿Cuál es el próximo paso?**
Etapa 8.1 (migración no destructiva a `lifecycleStatus`). Detalles en `docs/PROJECT_STATUS.md`.

**¿Cómo consulto el grafo de conocimiento?**
`graphify query "<pregunta en inglés>"` o con identificadores técnicos. Ver sección "graphify" arriba.

**¿Cuál es el stack de database?**
PostgreSQL 16 + Prisma 5.x con adapter Neon. 14 migraciones versionadas sin drift.

**¿Puedo usar FastAPI / SQLAlchemy / Alembic?**
No. Stack aprobado es NestJS + Prisma. Ver `AGENTS.md` L94-112.

**¿Hay skills instaladas para acelerar el trabajo?**
Solo `graphify`. MCP de Context7 y SkillsMP son futuros. Todos los agentes usan perfiles en `.opencode/agents/` y `.kilo/agents/`.

---

**Repositorio:** Soproyectos/grupo-security-office | **Rama activa:** main | **Coordinador:** Usuario + Claude Code
