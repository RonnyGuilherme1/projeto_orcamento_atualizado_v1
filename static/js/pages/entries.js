(function () {
  const form = document.getElementById("form");
  const inputData = document.getElementById("data");
  const inputTipo = document.getElementById("tipo");
  const inputDescricao = document.getElementById("descricao");
  const inputValor = document.getElementById("valor");
  const inputStatus = document.getElementById("status");

  const receitasDiv = document.getElementById("receitas");
  const despesasDiv = document.getElementById("despesas");

  const filtroTrimestreReceitas = document.getElementById("filtro-trimestre-receitas");
  const filtroTrimestreDespesas = document.getElementById("filtro-trimestre-despesas");

  /* Modal */
  const modalOverlay = document.getElementById("modal-overlay");
  const modalCloseBtn = document.getElementById("modal-close");
  const modalCancelBtn = document.getElementById("modal-cancel");
  const formEdit = document.getElementById("form-edit");

  const editData = document.getElementById("edit-data");
  const editTipo = document.getElementById("edit-tipo");
  const editStatus = document.getElementById("edit-status");
  const editDescricao = document.getElementById("edit-descricao");
  const editValor = document.getElementById("edit-valor");

  // Esta página não existe? Sai sem fazer nada.
  if (!form && !receitasDiv && !despesasDiv) return;

  let entradas = [];
  let editandoId = null;

  function syncCustomSelect(selectEl) {
    if (selectEl && typeof selectEl._customUpdate === "function") {
      selectEl._customUpdate();
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

    Array.from(selectEl.options).forEach(opt => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "select-option";
      btn.dataset.value = opt.value;
      btn.textContent = opt.textContent;
      btn.disabled = opt.disabled;
      list.appendChild(btn);
    });

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

  function statusLabel(status) {
    if (!status) return "";
    if (status === "pago") return "Pago";
    if (status === "em_andamento") return "Em andamento";
    if (status === "atrasado") return "Atrasado";
    return String(status);
  }

  function atualizarStatusFormPrincipal() {
    if (!inputTipo || !inputStatus) return;
    const isDespesa = inputTipo.value === "despesa";
    inputStatus.disabled = !isDespesa;
    inputStatus.closest(".field")?.classList.toggle("hidden", !isDespesa);
    if (!isDespesa) inputStatus.value = "";
    syncCustomSelect(inputTipo);
    syncCustomSelect(inputStatus);
  }

  function atualizarStatusModal() {
    if (!editTipo || !editStatus) return;
    const isDespesa = editTipo.value === "despesa";
    editStatus.disabled = !isDespesa;
    editStatus.closest(".field")?.classList.toggle("hidden", !isDespesa);
    if (!isDespesa) editStatus.value = "";
    syncCustomSelect(editTipo);
    syncCustomSelect(editStatus);
  }

  function linhaHTML(e, isDespesa) {
    const status = isDespesa ? (statusLabel(e.status) || "") : "";
    return `
      <div class="linha" data-id="${e.id}">
        <span>${e.data}</span>
        <span>${e.descricao}</span>
        <span>${fmtBRL(e.valor)}</span>
        <span>${status}</span>
        <span class="acoes">
          <button class="btn-icon editar" type="button" data-action="edit" title="Editar">✏️</button>
          <button class="btn-icon excluir" type="button" data-action="delete" title="Excluir">🗑️</button>
        </span>
      </div>
    `;
  }

  function renderListaHistorico(container, lista, isDespesa) {
    if (!container) return;

    if (!lista || lista.length === 0) {
      container.innerHTML = `<div class="linha empty"><span>Nenhum lançamento.</span></div>`;
      return;
    }

    container.innerHTML = lista.map(e => linhaHTML(e, isDespesa)).join("");
  }

  function renderHistoricos() {
    const receitas = entradas.filter(e => e.tipo === "receita");
    const despesas = entradas.filter(e => e.tipo === "despesa");

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
    if (editDescricao) editDescricao.value = item.descricao || "";
    if (editValor) editValor.value = Number(item.valor) || 0;

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
      descricao: inputDescricao?.value,
      valor: parseFloat(inputValor?.value || "0"),
      status: (inputTipo?.value === "despesa") ? (inputStatus?.value || "em_andamento") : null
    };

    await fetch("/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    form.reset();
    if (inputTipo) inputTipo.value = "receita";
    atualizarStatusFormPrincipal();
    syncCustomSelect(inputTipo);
    await carregarDados();
  });

  formEdit?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!editandoId) return;

    const payload = {
      data: editData?.value,
      tipo: editTipo?.value,
      descricao: editDescricao?.value,
      valor: parseFloat(editValor?.value || "0"),
      status: (editTipo?.value === "despesa") ? (editStatus?.value || "em_andamento") : null
    };

    await fetch(`/edit/${editandoId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    fecharModal();
    await carregarDados();
  });

  atualizarStatusFormPrincipal();
  bindAcoesListas();
  [
    inputTipo,
    inputStatus,
    filtroTrimestreReceitas,
    filtroTrimestreDespesas,
    editTipo,
    editStatus
  ].forEach(initCustomSelect);
  carregarDados();
})();
