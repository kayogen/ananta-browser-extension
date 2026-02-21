/* ══════════════════════════════════════════════════════════════════════════
   main.js — Ananta boot orchestrator (Phase 3)
   Fixed-viewport layout: clocks | spotlight | launchpad | bookmarks
   Build order: physics → icons → search → clocks → spotlight → sites → bookmarks
══════════════════════════════════════════════════════════════════════════ */

"use strict";

/* ── History fetcher (moved from spotlight.js) ────────────────────────────── */
async function _fetchHistory() {
  if (!browserAPI || !browserAPI.history) return [];
  try {
    const items = await browserAPI.history.search({
      text: "",
      startTime: Date.now() - 90 * 24 * 60 * 60 * 1000, // 90 days
      maxResults: 2000,
    });
    return items
      .filter((it) => it.url && it.title)
      .sort((a, b) => (b.lastVisitTime || 0) - (a.lastVisitTime || 0));
  } catch (e) {
    console.warn("[Ananta/main] history.search:", e);
    return [];
  }
}

/* ── Boot sequence ───────────────────────────────────────────────────────── */
async function boot() {
  const t0 = performance.now();
  // ── Phase 0: synchronous UI widgets ───────────────────────────────────────
  initDashboard(); // pinned apps dashboard (no async needed)
  // ── Phase 1: synchronous — clocks start via rAF immediately ──────────────
  initClocks();
  initWorldClocks(); // dynamic world clock system (storage + render + tick)

  // ── Phase 2: wire spotlight UI (no data needed yet) ───────────────────────
  await initSpotlight();

  // ── Phase 3: parallel async data loading ──────────────────────────────────
  const [historyItems, topSites, bookmarkList] = await Promise.all([
    _fetchHistory(),
    initTopSites(), // returns sites[] or []
    initBookmarks(), // returns flat bookmark[]
  ]);

  // ── Phase 4: build unified search index ──────────────────────────────────
  AnantaSearch.buildIndex(bookmarkList, historyItems, topSites || []);

  const ms = (performance.now() - t0).toFixed(0);
  console.info(
    `[Ananta] ✓ Ready in ${ms}ms — ${historyItems.length} history, ${(topSites || []).length} sites, ${bookmarkList.length} bookmarks indexed`,
  );
}

// Execute as soon as DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
