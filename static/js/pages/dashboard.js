(function () {
  const cardsRoot = document.getElementById("cards");
  const filtroDe = document.getElementById("filtro-de");
  const filtroAte = document.getElementById("filtro-ate");
  const listaPeriodo = document.getElementById("lista-periodo");
  const totalReceitaEl = document.getElementById("total-receita");
  const totalDespesaEl = document.getElementById("total-despesa");
  const saldoPeriodoEl = document.getElementById("saldo-periodo");

  // Widgets (por plano)
  const wChartsIncome = document.getElementById("dash-charts-income");
  const wChartsExpense = document.getElementById("dash-charts-expense");
  const wChartsBalance = document.getElementById("dash-charts-balance");
  const wChartsPeriod = document.getElementById("dash-charts-period");
  const wChartsSpark = document.getElementById("dash-charts-spark");

  const wInsightsTopCat = document.getElementById("dash-insights-top-cat");
  const wInsightsTopExp = document.getElementById("dash-insights-top-exp");
  const wInsightsVar = document.getElementById("dash-insights-var");
  const wInsightsPeriod = document.getElementById("dash-insights-period");

  const wRulesActive = document.getElementById("dash-rules-active");
  const wRulesTotal = document.getElementById("dash-rules-total");
  const wRulesRuns = document.getElementById("dash-rules-runs");
  const wRulesLast = document.getElementById("dash-rules-last");

  const wProjSaldo = document.getElementById("dash-proj-saldo");
  const wProjPend = document.getElementById("dash-proj-pend");
  const wProjAte = document.getElementById("dash-proj-ate");
  const wProjRef = document.getElementById("dash-proj-ref");

  const wRepCount = document.getElementById("dash-rep-count");
  const wRepInc = document.getElementById("dash-rep-inc");
  const wRepExp = document.getElementById("dash-rep-exp");
  const wRepPeriod = document.getElementById("dash-rep-period");

  const chartsCard = document.querySelector('[data-card="charts"]');
  const chartRangeButtons = chartsCard ? chartsCard.querySelectorAll('[data-chart-range] .toggle-btn') : [];
  const chartSeriesButtons = chartsCard ? chartsCard.querySelectorAll('[data-chart-series] .toggle-btn') : [];
  const chartIncomeKpi = chartsCard ? chartsCard.querySelector('[data-kpi="income"]') : null;
  const chartExpenseKpi = chartsCard ? chartsCard.querySelector('[data-kpi="expense"]') : null;

  const insightsCard = document.querySelector('[data-card="insights"]');
  const insightsFeedback = document.getElementById("dash-insights-feedback");

  const rulesList = document.getElementById("dash-rules-list");
  const ruleNewBtn = document.getElementById("dash-rule-new");
  const ruleModal = document.getElementById("dash-rule-modal");
  const ruleForm = document.getElementById("dash-rule-form");
  const ruleCloseBtn = document.getElementById("dash-rule-close");
  const ruleCancelBtn = document.getElementById("dash-rule-cancel");
  const ruleNameInput = document.getElementById("dash-rule-name");
  const ruleMatchInput = document.getElementById("dash-rule-match");
  const ruleTypeSelect = document.getElementById("dash-rule-type");
  const ruleCategorySelect = document.getElementById("dash-rule-category");
  const ruleTagsInput = document.getElementById("dash-rule-tags");
  const ruleFeedback = document.getElementById("dash-rule-feedback");

  const projDelayInput = document.getElementById("dash-proj-delay");
  const projSplitInput = document.getElementById("dash-proj-split");
  const projSplitCountInput = document.getElementById("dash-proj-split-count");
  const projExtraInput = document.getElementById("dash-proj-extra");
  const projSimFeedback = document.getElementById("dash-proj-sim-feedback");
  const projResetBtn = document.getElementById("dash-proj-reset");
  const projSimButtons = document.querySelectorAll("[data-proj-sim]");

  const reportButtons = document.querySelectorAll("[data-report-export]");

  // Esta página não existe? Sai sem fazer nada.
  if (!cardsRoot && !filtroDe && !listaPeriodo) return;

  const meses = [
    "Janeiro", "Fevereiro", "Março",
    "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro",
    "Outubro", "Novembro", "Dezembro"
  ];

  let entradas = [];

  const chartsState = {
    range: 6,
    showIncome: true,
    showExpense: true,
    refYm: null,
  };

  const projectionState = {
    baseSaldo: 0,
    basePend: 0,
    adjustSaldo: 0,
    adjustPend: 0,
  };

  const mesesCurto = [
    "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
    "Jul", "Ago", "Set", "Out", "Nov", "Dez"
  ];

  function fmtBRL(valor) {
    const num = Number(valor) || 0;
    return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function fmtSignedBRL(valor) {
    const num = Number(valor) || 0;
    if (num === 0) return fmtBRL(0);
    const sign = num > 0 ? "+" : "-";
    return `${sign}${fmtBRL(Math.abs(num))}`;
  }

  function fmtBRDate(iso) {
    if (!iso) return "-";
    const s = String(iso);
    const d = s.slice(0, 10);
    if (d.length !== 10) return s;
    const [y, m, day] = d.split("-");
    if (!y || !m || !day) return s;
    return `${day}/${m}/${y}`;
  }

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function monthKey(dateObj) {
    const y = dateObj.getFullYear();
    const m = dateObj.getMonth() + 1;
    return `${y}-${pad2(m)}`;
  }

  function parseISODate(iso) {
    // iso esperado: YYYY-MM-DD
    if (!iso || String(iso).length < 10) return null;
    const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
  }

  function addMonths(key, delta) {
    // key: YYYY-MM
    const [yStr, mStr] = String(key).split("-");
    const y = Number(yStr);
    const m = Number(mStr);
    if (!y || !m) return key;
    const dt = new Date(y, m - 1, 1);
    dt.setMonth(dt.getMonth() + delta);
    return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}`;
  }

  function labelMonth(key) {
    const [yStr, mStr] = String(key).split("-");
    const y = Number(yStr);
    const m = Number(mStr);
    if (!y || !m) return "-";
    return `${meses[m - 1]} ${y}`;
  }

  function labelMonthShort(key) {
    const [yStr, mStr] = String(key).split("-");
    const y = Number(yStr);
    const m = Number(mStr);
    if (!y || !m) return "";
    return `${mesesCurto[m - 1]}`;
  }

  function sumMonth(ym) {
    let inc = 0;
    let exp = 0;
    let count = 0;
    entradas.forEach(e => {
      const d = String(e.data || "");
      if (d.slice(0, 7) !== ym) return;
      const v = Number(e.valor) || 0;
      count += 1;
      if (e.tipo === "receita") inc += v;
      if (e.tipo === "despesa") exp += v;
    });
    return { inc, exp, saldo: inc - exp, count };
  }

  function groupTopExpenseCategory(ym) {
    const map = new Map();
    entradas.forEach(e => {
      const d = String(e.data || "");
      if (d.slice(0, 7) !== ym) return;
      if (e.tipo !== "despesa") return;
      const cat = (e.categoria || "Outros").toString();
      const v = Number(e.valor) || 0;
      map.set(cat, (map.get(cat) || 0) + v);
    });
    let best = { cat: "-", total: 0 };
    for (const [cat, total] of map.entries()) {
      if (total > best.total) best = { cat, total };
    }
    return best;
  }

  function topExpenseEntry(ym) {
    let best = null;
    entradas.forEach(e => {
      const d = String(e.data || "");
      if (d.slice(0, 7) !== ym) return;
      if (e.tipo !== "despesa") return;
      const v = Number(e.valor) || 0;
      if (!best || v > (Number(best.valor) || 0)) {
        best = e;
      }
    });
    return best;
  }

  function pctChange(curr, prev) {
    const c = Number(curr) || 0;
    const p = Number(prev) || 0;
    if (p === 0) {
      if (c === 0) return null;
      return Infinity;
    }
    return ((c - p) / p) * 100;
  }

  function renderSpark(container, series) {
    // series: [{label, value, positive}]
    if (!container) return;
    container.innerHTML = "";
    const values = series.map(s => Math.abs(Number(s.value) || 0));
    const max = Math.max(...values, 1);

    series.forEach(s => {
      const bar = document.createElement("div");
      bar.className = `spark-bar ${s.value >= 0 ? "pos" : "neg"}`;
      bar.style.height = `${Math.max(8, Math.round((Math.abs(Number(s.value) || 0) / max) * 100))}%`;
      bar.title = `${s.label}: ${fmtBRL(s.value)}`;
      const lbl = document.createElement("span");
      lbl.className = "spark-label";
      lbl.textContent = s.label;
      bar.appendChild(lbl);
      container.appendChild(bar);
    });
  }

  function updateChartsVisibility() {
    if (chartIncomeKpi) {
      chartIncomeKpi.classList.toggle("is-hidden", !chartsState.showIncome);
    }
    if (chartExpenseKpi) {
      chartExpenseKpi.classList.toggle("is-hidden", !chartsState.showExpense);
    }
  }

  function updateChartsWidget() {
    if (!chartsState.refYm) return;
    const range = Math.max(3, Number(chartsState.range) || 6);
    let totalInc = 0;
    let totalExp = 0;
    let totalSaldo = 0;
    const series = [];

    for (let i = range - 1; i >= 0; i--) {
      const key = addMonths(chartsState.refYm, -i);
      const s = sumMonth(key);
      totalInc += s.inc;
      totalExp += s.exp;
      totalSaldo += s.saldo;
      series.push({ label: labelMonthShort(key), value: s.saldo });
    }

    if (wChartsIncome) wChartsIncome.textContent = fmtBRL(totalInc);
    if (wChartsExpense) wChartsExpense.textContent = fmtBRL(totalExp);
    if (wChartsBalance) {
      wChartsBalance.textContent = fmtBRL(totalSaldo);
      wChartsBalance.className = totalSaldo >= 0 ? "positivo" : "negativo";
    }
    if (wChartsPeriod) wChartsPeriod.textContent = `Ultimos ${range} meses`;
    if (wChartsSpark) renderSpark(wChartsSpark, series);
    updateChartsVisibility();
  }

  function initChartsControls() {
    if (!chartsCard) return;
    const activeRange = Array.from(chartRangeButtons).find(btn => btn.classList.contains("is-active"));
    if (activeRange) {
      chartsState.range = Number(activeRange.dataset.range) || chartsState.range;
    }

    chartRangeButtons.forEach(btn => {
      btn.addEventListener("click", () => {
        chartRangeButtons.forEach(el => el.classList.remove("is-active"));
        btn.classList.add("is-active");
        chartsState.range = Number(btn.dataset.range) || chartsState.range;
        updateChartsWidget();
      });
    });

    chartSeriesButtons.forEach(btn => {
      const series = btn.dataset.series;
      const isActive = btn.classList.contains("is-active");
      btn.setAttribute("aria-pressed", isActive ? "true" : "false");
      if (series === "income") chartsState.showIncome = isActive;
      if (series === "expense") chartsState.showExpense = isActive;

      btn.addEventListener("click", () => {
        const nowActive = !btn.classList.contains("is-active");
        btn.classList.toggle("is-active", nowActive);
        btn.setAttribute("aria-pressed", nowActive ? "true" : "false");
        if (series === "income") chartsState.showIncome = nowActive;
        if (series === "expense") chartsState.showExpense = nowActive;
        updateChartsVisibility();
      });
    });

    updateChartsVisibility();
  }

  let insightsTimer = null;

  function setInsightsFeedback(message) {
    if (!insightsFeedback) return;
    insightsFeedback.textContent = message;
    insightsFeedback.classList.add("is-active");
    if (insightsTimer) window.clearTimeout(insightsTimer);
    insightsTimer = window.setTimeout(() => {
      if (insightsFeedback) insightsFeedback.classList.remove("is-active");
    }, 2400);
  }

  function initInsightsActions() {
    if (!insightsCard) return;
    insightsCard.addEventListener("click", event => {
      const button = event.target.closest("[data-insight-action]");
      if (!button) return;
      if (button.dataset.locked) {
        setInsightsFeedback("Disponível no Plus.");
        return;
      }
      const line = button.closest(".insight-line");
      const label = line && line.dataset.insightLabel ? line.dataset.insightLabel : "Insight";
      const action = button.dataset.insightAction;
      const actionLabel = action === "alert" ? "Alerta simulado" : "Reducao simulada";
      setInsightsFeedback(`${actionLabel} para ${label}.`);
    });
  }

  const ruleCategories = {
    despesa: [
      { value: "moradia", label: "Moradia" },
      { value: "mercado", label: "Mercado" },
      { value: "transporte", label: "Transporte" },
      { value: "servicos", label: "Servicos" },
      { value: "outros", label: "Outros" },
    ],
    receita: [
      { value: "salario", label: "Salario" },
      { value: "extras", label: "Extras" },
      { value: "outros", label: "Outros" },
    ],
  };

  function populateRuleCategories() {
    if (!ruleCategorySelect) return;
    const type = (ruleTypeSelect && ruleTypeSelect.value) || "despesa";
    const items = ruleCategories[type] || ruleCategories.despesa;
    ruleCategorySelect.innerHTML = "";
    items.forEach(item => {
      const option = document.createElement("option");
      option.value = item.value;
      option.textContent = item.label;
      ruleCategorySelect.appendChild(option);
    });
  }

  function openRuleModal() {
    if (!ruleModal) return;
    ruleModal.classList.remove("hidden");
    ruleModal.setAttribute("aria-hidden", "false");
    if (ruleFeedback) ruleFeedback.textContent = "";
    populateRuleCategories();
    if (ruleMatchInput) ruleMatchInput.focus();
  }

  function closeRuleModal() {
    if (!ruleModal) return;
    ruleModal.classList.add("hidden");
    ruleModal.setAttribute("aria-hidden", "true");
  }

  function setRuleFeedback(message, isError) {
    if (!ruleFeedback) return;
    ruleFeedback.textContent = message;
    ruleFeedback.classList.toggle("is-error", !!isError);
  }

  function initRuleModal() {
    if (ruleTypeSelect) {
      populateRuleCategories();
      ruleTypeSelect.addEventListener("change", populateRuleCategories);
    }

    if (ruleNewBtn) ruleNewBtn.addEventListener("click", openRuleModal);
    if (ruleCloseBtn) ruleCloseBtn.addEventListener("click", closeRuleModal);
    if (ruleCancelBtn) ruleCancelBtn.addEventListener("click", closeRuleModal);

    if (ruleModal) {
      ruleModal.addEventListener("click", event => {
        if (event.target === ruleModal) closeRuleModal();
      });
    }

    if (ruleForm) {
      ruleForm.addEventListener("submit", async event => {
        event.preventDefault();
        if (!ruleMatchInput || !ruleCategorySelect || !ruleTypeSelect) return;
        const match = String(ruleMatchInput.value || "").trim();
        if (!match) {
          setRuleFeedback("Informe o texto para acionar a regra.", true);
          return;
        }

        const payload = {
          name: String(ruleNameInput && ruleNameInput.value ? ruleNameInput.value : "Regra rapida").trim() || "Regra rapida",
          is_enabled: true,
          apply_on_create: true,
          apply_on_edit: false,
          apply_on_import: false,
          stop_after_apply: true,
          conditions: [
            { field: "descricao", op: "contains", value: match },
            { field: "tipo", op: "eq", value: String(ruleTypeSelect.value || "despesa").trim() },
          ],
          actions: [
            { type: "set_category", value: String(ruleCategorySelect.value || "outros").trim() },
          ],
        };

        const tags = ruleTagsInput ? String(ruleTagsInput.value || "").trim() : "";
        if (tags) {
          payload.actions.push({ type: "set_tags", value: tags });
        }

        const submitBtn = document.getElementById("dash-rule-submit");
        if (submitBtn) submitBtn.disabled = true;

        try {
          const res = await fetch("/api/rules", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          const data = await res.json();
          if (!res.ok) {
            const msg = data && data.error ? data.error : "Falha ao criar regra";
            throw new Error(msg);
          }
          setRuleFeedback("Regra criada com sucesso.", false);
          if (ruleForm) ruleForm.reset();
          populateRuleCategories();
          await hydrateRulesWidget();
          window.setTimeout(() => closeRuleModal(), 600);
        } catch (err) {
          setRuleFeedback(err.message || "Falha ao criar regra", true);
        } finally {
          if (submitBtn) submitBtn.disabled = false;
        }
      });
    }
  }

  function describeRule(rule) {
    const conditions = Array.isArray(rule.conditions) ? rule.conditions : [];
    const actions = Array.isArray(rule.actions) ? rule.actions : [];
    const match = conditions.find(c => c.field === "descricao" && c.op === "contains");
    const typeCond = conditions.find(c => c.field === "tipo" && c.op === "eq");
    const actionCat = actions.find(a => a.type === "set_category");
    const parts = [];
    if (match && match.value) parts.push(`Se contem "${match.value}"`);
    if (typeCond && typeCond.value) {
      parts.push(typeCond.value === "receita" ? "Receita" : "Despesa");
    }
    if (actionCat && actionCat.value) {
      const item = actionCat.value;
      const label = ruleCategories.despesa.concat(ruleCategories.receita).find(cat => cat.value === item);
      parts.push(`-> ${label ? label.label : item}`);
    }
    return parts.join(" ").trim();
  }

  function renderRulesList(rules) {
    if (!rulesList) return;
    rulesList.innerHTML = "";

    if (!rules.length) {
      const empty = document.createElement("div");
      empty.className = "rules-empty";
      empty.textContent = "Nenhuma regra cadastrada.";
      rulesList.appendChild(empty);
      return;
    }

    rules.slice(0, 3).forEach(rule => {
      const row = document.createElement("div");
      row.className = "rule-row";

      const info = document.createElement("div");
      info.className = "rule-info";

      const title = document.createElement("strong");
      title.textContent = rule.name || `Regra #${rule.id}`;

      const desc = document.createElement("span");
      const descText = describeRule(rule);
      desc.textContent = descText || "Regra rapida";

      info.appendChild(title);
      info.appendChild(desc);

      const toggle = document.createElement("label");
      toggle.className = "rule-toggle";

      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = !!rule.is_enabled;
      input.dataset.ruleToggle = "1";
      input.dataset.ruleId = rule.id;

      const knob = document.createElement("span");
      toggle.appendChild(input);
      toggle.appendChild(knob);

      row.appendChild(info);
      row.appendChild(toggle);
      rulesList.appendChild(row);
    });
  }

  let rulesToggleBound = false;

  function bindRulesToggle() {
    if (!rulesList || rulesToggleBound) return;
    rulesToggleBound = true;
    rulesList.addEventListener("change", async event => {
      const input = event.target.closest("[data-rule-toggle]");
      if (!input) return;
      const ruleId = input.dataset.ruleId;
      if (!ruleId) return;
      const isEnabled = input.checked;
      input.disabled = true;
      try {
        const res = await fetch(`/api/rules/${ruleId}/toggle`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_enabled: isEnabled }),
        });
        const data = await res.json();
        if (!res.ok) {
          const msg = data && data.error ? data.error : "Falha ao atualizar regra";
          throw new Error(msg);
        }
        if (wRulesLast) wRulesLast.textContent = "Atualizado agora";
        await hydrateRulesWidget();
      } catch (err) {
        input.checked = !isEnabled;
        if (wRulesLast) wRulesLast.textContent = "Falha ao atualizar";
      } finally {
        input.disabled = false;
      }
    });
  }

  function updateProjectionSimulation() {
    if (!wProjSaldo) return;
    const saldo = projectionState.baseSaldo + projectionState.adjustSaldo;
    const pend = Math.max(0, projectionState.basePend + projectionState.adjustPend);
    wProjSaldo.textContent = fmtBRL(saldo);
    if (wProjPend) wProjPend.textContent = fmtBRL(pend);

    if (projSimFeedback) {
      if (projectionState.adjustSaldo || projectionState.adjustPend) {
        const parts = [];
        if (projectionState.adjustSaldo) parts.push(`Saldo ${fmtSignedBRL(projectionState.adjustSaldo)}`);
        if (projectionState.adjustPend) parts.push(`Pendentes ${fmtSignedBRL(projectionState.adjustPend)}`);
        projSimFeedback.textContent = `Simulacao ativa: ${parts.join(" | ")}`;
        projSimFeedback.classList.add("is-active");
      } else {
        projSimFeedback.textContent = "Simulacao desligada.";
        projSimFeedback.classList.remove("is-active");
      }
    }
  }

  function applyProjectionDelta(deltaSaldo, deltaPend) {
    projectionState.adjustSaldo += deltaSaldo;
    projectionState.adjustPend += deltaPend;
    updateProjectionSimulation();
  }

  function initProjectionSimulators() {
    if (!projSimButtons.length) return;

    projSimButtons.forEach(btn => {
      btn.addEventListener("click", () => {
        const action = btn.dataset.projSim;
        if (action === "delay") {
          const value = Number(projDelayInput && projDelayInput.value ? projDelayInput.value : 0);
          if (!value || value <= 0) {
            if (projSimFeedback) projSimFeedback.textContent = "Informe um valor para adiar.";
            return;
          }
          applyProjectionDelta(value, -value);
          if (projDelayInput) projDelayInput.value = "";
        }

        if (action === "split") {
          const value = Number(projSplitInput && projSplitInput.value ? projSplitInput.value : 0);
          const countValue = Number(projSplitCountInput && projSplitCountInput.value ? projSplitCountInput.value : 2);
          const count = Number.isFinite(countValue) ? Math.max(2, countValue) : 2;
          if (!value || value <= 0) {
            if (projSimFeedback) projSimFeedback.textContent = "Informe o valor a parcelar.";
            return;
          }
          const deferred = value - value / count;
          if (deferred > 0) {
            applyProjectionDelta(deferred, -deferred);
          }
          if (projSplitInput) projSplitInput.value = "";
          if (projSplitCountInput) projSplitCountInput.value = "";
        }

        if (action === "extra") {
          const value = Number(projExtraInput && projExtraInput.value ? projExtraInput.value : 0);
          if (!value || value <= 0) {
            if (projSimFeedback) projSimFeedback.textContent = "Informe o valor extra.";
            return;
          }
          applyProjectionDelta(value, 0);
          if (projExtraInput) projExtraInput.value = "";
        }
      });
    });

    if (projResetBtn) {
      projResetBtn.addEventListener("click", () => {
        projectionState.adjustSaldo = 0;
        projectionState.adjustPend = 0;
        updateProjectionSimulation();
      });
    }
  }

  function initReportExports() {
    if (!reportButtons || !reportButtons.length) return;
    reportButtons.forEach(btn => {
      btn.addEventListener("click", () => {
        if (btn.dataset.locked) return;
        const type = btn.dataset.reportExport;
        let url = "";
        if (type === "pdf") {
          const detail = btn.dataset.detail || "resumido";
          url = `/app/reports/export/pdf?detail=${detail}&download=1`;
        }
        if (type === "excel") {
          url = "/app/reports/export/excel";
        }
        if (url) window.open(url, "_blank");
      });
    });
  }

  async function hydrateRulesWidget() {
    if (!wRulesTotal) return;
    try {
      const res = await fetch("/api/rules");
      const data = await res.json();
      if (!res.ok) return;
      const rules = Array.isArray(data.rules) ? data.rules : [];
      const total = rules.length;
      const active = rules.filter(r => !!r.is_enabled).length;
      const runs = rules.reduce((acc, r) => acc + (Number(r.run_count) || 0), 0);
      let lastRun = null;
      rules.forEach(r => {
        if (!r.last_run_at) return;
        const t = new Date(String(r.last_run_at));
        if (!lastRun || t > lastRun) lastRun = t;
      });
      if (wRulesTotal) wRulesTotal.textContent = String(total);
      if (wRulesActive) wRulesActive.textContent = String(active);
      if (wRulesRuns) wRulesRuns.textContent = String(runs);
      if (wRulesLast) {
        if (lastRun) {
          const iso = `${lastRun.getFullYear()}-${pad2(lastRun.getMonth() + 1)}-${pad2(lastRun.getDate())}`;
          wRulesLast.textContent = `Última: ${fmtBRDate(iso)}`;
        } else {
          wRulesLast.textContent = "Última: -";
        }
      }
      renderRulesList(rules);
      bindRulesToggle();
    } catch (e) {
      // silencioso
    }
  }

  async function hydrateProjectionWidget() {
    if (!wProjSaldo) return;
    try {
      const now = new Date();
      const iso = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
      const res = await fetch(`/resumo-ciclo?data=${encodeURIComponent(iso)}`);
      const data = await res.json();
      if (!res.ok) return;

      const saldo = Number(data.saldo_projetado) || 0;
      const pend = Number(data.total_despesas_pendentes) || 0;
      projectionState.baseSaldo = saldo;
      projectionState.basePend = pend;
      projectionState.adjustSaldo = 0;
      projectionState.adjustPend = 0;
      updateProjectionSimulation();
      if (wProjAte) wProjAte.textContent = fmtBRDate(data.ate);
      if (wProjRef) wProjRef.textContent = `Base: ${fmtBRDate(iso)}`;
    } catch (e) {
      // silencioso
    }
  }

  function hydratePlanWidgets() {
    const hasAny = !!(wChartsIncome || wInsightsTopCat || wRepCount || wChartsSpark);
    if (!hasAny) return;

    // Mês de referência: filtro-data (se preenchido) -> última entrada -> hoje
    let ref = null;
    if (filtroAte && filtroAte.value) {
      ref = parseISODate(filtroAte.value);
    } else if (filtroDe && filtroDe.value) {
      ref = parseISODate(filtroDe.value);
    }
    if (!ref && entradas.length) {
      // acha a maior data
      let max = null;
      entradas.forEach(e => {
        const dt = parseISODate(e.data);
        if (!dt) return;
        if (!max || dt > max) max = dt;
      });
      ref = max;
    }
    if (!ref) ref = new Date();

    const ym = monthKey(ref);
    const month = sumMonth(ym);

    // Charts
    chartsState.refYm = ym;
    if (wChartsIncome || wChartsExpense || wChartsBalance || wChartsSpark || wChartsPeriod) {
      updateChartsWidget();
    }

// Insights
    if (wInsightsTopCat || wInsightsTopExp || wInsightsVar || wInsightsPeriod) {
      const topCat = groupTopExpenseCategory(ym);
      const topEntry = topExpenseEntry(ym);
      const prev = sumMonth(addMonths(ym, -1));
      const varPct = pctChange(month.exp, prev.exp);

      if (wInsightsTopCat) wInsightsTopCat.textContent = topCat.cat === "-" ? "-" : `${topCat.cat}`;
      if (wInsightsTopExp) {
        if (topEntry) {
          wInsightsTopExp.textContent = `${fmtBRL(Number(topEntry.valor) || 0)}`;
          wInsightsTopExp.title = topEntry.descricao ? String(topEntry.descricao) : "Maior saída";
        } else {
          wInsightsTopExp.textContent = fmtBRL(0);
        }
      }
      if (wInsightsVar) {
        if (varPct === null) {
          wInsightsVar.textContent = "-";
        } else if (varPct === Infinity) {
          wInsightsVar.textContent = "+∞";
        } else {
          const sign = varPct > 0 ? "+" : "";
          wInsightsVar.textContent = `${sign}${varPct.toFixed(0)}%`;
        }
      }
      if (wInsightsPeriod) wInsightsPeriod.textContent = labelMonth(ym);
    }

    // Reports
    if (wRepCount || wRepInc || wRepExp || wRepPeriod) {
      if (wRepCount) wRepCount.textContent = String(month.count);
      if (wRepInc) wRepInc.textContent = fmtBRL(month.inc);
      if (wRepExp) wRepExp.textContent = fmtBRL(month.exp);
      if (wRepPeriod) wRepPeriod.textContent = labelMonth(ym);
    }
  }

  function montarCardsTrimestresSeNaoExistir() {
    if (!cardsRoot) return;

    if (cardsRoot.children.length > 0) return;

    const trimestres = [
      { titulo: "1º Trimestre", meses: [1, 2, 3] },
      { titulo: "2º Trimestre", meses: [4, 5, 6] },
      { titulo: "3º Trimestre", meses: [7, 8, 9] },
      { titulo: "4º Trimestre", meses: [10, 11, 12] }
    ];

    cardsRoot.innerHTML = trimestres.map(t => `
      <div class="trimestre">
        <h2>${t.titulo}</h2>
        <div class="cards">
          ${t.meses.map(m => `<div class="card" data-mes="${m}"></div>`).join("")}
        </div>
      </div>
    `).join("");
  }

  function atualizarCards() {
    montarCardsTrimestresSeNaoExistir();

    const resumo = {};
    for (let m = 1; m <= 12; m++) resumo[m] = { receita: 0, despesa: 0 };

    entradas.forEach(e => {
      const mes = parseInt(String(e.data).slice(5, 7), 10);
      if (!mes || mes < 1 || mes > 12) return;

      if (e.tipo === "receita") resumo[mes].receita += Number(e.valor) || 0;
      if (e.tipo === "despesa") resumo[mes].despesa += Number(e.valor) || 0;
    });

    document.querySelectorAll(".card[data-mes]").forEach(card => {
      const mesNum = parseInt(card.dataset.mes, 10);
      const dados = resumo[mesNum] || { receita: 0, despesa: 0 };
      const saldo = (Number(dados.receita) || 0) - (Number(dados.despesa) || 0);

      card.innerHTML = `
        <h3>${meses[mesNum - 1] || "Mês"}</h3>
        <p>Receita: ${fmtBRL(dados.receita)}</p>
        <p>Despesa: ${fmtBRL(dados.despesa)}</p>
        <strong class="${saldo >= 0 ? "saldo-positivo" : "saldo-negativo"}">
          Saldo: ${fmtBRL(saldo)}
        </strong>
      `;
    });
  }

  
  async function renderResumoPorPeriodo(de, ate) {
    if (!listaPeriodo) return;

    listaPeriodo.innerHTML = "";

    if (totalReceitaEl) totalReceitaEl.textContent = fmtBRL(0);
    if (totalDespesaEl) totalDespesaEl.textContent = fmtBRL(0);
    if (saldoPeriodoEl) {
      saldoPeriodoEl.textContent = fmtBRL(0);
      saldoPeriodoEl.className = "";
    }

    if (!de || !ate) return;

    // Normaliza: se o usuário inverter, trava em um período válido
    if (ate < de) {
      ate = de;
      if (filtroAte) filtroAte.value = ate;
    }

    try {
      const res = await fetch(`/resumo-periodo?de=${encodeURIComponent(de)}&ate=${encodeURIComponent(ate)}`);
      const resumo = await res.json();

      if (!res.ok) {
        const msg = resumo && resumo.error ? resumo.error : "Erro ao carregar resumo";
        listaPeriodo.innerHTML = `<div class="linha-dia"><span>${msg}</span><span></span></div>`;
        return;
      }

      const totalReceitas = Number(resumo.total_receitas) || 0;
      const totalDespesas = Number(resumo.total_despesas) || 0;
      const saldoPeriodo = Number(resumo.saldo_periodo) || 0;

      const receitas = Array.isArray(resumo.receitas) ? resumo.receitas : [];
      const despesas = Array.isArray(resumo.despesas) ? resumo.despesas : [];

      // Receitas
      listaPeriodo.innerHTML += `
        <div class="linha-dia">
          <span><strong>Receitas do período</strong></span>
          <span></span>
        </div>
      `;

      if (receitas.length === 0) {
        listaPeriodo.innerHTML += `
          <div class="linha-dia">
            <span>-</span>
            <span>${fmtBRL(0)}</span>
          </div>
        `;
      } else {
        receitas.forEach(r => {
          const v = Number(r.valor) || 0;
          const label = `${r.data} - ${r.descricao}`;
          listaPeriodo.innerHTML += `
            <div class="linha-dia">
              <span>${label}</span>
              <span>${fmtBRL(v)}</span>
            </div>
          `;
        });
      }

      // Despesas
      listaPeriodo.innerHTML += `
        <div class="linha-dia" style="margin-top:10px;">
          <span><strong>Despesas do período</strong></span>
          <span></span>
        </div>
      `;

      if (despesas.length === 0) {
        listaPeriodo.innerHTML += `
          <div class="linha-dia">
            <span>-</span>
            <span>${fmtBRL(0)}</span>
          </div>
        `;
      } else {
        despesas.forEach(d => {
          const v = Number(d.valor) || 0;
          const st = (d.status === "pago") ? "Pago" : "Pendente";
          const label = `${d.data} - ${d.descricao} (${st})`;
          listaPeriodo.innerHTML += `
            <div class="linha-dia">
              <span>${label}</span>
              <span>${fmtBRL(v)}</span>
            </div>
          `;
        });
      }

      // Totais (painel lateral)
      if (totalReceitaEl) totalReceitaEl.textContent = fmtBRL(totalReceitas);
      if (totalDespesaEl) totalDespesaEl.textContent = fmtBRL(totalDespesas);

      if (saldoPeriodoEl) {
        saldoPeriodoEl.textContent = fmtBRL(saldoPeriodo);
        saldoPeriodoEl.className = saldoPeriodo >= 0 ? "positivo" : "negativo";
      }

      // Linha final no card (reforço)
      listaPeriodo.innerHTML += `
        <div class="linha-dia" style="margin-top:10px;">
          <span><strong>Saldo do período</strong></span>
          <span><strong>${fmtBRL(saldoPeriodo)}</strong></span>
        </div>
      `;
    } catch (err) {
      listaPeriodo.innerHTML = `<div class="linha-dia"><span>Erro ao carregar resumo</span><span></span></div>`;
    }
  }



  function setDefaultPeriodoSeVazio() {
    if (!filtroDe || !filtroAte) return;
    const now = new Date();
    const today = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
    const first = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-01`;

    if (!filtroDe.value) filtroDe.value = first;
    if (!filtroAte.value) filtroAte.value = today;

    if (filtroAte.value && filtroDe.value && filtroAte.value < filtroDe.value) {
      filtroAte.value = filtroDe.value;
    }
  }

  async function carregarDados() {
    const res = await fetch("/dados");
    const data = await res.json();
    entradas = data.entradas || [];
    atualizarCards();

    // Widgets (dependem das entradas carregadas)
    hydratePlanWidgets();
    hydrateRulesWidget();
    hydrateProjectionWidget();

    setDefaultPeriodoSeVazio();

    if (filtroDe && filtroAte && filtroDe.value && filtroAte.value) {
      await renderResumoPorPeriodo(filtroDe.value, filtroAte.value);
    }
  }

  async function onPeriodoChange() {
    if (!filtroDe || !filtroAte) return;
    if (!filtroDe.value || !filtroAte.value) return;

    if (filtroAte.value < filtroDe.value) {
      filtroAte.value = filtroDe.value;
    }

    await renderResumoPorPeriodo(filtroDe.value, filtroAte.value);

    // Quando o usuário troca o período, atualiza as prévias do mês de referência também.
    hydratePlanWidgets();
  }

  if (filtroDe) filtroDe.addEventListener("change", onPeriodoChange);
  if (filtroAte) filtroAte.addEventListener("change", onPeriodoChange);

  initChartsControls();
  initInsightsActions();
  bindRulesToggle();
  initRuleModal();
  initProjectionSimulators();
  initReportExports();

  carregarDados();

})();
