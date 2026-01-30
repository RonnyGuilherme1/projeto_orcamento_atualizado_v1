from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from typing import Any

from models.extensions import db
from models.entrada_model import Entrada
from models.recurrence_model import Recurrence


PRIORITY_ORDER = {"alta": 0, "media": 1, "baixa": 2}


def _clamp_day(year: int, month: int, day: int) -> date:
    # Ajusta para o último dia do mês se o day passar do limite.
    if month == 12:
        next_month = date(year + 1, 1, 1)
    else:
        next_month = date(year, month + 1, 1)
    last = next_month - timedelta(days=1)
    return date(year, month, min(day, last.day))


def _daterange(start: date, end: date):
    d = start
    while d <= end:
        yield d
        d += timedelta(days=1)


def _parse_priority(value: str | None) -> str:
    v = (value or "").strip().lower()
    return v if v in {"alta", "media", "baixa"} else "media"


def _resolve_entry_date(e: Entrada, mode: str) -> date:
    # mode: cash | accrual
    if mode == "cash":
        if e.tipo == "despesa" and e.status == "pago" and e.paid_at:
            return e.paid_at
        if e.tipo == "receita" and e.status == "recebido" and e.received_at:
            return e.received_at
    return e.data


def _should_count_before_start(e: Entrada, mode: str) -> bool:
    # Para saldo inicial, em cash desconta somente despesas pagas e soma somente receitas recebidas (ou sem status definido).
    if mode != "cash":
        return True
    if e.tipo == "despesa":
        return e.status == "pago"
    if e.tipo == "receita":
        # se tiver status e não for recebido, em cash não conta
        if e.status and e.status != "recebido":
            return False
        return True
    return True


def generate_recurrence_events(rec: Recurrence, start: date, end: date) -> list[dict[str, Any]]:
    # Somente monthly por enquanto (já é o que o modelo suporta)
    events: list[dict[str, Any]] = []
    if not rec.is_enabled:
        return events

    # começa no mês do start
    y, m = start.year, start.month
    while True:
        occ = _clamp_day(y, m, int(rec.day_of_month or 1))
        if occ < start:
            # próximo mês
            if m == 12:
                y, m = y + 1, 1
            else:
                m += 1
            continue
        if occ > end:
            break

        valor = float(rec.valor or 0.0)
        delta = valor if rec.tipo == "receita" else -valor
        events.append(
            {
                "uid": f"rec-{rec.id}-{occ.isoformat()}",
                "source": "recurrence",
                "kind": "recurrence",
                "date": occ,
                "descricao": rec.descricao,
                "categoria": rec.categoria or "outros",
                "tipo": rec.tipo,
                "valor": valor,
                "delta": delta,
                "status": rec.status,
                "priority": "media",
                "recurrence_id": rec.id,
            }
        )

        if m == 12:
            y, m = y + 1, 1
        else:
            m += 1
    return events


def apply_overrides(events: list[dict[str, Any]], overrides: dict[str, Any]) -> tuple[list[dict[str, Any]], float | None]:
    # overrides: shifts, reductions, extras, splits, reserve
    reserve_override = None
    if isinstance(overrides, dict):
        if overrides.get("reserve") is not None:
            try:
                reserve_override = float(overrides.get("reserve"))
            except (TypeError, ValueError):
                reserve_override = None

    # shifts (por entrada_id)
    shifts = overrides.get("shifts") if isinstance(overrides, dict) else None
    shift_map: dict[int, date] = {}
    if isinstance(shifts, list):
        for s in shifts:
            try:
                eid = int(s.get("entrada_id"))
                nd = date.fromisoformat(str(s.get("new_date")))
                shift_map[eid] = nd
            except Exception:
                continue

    # reductions: por categoria (somente despesas)
    red_map: dict[str, float] = {}
    reductions = overrides.get("reductions") if isinstance(overrides, dict) else None
    if isinstance(reductions, list):
        for r in reductions:
            cat = str(r.get("categoria") or "").strip().lower()
            if not cat:
                continue
            try:
                pct = float(r.get("percent") or 0.0)
            except (TypeError, ValueError):
                pct = 0.0
            pct = max(0.0, min(100.0, pct))
            if pct > 0:
                red_map[cat] = pct

    # splits: parcelar uma despesa (somente entradas)
    splits = overrides.get("splits") if isinstance(overrides, dict) else None
    split_map: dict[int, dict[str, Any]] = {}
    if isinstance(splits, list):
        for sp in splits:
            try:
                eid = int(sp.get("entrada_id"))
                parts = int(sp.get("parts") or 0)
                if parts < 2 or parts > 24:
                    continue
                split_map[eid] = {"parts": parts, "freq": str(sp.get("frequency") or "monthly")}
            except Exception:
                continue

    new_events: list[dict[str, Any]] = []
    for ev in events:
        # shift
        if ev.get("source") == "entry":
            try:
                eid = int(ev.get("id"))
                if eid in shift_map:
                    ev = dict(ev)
                    ev["date"] = shift_map[eid]
            except Exception:
                pass

        # reductions
        if ev.get("tipo") == "despesa":
            cat = str(ev.get("categoria") or "").strip().lower()
            if cat in red_map:
                pct = red_map[cat]
                ev = dict(ev)
                ev["valor"] = round(float(ev["valor"]) * (1.0 - pct / 100.0), 2)
                ev["delta"] = -abs(float(ev["valor"]))

        # splits (parcelar)
        if ev.get("source") == "entry":
            try:
                eid = int(ev.get("id"))
            except Exception:
                eid = None
            if eid is not None and eid in split_map and ev.get("tipo") == "despesa":
                parts = int(split_map[eid]["parts"])
                base_date = ev["date"]
                per = round(abs(float(ev["valor"])) / parts, 2)
                # Ajuste centavos no último
                total = round(per * parts, 2)
                diff = round(abs(float(ev["valor"])) - total, 2)

                for i in range(parts):
                    # mensal
                    y = base_date.year + ((base_date.month - 1 + i) // 12)
                    m = ((base_date.month - 1 + i) % 12) + 1
                    occ = _clamp_day(y, m, base_date.day)
                    amount = per + (diff if i == parts - 1 else 0.0)
                    new_events.append(
                        {
                            **{k: v for k, v in ev.items() if k not in {"uid"}},
                            "uid": f"split-{eid}-{i+1}-{occ.isoformat()}",
                            "kind": "installment",
                            "date": occ,
                            "valor": round(amount, 2),
                            "delta": -round(amount, 2),
                            "descricao": f"{ev.get('descricao')} (Parcela {i+1}/{parts})",
                        }
                    )
                continue

        new_events.append(ev)

    # extras (eventos manuais do cenário)
    extras = overrides.get("extras") if isinstance(overrides, dict) else None
    if isinstance(extras, list):
        for ex in extras:
            try:
                d = date.fromisoformat(str(ex.get("date")))
                valor = float(ex.get("valor") or 0.0)
                tipo = str(ex.get("tipo") or "receita").strip().lower()
                if tipo not in {"receita", "despesa"}:
                    tipo = "receita"
                delta = valor if tipo == "receita" else -abs(valor)
                new_events.append(
                    {
                        "uid": f"extra-{d.isoformat()}-{len(new_events)+1}",
                        "source": "scenario",
                        "kind": "extra",
                        "date": d,
                        "descricao": str(ex.get("descricao") or "Ajuste de cenário"),
                        "categoria": str(ex.get("categoria") or "ajustes"),
                        "tipo": tipo,
                        "valor": abs(float(valor)),
                        "delta": delta,
                        "status": "previsto",
                        "priority": "media",
                    }
                )
            except Exception:
                continue

    return new_events, reserve_override


def compute_projection(
    *,
    user_id: int,
    start: date,
    end: date,
    mode: str = "cash",
    include_recurring: bool = True,
    reserve_min: float = 0.0,
    overrides: dict[str, Any] | None = None,
) -> dict[str, Any]:
    mode = (mode or "cash").strip().lower()
    if mode not in {"cash", "accrual"}:
        mode = "cash"

    reserve_min = float(reserve_min or 0.0)
    reserve_min = max(0.0, reserve_min)

    entries: list[Entrada] = (
        db.session.query(Entrada)
        .filter(Entrada.user_id == user_id)
        .all()
    )

    saldo_inicial = 0.0
    base_events: list[dict[str, Any]] = []

    for e in entries:
        ev_date = _resolve_entry_date(e, mode)
        valor = float(e.valor or 0.0)

        if ev_date < start:
            if not _should_count_before_start(e, mode):
                continue
            if e.tipo == "receita":
                saldo_inicial += valor
            else:
                # despesa
                saldo_inicial -= valor
            continue

        if start <= ev_date <= end:
            delta = valor if e.tipo == "receita" else -valor
            base_events.append(
                {
                    "uid": f"entry-{e.id}",
                    "id": e.id,
                    "source": "entry",
                    "kind": "normal",
                    "date": ev_date,
                    "descricao": e.descricao,
                    "categoria": e.categoria or "outros",
                    "tipo": e.tipo,
                    "valor": valor,
                    "delta": delta,
                    "status": e.status or ("previsto" if e.tipo == "despesa" else "previsto"),
                    "priority": _parse_priority(getattr(e, "priority", None)),
                }
            )

    # Recorrências
    if include_recurring:
        recs: list[Recurrence] = (
            db.session.query(Recurrence)
            .filter(Recurrence.user_id == user_id, Recurrence.is_enabled == True)  # noqa: E712
            .all()
        )
        for rec in recs:
            base_events.extend(generate_recurrence_events(rec, start, end))

    # overrides
    active_overrides = overrides or {}
    events, reserve_override = apply_overrides(base_events, active_overrides)
    if reserve_override is not None:
        reserve_min = max(0.0, float(reserve_override))

    # Filtra novamente por range (shifts/extras/splits podem mover)
    events = [e for e in events if start <= e["date"] <= end]

    # Ordenação: por data, depois receitas primeiro, depois maior prioridade
    def sort_key(ev: dict[str, Any]):
        income_first = 0 if ev["delta"] > 0 else 1
        pr = PRIORITY_ORDER.get(_parse_priority(ev.get("priority")), 1)
        return (ev["date"], income_first, pr, abs(float(ev["delta"])) * -1)

    events.sort(key=sort_key)

    # Cálculo pay-all e daily series
    saldo_payall = saldo_inicial
    saldo_min = saldo_payall
    saldo_min_date = start
    break_date = None

    daily = []
    by_day: dict[date, list[dict[str, Any]]] = {}
    for ev in events:
        by_day.setdefault(ev["date"], []).append(ev)

    # Para tabela, precisamos saldo após em modo payall
    table_events: list[dict[str, Any]] = []

    for d in _daterange(start, end):
        day_events = by_day.get(d, [])
        for ev in day_events:
            saldo_payall += float(ev["delta"])
            table_events.append(
                {
                    **{k: v for k, v in ev.items() if k != "date"},
                    "date": ev["date"].isoformat(),
                    "saldo_after": round(saldo_payall, 2),
                    "covered": None,  # preencheremos abaixo
                }
            )

        if saldo_payall < saldo_min:
            saldo_min = saldo_payall
            saldo_min_date = d

        if break_date is None and saldo_payall < 0:
            break_date = d

        daily.append({"date": d.isoformat(), "saldo": round(saldo_payall, 2)})

    # Cobertura (não deixa ir abaixo de reserve_min)
    saldo_cover = saldo_inicial
    covered_count = 0
    total_expenses = 0

    # index table events by uid for marking covered
    uid_to_idx = {}
    for i, tev in enumerate(table_events):
        uid_to_idx[tev.get("uid")] = i

    uncovered: list[dict[str, Any]] = []

    for d in _daterange(start, end):
        day_events = by_day.get(d, [])
        incomes = [ev for ev in day_events if float(ev["delta"]) > 0]
        expenses = [ev for ev in day_events if float(ev["delta"]) < 0]

        for ev in incomes:
            saldo_cover += float(ev["delta"])

        expenses.sort(key=lambda ev: (PRIORITY_ORDER.get(_parse_priority(ev.get("priority")), 1), abs(float(ev["delta"])) * -1))

        for ev in expenses:
            total_expenses += 1
            needed = abs(float(ev["delta"]))
            if (saldo_cover - needed) >= reserve_min:
                saldo_cover -= needed
                covered = True
                covered_count += 1
            else:
                covered = False
                uncovered.append(
                    {
                        "date": ev["date"].isoformat(),
                        "descricao": ev.get("descricao"),
                        "categoria": ev.get("categoria"),
                        "valor": round(needed, 2),
                        "priority": _parse_priority(ev.get("priority")),
                        "reason": "Saldo insuficiente para cobrir sem quebrar a reserva",
                    }
                )
            # marca na tabela
            idx = uid_to_idx.get(ev.get("uid"))
            if idx is not None:
                table_events[idx]["covered"] = covered

        # marca receitas como always covered
        for ev in incomes:
            idx = uid_to_idx.get(ev.get("uid"))
            if idx is not None:
                table_events[idx]["covered"] = True

    coverage_percent = round((covered_count / total_expenses * 100.0), 1) if total_expenses else 100.0

    # categorias (para redução)
    cat_totals: dict[str, float] = {}
    for ev in events:
        if ev["tipo"] == "despesa":
            key = str(ev.get("categoria") or "outros").strip().lower()
            cat_totals[key] = round(cat_totals.get(key, 0.0) + abs(float(ev["delta"])), 2)

    categories = [{"key": k, "label": k.capitalize(), "total": v} for k, v in cat_totals.items()]
    categories.sort(key=lambda x: x["total"], reverse=True)

    # riscos
    risks = []
    if break_date:
        risks.append(
            {
                "type": "break",
                "message": f"Seu saldo fica negativo em {break_date.strftime('%d/%m/%Y')} no modo '{mode}'.",
            }
        )

    if uncovered:
        # Top 5
        top = uncovered[:5]
        risks.append(
            {
                "type": "uncovered",
                "message": f"{len(uncovered)} despesa(s) não ficam cobertas pela regra de prioridade/reserva.",
                "items": top,
            }
        )

    # janela do menor saldo
    if daily:
        # pega +/-2 dias da data min
        w_start = max(start, saldo_min_date - timedelta(days=2))
        w_end = min(end, saldo_min_date + timedelta(days=2))
        risks.append(
            {
                "type": "low_window",
                "message": f"Seu menor saldo no período é {saldo_min:.2f} em {saldo_min_date.strftime('%d/%m/%Y')}.",
                "from": w_start.isoformat(),
                "to": w_end.isoformat(),
            }
        )

    recommended_reserve = round(abs(saldo_min), 2) if saldo_min < 0 else 0.0

    return {
        "range": {"start": start.isoformat(), "end": end.isoformat()},
        "mode": mode,
        "include_recurring": bool(include_recurring),
        "reserve_min": round(reserve_min, 2),
        "saldo_inicial": round(saldo_inicial, 2),
        "saldo_final": round(daily[-1]["saldo"] if daily else saldo_inicial, 2),
        "min_saldo": round(saldo_min, 2),
        "min_saldo_date": saldo_min_date.isoformat(),
        "break_date": break_date.isoformat() if break_date else None,
        "coverage": {
            "covered_count": covered_count,
            "total_expenses": total_expenses,
            "percent": coverage_percent,
        },
        "recommended_reserve": recommended_reserve,
        "daily": daily,
        "events": table_events,
        "categories": categories,
        "risks": risks,
    }
