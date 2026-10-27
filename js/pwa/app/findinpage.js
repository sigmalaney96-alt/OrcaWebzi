// app/findinpage.js — find-in-page toolbar with match highlighting
import { $, el, icon } from '../core/utils.js';
import { snackbar } from '../core/ui.js';
import { Tabs } from './tabs.js';

let bar, input, countEl;
let marks = [];
let cur = -1;
let hostRoot = null;

export function initFindBar() {
  bar = $('#findbar');
  input = $('#find-input');
  countEl = $('#find-count');
  input.addEventListener('input', () => run(input.value));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') next(e.shiftKey ? -1 : 1);
    if (e.key === 'Escape') closeFindBar();
  });
  $('#find-prev').addEventListener('click', () => next(-1));
  $('#find-next').addEventListener('click', () => next(1));
  $('#find-close').addEventListener('click', closeFindBar);
  Tabs.onChange((evt) => { if (evt === 'activate' || evt === 'navigate' || evt === 'close') closeFindBar(); });
}

export function openFindBar() {
  bar.classList.add('open');
  input.value = '';
  countEl.textContent = '';
  input.focus();
  run('');
}

export function closeFindBar() {
  bar.classList.remove('open');
  clearMarks();
  input.value = '';
}

function targetRoot() {
  const tab = Tabs.active();
  if (!tab?.el) return null;
  const frame = tab.el.querySelector('iframe');
  if (frame) {
    try { return frame.contentDocument?.body || null; } catch { return 'blocked'; }
  }
  return tab.el;
}

function clearMarks() {
  if (hostRoot && hostRoot !== 'blocked' && hostRoot.ownerDocument) {
    const doc = hostRoot.ownerDocument;
    for (const m of doc.querySelectorAll('mark.orca-hl')) {
      const parent = m.parentNode;
      parent.replaceChild(doc.createTextNode(m.textContent), m);
      parent.normalize();
    }
  }
  marks = []; cur = -1;
}

function run(q) {
  clearMarks();
  const root = targetRoot();
  if (root === 'blocked') {
    countEl.textContent = '—';
    if (q) snackbar('Find in page can’t search this site (cross-origin). Open it externally to search.', { duration: 2500 });
    return;
  }
  if (!root || !q.trim()) { countEl.textContent = ''; return; }
  const doc = root.ownerDocument;
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      if (!n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      const p = n.parentElement;
      if (!p || ['SCRIPT', 'STYLE', 'MARK', 'NOSCRIPT'].includes(p.tagName)) return NodeFilter.FILTER_REJECT;
      return n.nodeValue.toLowerCase().includes(q.toLowerCase()) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
    },
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  const ql = q.toLowerCase();
  for (const node of nodes) {
    let text = node.nodeValue, idx;
    const frag = doc.createDocumentFragment();
    let pos = 0;
    while ((idx = text.toLowerCase().indexOf(ql, pos)) !== -1) {
      frag.append(doc.createTextNode(text.slice(pos, idx)));
      const m = doc.createElement('mark');
      m.className = 'orca-hl';
      m.textContent = text.slice(idx, idx + q.length);
      frag.append(m);
      marks.push(m);
      pos = idx + q.length;
    }
    frag.append(doc.createTextNode(text.slice(pos)));
    node.parentNode.replaceChild(frag, node);
  }
  countEl.textContent = marks.length ? `1/${marks.length}` : '0/0';
  if (marks.length) { cur = 0; focusCur(); }
}

function next(dir) {
  if (!marks.length) return;
  cur = (cur + dir + marks.length) % marks.length;
  countEl.textContent = `${cur + 1}/${marks.length}`;
  focusCur();
}

function focusCur() {
  marks.forEach((m, i) => m.classList.toggle('cur', i === cur));
  const m = marks[cur];
  if (!m) return;
  const host = m.closest('.scroll-host');
  if (host) {
    const r = m.getBoundingClientRect();
    const hr = host.getBoundingClientRect();
    host.scrollTo({ top: host.scrollTop + (r.top - hr.top) - hr.height / 2, behavior: 'smooth' });
  } else {
    // same-origin iframe document — scroll inside it, never the outer page
    m.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
}
