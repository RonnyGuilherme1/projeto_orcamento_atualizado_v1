(function () {
  const body = document.body;
  const toggleBtns = document.querySelectorAll('[data-sidebar-toggle]');
  const overlay = document.querySelector('[data-sidebar-overlay]');
  const closeTargets = document.querySelectorAll('[data-sidebar-close]');
  const userMenuToggle = document.querySelector('[data-user-menu-toggle]');
  const userMenu = document.querySelector('[data-user-menu]');
  const searchInput = document.querySelector('[data-menu-search]');
  const notificationToggle = document.querySelector('[data-notifications-toggle]');
  const notificationPanel = document.querySelector('[data-notifications-panel]');
  const notificationsBadge = document.querySelector('[data-notifications-badge]');
  const notificationsList = document.querySelector('[data-notifications-list]');
  const notificationsEmpty = document.querySelector('[data-notifications-empty]');
  const notificationsLoading = document.querySelector('[data-notifications-loading]');
  const notificationsClear = document.querySelector('[data-notifications-clear]');
  const themeToggle = document.querySelector('[data-theme-toggle]');

  const DESKTOP_MIN = 1025;
  const SIDEBAR_STATE_KEY = 'sidebar_state';
  const THEME_KEY = 'app_theme';
  const NOTIFICATIONS_TTL = 30000;

  let notificationsState = null;
  let notificationsLoadingState = false;
  let notificationsLastFetch = 0;
  const notificationsEmptyDefault = notificationsEmpty ? notificationsEmpty.textContent : '';

  function isDesktop() {
    return window.innerWidth >= DESKTOP_MIN;
  }

  function openSidebar() {
    body.classList.add('sidebar-open');
    // No desktop, "open" = expandido. Remove o estado compacto.
    if (isDesktop()) body.classList.remove('sidebar-collapsed');
    if (isDesktop()) {
      localStorage.setItem(SIDEBAR_STATE_KEY, 'open');
    }
  }

  function closeSidebar() {
    body.classList.remove('sidebar-open');
    // No desktop, "closed" = compacto fixo.
    if (isDesktop()) body.classList.add('sidebar-collapsed');
    if (isDesktop()) {
      localStorage.setItem(SIDEBAR_STATE_KEY, 'collapsed');
    }
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
    if (!isDesktop()) {
      body.classList.remove('sidebar-open');
      body.classList.remove('sidebar-collapsed');
      return;
    }

    // Desktop: garante estado salvo ou aberto por padrão.
    if (body.classList.contains('sidebar-open')) {
      body.classList.remove('sidebar-collapsed');
      return;
    }
    if (body.classList.contains('sidebar-collapsed')) {
      return;
    }
    const saved = localStorage.getItem(SIDEBAR_STATE_KEY);
    if (saved === 'collapsed') {
      closeSidebar();
    } else {
      openSidebar();
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
    overlay.addEventListener('click', () => {
      if (!isDesktop()) closeSidebar();
    });
  }

  if (closeTargets.length) {
    closeTargets.forEach((el) => {
      el.addEventListener('click', () => {
        if (!isDesktop()) closeSidebar();
      });
      el.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          if (!isDesktop()) closeSidebar();
        }
      });
    });
  }

  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (!isDesktop()) closeSidebar();
      closeUserMenu();
      closeNotifications();
    }
  });

  window.addEventListener('resize', syncSidebarStateOnResize);

  function closeUserMenu() {
    if (userMenu) userMenu.classList.remove('is-open');
  }

  function closeNotifications() {
    if (notificationPanel) notificationPanel.classList.remove('is-open');
  }

  function escapeHtml(value) {
    const text = String(value ?? '');
    return text.replace(/[&<>"']/g, (char) => {
      switch (char) {
        case '&':
          return '&amp;';
        case '<':
          return '&lt;';
        case '>':
          return '&gt;';
        case '"':
          return '&quot;';
        case "'":
          return '&#39;';
        default:
          return char;
      }
    });
  }

  function setNotificationsBadge(count) {
    if (!notificationsBadge) return;
    const safeCount = Number.isFinite(count) ? Math.max(0, count) : 0;
    if (safeCount > 0) {
      notificationsBadge.textContent = safeCount > 99 ? '99+' : String(safeCount);
      notificationsBadge.style.display = 'inline-flex';
    } else {
      notificationsBadge.textContent = '';
      notificationsBadge.style.display = 'none';
    }
  }

  function setNotificationsLoading(isLoading) {
    if (notificationsLoading) {
      notificationsLoading.style.display = isLoading ? 'block' : 'none';
    }
    if (notificationsList) {
      notificationsList.style.display = isLoading ? 'none' : notificationsList.style.display;
    }
    if (notificationsEmpty) {
      notificationsEmpty.style.display = isLoading ? 'none' : notificationsEmpty.style.display;
    }
  }

  function renderNotifications(data) {
    notificationsState = data || { items: [], unread_count: 0 };
    const items = Array.isArray(notificationsState.items) ? notificationsState.items : [];
    const unreadCount = Number.isFinite(notificationsState.unread_count)
      ? notificationsState.unread_count
      : items.filter((item) => !item.read_at).length;

    if (notificationsEmpty) {
      notificationsEmpty.textContent = notificationsEmptyDefault || 'Sem notificações no momento.';
    }

    if (notificationsList) {
      if (items.length) {
        notificationsList.innerHTML = items.map((item) => {
          const href = item.href || '#';
          const title = escapeHtml(item.title || 'Notificação');
          const message = item.message ? `<span class="notification-message">${escapeHtml(item.message)}</span>` : '';
          const readClass = item.read_at ? 'is-read' : 'is-unread';
          return `
            <a class="notification-item ${readClass}" href="${escapeHtml(href)}" data-id="${escapeHtml(item.id)}">
              <strong>${title}</strong>
              ${message}
            </a>
          `;
        }).join('');
        notificationsList.style.display = 'grid';
      } else {
        notificationsList.innerHTML = '';
        notificationsList.style.display = 'none';
      }
    }

    if (notificationsEmpty) {
      notificationsEmpty.style.display = items.length ? 'none' : 'block';
    }
    if (notificationsClear) {
      notificationsClear.style.display = items.length ? 'inline-flex' : 'none';
    }

    setNotificationsBadge(unreadCount);
    setNotificationsLoading(false);
  }

  async function loadNotifications(force = false) {
    if (!notificationPanel) return;
    if (notificationsLoadingState) return;
    const now = Date.now();
    if (!force && notificationsState && (now - notificationsLastFetch) < NOTIFICATIONS_TTL) {
      renderNotifications(notificationsState);
      return;
    }

    notificationsLoadingState = true;
    setNotificationsLoading(true);
    try {
      const resp = await fetch('/app/notifications/data', {
        headers: { 'Accept': 'application/json' },
      });
      if (!resp.ok) {
        throw new Error('request_failed');
      }
      const data = await resp.json();
      notificationsLastFetch = Date.now();
      notificationsLoadingState = false;
      renderNotifications(data || {});
    } catch (err) {
      notificationsLoadingState = false;
      if (notificationsEmpty) {
        notificationsEmpty.textContent = 'Não foi possível carregar notificações.';
        notificationsEmpty.style.display = 'block';
      }
      if (notificationsList) {
        notificationsList.innerHTML = '';
        notificationsList.style.display = 'none';
      }
      if (notificationsClear) {
        notificationsClear.style.display = 'none';
      }
      setNotificationsBadge(0);
      setNotificationsLoading(false);
    }
  }

  function updateLocalNotificationRead(id) {
    if (!notificationsState || !Array.isArray(notificationsState.items)) return;
    const item = notificationsState.items.find((entry) => String(entry.id) === String(id));
    if (item && !item.read_at) {
      item.read_at = new Date().toISOString();
      if (Number.isFinite(notificationsState.unread_count)) {
        notificationsState.unread_count = Math.max(0, notificationsState.unread_count - 1);
      }
    }
  }

  async function markNotificationRead(id, itemEl) {
    if (!id) return;
    updateLocalNotificationRead(id);
    if (itemEl) {
      itemEl.classList.remove('is-unread');
      itemEl.classList.add('is-read');
    }
    if (notificationsState) {
      const unreadCount = Number.isFinite(notificationsState.unread_count)
        ? notificationsState.unread_count
        : 0;
      setNotificationsBadge(unreadCount);
    }

    try {
      await fetch('/app/notifications/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
        keepalive: true,
      });
    } catch (err) {
      // Falha silenciosa: a próxima recarga corrige o estado.
    }
  }

  async function markAllNotificationsRead() {
    if (!notificationsState || !Array.isArray(notificationsState.items)) return;
    notificationsState.items = notificationsState.items.map((item) => ({
      ...item,
      read_at: item.read_at || new Date().toISOString(),
    }));
    notificationsState.unread_count = 0;
    renderNotifications(notificationsState);

    try {
      await fetch('/app/notifications/mark-all-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err) {
      // Falha silenciosa: a próxima recarga corrige o estado.
    }
  }

  if (userMenuToggle && userMenu) {
    userMenuToggle.addEventListener('click', (event) => {
      event.stopPropagation();
      userMenu.classList.toggle('is-open');
      closeNotifications();
    });
    userMenu.addEventListener('click', (event) => {
      event.stopPropagation();
    });
  }

  if (notificationToggle && notificationPanel) {
    notificationToggle.addEventListener('click', (event) => {
      event.stopPropagation();
      const isOpen = notificationPanel.classList.toggle('is-open');
      closeUserMenu();
      if (isOpen) {
        loadNotifications();
      }
    });
    notificationPanel.addEventListener('click', (event) => {
      event.stopPropagation();
    });
  }

  if (notificationsList) {
    notificationsList.addEventListener('click', (event) => {
      const item = event.target.closest('.notification-item');
      if (!item) return;
      const id = item.dataset.id;
      if (id) {
        markNotificationRead(id, item);
      }
    });
  }

  if (notificationsClear) {
    notificationsClear.addEventListener('click', (event) => {
      event.preventDefault();
      markAllNotificationsRead();
    });
  }

  document.addEventListener('click', () => {
    closeUserMenu();
    closeNotifications();
  });

  function applyTheme(theme) {
    const safeTheme = theme === 'light' ? 'light' : 'dark';
    body.classList.toggle('theme-light', safeTheme === 'light');
    body.classList.toggle('theme-dark', safeTheme === 'dark');
    localStorage.setItem(THEME_KEY, safeTheme);
    document.dispatchEvent(new CustomEvent('theme:changed', { detail: { theme: safeTheme } }));
  }

  if (themeToggle) {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored) applyTheme(stored);

    themeToggle.addEventListener('click', (event) => {
      event.stopPropagation();
      const isLight = body.classList.contains('theme-light');
      applyTheme(isLight ? 'dark' : 'light');
    });
  }

  if (!body.classList.contains('theme-light') && !body.classList.contains('theme-dark')) {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored) {
      applyTheme(stored);
    } else {
      applyTheme('dark');
    }
  }

  if (searchInput) {
    const searchPanel = document.querySelector('[data-search-panel]');
    const nav = document.querySelector('.sidebar-nav');
    let activeIndex = -1;
    let items = [];

    if (nav) {
      let currentSection = 'Principal';
      Array.from(nav.children).forEach((el) => {
        if (el.classList.contains('nav-section')) {
          currentSection = el.textContent.trim() || currentSection;
        }
        if (el.classList.contains('nav-item')) {
          const label = (el.querySelector('.nav-text')?.textContent || el.textContent || '').trim();
          if (!label) return;
          const href = el.getAttribute('href') || '#';
          const icon = el.querySelector('.nav-icon')?.innerHTML || '';
          items.push({ section: currentSection, label, href, icon });
        }
      });
    }

    function openSearchPanel() {
      if (searchPanel) searchPanel.classList.add('is-open');
    }

    function closeSearchPanel() {
      if (searchPanel) searchPanel.classList.remove('is-open');
      activeIndex = -1;
    }

    function setActive(index) {
      const buttons = Array.from(searchPanel?.querySelectorAll('.search-item') || []);
      if (!buttons.length) return;
      const safeIndex = Math.max(0, Math.min(index, buttons.length - 1));
      buttons.forEach((btn, idx) => btn.classList.toggle('is-active', idx === safeIndex));
      activeIndex = safeIndex;
      buttons[safeIndex].scrollIntoView({ block: 'nearest' });
    }

    function renderResults(query) {
      if (!searchPanel) return;
      const q = (query || '').trim().toLowerCase();
      const filtered = q ? items.filter((item) => item.label.toLowerCase().includes(q)) : items;
      if (!filtered.length) {
        searchPanel.innerHTML = '<div class="search-empty">Nenhum resultado encontrado.</div>';
        return;
      }

      const grouped = new Map();
      filtered.forEach((item) => {
        if (!grouped.has(item.section)) grouped.set(item.section, []);
        grouped.get(item.section).push(item);
      });

      searchPanel.innerHTML = Array.from(grouped.entries()).map(([section, sectionItems]) => {
        const itemsHtml = sectionItems.map((item) => `
          <button class="search-item" type="button" data-href="${item.href}">
            <span class="search-item-icon">${item.icon || ''}</span>
            <span>${item.label}</span>
          </button>
        `).join('');
        return `
          <div class="search-group">
            <div class="search-group-title">${section}</div>
            ${itemsHtml}
          </div>
        `;
      }).join('');

      setActive(0);
    }

    searchInput.addEventListener('focus', () => {
      renderResults(searchInput.value);
      openSearchPanel();
    });

    searchInput.addEventListener('input', () => {
      renderResults(searchInput.value);
      openSearchPanel();
    });

    searchInput.addEventListener('keydown', (event) => {
      if (!searchPanel) return;
      const buttons = Array.from(searchPanel.querySelectorAll('.search-item'));
      if (!buttons.length) return;
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActive(activeIndex + 1);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActive(activeIndex - 1);
      } else if (event.key === 'Enter') {
        event.preventDefault();
        const target = buttons[activeIndex] || buttons[0];
        if (target?.dataset.href) {
          window.location.href = target.dataset.href;
        }
      } else if (event.key === 'Escape') {
        closeSearchPanel();
        searchInput.blur();
      }
    });

    searchPanel?.addEventListener('click', (event) => {
      const btn = event.target.closest('.search-item');
      if (!btn) return;
      const href = btn.dataset.href;
      if (href) {
        window.location.href = href;
      }
    });

    searchPanel?.addEventListener('mousemove', (event) => {
      const btn = event.target.closest('.search-item');
      if (!btn) return;
      const buttons = Array.from(searchPanel.querySelectorAll('.search-item'));
      const idx = buttons.indexOf(btn);
      if (idx >= 0 && idx !== activeIndex) {
        setActive(idx);
      }
    });

    document.addEventListener('click', (event) => {
      if (!searchPanel) return;
      if (searchPanel.contains(event.target)) return;
      if (searchInput.contains(event.target)) return;
      closeSearchPanel();
    });

    window.addEventListener('keydown', (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchInput.focus();
      }
    });
  }

  function highlightActiveNav() {
    const navItems = Array.from(document.querySelectorAll('.sidebar-nav .nav-item'));
    if (!navItems.length) return;
    const path = window.location.pathname.replace(/\/$/, '') || '/';
    let activeItem = null;

    navItems.forEach((item) => item.classList.remove('is-active'));

    navItems.forEach((item) => {
      const route = item.dataset.route || item.getAttribute('href');
      if (!route) return;
      const normalized = route.replace(/\/$/, '') || '/';
      if (normalized === path) {
        activeItem = item;
      }
    });

    if (activeItem) activeItem.classList.add('is-active');
  }

  // Inicializa estado consistente no desktop.
  const savedState = localStorage.getItem(SIDEBAR_STATE_KEY);
  if (savedState === 'collapsed') {
    closeSidebar();
  } else {
    openSidebar();
  }
  syncSidebarStateOnResize();
  if (notificationsBadge) {
    loadNotifications();
  }
  highlightActiveNav();
})();
