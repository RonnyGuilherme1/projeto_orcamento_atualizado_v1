"""Definições de planos e features (MVP).

Este módulo centraliza:
- nomes dos planos
- preços (exibição)
- quais funcionalidades cada plano libera

Pagamento ainda não está integrado; o plano é associado ao usuário via User.plan.
"""

from __future__ import annotations


PLANS: dict[str, dict] = {
    "basic": {
        "name": "Básico",
        "price_month": 14.90,
        "highlights": [
            "Controle de receitas e despesas",
            "Resumo mensal e saldo",
            "Categorias básicas",
        ],
        "features": {
            # básico não inclui analytics avançado
        },
    },
    "plus": {
        "name": "Plus",
        "price_month": 29.90,
        "popular": True,
        "highlights": [
            "Gráficos mensais e anuais",
            "Comparação de períodos",
            "Filtros avançados no histórico",
            "Projeção de saldo",
            "Relatórios simples",
        ],
        "features": {
            "charts",
            "compare",
            "filters",
            "projection",
            "reports",
        },
    },
    "pro": {
        "name": "Pro",
        "price_month": 49.90,
        "highlights": [
            "Tudo do Plus",
            "Base para recursos avançados (exportação, múltiplas contas)",
            "Prioridade em melhorias",
        ],
        "features": {
            "charts",
            "compare",
            "filters",
            "projection",
            "reports",
        },
    },
}


def is_valid_plan(plan: str) -> bool:
    return (plan or "").strip().lower() in PLANS


def plan_features(plan: str) -> set[str]:
    plan = (plan or "basic").strip().lower()
    return set(PLANS.get(plan, PLANS["basic"]).get("features", set()))
