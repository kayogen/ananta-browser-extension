/* ══════════════════════════════════════════════════════════════════════════
   spotlight.js — macOS Spotlight-style search overlay
   Searches history, bookmarks and top sites via search.js fuzzy engine.
   Triggered by ⌘K / Ctrl+K or clicking the bar.
══════════════════════════════════════════════════════════════════════════ */

"use strict";

// ─── State ─────────────────────────────────────────────────────────────────
let _isOpen = false;
let _selectedIdx = -1;
let _springCancel = null; // cancel in-flight spring

// ─── DOM refs (resolved at init time) ────────────────────────────────────────
let _overlay, _panel, _input, _results, _bar;

// ─── Search — delegates to fuzzy engine ──────────────────────────────────────
function _search(query) {
  if (!query || query.trim().length < 2) return [];
  // AnantaSearch.query returns sorted SearchResult[] from the pre-built index
  return AnantaSearch.query(query.trim(), { maxResults: 20 });
}

// ─── Render results ───────────────────────────────────────────────────────────
function _renderResults(items, query) {
  _results.innerHTML = "";
  _selectedIdx = -1;

  if (items.length === 0) {
    const empty = document.createElement("div");
    empty.className = "spotlight-empty";
    empty.textContent = `No results for "${escapeHtml(query)}"`;
    _results.appendChild(empty);
    return;
  }

  const frag = document.createDocumentFragment();
  items.forEach((item, idx) => {
    const a = document.createElement("a");
    a.className = "spotlight-result-item spring-gpu";
    a.href = item.url;
    a.setAttribute("role", "option");
    a.setAttribute("aria-selected", "false");
    a.rel = "noopener noreferrer";
    a.dataset.idx = idx;

    a.addEventListener("click", (e) => {
      e.preventDefault();
      _close();
      window.location.href = item.url;
    });

    // Favicon — use icons.js (DDG → Google → badge)
    const favWrap = document.createElement("div");
    favWrap.className = "sr-favicon-wrap";
    const img = document.createElement("img");
    img.className = "sr-favicon";
    img.alt = "";
    img.width = 16;
    img.height = 16;
    img.decoding = "async";
    const immediate = AnantaIcons.getIconSync(item.url, 32, (resolved) => {
      img.src = resolved;
    });
    img.src = immediate;
    img.onerror = () => img.replaceWith(_letterBadge(item.title || item.url));
    favWrap.appendChild(img);
    a.appendChild(favWrap);

    // Text
    const text = document.createElement("div");
    text.className = "sr-text";

    const titleEl = document.createElement("div");
    titleEl.className = "sr-title";
    setHighlight(titleEl, item.title || displayUrl(item.url), query);
    text.appendChild(titleEl);

    const urlEl = document.createElement("div");
    urlEl.className = "sr-url";
    urlEl.textContent = displayUrl(item.url);
    text.appendChild(urlEl);

    a.appendChild(text);

    // Type badge (bookmark / topsite / history)
    if (item.type && item.type !== "history") {
      const badge = document.createElement("div");
      badge.className = "sr-type";
      badge.textContent = item.type === "bookmark" ? "⊕" : "★";
      badge.title = item.type;
      a.appendChild(badge);
    }

    frag.appendChild(a);
  });
  _results.appendChild(frag);
}

function _letterBadge(label) {
  const el = document.createElement("div");
  el.className = "sr-letter";
  el.textContent = String(label).charAt(0).toUpperCase();
  return el;
}

// ─── Keyboard navigation ──────────────────────────────────────────────────────
function _navigate(dir) {
  const items = _results.querySelectorAll(".spotlight-result-item");
  if (!items.length) return;

  if (_selectedIdx >= 0 && _selectedIdx < items.length) {
    items[_selectedIdx].setAttribute("aria-selected", "false");
  }

  _selectedIdx = (_selectedIdx + dir + items.length) % items.length;
  const next = items[_selectedIdx];
  next.setAttribute("aria-selected", "true");
  next.scrollIntoView({ block: "nearest" });
}

function _activateSelected() {
  const items = _results.querySelectorAll(".spotlight-result-item");
  if (_selectedIdx >= 0 && _selectedIdx < items.length) {
    items[_selectedIdx].click();
  }
}

// ─── Open / close (spring physics) ──────────────────────────────────────────
function _open() {
  if (_isOpen) return;
  _isOpen = true;
  _overlay.setAttribute("aria-hidden", "false");
  _overlay.classList.add("is-open");

  // Spring enter: opacity 0→1, scale 0.94→1, translateY -8→0
  _panel.style.opacity = "0";
  _panel.style.transform = "translateZ(0) scale(0.94) translateY(-8px)";
  if (_springCancel) {
    _springCancel.cancel();
    _springCancel = null;
  }

  requestAnimationFrame(() => {
    const c1 = AnantaPhysics.springTo(_panel, { opacity: [0, 1] }, "spotlight");
    const c2 = AnantaPhysics.springTo(
      _panel,
      { scale: [0.94, 1], translateY: [-8, 0] },
      "spotlight",
    );
    _springCancel = {
      cancel() {
        c1.cancel();
        c2.cancel();
      },
    };
    _input.focus();
    _input.select();
  });
}

function _close() {
  if (!_isOpen) return;
  _isOpen = false;

  if (_springCancel) {
    _springCancel.cancel();
    _springCancel = null;
  }

  // Spring exit: scale 1→0.94, opacity 1→0
  const c1 = AnantaPhysics.springTo(
    _panel,
    { opacity: [1, 0] },
    { stiffness: 200, damping: 22 },
  );
  const c2 = AnantaPhysics.springTo(
    _panel,
    { scale: [1, 0.94], translateY: [0, -6] },
    { stiffness: 200, damping: 22 },
  );

  // After spring settles, truly hide overlay
  const after = AnantaPhysics.spring({
    from: 1,
    to: 0,
    stiffness: 200,
    damping: 22,
    onUpdate() {},
    onComplete() {
      _overlay.setAttribute("aria-hidden", "true");
      _overlay.classList.remove("is-open");
      _input.value = "";
      _results.innerHTML = "";
      _selectedIdx = -1;
    },
  });

  _springCancel = {
    cancel() {
      c1.cancel();
      c2.cancel();
      after.cancel();
    },
  };
}

// ─── Search handler (debounced) ───────────────────────────────────────────────
const _handleSearch = debounce(function () {
  const q = _input.value.trim();
  if (!q) {
    _results.innerHTML = "";
    return;
  }
  const found = _search(q);
  _renderResults(found, q);
}, 50);

// ─── Keyboard handler ─────────────────────────────────────────────────────────
function _onKeydown(e) {
  // Open shortcut
  if ((e.metaKey || e.ctrlKey) && e.key === "k") {
    e.preventDefault();
    if (_isOpen) _close();
    else _open();
    return;
  }

  if (!_isOpen) return;

  if (e.key === "Escape") {
    e.preventDefault();
    _close();
    return;
  }
  if (e.key === "ArrowDown") {
    e.preventDefault();
    _navigate(1);
    return;
  }
  if (e.key === "ArrowUp") {
    e.preventDefault();
    _navigate(-1);
    return;
  }
  if (e.key === "Enter") {
    e.preventDefault();
    _activateSelected();
    return;
  }
}

// ─── Public init ────────────────────────────────────────────────────────────
async function initSpotlight() {
  _overlay = document.getElementById("spotlightOverlay");
  _panel = document.getElementById("spotlightPanel");
  _input = document.getElementById("spotlightInput");
  _results = document.getElementById("spotlightResults");
  _bar = document.getElementById("spotlightBar");

  if (!_overlay || !_input) return;

  // Wire input
  _input.addEventListener("input", _handleSearch);

  // Wire trigger bar
  if (_bar) {
    _bar.addEventListener("click", _open);
    _bar.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        _open();
      }
    });
  }

  // Wire backdrop click
  const backdrop = document.getElementById("spotlightBackdrop");
  if (backdrop) backdrop.addEventListener("click", _close);

  // Global keyboard
  document.addEventListener("keydown", _onKeydown);

  // Search index is built by main.js after all data is loaded
}
