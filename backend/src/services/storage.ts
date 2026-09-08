import { ApplicationRecord, ApplicantProfile } from '../types/index.js';

// New users start with an empty application tracker — no fake seed data.
const DEFAULT_APPLICATIONS: ApplicationRecord[] = [];

export interface StoredSettings {
  masterDocId: string;
  candidateName: string;
  targetTitle: string;
  strictAntiHallucination: boolean;
  googleAccessToken?: string;
  googleRefreshToken?: string;
  googleClientId?: string;
  googleClientSecret?: string;
  googleTokenExpiresAt?: number;
  googleUserEmail?: string;
}

export const EMBEDDED_GOOGLE_ACCESS_TOKEN = '';
export const EMBEDDED_GOOGLE_REFRESH_TOKEN = '';

const DEFAULT_SETTINGS: StoredSettings = {
  masterDocId: '',
  candidateName: '',
  targetTitle: 'Software Engineer',
  strictAntiHallucination: true,
  googleAccessToken: undefined,
  googleRefreshToken: undefined,
  // Internal OAuth client ID — managed by the extension, never exposed to users.
  googleClientId: '412130143258-4b1t8drhkii7hqagt7sdvd8n3qmchl8i.apps.googleusercontent.com',
  googleUserEmail: undefined,
};

export async function getGoogleAccessToken(): Promise<string | undefined> {
  try {
    const settings = await getStoredSettings();
    const now = Date.now();
    const isExpired = !settings.googleTokenExpiresAt || settings.googleTokenExpiresAt <= now + 60000;

    // 1. If token is present and not expired, return it immediately
    if (settings.googleAccessToken && !isExpired) {
      return settings.googleAccessToken;
    }

    // 2. If token is expired or missing, and a Refresh Token is available, auto-renew
    if (settings.googleRefreshToken && settings.googleRefreshToken.trim().length > 0) {
      try {
        const refreshResult = await refreshGoogleAccessToken(
          settings.googleRefreshToken,
          settings.googleClientId,
          settings.googleClientSecret
        );
        if (refreshResult.success && refreshResult.accessToken) {
          return refreshResult.accessToken;
        }
      } catch (err) {
        console.debug('[storage] Background token refresh note:', err);
      }
    }

    // 3. Fallback: Return existing access token if available without destroying it from storage.
    // The Google Docs API service handles live HTTP 401 retries dynamically.
    if (settings.googleAccessToken && settings.googleAccessToken.trim().length > 0 && !isExpired) {
      return settings.googleAccessToken.trim();
    }

    return undefined;
  } catch {
    return undefined;
  }
}

export async function setGoogleAccessToken(token: string, expiresInSeconds: number = 3300): Promise<void> {
  const cleanToken = token.trim();
  const expiresAt = Date.now() + expiresInSeconds * 1000;
  await saveStoredSettings({ googleAccessToken: cleanToken, googleTokenExpiresAt: expiresAt });
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    return new Promise((resolve) => {
      chrome.storage.local.set({
        google_access_token: cleanToken,
        google_token_expires_at: expiresAt,
      }, () => resolve());
    });
  }
  try {
    localStorage.setItem('google_access_token', cleanToken);
    localStorage.setItem('google_token_expires_at', String(expiresAt));
  } catch {}
}

export async function invalidateCachedGoogleToken(token?: string): Promise<void> {
  // 1. Invalidate in Chrome identity cache (for native getAuthToken)
  try {
    if (typeof chrome !== 'undefined' && (chrome as any).identity?.removeCachedAuthToken) {
      const targetToken = token || (await getStoredSettings()).googleAccessToken;
      if (targetToken) {
        await new Promise<void>((resolve) => {
          (chrome as any).identity.removeCachedAuthToken({ token: targetToken }, () => resolve());
        });
      }
    }
  } catch (err) {
    console.debug('[storage] removeCachedAuthToken note:', err);
  }

  // 2. Invalidate in persistent storage (so next getGoogleAccessToken() triggers refresh)
  try {
    await saveStoredSettings({
      googleAccessToken: '',
      googleTokenExpiresAt: 0,
    });
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      await new Promise<void>((resolve) => {
        chrome.storage.local.remove([
          'google_access_token',
          'google_token_expires_at',
        ], () => resolve());
      });
    }
    try {
      localStorage.removeItem('google_access_token');
      localStorage.removeItem('google_token_expires_at');
    } catch {}
  } catch (storageErr) {
    console.debug('[storage] invalidateCachedGoogleToken storage note:', storageErr);
  }
}

export async function removeGoogleAccessToken(): Promise<void> {
  await invalidateCachedGoogleToken();
  await saveStoredSettings({ googleAccessToken: '', googleRefreshToken: '', googleTokenExpiresAt: 0, googleUserEmail: '' });
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    return new Promise((resolve) => {
      chrome.storage.local.remove([
        'google_access_token',
        'google_refresh_token',
        'google_token_expires_at',
        'google_user_email'
      ], () => resolve());
    });
  }
  try {
    localStorage.removeItem('google_access_token');
    localStorage.removeItem('google_refresh_token');
    localStorage.removeItem('google_token_expires_at');
    localStorage.removeItem('google_user_email');
  } catch {}
}

export async function refreshGoogleAccessToken(
  customRefreshToken?: string,
  customClientId?: string,
  customClientSecret?: string
): Promise<{ success: boolean; accessToken?: string; error?: string }> {
  try {
    const settings = await getStoredSettings();
    const refreshToken = customRefreshToken || settings.googleRefreshToken;
    const clientId = customClientId || settings.googleClientId || '412130143258-4b1t8drhkii7hqagt7sdvd8n3qmchl8i.apps.googleusercontent.com';
    const clientSecret = customClientSecret || settings.googleClientSecret;

    if (!refreshToken) {
      return { success: false, error: 'No refresh token configured' };
    }

    // Pathway 1: Google OAuth Playground refresh proxy (optimal for Playground tokens)
    try {
      const pgRes = await fetch('https://developers.google.com/oauthplayground/refreshAccessToken', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token_uri: 'https://oauth2.googleapis.com/token',
          refresh_token: refreshToken.trim(),
        }),
      });
      if (pgRes.ok) {
        const pgData = await pgRes.json();
        if (pgData?.access_token) {
          const newAccessToken = pgData.access_token;
          const expiresIn = pgData.expires_in || 3600;
          const expiresAt = Date.now() + expiresIn * 1000;

          await saveStoredSettings({
            googleAccessToken: newAccessToken,
            googleRefreshToken: refreshToken,
            googleClientId: clientId,
            googleClientSecret: clientSecret,
            googleTokenExpiresAt: expiresAt,
          });
          return { success: true, accessToken: newAccessToken };
        }
      }
    } catch (pgErr) {
      console.debug('[storage] Playground refresh note:', pgErr);
    }

    // Pathway 2: Direct Google OAuth 2.0 token endpoint
    const bodyParams = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken.trim(),
      client_id: clientId.trim(),
    });

    if (clientSecret) {
      bodyParams.append('client_secret', clientSecret.trim());
    }

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: bodyParams.toString(),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return {
        success: false,
        error: errData?.error_description || errData?.error || `HTTP ${res.status}`,
      };
    }

    const data = await res.json();
    if (data?.access_token) {
      const newAccessToken = data.access_token;
      const expiresIn = data.expires_in || 3600;
      const expiresAt = Date.now() + expiresIn * 1000;

      await saveStoredSettings({
        googleAccessToken: newAccessToken,
        googleRefreshToken: refreshToken,
        googleClientId: clientId,
        googleClientSecret: clientSecret,
        googleTokenExpiresAt: expiresAt,
      });

      return { success: true, accessToken: newAccessToken };
    }

    return { success: false, error: 'No access token returned from Google' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error refreshing token' };
  }
}

export async function getStoredSettings(): Promise<StoredSettings> {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    return new Promise((resolve) => {
      chrome.storage.local.get(
        [
          'resumehack_settings',
          'resumehack_stored_settings',
          'google_access_token',
          'google_refresh_token',
          'google_client_id',
          'google_client_secret',
          'google_token_expires_at',
          'google_user_email',
        ],
        (result: any) => {
          const stored = result?.resumehack_settings || result?.resumehack_stored_settings || {};
          const googleAccessToken =
            result?.google_access_token && result.google_access_token.trim().length > 0
              ? result.google_access_token.trim()
              : stored.googleAccessToken && stored.googleAccessToken.trim().length > 0
              ? stored.googleAccessToken.trim()
              : DEFAULT_SETTINGS.googleAccessToken;

          const googleRefreshToken =
            result?.google_refresh_token && result.google_refresh_token.trim().length > 0
              ? result.google_refresh_token.trim()
              : stored.googleRefreshToken && stored.googleRefreshToken.trim().length > 0
              ? stored.googleRefreshToken.trim()
              : DEFAULT_SETTINGS.googleRefreshToken;

          const googleClientId =
            result?.google_client_id || stored.googleClientId || DEFAULT_SETTINGS.googleClientId;
          const googleClientSecret = result?.google_client_secret || stored.googleClientSecret;
          const googleTokenExpiresAt = result?.google_token_expires_at || stored.googleTokenExpiresAt;
          const googleUserEmail = result?.google_user_email || stored.googleUserEmail;

          resolve({
            ...DEFAULT_SETTINGS,
            ...stored,
            googleAccessToken,
            googleRefreshToken,
            googleClientId,
            googleClientSecret,
            googleTokenExpiresAt,
            googleUserEmail,
          });
        }
      );
    });
  }

  try {
    const stored = (typeof localStorage !== 'undefined' ? localStorage.getItem('resumehack_settings') || localStorage.getItem('resumehack_stored_settings') : null);
    const parsed = stored ? JSON.parse(stored) : {};
    const googleAccessToken =
      (typeof localStorage !== 'undefined' ? localStorage.getItem('google_access_token') : null) ||
      parsed.googleAccessToken ||
      DEFAULT_SETTINGS.googleAccessToken;
    const googleRefreshToken =
      (typeof localStorage !== 'undefined' ? localStorage.getItem('google_refresh_token') : null) ||
      parsed.googleRefreshToken ||
      DEFAULT_SETTINGS.googleRefreshToken;
    const googleTokenExpiresAt =
      Number((typeof localStorage !== 'undefined' ? localStorage.getItem('google_token_expires_at') : 0)) ||
      parsed.googleTokenExpiresAt;
    const googleUserEmail =
      (typeof localStorage !== 'undefined' ? localStorage.getItem('google_user_email') : null) ||
      parsed.googleUserEmail;

    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      googleAccessToken,
      googleRefreshToken,
      googleTokenExpiresAt,
      googleUserEmail,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveStoredSettings(settings: Partial<StoredSettings>): Promise<void> {
  const current = await getStoredSettings();
  const updated: StoredSettings = {
    ...current,
    ...settings,
  };

  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    return new Promise((resolve) => {
      const payload: Record<string, any> = { resumehack_settings: updated };
      if (settings.googleAccessToken !== undefined) {
        payload.google_access_token = settings.googleAccessToken.trim();
      }
      if (settings.googleRefreshToken !== undefined) {
        payload.google_refresh_token = settings.googleRefreshToken.trim();
      }
      if (settings.googleClientId !== undefined) {
        payload.google_client_id = settings.googleClientId.trim();
      }
      if (settings.googleClientSecret !== undefined) {
        payload.google_client_secret = settings.googleClientSecret.trim();
      }
      if (settings.googleTokenExpiresAt !== undefined) {
        payload.google_token_expires_at = settings.googleTokenExpiresAt;
      }
      if (settings.googleUserEmail !== undefined) {
        payload.google_user_email = settings.googleUserEmail.trim();
      }
      chrome.storage.local.set(payload, () => resolve());
    });
  }

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('resumehack_settings', JSON.stringify(updated));
      if (settings.googleAccessToken !== undefined) {
        localStorage.setItem('google_access_token', settings.googleAccessToken.trim());
      }
      if (settings.googleRefreshToken !== undefined) {
        localStorage.setItem('google_refresh_token', settings.googleRefreshToken.trim());
      }
      if (settings.googleTokenExpiresAt !== undefined) {
        localStorage.setItem('google_token_expires_at', String(settings.googleTokenExpiresAt));
      }
      if (settings.googleUserEmail !== undefined) {
        localStorage.setItem('google_user_email', settings.googleUserEmail.trim());
      }
    }
  } catch {}
}

export async function getStoredApplications(): Promise<ApplicationRecord[]> {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    return new Promise((resolve) => {
      chrome.storage.local.get(['resumehack_applications'], (result: any) => {
        if (result.resumehack_applications) {
          resolve(result.resumehack_applications);
        } else {
          // Initialize with default
          chrome.storage.local.set({ resumehack_applications: DEFAULT_APPLICATIONS });
          resolve(DEFAULT_APPLICATIONS);
        }
      });
    });
  }

  try {
    const stored = (typeof localStorage !== 'undefined' ? localStorage.getItem('resumehack_applications') : null);
    if (stored) {
      return JSON.parse(stored);
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('resumehack_applications', JSON.stringify(DEFAULT_APPLICATIONS));
    }
  } catch {}
  return DEFAULT_APPLICATIONS;
}

export async function saveStoredApplications(apps: ApplicationRecord[]): Promise<void> {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ resumehack_applications: apps }, () => resolve());
    });
  }
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('resumehack_applications', JSON.stringify(apps));
  }
}

export const DEFAULT_APPLICANT_PROFILE: ApplicantProfile = {
  firstName: '',
  lastName: '',
  fullName: '',
  email: '',
  phone: '',
  location: '',
  linkedinUrl: '',
  githubUrl: '',
  portfolioUrl: '',
  school: '',
  degree: '',
  major: '',
  gpa: '',
  gradMonthYear: '',
  workAuthorization: 'US_CITIZEN',
  requiresVisaSponsorship: false,
};

export async function getStoredApplicantProfile(): Promise<ApplicantProfile> {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    return new Promise((resolve) => {
      chrome.storage.local.get(['resumehack_applicant_profile'], (result: any) => {
        if (result.resumehack_applicant_profile) {
          resolve({
            ...DEFAULT_APPLICANT_PROFILE,
            ...result.resumehack_applicant_profile,
          });
        } else {
          resolve(DEFAULT_APPLICANT_PROFILE);
        }
      });
    });
  }

  try {
    const stored = (typeof localStorage !== 'undefined' ? localStorage.getItem('resumehack_applicant_profile') : null);
    if (stored) {
      return {
        ...DEFAULT_APPLICANT_PROFILE,
        ...JSON.parse(stored),
      };
    }
  } catch {}
  return DEFAULT_APPLICANT_PROFILE;
}

export async function saveStoredApplicantProfile(profile: Partial<ApplicantProfile>): Promise<void> {
  const current = await getStoredApplicantProfile();
  const updated: ApplicantProfile = {
    ...current,
    ...profile,
    fullName: `${(profile.firstName ?? current.firstName).trim()} ${(profile.lastName ?? current.lastName).trim()}`.trim(),
  };

  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ resumehack_applicant_profile: updated }, () => resolve());
    });
  }

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('resumehack_applicant_profile', JSON.stringify(updated));
    }
  } catch {}
}

/**
 * Returns true if the user has filled in the minimum required fields
 * (first name, last name, email) so auto-apply can proceed safely.
 */
export function isProfileComplete(profile: ApplicantProfile | null | undefined): boolean {
  if (!profile) return false;
  return (
    Boolean(profile.firstName && profile.firstName.trim().length > 0) &&
    Boolean(profile.lastName && profile.lastName.trim().length > 0) &&
    Boolean(profile.email && profile.email.trim().length > 0)
  );
}

/**
 * Returns true if the user needs to complete the onboarding wizard.
 * Onboarding is strictly required for all users until they fill in all required
 * fields (first name, last name, email) and mark onboarding complete.
 */
export async function isNewUser(): Promise<boolean> {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    return new Promise((resolve) => {
      chrome.storage.local.get(['resumehack_applicant_profile', 'resumehack_onboarding_complete'], (result: any) => {
        const onboardingComplete = Boolean(result.resumehack_onboarding_complete);
        const p = result.resumehack_applicant_profile as ApplicantProfile | undefined;
        // Onboarding is required for all users until completed AND required fields are filled
        if (!onboardingComplete || !p || !isProfileComplete(p)) {
          resolve(true);
          return;
        }
        resolve(false);
      });
    });
  }

  try {
    const onboardingComplete = typeof localStorage !== 'undefined' && localStorage.getItem('resumehack_onboarding_complete') === 'true';
    const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('resumehack_applicant_profile') : null;
    if (stored) {
      const p = JSON.parse(stored) as ApplicantProfile;
      if (!onboardingComplete || !isProfileComplete(p)) {
        return true;
      }
      return false;
    }
    return true;
  } catch {
    return true;
  }
}

/**
 * Marks onboarding as completed so it does not show again once profile is valid.
 */
export async function markOnboardingComplete(): Promise<void> {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ resumehack_onboarding_complete: true }, () => resolve());
    });
  }
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('resumehack_onboarding_complete', 'true');
    }
  } catch {}
}

