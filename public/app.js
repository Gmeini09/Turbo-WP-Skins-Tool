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


// Public previews and shop data come from the bot; credentials stay on Railway.
const previewGallery = document.getElementById('thumbnail-gallery');
const syncStatus = document.getElementById('discord-sync-status');
const previewEmpty = document.getElementById('preview-empty');
const viewer = document.getElementById('thumbnail-viewer');
const euro = new Intl.NumberFormat('de-AT',{style:'currency',currency:'EUR'});
const shopIds = {thumbnail:'thumbnail',nve:'nve',soundpack:'soundpack',grafik:'design',fivem:'fivem',bot:'bot',bundle:'bundle'};
let previews = [], selectedPreview = 0, lastPreviewSignature = '', lastSampleSignature = '', syncBusy = false, returnFocus;
function showPreview(index) {
  if(!previews.length) return;
  selectedPreview=(index+previews.length)%previews.length;
  const item=previews[selectedPreview];
  document.getElementById('viewer-image').src=item.image;
  document.getElementById('viewer-image').alt=`Turbo Designs Thumbnail ${selectedPreview+1}`;
  document.getElementById('viewer-title').textContent=`Thumbnail ${String(selectedPreview+1).padStart(2,'0')}`;
  document.getElementById('viewer-position').textContent=`${selectedPreview+1} / ${previews.length} · ← → zum Durchblättern`;
  document.getElementById('viewer-discord').href=item.messageUrl;
  viewer.querySelector('.viewer-prev').disabled=previews.length<2;
  viewer.querySelector('.viewer-next').disabled=previews.length<2;
}
function openPreview(index,trigger) {
  returnFocus=trigger;showPreview(index);viewer.showModal();document.body.classList.add('viewer-open');
}
viewer?.querySelector('.viewer-close').addEventListener('click',()=>viewer.close());
viewer?.querySelector('.viewer-prev').addEventListener('click',()=>showPreview(selectedPreview-1));
viewer?.querySelector('.viewer-next').addEventListener('click',()=>showPreview(selectedPreview+1));
viewer?.addEventListener('keydown',event=>{
  if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();showPreview(selectedPreview+(event.key==='ArrowLeft'?-1:1));}
});
viewer?.addEventListener('close',()=>{document.body.classList.remove('viewer-open');if(returnFocus?.isConnected)returnFocus.focus();else previewGallery?.querySelector('button')?.focus();});
viewer?.addEventListener('click',event=>{if(event.target===viewer){const box=viewer.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)viewer.close();}});
function renderPreviews(items) {
  const signature=JSON.stringify(items);if(signature===lastPreviewSignature)return;
  const currentId=previews[selectedPreview]?.id;previews=items;
  previewGallery.replaceChildren();
  previews.forEach((item,index)=>{
    const figure=document.createElement('figure');figure.className='thumbnail-preview';
    const button=document.createElement('button');button.type='button';button.setAttribute('aria-label',`Thumbnail ${index+1} vergrößern`);button.addEventListener('click',()=>openPreview(index,button));
    const img=document.createElement('img');img.src=item.image;img.alt=`Turbo Designs Thumbnail ${index+1}`;img.loading='lazy';img.decoding='async';img.width=1280;img.height=720;button.append(img);
    const caption=document.createElement('figcaption');const title=document.createElement('strong');title.textContent=`Thumbnail ${String(index+1).padStart(2,'0')}`;
    const link=document.createElement('a');link.href=item.messageUrl;link.target='_blank';link.rel='noopener noreferrer';link.textContent='Im Discord ↗';link.setAttribute('aria-label',`Thumbnail ${index+1} im Discord öffnen`);
    caption.append(title,link);figure.append(button,caption);previewGallery.append(figure);
  });
  if(viewer.open){const index=previews.findIndex(p=>p.id===currentId);if(previews.length)showPreview(index<0?0:index);else viewer.close();}
  lastPreviewSignature=signature;
}
function renderSamples(data) {
  const container=document.getElementById('sound-samples');const status=document.getElementById('sound-samples-status');
  const items=data.samples || [];const signature=JSON.stringify(items);
  // Preserve playback while the feed refreshes unchanged items.
  const active=[...container.querySelectorAll('audio,video')].some(media=>!media.paused);
  if(signature!==lastSampleSignature&&!active){
    container.replaceChildren();items.forEach((item,index)=>{
      const card=document.createElement('article');card.className='sound-sample';const label=document.createElement('span');label.textContent=`${item.kind==='video'?'VIDEO-VORSCHAU':'HÖRPROBE'} ${String(index+1).padStart(2,'0')}`;
      const title=document.createElement('h3');title.textContent=item.title;const media=document.createElement(item.kind==='video'?'video':'audio');media.controls=true;media.preload='none';media.src=item.url;media.setAttribute('aria-label',item.title);if(item.kind==='video')media.playsInline=true;
      media.addEventListener('play',()=>container.querySelectorAll('audio,video').forEach(other=>{if(other!==media)other.pause();}));
      media.addEventListener('error',()=>{const note=document.createElement('p');note.className='muted';note.textContent='Diese Datei lässt sich in deinem Browser nicht abspielen. Öffne die Vorschau im Discord.';if(!card.querySelector('p'))card.append(note);});
      const link=document.createElement('a');link.href=item.messageUrl;link.target='_blank';link.rel='noopener noreferrer';link.textContent='Original im Discord ↗';card.append(label,title,media,link);container.append(card);
    });lastSampleSignature=signature;
  }
  status.hidden=items.length>0;
  status.textContent=data.samplesAvailable?'Neue Hörproben erscheinen hier automatisch, sobald sie im Discord veröffentlicht werden.':'Die Sound-Vorschauen sind gerade nicht verfügbar. Du findest sie auch direkt im Discord.';
  document.getElementById('sound-channel-link').href=data.soundChannelUrl;
}
async function syncDiscord() {
  if(!previewGallery||syncBusy)return;syncBusy=true;
  try {
    const response=await fetch('/api/discord-feed',{cache:'no-store',signal:AbortSignal.timeout(12000)});
    if(!response.ok)throw new Error('Unavailable');const data=await response.json();if(!data.connected)throw new Error('Disconnected');
    syncStatus.textContent='Mit Discord verbunden · automatische Aktualisierung';syncStatus.parentElement.classList.add('is-connected');
    document.getElementById('preview-channel-link').href=data.previewChannelUrl;
    document.querySelectorAll('[data-order-link]').forEach(link=>{link.href=data.orderChannelUrl;});
    renderPreviews(data.previews);renderSamples(data);
    previewEmpty.hidden=data.previews.length>0;previewEmpty.textContent='Sobald ein Bild in #thumbnails-preview gepostet wird, erscheint es hier automatisch.';
    for(const product of data.products){
      const id=shopIds[product.key],card=document.getElementById(`shop-${id}`);if(!card)continue;
      const price=product.price===null?'Preis im Ticket':euro.format(product.price);
      card.querySelector('.shop-price strong').textContent=price;
      card.querySelector('.shop-price > span').textContent=`${product.price===null?'Individuelles Angebot':'Katalogpreis'}${product.etaDays!==null?' · ca. '+product.etaDays+' Tage':''}`;
      const order=card.querySelector('.shop-order a');order.href=product.orderUrl || data.orderChannelUrl;
      order.textContent=product.enabled?(product.key==='thumbnail'?'Thumbnail anfragen ↗':'Im Discord bestellen ↗'):'Verfügbarkeit anfragen ↗';
      let badge=card.querySelector('.availability');if(!product.enabled&&!badge){badge=document.createElement('span');badge.className='availability';card.querySelector('.shop-label').append(badge);}if(badge){badge.textContent='Derzeit nicht verfügbar';badge.hidden=product.enabled;}
      const catalog=document.querySelector(`.catalog-list a[href="#shop-${id}"]`);
      if(catalog){catalog.querySelector('.catalog-price').textContent=price;let status=catalog.querySelector('.catalog-status');if(!product.enabled&&!status){status=document.createElement('small');status.className='catalog-status';catalog.querySelector('strong').append(status);}if(status){status.textContent='Derzeit nicht verfügbar';status.hidden=product.enabled;}}
    }
  } catch {
    syncStatus.textContent='Discord-Synchronisierung gerade nicht erreichbar';syncStatus.parentElement.classList.remove('is-connected');
    if(!previewGallery.children.length){previewEmpty.hidden=false;previewEmpty.textContent='Du findest alle aktuellen Thumbnail-Vorschauen auch in unserem Discord.';}
    const sampleStatus=document.getElementById('sound-samples-status');if(!document.getElementById('sound-samples').children.length){sampleStatus.hidden=false;sampleStatus.textContent='Hörproben findest du aktuell direkt im Discord.';}
  } finally {syncBusy=false;}
}
syncDiscord();setInterval(()=>{if(!document.hidden)syncDiscord();},60000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)syncDiscord();});
