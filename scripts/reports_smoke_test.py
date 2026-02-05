import os
import sys
import tempfile
from datetime import date, datetime


def _setup_env():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if root not in sys.path:
        sys.path.insert(0, root)
    tmpdir = tempfile.mkdtemp(prefix="reports_smoke_")
    db_path = os.path.join(tmpdir, "reports_test.db")
    os.environ.setdefault("DATABASE_URL", f"sqlite:///{db_path}")
    os.environ.setdefault("APP_ENV", "production")
    os.environ.setdefault("SECRET_KEY", "test-secret-key-please-change-32chars+")
    os.environ.setdefault("APP_BASE_URL", "https://example.test")
    os.environ.setdefault("MARKETING_BASE_URL", "https://example.test")
    os.environ.setdefault("ABACATEPAY_WEBHOOK_SECRET", "testsecret")
    os.environ.setdefault("EMAIL_SEND_ENABLED", "0")
    os.environ.setdefault("EMAIL_VERIFICATION_DEV_MODE", "1")


def _build_payload(detail: str, with_data: bool) -> dict:
    summary = {"income": 6200.0, "expense": 4100.0, "net": 2100.0, "economy_pct": 33.9}
    comparison = {
        "prev_pct": 8.2,
        "avg_pct": -4.1,
        "note": "Resultado acima do periodo anterior.",
        "income_prev_pct": 5.1,
        "expense_prev_pct": 2.8,
        "income_avg_pct": 3.4,
        "expense_avg_pct": 7.2,
    }
    health = {
        "ratio": 66.1,
        "status": "Equilibrio",
        "alerts": ["Despesas controladas no periodo.", "Economia acima de 10% das receitas."],
    }
    pending = {
        "count": 2,
        "total": 420.0,
        "impact": 1680.0,
        "overdue": 1,
        "due_7": 1,
        "items": [
            {
                "date": "2026-02-02",
                "description": "Internet",
                "category": "Servicos",
                "value": 120.0,
                "days_overdue": 1,
            },
            {
                "date": "2026-02-05",
                "description": "Energia",
                "category": "Moradia",
                "value": 300.0,
                "days_overdue": 0,
            },
        ],
    }
    dre = {
        "rows": [
            {"label": "Salario", "income": 6200.0, "expense": 0.0, "net": 6200.0},
            {"label": "Moradia", "income": 0.0, "expense": 1800.0, "net": -1800.0},
            {"label": "Servicos", "income": 0.0, "expense": 900.0, "net": -900.0},
            {"label": "Mercado", "income": 0.0, "expense": 1400.0, "net": -1400.0},
        ],
        "total": {"income": 6200.0, "expense": 4100.0, "net": 2100.0},
    }
    categories = {
        "rows": [
            {"label": "Moradia", "total": 1800.0, "percent": 43.9, "delta": 6.2},
            {"label": "Mercado", "total": 1400.0, "percent": 34.1, "delta": -2.0},
            {"label": "Servicos", "total": 900.0, "percent": 22.0, "delta": 1.4},
        ],
    }
    recurring = {
        "items": [
            {"name": "Salario", "frequency": "Mensal", "value": 6200.0, "reliability": 85},
        ],
        "summary": {"count": 1, "monthly_estimate": 6200.0},
    }

    if not with_data:
        summary = {"income": 0.0, "expense": 0.0, "net": 0.0, "economy_pct": 0.0}
        comparison = {
            "prev_pct": None,
            "avg_pct": None,
            "note": "Sem base para comparar com o periodo anterior.",
            "income_prev_pct": None,
            "expense_prev_pct": None,
            "income_avg_pct": None,
            "expense_avg_pct": None,
        }
        health = {"ratio": 0.0, "status": "Equilibrio", "alerts": []}
        pending = {"count": 0, "total": 0.0, "impact": 0.0, "overdue": 0, "due_7": 0, "items": []}
        dre = {"rows": [], "total": {"income": 0.0, "expense": 0.0, "net": 0.0}}
        categories = {"rows": []}
        recurring = {"items": [], "summary": {"count": 0, "monthly_estimate": 0.0}}

    if detail == "resumido":
        flow_rows = [
            {"date": "2026-02-01", "income": 3000.0, "expense": 0.0, "balance": 3000.0},
            {"date": "2026-02-02", "income": 0.0, "expense": 1500.0, "balance": 1500.0},
            {"date": "2026-02-03", "income": 3200.0, "expense": 2600.0, "balance": 2100.0},
        ] if with_data else []
    else:
        flow_rows = [
            {
                "date": "2026-02-01",
                "description": "Salario",
                "category": "Salario",
                "method": "Transferencia",
                "status": "Recebido",
                "income": 3000.0,
                "expense": 0.0,
                "balance": 3000.0,
            },
            {
                "date": "2026-02-02",
                "description": "Aluguel",
                "category": "Moradia",
                "method": "Pix",
                "status": "Pago",
                "income": 0.0,
                "expense": 1500.0,
                "balance": 1500.0,
            },
            {
                "date": "2026-02-03",
                "description": "Freelance",
                "category": "Extras",
                "method": "Transferencia",
                "status": "Recebido",
                "income": 3200.0,
                "expense": 0.0,
                "balance": 4700.0,
            },
            {
                "date": "2026-02-03",
                "description": "Mercado",
                "category": "Mercado",
                "method": "Cartao",
                "status": "Pago",
                "income": 0.0,
                "expense": 2600.0,
                "balance": 2100.0,
            },
        ] if with_data else []

    payload = {
        "period": {"start": "2026-02-01", "end": "2026-02-03"},
        "summary": summary,
        "comparison": comparison,
        "health": health,
        "pending": pending,
        "dre": dre,
        "flow": {"rows": flow_rows, "final_balance": summary.get("net", 0.0)},
        "categories": categories,
        "recurring": recurring,
        "updated_at": "2026-02-03",
    }
    return payload


def main():
    _setup_env()

    from services.reports_pdf import render_reports_pdf
    from routes.analytics_routes import _build_reports_excel_workbook, EXCEL_DATE_FORMAT

    sections = {"summary", "dre", "flow", "categories", "recurring", "pending"}
    meta = {
        "title": "Relatorio Financeiro",
        "user_name": "Teste",
        "period_label": "01/02/2026 - 03/02/2026",
        "mode_label": "Caixa",
        "type_label": "Ambos",
        "status_label": "Todos",
        "detail_label": "Detalhado",
        "generated_at": "03/02/2026 10:00",
    }

    results = []

    def check(label, condition):
        if not condition:
            raise AssertionError(label)
        results.append(label)

    for detail in ("resumido", "detalhado"):
        for with_data in (False, True):
            payload = _build_payload(detail, with_data)
            pdf_bytes = render_reports_pdf(payload, sections, detail, meta)
            check(f"pdf_{detail}_{'data' if with_data else 'empty'}", pdf_bytes[:4] == b"%PDF")

    payload_excel = _build_payload("detalhado", True)
    wb = _build_reports_excel_workbook(
        payload=payload_excel,
        sections=sections,
        mode="cash",
        user_label="Teste",
        period_label="01/02/2026 - 03/02/2026",
    )
    ws_flow = wb["Fluxo"]
    flow_date = ws_flow["A2"].value
    check("excel_date_flow_type", isinstance(flow_date, (date, datetime)))
    check("excel_date_flow_format", ws_flow["A2"].number_format == EXCEL_DATE_FORMAT)

    ws_pending = wb["Pendencias"]
    pending_date = ws_pending["A2"].value
    check("excel_date_pending_type", isinstance(pending_date, (date, datetime)))
    check("excel_date_pending_format", ws_pending["A2"].number_format == EXCEL_DATE_FORMAT)

    print("OK - reports smoke tests passed:")
    for item in results:
        print(f"- {item}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
