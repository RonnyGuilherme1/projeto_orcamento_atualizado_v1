from datetime import datetime, date, timedelta

from sqlalchemy import func

from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user

from models.extensions import db
from models.entrada_model import Entrada

entradas_bp = Blueprint("entradas", __name__)

CATEGORIAS = {
    "moradia": "Moradia",
    "mercado": "Mercado",
    "transporte": "Transporte",
    "servicos": "Serviços",
    "outros": "Outros",
}


def _normalize_categoria(value: str | None) -> str:
    categoria = (value or "").strip().lower()
    if categoria not in CATEGORIAS:
        return "outros"
    return categoria


def _require_verified():
    if not current_user.is_verified:
        return jsonify({"error": "email_not_verified"}), 403
    return None


@entradas_bp.route("/dados")
@login_required
def dados():
    blocked = _require_verified()
    if blocked:
        return blocked

    entradas = (
        Entrada.query
        .filter_by(user_id=current_user.id)
        .order_by(Entrada.data.desc(), Entrada.id.desc())
        .all()
    )

    return jsonify({
        "entradas": [
            {
                "id": e.id,
                "data": e.data.isoformat(),
                "tipo": e.tipo,
                "descricao": e.descricao,
                "categoria": (e.categoria or "outros"),
                "valor": float(e.valor),
                "status": e.status,
                "paid_at": e.paid_at.isoformat() if e.paid_at else None,
            }
            for e in entradas
        ]
    })


@entradas_bp.route("/add", methods=["POST"])
@login_required
def add():
    blocked = _require_verified()
    if blocked:
        return blocked

    payload = request.json or {}
    tipo = payload.get("tipo")
    data_str = payload.get("data")
    descricao = (payload.get("descricao") or "").strip()
    categoria = _normalize_categoria(payload.get("categoria"))
    valor = float(payload.get("valor") or 0)
    status = payload.get("status")

    if not tipo or not data_str or not descricao:
        return jsonify({"error": "Dados inválidos"}), 400

    data_dt = datetime.strptime(data_str, "%Y-%m-%d").date()

    if tipo == "receita":
        status = None
    else:
        status = status or "em_andamento"

    paid_at = None
    if tipo != "receita" and status == "pago":
        # CORREÇÃO:
        # Se criar já como pago e o front não mandar paid_at, assume a própria data da despesa.
        paid_at_str = payload.get("paid_at")
        if paid_at_str:
            paid_at = datetime.strptime(paid_at_str, "%Y-%m-%d").date()
        else:
            paid_at = data_dt

    e = Entrada(
        user_id=current_user.id,
        data=data_dt,
        tipo=tipo,
        descricao=descricao,
        categoria=categoria,
        valor=valor,
        status=status,
        paid_at=paid_at,
    )

    db.session.add(e)
    db.session.commit()

    return jsonify({"ok": True})


@entradas_bp.route("/edit/<int:entrada_id>", methods=["PUT"])
@login_required
def edit(entrada_id):
    blocked = _require_verified()
    if blocked:
        return blocked

    payload = request.json or {}

    e = Entrada.query.filter_by(id=entrada_id, user_id=current_user.id).first()
    if not e:
        return jsonify({"error": "Not found"}), 404

    tipo = payload.get("tipo")
    data_str = payload.get("data")
    descricao = (payload.get("descricao") or "").strip()
    categoria = _normalize_categoria(payload.get("categoria"))
    valor = float(payload.get("valor") or 0)
    status = payload.get("status")

    if not tipo or not data_str or not descricao:
        return jsonify({"error": "Dados inválidos"}), 400

    e.data = datetime.strptime(data_str, "%Y-%m-%d").date()
    e.tipo = tipo
    e.descricao = descricao
    e.categoria = categoria
    e.valor = valor

    if tipo == "receita":
        e.status = None
        e.paid_at = None
    else:
        old_status = e.status
        new_status = status or "em_andamento"
        e.status = new_status

        if new_status == "pago":
            paid_at_str = payload.get("paid_at")

            if paid_at_str:
                e.paid_at = datetime.strptime(paid_at_str, "%Y-%m-%d").date()
            else:
                # CORREÇÃO PRINCIPAL:
                # Se o front não manda paid_at, assume a própria data da despesa (vencimento/data planejada).
                # Isso faz o saldo anterior bater corretamente em qualquer data histórica.
                # Só define quando está virando pago, ou quando ainda não tem paid_at.
                if old_status != "pago" or not e.paid_at:
                    e.paid_at = e.data
        else:
            e.paid_at = None

    db.session.commit()
    return jsonify({"ok": True})


@entradas_bp.route("/delete/<int:entrada_id>", methods=["DELETE"])
@login_required
def delete(entrada_id):
    blocked = _require_verified()
    if blocked:
        return blocked

    e = Entrada.query.filter_by(id=entrada_id, user_id=current_user.id).first()
    if not e:
        return jsonify({"error": "Not found"}), 404

    db.session.delete(e)
    db.session.commit()
    return jsonify({"ok": True})


def _parse_date_param(value: str | None, field_name: str) -> date:
    if not value:
        raise ValueError(f"Parâmetro '{field_name}' é obrigatório")
    return datetime.strptime(value, "%Y-%m-%d").date()


def _last_day_of_month(d: date) -> date:
    if d.month == 12:
        first_next = date(d.year + 1, 1, 1)
    else:
        first_next = date(d.year, d.month + 1, 1)
    return first_next - timedelta(days=1)


@entradas_bp.route("/resumo-ciclo")
@login_required
def resumo_ciclo():
    blocked = _require_verified()
    if blocked:
        return blocked

    try:
        d = _parse_date_param(request.args.get("data"), "data")
        ate_raw = request.args.get("ate")
        ate = _parse_date_param(ate_raw, "ate") if ate_raw else _last_day_of_month(d)
    except ValueError as ex:
        return jsonify({"error": str(ex)}), 400

    if ate < d:
        return jsonify({"error": "'ate' não pode ser menor que 'data'"}), 400

    dia_anterior = d - timedelta(days=1)

    receitas_ate_antes = (
        db.session.query(func.coalesce(func.sum(Entrada.valor), 0.0))
        .filter(
            Entrada.user_id == current_user.id,
            Entrada.tipo == "receita",
            Entrada.data <= dia_anterior,
        )
        .scalar()
    )

    despesas_pagas_ate_antes = (
        db.session.query(func.coalesce(func.sum(Entrada.valor), 0.0))
        .filter(
            Entrada.user_id == current_user.id,
            Entrada.tipo == "despesa",
            Entrada.status == "pago",
            Entrada.paid_at.isnot(None),
            Entrada.paid_at <= dia_anterior,
        )
        .scalar()
    )

    saldo_anterior = float(receitas_ate_antes) - float(despesas_pagas_ate_antes)

    receitas_no_dia = (
        db.session.query(func.coalesce(func.sum(Entrada.valor), 0.0))
        .filter(
            Entrada.user_id == current_user.id,
            Entrada.tipo == "receita",
            Entrada.data == d,
        )
        .scalar()
    )
    receitas_no_dia = float(receitas_no_dia)

    despesas_pendentes = (
        Entrada.query
        .filter(
            Entrada.user_id == current_user.id,
            Entrada.tipo == "despesa",
            Entrada.data >= d,
            Entrada.data <= ate,
            (Entrada.status.is_(None)) | (Entrada.status != "pago"),
        )
        .order_by(Entrada.data.asc(), Entrada.id.asc())
        .all()
    )

    total_despesas_pendentes = sum(float(e.valor) for e in despesas_pendentes)

    saldo_apos_receber = saldo_anterior + receitas_no_dia
    saldo_projetado = saldo_apos_receber - total_despesas_pendentes

    return jsonify(
        {
            "data": d.isoformat(),
            "ate": ate.isoformat(),
            "saldo_anterior": round(saldo_anterior, 2),
            "receitas_no_dia": round(receitas_no_dia, 2),
            "saldo_apos_receber": round(saldo_apos_receber, 2),
            "total_despesas_pendentes": round(total_despesas_pendentes, 2),
            "saldo_projetado": round(saldo_projetado, 2),
            "despesas_pendentes": [
                {
                    "id": e.id,
                    "data": e.data.isoformat(),
                    "descricao": e.descricao,
                    "valor": float(e.valor),
                    "status": e.status,
                }
                for e in despesas_pendentes
            ],
        }
    )
