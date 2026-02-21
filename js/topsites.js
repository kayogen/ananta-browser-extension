/* ══════════════════════════════════════════════════════════════════════════
   topsites.js — Paginated single-row Top Sites with magnetic hover
   Layout: 10 items per page · scroll-snap · dot pagination
   Uses icons.js (DDG → Google → letter badge) · Physics hover via rAF
══════════════════════════════════════════════════════════════════════════ */

"use strict";

/* ── Constants ──────────────────────────────────────────────────────────── */
const LP_PAGE_SIZE = 10;
const MAG_RADIUS = 130; // px — effect radius from cursor to icon center
const MAG_FACTOR = 0.28; // max displacement as fraction of radius
const MAG_MAX_PX = 10; // maximum pixel displacement

/* ── Module state ───────────────────────────────────────────────────────── */
let _magRafId = null;
let _magCursorX = 0;
let _magCursorY = 0;
let _magActive = false;

let _lpCurrentPage = 0;
let _lpTrackEl = null;
let _lpDotsEl = null;
let _lpPageEls = [];

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

/* ── Render one site card ────────────────────────────────────────────────── */
function _renderLpCard(site, indexInPage) {
  const domain = cleanDomain(site.url);
  const label = site.title || domain;

  const a = document.createElement("a");
  a.className = "lp-item spring-gpu";
  a.href = site.url;
  a.title = label + "\n" + site.url;
  a.setAttribute("role", "listitem");
  a.rel = "noopener noreferrer";
  a.style.animationDelay = Math.min(indexInPage * 28, 250) + "ms";

  a.addEventListener("click", (e) => {
    e.preventDefault();
    window.location.href = site.url;
  });

  const iconWrap = document.createElement("div");
  iconWrap.className = "lp-icon-wrap";

  const img = document.createElement("img");
  img.className = "lp-favicon";
  img.alt = "";
  img.width = 28;
  img.height = 28;
  img.decoding = "async";

  const immediate = AnantaIcons.getIconSync(site.url, 64, (resolved) => {
    img.src = resolved;
  });
  img.src = immediate;
  img.onerror = () => {
    img.src = AnantaIcons.letterBadge(domain, 64);
  };

  iconWrap.appendChild(img);
  a.appendChild(iconWrap);

  const title = document.createElement("span");
  title.className = "lp-title";
  title.textContent =
    label.length > 18 ? label.slice(0, 16).trim() + "…" : label;
  a.appendChild(title);

  return a;
}

/* ── Navigate to a page ─────────────────────────────────────────────────── */
function _lpGoToPage(pageIndex, smooth = true) {
  if (!_lpTrackEl) return;
  const pageWidth = _lpTrackEl.clientWidth;
  _lpTrackEl.scrollTo({
    left: pageIndex * pageWidth,
    behavior: smooth ? "smooth" : "instant",
  });
  _lpSetActiveDot(pageIndex);
}

/* ── Update active pagination dot ───────────────────────────────────────── */
function _lpSetActiveDot(pageIndex) {
  _lpCurrentPage = pageIndex;
  if (!_lpDotsEl) return;
  _lpDotsEl.querySelectorAll(".lp-dot").forEach((dot, i) => {
    const active = i === pageIndex;
    dot.classList.toggle("lp-dot--active", active);
    dot.setAttribute("aria-current", active ? "true" : "false");
  });
}

/* ── Magnetic hover (rAF loop, visible page only) ───────────────────────── */
function _startMagneticLoop(outerEl) {
  function resetAll() {
    outerEl.querySelectorAll(".lp-item").forEach((el) => {
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

    const visiblePage = _lpPageEls[_lpCurrentPage];
    if (!visiblePage) {
      _magRafId = requestAnimationFrame(loop);
      return;
    }

    visiblePage.querySelectorAll(".lp-item").forEach((el) => {
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
        el.style.transform = `translateZ(0) translate(${pushX.toFixed(2)}px,${pushY.toFixed(2)}px)`;
      } else if (el.classList.contains("is-magnetic")) {
        el.classList.remove("is-magnetic");
        el.style.transform = "";
      }
    });

    _magRafId = requestAnimationFrame(loop);
  }

  outerEl.addEventListener("pointermove", (e) => {
    _magCursorX = e.clientX;
    _magCursorY = e.clientY;
    if (!_magActive) {
      _magActive = true;
      _magRafId = requestAnimationFrame(loop);
    }
  });

  outerEl.addEventListener("pointerleave", () => {
    _magActive = false;
  });
}

/* ── Init ───────────────────────────────────────────────────────────────── */
async function initTopSites() {
  const section = document.getElementById("topSitesArea");
  if (!section) return [];

  const sites = await _fetchTopSites();

  // Clear skeleton placeholder
  section.replaceChildren();

  if (sites.length === 0) {
    const outer = document.createElement("div");
    outer.className = "lp-outer";
    const msg = document.createElement("p");
    msg.className = "lp-empty";
    msg.textContent = "Browse the web to populate Top Sites";
    outer.appendChild(msg);
    section.appendChild(outer);
    return [];
  }

  /* ── Outer glass card (overflow: hidden) ─────────────────────────────── */
  const outer = document.createElement("div");
  outer.className = "lp-outer";

  /* ── Scroll track (overflow-x: scroll, scroll-snap) ─────────────────── */
  const track = document.createElement("div");
  track.className = "lp-track";
  track.setAttribute("role", "list");
  track.setAttribute("aria-label", "Most visited sites");
  _lpTrackEl = track;
  _lpPageEls = [];
  _lpCurrentPage = 0;

  /* ── Build pages of LP_PAGE_SIZE ────────────────────────────────────── */
  const pages = [];
  for (let i = 0; i < sites.length; i += LP_PAGE_SIZE) {
    pages.push(sites.slice(i, i + LP_PAGE_SIZE));
  }

  pages.forEach((pageSites, pageIdx) => {
    const page = document.createElement("div");
    page.className = "lp-page";
    page.dataset.page = String(pageIdx);

    const frag = document.createDocumentFragment();
    pageSites.forEach((site, i) => frag.appendChild(_renderLpCard(site, i)));
    page.appendChild(frag);
    track.appendChild(page);
    _lpPageEls.push(page);
  });

  outer.appendChild(track);
  section.appendChild(outer);

  /* ── Pagination dots (only if more than 1 page) ─────────────────────── */
  if (pages.length > 1) {
    const pagination = document.createElement("div");
    pagination.className = "lp-pagination";
    _lpDotsEl = pagination;

    pages.forEach((_, i) => {
      const dot = document.createElement("button");
      dot.className = "lp-dot" + (i === 0 ? " lp-dot--active" : "");
      dot.setAttribute("type", "button");
      dot.setAttribute("aria-label", `Go to page ${i + 1}`);
      dot.setAttribute("aria-current", i === 0 ? "true" : "false");
      dot.addEventListener("click", () => _lpGoToPage(i));
      pagination.appendChild(dot);
    });

    section.appendChild(pagination);

    /* sync dots on scroll */
    let _scrollDebounce = null;
    track.addEventListener(
      "scroll",
      () => {
        if (_scrollDebounce) clearTimeout(_scrollDebounce);
        _scrollDebounce = setTimeout(() => {
          const pageWidth = track.clientWidth || 1;
          const page = Math.round(track.scrollLeft / pageWidth);
          const clamped = Math.max(0, Math.min(pages.length - 1, page));
          if (clamped !== _lpCurrentPage) _lpSetActiveDot(clamped);
        }, 60);
      },
      { passive: true },
    );
  } else {
    _lpDotsEl = null;
  }

  /* ── Magnetic hover ─────────────────────────────────────────────────── */
  _startMagneticLoop(outer);

  /* ── Background icon preload ────────────────────────────────────────── */
  AnantaIcons.preloadIcons(
    sites.map((s) => s.url),
    64,
  );

  return sites;
}
