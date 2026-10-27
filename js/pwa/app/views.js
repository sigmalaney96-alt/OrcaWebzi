// app/views.js — content rendering & navigation engine
import { DB, saveSoon, uid, setting } from '../core/store.js';
import { $, el, normalizeUrl, looksLikeUrl, searchUrl, isInternal, hostOf, originOf, icon } from '../core/utils.js';
import { Tabs } from './tabs.js';

/* Known-dangerous demo hosts for Safe Browsing interstitials */
export const BLOCKED_HOSTS = new Set([
  'testsafebrowsing.appspot.com',
  'malware.testing.google.test',
  'phishing.test',
  'orca-malware-demo.test',
]);
const AD_HOSTS = new Set(['ads.example.com', 'doubleclick.net', 'adserver.test', 'orca-ads-demo.test']);

let contentEl, progressBar;
let progressTimer = null;

export function initViews() {
  contentEl = $('#content');
  progressBar = $('#progress .bar');
  Tabs.onChange(() => syncActiveView());
}

export function engineTemplate() {
  const s = DB.settings;
  if (s.engine === 'custom' && s.customEngines[s.activeCustom ?? 0]) return s.customEngines[s.activeCustom ?? 0].url;
  const custom = s.customEngines.find((e) => e.id === s.engine);
  if (custom) return custom.url;
  const builtin = { google: 'https://www.google.com/search?q=%s', bing: 'https://www.bing.com/search?q=%s', duckduckgo: 'https://duckduckgo.com/?q=%s', yahoo: 'https://search.yahoo.com/search?p=%s', ecosia: 'https://www.ecosia.org/search?q=%s' };
  return builtin[s.engine] || builtin.google;
}
export function engineName() {
  const s = DB.settings;
  const custom = s.customEngines.find((e) => e.id === s.engine);
  if (custom) return custom.name;
  return { google: 'Google', bing: 'Bing', duckduckgo: 'DuckDuckGo', yahoo: 'Yahoo', ecosia: 'Ecosia' }[s.engine] || 'Google';
}

/* ---------------- history ---------------- */
export function recordHistory(url, title) {
  if (!url || isInternal(url)) return;
  DB.history.unshift({ id: uid(), url, title: title || url, time: Date.now() });
  if (DB.history.length > 2000) DB.history.length = 2000;
  saveSoon();
}

export function mostVisited(limit = 8) {
  const counts = new Map();
  for (const h of DB.history) {
    if (!h.url.startsWith('http')) continue;
    const key = originOf(h.url);
    const cur = counts.get(key) || { count: 0, title: h.title, url: key + '/' };
    cur.count++;
    counts.set(key, cur);
  }
  const tiles = [...counts.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, limit)
    .map(([origin, v]) => ({ url: origin + '/', title: hostOf(origin).replace(/^www\./, '') }));
  return tiles;
}

/* ---------------- progress bar ---------------- */
export function progressStart() {
  clearInterval(progressTimer);
  let v = 0;
  progressBar.style.opacity = '1';
  progressBar.style.width = '0%';
  progressTimer = setInterval(() => {
    v += (80 - v) * 0.12;
    progressBar.style.width = Math.min(v, 80) + '%';
  }, 120);
}
export function progressDone() {
  clearInterval(progressTimer);
  progressBar.style.width = '100%';
  setTimeout(() => { progressBar.style.opacity = '0'; setTimeout(() => { progressBar.style.width = '0%'; }, 350); }, 180);
}

/* ---------------- navigation ---------------- */
export function navigate(tab, input, opts = {}) {
  if (!tab) return;
  let url = input.trim();
  if (!url) return;
  if (!isInternal(url)) {
    url = looksLikeUrl(url) ? normalizeUrl(url) : searchUrl(engineTemplate(), url);
  }
  if (!looksLikeUrl(url) && !isInternal(url)) url = searchUrl(engineTemplate(), url);

  const entry = { url, type: 'web', title: tab.title };

  if (isInternal(url)) {
    entry.type = 'internal';
  } else if (DB.settings.safeBrowsing && BLOCKED_HOSTS.has(hostOf(url))) {
    entry.type = 'block';
  } else if (DB.settings.adBlock && AD_HOSTS.has(hostOf(url))) {
    entry.type = 'adblock';
  } else if (!navigator.onLine) {
    entry.type = 'error'; entry.kind = 'offline';
  }

  if (opts.replace && tab.sIndex >= 0) tab.stack[tab.sIndex] = entry;
  else {
    tab.stack = tab.stack.slice(0, tab.sIndex + 1);
    tab.stack.push(entry);
    tab.sIndex++;
  }
  if (entry.type === 'web' && !tab.incognito) recordHistory(url, null);
  renderTab(tab);
  Tabs.persist();
  Tabs.emit('navigate');
}

export function goBack(tab) {
  if (tab.sIndex > 0) {
    tab.sIndex--;
    renderTab(tab);
    Tabs.emit('navigate');
  }
}
export function goForward(tab) {
  if (tab.sIndex < tab.stack.length - 1) {
    tab.sIndex++;
    renderTab(tab);
    Tabs.emit('navigate');
  }
}
export function canBack(tab) { return tab && tab.sIndex > 0; }
export function canFwd(tab) { return tab && tab.sIndex < tab.stack.length - 1; }

export function reloadTab(tab) {
  const entry = tab.stack[tab.sIndex];
  if (!entry) return;
  if (entry.type === 'web') {
    if (!navigator.onLine) { entry.type = 'error'; entry.kind = 'offline'; renderTab(tab); Tabs.emit('navigate'); return; }
    progressStart();
    if (tab.iframe) { try { tab.iframe.contentWindow?.location.reload(); } catch { tab.iframe.src = entry.url; } }
    else renderTab(tab);
    setTimeout(progressDone, 1400);
  } else {
    renderTab(tab);
  }
}

/* ---------------- rendering ---------------- */
function ensureView(tab) {
  if (tab.el && tab.el.isConnected) return tab.el;
  const v = el('div', { class: 'tab-view', dataset: { tabId: tab.id } });
  tab.el = v;
  contentEl.append(v);
  return v;
}

export function syncActiveView() {
  const active = Tabs.active();
  for (const t of [...Tabs.tabs, ...Tabs.incogTabs]) {
    if (t.el) t.el.classList.toggle('active', t === active);
  }
  if (active && !active.el) renderTab(active);
  if (active) document.title = (active.title && active.title !== 'New tab' ? active.title + ' — ' : '') + (active.incognito ? 'Incognito · ' : '') + 'Orca Orca Web';
}

export function currentEntry(tab) { return tab.stack[tab.sIndex] || null; }

export function renderTab(tab) {
  const view = ensureView(tab);
  const entry = currentEntry(tab);
  view.innerHTML = '';
  tab.iframe = null;
  if (!entry) return;
  tab.url = entry.url;

  if (entry.type === 'internal') {
    import('./pages.js').then(({ renderInternal }) => {
      const host = el('div', { class: 'scroll-host' });
      host.append(renderInternal(tab, entry.url));
      view.innerHTML = ''; view.append(host);
      applyTabPrefs(tab);
      updateTitleFromInternal(tab, entry.url);
      Tabs.emit('update');
    });
    return;
  }

  if (entry.type === 'block') { view.append(interstitialEl(tab, entry, 'malware')); applyTabPrefs(tab); return; }
  if (entry.type === 'adblock') { view.append(interstitialEl(tab, entry, 'ad')); applyTabPrefs(tab); return; }
  if (entry.type === 'error') { view.append(errorEl(tab, entry)); applyTabPrefs(tab); return; }

  // web entry → iframe
  progressStart();
  view.classList.toggle('desktop-mode', tab.desktop);
  const frame = el('iframe', {
    class: 'webframe',
    src: entry.url,
    title: entry.url,
    sandbox: 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads allow-modals allow-presentation allow-pointer-lock',
    allow: 'geolocation; microphone; camera; fullscreen; picture-in-picture; clipboard-read; clipboard-write; midi; usb; serial',
    referrerpolicy: 'strict-origin-when-cross-origin',
  });
  tab.iframe = frame;
  let settled = false;
  const done = () => { if (!settled) { settled = true; progressDone(); } };
  frame.addEventListener('load', () => {
    done();
    // same-origin pages: harvest title + theme-color + hook context menu
    try {
      const doc = frame.contentDocument;
      const t = doc?.title;
      if (t && t !== tab.title) { tab.title = t; Tabs.emit('update'); }
      const theme = doc?.querySelector('meta[name="theme-color"]')?.content;
      if (theme) { tab.theme = theme; Tabs.emit('update'); }
    } catch { /* cross-origin */ }
  });
  frame.addEventListener('error', () => {
    entry.type = 'error'; entry.kind = 'dns';
    renderTab(tab); Tabs.emit('navigate');
  });
  view.append(frame);
  applyTabPrefs(tab);
  setTimeout(done, 6000); // never leave the bar stuck
}

function updateTitleFromInternal(tab, url) {
  const map = {
    'orca://newtab': 'New tab', 'orca://bookmarks': 'Bookmarks', 'orca://history': 'History',
    'orca://downloads': 'Downloads', 'orca://recent': 'Recent tabs', 'orca://passwords': 'Password manager',
    'orca://autofill': 'Addresses and more', 'orca://payments': 'Payment methods', 'orca://offline': 'Offline pages',
    'orca://about': 'About Orca', 'orca://help': 'Help & feedback', 'orca://licenses': 'Open-source licenses',
    'orca://demo': 'Feature demos', 'orca://site-data': 'Site storage',
  };
  tab.title = map[url] || (url.startsWith('orca://settings') ? 'Settings' : url.startsWith('orca://article/') ? (tab.title === 'New tab' ? 'Article' : tab.title) : url.startsWith('orca://reader') ? 'Reader' : url);
}

/* ---------------- zoom / reader / desktop ---------------- */
export function applyTabPrefs(tab) {
  if (!tab.el) return;
  const scale = tab.zoom * (DB.settings.textScale / 100);
  tab.el.style.zoom = String(scale);
  tab.el.classList.toggle('desktop-mode', !!tab.desktop);
  if (tab.desktop && tab.iframe) fitDesktopFrame(tab);
}
export function fitDesktopFrame(tab) {
  if (!tab.iframe || !tab.desktop) return;
  const w = tab.el.clientWidth || innerWidth;
  const target = 1200;
  const s = Math.min(1, w / target);
  tab.iframe.style.width = target + 'px';
  tab.iframe.style.transform = `scale(${s})`;
  tab.iframe.style.height = (100 / s) + '%';
}
export function clearDesktopFrame(tab) {
  if (!tab.iframe) return;
  tab.iframe.style.width = ''; tab.iframe.style.transform = ''; tab.iframe.style.height = '';
}
export function setZoom(tab, z) {
  tab.zoom = Math.min(2.5, Math.max(0.3, z));
  applyTabPrefs(tab);
  Tabs.emit('update');
}

/* ---------------- error pages & interstitials ---------------- */
function errorEl(tab, entry) {
  const kinds = {
    offline: { ic: 'wifiOff', code: 'ERR_INTERNET_DISCONNECTED', h: 'You’re offline', d: 'Check your connection and try again.' },
    dns: { ic: 'globe', code: 'ERR_NAME_NOT_RESOLVED', h: 'This site can’t be reached', d: 'Check the address for typos, or the site may be down.' },
    frame: { ic: 'lock', code: 'ERR_BLOCKED_BY_RESPONSE', h: 'This page can’t be shown here', d: 'The site refused to be displayed inside another app. You can open it in your browser instead.' },
    ssl: { ic: 'lock', code: 'ERR_SSL_PROTOCOL_ERROR', h: 'Your connection is not private', d: 'Attackers might be trying to steal your information.' },
  };
  const k = kinds[entry.kind] || kinds.dns;
  return el('div', { class: 'scroll-host' },
    el('div', { class: 'errpage' },
      el('div', {},
        el('div', { class: 'e-ic' }, icon(k.ic)),
        el('h2', {}, k.h),
        el('p', { class: 'host' }, entry.url),
        el('p', { class: 'code' }, k.code + ' · ' + k.d),
        el('div', { class: 'e-actions' },
          el('button', { class: 'btn-mat', onclick: () => { entry.type = 'web'; delete entry.kind; renderTab(tab); Tabs.emit('navigate'); } }, 'Reload'),
          el('button', { class: 'btn-mat ghost', onclick: () => window.open(entry.url, '_blank', 'noopener') }, 'Open externally'),
        ),
      )));
}

function interstitialEl(tab, entry, kind) {
  const isAd = kind === 'ad';
  return el('div', { class: 'scroll-host' },
    el('div', { class: 'errpage err-interstitial' },
      el('div', {},
        el('div', { class: 'e-ic' }, icon(isAd ? 'shield' : 'warn')),
        el('h2', {}, isAd ? 'Ad blocked' : 'Dangerous site'),
        el('p', { class: 'host' }, hostOf(entry.url)),
        el('p', { class: 'details' }, isAd
          ? 'Orca’s built-in ad blocker stopped this page from loading. You can disable the ad blocker in Settings → Site settings → Ads.'
          : 'Attackers on this site may trick you into installing software or revealing personal information. Orca Safe Browsing blocked this page.'),
        el('div', { class: 'e-actions' },
          el('button', { class: 'btn-mat', onclick: () => goBack(tab) }, 'Back to safety'),
          el('button', {
            class: 'btn-mat ghost',
            onclick: () => {
              entry.type = 'web';
              entry.bypassed = true;
              renderTab(tab); Tabs.emit('navigate');
            },
          }, isAd ? 'Allow once' : 'Visit anyway'),
        ),
        isAd ? null : el('p', { class: 'code', style: { marginTop: '16px' } }, 'Safe Browsing · enhanced protection'),
      )));
}

/* ---------------- theme tint ---------------- */
export function toolbarTint() {
  const tab = Tabs.active();
  const bar = $('#toolbar');
  if (!bar) return;
  if (tab?.theme && !tab.incognito) bar.style.setProperty('--tint', tab.theme);
  else bar.style.removeProperty('--tint');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = tab?.theme && !tab.incognito ? tab.theme : (tab?.incognito ? '#202124' : '#3a6ef0');
}
