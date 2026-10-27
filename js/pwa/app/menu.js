// app/menu.js — the ⋮ app menu (Chrome Android parity)
import { DB, saveSoon } from '../core/store.js';
import { $, el, icon, isInternal, copyText } from '../core/utils.js';
import { snackbar, modal } from '../core/ui.js';
import { Tabs } from './tabs.js';
import { navigate, reloadTab, currentEntry } from './views.js';
import { openFindBar } from './findinpage.js';
import { openShare } from './share.js';
import { sendTabToSelf } from './sync.js';
import { Downloads } from './downloads.js';

let menuEl;
let open = false;

export function initMenu() {
  menuEl = $('#menu-pop');
  $('#btn-menu').addEventListener('click', (e) => { e.stopPropagation(); toggleMenu(); });
  document.addEventListener('pointerdown', (e) => {
    if (open && !menuEl.contains(e.target) && e.target.id !== 'btn-menu') closeMenu();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });
}

export function closeMenu() { open = false; menuEl.classList.remove('open'); }

function toggleMenu() {
  if (open) return closeMenu();
  buildMenu();
  menuEl.classList.add('open');
  open = true;
}

function buildMenu() {
  const tab = Tabs.active();
  const entry = tab ? currentEntry(tab) : null;
  const url = entry?.url || 'orca://newtab';
  const isBm = entry && DB.bookmarks.some((b) => b.type === 'bm' && b.url === url);
  const incogCount = Tabs.incogTabs.length;

  menuEl.innerHTML = '';
  const add = (node) => menuEl.append(node);
  const hr = () => add(el('div', { class: 'mhr' }));
  const item = (label, ic, onClick, opts = {}) => {
    const b = el('button', { class: 'mi' + (opts.checked ? ' checked' : '') + (opts.danger ? ' danger' : '') },
      ic ? icon(ic) : null,
      el('span', { class: 'grow' }, label),
      opts.badge ? el('span', { class: 'badge' }, opts.badge) : null,
      icon('check', 'tick'));
    if (!opts.checkbox) b.querySelector('.tick').style.display = 'none';
    b.addEventListener('click', () => { closeMenu(); onClick?.(); });
    add(b);
  };

  item('New tab', 'add', () => Tabs.create({}));
  item('New incognito tab', 'incognito', () => Tabs.create({ incognito: true }), incogCount ? { badge: String(incogCount) } : {});
  hr();
  item(isBm ? '★ Bookmarked — edit' : 'Bookmark this tab', 'bookmark', () => toggleBookmark(tab));
  item('Bookmarks', 'bookmarkBorder', () => navigate(tab, 'orca://bookmarks'));
  item('Recent tabs', 'devices', () => navigate(tab, 'orca://recent'));
  item('History', 'history', () => navigate(tab, 'orca://history'));
  item('Downloads', 'download', () => navigate(tab, 'orca://downloads'));
  hr();
  item('Share…', 'share', () => openShare(tab));
  item('Find in page', 'find', () => openFindBar());
  item('Translate…', 'translate', () => translateBar(tab));
  item('Reader mode', 'reader', () => toggleReader(tab), { checkbox: true, checked: !!tab?.reader });
  hr();
  item('Add to Home screen', 'install', () => installApp());
  item('Save page offline', 'offline', () => saveOffline(tab));
  item('Desktop site', 'desktop', () => toggleDesktop(tab), { checkbox: true, checked: !!tab?.desktop });
  item('Picture in picture', 'pip', () => pip(tab));
  item('Cast…', 'cast', () => snackbar('No cast devices found nearby (demo placeholder)'));
  item('Fullscreen', 'fullscreen', () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.().catch(() => snackbar('Fullscreen unavailable'));
  });
  hr();
  item('Zoom in', 'zoomIn', () => zoom(tab, 0.25));
  item('Zoom out', 'zoomOut', () => zoom(tab, -0.25));
  item('Open in browser', 'openNew', () => { if (url.startsWith('http')) window.open(url, '_blank', 'noopener'); else snackbar('Internal pages live inside Orca'); });
  hr();
  item('Settings', 'settings', () => navigate(tab, 'orca://settings'));
  item('Help & feedback', 'help', () => navigate(tab, 'orca://help'));
}

function zoom(tab, d) {
  if (!tab) return;
  import('./views.js').then(({ setZoom }) => {
    setZoom(tab, tab.zoom + d);
    snackbar(`Zoom: ${Math.round(tab.zoom * 100)}%`, { duration: 1500 });
  });
}

function toggleBookmark(tab) {
  if (!tab) return;
  const entry = currentEntry(tab);
  if (!entry) return;
  const existing = DB.bookmarks.find((b) => b.type === 'bm' && b.url === entry.url);
  if (existing) {
    DB.bookmarks = DB.bookmarks.filter((b) => b !== existing);
    saveSoon();
    snackbar('Bookmark removed', { action: 'Undo', onAction: () => { DB.bookmarks.push(existing); saveSoon(); } });
  } else {
    DB.bookmarks.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), type: 'bm', title: tab.title || entry.url, url: entry.url, parentId: null, order: DB.bookmarks.length });
    saveSoon();
    snackbar('Bookmark added', { action: 'Edit', onAction: () => navigate(tab, 'orca://bookmarks') });
  }
}

function toggleDesktop(tab) {
  if (!tab) return;
  tab.desktop = !tab.desktop;
  const entry = currentEntry(tab);
  if (entry?.type === 'web') {
    // reload through the normal path so layout switches cleanly
    import('./views.js').then((v) => { v.renderTab(tab); v.progressStart(); setTimeout(v.progressDone, 700); });
  }
  snackbar(tab.desktop ? 'Desktop site on for this tab' : 'Desktop site off');
  Tabs.emit('update');
}

function toggleReader(tab) {
  if (!tab) return;
  const entry = currentEntry(tab);
  tab.reader = !tab.reader;
  if (entry && (entry.url.startsWith('orca://article/') || entry.type === 'internal')) {
    import('./views.js').then((v) => v.renderTab(tab));
  } else {
    snackbar('Reader mode is available on articles and Orca pages');
    tab.reader = false;
  }
  Tabs.emit('update');
}

function translateBar(tab) {
  if (!tab) return;
  const bar = $('#translate-bar');
  const sel = el('select', {}, DB.settings.translateTargets.map((c) => el('option', { value: c }, new Intl.DisplayNames(['en'], { type: 'language' }).of(c))));
  bar.innerHTML = '';
  bar.append(
    icon('translate'),
    el('span', { class: 'grow' }, 'Translate this page into'),
    sel,
    el('button', {
      class: 'ibtn', onclick: () => {
        const entry = currentEntry(tab);
        bar.classList.remove('open'); bar.style.display = 'none';
        if (entry?.url.startsWith('http')) {
          navigate(tab, `https://translate.google.com/translate?sl=auto&tl=${sel.value}&u=${encodeURIComponent(entry.url)}`);
        } else {
          snackbar('This page is already in your language (demo)');
        }
      },
    }, 'Translate'),
    el('button', { class: 'ibtn x', onclick: () => { bar.classList.remove('open'); bar.style.display = 'none'; } }, '✕'),
  );
  bar.classList.add('infobar');
  bar.style.display = 'flex';
  bar.classList.add('open');
}

function saveOffline(tab) {
  const entry = currentEntry(tab);
  if (!entry) return;
  if (entry.url.startsWith('orca://article/')) {
    const id = entry.url.split('/').pop();
    import('./feed.js').then(({ getArticle }) => {
      const a = getArticle(id);
      if (!a) return;
      if (DB.offline.some((o) => o.url === entry.url)) { snackbar('Already saved for offline'); return; }
      DB.offline.push({ id: Date.now().toString(36), url: entry.url, title: a.title, time: Date.now(), size: a.body.join(' ').length });
      saveSoon();
      snackbar('Saved for offline reading', { action: 'View', onAction: () => navigate(tab, 'orca://offline') });
    });
    return;
  }
  if (entry.type === 'web') {
    snackbar('Saving external pages requires the site to allow it. Articles from your feed save fully offline.');
    return;
  }
  snackbar('This page is part of the app — already available offline.');
}

async function installApp() {
  const promptEvt = window.__orcaInstallPrompt;
  if (promptEvt) {
    promptEvt.prompt();
    const { outcome } = await promptEvt.userChoice;
    window.__orcaInstallPrompt = null;
    snackbar(outcome === 'accepted' ? 'Installing Orca…' : 'Install dismissed — see orca.app/onboard anytime');
  } else {
    window.open('/onboard', '_blank');
    snackbar('Opened the install guide — follow the steps for your device');
  }
}

async function pip(tab) {
  try {
    const doc = tab?.iframe?.contentDocument;
    const video = doc?.querySelector('video');
    if (video && document.pictureInPictureEnabled) {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await video.requestPictureInPicture();
      return;
    }
  } catch { /* cross-origin */ }
  snackbar('No video on this page (or the site blocks PiP). Try a page with a <video>.');
}
