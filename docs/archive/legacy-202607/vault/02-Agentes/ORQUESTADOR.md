---
type: agent
project: grupo-security-office
agent_name: ORQUESTADOR
status: active
model_route: call_secure_auto
criticality: high
tags:
  - agente
  - orquestador
  - runtime
---

# ORQUESTADOR — Agente principal en OpenClaw

## Estado

ORQUESTADOR es el agente operativo principal del proyecto GRUPO_SECURITY en OpenClaw.

- Runtime actual: agente `orquestador` configurado en `~/.openclaw/openclaw.json`.
- Workspace oficial: `/home/soporte/proyectos/GRUPO_SECURITY`.
- Skill núcleo: `skills/orchestrator-core/SKILL.md`.

## Rol

- Interpretar solicitudes del proyecto (vía canales integrados: Discord, WhatsApp, etc.).
- Clasificar el tipo de solicitud y su complejidad.
- Decidir si puede resolverse con capacidades actuales.
- Detectar cuándo hace falta definir un nuevo agente o skill especializado.
- Coordinar decisiones apoyándose en la documentación y memoria operativa del proyecto.

## Memoria y documentación asociada

- Arquitectura: `docs/arquitectura/orchestrator-architecture.md`
- Memoria operativa: `docs/memoria/memoria-operativa-orquestador.md`
- Decisiones clave: `docs/decisiones/decisions/0001-orchestrator-setup.md`
- Skill operativo: `skills/orchestrator-core/SKILL.md`

## Relación con código Python legacy

El código Python previo (`legacy_python/`) se considera implementación heredada o alternativa, no runtime principal actual.

- `legacy_python/agents/director.py`
- `legacy_python/main.py`

ORQUESTADOR debe tratar ese código como referencia técnica, no como fuente de verdad operativa.

## Enlaces

- [[01-Proyecto/Proyecto-General]]
- [[03-Decisiones/DEC-0001-Arquitectura-Inicial]]
- [[05-Handoffs/HANDOFF-LOG]]
