# Grupo Security Office

Panel administrativo + catálogo comercial integrado para Grupo Security (CCTV, alarmas, control de acceso, smart home).

## Descripción

Sistema interno modular que permite:
- **Panel administrativo**: Gestión de productos, precios, listas, usuarios, roles y auditoría
- **Catálogo comercial**: Visualización de productos, categorías y precios
- **Integración ERP**: Conexión con Yéminus (pendiente confirmación de API)
- **Importación Excel**: Carga y mapeo de datos desde hojas de cálculo

## Stack Tecnológico

| Capa | Tecnología |
|---|---|
| **Frontend** | React 18 + TypeScript + Tailwind CSS + Vite |
| **Backend** | NestJS 11 + TypeScript |
| **Database** | PostgreSQL 16 + Prisma 5.x |
| **Autenticación** | JWT + bcrypt + RBAC (5 roles) |
| **State Management** | TanStack Query + Zustand |
| **Testing** | Jest + Vitest + Playwright (616 tests) |
| **Deployment** | GitHub Actions + Docker |

## Roles del Sistema

| Rol | Acceso |
|---|---|
| Super Admin | Control total: productos, usuarios, roles, auditoría |
| Supervisor | Lectura de productos, gestión de publicación, auditoría |
| Admin Comercial | CRUD productos, categorías, marcas, precios, publicación |
| Operador | Lectura de productos, categorías, marcas, precios |
| Consulta | Solo lectura (catalogos públicos) |

## Estructura del Proyecto

```
src/
├── frontend/                        # React + TypeScript
│   └── src/
│       ├── pages/                   # ProductsPage, Dashboard, etc.
│       ├── features/                # Módulos (products, listas, etc.)
│       ├── components/ui/           # Componentes reutilizables
│       ├── lib/                     # RBAC, API, lifecycle
│       └── services/                # Clientes API
├── backend/                         # NestJS + Prisma
│   └── src/
│       ├── modules/                 # Productos, listas, precios, usuarios, suppliers
│       ├── common/                  # Guards, decoradores, middleware
│       └── prisma/                  # Schema, migrations
└── docs/                            # Documentación técnica
    ├── adr/                         # Decisiones de arquitectura
    └── agent-coordination/          # Procedimientos internos
```

## Desarrollo Local

### Requisitos
- Node.js 18+
- PostgreSQL 16
- npm/yarn

### Instalación

```bash
# Instalar dependencias
npm install --workspace=src/frontend
npm install --workspace=src/backend

# Configurar variables de entorno
cp src/backend/.env.example src/backend/.env
# Editar .env con credenciales Neon/PostgreSQL

# Migraciones y seed
cd src/backend
npm run db:migrate
npm run db:seed

# Iniciar desarrollo
npm run dev --workspace=src/backend   # http://localhost:3000
npm run dev --workspace=src/frontend  # http://localhost:5173
```

### Validación

```bash
# Tests
npm test --workspace=src/backend
npm test --workspace=src/frontend

# Build
npm run build --workspace=src/backend
npm run build --workspace=src/frontend

# Lint
npm run lint
```

## Características

- ✅ **FSM de ciclo de vida**: Estados DRAFT, READY, SCHEDULED, PUBLISHED, HIDDEN, DISCONTINUED, ARCHIVED
- ✅ **Auditoría completa**: Todos los cambios registrados (create, update, delete, status_change)
- ✅ **RBAC flexible**: 5 roles con permisos granulares por endpoint
- ✅ **Importación Excel**: Mapeo de columnas, validación, reporte de errores
- ✅ **Gestión de suppliers**: Stock avanzado, órdenes de compra, evaluaciones
- ✅ **API REST**: Documentada con Swagger/OpenAPI
- ✅ **Mobile-first**: Panel responsivo, PWA ready

## Próximos Pasos

- Migración a modelo unificado `lifecycleStatus` (sin cambios destructivos)
- Validación completa de importación Excel
- Integración con ERP Yéminus
- Reportes avanzados de tendencias

## Seguridad

- HTTPS obligatorio en producción
- Validación en backend: class-validator + decoradores
- JWT con expiración y refresh tokens
- bcrypt para contraseñas
- No se guardan secretos en Git (usar `.env`)
- Auditoría de acciones críticas
- SQL injection/XSS prevention

## Documentación

- **API**: Ver Swagger en `http://localhost:3000/api/docs`
- **Modelos**: Prisma schema en `src/backend/prisma/schema.prisma`
- **Decisiones técnicas**: `docs/adr/`

## Licencia

Uso interno — Grupo Security

---

**Estado actual**: FSM de Product validada (616 tests, 14 migraciones, 230 productos)  
**Última actualización**: 2026-09-09
