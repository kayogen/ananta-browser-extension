/* ══════════════════════════════════════════════════════════════════════════
   settings.js — Settings gear button & compact menu
   Ananta New Tab · auth-aware, glass-morphism design
══════════════════════════════════════════════════════════════════════════ */

"use strict";

/* ── Constants ──────────────────────────────────────────────────────────── */
const STG_AUTH_KEY = "anantaAuth"; // chrome.storage.local key
const STG_API_BASE = "http://localhost:8080/api";
const STG_LOGIN_URL = "http://localhost:8080/ananta/login";
const STG_ACCT_URL = "http://localhost:8080/ananta/account-settings";

/* ── Internal state ─────────────────────────────────────────────────────── */
const _stg = {
  isOpen: false,
  authState: null, // null = unknown / not loaded; { name, email, ... } or false
  syncing: false,
};

/* ── DOM refs ────────────────────────────────────────────────────────────── */
let $openBtn, $menu, $closeBtn;
let $userRow, $avatar, $userName, $userEmail;
let $authItems, $guestItems;
let $accountBtn, $syncBtn, $logoutBtn, $loginBtn;

/* ── Storage helpers ─────────────────────────────────────────────────────── */

/**
 * Read auth state from chrome.storage.local (MV3) or localStorage fallback.
 * Resolves to auth object when logged in, or false when logged out.
 */
function _readAuth() {
  return new Promise((resolve) => {
    if (
      typeof chrome !== "undefined" &&
      chrome.storage &&
      chrome.storage.local
    ) {
      chrome.storage.local.get(STG_AUTH_KEY, (result) => {
        const data = result && result[STG_AUTH_KEY];
        resolve(data || false);
      });
    } else {
      // Fallback: localStorage (dev / non-extension context)
      try {
        const raw = localStorage.getItem(STG_AUTH_KEY);
        resolve(raw ? JSON.parse(raw) : false);
      } catch {
        resolve(false);
      }
    }
  });
}

/**
 * Persist / clear auth state.
 * @param {Object|false} data  – user object or false to clear
 */
function _writeAuth(data) {
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
    if (data) {
      chrome.storage.local.set({ [STG_AUTH_KEY]: data });
    } else {
      chrome.storage.local.remove(STG_AUTH_KEY);
    }
  } else {
    try {
      if (data) {
        localStorage.setItem(STG_AUTH_KEY, JSON.stringify(data));
      } else {
        localStorage.removeItem(STG_AUTH_KEY);
      }
    } catch {}
  }
}

/* ── UI rendering ────────────────────────────────────────────────────────── */

/**
 * Apply current auth state to the menu DOM.
 */
function _renderAuthState(user) {
  const loggedIn = Boolean(user);

  /* Show/hide logged-in vs guest sections */
  $authItems.forEach((el) => {
    el.hidden = !loggedIn;
  });
  $guestItems.forEach((el) => {
    el.hidden = loggedIn;
  });

  /* User info row */
  $userRow.hidden = !loggedIn;
  if (loggedIn) {
    const name = user.name || "Ananta User";
    const email = user.email || "";
    $userName.textContent = name;
    $userEmail.textContent = email;

    if (user.profileImage) {
      $avatar.innerHTML = "";
      $avatar.textContent = "";
      const img = document.createElement("img");
      img.src = user.profileImage;
      img.alt = name;
      img.style.cssText =
        "width:100%;height:100%;object-fit:cover;border-radius:50%";
      $avatar.appendChild(img);
    } else {
      $avatar.innerHTML = "";
      $avatar.textContent = name.charAt(0).toUpperCase();
    }
  }
}

/* ── Open / close ───────────────────────────────────────────────────────── */

async function _openMenu() {
  if (_stg.isOpen) return;
  _stg.isOpen = true;

  /* Re-read auth every time the menu opens (catches web-app login) */
  const user = await _readAuth();
  _stg.authState = user;
  _renderAuthState(user);

  $menu.setAttribute("aria-hidden", "false");
  $openBtn.setAttribute("aria-expanded", "true");
  $openBtn.classList.add("is-active");

  $closeBtn.focus();
}

function _closeMenu() {
  if (!_stg.isOpen) return;
  _stg.isOpen = false;

  $menu.setAttribute("aria-hidden", "true");
  $openBtn.setAttribute("aria-expanded", "false");
  $openBtn.classList.remove("is-active");

  $openBtn.focus();
}

function _toggleMenu() {
  if (_stg.isOpen) {
    _closeMenu();
  } else {
    _openMenu();
  }
}

/* ── Action handlers ─────────────────────────────────────────────────────── */

function _handleAccountSettings() {
  const auth = _stg.authState;
  let url = STG_ACCT_URL;

  // Pass token via URL hash so account-settings page can authenticate
  if (auth && auth.accessToken) {
    url += `#token=${auth.accessToken}`;
  }

  if (typeof chrome !== "undefined" && chrome.tabs) {
    chrome.tabs.create({ url });
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
  _closeMenu();
}

async function _handleSync() {
  if (_stg.syncing) return;
  if (!_stg.authState || !_stg.authState.accessToken) return;

  if (typeof AnantaSync === "undefined") {
    console.warn("[Ananta/settings] Sync module not loaded.");
    return;
  }

  _stg.syncing = true;

  const badge = $syncBtn.querySelector(".stg-badge");
  if (badge) {
    badge.textContent = "Syncing…";
    badge.style.opacity = "1";
  }

  try {
    const result = await AnantaSync.smartSync();
    const pulledCount = result.pulled?.length || 0;
    const pushedCount = result.pushed?.length || 0;
    const conflictCount = result.conflicts?.length || 0;

    if (badge) {
      badge.textContent = "Done!";
      setTimeout(() => {
        badge.textContent = "Sync";
        badge.style.opacity = "";
      }, 2000);
    }

    if (pulledCount > 0 || conflictCount > 0) {
      setTimeout(() => location.reload(), 2200);
    }
  } catch (err) {
    console.error("[Ananta/settings] Sync failed:", err);
    if (badge) {
      badge.textContent = "Failed";
      setTimeout(() => {
        badge.textContent = "Sync";
        badge.style.opacity = "";
      }, 2000);
    }
  } finally {
    _stg.syncing = false;
  }
}

async function _handleLogout() {
  const auth = _stg.authState;

  // Call logout API to blacklist the token
  if (auth && auth.accessToken) {
    try {
      await fetch(`${STG_API_BASE}/auth/logout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${auth.accessToken}`,
        },
      });
    } catch {
      // Continue clearing local state even if API call fails
    }
  }

  // Tell background script to clear anantaWebAuth in any open backend tabs.
  // Without this the content script would re-sync the stale token on next visit.
  try {
    chrome.runtime.sendMessage({ type: "ANANTA_CLEAR_WEB_AUTH_ALL_TABS" });
  } catch {}

  _writeAuth(false);
  _stg.authState = false;
  _renderAuthState(false);
  _closeMenu();
}

function _handleLogin() {
  const openLogin = () => {
    if (typeof chrome !== "undefined" && chrome.tabs) {
      chrome.tabs.create({ url: STG_LOGIN_URL });
    } else {
      window.open(STG_LOGIN_URL, "_blank", "noopener,noreferrer");
    }
    _closeMenu();
  };

  // Firefox MV3 treats host_permissions as optional.
  // Request them now (user gesture required) so the content script and
  // background script can access the backend pages.
  if (
    typeof chrome !== "undefined" &&
    chrome.permissions &&
    chrome.permissions.request
  ) {
    chrome.permissions.request(
      {
        origins: ["http://localhost:8080/*", "http://127.0.0.1:8080/*"],
      },
      (_granted) => {
        // Open regardless — the permission prompt may have been dismissed
        openLogin();
      },
    );
  } else {
    openLogin();
  }
}

/* ── Keyboard & outside-click dismissal ─────────────────────────────────── */

function _onDocumentKeydown(e) {
  if (_stg.isOpen && e.key === "Escape") {
    e.stopPropagation();
    _closeMenu();
  }
}

function _onDocumentPointerdown(e) {
  if (!_stg.isOpen) return;
  // Close if click is outside both the menu and the open button
  if (
    !$menu.contains(e.target) &&
    e.target !== $openBtn &&
    !$openBtn.contains(e.target)
  ) {
    _closeMenu();
  }
}

/* ── Storage change listener (catches remote login from web-app tab) ─────── */

function _listenStorageChanges() {
  /* chrome.storage.onChanged — fires when content script writes auth */
  if (
    typeof chrome !== "undefined" &&
    chrome.storage &&
    chrome.storage.onChanged
  ) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local" || !changes[STG_AUTH_KEY]) return;
      const newVal = changes[STG_AUTH_KEY].newValue || false;
      _stg.authState = newVal;
      _renderAuthState(newVal);
    });
  }

  /* localStorage — for dev/non-extension context */
  window.addEventListener("storage", (e) => {
    if (e.key !== STG_AUTH_KEY) return;
    let parsed = false;
    try {
      parsed = e.newValue ? JSON.parse(e.newValue) : false;
    } catch {}
    _stg.authState = parsed;
    if (_stg.isOpen) _renderAuthState(parsed);
  });
}

/* ── Public API ──────────────────────────────────────────────────────────── */

/**
 * Call once during boot to wire up the settings button and menu.
 */
function initSettings() {
  /* Grab DOM refs */
  $openBtn = document.getElementById("settingsOpenBtn");
  $menu = document.getElementById("settingsMenu");
  $closeBtn = document.getElementById("settingsCloseBtn");
  $userRow = document.getElementById("stgUserRow");
  $avatar = document.getElementById("stgAvatar");
  $userName = document.getElementById("stgUserName");
  $userEmail = document.getElementById("stgUserEmail");
  $accountBtn = document.getElementById("stgAccountBtn");
  $syncBtn = document.getElementById("stgSyncBtn");
  $logoutBtn = document.getElementById("stgLogoutBtn");
  $loginBtn = document.getElementById("stgLoginBtn");

  $authItems = Array.from(document.querySelectorAll(".stg-auth-only"));
  $guestItems = Array.from(document.querySelectorAll(".stg-guest-only"));

  if (!$openBtn || !$menu) {
    console.warn("[Ananta/settings] Required DOM elements not found.");
    return;
  }

  // Update sync badge based on auth state
  _readAuth().then((auth) => {
    if (auth && $syncBtn) {
      const badge = $syncBtn.querySelector(".stg-badge");
      if (badge) badge.textContent = "Sync";
    }
  });

  // Proactively pull auth from any open backend tab via background script
  try {
    chrome.runtime.sendMessage({ type: "ANANTA_SYNC_WEB_AUTH_ALL_TABS" });
  } catch {}

  /* Wire events */
  $openBtn.addEventListener("click", _toggleMenu);
  $closeBtn.addEventListener("click", _closeMenu);
  $accountBtn.addEventListener("click", _handleAccountSettings);
  $syncBtn.addEventListener("click", _handleSync);
  $logoutBtn.addEventListener("click", _handleLogout);
  $loginBtn.addEventListener("click", _handleLogin);

  document.addEventListener("keydown", _onDocumentKeydown, { capture: true });
  document.addEventListener("pointerdown", _onDocumentPointerdown);

  /* Listen for auth changes from other tabs / background */
  _listenStorageChanges();
}
