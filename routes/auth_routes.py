from flask import Blueprint, render_template, request, redirect, url_for, flash, current_app, jsonify, session
from flask_login import login_user, logout_user, login_required, current_user
from sqlalchemy.exc import IntegrityError

from models.extensions import db
from models.user_model import User
from services.checkout_store import try_apply_paid_order_to_user
from services.email_service import send_verification_email
from services.plans import is_valid_plan
from services.password_policy import validate_password, PasswordValidationError
from services.permissions import is_json_request, json_error
from services.document_validation import (
    normalize_cpf,
    normalize_phone,
    validate_cpf,
    validate_phone,
)

auth_bp = Blueprint("auth", __name__)


@auth_bp.get("/login")
def login_page():
    if current_user.is_authenticated:
        return redirect(url_for("index"))
    token = (request.args.get("token") or "").strip()
    return render_template("login.html", checkout_token=token)


@auth_bp.post("/login")
def login():
    checkout_token = (request.form.get("checkout_token") or "").strip()
    login_id = (request.form.get("login_id") or "").strip()
    password = request.form.get("password") or ""

    if not login_id or not password:
        flash("Preencha usuário/e-mail e senha.", "error")
        return redirect(url_for("auth.login_page"))

    user = User.query.filter((User.username == login_id) | (User.email == login_id)).first()
    if not user or not user.check_password(password):
        flash("Usuário/e-mail ou senha inválidos.", "error")
        return redirect(url_for("auth.login_page"))

    login_user(user)

    # Se veio de um checkout pago, aplica o plano ao usuario
    if checkout_token:
        try_apply_paid_order_to_user(checkout_token, user)

    if not user.is_verified:
        flash("Sua conta ainda não foi verificada. Verifique seu e-mail.", "warning")
        return redirect(url_for("auth.verify_pending"))

    return redirect(url_for("index"))


@auth_bp.get("/register")
def register_page():
    if current_user.is_authenticated:
        if not current_user.is_verified:
            return redirect(url_for("auth.verify_pending"))
        return redirect(url_for("index"))
    selected_plan = (request.args.get("plan") or "basic").strip().lower()
    token = (request.args.get("token") or "").strip()
    if selected_plan not in {"basic", "plus", "pro"}:
        selected_plan = "basic"
    return render_template("register.html", selected_plan=selected_plan, checkout_token=token)


@auth_bp.post("/register")
def register():
    wants_json = is_json_request()
    payload = request.get_json(silent=True) or {}

    def _get(name: str) -> str:
        if request.is_json:
            value = payload.get(name)
        else:
            value = request.form.get(name)
        return "" if value is None else str(value)

    username = _get("username").strip()
    email = _get("email").strip().lower()
    password = _get("password")
    confirm = _get("confirm_password")
    plan = _get("plan").strip().lower() or "basic"
    full_name = _get("full_name").strip()
    tax_id_raw = _get("tax_id").strip()
    cellphone_raw = _get("cellphone").strip()

    def _reject(message: str, status: int = 422):
        if wants_json:
            return json_error(message, status)
        flash(message, "error")
        return redirect(url_for("auth.register_page", plan=plan))

    if not username or not email or not password or not confirm:
        return _reject("Preencha usuario, e-mail e senha.")

    if password != confirm:
        return _reject("As senhas nao conferem.")

    try:
        validate_password(password)
    except PasswordValidationError as exc:
        return _reject(str(exc))

    if User.query.filter_by(username=username).first():
        return _reject("Esse usuario ja existe.")

    if User.query.filter_by(email=email).first():
        return _reject("Esse e-mail ja esta em uso.")

    if not is_valid_plan(plan):
        return _reject("Plano invalido. Escolha outro plano.")

    tax_id = normalize_cpf(tax_id_raw)
    cellphone = normalize_phone(cellphone_raw)
    errors = []
    if len(full_name) < 3:
        errors.append("Informe seu nome completo.")
    if not validate_cpf(tax_id):
        errors.append("Informe um CPF valido.")
    if not validate_phone(cellphone):
        errors.append("Informe um telefone valido.")
    if errors:
        if wants_json:
            return json_error("; ".join(errors), 422)
        for e in errors:
            flash(e, "error")
        return redirect(url_for("auth.register_page", plan=plan))

    user = User(username=username, email=email)
    user.set_password(password)
    user.is_verified = False
    # Plano base: sera atualizado somente apos pagamento.
    user.set_plan("basic")
    user.full_name = full_name
    user.tax_id = tax_id
    user.cellphone = cellphone

    db.session.add(user)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        if User.query.filter_by(username=username).first():
            return _reject("Esse usuario ja existe.")
        if User.query.filter_by(email=email).first():
            return _reject("Esse e-mail ja esta em uso.")
        return _reject("Nao foi possivel criar sua conta agora.")

    login_user(user)
    send_verification_email(user)

    if wants_json:
        return jsonify({"ok": True, "status": "verification_pending"}), 201

    flash("Conta criada. Verifique seu e-mail para confirmar.", "success")
    return redirect(url_for("auth.verify_pending"))


@auth_bp.get("/verify-pending")
@login_required
def verify_pending():
    if current_user.is_verified:
        return redirect(url_for("index"))
    dev_verify_link = None
    if current_app.config.get("EMAIL_VERIFICATION_DEV_MODE"):
        if session.get("last_verify_user_id") == current_user.id:
            dev_verify_link = session.get("last_verify_link")
    return render_template("verify_pending.html", dev_verify_link=dev_verify_link)


@auth_bp.post("/resend-verification")
@login_required
def resend_verification():
    if current_user.is_verified:
        return redirect(url_for("index"))

    ok = send_verification_email(current_user)
    if ok:
        if current_app.config.get("EMAIL_VERIFICATION_DEV_MODE"):
            flash("Geramos um novo link de verificação.", "success")
        else:
            flash("Enviamos um novo link de verificação.", "success")
    else:
        flash("Não foi possível enviar o e-mail agora. Veja o link no log do servidor.", "warning")

    return redirect(url_for("auth.verify_pending"))


@auth_bp.get("/verify/<token>")
def verify(token):
    user = User.verify_token(token)
    if not user:
        flash("Link inválido ou expirado.", "error")
        return redirect(url_for("auth.login_page"))

    user.is_verified = True
    db.session.commit()
    session.pop("last_verify_link", None)
    session.pop("last_verify_user_id", None)

    flash("Conta verificada com sucesso. Você já pode usar o sistema.", "success")
    login_user(user)
    return redirect(url_for("index"))


@auth_bp.get("/logout")
@login_required
def logout():
    logout_user()
    base = current_app.config.get("MARKETING_BASE_URL", "https://controledeorcamento.onrender.com").rstrip("/")
    return redirect(f"{base}/")
