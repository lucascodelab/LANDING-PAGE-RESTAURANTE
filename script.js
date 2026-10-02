/* ==========================================================================
   Landing Page para Restaurante
   script.js — JavaScript puro, sem dependências
   --------------------------------------------------------------------------
   Sumário
   01. Utilitários
   02. Avisos (toast)
   03. Fallback de imagens
   04. Cabeçalho: estado de rolagem, progresso e link ativo
   05. Navegação mobile
   06. Animações de entrada e contadores
   07. Filtros do cardápio
   08. Carrinho: estado, renderização e persistência
   09. Drawer do carrinho: abertura, foco e etapas
   10. Validação e finalização do pedido (demonstração)
   11. Formulário do rodapé e links demonstrativos
   12. Inicialização
   ========================================================================== */

(function () {
  'use strict';

  /* ======================================================================
     01. UTILITÁRIOS
     ====================================================================== */

  var qs = function (selector, scope) {
    return (scope || document).querySelector(selector);
  };

  var qsa = function (selector, scope) {
    return Array.prototype.slice.call((scope || document).querySelectorAll(selector));
  };

  var brl = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });

  var money = function (value) {
    return brl.format(value);
  };

  var clamp = function (value, min, max) {
    return Math.min(Math.max(value, min), max);
  };

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  var prefersReduced = function () {
    return reduceMotion.matches;
  };

  var escapeHtml = function (value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  var slugify = function (value) {
    return String(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  var raf = function (callback) {
    return window.requestAnimationFrame(callback);
  };

  /* Imagem usada quando uma foto remota falha ao carregar. Evita
     "imagem quebrada" e mantém a identidade visual da página. */
  var PLACEHOLDER_IMAGE = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 480" role="presentation">' +
    '<rect width="640" height="480" fill="#16181a"/>' +
    '<rect x="24" y="24" width="592" height="432" fill="none" stroke="#24262a" stroke-width="2"/>' +
    '<g fill="none" stroke="#ff5a1f" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" ' +
    'transform="translate(280 200) scale(2.4)">' +
    '<path d="M8.5 4v6M12 4v6M15.5 4v6M12 10v18"/>' +
    '<path d="M23 4c-2.2 1.9-3.2 4.5-3.2 7.5 0 2 1.2 3.1 3.2 3.1V28"/>' +
    '</g>' +
    '</svg>'
  );

  /* ======================================================================
     02. AVISOS (TOAST)
     ====================================================================== */

  var toastRegion = qs('#toast-region');

  var TOAST_ICONS = {
    success: '<path d="M4.5 12.5 9.5 17.5 19.5 6.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
    info: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 11v5.5M12 7.6v.1" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    error: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 7v6M12 16.2v.1" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'
  };

  function showToast(message, variant) {
    if (!toastRegion) return;

    var type = variant || 'info';

    while (toastRegion.children.length >= 3) {
      toastRegion.removeChild(toastRegion.firstElementChild);
    }

    var toast = document.createElement('div');
    toast.className = 'toast toast--' + type;
    toast.innerHTML =
      '<span class="toast__icon" aria-hidden="true"><svg viewBox="0 0 24 24">' +
      (TOAST_ICONS[type] || TOAST_ICONS.info) +
      '</svg></span><span>' + escapeHtml(message) + '</span>';

    toastRegion.appendChild(toast);

    var remove = function () {
      if (!toast.isConnected) return;
      toast.classList.add('is-leaving');
      window.setTimeout(function () {
        if (toast.isConnected) toast.remove();
      }, 300);
    };

    var timer = window.setTimeout(remove, type === 'error' ? 5200 : 3400);
    toast.addEventListener('click', function () {
      window.clearTimeout(timer);
      remove();
    });
  }

  /* ======================================================================
     03. FALLBACK DE IMAGENS
     ====================================================================== */

  function guardImage(img) {
    var usePlaceholder = function () {
      if (img.dataset.fallbackApplied === 'true') return;
      img.dataset.fallbackApplied = 'true';
      img.removeAttribute('srcset');
      img.src = PLACEHOLDER_IMAGE;
      img.classList.add('is-fallback');
    };

    img.addEventListener('error', usePlaceholder);

    if (img.complete && img.naturalWidth === 0) {
      usePlaceholder();
    }
  }

  qsa('img').forEach(guardImage);

  /* ======================================================================
     04. CABEÇALHO: ESTADO DE ROLAGEM, PROGRESSO E LINK ATIVO
     ====================================================================== */

  var siteHeader = qs('#site-header');
  var scrollProgress = qs('#scroll-progress');
  var navLinks = qsa('[data-nav-link]');
  var spyTargets = navLinks
    .map(function (link) {
      var id = (link.getAttribute('href') || '').replace('#', '');
      var section = id ? qs('#' + CSS.escape(id)) : null;
      return section ? { link: link, section: section } : null;
    })
    .filter(Boolean);

  var lastProgress = -1;
  var ticking = false;

  function onScrollFrame() {
    ticking = false;

    var scrollTop = window.scrollY || document.documentElement.scrollTop;
    var docHeight = document.documentElement.scrollHeight - window.innerHeight;

    if (siteHeader) {
      siteHeader.classList.toggle('is-scrolled', scrollTop > 12);
    }

    if (scrollProgress) {
      var progress = docHeight > 0 ? clamp((scrollTop / docHeight) * 100, 0, 100) : 0;
      if (Math.abs(progress - lastProgress) > 0.4) {
        scrollProgress.style.width = progress.toFixed(2) + '%';
        lastProgress = progress;
      }
    }

    var marker = scrollTop + (siteHeader ? siteHeader.offsetHeight : 76) + 90;
    var currentId = '';

    spyTargets.forEach(function (entry) {
      if (entry.section.offsetTop <= marker) {
        currentId = '#' + entry.section.id;
      }
    });

    navLinks.forEach(function (link) {
      var isActive = currentId !== '' && link.getAttribute('href') === currentId;
      link.classList.toggle('is-active', isActive);
      if (isActive) {
        link.setAttribute('aria-current', 'true');
      } else {
        link.removeAttribute('aria-current');
      }
    });
  }

  function requestScrollFrame() {
    if (ticking) return;
    ticking = true;
    raf(onScrollFrame);
  }

  window.addEventListener('scroll', requestScrollFrame, { passive: true });
  window.addEventListener('resize', requestScrollFrame);
  onScrollFrame();

  /* ======================================================================
     05. NAVEGAÇÃO MOBILE
     ====================================================================== */

  var navToggle = qs('#nav-toggle');
  var siteNav = qs('#primary-nav');
  var navScrim = qs('#nav-scrim');
  var MOBILE_BREAKPOINT = 860;

  function isMobileNav() {
    return window.innerWidth <= MOBILE_BREAKPOINT;
  }

  function openMobileNav() {
    if (!siteNav || !navToggle) return;

    navToggle.setAttribute('aria-expanded', 'true');
    qs('.visually-hidden', navToggle).textContent = 'Fechar menu de navegação';
    siteNav.classList.add('is-open');

    if (navScrim) {
      navScrim.hidden = false;
      raf(function () {
        navScrim.classList.add('is-visible');
      });
    }

    document.body.classList.add('no-scroll');
  }

  function closeMobileNav(options) {
    var settings = options || {};
    if (!siteNav || !navToggle) return;

    navToggle.setAttribute('aria-expanded', 'false');
    qs('.visually-hidden', navToggle).textContent = 'Abrir menu de navegação';
    siteNav.classList.remove('is-open');

    if (navScrim) {
      navScrim.classList.remove('is-visible');
      window.setTimeout(function () {
        if (!siteNav.classList.contains('is-open')) navScrim.hidden = true;
      }, 320);
    }

    if (!settings.keepLock && !(drawer && drawer.classList.contains('is-open'))) {
      document.body.classList.remove('no-scroll');
    }

    if (settings.restoreFocus) {
      navToggle.focus();
    }
  }

  if (navToggle && siteNav) {
    navToggle.addEventListener('click', function () {
      var isOpen = navToggle.getAttribute('aria-expanded') === 'true';
      if (isOpen) {
        closeMobileNav();
      } else {
        openMobileNav();
      }
    });

    navScrim.addEventListener('click', function () {
      closeMobileNav({ restoreFocus: true });
    });

    qsa('[data-nav-link]', siteNav).forEach(function (link) {
      link.addEventListener('click', function () {
        closeMobileNav();
      });
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && navToggle.getAttribute('aria-expanded') === 'true') {
        closeMobileNav({ restoreFocus: true });
      }
    });

    window.addEventListener('resize', function () {
      if (!isMobileNav() && navToggle.getAttribute('aria-expanded') === 'true') {
        closeMobileNav();
      }
    });
  }

  var navOpenCart = qs('#nav-open-cart');
  if (navOpenCart) {
    navOpenCart.addEventListener('click', function () {
      closeMobileNav();
      openDrawer();
    });
  }

  /* ======================================================================
     06. ANIMAÇÕES DE ENTRADA E CONTADORES
     ====================================================================== */

  if (window.__revealFailsafe) {
    window.clearTimeout(window.__revealFailsafe);
  }

  var revealItems = qsa('.reveal');

  function revealAll() {
    revealItems.forEach(function (item) {
      item.classList.add('is-visible');
    });
  }

  if (prefersReduced() || !('IntersectionObserver' in window)) {
    revealAll();
  } else {
    var revealObserver = new IntersectionObserver(function (entries, observer) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

    revealItems.forEach(function (item) {
      revealObserver.observe(item);
    });

    window.setTimeout(revealAll, 4200);
  }

  function animateCounter(element) {
    var target = parseFloat(element.dataset.countTo || '0');
    var suffix = element.dataset.suffix || '';

    if (prefersReduced() || target <= 0) {
      element.textContent = target + suffix;
      return;
    }

    var duration = 1200;
    var startTime = null;

    var step = function (timestamp) {
      if (startTime === null) startTime = timestamp;
      var progress = clamp((timestamp - startTime) / duration, 0, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      element.textContent = Math.round(target * eased) + suffix;

      if (progress < 1) {
        raf(step);
      }
    };

    raf(step);
  }

  var counters = qsa('[data-count-to]');

  if (counters.length) {
    if (prefersReduced() || !('IntersectionObserver' in window)) {
      counters.forEach(animateCounter);
    } else {
      var counterObserver = new IntersectionObserver(function (entries, observer) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          animateCounter(entry.target);
          observer.unobserve(entry.target);
        });
      }, { threshold: 0.5 });

      counters.forEach(function (counter) {
        counterObserver.observe(counter);
      });
    }
  }

  /* ======================================================================
     07. FILTROS DO CARDÁPIO
     ====================================================================== */

  var menuGrid = qs('#menu-grid');
  var filterButtons = qsa('#menu-filters .filter');
  var filterStatus = qs('#filter-status');
  var menuEmpty = qs('#menu-empty');
  var menuItems = menuGrid ? qsa('.menu__item', menuGrid) : [];
  var totalItems = menuItems.length;

  function applyFilter(value) {
    var visible = 0;

    filterButtons.forEach(function (button) {
      var isActive = button.dataset.filter === value;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });

    menuItems.forEach(function (item) {
      var matches = value === 'all' || item.dataset.category === value;
      item.hidden = !matches;

      if (matches) {
        visible += 1;
        item.classList.add('is-visible');
        if (!prefersReduced()) {
          item.classList.remove('is-filtered-in');
          void item.offsetWidth;
          item.classList.add('is-filtered-in');
        }
      }
    });

    if (filterStatus) {
      filterStatus.textContent =
        'Exibindo ' + visible + ' de ' + totalItems + (totalItems === 1 ? ' item' : ' itens');
    }

    if (menuEmpty) {
      menuEmpty.hidden = visible !== 0;
    }
  }

  filterButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      applyFilter(button.dataset.filter || 'all');
    });
  });

  /* ======================================================================
     08. CARRINHO: ESTADO, RENDERIZAÇÃO E PERSISTÊNCIA
     ====================================================================== */

  var DELIVERY_FEE = 9.9;
  var FREE_DELIVERY_FROM = 80;
  var STORAGE_KEY = 'lp-restaurante:carrinho:v1';
  var MAX_QTY = 99;

  var cart = {
    items: [],
    deliveryType: 'entrega'
  };

  function loadCart() {
    try {
      var stored = window.localStorage.getItem(STORAGE_KEY);
      if (!stored) return;
      var parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) return;

      cart.items = parsed
        .filter(function (entry) {
          return entry && typeof entry.name === 'string' && isFinite(entry.price) && entry.price > 0;
        })
        .map(function (entry) {
          return {
            id: String(entry.id || slugify(entry.name)),
            name: String(entry.name),
            price: Number(entry.price),
            image: typeof entry.image === 'string' ? entry.image : '',
            qty: clamp(Math.round(Number(entry.qty) || 1), 1, MAX_QTY)
          };
        });
    } catch (error) {
      cart.items = [];
    }
  }

  function saveCart() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cart.items));
    } catch (error) {
      /* Modo privativo ou storage indisponível: o carrinho segue em memória. */
    }
  }

  function cartCount() {
    return cart.items.reduce(function (total, item) {
      return total + item.qty;
    }, 0);
  }

  function subtotal() {
    return cart.items.reduce(function (total, item) {
      return total + item.price * item.qty;
    }, 0);
  }

  function deliveryFee() {
    if (cart.items.length === 0) return 0;
    if (cart.deliveryType === 'retirada') return 0;
    return subtotal() >= FREE_DELIVERY_FROM ? 0 : DELIVERY_FEE;
  }

  function findItem(id) {
    return cart.items.find(function (item) {
      return item.id === id;
    });
  }

  function addItem(name, price, image) {
    var id = slugify(name);
    var existing = findItem(id);

    if (existing) {
      if (existing.qty >= MAX_QTY) {
        showToast('Quantidade máxima atingida para ' + name + '.', 'error');
        return false;
      }
      existing.qty += 1;
    } else {
      cart.items.push({
        id: id,
        name: name,
        price: price,
        image: image || '',
        qty: 1
      });
    }

    saveCart();
    renderCart();
    showToast(name + ' adicionado ao pedido.', 'success');
    return true;
  }

  function changeQty(id, delta) {
    var item = findItem(id);
    if (!item) return;

    item.qty += delta;

    if (item.qty <= 0) {
      removeItem(id);
      return;
    }

    if (item.qty > MAX_QTY) {
      item.qty = MAX_QTY;
      showToast('Quantidade máxima de ' + MAX_QTY + ' por item.', 'error');
    }

    saveCart();
    renderCart();
  }

  function removeItem(id) {
    var item = findItem(id);
    cart.items = cart.items.filter(function (entry) {
      return entry.id !== id;
    });

    saveCart();
    renderCart();

    if (item) {
      showToast(item.name + ' removido do pedido.', 'info');
    }
  }

  function clearCart() {
    if (cart.items.length === 0) return;
    cart.items = [];
    saveCart();
    renderCart();
    showToast('Pedido limpo. Pode começar de novo.', 'info');
  }

  /* --- Elementos do drawer --- */

  var drawer = qs('#cart-drawer');
  var overlay = qs('#cart-overlay');
  var cartList = qs('#cart-list');
  var cartEmptyState = qs('#cart-empty');
  var cartSubtotalEl = qs('#cart-subtotal');
  var cartDeliveryEl = qs('#cart-delivery');
  var cartDeliveryRow = qs('#cart-delivery-row');
  var cartTotalEl = qs('#cart-total');
  var freightNote = qs('#cart-freight-note');
  var cartSummary = qs('#cart-summary');
  var cartCheckoutBtn = qs('#cart-checkout');
  var cartClearBtn = qs('#cart-clear');
  var cartCountSr = qs('#cart-count-sr');
  var cartOpenBtn = qs('#cart-open');
  var countBadges = qsa('[data-count]');

  var ICON_MINUS = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 12h14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
  var ICON_PLUS = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';

  function buildCartItemHtml(item) {
    return (
      '<li class="cart-item" data-id="' + escapeHtml(item.id) + '">' +
        (item.image
          ? '<img class="cart-item__thumb" src="' + escapeHtml(item.image) + '" alt="" width="56" height="56" loading="lazy" decoding="async">'
          : '') +
        '<div class="cart-item__info">' +
          '<p class="cart-item__name">' + escapeHtml(item.name) + '</p>' +
          '<p class="cart-item__unit">' + money(item.price) + ' cada</p>' +
        '</div>' +
        '<div class="cart-item__side">' +
          '<div class="qty" role="group" aria-label="Quantidade de ' + escapeHtml(item.name) + '">' +
            '<button class="qty__btn" type="button" data-qty="dec" aria-label="Diminuir quantidade de ' + escapeHtml(item.name) + '">' + ICON_MINUS + '</button>' +
            '<span class="qty__value">' + item.qty + '</span>' +
            '<button class="qty__btn" type="button" data-qty="inc"' + (item.qty >= MAX_QTY ? ' disabled' : '') +
              ' aria-label="Aumentar quantidade de ' + escapeHtml(item.name) + '">' + ICON_PLUS + '</button>' +
          '</div>' +
          '<div class="cart-item__meta">' +
            '<p class="cart-item__total">' + money(item.price * item.qty) + '</p>' +
            '<button class="cart-item__remove" type="button" data-remove>Remover</button>' +
          '</div>' +
        '</div>' +
      '</li>'
    );
  }

  function renderCart() {
    var count = cartCount();
    var sub = subtotal();
    var fee = deliveryFee();
    var isEmpty = cart.items.length === 0;

    if (cartList) {
      cartList.innerHTML = cart.items.map(buildCartItemHtml).join('');
      qsa('img', cartList).forEach(guardImage);
    }

    if (cartEmptyState) cartEmptyState.hidden = !isEmpty;
    if (cartList) cartList.hidden = isEmpty;

    countBadges.forEach(function (badge) {
      var previous = badge.dataset.count;
      badge.textContent = String(count);
      badge.dataset.count = String(count);

      if (previous !== String(count) && count > 0 && cartOpenBtn) {
        badge.classList.remove('is-bumping');
        void badge.offsetWidth;
        badge.classList.add('is-bumping');
      }
    });

    if (cartOpenBtn) {
      cartOpenBtn.classList.toggle('has-items', count > 0);
    }

    if (cartCountSr) {
      cartCountSr.textContent =
        count === 0
          ? 'Nenhum item no pedido'
          : count + (count === 1 ? ' item no pedido' : ' itens no pedido');
    }

    if (cartSubtotalEl) cartSubtotalEl.textContent = money(sub);
    if (cartTotalEl) cartTotalEl.textContent = money(sub + fee);

    if (cartDeliveryEl) {
      cartDeliveryEl.textContent = isEmpty ? money(0) : fee === 0 ? 'Grátis' : money(fee);
    }
    if (cartDeliveryRow) cartDeliveryRow.classList.toggle('is-free', !isEmpty && fee === 0);

    if (freightNote) {
      if (cart.deliveryType === 'retirada') {
        freightNote.textContent = 'Retirada no balcão: sem taxa de entrega.';
      } else if (sub === 0) {
        freightNote.textContent = 'Frete grátis em pedidos acima de ' + money(FREE_DELIVERY_FROM) + '.';
      } else if (fee === 0) {
        freightNote.textContent = 'Frete grátis aplicado a este pedido.';
      } else {
        var missing = FREE_DELIVERY_FROM - sub;
        freightNote.textContent =
          'Faltam ' + money(missing) + ' para o frete grátis.';
      }
    }

    if (cartCheckoutBtn) {
      cartCheckoutBtn.disabled = isEmpty;
    }

    if (cartClearBtn) {
      cartClearBtn.disabled = isEmpty;
    }
  }

  /* --- Botões "adicionar" dos cards --- */

  var ADDED_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4.5 12.5 9.5 17.5 19.5 6.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function feedbackAdded(button) {
    if (button.dataset.resetTimer) {
      window.clearTimeout(Number(button.dataset.resetTimer));
    }

    button.classList.add('is-added');
    button.innerHTML = ADDED_ICON + 'Adicionado';

    button.dataset.resetTimer = String(
      window.setTimeout(function () {
        button.classList.remove('is-added');
        button.innerHTML =
          '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>Adicionar';
        delete button.dataset.resetTimer;
      }, 1500)
    );
  }

  qsa('[data-add]').forEach(function (button) {
    button.addEventListener('click', function () {
      var name = button.dataset.name || 'Item';
      var price = parseFloat(button.dataset.price);

      if (!isFinite(price) || price <= 0) {
        showToast('Não foi possível adicionar este item.', 'error');
        return;
      }

      var image = '';
      var thumb = qs('.card__media img', button.closest('.card') || document);
      if (thumb) image = thumb.currentSrc || thumb.src || '';

      if (addItem(name, price, image)) {
        feedbackAdded(button);
      }
    });
  });

  /* --- Interações dentro da lista do carrinho --- */

  if (cartList) {
    cartList.addEventListener('click', function (event) {
      var button = event.target.closest('button');
      if (!button) return;

      var row = button.closest('.cart-item');
      if (!row) return;

      var id = row.dataset.id;

      if (button.dataset.remove !== undefined) {
        removeItem(id);
        return;
      }

      if (button.dataset.qty === 'inc') {
        changeQty(id, 1);
        return;
      }

      if (button.dataset.qty === 'dec') {
        changeQty(id, -1);
      }
    });
  }

  if (cartClearBtn) {
    cartClearBtn.addEventListener('click', clearCart);
  }

  /* ======================================================================
     09. DRAWER DO CARRINHO: ABERTURA, FOCO E ETAPAS
     ====================================================================== */

  var FOCUSABLE =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  var lastFocused = null;
  var currentStep = 'cart';
  var drawerPanels = qsa('.drawer__panel', drawer || document);
  var stepIndicators = qsa('[data-step-indicator]');

  function setStep(step) {
    currentStep = step;

    drawerPanels.forEach(function (panel) {
      var isTarget = panel.dataset.panel === step;
      panel.classList.toggle('is-active', isTarget);
      panel.hidden = !isTarget;
    });

    stepIndicators.forEach(function (indicator) {
      var name = indicator.dataset.stepIndicator;
      indicator.classList.toggle('is-active', name === step);
      indicator.classList.toggle('is-done', name !== step && step === 'done');
    });

    if (cartSummary) {
      cartSummary.hidden = step !== 'cart';
    }

    var body = qs('#drawer-body');
    if (body) body.scrollTop = 0;
  }

  function openDrawer() {
    if (!drawer || !overlay) return;

    lastFocused = document.activeElement;

    drawer.hidden = false;
    overlay.hidden = false;
    document.body.classList.add('no-scroll', 'is-drawer-open');

    /* Força o layout para que o estado inicial (fechado) seja pintado
       antes da classe de abertura, garantindo a transição. */
    void drawer.offsetHeight;

    raf(function () {
      drawer.classList.add('is-open');
      overlay.classList.add('is-visible');
    });

    var closeButton = qs('#cart-close');
    if (closeButton) {
      window.setTimeout(function () {
        if (drawer.classList.contains('is-open')) closeButton.focus();
      }, 80);
    }
  }

  function closeDrawer(options) {
    var settings = options || {};
    if (!drawer || !overlay) return;

    drawer.classList.remove('is-open');
    overlay.classList.remove('is-visible');

    var finish = function () {
      drawer.hidden = true;
      overlay.hidden = true;

      if (!siteNav || !siteNav.classList.contains('is-open')) {
        document.body.classList.remove('no-scroll');
      }
      document.body.classList.remove('is-drawer-open');

      if (settings.restoreFocus !== false && lastFocused && lastFocused.focus) {
        lastFocused.focus();
      }
    };

    if (prefersReduced()) {
      finish();
    } else {
      window.setTimeout(finish, 620);
    }
  }

  function trapFocus(event) {
    if (event.key !== 'Tab' || !drawer.classList.contains('is-open')) return;

    var focusable = qsa(FOCUSABLE, drawer).filter(function (element) {
      return element.offsetParent !== null || element === document.activeElement;
    });

    if (focusable.length === 0) return;

    var first = focusable[0];
    var last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  if (drawer && overlay) {
    if (cartOpenBtn) {
      cartOpenBtn.addEventListener('click', function () {
        setStep('cart');
        openDrawer();
      });
    }

    var cartClose = qs('#cart-close');
    if (cartClose) {
      cartClose.addEventListener('click', function () {
        closeDrawer();
      });
    }

    overlay.addEventListener('click', function () {
      closeDrawer();
    });

    document.addEventListener('keydown', function (event) {
      if (!drawer.classList.contains('is-open')) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        closeDrawer();
        return;
      }

      trapFocus(event);
    });

    var emptyCta = qs('#cart-empty-cta');
    if (emptyCta) {
      emptyCta.addEventListener('click', function () {
        closeDrawer({ restoreFocus: false });
        var menuSection = qs('#cardapio');
        if (menuSection) {
          window.setTimeout(function () {
            menuSection.scrollIntoView({
              behavior: prefersReduced() ? 'auto' : 'smooth',
              block: 'start'
            });
          }, 260);
        }
      });
    }

    qsa('[data-back-to]').forEach(function (button) {
      button.addEventListener('click', function () {
        setStep(button.dataset.backTo);
        var target = qs('.drawer__panel.is-active button, .drawer__panel.is-active input');
        if (target) target.focus();
      });
    });

    if (cartCheckoutBtn) {
      cartCheckoutBtn.addEventListener('click', function () {
        if (cart.items.length === 0) {
          showToast('Adicione pelo menos um item ao pedido.', 'error');
          return;
        }
        setStep('checkout');
        var firstField = qs('#co-name');
        if (firstField) firstField.focus();
      });
    }

    var successClose = qs('#success-close');
    if (successClose) {
      successClose.addEventListener('click', function () {
        closeDrawer({ restoreFocus: false });
        var menuSection = qs('#cardapio');
        if (menuSection) {
          window.setTimeout(function () {
            menuSection.scrollIntoView({
              behavior: prefersReduced() ? 'auto' : 'smooth',
              block: 'start'
            });
          }, 260);
        }
      });
    }

    var deliveryRadios = qsa('input[name="delivery"]', drawer);
    deliveryRadios.forEach(function (radio) {
      radio.addEventListener('change', function () {
        if (!radio.checked) return;
        cart.deliveryType = radio.value;
        renderCart();
      });
    });
  }

  /* ======================================================================
     10. VALIDAÇÃO E FINALIZAÇÃO DO PEDIDO (DEMONSTRAÇÃO)
     ====================================================================== */

  var checkoutForm = qs('#checkout-form');
  var successData = qs('#success-data');
  var successText = qs('#success-text');

  var EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

  var VALIDATORS = {
    'co-name': function (value) {
      if (!value) return 'Informe seu nome completo.';
      if (value.length < 3) return 'O nome precisa ter pelo menos 3 caracteres.';
      if (!/\s/.test(value)) return 'Digite seu nome e sobrenome.';
      return '';
    },
    'co-email': function (value) {
      if (!value) return 'Informe um e-mail para contato.';
      if (!EMAIL_PATTERN.test(value)) return 'E-mail inválido. Use o formato nome@dominio.com.';
      return '';
    },
    'co-phone': function (value) {
      var digits = value.replace(/\D/g, '');
      if (!value) return 'Informe um telefone para confirmar o pedido.';
      if (digits.length < 10) return 'Telefone incompleto. Use DDD + número.';
      if (digits.length > 13) return 'Telefone longo demais.';
      return '';
    },
    'co-address': function (value) {
      if (!value) return 'Informe o endereço de entrega.';
      if (value.length < 8) return 'Adicione rua, número e bairro.';
      if (!/\d/.test(value)) return 'Inclua o número do endereço.';
      return '';
    }
  };

  function showFieldError(input, message) {
    var errorId = input.getAttribute('aria-describedby');
    var errorEl = errorId ? qs('#' + CSS.escape(errorId)) : null;

    if (message) {
      input.setAttribute('aria-invalid', 'true');
      if (errorEl) {
        errorEl.textContent = message;
        errorEl.hidden = false;
      }
    } else {
      input.removeAttribute('aria-invalid');
      if (errorEl) {
        errorEl.textContent = '';
        errorEl.hidden = true;
      }
    }
  }

  function validateField(input) {
    var validator = VALIDATORS[input.id];
    if (!validator) return true;

    var message = validator(input.value.trim());
    showFieldError(input, message);
    return message === '';
  }

  if (checkoutForm) {
    qsa('input[type="text"], input[type="email"], input[type="tel"]', checkoutForm).forEach(function (input) {
      input.addEventListener('blur', function () {
        if (input.value.trim() !== '') validateField(input);
      });

      input.addEventListener('input', function () {
        if (input.getAttribute('aria-invalid') === 'true') validateField(input);
      });
    });

    checkoutForm.addEventListener('submit', function (event) {
      event.preventDefault();

      var fields = qsa('input[type="text"], input[type="email"], input[type="tel"]', checkoutForm);
      var firstInvalid = null;
      var errorCount = 0;

      fields.forEach(function (input) {
        if (!validateField(input)) {
          errorCount += 1;
          if (!firstInvalid) firstInvalid = input;
        }
      });

      if (firstInvalid) {
        firstInvalid.focus();
        showToast(
          errorCount === 1
            ? 'Revise o campo destacado antes de continuar.'
            : 'Revise os ' + errorCount + ' campos destacados.',
          'error'
        );
        return;
      }

      var data = new FormData(checkoutForm);
      var name = String(data.get('name') || '').trim();
      var email = String(data.get('email') || '').trim();
      var phone = String(data.get('phone') || '').trim();
      var address = String(data.get('address') || '').trim();
      var notes = String(data.get('notes') || '').trim();
      var deliveryType = cart.deliveryType === 'retirada' ? 'Retirada no balcão' : 'Entrega';
      var sub = subtotal();
      var fee = deliveryFee();
      var code = 'MDN-' + String(Math.floor(100000 + Math.random() * 899999));

      if (successText) {
        successText.textContent =
          'Obrigado, ' + name.split(' ')[0] + '! Este é um pedido fictício gerado apenas ' +
          'para demonstrar a interface. Nenhuma cobrança foi feita e nada foi enviado para um servidor.';
      }

      if (successData) {
        successData.innerHTML = [
          ['Código do pedido', code],
          ['Itens', cartCount() + (cartCount() === 1 ? ' item' : ' itens')],
          ['Recebimento', deliveryType],
          ['E-mail', email],
          ['Telefone', phone],
          ['Endereço', address],
          notes ? ['Observações', notes] : null,
          ['Subtotal', money(sub)],
          ['Entrega', fee === 0 ? 'Grátis' : money(fee)],
          ['Total do pedido', money(sub + fee)]
        ]
          .filter(Boolean)
          .map(function (row) {
            return (
              '<div><dt>' + escapeHtml(row[0]) + '</dt><dd>' + escapeHtml(row[1]) + '</dd></div>'
            );
          })
          .join('');
      }

      checkoutForm.reset();
      cart.deliveryType = 'entrega';
      cart.items = [];
      saveCart();
      renderCart();

      setStep('done');
      showToast('Pedido demonstrativo registrado com sucesso.', 'success');

      var successButton = qs('#success-close');
      if (successButton) successButton.focus();
    });
  }

  /* ======================================================================
     11. FORMULÁRIO DO RODAPÉ E LINKS DEMONSTRATIVOS
     ====================================================================== */

  var signupForm = qs('#footer-signup');
  var signupEmail = qs('#signup-email');
  var signupError = qs('#signup-error');

  if (signupForm && signupEmail) {
    var validateSignup = function () {
      var value = signupEmail.value.trim();

      if (!value) return 'Digite um e-mail para receber o cardápio.';
      if (!EMAIL_PATTERN.test(value)) return 'E-mail inválido. Use o formato nome@dominio.com.';
      return '';
    };

    var paintSignup = function (message) {
      if (message) {
        signupEmail.setAttribute('aria-invalid', 'true');
        if (signupError) {
          signupError.textContent = message;
          signupError.hidden = false;
        }
      } else {
        signupEmail.removeAttribute('aria-invalid');
        if (signupError) {
          signupError.textContent = '';
          signupError.hidden = true;
        }
      }
    };

    signupEmail.addEventListener('input', function () {
      if (signupEmail.getAttribute('aria-invalid') === 'true') {
        paintSignup(validateSignup());
      }
    });

    signupForm.addEventListener('submit', function (event) {
      event.preventDefault();

      var message = validateSignup();
      paintSignup(message);

      if (message) {
        signupEmail.focus();
        return;
      }

      showToast('Demonstração: o endereço ' + signupEmail.value.trim() + ' seria cadastrado.', 'success');
      signupForm.reset();
    });
  }

  /* Ano corrente no rodapé */
  var yearEl = qs('#current-year');
  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
  }

  /* ======================================================================
     12. INICIALIZAÇÃO
     ====================================================================== */

  loadCart();
  renderCart();
  setStep('cart');
})();
