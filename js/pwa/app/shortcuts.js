// app/shortcuts.js — keyboard shortcuts (Ctrl/⌘ combos; browser-reserved ones have Alt fallbacks)
import { $ } from '../core/utils.js';
import { snackbar } from '../core/ui.js';
import { Tabs } from './tabs.js';
import { navigate, goBack, goForward, reloadTab } from './views.js';
import { openFindBar } from './findinpage.js';

export function initShortcuts() {
  document.addEventListener('keydown', (e) => {
    const mod = e.ctrlKey || e.metaKey;
    const inInput = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) && !e.target.readOnly;

    if (mod && e.key.toLowerCase() === 't') {
      e.preventDefault();
      Tabs.create({});
      return;
    }
    if (mod && e.key.toLowerCase() === 'w') {
      e.preventDefault();
      const t = Tabs.active();
      if (t) Tabs.close(t.id);
      return;
    }
    if (mod && e.key.toLowerCase() === 'l') {
      e.preventDefault();
      const input = $('#omni-input');
      input.focus(); input.select();
      return;
    }
    if (mod && e.key.toLowerCase() === 'f') {
      e.preventDefault();
      openFindBar();
      return;
    }
    if (mod && e.key.toLowerCase() === 'd') {
      e.preventDefault();
      snackbar('Use ⋮ → “Bookmark this tab” to save it', { duration: 2000 });
      return;
    }
    if (mod && e.shiftKey && e.key.toLowerCase() === 'n') {
      e.preventDefault();
      Tabs.create({ incognito: true });
      return;
    }
    if (mod && e.key.toLowerCase() === 'r') {
      const t = Tabs.active();
      if (t) { e.preventDefault(); reloadTab(t); }
      return;
    }
    if (mod && e.key === 'Tab') {
      e.preventDefault();
      const list = Tabs.list(Tabs.incogActive());
      const i = list.findIndex((t) => t.id === Tabs.activeId);
      Tabs.activate(list[(i + 1) % list.length].id);
      return;
    }
    if (mod && e.key.toLowerCase() === 'h' && !inInput) {
      e.preventDefault();
      navigate(Tabs.active(), 'orca://history');
      return;
    }
    if (mod && e.key.toLowerCase() === 'j') {
      e.preventDefault();
      navigate(Tabs.active(), 'orca://downloads');
      return;
    }

    // Alt-based (reliable, not browser-reserved)
    if (e.altKey && e.key === 'ArrowLeft') { e.preventDefault(); const t = Tabs.active(); if (t) goBack(t); return; }
    if (e.altKey && e.key === 'ArrowRight') { e.preventDefault(); const t = Tabs.active(); if (t) goForward(t); return; }
    if (e.altKey && e.key === 'Home') { e.preventDefault(); const t = Tabs.active(); if (t) navigate(t, DB_homepage()); return; }
    if (e.altKey && e.key.toLowerCase() === 'n') { e.preventDefault(); Tabs.create({ incognito: true }); return; }
    if (e.altKey && e.key.toLowerCase() === 'g') { e.preventDefault(); $('#tab-count')?.click(); return; }
  });
}

function DB_homepage() {
  try {
    return JSON.parse(localStorage.getItem('orca.db.v1'))?.settings?.homepage || 'orca://newtab';
  } catch { return 'orca://newtab'; }
}
