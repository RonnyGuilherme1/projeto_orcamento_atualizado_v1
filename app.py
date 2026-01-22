import re

from flask import Flask, render_template, redirect, url_for, request, jsonify, flash
from flask_login import LoginManager, login_required, current_user
from dotenv import load_dotenv

# Carrega variaveis de ambiente de .env (desenvolvimento local)
load_dotenv()

from config import Config
from models.entrada_model import init_db
from models.extensions import db
from models.user_model import User

# Perfil (Opção 1)
from models.user_profile_model import UserProfile

from routes.entradas_routes import entradas_bp
from routes.auth_routes import auth_bp
from routes.analytics_routes import analytics_bp

from services.plans import PLANS, is_valid_plan
from services.feature_gate import user_has_feature

from services.abacatepay import create_plan_billing, AbacatePayError
from services.checkout_store import (
    create_order,
    get_order_by_token,
    set_order_billing_id,
    mark_order_paid_by_billing_id,
    get_order_by_billing_id,
)
from services.email_service import send_verification_email

app = Flask(__name__)
app.config.from_object(Config)

# DB
# Observação: para garantir que create_all enxergue UserProfile,
# ele precisa estar importado antes de init_db(app). Já está acima.
init_db(app)

# Login manager
login_manager = LoginManager()
login_manager.login_view = "auth.login_page"  # endpoint GET /login
login_manager.init_app(app)


@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))


# Blueprints
app.register_blueprint(entradas_bp)
app.register_blueprint(auth_bp)
app.register_blueprint(analytics_bp)


@app.context_processor
def inject_plan_helpers():
    """Helpers globais para templates."""

    def has_feature(feature: str) -> bool:
        if not current_user.is_authenticated:
            return False
        return user_has_feature(current_user, feature)

    return {
        "PLANS": PLANS,
        "has_feature": has_feature,
    }


def _only_digits(s: str) -> str:
    return re.sub(r"\D+", "", s or "")


def _format_cpf(raw: str) -> str:
    d = _only_digits(raw)
    if len(d) != 11:
        return ""
    return f"{d[0:3]}.{d[3:6]}.{d[6:9]}-{d[9:11]}"


def _format_phone(raw: str) -> str:
    d = _only_digits(raw)
    # aceita 10 ou 11 dígitos (BR)
    if len(d) == 10:
        return f"({d[0:2]}) {d[2:6]}-{d[6:10]}"
    if len(d) == 11:
        return f"({d[0:2]}) {d[2:7]}-{d[7:11]}"
    return ""


@app.get("/")
def marketing_home():
    """Página pública de apresentação (marketing)."""
    return render_template("home.html")


@app.get("/pricing")
def pricing():
    """Página pública de planos."""
    selected_plan = (request.args.get("plan") or "plus").strip().lower()
    if not is_valid_plan(selected_plan):
        selected_plan = "plus"
    return render_template("pricing.html", selected_plan=selected_plan)


@app.get("/buy")
@login_required
def buy():
    """Checkout (Opção A): somente usuário logado.

    Regras:
    - usuário precisa estar verificado
    - CPF e telefone são obrigatórios para iniciar pagamento
    - cria pedido vinculado ao user_id
    - cria cobrança no AbacatePay e redireciona
    """
    if not current_user.is_verified:
        return redirect(url_for("auth.verify_pending"))

    plan = (request.args.get("plan") or "plus").strip().lower()
    if not is_valid_plan(plan):
        plan = "plus"

    # Exige perfil completo
    profile = UserProfile.query.filter_by(user_id=current_user.id).first()
    if not profile or not (profile.full_name or "").strip() or not (profile.cpf or "").strip() or not (profile.phone or "").strip():
        flash("Para iniciar o pagamento, complete seus dados pessoais (Nome completo, CPF e Telefone).", "error")
        return redirect(url_for("account_page", section="profile"))

    # Cria pedido local vinculado ao usuário logado
    order = create_order(plan=plan, user_id=current_user.id)

    try:
        billing = create_plan_billing(
            plan=plan,
            external_id=order.token,
            return_url=url_for("pricing", _external=True, plan=plan),
            completion_url=url_for("checkout_completion", _external=True, token=order.token),
            customer={
                "name": profile.full_name,
                "email": current_user.email,
                "cellphone": profile.phone,
                "taxId": profile.cpf,
            },
        )
    except TypeError:
        return render_template(
            "message.html",
            title="Checkout",
            subtitle="Atualização necessária",
            message="Seu services/abacatepay.py ainda não suporta o campo customer. Atualize o arquivo para concluir.",
        ), 500
    except AbacatePayError as e:
        return render_template(
            "message.html",
            title="Checkout",
            subtitle="Configuração necessária para finalizar a compra.",
            message=str(e),
        ), 500

    set_order_billing_id(order.token, billing["billing_id"])
    return redirect(billing["url"], code=302)


@app.get("/checkout/completion")
def checkout_completion():
    token = (request.args.get("token") or "").strip()
    order = get_order_by_token(token)
    if not order:
        return render_template(
            "message.html",
            title="Checkout",
            message="Não foi possível localizar seu checkout. Volte para a página de planos e tente novamente.",
        ), 404

    # Se estiver pago e o usuário estiver logado, aplica o plano imediatamente.
    if current_user.is_authenticated and order.status == "PAID":
        if (order.user_id is None) or (int(order.user_id) == int(current_user.id)):
            current_user.set_plan(order.plan)
            db.session.commit()
            if not current_user.is_verified:
                send_verification_email(current_user)
                flash("Pagamento confirmado. Verifique seu e-mail para ativar sua conta.", "success")
                return redirect(url_for("auth.verify_pending"))
            flash(f"Pagamento confirmado. Seu plano foi atualizado para {PLANS[order.plan]['name']}.", "success")
            return redirect(url_for("index"))

    # Se não estiver logado, instruir login (Opção A)
    if not current_user.is_authenticated:
        return render_template(
            "message.html",
            title="Checkout",
            subtitle="Finalize com login",
            message="Para concluir a atualização do plano, faça login na sua conta.",
        ), 200

    return render_template(
        "checkout_completion.html",
        order=order,
        plan=PLANS.get(order.plan),
    )


@app.get("/checkout/status")
def checkout_status():
    token = (request.args.get("token") or "").strip()
    order = get_order_by_token(token)
    if not order:
        return jsonify({"ok": False, "error": "not_found"}), 404
    return jsonify({"ok": True, "status": order.status, "plan": order.plan})


@app.post("/webhook/abacatepay")
def abacatepay_webhook():
    # Validação simples via query param (conforme docs da AbacatePay)
    secret = (request.args.get("webhookSecret") or "").strip()
    expected = (app.config.get("ABACATEPAY_WEBHOOK_SECRET") or "").strip()
    if expected and secret != expected:
        return jsonify({"ok": False, "error": "invalid_secret"}), 401

    payload = request.get_json(silent=True) or {}
    event = payload.get("event")

    if event == "billing.paid":
        billing_id = (((payload.get("data") or {}).get("billing") or {}).get("id"))
        if billing_id:
            mark_order_paid_by_billing_id(str(billing_id))

            # Se o pedido estiver vinculado a um usuário (upgrade dentro do app), aplica o plano.
            order = get_order_by_billing_id(str(billing_id))
            if order and order.user_id:
                u = User.query.get(int(order.user_id))
                if u:
                    u.set_plan(order.plan)
                    db.session.commit()

    return jsonify({"ok": True}), 200


@app.route("/app")
@login_required
def index():
    if not current_user.is_verified:
        return redirect(url_for("auth.verify_pending"))
    return render_template("index.html")


# ✅ ROTA DEVE FICAR ANTES DO app.run()
@app.route("/app/entradas")
@login_required
def entradas_page():
    if not current_user.is_verified:
        return redirect(url_for("auth.verify_pending"))
    return render_template("entries.html")


@app.get("/app/account")
@login_required
def account_page():
    """Tela de configurações/conta do usuário (dentro do sistema)."""
    if not current_user.is_verified:
        return redirect(url_for("auth.verify_pending"))

    section = (request.args.get("section") or "overview").strip().lower()
    allowed = {"overview", "billing", "access", "profile", "notifications"}
    if section not in allowed:
        section = "overview"

    profile = UserProfile.query.filter_by(user_id=current_user.id).first()

    return render_template(
        "account.html",
        section=section,
        profile=profile,
    )


@app.post("/app/account/profile")
@login_required
def account_profile_save():
    """Salva dados pessoais do usuário."""
    if not current_user.is_verified:
        return redirect(url_for("auth.verify_pending"))

    full_name = (request.form.get("full_name") or "").strip()
    tax_id_raw = (request.form.get("tax_id") or "").strip()
    cellphone_raw = (request.form.get("cellphone") or "").strip()

    tax_id = re.sub(r"\D+", "", tax_id_raw)
    cellphone = re.sub(r"\D+", "", cellphone_raw)

    errors = []
    if len(full_name) < 3:
        errors.append("Informe seu nome completo.")
    if len(tax_id) not in {11, 14}:
        errors.append("Informe um CPF/CNPJ válido.")
    if len(cellphone) < 10:
        errors.append("Informe um telefone válido.")

    if errors:
        for e in errors:
            flash(e, "error")
        return redirect(url_for("account_page", section="profile"))

    current_user.full_name = full_name
    current_user.tax_id = tax_id
    current_user.cellphone = cellphone

    current_user.abacatepay_customer_id = None

    db.session.commit()
    flash("Dados pessoais atualizados.", "success")
    return redirect(url_for("account_page", section="profile"))


@app.get("/healthz")
def healthz():
    return "ok", 200


if __name__ == "__main__":
    app.run(debug=True, use_reloader=False)
