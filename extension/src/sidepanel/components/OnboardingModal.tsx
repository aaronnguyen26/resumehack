import React, { useState } from 'react';
import {
  ChevronRight,
  ChevronLeft,
  Check,
  Sparkles,
  ShieldCheck,
  Linkedin,
  Github,
  Globe,
} from 'lucide-react';
import { ApplicantProfile } from '../../types/index.js';
import { DEFAULT_APPLICANT_PROFILE, saveStoredApplicantProfile, markOnboardingComplete } from '../../services/storage.js';

interface OnboardingModalProps {
  onComplete: (profile: ApplicantProfile) => void;
}

type Step = 1 | 2 | 3;

const STEP_LABELS: Record<Step, string> = {
  1: 'Personal Info',
  2: 'Education & Links',
  3: 'Work Authorization',
};

function InputField({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1">
        {label}
        {required && <span className="text-rose-500 text-[10px]">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-900 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-200 transition-all"
      />
    </div>
  );
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ onComplete }) => {
  const [step, setStep] = useState<Step>(1);
  const [isSaving, setIsSaving] = useState(false);
  const [profile, setProfile] = useState<ApplicantProfile>({ ...DEFAULT_APPLICANT_PROFILE });

  const update = (fields: Partial<ApplicantProfile>) =>
    setProfile((prev) => ({ ...prev, ...fields }));

  const step1Valid =
    profile.firstName.trim().length > 0 &&
    profile.lastName.trim().length > 0 &&
    profile.email.trim().length > 0;

  const handleFinish = async () => {
    setIsSaving(true);
    const finalized: ApplicantProfile = {
      ...profile,
      fullName: `${profile.firstName.trim()} ${profile.lastName.trim()}`.trim(),
    };
    await saveStoredApplicantProfile(finalized);
    await markOnboardingComplete();
    setIsSaving(false);
    onComplete(finalized);
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm flex flex-col overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-r from-brand-600 to-indigo-600 px-5 py-4 text-white">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-4 h-4 text-yellow-300" />
            <span className="font-headline font-bold text-sm">Welcome to ResumeHack</span>
          </div>
          <p className="text-[11px] text-indigo-100 leading-relaxed">
            Set up your applicant profile once so auto-apply fills your forms accurately.
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-0 px-5 pt-4">
          {([1, 2, 3] as Step[]).map((s) => (
            <React.Fragment key={s}>
              <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                    step > s
                      ? 'bg-emerald-500 text-white'
                      : step === s
                      ? 'bg-brand-600 text-white ring-2 ring-brand-200'
                      : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {step > s ? <Check className="w-3 h-3" /> : s}
                </div>
                <span
                  className={`text-[9px] font-medium whitespace-nowrap ${
                    step === s ? 'text-brand-700' : 'text-slate-400'
                  }`}
                >
                  {STEP_LABELS[s]}
                </span>
              </div>
              {s < 3 && (
                <div
                  className={`flex-1 h-px mx-1 mt-[-10px] transition-all ${
                    step > s ? 'bg-emerald-400' : 'bg-slate-200'
                  }`}
                />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Step content */}
        <div className="flex-1 px-5 py-4 space-y-3 overflow-y-auto max-h-[380px]">

          {/* Step 1: Personal Info */}
          {step === 1 && (
            <>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Used to fill in your name, email, and contact details on application forms.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <InputField label="First Name" value={profile.firstName} onChange={(v) => update({ firstName: v })} placeholder="Alex" required />
                <InputField label="Last Name" value={profile.lastName} onChange={(v) => update({ lastName: v })} placeholder="Johnson" required />
              </div>
              <InputField label="Email Address" type="email" value={profile.email} onChange={(v) => update({ email: v })} placeholder="you@example.com" required />
              <div className="grid grid-cols-2 gap-2">
                <InputField label="Phone Number" type="tel" value={profile.phone} onChange={(v) => update({ phone: v })} placeholder="+1 (415) 555-0100" />
                <InputField label="City, State" value={profile.location} onChange={(v) => update({ location: v })} placeholder="San Francisco, CA" />
              </div>
            </>
          )}

          {/* Step 2: Education & Links */}
          {step === 2 && (
            <>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Education and links are used for school/degree fields and portfolio questions.
              </p>
              <InputField label="University / College" value={profile.school} onChange={(v) => update({ school: v })} placeholder="UC Berkeley" />
              <div className="grid grid-cols-3 gap-2">
                <InputField label="Degree" value={profile.degree} onChange={(v) => update({ degree: v })} placeholder="BS" />
                <InputField label="Major" value={profile.major} onChange={(v) => update({ major: v })} placeholder="Computer Science" />
                <InputField label="GPA" value={profile.gpa ?? ''} onChange={(v) => update({ gpa: v })} placeholder="3.85" />
              </div>
              <InputField label="Graduation Month / Year" value={profile.gradMonthYear} onChange={(v) => update({ gradMonthYear: v })} placeholder="May 2026" />
              <div className="border-t border-slate-100 pt-2 space-y-2">
                <p className="text-[10px] font-semibold text-slate-600">Online Profiles (optional)</p>
                <div className="flex items-center gap-2">
                  <Linkedin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <input type="url" value={profile.linkedinUrl} onChange={(e) => update({ linkedinUrl: e.target.value })} placeholder="linkedin.com/in/yourprofile" className="flex-1 px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs text-slate-900 focus:outline-none focus:border-brand-500" />
                </div>
                <div className="flex items-center gap-2">
                  <Github className="w-3.5 h-3.5 text-slate-700 shrink-0" />
                  <input type="url" value={profile.githubUrl} onChange={(e) => update({ githubUrl: e.target.value })} placeholder="github.com/yourusername" className="flex-1 px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs text-slate-900 focus:outline-none focus:border-brand-500" />
                </div>
                <div className="flex items-center gap-2">
                  <Globe className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                  <input type="url" value={profile.portfolioUrl ?? ''} onChange={(e) => update({ portfolioUrl: e.target.value })} placeholder="yourportfolio.com (optional)" className="flex-1 px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs text-slate-900 focus:outline-none focus:border-brand-500" />
                </div>
              </div>
            </>
          )}

          {/* Step 3: Work Authorization */}
          {step === 3 && (
            <>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Used to answer EEO and sponsorship questions on applications. Stored only on your device.
              </p>
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-700">Authorization Status</label>
                <select
                  value={profile.workAuthorization}
                  onChange={(e) => update({ workAuthorization: e.target.value as ApplicantProfile['workAuthorization'] })}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-900 focus:outline-none focus:border-brand-500"
                >
                  <option value="US_CITIZEN">US Citizen</option>
                  <option value="PERMANENT_RESIDENT">Permanent Resident (Green Card)</option>
                  <option value="F1_OPT">F-1 OPT / CPT Student Visa</option>
                  <option value="REQUIRES_SPONSORSHIP">Requires Visa Sponsorship (H-1B, O-1, TN)</option>
                  <option value="OTHER">Other Authorization</option>
                </select>
              </div>
              <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                <div className="space-y-0.5 pr-2">
                  <span className="text-xs font-semibold text-slate-800 block">Will require visa sponsorship?</span>
                  <span className="text-[10px] text-slate-500 block">Now or in the future</span>
                </div>
                <input
                  type="checkbox"
                  checked={profile.requiresVisaSponsorship}
                  onChange={(e) => update({ requiresVisaSponsorship: e.target.checked })}
                  className="w-4 h-4 accent-brand-600 rounded cursor-pointer"
                />
              </div>
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-[10px] text-emerald-900 space-y-1">
                <div className="flex items-center gap-1.5 font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Privacy Guarantee</span>
                </div>
                <p className="leading-relaxed">
                  Demographic questions (race, gender, veteran status, disability) are <strong>never auto-filled</strong>. Your profile stays on your device only.
                </p>
              </div>
              {profile.firstName && (
                <div className="p-2.5 bg-brand-50 border border-brand-200 rounded-lg text-[11px] text-brand-900 space-y-0.5">
                  <p className="font-semibold text-brand-800">Profile Preview</p>
                  <p>{profile.firstName} {profile.lastName} · {profile.email}</p>
                  {profile.school && <p>{profile.school}{profile.major ? ` · ${profile.major}` : ''}</p>}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer navigation */}
        <div className="px-5 pb-5 pt-2 flex items-center justify-between border-t border-slate-100 mt-1">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => (s - 1) as Step)}
              className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800 font-semibold transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Back
            </button>
          ) : (
            <div />
          )}

          {step < 3 ? (
            <button
              type="button"
              onClick={() => setStep((s) => (s + 1) as Step)}
              disabled={step === 1 && !step1Valid}
              className="flex items-center gap-1.5 py-2 px-4 bg-brand-600 hover:bg-brand-700 disabled:opacity-40 text-white rounded-lg text-xs font-bold transition-all shadow-sm"
            >
              <span>Continue</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinish}
              disabled={isSaving || !step1Valid}
              className="flex items-center gap-1.5 py-2 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-lg text-xs font-bold transition-all shadow-sm"
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
