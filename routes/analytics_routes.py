from __future__ import annotations

from datetime import date, timedelta

from sqlalchemy import func

from flask import Blueprint, render_template, request, redirect, url_for, flash, jsonify
from flask_login import login_required, current_user

from models.extensions import db
from models.entrada_model import Entrada
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
from services.abacatepay import create_plan_billing, get_billing_status, AbacatePayError, payment_warning_message
from services.date_utils import last_day_of_month
from services.subscription import apply_paid_order


analytics_bp = Blueprint("analytics", __name__)

CATEGORIAS = {
    "salario": "Salário",
    "extras": "Extras",
    "moradia": "Moradia",
    "mercado": "Mercado",
    "transporte": "Transporte",
    "servicos": "Serviços",
    "outros": "Outros",
}

STATUS_PADROES = {"pago", "em_andamento", "nao_pago"}

MESES = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
]


def _normalize_categoria(value: str | None) -> str:
    categoria = (value or "").strip().lower()
    if categoria not in CATEGORIAS:
        return "outros"
    return categoria


def _require_verified_json():
    if not current_user.is_verified:
        return jsonify({"error": "email_not_verified"}), 403
    return None


def _parse_iso_date(value: str | None) -> date | None:
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        return None


def _summary_for_period(start: date, end: date) -> dict:
    entries = (
        Entrada.query
        .filter(
            Entrada.user_id == current_user.id,
            Entrada.data >= start,
            Entrada.data <= end,
        )
        .all()
    )

    receitas_total = sum(float(e.valor) for e in entries if e.tipo == "receita")
    despesas_total = sum(float(e.valor) for e in entries if e.tipo == "despesa")
    receitas_count = sum(1 for e in entries if e.tipo == "receita")
    despesas_count = sum(1 for e in entries if e.tipo == "despesa")

    saldo_projetado = receitas_total - despesas_total

    categoria_totais = {key: 0.0 for key in CATEGORIAS}
    for e in entries:
        if e.tipo != "despesa":
            continue
        cat = _normalize_categoria(getattr(e, "categoria", None))
        categoria_totais[cat] += float(e.valor)

    categorias = []
    for key, total in categoria_totais.items():
        if total <= 0:
            continue
        percent = (total / despesas_total * 100) if despesas_total else 0.0
        categorias.append(
            {
                "key": key,
                "label": CATEGORIAS.get(key, "Outros"),
                "total": round(total, 2),
                "percent": round(percent, 1),
            }
        )
    categorias.sort(key=lambda item: item["total"], reverse=True)

    top_receitas = sorted(
        [e for e in entries if e.tipo == "receita"],
        key=lambda item: float(item.valor),
        reverse=True,
    )[:10]
    top_despesas = sorted(
        [e for e in entries if e.tipo == "despesa"],
        key=lambda item: float(item.valor),
        reverse=True,
    )[:10]

    def _entry_payload(entry: Entrada) -> dict:
        return {
            "id": entry.id,
            "date": entry.data.isoformat() if entry.data else None,
            "type": entry.tipo,
            "description": entry.descricao,
            "category": _normalize_categoria(getattr(entry, "categoria", None)),
            "value": round(float(entry.valor), 2),
            "status": entry.status,
        }

    return {
        "period": {"start": start.isoformat(), "end": end.isoformat()},
        "summary": {
            "receitas": round(receitas_total, 2),
            "despesas": round(despesas_total, 2),
            "saldo_projetado": round(saldo_projetado, 2),
            "entradas": len(entries),
            "receitas_count": receitas_count,
            "despesas_count": despesas_count,
        },
        "categories": categorias,
        "top_entries": [_entry_payload(item) for item in top_receitas]
        + [_entry_payload(item) for item in top_despesas],
    }


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
            warning = payment_warning_message(str(exc))
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


@analytics_bp.get("/app/charts/data")
@login_required
@require_feature("charts")
def charts_data():
    blocked = _require_verified_json()
    if blocked:
        return blocked

    today = date.today()

    def _safe_int(value, default):
        try:
            return int(value)
        except (TypeError, ValueError):
            return default

    year = _safe_int(request.args.get("year"), today.year)
    month = _safe_int(request.args.get("month"), today.month)
    if month < 1 or month > 12:
        month = today.month

    start = date(year, month, 1)
    end = last_day_of_month(start)

    entries = (
        Entrada.query
        .filter(
            Entrada.user_id == current_user.id,
            Entrada.data >= start,
            Entrada.data <= end,
        )
        .all()
    )

    receitas_total = sum(float(e.valor) for e in entries if e.tipo == "receita")
    despesas_total = sum(float(e.valor) for e in entries if e.tipo == "despesa")
    receitas_count = sum(1 for e in entries if e.tipo == "receita")
    despesas_count = sum(1 for e in entries if e.tipo == "despesa")

    receitas_antes = (
        db.session.query(func.coalesce(func.sum(Entrada.valor), 0.0))
        .filter(
            Entrada.user_id == current_user.id,
            Entrada.tipo == "receita",
            Entrada.data < start,
        )
        .scalar()
    )
    despesas_pagas_antes = (
        db.session.query(func.coalesce(func.sum(Entrada.valor), 0.0))
        .filter(
            Entrada.user_id == current_user.id,
            Entrada.tipo == "despesa",
            Entrada.status == "pago",
            Entrada.paid_at.isnot(None),
            Entrada.paid_at < start,
        )
        .scalar()
    )

    saldo_anterior = float(receitas_antes) - float(despesas_pagas_antes)
    saldo_projetado = receitas_total - despesas_total

    # Serie diaria
    days = (end - start).days + 1
    daily_receitas = [0.0] * days
    daily_despesas = [0.0] * days
    for e in entries:
        idx = (e.data - start).days
        if idx < 0 or idx >= days:
            continue
        if e.tipo == "receita":
            daily_receitas[idx] += float(e.valor)
        elif e.tipo == "despesa":
            daily_despesas[idx] += float(e.valor)

    daily_saldo = [r - d for r, d in zip(daily_receitas, daily_despesas)]
    saldo_acumulado = []
    running = saldo_anterior
    for val in daily_saldo:
        running += val
        saldo_acumulado.append(round(running, 2))

    # Categorias
    categoria_totais = {key: 0.0 for key in CATEGORIAS}
    for e in entries:
        if e.tipo != "despesa":
            continue
        cat = _normalize_categoria(getattr(e, "categoria", None))
        categoria_totais[cat] += float(e.valor)

    categorias = []
    for key, total in categoria_totais.items():
        if total <= 0:
            continue
        percent = (total / despesas_total * 100) if despesas_total else 0.0
        categorias.append(
            {
                "key": key,
                "label": CATEGORIAS.get(key, "Outros"),
                "total": round(total, 2),
                "percent": round(percent, 1),
            }
        )
    categorias.sort(key=lambda item: item["total"], reverse=True)

    # Status das despesas
    status_totais = {"pago": 0.0, "em_andamento": 0.0, "nao_pago": 0.0}
    for e in entries:
        if e.tipo != "despesa":
            continue
        status = (e.status or "em_andamento").strip().lower()
        if status not in STATUS_PADROES:
            status = "em_andamento"
        status_totais[status] += float(e.valor)

    # Destaques
    week_net = {}
    for idx, val in enumerate(daily_saldo):
        week = (idx // 7) + 1
        week_net[week] = week_net.get(week, 0.0) + float(val)
    if week_net:
        best_week = max(week_net.items(), key=lambda item: item[1])
        best_week_total = round(best_week[1], 2)
        best_week_label = f"Semana {best_week[0]}"
    else:
        best_week_total = 0.0
        best_week_label = "-"

    top_expense = None
    for e in entries:
        if e.tipo == "despesa":
            if not top_expense or float(e.valor) > float(top_expense.valor):
                top_expense = e
    if top_expense:
        top_expense_total = round(float(top_expense.valor), 2)
        top_expense_label = CATEGORIAS.get(
            _normalize_categoria(getattr(top_expense, "categoria", None)),
            "Outros",
        )
    else:
        top_expense_total = 0.0
        top_expense_label = "-"

    equilibrio = round((despesas_total / receitas_total) * 100, 1) if receitas_total else 0.0

    alerts = []
    if receitas_total <= 0 and despesas_total <= 0:
        alerts.append("Sem lançamentos no período.")
    else:
        hoje = date.today()
        ref_date = hoje if (year == hoje.year and month == hoje.month) else start
        limite = ref_date + timedelta(days=7)
        if limite > end:
            limite = end
        proximas = (
            Entrada.query
            .filter(
                Entrada.user_id == current_user.id,
                Entrada.tipo == "despesa",
                (Entrada.status.is_(None)) | (Entrada.status != "pago"),
                Entrada.data >= ref_date,
                Entrada.data <= limite,
            )
            .count()
        )
        if proximas:
            alerts.append(f"{proximas} despesas vencem nos próximos 7 dias.")
        else:
            alerts.append("Nenhuma despesa vencendo nos próximos 7 dias.")

        if categorias:
            top_cat = categorias[0]
            if top_cat["percent"] >= 35:
                alerts.append(
                    f"Categoria {top_cat['label']} concentra {top_cat['percent']}% das despesas."
                )

        if saldo_projetado < 0:
            alerts.append("Saldo projetado negativo. Ajuste despesas variáveis.")
        elif receitas_total and saldo_projetado < (receitas_total * 0.1):
            alerts.append("Saldo projetado abaixo de 10% das receitas.")

    return jsonify(
        {
            "period": {
                "year": year,
                "month": month,
                "start": start.isoformat(),
                "end": end.isoformat(),
            },
            "summary": {
                "receitas": round(receitas_total, 2),
                "despesas": round(despesas_total, 2),
                "saldo_projetado": round(saldo_projetado, 2),
                "saldo_anterior": round(saldo_anterior, 2),
                "entradas": len(entries),
                "receitas_count": receitas_count,
                "despesas_count": despesas_count,
            },
            "line": {
                "labels": [str(i + 1).zfill(2) for i in range(days)],
                "receitas": [round(v, 2) for v in daily_receitas],
                "despesas": [round(v, 2) for v in daily_despesas],
                "saldo": [round(v, 2) for v in daily_saldo],
                "saldo_acumulado": saldo_acumulado,
            },
            "categories": categorias,
            "statuses": {
                "pago": round(status_totais["pago"], 2),
                "em_andamento": round(status_totais["em_andamento"], 2),
                "nao_pago": round(status_totais["nao_pago"], 2),
            },
            "highlights": {
                "best_week_total": best_week_total,
                "best_week_label": best_week_label,
                "top_expense_total": top_expense_total,
                "top_expense_label": top_expense_label,
                "equilibrio": equilibrio,
            },
            "alerts": alerts[:3],
            "updated_at": date.today().isoformat(),
        }
    )


@analytics_bp.get("/app/insights/data")
@analytics_bp.get("/app/compare/data")
@login_required
def insights_data():
    blocked = _require_verified_json()
    if blocked:
        return blocked

    start = _parse_iso_date(request.args.get("start"))
    end = _parse_iso_date(request.args.get("end"))
    if not start or not end:
        return jsonify({"error": "invalid_dates"}), 400
    if end < start:
        return jsonify({"error": "invalid_range"}), 400

    return jsonify(_summary_for_period(start, end))


@analytics_bp.get("/app/insights")
@login_required
@require_feature("insights")
def insights_page():
    return render_template("insights.html")


@analytics_bp.get("/app/compare")
@login_required
def compare_page():
    return redirect(url_for("analytics.insights_page"))


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
