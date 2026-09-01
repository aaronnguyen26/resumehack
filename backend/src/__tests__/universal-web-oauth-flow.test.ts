import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateCodeVerifier,
  generateCodeChallenge,
  base64UrlEncode,
  getRedirectUri,
  buildGoogleAuthUrl,
  exchangeCodeForTokens,
  GOOGLE_OAUTH_SCOPES,
} from '../services/google-auth.js';

describe('Universal Web OAuth & PKCE Flow (Comet, Brave, Chrome Compatibility)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('generates compliant PKCE code verifier and S256 challenge', async () => {
    const verifier = generateCodeVerifier();
    expect(verifier).toBeDefined();
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);

    const challenge = await generateCodeChallenge(verifier);
    expect(challenge).toBeDefined();
    expect(challenge.length).toBeGreaterThanOrEqual(43);
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);

    // Determinism test for specific input
    const testBytes = new Uint8Array([1, 2, 3, 4, 5]);
    const encoded = base64UrlEncode(testBytes);
    expect(encoded).toBe('AQIDBAU');
  });

  it('computes correct extension redirect URI for Chromium extension identity', () => {
    // Default fallback without chrome.identity.getRedirectURL
    const uri = getRedirectUri();
    expect(uri).toContain('.chromiumapp.org');
    expect(uri).toMatch(/^https:\/\/[a-z0-9]+\.chromiumapp\.org\/$/);
  });

  it('constructs complete Google OAuth 2.0 authorization URL with all required PKCE and offline parameters', async () => {
    const { url, codeVerifier, redirectUri } = await buildGoogleAuthUrl({
      clientId: 'test-client-id-123.apps.googleusercontent.com',
      redirectUri: 'https://kbakfoemmncocbiofdcdgkphiappodol.chromiumapp.org/',
    });

    const parsed = new URL(url);
    expect(parsed.origin).toBe('https://accounts.google.com');
    expect(parsed.pathname).toBe('/o/oauth2/v2/auth');
    expect(parsed.searchParams.get('client_id')).toBe('test-client-id-123.apps.googleusercontent.com');
    expect(parsed.searchParams.get('redirect_uri')).toBe('https://kbakfoemmncocbiofdcdgkphiappodol.chromiumapp.org/');
    expect(parsed.searchParams.get('response_type')).toBe('code');
    expect(parsed.searchParams.get('code_challenge_method')).toBe('S256');
    expect(parsed.searchParams.get('code_challenge')).toBeDefined();
    expect(parsed.searchParams.get('access_type')).toBe('offline');
    expect(parsed.searchParams.get('prompt')).toBe('consent');
    expect(parsed.searchParams.get('scope')).toContain('https://www.googleapis.com/auth/documents');
    expect(parsed.searchParams.get('scope')).toContain('https://www.googleapis.com/auth/drive.file');
    expect(parsed.searchParams.get('scope')).not.toContain('https://www.googleapis.com/auth/drive.readonly');
  });

  it('exchanges authorization code for access and refresh tokens at token endpoint', async () => {
    const mockResponse = {
      access_token: 'ya29.sample_web_access_token_123',
      refresh_token: '1//0g_sample_permanent_refresh_token',
      expires_in: 3599,
      token_type: 'Bearer',
      scope: GOOGLE_OAUTH_SCOPES.join(' '),
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as any);

    const result = await exchangeCodeForTokens({
      code: '4/0Ab8_sample_auth_code',
      codeVerifier: 'sample_verifier_string_123456789012345678901234567890',
      redirectUri: 'https://kbakfoemmncocbiofdcdgkphiappodol.chromiumapp.org/',
      clientId: '412130143258-4b1t8drhkii7hqagt7sdvd8n3qmchl8i.apps.googleusercontent.com',
    });

    expect(result.success).toBe(true);
    expect(result.accessToken).toBe('ya29.sample_web_access_token_123');
    expect(result.refreshToken).toBe('1//0g_sample_permanent_refresh_token');
    expect(result.expiresIn).toBe(3599);
  });

  it('handles and returns clean error descriptions when token exchange fails', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        error: 'invalid_grant',
        error_description: 'Bad Request: Code has expired or has already been used.',
      }),
    } as any);

    const result = await exchangeCodeForTokens({
      code: 'expired_code',
      codeVerifier: 'verifier',
      redirectUri: 'https://kbakfoemmncocbiofdcdgkphiappodol.chromiumapp.org/',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Bad Request: Code has expired');
  });
});
