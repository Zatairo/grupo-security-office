---
name: grupo-security
description: Contexto completo del proyecto Grupo Security. Usar cuando se necesite entender el negocio, la arquitectura, los módulos, o las decisiones tomadas. Incluye información de empresa, fases, stack, roles, integración ERP y gobernanza.
---

# Skill: Grupo Security - Contexto del Proyecto

## Datos de la Empresa

- **Nombre:** Grupo Security
- **Sector:** Seguridad electrónica (CCTV, alarmas, control de acceso, smart home)
- **País:** Colombia
- **Sedes:** Pereira, Armenia, Manizales, Cali
- **ERP actual:** Yéminus

## Objetivo General

Crear una web/e-commerce completa que sirva como capa comercial integrada con Yéminus. Yéminus continúa como sistema maestro para inventario, pedidos, facturación y contabilidad. La web expone catálogo, precios, exposición comercial y eventualmente pedidos en línea.

## Fases

### Fase 1 (ACTUAL): Sistema Interno Modular
- Panel administrativo interno
- Gestión de productos, categorías, marcas
- Gestión de precios/listas de precios
- Buscador y filtros internos
- Publicación (visible/no visible)
- Usuarios internos y roles (RBAC)
- Auditoría básica de cambios

### Fase 2: E-commerce Público
- Catálogo público, ficha de producto
- Carrito, checkout, registro/login
- Integración ERP (stock, precios, pedidos)
- Pasarela de pago (PCI-DSS)

### Fase 3: Portal Cliente
- Acceso a cotizaciones, seguimiento de pedidos, soporte

## Arquitectura v1

```
┌─────────────────────────────────────────┐
│         Frontend (React + TS + Tailwind)│
│         Panel Admin Interno             │
├─────────────────────────────────────────┤
│         Backend API (Node.js + TS)      │
│         Productos, Categorías, Marcas,  │
│         Precios, Usuarios, Auditoría    │
├─────────────────────────────────────────┤
│         PostgreSQL                      │
│         Catálogo, Usuarios, Roles       │
├─────────────────────────────────────────┤
│         Auth (OAuth2/OIDC + JWT + RBAC) │
├─────────────────────────────────────────┤
│         Conector Yéminus (501)          │
│         PENDIENTE confirmación API      │
└─────────────────────────────────────────┘
```

## Modelo de Datos

- **Producto:** id, nombre, descripción, SKU, categoría_id, marca_id, estado, imágenes, created_at, updated_at
- **Categoría:** id, nombre, descripción, padre_id (jerarquía), orden, activa
- **Marca:** id, nombre, logo_url, descripción, activa
- **Lista de Precios:** id, nombre, moneda, fecha_inicio, fecha_fin, activa
- **Precio:** id, producto_id, lista_precio_id, valor, moneda
- **Usuario:** id, nombre, email, password_hash, activo, created_at
- **Rol:** id, nombre, permisos (JSON)
- **Auditoría:** id, usuario_id, accion, entidad, entidad_id, cambios (JSON), timestamp

## Roles

| Rol | Permisos |
|-----|----------|
| Admin | Acceso total |
| Gerente | Productos, precios, publicación, reportes |
| Operator | Lectura/edición limitada de productos |
| Viewer | Solo lectura |

## Integración Yéminus

- **Estado:** Pendiente de confirmación técnica
- **Decisión:** Conector como endpoint 501 hasta validar API
- ** NO asumir API CRUD disponible hasta confirmación

## Seguridad

- HTTPS obligatorio
- RBAC en cada endpoint
- Contraseñas con bcrypt/argon2
- Validación de entradas con Zod
- Auditoría de cambios
- MFA recomendado para admin
- OWASP Top 10 como referencia

## Decisiones Registradas

| Fecha | Decisión |
|-------|----------|
| 2026-07-21 | Fase 1 = panel admin interno, no e-commerce público |
| 2026-07-21 | Yéminus integración pendiente, no asumir API |
| 2026-07-21 | RBAC con 4 roles |
| 2026-07-21 | Stack: React+TS+Tailwind, Node.js+TS, PostgreSQL |
