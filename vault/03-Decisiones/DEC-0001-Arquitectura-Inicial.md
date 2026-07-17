---
type: decision
decision_id: DEC-0001
project: grupo-security-office
status: approved
owner: direccion
related_task: TASK-8AD4396F
tags:
  - decision
  - arquitectura
  - memoria
  - obsidian
  - sqlite
---

# DEC-0001 — Arquitectura inicial de memoria y documentación

## Contexto

La oficina multiagente de Grupo Security necesita:
- memoria operativa persistente para tareas, handoffs y contexto de agentes
- una base documental navegable por humanos
- cumplimiento de ZDR para datos sensibles

## Decisión

Se adopta una arquitectura dual:
- `data/memory.db` (SQLite) para memoria operativa del sistema
- `vault/` (Obsidian Markdown) para conocimiento durable, decisiones, agentes, proyecto y handoffs resumidos

## Consecuencias

### Positivas

- Mejor trazabilidad técnica y organizacional
- Separación clara entre estado vivo y documentación humana
- Menor riesgo de mezclar datos sensibles con notas de proyecto

### Riesgos

- Duplicidad parcial de información si no se define qué va a SQLite y qué va a Obsidian
- Necesidad futura de una convención clara para publicar handoffs y decisiones desde los agentes hacia el vault

## Enlaces

- [[Home]]
- [[01-Proyecto/Proyecto-General]]
- [[02-Agentes/DIRECTOR]]
