/**
 * AutoSubmitEngine — Intelligent Job Application Autofill & Automated Submission
 * Handles multi-portal ATS recognition (Greenhouse, Lever, Workday, Ashby, SmartRecruiters, Handshake, LinkedIn Easy Apply)
 */

export interface CandidateProfile {
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone: string;
  location: string;
  linkedinUrl: string;
  githubUrl: string;
  portfolioUrl: string;
  school: string;
  degree: string;
  major: string;
  gpa: string;
  gradMonthYear: string;
  workAuthorization: 'US_CITIZEN' | 'PERMANENT_RESIDENT' | 'REQUIRES_SPONSORSHIP' | 'F1_OPT';
  requiresVisaSponsorship: boolean;
  tailoredResumeUrl?: string;
  tailoredResumePdfUrl?: string;
  eeoGender?: string;
  eeoRace?: string;
  eeoVeteran?: string;
  eeoDisability?: string;
  customAnswers?: Record<string, string>;
}

export type ApplicationPortal =
  | 'greenhouse'
  | 'lever'
  | 'workday'
  | 'ashby'
  | 'smartrecruiters'
  | 'handshake'
  | 'linkedin_easy_apply'
  | 'generic_form'
  | 'unknown';

export interface FieldMappingRule {
  fieldKey: keyof CandidateProfile | string;
  matchPatterns: (string | RegExp)[];
  fieldType: 'text' | 'email' | 'tel' | 'url' | 'select' | 'radio' | 'checkbox' | 'file';
  priority: number;
}

export interface AutofillFieldResult {
  selector?: string;
  fieldKey: string;
  fieldLabel: string;
  filledValue: string;
  confidence: number;
  status: 'filled' | 'skipped' | 'manual_review_needed';
}

export interface AutoSubmitReport {
  portal: ApplicationPortal;
  portalName: string;
  url: string;
  fieldsFound: number;
  fieldsFilled: number;
  fieldsNeedingReview: number;
  fieldResults: AutofillFieldResult[];
  readyForSubmission: boolean;
  missingRequiredFields: string[];
}

export const DEFAULT_CANDIDATE_PROFILE: CandidateProfile = {
  firstName: 'Alex',
  lastName: 'Chen',
  fullName: 'Alex Chen',
  email: 'alex.chen@example.com',
  phone: '415-555-0199',
  location: 'San Francisco, CA',
  linkedinUrl: 'https://linkedin.com/in/alexchen',
  githubUrl: 'https://github.com/alexchen',
  portfolioUrl: 'https://alexchen.dev',
  school: 'University of California, Berkeley',
  degree: 'Bachelor of Science',
  major: 'Computer Science',
  gpa: '3.85',
  gradMonthYear: 'May 2026',
  workAuthorization: 'US_CITIZEN',
  requiresVisaSponsorship: false,
  eeoGender: 'Decline to self-identify',
  eeoRace: 'Decline to self-identify',
  eeoVeteran: 'Not a veteran',
  eeoDisability: 'No disability',
};

export const FIELD_MAPPING_RULES: FieldMappingRule[] = [
  {
    fieldKey: 'email',
    matchPatterns: ['email', 'email_address', 'e-mail', /email/i],
    fieldType: 'email',
    priority: 15,
  },
  {
    fieldKey: 'phone',
    matchPatterns: ['phone', 'mobile', 'telephone', 'phone_number', 'contact_number', /phone/i, /cell/i],
    fieldType: 'tel',
    priority: 15,
  },
  {
    fieldKey: 'firstName',
    matchPatterns: ['first_name', 'firstname', 'first-name', 'fname', /first\s*name/i, /given\s*name/i],
    fieldType: 'text',
    priority: 12,
  },
  {
    fieldKey: 'lastName',
    matchPatterns: ['last_name', 'lastname', 'last-name', 'lname', /last\s*name/i, /family\s*name/i, /surname/i],
    fieldType: 'text',
    priority: 12,
  },
  {
    fieldKey: 'linkedinUrl',
    matchPatterns: ['linkedin', 'linkedin_url', 'linkedin_profile', /linkedin/i],
    fieldType: 'url',
    priority: 11,
  },
  {
    fieldKey: 'githubUrl',
    matchPatterns: ['github', 'github_url', 'github_profile', /github/i],
    fieldType: 'url',
    priority: 11,
  },
  {
    fieldKey: 'portfolioUrl',
    matchPatterns: ['portfolio', 'personal_website', /portfolio/i, /personal\s*site/i],
    fieldType: 'url',
    priority: 11,
  },
  {
    fieldKey: 'school',
    matchPatterns: ['school', 'university', 'college', 'institution', /university/i, /school/i, /college/i],
    fieldType: 'text',
    priority: 8,
  },
  {
    fieldKey: 'degree',
    matchPatterns: ['degree', 'education_level', /degree/i, /education\s*level/i],
    fieldType: 'text',
    priority: 8,
  },
  {
    fieldKey: 'major',
    matchPatterns: ['major', 'field_of_study', 'discipline', /major/i, /field\s*of\s*study/i],
    fieldType: 'text',
    priority: 8,
  },
  {
    fieldKey: 'gpa',
    matchPatterns: ['gpa', 'cumulative_gpa', /gpa/i, /grade\s*point/i],
    fieldType: 'text',
    priority: 7,
  },
  {
    fieldKey: 'gradMonthYear',
    matchPatterns: ['graduation_date', 'grad_date', 'graduation_year', /graduation/i, /grad\s*date/i],
    fieldType: 'text',
    priority: 7,
  },
  {
    fieldKey: 'location',
    matchPatterns: ['current_location', /city/i, /location/i, /address/i],
    fieldType: 'text',
    priority: 7,
  },
  {
    fieldKey: 'fullName',
    matchPatterns: ['full_name', 'fullname', 'applicant_name', /\bfull\s*name\b/i, /\byour\s*name\b/i, /\bname\b/i],
    fieldType: 'text',
    priority: 5,
  },
  {
    fieldKey: 'requiresVisaSponsorship',
    matchPatterns: [/sponsorship/i, /require\s*visa/i, /future\s*sponsorship/i, /work\s*authorization/i],
    fieldType: 'radio',
    priority: 9,
  },
];

export class AutoSubmitEngine {
  /**
   * Detects the ATS platform from URL or HTML indicators.
   */
  public detectPortal(url: string, htmlContent: string = ''): ApplicationPortal {
    const urlLower = url.toLowerCase();
    const htmlLower = htmlContent.toLowerCase();

    if (urlLower.includes('greenhouse.io') || htmlLower.includes('id="application_form"') || htmlLower.includes('greenhouse')) {
      return 'greenhouse';
    }
    if (urlLower.includes('lever.co') || htmlLower.includes('class="application-form"') || htmlLower.includes('lever')) {
      return 'lever';
    }
    if (urlLower.includes('myworkdayjobs.com') || htmlLower.includes('data-automation-id') || htmlLower.includes('workday')) {
      return 'workday';
    }
    if (urlLower.includes('ashbyhq.com') || htmlLower.includes('ashby-application') || htmlLower.includes('ashby')) {
      return 'ashby';
    }
    if (urlLower.includes('smartrecruiters.com') || htmlLower.includes('smartrecruiters')) {
      return 'smartrecruiters';
    }
    if (urlLower.includes('joinhandshake.com') || htmlLower.includes('handshake')) {
      return 'handshake';
    }
    if (urlLower.includes('linkedin.com') && (urlLower.includes('easy-apply') || htmlLower.includes('jobs-easy-apply'))) {
      return 'linkedin_easy_apply';
    }

    if (htmlLower.includes('<form') || htmlLower.includes('type="email"') || htmlLower.includes('type="file"')) {
      return 'generic_form';
    }

    return 'unknown';
  }

  /**
   * Matches an input element's identifier (name, id, placeholder, label text) to a profile field.
   */
  public matchFieldKey(fieldIdentifier: string, inputType: string = 'text'): { fieldKey: string; confidence: number } | null {
    const raw = fieldIdentifier.toLowerCase();
    const norm = raw.replace(/[^a-z0-9\s_-]/g, ' ').trim();
    const normClean = norm.replace(/[_-]/g, ' ');

    // Type priority matching
    if (inputType === 'email' || norm.includes('email')) {
      return { fieldKey: 'email', confidence: 0.95 };
    }
    if (inputType === 'tel' || norm.includes('phone') || norm.includes('mobile')) {
      return { fieldKey: 'phone', confidence: 0.95 };
    }

    for (const rule of FIELD_MAPPING_RULES) {
      for (const pattern of rule.matchPatterns) {
        if (typeof pattern === 'string') {
          if (
            norm === pattern ||
            norm.includes(pattern) ||
            normClean === pattern ||
            normClean.includes(pattern)
          ) {
            return { fieldKey: rule.fieldKey as string, confidence: norm === pattern ? 1.0 : 0.85 };
          }
        } else if (pattern instanceof RegExp) {
          if (pattern.test(norm) || pattern.test(normClean)) {
            return { fieldKey: rule.fieldKey as string, confidence: 0.9 };
          }
        }
      }
    }

    return null;
  }

  /**
   * Resolves the profile value for a given field key.
   */
  public resolveFieldValue(profile: CandidateProfile, fieldKey: string): string {
    const val = (profile as any)[fieldKey];
    if (typeof val === 'string') return val;
    if (typeof val === 'boolean') return val ? 'Yes' : 'No';
    return '';
  }

  /**
   * Generates a simulated auto-submit execution plan.
   */
  public planAutoFill(
    portal: ApplicationPortal,
    foundInputs: Array<{ id: string; name: string; placeholder: string; label: string; type: string }>,
    profile: CandidateProfile = DEFAULT_CANDIDATE_PROFILE
  ): AutoSubmitReport {
    const fieldResults: AutofillFieldResult[] = [];
    const missingRequired: string[] = [];

    const requiredFields = ['fullName', 'email', 'phone'];

    for (const input of foundInputs) {
      const combinedLabel = `${input.name} ${input.id} ${input.placeholder} ${input.label}`.trim();
      const match = this.matchFieldKey(combinedLabel, input.type);

      if (match) {
        const val = this.resolveFieldValue(profile, match.fieldKey);
        fieldResults.push({
          selector: `#${input.id || input.name}`,
          fieldKey: match.fieldKey,
          fieldLabel: input.label || input.placeholder || input.name,
          filledValue: val,
          confidence: match.confidence,
          status: val ? 'filled' : 'manual_review_needed',
        });
      }
    }

    const filledKeys = new Set(fieldResults.filter(r => r.status === 'filled').map(r => r.fieldKey));
    for (const req of requiredFields) {
      if (!filledKeys.has(req) && !(req === 'fullName' && filledKeys.has('firstName') && filledKeys.has('lastName'))) {
        missingRequired.push(req);
      }
    }

    const portalNames: Record<ApplicationPortal, string> = {
      greenhouse: 'Greenhouse ATS',
      lever: 'Lever ATS',
      workday: 'Workday Application Portal',
      ashby: 'Ashby Application Portal',
      smartrecruiters: 'SmartRecruiters ATS',
      handshake: 'Handshake Campus Jobs',
      linkedin_easy_apply: 'LinkedIn Easy Apply',
      generic_form: 'Standard Web Application Form',
      unknown: 'Unknown Portal',
    };

    return {
      portal,
      portalName: portalNames[portal] || 'Job Application',
      url: '',
      fieldsFound: foundInputs.length,
      fieldsFilled: fieldResults.filter(r => r.status === 'filled').length,
      fieldsNeedingReview: fieldResults.filter(r => r.status !== 'filled').length,
      fieldResults,
      readyForSubmission: missingRequired.length === 0 && fieldResults.length > 0,
      missingRequiredFields: missingRequired,
    };
  }
}
