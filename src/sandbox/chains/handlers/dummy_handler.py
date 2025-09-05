from .base_handler import AbstractHandler


class DummyHandler(AbstractHandler):
    async def handle(self, context):
        return await super().handle(context)
