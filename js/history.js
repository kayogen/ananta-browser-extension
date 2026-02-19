/**
 * history.js — History timeline fetching, grouping, and rendering
 *
 * Uses:  chrome.history.search()
 * Groups history items by "Today", "Yesterday", weekday name, or date.
 * Supports loading more items on demand.
 */

"use strict";

/* ── Constants ───────────────────────────────────────────────────────────── */
const INITIAL_LIMIT = 100;
const LOAD_MORE_COUNT = 100;
const HISTORY_DAYS_BACK = 30; // how far back to fetch

/* ── State ───────────────────────────────────────────────────────────────── */
/** @type {chrome.history.HistoryItem[]} */
let _allHistory = [];
let _currentLimit = INITIAL_LIMIT;

/* ── API fetch ───────────────────────────────────────────────────────────── */

/**
 * Fetch recent history items.
 * @param {number} maxResults
 * @returns {Promise<chrome.history.HistoryItem[]>}
 */
async function fetchHistory(maxResults = INITIAL_LIMIT) {
  if (!browserAPI || !browserAPI.history) {
    console.warn("[Ananta/history] history API not available");
    return [];
  }
  try {
    const startTime = Date.now() - HISTORY_DAYS_BACK * 24 * 60 * 60 * 1000;
    const items = await browserAPI.history.search({
      text: "",
      startTime,
      maxResults,
    });
    // Sort newest first
    return items.sort(
      (a, b) => (b.lastVisitTime || 0) - (a.lastVisitTime || 0),
    );
  } catch (err) {
    console.error("[Ananta/history] search failed:", err);
    return [];
  }
}

/* ── Grouping ────────────────────────────────────────────────────────────── */

/**
 * Group history items by date bucket.
 * @param {chrome.history.HistoryItem[]} items
 * @returns {Map<string, chrome.history.HistoryItem[]>}
 */
function groupByDate(items) {
  const groups = new Map();

  for (const item of items) {
    if (!item.url || !item.lastVisitTime) continue;

    const label = relativeDate(item.lastVisitTime);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(item);
  }

  return groups;
}

/* ── Rendering ───────────────────────────────────────────────────────────── */

/**
 * Render a single history item.
 * @param {chrome.history.HistoryItem} item
 * @param {number} [delay=0] - animation delay in ms
 * @returns {HTMLAnchorElement}
 */
function renderHistoryItem(item, delay = 0) {
  const a = document.createElement("a");
  a.className = "history-item";
  a.href = item.url;
  a.title = item.url;
  a.setAttribute("role", "listitem");
  a.rel = "noopener noreferrer";
  if (delay > 0) a.style.animationDelay = `${delay}ms`;

  a.addEventListener("click", (e) => {
    e.preventDefault();
    window.location.href = item.url;
  });

  // Favicon icon
  const iconWrap = document.createElement("div");
  iconWrap.className = "history-item-icon";
  iconWrap.setAttribute("aria-hidden", "true");

  const faviconSrc = getFavicon(item.url);
  if (faviconSrc) {
    const img = document.createElement("img");
    img.src = faviconSrc;
    img.alt = "";
    img.width = 16;
    img.height = 16;
    img.decoding = "async";
    img.onerror = () => {
      img.replaceWith(createLetterBadge(item.title || cleanDomain(item.url)));
    };
    iconWrap.appendChild(img);
  } else {
    iconWrap.appendChild(
      createLetterBadge(item.title || cleanDomain(item.url)),
    );
  }
  a.appendChild(iconWrap);

  // Body
  const body = document.createElement("div");
  body.className = "history-item-body";

  const titleEl = document.createElement("div");
  titleEl.className = "history-item-title";
  titleEl.textContent = item.title || displayUrl(item.url) || item.url;
  body.appendChild(titleEl);

  const urlEl = document.createElement("div");
  urlEl.className = "history-item-url";
  urlEl.textContent = displayUrl(item.url);
  body.appendChild(urlEl);

  a.appendChild(body);

  // Time
  const timeEl = document.createElement("span");
  timeEl.className = "history-item-time";
  timeEl.textContent = item.lastVisitTime
    ? formatTimeShort(new Date(item.lastVisitTime))
    : "";
  timeEl.setAttribute(
    "aria-label",
    item.lastVisitTime ? new Date(item.lastVisitTime).toLocaleString() : "",
  );
  a.appendChild(timeEl);

  return a;
}

/**
 * Render a date group (label + its items).
 * @param {string} label
 * @param {chrome.history.HistoryItem[]} items
 * @param {number} baseDelay
 * @returns {HTMLElement}
 */
function renderGroup(label, items, baseDelay = 0) {
  const group = document.createElement("div");
  group.className = "history-group";

  const labelEl = document.createElement("div");
  labelEl.className = "history-group-label";
  labelEl.textContent = label;
  group.appendChild(labelEl);

  const itemsWrap = document.createElement("div");
  itemsWrap.className = "history-group-items";

  items.forEach((item, i) => {
    itemsWrap.appendChild(renderHistoryItem(item, baseDelay + i * 15));
  });

  group.appendChild(itemsWrap);
  return group;
}

/* ── Full render ─────────────────────────────────────────────────────────── */

/**
 * Re-render the history timeline from cached `_allHistory`.
 * @param {number} limit
 */
function renderHistoryTimeline(limit) {
  const container = document.getElementById("historyTimeline");
  const meta = document.getElementById("history-meta");
  if (!container) return;

  container.innerHTML = "";

  const slice = _allHistory.slice(0, limit);

  if (slice.length === 0) {
    container.innerHTML = `<div class="empty-state">
      <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd"/>
      </svg>
      <p>No browsing history yet</p>
    </div>`;
    if (meta) meta.textContent = "";
    return;
  }

  if (meta)
    meta.textContent = `${slice.length}${_allHistory.length > limit ? "+" : ""} items`;

  const groups = groupByDate(slice);
  const fragment = document.createDocumentFragment();
  let groupDelay = 0;

  for (const [label, items] of groups) {
    fragment.appendChild(renderGroup(label, items, groupDelay));
    groupDelay += items.length * 15;
  }

  container.appendChild(fragment);

  // Toggle "Load more" button visibility
  const loadMoreBtn = document.getElementById("historyLoadMore");
  if (loadMoreBtn) {
    loadMoreBtn.style.display = limit < _allHistory.length ? "" : "none";
  }
}

/* ── Public search helper ────────────────────────────────────────────────── */

/**
 * Return history items matching a query (for global search).
 * @param {string} query
 * @returns {{ title: string, url: string }[]}
 */
function searchHistory(query) {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  return _allHistory
    .filter(
      (item) =>
        (item.title && item.title.toLowerCase().includes(q)) ||
        (item.url && item.url.toLowerCase().includes(q)),
    )
    .slice(0, 15)
    .map((item) => ({ title: item.title || item.url, url: item.url }));
}

/* ── Module init ─────────────────────────────────────────────────────────── */

/**
 * Initialise the history module.
 * @returns {Promise<void>}
 */
async function initHistory() {
  const container = document.getElementById("historyTimeline");
  const loadMoreBtn = document.getElementById("historyLoadMore");
  if (!container) return;

  // Fetch a generous buffer so we can filter+page locally
  _allHistory = await fetchHistory(500);
  _currentLimit = INITIAL_LIMIT;

  renderHistoryTimeline(_currentLimit);

  // Load more
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener("click", () => {
      _currentLimit += LOAD_MORE_COUNT;
      renderHistoryTimeline(_currentLimit);
    });
  }
}
