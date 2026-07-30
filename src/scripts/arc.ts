/**
 * The arc engine.
 *
 * Cards are laid on a circle whose centre sits far below the viewport. Each
 * card's position and tangential rotation come from a single CSS transform
 * (see Card.astro); this module's only job is to own one number — the ring's
 * angular drift — and write each card's resulting angle.
 *
 * The motion is deliberately uninterruptible: constant speed, one direction,
 * matching the reference clip. It does not pause on hover and has no drag.
 * The only thing that stops it is an open detail panel.
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
 * does the moment anyone presses the left arrow.
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
 * Advance the drift by one frame's worth of elapsed time.
 *
 * Time-based rather than a fixed per-frame increment: a constant per frame
 * runs at double speed on a 120Hz display, which would make the whole scene
 * device-dependent. `dt` is clamped so that returning to a backgrounded tab
 * doesn't jump the ring by however many seconds elapsed.
 */
export const advanceDrift = (
  drift: number,
  dtSeconds: number,
  degPerSecond: number,
  span: number,
): number => {
  const next = drift + degPerSecond * Math.min(Math.max(dtSeconds, 0), 0.1);
  // Keep drift bounded; unbounded growth degrades float precision in a tab
  // left open for days.
  return next >= span ? next - span : next;
};

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
 * Cards beyond this angle from centre are off-screen at every supported
 * viewport, so they stop painting. The wrap point sits outside this window,
 * which is what makes the loop seamless — a card jumping from one end of the
 * ring to the other does it where nobody can see.
 */
const OFFSTAGE_ANGLE = 26;

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

  const span = spanOf(n, opts.step);
  const degPerSecond = opts.step / opts.secondsPerCard;

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

  let drift = initialDrift(opts.step, n);
  let frozen = false;
  let raf = 0;
  let last = 0;
  const angles = new Float64Array(n);

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
    // Drive from elapsed time, not a per-frame constant. A fixed increment
    // per frame runs at double speed on a 120Hz display, which would make
    // the whole scene device-dependent.
    const dt = last === 0 ? 0 : (now - last) / 1000;
    last = now;

    if (!frozen) {
      drift = advanceDrift(drift, dt, degPerSecond, span);
      paint();
    }

    raf = requestAnimationFrame(tick);
  };

  const start = (): void => {
    if (raf !== 0 || reduceMotion.matches) return;
    last = 0;
    raf = requestAnimationFrame(tick);
  };

  const stop = (): void => {
    if (raf === 0) return;
    cancelAnimationFrame(raf);
    raf = 0;
  };

  // A background tab still fires rAF in some browsers and burns battery for
  // motion nobody is looking at.
  const onVisibility = (): void => {
    if (document.hidden) stop();
    else if (!frozen) start();
  };

  const onMotionPreferenceChange = (): void => {
    if (reduceMotion.matches) {
      stop();
      drift = initialDrift(opts.step, n);
    } else {
      start();
    }
    paint();
  };

  document.addEventListener('visibilitychange', onVisibility);
  reduceMotion.addEventListener('change', onMotionPreferenceChange);

  paint();
  start();

  return {
    freeze() {
      frozen = true;
      stop();
    },
    thaw() {
      frozen = false;
      if (!document.hidden) start();
    },
    angleOf(index) {
      return angles[index] ?? 0;
    },
    nudge(steps) {
      drift += steps * opts.step;
      paint();
    },
    destroy() {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
      reduceMotion.removeEventListener('change', onMotionPreferenceChange);
    },
  };
}
