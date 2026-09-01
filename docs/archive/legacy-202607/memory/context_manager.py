"""
memory/context_manager.py

Sanitizador ZDR de contexto.
Garantiza que ningún dato sensible de Grupo Security
salga del servidor hacia OpenRouter.

Flujo:
  1. Los agentes leen contexto sensible de MemoryStore
  2. context_manager lo sustituye por references token: [CTX-REF:key]
  3. Solo las referencias van al prompt LLM
  4. Al recibir respuesta, se reintroducen los valores localmente si se necesita
"""
import re
import json
import logging
from typing import Dict, Any, Tuple, List

log = logging.getLogger("memory.context_manager")

# Patrones que indican datos sensibles que NO deben salir en prompts
_SENSITIVE_PATTERNS = [
    r'\b\d{3}\.\d{3}\.\d{3}[-.]\d{1}\b',          # Cédula colombiana
    r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.\w{2,}\b', # Email
    r'\$\s*\d[\d.,]*',                               # Precios con $
    r'\b(contraseña|password|token|secret|api.?key)\s*[:=]\s*\S+\b',  # Credenciales
    r'\b3[0-9]{9}\b',                                # Teléfonos colombianos
    r'\b\d{6,}\b',                                   # Números largos (IDs de cliente, etc.)
]

_compiled_patterns = [re.compile(p, re.IGNORECASE) for p in _SENSITIVE_PATTERNS]


def sanitize_for_llm(text: str, zdr_log: bool = True) -> Tuple[str, List[str]]:
    """
    Reemplaza datos sensibles con tokens de referencia.
    Retorna (texto_sanitizado, lista_de_reemplazos_realizados).
    """
    replacements: List[str] = []
    sanitized = text

    for i, pattern in enumerate(_compiled_patterns):
        matches = pattern.findall(sanitized)
        if matches:
            for match in matches:
                token = f"[REDACTED-{i}]"
                sanitized = sanitized.replace(match, token)
                replacements.append(f"{match} → {token}")
                if zdr_log:
                    log.warning("[ZDR] Dato sensible detectado y reemplazado: patrón %d", i)

    return sanitized, replacements


def build_safe_messages(
    system_prompt: str,
    user_message: str,
    history: List[Dict[str, str]] = None,
    context_refs: Dict[str, Any] = None,
) -> List[Dict[str, str]]:
    """
    Construye la lista de mensajes para el LLM con garantía ZDR.

    - system_prompt: prompt base del agente
    - user_message: solicitud del usuario (se sanitiza)
    - history: historial corto de la conversación (máx recomendado: 6 turnos)
    - context_refs: contexto no sensible a inyectar en system (ej: decisiones previas)
    """
    safe_user, replacements = sanitize_for_llm(user_message)
    if replacements:
        log.info("[ZDR] %d datos sanitizados del mensaje de usuario", len(replacements))

    # Construir system con contexto público
    system_content = system_prompt
    if context_refs:
        safe_ctx, _ = sanitize_for_llm(json.dumps(context_refs, ensure_ascii=False))
        system_content += f"\n\n## Contexto del proyecto (referencias públicas)\n{safe_ctx}"

    messages: List[Dict[str, str]] = [{"role": "system", "content": system_content}]

    # Historial previo (solo últimos N turnos para controlar tokens)
    if history:
        for turn in history[-6:]:  # máximo 6 turnos de historia
            safe_content, _ = sanitize_for_llm(turn.get("content", ""))
            messages.append({"role": turn["role"], "content": safe_content})

    messages.append({"role": "user", "content": safe_user})
    return messages
