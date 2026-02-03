from __future__ import annotations

from datetime import date, timedelta

from models.entrada_model import Entrada
from models.reminder_model import Reminder


def fetch_reminder_entries(
    rem: Reminder,
    *,
    user_id: int,
    today: date | None = None,
    limit: int = 50,
) -> list[Entrada]:
    """Busca entradas que disparam o lembrete.

    Pensado para uso manual hoje e scheduler futuro.
    """

    start = today or date.today()
    end = start + timedelta(days=int(rem.days_before or 3))

    query = Entrada.query.filter(
        Entrada.user_id == user_id,
        Entrada.data >= start,
        Entrada.data <= end,
    )
    if rem.tipo:
        query = query.filter(Entrada.tipo == rem.tipo)
    if rem.categoria:
        query = query.filter(Entrada.categoria == rem.categoria)
    if rem.status:
        query = query.filter(Entrada.status == rem.status)
    if rem.metodo:
        query = query.filter(Entrada.metodo == rem.metodo)
    if rem.min_value is not None:
        query = query.filter(Entrada.valor >= float(rem.min_value))
    if rem.max_value is not None:
        query = query.filter(Entrada.valor <= float(rem.max_value))

    return query.order_by(Entrada.data.asc(), Entrada.id.asc()).limit(limit).all()
