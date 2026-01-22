from __future__ import annotations

from datetime import datetime

from models.extensions import db


class CheckoutOrder(db.Model):
    """Representa um pedido de checkout para associar plano apos pagamento.

    Mantemos simples (MVP): 1 cobranca AbacatePay -> 1 token -> 1 plano.
    """

    __tablename__ = "checkout_orders"

    id = db.Column(db.Integer, primary_key=True)

    token = db.Column(db.String(64), unique=True, nullable=False, index=True)
    plan = db.Column(db.String(20), nullable=False)

    billing_id = db.Column(db.String(64), unique=True, nullable=True, index=True)
    status = db.Column(db.String(20), default="PENDING", nullable=False)

    # se o usuario se cadastrar/logar depois, podemos ligar o pedido
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True, index=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    paid_at = db.Column(db.DateTime, nullable=True)
