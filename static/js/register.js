(function () {
  'use strict';

  if (typeof PLANS !== 'object' || !PLANS) {
    return;
  }

  var PLAN_COPY = {
    basic: {
      label: 'Basic',
      desc: 'Essencial para organizar o dia a dia.',
      highlights: [
        'Dashboard mensal/vis?o r?pida (receitas, despesas, saldo)',
        'Lan?amento de receitas e despesas',
        'Filtros simples (per?odo/categoria/status)',
        'Categorias b?sicas'
      ]
    },
    plus: {
      label: 'Plus',
      desc: 'Mais controle com automa??o e insights.',
      highlights: [
        'Gr?ficos e insights',
        'Regras & automa??o (categoria/status/tags/m?todo)',
        'Notifica??es avan?adas',
        'Filtros avan?ados por per?odo/categoria/status/m?todo'
      ]
    },
    pro: {
      label: 'Pro',
      desc: 'Vis?o estrat?gica com proje??es e relat?rios.',
      highlights: [
        'Proje??o de saldo e simula??es',
        'Relat?rios premium (PDF/Excel) com resumo executivo',
        'Comparativos e vis?o estrat?gica'
      ]
    }
  };

  var planKeys = ['basic', 'plus', 'pro'].filter(function (key) {
    return Object.prototype.hasOwnProperty.call(PLANS, key);
  });

  if (!planKeys.length) {
    planKeys = Object.keys(PLANS);
  }

  if (!planKeys.length) {
    return;
  }

  var grid = document.getElementById('plans-grid');
  var hiddenInput = document.getElementById('selected-plan-input');
  var badge = document.getElementById('selected-plan-badge');

  if (!grid || !hiddenInput) {
    return;
  }

  function formatPrice(value) {
    var amount = Number(value);
    if (!Number.isFinite(amount)) {
      return '';
    }
    return amount.toFixed(2).replace('.', ',');
  }

  function getPlanCopy(key) {
    return PLAN_COPY[key] || {};
  }

  function getPlanLabel(key) {
    var copy = getPlanCopy(key);
    return copy.label || (PLANS[key] && PLANS[key].name) || key;
  }

  function getPlanDesc(key) {
    var copy = getPlanCopy(key);
    return copy.desc || (PLANS[key] && PLANS[key].tagline) || '';
  }

  function getPlanHighlights(key) {
    var copy = getPlanCopy(key);
    return copy.highlights || (PLANS[key] && PLANS[key].highlights) || [];
  }

  function buildPlanCard(key, isSelected) {
    var plan = PLANS[key] || {};
    var isFeatured = !!plan.popular || key === 'pro';

    var card = document.createElement('button');
    card.type = 'button';
    card.className = 'plan-card';
    card.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
    card.dataset.plan = key;

    if (isFeatured) {
      card.classList.add('is-featured');
    }
    if (isSelected) {
      card.classList.add('is-selected');
    }

    var badges = document.createElement('div');
    badges.className = 'plan-card-badges';

    if (isFeatured) {
      var featuredBadge = document.createElement('span');
      featuredBadge.className = 'plan-badge is-featured';
      featuredBadge.textContent = 'DESTAQUE';
      badges.appendChild(featuredBadge);
    }

    if (isSelected) {
      var selectedBadge = document.createElement('span');
      selectedBadge.className = 'plan-badge is-selected';
      selectedBadge.textContent = 'Selecionado';
      badges.appendChild(selectedBadge);
    }

    if (badges.childNodes.length) {
      card.appendChild(badges);
    }

    var title = document.createElement('h3');
    title.textContent = getPlanLabel(key);

    var price = document.createElement('div');
    price.className = 'plan-price';

    var currency = document.createElement('span');
    currency.className = 'currency';
    currency.textContent = 'R$';

    var value = document.createElement('span');
    value.className = 'value';
    value.textContent = formatPrice(plan.price_month);

    var period = document.createElement('span');
    period.className = 'period';
    period.textContent = '/m?s';

    price.appendChild(currency);
    price.appendChild(value);
    price.appendChild(period);

    var desc = document.createElement('p');
    desc.className = 'plan-desc';
    desc.textContent = getPlanDesc(key);

    var list = document.createElement('ul');
    list.className = 'plan-list';
    getPlanHighlights(key).forEach(function (item) {
      var li = document.createElement('li');
      li.textContent = item;
      list.appendChild(li);
    });

    card.appendChild(title);
    card.appendChild(price);
    if (desc.textContent) {
      card.appendChild(desc);
    }
    card.appendChild(list);

    card.addEventListener('click', function () {
      applyPlan(key);
    });

    card.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        applyPlan(key);
      }
    });

    return card;
  }

  var currentPlan = null;

  function renderPlans() {
    grid.innerHTML = '';
    planKeys.forEach(function (key) {
      var card = buildPlanCard(key, key === currentPlan);
      grid.appendChild(card);
    });
  }

  function applyPlan(key) {
    var next = planKeys.indexOf(key) >= 0 ? key : null;
    if (!next) {
      next = planKeys.indexOf(defaultPlan) >= 0 ? defaultPlan : planKeys[0];
    }

    currentPlan = next;
    hiddenInput.value = currentPlan;

    if (badge) {
      badge.textContent = getPlanLabel(currentPlan);
      badge.className = 'plan-badge plan-' + currentPlan;
    }

    renderPlans();
  }

  var queryPlan = '';
  try {
    queryPlan = (new URLSearchParams(window.location.search).get('plan') || '').toLowerCase();
  } catch (err) {
    queryPlan = '';
  }

  var defaultPlan = (typeof DEFAULT_PLAN === 'string' ? DEFAULT_PLAN : 'basic').toLowerCase();
  var initial = planKeys.indexOf(queryPlan) >= 0 ? queryPlan : defaultPlan;

  if (planKeys.indexOf(initial) === -1) {
    initial = planKeys[0];
  }

  applyPlan(initial);
})();
