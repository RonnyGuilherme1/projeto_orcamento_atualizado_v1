(function () {
  const body = document.body;
  const toggleBtns = document.querySelectorAll('[data-sidebar-toggle]');
  const overlay = document.querySelector('[data-sidebar-overlay]');
  const closeTargets = document.querySelectorAll('[data-sidebar-close]');

  const DESKTOP_MIN = 1025;

  function isDesktop() {
    return window.innerWidth >= DESKTOP_MIN;
  }

  function openSidebar() {
    body.classList.add('sidebar-open');
    // No desktop, "open" = expandido. Remove o estado compacto.
    if (isDesktop()) body.classList.remove('sidebar-collapsed');
  }

  function closeSidebar() {
    body.classList.remove('sidebar-open');
    // No desktop, "closed" = compacto fixo.
    if (isDesktop()) body.classList.add('sidebar-collapsed');
  }

  function toggleSidebar() {
    if (body.classList.contains('sidebar-open')) {
      closeSidebar();
    } else {
      openSidebar();
    }
  }

  function syncSidebarStateOnResize() {
    // Mobile: sidebar-open controla drawer; sidebar-collapsed não importa (fica neutro).
    if (!isDesktop()) return;

    // Desktop: garante exclusividade entre estados.
    if (body.classList.contains('sidebar-open')) {
      body.classList.remove('sidebar-collapsed');
    } else {
      body.classList.add('sidebar-collapsed');
    }
  }

  if (toggleBtns.length) {
    toggleBtns.forEach((btn) => {
      btn.addEventListener('click', toggleSidebar);
      btn.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          toggleSidebar();
        }
      });
    });
  }

  if (overlay) {
    overlay.addEventListener('click', closeSidebar);
  }

  if (closeTargets.length) {
    closeTargets.forEach((el) => {
      el.addEventListener('click', closeSidebar);
      el.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          closeSidebar();
        }
      });
    });
  }

  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      closeSidebar();
    }
  });

  window.addEventListener('resize', syncSidebarStateOnResize);

  // Inicializa estado consistente no desktop.
  syncSidebarStateOnResize();
})();
