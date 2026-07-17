Grupo Security — ORQUESTADOR sobre OpenClaw
Proyecto de oficina multiagente para Grupo Security con runtime principal en OpenClaw usando el agente orquestador y el skill skills/orchestrator-core.

Arquitectura
Runtime principal: OpenClaw + agente orquestador.

text
Discord / canales integrados
  └── ORQUESTADOR
        ├── skills/orchestrator-core/              # Núcleo operativo y reglas de decisión
        ├── docs/arquitectura/                     # Arquitectura detallada del sistema
        ├── docs/memoria/                          # Memoria operativa del proyecto
        ├── config/                               # Configuración y prompts
        ├── client/                               # Cliente OpenRouter / políticas de llamada
        ├── memory/                               # Soporte de memoria persistente
        └── legacy_python/                        # Implementación Python histórica / no principal
Estado actual
El runtime operativo actual está definido en OpenClaw mediante el agente orquestador, con workspace en /home/soporte/proyectos/GRUPO_SECURITY y agentDir separado en ~/.openclaw/agents/orquestador/agent.

El skill operativo del ORQUESTADOR está en skills/orchestrator-core/SKILL.md, alineado con la estructura esperada por OpenClaw.

El código Python previo se conserva en legacy_python/ como referencia técnica e histórica, pero no representa el runtime principal actual del sistema.

Setup rápido
Runtime principal (OpenClaw)
La configuración principal vive en ~/.openclaw/openclaw.json, donde el agente operativo es orquestador.

Puntos clave del runtime:

agentId: orquestador

name: ORQUESTADOR

workspace: /home/soporte/proyectos/GRUPO_SECURITY

skill principal: skills/orchestrator-core/SKILL.md

Código Python legacy
Este código se conserva como implementación alternativa / histórica:

bash
pip install -r requirements.txt
python legacy_python/main.py
Ese flujo no debe considerarse el runtime principal mientras OpenClaw siga siendo la vía operativa activa del proyecto.

Estructura
text
skills/
  orchestrator-core/
    SKILL.md                    # Skill operativo del ORQUESTADOR

docs/
  00-INDEX.md
  AGENTS.md
  IDENTITY.md
  README.md
  SOUL.md
  TOOLS.md
  USER.md
  arquitectura/
    orchestrator-architecture.md
    README.md
  bitacora/
  decisiones/
    decisions/
      0001-orchestrator-setup.md
  memoria/
    memoria-operativa-orquestador.md
    orchestrator-context.md
    README.md
  procedimientos/
  reuniones/
  seguimiento/

config/
  settings.py                   # Configuración centralizada
  prompts.py                    # Prompts base y reglas

client/
  openrouter_client.py          # Cliente OpenRouter y rutas seguras

memory/
  store.py                      # Persistencia de memoria
  context_manager.py            # Manejo y sanitización de contexto

legacy_python/
  agents/                       # Implementación previa de DirectorAgent y base_agent
  discord_bot/                  # Bot Discord legado
  main.py                       # Entrada Python legacy

data/
logs/
vault/
  01-Proyecto/
  02-Agentes/
  03-Decisiones/
  05-Handoffs/
Criterio documental
Este repositorio debe reflejar primero lo que realmente está funcionando en producción o en operación activa: OpenClaw, el agente orquestador, su skill operativo y la documentación asociada.

Todo componente que no sea parte del runtime principal debe documentarse como legacy, experimental o futuro, evitando presentarlo como arquitectura activa.

Seguridad y contexto
La política ZDR y los componentes de sanitización/contexto siguen presentes en el código del proyecto, por lo que cualquier limpieza futura debe decidirse con validación técnica y no solo documental.

Mientras existan context_manager.py, openrouter_client.py, prompts y flags de configuración asociados, ZDR debe tratarse como parte vigente del diseño del repositorio, aunque algunas piezas estén en código legacy.

Próximos ajustes recomendados
Actualizar docs/AGENTS.md para indicar que el agente operativo es ORQUESTADOR y que DirectorAgent pertenece a legacy_python/.

Corregir docs/decisiones/decisions/0001-orchestrator-setup.md para reflejar que el runtime principal usa orquestador, no main.

Revisar referencias internas en documentación para que todas apunten a rutas reales bajo docs/arquitectura/ y docs/memoria/.
