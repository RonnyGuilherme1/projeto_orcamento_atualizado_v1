(function () {
  const page = document.querySelector(".charts-page");
  if (!page) return;

  const yearSelect = document.getElementById("chart-year");
  const monthSelect = document.getElementById("chart-month");

  const summaryReceitas = document.getElementById("summary-receitas");
  const summaryDespesas = document.getElementById("summary-despesas");
  const summarySaldo = document.getElementById("summary-saldo");
  const summarySaldoMeta = document.getElementById("summary-saldo-meta");
  const summaryCount = document.getElementById("summary-count");
  const summaryCountMeta = document.getElementById("summary-count-meta");

  const noteUpdated = document.getElementById("chart-note-updated");
  const noteBalance = document.getElementById("chart-note-balance");

  const lineCanvas = document.querySelector(".chart-line");
  const donutCanvas = document.querySelector(".donut-wrap");
  const barsCanvas = document.getElementById("status-bars");

  const lineIncome = document.querySelector('[data-line="income"]');
  const lineExpense = document.querySelector('[data-line="expense"]');
  const lineBalance = document.querySelector('[data-line="balance"]');
  const areaIncome = document.querySelector('[data-area="income"]');
  const areaExpense = document.querySelector('[data-area="expense"]');
  const pointIncome = document.querySelector('[data-point="income"]');
  const pointExpense = document.querySelector('[data-point="expense"]');
  const pointBalance = document.querySelector('[data-point="balance"]');
  const lineTooltip = document.getElementById("line-tooltip");
  const lineTooltipType = document.getElementById("line-tooltip-type");
  const lineTooltipValue = document.getElementById("line-tooltip-value");
  const lineTooltipDate = document.getElementById("line-tooltip-date");
  const lineGuide = document.getElementById("line-guide");
  const lineSvg = lineCanvas ? lineCanvas.querySelector(".chart-svg") : null;

  const kpiBestWeek = document.getElementById("kpi-best-week");
  const kpiBestWeekLabel = document.getElementById("kpi-best-week-label");
  const kpiTopExpense = document.getElementById("kpi-top-expense");
  const kpiTopExpenseLabel = document.getElementById("kpi-top-expense-label");
  const kpiBalance = document.getElementById("kpi-balance");
  const kpiBalanceLabel = document.getElementById("kpi-balance-label");

  const donut = document.getElementById("chart-donut");
  const donutLegend = document.getElementById("donut-legend");
  const donutTotal = document.getElementById("donut-total");
  const donutLabel = document.getElementById("donut-label");

  const alertsList = document.getElementById("chart-alerts");

  const goalSavingsLabel = document.getElementById("goal-savings-label");
  const goalSavingsBar = document.getElementById("goal-savings-bar");
  const goalSavingsMeta = document.getElementById("goal-savings-meta");
  const goalPeriod = document.getElementById("goal-period");
  const goalCustom = document.getElementById("goal-custom");

  const categoriesBars = document.getElementById("categories-bars");
  const insightError = document.getElementById("insight-error");
  const insightPeriodLabel = document.getElementById("insight-period-label");

  const receiptsA = document.getElementById("compare-receitas-a");
  const receiptsB = document.getElementById("compare-receitas-b");
  const receiptsDelta = document.getElementById("compare-receitas-delta");
  const expensesA = document.getElementById("compare-despesas-a");
  const expensesB = document.getElementById("compare-despesas-b");
  const expensesDelta = document.getElementById("compare-despesas-delta");
  const balanceA = document.getElementById("compare-saldo-a");
  const balanceB = document.getElementById("compare-saldo-b");
  const balanceDelta = document.getElementById("compare-saldo-delta");
  const countA = document.getElementById("compare-count-a");
  const countB = document.getElementById("compare-count-b");
  const countDelta = document.getElementById("compare-count-delta");
  const categoriesA = document.getElementById("compare-categories-a");
  const categoriesB = document.getElementById("compare-categories-b");
  const compareBars = document.getElementById("compare-bars");

  const insightTopUp = document.getElementById("insight-top-up");
  const insightTopUpMeta = document.getElementById("insight-top-up-meta");
  const insightTopDown = document.getElementById("insight-top-down");
  const insightTopDownMeta = document.getElementById("insight-top-down-meta");
  const insightTopCategory = document.getElementById("insight-top-category");
  const insightTopCategoryMeta = document.getElementById("insight-top-category-meta");
  const insightVsAvg = document.getElementById("insight-vs-avg");
  const insightVsAvgMeta = document.getElementById("insight-vs-avg-meta");
  const insightChanges = document.getElementById("insight-changes");
  const topIncomeList = document.getElementById("insight-top-income");
  const topExpenseList = document.getElementById("insight-top-expense");

  const statusBars = {
    pago: {
      bar: document.querySelector('[data-bar="pago"]'),
      label: document.querySelector('[data-bar-value="pago"]')
    },
    em_andamento: {
      bar: document.querySelector('[data-bar="em_andamento"]'),
      label: document.querySelector('[data-bar-value="em_andamento"]')
    },
    nao_pago: {
      bar: document.querySelector('[data-bar="nao_pago"]'),
      label: document.querySelector('[data-bar-value="nao_pago"]')
    }
  };

  const CATEGORY_LABELS = {
    salario: "Salário",
    extras: "Extras",
    moradia: "Moradia",
    mercado: "Mercado",
    transporte: "Transporte",
    servicos: "Serviços",
    outros: "Outros"
  };

  const CATEGORY_DOTS = {
    moradia: "dot-home",
    mercado: "dot-mkt",
    transporte: "dot-trans",
    servicos: "dot-serv",
    outros: "dot-other"
  };

  const CATEGORY_COLORS = {
    moradia: "var(--cat-home)",
    mercado: "var(--cat-mkt)",
    transporte: "var(--cat-trans)",
    servicos: "var(--cat-serv)",
    outros: "var(--cat-other)"
  };

  const MESES = [
    "Janeiro",
    "Fevereiro",
    "Marco",
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

  let lineState = null;
  let lastData = null;
  let donutLegendBound = false;
  const donutState = {
    categories: [],
    total: 0,
    totalValue: 0,
    gradient: ""
  };

  function initCustomSelect(selectEl) {
    if (!selectEl || selectEl.dataset.customized) return;
    selectEl.dataset.customized = "true";

    const wrapper = document.createElement("div");
    wrapper.className = "select";

    selectEl.parentNode.insertBefore(wrapper, selectEl);
    wrapper.appendChild(selectEl);
    selectEl.classList.add("select-native");
    selectEl.tabIndex = -1;

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "control select-trigger";
    trigger.setAttribute("aria-haspopup", "listbox");
    wrapper.appendChild(trigger);

    const list = document.createElement("div");
    list.className = "select-options";
    list.setAttribute("role", "listbox");
    wrapper.appendChild(list);

    function buildOptions() {
      list.innerHTML = "";
      Array.from(selectEl.options).forEach(opt => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "select-option";
        btn.dataset.value = opt.value;
        btn.textContent = opt.textContent;
        btn.disabled = opt.disabled;
        list.appendChild(btn);
      });
    }

    function updateFromSelect() {
      const current = selectEl.options[selectEl.selectedIndex];
      trigger.textContent = current ? current.textContent : "";
      wrapper.classList.toggle("is-disabled", !!selectEl.disabled);
      trigger.disabled = !!selectEl.disabled;
      list.querySelectorAll(".select-option").forEach(btn => {
        btn.classList.toggle("is-selected", btn.dataset.value === selectEl.value);
      });
    }

    selectEl._customUpdate = updateFromSelect;

    buildOptions();
    updateFromSelect();

    trigger.addEventListener("click", (ev) => {
      ev.stopPropagation();
      if (selectEl.disabled) return;
      wrapper.classList.toggle("open");
    });

    list.addEventListener("click", (ev) => {
      const btn = ev.target.closest(".select-option");
      if (!btn || btn.disabled) return;
      selectEl.value = btn.dataset.value;
      selectEl.dispatchEvent(new Event("change", { bubbles: true }));
      updateFromSelect();
      wrapper.classList.remove("open");
    });

    document.addEventListener("click", (ev) => {
      if (!wrapper.contains(ev.target)) wrapper.classList.remove("open");
    });

    selectEl.addEventListener("change", updateFromSelect);
  }

  function fmtBRL(value) {
    const num = Number(value) || 0;
    return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function formatDate(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function monthRange(year, month) {
    const now = new Date();
    const y = Number(year) || now.getFullYear();
    const m = Number(month) || (now.getMonth() + 1);
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 0);
    return { start, end };
  }

  function formatMonthLabel(year, month) {
    const y = Number(year) || new Date().getFullYear();
    const m = Number(month) || (new Date().getMonth() + 1);
    const name = MESES[m - 1] || "Mes";
    return `${name} ${y}`;
  }

  function fmtCount(value) {
    const val = Number(value) || 0;
    return `${val} lançamentos`;
  }

  function setDelta(el, a, b, isCurrency = true) {
    if (!el) return;
    const base = Number(a) || 0;
    const current = Number(b) || 0;
    const diff = current - base;
    const percent = base ? (diff / base) * 100 : 0;
    const sign = diff >= 0 ? "+" : "-";
    const absDiff = Math.abs(diff);
    const absPct = Math.abs(percent);
    const valueText = isCurrency ? fmtBRL(absDiff) : `${absDiff}`;
    el.textContent = `${sign}${valueText} (${sign}${absPct.toFixed(1)}%)`;
    el.classList.toggle("is-positive", diff > 0);
    el.classList.toggle("is-negative", diff < 0);
  }

  function fmtDateShort(value) {
    if (!value) return "agora";
    if (value.length >= 10) {
      const year = value.slice(0, 4);
      const month = value.slice(5, 7);
      const day = value.slice(8, 10);
      if (year && month && day) return `${day}/${month}/${year}`;
    }
    return value;
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

  function showInsightError(message) {
    if (!insightError) return;
    if (message) {
      insightError.textContent = message;
      insightError.style.display = "block";
    } else {
      insightError.textContent = "";
      insightError.style.display = "none";
    }
  }

  function getPrevMonth(year, month) {
    let y = Number(year) || new Date().getFullYear();
    let m = Number(month) || (new Date().getMonth() + 1);
    if (m <= 1) {
      y -= 1;
      m = 12;
    } else {
      m -= 1;
    }
    return { year: y, month: m };
  }

  function getPeriodKey(period) {
    if (!period || !period.year || !period.month) return "period";
    const month = String(period.month).padStart(2, "0");
    return `${period.year}-${month}`;
  }

  function getPeriodCount(days, periodType) {
    if (periodType === "weekly") return Math.max(1, Math.ceil(days / 7));
    if (periodType === "biweekly") return Math.max(1, Math.ceil(days / 15));
    return 1;
  }

  function getPeriodLabel(periodType) {
    if (periodType === "weekly") return "semanal";
    if (periodType === "biweekly") return "quinzenal";
    return "mensal";
  }

  function getDaysInPeriod(period, labels) {
    if (labels && labels.length) return labels.length;
    if (!period || !period.year || !period.month) return 30;
    return new Date(period.year, period.month, 0).getDate();
  }

  function setEmptyState(canvas, isEmpty) {
    if (!canvas) return;
    canvas.classList.toggle("is-empty", !!isEmpty);
  }

  function buildPaths(series, width, height, padding) {
    const allValues = series.flat();
    const min = Math.min(0, ...allValues);
    const max = Math.max(0, ...allValues);
    const range = max - min || 1;
    const step = series[0].length > 1 ? width / (series[0].length - 1) : width;

    function pointAt(idx, val) {
      const x = idx * step;
      const y = height - padding - ((val - min) / range) * (height - (padding * 2));
      return { x: Math.round(x), y: Math.round(y) };
    }

    function linePath(values) {
      if (!values.length) return `M0 ${height - padding} L${width} ${height - padding}`;
      return values.map((val, idx) => {
        const p = pointAt(idx, val);
        return `${idx === 0 ? "M" : "L"}${p.x} ${p.y}`;
      }).join(" ");
    }

    function areaPath(values) {
      if (!values.length) {
        const y = height - padding;
        return `M0 ${y} L${width} ${y} L${width} ${height} L0 ${height} Z`;
      }
      const line = linePath(values);
      const y = height - padding;
      return `${line} L${width} ${y} L0 ${y} Z`;
    }

    return { linePath, areaPath, pointAt };
  }

  function formatLineDate(period, labels, idx) {
    const label = (labels && labels[idx]) ? labels[idx] : String(idx + 1).padStart(2, "0");
    if (!period || !period.year || !period.month) return label;
    const month = String(period.month).padStart(2, "0");
    return `${label}/${month}/${period.year}`;
  }

  function hideLineHover() {
    if (lineTooltip) {
      lineTooltip.classList.remove("is-visible", "is-income", "is-expense", "is-balance", "is-flip");
    }
    if (lineGuide) {
      lineGuide.classList.remove("is-visible");
    }
  }

  function updateLineHover(ev) {
    if (!lineState || !lineSvg || !lineCanvas || !lineTooltip || !lineGuide) return;
    if (!lineTooltipType || !lineTooltipValue || !lineTooltipDate) return;

    const length = lineState.length;
    if (!length) {
      hideLineHover();
      return;
    }

    const svgRect = lineSvg.getBoundingClientRect();
    const canvasRect = lineCanvas.getBoundingClientRect();
    const relX = ev.clientX - svgRect.left;
    const relY = ev.clientY - svgRect.top;

    if (relX < 0 || relX > svgRect.width || relY < 0 || relY > svgRect.height) {
      hideLineHover();
      return;
    }

    const idx = length === 1 ? 0 : Math.round((relX / svgRect.width) * (length - 1));
    const clampedIdx = Math.max(0, Math.min(length - 1, idx));
    const pointerY = (relY / svgRect.height) * lineState.height;
    const series = lineState.series;
    const builder = lineState.builder;
    if (!builder || !series) {
      hideLineHover();
      return;
    }

    const candidates = [
      { key: "income", label: "Receita", value: series.receitas[clampedIdx] },
      { key: "expense", label: "Despesa", value: series.despesas[clampedIdx] },
      { key: "balance", label: "Saldo", value: series.saldo[clampedIdx] }
    ];

    let chosen = null;
    candidates.forEach((item) => {
      const point = builder.pointAt(clampedIdx, Number(item.value) || 0);
      const dist = Math.abs(point.y - pointerY);
      if (!chosen || dist < chosen.dist) {
        chosen = { ...item, point, dist };
      }
    });

    if (!chosen) {
      hideLineHover();
      return;
    }

    const xPos = length === 1 ? (svgRect.width / 2) : (clampedIdx / (length - 1)) * svgRect.width;
    const left = (svgRect.left - canvasRect.left) + xPos;
    const top = (svgRect.top - canvasRect.top) + ((chosen.point.y / lineState.height) * svgRect.height);

    lineGuide.style.left = `${left}px`;
    lineGuide.classList.add("is-visible");

    lineTooltipType.textContent = chosen.label;
    lineTooltipValue.textContent = fmtBRL(chosen.value);
    lineTooltipDate.textContent = formatLineDate(lineState.period, lineState.labels, clampedIdx);

    lineTooltip.classList.remove("is-income", "is-expense", "is-balance", "is-flip");
    lineTooltip.classList.add(`is-${chosen.key}`);
    if (top < 70) {
      lineTooltip.classList.add("is-flip");
    }

    const tooltipWidth = lineTooltip.offsetWidth || 130;
    const minLeft = tooltipWidth / 2 + 8;
    const maxLeft = canvasRect.width - tooltipWidth / 2 - 8;
    const clampedLeft = Math.min(Math.max(left, minLeft), maxLeft);

    lineTooltip.style.left = `${clampedLeft}px`;
    lineTooltip.style.top = `${top}px`;
    lineTooltip.classList.add("is-visible");
  }

  function updateLineChart(series) {
    if (!lineIncome || !lineExpense || !lineBalance) return;
    const width = 640;
    const height = 220;
    const padding = 12;

    const builder = buildPaths([series.receitas, series.despesas, series.saldo], width, height, padding);

    lineIncome.setAttribute("d", builder.linePath(series.receitas));
    lineExpense.setAttribute("d", builder.linePath(series.despesas));
    lineBalance.setAttribute("d", builder.linePath(series.saldo));

    if (areaIncome) areaIncome.setAttribute("d", builder.areaPath(series.receitas));
    if (areaExpense) areaExpense.setAttribute("d", builder.areaPath(series.despesas));

    const lastIndex = series.receitas.length - 1;
    if (lastIndex >= 0) {
      const pIncome = builder.pointAt(lastIndex, series.receitas[lastIndex]);
      const pExpense = builder.pointAt(lastIndex, series.despesas[lastIndex]);
      const pBalance = builder.pointAt(lastIndex, series.saldo[lastIndex]);
      pointIncome?.setAttribute("cx", pIncome.x);
      pointIncome?.setAttribute("cy", pIncome.y);
      pointExpense?.setAttribute("cx", pExpense.x);
      pointExpense?.setAttribute("cy", pExpense.y);
      pointBalance?.setAttribute("cx", pBalance.x);
      pointBalance?.setAttribute("cy", pBalance.y);
    }

    return { builder, width, height, padding };
  }

  function updateDonut(categories, total) {
    if (!donut) return;
    const hasData = total > 0 && categories.length > 0;
    setEmptyState(donutCanvas, !hasData);

    donutTotal.textContent = fmtBRL(total);
    donutLabel.textContent = total > 0 ? "Total de despesas" : "Sem despesas";

    if (!hasData) {
      donutState.categories = [];
      donutState.total = total;
      donutState.totalValue = 0;
      donutState.gradient = "";
      donutState.buildGradient = () => "";
      donut.style.removeProperty("--donut-gradient");
      donutLegend.innerHTML = "<li>Sem despesas no período.</li>";
      return;
    }

    const items = (categories || [])
      .map((item) => ({
        key: item.key,
        label: CATEGORY_LABELS[item.key] || item.label || "Outros",
        total: Number(item.total) || 0,
        percent: Number(item.percent) || 0,
        color: CATEGORY_COLORS[item.key] || "var(--cat-other)",
        dotClass: CATEGORY_DOTS[item.key] || "dot-other"
      }))
      .filter((item) => item.total > 0);

    const totalValue = items.reduce((sum, item) => sum + item.total, 0) || 0;
    donutState.categories = items;
    donutState.total = total;
    donutState.totalValue = totalValue;

    donutState.buildGradient = (activeIndex) => {
      let acc = 0;
      const baseTotal = donutState.totalValue || 0;
      return donutState.categories.map((item, index) => {
        const part = baseTotal ? (item.total / baseTotal) * 100 : 0;
        const start = acc;
        acc += part;
        const color = activeIndex === null || index === activeIndex
          ? item.color
          : "rgba(255, 255, 255, 0.12)";
        return `${color} ${start.toFixed(1)}% ${acc.toFixed(1)}%`;
      }).join(", ");
    };

    donutState.gradient = donutState.buildGradient(null);
    donut.style.setProperty("--donut-gradient", donutState.gradient);

    donutLegend.innerHTML = items.map((item, index) => {
      const pct = totalValue ? (item.total / totalValue) * 100 : (item.percent || 0);
      const pctText = pct.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
      return `<li data-index="${index}" title="${item.label}: ${fmtBRL(item.total)}">
        <span class="legend-dot ${item.dotClass}"></span>${item.label} ${pctText}%
      </li>`;
    }).join("");

    if (!donutLegendBound && donutLegend) {
      donutLegendBound = true;
      donutLegend.addEventListener("mouseover", (event) => {
        const itemEl = event.target.closest("li[data-index]");
        if (!itemEl) return;
        const index = Number(itemEl.dataset.index);
        if (Number.isNaN(index)) return;
        const item = donutState.categories[index];
        if (!item) return;
        const pct = donutState.totalValue ? (item.total / donutState.totalValue) * 100 : (item.percent || 0);
        const pctText = pct.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
        donutTotal.textContent = fmtBRL(item.total);
        donutLabel.textContent = `${item.label} · ${pctText}%`;
        donut.style.setProperty("--donut-gradient", donutState.buildGradient(index));
        donutLegend.querySelectorAll("li").forEach((li) => {
          const liIndex = Number(li.dataset.index);
          if (Number.isNaN(liIndex)) return;
          li.classList.toggle("is-active", liIndex === index);
          li.classList.toggle("is-muted", liIndex !== index);
        });
      });

      donutLegend.addEventListener("mouseleave", () => {
        donutTotal.textContent = fmtBRL(donutState.total);
        donutLabel.textContent = donutState.total > 0 ? "Total de despesas" : "Sem despesas";
        if (donutState.gradient) {
          donut.style.setProperty("--donut-gradient", donutState.gradient);
        } else {
          donut.style.removeProperty("--donut-gradient");
        }
        donutLegend.querySelectorAll("li").forEach((li) => {
          li.classList.remove("is-active", "is-muted");
        });
      });
    }
  }

  function updateStatusBars(statuses, total) {
    const hasData = total > 0;
    setEmptyState(barsCanvas, !hasData);

    Object.keys(statusBars).forEach((key) => {
      const value = Number(statuses[key] || 0);
      const pct = total ? Math.min(100, (value / total) * 100) : 0;
      statusBars[key].bar.style.width = `${pct.toFixed(1)}%`;
      statusBars[key].label.textContent = fmtBRL(value);
    });
  }

  function updateCategoryBars(categories, total) {
    if (!categoriesBars) return;
    const items = (categories || []).filter(item => Number(item.total) > 0);
    const hasData = total > 0 && items.length > 0;
    setEmptyState(categoriesBars, !hasData);

    categoriesBars.querySelectorAll(".category-row").forEach(row => row.remove());

    if (!hasData) return;

    const emptyEl = categoriesBars.querySelector(".chart-empty");
    items.slice(0, 5).forEach((item) => {
      const label = CATEGORY_LABELS[item.key] || item.label || "Outros";
      const value = Number(item.total) || 0;
      const pct = total ? Math.min(100, (value / total) * 100) : 0;
      const color = CATEGORY_COLORS[item.key] || "var(--cat-other)";
      const row = document.createElement("div");
      row.className = "bar-row category-row";
      row.innerHTML = `
        <span class="bar-label">${label}</span>
        <div class="bar-track">
          <div class="bar-fill" style="width:${pct.toFixed(1)}%; background:${color};"></div>
        </div>
        <span class="bar-value">${fmtBRL(value)}</span>
      `;
      if (emptyEl) {
        categoriesBars.insertBefore(row, emptyEl);
      } else {
        categoriesBars.appendChild(row);
      }
    });
  }

  function updateAlerts(alerts) {
    if (!alertsList) return;
    const list = (alerts || []).length ? alerts : ["Sem dados para gerar alertas."];
    alertsList.innerHTML = list.map(item => `<li>${item}</li>`).join("");
  }

  function renderCategories(listEl, categories, total) {
    if (!listEl) return;
    const items = (categories || []).filter(item => Number(item.total) > 0);
    if (!items.length) {
      listEl.innerHTML = "<li>Sem despesas no período</li>";
      return;
    }
    const totalValue = Number(total) || items.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
    listEl.innerHTML = items.slice(0, 5).map((item) => {
      const label = CATEGORY_LABELS[item.key] || item.label || "Outros";
      const value = Number(item.total) || 0;
      const pct = totalValue ? (value / totalValue) * 100 : (Number(item.percent) || 0);
      return `<li>
        <span>${label}</span>
        <span class="item-meta">${fmtBRL(value)} - ${pct.toFixed(1)}%</span>
      </li>`;
    }).join("");
  }

  function buildCategoryMap(categories) {
    const map = new Map();
    (categories || []).forEach((item) => {
      if (!item?.key) return;
      map.set(item.key, {
        key: item.key,
        label: CATEGORY_LABELS[item.key] || item.label || "Outros",
        total: Number(item.total) || 0
      });
    });
    return map;
  }

  function computeCategoryDeltas(catA, catB) {
    const mapA = buildCategoryMap(catA);
    const mapB = buildCategoryMap(catB);
    const keys = new Set([...mapA.keys(), ...mapB.keys()]);
    const deltas = [];
    keys.forEach((key) => {
      const itemA = mapA.get(key);
      const itemB = mapB.get(key);
      const totalA = itemA ? itemA.total : 0;
      const totalB = itemB ? itemB.total : 0;
      if (totalA === 0 && totalB === 0) return;
      deltas.push({
        key,
        label: (itemB && itemB.label) || (itemA && itemA.label) || "Outros",
        a: totalA,
        b: totalB,
        delta: totalB - totalA
      });
    });
    return deltas.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  }

  function renderInsightChanges(listEl, deltas) {
    if (!listEl) return;
    if (!deltas || !deltas.length) {
      listEl.innerHTML = "<li>Sem variações relevantes no período.</li>";
      return;
    }
    listEl.innerHTML = deltas.slice(0, 6).map((item) => {
      const sign = item.delta >= 0 ? "+" : "-";
      const pctBase = item.a || item.b || 0;
      const pct = pctBase ? Math.abs(item.delta / pctBase) * 100 : 0;
      return `<li>
        <span>${item.label}</span>
        <span class="item-meta">${sign}${fmtBRL(Math.abs(item.delta))} (${pct.toFixed(1)}%)</span>
      </li>`;
    }).join("");
  }

  function renderTopEntries(listEl, entries, tipo) {
    if (!listEl) return;
    const filtered = (entries || []).filter(item => item.type === tipo);
    if (!filtered.length) {
      listEl.innerHTML = "<li>Sem lançamentos no período.</li>";
      return;
    }
    listEl.innerHTML = filtered.slice(0, 5).map((item) => {
      const label = item.description || "-";
      const cat = CATEGORY_LABELS[item.category] || item.category || "Outros";
      return `<li>
        <span>${label}</span>
        <span class="item-meta">${cat} - ${fmtBRL(item.value)}</span>
      </li>`;
    }).join("");
  }

  function renderCompareBars(catA, catB) {
    if (!compareBars) return;
    const map = new Map();

    (catA || []).forEach((item) => {
      if (!item?.key) return;
      map.set(item.key, {
        key: item.key,
        label: CATEGORY_LABELS[item.key] || item.label || "Outros",
        a: Number(item.total) || 0,
        b: 0
      });
    });

    (catB || []).forEach((item) => {
      if (!item?.key) return;
      const existing = map.get(item.key) || {
        key: item.key,
        label: CATEGORY_LABELS[item.key] || item.label || "Outros",
        a: 0,
        b: 0
      };
      existing.b = Number(item.total) || 0;
      map.set(item.key, existing);
    });

    const rows = Array.from(map.values())
      .filter(item => item.a > 0 || item.b > 0)
      .sort((a, b) => (b.a + b.b) - (a.a + a.b))
      .slice(0, 6);

    if (!rows.length) {
      compareBars.innerHTML = '<div class="compare-empty">Sem despesas suficientes para comparar.</div>';
      return;
    }

    const maxValue = Math.max(...rows.map(row => Math.max(row.a, row.b)), 1);

    compareBars.innerHTML = rows.map((row) => {
      const widthA = Math.min(100, (row.a / maxValue) * 100);
      const widthB = Math.min(100, (row.b / maxValue) * 100);
      return `<div class="compare-bar-row">
        <span class="compare-bar-label">${row.label}</span>
        <div class="compare-bar-group">
          <div class="compare-bar-track"><div class="compare-bar bar-a" style="width:${widthA.toFixed(1)}%"></div></div>
          <div class="compare-bar-track"><div class="compare-bar bar-b" style="width:${widthB.toFixed(1)}%"></div></div>
        </div>
        <div class="compare-bar-values">
          <span>${fmtBRL(row.a)}</span>
          <span>${fmtBRL(row.b)}</span>
        </div>
      </div>`;
    }).join("");
  }

  function renderInsights(dataA, dataB, avgData) {
    if (!dataA || !dataB) return;
    const deltas = computeCategoryDeltas(dataA.categories || [], dataB.categories || []);
    const topUp = deltas.find(item => item.delta > 0);
    const topDown = [...deltas].reverse().find(item => item.delta < 0);
    const topCategoryB = (dataB.categories || []).slice().sort((a, b) => (b.total || 0) - (a.total || 0))[0];

    if (insightTopUp) insightTopUp.textContent = topUp ? topUp.label : "--";
    if (insightTopUpMeta) insightTopUpMeta.textContent = topUp ? `+${fmtBRL(topUp.delta)}` : "--";
    if (insightTopDown) insightTopDown.textContent = topDown ? topDown.label : "--";
    if (insightTopDownMeta) insightTopDownMeta.textContent = topDown ? `-${fmtBRL(Math.abs(topDown.delta))}` : "--";

    if (insightTopCategory) {
      insightTopCategory.textContent = topCategoryB ? (CATEGORY_LABELS[topCategoryB.key] || topCategoryB.label || "Outros") : "--";
    }
    if (insightTopCategoryMeta) {
      insightTopCategoryMeta.textContent = topCategoryB ? fmtBRL(topCategoryB.total) : "--";
    }

    if (avgData && insightVsAvg && insightVsAvgMeta) {
      const avgExpenses = (Number(avgData.summary?.despesas) || 0) / 3;
      const currExpenses = Number(dataB.summary?.despesas) || 0;
      const diff = currExpenses - avgExpenses;
      const sign = diff >= 0 ? "+" : "-";
      insightVsAvg.textContent = `${sign}${fmtBRL(Math.abs(diff))}`;
      const pct = avgExpenses ? Math.abs(diff / avgExpenses) * 100 : 0;
      insightVsAvgMeta.textContent = `Média 3 meses: ${fmtBRL(avgExpenses)} (${pct.toFixed(1)}%)`;
    } else if (insightVsAvg && insightVsAvgMeta) {
      insightVsAvg.textContent = "--";
      insightVsAvgMeta.textContent = "--";
    }

    renderInsightChanges(insightChanges, deltas);
  }

  function updateCompareSummary(dataA, dataB) {
    const summaryA = dataA?.summary || {};
    const summaryB = dataB?.summary || {};

    const receitasA = Number(summaryA.receitas || 0);
    const receitasB = Number(summaryB.receitas || 0);
    const despesasA = Number(summaryA.despesas || 0);
    const despesasB = Number(summaryB.despesas || 0);
    const saldoA = Number(summaryA.saldo_projetado || 0);
    const saldoB = Number(summaryB.saldo_projetado || 0);
    const countValueA = Number(summaryA.entradas || 0);
    const countValueB = Number(summaryB.entradas || 0);

    if (receiptsA) receiptsA.textContent = fmtBRL(receitasA);
    if (receiptsB) receiptsB.textContent = fmtBRL(receitasB);
    if (expensesA) expensesA.textContent = fmtBRL(despesasA);
    if (expensesB) expensesB.textContent = fmtBRL(despesasB);
    if (balanceA) balanceA.textContent = fmtBRL(saldoA);
    if (balanceB) balanceB.textContent = fmtBRL(saldoB);
    if (countA) countA.textContent = fmtCount(countValueA);
    if (countB) countB.textContent = fmtCount(countValueB);

    setDelta(receiptsDelta, receitasA, receitasB, true);
    setDelta(expensesDelta, despesasA, despesasB, true);
    setDelta(balanceDelta, saldoA, saldoB, true);
    setDelta(countDelta, countValueA, countValueB, false);
  }

  function resetInsights() {
    if (receiptsA) receiptsA.textContent = "R$ 0,00";
    if (receiptsB) receiptsB.textContent = "R$ 0,00";
    if (expensesA) expensesA.textContent = "R$ 0,00";
    if (expensesB) expensesB.textContent = "R$ 0,00";
    if (balanceA) balanceA.textContent = "R$ 0,00";
    if (balanceB) balanceB.textContent = "R$ 0,00";
    if (countA) countA.textContent = "0 lançamentos";
    if (countB) countB.textContent = "0 lançamentos";

    if (receiptsDelta) receiptsDelta.textContent = "R$ 0,00 (0%)";
    if (expensesDelta) expensesDelta.textContent = "R$ 0,00 (0%)";
    if (balanceDelta) balanceDelta.textContent = "R$ 0,00 (0%)";
    if (countDelta) countDelta.textContent = "0 (0%)";

    if (receiptsDelta) receiptsDelta.classList.remove("is-positive", "is-negative");
    if (expensesDelta) expensesDelta.classList.remove("is-positive", "is-negative");
    if (balanceDelta) balanceDelta.classList.remove("is-positive", "is-negative");
    if (countDelta) countDelta.classList.remove("is-positive", "is-negative");

    if (insightTopUp) insightTopUp.textContent = "--";
    if (insightTopUpMeta) insightTopUpMeta.textContent = "--";
    if (insightTopDown) insightTopDown.textContent = "--";
    if (insightTopDownMeta) insightTopDownMeta.textContent = "--";
    if (insightTopCategory) insightTopCategory.textContent = "--";
    if (insightTopCategoryMeta) insightTopCategoryMeta.textContent = "--";
    if (insightVsAvg) insightVsAvg.textContent = "--";
    if (insightVsAvgMeta) insightVsAvgMeta.textContent = "--";

    renderCategories(categoriesA, [], 0);
    renderCategories(categoriesB, [], 0);
    renderCompareBars([], []);
    renderInsightChanges(insightChanges, []);
    renderTopEntries(topIncomeList, [], "receita");
    renderTopEntries(topExpenseList, [], "despesa");
  }

  async function fetchPeriod(start, end) {
    const url = `/app/insights/data?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Erro ao carregar dados");
    return res.json();
  }

  async function fetchAverage3Months(endDateStr) {
    if (!endDateStr) return null;
    const end = new Date(endDateStr);
    if (Number.isNaN(end.getTime())) return null;
    const start = new Date(end.getFullYear(), end.getMonth() - 2, 1);
    const endRange = new Date(end.getFullYear(), end.getMonth() + 1, 0);
    return fetchPeriod(formatDate(start), formatDate(endRange));
  }

  async function loadInsights(year, month) {
    const hasSection = receiptsA || insightTopUp || compareBars;
    if (!hasSection) return;

    showInsightError("");

    const currentYear = Number(year) || new Date().getFullYear();
    const currentMonth = Number(month) || (new Date().getMonth() + 1);
    const prev = getPrevMonth(currentYear, currentMonth);
    const rangeA = monthRange(prev.year, prev.month);
    const rangeB = monthRange(currentYear, currentMonth);

    if (insightPeriodLabel) {
      insightPeriodLabel.textContent = `${formatMonthLabel(currentYear, currentMonth)} vs ${formatMonthLabel(prev.year, prev.month)}`;
    }

    try {
      const [dataA, dataB] = await Promise.all([
        fetchPeriod(formatDate(rangeA.start), formatDate(rangeA.end)),
        fetchPeriod(formatDate(rangeB.start), formatDate(rangeB.end))
      ]);
      const avgData = await fetchAverage3Months(formatDate(rangeB.end));

      updateCompareSummary(dataA, dataB);
      renderCategories(categoriesA, dataA.categories || [], Number(dataA.summary?.despesas || 0));
      renderCategories(categoriesB, dataB.categories || [], Number(dataB.summary?.despesas || 0));
      renderCompareBars(dataA.categories || [], dataB.categories || []);
      renderInsights(dataA, dataB, avgData);
      renderTopEntries(topIncomeList, dataB.top_entries || [], "receita");
      renderTopEntries(topExpenseList, dataB.top_entries || [], "despesa");
    } catch (err) {
      resetInsights();
      showInsightError("Não foi possível carregar os insights. Tente novamente.");
    }
  }

  function getGoalPeriodStorageKey(periodKey) {
    return `chartsGoalPeriod:${periodKey}`;
  }

  function getGoalValueStorageKey(periodKey, periodType) {
    return `chartsGoalValue:${periodKey}:${periodType}`;
  }

  function readGoalPeriod(periodKey) {
    return safeStorageGet(getGoalPeriodStorageKey(periodKey)) || "monthly";
  }

  function writeGoalPeriod(periodKey, value) {
    safeStorageSet(getGoalPeriodStorageKey(periodKey), value);
  }

  function readGoalValue(periodKey, periodType) {
    const raw = safeStorageGet(getGoalValueStorageKey(periodKey, periodType));
    const num = Number(raw);
    return Number.isFinite(num) ? num : 0;
  }

  function writeGoalValue(periodKey, periodType, value) {
    safeStorageSet(getGoalValueStorageKey(periodKey, periodType), value ? String(value) : "");
  }

  function syncGoalControls(period) {
    if (!goalPeriod || !goalCustom) return;
    const periodKey = getPeriodKey(period);
    const storedPeriod = readGoalPeriod(periodKey);
    if (goalPeriod.value !== storedPeriod) {
      goalPeriod.value = storedPeriod;
      goalPeriod._customUpdate?.();
    }
    const storedValue = readGoalValue(periodKey, storedPeriod);
    if (document.activeElement !== goalCustom) {
      goalCustom.value = storedValue > 0 ? fmtBRL(storedValue) : "";
    }
  }

  function updateGoals(summary, line, period) {
    if (!goalSavingsLabel || !goalSavingsBar || !goalSavingsMeta) return;
    const periodKey = getPeriodKey(period);
    const periodType = goalPeriod ? (goalPeriod.value || readGoalPeriod(periodKey)) : readGoalPeriod(periodKey);
    const days = getDaysInPeriod(period, line.labels || []);
    const periodCount = getPeriodCount(days, periodType);

    const receitas = Number(summary.receitas || 0);
    const saldoTotal = Number(summary.saldo_projetado || 0);
    const periodReceitas = periodCount ? receitas / periodCount : receitas;
    const periodSaldo = periodCount ? saldoTotal / periodCount : saldoTotal;
    const saldo = Math.max(periodSaldo, 0);

    const suggested = periodReceitas * 0.2;
    const custom = readGoalValue(periodKey, periodType);
    const target = custom > 0 ? custom : suggested;
    const pct = target ? Math.min(100, (saldo / target) * 100) : 0;

    goalSavingsLabel.textContent = `${fmtBRL(saldo)} / ${fmtBRL(target)}`;
    goalSavingsBar.style.width = `${pct.toFixed(0)}%`;

    if (receitas > 0) {
      const label = getPeriodLabel(periodType);
      goalSavingsMeta.textContent = `Meta sugerida ${label}: ${fmtBRL(suggested)} (20% das receitas).`;
    } else {
      goalSavingsMeta.textContent = "Sem dados para estimar a meta.";
    }
  }

  function updateUI(data) {
    lastData = data;
    const summary = data.summary || {};
    const highlights = data.highlights || {};
    const line = data.line || {};

    summaryReceitas.textContent = fmtBRL(summary.receitas);
    summaryDespesas.textContent = fmtBRL(summary.despesas);
    summarySaldo.textContent = fmtBRL(summary.saldo_projetado);
    if (summarySaldoMeta) {
      summarySaldoMeta.textContent = summary.saldo_projetado >= 0 ? "Resultado do período" : "Saldo negativo";
    }
    summaryCount.textContent = `${summary.entradas || 0} lançamentos`;
    summaryCountMeta.textContent = `${summary.receitas_count || 0} receitas · ${summary.despesas_count || 0} despesas`;

    const updatedText = fmtDateShort(data.updated_at);
    noteUpdated.textContent = updatedText === "agora" ? "Atualizado agora" : `Atualizado em ${updatedText}`;
    noteBalance.textContent = `Saldo anterior: ${fmtBRL(summary.saldo_anterior)}`;

    kpiBestWeek.textContent = fmtBRL(highlights.best_week_total);
    kpiBestWeekLabel.textContent = highlights.best_week_label || "-";
    kpiTopExpense.textContent = fmtBRL(highlights.top_expense_total);
    kpiTopExpenseLabel.textContent = highlights.top_expense_label || "-";
    kpiBalance.textContent = `${Number(highlights.equilibrio || 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
    kpiBalanceLabel.textContent = "Despesas / receitas";

    const hasData = (summary.entradas || 0) > 0;
    setEmptyState(lineCanvas, !hasData);
    const balanceSeries = (line.saldo_acumulado && line.saldo_acumulado.length)
      ? line.saldo_acumulado
      : (line.saldo || []);
    const lineSeries = {
      receitas: line.receitas || [],
      despesas: line.despesas || [],
      saldo: balanceSeries
    };
    const chartInfo = updateLineChart(lineSeries);
    if (hasData && chartInfo) {
      const lineLength = lineSeries.receitas.length || lineSeries.despesas.length || lineSeries.saldo.length;
      lineState = {
        series: lineSeries,
        labels: line.labels || [],
        period: data.period || null,
        builder: chartInfo.builder,
        width: chartInfo.width,
        height: chartInfo.height,
        padding: chartInfo.padding,
        length: lineLength
      };
    } else {
      lineState = null;
      hideLineHover();
    }

    updateDonut(data.categories || [], Number(summary.despesas || 0));
    updateStatusBars(data.statuses || {}, Number(summary.despesas || 0));
    updateCategoryBars(data.categories || [], Number(summary.despesas || 0));
    updateAlerts(data.alerts || []);
    syncGoalControls(data.period || null);
    updateGoals(summary, line, data.period || null);
  }

  async function loadData() {
    const year = yearSelect?.value;
    const month = monthSelect?.value;
    const url = `/app/charts/data?year=${encodeURIComponent(year)}&month=${encodeURIComponent(month)}`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("Erro ao carregar dados");
      const data = await res.json();
      updateUI(data);
      await loadInsights(year, month);
    } catch (err) {
      if (noteUpdated) noteUpdated.textContent = "Erro ao carregar dados";
      if (alertsList) alertsList.innerHTML = "<li>Não foi possível carregar os gráficos.</li>";
      setEmptyState(lineCanvas, true);
      setEmptyState(donutCanvas, true);
      setEmptyState(barsCanvas, true);
      setEmptyState(categoriesBars, true);
      lineState = null;
      lastData = null;
      hideLineHover();
      resetInsights();
      showInsightError("Nao foi possivel carregar os insights.");
    }
  }

  const now = new Date();
  if (yearSelect) {
    const yearValue = String(now.getFullYear());
    if (Array.from(yearSelect.options).some(opt => opt.value === yearValue)) {
      yearSelect.value = yearValue;
    }
  }
  if (monthSelect) {
    monthSelect.value = String(now.getMonth() + 1);
  }

  [yearSelect, monthSelect, goalPeriod].forEach(initCustomSelect);

  yearSelect?.addEventListener("change", loadData);
  monthSelect?.addEventListener("change", loadData);
  goalPeriod?.addEventListener("change", () => {
    if (!lastData) return;
    const periodKey = getPeriodKey(lastData.period || null);
    writeGoalPeriod(periodKey, goalPeriod.value);
    syncGoalControls(lastData.period || null);
    updateGoals(lastData.summary || {}, lastData.line || {}, lastData.period || null);
  });
  goalCustom?.addEventListener("input", () => {
    if (!lastData) return;
    const periodKey = getPeriodKey(lastData.period || null);
    const periodType = goalPeriod ? goalPeriod.value : readGoalPeriod(periodKey);
    const value = parseBRL(goalCustom.value);
    writeGoalValue(periodKey, periodType, value);
    updateGoals(lastData.summary || {}, lastData.line || {}, lastData.period || null);
  });
  goalCustom?.addEventListener("blur", () => {
    if (!lastData || !goalCustom) return;
    const periodKey = getPeriodKey(lastData.period || null);
    const periodType = goalPeriod ? goalPeriod.value : readGoalPeriod(periodKey);
    const value = readGoalValue(periodKey, periodType);
    goalCustom.value = value > 0 ? fmtBRL(value) : "";
  });
  if (lineCanvas) {
    lineCanvas.addEventListener("mousemove", updateLineHover);
    lineCanvas.addEventListener("mouseleave", hideLineHover);
  }

  loadData();
})();
