from datetime import datetime

from models.extensions import db


class UserProfile(db.Model):
    __tablename__ = "user_profiles"

    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), primary_key=True)

    full_name = db.Column(db.String(120), nullable=False, default="")
    cpf = db.Column(db.String(14), nullable=False, default="")       # armazenar formatado ou só dígitos
    phone = db.Column(db.String(20), nullable=False, default="")     # (xx) xxxxx-xxxx ou só dígitos

    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, nullable=True)
