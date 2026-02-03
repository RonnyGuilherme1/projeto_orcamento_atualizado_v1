import re
from datetime import datetime
from urllib.parse import urlparse, parse_qs

from flask import Flask, render_template, redirect, url_for, request, jsonify, flash
from flask_login import LoginManager, login_required, current_user
from dotenv import load_dotenv
from sqlalchemy.exc import OperationalError

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
from routes.rules_routes import rules_bp

from services.plans import PLANS, is_valid_plan
from services.feature_gate import user_has_feature
from services.permissions import (
    CSRF_EXEMPT_ENDPOINTS,
    get_csrf_token,
    is_json_request,
    json_error,
    validate_csrf,
)

from services.abacatepay import (
    create_plan_billing,
    get_billing_status,
    list_billings,
    AbacatePayError,
    payment_warning_message,
)
from services.checkout_store import (
    create_order,
    get_order_by_token,
    set_order_billing_id,
    mark_order_paid_by_billing_id,
    mark_order_paid_by_token,
    get_order_by_billing_id,
    list_orders_by_user,
)
from services.subscription import apply_paid_order, is_subscription_active, subscription_context
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
    if not user_id:
        return None

    try:
        return db.session.get(User, int(user_id))
    except OperationalError:
        # Conexao SSL instavel em pools remotos: tenta limpar e reabrir.
        db.session.rollback()
        db.session.remove()
        db.engine.dispose()
        try:
            return db.session.get(User, int(user_id))
        except OperationalError:
            db.session.rollback()
            return None


# Blueprints
app.register_blueprint(entradas_bp)
app.register_blueprint(auth_bp)
app.register_blueprint(analytics_bp)
app.register_blueprint(rules_bp)


@app.context_processor
def inject_plan_helpers():
    """Helpers globais para templates."""

    def has_feature(feature: str) -> bool:
        if not current_user.is_authenticated:
            return False
        return user_has_feature(current_user, feature)

    card_enabled = bool(app.config.get("ABACATEPAY_CARD_ENABLED"))
    subscription_notice = None
    if current_user.is_authenticated:
        sub = subscription_context(current_user)
        days_left = sub.get("days_left")
        notify = getattr(current_user, "notify_due_alert", True)
        if (
            notify
            and sub.get("status") == "ACTIVE"
            and isinstance(days_left, int)
            and 0 < days_left <= 5
        ):
            plan_name = PLANS.get(current_user.plan, PLANS["basic"])["name"]
            subscription_notice = {
                "days_left": days_left,
                "expires_at": sub.get("expires_at_display"),
                "plan_name": plan_name,
            }

    return {
        "MARKETING_BASE_URL": app.config.get("MARKETING_BASE_URL", "https://controledeorcamento.onrender.com").rstrip("/"),
        "PLANS": PLANS,
        "has_feature": has_feature,
        "abacatepay_card_enabled": card_enabled,
        "subscription_notice": subscription_notice,
        "csrf_token": get_csrf_token(),
    }


@app.before_request
def enforce_subscription():
    if not current_user.is_authenticated:
        return
    if not request.path.startswith("/app"):
        return

    allowed_endpoints = {
        "account_page",
        "account_profile_save",
        "account_access_save",
        "account_notifications_save",
        "analytics.upgrade",
        "analytics.upgrade_checkout_page",
        "analytics.upgrade_checkout_start",
        "analytics.upgrade_return",
        "analytics.upgrade_status",
        "billing_renew",
        "billing_return",
    }
    if request.endpoint in allowed_endpoints:
        return

    if is_subscription_active(current_user):
        return

    if is_json_request():
        return json_error("subscription_inactive", 403)

    flash("Pagamento pendente. Regularize sua assinatura para continuar.", "warning")
    return redirect(url_for("account_page", section="billing"))


@app.before_request
def enforce_csrf():
    if request.method not in {"POST", "PUT", "PATCH", "DELETE"}:
        return
    endpoint = request.endpoint or ""
    if endpoint in CSRF_EXEMPT_ENDPOINTS:
        return
    if validate_csrf():
        return
    if is_json_request():
        return json_error("csrf_failed", 403)
    return "Forbidden", 403


def _only_digits(s: str) -> str:
    return re.sub(r"\D+", "", s or "")


def _normalize_email(value: str | None) -> str:
    return (value or "").strip().lower()


def _format_date_display(value) -> str:
    if not value:
        return "-"
    if isinstance(value, datetime):
        return value.strftime("%d/%m/%Y")
    text = str(value)
    date_part = text[:10]
    if len(date_part) == 10 and date_part[4] == "-":
        year, month, day = date_part.split("-")
        return f"{day}/{month}/{year}"
    return text


def _parse_datetime(value) -> datetime | None:
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    text = str(value)
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00")).replace(tzinfo=None)
    except Exception:
        return None


def _extract_token_from_url(value: str | None) -> str:
    if not value:
        return ""
    try:
        parsed = urlparse(str(value))
        token = (parse_qs(parsed.query).get("token") or [""])[0]
        return str(token)
    except Exception:
        return ""


def _amount_from_cents(value) -> float | None:
    try:
        return round(float(value) / 100, 2)
    except Exception:
        return None


def _build_billing_history(user, orders, include_remote: bool = False) -> list[dict]:
    items: list[dict] = []
    keys: set[str] = set()

    for order in orders or []:
        plan = PLANS.get(order.plan, PLANS["basic"])
        key = (order.billing_id or order.token or "").strip()
        if key:
            keys.add(key)
        sort_dt = order.paid_at or order.created_at
        items.append(
            {
                "date": _format_date_display(sort_dt),
                "plan": plan["name"],
                "status": (order.status or "").upper() or "PENDING",
                "amount": plan.get("price_month"),
                "_sort": sort_dt or datetime.min,
                "_key": key,
            }
        )

    if include_remote:
        try:
            billings = list_billings()
        except AbacatePayError:
            billings = []

        user_email = _normalize_email(getattr(user, "email", None))
        user_tax = _only_digits(getattr(user, "tax_id", None))

        for billing in billings:
            if not isinstance(billing, dict):
                continue
            meta = billing.get("metadata") or {}
            cust_meta = (billing.get("customer") or {}).get("metadata") or {}
            external_id = billing.get("externalId") or billing.get("external_id") or ""
            completion_url = (
                meta.get("completionUrl")
                or meta.get("completion_url")
                or cust_meta.get("completionUrl")
                or cust_meta.get("completion_url")
            )
            token_from_url = _extract_token_from_url(completion_url)
            order_token = (
                meta.get("orderToken")
                or cust_meta.get("orderToken")
                or token_from_url
                or external_id
            )
            key = str(billing.get("id") or billing.get("billingId") or billing.get("billing_id") or order_token or "").strip()
            if key and key in keys:
                continue

            customer = billing.get("customer") or {}
            email = _normalize_email(cust_meta.get("email") or customer.get("email") or meta.get("email"))
            tax_id = _only_digits(cust_meta.get("taxId") or customer.get("taxId") or meta.get("taxId"))
            if not (
                (user_email and email and user_email == email)
                or (user_tax and tax_id and user_tax == tax_id)
                or (order_token and order_token in keys)
            ):
                continue

            plan_key = meta.get("plan") or cust_meta.get("plan") or ""
            if not plan_key:
                products = billing.get("products") or []
                if products:
                    ext = products[0].get("externalId") or products[0].get("external_id") or ""
                    if isinstance(ext, str) and ext.startswith("plan:"):
                        plan_key = ext.split("plan:", 1)[-1]
            plan_def = PLANS.get(str(plan_key).strip().lower() or "basic", PLANS["basic"])
            status = str(billing.get("status") or "").upper() or "PENDING"
            amount = _amount_from_cents(
                billing.get("amount")
                or billing.get("amountInCents")
                or billing.get("amount_in_cents")
            )
            if amount is None:
                amount = plan_def.get("price_month")

            sort_dt = _parse_datetime(
                billing.get("paidAt")
                or billing.get("paid_at")
                or billing.get("createdAt")
                or billing.get("created_at")
                or billing.get("updatedAt")
                or billing.get("updated_at")
            )

            items.append(
                {
                    "date": _format_date_display(sort_dt),
                    "plan": plan_def["name"],
                    "status": status,
                    "amount": amount,
                    "_sort": sort_dt or datetime.min,
                    "_key": key,
                }
            )
            if key:
                keys.add(key)

    items.sort(key=lambda item: item.get("_sort", datetime.min), reverse=True)
    for item in items:
        item.pop("_sort", None)
        item.pop("_key", None)
    return items


@app.get("/")
def marketing_home():
    """Redireciona para o site de marketing (estático)."""
    base = app.config.get("MARKETING_BASE_URL", "https://controledeorcamento.onrender.com").rstrip("/")
    return redirect(f"{base}/")

@app.get("/pricing")
def pricing():
    """Redireciona para a página de planos no site de marketing."""
    base = app.config.get("MARKETING_BASE_URL", "https://controledeorcamento.onrender.com").rstrip("/")
    plan = request.args.get("plan")
    url = f"{base}/pricing.html"
    if plan:
        url += f"?plan={plan}"
    return redirect(url)

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
    full_name = (current_user.full_name or "").strip() or (getattr(profile, "full_name", "") or "").strip()
    tax_id = _only_digits(getattr(current_user, "tax_id", None)) or _only_digits(getattr(profile, "cpf", None))
    phone = _only_digits(getattr(current_user, "cellphone", None)) or _only_digits(getattr(profile, "phone", None))

    if not full_name or not tax_id or not phone:
        flash("Para iniciar o pagamento, complete seus dados pessoais (Nome completo, CPF e Telefone).", "error")
        return redirect(url_for("account_page", section="profile"))

    # Cria pedido local vinculado ao usuario logado
    order = create_order(plan=plan, user_id=current_user.id)

    try:
        billing = create_plan_billing(
            plan=plan,
            external_id=order.token,
            return_url=url_for("pricing", _external=True, plan=plan),
            completion_url=url_for("checkout_completion", _external=True, token=order.token),
            customer={
                "name": full_name,
                "email": current_user.email,
                "cellphone": phone,
                "taxId": tax_id,
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
            if apply_paid_order(current_user, order):
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
    status = order.status
    if order.status != "PAID":
        try:
            remote_status = get_billing_status(order.billing_id, external_id=order.token)
        except AbacatePayError as exc:
            warning = payment_warning_message(str(exc))
            return jsonify({"ok": True, "status": status, "plan": order.plan, "warning": warning})
        if remote_status:
            status = remote_status
            if remote_status == "PAID":
                if order.billing_id:
                    mark_order_paid_by_billing_id(order.billing_id)
                else:
                    mark_order_paid_by_token(order.token)
                order = get_order_by_token(order.token)
                if order and order.user_id:
                    u = User.query.get(int(order.user_id))
                    if u and apply_paid_order(u, order):
                        db.session.commit()
    return jsonify({"ok": True, "status": status, "plan": order.plan})


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
                    if apply_paid_order(u, order):
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

    billing_orders = list_orders_by_user(current_user.id, limit=10)
    billing_history = _build_billing_history(
        current_user, billing_orders, include_remote=(section == "billing")
    )

    subscription = subscription_context(current_user)

    return render_template(
        "account.html",
        section=section,
        subscription=subscription,
        billing_history=billing_history,
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


@app.post("/app/account/access")
@login_required
def account_access_save():
    """Atualiza e-mail e/ou senha do usuario."""
    if not current_user.is_verified:
        return redirect(url_for("auth.verify_pending"))

    new_email = (request.form.get("new_email") or "").strip().lower()
    current_password = request.form.get("current_password") or ""
    new_password = request.form.get("new_password") or ""
    confirm_password = request.form.get("confirm_password") or ""

    if not current_password or not current_user.check_password(current_password):
        flash("Senha atual invalida.", "error")
        return redirect(url_for("account_page", section="access"))

    errors = []
    changes = []

    if new_email:
        if new_email == (current_user.email or "").lower():
            new_email = ""
        elif not re.match(r"^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$", new_email):
            errors.append("Informe um e-mail valido.")
        elif User.query.filter(User.email == new_email, User.id != current_user.id).first():
            errors.append("Esse e-mail ja esta em uso.")
        else:
            current_user.email = new_email
            changes.append("email")

    if new_password or confirm_password:
        if new_password != confirm_password:
            errors.append("As senhas nao conferem.")
        elif len(new_password) < 6:
            errors.append("A nova senha precisa ter ao menos 6 caracteres.")
        else:
            current_user.set_password(new_password)
            changes.append("password")

    if errors:
        for e in errors:
            flash(e, "error")
        return redirect(url_for("account_page", section="access"))

    if not changes:
        flash("Nenhuma alteracao para salvar.", "info")
        return redirect(url_for("account_page", section="access"))

    db.session.commit()
    flash("Dados de acesso atualizados.", "success")
    return redirect(url_for("account_page", section="access"))


@app.post("/app/account/notifications")
@login_required
def account_notifications_save():
    """Salva preferencia de alerta de vencimento."""
    if not current_user.is_verified:
        return redirect(url_for("auth.verify_pending"))

    due_alert = bool(request.form.get("due_alert"))
    current_user.notify_due_alert = due_alert
    db.session.commit()
    flash("Preferencias atualizadas.", "success")
    return redirect(url_for("account_page", section="notifications"))


@app.post("/app/billing/renew")
@login_required
def billing_renew():
    if not current_user.is_verified:
        return redirect(url_for("auth.verify_pending"))

    plan = (current_user.plan or "basic").strip().lower()
    if not is_valid_plan(plan):
        plan = "basic"

    if not (
        getattr(current_user, "full_name", None)
        and getattr(current_user, "tax_id", None)
        and getattr(current_user, "cellphone", None)
    ):
        flash(
            "Para iniciar o pagamento, preencha seus dados pessoais (nome, CPF e telefone).",
            "info",
        )
        return redirect(url_for("account_page", section="profile"))

    order = create_order(plan, user_id=current_user.id)

    completion_url = url_for("billing_return", token=order.token, _external=True)
    return_url = url_for("account_page", section="billing", _external=True)

    customer = {
        "name": current_user.full_name,
        "email": current_user.email,
        "cellphone": current_user.cellphone,
        "taxId": current_user.tax_id,
    }

    try:
        billing = create_plan_billing(
            plan=plan,
            external_id=order.token,
            return_url=return_url,
            completion_url=completion_url,
            customer=customer,
        )
    except AbacatePayError as e:
        flash(str(e), "error")
        return redirect(url_for("account_page", section="billing"))
    except Exception:
        flash("Nao foi possivel iniciar o checkout agora. Tente novamente.", "error")
        return redirect(url_for("account_page", section="billing"))

    set_order_billing_id(order.token, billing["billing_id"])
    return redirect(billing["url"], code=302)


@app.get("/app/billing/return")
@login_required
def billing_return():
    token = (request.args.get("token") or "").strip()
    order = get_order_by_token(token)
    if not order:
        flash("Nao encontramos esse checkout.", "error")
        return redirect(url_for("account_page", section="billing"))
    if order.user_id and int(order.user_id) != int(current_user.id):
        flash("Checkout nao encontrado para esta conta.", "error")
        return redirect(url_for("account_page", section="billing"))

    if order.status == "PAID":
        if apply_paid_order(current_user, order):
            db.session.commit()
        flash("Pagamento confirmado. Sua assinatura foi renovada.", "success")
        return redirect(url_for("account_page", section="billing"))

    billing_orders = list_orders_by_user(current_user.id, limit=10)
    billing_history = _build_billing_history(current_user, billing_orders, include_remote=True)
    status_url = url_for(
        "analytics.upgrade_status",
        token=order.token,
        redirect=url_for("account_page", section="billing"),
    )
    return render_template(
        "upgrade_return.html",
        order=order,
        back_url=url_for("account_page", section="billing"),
        status_url=status_url,
        billing_history=billing_history,
    )


@app.get("/healthz")
def healthz():
    return "ok", 200


if __name__ == "__main__":
    app.run(debug=True, use_reloader=False)
