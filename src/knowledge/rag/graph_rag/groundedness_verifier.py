"""Post-generation groundedness gate for GraphRAG search.

Search-method agnostic: takes the produced answer plus the context that was
actually retrieved, and asks a strict LLM judge whether every substantive claim in
the answer is supported by that context. Ungrounded answers are rejected so the
caller can fall back to the canned "documents do not cover this" path instead of
letting fabricated content (e.g. drift's primer/reduce stages inventing facts
"from our sources") reach the agent.

This is the final isolation layer that holds for global, drift, local and basic
search alike — it does not depend on any single method's internal scoring.
"""

import asyncio
import logging

import pandas as pd
from graphrag.config.models.graph_rag_config import GraphRagConfig
from graphrag.config.models.language_model_config import LanguageModelConfig
from graphrag.language_model.manager import ModelManager

logger = logging.getLogger(__name__)

# Token→char factor for capping the context handed to the judge. The token budget
# itself is the model-window-aware value already resolved upstream (django's
# adaptive_context_service via resolve_context_window) and carried in the config —
# we don't re-resolve the model window here.
_CHARS_PER_TOKEN = 3.5

_VERIFIER_NAME = "grounding_verifier_chat"

_GROUNDED = "GROUNDED"
_NOT_GROUNDED = "NOT_GROUNDED"

_VERIFIER_PROMPT = """You are a strict grounding verifier for a knowledge-base assistant.

You are given a user QUESTION, the CONTEXT retrieved from the knowledge base, and a
draft ANSWER generated from that context. Decide whether every substantive factual
claim in the ANSWER is directly supported by the CONTEXT.

Rules:
- Judge ONLY against the CONTEXT. Your own world/training knowledge is irrelevant and
  must never be used to "fill in" or excuse a claim.
- If the ANSWER introduces any fact, name, number, date, definition, specification or
  claim that is not present in (or directly inferable from) the CONTEXT, it is {not_grounded}.
- If the ANSWER merely states that the documents/knowledge base do not cover the
  question (a refusal), treat it as {grounded}.
- If the CONTEXT is empty or unrelated to the ANSWER's claims, it is {not_grounded}.

Respond with a SINGLE token on the first line: {grounded} or {not_grounded}.

QUESTION:
{question}

CONTEXT:
{context}

ANSWER:
{answer}
"""


def _serialize_context(context_data, max_chars: int) -> str:
    """Flatten the heterogeneous graphrag context payload into bounded text.

    `max_chars <= 0` means no cap (the context is already token-bounded upstream).
    """

    def _cap(text: str) -> str:
        return text if max_chars <= 0 else text[:max_chars]

    if not context_data:
        return ""

    if isinstance(context_data, dict):
        items = list(context_data.items())
    elif isinstance(context_data, (list, tuple)):
        items = list(enumerate(context_data))
    else:
        return _cap(str(context_data))

    parts: list[str] = []
    for key, value in items:
        if isinstance(value, pd.DataFrame):
            if value.empty:
                continue
            text = value.to_csv(index=False)
        elif isinstance(value, (list, tuple)):
            text = "\n".join(str(v) for v in value)
        else:
            text = str(value)
        parts.append(f"## {key}\n{text}")

    return _cap("\n\n".join(parts))


async def _averify(
    query: str, answer: str, context_text: str, model_settings: LanguageModelConfig
) -> bool:
    chat_model = ModelManager().get_or_create_chat_model(
        name=_VERIFIER_NAME,
        model_type=model_settings.type,
        config=model_settings,
    )

    prompt = _VERIFIER_PROMPT.format(
        grounded=_GROUNDED,
        not_grounded=_NOT_GROUNDED,
        question=query,
        context=context_text,
        answer=answer,
    )
    response = await chat_model.achat(prompt)
    verdict = (response.output.content or "").strip().upper()

    if _NOT_GROUNDED in verdict:
        return False
    if _GROUNDED in verdict:
        return True
    # Verdict returned but unparseable → treat as ungrounded (prefer refusing over
    # passing through possibly-fabricated content).
    logger.warning("Grounding verifier returned an unparseable verdict: %r", verdict)
    return False


def verify_grounded(
    query: str,
    answer: str,
    context_data,
    config: GraphRagConfig,
    context_token_budget: int,
) -> bool:
    """Return True if `answer` is supported by `context_data`, else False.

    `context_token_budget` is the active method's retrieval token budget (already
    sized to the model window upstream); it caps the context shown to the judge.

    Fails open (returns True) only on an infrastructure error in the judge call: a
    failing judge model must not turn the whole knowledge base into blanket refusals.
    """
    model_settings = config.get_language_model_config(config.local_search.chat_model_id)
    context_text = _serialize_context(
        context_data, int(context_token_budget * _CHARS_PER_TOKEN)
    )
    if not context_text:
        # Nothing was retrieved to support the answer.
        return False
    try:
        return asyncio.run(_averify(query, answer, context_text, model_settings))
    except Exception:
        logger.exception("Grounding verification failed; allowing answer through")
        return True
