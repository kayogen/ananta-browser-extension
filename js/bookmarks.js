/**
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
const BM_OPEN_KEY = "openBookmarkFolders";
const BM_MAX_DEPTH = 6;

/* ── State ───────────────────────────────────────────────────────────────── */
let _rootFolders = [];
let _activeFolder = null;
let _openFolders = new Set();
let _flatBookmarks = [];
let _tabsExpanded = false; // header: show only active tab by default
/* ── Persistence ─────────────────────────────────────────────────────────── */
function _loadPrefs() {
  try {
    _activeFolder = localStorage.getItem(BM_STORAGE_KEY) || null;
    const raw = localStorage.getItem(BM_OPEN_KEY);
    _openFolders = raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    /* ignore */
  }
}

function _savePrefs() {
  try {
    if (_activeFolder) localStorage.setItem(BM_STORAGE_KEY, _activeFolder);
    localStorage.setItem(BM_OPEN_KEY, JSON.stringify([..._openFolders]));
  } catch {
    /* ignore */
  }
}

/* ── Fetch tree ──────────────────────────────────────────────────────────── */
async function _fetchBmTree() {
  if (!browserAPI || !browserAPI.bookmarks) return [];
  try {
    return await browserAPI.bookmarks.getTree();
  } catch (e) {
    console.warn("[Ananta/bookmarks] getTree:", e);
    return [];
  }
}

/* ── Flatten all bookmarks (search index) ────────────────────────────────── */
function _flattenNode(node, out) {
  if (node.url && node.title) out.push({ title: node.title, url: node.url });
  if (node.children) node.children.forEach((c) => _flattenNode(c, out));
}

/* ── Find the Bookmarks Toolbar node in the tree ───────────────────────────── */
function _findToolbarNode(tree) {
  for (const root of tree) {
    if (!root.children) continue;
    for (const child of root.children) {
      const t = (child.title || "").toLowerCase();
      // Chrome: "Bookmarks bar" (id:"1") — Firefox: "Bookmarks Toolbar" (id:"toolbar_____")
      if (
        t === "bookmarks bar" ||
        t === "bookmarks toolbar" ||
        child.id === "1" ||
        child.id === "toolbar_____"
      ) {
        return child;
      }
    }
  }
  return null;
}

/* ── Extract root folders — prefer Bookmarks Toolbar children ──────────────── */
function _extractRoots(tree) {
  // First try: sub-folders of the Bookmarks Toolbar
  const toolbar = _findToolbarNode(tree);
  if (toolbar && toolbar.children) {
    const folders = toolbar.children.filter((c) => Array.isArray(c.children));
    if (folders.length > 0) return folders;
    // Toolbar has no sub-folders — treat toolbar itself as the sole root
    if (toolbar.children.length > 0) return [toolbar];
  }
  // Fallback: all named children of synthetic root that have sub-children
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

/* ── Build a single folder tab button ────────────────────────────────────── */
function _mkTab(folder, container, roots) {
  const btn = document.createElement("button");
  btn.className = "bm-tab" + (folder.id === _activeFolder ? " is-active" : "");
  btn.setAttribute("role", "tab");
  btn.setAttribute(
    "aria-selected",
    folder.id === _activeFolder ? "true" : "false",
  );
  btn.dataset.folderId = folder.id;
  btn.title = folder.title;

  const lbl = document.createElement("span");
  lbl.textContent = folder.title;
  btn.appendChild(lbl);

  btn.addEventListener("click", () => {
    if (folder.id !== _activeFolder) {
      _activeFolder = folder.id;
      _savePrefs();
      const tc = document.getElementById("bmTree");
      if (tc) _renderTree(tc, folder);
    }
    // Collapse tabs back to active-only view after selection
    _tabsExpanded = false;
    _renderTabs(container, roots);
  });
  return btn;
}

/* ── Folder tabs — pinned active + pinned toggle + collapsible rest ─────────── */
function _renderTabs(container, roots) {
  container.innerHTML = "";

  const activeFolder = roots.find((f) => f.id === _activeFolder) || roots[0];
  const otherFolders = roots.filter(
    (f) => f.id !== (activeFolder && activeFolder.id),
  );

  container.classList.toggle("is-expanded", _tabsExpanded);

  // 1. Always-pinned: active tab (leftmost)
  if (activeFolder) {
    container.appendChild(_mkTab(activeFolder, container, roots));
  }

  // 2. Always-pinned: toggle button (only if other folders exist)
  if (otherFolders.length > 0) {
    const toggleBtn = document.createElement("button");
    toggleBtn.className = "bm-tabs-toggle";
    toggleBtn.title = _tabsExpanded ? "Collapse folders" : "Show all folders";
    toggleBtn.setAttribute(
      "aria-label",
      _tabsExpanded ? "Collapse" : "Expand folders",
    );
    // Right arrow when collapsed (more folders available), left arrow when expanded
    setSvg(
      toggleBtn,
      !_tabsExpanded
        ? `<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="#000000"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path fill="#797979" d="M2,3 C2.55228475,3 3,3.44771525 3,4 L3,12 C3,12.5522847 2.55228475,13 2,13 C1.44771525,13 1,12.5522847 1,12 L1,4 C1,3.44771525 1.44771525,3 2,3 Z M10.2929,4.29289 C10.6834,3.90237 11.3166,3.90237 11.7071,4.29289 L15.4142,8 L11.7071,11.7071 C11.3166,12.0976 10.6834,12.0976 10.2929,11.7071 C9.90237,11.3166 9.90237,10.6834 10.2929,10.2929 L11.5858,9 L5,9 C4.44772,9 4,8.55229 4,8 C4,7.44772 4.44772,7 5,7 L11.5858,7 L10.2929,5.70711 C9.90237,5.31658 9.90237,4.68342 10.2929,4.29289 Z"></path> </g></svg>`
        : `<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="#000000"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path fill="#797979" d="M14.004207,3 C14.556507,3 15.004207,3.44772 15.004207,4 L15.004207,12 C15.004207,12.5523 14.556507,13 14.004207,13 C13.451907,13 13.004207,12.5523 13.004207,12 L13.004207,4 C13.004207,3.44772 13.451907,3 14.004207,3 Z M4.297107,4.29289 C4.687627,3.90237 5.320797,3.90237 5.711317,4.29289 C6.101847,4.68342 6.101847,5.31658 5.711317,5.70711 L4.418427,7 L11.004207,7 C11.556507,7 12.004207,7.44772 12.004207,8 C12.004207,8.55229 11.556507,9 11.004207,9 L4.418427,9 L5.711317,10.2929 C6.101847,10.6834 6.101847,11.3166 5.711317,11.7071 C5.320797,12.0976 4.687627,12.0976 4.297107,11.7071 L0.59,8 L4.297107,4.29289 Z"></path> </g></svg>`,
    );
    toggleBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      _tabsExpanded = !_tabsExpanded;
      _renderTabs(container, roots);
    });
    container.appendChild(toggleBtn);
  }

  // 3. Collapsible: remaining (non-active) folders, shown only when expanded
  if (_tabsExpanded) {
    for (const folder of otherFolders) {
      container.appendChild(_mkTab(folder, container, roots));
    }
  }
}

/* ── Spring height estimate ──────────────────────────────────────────────── */
function _estHeight(folder) {
  let n = 0;
  function walk(node, d) {
    if (d > BM_MAX_DEPTH) return;
    for (const c of node.children || []) {
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

  for (const child of node.children || []) {
    if (!child.title) continue;
    const li = document.createElement("li");
    li.setAttribute("role", "treeitem");

    if (child.children !== undefined) {
      li.setAttribute(
        "aria-expanded",
        _openFolders.has(child.id) ? "true" : "false",
      );
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
  chev.className =
    "bm-chevron" + (_openFolders.has(folder.id) ? " is-open" : "");
  chev.setAttribute("aria-hidden", "true");
  chev.innerHTML =
    '<svg viewBox="0 0 10 10" fill="currentColor"><path d="M3 2l4 3-4 3V2z"/></svg>';
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
    if (nowOpen) _openFolders.add(folder.id);
    else _openFolders.delete(folder.id);
    _savePrefs();
    li.setAttribute("aria-expanded", nowOpen ? "true" : "false");
    chev.classList.toggle("is-open", nowOpen);
    if (sub) {
      const from = parseFloat(sub.style.maxHeight) || 0;
      const to = nowOpen ? _estHeight(folder) : 0;
      AnantaPhysics.spring({
        from,
        to,
        stiffness: 160,
        damping: 18,
        mass: 1,
        precision: 0.5,
        onUpdate(v) {
          sub.style.maxHeight = Math.max(0, v).toFixed(1) + "px";
        },
        onComplete() {
          sub.style.maxHeight = nowOpen ? to + "px" : "0px";
        },
      });
    }
  }

  row.addEventListener("click", toggle);
  row.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggle();
    }
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
  row.addEventListener("click", (e) => {
    e.preventDefault();
    window.location.href = bm.url;
  });

  // Chevron-column spacer
  const spc = document.createElement("span");
  spc.style.cssText = "width:16px;flex-shrink:0";
  spc.setAttribute("aria-hidden", "true");
  row.appendChild(spc);

  // Favicon — DDG → Google → letter badge via icons.js
  const img = document.createElement("img");
  img.className = "bm-favicon";
  img.alt = "";
  img.width = 14;
  img.height = 14;
  img.decoding = "async";
  const immediate = AnantaIcons.getIconSync(bm.url, 28, (resolved) => {
    img.src = resolved;
  });
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
  if (tree) {
    tree.classList.add("spring-appear-up");
    container.appendChild(tree);
  }
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
  rawTree.forEach((r) => _flattenNode(r, _flatBookmarks));

  _rootFolders = _extractRoots(rawTree);
  if (_rootFolders.length === 0) {
    treeEl.innerHTML = '<div class="bm-empty">No bookmark folders found.</div>';
    return _flatBookmarks;
  }

  // Validate stored selection
  const ids = new Set(_rootFolders.map((f) => f.id));
  if (!_activeFolder || !ids.has(_activeFolder)) {
    _activeFolder = _rootFolders[0].id;
  }

  _renderTabs(tabsEl, _rootFolders);
  const active =
    _rootFolders.find((f) => f.id === _activeFolder) || _rootFolders[0];
  _renderTree(treeEl, active);

  return _flatBookmarks;
}
