# AGENTS.md — Proyecto Grupo Security

## Identidad del Proyecto

- **Proyecto:** Plataforma comercial interna de Grupo Security
- **Propósito:** Panel administrativo + catálogo de productos/servicios
- **Stack Backend:** NestJS + Prisma ORM + PostgreSQL
- **Autenticación:** JWT en cookie HttpOnly, RBAC por roles
- **Stack Frontend:** React + TypeScript + Vite + Tailwind CSS
- **Integraciones:** ERP Yéminus — pendiente de definir; no asumir APIs no confirmadas

## Política de Modelos (Costo/Beneficio)

| Rol | Modelo | ID en OpenRouter |
|-----|--------|-----------------|
| **Principal** (tareas normales) | Mistral Small 4 | `mistralai/mistral-small-2603` |
| **Fallback 1 / small_model** (exploración, búsquedas) | Qwen3 35B A3B | `qwen/qwen3.6-35b-a3b` |
| **Fallback 2** (manual, solo si los anteriores fallan) | Nemotron 3 Nano 30B A3B | `nvidia/nemotron-3-nano-30b-a3b` |

**Reglas de uso:**
- Usar el modelo principal para tareas normales de refactor, lectura, análisis y scaffolding.
- No usar Claude, GPT-4.x, GPT-5 ni modelos equivalentes/premium para tareas habituales.
- Reservar modelos grandes o costosos solo para casos excepcionales y con autorización explícita del usuario.
- El `small_model` (`qwen/qwen3.6-35b-a3b`) se usa automáticamente para agentes tipo `explore` y tareas ligeras.

## Reglas del Proyecto

1. **Seguridad:** No tocar secretos, claves ni archivos `.env` reales. No exponer credenciales en código.
2. **Infraestructura:** No modificar CI/CD, scripts de sistema, Docker, despliegue ni configuraciones de infraestructura.
3. **IA en el producto:** No agregar integraciones de inteligencia artificial al producto sin aprobación explícita.
4. **Integraciones externas:** ERP Yéminus está en estado "pendiente". No implementar ni asumir APIs, schemas ni lógica que dependan de servicios no confirmados.
5. **Rol del agente:** Actuar como **agente de desarrollo y refactor**. No operar como agente de automatización, DevOps ni producción.
6. **Convenciones de código:** Seguir estilos existentes del proyecto. No añadir comentarios superfluos. Usar las librerías y patrones ya presentes en el código base.
7. **Commits:** No hacer commit sin autorización explícita del usuario.
8. **Stack permitido:** Usar exclusivamente las tecnologías listadas arriba. No introducir nuevas dependencias, frameworks o herramientas sin consultar.
9. **Código limpio:** Escribir código funcional, tipado (TypeScript), sin bloques comentados ni debugging leftovers.

## Flujo de Trabajo

1. Leer y entender el código existente antes de proponer cambios.
2. Preguntar antes de tomar decisiones arquitectónicas importantes.
3. Verificar con `npm run lint` y `npm run typecheck` (o equivalentes) antes de dar tareas por terminadas.
4. Mantener este archivo actualizado cuando cambien reglas o stack del proyecto.
