(function () {
  const yearSelect = document.getElementById("insight-year");
  const monthSelect = document.getElementById("insight-month");
  const errorBox = document.getElementById("insight-error");
  const periodLabel = document.getElementById("insight-period-label");

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

  if (!yearSelect || !monthSelect || !receiptsA) return;

  const CATEGORY_LABELS = {
    salario: "Salário",
    extras: "Extras",
    moradia: "Moradia",
    mercado: "Mercado",
    transporte: "Transporte",
    servicos: "Serviços",
    outros: "Outros"
  };

  const MESES = [
    "Janeiro",
    "Fevereiro",
    "Março",
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

  function formatMonthLabel(year, month) {
    const y = Number(year) || new Date().getFullYear();
    const m = Number(month) || (new Date().getMonth() + 1);
    const name = MESES[m - 1] || "Mês";
    return `${name} ${y}`;
  }

  function fmtBRL(value) {
    const val = Number(value) || 0;
    return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
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

  function showError(message) {
    if (!errorBox) return;
    if (message) {
      errorBox.textContent = message;
      errorBox.style.display = "block";
    } else {
      errorBox.textContent = "";
      errorBox.style.display = "none";
    }
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

  async function loadInsights() {
    showError("");

    const currentYear = Number(yearSelect.value) || new Date().getFullYear();
    const currentMonth = Number(monthSelect.value) || (new Date().getMonth() + 1);
    const prev = getPrevMonth(currentYear, currentMonth);
    const rangeA = monthRange(prev.year, prev.month);
    const rangeB = monthRange(currentYear, currentMonth);

    if (periodLabel) {
      periodLabel.textContent = `${formatMonthLabel(currentYear, currentMonth)} vs ${formatMonthLabel(prev.year, prev.month)}`;
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
      showError("Não foi possível carregar os insights. Tente novamente.");
    }
  }

  const now = new Date();
  const yearValue = String(now.getFullYear());
  if (Array.from(yearSelect.options).some(opt => opt.value === yearValue)) {
    yearSelect.value = yearValue;
  }
  monthSelect.value = String(now.getMonth() + 1);

  yearSelect.addEventListener("change", loadInsights);
  monthSelect.addEventListener("change", loadInsights);

  loadInsights();
})();
