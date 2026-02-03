from __future__ import annotations

import io
import os
from datetime import date
from xml.sax.saxutils import escape as xml_escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    KeepTogether,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)


LEFT_RIGHT_MARGIN = 16 * mm
TOP_MARGIN = 14 * mm
BOTTOM_MARGIN = 14 * mm

HEADER_HEIGHT = 22 * mm
HEADER_GAP = 6 * mm

TEXT_COLOR = colors.HexColor("#111111")
TEXT_MUTED = colors.HexColor("#6B7280")
LINE_COLOR = colors.HexColor("#E3E7ED")
LIGHT_GRAY = colors.HexColor("#F2F4F6")
CARD_BG = colors.HexColor("#F8FAFC")
GREEN = colors.HexColor("#1F8A4C")
RED = colors.HexColor("#C0392B")
NEUTRAL = colors.HexColor("#94A3B8")

FLOW_DESC_LIMIT_RESUMIDO = 50
FLOW_DESC_LIMIT_DETALHADO = 120
OBS_MAX_RESUMIDO = 4
OBS_MAX_DETALHADO = 8


def _fmt_brl(value: float | int | None) -> str:
    try:
        num = float(value)
    except (TypeError, ValueError):
        return "R$ -"
    return f"R$ {num:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def _fmt_percent(value: float | int | None, decimals: int = 1) -> str:
    try:
        num = float(value)
    except (TypeError, ValueError):
        return "-"
    return f"{num:.{decimals}f}%"


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


def safe_text(value) -> str:
    if value is None:
        return ""
    return xml_escape(str(value))


class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        self._report_doc = kwargs.pop("report_doc", None)
        super().__init__(*args, **kwargs)
        self._saved_page_states: list[dict] = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        total_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self._draw_page_number(total_pages)
            canvas.Canvas.showPage(self)
        canvas.Canvas.save(self)

    def _draw_page_number(self, total_pages: int):
        page_width, _ = self._pagesize
        right = getattr(self._report_doc, "rightMargin", LEFT_RIGHT_MARGIN)
        bottom = getattr(self._report_doc, "bottomMargin", BOTTOM_MARGIN)
        y = max(6 * mm, bottom - 4 * mm)
        self.setFont("Helvetica", 8)
        self.setFillColor(TEXT_MUTED)
        self.drawRightString(page_width - right, y, f"Pagina {self._pageNumber} de {total_pages}")


def _draw_header_footer(canvas_obj: canvas.Canvas, doc: BaseDocTemplate, meta: dict):
    page_width, page_height = doc.pagesize
    left = doc.leftMargin
    right = doc.rightMargin
    top = doc.topMargin
    bottom = doc.bottomMargin

    header_top = page_height - top
    header_bottom = header_top - HEADER_HEIGHT

    canvas_obj.setStrokeColor(LINE_COLOR)
    canvas_obj.setLineWidth(0.6)

    logo_reader = meta.get("logo_reader")
    logo_height = 18 * mm
    logo_width = 22 * mm
    text_x = left
    if logo_reader:
        logo_y = header_bottom + (HEADER_HEIGHT - logo_height) / 2
        try:
            canvas_obj.drawImage(
                logo_reader,
                left,
                logo_y,
                width=logo_width,
                height=logo_height,
                preserveAspectRatio=True,
                mask="auto",
            )
            text_x = left + logo_width + 6
        except Exception:
            text_x = left

    title = meta.get("title", "Relatorio Financeiro")
    user_name = _truncate(str(meta.get("user_name") or "-"), 42)
    period_label = meta.get("period_label", "-")
    mode_label = meta.get("mode_label", "-")
    type_label = meta.get("type_label", "-")
    status_label = meta.get("status_label", "-")
    generated_at = meta.get("generated_at", "-")

    canvas_obj.setFillColor(TEXT_COLOR)
    canvas_obj.setFont("Helvetica-Bold", 14)
    canvas_obj.drawString(text_x, header_top - 4 * mm, title)

    meta_line_1 = f"Usuario: {user_name} | Periodo: {period_label} | Regime: {mode_label}"
    meta_line_2 = f"Tipo: {type_label} | Status: {status_label} | Gerado em: {generated_at}"
    detail_label = meta.get("detail_label")
    if detail_label:
        meta_line_2 = f"{meta_line_2} | Detalhamento: {detail_label}"

    canvas_obj.setFont("Helvetica", 8.5)
    canvas_obj.setFillColor(TEXT_MUTED)
    canvas_obj.drawString(text_x, header_top - 9 * mm, meta_line_1)
    canvas_obj.drawString(text_x, header_top - 13 * mm, meta_line_2)

    canvas_obj.line(left, header_bottom - 1 * mm, page_width - right, header_bottom - 1 * mm)

    footer_line_y = bottom + 2 * mm
    footer_text_y = max(6 * mm, bottom - 4 * mm)
    canvas_obj.line(left, footer_line_y, page_width - right, footer_line_y)
    canvas_obj.setFont("Helvetica", 8)
    canvas_obj.setFillColor(TEXT_MUTED)
    canvas_obj.drawString(left, footer_text_y, "Relatorio oficial gerado pelo sistema.")


class ReportDoc(BaseDocTemplate):
    def __init__(self, buffer: io.BytesIO, meta: dict):
        super().__init__(
            buffer,
            pagesize=A4,
            leftMargin=LEFT_RIGHT_MARGIN,
            rightMargin=LEFT_RIGHT_MARGIN,
            topMargin=TOP_MARGIN,
            bottomMargin=BOTTOM_MARGIN,
            title=meta.get("title", "Relatorio Financeiro"),
            author=str(meta.get("user_name") or ""),
        )

        frame_height = self.height - HEADER_HEIGHT - HEADER_GAP
        frame = Frame(
            self.leftMargin,
            self.bottomMargin,
            self.width,
            frame_height,
            id="content",
            showBoundary=0,
        )
        template = PageTemplate(
            id="report",
            frames=[frame],
            onPage=lambda canvas_obj, doc_obj: _draw_header_footer(canvas_obj, doc_obj, meta),
        )
        self.addPageTemplates([template])


def _build_styles() -> dict:
    styles = getSampleStyleSheet()
    normal_style = styles["Normal"]
    normal_style.fontName = "Helvetica"
    normal_style.fontSize = 10.5
    normal_style.leading = 14
    normal_style.textColor = TEXT_COLOR
    normal_style.wordWrap = "CJK"
    styles.add(
        ParagraphStyle(
            name="RptTitle",
            fontName="Helvetica-Bold",
            fontSize=18,
            leading=22,
            textColor=TEXT_COLOR,
        )
    )
    styles.add(
        ParagraphStyle(
            name="RptH2",
            fontName="Helvetica-Bold",
            fontSize=14,
            leading=18,
            textColor=TEXT_COLOR,
            spaceAfter=4,
        )
    )
    styles.add(
        ParagraphStyle(
            name="RptBody",
            fontName="Helvetica",
            fontSize=10.5,
            leading=14,
            textColor=TEXT_COLOR,
            wordWrap="CJK",
        )
    )
    styles.add(
        ParagraphStyle(
            name="RptMeta",
            fontName="Helvetica",
            fontSize=8.5,
            leading=11,
            textColor=TEXT_MUTED,
        )
    )
    styles.add(
        ParagraphStyle(
            name="KpiLabel",
            fontName="Helvetica",
            fontSize=9,
            leading=11,
            textColor=TEXT_MUTED,
        )
    )
    styles.add(
        ParagraphStyle(
            name="KpiValue",
            fontName="Helvetica-Bold",
            fontSize=13,
            leading=16,
            textColor=TEXT_COLOR,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Badge",
            fontName="Helvetica-Bold",
            fontSize=8.5,
            leading=10,
            textColor=TEXT_COLOR,
        )
    )
    styles.add(
        ParagraphStyle(
            name="TableCell",
            fontName="Helvetica",
            fontSize=9.5,
            leading=12,
            textColor=TEXT_COLOR,
            wordWrap="CJK",
        )
    )
    styles.add(
        ParagraphStyle(
            name="TableCellRight",
            fontName="Helvetica",
            fontSize=9.5,
            leading=12,
            textColor=TEXT_COLOR,
            alignment=2,
            wordWrap="CJK",
        )
    )
    styles.add(
        ParagraphStyle(
            name="TableCellWrap",
            fontName="Helvetica",
            fontSize=9.2,
            leading=12,
            textColor=TEXT_COLOR,
            wordWrap="CJK",
        )
    )
    styles.add(
        ParagraphStyle(
            name="TableCellSmall",
            parent=styles["TableCell"],
            fontSize=8.6,
            leading=10.5,
        )
    )
    styles.add(
        ParagraphStyle(
            name="TableCellRightSmall",
            parent=styles["TableCellRight"],
            fontSize=8.6,
            leading=10.5,
        )
    )
    styles.add(
        ParagraphStyle(
            name="TableCellWrapSmall",
            parent=styles["TableCellWrap"],
            fontSize=8.6,
            leading=10.5,
        )
    )
    return styles


def _kpi_card(
    doc: BaseDocTemplate,
    styles: dict,
    label: str,
    value: str,
    accent: colors.Color,
    value_color: colors.Color | None = None,
) -> Table:
    card_width = (doc.width / 2) - 8
    value_style = ParagraphStyle(None, parent=styles["KpiValue"], textColor=value_color or TEXT_COLOR)
    content = [
        Paragraph(safe_text(label), styles["KpiLabel"]),
        Paragraph(safe_text(value), value_style),
    ]
    card = Table(
        [["", content]],
        colWidths=[4, card_width - 4],
        repeatRows=1,
        splitByRow=1,
        hAlign="LEFT",
    )
    card.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), CARD_BG),
                ("BACKGROUND", (0, 0), (0, 0), accent),
                ("BOX", (0, 0), (-1, -1), 0.6, LINE_COLOR),
                ("LEFTPADDING", (0, 0), (0, 0), 0),
                ("RIGHTPADDING", (0, 0), (0, 0), 0),
                ("LEFTPADDING", (1, 0), (1, 0), 8),
                ("RIGHTPADDING", (1, 0), (1, 0), 8),
                ("TOPPADDING", (1, 0), (1, 0), 6),
                ("BOTTOMPADDING", (1, 0), (1, 0), 6),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]
        )
    )
    return card


def _build_observations(payload: dict, max_items: int = 6) -> list[str]:
    notes: list[str] = []
    summary = payload.get("summary", {})
    net_value = float(summary.get("net") or 0.0)
    notes.append(f"Resultado liquido de {_fmt_brl(net_value)} no periodo.")

    category_rows = payload.get("categories", {}).get("rows") or []
    has_category_note = False
    if category_rows:
        top = category_rows[0]
        pct = top.get("percent")
        pct_text = f"{pct}%" if pct is not None else "-"
        notes.append(f"Despesas concentradas em {top.get('label')} ({pct_text}).")
        has_category_note = True

    pending_total = payload.get("pending", {}).get("total") or 0
    if pending_total:
        impact = payload.get("pending", {}).get("impact")
        notes.append(f"Pendencias impactam saldo em {_fmt_brl(impact)}.")

    alerts = payload.get("health", {}).get("alerts") or []
    for alert in alerts:
        if not alert:
            continue
        text = str(alert)
        lower = text.lower()
        if "resultado liquido" in lower:
            continue
        if has_category_note and "categoria" in lower and "concentra" in lower:
            continue
        notes.append(text)

    deduped: list[str] = []
    seen: set[str] = set()
    for item in notes:
        normalized = " ".join(str(item).lower().split())
        if normalized in seen:
            continue
        seen.add(normalized)
        deduped.append(str(item))
        if len(deduped) >= max_items:
            break

    if not deduped:
        deduped.append("Sem observacoes relevantes no periodo.")

    return deduped


def render_reports_pdf(payload: dict, sections: set[str], detail: str, meta: dict) -> bytes:
    return _render_reports_pdf_v2(payload, sections, detail, meta)

def _render_reports_pdf_v2(payload: dict, sections: set[str], detail: str, meta: dict) -> bytes:
    buffer = io.BytesIO()

    logo_reader = None
    logo_path = meta.get("logo_path")
    if logo_path and os.path.exists(logo_path):
        try:
            logo_reader = ImageReader(logo_path)
        except Exception:
            logo_reader = None

    meta = dict(meta)
    meta["logo_reader"] = logo_reader

    doc = ReportDoc(buffer, meta)
    styles = _build_styles()
    detail = (detail or "resumido").strip().lower()
    if detail not in {"resumido", "detalhado"}:
        detail = "resumido"
    is_resumido = detail == "resumido"
    desc_limit = FLOW_DESC_LIMIT_RESUMIDO if is_resumido else FLOW_DESC_LIMIT_DETALHADO
    obs_limit = OBS_MAX_RESUMIDO if is_resumido else OBS_MAX_DETALHADO

    def add_section_gap(story: list):
        if story:
            story.append(Spacer(1, 12))

    def section_header(title: str, subtitle: str) -> KeepTogether:
        return KeepTogether(
            [
                Paragraph(safe_text(title), styles["RptH2"]),
                Paragraph(safe_text(subtitle), styles["RptMeta"]),
            ]
        )

    story: list = []
    ordered_sections = [key for key in ["summary", "dre", "flow", "categories", "recurring", "pending"] if key in sections]
    if not ordered_sections:
        ordered_sections = ["summary", "dre", "flow"]

    if "summary" in ordered_sections:
        add_section_gap(story)
        story.append(section_header("Resumo executivo", "Indicadores gerenciais do periodo selecionado."))

        summary = payload.get("summary", {})
        net_value = float(summary.get("net") or 0.0)
        economy_pct = float(summary.get("economy_pct") or 0.0)
        economy_label = "% economia" if net_value >= 0 else "% deficit"
        economy_value = economy_pct if net_value >= 0 else abs(economy_pct)

        badge_text = "Resultado positivo" if net_value >= 0 else "Resultado negativo"
        badge_color = GREEN if net_value >= 0 else RED
        badge_bg = colors.HexColor("#EAF6EF") if net_value >= 0 else colors.HexColor("#FDECEA")
        badge_style = ParagraphStyle(None, parent=styles["Badge"], textColor=badge_color)
        badge = Table(
            [[Paragraph(safe_text(badge_text), badge_style)]],
            repeatRows=1,
            splitByRow=1,
            hAlign="LEFT",
        )
        badge.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), badge_bg),
                    ("BOX", (0, 0), (-1, -1), 0.6, LINE_COLOR),
                    ("LEFTPADDING", (0, 0), (-1, -1), 8),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                    ("TOPPADDING", (0, 0), (-1, -1), 3),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                ]
            )
        )
        story.append(Spacer(1, 6))
        story.append(badge)
        story.append(Spacer(1, 8))

        card_income = _kpi_card(doc, styles, "Total receitas", _fmt_brl(summary.get("income")), GREEN)
        card_expense = _kpi_card(doc, styles, "Total despesas", _fmt_brl(summary.get("expense")), RED)
        net_color = GREEN if net_value >= 0 else RED if net_value < 0 else TEXT_COLOR
        card_net = _kpi_card(doc, styles, "Resultado liquido", _fmt_brl(net_value), net_color, net_color)
        economy_color = GREEN if net_value >= 0 else RED
        card_economy = _kpi_card(doc, styles, economy_label, _fmt_percent(economy_value), economy_color, economy_color)

        kpi_grid = Table(
            [[card_income, card_expense], [card_net, card_economy]],
            colWidths=[doc.width / 2, doc.width / 2],
            repeatRows=1,
            splitByRow=1,
            hAlign="LEFT",
        )
        kpi_grid.setStyle(
            TableStyle(
                [
                    ("LEFTPADDING", (0, 0), (-1, -1), 4),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ]
            )
        )
        story.append(kpi_grid)
        story.append(Spacer(1, 10))

        observations = _build_observations(payload, max_items=obs_limit)
        story.append(Paragraph(safe_text("Observacoes do periodo"), styles["RptBody"]))
        for item in observations:
            story.append(Paragraph(f"\u2022 {safe_text(item)}", styles["Normal"]))

    def cell(text: str, right: bool = False, wrap: bool = False, small: bool = False) -> Paragraph:
        if wrap:
            style_name = "TableCellWrapSmall" if small else "TableCellWrap"
            return Paragraph(safe_text(text), styles[style_name])
        if right:
            style_name = "TableCellRightSmall" if small else "TableCellRight"
        else:
            style_name = "TableCellSmall" if small else "TableCell"
        return Paragraph(safe_text(text), styles[style_name])

    def make_table(rows: list[list], col_widths: list[float], right_cols: set[int] | None = None) -> Table:
        table = Table(rows, colWidths=col_widths, repeatRows=1, splitByRow=1, hAlign="LEFT")
        style_cmds = [
            ("BACKGROUND", (0, 0), (-1, 0), LIGHT_GRAY),
            ("TEXTCOLOR", (0, 0), (-1, 0), TEXT_COLOR),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, 0), 9),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("GRID", (0, 0), (-1, -1), 0.4, LINE_COLOR),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#FAFBFC")]),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]
        if right_cols:
            for col_idx in right_cols:
                style_cmds.append(("ALIGN", (col_idx, 0), (col_idx, -1), "RIGHT"))
        table.setStyle(TableStyle(style_cmds))
        return table

    if "dre" in ordered_sections:
        add_section_gap(story)
        story.append(section_header("DRE", "Demonstrativo por categoria."))
        dre_rows = payload.get("dre", {}).get("rows") or []
        dre_total = payload.get("dre", {}).get("total") or {}
        if not dre_rows:
            story.append(Paragraph(safe_text("Sem dados no periodo."), styles["RptBody"]))
        else:
            rows = [
                [
                    cell("Categoria"),
                    cell("Receitas", right=True),
                    cell("Despesas", right=True),
                    cell("Resultado", right=True),
                ]
            ]
            extra_styles = []
            for row in dre_rows:
                net = row.get("net")
                rows.append(
                    [
                        cell(str(row.get("label") or "-")),
                        cell(_fmt_brl(row.get("income")), right=True),
                        cell(_fmt_brl(row.get("expense")), right=True),
                        cell(_fmt_brl(net), right=True),
                    ]
                )
                row_idx = len(rows) - 1
                if net is not None:
                    color = GREEN if net > 0 else RED if net < 0 else TEXT_COLOR
                    extra_styles.append(("TEXTCOLOR", (3, row_idx), (3, row_idx), color))

            if dre_total:
                rows.append(
                    [
                        cell("Resultado total"),
                        cell(_fmt_brl(dre_total.get("income")), right=True),
                        cell(_fmt_brl(dre_total.get("expense")), right=True),
                        cell(_fmt_brl(dre_total.get("net")), right=True),
                    ]
                )
                total_idx = len(rows) - 1
                extra_styles.extend(
                    [
                        ("BACKGROUND", (0, total_idx), (-1, total_idx), LIGHT_GRAY),
                        ("FONTNAME", (0, total_idx), (-1, total_idx), "Helvetica-Bold"),
                        ("LINEABOVE", (0, total_idx), (-1, total_idx), 0.8, LINE_COLOR),
                    ]
                )
                net_total = dre_total.get("net")
                if net_total is not None:
                    color = GREEN if net_total > 0 else RED if net_total < 0 else TEXT_COLOR
                    extra_styles.append(("TEXTCOLOR", (3, total_idx), (3, total_idx), color))

            table = make_table(
                rows,
                [doc.width * 0.46, doc.width * 0.18, doc.width * 0.18, doc.width * 0.18],
                right_cols={1, 2, 3},
            )
            if extra_styles:
                table.setStyle(TableStyle(extra_styles))
            story.append(table)

    if "flow" in ordered_sections:
        add_section_gap(story)
        suffix = " (resumido)" if detail == "resumido" else ""
        flow_subtitle = "Resumo diario do fluxo de caixa." if is_resumido else "Movimentacoes cronologicas com saldo acumulado."
        story.append(section_header(f"Fluxo de caixa{suffix}", flow_subtitle))
        flow_rows = payload.get("flow", {}).get("rows") or []
        final_balance = payload.get("flow", {}).get("final_balance")
        if not flow_rows:
            story.append(Paragraph(safe_text("Sem dados no periodo."), styles["RptBody"]))
        else:
            if is_resumido:
                headers = ["Data", "Entradas", "Saidas", "Saldo"]
                rows = [[cell(label, right=label != "Data") for label in headers]]
                extra_styles = []
                balance_idx = 3
                for row in flow_rows:
                    balance = row.get("balance")
                    rows.append(
                        [
                            cell(_fmt_date(row.get("date"))),
                            cell(_fmt_brl(row.get("income")) if row.get("income") else "-", right=True),
                            cell(_fmt_brl(row.get("expense")) if row.get("expense") else "-", right=True),
                            cell(_fmt_brl(balance), right=True),
                        ]
                    )
                    row_idx = len(rows) - 1
                    if balance is not None and balance < 0:
                        extra_styles.append(("TEXTCOLOR", (balance_idx, row_idx), (balance_idx, row_idx), RED))

                if final_balance is not None:
                    rows.append(
                        [
                            cell("Saldo final"),
                            cell(""),
                            cell(""),
                            cell(_fmt_brl(final_balance), right=True),
                        ]
                    )
                    total_idx = len(rows) - 1
                    extra_styles.extend(
                        [
                            ("BACKGROUND", (0, total_idx), (-1, total_idx), LIGHT_GRAY),
                            ("FONTNAME", (0, total_idx), (-1, total_idx), "Helvetica-Bold"),
                            ("LINEABOVE", (0, total_idx), (-1, total_idx), 0.8, LINE_COLOR),
                        ]
                    )
                    if final_balance < 0:
                        extra_styles.append(("TEXTCOLOR", (balance_idx, total_idx), (balance_idx, total_idx), RED))

                table = make_table(
                    rows,
                    [doc.width * 0.22, doc.width * 0.26, doc.width * 0.26, doc.width * 0.26],
                    right_cols={1, 2, 3},
                )
            else:
                headers = ["Data", "Descricao", "Categoria", "Metodo", "Status", "Entrada", "Saida", "Saldo"]
                small_flow = True
                rows = [
                    [cell(label, right=label in {"Entrada", "Saida", "Saldo"}, small=small_flow) for label in headers]
                ]
                extra_styles = []
                balance_idx = len(headers) - 1
                for row in flow_rows:
                    balance = row.get("balance")
                    desc = _truncate(str(row.get("description") or "-"), desc_limit)
                    rows.append(
                        [
                            cell(_fmt_date(row.get("date")), small=small_flow),
                            cell(desc, wrap=True, small=small_flow),
                            cell(str(row.get("category") or "-"), small=small_flow),
                            cell(str(row.get("method") or "-"), small=small_flow),
                            cell(str(row.get("status") or "-"), small=small_flow),
                            cell(_fmt_brl(row.get("income")) if row.get("income") else "-", right=True, small=small_flow),
                            cell(_fmt_brl(row.get("expense")) if row.get("expense") else "-", right=True, small=small_flow),
                            cell(_fmt_brl(balance), right=True, small=small_flow),
                        ]
                    )
                    row_idx = len(rows) - 1
                    if balance is not None and balance < 0:
                        extra_styles.append(("TEXTCOLOR", (balance_idx, row_idx), (balance_idx, row_idx), RED))

                if final_balance is not None:
                    total_cols = len(headers)
                    rows.append(
                        [cell("Saldo final", small=small_flow)]
                        + [cell("", small=small_flow) for _ in range(total_cols - 2)]
                        + [cell(_fmt_brl(final_balance), right=True, small=small_flow)]
                    )
                    total_idx = len(rows) - 1
                    extra_styles.extend(
                        [
                            ("BACKGROUND", (0, total_idx), (-1, total_idx), LIGHT_GRAY),
                            ("FONTNAME", (0, total_idx), (-1, total_idx), "Helvetica-Bold"),
                            ("LINEABOVE", (0, total_idx), (-1, total_idx), 0.8, LINE_COLOR),
                        ]
                    )
                    if final_balance < 0:
                        extra_styles.append(("TEXTCOLOR", (balance_idx, total_idx), (balance_idx, total_idx), RED))

                table = make_table(
                    rows,
                    [
                        doc.width * 0.1,
                        doc.width * 0.27,
                        doc.width * 0.13,
                        doc.width * 0.1,
                        doc.width * 0.1,
                        doc.width * 0.1,
                        doc.width * 0.1,
                        doc.width * 0.1,
                    ],
                    right_cols={5, 6, 7},
                )

            if extra_styles:
                table.setStyle(TableStyle(extra_styles))
            story.append(table)

    if "categories" in ordered_sections:
        add_section_gap(story)
        story.append(section_header("Categorias", "Distribuicao percentual das despesas."))
        category_rows = payload.get("categories", {}).get("rows") or []
        if not category_rows:
            story.append(Paragraph(safe_text("Sem dados no periodo."), styles["RptBody"]))
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
            table = make_table(
                rows,
                [doc.width * 0.46, doc.width * 0.2, doc.width * 0.17, doc.width * 0.17],
                right_cols={1, 2, 3},
            )
            story.append(table)

    if "recurring" in ordered_sections:
        add_section_gap(story)
        story.append(section_header("Recorrencias", "Receitas recorrentes detectadas."))
        recurring = payload.get("recurring", {})
        recurring_items = recurring.get("items") or []
        recurring_summary = recurring.get("summary") or {}
        if is_resumido:
            count = recurring_summary.get("count", len(recurring_items))
            monthly_estimate = recurring_summary.get("monthly_estimate")
            if not count:
                story.append(Paragraph(safe_text("Sem recorrencias no periodo."), styles["RptBody"]))
            else:
                estimate_text = _fmt_brl(monthly_estimate) if monthly_estimate is not None else "R$ -"
                summary_text = f"Recorrencias detectadas: {count} | Estimativa mensal: {estimate_text}"
                story.append(Paragraph(safe_text(summary_text), styles["RptBody"]))
        else:
            if not recurring_items:
                story.append(Paragraph(safe_text("Sem recorrencias no periodo."), styles["RptBody"]))
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
                table = make_table(
                    rows,
                    [doc.width * 0.46, doc.width * 0.2, doc.width * 0.17, doc.width * 0.17],
                    right_cols={2, 3},
                )
                story.append(table)

    if "pending" in ordered_sections:
        add_section_gap(story)
        story.append(section_header("Pendencias", "Despesas nao pagas no periodo."))
        pending_items = payload.get("pending", {}).get("items") or []
        if not pending_items:
            story.append(Paragraph(safe_text("Sem pendencias no periodo."), styles["RptBody"]))
        else:
            if is_resumido:
                rows = [
                    [
                        cell("Vencimento"),
                        cell("Descricao"),
                        cell("Valor", right=True),
                        cell("Dias atraso", right=True),
                    ]
                ]
                for item in pending_items:
                    rows.append(
                        [
                            cell(_fmt_date(item.get("date"))),
                            cell(str(item.get("description") or "-"), wrap=True),
                            cell(_fmt_brl(item.get("value")), right=True),
                            cell(str(item.get("days_overdue") or 0), right=True),
                        ]
                    )
                table = make_table(
                    rows,
                    [doc.width * 0.22, doc.width * 0.43, doc.width * 0.18, doc.width * 0.17],
                    right_cols={2, 3},
                )
                story.append(table)
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
                            cell(str(item.get("description") or "-"), wrap=True),
                            cell(str(item.get("category") or "-")),
                            cell(_fmt_brl(item.get("value")), right=True),
                            cell(str(item.get("days_overdue") or 0), right=True),
                        ]
                    )
                table = make_table(
                    rows,
                    [doc.width * 0.18, doc.width * 0.32, doc.width * 0.2, doc.width * 0.15, doc.width * 0.15],
                    right_cols={3, 4},
                )
                story.append(table)

    doc.build(story, canvasmaker=lambda *args, **kwargs: NumberedCanvas(*args, report_doc=doc, **kwargs))
    buffer.seek(0)
    return buffer.getvalue()
