from __future__ import annotations

from datetime import datetime, timedelta

from flask import current_app


def _now() -> datetime:
    return datetime.utcnow()


def _cycle_days() -> int:
    try:
        days = int(current_app.config.get("SUBSCRIPTION_CYCLE_DAYS", 30))
    except Exception:
        days = 30
    return max(days, 1)


def is_subscription_active(user) -> bool:
    if not user:
        return False
    expires_at = getattr(user, "plan_expires_at", None)
    if not expires_at:
        return False
    return expires_at >= _now()


def apply_plan_payment(user, plan: str) -> None:
    if not user:
        return
    now = _now()
    cycle_days = _cycle_days()
    current_expires = getattr(user, "plan_expires_at", None)
    base = current_expires if current_expires and current_expires > now else now

    user.set_plan(plan)
    user.plan_expires_at = base + timedelta(days=cycle_days)
    user.plan_last_paid_at = now
    user.plan_updated_at = now


def apply_paid_order(user, order) -> bool:
    if not user or not order:
        return False
    if not getattr(user, "is_verified", False):
        return False
    paid_at = getattr(order, "paid_at", None)
    last_paid = getattr(user, "plan_last_paid_at", None)
    if paid_at and last_paid and last_paid >= paid_at:
        return False
    apply_plan_payment(user, getattr(order, "plan", "basic"))
    return True


def subscription_context(user) -> dict:
    now = _now()
    expires_at = getattr(user, "plan_expires_at", None)
    if not expires_at:
        status = "INACTIVE"
        days_left = 0
    elif expires_at < now:
        status = "OVERDUE"
        days_left = 0
    else:
        status = "ACTIVE"
        days_left = max((expires_at - now).days, 0)

    last_paid = getattr(user, "plan_last_paid_at", None)
    return {
        "status": status,
        "is_active": status == "ACTIVE",
        "expires_at": expires_at,
        "expires_at_display": expires_at.strftime("%d/%m/%Y") if expires_at else "-",
        "days_left": days_left,
        "last_paid_at": last_paid,
        "last_paid_display": last_paid.strftime("%d/%m/%Y") if last_paid else "-",
    }
