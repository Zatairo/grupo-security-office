# AGENTS.md - Gobernanza y Contexto del Proyecto

## Proyecto: Grupo Security - Plataforma Comercial Interna

### Contexto del Negocio

**Grupo Security** es una empresa colombiana de seguridad electrónica con sedes en Pereira, Armenia, Manizales y Cali. Ofrece:
- CCTV (videovigilancia)
- Sistemas de alarma
- Control de acceso
- Smart Home

**Objetivo general:** Crear una web/e-commerce completa para catálogo, precios, panel administrativo y, en fases posteriores, funciones de compra/cotización y portal cliente.

**ERP existente:** Yéminus (módulos de gestión comercial, logística, inventarios, cotizaciones, pedidos, portal e-commerce). La nueva web debe ser una capa comercial integrada con Yéminus, no un sistema aislado.

---

### Fases del Proyecto

#### Fase 1 (ACTUAL) - Sistema Interno Modular
- Panel administrativo interno
- Gestión de productos, categorías, marcas
- Gestión de precios/listas de precios
- Buscador y filtros internos
- Publicación (visible/no visible)
- Usuarios internos y roles (RBAC)
- Auditoría básica de cambios

#### Fase 2 (FUTURA) - E-commerce Público
- Catálogo público
- Ficha de producto
- Carrito de compras
- Checkout
- Registro/login de clientes
- Historial de pedidos
- Integración ERP (stock, precios, pedidos)
- Pasarela de pago (PCI-DSS)

#### Fase 3 (FUTURA) - Portal Cliente
- Portal de cliente con acceso a cotizaciones
- Seguimiento de pedidos
- Soporte técnico

---

### Arquitectura Comercial v1

| Capa | Tecnología | Estado |
|------|-----------|--------|
| Frontend Admin | React + TypeScript + Tailwind CSS | Por definir |
| Backend API | Node.js/TypeScript (modular) | Por definir |
| Base de datos | PostgreSQL (relacional) | Por definir |
| Auth | OAuth2/OIDC + JWT + RBAC | Por definir |
| Integración ERP | Conector Yéminus | **PENDIENTE** (endpoint 501 hasta confirmar API) |

---

### Modelo de Datos (Entidades Principales)

- **Producto** → categoría, marca, precios, imágenes, estado publicación
- **Categoría** → nombre, descripción, padre (jerarquía)
- **Marca** → nombre, logo, descripción
- **Lista de Precios** → nombre, moneda, vigencia
- **Precio** → producto, lista, valor, moneda
- **Usuario** → nombre, email, contraseña (hash), roles
- **Rol** → nombre, permisos
- **Auditoría** → usuario, acción, entidad, timestamp, cambios

---

### Roles del Sistema (Fase 1)

| Rol | Permisos |
|-----|----------|
| Admin | Acceso total a panel y configuración |
| Gerente | Gestión de productos, precios, publicación, reportes |
| Operator | Gestión de productos (lectura/edición limitada), consulta de precios |
| Viewer | Solo lectura del catálogo interno |

---

### Integración con Yéminus

**Estado:** Pendiente de confirmación técnica y comercial.

**Decisión arquitectónica:** El conector ERP se implementa como endpoint 501 (Not Implemented) hasta que Yéminus confirme:
- API REST disponible
- Entidades integrables (productos, inventario, pedidos, precios)
- Mecanismos de seguridad (OAuth2, API keys, etc.)
- Infraestructura y costos

** NO asumir que hay API CRUD de productos disponible hasta tener confirmación.**

---

### Seguridad Requerida

- HTTPS obligatorio
- Control de acceso con roles (RBAC)
- Contraseñas seguras (bcrypt/argon2)
- Validación de entradas
- Protección OWASP Top 10 (XSS, CSRF, inyección, etc.)
- MFA recomendado para administración
- Auditoría de cambios en entidades críticas

---

## Gobernanza de Agentes

### Acciones PERMITIDAS sin aprobación

- Leer archivos del proyecto
- Proponer diseño de arquitectura
- Generar documentos de especificación
- Sugerir código y estructura
- Buscar información en web
- Crear/modificar archivos de código y documentación
- Ejecutar comandos de desarrollo (npm, git, node, tsc, eslint)

### Acciones que REQUIEREN aprobación explícita

- Ejecutar comandos de sistema (sudo, apt, choco, winget)
- Instalar software o paquetes del sistema
- Abrir puertos o modificar firewall
- Integrar canales externos (Telegram, webhooks, etc.)
- Modificar configuración de seguridad
- Crear credenciales o tokens
- Modificar archivos fuera del workspace del proyecto

### Acciones PROHIBIDAS

- Modificar credenciales existentes
- Almacenar tokens o secretos en texto plano
- Exponer el gateway sin revisión de seguridad
- Ejecutar comandos destructivos (rm -rf, DROP TABLE, etc.)
- Acceder a archivos fuera del proyecto sin permiso
- Modificar configuración del sistema operativo
- Instalar agentes o servicios sin aprobación

---

### Registro de Decisiones

| Fecha | Decisión | Justificación |
|-------|----------|---------------|
| 2026-07-21 | Arquitectura v1: Panel admin interno primero | Fase 1 debe ser funcional antes de e-commerce público |
| 2026-07-21 | Integración Yéminus como dependencia pendiente | No hay confirmación de API disponible |
| 2026-07-21 | RBAC con 4 roles (Admin, Gerente, Operator, Viewer) | Necesidades de uso interno |
| 2026-07-21 | Stack: React + TS + Tailwind (frontend), Node.js + TS (backend) | Consistencia de lenguaje, ecosistema maduro |

---

### Pendientes

- [ ] Confirmar API de Yéminus (respuesta esperada)
- [ ] Definir stack exacto de backend (Express/Fastify/NestJS)
- [ ] Diseñar modelo de datos completo con campos y relaciones
- [ ] Generar especificación OpenAPI detallada
- [ ] Definir flujo de autenticación y autorización
- [ ] Crear prototipo de panel admin
- [ ] Política de seguridad detallada (OWASP checklist)
