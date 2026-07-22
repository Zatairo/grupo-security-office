# Arquitectura Técnica - Grupo Security
## Fase 1: Sistema Interno Modular

**Versión:** 1.0  
**Fecha:** 2026-07-22  
**Estado:** Aprobado

---

## 1. Resumen Ejecutivo

Sistema web interno para la gestión comercial de Grupo Security, incluyendo:
- Panel administrativo para gestión de productos, precios y usuarios
- API REST con autenticación JWT y control de acceso basado en roles (RBAC)
- Base de datos relacional con PostgreSQL
- Integración futura con ERP Yéminus

---

## 2. Stack Tecnológico

| Capa | Tecnología | Versión | Justificación |
|------|-----------|---------|---------------|
| Frontend Admin | React + TypeScript + Tailwind CSS + Vite | React 18 | Rápido, tipado, CSS utility-first |
| Backend API | NestJS + TypeScript | NestJS 10 | Modular, escalable, enterprise-ready |
| Base de datos | PostgreSQL | 16 | Robusto, open-source, JSON support |
| ORM | Prisma | 5.x | Type-safe, migraciones, relations |
| Auth | Passport.js + JWT + bcrypt | - | Estándar industry |
| Validación | Zod + class-validator | - | Type-safe validation |
| API Docs | Swagger (auto desde NestJS) | - | Generado automáticamente |
| State Management | Zustand | 4.x | Ligero, simple, TypeScript-first |
| Data Fetching | React Query (TanStack Query) | 5.x | Caching, revalidation, loading states |

---

## 3. Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                             │
│  React + TypeScript + Tailwind CSS + Vite                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   Pages     │  │ Components  │  │   Stores    │         │
│  │   (Views)   │  │   (UI)      │  │  (Zustand)  │         │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘         │
│         └────────────────┼────────────────┘                 │
│                          │                                  │
│                    ┌─────▼─────┐                            │
│                    │ Services  │                            │
│                    │ (Axios)   │                            │
│                    └─────┬─────┘                            │
└──────────────────────────┼──────────────────────────────────┘
                           │ HTTP/REST
┌──────────────────────────┼──────────────────────────────────┐
│                          │                                  │
│                    ┌─────▼─────┐                            │
│                    │  NestJS   │                            │
│                    │   API     │                            │
│                    └─────┬─────┘                            │
│                          │                                  │
│  ┌───────────────────────┼───────────────────────┐          │
│  │                       │                       │          │
│  ▼                       ▼                       ▼          │
│ ┌─────────┐        ┌──────────┐        ┌──────────┐        │
│ │  Auth   │        │ Products │        │  Users   │        │
│ │ Module  │        │  Module  │        │  Module  │        │
│ └────┬────┘        └────┬─────┘        └────┬─────┘        │
│      │                  │                   │              │
│      └──────────────────┼───────────────────┘              │
│                         │                                  │
│                   ┌─────▼─────┐                            │
│                   │  Prisma   │                            │
│                   │  Client   │                            │
│                   └─────┬─────┘                            │
└─────────────────────────┼──────────────────────────────────┘
                          │
                    ┌─────▼─────┐
                    │ PostgreSQL│
                    │    DB     │
                    └───────────┘
```

---

## 4. Estructura del Proyecto

```
grupo-security-office/
├── src/
│   ├── backend/                         # NestJS API
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── auth/               # Autenticación y autorización
│   │   │   │   │   ├── auth.module.ts
│   │   │   │   │   ├── auth.controller.ts
│   │   │   │   │   ├── auth.service.ts
│   │   │   │   │   ├── strategies/
│   │   │   │   │   │   └── jwt.strategy.ts
│   │   │   │   │   ├── guards/
│   │   │   │   │   │   ├── jwt-auth.guard.ts
│   │   │   │   │   │   └── roles.guard.ts
│   │   │   │   │   └── dto/
│   │   │   │   │       ├── login.dto.ts
│   │   │   │   │       └── register.dto.ts
│   │   │   │   │
│   │   │   │   ├── users/              # Gestión de usuarios
│   │   │   │   │   ├── users.module.ts
│   │   │   │   │   ├── users.controller.ts
│   │   │   │   │   ├── users.service.ts
│   │   │   │   │   └── dto/
│   │   │   │   │
│   │   │   │   ├── roles/              # Gestión de roles
│   │   │   │   │   ├── roles.module.ts
│   │   │   │   │   ├── roles.controller.ts
│   │   │   │   │   ├── roles.service.ts
│   │   │   │   │   └── dto/
│   │   │   │   │
│   │   │   │   ├── products/           # Gestión de productos
│   │   │   │   │   ├── products.module.ts
│   │   │   │   │   ├── products.controller.ts
│   │   │   │   │   ├── products.service.ts
│   │   │   │   │   └── dto/
│   │   │   │   │
│   │   │   │   ├── categories/         # Gestión de categorías
│   │   │   │   │   ├── categories.module.ts
│   │   │   │   │   ├── categories.controller.ts
│   │   │   │   │   ├── categories.service.ts
│   │   │   │   │   └── dto/
│   │   │   │   │
│   │   │   │   ├── brands/             # Gestión de marcas
│   │   │   │   │   ├── brands.module.ts
│   │   │   │   │   ├── brands.controller.ts
│   │   │   │   │   ├── brands.service.ts
│   │   │   │   │   └── dto/
│   │   │   │   │
│   │   │   │   ├── prices/             # Gestión de precios
│   │   │   │   │   ├── prices.module.ts
│   │   │   │   │   ├── prices.controller.ts
│   │   │   │   │   ├── prices.service.ts
│   │   │   │   │   └── dto/
│   │   │   │   │
│   │   │   │   ├── audit/              # Logs de auditoría
│   │   │   │   │   ├── audit.module.ts
│   │   │   │   │   ├── audit.controller.ts
│   │   │   │   │   └── audit.service.ts
│   │   │   │   │
│   │   │   │   └── publish/            # Toggle publicación
│   │   │   │       ├── publish.module.ts
│   │   │   │       ├── publish.controller.ts
│   │   │   │       └── publish.service.ts
│   │   │   │
│   │   │   ├── common/                 # Compartido
│   │   │   │   ├── decorators/
│   │   │   │   │   ├── roles.decorator.ts
│   │   │   │   │   └── current-user.decorator.ts
│   │   │   │   ├── filters/
│   │   │   │   │   └── http-exception.filter.ts
│   │   │   │   ├── interceptors/
│   │   │   │   │   └── transform.interceptor.ts
│   │   │   │   └── pipes/
│   │   │   │       └── validation.pipe.ts
│   │   │   │
│   │   │   ├── config/
│   │   │   │   ├── configuration.ts
│   │   │   │   └── validation.schema.ts
│   │   │   │
│   │   │   ├── app.module.ts
│   │   │   └── main.ts
│   │   │
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   ├── seed.ts
│   │   │   └── migrations/
│   │   │
│   │   ├── test/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── tsconfig.build.json
│   │   ├── nest-cli.json
│   │   └── Dockerfile
│   │
│   ├── frontend/                        # React Admin Panel
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── ui/                 # Componentes genéricos
│   │   │   │   │   ├── Button.tsx
│   │   │   │   │   ├── Input.tsx
│   │   │   │   │   ├── Select.tsx
│   │   │   │   │   ├── Modal.tsx
│   │   │   │   │   ├── Table.tsx
│   │   │   │   │   └── Card.tsx
│   │   │   │   │
│   │   │   │   ├── layout/             # Layout del admin
│   │   │   │   │   ├── Sidebar.tsx
│   │   │   │   │   ├── Header.tsx
│   │   │   │   │   ├── AdminLayout.tsx
│   │   │   │   │   └── Breadcrumb.tsx
│   │   │   │   │
│   │   │   │   └── features/           # Componentes por módulo
│   │   │   │       ├── products/
│   │   │   │       │   ├── ProductList.tsx
│   │   │   │       │   ├── ProductForm.tsx
│   │   │   │       │   └── ProductCard.tsx
│   │   │   │       ├── categories/
│   │   │   │       │   ├── CategoryTree.tsx
│   │   │   │       │   └── CategoryForm.tsx
│   │   │   │       ├── brands/
│   │   │   │       ├── prices/
│   │   │   │       └── users/
│   │   │   │
│   │   │   ├── pages/                  # Páginas/rutas
│   │   │   │   ├── Login.tsx
│   │   │   │   ├── Dashboard.tsx
│   │   │   │   ├── products/
│   │   │   │   │   ├── index.tsx       # Lista
│   │   │   │   │   ├── create.tsx      # Crear
│   │   │   │   │   └── [id]/
│   │   │   │   │       └── edit.tsx    # Editar
│   │   │   │   ├── categories/
│   │   │   │   ├── brands/
│   │   │   │   ├── prices/
│   │   │   │   └── users/
│   │   │   │
│   │   │   ├── hooks/                  # Custom hooks
│   │   │   │   ├── useAuth.ts
│   │   │   │   ├── useProducts.ts
│   │   │   │   ├── useCategories.ts
│   │   │   │   └── usePagination.ts
│   │   │   │
│   │   │   ├── services/               # API client
│   │   │   │   ├── api.ts              # Axios instance
│   │   │   │   ├── auth.service.ts
│   │   │   │   ├── products.service.ts
│   │   │   │   ├── categories.service.ts
│   │   │   │   ├── brands.service.ts
│   │   │   │   ├── prices.service.ts
│   │   │   │   └── users.service.ts
│   │   │   │
│   │   │   ├── stores/                 # State management
│   │   │   │   ├── auth.store.ts
│   │   │   │   └── ui.store.ts
│   │   │   │
│   │   │   ├── types/                  # TypeScript types
│   │   │   │   ├── api.types.ts
│   │   │   │   ├── product.types.ts
│   │   │   │   ├── user.types.ts
│   │   │   │   └── index.ts
│   │   │   │
│   │   │   ├── utils/                  # Utilidades
│   │   │   │   ├── formatters.ts
│   │   │   │   └── validators.ts
│   │   │   │
│   │   │   ├── App.tsx                 # Router principal
│   │   │   ├── main.tsx               # Entry point
│   │   │   └── index.css              # Tailwind imports
│   │   │
│   │   ├── public/
│   │   ├── index.html
│   │   ├── package.json
│   │   ├── vite.config.ts
│   │   ├── tailwind.config.js
│   │   ├── postcss.config.js
│   │   ├── tsconfig.json
│   │   └── Dockerfile
│   │
│   └── shared/                          # Tipos compartidos
│       └── types/
│           ├── product.types.ts
│           ├── user.types.ts
│           └── index.ts
│
├── docs/                                # Documentación
│   ├── architecture.md
│   ├── data-model.md
│   └── api/
│       └── api-spec.yaml
│
├── api/                                 # API specs
│   └── api-spec.yaml
│
├── vault/                               # Obsidian vault
│
├── docker-compose.yml
├── .env.example
├── .gitignore
├── AGENTS.md
└── README.md
```

---

## 5. Modelo de Datos (Prisma Schema)

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ==========================================
// AUTENTICACIÓN Y AUTORIZACIÓN
// ==========================================

model User {
  id        String   @id @default(uuid())
  email     String   @unique
  name      String
  password  String   // bcrypt hash
  isActive  Boolean  @default(true)
  roles     UserRole[]
  auditLogs AuditLog[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("users")
}

model Role {
  id          String   @id @default(uuid())
  name        String   @unique
  description String?
  permissions RolePermission[]
  users       UserRole[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@map("roles")
}

model UserRole {
  user      User     @relation(fields: [userId], references: [id])
  userId    String
  role      Role     @relation(fields: [roleId], references: [id])
  roleId    String
  createdAt DateTime @default(now())

  @@id([userId, roleId])
  @@map("user_roles")
}

model RolePermission {
  role       Role     @relation(fields: [roleId], references: [id])
  roleId     String
  permission String   // ej: "products:read"
  createdAt  DateTime @default(now())

  @@id([roleId, permission])
  @@map("role_permissions")
}

// ==========================================
// CATÁLOGO DE PRODUCTOS
// ==========================================

model Product {
  id          String         @id @default(uuid())
  sku         String         @unique
  name        String
  description String?
  category    Category       @relation(fields: [categoryId], references: [id])
  categoryId  String
  brand       Brand          @relation(fields: [brandId], references: [id])
  brandId     String
  prices      Price[]
  images      ProductImage[]
  isActive    Boolean        @default(false)  // Habilitado
  isVisible   Boolean        @default(false)  // Visible en catálogo
  auditLogs   AuditLog[]
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt

  @@index([categoryId])
  @@index([brandId])
  @@index([isActive, isVisible])
  @@map("products")
}

model Category {
  id          String     @id @default(uuid())
  name        String
  description String?
  slug        String     @unique
  parent      Category?  @relation("CategoryTree", fields: [parentId], references: [id])
  parentId    String?
  children    Category[] @relation("CategoryTree")
  products    Product[]
  sortOrder   Int        @default(0)
  isActive    Boolean    @default(true)
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  @@index([parentId])
  @@map("categories")
}

model Brand {
  id          String    @id @default(uuid())
  name        String    @unique
  slug        String    @unique
  logo        String?
  description String?
  website     String?
  products    Product[]
  isActive    Boolean   @default(true)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@map("brands")
}

model ProductImage {
  id        String  @id @default(uuid())
  product   Product @relation(fields: [productId], references: [id])
  productId String
  url       String
  alt       String?
  isPrimary Boolean @default(false)
  sortOrder Int     @default(0)

  @@index([productId])
  @@map("product_images")
}

// ==========================================
// GESTIÓN DE PRECIOS
// ==========================================

model PriceList {
  id        String   @id @default(uuid())
  name      String
  code      String   @unique  // ej: "MAYORISTA", "DETALLE"
  currency  String   @default("COP")
  isActive  Boolean  @default(true)
  validFrom DateTime?
  validUntil DateTime?
  prices    Price[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("price_lists")
}

model Price {
  id          String    @id @default(uuid())
  product     Product   @relation(fields: [productId], references: [id])
  productId   String
  priceList   PriceList @relation(fields: [priceListId], references: [id])
  priceListId String
  value       Decimal   @db.Decimal(12, 2)
  currency    String    @default("COP")
  validFrom   DateTime?
  validUntil  DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@unique([productId, priceListId])
  @@index([productId])
  @@index([priceListId])
  @@map("prices")
}

// ==========================================
// AUDITORÍA
// ==========================================

model AuditLog {
  id        String   @id @default(uuid())
  user      User?    @relation(fields: [userId], references: [id])
  userId    String?
  action    String   // CREATE, UPDATE, DELETE
  entity    String   // Product, User, etc.
  entityId  String
  oldValues Json?
  newValues Json?
  ipAddress String?
  userAgent String?
  createdAt DateTime @default(now())

  @@index([entity, entityId])
  @@index([userId])
  @@index([createdAt])
  @@map("audit_logs")
}
```

---

## 6. Modelo de Dominio - Entidades Principales

### 6.1 Producto
- **SKU**: Código único del producto
- **Nombre**: Nombre comercial
- **Descripción**: Descripción detallada
- **Categoría**: Relación many-to-one con Category (jerarquía)
- **Marca**: Relación many-to-one con Brand
- **Precios**: Relación one-to-many con Price
- **Imágenes**: Relación one-to-many con ProductImage
- **Estado**: isActive (habilitado), isVisible (visible en catálogo)

### 6.2 Categoría
- **Nombre**: Nombre de la categoría
- **Slug**: URL amigable (unique)
- **Padre**: Relación self-referential (jerarquía infinita)
- **Hijos**: Subcategorías
- **Orden**: Para ordenamiento manual

### 6.3 Marca
- **Nombre**: Nombre de la marca
- **Slug**: URL amigable
- **Logo**: URL del logo
- **Sitio web**: URL oficial

### 6.4 Lista de Precios
- **Nombre**: Nombre descriptivo
- **Código**: Código corto (MAYORISTA, DETALLE, etc.)
- **Moneda**: COP por defecto
- **Vigencia**: Fechas de validez opcional

### 6.5 Precio
- **Producto**: Relación many-to-one
- **Lista de Precios**: Relación many-to-one
- **Valor**: Precio con 2 decimales
- **Moneda**: COP por defecto
- **Vigencia**: Fechas de validez opcional
- **Unique constraint**: Un precio por producto por lista

### 6.6 Usuario
- **Email**: Identificador único
- **Nombre**: Nombre completo
- **Password**: Hash bcrypt
- **Roles**: Relación many-to-many con Role

### 6.7 Rol
- **Nombre**: Nombre único (admin, gerente, operator, viewer)
- **Permisos**: Lista de strings (products:read, products:write, etc.)

### 6.8 Auditoría
- **Usuario**: Quién realizó la acción
- **Acción**: CREATE, UPDATE, DELETE
- **Entidad**: Nombre de la entidad
- **ID Entidad**: ID del registro afectado
- **Valores anteriores**: JSON con valores previos
- **Valores nuevos**: JSON con valores nuevos

---

## 7. Autenticación y Autorización

### 7.1 Flujo de Login

```
1. Usuario envía POST /auth/login con email + password
2. Backend valida credenciales contra bcrypt hash
3. Si son correctas, genera JWT con:
   - sub: user.id
   - email: user.email
   - roles: [role names]
   - permissions: [all permissions from roles]
4. Backend envía JWT en cookie HttpOnly (no accesible desde JS)
5. Frontend envía cookie automáticamente en cada petición
6. Backend extrae JWT de cookie en cada request
```

**Nota:** Se usa cookie HttpOnly en vez de localStorage por seguridad (previene XSS de acceder al token).

### 7.2 JWT Payload

```json
{
  "sub": "uuid-del-usuario",
  "email": "admin@grupo-security.com",
  "roles": ["admin"],
  "permissions": [
    "products:read",
    "products:write",
    "products:delete",
    "categories:read",
    "categories:write",
    "brands:read",
    "brands:write",
    "prices:read",
    "prices:write",
    "users:read",
    "users:write",
    "users:manage",
    "audit:read",
    "publish:manage"
  ],
  "iat": 1721644800,
  "exp": 1721731200
}
```

### 7.3 Roles y Permisos

| Rol | Permisos |
|-----|----------|
| **Admin** | Todos los permisos |
| **Gerente** | products:read/write, categories:read/write, brands:read/write, prices:read/write, audit:read, publish:manage |
| **Operator** | products:read/write, categories:read, brands:read, prices:read |
| **Viewer** | products:read, categories:read, brands:read, prices:read |

### 7.4 Guards (NestJS)

```typescript
// jwt-auth.guard.ts
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}

// roles.guard.ts
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);
    
    if (!requiredRoles) return true;
    
    const { user } = context.switchToHttp().getRequest();
    return requiredRoles.some(role => user.roles?.includes(role));
  }
}
```

---

## 8. Endpoints API (Fase 1)

### 8.1 Autenticación

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| POST | /auth/login | Login | No |
| POST | /auth/register | Register (solo admin) | Admin |
| GET | /auth/me | Info del usuario actual | JWT |
| POST | /auth/refresh | Renovar token | JWT |

### 8.2 Usuarios

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| GET | /users | Listar usuarios | Admin |
| GET | /users/:id | Obtener usuario | Admin |
| POST | /users | Crear usuario | Admin |
| PUT | /users/:id | Actualizar usuario | Admin |
| DELETE | /users/:id | Eliminar usuario | Admin |

### 8.3 Roles

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| GET | /roles | Listar roles | Admin |
| POST | /roles | Crear rol | Admin |
| PUT | /roles/:id | Actualizar rol | Admin |
| DELETE | /roles/:id | Eliminar rol | Admin |

### 8.4 Productos

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| GET | /products | Listar productos (filtros, paginación) | Cualquier auth |
| GET | /products/:id | Obtener producto | Cualquier auth |
| POST | /products | Crear producto | Admin, Gerente |
| PUT | /products/:id | Actualizar producto | Admin, Gerente |
| DELETE | /products/:id | Eliminar producto | Admin |

### 8.5 Categorías

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| GET | /categories | Listar categorías (árbol) | Cualquier auth |
| GET | /categories/:id | Obtener categoría | Cualquier auth |
| POST | /categories | Crear categoría | Admin, Gerente |
| PUT | /categories/:id | Actualizar categoría | Admin, Gerente |
| DELETE | /categories/:id | Eliminar categoría | Admin |

### 8.6 Marcas

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| GET | /brands | Listar marcas | Cualquier auth |
| GET | /brands/:id | Obtener marca | Cualquier auth |
| POST | /brands | Crear marca | Admin, Gerente |
| PUT | /brands/:id | Actualizar marca | Admin, Gerente |
| DELETE | /brands/:id | Eliminar marca | Admin |

### 8.7 Listas de Precios

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| GET | /price-lists | Listar listas de precios | Cualquier auth |
| GET | /price-lists/:id | Obtener lista | Cualquier auth |
| POST | /price-lists | Crear lista | Admin, Gerente |
| PUT | /price-lists/:id | Actualizar lista | Admin, Gerente |

### 8.8 Precios

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| GET | /prices/product/:productId | Precios de un producto | Cualquier auth |
| POST | /prices | Asignar precio | Admin, Gerente |
| PUT | /prices/:id | Actualizar precio | Admin, Gerente |
| DELETE | /prices/:id | Eliminar precio | Admin |

### 8.9 Auditoría

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| GET | /audit | Listar logs de auditoría | Admin |
| GET | /audit/:entity/:entityId | Logs de una entidad | Admin |

### 8.10 Publicación

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| PATCH | /publish/product/:id | Toggle visibilidad | Admin, Gerente |

---

## 9. Frontend - Páginas del Admin

### 9.1 Login
- Formulario email + password
- Redirige a Dashboard tras login exitoso
- Muestra errores de credenciales

### 9.2 Dashboard
- Resumen de productos (total, activos, visibles)
- Últimos productos creados
- Accesos rápidos

### 9.3 Productos
- **Lista**: Tabla con filtros (categoría, marca, estado, búsqueda)
- **Crear**: Formulario con todos los campos
- **Editar**: Mismo formulario con datos precargados
- **Detalle**: Vista completa del producto con precios e imágenes

### 9.4 Categorías
- **Lista**: Vista de árbol (jerarquía)
- **Crear**: Formulario con selector de categoría padre
- **Editar**: Mismo formulario

### 9.5 Marcas
- **Lista**: Grid o tabla de marcas
- **Crear**: Formulario con upload de logo
- **Editar**: Mismo formulario

### 9.6 Precios
- **Lista de precios**: CRUD de listas
- **Asignar precios**: Selector de producto → asignar precios por lista

### 9.7 Usuarios
- **Lista**: Tabla de usuarios con roles
- **Crear**: Formulario con selector de roles
- **Editar**: Mismo formulario

---

## 10. Configuración del Entorno

### 10.1 Variables de Entorno

```env
# .env
DATABASE_URL=postgresql://postgres:password@localhost:5432/grupo_security
JWT_SECRET=your-super-secret-jwt-key-min-32-characters
JWT_EXPIRATION=24h
REDIS_URL=redis://localhost:6379
CORS_ORIGIN=http://localhost:5173
API_PORT=3000
NODE_ENV=development
```

### 10.2 Scripts npm

```json
// Backend package.json scripts
{
  "scripts": {
    "dev": "nest start --watch",
    "build": "nest build",
    "start": "node dist/main",
    "start:prod": "node dist/main",
    "db:migrate": "prisma migrate dev",
    "db:generate": "prisma generate",
    "db:seed": "ts-node prisma/seed.ts",
    "db:studio": "prisma studio",
    "lint": "eslint \"{src,apps,libs,test}/**/*.ts\"",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:cov": "jest --coverage"
  }
}
```

```json
// Frontend package.json scripts
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "lint": "eslint . --ext ts,tsx"
  }
}
```

---

## 11. Seguridad

### 11.1 Seguridad Mínima Obligatoria (Fase 1)

Estos controles son **obligatorios** antes de poner el panel en uso:

| Control | Implementación | Prioridad |
|---------|---------------|-----------|
| **Autenticación** | JWT en cookie HttpOnly + bcrypt password hash | Crítica |
| **Autorización** | RBAC con guards en cada endpoint | Crítica |
| **Validación de entradas** | class-validator en todos los DTOs | Crítica |
| **SQL Injection** | Prisma ORM (previene automáticamente) | Crítica |
| **XSS básico** | React escapa + helmet headers | Alta |
| **CORS** | Configurar origen específico del frontend | Alta |
| **Rate Limiting** | throttler en endpoints de auth | Alta |
| **Auditoría** | Logs de CREATE/UPDATE/DELETE en entidades críticas | Alta |
| **Contraseñas** | bcrypt con salt rounds 12, mínimo 8 caracteres | Crítica |
| **MFA futuro** | Reservar endpoint POST /auth/mfa/setup | Media |

### 11.2 Controles de Hardening (Post-Fase 1)

Estos controles se implementan después del MVP funcional:

| Control | Implementación | Cuándo |
|---------|---------------|--------|
| **HTTPS** | Certificado SSL/TLS (Let's Encrypt) | Antes de producción |
| **CSP Headers** | Content-Security-Policy estricto | Post-MVP |
| **HSTS** | Strict-Transport-Security | Post-MVP |
| **Rate Limiting avanzado** | Por usuario, por endpoint | Post-MVP |
| **WAF** | Web Application Firewall | Producción |
| **MFA** | TOTP (Google Authenticator) | Post-MVP |
| **Refresh Tokens** | Rotación de tokens | Post-MVP |
| **Brute Force Protection** | Bloqueo temporal por intentos | Post-MVP |
| **Audit Log avanzado** | IP, User-Agent, geo | Post-MVP |

### 11.3 Cookie HttpOnly - Configuración

```typescript
// auth.controller.ts
@Post('login')
async login(@Body() loginDto: LoginDto, @Res({ passthrough: true }) res: Response) {
  const { accessToken } = await this.authService.login(loginDto);
  
  res.cookie('auth_token', accessToken, {
    httpOnly: true,      // No accesible desde JavaScript
    secure: true,        // Solo HTTPS en producción
    sameSite: 'strict',  // Protección CSRF
    maxAge: 24 * 60 * 60 * 1000, // 24 horas
    path: '/',
  });
  
  return { message: 'Login exitoso' };
}
```

### 11.4 Auditoría

Todas las operaciones CRUD en entidades críticas generan logs:
- Quién realizó la acción
- Qué acción realizó
- Qué entidad afectó
- Valores anteriores y nuevos
- Timestamp y metadata

---

## 12. Integración ERP (Yéminus)

**Estado:** Pendiente de confirmación

**Decisión:** El conector ERP se implementa como módulo separado con endpoint 501 (Not Implemented) hasta que Yéminus confirme:
- API REST disponible
- Entidades integrables
- Mecanismos de seguridad
- Infraestructura y costos

** NO asumir que hay API CRUD de productos disponible hasta tener confirmación.**

---

## 13. Próximos Pasos

1. **Semana 1**: Setup del proyecto (NestJS + Prisma + React)
2. **Semana 2**: Módulo de Auth (login, JWT, RBAC)
3. **Semana 3**: CRUD de Usuarios y Roles
4. **Semana 4**: CRUD de Productos, Categorías, Marcas
5. **Semana 5**: Gestión de Precios
6. **Semana 6**: Frontend Admin (login, dashboard, productos)
7. **Semana 7**: Frontend Admin (categorías, marcas, precios, usuarios)
8. **Semana 8**: Auditoría, testing, deployment

---

## 14. Decisiones Técnicas

| Fecha | Decisión | Justificación |
|-------|----------|---------------|
| 2026-07-22 | NestJS como backend framework | Modular, enterprise-ready, TypeScript nativo |
| 2026-07-22 | Prisma como ORM | Type-safe, migraciones automáticas, buena DX |
| 2026-07-22 | PostgreSQL como DB | Robusto, open-source, soporte JSON |
| 2026-07-22 | Zustand para state management | Ligero, simple, TypeScript-first |
| 2026-07-22 | React Query para data fetching | Caching, revalidation, loading states |
| 2026-07-22 | JWT + bcrypt para auth | Estándar industry, sin estado server-side |
| 2026-07-22 | RBAC con permisos granulares | Flexibilidad para futuros roles |
