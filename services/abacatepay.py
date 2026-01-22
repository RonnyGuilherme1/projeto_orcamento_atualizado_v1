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
