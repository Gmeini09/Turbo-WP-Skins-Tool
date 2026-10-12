(() => {
  'use strict';

  const storage = {
    read(key) {
      try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
    },
    write(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
    },
    remove(key) {
      try { localStorage.removeItem(key); return true; } catch { return false; }
    }
  };

  const themeButton = document.getElementById('theme-toggle');
  const storedTheme = storage.read('turbo-designs:theme');
  const applyTheme = theme => {
    document.documentElement.dataset.theme = theme;
    if (!themeButton) return;
    const nextLabel = theme === 'dark' ? 'Helles Design aktivieren' : 'Dunkles Design aktivieren';
    themeButton.setAttribute('aria-label', nextLabel);
    themeButton.setAttribute('title', nextLabel);
    themeButton.setAttribute('aria-pressed', String(theme === 'light'));
    themeButton.dataset.theme = theme;
    const label = themeButton.querySelector('[data-theme-label]');
    if (label) label.textContent = theme === 'dark' ? 'Hell' : 'Dunkel';
  };
  applyTheme(storedTheme === 'light' ? 'light' : 'dark');
  themeButton?.addEventListener('click', () => {
    const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    applyTheme(theme);
    storage.write('turbo-designs:theme', theme);
  });

  const cards = [...document.querySelectorAll('.shop-card[data-product-key]')];
  const search = document.getElementById('shop-search');
  const categoryButtons = [...document.querySelectorAll('[data-shop-category]')];
  const sort = document.getElementById('shop-sort');
  const savedToggle = document.getElementById('saved-toggle');
  const savedCount = document.getElementById('saved-count');
  const resultsCount = document.getElementById('results-count');
  const empty = document.getElementById('shop-empty');
  const favoriteButtons = [...document.querySelectorAll('[data-favorite]')];
  const knownKeys = new Set(cards.map(card => card.dataset.productKey));
  const saved = storage.read('turbo-designs:favorites');
  const favorites = new Set(Array.isArray(saved) ? saved.filter(key => knownKeys.has(key)) : []);
  const categories = new Set(['all', ...categoryButtons.map(button => button.dataset.shopCategory)]);
  const initialParams = new URLSearchParams(location.search);
  let category = categories.has(initialParams.get('category')) ? initialParams.get('category') : 'all';
  let favoritesOnly = false;
  if (search) search.value = (initialParams.get('q') || '').slice(0, 200);
  if (sort && [...sort.options].some(option => option.value === initialParams.get('sort'))) {
    sort.value = initialParams.get('sort');
  }

  const normalize = value => value.toLocaleLowerCase('de').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  const price = card => {
    const text = card.querySelector('.shop-price strong')?.textContent || '';
    if (!/\d/.test(text)) return null;
    const raw = text.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
    const amount = Number(raw);
    return Number.isFinite(amount) ? amount : null;
  };
  const available = card => {
    const badge = card.querySelector('.availability');
    return !badge || badge.hidden;
  };
  const productName = key => {
    const card = cards.find(item => item.dataset.productKey === key);
    return card?.querySelector('h3, h2')?.textContent.trim() || 'Angebot';
  };
  const updateFavorites = () => {
    favoriteButtons.forEach(button => {
      const isSaved = favorites.has(button.dataset.favorite);
      const label = `${productName(button.dataset.favorite)} ${isSaved ? 'aus der Merkliste entfernen' : 'merken'}`;
      button.setAttribute('aria-pressed', String(isSaved));
      button.setAttribute('aria-label', label);
      button.setAttribute('title', label);
      button.classList.toggle('is-saved', isSaved);
      const text = button.querySelector('[data-favorite-label]');
      if (text) text.textContent = isSaved ? 'Gemerkt' : 'Merken';
    });
    cards.forEach(card => card.classList.toggle('is-saved', favorites.has(card.dataset.productKey)));
    if (savedCount) savedCount.textContent = String(favorites.size);
    savedToggle?.setAttribute('aria-pressed', String(favoritesOnly));
    savedToggle?.classList.toggle('is-active', favoritesOnly);
  };
  const updateUrl = () => {
    try {
      const url = new URL(location.href);
      const query = search?.value.trim() || '';
      if (query) url.searchParams.set('q', query); else url.searchParams.delete('q');
      if (category !== 'all') url.searchParams.set('category', category); else url.searchParams.delete('category');
      if (sort && sort.value !== 'featured') url.searchParams.set('sort', sort.value); else url.searchParams.delete('sort');
      history.replaceState(history.state, '', `${url.pathname}${url.search}${url.hash}`);
    } catch { /* Filtering remains available if URL updates are restricted. */ }
  };
  const renderShop = (writeUrl = false) => {
    if (!cards.length) return;
    const terms = normalize(search?.value || '').split(/\s+/).filter(Boolean);
    const sorted = [...cards];
    if (sort?.value === 'price-asc' || sort?.value === 'price-desc') {
      const direction = sort.value === 'price-asc' ? 1 : -1;
      sorted.sort((a, b) => {
        const aPrice = price(a), bPrice = price(b);
        if (aPrice === null) return bPrice === null ? cards.indexOf(a) - cards.indexOf(b) : 1;
        if (bPrice === null) return -1;
        return direction * (aPrice - bPrice) || cards.indexOf(a) - cards.indexOf(b);
      });
    }
    const parent = cards[0].parentElement;
    if (cards.every(card => card.parentElement === parent)) {
      const currentOrder = [...parent.children].filter(child => cards.includes(child));
      if (sorted.some((card, index) => currentOrder[index] !== card)) {
        const focused = document.activeElement;
        sorted.forEach(card => parent.append(card));
        if (focused && cards.some(card => card.contains(focused))) focused.focus({ preventScroll: true });
      }
    }
    let count = 0;
    cards.forEach(card => {
      const haystack = normalize(`${card.dataset.search || ''} ${card.querySelector('h3, h2')?.textContent || ''}`);
      const matches = (category === 'all' || category === card.dataset.category) &&
        (!favoritesOnly || favorites.has(card.dataset.productKey)) && terms.every(term => haystack.includes(term));
      card.hidden = !matches;
      card.classList.toggle('is-unavailable', !available(card));
      if (matches) count += 1;
    });
    categoryButtons.forEach(button => {
      const active = button.dataset.shopCategory === category;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    updateFavorites();
    if (resultsCount) {
      resultsCount.textContent = favoritesOnly
        ? `${count} ${count === 1 ? 'gemerktes Angebot' : 'gemerkte Angebote'}`
        : `${count} ${count === 1 ? 'Angebot' : 'Angebote'}`;
    }
    if (empty) empty.hidden = count > 0;
    if (writeUrl) updateUrl();
  };
  search?.addEventListener('input', () => renderShop(true));
  categoryButtons.forEach(button => button.addEventListener('click', () => {
    category = button.dataset.shopCategory;
    renderShop(true);
  }));
  sort?.addEventListener('change', () => renderShop(true));
  savedToggle?.addEventListener('click', () => {
    favoritesOnly = !favoritesOnly;
    renderShop();
  });
  favoriteButtons.forEach(button => button.addEventListener('click', () => {
    const key = button.dataset.favorite;
    if (!knownKeys.has(key)) return;
    if (favorites.has(key)) favorites.delete(key); else favorites.add(key);
    storage.write('turbo-designs:favorites', [...favorites]);
    renderShop();
  }));
  document.getElementById('shop-reset')?.addEventListener('click', () => {
    category = 'all';
    favoritesOnly = false;
    if (search) search.value = '';
    if (sort) sort.value = 'featured';
    renderShop(true);
    search?.focus();
  });
  renderShop();

  // The existing Discord feed updates prices and availability after page load.
  // Watch those values without intercepting its network requests or handlers.
  const catalogSignature = () => cards.map(card => `${price(card)}:${available(card)}`).join('|');
  let signature = catalogSignature();
  let catalogTimer;
  if ('MutationObserver' in window && cards.length) {
    const observer = new MutationObserver(() => {
      clearTimeout(catalogTimer);
      catalogTimer = setTimeout(() => {
        const next = catalogSignature();
        if (signature === next) return;
        signature = next;
        renderShop();
      }, 30);
    });
    cards.forEach(card => {
      const amount = card.querySelector('.shop-price strong');
      const label = card.querySelector('.shop-label');
      if (amount) observer.observe(amount, { subtree: true, childList: true, characterData: true });
      if (label) observer.observe(label, { subtree: true, childList: true, attributes: true, attributeFilter: ['hidden'] });
    });
  }

  const briefForm = document.getElementById('order-briefing');
  const draftStatus = document.getElementById('draft-status');
  const draftClear = document.getElementById('draft-clear');
  const draftKey = 'turbo-designs:brief:v1';
  const fieldLimits = { product: 40, contact: 64, project: 1500, deadline: 100, assets: 300 };
  const briefFields = Object.fromEntries(Object.keys(fieldLimits).map(key => [key, document.getElementById(`brief-${key}`)]));
  let draftTimer;
  let clearingDraft = false;
  const validateReference = reference => {
    if (!reference || typeof reference.image !== 'string' || reference.image.length > 4096 ||
      typeof reference.messageUrl !== 'string' ||
      !/^https:\/\/discord\.com\/channels\/1531989453168578650\/1550470150086729748\/\d{17,20}$/.test(reference.messageUrl)) return null;
    try {
      const image = new URL(reference.image);
      if (image.protocol !== 'https:' || !['cdn.discordapp.com', 'media.discordapp.net'].includes(image.hostname) ||
        !image.pathname.startsWith('/attachments/')) return null;
      return { image: image.href, messageUrl: reference.messageUrl };
    } catch { return null; }
  };
  const currentReference = () => {
    try { return typeof briefReference === 'undefined' ? null : validateReference(briefReference); } catch { return null; }
  };
  const restoreReference = reference => {
    try {
      if (typeof briefReference === 'undefined' || typeof renderBriefReference !== 'function') return false;
      briefReference = reference;
      renderBriefReference();
      return true;
    } catch { return false; }
  };
  const hasProjectContent = values => ['project', 'deadline', 'assets'].some(key => values[key]?.trim());
  const hasDraftContent = values => hasProjectContent(values) ||
    (!briefFields.contact?.readOnly && Boolean(values.contact?.trim())) || Boolean(currentReference());
  const readFields = () => Object.fromEntries(Object.entries(briefFields).map(([key, field]) => [key, field?.value || '']));
  const saveDraft = () => {
    draftTimer = null;
    if (clearingDraft) return;
    const values = readFields();
    const hasContent = hasDraftContent(values);
    const saved = hasContent ? storage.write(draftKey, {
      version: 1, updatedAt: Date.now(), fields: values, reference: currentReference()
    }) : storage.remove(draftKey);
    if (draftClear) draftClear.disabled = !hasContent;
    if (draftStatus) draftStatus.textContent = saved
      ? hasContent ? 'Entwurf auf diesem Gerät gespeichert.' : 'Dein Entwurf wird auf diesem Gerät gespeichert.'
      : 'Automatisches Speichern ist in diesem Browser nicht verfügbar.';
  };
  if (briefForm) {
    const draft = storage.read(draftKey);
    let restored = false;
    // A draft restored by the existing Discord-login flow takes priority.
    // A verified, auto-filled name alone does not represent an in-progress project.
    const emptyForm = !hasProjectContent(readFields()) && !currentReference();
    if (draft?.version === 1 && draft.fields && emptyForm) {
      Object.entries(briefFields).forEach(([key, field]) => {
        if (!field || field.disabled || field.readOnly || typeof draft.fields[key] !== 'string') return;
        const value = draft.fields[key].slice(0, fieldLimits[key]);
        if (key === 'product' && ![...field.options].some(option => option.value === value)) return;
        if (field.value && key !== 'product') return;
        field.value = value;
        restored ||= Boolean(value && key !== 'product');
      });
      const reference = validateReference(draft.reference);
      if (reference && !currentReference()) restored = restoreReference(reference) || restored;
      if (restored) {
        briefFields.product?.dispatchEvent(new Event('change', { bubbles: true }));
        briefForm.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
    if (draftStatus) draftStatus.textContent = restored
      ? 'Dein gespeicherter Entwurf ist wieder da.'
      : 'Dein Entwurf wird auf diesem Gerät gespeichert.';
    if (draftClear) draftClear.disabled = !hasDraftContent(readFields());
    const queueSave = () => {
      if (clearingDraft) return;
      clearTimeout(draftTimer);
      draftTimer = setTimeout(saveDraft, 350);
    };
    briefForm.addEventListener('input', queueSave);
    briefForm.addEventListener('change', queueSave);
    let referenceSignature = JSON.stringify(currentReference());
    const referenceBox = document.getElementById('brief-reference');
    if (referenceBox && 'MutationObserver' in window) {
      new MutationObserver(() => {
        const next = JSON.stringify(currentReference());
        if (next === referenceSignature) return;
        referenceSignature = next;
        queueSave();
      }).observe(referenceBox, { subtree: true, attributes: true, attributeFilter: ['hidden', 'src', 'href'] });
    }
    draftClear?.addEventListener('click', () => {
      if (Object.values(briefFields).some(field => field?.disabled)) return;
      clearingDraft = true;
      clearTimeout(draftTimer);
      draftTimer = null;
      Object.entries(briefFields).forEach(([key, field]) => {
        if (!field || field.readOnly) return;
        field.value = key === 'product' ? field.options[0]?.value || '' : '';
      });
      const output = document.getElementById('brief-output');
      const copy = document.getElementById('brief-copy');
      if (output) output.value = '';
      if (copy) copy.disabled = true;
      document.getElementById('brief-reference-remove')?.click();
      referenceSignature = JSON.stringify(currentReference());
      const consent = document.getElementById('brief-consent');
      if (consent) consent.checked = false;
      [...Object.values(briefFields), consent].filter(Boolean).forEach(field => {
        field.removeAttribute('aria-invalid');
        const descriptions = (field.getAttribute('aria-describedby') || '').split(/\s+/).filter(id => id && id !== 'request-status');
        if (descriptions.length) field.setAttribute('aria-describedby', descriptions.join(' '));
        else field.removeAttribute('aria-describedby');
      });
      briefFields.product?.dispatchEvent(new Event('change', { bubbles: true }));
      briefForm.dispatchEvent(new Event('input', { bubbles: true }));
      const status = document.getElementById('brief-status');
      if (status) status.textContent = '';
      const requestStatus = document.getElementById('request-status');
      if (requestStatus) { requestStatus.textContent = ''; requestStatus.className = ''; }
      const removed = storage.remove(draftKey);
      draftClear.disabled = true;
      if (draftStatus) draftStatus.textContent = removed ? 'Entwurf gelöscht.' : 'Der Entwurf konnte im Browser nicht gelöscht werden.';
      clearingDraft = false;
      briefFields.project?.focus();
    });
    window.addEventListener('pagehide', () => {
      if (!draftTimer) return;
      clearTimeout(draftTimer);
      saveDraft();
    });
  }

  const skinButtons = [...document.querySelectorAll('[data-skin-preview]')];
  const skinImage = document.getElementById('skin-showcase-image');
  skinButtons.forEach(button => button.addEventListener('click', () => {
    if (!skinImage) return;
    skinImage.src = button.dataset.skinPreview;
    skinImage.alt = `${button.dataset.title || 'Weapon Skin'}${button.dataset.model ? ` · ${button.dataset.model}` : ''}`;
    const title = document.getElementById('skin-showcase-name');
    const model = document.getElementById('skin-showcase-model');
    if (title) title.textContent = button.dataset.title || 'Weapon Skin';
    if (model) model.textContent = button.dataset.model || '';
    skinButtons.forEach(item => {
      item.classList.toggle('is-active', item === button);
      item.setAttribute('aria-pressed', String(item === button));
    });
  }));

  const previewGallery = document.getElementById('thumbnail-gallery');
  const previewMore = document.getElementById('preview-more');
  let allPreviews = false;
  const renderPreviewLimit = () => {
    if (!previewGallery || !previewMore) return;
    const items = [...previewGallery.children];
    items.forEach((item, index) => { item.hidden = !allPreviews && index >= 6; });
    previewMore.hidden = items.length <= 6;
    previewMore.textContent = allPreviews ? 'Weniger anzeigen' : 'Alle Arbeiten ansehen';
    previewMore.setAttribute('aria-expanded', String(allPreviews));
    previewMore.setAttribute('aria-controls', 'thumbnail-gallery');
  };
  previewMore?.addEventListener('click', () => {
    allPreviews = !allPreviews;
    renderPreviewLimit();
  });
  if (previewGallery && previewMore && 'MutationObserver' in window) {
    new MutationObserver(renderPreviewLimit).observe(previewGallery, { childList: true });
  }
  renderPreviewLimit();
})();
