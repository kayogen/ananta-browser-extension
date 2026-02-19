# Ananta — Store Listing Copy

## Extension Name

Ananta New Tab

## Short Description (≤ 132 chars — Chrome / Firefox / Edge)

A beautiful, privacy-first new tab with live world clocks, bookmarks, top sites and history search.

## Full Description

**Ananta** transforms your new tab into a calm, productive home screen — inspired by macOS aesthetics, built with speed and privacy in mind.

### ✦ Features

**🕐 World Clocks**
Track multiple cities at a glance. Add, remove and reorder clocks. Day/night cards automatically adapt to each timezone's current period.

**🔎 Spotlight Search**
Instantly search your history, bookmarks and top sites — all local, all private. No data ever leaves your device.

**⭐ Top Sites**
Your most visited sites shown as a clean icon grid, ready to launch in one click.

**📁 Bookmarks**
Browse your full bookmark tree in a VS Code–style explorer panel. Folder tabs let you switch between collections fast.

**🌙 Dark Mode**
Full system dark mode support. The interface adapts automatically.

**🔒 Privacy First**
Ananta reads your browser data locally. Nothing is sent to any server. There are no trackers, no analytics, no accounts.

---

### Permissions used

| Permission  | Why                            |
| ----------- | ------------------------------ |
| `bookmarks` | Display your bookmark tree     |
| `history`   | Power local Spotlight search   |
| `topSites`  | Show most-visited site tiles   |
| `sessions`  | Recent tab search in Spotlight |
| `storage`   | Save your world clock cities   |

---

## Category

- Chrome Web Store: **Productivity**
- Firefox AMO: **Other** → Productivity
- Edge Add-ons: **Productivity**

## Tags / Keywords

new tab, productivity, world clock, bookmarks, spotlight search, macOS, privacy, dark mode, homepage

## Homepage URL

https://github.com/kartiktyagi/ananta ← update before submitting

## Privacy Policy URL

(Paste URL to your hosted privacy policy — see PRIVACY_POLICY.md)

---

## Store Checklist

### Chrome Web Store (https://chrome.google.com/webstore/devconsole)

- [ ] Pay one-time $5 developer registration fee
- [ ] Upload `dist/ananta-chrome-v1.0.0.zip`
- [ ] Add 1280×800 or 640×400 screenshot (at least 1, up to 5)
- [ ] Add 128×128 store icon PNG (`assets/icons/png/icon128.png`)
- [ ] Fill in description, category, language
- [ ] Set visibility: Public
- [ ] Submit for review (typically 1–3 business days)

### Firefox AMO (https://addons.mozilla.org/developers/)

- [ ] Create account (free)
- [ ] Upload `dist/ananta-firefox-v1.0.0.zip`
- [ ] Answer "Does your add-on use remote code?" → No
- [ ] Upload source code zip if AMO requests it (our code is already plain JS)
- [ ] Add screenshots (1200×900 recommended)
- [ ] Fill in listing details
- [ ] Submit for review (automated + manual, 1–7 days)

### Microsoft Edge Add-ons (https://partner.microsoft.com/dashboard/microsoftedge)

- [ ] Sign in with Microsoft account (free)
- [ ] Upload `dist/ananta-edge-v1.0.0.zip`
- [ ] Add store icon (300×300 PNG — use `assets/icons/png/icon300.png`)
- [ ] Add screenshots
- [ ] Fill in listing, click Publish (usually approved within 1–3 days)

### Brave

Brave users install from the Chrome Web Store — no separate submission needed once Chrome is live.

### Safari (macOS + Xcode required)

```
npm run safari
```

This runs `xcrun safari-web-extension-converter` which scaffolds an Xcode project at `dist/safari/`.
Open the project in Xcode, set your Apple Developer Team, then:

- Archive → Distribute App → App Store Connect
- Requires **Apple Developer Program** ($99/year)
- Review time: 1–7 days

---

## Screenshot Guidance

Capture at **1280×800** (Chrome requirement, accepted everywhere):

1. New tab with world clocks visible + dark mode
2. Spotlight search open with results
3. Bookmarks panel expanded
4. World clock edit mode
5. Light mode variant

Tool: use Chrome DevTools device emulator set to 1280×800, full-page screenshot.
