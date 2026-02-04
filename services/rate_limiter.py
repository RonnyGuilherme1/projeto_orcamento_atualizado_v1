from __future__ import annotations

import time
from collections import deque
from threading import Lock

from flask import request


class RateLimiter:
    def __init__(self) -> None:
        self._lock = Lock()
        self._buckets: dict[str, deque[float]] = {}

    def check(self, key: str, *, limit: int, window_seconds: int) -> tuple[bool, int | None]:
        if limit <= 0 or window_seconds <= 0:
            return True, None

        now = time.time()
        cutoff = now - window_seconds
        with self._lock:
            bucket = self._buckets.get(key)
            if bucket is None:
                bucket = deque()
                self._buckets[key] = bucket

            while bucket and bucket[0] < cutoff:
                bucket.popleft()

            if len(bucket) >= limit:
                retry = int(window_seconds - (now - bucket[0])) if bucket else window_seconds
                return False, max(retry, 1)

            bucket.append(now)
            return True, None


limiter = RateLimiter()


def client_ip() -> str:
    forwarded = request.headers.get("X-Forwarded-For", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.remote_addr or "unknown"


def rate_limit_key(action: str, identifier: str | None = None) -> str:
    base = f"{action}:{client_ip()}"
    if identifier:
        base = f"{base}:{identifier}"
    return base
