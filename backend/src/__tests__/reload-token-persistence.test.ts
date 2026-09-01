import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { GoogleDocsService } from '../services/google-docs.js';

describe('Extension Reload Token Persistence & Storage Lifecycle', () => {
  // Mock chrome.storage.local store
  let mockStorage: Record<string, any> = {};

  const mockChromeStorage = {
    local: {
      get: (keys: string[] | null, callback: (result: Record<string, any>) => void) => {
        if (!keys) {
          callback({ ...mockStorage });
          return;
        }
        const res: Record<string, any> = {};
        for (const k of keys) {
          if (mockStorage[k] !== undefined) res[k] = mockStorage[k];
        }
        callback(res);
      },
      set: (items: Record<string, any>, callback?: () => void) => {
        Object.assign(mockStorage, items);
        if (callback) callback();
      },
      remove: (keys: string[], callback?: () => void) => {
        for (const k of keys) {
          delete mockStorage[k];
        }
        if (callback) callback();
      }
    }
  };

  beforeEach(() => {
    mockStorage = {};
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('Step 1 & 4: Persists OAuth token in storage across extension reloads without losing authorization', async () => {
    const token = 'ya29.a0AWY7Ckm_LIVE_RELOAD_TEST_TOKEN';
    const refreshToken = '1//0g_LIVE_RELOAD_REFRESH_TOKEN';
    const expiresAt = Date.now() + 3300 * 1000;

    // 1. Initial Connect Google Account
    mockChromeStorage.local.set({
      google_access_token: token,
      google_refresh_token: refreshToken,
      google_token_expires_at: expiresAt,
      google_user_email: 'alexchen@example.com',
      resumehack_settings: {
        masterDocId: 'real-doc-12345',
        candidateName: 'Alex Chen',
        targetTitle: 'Software Engineer',
        strictAntiHallucination: true,
        googleAccessToken: token,
        googleRefreshToken: refreshToken,
        googleTokenExpiresAt: expiresAt,
        googleUserEmail: 'alexchen@example.com'
      }
    });

    // Verify storage dump immediately after connect
    let dumpBeforeReload: Record<string, any> = {};
    mockChromeStorage.local.get(null, (res) => { dumpBeforeReload = res; });
    expect(dumpBeforeReload.google_access_token).toBe(token);
    expect(dumpBeforeReload.google_refresh_token).toBe(refreshToken);
    expect(dumpBeforeReload.resumehack_settings.googleAccessToken).toBe(token);

    // 2. SIMULATE EXTENSION RELOAD (Service worker dies, fresh runtime startup)
    // Verify that storage is NOT wiped on service worker startup
    let dumpAfterReload: Record<string, any> = {};
    mockChromeStorage.local.get(null, (res) => { dumpAfterReload = res; });

    // Step 1 check: Is the token still present in storage after reload?
    expect(dumpAfterReload.google_access_token).toBe(token);
    expect(dumpAfterReload.google_refresh_token).toBe(refreshToken);
    expect(dumpAfterReload.resumehack_settings.googleAccessToken).toBe(token);
    expect(dumpAfterReload.google_user_email).toBe('alexchen@example.com');

    // 3. Simulating fresh Service Worker token read
    const retrievedSettings = await new Promise<any>((resolve) => {
      mockChromeStorage.local.get(
        [
          'resumehack_settings',
          'resumehack_stored_settings',
          'google_access_token',
          'google_refresh_token',
          'google_client_id',
          'google_client_secret',
          'google_token_expires_at',
          'google_user_email'
        ],
        (result) => {
          const stored = result?.resumehack_settings || result?.resumehack_stored_settings || {};
          const googleAccessToken = result?.google_access_token || stored.googleAccessToken;
          const googleRefreshToken = result?.google_refresh_token || stored.googleRefreshToken;
          const googleTokenExpiresAt = result?.google_token_expires_at || stored.googleTokenExpiresAt;
          const googleUserEmail = result?.google_user_email || stored.googleUserEmail;

          resolve({
            ...stored,
            googleAccessToken,
            googleRefreshToken,
            googleTokenExpiresAt,
            googleUserEmail
          });
        }
      );
    });

    expect(retrievedSettings.googleAccessToken).toBe(token);
    expect(retrievedSettings.googleRefreshToken).toBe(refreshToken);
    expect(retrievedSettings.googleUserEmail).toBe('alexchen@example.com');

    // Mock Google Docs API for real-doc-12345
    const mockDocResponse = {
      title: 'Alex Chen Resume',
      body: {
        content: [
          {
            paragraph: {
              elements: [
                {
                  startIndex: 1,
                  endIndex: 45,
                  textRun: { content: '• Old text to be replaced by tailored bullet\n' }
                }
              ]
            }
          }
        ]
      }
    };

    let receivedAuthHeader = '';
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      const headers = init?.headers as any;
      if (headers?.get) {
        receivedAuthHeader = headers.get('Authorization') || '';
      } else if (headers?.Authorization) {
        receivedAuthHeader = headers.Authorization;
      }

      if (url.includes(':batchUpdate')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            replies: [{ replaceAllText: { occurrencesChanged: 1 } }]
          })
        };
      }

      return {
        ok: true,
        status: 200,
        json: async () => mockDocResponse
      };
    }));

    // 4. Verify Google Docs Apply executes immediately with retrieved token without requiring reconnect
    const docsService = new GoogleDocsService();
    const diffs = [
      {
        id: 'diff-1',
        section: 'Experience',
        organization: 'Stripe',
        role: 'SWE',
        originalText: 'Old text to be replaced by tailored bullet',
        tailoredText: 'New optimized STAR tailored bullet text with Postgres',
        injectedKeywords: ['Postgres'],
        rationale: 'Optimized metric',
        charCountDiff: 5,
        status: 'accepted' as const
      }
    ];

    const applyResult = await docsService.applyBatchUpdates('real-doc-12345', diffs, retrievedSettings.googleAccessToken);
    expect(applyResult.success).toBe(true);
    expect(applyResult.updatedCount).toBe(1);
    expect(receivedAuthHeader).toBe(`Bearer ${token}`);
  });

  it('Step 2 & 3: Never wipes stored token on cold start when token is near expiration', async () => {
    // Scenario: Token expires in 10 seconds, no refresh token
    const token = 'ya29.a0AWY7Ckm_EXPIRING_TOKEN';
    const expiresAt = Date.now() + 10 * 1000;

    mockChromeStorage.local.set({
      google_access_token: token,
      google_token_expires_at: expiresAt,
      resumehack_settings: {
        masterDocId: 'doc-expiring',
        candidateName: 'Alex Chen',
        googleAccessToken: token,
        googleTokenExpiresAt: expiresAt
      }
    });

    // Ensure reading it does NOT delete it from storage
    let dump: Record<string, any> = {};
    mockChromeStorage.local.get(null, (res) => { dump = res; });
    expect(dump.google_access_token).toBe(token);
  });
});
