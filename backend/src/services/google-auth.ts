export const GOOGLE_WEB_CLIENT_ID = '412130143258-9cd7652sbbfn8ldqgj9lh74clpvccqup.apps.googleusercontent.com';
export const GOOGLE_EXTENSION_CLIENT_ID = '412130143258-4b1t8drhkii7hqagt7sdvd8n3qmchl8i.apps.googleusercontent.com';

export const GOOGLE_OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/documents',
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

export function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(array);
  } else {
    for (let i = 0; i < 32; i++) array[i] = Math.floor(Math.random() * 256);
  }
  return base64UrlEncode(array);
}

export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  if (typeof crypto !== 'undefined' && crypto.subtle && crypto.subtle.digest) {
    const digest = await crypto.subtle.digest('SHA-256', data);
    return base64UrlEncode(new Uint8Array(digest));
  }
  return verifier;
}

export function getRedirectUri(customPath?: string): string {
  if (typeof chrome !== 'undefined' && (chrome as any).identity && typeof (chrome as any).identity.getRedirectURL === 'function') {
    return (chrome as any).identity.getRedirectURL(customPath);
  }
  const extId = typeof chrome !== 'undefined' && (chrome as any).runtime?.id ? (chrome as any).runtime.id : 'kbakfoemmncocbiofdcdgkphiappodol';
  return `https://${extId}.chromiumapp.org/${customPath || ''}`;
}

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
