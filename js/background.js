/* ══════════════════════════════════════════════════════════════════════════
   background.js — Ananta extension background script (MV3 event page)

   Responsibilities:
   1. Detect when a tab navigates to /ananta/auth-success → extract auth
      from the URL hash → store in chrome.storage.local → close the tab.
      This is the PRIMARY auth path and does NOT depend on content scripts.
   2. Handle messages from content scripts (e.g. close-tab requests).
══════════════════════════════════════════════════════════════════════════ */

"use strict";

const BG_AUTH_KEY = "anantaAuth";

/* ══════════════════════════════════════════════════════════════════════════
   1.  tabs.onUpdated — detect auth-success page
══════════════════════════════════════════════════════════════════════════ */

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Only act when the page finishes loading
  if (changeInfo.status !== "complete") return;

  const url = tab.url || "";
  if (!url.includes("/ananta/auth-success")) return;

  console.log("[Ananta/bg] Auth-success page detected in tab", tabId);

  // ── Attempt 1: decode auth from URL hash (#auth=<base64>) ────────────
  const hashIdx = url.indexOf("#auth=");
  if (hashIdx !== -1) {
    try {
      const encoded = url.substring(hashIdx + 6);
      const json = decodeURIComponent(escape(atob(encoded)));
      const authData = JSON.parse(json);

      if (authData && authData.accessToken) {
        console.log("[Ananta/bg] Auth decoded from URL hash — storing");
        chrome.storage.local.set({ [BG_AUTH_KEY]: authData }, () => {
          // Brief delay so the user sees the success page
          setTimeout(() => chrome.tabs.remove(tabId), 800);
        });
        return;
      }
    } catch (e) {
      console.warn("[Ananta/bg] Hash decode failed:", e);
    }
  }

  // ── Attempt 2: inject a script to read localStorage ──────────────────
  //    (requires "scripting" permission + host permission)
  if (chrome.scripting && chrome.scripting.executeScript) {
    chrome.scripting
      .executeScript({
        target: { tabId },
        func: () => {
          try {
            const raw = localStorage.getItem("anantaWebAuth");
            return raw ? JSON.parse(raw) : null;
          } catch {
            return null;
          }
        },
      })
      .then((results) => {
        const data = results && results[0] && results[0].result;
        if (data && data.accessToken) {
          console.log("[Ananta/bg] Auth read from localStorage via scripting");
          chrome.storage.local.set({ [BG_AUTH_KEY]: data }, () => {
            setTimeout(() => chrome.tabs.remove(tabId), 800);
          });
        }
      })
      .catch((err) => {
        console.warn("[Ananta/bg] scripting.executeScript failed:", err);
      });
  }
});

/* ══════════════════════════════════════════════════════════════════════════
   2.  runtime.onMessage — handle messages from content scripts
══════════════════════════════════════════════════════════════════════════ */

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message.type !== "string") return;

  switch (message.type) {
    /* Content script asks us to close its own tab */
    case "ANANTA_CLOSE_SENDER_TAB": {
      if (sender.tab && sender.tab.id) {
        chrome.tabs.remove(sender.tab.id);
      }
      sendResponse({ ok: true });
      break;
    }

    /* Content script forwards auth data for storage */
    case "ANANTA_STORE_AUTH": {
      const authData = message.authData;
      if (authData && authData.accessToken) {
        chrome.storage.local.set({ [BG_AUTH_KEY]: authData }, () => {
          sendResponse({ ok: true });
        });
        return true; // keep channel open for async sendResponse
      }
      break;
    }

    /* Extension page (settings.js) asks to clear web localStorage in open tabs */
    case "ANANTA_CLEAR_WEB_AUTH_ALL_TABS": {
      const patterns = [
        "http://localhost:8080/ananta/*",
        "http://127.0.0.1:8080/ananta/*",
        "https://devstack-api-dfn8.onrender.com/ananta/*",
      ];
      chrome.tabs.query({ url: patterns }, (tabs) => {
        (tabs || []).forEach((tab) => {
          chrome.tabs
            .sendMessage(tab.id, { type: "ANANTA_CLEAR_WEB_AUTH" })
            .catch(() => {});
        });
      });
      sendResponse({ ok: true });
      break;
    }

    /* Extension page (settings.js) asks to pull auth from open backend tabs */
    case "ANANTA_SYNC_WEB_AUTH_ALL_TABS": {
      const syncPatterns = [
        "http://localhost:8080/ananta/*",
        "http://127.0.0.1:8080/ananta/*",
        "https://devstack-api-dfn8.onrender.com/ananta/*",
      ];
      chrome.tabs.query({ url: syncPatterns }, (tabs) => {
        (tabs || []).forEach((tab) => {
          chrome.tabs
            .sendMessage(tab.id, { type: "ANANTA_SYNC_WEB_AUTH" })
            .catch(() => {});
        });
      });
      sendResponse({ ok: true });
      break;
    }
  }
});
