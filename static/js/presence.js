const root = document.getElementById('townsquare-root');
const retry = document.getElementById('townsquare-retry');
let loading = false;
let mounted = false;
let stylePromise;
let attempts = 0;

function loadStyles() {
  if (stylePromise) return stylePromise;
  stylePromise = new Promise((resolve, reject) => {
    const sheet = document.createElement('link');
    sheet.rel = 'stylesheet';
    sheet.href = 'https://townsquare.cauenapier.com/widget.css';
    const timeout = setTimeout(() => { sheet.remove(); reject(new Error('Styles timed out')); }, 12000);
    sheet.onload = () => { clearTimeout(timeout); resolve(); };
    sheet.onerror = () => { clearTimeout(timeout); sheet.remove(); reject(new Error('Styles unavailable')); };
    document.head.append(sheet);
  }).catch(error => { stylePromise = null; throw error; });
  return stylePromise;
}

async function mount() {
  if (loading || mounted) return;
  loading = true;
  retry.hidden = true;
  try {
    const [module] = await Promise.all([
      // A new URL lets an explicit retry recover from a cached module failure.
      import(`https://townsquare.cauenapier.com/townsquare.mjs${attempts++ ? '?retry=' + attempts : ''}`), loadStyles(),
    ]);
    root.dataset.townsquareTheme = document.documentElement.dataset.theme;
    module.mountTownSquare(root, {
      serverOrigin: 'https://townsquare.cauenapier.com',
      siteKey: 'site_5uzYK6UdzyWi8nd0',
      scene: { benches: 2, benchXs: [0.2, 0.72], trees: 1, treeXs: [0.8], lamps: 1, lampXs: [0.12], birds: 3 },
      theme: 'host',
    });
    mounted = true;
  } catch {
    retry.hidden = false;
  } finally {
    loading = false;
  }
}

retry.addEventListener('click', mount);
if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting)) { observer.disconnect(); mount(); }
  }, { rootMargin: '200px' });
  observer.observe(root);
} else {
  retry.hidden = false;
}
