from __future__ import annotations

from dataclasses import dataclass
from functools import wraps
import secrets

from flask import jsonify, request, session
from flask_login import current_user

from services.plans import plan_features
from services.subscription import is_subscription_active


CSRF_SESSION_KEY = "_csrf_token"

# Endpoints externos ou sem sessao que nao devem validar CSRF.
CSRF_EXEMPT_ENDPOINTS = {
    "abacatepay_webhook",
}


@dataclass(frozen=True)
class AccessDecision:
    ok: bool
    status: int = 200
    error: str | None = None


def json_error(error: str, status: int):
    return jsonify({"error": error}), status


def is_json_request() -> bool:
    path = request.path or ""
    if path.startswith("/api/"):
        return True
    if path in {
        "/dados",
        "/add",
        "/resumo-ciclo",
        "/resumo-periodo",
    }:
        return True
    if path.startswith("/edit/") or path.startswith("/delete/"):
        return True
    if path.startswith("/app/") and any(
        fragment in path
        for fragment in ("/data", "/export", "/scenarios", "/entry", "/status")
    ):
        return True
    if request.is_json:
        return True
    accept = request.headers.get("Accept", "")
    if "application/json" in accept.lower():
        return True
    return False


def get_csrf_token() -> str:
    token = session.get(CSRF_SESSION_KEY)
    if not token:
        token = secrets.token_urlsafe(32)
        session[CSRF_SESSION_KEY] = token
    return token


def validate_csrf() -> bool:
    token = session.get(CSRF_SESSION_KEY)
    if not token:
        return False
    header = request.headers.get("X-CSRF-Token") or request.headers.get("X-CSRFToken")
    if header and header == token:
        return True
    if request.form:
        form_token = request.form.get("csrf_token")
        if form_token and form_token == token:
            return True
    if request.is_json:
        payload = request.get_json(silent=True) or {}
        json_token = payload.get("csrf_token")
        if json_token and json_token == token:
            return True
    return False


def evaluate_access(
    user,
    *,
    require_verified: bool = True,
    require_active: bool = False,
    feature: str | None = None,
) -> AccessDecision:
    if not user or not getattr(user, "is_authenticated", False):
        return AccessDecision(False, 401, "not_authenticated")

    if require_verified and not getattr(user, "is_verified", False):
        return AccessDecision(False, 403, "email_not_verified")

    if require_active and not is_subscription_active(user):
        return AccessDecision(False, 403, "subscription_inactive")

    if feature:
        user_plan = (getattr(user, "plan", "basic") or "basic").strip().lower()
        if feature not in plan_features(user_plan):
            return AccessDecision(False, 403, "plan_not_allowed")

    return AccessDecision(True)


def user_has_feature(
    user,
    feature: str,
    *,
    require_verified: bool = True,
    require_active: bool = True,
) -> bool:
    feature = (feature or "").strip().lower()
    if not feature:
        return False
    decision = evaluate_access(
        user,
        require_verified=require_verified,
        require_active=require_active,
        feature=feature,
    )
    return decision.ok


def require_api_access(
    *,
    feature: str | None = None,
    require_verified: bool = True,
    require_active: bool | None = None,
):
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            must_be_active = require_active
            if must_be_active is None:
                must_be_active = bool(feature)

            decision = evaluate_access(
                current_user,
                require_verified=require_verified,
                require_active=bool(must_be_active),
                feature=feature,
            )
            if not decision.ok:
                return json_error(decision.error or "forbidden", decision.status)
            return fn(*args, **kwargs)

        return wrapper

    return decorator


def require_verified_email(message: str | None = None):
    """Decorator para rotas que exigem e-mail verificado."""

    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            decision = evaluate_access(current_user, require_verified=True, require_active=False)
            if decision.ok:
                return fn(*args, **kwargs)

            if is_json_request():
                return json_error(decision.error or "forbidden", decision.status)

            from flask import flash, redirect, url_for

            if decision.status == 401:
                return redirect(url_for("auth.login_page"))
            if decision.error == "email_not_verified":
                if message:
                    flash(message, "warning")
                return redirect(url_for("auth.verify_pending"))
            return redirect(url_for("index"))

        return wrapper

    return decorator


def require_feature(feature: str):
    """Decorator para paginas HTML."""

    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            decision = evaluate_access(
                current_user,
                require_verified=True,
                require_active=True,
                feature=feature,
            )
            if decision.ok:
                return fn(*args, **kwargs)

            from flask import flash, redirect, url_for

            if decision.status == 401:
                return redirect(url_for("auth.login_page"))
            if decision.error == "email_not_verified":
                return redirect(url_for("auth.verify_pending"))
            if decision.error == "subscription_inactive":
                flash("Pagamento pendente. Regularize sua assinatura para continuar.", "warning")
                return redirect(url_for("account_page", section="billing"))
            if decision.error == "plan_not_allowed":
                flash("Seu plano n\u00e3o inclui este recurso. Fa\u00e7a upgrade para continuar.", "warning")
                return redirect(url_for("analytics.upgrade"))
            return redirect(url_for("index"))

        return wrapper

    return decorator
