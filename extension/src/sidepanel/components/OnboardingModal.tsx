import React, { useState, useEffect, useRef } from 'react';
import {
  ChevronRight,
  ChevronLeft,
  Check,
  Sparkles,
  ShieldCheck,
  Linkedin,
  Github,
  Globe,
  AlertCircle,
  Lock,
} from 'lucide-react';
import { ApplicantProfile } from '../../types/index.js';
import { DEFAULT_APPLICANT_PROFILE, saveStoredApplicantProfile, markOnboardingComplete } from '../../services/storage.js';

interface OnboardingModalProps {
  onComplete: (profile: ApplicantProfile) => void;
  initialProfile?: ApplicantProfile;
}

type Step = 1 | 2 | 3;

const STEP_LABELS: Record<Step, string> = {
  1: 'Personal Info',
  2: 'Education & Links',
  3: 'Work Authorization',
};

function InputField({
  id,
  label,
  type = 'text',
  value,
  onChange,
  onBlur,
  placeholder,
  required,
  error,
  inputRef,
}: {
  id?: string;
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  required?: boolean;
  error?: string | null;
  inputRef?: React.RefObject<HTMLInputElement>;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
          <span>{label}</span>
          {required && <span className="text-rose-500 font-bold text-[10px]">*</span>}
        </label>
        {required && (
          <span className="text-[9px] font-medium text-rose-600/80 dark:text-rose-400/80 uppercase tracking-wider">
            Required
          </span>
        )}
      </div>
      <input
        id={id}
        ref={inputRef}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        className={`w-full px-2.5 py-1.5 rounded-md text-xs transition-all focus:outline-none ${
          error
            ? 'bg-rose-50/50 dark:bg-rose-950/20 border border-rose-400 dark:border-rose-500 text-rose-900 dark:text-rose-100 placeholder:text-rose-300 focus:ring-1 focus:ring-rose-400'
            : 'bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-brand-500 focus:ring-1 focus:ring-brand-200 dark:focus:ring-brand-900'
        }`}
      />
      {error && (
        <div className="flex items-center gap-1 text-[10px] text-rose-600 dark:text-rose-400 font-medium pt-0.5">
          <AlertCircle className="w-3 h-3 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ onComplete, initialProfile }) => {
  const [step, setStep] = useState<Step>(1);
  const [isSaving, setIsSaving] = useState(false);
  const [profile, setProfile] = useState<ApplicantProfile>({
    ...DEFAULT_APPLICANT_PROFILE,
    ...(initialProfile || {}),
  });

  // Track field touched states and whether user attempted to advance
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [hasAttemptedNext, setHasAttemptedNext] = useState(false);

  // Field refs to focus invalid inputs on attempt
  const firstNameRef = useRef<HTMLInputElement>(null);
  const lastNameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  // Prevent closing the modal via Escape key since onboarding is required for all users
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, []);

  const update = (fields: Partial<ApplicantProfile>) =>
    setProfile((prev) => ({ ...prev, ...fields }));

  const markTouched = (field: string) =>
    setTouched((prev) => ({ ...prev, [field]: true }));

  // Validation rules
  const isFirstNameEmpty = !profile.firstName.trim();
  const isLastNameEmpty = !profile.lastName.trim();
  const isEmailEmpty = !profile.email.trim();
  const isValidEmailFormat = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email.trim());
  const isEmailInvalid = !isEmailEmpty && !isValidEmailFormat;

  const firstNameError =
    (touched.firstName || hasAttemptedNext) && isFirstNameEmpty
      ? 'First name is required to move on'
      : null;

  const lastNameError =
    (touched.lastName || hasAttemptedNext) && isLastNameEmpty
      ? 'Last name is required to move on'
      : null;

  const emailError =
    (touched.email || hasAttemptedNext) && isEmailEmpty
      ? 'Email address is required to move on'
      : (touched.email || hasAttemptedNext) && isEmailInvalid
      ? 'Please enter a valid email address (e.g. name@example.com)'
      : null;

  const step1Valid = !isFirstNameEmpty && !isLastNameEmpty && !isEmailEmpty && isValidEmailFormat;

  const handleNext = () => {
    setHasAttemptedNext(true);
    if (step === 1) {
      if (!step1Valid) {
        // Automatically focus the first invalid field so user can fill it in
        if (isFirstNameEmpty && firstNameRef.current) {
          firstNameRef.current.focus();
        } else if (isLastNameEmpty && lastNameRef.current) {
          lastNameRef.current.focus();
        } else if ((isEmailEmpty || isEmailInvalid) && emailRef.current) {
          emailRef.current.focus();
        }
        return;
      }
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    }
  };

  const handleStepClick = (target: Step) => {
    if (target > 1 && !step1Valid) {
      setHasAttemptedNext(true);
      if (isFirstNameEmpty && firstNameRef.current) firstNameRef.current.focus();
      else if (isLastNameEmpty && lastNameRef.current) lastNameRef.current.focus();
      else if ((isEmailEmpty || isEmailInvalid) && emailRef.current) emailRef.current.focus();
      return;
    }
    setStep(target);
  };

  const handleFinish = async () => {
    if (!step1Valid) {
      setStep(1);
      setHasAttemptedNext(true);
      return;
    }
    setIsSaving(true);
    try {
      const finalized: ApplicantProfile = {
        ...profile,
        firstName: profile.firstName.trim(),
        lastName: profile.lastName.trim(),
        email: profile.email.trim(),
        fullName: `${profile.firstName.trim()} ${profile.lastName.trim()}`.trim(),
      };
      await saveStoredApplicantProfile(finalized);
      await markOnboardingComplete();
      onComplete(finalized);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-modal-title"
      className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-sm flex flex-col overflow-hidden text-slate-900 dark:text-slate-100 transition-colors">

        {/* Header with Mandatory Badge */}
        <div className="bg-gradient-to-r from-brand-600 to-indigo-600 dark:from-brand-700 dark:to-indigo-800 px-5 py-4 text-white">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-yellow-300" />
              <span id="onboarding-modal-title" className="font-headline font-bold text-sm">
                Welcome to ResumeHack
              </span>
            </div>
            <div className="flex items-center gap-1 bg-white/20 backdrop-blur-xs px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide">
              <Lock className="w-2.5 h-2.5" />
              <span>Required Setup</span>
            </div>
          </div>
          <p className="text-[11px] text-indigo-100 leading-relaxed">
            Fill in your profile details to unlock auto-apply, precision tailoring, and ATS scoring.
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-0 px-5 pt-4">
          {([1, 2, 3] as Step[]).map((s) => (
            <React.Fragment key={s}>
              <button
                type="button"
                onClick={() => handleStepClick(s)}
                className="flex flex-col items-center gap-0.5 flex-shrink-0 cursor-pointer focus:outline-none"
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                    step > s
                      ? 'bg-emerald-500 text-white'
                      : step === s
                      ? 'bg-brand-600 text-white ring-2 ring-brand-200 dark:ring-brand-900'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {step > s ? <Check className="w-3 h-3" /> : s}
                </div>
                <span
                  className={`text-[9px] font-medium whitespace-nowrap ${
                    step === s
                      ? 'text-brand-700 dark:text-brand-400 font-bold'
                      : 'text-slate-400 dark:text-slate-500'
                  }`}
                >
                  {STEP_LABELS[s]}
                </span>
              </button>
              {s < 3 && (
                <div
                  className={`flex-1 h-px mx-1 mt-[-10px] transition-all ${
                    step > s ? 'bg-emerald-400 dark:bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'
                  }`}
                />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Step content */}
        <div className="flex-1 px-5 py-4 space-y-3 overflow-y-auto max-h-[380px]">

          {/* Step 1: Personal Info (Mandatory gating fields) */}
          {step === 1 && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Required contact fields needed for auto-filling application forms.
                </p>
              </div>

              {hasAttemptedNext && !step1Valid && (
                <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-[11px] text-rose-800 dark:text-rose-200 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                  <span>
                    Please fill in all required fields (<strong>*</strong>) to move on.
                  </span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <InputField
                  id="onboarding-firstname"
                  label="First Name"
                  inputRef={firstNameRef}
                  value={profile.firstName}
                  onChange={(v) => update({ firstName: v })}
                  onBlur={() => markTouched('firstName')}
                  placeholder="Alex"
                  required
                  error={firstNameError}
                />
                <InputField
                  id="onboarding-lastname"
                  label="Last Name"
                  inputRef={lastNameRef}
                  value={profile.lastName}
                  onChange={(v) => update({ lastName: v })}
                  onBlur={() => markTouched('lastName')}
                  placeholder="Chen"
                  required
                  error={lastNameError}
                />
              </div>

              <InputField
                id="onboarding-email"
                label="Email Address"
                type="email"
                inputRef={emailRef}
                value={profile.email}
                onChange={(v) => update({ email: v })}
                onBlur={() => markTouched('email')}
                placeholder="alex.chen@example.com"
                required
                error={emailError}
              />

              <div className="grid grid-cols-2 gap-2">
                <InputField
                  id="onboarding-phone"
                  label="Phone Number"
                  type="tel"
                  value={profile.phone}
                  onChange={(v) => update({ phone: v })}
                  placeholder="+1 (415) 555-0100"
                />
                <InputField
                  id="onboarding-location"
                  label="City, State"
                  value={profile.location}
                  onChange={(v) => update({ location: v })}
                  placeholder="San Francisco, CA"
                />
              </div>
            </>
          )}

          {/* Step 2: Education & Links */}
          {step === 2 && (
            <>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Education and links are used for school/degree fields and portfolio questions.
              </p>
              <InputField
                label="University / College"
                value={profile.school}
                onChange={(v) => update({ school: v })}
                placeholder="UC Berkeley"
              />
              <div className="grid grid-cols-3 gap-2">
                <InputField
                  label="Degree"
                  value={profile.degree}
                  onChange={(v) => update({ degree: v })}
                  placeholder="BS"
                />
                <InputField
                  label="Major"
                  value={profile.major}
                  onChange={(v) => update({ major: v })}
                  placeholder="Computer Science"
                />
                <InputField
                  label="GPA"
                  value={profile.gpa ?? ''}
                  onChange={(v) => update({ gpa: v })}
                  placeholder="3.85"
                />
              </div>
              <InputField
                label="Graduation Month / Year"
                value={profile.gradMonthYear}
                onChange={(v) => update({ gradMonthYear: v })}
                placeholder="May 2026"
              />
              <div className="border-t border-slate-100 dark:border-slate-800 pt-2 space-y-2">
                <p className="text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                  Online Profiles (optional)
                </p>
                <div className="flex items-center gap-2">
                  <Linkedin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <input
                    type="url"
                    value={profile.linkedinUrl}
                    onChange={(e) => update({ linkedinUrl: e.target.value })}
                    placeholder="linkedin.com/in/yourprofile"
                    className="flex-1 px-2 py-1 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-brand-500"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Github className="w-3.5 h-3.5 text-slate-700 dark:text-slate-300 shrink-0" />
                  <input
                    type="url"
                    value={profile.githubUrl}
                    onChange={(e) => update({ githubUrl: e.target.value })}
                    placeholder="github.com/yourusername"
                    className="flex-1 px-2 py-1 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-brand-500"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Globe className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                  <input
                    type="url"
                    value={profile.portfolioUrl ?? ''}
                    onChange={(e) => update({ portfolioUrl: e.target.value })}
                    placeholder="yourportfolio.com (optional)"
                    className="flex-1 px-2 py-1 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>
            </>
          )}

          {/* Step 3: Work Authorization */}
          {step === 3 && (
            <>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Used to answer EEO and sponsorship questions on applications. Stored only on your device.
              </p>
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  Authorization Status
                </label>
                <select
                  value={profile.workAuthorization}
                  onChange={(e) => update({ workAuthorization: e.target.value as ApplicantProfile['workAuthorization'] })}
                  className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-brand-500"
                >
                  <option value="US_CITIZEN">US Citizen</option>
                  <option value="PERMANENT_RESIDENT">Permanent Resident (Green Card)</option>
                  <option value="F1_OPT">F-1 OPT / CPT Student Visa</option>
                  <option value="REQUIRES_SPONSORSHIP">Requires Visa Sponsorship (H-1B, O-1, TN)</option>
                  <option value="OTHER">Other Authorization</option>
                </select>
              </div>
              <div className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="space-y-0.5 pr-2">
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">
                    Will require visa sponsorship?
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                    Now or in the future
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={profile.requiresVisaSponsorship}
                  onChange={(e) => update({ requiresVisaSponsorship: e.target.checked })}
                  className="w-4 h-4 accent-brand-600 rounded cursor-pointer"
                />
              </div>
              <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-lg text-[10px] text-emerald-900 dark:text-emerald-200 space-y-1">
                <div className="flex items-center gap-1.5 font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Privacy Guarantee</span>
                </div>
                <p className="leading-relaxed">
                  Demographic questions (race, gender, veteran status, disability) are <strong>never auto-filled</strong>. Your profile stays on your device only.
                </p>
              </div>
              {profile.firstName && (
                <div className="p-2.5 bg-brand-50 dark:bg-brand-950/40 border border-brand-200 dark:border-brand-800/60 rounded-lg text-[11px] text-brand-900 dark:text-brand-200 space-y-0.5">
                  <p className="font-semibold text-brand-800 dark:text-brand-300">Profile Preview</p>
                  <p>{profile.firstName} {profile.lastName} · {profile.email}</p>
                  {profile.school && <p>{profile.school}{profile.major ? ` · ${profile.major}` : ''}</p>}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer navigation */}
        <div className="px-5 pb-5 pt-3 flex items-center justify-between border-t border-slate-100 dark:border-slate-800 mt-1">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => (s - 1) as Step)}
              className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-semibold transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Back
            </button>
          ) : (
            <div className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
              <span>Step 1 of 3</span>
            </div>
          )}

          {step < 3 ? (
            <button
              type="button"
              onClick={handleNext}
              title={step === 1 && !step1Valid ? 'Please fill in all required fields (*) to move on' : undefined}
              className={`flex items-center gap-1.5 py-2 px-4 rounded-lg text-xs font-bold transition-all shadow-sm ${
                step === 1 && !step1Valid
                  ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-300 dark:border-slate-700 cursor-not-allowed hover:bg-slate-300 dark:hover:bg-slate-750'
                  : 'bg-brand-600 hover:bg-brand-700 text-white cursor-pointer shadow-brand-500/20'
              }`}
            >
              <span>Continue</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinish}
              disabled={isSaving || !step1Valid}
              className="flex items-center gap-1.5 py-2 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer shadow-emerald-500/20"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Saving…' : 'Finish Setup'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
