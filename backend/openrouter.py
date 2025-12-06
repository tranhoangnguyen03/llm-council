"""OpenRouter API client for making LLM requests."""

import time
import httpx
from typing import List, Dict, Any, Optional, Tuple
from .config import OPENROUTER_API_KEY, OPENROUTER_API_URL

_MODEL_CACHE: Dict[str, Any] = {"data": None, "ts": 0}
_MODEL_CACHE_TTL = 24 * 60 * 60


async def query_model(
    model: str,
    messages: List[Dict[str, str]],
    timeout: float = 120.0
) -> Optional[Dict[str, Any]]:
    """
    Query a single model via OpenRouter API.

    Args:
        model: OpenRouter model identifier (e.g., "openai/gpt-4o")
        messages: List of message dicts with 'role' and 'content'
        timeout: Request timeout in seconds

    Returns:
        Response dict with 'content' and optional 'reasoning_details', or None if failed
    """
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
    }

    payload = {
        "model": model,
        "messages": messages,
    }

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(
                OPENROUTER_API_URL,
                headers=headers,
                json=payload
            )
            response.raise_for_status()

            data = response.json()
            message = data['choices'][0]['message']

            return {
                'content': message.get('content'),
                'reasoning_details': message.get('reasoning_details')
            }

    except Exception as e:
        print(f"Error querying model {model}: {e}")
        return None


async def query_models_parallel(
    models: List[str],
    messages: List[Dict[str, str]]
) -> Dict[str, Optional[Dict[str, Any]]]:
    """
    Query multiple models in parallel.

    Args:
        models: List of OpenRouter model identifiers
        messages: List of message dicts to send to each model

    Returns:
        Dict mapping model identifier to response dict (or None if failed)
    """
    import asyncio

    # Create tasks for all models
    tasks = [query_model(model, messages) for model in models]

    # Wait for all to complete
    responses = await asyncio.gather(*tasks)

    # Map models to their responses
    return {model: response for model, response in zip(models, responses)}


async def fetch_available_models(force: bool = False) -> Tuple[List[Dict[str, Any]], bool]:
    now = int(time.time())
    if not force and _MODEL_CACHE.get("data") and now - int(_MODEL_CACHE.get("ts", 0)) < _MODEL_CACHE_TTL:
        return _MODEL_CACHE["data"], True
    url = "https://openrouter.ai/api/v1/models"
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json()
            items = data.get("data") or []
            models = []
            for it in items:
                mid = it.get("id") or it.get("name") or ""
                if not mid:
                    continue
                models.append({
                    "id": mid,
                    "context_length": it.get("context_length") or it.get("context_length_tokens") or None,
                    "pricing": it.get("pricing") or {},
                })
            if models:
                _MODEL_CACHE["data"] = models
                _MODEL_CACHE["ts"] = now
            return models, False
    except Exception as e:
        cached = _MODEL_CACHE.get("data") or []
        return cached, True
