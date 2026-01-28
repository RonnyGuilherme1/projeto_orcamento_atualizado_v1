from __future__ import annotations

from datetime import datetime

from models.extensions import db


class Reminder(db.Model):
    __tablename__ = "reminders"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)

    name = db.Column(db.String(140), nullable=False)
    is_enabled = db.Column(db.Boolean, nullable=False, default=True)

    days_before = db.Column(db.Integer, nullable=False, default=3)

    tipo = db.Column(db.String(20), nullable=True)  # receita | despesa | null = ambos
    categoria = db.Column(db.String(32), nullable=True)
    status = db.Column(db.String(30), nullable=True)
    metodo = db.Column(db.String(24), nullable=True)

    min_value = db.Column(db.Float, nullable=True)
    max_value = db.Column(db.Float, nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(
        db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )
