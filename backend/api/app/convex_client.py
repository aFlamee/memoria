from __future__ import annotations

from typing import Any

import httpx

from app.config import settings


class ConvexRequestError(Exception):
    def __init__(self, status_code: int, detail: str):
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


_client: httpx.AsyncClient | None = None


def get_client() -> httpx.AsyncClient:
    if _client is None:
        raise RuntimeError("Convex client not initialised. Call init_client() first.")
    return _client


async def init_client() -> None:
    global _client
    _client = httpx.AsyncClient(
        base_url=settings.convex_site_url.rstrip("/"),
        headers={"x-memoria-ingest-secret": settings.memoria_convex_ingest_secret},
        timeout=30.0,
    )


async def close_client() -> None:
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None


def _error_detail(response: httpx.Response) -> str:
    try:
        payload = response.json()
    except Exception:
        return response.text or f"Convex request failed with status {response.status_code}"

    if isinstance(payload, dict) and isinstance(payload.get("detail"), str):
        return payload["detail"]
    return response.text or f"Convex request failed with status {response.status_code}"


async def request_json(
    method: str,
    path: str,
    *,
    json: dict[str, Any] | None = None,
    params: dict[str, Any] | None = None,
) -> Any:
    response = await get_client().request(method, path, json=json, params=params)
    if response.status_code >= 400:
        raise ConvexRequestError(response.status_code, _error_detail(response))
    if response.content:
        return response.json()
    return None
