// Share the main site's existing preference, including when another tab changes it.
(() => {
  const system = window.matchMedia('(prefers-color-scheme: dark)');
  function applyTheme() {
    let saved;
    try { saved = localStorage.getItem('theme'); } catch { /* Storage may be disabled. */ }
    const theme = saved === 'dark' || saved === 'light' ? saved : system.matches ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
  }
  applyTheme();
  system.addEventListener('change', applyTheme);
  window.addEventListener('storage', event => { if (event.key === 'theme' || event.key === null) applyTheme(); });
})();
