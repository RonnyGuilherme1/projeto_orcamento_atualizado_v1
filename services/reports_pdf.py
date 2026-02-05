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
from reportlab.graphics.charts.barcharts import VerticalBarChart
from reportlab.graphics.charts.lineplots import LinePlot
from reportlab.graphics.shapes import Drawing, String
from reportlab.graphics.widgets.markers import makeMarker
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
YELLOW = colors.HexColor("#D97706")
NEUTRAL = colors.HexColor("#94A3B8")
NBSP = "\u00A0"

FLOW_DESC_LIMIT_RESUMIDO = 50
FLOW_DESC_LIMIT_DETALHADO = 120
OBS_MAX_RESUMIDO = 4
OBS_MAX_DETALHADO = 8


def _fmt_brl(value: float | int | None) -> str:
    try:
        num = float(value)
    except (TypeError, ValueError):
        return f"R${NBSP}-"
    return f"R${NBSP}{num:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


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
    normal_style.wordWrap = "normal"
    normal_style.splitLongWords = 0
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
            wordWrap="normal",
            splitLongWords=0,
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
            wordWrap="normal",
            splitLongWords=0,
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
            wordWrap="normal",
            splitLongWords=0,
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
            splitLongWords=1,
        )
    )
    styles.add(
        ParagraphStyle(
            name="CardTitle",
            fontName="Helvetica-Bold",
            fontSize=10,
            leading=12,
            textColor=TEXT_MUTED,
            spaceAfter=2,
        )
    )
    styles.add(
        ParagraphStyle(
            name="CardValue",
            fontName="Helvetica-Bold",
            fontSize=12.5,
            leading=15,
            textColor=TEXT_COLOR,
        )
    )
    styles.add(
        ParagraphStyle(
            name="CardMeta",
            fontName="Helvetica",
            fontSize=9,
            leading=12,
            textColor=TEXT_COLOR,
        )
    )
    styles.add(
        ParagraphStyle(
            name="CardMetaMuted",
            fontName="Helvetica",
            fontSize=8.5,
            leading=11,
            textColor=TEXT_MUTED,
        )
    )
    styles.add(
        ParagraphStyle(
            name="ChartTitle",
            fontName="Helvetica-Bold",
            fontSize=10,
            leading=12,
            textColor=TEXT_COLOR,
        )
    )
    styles.add(
        ParagraphStyle(
            name="ChartMeta",
            fontName="Helvetica",
            fontSize=8.5,
            leading=11,
            textColor=TEXT_MUTED,
        )
    )
    styles.add(
        ParagraphStyle(
            name="ChartEmpty",
            fontName="Helvetica",
            fontSize=9,
            leading=11,
            textColor=TEXT_MUTED,
            alignment=1,
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


def _fmt_signed_pct(value: float | int | None) -> str:
    try:
        num = float(value)
    except (TypeError, ValueError):
        return "Sem base"
    sign = "+" if num > 0 else ""
    return f"{sign}{num:.1f}%"


def _health_score(ratio: float | int | None) -> int | None:
    try:
        num = float(ratio)
    except (TypeError, ValueError):
        return None
    if num <= 60:
        return 92
    if num <= 70:
        return 85
    if num <= 80:
        return 75
    if num <= 90:
        return 60
    if num <= 100:
        return 45
    return 30


def _health_status_color(status: str | None) -> colors.Color:
    status_key = (status or "").strip().lower()
    if status_key in {"equilibrio", "equilíbrio"}:
        return GREEN
    if status_key in {"atencao", "atenção"}:
        return YELLOW
    if status_key in {"critico", "crítico"}:
        return RED
    return NEUTRAL


def _health_insights(alerts: list | None, max_items: int = 2) -> list[str]:
    items: list[str] = []
    for alert in alerts or []:
        text = str(alert).strip()
        if not text:
            continue
        items.append(_truncate(text, 78))
        if len(items) >= max_items:
            break
    while len(items) < max_items:
        items.append("Sem alertas relevantes." if not items else "Sem outros alertas.")
    return items


def _badge(text: str, text_color: colors.Color, bg_color: colors.Color, styles: dict) -> Table:
    badge_style = ParagraphStyle(None, parent=styles["Badge"], textColor=text_color)
    badge = Table([[Paragraph(safe_text(text), badge_style)]], repeatRows=1, splitByRow=1, hAlign="LEFT")
    badge.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), bg_color),
                ("BOX", (0, 0), (-1, -1), 0.6, LINE_COLOR),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 2),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
            ]
        )
    )
    return badge


def _report_card(
    doc: BaseDocTemplate,
    styles: dict,
    title: str,
    body: list,
    accent: colors.Color = NEUTRAL,
) -> Table:
    card_width = (doc.width / 2) - 8
    content = [Paragraph(safe_text(title), styles["CardTitle"])]
    content.extend(body)
    card = Table([["", content]], colWidths=[4, card_width - 4], repeatRows=1, splitByRow=1, hAlign="LEFT")
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


def _chart_panel(doc: BaseDocTemplate, styles: dict, title: str, subtitle: str | None, drawing: Drawing) -> Table:
    header = [Paragraph(safe_text(title), styles["ChartTitle"])]
    if subtitle:
        header.append(Paragraph(safe_text(subtitle), styles["ChartMeta"]))
    panel = Table([[header], [drawing]], colWidths=[doc.width], repeatRows=1, splitByRow=1, hAlign="LEFT")
    panel.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.white),
                ("BOX", (0, 0), (-1, -1), 0.6, LINE_COLOR),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    return panel


def _chart_placeholder(width: float, height: float, message: str) -> Drawing:
    drawing = Drawing(width, height)
    drawing.add(
        String(
            width / 2,
            height / 2,
            message,
            fontName="Helvetica",
            fontSize=9,
            fillColor=TEXT_MUTED,
            textAnchor="middle",
        )
    )
    return drawing


def _short_label(text: str, limit: int = 12) -> str:
    raw = str(text or "")
    if len(raw) <= limit:
        return raw
    return f"{raw[: max(0, limit - 3)]}..."


def _build_categories_chart(payload: dict, width: float, height: float, limit: int) -> Drawing:
    rows = payload.get("categories", {}).get("rows") or []
    if not rows:
        return _chart_placeholder(width, height, "Sem dados de categorias.")

    top_rows = rows[:limit]
    values = [float(row.get("total") or 0.0) for row in top_rows]
    if not any(values):
        return _chart_placeholder(width, height, "Sem dados de categorias.")

    labels = [_short_label(row.get("label") or "-") for row in top_rows]
    max_val = max(values) if values else 1
    value_max = max(1, max_val * 1.15)
    value_step = max(1, value_max / 4)

    drawing = Drawing(width, height)
    chart = VerticalBarChart()
    chart.x = 30
    chart.y = 18
    chart.width = width - 38
    chart.height = height - 26
    chart.data = [values]
    chart.categoryAxis.categoryNames = labels
    chart.bars[0].fillColor = GREEN
    chart.valueAxis.valueMin = 0
    chart.valueAxis.valueMax = value_max
    chart.valueAxis.valueStep = value_step
    chart.valueAxis.labels.fontName = "Helvetica"
    chart.valueAxis.labels.fontSize = 7
    chart.categoryAxis.labels.fontName = "Helvetica"
    chart.categoryAxis.labels.fontSize = 7
    chart.categoryAxis.labels.boxAnchor = "n"
    drawing.add(chart)
    return drawing


def _extract_balance_series(flow_rows: list[dict]) -> list[tuple[str, float]]:
    by_date: dict[str, float] = {}
    for row in flow_rows or []:
        date_str = row.get("date")
        balance = row.get("balance")
        if not date_str or balance is None:
            continue
        try:
            by_date[str(date_str)] = float(balance)
        except (TypeError, ValueError):
            continue
    series = [(date_str, by_date[date_str]) for date_str in sorted(by_date.keys())]
    return series


def _build_balance_chart(payload: dict, width: float, height: float) -> Drawing:
    flow_rows = payload.get("flow", {}).get("rows") or []
    series = _extract_balance_series(flow_rows)
    if not series:
        return _chart_placeholder(width, height, "Sem dados de saldo.")

    points = [(idx, value) for idx, (_, value) in enumerate(series)]
    max_idx = max(1, len(points) - 1)
    min_val = min(value for _, value in series)
    max_val = max(value for _, value in series)
    y_min = min(0, min_val)
    y_max = max_val if max_val != y_min else y_min + 1
    y_step = (y_max - y_min) / 4 if y_max != y_min else 1

    drawing = Drawing(width, height)
    chart = LinePlot()
    chart.x = 30
    chart.y = 18
    chart.width = width - 38
    chart.height = height - 26
    chart.data = [points]
    chart.lines[0].strokeColor = GREEN
    chart.lines[0].strokeWidth = 1.6
    chart.lines[0].symbol = makeMarker("Circle")
    chart.lines[0].symbol.size = 3
    chart.xValueAxis.valueMin = 0
    chart.xValueAxis.valueMax = max_idx
    chart.yValueAxis.valueMin = y_min
    chart.yValueAxis.valueMax = y_max
    chart.yValueAxis.valueStep = y_step
    chart.yValueAxis.labels.fontName = "Helvetica"
    chart.yValueAxis.labels.fontSize = 7
    drawing.add(chart)

    label_indices = {0, len(series) // 2, len(series) - 1}
    for idx in sorted(label_indices):
        date_label = _fmt_date(series[idx][0])
        x_pos = chart.x + (idx / max_idx) * chart.width if max_idx else chart.x
        drawing.add(
            String(
                x_pos,
                4,
                date_label,
                fontName="Helvetica",
                fontSize=7,
                fillColor=TEXT_MUTED,
                textAnchor="middle",
            )
        )
    return drawing


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
        comparison = payload.get("comparison", {})
        health = payload.get("health", {})
        pending = payload.get("pending", {})

        net_value = float(summary.get("net") or 0.0)
        net_color = GREEN if net_value >= 0 else RED
        badge_text = "Resultado positivo" if net_value >= 0 else "Resultado negativo"
        badge_bg = colors.HexColor("#EAF6EF") if net_value >= 0 else colors.HexColor("#FDECEA")
        badge = _badge(badge_text, net_color, badge_bg, styles)

        card_1_body = [
            Paragraph(safe_text(f"Receitas: {_fmt_brl(summary.get('income'))}"), styles["CardMeta"]),
            Paragraph(safe_text(f"Despesas: {_fmt_brl(summary.get('expense'))}"), styles["CardMeta"]),
            Paragraph(
                safe_text(f"Resultado liquido: {_fmt_brl(net_value)}"),
                ParagraphStyle(None, parent=styles["CardValue"], textColor=net_color),
            ),
            badge,
        ]
        card_1 = _report_card(doc, styles, "Resultado do periodo", card_1_body, accent=net_color)

        prev_text = _fmt_signed_pct(comparison.get("prev_pct"))
        avg_text = _fmt_signed_pct(comparison.get("avg_pct"))
        comparison_note = (comparison.get("note") or "").strip()
        card_2_body = [
            Paragraph(safe_text(f"Vs periodo anterior: {prev_text}"), styles["CardMeta"]),
            Paragraph(safe_text(f"Vs media 3 periodos: {avg_text}"), styles["CardMeta"]),
        ]
        if comparison_note:
            card_2_body.append(Paragraph(safe_text(comparison_note), styles["CardMetaMuted"]))
        card_2 = _report_card(doc, styles, "Comparativo", card_2_body, accent=NEUTRAL)

        ratio = health.get("ratio")
        status_label = str(health.get("status") or "-")
        status_color = _health_status_color(status_label)
        score = _health_score(ratio)
        ratio_text = f"Despesas/Receitas: {ratio:.1f}%" if ratio is not None else "Despesas/Receitas: -"
        score_text = f"Indice: {score}/100" if score is not None else "Indice: -"
        insights = _health_insights(health.get("alerts"))

        card_3_body = [
            Paragraph(
                safe_text(score_text),
                ParagraphStyle(None, parent=styles["CardValue"], textColor=status_color),
            ),
            Paragraph(
                safe_text(f"Status: {status_label}"),
                ParagraphStyle(None, parent=styles["CardMeta"], textColor=status_color),
            ),
            Paragraph(safe_text(ratio_text), styles["CardMetaMuted"]),
            Paragraph(safe_text(insights[0]), styles["CardMetaMuted"]),
            Paragraph(safe_text(insights[1]), styles["CardMetaMuted"]),
        ]
        card_3 = _report_card(doc, styles, "Saude financeira", card_3_body, accent=status_color)

        pending_count = int(pending.get("count") or 0)
        pending_total = pending.get("total") or 0.0
        pending_impact = pending.get("impact") or 0.0
        overdue = int(pending.get("overdue") or 0)
        due_7 = int(pending.get("due_7") or 0)
        card_4_body = [
            Paragraph(safe_text(f"Contas pendentes: {pending_count}"), styles["CardMeta"]),
            Paragraph(safe_text(f"Total pendente: {_fmt_brl(pending_total)}"), styles["CardMeta"]),
            Paragraph(
                safe_text(f"Saldo se pagar tudo hoje: {_fmt_brl(pending_impact)}"),
                styles["CardValue"],
            ),
            Paragraph(
                safe_text(f"Vencidas: {overdue} | Prox. 7 dias: {due_7}"),
                styles["CardMetaMuted"],
            ),
        ]
        card_4 = _report_card(doc, styles, "Pendencias e impacto", card_4_body, accent=NEUTRAL)

        card_grid = Table(
            [[card_1, card_2], [card_3, card_4]],
            colWidths=[doc.width / 2, doc.width / 2],
            repeatRows=1,
            splitByRow=1,
            hAlign="LEFT",
        )
        card_grid.setStyle(
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
        story.append(card_grid)

        story.append(Spacer(1, 10))
        chart_width = doc.width - 16
        chart_height = 145
        if is_resumido:
            categories_chart = _build_categories_chart(payload, chart_width, chart_height, limit=5)
            story.append(
                _chart_panel(
                    doc,
                    styles,
                    "Top categorias de despesas",
                    "Resumo das principais categorias do periodo.",
                    categories_chart,
                )
            )
        else:
            categories_chart = _build_categories_chart(payload, chart_width, chart_height, limit=8)
            story.append(
                _chart_panel(
                    doc,
                    styles,
                    "Top categorias de despesas",
                    "Distribuicao das categorias mais relevantes.",
                    categories_chart,
                )
            )
            story.append(Spacer(1, 8))
            balance_chart = _build_balance_chart(payload, chart_width, chart_height)
            story.append(
                _chart_panel(
                    doc,
                    styles,
                    "Saldo acumulado diario",
                    "Evolucao do saldo ao longo do periodo.",
                    balance_chart,
                )
            )

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
                        doc.width * 0.12,
                        doc.width * 0.26,
                        doc.width * 0.13,
                        doc.width * 0.1,
                        doc.width * 0.1,
                        doc.width * 0.095,
                        doc.width * 0.095,
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
