"""Small in-process LRU cache where concurrent callers for the same key share one computation."""
import threading
from collections import OrderedDict


class SharedCache:
    def __init__(self, maxsize):
        self.maxsize = maxsize
        self._values = OrderedDict()
        self._inflight = {}  # key -> lock held while one caller computes the value
        self._lock = threading.Lock()

    def get(self, key, compute):
        with self._lock:
            if key in self._values:
                self._values.move_to_end(key)
                return self._values[key]
            key_lock = self._inflight.setdefault(key, threading.Lock())

        with key_lock:
            # Another caller may have finished while we waited
            with self._lock:
                if key in self._values:
                    return self._values[key]
            value = compute()  # exceptions propagate and nothing is cached
            with self._lock:
                self._values[key] = value
                while len(self._values) > self.maxsize:
                    self._values.popitem(last=False)
                self._inflight.pop(key, None)
            return value
