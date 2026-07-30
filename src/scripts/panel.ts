/**
 * The detail panel.
 *
 * Opening freezes the ring — a card cannot both be read and be moving — and
 * the dialog grows out of the clicked card's position on screen, so the
 * connection between what was clicked and what opened is never in doubt.
 *
 * The accessibility work here is not optional decoration: a modal that
 * doesn't trap focus lets keyboard users tab into the frozen page behind it
 * with no way to tell they've left, which is worse than having no modal.
 */

const FOCUSABLE =
  'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function initPanel(): void {
  const panel = document.querySelector<HTMLElement>('[data-panel]');
  const dialog = document.querySelector<HTMLElement>('[data-panel-dialog]');
  if (!panel || !dialog) return;

  let lastFocused: HTMLElement | null = null;
  let open = false;

  const sections = new Map<string, HTMLElement>();
  panel.querySelectorAll<HTMLElement>('[data-panel-for]').forEach((el) => {
    sections.set(el.dataset.panelFor!, el);
  });

  /**
   * `origin` is the card, used only for geometry. `focusTarget` is the button
   * inside it, which is where focus must return on close — the card itself is
   * an <article> and calling .focus() on it does nothing at all, silently.
   */
  const show = (id: string, origin: HTMLElement, focusTarget: HTMLElement): void => {
    const section = sections.get(id);
    if (!section || open) return;

    sections.forEach((el) => {
      el.hidden = el !== section;
    });

    lastFocused = focusTarget;

    // Grow the dialog out of the card. The dialog is centred, so the origin
    // is expressed relative to the dialog's own box.
    const cardBox = origin.getBoundingClientRect();
    panel.hidden = false;
    const dialogBox = dialog.getBoundingClientRect();
    const ox = cardBox.left + cardBox.width / 2 - dialogBox.left;
    const oy = cardBox.top + cardBox.height / 2 - dialogBox.top;
    dialog.style.transformOrigin = `${ox.toFixed(1)}px ${oy.toFixed(1)}px`;

    // Hold the ring still while the panel is up.
    window.__arc?.freeze();

    // Scroll lock. The stage never scrolls, but a phone can still rubber-band
    // the page out from under a fixed overlay.
    document.documentElement.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';

    // Force a style flush so the transition has a committed start state to
    // animate from. Deliberately not requestAnimationFrame: rAF is throttled
    // in a background or embedded tab, and the panel would then open stuck at
    // opacity 0 with no way back.
    void dialog.offsetWidth;
    panel.dataset.open = 'true';

    open = true;

    const first = dialog.querySelector<HTMLElement>('[data-panel-close]');
    first?.focus();
  };

  const hide = (): void => {
    if (!open) return;
    open = false;

    delete panel.dataset.open;
    window.__arc?.thaw();
    document.documentElement.style.overflow = '';
    document.body.style.touchAction = '';

    const finish = (): void => {
      panel.hidden = true;
      dialog.style.transformOrigin = '';
    };

    // Wait out the exit transition, but don't hang forever if it never fires
    // (reduced-motion removes it entirely).
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) finish();
    else {
      let done = false;
      const once = (): void => {
        if (done) return;
        done = true;
        finish();
      };
      dialog.addEventListener('transitionend', once, { once: true });
      window.setTimeout(once, 460);
    }

    // Return focus to the card that opened this, not to the top of the page.
    lastFocused?.focus();
    lastFocused = null;
  };

  // ─── Open triggers ──────────────────────────────────────────
  document.addEventListener('click', (event) => {
    const trigger = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-open]');
    if (!trigger) return;
    const id = trigger.dataset.open;
    if (!id) return;
    event.preventDefault();
    show(id, trigger.closest<HTMLElement>('.card') ?? trigger, trigger);
  });

  // ─── Close triggers ─────────────────────────────────────────
  panel.querySelector('[data-panel-close]')?.addEventListener('click', hide);
  panel.querySelector('[data-panel-backdrop]')?.addEventListener('click', hide);

  document.addEventListener('keydown', (event) => {
    if (!open) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      hide();
      return;
    }

    // ─── Focus trap ───────────────────────────────────────────
    if (event.key !== 'Tab') return;

    const items = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
      (el) => el.offsetParent !== null,
    );
    if (items.length === 0) return;

    const first = items[0]!;
    const last = items[items.length - 1]!;
    const active = document.activeElement;

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  });
}
