export type ThemeMode = 'light' | 'dark' | 'system';

export const THEME_STORAGE_KEY = 'resumehack_theme_mode';

/**
 * Checks whether the operating system currently prefers dark mode.
 */
export function getSystemPrefersDark(): boolean {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  return false;
}

/**
 * Determines whether the dark class should be active based on the theme mode.
 */
export function resolveIsDark(mode: ThemeMode): boolean {
  if (mode === 'dark') return true;
  if (mode === 'light') return false;
  return getSystemPrefersDark();
}

/**
 * Retrieves the stored theme preference.
 * Defaults to 'system' if not explicitly configured.
 */
export async function getStoredThemeMode(): Promise<ThemeMode> {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    return new Promise((resolve) => {
      chrome.storage.local.get([THEME_STORAGE_KEY], (res) => {
        const stored = res?.[THEME_STORAGE_KEY] as ThemeMode | undefined;
        if (stored === 'light' || stored === 'dark' || stored === 'system') {
          resolve(stored);
        } else {
          resolve('system');
        }
      });
    });
  }

  try {
    const local = localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null;
    if (local === 'light' || local === 'dark' || local === 'system') {
      return local;
    }
  } catch {}

  return 'system';
}

/**
 * Persists the user's theme preference and updates the DOM class immediately.
 */
export async function saveStoredThemeMode(mode: ThemeMode): Promise<void> {
  applyTheme(mode);

  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    await new Promise<void>((resolve) => {
      chrome.storage.local.set({ [THEME_STORAGE_KEY]: mode }, () => resolve());
    });
    return;
  }

  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {}
}

/**
 * Applies or removes the 'dark' class on document.documentElement.
 */
export function applyTheme(mode: ThemeMode): boolean {
  if (typeof document === 'undefined') return false;
  const isDark = resolveIsDark(mode);
  const root = document.documentElement;

  if (isDark) {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }

  return isDark;
}

/**
 * Initializes the theme on application load and registers a listener
 * for system preference changes when in 'system' mode.
 */
export function initTheme(onThemeChange?: (isDark: boolean, mode: ThemeMode) => void): () => void {
  let currentMode: ThemeMode = 'system';

  getStoredThemeMode().then((mode) => {
    currentMode = mode;
    const isDark = applyTheme(mode);
    onThemeChange?.(isDark, mode);
  });

  const mediaQuery = typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null;

  const handleMediaChange = () => {
    if (currentMode === 'system') {
      const isDark = applyTheme('system');
      onThemeChange?.(isDark, 'system');
    }
  };

  mediaQuery?.addEventListener?.('change', handleMediaChange);

  // Return cleanup function
  return () => {
    mediaQuery?.removeEventListener?.('change', handleMediaChange);
  };
}
