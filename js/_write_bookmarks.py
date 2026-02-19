"""Writes the new bookmarks.js for Ananta (VS Code Explorer style)."""
import os, pathlib

TARGET = pathlib.Path(__file__).parent / "bookmarks.js"

JS = r'''/**
 * bookmarks.js — VS Code Explorer-style bookmark tree for Ananta
 *
 * Layout:
 *   - Horizontal folder tabs (root folders as pills)
 *   - Collapsible subtree per folder (spring-animated height)
 *   - localStorage persists selected folder + open state per folder
 *
 * Exposes:
 *   initBookmarks() → Promise<{title,url}[]>  flat list for search.js
 */

"use strict";

/* ── Constants ───────────────────────────────────────────────────────────── */
const BM_STORAGE_KEY = "selectedBookmarkFolder";
const BM_OPEN_KEY    = "openBookmarkFolders";
const BM_MAX_DEPTH   = 6;

/* ── State ───────────────────────────────────────────────────────────────── */
let _rootFolders   = [];
let _activeFolder  = null;
let _openFolders   = new Set();
let _flatBookmarks = [];

/* ── Persistence ─────────────────────────────────────────────────────────── */
function _loadPrefs() {
  try {
    _activeFolder = localStorage.getItem(BM_STORAGE_KEY) || null;
    const raw = localStorage.getItem(BM_OPEN_KEY);
    _openFolders = raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { /* ignore */ }
}

function _savePrefs() {
  try {
    if (_activeFolder) localStorage.setItem(BM_STORAGE_KEY, _activeFolder);
    localStorage.setItem(BM_OPEN_KEY, JSON.stringify([..._openFolders]));
  } catch { /* ignore */ }
}

/* ── Fetch tree ──────────────────────────────────────────────────────────── */
async function _fetchBmTree() {
  if (!browserAPI || !browserAPI.bookmarks) return [];
  try { return await browserAPI.bookmarks.getTree(); }
  catch (e) { console.warn("[Ananta/bookmarks] getTree:", e); return []; }
}

/* ── Flatten all bookmarks (search index) ────────────────────────────────── */
function _flattenNode(node, out) {
  if (node.url && node.title) out.push({ title: node.title, url: node.url });
  if (node.children) node.children.forEach(c => _flattenNode(c, out));
}

/* ── Extract named root folders ──────────────────────────────────────────── */
function _extractRoots(tree) {
  const roots = [];
  for (const root of tree) {
    if (root.children) {
      for (const child of root.children) {
        if (child.children && child.children.length > 0) roots.push(child);
      }
    }
  }
  return roots;
}

/* ── Folder tabs ─────────────────────────────────────────────────────────── */
function _renderTabs(container, roots) {
  container.innerHTML = "";
  for (const folder of roots) {
    const btn = document.createElement("button");
    btn.className = "bm-tab" + (folder.id === _activeFolder ? " is-active" : "");
    btn.setAttribute("role", "tab");
    btn.setAttribute("aria-selected", folder.id === _activeFolder ? "true" : "false");
    btn.dataset.folderId = folder.id;
    btn.title = folder.title;
    const icon = document.createElement("span");
    icon.className = "bm-tab-icon"; icon.textContent = "▸";
    const lbl = document.createElement("span"); lbl.textContent = folder.title;
    btn.append(icon, lbl);
    btn.addEventListener("click", () => {
      _activeFolder = folder.id; _savePrefs();
      container.querySelectorAll(".bm-tab").forEach(t => {
        const active = t.dataset.folderId === folder.id;
        t.classList.toggle("is-active", active);
        t.setAttribute("aria-selected", active ? "true" : "false");
      });
      const tc = document.getElementById("bmTree");
      if (tc) _renderTree(tc, folder);
    });
    container.appendChild(btn);
  }
}

/* ── Spring height estimate ──────────────────────────────────────────────── */
function _estHeight(folder) {
  let n = 0;
  function walk(node, d) {
    if (d > BM_MAX_DEPTH) return;
    for (const c of (node.children || [])) {
      n++;
      if (c.children && _openFolders.has(c.id)) walk(c, d + 1);
    }
  }
  walk(folder, 0);
  return n * 30 + 8;
}

/* ── Build <ul> tree ─────────────────────────────────────────────────────── */
function _buildTree(node, depth) {
  if (depth > BM_MAX_DEPTH) return null;
  const ul = document.createElement("ul");
  ul.className = depth === 0 ? "bm-tree" : "bm-subtree";
  ul.setAttribute("role", "group");

  for (const child of (node.children || [])) {
    if (!child.title) continue;
    const li = document.createElement("li");
    li.setAttribute("role", "treeitem");

    if (child.children !== undefined) {
      li.setAttribute("aria-expanded", _openFolders.has(child.id) ? "true" : "false");
      li.appendChild(_buildFolderRow(child, depth));
      if (child.children.length > 0) {
        const sub = _buildTree(child, depth + 1);
        if (sub) {
          const open = _openFolders.has(child.id);
          sub.style.maxHeight = open ? _estHeight(child) + "px" : "0px";
          sub.style.overflow = "hidden";
          li.appendChild(sub);
        }
      }
    } else if (child.url) {
      li.appendChild(_buildItemRow(child, depth));
    }
    ul.appendChild(li);
  }
  return ul;
}

/* ── Folder row ──────────────────────────────────────────────────────────── */
function _buildFolderRow(folder, depth) {
  const row = document.createElement("div");
  row.className = "bm-row bm-folder-row";
  row.style.setProperty("--depth", depth);
  row.setAttribute("role", "button");
  row.setAttribute("tabindex", "0");
  row.title = folder.title;

  const chev = document.createElement("span");
  chev.className = "bm-chevron" + (_openFolders.has(folder.id) ? " is-open" : "");
  chev.setAttribute("aria-hidden", "true");
  chev.innerHTML = '<svg viewBox="0 0 10 10" fill="currentColor"><path d="M3 2l4 3-4 3V2z"/></svg>';
  row.appendChild(chev);

  const ico = document.createElement("span");
  ico.className = "bm-folder-icon";
  ico.setAttribute("aria-hidden", "true");
  ico.textContent = "⌗";
  row.appendChild(ico);

  const lbl = document.createElement("span");
  lbl.className = "bm-label";
  lbl.textContent = folder.title;
  row.appendChild(lbl);

  if (folder.children && folder.children.length > 0) {
    const badge = document.createElement("span");
    badge.className = "bm-count";
    badge.textContent = folder.children.length;
    row.appendChild(badge);
  }

  function toggle() {
    const li = row.parentElement;
    const sub = li.querySelector(":scope > ul.bm-subtree");
    const nowOpen = !_openFolders.has(folder.id);
    if (nowOpen) _openFolders.add(folder.id); else _openFolders.delete(folder.id);
    _savePrefs();
    li.setAttribute("aria-expanded", nowOpen ? "true" : "false");
    chev.classList.toggle("is-open", nowOpen);
    if (sub) {
      const from = parseFloat(sub.style.maxHeight) || 0;
      const to = nowOpen ? _estHeight(folder) : 0;
      AnantaPhysics.spring({
        from, to, stiffness: 160, damping: 18, mass: 1, precision: 0.5,
        onUpdate(v) { sub.style.maxHeight = Math.max(0, v).toFixed(1) + "px"; },
        onComplete() { sub.style.maxHeight = nowOpen ? to + "px" : "0px"; },
      });
    }
  }

  row.addEventListener("click", toggle);
  row.addEventListener("keydown", e => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); }
  });
  return row;
}

/* ── Bookmark link row ───────────────────────────────────────────────────── */
function _buildItemRow(bm, depth) {
  const row = document.createElement("a");
  row.className = "bm-row bm-item-row";
  row.style.setProperty("--depth", depth);
  row.href = bm.url;
  row.title = bm.title + "\n" + bm.url;
  row.rel = "noopener noreferrer";
  row.addEventListener("click", e => { e.preventDefault(); window.location.href = bm.url; });

  // Chevron-column spacer
  const spc = document.createElement("span");
  spc.style.cssText = "width:16px;flex-shrink:0";
  spc.setAttribute("aria-hidden", "true");
  row.appendChild(spc);

  // Favicon — DDG → Google → letter badge via icons.js
  const img = document.createElement("img");
  img.className = "bm-favicon";
  img.alt = ""; img.width = 14; img.height = 14; img.decoding = "async";
  const immediate = AnantaIcons.getIconSync(bm.url, 28, resolved => { img.src = resolved; });
  img.src = immediate;
  img.onerror = () => {
    img.src = AnantaIcons.letterBadge(AnantaIcons.extractDomain(bm.url), 28);
  };
  row.appendChild(img);

  const lbl = document.createElement("span");
  lbl.className = "bm-label";
  lbl.textContent = bm.title;
  row.appendChild(lbl);

  return row;
}

/* ── Render tree for a given folder ─────────────────────────────────────── */
function _renderTree(container, folder) {
  container.innerHTML = "";
  if (!folder || !folder.children || folder.children.length === 0) {
    const empty = document.createElement("div");
    empty.className = "bm-empty";
    empty.textContent = "This folder is empty.";
    container.appendChild(empty);
    return;
  }
  const tree = _buildTree(folder, 0);
  if (tree) { tree.classList.add("spring-appear-up"); container.appendChild(tree); }
}

/* ── Public: init ────────────────────────────────────────────────────────── */
/**
 * Initialise the bookmark panel.
 * @returns {Promise<{title:string,url:string}[]>} flat list for search.js
 */
async function initBookmarks() {
  const tabsEl = document.getElementById("bmFolderTabs");
  const treeEl = document.getElementById("bmTree");
  if (!tabsEl || !treeEl) return [];

  // Show skeleton while loading
  treeEl.innerHTML = `
    <div class="bm-skeleton-row skeleton" style="width:65%"></div>
    <div class="bm-skeleton-row skeleton" style="width:50%"></div>
    <div class="bm-skeleton-row skeleton" style="width:75%"></div>`;

  _loadPrefs();
  const rawTree = await _fetchBmTree();

  if (!rawTree.length) {
    treeEl.innerHTML = '<div class="bm-empty">Bookmarks unavailable.</div>';
    return [];
  }

  // Build flat list
  _flatBookmarks = [];
  rawTree.forEach(r => _flattenNode(r, _flatBookmarks));

  _rootFolders = _extractRoots(rawTree);
  if (_rootFolders.length === 0) {
    treeEl.innerHTML = '<div class="bm-empty">No bookmark folders found.</div>';
    return _flatBookmarks;
  }

  // Validate stored selection
  const ids = new Set(_rootFolders.map(f => f.id));
  if (!_activeFolder || !ids.has(_activeFolder)) {
    _activeFolder = _rootFolders[0].id;
  }

  _renderTabs(tabsEl, _rootFolders);
  const active = _rootFolders.find(f => f.id === _activeFolder) || _rootFolders[0];
  _renderTree(treeEl, active);

  return _flatBookmarks;
}
'''

TARGET.write_text(JS, encoding="utf-8")
print(f"Wrote {len(JS)} chars / {JS.count(chr(10))} lines to {TARGET}")
