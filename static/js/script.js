const form = document.getElementById("form");

const inputData = document.getElementById("data");
const inputTipo = document.getElementById("tipo");
const inputDescricao = document.getElementById("descricao");
const inputValor = document.getElementById("valor");
const inputStatus = document.getElementById("status");

const receitasDiv = document.getElementById("receitas");
const despesasDiv = document.getElementById("despesas");

const filtroData = document.getElementById("filtro-data");
const listaDia = document.getElementById("lista-dia");
const filtroTrimestreReceitas = document.getElementById("filtro-trimestre-receitas");
const filtroTrimestreDespesas = document.getElementById("filtro-trimestre-despesas");

const totalReceitaEl = document.getElementById("total-receita");
const totalDespesaEl = document.getElementById("total-despesa");
const saldoDiaEl = document.getElementById("saldo-dia");

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

let entradasGlobais = [];
let editandoId = null;

const meses = [
  "Janeiro", "Fevereiro", "Março",
  "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro",
  "Outubro", "Novembro", "Dezembro"
];

function extrairAnoMes(dataStr) {
  if (!dataStr) return { ano: null, mes: null };
  const str = String(dataStr);
  const ano = parseInt(str.slice(0, 4), 10);
  const mes = parseInt(str.slice(5, 7), 10);

  if (!Number.isFinite(ano)) return { ano: null, mes: null };
  if (!Number.isFinite(mes) || mes < 1 || mes > 12) return { ano, mes: null };

  return { ano, mes };
}

function obterTrimestre(mes) {
  return Math.ceil(mes / 3);
}

function filtrarPorTrimestre(entradas, trimestre) {
  const triNum = parseInt(trimestre, 10);
  if (!triNum || triNum < 1 || triNum > 4) return entradas;

  return entradas.filter(e => {
    const { mes } = extrairAnoMes(e.data);
    return mes && obterTrimestre(mes) === triNum;
  });
}

function dataCompacta(dataStr) {
  const str = String(dataStr || "");
  const compacta = Number(str.replaceAll("-", ""));
  return Number.isFinite(compacta) ? compacta : 0;
}

function agruparPorMes(entradas) {
  const ordenadas = [...entradas].sort((a, b) => dataCompacta(b.data) - dataCompacta(a.data));
  const grupos = [];
  const mapa = new Map();

  ordenadas.forEach(e => {
    const { ano, mes } = extrairAnoMes(e.data);
    const key = `${ano || "sem"}-${mes || "00"}`;
    let grupo = mapa.get(key);

    if (!grupo) {
      grupo = { ano, mes, entradas: [] };
      mapa.set(key, grupo);
      grupos.push(grupo);
    }

    grupo.entradas.push(e);
  });

  return grupos;
}

function formatarMesLabel(mes, ano, usarAno) {
  if (!mes) return "Sem data";
  const nome = meses[mes - 1] || "Mes invalido";
  return usarAno && ano ? `${nome} ${ano}` : nome;
}

function fmtBRL(v) {
  const n = Number(v) || 0;
  return `R$ ${n.toFixed(2)}`; // 2 casas fixas
}

function statusLabel(status) {
  if (!status) return "";
  return String(status).replaceAll("_", " ");
}

/* =========================
   STATUS (form principal)
========================= */
function atualizarStatusFormPrincipal() {
  if (!inputTipo || !inputStatus) return;
  const isReceita = inputTipo.value === "receita";
  inputStatus.disabled = isReceita;
  inputStatus.style.display = isReceita ? "none" : "block";
  if (isReceita) inputStatus.value = "";
}

if (inputTipo) inputTipo.addEventListener("change", atualizarStatusFormPrincipal);

/* =========================
   STATUS (modal)
========================= */
function atualizarStatusModal() {
  const isReceita = editTipo.value === "receita";
  editStatus.disabled = isReceita;
  editStatus.style.display = isReceita ? "none" : "block";
  if (isReceita) editStatus.value = "";
}

if (editTipo) {
  if (editTipo) editTipo.addEventListener("change", atualizarStatusModal);
}

/* =========================
   CARDS TRIMESTRAIS
========================= */
function montarCardsTrimestresSeNaoExistir() {
  const cardsRoot = document.getElementById("cards");
  if (!cardsRoot) return;

  // Se já tiver HTML dentro, não recria.
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

  entradasGlobais.forEach(e => {
    const mes = parseInt(String(e.data).slice(5, 7), 10);
    if (!mes || mes < 1 || mes > 12) return;

    if (e.tipo === "receita") resumo[mes].receita += Number(e.valor) || 0;
    if (e.tipo === "despesa") resumo[mes].despesa += Number(e.valor) || 0;
  });

  document.querySelectorAll(".card[data-mes]").forEach(card => {
    const mesNum = parseInt(card.dataset.mes, 10);
    const dados = resumo[mesNum] || { receita: 0, despesa: 0 };
    const saldo = dados.receita - dados.despesa;

    card.innerHTML = `
      <h3>${meses[mesNum - 1]}</h3>
      <p>Receita: ${fmtBRL(dados.receita)}</p>
      <p>Despesa: ${fmtBRL(dados.despesa)}</p>
      <strong style="color:${saldo >= 0 ? "#4caf50" : "#f44336"}">
        Saldo: ${fmtBRL(saldo)}
      </strong>
    `;
  });
}

/* =========================
   HISTÓRICO (SEM onclick)
========================= */
function linhaHTML(e, isDespesa) {
  const status = isDespesa ? (statusLabel(e.status) || "") : "";
  return `
    <div class="linha" data-id="${e.id}">
      <span>${e.data}</span>
      <span>${e.descricao}</span>
      <span>${fmtBRL(e.valor)}</span>
      ${isDespesa ? `<span>${status}</span>` : `<span></span>`}
      <span class="acoes">
        <button type="button" class="btn-icon" data-action="edit" title="Editar">✏️</button>
        <button type="button" class="btn-icon" data-action="delete" title="Excluir">🗑️</button>
      </span>
    </div>
  `;
}

function renderListaHistorico(container, tipo, trimestre) {
  if (!container) return;

  const todas = entradasGlobais.filter(e => e.tipo === tipo);
  const filtradas = filtrarPorTrimestre(todas, trimestre);

  if (filtradas.length === 0) {
    const msg = trimestre && trimestre !== "all"
      ? "Nenhuma entrada neste trimestre."
      : "Nenhuma entrada cadastrada.";
    container.innerHTML = `<div class="lista-vazia">${msg}</div>`;
    return;
  }

  const anos = new Set();
  filtradas.forEach(e => {
    const { ano } = extrairAnoMes(e.data);
    if (ano) anos.add(ano);
  });

  const usarAno = anos.size > 1;
  const grupos = agruparPorMes(filtradas);
  const isDespesa = tipo === "despesa";

  container.innerHTML = grupos.map(grupo => {
    const label = formatarMesLabel(grupo.mes, grupo.ano, usarAno);
    const linhas = grupo.entradas.map(e => linhaHTML(e, isDespesa)).join("");
    return `
      <div class="mes-header"><span>${label}</span></div>
      ${linhas}
    `;
  }).join("");
}

function renderHistoricos() {
  const trimestreReceitas = filtroTrimestreReceitas ? filtroTrimestreReceitas.value : "all";
  const trimestreDespesas = filtroTrimestreDespesas ? filtroTrimestreDespesas.value : "all";

  renderListaHistorico(receitasDiv, "receita", trimestreReceitas);
  renderListaHistorico(despesasDiv, "despesa", trimestreDespesas);
}

/* Delega cliques para editar/excluir */
function bindAcoesListas() {
  const handler = async (ev) => {
    const btn = ev.target.closest("button[data-action]");
    if (!btn) return;

    const linha = ev.target.closest(".linha");
    if (!linha) return;

    const id = Number(linha.dataset.id);
    const action = btn.dataset.action;

    if (action === "edit") abrirModalEdicao(id);
    if (action === "delete") await excluir(id);
  };

  if (receitasDiv) receitasDiv.addEventListener("click", handler);
  if (despesasDiv) despesasDiv.addEventListener("click", handler);
}

/* =========================
   RESUMO POR DATA
========================= */
async function renderResumoPorData(dataSelecionada) {
  if (!listaDia) return;

  listaDia.innerHTML = "";

  if (totalReceitaEl) totalReceitaEl.textContent = "R$ 0,00";
  if (totalDespesaEl) totalDespesaEl.textContent = "R$ 0,00";
  if (saldoDiaEl) {
    saldoDiaEl.textContent = "R$ 0,00";
    saldoDiaEl.className = "";
  }

  if (!dataSelecionada) return;

  try {
    // Comportamento novo (backend):
    // - Saldo anterior (caixa) até o dia anterior
    // - Receitas do dia selecionado
    // - Despesas pendentes com vencimento do dia selecionado até o final do mês
    const res = await fetch(`/resumo-ciclo?data=${encodeURIComponent(dataSelecionada)}`);
    const resumo = await res.json();

    if (!res.ok) {
      const msg = resumo && resumo.error ? resumo.error : "Erro ao carregar resumo";
      listaDia.innerHTML = `<div class="linha-dia"><span>${msg}</span><span></span></div>`;
      return;
    }

    const saldoAnterior = Number(resumo.saldo_anterior) || 0;
    const receitasNoDia = Number(resumo.receitas_no_dia) || 0;
    const saldoAposReceber = Number(resumo.saldo_apos_receber) || 0;
    const totalDespesasPendentes = Number(resumo.total_despesas_pendentes) || 0;
    const saldoProjetado = Number(resumo.saldo_projetado) || 0;
    const ate = resumo.ate || "";

    // Topo: visão de caixa
    listaDia.innerHTML += `
      <div class="linha-dia">
        <span>Saldo anterior</span>
        <span>${fmtBRL(saldoAnterior)}</span>
      </div>
      <div class="linha-dia">
        <span>Receitas no dia</span>
        <span>${fmtBRL(receitasNoDia)}</span>
      </div>
      <div class="linha-dia">
        <span>Saldo após receber</span>
        <span>${fmtBRL(saldoAposReceber)}</span>
      </div>
    `;

    // Lista de despesas pendentes no período
    const despesas = Array.isArray(resumo.despesas_pendentes) ? resumo.despesas_pendentes : [];
    if (despesas.length === 0) {
      listaDia.innerHTML += `
        <div class="linha-dia">
          <span>Despesas pendentes até ${ate || "o fim do mês"}</span>
          <span>${fmtBRL(0)}</span>
        </div>
      `;
    } else {
      listaDia.innerHTML += `
        <div class="linha-dia">
          <span><strong>Despesas pendentes!</strong></span>
          <span></span>
        </div>
      `;

      despesas.forEach(d => {
        const v = Number(d.valor) || 0;
        const label = `${d.data} - ${d.descricao}`;
        listaDia.innerHTML += `
          <div class="linha-dia">
            <span>${label}</span>
            <span>${fmtBRL(v)}</span>
          </div>
        `;
      });
    }

    // Totais (mantendo layout existente)
    if (totalReceitaEl) totalReceitaEl.textContent = fmtBRL(receitasNoDia);
    if (totalDespesaEl) totalDespesaEl.textContent = fmtBRL(totalDespesasPendentes);

    if (saldoDiaEl) {
      saldoDiaEl.textContent = fmtBRL(saldoProjetado);
      saldoDiaEl.className = saldoProjetado >= 0 ? "positivo" : "negativo";
    }

    // Linha final (projeção)
    listaDia.innerHTML += `
      <div class="linha-dia">
        <span><strong>Saldo projetado: </strong></span>
        <span><strong>${fmtBRL(saldoProjetado)}</strong></span>
      </div>
    `;
  } catch (err) {
    listaDia.innerHTML = `<div class="linha-dia"><span>Erro ao carregar resumo</span><span></span></div>`;
  }
}

if (filtroData) {
  if (filtroData) filtroData.addEventListener("change", async () => {
    await renderResumoPorData(filtroData.value);
  });
}

if (filtroTrimestreReceitas) {
  if (filtroTrimestreReceitas) filtroTrimestreReceitas.addEventListener("change", () => {
    renderHistoricos();
  });
}

if (filtroTrimestreDespesas) {
  if (filtroTrimestreDespesas) filtroTrimestreDespesas.addEventListener("change", () => {
    renderHistoricos();
  });
}

/* =========================
   MODAL (abrir/fechar)
========================= */
function abrirModal() {
  if (!modalOverlay) return;
  modalOverlay.classList.remove("hidden");
}

function fecharModal() {
  if (!modalOverlay) return;
  modalOverlay.classList.add("hidden");
  editandoId = null;
}

if (modalCloseBtn) if (modalCloseBtn) modalCloseBtn.addEventListener("click", fecharModal);
if (modalCancelBtn) if (modalCancelBtn) modalCancelBtn.addEventListener("click", fecharModal);

if (modalOverlay) {
  if (modalOverlay) modalOverlay.addEventListener("click", (ev) => {
    if (ev.target === modalOverlay) fecharModal();
  });
}

function abrirModalEdicao(id) {
  const entrada = entradasGlobais.find(e => Number(e.id) === Number(id));
  if (!entrada) return;

  editandoId = id;

  editData.value = entrada.data;
  editTipo.value = entrada.tipo;
  editDescricao.value = entrada.descricao;
  editValor.value = entrada.valor;

  editStatus.value = entrada.status || "em_andamento";
  atualizarStatusModal();

  abrirModal();
}

/* Submit do modal */
if (formEdit) {
  if (formEdit) formEdit.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    if (!editandoId) return;

    const payload = {
      data: editData.value,
      tipo: editTipo.value,
      descricao: editDescricao.value,
      valor: parseFloat(editValor.value),
      status: editTipo.value === "despesa" ? (editStatus.value || "em_andamento") : null
    };

    await fetch(`/edit/${editandoId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    fecharModal();
    await carregarDados();

    if (filtroData && filtroData.value) {
      await renderResumoPorData(filtroData.value);
    }
  });
}

/* =========================
   CARREGAR DADOS
========================= */
async function carregarDados() {
  const res = await fetch("/dados");
  const data = await res.json();

  entradasGlobais = data.entradas || [];

  renderHistoricos();

  atualizarCards();

  if (filtroData && filtroData.value) {
    await renderResumoPorData(filtroData.value);
  }
}

/* =========================
   EXCLUIR
========================= */
async function excluir(id) {
  if (!confirm("Deseja excluir esta entrada?")) return;
  await fetch(`/delete/${id}`, { method: "DELETE" });

  if (editandoId === id) fecharModal();

  await carregarDados();
}

/* =========================
   SUBMIT (ADD)
========================= */
if (form) form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const payload = {
    data: inputData.value,
    tipo: inputTipo.value,
    descricao: inputDescricao.value,
    valor: parseFloat(inputValor.value),
    status: inputTipo.value === "despesa" ? (inputStatus.value || "em_andamento") : null
  };

  await fetch("/add", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  form.reset();
  inputTipo.value = "receita";
  atualizarStatusFormPrincipal();

  await carregarDados();

  if (filtroData && filtroData.value) {
    await renderResumoPorData(filtroData.value);
  }
});

/* =========================
   INIT
========================= */
if (inputTipo && inputStatus) atualizarStatusFormPrincipal();
bindAcoesListas();
carregarDados();
