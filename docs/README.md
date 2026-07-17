# GRUPO_SECURITY

Repositorio técnico del proyecto de agentes para GRUPO_SECURITY.

## Objetivo

Este repositorio centraliza toda la información de diseño, decisiones, skills, memoria operativa y evolución del sistema de agentes.

## Regla de arquitectura

- La configuración activa de OpenClaw vive en: `~/.openclaw/openclaw.json`
- Los skills, documentos y artefactos del proyecto viven en este repositorio.
- OpenClaw debe consumir skills de este proyecto por rutas absolutas.

## Estructura

- `docs/` → documentación técnica y funcional
- `agents/` → definición de agentes actuales y futuros
- `skills/` → skills locales usados por OpenClaw
- `memory/` → memoria operativa, contexto persistente, hallazgos
- `logs/` → bitácoras manuales o exportadas
- `decisions/` → decisiones de arquitectura y cambios aprobados

## Primer agente del sistema

El primer agente a construir es el **ORQUESTADOR**.

Su función inicial será:

- interpretar solicitudes,
- decidir si resolver con capacidades actuales,
- detectar necesidad de nuevos agentes,
- proponer nuevas especializaciones sin asumir que ya existen.

## Regla de implementación

Nada se agrega a OpenClaw sin quedar primero definido en este repositorio.
