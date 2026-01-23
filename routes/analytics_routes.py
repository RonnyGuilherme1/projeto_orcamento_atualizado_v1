from __future__ import annotations

from flask import Blueprint, render_template, request, redirect, url_for, flash, jsonify, current_app
from flask_login import login_required, current_user

from models.extensions import db
from services.plans import PLANS, is_valid_plan
from services.feature_gate import require_feature
from services.checkout_store import (
    create_order,
    set_order_billing_id,
    get_order_by_token,
    mark_order_paid_by_billing_id,
    mark_order_paid_by_token,
    list_orders_by_user,
)
from services.abacatepay import create_plan_billing, get_billing_status, AbacatePayError
from services.subscription import apply_paid_order


analytics_bp = Blueprint("analytics", __name__)


def _payment_warning_message(raw: str) -> str:
    if current_app.config.get("ABACATEPAY_DEV_MODE"):
        return raw
    return "Nao foi possivel validar o pagamento agora. Tente novamente em alguns minutos."


def _history_from_orders(orders):
    items = []
    for order in orders or []:
        plan = PLANS.get(order.plan, PLANS["basic"])
        when = order.paid_at or order.created_at
        date = when.strftime("%d/%m/%Y") if when else "-"
        items.append(
            {
                "date": date,
                "plan": plan["name"],
                "status": (order.status or "").upper() or "PENDING",
                "amount": plan.get("price_month"),
            }
        )
    return items


@analytics_bp.get("/app/upgrade")
@login_required
def upgrade():
    """Página de planos (upgrade/downgrade) via checkout."""
    return render_template("upgrade.html")


@analytics_bp.get("/app/upgrade/checkout")
@login_required
def upgrade_checkout_page():
    plan = (request.args.get("plan") or "basic").strip().lower()
    if not is_valid_plan(plan):
        plan = "basic"
    if plan == current_user.plan:
        flash("Você já está nesse plano.", "info")
        return redirect(url_for("analytics.upgrade"))
    return render_template("upgrade_checkout.html", selected_plan=plan)


@analytics_bp.post("/app/upgrade/checkout")
@login_required
def upgrade_checkout_start():
    plan = (request.form.get("plan") or "basic").strip().lower()
    if not is_valid_plan(plan):
        plan = "basic"
    if plan == current_user.plan:
        flash("Você já está nesse plano.", "info")
        return redirect(url_for("analytics.upgrade"))

    # Cria pedido local vinculado ao usuário logado
    order = create_order(plan, user_id=current_user.id)

    # Cria cobrança no provedor (PIX)
    try:
        # Para iniciar o pagamento, precisamos de dados pessoais.
        if not (
            getattr(current_user, "full_name", None)
            and getattr(current_user, "tax_id", None)
            and getattr(current_user, "cellphone", None)
        ):
            flash(
                "Para iniciar o pagamento, preencha seus dados pessoais (nome, CPF e telefone) em Minha conta > Dados pessoais.",
                "info",
            )
            return redirect(url_for("account_page", section="profile"))

        # Mantemos o mesmo padrão do checkout público:
        # - completionUrl: página que o cliente verá após pagar
        # - returnUrl: fallback/voltar
        completion_url = url_for("analytics.upgrade_return", token=order.token, _external=True)
        return_url = url_for("analytics.upgrade", _external=True)

        customer = {
            "name": current_user.full_name,
            "email": current_user.email,
            "cellphone": current_user.cellphone,
            "taxId": current_user.tax_id,
        }

        billing = create_plan_billing(
            plan=plan,
            external_id=order.token,
            return_url=return_url,
            completion_url=completion_url,
            customer=customer,
        )
    except AbacatePayError as e:
        flash(str(e), "error")
        return redirect(url_for("analytics.upgrade_checkout_page", plan=plan))
    except Exception:
        flash("Não foi possível iniciar o checkout agora. Tente novamente.", "error")
        return redirect(url_for("analytics.upgrade_checkout_page", plan=plan))

    set_order_billing_id(order.token, billing["billing_id"])
    return redirect(billing["url"])


@analytics_bp.get("/app/upgrade/return")
@login_required
def upgrade_return():
    """Página de retorno pós-pagamento (cliente redirecionado pelo provedor)."""
    token = (request.args.get("token") or "").strip()
    order = get_order_by_token(token)
    if not order:
        flash("Não encontramos esse checkout.", "error")
        return redirect(url_for("analytics.upgrade"))

    # Se o webhook já marcou como pago, aplica o plano aqui.
    if order.status == "PAID":
        if apply_paid_order(current_user, order):
            db.session.commit()
        flash(f"Pagamento confirmado. Seu plano foi atualizado para {PLANS[order.plan]['name']}.", "success")
        return redirect(url_for("index"))

    flash("Pagamento em processamento. Se você já pagou, aguarde alguns instantes e atualize a página.", "info")
    billing_orders = list_orders_by_user(current_user.id, limit=10)
    billing_history = _history_from_orders(billing_orders)
    return render_template("upgrade_return.html", order=order, billing_history=billing_history)


@analytics_bp.get("/app/upgrade/status")
@login_required
def upgrade_status():
    token = (request.args.get("token") or "").strip()
    order = get_order_by_token(token)
    if not order:
        return jsonify({"ok": False, "error": "not_found"}), 404
    if order.user_id and int(order.user_id) != int(current_user.id):
        return jsonify({"ok": False, "error": "forbidden"}), 403

    redirect_to = (request.args.get("redirect") or "").strip()
    if order.status == "PAID":
        if apply_paid_order(current_user, order):
            db.session.commit()
        return jsonify(
            {"ok": True, "status": "PAID", "redirect": redirect_to or url_for("index")}
        )

    status = order.status
    if order.billing_id or order.token:
        try:
            remote_status = get_billing_status(order.billing_id, external_id=order.token)
        except AbacatePayError as exc:
            warning = _payment_warning_message(str(exc))
            return jsonify({"ok": True, "status": status, "warning": warning})

        if remote_status:
            status = remote_status
            if remote_status == "PAID":
                if order.billing_id:
                    mark_order_paid_by_billing_id(order.billing_id)
                else:
                    mark_order_paid_by_token(order.token)
                order = get_order_by_token(order.token)
                if order and apply_paid_order(current_user, order):
                    db.session.commit()
                return jsonify(
                    {"ok": True, "status": "PAID", "redirect": redirect_to or url_for("index")}
                )

    return jsonify({"ok": True, "status": status})


@analytics_bp.post("/app/subscribe")
@login_required
def subscribe():
    # Endpoint antigo (MVP). Mantido apenas para compatibilidade.
    flash("A troca de plano agora é feita via checkout. Selecione o plano e finalize o pagamento.", "info")
    return redirect(url_for("analytics.upgrade"))


@analytics_bp.get("/app/charts")
@login_required
@require_feature("charts")
def charts_page():
    return render_template("charts.html")


@analytics_bp.get("/app/compare")
@login_required
@require_feature("compare")
def compare_page():
    return render_template("compare.html")


@analytics_bp.get("/app/filters")
@login_required
@require_feature("filters")
def filters_page():
    return render_template("filters.html")


@analytics_bp.get("/app/projection")
@login_required
@require_feature("projection")
def projection_page():
    return render_template("projection.html")


@analytics_bp.get("/app/reports")
@login_required
@require_feature("reports")
def reports_page():
    return render_template("reports.html")
