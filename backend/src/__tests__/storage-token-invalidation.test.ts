import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getGoogleAccessToken,
  setGoogleAccessToken,
  invalidateCachedGoogleToken,
  saveStoredSettings,
  getStoredSettings,
  refreshGoogleAccessToken,
} from '../services/storage.js';

describe('Storage Token Invalidation & Silent Refresh Regression Suite', () => {
  let mockStorage: Record<string, any> = {};

  beforeEach(() => {
    mockStorage = {};
    vi.restoreAllMocks();

    // Mock chrome.storage.local
    (globalThis as any).chrome = {
      storage: {
        local: {
          get: vi.fn((keys: string[], cb: (res: any) => void) => {
            const res: Record<string, any> = {};
            for (const k of keys) {
              if (mockStorage[k] !== undefined) {
                res[k] = mockStorage[k];
              }
            }
            cb(res);
          }),
          set: vi.fn((items: Record<string, any>, cb?: () => void) => {
            Object.assign(mockStorage, items);
            cb?.();
          }),
          remove: vi.fn((keys: string[], cb?: () => void) => {
            for (const k of keys) {
              delete mockStorage[k];
            }
            cb?.();
          }),
        },
      },
      identity: {
        removeCachedAuthToken: vi.fn((opts: { token: string }, cb: () => void) => {
          cb();
        }),
      },
    };
  });

  afterEach(() => {
    delete (globalThis as any).chrome;
  });

  it('REGRESSION FIX: invalidateCachedGoogleToken completely clears stored access token from storage', async () => {
    // 1. Setup: Store a stale token that appears active
    await setGoogleAccessToken('ya29.stale_dead_token_123', 3600);

    const initialToken = await getGoogleAccessToken();
    expect(initialToken).toBe('ya29.stale_dead_token_123');

    // 2. Execute invalidation (as triggered by 401 recovery)
    await invalidateCachedGoogleToken('ya29.stale_dead_token_123');

    // 3. Verify chrome.identity cache removal was invoked
    expect((chrome as any).identity.removeCachedAuthToken).toHaveBeenCalledWith(
      { token: 'ya29.stale_dead_token_123' },
      expect.any(Function)
    );

    // 4. Critical assertion: Subsequent getGoogleAccessToken() MUST NOT return the stale token
    const afterInvalidationToken = await getGoogleAccessToken();
    expect(afterInvalidationToken).not.toBe('ya29.stale_dead_token_123');
    expect(afterInvalidationToken).toBeUndefined();

    // 5. Verify storage state is clean
    const settings = await getStoredSettings();
    expect(settings.googleAccessToken).toBeFalsy();
    expect(settings.googleTokenExpiresAt).toBe(0);
    expect(mockStorage['google_access_token']).toBeUndefined();
  });

  it('SILENT REFRESH: getGoogleAccessToken auto-triggers refreshGoogleAccessToken after invalidation when refresh token exists', async () => {
    // 1. Setup: Store a stale token along with a valid Google refresh token
    await saveStoredSettings({
      googleAccessToken: 'ya29.stale_expired_token_456',
      googleRefreshToken: '1//04_valid_refresh_token_xyz',
      googleTokenExpiresAt: Date.now() + 3600000,
    });

    // 2. Mock Google's OAuth2 token endpoint response
    const fetchSpy = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('oauth2.googleapis.com/token') || url.includes('refreshAccessToken')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            access_token: 'ya29.fresh_silent_refreshed_token_789',
            expires_in: 3600,
            token_type: 'Bearer',
          }),
        };
      }
      return { ok: false, status: 404 };
    });
    globalThis.fetch = fetchSpy as any;

    // 3. Invalidate the stale token
    await invalidateCachedGoogleToken('ya29.stale_expired_token_456');

    // 4. Call getGoogleAccessToken() -> should silently trigger refresh path without interactive consent
    const refreshedToken = await getGoogleAccessToken();

    expect(refreshedToken).toBe('ya29.fresh_silent_refreshed_token_789');

    // 5. Verify the newly refreshed token is persisted
    const updatedSettings = await getStoredSettings();
    expect(updatedSettings.googleAccessToken).toBe('ya29.fresh_silent_refreshed_token_789');
    expect(updatedSettings.googleRefreshToken).toBe('1//04_valid_refresh_token_xyz');
    expect(updatedSettings.googleTokenExpiresAt).toBeGreaterThan(Date.now());
  });
});
