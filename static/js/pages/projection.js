
(function () {
  const page = document.querySelector('[data-projection-page]');
  if (!page) return;

  const fmtBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

  const el = (id) => document.getElementById(id);

  const startInput = el('projection-start');
  const endInput = el('projection-end');
  const modeSelect = el('projection-mode');
  const reserveInput = el('projection-reserve');
  const recurringToggle = el('projection-recurring');

  const scenarioSelect = el('projection-scenario');
  const btnRun = el('projection-run');
  const btnSave = el('scenario-save');
  const btnSaveAs = el('scenario-saveas');
  const btnDelete = el('scenario-delete');
  const btnScenarioClear = el('scenario-clear');

  const kpiFinal = el('kpi-final');
  const kpiMin = el('kpi-min');
  const kpiMinDate = el('kpi-min-date');
  const kpiBreak = el('kpi-break');
  const kpiRunway = el('kpi-runway');
  const kpiRunwayMeta = el('kpi-runway-meta');
  const kpiCoverage = el('kpi-coverage');
  const kpiCoverageMeta = el('kpi-coverage-meta');
  const kpiReserve = el('kpi-reserve');
  const initialLabel = el('projection-initial');

  const scenarioStatus = el('scenario-status');
  const projectionLastRun = el('projection-last-run');
  const scenarioState = el('scenario-state');

  const timelinePath = el('timeline-path');
  const timelineArea = el('timeline-area');
  const timelineZero = el('timeline-zero');
  const timelineReserve = el('timeline-reserve');
  const timelineEmpty = el('timeline-empty');
  const tbody = el('timeline-body');
  const riskList = el('risk-list');
  const reductionsWrap = el('sim-reductions');
  const overrideList = el('override-list');

  const calendarGrid = el('calendar-grid');
  const calendarRange = el('calendar-range');
  const calendarAvg = el('calendar-avg');
  const calendarPositive = el('calendar-positive');
  const calendarNegative = el('calendar-negative');
  const calendarEmpty = el('calendar-empty');

  const coverageHighValue = el('coverage-high-value');
  const coverageHighBar = el('coverage-high-bar');
  const coverageHighMeta = el('coverage-high-meta');
  const coverageMediumValue = el('coverage-medium-value');
  const coverageMediumBar = el('coverage-medium-bar');
  const coverageMediumMeta = el('coverage-medium-meta');
  const coverageLowValue = el('coverage-low-value');
  const coverageLowBar = el('coverage-low-bar');
  const coverageLowMeta = el('coverage-low-meta');
  const coverageNote = el('coverage-note');

  const btnAddIncome = el('sim-add-income');
  const btnReset = el('sim-reset');

  // modal
  const modal = el('income-modal');
  const incomeDate = el('income-date');
  const incomeDesc = el('income-desc');
  const incomeValue = el('income-value');
  const incomeConfirm = el('income-confirm');

  const presets = page.querySelectorAll('[data-preset]');

  const state = {
    scenarioId: 0,
    scenarioName: 'Base',
    overrides: defaultOverrides(),
    savedOverrides: defaultOverrides(),
    dirty: false,
    lastData: null,
    lastRunAt: null,
    debounce: null,
  };

  function defaultOverrides() {
    return {
      shifts: [],
      reductions: [],
      extras: [],
      splits: [],
      reserve: null,
    };
  }

  function cloneOverrides(overrides) {
    return JSON.parse(JSON.stringify(overrides || defaultOverrides()));
  }

  function syncCustomSelect(selectEl) {
    if (selectEl && typeof selectEl._customUpdate === 'function') {
      selectEl._customUpdate();
    }
  }

  function rebuildCustomSelect(selectEl) {
    if (selectEl && typeof selectEl._customRebuild === 'function') {
      selectEl._customRebuild();
    }
  }

  function initCustomSelect(selectEl) {
    if (!selectEl || selectEl.dataset.customized) return;
    selectEl.dataset.customized = 'true';

    const wrapper = document.createElement('div');
    wrapper.className = 'select';

    selectEl.parentNode.insertBefore(wrapper, selectEl);
    wrapper.appendChild(selectEl);
    selectEl.classList.add('select-native');
    selectEl.tabIndex = -1;

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'control select-trigger';
    trigger.setAttribute('aria-haspopup', 'listbox');
    wrapper.appendChild(trigger);

    const list = document.createElement('div');
    list.className = 'select-options';
    list.setAttribute('role', 'listbox');
    wrapper.appendChild(list);

    function buildOptions() {
      list.innerHTML = '';
      Array.from(selectEl.options).forEach((opt) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'select-option';
        btn.dataset.value = opt.value;
        btn.textContent = opt.textContent;
        btn.disabled = opt.disabled;
        list.appendChild(btn);
      });
    }

    function updateFromSelect() {
      const current = selectEl.options[selectEl.selectedIndex];
      trigger.textContent = current ? current.textContent : '';
      wrapper.classList.toggle('is-disabled', !!selectEl.disabled);
      trigger.disabled = !!selectEl.disabled;
      list.querySelectorAll('.select-option').forEach((btn) => {
        btn.classList.toggle('is-selected', btn.dataset.value === selectEl.value);
      });
    }

    selectEl._customUpdate = updateFromSelect;
    selectEl._customRebuild = function () {
      buildOptions();
      updateFromSelect();
    };
    selectEl._custom = { wrapper, trigger, list };

    buildOptions();
    updateFromSelect();

    trigger.addEventListener('click', (ev) => {
      ev.stopPropagation();
      if (selectEl.disabled) return;
      wrapper.classList.toggle('open');
    });

    list.addEventListener('click', (ev) => {
      const btn = ev.target.closest('.select-option');
      if (!btn || btn.disabled) return;
      selectEl.value = btn.dataset.value;
      selectEl.dispatchEvent(new Event('change', { bubbles: true }));
      updateFromSelect();
      wrapper.classList.remove('open');
    });

    document.addEventListener('click', (ev) => {
      if (!wrapper.contains(ev.target)) wrapper.classList.remove('open');
    });

    selectEl.addEventListener('change', updateFromSelect);
  }

  function parseISO(iso) {
    if (!iso) return null;
    const parts = String(iso).split('-');
    if (parts.length !== 3) return null;
    return { y: parts[0], m: parts[1], d: parts[2] };
  }

  function fmtDate(iso) {
    const p = parseISO(iso);
    if (!p) return '—';
    return `${p.d}/${p.m}/${p.y}`;
  }

  function clamp(num, min, max) {
    return Math.max(min, Math.min(max, num));
  }

  function setTodayDefaults() {
    const today = new Date();
    const start = toISO(today);
    const end = toISO(addDays(today, 60));
    if (startInput) startInput.value = start;
    if (endInput) endInput.value = end;
    if (reserveInput) reserveInput.value = '0';
    if (modeSelect) modeSelect.value = 'cash';
    if (recurringToggle) recurringToggle.checked = true;
    syncReserveOverride(false);
    syncCustomSelect(modeSelect);
  }

  function addDays(dateObj, days) {
    const d = new Date(dateObj.getTime());
    d.setDate(d.getDate() + days);
    return d;
  }

  function toISO(dateObj) {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function endOfMonthISO(dateIso) {
    const p = parseISO(dateIso);
    if (!p) return null;
    const y = Number(p.y), m = Number(p.m);
    const last = new Date(y, m, 0); // day 0 => last day of previous month => for month m
    return toISO(last);
  }

  function updateScenarioStatus() {
    const summary = overrideSummary();
    if (scenarioStatus) {
      const syncLabel = state.dirty ? 'alterações pendentes' : 'sincronizado';
      scenarioStatus.textContent = `${state.scenarioName} • ${syncLabel}`;
      scenarioStatus.classList.toggle('is-dirty', state.dirty);
    }
    if (scenarioState) {
      scenarioState.textContent = summary.total ? `Alterações: ${summary.text}` : 'Sem alterações no cenário';
      scenarioState.classList.toggle('is-dirty', state.dirty);
    }
  }

  function updateLastRun() {
    if (!projectionLastRun) return;
    if (!state.lastRunAt) {
      projectionLastRun.textContent = 'Atualizado: —';
      return;
    }
    const stamp = state.lastRunAt.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
    projectionLastRun.textContent = `Atualizado: ${stamp}`;
  }

  function markDirty() {
    state.dirty = true;
    updateScenarioStatus();
  }

  function overrideSummary() {
    const shifts = (state.overrides.shifts || []).length;
    const splits = (state.overrides.splits || []).length;
    const reductions = (state.overrides.reductions || []).filter((r) => Number(r.percent) > 0).length;
    const extras = (state.overrides.extras || []).length;
    const reserve = state.overrides.reserve && Number(state.overrides.reserve) > 0 ? 1 : 0;
    const parts = [];
    if (shifts) parts.push(`${shifts} adiamento${shifts > 1 ? 's' : ''}`);
    if (splits) parts.push(`${splits} parcela${splits > 1 ? 's' : ''}`);
    if (reductions) parts.push(`${reductions} redução${reductions > 1 ? 's' : ''}`);
    if (extras) parts.push(`${extras} extra${extras > 1 ? 's' : ''}`);
    if (reserve) parts.push('reserva ajustada');
    return { total: shifts + splits + reductions + extras + reserve, text: parts.join(' • ') };
  }
  function syncReserveOverride(shouldMark) {
    if (!reserveInput) return;
    const raw = Number(reserveInput.value || 0);
    if (!isFinite(raw) || raw <= 0) {
      state.overrides.reserve = null;
    } else {
      state.overrides.reserve = Number(raw.toFixed(2));
    }
    if (shouldMark) markDirty();
  }

  function applyOverrides(overrides) {
    state.overrides = cloneOverrides(overrides);
    if (reserveInput) {
      const reserveValue = state.overrides.reserve;
      reserveInput.value = reserveValue != null ? String(reserveValue) : '0';
    }
    updateScenarioStatus();
  }

  function resetToBase() {
    state.scenarioId = 0;
    state.scenarioName = 'Base';
    const base = defaultOverrides();
    state.overrides = cloneOverrides(base);
    state.savedOverrides = cloneOverrides(base);
    state.dirty = false;
    if (scenarioSelect) scenarioSelect.value = '0';
    if (reserveInput) reserveInput.value = '0';
    updateScenarioStatus();
    syncCustomSelect(scenarioSelect);
  }

  function resetToSaved() {
    if (state.scenarioId && state.savedOverrides) {
      applyOverrides(state.savedOverrides);
      state.dirty = false;
      updateScenarioStatus();
    } else {
      resetToBase();
    }
    runDebounced();
  }

  function showModal() {
    if (!modal) return;
    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
  }
  function hideModal() {
    if (!modal) return;
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
  }

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target && (e.target.matches('[data-close]') || e.target.closest('[data-close]'))) {
        hideModal();
      }
    });
  }

  if (btnAddIncome) {
    btnAddIncome.addEventListener('click', () => {
      if (incomeDate) incomeDate.value = startInput?.value || toISO(new Date());
      if (incomeDesc) incomeDesc.value = '';
      if (incomeValue) incomeValue.value = '';
      showModal();
    });
  }

  if (incomeConfirm) {
    incomeConfirm.addEventListener('click', () => {
      const d = incomeDate?.value;
      const v = Number(incomeValue?.value || 0);
      const desc = (incomeDesc?.value || 'Renda extra').trim();
      if (!d || !isFinite(v) || v <= 0) {
        alert('Informe uma data e um valor > 0.');
        return;
      }
      state.overrides.extras.push({
        date: d,
        descricao: desc,
        tipo: 'receita',
        valor: Number(v.toFixed(2)),
        categoria: 'ajustes',
      });
      markDirty();
      hideModal();
      runDebounced();
    });
  }

  if (btnReset) {
    btnReset.addEventListener('click', () => resetToSaved());
  }

  if (btnScenarioClear) {
    btnScenarioClear.addEventListener('click', () => resetToSaved());
  }

  presets.forEach((btn) => {
    btn.addEventListener('click', () => {
      const preset = btn.getAttribute('data-preset');
      const start = startInput?.value || toISO(new Date());
      if (preset === 'eom') {
        if (endInput) endInput.value = endOfMonthISO(start) || endInput.value;
      } else {
        const n = Number(preset);
        if (isFinite(n) && n > 0) {
          const sd = new Date(start + 'T00:00:00');
          if (endInput) endInput.value = toISO(addDays(sd, n));
        }
      }
      runDebounced();
    });
  });

  if (startInput) startInput.addEventListener('change', () => runDebounced());
  if (endInput) endInput.addEventListener('change', () => runDebounced());
  if (modeSelect) modeSelect.addEventListener('change', () => runDebounced());
  if (recurringToggle) recurringToggle.addEventListener('change', () => runDebounced());
  if (reserveInput) {
    reserveInput.addEventListener('input', () => {
      syncReserveOverride(true);
      runDebounced();
    });
  }

  if (btnRun) btnRun.addEventListener('click', () => runProjection());

  function runDebounced() {
    clearTimeout(state.debounce);
    state.debounce = setTimeout(() => runProjection(), 250);
  }

  async function fetchJSON(url, opts) {
    const res = await fetch(url, opts);
    if (!res.ok) {
      let msg = `Erro ${res.status}`;
      try {
        const data = await res.json();
        if (data && data.error) msg = data.error;
      } catch (e) {}
      throw new Error(msg);
    }
    return res.json();
  }

  async function loadScenarios(selectId) {
    const list = await fetchJSON('/app/projection/scenarios');
    if (!scenarioSelect) return;
    scenarioSelect.innerHTML = '';
    const baseOpt = document.createElement('option');
    baseOpt.value = '0';
    baseOpt.textContent = 'Base';
    scenarioSelect.appendChild(baseOpt);

    list.forEach((sc) => {
      const opt = document.createElement('option');
      opt.value = String(sc.id);
      opt.textContent = sc.name;
      scenarioSelect.appendChild(opt);
    });

    scenarioSelect.value = String(selectId || state.scenarioId || 0);
    rebuildCustomSelect(scenarioSelect);
    syncCustomSelect(scenarioSelect);
  }

  if (scenarioSelect) {
    scenarioSelect.addEventListener('change', async () => {
      const id = Number(scenarioSelect.value || 0);
      state.scenarioId = id;
      state.dirty = false;

      if (!id) {
        resetToBase();
        runDebounced();
        return;
      }

      try {
        const detail = await fetchJSON(`/app/projection/scenarios/${id}`);
        state.scenarioName = detail.name || 'Cenário';
        state.overrides = detail.overrides || defaultOverrides();
        state.savedOverrides = cloneOverrides(state.overrides);
        state.dirty = false;
        if (reserveInput) {
          const reserveValue = state.overrides.reserve;
          reserveInput.value = reserveValue != null ? String(reserveValue) : '0';
        }
        updateScenarioStatus();
        runDebounced();
      } catch (e) {
        alert(e.message);
      }
    });
  }

  if (btnSave) {
    btnSave.addEventListener('click', async () => {
      if (!state.scenarioId) {
        alert('Selecione um cenário (ou use "Salvar como").');
        return;
      }
      try {
        await fetchJSON(`/app/projection/scenarios/${state.scenarioId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ overrides: state.overrides }),
        });
        state.dirty = false;
        state.savedOverrides = cloneOverrides(state.overrides);
        await loadScenarios(state.scenarioId);
        updateScenarioStatus();
        alert('Cenário atualizado.');
      } catch (e) {
        alert(e.message);
      }
    });
  }

  if (btnSaveAs) {
    btnSaveAs.addEventListener('click', async () => {
      const name = prompt('Nome do novo cenário:', state.scenarioName === 'Base' ? 'Meu cenário 1' : `${state.scenarioName} (cópia)`);
      if (!name) return;
      try {
        const out = await fetchJSON('/app/projection/scenarios', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, overrides: state.overrides }),
        });
        state.scenarioId = out.id;
        state.scenarioName = name;
        state.dirty = false;
        state.savedOverrides = cloneOverrides(state.overrides);
        await loadScenarios(state.scenarioId);
        if (scenarioSelect) scenarioSelect.value = String(state.scenarioId);
        updateScenarioStatus();
        alert('Cenário criado.');
      } catch (e) {
        alert(e.message);
      }
    });
  }

  if (btnDelete) {
    btnDelete.addEventListener('click', async () => {
      if (!state.scenarioId) return;
      if (!confirm('Excluir este cenário?')) return;
      try {
        await fetchJSON(`/app/projection/scenarios/${state.scenarioId}`, { method: 'DELETE' });
        resetToBase();
        await loadScenarios(0);
        runDebounced();
      } catch (e) {
        alert(e.message);
      }
    });
  }

  function buildPayload() {
    syncReserveOverride(false);
    const payload = {
      start: startInput?.value,
      end: endInput?.value,
      mode: modeSelect?.value,
      include_recurring: recurringToggle?.checked,
      reserve_min: Number(reserveInput?.value || 0),
      overrides: state.overrides,
    };
    if (state.scenarioId) payload.scenario_id = state.scenarioId;
    return payload;
  }

  async function runProjection() {
    // valida datas
    if (!startInput?.value || !endInput?.value) return;
    try {
      const data = await fetchJSON('/app/projection/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload()),
      });
      state.lastData = data;
      state.lastRunAt = new Date();
      updateLastRun();
      renderAll(data);
    } catch (e) {
      console.error(e);
      alert(e.message || 'Falha ao simular projeção.');
    }
  }

  function calcRunwayDays(startIso, breakIso) {
    if (!breakIso) return null;
    const start = new Date(`${startIso}T00:00:00`);
    const end = new Date(`${breakIso}T00:00:00`);
    const diff = Math.round((end - start) / 86400000);
    return diff >= 0 ? diff : 0;
  }
  function renderAll(data) {
    // KPIs
    if (initialLabel) initialLabel.textContent = `Saldo inicial: ${fmtBRL.format(Number(data.saldo_inicial || 0))}`;
    if (kpiFinal) kpiFinal.textContent = fmtBRL.format(Number(data.saldo_final || 0));
    if (kpiMin) kpiMin.textContent = fmtBRL.format(Number(data.min_saldo || 0));
    if (kpiMinDate) kpiMinDate.textContent = fmtDate(data.min_saldo_date);
    if (kpiBreak) kpiBreak.textContent = data.break_date ? fmtDate(data.break_date) : '—';
    if (kpiCoverage) kpiCoverage.textContent = `${Number((data.coverage && data.coverage.percent) || 100).toFixed(1)}%`;
    if (kpiCoverageMeta) kpiCoverageMeta.textContent = `${(data.coverage && data.coverage.covered_count) || 0}/${(data.coverage && data.coverage.total_expenses) || 0}`;
    if (kpiReserve) kpiReserve.textContent = fmtBRL.format(Number(data.recommended_reserve || 0));

    const rangeStart = (data.range && data.range.start) || startInput?.value;
    const runwayDays = calcRunwayDays(rangeStart, data.break_date);
    if (kpiRunway) kpiRunway.textContent = runwayDays === null ? 'Sem quebra' : `${runwayDays} dia${runwayDays === 1 ? '' : 's'}`;
    if (kpiRunwayMeta) kpiRunwayMeta.textContent = data.break_date ? `Quebra em ${fmtDate(data.break_date)}` : 'Saldo não fica negativo';

    // Chart
    renderChart(data.daily || [], Number(data.reserve_min || 0));

    // Calendar
    renderCalendar(data.daily || [], data.range || {});

    // Table
    renderTable(data.events || []);

    // Risks
    renderRisks(data.risks || []);

    // Reductions
    renderReductions(data.categories || []);

    // Coverage
    renderCoverage(data.events || []);

    // Overrides
    renderOverrides();

    updateScenarioStatus();
  }

  function renderChart(daily, reserveMin) {
    if (!timelinePath || !timelineArea || !timelineZero || !timelineReserve || !timelineEmpty) return;
    if (!Array.isArray(daily) || daily.length < 2) {
      timelinePath.setAttribute('d', '');
      timelineArea.setAttribute('d', '');
      timelineZero.setAttribute('d', '');
      timelineReserve.setAttribute('d', '');
      timelineEmpty.style.display = 'flex';
      return;
    }
    timelineEmpty.style.display = 'none';

    const values = daily.map((p) => Number(p.saldo || 0));
    const extra = [0];
    if (isFinite(reserveMin)) extra.push(reserveMin);
    let min = Math.min(...values, ...extra);
    let max = Math.max(...values, ...extra);
    if (min === max) {
      min -= 1;
      max += 1;
    }
    const pad = (max - min) * 0.1;
    min -= pad;
    max += pad;

    const x0 = 30, x1 = 790;
    const y0 = 30, y1 = 210;

    const n = daily.length - 1;
    const scaleY = (v) => {
      const t = (v - min) / (max - min);
      return y1 - (y1 - y0) * t;
    };

    const points = daily.map((p, i) => {
      const x = x0 + (x1 - x0) * (i / n);
      const v = Number(p.saldo || 0);
      const y = scaleY(v);
      return { x, y };
    });

    let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
    for (let i = 1; i < points.length; i++) {
      d += ` L ${points[i].x.toFixed(1)} ${points[i].y.toFixed(1)}`;
    }
    timelinePath.setAttribute('d', d);

    const zeroY = scaleY(0);
    timelineZero.setAttribute('d', `M ${x0} ${zeroY.toFixed(1)} H ${x1}`);

    if (reserveMin > 0) {
      const resY = scaleY(reserveMin);
      timelineReserve.setAttribute('d', `M ${x0} ${resY.toFixed(1)} H ${x1}`);
    } else {
      timelineReserve.setAttribute('d', '');
    }

    let area = `M ${points[0].x.toFixed(1)} ${zeroY.toFixed(1)}`;
    for (let i = 0; i < points.length; i++) {
      area += ` L ${points[i].x.toFixed(1)} ${points[i].y.toFixed(1)}`;
    }
    area += ` L ${points[points.length - 1].x.toFixed(1)} ${zeroY.toFixed(1)} Z`;
    timelineArea.setAttribute('d', area);

    const hasNegative = values.some((v) => v < 0);
    timelinePath.classList.toggle('is-negative', hasNegative);
    timelineArea.classList.toggle('is-negative', hasNegative);
  }

  function badge(text, cls) {
    const span = document.createElement('span');
    span.className = `badge ${cls || ''}`.trim();
    span.textContent = text;
    return span;
  }

  function renderTable(events) {
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!Array.isArray(events) || events.length === 0) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 9;
      td.textContent = 'Sem eventos no período.';
      td.style.padding = '14px';
      td.style.color = 'rgba(255,255,255,0.7)';
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }

    events.forEach((ev) => {
      const tr = document.createElement('tr');
      tr.classList.toggle('is-uncovered', ev.covered === false);

      const tdDate = document.createElement('td');
      tdDate.textContent = fmtDate(ev.date);
      tr.appendChild(tdDate);

      const tdDesc = document.createElement('td');
      tdDesc.textContent = ev.descricao || '';
      tr.appendChild(tdDesc);

      const tdCat = document.createElement('td');
      tdCat.appendChild(badge((ev.categoria || 'outros'), ''));
      tr.appendChild(tdCat);

      const tdType = document.createElement('td');
      if (ev.tipo === 'receita') tdType.appendChild(badge('Receita', 'type-income'));
      else tdType.appendChild(badge('Despesa', 'type-expense'));
      tr.appendChild(tdType);

      const tdVal = document.createElement('td');
      tdVal.textContent = fmtBRL.format(Number(ev.valor || 0));
      tr.appendChild(tdVal);

      const tdSaldo = document.createElement('td');
      tdSaldo.textContent = fmtBRL.format(Number(ev.saldo_after || 0));
      tr.appendChild(tdSaldo);

      const tdStatus = document.createElement('td');
      tdStatus.textContent = (ev.status || '—');
      tr.appendChild(tdStatus);

      const tdCovered = document.createElement('td');
      if (ev.covered === true) tdCovered.appendChild(badge('Sim', 'cover-yes'));
      else if (ev.covered === false) tdCovered.appendChild(badge('Não', 'cover-no'));
      else tdCovered.textContent = '—';
      tr.appendChild(tdCovered);

      const tdActions = document.createElement('td');
      const wrap = document.createElement('div');
      wrap.className = 'row-actions';

      // Priority + simuladores apenas para despesas de entrada
      if (ev.tipo === 'despesa' && ev.source === 'entry' && ev.id) {
        const pr = String(ev.priority || 'media').toLowerCase();
        const prBadge = badge(`Prior: ${pr}`, `priority ${pr}`);
        prBadge.title = 'Clique para alternar prioridade (Alta/Média/Baixa)';
        prBadge.addEventListener('click', () => cyclePriority(ev.id, pr));
        tdActions.appendChild(prBadge);

        const btnShift = document.createElement('button');
        btnShift.type = 'button';
        btnShift.textContent = 'Adiar';
        btnShift.addEventListener('click', () => shiftExpense(ev.id, ev.date));
        wrap.appendChild(btnShift);

        const btnSplit = document.createElement('button');
        btnSplit.type = 'button';
        btnSplit.textContent = 'Parcelar';
        btnSplit.addEventListener('click', () => splitExpense(ev.id));
        wrap.appendChild(btnSplit);
      } else {
        const small = document.createElement('span');
        small.style.color = 'rgba(255,255,255,0.55)';
        small.style.fontWeight = '900';
        small.style.fontSize = '12px';
        small.textContent = '—';
        wrap.appendChild(small);
      }

      tdActions.appendChild(wrap);
      tr.appendChild(tdActions);

      tbody.appendChild(tr);
    });
  }
  async function cyclePriority(entradaId, current) {
    const next = current === 'alta' ? 'media' : (current === 'media' ? 'baixa' : 'alta');
    try {
      await fetchJSON(`/app/projection/entry/${entradaId}/priority`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priority: next }),
      });
      runDebounced();
    } catch (e) {
      alert(e.message);
    }
  }

  function upsertShift(entradaId, newDate) {
    const shifts = state.overrides.shifts || [];
    const idx = shifts.findIndex((s) => Number(s.entrada_id) === Number(entradaId));
    const item = { entrada_id: Number(entradaId), new_date: newDate };
    if (idx >= 0) shifts[idx] = item;
    else shifts.push(item);
    state.overrides.shifts = shifts;
  }

  function upsertSplit(entradaId, parts) {
    const splits = state.overrides.splits || [];
    const idx = splits.findIndex((s) => Number(s.entrada_id) === Number(entradaId));
    const item = { entrada_id: Number(entradaId), parts: Number(parts), frequency: 'monthly' };
    if (idx >= 0) splits[idx] = item;
    else splits.push(item);
    state.overrides.splits = splits;
  }

  function shiftExpense(entradaId, currentDateIso) {
    const nd = prompt('Nova data (YYYY-MM-DD):', currentDateIso || startInput?.value);
    if (!nd) return;
    // valida básico
    if (!/^\d{4}-\d{2}-\d{2}$/.test(nd)) {
      alert('Formato inválido. Use YYYY-MM-DD.');
      return;
    }
    upsertShift(entradaId, nd);
    markDirty();
    runDebounced();
  }

  function splitExpense(entradaId) {
    const parts = Number(prompt('Em quantas parcelas? (2 a 24)', '3') || 0);
    if (!isFinite(parts) || parts < 2 || parts > 24) {
      alert('Número inválido (2 a 24).');
      return;
    }
    upsertSplit(entradaId, parts);
    markDirty();
    runDebounced();
  }

  function renderRisks(risks) {
    if (!riskList) return;
    riskList.innerHTML = '';
    if (!Array.isArray(risks) || risks.length === 0) {
      const div = document.createElement('div');
      div.className = 'risk-item';
      div.innerHTML = '<strong>Sem alertas</strong><div class="risk-sub">No período selecionado, não encontramos riscos relevantes.</div>';
      riskList.appendChild(div);
      return;
    }

    risks.forEach((r) => {
      const div = document.createElement('div');
      div.className = 'risk-item';

      const title = document.createElement('strong');
      title.textContent = r.message || 'Alerta';
      div.appendChild(title);

      if (r.type === 'uncovered' && Array.isArray(r.items)) {
        const sub = document.createElement('div');
        sub.className = 'risk-sub';
        sub.textContent = 'Principais despesas descobertas:';
        div.appendChild(sub);

        const mini = document.createElement('div');
        mini.className = 'risk-mini';
        r.items.forEach((it) => {
          const row = document.createElement('div');
          row.className = 'mini';
          const left = document.createElement('span');
          left.textContent = `${fmtDate(it.date)} • ${it.descricao || ''}`;
          const right = document.createElement('span');
          right.textContent = fmtBRL.format(Number(it.valor || 0));
          row.appendChild(left);
          row.appendChild(right);
          mini.appendChild(row);
        });
        div.appendChild(mini);
      } else if (r.type === 'low_window') {
        const sub = document.createElement('div');
        sub.className = 'risk-sub';
        sub.textContent = `Janela crítica: ${fmtDate(r.from)} até ${fmtDate(r.to)}.`;
        div.appendChild(sub);
      } else {
        const sub = document.createElement('div');
        sub.className = 'risk-sub';
        sub.textContent = 'Ajuste com simuladores para testar alternativas (adiar, parcelar, renda extra).';
        div.appendChild(sub);
      }

      riskList.appendChild(div);
    });
  }

  function renderReductions(categories) {
    if (!reductionsWrap) return;
    reductionsWrap.innerHTML = '';
    if (!Array.isArray(categories) || categories.length === 0) {
      const div = document.createElement('div');
      div.style.color = 'rgba(255,255,255,0.65)';
      div.style.fontWeight = '900';
      div.style.fontSize = '12px';
      div.textContent = 'Sem categorias de despesa no período.';
      reductionsWrap.appendChild(div);
      return;
    }

    const top = categories.slice(0, 6);

    top.forEach((c) => {
      const row = document.createElement('div');
      row.className = 'reduction-row';

      const label = document.createElement('div');
      label.style.display = 'grid';
      label.style.gap = '2px';
      const name = document.createElement('strong');
      name.style.fontSize = '12px';
      name.textContent = `${c.label || c.key}`;
      const meta = document.createElement('span');
      meta.style.color = 'rgba(255,255,255,0.65)';
      meta.style.fontWeight = '900';
      meta.style.fontSize = '12px';
      meta.textContent = `Total: ${fmtBRL.format(Number(c.total || 0))}`;
      label.appendChild(name);
      label.appendChild(meta);

      const input = document.createElement('input');
      input.type = 'number';
      input.min = '0';
      input.max = '100';
      input.step = '1';
      input.placeholder = '%';
      input.value = String(getReductionPercent(c.key) || '');

      input.addEventListener('input', () => {
        const pct = clamp(Number(input.value || 0), 0, 100);
        setReduction(c.key, pct);
        markDirty();
        runDebounced();
      });

      row.appendChild(label);
      row.appendChild(input);
      reductionsWrap.appendChild(row);
    });
  }

  function getReductionPercent(catKey) {
    const r = (state.overrides.reductions || []).find((x) => String(x.categoria || '').toLowerCase() === String(catKey).toLowerCase());
    return r ? Number(r.percent || 0) : 0;
  }

  function setReduction(catKey, percent) {
    const arr = state.overrides.reductions || [];
    const key = String(catKey || '').toLowerCase();
    const idx = arr.findIndex((x) => String(x.categoria || '').toLowerCase() === key);

    if (!percent || percent <= 0) {
      if (idx >= 0) arr.splice(idx, 1);
      state.overrides.reductions = arr;
      return;
    }

    const item = { categoria: key, percent: Number(percent) };
    if (idx >= 0) arr[idx] = item;
    else arr.push(item);
    state.overrides.reductions = arr;
  }
  function renderCoverage(events) {
    if (!coverageHighValue || !coverageMediumValue || !coverageLowValue) return;
    const stats = {
      alta: { covered: 0, total: 0 },
      media: { covered: 0, total: 0 },
      baixa: { covered: 0, total: 0 },
    };

    (events || []).forEach((ev) => {
      if (ev.tipo !== 'despesa') return;
      const pr = String(ev.priority || 'media').toLowerCase();
      const bucket = stats[pr] || stats.media;
      bucket.total += 1;
      if (ev.covered === true) bucket.covered += 1;
    });

    const totalExpenses = Object.values(stats).reduce((acc, item) => acc + item.total, 0);
    const coveredExpenses = Object.values(stats).reduce((acc, item) => acc + item.covered, 0);
    const uncovered = totalExpenses - coveredExpenses;

    setCoverageItem(stats.alta, coverageHighValue, coverageHighBar, coverageHighMeta);
    setCoverageItem(stats.media, coverageMediumValue, coverageMediumBar, coverageMediumMeta);
    setCoverageItem(stats.baixa, coverageLowValue, coverageLowBar, coverageLowMeta);

    if (coverageNote) {
      coverageNote.textContent = uncovered > 0
        ? `${uncovered} despesa(s) ficam descobertas com a regra de prioridade.`
        : 'Todas as despesas ficam cobertas pela reserva configurada.';
    }
  }

  function setCoverageItem(stat, valueEl, barEl, metaEl) {
    const percent = stat.total ? (stat.covered / stat.total) * 100 : 100;
    if (valueEl) valueEl.textContent = `${percent.toFixed(1)}%`;
    if (barEl) barEl.style.width = `${percent}%`;
    if (metaEl) metaEl.textContent = `${stat.covered}/${stat.total} cobertas`;
  }

  function renderCalendar(daily, range) {
    if (!calendarGrid || !calendarEmpty) return;
    calendarGrid.innerHTML = '';

    if (!Array.isArray(daily) || daily.length === 0) {
      calendarEmpty.style.display = 'flex';
      if (calendarRange) calendarRange.textContent = '—';
      if (calendarAvg) calendarAvg.textContent = 'R$ 0,00';
      if (calendarPositive) calendarPositive.textContent = '0';
      if (calendarNegative) calendarNegative.textContent = '0';
      return;
    }

    calendarEmpty.style.display = 'none';

    const startIso = range.start || daily[0].date;
    const endIso = range.end || daily[daily.length - 1].date;
    if (calendarRange) calendarRange.textContent = `${fmtDate(startIso)} — ${fmtDate(endIso)}`;

    const values = daily.map((d) => Number(d.saldo || 0));
    const maxPos = Math.max(0, ...values);
    const maxNeg = Math.min(0, ...values);

    const startDate = new Date(`${startIso}T00:00:00`);
    const offset = (startDate.getDay() + 6) % 7; // Monday first
    for (let i = 0; i < offset; i++) {
      const empty = document.createElement('div');
      empty.className = 'calendar-cell is-empty';
      calendarGrid.appendChild(empty);
    }

    let positiveDays = 0;
    let negativeDays = 0;
    const total = values.reduce((acc, v) => acc + v, 0);

    daily.forEach((d) => {
      const v = Number(d.saldo || 0);
      const cell = document.createElement('div');
      cell.className = 'calendar-cell';
      const dateObj = new Date(`${d.date}T00:00:00`);
      cell.textContent = String(dateObj.getDate());
      cell.title = `${fmtDate(d.date)} • ${fmtBRL.format(v)}`;

      if (v > 0) {
        positiveDays += 1;
        const level = calcIntensity(v, maxPos);
        cell.classList.add(`pos-${level}`);
      } else if (v < 0) {
        negativeDays += 1;
        const level = calcIntensity(v, Math.abs(maxNeg));
        cell.classList.add(`neg-${level}`);
      } else {
        cell.classList.add('neutral');
      }

      calendarGrid.appendChild(cell);
    });

    const avg = total / values.length;
    if (calendarAvg) calendarAvg.textContent = fmtBRL.format(avg);
    if (calendarPositive) calendarPositive.textContent = String(positiveDays);
    if (calendarNegative) calendarNegative.textContent = String(negativeDays);
  }

  function calcIntensity(value, maxAbs) {
    if (!maxAbs || maxAbs <= 0) return 1;
    const ratio = Math.min(1, Math.abs(value) / maxAbs);
    if (ratio > 0.75) return 4;
    if (ratio > 0.5) return 3;
    if (ratio > 0.25) return 2;
    return 1;
  }

  function renderOverrides() {
    if (!overrideList) return;
    overrideList.innerHTML = '';

    const overrides = state.overrides || {};
    const entryMap = buildEntryMap();
    let count = 0;

    const addItem = (title, meta, type, index) => {
      const item = document.createElement('div');
      item.className = 'override-item';

      const content = document.createElement('div');
      const h = document.createElement('div');
      h.className = 'override-title';
      h.textContent = title;
      const m = document.createElement('div');
      m.className = 'override-meta';
      m.textContent = meta;
      content.appendChild(h);
      content.appendChild(m);

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn-mini';
      btn.textContent = 'Remover';
      btn.setAttribute('data-remove', 'true');
      btn.setAttribute('data-type', type);
      btn.setAttribute('data-index', String(index));

      item.appendChild(content);
      item.appendChild(btn);
      overrideList.appendChild(item);
    };

    if (Array.isArray(overrides.shifts)) {
      overrides.shifts.forEach((s, idx) => {
        const label = entryMap.get(Number(s.entrada_id)) || `Entrada #${s.entrada_id}`;
        addItem('Adiar despesa', `${label} • nova data ${fmtDate(s.new_date)}`, 'shift', idx);
        count += 1;
      });
    }

    if (Array.isArray(overrides.splits)) {
      overrides.splits.forEach((s, idx) => {
        const label = entryMap.get(Number(s.entrada_id)) || `Entrada #${s.entrada_id}`;
        addItem('Parcelar despesa', `${label} • ${s.parts}x`, 'split', idx);
        count += 1;
      });
    }

    if (Array.isArray(overrides.reductions)) {
      overrides.reductions.forEach((r, idx) => {
        if (!r || !r.percent || Number(r.percent) <= 0) return;
        const cat = String(r.categoria || 'outros');
        addItem('Redução por categoria', `${cat} • -${Number(r.percent)}%`, 'reduction', idx);
        count += 1;
      });
    }

    if (Array.isArray(overrides.extras)) {
      overrides.extras.forEach((ex, idx) => {
        const label = ex.tipo === 'despesa' ? 'Despesa extra' : 'Renda extra';
        const meta = `${fmtDate(ex.date)} • ${fmtBRL.format(Number(ex.valor || 0))}`;
        addItem(label, meta, 'extra', idx);
        count += 1;
      });
    }

    if (overrides.reserve && Number(overrides.reserve) > 0) {
      addItem('Reserva mínima ajustada', fmtBRL.format(Number(overrides.reserve)), 'reserve', 0);
      count += 1;
    }

    if (!count) {
      const empty = document.createElement('div');
      empty.className = 'risk-item';
      empty.innerHTML = '<strong>Sem ajustes</strong><div class="risk-sub">Nenhum simulador aplicado no cenário atual.</div>';
      overrideList.appendChild(empty);
    }
  }

  function buildEntryMap() {
    const map = new Map();
    const events = state.lastData && state.lastData.events ? state.lastData.events : [];
    events.forEach((ev) => {
      if (ev && ev.id && ev.descricao) {
        map.set(Number(ev.id), ev.descricao);
      }
    });
    return map;
  }

  if (overrideList) {
    overrideList.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-remove]');
      if (!btn) return;
      const type = btn.getAttribute('data-type');
      const idx = Number(btn.getAttribute('data-index'));
      removeOverride(type, idx);
    });
  }

  function removeOverride(type, index) {
    switch (type) {
      case 'shift':
        if (Array.isArray(state.overrides.shifts)) state.overrides.shifts.splice(index, 1);
        break;
      case 'split':
        if (Array.isArray(state.overrides.splits)) state.overrides.splits.splice(index, 1);
        break;
      case 'reduction':
        if (Array.isArray(state.overrides.reductions)) state.overrides.reductions.splice(index, 1);
        break;
      case 'extra':
        if (Array.isArray(state.overrides.extras)) state.overrides.extras.splice(index, 1);
        break;
      case 'reserve':
        state.overrides.reserve = null;
        if (reserveInput) reserveInput.value = '0';
        break;
      default:
        return;
    }
    markDirty();
    runDebounced();
  }

  // Init
  (async function init() {
    setTodayDefaults();
    updateScenarioStatus();
    updateLastRun();
    initCustomSelect(modeSelect);
    initCustomSelect(scenarioSelect);
    try {
      await loadScenarios(0);
    } catch (e) {
      console.warn(e);
    }
    runDebounced();
  })();
})();
