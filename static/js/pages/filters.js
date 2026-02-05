(function () {
  const rulesList = document.getElementById("rules-list");
  if (!rulesList) return;

  const ruleNewBtn = document.getElementById("rule-new");
  const ruleModal = document.getElementById("rule-modal");
  const ruleModalClose = document.getElementById("rule-modal-close");
  const ruleModalCancel = document.getElementById("rule-modal-cancel");
  const ruleModalTitle = document.getElementById("rule-modal-title");
  const ruleForm = document.getElementById("rule-form");
  const ruleId = document.getElementById("rule-id");
  const outputBox = document.getElementById("rules-output");
  const rulesEmpty = document.getElementById("rules-empty");

  const recurrenceList = document.getElementById("recurrence-list");
  const recurrenceEmpty = document.getElementById("recurrence-empty");
  const recurrenceNewBtns = document.querySelectorAll("[data-recurrence-new]");
  const recurrenceModal = document.getElementById("recurrence-modal");
  const recurrenceModalClose = document.getElementById("recurrence-modal-close");
  const recurrenceModalCancel = document.getElementById("recurrence-modal-cancel");
  const recurrenceModalTitle = document.getElementById("recurrence-modal-title");
  const recurrenceForm = document.getElementById("recurrence-form");
  const recurrenceId = document.getElementById("recurrence-id");
  const recurrenceName = document.getElementById("recurrence-name");
  const recurrenceType = document.getElementById("recurrence-type");
  const recurrenceDay = document.getElementById("recurrence-day");
  const recurrenceCategory = document.getElementById("recurrence-category");
  const recurrenceValue = document.getElementById("recurrence-value");
  const recurrenceStatus = document.getElementById("recurrence-status");
  const recurrenceMethod = document.getElementById("recurrence-method");
  const recurrenceDescription = document.getElementById("recurrence-description");
  const recurrenceTags = document.getElementById("recurrence-tags");
  const recurrenceEnabled = document.getElementById("recurrence-enabled");

  const reminderList = document.getElementById("reminder-list");
  const reminderEmpty = document.getElementById("reminder-empty");
  const reminderNewBtns = document.querySelectorAll("[data-reminder-new]");
  const reminderModal = document.getElementById("reminder-modal");
  const reminderModalClose = document.getElementById("reminder-modal-close");
  const reminderModalCancel = document.getElementById("reminder-modal-cancel");
  const reminderModalTitle = document.getElementById("reminder-modal-title");
  const reminderForm = document.getElementById("reminder-form");
  const reminderId = document.getElementById("reminder-id");
  const reminderName = document.getElementById("reminder-name");
  const reminderDays = document.getElementById("reminder-days");
  const reminderType = document.getElementById("reminder-type");
  const reminderCategory = document.getElementById("reminder-category");
  const reminderStatus = document.getElementById("reminder-status");
  const reminderMethod = document.getElementById("reminder-method");
  const reminderMin = document.getElementById("reminder-min");
  const reminderMax = document.getElementById("reminder-max");
  const reminderEnabled = document.getElementById("reminder-enabled");

  const summaryRules = document.getElementById("summary-rules");
  const summaryRecurring = document.getElementById("summary-recurring");
  const summaryReminders = document.getElementById("summary-reminders");

  const filterStart = document.getElementById("rules-filter-start");
  const filterEnd = document.getElementById("rules-filter-end");
  const filterType = document.getElementById("rules-filter-type");
  const filterCategory = document.getElementById("rules-filter-category");
  const filterStatus = document.getElementById("rules-filter-status");
  const filterMin = document.getElementById("rules-filter-min");
  const filterMax = document.getElementById("rules-filter-max");
  const filterLimit = document.getElementById("rules-filter-limit");

  const fieldName = document.getElementById("rule-name");
  const fieldPriority = document.getElementById("rule-priority");
  const fieldEnabled = document.getElementById("rule-enabled");
  const fieldApplyCreate = document.getElementById("rule-on-create");
  const fieldApplyEdit = document.getElementById("rule-on-edit");
  const fieldApplyImport = document.getElementById("rule-on-import");
  const fieldStop = document.getElementById("rule-stop");

  const condDescription = document.getElementById("cond-description");
  const condType = document.getElementById("cond-type");
  const condCategory = document.getElementById("cond-category");
  const condStatus = document.getElementById("cond-status");
  const condMin = document.getElementById("cond-min");
  const condMax = document.getElementById("cond-max");
  const condMethod = document.getElementById("cond-method");

  const actionCategory = document.getElementById("action-category");
  const actionStatus = document.getElementById("action-status");
  const actionTags = document.getElementById("action-tags");
  const actionPrefix = document.getElementById("action-prefix");
  const actionMethod = document.getElementById("action-method");

  let rules = [];
  let recurrences = [];
  let reminders = [];

  const CATEGORY_LABELS = {
    salario: "Salário",
    extras: "Extras",
    moradia: "Moradia",
    mercado: "Mercado",
    transporte: "Transporte",
    servicos: "Serviços",
    outros: "Outros"
  };

  const STATUS_LABELS = {
    pago: "Pago",
    em_andamento: "Em andamento",
    nao_pago: "Não pago",
    recebido: "Recebido"
  };

  const METHOD_LABELS = {
    dinheiro: "Dinheiro",
    cartao: "Cartão",
    pix: "Pix"
  };

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

  function syncCustomSelect(selectEl) {
    if (selectEl && typeof selectEl._customUpdate === "function") {
      selectEl._customUpdate();
    }
  }

  function initAllSelects(root) {
    const scope = root || document;
    scope.querySelectorAll("select.control").forEach(initCustomSelect);
  }

  const RULE_TEMPLATES = {
    salary: {
      name: "Salário recebido",
      priority: 50,
      apply_on_create: true,
      apply_on_edit: false,
      apply_on_import: false,
      stop_after_apply: true,
      conditions: [
        { field: "descricao", op: "contains", value: "salario" },
        { field: "tipo", op: "eq", value: "receita" }
      ],
      actions: [
        { type: "set_category", value: "salario" },
        { type: "set_status", value: "recebido" }
      ]
    },
    uber: {
      name: "Uber transporte",
      priority: 60,
      apply_on_create: true,
      apply_on_edit: false,
      apply_on_import: false,
      stop_after_apply: false,
      conditions: [
        { field: "descricao", op: "contains", value: "uber" },
        { field: "tipo", op: "eq", value: "despesa" }
      ],
      actions: [
        { type: "set_category", value: "transporte" },
        { type: "set_tags", value: "mobilidade" }
      ]
    },
    review: {
      name: "Revisar outros > 200",
      priority: 90,
      apply_on_create: true,
      apply_on_edit: true,
      apply_on_import: false,
      stop_after_apply: false,
      conditions: [
        { field: "categoria", op: "eq", value: "outros" },
        { field: "valor", op: "gte", value: 200 }
      ],
      actions: [
        { type: "set_tags", value: "revisar" }
      ]
    }
  };

  const RECURRENCE_TEMPLATES = {
    rent: {
      name: "Aluguel",
      tipo: "despesa",
      day_of_month: 5,
      categoria: "moradia",
      valor: 0,
      status: "em_andamento",
      metodo: "",
      descricao: "Aluguel",
      tags: "fixo"
    }
  };

  const REMINDER_TEMPLATES = {
    reminder: {
      name: "Lembrete 3 dias",
      days_before: 3,
      tipo: "despesa",
      categoria: "",
      status: "nao_pago",
      metodo: "",
      min_value: null,
      max_value: null
    }
  };

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function fmtDate(iso) {
    if (!iso) return "--";
    const dt = new Date(iso);
    if (Number.isNaN(dt.getTime())) return "--";
    return dt.toLocaleDateString("pt-BR");
  }

  function describeConditions(conditions) {
    if (!conditions || conditions.length === 0) return "Sem condicoes (aplica sempre)";
    return conditions.map(cond => {
      const field = cond.field;
      const op = cond.op;
      const value = cond.value;
      if (field === "descricao" && op === "contains") {
        return `Descricao contem \"${value}\"`;
      }
      if (field === "tipo" && op === "eq") return `Tipo = ${value}`;
      if (field === "categoria" && op === "eq") return `Categoria = ${CATEGORY_LABELS[value] || value}`;
      if (field === "status" && op === "eq") return `Status = ${STATUS_LABELS[value] || value}`;
      if (field === "metodo" && op === "eq") return `Metodo = ${METHOD_LABELS[value] || value}`;
      if (field === "valor" && op === "gte") return `Valor >= ${value}`;
      if (field === "valor" && op === "lte") return `Valor <= ${value}`;
      if (field === "tags" && op === "contains") return `Tags contem ${value}`;
      return `${field} ${op} ${value}`;
    }).join(" · ");
  }

  function describeActions(actions) {
    if (!actions || actions.length === 0) return "Sem acoes";
    return actions.map(action => {
      const type = action.type;
      const value = action.value;
      if (type === "set_category") return `Categoria -> ${CATEGORY_LABELS[value] || value}`;
      if (type === "set_status") return `Status -> ${STATUS_LABELS[value] || value}`;
      if (type === "set_tags") return `Tags -> ${value}`;
      if (type === "set_description_prefix") return `Prefixo -> ${value}`;
      if (type === "set_method") return `Metodo -> ${METHOD_LABELS[value] || value}`;
      return `${type}: ${value}`;
    }).join(" · ");
  }

  function updateSummary() {
    if (summaryRules) {
      summaryRules.textContent = String(rules.filter(rule => rule.is_enabled).length);
    }
    if (summaryRecurring) summaryRecurring.textContent = String(recurrences.filter(item => item.is_enabled).length);
    if (summaryReminders) summaryReminders.textContent = String(reminders.filter(item => item.is_enabled).length);
  }

  function renderRules() {
    if (!rulesList) return;
    if (!rules || rules.length === 0) {
      rulesList.innerHTML = "";
      rulesEmpty?.classList.remove("hidden");
      updateSummary();
      return;
    }

    rulesEmpty?.classList.add("hidden");

    rulesList.innerHTML = rules.map(rule => {
      const conditions = describeConditions(rule.conditions || []);
      const actions = describeActions(rule.actions || []);
      const applyOn = [
        rule.apply_on_create ? "criar" : null,
        rule.apply_on_edit ? "editar" : null,
        rule.apply_on_import ? "importar" : null
      ].filter(Boolean).join(", ");

      return `
        <li class="rule-item" data-id="${rule.id}">
          <div class="rule-main">
            <strong>${escapeHtml(rule.name)}</strong>
            <span class="rule-meta">${escapeHtml(conditions)}</span>
            <span class="rule-meta">${escapeHtml(actions)}</span>
            <span class="rule-meta">Aplicar em: ${escapeHtml(applyOn || "--")}${rule.stop_after_apply ? " · Parar apos aplicar" : ""}</span>
          </div>
          <div class="rule-side">
            <div class="rule-stats">
              <span>Executou ${rule.run_count || 0}x</span>
              <span>Ultima: ${fmtDate(rule.last_run_at)}</span>
            </div>
            <div class="rule-actions">
              <label class="switch">
                <input type="checkbox" data-action="toggle" ${rule.is_enabled ? "checked" : ""}>
                <span class="switch-track"></span>
                <span class="switch-label">Ativo</span>
              </label>
              <button class="btn-tertiary" type="button" data-action="edit">Editar</button>
              <button class="btn-tertiary" type="button" data-action="test">Testar</button>
              <button class="btn-tertiary" type="button" data-action="apply">Aplicar</button>
              <button class="btn-tertiary" type="button" data-action="log">Ver log</button>
            </div>
          </div>
        </li>
      `;
    }).join("");

    updateSummary();
  }

  function renderRecurrences() {
    if (!recurrenceList) return;
    if (!recurrences || recurrences.length === 0) {
      recurrenceList.innerHTML = "";
      recurrenceEmpty?.classList.remove("hidden");
      updateSummary();
      return;
    }
    recurrenceEmpty?.classList.add("hidden");
    recurrenceList.innerHTML = recurrences.map(item => {
      const tipo = item.tipo === "receita" ? "Receita" : "Despesa";
      const cat = CATEGORY_LABELS[item.categoria] || item.categoria;
      return `
        <article class="rule-card" data-id="${item.id}">
          <strong>${escapeHtml(item.name)}</strong>
          <p>${tipo} · Dia ${item.day_of_month} · ${escapeHtml(cat)} · R$ ${Number(item.valor || 0).toFixed(2)}</p>
          <div class="rule-actions">
            <label class="switch">
              <input type="checkbox" data-action="rec-toggle" ${item.is_enabled ? "checked" : ""}>
              <span class="switch-track"></span>
              <span class="switch-label">Ativo</span>
            </label>
            <button class="btn-tertiary" type="button" data-action="rec-edit">Editar</button>
            <button class="btn-tertiary" type="button" data-action="rec-run">Gerar agora</button>
          </div>
        </article>
      `;
    }).join("");
    updateSummary();
  }

  function renderReminders() {
    if (!reminderList) return;
    if (!reminders || reminders.length === 0) {
      reminderList.innerHTML = "";
      reminderEmpty?.classList.remove("hidden");
      updateSummary();
      return;
    }
    reminderEmpty?.classList.add("hidden");
    reminderList.innerHTML = reminders.map(item => {
      const tipo = item.tipo ? (item.tipo === "receita" ? "Receita" : "Despesa") : "Todos";
      const cat = item.categoria ? (CATEGORY_LABELS[item.categoria] || item.categoria) : "Todas";
      return `
        <article class="rule-card" data-id="${item.id}">
          <strong>${escapeHtml(item.name)}</strong>
          <p>${tipo} · ${cat} · ${item.days_before} dias antes</p>
          <div class="rule-actions">
            <label class="switch">
              <input type="checkbox" data-action="rem-toggle" ${item.is_enabled ? "checked" : ""}>
              <span class="switch-track"></span>
              <span class="switch-label">Ativo</span>
            </label>
            <button class="btn-tertiary" type="button" data-action="rem-edit">Editar</button>
            <button class="btn-tertiary" type="button" data-action="rem-test">Testar</button>
          </div>
        </article>
      `;
    }).join("");
    updateSummary();
  }

  function showOutput(title, items) {
    if (!outputBox) return;
    outputBox.classList.remove("hidden");
    const list = items && items.length
      ? `<ul class="rules-output-list">${items.map(item => `<li>${item}</li>`).join("")}</ul>`
      : "<div>Nenhum resultado.</div>";
    outputBox.innerHTML = `<strong>${escapeHtml(title)}</strong>${list}`;
  }

  function closeModal() {
    ruleModal?.classList.add("hidden");
  }

  function openModal(rule) {
    if (!ruleModal) return;
    const isTemplate = !!(rule && rule._template);
    ruleModalTitle.textContent = rule && !isTemplate ? "Editar regra" : "Nova regra";
    ruleId.value = isTemplate ? "" : (rule?.id || "");
    fieldName.value = rule?.name || "";
    fieldPriority.value = rule?.priority ?? 100;
    fieldEnabled.checked = rule ? (rule.is_enabled !== undefined ? !!rule.is_enabled : true) : true;

    fieldApplyCreate.checked = rule ? !!rule.apply_on_create : true;
    fieldApplyEdit.checked = rule ? !!rule.apply_on_edit : true;
    fieldApplyImport.checked = rule ? !!rule.apply_on_import : false;
    fieldStop.checked = rule ? !!rule.stop_after_apply : false;

    condDescription.value = "";
    condType.value = "all";
    condCategory.value = "all";
    condStatus.value = "all";
    condMin.value = "";
    condMax.value = "";
    condMethod.value = "all";

    actionCategory.value = "";
    actionStatus.value = "";
    actionTags.value = "";
    actionPrefix.value = "";
    actionMethod.value = "";

    if (rule?.conditions) {
      rule.conditions.forEach(cond => {
        if (cond.field === "descricao" && cond.op === "contains") condDescription.value = cond.value || "";
        if (cond.field === "tipo" && cond.op === "eq") condType.value = cond.value || "all";
        if (cond.field === "categoria" && cond.op === "eq") condCategory.value = cond.value || "all";
        if (cond.field === "status" && cond.op === "eq") condStatus.value = cond.value || "all";
        if (cond.field === "metodo" && cond.op === "eq") condMethod.value = cond.value || "all";
        if (cond.field === "valor" && cond.op === "gte") condMin.value = cond.value ?? "";
        if (cond.field === "valor" && cond.op === "lte") condMax.value = cond.value ?? "";
      });
    }

    if (rule?.actions) {
      rule.actions.forEach(action => {
        if (action.type === "set_category") actionCategory.value = action.value || "";
        if (action.type === "set_status") actionStatus.value = action.value || "";
        if (action.type === "set_tags") actionTags.value = action.value || "";
        if (action.type === "set_description_prefix") actionPrefix.value = action.value || "";
        if (action.type === "set_method") actionMethod.value = action.value || "";
      });
    }

    [
      condType,
      condCategory,
      condStatus,
      condMethod,
      actionCategory,
      actionStatus,
      actionMethod
    ].forEach(syncCustomSelect);

    ruleModal.classList.remove("hidden");
  }

  function openTemplate(key) {
    const template = RULE_TEMPLATES[key];
    if (!template) return;
    openModal({ ...template, _template: true });
  }

  function closeRecurrenceModal() {
    recurrenceModal?.classList.add("hidden");
  }

  function openRecurrenceModal(item) {
    if (!recurrenceModal) return;
    const isTemplate = !!(item && item._template);
    recurrenceModalTitle.textContent = item && !isTemplate ? "Editar recorrencia" : "Nova recorrencia";
    recurrenceId.value = isTemplate ? "" : (item?.id || "");
    recurrenceName.value = item?.name || "";
    recurrenceType.value = item?.tipo || "despesa";
    recurrenceDay.value = item?.day_of_month ?? 5;
    recurrenceCategory.value = item?.categoria || "outros";
    recurrenceValue.value = item?.valor ?? 0;
    recurrenceStatus.value = item?.status || "";
    recurrenceMethod.value = item?.metodo || "";
    recurrenceDescription.value = item?.descricao || "";
    recurrenceTags.value = item?.tags || "";
    recurrenceEnabled.checked = item ? (item.is_enabled !== undefined ? !!item.is_enabled : true) : true;

    [
      recurrenceType,
      recurrenceCategory,
      recurrenceStatus,
      recurrenceMethod
    ].forEach(syncCustomSelect);

    recurrenceModal.classList.remove("hidden");
  }

  function openRecurrenceTemplate(key) {
    const template = RECURRENCE_TEMPLATES[key];
    if (!template) return;
    openRecurrenceModal({ ...template, _template: true });
  }

  function closeReminderModal() {
    reminderModal?.classList.add("hidden");
  }

  function openReminderModal(item) {
    if (!reminderModal) return;
    const isTemplate = !!(item && item._template);
    reminderModalTitle.textContent = item && !isTemplate ? "Editar lembrete" : "Novo lembrete";
    reminderId.value = isTemplate ? "" : (item?.id || "");
    reminderName.value = item?.name || "";
    reminderDays.value = item?.days_before ?? 3;
    reminderType.value = item?.tipo || "";
    reminderCategory.value = item?.categoria || "";
    reminderStatus.value = item?.status || "";
    reminderMethod.value = item?.metodo || "";
    reminderMin.value = item?.min_value ?? "";
    reminderMax.value = item?.max_value ?? "";
    reminderEnabled.checked = item ? (item.is_enabled !== undefined ? !!item.is_enabled : true) : true;

    [
      reminderType,
      reminderCategory,
      reminderStatus,
      reminderMethod
    ].forEach(syncCustomSelect);

    reminderModal.classList.remove("hidden");
  }

  function openReminderTemplate(key) {
    const template = REMINDER_TEMPLATES[key];
    if (!template) return;
    openReminderModal({ ...template, _template: true });
  }

  function buildConditions() {
    const conditions = [];
    if (condDescription.value.trim()) {
      conditions.push({ field: "descricao", op: "contains", value: condDescription.value.trim() });
    }
    if (condType.value !== "all") {
      conditions.push({ field: "tipo", op: "eq", value: condType.value });
    }
    if (condCategory.value !== "all") {
      conditions.push({ field: "categoria", op: "eq", value: condCategory.value });
    }
    if (condStatus.value !== "all") {
      conditions.push({ field: "status", op: "eq", value: condStatus.value });
    }
    if (condMin.value !== "") {
      conditions.push({ field: "valor", op: "gte", value: Number(condMin.value) });
    }
    if (condMax.value !== "") {
      conditions.push({ field: "valor", op: "lte", value: Number(condMax.value) });
    }
    if (condMethod.value !== "all") {
      conditions.push({ field: "metodo", op: "eq", value: condMethod.value });
    }
    return conditions;
  }

  function buildActions() {
    const actions = [];
    if (actionCategory.value) {
      actions.push({ type: "set_category", value: actionCategory.value });
    }
    if (actionStatus.value) {
      actions.push({ type: "set_status", value: actionStatus.value });
    }
    if (actionTags.value.trim()) {
      actions.push({ type: "set_tags", value: actionTags.value.trim() });
    }
    if (actionPrefix.value.trim()) {
      actions.push({ type: "set_description_prefix", value: actionPrefix.value.trim() });
    }
    if (actionMethod.value) {
      actions.push({ type: "set_method", value: actionMethod.value });
    }
    return actions;
  }

  async function fetchRules() {
    const res = await fetch("/api/rules");
    const data = await res.json();
    rules = data.rules || [];
    renderRules();
  }

  async function fetchRecurrences() {
    if (!recurrenceList) return;
    const res = await fetch("/api/recurrences");
    const data = await res.json();
    recurrences = data.recurrences || [];
    renderRecurrences();
  }

  async function fetchReminders() {
    if (!reminderList) return;
    const res = await fetch("/api/reminders");
    const data = await res.json();
    reminders = data.reminders || [];
    renderReminders();
  }

  async function saveRule(ev) {
    ev.preventDefault();
    const payload = {
      name: fieldName.value.trim() || "Nova regra",
      priority: Number(fieldPriority.value || 100),
      is_enabled: fieldEnabled.checked,
      apply_on_create: fieldApplyCreate.checked,
      apply_on_edit: fieldApplyEdit.checked,
      apply_on_import: fieldApplyImport.checked,
      stop_after_apply: fieldStop.checked,
      conditions: buildConditions(),
      actions: buildActions()
    };

    if (payload.actions.length === 0) {
      alert("Adicione ao menos uma acao.");
      return;
    }

    const id = ruleId.value;
    const url = id ? `/api/rules/${id}` : "/api/rules";
    const method = id ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) {
      alert("Não foi possível salvar a regra.");
      return;
    }

    closeModal();
    await fetchRules();
  }

  async function saveRecurrence(ev) {
    ev.preventDefault();
    const payload = {
      name: recurrenceName.value.trim() || "Nova recorrencia",
      tipo: recurrenceType.value,
      day_of_month: Number(recurrenceDay.value || 1),
      categoria: recurrenceCategory.value,
      valor: Number(recurrenceValue.value || 0),
      status: recurrenceStatus.value || null,
      metodo: recurrenceMethod.value || null,
      descricao: recurrenceDescription.value.trim() || recurrenceName.value.trim(),
      tags: recurrenceTags.value.trim() || null,
      is_enabled: recurrenceEnabled.checked
    };
    const id = recurrenceId.value;
    const url = id ? `/api/recurrences/${id}` : "/api/recurrences";
    const method = id ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      alert("Não foi possível salvar a recorrencia.");
      return;
    }
    closeRecurrenceModal();
    await fetchRecurrences();
  }

  async function saveReminder(ev) {
    ev.preventDefault();
    const payload = {
      name: reminderName.value.trim() || "Novo lembrete",
      days_before: Number(reminderDays.value || 3),
      tipo: reminderType.value || null,
      categoria: reminderCategory.value || null,
      status: reminderStatus.value || null,
      metodo: reminderMethod.value || null,
      min_value: reminderMin.value !== "" ? Number(reminderMin.value) : null,
      max_value: reminderMax.value !== "" ? Number(reminderMax.value) : null,
      is_enabled: reminderEnabled.checked
    };
    const id = reminderId.value;
    const url = id ? `/api/reminders/${id}` : "/api/reminders";
    const method = id ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      alert("Não foi possível salvar o lembrete.");
      return;
    }
    closeReminderModal();
    await fetchReminders();
  }

  async function toggleRule(id, enabled) {
    await fetch(`/api/rules/${id}/toggle`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_enabled: enabled })
    });
    await fetchRules();
  }

  async function toggleRecurrence(id, enabled) {
    await fetch(`/api/recurrences/${id}/toggle`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_enabled: enabled })
    });
    await fetchRecurrences();
  }

  async function toggleReminder(id, enabled) {
    await fetch(`/api/reminders/${id}/toggle`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_enabled: enabled })
    });
    await fetchReminders();
  }

  function buildFilterPayload() {
    return {
      start: filterStart?.value || null,
      end: filterEnd?.value || null,
      tipo: filterType?.value || "all",
      categoria: filterCategory?.value || "all",
      status: filterStatus?.value || "all",
      min: filterMin?.value || null,
      max: filterMax?.value || null,
      limit: Number(filterLimit?.value || 200)
    };
  }

  async function testRule(rule) {
    const payload = buildFilterPayload();
    const res = await fetch(`/api/rules/${rule.id}/test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) {
      showOutput("Erro ao testar regra", []);
      return;
    }

    const items = (data.preview || []).map(item => {
      const changeText = Object.entries(item.changes || {})
        .map(([key, val]) => `${key}: ${val.before} -> ${val.after}`)
        .join(" | ");
      return `#${item.entry_id} ${item.date || "--"} - ${escapeHtml(item.description)} (${item.value}) ${changeText ? " - " + escapeHtml(changeText) : ""}`;
    });
    showOutput(`Teste: ${data.matched || 0} encontrados`, items);
  }

  async function applyRule(rule) {
    if (!confirm("Aplicar esta regra no historico filtrado?")) return;
    const payload = buildFilterPayload();
    const res = await fetch(`/api/rules/${rule.id}/apply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) {
      showOutput("Erro ao aplicar regra", []);
      return;
    }
    showOutput(`Aplicado: ${data.updated || 0} alterados`, []);
    await fetchRules();
  }

  async function loadLog(rule) {
    const res = await fetch(`/api/rules/${rule.id}/log?limit=50`);
    const data = await res.json();
    if (!res.ok) {
      showOutput("Erro ao carregar log", []);
      return;
    }
    const items = (data.executions || []).map(item => {
      const changeText = Object.entries(item.changes || {})
        .map(([key, val]) => `${key}: ${val.before} -> ${val.after}`)
        .join(" | ");
      return `${fmtDate(item.created_at)} (${item.trigger}) entry #${item.entry_id || "--"} ${changeText ? " - " + escapeHtml(changeText) : ""}`;
    });
    showOutput("Log da regra", items);
  }

  async function runRecurrence(item) {
    const res = await fetch(`/api/recurrences/${item.id}/run`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      alert("Não foi possível gerar a recorrencia.");
      return;
    }
    if (data.created) {
      showOutput("Recorrencia gerada", [`Entrada criada #${data.entry_id}`]);
    } else {
      showOutput("Recorrencia ja gerada", [`Entrada existente #${data.entry_id}`]);
    }
  }

  async function testReminder(item) {
    const res = await fetch(`/api/reminders/${item.id}/test`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      showOutput("Erro ao testar lembrete", []);
      return;
    }
    const items = (data.preview || []).map(entry => {
      return `#${entry.id} ${entry.date || "--"} - ${escapeHtml(entry.descricao)} (${entry.valor})`;
    });
    showOutput(`Lembrete: ${data.matched || 0} encontrados`, items);
  }

  ruleNewBtn?.addEventListener("click", () => openModal(null));
  ruleModalClose?.addEventListener("click", closeModal);
  ruleModalCancel?.addEventListener("click", closeModal);
  ruleModal?.addEventListener("click", (ev) => {
    if (ev.target === ruleModal) closeModal();
  });
  ruleForm?.addEventListener("submit", saveRule);

  document.querySelectorAll("[data-template]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.getAttribute("data-template");
      if (RULE_TEMPLATES[key]) openTemplate(key);
      if (RECURRENCE_TEMPLATES[key]) openRecurrenceTemplate(key);
      if (REMINDER_TEMPLATES[key]) openReminderTemplate(key);
    });
  });

  recurrenceNewBtns?.forEach((btn) => {
    btn.addEventListener("click", () => openRecurrenceModal(null));
  });
  recurrenceModalClose?.addEventListener("click", closeRecurrenceModal);
  recurrenceModalCancel?.addEventListener("click", closeRecurrenceModal);
  recurrenceModal?.addEventListener("click", (ev) => {
    if (ev.target === recurrenceModal) closeRecurrenceModal();
  });
  recurrenceForm?.addEventListener("submit", saveRecurrence);

  reminderNewBtns?.forEach((btn) => {
    btn.addEventListener("click", () => openReminderModal(null));
  });
  reminderModalClose?.addEventListener("click", closeReminderModal);
  reminderModalCancel?.addEventListener("click", closeReminderModal);
  reminderModal?.addEventListener("click", (ev) => {
    if (ev.target === reminderModal) closeReminderModal();
  });
  reminderForm?.addEventListener("submit", saveReminder);

  rulesList.addEventListener("click", (ev) => {
    const btn = ev.target.closest("button[data-action]");
    if (!btn) return;
    const item = btn.closest(".rule-item");
    if (!item) return;
    const id = Number(item.dataset.id);
    const rule = rules.find(r => r.id === id);
    if (!rule) return;

    const action = btn.dataset.action;
    if (action === "edit") openModal(rule);
    if (action === "test") testRule(rule);
    if (action === "apply") applyRule(rule);
    if (action === "log") loadLog(rule);
  });

  rulesList.addEventListener("change", (ev) => {
    const input = ev.target;
    if (!(input instanceof HTMLInputElement)) return;
    if (input.dataset.action !== "toggle") return;
    const item = input.closest(".rule-item");
    if (!item) return;
    const id = Number(item.dataset.id);
    toggleRule(id, input.checked);
  });

  recurrenceList?.addEventListener("click", (ev) => {
    const btn = ev.target.closest("button[data-action]");
    if (!btn) return;
    const item = btn.closest("[data-id]");
    if (!item) return;
    const id = Number(item.dataset.id);
    const rec = recurrences.find(r => r.id === id);
    if (!rec) return;
    const action = btn.dataset.action;
    if (action === "rec-edit") openRecurrenceModal(rec);
    if (action === "rec-run") runRecurrence(rec);
  });

  recurrenceList?.addEventListener("change", (ev) => {
    const input = ev.target;
    if (!(input instanceof HTMLInputElement)) return;
    if (input.dataset.action !== "rec-toggle") return;
    const item = input.closest("[data-id]");
    if (!item) return;
    const id = Number(item.dataset.id);
    toggleRecurrence(id, input.checked);
  });

  reminderList?.addEventListener("click", (ev) => {
    const btn = ev.target.closest("button[data-action]");
    if (!btn) return;
    const item = btn.closest("[data-id]");
    if (!item) return;
    const id = Number(item.dataset.id);
    const rem = reminders.find(r => r.id === id);
    if (!rem) return;
    const action = btn.dataset.action;
    if (action === "rem-edit") openReminderModal(rem);
    if (action === "rem-test") testReminder(rem);
  });

  reminderList?.addEventListener("change", (ev) => {
    const input = ev.target;
    if (!(input instanceof HTMLInputElement)) return;
    if (input.dataset.action !== "rem-toggle") return;
    const item = input.closest("[data-id]");
    if (!item) return;
    const id = Number(item.dataset.id);
    toggleReminder(id, input.checked);
  });

  initAllSelects(document);
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (!(node instanceof HTMLElement)) return;
        if (node.tagName === "SELECT") {
          initCustomSelect(node);
        } else {
          initAllSelects(node);
        }
      });
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });

  fetchRules();
  fetchRecurrences();
  fetchReminders();
})();
