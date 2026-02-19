/* ══════════════════════════════════════════════════════════════════════════
   citySearch.js — Smart city search (Nominatim) + offline timezone lookup
   Provides:
     initCitySearch(inputEl, dropdownEl, statusEl, onSelect) → { clear(), destroy() }
   Features:
     • 300 ms debounce on typing
     • In-memory query cache (avoids duplicate API calls for same search)
     • Keyboard navigation (↑ ↓ Enter Escape)
     • Loading spinner during Nominatim fetch
     • "No results" / error messages
     • ARIA combobox pattern (accessible)
     • Timezone resolved INSTANTLY via tzlookup(lat,lon) — fully offline,
       zero API calls, zero latency
   Depends on:
     tzlookup.js  — must be loaded before this file (exposes global tzlookup)
   Ananta New Tab · macOS HIG quality
══════════════════════════════════════════════════════════════════════════ */

"use strict";

// ─── In-memory query cache (lives for the lifetime of the page) ───────────────
const _csCache = new Map();

/* ─────────────────────────────────────────────────────────────────────────────
   NOMINATIM — City suggestions
───────────────────────────────────────────────────────────────────────────── */

/**
 * Fetch up to 8 city suggestions from Nominatim OpenStreetMap.
 * Results are cached by normalised query string.
 *
 * @param {string} query  Raw search string from the user.
 * @returns {Promise<Array<{city,state,country,lat,lon}>>}
 */
async function csFetchSuggestions(query) {
  const key = query.toLowerCase().trim();

  // Return cached result immediately
  if (_csCache.has(key)) return _csCache.get(key);

  const url =
    "https://nominatim.openstreetmap.org/search?" +
    new URLSearchParams({
      q: query,
      format: "json",
      addressdetails: "1",
      limit: "10", // fetch extra so dedup still gives 8
      "accept-language": "en",
    });

  const res = await fetch(url, {
    headers: { "Accept-Language": "en-US,en;q=0.9" },
  });

  if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);

  const raw = await res.json();

  // Normalise each result into a flat {city,state,country,lat,lon} shape
  const seen = new Set();
  const results = [];

  for (const item of raw) {
    if (!item.address) continue;

    const addr = item.address;

    // Prefer the most specific place name for the city label
    const city =
      addr.city ||
      addr.town ||
      addr.village ||
      addr.municipality ||
      addr.suburb ||
      addr.county ||
      (item.display_name || "").split(",")[0].trim();

    const state =
      addr.state || addr.region || addr.state_district || addr.county || "";

    const country = addr.country || "";

    if (!city || !country) continue;

    // Deduplicate by city+country (case-insensitive) so the same place
    // doesn't appear twice under different OSM node types
    const dedupKey = `${city.toLowerCase()}|${country.toLowerCase()}`;
    if (seen.has(dedupKey)) continue;
    seen.add(dedupKey);

    results.push({
      city,
      state,
      country,
      lat: parseFloat(item.lat),
      lon: parseFloat(item.lon),
    });

    if (results.length === 8) break;
  }

  _csCache.set(key, results);
  return results;
}

/* ─────────────────────────────────────────────────────────────────────────────
   OFFLINE TIMEZONE RESOLVER
   Uses tzlookup.js (loaded globally before this script).
   Lookup is synchronous, < 1 ms, zero network calls, zero failures.
───────────────────────────────────────────────────────────────────────────── */

/**
 * Resolve an IANA timezone ID from geographic coordinates.
 * Wraps the global tzlookup() exposed by tzlookup.js (tz-lookup v6).
 *
 * @param {number} lat  Latitude  (−90 … +90)
 * @param {number} lon  Longitude (−180 … +180)
 * @returns {string}    IANA timezone ID, e.g. "Asia/Kolkata"
 * @throws  {RangeError}  Only if coordinates are completely out of range
 */
function csResolveTimezone(lat, lon) {
  /* tzlookup performs a packed binary-tree spatial lookup over every IANA
   * timezone polygon. ~70 KB dataset bundled in tzlookup.js — no network. */
  return tzlookup(lat, lon); // eslint-disable-line no-undef
}

/* ─────────────────────────────────────────────────────────────────────────────
   WIDGET — initCitySearch
───────────────────────────────────────────────────────────────────────────── */

/**
 * Attach smart city-search behaviour to an (input, dropdown, status) trio.
 *
 * @param {HTMLInputElement}  inputEl    – Search text input
 * @param {HTMLUListElement}  dropdownEl – <ul role="listbox"> container
 * @param {HTMLElement}       statusEl   – Aria-live paragraph for messages
 * @param {function}          onSelect   – Called with {city,state,country,timezone}
 * @returns {{ clear: function, destroy: function }}  Public API
 */
function initCitySearch(inputEl, dropdownEl, statusEl, onSelect) {
  let _debounceTimer = null;
  let _suggestions = []; // current rendered items
  let _activeIdx = -1; // keyboard-selected index
  let _destroyed = false;

  // ── Status helpers ────────────────────────────────────────────────────────

  function _showStatus(msg, isError) {
    if (!statusEl) return;
    statusEl.textContent = msg;
    statusEl.className = "cs-status" + (isError ? " cs-status-error" : "");
    statusEl.hidden = !msg;
  }

  // ── Loading state ─────────────────────────────────────────────────────────

  /** Toggle the CSS spinner on the input and clear the dropdown. */
  function _setLoading(on) {
    inputEl.classList.toggle("cs-loading", on);
  }

  // ── Dropdown rendering ────────────────────────────────────────────────────

  /**
   * Re-render the suggestion dropdown with a new array of items.
   * Uses DOM construction (no innerHTML) for XSS safety.
   */
  function _renderDropdown(items) {
    _suggestions = items;
    _activeIdx = -1;

    // Clear existing children safely
    while (dropdownEl.firstChild) {
      dropdownEl.removeChild(dropdownEl.firstChild);
    }

    if (!items.length) {
      dropdownEl.hidden = true;
      inputEl.setAttribute("aria-expanded", "false");
      return;
    }

    items.forEach((item, idx) => {
      const li = document.createElement("li");
      li.className = "cs-suggestion-item";
      li.role = "option";
      li.id = `cs-item-${idx}`;
      li.setAttribute("aria-selected", "false");
      li.dataset.idx = idx;
      li.tabIndex = -1;

      const nameEl = document.createElement("span");
      nameEl.className = "cs-city-name";
      nameEl.textContent = item.city;

      const subEl = document.createElement("span");
      subEl.className = "cs-city-sub";
      subEl.textContent = [item.state, item.country].filter(Boolean).join(", ");

      li.appendChild(nameEl);
      li.appendChild(subEl);

      // Mouse: prevent blur on input before click can fire
      li.addEventListener("mousedown", (e) => {
        e.preventDefault();
        _selectItem(idx);
      });

      li.addEventListener("mouseover", () => _highlight(idx));

      dropdownEl.appendChild(li);
    });

    dropdownEl.hidden = false;
    inputEl.setAttribute("aria-expanded", "true");
  }

  /** Highlight (keyboard) the item at idx. */
  function _highlight(idx) {
    const items = dropdownEl.querySelectorAll(".cs-suggestion-item");
    _activeIdx = Math.max(0, Math.min(idx, items.length - 1));

    items.forEach((el, i) => {
      const active = i === _activeIdx;
      el.classList.toggle("cs-active", active);
      el.setAttribute("aria-selected", active ? "true" : "false");
    });

    if (items[_activeIdx]) {
      inputEl.setAttribute("aria-activedescendant", items[_activeIdx].id);
    }
  }

  /** Close and empty the dropdown. */
  function _closeDropdown() {
    while (dropdownEl.firstChild) {
      dropdownEl.removeChild(dropdownEl.firstChild);
    }
    dropdownEl.hidden = true;
    _suggestions = [];
    _activeIdx = -1;
    inputEl.setAttribute("aria-expanded", "false");
    inputEl.removeAttribute("aria-activedescendant");
  }

  // ── Selection ─────────────────────────────────────────────────────────────

  /**
   * Handle the user picking the item at idx.
   * Timezone is resolved INSTANTLY via tzlookup() — no network call needed.
   *
   * @param {number} idx  Index into _suggestions array.
   */
  function _selectItem(idx) {
    const item = _suggestions[idx];
    if (!item) return;

    // Echo city name into input so user sees what they selected
    inputEl.value = item.city;
    _closeDropdown();

    // ── Offline timezone resolution (synchronous, < 1ms) ──────────────────
    let timezone;
    try {
      timezone = csResolveTimezone(item.lat, item.lon);
    } catch {
      // RangeError from tzlookup — coordinate from Nominatim was invalid
      _showStatus("Could not determine timezone for this location.", true);
      return;
    }

    _showStatus("");

    onSelect({
      city: item.city,
      state: item.state,
      country: item.country,
      timezone,
    });
  }

  // ── Search fetch ──────────────────────────────────────────────────────────

  async function _doSearch(query) {
    if (_destroyed) return;

    if (!query || query.length < 2) {
      _closeDropdown();
      _showStatus("");
      return;
    }

    _setLoading(true);

    try {
      const results = await csFetchSuggestions(query);
      if (_destroyed) return;

      _setLoading(false);

      if (!results.length) {
        _closeDropdown();
        _showStatus("No cities found. Try a different spelling.");
        return;
      }

      _showStatus("");
      _renderDropdown(results);
    } catch {
      if (_destroyed) return;
      _setLoading(false);
      _closeDropdown();
      _showStatus("Search failed. Check your internet connection.", true);
    }
  }

  // ── Event listeners ───────────────────────────────────────────────────────

  function _onInput(e) {
    clearTimeout(_debounceTimer);
    const q = e.target.value.trim();
    _debounceTimer = setTimeout(() => _doSearch(q), 300);
  }

  function _onKeydown(e) {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (!_suggestions.length) return;
        _highlight(
          _activeIdx < 0
            ? 0
            : Math.min(_activeIdx + 1, _suggestions.length - 1),
        );
        break;

      case "ArrowUp":
        e.preventDefault();
        if (!_suggestions.length) return;
        _highlight(Math.max(_activeIdx - 1, 0));
        break;

      case "Enter":
        e.preventDefault();
        if (_activeIdx >= 0) {
          _selectItem(_activeIdx);
        } else if (_suggestions.length === 1) {
          _selectItem(0);
        }
        break;

      case "Escape":
        _closeDropdown();
        break;
    }
  }

  /** Close dropdown when user clicks elsewhere on the page. */
  function _onDocMousedown(e) {
    if (!dropdownEl.contains(e.target) && e.target !== inputEl) {
      _closeDropdown();
    }
  }

  inputEl.addEventListener("input", _onInput);
  inputEl.addEventListener("keydown", _onKeydown);
  document.addEventListener("mousedown", _onDocMousedown);

  // ── Public API ────────────────────────────────────────────────────────────

  return {
    /** Reset input + dropdown + status to initial blank state. */
    clear() {
      clearTimeout(_debounceTimer);
      inputEl.value = "";
      _closeDropdown();
      _showStatus("");
      _setLoading(false);
    },

    /** Remove all listeners (call when the modal is destroyed). */
    destroy() {
      _destroyed = true;
      clearTimeout(_debounceTimer);
      inputEl.removeEventListener("input", _onInput);
      inputEl.removeEventListener("keydown", _onKeydown);
      document.removeEventListener("mousedown", _onDocMousedown);
    },
  };
}
