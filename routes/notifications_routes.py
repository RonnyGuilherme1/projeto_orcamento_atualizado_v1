from __future__ import annotations

import hashlib
import json
from datetime import date, datetime

from flask import Blueprint, jsonify, request
from flask_login import current_user, login_required

from models.extensions import db
from models.notification_model import Notification
from models.automation_rule_model import RuleExecution, AutomationRule
from models.entrada_model import Entrada
from models.reminder_model import Reminder
from services.reminder_runner import fetch_reminder_entries
from services.subscription import subscription_context
from services.plans import PLANS
from services.permissions import require_api_access, json_error
from services.feature_gate import user_has_feature
from services.date_utils import last_day_of_month
from routes.analytics_routes import build_period_alerts


notifications_bp = Blueprint("notifications", __name__)

MAX_FEED_ITEMS = 40
RULE_EXECUTION_LIMIT = 20
REMINDER_LIMIT = 12
INSIGHT_ALERT_LIMIT = 3


def _now() -> datetime:
    return datetime.utcnow()


def _iso(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


def _hash_key(value: str) -> str:
    return hashlib.sha1(value.encode("utf-8")).hexdigest()[:12]


def _parse_changes(raw: str | None) -> dict:
    if not raw:
        return {}
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {}


def _rule_message(changes: dict, entry_desc: str | None) -> str:
    parts = []
    if "categoria" in changes:
        parts.append("categoria")
    if "status" in changes:
        parts.append("status")

    target = entry_desc or "uma entrada"
    if parts:
        if len(parts) == 2:
            action = "categoria e status"
        else:
            action = parts[0]
        return f"Alterou {action} em {target}"

    if entry_desc:
        return f"Regra aplicada em {entry_desc}"
    return "Regra aplicada com sucesso."


def _build_billing_event(user) -> dict | None:
    sub = subscription_context(user)
    days_left = sub.get("days_left")
    notify = getattr(user, "notify_due_alert", True)
    if (
        notify
        and sub.get("status") == "ACTIVE"
        and isinstance(days_left, int)
        and 0 < days_left <= 5
    ):
        plan_name = PLANS.get(user.plan, PLANS["basic"])["name"]
        expires_at = sub.get("expires_at")
        expires_display = sub.get("expires_at_display")
        key_date = expires_at.isoformat() if expires_at else (expires_display or "unknown")
        return {
            "source_key": f"billing:expires:{key_date}",
            "type": "billing",
            "title": f"Plano vence em {days_left} dias",
            "message": f"Válido até {expires_display} · {plan_name}",
            "href": "/app/account?section=billing",
            "created_at": _now(),
        }
    return None


def _build_rule_events(user_id: int) -> list[dict]:
    rows = (
        db.session.query(RuleExecution, AutomationRule, Entrada)
        .join(AutomationRule, RuleExecution.rule_id == AutomationRule.id)
        .outerjoin(Entrada, RuleExecution.entry_id == Entrada.id)
        .filter(RuleExecution.user_id == user_id)
        .order_by(RuleExecution.created_at.desc(), RuleExecution.id.desc())
        .limit(RULE_EXECUTION_LIMIT)
        .all()
    )

    events: list[dict] = []
    for exec_item, rule, entry in rows:
        changes = _parse_changes(exec_item.changes_json)
        entry_desc = getattr(entry, "descricao", None)
        if not entry_desc:
            entry_desc = (changes.get("descricao") or {}).get("after")

        title = f"Regra aplicada: {rule.name}" if rule else "Regra aplicada"
        message = _rule_message(changes, entry_desc)
        events.append(
            {
                "source_key": f"rule:{exec_item.id}",
                "type": "rule",
                "title": title,
                "message": message,
                "href": "/app/filters",
                "created_at": exec_item.created_at or _now(),
            }
        )
    return events


def _build_reminder_events(user_id: int) -> list[dict]:
    reminders = (
        Reminder.query.filter_by(user_id=user_id, is_enabled=True)
        .order_by(Reminder.created_at.desc(), Reminder.id.desc())
        .limit(REMINDER_LIMIT)
        .all()
    )
    if not reminders:
        return []

    today = date.today()
    events: list[dict] = []
    for rem in reminders:
        entries = fetch_reminder_entries(rem, user_id=user_id, today=today, limit=50)
        qty = len(entries)
        if qty <= 0:
            continue
        events.append(
            {
                "source_key": f"reminder:{rem.id}:{today.isoformat()}",
                "type": "reminder",
                "title": f"Lembrete: {rem.name}",
                "message": f"{qty} lançamentos correspondem ao lembrete",
                "href": "/app/filters",
                "created_at": _now(),
            }
        )
    return events


def _build_insight_events(user_id: int) -> list[dict]:
    today = date.today()
    start = date(today.year, today.month, 1)
    end = last_day_of_month(start)
    alerts = build_period_alerts(user_id=user_id, start=start, end=end)
    events: list[dict] = []
    for alert in (alerts or [])[:INSIGHT_ALERT_LIMIT]:
        key = _hash_key(alert)
        events.append(
            {
                "source_key": f"insight:{start.isoformat()}:{end.isoformat()}:{key}",
                "type": "insight",
                "title": alert,
                "message": "Insight do período",
                "href": "/app/charts",
                "created_at": _now(),
            }
        )
    return events


def _sync_notifications(user_id: int, events: list[dict]) -> list[Notification]:
    if not events:
        return []

    unique_events: list[dict] = []
    seen_keys: set[str] = set()
    for event in events:
        source_key = event.get("source_key")
        if not source_key or source_key in seen_keys:
            continue
        seen_keys.add(source_key)
        unique_events.append(event)

    source_keys = [event["source_key"] for event in unique_events]
    existing = (
        Notification.query
        .filter(Notification.user_id == user_id, Notification.source_key.in_(source_keys))
        .all()
    )
    existing_map = {item.source_key: item for item in existing}

    changed = False
    for event in unique_events:
        source_key = event["source_key"]
        item = existing_map.get(source_key)
        if not item:
            item = Notification(
                user_id=user_id,
                source_key=source_key,
                type=event["type"],
                title=event["title"],
                message=event.get("message"),
                href=event.get("href"),
                created_at=event.get("created_at") or _now(),
            )
            db.session.add(item)
            existing_map[source_key] = item
            changed = True
        else:
            if item.type != event["type"]:
                item.type = event["type"]
                changed = True
            if item.title != event["title"]:
                item.title = event["title"]
                changed = True
            if item.message != event.get("message"):
                item.message = event.get("message")
                changed = True
            if item.href != event.get("href"):
                item.href = event.get("href")
                changed = True

    if changed:
        db.session.commit()

    return [existing_map[key] for key in source_keys if key in existing_map]


@notifications_bp.get("/app/notifications/data")
@require_api_access()
@login_required
def notifications_data():
    events: list[dict] = []

    billing_event = _build_billing_event(current_user)
    if billing_event:
        events.append(billing_event)

    if user_has_feature(current_user, "filters"):
        events.extend(_build_rule_events(current_user.id))
        events.extend(_build_reminder_events(current_user.id))

    if user_has_feature(current_user, "insights") or user_has_feature(current_user, "charts"):
        events.extend(_build_insight_events(current_user.id))

    if not events:
        return jsonify({"items": [], "unread_count": 0})

    records = _sync_notifications(current_user.id, events)
    records_sorted = sorted(
        records,
        key=lambda item: item.created_at or datetime.min,
        reverse=True,
    )[:MAX_FEED_ITEMS]

    items_payload = []
    for item in records_sorted:
        items_payload.append(
            {
                "id": str(item.id),
                "type": item.type,
                "title": item.title,
                "message": item.message,
                "created_at": _iso(item.created_at),
                "href": item.href,
                "read_at": _iso(item.read_at),
            }
        )

    unread_count = sum(1 for item in records_sorted if item.read_at is None)
    return jsonify({"items": items_payload, "unread_count": unread_count})


@notifications_bp.post("/app/notifications/mark-read")
@require_api_access()
@login_required
def mark_notification_read():
    payload = request.get_json(silent=True) or {}
    raw_id = payload.get("id")
    try:
        notif_id = int(raw_id)
    except (TypeError, ValueError):
        return json_error("invalid_id", 422)

    item = Notification.query.filter_by(id=notif_id, user_id=current_user.id).first()
    if not item:
        return json_error("not_found", 404)

    if not item.read_at:
        item.read_at = _now()
        db.session.commit()

    return jsonify({"ok": True})


@notifications_bp.post("/app/notifications/mark-all-read")
@require_api_access()
@login_required
def mark_all_notifications_read():
    now = _now()
    Notification.query.filter_by(user_id=current_user.id, read_at=None).update(
        {"read_at": now},
        synchronize_session=False,
    )
    db.session.commit()
    return jsonify({"ok": True})
