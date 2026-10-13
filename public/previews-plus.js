(() => {
  'use strict';

  const reviewSection = document.getElementById('customer-reviews');
  const reviewGrid = document.getElementById('customer-reviews-grid');
  const compareSection = document.getElementById('nve-compare');
  const compareGrid = document.getElementById('nve-compare-grid');
  const officialComparisons = document.getElementById('nve-official-comparisons');
  const localGrid = document.getElementById('nve-local-compare-grid');
  const uploadStatus = document.getElementById('nve-upload-status');
  const resetUploads = document.getElementById('nve-upload-reset');
  const uploadInputs = { before: document.getElementById('nve-before-upload'), after: document.getElementById('nve-after-upload') };
  const localSlots = { before: { file: null, url: null, revision: 0 }, after: { file: null, url: null, revision: 0 } };
  const localUrls = new Set();
  const localMaxBytes = 10 * 1024 * 1024;
  const reviewMessagePattern = /^https:\/\/discord\.com\/channels\/1531989453168578650\/1550121564870025398\/\d{17,20}$/;
  const discordMessagePattern = /^https:\/\/discord\.com\/channels\/1531989453168578650\/\d{17,20}\/\d{17,20}$/;
  const products = {
    thumbnail: 'Thumbnail', nve: 'NVE Preset', soundpack: 'Soundpack',
    grafik: 'Grafikdesign', fivem: 'FiveM Asset', bot: 'Discord Bot',
    bundle: 'Bundle', 'soundpack-tool': 'Soundpack Creator'
  };
  const dateFormatter = new Intl.DateTimeFormat('de-AT', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Vienna' });
  let reviewSignature = '', comparisonVersion = 0, localRenderVersion = 0;

  function textNode(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    node.textContent = text;
    return node;
  }

  function sourceLink(url, text, className) {
    const link = textNode('a', className, text);
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    return link;
  }

  function renderReviews(feed) {
    if (!reviewSection || !reviewGrid) return;
    const seen = new Set();
    const reviews = (Array.isArray(feed?.reviews) ? feed.reviews : []).filter(review => {
      if (!review || typeof review.text !== 'string' || !review.text.trim() || !reviewMessagePattern.test(review.messageUrl || '') || seen.has(review.messageUrl)) return false;
      seen.add(review.messageUrl);
      return true;
    }).sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0)).slice(0, 6);
    const signature = JSON.stringify(reviews);
    if (signature === reviewSignature) return;
    reviewSignature = signature;
    reviewGrid.replaceChildren();
    reviewSection.hidden = reviews.length === 0;

    for (const review of reviews) {
      const card = document.createElement('article');
      card.className = 'customer-review';
      card.dataset.reviewSource = review.messageUrl;
      const top = document.createElement('div');
      top.className = 'customer-review-top';
      if (Number.isInteger(review.rating) && review.rating >= 1 && review.rating <= 5) {
        const rating = textNode('span', 'customer-review-rating', '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating));
        rating.setAttribute('role', 'img');
        rating.setAttribute('aria-label', `${review.rating} von 5 Sternen`);
        top.append(rating);
      }
      const date = typeof review.date === 'string' ? new Date(review.date) : null;
      if (date && Number.isFinite(date.getTime())) {
        const time = textNode('time', 'customer-review-date', dateFormatter.format(date));
        time.dateTime = date.toISOString();
        top.append(time);
      }
      if (top.childElementCount) card.append(top);
      card.append(textNode('blockquote', '', review.text));
      const footer = document.createElement('div');
      footer.className = 'customer-review-footer';
      const person = document.createElement('div');
      person.className = 'customer-review-person';
      if (typeof review.authorDisplayName === 'string' && review.authorDisplayName.trim()) person.append(textNode('cite', 'customer-review-author', review.authorDisplayName));
      if (Object.hasOwn(products, review.productKey)) person.append(textNode('span', 'customer-review-product', products[review.productKey]));
      if (person.childElementCount) footer.append(person);
      const original = sourceLink(review.messageUrl, 'Original ansehen ↗', 'customer-review-source');
      original.setAttribute('aria-label', `Originalbewertung${review.authorDisplayName ? ` von ${review.authorDisplayName}` : ''} im Discord ansehen`);
      footer.append(original);
      card.append(footer);
      reviewGrid.append(card);
    }
  }

  function imageUrl(raw, allowLocal = false) {
    if (typeof raw !== 'string') return null;
    try {
      const url = new URL(raw, location.origin);
      if (allowLocal && url.protocol === 'blob:' && localUrls.has(raw)) return raw;
      if (url.origin === location.origin && url.pathname.startsWith('/assets/') && !/\.svg$/i.test(url.pathname)) return url.href;
      if (url.protocol === 'https:' && ['cdn.discordapp.com', 'media.discordapp.net'].includes(url.hostname) && /^\/attachments\/\d+\/\d+\//.test(url.pathname)) return url.href;
    } catch {}
    return null;
  }

  function imageIdentity(url) {
    const parsed = new URL(url);
    return `${parsed.hostname}${parsed.pathname}`;
  }

  function loadImage(url, alt) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.alt = alt;
      image.decoding = 'async';
      image.draggable = false;
      const timeout = setTimeout(() => reject(new Error('Image timed out')), 15000);
      image.onload = () => {
        clearTimeout(timeout);
        image.naturalWidth && image.naturalHeight ? resolve(image) : reject(new Error('Empty image'));
      };
      image.onerror = () => { clearTimeout(timeout); reject(new Error('Image unavailable')); };
      image.src = url;
    });
  }

  async function comparisonCard(pair, index, local = false) {
    const beforeUrl = imageUrl(pair?.beforeImage, local), afterUrl = imageUrl(pair?.afterImage, local);
    if (!beforeUrl || !afterUrl || imageIdentity(beforeUrl) === imageIdentity(afterUrl)) return null;
    const title = typeof pair.title === 'string' && pair.title.trim() ? pair.title.trim().slice(0, 120) : 'NVE im direkten Vergleich';
    const beforeLabel = typeof pair.beforeLabel === 'string' && pair.beforeLabel.trim() ? pair.beforeLabel.trim().slice(0, 40) : 'Ohne Preset';
    const afterLabel = typeof pair.afterLabel === 'string' && pair.afterLabel.trim() ? pair.afterLabel.trim().slice(0, 40) : 'Mit Preset';
    const [before, after] = await Promise.all([
      loadImage(beforeUrl, typeof pair.beforeAlt === 'string' ? pair.beforeAlt : `${title} – ${beforeLabel}`),
      loadImage(afterUrl, typeof pair.afterAlt === 'string' ? pair.afterAlt : `${title} – ${afterLabel}`)
    ]);
    const ratio = before.naturalWidth / before.naturalHeight;
    if (local && [before, after].some(image => image.naturalWidth * image.naturalHeight > 40000000)) throw new Error('Die Auflösung ist zu groß. Wähle Screenshots mit höchstens 40 Megapixeln.');
    if (Math.abs(ratio - after.naturalWidth / after.naturalHeight) > 0.01) return null;

    const card = document.createElement('figure');
    card.className = 'nve-compare-card';
    card.dataset.compareId = typeof pair.id === 'string' ? pair.id : `comparison-${index + 1}`;
    const scene = document.createElement('div');
    scene.className = 'nve-compare-scene';
    scene.style.aspectRatio = `${before.naturalWidth} / ${before.naturalHeight}`;
    before.className = 'nve-compare-before';
    after.className = 'nve-compare-after';
    const leftLabel = textNode('span', 'nve-compare-label nve-compare-label-before', beforeLabel);
    const rightLabel = textNode('span', 'nve-compare-label nve-compare-label-after', afterLabel);
    const divider = document.createElement('span');
    divider.className = 'nve-compare-divider';
    divider.setAttribute('aria-hidden', 'true');
    divider.append(textNode('span', 'nve-compare-handle', '↔'));
    scene.append(after, before, leftLabel, rightLabel, divider);

    const caption = document.createElement('figcaption');
    caption.className = 'nve-compare-caption';
    const heading = document.createElement('div');
    heading.className = 'nve-compare-caption-top';
    const titleNode = textNode('h3', '', title);
    const idPrefix = local ? 'nve-local' : 'nve-compare';
    titleNode.id = `${idPrefix}-heading-${index + 1}`;
    heading.append(titleNode);
    if (discordMessagePattern.test(pair.messageUrl || '')) heading.append(sourceLink(pair.messageUrl, 'Vorschau im Discord ↗', 'nve-compare-source'));
    caption.append(heading);
    if (typeof pair.caption === 'string' && pair.caption.trim()) caption.append(textNode('p', 'nve-compare-description', pair.caption.trim().slice(0, 300)));
    const rangeId = `${idPrefix}-range-${index + 1}`;
    const label = textNode('label', 'nve-compare-range-label', 'Trennlinie verschieben');
    label.htmlFor = rangeId;
    const position = document.createElement('output');
    position.setAttribute('for', rangeId);
    position.setAttribute('aria-hidden', 'true');
    label.append(position);
    const range = document.createElement('input');
    range.type = 'range';
    range.className = 'nve-compare-range';
    range.id = rangeId;
    range.min = '0';
    range.max = '100';
    range.step = '1';
    range.value = '50';
    range.setAttribute('aria-label', `Bildvergleich ${title}: Anteil ${beforeLabel}`);
    const buttons = document.createElement('div');
    buttons.className = 'nve-compare-buttons';
    buttons.setAttribute('role', 'group');
    buttons.setAttribute('aria-label', `Ansicht für ${title}`);
    const quickViews = [[beforeLabel, 100], ['50 / 50', 50], [afterLabel, 0]].map(([text, value]) => {
      const button = textNode('button', '', text);
      button.type = 'button';
      button.addEventListener('click', () => updatePosition(value));
      buttons.append(button);
      return { button, value };
    });
    function updatePosition(value) {
      const amount = Math.max(0, Math.min(100, Math.round(Number(value))));
      range.value = String(amount);
      scene.style.setProperty('--compare-position', `${amount}%`);
      range.setAttribute('aria-valuetext', `${amount} Prozent ${beforeLabel}, ${100 - amount} Prozent ${afterLabel}`);
      position.value = `${amount} / ${100 - amount}`;
      quickViews.forEach(view => view.button.setAttribute('aria-pressed', String(view.value === amount)));
      leftLabel.hidden = amount < 18;
      rightLabel.hidden = amount > 82;
    }
    range.addEventListener('input', () => updatePosition(range.value));
    let dragPointer = null;
    function pointerPosition(event) {
      const bounds = scene.getBoundingClientRect();
      if (bounds.width > 0) updatePosition((event.clientX - bounds.left) / bounds.width * 100);
    }
    scene.addEventListener('pointerdown', event => {
      if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
      dragPointer = event.pointerId;
      scene.setPointerCapture(event.pointerId);
      range.focus({ preventScroll: true });
      pointerPosition(event);
    });
    scene.addEventListener('pointermove', event => { if (event.pointerId === dragPointer) pointerPosition(event); });
    const stopDragging = event => {
      if (event.pointerId !== dragPointer) return;
      dragPointer = null;
      if (scene.hasPointerCapture(event.pointerId)) scene.releasePointerCapture(event.pointerId);
    };
    scene.addEventListener('pointerup', stopDragging);
    scene.addEventListener('pointercancel', stopDragging);
    scene.addEventListener('lostpointercapture', () => { dragPointer = null; });
    caption.append(label, range, buttons);
    card.append(scene, caption);
    card.setAttribute('aria-labelledby', titleNode.id);
    updatePosition(50);
    return card;
  }

  async function renderComparisons(content) {
    if (!compareSection || !compareGrid) return;
    const version = ++comparisonVersion;
    const pairs = Array.isArray(content?.comparePairs) ? content.comparePairs.slice(0, 6) : [];
    const cards = await Promise.all(pairs.map((pair, index) => comparisonCard(pair, index).catch(() => null)));
    if (version !== comparisonVersion) return;
    compareGrid.replaceChildren(...cards.filter(Boolean));
    if (officialComparisons) officialComparisons.hidden = !compareGrid.childElementCount;
    else if (!localGrid) compareSection.hidden = !compareGrid.childElementCount;
  }

  function releaseLocalUrl(url) {
    if (!url || !localUrls.delete(url)) return;
    URL.revokeObjectURL(url);
  }

  function localStatus(message, error = false) {
    if (!uploadStatus) return;
    uploadStatus.textContent = message;
    uploadStatus.classList.toggle('is-error', error);
  }

  function clearLocalView() {
    localRenderVersion += 1;
    if (localGrid) { localGrid.replaceChildren(); localGrid.hidden = true; }
  }

  async function validateLocalFile(file) {
    if (!file || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('Bitte wähle einen PNG-, JPG- oder WebP-Screenshot.');
    if (!file.size) throw new Error('Diese Datei ist leer. Wähle einen anderen Screenshot.');
    if (file.size > localMaxBytes) throw new Error('Das Bild ist größer als 10 MB. Wähle einen kleineren Screenshot.');
    const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    const matches = (values, offset = 0) => values.every((value, index) => bytes[offset + index] === value);
    const valid = (file.type === 'image/png' && matches([137, 80, 78, 71, 13, 10, 26, 10]))
      || (file.type === 'image/jpeg' && matches([255, 216, 255]))
      || (file.type === 'image/webp' && matches([82, 73, 70, 70]) && matches([87, 69, 66, 80], 8));
    if (!valid) throw new Error('Die Datei ist kein gültiges PNG-, JPG- oder WebP-Bild.');
  }

  async function renderLocalComparison() {
    if (!localGrid) return;
    const version = ++localRenderVersion;
    const before = localSlots.before, after = localSlots.after;
    if (!before.url || !after.url) {
      if ([before, after].some(slot => slot.file && !slot.url)) localStatus('Dein Screenshot wird geprüft …');
      else if (before.url) localStatus('Vorher ausgewählt. Wähle jetzt den Nachher-Screenshot derselben Szene.');
      else if (after.url) localStatus('Nachher ausgewählt. Wähle jetzt den Vorher-Screenshot derselben Szene.');
      else localStatus('Wähle beide Screenshots, um deinen Vergleich zu starten.');
      return;
    }
    localStatus('Deine Bilder werden für den Vergleich vorbereitet …');
    try {
      const card = await comparisonCard({
        id: 'your-screenshots', title: 'Deine Screenshots',
        beforeImage: before.url, afterImage: after.url,
        beforeLabel: 'Vorher', afterLabel: 'Nachher',
        beforeAlt: 'Dein Vorher-Screenshot', afterAlt: 'Dein Nachher-Screenshot'
      }, 0, true);
      if (version !== localRenderVersion) return;
      if (!card) {
        localStatus('Die Bilder haben unterschiedliche Seitenverhältnisse. Wähle zwei Screenshots mit demselben Bildausschnitt.', true);
        return;
      }
      localGrid.replaceChildren(card);
      localGrid.hidden = false;
      localStatus('Dein Vergleich ist bereit. Zieh die Trennlinie oder nutze den Regler mit den Pfeiltasten.');
    } catch (error) {
      if (version !== localRenderVersion) return;
      localStatus(error.message?.startsWith('Die Auflösung') ? error.message : 'Ein Bild konnte nicht geöffnet werden. Wähle einen anderen gültigen Screenshot.', true);
    }
  }

  async function selectLocalFile(key) {
    const input = uploadInputs[key], slot = localSlots[key];
    const revision = ++slot.revision;
    clearLocalView();
    releaseLocalUrl(slot.url);
    slot.url = null;
    const file = input.files?.[0] || null;
    slot.file = file;
    if (resetUploads) resetUploads.hidden = !Object.values(localSlots).some(item => item.file);
    if (!file) return renderLocalComparison();
    localStatus('Dein Screenshot wird geprüft …');
    try {
      await validateLocalFile(file);
      if (revision !== slot.revision || slot.file !== file) return;
      slot.url = URL.createObjectURL(file);
      localUrls.add(slot.url);
      await renderLocalComparison();
    } catch (error) {
      if (revision !== slot.revision || slot.file !== file) return;
      releaseLocalUrl(slot.url);
      slot.url = null;
      slot.file = null;
      input.value = '';
      clearLocalView();
      if (resetUploads) resetUploads.hidden = !Object.values(localSlots).some(item => item.file);
      localStatus(error.message || 'Das Bild konnte nicht geöffnet werden.', true);
    }
  }

  function resetLocalFiles() {
    clearLocalView();
    for (const key of ['before', 'after']) {
      const slot = localSlots[key];
      slot.revision += 1;
      releaseLocalUrl(slot.url);
      slot.url = null;
      slot.file = null;
      if (uploadInputs[key]) uploadInputs[key].value = '';
    }
    if (resetUploads) resetUploads.hidden = true;
    localStatus('Wähle beide Screenshots, um deinen Vergleich zu starten.');
  }

  if (localGrid && uploadInputs.before && uploadInputs.after) {
    if (compareSection) compareSection.hidden = false;
    uploadInputs.before.addEventListener('change', () => selectLocalFile('before'));
    uploadInputs.after.addEventListener('change', () => selectLocalFile('after'));
    resetUploads?.addEventListener('click', resetLocalFiles);
    window.addEventListener('pagehide', event => { if (!event.persisted) resetLocalFiles(); });
  }

  document.addEventListener('turbo:feed', event => renderReviews(event.detail));
  document.addEventListener('turbo:preview-content', event => renderComparisons(event.detail));
  if (compareSection && compareGrid) {
    fetch('/preview-content.json', { cache: 'no-cache', signal: AbortSignal.timeout(8000) })
      .then(response => { if (!response.ok) throw new Error('Content unavailable'); return response.json(); })
      .then(renderComparisons)
      .catch(() => { if (officialComparisons) officialComparisons.hidden = true; else if (!localGrid) compareSection.hidden = true; });
  }
})();
