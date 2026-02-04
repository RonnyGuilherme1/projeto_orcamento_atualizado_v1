from __future__ import annotations

from datetime import date, datetime, timedelta

from models.entrada_model import Entrada
from models.extensions import db
from models.recurrence_model import Recurrence, RecurrenceExecution
from services.rules_engine import apply_rules_to_entry, normalize_category


def resolve_recurrence_date(rec: Recurrence, target: date | None = None) -> date:
    """Resolve a data de execucao da recorrencia para um dia alvo.

    Esta funcao e reutilizavel por um scheduler futuro.
    """

    base = target or date.today()
    day = max(1, min(31, int(rec.day_of_month or 1)))
    try:
        return date(base.year, base.month, day)
    except ValueError:
        if base.month == 12:
            return date(base.year, base.month, 31)
        next_month = date(base.year, base.month + 1, 1)
        return next_month - timedelta(days=1)


def run_recurrence_once(rec: Recurrence, user, run_date: date | None = None) -> tuple[bool, Entrada]:
    """Executa a recorrencia e retorna (created, entry).

    Nao faz commit. O caller deve controlar a transacao.
    """

    run_date = resolve_recurrence_date(rec, run_date)
    existing = (
        Entrada.query.filter(
            Entrada.user_id == user.id,
            Entrada.recurrence_id == rec.id,
            Entrada.data == run_date,
        )
        .first()
    )
    if existing:
        return False, existing

    status = None
    paid_at = None
    received_at = None
    if rec.tipo == "despesa":
        status = rec.status
        paid_at = run_date if status == "pago" else None
    elif rec.tipo == "receita" and rec.status == "recebido":
        status = "recebido"
        received_at = run_date

    entry = Entrada(
        user_id=user.id,
        data=run_date,
        tipo=rec.tipo,
        descricao=rec.descricao,
        categoria=normalize_category(rec.tipo, rec.categoria),
        valor=float(rec.valor or 0),
        status=status,
        paid_at=paid_at,
        received_at=received_at,
        metodo=rec.metodo,
        tags=rec.tags,
        recurrence_id=rec.id,
    )
    db.session.add(entry)
    db.session.flush()
    apply_rules_to_entry(entry, user, trigger="create", dry_run=False)

    rec.last_run_at = datetime.utcnow()
    db.session.add(
        RecurrenceExecution(
            recurrence_id=rec.id,
            entry_id=entry.id,
            user_id=user.id,
        )
    )
    return True, entry
