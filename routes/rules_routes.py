from __future__ import annotations

import json
from datetime import date, datetime, timedelta

from flask import Blueprint, jsonify, request
from flask_login import current_user, login_required

from models.automation_rule_model import AutomationRule, RuleExecution
from models.entrada_model import Entrada
from models.recurrence_model import Recurrence, RecurrenceExecution
from models.reminder_model import Reminder
from models.extensions import db
from services.feature_gate import require_feature
from services.rules_engine import apply_rule_to_entry, apply_rules_to_entry, normalize_category, normalize_tags


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


def _safe_float(value, default=None):
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


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


def _serialize_recurrence(rec: Recurrence) -> dict:
    return {
        "id": rec.id,
        "name": rec.name,
        "is_enabled": bool(rec.is_enabled),
        "frequency": rec.frequency,
        "day_of_month": rec.day_of_month,
        "tipo": rec.tipo,
        "descricao": rec.descricao,
        "categoria": rec.categoria,
        "valor": float(rec.valor or 0),
        "status": rec.status,
        "metodo": rec.metodo,
        "tags": rec.tags,
        "last_run_at": rec.last_run_at.isoformat() if rec.last_run_at else None,
    }


def _serialize_reminder(rem: Reminder) -> dict:
    return {
        "id": rem.id,
        "name": rem.name,
        "is_enabled": bool(rem.is_enabled),
        "days_before": rem.days_before,
        "tipo": rem.tipo,
        "categoria": rem.categoria,
        "status": rem.status,
        "metodo": rem.metodo,
        "min_value": rem.min_value,
        "max_value": rem.max_value,
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


def _apply_recurrence_payload(rec: Recurrence, payload: dict) -> None:
    rec.name = (payload.get("name") or "Nova recorrencia").strip()
    rec.is_enabled = _parse_bool(payload.get("is_enabled"), True)
    rec.frequency = (payload.get("frequency") or "monthly").strip().lower()
    rec.day_of_month = max(1, min(31, _parse_int(payload.get("day_of_month"), 1)))

    rec.tipo = (payload.get("tipo") or "despesa").strip().lower()
    rec.descricao = (payload.get("descricao") or "").strip() or rec.name
    rec.categoria = normalize_category(rec.tipo, payload.get("categoria"))
    rec.valor = _safe_float(payload.get("valor"), 0.0) or 0.0

    rec.status = (payload.get("status") or "").strip().lower() or None
    rec.metodo = (payload.get("metodo") or "").strip().lower() or None
    rec.tags = normalize_tags(payload.get("tags"))


def _apply_reminder_payload(rem: Reminder, payload: dict) -> None:
    rem.name = (payload.get("name") or "Novo lembrete").strip()
    rem.is_enabled = _parse_bool(payload.get("is_enabled"), True)
    rem.days_before = max(1, _parse_int(payload.get("days_before"), 3))

    rem.tipo = (payload.get("tipo") or "").strip().lower() or None
    rem.categoria = (payload.get("categoria") or "").strip().lower() or None
    rem.status = (payload.get("status") or "").strip().lower() or None
    rem.metodo = (payload.get("metodo") or "").strip().lower() or None

    rem.min_value = _safe_float(payload.get("min_value"))
    rem.max_value = _safe_float(payload.get("max_value"))


@rules_bp.get("/api/recurrences")
@login_required
@require_feature("filters")
def list_recurrences():
    items = (
        Recurrence.query.filter_by(user_id=current_user.id)
        .order_by(Recurrence.created_at.desc(), Recurrence.id.desc())
        .all()
    )
    return jsonify({"recurrences": [_serialize_recurrence(item) for item in items]})


@rules_bp.post("/api/recurrences")
@login_required
@require_feature("filters")
def create_recurrence():
    payload = request.json or {}
    rec = Recurrence(user_id=current_user.id)
    _apply_recurrence_payload(rec, payload)
    db.session.add(rec)
    db.session.commit()
    return jsonify({"ok": True, "recurrence": _serialize_recurrence(rec)})


@rules_bp.put("/api/recurrences/<int:recurrence_id>")
@login_required
@require_feature("filters")
def update_recurrence(recurrence_id: int):
    rec = Recurrence.query.filter_by(id=recurrence_id, user_id=current_user.id).first()
    if not rec:
        return jsonify({"error": "not_found"}), 404
    payload = request.json or {}
    _apply_recurrence_payload(rec, payload)
    db.session.commit()
    return jsonify({"ok": True, "recurrence": _serialize_recurrence(rec)})


@rules_bp.patch("/api/recurrences/<int:recurrence_id>/toggle")
@login_required
@require_feature("filters")
def toggle_recurrence(recurrence_id: int):
    rec = Recurrence.query.filter_by(id=recurrence_id, user_id=current_user.id).first()
    if not rec:
        return jsonify({"error": "not_found"}), 404
    rec.is_enabled = _parse_bool((request.json or {}).get("is_enabled"), not rec.is_enabled)
    db.session.commit()
    return jsonify({"ok": True, "recurrence": _serialize_recurrence(rec)})


@rules_bp.post("/api/recurrences/<int:recurrence_id>/run")
@login_required
@require_feature("filters")
def run_recurrence(recurrence_id: int):
    rec = Recurrence.query.filter_by(id=recurrence_id, user_id=current_user.id).first()
    if not rec:
        return jsonify({"error": "not_found"}), 404
    if not rec.is_enabled:
        return jsonify({"error": "disabled"}), 400

    today = date.today()
    day = max(1, min(31, int(rec.day_of_month or 1)))
    year = today.year
    month = today.month

    try:
        run_date = date(year, month, day)
    except ValueError:
        # se o dia nao existe no mes, usa ultimo dia
        if month == 12:
            run_date = date(year, month, 31)
        else:
            next_month = date(year, month + 1, 1)
            run_date = next_month - timedelta(days=1)

    exists = (
        Entrada.query.filter(
            Entrada.user_id == current_user.id,
            Entrada.recurrence_id == rec.id,
            Entrada.data == run_date,
        )
        .first()
    )
    if exists:
        return jsonify({"ok": True, "created": False, "entry_id": exists.id})

    status = rec.status if rec.tipo == "despesa" else None
    paid_at = run_date if (rec.tipo == "despesa" and status == "pago") else None

    entry = Entrada(
        user_id=current_user.id,
        data=run_date,
        tipo=rec.tipo,
        descricao=rec.descricao,
        categoria=normalize_category(rec.tipo, rec.categoria),
        valor=float(rec.valor or 0),
        status=status,
        paid_at=paid_at,
        metodo=rec.metodo,
        tags=rec.tags,
        recurrence_id=rec.id,
    )
    db.session.add(entry)
    db.session.flush()
    apply_rules_to_entry(entry, current_user, trigger="create", dry_run=False)
    rec.last_run_at = datetime.utcnow()
    db.session.add(
        RecurrenceExecution(
            recurrence_id=rec.id,
            entry_id=entry.id,
            user_id=current_user.id,
        )
    )
    db.session.commit()
    return jsonify({"ok": True, "created": True, "entry_id": entry.id})


@rules_bp.get("/api/reminders")
@login_required
@require_feature("filters")
def list_reminders():
    items = (
        Reminder.query.filter_by(user_id=current_user.id)
        .order_by(Reminder.created_at.desc(), Reminder.id.desc())
        .all()
    )
    return jsonify({"reminders": [_serialize_reminder(item) for item in items]})


@rules_bp.post("/api/reminders")
@login_required
@require_feature("filters")
def create_reminder():
    payload = request.json or {}
    rem = Reminder(user_id=current_user.id)
    _apply_reminder_payload(rem, payload)
    db.session.add(rem)
    db.session.commit()
    return jsonify({"ok": True, "reminder": _serialize_reminder(rem)})


@rules_bp.put("/api/reminders/<int:reminder_id>")
@login_required
@require_feature("filters")
def update_reminder(reminder_id: int):
    rem = Reminder.query.filter_by(id=reminder_id, user_id=current_user.id).first()
    if not rem:
        return jsonify({"error": "not_found"}), 404
    payload = request.json or {}
    _apply_reminder_payload(rem, payload)
    db.session.commit()
    return jsonify({"ok": True, "reminder": _serialize_reminder(rem)})


@rules_bp.patch("/api/reminders/<int:reminder_id>/toggle")
@login_required
@require_feature("filters")
def toggle_reminder(reminder_id: int):
    rem = Reminder.query.filter_by(id=reminder_id, user_id=current_user.id).first()
    if not rem:
        return jsonify({"error": "not_found"}), 404
    rem.is_enabled = _parse_bool((request.json or {}).get("is_enabled"), not rem.is_enabled)
    db.session.commit()
    return jsonify({"ok": True, "reminder": _serialize_reminder(rem)})


@rules_bp.post("/api/reminders/<int:reminder_id>/test")
@login_required
@require_feature("filters")
def test_reminder(reminder_id: int):
    rem = Reminder.query.filter_by(id=reminder_id, user_id=current_user.id).first()
    if not rem:
        return jsonify({"error": "not_found"}), 404

    today = date.today()
    end = today + timedelta(days=int(rem.days_before or 3))

    query = Entrada.query.filter(
        Entrada.user_id == current_user.id,
        Entrada.data >= today,
        Entrada.data <= end,
    )
    if rem.tipo:
        query = query.filter(Entrada.tipo == rem.tipo)
    if rem.categoria:
        query = query.filter(Entrada.categoria == rem.categoria)
    if rem.status:
        query = query.filter(Entrada.status == rem.status)
    if rem.metodo:
        query = query.filter(Entrada.metodo == rem.metodo)
    if rem.min_value is not None:
        query = query.filter(Entrada.valor >= float(rem.min_value))
    if rem.max_value is not None:
        query = query.filter(Entrada.valor <= float(rem.max_value))

    items = query.order_by(Entrada.data.asc(), Entrada.id.asc()).limit(50).all()
    payload = [
        {
            "id": e.id,
            "date": e.data.isoformat() if e.data else None,
            "descricao": e.descricao,
            "valor": float(e.valor),
            "tipo": e.tipo,
        }
        for e in items
    ]
    return jsonify({"ok": True, "matched": len(payload), "preview": payload})
