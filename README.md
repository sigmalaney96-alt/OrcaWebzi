# Orca Orca Web 🐋

A full browser experience built as an installable Progressive Web App — tabs, omnibox,
bookmarks, history, downloads, incognito, reader mode, sync and more — wrapped in Orca's
own **"Orca Ocean"** design language (feature set adapted from the Chromium Android spec).

**Live routes**

| Route | What it is |
|---|---|
| `/` | Landing page |
| `/onboard` | **Add to Home Screen** guide — install steps for Android/iOS/Desktop, one-tap install button when the browser offers it |
| `/pwa` | **The app itself** — the whole browser feature set lives here |

App name (manifest `name`): **Orca Orca Web** · short name **Orca** · icon: `IMG_7168.jpeg` (plus generated PNG/maskable sizes in `/icons`).

## Deploy on Vercel

Zero build step — it's a static site.

```bash
vercel deploy        # or import the repo in the Vercel dashboard
```

`vercel.json` provides clean URLs (`/pwa` → `/pwa.html`, `/onboard` → `/onboard.html`),
correct `Content-Type` for the web app manifest, the `Service-Worker-Allowed` header,
and immutable caching for icons. Service worker + manifest + HTTPS (automatic on Vercel)
make it fully installable and offline-capable.

> **Note for forks:** when you change any file under `/js`, `/css`, or the HTML pages,
> bump `VERSION` in `sw.js` so the precached app shell refreshes for installed users.

## Feature map (adapted from Chromium Android)

- **Core browsing** — tabbed browsing with a card-grid switcher, tab groups, close-all,
  swipe-to-close cards, omnibox with live suggestions (history/bookmarks/engine) and
  voice search (Web Speech API), back/forward/reload, edge-swipe navigation,
  pull-to-refresh, sandboxed-iframe rendering with progress bar, Chrome-style error
  pages (offline/DNS/frame-blocked), incognito mode (dark theme, in-memory session, no
  history), find-in-page with match highlighting, zoom + text scaling + force-zoom,
  reader mode, per-tab desktop site, translate bar.
- **New Tab page** — logo, search pill, most-visited tiles, "Articles for you" feed with
  dismissible cards (ad-block-aware), explore-by-category chips.
- **Data management** — bookmarks (folders, add/edit/move/delete, partner section),
  history (search, day grouping, per-item + bulk delete, Clear browsing data dialog with
  time-range picker), downloads manager (streaming fetch, progress, pause/resume/cancel,
  IndexedDB storage, dangerous-file warnings), offline pages (service-worker cache),
  autofill (addresses + cards, local-only), password manager (show/edit/delete, leak
  check, save/auto-sign-in toggles).
- **UI** — Orca-gradient toolbar with omnibox + tab counter + ⋮ menu (full Chrome-parity
  item list), optional bottom toolbar, per-page `theme-color` tinting, dark mode with
  site darkening, auto-hide toolbar on scroll, long-press context menus
  (links/images/selection), Material-style snackbars and modals, first-run flow
  (ToS → search engine → sign-in) with feature-tip bubbles, branded splash screen.
- **Site interaction** — permissions model with per-site overrides (location, camera,
  mic, notifications, MIDI, clipboard, pop-ups, sound, JavaScript, cookies, ads),
  page-info panel (connection security, certificate viewer, cookies, site settings),
  site-settings tree, ad-block/subresource filtering, Safe-Browsing red interstitials,
  HTTPS-first mode, Chrome-styled HTTP-auth / client-cert demo dialogs, picture-in-picture,
  cast placeholder, Web Share, WebUSB/Bluetooth/NFC capability page (`orca://demo`).
- **Accounts & sync** — sign-in (local profile), sync toggles per data type, "send tab
  to self" with device picker, recent tabs across devices, exportable sync snapshot.
- **Extras** — PWA install prompt + manifest shortcuts (New tab / New incognito tab),
  share sheet with copy/QR (self-contained QR encoder, verified against the QR spec)/
  print/send-to-device, contextual search bottom panel on text selection, notifications
  center, accessibility settings, split-view (multi-window), keyboard shortcuts
  (Ctrl/⌘+T/L/W/F/D/R/H/J, Ctrl+Tab, Alt+←/→/Home…), search-engine picker + custom
  engines, languages + translate preferences, preloading/Do-Not-Track/usage-stats privacy
  options, Data Saver page.
- **Settings** — mirrors the spec: Basics (Search engine, Passwords, Payment methods,
  Addresses, Sync, Notifications, Home page, Appearance) · Advanced (Privacy & security,
  Accessibility, Site settings, Data Saver, Downloads, Languages) · About (version,
  legal/licenses, help & feedback, crash-report opt-in, reset).

Internal pages use the `orca://` scheme, e.g. `orca://newtab`, `orca://settings`,
`orca://bookmarks`, `orca://history`, `orca://downloads`, `orca://demo`.

## Architecture

Static files only; ES modules, no build step, no dependencies.

```
├── index.html  onboard.html  pwa.html      # landing / install guide / app shell
├── manifest.webmanifest  sw.js  vercel.json
├── IMG_7168.jpeg  icons/                    # brand + generated icon set
├── css/site.css  css/browser.css            # pages + "Orca Ocean" app theme
└── js/
    ├── onboard.js
    └── pwa/
        ├── core/  store.js (localStorage DB) · utils.js (DOM/URL/icons) · ui.js (snackbar/modal/sheet) · qr.js
        └── app/   main.js (boot, toolbar, switcher, page-info) · tabs.js · views.js (navigation engine)
                   · pages.js + manager.js (orca:// internal pages) · feed.js · omnibox.js
                   · menu.js · findinpage.js · share.js · gestures.js · shortcuts.js
                   · downloads.js (IndexedDB) · sync.js · firstrun.js
```

**Honest limits of the web platform:** sites that send `X-Frame-Options`/`frame-ancestors`
refuse to render inside any web-based browser (Orca shows a styled error page with
"Open externally"); per-tab iframe navigation history and cross-origin find-in-page are
likewise platform-bound. Everything else is implemented for real.
