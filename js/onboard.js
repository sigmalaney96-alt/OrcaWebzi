// onboard.js — install prompt + platform detection for /onboard
(function () {
  const btn = document.getElementById('install-btn');
  const note = document.getElementById('install-note');
  let deferred = null;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
    btn.hidden = false;
    note.textContent = 'Your browser can install Orca right now — one tap:';
  });

  btn.addEventListener('click', async () => {
    if (!deferred) return;
    deferred.prompt();
    const { outcome } = await deferred.userChoice;
    deferred = null;
    btn.hidden = true;
    note.textContent = outcome === 'accepted'
      ? '🎉 Installing! Look for the Orca icon on your home screen or app list.'
      : 'No problem — use the manual steps below anytime.';
  });

  window.addEventListener('appinstalled', () => {
    note.textContent = '🎉 Orca Orca Web is installed! Find the icon on your home screen.';
    btn.hidden = true;
  });

  // highlight the card matching the visitor's platform
  const ua = navigator.userAgent;
  let platform = 'desktop';
  if (/android/i.test(ua)) platform = 'android';
  else if (/iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) platform = 'ios';
  document.querySelectorAll('.step-card').forEach((c) => {
    c.classList.toggle('recommended', c.dataset.platform === platform);
  });

  // already running installed?
  if (window.matchMedia('(display-mode: standalone)').matches || navigator.standalone) {
    note.textContent = '✅ You’re already running the installed app!';
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
  }
})();
