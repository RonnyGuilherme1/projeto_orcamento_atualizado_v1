(function () {
  const page = document.querySelector(".charts-page");
  if (!page) return;

  const yearSelect = document.getElementById("chart-year");
  const monthSelect = document.getElementById("chart-month");

  const summaryReceitas = document.getElementById("summary-receitas");
  const summaryReceitasMeta = document.getElementById("summary-receitas-meta");
  const summaryDespesas = document.getElementById("summary-despesas");
  const summaryDespesasMeta = document.getElementById("summary-despesas-meta");
  const summarySaldo = document.getElementById("summary-saldo");
  const summarySaldoMeta = document.getElementById("summary-saldo-meta");
  const summaryCount = document.getElementById("summary-count");
  const summaryCountMeta = document.getElementById("summary-count-meta");

  const noteUpdated = document.getElementById("chart-note-updated");
  const noteBalance = document.getElementById("chart-note-balance");
  const noteCompare = document.getElementById("chart-note-compare");

  const lineCanvas = document.querySelector(".chart-line");
  const donutCanvas = document.querySelector(".donut-wrap");
  const barsCanvas = document.querySelector(".bars");

  const lineIncome = document.querySelector('[data-line="income"]');
  const lineExpense = document.querySelector('[data-line="expense"]');
  const lineBalance = document.querySelector('[data-line="balance"]');
  const areaIncome = document.querySelector('[data-area="income"]');
  const areaExpense = document.querySelector('[data-area="expense"]');
  const pointIncome = document.querySelector('[data-point="income"]');
  const pointExpense = document.querySelector('[data-point="expense"]');
  const pointBalance = document.querySelector('[data-point="balance"]');

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
  const goalExpensesLabel = document.getElementById("goal-expenses-label");
  const goalExpensesBar = document.getElementById("goal-expenses-bar");
  const goalExpensesMeta = document.getElementById("goal-expenses-meta");

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

  function fmtBRL(value) {
    const num = Number(value) || 0;
    return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function fmtPct(value) {
    if (value === null || typeof value === "undefined") return "Sem comparativo";
    const num = Number(value) || 0;
    const sign = num > 0 ? "+" : "";
    const text = num.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
    return `${sign}${text}% vs mês anterior`;
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
  }

  function updateDonut(categories, total) {
    if (!donut) return;
    const hasData = total > 0 && categories.length > 0;
    setEmptyState(donutCanvas, !hasData);

    donutTotal.textContent = fmtBRL(total);
    donutLabel.textContent = total > 0 ? "Total de despesas" : "Sem despesas";

    if (!hasData) {
      donut.style.removeProperty("--donut-gradient");
      donutLegend.innerHTML = "<li>Sem despesas no período.</li>";
      return;
    }

    const totalValue = categories.reduce((sum, item) => sum + (Number(item.total) || 0), 0) || 0;
    let acc = 0;
    const stops = categories.map((item) => {
      const part = totalValue ? (Number(item.total) / totalValue) * 100 : 0;
      const start = acc;
      acc += part;
      const color = CATEGORY_COLORS[item.key] || "var(--cat-other)";
      return `${color} ${start.toFixed(1)}% ${acc.toFixed(1)}%`;
    });

    donut.style.setProperty("--donut-gradient", stops.join(", "));

    donutLegend.innerHTML = categories.map((item) => {
      const label = CATEGORY_LABELS[item.key] || item.label || "Outros";
      const dotClass = CATEGORY_DOTS[item.key] || "dot-other";
      const pct = Number(item.percent) || 0;
      return `<li><span class="legend-dot ${dotClass}"></span>${label} ${pct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</li>`;
    }).join("");
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

  function updateInsights(alerts, summary) {
    if (!alertsList) return;
    const list = (alerts || []).length ? alerts : ["Sem dados para gerar alertas."];
    alertsList.innerHTML = list.map(item => `<li>${item}</li>`).join("");

    const receitas = Number(summary.receitas || 0);
    const saldo = Math.max(Number(summary.saldo_projetado || 0), 0);
    const despesas = Number(summary.despesas || 0);

    if (receitas > 0) {
      const meta = Math.max(receitas * 0.2, saldo);
      const pct = meta ? Math.min(100, (saldo / meta) * 100) : 0;
      goalSavingsLabel.textContent = `${fmtBRL(saldo)} / ${fmtBRL(meta)}`;
      goalSavingsBar.style.width = `${pct.toFixed(0)}%`;
      goalSavingsMeta.textContent = "Meta sugerida: 20% das receitas.";
    } else {
      goalSavingsLabel.textContent = "R$ 0,00 / R$ 0,00";
      goalSavingsBar.style.width = "0%";
      goalSavingsMeta.textContent = "Sem dados para estimar a meta.";
    }

    if (receitas > 0) {
      const limite = receitas * 0.8;
      const pct = limite ? Math.min(100, (despesas / limite) * 100) : 0;
      goalExpensesLabel.textContent = `${fmtBRL(despesas)} / ${fmtBRL(limite)}`;
      goalExpensesBar.style.width = `${pct.toFixed(0)}%`;
      goalExpensesMeta.textContent = "Limite sugerido: 80% das receitas.";
    } else {
      goalExpensesLabel.textContent = "R$ 0,00 / R$ 0,00";
      goalExpensesBar.style.width = "0%";
      goalExpensesMeta.textContent = "Sem dados para definir o limite.";
    }
  }

  function updateUI(data) {
    const summary = data.summary || {};
    const compare = data.compare || {};
    const highlights = data.highlights || {};
    const line = data.line || {};

    summaryReceitas.textContent = fmtBRL(summary.receitas);
    summaryReceitasMeta.textContent = fmtPct(compare.receitas_pct);
    summaryDespesas.textContent = fmtBRL(summary.despesas);
    summaryDespesasMeta.textContent = fmtPct(compare.despesas_pct);
    summarySaldo.textContent = fmtBRL(summary.saldo_projetado);
    summarySaldoMeta.textContent = summary.saldo_projetado >= 0 ? "Fechamento estimado" : "Saldo negativo";
    summaryCount.textContent = `${summary.entradas || 0} lançamentos`;
    summaryCountMeta.textContent = `${summary.receitas_count || 0} receitas · ${summary.despesas_count || 0} despesas`;

    const updatedText = fmtDateShort(data.updated_at);
    noteUpdated.textContent = updatedText === "agora" ? "Atualizado agora" : `Atualizado em ${updatedText}`;
    noteBalance.textContent = `Saldo anterior: ${fmtBRL(summary.saldo_anterior)}`;
    noteCompare.textContent = (compare.receitas_pct !== null || compare.despesas_pct !== null)
      ? compare.label
      : "Comparativo indisponível";

    kpiBestWeek.textContent = fmtBRL(highlights.best_week_total);
    kpiBestWeekLabel.textContent = highlights.best_week_label || "-";
    kpiTopExpense.textContent = fmtBRL(highlights.top_expense_total);
    kpiTopExpenseLabel.textContent = highlights.top_expense_label || "-";
    kpiBalance.textContent = `${Number(highlights.equilibrio || 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
    kpiBalanceLabel.textContent = "Receitas x despesas";

    const hasData = (summary.entradas || 0) > 0;
    setEmptyState(lineCanvas, !hasData);
    updateLineChart({
      receitas: line.receitas || [],
      despesas: line.despesas || [],
      saldo: (line.saldo_acumulado && line.saldo_acumulado.length)
        ? line.saldo_acumulado
        : (line.saldo || [])
    });

    updateDonut(data.categories || [], Number(summary.despesas || 0));
    updateStatusBars(data.statuses || {}, Number(summary.despesas || 0));
    updateInsights(data.alerts || [], summary);
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
    } catch (err) {
      if (noteUpdated) noteUpdated.textContent = "Erro ao carregar dados";
      if (alertsList) alertsList.innerHTML = "<li>Não foi possível carregar os gráficos.</li>";
      setEmptyState(lineCanvas, true);
      setEmptyState(donutCanvas, true);
      setEmptyState(barsCanvas, true);
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

  yearSelect?.addEventListener("change", loadData);
  monthSelect?.addEventListener("change", loadData);

  loadData();
})();
