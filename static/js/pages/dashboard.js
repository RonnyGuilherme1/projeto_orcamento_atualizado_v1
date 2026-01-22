(function () {
  const cardsRoot = document.getElementById("cards");
  const filtroData = document.getElementById("filtro-data");
  const listaDia = document.getElementById("lista-dia");
  const totalReceitaEl = document.getElementById("total-receita");
  const totalDespesaEl = document.getElementById("total-despesa");
  const saldoDiaEl = document.getElementById("saldo-dia");

  // Esta página não existe? Sai sem fazer nada.
  if (!cardsRoot && !filtroData && !listaDia) return;

  const meses = [
    "Janeiro", "Fevereiro", "Março",
    "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro",
    "Outubro", "Novembro", "Dezembro"
  ];

  let entradas = [];

  function fmtBRL(valor) {
    const num = Number(valor) || 0;
    return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
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
            <span><strong>Despesas pendentes</strong></span>
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

      if (totalReceitaEl) totalReceitaEl.textContent = fmtBRL(receitasNoDia);
      if (totalDespesaEl) totalDespesaEl.textContent = fmtBRL(totalDespesasPendentes);

      if (saldoDiaEl) {
        saldoDiaEl.textContent = fmtBRL(saldoProjetado);
        saldoDiaEl.className = saldoProjetado >= 0 ? "positivo" : "negativo";
      }

      listaDia.innerHTML += `
        <div class="linha-dia">
          <span><strong>Saldo projetado:</strong></span>
          <span><strong>${fmtBRL(saldoProjetado)}</strong></span>
        </div>
      `;
    } catch (err) {
      listaDia.innerHTML = `<div class="linha-dia"><span>Erro ao carregar resumo</span><span></span></div>`;
    }
  }

  async function carregarDados() {
    const res = await fetch("/dados");
    const data = await res.json();
    entradas = data.entradas || [];
    atualizarCards();

    if (filtroData && filtroData.value) {
      await renderResumoPorData(filtroData.value);
    }
  }

  if (filtroData) {
    filtroData.addEventListener("change", async () => {
      await renderResumoPorData(filtroData.value);
    });
  }

  carregarDados();
})();