// app/tabs.js — tab model, tab groups, session persistence
import { DB, saveSoon, uid } from '../core/store.js';

const GROUP_COLORS = ['#1a73e8', '#188038', '#e37400', '#d93025', '#9334e6', '#009688', '#f9ab00', '#5f6368'];

function newTab(partial = {}) {
  return {
    id: uid(),
    url: 'orca://newtab',
    title: 'New tab',
    incognito: false,
    groupId: null,
    zoom: 1,
    desktop: false,
    reader: false,
    stack: [],
    sIndex: -1,
    theme: null,
    el: null,          // lazily-mounted view element
    iframe: null,
    ...partial,
  };
}

export const Tabs = {
  tabs: [],
  incogTabs: [],
  groups: [],
  activeId: null,
  _listeners: new Set(),

  onChange(fn) { this._listeners.add(fn); return () => this._listeners.delete(fn); },
  emit(evt = 'change') { for (const fn of this._listeners) fn(evt); },

  list(incognito = false) { return incognito ? this.incogTabs : this.tabs; },
  active() {
    return this.tabs.find((t) => t.id === this.activeId)
        || this.incogTabs.find((t) => t.id === this.activeId) || null;
  },
  byId(id) { return this.tabs.find((t) => t.id === id) || this.incogTabs.find((t) => t.id === id); },
  incogActive() { return !!this.active()?.incognito; },

  init() {
    const s = DB.session;
    if (s && Array.isArray(s.tabs) && s.tabs.length) {
      this.groups = (s.groups || []).map((g) => ({ ...g }));
      this.tabs = s.tabs.map((t) => newTab({
        id: t.id || uid(),
        url: t.url || 'orca://newtab',
        title: t.title || 'New tab',
        groupId: t.groupId || null,
        stack: [{ url: t.url || 'orca://newtab', type: t.url?.startsWith('orca:') ? 'internal' : 'web', title: t.title }],
        sIndex: 0,
      }));
      this.activeId = this.tabs.find((t) => t.id === s.activeId)?.id ?? this.tabs[0].id;
    } else {
      const t = newTab({ stack: [{ url: 'orca://newtab', type: 'internal', title: 'New tab' }], sIndex: 0 });
      this.tabs = [t];
      this.activeId = t.id;
    }
  },

  persist() {
    DB.session = {
      activeId: this.incogActive() ? (this.tabs[0]?.id ?? null) : this.activeId,
      groups: this.groups,
      tabs: this.tabs.map((t) => {
        const cur = t.stack[t.sIndex];
        return { id: t.id, url: cur?.url ?? t.url, title: t.title, groupId: t.groupId };
      }),
    };
    saveSoon();
  },

  create(opts = {}) {
    const url = opts.url ?? 'orca://newtab';
    const tab = newTab({
      url,
      title: opts.title ?? 'New tab',
      incognito: !!opts.incognito,
      groupId: opts.groupId ?? null,
      stack: [{ url, type: url.startsWith('orca:') ? 'internal' : 'web', title: opts.title }],
      sIndex: 0,
    });
    this.list(tab.incognito).push(tab);
    if (opts.active !== false) this.activeId = tab.id;
    if (!tab.incognito) this.persist();
    this.emit('create');
    return tab;
  },

  close(id) {
    const tab = this.byId(id);
    if (!tab) return;
    const list = this.list(tab.incognito);
    const i = list.indexOf(tab);
    list.splice(i, 1);
    if (tab.el) tab.el.remove();
    if (!tab.incognito && tab.stack[tab.sIndex]) {
      DB.closedTabs.unshift({ url: tab.stack[tab.sIndex].url, title: tab.title, time: Date.now() });
      DB.closedTabs = DB.closedTabs.slice(0, 10);
    }
    if (tab.groupId && !this.tabs.some((t) => t.groupId === tab.groupId)) {
      this.groups = this.groups.filter((g) => g.id !== tab.groupId);
    }
    if (this.activeId === id) {
      const fallback = list[Math.min(i, list.length - 1)]
        || (tab.incognito ? this.tabs[this.tabs.length - 1] : this.incogTabs[this.incogTabs.length - 1])
        || null;
      this.activeId = fallback ? fallback.id : null;
      if (!this.activeId) {
        const t = this.create({ incognito: tab.incognito });
        this.activeId = t.id;
      }
    }
    if (!tab.incognito) this.persist();
    this.emit('close');
    return tab;
  },

  closeAll(incognito = false) {
    const list = this.list(incognito);
    for (const t of [...list]) {
      if (!incognito && t.stack[t.sIndex]) {
        DB.closedTabs.unshift({ url: t.stack[t.sIndex].url, title: t.title, time: Date.now() });
      }
      t.el?.remove();
    }
    DB.closedTabs = DB.closedTabs.slice(0, 10);
    if (incognito) this.incogTabs = []; else this.tabs = [];
    if (this.active()?.incognito === incognito || !this.active()) {
      const next = this.list(!incognito)[0];
      if (next) this.activeId = next.id;
      else this.activeId = this.create({ incognito }).id;
    }
    if (!incognito) this.persist();
    this.emit('closeall');
  },

  closeOthers(id) {
    const tab = this.byId(id);
    if (!tab) return;
    for (const t of [...this.list(tab.incognito)]) if (t.id !== id) this.close(t.id);
    this.emit('change');
  },

  activate(id) {
    if (this.activeId === id) return;
    this.activeId = id;
    this.persist();
    this.emit('activate');
  },

  update(tab, patch) {
    Object.assign(tab, patch);
    if (!tab.incognito) this.persist();
    this.emit('update');
  },

  /* ---------- groups ---------- */
  createGroup(name, tabIds = []) {
    const g = { id: uid(), name: name || `Group ${this.groups.length + 1}`, color: GROUP_COLORS[this.groups.length % GROUP_COLORS.length] };
    this.groups.push(g);
    for (const id of tabIds) { const t = this.byId(id); if (t) t.groupId = g.id; }
    this.persist(); this.emit('group');
    return g;
  },
  addToGroup(tabIds, groupId) {
    for (const id of tabIds) { const t = this.byId(id); if (t) t.groupId = groupId; }
    this.persist(); this.emit('group');
  },
  ungroup(tabId) {
    const t = this.byId(tabId); if (t) t.groupId = null;
    this.persist(); this.emit('group');
  },
  groupOf(tab) { return this.groups.find((g) => g.id === tab.groupId) || null; },

  reopenClosed() {
    const c = DB.closedTabs.shift();
    saveSoon();
    if (!c) return null;
    return this.create({ url: c.url, title: c.title });
  },
};
