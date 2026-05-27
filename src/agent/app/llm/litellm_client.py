"""
LiteLLMClient: concrete ``LLMClient`` backed by LiteLLM Router.

Composes ``RouterPool`` (per-deployment rpm enforcement) and ``RetryPolicy``
(exponential backoff on transient errors).  Normalizes LiteLLM streaming
chunks into the ``LLMChunk`` schema consumed by ``AgentLoop``.

Default max-retry count is read from ``LLM_DEFAULT_MAX_RETRIES`` env var via
``settings.load_settings()`` on first need; override via the ``retry`` param.
"""

from __future__ import annotations

import uuid
from typing import AsyncIterator

from app.llm.client import LLMChunk, LLMClient, ToolCallFragment
from app.llm.retry import RetryPolicy
from app.llm.router_pool import RouterPool, get_router_pool

_STRIPPED_MODEL_CONFIG_KEYS = frozenset(
    {"model", "api_key", "base_url", "api_version", "max_retry_limit", "max_rpm"}
)


def _kwargs_for_acompletion(model_config: dict) -> dict:
    """Strip Router-owned and runtime keys from model_config before forwarding."""
    return {
        k: v for k, v in model_config.items() if k not in _STRIPPED_MODEL_CONFIG_KEYS
    }


def _default_max_retries() -> int:
    from settings import load_settings

    return load_settings().llm_default_max_retries


class LiteLLMClient(LLMClient):
    """``LLMClient`` implementation that routes calls through ``litellm.Router``.

    ``retry`` and ``pool`` may be injected for testing; ``None`` means resolve
    the process-singleton at call time so construction is cheap.
    """

    def __init__(
        self,
        retry: RetryPolicy | None = None,
        pool: RouterPool | None = None,
    ) -> None:
        self._retry = retry
        self._pool = pool

    def chat(
        self,
        messages: list[dict],
        tools: list,
        model_config: dict,
        *,
        stream: bool,
        runtime_config: dict | None = None,
    ) -> AsyncIterator[LLMChunk]:
        """Return an async generator of normalized ``LLMChunk`` objects."""
        assert stream is True, "LiteLLMClient only supports streaming mode"
        return self._stream(messages, tools, model_config, runtime_config)

    async def _stream(
        self,
        messages: list[dict],
        tools: list,
        model_config: dict,
        runtime_config: dict | None,
    ) -> AsyncIterator[LLMChunk]:
        litellm_tools = (
            [
                {
                    "type": "function",
                    "function": {
                        "name": tool.name,
                        "description": tool.description,
                        "parameters": tool.parameters_schema,
                    },
                }
                for tool in tools
            ]
            if tools
            else None
        )

        runtime_config = runtime_config or {}
        runtime_max_retries = runtime_config.get("max_retry_limit")
        rpm = runtime_config.get("max_rpm")

        pool = self._pool or get_router_pool()
        router = await pool.get(
            model=model_config["model"], model_config=model_config, rpm=rpm
        )
        synthetic_model = router.model_list[0]["model_name"]

        retry = self._retry or RetryPolicy(max_retries=_default_max_retries())

        if runtime_max_retries is not None and runtime_max_retries != retry.max_retries:
            retry = retry.with_max_retries(runtime_max_retries)

        extra_kwargs = _kwargs_for_acompletion(model_config)

        async def _call():
            return await router.acompletion(
                model=synthetic_model,
                messages=messages,
                stream=True,
                tools=litellm_tools,
                **extra_kwargs,
            )

        response_stream = await retry.aretry(_call)

        tc_map: dict[int, dict] = {}

        async for chunk in response_stream:
            choice = chunk.choices[0]
            delta = choice.delta
            finish = choice.finish_reason
            usage = getattr(chunk, "usage", None)

            if delta.content:
                yield LLMChunk(delta_text=delta.content)

            for tc in delta.tool_calls or []:
                idx = tc.index

                if idx not in tc_map:
                    tool_id = tc.id

                    if tool_id is None:
                        # Provider sent no id on the first fragment — synthesize one.
                        tool_id = f"call_{uuid.uuid4().hex[:8]}"

                    tc_map[idx] = {"id": tool_id, "name": tc.function.name}

                seeded = tc_map[idx]

                yield LLMChunk(
                    tool_call_fragment=ToolCallFragment(
                        id=tc.id or seeded["id"],
                        name=tc.function.name or seeded["name"] or "",
                        arguments_delta=tc.function.arguments or "",
                    )
                )

            if finish:
                yield LLMChunk(finish_reason=finish)

            if usage:
                usage_dict = usage if isinstance(usage, dict) else vars(usage)
                yield LLMChunk(usage=usage_dict)
