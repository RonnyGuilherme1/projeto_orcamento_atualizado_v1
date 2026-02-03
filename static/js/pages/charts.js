(function () {
  const page = document.querySelector(".charts-page");
  if (!page) return;

  const periodTabs = document.getElementById("period-tabs");
  const periodPanels = document.querySelectorAll("[data-period-panel]");

  const yearSelect = document.getElementById("chart-year");
  const monthSelect = document.getElementById("chart-month");
  const yearQuarterSelect = document.getElementById("chart-year-quarter");
  const quarterSelect = document.getElementById("chart-quarter");
  const startInput = document.getElementById("chart-start");
  const endInput = document.getElementById("chart-end");

  const compareToggle = document.getElementById("compare-toggle");
  const compareLabel = document.getElementById("compare-label");

  const exportTrigger = document.getElementById("export-trigger");
  const exportMenu = document.getElementById("export-menu");
  const exportDropdown = exportMenu ? exportMenu.closest(".export-dropdown") : null;
  const insightCreateRule = document.getElementById("insight-create-rule");

  const kpiIncomeValue = document.getElementById("kpi-income-value");
  const kpiIncomeDelta = document.getElementById("kpi-income-delta");
  const kpiIncomeChip = document.getElementById("kpi-income-chip");
  const kpiExpenseValue = document.getElementById("kpi-expense-value");
  const kpiExpenseDelta = document.getElementById("kpi-expense-delta");
  const kpiExpenseChip = document.getElementById("kpi-expense-chip");
  const kpiBalanceValue = document.getElementById("kpi-balance-value");
  const kpiBalanceDelta = document.getElementById("kpi-balance-delta");
  const kpiBalanceChip = document.getElementById("kpi-balance-chip");
  const kpiEntriesValue = document.getElementById("kpi-entries-value");
  const kpiEntriesDelta = document.getElementById("kpi-entries-delta");
  const kpiEntriesChip = document.getElementById("kpi-entries-chip");

  const chartPeriodLabel = document.getElementById("chart-period-label");

  const lineCanvas = document.getElementById("line-canvas");
  const lineSvg = document.getElementById("line-svg");
  const lineIncome = document.querySelector('[data-line="income"]');
  const lineExpense = document.querySelector('[data-line="expense"]');
  const lineBalance = document.querySelector('[data-line="balance"]');
  const areaIncome = document.querySelector('[data-area="income"]');
  const areaExpense = document.querySelector('[data-area="expense"]');
  const pointIncome = document.querySelector('[data-point="income"]');
  const pointExpense = document.querySelector('[data-point="expense"]');
  const pointBalance = document.querySelector('[data-point="balance"]');
  const refZero = document.querySelector('[data-ref="zero"]');
  const refGoal = document.querySelector('[data-ref="goal"]');
  const lineTooltip = document.getElementById("line-tooltip");
  const lineTooltipType = document.getElementById("line-tooltip-type");
  const lineTooltipValue = document.getElementById("line-tooltip-value");
  const lineTooltipDate = document.getElementById("line-tooltip-date");
  const lineGuide = document.getElementById("line-guide");
  const seriesToggle = document.getElementById("series-toggle");

  const goalLineInput = document.getElementById("goal-line-input");
  const goalLineToggle = document.getElementById("goal-line-toggle");

  const kpiBestPeriod = document.getElementById("kpi-best-period");
  const kpiBestPeriodLabel = document.getElementById("kpi-best-period-label");
  const kpiTopExpense = document.getElementById("kpi-top-expense");
  const kpiTopExpenseLabel = document.getElementById("kpi-top-expense-label");
  const kpiEquilibrio = document.getElementById("kpi-equilibrio");
  const kpiEquilibrioLabel = document.getElementById("kpi-equilibrio-label");

  const donut = document.getElementById("chart-donut");
  const donutLegend = document.getElementById("donut-legend");
  const donutTotal = document.getElementById("donut-total");
  const donutLabel = document.getElementById("donut-label");
  const donutSubtitle = document.getElementById("donut-subtitle");
  const donutCanvas = document.getElementById("donut-canvas");
  const donutTypeToggle = document.getElementById("donut-type-toggle");
  const donutTopToggle = document.getElementById("donut-top-toggle");

  const insightsAlerts = document.getElementById("insights-alerts");
  const insightsOpp = document.getElementById("insights-opportunities");
  const insightsPatterns = document.getElementById("insights-patterns");
  const refreshInsights = document.getElementById("refresh-insights");
  const exportInsights = document.getElementById("export-insights");

  const drilldownOverlay = document.getElementById("drilldown-overlay");
  const drilldownTitle = document.getElementById("drilldown-title");
  const drilldownPeriod = document.getElementById("drilldown-period");
  const drilldownTotal = document.getElementById("drilldown-total");
  const drilldownList = document.getElementById("drilldown-list");
  const drilldownEmpty = document.getElementById("drilldown-empty");
  const drilldownCTA = document.getElementById("drilldown-cta");
  const drilldownClose = document.getElementById("drilldown-close");
  const drilldownCloseBtn = document.getElementById("drilldown-close-btn");

  const toastStack = document.getElementById("toast-stack");

  const MONTHS = [
    "Janeiro",
    "Fevereiro",
    "Mar\u00e7o",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro"
  ];

  const CATEGORY_LABELS = {
    salario: "Sal\u00e1rio",
    extras: "Extras",
    moradia: "Moradia",
    mercado: "Mercado",
    transporte: "Transporte",
    servicos: "Servi\u00e7os",
    outros: "Outros"
  };

  const CATEGORY_COLORS = {
    moradia: "var(--cat-home)",
    mercado: "var(--cat-mkt)",
    transporte: "var(--cat-trans)",
    servicos: "var(--cat-serv)",
    salario: "var(--chart-income)",
    extras: "var(--chart-balance)",
    outros: "var(--cat-other)"
  };

  const FALLBACK_COLORS = [
    "#4caf50",
    "#6ed1ff",
    "#f5a623",
    "#ff8c9d",
    "#9ee49f",
    "#6cb2ff",
    "#b39ddb",
    "#f06292",
    "#81c784",
    "#ffd54f"
  ];

  const state = {
    period: "month",
    compare: true,
    series: {
      income: true,
      expense: true,
      balance: true
    },
    donut: {
      type: "expense",
      top: "5"
    },
    goal: {
      enabled: false,
      value: 0
    },
    data: null,
    lineState: null
  };

  function fmtBRL(value) {
    const num = Number(value) || 0;
    return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function fmtCount(value) {
    const num = Number(value) || 0;
    return `${num} lan\u00e7amentos`;
  }

  function fmtPct(value) {
    if (value === null || value === undefined) return "--";
    const num = Number(value) || 0;
    return `${num.toFixed(1)}%`;
  }

  function parseBRL(value) {
    if (!value) return 0;
    const cleaned = value.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
    const num = Number(cleaned);
    return Number.isFinite(num) ? num : 0;
  }

  function safeStorageGet(key) {
    try {
      return localStorage.getItem(key);
    } catch (err) {
      return null;
    }
  }

  function safeStorageSet(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (err) {
      return;
    }
  }

  function setLoading(isLoading) {
    page.classList.toggle("is-loading", !!isLoading);
    page.setAttribute("aria-busy", isLoading ? "true" : "false");
  }

  function setEmptyState(el, isEmpty) {
    if (!el) return;
    el.classList.toggle("is-empty", !!isEmpty);
  }

  function setActiveButtons(container, predicate) {
    if (!container) return;
    container.querySelectorAll("button").forEach((btn) => {
      btn.classList.toggle("is-active", predicate(btn));
    });
  }

  function formatISO(date) {
    const pad = (val) => String(val).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function formatShortDate(value) {
    if (!value) return "-";
    const parts = value.split("-");
    if (parts.length >= 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return value;
  }

  function buildPeriodLabel(period) {
    if (!period) return "";
    if (period.label) return period.label;
    if (period.start && period.end) {
      return `${formatShortDate(period.start)} - ${formatShortDate(period.end)}`;
    }
    return "";
  }

  function updatePeriodUI(period) {
    state.period = period;
    setActiveButtons(periodTabs, (btn) => btn.dataset.period === period);
    periodPanels.forEach((panel) => {
      const active = panel.dataset.periodPanel === period;
      panel.classList.toggle("is-active", active);
      panel.setAttribute("aria-hidden", active ? "false" : "true");
    });

    if (compareLabel) {
      if (period === "quarter") {
        compareLabel.textContent = "Comparando com trimestre anterior";
      } else if (period === "custom") {
        compareLabel.textContent = "Comparando com per\u00edodo anterior";
      } else {
        compareLabel.textContent = "Comparando com m\u00eas anterior";
      }
    }

    if (compareToggle) {
      const label = compareToggle.closest(".switch")?.querySelector(".switch-text");
      if (label) {
        label.textContent = period === "quarter" ? "Trimestre anterior" : (period === "custom" ? "Per\u00edodo anterior" : "M\u00eas anterior");
      }
    }
  }

  function readPeriodParams() {
    const period = state.period;
    const params = { period, compare: state.compare };

    if (period === "quarter") {
      params.year = yearQuarterSelect?.value;
      params.quarter = quarterSelect?.value;
    } else if (period === "custom") {
      params.start = startInput?.value;
      params.end = endInput?.value;
    } else {
      params.year = yearSelect?.value;
      params.month = monthSelect?.value;
    }
    return params;
  }

  function buildChartsUrl(params) {
    const search = new URLSearchParams();
    search.set("period", params.period || "month");
    if (params.compare) search.set("compare", "1");
    if (params.period === "quarter") {
      if (params.year) search.set("year", params.year);
      if (params.quarter) search.set("quarter", params.quarter);
    } else if (params.period === "custom") {
      if (params.start) search.set("start", params.start);
      if (params.end) search.set("end", params.end);
    } else {
      if (params.year) search.set("year", params.year);
      if (params.month) search.set("month", params.month);
    }
    return `/app/charts/data?${search.toString()}`;
  }

  function calcDelta(current, previous) {
    const curr = Number(current) || 0;
    const prev = Number(previous) || 0;
    const diff = curr - prev;
    const pct = prev ? (diff / prev) * 100 : null;
    return { diff, pct };
  }

  function formatDelta(delta, isCurrency) {
    if (!delta) return "--";
    const diff = delta.diff || 0;
    const sign = diff >= 0 ? "+" : "-";
    const absDiff = Math.abs(diff);
    const main = isCurrency ? fmtBRL(absDiff) : `${absDiff}`;
    const pct = delta.pct === null ? "--" : `${Math.abs(delta.pct).toFixed(1)}%`;
    return `${sign}${main} (${sign}${pct})`;
  }

  function setKpi(elValue, elDelta, elChip, value, prevValue, opts) {
    if (elValue) {
      elValue.textContent = opts?.formatter ? opts.formatter(value) : fmtBRL(value);
    }
    if (!elDelta || !elChip) return;

    if (!state.compare || prevValue === null || prevValue === undefined) {
      elDelta.textContent = "Sem compara\u00e7\u00e3o";
      elChip.textContent = "Neutro";
      elChip.classList.remove("is-positive", "is-negative");
      return;
    }

    const delta = calcDelta(value, prevValue);
    elDelta.textContent = formatDelta(delta, opts?.isCurrency !== false);

    elChip.classList.remove("is-positive", "is-negative");
    const tone = opts?.tone || "neutral";

    if (tone === "positive") {
      if (delta.diff >= 0) {
        elChip.textContent = "Em alta";
        elChip.classList.add("is-positive");
      } else {
        elChip.textContent = "Em queda";
        elChip.classList.add("is-negative");
      }
      return;
    }

    if (tone === "negative") {
      if (delta.diff <= 0) {
        elChip.textContent = "Controlado";
        elChip.classList.add("is-positive");
      } else {
        elChip.textContent = "Aten\u00e7\u00e3o";
        elChip.classList.add("is-negative");
      }
      return;
    }

    if (delta.diff >= 0) {
      elChip.textContent = "Melhor";
      elChip.classList.add("is-positive");
    } else {
      elChip.textContent = "Pior";
      elChip.classList.add("is-negative");
    }
  }

  function updateKpis(data) {
    const summary = data?.summary || {};
    const compare = data?.comparison;
    const prev = compare?.summary || {};

    setKpi(kpiIncomeValue, kpiIncomeDelta, kpiIncomeChip, summary.receitas, prev.receitas, { tone: "positive" });
    setKpi(kpiExpenseValue, kpiExpenseDelta, kpiExpenseChip, summary.despesas, prev.despesas, { tone: "negative" });
    setKpi(kpiBalanceValue, kpiBalanceDelta, kpiBalanceChip, summary.saldo_projetado, prev.saldo_projetado, { tone: "positive" });
    setKpi(kpiEntriesValue, kpiEntriesDelta, kpiEntriesChip, summary.entradas, prev.entradas, { isCurrency: false });

    if (kpiEntriesValue) {
      kpiEntriesValue.textContent = fmtCount(summary.entradas || 0);
    }
  }

  function buildScale(values, width, height, padding) {
    const flat = values.length ? values : [0];
    const min = Math.min(...flat);
    const max = Math.max(...flat);
    const baseMin = Math.min(min, 0);
    const baseMax = Math.max(max, 0);
    const range = baseMax - baseMin || 1;

    function mapX(idx, length) {
      if (length <= 1) return width / 2;
      return (idx / (length - 1)) * width;
    }

    function mapY(value) {
      return height - padding - ((value - baseMin) / range) * (height - padding * 2);
    }

    return { mapX, mapY, min: baseMin, max: baseMax };
  }

  function buildPath(values, length, scale, width, height, padding) {
    if (!values.length) {
      const y = height - padding;
      return `M0 ${y} L${width} ${y}`;
    }
    return values.map((val, idx) => {
      const x = scale.mapX(idx, length);
      const y = scale.mapY(Number(val) || 0);
      return `${idx === 0 ? "M" : "L"}${Math.round(x)} ${Math.round(y)}`;
    }).join(" ");
  }

  function buildArea(values, length, scale, width, height, padding) {
    if (!values.length) {
      const y = height - padding;
      return `M0 ${y} L${width} ${y} L${width} ${height} L0 ${height} Z`;
    }
    const line = buildPath(values, length, scale, width, height, padding);
    const y = height - padding;
    return `${line} L${width} ${y} L0 ${y} Z`;
  }

  function updateReferenceLines(scale) {
    if (refZero) {
      const y = scale.mapY(0);
      refZero.setAttribute("y1", y);
      refZero.setAttribute("y2", y);
    }

    if (refGoal) {
      if (state.goal.enabled && state.goal.value) {
        const y = scale.mapY(state.goal.value);
        refGoal.setAttribute("y1", y);
        refGoal.setAttribute("y2", y);
        refGoal.style.opacity = "1";
      } else {
        refGoal.style.opacity = "0";
      }
    }
  }

  function updateLineChart(data) {
    const line = data?.line || {};
    const summary = data?.summary || {};
    const hasData = (summary.entradas || 0) > 0;

    setEmptyState(lineCanvas, !hasData);

    const series = {
      income: line.receitas || [],
      expense: line.despesas || [],
      balance: (line.saldo_acumulado && line.saldo_acumulado.length) ? line.saldo_acumulado : (line.saldo || [])
    };

    const length = Math.max(series.income.length, series.expense.length, series.balance.length);
    const width = 640;
    const height = 220;
    const padding = 12;

    const scaleValues = [];
    if (state.series.income) scaleValues.push(...series.income);
    if (state.series.expense) scaleValues.push(...series.expense);
    if (state.series.balance) scaleValues.push(...series.balance);
    scaleValues.push(0);
    if (state.goal.enabled && state.goal.value) scaleValues.push(state.goal.value);

    const scale = buildScale(scaleValues, width, height, padding);

    if (lineIncome) lineIncome.setAttribute("d", buildPath(series.income, length, scale, width, height, padding));
    if (lineExpense) lineExpense.setAttribute("d", buildPath(series.expense, length, scale, width, height, padding));
    if (lineBalance) lineBalance.setAttribute("d", buildPath(series.balance, length, scale, width, height, padding));

    if (areaIncome) areaIncome.setAttribute("d", buildArea(series.income, length, scale, width, height, padding));
    if (areaExpense) areaExpense.setAttribute("d", buildArea(series.expense, length, scale, width, height, padding));

    if (length > 0) {
      const last = length - 1;
      if (pointIncome) {
        pointIncome.setAttribute("cx", scale.mapX(last, length));
        pointIncome.setAttribute("cy", scale.mapY(series.income[last] || 0));
      }
      if (pointExpense) {
        pointExpense.setAttribute("cx", scale.mapX(last, length));
        pointExpense.setAttribute("cy", scale.mapY(series.expense[last] || 0));
      }
      if (pointBalance) {
        pointBalance.setAttribute("cx", scale.mapX(last, length));
        pointBalance.setAttribute("cy", scale.mapY(series.balance[last] || 0));
      }
    }

    toggleSeriesVisibility();
    updateReferenceLines(scale);

    state.lineState = {
      series,
      labels: line.labels || [],
      buckets: line.buckets || [],
      granularity: line.granularity || "day",
      scale,
      width,
      height,
      padding,
      length
    };
  }

  function toggleSeriesVisibility() {
    if (lineIncome) lineIncome.classList.toggle("is-hidden", !state.series.income);
    if (areaIncome) areaIncome.classList.toggle("is-hidden", !state.series.income);
    if (pointIncome) pointIncome.classList.toggle("is-hidden", !state.series.income);

    if (lineExpense) lineExpense.classList.toggle("is-hidden", !state.series.expense);
    if (areaExpense) areaExpense.classList.toggle("is-hidden", !state.series.expense);
    if (pointExpense) pointExpense.classList.toggle("is-hidden", !state.series.expense);

    if (lineBalance) lineBalance.classList.toggle("is-hidden", !state.series.balance);
    if (pointBalance) pointBalance.classList.toggle("is-hidden", !state.series.balance);
  }

  function hideLineHover() {
    if (lineTooltip) {
      lineTooltip.classList.remove("is-visible", "is-income", "is-expense", "is-balance", "is-flip");
    }
    if (lineGuide) {
      lineGuide.classList.remove("is-visible");
    }
  }

  function getLineIndexFromEvent(ev) {
    if (!state.lineState || !lineSvg) return null;
    const rect = lineSvg.getBoundingClientRect();
    const relX = ev.clientX - rect.left;
    if (relX < 0 || relX > rect.width) return null;
    const length = state.lineState.length || 0;
    if (!length) return null;
    return length === 1 ? 0 : Math.round((relX / rect.width) * (length - 1));
  }

  function formatBucketLabel(bucket, fallbackLabel) {
    if (!bucket) return fallbackLabel || "-";
    if (bucket.start && bucket.end && bucket.start === bucket.end) {
      return formatShortDate(bucket.start);
    }
    if (bucket.start && bucket.end) {
      return `${formatShortDate(bucket.start)} - ${formatShortDate(bucket.end)}`;
    }
    return bucket.label || fallbackLabel || "-";
  }

  function updateLineHover(ev) {
    if (!state.lineState || !lineSvg || !lineTooltip || !lineGuide) return;
    const idx = getLineIndexFromEvent(ev);
    if (idx === null) {
      hideLineHover();
      return;
    }

    const svgRect = lineSvg.getBoundingClientRect();
    const canvasRect = lineCanvas.getBoundingClientRect();
    const relY = ev.clientY - svgRect.top;
    const pointerY = (relY / svgRect.height) * state.lineState.height;

    const candidates = [];
    if (state.series.income) candidates.push({ key: "income", label: "Receita", value: state.lineState.series.income[idx] || 0 });
    if (state.series.expense) candidates.push({ key: "expense", label: "Despesa", value: state.lineState.series.expense[idx] || 0 });
    if (state.series.balance) candidates.push({ key: "balance", label: "Saldo", value: state.lineState.series.balance[idx] || 0 });

    if (!candidates.length) {
      hideLineHover();
      return;
    }

    let chosen = null;
    candidates.forEach((item) => {
      const pointY = state.lineState.scale.mapY(item.value);
      const dist = Math.abs(pointY - pointerY);
      if (!chosen || dist < chosen.dist) {
        chosen = { ...item, pointY, dist };
      }
    });

    if (!chosen) {
      hideLineHover();
      return;
    }

    const length = state.lineState.length || 1;
    const xPos = state.lineState.scale.mapX(idx, length);
    const left = (svgRect.left - canvasRect.left) + (xPos / state.lineState.width) * svgRect.width;
    const top = (svgRect.top - canvasRect.top) + (chosen.pointY / state.lineState.height) * svgRect.height;

    lineGuide.style.left = `${left}px`;
    lineGuide.classList.add("is-visible");

    if (lineTooltipType) lineTooltipType.textContent = chosen.label;
    if (lineTooltipValue) lineTooltipValue.textContent = fmtBRL(chosen.value);
    if (lineTooltipDate) {
      const bucket = state.lineState.buckets[idx];
      const fallback = state.lineState.labels[idx];
      lineTooltipDate.textContent = formatBucketLabel(bucket, fallback);
    }

    lineTooltip.classList.remove("is-income", "is-expense", "is-balance", "is-flip");
    lineTooltip.classList.add(`is-${chosen.key}`);
    if (top < 70) lineTooltip.classList.add("is-flip");

    const tooltipWidth = lineTooltip.offsetWidth || 130;
    const minLeft = tooltipWidth / 2 + 8;
    const maxLeft = canvasRect.width - tooltipWidth / 2 - 8;
    const clampedLeft = Math.min(Math.max(left, minLeft), maxLeft);

    lineTooltip.style.left = `${clampedLeft}px`;
    lineTooltip.style.top = `${top}px`;
    lineTooltip.classList.add("is-visible");
  }

  function updateFooter(data) {
    const highlights = data?.highlights || {};
    if (kpiBestPeriod) kpiBestPeriod.textContent = fmtBRL(highlights.best_bucket_total || 0);
    if (kpiBestPeriodLabel) kpiBestPeriodLabel.textContent = highlights.best_bucket_label || "-";
    if (kpiTopExpense) kpiTopExpense.textContent = fmtBRL(highlights.top_expense_total || 0);
    if (kpiTopExpenseLabel) kpiTopExpenseLabel.textContent = highlights.top_expense_label || "-";
    if (kpiEquilibrio) kpiEquilibrio.textContent = `${Number(highlights.equilibrio || 0).toFixed(1)}%`;
    if (kpiEquilibrioLabel) kpiEquilibrioLabel.textContent = "Despesas / receitas";
  }

  function buildDonutItems(categories, top) {
    const items = (categories || []).map((item) => ({
      key: item.key,
      label: CATEGORY_LABELS[item.key] || item.label || "Outros",
      total: Number(item.total) || 0
    })).filter((item) => item.total > 0);

    const total = items.reduce((acc, item) => acc + item.total, 0);
    if (top === "all") {
      return { items, total };
    }

    const limit = Number(top) || 5;
    const sorted = items.slice().sort((a, b) => b.total - a.total);
    const picked = sorted.slice(0, limit);
    const restTotal = sorted.slice(limit).reduce((acc, item) => acc + item.total, 0);

    if (restTotal > 0) {
      picked.push({
        key: "outros",
        label: "Outros",
        total: restTotal
      });
    }

    return { items: picked, total };
  }

  function colorForCategory(key, index) {
    return CATEGORY_COLORS[key] || FALLBACK_COLORS[index % FALLBACK_COLORS.length];
  }

  function updateDonut(data) {
    if (!donut) return;

    const categories = state.donut.type === "income" ? data?.categories?.income : data?.categories?.expense;
    const block = buildDonutItems(categories, state.donut.top);
    const items = block.items || [];
    const total = block.total || 0;

    setEmptyState(donutCanvas, !items.length);

    if (donutTotal) donutTotal.textContent = fmtBRL(total || 0);
    if (donutLabel) {
      donutLabel.textContent = state.donut.type === "income" ? "Total de receitas" : "Total de despesas";
    }

    if (donutSubtitle) {
      const topLabel = state.donut.top === "all" ? "Todas" : `Top ${state.donut.top}`;
      const typeLabel = state.donut.type === "income" ? "receitas" : "despesas";
      donutSubtitle.textContent = `${topLabel} ${typeLabel} do per\u00edodo`;
    }

    if (!items.length) {
      if (donutLegend) donutLegend.innerHTML = "<li>Sem dados no per\u00edodo.</li>";
      donut.style.removeProperty("--donut-gradient");
      return;
    }

    let offset = 0;
    const gradientStops = [];

    items.forEach((item, index) => {
      const pct = total ? (item.total / total) * 100 : 0;
      const end = offset + pct;
      const color = colorForCategory(item.key, index);
      gradientStops.push(`${color} ${offset.toFixed(2)}% ${end.toFixed(2)}%`);
      offset = end;
    });

    donut.style.setProperty("--donut-gradient", gradientStops.join(", "));

    if (donutLegend) {
      donutLegend.innerHTML = items.map((item, index) => {
        const pct = total ? (item.total / total) * 100 : 0;
        const color = colorForCategory(item.key, index);
        return `
          <li data-category="${item.key}">
            <span class="donut-dot" style="--dot:${color}"></span>
            <span>${item.label}</span>
            <span class="item-meta">${fmtBRL(item.total)} \u00b7 ${pct.toFixed(1)}%</span>
          </li>`;
      }).join("");
    }
  }

  function renderInsightList(listEl, items, emptyText) {
    if (!listEl) return;
    if (!items || !items.length) {
      listEl.innerHTML = `<li>${emptyText}</li>`;
      return;
    }
    listEl.innerHTML = items.map((item) => `<li>${item}</li>`).join("");
  }

  function updateInsights(data) {
    const insights = data?.insights || {};
    renderInsightList(insightsAlerts, insights.alerts, "Sem alertas para este per\u00edodo.");
    renderInsightList(insightsOpp, insights.opportunities, "Sem oportunidades identificadas.");
    renderInsightList(insightsPatterns, insights.patterns, "Sem padr\u00f5es relevantes.");
  }

  function buildDrilldownUrl(params) {
    const search = new URLSearchParams();
    if (params.start) search.set("start", params.start);
    if (params.end) search.set("end", params.end);
    if (params.type) search.set("type", params.type);
    if (params.category) search.set("category", params.category);
    if (params.limit) search.set("limit", params.limit);
    return `/app/charts/drilldown?${search.toString()}`;
  }

  function openDrilldown(params) {
    if (!drilldownOverlay) return;
    drilldownOverlay.classList.add("is-open");
    drilldownOverlay.setAttribute("aria-hidden", "false");
    page.classList.add("is-loading");
    drilldownList.innerHTML = "";
    drilldownEmpty?.classList.remove("is-visible");

    const titleLabel = params.label || "Detalhes do per\u00edodo";
    if (drilldownTitle) drilldownTitle.textContent = titleLabel;
    if (drilldownPeriod) {
      drilldownPeriod.textContent = `${formatShortDate(params.start)} - ${formatShortDate(params.end)}`;
    }
    if (drilldownCTA) {
      const urlParams = new URLSearchParams();
      urlParams.set("start", params.start || "");
      urlParams.set("end", params.end || "");
      if (params.type) urlParams.set("type", params.type);
      if (params.category) urlParams.set("category", params.category);
      drilldownCTA.href = `/app/entradas?${urlParams.toString()}`;
    }

    const url = buildDrilldownUrl({
      start: params.start,
      end: params.end,
      type: params.type,
      category: params.category,
      limit: 8
    });

    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error("Erro ao carregar detalhes");
        return res.json();
      })
      .then((payload) => {
        const items = payload.items || [];
        const summary = payload.summary || {};

        let totalValue = 0;
        if (params.type === "income") totalValue = summary.income || 0;
        else if (params.type === "expense") totalValue = summary.expense || 0;
        else totalValue = summary.net || 0;

        if (drilldownTotal) drilldownTotal.textContent = fmtBRL(totalValue);

        if (!items.length) {
          drilldownEmpty?.classList.add("is-visible");
          return;
        }

        drilldownList.innerHTML = items.map((item) => {
          const dateLabel = item.date ? formatShortDate(item.date) : "-";
          const meta = [dateLabel, item.category_label || item.category || "", item.method || ""].filter(Boolean).join(" \u00b7 ");
          const valueLabel = fmtBRL(item.value || 0);
          return `
            <li>
              <div>
                <div>${item.description || "-"}</div>
                <div class="item-meta">${meta}</div>
              </div>
              <strong>${valueLabel}</strong>
            </li>`;
        }).join("");
      })
      .catch(() => {
        drilldownList.innerHTML = "";
        drilldownEmpty?.classList.add("is-visible");
        pushToast("N\u00e3o foi poss\u00edvel carregar o drilldown.", "error");
      })
      .finally(() => {
        page.classList.remove("is-loading");
      });
  }

  function closeDrilldown() {
    if (!drilldownOverlay) return;
    drilldownOverlay.classList.remove("is-open");
    drilldownOverlay.setAttribute("aria-hidden", "true");
  }

  function downloadBlob(filename, content, type) {
    const blob = new Blob([content], { type: type || "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function exportCSV(data) {
    const summary = data?.summary || {};
    const line = data?.line || {};
    const labels = line.labels || (line.buckets || []).map((bucket) => bucket.label || "");
    const rows = [];
    rows.push(["Periodo", buildPeriodLabel(data.period)]);
    rows.push(["Receitas", summary.receitas || 0]);
    rows.push(["Despesas", summary.despesas || 0]);
    rows.push(["Saldo", summary.saldo_projetado || 0]);
    rows.push([]);
    rows.push(["Label", "Receitas", "Despesas", "Saldo"]);

    const income = line.receitas || [];
    const expense = line.despesas || [];
    const balance = line.saldo || [];

    labels.forEach((label, idx) => {
      rows.push([
        label,
        income[idx] || 0,
        expense[idx] || 0,
        balance[idx] || 0
      ]);
    });

    const csv = rows.map((row) => row.map((cell) => {
      const text = cell === null || cell === undefined ? "" : String(cell);
      return `"${text.replace(/"/g, '""')}"`;
    }).join(";"))
      .join("\n");

    downloadBlob("charts_periodo.csv", csv, "text/csv;charset=utf-8");
  }

  function exportJSON(data) {
    const json = JSON.stringify(data, null, 2);
    downloadBlob("charts_periodo.json", json, "application/json");
  }

  function exportSVG() {
    if (!lineSvg) return;
    const svgContent = lineSvg.outerHTML;
    downloadBlob("charts_fluxo.svg", svgContent, "image/svg+xml");
  }

  function pushToast(message, tone) {
    if (!toastStack) return;
    const toast = document.createElement("div");
    toast.className = "toast";
    if (tone) toast.classList.add(tone);
    toast.textContent = message;
    toastStack.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.add("is-visible");
    });

    setTimeout(() => {
      toast.classList.remove("is-visible");
      setTimeout(() => toast.remove(), 200);
    }, 3000);
  }

  function updatePeriodLabel(data) {
    if (!chartPeriodLabel) return;
    chartPeriodLabel.textContent = buildPeriodLabel(data?.period);
  }

  function loadData() {
    const params = readPeriodParams();
    const url = buildChartsUrl(params);
    setLoading(true);

    return fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error("Erro ao carregar dados");
        return res.json();
      })
      .then((data) => {
        state.data = data;
        updatePeriodLabel(data);
        updateKpis(data);
        updateLineChart(data);
        updateFooter(data);
        updateDonut(data);
        updateInsights(data);

        if (compareLabel) {
          if (data?.comparison?.enabled && data?.comparison?.period?.label) {
            compareLabel.textContent = `Comparando com ${data.comparison.period.label}`;
          }
        }
      })
      .catch(() => {
        pushToast("N\u00e3o foi poss\u00edvel carregar os gr\u00e1ficos.", "error");
        setEmptyState(lineCanvas, true);
        setEmptyState(donutCanvas, true);
        renderInsightList(insightsAlerts, [], "Falha ao carregar alertas.");
        renderInsightList(insightsOpp, [], "Falha ao carregar oportunidades.");
        renderInsightList(insightsPatterns, [], "Falha ao carregar padres.");
      })
      .finally(() => {
        setLoading(false);
      });
  }

  function handleSeriesToggle(event) {
    const btn = event.target.closest("button[data-series]");
    if (!btn) return;
    const key = btn.dataset.series;
    state.series[key] = !state.series[key];
    btn.classList.toggle("is-active", state.series[key]);
    updateLineChart(state.data);
  }

  function handleDonutToggle(event) {
    const typeBtn = event.target.closest("button[data-donut-type]");
    const topBtn = event.target.closest("button[data-donut-top]");

    if (typeBtn) {
      state.donut.type = typeBtn.dataset.donutType;
      setActiveButtons(donutTypeToggle, (btn) => btn.dataset.donutType === state.donut.type);
      updateDonut(state.data);
    }

    if (topBtn) {
      state.donut.top = topBtn.dataset.donutTop;
      setActiveButtons(donutTopToggle, (btn) => btn.dataset.donutTop === state.donut.top);
      updateDonut(state.data);
    }
  }

  function handleDonutClick(event) {
    const item = event.target.closest("li[data-category]");
    if (!item || !state.data?.period) return;

    const label = item.querySelector("span:nth-child(2)")?.textContent || "";

    openDrilldown({
      start: state.data.period.start,
      end: state.data.period.end,
      label: `Categoria: ${label}`,
      type: state.donut.type === "income" ? "income" : "expense",
      category: item.dataset.category
    });
  }

  function handleLineClick(event) {
    const idx = getLineIndexFromEvent(event);
    if (idx === null || !state.lineState) return;

    const bucket = state.lineState.buckets[idx];
    if (!bucket) return;

    openDrilldown({
      start: bucket.start,
      end: bucket.end,
      label: bucket.label || "Detalhes",
      type: "all"
    });
  }

  function handleGoalInput() {
    const value = parseBRL(goalLineInput?.value || "");
    state.goal.value = value;
    safeStorageSet("chartsGoalLine", value ? String(value) : "");
    updateLineChart(state.data);
  }

  function handleGoalBlur() {
    if (!goalLineInput) return;
    goalLineInput.value = state.goal.value ? fmtBRL(state.goal.value) : "";
  }

  function handleGoalToggle() {
    state.goal.enabled = !!goalLineToggle?.checked;
    safeStorageSet("chartsGoalLineEnabled", state.goal.enabled ? "1" : "0");
    updateLineChart(state.data);
  }

  function toggleExportMenu(force) {
    if (!exportDropdown) return;
    const open = force !== undefined ? force : !exportDropdown.classList.contains("is-open");
    exportDropdown.classList.toggle("is-open", open);
  }

  function handleExportClick(event) {
    const btn = event.target.closest("button[data-export]");
    if (!btn) return;

    const type = btn.dataset.export;
    if (!state.data) {
      pushToast("Nenhum dado para exportar.", "error");
      return;
    }

    if (type === "csv") exportCSV(state.data);
    if (type === "json") exportJSON(state.data);
    if (type === "svg") exportSVG();

    pushToast("Exporta\u00e7\u00e3o conclu\u00edda.", "success");
    toggleExportMenu(false);
  }

  function handleLockedAction(event) {
    const target = event.target.closest("[data-locked='true']");
    if (!target) return;
    event.preventDefault();
    pushToast("Dispon\u00edvel apenas no plano PRO.", "error");
  }

  function initDefaults() {
    const now = new Date();
    const year = String(now.getFullYear());
    const month = String(now.getMonth() + 1);
    const quarter = String(Math.floor((now.getMonth()) / 3) + 1);

    if (yearSelect) yearSelect.value = year;
    if (monthSelect) monthSelect.value = month;
    if (yearQuarterSelect) yearQuarterSelect.value = year;
    if (quarterSelect) quarterSelect.value = quarter;

    if (startInput && endInput) {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      startInput.value = formatISO(start);
      endInput.value = formatISO(end);
    }

    const storedGoal = Number(safeStorageGet("chartsGoalLine"));
    if (storedGoal && goalLineInput) {
      state.goal.value = storedGoal;
      goalLineInput.value = fmtBRL(storedGoal);
    }

    const storedGoalEnabled = safeStorageGet("chartsGoalLineEnabled");
    if (goalLineToggle) {
      state.goal.enabled = storedGoalEnabled === "1";
      goalLineToggle.checked = state.goal.enabled;
    }
  }

  function bindEvents() {
    periodTabs?.addEventListener("click", (event) => {
      const btn = event.target.closest("button[data-period]");
      if (!btn) return;
      updatePeriodUI(btn.dataset.period);
      loadData();
    });

    yearSelect?.addEventListener("change", loadData);
    monthSelect?.addEventListener("change", loadData);
    yearQuarterSelect?.addEventListener("change", loadData);
    quarterSelect?.addEventListener("change", loadData);

    startInput?.addEventListener("change", () => {
      if (state.period === "custom") loadData();
    });

    endInput?.addEventListener("change", () => {
      if (state.period === "custom") loadData();
    });

    compareToggle?.addEventListener("change", () => {
      state.compare = !!compareToggle.checked;
      loadData();
    });

    exportTrigger?.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleExportMenu();
    });

    exportMenu?.addEventListener("click", handleExportClick);

    document.addEventListener("click", (event) => {
      if (exportDropdown && !exportDropdown.contains(event.target)) {
        toggleExportMenu(false);
      }
      handleLockedAction(event);
    });

    seriesToggle?.addEventListener("click", handleSeriesToggle);
    donutTypeToggle?.addEventListener("click", handleDonutToggle);
    donutTopToggle?.addEventListener("click", handleDonutToggle);
    donutLegend?.addEventListener("click", handleDonutClick);

    goalLineInput?.addEventListener("input", handleGoalInput);
    goalLineInput?.addEventListener("blur", handleGoalBlur);
    goalLineToggle?.addEventListener("change", handleGoalToggle);

    lineCanvas?.addEventListener("mousemove", updateLineHover);
    lineCanvas?.addEventListener("mouseleave", hideLineHover);
    lineCanvas?.addEventListener("click", handleLineClick);

    refreshInsights?.addEventListener("click", () => loadData());
    exportInsights?.addEventListener("click", () => {
      if (!state.data) return;
      const insights = state.data.insights || {};
      const text = [
        "Alertas:\n" + (insights.alerts || []).join("\n"),
        "\nOportunidades:\n" + (insights.opportunities || []).join("\n"),
        "\nPadr\u00f5es:\n" + (insights.patterns || []).join("\n")
      ].join("\n");
      downloadBlob("insights_periodo.txt", text, "text/plain");
      pushToast("Insights exportados.", "success");
    });
    insightCreateRule?.addEventListener("click", () => {
      window.location.href = "/app/filters";
    });

    drilldownClose?.addEventListener("click", closeDrilldown);
    drilldownCloseBtn?.addEventListener("click", closeDrilldown);
    drilldownOverlay?.addEventListener("click", (event) => {
      if (event.target === drilldownOverlay) closeDrilldown();
    });
  }

  initDefaults();
  updatePeriodUI("month");
  bindEvents();
  loadData();
})();
