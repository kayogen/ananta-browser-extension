/* ══════════════════════════════════════════════════════════════════════════
   worldClocks.js — Storage, rendering, edit-mode, add/remove city logic
   Depends on: worldClockTime.js (must be loaded before this)
══════════════════════════════════════════════════════════════════════════ */

"use strict";

// ─── Constants ───────────────────────────────────────────────────────────────
const WC_STORAGE_KEY = "worldClocks";

const WC_DEFAULTS = [
  {
    id: "UTC",
    timezone: "UTC",
    cities: [{ name: "London", state: "", country: "UK" }],
  },
  {
    id: "America/New_York",
    timezone: "America/New_York",
    cities: [{ name: "New York", state: "NY", country: "USA" }],
  },
  {
    id: "America/Chicago",
    timezone: "America/Chicago",
    cities: [{ name: "Des Plaines", state: "IL", country: "USA" }],
  },
  {
    id: "America/Denver",
    timezone: "America/Denver",
    cities: [{ name: "Denver", state: "CO", country: "USA" }],
  },
  {
    id: "Asia/Kolkata",
    timezone: "Asia/Kolkata",
    cities: [{ name: "Kolkata", state: "", country: "India" }],
  },
];

// ─── Module state ─────────────────────────────────────────────────────────────
let _wcData = [];
let _wcEditMode = false;
let _wcTickId = null;
let _wcLastSec = -1;

// ─── Storage ──────────────────────────────────────────────────────────────────
function wcLoad() {
  try {
    const raw = localStorage.getItem(WC_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        _wcData = parsed;
        return;
      }
    }
  } catch {
    /* fall through to defaults */
  }
  _wcData = JSON.parse(JSON.stringify(WC_DEFAULTS));
  wcSave();
}

function wcSave() {
  try {
    localStorage.setItem(WC_STORAGE_KEY, JSON.stringify(_wcData));
  } catch {
    /* storage full or private mode */
  }
}

// ─── Data mutations ───────────────────────────────────────────────────────────
/**
 * Add a city. Groups into existing timezone or creates new group.
 * Returns true on success, false if duplicate.
 */
function wcAddCity({ name, state, country, timezone }) {
  name = name.trim();
  state = (state || "").trim();
  country = (country || "").trim();
  if (!name || !timezone) return false;

  const existing = _wcData.find((g) => g.timezone === timezone);
  if (existing) {
    if (
      existing.cities.some((c) => c.name.toLowerCase() === name.toLowerCase())
    ) {
      return false; // duplicate
    }
    existing.cities.push({ name, state, country });
  } else {
    _wcData.push({
      id: timezone,
      timezone,
      cities: [{ name, state, country }],
    });
  }
  wcSave();
  wcRender();
  return true;
}

/**
 * Remove a single city from a timezone group.
 * If the group becomes empty, remove the entire group.
 */
function wcRemoveCity(timezone, cityName) {
  const group = _wcData.find((g) => g.timezone === timezone);
  if (!group) return;
  group.cities = group.cities.filter((c) => c.name !== cityName);
  if (group.cities.length === 0) {
    _wcData = _wcData.filter((g) => g.timezone !== timezone);
  }
  wcSave();
  wcRender();
}

// ─── SVG helpers ─────────────────────────────────────────────────────────────
const _SVG_MINUS = `<svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <circle cx="8" cy="8" r="7.5" fill="#FF3B30"/>
  <rect x="4" y="7.25" width="8" height="1.5" rx="0.75" fill="white"/>
</svg>`;

const _SVG_GEAR = `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <circle cx="10" cy="10" r="3"/>
  <path d="M10 2.5A1.5 1.5 0 0 1 11.5 1h0A1.5 1.5 0 0 1 13 2.5v.34a7.5 7.5 0 0 1 1.33.77l.3-.17a1.5 1.5 0 0 1 2.05.55h0a1.5 1.5 0 0 1-.55 2.05l-.29.17a7.6 7.6 0 0 1 0 1.54l.29.17a1.5 1.5 0 0 1 .55 2.05h0a1.5 1.5 0 0 1-2.05.55l-.3-.17A7.5 7.5 0 0 1 13 11.16v.34A1.5 1.5 0 0 1 11.5 13h0A1.5 1.5 0 0 1 10 11.5v-.17a7.5 7.5 0 0 1-1.33-.77l-.3.17a1.5 1.5 0 0 1-2.05-.55h0a1.5 1.5 0 0 1 .55-2.05l.29-.17a7.6 7.6 0 0 1 0-1.54l-.29-.17a1.5 1.5 0 0 1-.55-2.05h0a1.5 1.5 0 0 1 2.05-.55l.3.17A7.5 7.5 0 0 1 10 2.83V2.5z"/>
</svg>`;

const _SVG_CLOSE = `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
  <line x1="5" y1="5" x2="15" y2="15"/>
  <line x1="15" y1="5" x2="5" y2="15"/>
</svg>`;

const _SVG_PLUS = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
  <line x1="8" y1="3" x2="8" y2="13"/>
  <line x1="3" y1="8" x2="13" y2="8"/>
</svg>`;

// ─── Card builder ─────────────────────────────────────────────────────────────
function _wcBuildCard(group) {
  const { timezone, cities } = group;
  const isNight = wcIsNight(timezone);

  const card = document.createElement("div");
  card.className = "world-clock" + (isNight ? " is-night" : "");
  if (_wcEditMode) card.classList.add("is-edit");
  card.dataset.tz = timezone;
  card.setAttribute("role", "listitem");

  // ── HEADER ──────────────────────────────────────────────────────────────
  const header = document.createElement("div");
  header.className = "wc-header";

  // Single-city card: minus overlays at card top-left
  if (_wcEditMode && cities.length === 1) {
    const minus = document.createElement("button");
    minus.className = "wc-minus wc-minus-single";
    minus.setAttribute("aria-label", `Remove ${cities[0].name}`);
    minus.title = `Remove ${cities[0].name}`;
    minus.innerHTML = _SVG_MINUS;
    minus.addEventListener("click", (e) => {
      e.stopPropagation();
      wcRemoveCity(timezone, cities[0].name);
    });
    card.appendChild(minus); // append to card (not header) so it overlays
  }

  // Cities inline list
  const citiesEl = document.createElement("div");
  citiesEl.className = "wc-cities";

  cities.forEach((city, i) => {
    if (i > 0) {
      const sep = document.createElement("span");
      sep.className = "wc-city-sep";
      sep.setAttribute("aria-hidden", "true");
      citiesEl.appendChild(sep);
    }

    const item = document.createElement("div");
    item.className = "wc-city-item";

    // Per-city minus for multi-city groups
    if (_wcEditMode && cities.length > 1) {
      const minus = document.createElement("button");
      minus.className = "wc-minus wc-minus-inline";
      minus.setAttribute("aria-label", `Remove ${city.name}`);
      minus.title = `Remove ${city.name}`;
      minus.innerHTML = _SVG_MINUS;
      minus.addEventListener("click", (e) => {
        e.stopPropagation();
        wcRemoveCity(timezone, city.name);
      });
      item.appendChild(minus);
    }

    const nameEl = document.createElement("span");
    nameEl.className = "wc-city-name";
    nameEl.textContent = city.name;
    item.appendChild(nameEl);

    const sub = document.createElement("span");
    sub.className = "wc-city-sub";
    sub.textContent = [city.state, city.country].filter(Boolean).join(", ");
    item.appendChild(sub);

    citiesEl.appendChild(item);
  });

  header.appendChild(citiesEl);
  card.appendChild(header);

  // ── BODY (time + dayphase) ───────────────────────────────────────────────
  const body = document.createElement("div");
  body.className = "wc-body";

  const timeEl = document.createElement("span");
  timeEl.className = "wc-time";
  timeEl.setAttribute("aria-live", "polite");
  body.appendChild(timeEl);

  const phaseEl = document.createElement("span");
  phaseEl.className = "wc-dayphase";
  body.appendChild(phaseEl);

  card.appendChild(body);

  // ── FOOTER (date | utc-offset) ───────────────────────────────────────────
  const footer = document.createElement("div");
  footer.className = "wc-footer";

  const dateEl = document.createElement("span");
  dateEl.className = "wc-date";
  dateEl.setAttribute("aria-live", "polite");
  footer.appendChild(dateEl);

  const offsetEl = document.createElement("span");
  offsetEl.className = "wc-utc-offset";
  offsetEl.setAttribute("aria-live", "polite");
  footer.appendChild(offsetEl);

  card.appendChild(footer);

  return card;
}

// ─── Full render ──────────────────────────────────────────────────────────────
function wcRender() {
  const container = document.getElementById("worldClocks");
  if (!container) return;

  // Fade out, swap, fade in
  container.style.opacity = "0";
  requestAnimationFrame(() => {
    container.innerHTML = "";
    _wcData.forEach((group) => {
      container.appendChild(_wcBuildCard(group));
    });

    // Immediately fill time values
    _wcLastSec = -1;
    _wcUpdateCards();

    requestAnimationFrame(() => {
      container.style.opacity = "";
    });
  });
}

// ─── Efficient card update (called every second) ──────────────────────────────
function _wcUpdateCards() {
  const use24h = localStorage.getItem("ananta-fmt-24h") === "1";
  document
    .querySelectorAll("#worldClocks .world-clock[data-tz]")
    .forEach((card) => {
      const tz = card.dataset.tz;

      const timeEl = card.querySelector(".wc-time");
      if (timeEl) {
        const t = wcTime(tz, use24h);
        if (timeEl.textContent !== t) timeEl.textContent = t;
      }

      const dateEl = card.querySelector(".wc-date");
      if (dateEl) {
        const d = wcDate(tz);
        if (dateEl.textContent !== d) dateEl.textContent = d;
      }

      const offsetEl = card.querySelector(".wc-utc-offset");
      if (offsetEl) {
        const o = wcUtcOffset(tz);
        if (offsetEl.textContent !== o) offsetEl.textContent = o;
      }

      const phaseEl = card.querySelector(".wc-dayphase");
      if (phaseEl) {
        const phase = wcDayPhase(tz);
        const label = phase.label;
        if (phaseEl.textContent !== label) phaseEl.textContent = label;
        card.classList.toggle("is-night", phase.label === "Night");
      }
    });
}

// ─── Tick (single shared interval) ───────────────────────────────────────────
function _wcTick() {
  const sec = new Date().getSeconds();
  if (sec !== _wcLastSec) {
    _wcLastSec = sec;
    _wcUpdateCards();
  }
}

// ─── Edit mode controls ───────────────────────────────────────────────────────
function _wcUpdateControlsUI() {
  const controls = document.getElementById("wcControls");
  const gearBtn = document.getElementById("wcGearBtn");
  const addBtn = document.getElementById("wcAddBtn");
  if (!controls) return;

  controls.classList.toggle("is-edit", _wcEditMode);
  if (gearBtn) {
    gearBtn.innerHTML = _wcEditMode ? _SVG_CLOSE : _SVG_GEAR;
    gearBtn.setAttribute(
      "aria-label",
      _wcEditMode ? "Exit edit mode" : "Edit world clocks",
    );
    gearBtn.title = _wcEditMode ? "Done" : "Edit";
  }
  if (addBtn) {
    addBtn.setAttribute("aria-hidden", _wcEditMode ? "false" : "true");
    addBtn.setAttribute("tabindex", _wcEditMode ? "0" : "-1");
  }
}

function _initWcControls() {
  const gearBtn = document.getElementById("wcGearBtn");
  const addBtn = document.getElementById("wcAddBtn");

  if (gearBtn) {
    gearBtn.innerHTML = _SVG_GEAR;
    gearBtn.setAttribute("aria-label", "Edit world clocks");
    gearBtn.addEventListener("click", () => {
      _wcEditMode = !_wcEditMode;
      _wcUpdateControlsUI();
      wcRender();
    });
  }

  if (addBtn) {
    addBtn.setAttribute("aria-hidden", "true");
    addBtn.setAttribute("tabindex", "-1");
    addBtn.innerHTML = _SVG_PLUS + "<span>Add City</span>";
    addBtn.addEventListener("click", () => {
      if (typeof wcShowModal === "function") wcShowModal();
    });
  }
}

// ─── Public init ─────────────────────────────────────────────────────────────
function initWorldClocks() {
  wcLoad();
  _initWcControls();
  wcRender();

  // Single shared timer — fires every 500ms, updates DOM only on second boundary
  if (_wcTickId) clearInterval(_wcTickId);
  _wcTickId = setInterval(_wcTick, 500);
}
