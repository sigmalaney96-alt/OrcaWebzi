// app/main.js — boot + toolbar + tab switcher + page info + theming + SW
import { DB, saveSoon, setting } from '../core/store.js';
import { $, $$, el, icon, faviconEl, hostOf, originOf, isInternal, isSecureUrl, copyText } from '../core/utils.js';
import { snackbar, modal, sheet, showTip } from '../core/ui.js';
import { Tabs } from './tabs.js';
import {
  initViews, navigate, goBack, goForward, reloadTab, canBack, canFwd,
  syncActiveView, renderTab, currentEntry, toolbarTint, progressDone, progressStart,
} from './views.js';
import { initOmnibox, syncOmnibox } from './omnibox.js';
import { initMenu, closeMenu } from './menu.js';
import { initFindBar } from './findinpage.js';
import { initGestures } from './gestures.js';
import { initShortcuts } from './shortcuts.js';
import { maybeFirstRun } from './firstrun.js';

/* ================= boot ================= */
const mq = window.matchMedia('(prefers-color-scheme: dark)');

function applyTheme() {
  const mode = DB.settings.dark;
  const dark = mode === 'on' || (mode === 'system' && mq.matches);
  document.documentElement.classList.toggle('dark', dark);
}
mq.addEventListener?.('change', applyTheme);

function applyToolbarSettings() {
  $('#app').classList.toggle('toolbar-bottom', DB.settings.bottomToolbar);
  $('#btn-home').style.display = DB.settings.showHomeButton ? '' : 'none';
  document.documentElement.classList.toggle('site-dark', DB.settings.siteDarkening);
}

function applyViewport() {
  const vp = document.querySelector('meta[name=viewport]');
  if (!vp) return;
  vp.content = DB.settings.forceZoom
    ? 'width=device-width, initial-scale=1'
    : 'width=device-width, initial-scale=1, viewport-fit=cover';
}

function boot() {
  // splash
  setTimeout(() => $('#splash').classList.add('gone'), 650);

  applyTheme();
  applyToolbarSettings();
  applyViewport();
  initViews();
  initOmnibox();
  initMenu();
  initFindBar();
  initGestures();
  initShortcuts();
  initSwitcher();
  initToolbar();
  initEvents();
  registerSW();

  Tabs.init();
  const params = new URLSearchParams(location.search);
  if (params.get('action') === 'newtab') Tabs.create({});
  else if (params.get('action') === 'incognito') Tabs.create({ incognito: true });
  else if (params.get('url')) Tabs.create({ url: params.get('url') });
  Tabs.emit('activate');
  maybeFirstRun();
}

/* ================= toolbar ================= */
function initToolbar() {
  $('#btn-back').addEventListener('click', () => { const t = Tabs.active(); if (t) goBack(t); });
  $('#btn-fwd').addEventListener('click', () => { const t = Tabs.active(); if (t) goForward(t); });
  $('#btn-reload').addEventListener('click', () => { const t = Tabs.active(); if (t) reloadTab(t); });
  $('#btn-home').addEventListener('click', () => { const t = Tabs.active(); if (t) navigate(t, DB.settings.homepage || 'orca://newtab'); });
  $('#omni-input').addEventListener('focus', () => { const t = Tabs.active(); if (t && currentEntry(t)?.url === 'orca://newtab') $('#omni-input').select(); });
  Tabs.onChange(updateToolbar);
}

function updateToolbar() {
  const tab = Tabs.active();
  document.documentElement.classList.toggle('incog', !!tab?.incognito);
  const count = Tabs.list(tab?.incognito).length;
  $('#tab-count .box').textContent = String(count);
  $('#btn-back').disabled = !canBack(tab);
  $('#btn-fwd').disabled = !canFwd(tab);
  syncOmnibox();
  syncActiveView();
  toolbarTint();
}

/* ================= tab switcher ================= */
let switcherMode = 'normal';

function initSwitcher() {
  $('#tab-count').addEventListener('click', () => openSwitcher());
  $('#sw-close').addEventListener('click', closeSwitcher);
  $('#sw-new').addEventListener('click', () => {
    Tabs.create({ incognito: switcherMode === 'incognito' });
    closeSwitcher();
  });
  $('#sw-menu').addEventListener('click', () => {
    const incog = switcherMode === 'incognito';
    sheet({
      title: 'Tabs',
      rows: [
        { label: incog ? 'Close all incognito tabs' : 'Close all tabs', icon: icon('close'), onClick: () => { Tabs.closeAll(incog); renderSwitcherGrid(); } },
        { label: 'Close other tabs', icon: icon('delete'), onClick: () => { const a = Tabs.active(); if (a) Tabs.closeOthers(a.id); renderSwitcherGrid(); } },
        DB.closedTabs.length ? { label: 'Reopen closed tab', icon: icon('undo'), onClick: () => { Tabs.reopenClosed(); renderSwitcherGrid(); closeSwitcher(); } } : null,
        '-',
        { label: 'Select tabs for a group', icon: icon('group'), onClick: () => snackbar('Long-press any tab card → “Add to group”') },
      ].filter(Boolean),
    });
  });
  $('#sw-seg-normal').addEventListener('click', () => { switcherMode = 'normal'; renderSwitcherGrid(); });
  $('#sw-seg-incog').addEventListener('click', () => { switcherMode = 'incognito'; renderSwitcherGrid(); });
}

export function openSwitcher() {
  switcherMode = Tabs.incogActive() ? 'incognito' : 'normal';
  $('#switcher').classList.add('open');
  closeMenu();
  renderSwitcherGrid();
}
export function closeSwitcher() { $('#switcher').classList.remove('open'); }

function renderSwitcherGrid() {
  const incog = switcherMode === 'incognito';
  $('#sw-seg-normal').classList.toggle('on', !incog);
  $('#sw-seg-incog').classList.toggle('on', incog);
  $('#sw-seg-incog').innerHTML = '';
  $('#sw-seg-incog').append(icon('incognito'), ` Incognito${Tabs.incogTabs.length ? ` (${Tabs.incogTabs.length})` : ''}`);
  $('#sw-seg-normal').textContent = `Tabs${Tabs.tabs.length ? ` (${Tabs.tabs.length})` : ''}`;

  const grid = $('#sw-grid');
  grid.innerHTML = '';
  const list = Tabs.list(incog);
  if (!list.length) {
    grid.append(el('div', { class: 'sw-empty' }, incog ? 'No incognito tabs open.' : 'No tabs open.'));
    return;
  }
  for (const t of [...list].reverse()) {
    grid.append(tabCard(t));
  }
}

function tabCard(t) {
  const entry = currentEntry(t);
  const url = entry?.url || 'orca://newtab';
  const group = Tabs.groupOf(t);
  const card = el('div', { class: 'tcard' + (group ? ' grouped' : ''), style: group ? { '--gc': group.color } : {} },
    el('div', { class: 'tc-head' },
      faviconEl(url, 16),
      el('span', { class: 'tc-title' }, t.title || 'New tab'),
      el('button', {
        class: 'tc-x', title: 'Close tab',
        onclick: (e) => { e.stopPropagation(); closeWithUndo(t); renderSwitcherGrid(); },
      }, '✕')),
    el('div', { class: 'tc-shot' },
      el('div', { class: 'ph' },
        el('div', { class: 'glyph' }, url === 'orca://newtab' ? '🏠' : isInternal(url) ? '🐋' : '🌐'),
        el('div', {}, hostOf(url) || 'New tab'))),
    group ? el('div', { class: 'tc-group', style: { background: group.color } }, group.name) : null);

  card.addEventListener('click', () => { Tabs.activate(t.id); closeSwitcher(); });

  // swipe-to-close
  let sx = 0, dx = 0, dragging = false;
  card.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; dragging = true; dx = 0; }, { passive: true });
  card.addEventListener('touchmove', (e) => {
    if (!dragging) return;
    dx = e.touches[0].clientX - sx;
    if (Math.abs(dx) > 10) { card.classList.add('drag'); card.style.transform = `translateX(${dx}px) rotate(${dx / 40}deg)`; card.style.opacity = String(1 - Math.min(.6, Math.abs(dx) / 300)); }
  }, { passive: true });
  card.addEventListener('touchend', () => {
    dragging = false;
    card.classList.remove('drag');
    if (Math.abs(dx) > 90) {
      card.style.transform = `translateX(${dx > 0 ? 400 : -400}px)`;
      closeWithUndo(t);
      setTimeout(renderSwitcherGrid, 120);
    } else {
      card.style.transform = ''; card.style.opacity = '';
    }
  });

  // long-press → group / split / duplicate
  let lp = null;
  card.addEventListener('touchstart', (e) => {
    clearTimeout(lp);
    lp = setTimeout(() => cardMenu(t), 550);
  }, { passive: true });
  card.addEventListener('touchend', () => clearTimeout(lp));
  card.addEventListener('touchmove', () => clearTimeout(lp), { passive: true });
  card.addEventListener('contextmenu', (e) => { e.preventDefault(); cardMenu(t); });
  return card;
}

function closeWithUndo(t) {
  const entry = currentEntry(t);
  Tabs.close(t.id);
  if (!t.incognito) {
    snackbar('Tab closed', {
      action: 'Undo',
      onAction: () => { const nt = Tabs.reopenClosed(); renderSwitcherGrid(); },
    });
  }
}

function cardMenu(t) {
  const groups = Tabs.groups;
  sheet({
    title: t.title || 'Tab',
    titleIcon: faviconEl(currentEntry(t)?.url || '', 20),
    rows: [
      {
        label: 'Add to new group', icon: icon('group'), onClick: () => {
          const name = el('input', { type: 'text', placeholder: 'Group name (optional)' });
          modal({
            title: 'New tab group',
            body: el('div', {}, el('label', { class: 'f' }, 'Name'), name),
            actions: [{ label: 'Cancel' }, { label: 'Create', primary: true, onClick: () => { Tabs.createGroup(name.value.trim() || undefined, [t.id]); renderSwitcherGrid(); snackbar('Tab group created'); } }],
          });
        },
      },
      ...groups.map((g) => ({
        label: `Add to “${g.name}”`, icon: el('span', { style: { width: '14px', height: '14px', borderRadius: '4px', background: g.color, display: 'inline-block' } }),
        onClick: () => { Tabs.addToGroup([t.id], g.id); renderSwitcherGrid(); },
      })),
      t.groupId ? { label: 'Remove from group', icon: icon('close'), onClick: () => { Tabs.ungroup(t.id); renderSwitcherGrid(); } } : null,
      '-',
      { label: 'Duplicate tab', icon: icon('copy'), onClick: () => { const cur = currentEntry(t); Tabs.create({ url: cur?.url, incognito: t.incognito }); renderSwitcherGrid(); } },
      { label: 'Open in split view', icon: icon('devices'), onClick: () => { closeSwitcher(); enableSplit(t.id); } },
      '-',
      { label: 'Close tab', icon: icon('delete'), onClick: () => { closeWithUndo(t); renderSwitcherGrid(); } },
    ].filter(Boolean),
  });
}

/* ================= split view ================= */
function enableSplit(tabId) {
  const content = $('#content');
  const main = Tabs.active();
  const secondary = Tabs.byId(tabId);
  if (!secondary || !main || secondary.id === main.id) { snackbar('Pick a different tab to split with'); return; }
  if (!secondary.el) renderTab(secondary);
  content.classList.add('split');
  secondary.el.classList.add('split-secondary');
  const bar = $('#split-bar');
  bar.innerHTML = '';
  bar.append(
    el('span', {}, `Split view: ${main.title || 'Tab'} | ${secondary.title || 'Tab'}`),
    el('span', { style: { flex: '1' } }),
    el('button', {
      class: 'ibtn-sm', onclick: () => {
        content.classList.remove('split');
        secondary.el.classList.remove('split-secondary');
        bar.innerHTML = '';
        syncActiveView();
      },
    }, 'Exit split view'),
  );
  syncActiveView();
}

/* ================= page info panel ================= */
function pageInfo() {
  const tab = Tabs.active();
  if (!tab) return;
  const entry = currentEntry(tab);
  if (!entry) return;
  const url = entry.url;
  const internal = isInternal(url);
  const secure = isSecureUrl(url);
  const origin = internal ? 'orca://app' : originOf(url);

  const perms = DB.sitePerms[origin] || (DB.sitePerms[origin] = {});
  const PERM_ROWS = [
    ['location', 'Location'], ['camera', 'Camera'], ['mic', 'Microphone'],
    ['notifications', 'Notifications'], ['clipboard', 'Clipboard'], ['midi', 'MIDI'],
    ['sound', 'Sound'], ['popups', 'Pop-ups'],
  ];

  const certViewer = () => modal({
    title: 'Certificate',
    body: el('div', {},
      internal
        ? el('p', {}, 'This page is part of Orca Orca Web and runs locally — no network connection involved.')
        : el('div', { class: 'kv' },
          el('b', {}, 'Issued to'), el('span', {}, hostOf(url)),
          el('b', {}, 'Issued by'), el('span', {}, '(viewed in the browser’s own certificate UI)'),
          el('b', {}, 'Protocol'), el('span', {}, 'TLS 1.3 (as reported by the platform)'),
          el('b', {}, 'Note'), el('span', {}, 'Web pages can’t read raw TLS certificate bytes; Orca shows what the platform exposes.'))),
    actions: [{ label: 'OK', primary: true }],
  });

  sheet({
    title: internal ? 'Orca internal page' : hostOf(url),
    titleIcon: faviconEl(url, 20),
    rows: [
      { label: secure ? 'Connection is secure' : 'Connection is not secure', sub: secure ? (internal ? 'Local app page' : 'HTTPS · certificate valid (per platform)') : 'HTTP — info sent to this site is visible to others', icon: icon(secure ? 'lock' : 'warn'), onClick: certViewer },
      { label: 'Cookies and site data', sub: cookieSummary(origin), icon: icon('cookie'), onClick: () => siteDataSheet(origin) },
      { label: 'Site settings', sub: 'Permissions for this site', icon: icon('settings'), onClick: () => permsSheet(origin) },
      '-',
      { label: 'Copy URL', icon: icon('copy'), onClick: async () => { await copyText(url); snackbar('URL copied'); } },
    ],
  });

  function cookieSummary(o) {
    const d = DB.siteData[o];
    if (internal) return 'App storage (localStorage + IndexedDB)';
    if (!d) return 'No data recorded for this site';
    return `${d.cookies || 0} cookies · ${(d.storage || 0) / 1024 | 0} KB in use`;
  }

  function siteDataSheet(o) {
    sheet({
      title: `Data for ${o}`,
      rows: [
        { label: 'Delete site data', icon: icon('delete'), onClick: () => { delete DB.siteData[o]; saveSoon(); snackbar('Site data deleted for ' + o); } },
        { label: 'Manage all site storage', icon: icon('cookie'), onClick: () => navigate(tab, 'orca://site-data') },
      ],
    });
  }

  function permsSheet(o) {
    sheet({
      title: `Permissions · ${o}`,
      custom: (close) => el('div', { style: { padding: '0 20px 8px' } },
        ...PERM_ROWS.map(([key, label]) => {
          const sel = el('select', {},
            el('option', { value: '' }, `Default (${DB.settings.defPerms[key]})`),
            el('option', { value: 'allow' }, 'Allow'),
            el('option', { value: 'block' }, 'Block'));
          sel.value = perms[key] || '';
          sel.addEventListener('change', () => {
            if (sel.value) perms[key] = sel.value; else delete perms[key];
            saveSoon();
            snackbar(`${label}: ${sel.value || 'default'} for ${o}`);
          });
          return el('div', { class: 'perm-row' }, el('span', { class: 'grow' }, label), sel);
        }),
        el('div', { style: { textAlign: 'right', paddingTop: '10px' } },
          el('button', { class: 'ibtn-sm', onclick: () => { DB.sitePerms[o] = {}; saveSoon(); close(); snackbar('Permissions reset for ' + o); } }, 'Reset all'))),
    });
  }
}

/* ================= global events ================= */
function initEvents() {
  window.addEventListener('orca:page-info', pageInfo);
  window.addEventListener('orca:theme', () => { applyTheme(); updateToolbar(); });
  window.addEventListener('orca:toolbar-settings', () => { applyToolbarSettings(); updateToolbar(); });
  window.addEventListener('orca:zoom-setting', applyViewport);
  window.addEventListener('orca:text-scale', () => {
    for (const t of [...Tabs.tabs, ...Tabs.incogTabs]) {
      if (t.el && !t.iframe) { import('./views.js').then(({ applyTabPrefs }) => applyTabPrefs(t)); }
    }
  });
  window.addEventListener('online', () => { snackbar('Back online'); });
  window.addEventListener('offline', () => {
    snackbar('You’re offline. Saved pages still work.', { duration: 3000 });
    const t = Tabs.active();
    const e = t && currentEntry(t);
    if (t && e?.type === 'web') { e.type = 'error'; e.kind = 'offline'; renderTab(t); }
  });

  // capture install prompt
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    window.__orcaInstallPrompt = e;
  });
  window.addEventListener('appinstalled', () => {
    window.__orcaInstallPrompt = null;
    snackbar('Orca installed — find it on your home screen 🎉');
  });
}

/* ================= service worker ================= */
async function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    reg.addEventListener('updatefound', () => {
      const nw = reg.installing;
      nw?.addEventListener('statechange', () => {
        if (nw.state === 'installed' && navigator.serviceWorker.controller) {
          snackbar('A new version of Orca is available', {
            action: 'Reload', duration: 10000,
            onAction: () => { nw.postMessage({ type: 'SKIP_WAITING' }); location.reload(); },
          });
        }
      });
    });
  } catch { /* SW unavailable (e.g. http) — app still runs */ }
}

document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', boot) : boot();
