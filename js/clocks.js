/* ══════════════════════════════════════════════════════════════════════════
   clocks.js — Hero clock & world clock widgets (digital only)
══════════════════════════════════════════════════════════════════════════ */

"use strict";

// ─── 12h / 24h preference (persisted) ───────────────────────────────────────
let _use24h = localStorage.getItem("ananta-fmt-24h") === "1";

// ─── Local city name from IANA timezone ─────────────────────────────────────
function _heroCity() {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  const parts = tz.split("/");
  return parts[parts.length - 1].replace(/_/g, " ") || "Local";
}

// Derive a human-readable country/region label from IANA timezone
function _heroCountry() {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  const region = tz.split("/")[0] || "";
  const map = {
    America: "USA",
    Europe: "Europe",
    Asia: "Asia",
    Africa: "Africa",
    Pacific: "Pacific",
    Atlantic: "Atlantic",
    Australia: "Australia",
    Indian: "Indian Ocean",
    Arctic: "Arctic",
    Antarctica: "Antarctica",
  };
  // Specific overrides for common US zones
  if (
    tz.includes("New_York") ||
    tz.includes("Chicago") ||
    tz.includes("Denver") ||
    tz.includes("Los_Angeles") ||
    tz.includes("Phoenix") ||
    tz.includes("Anchorage") ||
    tz.includes("Honolulu")
  )
    return "USA";
  if (tz.includes("London")) return "UK";
  if (tz.includes("Kolkata") || tz.includes("Calcutta")) return "India";
  if (tz.includes("Tokyo")) return "Japan";
  if (tz.includes("Sydney") || tz.includes("Melbourne")) return "Australia";
  if (tz.includes("Paris")) return "France";
  if (tz.includes("Berlin")) return "Germany";
  if (tz.includes("Toronto")) return "Canada";
  return map[region] || "";
}

// Short date for a given IANA timezone (e.g. "Thu, Feb 19")
function _tzDate(tz) {
  return new Intl.DateTimeFormat([], {
    timeZone: tz,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date());
}

// ─── Hero time (local, with seconds) ────────────────────────────────────────
function _heroTime() {
  const now = new Date();
  if (_use24h) {
    return now.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }
  return now
    .toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
    .replace(/\b(am|pm)\b/gi, (m) => m.toUpperCase());
}

// ─── World clock time (no seconds) ──────────────────────────────────────────
function _tzTimeFmt(tz) {
  if (_use24h) {
    return new Intl.DateTimeFormat([], {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date());
  }
  return new Intl.DateTimeFormat([], {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
    .format(new Date())
    .replace(/\b(am|pm)\b/gi, (m) => m.toUpperCase());
}

// ─── UTC offset label e.g. "UTC+5:30" or "UTC−5" ───────────────────────────
function _utcOffset(tz) {
  if (tz === "UTC") return "UTC";
  const now = new Date();
  const local = new Date(now.toLocaleString("en-US", { timeZone: tz }));
  const utc = new Date(now.toLocaleString("en-US", { timeZone: "UTC" }));
  const diffMin = Math.round((local - utc) / 60000);
  if (diffMin === 0) return "UTC";
  const sign = diffMin > 0 ? "+" : "−";
  const abs = Math.abs(diffMin);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return "UTC" + sign + h + (m ? ":" + String(m).padStart(2, "0") : "");
}

// ─── Day-phase emoji + label for a timezone ─────────────────────────────────
function _dayPhase(tz) {
  const h = Number(
    new Intl.DateTimeFormat([], {
      timeZone: tz,
      hour: "numeric",
      hour12: false,
    }).format(new Date()),
  );
  if (h >= 5 && h < 8) return { emoji: "🌅", label: "Dawn" };
  if (h >= 8 && h < 18) return { emoji: "☀️", label: "Day" };
  if (h >= 18 && h < 21) return { emoji: "🌆", label: "Dusk" };
  return { emoji: "🌙", label: "Night" };
}

// ─── Greeting ────────────────────────────────────────────────────────────────
function _greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Burning the midnight oil";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 21) return "Good evening";
  return "Good night";
}

// ─── rAF tick loop ───────────────────────────────────────────────────────────
let _rafId = null;
let _lastSecond = -1;

function _tick() {
  const now = new Date();
  const sec = now.getSeconds();

  // Hero time — updates every frame (seconds ticking live)
  const heroTime = document.getElementById("heroTime");
  if (heroTime) {
    const str = _heroTime();
    if (heroTime.textContent !== str) heroTime.textContent = str;
  }

  // Everything else — once per second
  if (sec !== _lastSecond) {
    _lastSecond = sec;

    // Hero city + country (set once on first tick)
    const heroCity = document.getElementById("heroCity");
    if (heroCity && !heroCity.textContent) {
      heroCity.textContent = _heroCity();
    }
    const heroCountry = document.getElementById("heroCountry");
    if (heroCountry && !heroCountry.textContent) {
      heroCountry.textContent = _heroCountry();
    }

    // Hero date
    const heroDate = document.getElementById("heroDate");
    if (heroDate) {
      const dateStr = now.toLocaleDateString([], {
        weekday: "long",
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      if (heroDate.textContent !== dateStr) heroDate.textContent = dateStr;
    }

    // Hero greeting
    const heroGreeting = document.getElementById("heroGreeting");
    if (heroGreeting) {
      const g = _greeting();
      if (heroGreeting.textContent !== g) heroGreeting.textContent = g;
    }

    // World clock cards are now managed by worldClocks.js (_wcTick)
  }

  _rafId = requestAnimationFrame(_tick);
}

// ─── Public init ─────────────────────────────────────────────────────────────
function initClocks() {
  if (_rafId) cancelAnimationFrame(_rafId);

  // Wire 12h / 24h toggle buttons
  document.querySelectorAll(".hero-fmt-btn").forEach((btn) => {
    const fmt = btn.dataset.fmt;
    btn.classList.toggle("is-active", (fmt === "24") === _use24h);
    btn.addEventListener("click", () => {
      _use24h = fmt === "24";
      localStorage.setItem("ananta-fmt-24h", _use24h ? "1" : "0");
      document.querySelectorAll(".hero-fmt-btn").forEach((b) => {
        b.classList.toggle(
          "is-active",
          b.dataset.fmt === (_use24h ? "24" : "12"),
        );
      });
      // Force immediate re-render
      _lastSecond = -1;
    });
  });

  _tick();
}
