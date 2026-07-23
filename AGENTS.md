# AGENTS.md - Gobernanza y Contexto del Proyecto

## Proyecto: Grupo Security - Plataforma Comercial Interna

### Contexto del Negocio

**Grupo Security** es una empresa colombiana de seguridad electrónica con sedes en Pereira, Armenia, Manizales y Cali. Ofrece:
- CCTV (videovigilancia)
- Sistemas de alarma
- Control de acceso
- Smart Home

**Objetivo general:** Crear una plataforma comercial interna (panel admin + catálogo) para gestión de productos, precios, inventario y usuarios. En fases posteriores: e-commerce público y portal cliente.

**ERP existente:** Yéminus — integración pendiente de confirmación técnica. No asumir APIs disponibles hasta confirmación explícita.

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

### Stack Técnico (confirmado)

| Capa | Tecnología | Estado |
|------|-----------|--------|
| Frontend Admin | React + TypeScript + Vite + Tailwind CSS | En desarrollo |
| Backend API | NestJS + TypeScript | En desarrollo |
| ORM | Prisma | En desarrollo |
| Base de datos | PostgreSQL | Configurado |
| Auth | JWT en cookie HttpOnly + RBAC | En desarrollo |
| Documentación API | Swagger (OpenAPI) vía `@nestjs/swagger` | Configurado |
| Integración ERP | Conector Yéminus | **PENDIENTE** (endpoint 501 hasta confirmar API) |

---

### Política de Modelos de IA para el Proyecto

Para mantener bajo costo operativo y buen rendimiento, los agentes deben usar esta jerarquía de modelos:

| Prioridad | Modelo | Proveedor | Uso |
|-----------|--------|-----------|-----|
| Principal | Mistral Small 4 | OpenRouter | Tareas normales: refactor, lectura, análisis, scaffolding |
| Fallback 1 | Qwen3 35B A3B | OpenRouter | Cuando el principal no esté disponible |
| Fallback 2 | Nemotron 3 Nano 30B A3B | OpenRouter | Último recurso |
| Reservado | Claude / GPT-4.x / GPT-5 / modelos equivalentes | — | Solo con autorización explícita del usuario |

**Reglas:**
- No usar modelos costosos o premium (Claude, GPT-4.x, GPT-5 o equivalentes) para tareas normales.
- Modelos grandes reservados para casos excepcionales autorizados por el usuario.
- Esta política aplica a todos los agentes que operen en este proyecto.

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

**No asumir que hay API CRUD de productos disponible hasta tener confirmación.**

---

### Seguridad Requerida

- HTTPS obligatorio
- Control de acceso con roles (RBAC)
- Contraseñas seguras (bcrypt/argon2)
- Validación de entradas (class-validator + whitelist)
- Protección OWASP Top 10 (XSS, CSRF, inyección, etc.) con Helmet
- JWT en cookie HttpOnly (no localStorage)
- MFA recomendado para administración
- Auditoría de cambios en entidades críticas

---

### Estructura del Proyecto

```
grupo-security-office/
├── src/
│   ├── backend/               # NestJS API
│   │   ├── prisma/            # Schema + seeds
│   │   └── src/
│   │       ├── modules/       # Módulos por dominio (auth, users, roles, products, etc.)
│   │       ├── common/        # Guards, decorators, interceptors, filters
│   │       └── prisma/        # Servicio Prisma
│   └── frontend/              # React + Vite + Tailwind
│       └── src/
│           ├── components/    # Componentes compartidos
│           ├── pages/         # Páginas del panel
│           ├── services/      # Llamadas API
│           └── stores/        # Estado (Zustand u otro)
├── .env.example               # Variables de entorno de referencia
└── AGENTS.md                  # Este archivo
```

---

### Convenciones de Código

- **No añadir comentarios** a menos que el código sea crítico y no obvio.
- Seguir patrones existentes del código base (misma estructura de carpetas, naming, estilos).
- No asumir librerías disponibles; verificar `package.json` antes de importar.
- Backend: módulos NestJS con service + controller + dto + module.
- Frontend: componentes funcionales con hooks, tipado estricto.
- Validación en DTOs con `class-validator` + decoradores Swagger.

---

## Gobernanza de Agentes

### Rol del Agente

**Agente de desarrollo y refactor.** No eres un agente de automatización ni de producción. Tu función es ayudar a escribir, leer, analizar y refactorizar código dentro del proyecto.

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
- Añadir integración de IA al producto (chatbots, asistentes, etc.)
- Modificar CI/CD, infraestructura o scripts de sistema

### Acciones PROHIBIDAS

- Modificar credenciales existentes
- Almacenar tokens o secretos en texto plano
- Exponer el gateway sin revisión de seguridad
- Ejecutar comandos destructivos (rm -rf, DROP TABLE, etc.)
- Acceder a archivos fuera del proyecto sin permiso
- Modificar configuración del sistema operativo
- Instalar agentes o servicios sin aprobación
- Tocar `.env` reales o secretos

---

### Registro de Decisiones

| Fecha | Decisión | Justificación |
|-------|----------|---------------|
| 2026-07-21 | Arquitectura v1: Panel admin interno primero | Fase 1 debe ser funcional antes de e-commerce público |
| 2026-07-21 | Integración Yéminus como dependencia pendiente | No hay confirmación de API disponible |
| 2026-07-21 | RBAC con 4 roles (Admin, Gerente, Operator, Viewer) | Necesidades de uso interno |
| 2026-07-21 | Stack: React + TS + Vite + Tailwind (frontend), NestJS + Prisma (backend) | Stack definido y en desarrollo |
| 2026-07-21 | Política de modelos: Mistral Small 4 como principal | Priorizar bajo costo y buen rendimiento; evitar modelos premium sin autorización |

---

### Reglas Operativas de Ejecución

#### Flujo obligatorio antes de modificar código
1. Leer primero los archivos relevantes.
2. Resumir el problema detectado.
3. Proponer un plan corto de cambios.
4. Esperar aprobación si el cambio afecta arquitectura, múltiples módulos o dependencias.
5. Ejecutar cambios pequeños y trazables.
6. Validar con pruebas o build local antes de cerrar.

#### Restricciones de alcance
- No modificar archivos fuera de `src/backend`, `src/frontend`, `prisma`, o documentación del proyecto, salvo aprobación explícita.
- No crear ni borrar dependencias en `package.json` sin aprobación explícita.
- No modificar configuraciones globales del sistema, Git, Node, npm o OpenCode fuera del workspace.
- No editar `.env`, `.env.local`, `.env.production` ni secretos reales.

#### Política de ramas y cambios
- Para refactors grandes, proponer trabajar sobre una rama dedicada.
- No hacer cambios masivos en muchos archivos sin explicar primero el motivo.
- Preferir cambios incrementales y revisables.

#### Validación mínima obligatoria
- Frontend: validar al menos tipado, build y errores principales de lint si aplica.
- Backend: validar al menos compilación, tipado y consistencia de módulos/DTOs.
- Si no se puede validar, indicar exactamente qué quedó sin verificar.

#### Estilo de trabajo del agente
- No improvisar APIs no confirmadas.
- No inventar estructura de datos no respaldada por el código o la documentación del proyecto.
- Si falta contexto crítico, preguntar primero.
- Priorizar soluciones simples, mantenibles y compatibles con el stack actual.

---

### Pendientes

- [ ] Confirmar API de Yéminus (respuesta esperada)
- [ ] Diseñar modelo de datos completo con campos y relaciones
- [ ] Definir flujo de autenticación y autorización detallado
- [ ] Política de seguridad detallada (OWASP checklist)
- [ ] Pruebas unitarias e integración