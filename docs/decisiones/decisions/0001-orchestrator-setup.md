# Decisión 0001 - Setup inicial del ORQUESTADOR

## Fecha

- 2026-07-16

## Alcance

Definir la estructura base del proyecto GRUPO_SECURITY y conectar el skill `orchestrator-core` al entorno de OpenClaw para el agente `orquestador`.

## Decisión

1. Crear el repositorio `/home/soporte/proyectos/GRUPO_SECURITY` con estructura base de documentación, memoria y soporte operativo.
2. Definir el skill `orchestrator-core` como base operativa del agente ORQUESTADOR en OpenClaw.
3. Configurar `~/.openclaw/openclaw.json` para usar el workspace:
   - `/home/soporte/proyectos/GRUPO_SECURITY`
4. Mantener el código Python heredado en `legacy_python/` como referencia técnica e histórica, no como runtime principal actual.

## Razón

- Mantener separada la configuración del runtime (`~/.openclaw`) de la arquitectura del proyecto.
- Poder versionar decisiones y cambios de agentes en Git.
- Facilitar auditoría técnica de la evolución del sistema de agentes.

## Estado

- Aplicado y verificado.
- Runtime principal actual: agente `orquestador` en OpenClaw.
- Código Python heredado preservado en `legacy_python/` como implementación histórica y no operativa principal.
