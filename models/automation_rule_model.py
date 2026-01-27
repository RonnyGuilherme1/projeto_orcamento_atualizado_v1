from __future__ import annotations

from datetime import datetime

from models.extensions import db


class AutomationRule(db.Model):
    __tablename__ = "automation_rules"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)

    name = db.Column(db.String(140), nullable=False)
    is_enabled = db.Column(db.Boolean, nullable=False, default=True)
    priority = db.Column(db.Integer, nullable=False, default=100)

    apply_on_create = db.Column(db.Boolean, nullable=False, default=True)
    apply_on_import = db.Column(db.Boolean, nullable=False, default=False)
    apply_on_edit = db.Column(db.Boolean, nullable=False, default=False)
    stop_after_apply = db.Column(db.Boolean, nullable=False, default=False)

    conditions_json = db.Column(db.Text, nullable=False, default="[]")
    actions_json = db.Column(db.Text, nullable=False, default="[]")

    run_count = db.Column(db.Integer, nullable=False, default=0)
    last_run_at = db.Column(db.DateTime, nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(
        db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )


class RuleExecution(db.Model):
    __tablename__ = "rule_executions"

    id = db.Column(db.Integer, primary_key=True)
    rule_id = db.Column(db.Integer, db.ForeignKey("automation_rules.id"), nullable=False)
    entry_id = db.Column(db.Integer, db.ForeignKey("entradas.id"), nullable=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)

    trigger = db.Column(db.String(20), nullable=False, default="create")
    matched = db.Column(db.Boolean, nullable=False, default=False)
    changes_json = db.Column(db.Text, nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
