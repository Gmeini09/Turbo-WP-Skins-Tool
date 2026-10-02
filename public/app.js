const menuButton = document.querySelector('.menu-button');
const navigation = document.querySelector('.nav-links');
const closeMenu = () => {
  navigation?.classList.remove('open');
  menuButton?.setAttribute('aria-expanded', 'false');
  menuButton?.setAttribute('aria-label', 'Menü öffnen');
};
menuButton?.addEventListener('click', () => {
  const open = navigation.classList.toggle('open');
  menuButton.setAttribute('aria-expanded', String(open));
  menuButton.setAttribute('aria-label', open ? 'Menü schließen' : 'Menü öffnen');
});
navigation?.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && navigation?.classList.contains('open')) {
    closeMenu();
    menuButton.focus();
  }
});
document.addEventListener('click', event => {
  if (!event.target.closest('.site-header')) closeMenu();
});
window.matchMedia('(min-width: 901px)').addEventListener('change', event => {
  if (event.matches) closeMenu();
});

// Progressive enhancement: content is visible without JavaScript.
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const motionTargets = document.querySelectorAll('.shop-card, .shop-note, .section-head, .products > article, .suite-detail .hero-grid > div, .details-grid > article, .steps > li, .skin-gallery > figure, .editor-shot, .detail-stack > article, .contact, .faq-list > details, .split > div:first-child');
let revealObserver;
function setupMotion() {
  revealObserver?.disconnect();
  motionTargets.forEach(element => element.classList.remove('motion-pending', 'motion-visible'));
  document.documentElement.classList.toggle('motion-enabled', !reducedMotion.matches);
  if (reducedMotion.matches || !('IntersectionObserver' in window)) return;
  revealObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.remove('motion-pending');
      entry.target.classList.add('motion-visible');
      revealObserver.unobserve(entry.target);
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -24px 0px' });
  motionTargets.forEach(element => {
    element.classList.add('motion-item');
    const siblings = [...element.parentElement.children];
    element.style.setProperty('--motion-delay', `${Math.min(siblings.indexOf(element), 2) * 65}ms`);
    // Never hide content while waiting for the observer.
    revealObserver.observe(element);
  });
}
setupMotion();
reducedMotion.addEventListener('change', setupMotion);

const progress = document.querySelector('.scroll-progress > span');
const navAnchors = [...(navigation?.querySelectorAll('a[href^="/#"]') || [])];
const sections = navAnchors.map(link => ({ link, section: document.getElementById(link.hash.slice(1)) })).filter(item => item.section);
let scheduled = false;
const updateScroll = () => {
  const maximum = document.documentElement.scrollHeight - window.innerHeight;
  if (progress) progress.style.transform = `scaleX(${maximum > 0 ? Math.min(1, Math.max(0, window.scrollY / maximum)) : 0})`;
  let active;
  for (const item of sections) if (item.section.getBoundingClientRect().top <= 160) active = item.link;
  navAnchors.forEach(link => {
    if (link === active) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  });
  document.querySelector('.site-header')?.classList.toggle('is-scrolled', window.scrollY > 24);
  scheduled = false;
};
window.addEventListener('scroll', () => {
  if (!scheduled) { scheduled = true; requestAnimationFrame(updateScroll); }
}, { passive: true });
window.addEventListener('resize', updateScroll);
window.addEventListener('load', updateScroll);
window.addEventListener('hashchange', updateScroll);
window.addEventListener('pageshow', updateScroll);
updateScroll();


// Read-only Discord sync. The bot token stays on the bot service.
const previewGallery = document.getElementById('thumbnail-gallery');
const syncStatus = document.getElementById('discord-sync-status');
const previewEmpty = document.getElementById('preview-empty');
const euro = new Intl.NumberFormat('de-AT',{style:'currency',currency:'EUR'});
const shopIds = {thumbnail:'thumbnail',nve:'nve',soundpack:'soundpack',grafik:'design',fivem:'fivem',bot:'bot',bundle:'bundle'};
let lastPreviewSignature = '';
let syncBusy = false;
async function syncDiscord() {
  if (!previewGallery || syncBusy) return;
  syncBusy = true;
  try {
    const response=await fetch('/api/discord-feed',{cache:'no-store',signal:AbortSignal.timeout(12000)});
    if(!response.ok) throw new Error('Unavailable');
    const data=await response.json();
    if(!data.connected) throw new Error('Disconnected');
    syncStatus.textContent='Mit Discord verbunden · automatische Aktualisierung';
    syncStatus.parentElement.classList.add('is-connected');
    document.getElementById('preview-channel-link').href=data.previewChannelUrl;
    const signature=JSON.stringify(data.previews);
    if(signature!==lastPreviewSignature) {
      previewGallery.replaceChildren();
      data.previews.forEach((item,index)=>{
        const figure=document.createElement('figure');figure.className='thumbnail-preview';
        const link=document.createElement('a');link.href=item.messageUrl;link.target='_blank';link.rel='noopener noreferrer';link.setAttribute('aria-label',`Thumbnail ${index+1} im Discord öffnen`);
        const img=document.createElement('img');img.src=item.image;img.alt=`Turbo Designs Thumbnail ${index+1}`;img.loading='lazy';img.width=1280;img.height=720;link.append(img);
        const caption=document.createElement('figcaption');const title=document.createElement('strong');title.textContent=`Thumbnail ${String(index+1).padStart(2,'0')}`;const note=document.createElement('span');note.textContent='Discord Preview ↗';caption.append(title,note);figure.append(link,caption);previewGallery.append(figure);
      });
      lastPreviewSignature=signature;
    }
    previewEmpty.hidden=data.previews.length>0;previewEmpty.textContent='Sobald ein Bild in #thumbnails-preview gepostet wird, erscheint es hier automatisch.';
    for(const product of data.products) {
      const id=shopIds[product.key];const card=document.getElementById(`shop-${id}`);if(!card) continue;
      const price=product.price===null?'Preis im Ticket':euro.format(product.price);
      card.querySelector('.shop-price strong').textContent=price;
      card.querySelector('.shop-price > span').textContent=`${product.price===null?'Individuelles Angebot':'Katalogpreis'}${product.etaDays!==null?' · ca. '+product.etaDays+' Tage':''}`;
      let badge=card.querySelector('.availability');
      if(!product.enabled&&!badge){badge=document.createElement('span');badge.className='availability';card.querySelector('.shop-label').append(badge);}
      if(badge){badge.textContent='Derzeit nicht verfügbar';badge.hidden=product.enabled;}
      const catalog=document.querySelector(`.catalog-list a[href="#shop-${id}"]`);
      if(catalog){catalog.querySelector('.catalog-price').textContent=price;let status=catalog.querySelector('.catalog-status');if(!product.enabled&&!status){status=document.createElement('small');status.className='catalog-status';catalog.querySelector('strong').append(status);}if(status){status.textContent='Derzeit nicht verfügbar';status.hidden=product.enabled;}}
    }
  } catch {
    syncStatus.textContent='Discord-Synchronisierung gerade nicht erreichbar';syncStatus.parentElement.classList.remove('is-connected');
    if(!previewGallery.children.length){previewEmpty.hidden=false;previewEmpty.textContent='Du findest alle aktuellen Thumbnail-Vorschauen auch in unserem Discord.';}
  } finally { syncBusy=false; }
}
syncDiscord();
setInterval(()=>{if(!document.hidden)syncDiscord();},60000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)syncDiscord();});
