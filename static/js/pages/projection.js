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

  const kpiFinal = el('kpi-final');
  const kpiMin = el('kpi-min');
  const kpiMinDate = el('kpi-min-date');
  const kpiBreak = el('kpi-break');
  const kpiCoverage = el('kpi-coverage');
  const kpiCoverageMeta = el('kpi-coverage-meta');
  const kpiReserve = el('kpi-reserve');
  const initialLabel = el('projection-initial');

  const timelinePath = el('timeline-path');
  const timelineEmpty = el('timeline-empty');
  const tbody = el('timeline-body');
  const riskList = el('risk-list');
  const reductionsWrap = el('sim-reductions');

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
    dirty: false,
    lastData: null,
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
    startInput.value = start;
    endInput.value = end;
    reserveInput.value = "0";
    modeSelect.value = "cash";
    recurringToggle.checked = true;
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

  function showModal() {
    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
  }
  function hideModal() {
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
  }

  modal.addEventListener('click', (e) => {
    if (e.target && (e.target.matches('[data-close]') || e.target.closest('[data-close]'))) {
      hideModal();
    }
  });

  btnAddIncome.addEventListener('click', () => {
    incomeDate.value = startInput.value || toISO(new Date());
    incomeDesc.value = '';
    incomeValue.value = '';
    showModal();
  });

  incomeConfirm.addEventListener('click', () => {
    const d = incomeDate.value;
    const v = Number(incomeValue.value || 0);
    const desc = (incomeDesc.value || 'Renda extra').trim();
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
    state.dirty = true;
    hideModal();
    runDebounced();
  });

  btnReset.addEventListener('click', () => {
    state.scenarioId = 0;
    state.scenarioName = 'Base';
    state.overrides = defaultOverrides();
    state.dirty = false;
    scenarioSelect.value = "0";
    runDebounced();
  });

  presets.forEach((btn) => {
    btn.addEventListener('click', () => {
      const preset = btn.getAttribute('data-preset');
      const start = startInput.value || toISO(new Date());
      if (preset === 'eom') {
        endInput.value = endOfMonthISO(start) || endInput.value;
      } else {
        const n = Number(preset);
        if (isFinite(n) && n > 0) {
          const sd = new Date(start + "T00:00:00");
          endInput.value = toISO(addDays(sd, n));
        }
      }
      runDebounced();
    });
  });

  btnRun.addEventListener('click', () => runProjection());

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
<<<<<<< HEAD
    const list = await fetchJSON('/app/projection/scenarios');
=======
    const list = await fetch('/app/projection/scenarios');
>>>>>>> 748ac02aa6f96c785f54b96d19f576dafc3d1383
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
  }

  scenarioSelect.addEventListener('change', async () => {
    const id = Number(scenarioSelect.value || 0);
    state.scenarioId = id;
    state.dirty = false;

    if (!id) {
      state.overrides = defaultOverrides();
      state.scenarioName = 'Base';
      runDebounced();
      return;
    }

    try {
<<<<<<< HEAD
      const detail = await fetchJSON(`/app/projection/scenarios/${id}`);
=======
      const detail = await fetch(`/app/projection/scenarios/${id}`);
>>>>>>> 748ac02aa6f96c785f54b96d19f576dafc3d1383
      state.scenarioName = detail.name || 'Cenário';
      state.overrides = detail.overrides || defaultOverrides();
      runDebounced();
    } catch (e) {
      alert(e.message);
    }
  });

  btnSave.addEventListener('click', async () => {
    if (!state.scenarioId) {
      alert('Selecione um cenário (ou use "Salvar como").');
      return;
    }
    try {
<<<<<<< HEAD
      await fetchJSON(`/app/projection/scenarios/${state.scenarioId}`, {
=======
      await fetch(`/app/projection/scenarios/${state.scenarioId}`, {
>>>>>>> 748ac02aa6f96c785f54b96d19f576dafc3d1383
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ overrides: state.overrides }),
      });
      state.dirty = false;
      await loadScenarios(state.scenarioId);
      alert('Cenário atualizado.');
    } catch (e) {
      alert(e.message);
    }
  });

  btnSaveAs.addEventListener('click', async () => {
    const name = prompt('Nome do novo cenário:', state.scenarioName === 'Base' ? 'Meu cenário 1' : `${state.scenarioName} (cópia)`);
    if (!name) return;
    try {
<<<<<<< HEAD
      const out = await fetchJSON('/app/projection/scenarios', {
=======
      const out = await fetch('/app/projection/scenarios', {
>>>>>>> 748ac02aa6f96c785f54b96d19f576dafc3d1383
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, overrides: state.overrides }),
      });
      state.scenarioId = out.id;
      state.scenarioName = name;
      state.dirty = false;
      await loadScenarios(state.scenarioId);
      scenarioSelect.value = String(state.scenarioId);
      alert('Cenário criado.');
    } catch (e) {
      alert(e.message);
    }
  });

  btnDelete.addEventListener('click', async () => {
    if (!state.scenarioId) return;
    if (!confirm('Excluir este cenário?')) return;
    try {
<<<<<<< HEAD
      await fetchJSON(`/app/projection/scenarios/${state.scenarioId}`, { method: 'DELETE' });
=======
      await fetch(`/app/projection/scenarios/${state.scenarioId}`, { method: 'DELETE' });
>>>>>>> 748ac02aa6f96c785f54b96d19f576dafc3d1383
      state.scenarioId = 0;
      state.scenarioName = 'Base';
      state.overrides = defaultOverrides();
      state.dirty = false;
      await loadScenarios(0);
      runDebounced();
    } catch (e) {
      alert(e.message);
    }
  });

  function buildPayload() {
    const payload = {
      start: startInput.value,
      end: endInput.value,
      mode: modeSelect.value,
      include_recurring: recurringToggle.checked,
      reserve_min: Number(reserveInput.value || 0),
      overrides: state.overrides,
    };
    if (state.scenarioId) payload.scenario_id = state.scenarioId;
    return payload;
  }

  async function runProjection() {
    // valida datas
    if (!startInput.value || !endInput.value) return;
    try {
<<<<<<< HEAD
      const data = await fetchJSON('/app/projection/data', {
=======
      const data = await fetch('/app/projection/data', {
>>>>>>> 748ac02aa6f96c785f54b96d19f576dafc3d1383
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload()),
      });
      state.lastData = data;
      renderAll(data);
    } catch (e) {
      console.error(e);
      alert(e.message || 'Falha ao simular projeção.');
    }
  }

  function renderAll(data) {
    // KPIs
    initialLabel.textContent = `Saldo inicial: ${fmtBRL.format(Number(data.saldo_inicial || 0))}`;
    kpiFinal.textContent = fmtBRL.format(Number(data.saldo_final || 0));
    kpiMin.textContent = fmtBRL.format(Number(data.min_saldo || 0));
    kpiMinDate.textContent = fmtDate(data.min_saldo_date);
    kpiBreak.textContent = data.break_date ? fmtDate(data.break_date) : '—';
    kpiCoverage.textContent = `${Number((data.coverage && data.coverage.percent) || 100).toFixed(1)}%`;
    kpiCoverageMeta.textContent = `${(data.coverage && data.coverage.covered_count) || 0}/${(data.coverage && data.coverage.total_expenses) || 0}`;
    kpiReserve.textContent = fmtBRL.format(Number(data.recommended_reserve || 0));

    // Chart
    renderChart(data.daily || []);

    // Table
    renderTable(data.events || []);

    // Risks
    renderRisks(data.risks || []);

    // Reductions
    renderReductions(data.categories || []);
  }

  function renderChart(daily) {
    if (!Array.isArray(daily) || daily.length < 2) {
      timelinePath.setAttribute('d', '');
      timelineEmpty.style.display = 'flex';
      return;
    }
    timelineEmpty.style.display = 'none';

    const values = daily.map((p) => Number(p.saldo || 0));
    let min = Math.min(...values);
    let max = Math.max(...values);
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
    const points = daily.map((p, i) => {
      const x = x0 + (x1 - x0) * (i / n);
      const v = Number(p.saldo || 0);
      const t = (v - min) / (max - min);
      const y = y1 - (y1 - y0) * t;
      return { x, y };
    });

    let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
    for (let i = 1; i < points.length; i++) {
      d += ` L ${points[i].x.toFixed(1)} ${points[i].y.toFixed(1)}`;
    }
    timelinePath.setAttribute('d', d);
  }

  function badge(text, cls) {
    const span = document.createElement('span');
    span.className = `badge ${cls || ''}`.trim();
    span.textContent = text;
    return span;
  }

  function renderTable(events) {
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
<<<<<<< HEAD
      await fetchJSON(`/app/projection/entry/${entradaId}/priority`, {
=======
      await fetch(`/app/projection/entry/${entradaId}/priority`, {
>>>>>>> 748ac02aa6f96c785f54b96d19f576dafc3d1383
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
    const nd = prompt('Nova data (YYYY-MM-DD):', currentDateIso || startInput.value);
    if (!nd) return;
    // valida básico
    if (!/^\d{4}-\d{2}-\d{2}$/.test(nd)) {
      alert('Formato inválido. Use YYYY-MM-DD.');
      return;
    }
    upsertShift(entradaId, nd);
    state.dirty = true;
    runDebounced();
  }

  function splitExpense(entradaId) {
    const parts = Number(prompt('Em quantas parcelas? (2 a 24)', '3') || 0);
    if (!isFinite(parts) || parts < 2 || parts > 24) {
      alert('Número inválido (2 a 24).');
      return;
    }
    upsertSplit(entradaId, parts);
    state.dirty = true;
    runDebounced();
  }

  function renderRisks(risks) {
    riskList.innerHTML = '';
    if (!Array.isArray(risks) || risks.length === 0) {
      const div = document.createElement('div');
      div.className = 'risk-item';
      div.innerHTML = `<strong>Sem alertas</strong><div class="risk-sub">No período selecionado, não encontramos riscos relevantes.</div>`;
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
        state.dirty = true;
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

  // Init
  (async function init() {
    setTodayDefaults();
    try {
      await loadScenarios(0);
    } catch (e) {
      console.warn(e);
    }
    runDebounced();
  })();
})();
