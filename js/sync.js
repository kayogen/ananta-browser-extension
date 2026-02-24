"use strict";

const AnantaSync = (() => {
  const API_BASE = "http://localhost:8080/api";
  const AUTH_KEY = "anantaAuth";
  const META_KEY = "anantaSyncMeta";
  const ALL_DATA_TYPES = [
    "pinned_apps",
    "world_clocks",
    "settings",
    "bookmarks",
    "history",
    "top_sites",
    "device_info",
  ];
  const LOCAL_STORABLE = ["pinned_apps", "world_clocks", "settings"];

  function detectBrowser() {
    const ua = navigator.userAgent;
    if (ua.includes("Brave")) return "brave";
    if (ua.includes("Edg/")) return "edge";
    if (ua.includes("Firefox")) return "firefox";
    if (ua.includes("Safari") && !ua.includes("Chrome")) return "safari";
    if (ua.includes("Chrome")) return "chrome";
    return "other";
  }

  function getDeviceId() {
    return new Promise((resolve) => {
      if (chrome?.storage?.local) {
        chrome.storage.local.get("anantaDeviceId", (res) => {
          if (res.anantaDeviceId) return resolve(res.anantaDeviceId);
          const id = crypto.randomUUID();
          chrome.storage.local.set({ anantaDeviceId: id });
          resolve(id);
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

  function getAuth() {
    return new Promise((resolve) => {
      if (chrome?.storage?.local) {
        chrome.storage.local.get(AUTH_KEY, (r) => resolve(r[AUTH_KEY] || null));
      } else {
        try {
          resolve(JSON.parse(localStorage.getItem(AUTH_KEY)) || null);
        } catch {
          resolve(null);
        }
      }
    });
  }

  function getSyncMeta() {
    return new Promise((resolve) => {
      if (chrome?.storage?.local) {
        chrome.storage.local.get(META_KEY, (r) => resolve(r[META_KEY] || {}));
      } else {
        try {
          resolve(JSON.parse(localStorage.getItem(META_KEY)) || {});
        } catch {
          resolve({});
        }
      }
    });
  }

  function saveSyncMeta(meta) {
    return new Promise((resolve) => {
      if (chrome?.storage?.local) {
        chrome.storage.local.set({ [META_KEY]: meta }, resolve);
      } else {
        localStorage.setItem(META_KEY, JSON.stringify(meta));
        resolve();
      }
    });
  }

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

  async function computeChecksum(data) {
    const buffer = new TextEncoder().encode(JSON.stringify(data));
    const hash = await crypto.subtle.digest("SHA-256", buffer);
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  function extractBrowserVersion(ua) {
    const patterns = [
      [/Brave\/(\S+)/, "Brave"],
      [/Edg\/(\S+)/, "Edge"],
      [/Firefox\/(\S+)/, "Firefox"],
      [/Version\/(\S+).*Safari/, "Safari"],
      [/Chrome\/(\S+)/, "Chrome"],
    ];
    for (const [re] of patterns) {
      const m = ua.match(re);
      if (m) return m[1];
    }
    return null;
  }

  function extractOS(ua) {
    if (ua.includes("Windows NT 10"))
      return ua.includes("Windows NT 10.0; Win64")
        ? "Windows 10/11"
        : "Windows 10";
    if (ua.includes("Windows NT 6.3")) return "Windows 8.1";
    if (ua.includes("Windows NT 6.1")) return "Windows 7";
    if (ua.includes("Mac OS X")) {
      const m = ua.match(/Mac OS X ([\d_]+)/);
      return m ? `macOS ${m[1].replace(/_/g, ".")}` : "macOS";
    }
    if (ua.includes("CrOS")) return "ChromeOS";
    if (ua.includes("Linux")) return "Linux";
    return navigator.platform || "Unknown";
  }

  function collectDeviceInfo() {
    const ua = navigator.userAgent;
    return {
      platform: navigator.platform || null,
      os: extractOS(ua),
      arch: navigator.userAgentData?.architecture || null,
      browser: detectBrowser(),
      browserVersion: extractBrowserVersion(ua),
      userAgent: ua,
      language: navigator.language,
      languages: Array.from(navigator.languages || []),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      screenWidth: screen.width,
      screenHeight: screen.height,
      devicePixelRatio: window.devicePixelRatio,
      maxTouchPoints: navigator.maxTouchPoints || 0,
      hardwareConcurrency: navigator.hardwareConcurrency || null,
      deviceMemory: navigator.deviceMemory || null,
      colorDepth: screen.colorDepth,
      pdfViewerEnabled: navigator.pdfViewerEnabled ?? null,
      cookieEnabled: navigator.cookieEnabled,
    };
  }

  function collectLocalStorageData() {
    const items = [];

    try {
      const raw = localStorage.getItem("pinnedApps");
      if (raw) items.push({ dataType: "pinned_apps", data: JSON.parse(raw) });
    } catch {}

    try {
      const raw = localStorage.getItem("worldClocks");
      if (raw) items.push({ dataType: "world_clocks", data: JSON.parse(raw) });
    } catch {}

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
      if (!chrome?.bookmarks?.getTree) return resolve(null);
      chrome.bookmarks.getTree((tree) => {
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
            if (node.children)
              walk(node.children, path ? `${path}/${node.title}` : node.title);
          }
        }
        walk(tree);
        resolve(bookmarks);
      });
    });
  }

  function collectHistory() {
    return new Promise((resolve) => {
      if (!chrome?.history?.search) return resolve(null);
      chrome.history.search(
        {
          text: "",
          maxResults: 500,
          startTime: Date.now() - 30 * 24 * 60 * 60 * 1000,
        },
        (results) =>
          resolve(
            results.map((i) => ({
              title: i.title,
              url: i.url,
              lastVisitTime: i.lastVisitTime,
              visitCount: i.visitCount,
            })),
          ),
      );
    });
  }

  function collectTopSites() {
    return new Promise((resolve) => {
      if (!chrome?.topSites?.get) return resolve(null);
      chrome.topSites.get((sites) =>
        resolve(sites.map((s) => ({ title: s.title, url: s.url }))),
      );
    });
  }

  function clearLocal(dataType) {
    switch (dataType) {
      case "pinned_apps":
        localStorage.removeItem("pinnedApps");
        break;
      case "world_clocks":
        localStorage.removeItem("worldClocks");
        break;
      case "settings":
        localStorage.removeItem("ananta-fmt-24h");
        localStorage.removeItem("selectedBookmarkFolder");
        localStorage.removeItem("openBookmarkFolders");
        break;
    }
  }

  function applyToLocal(item) {
    switch (item.dataType) {
      case "pinned_apps":
        localStorage.setItem("pinnedApps", JSON.stringify(item.data));
        break;
      case "world_clocks":
        localStorage.setItem("worldClocks", JSON.stringify(item.data));
        break;
      case "settings":
        localStorage.removeItem("ananta-fmt-24h");
        localStorage.removeItem("selectedBookmarkFolder");
        localStorage.removeItem("openBookmarkFolders");
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

  async function smartSync() {
    const auth = await getAuth();
    if (!auth?.accessToken) throw new Error("Not authenticated");

    const browserType = detectBrowser();
    const deviceId = await getDeviceId();
    const meta = await getSyncMeta();

    const allLocal = collectLocalStorageData();
    const [bookmarks, history, topSites] = await Promise.all([
      collectBookmarks(),
      collectHistory(),
      collectTopSites(),
    ]);
    if (bookmarks) allLocal.push({ dataType: "bookmarks", data: bookmarks });
    if (history) allLocal.push({ dataType: "history", data: history });
    if (topSites) allLocal.push({ dataType: "top_sites", data: topSites });
    allLocal.push({ dataType: "device_info", data: collectDeviceInfo() });

    const localMap = {};
    for (const item of allLocal) {
      localMap[item.dataType] = {
        data: item.data,
        checksum: await computeChecksum(item.data),
      };
    }

    const statusParams = new URLSearchParams({
      browserType,
      dataTypes: ALL_DATA_TYPES.join(","),
    });
    const statusRes = await api(`/ananta/sync/status?${statusParams}`, {
      token: auth.accessToken,
    });
    const serverItems = statusRes.data?.items || [];

    const serverMap = {};
    for (const s of serverItems) serverMap[s.dataType] = s;

    const toPush = [];
    const unchanged = [];

    for (const dt of Object.keys(localMap)) {
      const local = localMap[dt];
      const server = serverMap[dt];
      const known = meta[dt] || {};

      if (dt === "device_info") {
        toPush.push({
          dataType: dt,
          data: local.data,
          baseVersion: server?.syncVersion || 0,
        });
        continue;
      }

      if (!server) {
        toPush.push({ dataType: dt, data: local.data, baseVersion: 0 });
        continue;
      }

      if (local.checksum === server.checksum) {
        unchanged.push(dt);
        meta[dt] = { version: server.syncVersion, checksum: local.checksum };
        continue;
      }

      const localChanged = local.checksum !== known.checksum;
      if (localChanged) {
        toPush.push({
          dataType: dt,
          data: local.data,
          baseVersion: server.syncVersion,
        });
      }
    }

    const results = { pushed: [], pulled: [], conflicts: [], unchanged };

    if (toPush.length > 0) {
      const pushItems = await Promise.all(
        toPush.map(async (item) => ({
          dataType: item.dataType,
          data: item.data,
          baseVersion: item.baseVersion,
          checksum: await computeChecksum(item.data),
        })),
      );

      const pushRes = await api("/ananta/sync", {
        method: "POST",
        token: auth.accessToken,
        body: { browserType, deviceId, items: pushItems },
      });

      for (const r of pushRes.data?.results || []) {
        meta[r.dataType] = { version: r.syncVersion, checksum: r.checksum };
        if (r.status === "conflict") {
          results.conflicts.push(r.dataType);
        } else if (r.status === "updated" || r.status === "created") {
          results.pushed.push(r.dataType);
        } else if (r.status === "unchanged") {
          results.unchanged.push(r.dataType);
        }
      }
    }

    const toPull = [];
    for (const dt of LOCAL_STORABLE) {
      if (!unchanged.includes(dt) && serverMap[dt]) {
        toPull.push(dt);
      }
    }
    for (const dt of Object.keys(serverMap)) {
      if (!localMap[dt] && dt !== "device_info" && !toPull.includes(dt)) {
        toPull.push(dt);
      }
    }

    if (toPull.length > 0) {
      const pullParams = new URLSearchParams({
        browserType,
        dataTypes: toPull.join(","),
      });
      const pullRes = await api(`/ananta/sync?${pullParams}`, {
        token: auth.accessToken,
      });
      const pulled = pullRes.data?.items || [];

      for (const item of pulled) {
        if (LOCAL_STORABLE.includes(item.dataType)) applyToLocal(item);
        const localChecksum = await computeChecksum(item.data);
        meta[item.dataType] = {
          version: item.syncVersion,
          checksum: localChecksum,
        };
        if (!results.pulled.includes(item.dataType)) {
          results.pulled.push(item.dataType);
        }
      }
    }

    for (const dt of LOCAL_STORABLE) {
      if (meta[dt] && !serverMap[dt]) {
        clearLocal(dt);
        delete meta[dt];
        if (!results.pulled.includes(dt)) results.pulled.push(dt);
      }
    }

    await saveSyncMeta(meta);
    return results;
  }

  async function push() {
    const auth = await getAuth();
    if (!auth?.accessToken) throw new Error("Not authenticated");

    const browserType = detectBrowser();
    const deviceId = await getDeviceId();
    const meta = await getSyncMeta();

    const items = collectLocalStorageData();
    const [bookmarks, history, topSites] = await Promise.all([
      collectBookmarks(),
      collectHistory(),
      collectTopSites(),
    ]);
    if (bookmarks) items.push({ dataType: "bookmarks", data: bookmarks });
    if (history) items.push({ dataType: "history", data: history });
    if (topSites) items.push({ dataType: "top_sites", data: topSites });
    items.push({ dataType: "device_info", data: collectDeviceInfo() });

    const withVersions = await Promise.all(
      items.map(async (item) => ({
        ...item,
        checksum: await computeChecksum(item.data),
        baseVersion: meta[item.dataType]?.version || 0,
      })),
    );

    const res = await api("/ananta/sync", {
      method: "POST",
      token: auth.accessToken,
      body: { browserType, deviceId, items: withVersions },
    });

    for (const r of res.data?.results || []) {
      if (r.syncVersion) {
        meta[r.dataType] = { version: r.syncVersion, checksum: r.checksum };
      }
      if (
        r.status === "conflict" &&
        r.serverData &&
        LOCAL_STORABLE.includes(r.dataType)
      ) {
        applyToLocal({ dataType: r.dataType, data: r.serverData });
      }
    }
    await saveSyncMeta(meta);
    return res;
  }

  async function pull() {
    const auth = await getAuth();
    if (!auth?.accessToken) throw new Error("Not authenticated");

    const browserType = detectBrowser();
    const meta = await getSyncMeta();

    const params = new URLSearchParams({
      browserType,
      dataTypes: ALL_DATA_TYPES.join(","),
    });

    const res = await api(`/ananta/sync?${params}`, {
      token: auth.accessToken,
    });
    const serverData = res.data?.items || [];
    const pulledTypes = new Set();

    for (const item of serverData) {
      if (LOCAL_STORABLE.includes(item.dataType)) applyToLocal(item);
      const localChecksum = await computeChecksum(item.data);
      meta[item.dataType] = {
        version: item.syncVersion,
        checksum: localChecksum,
      };
      pulledTypes.add(item.dataType);
    }

    for (const dt of LOCAL_STORABLE) {
      if (meta[dt] && !pulledTypes.has(dt)) {
        clearLocal(dt);
        delete meta[dt];
      }
    }

    await saveSyncMeta(meta);
    return res;
  }

  async function status() {
    const auth = await getAuth();
    if (!auth?.accessToken) return null;

    const browserType = detectBrowser();
    const params = new URLSearchParams({ browserType });
    return api(`/ananta/sync/status?${params}`, { token: auth.accessToken });
  }

  return {
    smartSync,
    push,
    pull,
    status,
    detectBrowser,
    getDeviceId,
  };
})();
