from __future__ import annotations

import logging
import re
import unicodedata
from typing import Any, Dict, Optional

import requests
from flask import current_app

from services.plans import PLANS

logger = logging.getLogger(__name__)


class AbacatePayError(RuntimeError):
    pass


def _api_key() -> str:
    key = (current_app.config.get("ABACATEPAY_API_KEY") or "").strip()
    if not key:
        raise AbacatePayError("ABACATEPAY_API_KEY nÃ£o configurada.")
    return key


def _api_base() -> str:
    base = (current_app.config.get("ABACATEPAY_BASE_URL") or "").strip()
    if base:
        return base.rstrip("/")
    return "https://api.abacatepay.com"


def payment_warning_message(raw: str) -> str:
    if current_app.config.get("ABACATEPAY_DEV_MODE"):
        return raw
    return "Nao foi possivel validar o pagamento agora. Tente novamente em alguns minutos."


def _only_digits(value: str) -> str:
    return re.sub(r"\D+", "", value or "")


def _format_tax_id(value: str) -> str:
    raw = (value or "").strip()
    digits = _only_digits(raw)
    if len(digits) == 11:
        return f"{digits[0:3]}.{digits[3:6]}.{digits[6:9]}-{digits[9:11]}"
    if len(digits) == 14:
        return f"{digits[0:2]}.{digits[2:5]}.{digits[5:8]}/{digits[8:12]}-{digits[12:14]}"
    return raw


def _format_cellphone(value: str) -> str:
    raw = (value or "").strip()
    digits = _only_digits(raw)
    if len(digits) == 10:
        return f"({digits[0:2]}) {digits[2:6]}-{digits[6:10]}"
    if len(digits) == 11:
        return f"({digits[0:2]}) {digits[2:7]}-{digits[7:11]}"
    return raw


def _ascii_text(value: str) -> str:
    if not value:
        return ""
    raw = str(value)
    if any(ord(ch) in (194, 195) for ch in raw):
        try:
            raw = raw.encode("latin1").decode("utf-8")
        except UnicodeError:
            raw = str(value)
    return unicodedata.normalize("NFKD", raw).encode("ascii", "ignore").decode("ascii")


def _normalize_customer(customer: Dict[str, Any]) -> Dict[str, str]:
    return {
        "name": (customer.get("name") or "").strip(),
        "email": (customer.get("email") or "").strip(),
        "cellphone": _format_cellphone(str(customer.get("cellphone") or "")),
        "taxId": _format_tax_id(str(customer.get("taxId") or "")),
    }


def _normalize_methods(methods: list[str] | None) -> list[str]:
    allowed = {"PIX", "CARD"}
    if methods:
        raw_methods = methods
    else:
        raw_methods = ["PIX"]
        if current_app.config.get("ABACATEPAY_CARD_ENABLED"):
            raw_methods.append("CARD")

    normalized = []
    seen = set()
    for method in raw_methods:
        if not method:
            continue
        item = str(method).strip().upper()
        if item in allowed and item not in seen:
            normalized.append(item)
            seen.add(item)
        if len(normalized) >= 2:
            break

    return normalized or ["PIX"]


def create_plan_billing(
    plan: str,
    external_id: str,
    return_url: str,
    completion_url: str,
    customer: Dict[str, Any] | None = None,
    customer_id: str | None = None,
    methods: list[str] | None = None,
) -> Dict[str, str]:
    """Cria uma cobranca ONE_TIME para o plano selecionado.

    Docs: POST /v1/billing/create retorna data.url (link de pagamento) e data.id.
    """

    plan = (plan or "").strip().lower()
    plan_def = PLANS.get(plan)
    if not plan_def:
        raise AbacatePayError(f"Plano invÃ¡lido: {plan}")

    customer_payload: Dict[str, str] | None = None
    if customer:
        customer_payload = _normalize_customer(customer)
        # valida customer mÃ­nimo
        for k in ("name", "email", "cellphone", "taxId"):
            if not (customer_payload.get(k) or "").strip():
                raise AbacatePayError(f"Dados do cliente incompletos: faltando {k}")
    if not customer_id and not customer_payload:
        raise AbacatePayError("Dados do cliente incompletos: faltando customer")

    amount_cents = int(round(float(plan_def["price_month"]) * 100))

    product_name = _ascii_text(plan_def["name"]) or "Plano"
    product_external_id = f"plan-{plan}-{external_id[:8]}"

    payload: Dict[str, Any] = {
        "frequency": "ONE_TIME",
        "methods": _normalize_methods(methods),
        "products": [
            {
                "externalId": product_external_id,
                "name": f"{product_name} (1 mes)",
                "description": "Acesso ao sistema de controle financeiro.",
                "quantity": 1,
                "price": amount_cents,
            }
        ],
        "returnUrl": return_url,
        "completionUrl": completion_url,
        "externalId": external_id,
        "metadata": {"plan": plan, "orderToken": external_id},
        "allowCoupons": False,
    }

    # AbacatePay aceita customerId (cliente jÃ¡ cadastrado) ou customer (cria caso nÃ£o exista).
    # Mantemos compatibilidade: se o caller enviar customer_id usamos; caso contrÃ¡rio, enviamos customer.
    if customer_id:
        payload["customerId"] = customer_id
    elif customer_payload:
        payload["customer"] = customer_payload

    url = f"{_api_base()}/v1/billing/create"
    resp = requests.post(
        url,
        json=payload,
        headers={"Authorization": f"Bearer {_api_key()}", "Content-Type": "application/json"},
        timeout=25,
    )

    try:
        body = resp.json()
    except ValueError as exc:
        snippet = (resp.text or "").strip()
        logger.warning(
            "AbacatePay: JSON invalido em /v1/billing/create (HTTP %s). Trecho: %s",
            resp.status_code,
            snippet[:300],
            exc_info=True,
        )
        if "too many requests" in snippet.lower():
            raise AbacatePayError(
                "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente."
            )
        if current_app.config.get("ABACATEPAY_DEV_MODE") and snippet:
            raise AbacatePayError(
                f"Resposta invalida da AbacatePay (HTTP {resp.status_code}): {snippet[:300]}"
            )
        raise AbacatePayError(f"Resposta invalida da AbacatePay (HTTP {resp.status_code}).")

    # AbacatePay pode retornar 200 com success=false
    if (not resp.ok) or (body.get("success") is False):
        err = body.get("error") or body.get("message") or body
        if isinstance(err, str) and "too many requests" in err.lower():
            err = "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente."
        raise AbacatePayError(f"Erro AbacatePay: {err}")

    body = body or {}
    # A API retorna { data: ..., error: ... }.
    # Em alguns cenÃ¡rios error pode vir preenchido mesmo com HTTP 200.
    if body.get("error"):
        raise AbacatePayError(f"Erro AbacatePay: {body.get('error')}")

    data = body.get("data") or {}
    billing_id = (
        data.get("id")
        or data.get("billingId")
        or data.get("billing_id")
        or data.get("pixQrCodeId")
        or data.get("pix_qr_code_id")
    )
    pay_url = data.get("url") or data.get("checkoutUrl") or data.get("checkout_url")
    if not billing_id or not pay_url:
        raise AbacatePayError("AbacatePay nÃ£o retornou billing_id/url.")

    return {"billing_id": billing_id, "url": pay_url}


def _normalize_billing_status(status: str | None) -> str | None:
    if not status:
        return None
    s = status.strip().upper()
    if s in {"PAID", "CONFIRMED", "APPROVED", "SUCCESS"}:
        return "PAID"
    if s in {"PENDING", "WAITING", "CREATED", "PROCESSING"}:
        return "PENDING"
    return s


def _extract_status_from_data(data: Any) -> str | None:
    if isinstance(data, dict) and isinstance(data.get("billing"), dict):
        data = data["billing"]
    if isinstance(data, dict) and isinstance(data.get("items"), list) and data["items"]:
        data = data["items"][0]

    status_raw = None
    if isinstance(data, dict):
        status_raw = data.get("status") or data.get("paymentStatus") or data.get("payment_status")
        if not status_raw and data.get("paid") is True:
            status_raw = "PAID"
        if not status_raw and data.get("isPaid") is True:
            status_raw = "PAID"

    return _normalize_billing_status(status_raw)


def get_billing_status(billing_id: str | None, external_id: str | None = None) -> str | None:
    billing_id = (billing_id or "").strip() or None
    external_id = (external_id or "").strip() or None
    if not billing_id and not external_id:
        return None

    headers = {"Authorization": f"Bearer {_api_key()}", "Content-Type": "application/json"}
    base = _api_base()

    params_list = []
    if billing_id:
        params_list.extend(
            [
                {"id": billing_id},
                {"billingId": billing_id},
            ]
        )
    if external_id:
        params_list.extend(
            [
                {"externalId": external_id},
                {"external_id": external_id},
            ]
        )

    attempts = []
    if billing_id and not billing_id.startswith("bill_"):
        attempts.append(("GET", f"{base}/v1/pixQrCode/check", {"id": billing_id}))

    for endpoint in ("/v1/billing/get", "/v1/billing/status", "/v1/billing"):
        url = f"{base}{endpoint}"
        for payload in params_list:
            attempts.append(("GET", url, payload))
            attempts.append(("POST", url, payload))
    if billing_id:
        attempts.append(("GET", f"{base}/v1/billing/{billing_id}", None))

    last_error: str | None = None

    for method, url, payload in attempts:
        try:
            if method == "GET":
                resp = requests.get(url, params=payload, headers=headers, timeout=20)
            else:
                resp = requests.post(url, json=payload, headers=headers, timeout=20)
        except requests.RequestException as exc:
            last_error = str(exc)
            logger.warning("AbacatePay: falha na requisicao %s %s", method, url, exc_info=True)
            continue

        try:
            body = resp.json()
        except ValueError as exc:
            last_error = f"Resposta invalida da AbacatePay (HTTP {resp.status_code})."
            logger.warning(
                "AbacatePay: JSON invalido em %s %s (HTTP %s)",
                method,
                url,
                resp.status_code,
                exc_info=True,
            )
            continue

        if (not resp.ok) or (body.get("success") is False):
            err = body.get("error") or body.get("message") or f"HTTP {resp.status_code}"
            last_error = str(err)
            continue

        status = _extract_status_from_data(body.get("data") or body)
        if status:
            return status

    # Fallback em dev: listar cobrancas e filtrar por id/externalId.
    if current_app.config.get("ABACATEPAY_DEV_MODE"):
        try:
            resp = requests.get(f"{base}/v1/billing/list", headers=headers, timeout=20)
            body = resp.json()
        except requests.RequestException as exc:
            logger.warning("AbacatePay: falha ao listar cobrancas (dev)", exc_info=True)
            if last_error:
                raise AbacatePayError(f"Erro AbacatePay: {last_error}")
            raise AbacatePayError(f"Erro AbacatePay: {exc}")
        except ValueError as exc:
            logger.warning("AbacatePay: JSON invalido ao listar cobrancas (dev)", exc_info=True)
            if last_error:
                raise AbacatePayError(f"Erro AbacatePay: {last_error}")
            raise AbacatePayError(f"Erro AbacatePay: {exc}")

        if resp.ok and (body.get("success") is not False):
            for item in body.get("data") or []:
                if not isinstance(item, dict):
                    continue
                item_id = str(item.get("id") or item.get("billingId") or item.get("billing_id") or "").strip()
                item_external = str(item.get("externalId") or item.get("external_id") or "").strip()
                if (billing_id and item_id == billing_id) or (external_id and item_external == external_id):
                    status = _extract_status_from_data(item)
                    if status:
                        return status

    if last_error:
        raise AbacatePayError(f"Erro AbacatePay: {last_error}")
    return None


def list_billings() -> list[dict]:
    headers = {"Authorization": f"Bearer {_api_key()}", "Content-Type": "application/json"}
    url = f"{_api_base()}/v1/billing/list"
    try:
        resp = requests.get(url, headers=headers, timeout=20)
        body = resp.json()
    except requests.RequestException as exc:
        logger.warning("AbacatePay: falha ao listar cobrancas", exc_info=True)
        raise AbacatePayError(f"Erro AbacatePay: {exc}")
    except ValueError as exc:
        logger.warning("AbacatePay: JSON invalido ao listar cobrancas", exc_info=True)
        raise AbacatePayError(f"Erro AbacatePay: {exc}")

    if (not resp.ok) or (body.get("success") is False):
        err = body.get("error") or body.get("message") or f"HTTP {resp.status_code}"
        raise AbacatePayError(f"Erro AbacatePay: {err}")

    data = body.get("data") or []
    if not isinstance(data, list):
        return []
    return [item for item in data if isinstance(item, dict)]
