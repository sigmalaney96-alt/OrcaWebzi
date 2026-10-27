// core/store.js — persistent state (localStorage) for Orca Orca Web
const KEY = 'orca.db.v1';

export const SEARCH_ENGINES = {
  google:    { name: 'Google',    url: 'https://www.google.com/search?q=%s',   host: 'google.com' },
  bing:      { name: 'Bing',      url: 'https://www.bing.com/search?q=%s',     host: 'bing.com' },
  duckduckgo:{ name: 'DuckDuckGo',url: 'https://duckduckgo.com/?q=%s',         host: 'duckduckgo.com' },
  yahoo:     { name: 'Yahoo',     url: 'https://search.yahoo.com/search?p=%s', host: 'yahoo.com' },
  ecosia:    { name: 'Ecosia',    url: 'https://www.ecosia.org/search?q=%s',   host: 'ecosia.org' },
};

export const DEFAULT_SETTINGS = {
  // basics
  engine: 'google',
  customEngines: [],              // [{name, url}]  (%s = query)
  homepage: 'orca://newtab',
  showHomeButton: true,
  // appearance
  dark: 'system',                 // system | on | off
  siteDarkening: false,
  bottomToolbar: false,
  autoHideToolbar: true,
  // gestures
  swipeNav: true,
  pullRefresh: true,
  contextualSearch: true,
  // privacy & security
  safeBrowsing: true,
  httpsFirst: false,
  adBlock: false,
  doNotTrack: false,
  preload: 'standard',            // standard | wifi | never
  usageStats: true,
  crashReports: true,
  dataSaver: false,
  // passwords & autofill
  savePasswords: true,
  autoSignIn: true,
  // accessibility
  textScale: 100,
  forceZoom: false,
  simplifiedView: false,
  captions: false,
  // content defaults (per-site overridable)
  defPerms: {
    location: 'ask', camera: 'ask', mic: 'ask', notifications: 'ask',
    midi: 'ask', clipboard: 'ask', popups: 'ask', sound: 'allow',
    javascript: 'allow', cookies: 'allow', ads: 'allow',
  },
  // downloads
  askDownloadLocation: false,
  downloadDir: 'In-app storage (IndexedDB)',
  // languages & translate
  lang: 'en',
  offerTranslate: true,
  translateTargets: ['es', 'fr', 'de'],
  translateNever: [],             // languages never offer
  // sync
  syncEverything: true,
  sync: { bookmarks: true, passwords: true, history: true, tabs: true, settings: true, autofill: true },
  // misc
  searchSuggest: true,
  navErrorSuggest: true,
  notifGlobal: true,
};

const DEFAULTS = {
  v: 1,
  settings: DEFAULT_SETTINGS,
  bookmarks: [
    { id: 'f-partner', type: 'folder', title: 'Partner bookmarks', parentId: null, order: 0 },
    { id: 'b-orca', type: 'bm', title: 'Orca Orca Web — home', url: 'https://orcawebzi.vercel.app/', parentId: 'f-partner', order: 0 },
    { id: 'b-install', type: 'bm', title: 'Install Orca as an app', url: 'https://orcawebzi.vercel.app/onboard', parentId: 'f-partner', order: 1 },
    { id: 'b-mdn', type: 'bm', title: 'MDN Web Docs', url: 'https://developer.mozilla.org/', parentId: null, order: 1 },
    { id: 'b-wiki', type: 'bm', title: 'Wikipedia', url: 'https://www.wikipedia.org/', parentId: null, order: 2 },
  ],
  history: [],        // {id,url,title,time}
  passwords: [],      // {id,origin,username,password,time}
  addresses: [],      // {id,name,addr,city,zip,country,phone,email}
  cards: [],          // {id,nick,number,exp,name}
  downloads: [],      // {id,name,url,size,mime,state,received,time,error,danger}
  offline: [],        // {id,url,title,time,size,html?}
  sitePerms: {},      // origin -> {perm: 'allow'|'block'}
  siteData: {},       // origin -> {cookies, storage}
  feedDismissed: [],
  session: null,      // {tabs:[{url,title,groupId}], activeId, groups:[{id,name,color}]}
  closedTabs: [],     // [{url,title,time}]
  account: null,      // {name,email,avatarHue,since,syncedAt}
  sentTabs: [],       // {id,url,title,device,time}
  recentDevices: [
    { id: 'dev-pixel', name: 'Pixel 8 Pro', kind: 'phone', tabs: [
      { url: 'https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API', title: 'Service Worker API - MDN', time: Date.now() - 3600e3 },
      { url: 'https://web.dev/articles/pwa', title: 'Progressive web apps | web.dev', time: Date.now() - 7200e3 },
    ] },
    { id: 'dev-laptop', name: 'Windows laptop', kind: 'laptop', tabs: [
      { url: 'https://vercel.com/docs', title: 'Vercel Documentation', time: Date.now() - 86400e3 },
    ] },
  ],
  fre: { done: false },
  tips: {},           // tipId -> true (shown)
  recentSearches: [],
  dataSaved: 0,       // bytes "saved" by data saver
  notifLog: [],       // {id,origin,title,body,time}
};

function deepMerge(base, over) {
  if (Array.isArray(base) || Array.isArray(over)) return over === undefined ? base : over;
  if (typeof base === 'object' && base && typeof over === 'object' && over) {
    const out = { ...base };
    for (const k of Object.keys(over)) out[k] = deepMerge(base[k], over[k]);
    return out;
  }
  return over === undefined ? base : over;
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULTS);
    return deepMerge(structuredClone(DEFAULTS), JSON.parse(raw));
  } catch {
    return structuredClone(DEFAULTS);
  }
}

export const DB = load();

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(DB)); } catch { /* quota */ }
}

let saveTimer = null;
export function saveSoon() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 250);
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function resetAll() {
  localStorage.removeItem(KEY);
  location.reload();
}

export function setting(path, value) {
  const parts = path.split('.');
  let obj = DB.settings;
  for (let i = 0; i < parts.length - 1; i++) obj = obj[parts[i]];
  if (value === undefined) return obj[parts[parts.length - 1]];
  obj[parts[parts.length - 1]] = value;
  saveSoon();
}
