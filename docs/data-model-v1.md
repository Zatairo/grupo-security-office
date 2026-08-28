# Data Model v1 — Grupo Security, Fase 1: Sistema Interno Modular

**Versión:** 1.0  
**Fecha:** 2026-07-22  
**Estado:** Borrador  
**Proyecto:** Grupo Security — Panel Administrativo Interno

---

## 1. Visión General

Este documento define el modelo de datos consolidado para la **Fase 1** del proyecto Grupo Security. El sistema modular interno soporta gestión de productos, categorías, marcas, precios, usuarios con control de acceso basado en roles (RBAC) y auditoría de cambios.

Todas las tablas utilizan **UUIDs** como identificadores primarios para garantizar distribución segura y evitar colisiones en futuras integraciones con el ERP Yéminus.

---

## 2. Entidades

### 2.1 User (Usuario)

Almacena las credenciales y datos personales de los usuarios internos del sistema.

| Campo | Tipo | Restricción | Descripción |
|-------|------|-------------|-------------|
| `id` | UUID | PK | Identificador único |
| `email` | VARCHAR(255) | UNIQUE, NOT NULL | Correo electrónico institucional |
| `name` | VARCHAR(255) | NOT NULL | Nombre completo del usuario |
| `password` | VARCHAR(255) | NOT NULL | Hash bcrypt de la contraseña |
| `isActive` | BOOLEAN | NOT NULL, DEFAULT true | Habilita/deshabilita acceso al sistema |
| `createdAt` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Fecha de creación |
| `updatedAt` | TIMESTAMP | NOT NULL | Fecha de última actualización |

**Índices:**
- `idx_user_email` — UNIQUE en `email` (búsqueda de login)
- `idx_user_active` — en `isActive` (filtros de usuario activo)

---

### 2.2 Role (Rol)

Define los perfiles de acceso disponibles en el sistema.

| Campo | Tipo | Restricción | Descripción |
|-------|------|-------------|-------------|
| `id` | UUID | PK | Identificador único |
| `name` | VARCHAR(100) | UNIQUE, NOT NULL | Nombre del rol (ej: "Admin", "Gerente") |
| `description` | TEXT | NULLABLE | Descripción del alcance del rol |
| `createdAt` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Fecha de creación |
| `updatedAt` | TIMESTAMP | NOT NULL | Fecha de última actualización |

**Índices:**
- `idx_role_name` — UNIQUE en `name`

---

### 2.3 UserRole (Relación Usuario-Rol)

Tabla de unión que asocia usuarios con uno o más roles. Permite un modelo RBAC flexible.

| Campo | Tipo | Restricción | Descripción |
|-------|------|-------------|-------------|
| `userId` | UUID | FK → User.id, NOT NULL | Referencia al usuario |
| `roleId` | UUID | FK → Role.id, NOT NULL | Referencia al rol |
| `createdAt` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Fecha de asignación |

**PK compuesta:** `(userId, roleId)`

**Índices:**
- `idx_userrole_user` — en `userId` (buscar roles de un usuario)
- `idx_userrole_role` — en `roleId` (buscar usuarios con un rol)

---

### 2.4 RolePermission (Relación Rol-Permiso)

Define qué permisos tiene cada rol. Los permisos se almacenan como strings formateados.

| Campo | Tipo | Restricción | Descripción |
|-------|------|-------------|-------------|
| `roleId` | UUID | FK → Role.id, NOT NULL | Referencia al rol |
| `permission` | VARCHAR(100) | NOT NULL | Permiso formateado (ej: "products:read") |
| `createdAt` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Fecha de asignación |

**PK compuesta:** `(roleId, permission)`

**Índices:**
- `idx_rolepermission_role` — en `roleId`
- `idx_rolepermission_permission` — en `permission` (buscar qué roles tienen un permiso)

**Formato de permisos:** `{recurso}:{acción}`

Ver sección [5. Lista de Permisos](#5-lista-de-permisos) para el catálogo completo.

---

### 2.5 Product (Producto)

Entidad central del catálogo interno. Representa cada equipo de seguridad electrónica que ofrece Grupo Security.

El **ciclo de vida** se gestiona mediante la FSM canónica de tres estados definida en la sección [4. Estados de Publicación](#4-estados-de-publicación). La fuente de verdad es `lifecycleStatus`; las columnas legacy (`isActive`, `isVisible`, `publishStatus`, `publishAt`, `unpublishAt`) se conservan y se escriben como espejo del estado canónico (dual-write) hasta su migración pendiente.

| Campo | Tipo | Restricción | Descripción |
|-------|------|-------------|-------------|
| `id` | UUID | PK | Identificador único |
| `sku` | VARCHAR(50) | UNIQUE, NOT NULL | Código SKU del producto |
| `name` | VARCHAR(255) | NOT NULL | Nombre comercial del producto |
| `description` | TEXT | NULLABLE | Descripción detallada |
| `categoryId` | UUID | FK → Category.id, NOT NULL | Categoría principal |
| `brandId` | UUID | FK → Brand.id, NOT NULL | Marca del fabricante |
| `technicalSpecs` | JSONB | NULLABLE | Especificaciones técnicas (ver sección 7) |
| `lifecycleStatus` | STRING | NOT NULL | Estado canónico FSM: `DRAFT` \| `PUBLISHED` \| `ARCHIVED` (fuente de verdad) |
| `isActive` | BOOLEAN | NOT NULL, DEFAULT false | **Legacy (espejo)**: habilitación; derivada del estado canónico |
| `isVisible` | BOOLEAN | NOT NULL, DEFAULT false | **Legacy (espejo)**: visibilidad; derivada del estado canónico |
| `createdAt` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Fecha de creación |
| `updatedAt` | TIMESTAMP | NOT NULL | Fecha de última actualización |

**Índices:**
- `idx_product_sku` — UNIQUE en `sku`
- `idx_product_category` — en `categoryId`
- `idx_product_brand` — en `brandId`
- `idx_product_active` — en `isActive` (filtros de publicación; legacy)
- `idx_product_visible` — en `isVisible` (filtros de visibilidad; legacy)
- `idx_product_name_search` — GIN/índice de texto en `name` para búsqueda

> **Nota**: `isActive` y `isVisible` son columnas legacy conservadas como espejo del estado FSM. No son fuente de verdad para acciones ni estados; el contrato vigente se describe en la sección [4](#4-estados-de-publicación).

---

### 2.6 Category (Categoría)

Soporta jerarquías de categorías mediante autorreferencia. Ejemplo: "CCTV" → "Cámaras IP" → "Bullet".

| Campo | Tipo | Restricción | Descripción |
|-------|------|-------------|-------------|
| `id` | UUID | PK | Identificador único |
| `name` | VARCHAR(150) | NOT NULL | Nombre de la categoría |
| `description` | TEXT | NULLABLE | Descripción de la categoría |
| `slug` | VARCHAR(150) | UNIQUE, NOT NULL | Slug URL-friendly (ej: "cctv-camaras-ip") |
| `parentId` | UUID | FK → Category.id, NULLABLE | Categoría padre (null = raíz) |
| `sortOrder` | INTEGER | NOT NULL, DEFAULT 0 | Orden de visualización |
| `isActive` | BOOLEAN | NOT NULL, DEFAULT true | Habilita/deshabilita categoría |
| `createdAt` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Fecha de creación |
| `updatedAt` | TIMESTAMP | NOT NULL | Fecha de última actualización |

**Índices:**
- `idx_category_slug` — UNIQUE en `slug`
- `idx_category_parent` — en `parentId` (consulta de hijos)
- `idx_category_sort` — en `sortOrder` (orden de presentación)

---

### 2.7 Brand (Marca)

Fabricantes de equipos de seguridad electrónica.

| Campo | Tipo | Restricción | Descripción |
|-------|------|-------------|-------------|
| `id` | UUID | PK | Identificador único |
| `name` | VARCHAR(150) | NOT NULL | Nombre de la marca |
| `slug` | VARCHAR(150) | UNIQUE, NOT NULL | Slug URL-friendly |
| `logo` | VARCHAR(500) | NULLABLE | URL o ruta del logo |
| `description` | TEXT | NULLABLE | Descripción de la marca |
| `website` | VARCHAR(500) | NULLABLE | Sitio web oficial |
| `isActive` | BOOLEAN | NOT NULL, DEFAULT true | Habilita/deshabilita marca |
| `createdAt` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Fecha de creación |
| `updatedAt` | TIMESTAMP | NOT NULL | Fecha de última actualización |

**Índices:**
- `idx_brand_slug` — UNIQUE en `slug`
- `idx_brand_active` — en `isActive`

---

### 2.8 ProductImage (Imagen de Producto)

Gestiona múltiples imágenes por producto con soporte para imagen principal.

| Campo | Tipo | Restricción | Descripción |
|-------|------|-------------|-------------|
| `id` | UUID | PK | Identificador único |
| `productId` | UUID | FK → Product.id, NOT NULL | Producto asociado |
| `url` | VARCHAR(500) | NOT NULL | URL de la imagen |
| `alt` | VARCHAR(255) | NULLABLE | Texto alternativo (accesibilidad + SEO) |
| `isPrimary` | BOOLEAN | NOT NULL, DEFAULT false | Marca como imagen principal |
| `sortOrder` | INTEGER | NOT NULL, DEFAULT 0 | Orden de visualización |

**Índices:**
- `idx_productimage_product` — en `productId`
- `idx_productimage_primary` — en `(productId, isPrimary)` (buscar imagen principal)

---

### 2.9 PriceList (Lista de Precios)

Cada lista define un contexto comercial con moneda y vigencia propia.

| Campo | Tipo | Restricción | Descripción |
|-------|------|-------------|-------------|
| `id` | UUID | PK | Identificador único |
| `name` | VARCHAR(100) | NOT NULL | Nombre descriptivo (ej: "Lista Mayorista") |
| `code` | VARCHAR(50) | UNIQUE, NOT NULL | Código interno (ej: "MAYORISTA", "DETALLE") |
| `currency` | VARCHAR(3) | NOT NULL, DEFAULT 'COP' | Código ISO 4217 de moneda |
| `isActive` | BOOLEAN | NOT NULL, DEFAULT true | Habilita/deshabilita lista |
| `validFrom` | DATE | NULLABLE | Fecha de inicio de vigencia |
| `validUntil` | DATE | NULLABLE | Fecha de fin de vigencia |
| `createdAt` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Fecha de creación |
| `updatedAt` | TIMESTAMP | NOT NULL | Fecha de última actualización |

**Índices:**
- `idx_pricelist_code` — UNIQUE en `code`
- `idx_pricelist_active` — en `isActive`

---

### 2.10 Price (Precio)

Asocia un producto con una lista de precios definiendo su valor unitario.

| Campo | Tipo | Restricción | Descripción |
|-------|------|-------------|-------------|
| `id` | UUID | PK | Identificador único |
| `productId` | UUID | FK → Product.id, NOT NULL | Producto asociado |
| `priceListId` | UUID | FK → PriceList.id, NOT NULL | Lista de precios |
| `value` | DECIMAL(12,2) | NOT NULL | Valor unitario del producto |
| `currency` | VARCHAR(3) | NOT NULL, DEFAULT 'COP' | Código ISO 4217 de moneda |
| `validFrom` | DATE | NULLABLE | Inicio de vigencia del precio |
| `validUntil` | DATE | NULLABLE | Fin de vigencia del precio |
| `createdAt` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Fecha de creación |
| `updatedAt` | TIMESTAMP | NOT NULL | Fecha de última actualización |

**Restricción única:** `(productId, priceListId)` — un producto solo puede tener un precio por lista.

**Índices:**
- `idx_price_product` — en `productId`
- `idx_price_pricelist` — en `priceListId`
- `idx_price_validity` — en `(validFrom, validUntil)` (vigencia de precios)

---

### 2.11 AuditLog (Registro de Auditoría)

Registra todos los cambios en entidades críticas del sistema para trazabilidad y cumplimiento.

| Campo | Tipo | Restricción | Descripción |
|-------|------|-------------|-------------|
| `id` | UUID | PK | Identificador único |
| `userId` | UUID | FK → User.id, NULLABLE | Usuario que realizó la acción (null si sistema) |
| `action` | ENUM | NOT NULL | Tipo de acción: `CREATE`, `UPDATE`, `DELETE` |
| `entity` | VARCHAR(100) | NOT NULL | Nombre de la entidad modificada |
| `entityId` | UUID | NOT NULL | ID del registro modificado |
| `oldValues` | JSONB | NULLABLE | Valores previos al cambio (para UPDATE) |
| `newValues` | JSONB | NULLABLE | Valores nuevos tras el cambio |
| `ipAddress` | VARCHAR(45) | NULLABLE | Dirección IP del cliente (IPv4/IPv6) |
| `userAgent` | VARCHAR(500) | NULLABLE | User-Agent del navegador/cliente |
| `createdAt` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Timestamp del cambio |

**Índices:**
- `idx_auditlog_user` — en `userId`
- `idx_auditlog_entity` — en `(entity, entityId)` (historial de una entidad)
- `idx_auditlog_action` — en `action` (filtros por tipo de acción)
- `idx_auditlog_created` — en `createdAt` (rangos de tiempo, orden cronológico)

---

## 3. Relaciones entre Entidades

```
User ──< UserRole >── Role
                        │
                        └──< RolePermission (permission string)

Product ──> Category
Product ──> Brand
Product ──< ProductImage

Product ──< Price >── PriceList

Cualquier entidad ──> AuditLog (via entity + entityId)
```

| Relación | Tipo | Descripción |
|----------|------|-------------|
| User ↔ Role | Muchos a muchos (via UserRole) | Un usuario puede tener múltiples roles; un rol puede asignarse a múltiples usuarios |
| Role → Permission | Uno a muchos (via RolePermission) | Cada rol tiene una lista plana de permisos como strings |
| Product → Category | Muchos a uno | Un producto pertenece a una categoría |
| Product → Brand | Muchos a uno | Un producto pertenece a una marca |
| Product → ProductImage | Uno a muchos | Un producto tiene múltiples imágenes |
| Product ↔ PriceList | Muchos a muchos (via Price) | Un producto tiene precios distintos según la lista comercial |
| Category → Category | Autorreferencia (uno a uno) | Categorías padre-hijo para jerarquía |
| AuditLog → User | Muchos a uno (nullable) | Cada registro de auditoría puede atribuirse a un usuario |

---

## 4. Estados de Publicación

El ciclo de vida de un producto se rige por una **FSM canónica de tres estados** implementada en backend y frontend. La fuente de verdad es `lifecycleStatus`.

### Estados canónicos

| Estado | Etiqueta UI | Visible | Comercializable | Banderas legacy derivadas |
|---|---|---:|---:|---|
| `DRAFT` | Borrador | No | No | `isActive=false`, `isVisible=false` |
| `PUBLISHED` | Publicado | Sí | Sí | `isActive=true`, `isVisible=true` |
| `ARCHIVED` | Archivado | No | No | `isActive=false`, `isVisible=false` |

### Eventos y transiciones

```text
DRAFT     --PUBLISH-->   PUBLISHED
PUBLISHED --UNPUBLISH--> DRAFT
DRAFT     --ARCHIVE-->   ARCHIVED
PUBLISHED --ARCHIVE-->   ARCHIVED
ARCHIVED  --RESTORE-->   DRAFT
```

- `PUBLISH` habilita y muestra; valida requisitos comerciales y permisos.
- `UNPUBLISH` deshabilita y oculta; vuelve siempre a `DRAFT`.
- `ARCHIVE` conserva el registro; requiere motivo y confirmación.
- `RESTORE` requiere motivo y confirmación; vuelve siempre a `DRAFT`, nunca publica automáticamente.
- La programación de publicación se representa como `DRAFT + publishAt futura`; el scheduler interno aplica `PUBLISH` al llegar la fecha. No existe estado `SCHEDULED` ni auto-despublicación.
- `unpublishAt` se conserva temporalmente como columna legacy obsoleta e ignorada.

### Compatibilidad legacy (lectura temporal, hasta migración)

```text
READY        -> DRAFT
SCHEDULED    -> DRAFT, preservando publishAt si existe
HIDDEN       -> DRAFT
DISCONTINUED -> ARCHIVED
```

Los estados legacy no se producen ni se exponen; solo se normalizan en lectura. La migración de filas existentes está pendiente.

> **Nota sobre el modelo previo** (`isActive` + `isVisible`): el modelo histórico de dos booleanos (`borrador` / `interno` / `publicado` / `no válido`) queda **superado** por la FSM canónica. `isActive` e `isVisible` se conservan únicamente como espejo derivado del estado canónico.

---

## 5. Lista de Permisos

Los permisos siguen la convención `{recurso}:{acción}` y se asignan a roles mediante la tabla `RolePermission`.

| Permiso | Descripción |
|---------|-------------|
| `products:read` | Consultar productos del catálogo interno |
| `products:write` | Crear y editar productos |
| `products:delete` | Eliminar productos |
| `categories:read` | Consultar categorías |
| `categories:write` | Crear, editar y eliminar categorías |
| `brands:read` | Consultar marcas |
| `brands:write` | Crear, editar y eliminar marcas |
| `prices:read` | Consultar listas de precios y valores |
| `prices:write` | Crear, editar y eliminar precios y listas |
| `users:read` | Consultar usuarios del sistema |
| `users:write` | Crear y editar usuarios |
| `users:manage` | Gestionar roles y permisos de usuarios |
| `audit:read` | Consultar registros de auditoría |
| `publish:manage` | Controlar estados de publicación de productos |

---

## 6. Roles por Defecto

### Admin

> Acceso total al sistema. Rol superusuario sin restricciones.

| Permiso | Asignado |
|---------|----------|
| `products:read` | ✅ |
| `products:write` | ✅ |
| `products:delete` | ✅ |
| `categories:read` | ✅ |
| `categories:write` | ✅ |
| `brands:read` | ✅ |
| `brands:write` | ✅ |
| `prices:read` | ✅ |
| `prices:write` | ✅ |
| `users:read` | ✅ |
| `users:write` | ✅ |
| `users:manage` | ✅ |
| `audit:read` | ✅ |
| `publish:manage` | ✅ |

### Gerente

> Gestión comercial completa: productos, precios, publicación y auditoría. No gestiona usuarios.

| Permiso | Asignado |
|---------|----------|
| `products:read` | ✅ |
| `products:write` | ✅ |
| `products:delete` | ✅ |
| `categories:read` | ✅ |
| `categories:write` | ✅ |
| `brands:read` | ✅ |
| `brands:write` | ✅ |
| `prices:read` | ✅ |
| `prices:write` | ✅ |
| `users:read` | ❌ |
| `users:write` | ❌ |
| `users:manage` | ❌ |
| `audit:read` | ✅ |
| `publish:manage` | ✅ |

### Operator

> Gestión limitada de productos (lectura y edición). Solo consulta de categorías, marcas y precios.

| Permiso | Asignado |
|---------|----------|
| `products:read` | ✅ |
| `products:write` | ✅ |
| `products:delete` | ❌ |
| `categories:read` | ✅ |
| `categories:write` | ❌ |
| `brands:read` | ✅ |
| `brands:write` | ❌ |
| `prices:read` | ✅ |
| `prices:write` | ❌ |
| `users:read` | ❌ |
| `users:write` | ❌ |
| `users:manage` | ❌ |
| `audit:read` | ❌ |
| `publish:manage` | ❌ |

### Viewer

> Solo lectura del catálogo interno. Sin capacidad de edición ni gestión.

| Permiso | Asignado |
|---------|----------|
| `products:read` | ✅ |
| `products:write` | ❌ |
| `products:delete` | ❌ |
| `categories:read` | ✅ |
| `categories:write` | ❌ |
| `brands:read` | ✅ |
| `brands:write` | ❌ |
| `prices:read` | ✅ |
| `prices:write` | ❌ |
| `users:read` | ❌ |
| `users:write` | ❌ |
| `users:manage` | ❌ |
| `audit:read` | ❌ |
| `publish:manage` | ❌ |

---

## 7. Especificaciones Técnicas del Producto

El campo `technicalSpecs` (JSONB) almacena atributos específicos de equipos de seguridad electrónica. Cada producto puede tener un subconjunto diferente de campos según su categoría.

### Campos estándar

| Campo | Tipo | Descripción | Ejemplo |
|-------|------|-------------|---------|
| `resolution` | string | Resolución de imagen/video | `"1920x1080"`, `"4K"` |
| `channels` | integer | Número de canales (DVR/NVR) | `16` |
| `storage` | string | Capacidad de almacenamiento | `"2TB HDD"`, `"256GB SSD"` |
| `connectivity` | string[] | Protocolos/conexiones soportados | `["Wi-Fi", "Ethernet", "ONVIF"]` |
| `powerConsumption` | string | Consumo eléctrico | `"12W (max)"` |
| `warranty` | string | Garantía del fabricante | `"3 años"` |
| `certifications` | string[] | Certificaciones y estándares | `["IP67", "IK10", "NDAA"]` |

### Campos adicionales según categoría

| Campo | Tipo | Categoría típica | Descripción |
|-------|------|-------------------|-------------|
| `lensType` | string | Cámaras | Tipo de lente: `"varifocal"`, `"fija"`, `"fisheye"` |
| `nightVision` | string | Cámaras | Alcance nocturno: `"30m IR"`, `"Starlight"` |
| `alarmInputs` | integer | Alarmas/DVR | Entradas de alarma disponibles |
| `compression` | string | DVR/NVR | Códec: `"H.265+"`, `"H.264"` |
| `accessType` | string | Control de acceso | Método: `"huella"`, `"tarjeta"`, `"facial"` |
| `doorCapacity` | integer | Control de acceso | Número de puertas soportadas |
| `protocol` | string | Alarmas | Protocolo de comunicación: `"SIA"`, `"Contact ID"` |

### Ejemplo de `technicalSpecs`

```json
{
  "resolution": "4K (3840x2160)",
  "channels": null,
  "storage": null,
  "connectivity": ["Wi-Fi 6", "Ethernet 100Mbps", "ONVIF Profile S"],
  "powerConsumption": "12W (PoE IEEE 802.3af)",
  "warranty": "3 años",
  "certifications": ["IP67", "IK10", "CE", "FCC"],
  "lensType": "varifocal motorizada 2.8-12mm",
  "nightVision": "30m IR / Starlight 0.002 lux",
  "compression": "H.265+ / H.264"
}
```

> **Nota:** La estructura del JSON no es estricta. El frontend debe renderizar únicamente los campos presentes y omitir los nulos. Para búsquedas por atributos técnicos en el futuro, se evaluará la migración a una tabla normalizada `ProductAttribute`.

---

## 8. Esquema Prisma

```prisma
// Prisma Schema — Grupo Security Fase 1
// db: PostgreSQL

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─── Autenticación y RBAC ───────────────────────────────────

model User {
  id        String   @id @default(uuid()) @db.Uuid
  email     String   @unique @db.VarChar(255)
  name      String   @db.VarChar(255)
  password  String   @db.VarChar(255)
  isActive  Boolean  @default(true) @map("is_active")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  roles        UserRole[]
  auditLogs    AuditLog[]

  @@map("users")
}

model Role {
  id          String   @id @default(uuid()) @db.Uuid
  name        String   @unique @db.VarChar(100)
  description String?  @db.Text
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  users       UserRole[]
  permissions RolePermission[]

  @@map("roles")
}

model UserRole {
  userId    String   @db.Uuid @map("user_id")
  roleId    String   @db.Uuid @map("role_id")
  createdAt DateTime @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  role Role @relation(fields: [roleId], references: [id], onDelete: Cascade)

  @@id([userId, roleId])
  @@map("user_roles")
}

model RolePermission {
  roleId     String   @db.Uuid @map("role_id")
  permission String   @db.VarChar(100)
  createdAt  DateTime @default(now()) @map("created_at")

  role Role @relation(fields: [roleId], references: [id], onDelete: Cascade)

  @@id([roleId, permission])
  @@index([permission], map: "idx_rolepermission_permission")
  @@map("role_permissions")
}

// ─── Catálogo ───────────────────────────────────────────────

model Product {
  id             String    @id @default(uuid()) @db.Uuid
  sku            String    @unique @db.VarChar(50)
  name           String    @db.VarChar(255)
  description    String?   @db.Text
  categoryId     String    @db.Uuid @map("category_id")
  brandId        String    @db.Uuid @map("brand_id")
  technicalSpecs Json?     @map("technical_specs")
  lifecycleStatus String   @default("DRAFT") @map("lifecycle_status") // Fuente de verdad: DRAFT|PUBLISHED|ARCHIVED
  isActive       Boolean   @default(false) @map("is_active")          // Legacy (espejo)
  isVisible      Boolean   @default(false) @map("is_visible")         // Legacy (espejo)
  publishAt      DateTime? @map("publish_at")                          // Legacy: solo publicación programada (DRAFT)
  unpublishAt    DateTime? @map("unpublish_at")                        // Legacy obsoleto e ignorado
  createdAt      DateTime  @default(now()) @map("created_at")
  updatedAt      DateTime  @updatedAt @map("updated_at")

  category   Category       @relation(fields: [categoryId], references: [id])
  brand      Brand          @relation(fields: [brandId], references: [id])
  images     ProductImage[]
  prices     Price[]

  @@index([categoryId], map: "idx_product_category")
  @@index([brandId], map: "idx_product_brand")
  @@index([isActive], map: "idx_product_active")
  @@index([isVisible], map: "idx_product_visible")
  @@map("products")
}

model Category {
  id          String     @id @default(uuid()) @db.Uuid
  name        String     @db.VarChar(150)
  description String?    @db.Text
  slug        String     @unique @db.VarChar(150)
  parentId    String?    @db.Uuid @map("parent_id")
  sortOrder   Int        @default(0) @map("sort_order")
  isActive    Boolean    @default(true) @map("is_active")
  createdAt   DateTime   @default(now()) @map("created_at")
  updatedAt   DateTime   @updatedAt @map("updated_at")

  parent   Category?  @relation("CategoryHierarchy", fields: [parentId], references: [id])
  children Category[] @relation("CategoryHierarchy")
  products Product[]

  @@index([parentId], map: "idx_category_parent")
  @@index([sortOrder], map: "idx_category_sort")
  @@map("categories")
}

model Brand {
  id          String    @id @default(uuid()) @db.Uuid
  name        String    @db.VarChar(150)
  slug        String    @unique @db.VarChar(150)
  logo        String?   @db.VarChar(500)
  description String?   @db.Text
  website     String?   @db.VarChar(500)
  isActive    Boolean   @default(true) @map("is_active")
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")

  products Product[]

  @@index([isActive], map: "idx_brand_active")
  @@map("brands")
}

model ProductImage {
  id        String  @id @default(uuid()) @db.Uuid
  productId String  @db.Uuid @map("product_id")
  url       String  @db.VarChar(500)
  alt       String? @db.VarChar(255)
  isPrimary Boolean @default(false) @map("is_primary")
  sortOrder Int     @default(0) @map("sort_order")

  product Product @relation(fields: [productId], references: [id], onDelete: Cascade)

  @@index([productId], map: "idx_productimage_product")
  @@index([productId, isPrimary], map: "idx_productimage_primary")
  @@map("product_images")
}

// ─── Precios ────────────────────────────────────────────────

model PriceList {
  id        String    @id @default(uuid()) @db.Uuid
  name      String    @db.VarChar(100)
  code      String    @unique @db.VarChar(50)
  currency  String    @default("COP") @db.VarChar(3)
  isActive  Boolean   @default(true) @map("is_active")
  validFrom DateTime? @map("valid_from")
  validUntil DateTime? @map("valid_until")
  createdAt DateTime  @default(now()) @map("created_at")
  updatedAt DateTime  @updatedAt @map("updated_at")

  prices Price[]

  @@map("price_lists")
}

model Price {
  id          String    @id @default(uuid()) @db.Uuid
  productId   String    @db.Uuid @map("product_id")
  priceListId String    @db.Uuid @map("price_list_id")
  value       Decimal   @db.Decimal(12, 2)
  currency    String    @default("COP") @db.VarChar(3)
  validFrom   DateTime? @map("valid_from")
  validUntil  DateTime? @map("valid_until")
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")

  product   Product   @relation(fields: [productId], references: [id], onDelete: Cascade)
  priceList PriceList @relation(fields: [priceListId], references: [id], onDelete: Cascade)

  @@unique([productId, priceListId], map: "uq_price_product_list")
  @@index([productId], map: "idx_price_product")
  @@index([priceListId], map: "idx_price_pricelist")
  @@map("prices")
}

// ─── Auditoría ──────────────────────────────────────────────

enum AuditAction {
  CREATE
  UPDATE
  DELETE
}

model AuditLog {
  id        String      @id @default(uuid()) @db.Uuid
  userId    String?     @db.Uuid @map("user_id")
  action    AuditAction
  entity    String      @db.VarChar(100)
  entityId  String      @db.Uuid @map("entity_id")
  oldValues Json?       @map("old_values")
  newValues Json?       @map("new_values")
  ipAddress String?     @db.VarChar(45) @map("ip_address")
  userAgent String?     @db.VarChar(500) @map("user_agent")
  createdAt DateTime    @default(now()) @map("created_at")

  user User? @relation(fields: [userId], references: [id], onDelete: SetNull)

  @@index([userId], map: "idx_auditlog_user")
  @@index([entity, entityId], map: "idx_auditlog_entity")
  @@index([action], map: "idx_auditlog_action")
  @@index([createdAt], map: "idx_auditlog_created")
  @@map("audit_logs")
}
```

---

## 9. Diagrama ER (Representación Textual)

```
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│     User     │       │   UserRole   │       │     Role     │
├──────────────┤       ├──────────────┤       ├──────────────┤
│ id       PK │──┐    │ userId   FK  │──┐    │ id       PK │──┐
│ email    UQ │  └──> │ roleId   FK  │  └──> │ name     UQ │  │
│ name        │       │ createdAt    │       │ description  │  │
│ password    │       └──────────────┘       │ createdAt    │  │
│ isActive    │                              │ updatedAt    │  │
│ createdAt   │                              └──────────────┘  │
│ updatedAt   │                                                │
└──────────────┘                                                │
                                                                │
┌──────────────────┐    ┌──────────────────┐                   │
│ RolePermission   │    │    AuditLog      │                   │
├──────────────────┤    ├──────────────────┤                   │
│ roleId       FK  │──┐ │ id           PK  │                   │
│ permission       │  └>│ userId       FK──┼──> User (null)    │
│ createdAt        │    │ action           │                   │
└──────────────────┘    │ entity           │                   │
                        │ entityId         │                   │
                        │ oldValues (JSON) │                   │
                        │ newValues (JSON) │                   │
                        │ ipAddress        │                   │
                        │ userAgent        │                   │
                        │ createdAt        │                   │
                        └──────────────────┘                   │
                                                                │
┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  Category    │    │   Product    │    │    Brand     │      │
├──────────────┤    ├──────────────┤    ├──────────────┤      │
│ id       PK │<───│ categoryId   │    │ id       PK │<─────┘
│ name        │    │ brandId   FK─┼───>│ name        │
│ description │    │ id       PK  │    │ slug     UQ │
│ slug     UQ │    │ sku      UQ  │    │ logo        │
│ parentId FK─┼──┐ │ name         │    │ description │
│ sortOrder   │  │ │ description  │    │ website     │
│ isActive    │  │ │ techSpecs(J) │    │ isActive    │
│ createdAt   │  │ │ isActive     │    │ createdAt   │
│ updatedAt   │  │ │ isVisible    │    │ updatedAt   │
└──────────────┘  │ │ createdAt    │    └──────────────┘
       │          │ │ updatedAt    │
       └──────────┘ └──────────────┘
              (self-ref)       │
                               │
                 ┌─────────────┴─────────────┐
                 │                           │
          ┌──────────────┐          ┌──────────────┐
          │ ProductImage │          │    Price     │
          ├──────────────┤          ├──────────────┤
          │ id       PK  │          │ id       PK  │
          │ productId FK │          │ productId FK │
          │ url          │          │ priceListId  │
          │ alt          │          │ value (Dec)  │
          │ isPrimary    │          │ currency     │
          │ sortOrder    │          │ validFrom    │
          └──────────────┘          │ validUntil   │
                                    │ createdAt    │
                                    │ updatedAt    │
                                    └──────┬───────┘
                                           │
                                    ┌──────┴───────┐
                                    │  PriceList   │
                                    ├──────────────┤
                                    │ id       PK  │
                                    │ name         │
                                    │ code     UQ  │
                                    │ currency     │
                                    │ isActive     │
                                    │ validFrom    │
                                    │ validUntil   │
                                    │ createdAt    │
                                    │ updatedAt    │
                                    └──────────────┘
```

---

## 10. Decisiones de Diseño

| Decisión | Justificación |
|----------|---------------|
| UUID como PK | Distribución segura, sin secuencias centralizadas, preparado para integración con Yéminus |
| JSONB para `technicalSpecs` | Flexibilidad ante diversidad de equipos de seguridad; evita tabla EAV en Fase 1 |
| Permiso como string | Simple y extensible; permite agregar permisos sin migraciones de esquema |
| `isActive` + `isVisible` | Legacy conservado como espejo del estado FSM; el estado real se rige por `lifecycleStatus` (`DRAFT`/`PUBLISHED`/`ARCHIVED`) |
| `price.value` como DECIMAL(12,2) | Precisión monetaria hasta 99,999,999,999.99 COP; evita errores de punto flotante |
| Auditoría en tabla separada | No contamina las entidades de negocio; consultas independientes sin JOINs pesados |
| Categorías jerárquicas (self-ref) | Soporte para estructura tipo árbol: CCTV → Cámaras → IP → Bullet |

---

## 11. Pendientes y Evolución

- [ ] Migración de filas legacy (`READY`, `SCHEDULED`, `HIDDEN`, `DISCONTINUED`) al estado canónico (`lifecycleStatus`), con backup y aprobación independiente
- [ ] **Fecha de actualización de contrato FSM**: 2026-08-28 — FSM canónica de tres estados implementada
- [ ] Evaluar normalización de `technicalSpecs` a tabla `ProductAttribute` si se requieren búsquedas por atributos
- [ ] Confirmar integración con Yéminus: campos adicionales necesarios en `Product` o `Price`
- [ ] Definir política de retención de registros en `AuditLog`
- [ ] Agregar tabla de `Supplier`/`Proveedor` si se requiere gestión de proveedores en Fase 1
- [ ] Considerar tabla `ProductVariant` para productos con variantes (ej: color, capacidad)
- [ ] Definir si se implementa soft delete (`deletedAt`) o hard delete para entidades principales
