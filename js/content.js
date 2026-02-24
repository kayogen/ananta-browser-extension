/* ══════════════════════════════════════════════════════════════════════════
   content.js — Content script bridge for Ananta auth
   Runs on backend domain pages (localhost:8080/ananta/* or app.kayogen.com/ananta/*)

   IMPORTANT: Content scripts only have access to chrome.runtime, chrome.storage,
   and chrome.i18n.  chrome.tabs is NOT available here — use chrome.runtime.sendMessage
   to ask the background script for anything that needs chrome.tabs.

   This is a belt-and-suspenders companion to background.js.
   The background script handles auth-success via tabs.onUpdated (primary path).
   This content script provides additional sync via localStorage and postMessage.
══════════════════════════════════════════════════════════════════════════ */

"use strict";

const AUTH_KEY = "anantaAuth";
const WEB_AUTH_KEY = "anantaWebAuth";

/* ══════════════════════════════════════════════════════════════════════════
   STRATEGY: The web app (localhost:8080) writes auth data to its own
   localStorage under `anantaWebAuth`. Content scripts run on that origin
   and can read `window.localStorage` directly, then forward the data to
   `chrome.storage.local` which the extension's new-tab page reads.

   Three sync paths (each is a safety net for the others):
   1. Proactive – on every /ananta/* page load, read localStorage & push.
   2. Storage event – fires in other same-origin tabs when localStorage changes.
   3. Hash IIFE – reads encoded payload from #auth= on the auth-success page.
══════════════════════════════════════════════════════════════════════════ */

/* ── Helper: pull anantaWebAuth → chrome.storage.local ───────────────── */
function syncWebAuthToExtension(reason) {
  try {
    const raw = window.localStorage.getItem(WEB_AUTH_KEY);
    if (!raw) return;

    const data = JSON.parse(raw);
    if (!data || !data.accessToken) return;

    // Normalise to the shape the extension expects
    const authData = {
      name:
        data.name || `${data.firstName || ""} ${data.lastName || ""}`.trim(),
      email: data.email,
      userId: data.userId,
      firstName: data.firstName || "",
      lastName: data.lastName || "",
      username: data.username || "",
      profileImage: data.profileImage || null,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken || null,
      loggedInAt: data.loggedInAt || Date.now(),
    };

    chrome.storage.local.set({ [AUTH_KEY]: authData }, () => {
      if (chrome.runtime.lastError) {
        console.warn(
          "[Ananta/content] storage.set error:",
          chrome.runtime.lastError.message,
        );
      } else {
        console.debug(
          "[Ananta/content] synced auth to extension storage –",
          reason || "on load",
        );
      }
    });
  } catch (e) {
    console.warn("[Ananta/content] syncWebAuthToExtension error:", e);
  }
}

/* ── Helper: clear extension storage when web app logs out ──────────── */
function clearExtensionAuth(reason) {
  chrome.storage.local.remove(AUTH_KEY, () => {
    console.debug(
      "[Ananta/content] cleared extension auth –",
      reason || "logout",
    );
  });
}

/* ── Path 1: Proactive sync on every page load ───────────────────────── */
syncWebAuthToExtension("page-load");

/* ── Path 2: React to localStorage changes in other same-origin tabs ── */
window.addEventListener("storage", (event) => {
  if (event.key === WEB_AUTH_KEY) {
    if (event.newValue) {
      syncWebAuthToExtension("storage-event");
    } else {
      // Key was removed (logout)
      clearExtensionAuth("storage-event logout");
    }
  }
});

/* ── Auth-success page: read hash payload and close tab ──────────────── */
(function handleAuthSuccessPage() {
  if (!window.location.pathname.endsWith("/auth-success")) return;

  const hash = window.location.hash;
  if (!hash.startsWith("#auth=")) return;

  let authData;
  try {
    authData = JSON.parse(decodeURIComponent(escape(atob(hash.slice(6)))));
  } catch (e) {
    console.error(
      "[Ananta/content] Failed to decode auth payload from hash",
      e,
    );
    return;
  }

  if (!authData || !authData.accessToken) return;

  // Write auth to extension storage — this triggers onChanged in the new-tab page
  chrome.storage.local.set({ [AUTH_KEY]: authData }, () => {
    if (chrome.runtime.lastError) {
      console.warn("[Ananta/content] storage error:", chrome.runtime.lastError);
      return;
    }
    // Clean the URL so the token isn't visible
    try {
      history.replaceState(null, "", window.location.pathname);
    } catch {}
    // Ask background script to close this tab
    // (chrome.tabs is NOT available in content scripts)
    try {
      chrome.runtime.sendMessage({ type: "ANANTA_CLOSE_SENDER_TAB" });
    } catch (e) {
      console.debug("[Ananta/content] could not request tab close:", e);
    }
  });
})();

/* ── Listen for messages from the web page ────────────────────────────── */
window.addEventListener("message", (event) => {
  // Only accept messages from the same window (page → content script)
  if (event.source !== window) return;
  if (!event.data || typeof event.data.type !== "string") return;

  switch (event.data.type) {
    /* ── Auth success (login / signup) ──────────────────────────────── */
    case "ANANTA_AUTH_SUCCESS": {
      const { user, accessToken, refreshToken } = event.data.payload || {};
      if (!user || !accessToken) return;

      const authData = {
        name:
          user.name || `${user.firstName || ""} ${user.lastName || ""}`.trim(),
        email: user.email,
        userId: user.id || user._id,
        firstName: user.firstName,
        lastName: user.lastName || "",
        username: user.username,
        profileImage: user.profileImage || null,
        accessToken,
        refreshToken: refreshToken || null,
        loggedInAt: Date.now(),
      };

      chrome.storage.local.set({ [AUTH_KEY]: authData }, () => {
        // Confirm back to the page
        window.postMessage({ type: "ANANTA_AUTH_STORED", success: true }, "*");
      });
      break;
    }

    /* ── Auth logout ──────────────────────────────────────────────── */
    case "ANANTA_AUTH_LOGOUT": {
      // Clear both extension storage and web-app localStorage
      try {
        window.localStorage.removeItem(WEB_AUTH_KEY);
      } catch {}
      chrome.storage.local.remove(AUTH_KEY, () => {
        window.postMessage({ type: "ANANTA_AUTH_CLEARED", success: true }, "*");
      });
      break;
    }

    /* ── Auth update (profile changes) ────────────────────────────── */
    case "ANANTA_AUTH_UPDATE": {
      const updates = event.data.payload;
      if (!updates || !updates.user) return;

      chrome.storage.local.get(AUTH_KEY, (result) => {
        const existing = result[AUTH_KEY];
        if (!existing) return;

        const merged = {
          ...existing,
          name: updates.user.name || existing.name,
          email: updates.user.email || existing.email,
          firstName: updates.user.firstName || existing.firstName,
          lastName: updates.user.lastName ?? existing.lastName,
          username: updates.user.username || existing.username,
          profileImage: updates.user.profileImage ?? existing.profileImage,
        };

        // Keep web-app localStorage in sync too
        try {
          const raw = window.localStorage.getItem(WEB_AUTH_KEY);
          const webExisting = raw ? JSON.parse(raw) : {};
          window.localStorage.setItem(
            WEB_AUTH_KEY,
            JSON.stringify({ ...webExisting, ...merged }),
          );
        } catch {}

        chrome.storage.local.set({ [AUTH_KEY]: merged });
      });
      break;
    }

    /* ── Token refresh ────────────────────────────────────────────── */
    case "ANANTA_AUTH_UPDATE_TOKENS": {
      const { accessToken, refreshToken } = event.data.payload || {};
      if (!accessToken) return;

      chrome.storage.local.get(AUTH_KEY, (result) => {
        const existing = result[AUTH_KEY];
        if (!existing) return;

        const updated = {
          ...existing,
          accessToken,
          refreshToken: refreshToken || existing.refreshToken,
        };

        // Keep web-app localStorage in sync too
        try {
          const raw = window.localStorage.getItem(WEB_AUTH_KEY);
          const webExisting = raw ? JSON.parse(raw) : {};
          window.localStorage.setItem(
            WEB_AUTH_KEY,
            JSON.stringify({
              ...webExisting,
              accessToken: updated.accessToken,
              refreshToken: updated.refreshToken,
            }),
          );
        } catch {}

        chrome.storage.local.set({ [AUTH_KEY]: updated });
      });
      break;
    }

    /* ── Page requesting current auth data ────────────────────────── */
    case "ANANTA_REQUEST_AUTH": {
      chrome.storage.local.get(AUTH_KEY, (result) => {
        const data = result[AUTH_KEY] || null;
        window.postMessage({ type: "ANANTA_AUTH_DATA", payload: data }, "*");
      });
      break;
    }
  }
});

/* ── Listen for messages from the extension (e.g. logout from new tab) ── */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message.type !== "string") return;

  switch (message.type) {
    /* Extension initiated logout — clear web-app localStorage */
    case "ANANTA_CLEAR_WEB_AUTH": {
      try {
        window.localStorage.removeItem(WEB_AUTH_KEY);
      } catch {}
      chrome.storage.local.remove(AUTH_KEY);
      sendResponse({ ok: true });
      break;
    }

    /* Extension wants latest auth pushed from web localStorage */
    case "ANANTA_SYNC_WEB_AUTH": {
      syncWebAuthToExtension("runtime-message");
      sendResponse({ ok: true });
      break;
    }
  }
});
