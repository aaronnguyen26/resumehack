import React, { useState } from 'react';
import { AtsGauge } from './AtsGauge.js';
import { ScrapedJobData, TailorResumeResponse, TailoredBulletDiff, LayoutIssue } from '../../types/index.js';
import { ParsedResume } from '../../services/resume-parser.js';
import { 
  Sparkles, 
  Check, 
  X, 
  Download, 
  FileEdit, 
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
  Sliders,
  Type,
  AlertCircle,
  AlertTriangle
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
  screenResume: { title: string; fullText: string; isGoogleDoc?: boolean } | null;
  parsedResume: ParsedResume | null;
  onUpdateCustomResumeText: (text: string) => void;
  onShowDiffsOnGoogleDoc?: () => void;
  onNavigateToSettings?: () => void;
  appliedStatus: string | null;
  forkedDocUrl: string | null;
  pdfUrl: string | null;
}

export const MatchTailorTab: React.FC<MatchTailorTabProps> = ({
  currentJob,
  tailorData,
  isLoading,
  onTriggerTailor,
  onTriggerGeneralAtsOptimize,
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
  pdfUrl
}) => {
  const [mode, setMode] = useState<'job' | 'general'>('job');
  const [selectedDomain, setSelectedDomain] = useState<string>('Software Engineering');
  const [diffs, setDiffs] = useState<TailoredBulletDiff[]>(tailorData?.bulletDiffs || []);
  const [activeFilter, setActiveFilter] = useState<'all' | 'missing' | 'matched'>('all');
  const [isForking, setIsForking] = useState(false);
  const [isEditingResume, setIsEditingResume] = useState(false);
  const [customText, setCustomText] = useState(screenResume?.fullText || '');
  const [showVisualSnapshots, setShowVisualSnapshots] = useState(false);

  const domains = ['Software Engineering', 'Data & AI', 'Product Management', 'Finance & Quant', 'General'];

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

  const appliedCount = diffs.filter((d: TailoredBulletDiff) => d.status === 'accepted').length;
  const totalDiffsCount = diffs.length;
  const progressPercentage = totalDiffsCount > 0 ? Math.round((appliedCount / totalDiffsCount) * 100) : 0;

  return (
    <div className="p-4 space-y-4 pb-24">
      {/* Mode Switcher: Job Match vs General ATS */}
      <div className="flex p-1 bg-slate-200/80 rounded-stitch text-xs font-semibold">
        <button
          onClick={() => setMode('job')}
          className={`flex-1 py-1.5 px-2 rounded flex items-center justify-center gap-1.5 transition-all ${
            mode === 'job'
              ? 'bg-white text-brand-700 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Target className="w-3.5 h-3.5" />
          <span>Job Match ATS Audit</span>
        </button>
        <button
          onClick={() => setMode('general')}
          className={`flex-1 py-1.5 px-2 rounded flex items-center justify-center gap-1.5 transition-all ${
            mode === 'general'
              ? 'bg-white text-emerald-800 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Universal Master ATS</span>
        </button>
      </div>

      {/* 1. On-Demand Resume Screen Reader Card */}
      {!screenResume ? (
        <div className="bg-white p-4 rounded-stitch border border-brand-200 shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
              <Monitor className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-headline font-bold text-xs text-slate-900">
                Load Your Resume from Screen
              </h3>
              <p className="text-[11px] text-slate-500">
                Open your Google Doc or resume tab, then click below.
              </p>
            </div>
          </div>

          <button
            onClick={onReadScreenNow}
            className="w-full py-2.5 px-3 rounded-stitch bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm"
          >
            <Scan className="w-3.5 h-3.5" />
            <span>Scan & Read Active Screen Resume</span>
          </button>

          <div className="text-center">
            <button
              onClick={() => setIsEditingResume(true)}
              className="text-[11px] text-slate-500 hover:text-brand-600 underline font-medium"
            >
              Or paste resume text manually
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white p-3.5 rounded-stitch border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 truncate">
              <div className="w-7 h-7 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div className="truncate">
                <span className="text-[10px] uppercase font-mono font-bold text-emerald-600 block leading-none">
                  {screenResume.isGoogleDoc ? 'Google Doc Connected' : 'Screen Resume Loaded'}
                </span>
                <span className="font-headline font-bold text-xs text-slate-900 truncate block mt-0.5" title={screenResume.title}>
                  {screenResume.title}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => setIsEditingResume(!isEditingResume)}
                className="p-1.5 rounded hover:bg-slate-100 text-slate-600"
                title="Edit / View raw text"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={onReadScreenNow}
                className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-[10px] font-semibold text-slate-700 flex items-center gap-1"
                title="Re-read text from active tab"
              >
                <RefreshCw className="w-3 h-3 text-slate-500" />
                <span>Re-scan</span>
              </button>
            </div>
          </div>

          <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-100 font-mono">
            <span>{parsedResume?.bullets.length || 0} bullet points extracted</span>
            <span>{screenResume.fullText.length.toLocaleString()} chars</span>
          </div>
        </div>
      )}

      {/* In-Sidepanel Resume Text Editor / Paste Drawer */}
      {isEditingResume && (
        <div className="bg-white p-3.5 rounded-stitch border border-brand-200 shadow-md space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="font-headline font-bold text-xs text-slate-900 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-brand-600" />
              <span>Resume Content</span>
            </span>
            <button
              onClick={() => setIsEditingResume(false)}
              className="text-slate-400 hover:text-slate-600 text-xs font-bold"
            >
              ✕
            </button>
          </div>
          <textarea
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            rows={7}
            placeholder="Paste or type your resume bullet points here..."
            className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-xs text-slate-900 font-mono focus:outline-none focus:border-brand-500 leading-relaxed"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setIsEditingResume(false)}
              className="px-3 py-1 text-xs text-slate-600 hover:bg-slate-100 rounded"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveCustomText}
              className="px-3 py-1 bg-brand-600 hover:bg-brand-700 text-white rounded text-xs font-semibold"
            >
              Save & Parse
            </button>
          </div>
        </div>
      )}

      {/* MODE A: Job Opening Tailoring */}
      {mode === 'job' && (
        <div className="space-y-3">
          <div className="bg-white p-3.5 rounded-stitch border border-slate-200 shadow-sm space-y-2">
            <div className="flex items-start justify-between">
              <div>
                <span className="inline-block px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded bg-brand-50 text-brand-700 font-mono">
                  {currentJob.source}
                </span>
                <h2 className="font-headline font-bold text-xs text-slate-900 mt-1">
                  {currentJob.title}
                </h2>
                <p className="text-xs font-semibold text-slate-600">
                  {currentJob.company} {currentJob.location ? `• ${currentJob.location}` : ''}
                </p>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={onScrapeJobFromCurrentTab}
                  className="px-2 py-1 text-[10px] font-semibold rounded bg-slate-100 hover:bg-slate-200 text-slate-700"
                  title="Scrape job from current active tab"
                >
                  Scan Job Tab
                </button>
                <button
                  onClick={onTriggerAutofill}
                  className="px-2 py-1 text-[10px] font-semibold rounded bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 flex items-center gap-1"
                >
                  <Zap className="w-3 h-3 text-amber-600" />
                  <span>Autofill</span>
                </button>
              </div>
            </div>
          </div>

          {!tailorData && !isLoading && (
            <button
              onClick={onTriggerTailor}
              className="w-full py-3 px-4 rounded-stitch bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 group"
            >
              <Sparkles className="w-4 h-4 transition-transform group-hover:scale-110" />
              <span>Run ATS Match Audit & Generate STAR Bullets</span>
            </button>
          )}
        </div>
      )}

      {/* MODE B: General Master ATS Optimizer */}
      {mode === 'general' && (
        <div className="space-y-3">
          <div className="bg-white p-3.5 rounded-stitch border border-emerald-200 shadow-sm space-y-2.5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <div>
                <h3 className="font-headline font-bold text-xs text-slate-900">
                  Universal ATS & STAR Optimizer
                </h3>
                <p className="text-[11px] text-slate-500">
                  Polishes verb vitality, quantifiable metrics, and ATS parsing health.
                </p>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                Target Industry Benchmark
              </label>
              <div className="flex gap-1 overflow-x-auto pb-1 no-scrollbar">
                {domains.map(d => (
                  <button
                    key={d}
                    onClick={() => setSelectedDomain(d)}
                    className={`shrink-0 px-2 py-0.5 text-[11px] rounded-full font-medium transition-all ${
                      selectedDomain === d
                        ? 'bg-emerald-700 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => onTriggerGeneralAtsOptimize(selectedDomain)}
              className="w-full py-2.5 px-4 rounded-stitch bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow transition-all flex items-center justify-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Audit & Optimize Master Resume</span>
            </button>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="p-6 flex flex-col items-center justify-center space-y-3 text-center bg-white rounded-stitch border border-slate-200 shadow-sm">
          <div className="w-10 h-10 border-3 border-brand-200 border-t-brand-600 rounded-full animate-spin"></div>
          <div>
            <h3 className="font-headline font-bold text-xs text-slate-900">
              {mode === 'general' ? 'Running Universal ATS Audit...' : 'Analyzing Job Alignment & Generating STAR Bullets...'}
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Calculating keyword match, action verb vitality, and metric quantification.
            </p>
          </div>
        </div>
      )}

      {tailorData && !isLoading && (
        <>
          {/* In-Document Suggestion Bridge Card (Replaces duplicate cards) */}
          <div className="bg-gradient-to-br from-brand-900 to-indigo-950 text-white p-4 rounded-stitch shadow-md space-y-3 border border-brand-700/50">
            <div className="flex items-start justify-between">
              <div className="space-y-0.5">
                <span className="text-[10px] uppercase font-mono font-bold text-brand-300 flex items-center gap-1">
                  <span>🦉 Google Docs In-Doc Suggestion Bridge</span>
                </span>
                <h3 className="font-headline font-bold text-sm text-white">
                  {totalDiffsCount > 0
                    ? `${appliedCount} of ${totalDiffsCount} STAR Bullets Applied`
                    : 'STAR Suggestions Ready'}
                </h3>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-mono font-bold border border-emerald-400/30">
                {progressPercentage}% Applied
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-gradient-to-r from-emerald-400 to-emerald-300 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.max(5, progressPercentage)}%` }}
              ></div>
            </div>

            <p className="text-[11px] text-slate-300 leading-snug">
              Individual bullet suggestions and one-click apply controls are floating live inside your Google Docs tab.
            </p>

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={onShowDiffsOnGoogleDoc}
                className="flex-1 py-2.5 px-3 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-sm flex items-center justify-center gap-1.5 transition-all"
              >
                <span>🎯 View & Apply in Document</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={handleFork}
                disabled={isForking}
                className="py-2.5 px-3 rounded bg-white/10 hover:bg-white/20 text-white font-semibold text-xs transition-all flex items-center gap-1"
                title="Fork a copy in Google Drive"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>{isForking ? 'Saving…' : 'Fork'}</span>
              </button>

              {pdfUrl && (
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="py-2.5 px-3 rounded bg-white/10 hover:bg-white/20 text-white font-semibold text-xs transition-all flex items-center gap-1"
                  title="Export PDF"
                >
                  <Download className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </div>

          {/* ATS Gauge */}
          <AtsGauge 
            score={tailorData.atsReport.overallScore} 
            projectedScore={tailorData.projectedNewScore} 
          />

          {/* Detected Job Intelligence */}
          {tailorData.detectedJobIntel && (
            <div className="bg-slate-50 border border-slate-200 p-3 rounded-stitch space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1">
                  <span>🎯 Role Intelligence</span>
                </span>
                {tailorData.detectedJobIntel.seniorityLevel && (
                  <span className="px-2 py-0.5 rounded-full bg-brand-100 text-brand-800 text-[10px] font-bold">
                    {tailorData.detectedJobIntel.seniorityLevel}
                  </span>
                )}
              </div>

              {tailorData.detectedJobIntel.topHardSkills && tailorData.detectedJobIntel.topHardSkills.length > 0 && (
                <div className="flex flex-wrap items-center gap-1 pt-1 border-t border-slate-200/60">
                  <span className="text-[10px] text-slate-500 font-semibold mr-1">Core Tech:</span>
                  {tailorData.detectedJobIntel.topHardSkills.map((skill, sIdx) => (
                    <span
                      key={sIdx}
                      className="px-1.5 py-0.5 rounded bg-white text-slate-700 text-[10px] font-medium border border-slate-200 shadow-xs"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 4-Dimensional ATS Scoring Grid */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white p-2.5 rounded-stitch border border-slate-200 shadow-sm space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Hard Skills</span>
                <span className="font-mono font-bold text-xs text-brand-600">
                  {tailorData.atsReport.breakdown.hardSkillsScore}%
                </span>
              </div>
              <p className="text-[10px] text-slate-500 leading-tight">
                {tailorData.atsReport.matchedKeywordsCount} of {tailorData.atsReport.totalKeywords} keywords matched.
              </p>
            </div>

            <div className="bg-white p-2.5 rounded-stitch border border-slate-200 shadow-sm space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Action Verbs</span>
                <span className="font-mono font-bold text-xs text-brand-600">
                  {tailorData.atsReport.actionVerbStrength
                    ? `${Math.round((tailorData.atsReport.actionVerbStrength.strongCount / (tailorData.atsReport.actionVerbStrength.strongCount + tailorData.atsReport.actionVerbStrength.weakCount || 1)) * 100)}%`
                    : `${tailorData.atsReport.breakdown.experienceRelevanceScore}%`}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 leading-tight">
                {tailorData.atsReport.actionVerbStrength?.weakCount
                  ? `Flagged ${tailorData.atsReport.actionVerbStrength.weakCount} passive verbs.`
                  : 'High STAR power verb density.'}
              </p>
            </div>

            <div className="bg-white p-2.5 rounded-stitch border border-slate-200 shadow-sm space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Quantification</span>
                <span className="font-mono font-bold text-xs text-emerald-600">
                  {tailorData.atsReport.quantificationStats
                    ? `${tailorData.atsReport.quantificationStats.percentage}%`
                    : `${tailorData.atsReport.breakdown.softSkillsScore}%`}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 leading-tight">
                {tailorData.atsReport.quantificationStats
                  ? `${tailorData.atsReport.quantificationStats.quantifiedBullets} of ${tailorData.atsReport.quantificationStats.totalBullets} bullets have metrics.`
                  : 'Measurable metric density.'}
              </p>
            </div>

            <div className="bg-white p-2.5 rounded-stitch border border-slate-200 shadow-sm space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">ATS Format</span>
                <span className={`font-mono font-bold text-xs ${
                  tailorData.atsReport.breakdown.formattingScore >= 80 ? 'text-emerald-600' : 'text-amber-600'
                }`}>
                  {tailorData.atsReport.breakdown.formattingScore}%
                </span>
              </div>
              <p className="text-[10px] text-slate-500 leading-tight">
                {tailorData.atsReport.layoutReport?.summary ||
                  (tailorData.atsReport.breakdown.formattingScore >= 90
                    ? 'Standard single-column flow.'
                    : 'Formatting issues detected.')}
              </p>
            </div>
          </div>

          {/* Dedicated ATS Layout & Structural + Visual Polish Suggestions */}
          {tailorData.atsReport.layoutReport && tailorData.atsReport.layoutReport.issues.length > 0 && (
            <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white p-3.5 rounded-stitch shadow-md space-y-3 border border-indigo-800/60">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Layout className="w-4 h-4 text-indigo-400" />
                  <span className="font-headline font-bold text-xs text-white">
                    ATS Layout &amp; Visual Hygiene
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {tailorData.atsReport.layoutReport.visualPolishScore !== undefined && (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-mono font-bold border border-emerald-400/30">
                      👁️ {tailorData.atsReport.layoutReport.visualPolishScore}% Polish
                    </span>
                  )}
                  <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-mono font-bold border border-indigo-400/30">
                    {tailorData.atsReport.layoutReport.issues.length} Flagged
                  </span>
                </div>
              </div>

              {/* Visual Snapshot & Page Fill Banner */}
              {tailorData.atsReport.layoutReport.visualReport && (
                <div className="p-2.5 bg-indigo-900/40 rounded border border-indigo-700/50 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-indigo-200 text-[11px] flex items-center gap-1">
                      <span>📄 Rendered Page Fill:</span>
                      <span className={`px-1.5 py-0.2 rounded text-[10px] uppercase font-bold ${
                        tailorData.atsReport.layoutReport.visualReport.pageFillAssessment === 'optimal_single_page'
                          ? 'bg-emerald-500/30 text-emerald-300'
                          : 'bg-amber-500/30 text-amber-300'
                      }`}>
                        {tailorData.atsReport.layoutReport.visualReport.pageFillAssessment.replace(/_/g, ' ')}
                      </span>
                    </span>
                    {tailorData.atsReport.layoutReport.visualReport.snapshots.length > 0 && (
                      <button
                        onClick={() => setShowVisualSnapshots(!showVisualSnapshots)}
                        className="text-[10px] font-bold text-indigo-300 hover:text-indigo-100 underline flex items-center gap-1"
                      >
                        <span>{showVisualSnapshots ? 'Hide Snapshot' : '👁️ View Snapshot'}</span>
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-300 leading-tight">
                    {tailorData.atsReport.layoutReport.visualReport.pageFillDescription}
                  </p>

                  {/* Rendered Page Thumbnail Preview */}
                  {showVisualSnapshots && tailorData.atsReport.layoutReport.visualReport.snapshots.length > 0 && (
                    <div className="pt-2 flex gap-2 overflow-x-auto pb-1">
                      {tailorData.atsReport.layoutReport.visualReport.snapshots.map((snap) => (
                        <div key={snap.pageNumber} className="relative group shrink-0 border border-white/20 rounded shadow-md overflow-hidden bg-white">
                          <img
                            src={snap.dataUrl}
                            alt={`Rendered Page ${snap.pageNumber}`}
                            className="w-36 h-auto object-contain"
                          />
                          <span className="absolute bottom-1 right-1 bg-slate-900/80 text-[9px] text-white px-1.5 py-0.5 rounded font-mono">
                            Page {snap.pageNumber}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2">
                {tailorData.atsReport.layoutReport.issues.map((issue) => {
                  const isAccepted = issue.status === 'accepted';
                  return (
                    <div
                      key={issue.id}
                      className="bg-white/10 p-2.5 rounded border border-white/10 space-y-1.5 text-xs text-slate-200"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                              issue.severity === 'critical'
                                ? 'bg-rose-500/30 text-rose-300 border border-rose-500/40'
                                : issue.severity === 'warning'
                                ? 'bg-amber-500/30 text-amber-300 border border-amber-500/40'
                                : 'bg-blue-500/30 text-blue-300 border border-blue-500/40'
                            }`}
                          >
                            {issue.category === 'table_risk'
                              ? '⚠️ Table Risk'
                              : issue.category === 'multicolumn_risk'
                              ? '⚠️ Multi-Column Risk'
                              : issue.category === 'manual_tab_alignment'
                              ? '↔️ Space Alignment'
                              : issue.category === 'font_inconsistency'
                              ? '🔤 Font Drift'
                              : issue.category === 'spacing_drift'
                              ? '📏 Spacing Drift'
                              : issue.category === 'visual_crowding'
                              ? '👁️ Visual Crowding'
                              : issue.category === 'page_overflow'
                              ? '📄 Page Overflow'
                              : issue.category === 'whitespace_rhythm'
                              ? '📐 Whitespace Rhythm'
                              : issue.category === 'section_imbalance'
                              ? '⚖️ Section Balance'
                              : issue.category === 'visual_polish'
                              ? '✨ Visual Polish'
                              : '• List Inconsistency'}
                          </span>
                          {issue.sectionName && (
                            <span className="px-1.5 py-0.5 rounded bg-slate-800 text-indigo-300 text-[9px] font-mono font-bold">
                              {issue.sectionName}
                            </span>
                          )}
                          <span className="font-bold text-white text-xs">{issue.title}</span>
                        </div>
                      </div>

                      <p className="text-[11px] text-slate-300 leading-snug">
                        {issue.description}
                      </p>

                      {issue.visualObservation && (
                        <p className="text-[10px] text-indigo-200/90 italic bg-black/20 p-1.5 rounded">
                          👁️ <strong>Visual evidence:</strong> {issue.visualObservation}
                        </p>
                      )}

                      <div className="flex items-center justify-between pt-1 text-[10px]">
                        <span className="text-indigo-300 font-medium italic">
                          💡 {issue.impact}
                        </span>

                        {issue.suggestedFix && onApplyLayoutFix && (
                          <button
                            onClick={() => onApplyLayoutFix(issue)}
                            disabled={isAccepted}
                            className={`px-2.5 py-1 rounded font-bold text-[11px] transition-all flex items-center gap-1 ${
                              isAccepted
                                ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-400/40'
                                : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-sm'
                            }`}
                          >
                            {isAccepted ? (
                              <span>✓ Fixed in Doc</span>
                            ) : (
                              <span>⚡ {issue.suggestedFix.actionLabel || 'Fix in Doc'}</span>
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

          {/* Keywords Match Breakdown */}
          <div className="bg-white p-3.5 rounded-stitch border border-slate-200 shadow-sm space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-headline font-bold text-xs text-slate-900">
                {mode === 'general' ? 'Industry Core Competencies' : 'ATS Keywords Match'}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setActiveFilter('all')}
                  className={`px-1.5 py-0.5 text-[10px] rounded font-semibold ${
                    activeFilter === 'all' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  All ({tailorData.atsReport.keywords.length})
                </button>
                <button
                  onClick={() => setActiveFilter('missing')}
                  className={`px-1.5 py-0.5 text-[10px] rounded font-semibold ${
                    activeFilter === 'missing' ? 'bg-amber-500 text-white' : 'text-amber-700 hover:bg-amber-50'
                  }`}
                >
                  Missing ({tailorData.atsReport.keywords.filter(k => !k.foundInResume).length})
                </button>
                <button
                  onClick={() => setActiveFilter('matched')}
                  className={`px-1.5 py-0.5 text-[10px] rounded font-semibold ${
                    activeFilter === 'matched' ? 'bg-emerald-600 text-white' : 'text-emerald-700 hover:bg-emerald-50'
                  }`}
                >
                  Matched ({tailorData.atsReport.keywords.filter(k => k.foundInResume).length})
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto pr-1">
              {tailorData.atsReport.keywords
                .filter(k => activeFilter === 'all' || (activeFilter === 'missing' ? !k.foundInResume : k.foundInResume))
                .map((k, idx) => (
                  <span
                    key={idx}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                      k.foundInResume
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-amber-50 text-amber-800 border border-amber-200'
                    }`}
                  >
                    {k.foundInResume ? (
                      <Check className="w-3 h-3 text-emerald-600" />
                    ) : (
                      <span className="text-amber-600 font-bold">+</span>
                    )}
                    <span>{k.keyword}</span>
                    {k.importance === 'Critical' && (
                      <span className="text-[9px] px-1 rounded bg-rose-100 text-rose-700 font-bold ml-0.5">
                        High
                      </span>
                    )}
                  </span>
                ))}
            </div>
          </div>

          {/* ATS Structural & Formatting Hygiene Checklist */}
          <div className="bg-white p-3.5 rounded-stitch border border-slate-200 shadow-sm space-y-2.5">
            <h3 className="font-headline font-bold text-xs text-slate-900 flex items-center gap-1.5">
              <span>🛡️ ATS Structural & Formatting Health</span>
            </h3>

            <div className="space-y-2 text-[11px]">
              <div className="flex items-start gap-2 p-2 bg-slate-50 rounded border border-slate-100">
                <span className="text-emerald-600 font-bold text-xs">
                  {tailorData.atsReport.layoutReport?.isSingleColumnStandard !== false ? '✓' : '⚠️'}
                </span>
                <div>
                  <span className="font-bold text-slate-800">
                    {tailorData.atsReport.layoutReport?.isSingleColumnStandard !== false
                      ? 'Single-Column Parseable Layout'
                      : 'Non-Standard Layout Detected'}
                  </span>
                  <p className="text-slate-500 text-[10px]">
                    {tailorData.atsReport.layoutReport?.summary || 'Standard single-column flow with no complex tables or column splits.'}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2 p-2 bg-slate-50 rounded border border-slate-100">
                <span className="text-emerald-600 font-bold text-xs">✓</span>
                <div>
                  <span className="font-bold text-slate-800">Standard Section Headings</span>
                  <p className="text-slate-500 text-[10px]">Experience, Education, and Skills sections are cleanly formatted.</p>
                </div>
              </div>

              {tailorData.atsReport.actionVerbStrength?.weakCount ? (
                <div className="flex items-start gap-2 p-2 bg-amber-50 rounded border border-amber-200">
                  <span className="text-amber-600 font-bold text-xs">⚠️</span>
                  <div>
                    <span className="font-bold text-amber-900">Passive Verb Replacement Recommended</span>
                    <p className="text-amber-800 text-[10px]">
                      Found {tailorData.atsReport.actionVerbStrength.weakCount} passive phrases ({tailorData.atsReport.actionVerbStrength.weakVerbsFound.slice(0, 3).map(v => `"${v}"`).join(', ')}). Upgrade using the in-doc suggestion overlay.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2 p-2 bg-slate-50 rounded border border-slate-100">
                  <span className="text-emerald-600 font-bold text-xs">✓</span>
                  <div>
                    <span className="font-bold text-slate-800">High STAR Action Verb Vitality</span>
                    <p className="text-slate-500 text-[10px]">Strong lead verbs throughout all bullet points.</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Actionable ATS Improvement Suggestions */}
          {tailorData.atsReport.improvementSuggestions && tailorData.atsReport.improvementSuggestions.length > 0 && (
            <div className="bg-white p-3.5 rounded-stitch border border-slate-200 shadow-sm space-y-2">
              <h3 className="font-headline font-bold text-xs text-slate-900">
                💡 High-Impact ATS Recommendations
              </h3>
              <ul className="space-y-1.5">
                {tailorData.atsReport.improvementSuggestions.map((sug, sIdx) => (
                  <li key={sIdx} className="text-[11px] text-slate-600 flex items-start gap-2 leading-tight">
                    <span className="text-brand-600 font-bold mt-0.5">•</span>
                    <span>{sug}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {appliedStatus && (
            <div className={`p-3 rounded-stitch text-xs flex items-center justify-between gap-2 shadow-xs ${
              appliedStatus.startsWith('⚠️')
                ? 'bg-amber-50 border border-amber-300 text-amber-900'
                : 'bg-emerald-50 border border-emerald-200 text-emerald-800'
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
                  className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-[10px] font-bold shrink-0 transition-colors flex items-center gap-1 shadow-2xs cursor-pointer"
                >
                  <span>Connect Now</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>
          )}

          {forkedDocUrl && (
            <div className="p-3 bg-brand-50 border border-brand-200 rounded-stitch text-xs text-brand-900 flex items-center justify-between">
              <span className="truncate">📂 Saved to Google Drive!</span>
              <a
                href={forkedDocUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-bold text-brand-700 hover:underline shrink-0"
              >
                <span>Open Doc</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}

          {/* Sticky Bottom Action Bar */}
          <div className="fixed bottom-0 left-0 right-0 p-3 bg-white border-t border-slate-200 shadow-lg space-y-2 z-40">
            <div className="flex gap-2">
              <button
                onClick={onShowDiffsOnGoogleDoc}
                className="flex-1 py-2.5 px-3 rounded-stitch bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow flex items-center justify-center gap-1.5"
              >
                <span>🎯 View Suggestions in Google Docs</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={handleFork}
                disabled={isForking}
                className="py-2.5 px-3 rounded-stitch bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white font-semibold text-xs shadow flex items-center justify-center gap-1.5"
                title="Fork a clean copy into your Google Drive"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>{isForking ? 'Forking...' : 'Fork'}</span>
              </button>

              {pdfUrl && (
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="py-2.5 px-3 rounded-stitch bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs shadow flex items-center justify-center gap-1.5"
                  title="Download tailored PDF"
                >
                  <Download className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
