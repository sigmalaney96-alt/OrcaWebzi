// app/share.js — share sheet: Web Share, copy, QR, print, send-to-devices
import { $, el, icon, copyText } from '../core/utils.js';
import { snackbar, sheet } from '../core/ui.js';
import { drawQr } from '../core/qr.js';
import { sendTabToSelf } from './sync.js';
import { Tabs } from './tabs.js';
import { currentEntry } from './views.js';

export function openShare(tab) {
  const entry = currentEntry(tab);
  if (!entry) return;
  const url = entry.url;
  const title = tab.title || url;

  sheet({
    title: 'Share page',
    titleIcon: icon('share'),
    grid: [
      {
        label: 'Share via…', icon: icon('share'), onClick: async () => {
          if (navigator.share) {
            try { await navigator.share({ title, url: url.startsWith('http') ? url : location.origin + '/pwa' }); }
            catch (e) { if (e.name !== 'AbortError') snackbar('Share failed: ' + e.message); }
          } else {
            await copyText(url);
            snackbar('Sharing not supported — link copied instead');
          }
        },
      },
      {
        label: 'Copy link', icon: icon('copy'), onClick: async () => {
          await copyText(url);
          snackbar('Link copied to clipboard');
        },
      },
      { label: 'QR code', icon: icon('qr'), onClick: () => showQr(url) },
      {
        label: 'Print', icon: icon('print'), onClick: () => {
          const f = tab?.iframe;
          try { f?.contentWindow ? f.contentWindow.print() : window.print(); }
          catch { window.print(); }
        },
      },
      { label: 'Send to devices', icon: icon('devices'), onClick: () => sendTabToSelf(tab) },
      {
        label: 'Bookmark', icon: icon('bookmarkBorder'), onClick: () => {
          snackbar('Use ⋮ → “Bookmark this tab” to save it');
        },
      },
      {
        label: 'Save offline', icon: icon('offline'), onClick: () => {
          snackbar('Use ⋮ → “Save page offline”');
        },
      },
      {
        label: 'Download page', icon: icon('download'), onClick: () => {
          import('./downloads.js').then(({ Downloads }) => {
            if (url.startsWith('http')) Downloads.start(tab, url);
            else snackbar('Internal pages don’t need downloading — they’re part of the app');
          });
        },
      },
    ],
  });
}

function showQr(url) {
  const canvas = el('canvas', { width: '260', height: '260' });
  const ok = drawQr(canvas, url, { scale: 6, margin: 4 });
  sheet({
    title: 'QR code',
    titleIcon: icon('qr'),
    custom: (close) => el('div', {},
      ok
        ? el('div', { class: 'qr-box' }, canvas)
        : el('div', { class: 'iempty' }, 'URL too long for a QR code'),
      el('div', { style: { textAlign: 'center', color: 'var(--soft)', fontSize: '12.5px', wordBreak: 'break-all', padding: '0 26px 6px' } }, url),
      el('div', { style: { display: 'flex', justifyContent: 'center', gap: '10px', paddingBottom: '8px' } },
        ok ? el('button', {
          class: 'btn-mat ghost', onclick: () => {
            const a = el('a', { href: canvas.toDataURL('image/png'), download: 'orca-qr.png' });
            a.click();
          },
        }, 'Download PNG') : null,
        el('button', { class: 'btn-mat ghost', onclick: close }, 'Done'))),
  });
}
