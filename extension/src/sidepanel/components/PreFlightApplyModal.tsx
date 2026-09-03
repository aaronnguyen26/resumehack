import React, { useState } from 'react';
import { 
  AutoSubmitReport,
  AutofillFieldResult
} from '../../services/auto-submit-engine.js';
import { ApplicantProfile, JobPosting, ScrapedJobData } from '../../types/index.js';
import { 
  ShieldCheck, 
  CheckCircle2, 
  AlertTriangle, 
  FileText, 
  Sparkles, 
  Send, 
  X, 
  ExternalLink, 
  Check, 
  Info,
  Loader2,
  Lock,
  Edit3
} from 'lucide-react';

interface PreFlightApplyModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: AutoSubmitReport | null;
  profile: ApplicantProfile;
  job: JobPosting | ScrapedJobData | null;
  tailoredDocId?: string;
  tailoredDocUrl?: string;
  atsScore?: number;
  customAnswers: Record<string, string>;
  onUpdateCustomAnswer: (key: string, text: string) => void;
  onConfirmSubmit: () => Promise<void>;
  onTriggerAssistOnly: () => Promise<void>;
  isSubmitting: boolean;
  submitError: string | null;
  submitSuccess: boolean;
  pdfAttachmentState?: { attached: boolean; verified: boolean; fileName: string };
}

export const PreFlightApplyModal: React.FC<PreFlightApplyModalProps> = ({
  isOpen,
  onClose,
  report,
  profile,
  job,
  tailoredDocId,
  tailoredDocUrl,
  atsScore,
  customAnswers,
  onUpdateCustomAnswer,
  onConfirmSubmit,
  onTriggerAssistOnly,
  isSubmitting,
  submitError,
  submitSuccess,
  pdfAttachmentState,
}) => {
  const [activeResumeVersion, setActiveResumeVersion] = useState<'tailored' | 'master'>('tailored');

  if (!isOpen || !report) return null;

  const standardFields = report.fieldResults.filter(
    (r) => r.classification === 'standard' && r.status === 'filled'
  );
  const customQuestions = report.fieldResults.filter(
    (r) => r.classification === 'custom_question'
  );
  const eeoFields = report.fieldResults.filter(
    (r) => r.classification === 'eeo_voluntary' || r.classification === 'eeo_required_decline'
  );
  const manualReviewFields = report.fieldResults.filter(
    (r) => r.classification === 'unclassified_manual_review' || r.status === 'manual_review_needed'
  );

  const isWorkday = report.portal === 'workday' || report.isManualOnly;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 animate-fade-in">
      <div className="bg-white w-full max-w-md max-h-[90vh] rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden text-slate-900 font-sans">
        
        {/* Header */}
        <div className="px-4 py-3.5 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-brand-500/20 border border-brand-400/30 flex items-center justify-center text-brand-300 font-bold text-xs">
              ⚡
            </div>
            <div>
              <h2 className="font-headline font-bold text-xs leading-tight text-white flex items-center gap-1.5">
                <span>Pre-Flight Application Review</span>
              </h2>
              <p className="text-[10px] text-slate-300 truncate max-w-[240px]">
                {job?.company || 'Employer'} — {job?.title || 'Open Role'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-4 space-y-3.5 overflow-y-auto max-h-[calc(90vh-120px)] no-scrollbar text-xs">
          
          {/* Terms & Assistant Notice */}
          <div className="p-2.5 rounded-xl bg-blue-50/80 border border-blue-200/80 text-[10px] text-blue-900 flex items-start gap-2">
            <Info className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold block">Informed Consent &amp; Safety Review</span>
              <p className="text-blue-800/90 leading-tight">
                Inspect all populated fields, custom question answers, and resume attachments below before confirming submission.
              </p>
            </div>
          </div>

          {/* ATS Portal Badge */}
          <div className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-xl border border-slate-200">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-700">Target Portal:</span>
              <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-800">
                {report.portalName}
              </span>
            </div>
            <div className="text-[10px] font-mono text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              {report.fieldsFilled} Fields Ready
            </div>
          </div>

          {/* Section 1: Candidate Details */}
          <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
              <span className="text-[11px] font-bold text-slate-800">👤 Applicant Information</span>
              <span className="text-[10px] text-brand-600 font-semibold font-mono">From Profile</span>
            </div>
            
            <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px]">
              <div>
                <span className="text-slate-400 block text-[9px]">Full Name</span>
                <span className="font-semibold text-slate-800 truncate block">{profile.fullName}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[9px]">Email Address</span>
                <span className="font-semibold text-slate-800 truncate block">{profile.email}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[9px]">Phone</span>
                <span className="font-semibold text-slate-800 truncate block">{profile.phone}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[9px]">Location</span>
                <span className="font-semibold text-slate-800 truncate block">{profile.location}</span>
              </div>
            </div>

            <div className="pt-1 border-t border-slate-100 text-[10px] space-y-0.5">
              <div className="text-slate-600">
                <span className="font-semibold text-slate-700">Education:</span> {profile.school} ({profile.degree} in {profile.major}, {profile.gradMonthYear})
              </div>
              <div className="text-slate-600">
                <span className="font-semibold text-slate-700">Work Auth:</span> {profile.workAuthorization.replace(/_/g, ' ')} {profile.requiresVisaSponsorship ? '(Sponsorship: Yes)' : '(No Sponsorship Required)'}
              </div>
            </div>
          </div>

          {/* Section 2: Resume Attachment */}
          <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
              <div className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-brand-600" />
                <span className="text-[11px] font-bold text-slate-800">📄 Resume Attachment</span>
              </div>
              {atsScore && (
                <span className="font-mono text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                  {atsScore}% ATS Match
                </span>
              )}
            </div>

            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div className="space-y-0.5 truncate pr-2">
                <span className="font-bold text-[11px] text-slate-900 block truncate">
                  {pdfAttachmentState?.fileName || `${profile.firstName}_${profile.lastName}_Resume_Tailored.pdf`}
                </span>
                <span className="text-[10px] text-slate-500 block">
                  Exported live from Google Docs via Drive API
                </span>
              </div>
              {tailoredDocUrl && (
                <a
                  href={tailoredDocUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1 rounded bg-white hover:bg-slate-100 text-brand-600 border border-slate-200 text-[10px] font-semibold flex items-center gap-1 shrink-0"
                >
                  <span>Doc</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>

            {pdfAttachmentState?.verified ? (
              <div className="flex items-center gap-1 text-[10px] text-emerald-700 font-semibold bg-emerald-50/70 p-1.5 rounded border border-emerald-200/80">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Verified in ATS file upload widget</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-[10px] text-amber-800 bg-amber-50 p-1.5 rounded border border-amber-200">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>PDF prepared; will attach to file upload widget upon injection.</span>
              </div>
            )}
          </div>

          {/* Section 3: AI-Generated Custom Question Answers */}
          {customQuestions.length > 0 && (
            <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2.5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  <span className="text-[11px] font-bold text-slate-800">
                    ✍️ AI Question Answers ({customQuestions.length})
                  </span>
                </div>
                <span className="text-[9px] font-mono text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-200">
                  Grounded Factual Only
                </span>
              </div>

              <p className="text-[10px] text-slate-500 leading-tight">
                Review and edit AI-generated responses grounded in your verified resume achievements:
              </p>

              <div className="space-y-2">
                {customQuestions.map((q, idx) => {
                  const key = q.fieldKey || q.selector || `custom_${idx}`;
                  const currentAnswer = customAnswers[key] || q.aiAnswer || '';
                  return (
                    <div key={key} className="space-y-1 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                      <div className="flex items-start justify-between gap-2">
                        <label className="text-[10px] font-bold text-slate-800 leading-tight">
                          {q.fieldLabel}
                        </label>
                        <Edit3 className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
                      </div>
                      <textarea
                        rows={3}
                        value={currentAnswer}
                        onChange={(e) => onUpdateCustomAnswer(key, e.target.value)}
                        placeholder="Type or tweak your verified answer..."
                        className="w-full p-2 bg-white border border-slate-200 rounded text-[11px] text-slate-900 focus:outline-none focus:border-brand-500 leading-relaxed resize-none"
                      />
                      <div className="flex items-center justify-between text-[9px] text-slate-400 pt-0.5">
                        <span className="flex items-center gap-1 text-emerald-600">
                          <ShieldCheck className="w-3 h-3" /> Factual guardrails enforced
                        </span>
                        <span>{currentAnswer.length} chars</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section 4: Voluntary EEO & Demographic Notice */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[10px] text-slate-600 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Voluntary Demographic Questions ({eeoFields.length} detected)</span>
              </span>
              <span className="px-1.5 py-0.2 rounded bg-slate-200/80 text-slate-700 font-mono text-[9px] font-bold">
                100% Skipped / Declined
              </span>
            </div>
            <p className="leading-tight text-slate-500">
              Per OFCCP and privacy guidelines, race, gender, veteran status, and disability fields are voluntary and will never be filled with assumed data. Required EEO dropdowns are automatically set to <em>"Decline to self-identify"</em>.
            </p>
          </div>

          {/* Section 5: Manual Review Flags (if any) */}
          {manualReviewFields.length > 0 && (
            <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[10px] text-amber-900 space-y-1">
              <div className="font-bold flex items-center gap-1 text-amber-800">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                <span>{manualReviewFields.length} Fields Flagged for Verification</span>
              </div>
              <p className="text-amber-800/90 leading-tight">
                Uncertain fields were left untouched to prevent inaccurate inputs. Please check the job tab after injection.
              </p>
            </div>
          )}

          {/* Error Banner if submit failed */}
          {submitError && (
            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-[10px] text-rose-800 space-y-0.5 animate-shake">
              <span className="font-bold block">Submission Alert:</span>
              <p className="leading-tight">{submitError}</p>
            </div>
          )}

          {/* Success Banner */}
          {submitSuccess && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-800 flex items-center gap-2 animate-pop">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <div className="space-y-0.5">
                <span className="font-bold block">Application Submitted &amp; Verified!</span>
                <span className="text-[10px] text-emerald-700 block">Job moved to "Applied" in CRM Tracker.</span>
              </div>
            </div>
          )}
        </div>

        {/* Action Footer */}
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 font-semibold text-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>

          {isWorkday ? (
            <button
              type="button"
              onClick={onTriggerAssistOnly}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Autofilling Active Tab…</span>
                </>
              ) : (
                <>
                  <span>⚡ Autofill Page (Assisted Mode)</span>
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={onConfirmSubmit}
              disabled={isSubmitting || submitSuccess}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-slate-900 to-indigo-900 hover:from-slate-800 hover:to-indigo-800 text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Submitting &amp; Verifying…</span>
                </>
              ) : submitSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Submitted!</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5 text-brand-300" />
                  <span>🚀 Inject &amp; Submit Application</span>
                </>
              )}
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
