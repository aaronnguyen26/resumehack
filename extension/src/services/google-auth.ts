import { setGoogleAccessToken, saveStoredSettings, getStoredSettings } from './storage.js';

export const GOOGLE_WEB_CLIENT_ID = '412130143258-9cd7652sbbfn8ldqgj9lh74clpvccqup.apps.googleusercontent.com';
export const GOOGLE_EXTENSION_CLIENT_ID = '412130143258-4b1t8drhkii7hqagt7sdvd8n3qmchl8i.apps.googleusercontent.com';

export const GOOGLE_OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

export interface AuthResult {
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  email?: string;
  method?: 'getAuthToken' | 'launchWebAuthFlow';
  error?: string;
  rawError?: any;
}

/**
 * Base64-URL encoder compliant with RFC 7636
 */
export function base64UrlEncode(bytes: Uint8Array): string {
  let str = '';
  for (let i = 0; i < bytes.length; i++) {
    str += String.fromCharCode(bytes[i]);
  }
  return btoa(str)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Generates a cryptographic random 32-byte string as PKCE code_verifier
 */
export function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(array);
  } else {
    for (let i = 0; i < 32; i++) array[i] = Math.floor(Math.random() * 256);
  }
  return base64UrlEncode(array);
}

/**
 * Generates the SHA-256 code_challenge from code_verifier (S256 method)
 */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  if (typeof crypto !== 'undefined' && crypto.subtle && crypto.subtle.digest) {
    const digest = await crypto.subtle.digest('SHA-256', data);
    return base64UrlEncode(new Uint8Array(digest));
  }
  return verifier; // fallback
}

/**
 * Computes standard extension redirect URI (e.g. https://<extension-id>.chromiumapp.org/)
 */
export function getRedirectUri(customPath?: string): string {
  if (typeof chrome !== 'undefined' && chrome.identity && typeof chrome.identity.getRedirectURL === 'function') {
    return chrome.identity.getRedirectURL(customPath);
  }
  const extId = typeof chrome !== 'undefined' && chrome.runtime?.id ? chrome.runtime.id : 'kbakfoemmncocbiofdcdgkphiappodol';
  return `https://${extId}.chromiumapp.org/${customPath || ''}`;
}

/**
 * Builds the Google OAuth 2.0 authorization URL with PKCE parameters
 * Uses the Web Application Client ID registered with the redirect URI.
 */
export async function buildGoogleAuthUrl(options?: {
  clientId?: string;
  redirectUri?: string;
  scopes?: string[];
  codeChallenge?: string;
  prompt?: string;
}): Promise<{ url: string; codeVerifier: string; redirectUri: string }> {
  const clientId = options?.clientId || GOOGLE_WEB_CLIENT_ID;
  const redirectUri = options?.redirectUri || getRedirectUri();
  const scopes = options?.scopes || GOOGLE_OAUTH_SCOPES;
  const prompt = options?.prompt || 'consent';

  const codeVerifier = generateCodeVerifier();
  const codeChallenge = options?.codeChallenge || (await generateCodeChallenge(codeVerifier));

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', clientId.trim());
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', scopes.join(' '));
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', prompt);
  authUrl.searchParams.set('include_granted_scopes', 'true');

  return {
    url: authUrl.toString(),
    codeVerifier,
    redirectUri,
  };
}

/**
 * Exchanges authorization code for access and refresh tokens
 * Routes through the local backend proxy to attach client_secret safely server-side,
 * with direct PKCE exchange as a fallback.
 */
export async function exchangeCodeForTokens(params: {
  code: string;
  codeVerifier: string;
  redirectUri: string;
  clientId?: string;
  clientSecret?: string;
}): Promise<{
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  error?: string;
}> {
  const clientId = params.clientId || GOOGLE_WEB_CLIENT_ID;

  // 1. First attempt: Backend Proxy (server-side client_secret attachment)
  try {
    const backendRes = await fetch('http://localhost:3001/api/auth/google/exchange', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: params.code.trim(),
        codeVerifier: params.codeVerifier.trim(),
        redirectUri: params.redirectUri,
        clientId: clientId.trim(),
      }),
    });

    if (backendRes.ok) {
      const data = await backendRes.json();
      if (data?.accessToken || data?.access_token) {
        console.log('[GoogleAuth] Token exchange succeeded via backend proxy.');
        return {
          success: true,
          accessToken: data.accessToken || data.access_token,
          refreshToken: data.refreshToken || data.refresh_token,
          expiresIn: data.expiresIn || data.expires_in || 3600,
        };
      }
    }
  } catch (backendErr) {
    console.debug('[GoogleAuth] Backend exchange proxy note (falling back to direct exchange):', backendErr);
  }

  // 2. Fallback: Direct Google Token Endpoint Exchange
  const bodyParams = new URLSearchParams({
    client_id: clientId.trim(),
    code: params.code.trim(),
    code_verifier: params.codeVerifier.trim(),
    grant_type: 'authorization_code',
    redirect_uri: params.redirectUri,
  });

  if (params.clientSecret) {
    bodyParams.append('client_secret', params.clientSecret.trim());
  }

  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: bodyParams.toString(),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const errMsg = data?.error_description || data?.error || `HTTP ${res.status}`;
      return { success: false, error: errMsg };
    }

    return {
      success: true,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in || 3600,
    };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error exchanging code' };
  }
}

/**
 * Fetches user info from Google's userinfo endpoint using access token
 */
export async function fetchGoogleUserInfo(accessToken: string): Promise<{ email?: string; name?: string } | null> {
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.ok) {
      const data = await res.json();
      return { email: data.email, name: data.name };
    }
  } catch {}
  return null;
}

/**
 * Primary Web Flow: Authenticates via chrome.identity.launchWebAuthFlow() + PKCE
 * Supported in ALL Chromium browsers (Comet, Chrome, Brave, Edge, Vivaldi, Arc, etc.)
 */
export async function launchGoogleWebAuthFlow(interactive: boolean = true): Promise<AuthResult> {
  if (typeof chrome === 'undefined' || !chrome.identity?.launchWebAuthFlow) {
    return {
      success: false,
      error: 'chrome.identity.launchWebAuthFlow API is not available in this environment.',
    };
  }

  try {
    const { url: authUrl, codeVerifier, redirectUri } = await buildGoogleAuthUrl({
      clientId: GOOGLE_WEB_CLIENT_ID,
    });
    console.log('[GoogleAuth] Launching WebAuthFlow:', { authUrl, redirectUri });

    const redirectResponseUrl = await new Promise<string>((resolve, reject) => {
      chrome.identity.launchWebAuthFlow(
        {
          url: authUrl,
          interactive,
        },
        (responseUrl) => {
          if (chrome.runtime?.lastError || !responseUrl) {
            const err = chrome.runtime?.lastError?.message || 'Web auth flow was closed or cancelled';
            reject(new Error(err));
          } else {
            resolve(responseUrl);
          }
        }
      );
    });

    console.log('[GoogleAuth] WebAuthFlow returned response URL:', redirectResponseUrl);

    // Parse authorization code or implicit token from response URL
    const parsedUrl = new URL(redirectResponseUrl);
    const code = parsedUrl.searchParams.get('code');
    const hashParams = new URLSearchParams(parsedUrl.hash.replace(/^#/, ''));
    const implicitToken = hashParams.get('access_token');
    const urlError = parsedUrl.searchParams.get('error') || hashParams.get('error');

    if (urlError) {
      return {
        success: false,
        error: `Google OAuth Error: ${urlError}`,
        method: 'launchWebAuthFlow',
      };
    }

    if (code) {
      console.log('[GoogleAuth] Exchanging authorization code for tokens...');
      const exchange = await exchangeCodeForTokens({
        code,
        codeVerifier,
        redirectUri,
        clientId: GOOGLE_WEB_CLIENT_ID,
      });

      if (!exchange.success || !exchange.accessToken) {
        return {
          success: false,
          error: exchange.error || 'Failed to exchange authorization code for access token',
          method: 'launchWebAuthFlow',
        };
      }

      const expiresIn = exchange.expiresIn || 3500;
      await setGoogleAccessToken(exchange.accessToken, expiresIn);

      if (exchange.refreshToken) {
        await saveStoredSettings({
          googleAccessToken: exchange.accessToken,
          googleRefreshToken: exchange.refreshToken,
          googleClientId: GOOGLE_WEB_CLIENT_ID,
          googleTokenExpiresAt: Date.now() + expiresIn * 1000,
        });
      }

      const userInfo = await fetchGoogleUserInfo(exchange.accessToken);
      if (userInfo?.email) {
        await saveStoredSettings({ googleUserEmail: userInfo.email });
      }

      return {
        success: true,
        accessToken: exchange.accessToken,
        refreshToken: exchange.refreshToken,
        email: userInfo?.email,
        method: 'launchWebAuthFlow',
      };
    }

    if (implicitToken) {
      const expiresIn = Number(hashParams.get('expires_in')) || 3500;
      await setGoogleAccessToken(implicitToken, expiresIn);
      const userInfo = await fetchGoogleUserInfo(implicitToken);
      if (userInfo?.email) {
        await saveStoredSettings({ googleUserEmail: userInfo.email });
      }
      return {
        success: true,
        accessToken: implicitToken,
        email: userInfo?.email,
        method: 'launchWebAuthFlow',
      };
    }

    return {
      success: false,
      error: 'No authorization code or token found in redirect response',
      method: 'launchWebAuthFlow',
    };
  } catch (err: any) {
    console.error('[GoogleAuth] launchWebAuthFlow error:', err);
    return {
      success: false,
      error: err?.message || 'Error during Web Auth Flow',
      rawError: err,
      method: 'launchWebAuthFlow',
    };
  }
}

/**
 * Universal Hybrid Connect: Tries native getAuthToken first, automatically
 * falls back to launchWebAuthFlow() with PKCE if getAuthToken is unsupported (e.g. in Comet/Brave).
 */
export async function authenticateGoogleAccount(interactive: boolean = true): Promise<AuthResult> {
  // Check if getAuthToken is available and works
  if (typeof chrome !== 'undefined' && chrome.identity?.getAuthToken) {
    try {
      const nativeResult = await new Promise<AuthResult>((resolve) => {
        chrome.identity.getAuthToken({ interactive }, async (tok) => {
          if (chrome.runtime?.lastError || !tok) {
            const rawMsg = chrome.runtime?.lastError?.message || 'Native OAuth failed';
            console.warn('[GoogleAuth] Native getAuthToken note (falling back to launchWebAuthFlow):', rawMsg);
            resolve({ success: false, error: rawMsg, method: 'getAuthToken' });
          } else {
            const tokenStr = tok as string;
            await setGoogleAccessToken(tokenStr, 3300);
            const userInfo = await fetchGoogleUserInfo(tokenStr);
            if (userInfo?.email) {
              await saveStoredSettings({ googleUserEmail: userInfo.email });
            }
            resolve({
              success: true,
              accessToken: tokenStr,
              email: userInfo?.email,
              method: 'getAuthToken',
            });
          }
        });
      });

      if (nativeResult.success) {
        return nativeResult;
      }
    } catch (err) {
      console.debug('[GoogleAuth] Native auth exception:', err);
    }
  }

  // Universal Fallback: launchWebAuthFlow() with PKCE (Comet, Edge, Brave, Vivaldi, etc.)
  console.log('[GoogleAuth] Initiating launchWebAuthFlow with PKCE fallback using Web client ID...');
  return await launchGoogleWebAuthFlow(interactive);
}
