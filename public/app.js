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
    if (element.getBoundingClientRect().top > window.innerHeight) element.classList.add('motion-pending');
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
updateScroll();
