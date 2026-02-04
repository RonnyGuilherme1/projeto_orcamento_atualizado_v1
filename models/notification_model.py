from __future__ import annotations

from datetime import datetime

from models.extensions import db


class Notification(db.Model):
    __tablename__ = "notifications"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)

    source_key = db.Column(db.String(180), nullable=False)
    type = db.Column(db.String(20), nullable=False)
    title = db.Column(db.String(140), nullable=False)
    message = db.Column(db.String(255), nullable=True)
    href = db.Column(db.String(255), nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    read_at = db.Column(db.DateTime, nullable=True)

    __table_args__ = (
        db.UniqueConstraint("user_id", "source_key", name="notifications_user_source_key_unique"),
    )
