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

## Desarrollo y Coordinación

**Coordinador**: Usuario + Claude Code define alcance, dependencias y secuencia de tareas.

**Flujo de trabajo**: Issues en `docs/agent-coordination/issues/` → Worktree → Validación → PR → Merge con aprobación.

Detalles técnicos: Ver [AGENTS.md](AGENTS.md).

## Roles del Sistema (RBAC)

| Rol | Permisos Clave |
|---|---|
| **Super Admin** | Productos, categorías, marcas, precios, usuarios, roles, auditoría, publicación |
| **Supervisor** | Lectura de productos, gestión de publicación, auditoría |
| **Admin Comercial** | CRUD productos, categorías, marcas, precios, publicación |
| **Operador** | Lectura de productos, categorías, marcas, precios |
| **Consulta** | Solo lectura (productos, categorías, marcas, precios) |

## Estructura del Repositorio

```
grupo-security-office/
├── src/
│   ├── frontend/                    # React + TypeScript + Tailwind
│   ├── backend/                     # NestJS + Prisma + PostgreSQL
│   └── graphify-out/                # Knowledge graph (2564 nodos, 6202 edges)
├── docs/
│   ├── agent-coordination/          # Gobernanza: issues/, decisions, work-log
│   ├── adr/                         # Architecture Decision Records
│   └── PROJECT_STATUS.md            # Estado, próximos pasos, Etapa 8.1
├── .opencode/agents/                # 11 perfiles OpenCode (ejecutores)
├── .kilo/
│   ├── agents/                      # 2 perfiles Kilo
│   ├── rules/                       # Reglas globales
│   └── context/                     # Contexto de Kilo
├── AGENTS.md                        # Autoridad, roster, stack, reglas
├── CLAUDE.md                        # Idioma, estilo, graphify, decisiones vigentes
├── opencode.json                    # Config OpenCode
└── README.md                        # Este archivo
```

## Conocimiento Indexado: graphify

**Graph**: `graphify-out/graph.json` (2564 nodos, 6202 edges, 168 comunidades)

**Cómo consultar** (⚠️ **EN INGLÉS o identificadores técnicos**):
```bash
graphify query "Who is the strategic coordinator"
graphify query "What are the 5 RBAC roles"
graphify path "Backend" "PostgreSQL"
graphify explain "lifecycleStatus"
graphify update .  # Después de cambios (AST-only, sin costo)
```

**Outputs**:
- `graph.json` — Grafo (3.5MB)
- `graph.html` — Visualización interactiva
- `wiki/index.md` + 178 artículos — Navegación

## Documentación Clave

| Documento | Propósito |
|---|---|
| **[AGENTS.md](AGENTS.md)** | Autoridad, roster, stack, reglas obligatorias |
| **[CLAUDE.md](CLAUDE.md)** | Idioma, estilo, graphify, decisiones vigentes |
| **[docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md)** | Estado, riesgos, Etapa 8.1 |
| **[docs/agent-coordination/issues/](docs/agent-coordination/issues/)** | Tablero de tareas centralizado |
| **[docs/agent-coordination/decisiones-historicas.md](docs/agent-coordination/decisiones-historicas.md)** | Historial de decisiones |

## Cómo Empezar

```bash
# Instalar y migrar
npm install --workspace=src/frontend
npm install --workspace=src/backend
cd src/backend && npm run db:migrate && npm run db:seed

# Iniciar dev
npm run dev --workspace=src/backend   # puerto 3000
npm run dev --workspace=src/frontend  # puerto 5173

# Verificar estado
opencode agent list
graphify query "strategic coordinator"
npm test --workspace=src/backend
```

## Próximos Pasos

- **Etapa 8.1** (no destructiva): migración a `lifecycleStatus`, dual-write mantenido, docs actualizadas
- **Etapa 8.2** (futura): DROP COLUMN legacy, desactivar dual-write
- **Context7 + SkillsMP**: evaluar para mejorar skills de agentes

## Seguridad

- HTTPS obligatorio en producción
- RBAC con 5 roles, decoradores `@Roles()` + `@Permissions()` + ACL guard
- JWT + bcrypt para autenticación
- AuditLog para todas las mutaciones
- Validación class-validator + zod
- **Sin secretos en Git** — usar variables de entorno
- **Sin comandos destructivos** sin aprobación humana explícita

---

**Repositorio:** Soproyectos/grupo-security-office | **Rama:** main | **Coordinador:** Usuario + Claude Code
