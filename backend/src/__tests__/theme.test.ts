import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

export type ThemeMode = 'light' | 'dark' | 'system';
export const THEME_STORAGE_KEY = 'resumehack_theme_mode';

function getSystemPrefersDark(): boolean {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  return false;
}

function resolveIsDark(mode: ThemeMode): boolean {
  if (mode === 'dark') return true;
  if (mode === 'light') return false;
  return getSystemPrefersDark();
}

async function getStoredThemeMode(): Promise<ThemeMode> {
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
  return 'system';
}

async function saveStoredThemeMode(mode: ThemeMode): Promise<void> {
  applyTheme(mode);
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    await new Promise<void>((resolve) => {
      chrome.storage.local.set({ [THEME_STORAGE_KEY]: mode }, () => resolve());
    });
  }
}

function applyTheme(mode: ThemeMode): boolean {
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

describe('Theme Mode & Dark Mode Suite', () => {
  let mockStorage: Record<string, any> = {};
  let mockClassList: Set<string>;

  beforeEach(() => {
    mockStorage = {};
    mockClassList = new Set<string>();

    (globalThis as any).document = {
      documentElement: {
        classList: {
          add: vi.fn((cls: string) => mockClassList.add(cls)),
          remove: vi.fn((cls: string) => mockClassList.delete(cls)),
          contains: vi.fn((cls: string) => mockClassList.has(cls)),
        },
      },
    };

    (globalThis as any).chrome = {
      storage: {
        local: {
          get: vi.fn((keys: string[], cb: (res: any) => void) => {
            const res: Record<string, any> = {};
            for (const k of keys) {
              if (mockStorage[k] !== undefined) res[k] = mockStorage[k];
            }
            cb(res);
          }),
          set: vi.fn((items: Record<string, any>, cb?: () => void) => {
            Object.assign(mockStorage, items);
            cb?.();
          }),
        },
      },
    };

    (globalThis as any).window = {
      matchMedia: vi.fn((query: string) => ({
        matches: query.includes('dark'),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    };
  });

  afterEach(() => {
    delete (globalThis as any).document;
    delete (globalThis as any).chrome;
    delete (globalThis as any).window;
  });

  it('resolveIsDark returns true when mode is dark', () => {
    expect(resolveIsDark('dark')).toBe(true);
  });

  it('resolveIsDark returns false when mode is light', () => {
    expect(resolveIsDark('light')).toBe(false);
  });

  it('resolveIsDark resolves according to system prefers-color-scheme when mode is system', () => {
    expect(resolveIsDark('system')).toBe(true); // matches 'dark' in mock
  });

  it('applyTheme adds dark class when mode is dark', () => {
    const isDark = applyTheme('dark');
    expect(isDark).toBe(true);
    expect(mockClassList.has('dark')).toBe(true);
  });

  it('applyTheme removes dark class when mode is light', () => {
    mockClassList.add('dark');
    const isDark = applyTheme('light');
    expect(isDark).toBe(false);
    expect(mockClassList.has('dark')).toBe(false);
  });

  it('getStoredThemeMode defaults to system when nothing stored', async () => {
    const mode = await getStoredThemeMode();
    expect(mode).toBe('system');
  });

  it('saveStoredThemeMode persists mode in chrome.storage and updates DOM', async () => {
    await saveStoredThemeMode('dark');
    expect(mockStorage[THEME_STORAGE_KEY]).toBe('dark');
    expect(mockClassList.has('dark')).toBe(true);

    await saveStoredThemeMode('light');
    expect(mockStorage[THEME_STORAGE_KEY]).toBe('light');
    expect(mockClassList.has('dark')).toBe(false);
  });
});
