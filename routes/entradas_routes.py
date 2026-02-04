from datetime import datetime, date, timedelta

from sqlalchemy import func

from flask import Blueprint, request, jsonify
from flask_login import current_user

from models.extensions import db
from models.entrada_model import Entrada
from services.date_utils import last_day_of_month
from services.rules_engine import apply_rules_to_entry, normalize_tags
from services.permissions import require_api_access, json_error
from services.input_validation import (
    MAX_DESCRIPTION_LEN,
    MAX_TAGS_LEN,
    normalize_method,
    normalize_priority,
    normalize_status,
    normalize_text,
    normalize_tipo,
    parse_amount,
    parse_iso_date,
)

entradas_bp = Blueprint("entradas", __name__)

CATEGORIAS_RECEITA = {
    "salario": "Salário",
    "extras": "Extras",
    "outros": "Outros",
}

CATEGORIAS_DESPESA = {
    "moradia": "Moradia",
    "mercado": "Mercado",
    "transporte": "Transporte",
    "servicos": "Serviços",
    "outros": "Outros",
}


def _normalize_categoria(tipo: str | None, value: str | None) -> str:
    categoria = (value or "").strip().lower()
    if (tipo or "").strip().lower() == "receita":
        allowed = CATEGORIAS_RECEITA
    elif (tipo or "").strip().lower() == "despesa":
        allowed = CATEGORIAS_DESPESA
    else:
        allowed = CATEGORIAS_DESPESA
    if categoria not in allowed:
        return "outros"
    return categoria


def _validate_entry_payload(payload: dict) -> tuple[dict | None, str | None]:
    tipo = normalize_tipo(payload.get("tipo"))
    if not tipo:
        return None, "invalid_tipo"

    data_dt = parse_iso_date(payload.get("data"))
    if not data_dt:
        return None, "invalid_data"

    descricao = normalize_text(payload.get("descricao"), max_len=MAX_DESCRIPTION_LEN, min_len=1)
    if not descricao:
        return None, "invalid_descricao"

    valor = parse_amount(payload.get("valor"))
    if valor is None:
        return None, "invalid_valor"

    raw_status = payload.get("status")
    status = normalize_status(tipo, raw_status)
    if raw_status not in (None, "") and status is None:
        return None, "invalid_status"

    if tipo == "despesa":
        status = status or "em_andamento"

    raw_metodo = payload.get("metodo")
    metodo = normalize_method(raw_metodo)
    if raw_metodo not in (None, "") and metodo is None:
        return None, "invalid_metodo"

    tags = normalize_tags(payload.get("tags"))
    if tags and len(tags) > MAX_TAGS_LEN:
        return None, "invalid_tags"

    priority = normalize_priority(payload.get("priority"))

    return {
        "tipo": tipo,
        "data": data_dt,
        "descricao": descricao,
        "valor": valor,
        "status": status,
        "metodo": metodo,
        "tags": tags,
        "priority": priority,
        "categoria": _normalize_categoria(tipo, payload.get("categoria")),
    }, None


@entradas_bp.route("/dados")
@require_api_access(require_active=True)
def dados():
    limit_raw = request.args.get("limit")
    offset_raw = request.args.get("offset")
    limit = None
    offset = None
    if limit_raw not in (None, ""):
        try:
            limit = max(1, min(int(limit_raw), 2000))
        except (TypeError, ValueError):
            return json_error("invalid_limit", 422)
    if offset_raw not in (None, ""):
        try:
            offset = max(0, int(offset_raw))
        except (TypeError, ValueError):
            return json_error("invalid_offset", 422)

    query = (
        Entrada.query
        .filter_by(user_id=current_user.id)
        .order_by(Entrada.data.desc(), Entrada.id.desc())
    )
    if offset:
        query = query.offset(offset)
    if limit:
        query = query.limit(limit)

    entradas = query.all()

    return jsonify({
        "entradas": [
            {
                "id": e.id,
                "data": e.data.isoformat(),
                "tipo": e.tipo,
                "descricao": e.descricao,
                "categoria": _normalize_categoria(e.tipo, e.categoria),
                "valor": float(e.valor),
                "status": e.status,
                "paid_at": e.paid_at.isoformat() if e.paid_at else None,
                "received_at": e.received_at.isoformat() if e.received_at else None,
                "metodo": e.metodo,
                "tags": e.tags,
            }
            for e in entradas
        ]
    })


@entradas_bp.route("/add", methods=["POST"])
@require_api_access(require_active=True)
def add():

    payload = request.json or {}
    clean, error = _validate_entry_payload(payload)
    if error:
        return json_error(error, 422)

    tipo = clean["tipo"]
    data_dt = clean["data"]
    descricao = clean["descricao"]
    categoria = clean["categoria"]
    valor = clean["valor"]
    status = clean["status"]
    metodo = clean["metodo"]
    tags = clean["tags"]
    priority = clean["priority"]

    paid_at = None
    received_at = None
    if tipo == "receita":
        if status == "recebido":
            received_at = data_dt
        else:
            status = None
    else:
        if status == "pago":
            # CORREÇÃO:
            # Se criar já como pago e o front não mandar paid_at, assume a própria data da despesa.
            paid_at_str = payload.get("paid_at")
            if paid_at_str:
                paid_at = parse_iso_date(paid_at_str)
                if not paid_at:
                    return json_error("invalid_paid_at", 422)
            else:
                paid_at = data_dt

    e = Entrada(
        user_id=current_user.id,
        data=data_dt,
        tipo=tipo,
        descricao=descricao,
        categoria=categoria,
        valor=valor,
        metodo=metodo,
        tags=tags,
        status=status,
        paid_at=paid_at,
        received_at=received_at,
        priority=priority,
    )

    db.session.add(e)
    db.session.flush()
    apply_rules_to_entry(e, current_user, trigger="create", dry_run=False)
    db.session.commit()

    return jsonify({"ok": True})


@entradas_bp.route("/edit/<int:entrada_id>", methods=["PUT"])
@require_api_access(require_active=True)
def edit(entrada_id):

    payload = request.json or {}

    e = Entrada.query.filter_by(id=entrada_id, user_id=current_user.id).first()
    if not e:
        return jsonify({"error": "Not found"}), 404

    clean, error = _validate_entry_payload(payload)
    if error:
        return json_error(error, 422)

    tipo = clean["tipo"]
    status = clean["status"]

    e.data = clean["data"]
    e.tipo = tipo
    e.descricao = clean["descricao"]
    e.categoria = clean["categoria"]
    e.valor = clean["valor"]
    if "metodo" in payload:
        e.metodo = clean["metodo"]
    if "tags" in payload:
        e.tags = clean["tags"]
    if "priority" in payload:
        e.priority = clean["priority"] or e.priority

    if tipo == "receita":
        if status == "recebido":
            e.status = "recebido"
            e.received_at = e.data
        else:
            e.status = None
            e.received_at = None
        e.paid_at = None
    else:
        old_status = e.status
        new_status = status or "em_andamento"
        e.status = new_status

        if new_status == "pago":
            paid_at_str = payload.get("paid_at")

            if paid_at_str:
                paid_at = parse_iso_date(paid_at_str)
                if not paid_at:
                    return json_error("invalid_paid_at", 422)
                e.paid_at = paid_at
            else:
                # CORREÇÃO PRINCIPAL:
                # Se o front não manda paid_at, assume a própria data da despesa (vencimento/data planejada).
                # Isso faz o saldo anterior bater corretamente em qualquer data histórica.
                # Só define quando está virando pago, ou quando ainda não tem paid_at.
                if old_status != "pago" or not e.paid_at:
                    e.paid_at = e.data
        else:
            e.paid_at = None
        e.received_at = None

    apply_rules_to_entry(e, current_user, trigger="edit", dry_run=False)
    db.session.commit()
    return jsonify({"ok": True})


@entradas_bp.route("/delete/<int:entrada_id>", methods=["DELETE"])
@require_api_access(require_active=True)
def delete(entrada_id):

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


@entradas_bp.route("/resumo-ciclo")
@require_api_access(require_active=True)
def resumo_ciclo():

    try:
        d = _parse_date_param(request.args.get("data"), "data")
        ate_raw = request.args.get("ate")
        ate = _parse_date_param(ate_raw, "ate") if ate_raw else last_day_of_month(d)
    except ValueError as ex:
        return json_error(str(ex), 422)

    if ate < d:
        return json_error("'ate' não pode ser menor que 'data'", 422)

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


# =========================================================
# Resumo por PERÍODO (somente o intervalo; sem projeções futuras)
# =========================================================
@entradas_bp.route("/resumo-periodo")
@require_api_access(require_active=True)
def resumo_periodo():

    try:
        de = _parse_date_param(request.args.get("de"), "de")
        ate = _parse_date_param(request.args.get("ate"), "ate")
    except ValueError as ex:
        return json_error(str(ex), 422)

    if ate < de:
        return json_error("'ate' não pode ser menor que 'de'", 422)

    # Excluir "sobras" (ex.: 'Sobra do mês passado') do resumo, conforme pedido.
    desc_lower = func.lower(func.coalesce(Entrada.descricao, ""))
    filtro_sobra = (
        ~desc_lower.like("%sobra do mês%")
        & ~desc_lower.like("%sobra do mes%")
        & ~desc_lower.like("%saldo do mês anterior%")
        & ~desc_lower.like("%saldo do mes anterior%")
    )

    total_receitas = (
        db.session.query(func.coalesce(func.sum(Entrada.valor), 0.0))
        .filter(
            Entrada.user_id == current_user.id,
            Entrada.tipo == "receita",
            Entrada.data >= de,
            Entrada.data <= ate,
            filtro_sobra,
        )
        .scalar()
    )
    total_receitas = float(total_receitas or 0)

    total_despesas = (
        db.session.query(func.coalesce(func.sum(Entrada.valor), 0.0))
        .filter(
            Entrada.user_id == current_user.id,
            Entrada.tipo == "despesa",
            Entrada.data >= de,
            Entrada.data <= ate,
        )
        .scalar()
    )
    total_despesas = float(total_despesas or 0)

    saldo_periodo = total_receitas - total_despesas

    receitas = (
        Entrada.query
        .filter(
            Entrada.user_id == current_user.id,
            Entrada.tipo == "receita",
            Entrada.data >= de,
            Entrada.data <= ate,
            filtro_sobra,
        )
        .order_by(Entrada.data.asc(), Entrada.id.asc())
        .all()
    )

    despesas = (
        Entrada.query
        .filter(
            Entrada.user_id == current_user.id,
            Entrada.tipo == "despesa",
            Entrada.data >= de,
            Entrada.data <= ate,
        )
        .order_by(Entrada.data.asc(), Entrada.id.asc())
        .all()
    )

    return jsonify(
        {
            "de": de.isoformat(),
            "ate": ate.isoformat(),
            "total_receitas": round(total_receitas, 2),
            "total_despesas": round(total_despesas, 2),
            "saldo_periodo": round(saldo_periodo, 2),
            "receitas": [
                {
                    "id": e.id,
                    "data": e.data.isoformat(),
                    "descricao": e.descricao,
                    "valor": float(e.valor),
                }
                for e in receitas
            ],
            "despesas": [
                {
                    "id": e.id,
                    "data": e.data.isoformat(),
                    "descricao": e.descricao,
                    "valor": float(e.valor),
                    "status": e.status,
                }
                for e in despesas
            ],
        }
    )
