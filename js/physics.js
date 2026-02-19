/**
 * physics.js — Spring physics integrator for Ananta
 *
 * Implements a simple mass-spring-damper system using semi-implicit Euler
 * integration driven by requestAnimationFrame.
 *
 * Usage:
 *   spring({ from: 0, to: 1, stiffness: 120, damping: 14, mass: 1,
 *            onUpdate: v => el.style.opacity = v,
 *            onComplete: () => console.log('done') });
 *
 *   springTo(el, { opacity: [0, 1], translateY: [-12, 0] }, config);
 */

"use strict";

/* ── Default spring presets ─────────────────────────────────────────────── */
const SPRING_PRESETS = {
  spotlight: { mass: 1, stiffness: 120, damping: 14 },
  bookmark: { mass: 1, stiffness: 160, damping: 18 },
  icon: { mass: 1, stiffness: 200, damping: 20 },
  gentle: { mass: 1, stiffness: 80, damping: 12 },
};

/**
 * Core spring integrator.
 *
 * @param {object} opts
 * @param {number}   opts.from        — start value
 * @param {number}   opts.to          — end value
 * @param {number}  [opts.mass=1]
 * @param {number}  [opts.stiffness=120]
 * @param {number}  [opts.damping=14]
 * @param {number}  [opts.velocity=0] — initial velocity
 * @param {number}  [opts.precision=0.001] — rest threshold
 * @param {Function} opts.onUpdate(value)
 * @param {Function} [opts.onComplete()]
 * @returns {{ cancel: Function }} — call .cancel() to stop the animation
 */
function spring({
  from = 0,
  to = 1,
  mass = 1,
  stiffness = 120,
  damping = 14,
  velocity = 0,
  precision = 0.001,
  onUpdate,
  onComplete,
}) {
  let position = from;
  let vel = velocity;
  let rafId = null;
  let lastTime = null;
  let settled = false;

  function step(now) {
    if (settled) return;
    if (lastTime === null) lastTime = now;

    // Clamp dt to avoid huge jumps after tab sleep
    const dt = Math.min((now - lastTime) / 1000, 0.064); // seconds; max 64ms
    lastTime = now;

    // Semi-implicit Euler integration
    const force = -stiffness * (position - to) - damping * vel;
    const acceleration = force / mass;
    vel += acceleration * dt;
    position += vel * dt;

    onUpdate(position);

    // Check if spring has settled (both displacement and velocity near zero)
    if (Math.abs(position - to) < precision && Math.abs(vel) < precision) {
      settled = true;
      onUpdate(to); // snap exactly to target
      if (onComplete) onComplete();
      return;
    }

    rafId = requestAnimationFrame(step);
  }

  rafId = requestAnimationFrame(step);

  return {
    cancel() {
      settled = true;
      if (rafId !== null) cancelAnimationFrame(rafId);
    },
  };
}

/**
 * Animate one or more CSS properties on a DOM element using spring physics.
 * Only animates `transform` components and `opacity` (GPU-only).
 *
 * @param {HTMLElement} el
 * @param {object} props — key: CSS property name or transform component, value: [from, to]
 *   Supported keys: 'opacity', 'translateX', 'translateY', 'translateZ', 'scale'
 * @param {object} [config] — spring config or preset name (string)
 * @returns {{ cancel: Function }}
 *
 * @example
 *   springTo(panel, { opacity: [0, 1], translateY: [-12, 0] }, 'spotlight');
 *   springTo(icon,  { scale: [1, 0.96] }, { stiffness: 200, damping: 20 });
 */
function springTo(el, props, config = {}) {
  const cfg =
    typeof config === "string"
      ? { ...(SPRING_PRESETS[config] || SPRING_PRESETS.spotlight) }
      : { ...SPRING_PRESETS.spotlight, ...config };

  // Track current animated values
  const values = {};
  for (const [key, [from]] of Object.entries(props)) {
    values[key] = from;
  }

  const cancellers = [];

  for (const [key, [from, to]] of Object.entries(props)) {
    const c = spring({
      from,
      to,
      ...cfg,
      onUpdate(v) {
        values[key] = v;
        _applyValues(el, values);
      },
      onComplete() {
        values[key] = to;
        _applyValues(el, values);
      },
    });
    cancellers.push(c);
  }

  return {
    cancel() {
      cancellers.forEach((c) => c.cancel());
    },
  };
}

/** Apply a values map to an element's style (GPU-safe). @private */
function _applyValues(el, values) {
  const transforms = [];

  if ("translateX" in values)
    transforms.push(`translateX(${values.translateX}px)`);
  if ("translateY" in values)
    transforms.push(`translateY(${values.translateY}px)`);
  if ("translateZ" in values)
    transforms.push(`translateZ(${values.translateZ}px)`);
  if ("scale" in values) transforms.push(`scale(${values.scale})`);

  // Always ensure GPU layer
  transforms.unshift("translateZ(0)");

  if (transforms.length) {
    el.style.transform = [...new Set(transforms)].join(" ");
  }

  if ("opacity" in values) {
    el.style.opacity = String(Math.max(0, Math.min(1, values.opacity)));
  }
}

/**
 * Animate a number from `from` to `to` over time using a spring, calling
 * `onUpdate` each frame.  Simpler wrapper for non-DOM use.
 *
 * @returns {{ cancel: Function }}
 */
function springValue(from, to, onUpdate, config = "gentle") {
  const cfg =
    typeof config === "string"
      ? { ...(SPRING_PRESETS[config] || SPRING_PRESETS.gentle) }
      : { ...SPRING_PRESETS.gentle, ...config };
  return spring({ from, to, ...cfg, onUpdate });
}

// Expose on window for non-module scripts
window.AnantaPhysics = { spring, springTo, springValue, SPRING_PRESETS };
