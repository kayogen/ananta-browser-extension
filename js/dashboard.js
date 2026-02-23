"use strict";

const _DB_SVG_GRID = `<svg xmlns="http://www.w3.org/2000/svg"
     viewBox="0 0 20 20"
     fill="currentColor"
     aria-hidden="true"
     width="18"
     height="18">  <rect x="2" y="2" width="7" height="9" rx="1.5"></rect>  <rect x="11" y="2" width="7" height="6" rx="1.5"></rect>  <rect x="2" y="12" width="7" height="6" rx="1.5"></rect>  <rect x="11" y="9" width="7" height="9" rx="1.5"></rect></svg>`;

const _DB_SVG_GEAR = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" width="16" height="16">
  <path fill-rule="evenodd" d="M8.34 1.804A1 1 0 019.32 1h1.36a1 1 0 01.98.804l.295 1.473c.497.144.971.342 1.416.587l1.25-.834a1 1 0 011.262.125l.962.962a1 1 0 01.125 1.262l-.834 1.25c.245.445.443.919.587 1.416l1.473.294a1 1 0 01.804.98v1.361a1 1 0 01-.804.98l-1.473.295a6.95 6.95 0 01-.587 1.416l.834 1.25a1 1 0 01-.125 1.262l-.962.962a1 1 0 01-1.262.125l-1.25-.834a6.953 6.953 0 01-1.416.587l-.294 1.473a1 1 0 01-.98.804H9.32a1 1 0 01-.98-.804l-.295-1.473a6.957 6.957 0 01-1.416-.587l-1.25.834a1 1 0 01-1.262-.125l-.962-.962a1 1 0 01-.125-1.262l.834-1.25a6.957 6.957 0 01-.587-1.416l-1.473-.294A1 1 0 011 10.68V9.32a1 1 0 01.804-.98l1.473-.295c.144-.497.342-.971.587-1.416l-.834-1.25a1 1 0 01.125-1.262l.962-.962A1 1 0 014.38 3.03l1.25.834a6.957 6.957 0 011.416-.587l.294-1.473zM13 10a3 3 0 11-6 0 3 3 0 016 0z" clip-rule="evenodd"/>
</svg>`;

const _DB_SVG_DONE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" width="16" height="16">
  <path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clip-rule="evenodd"/>
</svg>`;

const _DB_SVG_PLUS = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true" width="20" height="20">
  <line x1="10" y1="4" x2="10" y2="16"/>
  <line x1="4" y1="10" x2="16" y2="10"/>
</svg>`;

const _DB_SVG_MINUS = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" aria-hidden="true">
  <circle cx="8" cy="8" r="7.5" fill="#FF3B30"/>
  <rect x="4" y="7.25" width="8" height="1.5" rx="0.75" fill="white"/>
</svg>`;

const _db = {
  isOpen: false,
  isEditMode: false,
  isDialogOpen: false,
};

let $overlay, $panel, $grid, $settingsBtn, $searchInput;
let $dialog, $dialogUrl, $dialogName, $dialogSave, $dialogCancel, $dialogClose;

function _svgNode(svgString) {
  return new DOMParser().parseFromString(svgString, "image/svg+xml")
    .documentElement;
}

function _buildIconImg(app) {
  const hostname = (() => {
    try {
      return new URL(app.url).hostname;
    } catch {
      return "";
    }
  })();

  const ddg = `https://icons.duckduckgo.com/ip3/${hostname}.ico`;
  const google = `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`;

  const img = document.createElement("img");
  img.alt = app.name;
  img.decoding = "async";
  img.loading = "lazy";
  img.className = "db-app-icon-img";

  let attempt = 0;
  const sources = [ddg, google];

  function tryNext() {
    if (attempt < sources.length) {
      img.src = sources[attempt++];
    } else {
      img.replaceWith(_buildLetterAvatar(app.name));
    }
  }

  img.onerror = tryNext;
  tryNext();
  return img;
}

function _buildLetterAvatar(name) {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  canvas.className = "db-app-icon-img db-app-icon-letter";
  const ctx = canvas.getContext("2d");

  const hue = ((name.charCodeAt(0) || 65) * 137) % 360;
  ctx.fillStyle = `hsl(${hue}, 55%, 55%)`;
  ctx.beginPath();
  ctx.roundRect(0, 0, 64, 64, 14);
  ctx.fill();

  ctx.fillStyle = "#fff";
  ctx.font =
    "bold 28px -apple-system, SF Pro Display, Helvetica Neue, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText((name[0] || "?").toUpperCase(), 32, 33);
  return canvas;
}

function _buildAddTile() {
  const wrap = document.createElement("div");
  wrap.className = "db-app-tile db-add-tile";
  wrap.id = "dbAddTileInGrid";
  wrap.setAttribute("role", "button");
  wrap.setAttribute("aria-label", "Add app");

  const iconWrap = document.createElement("div");
  iconWrap.className = "db-app-icon-wrap db-add-icon-wrap";
  iconWrap.appendChild(_svgNode(_DB_SVG_PLUS));

  const label = document.createElement("span");
  label.className = "db-app-label";
  label.textContent = "Add";

  wrap.appendChild(iconWrap);
  wrap.appendChild(label);
  wrap.addEventListener("click", _openDialog);
  return wrap;
}

function _buildTile(app) {
  const tile = document.createElement("div");
  tile.className = "db-app-tile";
  tile.dataset.id = app.id;
  tile.dataset.name = app.name.toLowerCase();
  tile.dataset.url = app.url.toLowerCase();

  const minusBtn = document.createElement("button");
  minusBtn.className = "db-tile-remove";
  minusBtn.setAttribute("aria-label", `Remove ${app.name}`);
  minusBtn.appendChild(_svgNode(_DB_SVG_MINUS));
  minusBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    _handleRemove(app.id, tile);
  });

  const iconWrap = document.createElement("div");
  iconWrap.className = "db-app-icon-wrap";
  iconWrap.appendChild(_buildIconImg(app));

  const label = document.createElement("span");
  label.className = "db-app-label";
  label.textContent = app.name;

  tile.appendChild(minusBtn);
  tile.appendChild(iconWrap);
  tile.appendChild(label);

  tile.addEventListener("click", () => {
    if (!_db.isEditMode) {
      window.open(app.url, "_blank", "noopener,noreferrer");
    }
  });

  return tile;
}

function _getAddTile() {
  return $grid.querySelector("#dbAddTileInGrid");
}

function _buildEmptyState(query) {
  const el = document.createElement("div");
  el.className = "db-empty-state";

  const iconDiv = document.createElement("div");
  iconDiv.className = "db-empty-icon";
  iconDiv.appendChild(_svgNode(_DB_SVG_GRID));

  const title = document.createElement("p");
  title.className = "db-empty-title";

  const sub = document.createElement("p");
  sub.className = "db-empty-sub";

  if (query) {
    title.textContent = "No Results";
    sub.textContent = `No apps match "${query}".`;
  } else {
    title.textContent = "No Pinned Apps";
    sub.textContent = "Click the settings icon then + to add your first app.";
  }

  el.appendChild(iconDiv);
  el.appendChild(title);
  el.appendChild(sub);
  return el;
}

function _renderGrid() {
  const apps = AppsStorage.getApps();
  $grid.innerHTML = "";

  if (_db.isEditMode) {
    $grid.appendChild(_buildAddTile());
  }

  if (apps.length === 0) {
    if (!_db.isEditMode) {
      $grid.appendChild(_buildEmptyState());
    }
    return;
  }

  apps.forEach((app) => {
    const tile = _buildTile(app);
    if (_db.isEditMode) tile.classList.add("is-edit");
    $grid.appendChild(tile);
  });
}

function _applyEditModeToGrid() {
  const tiles = $grid.querySelectorAll(".db-app-tile:not(.db-add-tile)");
  tiles.forEach((tile) => {
    tile.classList.toggle("is-edit", _db.isEditMode);
  });

  const existingAddTile = _getAddTile();

  if (_db.isEditMode && !existingAddTile) {
    const empty = $grid.querySelector(".db-empty-state");
    if (empty) empty.remove();
    $grid.insertBefore(_buildAddTile(), $grid.firstChild);
  } else if (!_db.isEditMode && existingAddTile) {
    existingAddTile.remove();
    if ($grid.querySelectorAll(".db-app-tile").length === 0) {
      $grid.appendChild(_buildEmptyState());
    }
  }
}

function _filterGrid(query) {
  const q = query.trim().toLowerCase();
  const addTile = _getAddTile();

  if (!q) {
    $grid
      .querySelectorAll(".db-app-tile:not(.db-add-tile)")
      .forEach((t) => (t.style.display = ""));
    const empty = $grid.querySelector(".db-empty-state");
    if (empty) empty.style.display = "";
    if (addTile) addTile.style.display = "";
    return;
  }

  if (addTile) addTile.style.display = "none";

  let visibleCount = 0;
  $grid.querySelectorAll(".db-app-tile:not(.db-add-tile)").forEach((tile) => {
    const matches =
      (tile.dataset.name || "").includes(q) ||
      (tile.dataset.url || "").includes(q);
    tile.style.display = matches ? "" : "none";
    if (matches) visibleCount++;
  });

  let emptyState = $grid.querySelector(".db-empty-state");
  if (visibleCount === 0) {
    if (!emptyState) {
      $grid.appendChild(_buildEmptyState(query.trim()));
    } else {
      emptyState.style.display = "";
      emptyState.replaceChildren();
      const iconDiv = document.createElement("div");
      iconDiv.className = "db-empty-icon";
      iconDiv.appendChild(_svgNode(_DB_SVG_GRID));
      const title = document.createElement("p");
      title.className = "db-empty-title";
      title.textContent = "No Results";
      const sub = document.createElement("p");
      sub.className = "db-empty-sub";
      sub.textContent = `No apps match "${query.trim()}".`;
      emptyState.appendChild(iconDiv);
      emptyState.appendChild(title);
      emptyState.appendChild(sub);
    }
  } else if (emptyState) {
    emptyState.style.display = "none";
  }
}

function _handleRemove(id, tile) {
  tile.classList.add("db-tile-exit");
  tile.addEventListener(
    "animationend",
    () => {
      AppsStorage.removeApp(id);
      tile.remove();
      if (
        $grid.querySelectorAll(".db-app-tile:not(.db-add-tile)").length === 0
      ) {
        if (!$grid.querySelector(".db-empty-state")) {
          $grid.appendChild(_buildEmptyState());
        }
      }
    },
    { once: true },
  );
}

function _toggleEditMode() {
  _db.isEditMode = !_db.isEditMode;

  $settingsBtn.replaceChildren(
    _svgNode(_db.isEditMode ? _DB_SVG_DONE : _DB_SVG_GEAR),
  );
  $settingsBtn.setAttribute("aria-label", _db.isEditMode ? "Done" : "Settings");
  $settingsBtn.classList.toggle("is-done", _db.isEditMode);

  if ($searchInput) $searchInput.value = "";
  _filterGrid("");
  _applyEditModeToGrid();
}

function _openDialog() {
  if (_db.isDialogOpen) return;
  _db.isDialogOpen = true;
  $dialog.setAttribute("aria-hidden", "false");
  $dialog.classList.add("is-open");
  $dialogUrl.value = "";
  $dialogName.value = "";
  requestAnimationFrame(() => $dialogUrl.focus());
}

function _closeDialog() {
  if (!_db.isDialogOpen) return;
  _db.isDialogOpen = false;
  $dialog.classList.remove("is-open");
  $dialog.setAttribute("aria-hidden", "true");
}

function _saveApp() {
  const url = $dialogUrl.value.trim();
  if (!url) {
    $dialogUrl.focus();
    $dialogUrl.classList.add("db-input-error");
    setTimeout(() => $dialogUrl.classList.remove("db-input-error"), 800);
    return;
  }

  try {
    const app = AppsStorage.addApp({ url, name: $dialogName.value.trim() });
    _closeDialog();
    _insertTileAfterAdd(app);
  } catch (e) {
    console.error("[Dashboard] addApp failed:", e);
  }
}

function _insertTileAfterAdd(app) {
  const emptyState = $grid.querySelector(".db-empty-state");
  if (emptyState) emptyState.remove();

  const tile = _buildTile(app);
  if (_db.isEditMode) tile.classList.add("is-edit");
  $grid.appendChild(tile);
}

function _openModal() {
  if (_db.isOpen) return;
  _db.isOpen = true;

  $overlay.setAttribute("aria-hidden", "false");
  $overlay.classList.add("is-open");

  if (_db.isEditMode) _toggleEditMode();
  if ($searchInput) $searchInput.value = "";
  _renderGrid();

  requestAnimationFrame(() => {
    if ($searchInput) $searchInput.focus();
    else $panel.focus();
  });
}

function _closeModal() {
  if (!_db.isOpen) return;
  _db.isOpen = false;

  _closeDialog();
  $overlay.classList.remove("is-open");
  $overlay.classList.add("is-closing");

  $overlay.addEventListener(
    "animationend",
    () => {
      $overlay.classList.remove("is-closing");
      $overlay.setAttribute("aria-hidden", "true");
    },
    { once: true },
  );
}

function _onKeyDown(e) {
  if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key === "a") {
    e.preventDefault();
    _db.isOpen ? _closeModal() : _openModal();
    return;
  }

  if (!_db.isOpen) return;

  if (e.key === "Escape") {
    e.preventDefault();
    if (_db.isDialogOpen) {
      _closeDialog();
    } else {
      _closeModal();
    }
    return;
  }

  if (
    e.key === "Enter" &&
    _db.isDialogOpen &&
    document.activeElement !== $dialogCancel
  ) {
    e.preventDefault();
    _saveApp();
  }
}

function initDashboard() {
  $overlay = document.getElementById("dashboardOverlay");
  $panel = document.getElementById("dashboardPanel");
  $grid = document.getElementById("dashboardGrid");
  $settingsBtn = document.getElementById("dbSettingsBtn");
  $searchInput = document.getElementById("dbSearchInput");

  $dialog = document.getElementById("dbAddDialog");
  $dialogUrl = document.getElementById("dbDialogUrl");
  $dialogName = document.getElementById("dbDialogName");
  $dialogSave = document.getElementById("dbDialogSave");
  $dialogCancel = document.getElementById("dbDialogCancel");
  $dialogClose = document.getElementById("dbDialogClose");

  const openBtn = document.getElementById("dashboardOpenBtn");
  const closeBtn = document.getElementById("dbCloseBtn");
  const backdrop = document.getElementById("dbBackdrop");

  openBtn.addEventListener("click", _openModal);
  closeBtn.addEventListener("click", _closeModal);
  backdrop.addEventListener("click", _closeModal);

  $settingsBtn.addEventListener("click", _toggleEditMode);

  $dialogSave.addEventListener("click", _saveApp);
  $dialogCancel.addEventListener("click", _closeDialog);
  $dialogClose.addEventListener("click", _closeDialog);

  $dialogName.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      _saveApp();
    }
  });

  $dialog.addEventListener("click", (e) => {
    if (e.target === $dialog) _closeDialog();
  });

  if ($searchInput) {
    $searchInput.addEventListener("input", (e) => _filterGrid(e.target.value));
  }

  document.addEventListener("keydown", _onKeyDown);

  openBtn.appendChild(_svgNode(_DB_SVG_GRID));
  $settingsBtn.appendChild(_svgNode(_DB_SVG_GEAR));
}
