"""
agents/director.py

Agente DIRECTOR — Orquestador principal de la oficina Grupo Security.

Responsabilidades:
  - Recibir solicitudes de Discord
  - Descomponer en tareas atómicas
  - Despachar al agente correcto (handoff)
  - Mantener registro de estado en memoria
  - Hacer cumplir política ZDR

Modelo: call_secure_auto() con fallback Mistral → Qwen
Criticidad: ALTA — si falla, la oficina para
"""
import logging
from typing import Optional, Dict, List

from agents.base_agent import BaseAgent, AgentResponse
from client.openrouter_client import call_secure_auto
from memory.store import MemoryStore
from memory.context_manager import build_safe_messages
from config.prompts import DIRECTOR_SYSTEM_PROMPT
from config.settings import settings

log = logging.getLogger("agents.director")

# Agentes conocidos — se expanden en fases posteriores
KNOWN_AGENTS = {"ARCHITECT_AGENT", "DEV_AGENT", "COPY_AGENT", "QA_AGENT", "MEMORY_AGENT"}

# Palabras clave para enrutamiento rápido (pre-LLM) — reduce tokens consumidos
_ROUTING_HINTS = {
    "ARCHITECT_AGENT": ["sitemap", "arquitectura", "estructura", "wireframe", "página", "flujo", "componente"],
    "DEV_AGENT": ["código", "code", "html", "css", "js", "javascript", "bug", "error", "función", "api"],
    "COPY_AGENT": ["copy", "texto", "contenido", "redactar", "seo", "headline", "descripción", "email"],
}


class DirectorAgent(BaseAgent):
    name = "DIRECTOR"
    system_prompt = DIRECTOR_SYSTEM_PROMPT

    def __init__(self, memory: MemoryStore):
        super().__init__(memory)

    def _quick_route(self, text: str) -> Optional[str]:
        """
        Enrutamiento rápido por palabras clave.
        Si hay match claro, evita llamar al LLM para la decisión de routing.
        Ahorra tokens en solicitudes simples.
        """
        text_lower = text.lower()
        scores: Dict[str, int] = {}
        for agent, keywords in _ROUTING_HINTS.items():
            score = sum(1 for kw in keywords if kw in text_lower)
            if score > 0:
                scores[agent] = score
        if not scores:
            return None
        best = max(scores, key=lambda k: scores[k])
        return best if scores[best] >= 2 else None  # Solo aplica si hay 2+ keywords

    async def handle(
        self,
        user_input: str,
        task_id: Optional[str] = None,
        discord_user: Optional[str] = None,
        channel_id: Optional[str] = None,
        thread_id: Optional[str] = None,
        history: Optional[List[Dict]] = None,
        delegation_depth: int = 0,
    ) -> AgentResponse:
        """
        Procesa una solicitud y decide la acción a tomar.

        Args:
            user_input: Mensaje del usuario de Discord
            task_id: ID de tarea existente (si es seguimiento)
            discord_user: Username de Discord del solicitante
            channel_id: Canal de Discord de origen
            thread_id: Hilo de Discord (si aplica)
            history: Historial corto de la conversación (máx 6 turnos)
            delegation_depth: Nivel de delegación actual (máx settings.max_delegation_depth)

        Returns:
            AgentResponse con acción, mensaje y metadata
        """
        # Guardar solicitud en contexto
        if discord_user:
            await self.memory.set_context(
                self.name, f"last_request_{discord_user}",
                {"input": user_input[:500], "channel": channel_id},  # Truncado por seguridad
            )

        # Guardia de profundidad de delegación
        if delegation_depth >= settings.max_delegation_depth:
            log.warning("[DIRECTOR] Profundidad máxima de delegación alcanzada")
            return AgentResponse(
                action="escalate",
                message=f"⚠️ Límite de delegación alcanzado. Requiere intervención humana.",
                task_id=task_id,
                priority="high",
            )

        # Crear tarea si no existe
        if not task_id:
            task_id = await self.memory.create_task(
                title=user_input[:80],
                description=user_input,
                channel_id=channel_id,
                thread_id=thread_id,
                metadata={"discord_user": discord_user, "delegation_depth": delegation_depth},
            )
            await self.memory.update_task_status(task_id, "en_progreso", self.name)

        # Enrutamiento rápido por keywords (evita tokens LLM en casos simples)
        quick_target = self._quick_route(user_input)

        # Contexto público del proyecto
        public_ctx = await self.get_public_context()

        # Construir mensajes ZDR para el LLM
        messages = build_safe_messages(
            system_prompt=self.system_prompt,
            user_message=(
                f"Solicitud de @{discord_user or 'usuario'} en canal #{channel_id or 'general'}:\n"
                f"{user_input}\n\n"
                f"ID de tarea: {task_id}\n"
                + (f"Agente sugerido por routing rápido: {quick_target}\n" if quick_target else "")
            ),
            history=history,
            context_refs=public_ctx if public_ctx else None,
        )

        # Llamar al LLM vía ruta ZDR
        raw_response = await call_secure_auto(
            messages=messages,
            max_tokens=settings.max_tokens_per_request,
            response_format={"type": "json_object"},
        )

        # Parsear respuesta JSON
        parsed = self._parse_llm_json(raw_response)

        action = parsed.get("action", "clarify")
        target_agent = parsed.get("target_agent")
        message = parsed.get("message", raw_response[:300])
        priority = parsed.get("priority", "medium")
        context_refs = parsed.get("context_refs", [])

        # Validar que el agente destino sea conocido
        if target_agent and target_agent not in KNOWN_AGENTS:
            log.warning("[DIRECTOR] Agente destino desconocido: %s", target_agent)
            target_agent = None
            action = "clarify"

        # Registrar handoff si aplica
        if action == "handoff" and target_agent:
            await self.memory.log_handoff(
                from_agent=self.name,
                to_agent=target_agent,
                task_id=task_id,
                message=message[:300],
                depth=delegation_depth,
            )
            await self.memory.update_task_status(task_id, "en_progreso", target_agent)

        # Guardar decisión si es relevante
        if action in ("handoff", "escalate"):
            await self.memory.save_decision(
                title=f"{action.upper()} → {target_agent or 'humano'}",
                description=message[:300],
                agent=self.name,
                task_id=task_id,
                rationale=f"quick_route={quick_target}, llm_action={action}",
            )

        return AgentResponse(
            action=action,
            message=message,
            task_id=task_id,
            target_agent=target_agent,
            context_refs=context_refs,
            priority=priority,
            raw=raw_response,
        )

    async def get_status_report(self) -> str:
        """Genera reporte de estado formateado para Discord."""
        stats = await self.memory.get_stats()
        tasks_pending = await self.memory.list_tasks(status="pendiente", limit=5)
        tasks_blocked = await self.memory.list_tasks(status="bloqueado", limit=5)

        lines = [
            "**📊 Estado de la Oficina Grupo Security**",
            "",
            f"**Tareas:** {stats.get('tasks', {})}",
            f"**Handoffs registrados:** {stats.get('handoffs_total', 0)}",
            f"**Decisiones archivadas:** {stats.get('decisions_total', 0)}",
        ]

        if tasks_pending:
            lines.append("\n**⏳ Pendientes:**")
            for t in tasks_pending:
                lines.append(f"  • `{t['id']}` — {t['title'][:60]}")

        if tasks_blocked:
            lines.append("\n**🚧 Bloqueadas:**")
            for t in tasks_blocked:
                lines.append(f"  • `{t['id']}` — {t['title'][:60]}")

        return "\n".join(lines)
