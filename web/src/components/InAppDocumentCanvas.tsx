import React, { useState, useMemo } from 'react';
import { 
  Download, 
  Printer, 
  Copy, 
  Check, 
  Sparkles, 
  Minimize2, 
  Maximize2, 
  FileText, 
  UploadCloud, 
  Edit3, 
  Eye, 
  AlertTriangle,
  RotateCcw,
  Plus,
  ExternalLink,
  Cloud
} from 'lucide-react';
import { ParsedResume } from '../services/resume-parser.js';
import { TailoredBulletDiff, ApplicantProfile } from '../types/index.js';

export interface InAppDocumentCanvasProps {
  parsedResume: ParsedResume | null;
  rawText: string;
  diffs?: TailoredBulletDiff[];
  onUpdateResumeText: (text: string) => void;
  onApplyBulletDiff?: (diffIndex: number) => void;
  onApplyAllDiffs?: () => void;
  onReopenGateway?: () => void;
  applicantProfile?: ApplicantProfile;
  isGoogleDocMode?: boolean;
  docUrl?: string;
  onSyncGoogleDoc?: () => void;
  onPushToGoogleDoc?: () => void;
}

export const InAppDocumentCanvas: React.FC<InAppDocumentCanvasProps> = ({
  parsedResume,
  rawText,
  diffs = [],
  onUpdateResumeText,
  onApplyBulletDiff,
  onApplyAllDiffs,
  onReopenGateway,
  applicantProfile,
  isGoogleDocMode = false,
  docUrl,
  onSyncGoogleDoc,
  onPushToGoogleDoc,
}) => {
  const [isRawEditing, setIsRawEditing] = useState(false);
  const [editText, setEditText] = useState(rawText);
  const [isCompact, setIsCompact] = useState(false);
  const [copied, setCopied] = useState(false);

  // Dynamic candidate name & contact details derived from user's onboarded profile
  const profileName = applicantProfile?.fullName?.trim() || 
    `${applicantProfile?.firstName || ''} ${applicantProfile?.lastName || ''}`.trim();
  const displayName = (parsedResume?.candidateName && parsedResume.candidateName !== 'Your Resume' && parsedResume.candidateName !== 'Alex Chen')
    ? parsedResume.candidateName
    : (profileName || 'Master Tech Resume');

  const profileContactInfo = [
    applicantProfile?.email,
    applicantProfile?.phone,
    applicantProfile?.location,
    applicantProfile?.linkedinUrl ? applicantProfile.linkedinUrl.replace(/^https?:\/\//, '') : undefined,
    applicantProfile?.githubUrl ? applicantProfile.githubUrl.replace(/^https?:\/\//, '') : undefined,
  ].filter(Boolean) as string[];

  const contactList = parsedResume?.contactInfo && parsedResume.contactInfo.length > 0
    ? parsedResume.contactInfo
    : (profileContactInfo.length > 0 ? profileContactInfo : ['candidate@example.com', 'San Francisco, CA']);

  // Sync edit text when raw text changes
  React.useEffect(() => {
    setEditText(rawText);
  }, [rawText]);

  // Page Budget Estimation (1-Page Letter is ~48-52 lines / ~3,500 characters)
  const lineCount = useMemo(() => {
    return rawText.split('\n').filter(l => l.trim().length > 0).length;
  }, [rawText]);

  const maxRecommendedLines = isCompact ? 54 : 46;
  const pageBudgetPercentage = Math.round((lineCount / maxRecommendedLines) * 100);

  const handleSaveRaw = () => {
    onUpdateResumeText(editText);
    setIsRawEditing(false);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleCopyPlainText = async () => {
    try {
      await navigator.clipboard.writeText(rawText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const pendingDiffs = diffs.filter(d => d.status === 'pending');

  return (
    <div className="space-y-4">
      {/* Top Document Controls Bar */}
      <div className="bg-white dark:bg-[#121215] border border-zinc-200 dark:border-[#27272A] rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-900 dark:text-zinc-100">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs text-zinc-900 dark:text-zinc-100">
                {parsedResume?.candidateName || (isGoogleDocMode ? 'Google Doc Master' : 'Master Tech Resume')}
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 font-semibold flex items-center gap-1">
                {isGoogleDocMode && <Cloud className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />}
                <span>{isGoogleDocMode ? 'Google Doc (Cloud Synced)' : 'In-App Canvas'}</span>
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              {parsedResume?.bullets?.length || lineCount} bullet items • {rawText.length.toLocaleString()} characters
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {docUrl && (
            <a
              href={docUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 py-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
              title="Open Google Doc in new tab"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open in Docs ↗</span>
            </a>
          )}

          {onSyncGoogleDoc && (
            <button
              type="button"
              onClick={onSyncGoogleDoc}
              className="px-2.5 py-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Re-sync content with Google Docs"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Re-sync</span>
            </button>
          )}

          {onPushToGoogleDoc && (
            <button
              type="button"
              onClick={onPushToGoogleDoc}
              className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              title="Push accepted diffs to Google Doc"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Push Fixes</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsCompact(!isCompact)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
              isCompact 
                ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-950' 
                : 'bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300'
            }`}
            title="Toggle compact line spacing to fit on 1 page"
          >
            {isCompact ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            <span>{isCompact ? 'Compact Mode' : 'Standard'}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsRawEditing(!isRawEditing)}
            className="px-2.5 py-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            {isRawEditing ? <Eye className="w-3.5 h-3.5" /> : <Edit3 className="w-3.5 h-3.5" />}
            <span>{isRawEditing ? 'Preview Canvas' : 'Edit Text'}</span>
          </button>

          <button
            type="button"
            onClick={handleCopyPlainText}
            className="px-2.5 py-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy Plaintext'}</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-950 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Export ATS PDF</span>
          </button>

          {onReopenGateway && (
            <button
              type="button"
              onClick={onReopenGateway}
              className="px-2.5 py-1.5 border border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 rounded-lg text-xs font-medium transition-colors cursor-pointer"
              title="Switch to Google Docs Sync or upload a new file"
            >
              Switch Mode
            </button>
          )}
        </div>
      </div>

      {/* Real-time 1-Page Budget & Overflow Guard */}
      <div className="bg-white dark:bg-[#121215] border border-zinc-200 dark:border-[#27272A] rounded-xl p-3.5 flex items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="flex-1 max-w-xs">
            <div className="flex items-center justify-between text-[11px] mb-1 font-mono">
              <span className="text-zinc-500 dark:text-zinc-400">1-Page Target Budget:</span>
              <span className={`font-bold ${
                pageBudgetPercentage <= 100 
                  ? 'text-emerald-600 dark:text-emerald-400' 
                  : 'text-amber-600 dark:text-amber-400'
              }`}>
                {pageBudgetPercentage}% ({lineCount}/{maxRecommendedLines} lines)
              </span>
            </div>
            <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-300 ${
                  pageBudgetPercentage <= 100 
                    ? 'bg-emerald-500' 
                    : 'bg-amber-500'
                }`}
                style={{ width: `${Math.min(100, pageBudgetPercentage)}%` }}
              />
            </div>
          </div>

          <div className="text-[11px] text-zinc-500 dark:text-zinc-400 hidden sm:block">
            {pageBudgetPercentage <= 100 ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                <Check className="w-3.5 h-3.5" />
                <span>Single-page fit guaranteed</span>
              </span>
            ) : (
              <span className="text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Exceeds 1 page. Enable Compact Mode or trim 2 bullets</span>
              </span>
            )}
          </div>
        </div>

        {pendingDiffs.length > 0 && onApplyAllDiffs && (
          <button
            type="button"
            onClick={onApplyAllDiffs}
            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Apply All {pendingDiffs.length} STAR Suggestions</span>
          </button>
        )}
      </div>

      {/* Editor or Visual Canvas */}
      {isRawEditing ? (
        <div className="bg-white dark:bg-[#121215] border border-zinc-200 dark:border-[#27272A] rounded-xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
            <span>Edit plain text resume directly:</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsRawEditing(false)}
                className="px-3 py-1 rounded-md text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveRaw}
                className="px-3.5 py-1 bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 font-bold rounded-md transition-colors shadow-xs"
              >
                Save & Update Canvas
              </button>
            </div>
          </div>
          <textarea
            rows={22}
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            className="w-full font-mono text-xs p-4 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-400 leading-relaxed"
          />
        </div>
      ) : (
        /* Paginated Visual Document Sheet (US Letter / A4 aspect) */
        <div className="resume-canvas-print bg-white dark:bg-[#151518] text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 sm:p-12 shadow-sm font-sans space-y-6 transition-all">
          {/* Document Header */}
          <div className="text-center pb-4 border-b border-zinc-200 dark:border-zinc-800/80 space-y-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-950 dark:text-white font-headline">
              {displayName}
            </h1>
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-zinc-600 dark:text-zinc-400">
              {contactList.map((info, idx) => (
                <span key={idx} className="flex items-center gap-2">
                  {idx > 0 && <span className="text-zinc-300 dark:text-zinc-600">•</span>}
                  <span>{info}</span>
                </span>
              ))}
            </div>
          </div>

          {/* Render Sections */}
          <div className={`space-y-5 ${isCompact ? 'text-[12px] leading-snug space-y-3.5' : 'text-xs leading-relaxed'}`}>
            {rawText.split('\n\n').map((paragraph, pIdx) => {
              const lines = paragraph.split('\n');
              const firstLine = lines[0]?.trim();
              const isSectionHeader = /^(summary|experience|projects|education|technical skills|skills|leadership|awards)/i.test(firstLine);

              if (isSectionHeader) {
                return (
                  <div key={pIdx} className="space-y-2">
                    <h2 className="text-xs font-mono font-bold tracking-wider uppercase text-zinc-900 dark:text-zinc-200 border-b border-zinc-200 dark:border-zinc-800 pb-1">
                      {firstLine}
                    </h2>
                    <div className="space-y-1.5 pl-1">
                      {lines.slice(1).map((line, lIdx) => {
                        const isBullet = line.trim().startsWith('•') || line.trim().startsWith('-');
                        const cleanLine = line.replace(/^[•\-*]\s*/, '').trim();

                        // Check if there is a pending diff matching this bullet
                        const matchedDiffIdx = diffs.findIndex(
                          (d) => d.originalText.trim().toLowerCase() === cleanLine.toLowerCase()
                        );
                        const matchedDiff = matchedDiffIdx !== -1 ? diffs[matchedDiffIdx] : null;

                        if (matchedDiff && matchedDiff.status === 'pending') {
                          return (
                            <div key={lIdx} className="my-2 p-2.5 rounded-lg bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/30 space-y-1.5">
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                                  <Sparkles className="w-3 h-3" />
                                  <span>STAR Suggestion Available</span>
                                </span>
                                {onApplyBulletDiff && (
                                  <button
                                    type="button"
                                    onClick={() => onApplyBulletDiff(matchedDiffIdx)}
                                    className="px-2.5 py-0.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] cursor-pointer"
                                  >
                                    Accept Suggestion
                                  </button>
                                )}
                              </div>
                              <div className="line-through text-zinc-400 text-[11px]">
                                {matchedDiff.originalText}
                              </div>
                              <div className="font-medium text-zinc-900 dark:text-zinc-100">
                                • {matchedDiff.tailoredText}
                              </div>
                              {matchedDiff.rationale && (
                                <div className="text-[10px] text-zinc-500 dark:text-zinc-400 italic">
                                  Why: {matchedDiff.rationale}
                                </div>
                              )}
                            </div>
                          );
                        }

                        return (
                          <div key={lIdx} className={isBullet ? 'flex items-start gap-2' : ''}>
                            {isBullet && <span className="text-zinc-400 select-none">•</span>}
                            <span className={isBullet ? 'flex-1' : 'font-semibold text-zinc-900 dark:text-zinc-100'}>
                              {isBullet ? cleanLine : line}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              }

              return (
                <div key={pIdx} className="space-y-1">
                  {lines.map((line, lIdx) => (
                    <div key={lIdx}>{line}</div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
