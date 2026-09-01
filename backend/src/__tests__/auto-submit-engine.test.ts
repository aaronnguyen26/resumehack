import { describe, it, expect } from 'vitest';
import { AutoSubmitEngine, DEFAULT_CANDIDATE_PROFILE } from '../services/auto-submit-engine.js';

describe('AutoSubmitEngine ATS Integration & Field Mapping', () => {
  const engine = new AutoSubmitEngine();

  it('detects diverse application portals accurately from URLs and HTML', () => {
    expect(engine.detectPortal('https://boards.greenhouse.io/stripe/jobs/123')).toBe('greenhouse');
    expect(engine.detectPortal('https://jobs.lever.co/openai/456')).toBe('lever');
    expect(engine.detectPortal('https://nvidia.wd5.myworkdayjobs.com/NVIDIAExternalCareerSite')).toBe('workday');
    expect(engine.detectPortal('https://jobs.ashbyhq.com/anthropic/789')).toBe('ashby');
    expect(engine.detectPortal('https://jobs.smartrecruiters.com/Square/101')).toBe('smartrecruiters');
    expect(engine.detectPortal('https://app.joinhandshake.com/jobs/202')).toBe('handshake');
    expect(engine.detectPortal('https://www.linkedin.com/jobs/view/303/?easy-apply=true')).toBe('linkedin_easy_apply');
    expect(engine.detectPortal('https://company.com/apply', '<form><input type="email"></form>')).toBe('generic_form');
  });

  it('accurately maps form input identifiers to profile keys', () => {
    expect(engine.matchFieldKey('first_name')?.fieldKey).toBe('firstName');
    expect(engine.matchFieldKey('applicant_last_name')?.fieldKey).toBe('lastName');
    expect(engine.matchFieldKey('email_address')?.fieldKey).toBe('email');
    expect(engine.matchFieldKey('phone_number')?.fieldKey).toBe('phone');
    expect(engine.matchFieldKey('linkedin_profile_url')?.fieldKey).toBe('linkedinUrl');
    expect(engine.matchFieldKey('github_link')?.fieldKey).toBe('githubUrl');
    expect(engine.matchFieldKey('school_or_university')?.fieldKey).toBe('school');
    expect(engine.matchFieldKey('major_discipline')?.fieldKey).toBe('major');
    expect(engine.matchFieldKey('cumulative_gpa')?.fieldKey).toBe('gpa');
    expect(engine.matchFieldKey('will_you_require_visa_sponsorship')?.fieldKey).toBe('requiresVisaSponsorship');
  });

  it('resolves correct profile values for candidate attributes', () => {
    expect(engine.resolveFieldValue(DEFAULT_CANDIDATE_PROFILE, 'fullName')).toBe('Alex Chen');
    expect(engine.resolveFieldValue(DEFAULT_CANDIDATE_PROFILE, 'email')).toBe('alex.chen@example.com');
    expect(engine.resolveFieldValue(DEFAULT_CANDIDATE_PROFILE, 'phone')).toBe('415-555-0199');
    expect(engine.resolveFieldValue(DEFAULT_CANDIDATE_PROFILE, 'school')).toBe('University of California, Berkeley');
    expect(engine.resolveFieldValue(DEFAULT_CANDIDATE_PROFILE, 'requiresVisaSponsorship')).toBe('No');
  });

  it('generates a complete autofill execution report and validates readiness', () => {
    const mockInputs = [
      { id: 'first_name', name: 'first_name', placeholder: 'First Name', label: 'First Name', type: 'text' },
      { id: 'last_name', name: 'last_name', placeholder: 'Last Name', label: 'Last Name', type: 'text' },
      { id: 'email', name: 'email', placeholder: 'name@example.com', label: 'Email', type: 'email' },
      { id: 'phone', name: 'phone', placeholder: 'Phone', label: 'Phone', type: 'tel' },
      { id: 'urls_linkedin', name: 'urls[LinkedIn]', placeholder: 'LinkedIn Profile', label: 'LinkedIn', type: 'url' },
    ];

    const report = engine.planAutoFill('greenhouse', mockInputs, DEFAULT_CANDIDATE_PROFILE);

    expect(report.portal).toBe('greenhouse');
    expect(report.fieldsFound).toBe(5);
    expect(report.fieldsFilled).toBe(5);
    expect(report.missingRequiredFields).toHaveLength(0);
    expect(report.readyForSubmission).toBe(true);
  });
});
