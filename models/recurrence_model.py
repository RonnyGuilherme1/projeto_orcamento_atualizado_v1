from __future__ import annotations

from datetime import datetime

from models.extensions import db


class Recurrence(db.Model):
    __tablename__ = "recurrences"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)

    name = db.Column(db.String(140), nullable=False)
    is_enabled = db.Column(db.Boolean, nullable=False, default=True)

    frequency = db.Column(db.String(20), nullable=False, default="monthly")
    day_of_month = db.Column(db.Integer, nullable=False, default=1)

    tipo = db.Column(db.String(20), nullable=False)  # receita | despesa
    descricao = db.Column(db.String(255), nullable=False)
    categoria = db.Column(db.String(32), nullable=False, default="outros")
    valor = db.Column(db.Float, nullable=False, default=0.0)

    status = db.Column(db.String(30), nullable=True)  # para despesa
    metodo = db.Column(db.String(24), nullable=True)
    tags = db.Column(db.String(255), nullable=True)

    last_run_at = db.Column(db.DateTime, nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(
        db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )


class RecurrenceExecution(db.Model):
    __tablename__ = "recurrence_executions"

    id = db.Column(db.Integer, primary_key=True)
    recurrence_id = db.Column(db.Integer, db.ForeignKey("recurrences.id"), nullable=False)
    entry_id = db.Column(db.Integer, db.ForeignKey("entradas.id"), nullable=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
