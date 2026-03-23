"""
Simple reverse proxy for LLM API calls.

Env vars:
  PROXY_TARGET_HOST  — where to forward (e.g. https://api.openai.com)
  PROXY_HEADERS      — JSON dict; null value = remove header, string = add/replace
  PROXY_PORT         — listen port (default 8080)
  PROXY_SSL_VERIFY   — set to "false" to skip SSL verification upstream
  PROXY_LOG_BODY     — set to "true" to log request/response bodies
"""
import json
import logging
import os
import time
import uuid

import httpx
import uvicorn
from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse

# ---------------------------------------------------------------------------
# Logging setup
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("proxy")

# Suppress httpx/httpcore noise unless you really want it
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)

# ---------------------------------------------------------------------------

app = FastAPI()

TARGET_HOST: str = os.environ.get("PROXY_TARGET_HOST", "").rstrip("/")
LOG_BODY: bool   = os.environ.get("PROXY_LOG_BODY", "false").lower() == "true"

_SKIP_REQ  = {"host", "content-length", "transfer-encoding", "connection"}
_SKIP_RESP = {"content-encoding", "content-length", "transfer-encoding", "connection"}

_SENSITIVE = {"authorization", "x-api-key", "api-key"}  # masked in logs


def _header_mods() -> dict:
    raw = os.environ.get("PROXY_HEADERS", "")
    if not raw:
        return {}
    try:
        return json.loads(raw)
    except Exception as exc:
        log.warning("Failed to parse PROXY_HEADERS: %s", exc)
        return {}


def _mask_headers(headers: dict) -> dict:
    return {
        k: ("***" if k.lower() in _SENSITIVE else v)
        for k, v in headers.items()
    }


def _fmt_body(body: bytes) -> str:
    if not body:
        return "<empty>"
    try:
        parsed = json.loads(body)
        # Truncate long string values (e.g. base64 images)
        def _trunc(obj, depth=0):
            if depth > 4:
                return "..."
            if isinstance(obj, dict):
                return {k: _trunc(v, depth + 1) for k, v in obj.items()}
            if isinstance(obj, list):
                return [_trunc(i, depth + 1) for i in obj[:5]] + (["..."] if len(obj) > 5 else [])
            if isinstance(obj, str) and len(obj) > 200:
                return obj[:200] + f"…[{len(obj)} chars]"
            return obj
        return json.dumps(_trunc(parsed), ensure_ascii=False, indent=2)
    except Exception:
        text = body.decode(errors="replace")
        return text[:500] + (f"…[{len(body)} bytes]" if len(body) > 500 else "")


@app.api_route(
    "/{path:path}",
    methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"],
)
async def proxy(request: Request, path: str):
    req_id = uuid.uuid4().hex[:8]
    t0 = time.perf_counter()

    qs  = f"?{request.url.query}" if request.url.query else ""
    url = f"{TARGET_HOST}/{path}{qs}"

    # Forward headers, drop hop-by-hop
    headers = {k: v for k, v in request.headers.items() if k.lower() not in _SKIP_REQ}

    # Apply modifications: null → remove, string → add/replace
    mods = _header_mods()
    removed, added = [], []
    for k, v in mods.items():
        if v is None:
            before = len(headers)
            headers = {hk: hv for hk, hv in headers.items() if hk.lower() != k.lower()}
            if len(headers) < before:
                removed.append(k)
        else:
            headers[k] = v
            added.append(k)

    body = await request.body()

    # --- Request log ---
    log.info(
        "[%s] ▶ %s %s  body=%d bytes",
        req_id, request.method, url, len(body),
    )
    log.debug(
        "[%s]   headers → %s",
        req_id, json.dumps(_mask_headers(headers), ensure_ascii=False),
    )
    if removed:
        log.debug("[%s]   removed headers: %s", req_id, removed)
    if added:
        log.debug("[%s]   added/replaced headers: %s", req_id, added)
    if LOG_BODY and body:
        log.debug("[%s]   request body:\n%s", req_id, _fmt_body(body))

    # Full raw request dump
    raw_headers = "\r\n".join(
        f"{k}: {'***' if k.lower() in _SENSITIVE else v}"
        for k, v in headers.items()
    )
    raw_body = body.decode(errors="replace") if body else ""
    log.debug(
        "[%s]   raw request:\n%s %s HTTP/1.1\r\n%s\r\n\r\n%s",
        req_id, request.method, url, raw_headers, raw_body,
    )

    ssl_verify = os.environ.get("PROXY_SSL_VERIFY", "true").lower() != "false"
    client = httpx.AsyncClient(verify=ssl_verify, timeout=httpx.Timeout(300.0))

    try:
        upstream_req = client.build_request(
            method=request.method,
            url=url,
            headers=headers,
            content=body,
        )
        upstream_resp = await client.send(upstream_req, stream=True)
    except Exception as exc:
        elapsed = (time.perf_counter() - t0) * 1000
        log.error("[%s] ✗ upstream error after %.0fms: %s", req_id, elapsed, exc)
        await client.aclose()
        raise

    elapsed_ttfb = (time.perf_counter() - t0) * 1000
    content_type = upstream_resp.headers.get("content-type", "")
    is_stream = "text/event-stream" in content_type

    log.info(
        "[%s] ◀ %d  %.0fms TTFB  %s%s",
        req_id,
        upstream_resp.status_code,
        elapsed_ttfb,
        content_type,
        "  [STREAM]" if is_stream else "",
    )
    log.debug(
        "[%s]   response headers ← %s",
        req_id,
        json.dumps(dict(upstream_resp.headers), ensure_ascii=False),
    )

    resp_headers = {
        k: v for k, v in upstream_resp.headers.items() if k.lower() not in _SKIP_RESP
    }

    chunks_count = 0
    total_bytes  = 0

    async def generate():
        nonlocal chunks_count, total_bytes
        resp_body_buf = b""
        try:
            async for chunk in upstream_resp.aiter_raw():
                chunks_count += 1
                total_bytes  += len(chunk)
                if LOG_BODY:
                    resp_body_buf += chunk
                yield chunk
        finally:
            elapsed_total = (time.perf_counter() - t0) * 1000
            log.info(
                "[%s] ✓ done  %.0fms total  %d chunks  %d bytes",
                req_id, elapsed_total, chunks_count, total_bytes,
            )
            if LOG_BODY and resp_body_buf:
                log.debug("[%s]   response body:\n%s", req_id, _fmt_body(resp_body_buf))
            await upstream_resp.aclose()
            await client.aclose()

    return StreamingResponse(
        generate(),
        status_code=upstream_resp.status_code,
        headers=resp_headers,
    )


if __name__ == "__main__":
    if not TARGET_HOST:
        raise RuntimeError("PROXY_TARGET_HOST is not set")
    port = int(os.environ.get("PROXY_PORT", 8080))
    log.info("Proxying → %s  (port %d)  log_body=%s", TARGET_HOST, port, LOG_BODY)
    mods = _header_mods()
    if mods:
        log.info("Header mods: %s", json.dumps(_mask_headers(mods)))
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="warning")
