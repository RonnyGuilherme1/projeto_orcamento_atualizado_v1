from __future__ import annotations

from urllib.parse import urlparse


def safe_redirect_path(value: str | None, *, allowed_prefixes: tuple[str, ...] = ("/app/",)) -> str | None:
    if not value:
        return None
    raw = str(value).strip()
    if not raw or not raw.startswith("/"):
        return None
    if raw.startswith("//"):
        return None
    if "\\" in raw:
        return None

    parsed = urlparse(raw)
    if parsed.scheme or parsed.netloc:
        return None

    path = parsed.path or ""
    if not any(path.startswith(prefix) for prefix in allowed_prefixes):
        return None
    return raw
