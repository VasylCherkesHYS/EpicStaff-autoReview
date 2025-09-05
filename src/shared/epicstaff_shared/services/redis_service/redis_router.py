import inspect
from dataclasses import dataclass
import json
from typing import (
    Any,
    Awaitable,
    Callable,
    Coroutine,
    Iterable,
    Optional,
    Type,
    Union,
    TypeVar,
)
from loguru import logger

from pydantic import BaseModel
from ...models import *
from .filters import AbstractBaseFilter, SyncFilter, AsyncFilter
from .redis_service import RedisService, AsyncPubsubSubscriber, SyncPubsubSubscriber


REQ = TypeVar("REQ", bound=Union["RedisRequest", dict])
RESP = TypeVar("RESP", bound=Union["RedisResponse", dict])


class RedisMessage(BaseModel):
    channel: str
    data: str


class Context(BaseModel):
    message: RedisMessage
    validated_request: RedisRequest | dict | None = None
    execution_result: dict | None = None
    validated_response: RedisResponse | dict | None = None


# === Exceptions ===
class FilterValidationException(Exception):
    def __init__(self, incorrect_objects):
        message = f"Incorrect filters: {[repr(obj) for obj in incorrect_objects]}"
        super().__init__(message)


# === Base handler with both sync and async support ===
class BaseHandler:
    def __init__(self, next_handler: Optional["BaseHandler"] = None):
        self.next_handler = next_handler

    def handle(self, context: Context):
        if self.next_handler:
            return self.next_handler.handle(context)
        return None

    async def ahandle(self, context: Context):
        if self.next_handler:
            return await self.next_handler.ahandle(context)
        return None


class EndpointHandler(BaseHandler):
    pass


class RequestValidationHandler(BaseHandler):
    def __init__(
        self, request_model: Type[RedisRequest], next_handler: Optional[BaseHandler]
    ):
        super().__init__(next_handler)
        self.request_model = request_model

    def handle(self, context: Context):
        message_data = context.message.data
        validated = self.request_model.model_validate_json(message_data)
        context.validated_request = validated
        return super().handle(context)

    async def ahandle(self, context: Context):
        message_data = context.message.data
        validated = self.request_model.model_validate_json(message_data)
        context.validated_request = validated
        return await super().ahandle(context)


class ResponseValidationHandler(BaseHandler):
    def __init__(
        self,
        response_model: Optional[Type[RedisResponse]],
        next_handler: Optional[BaseHandler],
    ):
        super().__init__(next_handler)
        if response_model is None:
            response_model = RedisResponse[dict]
        self.response_model = response_model

    def __get_request_id(self, context: Context) -> str:
        request = context.validated_request
        id_ = None
        if isinstance(request, RedisRequest):
            id_ = request.id
        elif isinstance(request, dict):
            id_ = request.get("id")
        if id_ is None:
            raise ValueError("Request must be a RedisRequest or a dict with 'id'.")
        return id_

    def __validate(self, context: Context) -> RedisResponse:

        execution_result = context.execution_result

        assert execution_result is not None, "Execution result must be provided."
        assert isinstance(execution_result, dict), "Execution result must be a dict."
        assert "data" in execution_result, "Execution result must contain 'data' key."
        assert (
            "status" in execution_result
        ), "Execution result must contain 'status' key."

        id_ = self.__get_request_id(context=context)
        validated = self.response_model(
            id=id_,
            data=execution_result.get("data"),
            status=execution_result.get("status"),
            message=execution_result.get("message"),
        )
        return validated

    def handle(self, context: Context):
        validated_response = self.__validate(context)
        context.validated_response = validated_response

        return super().handle(context)

    async def ahandle(self, context: Context):
        validated_response = self.__validate(context)
        context.validated_response = validated_response

        return await super().ahandle(context)


class PublishHandler(BaseHandler):
    def __init__(
        self,
        channel: str,
        redis_service: RedisService,
        next_handler: Optional[BaseHandler],
    ):
        super().__init__(next_handler)
        self.channel = channel
        self.redis_service = redis_service

    def __create_publish_message(self, context: Context) -> str:
        validated_response: RedisResponse | dict | None = context.validated_response

        if isinstance(validated_response, dict):
            return json.dumps(validated_response)
        if isinstance(validated_response, RedisResponse):
            return validated_response.model_dump_json()
        raise ValueError("Validated response must be a RedisResponse or a dict.")

    def handle(self, context: Context):
        self.redis_service.publish(
            self.channel, self.__create_publish_message(context), dump=False
        )
        return super().handle(context)

    async def ahandle(self, context: dict):

        await self.redis_service.apublish(
            self.channel, self.__create_publish_message(context), dump=False
        )
        return await super().ahandle(context)


class ExecuteHandler(BaseHandler):
    def __init__(
        self,
        func: Union[Callable, Callable[..., Coroutine]],
        next_handler: Optional[BaseHandler],
    ):
        super().__init__(next_handler)
        self.func = func

    def handle(self, context: Context):
        try:
            result = self.func(context)
        except Exception as e:
            logger.exception(f"Execution failed: {e}")
            context.execution_result = {
                "status": StatusCode.ERROR,
                "message": str(e),
                "data": None,
            }

        if isinstance(result, ResponseDTO):
            result = result.model_dump()
        context.execution_result = result

        return super().handle(context)

    async def ahandle(self, context: Context):
        try:
            result = await self.func(context)

        except Exception as e:
            logger.exception(f"Execution failed: {e}")
            result = {
                "status": StatusCode.ERROR,
                "message": str(e),
                "data": None,
            }        
        if isinstance(result, ResponseDTO):
            result = result.model_dump()
        context.execution_result = result
        return await super().ahandle(context)


class FilterHandler(BaseHandler):
    def __init__(
        self, filters: Iterable[AbstractBaseFilter], next_handler: Optional[BaseHandler]
    ):
        super().__init__(next_handler)
        self.filters = filters

    def handle(self, context: Context):
        for f in self.filters:
            if isinstance(f, SyncFilter) and not f(context):
                return None
        return super().handle(context)

    async def ahandle(self, context: Context):
        for f in self.filters:
            if isinstance(f, SyncFilter) and not f(context):
                return None
            if isinstance(f, AsyncFilter) and not await f(context):
                return None
        return await super().ahandle(context)


# === Data & Utilities ===
@dataclass
class RedisHandlerRegistration:
    channel: str
    func: Union[Callable, Callable[..., Coroutine]]
    is_async: bool
    publish_channel: Optional[str]
    filters: Optional[Iterable[AbstractBaseFilter]]
    request_model: Optional[Type[RedisRequest]] = None
    response_model: Optional[Type[RedisResponse]] = None


class ResponseDTO(BaseModel):
    status: StatusCode = StatusCode.SUCCESS
    data: Any = None
    message: Optional[str] = None


class EntryHandler:
    def __init__(self, chain: BaseHandler):
        self.chain = chain

    @staticmethod
    def __context_builder(message: dict) -> Context:

        return Context(
            message=RedisMessage(
                channel=message["channel"],
                data=message["data"],
            )
        )

    def __call__(self, *args, **kwargs):

        return self.chain.handle(self.__context_builder(message=kwargs["message"]))

    async def __call__(self, *args, **kwargs):
        return await self.chain.ahandle(
            self.__context_builder(message=kwargs["message"])
        )


# === RedisRouter ===
class RedisRouter:
    def __init__(self, redis_service: RedisService):
        self.redis_service = redis_service
        self._registrations: list[RedisHandlerRegistration] = []

    @staticmethod
    def __validate_filters(
        filters: Optional[Iterable[AbstractBaseFilter]],
        expected: Union[type, tuple[type]],
    ):
        if not filters:
            return
        incorrect = [f for f in filters if not isinstance(f, expected)]
        if incorrect:
            raise FilterValidationException(incorrect)

    def register(
        self,
        subscribe_channel: str,
        handler: Union[Callable, Callable[..., Coroutine]],
        publish_channel: Optional[str] = None,
        filters: Optional[Iterable[AbstractBaseFilter]] = None,
        request_model: Optional[Type[RedisRequest]] = None,
        response_model: Optional[Type[RESP]] = None,
    ):
        if request_model is None:
            request_model = RedisRequest[dict]
        if response_model is None:
            response_model = RedisResponse[dict]
        is_async = inspect.iscoroutinefunction(handler)

        if is_async:
            self.__validate_filters(filters, (AsyncFilter, SyncFilter))
        else:
            self.__validate_filters(filters, SyncFilter)

        self._registrations.append(
            RedisHandlerRegistration(
                channel=subscribe_channel,
                func=handler,
                is_async=is_async,
                publish_channel=publish_channel,
                filters=filters,
                request_model=request_model,
                response_model=response_model,
            )
        )

    def redis_handler(
        self,
        subscribe_channel: str,
        publish_channel: Optional[str] = None,
        filters: Optional[Iterable[AbstractBaseFilter]] = None,
        request_model: Optional[Type[REQ]] = None,
        response_model: Optional[Type[RESP]] = None,
    ):
        def decorator(func: Union[Callable, Callable[..., Coroutine]]):

            self.register(
                subscribe_channel,
                handler=func,
                publish_channel=publish_channel,
                filters=filters,
                request_model=request_model,
                response_model=response_model,
            )
            return func

        return decorator

    async def register_all(self):
        await self.redis_service.connect()

        for reg in self._registrations:
            chain = self._build_handler_chain(reg)

            if reg.is_async:
                subscriber = AsyncPubsubSubscriber(callback=chain)
                await self.redis_service.asubscribe(reg.channel, subscriber)
            else:
                subscriber = SyncPubsubSubscriber(callback=chain)
                self.redis_service.subscribe(reg.channel, subscriber)

    def _build_handler_chain(self, reg: RedisHandlerRegistration) -> EntryHandler:
        chain: BaseHandler = EndpointHandler()

        if reg.publish_channel:
            chain = PublishHandler(reg.publish_channel, self.redis_service, chain)

        chain = ResponseValidationHandler(reg.response_model, chain)
        chain = ExecuteHandler(reg.func, chain)

        chain = RequestValidationHandler(reg.request_model, chain)
        if reg.filters:
            chain = FilterHandler(reg.filters, chain)
        chain = EntryHandler(chain=chain)
        return chain
