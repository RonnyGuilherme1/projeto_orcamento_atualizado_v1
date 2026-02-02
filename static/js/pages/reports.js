(function () {
  const page = document.querySelector("[data-reports-page]");
  if (!page) return;

  const periodSelect = document.getElementById("reports-period");
  const rangeBox = page.querySelector("[data-range]");
  const statusEl = document.getElementById("reports-status");
  const tabButtons = page.querySelectorAll(".tab-btn");
  const tabPanels = page.querySelectorAll(".tab-panel");

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

  let statusTimer = null;
  function markUpdated() {
    const stamp = formatStamp(new Date());
    setStatus(`Atualizado: ${stamp}`, false);
  }

  function handleFilterChange() {
    setRangeVisibility();
    setStatus("Atualizando...", true);
    if (statusTimer) window.clearTimeout(statusTimer);
    statusTimer = window.setTimeout(markUpdated, 400);
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
    if (selectEl.multiple) return;
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

  function initAllSelects(root) {
    const scope = root || document;
    scope.querySelectorAll("select.control").forEach(initCustomSelect);
  }

  const controls = page.querySelectorAll(".reports-filters .control, .reports-range .control");
  controls.forEach(control => {
    control.addEventListener("change", handleFilterChange);
  });

  tabButtons.forEach(btn => {
    btn.addEventListener("click", () => activateTab(btn.dataset.tab));
  });

  const initialTab = page.querySelector(".tab-btn.is-active")?.dataset.tab || tabButtons[0]?.dataset.tab;
  if (initialTab) activateTab(initialTab);

  initAllSelects(page);
  setRangeVisibility();
  markUpdated();
})();
