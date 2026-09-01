"""
openrouter_client.py

Cliente ZDR para OpenRouter. Expone tres rutas seguras:
  - call_secure_mistral()  → Mistral Small 4
  - call_secure_qwen()     → Qwen3.6 35B A3B
  - call_secure_auto()     → fallback local Mistral → Qwen

Política ZDR: los headers de no-retención se inyectan automáticamente.
Verifica slugs y precios en https://openrouter.ai antes de producción.
"""
import httpx
import logging
from typing import Optional, List, Dict, Any
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from config.settings import settings

log = logging.getLogger("openrouter_client")

# Whitelist estricta de modelos permitidos para Grupo Security
_ALLOWED_MODELS = {
    settings.model_mistral,
    settings.model_qwen,
    settings.model_auto_primary,
    settings.model_auto_fallback,
}

# Headers ZDR obligatorios para Grupo Security
_ZDR_HEADERS = {
    "Authorization": f"Bearer {settings.openrouter_api_key}",
    "Content-Type": "application/json",
    "HTTP-Referer": "https://github.com/Zatairo/grupo-security-office",
    "X-Title": "GrupoSecurity-Office",
    "X-Data-Retention": "none",
}


class OpenRouterError(Exception):
    """Error en llamada a OpenRouter."""
    pass


class OpenRouterRateLimitError(OpenRouterError):
    """Rate limit alcanzado."""
    pass


class OpenRouterPolicyError(OpenRouterError):
    """Violación de política de modelos permitidos."""
    pass


def _assert_allowed_model(model: str) -> None:
    if model not in _ALLOWED_MODELS:
        raise OpenRouterPolicyError(
            f"Modelo no permitido por política: {model}. Permitidos: {sorted(_ALLOWED_MODELS)}"
        )


def _build_payload(
    model: str,
    messages: List[Dict[str, str]],
    max_tokens: int,
    temperature: float,
    response_format: Optional[Dict] = None,
) -> Dict[str, Any]:
    _assert_allowed_model(model)

    payload: Dict[str, Any] = {
        "model": model,
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": temperature,
        "stream": False,
        "provider": {
            "zdr": True,
            "data_collection": "deny",
            "allow_fallbacks": False,
        },
    }
    if response_format:
        payload["response_format"] = response_format
    return payload


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    retry=retry_if_exception_type(OpenRouterRateLimitError),
)
async def _call(
    model: str,
    messages: List[Dict[str, str]],
    max_tokens: int = 1024,
    temperature: float = 0.3,
    response_format: Optional[Dict] = None,
) -> str:
    """Llamada base con retry automático en rate limit."""
    payload = _build_payload(model, messages, max_tokens, temperature, response_format)

    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            f"{settings.openrouter_base_url}/chat/completions",
            headers=_ZDR_HEADERS,
            json=payload,
        )

    if resp.status_code == 429:
        raise OpenRouterRateLimitError(f"Rate limit en modelo {model}")
    if resp.status_code != 200:
        raise OpenRouterError(f"HTTP {resp.status_code}: {resp.text[:300]}")

    data = resp.json()
    returned_model = data.get("model")

    if returned_model:
        _assert_allowed_model(returned_model)

    log.info(
        "[ZDR] OpenRouter request_model=%s response_model=%s usage=%s",
        model,
        returned_model or "(no informado)",
        data.get("usage"),
    )

    try:
        return data["choices"][0]["message"]["content"]
    except (KeyError, IndexError) as e:
        raise OpenRouterError(f"Respuesta malformada de OpenRouter: {e} | {data}")


async def call_secure_mistral(
    messages: List[Dict[str, str]],
    max_tokens: int = settings.max_tokens_per_request,
    temperature: float = 0.3,
    response_format: Optional[Dict] = None,
) -> str:
    """Ruta ZDR → Mistral. Ideal para texto, copy, QA."""
    log.debug("[ZDR] call_secure_mistral — %d mensajes", len(messages))
    return await _call(settings.model_mistral, messages, max_tokens, temperature, response_format)


async def call_secure_qwen(
    messages: List[Dict[str, str]],
    max_tokens: int = settings.max_tokens_per_request,
    temperature: float = 0.2,
    response_format: Optional[Dict] = None,
) -> str:
    """Ruta ZDR → Qwen. Ideal para código y razonamiento técnico."""
    log.debug("[ZDR] call_secure_qwen — %d mensajes", len(messages))
    return await _call(settings.model_qwen, messages, max_tokens, temperature, response_format)


async def call_secure_auto(
    messages: List[Dict[str, str]],
    max_tokens: int = settings.max_tokens_per_request,
    temperature: float = 0.3,
    response_format: Optional[Dict] = None,
) -> str:
    """
    Ruta ZDR auto con fallback local.
    Intenta el primary definido en settings; si falla, usa el fallback definido en settings.
    """
    _assert_allowed_model(settings.model_auto_primary)
    _assert_allowed_model(settings.model_auto_fallback)

    log.debug("[ZDR] call_secure_auto — intentando primary: %s", settings.model_auto_primary)
    try:
        return await _call(
            settings.model_auto_primary, messages, max_tokens, temperature, response_format
        )
    except (OpenRouterError, OpenRouterRateLimitError) as e:
        log.warning(
            "[ZDR] Primary falló (%s), activando fallback → %s",
            e,
            settings.model_auto_fallback,
        )
        return await _call(
            settings.model_auto_fallback, messages, max_tokens, temperature, response_format
        )
