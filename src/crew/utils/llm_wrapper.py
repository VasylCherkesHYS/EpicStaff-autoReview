from crewai import LLM


# TODO: This is temporary workaround, until we can add robust way to filter out unsupported params per model in crewai
_NO_TEMPERATURE_PATTERNS = (
    "claude-opus-4",
    "claude-sonnet-4",
    "claude-haiku-4",
    "gpt-5",
    "o1",
    "o3",
    "o4",
)
_NO_STOP_PATTERNS = (
    "o1",
    "o3",
    "o4-mini",
    "o4",
)


def _model_drops_temperature(model: str | None) -> bool:
    model = (model or "").lower()
    return any(p in model for p in _NO_TEMPERATURE_PATTERNS)


def _model_drops_stop(model: str | None) -> bool:
    model = (model or "").lower()
    return any(p in model for p in _NO_STOP_PATTERNS)


class PatchedLLM(LLM):
    """crewai.LLM subclass that filters parameters unsupported by specific models."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # After super().__init__() self.model is normalized by crewai.
        if _model_drops_temperature(self.model):
            self.temperature = None
            self.top_p = None

    def supports_stop_words(self) -> bool:
        if _model_drops_stop(self.model):
            return False
        return super().supports_stop_words()
