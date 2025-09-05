from abc import ABC
from enum import Enum
from typing import Any, Generic, Literal, Optional, TypeVar, Union
from pydantic import BaseModel, Field

# --- Generic base ---
T = TypeVar("T")
D = TypeVar("D", bound=Union[BaseModel, dict, list, str, int, float, None])

class AbstractRedisDTO(BaseModel, ABC):
    id: str


class RedisRequest(AbstractRedisDTO, Generic[D]):
    type: str
    data: D


class StatusCode(Enum):
    SUCCESS = "success"
    FAIL = "fail"
    ERROR = "error"


class RedisResponse(AbstractRedisDTO, Generic[D]):
    status: StatusCode
    data: Optional[D] = None
    message: Optional[str] = None