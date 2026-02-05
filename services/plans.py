"""Definições de planos e features.

Fonte de verdade alinhada com o marketing (pricing.html).
Centraliza:
- nomes e textos de exibição
- preços (exibição)
- quais funcionalidades cada plano libera
"""

from __future__ import annotations


PLANS: dict[str, dict] = {
    "basic": {
        "name": "Plano Básico",
        "price_month": 11.90,
        "tagline": "Organize suas finanças sem complicação.",
        "description": (
            "Ideal para quem quer registrar receitas e despesas, acompanhar o mês atual "
            "e manter o controle básico do dinheiro."
        ),
        "benefits_title": "O que você consegue fazer",
        "highlights": [
            "Dashboard mensal com visão rápida de receitas, despesas e saldo do mês",
            "Lançamento de receitas e despesas para controlar o que entra e sai",
            "Filtros simples nas entradas por periodo, categoria e valor (status em despesas quando aplicavel)",
            "Resumo mensal com totais do período sem análises avançadas",
            "Categorias básicas para organização simples por tipo de gasto",
        ],
        "audience_title": "Para quem é",
        "audience": [
            "Quem está começando a organizar a vida financeira",
            "Uso pessoal e cotidiano",
            "Controle simples, sem projeções ou automações",
        ],
        "impact": "O essencial para não perder o controle do seu dinheiro.",
        # Básico não inclui analytics avançado.
        "features": set(),
    },
    "plus": {
        "name": "Plano Plus",
        "price_month": 29.90,
        "tagline": "Entenda seus gastos e automatize seu controle.",
        "description": (
            "Para quem já controla o básico e quer analisar padrões, identificar excessos "
            "e automatizar classificações."
        ),
        "benefits_title": "Tudo do Plano Básico, mais",
        "highlights": [
            "Gráficos mensais e anuais com evolução de receitas, despesas e saldo",
            "Insights automáticos com comparações com o mês anterior",
            "Variações e alertas inteligentes para excesso de gastos",
            "Filtros avançados no histórico por período, categoria, status e método",
            "Regras e automações com classificação automática por descrição",
            "Aplicação no histórico e em novos lançamentos",
            "Visão comparativa para saber onde você gastou mais ou menos",
            "Categorias fora do padrão para ajustes rápidos",
        ],
        "audience_title": "Para quem é",
        "audience": [
            "Quem quer entender onde o dinheiro está indo",
            "Quem deseja reduzir gastos com base em dados",
            "Quem quer menos trabalho manual",
        ],
        "impact": "Menos planilha, mais inteligência financeira.",
        "features": {
            "charts",
            "insights",
            "filters",
        },
    },
    "pro": {
        "name": "Plano Pro",
        "price_month": 49.90,
        "popular": True,
        "badge": "Destaque Pro",
        "badge_sub": "Mais completo",
        "tagline": "Planeje o futuro e gere relatórios profissionais.",
        "description": (
            "Para quem precisa planejar o saldo futuro, simular cenários e gerar relatórios "
            "completos em PDF e Excel."
        ),
        "benefits_title": "Tudo do Plano Plus, mais",
        "highlights": [
            "Projeção de saldo para saber até quando o dinheiro aguenta",
            "Simulação de pagamentos, atrasos e ajustes de cenários",
            "Análise de pendências com impacto real no saldo futuro",
            "Relatórios completos: DRE pessoal, fluxo de caixa detalhado e por categoria",
            "Exportação e impressão com PDF (capa, período e resumo executivo)",
            "Exportação para Excel para edições e consolidações",
            "Visão estratégica com saúde financeira e comparativos avançados",
            "Base para decisões reais e planejamento do futuro",
        ],
        "audience_title": "Para quem é",
        "audience": [
            "Quem quer planejar o mês e o futuro",
            "Quem precisa de relatórios organizados",
            "Quem trata o financeiro de forma estratégica",
        ],
        "impact": "Transforme seus lançamentos em decisões.",
        "features": {
            "charts",
            "insights",
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
