import threading

from services.graph.exceptions import StopSession


class StopEvent(threading.Event):
    def check_stop(self, *args, **kwargs):
        if self.is_set():
            raise StopSession(*args, **kwargs)