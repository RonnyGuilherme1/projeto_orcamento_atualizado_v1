(function () {
  const meta = document.querySelector('meta[name="csrf-token"]');
  const token = meta ? meta.getAttribute("content") : "";
  if (!token) return;

  function patchFetch() {
    if (!window.fetch) return;
    const originalFetch = window.fetch.bind(window);
    window.fetch = function (input, init) {
      const opts = init || {};
      const method = String(opts.method || "GET").toUpperCase();
      if (!["GET", "HEAD", "OPTIONS", "TRACE"].includes(method)) {
        const headers = new Headers(opts.headers || {});
        if (!headers.has("X-CSRF-Token")) {
          headers.set("X-CSRF-Token", token);
        }
        opts.headers = headers;
      }
      return originalFetch(input, opts);
    };
  }

  function patchForms() {
    document.querySelectorAll("form").forEach((form) => {
      const method = String(form.getAttribute("method") || "GET").toUpperCase();
      if (method === "GET") return;
      if (form.querySelector('input[name="csrf_token"]')) return;
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = "csrf_token";
      input.value = token;
      form.appendChild(input);
    });
  }

  patchFetch();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", patchForms);
  } else {
    patchForms();
  }
})();
