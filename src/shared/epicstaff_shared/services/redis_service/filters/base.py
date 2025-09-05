from abc import ABC, abstractmethod
from typing import TYPE_CHECKING, Any, Awaitable, Callable, Dict, Union


class AbstractBaseFilter(ABC):

    def _signature_to_string(self, *args: Any, **kwargs: Any) -> str:
        items = [repr(arg) for arg in args]
        items.extend([f"{k}={v!r}" for k, v in kwargs.items() if v is not None])

        return f"{type(self).__name__}({', '.join(items)})"


class AsyncFilter(AbstractBaseFilter):
    @abstractmethod
    async def __call__(self, *args: Any, **kwargs: Any) -> bool:
        """
        This method should be overridden.

        Accepts incoming event and should return boolean.

        :return: :class:`bool`
        """
        pass

    def __await__(self):  # type: ignore # pragma: no cover
        # Is needed only for inspection and this method is never be called
        return self.__call__


class SyncFilter(ABC):

    @abstractmethod
    def __call__(self, *args: Any, **kwargs: Any) -> bool:
        """
        This method should be overridden.

        Accepts incoming event and should return boolean.

        :return: :class:`bool`
        """
        pass
