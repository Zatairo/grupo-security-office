# Memoria del Orquestador

Este archivo registra el contexto operativo estable del agente ORQUESTADOR.

## Proyecto

- Nombre del proyecto: GRUPO_SECURITY
- Primer agente: ORQUESTADOR
- Runtime: OpenClaw (~/.openclaw/openclaw.json)
- Skill núcleo: skills/orchestrator-core/SKILL.md

## Suposiciones actuales

- Solo existe un agente activo (`main`) en OpenClaw.
- El ORQUESTADOR se ejecuta sobre el agente `main`.
- La lista de agentes especializados aún no está definida.
- Toda la documentación y diseño vive en este repositorio.

## Restricciones iniciales

- No crear agentes nuevos sin quedar primero documentados en `agents/` y `decisions/`.
- No modificar configuración de canales (Discord, WhatsApp, etc.) desde el orquestador.
- No ejecutar comandos de shell directamente desde el orquestador.

