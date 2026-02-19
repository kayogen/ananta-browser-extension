/* ══════════════════════════════════════════════════════════════════════════
   finder.js — Finder column-view bookmark browser
   macOS Finder Miller Columns navigation
══════════════════════════════════════════════════════════════════════════ */

"use strict";

// ─── State ─────────────────────────────────────────────────────────────────
let _bookmarkTree = null; // raw tree from API
let _columnStack = []; // array of {node, selectedId} per depth

// ─── Fetch bookmark tree ──────────────────────────────────────────────────────
async function _fetchTree() {
  if (!browserAPI || !browserAPI.bookmarks) return null;
  try {
    const [root] = await browserAPI.bookmarks.getTree();
    return root;
  } catch (err) {
    console.error("[Ananta/finder] getTree failed:", err);
    return null;
  }
}

// ─── Colour palette for folder letter badges ─────────────────────────────────
const DOMAIN_COLORS = [
  "#007aff",
  "#34c759",
  "#ff9500",
  "#ff3b30",
  "#af52de",
  "#ff2d55",
  "#5ac8fa",
  "#4cd964",
  "#ffcc00",
  "#ff6b35",
];

function _colorForString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return DOMAIN_COLORS[Math.abs(hash) % DOMAIN_COLORS.length];
}

// ─── SVG icons ────────────────────────────────────────────────────────────────
const SVG_FOLDER =
  `<svg viewBox="0 0 20 20" fill="currentColor">` +
  `<path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"/>` +
  `</svg>`;

const SVG_CHEVRON =
  `<svg viewBox="0 0 20 20" fill="currentColor">` +
  `<path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd"/>` +
  `</svg>`;

const SVG_BOOKMARK =
  `<svg viewBox="0 0 20 20" fill="currentColor">` +
  `<path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z"/>` +
  `</svg>`;

// ─── Build one column DOM element ─────────────────────────────────────────────
function _buildColumn(nodes, depth) {
  const col = document.createElement("div");
  col.className = "finder-column";
  col.dataset.depth = depth;

  if (!nodes || nodes.length === 0) {
    const empty = document.createElement("div");
    empty.className = "finder-empty";
    empty.textContent = "Empty folder";
    col.appendChild(empty);
    return col;
  }

  const frag = document.createDocumentFragment();

  nodes.forEach((node) => {
    const isFolder = !!node.children;
    const item = document.createElement(isFolder ? "div" : "a");

    if (!isFolder) {
      item.href = node.url;
      item.rel = "noopener noreferrer";
      item.addEventListener("click", (e) => {
        e.preventDefault();
        window.location.href = node.url;
      });
    }

    item.className = "finder-item";
    item.dataset.nodeId = node.id;
    item.setAttribute("role", "row");
    item.tabIndex = 0;
    item.setAttribute(
      "aria-label",
      node.title || (isFolder ? "Folder" : node.url),
    );

    // ── Icon
    const iconWrap = document.createElement("div");
    iconWrap.className = "finder-item-icon";

    if (isFolder) {
      iconWrap.style.color = _colorForString(node.title || node.id);
      setSvg(iconWrap, SVG_FOLDER);
    } else {
      // Favicon
      const faviconSrc = getFavicon(node.url, 28);
      if (faviconSrc) {
        const img = document.createElement("img");
        img.className = "finder-favicon";
        img.src = faviconSrc;
        img.alt = "";
        img.width = 14;
        img.height = 14;
        img.decoding = "async";
        img.onerror = () => {
          img.replaceWith(_createBookmarkIcon());
        };
        iconWrap.appendChild(img);
      } else {
        setSvg(iconWrap, SVG_BOOKMARK);
        iconWrap.style.color = "var(--color-text-tertiary)";
      }
    }
    item.appendChild(iconWrap);

    // ── Label
    const name = document.createElement("span");
    name.className = "finder-item-name";
    name.textContent =
      node.title || (isFolder ? "Unnamed Folder" : cleanDomain(node.url));
    item.appendChild(name);

    // ── Chevron (folders only)
    if (isFolder) {
      const chev = document.createElement("div");
      chev.className = "finder-chevron";
      setSvg(chev, SVG_CHEVRON);
      item.appendChild(chev);
    }

    // ── Events
    item.addEventListener("click", () => _selectItem(item, node, depth));
    item.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        _selectItem(item, node, depth);
      }
      if (e.key === "ArrowRight" && isFolder) {
        // Focus into next column
        const container = document.getElementById("finderColumns");
        const nextCol = container.querySelector(
          `.finder-column[data-depth="${depth + 1}"]`,
        );
        if (nextCol) {
          const first = nextCol.querySelector(".finder-item");
          if (first) first.focus();
        }
      }
      if (e.key === "ArrowLeft" && depth > 0) {
        const container = document.getElementById("finderColumns");
        const prevCol = container.querySelector(
          `.finder-column[data-depth="${depth - 1}"]`,
        );
        if (prevCol) {
          const selected = prevCol.querySelector(".finder-item.is-selected");
          if (selected) selected.focus();
        }
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const siblings = Array.from(
          item.closest(".finder-column").querySelectorAll(".finder-item"),
        );
        const idx = siblings.indexOf(item);
        const next = siblings[idx + (e.key === "ArrowDown" ? 1 : -1)];
        if (next) next.focus();
      }
    });

    frag.appendChild(item);
  });

  col.appendChild(frag);
  return col;
}

function _createBookmarkIcon() {
  const el = document.createElement("div");
  el.className = "finder-item-icon";
  el.style.color = "var(--color-text-tertiary)";
  setSvg(el, SVG_BOOKMARK);
  return el;
}

// ─── Select item handler ──────────────────────────────────────────────────────
function _selectItem(itemEl, node, depth) {
  const container = document.getElementById("finderColumns");
  if (!container) return;

  // Mark selected in current column
  const col = itemEl.closest(".finder-column");
  if (col) {
    col
      .querySelectorAll(".finder-item.is-selected")
      .forEach((el) => el.classList.remove("is-selected"));
    itemEl.classList.add("is-selected");
  }

  // Remove columns deeper than current depth + 1
  const allCols = Array.from(container.querySelectorAll(".finder-column"));
  allCols.forEach((c) => {
    if (Number(c.dataset.depth) > depth) c.remove();
  });

  // If folder: push new column
  if (node.children) {
    const childrenToShow = node.children.filter(
      (c) => c.title || c.url, // skip empty separators
    );
    const newCol = _buildColumn(childrenToShow, depth + 1);
    container.appendChild(newCol);

    // Scroll the strip to show the new column
    requestAnimationFrame(() => {
      container.scrollLeft = container.scrollWidth;
    });
  }
}

// ─── Get root folders (skip the invisible root) ───────────────────────────────
function _getRootChildren(tree) {
  // Browser bookmark tree has 1-2 invisible root nodes
  // We want the actual user-facing folders
  const roots = [];
  function walk(node) {
    if (!node.children) return;
    node.children.forEach((child) => {
      if (child.children) {
        // If this node has a title it's a real folder
        if (child.title || child.children.length > 0) {
          roots.push(child);
        }
      }
    });
  }
  // Visit top root children
  if (tree.children) {
    tree.children.forEach((child) => {
      if (child.children) {
        child.children.forEach((c) => roots.push(c));
      }
    });
  }
  return roots;
}

// ─── Public init ────────────────────────────────────────────────────────────
async function initFinder() {
  const container = document.getElementById("finderColumns");
  if (!container) return;

  _bookmarkTree = await _fetchTree();

  container.innerHTML = "";

  if (!_bookmarkTree) {
    container.innerHTML =
      `<div class="finder-empty" style="padding:var(--sp-8)">` +
      `Bookmarks unavailable</div>`;
    return;
  }

  // Build column 0 — root folders
  const rootItems = _getRootChildren(_bookmarkTree);
  const col0 = _buildColumn(rootItems, 0);
  container.appendChild(col0);
}
