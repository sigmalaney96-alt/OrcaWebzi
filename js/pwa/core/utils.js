// core/utils.js — DOM + URL helpers for Orca Orca Web

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (v !== null && v !== undefined) node.setAttribute(k, v);
  }
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined) continue;
    node.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return node;
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

/* ---------- SVG icon set (material-ish) ---------- */
const P = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;
export const ICONS = {
  back: P('M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z'),
  forward: P('M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8-8-8z'),
  reload: P('M17.65 6.35A7.95 7.95 0 0 0 12 4a8 8 0 1 0 7.73 10h-2.08A6 6 0 1 1 12 6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z'),
  home: P('M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z'),
  menu: P('M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z'),
  close: P('M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z'),
  add: P('M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z'),
  lock: P('M18 8h-1V6a5 5 0 0 0-10 0v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2zm-9-2a3 3 0 0 1 6 0v2H9V6z'),
  unlock: P('M12 17a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm6-9h-1V6a5 5 0 0 0-9.9-1H9.3A3 3 0 0 1 15 6v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2z'),
  warn: P('M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z'),
  mic: P('M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z'),
  search: P('M15.5 14h-.79l-.28-.27a6.5 6.5 0 1 0-.7.7l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14z'),
  history: P('M13 3a9 9 0 0 0-9 9H1l3.89 3.89.07.14L9 12H6a7 7 0 1 1 7 7 6.96 6.96 0 0 1-4.95-2.05l-1.41 1.41A9 9 0 1 0 13 3zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z'),
  bookmark: P('M17 3H7a2 2 0 0 0-2 2v16l7-3 7 3V5a2 2 0 0 0-2-2z'),
  bookmarkBorder: P('M17 3H7a2 2 0 0 0-2 2v16l7-3 7 3V5a2 2 0 0 0-2-2zm0 15-7-2.18L5 18V5h12v13z'),
  download: P('M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z'),
  share: P('M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7a3.27 3.27 0 0 0 0-1.39l7.05-4.11A2.99 2.99 0 1 0 15 5c0 .24.04.47.09.7L8.04 9.81a3 3 0 1 0 0 4.28l7.12 4.16c-.05.21-.08.43-.08.65a2.92 2.92 0 1 0 2.92-2.92z'),
  find: P('M15.5 14h-.79l-.28-.27a6.5 6.5 0 1 0-.7.7l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14z'),
  install: P('M17 1.01 7 1a2 2 0 0 0-2 2v18a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3a2 2 0 0 0-2-1.99zM17 19H7V5h10v14z'),
  desktop: P('M21 2H3a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h7l-2 3v1h8v-1l-2-3h7a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2zm0 12H3V4h18v10z'),
  settings: P('M19.14 12.94a7.07 7.07 0 0 0 0-1.88l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.61-.22l-2.39.96a7.05 7.05 0 0 0-1.62-.94l-.36-2.54a.5.5 0 0 0-.5-.42h-3.84a.5.5 0 0 0-.5.42l-.36 2.54c-.59.24-1.13.56-1.62.94l-2.39-.96a.5.5 0 0 0-.61.22L2.65 8.84a.5.5 0 0 0 .12.64l2.03 1.58a7.07 7.07 0 0 0 0 1.88l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32c.14.24.42.34.61.22l2.39-.96c.49.38 1.03.7 1.62.94l.36 2.54c.05.24.25.42.5.42h3.84c.25 0 .45-.18.5-.42l.36-2.54a7.05 7.05 0 0 0 1.62-.94l2.39.96c.19.12.47.02.61-.22l1.92-3.32a.5.5 0 0 0-.12-.64zM12 15.5A3.5 3.5 0 1 1 15.5 12 3.5 3.5 0 0 1 12 15.5z'),
  help: P('M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 17h-2v-2h2zm2.07-7.75-.9.92A3.42 3.42 0 0 0 13 14.5V15h-2v-.5a4.5 4.5 0 0 1 1.17-2.83l1.24-1.26A1.8 1.8 0 0 0 14 9.5a2 2 0 1 0-4 0H8a4 4 0 1 1 8 0 3.86 3.86 0 0 1-.93 2.25z'),
  incognito: P('M12 2a9 9 0 0 0-9 9 8.94 8.94 0 0 0 .5 2.9L3 15.5V17a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-1.5l-.5-1.6A8.94 8.94 0 0 0 21 11a9 9 0 0 0-9-9zM7 14a2.5 2.5 0 1 1 2.5-2.5A2.5 2.5 0 0 1 7 14zm10 0a2.5 2.5 0 1 1 2.5-2.5A2.5 2.5 0 0 1 17 14z'),
  chevron: P('M10 6 8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z'),
  delete: P('M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z'),
  edit: P('M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z'),
  check: P('M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z'),
  folder: P('M10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-2z'),
  globe: P('M11.99 2a10 10 0 1 0 10 10A10 10 0 0 0 11.99 2zm7 6h-3a15.6 15.6 0 0 0-1.38-3.56A8.03 8.03 0 0 1 18.92 8zM12 4a14.6 14.6 0 0 1 1.9 4h-3.8A14.6 14.6 0 0 1 12 4zM4.26 14a8.15 8.15 0 0 1 0-4h3.38a16.5 16.5 0 0 0 0 4H4.26zm.79 2h3a15.6 15.6 0 0 0 1.38 3.56A8.03 8.03 0 0 1 5.05 16zm3-8h-3a8.03 8.03 0 0 1 4.43-3.56A15.6 15.6 0 0 0 8.05 8zM12 20a14.6 14.6 0 0 1-1.9-4h3.8A14.6 14.6 0 0 1 12 20zm2.34-6H9.66a14.7 14.7 0 0 1 0-4h4.68a14.7 14.7 0 0 1 0 4zm.27 5.56A15.6 15.6 0 0 0 16 16h3a8.03 8.03 0 0 1-3.05 3.56zM16.36 14a16.5 16.5 0 0 0 0-4h3.38a8.15 8.15 0 0 1 0 4z'),
  translate: P('M12.87 15.07l-2.54-2.51.03-.03A17.52 17.52 0 0 0 14.07 6H17V4h-7V2H8v2H1v2h11.17A15.6 15.6 0 0 1 8.53 11a15.7 15.7 0 0 1-1.4-1.99H5.11a17.6 17.6 0 0 0 2.38 3.07L2.6 17l1.4 1.41 4.9-4.9 3.06 3.06zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7 1.62-4.33L19.12 17z'),
  reader: P('M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm-9 14H7v-2h3zm0-4H7v-2h3zm0-4H7V7h3zm7 8h-5v-2h5zm0-4h-5v-2h5zm0-4h-5V7h5z'),
  zoomIn: P('M15.5 14h-.79l-.28-.27a6.5 6.5 0 1 0-.7.7l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14zm2.5-4h1v1.5h1V13h-1v1.5h-1V13h-1v-1.5h1V10z'),
  zoomOut: P('M15.5 14h-.79l-.28-.27a6.5 6.5 0 1 0-.7.7l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14zM7 11.5h5V13H7z'),
  star: P('M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z'),
  offline: P('M19.35 10.04A7.49 7.49 0 0 0 12 4a7.48 7.48 0 0 0-6.64 4.04A6 6 0 0 0 6 20h13a5 5 0 0 0 .35-9.96zM19 18H6a4 4 0 0 1-.55-7.96l1.09-.13.27-.78A5.5 5.5 0 0 1 12 6a5.51 5.51 0 0 1 5.19 3.63l.19.56.59.03A3.5 3.5 0 0 1 19 18z'),
  pip: P('M19 11h-8v6h8v-6zm4 8V4.98C23 3.88 22.1 3 21 3H3a2 2 0 0 0-2 1.98V19a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2zm-2 .02H3V4.97h18v14.05z'),
  cast: P('M21 3H3a2 2 0 0 0-2 2v3h2V5h18v14h-7v2h7a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zM1 18v3h3a3 3 0 0 0-3-3zm0-4v2a5 5 0 0 1 5 5h2a7 7 0 0 0-7-7zm0-4v2a9 9 0 0 1 9 9h2A11 11 0 0 0 1 10z'),
  qr: P('M3 11h8V3H3v8zm2-6h4v4H5V5zM3 21h8v-8H3v8zm2-6h4v4H5v-4zM13 3v8h8V3h-8zm6 6h-4V5h4v4zm-6 4h2v2h-2zm4 0h2v2h-2zm-4 4h2v2h-2zm4 0h2v2h-2zm2-4h2v2h-2zm0 4h2v2h-2z'),
  print: P('M19 8H5a3 3 0 0 0-3 3v6h4v4h12v-4h4v-6a3 3 0 0 0-3-3zm-3 11H8v-5h8zm3-7a1 1 0 1 1 1-1 1 1 0 0 1-1 1zm-1-9H6v4h12V3z'),
  devices: P('M4 6h18V4H4a2 2 0 0 0-2 2v11H0v3h14v-3H4V6zm19 2h-6a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1zm-1 9h-4v-7h4v7z'),
  sync: P('M12 4V1L8 5l4 4V6a6 6 0 0 1 6 6 5.93 5.93 0 0 1-.6 2.65l1.46 1.46A7.93 7.93 0 0 0 20 12a8 8 0 0 0-8-8zm0 14a6 6 0 0 1-6-6 5.93 5.93 0 0 1 .6-2.65L5.14 7.89A7.93 7.93 0 0 0 4 12a8 8 0 0 0 8 8v3l4-4-4-4v3z'),
  person: P('M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5zm0 2c-3.34 0-10 1.67-10 5v3h20v-3c0-3.33-6.66-5-10-5z'),
  bell: P('M12 22a2 2 0 0 0 2-2h-4a2 2 0 0 0 2 2zm6-6v-5a6 6 0 0 0-4.5-5.8V4.5a1.5 1.5 0 0 0-3 0v.7A6 6 0 0 0 6 11v5l-2 2v1h16v-1l-2-2z'),
  lockOpen: P('M12 17a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm6-9h-1V6a5 5 0 0 0-9.9-1H9.3A3 3 0 0 1 15 6v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2z'),
  cookie: P('M12 2a10 10 0 1 0 10 10 4 4 0 0 1-4-4 4 4 0 0 1-4-4 1.94 1.94 0 0 1-2-2zM8.5 8A1.5 1.5 0 1 1 10 9.5 1.5 1.5 0 0 1 8.5 8zM8 14a1.5 1.5 0 1 1 1.5-1.5A1.5 1.5 0 0 1 8 14zm4.5 3A1.5 1.5 0 1 1 14 15.5a1.5 1.5 0 0 1-1.5 1.5zm3-6a1.5 1.5 0 1 1 1.5 1.5A1.5 1.5 0 0 1 15.5 11z'),
  info: P('M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 15h-2v-6h2zm0-8h-2V7h2z'),
  send: P('M2.01 21 23 12 2.01 3 2 10l15 2-15 2z'),
  link: P('M3.9 12a3.1 3.1 0 0 1 3.1-3.1h4V7H7a5 5 0 0 0 0 10h4v-1.9H7A3.1 3.1 0 0 1 3.9 12zM8 13h8v-2H8v2zm9-6h-4v1.9h4a3.1 3.1 0 0 1 0 6.2h-4V17h4a5 5 0 0 0 0-10z'),
  copy: P('M16 1H4a2 2 0 0 0-2 2v14h2V3h12V1zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H8V7h11v14z'),
  openNew: P('M19 19H5V5h7V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z'),
  image: P('M21 19V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z'),
  pause: P('M6 19h4V5H6v14zm8-14v14h4V5h-4z'),
  play: P('M8 5v14l11-7z'),
  cancel: P('M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12z'),
  shield: P('M12 1 3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z'),
  wifiOff: P('M22.99 9a15 15 0 0 0-6.28-3.6l1.43 1.43A13 13 0 0 1 21 9h1.99zM9.17 5.6l1.5 1.5A13.4 13.4 0 0 1 12 7c1.65 0 3.24.26 4.73.74l1.57 1.57A15.05 15.05 0 0 0 12 5c-.64 0-1.26.05-1.87.13l-1.5-1.5a17.2 17.2 0 0 1 2.54-.03zM2.1 3.51 3.51 4.93A14.9 14.9 0 0 0 1 9h2a12.9 12.9 0 0 1 2.32-3.27l1.7 1.7A10.9 10.9 0 0 0 3.24 13h2a8.9 8.9 0 0 1 2.98-4.12l1.93 1.93A6.86 6.86 0 0 0 5.5 17h2a4.9 4.9 0 0 1 4.08-2.21l2.4 2.4A2.9 2.9 0 0 0 12 19a1 1 0 1 0 2 0 1 1 0 0 0-.14-.51l3.79 3.79 1.41-1.41L3.51 2.1 2.1 3.51z'),
  cam: P('M12 15.2a3.2 3.2 0 1 0-3.2-3.2 3.2 3.2 0 0 0 3.2 3.2zM9 2 7.17 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-3.17L15 2H9z'),
  geo: P('M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 14.5 9 2.5 2.5 0 0 1 12 11.5z'),
  card: P('M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 14H4v-6h16zm0-10H4V6h16z'),
  address: P('M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 14.5 9 2.5 2.5 0 0 1 12 11.5z'),
  lang: P('M12.87 15.07l-2.54-2.51.03-.03A17.52 17.52 0 0 0 14.07 6H17V4h-7V2H8v2H1v2h11.17A15.6 15.6 0 0 1 8.53 11a15.7 15.7 0 0 1-1.4-1.99H5.11a17.6 17.6 0 0 0 2.38 3.07L2.6 17l1.4 1.41 4.9-4.9 3.06 3.06zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12z'),
  key: P('M12.65 10A6 6 0 1 0 7 14a5.94 5.94 0 0 0 3.65-1.23L12 14h2v2h2v2h3v-4.35L12.65 10zM7 14a2 2 0 1 1 2-2 2 2 0 0 1-2 2z'),
  fullscreen: P('M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z'),
  group: P('M16 11a3 3 0 1 0-3-3 3 3 0 0 0 3 3zm-8 0a3 3 0 1 0-3-3 3 3 0 0 0 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5C15 14.17 10.33 13 8 13zm8 0c-.29 0-.62.02-.97.05A4.22 4.22 0 0 1 17 16.5V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z'),
  undo: P('M12.5 8a7.5 7.5 0 1 0 7.5 7.5h-2a5.5 5.5 0 1 1-5.5-5.5c1.47 0 2.75.57 3.77 1.5L13 15h7V8l-2.72 2.72A7.45 7.45 0 0 0 12.5 8z'),
  eye: P('M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17a5 5 0 1 1 5-5 5 5 0 0 1-5 5zm0-8a3 3 0 1 0 3 3 3 3 0 0 0-3-3z'),
  eyeOff: P('M12 7a5 5 0 0 1 5 5 4.94 4.94 0 0 1-.59 2.41l3.06 3.06A11.83 11.83 0 0 0 23 12a11.66 11.66 0 0 0-6.36-5.93A4.93 4.93 0 0 1 12 7zM2.71 3.16a1 1 0 0 0-1.42 1.42l1.97 1.96A11.77 11.77 0 0 0 1 12a11.65 11.65 0 0 0 15.72 4.82l2.78 2.78a1 1 0 0 0 1.42-1.42zM12 17a5 5 0 0 1-5-5 4.9 4.9 0 0 1 .46-2.09l1.51 1.51a3 3 0 0 0 4.12 4.12l1.51 1.51A4.9 4.9 0 0 1 12 17z'),
  article: P('M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm-5 14H7v-2h7zm3-4H7v-2h10zm0-4H7V7h10z'),
};

export function icon(name, cls = '') {
  const wrap = document.createElement('span');
  wrap.innerHTML = ICONS[name] || ICONS.globe;
  const svg = wrap.firstChild;
  if (cls) svg.setAttribute('class', cls);
  return svg;
}
export function iconHtml(name) { return ICONS[name] || ICONS.globe; }

/* ---------- URL helpers ---------- */
const TLD_RE = /^[a-z0-9-]+(\.[a-z0-9-]+)+(:\d+)?(\/|$)/i;

export function looksLikeUrl(text) {
  const t = text.trim();
  if (!t || /\s/.test(t)) return false;
  if (/^(https?|ftp|file|about|orca):/i.test(t)) return true;
  if (t === 'localhost' || t.startsWith('localhost:')) return true;
  return TLD_RE.test(t);
}

export function normalizeUrl(text) {
  let t = text.trim();
  if (/^orca:/i.test(t)) return t.toLowerCase();
  if (/^about:/i.test(t)) return 'orca://' + t.slice(6).toLowerCase();
  if (!/^[a-z][a-z0-9+.-]*:/i.test(t)) t = 'https://' + t;
  if (settingHttpsFirst() && t.startsWith('http://')) t = 'https://' + t.slice(7);
  return t;
}
// late-bound to avoid circular import at module eval
let settingHttpsFirst = () => false;
export function bindHttpsFirst(fn) { settingHttpsFirst = fn; }

export function searchUrl(template, query) {
  return template.replace('%s', encodeURIComponent(query));
}

export function originOf(url) {
  try { return new URL(url).origin; } catch { return url; }
}
export function hostOf(url) {
  try { return new URL(url).host; } catch { return url; }
}
export function isInternal(url) { return /^orca:/i.test(url || ''); }
export function isSecureUrl(url) { return /^https:/i.test(url || '') || isInternal(url); }

/* ---------- Favicon with letter-tile fallback ---------- */
const HUES = [210, 260, 330, 20, 160, 120, 280, 0, 45, 190];
export function faviconEl(url, size = 18) {
  const wrap = document.createElement('span');
  wrap.style.cssText = `width:${size}px;height:${size}px;display:inline-grid;place-items:center;flex:0 0 auto;`;
  if (isInternal(url)) {
    const img = new Image(size, size);
    img.src = '/icons/favicon-32.png';
    img.style.cssText = `width:${size}px;height:${size}px;border-radius:${Math.round(size / 5)}px;`;
    wrap.append(img);
    return wrap;
  }
  const host = hostOf(url).replace(/^www\./, '') || '?';
  const letter = (host[0] || '?').toUpperCase();
  const hue = HUES[[...host].reduce((a, c) => a + c.charCodeAt(0), 0) % HUES.length];
  const tile = document.createElement('span');
  tile.className = 'letter';
  tile.style.cssText = `width:${size}px;height:${size}px;border-radius:${Math.round(size / 4.5)}px;background:hsl(${hue} 62% 46%);color:#fff;display:grid;place-items:center;font-size:${Math.round(size * .55)}px;font-weight:700;`;
  tile.textContent = letter;
  const img = new Image(size, size);
  img.style.cssText = `width:${size}px;height:${size}px;border-radius:${Math.round(size / 5)}px;`;
  img.onload = () => { if (img.naturalWidth > 1) { wrap.innerHTML = ''; wrap.append(img); } };
  img.onerror = () => {};
  img.src = `https://${host}/favicon.ico`;
  wrap.append(tile);
  return wrap;
}

/* ---------- formatting ---------- */
export function timeAgo(ts) {
  const s = Math.max(1, (Date.now() - ts) / 1000);
  if (s < 60) return 'Just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} hr ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)} d ago`;
  return new Date(ts).toLocaleDateString();
}

export function dayLabel(ts) {
  const d = new Date(ts); const now = new Date();
  const day = (x) => x.toDateString();
  const yest = new Date(now); yest.setDate(now.getDate() - 1);
  if (day(d) === day(now)) return 'Today';
  if (day(d) === day(yest)) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
}

export function formatBytes(n) {
  if (!Number.isFinite(n) || n < 0) return '—';
  if (n < 1024) return `${n} B`;
  const u = ['KB', 'MB', 'GB', 'TB'];
  let v = n / 1024, i = 0;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v >= 100 ? 0 : v >= 10 ? 1 : 2)} ${u[i]}`;
}

export function debounce(fn, ms) {
  let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.append(ta); ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch {}
    ta.remove();
    return ok;
  }
}

export const DANGEROUS_EXT = /\.(exe|apk|bat|cmd|msi|scr|ps1|jar|dmg|pkg|deb|rpm)$/i;

export const LANG_NAMES = {
  en: 'English', es: 'Español', fr: 'Français', de: 'Deutsch', it: 'Italiano',
  pt: 'Português', nl: 'Nederlands', ja: '日本語', ko: '한국어', zh: '中文',
  hi: 'हिन्दी', ar: 'العربية', ru: 'Русский', pl: 'Polski', tr: 'Türkçe', vi: 'Tiếng Việt',
};
