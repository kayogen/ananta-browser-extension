/**
 * search.js — Fuzzy in-memory search index for Ananta
 *
 * Builds a pre-processed index from bookmarks, history, and top sites.
 * Query: multi-strategy scoring < 50ms for 2000+ items.
 *
 * Scoring formula:
 *   score = matchScore * 0.60 + recencyScore * 0.25 + frequencyScore * 0.15
 *
 * Match strategies (highest wins per item):
 *   1.0  — exact match
 *   0.92 — prefix match on title tokens
 *   0.85 — prefix match on domain
 *   0.78 — substring match title
 *   0.70 — substring match URL
 *   0.55 — fuzzy match title (Levenshtein ≤ 2)
 *   0.40 — fuzzy match domain (Levenshtein ≤ 2)
 *
 * Public API:
 *   buildIndex(bookmarks, history, topSites)
 *   query(q, { maxResults: 20 }) → Array<SearchResult>
 *   getBookmarkList() → flat bookmark array (for bookmarks.js)
 */

"use strict";

/* ── Index storage ──────────────────────────────────────────────────────── */
let _index = []; // Array<IndexEntry>
let _bookmarkFlat = []; // flat list for bookmarks.js

/* ── IndexEntry shape ───────────────────────────────────────────────────── */
// {
//   title:     string  (lower)
//   url:       string  (original)
//   urlLower:  string  (lower)
//   domain:    string  (lower, no www)
//   tokens:    string[]  (title words, lower)
//   type:      'bookmark' | 'history' | 'topsite'
//   lastVisit: number  (ms timestamp, 0 if unknown)
//   visits:    number  (visit count, 0 if unknown)
// }

/* ── Levenshtein distance (bounded, early-exit) ─────────────────────────── */
/**
 * Compute edit distance between two short strings.
 * Returns early if distance exceeds `max` (for performance).
 *
 * @param {string} a
 * @param {string} b
 * @param {number} max — maximum useful distance
 * @returns {number}
 */
function levenshtein(a, b, max = 3) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;

  const la = a.length;
  const lb = b.length;
  // Use two-row DP
  let prev = Array.from({ length: lb + 1 }, (_, i) => i);
  let curr = new Array(lb + 1);

  for (let i = 1; i <= la; i++) {
    curr[0] = i;
    let rowMin = i;
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1, // deletion
        curr[j - 1] + 1, // insertion
        prev[j - 1] + cost, // substitution
      );
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > max) return max + 1; // early exit
    [prev, curr] = [curr, prev];
  }
  return prev[lb];
}

/* ── Normalise a URL to extractable domain ──────────────────────────────── */
function _domain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

/* ── Tokenise a string into lowercase words ─────────────────────────────── */
function _tokens(str) {
  return (str || "")
    .toLowerCase()
    .split(/[\s\-_./|:,@]+/)
    .filter((t) => t.length >= 2);
}

/* ── Recency score: 1.0 = now, 0.0 = 90+ days ago ──────────────────────── */
const _90DAYS = 90 * 24 * 60 * 60 * 1000;
function _recencyScore(lastVisit) {
  if (!lastVisit) return 0;
  const age = Date.now() - lastVisit;
  return Math.max(0, 1 - age / _90DAYS);
}

/* ── Frequency score: logarithmic, clamped to [0, 1] ────────────────────── */
const _MAX_VISITS = 500;
function _freqScore(visits) {
  if (!visits) return 0;
  return Math.min(1, Math.log10(visits + 1) / Math.log10(_MAX_VISITS + 1));
}

/* ── Build match score for a query against an entry ────────────────────── */
function _matchScore(q, entry) {
  const qLow = q.toLowerCase().trim();
  if (!qLow) return 0;

  // 1. Exact title match
  if (entry.title === qLow) return 1.0;

  // 2. Exact domain match
  if (entry.domain === qLow) return 0.95;

  // 3. Title prefix
  if (entry.title.startsWith(qLow)) return 0.92;

  // 4. Domain prefix
  if (entry.domain.startsWith(qLow)) return 0.85;

  // 5. Title token prefix (any token starts with query)
  if (entry.tokens.some((t) => t.startsWith(qLow))) return 0.82;

  // 6. URL contains query
  if (entry.urlLower.includes(qLow)) return 0.75;

  // 7. Title substring
  if (entry.title.includes(qLow)) return 0.7;

  // 8. Fuzzy: Levenshtein ≤ 2 on title tokens
  const qLen = qLow.length;
  for (const tok of entry.tokens) {
    if (Math.abs(tok.length - qLen) <= 2) {
      const dist = levenshtein(qLow, tok, 2);
      if (dist <= 2) return 0.55 - dist * 0.05; // 0.55 or 0.50
    }
  }

  // 9. Fuzzy on domain parts
  for (const part of entry.domain.split(".")) {
    if (part.length >= 3 && Math.abs(part.length - qLen) <= 2) {
      const dist = levenshtein(qLow, part, 2);
      if (dist <= 2) return 0.4 - dist * 0.04;
    }
  }

  return 0; // no match
}

/* ── Public: Build the index ─────────────────────────────────────────────── */
/**
 * Pre-process bookmarks, history, and top sites into the in-memory index.
 * Call this once on boot (and again after any live data updates).
 *
 * @param {object[]} bookmarks — objects with { title, url }
 * @param {object[]} historyItems — browser history items (title?, url, lastVisitTime?, visitCount?)
 * @param {object[]} topSites — objects with { title, url }
 */
function buildIndex(bookmarks = [], historyItems = [], topSites = []) {
  const seen = new Set();
  _index = [];
  _bookmarkFlat = [];

  function _add(item, type) {
    if (!item.url || seen.has(item.url)) return;
    seen.add(item.url);
    const title = (item.title || "").toLowerCase().trim();
    const domain = _domain(item.url);
    const entry = {
      title,
      titleRaw: item.title || "",
      url: item.url,
      urlLower: item.url.toLowerCase(),
      domain,
      tokens: [...new Set([..._tokens(title), ..._tokens(domain)])],
      type,
      lastVisit: item.lastVisitTime || 0,
      visits: item.visitCount || 0,
    };
    _index.push(entry);
    if (type === "bookmark") _bookmarkFlat.push(entry);
  }

  for (const bm of bookmarks) _add(bm, "bookmark");
  for (const ts of topSites) _add(ts, "topsite");
  for (const hi of historyItems) _add(hi, "history");
}

/* ── Public: Query ───────────────────────────────────────────────────────── */
/**
 * Score, filter, and sort all index entries against a query string.
 *
 * @param {string} q           — query string (raw)
 * @param {object} [opts]
 * @param {number} [opts.maxResults=20]
 * @param {'all'|'bookmark'|'history'|'topsite'} [opts.type='all']
 * @returns {SearchResult[]} — sorted by composite score descending
 *
 * @typedef {object} SearchResult
 * @property {string} title
 * @property {string} url
 * @property {string} domain
 * @property {string} type
 * @property {number} score    — composite [0,1]
 * @property {number} matchScore
 */
function query(q, { maxResults = 20, type = "all" } = {}) {
  if (!q || q.trim().length < 2) return [];

  const results = [];

  for (const entry of _index) {
    if (type !== "all" && entry.type !== type) continue;

    const matchScore = _matchScore(q, entry);
    if (matchScore === 0) continue;

    const score =
      matchScore * 0.6 +
      _recencyScore(entry.lastVisit) * 0.25 +
      _freqScore(entry.visits) * 0.15;

    results.push({
      title: entry.titleRaw,
      url: entry.url,
      domain: entry.domain,
      type: entry.type,
      score,
      matchScore,
    });
  }

  // Sort descending by composite score
  results.sort((a, b) => b.score - a.score);

  return results.slice(0, maxResults);
}

/* ── Public: Get flat bookmark list ─────────────────────────────────────── */
/**
 * Returns the flat list of all bookmarks added via buildIndex().
 * Used by bookmarks.js to filter the tree without re-fetching.
 *
 * @returns {{ title:string, url:string, domain:string }[]}
 */
function getBookmarkList() {
  return _bookmarkFlat.map((e) => ({
    title: e.titleRaw,
    url: e.url,
    domain: e.domain,
  }));
}

// Expose globally
window.AnantaSearch = { buildIndex, query, getBookmarkList };
