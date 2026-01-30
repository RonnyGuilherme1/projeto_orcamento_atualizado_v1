from __future__ import annotations

from datetime import datetime

from models.extensions import db


class ProjectionScenario(db.Model):
    __tablename__ = "projection_scenarios"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)

    name = db.Column(db.String(80), nullable=False)
    # JSON serializado (texto) para manter compatibilidade SQLite/Postgres sem Alembic.
    data_json = db.Column(db.Text, nullable=False, default="{}")

    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
