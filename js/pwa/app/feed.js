// app/feed.js — NTP "Articles for you" feed data + rendering
import { DB, saveSoon } from '../core/store.js';
import { el, timeAgo } from '../core/utils.js';
import { navigate } from './views.js';

export const ARTICLES = [
  { id: 'a1', section: 'For you', emoji: '🐋', hue: 215, source: 'Ocean Weekly', time: Date.now() - 25 * 60e3,
    title: 'Orcas are surfing the open web again — here’s why it matters',
    body: [
      'The open web has always been a vast ocean, and browsers are the vessels we sail it with. This week, a wave of interest in privacy-respecting, installable web apps brought an old favorite back into the spotlight.',
      'Progressive web apps blur the line between websites and native software. They install from a URL, update themselves, work offline, and respect platform conventions — all without an app-store gatekeeper.',
      '“It’s the web doing what the web does best,” one developer told Ocean Weekly. “You click a link, and seconds later the thing lives on your home screen.”',
      'Critics point out that discoverability remains a challenge. App stores offer charts and categories; the web offers… everything. Proponents counter that search engines and social links have always been the web’s discovery engine, and they work fine.',
      'For now, the orca pods are gathering. The tide, it seems, is turning.',
    ] },
  { id: 'a2', section: 'For you', emoji: '⚡', hue: 45, source: 'Perf Planet', time: Date.now() - 2 * 3600e3,
    title: 'Service workers explained with five diagrams and zero jargon',
    body: [
      'A service worker is a script that your browser runs in the background, separate from the page. It can intercept network requests, cache responses, and deliver push notifications.',
      'Think of it as a friendly librarian sitting between your app and the internet. When your app asks for a book, the librarian decides: fetch it fresh from the shelf, or hand you the copy already on the desk?',
      'The cache-first strategy favors speed: serve the cached copy immediately, only going to the network when the cache misses. Network-first favors freshness: try the network, fall back to cache when offline.',
      'Orca Orca Web uses both: cache-first for static assets, network-first for navigations, plus a special cache for pages you explicitly save for offline reading.',
      'The result is an app that launches instantly, even in a submarine. Which is, incidentally, where orcas do their best browsing.',
    ] },
  { id: 'a3', section: 'For you', emoji: '🔒', hue: 140, source: 'The Daily Cipher', time: Date.now() - 5 * 3600e3,
    title: 'What the lock icon really tells you (and what it doesn’t)',
    body: [
      'That little padlock means your connection to the site is encrypted — nobody between you and the server can read or modify the traffic. It does not, however, vouch for the site’s honesty.',
      'A phishing page can have a perfectly valid certificate. The lock answers “is this connection private?”, not “should I trust this page?”',
      'Modern browsers have quietly de-emphasized the lock for exactly this reason. Some now show a neutral “tune” icon instead, warning only when a connection is not secure.',
      'So check the address bar, be skeptical of urgency, and let safe-browsing systems do their job. The lock is necessary — but never sufficient.',
    ] },
  { id: 'a4', section: 'Trending', emoji: '🌊', hue: 190, source: 'Tidepool Tech', time: Date.now() - 8 * 3600e3,
    title: 'Inside the rendering engine: how a URL becomes pixels',
    body: [
      'You type an address, press enter, and roughly a blink later there’s a page. Under the surface, that blink contains multitudes: DNS lookups, TLS handshakes, parsing, style calculation, layout, paint, composite.',
      'The parser turns HTML into the DOM tree while the preload scanner races ahead to fetch images and scripts. CSS becomes the CSSOM. Together they form the render tree.',
      'Layout computes geometry — every box, every line of text. Paint turns geometry into draw commands, and the compositor assembles layers on the GPU.',
      'All of this happens sixty times per second when you scroll. Next time a page janks, spare a thought for the engine — it’s doing ocean-scale work.',
    ] },
  { id: 'a5', section: 'Trending', emoji: '🧭', hue: 280, source: 'Compass', time: Date.now() - 26 * 3600e3,
    title: 'A field guide to browser gestures: swipes, pulls, and long-presses',
    body: [
      'Edge-swiping to go back has become muscle memory for a generation of phone users. Pull-to-refresh is older still — it debuted in a Twitter client and conquered the world.',
      'Good gestures share three traits: they’re discoverable, forgiving, and reversible. A pull-to-refresh that triggers too eagerly is a bug, not a feature.',
      'Orca Orca Web implements the classic trio: pull down to reload, swipe from the left edge to go back, swipe from the right to go forward. Long-press links and images for context menus, just like the big browsers.',
      'Pro tip: on desktop, Alt+Left and Alt+Right navigate history — and Ctrl+D bookmarks the current page.',
    ] },
  { id: 'a6', section: 'Trending', emoji: '🛰️', hue: 10, source: 'Signal & Noise', time: Date.now() - 2 * 86400e3, sponsored: true,
    title: 'Sponsored: WhaleVPN — stream the whole ocean (demo card)',
    body: [
      'This is a demonstration of a sponsored feed card. With Orca’s ad blocker enabled (Settings → Site settings → Ads), sponsored cards like this one disappear from your feed.',
      'No VPNs were harmed in the making of this card. It exists purely to show that content filtering works.',
    ] },
];

export function renderFeed(tab) {
  const wrap = el('div', { class: 'feed' });
  const dismissed = new Set(DB.feedDismissed);
  const adsBlocked = DB.settings.adBlock;
  const sections = [...new Set(ARTICLES.map((a) => a.section))];
  for (const sec of sections) {
    const items = ARTICLES.filter((a) => a.section === sec && !dismissed.has(a.id) && !(adsBlocked && a.sponsored));
    if (!items.length) continue;
    wrap.append(el('div', { class: 'feed-h' }, el('b', {}, sec === 'For you' ? 'Articles for you' : sec)));
    for (const a of items) {
      const card = el('button', {
        class: 'fcard' + (a.sponsored ? ' sponsored' : ''),
        onclick: () => navigate(tab, `orca://article/${a.id}`),
      },
        el('div', { class: 'f-thumb', style: { background: `linear-gradient(135deg, hsl(${a.hue} 70% 45%), hsl(${(a.hue + 40) % 360} 70% 32%))` } }, a.emoji),
        el('div', { class: 'f-body' },
          el('div', { class: 'f-title' }, a.title),
          el('div', { class: 'f-meta' },
            el('span', {}, a.source), el('span', {}, '·'), el('span', {}, timeAgo(a.time)),
            el('span', { class: 'spacer' }),
            el('button', {
              class: 'f-dismiss', title: 'Not interested',
              onclick: (e) => {
                e.stopPropagation();
                DB.feedDismissed.push(a.id);
                saveSoon();
                card.style.transition = 'opacity .2s'; card.style.opacity = '0';
                setTimeout(() => { card.remove(); }, 210);
              },
            }, '✕'),
          ),
        ));
      wrap.append(card);
    }
  }
  if (!wrap.querySelector('.fcard')) {
    wrap.append(el('div', { class: 'iempty' }, el('div', { class: 'big' }, '📭'), 'You’re all caught up.', el('br'), 'Dismissed articles stay hidden.'));
  }
  return wrap;
}

export function getArticle(id) { return ARTICLES.find((a) => a.id === id); }
