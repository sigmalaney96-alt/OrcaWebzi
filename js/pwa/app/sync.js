// app/sync.js — account sign-in, sync toggles, send-tab-to-self
import { DB, saveSoon, uid, setting } from '../core/store.js';
import { el, icon, timeAgo } from '../core/utils.js';
import { snackbar, modal, confirmDialog, sheet } from '../core/ui.js';
import { navigate } from './views.js';

export function signInDialog(onDone) {
  const name = el('input', { type: 'text', placeholder: 'Name' });
  const email = el('input', { type: 'email', placeholder: 'Email address' });
  modal({
    title: 'Sign in to Orca',
    body: el('div', {},
      el('div', { style: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' } },
        el('img', { src: '/icons/icon-192.png', style: { width: '40px', height: '40px', borderRadius: '10px' } }),
        el('div', { style: { fontSize: '13px', color: 'var(--soft)', lineHeight: '1.5' } }, 'Sync bookmarks, passwords, history, tabs, and settings across your devices.')),
      el('label', { class: 'f' }, 'Name'), name,
      el('label', { class: 'f' }, 'Email'), email,
      el('p', { class: 'sub' }, 'In this web build your profile and data are stored locally on this device.')),
    actions: [
      { label: 'No thanks', onClick: () => { onDone?.(false); } },
      {
        label: 'Sign in', primary: true, onClick: () => {
          if (!/.+@.+\..+/.test(email.value.trim())) { snackbar('Enter a valid email address'); return false; }
          DB.account = {
            name: name.value.trim() || email.value.split('@')[0],
            email: email.value.trim(),
            avatarHue: Math.floor(Math.random() * 360),
            since: Date.now(), syncedAt: Date.now(),
          };
          saveSoon();
          snackbar(`Signed in as ${DB.account.email}`);
          onDone?.(true);
        },
      },
    ],
    onClose: () => onDone?.(false),
  });
}

export function renderAccountCard(tab) {
  const card = el('div', { class: 'ip-card', style: { marginTop: '8px' } });
  if (!DB.account) {
    card.append(el('button', { class: 'irow', onclick: () => signInDialog(() => refresh(tab)) },
      el('span', { class: 'r-ic' }, icon('person')),
      el('span', { class: 'r-main' },
        el('div', { class: 'r-title' }, 'Sign in to Orca'),
        el('div', { class: 'r-sub' }, 'Sync bookmarks, passwords, history, tabs & settings')),
      el('span', { class: 'r-end' }, el('span', { class: 'ibtn-sm', style: { color: 'var(--accent-ink)', fontWeight: 600 } }, 'Sign in'))));
  } else {
    card.append(el('button', { class: 'irow', onclick: () => navigate(tab, 'orca://settings/sync') },
      el('span', { class: 'r-ic' }, el('span', { style: { width: '26px', height: '26px', borderRadius: '50%', background: `hsl(${DB.account.avatarHue} 60% 45%)`, color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: '13px' } }, (DB.account.name[0] || 'O').toUpperCase())),
      el('span', { class: 'r-main' },
        el('div', { class: 'r-title' }, DB.account.name),
        el('div', { class: 'r-sub' }, `${DB.account.email} · syncing ${DB.settings.syncEverything ? 'everything' : 'selected items'}`)),
      icon('chevron', 'chev')));
  }
  return card;
}

export function renderSyncPage(tab) {
  const wrap = el('div', { class: 'ipage' });
  wrap.append(el('div', { class: 'ip-head' }, el('h1', {}, 'Sync and services')));
  const body = el('div', { class: 'ip-body' });
  wrap.append(body);

  if (!DB.account) {
    body.append(el('div', { class: 'iempty' }, el('div', { class: 'big' }, '🔐'), 'You’re not signed in.'));
    body.append(el('div', { style: { textAlign: 'center' } },
      el('button', { class: 'btn-mat', onclick: () => signInDialog(() => refresh(tab)) }, 'Sign in')));
    return wrap;
  }

  const a = DB.account;
  body.append(el('div', { class: 'ip-card', style: { padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' } },
    el('span', { style: { width: '44px', height: '44px', borderRadius: '50%', background: `hsl(${a.avatarHue} 60% 45%)`, color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: '18px' } }, (a.name[0] || 'O').toUpperCase()),
    el('div', { style: { flex: '1' } },
      el('div', { style: { fontWeight: 600 } }, a.name),
      el('div', { style: { color: 'var(--soft)', fontSize: '12.5px' } }, a.email),
      el('div', { style: { color: 'var(--soft)', fontSize: '12px' } }, `Last synced ${timeAgo(a.syncedAt)}`)),
    el('button', {
      class: 'ibtn-sm danger', onclick: async () => {
        if (await confirmDialog('Sign out?', 'Syncing stops. Local data stays on this device.', { okLabel: 'Sign out' })) {
          DB.account = null; saveSoon(); refresh(tab); snackbar('Signed out');
        }
      },
    }, 'Sign out')));

  body.append(el('div', { class: 'ip-sec-h' }, 'Sync'));
  const everything = el('input', { type: 'checkbox' });
  everything.checked = DB.settings.syncEverything;
  const toggles = [];
  const syncRow = (key, label) => {
    const input = el('input', { type: 'checkbox' });
    input.checked = DB.settings.sync[key];
    input.disabled = DB.settings.syncEverything;
    toggles.push(input);
    input.addEventListener('change', () => { setting(`sync.${key}`, input.checked); });
    return el('div', { class: 'irow', style: { cursor: 'default' }, onclick: (e) => { if (e.target.tagName !== 'INPUT' && !input.disabled) input.click(); } },
      el('span', { class: 'r-main' }, el('div', { class: 'r-title' }, label)),
      el('span', { class: 'sw' }, input, el('span', { class: 'tr' }), el('span', { class: 'th' })));
  };
  everything.addEventListener('change', () => {
    setting('syncEverything', everything.checked);
    toggles.forEach((t) => { t.disabled = everything.checked; });
  });
  body.append(el('div', { class: 'ip-card' },
    el('div', { class: 'irow', style: { cursor: 'default' }, onclick: (e) => { if (e.target.tagName !== 'INPUT') everything.click(); } },
      el('span', { class: 'r-ic' }, icon('sync')),
      el('span', { class: 'r-main' }, el('div', { class: 'r-title' }, 'Sync everything')),
      el('span', { class: 'sw' }, everything, el('span', { class: 'tr' }), el('span', { class: 'th' }))),
    syncRow('bookmarks', 'Bookmarks'),
    syncRow('passwords', 'Passwords'),
    syncRow('history', 'History'),
    syncRow('tabs', 'Open tabs'),
    syncRow('settings', 'Settings'),
    syncRow('autofill', 'Addresses and payment methods')));

  body.append(el('div', { style: { textAlign: 'center', margin: '14px 0' } },
    el('button', {
      class: 'btn-mat ghost', onclick: () => {
        DB.account.syncedAt = Date.now(); saveSoon();
        snackbar('Synced just now');
        refresh(tab);
      },
    }, '🔄 Sync now')));

  body.append(el('div', { class: 'ip-sec-h' }, 'Your devices'));
  const devs = el('div', { class: 'ip-card' });
  devs.append(el('div', { class: 'irow', style: { cursor: 'default' } },
    el('span', { class: 'r-ic' }, icon('devices')),
    el('span', { class: 'r-main' }, el('div', { class: 'r-title' }, 'This device'), el('div', { class: 'r-sub' }, 'Active now'))));
  for (const d of DB.recentDevices) {
    devs.append(el('button', { class: 'irow', onclick: () => navigate(tab, 'orca://recent') },
      el('span', { class: 'r-ic' }, icon('devices')),
      el('span', { class: 'r-main' }, el('div', { class: 'r-title' }, d.name), el('div', { class: 'r-sub' }, `${d.tabs.length} open tab${d.tabs.length === 1 ? '' : 's'} · tap to view`)),
      icon('chevron', 'chev')));
  }
  body.append(devs);

  body.append(el('div', { class: 'ip-sec-h' }, 'Backup'));
  body.append(el('div', { class: 'ip-card' },
    el('button', {
      class: 'irow', onclick: () => {
        const blob = new Blob([JSON.stringify(DB, null, 2)], { type: 'application/json' });
        const aEl = el('a', { href: URL.createObjectURL(blob), download: 'orca-sync-backup.json' });
        aEl.click(); setTimeout(() => URL.revokeObjectURL(aEl.href), 3000);
        snackbar('Exported a local sync snapshot');
      },
    },
      el('span', { class: 'r-ic' }, icon('download')),
      el('span', { class: 'r-main' }, el('div', { class: 'r-title' }, 'Export data snapshot'), el('div', { class: 'r-sub' }, 'JSON download of your Orca data')))));
  return wrap;
}

function refresh(tab) {
  import('./manager.js').then(() => {
    const view = tab.el;
    const hostEl = view?.querySelector('.scroll-host');
    if (hostEl) {
      hostEl.innerHTML = '';
      import('./manager.js').then((m) => hostEl.append(m.render(tab, tab.stack[tab.sIndex]?.url || 'orca://settings/sync')));
    }
  });
}

export function sendTabToSelf(tab) {
  const entry = tab.stack[tab.sIndex];
  if (!entry) return;
  if (!DB.account) {
    modal({
      title: 'Send tab to your devices',
      body: el('p', {}, 'Sign in to Orca to send tabs between your devices.'),
      actions: [{ label: 'Cancel' }, { label: 'Sign in', primary: true, onClick: () => signInDialog() }],
    });
    return;
  }
  const devices = [...DB.recentDevices];
  sheet({
    title: 'Send tab to your devices',
    rows: devices.map((d) => ({
      label: d.name,
      sub: d.kind === 'phone' ? 'Phone' : 'Computer',
      icon: icon('devices'),
      onClick: () => {
        DB.sentTabs.push({ id: uid(), url: entry.url, title: tab.title || entry.url, device: d.id, time: Date.now() });
        saveSoon();
        snackbar(`Sent to ${d.name}`, { action: 'View', onAction: () => navigate(tab, 'orca://recent') });
      },
    })),
  });
}
