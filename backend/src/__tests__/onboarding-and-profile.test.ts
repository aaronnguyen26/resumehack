/**
 * Tests for onboarding + profile changes introduced in extension/src/services/storage.ts
 *
 * What changed (in BOTH extension and backend, now in sync):
 *   1. DEFAULT_APPLICANT_PROFILE is now all empty strings (no more fake 'Alex Chen' seed data)
 *   2. DEFAULT_APPLICATIONS is now [] (empty array — no fake seed applications)
 *   3. New export: isProfileComplete(profile) — returns true when firstName, lastName, email are non-empty
 *   4. New export: isNewUser() — checks chrome.storage for 'resumehack_onboarding_complete'
 *      and 'resumehack_applicant_profile' to decide whether to show the onboarding wizard
 *   5. New export: markOnboardingComplete() — sets 'resumehack_onboarding_complete' = true
 *
 * NOTE: The backend's services/storage.ts does NOT yet export isProfileComplete / isNewUser /
 * markOnboardingComplete. This test file therefore:
 *   - Imports DEFAULT_APPLICANT_PROFILE and storage helpers from the backend's copy
 *   - Re-implements the new logic inline (mirrors extension/src/services/storage.ts exactly)
 *   - Tests all behaviour thoroughly with mocked chrome.storage
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  DEFAULT_APPLICANT_PROFILE,
  getStoredApplications,
  getStoredApplicantProfile,
} from '../services/storage.js';

import type { ApplicantProfile } from '../types/index.js';

// ─── Inline re-implementation of the NEW extension-only exports ───────────────
// These mirror the exact logic in extension/src/services/storage.ts

/** Mirrors extension/src/services/storage.ts :: isProfileComplete */
function isProfileComplete(profile: ApplicantProfile): boolean {
  return (
    profile.firstName.trim().length > 0 &&
    profile.lastName.trim().length > 0 &&
    profile.email.trim().length > 0
  );
}

/** Mirrors extension/src/services/storage.ts :: isNewUser */
async function isNewUser(): Promise<boolean> {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    return new Promise((resolve) => {
      chrome.storage.local.get(
        ['resumehack_applicant_profile', 'resumehack_onboarding_complete'],
        (result: any) => {
          if (result.resumehack_onboarding_complete) {
            resolve(false);
            return;
          }
          if (!result.resumehack_applicant_profile) {
            resolve(true);
            return;
          }
          const p = result.resumehack_applicant_profile as ApplicantProfile;
          resolve(!isProfileComplete(p));
        }
      );
    });
  }
  return false;
}

/** Mirrors extension/src/services/storage.ts :: markOnboardingComplete */
async function markOnboardingComplete(): Promise<void> {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ resumehack_onboarding_complete: true }, () => resolve());
    });
  }
}

// ─── Chrome storage mock factory ──────────────────────────────────────────────

function makeChromeStorageMock(mockStorage: Record<string, any>) {
  return {
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
      removeCachedAuthToken: vi.fn((_opts: { token: string }, cb: () => void) => {
        cb();
      }),
    },
  };
}

const emptyProfile: ApplicantProfile = {
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

// ─── DEFAULT_APPLICANT_PROFILE — verify the sync happened ────────────────────

describe('DEFAULT_APPLICANT_PROFILE — now all-empty strings (synced with extension)', () => {
  it('firstName is empty string (no fake data)', () => {
    expect(DEFAULT_APPLICANT_PROFILE.firstName).toBe('');
  });

  it('lastName is empty string (no fake data)', () => {
    expect(DEFAULT_APPLICANT_PROFILE.lastName).toBe('');
  });

  it('email is empty string (no fake data)', () => {
    expect(DEFAULT_APPLICANT_PROFILE.email).toBe('');
  });

  it('phone is empty string', () => {
    expect(DEFAULT_APPLICANT_PROFILE.phone).toBe('');
  });

  it('school, degree, major, gpa, gradMonthYear are all empty strings', () => {
    expect(DEFAULT_APPLICANT_PROFILE.school).toBe('');
    expect(DEFAULT_APPLICANT_PROFILE.degree).toBe('');
    expect(DEFAULT_APPLICANT_PROFILE.major).toBe('');
    expect(DEFAULT_APPLICANT_PROFILE.gpa).toBe('');
    expect(DEFAULT_APPLICANT_PROFILE.gradMonthYear).toBe('');
  });

  it('isProfileComplete returns false for DEFAULT_APPLICANT_PROFILE', () => {
    expect(isProfileComplete(DEFAULT_APPLICANT_PROFILE)).toBe(false);
  });
});

// ─── isProfileComplete tests ──────────────────────────────────────────────────

describe('isProfileComplete — profile completeness gate', () => {
  it('returns false for a completely empty profile (new user default state)', () => {
    expect(isProfileComplete(emptyProfile)).toBe(false);
  });

  it('returns true when firstName, lastName, and email are all filled in', () => {
    const complete: ApplicantProfile = {
      ...emptyProfile,
      firstName: 'Alex',
      lastName: 'Chen',
      email: 'alex@test.com',
    };
    expect(isProfileComplete(complete)).toBe(true);
  });

  it('returns false when only firstName is missing', () => {
    const partial: ApplicantProfile = {
      ...emptyProfile,
      firstName: '',
      lastName: 'Chen',
      email: 'alex@test.com',
    };
    expect(isProfileComplete(partial)).toBe(false);
  });

  it('returns false when only lastName is missing', () => {
    const partial: ApplicantProfile = {
      ...emptyProfile,
      firstName: 'Alex',
      lastName: '',
      email: 'alex@test.com',
    };
    expect(isProfileComplete(partial)).toBe(false);
  });

  it('returns false when only email is missing', () => {
    const partial: ApplicantProfile = {
      ...emptyProfile,
      firstName: 'Alex',
      lastName: 'Chen',
      email: '',
    };
    expect(isProfileComplete(partial)).toBe(false);
  });

  it('returns false when required fields are whitespace-only (trim check)', () => {
    const whitespace: ApplicantProfile = {
      ...emptyProfile,
      firstName: '   ',
      lastName: '   ',
      email: '   ',
    };
    expect(isProfileComplete(whitespace)).toBe(false);
  });

  it('returns true even if all optional fields (phone, school, etc.) are empty', () => {
    const minimalValid: ApplicantProfile = {
      ...emptyProfile,
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@example.com',
    };
    expect(isProfileComplete(minimalValid)).toBe(true);
  });
});

// ─── isNewUser tests ──────────────────────────────────────────────────────────

describe('isNewUser — onboarding wizard trigger logic', () => {
  let mockStorage: Record<string, any> = {};

  beforeEach(() => {
    mockStorage = {};
    vi.restoreAllMocks();
    (globalThis as any).chrome = makeChromeStorageMock(mockStorage);
  });

  afterEach(() => {
    delete (globalThis as any).chrome;
  });

  it('returns true when no profile and no onboarding flag exist (brand-new install)', async () => {
    const result = await isNewUser();
    expect(result).toBe(true);
  });

  it('returns false when onboarding_complete flag is set, regardless of profile state', async () => {
    mockStorage['resumehack_onboarding_complete'] = true;
    const result = await isNewUser();
    expect(result).toBe(false);
  });

  it('returns false when onboarding_complete is set AND a complete profile exists', async () => {
    mockStorage['resumehack_onboarding_complete'] = true;
    mockStorage['resumehack_applicant_profile'] = {
      ...emptyProfile,
      firstName: 'Alex',
      lastName: 'Chen',
      email: 'alex@test.com',
    };
    const result = await isNewUser();
    expect(result).toBe(false);
  });

  it('returns false when profile exists with all three required fields filled', async () => {
    mockStorage['resumehack_applicant_profile'] = {
      ...emptyProfile,
      firstName: 'Alex',
      lastName: 'Chen',
      email: 'alex@test.com',
    };
    const result = await isNewUser();
    expect(result).toBe(false);
  });

  it('returns true when profile key exists but all required fields are empty', async () => {
    mockStorage['resumehack_applicant_profile'] = { ...emptyProfile };
    const result = await isNewUser();
    expect(result).toBe(true);
  });

  it('returns true when profile has only whitespace in required fields', async () => {
    mockStorage['resumehack_applicant_profile'] = {
      ...emptyProfile,
      firstName: '   ',
      lastName: '   ',
      email: '   ',
    };
    const result = await isNewUser();
    expect(result).toBe(true);
  });
});

// ─── markOnboardingComplete tests ─────────────────────────────────────────────

describe('markOnboardingComplete — persistent flag management', () => {
  let mockStorage: Record<string, any> = {};

  beforeEach(() => {
    mockStorage = {};
    vi.restoreAllMocks();
    (globalThis as any).chrome = makeChromeStorageMock(mockStorage);
  });

  afterEach(() => {
    delete (globalThis as any).chrome;
  });

  it('sets resumehack_onboarding_complete = true in chrome.storage.local', async () => {
    expect(mockStorage['resumehack_onboarding_complete']).toBeUndefined();
    await markOnboardingComplete();
    expect(mockStorage['resumehack_onboarding_complete']).toBe(true);
  });

  it('after markOnboardingComplete, isNewUser() returns false even with an empty profile', async () => {
    // Confirm we start as a new user
    let result = await isNewUser();
    expect(result).toBe(true);

    await markOnboardingComplete();

    // Must be false now — onboarding should never show again
    result = await isNewUser();
    expect(result).toBe(false);
  });

  it('calling markOnboardingComplete twice is idempotent', async () => {
    await markOnboardingComplete();
    await markOnboardingComplete();
    expect(mockStorage['resumehack_onboarding_complete']).toBe(true);
    const result = await isNewUser();
    expect(result).toBe(false);
  });
});

// ─── Storage integration — applications and profile reads ─────────────────────

describe('Storage integration — applications and profile reads', () => {
  let mockStorage: Record<string, any> = {};

  beforeEach(() => {
    mockStorage = {};
    vi.restoreAllMocks();
    (globalThis as any).chrome = makeChromeStorageMock(mockStorage);
  });

  afterEach(() => {
    delete (globalThis as any).chrome;
  });

  it('getStoredApplications() returns [] for a new user (no seed data)', async () => {
    // Both extension and backend now use DEFAULT_APPLICATIONS = []
    const apps = await getStoredApplications();
    expect(apps).toEqual([]);
    expect(apps.length).toBe(0);
  });

  it('getStoredApplications() returns explicitly stored apps from chrome.storage', async () => {
    const myApps = [{ id: 'test-1', company: 'Acme', title: 'Engineer', status: 'Applied' }];
    mockStorage['resumehack_applications'] = myApps;
    const apps = await getStoredApplications();
    expect(apps).toEqual(myApps);
  });

  it('getStoredApplicantProfile() merges stored partial profile on top of empty defaults', async () => {
    mockStorage['resumehack_applicant_profile'] = {
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@example.com',
    };
    const profile = await getStoredApplicantProfile();
    expect(profile.firstName).toBe('Jane');
    expect(profile.lastName).toBe('Doe');
    expect(profile.email).toBe('jane@example.com');
  });

  it('getStoredApplicantProfile() returns all-empty defaults when storage is empty', async () => {
    const profile = await getStoredApplicantProfile();
    expect(profile.firstName).toBe('');
    expect(profile.lastName).toBe('');
    expect(profile.email).toBe('');
  });

  it('getStoredApplicantProfile() preserved fields from partial stored data via spread', async () => {
    // Partial data from storage should be merged, not override the whole profile
    mockStorage['resumehack_applicant_profile'] = {
      firstName: 'Bob',
      email: 'bob@corp.com',
      // lastName NOT set — should remain ''
    };
    const profile = await getStoredApplicantProfile();
    expect(profile.firstName).toBe('Bob');
    expect(profile.email).toBe('bob@corp.com');
    expect(profile.lastName).toBe(''); // default
  });
});
