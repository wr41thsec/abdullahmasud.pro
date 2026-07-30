/**
 * Theme control.
 *
 * The primary gesture is a double-click on the background, as specified. Three
 * things make that workable rather than a bug report:
 *
 *  1. It ignores double-clicks that land on a card, the name, or the panel —
 *     otherwise opening a card would also flip the theme.
 *  2. It is announced once, because an invisible gesture is an unusable one.
 *  3. It is not the only way in. Double-click has no keyboard equivalent, so
 *     `T` toggles too and a focusable button carries the accessible label.
 *     Without that, the page's only setting would exclude keyboard and
 *     screen-reader users entirely.
 */

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'theme';
const HINT_KEY = 'theme-hint-seen';

/** Anything inside these is a real target, not background. */
const INTERACTIVE = '.card, h1, [data-panel], button, a, input, [role="dialog"]';

const read = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    // Safari in private mode throws on any localStorage access.
    return null;
  }
};

const write = (key: string, value: string): void => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* Preference simply won't persist. Not worth failing over. */
  }
};

const current = (): Theme =>
  document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';

function apply(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  write(STORAGE_KEY, theme);

  // Keep the browser chrome in step with the page.
  document
    .querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')
    .forEach((m) => m.remove());
  const meta = document.createElement('meta');
  meta.name = 'theme-color';
  meta.content = theme === 'dark' ? '#0a0a0c' : '#ffffff';
  document.head.appendChild(meta);
}

export function initTheme(): void {
  const toggle = (): void => {
    apply(current() === 'dark' ? 'light' : 'dark');
    dismissHint();
  };

  // ─── Double-click the background ───────────────────────────
  document.addEventListener('dblclick', (event) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest(INTERACTIVE)) return;
    toggle();
  });

  // ─── Keyboard ──────────────────────────────────────────────
  document.addEventListener('keydown', (event) => {
    if (event.key !== 't' && event.key !== 'T') return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;

    // Don't hijack the key while someone is typing.
    const el = document.activeElement as HTMLElement | null;
    if (el?.matches('input, textarea, [contenteditable="true"]')) return;

    toggle();
  });

  // ─── The labelled control, for assistive tech ──────────────
  const button = document.querySelector<HTMLButtonElement>('[data-theme-toggle]');
  button?.addEventListener('click', toggle);

  // ─── The hint ──────────────────────────────────────────────
  const hint = document.querySelector<HTMLElement>('[data-theme-hint]');
  if (hint && !read(HINT_KEY)) {
    // Late enough that it reads as an offer rather than an interruption.
    window.setTimeout(() => hint.setAttribute('data-visible', 'true'), 2200);
  }
}

function dismissHint(): void {
  const hint = document.querySelector<HTMLElement>('[data-theme-hint]');
  if (!hint) return;
  hint.removeAttribute('data-visible');
  write(HINT_KEY, '1');
}
