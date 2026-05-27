"""
Layer 6 — RequestHandler: top-level pipeline that drives a single stream message
to completion.

Orchestrates the full request lifecycle: envelope → ``DataLoader`` → ``RunnerFactory``
→ ``Runner.execute`` → ack.  Owns error mapping (any exception triggers
``emitter.on_error``) and guarantees the stream message is always acked,
preventing re-delivery of poison pills.
"""

from __future__ import annotations

from loguru import logger

from app.data_loader import DataLoader
from app.emitters.redis_batch import RedisStreamBatchEmitter
from app.factory import RunnerFactory
from shared.redis_streams import RedisStreamClient, StreamEnvelope


class RequestHandler:
    """Consumes a ``StreamEnvelope`` and drives it through the full execution pipeline.

    Collaborators:
    - ``DataLoader`` — hydrates the envelope into an ``AgentRequest``.
    - ``RunnerFactory`` — selects and constructs the ``(Runner, Emitter)`` pair.
    - ``Runner`` — executes the agent work.
    - ``RedisStreamClient`` — used to ack the message and, via the emitter, to
      publish results.

    On any exception in the happy path a fallback ``RedisStreamBatchEmitter``
    is constructed directly so that an ``agent.error`` envelope reaches
    ``agent.results`` even when the factory itself fails (e.g. unknown run_type).
    The stream message is acked unconditionally after error handling.
    """

    def __init__(
        self,
        loader: DataLoader,
        factory: RunnerFactory,
        redis_client: RedisStreamClient,
        result_stream: str,
        request_stream: str,
        consumer_group: str,
    ) -> None:
        self._loader = loader
        self._factory = factory
        self._redis_client = redis_client
        self._result_stream = result_stream
        self._request_stream = request_stream
        self._consumer_group = consumer_group

    async def handle(
        self,
        envelope: StreamEnvelope,
        message_id: str,
        stream: str,
    ) -> None:
        """Process one stream message end-to-end and ack it.

        Runs the pipeline: load → build → start → execute.  Any exception
        is caught, published as an ``agent.error`` envelope, and the message
        is still acked so the consumer group does not stall.

        Args:
            envelope: parsed stream message payload.
            message_id: Redis stream message ID used for acking.
            stream: name of the stream the message was read from.
        """
        correlation_id = envelope.correlation_id
        logger.info(
            "handling request type={} correlation_id={}",
            envelope.type,
            correlation_id,
        )

        try:
            request = await self._loader.load(envelope)
            runner, emitter = self._factory.build(
                request, self._redis_client, self._result_stream
            )
            await emitter.on_start(request)
            await runner.execute(request, emitter)

        except Exception as error:
            logger.error(
                "request failed correlation_id={} error={}",
                correlation_id,
                error,
            )
            fallback_emitter = RedisStreamBatchEmitter(
                self._redis_client, self._result_stream, correlation_id
            )
            await fallback_emitter.on_error(error)

        await self._redis_client.ack(stream, self._consumer_group, message_id)
        logger.debug(
            "acked message_id={} correlation_id={}", message_id, correlation_id
        )
