(function () {
  const form = document.getElementById("form");
  const inputData = document.getElementById("data");
  const inputTipo = document.getElementById("tipo");
  const inputDescricao = document.getElementById("descricao");
  const inputCategoria = document.getElementById("categoria");
  const inputValor = document.getElementById("valor");
  const inputStatus = document.getElementById("status");
  const inputMetodo = document.getElementById("metodo");

  const receitasDiv = document.getElementById("receitas");
  const despesasDiv = document.getElementById("despesas");

  const filtroTrimestreReceitas = document.getElementById("filtro-trimestre-receitas");
  const filtroTrimestreDespesas = document.getElementById("filtro-trimestre-despesas");

  const filterSearch = document.getElementById("filter-search");
  const filterStart = document.getElementById("filter-start");
  const filterEnd = document.getElementById("filter-end");
  const filterType = document.getElementById("filter-type");
  const filterStatus = document.getElementById("filter-status");
  const filterCategory = document.getElementById("filter-category");
  const filterMin = document.getElementById("filter-min");
  const filterMax = document.getElementById("filter-max");
  const filterClear = document.getElementById("filters-clear");

  /* Modal */
  const modalOverlay = document.getElementById("modal-overlay");
  const modalCloseBtn = document.getElementById("modal-close");
  const modalCancelBtn = document.getElementById("modal-cancel");
  const formEdit = document.getElementById("form-edit");

  const editData = document.getElementById("edit-data");
  const editTipo = document.getElementById("edit-tipo");
  const editStatus = document.getElementById("edit-status");
  const editCategoria = document.getElementById("edit-categoria");
  const editDescricao = document.getElementById("edit-descricao");
  const editValor = document.getElementById("edit-valor");
  const editMetodo = document.getElementById("edit-metodo");

  // Esta página não existe? Sai sem fazer nada.
  if (!form && !receitasDiv && !despesasDiv) return;

  let entradas = [];
  let editandoId = null;

  const CATEGORY_LABELS = {
    salario: "Salário",
    extras: "Extras",
    moradia: "Moradia",
    mercado: "Mercado",
    transporte: "Transporte",
    servicos: "Serviços",
    outros: "Outros"
  };

  const CATEGORY_OPTIONS = {
    receita: [
      { value: "salario", label: "Salário" },
      { value: "extras", label: "Extras" },
      { value: "outros", label: "Outros" }
    ],
    despesa: [
      { value: "moradia", label: "Moradia" },
      { value: "mercado", label: "Mercado" },
      { value: "transporte", label: "Transporte" },
      { value: "servicos", label: "Serviços" },
      { value: "outros", label: "Outros" }
    ]
  };

  function categoriaLabel(value) {
    const key = String(value || "outros");
    return CATEGORY_LABELS[key] || "Outros";
  }

  function updateCategoryOptions(selectEl, tipo, selectedValue) {
    if (!selectEl) return;
    const normalized = (tipo || "receita").toLowerCase() === "despesa" ? "despesa" : "receita";
    const options = CATEGORY_OPTIONS[normalized] || CATEGORY_OPTIONS.receita;
    const desired = String(selectedValue || selectEl.value || "outros");
    const allowedValues = options.map(opt => opt.value);
    const finalValue = allowedValues.includes(desired) ? desired : "outros";

    selectEl.innerHTML = "";
    options.forEach(opt => {
      const optionEl = document.createElement("option");
      optionEl.value = opt.value;
      optionEl.textContent = opt.label;
      selectEl.appendChild(optionEl);
    });
    selectEl.value = finalValue;
    rebuildCustomSelect(selectEl);
    syncCustomSelect(selectEl);
  }

  function syncCustomSelect(selectEl) {
    if (selectEl && typeof selectEl._customUpdate === "function") {
      selectEl._customUpdate();
    }
  }

  function rebuildCustomSelect(selectEl) {
    if (selectEl && typeof selectEl._customRebuild === "function") {
      selectEl._customRebuild();
    }
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
    selectEl._custom = { wrapper, trigger, list };

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

  function fmtBRL(valor) {
    const num = Number(valor) || 0;
    return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function obterTrimestre(mes) {
    if (mes >= 1 && mes <= 3) return "1";
    if (mes >= 4 && mes <= 6) return "2";
    if (mes >= 7 && mes <= 9) return "3";
    if (mes >= 10 && mes <= 12) return "4";
    return "todos";
  }

  function filtrarPorTrimestre(lista, trimestre) {
    if (!trimestre || trimestre === "todos" || trimestre === "all") return lista;
    return (lista || []).filter(e => {
      const mes = parseInt(String(e.data).slice(5, 7), 10);
      return obterTrimestre(mes) === String(trimestre);
    });
  }

  function applyAdvancedFilters(lista) {
    let filtradas = [...(lista || [])];

    const search = (filterSearch?.value || "").trim().toLowerCase();
    if (search) {
      filtradas = filtradas.filter(item => String(item.descricao || "").toLowerCase().includes(search));
    }

    const start = filterStart?.value;
    if (start) {
      filtradas = filtradas.filter(item => String(item.data || "") >= start);
    }

    const end = filterEnd?.value;
    if (end) {
      filtradas = filtradas.filter(item => String(item.data || "") <= end);
    }

    const tipo = filterType?.value || "all";
    if (tipo !== "all") {
      filtradas = filtradas.filter(item => item.tipo === tipo);
    }

    const status = filterStatus?.value || "all";
    if (status !== "all") {
      filtradas = filtradas.filter(item => item.tipo === "despesa" && (item.status || "em_andamento") === status);
    }

    const categoria = filterCategory?.value || "all";
    if (categoria !== "all") {
      filtradas = filtradas.filter(item => String(item.categoria || "").toLowerCase() === categoria);
    }

    const minRaw = filterMin?.value;
    if (minRaw !== undefined && minRaw !== "") {
      const min = Number(minRaw);
      if (Number.isFinite(min)) {
        filtradas = filtradas.filter(item => Number(item.valor || 0) >= min);
      }
    }

    const maxRaw = filterMax?.value;
    if (maxRaw !== undefined && maxRaw !== "") {
      const max = Number(maxRaw);
      if (Number.isFinite(max)) {
        filtradas = filtradas.filter(item => Number(item.valor || 0) <= max);
      }
    }

    return filtradas;
  }

  const MESES = [
    "janeiro", "fevereiro", "marco",
    "abril", "maio", "junho",
    "julho", "agosto", "setembro",
    "outubro", "novembro", "dezembro"
  ];

  function formatarMesAno(anoMes) {
    if (!anoMes || anoMes.length < 7) return "Sem data";
    const ano = anoMes.slice(0, 4);
    const mes = Number(anoMes.slice(5, 7));
    const nome = MESES[mes - 1] || "mes";
    return `${nome} ${ano}`;
  }

  function agruparPorMes(lista) {
    const ordenadas = [...(lista || [])].sort((a, b) => String(b.data).localeCompare(String(a.data)));
    const grupos = new Map();
    ordenadas.forEach(item => {
      const chave = item?.data ? String(item.data).slice(0, 7) : "sem-data";
      if (!grupos.has(chave)) grupos.set(chave, []);
      grupos.get(chave).push(item);
    });
    return grupos;
  }

  function statusLabel(status) {
    if (!status) return "";
    if (status === "pago") return "Pago";
    if (status === "em_andamento") return "Em andamento";
    if (status === "nao_pago") return "Não pago";
    if (status === "atrasado") return "Atrasado";
    return String(status);
  }

  function atualizarStatusFormPrincipal() {
    if (!inputTipo || !inputStatus) return;
    const isDespesa = inputTipo.value === "despesa";
    inputStatus.disabled = !isDespesa;
    inputStatus.closest(".field")?.classList.toggle("hidden", !isDespesa);
    if (!isDespesa) inputStatus.value = "";
    updateCategoryOptions(inputCategoria, inputTipo.value, inputCategoria?.value);
    syncCustomSelect(inputTipo);
    syncCustomSelect(inputStatus);
  }

  function atualizarStatusModal() {
    if (!editTipo || !editStatus) return;
    const isDespesa = editTipo.value === "despesa";
    editStatus.disabled = !isDespesa;
    editStatus.closest(".field")?.classList.toggle("hidden", !isDespesa);
    if (!isDespesa) editStatus.value = "";
    updateCategoryOptions(editCategoria, editTipo.value, editCategoria?.value);
    syncCustomSelect(editTipo);
    syncCustomSelect(editStatus);
  }

  function atualizarStatusFiltro() {
    if (!filterType || !filterStatus) return;
    const isReceitaOnly = filterType.value === "receita";
    filterStatus.disabled = isReceitaOnly;
    filterStatus.closest(".field")?.classList.toggle("hidden", isReceitaOnly);
    if (isReceitaOnly) filterStatus.value = "all";
    syncCustomSelect(filterStatus);
  }

  function linhaHTML(e, isDespesa) {
    const status = isDespesa ? (statusLabel(e.status) || "") : "";
    const categoria = String(e.categoria || "outros");
    const categoriaNome = categoriaLabel(categoria);
    const actions = `
      <span class="acoes">
        <button class="btn-icon editar" type="button" data-action="edit" title="Editar">✏️</button>
        <button class="btn-icon excluir" type="button" data-action="delete" title="Excluir">🗑️</button>
      </span>
    `;
    if (!isDespesa) {
      return `
        <div class="linha" data-id="${e.id}">
          <span class="cell cell-data">${e.data}</span>
          <span class="cell cell-desc">${e.descricao}</span>
          <span class="cell cell-cat"><span class="categoria-chip" data-category="${categoria}">${categoriaNome}</span></span>
          <span class="cell cell-valor">${fmtBRL(e.valor)}</span>
          ${actions}
        </div>
      `;
    }
    return `
      <div class="linha" data-id="${e.id}">
        <span class="cell cell-data">${e.data}</span>
        <span class="cell cell-desc">${e.descricao}</span>
        <span class="cell cell-cat"><span class="categoria-chip" data-category="${categoria}">${categoriaNome}</span></span>
        <span class="cell cell-valor">${fmtBRL(e.valor)}</span>
        <span class="cell cell-status">${status}</span>
        ${actions}
      </div>
    `;
  }

  function renderListaHistorico(container, lista, isDespesa) {
    if (!container) return;

    if (!lista || lista.length === 0) {
      container.innerHTML = `<div class="linha empty"><span>Nenhum lançamento.</span></div>`;
      return;
    }

    const grupos = agruparPorMes(lista);
    const partes = [];
    grupos.forEach((itens, chave) => {
      partes.push(`<div class="mes-header">${formatarMesAno(chave)}</div>`);
      partes.push(itens.map(e => linhaHTML(e, isDespesa)).join(""));
    });
    container.innerHTML = partes.join("");
  }

  function renderHistoricos() {
    const filtradas = applyAdvancedFilters(entradas);
    const receitas = filtradas.filter(e => e.tipo === "receita");
    const despesas = filtradas.filter(e => e.tipo === "despesa");

    const receitasFiltradas = filtrarPorTrimestre(receitas, filtroTrimestreReceitas?.value || "todos");
    const despesasFiltradas = filtrarPorTrimestre(despesas, filtroTrimestreDespesas?.value || "todos");

    renderListaHistorico(receitasDiv, receitasFiltradas, false);
    renderListaHistorico(despesasDiv, despesasFiltradas, true);
  }

  function abrirModal() {
    if (!modalOverlay) return;
    modalOverlay.classList.remove("hidden");
  }

  function fecharModal() {
    if (!modalOverlay) return;
    modalOverlay.classList.add("hidden");
    editandoId = null;
  }

  async function abrirModalEdicao(id) {
    const item = entradas.find(e => String(e.id) === String(id));
    if (!item) return;

    editandoId = item.id;

    if (editData) editData.value = item.data || "";
    if (editTipo) editTipo.value = item.tipo || "receita";
    updateCategoryOptions(editCategoria, editTipo?.value, item.categoria || "outros");
    if (editDescricao) editDescricao.value = item.descricao || "";
    if (editValor) editValor.value = Number(item.valor) || 0;
    if (editMetodo) editMetodo.value = item.metodo || "";

    if (editStatus) editStatus.value = item.tipo === "despesa" ? (item.status || "em_andamento") : "";

    syncCustomSelect(editTipo);
    syncCustomSelect(editStatus);
    atualizarStatusModal();
    abrirModal();
  }

  function bindAcoesListas() {
    function handler(ev) {
      const btn = ev.target.closest("button[data-action]");
      if (!btn) return;
      const linha = btn.closest(".linha[data-id]");
      if (!linha) return;

      const id = linha.dataset.id;
      const action = btn.dataset.action;

      if (action === "edit") abrirModalEdicao(id);
      if (action === "delete") excluir(id);
    }

    receitasDiv?.addEventListener("click", handler);
    despesasDiv?.addEventListener("click", handler);
  }

  async function carregarDados() {
    const res = await fetch("/dados");
    const data = await res.json();
    entradas = data.entradas || [];
    renderHistoricos();
  }

  async function excluir(id) {
    if (!confirm("Deseja excluir esta entrada?")) return;
    await fetch(`/delete/${id}`, { method: "DELETE" });

    if (String(editandoId) === String(id)) fecharModal();

    await carregarDados();
  }

  // Eventos
  inputTipo?.addEventListener("change", atualizarStatusFormPrincipal);
  editTipo?.addEventListener("change", atualizarStatusModal);

  filtroTrimestreReceitas?.addEventListener("change", renderHistoricos);
  filtroTrimestreDespesas?.addEventListener("change", renderHistoricos);

  filterSearch?.addEventListener("input", renderHistoricos);
  filterStart?.addEventListener("change", renderHistoricos);
  filterEnd?.addEventListener("change", renderHistoricos);
  filterType?.addEventListener("change", () => {
    atualizarStatusFiltro();
    renderHistoricos();
  });
  filterStatus?.addEventListener("change", renderHistoricos);
  filterCategory?.addEventListener("change", renderHistoricos);
  filterMin?.addEventListener("input", renderHistoricos);
  filterMax?.addEventListener("input", renderHistoricos);

  filterClear?.addEventListener("click", () => {
    if (filterSearch) filterSearch.value = "";
    if (filterStart) filterStart.value = "";
    if (filterEnd) filterEnd.value = "";
    if (filterType) filterType.value = "all";
    if (filterStatus) filterStatus.value = "all";
    if (filterCategory) filterCategory.value = "all";
    if (filterMin) filterMin.value = "";
    if (filterMax) filterMax.value = "";

    atualizarStatusFiltro();
    [filterType, filterStatus, filterCategory].forEach(syncCustomSelect);
    renderHistoricos();
  });

  function applyFiltersFromQuery() {
    const params = new URLSearchParams(window.location.search);
    if (!params || params.toString() === "") return;

    if (filterSearch && params.get("search")) filterSearch.value = params.get("search");
    if (filterStart && params.get("start")) filterStart.value = params.get("start");
    if (filterEnd && params.get("end")) filterEnd.value = params.get("end");
    if (filterType && params.get("type")) filterType.value = params.get("type");
    if (filterStatus && params.get("status")) filterStatus.value = params.get("status");
    if (filterCategory && params.get("category")) filterCategory.value = params.get("category");
    if (filterMin && params.get("min")) filterMin.value = params.get("min");
    if (filterMax && params.get("max")) filterMax.value = params.get("max");

    atualizarStatusFiltro();
    [filterType, filterStatus, filterCategory].forEach(syncCustomSelect);
  }

  modalCloseBtn?.addEventListener("click", fecharModal);
  modalCancelBtn?.addEventListener("click", fecharModal);
  modalOverlay?.addEventListener("click", (ev) => {
    if (ev.target === modalOverlay) fecharModal();
  });

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const payload = {
      data: inputData?.value,
      tipo: inputTipo?.value,
      categoria: inputCategoria?.value,
      descricao: inputDescricao?.value,
      valor: parseFloat(inputValor?.value || "0"),
      status: (inputTipo?.value === "despesa") ? (inputStatus?.value || "em_andamento") : null
    };
    if (inputMetodo) {
      payload.metodo = inputMetodo.value || null;
    }

    await fetch("/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    form.reset();
    if (inputTipo) inputTipo.value = "receita";
    if (inputMetodo) inputMetodo.value = "";
    updateCategoryOptions(inputCategoria, inputTipo?.value, "outros");
    atualizarStatusFormPrincipal();
    syncCustomSelect(inputTipo);
    syncCustomSelect(inputCategoria);
    await carregarDados();
  });

  formEdit?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!editandoId) return;

    const payload = {
      data: editData?.value,
      tipo: editTipo?.value,
      categoria: editCategoria?.value,
      descricao: editDescricao?.value,
      valor: parseFloat(editValor?.value || "0"),
      status: (editTipo?.value === "despesa") ? (editStatus?.value || "em_andamento") : null
    };
    if (editMetodo) {
      payload.metodo = editMetodo.value || null;
    }

    await fetch(`/edit/${editandoId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    fecharModal();
    await carregarDados();
  });

  atualizarStatusFormPrincipal();
  atualizarStatusFiltro();
  bindAcoesListas();
  [
    inputTipo,
    inputStatus,
    inputCategoria,
    filtroTrimestreReceitas,
    filtroTrimestreDespesas,
    editTipo,
    editStatus,
    editCategoria,
    filterType,
    filterStatus,
    filterCategory,
    inputMetodo,
    editMetodo
  ].forEach(initCustomSelect);
  applyFiltersFromQuery();
  carregarDados();
})();
