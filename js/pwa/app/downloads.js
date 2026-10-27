// app/downloads.js — download manager: streaming fetch + IndexedDB blobs + pause/resume
import { DB, saveSoon, uid } from '../core/store.js';
import { el, icon, faviconEl, timeAgo, formatBytes, hostOf, DANGEROUS_EXT } from '../core/utils.js';
import { snackbar, confirmDialog } from '../core/ui.js';
import { navigate } from './views.js';

const IDB_NAME = 'orca-downloads';
const active = new Map(); // id -> {controller, received, reader}

function idb() {
  return new Promise((res, rej) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore('files');
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}
async function putBlob(id, blob) {
  const db = await idb();
  return new Promise((res, rej) => {
    const tx = db.transaction('files', 'readwrite');
    tx.objectStore('files').put(blob, id);
    tx.oncomplete = res; tx.onerror = () => rej(tx.error);
  });
}
async function getBlob(id) {
  const db = await idb();
  return new Promise((res, rej) => {
    const req = db.transaction('files', 'readonly').objectStore('files').get(id);
    req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error);
  });
}
async function delBlob(id) {
  const db = await idb();
  return new Promise((res) => {
    const tx = db.transaction('files', 'readwrite');
    tx.objectStore('files').delete(id);
    tx.oncomplete = res;
  });
}

export const Downloads = {
  async start(tab, url, name) {
    const fileName = name || decodeURIComponent(url.split('/').pop().split('?')[0] || 'download');
    const danger = DANGEROUS_EXT.test(fileName);
    if (danger) {
      const ok = await confirmDialog(
        'This file may be dangerous',
        `“${fileName}” is a type of file that can harm your device. Keep it anyway?`,
        { okLabel: 'Keep file', danger: true });
      if (!ok) return;
    }
    const d = {
      id: uid(), name: fileName, url, size: 0, received: 0,
      mime: '', state: 'downloading', time: Date.now(), danger, error: null,
    };
    DB.downloads.unshift(d);
    saveSoon();
    snackbar(`Downloading ${fileName}`);
    window.dispatchEvent(new CustomEvent('orca:dl-update'));
    this._run(d).then(async (blob) => {
      if (blob) {
        await putBlob(d.id, blob);
        d.state = 'done'; d.received = blob.size; if (!d.size) d.size = blob.size;
        saveSoon(); snackbar(`Downloaded ${d.name}`, { action: 'Open', onAction: () => Downloads.open(d.id) });
      }
      active.delete(d.id);
      window.dispatchEvent(new CustomEvent('orca:dl-update'));
    });
    return d;
  },

  async _run(d) {
    const controller = new AbortController();
    const state = { controller };
    active.set(d.id, state);
    const prior = d.received;
    const chunks = [];
    let received = 0;
    let mime = '';
    let resumed = false;
    try {
      const headers = {};
      if (prior > 0) headers.Range = `bytes=${prior}-`;
      const res = await fetch(d.url, { signal: controller.signal, headers, mode: 'cors' });
      if (!res.ok && !(res.status === 206 && prior > 0)) throw new Error(`HTTP ${res.status}`);
      mime = res.headers.get('content-type')?.split(';')[0] || '';
      d.mime = mime;
      resumed = res.status === 206 && prior > 0;
      const total = Number(res.headers.get('content-length') || 0);
      d.size = resumed ? prior + total : total;
      const reader = res.body ? res.body.getReader() : null;
      state.reader = reader;
      if (reader) {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          received += value.byteLength;
          d.received = (resumed ? prior : 0) + received;
          window.dispatchEvent(new CustomEvent('orca:dl-update'));
        }
      } else {
        const buf = await res.arrayBuffer();
        chunks.push(new Uint8Array(buf));
        d.received = (resumed ? prior : 0) + buf.byteLength;
      }
      if (d.state === 'cancelled') return null;
      const type = mime || 'application/octet-stream';
      if (d.state === 'paused') {
        await putBlob(d.id + '-partial', new Blob(chunks, { type }));
        return null;
      }
      d.state = 'done';
      if (resumed) {
        const part = await getBlob(d.id + '-partial');
        await delBlob(d.id + '-partial');
        return new Blob(part ? [part, ...chunks] : chunks, { type });
      }
      return new Blob(chunks, { type });
    } catch (e) {
      // aborted mid-stream while pausing → keep the chunks we got
      if (d.state === 'paused' && chunks.length) {
        await putBlob(d.id + '-partial', new Blob(chunks, { type: mime || 'application/octet-stream' }));
        return null;
      }
      if (d.state === 'paused' || d.state === 'cancelled') return null;
      d.state = 'failed';
      d.error = e.name === 'AbortError' ? 'Cancelled' : (navigator.onLine ? `Failed — ${e.message}. The server may block cross-origin downloads (CORS).` : 'Failed — you are offline');
      saveSoon();
      window.dispatchEvent(new CustomEvent('orca:dl-update'));
      return null;
    }
  },

  pause(id) {
    const d = DB.downloads.find((x) => x.id === id);
    const s = active.get(id);
    if (!d || !s) return;
    d.state = 'paused';
    s.controller.abort(); // reader errors → _run stores partial blob
    saveSoon();
    window.dispatchEvent(new CustomEvent('orca:dl-update'));
  },
  resume(id) {
    const d = DB.downloads.find((x) => x.id === id);
    if (!d) return;
    d.state = 'downloading'; d.error = null;
    saveSoon();
    this._run(d).then(async (blob) => {
      if (blob) {
        await putBlob(d.id, blob);
        d.state = 'done'; d.received = blob.size; if (!d.size) d.size = blob.size;
        saveSoon();
        snackbar(`Downloaded ${d.name}`, { action: 'Open', onAction: () => Downloads.open(d.id) });
      }
      active.delete(d.id);
      window.dispatchEvent(new CustomEvent('orca:dl-update'));
    });
    window.dispatchEvent(new CustomEvent('orca:dl-update'));
  },
  cancel(id) {
    const d = DB.downloads.find((x) => x.id === id);
    if (!d) return;
    d.state = 'cancelled';
    active.get(id)?.controller.abort();
    active.delete(id);
    saveSoon();
    window.dispatchEvent(new CustomEvent('orca:dl-update'));
  },
  async remove(id) {
    active.get(id)?.controller.abort();
    active.delete(id);
    await delBlob(id);
    DB.downloads = DB.downloads.filter((x) => x.id !== id);
    saveSoon();
    window.dispatchEvent(new CustomEvent('orca:dl-update'));
  },
  async open(id) {
    const d = DB.downloads.find((x) => x.id === id);
    if (!d) return;
    const blob = await getBlob(id);
    if (!blob) { snackbar('File data not found (cleared cache?)'); return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = d.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  },
};

function fileIcon(name) {
  const ext = (name.split('.').pop() || '').toLowerCase();
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return icon('image');
  if (['zip', 'gz', 'tar', '7z'].includes(ext)) return icon('folder');
  if (['pdf', 'txt', 'md', 'html', 'json'].includes(ext)) return icon('article');
  if (DANGEROUS_EXT.test(name)) return icon('warn');
  return icon('download');
}

export function renderDownloadsPage(tab) {
  const wrap = el('div', { class: 'ipage' });
  const head = el('div', { class: 'ip-head' }, el('h1', {}, 'Downloads'));
  const body = el('div', { class: 'ip-body' });

  // quick-start row: sample files + custom URL
  head.append(el('button', {
    class: 'ibtn-sm', onclick: () => {
      const sample = new Blob([`Orca Orca Web — sample download\n\nGenerated ${new Date().toISOString()}\n\nThis text file was created and downloaded entirely inside the app: fetched, streamed, stored in IndexedDB, and re-exported via the system download dialog.\n`], { type: 'text/plain' });
      const url = URL.createObjectURL(sample);
      Downloads.start(tab, url, 'orca-sample.txt').finally(() => setTimeout(() => URL.revokeObjectURL(url), 30000));
    },
  }, 'Sample file'));
  head.append(el('button', {
    class: 'ibtn-sm', onclick: async () => {
      const { modal } = await import('../core/ui.js');
      const input = el('input', { type: 'url', placeholder: 'https://example.com/file.pdf' });
      modal({
        title: 'Download from URL',
        body: el('div', {}, el('label', { class: 'f' }, 'File URL'), input, el('p', { class: 'sub' }, 'The server must allow cross-origin fetches (CORS), like most CDNs. Otherwise the download fails with a network error.')),
        actions: [{ label: 'Cancel' }, { label: 'Download', primary: true, onClick: () => { if (!input.value.trim()) return false; Downloads.start(tab, input.value.trim()); } }],
      });
    },
  }, 'From URL…'));
  head.append(el('button', { class: 'ibtn-sm', onclick: () => navigate(tab, 'orca://offline') }, 'Offline pages'));

  const listCard = el('div', { class: 'ip-card' });
  body.append(el('div', { class: 'ip-sec-h' }, 'Files'), listCard);
  body.append(renderOfflineSection(tab, false));

  function renderList() {
    listCard.innerHTML = '';
    if (!DB.downloads.length) {
      listCard.append(el('div', { class: 'iempty' }, el('div', { class: 'big' }, '⬇️'), 'Nothing downloaded yet.', el('br'), 'Try “Sample file”, or long-press any link → Download link.'));
      return;
    }
    for (const d of DB.downloads) {
      const pct = d.size ? Math.round((d.received / d.size) * 100) : 0;
      const prog = el('div', { class: 'dl-prog' + (d.size ? '' : ' indet') }, el('div', { class: 'p', style: { width: (d.size ? pct : 30) + '%' } }));
      const row = el('div', { class: 'irow', style: { cursor: 'default', flexWrap: 'wrap' } },
        el('span', { class: 'r-ic', style: d.danger ? { color: 'var(--danger)' } : {} }, fileIcon(d.name)),
        el('span', { class: 'r-main' },
          el('div', { class: 'r-title', style: d.danger ? { color: 'var(--danger)' } : {} }, d.name),
          el('div', { class: 'r-sub' },
            d.state === 'done' ? `${formatBytes(d.size)} · ${timeAgo(d.time)} · ${hostOf(d.url) || 'local'}`
            : d.state === 'downloading' ? `${formatBytes(d.received)}${d.size ? ' / ' + formatBytes(d.size) + ' · ' + pct + '%' : ''} · downloading…`
            : d.state === 'paused' ? `Paused · ${formatBytes(d.received)}${d.size ? ' / ' + formatBytes(d.size) : ''}`
            : d.state === 'cancelled' ? 'Cancelled'
            : (d.error || 'Failed')),
          (d.state === 'downloading' || d.state === 'paused') ? prog : null,
          d.danger ? el('div', { class: 'r-sub', style: { color: 'var(--danger)' } }, 'This type of file can harm your device') : null),
        el('span', { class: 'r-end' },
          d.state === 'downloading' ? el('button', { class: 'ibtn-sm', onclick: () => Downloads.pause(d.id) }, 'Pause') : null,
          d.state === 'paused' ? el('button', { class: 'ibtn-sm', onclick: () => Downloads.resume(d.id) }, 'Resume') : null,
          d.state === 'downloading' || d.state === 'paused' ? el('button', { class: 'ibtn-sm danger', onclick: () => Downloads.cancel(d.id) }, 'Cancel') : null,
          d.state === 'done' ? el('button', { class: 'ibtn-sm', onclick: () => Downloads.open(d.id) }, 'Open') : null,
          d.state === 'failed' ? el('button', { class: 'ibtn-sm', onclick: () => { d.state = 'downloading'; d.received = 0; d.error = null; Downloads.resume(d.id); } }, 'Retry') : null,
          el('button', { class: 'ibtn-sm danger', onclick: async () => { await Downloads.remove(d.id); } }, 'Delete')));
      listCard.append(row);
    }
  }
  renderList();
  const onUpd = () => { if (wrap.isConnected) renderList(); else window.removeEventListener('orca:dl-update', onUpd); };
  window.addEventListener('orca:dl-update', onUpd);
  wrap.append(head, body);
  return wrap;
}

export function renderOfflineSection(tab, standalone) {
  const sec = el('div', {});
  sec.append(el('div', { class: 'ip-sec-h' }, standalone ? 'Saved for offline reading' : 'Offline pages'));
  const card = el('div', { class: 'ip-card' });
  sec.append(card);
  if (!DB.offline.length) {
    card.append(el('div', { class: 'iempty' }, el('div', { class: 'big' }, '📥'), 'No offline pages.', el('br'), 'Save articles from the feed, or use ⋮ → Save page offline.'));
    return sec;
  }
  for (const o of [...DB.offline].sort((a, b) => b.time - a.time)) {
    card.append(el('button', { class: 'irow', onclick: () => navigate(tab, o.url) },
      el('span', { class: 'r-ic' }, faviconEl(o.url, 18)),
      el('span', { class: 'r-main' }, el('div', { class: 'r-title' }, o.title), el('div', { class: 'r-sub' }, `Saved ${timeAgo(o.time)} · ${formatBytes(o.size || 0)}`)),
      el('span', { class: 'r-end' }, el('button', {
        class: 'ibtn-sm danger', onclick: async (e) => {
          e.stopPropagation();
          DB.offline = DB.offline.filter((x) => x.id !== o.id);
          saveSoon();
          navigator.serviceWorker?.controller?.postMessage({ type: 'DELETE_OFFLINE_PAGE', url: o.url });
          refresh();
        },
      }, 'Delete'))));
  }
  function refresh() {
    const fresh = renderOfflineSection(tab, standalone);
    sec.replaceWith(fresh);
  }
  return sec;
}
