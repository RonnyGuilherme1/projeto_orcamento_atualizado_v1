from datetime import datetime

from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
from flask import current_app

from models.extensions import db


class User(UserMixin, db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False, index=True)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    is_verified = db.Column(db.Boolean, default=False, nullable=False)

    # billing / planos (MVP)
    plan = db.Column(db.String(20), default="basic", nullable=False)
    plan_updated_at = db.Column(db.DateTime, nullable=True)
    plan_expires_at = db.Column(db.DateTime, nullable=True)
    plan_last_paid_at = db.Column(db.DateTime, nullable=True)
    notify_due_alert = db.Column(db.Boolean, default=True, nullable=False)

    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    # ---------------- Dados pessoais (checkout/pagamento) ----------------
    # Mantidos no próprio usuário para evitar uma tabela extra no MVP.
    full_name = db.Column(db.String(255), nullable=True)
    # Armazenamos apenas dígitos (ex.: CPF) para facilitar validação/sanitização.
    tax_id = db.Column(db.String(32), nullable=True)
    # Armazenamos apenas dígitos para facilitar normalização.
    cellphone = db.Column(db.String(32), nullable=True)
    # Cache do customerId no provedor de pagamento (AbacatePay).
    abacatepay_customer_id = db.Column(db.String(64), nullable=True)

    entradas = db.relationship(
        "Entrada",
        backref="user",
        lazy=True,
        cascade="all, delete-orphan",
    )

    # Perfil 1:1 (Opção 1)
    profile = db.relationship(
        "UserProfile",
        uselist=False,
        backref="user",
        cascade="all, delete-orphan",
        lazy="joined",
    )

    def set_password(self, password: str) -> None:
        self.password_hash = generate_password_hash(password)

    def check_password(self, password: str) -> bool:
        return check_password_hash(self.password_hash, password)

    def set_plan(self, plan: str) -> None:
        """Define o plano do usuário.
        Planos suportados (MVP): basic | plus | pro
        """
        plan = (plan or "").strip().lower()
        if plan not in {"basic", "plus", "pro"}:
            plan = "basic"
        self.plan = plan

    # Token de verificação (seu projeto já tinha isso)
    @staticmethod
    def _serializer():
        return URLSafeTimedSerializer(current_app.config["SECRET_KEY"])

    def generate_verify_token(self) -> str:
        s = self._serializer()
        return s.dumps({"uid": self.id, "email": self.email})

    def get_verification_token(self) -> str:
        # Backwards compatibility for older callers.
        return self.generate_verify_token()

    @staticmethod
    def verify_token(token: str, max_age_seconds: int = 60 * 60 * 24):
        s = User._serializer()
        try:
            data = s.loads(token, max_age=max_age_seconds)
        except (BadSignature, SignatureExpired):
            return None

        user_id = data.get("uid")
        if not user_id:
            return None
        return User.query.get(int(user_id))
