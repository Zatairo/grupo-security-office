"""
memory/store.py

Motor de memoria persistente del DIRECTOR.
Usa SQLite async para persistir:
  - Tareas (task_queue)
  - Contexto de agentes (agent_context)
  - Decisiones aprobadas (decisions)
  - Log de handoffs (handoff_log)

Todo dato sensible de Grupo Security se almacena aquí,
nunca en los prompts enviados a OpenRouter.
"""
import aiosqlite
import json
import logging
import os
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any

from config.settings import settings

log = logging.getLogger("memory.store")

SCHEMA = """
CREATE TABLE IF NOT EXISTS tasks (
    id          TEXT PRIMARY KEY,
    title       TEXT NOT NULL,
    description TEXT,
    status      TEXT DEFAULT 'pendiente',  -- pendiente|en_progreso|completado|bloqueado
    priority    TEXT DEFAULT 'medium',
    agent       TEXT,                       -- agente asignado
    thread_id   TEXT,                       -- hilo Discord
    channel_id  TEXT,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL,
    metadata    TEXT DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS agent_context (
    id          TEXT PRIMARY KEY,
    agent_name  TEXT NOT NULL,
    key         TEXT NOT NULL,
    value       TEXT NOT NULL,             -- JSON serializado
    is_sensitive INTEGER DEFAULT 0,        -- 1 = nunca sale del servidor
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL,
    UNIQUE(agent_name, key)
);

CREATE TABLE IF NOT EXISTS decisions (
    id          TEXT PRIMARY KEY,
    title       TEXT NOT NULL,
    description TEXT,
    agent       TEXT,
    task_id     TEXT,
    rationale   TEXT,
    created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS handoff_log (
    id          TEXT PRIMARY KEY,
    from_agent  TEXT NOT NULL,
    to_agent    TEXT NOT NULL,
    task_id     TEXT,
    message     TEXT,
    depth       INTEGER DEFAULT 0,
    created_at  TEXT NOT NULL
);
"""


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _gen_id(prefix: str) -> str:
    import uuid
    return f"{prefix}-{uuid.uuid4().hex[:8].upper()}"


class MemoryStore:
    """Interfaz async de acceso a la memoria persistente."""

    def __init__(self, db_path: str = settings.memory_db_path):
        self.db_path = db_path
        os.makedirs(os.path.dirname(db_path), exist_ok=True)

    async def init(self):
        """Inicializa el esquema si no existe."""
        async with aiosqlite.connect(self.db_path) as db:
            await db.executescript(SCHEMA)
            await db.commit()
        log.info("[memory] Base de datos inicializada: %s", self.db_path)

    # ------------------------------------------------------------------ TASKS

    async def create_task(
        self,
        title: str,
        description: str = "",
        priority: str = "medium",
        agent: Optional[str] = None,
        thread_id: Optional[str] = None,
        channel_id: Optional[str] = None,
        metadata: Optional[Dict] = None,
    ) -> str:
        task_id = _gen_id("TASK")
        now = _now()
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                """INSERT INTO tasks
                   (id, title, description, status, priority, agent,
                    thread_id, channel_id, created_at, updated_at, metadata)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
                (
                    task_id, title, description, "pendiente", priority,
                    agent, thread_id, channel_id, now, now,
                    json.dumps(metadata or {}),
                ),
            )
            await db.commit()
        log.info("[memory] Tarea creada: %s — %s", task_id, title)
        return task_id

    async def update_task_status(self, task_id: str, status: str, agent: Optional[str] = None):
        now = _now()
        async with aiosqlite.connect(self.db_path) as db:
            if agent:
                await db.execute(
                    "UPDATE tasks SET status=?, agent=?, updated_at=? WHERE id=?",
                    (status, agent, now, task_id),
                )
            else:
                await db.execute(
                    "UPDATE tasks SET status=?, updated_at=? WHERE id=?",
                    (status, now, task_id),
                )
            await db.commit()
        log.debug("[memory] Tarea %s → %s", task_id, status)

    async def get_task(self, task_id: str) -> Optional[Dict]:
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            async with db.execute("SELECT * FROM tasks WHERE id=?", (task_id,)) as cur:
                row = await cur.fetchone()
        return dict(row) if row else None

    async def list_tasks(
        self,
        status: Optional[str] = None,
        agent: Optional[str] = None,
        limit: int = 20,
    ) -> List[Dict]:
        query = "SELECT * FROM tasks WHERE 1=1"
        params: list = []
        if status:
            query += " AND status=?"
            params.append(status)
        if agent:
            query += " AND agent=?"
            params.append(agent)
        query += " ORDER BY created_at DESC LIMIT ?"
        params.append(limit)
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            async with db.execute(query, params) as cur:
                rows = await cur.fetchall()
        return [dict(r) for r in rows]

    # -------------------------------------------------------------- CONTEXT

    async def set_context(
        self,
        agent_name: str,
        key: str,
        value: Any,
        is_sensitive: bool = False,
    ):
        """Guarda o actualiza un valor de contexto para un agente."""
        now = _now()
        ctx_id = _gen_id("CTX")
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                """INSERT INTO agent_context
                   (id, agent_name, key, value, is_sensitive, created_at, updated_at)
                   VALUES (?,?,?,?,?,?,?)
                   ON CONFLICT(agent_name, key)
                   DO UPDATE SET value=excluded.value,
                                 is_sensitive=excluded.is_sensitive,
                                 updated_at=excluded.updated_at""",
                (
                    ctx_id, agent_name, key,
                    json.dumps(value), int(is_sensitive), now, now,
                ),
            )
            await db.commit()

    async def get_context(self, agent_name: str, key: str) -> Optional[Any]:
        async with aiosqlite.connect(self.db_path) as db:
            async with db.execute(
                "SELECT value FROM agent_context WHERE agent_name=? AND key=?",
                (agent_name, key),
            ) as cur:
                row = await cur.fetchone()
        return json.loads(row[0]) if row else None

    async def get_all_context(self, agent_name: str, include_sensitive: bool = False) -> Dict[str, Any]:
        """Recupera todo el contexto de un agente. Excluye sensibles por defecto."""
        query = "SELECT key, value, is_sensitive FROM agent_context WHERE agent_name=?"
        params: list = [agent_name]
        if not include_sensitive:
            query += " AND is_sensitive=0"
        async with aiosqlite.connect(self.db_path) as db:
            async with db.execute(query, params) as cur:
                rows = await cur.fetchall()
        return {row[0]: json.loads(row[1]) for row in rows}

    # ------------------------------------------------------------ DECISIONS

    async def save_decision(
        self,
        title: str,
        description: str = "",
        agent: Optional[str] = None,
        task_id: Optional[str] = None,
        rationale: str = "",
    ) -> str:
        decision_id = _gen_id("DEC")
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                """INSERT INTO decisions
                   (id, title, description, agent, task_id, rationale, created_at)
                   VALUES (?,?,?,?,?,?,?)""",
                (decision_id, title, description, agent, task_id, rationale, _now()),
            )
            await db.commit()
        return decision_id

    # -------------------------------------------------------------- HANDOFF LOG

    async def log_handoff(
        self,
        from_agent: str,
        to_agent: str,
        task_id: Optional[str] = None,
        message: str = "",
        depth: int = 0,
    ):
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                """INSERT INTO handoff_log
                   (id, from_agent, to_agent, task_id, message, depth, created_at)
                   VALUES (?,?,?,?,?,?,?)""",
                (_gen_id("HO"), from_agent, to_agent, task_id, message, depth, _now()),
            )
            await db.commit()
        log.debug("[memory] Handoff registrado: %s → %s (depth=%d)", from_agent, to_agent, depth)

    # ---------------------------------------------------------- STATS

    async def get_stats(self) -> Dict[str, Any]:
        async with aiosqlite.connect(self.db_path) as db:
            async with db.execute("SELECT status, COUNT(*) FROM tasks GROUP BY status") as cur:
                task_counts = {row[0]: row[1] for row in await cur.fetchall()}
            async with db.execute("SELECT COUNT(*) FROM handoff_log") as cur:
                handoff_count = (await cur.fetchone())[0]
            async with db.execute("SELECT COUNT(*) FROM decisions") as cur:
                decision_count = (await cur.fetchone())[0]
        return {
            "tasks": task_counts,
            "handoffs_total": handoff_count,
            "decisions_total": decision_count,
        }
