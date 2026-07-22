# Grupo Security - Plataforma Comercial Interna

## Descripción del Proyecto

Sistema web/e-commerce para **Grupo Security**, empresa colombiana de seguridad electrónica con sedes en Pereira, Armenia, Manizales y Cali.

**Servicios:** CCTV, Sistemas de alarma, Control de acceso, Smart Home

## Fases

| Fase | Estado | Descripción |
|------|--------|-------------|
| Fase 1 | **ACTUAL** | Sistema Interno Modular (Panel Admin) |
| Fase 2 | Futura | E-commerce Público |
| Fase 3 | Futura | Portal Cliente |

## Stack Tecnológico

- **Frontend:** React + TypeScript + Tailwind CSS
- **Backend:** Node.js + TypeScript
- **Base de datos:** PostgreSQL
- **Auth:** OAuth2/OIDC + JWT + RBAC
- **Integración ERP:** Yéminus (pendiente confirmación API)

## Estructura del Repositorio

```
GRUPO_SECURITY/
├── vault/                  # Obsidian vault (documentación)
│   ├── Home.md
│   ├── 01-Proyecto/
│   ├── 02-Agentes/
│   ├── 03-Decisiones/
│   ├── 04-Archivos/
│   └── 05-Handoffs/
├── src/                    # Código fuente
│   ├── frontend/           # React + TypeScript
│   └── backend/            # Node.js + TypeScript
├── api/                    # Especificaciones API
│   └── api-spec.yaml       # OpenAPI 3.0
├── docs/                   # Documentación técnica
├── .opencode/              # Agentes y skills
├── skills/                 # Skills del orquestador
├── config/                 # Configuración
├── client/                 # Cliente OpenRouter
├── memory/                 # Memoria persistente
├── legacy_python/          # Código Python legacy
├── AGENTS.md               # Gobernanza de agentes
└── README.md
```

## Configuración de Obsidian

1. Abrir Obsidian
2. File → Open vault → Seleccionar esta carpeta
3. El plugin **obsidian-git** sincroniza automáticamente con GitHub cada 5 minutos

## Roles del Sistema

| Rol | Permisos |
|-----|----------|
| Admin | Acceso total |
| Gerente | Productos, precios, publicación, reportes |
| Operator | Edición limitada, consulta precios |
| Viewer | Solo lectura |

## Integración con OpenClaw

El orquestador en el servidor Ubuntu (10.156.2.39) coordina los agentes:
- **Orchestrator:** Coordinador central
- **Backend:** Desarrollo de API
- **Frontend:** Desarrollo UI
- **Security:** Auditoría de seguridad

## Seguridad

- HTTPS obligatorio
- RBAC con 4 roles
- Contraseñas bcrypt/argon2
- Validación Zod
- OWASP Top 10
- MFA recomendado para admin

## Última Actualización

- 2026-07-22: Configuración GitHub + Obsidian sync
- 2026-07-21: Arquitectura v1 definida
- 2026-07-21: Modelo de datos SQL
- 2026-07-21: API spec OpenAPI 3.0
