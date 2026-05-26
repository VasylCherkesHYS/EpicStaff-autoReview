import asyncio
import signal
import socket
import sys
from uuid import uuid4

from loguru import logger

from settings import load_settings
from shared.redis_streams import RedisStreamClient, StreamEnvelope


async def handle(
    envelope: StreamEnvelope,
    message_id: str,
    stream: str,
    client: RedisStreamClient,
    group: str,
) -> None:
    logger.info(
        "received envelope type={} correlation_id={} stream={}",
        envelope.type,
        envelope.correlation_id,
        stream,
    )
    await client.ack(stream, group, message_id)
    logger.debug("acked message_id={}", message_id)


async def main() -> None:
    settings = load_settings()

    logger.remove()
    logger.add(sys.stderr, level=settings.log_level)

    consumer_name = f"{socket.gethostname()}-{uuid4().hex[:8]}"

    client = RedisStreamClient(
        host=settings.redis_host,
        port=settings.redis_port,
        password=settings.redis_password,
    )
    await client.connect()
    await client.ensure_group(
        stream=settings.agent_request_stream,
        group=settings.agent_consumer_group,
        start_id="0",
        mkstream=True,
    )

    stop = asyncio.Event()
    loop = asyncio.get_running_loop()

    def _on_signal() -> None:
        logger.info("shutdown signal received")
        stop.set()

    try:
        loop.add_signal_handler(signal.SIGTERM, _on_signal)
        loop.add_signal_handler(signal.SIGINT, _on_signal)
    except NotImplementedError:
        pass

    logger.info("waiting for messages (consumer={})", consumer_name)

    while not stop.is_set():
        messages = await client.read(
            streams={settings.agent_request_stream: ">"},
            group=settings.agent_consumer_group,
            consumer=consumer_name,
            count=10,
            block_ms=5000,
        )

        for message in messages:
            try:
                envelope = StreamEnvelope.from_fields(message.fields)

            except Exception as parse_error:
                logger.error(
                    "failed to parse message message_id={} error={} — dropping (poison pill)",
                    message.message_id,
                    parse_error,
                )
                await client.ack(
                    settings.agent_request_stream,
                    settings.agent_consumer_group,
                    message.message_id,
                )
                continue

            await handle(
                envelope=envelope,
                message_id=message.message_id,
                stream=message.stream,
                client=client,
                group=settings.agent_consumer_group,
            )

    await client.close()
    logger.info("agent shut down cleanly")


if __name__ == "__main__":
    asyncio.run(main())
