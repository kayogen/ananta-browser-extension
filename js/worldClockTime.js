/* ══════════════════════════════════════════════════════════════════════════
   worldClockTime.js — Time formatting, DST-aware UTC offset, day phase
   All functions are pure and stateless. Exposed as globals.
══════════════════════════════════════════════════════════════════════════ */

"use strict";

/**
 * DST-accurate UTC offset string for any IANA timezone.
 * Uses Intl.DateTimeFormat shortOffset which automatically handles DST.
 * Returns strings like "UTC+5:30", "UTC−5", "UTC" (for zero offset).
 */
function wcUtcOffset(tz) {
  if (!tz || tz === "UTC") return "UTC";
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "shortOffset",
    }).formatToParts(new Date());
    const raw =
      (parts.find((p) => p.type === "timeZoneName") || {}).value || "GMT";
    // "GMT+5:30" → "UTC+5:30", "GMT-5" → "UTC−5" (proper minus), "GMT" → "UTC"
    if (raw === "GMT" || raw === "GMT+0" || raw === "UTC+0") return "UTC";
    return raw.replace("GMT", "UTC").replace(/-/g, "−"); // U+2212 minus sign for aesthetics
  } catch {
    // Fallback: compute manually
    const now = new Date();
    const local = new Date(now.toLocaleString("en-US", { timeZone: tz }));
    const utc = new Date(now.toLocaleString("en-US", { timeZone: "UTC" }));
    const diff = Math.round((local - utc) / 60000);
    if (diff === 0) return "UTC";
    const sign = diff > 0 ? "+" : "−";
    const abs = Math.abs(diff);
    const h = Math.floor(abs / 60);
    const m = abs % 60;
    return "UTC" + sign + h + (m ? ":" + String(m).padStart(2, "0") : "");
  }
}

/**
 * Formatted time for a given IANA timezone.
 * Respects 12h/24h preference.
 */
function wcTime(tz, use24h) {
  try {
    const opts = {
      timeZone: tz,
      hour: use24h ? "2-digit" : "numeric",
      minute: "2-digit",
      hour12: !use24h,
    };
    return new Intl.DateTimeFormat("en-US", opts)
      .format(new Date())
      .replace(/\b(am|pm)\b/gi, (m) => m.toUpperCase());
  } catch {
    return "--:--";
  }
}

/**
 * Short date for a given IANA timezone.
 * Returns e.g. "Thu, Feb 19"
 */
function wcDate(tz) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      weekday: "short",
      month: "short",
      day: "numeric",
    }).format(new Date());
  } catch {
    return "";
  }
}

/**
 * Hour (0–23) in the given timezone.
 * Used to compute day phase consistently.
 */
function _wcHour(tz) {
  try {
    return Number(
      new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        hour: "numeric",
        hour12: false,
      }).format(new Date()),
    );
  } catch {
    return new Date().getHours();
  }
}

/**
 * Day phase descriptor for a timezone.
 * Returns { label: string, emoji: string }
 * Phases: Morning (5–11), Afternoon (12–16), Evening (17–20), Night (21–4)
 */
function wcDayPhase(tz) {
  const h = _wcHour(tz);
  if (h >= 5 && h < 12) return { label: "Morning", emoji: "🌅" };
  if (h >= 12 && h < 17) return { label: "Afternoon", emoji: "☀️" };
  if (h >= 17 && h < 21) return { label: "Evening", emoji: "🌆" };
  return { label: "Night", emoji: "🌙" };
}

/**
 * Returns true if the given timezone is in night phase.
 */
function wcIsNight(tz) {
  return wcDayPhase(tz).label === "Night";
}
