---
type: agent
project: grupo-security-office
agent_name: DIRECTOR
status: legacy
model_route: call_secure_auto
criticality: historical
tags:
  - agente
  - orquestador
  - direccion
  - legacy
---

# DIRECTOR — Implementación Python heredada del ORQUESTADOR

## Estado

DIRECTOR ya no se considera el runtime principal activo del proyecto.

El runtime principal actual está en OpenClaw mediante el agente:

- `orquestador`

El código relacionado con DIRECTOR fue preservado en:

- `legacy_python/agents/director.py`
- `legacy_python/main.py`

## Rol histórico

DIRECTOR fue concebido como implementación Python del orquestador principal de la oficina digital de Grupo Security.

Sus responsabilidades eran:

- recibir solicitudes,
- descomponer tareas,
- asignar prioridad,
- delegar a agentes especializados,
- y mantener trazabilidad operativa.

## Componentes asociados

- `legacy_python/agents/director.py`
- `legacy_python/agents/base_agent.py`
- `legacy_python/main.py`
- `client/openrouter_client.py`
- `memory/store.py`
- `memory/context_manager.py`

## Política y modelo

- Ruta histórica de modelo: `call_secure_auto()`
- Política asociada: ZDR
- Estado actual: referencia técnica e histórica, no flujo operativo principal

## Relación con el runtime actual

El agente OpenClaw `orquestador` reemplaza a DIRECTOR como punto principal de operación.

DIRECTOR debe entenderse como antecedente técnico o implementación alternativa preservada, no como agente activo principal.

## Enlaces

- [[01-Proyecto/Proyecto-General]]
- [[03-Decisiones/DEC-0001-Arquitectura-Inicial]]
- [[05-Handoffs/HANDOFF-LOG]]
