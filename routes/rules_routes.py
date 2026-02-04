from __future__ import annotations

import json
from datetime import date

from flask import Blueprint, jsonify, request
from flask_login import current_user

from models.automation_rule_model import AutomationRule, RuleExecution
from models.entrada_model import Entrada
from models.recurrence_model import Recurrence
from models.reminder_model import Reminder
from models.extensions import db
from services.permissions import require_api_access, json_error
from services.input_validation import (
    MAX_DESCRIPTION_LEN,
    MAX_NAME_LEN,
    MAX_TAGS_LEN,
    normalize_method,
    normalize_status,
    normalize_text,
    normalize_tipo,
    parse_amount,
)
from services.recurrence_runner import run_recurrence_once
from services.reminder_runner import fetch_reminder_entries
from services.rules_engine import apply_rule_to_entry, normalize_category, normalize_tags


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


def _normalize_frequency(value: str | None) -> str:
    raw = (value or "monthly").strip().lower()
    mapping = {
        "mensal": "monthly",
        "semanal": "weekly",
        "anual": "yearly",
        "diario": "daily",
    }
    raw = mapping.get(raw, raw)
    if raw in {"daily", "weekly", "monthly", "yearly"}:
        return raw
    return "monthly"


def _parse_optional_amount(value):
    if value in (None, ""):
        return None
    return parse_amount(value)


def _safe_list(value) -> list[dict]:
    if isinstance(value, list):
        return [item for item in value if isinstance(item, dict)]
    return []


def _apply_pagination(query, limit_value=None, offset_value=None, max_limit: int = 500):
    limit = _parse_int(limit_value, 0)
    offset = _parse_int(offset_value, 0)
    if offset > 0:
        query = query.offset(offset)
    if limit > 0:
        query = query.limit(min(limit, max_limit))
    return query


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
@require_api_access(feature="filters")
def list_rules():
    query = (
        AutomationRule.query.filter_by(user_id=current_user.id)
        .order_by(AutomationRule.priority.asc(), AutomationRule.id.asc())
    )
    query = _apply_pagination(query, request.args.get("limit"), request.args.get("offset"))
    rules = query.all()
    return jsonify({"rules": [_serialize_rule(rule) for rule in rules]})


@rules_bp.post("/api/rules")
@require_api_access(feature="filters")
def create_rule():
    payload = request.json or {}
    rule = AutomationRule(user_id=current_user.id)
    _apply_rule_payload(rule, payload)

    if not json.loads(rule.actions_json or "[]"):
        return json_error("acoes_obrigatorias", 422)

    db.session.add(rule)
    db.session.commit()
    return jsonify({"ok": True, "rule": _serialize_rule(rule)})


@rules_bp.put("/api/rules/<int:rule_id>")
@require_api_access(feature="filters")
def update_rule(rule_id: int):
    rule = AutomationRule.query.filter_by(id=rule_id, user_id=current_user.id).first()
    if not rule:
        return jsonify({"error": "not_found"}), 404

    payload = request.json or {}
    _apply_rule_payload(rule, payload)

    if not json.loads(rule.actions_json or "[]"):
        return json_error("acoes_obrigatorias", 422)

    db.session.commit()
    return jsonify({"ok": True, "rule": _serialize_rule(rule)})


@rules_bp.patch("/api/rules/<int:rule_id>/toggle")
@require_api_access(feature="filters")
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
@require_api_access(feature="filters")
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
@require_api_access(feature="filters")
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
@require_api_access(feature="filters")
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


def _apply_recurrence_payload(rec: Recurrence, payload: dict) -> str | None:
    name = normalize_text(payload.get("name") or "Nova recorrencia", max_len=MAX_NAME_LEN, min_len=1)
    if not name:
        return "invalid_name"

    tipo = normalize_tipo(payload.get("tipo") or "despesa")
    if not tipo:
        return "invalid_tipo"

    descricao = normalize_text(payload.get("descricao") or name, max_len=MAX_DESCRIPTION_LEN, min_len=1)
    if not descricao:
        return "invalid_descricao"

    valor = parse_amount(payload.get("valor"))
    if valor is None:
        return "invalid_valor"

    raw_status = payload.get("status")
    status = normalize_status(tipo, raw_status)
    if raw_status not in (None, "") and status is None:
        return "invalid_status"
    if tipo != "despesa":
        status = status if status == "recebido" else None

    raw_metodo = payload.get("metodo")
    metodo = normalize_method(raw_metodo)
    if raw_metodo not in (None, "") and metodo is None:
        return "invalid_metodo"

    tags = normalize_tags(payload.get("tags"))
    if tags and len(tags) > MAX_TAGS_LEN:
        return "invalid_tags"

    rec.name = name
    rec.is_enabled = _parse_bool(payload.get("is_enabled"), True)
    rec.frequency = _normalize_frequency(payload.get("frequency"))
    rec.day_of_month = max(1, min(31, _parse_int(payload.get("day_of_month"), 1)))

    rec.tipo = tipo
    rec.descricao = descricao
    rec.categoria = normalize_category(tipo, payload.get("categoria"))
    rec.valor = valor

    rec.status = status
    rec.metodo = metodo
    rec.tags = tags
    return None


def _apply_reminder_payload(rem: Reminder, payload: dict) -> str | None:
    name = normalize_text(payload.get("name") or "Novo lembrete", max_len=MAX_NAME_LEN, min_len=1)
    if not name:
        return "invalid_name"

    raw_tipo = (payload.get("tipo") or "").strip()
    tipo = None
    if raw_tipo:
        tipo = normalize_tipo(raw_tipo)
        if not tipo:
            return "invalid_tipo"

    raw_status = payload.get("status")
    status = None
    if raw_status not in (None, ""):
        status_norm = str(raw_status).strip().lower()
        if status_norm not in {"em_andamento", "pago", "nao_pago", "recebido"}:
            return "invalid_status"
        status = status_norm

    raw_metodo = payload.get("metodo")
    metodo = normalize_method(raw_metodo)
    if raw_metodo not in (None, "") and metodo is None:
        return "invalid_metodo"

    min_value = _parse_optional_amount(payload.get("min_value"))
    max_value = _parse_optional_amount(payload.get("max_value"))
    if payload.get("min_value") not in (None, "") and min_value is None:
        return "invalid_min_value"
    if payload.get("max_value") not in (None, "") and max_value is None:
        return "invalid_max_value"
    if min_value is not None and max_value is not None and min_value > max_value:
        return "invalid_value_range"

    rem.name = name
    rem.is_enabled = _parse_bool(payload.get("is_enabled"), True)
    rem.days_before = max(1, min(365, _parse_int(payload.get("days_before"), 3)))

    rem.tipo = tipo
    rem.categoria = (payload.get("categoria") or "").strip().lower() or None
    rem.status = status
    rem.metodo = metodo

    rem.min_value = min_value
    rem.max_value = max_value
    return None


@rules_bp.get("/api/recurrences")
@require_api_access(feature="filters")
def list_recurrences():
    query = (
        Recurrence.query.filter_by(user_id=current_user.id)
        .order_by(Recurrence.created_at.desc(), Recurrence.id.desc())
    )
    query = _apply_pagination(query, request.args.get("limit"), request.args.get("offset"))
    items = query.all()
    return jsonify({"recurrences": [_serialize_recurrence(item) for item in items]})


@rules_bp.post("/api/recurrences")
@require_api_access(feature="filters")
def create_recurrence():
    payload = request.json or {}
    rec = Recurrence(user_id=current_user.id)
    error = _apply_recurrence_payload(rec, payload)
    if error:
        return json_error(error, 422)
    db.session.add(rec)
    db.session.commit()
    return jsonify({"ok": True, "recurrence": _serialize_recurrence(rec)})


@rules_bp.put("/api/recurrences/<int:recurrence_id>")
@require_api_access(feature="filters")
def update_recurrence(recurrence_id: int):
    rec = Recurrence.query.filter_by(id=recurrence_id, user_id=current_user.id).first()
    if not rec:
        return jsonify({"error": "not_found"}), 404
    payload = request.json or {}
    error = _apply_recurrence_payload(rec, payload)
    if error:
        return json_error(error, 422)
    db.session.commit()
    return jsonify({"ok": True, "recurrence": _serialize_recurrence(rec)})


@rules_bp.patch("/api/recurrences/<int:recurrence_id>/toggle")
@require_api_access(feature="filters")
def toggle_recurrence(recurrence_id: int):
    rec = Recurrence.query.filter_by(id=recurrence_id, user_id=current_user.id).first()
    if not rec:
        return jsonify({"error": "not_found"}), 404
    rec.is_enabled = _parse_bool((request.json or {}).get("is_enabled"), not rec.is_enabled)
    db.session.commit()
    return jsonify({"ok": True, "recurrence": _serialize_recurrence(rec)})


@rules_bp.post("/api/recurrences/<int:recurrence_id>/run")
@require_api_access(feature="filters")
def run_recurrence(recurrence_id: int):
    rec = Recurrence.query.filter_by(id=recurrence_id, user_id=current_user.id).first()
    if not rec:
        return jsonify({"error": "not_found"}), 404
    if not rec.is_enabled:
        return json_error("disabled", 422)

    created, entry = run_recurrence_once(rec, current_user)
    db.session.commit()
    return jsonify({"ok": True, "created": created, "entry_id": entry.id})


@rules_bp.get("/api/reminders")
@require_api_access(feature="filters")
def list_reminders():
    query = (
        Reminder.query.filter_by(user_id=current_user.id)
        .order_by(Reminder.created_at.desc(), Reminder.id.desc())
    )
    query = _apply_pagination(query, request.args.get("limit"), request.args.get("offset"))
    items = query.all()
    return jsonify({"reminders": [_serialize_reminder(item) for item in items]})


@rules_bp.post("/api/reminders")
@require_api_access(feature="filters")
def create_reminder():
    payload = request.json or {}
    rem = Reminder(user_id=current_user.id)
    error = _apply_reminder_payload(rem, payload)
    if error:
        return json_error(error, 422)
    db.session.add(rem)
    db.session.commit()
    return jsonify({"ok": True, "reminder": _serialize_reminder(rem)})


@rules_bp.put("/api/reminders/<int:reminder_id>")
@require_api_access(feature="filters")
def update_reminder(reminder_id: int):
    rem = Reminder.query.filter_by(id=reminder_id, user_id=current_user.id).first()
    if not rem:
        return jsonify({"error": "not_found"}), 404
    payload = request.json or {}
    error = _apply_reminder_payload(rem, payload)
    if error:
        return json_error(error, 422)
    db.session.commit()
    return jsonify({"ok": True, "reminder": _serialize_reminder(rem)})


@rules_bp.patch("/api/reminders/<int:reminder_id>/toggle")
@require_api_access(feature="filters")
def toggle_reminder(reminder_id: int):
    rem = Reminder.query.filter_by(id=reminder_id, user_id=current_user.id).first()
    if not rem:
        return jsonify({"error": "not_found"}), 404
    rem.is_enabled = _parse_bool((request.json or {}).get("is_enabled"), not rem.is_enabled)
    db.session.commit()
    return jsonify({"ok": True, "reminder": _serialize_reminder(rem)})


@rules_bp.post("/api/reminders/<int:reminder_id>/test")
@require_api_access(feature="filters")
def test_reminder(reminder_id: int):
    rem = Reminder.query.filter_by(id=reminder_id, user_id=current_user.id).first()
    if not rem:
        return jsonify({"error": "not_found"}), 404

    items = fetch_reminder_entries(rem, user_id=current_user.id, limit=50)
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
