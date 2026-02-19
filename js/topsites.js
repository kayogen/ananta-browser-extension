/* ══════════════════════════════════════════════════════════════════════════
   topsites.js — Launchpad-style Top Sites grid with magnetic hover
   Uses icons.js (DDG → Google → letter badge) · Physics hover via rAF
══════════════════════════════════════════════════════════════════════════ */

"use strict";

/* ── Magnetic hover constants ────────────────────────────────────────────── */
const MAG_RADIUS = 120; // px — effect radius from cursor to icon center
const MAG_FACTOR = 0.28; // max displacement as fraction of radius
const MAG_MAX_PX = 10; // max pixel displacement

/* ── Fetch ───────────────────────────────────────────────────────────────── */
async function _fetchTopSites() {
  if (!browserAPI || !browserAPI.topSites) return [];
  try {
    return await browserAPI.topSites.get();
  } catch (err) {
    console.error("[Ananta/topsites] get failed:", err);
    return [];
  }
}

/* ── Render one Launchpad card ────────────────────────────────────────────── */
function _renderLpCard(site, index) {
  const domain = cleanDomain(site.url);
  const label = site.title || domain;

  const a = document.createElement("a");
  a.className = "lp-item spring-gpu";
  a.href = site.url;
  a.title = label + "\n" + site.url;
  a.setAttribute("role", "listitem");
  a.rel = "noopener noreferrer";
  a.style.animationDelay = Math.min(index * 22, 550) + "ms";

  a.addEventListener("click", (e) => {
    e.preventDefault();
    window.location.href = site.url;
  });

  // Icon wrapper
  const iconWrap = document.createElement("div");
  iconWrap.className = "lp-icon-wrap";

  // Use icons.js: DDG → Google → letter badge
  const img = document.createElement("img");
  img.className = "lp-favicon";
  img.alt = "";
  img.width = 28;
  img.height = 28;
  img.decoding = "async";

  // getIconSync returns a badge immediately, resolves to real icon asynchronously
  const immediate = AnantaIcons.getIconSync(site.url, 64, (resolved) => {
    img.src = resolved;
  });
  img.src = immediate;
  img.onerror = () => {
    // Replace img with letter badge if all providers fail
    img.replaceWith(_mkLetterBadge(label, domain));
  };
  iconWrap.appendChild(img);
  a.appendChild(iconWrap);

  // Title
  const title = document.createElement("span");
  title.className = "lp-title";
  title.textContent =
    label.length > 30 ? label.slice(0, 27).trim() + "…" : label;
  a.appendChild(title);

  return a;
}

/* ── Letter badge (in-grid fallback) ─────────────────────────────────────── */
function _mkLetterBadge(label, domain) {
  const wrap = document.createElement("div");
  wrap.className = "lp-icon-wrap";
  // Use icons.js letterBadge as img src for consistency
  const img = document.createElement("img");
  img.className = "lp-favicon";
  img.alt = "";
  img.width = 28;
  img.height = 28;
  img.src = AnantaIcons.letterBadge(domain, 64);
  wrap.appendChild(img);
  return wrap.firstChild; // return just the img
}

/* ── Magnetic hover effect ──────────────────────────────────────────────────
   On each pointermove over the grid, we compute a displacement vector for
   every icon within MAG_RADIUS pixels of the cursor and apply it via
   direct style.transform. This runs inside a rAF loop while the pointer
   is inside the grid.                                                      */

let _magRafId = null;
let _magCursorX = 0;
let _magCursorY = 0;
let _magActive = false;

function _startMagneticLoop(grid) {
  function resetAll() {
    grid.querySelectorAll(".lp-item").forEach((el) => {
      el.classList.remove("is-magnetic");
      el.style.transform = "";
    });
  }

  function loop() {
    if (!_magActive) {
      resetAll();
      _magRafId = null;
      return;
    }

    const items = grid.querySelectorAll(".lp-item");
    items.forEach((el) => {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = _magCursorX - cx;
      const dy = _magCursorY - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < MAG_RADIUS && dist > 0) {
        const strength = Math.max(0, 1 - dist / MAG_RADIUS);
        const pushX = Math.min(MAG_MAX_PX, dx * strength * MAG_FACTOR);
        const pushY = Math.min(MAG_MAX_PX, dy * strength * MAG_FACTOR);
        el.classList.add("is-magnetic");
        // Blend with hover translateY if hovered — we use translateZ(0) + translate
        el.style.transform = `translateZ(0) translate(${pushX.toFixed(2)}px, ${pushY.toFixed(2)}px)`;
      } else if (el.classList.contains("is-magnetic")) {
        el.classList.remove("is-magnetic");
        el.style.transform = "";
      }
    });

    _magRafId = requestAnimationFrame(loop);
  }

  grid.addEventListener("pointermove", (e) => {
    _magCursorX = e.clientX;
    _magCursorY = e.clientY;
    if (!_magActive) {
      _magActive = true;
      _magRafId = requestAnimationFrame(loop);
    }
  });

  grid.addEventListener("pointerleave", () => {
    _magActive = false;
    // Loop will call resetAll on next frame
  });
}

/* ── Init ─────────────────────────────────────────────────────────────────── */
async function initTopSites() {
  const grid = document.getElementById("launchpadGrid");
  if (!grid) return [];

  const sites = await _fetchTopSites();
  grid.innerHTML = "";

  if (sites.length === 0) {
    grid.innerHTML = `<div class="lp-empty">Browse the web to populate this grid</div>`;
    return [];
  }

  // Responsive 2-row grid: ceil(N/2) columns so items fill 2 even rows
  const cols = Math.ceil(sites.length / 2);
  grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;

  const frag = document.createDocumentFragment();
  sites.forEach((site, i) => frag.appendChild(_renderLpCard(site, i)));
  grid.appendChild(frag);

  // Start magnetic hover
  _startMagneticLoop(grid);

  // Preload icons in background for snappier display
  AnantaIcons.preloadIcons(
    sites.map((s) => s.url),
    64,
  );

  return sites;
}
