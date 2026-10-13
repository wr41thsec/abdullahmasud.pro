/**
 * The arc engine.
 *
 * Cards are laid on a circle whose centre sits far below the viewport. Each
 * card's position and tangential rotation come from a single CSS transform
 * (see Card.astro); this module's only job is to own one number — the ring's
 * angular drift — and write each card's resulting angle.
 *
 * Motion model: the ring has a velocity, and velocity eases toward a target
 * (auto speed, or zero while paused). Nothing ever snaps — pausing on hover,
 * resuming on leave, and reversing after a fling are all the same easing.
 *
 *   default      auto-scroll, left to right, forever (the ring wraps)
 *   mouse hover  pause on a card
 *   touch        pause while a finger is down
 *   drag / swipe scrub the ring either way, release with momentum
 *   wheel        scrub either way, eased
 */

export interface ArcOptions {
  /** Degrees of arc between adjacent cards. */
  step: number;
  /** Seconds for the ring to advance by one card position. */
  secondsPerCard: number;
}

/**
 * Total angular span occupied by a set of `count` cards. Cards wrap within
 * this window rather than around the full circle: the span (72° for ten
 * cards) is comfortably wider than the ~40° wedge the viewport shows, so a
 * card teleporting from one end to the other does it out of sight. That is
 * what makes the loop seamless.
 */
export const spanOf = (count: number, step: number): number => count * step;

/**
 * Wrap an angle into [-span/2, +span/2).
 *
 * JavaScript's `%` keeps the sign of the dividend, so a negative drift would
 * otherwise land on the wrong side of the ring. Normalising to positive
 * first is what prevents a visible jump when drift goes negative — which it
 * does the moment anyone drags the ring backwards.
 */
export const wrapAngle = (deg: number, span: number): number => {
  const m = ((deg % span) + span) % span;
  return m - span / 2;
};

/** Where card `index` sits, in degrees from centre, at a given drift. */
export const arcAngle = (
  index: number,
  drift: number,
  step: number,
  count: number,
): number => wrapAngle(index * step + drift, spanOf(count, step));

/**
 * Move the drift by `delta` degrees (either sign) and keep it in [0, span).
 * Unbounded growth would degrade float precision in a tab left open for days.
 */
export const advanceDrift = (drift: number, delta: number, span: number): number =>
  (((drift + delta) % span) + span) % span;

/**
 * Initial drift, chosen so the set opens well-composed: card 0 sits at the
 * left edge of the visible wedge rather than off-stage, so the first cards a
 * visitor sees are the first cards in the data.
 */
export const initialDrift = (step: number, count: number): number =>
  spanOf(count, step) / 2 - 2.5 * step;

export interface ArcEngine {
  /** Hold the rotation (used while a detail panel is open). */
  freeze(): void;
  /** Resume the rotation. */
  thaw(): void;
  /** Current angle of a card, in degrees, for FLIP measurements. */
  angleOf(index: number): number;
  /** Nudge the ring by whole card steps — the keyboard/reduced-motion path. */
  nudge(cards: number): void;
  destroy(): void;
}

/**
 * Cards beyond this angle from centre stop painting. It must clear the widest
 * visible wedge — the short-landscape layout shows cards out to ~28.5° — and
 * stay inside the wrap point (36° for ten cards, whose inner edge is ~32°), so
 * a card hides only where nobody can see it and jumps only while hidden.
 */
const OFFSTAGE_ANGLE = 30;

/** Seconds for velocity to cover ~63% of the way to its target. */
const EASE_SECONDS = 0.35;
/** Same, for wheel/keyboard impulses. Shorter, so scrubbing feels direct. */
const IMPULSE_SECONDS = 0.12;
/** Pointer travel before a press becomes a drag rather than a tap. */
const DRAG_PX = 6;
/** Fling speed ceiling, degrees per second. Auto speed is 3.6. */
const FLING_MAX = 240;
/** Window over which release velocity is measured. */
const FLING_WINDOW_MS = 100;

export function initArc(root: HTMLElement, opts: ArcOptions): ArcEngine {
  const cards = Array.from(root.querySelectorAll<HTMLElement>('[data-index]'));
  const n = cards.length;

  if (n === 0) {
    return {
      freeze() {},
      thaw() {},
      angleOf: () => 0,
      nudge() {},
      destroy() {},
    };
  }

  // `root` is a zero-size anchor; pointer input belongs to the full-screen stage.
  const stage = root.parentElement ?? root;
  const span = spanOf(n, opts.step);
  /** Positive drift carries cards left to right. */
  const autoSpeed = opts.step / opts.secondsPerCard;

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

  let drift = initialDrift(opts.step, n);
  let velocity = autoSpeed;
  let pending = 0; // degrees still to be eased in from wheel / keyboard
  let frozen = false;
  let hovering = false;
  let pressed = false;
  let dragging = false;
  let raf = 0;
  let last = 0;
  const angles = new Float64Array(n);

  const paused = (): boolean => frozen || hovering || pressed;
  const settled = (): boolean => paused() && velocity === 0 && pending === 0;
  /** Arc length per step equals card width, so this is exact at any breakpoint. */
  const degPerPx = (): number => opts.step / (cards[0]!.offsetWidth || 1);

  const paint = (): void => {
    for (let i = 0; i < n; i++) {
      const a = arcAngle(i, drift, opts.step, n);
      angles[i] = a;

      const el = cards[i]!;
      el.style.setProperty('--angle', a.toFixed(3));

      const offstage = Math.abs(a) > OFFSTAGE_ANGLE;
      // Only touch the attribute on change — an unconditional write every
      // frame would invalidate style for all ten cards continuously.
      if (offstage !== (el.dataset.offstage === 'true')) {
        el.dataset.offstage = String(offstage);
        // `visibility: hidden` (in Card.astro's CSS) takes the card out of
        // paint, but it does NOT remove it from the tab order or the
        // accessibility tree — offsetParent stays non-null and the button
        // inside stays focusable. Without `inert`, a keyboard user tabbing
        // through lands on stops that are invisible on screen.
        if (offstage) el.setAttribute('inert', '');
        else el.removeAttribute('inert');
      }
    }
  };

  const tick = (now: number): void => {
    // Drive from elapsed time, not a per-frame constant, so 60, 120 and 144Hz
    // screens all move at the same speed. Clamped so a backgrounded tab
    // doesn't jump the ring by however many seconds elapsed.
    const dt = last === 0 ? 0 : Math.min((now - last) / 1000, 0.1);
    last = now;

    if (!dragging) {
      // Exponential easing is frame-rate independent, unlike a fixed lerp factor.
      const target = paused() ? 0 : autoSpeed;
      velocity += (target - velocity) * (1 - Math.exp(-dt / EASE_SECONDS));
      if (paused() && Math.abs(velocity) < 0.01) velocity = 0;

      let delta = velocity * dt;
      if (pending !== 0) {
        let take = pending * (1 - Math.exp(-dt / IMPULSE_SECONDS));
        if (Math.abs(pending - take) < 0.001) take = pending;
        pending -= take;
        delta += take;
      }

      drift = advanceDrift(drift, delta, span);
      paint();
    }

    // Idle when paused and stopped: no reason to wake the GPU for a still frame.
    raf = settled() ? 0 : requestAnimationFrame(tick);
  };

  const wake = (): void => {
    if (raf !== 0 || reduceMotion.matches || document.hidden) return;
    last = 0;
    raf = requestAnimationFrame(tick);
  };

  const stop = (): void => {
    if (raf === 0) return;
    cancelAnimationFrame(raf);
    raf = 0;
  };

  /** Move the ring by `deg`, eased — or immediately when motion is reduced. */
  const shift = (deg: number): void => {
    if (reduceMotion.matches) {
      drift = advanceDrift(drift, deg, span);
      paint();
      return;
    }
    pending = Math.max(-90, Math.min(90, pending + deg));
    wake();
  };

  // ─── Hover (mouse / pen) ────────────────────────────────────
  // Boolean from over/out rather than a counter: a card that hides mid-fling
  // may never deliver its `leave`, and a counter would stay above zero forever.
  const onOver = (e: PointerEvent): void => {
    if (e.pointerType === 'touch') return;
    if ((e.target as Element).closest('.card')) hovering = true;
  };
  const onOut = (e: PointerEvent): void => {
    if (e.pointerType === 'touch') return;
    const to = e.relatedTarget as Element | null;
    if (to?.closest('.card')) return;
    hovering = false;
    wake();
  };

  // ─── Press, drag, release ───────────────────────────────────
  let pointerId = -1;
  let startX = 0;
  let startDrift = 0;
  let moved = false;
  let samples: { t: number; x: number }[] = [];

  const onDown = (e: PointerEvent): void => {
    if (frozen || pressed || (e.pointerType === 'mouse' && e.button !== 0)) return;
    pressed = true;
    moved = false;
    pointerId = e.pointerId;
    startX = e.clientX;
    samples = [{ t: e.timeStamp, x: e.clientX }];
  };

  const onMove = (e: PointerEvent): void => {
    if (!pressed || e.pointerId !== pointerId) return;

    if (!moved) {
      if (Math.abs(e.clientX - startX) < DRAG_PX) return;
      // Rebase at the threshold so the ring doesn't jump by DRAG_PX on grab.
      moved = true;
      dragging = true;
      pending = 0;
      startX = e.clientX;
      startDrift = drift;
      stage.dataset.dragging = 'true';
      // Only now: capturing on press would retarget the click and break taps.
      try {
        stage.setPointerCapture(pointerId);
      } catch {
        /* pointer already gone — pointerup will clean up */
      }
    }

    drift = advanceDrift(startDrift, (e.clientX - startX) * degPerPx(), span);
    samples.push({ t: e.timeStamp, x: e.clientX });
    while (samples.length > 2 && e.timeStamp - samples[0]!.t > FLING_WINDOW_MS) samples.shift();
    paint();
  };

  const onUp = (e: PointerEvent): void => {
    if (!pressed || e.pointerId !== pointerId) return;
    pressed = false;
    pointerId = -1;

    if (dragging) {
      dragging = false;
      delete stage.dataset.dragging;
      const first = samples[0]!;
      const dtMs = e.timeStamp - first.t;
      // Anything older than the window means the finger rested before release.
      // A cancel carries no usable coordinates (often 0,0): no fling.
      const v =
        e.type !== 'pointercancel' && dtMs > 0 && dtMs <= FLING_WINDOW_MS * 1.5
          ? ((e.clientX - first.x) * degPerPx() * 1000) / dtMs
          : 0;
      velocity = reduceMotion.matches ? 0 : Math.max(-FLING_MAX, Math.min(FLING_MAX, v));
    }
    wake();
  };

  // A drag ends in a click on whatever was under the finger. Swallow it, or
  // every swipe would open a card. `detail === 0` is a keyboard click: let it
  // through, there was no pointer involved.
  const onClickCapture = (e: MouseEvent): void => {
    if (!moved || e.detail === 0) return;
    moved = false;
    e.preventDefault();
    e.stopPropagation();
  };

  const onWheel = (e: WheelEvent): void => {
    if (frozen) return;
    e.preventDefault();
    const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    const px = e.deltaMode === 1 ? d * 16 : d;
    // Scrolling "down/right" moves content left, so drift decreases.
    shift(-px * degPerPx());
  };

  // A background tab still fires rAF in some browsers and burns battery for
  // motion nobody is looking at.
  const onVisibility = (): void => {
    if (document.hidden) stop();
    else wake();
  };

  const onMotionPreferenceChange = (): void => {
    pending = 0;
    if (reduceMotion.matches) {
      stop();
      velocity = 0;
      drift = initialDrift(opts.step, n);
    } else {
      velocity = 0;
      wake();
    }
    paint();
  };

  stage.addEventListener('pointerover', onOver);
  stage.addEventListener('pointerout', onOut);
  stage.addEventListener('pointerdown', onDown);
  stage.addEventListener('pointermove', onMove);
  stage.addEventListener('pointerup', onUp);
  stage.addEventListener('pointercancel', onUp);
  stage.addEventListener('click', onClickCapture, true);
  stage.addEventListener('wheel', onWheel, { passive: false });
  document.addEventListener('visibilitychange', onVisibility);
  reduceMotion.addEventListener('change', onMotionPreferenceChange);

  if (reduceMotion.matches) velocity = 0;
  paint();
  wake();

  return {
    freeze() {
      frozen = true;
    },
    thaw() {
      frozen = false;
      wake();
    },
    angleOf(index) {
      return angles[index] ?? 0;
    },
    nudge(steps) {
      shift(steps * opts.step);
    },
    destroy() {
      stop();
      stage.removeEventListener('pointerover', onOver);
      stage.removeEventListener('pointerout', onOut);
      stage.removeEventListener('pointerdown', onDown);
      stage.removeEventListener('pointermove', onMove);
      stage.removeEventListener('pointerup', onUp);
      stage.removeEventListener('pointercancel', onUp);
      stage.removeEventListener('click', onClickCapture, true);
      stage.removeEventListener('wheel', onWheel);
      document.removeEventListener('visibilitychange', onVisibility);
      reduceMotion.removeEventListener('change', onMotionPreferenceChange);
    },
  };
}
