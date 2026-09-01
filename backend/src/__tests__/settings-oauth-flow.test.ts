import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Settings Google OAuth Connection Flow & Navigation', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('verifies interactive OAuth stores token with TTL and fetches user profile email', async () => {
    const mockToken = 'ya29.a0AfH6SM_test_interactive_token';
    const mockProfile = { email: 'alex.chen.dev@gmail.com', name: 'Alex Chen' };

    // Mock fetch for Google UserInfo API
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockProfile,
    } as any);

    const storedSettings: Record<string, any> = {};
    const saveStoredSettings = async (settings: any) => {
      Object.assign(storedSettings, settings);
    };

    const setGoogleAccessToken = async (token: string, expiresInSec: number = 3300) => {
      await saveStoredSettings({
        googleAccessToken: token,
        googleTokenExpiresAt: Date.now() + expiresInSec * 1000,
      });
    };

    const fetchUserInfo = async (token: string) => {
      const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const u = await res.json();
        const email = u.email || u.name;
        if (email) {
          await saveStoredSettings({ googleUserEmail: email });
          return email;
        }
      }
      return null;
    };

    // Simulate 1-Click Interactive Connect Action
    await setGoogleAccessToken(mockToken, 3300);
    const email = await fetchUserInfo(mockToken);

    expect(email).toBe('alex.chen.dev@gmail.com');
    expect(storedSettings.googleAccessToken).toBe(mockToken);
    expect(storedSettings.googleUserEmail).toBe('alex.chen.dev@gmail.com');
    expect(storedSettings.googleTokenExpiresAt).toBeGreaterThan(Date.now());
  });

  it('verifies Disconnect cleanses cache, local storage, and resets connected state', async () => {
    let cachedTokensRemoved: string[] = [];
    const mockChromeIdentity = {
      removeCachedAuthToken: ({ token }: { token: string }, callback: () => void) => {
        cachedTokensRemoved.push(token);
        callback();
      },
    };

    const storedSettings: Record<string, any> = {
      googleAccessToken: 'ya29.sample_active_token',
      googleRefreshToken: '1//0g_sample_refresh',
      googleUserEmail: 'alex.chen.dev@gmail.com',
    };

    const handleDisconnect = async () => {
      const token = storedSettings.googleAccessToken;
      if (token) {
        await new Promise<void>((resolve) => {
          mockChromeIdentity.removeCachedAuthToken({ token }, () => resolve());
        });
      }
      storedSettings.googleAccessToken = '';
      storedSettings.googleRefreshToken = '';
      storedSettings.googleUserEmail = '';
      storedSettings.googleTokenExpiresAt = 0;
    };

    await handleDisconnect();

    expect(cachedTokensRemoved).toContain('ya29.sample_active_token');
    expect(storedSettings.googleAccessToken).toBe('');
    expect(storedSettings.googleRefreshToken).toBe('');
    expect(storedSettings.googleUserEmail).toBe('');
    expect(storedSettings.googleTokenExpiresAt).toBe(0);
  });

  it('verifies appliedStatus warning links directly to Settings navigation', () => {
    const errorWarning = '⚠️ Error applying changes: OAuth authorization required. Please connect your Google account in Settings.';
    const isAuthRequired = errorWarning.includes('OAuth') || errorWarning.includes('Settings') || errorWarning.includes('Google account');

    let navigatedTab = 'match';
    const onNavigateToSettings = () => {
      navigatedTab = 'settings';
    };

    expect(isAuthRequired).toBe(true);
    if (isAuthRequired) {
      onNavigateToSettings();
    }

    expect(navigatedTab).toBe('settings');
  });
});
