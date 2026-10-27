// app/omnibox.js — omnibox suggestions, keyboard nav, voice search
import { DB, saveSoon, uid } from '../core/store.js';
import { $, el, icon, faviconEl, looksLikeUrl, normalizeUrl, searchUrl, hostOf } from '../core/utils.js';
import { snackbar } from '../core/ui.js';
import { Tabs } from './tabs.js';
import { navigate, engineTemplate, engineName } from './views.js';

const CORPUS = [
  'weather', 'news', 'orca whale facts', 'wikipedia', 'maps', 'translate', 'youtube', 'reddit',
  'developer.mozilla.org', 'example.com', 'httpbin.org', 'web.dev', 'calculator', 'timer 5 minutes',
  'javascript promises', 'css grid', 'pwa install', 'service worker tutorial', 'orca whales habitat',
  'github trending', 'stackoverflow', 'what is my ip', 'speed test', 'unit converter',
];

let input, box, clearBtn, micBtn, lockBtn;
let items = [];
let selIndex = -1;
let voiceActive = false;

export function initOmnibox() {
  input = $('#omni-input');
  box = $('#suggest');
  clearBtn = $('#omni-clear');
  micBtn = $('#omni-mic');
  lockBtn = $('#omni-lock');

  input.addEventListener('focus', () => {
    $('#omnibox').classList.add('focused');
    renderSuggest();
  });
  input.addEventListener('blur', () => {
    $('#omnibox').classList.remove('focused');
    setTimeout(() => closeSuggest(), 140);
  });
  input.addEventListener('input', () => { selIndex = -1; renderSuggest(); });
  input.addEventListener('keydown', onKey);
  clearBtn.addEventListener('click', () => { input.value = ''; input.focus(); renderSuggest(); });
  micBtn.addEventListener('click', () => startVoice());
  lockBtn.addEventListener('click', () => window.dispatchEvent(new CustomEvent('orca:page-info')));

  window.addEventListener('orca:voice-search', () => startVoice());
}

export function syncOmnibox() {
  const tab = Tabs.active();
  if (!tab) return;
  const entry = tab.stack[tab.sIndex];
  const url = entry?.url || '';
  if (document.activeElement !== input) {
    input.value = isInternalDisplay(url) ? displayUrl(url) : url;
  }
  // lock icon state
  lockBtn.classList.remove('secure', 'insecure');
  if (url.startsWith('http://')) { lockBtn.classList.add('insecure'); lockBtn.innerHTML = icon('warn').outerHTML; lockBtn.title = 'Not secure'; }
  else if (url.startsWith('https://')) { lockBtn.classList.add('secure'); lockBtn.innerHTML = icon('lock').outerHTML; lockBtn.title = 'Connection is secure'; }
  else { lockBtn.classList.add('secure'); lockBtn.innerHTML = icon('info').outerHTML; lockBtn.title = 'Page info'; }
}

function isInternalDisplay(u) { return /^orca:/.test(u); }
function displayUrl(u) {
  if (u === 'orca://newtab') return '';
  return u;
}

function closeSuggest() { box.classList.remove('open'); box.innerHTML = ''; items = []; selIndex = -1; }

function addRow(sectionList, { ic, title, sub, onPick, onFill }) {
  sectionList.push({ ic, title, sub, onPick, onFill });
}

function renderSuggest() {
  if (!DB.settings.searchSuggest && input.value.trim()) { closeSuggest(); return; }
  const q = input.value.trim();
  const ql = q.toLowerCase();
  const groups = [];
  const g = (name) => { const grp = { name, rows: [] }; groups.push(grp); return grp; };

  const gAction = g(q ? 'Search' : 'Quick actions');
  if (q) {
    addRow(gAction.rows, {
      ic: icon('search'),
      title: q,
      sub: `${engineName()} search`,
      onPick: (tab) => navigate(tab, searchUrl(engineTemplate(), q)),
      onFill: () => { input.value = q; },
    });
  }
  if (q && looksLikeUrl(q)) {
    addRow(gAction.rows, {
      ic: icon('globe'),
      title: normalizeUrl(q),
      sub: 'Go to site',
      onPick: (tab) => navigate(tab, q),
    });
  }
  if (!q) {
    addRow(gAction.rows, { ic: icon('incognito'), title: 'New incognito tab', onPick: () => Tabs.create({ incognito: true }) });
    addRow(gAction.rows, { ic: icon('bookmark'), title: 'Bookmarks', onPick: (tab) => navigate(tab, 'orca://bookmarks') });
  }

  const matches = (txt) => ql && txt.toLowerCase().includes(ql);
  const gHist = g('History');
  for (const h of DB.history) {
    if (gHist.rows.length >= 5) break;
    if (!ql || matches(h.title) || matches(h.url)) {
      addRow(gHist.rows, { ic: faviconEl(h.url, 18), title: h.title || h.url, sub: h.url, onPick: (tab) => navigate(tab, h.url), onFill: () => { input.value = h.url; } });
    }
    if (!ql && gHist.rows.length >= 3) break;
  }

  const gBm = g('Bookmarks');
  if (ql) {
    for (const b of DB.bookmarks) {
      if (b.type !== 'bm') continue;
      if (matches(b.title) || matches(b.url)) {
        addRow(gBm.rows, { ic: faviconEl(b.url, 18), title: b.title, sub: b.url, onPick: (tab) => navigate(tab, b.url) });
        if (gBm.rows.length >= 4) break;
      }
    }
  }

  const gSug = g(`${engineName()} suggestions`);
  if (ql) {
    for (const c of CORPUS) {
      if (c.includes(ql) && !gSug.rows.some((r) => r.title === c)) {
        addRow(gSug.rows, { ic: icon('search'), title: c, sub: null, onPick: (tab) => navigate(tab, searchUrl(engineTemplate(), c)), onFill: () => { input.value = c; } });
        if (gSug.rows.length >= 5) break;
      }
    }
    for (const s of DB.recentSearches) {
      if (s.includes(ql) && s !== ql && !gSug.rows.some((r) => r.title === s)) {
        addRow(gSug.rows, { ic: icon('history'), title: s, sub: 'Recent search', onPick: (tab) => navigate(tab, searchUrl(engineTemplate(), s)) });
      }
    }
  } else if (DB.recentSearches.length) {
    const gRecent = g('Recent searches');
    for (const s of DB.recentSearches.slice(0, 5)) {
      addRow(gRecent.rows, { ic: icon('history'), title: s, onPick: (tab) => navigate(tab, searchUrl(engineTemplate(), s)), onFill: () => { input.value = s; } });
    }
  }

  box.innerHTML = '';
  items = [];
  for (const grp of groups) {
    if (!grp.rows.length) continue;
    box.append(el('div', { class: 'sec' }, grp.name));
    for (const r of grp.rows) {
      const row = el('div', { class: 'sug', role: 'option' },
        el('span', { class: 's-ic' }, r.ic),
        el('span', { class: 's-main' },
          el('div', { class: 's-title' }, r.title),
          r.sub ? el('div', { class: 's-sub' }, r.sub) : null),
        r.onFill ? el('button', {
          class: 's-fill', title: 'Fill into address bar',
          onclick: (e) => { e.stopPropagation(); r.onFill(); input.focus(); renderSuggest(); },
        }, icon('back')) : null);
      row.addEventListener('pointerdown', (e) => { e.preventDefault(); });
      row.addEventListener('click', () => pick(r));
      box.append(row);
      items.push({ row, def: r });
    }
  }
  box.classList.toggle('open', items.length > 0);
}

function pick(r) {
  const tab = Tabs.active() || Tabs.create({});
  closeSuggest();
  input.blur();
  if (r.onPick) r.onPick(tab);
  if (input.value.trim() && !looksLikeUrl(input.value.trim())) pushRecentSearch(input.value.trim());
}

export function pushRecentSearch(q) {
  if (!q || Tabs.incogActive()) return;
  DB.recentSearches = [q, ...DB.recentSearches.filter((s) => s !== q)].slice(0, 12);
  saveSoon();
}

function onKey(e) {
  if (e.key === 'Enter') {
    const q = input.value.trim();
    if (selIndex >= 0 && items[selIndex]) { pick(items[selIndex].def); return; }
    if (!q) return;
    closeSuggest(); input.blur();
    const tab = Tabs.active() || Tabs.create({});
    if (!looksLikeUrl(q)) pushRecentSearch(q);
    navigate(tab, q);
  } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    if (!items.length) return;
    selIndex = (selIndex + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
    items.forEach((it, i) => it.row.classList.toggle('sel', i === selIndex));
    items[selIndex].row.scrollIntoView({ block: 'nearest' });
  } else if (e.key === 'Escape') {
    closeSuggest(); input.blur(); syncOmnibox();
  }
}

/* ---------------- voice search (Web Speech API) ---------------- */
export function startVoice() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { snackbar('Voice search isn’t supported in this browser'); return; }
  if (voiceActive) return;
  const rec = new SR();
  rec.lang = DB.settings.lang || 'en';
  rec.interimResults = true;
  voiceActive = true;
  micBtn.classList.add('listening');
  input.focus();
  const before = input.value;
  rec.onresult = (e) => {
    const text = [...e.results].map((r) => r[0].transcript).join('');
    input.value = text;
    renderSuggest();
    if (e.results[e.results.length - 1].isFinal) {
      const q = input.value.trim();
      if (q) {
        pushRecentSearch(q);
        closeSuggest(); input.blur();
        navigate(Tabs.active() || Tabs.create({}), q);
      }
    }
  };
  rec.onerror = (e) => {
    voiceActive = false; micBtn.classList.remove('listening');
    if (e.error === 'not-allowed') snackbar('Microphone permission denied. Check Settings → Site settings → Microphone.');
    else if (e.error !== 'aborted') snackbar('Voice search error: ' + e.error);
    input.value = before;
  };
  rec.onend = () => { voiceActive = false; micBtn.classList.remove('listening'); };
  try { rec.start(); } catch { voiceActive = false; micBtn.classList.remove('listening'); }
  snackbar('🎙️ Listening… speak your search', { duration: 2500 });
}
