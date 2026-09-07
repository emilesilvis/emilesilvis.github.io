// Only a deliberate choice overrides the system theme. Storage is optional.
(() => {
  const system = window.matchMedia('(prefers-color-scheme: dark)');
  let choice;
  function readChoice() {
    try { choice = localStorage.getItem('theme'); } catch { /* Keep the session choice. */ }
    if (choice !== 'light' && choice !== 'dark') choice = null;
  }
  function apply() {
    const theme = choice || (system.matches ? 'dark' : 'light');
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    const button = document.getElementById('theme-toggle');
    if (button) {
      const label = `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`;
      button.setAttribute('aria-label', label);
      button.title = label;
      const icon = document.getElementById('theme-icon');
      if (icon) icon.textContent = theme === 'dark' ? '☀️' : '🌙';
    }
    const widget = document.getElementById('townsquare-root');
    if (widget) widget.dataset.townsquareTheme = theme;
  }
  readChoice();
  apply();
  document.addEventListener('DOMContentLoaded', () => {
    apply();
    document.getElementById('theme-toggle')?.addEventListener('click', () => {
      choice = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem('theme', choice); } catch { /* The toggle still works. */ }
      apply();
    });
  });
  system.addEventListener('change', apply);
  window.addEventListener('storage', event => {
    if (event.key === 'theme' || event.key === null) { readChoice(); apply(); }
  });
})();
