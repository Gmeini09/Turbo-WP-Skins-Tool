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


// Catalog and public previews.
const previewGallery=document.getElementById('thumbnail-gallery');
const viewer=document.getElementById('thumbnail-viewer');
const euro=new Intl.NumberFormat('de-AT',{style:'currency',currency:'EUR'});
const shopIds={thumbnail:'thumbnail',nve:'nve',soundpack:'soundpack',grafik:'design',fivem:'fivem',bot:'bot',bundle:'bundle'};
let previews=[],selectedPreview=0,lastPreviewSignature='',lastSampleSignature='',lastNveSignature='',syncBusy=false,returnFocus;
function showPreview(index){
  if(!previews.length||!viewer)return;selectedPreview=(index+previews.length)%previews.length;
  const item=previews[selectedPreview],label=item.label||'FiveM-Thumbnail';
  document.getElementById('viewer-image').src=item.image;document.getElementById('viewer-image').alt=label;
  document.getElementById('viewer-title').textContent=label;
  document.getElementById('viewer-position').textContent=`${selectedPreview+1} / ${previews.length} · ← →`;
  document.getElementById('viewer-discord').href=item.messageUrl;
  viewer.querySelector('.viewer-prev').disabled=previews.length<2;viewer.querySelector('.viewer-next').disabled=previews.length<2;
}
function openPreview(index,trigger){returnFocus=trigger;showPreview(index);viewer.showModal();document.body.classList.add('viewer-open');}
viewer?.querySelector('.viewer-close')?.addEventListener('click',()=>viewer.close());
viewer?.querySelector('.viewer-prev')?.addEventListener('click',()=>showPreview(selectedPreview-1));
viewer?.querySelector('.viewer-next')?.addEventListener('click',()=>showPreview(selectedPreview+1));
viewer?.addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();showPreview(selectedPreview+(event.key==='ArrowLeft'?-1:1));}});
viewer?.addEventListener('close',()=>{document.body.classList.remove('viewer-open');if(returnFocus?.isConnected)returnFocus.focus();});
viewer?.addEventListener('click',event=>{if(event.target===viewer){const box=viewer.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)viewer.close();}});
function externalLink(url,label){const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.textContent=label;return a;}
function renderPreviews(items){
  const signature=JSON.stringify(items);if(signature===lastPreviewSignature||!previewGallery)return;
  const currentId=previews[selectedPreview]?.stableId;previews=items;previewGallery.replaceChildren();
  previews.forEach((item,index)=>{
    const label=item.label||'FiveM-Thumbnail',figure=document.createElement('figure');figure.className='thumbnail-preview';figure.dataset.previewId=item.stableId||item.id;
    const button=document.createElement('button');button.type='button';button.setAttribute('aria-label',`${label} vergrößern`);button.addEventListener('click',()=>openPreview(index,button));
    const img=document.createElement('img');img.src=item.image;img.alt=label;img.loading='lazy';img.decoding='async';img.width=1280;img.height=720;button.append(img);
    const caption=document.createElement('figcaption'),title=document.createElement('strong');title.textContent=label;
    const link=externalLink(item.messageUrl,'Im Discord ↗');link.setAttribute('aria-label',`${label} im Discord öffnen`);
    const reference=document.createElement('button');reference.type='button';reference.className='preview-reference';reference.textContent='Diesen Stil anfragen ↗';reference.setAttribute('aria-label',`${label} als Stilreferenz anfragen`);reference.addEventListener('click',()=>selectBriefReference(item));
    caption.append(title,link,reference);figure.append(button,caption);previewGallery.append(figure);
  });
  if(viewer?.open){const index=previews.findIndex(p=>p.stableId===currentId);if(previews.length)showPreview(index<0?0:index);else viewer.close();}
  lastPreviewSignature=signature;
}
function addMediaBehavior(media,container,card){
  media.addEventListener('play',()=>document.querySelectorAll('#sound-samples audio,#sound-samples video,#nve-gallery video').forEach(other=>{if(other!==media)other.pause();}));
  media.addEventListener('error',()=>{if(!card.querySelector('.media-error')){const note=document.createElement('p');note.className='muted media-error';note.textContent='Öffne diese Vorschau direkt im Discord.';card.append(note);}});
}
function renderSamples(data){
  const container=document.getElementById('sound-samples'),status=document.getElementById('sound-samples-status');if(!container)return;
  const items=data.samples||[],signature=JSON.stringify(items),active=[...container.querySelectorAll('audio,video')].some(media=>!media.paused);
  if(signature!==lastSampleSignature&&!active){container.replaceChildren();items.forEach((item,index)=>{
    const card=document.createElement('article');card.className='sound-sample';
    const label=document.createElement('span');label.textContent=`${item.kind==='video'?'SOUND-VORSCHAU':'HÖRPROBE'} ${String(index+1).padStart(2,'0')}`;
    const title=document.createElement('h3');title.textContent=item.title;
    const media=document.createElement(item.kind==='video'?'video':'audio');media.controls=true;media.preload='none';media.src=item.url;media.setAttribute('aria-label',item.title);if(item.kind==='video')media.playsInline=true;
    addMediaBehavior(media,container,card);card.append(label,title,media,externalLink(item.messageUrl,'Im Discord ansehen ↗'));container.append(card);
  });lastSampleSignature=signature;}
  if(status){status.hidden=items.length>0;status.textContent='Weitere Soundpack-Vorschauen findest du im Discord.';}
  const link=document.getElementById('sound-channel-link');if(link)link.href=data.soundChannelUrl;
}
function renderNve(data){
  const container=document.getElementById('nve-gallery'),status=document.getElementById('nve-empty');if(!container)return;
  const items=data.nvePreviews||[],signature=JSON.stringify(items),active=[...container.querySelectorAll('video')].some(media=>!media.paused);
  if(signature!==lastNveSignature&&!active){container.replaceChildren();items.forEach((item,index)=>{
    const card=document.createElement('figure');card.className='thumbnail-preview nve-preview';
    if(item.kind==='video'){
      const video=document.createElement('video');video.src=item.url;video.controls=true;video.preload='none';video.playsInline=true;video.setAttribute('aria-label',`NVE Vorschau ${index+1}`);addMediaBehavior(video,container,card);card.append(video);
    }else{
      const image=document.createElement('img');image.src=item.url;image.alt=`NVE Vorschau ${index+1}`;image.loading='lazy';image.width=1280;image.height=720;
      const link=externalLink(item.url,'');link.setAttribute('aria-label',`NVE Vorschau ${index+1} vergrößern`);link.append(image);card.append(link);
    }
    const caption=document.createElement('figcaption'),title=document.createElement('strong');title.textContent=`NVE Preview ${String(index+1).padStart(2,'0')}`;
    const request=document.createElement('button');request.type='button';request.className='preview-reference';request.textContent='NVE Preset bestellen ↗';request.addEventListener('click',()=>chooseBriefProduct('nve'));
    caption.append(title,externalLink(item.messageUrl,'Im Discord ↗'),request);card.append(caption);container.append(card);
  });lastNveSignature=signature;}
  if(status){status.hidden=items.length>0;status.textContent='Die NVE-Vorschauen findest du auch direkt im Discord.';}
  const link=document.getElementById('nve-channel-link');if(link)link.href=data.nveChannelUrl;
}
async function syncDiscord(){
  if(!previewGallery||syncBusy)return;syncBusy=true;
  try{
    const response=await fetch('/api/discord-feed',{cache:'no-store',signal:AbortSignal.timeout(12000)}),data=await response.json();if(!response.ok||!data.connected)throw new Error('Unavailable');
    renderPreviews(data.previews||[]);renderSamples(data);renderNve(data);
    const empty=document.getElementById('preview-empty');if(empty){empty.hidden=previews.length>0;empty.textContent='Weitere Arbeiten findest du in unserem Discord.';}
    const previewLink=document.getElementById('preview-channel-link');if(previewLink)previewLink.href=data.previewChannelUrl;
    const reviewLink=document.getElementById('reviews-channel-link');if(reviewLink&&data.reviewsChannelUrl)reviewLink.href=data.reviewsChannelUrl;
    const products=Array.isArray(data.products)?data.products:[];
    briefCatalogProducts=Object.fromEntries(products.map(product=>[product.key,product]));
    briefProductLinks=Object.fromEntries(products.map(p=>[p.key,p.orderUrl||data.orderChannelUrl]));
    for(const product of products){
      const card=document.getElementById(`shop-${shopIds[product.key]}`);if(!card)continue;
      card.querySelector('.shop-price strong').textContent=product.price===null?'Preis im Ticket':euro.format(product.price);
      card.querySelector('.shop-price > span').textContent=product.etaDays!==null?`ca. ${product.etaDays} Tage`:'Individuelles Angebot';
      const order=card.querySelector('.shop-order a');if(order){order.href=product.orderUrl||data.orderChannelUrl;order.textContent='Discord ↗';order.setAttribute('aria-label',`${card.querySelector('h3').textContent} im Discord ansehen`);}
      let badge=card.querySelector('.availability');if(!product.enabled&&!badge){badge=document.createElement('span');badge.className='availability';card.querySelector('.shop-label').append(badge);}if(badge){badge.textContent='Derzeit nicht verfügbar';badge.hidden=product.enabled;}
    }
    if(briefReference){const stable=window.TurboGalleryCuration?.stablePreviewId(briefReference),fresh=previews.find(p=>p.stableId===stable);if(fresh){briefReference.image=fresh.image;renderBriefReference();}}
    updateBriefSummary();
    document.dispatchEvent(new CustomEvent('turbo:feed',{detail:data}));
  }catch{
    const empty=document.getElementById('preview-empty');if(empty&&!previewGallery.children.length){empty.hidden=false;empty.textContent='Unsere Arbeiten findest du auch im Discord.';}
    const nveEmpty=document.getElementById('nve-empty');if(nveEmpty&&!document.getElementById('nve-gallery')?.children.length)nveEmpty.textContent='Öffne die NVE-Vorschauen im Discord.';
    const sounds=document.getElementById('sound-samples-status');if(sounds&&!document.getElementById('sound-samples')?.children.length)sounds.textContent='Öffne die Soundpack-Vorschauen im Discord.';
  }finally{syncBusy=false;}
}

// Visitors choose an offer first; only an authenticated explicit action creates a ticket.
const briefForm=document.getElementById('order-briefing'),briefProduct=document.getElementById('brief-product'),briefPlan=document.getElementById('brief-plan'),requestSend=document.getElementById('brief-send');
const planInfo={lifetime:{label:'Lifetime',price:20},month:{label:'1 Monat',price:15},week:{label:'1 Woche',price:10}};
let briefProductLinks={},briefCatalogProducts={},briefReference=null,discordAccount=null,requestToken=null,requestReady=false,requestBusy=false,requestSent=false,requestAttempted=false,requestChecking=null;
function renderBriefReference(){const box=document.getElementById('brief-reference');if(!box)return;box.hidden=!briefReference;if(briefReference){document.getElementById('brief-reference-image').src=briefReference.image;document.getElementById('brief-reference-link').href=briefReference.messageUrl;}updateBriefSummary();}
function updateBriefSummary(){
  if(!briefProduct)return;
  const product=briefProduct.value,tool=product==='soundpack-tool',partnership=product==='partnership';
  const plan=planInfo[briefPlan?.value]||planInfo.lifetime,catalog=briefCatalogProducts[product];
  const productLabel=briefProduct.selectedOptions[0]?.textContent||'Dein Angebot';
  const price=tool?euro.format(plan.price):typeof catalog?.price==='number'&&Number.isFinite(catalog.price)&&catalog.price>=0?euro.format(catalog.price):'Preis im Ticket';
  const project=document.getElementById('brief-project')?.value.trim()||'';
  const deadline=document.getElementById('brief-deadline')?.value.trim()||'Noch offen';
  const assets=document.getElementById('brief-assets')?.value.trim()||'Noch zu besprechen';
  const setText=(id,text)=>{const node=document.getElementById(id);if(node)node.textContent=text;};
  setText('brief-summary-product',productLabel);
  setText('brief-summary-plan',tool?plan.label:'');
  const planLabel=document.getElementById('brief-summary-plan');if(planLabel)planLabel.hidden=!tool;
  setText('brief-summary-price',price);
  const priceBox=document.getElementById('brief-summary-price-row');if(priceBox)priceBox.hidden=partnership;
  setText('brief-summary-price-note',partnership?'Deine Idee geht an unser Team. Wir melden uns im Discord.':tool?'Deinen Zugang richten wir im Ticket mit dir ein.':'Umfang, Preis und Termin bestätigen wir gemeinsam im Ticket.');
  setText('brief-summary-project',project||'Beschreibe kurz deine Idee oder deinen Bestellwunsch.');
  setText('brief-summary-deadline',deadline);
  setText('brief-summary-assets',assets);
  const referenceRow=document.getElementById('brief-summary-reference-row');if(referenceRow)referenceRow.hidden=!briefReference;
  const referenceLink=document.getElementById('brief-summary-reference');if(referenceLink&&briefReference)referenceLink.href=briefReference.messageUrl;
  const output=document.getElementById('brief-output'),copy=document.getElementById('brief-copy');
  if(output)output.value=[`Produkt: ${productLabel}`,...(tool?[`Laufzeit: ${plan.label}`]:[]),...(!partnership?[`Preis: ${price}`]:[]),'',project,`Wunschtermin: ${deadline}`,`Materialien: ${assets}`,...(briefReference?[`Stilreferenz: ${briefReference.messageUrl}`]:[])].join('\n');
  if(copy)copy.disabled=!project;
}
function updateToolPlan(plan){
  if(requestBusy||!Object.hasOwn(planInfo,plan))return;const info=planInfo[plan];
  document.querySelectorAll('[data-tool-plan]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.toolPlan===plan)));
  const price=document.getElementById('soundpack-selected-price'),label=document.getElementById('soundpack-selected-plan'),order=document.getElementById('soundpack-order');
  if(price)price.textContent=`${info.price} €`;if(label)label.textContent=info.label;if(order)order.dataset.orderPlan=plan;
  if(briefPlan)briefPlan.value=plan;
  const project=document.getElementById('brief-project');
  if(briefProduct?.value==='soundpack-tool'&&project&&/^Ich möchte das Soundpack Tool mit der Laufzeit (Lifetime|1 Monat|1 Woche) bestellen\.$/.test(project.value.trim()))project.value=`Ich möchte das Soundpack Tool mit der Laufzeit ${info.label} bestellen.`;
  updateBriefSummary();
}
const briefHints={thumbnail:'Nenne Videotitel, Motiv und gewünschten Text.',nve:'Welche Lichtstimmung und welchen Look möchtest du?',soundpack:'Welche Sounds möchtest du für dein Setup?',grafik:'Nenne Format, Stil, Text und vorhandene Materialien.',fivem:'Welche Art von Asset brauchst du? Die Verfügbarkeit klären wir im Ticket.',bot:'Beschreibe die gewünschten Funktionen für deine Community.',bundle:'Welche Designs sollen in deinem Paket enthalten sein?','soundpack-tool':'Wähle deine Laufzeit. Kauf und Zugang klären wir in deinem Bestellticket.',partnership:'Erzähl uns von deinem Projekt, eurer Community und deiner Idee für eine Zusammenarbeit.'};
function updateBriefProduct(){
  if(!briefProduct)return;const product=briefProduct.value;
  const hint=document.getElementById('brief-product-hint');if(hint)hint.textContent=briefHints[product]||'';
  const planField=document.getElementById('brief-plan-field');if(planField)planField.hidden=product!=='soundpack-tool';
  if(product==='soundpack-tool')updateToolPlan(briefPlan?.value||'lifetime');
  if(product!=='thumbnail'&&briefReference){briefReference=null;renderBriefReference();}
  const finalStep=document.querySelector('.request-steps li:last-child');
  if(finalStep){finalStep.querySelector('strong').textContent=product==='partnership'?'Partnerschaft anfragen':'Bestellticket öffnen';finalStep.querySelector('p').textContent=product==='partnership'?'Deine Idee an unser Team senden.':'Details mit uns im privaten Ticket abstimmen.';}
  updateBriefSummary();
  updateRequestButton();
}
function chooseBriefProduct(key){
  if(requestBusy||!briefProduct)return;
  if([...briefProduct.options].some(option=>option.value===key)){briefProduct.value=key;briefProduct.dispatchEvent(new Event('change',{bubbles:true}));briefForm?.dispatchEvent(new Event('input',{bubbles:true}));}
  if(viewer?.open)viewer.close();location.hash='anfrage';document.getElementById('anfrage')?.scrollIntoView({behavior:reducedMotion.matches?'auto':'smooth',block:'start'});document.getElementById('brief-project')?.focus({preventScroll:true});
}
function selectBriefReference(item){if(!item||requestBusy)return;chooseBriefProduct('thumbnail');briefReference={image:item.image,messageUrl:item.messageUrl};renderBriefReference();briefForm?.dispatchEvent(new Event('input',{bubbles:true}));}
document.querySelectorAll('[data-brief-product]').forEach(link=>link.addEventListener('click',event=>{event.preventDefault();chooseBriefProduct(link.dataset.briefProduct);}));
document.querySelectorAll('[data-tool-plan]').forEach(button=>button.addEventListener('click',()=>{updateToolPlan(button.dataset.toolPlan);briefPlan?.dispatchEvent(new Event('change',{bubbles:true}));}));
document.querySelectorAll('[data-order-product]').forEach(link=>link.addEventListener('click',event=>{
  event.preventDefault();updateToolPlan(link.dataset.orderPlan||'lifetime');chooseBriefProduct(link.dataset.orderProduct);
  const project=document.getElementById('brief-project');if(project&&!project.value.trim()){project.value=`Ich möchte das Soundpack Tool mit der Laufzeit ${planInfo[briefPlan?.value||'lifetime'].label} bestellen.`;project.dispatchEvent(new Event('input',{bubbles:true}));}
}));
viewer?.querySelector('#viewer-reference')?.addEventListener('click',()=>{const item=previews[selectedPreview];returnFocus=document.getElementById('brief-project');viewer.close();selectBriefReference(item);});
document.getElementById('brief-reference-remove')?.addEventListener('click',()=>{if(requestBusy)return;briefReference=null;renderBriefReference();briefForm?.dispatchEvent(new Event('input',{bubbles:true}));});
briefProduct?.addEventListener('change',updateBriefProduct);briefPlan?.addEventListener('change',()=>updateToolPlan(briefPlan.value));
const mobileRequest=document.querySelector('.mobile-request');if(mobileRequest&&document.getElementById('anfrage')&&'IntersectionObserver' in window)new IntersectionObserver(entries=>{mobileRequest.hidden=entries.some(e=>e.isIntersecting);},{rootMargin:'-82px 0px 0px 0px'}).observe(document.getElementById('anfrage'));

function rememberLoginDraft(){
  if(!briefProduct)return;try{sessionStorage.setItem('turbo-login-draft',JSON.stringify({at:Date.now(),product:briefProduct.value,plan:briefPlan?.value||'lifetime',project:document.getElementById('brief-project').value,deadline:document.getElementById('brief-deadline').value,assets:document.getElementById('brief-assets').value,reference:briefReference}));}catch{}
}
function updateRequestButton(){
  if(!requestSend)return;const partnership=briefProduct?.value==='partnership';
  document.querySelectorAll('[data-tool-plan]').forEach(button=>button.disabled=requestBusy);
  requestSend.disabled=requestBusy||requestSent||Boolean(discordAccount&&requestChecking);
  requestSend.textContent=requestBusy?(partnership?'Deine Anfrage wird gesendet …':'Dein Ticket wird erstellt …'):requestSent?(partnership?'Anfrage gesendet ✓':'Ticket erstellt ✓'):!discordAccount?'Mit Discord anmelden ↗':requestChecking?'Bitte kurz warten …':partnership?'Partnerschaft anfragen ↗':'Bestellticket öffnen ↗';
  requestSend.setAttribute('aria-busy',String(requestBusy||Boolean(discordAccount&&requestChecking)));
}
async function checkRequestConnection(){
  if(!requestSend||!discordAccount)return;if(requestChecking)return requestChecking;
  requestReady=false;requestToken=null;
  requestChecking=(async()=>{
    try{
      const response=await fetch('/api/discord-requests/status',{cache:'no-store',signal:AbortSignal.timeout(15000)}),data=await response.json();
      if(data.loginRequired){discordAccount=null;await loadDiscordAccount();return;}
      if(!response.ok||data.ready!==true||typeof data.token!=='string')throw new Error('Unavailable');
      requestToken=data.token;await new Promise(resolve=>setTimeout(resolve,3000));requestReady=true;
    }catch{requestReady=false;}
  })();updateRequestButton();try{await requestChecking;}finally{requestChecking=null;updateRequestButton();}
}
async function loadDiscordAccount(){
  const panel=document.getElementById('discord-login');if(!panel)return;
  try{
    const response=await fetch('/api/discord-account',{cache:'no-store',signal:AbortSignal.timeout(10000)});if(!response.ok)throw new Error();const data=await response.json();discordAccount=data.user;
    const contact=document.getElementById('brief-contact');contact.readOnly=true;contact.value=discordAccount?.username||'';
    document.getElementById('discord-login-link').hidden=Boolean(discordAccount);document.getElementById('discord-logout').hidden=!discordAccount;
    document.getElementById('discord-account').textContent=discordAccount?`Hallo ${discordAccount.username}. Dein Ticket wird deinem Konto zugeordnet.`:'Melde dich mit Discord an, um dein persönliches Ticket zu öffnen.';
    if(discordAccount&&!requestChecking)checkRequestConnection();
  }catch{discordAccount=null;document.getElementById('discord-account').textContent='Melde dich mit Discord an, um zu bestellen.';}
  updateRequestButton();
}
document.getElementById('discord-login-link')?.addEventListener('click',rememberLoginDraft);
document.getElementById('discord-logout')?.addEventListener('click',async()=>{
  if(requestBusy)return;const button=document.getElementById('discord-logout');button.disabled=true;
  try{const response=await fetch('/auth/discord/logout',{method:'POST',signal:AbortSignal.timeout(10000)});if(!response.ok)throw new Error();discordAccount=null;requestReady=false;requestToken=null;await loadDiscordAccount();}
  catch{document.getElementById('request-status').textContent='Abmelden ist gerade nicht möglich. Versuche es erneut.';}finally{button.disabled=false;}
});
if(briefForm){
  const output=document.getElementById('brief-output'),copy=document.getElementById('brief-copy'),status=document.getElementById('brief-status');
  // The summary follows the fields automatically; a ticket still needs its explicit button action.
  briefForm.addEventListener('submit',event=>{event.preventDefault();updateBriefSummary();});
  copy?.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(output.value);status.textContent='Text kopiert.';}catch{output.focus();output.select();status.textContent='Kopiere den markierten Text mit Strg+C.';}});
  const handleBriefChange=event=>{
    event.target?.removeAttribute?.('aria-invalid');if(event.target?.getAttribute?.('aria-describedby')==='request-status')event.target.removeAttribute('aria-describedby');
    if(status)status.textContent='';
    updateBriefSummary();
    if(!requestBusy&&(requestSent||requestAttempted)){
      requestSent=false;requestAttempted=false;requestReady=false;requestToken=null;
      const requestStatus=document.getElementById('request-status');if(requestStatus){requestStatus.textContent='';requestStatus.className='';}
      const receipt=document.querySelector('.result-actions');if(receipt)receipt.hidden=true;
      updateRequestButton();checkRequestConnection();
    }
  };
  briefForm.addEventListener('input',handleBriefChange);
  briefForm.addEventListener('change',handleBriefChange);
}
document.getElementById('brief-consent')?.addEventListener('change',event=>event.target.removeAttribute('aria-invalid'));
requestSend?.addEventListener('click',async()=>{
  if(requestBusy||requestSent||requestChecking)return;
  if(!discordAccount){rememberLoginDraft();location.assign('/auth/discord');return;}
  const status=document.getElementById('request-status'),project=document.getElementById('brief-project'),consent=document.getElementById('brief-consent');
  const error=(message,field)=>{status.className='request-error';status.textContent=message;if(field){field.setAttribute('aria-invalid','true');field.setAttribute('aria-describedby','request-status');field.focus();}};
  if(!project.value.trim())return error('Beschreibe kurz deine Idee oder deinen Bestellwunsch.',project);
  if(!consent.checked)return error('Bestätige, dass du deine Angaben senden möchtest.',consent);
  if(!requestReady){await checkRequestConnection();if(!requestReady)return error('Dein Ticket konnte noch nicht geöffnet werden. Versuche es erneut.');}
  const payload={token:requestToken,product:briefProduct.value,...(briefProduct.value==='soundpack-tool'?{plan:briefPlan.value}:{}),project:project.value.trim(),deadline:document.getElementById('brief-deadline').value.trim(),assets:document.getElementById('brief-assets').value.trim(),consent:true,reference:briefReference?.messageUrl||'',website:document.getElementById('brief-website').value};
  requestBusy=true;requestAttempted=true;updateRequestButton();
  const locked=[...briefForm.querySelectorAll('input,select,textarea,button'),consent,document.getElementById('discord-logout')].filter(Boolean).map(field=>({field,disabled:field.disabled}));locked.forEach(x=>x.field.disabled=true);
  let ticketWindow;try{if(payload.product!=='partnership')ticketWindow=window.open('about:blank','_blank');if(ticketWindow){ticketWindow.opener=null;ticketWindow.document.title='Dein Discord-Ticket';ticketWindow.document.body.textContent='Dein Ticket wird geöffnet …';}}catch{}
  status.className='';status.textContent=payload.product==='partnership'?'Deine Anfrage wird gesendet …':'Dein Ticket wird erstellt …';
  try{
    const response=await fetch('/api/discord-requests',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(25000)}),data=await response.json();
    if(!response.ok||data.ok!==true){
      if(data.error==='AUTH_REQUIRED'){discordAccount=null;requestReady=false;await loadDiscordAccount();throw new Error('Melde dich erneut mit Discord an.');}
      if(data.error==='JOIN_REQUIRED'){const link=document.getElementById('brief-discord');link.href='https://discord.gg/turbodesigns';link.textContent='Turbo Designs Discord beitreten ↗';link.parentElement.hidden=false;document.getElementById('brief-copy').hidden=true;throw new Error('Tritt zuerst unserem Discord bei und öffne dein Ticket danach erneut.');}
      if(data.error==='RATE_LIMIT')throw new Error('Du hast bereits mehrere Tickets geöffnet. Warte bitte etwas.');
      if(data.error==='ORDER_BUSY')throw new Error('Deine Bestellung wird bereits erstellt. Bitte warte kurz und versuche es erneut.');
      if(data.error==='ORDER_CLOSED')throw new Error('Dieses Bestellticket wurde bereits geschlossen. Ändere deine Angaben, um eine neue Bestellung anzufragen.');
      if(data.error==='ORDER_EXISTS'){
        if(/^https:\/\/discord\.com\/channels\/1531989453168578650\/\d{17,20}$/.test(data.ticketUrl||'')){const link=document.getElementById('brief-discord');link.href=data.ticketUrl;link.textContent='Bestehendes Bestellticket öffnen ↗';link.parentElement.hidden=false;document.getElementById('brief-copy').hidden=true;}
        throw new Error('Du hast bereits ein offenes Bestellticket. Besprich deine weitere Bestellung dort mit uns.');
      }
      if(data.error==='SHOP_CLOSED')throw new Error('Wir nehmen gerade keine neuen Bestellungen an. Versuche es später erneut.');
      if(data.error==='PRODUCT_UNAVAILABLE')throw new Error('Dieses Angebot ist gerade nicht verfügbar. Wähle ein anderes Produkt.');
      if(data.error==='BLACKLISTED')throw new Error('Deine Anfrage konnte nicht angenommen werden. Wende dich an unseren Support.');
      if(data.error==='EXPIRED_TOKEN'){await checkRequestConnection();throw new Error('Versuche es erneut. Deine Angaben sind erhalten.');}
      throw new Error('Dein Ticket konnte nicht geöffnet werden. Versuche es erneut.');
    }
    if(payload.product==='partnership'&&data.requestType==='partnership'){
      requestSent=true;status.className='request-success';status.textContent='Deine Partnerschaftsanfrage wurde gesendet. Unser Team meldet sich im Discord bei dir.';document.querySelector('.result-actions').hidden=true;return;
    }
    if(!/^https:\/\/discord\.com\/channels\/1531989453168578650\/\d{17,20}$/.test(data.ticketUrl||''))throw new Error('Dein Ticket konnte nicht geöffnet werden. Versuche es erneut.');
    requestSent=true;status.className='request-success';status.textContent='Dein privates Ticket ist geöffnet.';
    const link=document.getElementById('brief-discord');link.href=data.ticketUrl;link.textContent='Dein Ticket im Discord öffnen ↗';link.parentElement.hidden=false;document.getElementById('brief-copy').hidden=true;
    if(ticketWindow&&!ticketWindow.closed)ticketWindow.location.href=data.ticketUrl;
  }catch(e){if(ticketWindow&&!ticketWindow.closed)ticketWindow.close();error(e.name==='TimeoutError'?'Die Antwort dauert länger. Versuche es erneut; deine Bestellung wird nicht doppelt angelegt.':e.message);}
  finally{locked.forEach(x=>x.field.disabled=x.disabled);requestBusy=false;updateRequestButton();}
});
try{
  const raw=sessionStorage.getItem('turbo-login-draft');sessionStorage.removeItem('turbo-login-draft');const draft=raw?JSON.parse(raw):null;
  if(draft&&Date.now()-draft.at>=0&&Date.now()-draft.at<900000&&briefProduct){
    if([...briefProduct.options].some(o=>o.value===draft.product))briefProduct.value=draft.product;
    if(briefPlan&&Object.hasOwn(planInfo,draft.plan))briefPlan.value=draft.plan;
    for(const [key,max]of[['project',1500],['deadline',100],['assets',300]])if(typeof draft[key]==='string')document.getElementById('brief-'+key).value=draft[key].slice(0,max);
    if(/^https:\/\/discord\.com\/channels\/1531989453168578650\/1550470150086729748\/\d{17,20}$/.test(draft.reference?.messageUrl||'')){
      const url=new URL(draft.reference.image),curation=window.TurboGalleryCuration;
      if(url.protocol==='https:'&&['cdn.discordapp.com','media.discordapp.net'].includes(url.hostname)&&url.pathname.startsWith('/attachments/')&&!curation?.excludedStableIds.includes(curation.stablePreviewId(draft.reference))){briefReference=draft.reference;renderBriefReference();}
    }
  }
}catch{}
const loginResult=new URLSearchParams(location.search).get('discord');
if(['failed','cancelled','unavailable'].includes(loginResult)){
  const status=document.getElementById('request-status');if(status)status.textContent=loginResult==='cancelled'?'Anmeldung abgebrochen. Melde dich mit Discord an, um zu bestellen.':'Die Anmeldung konnte nicht abgeschlossen werden. Versuche es erneut.';
  history.replaceState(null,'',location.pathname+'#anfrage');
}
updateBriefProduct();loadDiscordAccount();syncDiscord();
setInterval(()=>{if(!document.hidden)syncDiscord();},60000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)syncDiscord();});
