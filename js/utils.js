/**
 * utils.js — Shared utilities for Ananta New Tab Extension
 *
 * Exports (globals used across modules):
 *   browserAPI, getFavicon, escapeHtml, highlightText,
 *   displayUrl, cleanDomain, debounce
 */

"use strict";

/* ── Cross-browser API shim ─────────────────────────────────────────────────
   Manifest V3 uses `chrome.*`; Firefox also accepts `browser.*` (Promise-based).
   We normalise to `chrome.*` and wrap Promise calls where needed.           */
// eslint-disable-next-line no-undef
const browserAPI =
  typeof chrome !== "undefined" && chrome.bookmarks
    ? chrome
    : // eslint-disable-next-line no-undef
      typeof browser !== "undefined"
      ? browser
      : null;

if (!browserAPI) {
  console.error("[Ananta] No browser extension API found.");
}

/* ── Favicon resolution ──────────────────────────────────────────────────── */

const IS_FIREFOX =
  typeof InstallTrigger !== "undefined" ||
  (typeof navigator !== "undefined" && navigator.userAgent.includes("Firefox"));

/**
 * Return a favicon image URL for the given page URL.
 * Chrome/Brave/Edge: uses the built-in chrome://favicon2/ endpoint.
 * Firefox: falls back to Google's favicon service (only external call allowed).
 *
 * @param {string} pageUrl  - Full URL of the page
 * @param {number} [size=32] - Desired favicon size in pixels
 * @returns {string}
 */
function getFavicon(pageUrl, size = 32) {
  if (!pageUrl) return "";
  try {
    // Validate URL
    const url = new URL(pageUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";

    if (IS_FIREFOX) {
      // Google Favicon API — only external network dependency
      return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(url.hostname)}&sz=${size}`;
    }

    // Chrome / Edge / Brave — internal API, no network call
    return `chrome://favicon2/?size=${size}&scale_factor=1x&show_fallback_monogram=&page_url=${encodeURIComponent(pageUrl)}`;
  } catch {
    return "";
  }
}

/* ── Date / time formatting ──────────────────────────────────────────────── */

/**
 * Format a Date object as "9:41 AM" or "14:05" depending on locale.
 * @param {Date} date
 * @returns {string}
 */
function formatTime(date) {
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

/**
 * Format a Date as a short time string for history items: "3:05 PM"
 * @param {Date} date
 * @returns {string}
 */
function formatTimeShort(date) {
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

/**
 * Full date string: "Wednesday, 19 February 2026"
 * @param {Date} date
 * @returns {string}
 */
function formatDate(date) {
  return date.toLocaleDateString([], {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * Return a group label for a timestamp.
 * @param {number} timestamp  - Unix ms
 * @returns {'Today'|'Yesterday'|string}
 */
function relativeDate(timestamp) {
  const now = new Date();
  const date = new Date(timestamp);

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart.getTime() - 86_400_000);
  const weekStart = new Date(todayStart.getTime() - 6 * 86_400_000);

  if (date >= todayStart) return "Today";
  if (date >= yesterdayStart) return "Yesterday";
  if (date >= weekStart) {
    return date.toLocaleDateString([], { weekday: "long" }); // "Monday"
  }
  return date.toLocaleDateString([], {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/* ── Greeting ────────────────────────────────────────────────────────────── */

/**
 * Return a time-appropriate greeting.
 * @returns {string}
 */
function getGreeting() {
  const h = new Date().getHours();
  if (h < 5) return "Burning the midnight oil 🌙";
  if (h < 12) return "Good morning ☀️";
  if (h < 17) return "Good afternoon 👋";
  if (h < 21) return "Good evening 🌆";
  return "Good night 🌙";
}

/* ── String utilities ────────────────────────────────────────────────────── */

const ESC_MAP = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/**
 * Escape a string for safe HTML insertion.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  if (typeof str !== "string") return "";
  return str.replace(/[&<>"']/g, (c) => ESC_MAP[c]);
}

/**
 * Highlight occurrences of `query` inside `text` with <mark class="highlight">.
 * @param {string} text
 * @param {string} query
 * @returns {string}  safe HTML
 */
function highlightText(text, query) {
  if (!query) return escapeHtml(text);
  const escaped = escapeHtml(text);
  if (!query.trim()) return escaped;
  const safe = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  try {
    const re = new RegExp(`(${safe})`, "gi");
    return escaped.replace(re, '<mark class="highlight">$1</mark>');
  } catch {
    return escaped;
  }
}

/**
 * Extract a clean domain label from a URL (e.g. "google.com").
 * @param {string} url
 * @returns {string}
 */
function cleanDomain(url) {
  try {
    const { hostname } = new URL(url);
    return hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * Shorten a URL for display (strip protocol, www, trailing slash).
 * @param {string} url
 * @returns {string}
 */
function displayUrl(url) {
  try {
    const u = new URL(url);
    return (u.hostname.replace(/^www\./, "") + u.pathname).replace(/\/$/, "");
  } catch {
    return url;
  }
}

/* ── Debounce ────────────────────────────────────────────────────────────── */

/**
 * Returns a debounced version of `fn` that fires after `wait` ms of silence.
 * @template {(...args: any[]) => any} T
 * @param {T} fn
 * @param {number} wait
 * @returns {T}
 */
function debounce(fn, wait) {
  let timer;
  return function debounced(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), wait);
  };
}

/* ── DOM helpers ─────────────────────────────────────────────────────────── */

/**
 * Safely set innerHTML after escaping, or set complex HTML from trusted strings.
 * @param {HTMLElement} el
 * @param {string} html   Trusted HTML (caller is responsible for sanitising dynamic parts).
 */
function setHtml(el, html) {
  if (!el) return;
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  el.replaceChildren(...doc.body.childNodes);
}

/**
 * Parse a trusted SVG string via DOMParser and set it as the sole child of el.
 * Avoids innerHTML assignment — satisfies Firefox AMO linter.
 * @param {HTMLElement} el
 * @param {string} svgStr  A complete <svg>…</svg> string (must be trusted/static).
 */
function setSvg(el, svgStr) {
  if (!el) return;
  const doc = new DOMParser().parseFromString(svgStr, "image/svg+xml");
  const svg = doc.documentElement;
  el.replaceChildren(svg);
}

/**
 * Render text inside `el`, wrapping each match of `query` in a <mark class="highlight">.
 * Builds the DOM directly — no innerHTML involved.
 * @param {HTMLElement} el
 * @param {string} text   Plain text (not HTML) to display.
 * @param {string} query  Search term to highlight.
 */
function setHighlight(el, text, query) {
  if (!el) return;
  el.replaceChildren();
  if (!query || !query.trim()) {
    el.textContent = text;
    return;
  }
  const safe = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  let re;
  try {
    re = new RegExp(safe, "gi");
  } catch {
    el.textContent = text;
    return;
  }
  let lastIndex = 0;
  let match;
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      el.appendChild(
        document.createTextNode(text.slice(lastIndex, match.index)),
      );
    }
    const mark = document.createElement("mark");
    mark.className = "highlight";
    mark.textContent = match[0];
    el.appendChild(mark);
    lastIndex = re.lastIndex;
  }
  if (lastIndex < text.length) {
    el.appendChild(document.createTextNode(text.slice(lastIndex)));
  }
}

/**
 * Create a favicon <img> element with an error fallback to a letter badge.
 * @param {string} url  - Page URL (not favicon URL)
 * @param {string} [label] - Fallback letter/label
 * @returns {HTMLElement}
 */
function createFaviconImg(url, label) {
  const src = getFavicon(url);
  if (!src) {
    return createLetterBadge(label || "?");
  }

  const img = document.createElement("img");
  img.src = src;
  img.width = 16;
  img.height = 16;
  img.className = "favicon";
  img.alt = "";
  img.decoding = "async";
  img.onerror = () => {
    const badge = createLetterBadge(label || "?");
    img.replaceWith(badge);
  };
  return img;
}

/**
 * Create a letter-badge fallback element.
 * @param {string} label
 * @returns {HTMLElement}
 */
function createLetterBadge(label) {
  const el = document.createElement("span");
  el.className = "favicon-placeholder";
  el.textContent = String(label).charAt(0).toUpperCase();
  el.setAttribute("aria-hidden", "true");
  return el;
}
