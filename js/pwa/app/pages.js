// app/pages.js — router for orca:// internal pages (NTP, articles, help, demo…)
import { DB, saveSoon, uid } from '../core/store.js';
import { el, icon, faviconEl, timeAgo, dayLabel, copyText } from '../core/utils.js';
import { snackbar, modal, sheet, confirmDialog } from '../core/ui.js';
import { Tabs } from './tabs.js';
import { navigate, mostVisited } from './views.js';
import { renderFeed, getArticle } from './feed.js';
import * as Manager from './manager.js';

export function renderInternal(tab, url) {
  const [path] = [url.toLowerCase()];
  if (path === 'orca://newtab' || path === 'orca://home') return ntpEl(tab);
  if (path.startsWith('orca://article/')) return articleEl(tab, path.slice('orca://article/'.length));
  if (path === 'orca://help') return helpEl(tab);
  if (path === 'orca://licenses') return licensesEl(tab);
  if (path === 'orca://demo') return demoEl(tab);
  if (path === 'orca://recent') return recentEl(tab);
  if (path.startsWith('orca://reader/')) return articleEl(tab, path.slice('orca://reader/'.length), true);
  return Manager.render(tab, url);
}

/* ================= NTP ================= */
function ntpEl(tab) {
  if (tab.incognito) return incogNtpEl(tab);

  const wrap = el('div', { class: 'ntp' });

  // header: logo + search + voice
  const searchInput = el('input', {
    placeholder: 'Search or type web address',
    'aria-label': 'Search or type web address',
  });
  const pill = el('div', { class: 'ntp-search', onclick: () => { focusOmnibox(); } },
    el('span', { style: { display: 'grid', placeItems: 'center', color: 'var(--pill-soft)' } }, icon('search')),
    searchInput,
    el('button', {
      class: 'tbtn', title: 'Voice search',
      onclick: (e) => { e.stopPropagation(); window.dispatchEvent(new CustomEvent('orca:voice-search')); },
    }, icon('mic')),
  );
  searchInput.addEventListener('focus', () => { focusOmnibox(); searchInput.blur(); });
  wrap.append(el('div', { class: 'ntp-head' },
    el('div', { class: 'ntp-logo' }, el('img', { src: '/IMG_7168.jpeg', alt: 'Orca' }), el('span', {}, 'Orca')),
    pill,
  ));

  // most-visited tiles
  const tilesWrap = el('div', { class: 'ntp-tiles' });
  const defaults = [
    { url: 'https://www.wikipedia.org/', title: 'Wikipedia' },
    { url: 'https://developer.mozilla.org/', title: 'MDN' },
    { url: 'https://example.com/', title: 'Example' },
    { url: 'https://www.w3.org/', title: 'W3C' },
    { url: 'https://httpbin.org/html', title: 'HTTPBin' },
  ];
  const hidden = new Set(DB.ntpHidden || []);
  const tiles = [...mostVisited(8), ...defaults].filter((t, i, arr) =>
    !hidden.has(t.url) && arr.findIndex((x) => x.url === t.url) === i).slice(0, 8);
  for (const t of tiles) {
    const tile = el('button', { class: 'tile', onclick: () => navigate(tab, t.url) },
      el('span', { class: 't-ic' }, faviconEl(t.url, 24)),
      el('span', { class: 't-name' }, t.title),
      el('button', {
        class: 't-x', title: 'Remove',
        onclick: (e) => {
          e.stopPropagation();
          DB.ntpHidden = [...(DB.ntpHidden || []), t.url];
          saveSoon(); tile.remove();
          snackbar('Shortcut removed', { action: 'Undo', onAction: () => { DB.ntpHidden = (DB.ntpHidden || []).filter((u) => u !== t.url); saveSoon(); renderRefresh(tab); } });
        },
      }, '✕'),
    );
    tile.addEventListener('contextmenu', (e) => { e.preventDefault(); tile.querySelector('.t-x')?.click(); });
    tilesWrap.append(tile);
  }
  tilesWrap.append(el('button', {
    class: 'tile add', title: 'Add shortcut',
    onclick: () => addShortcutDialog(tab),
  }, el('span', { class: 't-ic' }, '+'), el('span', { class: 't-name' }, 'Add shortcut')));
  wrap.append(tilesWrap);

  // feed
  wrap.append(renderFeed(tab));

  // explore sites
  const cats = [
    ['News', [['Wikipedia', 'https://www.wikipedia.org/'], ['BBC', 'https://www.bbc.com/'], ['Reuters', 'https://www.reuters.com/'], ['Hacker News', 'https://news.ycombinator.com/']]],
    ['Dev', [['MDN', 'https://developer.mozilla.org/'], ['web.dev', 'https://web.dev/'], ['Stack Overflow', 'https://stackoverflow.com/'], ['GitHub', 'https://github.com/']]],
    ['Reference', [['Example.com', 'https://example.com/'], ['W3C', 'https://www.w3.org/'], ['httpbin', 'https://httpbin.org/html'], ['IANA', 'https://www.iana.org/']]],
    ['Fun', [['Orca demo page', 'orca://demo'], ['Help & tips', 'orca://help'], ['About Orca', 'orca://about']]],
  ];
  const ex = el('div', { class: 'explore' }, el('div', { class: 'feed-h' }, el('b', {}, 'Explore sites')));
  for (const [cat, sites] of cats) {
    ex.append(el('div', { class: 'cat' }, cat));
    ex.append(el('div', { class: 'row' }, sites.map(([name, url]) =>
      el('button', { class: 'chip', onclick: () => navigate(tab, url) }, faviconEl(url, 16), name))));
  }
  wrap.append(ex);
  return wrap;
}

function focusOmnibox() {
  const input = document.querySelector('#omni-input');
  if (input) { input.focus(); input.select(); }
}

function renderRefresh(tab) {
  import('./views.js').then((v) => v.renderTab(tab));
}

function incogNtpEl(tab) {
  return el('div', { class: 'ntp incog-ntp' },
    icon('incognito'),
    el('h2', {}, 'You’ve gone Incognito'),
    el('p', {}, 'Tabs you open here won’t be saved to your history, cookie store, or search suggestions once you close them. Downloads and bookmarks are kept.'),
    el('p', {}, 'Your activity might still be visible to websites you visit, your network, and your service provider.'),
    el('button', { class: 'btn-mat', onclick: () => { window.dispatchEvent(new CustomEvent('orca:voice-search')); } }, 'Search privately'),
  );
}

function addShortcutDialog(tab) {
  const name = el('input', { type: 'text', placeholder: 'Name' });
  const url = el('input', { type: 'url', placeholder: 'https://example.com' });
  modal({
    title: 'Add shortcut',
    body: el('div', {}, el('label', { class: 'f' }, 'Name'), name, el('label', { class: 'f' }, 'URL'), url),
    actions: [
      { label: 'Cancel' },
      {
        label: 'Add', primary: true, onClick: () => {
          if (!url.value.trim()) return false;
          const u = url.value.trim();
          navigate(tab, u);
          snackbar('Tip: the site appears in your tiles once visited. Use ⋮ → Bookmarks ★ to pin it.');
        },
      },
    ],
  });
}

/* ================= Article reader ================= */
function articleEl(tab, id, forceReader = false) {
  const a = getArticle(id);
  if (!a) return el('div', { class: 'ipage' }, el('div', { class: 'iempty' }, 'Article not found'));
  tab.title = a.title;
  const simplified = forceReader || tab.reader || DB.settings.simplifiedView;
  const art = el('article', { class: 'article' + (simplified ? ' reader-simplified' : ''), dataset: { article: id } },
    el('div', { class: 'a-hero', style: { background: `linear-gradient(135deg, hsl(${a.hue} 70% 45%), hsl(${(a.hue + 40) % 360} 70% 32%))` } }, a.emoji),
    el('h1', {}, a.title),
    el('div', { class: 'a-meta' }, `${a.source} · ${timeAgo(a.time)} · ${Math.max(2, Math.round(a.body.join(' ').split(' ').length / 200))} min read`),
    ...a.body.flatMap((p, i) => (i === 2 ? [el('h3', {}, 'Why it matters'), el('p', {}, p)] : [el('p', {}, p)])),
    el('p', { style: { color: 'var(--soft)', fontSize: '13px' } }, 'Rendered locally by Orca Reader. Long-press text to search, or use ⋮ → Find in page.'),
  );
  // offer offline save + translation once per article view
  if (!tab.incognito && !DB.offline.some((o) => o.url === `orca://article/${id}`)) {
    setTimeout(() => {
      if (!tab.el?.isConnected) return;
      const bar = el('div', { class: 'infobar' },
        el('span', { class: 'grow' }, '📥 Save this article for offline reading?'),
        el('button', {
          class: 'ibtn', onclick: () => {
            DB.offline.push({ id: uid(), url: `orca://article/${id}`, title: a.title, time: Date.now(), size: a.body.join(' ').length });
            saveSoon(); bar.remove(); snackbar('Article saved. Find it in Downloads → Offline pages.');
          },
        }, 'Save'),
        el('button', { class: 'ibtn x', onclick: () => bar.remove() }, '✕'),
      );
      tab.el?.prepend(bar);
    }, 600);
  }
  return el('div', {}, art);
}

/* ================= Recent tabs ================= */
function recentEl(tab) {
  const wrap = el('div', { class: 'ipage' });
  wrap.append(el('div', { class: 'ip-head' }, el('h1', {}, 'Recent tabs')));
  const body = el('div', { class: 'ip-body' });
  wrap.append(body);

  body.append(el('div', { class: 'ip-sec-h' }, 'This device'));
  const openCard = el('div', { class: 'ip-card' });
  const mine = [...Tabs.tabs, ...Tabs.incogTabs];
  if (!mine.length) openCard.append(el('div', { class: 'iempty' }, 'No open tabs'));
  for (const t of mine) {
    const cur = t.stack[t.sIndex];
    openCard.append(el('button', { class: 'irow', onclick: () => Tabs.activate(t.id) },
      el('span', { class: 'r-ic' }, cur?.url ? faviconEl(cur.url, 18) : icon('globe')),
      el('span', { class: 'r-main' },
        el('div', { class: 'r-title' }, t.title || 'New tab'),
        el('div', { class: 'r-sub' }, (cur?.url || '') + (t.incognito ? ' · Incognito' : ''))),
      icon('chevron', 'chev'),
    ));
  }
  body.append(openCard);

  if (DB.closedTabs.length) {
    body.append(el('div', { class: 'ip-sec-h' }, 'Recently closed'));
    const cc = el('div', { class: 'ip-card' });
    for (const c of DB.closedTabs.slice(0, 10)) {
      cc.append(el('button', { class: 'irow', onclick: () => navigate(tab, c.url) },
        el('span', { class: 'r-ic' }, faviconEl(c.url, 18)),
        el('span', { class: 'r-main' }, el('div', { class: 'r-title' }, c.title || c.url), el('div', { class: 'r-sub' }, timeAgo(c.time))),
      ));
    }
    body.append(cc);
  }

  for (const dev of DB.recentDevices) {
    body.append(el('div', { class: 'ip-sec-h' }, `${dev.name} ${dev.kind === 'phone' ? '📱' : '💻'}`));
    const card = el('div', { class: 'ip-card' });
    for (const t of dev.tabs) {
      card.append(el('button', { class: 'irow', onclick: () => navigate(tab, t.url) },
        el('span', { class: 'r-ic' }, faviconEl(t.url, 18)),
        el('span', { class: 'r-main' }, el('div', { class: 'r-title' }, t.title), el('div', { class: 'r-sub' }, timeAgo(t.time))),
      ));
    }
    const sent = DB.sentTabs.filter((s) => s.device === dev.id);
    for (const s of sent) {
      card.append(el('button', { class: 'irow', onclick: () => navigate(tab, s.url) },
        el('span', { class: 'r-ic' }, faviconEl(s.url, 18)),
        el('span', { class: 'r-main' }, el('div', { class: 'r-title' }, s.title || s.url), el('div', { class: 'r-sub' }, 'Sent to you · ' + timeAgo(s.time))),
      ));
    }
    body.append(card);
  }
  return wrap;
}

/* ================= Help & feedback ================= */
function helpEl(tab) {
  const wrap = el('div', { class: 'ipage' });
  wrap.append(el('div', { class: 'ip-head' }, el('h1', {}, 'Help & feedback')));
  const body = el('div', { class: 'ip-body' });

  const faq = [
    ['How do tabs work?', 'Tap the square counter in the toolbar to open the tab switcher. Long-press a card to add it to a group, swipe a card sideways to close it, and use ⋮ → Close all tabs to start fresh.'],
    ['Why do some sites refuse to load?', 'Some websites send X-Frame-Options or frame-ancestors headers that forbid being embedded. Orca shows an error page with an “Open externally” button when that happens.'],
    ['How does Incognito work here?', 'Incognito tabs live only in memory: no history, no cookies beyond the tab’s life, and they vanish when closed. The toolbar turns dark and shows the incognito badge.'],
    ['Is my data synced?', 'Sign in from Settings to enable sync. In this web build, your data is stored locally on this device (localStorage/IndexedDB) and encrypted in transit when exported.'],
    ['Keyboard shortcuts', 'Ctrl/⌘+T new tab · Ctrl+W close tab · Ctrl+L focus address bar · Ctrl+F find in page · Ctrl+D bookmark · Alt+←/→ back/forward · Alt+Home homepage · Ctrl+Shift+N incognito (where the browser allows).'],
  ];
  body.append(el('div', { class: 'ip-sec-h' }, 'FAQ'));
  const fc = el('div', { class: 'ip-card' });
  for (const [q, a] of faq) {
    const d = el('details', { style: { padding: '12px 16px' } },
      el('summary', { style: { cursor: 'pointer', fontSize: '14.5px', fontWeight: 600 } }, q),
      el('p', { style: { color: 'var(--soft)', fontSize: '13.5px', lineHeight: '1.6' } }, a));
    fc.append(d);
  }
  body.append(fc);

  body.append(el('div', { class: 'ip-sec-h' }, 'Feedback'));
  const fb = el('div', { class: 'ip-card' });
  const ta = el('textarea', { rows: '4', placeholder: 'Tell us what you think, or report a problem…', style: { width: '100%', border: '0', background: 'transparent', color: 'var(--ink)', padding: '14px 16px', fontSize: '14px', outline: 'none', resize: 'vertical' } });
  fb.append(ta,
    el('div', { style: { display: 'flex', justifyContent: 'flex-end', padding: '0 10px 10px' } },
      el('button', {
        class: 'ibtn-sm', onclick: () => {
          if (!ta.value.trim()) { snackbar('Write something first'); return; }
          DB.feedback = [...(DB.feedback || []), { text: ta.value, time: Date.now() }];
          saveSoon(); ta.value = '';
          snackbar('Thanks! Your feedback was recorded.');
        },
      }, 'Send')));
  body.append(fb);

  body.append(el('div', { class: 'ip-sec-h' }, 'More'));
  const more = el('div', { class: 'ip-card' });
  more.append(
    el('button', { class: 'irow', onclick: () => navigate(tab, 'orca://demo') }, el('span', { class: 'r-ic' }, icon('star')), el('span', { class: 'r-main' }, el('div', { class: 'r-title' }, 'Try device & media features'), el('div', { class: 'r-sub' }, 'Geolocation, camera, notifications, PiP…')), icon('chevron', 'chev')),
    el('button', { class: 'irow', onclick: () => navigate(tab, 'orca://licenses') }, el('span', { class: 'r-ic' }, icon('article')), el('span', { class: 'r-main' }, el('div', { class: 'r-title' }, 'Open-source licenses')), icon('chevron', 'chev')),
    el('button', { class: 'irow', onclick: () => navigate(tab, 'orca://about') }, el('span', { class: 'r-ic' }, icon('info')), el('span', { class: 'r-main' }, el('div', { class: 'r-title' }, 'About Orca Orca Web')), icon('chevron', 'chev')),
  );
  body.append(more);
  return wrap;
}

/* ================= Licenses ================= */
function licensesEl() {
  const wrap = el('div', { class: 'ipage' });
  wrap.append(el('div', { class: 'ip-head' }, el('h1', {}, 'Open-source licenses')));
  const body = el('div', { class: 'ip-body' });
  body.append(el('div', { class: 'ip-card', style: { padding: '16px' } },
    el('p', { style: { fontSize: '13.5px', lineHeight: '1.7', color: 'var(--soft)', userSelect: 'text' } },
      'Orca Orca Web is built with the open web platform: HTML, CSS, JavaScript, Service Workers, IndexedDB, Web Share, Web Speech, Payment Request and friends — thank you, web platform community.'),
    el('p', { style: { fontSize: '13.5px', lineHeight: '1.7', color: 'var(--soft)', userSelect: 'text' } },
      'QR encoder: implemented after the QR Code specification (ISO/IEC 18004), verified module-for-module against the MIT-licensed “qrcode” package. Icons: original Material-style paths, Apache-2.0 style.'),
    el('p', { style: { fontSize: '13.5px', lineHeight: '1.7', color: 'var(--soft)', userSelect: 'text' } },
      'UI design takes inspiration from Chromium for Android (BSD-style license). No Chromium code is included; this is an independent implementation.')));
  return wrap;
}

/* ================= Feature demos (device APIs) ================= */
function demoEl(tab) {
  const wrap = el('div', { class: 'ipage' });
  wrap.append(el('div', { class: 'ip-head' }, el('h1', {}, 'Feature demos'), el('span', { style: { color: 'var(--soft)', fontSize: '13px' } }, 'Real device APIs, run in this tab')));
  const out = el('div', { class: 'demo-out' }, 'Results appear here.');
  const say = (t) => { out.textContent = t; };
  const cells = [
    ['📍 Geolocation', 'Request your position', async () => {
      if (!navigator.geolocation) return say('Geolocation API not supported');
      say('Requesting permission…');
      navigator.geolocation.getCurrentPosition(
        (p) => say(`Latitude ${p.coords.latitude.toFixed(5)}\nLongitude ${p.coords.longitude.toFixed(5)}\nAccuracy ±${Math.round(p.coords.accuracy)}m`),
        (e) => say('Denied or unavailable: ' + e.message), { timeout: 10000 });
    }],
    ['📷 Camera', 'getUserMedia video', async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: true });
        say(`Camera stream started (${s.getVideoTracks()[0]?.label || 'camera'}). Stopping tracks…`);
        s.getTracks().forEach((t) => t.stop());
      } catch (e) { say('Camera: ' + e.message); }
    }],
    ['🎙️ Microphone', 'getUserMedia audio', async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ audio: true });
        say(`Mic stream started (${s.getAudioTracks()[0]?.label || 'mic'}). Stopping tracks…`);
        s.getTracks().forEach((t) => t.stop());
      } catch (e) { say('Mic: ' + e.message); }
    }],
    ['🔔 Notification', 'Push a test notification', async () => {
      try {
        const p = await Notification.requestPermission();
        if (p !== 'granted') return say('Notification permission: ' + p);
        new Notification('Orca Orca Web', { body: 'Notifications are working 🎉', icon: '/icons/icon-192.png' });
        say('Notification sent.');
      } catch (e) { say('Notifications: ' + e.message); }
    }],
    ['📋 Clipboard', 'Copy & read text', async () => {
      try { await navigator.clipboard.writeText('Orca was here 🐋'); const t = await navigator.clipboard.readText(); say('Clipboard now contains: ' + JSON.stringify(t)); }
      catch (e) { say('Clipboard: ' + e.message); }
    }],
    ['📳 Vibration', 'Vibrate the device', async () => {
      say(navigator.vibrate ? (navigator.vibrate([80, 40, 80]) ? 'Buzzing…' : 'Vibrate call rejected') : 'Vibration API not supported');
    }],
    ['🖼️ Picture-in-picture', 'Float a video', async () => {
      if (!document.pictureInPictureEnabled) return say('Picture-in-picture not supported here.');
      const v = el('video', { controls: true, style: { width: '100%', borderRadius: '12px', margin: '10px 6px' }, src: '' });
      say('PiP needs a playing video. Load a video in a web tab (e.g. a sample MP4) and use the ⋮ menu → Picture in picture.');
    }],
    ['📡 Cast', 'Chromecast placeholder', async () => {
      say('Casting requires the Cast SDK on a cast-enabled network. The ⋮ menu includes a Cast button placeholder, like Chrome.');
    }],
    ['🔌 WebUSB / Bluetooth / NFC', 'Device chooser dialogs', async () => {
      const caps = [`WebUSB: ${'usb' in navigator ? 'supported' : 'no'}`, `WebBluetooth: ${'bluetooth' in navigator ? 'supported' : 'no'}`, `WebNFC: ${'NDEFReader' in window ? 'supported' : 'no'}`, `WebSerial: ${'serial' in navigator ? 'supported' : 'no'}`];
      say(caps.join('\n') + '\n\nWhere supported, calling requestDevice() opens the browser’s chooser dialog.');
    }],
    ['📇 Contact / photo picker', 'File & contact pickers', async () => {
      const input = el('input', { type: 'file', accept: 'image/*', style: { display: 'none' } });
      document.body.append(input);
      input.onchange = () => { say(input.files[0] ? `Picked photo: ${input.files[0].name} (${input.files[0].size} bytes)` : 'No file picked'); input.remove(); };
      input.click();
    }],
    ['🔐 HTTP auth & JS dialogs', 'Chrome-styled prompts', () => {
      modal({
        title: 'Sign in',
        body: el('div', {},
          el('div', { class: 'auth-realm' }, '🔒 https://demo.orca — The server says: “Orca demo realm”.'),
          el('label', { class: 'f' }, 'Username'), el('input', { type: 'text', placeholder: 'Username' }),
          el('label', { class: 'f' }, 'Password'), el('input', { type: 'password', placeholder: 'Password' }),
          el('p', { class: 'sub' }, 'This demonstrates how Orca styles HTTP authentication and JavaScript alert/confirm/prompt dialogs, mirroring Chrome’s modal design.')),
        actions: [{ label: 'Cancel' }, { label: 'Sign in', primary: true, onClick: () => snackbar('Demo auth dialog submitted') }],
      });
    }],
    ['🪪 Client certificates', 'Certificate picker style', () => {
      modal({
        title: 'Select a certificate',
        body: el('div', {},
          el('p', { class: 'sub' }, 'The site “demo.orca” requests a client certificate.'),
          el('div', { class: 'm-list' },
            el('label', { class: 'radioline' }, el('input', { type: 'radio', name: 'cert', checked: true }), el('span', {}, el('b', {}, 'orca-user@example.com'), el('div', { class: 'sub' }, 'Issued by Orca Demo CA · expires 2027-04-01'))),
            el('label', { class: 'radioline' }, el('input', { type: 'radio', name: 'cert' }), el('span', {}, el('b', {}, 'backup@example.com'), el('div', { class: 'sub' }, 'Issued by Orca Demo CA · expires 2026-11-19'))))),
        actions: [{ label: 'Cancel' }, { label: 'OK', primary: true, onClick: () => snackbar('Certificate selected (demo)') }],
      });
    }],
  ];
  const grid = el('div', { class: 'demo-grid' }, cells.map(([t, s, fn]) =>
    el('button', { class: 'demo-cell', onclick: fn }, el('b', {}, t), el('span', {}, s))));
  const body = el('div', { class: 'ip-body' }, grid, out);
  return el('div', {}, wrap, body);
}
