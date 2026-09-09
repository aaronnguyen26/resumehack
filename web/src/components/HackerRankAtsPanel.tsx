import React, { useState, useMemo } from 'react';
import { 
  Award, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  Check, 
  ChevronRight, 
  Sparkles, 
  Briefcase, 
  Code2, 
  SlidersHorizontal, 
  PanelRightClose, 
  Target, 
  ArrowUpRight, 
  TrendingUp, 
  Flame, 
  Terminal, 
  Layers, 
  Plus, 
  FileText,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { AtsScorerService } from '../services/ats-scorer.js';
import { 
  AtsScoreReport, 
  KeywordMatch, 
  TailoredBulletDiff, 
  ApplicantProfile, 
  ScrapedJobData, 
  TailorResumeResponse 
} from '../types/index.js';

export interface HackerRankAtsPanelProps {
  resumeText: string;
  applicantProfile?: ApplicantProfile;
  currentJob?: ScrapedJobData;
  onUpdateCurrentJob?: (job: ScrapedJobData) => void;
  onTriggerTailor?: () => Promise<void>;
  tailorData?: TailorResumeResponse | null;
  isTailorLoading?: boolean;
  targetRole?: string;
  diffs?: TailoredBulletDiff[];
  onApplyBulletDiff?: (diffIndex: number) => void;
  onApplyAllDiffs?: () => void;
  onInsertKeyword: (keyword: string) => void;
  onClose?: () => void;
  lineCount: number;
  maxRecommendedLines: number;
  pageBudgetPercentage: number;
  linesRemaining: number;
  sectionBreakdown: { title: string; count: number }[];
}

type TabMode = 'rubric' | 'role' | 'budget';

export const HackerRankAtsPanel: React.FC<HackerRankAtsPanelProps> = ({
  resumeText,
  applicantProfile,
  currentJob,
  onUpdateCurrentJob,
  onTriggerTailor,
  tailorData,
  isTailorLoading = false,
  targetRole = 'Senior Software Engineer',
  diffs = [],
  onApplyBulletDiff,
  onApplyAllDiffs,
  onInsertKeyword,
  onClose,
  lineCount,
  maxRecommendedLines,
  pageBudgetPercentage,
  linesRemaining,
  sectionBreakdown,
}) => {
  const [activeTab, setActiveTab] = useState<TabMode>('rubric');
  const [isEditingJob, setIsEditingJob] = useState(false);
  const [customJobDesc, setCustomJobDesc] = useState(currentJob?.description || '');
  const [customJobTitle, setCustomJobTitle] = useState(currentJob?.title || targetRole);
  const [customJobCompany, setCustomJobCompany] = useState(currentJob?.company || 'Target Tech Co');

  const atsScorer = useMemo(() => new AtsScorerService(), []);

  // Compute live HackerRank ATS report on every text edit
  const atsReport: AtsScoreReport = useMemo(() => {
    const textToScan = resumeText.trim() ? resumeText : 'Candidate Resume';
    if (currentJob?.description && currentJob.description.trim()) {
      return atsScorer.analyze(textToScan, currentJob.description);
    }
    return atsScorer.auditGeneralAts(textToScan, targetRole || 'Software Engineering');
  }, [resumeText, currentJob?.description, targetRole, atsScorer]);

  const score = atsReport.overallScore;

  // Determine HackerRank hiring bar qualification
  const hiringBar = useMemo(() => {
    if (score >= 90) {
      return {
        label: 'Meets Tier-1 Hiring Bar',
        percentile: 'Top 5% of Applicants',
        badgeColor: 'text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
        summary: 'Exceptional technical depth. Demonstrates production systems maturity, verifiable self projects, and dense STAR metrics.',
      };
    } else if (score >= 80) {
      return {
        label: 'Meets Competitive Bar',
        percentile: 'Top 15% of Applicants',
        badgeColor: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
        summary: 'Strong technical profile. Passing automated resume screen for senior & mid-level engineering roles.',
      };
    } else if (score >= 70) {
      return {
        label: 'Borderline Screen Threshold',
        percentile: 'Top 30% of Applicants',
        badgeColor: 'text-amber-700 dark:text-amber-400 bg-amber-500/10 border-amber-500/20',
        summary: 'Acceptable baseline. Boosting production keywords and replacing passive verbs will secure recruiter screens.',
      };
    } else {
      return {
        label: 'Below Technical Threshold',
        percentile: 'Bottom 70% of Applicants',
        badgeColor: 'text-zinc-700 dark:text-zinc-300 bg-zinc-500/10 border-zinc-500/20',
        summary: 'Critical technical gaps detected. Add quantifiable metrics and production infrastructure to meet the screening bar.',
      };
    }
  }, [score]);

  // Handle saving target job calibration
  const handleSaveJobCalibration = () => {
    if (onUpdateCurrentJob) {
      onUpdateCurrentJob({
        title: customJobTitle.trim() || 'Software Engineer',
        company: customJobCompany.trim() || 'Target Tech Co',
        location: currentJob?.location || 'Remote',
        description: customJobDesc.trim() || 'Software engineering requirements',
        url: currentJob?.url || '',
        source: 'Custom'
      });
    }
    setIsEditingJob(false);
  };

  const pendingDiffs = useMemo(() => diffs.filter(d => d.status !== 'accepted'), [diffs]);

  // Missing critical keywords from the active rubric
  const missingKeywords = useMemo(() => {
    return atsReport.keywords.filter(k => !k.foundInResume);
  }, [atsReport.keywords]);

  const matchedKeywords = useMemo(() => {
    return atsReport.keywords.filter(k => k.foundInResume);
  }, [atsReport.keywords]);

  return (
    <aside className="w-full md:w-84 lg:w-96 bg-white dark:bg-[#121215] border-l border-zinc-200 dark:border-[#27272A] flex flex-col shrink-0 shadow-sm transition-all duration-200">
      {/* Panel Header */}
      <div className="p-4 border-b border-zinc-200 dark:border-[#27272A] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 flex items-center justify-center font-bold text-xs font-headline shadow-xs">
            HR
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-xs font-headline uppercase tracking-wider text-zinc-950 dark:text-zinc-50 leading-none">
              HackerRank ATS
            </span>
            <span className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400 mt-0.5">
              Deterministic Technical Architecture
            </span>
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer transition-colors"
            title="Collapse Inspector"
          >
            <PanelRightClose className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Segmented Navigation Tabs */}
      <div className="flex border-b border-zinc-200 dark:border-[#27272A] text-xs font-mono font-medium">
        <button
          type="button"
          onClick={() => setActiveTab('rubric')}
          className={`flex-1 py-2 text-center border-b-2 transition-colors cursor-pointer ${
            activeTab === 'rubric'
              ? 'border-zinc-900 dark:border-white text-zinc-900 dark:text-white font-bold'
              : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
          }`}
        >
          Scorecard
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('role')}
          className={`flex-1 py-2 text-center border-b-2 transition-colors cursor-pointer relative ${
            activeTab === 'role'
              ? 'border-zinc-900 dark:border-white text-zinc-900 dark:text-white font-bold'
              : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
          }`}
        >
          Role & STAR {pendingDiffs.length > 0 && (
            <span className="inline-flex items-center justify-center px-1.5 py-0.2 ml-1 text-[9px] font-mono bg-emerald-500 text-white rounded-full">
              {pendingDiffs.length}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('budget')}
          className={`flex-1 py-2 text-center border-b-2 transition-colors cursor-pointer ${
            activeTab === 'budget'
              ? 'border-zinc-900 dark:border-white text-zinc-900 dark:text-white font-bold'
              : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
          }`}
        >
          Page Budget
        </button>
      </div>

      {/* Tab 1: HackerRank Technical Scorecard & 6-Dimensional Rubric */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeTab === 'rubric' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            {/* HackerRank Hiring Bar Gauge */}
            <div className="p-4 rounded-xl bg-zinc-50 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-emerald-500" />
                  <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-300">
                    HackerRank Benchmark
                  </span>
                </div>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border font-bold ${hiringBar.badgeColor}`}>
                  {hiringBar.percentile}
                </span>
              </div>

              <div className="flex items-baseline justify-between pt-1">
                <div>
                  <div className="text-3xl font-bold font-mono text-zinc-950 dark:text-zinc-50">
                    {score}<span className="text-sm font-normal text-zinc-500">/100</span>
                  </div>
                  <div className="text-xs font-headline font-bold text-zinc-900 dark:text-zinc-100 mt-0.5">
                    {hiringBar.label}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400">Target Role</div>
                  <div className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate max-w-[140px]" title={currentJob?.title || targetRole}>
                    {currentJob?.company ? `${currentJob.company}` : targetRole}
                  </div>
                </div>
              </div>

              {/* Percentile Rating Bar */}
              <div className="w-full bg-zinc-200 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-500 ${score >= 80 ? 'bg-emerald-500' : score >= 70 ? 'bg-amber-500' : 'bg-zinc-600'}`}
                  style={{ width: `${Math.min(100, Math.max(15, score))}%` }}
                />
              </div>

              <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed italic pt-1 border-t border-zinc-200/60 dark:border-zinc-800/60">
                "{hiringBar.summary}"
              </p>
            </div>

            {/* 6-Dimensional Competency Matrix (HackerRank Exact Formula) */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono uppercase font-bold text-zinc-500 dark:text-zinc-400">
                  6-Dimensional Competency Matrix
                </span>
                <span className="text-[10px] font-mono text-zinc-400">100% Weighted</span>
              </div>

              <div className="grid grid-cols-1 gap-2 text-xs">
                {/* 1. Hard Skills (30%) */}
                <div className="p-2.5 rounded-lg bg-zinc-50 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                      <Code2 className="w-3.5 h-3.5 text-zinc-700 dark:text-zinc-300" />
                      <span>Hard Skills & Taxonomy</span>
                    </span>
                    <span className="font-mono font-bold text-zinc-950 dark:text-zinc-50">
                      {atsReport.breakdown.hardSkillsScore}%
                    </span>
                  </div>
                  <div className="w-full bg-zinc-200 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-emerald-500 h-full transition-all"
                      style={{ width: `${atsReport.breakdown.hardSkillsScore}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                    <span>{atsReport.matchedKeywordsCount} of {atsReport.totalKeywords} skills detected</span>
                    <span>30% Weight</span>
                  </div>
                </div>

                {/* 2. Production Experience (15%) */}
                <div className="p-2.5 rounded-lg bg-zinc-50 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                      <Briefcase className="w-3.5 h-3.5 text-zinc-700 dark:text-zinc-300" />
                      <span>Production Systems & Scale</span>
                    </span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {atsReport.productionExperienceAudit?.score ?? atsReport.breakdown.productionExperienceScore ?? 85}%
                    </span>
                  </div>
                  <div className="w-full bg-zinc-200 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-emerald-500 h-full transition-all"
                      style={{ width: `${atsReport.productionExperienceAudit?.score ?? 85}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                    <span>
                      {atsReport.productionExperienceAudit?.roleCount ?? 1} role(s) &bull; {atsReport.productionExperienceAudit?.productionKeywordsFound.length ?? 0} infra signals
                    </span>
                    <span>15% Weight</span>
                  </div>
                </div>

                {/* 3. Self Projects & Systems Architecture (10%) */}
                <div className="p-2.5 rounded-lg bg-zinc-50 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                      <Terminal className="w-3.5 h-3.5 text-zinc-700 dark:text-zinc-300" />
                      <span>Independent Systems Projects</span>
                    </span>
                    <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">
                      {atsReport.selfProjectsAudit?.score ?? atsReport.breakdown.selfProjectsScore ?? 80}%
                    </span>
                  </div>
                  <div className="w-full bg-zinc-200 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-emerald-500 h-full transition-all"
                      style={{ width: `${atsReport.selfProjectsAudit?.score ?? 80}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                    <span>
                      {atsReport.selfProjectsAudit?.hasWorkingLinks ? 'Live link verified' : 'Complexity check'} &bull; Tutorial penalty check
                    </span>
                    <span>10% Weight</span>
                  </div>
                </div>

                {/* 4. STAR Action Verbs (15%) */}
                <div className="p-2.5 rounded-lg bg-zinc-50 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                      <Flame className="w-3.5 h-3.5 text-amber-500" />
                      <span>STAR Action Verb Vitality</span>
                    </span>
                    <span className="font-mono font-bold text-zinc-950 dark:text-zinc-50">
                      {atsReport.breakdown.actionVerbVitalityScore ?? 85}%
                    </span>
                  </div>
                  <div className="w-full bg-zinc-200 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-emerald-500 h-full transition-all"
                      style={{ width: `${atsReport.breakdown.actionVerbVitalityScore ?? 85}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                    <span>
                      {atsReport.actionVerbStrength?.strongCount ?? 12} Tier-1 verbs &bull; {atsReport.actionVerbStrength?.weakCount ?? 0} passive phrases
                    </span>
                    <span>15% Weight</span>
                  </div>
                </div>

                {/* 5. Quantifiable Impact & Metrics (15%) */}
                <div className="p-2.5 rounded-lg bg-zinc-50 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Quantifiable Impact Metrics</span>
                    </span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {atsReport.quantificationStats?.percentage ?? 80}%
                    </span>
                  </div>
                  <div className="w-full bg-zinc-200 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-emerald-500 h-full transition-all"
                      style={{ width: `${atsReport.quantificationStats?.percentage ?? 80}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                    <span>
                      {atsReport.quantificationStats?.quantifiedBullets ?? 8} of {atsReport.quantificationStats?.totalBullets ?? 10} bullets with metrics
                    </span>
                    <span>15% Weight</span>
                  </div>
                </div>

                {/* 6. Formatting & Single-Column Layout (5%) */}
                <div className="p-2.5 rounded-lg bg-zinc-50 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-zinc-700 dark:text-zinc-300" />
                      <span>ATS Format & Single Column</span>
                    </span>
                    <span className="font-mono font-bold text-zinc-950 dark:text-zinc-50">
                      {atsReport.breakdown.formattingScore}%
                    </span>
                  </div>
                  <div className="w-full bg-zinc-200 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-emerald-500 h-full transition-all"
                      style={{ width: `${atsReport.breakdown.formattingScore}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                    <span>Linear single-column parseable layout</span>
                    <span>5% Weight</span>
                  </div>
                </div>
              </div>
            </div>

            {/* HackerRank Evaluation Rubric & Verified Evidence */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono uppercase font-bold text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Verified Rubric Findings</span>
                </span>
                <span className="text-[10px] font-mono text-zinc-400">Text-Derivable</span>
              </div>

              {/* Self Projects Evidence Card */}
              {atsReport.selfProjectsAudit && (
                <div className="p-3 rounded-xl bg-zinc-50 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                      <span>💻 Self Projects Audit:</span>
                      <span className="font-mono text-emerald-600 dark:text-emerald-400">
                        {atsReport.selfProjectsAudit.score}/100
                      </span>
                    </span>
                    {atsReport.selfProjectsAudit.hasWorkingLinks ? (
                      <span className="px-1.5 py-0.2 rounded text-[9px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 font-semibold font-mono">
                        🔗 Link Verified
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.2 rounded text-[9px] bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 font-semibold font-mono">
                        ⚠️ No Live URL
                      </span>
                    )}
                  </div>

                  {/* Tutorial Flag Warning Banner */}
                  {atsReport.selfProjectsAudit.tutorialFlags.length > 0 && (
                    <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-[11px] space-y-1">
                      <div className="font-bold flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>Generic Tutorial Phrasing Detected (-25 pts)</span>
                      </div>
                      <p className="text-[10px] leading-relaxed">
                        Flagged: {atsReport.selfProjectsAudit.tutorialFlags.map(f => `"${f}"`).join(', ')}. Replace tutorial coursework clones with original system architectures.
                      </p>
                    </div>
                  )}

                  {/* Complexity Signals */}
                  {atsReport.selfProjectsAudit.complexitySignals.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="text-[10px] text-zinc-400 font-mono">Signals:</span>
                      {atsReport.selfProjectsAudit.complexitySignals.slice(0, 5).map((sig, idx) => (
                        <span key={idx} className="px-1.5 py-0.2 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-[10px] font-mono">
                          {sig}
                        </span>
                      ))}
                    </div>
                  )}

                  <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed italic bg-white dark:bg-[#121215] p-2 rounded-lg border border-zinc-200/70 dark:border-zinc-800/70">
                    {atsReport.selfProjectsAudit.evidence}
                  </p>
                </div>
              )}

              {/* Production Experience Evidence Card */}
              {atsReport.productionExperienceAudit && (
                <div className="p-3 rounded-xl bg-zinc-50 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                      <span>🏢 Production Scale Audit:</span>
                      <span className="font-mono text-emerald-600 dark:text-emerald-400">
                        {atsReport.productionExperienceAudit.score}/100
                      </span>
                    </span>
                    {atsReport.productionExperienceAudit.isProductionHeavy && (
                      <span className="px-1.5 py-0.2 rounded text-[9px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 font-semibold font-mono">
                        🚀 High Production Maturity
                      </span>
                    )}
                  </div>

                  {/* Infra signals chips */}
                  {atsReport.productionExperienceAudit.productionKeywordsFound.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="text-[10px] text-zinc-400 font-mono">Infra:</span>
                      {atsReport.productionExperienceAudit.productionKeywordsFound.slice(0, 5).map((kw, idx) => (
                        <span key={idx} className="px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-mono">
                          {kw}
                        </span>
                      ))}
                    </div>
                  )}

                  <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed italic bg-white dark:bg-[#121215] p-2 rounded-lg border border-zinc-200/70 dark:border-zinc-800/70">
                    {atsReport.productionExperienceAudit.evidence}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Target Role Rubric & STAR Tailoring Diffs */}
        {activeTab === 'role' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            {/* Target Role Selector & Editor */}
            <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase font-bold text-zinc-600 dark:text-zinc-300 flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-zinc-900 dark:text-zinc-100" />
                  <span>Target Role Benchmark</span>
                </span>
                <button
                  type="button"
                  onClick={() => setIsEditingJob(!isEditingJob)}
                  className="text-[11px] font-mono text-zinc-500 hover:text-zinc-900 dark:hover:text-white underline cursor-pointer"
                >
                  {isEditingJob ? 'Cancel' : 'Edit JD'}
                </button>
              </div>

              {isEditingJob ? (
                <div className="space-y-2 pt-1">
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Company"
                      value={customJobCompany}
                      onChange={(e) => setCustomJobCompany(e.target.value)}
                      className="w-full text-xs p-2 rounded-lg bg-white dark:bg-[#121215] border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100"
                    />
                    <input
                      type="text"
                      placeholder="Job Title"
                      value={customJobTitle}
                      onChange={(e) => setCustomJobTitle(e.target.value)}
                      className="w-full text-xs p-2 rounded-lg bg-white dark:bg-[#121215] border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100"
                    />
                  </div>
                  <textarea
                    rows={4}
                    placeholder="Paste job description requirements..."
                    value={customJobDesc}
                    onChange={(e) => setCustomJobDesc(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg bg-white dark:bg-[#121215] border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono resize-none"
                  />
                  <button
                    type="button"
                    onClick={handleSaveJobCalibration}
                    className="w-full py-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 font-bold rounded-lg text-xs transition-colors cursor-pointer shadow-xs"
                  >
                    Calibrate HackerRank Rubric
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-zinc-950 dark:text-zinc-50 font-headline">
                        {currentJob?.company || 'General Tech'}
                      </div>
                      <div className="text-[11px] text-zinc-600 dark:text-zinc-400">
                        {currentJob?.title || targetRole}
                      </div>
                    </div>
                    {onTriggerTailor && (
                      <button
                        type="button"
                        onClick={onTriggerTailor}
                        disabled={isTailorLoading}
                        className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-950 text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all shadow-xs"
                      >
                        {isTailorLoading ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5" />
                        )}
                        <span>{isTailorLoading ? 'Analyzing...' : 'Generate STAR'}</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Missing Critical Skills with 1-Click Canvas Insertion */}
            <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase font-bold text-zinc-600 dark:text-zinc-300">
                  Missing Critical Keywords ({missingKeywords.length})
                </span>
                <span className="text-[10px] font-mono text-zinc-400">1-Click Insert</span>
              </div>

              {missingKeywords.length === 0 ? (
                <div className="p-3 text-center rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-700 dark:text-emerald-400">
                  <Check className="w-4 h-4 mx-auto mb-1" />
                  <span>100% of target role requirements matched in resume!</span>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {missingKeywords.slice(0, 8).map((kw, idx) => (
                    <div 
                      key={idx} 
                      className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-[#121215] border border-zinc-200 dark:border-[#27272A] text-xs"
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"></span>
                        <span className="font-mono text-zinc-900 dark:text-zinc-100 truncate">
                          {kw.keyword}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onInsertKeyword(kw.keyword)}
                        className="px-2 py-1 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-[10px] font-mono rounded cursor-pointer transition-colors shrink-0 flex items-center gap-1"
                        title={`Insert ${kw.keyword} into Technical Skills in canvas`}
                      >
                        <Plus className="w-3 h-3" />
                        <span>Insert</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Matched Keywords Grid */}
            <div className="space-y-1.5">
              <span className="text-xs font-mono text-zinc-500">Matched Competencies ({matchedKeywords.length}):</span>
              <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                {matchedKeywords.map((kw, idx) => (
                  <span 
                    key={idx} 
                    className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-mono font-semibold flex items-center gap-1"
                  >
                    <Check className="w-2.5 h-2.5" />
                    <span>{kw.keyword}</span>
                  </span>
                ))}
              </div>
            </div>

            {/* STAR Method Diffs Suggestions */}
            <div className="space-y-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center justify-between text-xs font-mono text-zinc-500">
                <span>STAR Method Diffs ({pendingDiffs.length}):</span>
                {pendingDiffs.length > 0 && onApplyAllDiffs && (
                  <button
                    type="button"
                    onClick={onApplyAllDiffs}
                    className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline cursor-pointer"
                  >
                    Apply All Diffs
                  </button>
                )}
              </div>

              {pendingDiffs.length === 0 ? (
                <div className="p-3 text-center rounded-xl bg-zinc-50 dark:bg-[#18181B] border border-dashed border-zinc-300 dark:border-zinc-700 text-xs text-zinc-500">
                  <CheckCircle2 className="w-5 h-5 mx-auto mb-1 text-emerald-500" />
                  <span>All bullet points currently match active STAR criteria!</span>
                </div>
              ) : (
                pendingDiffs.map((diff, dIdx) => (
                  <div key={dIdx} className="p-3 rounded-xl bg-zinc-50 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] space-y-2 text-xs">
                    <div className="text-[10px] font-mono font-semibold uppercase text-emerald-600 dark:text-emerald-400">
                      Quantifiable STAR Impact Suggestion:
                    </div>
                    <div className="line-through text-zinc-400 text-[11px] leading-tight">
                      {diff.originalText}
                    </div>
                    <div className="font-medium text-zinc-900 dark:text-zinc-100 leading-snug">
                      • {diff.tailoredText}
                    </div>
                    {onApplyBulletDiff && (
                      <button
                        type="button"
                        onClick={() => onApplyBulletDiff(dIdx)}
                        className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition-colors shadow-xs cursor-pointer"
                      >
                        Apply to Document
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Tab 3: Line Budget & Single Page Capacity */}
        {activeTab === 'budget' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            {/* 1-Page Capacity Gauge */}
            <div className="p-4 rounded-xl bg-zinc-50 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] space-y-3">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="font-bold text-zinc-900 dark:text-zinc-100">1-Page Capacity</span>
                <span className={pageBudgetPercentage <= 100 ? 'text-emerald-500 font-bold' : 'text-amber-500 font-bold'}>
                  {pageBudgetPercentage}%
                </span>
              </div>

              <div className="w-full bg-zinc-200 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${pageBudgetPercentage <= 100 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                  style={{ width: `${Math.min(100, pageBudgetPercentage)}%` }}
                />
              </div>

              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                {pageBudgetPercentage <= 100
                  ? `Optimal line distribution. Your resume fits cleanly onto 1 standard US Letter page with ${linesRemaining} lines of safety buffer.`
                  : `Your document currently spills onto Page 2 by ${Math.abs(linesRemaining)} lines. Enable compact margins (0.5") or edit bullet points to fit.`}
              </p>
            </div>

            {/* Section Line Distribution Table */}
            <div className="space-y-2">
              <span className="text-xs font-mono text-zinc-500">Section Line Distribution:</span>
              <div className="divide-y divide-zinc-200 dark:divide-zinc-800 rounded-xl bg-zinc-50 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] overflow-hidden text-xs font-mono">
                {sectionBreakdown.map((sec, idx) => (
                  <div key={idx} className="flex items-center justify-between px-3 py-2">
                    <span className="text-zinc-800 dark:text-zinc-200 truncate max-w-[180px]">
                      {sec.title}
                    </span>
                    <span className="font-bold text-zinc-600 dark:text-zinc-400">
                      {sec.count} lines
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between px-3 py-2 bg-zinc-100 dark:bg-zinc-800/60 font-bold text-zinc-950 dark:text-zinc-100">
                  <span>Total Document:</span>
                  <span>{lineCount} / {maxRecommendedLines} lines</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};

export default HackerRankAtsPanel;
