# AGENT_TEAM.md — Matriz de Responsabilidades y Escalamiento

> Equipo de agentes del proyecto **FINANZAS 1:1**. Documento mantenido por `finance-orchestrator`.

## Resumen del equipo

| Agente | Archivo | Modelo | Color | Modo |
|--------|---------|--------|-------|------|
| `finance-orchestrator` | `.opencode/agents/finance-orchestrator.md` | nemotron-3-super-120b | accent | Ejecución (primario) |
| `solution-architect` | `.opencode/agents/solution-architect.md` | nemotron-3-super-120b | blue | **Solo lectura** |
| `data-migration-engineer` | `.opencode/agents/data-migration-engineer.md` | nemotron-3-super-120b | green | Implementación |
| `backend-engineer` | `.opencode/agents/backend-engineer.md` | nemotron-3-super-120b | yellow | Implementación |
| `frontend-pwa-engineer` | `.opencode/agents/frontend-pwa-engineer.md` | nemotron-3-super-120b | magenta | Implementación |
| `ai-integration-engineer` | `.opencode/agents/ai-integration-engineer.md` | nemotron-3-super-120b | cyan | Implementación |
| `qa-security-reviewer` | `.opencode/agents/qa-security-reviewer.md` | nemotron-3-super-120b | red | **Independiente** |
| `devops-release-engineer` | `.opencode/agents/devops-release-engineer.md` | nemotron-3-super-120b | orange | Implementación |

## Matriz de responsabilidades por dominio

| Dominio | Owner principal | Colaboradores | Revisor (QA) |
|---------|-----------------|---------------|--------------|
| **Coordinación general** | finance-orchestrator | — | — |
| **Arquitectura, ADR, contratos** | solution-architect | finance-orchestrator | qa-security-reviewer |
| **Modelo datos, migraciones, Excel** | data-migration-engineer | solution-architect, backend-engineer | qa-security-reviewer |
| **Backend API, auth, dominio** | backend-engineer | data-migration-engineer, ai-integration-engineer | qa-security-reviewer |
| **Frontend PWA, UX, offline** | frontend-pwa-engineer | backend-engineer (contratos), ai-integration-engineer (bandeja) | qa-security-reviewer |
| **IA/OCR/Ingestión/WhatsApp** | ai-integration-engineer | backend-engineer (interfaces), frontend-pwa-engineer (bandeja) | qa-security-reviewer |
| **Calidad, seguridad, tests** | qa-security-reviewer | (todos, revisión cruzada) | — (independiente) |
| **Infra, CI/CD, deploy, runbooks** | devops-release-engineer | backend-engineer, frontend-pwa-engineer | qa-security-reviewer |

## Permisos por agente (resumen ejecutivo)

| Agente | Lee todo | Escribe código | Escribe docs | Ejecuta tests | Despliega | Comandos destructivos |
|--------|----------|----------------|--------------|---------------|-----------|----------------------|
| finance-orchestrator | ✅ | ❌ | ✅ (coordinación) | ❌ | ❌ | ❌ |
| solution-architect | ✅ | ❌ | ✅ (ADR/arquitectura) | ❌ | ❌ | ❌ |
| data-migration-engineer | ✅ | ✅ (esquemas/migraciones/scripts) | ✅ | ✅ (dev) | ❌ | ❌ (prod) |
| backend-engineer | ✅ | ✅ (`src/backend/**`) | ✅ | ✅ | ❌ | ❌ |
| frontend-pwa-engineer | ✅ | ✅ (`src/frontend/**`) | ✅ | ✅ | ❌ | ❌ |
| ai-integration-engineer | ✅ | ✅ (módulos ingestion/ai) | ✅ | ✅ | ❌ | ❌ |
| qa-security-reviewer | ✅ | ✅ (tests/reportes/correcciones solicitadas) | ✅ | ✅ | ❌ | ❌ |
| devops-release-engineer | ✅ | ✅ (infra/Docker/CI) | ✅ | ✅ (local) | ⚠️ (con aprobación) | ❌ |

**Leyenda**: ✅ = Permitido | ❌ = Prohibido | ⚠️ = Con aprobación humana explícita

## Escalamiento y resolución de conflictos

### Nivel 1: Conflicto técnico entre subagentes
1. Subagentes reportan a `finance-orchestrator` con evidencia.
2. Orquestador analiza, propone solución o pide ADR a `solution-architect`.
3. Decisión documentada en `docs/DECISIONS.md` + ADR si es arquitectura.

### Nivel 2: Bloqueo de fase (Gate)
1. Orquestador detecta que criterios de puerta no se cumplen.
2. Documenta en `docs/PROJECT_STATUS.md`: qué falta, riesgos, opciones.
3. Solicita aprobación al usuario con máx. 3 opciones + recomendación.

### Nivel 3: Hallazgo crítico de seguridad (qa-security-reviewer)
1. QA emite hallazgo **Bloqueante** o **Alto** en reporte.
2. Orquestador **detiene** trabajo afectado inmediatamente.
3. Asigna corrección a owner del módulo + plazo.
4. QA valida fix antes de reabrir gate.

### Nivel 4: Decisión de producto / alcance
1. Orquestador presenta opciones al usuario (máx. 3).
2. Usuario decide → Orquestador documenta en ADR/DECISIONS.
3. Equipo alinea y continúa.

## Propiedad temporal de archivos (Locks)

El orquestador mantiene registro en `docs/PROJECT_STATUS.md` sección "Active Locks":

```
## Active Locks
- `src/backend/models/transaction.py` → backend-engineer (hasta 2026-01-20)
- `src/frontend/pages/ValidationInbox.tsx` → frontend-pwa-engineer (hasta 2026-01-22)
- `docs/decisions/0003-orm-choice.md` → solution-architect (hasta 2026-01-15)
```

Reglas:
- Un archivo = un owner a la vez.
- Lock expira en fecha indicada o al completar tarea.
- Orquestador puede revocar/traspasar lock con notificación.
- Conflictos de lock → Nivel 1 escalamiento.

## Comunicación entre agentes

### Formato orden de delegación (orquestador → subagente)
```markdown
## Orden: [ID único, ej. 1.3.2]
**Agente**: backend-engineer
**Objetivo**: Implementar endpoint POST /transactions con idempotency key
**Archivos permitidos**: src/backend/modules/transactions/** , tests/backend/transactions/**
**Archivos prohibidos**: src/backend/modules/auth/**, src/frontend/**, infra/**
**Entradas**: ADR-0003 (ORM), OpenAPI spec, esquema BD migrado
**Salida esperada**: Endpoint funcional + tests + OpenAPI actualizado
**Criterios aceptación**:
  - POST 201 con Idempotency-Key header
  - Reintento misma key → 200 con mismo response (no duplicado)
  - Validación splits suma = total
  - Audit log escrito
**Comandos validación**: pytest tests/backend/transactions/test_create.py -v
**Riesgos**: Race condition splits concurrente → usar advisory lock o optimistic lock
```

### Formato reporte subagente (subagente → orquestador)
```markdown
## Reporte: [ID orden]
**Estado**: completado | bloqueado | requiere decisión
**Archivos modificados**:
  - src/backend/modules/transactions/service.py
  - src/backend/modules/transactions/router.py
  - tests/backend/transactions/test_create.py
**Decisiones tomadas**:
  - Usar advisory lock PG `pg_advisory_xact_lock(hash(idempotency_key))` para concurrencia
  - Validación splits en service, no solo BD
**Pruebas ejecutadas**:
  - pytest tests/backend/transactions/test_create.py -v → 12 passed
  - pytest tests/backend/transactions/test_idempotency.py -v → 5 passed
**Riesgos/deuda**:
  - Advisory lock requiere conexión PG persistente (pool mode transaction ok)
  - Falta test de carga concurrente (TODO: fase 6)
**Siguiente acción**: Orquestador valida y cierra orden. QA revisa en Gate 3.
```

## Contacto y disponibilidad

Todos los agentes operan en la misma sesión de trabajo. La comunicación es síncrona vía delegación de tareas del orquestador. No hay canales async externos (Slack, email) para coordinación técnica.

## Historial de cambios

| Fecha | Cambio | Autor |
|-------|--------|-------|
| 2026-09-01 | Creación inicial equipo FINANZAS 1:1 | finance-orchestrator |