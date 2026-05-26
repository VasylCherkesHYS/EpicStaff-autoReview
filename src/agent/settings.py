import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    redis_host: str
    redis_port: int
    redis_password: str | None
    agent_request_stream: str
    agent_result_stream: str
    agent_consumer_group: str
    log_level: str
    llm_default_max_retries: int


def load_settings() -> Settings:
    return Settings(
        redis_host=os.environ.get("REDIS_HOST", "127.0.0.1"),
        redis_port=int(os.environ.get("REDIS_PORT", "6379")),
        redis_password=os.environ.get("REDIS_PASSWORD") or None,
        agent_request_stream=os.environ.get("AGENT_REQUEST_STREAM", "agent.requests"),
        agent_result_stream=os.environ.get("AGENT_RESULT_STREAM", "agent.results"),
        agent_consumer_group=os.environ.get("AGENT_CONSUMER_GROUP", "agent-executors"),
        log_level=os.environ.get("LOG_LEVEL", "INFO"),
        llm_default_max_retries=int(os.environ.get("LLM_DEFAULT_MAX_RETRIES", "5")),
    )
