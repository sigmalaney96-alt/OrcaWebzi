// app/gestures.js — pull-to-refresh, edge-swipe nav, toolbar auto-hide, long-press menus
import { DB } from '../core/store.js';
import { $, el, icon, copyText } from '../core/utils.js';
import { snackbar, contextMenu } from '../core/ui.js';
import { Tabs } from './tabs.js';
import { goBack, goForward, reloadTab, canBack, canFwd, navigate, currentEntry } from './views.js';
import { Downloads } from './downloads.js';

let content, ptr, toolbar;

export function initGestures() {
  content = $('#content');
  toolbar = $('#toolbar');
  ptr = $('#ptr');
  content.append(
    el('div', { class: 'edge-glow left', id: 'edge-left' }, icon('back')),
    el('div', { class: 'edge-glow right', id: 'edge-right' }, icon('forward')),
  );
  attachTouch();
  attachAutoHide();
  attachLongPress();
  attachSelectionSearch();
}

/* ---------------- pull to refresh + edge swipe ---------------- */
function attachTouch() {
  let startX = 0, startY = 0, mode = null, active = false;

  content.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    startX = t.clientX; startY = t.clientY;
    active = true; mode = null;
    const scrollHost = scrollableAt(e.target);
    if (DB.settings.pullRefresh && scrollHost && scrollHost.scrollTop <= 0 && !scrollHost.tagName?.includes('IFRAME')) {
      mode = 'ptr-candidate';
    }
    if (DB.settings.swipeNav && startX < 26) mode = 'swipe-back';
    else if (DB.settings.swipeNav && startX > innerWidth - 26) mode = 'swipe-fwd';
  }, { passive: true });

  content.addEventListener('touchmove', (e) => {
    if (!active) return;
    const t = e.touches[0];
    const dy = t.clientY - startY, dx = t.clientX - startX;
    if (mode === 'ptr-candidate' && dy > 30 && Math.abs(dx) < 40) {
      mode = 'ptr';
    }
    if (mode === 'ptr') {
      const d = Math.min(70, dy - 30);
      ptr.classList.add('show');
      ptr.style.transform = `translateX(-50%) translateY(${d}px)`;
      ptr.classList.toggle('spin', d >= 65);
    }
    if (mode === 'swipe-back' && dx > 26 && Math.abs(dy) < 60) $('#edge-left').classList.add('show');
    if (mode === 'swipe-fwd' && dx < -26 && Math.abs(dy) < 60) $('#edge-right').classList.add('show');
  }, { passive: true });

  content.addEventListener('touchend', (e) => {
    const t = e.changedTouches[0];
    const dy = t.clientY - startY, dx = t.clientX - startX;
    const tab = Tabs.active();
    if (mode === 'ptr') {
      if (dy > 95 && tab) reloadTab(tab);
      ptr.classList.remove('show', 'spin');
      ptr.style.transform = 'translateX(-50%)';
    }
    if (mode === 'swipe-back' && dx > 80 && tab && canBack(tab)) goBack(tab);
    if (mode === 'swipe-fwd' && dx < -80 && tab && canFwd(tab)) goForward(tab);
    $('#edge-left')?.classList.remove('show');
    $('#edge-right')?.classList.remove('show');
    active = false; mode = null;
  }, { passive: true });
}

function scrollableAt(node) {
  let n = node;
  while (n && n !== content) {
    if (n.classList?.contains('scroll-host') || n.classList?.contains('tab-view')) return n.classList.contains('scroll-host') ? n : n.querySelector('.scroll-host');
    if (n.tagName === 'IFRAME') return n;
    n = n.parentNode;
  }
  return content;
}

/* ---------------- toolbar auto-hide on scroll (internal pages) ---------------- */
function attachAutoHide() {
  let lastY = 0;
  content.addEventListener('scroll', (e) => {
    if (!DB.settings.autoHideToolbar) return;
    if (!(e.target.classList?.contains('scroll-host'))) return;
    const y = e.target.scrollTop;
    const goingDown = y > lastY + 4;
    const goingUp = y < lastY - 4;
    if (y < 10) toolbar.classList.remove('hidden-up');
    else if (goingDown) toolbar.classList.add('hidden-up');
    else if (goingUp) toolbar.classList.remove('hidden-up');
    lastY = y;
  }, { capture: true, passive: true });
}

/* ---------------- long-press / right-click context menus ---------------- */
function attachLongPress() {
  let timer = null, sx = 0, sy = 0;
  const openFor = (target, x, y) => {
    const link = target.closest?.('a[href]');
    const img = target.closest?.('img');
    const sel = getSelection()?.toString();
    if (link) {
      const href = link.href;
      contextMenu(x, y, [
        { label: 'Open in new tab', icon: icon('add'), onClick: () => Tabs.create({ url: href }) },
        { label: 'Open in incognito tab', icon: icon('incognito'), onClick: () => Tabs.create({ url: href, incognito: true }) },
        { label: 'Open in new group', icon: icon('group'), onClick: () => { const t = Tabs.create({ url: href, active: false }); Tabs.createGroup(null, [t.id]); snackbar('New tab group created'); } },
        '-',
        { label: 'Copy link address', icon: icon('copy'), onClick: async () => { await copyText(href); snackbar('Link copied'); } },
        { label: 'Download link', icon: icon('download'), onClick: () => Downloads.start(Tabs.active(), href) },
        { label: 'Share link', icon: icon('share'), onClick: async () => { if (navigator.share) await navigator.share({ url: href }).catch(() => {}); else { await copyText(href); snackbar('Link copied'); } } },
      ]);
      return true;
    }
    if (img) {
      contextMenu(x, y, [
        { label: 'Open image in new tab', icon: icon('openNew'), onClick: () => Tabs.create({ url: img.src }) },
        { label: 'Download image', icon: icon('download'), onClick: () => Downloads.start(Tabs.active(), img.src, img.src.split('/').pop() || 'image') },
        { label: 'Copy image link', icon: icon('copy'), onClick: async () => { await copyText(img.src); snackbar('Image link copied'); } },
        { label: 'Share image', icon: icon('share'), onClick: async () => { if (navigator.share) await navigator.share({ url: img.src }).catch(() => {}); else { await copyText(img.src); snackbar('Image link copied'); } } },
      ]);
      return true;
    }
    if (sel && sel.length > 1) {
      contextMenu(x, y, [
        { label: 'Copy', icon: icon('copy'), onClick: async () => { await copyText(sel); snackbar('Copied'); } },
        { label: 'Share', icon: icon('share'), onClick: async () => { if (navigator.share) await navigator.share({ text: sel }).catch(() => {}); else await copyText(sel); } },
        { label: 'Search the web for this', icon: icon('search'), onClick: () => navigate(Tabs.active(), sel) },
      ]);
      return true;
    }
    return false;
  };

  content.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    sx = e.touches[0].clientX; sy = e.touches[0].clientY;
    clearTimeout(timer);
    timer = setTimeout(() => openFor(e.target, sx, sy), 520);
  }, { passive: true });
  content.addEventListener('touchmove', () => clearTimeout(timer), { passive: true });
  content.addEventListener('touchend', () => clearTimeout(timer), { passive: true });
  content.addEventListener('contextmenu', (e) => {
    if (openFor(e.target, e.clientX, e.clientY)) e.preventDefault();
  });
}

/* ---------------- contextual search (text-selection overlay) ---------------- */
function attachSelectionSearch() {
  const peek = $('#cs-peek');
  const panel = $('#cs-panel');
  let currentText = '';
  document.addEventListener('selectionchange', () => {
    if (!DB.settings.contextualSearch) return;
    const sel = getSelection();
    const text = sel?.toString().trim() || '';
    const tab = Tabs.active();
    const inInternal = sel?.anchorNode && tab?.el && !tab.iframe && tab.el.contains(sel.anchorNode);
    if (text.length >= 3 && inInternal && !panel.classList.contains('open')) {
      currentText = text;
      peek.querySelector('span').textContent = `Search for “${text.length > 40 ? text.slice(0, 40) + '…' : text}”`;
      peek.classList.add('show');
    } else if (!text) {
      peek.classList.remove('show');
    }
  });
  peek.addEventListener('click', () => {
    peek.classList.remove('show');
    openContextualSearch(currentText);
  });
  $('#cs-close').addEventListener('click', () => panel.classList.remove('open'));
  document.addEventListener('pointerdown', (e) => {
    if (panel.classList.contains('open') && !panel.contains(e.target)) panel.classList.remove('open');
  });
}

function openContextualSearch(text) {
  const panel = $('#cs-panel');
  const body = panel.querySelector('.cs-body');
  panel.querySelector('.q').textContent = text;
  body.innerHTML = '';
  const related = [`${text} meaning`, `${text} news`, `${text} wikipedia`];
  const mkRow = (ic, title, sub, onClick) => el('button', { class: 'irow', onclick: onClick },
    el('span', { class: 'r-ic' }, icon(ic)),
    el('span', { class: 'r-main' }, el('div', { class: 'r-title' }, title), sub ? el('div', { class: 'r-sub' }, sub) : null),
    icon('chevron', 'chev'));
  body.append(
    mkRow('search', `Search “${text}”`, 'Web search', () => {
      panel.classList.remove('open');
      navigate(Tabs.active(), text);
    }),
    mkRow('translate', `Translate “${text}”`, 'Open translator', () => {
      panel.classList.remove('open');
      navigate(Tabs.active(), `https://translate.google.com/?sl=auto&tl=${DB.settings.lang}&text=${encodeURIComponent(text)}`);
    }),
    mkRow('copy', 'Copy text', null, async () => { await copyText(text); panel.classList.remove('open'); snackbar('Copied'); }),
    el('div', { class: 'ip-sec-h' }, 'Related'),
    ...related.map((r) => mkRow('search', r, null, () => { panel.classList.remove('open'); navigate(Tabs.active(), r); })),
  );
  panel.classList.add('open');
}
