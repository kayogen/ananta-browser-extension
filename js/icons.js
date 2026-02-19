/**
 * icons.js — Favicon/icon resolution with multi-provider fallback and in-memory cache.
 *
 * Provider order:
 *   1. DuckDuckGo icon API (https://icons.duckduckgo.com/ip3/{domain}.ico)
 *   2. Google Favicons API (https://www.google.com/s2/favicons?domain={domain}&sz={size})
 *   3. chrome://favicon2/ (Chromium-only, fastest but MV3 restricted)
 *   4. Letter badge (coloured SVG data URL — always works)
 *
 * All resolved URLs are stored in an in-memory Map keyed by domain.
 * Errors trigger silent fallback through the chain.
 */

"use strict";

/* ── In-memory cache: domain → resolved URL/dataURI ──────────────────────── */
const _iconCache = new Map();

/* ── Hue palette for letter badges (domain-hash) ────────────────────────── */
const _BADGE_HUES = [210, 195, 168, 280, 330, 20, 45, 145, 0, 260, 180, 310];

function _domainHue(domain) {
  let h = 0;
  for (let i = 0; i < domain.length; i++)
    h = (h * 31 + domain.charCodeAt(i)) >>> 0;
  return _BADGE_HUES[h % _BADGE_HUES.length];
}

/**
 * Extract registrable domain (hostname without protocol).
 * @param {string} url
 * @returns {string}
 */
function extractDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * Generate a letter-badge data URL for a domain.
 * Returns an SVG encoded as a data URI — always succeeds.
 *
 * @param {string} domain
 * @param {number} [size=64]
 * @returns {string} data: URI
 */
function letterBadge(domain, size = 64) {
  const letter = (domain[0] || "?").toUpperCase();
  const hue = _domainHue(domain);
  const bg = `hsl(${hue}, 65%, 55%)`;
  const fontSize = Math.round(size * 0.45);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${Math.round(size * 0.22)}" fill="${bg}"/>
  <text x="50%" y="50%" dy="0.35em" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,'SF Pro Display',sans-serif" font-size="${fontSize}" font-weight="600" fill="white">${letter}</text>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * Test if an image URL loads successfully.
 * Resolves with the URL on success, rejects on error.
 *
 * @param {string} url
 * @param {number} [timeout=3000] ms
 * @returns {Promise<string>}
 */
function _probeImage(url, timeout = 3000) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const timer = setTimeout(() => {
      img.src = "";
      reject(new Error("timeout"));
    }, timeout);
    img.onload = () => {
      clearTimeout(timer);
      // Reject images that are 1×1 (transparent pixel — Google/DDG no-icon)
      if (img.naturalWidth <= 1 && img.naturalHeight <= 1) {
        reject(new Error("blank icon"));
      } else {
        resolve(url);
      }
    };
    img.onerror = () => {
      clearTimeout(timer);
      reject(new Error("load error"));
    };
    img.src = url;
  });
}

/**
 * Resolve the best available icon URL for a given page URL.
 *
 * Checks the cache first. If not cached, tries providers in order,
 * settles on the first that loads, caches the result, and returns it.
 *
 * @param {string} pageUrl   — full URL of the page
 * @param {number} [size=64] — desired icon size in px
 * @returns {Promise<string>} — always resolves (falls back to letter badge)
 */
async function getIcon(pageUrl, size = 64) {
  const domain = extractDomain(pageUrl);
  const cacheKey = `${domain}@${size}`;

  if (_iconCache.has(cacheKey)) {
    return _iconCache.get(cacheKey);
  }

  // Build provider chain based on environment
  const providers = [];

  // 1. DuckDuckGo (works in all browsers, no auth needed)
  providers.push(`https://icons.duckduckgo.com/ip3/${domain}.ico`);

  // 2. Google Favicons service (Firefox-safe, cross-origin)
  providers.push(
    `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=${size}`,
  );

  // 3. Chromium-native (fastest, but may be undefined in Firefox)
  if (typeof chrome !== "undefined" && chrome.runtime) {
    providers.push(
      `chrome://favicon2/?size=${size}&page_url=${encodeURIComponent(pageUrl)}`,
    );
  }

  for (const url of providers) {
    try {
      const resolved = await _probeImage(url);
      _iconCache.set(cacheKey, resolved);
      return resolved;
    } catch {
      // try next provider
    }
  }

  // All providers failed — render letter badge
  const badge = letterBadge(domain, size);
  _iconCache.set(cacheKey, badge);
  return badge;
}

/**
 * Synchronously return a cached icon or start resolving it in the background.
 * Calls `callback(url)` immediately if cached, or after resolution.
 * Returns a letter badge immediately if not cached (replaced when ready).
 *
 * @param {string}   pageUrl
 * @param {number}   size
 * @param {Function} callback(url)  — called with final URL
 * @returns {string} immediate URL (badge or cached)
 */
function getIconSync(pageUrl, size, callback) {
  const domain = extractDomain(pageUrl);
  const cacheKey = `${domain}@${size}`;

  if (_iconCache.has(cacheKey)) {
    const cached = _iconCache.get(cacheKey);
    if (callback) callback(cached);
    return cached;
  }

  // Return badge immediately; resolve in background
  const immediate = letterBadge(domain, size);
  getIcon(pageUrl, size).then((url) => {
    if (callback) callback(url);
  });
  return immediate;
}

/**
 * Preload icons for an array of URLs into the cache.
 * Fire-and-forget; errors are silently ignored.
 *
 * @param {string[]} urls
 * @param {number}   [size=64]
 */
function preloadIcons(urls, size = 64) {
  for (const url of urls) {
    getIcon(url, size).catch(() => {});
  }
}

// Expose globally
window.AnantaIcons = {
  getIcon,
  getIconSync,
  preloadIcons,
  letterBadge,
  extractDomain,
};
