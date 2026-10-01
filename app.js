const header = document.querySelector('.site-header');
const menuBtn = document.querySelector('.menu-button');
const navLinks = document.querySelector('.nav-links');

const updateHeader = () => header?.classList.toggle('scrolled', window.scrollY > 10);
updateHeader();
window.addEventListener('scroll', updateHeader, { passive: true });

menuBtn?.addEventListener('click', () => {
  const open = navLinks.classList.toggle('open');
  document.body.classList.toggle('menu-open', open);
  menuBtn.setAttribute('aria-expanded', String(open));
});

document.querySelectorAll('.nav-links a').forEach(a => a.addEventListener('click', () => {
  navLinks?.classList.remove('open');
  document.body.classList.remove('menu-open');
}));

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: .12 });
document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

document.querySelectorAll('.faq-q').forEach(btn => {
  btn.addEventListener('click', () => {
    const item = btn.closest('.faq-item');
    item.classList.toggle('open');
  });
});

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const name = tab.dataset.tab;
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t === tab));
    document.querySelectorAll('.preview-panel').forEach(p => p.classList.toggle('active', p.dataset.panel === name));
  });
});

// Decorative waveform heights are deterministic to avoid layout jumps.
document.querySelectorAll('.wave i, .audio-lines i').forEach((bar, index) => {
  const values = [32,54,75,43,88,61,37,81,49,68,91,44,72,58,83,39,65,95,52,76,47,86,57,70];
  bar.style.height = `${values[index % values.length]}%`;
});
