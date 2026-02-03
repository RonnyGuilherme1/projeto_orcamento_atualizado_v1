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

from services.permissions import require_feature, user_has_feature

__all__ = ["require_feature", "user_has_feature"]
