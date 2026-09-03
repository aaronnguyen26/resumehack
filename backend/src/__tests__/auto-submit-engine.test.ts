import { describe, it, expect } from 'vitest';
import {
  AutoSubmitEngine,
  FormInputDescriptor,
  DECLINE_OPTION_PATTERN,
  EEO_DEMOGRAPHIC_PATTERNS
} from '../services/auto-submit-engine.js';
import { DEFAULT_APPLICANT_PROFILE } from '../services/storage.js';

describe('AutoSubmitEngine ATS Integration, EEO Fail-Safe & Multi-Portal Rules', () => {
  const engine = new AutoSubmitEngine();

  it('detects diverse application portals accurately including Ashby and SmartRecruiters', () => {
    expect(engine.detectPortal('https://boards.greenhouse.io/stripe/jobs/123')).toBe('greenhouse');
    expect(engine.detectPortal('https://job-boards.greenhouse.io/airbnb/jobs/456')).toBe('greenhouse');
    expect(engine.detectPortal('https://jobs.lever.co/openai/789')).toBe('lever');
    expect(engine.detectPortal('https://jobs.ashbyhq.com/anthropic/101')).toBe('ashby');
    expect(engine.detectPortal('https://jobs.smartrecruiters.com/Square/202')).toBe('smartrecruiters');
    expect(engine.detectPortal('https://nvidia.wd5.myworkdayjobs.com/NVIDIAExternalCareerSite')).toBe('workday');
    expect(engine.detectPortal('https://app.joinhandshake.com/jobs/303')).toBe('handshake');
    expect(engine.detectPortal('https://www.linkedin.com/jobs/view/404/?easy-apply=true')).toBe('linkedin_easy_apply');
    expect(engine.detectPortal('https://company.com/apply', '<form><input type="email"></form>')).toBe('generic_form');
  });

  it('correctly classifies standard applicant profile fields with high confidence', () => {
    expect(engine.classifyField({ name: 'first_name', type: 'text' })).toMatchObject({
      classification: 'standard',
      fieldKey: 'firstName',
    });
    expect(engine.classifyField({ name: 'last_name', type: 'text' })).toMatchObject({
      classification: 'standard',
      fieldKey: 'lastName',
    });
    expect(engine.classifyField({ name: 'email', type: 'email' })).toMatchObject({
      classification: 'standard',
      fieldKey: 'email',
    });
    expect(engine.classifyField({ name: 'phone', type: 'tel' })).toMatchObject({
      classification: 'standard',
      fieldKey: 'phone',
    });
    expect(engine.classifyField({ name: 'urls[LinkedIn]', type: 'url' })).toMatchObject({
      classification: 'standard',
      fieldKey: 'linkedinUrl',
    });
    expect(engine.classifyField({ name: 'urls[GitHub]', type: 'url' })).toMatchObject({
      classification: 'standard',
      fieldKey: 'githubUrl',
    });
    expect(engine.classifyField({ name: 'school', type: 'text' })).toMatchObject({
      classification: 'standard',
      fieldKey: 'school',
    });
    expect(engine.classifyField({ name: 'resume', type: 'file' })).toMatchObject({
      classification: 'resume_file',
      fieldKey: 'tailoredResumePdf',
    });
  });

  it('NON-NEGOTIABLE PRIVACY GUARANTEE: Comprehensive EEO / Demographic Pattern Detection', () => {
    const eeoLabels = [
      'Race / Ethnicity',
      'Hispanic or Latino identification',
      'Gender Identity',
      'Pronouns',
      'Sexual Orientation',
      'Protected Veteran Status',
      'Armed Forces service',
      'Military Discharge Status',
      'Voluntary Self-Identification of Disability',
      'CC-305 Disability Form',
      'Equal Employment Opportunity (EEO-1) Survey',
      'OFCCP Voluntary Self-Identification',
    ];

    for (const label of eeoLabels) {
      expect(engine.isEeoField(label)).toBe(true);
      const res = engine.classifyField({ label, type: 'select', required: false });
      expect(res.classification).toBe('eeo_voluntary');
    }
  });

  describe('PER-ATS REQUIRED EEO DECLINE SELECTION (Zero Demographic Guessing)', () => {
    it('Greenhouse ATS: Selects ONLY the explicit decline option in required race/ethnicity dropdown', () => {
      const greenhouseRaceDropdown: FormInputDescriptor = {
        name: 'job_application[answers_attributes][0][value]',
        label: 'Race / Ethnicity *',
        required: true,
        type: 'select',
        options: [
          { text: 'Select an option', value: '' },
          { text: 'Hispanic or Latino', value: 'hispanic' },
          { text: 'White (Not Hispanic or Latino)', value: 'white' },
          { text: 'Black or African American (Not Hispanic or Latino)', value: 'black' },
          { text: 'Asian (Not Hispanic or Latino)', value: 'asian' },
          { text: 'American Indian or Alaska Native', value: 'native' },
          { text: 'Two or More Races', value: 'two_or_more' },
          { text: 'I decline to self-identify', value: 'decline' },
        ],
      };

      const result = engine.classifyField(greenhouseRaceDropdown);
      expect(result.classification).toBe('eeo_required_decline');
      expect(result.declineOption).toBeDefined();
      expect(result.declineOption?.value).toBe('decline');
      expect(result.declineOption?.text).toBe('I decline to self-identify');
      // Crucial: Ensure NO demographic option was picked
      expect(result.declineOption?.value).not.toBe('hispanic');
      expect(result.declineOption?.value).not.toBe('white');
      expect(result.declineOption?.value).not.toBe('asian');
    });

    it('Lever ATS: Selects ONLY the explicit decline option in required gender question', () => {
      const leverGenderDropdown: FormInputDescriptor = {
        name: 'eeo[gender]',
        label: 'Gender *',
        required: true,
        type: 'select',
        options: [
          { text: 'Please select', value: '' },
          { text: 'Male', value: 'male' },
          { text: 'Female', value: 'female' },
          { text: 'Non-binary', value: 'non_binary' },
          { text: 'I prefer not to say', value: 'prefer_not_to_say' },
        ],
      };

      const result = engine.classifyField(leverGenderDropdown);
      expect(result.classification).toBe('eeo_required_decline');
      expect(result.declineOption?.value).toBe('prefer_not_to_say');
      expect(result.declineOption?.text).toBe('I prefer not to say');
      expect(result.declineOption?.value).not.toBe('male');
      expect(result.declineOption?.value).not.toBe('female');
    });

    it('Ashby ATS: Selects ONLY the explicit decline option in required veteran question', () => {
      const ashbyVeteranDropdown: FormInputDescriptor = {
        name: 'custom_fields[veteran_status]',
        label: 'Protected Veteran Status (Required)',
        required: true,
        type: 'select',
        options: [
          { text: 'Select status...', value: '' },
          { text: 'I am a protected veteran', value: 'veteran' },
          { text: 'I am not a protected veteran', value: 'not_veteran' },
          { text: 'I choose not to self-identify', value: 'decline_veteran' },
        ],
      };

      const result = engine.classifyField(ashbyVeteranDropdown);
      expect(result.classification).toBe('eeo_required_decline');
      expect(result.declineOption?.value).toBe('decline_veteran');
      expect(result.declineOption?.text).toBe('I choose not to self-identify');
      expect(result.declineOption?.value).not.toBe('veteran');
      expect(result.declineOption?.value).not.toBe('not_veteran');
    });

    it('SmartRecruiters ATS: Selects ONLY the explicit decline option in required disability question', () => {
      const smartRecruitersDisabilityDropdown: FormInputDescriptor = {
        name: 'disability_status',
        label: 'Voluntary Self-Identification of Disability *',
        required: true,
        type: 'select',
        options: [
          { text: 'Choose one', value: '' },
          { text: 'Yes, I have a disability (or previously had a disability)', value: 'yes' },
          { text: 'No, I do not have a disability', value: 'no' },
          { text: 'I do not wish to answer', value: 'decline_disability' },
        ],
      };

      const result = engine.classifyField(smartRecruitersDisabilityDropdown);
      expect(result.classification).toBe('eeo_required_decline');
      expect(result.declineOption?.value).toBe('decline_disability');
      expect(result.declineOption?.text).toBe('I do not wish to answer');
      expect(result.declineOption?.value).not.toBe('yes');
      expect(result.declineOption?.value).not.toBe('no');
    });
  });

  it('FAIL-SAFE: Ambiguous / Uncertain fields default to manual review (never guessed)', () => {
    const uncertainField: FormInputDescriptor = {
      name: 'internal_routing_custom_id_77',
      label: 'Special Regional Allocation Code',
      placeholder: 'Enter 4-digit code',
      type: 'text',
      required: false,
    };

    const result = engine.classifyField(uncertainField);
    expect(result.classification).toBe('unclassified_manual_review');

    const report = engine.planAutoFill('greenhouse', [uncertainField], DEFAULT_APPLICANT_PROFILE);
    expect(report.fieldsNeedingReview).toBe(1);
    expect(report.fieldResults[0].status).toBe('manual_review_needed');
    expect(report.fieldResults[0].note).toContain('Uncertain field flagged for candidate verification');
  });

  it('plans a comprehensive autofill run with standard fields, EEO skips, and custom questions', () => {
    const mockFormInputs: FormInputDescriptor[] = [
      { id: 'first_name', name: 'first_name', label: 'First Name', type: 'text', required: true },
      { id: 'last_name', name: 'last_name', label: 'Last Name', type: 'text', required: true },
      { id: 'email', name: 'email', label: 'Email', type: 'email', required: true },
      { id: 'phone', name: 'phone', label: 'Phone', type: 'tel', required: true },
      { id: 'resume', name: 'resume', label: 'Resume', type: 'file', required: true },
      {
        id: 'eeo_race',
        name: 'eeo_race',
        label: 'Race / Ethnicity',
        type: 'select',
        required: false,
        options: [{ text: 'Asian', value: 'asian' }],
      },
      {
        id: 'why_stripe',
        name: 'why_stripe',
        label: 'Why are you interested in joining Stripe engineering?',
        type: 'textarea',
        tagName: 'textarea',
        required: true,
      },
    ];

    const report = engine.planAutoFill('greenhouse', mockFormInputs, DEFAULT_APPLICANT_PROFILE);

    expect(report.portal).toBe('greenhouse');
    expect(report.fieldsFound).toBe(7);
    expect(report.fieldsFilled).toBe(4); // First Name, Last Name, Email, Phone
    expect(report.fieldsSkippedEeo).toBe(1);
    expect(report.customQuestionsCount).toBe(1);
    expect(report.missingRequiredFields).toHaveLength(0);
    expect(report.readyForSubmission).toBe(true);
    expect(report.termsDisclosure).toContain('Platform Terms Notice');
  });
});
