"""
agents/base_agent.py

Clase base para todos los agentes de la oficina.
Estandariza: logging, memoria, sanitización ZDR y estructura de respuesta.
"""
import logging
import json
from abc import ABC, abstractmethod
from typing import Optional, Dict, List, Any

from memory.store import MemoryStore
from memory.context_manager import build_safe_messages
from config.settings import settings

log = logging.getLogger("agents.base")


class AgentResponse:
    """Respuesta estructurada estándar de cualquier agente."""

    def __init__(
        self,
        action: str,
        message: str,
        task_id: Optional[str] = None,
        target_agent: Optional[str] = None,
        context_refs: Optional[List[str]] = None,
        priority: str = "medium",
        raw: Optional[str] = None,
    ):
        self.action = action            # handoff|status|clarify|escalate|done
        self.message = message          # Texto legible para Discord
        self.task_id = task_id
        self.target_agent = target_agent
        self.context_refs = context_refs or []
        self.priority = priority
        self.raw = raw                  # Respuesta cruda del LLM (para debug)

    def to_dict(self) -> Dict:
        return {
            "action": self.action,
            "message": self.message,
            "task_id": self.task_id,
            "target_agent": self.target_agent,
            "context_refs": self.context_refs,
            "priority": self.priority,
        }

    def to_discord_embed(self) -> Dict:
        """Formato para enviar como embed de Discord."""
        emoji_map = {"high": "🔴", "medium": "🟡", "low": "🟢"}
        return {
            "title": f"{emoji_map.get(self.priority, '⚪')} [{self.action.upper()}] {self.task_id or ''}",
            "description": self.message,
            "fields": [
                {"name": "Agente destino", "value": self.target_agent or "—", "inline": True},
                {"name": "Prioridad", "value": self.priority, "inline": True},
            ],
        }


class BaseAgent(ABC):
    """Contrato base para todos los agentes de la oficina."""

    name: str = "BASE_AGENT"
    system_prompt: str = ""

    def __init__(self, memory: MemoryStore):
        self.memory = memory
        self.log = logging.getLogger(f"agents.{self.name.lower()}")

    @abstractmethod
    async def handle(self, user_input: str, task_id: Optional[str] = None, **kwargs) -> AgentResponse:
        """Procesa una solicitud y retorna respuesta estructurada."""
        ...

    async def get_public_context(self) -> Dict[str, Any]:
        """Contexto no sensible disponible para inyectar en prompts."""
        return await self.memory.get_all_context(self.name, include_sensitive=False)

    def _parse_llm_json(self, raw: str) -> Dict:
        """Intenta parsear JSON de la respuesta del LLM. Robusto ante markdown fences."""
        # Eliminar ```json ... ``` si el modelo los incluye
        clean = raw.strip()
        if clean.startswith("```"):
            lines = clean.split("\n")
            clean = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
        try:
            return json.loads(clean)
        except json.JSONDecodeError:
            self.log.warning("[%s] No se pudo parsear JSON del LLM. Usando fallback.", self.name)
            return {"action": "clarify", "message": raw, "task_id": None, "target_agent": None, "priority": "low"}
