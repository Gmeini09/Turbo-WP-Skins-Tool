(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TurboGalleryCuration = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';

  // Capture identities from the original gallery; feed positions and CDN signatures change.
  const originals = Object.freeze([
    ['1558888753546924126-0', '1558888753177559152'],
    ['1558518708681310250-1', '1558518707649781832'],
    ['1558518708681310250-2', '1558518708186521720'],
    ['1556760118174027858-3', '1556760117389824010'],
    ['1556760101149474877-4', '1556760099803107358'],
    ['1556733175508508673-5', '1556733173210153110'],
    ['1556733175508508673-6', '1556733174845939814'],
    ['1556428634280034324-7', '1556428632937730068'],
    ['1556369950707290134-8', '1556369949692272800'],
    ['1556078083252162631-9', '1556078082161381466'],
    ['1556078066516627458-10', '1556078065526767626'],
    ['1556065827554328646-11', '1556065826765807676'],
    ['1554960885410304032-12', '1554960884281901066'],
    ['1554948100307820704-13', '1554948098751598632'],
    ['1554948081676591235-14', '1554948080061648906'],
    ['1554891154980470786-15', '1554891154036891679'],
    ['1554632886961967126-16', '1554632885657665610'],
    ['1553384102806298676-17', '1553384102839980142'],
    ['1553096508172279938-18', '1553096507534610503'],
    ['1553096459954561124-19', '1553096459359092836'],
    ['1552799448055160912-20', '1552799446557790219'],
    ['1552636254099865620-21', '1552636253768392764'],
    ['1552636224659787866-22', '1552636222311112794'],
    ['1551866538485874708-23', '1551866537672183938']
  ].map(([id, attachmentId], index) => Object.freeze({
    id, attachmentId, stableId: `attachment:${attachmentId}`,
    number: index + 1, label: `Thumbnail ${String(index + 1).padStart(2, '0')}`
  })));

  const excludedIds = Object.freeze([originals[2].id]);
  const deferredIds = Object.freeze([originals[0].id, originals[1].id, originals[5].id]);
  const excludedStableIds = Object.freeze([originals[2].stableId]);
  const deferredStableIds = Object.freeze([originals[0].stableId, originals[1].stableId, originals[5].stableId]);
  const originalLabels = Object.freeze(Object.fromEntries(originals.map(item => [item.stableId, item.label])));
  const originalNumbers = new Map(originals.map(item => [item.stableId, item.number]));
  const fallbackOriginals = new Map(originals.map(item => [item.id, item.stableId]));

  function stablePreviewId(item) {
    try {
      const url = new URL(item?.image || '');
      const attachment = url.pathname.match(/^\/attachments\/\d+\/(\d+)\//);
      if (attachment && ['cdn.discordapp.com', 'media.discordapp.net'].includes(url.hostname)) {
        return `attachment:${attachment[1]}`;
      }
      if (url.protocol === 'https:') return `image:${url.hostname}${url.pathname}`;
    } catch {}
    return fallbackOriginals.get(String(item?.id || '')) || `preview:${String(item?.id || '')}`;
  }

  function previewLabel(item) {
    return originalLabels[stablePreviewId(item)] || 'Thumbnail';
  }

  function curatePreviews(items) {
    if (!Array.isArray(items)) return [];
    const seen = new Set(), featured = [], deferred = [];
    for (const item of items) {
      if (!item || typeof item.image !== 'string') continue;
      const stableId = stablePreviewId(item);
      if (excludedStableIds.includes(stableId) || seen.has(stableId)) continue;
      seen.add(stableId);
      const curated = {
        ...item,
        stableId,
        originalNumber: originalNumbers.get(stableId) || null,
        originalLabel: originalLabels[stableId] || null,
        label: originalLabels[stableId] || 'Thumbnail'
      };
      (deferredStableIds.includes(stableId) ? deferred : featured).push(curated);
    }
    deferred.sort((a, b) => deferredStableIds.indexOf(a.stableId) - deferredStableIds.indexOf(b.stableId));
    return featured.concat(deferred);
  }

  return Object.freeze({
    excludedIds, deferredIds, excludedStableIds, deferredStableIds,
    originals, originalLabels, stablePreviewId, previewLabel, curatePreviews
  });
});
