// core/ui.js — snackbars, modals, bottom sheets, context menus, feature tips
import { el, $ } from './utils.js';

/* ---------------- Snackbar ---------------- */
export function snackbar(text, { action, onAction, duration = 4000 } = {}) {
  const area = $('#snacks');
  const s = el('div', { class: 'snack' }, el('span', {}, text));
  if (action) {
    s.append(el('button', {
      onclick: () => { onAction?.(); dismiss(); },
    }, action));
  }
  area.append(s);
  let gone = false;
  function dismiss() {
    if (gone) return; gone = true;
    s.style.transition = 'opacity .2s, transform .2s';
    s.style.opacity = '0'; s.style.transform = 'translateY(8px)';
    setTimeout(() => s.remove(), 220);
  }
  setTimeout(dismiss, duration);
  return { dismiss };
}

/* ---------------- Modal dialog ---------------- */
export function modal({ title, body, actions = [], onClose, wide = false }) {
  const root = $('#modal-root');
  root.innerHTML = '';
  const close = (value) => {
    root.classList.remove('open'); root.innerHTML = '';
    document.removeEventListener('keydown', onKey);
    onClose?.(value);
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const m = el('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true' },
    title ? el('h3', {}, title) : null,
    el('div', { class: 'm-body' }, body),
  );
  if (actions.length) {
    m.append(el('div', { class: 'm-actions' },
      actions.map((a) => el('button', {
        class: a.class || (a.primary ? 'primary' : ''),
        onclick: async () => {
          const r = await a.onClick?.();
          if (r !== false) close(a.value ?? a.label);
        },
      }, a.label))));
  }
  root.append(
    el('div', { class: 'modal-scrim', onclick: () => close() }),
    m,
  );
  root.classList.add('open');
  document.addEventListener('keydown', onKey);
  const first = m.querySelector('input, select, textarea');
  if (first) setTimeout(() => first.focus(), 60);
  return { close, el: m };
}

export function confirmDialog(title, text, { okLabel = 'OK', danger = false } = {}) {
  return new Promise((resolve) => {
    modal({
      title,
      body: el('p', { style: { margin: '0' } }, text),
      actions: [
        { label: 'Cancel', onClick: () => { resolve(false); } },
        { label: okLabel, class: danger ? 'danger' : 'primary', onClick: () => { resolve(true); } },
      ],
      onClose: () => resolve(false),
    });
  });
}

/* ---------------- Bottom sheet ---------------- */
export function sheet({ title, titleIcon, rows, grid, onClose }) {
  document.querySelectorAll('.sheet-wrap').forEach((n) => n.remove());
  const wrap = el('div', { class: 'sheet-wrap' });
  const close = () => { wrap.remove(); onClose?.(); };
  const sh = el('div', { class: 'sheet', role: 'dialog' },
    el('div', { class: 'grab' }),
    title ? el('div', { class: 'sh-title' }, titleIcon || null, el('span', { style: { flex: '1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, title)) : null,
  );
  if (rows?.length) {
    for (const r of rows) {
      if (r === '-') { sh.append(el('div', { class: 'mhr' })); continue; }
      sh.append(el('button', {
        class: 'sh-row',
        onclick: () => { close(); r.onClick?.(); },
      },
        r.icon ? el('span', { class: 'r-ic' }, r.icon) : null,
        el('span', { class: 'r-main' }, r.label, r.sub ? el('div', { class: 'r-sub' }, r.sub) : null),
      ));
    }
  }
  if (grid?.length) {
    sh.append(el('div', { class: 'sh-grid' },
      grid.map((g) => el('button', {
        class: 'sh-cell',
        onclick: () => { close(); g.onClick?.(); },
      }, el('span', { class: 'r-ic' }, g.icon), el('span', {}, g.label)))));
  }
  if (typeof arguments[0]?.custom === 'function') {
    sh.append(arguments[0].custom(close));
  }
  wrap.append(el('div', { class: 'sheet-scrim', onclick: close }), sh);
  document.body.append(wrap);
  wrap.classList.add('open');
  return { close, el: sh };
}

/* ---------------- Context menu ---------------- */
let ctxOpen = null;
export function contextMenu(x, y, items) {
  closeContextMenu();
  const root = $('#ctx-root');
  const menu = el('div', { class: 'ctx-menu', role: 'menu' });
  for (const it of items) {
    if (it === '-') { menu.append(el('div', { class: 'mhr' })); continue; }
    menu.append(el('button', {
      class: 'mi' + (it.danger ? ' danger' : ''),
      onclick: () => { closeContextMenu(); it.onClick?.(); },
    }, it.icon || null, el('span', { class: 'grow' }, it.label)));
  }
  root.innerHTML = '';
  root.append(menu);
  root.classList.add('open');
  const r = menu.getBoundingClientRect();
  menu.style.left = Math.max(8, Math.min(x, innerWidth - r.width - 8)) + 'px';
  menu.style.top = Math.max(8, Math.min(y, innerHeight - r.height - 8)) + 'px';
  ctxOpen = menu;
  const off = (e) => { if (!menu.contains(e.target)) closeContextMenu(); };
  setTimeout(() => {
    document.addEventListener('pointerdown', off, { once: true });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeContextMenu(); }, { once: true });
  }, 0);
}
export function closeContextMenu() {
  $('#ctx-root')?.classList.remove('open');
  const r = $('#ctx-root'); if (r) r.innerHTML = '';
  ctxOpen = null;
}
export function bindScrimClose(rootSel) {
  $(rootSel)?.addEventListener('pointerdown', (e) => { if (e.target === e.currentTarget) closeContextMenu(); });
}

/* ---------------- Feature-engagement tips (IPH bubbles) ---------------- */
export function showTip({ id, anchor, title, text, below = true, onDone }) {
  const layer = $('#tip-layer');
  layer.innerHTML = '';
  const rect = anchor.getBoundingClientRect();
  const bubble = el('div', { class: 'tip-bubble' + (below ? '' : ' below') },
    el('b', {}, title),
    el('div', {}, text),
    el('div', { class: 't-act' }, el('button', {
      onclick: () => { layer.classList.remove('open'); layer.innerHTML = ''; onDone?.(); },
    }, 'Got it')),
  );
  layer.append(bubble);
  layer.classList.add('open');
  const br = bubble.getBoundingClientRect();
  let left = Math.min(Math.max(10, rect.left + rect.width / 2 - 40), innerWidth - br.width - 10);
  bubble.style.left = left + 'px';
  if (below) bubble.style.top = Math.min(rect.bottom + 12, innerHeight - br.height - 10) + 'px';
  else bubble.style.top = Math.max(10, rect.top - br.height - 12) + 'px';
  bubble.style.setProperty('--anchor-x', (rect.left + rect.width / 2 - left) + 'px');
}
