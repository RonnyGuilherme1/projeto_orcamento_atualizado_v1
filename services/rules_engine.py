from __future__ import annotations

import json
from datetime import date, datetime

from models.automation_rule_model import AutomationRule, RuleExecution
from models.extensions import db
from services.feature_gate import user_has_feature


CATEGORIAS_RECEITA = {
    "salario",
    "extras",
    "outros",
}

CATEGORIAS_DESPESA = {
    "moradia",
    "mercado",
    "transporte",
    "servicos",
    "outros",
}

STATUS_DESPESA = {"em_andamento", "pago", "nao_pago"}


def normalize_category(tipo: str | None, value: str | None) -> str:
    categoria = (value or "").strip().lower()
    if (tipo or "").strip().lower() == "receita":
        allowed = CATEGORIAS_RECEITA
    else:
        allowed = CATEGORIAS_DESPESA
    if categoria not in allowed:
        return "outros"
    return categoria


def normalize_tags(value) -> str | None:
    if value is None:
        return None
    if isinstance(value, list):
        parts = value
    else:
        parts = str(value).split(",")
    tags = []
    for part in parts:
        item = str(part).strip()
        if not item:
            continue
        if item.lower() not in {t.lower() for t in tags}:
            tags.append(item)
    if not tags:
        return None
    return ", ".join(tags)


def _parse_json_list(raw: str | None) -> list[dict]:
    if not raw:
        return []
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return []
    if isinstance(data, list):
        return [item for item in data if isinstance(item, dict)]
    return []


def _serialize_value(value):
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    return value


def _snapshot_entry(entry) -> dict:
    return {
        "tipo": getattr(entry, "tipo", None),
        "data": getattr(entry, "data", None),
        "descricao": getattr(entry, "descricao", None),
        "categoria": getattr(entry, "categoria", None),
        "status": getattr(entry, "status", None),
        "paid_at": getattr(entry, "paid_at", None),
        "received_at": getattr(entry, "received_at", None),
        "tags": getattr(entry, "tags", None),
        "metodo": getattr(entry, "metodo", None),
    }


def _diff_snapshot(before: dict, after: dict) -> dict:
    tracked = [
        "descricao",
        "categoria",
        "status",
        "paid_at",
        "received_at",
        "tags",
        "metodo",
    ]
    changes = {}
    for key in tracked:
        if before.get(key) != after.get(key):
            changes[key] = {
                "before": _serialize_value(before.get(key)),
                "after": _serialize_value(after.get(key)),
            }
    return changes


def _apply_status_to_state(state: dict, status: str | None) -> None:
    status_norm = (status or "").strip().lower()
    tipo = (state.get("tipo") or "").strip().lower()

    if tipo == "receita":
        if status_norm != "recebido":
            return
        state["status"] = "recebido"
        state["received_at"] = state.get("data")
        state["paid_at"] = None
        return

    # despesa
    if status_norm not in STATUS_DESPESA:
        return
    state["status"] = status_norm
    if status_norm == "pago":
        state["paid_at"] = state.get("data")
    else:
        state["paid_at"] = None
    state["received_at"] = None


def _apply_status_to_entry(entry, status: str | None) -> None:
    status_norm = (status or "").strip().lower()
    tipo = (getattr(entry, "tipo", "") or "").strip().lower()

    if tipo == "receita":
        if status_norm != "recebido":
            return
        entry.status = "recebido"
        entry.received_at = entry.data
        entry.paid_at = None
        return

    if status_norm not in STATUS_DESPESA:
        return
    entry.status = status_norm
    if status_norm == "pago":
        entry.paid_at = entry.data
    else:
        entry.paid_at = None
    entry.received_at = None


def _apply_actions_to_state(state: dict, actions: list[dict]) -> dict:
    updated = dict(state)
    for action in actions:
        action_type = (action.get("type") or "").strip().lower()
        if action_type == "set_category":
            updated["categoria"] = normalize_category(updated.get("tipo"), action.get("value"))
        elif action_type == "set_status":
            _apply_status_to_state(updated, action.get("value"))
        elif action_type == "set_tags":
            updated["tags"] = normalize_tags(action.get("value"))
        elif action_type == "set_description_prefix":
            prefix = str(action.get("value") or "").strip()
            if prefix and not str(updated.get("descricao") or "").startswith(prefix):
                updated["descricao"] = f"{prefix}{updated.get('descricao') or ''}"
        elif action_type == "set_method":
            updated["metodo"] = (action.get("value") or "").strip() or None
    return updated


def _apply_actions_to_entry(entry, actions: list[dict]) -> None:
    for action in actions:
        action_type = (action.get("type") or "").strip().lower()
        if action_type == "set_category":
            entry.categoria = normalize_category(entry.tipo, action.get("value"))
        elif action_type == "set_status":
            _apply_status_to_entry(entry, action.get("value"))
        elif action_type == "set_tags":
            entry.tags = normalize_tags(action.get("value"))
        elif action_type == "set_description_prefix":
            prefix = str(action.get("value") or "").strip()
            if prefix and not str(entry.descricao or "").startswith(prefix):
                entry.descricao = f"{prefix}{entry.descricao or ''}"
        elif action_type == "set_method":
            entry.metodo = (action.get("value") or "").strip() or None


def _match_condition(entry, cond: dict) -> bool:
    field = (cond.get("field") or "").strip().lower()
    op = (cond.get("op") or "").strip().lower()
    value = cond.get("value")

    if field == "descricao" and op == "contains":
        return str(value or "").lower() in str(getattr(entry, "descricao", "") or "").lower()

    if field in {"tipo", "categoria", "status", "metodo"} and op == "eq":
        entry_val = getattr(entry, field, None)
        return str(entry_val or "").strip().lower() == str(value or "").strip().lower()

    if field == "valor" and op in {"gte", "lte"}:
        try:
            entry_val = float(getattr(entry, "valor", 0) or 0)
            target = float(value)
        except (TypeError, ValueError):
            return False
        if op == "gte":
            return entry_val >= target
        if op == "lte":
            return entry_val <= target

    if field == "tags" and op == "contains":
        entry_tags = str(getattr(entry, "tags", "") or "").lower()
        return str(value or "").strip().lower() in entry_tags

    return False


def _rule_matches(entry, conditions: list[dict]) -> bool:
    if not conditions:
        return True
    return all(_match_condition(entry, cond) for cond in conditions)


def _normalize_conditions(conditions: list[dict], actions: list[dict]) -> list[dict]:
    action_category = None
    action_status = None
    for action in actions:
        action_type = (action.get("type") or "").strip().lower()
        if action_type == "set_category" and action_category is None:
            action_category = str(action.get("value") or "").strip().lower()
        if action_type == "set_status" and action_status is None:
            action_status = str(action.get("value") or "").strip().lower()

    if not action_category and not action_status:
        return conditions

    filtered = []
    for cond in conditions:
        field = (cond.get("field") or "").strip().lower()
        value = str(cond.get("value") or "").strip().lower()
        if field == "categoria" and action_category and value == action_category:
            # evita exigir a mesma categoria que a regra vai aplicar
            continue
        if field == "status" and action_status and value == action_status:
            # evita exigir o mesmo status que a regra vai aplicar
            continue
        filtered.append(cond)
    return filtered


def _trigger_filter(query, trigger: str):
    if trigger == "create":
        return query.filter(AutomationRule.apply_on_create.is_(True))
    if trigger == "edit":
        return query.filter(AutomationRule.apply_on_edit.is_(True))
    if trigger == "import":
        return query.filter(AutomationRule.apply_on_import.is_(True))
    return query


def get_active_rules(user_id: int, trigger: str) -> list[AutomationRule]:
    query = AutomationRule.query.filter_by(user_id=user_id, is_enabled=True)
    query = _trigger_filter(query, trigger)
    return query.order_by(AutomationRule.priority.asc(), AutomationRule.id.asc()).all()


def _rule_allows_trigger(rule: AutomationRule, trigger: str) -> bool:
    if trigger == "create":
        return bool(rule.apply_on_create)
    if trigger == "edit":
        return bool(rule.apply_on_edit)
    if trigger == "import":
        return bool(rule.apply_on_import)
    return True


def apply_rule_to_entry(rule: AutomationRule, entry, user, trigger: str, dry_run: bool = False):
    if not rule or not rule.is_enabled:
        return None
    if not _rule_allows_trigger(rule, trigger):
        return None
    if not user or not user_has_feature(user, "filters"):
        return None

    conditions = _parse_json_list(rule.conditions_json)
    actions = _parse_json_list(rule.actions_json)
    conditions = _normalize_conditions(conditions, actions)

    matched = _rule_matches(entry, conditions)
    if not matched:
        return None

    before = _snapshot_entry(entry)
    if dry_run:
        after = _apply_actions_to_state(before, actions)
    else:
        _apply_actions_to_entry(entry, actions)
        after = _snapshot_entry(entry)

    changes = _diff_snapshot(before, after)

    exec_item = RuleExecution(
        rule_id=rule.id,
        entry_id=getattr(entry, "id", None),
        user_id=user.id,
        trigger=trigger,
        matched=True,
        changes_json=json.dumps(changes, ensure_ascii=True),
    )
    db.session.add(exec_item)

    if not dry_run:
        rule.run_count = (rule.run_count or 0) + 1
        rule.last_run_at = datetime.utcnow()

    return {"rule_id": rule.id, "matched": True, "changes": changes}


def apply_rules_to_entry(entry, user, trigger: str, dry_run: bool = False):
    if not user or not user_has_feature(user, "filters"):
        return []

    rules = get_active_rules(user.id, trigger)
    results = []
    for rule in rules:
        conditions = _parse_json_list(rule.conditions_json)
        actions = _parse_json_list(rule.actions_json)
        conditions = _normalize_conditions(conditions, actions)

        matched = _rule_matches(entry, conditions)
        if not matched:
            continue

        before = _snapshot_entry(entry)
        if dry_run:
            after = _apply_actions_to_state(before, actions)
        else:
            _apply_actions_to_entry(entry, actions)
            after = _snapshot_entry(entry)

        changes = _diff_snapshot(before, after)

        exec_item = RuleExecution(
            rule_id=rule.id,
            entry_id=getattr(entry, "id", None),
            user_id=user.id,
            trigger=trigger,
            matched=True,
            changes_json=json.dumps(changes, ensure_ascii=True),
        )
        db.session.add(exec_item)

        if not dry_run:
            rule.run_count = (rule.run_count or 0) + 1
            rule.last_run_at = datetime.utcnow()

        results.append({"rule_id": rule.id, "matched": True, "changes": changes})

        if rule.stop_after_apply:
            break

    return results
