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
        "tagline": "quem precisa do essencial no dia a dia",
        "highlights": [
            "Dashboard com visão geral do mês",
            "Resumo mensal de entradas e saídas",
            "Lançamentos de receitas e despesas",
        ],
        "features": {
            # básico não inclui analytics avançado
        },
    },
    "plus": {
        "name": "Plus",
        "price_month": 29.90,
        "popular": True,
        "tagline": "análises visuais e comparações",
        "highlights": [
            "Gráficos mensais e anuais",
            "Comparação de períodos",
            "Filtros avançados no histórico",
        ],
        "features": {
            "charts",
            "compare",
            "filters",
        },
    },
    "pro": {
        "name": "Pro",
        "price_month": 49.90,
        "tagline": "quem precisa de projeções e relatórios",
        "highlights": [
            "Tudo do Plus",
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
}


def is_valid_plan(plan: str) -> bool:
    return (plan or "").strip().lower() in PLANS


def plan_features(plan: str) -> set[str]:
    plan = (plan or "basic").strip().lower()
    return set(PLANS.get(plan, PLANS["basic"]).get("features", set()))
