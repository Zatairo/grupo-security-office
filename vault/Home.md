# Grupo Security - Centro de Comando

## Navegación Rápida

### [[01-Proyecto/Proyecto-General|Proyecto General]]
Visión, objetivos y fases del proyecto.

### [[docs/architecture|Arquitectura]]
Stack tecnológico, componentes y decisiones de diseño.

### [[docs/data-model|Modelo de Datos]]
Entidades principales y relaciones SQL.

### [[api/api-spec|Especificación API]]
Endpoints REST documentados (OpenAPI 3.0).

### [[02-Agentes/ORQUESTADOR|Orquestador]]
Configuración y rol del agente central.

### [[03-Decisiones/DEC-0001-Arquitectura-Inicial|Decisiones]]
Registro de ADRs (Architecture Decision Records).

### [[05-Handoffs/HANDOFF-LOG|Handoffs]]
Log de transiciones entre agentes.

---

## Estado del Proyecto

| Fase | Estado | Descripción |
|------|--------|-------------|
| Fase 1 | **ACTUAL** | Sistema Interno Modular |
| Fase 2 | Futura | E-commerce Público |
| Fase 3 | Futura | Portal Cliente |

## Stack Actual

- **Frontend:** React + TypeScript + Tailwind CSS
- **Backend:** Node.js + TypeScript (por definir framework)
- **Base de datos:** PostgreSQL
- **Auth:** OAuth2/OIDC + JWT + RBAC
- **Integración ERP:** Yéminus (pendiente confirmación API)

## Última Actualización

- 2026-07-22: Configuración de sincronización GitHub + Obsidian
- 2026-07-21: Arquitectura v1 definida
- 2026-07-21: Modelo de datos SQL creado
- 2026-07-21: API spec OpenAPI 3.0 generada
