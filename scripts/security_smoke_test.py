import os
import sys
import tempfile
from datetime import datetime, timedelta


def _setup_env():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if root not in sys.path:
        sys.path.insert(0, root)
    tmpdir = tempfile.mkdtemp(prefix="security_smoke_")
    db_path = os.path.join(tmpdir, "security_test.db")
    os.environ.setdefault("DATABASE_URL", f"sqlite:///{db_path}")
    os.environ.setdefault("APP_ENV", "production")
    os.environ.setdefault("SECRET_KEY", "test-secret-key-please-change-32chars+")
    os.environ.setdefault("APP_BASE_URL", "https://example.test")
    os.environ.setdefault("MARKETING_BASE_URL", "https://example.test")
    os.environ.setdefault("ABACATEPAY_WEBHOOK_SECRET", "testsecret")
    os.environ.setdefault("EMAIL_SEND_ENABLED", "0")
    os.environ.setdefault("EMAIL_VERIFICATION_DEV_MODE", "1")


def main():
    _setup_env()

    import app as app_module
    from models.extensions import db
    from models.user_model import User
    from services.checkout_store import create_order

    app = app_module.app

    results = []

    def check(label, condition):
        if not condition:
            raise AssertionError(label)
        results.append(label)

    with app.app_context():
        user = User(username="alice", email="alice@example.test")
        user.set_password("Secret123!@#")
        user.is_verified = True
        user.plan = "basic"
        user.plan_expires_at = datetime.utcnow() + timedelta(days=30)
        db.session.add(user)
        db.session.commit()

        order = create_order("basic", user_id=user.id)

    client = app.test_client()

    # CSRF should be required
    resp = client.post("/login", data={"login_id": "alice", "password": "Secret123!@#"})
    check("csrf_required", resp.status_code == 403)

    # Login with CSRF
    client.get("/login")
    with client.session_transaction() as sess:
        csrf = sess.get("_csrf_token")
    check("csrf_token_present", bool(csrf))

    resp = client.post(
        "/login",
        data={"login_id": "alice", "password": "Secret123!@#", "csrf_token": csrf},
        follow_redirects=False,
    )
    check("login_ok", resp.status_code in {302, 303})

    # Validation: invalid entry type
    resp = client.post(
        "/add",
        json={"tipo": "hack", "data": "2026-01-01", "descricao": "Teste", "valor": 10},
        headers={"X-CSRF-Token": csrf},
    )
    check("invalid_entry_type_rejected", resp.status_code == 422)

    # Open redirect should be blocked
    resp = client.get(
        f"/app/upgrade/status?token={order.token}&redirect=https://evil.test",
        headers={"X-CSRF-Token": csrf},
    )
    data = resp.get_json() or {}
    redirect_value = data.get("redirect") or ""
    check("open_redirect_blocked", redirect_value.startswith("/app"))

    # Email change should invalidate verification
    resp = client.post(
        "/app/account/access",
        data={
            "new_email": "alice2@example.test",
            "current_password": "Secret123!@#",
            "new_password": "",
            "confirm_password": "",
            "csrf_token": csrf,
        },
        follow_redirects=False,
    )
    check("email_change_response", resp.status_code in {302, 303})

    with app.app_context():
        user = db.session.query(User).filter_by(username="alice").first()
        check("email_changed", user.email == "alice2@example.test")
        check("email_verification_reset", user.is_verified is False)

    # Webhook without secret should fail
    resp = client.post("/webhook/abacatepay", json={"event": "billing.paid"})
    check("webhook_secret_required", resp.status_code == 401)

    print("OK - security smoke tests passed:")
    for item in results:
        print(f"- {item}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
