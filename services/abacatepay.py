from __future__ import annotations

from typing import Any, Dict, Optional

import requests
from flask import current_app

from services.plans import PLANS


class AbacatePayError(RuntimeError):
    pass


def _api_key() -> str:
    key = (current_app.config.get("ABACATEPAY_API_KEY") or "").strip()
    if not key:
        raise AbacatePayError("ABACATEPAY_API_KEY não configurada.")
    return key


def create_plan_billing(
    plan: str,
    external_id: str,
    return_url: str,
    completion_url: str,
    customer: Dict[str, Any] | None = None,
    customer_id: str | None = None,
) -> Dict[str, str]:
    """Cria uma cobranca ONE_TIME para o plano selecionado.

    Docs: POST /v1/billing/create retorna data.url (link de pagamento) e data.id.
    """

    plan = (plan or "").strip().lower()
    plan_def = PLANS.get(plan)
    if not plan_def:
        raise AbacatePayError(f"Plano inválido: {plan}")

    # valida customer mínimo
    for k in ("name", "email", "cellphone", "taxId"):
        if not (customer.get(k) or "").strip():
            raise AbacatePayError(f"Dados do cliente incompletos: faltando {k}")

    amount_cents = int(round(float(plan_def["price_month"]) * 100))

    payload: Dict[str, Any] = {
        "frequency": "ONE_TIME",
        "methods": ["PIX"],
        "products": [
            {
                "externalId": f"plan:{plan}",
                "name": f"{plan_def['name']} (1 mês)",
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
        "customer": {
            "name": customer["name"],
            "email": customer["email"],
            "cellphone": customer["cellphone"],
            "taxId": customer["taxId"],
        },
    }

    # AbacatePay aceita customerId (cliente já cadastrado) ou customer (cria caso não exista).
    # Mantemos compatibilidade: se o caller enviar customer_id usamos; caso contrário, enviamos customer.
    if customer_id:
        payload["customerId"] = customer_id
    elif customer:
        payload["customer"] = customer

    url = "https://api.abacatepay.com/v1/billing/create"
    resp = requests.post(
        url,
        json=payload,
        headers={"Authorization": f"Bearer {_api_key()}", "Content-Type": "application/json"},
        timeout=25,
    )

    try:
        data = resp.json()
    except Exception:
        raise AbacatePayError(f"Resposta inválida da AbacatePay (HTTP {resp.status_code}).")

    # AbacatePay pode retornar 200 com success=false
    if (not resp.ok) or (data.get("success") is False):
        err = data.get("error") or data.get("message") or data
        raise AbacatePayError(f"Erro AbacatePay: {err}")

    billing = data.get("data") or data
    # normaliza chaves usadas no seu app
    billing_id = billing.get("billingId") or billing.get("billing_id") or billing.get("id")
    pay_url = billing.get("url") or billing.get("checkoutUrl") or billing.get("checkout_url")

    body = resp.json() or {}
    # A API retorna { data: ..., error: ... }.
    # Em alguns cenários error pode vir preenchido mesmo com HTTP 200.
    if body.get("error"):
        raise AbacatePayError(f"Erro AbacatePay: {body.get('error')}")

    data = body.get("data") or {}
    billing_id = data.get("id")
    pay_url = data.get("url")
    if not billing_id or not pay_url:
        raise AbacatePayError("AbacatePay não retornou billing_id/url.")

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


def get_billing_status(billing_id: str) -> str | None:
    if not billing_id:
        return None

    headers = {"Authorization": f"Bearer {_api_key()}", "Content-Type": "application/json"}
    url = "https://api.abacatepay.com/v1/billing/get"

    attempts = [
        ("GET", {"id": billing_id}),
        ("GET", {"billingId": billing_id}),
        ("POST", {"id": billing_id}),
        ("POST", {"billingId": billing_id}),
    ]
    last_error: str | None = None

    for method, payload in attempts:
        try:
            if method == "GET":
                resp = requests.get(url, params=payload, headers=headers, timeout=20)
            else:
                resp = requests.post(url, json=payload, headers=headers, timeout=20)
        except requests.RequestException as exc:
            last_error = str(exc)
            continue

        try:
            body = resp.json()
        except Exception:
            last_error = f"Resposta invalida da AbacatePay (HTTP {resp.status_code})."
            continue

        if (not resp.ok) or (body.get("success") is False):
            err = body.get("error") or body.get("message") or f"HTTP {resp.status_code}"
            last_error = str(err)
            continue

        data = body.get("data") or body
        if isinstance(data, dict) and isinstance(data.get("billing"), dict):
            data = data["billing"]

        status = _normalize_billing_status(data.get("status") or data.get("paymentStatus"))
        if status:
            return status

    if last_error:
        raise AbacatePayError(f"Erro AbacatePay: {last_error}")
    return None
