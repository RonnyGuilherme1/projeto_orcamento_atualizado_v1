(function () {
  const inputs = Array.from(
    document.querySelectorAll("[data-mask='cpf'], [data-mask='phone']")
  );
  if (!inputs.length) return;

  const onlyDigits = (value) => (value || "").replace(/\D+/g, "");

  function formatCpf(value) {
    const digits = onlyDigits(value).slice(0, 11);
    let out = "";
    for (let i = 0; i < digits.length; i += 1) {
      if (i === 3 || i === 6) out += ".";
      if (i === 9) out += "-";
      out += digits[i];
    }
    return out;
  }

  function formatPhone(value) {
    const digits = onlyDigits(value).slice(0, 11);
    if (!digits) return "";
    if (digits.length <= 2) return `(${digits}`;

    const ddd = digits.slice(0, 2);
    const rest = digits.slice(2);
    if (digits.length <= 10) {
      const first = rest.slice(0, 4);
      const second = rest.slice(4, 8);
      return second ? `(${ddd}) ${first}-${second}` : `(${ddd}) ${first}`;
    }

    const first = rest.slice(0, 5);
    const second = rest.slice(5, 9);
    return second ? `(${ddd}) ${first}-${second}` : `(${ddd}) ${first}`;
  }

  function isValidCpfDigits(digits) {
    return digits.length === 11;
  }

  function isValidPhoneDigits(digits) {
    if (digits.length === 10) return true;
    return digits.length === 11 && digits[2] === "9";
  }

  function syncInputValue(input) {
    const kind = input.dataset.mask;
    const formatted = kind === "cpf" ? formatCpf(input.value) : formatPhone(input.value);
    if (input.value !== formatted) {
      input.value = formatted;
    }
  }

  function syncValidity(input) {
    const kind = input.dataset.mask;
    const digits = onlyDigits(input.value);
    if (!digits) {
      input.setCustomValidity("");
      return true;
    }
    const ok =
      kind === "cpf" ? isValidCpfDigits(digits) : isValidPhoneDigits(digits);
    if (ok) {
      input.setCustomValidity("");
      return true;
    }
    input.setCustomValidity(
      kind === "cpf" ? "Informe um CPF valido." : "Informe um telefone valido."
    );
    return false;
  }

  const forms = new Map();

  inputs.forEach((input) => {
    syncInputValue(input);
    syncValidity(input);
    input.addEventListener("input", () => {
      syncInputValue(input);
      syncValidity(input);
    });
    input.addEventListener("blur", () => syncValidity(input));

    const form = input.closest("form");
    if (form) {
      if (!forms.has(form)) {
        forms.set(form, []);
      }
      forms.get(form).push(input);
    }
  });

  forms.forEach((formInputs, form) => {
    form.addEventListener("submit", (event) => {
      let ok = true;
      formInputs.forEach((input) => {
        syncInputValue(input);
        if (!syncValidity(input)) ok = false;
      });
      if (!ok) {
        event.preventDefault();
        const firstInvalid = formInputs.find((input) => !input.checkValidity());
        if (firstInvalid) {
          firstInvalid.reportValidity();
        }
      }
    });
  });
})();
