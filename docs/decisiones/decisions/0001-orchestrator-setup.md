# Decisión 0001 - Setup inicial del ORQUESTADOR

## Fecha

- 2026-07-16

## Alcance

Definir la estructura base del proyecto GRUPO_SECURITY y conectar el skill `orchestrator-core` al agente `main` de OpenClaw.

## Decisión

1. Crear el repositorio `/home/soporte/proyectos/GRUPO_SECURITY` con estructura:
   - docs/, agents/, skills/, memory/, logs/, decisions/
2. Definir el skill `skills/orchestrator-core/SKILL.md` como cerebro base del ORQUESTADOR.
3. Apuntar `agents.defaults.skills` en `~/.openclaw/openclaw.json` a:
   - `/home/soporte/proyectos/GRUPO_SECURITY/skills/orchestrator-core`

## Razón

- Mantener separada la configuración del runtime (`~/.openclaw`) de la arquitectura del proyecto.
- Poder versionar decisiones y cambios de agentes en Git.
- Facilitar auditoría técnica de la evolución del sistema de agentes.

## Estado

- Aplicado y verificado.
