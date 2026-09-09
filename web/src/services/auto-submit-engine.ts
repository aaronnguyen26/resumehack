/**
 * AutoSubmitEngine — Intelligent Job Application Autofill & Automated Submission
 * Handles multi-portal ATS recognition (Greenhouse, Lever, Ashby, SmartRecruiters, Handshake)
 * Strictly enforces EEO demographic exclusions, explicit decline selection for required EEOs,
 * and 3-state fail-safe field classification.
 */

import { ApplicantProfile } from '../types/index.js';
import { DEFAULT_APPLICANT_PROFILE } from './storage.js';

export type ApplicationPortal =
  | 'greenhouse'
  | 'lever'
  | 'ashby'
  | 'smartrecruiters'
  | 'workday'
  | 'handshake'
  | 'linkedin_easy_apply'
  | 'generic_form'
  | 'unknown';

export interface FieldMappingRule {
  fieldKey: keyof ApplicantProfile | string;
  matchPatterns: (string | RegExp)[];
  fieldType: 'text' | 'email' | 'tel' | 'url' | 'select' | 'radio' | 'checkbox' | 'file';
  priority: number;
}

export type FieldClassificationType =
  | 'standard'
  | 'eeo_voluntary'
  | 'eeo_required_decline'
  | 'custom_question'
  | 'resume_file'
  | 'unclassified_manual_review';

export interface FormInputDescriptor {
  id?: string;
  name?: string;
  placeholder?: string;
  label?: string;
  ariaLabel?: string;
  type?: string;
  tagName?: string;
  required?: boolean;
  options?: Array<{ text: string; value: string }>;
}

export interface AutofillFieldResult {
  selector?: string;
  fieldKey: string;
  fieldLabel: string;
  filledValue: string;
  confidence: number;
  classification: FieldClassificationType;
  status: 'filled' | 'skipped_eeo' | 'selected_decline' | 'needs_ai_answer' | 'manual_review_needed';
  aiAnswer?: string;
  note?: string;
}

export interface AutoSubmitReport {
  portal: ApplicationPortal;
  portalName: string;
  url: string;
  fieldsFound: number;
  fieldsFilled: number;
  fieldsSkippedEeo: number;
  fieldsNeedingReview: number;
  customQuestionsCount: number;
  fieldResults: AutofillFieldResult[];
  readyForSubmission: boolean;
  isManualOnly: boolean;
  missingRequiredFields: string[];
  termsDisclosure: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Comprehensive EEO / Demographic Pattern Catalog
// ────────────────────────────────────────────────────────────────────────────

export const EEO_DEMOGRAPHIC_PATTERNS = [
  // Race / Ethnicity / Heritage
  /(\brace\b|\bethnicity\b|\bhispanic\b|\blatino\b|\bblack\b|\bafrican\s*american\b|\bwhite\b|\bcaucasian\b|\basian\b|\bindigenous\b|\bnative\s*american\b|\bpacific\s*islander\b|\bdemographic\b)/i,
  // Gender / Pronouns / Sexual Orientation
  /(\bgender\b|\bgender\s*identity\b|\bsex\b|\bpronouns\b|\bsexual\s*orientation\b|\blgbtq\b|\btransgender\b)/i,
  // Veteran / Military Status
  /(\bveteran\b|\barmed\s*forces\b|\bmilitary\b|\bprotected\s*veteran\b|\bactive\s*duty\b|\bdischarge\b|\bvets\b|\bvets-4212\b)/i,
  // Disability / Impairment
  /(\bdisability\b|\bhandicap\b|\bimpairment\b|\bmedical\s*condition\b|\baccommodation\b|\bphysical\s*or\s*mental\s*impairment\b|\bcc-305\b)/i,
  // Voluntary Self-Identification & OFCCP Government Notices
  /(\bvoluntary\s*self\b|\bself-identify\b|\bequal\s*employment\b|\bofccp\b|\beeo\b|\be-verify\b|\beeo-1\b|\bequal\s*opportunity\b)/i,
];

// Regex to strictly identify the "Decline to Self-Identify" choice across ATS portals
export const DECLINE_OPTION_PATTERN =
  /^((i\s*)?(prefer|choose|decline|opt)\s*not\s*to\s*(say|answer|disclose|state|specify|self-identify|provide)|(i\s*)?(do\s*not|choose\s*not\s*to|decline\s*to)\s*(wish\s*to\s*)?(self\s*identify|disclose|answer|provide|state|specify)|decline\s*to\s*(self\s*identify|state|answer|disclose|specify)|not\s*disclosed|i\s*do\s*not\s*wish\s*to\s*answer|decline)/i;

export const FIELD_MAPPING_RULES: FieldMappingRule[] = [
  {
    fieldKey: 'email',
    matchPatterns: ['email', 'email_address', 'e-mail', 'applicant_email', /\bemail\b/i],
    fieldType: 'email',
    priority: 15,
  },
  {
    fieldKey: 'phone',
    matchPatterns: ['phone', 'mobile', 'telephone', 'phone_number', 'contact_number', 'applicant_phone', /\b(phone|mobile|cell|telephone)\b/i],
    fieldType: 'tel',
    priority: 15,
  },
  {
    fieldKey: 'firstName',
    matchPatterns: ['first_name', 'firstname', 'first-name', 'fname', 'given_name', /\b(first\s*name|given\s*name)\b/i],
    fieldType: 'text',
    priority: 12,
  },
  {
    fieldKey: 'lastName',
    matchPatterns: ['last_name', 'lastname', 'last-name', 'lname', 'family_name', 'surname', /\b(last\s*name|family\s*name|surname)\b/i],
    fieldType: 'text',
    priority: 12,
  },
  {
    fieldKey: 'linkedinUrl',
    matchPatterns: ['linkedin', 'linkedin_url', 'linkedin_profile', 'urls[linkedin]', 'urls_linkedin', /\blinkedin\b/i],
    fieldType: 'url',
    priority: 11,
  },
  {
    fieldKey: 'githubUrl',
    matchPatterns: ['github', 'github_url', 'github_profile', 'urls[github]', 'urls_github', /\bgithub\b/i],
    fieldType: 'url',
    priority: 11,
  },
  {
    fieldKey: 'portfolioUrl',
    matchPatterns: ['portfolio', 'personal_website', 'website', 'urls[portfolio]', 'urls[website]', /\b(portfolio|personal\s*site|personal\s*website)\b/i],
    fieldType: 'url',
    priority: 11,
  },
  {
    fieldKey: 'school',
    matchPatterns: ['school', 'university', 'college', 'institution', 'education_school', /\b(university|school|college|institution)\b/i],
    fieldType: 'text',
    priority: 8,
  },
  {
    fieldKey: 'degree',
    matchPatterns: ['degree', 'education_level', 'degree_type', /\b(degree|education\s*level)\b/i],
    fieldType: 'text',
    priority: 8,
  },
  {
    fieldKey: 'major',
    matchPatterns: ['major', 'field_of_study', 'discipline', /\b(major|field\s*of\s*study|discipline)\b/i],
    fieldType: 'text',
    priority: 8,
  },
  {
    fieldKey: 'gpa',
    matchPatterns: ['gpa', 'cumulative_gpa', /\b(gpa|grade\s*point)\b/i],
    fieldType: 'text',
    priority: 7,
  },
  {
    fieldKey: 'gradMonthYear',
    matchPatterns: ['graduation_date', 'grad_date', 'graduation_year', 'grad_year', /\b(graduation|grad\s*date|graduation\s*year)\b/i],
    fieldType: 'text',
    priority: 7,
  },
  {
    fieldKey: 'location',
    matchPatterns: ['current_location', 'city', 'location', 'address', 'candidate_location', /\b(current\s*location|city|location|address)\b/i],
    fieldType: 'text',
    priority: 7,
  },
  {
    fieldKey: 'fullName',
    matchPatterns: ['full_name', 'fullname', 'applicant_name', /\bfull\s*name\b/i, /\byour\s*name\b/i],
    fieldType: 'text',
    priority: 5,
  },
  {
    fieldKey: 'workAuthorization',
    matchPatterns: ['work_authorization', 'work_auth', 'legally_authorized', /\b(authorized\s*to\s*work|work\s*authorization|legally\s*authorized)\b/i],
    fieldType: 'select',
    priority: 10,
  },
  {
    fieldKey: 'requiresVisaSponsorship',
    matchPatterns: ['visa_sponsorship', 'require_sponsorship', /\b(sponsorship|require\s*visa|future\s*sponsorship)\b/i, /will\s*you\s*now\s*or\s*in\s*the\s*future\s*require/i],
    fieldType: 'radio',
    priority: 10,
  },
];

export class AutoSubmitEngine {
  /**
   * Detects the ATS platform from URL or HTML indicators.
   */
  public detectPortal(url: string, htmlContent: string = ''): ApplicationPortal {
    const urlLower = url.toLowerCase();
    const htmlLower = htmlContent.toLowerCase();

    if (
      urlLower.includes('greenhouse.io') ||
      urlLower.includes('job-boards.greenhouse.io') ||
      htmlLower.includes('id="application_form"') ||
      htmlLower.includes('greenhouse')
    ) {
      return 'greenhouse';
    }
    if (urlLower.includes('lever.co') || htmlLower.includes('class="application-form"') || htmlLower.includes('lever')) {
      return 'lever';
    }
    if (urlLower.includes('ashbyhq.com') || htmlLower.includes('ashby-application') || htmlLower.includes('ashby')) {
      return 'ashby';
    }
    if (urlLower.includes('smartrecruiters.com') || htmlLower.includes('smartrecruiters')) {
      return 'smartrecruiters';
    }
    if (urlLower.includes('myworkdayjobs.com') || htmlLower.includes('data-automation-id') || htmlLower.includes('workday')) {
      return 'workday';
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
   * Evaluates if a given field label/name/id matches known voluntary EEO/Demographic patterns.
   */
  public isEeoField(identifier: string): boolean {
    const text = identifier.trim();
    if (!text) return false;
    for (const pattern of EEO_DEMOGRAPHIC_PATTERNS) {
      if (pattern.test(text)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Finds the explicit "Decline to Self-Identify" option among provided choices.
   * STRICT SAFETY GUARANTEE: Returns null if no option matches decline pattern (NEVER picks a demographic option).
   */
  public findDeclineOption(options: Array<{ text: string; value: string }>): { text: string; value: string } | null {
    if (!options || options.length === 0) return null;

    for (const opt of options) {
      const cleanText = opt.text.trim();
      const cleanVal = opt.value.trim();
      if (DECLINE_OPTION_PATTERN.test(cleanText) || DECLINE_OPTION_PATTERN.test(cleanVal)) {
        return opt;
      }
    }

    return null;
  }

  /**
   * 3-State Fail-Safe Field Classifier
   */
  public classifyField(
    input: FormInputDescriptor
  ): {
    classification: FieldClassificationType;
    fieldKey?: string;
    confidence: number;
    declineOption?: { text: string; value: string };
  } {
    const combined = `${input.name || ''} ${input.id || ''} ${input.placeholder || ''} ${input.ariaLabel || ''} ${input.label || ''}`.trim();
    const type = (input.type || 'text').toLowerCase();
    const tagName = (input.tagName || 'input').toLowerCase();

    // 1. Resume File Upload Field
    if (type === 'file' || combined.toLowerCase().includes('resume') || combined.toLowerCase().includes('cv')) {
      return { classification: 'resume_file', fieldKey: 'tailoredResumePdf', confidence: 0.98 };
    }

    // 2. High-Confidence EEO / Demographic Check
    if (this.isEeoField(combined)) {
      if (input.required) {
        const declineOpt = input.options ? this.findDeclineOption(input.options) : undefined;
        return {
          classification: 'eeo_required_decline',
          confidence: 0.95,
          declineOption: declineOpt || undefined,
        };
      }
      return { classification: 'eeo_voluntary', confidence: 0.95 };
    }

    // 3. Open-Ended Custom Questions (Textareas or long question text)
    if (tagName === 'textarea' || (type === 'text' && combined.length > 50 && (combined.includes('?') || combined.toLowerCase().includes('why')))) {
      return { classification: 'custom_question', confidence: 0.9 };
    }

    // 4. Standard Mapped Profile Fields
    const match = this.matchFieldKey(combined, type);
    if (match && match.confidence >= 0.85) {
      return {
        classification: 'standard',
        fieldKey: match.fieldKey,
        confidence: match.confidence,
      };
    }

    // 5. FAIL-SAFE: Uncertain / Unclassified Field -> Mark for Manual Review (Never guess!)
    return {
      classification: 'unclassified_manual_review',
      confidence: match ? match.confidence : 0,
    };
  }

  /**
   * Matches an input element's identifier (name, id, placeholder, label text) to a profile field.
   */
  public matchFieldKey(fieldIdentifier: string, inputType: string = 'text'): { fieldKey: string; confidence: number } | null {
    const raw = fieldIdentifier.toLowerCase();
    const norm = raw.replace(/[^a-z0-9\s_-]/g, ' ').trim();
    const normClean = norm.replace(/[_-]/g, ' ');

    if (inputType === 'email' || norm.includes('email')) {
      return { fieldKey: 'email', confidence: 0.98 };
    }
    if (inputType === 'tel' || (norm.includes('phone') && !norm.includes('microphone'))) {
      return { fieldKey: 'phone', confidence: 0.98 };
    }

    for (const rule of FIELD_MAPPING_RULES) {
      for (const pattern of rule.matchPatterns) {
        if (typeof pattern === 'string') {
          if (norm === pattern || normClean === pattern) {
            return { fieldKey: rule.fieldKey as string, confidence: 1.0 };
          }
          const wordRegex = new RegExp(`(^|\\s|_|-)${pattern}($|\\s|_|-)`, 'i');
          if (wordRegex.test(norm) || wordRegex.test(normClean)) {
            return { fieldKey: rule.fieldKey as string, confidence: 0.88 };
          }
        } else if (pattern instanceof RegExp) {
          if (pattern.test(norm) || pattern.test(normClean)) {
            return { fieldKey: rule.fieldKey as string, confidence: 0.92 };
          }
        }
      }
    }

    return null;
  }

  /**
   * Resolves the profile value for a given field key.
   */
  public resolveFieldValue(profile: ApplicantProfile, fieldKey: string): string {
    const val = (profile as any)[fieldKey];
    if (typeof val === 'string') return val;
    if (typeof val === 'boolean') return val ? 'Yes' : 'No';
    return '';
  }

  /**
   * Generates a complete auto-fill execution report with 3-state classification and fail-safe boundaries.
   */
  public planAutoFill(
    portal: ApplicationPortal,
    foundInputs: FormInputDescriptor[],
    profile: ApplicantProfile = DEFAULT_APPLICANT_PROFILE
  ): AutoSubmitReport {
    const fieldResults: AutofillFieldResult[] = [];
    const missingRequired: string[] = [];
    let fieldsSkippedEeo = 0;
    let customQuestionsCount = 0;

    const requiredStandardFields = ['fullName', 'email', 'phone'];

    for (const input of foundInputs) {
      const classificationResult = this.classifyField(input);
      const combinedLabel = input.label || input.placeholder || input.name || input.id || 'Field';

      if (classificationResult.classification === 'standard' && classificationResult.fieldKey) {
        const val = this.resolveFieldValue(profile, classificationResult.fieldKey);
        fieldResults.push({
          selector: `#${input.id || input.name}`,
          fieldKey: classificationResult.fieldKey,
          fieldLabel: combinedLabel,
          filledValue: val,
          confidence: classificationResult.confidence,
          classification: 'standard',
          status: val ? 'filled' : 'manual_review_needed',
        });
      } else if (classificationResult.classification === 'eeo_voluntary') {
        fieldsSkippedEeo++;
        fieldResults.push({
          selector: `#${input.id || input.name}`,
          fieldKey: 'eeo_voluntary_skip',
          fieldLabel: combinedLabel,
          filledValue: '',
          confidence: classificationResult.confidence,
          classification: 'eeo_voluntary',
          status: 'skipped_eeo',
          note: 'Voluntary demographic question left blank per privacy rules.',
        });
      } else if (classificationResult.classification === 'eeo_required_decline') {
        const declineOpt = classificationResult.declineOption;
        fieldResults.push({
          selector: `#${input.id || input.name}`,
          fieldKey: 'eeo_required_decline',
          fieldLabel: combinedLabel,
          filledValue: declineOpt?.text || 'Decline to self-identify',
          confidence: classificationResult.confidence,
          classification: 'eeo_required_decline',
          status: declineOpt ? 'selected_decline' : 'manual_review_needed',
          note: declineOpt
            ? 'Required EEO question: automatically selected explicit "Decline to self-identify" option.'
            : 'Required EEO question without detected decline option flagged for manual selection.',
        });
      } else if (classificationResult.classification === 'custom_question') {
        customQuestionsCount++;
        fieldResults.push({
          selector: `#${input.id || input.name}`,
          fieldKey: 'custom_question',
          fieldLabel: combinedLabel,
          filledValue: '',
          confidence: classificationResult.confidence,
          classification: 'custom_question',
          status: 'needs_ai_answer',
          note: 'Custom application question pending AI generation and user approval.',
        });
      } else {
        // Unclassified / Ambiguous Field -> Flagged for Manual Review
        fieldResults.push({
          selector: `#${input.id || input.name}`,
          fieldKey: 'unclassified',
          fieldLabel: combinedLabel,
          filledValue: '',
          confidence: classificationResult.confidence,
          classification: 'unclassified_manual_review',
          status: 'manual_review_needed',
          note: 'Uncertain field flagged for candidate verification (never guessed).',
        });
      }
    }

    const filledKeys = new Set(
      fieldResults.filter(r => r.status === 'filled').map(r => r.fieldKey)
    );
    for (const req of requiredStandardFields) {
      if (
        !filledKeys.has(req) &&
        !(req === 'fullName' && filledKeys.has('firstName') && filledKeys.has('lastName'))
      ) {
        missingRequired.push(req);
      }
    }

    const portalNames: Record<ApplicationPortal, string> = {
      greenhouse: 'Greenhouse ATS',
      lever: 'Lever ATS',
      ashby: 'Ashby Application Portal',
      smartrecruiters: 'SmartRecruiters ATS',
      workday: 'Workday Application Portal (Assisted Only)',
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
      fieldsFilled: fieldResults.filter(r => r.status === 'filled' || r.status === 'selected_decline').length,
      fieldsSkippedEeo,
      fieldsNeedingReview: fieldResults.filter(r => r.status === 'manual_review_needed').length,
      customQuestionsCount,
      fieldResults,
      readyForSubmission: missingRequired.length === 0 && portal !== 'workday',
      isManualOnly: portal === 'workday',
      missingRequiredFields: missingRequired,
      termsDisclosure:
        'Platform Terms Notice: ResumeHack operates locally as an assistive productivity tool. Ensure compliance with individual employer application policies.',
    };
  }
}
