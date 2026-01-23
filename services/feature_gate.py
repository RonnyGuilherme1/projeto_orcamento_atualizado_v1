"""Feature gating por plano.

Uso:

from services.feature_gate import require_feature

@bp.get("/app/charts")
@login_required
@require_feature("charts")
def charts():
    ...
"""

from __future__ import annotations

from functools import wraps

from flask import flash, redirect, url_for

from services.plans import plan_features
from services.subscription import is_subscription_active


def user_has_feature(user, feature: str) -> bool:
    feature = (feature or "").strip().lower()
    if not feature:
        return False
    if not is_subscription_active(user):
        return False

    user_plan = getattr(user, "plan", "basic") or "basic"
    return feature in plan_features(user_plan)


def require_feature(feature: str):
    """Decorator: bloqueia rota se plano não liberar."""

    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            from flask_login import current_user

            if not is_subscription_active(current_user):
                flash("Pagamento pendente. Regularize sua assinatura para continuar.", "warning")
                return redirect(url_for("account_page", section="billing"))
            if not user_has_feature(current_user, feature):
                flash("Seu plano não inclui este recurso. Faça upgrade para continuar.", "warning")
                return redirect(url_for("analytics.upgrade"))
            return fn(*args, **kwargs)

        return wrapper

    return decorator
