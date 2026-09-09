import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  DEFAULT_APPLICANT_PROFILE,
  isProfileComplete,
  getStoredApplicantProfile,
  saveStoredApplicantProfile
} from '../services/storage.js';
import { GoogleDocsService } from '../services/google-docs.js';
import { ApplicantProfile } from '../types/index.js';

describe('User Profile Dynamic Display & Initials Calculation', () => {
  function computeInitials(profile?: Partial<ApplicantProfile>): string {
    const firstName = profile?.firstName?.trim() || '';
    const lastName = profile?.lastName?.trim() || '';
    if (firstName || lastName) {
      return `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase();
    }
    return (profile?.email?.[0] || 'U').toUpperCase();
  }

  function computeDisplayName(profile?: Partial<ApplicantProfile>): string {
    const firstName = profile?.firstName?.trim() || '';
    const lastName = profile?.lastName?.trim() || '';
    if (firstName || lastName) {
      return `${firstName} ${lastName}`.trim();
    }
    return profile?.fullName?.trim() || 'Candidate Profile';
  }

  it('generates two-letter initials for first and last name', () => {
    expect(computeInitials({ firstName: 'Taylor', lastName: 'Swift' })).toBe('TS');
    expect(computeInitials({ firstName: 'Jane', lastName: 'Doe' })).toBe('JD');
    expect(computeInitials({ firstName: 'Marcus', lastName: 'Aurelius' })).toBe('MA');
  });

  it('generates single-letter initial when only first or last name is provided', () => {
    expect(computeInitials({ firstName: 'Jordan' })).toBe('J');
    expect(computeInitials({ lastName: 'Smith' })).toBe('S');
  });

  it('falls back to email initial when names are empty', () => {
    expect(computeInitials({ email: 'developer@example.com' })).toBe('D');
    expect(computeInitials({ email: 'zeno@athens.org' })).toBe('Z');
  });

  it('falls back to U monogram when profile is entirely blank', () => {
    expect(computeInitials({})).toBe('U');
    expect(computeInitials(DEFAULT_APPLICANT_PROFILE)).toBe('U');
  });

  it('formats display name correctly without hardcoded Alex Chen placeholder', () => {
    expect(computeDisplayName({ firstName: 'Grace', lastName: 'Hopper' })).toBe('Grace Hopper');
    expect(computeDisplayName({ firstName: 'Ada', lastName: 'Lovelace' })).toBe('Ada Lovelace');
    expect(computeDisplayName({ fullName: 'Alan Turing' })).toBe('Alan Turing');
    expect(computeDisplayName({})).toBe('Candidate Profile');
  });
});

describe('Dynamic Master Resume Template (Google Docs Service)', () => {
  const docsService = new GoogleDocsService();

  it('generates dynamic master resume customized to user profile instead of Alex Chen', () => {
    const customProfile: ApplicantProfile = {
      firstName: 'Samantha',
      lastName: 'Vance',
      fullName: 'Samantha Vance',
      email: 'svance@stanford.edu',
      phone: '(415) 888-9999',
      location: 'Palo Alto, CA',
      linkedinUrl: 'https://linkedin.com/in/samvance',
      githubUrl: 'https://github.com/samvance',
      school: 'Stanford University',
      degree: 'M.S.',
      major: 'Artificial Intelligence',
      gpa: '3.98',
      gradMonthYear: 'June 2026',
      workAuthorization: 'US_CITIZEN',
      requiresVisaSponsorship: false,
    };

    const resume = docsService.getMockMasterResume(customProfile);

    // Verify title reflects candidate name
    expect(resume.title).toBe('Samantha Vance - Master Resume 2026');

    // Verify fullText contains candidate details
    expect(resume.fullText).toContain('Samantha Vance');
    expect(resume.fullText).toContain('svance@stanford.edu');
    expect(resume.fullText).toContain('Palo Alto, CA');
    expect(resume.fullText).toContain('Stanford University');
    expect(resume.fullText).toContain('M.S. in Artificial Intelligence | GPA: 3.98');
    expect(resume.fullText).toContain('June 2026');

    // Verify ZERO references to Alex Chen
    expect(resume.fullText).not.toContain('Alex Chen');
    expect(resume.fullText).not.toContain('alex.chen@example.com');
  });

  it('uses clean candidate defaults when no profile is provided without Alex Chen', () => {
    const resume = docsService.getMockMasterResume();
    expect(resume.title).toBe('Candidate Resume - Master Resume 2026');
    expect(resume.fullText).not.toContain('Alex Chen');
    expect(resume.fullText).not.toContain('alex.chen@example.com');
  });
});

describe('User Profile Storage & Updating', () => {
  let mockStorage: Record<string, any> = {};

  beforeEach(() => {
    mockStorage = {};
    (global as any).chrome = {
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
  });

  it('saves and updates profile with auto-computed fullName', async () => {
    await saveStoredApplicantProfile({
      firstName: 'Elena',
      lastName: 'Rostova',
      email: 'elena@tech.io',
    });

    const stored = await getStoredApplicantProfile();
    expect(stored.firstName).toBe('Elena');
    expect(stored.lastName).toBe('Rostova');
    expect(stored.fullName).toBe('Elena Rostova');
    expect(stored.email).toBe('elena@tech.io');
    expect(isProfileComplete(stored)).toBe(true);
  });
});
