(() => {
  const nav = document.querySelector('.site-nav');
  if (!nav || nav.dataset.navigationReady === 'true') return;
  nav.dataset.navigationReady = 'true';

  const toggle = nav.querySelector('.nav-toggle');
  const menu = nav.querySelector('#site-menu');
  const dropdowns = [...nav.querySelectorAll('.nav-dropdown')];
  const closeAll = () => {
    dropdowns.forEach((dropdown) => { dropdown.open = false; });
    menu.classList.remove('open');
    document.body.classList.remove('nav-open');
    toggle.setAttribute('aria-expanded', 'false');
  };

  toggle.addEventListener('click', () => {
    const isOpen = menu.classList.toggle('open');
    document.body.classList.toggle('nav-open', isOpen);
    toggle.setAttribute('aria-expanded', String(isOpen));
  });
  dropdowns.forEach((dropdown) => dropdown.addEventListener('toggle', () => {
    if (dropdown.open) dropdowns.forEach((other) => { if (other !== dropdown) other.open = false; });
  }));
  nav.addEventListener('click', (event) => { if (event.target.closest('a')) closeAll(); });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') { closeAll(); toggle.focus(); } });
  matchMedia('(min-width: 1181px)').addEventListener('change', (event) => { if (event.matches) closeAll(); });
})();
