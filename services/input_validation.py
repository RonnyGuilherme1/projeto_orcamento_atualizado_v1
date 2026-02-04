from __future__ import annotations

import os
from datetime import date


ALLOWED_ENTRY_TYPES = {"receita", "despesa"}
STATUS_BY_TYPE = {
    "receita": {"recebido"},
    "despesa": {"em_andamento", "pago", "nao_pago"},
}
ALLOWED_METHODS = {"dinheiro", "cartao", "pix", "credito", "debito", "boleto"}
ALLOWED_PRIORITIES = {"alta", "media", "baixa"}

MAX_ENTRY_VALUE = float(os.getenv("ENTRY_MAX_VALUE", "1000000000"))
MAX_DESCRIPTION_LEN = int(os.getenv("ENTRY_DESC_MAX_LEN", "255"))
MAX_NAME_LEN = int(os.getenv("NAME_MAX_LEN", "140"))
MAX_TAGS_LEN = int(os.getenv("TAGS_MAX_LEN", "255"))
MAX_METHOD_LEN = int(os.getenv("METHOD_MAX_LEN", "24"))


def normalize_tipo(value: str | None) -> str | None:
    if not value:
        return None
    tipo = str(value).strip().lower()
    if tipo in ALLOWED_ENTRY_TYPES:
        return tipo
    return None


def parse_iso_date(value: str | None) -> date | None:
    if not value:
        return None
    try:
        return date.fromisoformat(str(value)[:10])
    except (TypeError, ValueError):
        return None


def normalize_status(tipo: str | None, status: str | None) -> str | None:
    if not status:
        return None
    if not tipo:
        return None
    status_norm = str(status).strip().lower()
    allowed = STATUS_BY_TYPE.get(tipo)
    if not allowed:
        return None
    if status_norm in allowed:
        return status_norm
    return None


def parse_amount(value) -> float | None:
    try:
        amount = float(value)
    except (TypeError, ValueError):
        return None
    if amount < 0:
        return None
    if amount > MAX_ENTRY_VALUE:
        return None
    return round(amount, 2)


def normalize_method(value: str | None) -> str | None:
    if value is None:
        return None
    text = str(value).strip().lower()
    if not text:
        return None
    if len(text) > MAX_METHOD_LEN:
        return None
    if text in ALLOWED_METHODS:
        return text
    return None


def normalize_priority(value: str | None) -> str:
    if not value:
        return "media"
    text = str(value).strip().lower()
    if text in ALLOWED_PRIORITIES:
        return text
    return "media"


def normalize_text(value: str | None, *, max_len: int, min_len: int = 0) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    if min_len and len(text) < min_len:
        return None
    if len(text) > max_len:
        return None
    return text


def normalize_tags(value: str | None) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    if len(text) > MAX_TAGS_LEN:
        return None
    return text
