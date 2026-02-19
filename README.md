# Ananta — macOS-Native New Tab Extension

A premium New Tab extension designed to feel like a real macOS system component. Frosted glass, smooth animations, Spotlight search, Finder column-view bookmarks, and Launchpad-style top sites — built entirely on browser extension APIs with zero external dependencies.

---

## Features

| Feature              | Description                                                                   |
| -------------------- | ----------------------------------------------------------------------------- |
| **Hero Clock**       | Ultra-large thin-weight time display updated every second                     |
| **World Clocks**     | IST · CST · EST — analog canvas clocks + digital time in macOS widget cards   |
| **Spotlight Search** | `⌘K` / `Ctrl+K` opens a centered frosted-glass overlay searching your history |
| **Launchpad**        | Top 30 most-visited sites in a macOS Launchpad-style grid                     |
| **Finder Bookmarks** | Bookmark tree rendered as Finder column (Miller Columns) navigation           |
| **Glassmorphism**    | `backdrop-filter: blur(24px)` on every surface                                |
| **Auto dark/light**  | Full light + dark mode via `prefers-color-scheme`                             |
| **Zero tracking**    | No analytics, no telemetry, no cloud, no external fonts                       |
| **Instant**          | All data loaded in parallel, renders in < 150ms                               |

---

## Architecture

```
extension/
├── index.html          ← Layout only (no inline JS/CSS)
├── manifest.json
├── css/
│   ├── layout.css      ← Design tokens, glassmorphism, base reset
│   ├── widgets.css     ← Hero clock, world clock cards
│   ├── spotlight.css   ← Spotlight overlay, results
│   ├── launchpad.css   ← Launchpad icon grid
│   └── finder.css      ← Finder column-view
└── js/
    ├── utils.js        ← Shared utilities, browserAPI shim, getFavicon()
    ├── clocks.js       ← rAF-driven analog + digital world clocks
    ├── spotlight.js    ← History search overlay
    ├── topsites.js     ← Launchpad top sites
    ├── finder.js       ← Finder column bookmark navigation
    └── main.js         ← Boot orchestrator (32 lines)
```

---

## Install

### Chrome, Brave, Edge

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked**
4. Select the `extension/` folder

### Firefox

1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on…**
3. Select `extension/manifest.json`

> For permanent Firefox install, submit to [addons.mozilla.org](https://addons.mozilla.org) for signing.

---

## Keyboard Shortcuts

| Shortcut        | Action                  |
| --------------- | ----------------------- |
| `⌘K` / `Ctrl+K` | Open Spotlight search   |
| `ESC`           | Close Spotlight         |
| `↑` / `↓`       | Navigate search results |
| `Enter`         | Open selected result    |
| `←` / `→`       | Navigate Finder columns |

---

## Design Reference

| Component        | macOS Reference           |
| ---------------- | ------------------------- |
| Hero clock       | macOS Sonoma clock widget |
| World clocks     | macOS Clock app widgets   |
| Search overlay   | macOS Spotlight           |
| Top sites grid   | macOS Launchpad           |
| Bookmark browser | macOS Finder column view  |

---

## Privacy

- All data is read from `chrome.history`, `chrome.bookmarks`, `chrome.topSites` — local browser APIs
- No network requests except favicon resolution:
  - Chrome/Brave/Edge: `chrome://favicon2/` (internal, no HTTP)
  - Firefox: `https://www.google.com/s2/favicons` (one per domain, standard practice)
- No external fonts (system font stack: `-apple-system, BlinkMacSystemFont, "SF Pro Display"`)
- No analytics, no localStorage (except browser extension storage for nothing at present)

| Browser | Manifest | Status                         |
| ------- | -------- | ------------------------------ |
| Chrome  | V3       | ✅ Full support                |
| Brave   | V3       | ✅ Full support                |
| Edge    | V3       | ✅ Full support                |
| Firefox | V3       | ✅ Full support (Firefox 109+) |

---

## Installation

### Chrome / Brave / Edge

1. Open `chrome://extensions` (or `edge://extensions` for Edge)
2. Enable **Developer mode** (toggle in the top-right corner)
3. Click **Load unpacked**
4. Select the `extension/` folder inside this project
5. Open a new tab — Ananta will appear immediately

### Firefox

1. Open `about:debugging`
2. Click **This Firefox** in the left sidebar
3. Click **Load Temporary Add-on…**
4. Navigate to the `extension/` folder and select `manifest.json`
5. Open a new tab to see Ananta

> **Note:** Firefox temporary add-ons are removed when the browser restarts. For permanent installation, the extension must be signed via [addons.mozilla.org](https://addons.mozilla.org/).

---

## Project Structure

```
browser-homepage-ext/
  extension/                  ← Load this folder as the unpacked extension
    manifest.json             ← Extension manifest (MV3, cross-browser)
    index.html                ← New Tab page HTML
    css/
      styles.css              ← Complete UI styles (light + dark mode)
    js/
      utils.js                ← Shared utilities (favicon, date, helpers)
      bookmarks.js            ← Bookmark tree fetch + render + search
      topsites.js             ← Top Sites grid fetch + render
      history.js              ← History timeline fetch + group + render
      main.js                 ← Boot orchestrator, clock, global search
    assets/
      icons/                  ← SVG extension icons (16/32/48/128px)
  README.md                   ← This file
```

---

## Keyboard Shortcuts

| Shortcut            | Action                                |
| ------------------- | ------------------------------------- |
| `⌘K` / `Ctrl+K`     | Focus the global search bar           |
| `↑` / `↓` in search | Navigate results                      |
| `Enter` in search   | Open selected result                  |
| `Escape`            | Close search / close sidebar (mobile) |

---

## Privacy

- **No external network requests** except favicon resolution:
  - Chrome/Edge/Brave: `chrome://favicon2/` (internal, no network)
  - Firefox: `https://www.google.com/s2/favicons` (external, only domain names sent)
- No data is stored outside the browser
- No cookies, localStorage (beyond sidebar collapse state), or IndexedDB used for personal data
- All data displayed comes directly from the browser's own APIs

---

## Architecture

All data is fetched using official WebExtension APIs:

| Data      | API Used                     |
| --------- | ---------------------------- |
| Bookmarks | `chrome.bookmarks.getTree()` |
| Top Sites | `chrome.topSites.get()`      |
| History   | `chrome.history.search()`    |

The three data modules (`bookmarks.js`, `topsites.js`, `history.js`) are loaded in parallel via `Promise.all()` so the page is fully populated within ~200ms on typical machines.

---

## Development

No build step required — the extension runs directly as vanilla JS/HTML/CSS.

To make changes:

1. Edit any file in `extension/`
2. In `chrome://extensions`, click the **Refresh** button on the Ananta card
3. Open a new tab to see your changes

---

## Troubleshooting

**Nothing appears on new tab page**

- Make sure you loaded the `extension/` subfolder (not the parent `browser-homepage-ext/`)
- Check the browser console (`F12`) for error messages

**Bookmarks/History not loading on Firefox**

- Firefox requires the `history` and `bookmarks` permissions to be approved. If denied, reload the extension from `about:debugging`.

**Icons not showing (Firefox)**

- Firefox loads favicons from Google's service. If you're offline, favicons fall back to letter badges — this is expected behaviour.

**Sidebar state resets on every tab**

- Sidebar collapse state is stored in `localStorage` which is scoped to the extension page. This is expected for privacy reasons.
