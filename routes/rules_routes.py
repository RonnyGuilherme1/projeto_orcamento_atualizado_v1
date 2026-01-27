from __future__ import annotations

import json
from datetime import date

from flask import Blueprint, jsonify, request
from flask_login import login_required, current_user

from models.automation_rule_model import AutomationRule, RuleExecution
from models.entrada_model import Entrada
from models.extensions import db
from services.feature_gate import require_feature
from services.rules_engine import apply_rule_to_entry, normalize_category


rules_bp = Blueprint("rules", __name__)


def _parse_bool(value, default=False) -> bool:
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


def _parse_int(value, default=0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _parse_iso_date(value: str | None) -> date | None:
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        return None


def _safe_list(value) -> list[dict]:
    if isinstance(value, list):
        return [item for item in value if isinstance(item, dict)]
    return []


def _serialize_rule(rule: AutomationRule) -> dict:
    return {
        "id": rule.id,
        "name": rule.name,
        "is_enabled": bool(rule.is_enabled),
        "priority": rule.priority,
        "apply_on_create": bool(rule.apply_on_create),
        "apply_on_edit": bool(rule.apply_on_edit),
        "apply_on_import": bool(rule.apply_on_import),
        "stop_after_apply": bool(rule.stop_after_apply),
        "conditions": json.loads(rule.conditions_json or "[]"),
        "actions": json.loads(rule.actions_json or "[]"),
        "run_count": rule.run_count or 0,
        "last_run_at": rule.last_run_at.isoformat() if rule.last_run_at else None,
        "created_at": rule.created_at.isoformat() if rule.created_at else None,
    }


def _apply_rule_payload(rule: AutomationRule, payload: dict) -> None:
    rule.name = (payload.get("name") or "Nova regra").strip()
    rule.priority = _parse_int(payload.get("priority"), 100)
    rule.is_enabled = _parse_bool(payload.get("is_enabled"), True)

    rule.apply_on_create = _parse_bool(payload.get("apply_on_create"), True)
    rule.apply_on_edit = _parse_bool(payload.get("apply_on_edit"), False)
    rule.apply_on_import = _parse_bool(payload.get("apply_on_import"), False)
    rule.stop_after_apply = _parse_bool(payload.get("stop_after_apply"), False)

    conditions = _safe_list(payload.get("conditions"))
    actions = _safe_list(payload.get("actions"))
    rule.conditions_json = json.dumps(conditions, ensure_ascii=True)
    rule.actions_json = json.dumps(actions, ensure_ascii=True)


@rules_bp.get("/api/rules")
@login_required
@require_feature("filters")
def list_rules():
    rules = (
        AutomationRule.query.filter_by(user_id=current_user.id)
        .order_by(AutomationRule.priority.asc(), AutomationRule.id.asc())
        .all()
    )
    return jsonify({"rules": [_serialize_rule(rule) for rule in rules]})


@rules_bp.post("/api/rules")
@login_required
@require_feature("filters")
def create_rule():
    payload = request.json or {}
    rule = AutomationRule(user_id=current_user.id)
    _apply_rule_payload(rule, payload)

    if not json.loads(rule.actions_json or "[]"):
        return jsonify({"error": "acoes_obrigatorias"}), 400

    db.session.add(rule)
    db.session.commit()
    return jsonify({"ok": True, "rule": _serialize_rule(rule)})


@rules_bp.put("/api/rules/<int:rule_id>")
@login_required
@require_feature("filters")
def update_rule(rule_id: int):
    rule = AutomationRule.query.filter_by(id=rule_id, user_id=current_user.id).first()
    if not rule:
        return jsonify({"error": "not_found"}), 404

    payload = request.json or {}
    _apply_rule_payload(rule, payload)

    if not json.loads(rule.actions_json or "[]"):
        return jsonify({"error": "acoes_obrigatorias"}), 400

    db.session.commit()
    return jsonify({"ok": True, "rule": _serialize_rule(rule)})


@rules_bp.patch("/api/rules/<int:rule_id>/toggle")
@login_required
@require_feature("filters")
def toggle_rule(rule_id: int):
    rule = AutomationRule.query.filter_by(id=rule_id, user_id=current_user.id).first()
    if not rule:
        return jsonify({"error": "not_found"}), 404

    rule.is_enabled = _parse_bool((request.json or {}).get("is_enabled"), not rule.is_enabled)
    db.session.commit()
    return jsonify({"ok": True, "rule": _serialize_rule(rule)})


def _query_entries_from_payload(payload: dict):
    query = Entrada.query.filter(Entrada.user_id == current_user.id)

    start = _parse_iso_date(payload.get("start"))
    if start:
        query = query.filter(Entrada.data >= start)
    end = _parse_iso_date(payload.get("end"))
    if end:
        query = query.filter(Entrada.data <= end)

    tipo = (payload.get("tipo") or "").strip().lower()
    if tipo in {"receita", "despesa"}:
        query = query.filter(Entrada.tipo == tipo)

    categoria = (payload.get("categoria") or "").strip().lower()
    if categoria and categoria != "all":
        if tipo in {"receita", "despesa"}:
            categoria = normalize_category(tipo, categoria)
        query = query.filter(Entrada.categoria == categoria)

    status = (payload.get("status") or "").strip().lower()
    if status and status != "all":
        query = query.filter(Entrada.status == status)

    min_val = payload.get("min")
    if min_val not in (None, ""):
        try:
            query = query.filter(Entrada.valor >= float(min_val))
        except (TypeError, ValueError):
            pass
    max_val = payload.get("max")
    if max_val not in (None, ""):
        try:
            query = query.filter(Entrada.valor <= float(max_val))
        except (TypeError, ValueError):
            pass

    return query.order_by(Entrada.data.desc(), Entrada.id.desc())


@rules_bp.post("/api/rules/<int:rule_id>/test")
@login_required
@require_feature("filters")
def test_rule(rule_id: int):
    rule = AutomationRule.query.filter_by(id=rule_id, user_id=current_user.id).first()
    if not rule:
        return jsonify({"error": "not_found"}), 404

    payload = request.json or {}
    limit = _parse_int(payload.get("limit"), 200)
    query = _query_entries_from_payload(payload)
    if limit > 0:
        query = query.limit(limit)

    entries = query.all()
    matches = []
    for entry in entries:
        result = apply_rule_to_entry(rule, entry, current_user, trigger="test", dry_run=True)
        if not result:
            continue
        matches.append(
            {
                "entry_id": entry.id,
                "date": entry.data.isoformat() if entry.data else None,
                "description": entry.descricao,
                "value": float(entry.valor),
                "changes": result.get("changes") or {},
            }
        )

    db.session.commit()
    return jsonify({"ok": True, "matched": len(matches), "preview": matches[:50]})


@rules_bp.post("/api/rules/<int:rule_id>/apply")
@login_required
@require_feature("filters")
def apply_rule(rule_id: int):
    rule = AutomationRule.query.filter_by(id=rule_id, user_id=current_user.id).first()
    if not rule:
        return jsonify({"error": "not_found"}), 404

    payload = request.json or {}
    query = _query_entries_from_payload(payload)
    entries = query.all()

    updated = 0
    for entry in entries:
        result = apply_rule_to_entry(rule, entry, current_user, trigger="apply", dry_run=False)
        if result:
            updated += 1

    db.session.commit()
    return jsonify({"ok": True, "updated": updated})


@rules_bp.get("/api/rules/<int:rule_id>/log")
@login_required
@require_feature("filters")
def rule_log(rule_id: int):
    rule = AutomationRule.query.filter_by(id=rule_id, user_id=current_user.id).first()
    if not rule:
        return jsonify({"error": "not_found"}), 404

    limit = _parse_int(request.args.get("limit"), 50)
    executions = (
        RuleExecution.query.filter_by(rule_id=rule.id, user_id=current_user.id)
        .order_by(RuleExecution.created_at.desc(), RuleExecution.id.desc())
        .limit(limit)
        .all()
    )
    items = []
    for item in executions:
        changes = {}
        if item.changes_json:
            try:
                changes = json.loads(item.changes_json)
            except json.JSONDecodeError:
                changes = {}
        items.append(
            {
                "id": item.id,
                "entry_id": item.entry_id,
                "trigger": item.trigger,
                "matched": item.matched,
                "changes": changes,
                "created_at": item.created_at.isoformat() if item.created_at else None,
            }
        )

    return jsonify({"ok": True, "executions": items})
