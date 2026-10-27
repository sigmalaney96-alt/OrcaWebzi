// app/firstrun.js — first-run experience: ToS, search engine pick, sign-in prompt, feature tips
import { DB, saveSoon, SEARCH_ENGINES, setting } from '../core/store.js';
import { $, el, icon } from '../core/utils.js';
import { showTip } from '../core/ui.js';
import { signInDialog } from './sync.js';

export function maybeFirstRun() {
  if (DB.fre.done) { maybeTips(); return; }
  const root = $('#fre');
  root.classList.add('open');
  let step = 0;
  let pickedEngine = DB.settings.engine;

  const render = () => {
    root.innerHTML = '';
    const card = el('div', { class: 'fre-card' });
    root.append(card);

    if (step === 0) {
      card.append(
        el('img', { class: 'logo', src: '/IMG_7168.jpeg', alt: 'Orca Orca Web' }),
        el('h2', {}, 'Welcome to Orca'),
        el('div', { class: 'sub' }, 'A full browser experience, as a web app'),
        el('p', { class: 'fre-tos' },
          'By continuing you agree to the Orca Terms of Service. Your browsing data (history, bookmarks, passwords) is stored locally on this device and never leaves it in this build.'),
        el('div', { class: 'spacer' }),
        el('button', { class: 'btn-mat', onclick: () => { step = 1; render(); } }, 'Accept & continue'),
      );
    } else if (step === 1) {
      card.append(
        el('h2', {}, 'Choose your search engine'),
        el('div', { class: 'sub' }, 'Used for address-bar searches. Change anytime in Settings.'),
        el('div', { class: 'ip-card', style: { margin: '0' } },
          ...Object.entries(SEARCH_ENGINES).map(([id, e]) => {
            const r = el('input', { type: 'radio', name: 'fre-engine' });
            r.checked = pickedEngine === id;
            r.addEventListener('change', () => { pickedEngine = id; });
            return el('label', { class: 'radioline' }, r, el('span', {}, e.name));
          })),
        el('div', { class: 'spacer' }),
        el('button', { class: 'btn-mat', onclick: () => { setting('engine', pickedEngine); step = 2; render(); } }, 'Continue'),
      );
    } else if (step === 2) {
      card.append(
        el('h2', {}, 'Sync across devices'),
        el('div', { class: 'sub' }, 'Sign in to sync bookmarks, passwords, history, tabs, and settings.'),
        el('div', { class: 'spacer' }),
        el('button', {
          class: 'btn-mat',
          onclick: () => signInDialog((ok) => { finish(); }),
        }, 'Sign in'),
        el('button', { class: 'btn-mat ghost', onclick: () => finish() }, 'No thanks'),
      );
    }
  };

  const finish = () => {
    DB.fre.done = true;
    saveSoon();
    root.classList.remove('open');
    root.innerHTML = '';
    setTimeout(maybeTips, 600);
  };
  render();
}

/* feature_engagement-style in-product help bubbles, shown once each */
function maybeTips() {
  if (DB.tips.omnibox) return;
  const chain = [
    {
      id: 'omnibox', anchor: () => $('#omnibox'), title: 'Search or type a URL',
      text: 'One bar for everything — addresses, searches, even your bookmarks and history. Tap the mic for voice search.',
    },
    {
      id: 'tabs', anchor: () => $('#tab-count'), title: 'Your tabs live here',
      text: 'Tap the counter for a grid of open tabs. Swipe a card sideways to close it, long-press to make tab groups.',
    },
    {
      id: 'menu', anchor: () => $('#btn-menu'), title: 'Everything else',
      text: 'Bookmarks, history, downloads, share, find-in-page, reader mode, desktop site, and settings — all in this menu.',
    },
  ];
  const next = () => {
    const tip = chain.find((t) => !DB.tips[t.id]);
    if (!tip) return;
    const anchor = tip.anchor();
    if (!anchor) return;
    showTip({
      id: tip.id, anchor, title: tip.title, text: tip.text,
      onDone: () => { DB.tips[tip.id] = true; saveSoon(); setTimeout(next, 350); },
    });
  };
  setTimeout(next, 900);
}
