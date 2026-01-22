from flask import Blueprint, render_template, request, redirect, url_for, flash
from flask_login import login_user, logout_user, login_required, current_user

from models.extensions import db
from models.user_model import User
from services.email_service import send_verification_email
from services.checkout_store import try_apply_paid_order_to_user

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
    username = (request.form.get("username") or "").strip()
    email = (request.form.get("email") or "").strip().lower()
    password = request.form.get("password") or ""
    confirm = request.form.get("confirm_password") or ""
    plan = (request.form.get("plan") or "basic").strip().lower()
    checkout_token = (request.form.get("checkout_token") or "").strip()

    if not username or not email or not password or not confirm:
        flash("Preencha usuário, e-mail e senha.", "error")
        return redirect(url_for("auth.register_page"))

    if password != confirm:
        flash("As senhas não conferem.", "error")
        return redirect(url_for("auth.register_page"))

    if User.query.filter_by(username=username).first():
        flash("Esse usuário já existe.", "error")
        return redirect(url_for("auth.register_page"))

    if User.query.filter_by(email=email).first():
        flash("Esse e-mail já está em uso.", "error")
        return redirect(url_for("auth.register_page"))

    user = User(username=username, email=email)
    user.set_password(password)
    user.is_verified = False
    # Plano base: se houver um checkout pago, sera aplicado abaixo.
    user.set_plan(plan)

    db.session.add(user)
    db.session.commit()

    # Se o usuario pagou antes (checkout), aplica o plano do pedido pago
    if checkout_token:
        try_apply_paid_order_to_user(checkout_token, user)

    # Para UX: loga e leva para a tela de "pendente"
    login_user(user)
    send_verification_email(user)

    flash("Conta criada. Verifique seu e-mail para confirmar.", "success")
    return redirect(url_for("auth.verify_pending"))


@auth_bp.get("/verify-pending")
@login_required
def verify_pending():
    if current_user.is_verified:
        return redirect(url_for("index"))
    return render_template("verify_pending.html")


@auth_bp.post("/resend-verification")
@login_required
def resend_verification():
    if current_user.is_verified:
        return redirect(url_for("index"))

    ok = send_verification_email(current_user)
    if ok:
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

    flash("Conta verificada com sucesso. Você já pode usar o sistema.", "success")
    login_user(user)
    return redirect(url_for("index"))


@auth_bp.get("/logout")
@login_required
def logout():
    logout_user()
    return redirect(url_for("marketing_home"))
