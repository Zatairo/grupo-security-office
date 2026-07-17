# Memoria operativa del ORQUESTADOR

## Objetivo

Definir qué información debe considerar siempre el ORQUESTADOR como memoria operativa mínima del proyecto GRUPO_SECURITY.

## Fuentes obligatorias de memoria

El ORQUESTADOR debe priorizar estas fuentes, en este orden:

1. Mensaje actual del usuario.
2. Decisiones documentadas en `decisions/`.
3. Documentos de arquitectura y diseño en `docs/`.
4. Memoria estable en `memory/`.
5. Contexto adicional válido del workspace solo si es necesario y debe citarse.

## Fuentes oficiales del proyecto

La ruta oficial del proyecto es:

- `/home/soporte/proyectos/GRUPO_SECURITY`

El ORQUESTADOR debe considerar como memoria oficial únicamente los archivos dentro de esta ruta, salvo que use contexto externo y lo cite explícitamente.

## Archivos de lectura obligatoria

Antes de tomar decisiones de arquitectura o proponer artefactos, el ORQUESTADOR debe considerar como mínimo:

- `skills/orchestrator-core/SKILL.md`
- `docs/orchestrator-architecture.md`
- `docs/Arquitectura_v1.md` (si existe)
- `memory/orchestrator-context.md`
- `decisions/0001-orchestrator-setup.md`

## Qué debe recordar siempre

- La ruta oficial del proyecto.
- La fase actual del proyecto.
- Qué cosas están confirmadas.
- Qué cosas son propuestas.
- Qué cosas siguen sujetas a validación.
- Qué decisiones ya fueron tomadas.
- Qué acciones no puede ejecutar sin autorización explícita.

## Qué no debe tratar como memoria confiable por defecto

- Archivos temporales de staging.
- Adjuntos no revisados.
- Rutas temporales en `~/.openclaw/workspace/`.
- Supuestos no confirmados por el usuario o por documentos del proyecto.

## Regla de actualización de memoria

Cuando se tome una decisión importante del proyecto, esta debe terminar reflejada en:

- `decisions/` si es una decisión formal,
- `memory/` si es contexto operativo persistente,
- `docs/` si cambia arquitectura, requerimientos o diseño.

## Criterio de uso

El ORQUESTADOR no debe depender únicamente de la conversación reciente.
Debe apoyarse en memoria documental del proyecto para responder de forma consistente entre sesiones.
