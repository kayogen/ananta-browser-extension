/* ══════════════════════════════════════════════════════════════════════════
   worldClockModal.js — "Add City" modal dialog
   Depends on: worldClocks.js (wcAddCity must be available)
══════════════════════════════════════════════════════════════════════════ */

"use strict";

// ─── Fallback timezone list (used if Intl.supportedValuesOf unavailable) ─────
const WC_TZ_FALLBACK = [
  "UTC",
  "Africa/Cairo",
  "Africa/Johannesburg",
  "Africa/Lagos",
  "Africa/Nairobi",
  "America/Anchorage",
  "America/Bogota",
  "America/Buenos_Aires",
  "America/Caracas",
  "America/Chicago",
  "America/Denver",
  "America/Halifax",
  "America/Lima",
  "America/Los_Angeles",
  "America/Mexico_City",
  "America/Nassau",
  "America/New_York",
  "America/Phoenix",
  "America/Santiago",
  "America/Sao_Paulo",
  "America/St_Johns",
  "America/Tijuana",
  "America/Toronto",
  "America/Vancouver",
  "Asia/Baghdad",
  "Asia/Bangkok",
  "Asia/Colombo",
  "Asia/Dhaka",
  "Asia/Dubai",
  "Asia/Hong_Kong",
  "Asia/Jakarta",
  "Asia/Jerusalem",
  "Asia/Kabul",
  "Asia/Karachi",
  "Asia/Kathmandu",
  "Asia/Kolkata",
  "Asia/Kuala_Lumpur",
  "Asia/Manila",
  "Asia/Nicosia",
  "Asia/Riyadh",
  "Asia/Seoul",
  "Asia/Shanghai",
  "Asia/Singapore",
  "Asia/Taipei",
  "Asia/Tehran",
  "Asia/Tokyo",
  "Asia/Yangon",
  "Atlantic/Azores",
  "Atlantic/Cape_Verde",
  "Australia/Adelaide",
  "Australia/Brisbane",
  "Australia/Darwin",
  "Australia/Melbourne",
  "Australia/Perth",
  "Australia/Sydney",
  "Europe/Amsterdam",
  "Europe/Athens",
  "Europe/Berlin",
  "Europe/Brussels",
  "Europe/Bucharest",
  "Europe/Budapest",
  "Europe/Copenhagen",
  "Europe/Dublin",
  "Europe/Helsinki",
  "Europe/Istanbul",
  "Europe/Kiev",
  "Europe/Lisbon",
  "Europe/London",
  "Europe/Madrid",
  "Europe/Moscow",
  "Europe/Oslo",
  "Europe/Paris",
  "Europe/Prague",
  "Europe/Rome",
  "Europe/Sofia",
  "Europe/Stockholm",
  "Europe/Vienna",
  "Europe/Warsaw",
  "Europe/Zurich",
  "Pacific/Auckland",
  "Pacific/Fiji",
  "Pacific/Guam",
  "Pacific/Honolulu",
  "Pacific/Midway",
  "Pacific/Noumea",
  "Pacific/Tahiti",
];

// ─── Build timezone options list ──────────────────────────────────────────────
function _wcTzList() {
  try {
    if (typeof Intl.supportedValuesOf === "function") {
      return Intl.supportedValuesOf("timeZone");
    }
  } catch {
    /* not available */
  }
  return WC_TZ_FALLBACK;
}

// ─── Build and inject modal HTML ──────────────────────────────────────────────
function _wcBuildModal() {
  if (document.getElementById("wcModal")) return; // already built

  const modal = document.createElement("div");
  modal.id = "wcModal";
  modal.className = "wc-modal";
  modal.setAttribute("aria-hidden", "true");
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-labelledby", "wcModalTitle");

  modal.innerHTML = `
    <div class="wc-modal-backdrop" id="wcModalBackdrop"></div>
    <div class="wc-modal-panel" role="document">
      <div class="wc-modal-header">
        <h3 class="wc-modal-title" id="wcModalTitle">Add City</h3>
        <button class="wc-modal-close-btn" id="wcModalCloseBtn" aria-label="Close dialog">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
            <line x1="5" y1="5" x2="15" y2="15"/>
            <line x1="15" y1="5" x2="5" y2="15"/>
          </svg>
        </button>
      </div>

      <form class="wc-modal-form" id="wcModalForm" novalidate>

        <div class="wc-field">
          <label class="wc-field-label" for="wcFieldCity">City Name <span class="wc-required">*</span></label>
          <input
            class="wc-field-input"
            id="wcFieldCity"
            type="text"
            placeholder="e.g. Tokyo"
            autocomplete="off"
            spellcheck="false"
            required
          />
          <span class="wc-field-error" id="wcErrorCity" aria-live="polite"></span>
        </div>

        <div class="wc-field-row">
          <div class="wc-field">
            <label class="wc-field-label" for="wcFieldState">State / Region</label>
            <input
              class="wc-field-input"
              id="wcFieldState"
              type="text"
              placeholder="e.g. IL"
              autocomplete="off"
            />
          </div>
          <div class="wc-field">
            <label class="wc-field-label" for="wcFieldCountry">Country <span class="wc-required">*</span></label>
            <input
              class="wc-field-input"
              id="wcFieldCountry"
              type="text"
              placeholder="e.g. Japan"
              autocomplete="off"
              required
            />
            <span class="wc-field-error" id="wcErrorCountry" aria-live="polite"></span>
          </div>
        </div>

        <div class="wc-field">
          <label class="wc-field-label" for="wcFieldTz">Timezone <span class="wc-required">*</span></label>
          <select class="wc-field-select" id="wcFieldTz" required>
            <option value="">— Select timezone —</option>
          </select>
          <span class="wc-field-error" id="wcErrorTz" aria-live="polite"></span>
        </div>

        <div class="wc-modal-actions">
          <button type="button" class="wc-btn wc-btn-ghost" id="wcModalCancelBtn">Cancel</button>
          <button type="submit" class="wc-btn wc-btn-primary" id="wcModalSubmitBtn">Add City</button>
        </div>

      </form>
    </div>
  `;

  document.body.appendChild(modal);

  // Populate timezone dropdown
  const select = document.getElementById("wcFieldTz");
  _wcTzList().forEach((tz) => {
    const opt = document.createElement("option");
    opt.value = tz;
    opt.textContent = tz.replace(/_/g, " ");
    select.appendChild(opt);
  });

  // Wire events
  document
    .getElementById("wcModalBackdrop")
    .addEventListener("click", wcHideModal);
  document
    .getElementById("wcModalCloseBtn")
    .addEventListener("click", wcHideModal);
  document
    .getElementById("wcModalCancelBtn")
    .addEventListener("click", wcHideModal);
  document
    .getElementById("wcModalForm")
    .addEventListener("submit", _wcHandleSubmit);

  // Keyboard: Escape closes
  modal.addEventListener("keydown", (e) => {
    if (e.key === "Escape") wcHideModal();
    // Trap focus within modal
    if (e.key === "Tab") {
      const focusables = modal.querySelectorAll(
        'button:not([disabled]), input, select, [tabindex]:not([tabindex="-1"])',
      );
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });
}

// ─── Validation ───────────────────────────────────────────────────────────────
function _wcValidateForm() {
  const city = document.getElementById("wcFieldCity").value.trim();
  const country = document.getElementById("wcFieldCountry").value.trim();
  const tz = document.getElementById("wcFieldTz").value;
  let valid = true;

  const cityErr = document.getElementById("wcErrorCity");
  if (!city) {
    cityErr.textContent = "City name is required.";
    document.getElementById("wcFieldCity").setAttribute("aria-invalid", "true");
    valid = false;
  } else {
    cityErr.textContent = "";
    document.getElementById("wcFieldCity").removeAttribute("aria-invalid");
  }

  const countryErr = document.getElementById("wcErrorCountry");
  if (!country) {
    countryErr.textContent = "Country is required.";
    document
      .getElementById("wcFieldCountry")
      .setAttribute("aria-invalid", "true");
    valid = false;
  } else {
    countryErr.textContent = "";
    document.getElementById("wcFieldCountry").removeAttribute("aria-invalid");
  }

  const tzErr = document.getElementById("wcErrorTz");
  if (!tz) {
    tzErr.textContent = "Please select a timezone.";
    document.getElementById("wcFieldTz").setAttribute("aria-invalid", "true");
    valid = false;
  } else {
    tzErr.textContent = "";
    document.getElementById("wcFieldTz").removeAttribute("aria-invalid");
  }

  return valid;
}

// ─── Submit handler ───────────────────────────────────────────────────────────
function _wcHandleSubmit(e) {
  e.preventDefault();
  if (!_wcValidateForm()) return;

  const name = document.getElementById("wcFieldCity").value.trim();
  const state = document.getElementById("wcFieldState").value.trim();
  const country = document.getElementById("wcFieldCountry").value.trim();
  const timezone = document.getElementById("wcFieldTz").value;

  const ok = wcAddCity({ name, state, country, timezone });

  if (!ok) {
    const cityErr = document.getElementById("wcErrorCity");
    cityErr.textContent = `"${name}" already exists in this timezone group.`;
    document.getElementById("wcFieldCity").focus();
    return;
  }

  wcHideModal();
}

// ─── Show / Hide ──────────────────────────────────────────────────────────────
function wcShowModal() {
  _wcBuildModal();
  const modal = document.getElementById("wcModal");
  if (!modal) return;

  // Reset form
  const form = document.getElementById("wcModalForm");
  if (form) form.reset();
  modal
    .querySelectorAll(".wc-field-error")
    .forEach((el) => (el.textContent = ""));
  modal
    .querySelectorAll("[aria-invalid]")
    .forEach((el) => el.removeAttribute("aria-invalid"));

  // Pre-select guessed timezone
  const guessedTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const tzSelect = document.getElementById("wcFieldTz");
  if (tzSelect && guessedTz) {
    const opt = Array.from(tzSelect.options).find((o) => o.value === guessedTz);
    if (opt) tzSelect.value = guessedTz;
  }

  modal.setAttribute("aria-hidden", "false");
  modal.classList.add("is-open");
  document.body.classList.add("wc-modal-open");

  // Focus first input after animation
  setTimeout(() => {
    const firstInput = document.getElementById("wcFieldCity");
    if (firstInput) firstInput.focus();
  }, 80);
}

function wcHideModal() {
  const modal = document.getElementById("wcModal");
  if (!modal) return;
  modal.classList.remove("is-open");
  modal.classList.add("is-closing");
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("wc-modal-open");

  setTimeout(() => {
    modal.classList.remove("is-closing");
    // Return focus to Add button
    const addBtn = document.getElementById("wcAddBtn");
    if (addBtn) addBtn.focus();
  }, 240);
}
