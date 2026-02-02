(function () {
  const page = document.querySelector("[data-reports-page]");
  if (!page) return;

  const locked = page.classList.contains("is-locked");
  const periodSelect = document.getElementById("reports-period");
  const modeSelect = document.getElementById("reports-mode");
  const typeSelect = document.getElementById("reports-type");
  const statusSelect = document.getElementById("reports-status-filter");
  const categorySelect = document.getElementById("reports-category");
  const methodSelect = document.getElementById("reports-method");
  const startInput = document.getElementById("reports-start");
  const endInput = document.getElementById("reports-end");
  const rangeBox = page.querySelector("[data-range]");
  const statusEl = document.getElementById("reports-status");
  const tabButtons = page.querySelectorAll(".tab-btn");
  const tabPanels = page.querySelectorAll(".tab-panel");

  const summaryEls = {
    income: document.getElementById("report-total-income"),
    expense: document.getElementById("report-total-expense"),
    net: document.getElementById("report-net-result"),
    netPct: document.getElementById("report-net-pct"),
    netHighlight: document.getElementById("report-net-highlight"),
    comparePrev: document.getElementById("report-compare-prev"),
    compareAvg: document.getElementById("report-compare-avg"),
    compareNote: document.getElementById("report-compare-note"),
    healthIndex: document.getElementById("report-health-index"),
    healthStatus: document.getElementById("report-health-status"),
    alerts: document.getElementById("report-alerts"),
    pendingCount: document.getElementById("report-pending-count"),
    pendingTotal: document.getElementById("report-pending-total"),
    pendingImpact: document.getElementById("report-pending-impact")
  };

  const dreBody = document.getElementById("dre-body");
  const flowBody = document.getElementById("flow-body");
  const categoryChart = document.getElementById("category-chart");
  const categoryBody = document.getElementById("category-body");
  const recurringGrid = document.getElementById("recurring-grid");
  const pendingSummary = document.getElementById("pending-summary");
  const pendingBody = document.getElementById("pending-body");

  let lastData = null;
  let loadTimer = null;

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function fmtBRL(valor) {
    const num = Number(valor);
    if (!Number.isFinite(num)) return "R$ —";
    return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function fmtPct(valor) {
    const num = Number(valor);
    if (!Number.isFinite(num)) return "—";
    return `${num.toFixed(1).replace(".", ",")}%`;
  }

  function fmtPctSigned(valor) {
    const num = Number(valor);
    if (!Number.isFinite(num)) return "—";
    const sign = num >= 0 ? "+" : "";
    return `${sign}${num.toFixed(1).replace(".", ",")}%`;
  }

  function fmtDate(iso) {
    if (!iso) return "—";
    const dt = new Date(iso);
    if (Number.isNaN(dt.getTime())) return "—";
    return dt.toLocaleDateString("pt-BR");
  }

  function setRangeVisibility() {
    const isCustom = periodSelect && periodSelect.value === "custom";
    page.classList.toggle("is-custom-range", !!isCustom);
    if (rangeBox) {
      rangeBox.style.display = isCustom ? "grid" : "none";
    }
  }

  function formatStamp(date) {
    try {
      return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
    } catch (err) {
      return date.toLocaleDateString("pt-BR");
    }
  }

  function setStatus(text, loading) {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.classList.toggle("is-loading", !!loading);
  }

  function getSelectedValues(select) {
    if (!select) return [];
    return Array.from(select.selectedOptions || [])
      .map(opt => opt.value)
      .filter(Boolean);
  }

  function buildQuery() {
    const params = new URLSearchParams();
    if (periodSelect?.value) params.set("period", periodSelect.value);
    if (modeSelect?.value) params.set("mode", modeSelect.value);
    if (typeSelect?.value) params.set("type", typeSelect.value);
    if (statusSelect?.value) params.set("status", statusSelect.value);

    if (periodSelect?.value === "custom") {
      if (startInput?.value) params.set("start", startInput.value);
      if (endInput?.value) params.set("end", endInput.value);
    }

    const categories = getSelectedValues(categorySelect);
    if (categories.length) params.set("categories", categories.join(","));

    const methods = getSelectedValues(methodSelect);
    if (methods.length) params.set("methods", methods.join(","));

    return params.toString();
  }

  function renderSummary(data) {
    if (!data || !data.summary) return;
    const summary = data.summary;
    const comparison = data.comparison || {};
    const health = data.health || {};
    const pending = data.pending || {};

    summaryEls.income && (summaryEls.income.textContent = fmtBRL(summary.income));
    summaryEls.expense && (summaryEls.expense.textContent = fmtBRL(summary.expense));

    if (summaryEls.net) summaryEls.net.textContent = fmtBRL(summary.net);
    if (summaryEls.netPct) summaryEls.netPct.textContent = `(${fmtPct(summary.economy_pct)})`;

    if (summaryEls.netHighlight) {
      summaryEls.netHighlight.classList.toggle("positive", summary.net >= 0);
      summaryEls.netHighlight.classList.toggle("negative", summary.net < 0);
      summaryEls.netHighlight.classList.toggle("warning", Math.abs(summary.net) < 1);
    }

    if (summaryEls.comparePrev) summaryEls.comparePrev.textContent = fmtPctSigned(comparison.prev_pct);
    if (summaryEls.compareAvg) summaryEls.compareAvg.textContent = fmtPctSigned(comparison.avg_pct);

    if (summaryEls.compareNote) {
      let note = comparison.note || "";
      if (!note) {
        const delta = Number(comparison.prev_pct);
        if (!Number.isFinite(delta)) {
          note = "Sem base para comparar.";
        } else if (delta >= 0) {
          note = "Resultado acima do periodo anterior.";
        } else {
          note = "Resultado abaixo do periodo anterior.";
        }
      }
      summaryEls.compareNote.textContent = note;
    }

    if (summaryEls.healthIndex) summaryEls.healthIndex.textContent = fmtPct(health.ratio);
    if (summaryEls.healthStatus) summaryEls.healthStatus.textContent = health.status || "—";

    if (summaryEls.alerts) {
      const alerts = Array.isArray(health.alerts) && health.alerts.length ? health.alerts : ["Sem alertas relevantes."];
      summaryEls.alerts.innerHTML = alerts.map(item => `<li>${escapeHtml(item)}</li>`).join("");
    }

    if (summaryEls.pendingCount) summaryEls.pendingCount.textContent = String(pending.count ?? "—");
    if (summaryEls.pendingTotal) summaryEls.pendingTotal.textContent = fmtBRL(pending.total);
    if (summaryEls.pendingImpact) {
      summaryEls.pendingImpact.textContent = `Saldo se pagar tudo hoje: ${fmtBRL(pending.impact)}`;
    }
  }

  function renderDre(data) {
    if (!dreBody) return;
    const rows = data?.dre?.rows || [];
    const total = data?.dre?.total;
    if (!rows.length) {
      dreBody.innerHTML = `<tr><td colspan="4">Sem dados no periodo.</td></tr>`;
      return;
    }
    const content = rows.map(row => {
      return `
        <tr>
          <td>${escapeHtml(row.label)}</td>
          <td>${fmtBRL(row.income)}</td>
          <td>${fmtBRL(row.expense)}</td>
          <td>${fmtBRL(row.net)}</td>
        </tr>
      `;
    }).join("");

    const totalRow = total ? `
      <tr class="is-total">
        <td>Resultado total</td>
        <td>${fmtBRL(total.income)}</td>
        <td>${fmtBRL(total.expense)}</td>
        <td>${fmtBRL(total.net)}</td>
      </tr>
    ` : "";

    dreBody.innerHTML = content + totalRow;
  }

  function renderFlow(data) {
    if (!flowBody) return;
    const rows = data?.flow?.rows || [];
    if (!rows.length) {
      flowBody.innerHTML = `<tr><td colspan="7">Sem dados no periodo.</td></tr>`;
      return;
    }

    const content = rows.map(row => {
      return `
        <tr>
          <td>${fmtDate(row.date)}</td>
          <td>${escapeHtml(row.description)}</td>
          <td>${escapeHtml(row.category)}</td>
          <td>${escapeHtml(row.method || "—")}</td>
          <td>${row.income ? fmtBRL(row.income) : "—"}</td>
          <td>${row.expense ? fmtBRL(row.expense) : "—"}</td>
          <td>${fmtBRL(row.balance)}</td>
        </tr>
      `;
    }).join("");

    const finalBalance = data?.flow?.final_balance;
    const totalRow = Number.isFinite(Number(finalBalance)) ? `
      <tr class="is-total">
        <td colspan="6">Saldo final</td>
        <td>${fmtBRL(finalBalance)}</td>
      </tr>
    ` : "";

    flowBody.innerHTML = content + totalRow;
  }

  function renderCategories(data) {
    if (!categoryChart || !categoryBody) return;
    const rows = data?.categories?.rows || [];
    if (!rows.length) {
      categoryChart.innerHTML = `<div class="category-bar" style="--pct: 0"><span>Sem dados</span><strong>—</strong></div>`;
      categoryBody.innerHTML = `<tr><td colspan="4">Sem dados no periodo.</td></tr>`;
      return;
    }

    categoryChart.innerHTML = rows.slice(0, 5).map(row => {
      return `
        <div class="category-bar" style="--pct: ${row.percent || 0}">
          <span>${escapeHtml(row.label)}</span>
          <strong>${fmtPct(row.percent)}</strong>
        </div>
      `;
    }).join("");

    categoryBody.innerHTML = rows.map(row => {
      const delta = Number.isFinite(Number(row.delta)) ? fmtPctSigned(row.delta) : "—";
      return `
        <tr>
          <td>${escapeHtml(row.label)}</td>
          <td>${fmtBRL(row.total)}</td>
          <td>${fmtPct(row.percent)}</td>
          <td>${delta}</td>
        </tr>
      `;
    }).join("");
  }

  function renderRecurring(data) {
    if (!recurringGrid) return;
    const items = data?.recurring?.items || [];
    if (!items.length) {
      recurringGrid.innerHTML = `<div class="recurring-card"><h5>Sem recorrencias</h5><p>Nenhuma receita recorrente detectada.</p></div>`;
      return;
    }

    recurringGrid.innerHTML = items.map(item => {
      return `
        <article class="recurring-card">
          <h5>${escapeHtml(item.name)}</h5>
          <p>${escapeHtml(item.frequency)} • Valor medio ${fmtBRL(item.value)}</p>
          <span class="recurring-badge">Confiabilidade ${fmtPct(item.reliability)}</span>
        </article>
      `;
    }).join("");
  }

  function renderPending(data) {
    if (!pendingSummary || !pendingBody) return;
    const pending = data?.pending || {};
    const items = pending.items || [];

    pendingSummary.innerHTML = `
      <li>Vencidas: ${pending.overdue ?? "—"}</li>
      <li>Vencem em 7 dias: ${pending.due_7 ?? "—"}</li>
      <li>Impacto no saldo: ${fmtBRL(pending.impact)}</li>
    `;

    if (!items.length) {
      pendingBody.innerHTML = `<tr><td colspan="5">Sem pendencias no periodo.</td></tr>`;
      return;
    }

    pendingBody.innerHTML = items.map(item => {
      return `
        <tr>
          <td>${fmtDate(item.date)}</td>
          <td>${escapeHtml(item.description)}</td>
          <td>${escapeHtml(item.category)}</td>
          <td>${fmtBRL(item.value)}</td>
          <td>${item.days_overdue}</td>
        </tr>
      `;
    }).join("");
  }

  function applyData(data) {
    renderSummary(data);
    renderDre(data);
    renderFlow(data);
    renderCategories(data);
    renderRecurring(data);
    renderPending(data);
  }

  async function loadReports() {
    if (locked) return;
    const query = buildQuery();
    setStatus("Atualizando...", true);
    try {
      const res = await fetch(`/app/reports/data?${query}`);
      if (!res.ok) throw new Error("request_failed");
      const data = await res.json();
      lastData = data;
      applyData(data);
      const stamp = data.updated_at ? formatStamp(new Date(data.updated_at)) : formatStamp(new Date());
      setStatus(`Atualizado: ${stamp}`, false);
    } catch (err) {
      setStatus("Erro ao atualizar", false);
    }
  }

  function scheduleLoad() {
    if (loadTimer) window.clearTimeout(loadTimer);
    loadTimer = window.setTimeout(loadReports, 200);
  }

  function handleFilterChange() {
    setRangeVisibility();
    scheduleLoad();
  }

  function activateTab(name) {
    tabButtons.forEach(btn => {
      btn.classList.toggle("is-active", btn.dataset.tab === name);
    });
    tabPanels.forEach(panel => {
      panel.classList.toggle("is-active", panel.dataset.tab === name);
    });
  }

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
    selectEl._customRebuild = function () {
      buildOptions();
      updateFromSelect();
    };

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

  function initMultiSelect(selectEl) {
    if (!selectEl || selectEl.dataset.customized) return;
    selectEl.dataset.customized = "true";

    const wrapper = document.createElement("div");
    wrapper.className = "multi-select";

    selectEl.parentNode.insertBefore(wrapper, selectEl);
    wrapper.appendChild(selectEl);
    selectEl.classList.add("select-native");
    selectEl.tabIndex = -1;

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "control multi-trigger";
    wrapper.appendChild(trigger);

    const list = document.createElement("div");
    list.className = "multi-options";
    wrapper.appendChild(list);

    function buildOptions() {
      list.innerHTML = "";
      Array.from(selectEl.options).forEach(opt => {
        const label = document.createElement("label");
        label.className = "multi-option";
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.value = opt.value;
        checkbox.checked = opt.selected;
        checkbox.disabled = opt.disabled;
        const text = document.createElement("span");
        text.textContent = opt.textContent;
        label.appendChild(checkbox);
        label.appendChild(text);
        list.appendChild(label);
      });
    }

    function updateFromSelect() {
      const selected = Array.from(selectEl.options).filter(opt => opt.selected);
      if (!selected.length) {
        trigger.textContent = "Selecionar...";
      } else if (selected.length === 1) {
        trigger.textContent = selected[0].textContent;
      } else {
        trigger.textContent = `${selected.length} selecionados`;
      }
      wrapper.classList.toggle("is-disabled", !!selectEl.disabled);
      trigger.disabled = !!selectEl.disabled;
      list.querySelectorAll("input[type='checkbox']").forEach(input => {
        const opt = Array.from(selectEl.options).find(option => option.value === input.value);
        if (opt) {
          input.checked = !!opt.selected;
          input.disabled = !!opt.disabled || !!selectEl.disabled;
        }
      });
    }

    selectEl._customUpdate = updateFromSelect;
    selectEl._customRebuild = function () {
      buildOptions();
      updateFromSelect();
    };

    buildOptions();
    updateFromSelect();

    trigger.addEventListener("click", (ev) => {
      ev.stopPropagation();
      if (selectEl.disabled) return;
      wrapper.classList.toggle("open");
    });

    list.addEventListener("change", (ev) => {
      const input = ev.target;
      if (!(input instanceof HTMLInputElement)) return;
      const option = Array.from(selectEl.options).find(opt => opt.value === input.value);
      if (!option) return;
      option.selected = input.checked;
      selectEl.dispatchEvent(new Event("change", { bubbles: true }));
      updateFromSelect();
    });

    document.addEventListener("click", (ev) => {
      if (!wrapper.contains(ev.target)) wrapper.classList.remove("open");
    });

    selectEl.addEventListener("change", updateFromSelect);
  }

  function initAllSelects(root) {
    const scope = root || document;
    scope.querySelectorAll("select.control").forEach(selectEl => {
      if (selectEl.multiple) initMultiSelect(selectEl);
      else initCustomSelect(selectEl);
    });
  }

  function exportCsv(rows) {
    if (!rows || !rows.length) return;
    const header = ["Data", "Descricao", "Categoria", "Metodo", "Entrada", "Saida", "Saldo"];
    const lines = rows.map(row => {
      return [
        fmtDate(row.date),
        row.description || "",
        row.category || "",
        row.method || "",
        row.income ? row.income : "",
        row.expense ? row.expense : "",
        row.balance
      ].map(value => `"${String(value).replace(/\"/g, '""')}"`).join(",");
    });
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "relatorio_fluxo_caixa.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function handleExport(action) {
    if (action === "print" || action === "pdf") {
      window.print();
      return;
    }
    if (action === "excel") {
      exportCsv(lastData?.flow?.rows || []);
    }
  }

  const controls = page.querySelectorAll(".reports-filters .control, .reports-range .control");
  controls.forEach(control => {
    const eventName = control.tagName === "INPUT" ? "change" : "change";
    control.addEventListener(eventName, handleFilterChange);
  });

  tabButtons.forEach(btn => {
    btn.addEventListener("click", () => activateTab(btn.dataset.tab));
  });

  page.querySelectorAll("[data-export]").forEach(btn => {
    btn.addEventListener("click", () => handleExport(btn.dataset.export));
  });

  const initialTab = page.querySelector(".tab-btn.is-active")?.dataset.tab || tabButtons[0]?.dataset.tab;
  if (initialTab) activateTab(initialTab);

  initAllSelects(page);
  setRangeVisibility();
  if (!locked) {
    loadReports();
  }
})();
