/* ══════════════════════════════════════════════════════════════════════════
   worldClockModal.js — "Add City" modal (search-based, no manual fields)
   Depends on:
     worldClocks.js  → wcAddCity()
     citySearch.js   → initCitySearch()
   Flow:
     1. User clicks Add → wcShowModal()
     2. User types     → Nominatim autocomplete (citySearch.js, debounced 300ms)
     3. User picks       → tzlookup(lat, lon) — offline, instant (citySearch.js)
     4. wcAddCity()    → save to localStorage + re-render cards instantly
     5. Modal closes automatically on success
   Ananta New Tab · macOS HIG quality
══════════════════════════════════════════════════════════════════════════ */

"use strict";

// ─── City search widget instance (returned by initCitySearch) ─────────────────
let _wcSearchWidget = null;

/* ─────────────────────────────────────────────────────────────────────────
   SAFE DOM BUILDER HELPERS — no innerHTML, no eval
───────────────────────────────────────────────────────────────────────── */

/**
 * Create an HTML element with optional attributes.
 * Handles className and textContent as special cases.
 */
function _wcEl(tag, props) {
  const el = document.createElement(tag);
  if (!props) return el;
  for (const [k, v] of Object.entries(props)) {
    if (k === "className") {
      el.className = v;
    } else if (k === "textContent") {
      el.textContent = v;
    } else {
      el.setAttribute(k, v);
    }
  }
  return el;
}

/**
 * Create an SVG element with child shape elements.
 * @param {Object} attrs     – Attributes for the <svg> element
 * @param {Array}  children  – [{ tag, attrs }] child elements
 */
function _wcSvg(attrs, children) {
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  for (const [k, v] of Object.entries(attrs)) svg.setAttribute(k, v);
  (children || []).forEach(({ tag, attrs: ca }) => {
    const child = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(ca)) child.setAttribute(k, v);
    svg.appendChild(child);
  });
  return svg;
}

/* ─────────────────────────────────────────────────────────────────────────
   BUILD MODAL  (idempotent — only runs once per page lifetime)
───────────────────────────────────────────────────────────────────────── */

function _wcBuildModal() {
  if (document.getElementById("wcModal")) return;

  // ── Outer shell ──────────────────────────────────────────────────────────
  const modal = _wcEl("div", {
    id: "wcModal",
    className: "wc-modal",
    "aria-hidden": "true",
    role: "dialog",
    "aria-modal": "true",
    "aria-labelledby": "wcModalTitle",
  });

  // ── Backdrop (click → close) ──────────────────────────────────────────────
  const backdrop = _wcEl("div", {
    id: "wcModalBackdrop",
    className: "wc-modal-backdrop",
  });

  // ── Panel ─────────────────────────────────────────────────────────────────
  const panel = _wcEl("div", {
    className: "wc-modal-panel",
    role: "document",
  });

  // ── Header: title + close button ─────────────────────────────────────────
  const header = _wcEl("div", { className: "wc-modal-header" });

  const title = _wcEl("h3", {
    className: "wc-modal-title",
    id: "wcModalTitle",
    textContent: "Add City",
  });

  const closeBtn = _wcEl("button", {
    className: "wc-modal-close-btn",
    id: "wcModalCloseBtn",
    type: "button",
    "aria-label": "Close dialog",
  });
  closeBtn.appendChild(
    _wcSvg(
      {
        viewBox: "0 0 20 20",
        fill: "none",
        stroke: "currentColor",
        "stroke-width": "1.8",
        "stroke-linecap": "round",
        "aria-hidden": "true",
      },
      [
        { tag: "line", attrs: { x1: "5", y1: "5", x2: "15", y2: "15" } },
        { tag: "line", attrs: { x1: "15", y1: "5", x2: "5", y2: "15" } },
      ],
    ),
  );

  header.appendChild(title);
  header.appendChild(closeBtn);

  // ── Hint text ─────────────────────────────────────────────────────────────
  const hint = _wcEl("p", {
    className: "cs-hint",
    textContent: "Type a city name to search worldwide.",
  });

  // ── City search section ───────────────────────────────────────────────────
  const searchSection = _wcEl("div", { className: "cs-search-section" });

  // Input wrapper — holds icon, input, spinner in the same line
  const searchWrap = _wcEl("div", { className: "cs-search-wrap" });

  // Magnifier icon (decorative)
  const searchIcon = _wcSvg(
    { viewBox: "0 0 20 20", fill: "currentColor", "aria-hidden": "true" },
    [
      {
        tag: "path",
        attrs: {
          "fill-rule": "evenodd",
          d: "M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z",
          "clip-rule": "evenodd",
        },
      },
    ],
  );
  searchIcon.className.baseVal = "cs-search-icon";

  // Search text input (ARIA combobox)
  const searchInput = _wcEl("input", {
    id: "wcCitySearchInput",
    className: "cs-search-input",
    type: "text",
    placeholder: "Search city, e.g. Tokyo…",
    autocomplete: "off",
    spellcheck: "false",
    role: "combobox",
    "aria-autocomplete": "list",
    "aria-expanded": "false",
    "aria-haspopup": "listbox",
    "aria-controls": "wcCityDropdown",
    "aria-owns": "wcCityDropdown",
  });

  // CSS-animated spinner (opacity toggled by .cs-loading class on input)
  const spinner = _wcEl("span", {
    className: "cs-spinner",
    "aria-hidden": "true",
  });

  searchWrap.appendChild(searchIcon);
  searchWrap.appendChild(searchInput);
  searchWrap.appendChild(spinner);

  // Suggestion dropdown
  const dropdown = _wcEl("ul", {
    id: "wcCityDropdown",
    className: "cs-dropdown",
    role: "listbox",
    "aria-label": "City suggestions",
  });
  dropdown.hidden = true;

  // Aria-live status paragraph (no results, errors, "detecting timezone…")
  const status = _wcEl("p", {
    id: "wcCityStatus",
    className: "cs-status",
    "aria-live": "polite",
  });
  status.hidden = true;

  searchSection.appendChild(searchWrap);
  searchSection.appendChild(dropdown);
  searchSection.appendChild(status);

  // ── Footer: Cancel button ─────────────────────────────────────────────────
  const actions = _wcEl("div", { className: "wc-modal-actions" });

  const cancelBtn = _wcEl("button", {
    type: "button",
    className: "wc-btn wc-btn-ghost",
    id: "wcModalCancelBtn",
    textContent: "Cancel",
  });
  actions.appendChild(cancelBtn);

  // ── Assemble ──────────────────────────────────────────────────────────────
  panel.appendChild(header);
  panel.appendChild(hint);
  panel.appendChild(searchSection);
  panel.appendChild(actions);

  modal.appendChild(backdrop);
  modal.appendChild(panel);
  document.body.appendChild(modal);

  // ── Wire close events ─────────────────────────────────────────────────────
  backdrop.addEventListener("click", wcHideModal);
  closeBtn.addEventListener("click", wcHideModal);
  cancelBtn.addEventListener("click", wcHideModal);

  // Keyboard: Escape = close; Tab = trapped inside modal
  modal.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      wcHideModal();
      return;
    }

    if (e.key === "Tab") {
      const focusables = Array.from(
        modal.querySelectorAll(
          'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hidden && el.offsetParent !== null);

      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });

  // ── Init city search widget ───────────────────────────────────────────────
  _wcSearchWidget = initCitySearch(
    searchInput,
    dropdown,
    status,
    _wcOnCitySelected,
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   CITY SELECTED CALLBACK
───────────────────────────────────────────────────────────────────────── */

/**
 * Invoked by initCitySearch when the user picks a suggestion and
 * timezone resolution succeeds.
 * @param {{ city: string, state: string, country: string, timezone: string }} result
 */
function _wcOnCitySelected({ city, state, country, timezone }) {
  // wcAddCity (worldClocks.js) accepts {name, state, country, timezone}
  const ok = wcAddCity({ name: city, state, country, timezone });

  if (!ok) {
    // Duplicate — show inline message, keep modal open for retry
    const statusEl = document.getElementById("wcCityStatus");
    if (statusEl) {
      statusEl.textContent = `"${city}" already exists in this timezone group.`;
      statusEl.className = "cs-status cs-status-error";
      statusEl.hidden = false;
    }
    const input = document.getElementById("wcCitySearchInput");
    if (input) input.focus();
    return;
  }

  // wcAddCity already called wcSave() + wcRender() — just close the modal
  wcHideModal();
}

/* ─────────────────────────────────────────────────────────────────────────
   SHOW / HIDE (public API called by worldClocks.js)
───────────────────────────────────────────────────────────────────────── */

function wcShowModal() {
  _wcBuildModal(); // no-op if already built

  const modal = document.getElementById("wcModal");
  if (!modal) return;

  // Reset the search widget (clears input, dropdown, status, spinner)
  if (_wcSearchWidget) _wcSearchWidget.clear();

  modal.setAttribute("aria-hidden", "false");
  modal.classList.add("is-open");
  document.body.classList.add("wc-modal-open");

  // Auto-focus search input after open animation begins
  setTimeout(() => {
    const input = document.getElementById("wcCitySearchInput");
    if (input) input.focus();
  }, 80);
}

function wcHideModal() {
  const modal = document.getElementById("wcModal");
  if (!modal) return;
  modal.classList.remove("is-open");
  modal.classList.add("is-closing");
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("wc-modal-open");

  setTimeout(() => {
    modal.classList.remove("is-closing");
    // Return focus to Add button
    const addBtn = document.getElementById("wcAddBtn");
    if (addBtn) addBtn.focus();
  }, 240);
}
