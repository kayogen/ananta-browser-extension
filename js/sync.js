/* ══════════════════════════════════════════════════════════════════════════
   sync.js — Two-way data sync for Ananta extension
   Collects localStorage settings + browser API data, pushes/pulls to API
══════════════════════════════════════════════════════════════════════════ */

"use strict";

const AnantaSync = (() => {
  const API_BASE = "http://localhost:8080/api";
  const AUTH_KEY = "anantaAuth";

  /* ── Browser detection ─────────────────────────────────────────────── */
  function detectBrowser() {
    const ua = navigator.userAgent;
    if (ua.includes("Brave")) return "brave";
    if (ua.includes("Edg/")) return "edge";
    if (ua.includes("Firefox")) return "firefox";
    if (ua.includes("Safari") && !ua.includes("Chrome")) return "safari";
    if (ua.includes("Chrome")) return "chrome";
    return "other";
  }

  /* ── Device ID (stable per browser install) ────────────────────────── */
  async function getDeviceId() {
    return new Promise((resolve) => {
      if (chrome?.storage?.local) {
        chrome.storage.local.get("anantaDeviceId", (res) => {
          if (res.anantaDeviceId) {
            resolve(res.anantaDeviceId);
          } else {
            const id = crypto.randomUUID();
            chrome.storage.local.set({ anantaDeviceId: id });
            resolve(id);
          }
        });
      } else {
        let id = localStorage.getItem("anantaDeviceId");
        if (!id) {
          id = crypto.randomUUID();
          localStorage.setItem("anantaDeviceId", id);
        }
        resolve(id);
      }
    });
  }

  /* ── Auth helper ───────────────────────────────────────────────────── */
  function getAuth() {
    return new Promise((resolve) => {
      if (chrome?.storage?.local) {
        chrome.storage.local.get(AUTH_KEY, (res) => {
          resolve(res[AUTH_KEY] || null);
        });
      } else {
        try {
          resolve(JSON.parse(localStorage.getItem(AUTH_KEY)) || null);
        } catch {
          resolve(null);
        }
      }
    });
  }

  /* ── API call ──────────────────────────────────────────────────────── */
  async function api(path, opts = {}) {
    const { method = "GET", body, token } = opts;
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const json = await res.json();
    if (!res.ok)
      throw { status: res.status, message: json.message || "Sync failed" };
    return json;
  }

  /* ── Collect local data ────────────────────────────────────────────── */

  function collectLocalStorageData() {
    const items = [];

    // Pinned apps
    try {
      const raw = localStorage.getItem("pinnedApps");
      if (raw) items.push({ dataType: "pinned_apps", data: JSON.parse(raw) });
    } catch {}

    // World clocks
    try {
      const raw = localStorage.getItem("worldClocks");
      if (raw) items.push({ dataType: "world_clocks", data: JSON.parse(raw) });
    } catch {}

    // Settings (time format, bookmark prefs)
    try {
      const settings = {
        fmt24h: localStorage.getItem("ananta-fmt-24h") || "0",
        selectedBookmarkFolder:
          localStorage.getItem("selectedBookmarkFolder") || null,
        openBookmarkFolders: (() => {
          try {
            return JSON.parse(localStorage.getItem("openBookmarkFolders"));
          } catch {
            return null;
          }
        })(),
      };
      items.push({ dataType: "settings", data: settings });
    } catch {}

    return items;
  }

  function collectBookmarks() {
    return new Promise((resolve) => {
      if (!chrome?.bookmarks?.getTree) {
        resolve(null);
        return;
      }

      chrome.bookmarks.getTree((tree) => {
        // Normalize: flatten into a portable format
        const bookmarks = [];
        function walk(nodes, path = "") {
          for (const node of nodes) {
            if (node.url) {
              bookmarks.push({
                title: node.title,
                url: node.url,
                dateAdded: node.dateAdded,
                path,
              });
            }
            if (node.children) {
              walk(node.children, path ? `${path}/${node.title}` : node.title);
            }
          }
        }
        walk(tree);
        resolve(bookmarks);
      });
    });
  }

  function collectHistory() {
    return new Promise((resolve) => {
      if (!chrome?.history?.search) {
        resolve(null);
        return;
      }

      chrome.history.search(
        {
          text: "",
          maxResults: 500,
          startTime: Date.now() - 30 * 24 * 60 * 60 * 1000,
        },
        (results) => {
          const history = results.map((item) => ({
            title: item.title,
            url: item.url,
            lastVisitTime: item.lastVisitTime,
            visitCount: item.visitCount,
          }));
          resolve(history);
        },
      );
    });
  }

  function collectTopSites() {
    return new Promise((resolve) => {
      if (!chrome?.topSites?.get) {
        resolve(null);
        return;
      }

      chrome.topSites.get((sites) => {
        resolve(sites.map((s) => ({ title: s.title, url: s.url })));
      });
    });
  }

  /* ── Simple checksum ───────────────────────────────────────────────── */
  async function checksum(data) {
    const str = JSON.stringify(data);
    const buffer = new TextEncoder().encode(str);
    const hash = await crypto.subtle.digest("SHA-256", buffer);
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  /* ── Push (upload) ─────────────────────────────────────────────────── */
  async function push() {
    const auth = await getAuth();
    if (!auth?.accessToken) throw new Error("Not authenticated");

    const browserType = detectBrowser();
    const deviceId = await getDeviceId();

    // Collect all data
    const items = collectLocalStorageData();

    const [bookmarks, history, topSites] = await Promise.all([
      collectBookmarks(),
      collectHistory(),
      collectTopSites(),
    ]);

    if (bookmarks) items.push({ dataType: "bookmarks", data: bookmarks });
    if (history) items.push({ dataType: "history", data: history });
    if (topSites) items.push({ dataType: "top_sites", data: topSites });

    // Add checksums
    const withChecksums = await Promise.all(
      items.map(async (item) => ({
        ...item,
        checksum: await checksum(item.data),
      })),
    );

    return api("/ananta/sync", {
      method: "POST",
      token: auth.accessToken,
      body: {
        browserType,
        deviceId,
        items: withChecksums,
      },
    });
  }

  /* ── Pull (download) ───────────────────────────────────────────────── */
  async function pull() {
    const auth = await getAuth();
    if (!auth?.accessToken) throw new Error("Not authenticated");

    const browserType = detectBrowser();
    const deviceId = await getDeviceId();

    const params = new URLSearchParams({
      browserType,
      deviceId,
      dataTypes: "pinned_apps,world_clocks,settings",
    });

    const res = await api(`/ananta/sync?${params}`, {
      token: auth.accessToken,
    });

    const serverData = res.data?.items || [];

    // Apply each data type to local storage
    for (const item of serverData) {
      switch (item.dataType) {
        case "pinned_apps":
          localStorage.setItem("pinnedApps", JSON.stringify(item.data));
          break;
        case "world_clocks":
          localStorage.setItem("worldClocks", JSON.stringify(item.data));
          break;
        case "settings":
          if (item.data) {
            if (item.data.fmt24h != null)
              localStorage.setItem("ananta-fmt-24h", item.data.fmt24h);
            if (item.data.selectedBookmarkFolder != null)
              localStorage.setItem(
                "selectedBookmarkFolder",
                item.data.selectedBookmarkFolder,
              );
            if (item.data.openBookmarkFolders != null)
              localStorage.setItem(
                "openBookmarkFolders",
                JSON.stringify(item.data.openBookmarkFolders),
              );
          }
          break;
      }
    }

    return res;
  }

  /* ── Status check ──────────────────────────────────────────────────── */
  async function status() {
    const auth = await getAuth();
    if (!auth?.accessToken) return null;

    const browserType = detectBrowser();
    const deviceId = await getDeviceId();

    const params = new URLSearchParams({ browserType, deviceId });

    return api(`/ananta/sync/status?${params}`, {
      token: auth.accessToken,
    });
  }

  /* ── Public API ────────────────────────────────────────────────────── */
  return { push, pull, status, detectBrowser, getDeviceId };
})();
