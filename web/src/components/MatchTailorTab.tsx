import React, { useState } from 'react';
import { AtsGauge } from './AtsGauge.js';
import { ResumeWorkspaceGateway } from './ResumeWorkspaceGateway.js';
import { InAppDocumentCanvas } from './InAppDocumentCanvas.js';
import { WorkspaceMode } from '../services/storage.js';
import { ScrapedJobData, TailorResumeResponse, TailoredBulletDiff, LayoutIssue, ApplicantProfile } from '../types/index.js';
import { ParsedResume } from '../services/resume-parser.js';
import { 
  Sparkles, 
  Check, 
  X, 
  Download, 
  Layers, 
  ExternalLink, 
  Zap, 
  CheckCircle2, 
  Scan, 
  Monitor, 
  Edit3, 
  FileText, 
  ShieldCheck, 
  Target, 
  RefreshCw, 
  ArrowRight, 
  Layout, 
  AlertCircle, 
  AlertTriangle, 
  ChevronRight,
  Cloud,
  UploadCloud,
  Printer,
  RotateCcw
} from 'lucide-react';

interface MatchTailorTabProps {
  currentJob: ScrapedJobData;
  tailorData: TailorResumeResponse | null;
  isLoading: boolean;
  onTriggerTailor: () => void;
  onTriggerGeneralAtsOptimize: (domain: string) => void;
  onApplyToGoogleDoc?: (diffs: TailoredBulletDiff[]) => Promise<boolean>;
  onApplyLayoutFix?: (issue: LayoutIssue) => Promise<boolean>;
  onForkToDrive: () => Promise<void>;
  onTriggerAutofill: () => void;
  onReadScreenNow: () => void;
  onScrapeJobFromCurrentTab: () => void;
  screenResume: { title: string; fullText: string; isGoogleDoc?: boolean; url?: string; docId?: string } | null;
  parsedResume: ParsedResume | null;
  onUpdateCustomResumeText: (text: string) => void;
  onShowDiffsOnGoogleDoc?: () => void;
  onNavigateToSettings?: () => void;
  appliedStatus: string | null;
  forkedDocUrl: string | null;
  pdfUrl: string | null;
  workspaceMode?: WorkspaceMode | null;
  onSetWorkspaceMode?: (mode: WorkspaceMode) => void;
  onOpenGooglePicker?: () => void;
  onSelectGoogleDoc?: (docId: string, docTitle?: string, docUrl?: string) => void;
  applicantProfile?: ApplicantProfile;
  showWorkspaceGateway?: boolean;
  onCloseGateway?: () => void;
  onUploadResumeFile?: (file: File) => Promise<void>;
}

export const MatchTailorTab: React.FC<MatchTailorTabProps> = ({
  currentJob,
  tailorData,
  isLoading,
  onTriggerTailor,
  onTriggerGeneralAtsOptimize,
  onApplyToGoogleDoc,
  onApplyLayoutFix,
  onForkToDrive,
  onTriggerAutofill,
  onReadScreenNow,
  onScrapeJobFromCurrentTab,
  screenResume,
  parsedResume,
  onUpdateCustomResumeText,
  onShowDiffsOnGoogleDoc,
  onNavigateToSettings,
  appliedStatus,
  forkedDocUrl,
  pdfUrl,
  workspaceMode = 'in_app_canvas',
  onSetWorkspaceMode,
  onOpenGooglePicker,
  onSelectGoogleDoc,
  applicantProfile,
  showWorkspaceGateway,
  onCloseGateway,
  onUploadResumeFile
}) => {
  const [mode, setMode] = useState<'job' | 'general'>('job');
  const [selectedDomain, setSelectedDomain] = useState<string>('Software Engineering');
  const [diffs, setDiffs] = useState<TailoredBulletDiff[]>(tailorData?.bulletDiffs || []);
  const [activeFilter, setActiveFilter] = useState<'all' | 'missing' | 'matched'>('all');
  const [isForking, setIsForking] = useState(false);
  const [isEditingResume, setIsEditingResume] = useState(false);
  const [customText, setCustomText] = useState(screenResume?.fullText || '');
  const [showVisualSnapshots, setShowVisualSnapshots] = useState(false);
  const [showGateway, setShowGateway] = useState<boolean>(
    showWorkspaceGateway !== undefined ? showWorkspaceGateway : (!screenResume && !workspaceMode)
  );

  React.useEffect(() => {
    if (showWorkspaceGateway !== undefined) {
      setShowGateway(showWorkspaceGateway);
    }
  }, [showWorkspaceGateway]);

  const domains = ['Software Engineering', 'Data & AI', 'Product Management', 'Finance & Quant', 'General'];
  const candidateResumeTitle = (applicantProfile?.firstName || applicantProfile?.lastName)
    ? `${applicantProfile.firstName} ${applicantProfile.lastName || ''}`.trim() + ' — Master Resume (Google Doc)'
    : (applicantProfile?.fullName ? `${applicantProfile.fullName} — Master Resume (Google Doc)` : 'Master Resume (Google Doc)');

  React.useEffect(() => {
    if (tailorData?.bulletDiffs) {
      setDiffs(tailorData.bulletDiffs);
    }
  }, [tailorData]);

  React.useEffect(() => {
    if (screenResume?.fullText) {
      setCustomText(screenResume.fullText);
    }
  }, [screenResume]);

  const handleFork = async () => {
    setIsForking(true);
    try {
      await onForkToDrive();
    } finally {
      setIsForking(false);
    }
  };

  const handleSaveCustomText = () => {
    onUpdateCustomResumeText(customText);
    setIsEditingResume(false);
  };

  const handleToggleBulletAccept = (index: number) => {
    setDiffs(prev => {
      const copy = [...prev];
      if (copy[index]) {
        copy[index] = {
          ...copy[index],
          status: copy[index].status === 'accepted' ? 'rejected' : 'accepted'
        };
      }
      return copy;
    });
  };

  const handleApplyBulletDiffInCanvas = (index: number) => {
    const diff = diffs[index];
    if (!diff) return;

    let current = screenResume?.fullText || customText;
    if (diff.originalText && current.includes(diff.originalText)) {
      current = current.replace(diff.originalText, diff.tailoredText);
      setCustomText(current);
      onUpdateCustomResumeText(current);
    }
    setDiffs(prev => prev.map((d, i) => i === index ? { ...d, status: 'accepted' } : d));
  };

  const handleApplyAllDiffsInCanvas = () => {
    let current = screenResume?.fullText || customText;
    diffs.forEach(diff => {
      if (diff.status === 'pending' && diff.originalText && current.includes(diff.originalText)) {
        current = current.replace(diff.originalText, diff.tailoredText);
      }
    });
    setCustomText(current);
    onUpdateCustomResumeText(current);
    setDiffs(prev => prev.map(d => ({ ...d, status: 'accepted' })));
  };

  const appliedCount = diffs.filter((d: TailoredBulletDiff) => d.status === 'accepted').length;
  const totalDiffsCount = diffs.length;
  const progressPercentage = totalDiffsCount > 0 ? Math.round((appliedCount / totalDiffsCount) * 100) : 0;

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* 1. Desktop Command & Context Header */}
      <div className="bg-white dark:bg-[#121215] border border-zinc-200 dark:border-[#27272A] rounded-xl p-4 sm:p-5 shadow-xs transition-colors">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Left: Mode Segmented Control & Active Target */}
          <div className="space-y-2.5">
            <div className="inline-flex p-1 bg-zinc-100 dark:bg-zinc-800/80 rounded-lg text-xs font-semibold border border-zinc-200/60 dark:border-zinc-700/60">
              <button
                type="button"
                onClick={() => setMode('job')}
                className={`py-1.5 px-3 rounded-md flex items-center gap-1.5 transition-all cursor-pointer ${
                  mode === 'job'
                    ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                <Target className="w-3.5 h-3.5" />
                <span>Job Match ATS Audit</span>
              </button>
              <button
                type="button"
                onClick={() => setMode('general')}
                className={`py-1.5 px-3 rounded-md flex items-center gap-1.5 transition-all cursor-pointer ${
                  mode === 'general'
                    ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Universal Master ATS</span>
              </button>
            </div>

            {mode === 'job' ? (
              currentJob.title ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700">
                    {currentJob.source || 'Active Role'}
                  </span>
                  <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                    {currentJob.title}
                  </span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    at <strong className="text-zinc-700 dark:text-zinc-300 font-semibold">{currentJob.company}</strong>
                    {currentJob.location ? ` • ${currentJob.location}` : ''}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                  <Target className="w-3.5 h-3.5 text-zinc-400" />
                  <span>No target role selected yet.</span>
                  <button
                    type="button"
                    onClick={onScrapeJobFromCurrentTab}
                    className="font-bold text-zinc-800 dark:text-zinc-200 hover:underline cursor-pointer"
                  >
                    Paste a Job Posting
                  </button>
                  <span>or pick from Discovery.</span>
                </div>
              )
            ) : (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
                <span className="text-[10px] font-mono uppercase font-bold text-zinc-400 mr-1 shrink-0">Benchmark:</span>
                {domains.map(d => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setSelectedDomain(d)}
                    className={`shrink-0 px-2.5 py-0.5 text-[11px] rounded-full font-medium transition-all cursor-pointer ${
                      selectedDomain === d
                        ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-xs font-semibold'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right: Actions Bar */}
          <div className="flex items-center gap-2 shrink-0">
            {mode === 'job' && (
              <>
                <button
                  type="button"
                  onClick={onScrapeJobFromCurrentTab}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 transition-colors cursor-pointer"
                  title="Scrape job from current active tab"
                >
                  Scan Job Tab
                </button>
                <button
                  type="button"
                  onClick={onTriggerAutofill}
                  className="px-3 py-1.5 text-xs font-bold rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-900 dark:text-amber-200 border border-amber-300/40 dark:border-amber-700/40 flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Prepare, inspect, and review auto-apply application"
                >
                  <Zap className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span>Auto-Apply</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={mode === 'job' ? onTriggerTailor : () => onTriggerGeneralAtsOptimize(selectedDomain)}
              disabled={isLoading}
              className="px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-950 font-bold text-xs shadow-xs transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Sparkles className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{isLoading ? 'Analyzing…' : mode === 'job' ? 'Tailor for Job' : 'Audit Master Resume'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Loading State */}
      {isLoading && (
        <div className="p-12 flex flex-col items-center justify-center space-y-4 text-center bg-white dark:bg-[#121215] rounded-xl border border-zinc-200 dark:border-[#27272A] shadow-xs">
          <div className="w-10 h-10 border-2 border-zinc-300 dark:border-zinc-700 border-t-zinc-900 dark:border-t-white rounded-full animate-spin"></div>
          <div>
            <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
              {mode === 'general' ? 'Running Universal ATS Master Audit...' : 'Analyzing Job Alignment & Generating STAR Bullets...'}
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-md mx-auto">
              Calculating exact keyword match, verb vitality, quantifiable metrics, and layout parseability.
            </p>
          </div>
        </div>
      )}

      {/* 2. Workspace Setup Choice Gateway (Option 1 vs Option 2) */}
      {showGateway && (
        <div className="mb-6">
          <ResumeWorkspaceGateway
            currentMode={workspaceMode}
            applicantProfile={applicantProfile}
            onSelectOption1GoogleDocs={(docId, docTitle) => {
              onSetWorkspaceMode?.('google_docs');
              setShowGateway(false);
              if (onSelectGoogleDoc && docId) {
                onSelectGoogleDoc(docId, docTitle);
              }
            }}
            onSelectOption2InAppCanvas={(text, title) => {
              onSetWorkspaceMode?.('in_app_canvas');
              onUpdateCustomResumeText(text);
              setShowGateway(false);
            }}
            onOpenGooglePicker={onOpenGooglePicker}
            onDismiss={screenResume ? () => {
              setShowGateway(false);
              onCloseGateway?.();
            } : undefined}
          />
        </div>
      )}

      {/* 3. Main Dual-Pane Workspace (Desktop Grid: 7 cols Canvas + 5 cols Inspector) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT PANE: Resume Document Canvas & STAR Bullet Editor (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Workspace Architecture Switcher Bar */}
          <div className="flex flex-wrap items-center justify-between bg-white dark:bg-[#121215] border border-zinc-200 dark:border-[#27272A] rounded-xl p-2 shadow-xs gap-2">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onSetWorkspaceMode?.('google_docs')}
                className={`py-1.5 px-3 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                  workspaceMode === 'google_docs'
                    ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                <Cloud className="w-3.5 h-3.5" />
                <span>Option 1: Google Docs Sync</span>
              </button>

              <button
                type="button"
                onClick={() => onSetWorkspaceMode?.('in_app_canvas')}
                className={`py-1.5 px-3 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                  workspaceMode === 'in_app_canvas'
                    ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Option 2: In-App Canvas</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowGateway(true)}
              className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 font-medium px-2 py-1 underline underline-offset-4 cursor-pointer"
            >
              Switch Setup
            </button>
          </div>

          {/* Conditional Rendering: In-App Canvas (Option 2) vs Google Docs Cloud Sync (Option 1) */}
          {workspaceMode === 'in_app_canvas' ? (
            <InAppDocumentCanvas
              parsedResume={parsedResume}
              rawText={screenResume?.fullText || customText}
              diffs={diffs}
              onUpdateResumeText={(newText) => {
                setCustomText(newText);
                onUpdateCustomResumeText(newText);
              }}
              onApplyBulletDiff={handleApplyBulletDiffInCanvas}
              onApplyAllDiffs={handleApplyAllDiffsInCanvas}
              onReopenGateway={() => setShowGateway(true)}
              applicantProfile={applicantProfile}
              onUploadFile={onUploadResumeFile}
            />
          ) : (
            <>
              {/* Option 1: Google Docs Status Card */}
              <div className="bg-white dark:bg-[#121215] border border-zinc-200 dark:border-[#27272A] rounded-xl p-5 shadow-xs space-y-4 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                      screenResume?.isGoogleDoc 
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' 
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'
                    }`}>
                      <Cloud className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 truncate">
                          {screenResume?.title || 'Google Docs Master Resume'}
                        </h3>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                          {screenResume?.isGoogleDoc ? 'Cloud Sync Active' : 'Connected'}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                        {screenResume?.fullText 
                          ? `${parsedResume?.bullets?.length || diffs.length || 0} bullets synchronized with Google Drive`
                          : 'Authorize Google Docs to sync tailored bullets directly back to your document'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                    {screenResume?.docId && screenResume.docId !== 'mock-master-resume-doc-id' && (
                      <a
                        href={`https://docs.google.com/document/d/${screenResume.docId}/edit`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-xs font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5 transition-colors"
                        title="Open this resume in Google Docs in a new tab"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-zinc-500" />
                        <span>Open Doc ↗</span>
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={onReadScreenNow}
                      className="px-2.5 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-xs font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Fetch latest document text from Google Docs"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-zinc-500" />
                      <span>Re-sync</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (onOpenGooglePicker) {
                          onOpenGooglePicker();
                        } else if (onSelectGoogleDoc) {
                          onSelectGoogleDoc('mock-master-resume-doc-id', candidateResumeTitle);
                        }
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-xs font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Select a different Google Doc via Google Picker"
                    >
                      <Cloud className="w-3.5 h-3.5 text-zinc-500" />
                      <span>Select via Picker</span>
                    </button>
                  </div>
                </div>

                <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    {appliedCount > 0 && onApplyToGoogleDoc && (
                      <button
                        type="button"
                        onClick={() => onApplyToGoogleDoc(diffs.filter(d => d.status === 'accepted'))}
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Push {appliedCount} Fixes to Google Doc</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleFork}
                      disabled={isForking}
                      className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Create a tailored copy in Google Drive"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>{isForking ? 'Forking…' : 'Fork to Google Drive'}</span>
                    </button>
                  </div>

                  {pdfUrl && (
                    <a
                      href={pdfUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 border border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500 text-zinc-700 dark:text-zinc-300 rounded-lg font-semibold flex items-center gap-1.5 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Export PDF</span>
                    </a>
                  )}
                </div>
              </div>

              {/* Live In-App Document Canvas Preview for Option 1: Google Docs Sync */}
              {screenResume && (
                <InAppDocumentCanvas
                  parsedResume={parsedResume}
                  rawText={screenResume.fullText || customText}
                  diffs={diffs}
                  onUpdateResumeText={(newText) => {
                    setCustomText(newText);
                    onUpdateCustomResumeText(newText);
                  }}
                  onApplyBulletDiff={handleApplyBulletDiffInCanvas}
                  onApplyAllDiffs={handleApplyAllDiffsInCanvas}
                  onReopenGateway={() => setShowGateway(true)}
                  applicantProfile={applicantProfile}
                  isGoogleDocMode={true}
                  docUrl={screenResume.url || (screenResume.docId && screenResume.docId !== 'mock-master-resume-doc-id' ? `https://docs.google.com/document/d/${screenResume.docId}/edit` : undefined)}
                  onSyncGoogleDoc={onReadScreenNow}
                  onPushToGoogleDoc={appliedCount > 0 && onApplyToGoogleDoc ? () => onApplyToGoogleDoc(diffs.filter(d => d.status === 'accepted')) : undefined}
                  onUploadFile={onUploadResumeFile}
                />
              )}

              {/* Empty Google Doc Prompt if nothing loaded */}
              {!screenResume && (
                <div className="bg-white dark:bg-[#121215] border border-dashed border-zinc-300 dark:border-zinc-800 rounded-xl p-8 text-center space-y-4">
                  <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto text-zinc-600 dark:text-zinc-300">
                    <Cloud className="w-6 h-6" />
                  </div>
                  <div className="max-w-md mx-auto space-y-1">
                    <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                      Connect Your Google Doc Resume
                    </h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                      Select your existing resume from Google Drive to enable direct, two-way atomic syncing.
                    </p>
                  </div>
                  <div className="flex items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        if (onOpenGooglePicker) onOpenGooglePicker();
                        else if (onSelectGoogleDoc) onSelectGoogleDoc('mock-master-resume-doc-id', candidateResumeTitle);
                      }}
                      className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-950 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-xs"
                    >
                      <Cloud className="w-4 h-4" />
                      <span>Select from Google Drive</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onSetWorkspaceMode?.('in_app_canvas')}
                      className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Switch to In-App Canvas
                    </button>
                  </div>
                </div>
              )}

              {/* STAR Bullets & Interactive Diff Inspector for Google Docs Mode */}
              {diffs.length > 0 && (
                <div className="bg-white dark:bg-[#121215] border border-zinc-200 dark:border-[#27272A] rounded-xl p-5 sm:p-6 shadow-xs space-y-5 transition-colors">
              <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
                <div>
                  <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    <span>AI-Tailored STAR Bullets</span>
                    <span className="px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-mono font-semibold">
                      {appliedCount} / {totalDiffsCount} Applied
                    </span>
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    Review and toggle AI-enhanced bullet points with quantified results and verified anti-hallucination.
                  </p>
                </div>

                {onShowDiffsOnGoogleDoc && (
                  <button
                    type="button"
                    onClick={onShowDiffsOnGoogleDoc}
                    className="px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-800 dark:text-emerald-200 border border-emerald-500/20 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span>View in Docs</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Progress bar */}
              <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${Math.max(5, progressPercentage)}%` }}
                />
              </div>

              {/* Bullets List */}
              <div className="space-y-4">
                {diffs.map((diff, idx) => {
                  const isAccepted = diff.status === 'accepted';
                  return (
                    <div
                      key={diff.id || idx}
                      className={`p-4 rounded-xl border transition-all ${
                        isAccepted
                          ? 'bg-emerald-500/5 dark:bg-emerald-500/10 border-emerald-500/30 ring-1 ring-emerald-500/20'
                          : 'bg-zinc-50/70 dark:bg-zinc-900/40 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                            Bullet #{idx + 1}
                          </span>
                          {diff.injectedKeywords && diff.injectedKeywords.length > 0 && (
                            <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                              +{diff.injectedKeywords.join(', ')}
                            </span>
                          )}
                          {typeof diff.scoreGain === 'number' && (
                            <span className="text-[10px] font-mono text-zinc-400">
                              +{diff.scoreGain} pts
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleToggleBulletAccept(idx)}
                          className={`px-3 py-1 rounded-md text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                            isAccepted
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                              : 'bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200'
                          }`}
                        >
                          {isAccepted ? <Check className="w-3.5 h-3.5" /> : null}
                          <span>{isAccepted ? 'Accepted' : 'Accept Fix'}</span>
                        </button>
                      </div>

                      {/* Original bullet */}
                      <div className="mb-2 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed font-sans line-through decoration-zinc-400 dark:decoration-zinc-600">
                        {diff.originalText}
                      </div>

                      {/* Tailored bullet */}
                      <div className="text-xs font-medium text-zinc-900 dark:text-zinc-100 leading-relaxed font-sans bg-white dark:bg-[#18181B] p-3 rounded-lg border border-zinc-200/80 dark:border-zinc-700/60 shadow-2xs">
                        {diff.tailoredText}
                      </div>

                      {/* Rationale & impact notes */}
                      {diff.rationale && (
                        <div className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                          <span className="font-semibold text-zinc-700 dark:text-zinc-300">Why: </span>
                          <span>{diff.rationale}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
            </>
          )}

          {/* Dedicated ATS Layout & Structural Hygiene Suggestions */}
          {tailorData?.atsReport?.layoutReport && tailorData.atsReport.layoutReport.issues.length > 0 && (
            <div className="bg-white dark:bg-[#121215] border border-zinc-200 dark:border-[#27272A] rounded-xl p-5 sm:p-6 shadow-xs space-y-4 transition-colors">
              <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-700 dark:text-zinc-300">
                    <Layout className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                      ATS Layout &amp; Visual Hygiene
                    </h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Eliminate parsing roadblocks like multi-column splits, header drift, and margin overflows.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {tailorData.atsReport.layoutReport.visualPolishScore !== undefined && (
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 text-[10px] font-mono font-bold">
                      {tailorData.atsReport.layoutReport.visualPolishScore}% Polish
                    </span>
                  )}
                  <span className="px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 text-[10px] font-mono font-bold">
                    {tailorData.atsReport.layoutReport.issues.length} Flagged
                  </span>
                </div>
              </div>

              {/* Visual Snapshot & Page Fill Banner */}
              {tailorData.atsReport.layoutReport.visualReport && (
                <div className="p-3 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg border border-zinc-200 dark:border-zinc-800 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200 text-xs flex items-center gap-1.5">
                      <span>Rendered Page Fill:</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold ${
                        tailorData.atsReport.layoutReport.visualReport.pageFillAssessment === 'optimal_single_page'
                          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20'
                          : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20'
                      }`}>
                        {tailorData.atsReport.layoutReport.visualReport.pageFillAssessment.replace(/_/g, ' ')}
                      </span>
                    </span>
                    {tailorData.atsReport.layoutReport.visualReport.snapshots.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowVisualSnapshots(!showVisualSnapshots)}
                        className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white underline cursor-pointer"
                      >
                        {showVisualSnapshots ? 'Hide Snapshot' : 'View Snapshot'}
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                    {tailorData.atsReport.layoutReport.visualReport.pageFillDescription}
                  </p>

                  {/* Rendered Page Thumbnail Preview */}
                  {showVisualSnapshots && tailorData.atsReport.layoutReport.visualReport.snapshots.length > 0 && (
                    <div className="pt-2 flex gap-3 overflow-x-auto pb-1">
                      {tailorData.atsReport.layoutReport.visualReport.snapshots.map((snap) => (
                        <div key={snap.pageNumber} className="relative group shrink-0 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-sm overflow-hidden bg-white">
                          <img
                            src={snap.dataUrl}
                            alt={`Rendered Page ${snap.pageNumber}`}
                            className="w-40 h-auto object-contain"
                          />
                          <span className="absolute bottom-1 right-1 bg-zinc-900/80 text-[9px] text-white px-1.5 py-0.5 rounded font-mono">
                            Page {snap.pageNumber}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Layout Issues List */}
              <div className="space-y-3">
                {tailorData.atsReport.layoutReport.issues.map((issue) => {
                  const isAccepted = issue.status === 'accepted';
                  return (
                    <div
                      key={issue.id}
                      className="bg-zinc-50 dark:bg-zinc-900/40 p-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800 space-y-2 text-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                              issue.severity === 'critical'
                                ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20'
                                : issue.severity === 'warning'
                                ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20'
                                : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-600'
                            }`}
                          >
                            {issue.category.replace(/_/g, ' ')}
                          </span>
                          {issue.fixTier && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] uppercase font-mono font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                              {issue.fixTier === 'safe_styling' ? 'Safe Restyle' : 'Content Edit'}
                            </span>
                          )}
                          <span className="font-bold text-zinc-900 dark:text-zinc-100">{issue.title}</span>
                        </div>
                      </div>

                      <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
                        {issue.description}
                      </p>

                      {issue.proposedReplacementText && (
                        <div className="p-2.5 bg-zinc-100 dark:bg-zinc-800 rounded border border-zinc-200 dark:border-zinc-700 space-y-1">
                          <span className="text-amber-700 dark:text-amber-400 font-bold text-[10px] block">Proposed Text Preview:</span>
                          <p className="text-zinc-800 dark:text-zinc-200 italic font-mono text-[11px]">{issue.proposedReplacementText}</p>
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-1 text-[11px]">
                        <span className="text-zinc-500 dark:text-zinc-400 italic">
                          {issue.impact}
                        </span>

                        {issue.suggestedFix && onApplyLayoutFix && (
                          <button
                            type="button"
                            onClick={() => onApplyLayoutFix(issue)}
                            disabled={isAccepted}
                            className={`px-3 py-1 rounded-md font-bold text-xs transition-all cursor-pointer ${
                              isAccepted
                                ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                                : 'bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-950 shadow-xs'
                            }`}
                          >
                            {isAccepted ? (
                              <span>✓ Fixed</span>
                            ) : (
                              <span>{issue.suggestedFix.actionLabel || (issue.fixTier === 'content_generating' ? 'Apply Fix' : 'Restyle in Doc')}</span>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT PANE: Intelligence Inspector & Co-pilot (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* AtsGauge & Projected Delta Card */}
          {tailorData ? (
            <div className="bg-white dark:bg-[#121215] border border-zinc-200 dark:border-[#27272A] rounded-xl p-6 shadow-xs space-y-5 transition-colors">
              <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
                <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                  ATS Match Score &amp; Quality
                </h3>
                <span className="text-xs font-mono font-bold text-zinc-400">
                  Rubric v2.4
                </span>
              </div>

              <AtsGauge 
                score={tailorData.atsReport.overallScore} 
                projectedScore={tailorData.projectedNewScore} 
              />

              {/* 6-Dimensional ATS Scoring Grid */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="bg-zinc-50 dark:bg-zinc-900/50 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-mono font-bold text-zinc-500">Hard Skills</span>
                    <span className="font-mono font-bold text-xs text-zinc-900 dark:text-zinc-100">
                      {tailorData.atsReport.breakdown.hardSkillsScore}%
                    </span>
                  </div>
                  <p className="text-[10px] text-zinc-500 leading-tight">
                    {tailorData.atsReport.matchedKeywordsCount} of {tailorData.atsReport.totalKeywords} keywords matched.
                  </p>
                </div>

                <div className="bg-zinc-50 dark:bg-zinc-900/50 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-mono font-bold text-zinc-500">Production Exp</span>
                    <span className="font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400">
                      {tailorData.atsReport.breakdown.productionExperienceScore ?? tailorData.atsReport.productionExperienceAudit?.score ?? 85}%
                    </span>
                  </div>
                  <p className="text-[10px] text-zinc-500 leading-tight">
                    {tailorData.atsReport.productionExperienceAudit?.roleCount ?? 1} roles &bull; {tailorData.atsReport.productionExperienceAudit?.productionKeywordsFound?.length ?? 0} infra signals.
                  </p>
                </div>

                <div className="bg-zinc-50 dark:bg-zinc-900/50 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-mono font-bold text-zinc-500">Self Projects</span>
                    <span className="font-mono font-bold text-xs text-zinc-900 dark:text-zinc-100">
                      {tailorData.atsReport.breakdown.selfProjectsScore ?? tailorData.atsReport.selfProjectsAudit?.score ?? 80}%
                    </span>
                  </div>
                  <p className="text-[10px] text-zinc-500 leading-tight">
                    {tailorData.atsReport.selfProjectsAudit?.hasWorkingLinks ? 'Live link detected' : 'Code complexity audit'}.
                  </p>
                </div>

                <div className="bg-zinc-50 dark:bg-zinc-900/50 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-mono font-bold text-zinc-500">Action Verbs</span>
                    <span className="font-mono font-bold text-xs text-zinc-900 dark:text-zinc-100">
                      {tailorData.atsReport.actionVerbStrength
                        ? `${Math.round((tailorData.atsReport.actionVerbStrength.strongCount / (tailorData.atsReport.actionVerbStrength.strongCount + tailorData.atsReport.actionVerbStrength.weakCount || 1)) * 100)}%`
                        : `${tailorData.atsReport.breakdown.experienceRelevanceScore}%`}
                    </span>
                  </div>
                  <p className="text-[10px] text-zinc-500 leading-tight">
                    {tailorData.atsReport.actionVerbStrength?.weakCount
                      ? `Flagged ${tailorData.atsReport.actionVerbStrength.weakCount} passive verbs.`
                      : 'High STAR power verb density.'}
                  </p>
                </div>

                <div className="bg-zinc-50 dark:bg-zinc-900/50 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-mono font-bold text-zinc-500">Quantification</span>
                    <span className="font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400">
                      {tailorData.atsReport.quantificationStats
                        ? `${tailorData.atsReport.quantificationStats.percentage}%`
                        : `${tailorData.atsReport.breakdown.softSkillsScore}%`}
                    </span>
                  </div>
                  <p className="text-[10px] text-zinc-500 leading-tight">
                    {tailorData.atsReport.quantificationStats
                      ? `${tailorData.atsReport.quantificationStats.quantifiedBullets} of ${tailorData.atsReport.quantificationStats.totalBullets} bullets measured.`
                      : 'Measurable metric density.'}
                  </p>
                </div>

                <div className="bg-zinc-50 dark:bg-zinc-900/50 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-mono font-bold text-zinc-500">ATS Format</span>
                    <span className={`font-mono font-bold text-xs ${
                      tailorData.atsReport.breakdown.formattingScore >= 80 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                    }`}>
                      {tailorData.atsReport.breakdown.formattingScore}%
                    </span>
                  </div>
                  <p className="text-[10px] text-zinc-500 leading-tight">
                    {tailorData.atsReport.breakdown.formattingScore >= 90 ? 'Standard single-column flow.' : 'Formatting issues detected.'}
                  </p>
                </div>
              </div>

              {/* In-Document Suggestion Bridge Deck */}
              <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex items-center gap-2">
                <button
                  type="button"
                  onClick={onShowDiffsOnGoogleDoc}
                  className="flex-1 py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <span>🎯 View & Apply in Docs</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={handleFork}
                  disabled={isForking}
                  className="py-2 px-3 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-semibold text-xs border border-zinc-200 dark:border-zinc-700 flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50"
                  title="Fork a clean copy into Google Drive"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>{isForking ? 'Forking…' : 'Fork'}</span>
                </button>

                {pdfUrl && (
                  <a
                    href={pdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="py-2 px-3 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-semibold text-xs border border-zinc-200 dark:border-zinc-700 flex items-center gap-1 transition-all"
                    title="Download tailored PDF"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-[#121215] border border-zinc-200 dark:border-[#27272A] rounded-xl p-6 shadow-xs text-center space-y-3">
              <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto text-zinc-500">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-xs text-zinc-900 dark:text-zinc-100">
                  Ready to Run ATS Audit
                </h4>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 max-w-xs mx-auto">
                  Click the button above to compare your resume against the job description or industry benchmark.
                </p>
              </div>
            </div>
          )}

          {/* Company Archetype & Tailoring Strategy Card */}
          {tailorData?.archetype && (
            <div className="bg-zinc-900 text-white p-5 rounded-xl border border-zinc-800 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-zinc-200">
                  {tailorData.archetype.badge}
                </span>
                {tailorData.tokenCostInfo && (
                  <span className="px-2 py-0.5 rounded text-[9px] font-mono bg-zinc-800 text-zinc-300 border border-zinc-700">
                    ⚡ ~{tailorData.tokenCostInfo.tokenCount} tokens
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed">
                {tailorData.documentSummary || tailorData.archetype.narrativeDirective}
              </p>
              {tailorData.archetype.keyThemes && tailorData.archetype.keyThemes.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-zinc-800">
                  <span className="text-[10px] text-zinc-400 font-mono mr-1">Narrative Pillars:</span>
                  {tailorData.archetype.keyThemes.map((theme, tIdx) => (
                    <span key={tIdx} className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-200 text-[10px] font-medium border border-zinc-700">
                      {theme}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ATS Keyword Match Matrix */}
          {tailorData?.atsReport?.keywords && (
            <div className="bg-white dark:bg-[#121215] border border-zinc-200 dark:border-[#27272A] rounded-xl p-5 shadow-xs space-y-3 transition-colors">
              <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2.5">
                <span className="font-bold text-xs text-zinc-900 dark:text-zinc-100">
                  {mode === 'general' ? 'Industry Core Competencies' : 'ATS Keywords Match'}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setActiveFilter('all')}
                    className={`px-2 py-0.5 text-[10px] rounded font-semibold cursor-pointer ${
                      activeFilter === 'all' 
                        ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950' 
                        : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                    }`}
                  >
                    All ({tailorData.atsReport.keywords.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveFilter('missing')}
                    className={`px-2 py-0.5 text-[10px] rounded font-semibold cursor-pointer ${
                      activeFilter === 'missing' 
                        ? 'bg-amber-600 text-white' 
                        : 'text-amber-700 dark:text-amber-400 hover:bg-amber-500/10'
                    }`}
                  >
                    Missing ({tailorData.atsReport.keywords.filter(k => !k.foundInResume).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveFilter('matched')}
                    className={`px-2 py-0.5 text-[10px] rounded font-semibold cursor-pointer ${
                      activeFilter === 'matched' 
                        ? 'bg-emerald-600 text-white' 
                        : 'text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10'
                    }`}
                  >
                    Matched ({tailorData.atsReport.keywords.filter(k => k.foundInResume).length})
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 max-h-56 overflow-y-auto pr-1">
                {tailorData.atsReport.keywords
                  .filter(k => activeFilter === 'all' || (activeFilter === 'missing' ? !k.foundInResume : k.foundInResume))
                  .map((k, idx) => (
                    <span
                      key={idx}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                        k.foundInResume
                          ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-200 border border-emerald-500/20'
                          : 'bg-amber-500/10 text-amber-800 dark:text-amber-200 border border-amber-500/20'
                      }`}
                    >
                      {k.foundInResume ? (
                        <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <span className="text-amber-600 dark:text-amber-400 font-bold">+</span>
                      )}
                      <span>{k.keyword}</span>
                      {k.importance === 'Critical' && (
                        <span className="text-[9px] px-1 rounded bg-rose-500/10 text-rose-700 dark:text-rose-300 font-bold ml-0.5">
                          High
                        </span>
                      )}
                    </span>
                  ))}
              </div>
            </div>
          )}

          {/* High-Impact ATS Recommendations */}
          {tailorData?.atsReport?.improvementSuggestions && tailorData.atsReport.improvementSuggestions.length > 0 && (
            <div className="bg-white dark:bg-[#121215] border border-zinc-200 dark:border-[#27272A] rounded-xl p-5 shadow-xs space-y-3 transition-colors">
              <h3 className="font-bold text-xs text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                <span>High-Impact ATS Recommendations</span>
              </h3>
              <ul className="space-y-2">
                {tailorData.atsReport.improvementSuggestions.map((sug, sIdx) => (
                  <li key={sIdx} className="text-xs text-zinc-600 dark:text-zinc-300 flex items-start gap-2 leading-relaxed">
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold mt-0.5">•</span>
                    <span>{sug}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Applied Status Alert Toast / Banner */}
          {appliedStatus && (
            <div className={`p-3.5 rounded-xl text-xs flex items-center justify-between gap-2 shadow-xs ${
              appliedStatus.startsWith('⚠️')
                ? 'bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200'
                : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-900 dark:text-emerald-200'
            }`}>
              <div className="flex items-center gap-2">
                {appliedStatus.startsWith('⚠️') ? (
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                )}
                <span>{appliedStatus}</span>
              </div>
              {(appliedStatus.includes('OAuth') || appliedStatus.includes('Settings') || appliedStatus.includes('Google account')) && onNavigateToSettings && (
                <button
                  type="button"
                  onClick={onNavigateToSettings}
                  className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-[10px] font-bold shrink-0 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <span>Connect Now</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>
          )}

          {/* Forked Doc Notification */}
          {forkedDocUrl && (
            <div className="p-3.5 bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs text-zinc-900 dark:text-zinc-100 flex items-center justify-between">
              <span className="truncate">Saved to Google Drive</span>
              <a
                href={forkedDocUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-bold text-zinc-900 dark:text-white hover:underline shrink-0"
              >
                <span>Open Doc</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
