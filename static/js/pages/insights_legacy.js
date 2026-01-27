(function () {
  const periodEls = {
    a: {
      container: document.querySelector('.compare-period[data-period="a"]'),
      year: document.getElementById("compare-year-a"),
      month: document.getElementById("compare-month-a"),
      useRange: document.getElementById("compare-range-a"),
      start: document.getElementById("compare-start-a"),
      end: document.getElementById("compare-end-a")
    },
    b: {
      container: document.querySelector('.compare-period[data-period="b"]'),
      year: document.getElementById("compare-year-b"),
      month: document.getElementById("compare-month-b"),
      useRange: document.getElementById("compare-range-b"),
      start: document.getElementById("compare-start-b"),
      end: document.getElementById("compare-end-b")
    }
  };

  const swapBtn = document.getElementById("compare-swap");
  const errorBox = document.getElementById("compare-error");
  const compareBars = document.getElementById("compare-bars");

  if (!periodEls.a.year || !periodEls.a.month || !periodEls.b.year || !periodEls.b.month) return;

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

  const CATEGORY_LABELS = {
    salario: "Salario",
    extras: "Extras",
    moradia: "Moradia",
    mercado: "Mercado",
    transporte: "Transporte",
    servicos: "Servicos",
    outros: "Outros"
  };

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function formatDate(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function monthRange(year, month) {
    const y = Number(year) || new Date().getFullYear();
    const m = Number(month) || (new Date().getMonth() + 1);
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 0);
    return { start, end };
  }

  function fmtBRL(value) {
    const val = Number(value) || 0;
    return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function fmtCount(value) {
    const val = Number(value) || 0;
    return `${val} lancamentos`;
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

  function syncRangeState(key) {
    const state = periodEls[key];
    if (!state?.container || !state.useRange) return;
    state.container.classList.toggle("use-range", state.useRange.checked);
  }

  function resolvePeriod(key) {
    const state = periodEls[key];
    const useRange = state.useRange?.checked;

    if (useRange) {
      let startValue = state.start?.value;
      let endValue = state.end?.value;
      if (!startValue || !endValue) {
        const range = monthRange(state.year.value, state.month.value);
        startValue = formatDate(range.start);
        endValue = formatDate(range.end);
        if (state.start) state.start.value = startValue;
        if (state.end) state.end.value = endValue;
      }
      return { start: startValue, end: endValue, mode: "range" };
    }

    const range = monthRange(state.year.value, state.month.value);
    return { start: formatDate(range.start), end: formatDate(range.end), mode: "month" };
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
      listEl.innerHTML = "<li>Sem despesas no periodo</li>";
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
      listEl.innerHTML = "<li>Sem variacoes relevantes no periodo.</li>";
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
      listEl.innerHTML = "<li>Sem lancamentos no periodo.</li>";
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

    if (insightTopCategory) insightTopCategory.textContent = topCategoryB ? (CATEGORY_LABELS[topCategoryB.key] || topCategoryB.label || "Outros") : "--";
    if (insightTopCategoryMeta) insightTopCategoryMeta.textContent = topCategoryB ? fmtBRL(topCategoryB.total) : "--";

    if (avgData && insightVsAvg && insightVsAvgMeta) {
      const avgExpenses = (Number(avgData.summary?.despesas) || 0) / 3;
      const currExpenses = Number(dataB.summary?.despesas) || 0;
      const diff = currExpenses - avgExpenses;
      const sign = diff >= 0 ? "+" : "-";
      insightVsAvg.textContent = `${sign}${fmtBRL(Math.abs(diff))}`;
      const pct = avgExpenses ? Math.abs(diff / avgExpenses) * 100 : 0;
      insightVsAvgMeta.textContent = `Media 3 meses: ${fmtBRL(avgExpenses)} (${pct.toFixed(1)}%)`;
    } else if (insightVsAvg && insightVsAvgMeta) {
      insightVsAvg.textContent = "--";
      insightVsAvgMeta.textContent = "--";
    }

    renderInsightChanges(insightChanges, deltas);
  }

  async function loadCompare() {
    showError("");
    const periodA = resolvePeriod("a");
    const periodB = resolvePeriod("b");

    if (!periodA.start || !periodA.end || !periodB.start || !periodB.end) {
      showError("Preencha as datas de ambos os periodos.");
      return;
    }

    if (periodA.end < periodA.start || periodB.end < periodB.start) {
      showError("A data final deve ser maior ou igual a data inicial.");
      return;
    }

    try {
      const [dataA, dataB] = await Promise.all([
        fetchPeriod(periodA.start, periodA.end),
        fetchPeriod(periodB.start, periodB.end)
      ]);
      const avgData = await fetchAverage3Months(periodB.end);

      const summaryA = dataA.summary || {};
      const summaryB = dataB.summary || {};

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

      renderCategories(categoriesA, dataA.categories || [], despesasA);
      renderCategories(categoriesB, dataB.categories || [], despesasB);
      renderCompareBars(dataA.categories || [], dataB.categories || []);
      renderInsights(dataA, dataB, avgData);
      renderTopEntries(topIncomeList, dataB.top_entries || [], "receita");
      renderTopEntries(topExpenseList, dataB.top_entries || [], "despesa");
    } catch (err) {
      showError("Nao foi possivel carregar a comparacao. Tente novamente.");
    }
  }

  function setDefaults() {
    const now = new Date();
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    periodEls.a.year.value = String(now.getFullYear());
    periodEls.a.month.value = String(now.getMonth() + 1);
    periodEls.b.year.value = String(prev.getFullYear());
    periodEls.b.month.value = String(prev.getMonth() + 1);

    const rangeA = monthRange(periodEls.a.year.value, periodEls.a.month.value);
    const rangeB = monthRange(periodEls.b.year.value, periodEls.b.month.value);

    if (periodEls.a.start) periodEls.a.start.value = formatDate(rangeA.start);
    if (periodEls.a.end) periodEls.a.end.value = formatDate(rangeA.end);
    if (periodEls.b.start) periodEls.b.start.value = formatDate(rangeB.start);
    if (periodEls.b.end) periodEls.b.end.value = formatDate(rangeB.end);
  }

  function swapPeriods() {
    const swapValues = (key1, key2, field) => {
      const temp = periodEls[key1][field].value;
      periodEls[key1][field].value = periodEls[key2][field].value;
      periodEls[key2][field].value = temp;
    };

    swapValues("a", "b", "year");
    swapValues("a", "b", "month");
    if (periodEls.a.start && periodEls.b.start) swapValues("a", "b", "start");
    if (periodEls.a.end && periodEls.b.end) swapValues("a", "b", "end");

    if (periodEls.a.useRange && periodEls.b.useRange) {
      const tempChecked = periodEls.a.useRange.checked;
      periodEls.a.useRange.checked = periodEls.b.useRange.checked;
      periodEls.b.useRange.checked = tempChecked;
    }

    syncRangeState("a");
    syncRangeState("b");
    loadCompare();
  }

  ["a", "b"].forEach((key) => {
    const state = periodEls[key];
    state.useRange?.addEventListener("change", () => {
      syncRangeState(key);
      loadCompare();
    });
    state.year?.addEventListener("change", loadCompare);
    state.month?.addEventListener("change", loadCompare);
    state.start?.addEventListener("change", loadCompare);
    state.end?.addEventListener("change", loadCompare);
  });

  swapBtn?.addEventListener("click", swapPeriods);

  syncRangeState("a");
  syncRangeState("b");
  setDefaults();
  loadCompare();
})();
