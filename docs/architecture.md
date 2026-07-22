# Arquitectura Comercial v1 - Grupo Security

## Visión General

Sistema interno modular para gestión de catálogo, precios, usuarios y publicación, preparado para integrarse con el ERP Yéminus en fases futuras.

## Capas

### 1. Frontend - Panel Admin
- **Tecnología:** React 18+ / TypeScript / Tailwind CSS
- **Componentes:** Shadcn/ui o Headless UI
- **Estado:** TanStack Query (React Query)
- **Router:** React Router v6+
- **Formularios:** React Hook Form + Zod

### 2. Backend API
- **Runtime:** Node.js / TypeScript
- **Framework:** Por definir (Express/Fastify/NestJS)
- **Validación:** Zod
- **Auth:** JWT + RBAC
- **Logging:** Winston o Pino

### 3. Base de Datos
- **Motor:** PostgreSQL
- **Migraciones:** Prisma Migrate o Drizzle Kit
- **Schema:** Un schema por módulo

### 4. Autenticación/Autorización
- **Autenticación:** JWT con refresh token
- **Autorización:** RBAC por permisos en endpoint
- **MFA:** TOTP (Google Authenticator) - recomendado para Admin

### 5. Integración ERP (Yéminus)
- **Estado:** Endpoint 501 (Not Implemented)
- **Cuando se confirme API:** Conector REST con OAuth2/API keys
- **Entidades a sincronizar:** Productos, inventario, precios, pedidos

## Diagrama de Componentes

```
                    ┌──────────────┐
                    │   Browser    │
                    │  (Admin)     │
                    └──────┬───────┘
                           │ HTTPS
                    ┌──────▼───────┐
                    │   Nginx/     │
                    │   Reverse    │
                    │   Proxy      │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
     ┌────────▼───┐ ┌──────▼──────┐ ┌──▼──────────┐
     │  Frontend  │ │  Backend   │ │   Static    │
     │  (React)   │ │  API       │ │   Assets    │
     │  :3000     │ │  :4000     │ │             │
     └────────────┘ └──────┬─────┘ └─────────────┘
                           │
                    ┌──────▼───────┐
                    │  PostgreSQL  │
                    │  :5432       │
                    └──────────────┘
```

## Módulos Backend

| Módulo | Endpoints | Descripción |
|--------|-----------|-------------|
| Products | CRUD + publish | Gestión de productos |
| Categories | CRUD + tree | Categorías jerárquicas |
| Brands | CRUD | Marcas |
| Price Lists | CRUD | Listas de precios |
| Prices | CRUD | Precios por producto/lista |
| Users | CRUD | Usuarios internos |
| Roles | CRUD | Roles y permisos |
| Audit | Read-only | Log de cambios |
| Auth | Login/Refresh | Autenticación |

## Convenciones

### Nombres de Archivos
- Backend: `kebab-case` → `product.controller.ts`
- Frontend: `kebab-case` → `product-list.tsx`

### Endpoints API
- Prefijo: `/api/v1/`
- plural: `/products`, `/categories`
- Paginación: `?page=1&limit=20`
- Filtros: `?category_id=1&brand_id=2&status=active`

### Respuestas
```json
{
  "success": true,
  "data": { ... },
  "meta": { "page": 1, "limit": 20, "total": 150 }
}
```

### Errores
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Nombre es requerido",
    "details": [...]
  }
}
```
