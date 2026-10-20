// Standalone controls: no network requests, no Supabase dependency.
(() => {
  const byId = id => document.getElementById(id);
  const themeBtn = byId('themeBtn');
  const accountBtn = byId('accountBtn');
  const accountDialog = byId('accountDialog');
  const key = 'elgabry_theme';
  function savedTheme() { try { return localStorage.getItem(key); } catch { return null; } }
  function setTheme(mode) {
    const dark = mode === 'dark';
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    themeBtn.textContent = dark ? '☀️ الوضع النهاري' : '🌙 الوضع الليلي';
    themeBtn.setAttribute('aria-pressed', String(dark));
    try { localStorage.setItem(key, dark ? 'dark' : 'light'); } catch {}
  }
  setTheme(savedTheme() || (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  themeBtn.addEventListener('click', () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));
  accountBtn.addEventListener('click', () => {
    if (!accountDialog.open) accountDialog.showModal();
  });
})();
