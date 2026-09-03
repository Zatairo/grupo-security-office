# ADR 0001: Persistencia — SQLAlchemy 2.x + Pydantic v2

**Fecha**: 2026-09-01
**Estado**: Aprobado
**Decisores**: Usuario, finance-orchestrator, solution-architect

## Contexto

Se requiere definir el stack de persistencia para el backend FastAPI. Las opciones evaluadas fueron:

1. **SQLModel** — Une SQLAlchemy + Pydantic, menos boilerplate, tipos compartidos FE/BE
2. **SQLAlchemy 2.x + Pydantic v2 manual** — Control total, separación clara de responsabilidades, ecosistema maduro
3. **Solo SQLAlchemy 2.x (Core/ORM) + dicts** — Máximo control, sin validación automática de entrada

## Decisión

**Usar SQLAlchemy 2.x como ORM y Pydantic v2 para contratos/validación. No usar SQLModel.**

## Justificación

- **SQLAlchemy 2.x** es el ORM más maduro del ecosistema Python, con tipado nativo completo, migración Alembic nativa, y control total sobre queries complejas (CTEs, window functions, JSONB, advisory locks para idempotencia).
- **Pydantic v2** (Rust-backed) proporciona validación de alto rendimiento para request/response, serialización, y contratos OpenAPI. Separar ORM de contratos evita acoplamiento y permite evolucionar cada capa independientemente.
- **SQLModel** introduce abstracciones que limitan casos avanzados (composite PKs, advisory locks, CTEs complejos, partition tables) y tiene comunidad menor. Para un dominio financiero con reglas estrictas (sumas exactas, concurrencia, auditoría), el control total de SQLAlchemy + Pydantic es preferible.

## Consecuencias

- Modelos SQLAlchemy en `src/backend/models/`
- Esquemas Pydantic en `src/backend/schemas/` (request/response)
- Repositorios encapsulan queries SQLAlchemy
- Servicios usan Pydantic para validación de entrada y serialización de salida
- Alembic para migraciones (funciona nativamente con SQLAlchemy)
- Mayor boilerplate inicial vs SQLModel, pero menor deuda técnica a mediano plazo

## Seguimiento

- Crear modelo base y mixins comunes (timestamp, soft delete, audit)
- Definir patrón repositorio/servicio
- Documentar convención naming (snake_case BD, camelCase Pydantic)