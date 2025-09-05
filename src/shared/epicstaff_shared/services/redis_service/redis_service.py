import json
import os
import threading
import time
import redis
import redis.asyncio as aioredis
from redis import Redis
from loguru import logger
from typing import Any, Awaitable, List, Protocol, Union
from redis.client import PubSub
import asyncio
from ...utils import SingletonMeta


class AsyncKwargsOnlyCallback(Protocol):
    def __call__(self, **kwargs: Any) -> Awaitable[Any]: ...


class SyncKwargsOnlyCallback(Protocol):
    def __call__(self, **kwargs: Any) -> Any: ...


class AsyncPubsubSubscriber:
    def __init__(self, callback: AsyncKwargsOnlyCallback):
        self._callback = callback

    async def update(self, message: dict):
        await self._callback(message=message)


class SyncPubsubSubscriber:
    def __init__(self, callback: SyncKwargsOnlyCallback):
        self._callback = callback

    def update(self, message: dict):
        self._callback(message=message)


class AsyncPubSubGroup:
    def __init__(self, channel: str, redis: aioredis.Redis):

        self._channel = channel
        self._redis = redis
        self._subscribers: list[AsyncPubsubSubscriber] = []
        self._pubsub = None
        self._reader_task = None

    async def start(self):
        self._pubsub = self._redis.pubsub()
        await self._pubsub.subscribe(self._channel)
        self._reader_task = asyncio.create_task(self._message_reader())

    async def _message_reader(self):
        
        while True:
            msg = await self._pubsub.get_message(
                ignore_subscribe_messages=True, timeout=0.01
            )
            if msg is None:
                await asyncio.sleep(0.01)
                continue
            
            for sub in self._subscribers:
                try:
                    await sub.update(msg)                    
                except Exception as e:
                    logger.error(f"Redis message reader error: {e}")

    def subscribe(self, subscriber):
        self._subscribers.append(subscriber)

    async def publish(self, data):
        await self._redis.publish(self._channel, data)

    async def stop(self):
        if self._pubsub:
            await self._pubsub.unsubscribe(self._channel)
            await self._pubsub.close()
        if self._reader_task:
            self._reader_task.cancel()
            try:
                await self._reader_task
            except asyncio.CancelledError:
                pass
        if self._redis:
            await self._redis.close()

    def unsubscribe(self, subscriber: AsyncPubsubSubscriber):
        if subscriber in self._subscribers:
            self._subscribers.remove(subscriber)
            logger.info(f"Unsubscribed from channel {self._channel}")
        else:
            logger.warning(f"Subscriber not found in channel {self._channel}")


class SyncPubSubGroup:
    def __init__(self, channel: str, redis_client: redis.Redis):
        self._channel = channel
        self._redis = redis_client
        self._pubsub = self._redis.pubsub(ignore_subscribe_messages=True)
        self._subscribers: list[SyncPubsubSubscriber] = []
        self._thread = None
        self._stop_flag = threading.Event()

    def start(self):
        self._pubsub.subscribe(self._channel)
        self._thread = threading.Thread(target=self._message_reader, daemon=True)
        self._thread.start()

    def _message_reader(self):
        try:
            while not self._stop_flag.is_set():
                msg = self._pubsub.get_message(timeout=0.1)
                if msg is None:
                    time.sleep(0.01)
                    continue
                for sub in self._subscribers:
                    try:
                        sub.update(msg)
                    except Exception as e:
                        logger.error(f"Redis message reader error: {e}")

        except Exception as e:
            logger.error(f"Error in SyncPubSubGroup message reader: {e}")

    def subscribe(self, subscriber: SyncPubsubSubscriber):
        self._subscribers.append(subscriber)

    def publish(self, data):
        self._redis.publish(self._channel, data)

    def stop(self):
        self._stop_flag.set()
        if self._thread:
            self._thread.join()
        self._pubsub.unsubscribe(self._channel)
        self._pubsub.close()

    def unsubscribe(self, subscriber: SyncPubsubSubscriber):
        if subscriber in self._subscribers:
            self._subscribers.remove(subscriber)
            logger.info(f"Unsubscribed from channel {self._channel}")
        else:
            logger.warning(f"Subscriber not found in channel {self._channel}")


class RedisService(metaclass=SingletonMeta):
    def __init__(self, host: str, port: int):
        self.host = host
        self.port = port

        self.aioredis_client: aioredis.Redis | None = None
        self.sync_redis_client: Redis | None = None
        self._async_pubsub_groups: dict[str, AsyncPubSubGroup] = {}
        self._sync_pubsub_groups: dict[str, SyncPubSubGroup] = {}

    async def _init_async_pubsub_group(self, channel: str):
        self._async_pubsub_groups[channel] = AsyncPubSubGroup(
            channel=channel, redis=self.aioredis_client
        )
        await self._async_pubsub_groups[channel].start()

    def _init_sync_pubsub_group(self, channel: str):
        self._sync_pubsub_groups[channel] = SyncPubSubGroup(
            channel=channel, redis_client=self.sync_redis_client
        )
        self._sync_pubsub_groups[channel].start()

    async def connect(self):
        try:
            self.aioredis_client = await aioredis.from_url(
                f"redis://{self.host}:{self.port}", decode_responses=True
            )
            self.sync_redis_client = Redis.from_url(
                f"redis://{self.host}:{self.port}", decode_responses=True
            )
            await self.aioredis_client.ping()
            self.sync_redis_client.ping()

            logger.info("Connected to Redis.")
        except Exception as e:
            logger.error(f"Failed to connect to Redis: {e}")
            raise e

    async def close(self):
        if self.aioredis_client:
            await self.aioredis_client.close()
        if self.sync_redis_client:
            self.sync_redis_client.close()

    async def asubscribe(
        self, channels: Union[str, List[str]], subscriber: AsyncPubsubSubscriber
    ) -> PubSub:
        """
        Subscribe to one or multiple channels asynchronously.
        """
        if isinstance(channels, str):
            # Single channel
            if channels not in self._async_pubsub_groups:
                await self._init_async_pubsub_group(channels)
            self._async_pubsub_groups.get(channels).subscribe(subscriber=subscriber)
            logger.info(f"Subscribed to channel group: {channels}")
        else:
            # Multiple channels
            for channel in channels:
                if channel not in self._async_pubsub_groups:
                    await self._init_async_pubsub_group(channel)
                self._async_pubsub_groups.get(channel).subscribe(subscriber=subscriber)
            logger.info(f"Subscribed to channels: {', '.join(channels)}")

    def subscribe(
        self, channels: Union[str, List[str]], subscriber: AsyncPubsubSubscriber
    ) -> PubSub:

        if isinstance(channels, str):
            # Single channel
            if channels not in self._sync_pubsub_groups:
                self._init_sync_pubsub_group(channels)
            self._sync_pubsub_groups.get(channels).subscribe(subscriber)
            logger.info(f"Subscribed to channel group: {channels}")
        else:
            # Multiple channels
            for channel in channels:
                if channel not in self._sync_pubsub_groups:
                    self._init_sync_pubsub_group(channel)
                self._sync_pubsub_groups[channel].subscribe(subscriber)
            logger.info(f"Subscribed to channels: {', '.join(channels)}")

    async def apublish(self, channel: str, message: object, dump: bool = True):
        if dump:
            message = json.dumps(message)

        await self.aioredis_client.publish(channel=channel, message=message)
        logger.info(f"Message published to channel '{channel}'.")

    def publish(self, channel: str, message: object, dump: bool = True):
        if dump:
            message = json.dumps(message)
        self.sync_redis_client.publish(channel=channel, message=message)
        logger.info(f"Message published to channel '{channel}'.")

    def unsubscribe(
        self, channel: str, subscriber: SyncPubsubSubscriber | AsyncPubsubSubscriber
    ):
        if isinstance(subscriber, AsyncPubsubSubscriber):
            if channel in self._async_pubsub_groups:
                self._async_pubsub_groups[channel].unsubscribe(subscriber)
                logger.info(f"Unsubscribed from channel {channel}")
            else:
                logger.warning(
                    f"Channel {channel} not found for unsubscribe operation."
                )
        elif isinstance(subscriber, SyncPubsubSubscriber):
            if channel in self._sync_pubsub_groups:
                self._sync_pubsub_groups[channel].unsubscribe(subscriber)
                logger.info(f"Unsubscribed from channel {channel}")
            else:
                logger.warning(
                    f"Channel {channel} not found for unsubscribe operation."
                )
