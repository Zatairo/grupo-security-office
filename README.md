# Grupo Security — Oficina Multiagente

Oficina multiagente OpenClaw operada desde Discord para construir el web/e-commerce de Grupo Security.

## Arquitectura

```
Discord
  └── DIRECTOR (orquestador)
        ├── ARCHITECT_AGENT   (fase 2)
        ├── DEV_AGENT         (fase 2)
        ├── COPY_AGENT        (fase 2)
        ├── QA_AGENT          (fase 3)
        └── MEMORY_AGENT      (fase 3)
```

## Setup rápido

```bash
pip install -r requirements.txt
cp .env.example .env   # Completa con tus tokens
python -m agents.director
```

## Restricciones de seguridad

- **ZDR (Zero Data Retention):** Todo prompt pasa por `openrouter_client.py`
- El servidor Ubuntu solo hace orquestación, memoria y coordinación — sin inferencia local
- Datos sensibles de Grupo Security nunca salen del servidor

## Estructura

```
agents/
  director.py          # Agente orquestador principal
  base_agent.py        # Clase base compartida
memory/
  store.py             # Motor de memoria persistente (SQLite + JSON)
  context_manager.py   # Sanitizador ZDR de contexto
client/
  openrouter_client.py # Rutas seguras ZDR
config/
  settings.py          # Configuración centralizada
  prompts.py           # Prompts base de agentes
discord_bot/
  bot.py               # Entrada principal de Discord
  commands.py          # Comandos slash
data/
  memory.db            # SQLite (gitignored)
  context/             # JSONs de contexto por agente
```
