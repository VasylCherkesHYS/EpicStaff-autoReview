import json
import os
from pathlib import Path

import litellm
import pytest

litellm.drop_params = True

MODELS_JSON_PATH = (
    Path(__file__).parent.parent.parent / "tables/provider_models/llm_models.json"
)

_NO_TEMPERATURE_PATTERNS = (
    "claude-opus-4",
    "claude-sonnet-4",
    "claude-haiku-4",
    "gpt-5",
    "o1",
    "o3",
    "o4",
)


def _load_models(provider: str) -> list[str]:
    with open(MODELS_JSON_PATH) as f:
        data = json.load(f)
    return [m["name"] for m in data.get(provider, [])]


def _make_completion(model: str, api_key: str, **kwargs):
    params = dict(
        model=model,
        messages=[{"role": "user", "content": "Reply with a single word: ok"}],
        max_completion_tokens=50,
        api_key=api_key,
        **kwargs,
    )
    model_lower = model.lower()
    if any(p in model_lower for p in _NO_TEMPERATURE_PATTERNS):
        params.pop("temperature", None)
        params.pop("top_p", None)
    return litellm.completion(**params)


# NOTE: api keys should be passed via environment variables, and should not be hardcoded anywhere in the codebase. If the key is not found, the test will be skipped.
@pytest.mark.parametrize("model", _load_models("anthropic"))
def test_anthropic_model(model):
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        pytest.skip("ANTHROPIC_API_KEY not set")
    response = _make_completion(model=model, api_key=api_key)
    assert response.choices


@pytest.mark.parametrize("model", _load_models("openai"))
def test_openai_model(model):
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        pytest.skip("OPENAI_API_KEY not set")
    response = _make_completion(model=model, api_key=api_key)
    assert response.choices


@pytest.mark.parametrize("model", _load_models("gemini"))
def test_gemini_model(model):
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        pytest.skip("GEMINI_API_KEY not set")
    try:
        response = _make_completion(model=model, api_key=api_key)
        assert response.choices
    except litellm.RateLimitError:
        pytest.skip(f"Rate limit hit for {model}")
