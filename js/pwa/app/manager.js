// app/manager.js — data-management & settings pages (orca://bookmarks, history, settings/* …)
import { DB, saveSoon, uid, setting, SEARCH_ENGINES } from '../core/store.js';
import { el, icon, faviconEl, timeAgo, dayLabel, hostOf, originOf, formatBytes, LANG_NAMES, copyText, escapeHtml } from '../core/utils.js';
import { snackbar, modal, confirmDialog, sheet } from '../core/ui.js';
import { Tabs } from './tabs.js';
import { navigate, engineName } from './views.js';
import { renderDownloadsPage, renderOfflineSection } from './downloads.js';
import { renderAccountCard, renderSyncPage } from './sync.js';

export function render(tab, url) {
  const p = url.toLowerCase();
  if (p === 'orca://bookmarks') return bookmarksPage(tab);
  if (p === 'orca://history') return historyPage(tab);
  if (p === 'orca://downloads') return renderDownloadsPage(tab);
  if (p === 'orca://offline') return offlinePage(tab);
  if (p === 'orca://passwords') return passwordsPage(tab);
  if (p === 'orca://autofill') return autofillPage(tab);
  if (p === 'orca://payments') return paymentsPage(tab);
  if (p === 'orca://site-data') return siteDataPage(tab);
  if (p === 'orca://settings' || p === 'orca://settings/') return settingsHome(tab);
  if (p.startsWith('orca://settings/site/')) return siteSettingPage(tab, p.slice('orca://settings/site/'.length));
  if (p === 'orca://settings/site') return siteSettingsHome(tab);
  if (p === 'orca://settings/search') return searchEnginePage(tab);
  if (p === 'orca://settings/homepage') return homepagePage(tab);
  if (p === 'orca://settings/notifications') return notificationsPage(tab);
  if (p === 'orca://settings/sync') return renderSyncPage(tab);
  if (p === 'orca://settings/privacy') return privacyPage(tab);
  if (p === 'orca://settings/accessibility') return accessibilityPage(tab);
  if (p === 'orca://settings/datasaver') return dataSaverPage(tab);
  if (p === 'orca://settings/downloads') return downloadSettingsPage(tab);
  if (p === 'orca://settings/languages') return languagesPage(tab);
  if (p === 'orca://settings/appearance') return appearancePage(tab);
  if (p === 'orca://settings/about' || p === 'orca://about') return aboutPage(tab);
  return notFound(url);
}

/* ---------------- shared builders ---------------- */
function shell(title, searchPlaceholder) {
  const wrap = el('div', { class: 'ipage' });
  const head = el('div', { class: 'ip-head' }, el('h1', {}, title));
  let input = null;
  if (searchPlaceholder) {
    input = el('input', { placeholder: searchPlaceholder, 'aria-label': searchPlaceholder });
    head.append(el('div', { class: 'ip-search' }, icon('search'), input));
  }
  const body = el('div', { class: 'ip-body' });
  wrap.append(head, body);
  return { wrap, head, body, input };
}

function rowNav(tab, { ic, title, sub, url, onClick }) {
  return el('button', { class: 'irow', onclick: onClick || (() => navigate(tab, url)) },
    el('span', { class: 'r-ic' }, typeof ic === 'string' ? icon(ic) : ic),
    el('span', { class: 'r-main' }, el('div', { class: 'r-title' }, title), sub ? el('div', { class: 'r-sub' }, sub) : null),
    icon('chevron', 'chev'));
}

function rowToggle({ ic, title, sub, path, onChange }) {
  const input = el('input', { type: 'checkbox' });
  input.checked = !!setting(path);
  input.addEventListener('change', () => {
    setting(path, input.checked);
    onChange?.(input.checked);
  });
  return el('div', { class: 'irow', style: { cursor: 'default' }, onclick: (e) => { if (e.target.tagName !== 'INPUT') input.click(); } },
    ic ? el('span', { class: 'r-ic' }, icon(ic)) : null,
    el('span', { class: 'r-main' }, el('div', { class: 'r-title' }, title), sub ? el('div', { class: 'r-sub' }, sub) : null),
    el('span', { class: 'sw' }, input, el('span', { class: 'tr' }), el('span', { class: 'th' })));
}

function notFound(url) {
  const { wrap, body } = shell('Page not found');
  body.append(el('div', { class: 'iempty' }, el('div', { class: 'big' }, '🧭'), `No internal page matches`, el('br'), el('code', { style: { userSelect: 'text' } }, url)));
  return wrap;
}

/* ================= Bookmarks ================= */
function bookmarksPage(tab, folderId = null) {
  const { wrap, body, input } = shell('Bookmarks', 'Search bookmarks');
  const folders = DB.bookmarks.filter((b) => b.type === 'folder' && b.parentId === folderId);
  const items = DB.bookmarks.filter((b) => b.type === 'bm' && b.parentId === folderId);

  if (folderId) {
    const folder = DB.bookmarks.find((b) => b.id === folderId);
    body.append(el('div', { class: 'ip-card' },
      el('button', { class: 'irow', onclick: () => rerender(tab, 'orca://bookmarks') },
        el('span', { class: 'r-ic' }, icon('back')),
        el('span', { class: 'r-main' }, el('div', { class: 'r-title' }, `Folder: ${folder?.title || ''}`)))));
  }

  const renderList = (filter = '') => {
    body.querySelectorAll('[data-list]')?.forEach((n) => n.remove());
    const listWrap = el('div', { dataset: { list: '1' } });
    const q = filter.trim().toLowerCase();
    const showFolders = folderId === null && !q;
    const match = (b) => !q || b.title.toLowerCase().includes(q) || (b.url || '').toLowerCase().includes(q);
    const fs = (q ? DB.bookmarks.filter((b) => b.type === 'folder') : folders).filter(match);
    const bs = (q ? DB.bookmarks.filter((b) => b.type === 'bm') : items).filter(match);

    if (showFolders || q) {
      if (fs.length) listWrap.append(el('div', { class: 'ip-sec-h' }, 'Folders'));
      const fc = el('div', { class: 'ip-card' });
      for (const f of fs) {
        const count = DB.bookmarks.filter((b) => b.parentId === f.id).length;
        const row = el('button', { class: 'irow', onclick: () => rerenderFolder(tab, f.id) },
          el('span', { class: 'r-ic' }, icon('folder')),
          el('span', { class: 'r-main' }, el('div', { class: 'r-title' }, f.title), el('div', { class: 'r-sub' }, `${count} item${count === 1 ? '' : 's'}`)),
          icon('chevron', 'chev'));
        row.addEventListener('contextmenu', (e) => { e.preventDefault(); bookmarkItemMenu(tab, f); });
        fc.append(row);
      }
      if (fs.length) listWrap.append(fc);
    }

    listWrap.append(el('div', { class: 'ip-sec-h' }, folderId ? 'In this folder' : 'Bookmarks'));
    const bc = el('div', { class: 'ip-card' });
    if (!bs.length) bc.append(el('div', { class: 'iempty' }, el('div', { class: 'big' }, '🔖'), 'No bookmarks here yet.', el('br'), 'Use ⋮ → ★ Bookmark this tab on any page.'));
    for (const b of bs) {
      const row = el('button', { class: 'irow', onclick: () => navigate(tab, b.url) },
        el('span', { class: 'r-ic' }, faviconEl(b.url, 18)),
        el('span', { class: 'r-main' }, el('div', { class: 'r-title' }, b.title), el('div', { class: 'r-sub' }, b.url)),
        el('span', { class: 'r-end' }, el('button', { class: 'ibtn-sm', onclick: (e) => { e.stopPropagation(); bookmarkItemMenu(tab, b); } }, 'Edit')));
      row.addEventListener('contextmenu', (e) => { e.preventDefault(); bookmarkItemMenu(tab, b); });
      bc.append(row);
    }
    listWrap.append(bc);
    body.append(listWrap);
  };
  input.addEventListener('input', () => renderList(input.value));

  const actions = el('div', { style: { display: 'flex', gap: '8px', padding: '4px 6px 0' } },
    el('button', { class: 'ibtn-sm', onclick: () => bookmarkDialog(tab, { parentId: folderId }) }, '+ Add bookmark'),
    el('button', { class: 'ibtn-sm', onclick: () => folderDialog(tab, folderId) }, '+ New folder'));
  body.append(actions);
  renderList();
  return wrap;
}

function rerender(tab, url) { navigate(tab, url, { replace: true }); }
function rerenderFolder(tab, folderId) {
  const view = tab.el;
  const hostEl = view?.querySelector('.scroll-host');
  if (!hostEl) return;
  hostEl.innerHTML = '';
  hostEl.append(bookmarksPage(tab, folderId));
  hostEl.scrollTop = 0;
}

function folderOptions(selected) {
  const sel = el('select', {},
    el('option', { value: '' }, 'Bookmarks bar'),
    DB.bookmarks.filter((b) => b.type === 'folder').map((f) => el('option', { value: f.id, selected: f.id === selected ? true : null }, f.title)));
  return sel;
}

function bookmarkDialog(tab, bm = {}) {
  const title = el('input', { type: 'text', value: bm.title || '' });
  const url = el('input', { type: 'url', value: bm.url || '' });
  const folder = folderOptions(bm.parentId);
  modal({
    title: bm.id ? 'Edit bookmark' : 'Add bookmark',
    body: el('div', {},
      el('label', { class: 'f' }, 'Name'), title,
      el('label', { class: 'f' }, 'URL'), url,
      el('label', { class: 'f' }, 'Folder'), folder),
    actions: [{ label: 'Cancel' }, {
      label: 'Save', primary: true, onClick: () => {
        if (!url.value.trim()) return false;
        if (bm.id) Object.assign(bm, { title: title.value.trim() || url.value, url: url.value.trim(), parentId: folder.value || null });
        else DB.bookmarks.push({ id: uid(), type: 'bm', title: title.value.trim() || url.value.trim(), url: url.value.trim(), parentId: folder.value || null, order: DB.bookmarks.length });
        saveSoon();
        snackbar('Bookmark saved');
        refreshPage(tab);
      },
    }],
  });
}

function folderDialog(tab, parentId = null, existing = null) {
  const name = el('input', { type: 'text', value: existing?.title || '', placeholder: 'Folder name' });
  modal({
    title: existing ? 'Rename folder' : 'New folder',
    body: el('div', {}, el('label', { class: 'f' }, 'Name'), name),
    actions: [{ label: 'Cancel' }, {
      label: 'Save', primary: true, onClick: () => {
        if (!name.value.trim()) return false;
        if (existing) existing.title = name.value.trim();
        else DB.bookmarks.push({ id: uid(), type: 'folder', title: name.value.trim(), parentId, order: DB.bookmarks.length });
        saveSoon(); refreshPage(tab);
      },
    }],
  });
}

function bookmarkItemMenu(tab, b) {
  sheet({
    title: b.title,
    rows: [
      b.type === 'bm' ? { label: 'Open in new tab', icon: icon('openNew'), onClick: () => Tabs.create({ url: b.url }) } : null,
      { label: b.type === 'folder' ? 'Rename' : 'Edit', icon: icon('edit'), onClick: () => b.type === 'folder' ? folderDialog(tab, null, b) : bookmarkDialog(tab, b) },
      b.type === 'bm' ? { label: 'Copy link', icon: icon('copy'), onClick: async () => { await copyText(b.url); snackbar('Link copied'); } } : null,
      b.type === 'bm' ? {
        label: 'Move to folder', icon: icon('folder'), onClick: () => {
          const folder = folderOptions(b.parentId);
          modal({
            title: 'Move to folder',
            body: el('div', {}, folder),
            actions: [{ label: 'Cancel' }, { label: 'Move', primary: true, onClick: () => { b.parentId = folder.value || null; saveSoon(); refreshPage(tab); } }],
          });
        },
      } : null,
      '-',
      {
        label: 'Delete', icon: icon('delete'), onClick: async () => {
          if (await confirmDialog('Delete bookmark', `Delete “${b.title}”?`, { okLabel: 'Delete', danger: true })) {
            if (b.type === 'folder') DB.bookmarks = DB.bookmarks.filter((x) => x.id !== b.id && x.parentId !== b.id);
            else DB.bookmarks = DB.bookmarks.filter((x) => x.id !== b.id);
            saveSoon(); refreshPage(tab); snackbar('Deleted');
          }
        },
      },
    ].filter(Boolean),
  });
}

function refreshPage(tab) {
  const entry = tab.stack[tab.sIndex];
  if (!entry) return;
  const view = tab.el;
  const hostEl = view?.querySelector('.scroll-host');
  if (hostEl) { hostEl.innerHTML = ''; hostEl.append(render(tab, entry.url)); }
}

/* ================= History ================= */
function historyPage(tab) {
  const { wrap, head, body, input } = shell('History', 'Search history');
  let selecting = false;
  const selected = new Set();

  const clearBtn = el('button', { class: 'ibtn-sm', onclick: () => clearBrowsingDataDialog(tab) }, 'Clear browsing data');
  head.append(clearBtn);

  function renderList() {
    body.innerHTML = '';
    const q = (input.value || '').trim().toLowerCase();
    const items = DB.history.filter((h) => !q || h.title.toLowerCase().includes(q) || h.url.toLowerCase().includes(q));
    if (!items.length) {
      body.append(el('div', { class: 'iempty' }, el('div', { class: 'big' }, '🕘'), q ? 'No matching history' : 'Pages you visit appear here.', el('br'), 'Incognito tabs are never saved.'));
      return;
    }
    let lastDay = '';
    let card = null;
    for (const h of items.slice(0, 400)) {
      const day = dayLabel(h.time);
      if (day !== lastDay) {
        lastDay = day;
        body.append(el('div', { class: 'ip-sec-h' }, day));
        card = el('div', { class: 'ip-card' });
        body.append(card);
      }
      const row = el('button', { class: 'irow', onclick: () => { if (selecting) { toggleSel(h.id, row); } else navigate(tab, h.url); } },
        selecting ? el('input', { type: 'checkbox', checked: selected.has(h.id) ? true : null, style: { width: '18px', height: '18px', accentColor: 'var(--accent)' } }) : null,
        el('span', { class: 'r-ic' }, faviconEl(h.url, 18)),
        el('span', { class: 'r-main' }, el('div', { class: 'r-title' }, h.title || h.url), el('div', { class: 'r-sub' }, new Date(h.time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) + ' · ' + hostOf(h.url))),
        selecting ? null : el('span', { class: 'r-end' }, el('button', {
          class: 'ibtn-sm danger', onclick: (e) => {
            e.stopPropagation();
            DB.history = DB.history.filter((x) => x.id !== h.id);
            saveSoon(); renderList();
          },
        }, 'Delete')));
      row.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        sheet({ title: h.title || h.url, rows: [
          { label: 'Open in new tab', icon: icon('openNew'), onClick: () => Tabs.create({ url: h.url }) },
          { label: 'Open in incognito tab', icon: icon('incognito'), onClick: () => Tabs.create({ url: h.url, incognito: true }) },
          { label: 'Copy link', icon: icon('copy'), onClick: async () => { await copyText(h.url); snackbar('Link copied'); } },
          '-',
          { label: 'Remove from history', icon: icon('delete'), onClick: () => { DB.history = DB.history.filter((x) => x.id !== h.id); saveSoon(); renderList(); } },
        ] });
      });
      card.append(row);
    }
  }

  function toggleSel(id, row) {
    if (selected.has(id)) selected.delete(id); else selected.add(id);
    row.querySelector('input[type=checkbox]').checked = selected.has(id);
    selBtn.textContent = `Done (${selected.size})`;
  }

  const selBtn = el('button', {
    class: 'ibtn-sm',
    onclick: () => {
      if (!selecting) { selecting = true; selBtn.textContent = 'Done (0)'; delSel.style.display = ''; }
      else { selecting = false; selected.clear(); selBtn.textContent = 'Select'; delSel.style.display = 'none'; }
      renderList();
    },
  }, 'Select');
  const delSel = el('button', {
    class: 'ibtn-sm danger', style: { display: 'none' },
    onclick: async () => {
      if (!selected.size) return;
      if (await confirmDialog('Delete history', `Delete ${selected.size} item${selected.size === 1 ? '' : 's'}?`, { okLabel: 'Delete', danger: true })) {
        DB.history = DB.history.filter((h) => !selected.has(h.id));
        selected.clear(); saveSoon(); selecting = false; selBtn.textContent = 'Select'; delSel.style.display = 'none';
        renderList();
      }
    },
  }, 'Delete selected');
  head.append(selBtn, delSel);
  input.addEventListener('input', renderList);
  renderList();
  return wrap;
}

/* ---------------- Clear browsing data ---------------- */
export function clearBrowsingDataDialog(tab) {
  const range = el('select', {},
    ...[['Last hour', 3600e3], ['Last 24 hours', 86400e3], ['Last 7 days', 7 * 86400e3], ['Last 4 weeks', 28 * 86400e3], ['All time', Infinity]]
      .map(([l, ms], i) => el('option', { value: String(ms), selected: i === 4 ? true : null }, l)));
  const boxes = {
    history: el('input', { type: 'checkbox', checked: true }),
    cookies: el('input', { type: 'checkbox' }),
    cache: el('input', { type: 'checkbox' }),
    passwords: el('input', { type: 'checkbox' }),
    autofill: el('input', { type: 'checkbox' }),
    siteSettings: el('input', { type: 'checkbox' }),
  };
  const line = (input, label, sub) => el('label', { class: 'checkline' }, input, el('span', {}, label, sub ? el('div', { class: 'sub', style: { fontSize: '12px', color: 'var(--soft)' } }, sub) : null));
  modal({
    title: 'Clear browsing data',
    body: el('div', {},
      el('label', { class: 'f' }, 'Time range'), range,
      line(boxes.history, 'Browsing history', `${DB.history.length} items`),
      line(boxes.cookies, 'Cookies and site data', 'Signs you out of most sites (demo)'),
      line(boxes.cache, 'Cached images and files', 'Clears the service-worker runtime cache'),
      line(boxes.passwords, 'Saved passwords', `${DB.passwords.length} passwords`),
      line(boxes.autofill, 'Autofill form data', `${DB.addresses.length} addresses, ${DB.cards.length} cards`),
      line(boxes.siteSettings, 'Site settings', 'Per-site permissions and content settings')),
    actions: [{ label: 'Cancel' }, {
      label: 'Clear data', class: 'danger', onClick: async () => {
        const since = Number(range.value);
        const cutoff = since === Infinity ? 0 : Date.now() - since;
        if (boxes.history.checked) DB.history = DB.history.filter((h) => h.time < cutoff);
        if (boxes.cookies.checked) { DB.siteData = {}; snackbar('Cookies and site data cleared'); }
        if (boxes.cache.checked) {
          if ('caches' in window) {
            const keys = await caches.keys();
            await Promise.all(keys.filter((k) => k.includes('runtime')).map((k) => caches.delete(k)));
          }
        }
        if (boxes.passwords.checked) DB.passwords = [];
        if (boxes.autofill.checked) { DB.addresses = []; DB.cards = []; }
        if (boxes.siteSettings.checked) DB.sitePerms = {};
        saveSoon();
        snackbar('Browsing data cleared');
        if (tab) refreshPage(tab);
      },
    }],
  });
}

/* ================= Passwords ================= */
const LEAKED = ['password', '123456', 'qwerty', 'letmein', '111111', 'iloveyou', 'admin', 'welcome'];

function passwordsPage(tab) {
  const { wrap, head, body, input } = shell('Password manager', 'Search passwords');
  head.append(el('button', { class: 'ibtn-sm', onclick: () => passwordDialog(tab) }, '+ Add'));

  const settingsCard = el('div', { class: 'ip-card' },
    rowToggle({ ic: 'key', title: 'Save passwords', sub: 'Offer to save passwords you enter', path: 'savePasswords' }),
    rowToggle({ ic: 'person', title: 'Auto Sign-in', sub: 'Automatically sign in to saved sites', path: 'autoSignIn' }),
  );
  body.append(el('div', { class: 'ip-sec-h' }, 'Settings'), settingsCard);

  body.append(el('div', { class: 'ip-sec-h' }, 'Password check'));
  body.append(el('div', { class: 'ip-card' },
    el('button', {
      class: 'irow', onclick: () => {
        const weak = DB.passwords.filter((p) => LEAKED.includes(p.password.toLowerCase()) || p.password.length < 6);
        modal({
          title: 'Password check',
          body: DB.passwords.length === 0
            ? el('p', {}, 'No saved passwords to check.')
            : weak.length
              ? el('div', {}, el('p', {}, `⚠️ ${weak.length} of ${DB.passwords.length} saved passwords appear in known data leaks or are too short:`),
                el('div', { class: 'm-list' }, weak.map((p) => el('div', { style: { padding: '8px 6px', fontSize: '13.5px' } }, `• ${p.origin} (${p.username})`))))
              : el('p', {}, `✅ All ${DB.passwords.length} saved passwords passed the leak check.`),
          actions: [{ label: 'OK', primary: true }],
        });
      },
    },
      el('span', { class: 'r-ic' }, icon('shield')),
      el('span', { class: 'r-main' }, el('div', { class: 'r-title' }, 'Check passwords'), el('div', { class: 'r-sub' }, 'Find leaked or weak passwords')),
      icon('chevron', 'chev'))));

  const listSec = el('div', { class: 'ip-sec-h' }, 'Saved passwords');
  body.append(listSec);
  const card = el('div', { class: 'ip-card' });
  body.append(card);

  function renderList() {
    card.innerHTML = '';
    const q = (input.value || '').trim().toLowerCase();
    const items = DB.passwords.filter((p) => !q || p.origin.includes(q) || p.username.toLowerCase().includes(q));
    if (!items.length) { card.append(el('div', { class: 'iempty' }, el('div', { class: 'big' }, '🔑'), 'No passwords saved yet.')); return; }
    for (const p of items) {
      const shown = { v: false };
      const sub = el('div', { class: 'r-sub', style: { userSelect: 'text' } }, '••••••••');
      const row = el('button', { class: 'irow' },
        el('span', { class: 'r-ic' }, faviconEl(p.origin, 18)),
        el('span', { class: 'r-main' }, el('div', { class: 'r-title' }, p.origin), el('div', { class: 'r-sub' }, p.username), sub),
        el('span', { class: 'r-end' },
          el('button', { class: 'ibtn-sm', onclick: (e) => { e.stopPropagation(); shown.v = !shown.v; sub.textContent = shown.v ? p.password : '••••••••'; e.currentTarget.textContent = shown.v ? 'Hide' : 'Show'; } }, 'Show'),
          el('button', { class: 'ibtn-sm', onclick: (e) => { e.stopPropagation(); passwordDialog(tab, p); } }, 'Edit')));
      row.addEventListener('click', (e) => {
        if (e.target.closest('.ibtn-sm')) return;
        sheet({ title: `${p.username} @ ${p.origin}`, rows: [
          { label: 'Copy username', icon: icon('copy'), onClick: () => copyText(p.username).then(() => snackbar('Username copied')) },
          { label: 'Copy password', icon: icon('key'), onClick: () => copyText(p.password).then(() => snackbar('Password copied')) },
          { label: 'Edit', icon: icon('edit'), onClick: () => passwordDialog(tab, p) },
          '-',
          { label: 'Delete', icon: icon('delete'), onClick: async () => { if (await confirmDialog('Delete password', `Delete the saved password for ${p.username} on ${p.origin}?`, { okLabel: 'Delete', danger: true })) { DB.passwords = DB.passwords.filter((x) => x.id !== p.id); saveSoon(); renderList(); } } },
        ] });
      });
      card.append(row);
    }
  }
  input.addEventListener('input', renderList);
  renderList();
  return wrap;
}

function passwordDialog(tab, p = null) {
  const origin = el('input', { type: 'text', value: p?.origin || '', placeholder: 'example.com' });
  const user = el('input', { type: 'text', value: p?.username || '' });
  const pass = el('input', { type: 'text', value: p?.password || '' });
  modal({
    title: p ? 'Edit password' : 'Add password',
    body: el('div', {},
      el('label', { class: 'f' }, 'Site'), origin,
      el('label', { class: 'f' }, 'Username'), user,
      el('label', { class: 'f' }, 'Password'), pass),
    actions: [{ label: 'Cancel' }, {
      label: 'Save', primary: true, onClick: () => {
        if (!origin.value.trim() || !user.value.trim()) return false;
        if (p) Object.assign(p, { origin: origin.value.trim(), username: user.value.trim(), password: pass.value });
        else DB.passwords.push({ id: uid(), origin: origin.value.trim(), username: user.value.trim(), password: pass.value, time: Date.now() });
        saveSoon(); snackbar('Password saved'); refreshPage(tab);
      },
    }],
  });
}

/* ================= Autofill (addresses) ================= */
function autofillPage(tab) {
  const { wrap, head, body } = shell('Addresses and more');
  head.append(el('button', { class: 'ibtn-sm', onclick: () => addressDialog(tab) }, '+ Add address'));
  const card = el('div', { class: 'ip-card' });
  body.append(el('div', { class: 'ip-sec-h' }, 'Saved addresses'), card);
  function renderList() {
    card.innerHTML = '';
    if (!DB.addresses.length) { card.append(el('div', { class: 'iempty' }, el('div', { class: 'big' }, '🏠'), 'No addresses saved.')); return; }
    for (const a of DB.addresses) {
      card.append(el('button', {
        class: 'irow', onclick: () => addressDialog(tab, a),
      },
        el('span', { class: 'r-ic' }, icon('address')),
        el('span', { class: 'r-main' }, el('div', { class: 'r-title' }, a.name), el('div', { class: 'r-sub' }, `${a.addr}, ${a.city} ${a.zip}`)),
        el('span', { class: 'r-end' }, el('button', { class: 'ibtn-sm danger', onclick: async (e) => { e.stopPropagation(); if (await confirmDialog('Delete address', `Delete the address for ${a.name}?`, { okLabel: 'Delete', danger: true })) { DB.addresses = DB.addresses.filter((x) => x.id !== a.id); saveSoon(); renderList(); } } }, 'Delete'))));
    }
  }
  renderList();
  body.append(el('div', { class: 'ip-sec-h' }, 'Try it'));
  body.append(el('div', { class: 'ip-card' },
    el('button', { class: 'irow', onclick: () => autofillDemo(tab) },
      el('span', { class: 'r-ic' }, icon('star')),
      el('span', { class: 'r-main' }, el('div', { class: 'r-title' }, 'Autofill demo form'), el('div', { class: 'r-sub' }, 'See Orca fill a checkout form')),
      icon('chevron', 'chev'))));
  return wrap;
}

function addressDialog(tab, a = null) {
  const f = (label, key, ph = '') => {
    const input = el('input', { type: 'text', value: a?.[key] || '', placeholder: ph });
    return { input, node: el('div', {}, el('label', { class: 'f' }, label), input) };
  };
  const name = f('Name', 'name'), addr = f('Street address', 'addr'), city = f('City', 'city'),
    zip = f('ZIP / postal code', 'zip'), country = f('Country', 'country'), phone = f('Phone', 'phone'), email = f('Email', 'email');
  modal({
    title: a ? 'Edit address' : 'Add address',
    body: el('div', {}, name.node, addr.node, city.node, zip.node, country.node, phone.node, email.node),
    actions: [{ label: 'Cancel' }, {
      label: 'Save', primary: true, onClick: () => {
        if (!name.input.value.trim()) return false;
        const data = { name: name.input.value.trim(), addr: addr.input.value, city: city.input.value, zip: zip.input.value, country: country.input.value, phone: phone.input.value, email: email.input.value };
        if (a) Object.assign(a, data); else DB.addresses.push({ id: uid(), ...data });
        saveSoon(); snackbar('Address saved'); refreshPage(tab);
      },
    }],
  });
}

function autofillDemo(tab) {
  if (!DB.addresses.length) { snackbar('Add an address first'); return; }
  const inputs = {};
  const form = el('div', {},
    ...[['Full name', 'name'], ['Street address', 'addr'], ['City', 'city'], ['ZIP', 'zip'], ['Country', 'country'], ['Phone', 'phone'], ['Email', 'email']]
      .map(([label, key]) => { inputs[key] = el('input', { type: 'text', autocomplete: 'off' }); return el('div', {}, el('label', { class: 'f' }, label), inputs[key]); }));
  const pick = el('select', {}, DB.addresses.map((a) => el('option', { value: a.id }, a.name)));
  modal({
    title: 'Checkout demo',
    body: el('div', {},
      el('label', { class: 'f' }, 'Autofill profile'), pick,
      el('button', {
        class: 'ibtn-sm', style: { margin: '8px 0' }, onclick: () => {
          const a = DB.addresses.find((x) => x.id === pick.value);
          if (a) for (const k of Object.keys(inputs)) inputs[k].value = a[k] || '';
          snackbar('Form filled by Orca Autofill');
        },
      }, '⚡ Fill form'),
      form),
    actions: [{ label: 'Close' }, { label: 'Place order', primary: true, onClick: () => snackbar('🎉 Demo order placed') }],
  });
}

/* ================= Payment methods ================= */
function paymentsPage(tab) {
  const { wrap, head, body } = shell('Payment methods');
  head.append(el('button', { class: 'ibtn-sm', onclick: () => cardDialog(tab) }, '+ Add card'));
  const card = el('div', { class: 'ip-card' });
  body.append(el('div', { class: 'ip-sec-h' }, 'Saved cards'), card);
  function renderList() {
    card.innerHTML = '';
    if (!DB.cards.length) { card.append(el('div', { class: 'iempty' }, el('div', { class: 'big' }, '💳'), 'No cards saved. Card numbers stay on this device.')); return; }
    for (const c of DB.cards) {
      card.append(el('button', { class: 'irow', onclick: () => cardDialog(tab, c) },
        el('span', { class: 'r-ic' }, icon('card')),
        el('span', { class: 'r-main' }, el('div', { class: 'r-title' }, `${c.nick || 'Card'} ···· ${c.number.slice(-4)}`), el('div', { class: 'r-sub' }, `${c.name} · expires ${c.exp}`)),
        el('span', { class: 'r-end' }, el('button', { class: 'ibtn-sm danger', onclick: async (e) => { e.stopPropagation(); if (await confirmDialog('Delete card', `Delete card ending in ${c.number.slice(-4)}?`, { okLabel: 'Delete', danger: true })) { DB.cards = DB.cards.filter((x) => x.id !== c.id); saveSoon(); renderList(); } } }, 'Delete'))));
    }
  }
  renderList();
  body.append(el('div', { class: 'ip-sec-h' }, 'Payment Request API'));
  body.append(el('div', { class: 'ip-card', style: { padding: '14px 16px', fontSize: '13.5px', color: 'var(--soft)', lineHeight: '1.6' } },
    `Payment Request API: ${window.PaymentRequest ? '✅ supported by this browser' : '❌ not supported here'}. Sites that use it can check out with your saved methods, subject to your confirmation.`));
  return wrap;
}

function cardDialog(tab, c = null) {
  const nick = el('input', { type: 'text', value: c?.nick || '', placeholder: 'e.g. Personal Visa' });
  const num = el('input', { type: 'text', value: c?.number || '', placeholder: '1234 5678 9012 3456', inputmode: 'numeric' });
  const name = el('input', { type: 'text', value: c?.name || '', placeholder: 'Name on card' });
  const exp = el('input', { type: 'text', value: c?.exp || '', placeholder: 'MM/YY' });
  modal({
    title: c ? 'Edit card' : 'Add card',
    body: el('div', {}, el('label', { class: 'f' }, 'Nickname'), nick, el('label', { class: 'f' }, 'Card number'), num, el('label', { class: 'f' }, 'Name on card'), name, el('label', { class: 'f' }, 'Expiry'), exp,
      el('p', { class: 'sub' }, 'Stored locally only — never leaves this device in this build.')),
    actions: [{ label: 'Cancel' }, {
      label: 'Save', primary: true, onClick: () => {
        const digits = num.value.replace(/\D/g, '');
        if (digits.length < 12) { snackbar('Enter a valid card number'); return false; }
        const data = { nick: nick.value.trim(), number: digits, name: name.value.trim(), exp: exp.value.trim() };
        if (c) Object.assign(c, data); else DB.cards.push({ id: uid(), ...data });
        saveSoon(); snackbar('Card saved'); refreshPage(tab);
      },
    }],
  });
}

/* ================= Offline pages ================= */
function offlinePage(tab) {
  const { wrap, body } = shell('Offline pages');
  body.append(renderOfflineSection(tab, true));
  return wrap;
}

/* ================= Site storage ================= */
function siteDataPage(tab) {
  const { wrap, head, body } = shell('Site storage');
  head.append(el('button', {
    class: 'ibtn-sm danger', onclick: async () => {
      if (await confirmDialog('Delete all site data', 'Remove stored data for every site?', { okLabel: 'Delete all', danger: true })) {
        DB.siteData = {}; saveSoon(); refreshPage(tab); snackbar('Site data cleared');
      }
    },
  }, 'Delete all'));
  const card = el('div', { class: 'ip-card' });
  body.append(el('div', { class: 'ip-sec-h' }, 'Sites with stored data'), card);
  const origins = Object.keys(DB.siteData);
  if (!origins.length) card.append(el('div', { class: 'iempty' }, el('div', { class: 'big' }, '🍪'), 'No site data recorded yet.', el('br'), 'Grant a permission or visit sites to see storage here.'));
  for (const o of origins) {
    const d = DB.siteData[o];
    card.append(el('div', { class: 'irow', style: { cursor: 'default' } },
      el('span', { class: 'r-ic' }, faviconEl(o, 18)),
      el('span', { class: 'r-main' }, el('div', { class: 'r-title' }, o), el('div', { class: 'r-sub' }, `${d.cookies || 0} cookies · ${formatBytes(d.storage || 0)} storage`)),
      el('span', { class: 'r-end' }, el('button', { class: 'ibtn-sm danger', onclick: async () => { delete DB.siteData[o]; saveSoon(); refreshPage(tab); } }, 'Delete'))));
  }
  return wrap;
}

/* ================= Settings ================= */
function settingsHome(tab) {
  const { wrap, body } = shell('Settings');
  body.append(renderAccountCard(tab));

  body.append(el('div', { class: 'ip-sec-h' }, 'Basics'));
  body.append(el('div', { class: 'ip-card' },
    rowNav(tab, { ic: 'search', title: 'Search engine', sub: engineName(), url: 'orca://settings/search' }),
    rowNav(tab, { ic: 'key', title: 'Passwords', sub: `${DB.passwords.length} saved`, url: 'orca://passwords' }),
    rowNav(tab, { ic: 'card', title: 'Payment methods', sub: `${DB.cards.length} saved`, url: 'orca://payments' }),
    rowNav(tab, { ic: 'address', title: 'Addresses and more', sub: `${DB.addresses.length} saved`, url: 'orca://autofill' }),
    rowNav(tab, { ic: 'sync', title: 'Sync and services', sub: DB.account ? `Syncing to ${DB.account.email}` : 'Not signed in', url: 'orca://settings/sync' }),
    rowNav(tab, { ic: 'bell', title: 'Notifications', sub: DB.settings.notifGlobal ? 'On' : 'Off', url: 'orca://settings/notifications' }),
    rowNav(tab, { ic: 'home', title: 'Home page', sub: DB.settings.showHomeButton ? (DB.settings.homepage === 'orca://newtab' ? 'New Tab page' : DB.settings.homepage) : 'Hidden', url: 'orca://settings/homepage' }),
    rowNav(tab, { ic: 'star', title: 'Appearance', sub: `${DB.settings.dark === 'system' ? 'System default' : DB.settings.dark === 'on' ? 'Dark' : 'Light'} theme`, url: 'orca://settings/appearance' }),
  ));

  body.append(el('div', { class: 'ip-sec-h' }, 'Advanced'));
  body.append(el('div', { class: 'ip-card' },
    rowNav(tab, { ic: 'lock', title: 'Privacy and security', url: 'orca://settings/privacy' }),
    rowNav(tab, { ic: 'person', title: 'Accessibility', sub: `Text scaling ${DB.settings.textScale}%`, url: 'orca://settings/accessibility' }),
    rowNav(tab, { ic: 'globe', title: 'Site settings', url: 'orca://settings/site' }),
    rowNav(tab, { ic: 'download', title: 'Data Saver', sub: DB.settings.dataSaver ? `On · ${formatBytes(DB.dataSaved)} saved` : 'Off', url: 'orca://settings/datasaver' }),
    rowNav(tab, { ic: 'download', title: 'Downloads', sub: DB.settings.downloadDir, url: 'orca://settings/downloads' }),
    rowNav(tab, { ic: 'lang', title: 'Languages', sub: LANG_NAMES[DB.settings.lang] || 'English', url: 'orca://settings/languages' }),
  ));

  body.append(el('div', { class: 'ip-sec-h' }, 'About'));
  body.append(el('div', { class: 'ip-card' },
    rowNav(tab, { ic: 'info', title: 'About Orca', sub: 'Version, legal, help', url: 'orca://settings/about' }),
  ));
  return wrap;
}

function searchEnginePage(tab) {
  const { wrap, body } = shell('Search engine');
  const card = el('div', { class: 'ip-card' });
  const engines = [
    ...Object.entries(SEARCH_ENGINES).map(([id, e]) => ({ id, name: e.name, url: e.url })),
    ...DB.settings.customEngines.map((e) => ({ id: e.id, name: e.name, url: e.url, custom: true })),
  ];
  for (const e of engines) {
    const radio = el('input', { type: 'radio', name: 'engine' });
    radio.checked = DB.settings.engine === e.id;
    const line = el('label', { class: 'radioline', style: { padding: '13px 16px' } }, radio,
      el('span', { style: { flex: '1' } }, e.name, el('div', { class: 'sub', style: { fontSize: '12px', color: 'var(--soft)' } }, e.url.replace('%s', '…'))),
      e.custom ? el('button', { class: 'ibtn-sm danger', onclick: (ev) => { ev.preventDefault(); DB.settings.customEngines = DB.settings.customEngines.filter((x) => x.id !== e.id); if (DB.settings.engine === e.id) setting('engine', 'google'); saveSoon(); refreshPage(tab); } }, 'Remove') : null);
    radio.addEventListener('change', () => { setting('engine', e.id); snackbar(`Default search engine: ${e.name}`); });
    card.append(line);
  }
  body.append(el('div', { class: 'ip-sec-h' }, 'Default'), card);

  const nameI = el('input', { type: 'text', placeholder: 'Name (e.g. Brave Search)' });
  const urlI = el('input', { type: 'text', placeholder: 'URL with %s — e.g. https://search.brave.com/search?q=%s' });
  body.append(el('div', { class: 'ip-sec-h' }, 'Add custom search engine'));
  body.append(el('div', { class: 'ip-card', style: { padding: '14px 16px' } },
    nameI, el('div', { style: { height: '8px' } }), urlI,
    el('div', { style: { textAlign: 'right', marginTop: '10px' } },
      el('button', {
        class: 'ibtn-sm', onclick: () => {
          if (!nameI.value.trim() || !urlI.value.includes('%s')) { snackbar('Enter a name and a URL containing %s'); return; }
          const ce = { id: 'custom-' + uid(), name: nameI.value.trim(), url: urlI.value.trim() };
          DB.settings.customEngines.push(ce); setting('engine', ce.id);
          snackbar(`${ce.name} added and set as default`);
          refreshPage(tab);
        },
      }, 'Add & set default'))));

  body.append(el('div', { class: 'ip-sec-h' }, 'Suggestions'));
  body.append(el('div', { class: 'ip-card' },
    rowToggle({ title: 'Search suggestions', sub: 'Show suggestions as you type in the address bar', path: 'searchSuggest' }),
    rowToggle({ title: 'Navigation error suggestions', sub: 'Suggest similar pages when an address fails', path: 'navErrorSuggest' })));
  return wrap;
}

function homepagePage(tab) {
  const { wrap, body } = shell('Home page');
  const urlI = el('input', { type: 'text', value: DB.settings.homepage });
  const custom = el('label', { class: 'radioline', style: { padding: '13px 16px' } },
    el('input', { type: 'radio', name: 'hp' }), el('span', { style: { flex: '1' } }, 'Custom page'), );
  const ntp = el('label', { class: 'radioline', style: { padding: '13px 16px' } },
    el('input', { type: 'radio', name: 'hp' }), el('span', { style: { flex: '1' } }, 'New Tab page', el('div', { class: 'sub', style: { fontSize: '12px', color: 'var(--soft)' } }, 'orca://newtab')));
  const [rCustom, rNtp] = [custom.querySelector('input'), ntp.querySelector('input')];
  const isNtp = DB.settings.homepage === 'orca://newtab';
  rNtp.checked = isNtp; rCustom.checked = !isNtp;
  urlI.disabled = isNtp;
  rNtp.addEventListener('change', () => { setting('homepage', 'orca://newtab'); urlI.disabled = true; });
  rCustom.addEventListener('change', () => { urlI.disabled = false; urlI.focus(); });
  urlI.addEventListener('change', () => { if (urlI.value.trim()) setting('homepage', urlI.value.trim()); });
  body.append(el('div', { class: 'ip-sec-h' }, 'When you tap Home'));
  body.append(el('div', { class: 'ip-card' }, ntp, custom, el('div', { style: { padding: '0 16px 14px' } }, urlI)));
  body.append(el('div', { class: 'ip-sec-h' }, 'Toolbar'));
  body.append(el('div', { class: 'ip-card' },
    rowToggle({ title: 'Show home button', sub: 'Display a home button in the toolbar', path: 'showHomeButton', onChange: () => window.dispatchEvent(new CustomEvent('orca:toolbar-settings')) })));
  return wrap;
}

function notificationsPage(tab) {
  const { wrap, body } = shell('Notifications');
  body.append(el('div', { class: 'ip-sec-h' }, 'App notifications'));
  body.append(el('div', { class: 'ip-card' },
    rowToggle({ title: 'Show notifications', sub: 'Media controls, downloads, and site pushes', path: 'notifGlobal' }),
    el('button', {
      class: 'irow', onclick: async () => {
        const p = await Notification.requestPermission().catch(() => 'unsupported');
        snackbar('System permission: ' + p);
      },
    }, el('span', { class: 'r-ic' }, icon('bell')), el('span', { class: 'r-main' }, el('div', { class: 'r-title' }, 'System permission'), el('div', { class: 'r-sub' }, `Current: ${'Notification' in window ? Notification.permission : 'unsupported'}`))),
  ));
  body.append(el('div', { class: 'ip-sec-h' }, 'Sites'));
  const card = el('div', { class: 'ip-card' });
  const sites = Object.entries(DB.sitePerms).filter(([, v]) => v.notifications);
  if (!sites.length) card.append(el('div', { class: 'iempty' }, 'No sites have asked to send notifications.'));
  for (const [origin, perms] of sites) {
    card.append(el('div', { class: 'irow', style: { cursor: 'default' } },
      el('span', { class: 'r-ic' }, faviconEl(origin, 18)),
      el('span', { class: 'r-main' }, el('div', { class: 'r-title' }, origin)),
      el('span', { class: 'r-end' }, el('button', { class: 'ibtn-sm', onclick: () => { perms.notifications = perms.notifications === 'allow' ? 'block' : 'allow'; saveSoon(); refreshPage(tab); } }, perms.notifications === 'allow' ? 'Allowed' : 'Blocked'))));
  }
  body.append(card);
  if (DB.notifLog.length) {
    body.append(el('div', { class: 'ip-sec-h' }, 'Recent notifications'));
    const log = el('div', { class: 'ip-card' });
    for (const n of DB.notifLog.slice(0, 20)) {
      log.append(el('div', { class: 'irow', style: { cursor: 'default' } },
        el('span', { class: 'r-ic' }, icon('bell')),
        el('span', { class: 'r-main' }, el('div', { class: 'r-title' }, n.title), el('div', { class: 'r-sub' }, `${n.origin} · ${timeAgo(n.time)}`))));
    }
    body.append(log);
  }
  return wrap;
}

function privacyPage(tab) {
  const { wrap, body } = shell('Privacy and security');
  body.append(el('div', { class: 'ip-sec-h' }, 'Security'));
  body.append(el('div', { class: 'ip-card' },
    rowToggle({ ic: 'shield', title: 'Safe Browsing', sub: 'Warn before dangerous sites, downloads, and extensions', path: 'safeBrowsing' }),
    rowToggle({ ic: 'lock', title: 'Always use secure connections', sub: 'HTTPS-first mode: upgrade HTTP to HTTPS and warn on insecure sites', path: 'httpsFirst' }),
    el('button', { class: 'irow', onclick: () => clearBrowsingDataDialog(tab) },
      el('span', { class: 'r-ic' }, icon('delete')),
      el('span', { class: 'r-main' }, el('div', { class: 'r-title' }, 'Clear browsing data'), el('div', { class: 'r-sub' }, 'History, cookies, cache, passwords…')),
      icon('chevron', 'chev'))));
  body.append(el('div', { class: 'ip-sec-h' }, 'Preloading'));
  const preCard = el('div', { class: 'ip-card' });
  for (const [id, label, sub] of [
    ['standard', 'Standard preloading', 'Pages you’re likely to visit load in the background'],
    ['wifi', 'Preload on Wi-Fi only', 'Saves mobile data'],
    ['never', 'No preloading', 'Maximum privacy and data savings'],
  ]) {
    const r = el('input', { type: 'radio', name: 'preload' });
    r.checked = DB.settings.preload === id;
    r.addEventListener('change', () => { setting('preload', id); });
    preCard.append(el('label', { class: 'radioline', style: { padding: '13px 16px' } }, r,
      el('span', {}, label, el('div', { class: 'sub', style: { fontSize: '12px', color: 'var(--soft)' } }, sub))));
  }
  body.append(preCard);
  body.append(el('div', { class: 'ip-sec-h' }, 'Telemetry'));
  body.append(el('div', { class: 'ip-card' },
    rowToggle({ title: 'Send “Do Not Track” request', sub: 'Ask sites not to track you (they may ignore it)', path: 'doNotTrack' }),
    rowToggle({ title: 'Usage & crash reports', sub: 'Share anonymous stats to improve Orca', path: 'usageStats' })));
  return wrap;
}

function accessibilityPage(tab) {
  const { wrap, body } = shell('Accessibility');
  body.append(el('div', { class: 'ip-sec-h' }, 'Display'));
  const slider = el('input', { type: 'range', min: '50', max: '200', step: '5', value: String(DB.settings.textScale), style: { width: '100%', accentColor: 'var(--accent)' } });
  const val = el('span', { class: 'r-end' }, `${DB.settings.textScale}%`);
  slider.addEventListener('input', () => { val.textContent = slider.value + '%'; });
  slider.addEventListener('change', () => { setting('textScale', Number(slider.value)); window.dispatchEvent(new CustomEvent('orca:text-scale')); snackbar('Text scaling applies to pages in this browser'); });
  body.append(el('div', { class: 'ip-card' },
    el('div', { class: 'irow', style: { cursor: 'default' } },
      el('span', { class: 'r-ic' }, icon('zoomIn')),
      el('span', { class: 'r-main' }, el('div', { class: 'r-title' }, 'Text scaling'), el('div', { style: { padding: '8px 12px 0 0' } }, slider)), val),
    rowToggle({ title: 'Force enable zoom', sub: 'Override sites that disable pinch-to-zoom', path: 'forceZoom', onChange: () => window.dispatchEvent(new CustomEvent('orca:zoom-setting')) }),
    rowToggle({ title: 'Simplified view for web pages', sub: 'Offer reader mode on articles by default', path: 'simplifiedView' }),
    rowToggle({ title: 'Live captions', sub: 'Caption media audio on this device (where supported)', path: 'captions' })));
  body.append(el('div', { class: 'ip-sec-h' }, 'Navigation'));
  body.append(el('div', { class: 'ip-card' },
    rowToggle({ title: 'Swipe to navigate', sub: 'Edge-swipe for back and forward', path: 'swipeNav' }),
    rowToggle({ title: 'Pull to refresh', sub: 'Drag down on a page to reload it', path: 'pullRefresh' }),
    rowToggle({ title: 'Contextual search', sub: 'Tap selected text to search without leaving the page', path: 'contextualSearch' })));
  return wrap;
}

const SITE_TYPES = [
  ['cookies', 'Cookies', 'cookie', 'Small files sites store on your device'],
  ['javascript', 'JavaScript', 'article', 'Interactive features on sites'],
  ['popups', 'Pop-ups and redirects', 'openNew', 'New windows opened by sites'],
  ['ads', 'Ads', 'shield', 'Block ads on intrusive sites (built-in filter)'],
  ['sound', 'Sound', 'bell', 'Play audio'],
  ['location', 'Location', 'geo', 'Access your device location'],
  ['camera', 'Camera', 'cam', 'Use your camera'],
  ['mic', 'Microphone', 'mic', 'Use your microphone'],
  ['notifications', 'Notifications', 'bell', 'Send push notifications'],
  ['midi', 'MIDI devices', 'article', 'Control musical instruments'],
  ['clipboard', 'Clipboard', 'copy', 'Read text you copied'],
];

function siteSettingsHome(tab) {
  const { wrap, body } = shell('Site settings');
  body.append(el('div', { class: 'ip-sec-h' }, 'Content'));
  const c1 = el('div', { class: 'ip-card' });
  for (const [key, label, ic, sub] of SITE_TYPES.slice(0, 5)) {
    const def = DB.settings.defPerms[key];
    c1.append(rowNav(tab, { ic, title: label, sub: `${sub} · default: ${def}`, url: `orca://settings/site/${key}` }));
  }
  body.append(c1);
  body.append(el('div', { class: 'ip-sec-h' }, 'Permissions'));
  const c2 = el('div', { class: 'ip-card' });
  for (const [key, label, ic, sub] of SITE_TYPES.slice(5)) {
    const def = DB.settings.defPerms[key];
    c2.append(rowNav(tab, { ic, title: label, sub: `${sub} · default: ${def}`, url: `orca://settings/site/${key}` }));
  }
  body.append(c2);
  body.append(el('div', { class: 'ip-sec-h' }, 'Data'));
  body.append(el('div', { class: 'ip-card' },
    rowNav(tab, { ic: 'cookie', title: 'Data stored', sub: 'Cookies and storage per site', url: 'orca://site-data' })));
  return wrap;
}

function siteSettingPage(tab, key) {
  const meta = SITE_TYPES.find(([k]) => k === key);
  if (!meta) return notFound('orca://settings/site/' + key);
  const [, label, ic, desc] = meta;
  const { wrap, body } = shell(label);
  body.append(el('div', { class: 'ip-sec-h' }, `Default behavior — ${desc}`));
  const card = el('div', { class: 'ip-card' });
  const opts = key === 'javascript' || key === 'cookies' || key === 'sound' || key === 'ads' ? ['allow', 'block'] : ['ask', 'allow', 'block'];
  for (const o of opts) {
    const r = el('input', { type: 'radio', name: 'perm-' + key });
    r.checked = DB.settings.defPerms[key] === o;
    r.addEventListener('change', () => { setting(`defPerms.${key}`, o); });
    card.append(el('label', { class: 'radioline', style: { padding: '13px 16px' } }, r,
      el('span', {}, o === 'ask' ? 'Ask before allowing (recommended)' : o === 'allow' ? 'Allowed' : 'Blocked')));
  }
  body.append(card);

  if (key === 'ads') {
    body.append(el('div', { class: 'ip-sec-h' }, 'Built-in ad blocker'));
    body.append(el('div', { class: 'ip-card' },
      rowToggle({ title: 'Block ads and pop-ups', sub: 'Filters sponsored feed cards and known ad hosts', path: 'adBlock' })));
  }

  const exceptions = Object.entries(DB.sitePerms).filter(([, v]) => v[key]);
  body.append(el('div', { class: 'ip-sec-h' }, `Site exceptions (${exceptions.length})`));
  const exc = el('div', { class: 'ip-card' });
  if (!exceptions.length) exc.append(el('div', { class: 'iempty' }, 'No per-site exceptions. Sites ask when they need access.'));
  for (const [origin, perms] of exceptions) {
    exc.append(el('div', { class: 'irow', style: { cursor: 'default' } },
      el('span', { class: 'r-ic' }, faviconEl(origin, 18)),
      el('span', { class: 'r-main' }, el('div', { class: 'r-title' }, origin)),
      el('span', { class: 'r-end' },
        el('span', { style: { fontSize: '12.5px', color: 'var(--soft)', marginRight: '6px' } }, perms[key]),
        el('button', { class: 'ibtn-sm danger', onclick: () => { delete perms[key]; saveSoon(); refreshPage(tab); } }, 'Reset'))));
  }
  body.append(exc);
  return wrap;
}

function dataSaverPage(tab) {
  const { wrap, body } = shell('Data Saver');
  body.append(el('div', { class: 'ip-sec-h' }, 'Lite mode'));
  body.append(el('div', { class: 'ip-card' },
    rowToggle({ title: 'Data Saver', sub: 'Use less data by loading lightweight page previews', path: 'dataSaver' }),
    el('div', { class: 'irow', style: { cursor: 'default' } },
      el('span', { class: 'r-ic' }, icon('download')),
      el('span', { class: 'r-main' }, el('div', { class: 'r-title' }, 'Data saved this month'), el('div', { class: 'r-sub' }, formatBytes(DB.dataSaved) + ' (estimated)')))));
  body.append(el('div', { class: 'ip-card', style: { padding: '14px 16px', fontSize: '13px', color: 'var(--soft)', lineHeight: '1.6' } },
    'When Data Saver is on, Orca prefers text previews for heavy pages and defers images until you tap them — mirroring Chrome’s Lite mode behavior.'));
  return wrap;
}

function downloadSettingsPage(tab) {
  const { wrap, body } = shell('Downloads');
  body.append(el('div', { class: 'ip-sec-h' }, 'Location'));
  body.append(el('div', { class: 'ip-card' },
    el('div', { class: 'irow', style: { cursor: 'default' } },
      el('span', { class: 'r-ic' }, icon('folder')),
      el('span', { class: 'r-main' }, el('div', { class: 'r-title' }, 'Download location'), el('div', { class: 'r-sub' }, DB.settings.downloadDir + ' — exports use your system Downloads folder'))),
    rowToggle({ title: 'Ask where to save files', sub: 'Choose a location before each download', path: 'askDownloadLocation' })));
  body.append(el('div', { class: 'ip-sec-h' }, 'Manage'));
  body.append(el('div', { class: 'ip-card' },
    rowNav(tab, { ic: 'download', title: 'Open download manager', url: 'orca://downloads' })));
  return wrap;
}

function languagesPage(tab) {
  const { wrap, body } = shell('Languages');
  body.append(el('div', { class: 'ip-sec-h' }, 'Display language'));
  const sel = el('select', { style: { margin: '0 16px 14px', width: 'calc(100% - 32px)' } },
    Object.entries(LANG_NAMES).map(([code, name]) => el('option', { value: code, selected: DB.settings.lang === code ? true : null }, name)));
  sel.addEventListener('change', () => { setting('lang', sel.value); snackbar(`Display language: ${LANG_NAMES[sel.value]} (UI translations are illustrative)`); });
  body.append(el('div', { class: 'ip-card', style: { padding: '14px 0 4px' } }, sel));

  body.append(el('div', { class: 'ip-sec-h' }, 'Translate'));
  body.append(el('div', { class: 'ip-card' },
    rowToggle({ ic: 'translate', title: 'Offer to translate pages', sub: 'Show the translation bar on pages in other languages', path: 'offerTranslate' })));
  body.append(el('div', { class: 'ip-sec-h' }, 'Offer translation into'));
  const tcard = el('div', { class: 'ip-card' });
  for (const [code, name] of Object.entries(LANG_NAMES)) {
    if (code === DB.settings.lang) continue;
    const input = el('input', { type: 'checkbox' });
    input.checked = DB.settings.translateTargets.includes(code);
    input.addEventListener('change', () => {
      const set = new Set(DB.settings.translateTargets);
      input.checked ? set.add(code) : set.delete(code);
      setting('translateTargets', [...set]);
    });
    tcard.append(el('div', { class: 'irow', style: { cursor: 'default' }, onclick: (e) => { if (e.target.tagName !== 'INPUT') input.click(); } },
      el('span', { class: 'r-main' }, el('div', { class: 'r-title' }, name)),
      el('span', { class: 'sw' }, input, el('span', { class: 'tr' }), el('span', { class: 'th' }))));
  }
  body.append(tcard);
  return wrap;
}

function appearancePage(tab) {
  const { wrap, body } = shell('Appearance');
  body.append(el('div', { class: 'ip-sec-h' }, 'Theme'));
  const tcard = el('div', { class: 'ip-card' });
  for (const [id, label] of [['system', 'System default'], ['off', 'Light'], ['on', 'Dark']]) {
    const r = el('input', { type: 'radio', name: 'dark' });
    r.checked = DB.settings.dark === id;
    r.addEventListener('change', () => { setting('dark', id); window.dispatchEvent(new CustomEvent('orca:theme')); });
    tcard.append(el('label', { class: 'radioline', style: { padding: '13px 16px' } }, r, el('span', {}, label)));
  }
  body.append(tcard);
  body.append(el('div', { class: 'ip-sec-h' }, 'Layout'));
  body.append(el('div', { class: 'ip-card' },
    rowToggle({ title: 'Bottom toolbar', sub: 'Move the address bar to the bottom', path: 'bottomToolbar', onChange: () => window.dispatchEvent(new CustomEvent('orca:toolbar-settings')) }),
    rowToggle({ title: 'Auto-hide toolbar on scroll', sub: 'Fullscreen browsing as you scroll down', path: 'autoHideToolbar' }),
    rowToggle({ title: 'Darken websites', sub: 'Apply a dark filter to web page content', path: 'siteDarkening', onChange: (on) => document.documentElement.classList.toggle('site-dark', on) })));
  return wrap;
}

function aboutPage(tab) {
  const { wrap, body } = shell('About Orca');
  body.append(el('div', { class: 'ip-card', style: { padding: '20px 16px', textAlign: 'center' } },
    el('img', { src: '/IMG_7168.jpeg', alt: 'Orca', style: { width: '76px', height: '76px', borderRadius: '18px', boxShadow: 'var(--shadow-1)' } }),
    el('div', { style: { fontWeight: 700, fontSize: '17px', marginTop: '10px' } }, 'Orca Orca Web'),
    el('div', { style: { color: 'var(--soft)', fontSize: '13px', marginTop: '2px' } }, 'Version 1.0.1 (Web) · “Orca Ocean” design'),
    el('div', { style: { marginTop: '12px' } },
      el('button', {
        class: 'ibtn-sm', onclick: async () => {
          const reg = await navigator.serviceWorker?.getRegistration();
          if (!reg) { snackbar('Service worker not active'); return; }
          await reg.update();
          snackbar('Checked for updates — reload to apply');
        },
      }, 'Check for updates'))));
  body.append(el('div', { class: 'ip-sec-h' }, 'Legal'));
  body.append(el('div', { class: 'ip-card' },
    rowNav(tab, { ic: 'article', title: 'Open-source licenses', url: 'orca://licenses' }),
    el('button', { class: 'irow', onclick: () => modal({ title: 'Privacy policy', body: el('p', { style: { fontSize: '13.5px', lineHeight: '1.7' } }, 'Orca Orca Web stores your bookmarks, history, passwords, autofill data, and settings locally on this device (localStorage and IndexedDB). Nothing is transmitted to Orca servers. If you sign in, sync metadata stays on-device in this build. Clear everything anytime via Settings → Privacy → Clear browsing data, or “Reset app data” below.'), actions: [{ label: 'Close', primary: true }] }) },
      el('span', { class: 'r-ic' }, icon('lock')),
      el('span', { class: 'r-main' }, el('div', { class: 'r-title' }, 'Privacy policy')), icon('chevron', 'chev')),
    el('button', { class: 'irow', onclick: () => modal({ title: 'Terms of service', body: el('p', { style: { fontSize: '13.5px', lineHeight: '1.7' } }, 'Orca Orca Web is provided as-is, as a demonstration of web platform capabilities. Browsing arbitrary sites inside embedded frames is subject to those sites’ embedding policies. Be kind to the ocean. 🐋'), actions: [{ label: 'Close', primary: true }] }) },
      el('span', { class: 'r-ic' }, icon('article')),
      el('span', { class: 'r-main' }, el('div', { class: 'r-title' }, 'Terms of service')), icon('chevron', 'chev'))));
  body.append(el('div', { class: 'ip-sec-h' }, 'Support'));
  body.append(el('div', { class: 'ip-card' },
    rowNav(tab, { ic: 'help', title: 'Help & feedback', url: 'orca://help' }),
    rowToggle({ title: 'Share usage & crash reports', sub: 'Helps improve Orca (stored locally in this build)', path: 'crashReports' }),
    el('button', {
      class: 'irow', onclick: async () => {
        if (await confirmDialog('Reset app data', 'Erase all Orca data on this device (bookmarks, history, passwords, settings) and restart?', { okLabel: 'Erase everything', danger: true })) {
          const { resetAll } = await import('../core/store.js');
          resetAll();
        }
      },
    },
      el('span', { class: 'r-ic' }, icon('delete')),
      el('span', { class: 'r-main', style: { color: 'var(--danger)' } }, el('div', { class: 'r-title' }, 'Reset app data')))));
  return wrap;
}
