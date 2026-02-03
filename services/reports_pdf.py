from __future__ import annotations

import io
import os
from datetime import date
from xml.sax.saxutils import escape as xml_escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas
from reportlab.platypus import (
    KeepTogether,
    ListFlowable,
    ListItem,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


PAGE_MARGIN = 16 * mm
HEADER_SPACE = 14 * mm
FOOTER_SPACE = 10 * mm
TOP_MARGIN = PAGE_MARGIN + HEADER_SPACE
BOTTOM_MARGIN = PAGE_MARGIN + FOOTER_SPACE


def _fmt_brl(value: float | int | None) -> str:
    try:
        num = float(value)
    except (TypeError, ValueError):
        return "R$ -"
    return f"R$ {num:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def _fmt_date(value: str | None) -> str:
    if not value:
        return "-"
    try:
        return date.fromisoformat(value).strftime("%d/%m/%Y")
    except Exception:
        return str(value)


def _truncate(text: str, limit: int) -> str:
    if not text:
        return "-"
    if len(text) <= limit:
        return text
    return f"{text[: max(0, limit - 3)]}..."


def _safe_text(value) -> str:
    if value is None:
        return "-"
    return xml_escape(str(value))


class _ReportCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        self._meta = kwargs.pop("meta", {})
        super().__init__(*args, **kwargs)
        self._saved_page_states: list[dict] = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self._draw_header_footer(num_pages)
            canvas.Canvas.showPage(self)
        canvas.Canvas.save(self)

    def _draw_header_footer(self, total_pages: int):
        page_width, page_height = self._pagesize
        left_margin = self._meta.get("left_margin", PAGE_MARGIN)
        right_margin = self._meta.get("right_margin", PAGE_MARGIN)
        top_margin = self._meta.get("top_margin", TOP_MARGIN)
        bottom_margin = self._meta.get("bottom_margin", BOTTOM_MARGIN)
        page_margin = self._meta.get("page_margin", PAGE_MARGIN)

        header_top = page_height - (page_margin / 2)
        header_bottom = page_height - top_margin + (page_margin / 2)
        footer_bottom = page_margin / 2
        footer_top = bottom_margin - (page_margin / 2)

        self.setStrokeColor(colors.HexColor("#E5E7EB"))
        self.setLineWidth(0.6)
        self.line(left_margin, header_bottom - 2, page_width - right_margin, header_bottom - 2)
        self.line(left_margin, footer_top + 2, page_width - right_margin, footer_top + 2)

        logo_reader = self._meta.get("logo_reader")
        text_x = left_margin
        if logo_reader:
            logo_height = min(16 * mm, header_top - header_bottom)
            logo_width = 28 * mm
            logo_y = header_top - logo_height
            try:
                self.drawImage(
                    logo_reader,
                    left_margin,
                    logo_y,
                    width=logo_width,
                    height=logo_height,
                    preserveAspectRatio=True,
                    mask="auto",
                )
                text_x = left_margin + logo_width + 8
            except Exception:
                text_x = left_margin

        title = self._meta.get("title", "Relatorio Financeiro")
        user_name = _truncate(str(self._meta.get("user_name") or "-"), 40)
        period_label = self._meta.get("period_label", "-")
        mode_label = self._meta.get("mode_label", "-")
        type_label = self._meta.get("type_label", "-")
        status_label = self._meta.get("status_label", "-")
        generated_at = self._meta.get("generated_at", "-")

        self.setFillColor(colors.HexColor("#111827"))
        self.setFont("Helvetica-Bold", 11)
        self.drawString(text_x, header_top - 10, title)

        meta_line_1 = f"Usuario: {user_name} | Periodo: {period_label} | Regime: {mode_label}"
        meta_line_2 = f"Tipo: {type_label} | Status: {status_label} | Gerado em: {generated_at}"

        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#4B5563"))
        self.drawString(text_x, header_top - 22, meta_line_1)
        self.drawString(text_x, header_top - 32, meta_line_2)

        footer_text = "Relatorio oficial gerado pelo sistema."
        footer_y = footer_bottom + 4
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#6B7280"))
        self.drawString(left_margin, footer_y, footer_text)
        self.drawRightString(
            page_width - right_margin,
            footer_y,
            f"Pagina {self._pageNumber} de {total_pages}",
        )


def render_reports_pdf(payload: dict, sections: set[str], detail: str, meta: dict) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=PAGE_MARGIN,
        rightMargin=PAGE_MARGIN,
        topMargin=TOP_MARGIN,
        bottomMargin=BOTTOM_MARGIN,
        title=meta.get("title", "Relatorio Financeiro"),
        author=meta.get("user_name", ""),
    )

    styles = getSampleStyleSheet()
    styles.add(
        ParagraphStyle(
            name="SectionTitle",
            fontName="Helvetica-Bold",
            fontSize=13,
            leading=16,
            spaceBefore=6,
            spaceAfter=6,
            textColor=colors.HexColor("#0F172A"),
        )
    )
    styles.add(
        ParagraphStyle(
            name="SectionSubtitle",
            fontName="Helvetica",
            fontSize=9,
            leading=12,
            textColor=colors.HexColor("#6B7280"),
            spaceAfter=8,
        )
    )
    styles.add(
        ParagraphStyle(
            name="BodySmall",
            fontName="Helvetica",
            fontSize=9,
            leading=12,
            textColor=colors.HexColor("#111827"),
        )
    )
    styles.add(
        ParagraphStyle(
            name="TableCell",
            fontName="Helvetica",
            fontSize=8,
            leading=10,
            textColor=colors.HexColor("#111827"),
            alignment=TA_LEFT,
        )
    )
    styles.add(
        ParagraphStyle(
            name="TableCellRight",
            fontName="Helvetica",
            fontSize=8,
            leading=10,
            textColor=colors.HexColor("#111827"),
            alignment=TA_RIGHT,
        )
    )

    def cell(text: str, right: bool = False) -> Paragraph:
        style = styles["TableCellRight"] if right else styles["TableCell"]
        return Paragraph(_safe_text(text), style)

    def make_table(rows: list[list], col_widths: list[float], right_cols: set[int] | None = None) -> Table:
        right_cols = right_cols or set()
        table = Table(rows, colWidths=col_widths, repeatRows=1, hAlign="LEFT")
        base_style = [
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#E5E7EB")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#111827")),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, 0), 8),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LINEBELOW", (0, 0), (-1, 0), 0.6, colors.HexColor("#CBD5F0")),
            ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#E5E7EB")),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]
        for col_idx in right_cols:
            base_style.append(("ALIGN", (col_idx, 0), (col_idx, -1), "RIGHT"))
        table.setStyle(TableStyle(base_style))
        return table

    story: list = []
    ordered_sections = [key for key in ["summary", "dre", "flow", "categories", "recurring", "pending"] if key in sections]
    if not ordered_sections:
        ordered_sections = ["summary", "dre", "flow"]

    def add_section_gap():
        if story:
            story.append(Spacer(1, 12))

    def add_section_header(title: str, subtitle: str):
        story.append(
            KeepTogether(
                [
                    Paragraph(title, styles["SectionTitle"]),
                    Paragraph(subtitle, styles["SectionSubtitle"]),
                ]
            )
        )

    summary = payload.get("summary", {})
    if "summary" in ordered_sections:
        add_section_gap()
        add_section_header("Resumo executivo", "Indicadores gerenciais do periodo selecionado.")

        net_value = float(summary.get("net") or 0.0)
        economy_pct = summary.get("economy_pct") or 0.0
        economy_label = "% economia" if net_value >= 0 else "% deficit"
        economy_value = economy_pct if net_value >= 0 else abs(float(economy_pct))

        kpi_data = [
            [
                Paragraph(f"<b>Total receitas</b><br/>{_fmt_brl(summary.get('income'))}", styles["BodySmall"]),
                Paragraph(f"<b>Total despesas</b><br/>{_fmt_brl(summary.get('expense'))}", styles["BodySmall"]),
            ],
            [
                Paragraph(f"<b>Resultado liquido</b><br/>{_fmt_brl(net_value)}", styles["BodySmall"]),
                Paragraph(f"<b>{economy_label}</b><br/>{economy_value:.1f}%", styles["BodySmall"]),
            ],
        ]
        kpi_table = Table(kpi_data, colWidths=[doc.width * 0.5, doc.width * 0.5])
        kpi_table.setStyle(
            TableStyle(
                [
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
                    ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 10),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                    ("TOPPADDING", (0, 0), (-1, -1), 8),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                ]
            )
        )
        story.append(kpi_table)
        story.append(Spacer(1, 8))

        notes: list[str] = []
        notes.append(f"Resultado liquido de {_fmt_brl(net_value)} no periodo.")
        category_rows = payload.get("categories", {}).get("rows") or []
        if category_rows:
            top_cat = category_rows[0]
            top_pct = top_cat.get("percent")
            top_pct_text = f"{top_pct}%" if top_pct is not None else "-"
            notes.append(f"Despesas concentradas em {top_cat.get('label')} ({top_pct_text}).")
        pending_total = payload.get("pending", {}).get("total") or 0
        if pending_total:
            impact = payload.get("pending", {}).get("impact")
            notes.append(f"Pendencias impactam saldo em {_fmt_brl(impact)}.")
        alerts = payload.get("health", {}).get("alerts") or []
        for alert in alerts:
            notes.append(str(alert))

        if not notes:
            notes.append("Sem observacoes relevantes no periodo.")

        story.append(Paragraph("Observacoes do periodo", styles["BodySmall"]))
        story.append(
            ListFlowable(
                [ListItem(Paragraph(_safe_text(item), styles["BodySmall"])) for item in notes],
                bulletType="bullet",
                start="circle",
                leftIndent=12,
            )
        )

    if "dre" in ordered_sections:
        add_section_gap()
        add_section_header("DRE", "Demonstrativo por categoria.")
        dre_rows = payload.get("dre", {}).get("rows") or []
        dre_total = payload.get("dre", {}).get("total") or {}
        if not dre_rows:
            story.append(Paragraph("Sem dados no periodo.", styles["BodySmall"]))
        else:
            rows = [
                [
                    cell("Categoria"),
                    cell("Receitas", right=True),
                    cell("Despesas", right=True),
                    cell("Resultado", right=True),
                ]
            ]
            for row in dre_rows:
                rows.append(
                    [
                        cell(str(row.get("label"))),
                        cell(_fmt_brl(row.get("income")), right=True),
                        cell(_fmt_brl(row.get("expense")), right=True),
                        cell(_fmt_brl(row.get("net")), right=True),
                    ]
                )
            if dre_total:
                rows.append(
                    [
                        cell("Resultado total"),
                        cell(_fmt_brl(dre_total.get("income")), right=True),
                        cell(_fmt_brl(dre_total.get("expense")), right=True),
                        cell(_fmt_brl(dre_total.get("net")), right=True),
                    ]
                )
            col_widths = [doc.width * 0.45, doc.width * 0.18, doc.width * 0.18, doc.width * 0.19]
            story.append(make_table(rows, col_widths, right_cols={1, 2, 3}))
    if "flow" in ordered_sections:
        suffix = " (resumido)" if detail == "resumido" else ""
        add_section_gap()
        add_section_header(f"Fluxo de caixa{suffix}", "Movimentacoes cronologicas com saldo acumulado.")
        flow_rows = payload.get("flow", {}).get("rows") or []
        final_balance = payload.get("flow", {}).get("final_balance")
        if not flow_rows:
            story.append(Paragraph("Sem dados no periodo.", styles["BodySmall"]))
        else:
            rows = [
                [
                    cell("Data"),
                    cell("Descricao"),
                    cell("Categoria"),
                    cell("Metodo"),
                    cell("Entrada", right=True),
                    cell("Saida", right=True),
                    cell("Saldo", right=True),
                ]
            ]
            for row in flow_rows:
                rows.append(
                    [
                        cell(_fmt_date(row.get("date"))),
                        cell(str(row.get("description") or "-")),
                        cell(str(row.get("category") or "-")),
                        cell(str(row.get("method") or "-")),
                        cell(_fmt_brl(row.get("income")) if row.get("income") else "-", right=True),
                        cell(_fmt_brl(row.get("expense")) if row.get("expense") else "-", right=True),
                        cell(_fmt_brl(row.get("balance")), right=True),
                    ]
                )
            if final_balance is not None:
                rows.append(
                    [
                        cell("Saldo final"),
                        cell(""),
                        cell(""),
                        cell(""),
                        cell(""),
                        cell(""),
                        cell(_fmt_brl(final_balance), right=True),
                    ]
                )
            col_widths = [
                doc.width * 0.12,
                doc.width * 0.28,
                doc.width * 0.15,
                doc.width * 0.11,
                doc.width * 0.11,
                doc.width * 0.11,
                doc.width * 0.12,
            ]
            story.append(make_table(rows, col_widths, right_cols={4, 5, 6}))
    if "categories" in ordered_sections:
        add_section_gap()
        add_section_header("Categorias", "Distribuicao percentual das despesas.")
        category_rows = payload.get("categories", {}).get("rows") or []
        if not category_rows:
            story.append(Paragraph("Sem dados no periodo.", styles["BodySmall"]))
        else:
            rows = [
                [
                    cell("Categoria"),
                    cell("Total", right=True),
                    cell("%", right=True),
                    cell("Variacao", right=True),
                ]
            ]
            for row in category_rows:
                delta = row.get("delta")
                delta_text = f"{delta}%" if delta is not None else "-"
                percent = row.get("percent")
                percent_text = f"{percent}%" if percent is not None else "-"
                rows.append(
                    [
                        cell(str(row.get("label") or "-")),
                        cell(_fmt_brl(row.get("total")), right=True),
                        cell(percent_text, right=True),
                        cell(delta_text, right=True),
                    ]
                )
            col_widths = [doc.width * 0.44, doc.width * 0.2, doc.width * 0.18, doc.width * 0.18]
            story.append(make_table(rows, col_widths, right_cols={1, 2, 3}))
    if "recurring" in ordered_sections:
        add_section_gap()
        add_section_header("Recorrencias", "Receitas recorrentes detectadas.")
        recurring_items = payload.get("recurring", {}).get("items") or []
        if not recurring_items:
            story.append(Paragraph("Sem recorrencias no periodo.", styles["BodySmall"]))
        else:
            rows = [
                [
                    cell("Nome"),
                    cell("Frequencia"),
                    cell("Valor medio", right=True),
                    cell("Confiabilidade", right=True),
                ]
            ]
            for item in recurring_items:
                reliability = item.get("reliability")
                reliability_text = f"{reliability}%" if reliability is not None else "-"
                rows.append(
                    [
                        cell(str(item.get("name") or "-")),
                        cell(str(item.get("frequency") or "-")),
                        cell(_fmt_brl(item.get("value")), right=True),
                        cell(reliability_text, right=True),
                    ]
                )
            col_widths = [doc.width * 0.44, doc.width * 0.2, doc.width * 0.18, doc.width * 0.18]
            story.append(make_table(rows, col_widths, right_cols={2, 3}))
    if "pending" in ordered_sections:
        add_section_gap()
        add_section_header("Pendencias", "Despesas nao pagas no periodo.")
        pending_items = payload.get("pending", {}).get("items") or []
        if not pending_items:
            story.append(Paragraph("Sem pendencias no periodo.", styles["BodySmall"]))
        else:
            rows = [
                [
                    cell("Vencimento"),
                    cell("Descricao"),
                    cell("Categoria"),
                    cell("Valor", right=True),
                    cell("Dias atraso", right=True),
                ]
            ]
            for item in pending_items:
                rows.append(
                    [
                        cell(_fmt_date(item.get("date"))),
                        cell(str(item.get("description") or "-")),
                        cell(str(item.get("category") or "-")),
                        cell(_fmt_brl(item.get("value")), right=True),
                        cell(str(item.get("days_overdue") or 0), right=True),
                    ]
                )
            col_widths = [
                doc.width * 0.16,
                doc.width * 0.34,
                doc.width * 0.2,
                doc.width * 0.15,
                doc.width * 0.15,
            ]
            story.append(make_table(rows, col_widths, right_cols={3, 4}))

    logo_reader = None
    logo_path = meta.get("logo_path")
    if logo_path and os.path.exists(logo_path):
        try:
            logo_reader = ImageReader(logo_path)
        except Exception:
            logo_reader = None

    canvas_meta = {
        "title": meta.get("title", "Relatorio Financeiro"),
        "user_name": meta.get("user_name", "-"),
        "period_label": meta.get("period_label", "-"),
        "mode_label": meta.get("mode_label", "-"),
        "type_label": meta.get("type_label", "-"),
        "status_label": meta.get("status_label", "-"),
        "generated_at": meta.get("generated_at", "-"),
        "left_margin": PAGE_MARGIN,
        "right_margin": PAGE_MARGIN,
        "top_margin": TOP_MARGIN,
        "bottom_margin": BOTTOM_MARGIN,
        "page_margin": PAGE_MARGIN,
        "logo_reader": logo_reader,
    }

    doc.build(
        story,
        canvasmaker=lambda *args, **kwargs: _ReportCanvas(*args, meta=canvas_meta, **kwargs),
    )
    buffer.seek(0)
    return buffer.getvalue()
