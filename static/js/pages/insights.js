(function () {
  const yearSelect = document.getElementById("insight-year");
  const monthSelect = document.getElementById("insight-month");
  const compareSelect = document.getElementById("insight-compare");
  const customRange = document.getElementById("insight-custom-range");
  const customStart = document.getElementById("insight-custom-start");
  const customEnd = document.getElementById("insight-custom-end");
  const errorBox = document.getElementById("insight-error");
  const periodLabel = document.getElementById("insight-period-label");
  const rangeCurrent = document.getElementById("insight-range-current");
  const rangeBase = document.getElementById("insight-range-base");
  const updatedLabel = document.getElementById("insight-updated");

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
  const insightTopUpAction = document.getElementById("insight-top-up-action");
  const insightTopDownAction = document.getElementById("insight-top-down-action");
  const insightTopCategoryAction = document.getElementById("insight-top-category-action");
  const insightVsAvgAction = document.getElementById("insight-vs-avg-action");
  const insightChanges = document.getElementById("insight-changes");
  const insightExplainedTotal = document.getElementById("insight-explained-total");
  const topIncomeList = document.getElementById("insight-top-income");
  const topExpenseList = document.getElementById("insight-top-expense");

  if (!yearSelect || !monthSelect || !receiptsA) return;

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

  function syncCustomSelect(selectEl) {
    if (selectEl && typeof selectEl._customUpdate === "function") {
      selectEl._customUpdate();
    }
  }

  [yearSelect, monthSelect, compareSelect].forEach(initCustomSelect);

  let currentRange = null;

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

  function formatDisplayDate(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "--";
    return date.toLocaleDateString("pt-BR");
  }

  function formatRangeDisplay(start, end) {
    return `${formatDisplayDate(start)}–${formatDisplayDate(end)}`;
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

  function getPreviousMonths(year, month, count) {
    const list = [];
    let y = Number(year) || new Date().getFullYear();
    let m = Number(month) || (new Date().getMonth() + 1);
    for (let i = 0; i < count; i += 1) {
      const prev = getPrevMonth(y, m);
      list.push(prev);
      y = prev.year;
      m = prev.month;
    }
    return list;
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

  function setDelta(el, baseValue, currentValue, options = {}) {
    if (!el) return;
    const {
      isCurrency = true,
      goodIfIncrease = true,
      allowPercent = true,
      minBase = 200
    } = options;
    const base = Number(baseValue) || 0;
    const current = Number(currentValue) || 0;
    const diff = current - base;
    const absDiff = Math.abs(diff);
    const sign = diff > 0 ? "+" : diff < 0 ? "-" : "";
    const arrow = diff > 0 ? "↑" : diff < 0 ? "↓" : "•";
    const valueText = isCurrency ? fmtBRL(absDiff) : absDiff.toLocaleString("pt-BR");

    let percentText = "—";
    const signFlip = base !== 0 && current !== 0 && base * current < 0;
    const showPercent = allowPercent && Math.abs(base) >= minBase && !signFlip;
    if (showPercent) {
      const pct = base ? (absDiff / Math.abs(base)) * 100 : 0;
      percentText = `${sign}${pct.toFixed(1)}%`;
    }

    let suffix = "";
    if (signFlip) {
      suffix = current >= 0 ? "Virou positivo" : "Virou negativo";
    }

    const parts = [`${arrow} ${sign}${valueText}`];
    if (allowPercent) {
      parts.push(`(${percentText})`);
    }
    if (suffix) {
      parts.push(`• ${suffix}`);
    }
    el.textContent = parts.join(" ");

    el.classList.remove("is-positive", "is-negative");
    if (goodIfIncrease === null || diff === 0) return;
    const isGood = diff > 0 ? goodIfIncrease : !goodIfIncrease;
    el.classList.toggle("is-positive", isGood);
    el.classList.toggle("is-negative", !isGood);
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

  async function fetchMonthData(year, month) {
    const range = monthRange(year, month);
    return fetchPeriod(formatDate(range.start), formatDate(range.end));
  }

  function averageDatas(list) {
    if (!list || !list.length) return null;
    const count = list.length;
    const summaryKeys = [
      "receitas",
      "despesas",
      "saldo_projetado",
      "entradas",
      "receitas_count",
      "despesas_count"
    ];
    const summary = {};
    summaryKeys.forEach((key) => {
      const total = list.reduce((sum, item) => sum + (Number(item.summary?.[key]) || 0), 0);
      summary[key] = total / count;
    });

    const catTotals = new Map();
    list.forEach((item) => {
      (item.categories || []).forEach((cat) => {
        if (!cat?.key) return;
        const existing = catTotals.get(cat.key) || {
          key: cat.key,
          label: CATEGORY_LABELS[cat.key] || cat.label || "Outros",
          total: 0
        };
        existing.total += Number(cat.total) || 0;
        catTotals.set(cat.key, existing);
      });
    });

    const categories = Array.from(catTotals.values()).map((item) => ({
      key: item.key,
      label: item.label,
      total: item.total / count
    }));

    return {
      summary,
      categories,
      top_entries: []
    };
  }

  async function fetchAverageMonths(year, month, count) {
    const months = [];
    let y = Number(year);
    let m = Number(month);
    for (let i = 0; i < count; i += 1) {
      const prev = getPrevMonth(y, m);
      months.push(prev);
      y = prev.year;
      m = prev.month;
    }
    const dataList = await Promise.all(months.map((ref) => fetchMonthData(ref.year, ref.month)));
    return averageDatas(dataList);
  }

  function renderCategories(listEl, categories, total, deltaMap, direction) {
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
      let deltaText = "";
      if (deltaMap && item.key && deltaMap.has(item.key)) {
        const delta = deltaMap.get(item.key);
        const raw = direction === "a" ? -delta : delta;
        const sign = raw > 0 ? "+" : raw < 0 ? "-" : "";
        deltaText = ` • Δ ${sign}${fmtBRL(Math.abs(raw))}`;
      }
      return `<li>
        <span>${label}</span>
        <span class="item-meta">${fmtBRL(value)} - ${pct.toFixed(1)}%${deltaText}</span>
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

  function statusLabel(status) {
    if (!status) return "";
    if (status === "pago") return "Pago";
    if (status === "em_andamento") return "Em andamento";
    if (status === "nao_pago") return "Não pago";
    if (status === "atrasado") return "Atrasado";
    return String(status);
  }

  function formatEntryDate(value) {
    if (!value) return "";
    const text = String(value);
    const parts = text.split("-");
    if (parts.length >= 3) {
      return `${parts[2].slice(0, 2)}/${parts[1]}/${parts[0]}`;
    }
    return text;
  }

  function buildEntriesLink(params) {
    const url = new URL("/app/entradas", window.location.origin);
    Object.entries(params || {}).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") return;
      url.searchParams.set(key, String(value));
    });
    const query = url.searchParams.toString();
    return query ? `${url.pathname}?${query}` : url.pathname;
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
      const date = formatEntryDate(item.date);
      const status = tipo === "despesa" ? statusLabel(item.status) : "";
      const metaParts = [cat, fmtBRL(item.value)];
      if (date) metaParts.unshift(date);
      if (status) metaParts.push(status);
      return `<li>
        <span>${label}</span>
        <span class="item-meta">${metaParts.join(" • ")}</span>
      </li>`;
    }).join("");
  }

  function renderCompareBars(catA, catB) {
    if (!compareBars) return;
    const deltas = computeCategoryDeltas(catA || [], catB || []).slice(0, 6);

    if (!deltas.length) {
      compareBars.innerHTML = '<div class="compare-empty">Sem despesas suficientes para comparar.</div>';
      return;
    }

    const maxDelta = Math.max(...deltas.map(item => Math.abs(item.delta)), 1);

    compareBars.innerHTML = deltas.map((item) => {
      const width = Math.min(50, (Math.abs(item.delta) / maxDelta) * 50);
      const isPositive = item.delta > 0;
      const sign = isPositive ? "+" : "-";
      const valueText = `${sign}${fmtBRL(Math.abs(item.delta))}`;
      return `<div class="compare-bar-row delta-row">
        <span class="compare-bar-label">${item.label}</span>
        <div class="compare-bar-track delta-track">
          <div class="compare-bar delta-bar ${isPositive ? "is-positive" : "is-negative"}" style="width:${width.toFixed(1)}%"></div>
        </div>
        <div class="compare-bar-values">
          <span class="delta-value ${isPositive ? "is-positive" : "is-negative"}">${valueText}</span>
        </div>
      </div>`;
    }).join("");
  }

  function renderInsights(dataA, dataB, avgData) {
    if (!dataA || !dataB) return;
    const deltas = computeCategoryDeltas(dataA.categories || [], dataB.categories || []);
    const topUp = deltas.find(item => item.delta > 0);
    const topDown = deltas.filter(item => item.delta < 0).sort((a, b) => a.delta - b.delta)[0];
    const topCategoryB = (dataB.categories || []).slice().sort((a, b) => (b.total || 0) - (a.total || 0))[0];
    const periodParams = currentRange
      ? { start: formatDate(currentRange.start), end: formatDate(currentRange.end) }
      : {};

    if (insightTopUp) insightTopUp.textContent = topUp ? topUp.label : "--";
    if (insightTopUpMeta) insightTopUpMeta.textContent = topUp ? `+${fmtBRL(Math.abs(topUp.delta))}` : "--";
    if (insightTopDown) insightTopDown.textContent = topDown ? topDown.label : "--";
    if (insightTopDownMeta) insightTopDownMeta.textContent = topDown ? `-${fmtBRL(Math.abs(topDown.delta))}` : "--";

    if (insightTopUpAction) {
      insightTopUpAction.style.display = topUp ? "inline-flex" : "none";
      insightTopUpAction.textContent = "Ver lançamentos";
      if (topUp?.key) {
        insightTopUpAction.href = buildEntriesLink({ type: "despesa", category: topUp.key, ...periodParams });
      }
    }
    if (insightTopDownAction) {
      insightTopDownAction.style.display = topDown ? "inline-flex" : "none";
      insightTopDownAction.textContent = "Ver lançamentos";
      if (topDown?.key) {
        insightTopDownAction.href = buildEntriesLink({ type: "despesa", category: topDown.key, ...periodParams });
      }
    }

    if (insightTopCategory) {
      insightTopCategory.textContent = topCategoryB ? (CATEGORY_LABELS[topCategoryB.key] || topCategoryB.label || "Outros") : "--";
    }
    if (insightTopCategoryMeta) {
      if (topCategoryB) {
        const totalExpenses = Number(dataB.summary?.despesas || 0);
        const pct = totalExpenses ? (Number(topCategoryB.total || 0) / totalExpenses) * 100 : 0;
        const isOutros = String(topCategoryB.key || "") === "outros";
        const extra = isOutros && pct >= 25 ? " • Outros alto" : "";
        insightTopCategoryMeta.textContent = `${fmtBRL(topCategoryB.total)} (${pct.toFixed(1)}%)${extra}`;
      } else {
        insightTopCategoryMeta.textContent = "--";
      }
    }
    if (insightTopCategoryAction) {
      if (topCategoryB?.key) {
        const isOutros = String(topCategoryB.key || "") === "outros";
        insightTopCategoryAction.style.display = "inline-flex";
        if (isOutros) {
          insightTopCategoryAction.textContent = "Criar regra";
          insightTopCategoryAction.href = "/app/filters";
        } else {
          insightTopCategoryAction.textContent = "Ver lançamentos";
          insightTopCategoryAction.href = buildEntriesLink({ type: "despesa", category: topCategoryB.key, ...periodParams });
        }
      } else if (insightTopCategoryAction) {
        insightTopCategoryAction.style.display = "none";
      }
    }

    if (avgData && insightVsAvg && insightVsAvgMeta) {
      const avgExpenses = Number(avgData.summary?.despesas) || 0;
      const currExpenses = Number(dataB.summary?.despesas) || 0;
      const diff = currExpenses - avgExpenses;
      const sign = diff >= 0 ? "+" : "-";
      insightVsAvg.textContent = `${sign}${fmtBRL(Math.abs(diff))}`;
      const pct = avgExpenses ? Math.abs(diff / avgExpenses) * 100 : 0;
      const direction = diff >= 0 ? "acima" : "abaixo";
      insightVsAvgMeta.textContent = `Você ficou ${direction} da média. Média 3 meses: ${fmtBRL(avgExpenses)} (${pct.toFixed(1)}%)`;
      if (insightVsAvgAction) {
        insightVsAvgAction.style.display = "inline-flex";
        insightVsAvgAction.textContent = "Ver lançamentos";
        insightVsAvgAction.href = buildEntriesLink({ type: "despesa", ...periodParams });
      }
    } else if (insightVsAvg && insightVsAvgMeta) {
      insightVsAvg.textContent = "--";
      insightVsAvgMeta.textContent = "--";
      if (insightVsAvgAction) insightVsAvgAction.style.display = "none";
    }

    renderInsightChanges(insightChanges, deltas);
    if (insightExplainedTotal) {
      const diff = (Number(dataB.summary?.despesas) || 0) - (Number(dataA.summary?.despesas) || 0);
      const sign = diff >= 0 ? "+" : "-";
      insightExplainedTotal.textContent = `${sign}${fmtBRL(Math.abs(diff))}`;
    }
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

    setDelta(receiptsDelta, receitasA, receitasB, { isCurrency: true, goodIfIncrease: true });
    setDelta(expensesDelta, despesasA, despesasB, { isCurrency: true, goodIfIncrease: false });
    setDelta(balanceDelta, saldoA, saldoB, { isCurrency: true, goodIfIncrease: true });
    setDelta(countDelta, countValueA, countValueB, { isCurrency: false, goodIfIncrease: null, allowPercent: false });
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
    if (insightTopUpAction) insightTopUpAction.style.display = "none";
    if (insightTopDownAction) insightTopDownAction.style.display = "none";
    if (insightTopCategoryAction) insightTopCategoryAction.style.display = "none";
    if (insightVsAvgAction) insightVsAvgAction.style.display = "none";
    if (insightExplainedTotal) insightExplainedTotal.textContent = "R$ 0,00";

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
    const rangeB = monthRange(currentYear, currentMonth);
    currentRange = rangeB;
    const compareMode = compareSelect?.value || "prev";

    if (customRange) {
      customRange.style.display = compareMode === "custom" ? "flex" : "none";
    }

    let rangeA = null;
    let baseLabel = "";
    let baseRangeLabel = "";
    let dataAPromise = null;

    if (compareMode === "avg3") {
      const prevMonths = getPreviousMonths(currentYear, currentMonth, 3);
      const oldest = prevMonths[prevMonths.length - 1];
      const newest = prevMonths[0];
      const startRange = monthRange(oldest.year, oldest.month);
      const endRange = monthRange(newest.year, newest.month);
      baseLabel = "Média 3 meses";
      baseRangeLabel = formatRangeDisplay(startRange.start, endRange.end);
      dataAPromise = fetchAverageMonths(currentYear, currentMonth, 3);
    } else if (compareMode === "yoy") {
      rangeA = monthRange(currentYear - 1, currentMonth);
      baseLabel = formatMonthLabel(currentYear - 1, currentMonth);
      baseRangeLabel = formatRangeDisplay(rangeA.start, rangeA.end);
      dataAPromise = fetchPeriod(formatDate(rangeA.start), formatDate(rangeA.end));
    } else if (compareMode === "custom") {
      const start = customStart?.value;
      const end = customEnd?.value;
      if (!start || !end || end < start) {
        resetInsights();
        showError("Selecione um período base válido para comparar.");
        return;
      }
      rangeA = { start: new Date(start), end: new Date(end) };
      baseLabel = "Período custom";
      baseRangeLabel = `${formatDisplayDate(rangeA.start)}–${formatDisplayDate(rangeA.end)}`;
      dataAPromise = fetchPeriod(start, end);
    } else {
      const prev = getPrevMonth(currentYear, currentMonth);
      rangeA = monthRange(prev.year, prev.month);
      baseLabel = formatMonthLabel(prev.year, prev.month);
      baseRangeLabel = formatRangeDisplay(rangeA.start, rangeA.end);
      dataAPromise = fetchPeriod(formatDate(rangeA.start), formatDate(rangeA.end));
    }

    if (periodLabel) {
      periodLabel.textContent = `${formatMonthLabel(currentYear, currentMonth)} vs ${baseLabel || "base"}`;
    }

    if (rangeCurrent) {
      rangeCurrent.textContent = `Período atual: ${formatRangeDisplay(rangeB.start, rangeB.end)}`;
    }
    if (rangeBase) {
      rangeBase.textContent = `Período base: ${baseRangeLabel || "--"}`;
    }
    if (updatedLabel) {
      const now = new Date();
      updatedLabel.textContent = `Atualizado: ${formatDisplayDate(now)}`;
    }

    try {
      const [dataA, dataB] = await Promise.all([
        dataAPromise,
        fetchPeriod(formatDate(rangeB.start), formatDate(rangeB.end))
      ]);
      const avgData = compareMode === "avg3" ? dataA : await fetchAverageMonths(currentYear, currentMonth, 3);
      const deltaMap = new Map((computeCategoryDeltas(dataA.categories || [], dataB.categories || [])).map(item => [item.key, item.delta]));

      updateCompareSummary(dataA, dataB);
      renderCategories(categoriesA, dataA.categories || [], Number(dataA.summary?.despesas || 0), deltaMap, "a");
      renderCategories(categoriesB, dataB.categories || [], Number(dataB.summary?.despesas || 0), deltaMap, "b");
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
  syncCustomSelect(yearSelect);
  syncCustomSelect(monthSelect);
  syncCustomSelect(compareSelect);

  yearSelect.addEventListener("change", loadInsights);
  monthSelect.addEventListener("change", loadInsights);
  compareSelect?.addEventListener("change", loadInsights);
  customStart?.addEventListener("change", () => {
    if (compareSelect?.value === "custom") loadInsights();
  });
  customEnd?.addEventListener("change", () => {
    if (compareSelect?.value === "custom") loadInsights();
  });

  loadInsights();
})();
