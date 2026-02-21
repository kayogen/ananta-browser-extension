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

const _SVG_GEAR = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="14" height="14" fill="currentColor" aria-hidden="true">
  <path fill-rule="evenodd" d="M8.34 1.804A1 1 0 019.32 1h1.36a1 1 0 01.98.804l.295 1.473c.497.144.971.342 1.416.587l1.25-.834a1 1 0 011.262.125l.962.962a1 1 0 01.125 1.262l-.834 1.25c.245.445.443.919.587 1.416l1.473.294a1 1 0 01.804.98v1.361a1 1 0 01-.804.98l-1.473.295a6.95 6.95 0 01-.587 1.416l.834 1.25a1 1 0 01-.125 1.262l-.962.962a1 1 0 01-1.262.125l-1.25-.834a6.953 6.953 0 01-1.416.587l-.294 1.473a1 1 0 01-.98.804H9.32a1 1 0 01-.98-.804l-.295-1.473a6.957 6.957 0 01-1.416-.587l-1.25.834a1 1 0 01-1.262-.125l-.962-.962a1 1 0 01-.125-1.262l.834-1.25a6.957 6.957 0 01-.587-1.416l-1.473-.294A1 1 0 011 10.68V9.32a1 1 0 01.804-.98l1.473-.295c.144-.497.342-.971.587-1.416l-.834-1.25a1 1 0 01.125-1.262l.962-.962A1 1 0 014.38 3.03l1.25.834a6.957 6.957 0 011.416-.587l.294-1.473zM13 10a3 3 0 11-6 0 3 3 0 016 0z" clip-rule="evenodd"/>
</svg>`;

const _SVG_CLOSE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="14" height="14" fill="currentColor" aria-hidden="true">
  <path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clip-rule="evenodd"/>
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
  card.className = "world-clock clock-card" + (isNight ? " is-night" : "");
  if (_wcEditMode) card.classList.add("is-edit");
  card.dataset.tz = timezone;
  card.setAttribute("role", "listitem");

  // Single-city card: minus overlays at card top-right
  if (_wcEditMode && cities.length === 1) {
    const minus = document.createElement("button");
    minus.className = "wc-minus wc-minus-single";
    minus.setAttribute("aria-label", `Remove ${cities[0].name}`);
    minus.title = `Remove ${cities[0].name}`;
    setSvg(minus, _SVG_MINUS);
    minus.addEventListener("click", (e) => {
      e.stopPropagation();
      wcRemoveCity(timezone, cities[0].name);
    });
    card.appendChild(minus);
  }

  // ── SECTION 1 (TOP): cities list, horizontal scroll ───────────────────────
  const sectionTop = document.createElement("div");
  sectionTop.className = "clock-section-top";

  const citiesScrollContainer = document.createElement("div");
  citiesScrollContainer.className = "cities-scroll-container";

  const citiesScroll = document.createElement("div");
  citiesScroll.className = "cities-scroll";

  cities.forEach((city, i) => {
    if (i > 0) {
      const sep = document.createElement("span");
      sep.className = "wc-city-sep";
      sep.setAttribute("aria-hidden", "true");
      citiesScroll.appendChild(sep);
    }

    const item = document.createElement("div");
    item.className = "city-item wc-city-item";

    if (_wcEditMode && cities.length > 1) {
      const minus = document.createElement("button");
      minus.className = "wc-minus wc-minus-inline";
      minus.setAttribute("aria-label", `Remove ${city.name}`);
      minus.title = `Remove ${city.name}`;
      setSvg(minus, _SVG_MINUS);
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

    citiesScroll.appendChild(item);
  });

  citiesScrollContainer.appendChild(citiesScroll);
  sectionTop.appendChild(citiesScrollContainer);
  card.appendChild(sectionTop);

  // ── SECTION 2 (MIDDLE): time only ─────────────────────────────────────────
  const sectionMiddle = document.createElement("div");
  sectionMiddle.className = "clock-section-middle";

  const timeEl = document.createElement("span");
  timeEl.className = "time wc-time";
  timeEl.setAttribute("aria-live", "polite");
  sectionMiddle.appendChild(timeEl);

  card.appendChild(sectionMiddle);

  // ── SECTION 3 (BOTTOM): day/date left, UTC right (space-between) ───────────
  const sectionBottom = document.createElement("div");
  sectionBottom.className = "clock-section-bottom";

  const footerLeft = document.createElement("div");
  footerLeft.className = "clock-footer-left";

  const phaseEl = document.createElement("span");
  phaseEl.className = "dayphase wc-dayphase";
  footerLeft.appendChild(phaseEl);

  const dateEl = document.createElement("span");
  dateEl.className = "date wc-date";
  dateEl.setAttribute("aria-live", "polite");
  footerLeft.appendChild(dateEl);

  sectionBottom.appendChild(footerLeft);

  const offsetEl = document.createElement("span");
  offsetEl.className = "wc-utc-offset";
  offsetEl.setAttribute("aria-live", "polite");
  sectionBottom.appendChild(offsetEl);

  card.appendChild(sectionBottom);

  return card;
}

// ─── Full render ──────────────────────────────────────────────────────────────
function wcRender() {
  const container = document.getElementById("worldClocks");
  if (!container) return;

  // Fade out, swap, fade in
  container.style.opacity = "0";
  requestAnimationFrame(() => {
    container.replaceChildren();
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
    setSvg(gearBtn, _wcEditMode ? _SVG_CLOSE : _SVG_GEAR);
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
    setSvg(gearBtn, _SVG_GEAR);
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
    setSvg(addBtn, _SVG_PLUS);
    const addCitySpan = document.createElement("span");
    addCitySpan.textContent = "Add City";
    addBtn.appendChild(addCitySpan);
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
