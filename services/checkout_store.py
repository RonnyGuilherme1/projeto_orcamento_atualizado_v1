from __future__ import annotations

import secrets
from dataclasses import dataclass
from datetime import datetime

from models.extensions import db
from models.checkout_model import CheckoutOrder as CheckoutOrderModel
from models.user_model import User
from services.subscription import apply_paid_order


@dataclass
class CheckoutOrder:
    id: int
    token: str
    plan: str
    billing_id: str | None
    status: str
    user_id: int | None
    created_at: datetime | None
    paid_at: datetime | None


def _to_dto(m: CheckoutOrderModel) -> CheckoutOrder:
    return CheckoutOrder(
        id=m.id,
        token=m.token,
        plan=m.plan,
        billing_id=m.billing_id,
        status=m.status,
        user_id=m.user_id,
        created_at=m.created_at,
        paid_at=m.paid_at,
    )


def create_order(plan: str, user_id: int | None = None) -> CheckoutOrder:
    token = secrets.token_urlsafe(32)
    m = CheckoutOrderModel(token=token, plan=plan, status="PENDING", user_id=user_id)
    db.session.add(m)
    db.session.commit()
    return _to_dto(m)


def get_order_by_billing_id(billing_id: str) -> CheckoutOrder | None:
    if not billing_id:
        return None
    m = CheckoutOrderModel.query.filter_by(billing_id=billing_id).first()
    return _to_dto(m) if m else None


def set_order_billing_id(token: str, billing_id: str) -> bool:
    if not token or not billing_id:
        return False
    m = CheckoutOrderModel.query.filter_by(token=token).first()
    if not m:
        return False
    if m.billing_id and m.billing_id != billing_id:
        return False
    m.billing_id = billing_id
    db.session.commit()
    return True


def get_order_by_token(token: str) -> CheckoutOrder | None:
    if not token:
        return None
    m = CheckoutOrderModel.query.filter_by(token=token).first()
    return _to_dto(m) if m else None


def list_orders_by_user(user_id: int, limit: int = 10) -> list[CheckoutOrder]:
    if not user_id:
        return []
    query = CheckoutOrderModel.query.filter_by(user_id=user_id).order_by(
        CheckoutOrderModel.created_at.desc()
    )
    if limit:
        query = query.limit(limit)
    return [_to_dto(m) for m in query.all()]


def mark_order_paid_by_billing_id(billing_id: str) -> bool:
    if not billing_id:
        return False
    m = CheckoutOrderModel.query.filter_by(billing_id=billing_id).first()
    if not m:
        return False
    if m.status != "PAID":
        m.status = "PAID"
        m.paid_at = datetime.utcnow()
        db.session.commit()
    return True


def mark_order_paid_by_token(token: str) -> bool:
    if not token:
        return False
    m = CheckoutOrderModel.query.filter_by(token=token).first()
    if not m:
        return False
    if m.status != "PAID":
        m.status = "PAID"
        m.paid_at = datetime.utcnow()
        db.session.commit()
    return True


def try_apply_paid_order_to_user(token: str, user: User) -> bool:
    """Se existir um pedido pago, aplica o plano ao usuario e vincula o pedido.

    Usado no fluxo pos-checkout: o cliente paga e, em seguida, cria conta ou
    faz login para associar o plano.
    """
    if not token or not user:
        return False
    if not getattr(user, "is_verified", False):
        return False

    m = CheckoutOrderModel.query.filter_by(token=token).first()
    if not m:
        return False
    if m.status != "PAID":
        return False

    # Se o pedido ja estiver vinculado a outro usuario, nao sobrescrevemos.
    if m.user_id and m.user_id != user.id:
        return False

    applied = apply_paid_order(user, m)
    user_id_changed = m.user_id != user.id
    m.user_id = user.id
    if applied or user_id_changed:
        db.session.commit()
    return applied
