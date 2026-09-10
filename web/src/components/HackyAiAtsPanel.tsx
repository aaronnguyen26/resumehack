import React, { useState, useMemo, useEffect, useCallback } from 'react';
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
  RefreshCw,
  Lightbulb,
  ArrowRight,
  ExternalLink,
  Key,
  Zap,
  RotateCcw,
  CheckCheck,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { AtsScorerService } from '../services/ats-scorer.js';
import { TriVariantService, FramingVariantId } from '../services/tri-variant.js';
import { 
  GeminiRecommendationService, 
  GeminiPersonalizedRecommendation, 
  getStoredGeminiApiKey, 
  setStoredGeminiApiKey,
  testGeminiApiKey 
} from '../services/gemini-recommendations.js';
import { 
  AtsScoreReport, 
  KeywordMatch, 
  TailoredBulletDiff, 
  ApplicantProfile, 
  ScrapedJobData, 
  TailorResumeResponse 
} from '../types/index.js';

export interface HackyAiAtsPanelProps {
  resumeText: string;
  applicantProfile?: ApplicantProfile;
  currentJob?: ScrapedJobData;
  onUpdateCurrentJob?: (job: ScrapedJobData) => void;
  onTriggerTailor?: () => Promise<void>;
  tailorData?: TailorResumeResponse | null;
  isTailorLoading?: boolean;
  targetRole?: string;
  diffs?: TailoredBulletDiff[];
  onApplyBulletDiff?: (diffIndex: number, variantText?: string) => void;
  onApplyAllDiffs?: () => void;
  onInsertKeyword: (keyword: string) => void;
  onInsertBullet?: (bulletText: string, sectionHint?: string) => void;
  onReplaceBulletText?: (originalText: string, newText: string) => void;
  onClose?: () => void;
  lineCount: number;
  maxRecommendedLines: number;
  pageBudgetPercentage: number;
  linesRemaining: number;
  sectionBreakdown: { title: string; count: number }[];
}

type TabMode = 'rubric' | 'recommendations' | 'role';

interface AiRecommendationItem {
  id: string;
  category: 'production' | 'star' | 'projects' | 'keywords' | 'budget';
  title: string;
  impactPts: number;
  priority: 'critical' | 'high' | 'medium';
  description: string;
  suggestedBullets?: string[];
  suggestedKeywords?: string[];
  suggestedActionLabel?: string;
  actionPayload?: string;
  sectionHint?: 'experience' | 'projects' | 'skills';
  isResolved?: boolean;
}

export const HackyAiAtsPanel: React.FC<HackyAiAtsPanelProps> = ({
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
  onInsertBullet,
  onReplaceBulletText,
  onClose,
  lineCount,
  maxRecommendedLines,
  pageBudgetPercentage,
  linesRemaining,
  sectionBreakdown,
}) => {
  const [activeTab, setActiveTab] = useState<TabMode>('recommendations');
  const [isEditingJob, setIsEditingJob] = useState(false);
  const [customJobDesc, setCustomJobDesc] = useState(currentJob?.description || '');
  const [customJobTitle, setCustomJobTitle] = useState(currentJob?.title || targetRole);
  const [customJobCompany, setCustomJobCompany] = useState(currentJob?.company || 'Target Tech Co');
  const [appliedItemIds, setAppliedItemIds] = useState<Record<string, boolean>>({});

  // ── Gemini Recommendation Pipeline State ─────────────────────────────────
  const [geminiApiKey, setGeminiApiKey] = useState<string>(() => getStoredGeminiApiKey());
  const [apiKeyInput, setApiKeyInput] = useState<string>(() => getStoredGeminiApiKey());
  const [isKeyConfigOpen, setIsKeyConfigOpen] = useState(false);
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [keyFeedback, setKeyFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isGeneratingRecs, setIsGeneratingRecs] = useState(false);
  const [geminiRecommendations, setGeminiRecommendations] = useState<GeminiPersonalizedRecommendation[]>([]);
  const [recSource, setRecSource] = useState<'gemini' | 'heuristic_fallback'>('heuristic_fallback');
  const [recModelUsed, setRecModelUsed] = useState<string>('gemini-2.0-flash');
  const [selectedRecCategory, setSelectedRecCategory] = useState<string>('all');

  const triVariantService = useMemo(() => new TriVariantService(), []);
  const [globalVariant, setGlobalVariant] = useState<'primary' | FramingVariantId>('primary');
  const [diffVariants, setDiffVariants] = useState<Record<string, 'primary' | FramingVariantId>>({});

  const handleSelectGlobalVariant = (variantId: 'primary' | FramingVariantId) => {
    setGlobalVariant(variantId);
    const updated: Record<string, 'primary' | FramingVariantId> = {};
    diffs.forEach((d, idx) => {
      updated[d.id || String(idx)] = variantId;
    });
    setDiffVariants(updated);
  };

  const handleSelectDiffVariant = (diffKey: string, variantId: 'primary' | FramingVariantId) => {
    setDiffVariants(prev => ({ ...prev, [diffKey]: variantId }));
  };

  const atsScorer = useMemo(() => new AtsScorerService(), []);

  // Compute live Hacky AI ATS report on every text edit
  const atsReport: AtsScoreReport = useMemo(() => {
    const textToScan = resumeText.trim() ? resumeText : 'Candidate Resume';
    if (currentJob?.description && currentJob.description.trim()) {
      return atsScorer.analyze(textToScan, currentJob.description);
    }
    return atsScorer.auditGeneralAts(textToScan, targetRole || 'Software Engineering');
  }, [resumeText, currentJob?.description, targetRole, atsScorer]);

  const score = atsReport.overallScore;

  // Determine letter grade
  const grade = useMemo(() => {
    if (score >= 90) return 'A+';
    if (score >= 80) return 'A';
    if (score >= 70) return 'B';
    if (score >= 60) return 'C';
    return 'D';
  }, [score]);

  // Determine JD match alignment
  const matchPercentage = useMemo(() => {
    if (atsReport.totalKeywords > 0) {
      return Math.round((atsReport.matchedKeywordsCount / atsReport.totalKeywords) * 100);
    }
    return 100;
  }, [atsReport.totalKeywords, atsReport.matchedKeywordsCount]);

  // Determine Hacky AI hiring bar qualification
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

  // ── Gemini Recommendation Engine Pipeline ────────────────────────────────
  const geminiService = useMemo(() => new GeminiRecommendationService(geminiApiKey), [geminiApiKey]);

  const handleGenerateRecommendations = useCallback(async (forcedKey?: string) => {
    setIsGeneratingRecs(true);
    try {
      const activeKey = forcedKey !== undefined ? forcedKey : geminiApiKey;
      const result = await geminiService.generateRecommendations({
        resumeText: resumeText || 'Software Engineer Candidate',
        jobDescription: currentJob?.description,
        targetRole,
        apiKey: activeKey,
      });

      setGeminiRecommendations(result.recommendations);
      setRecSource(result.source);
      if (result.modelUsed) setRecModelUsed(result.modelUsed);
    } catch (err) {
      console.error('[HackyAiAtsPanel] Recommendation generation failed:', err);
    } finally {
      setIsGeneratingRecs(false);
    }
  }, [resumeText, currentJob?.description, targetRole, geminiApiKey, geminiService]);

  useEffect(() => {
    handleGenerateRecommendations();
  }, [resumeText, currentJob?.description, targetRole]);

  const handleSaveApiKey = async () => {
    const trimmed = apiKeyInput.trim();
    if (!trimmed) {
      setStoredGeminiApiKey('');
      setGeminiApiKey('');
      setKeyFeedback({ type: 'success', message: 'API key removed. Using smart personalized fallback.' });
      setIsKeyConfigOpen(false);
      handleGenerateRecommendations('');
      return;
    }

    setIsTestingKey(true);
    setKeyFeedback(null);
    const testResult = await testGeminiApiKey(trimmed);
    setIsTestingKey(false);

    if (testResult.valid) {
      setStoredGeminiApiKey(trimmed);
      setGeminiApiKey(trimmed);
      setKeyFeedback({ type: 'success', message: 'Gemini 2.0 connected successfully!' });
      setIsKeyConfigOpen(false);
      handleGenerateRecommendations(trimmed);
    } else {
      setKeyFeedback({ type: 'error', message: testResult.error || 'Invalid Gemini API key.' });
    }
  };

  const handleApplyBulletRecommendation = (rec: GeminiPersonalizedRecommendation) => {
    if (onReplaceBulletText && rec.originalText) {
      onReplaceBulletText(rec.originalText, rec.improvedText);
    } else if (onInsertBullet) {
      onInsertBullet(rec.improvedText, rec.sectionHint);
    }
    setAppliedItemIds(prev => ({ ...prev, [rec.id]: true }));
  };

  // Combined recommendations (Gemini + missing keywords from rubric + layout budget warning)
  const allRecommendations: GeminiPersonalizedRecommendation[] = useMemo(() => {
    const list: GeminiPersonalizedRecommendation[] = [...geminiRecommendations];

    // Ensure target role missing keywords from active rubric are present if not covered
    if (missingKeywords.length > 0 && !list.some(r => r.category === 'missing_skills')) {
      const topMissing = missingKeywords.slice(0, 4).map(k => k.keyword);
      list.unshift({
        id: 'rec-missing-keywords',
        category: 'missing_skills',
        title: `Target Role Missing Keywords (${missingKeywords.length})`,
        impactPts: Math.min(20, missingKeywords.length * 4),
        priority: 'critical',
        sectionHint: 'skills',
        originalText: 'Technical skills list currently lacks key target technologies.',
        improvedText: `• Core Technical Competencies: Proficient in ${topMissing.join(', ')} with production deployment experience.`,
        critique: `Automated ATS filters screen for specific skills from the job description. Your resume is missing core requirements: ${topMissing.join(', ')}.`,
        reasoning: 'Directly matching job keywords in the skills section dramatically improves initial ATS parser passes.',
        suggestedKeywords: topMissing,
        suggestedActionLabel: 'Insert Missing Skills',
      });
    }

    // Page budget overflow warning if applicable
    if (pageBudgetPercentage > 100) {
      list.push({
        id: 'rec-page-overflow',
        category: 'production_scale',
        title: `Page 2 Overflow Warning (+${Math.abs(linesRemaining)} lines)`,
        impactPts: 8,
        priority: 'high',
        sectionHint: 'experience',
        originalText: `Document is currently ${lineCount}/${maxRecommendedLines} lines (${pageBudgetPercentage}%).`,
        improvedText: 'Trim bullet wrapping or select 0.5" compact margins to fit cleanly onto 1 page.',
        critique: `Document is ${lineCount}/${maxRecommendedLines} lines (${pageBudgetPercentage}%). Overflowing onto Page 2 introduces parsing risks with automated ATS scanners.`,
        reasoning: 'Single-page resumes maintain the highest recruiter dwell time and prevent split-page parsing errors.',
        suggestedActionLabel: 'Optimal 1-Page Layout Recommended',
      });
    }

    return list;
  }, [geminiRecommendations, missingKeywords, pageBudgetPercentage, lineCount, maxRecommendedLines, linesRemaining]);

  const filteredRecommendations = useMemo(() => {
    if (selectedRecCategory === 'all') return allRecommendations;
    return allRecommendations.filter(r => r.category === selectedRecCategory);
  }, [allRecommendations, selectedRecCategory]);

  // Calculate potential score uplift with Hacky AI
  const potentialScore = useMemo(() => {
    const totalUplift = allRecommendations.reduce((sum, r) => sum + r.impactPts, 0);
    return Math.min(99, score + totalUplift);
  }, [score, allRecommendations]);

  return (
    <aside className="w-full md:w-84 lg:w-96 bg-white dark:bg-[#121215] border-l border-zinc-200 dark:border-[#27272A] flex flex-col shrink-0 shadow-sm transition-all duration-200">
      {/* Panel Header */}
      <div className="p-4 border-b border-zinc-200 dark:border-[#27272A] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 flex items-center justify-center font-bold text-xs font-headline shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-xs font-headline uppercase tracking-wider text-zinc-950 dark:text-zinc-50 leading-none">
              Hacky AI
            </span>
            <span className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400 mt-0.5">
              Autonomous ATS Intelligence & Architecture Engine
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
          onClick={() => setActiveTab('recommendations')}
          className={`flex-1 py-2 text-center border-b-2 transition-colors cursor-pointer relative ${
            activeTab === 'recommendations'
              ? 'border-zinc-900 dark:border-white text-zinc-900 dark:text-white font-bold'
              : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
          }`}
        >
          <span>AI Recommendations</span>
          {allRecommendations.length > 0 && (
            <span className="inline-flex items-center justify-center px-1.5 py-0.2 ml-1 text-[9px] font-mono bg-emerald-500 text-white rounded-full">
              {allRecommendations.length}
            </span>
          )}
        </button>

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
      </div>

      {/* Tab Panels */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* ── TAB 1: AI RECOMMENDATIONS (Primary Tab to Improve ATS Score) ───── */}
        {activeTab === 'recommendations' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            {/* Score Uplift Opportunity Card */}
            <div className="p-4 rounded-xl bg-zinc-50 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Lightbulb className="w-4 h-4 text-emerald-500" />
                  <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                    Hacky AI ATS Optimizer
                  </span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20">
                  +{potentialScore - score} pts Potential
                </span>
              </div>

              <div className="flex items-baseline justify-between pt-1">
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold font-mono text-zinc-950 dark:text-zinc-50">
                      {score}
                    </span>
                    <ArrowRight className="w-4 h-4 text-zinc-400 self-center" />
                    <span className="text-3xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                      {potentialScore}
                    </span>
                    <span className="text-xs font-mono text-zinc-500">/100</span>
                  </div>
                  <div className="text-xs font-headline font-semibold text-zinc-700 dark:text-zinc-300 mt-1">
                    {hiringBar.label}
                  </div>
                </div>
              </div>

              {/* Progress Dual Gauge */}
              <div className="space-y-1.5 pt-1">
                <div className="w-full bg-zinc-200 dark:bg-zinc-800 h-2 rounded-full overflow-hidden flex">
                  <div 
                    className="h-full bg-zinc-900 dark:bg-white transition-all duration-300"
                    style={{ width: `${score}%` }}
                    title={`Current Score: ${score}`}
                  />
                  <div 
                    className="h-full bg-emerald-500/50 transition-all duration-300"
                    style={{ width: `${Math.max(0, potentialScore - score)}%` }}
                    title={`Potential with Hacky AI: ${potentialScore}`}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500">
                  <span>Current: {score}</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">Hacky AI Target: {potentialScore}</span>
                </div>
              </div>

              <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed pt-1 border-t border-zinc-200 dark:border-zinc-800/80">
                Accepting the personalized recommendations below will optimize your resume against automated ATS filters and elevate your profile into the top 5% tier-1 hiring bar.
              </p>
            </div>

            {/* Gemini Intelligence Header & Key Connector */}
            <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {recSource === 'gemini' ? (
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                      <Zap className="w-3 h-3 text-emerald-500" />
                      <span>{recModelUsed || 'Gemini 2.0'} Active</span>
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-700 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-zinc-400" />
                      <span>Personalized Heuristics</span>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleGenerateRecommendations()}
                    disabled={isGeneratingRecs}
                    className="px-2 py-1 text-[11px] font-mono font-medium rounded-md bg-white dark:bg-[#121215] border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                    title="Re-run deep personalization analysis"
                  >
                    <RefreshCw className={`w-3 h-3 ${isGeneratingRecs ? 'animate-spin' : ''}`} />
                    <span>Re-analyze</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsKeyConfigOpen(!isKeyConfigOpen)}
                    className="px-2 py-1 text-[11px] font-mono font-medium rounded-md bg-white dark:bg-[#121215] border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-1 transition-colors cursor-pointer"
                    title="Configure Google Gemini API Key"
                  >
                    <Key className="w-3 h-3 text-amber-500" />
                    <span>{geminiApiKey ? 'API Key' : 'Connect Key'}</span>
                    {isKeyConfigOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                </div>
              </div>

              {/* Collapsible Gemini API Key Form */}
              {isKeyConfigOpen && (
                <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800/80 space-y-2 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-mono font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1">
                      <span>Google Gemini API Key</span>
                      <span className="text-zinc-400 font-normal">(Free at Google AI Studio)</span>
                    </label>
                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:underline flex items-center gap-0.5"
                    >
                      <span>Get Free Key</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>

                  <div className="flex gap-1.5">
                    <input
                      type="password"
                      value={apiKeyInput}
                      onChange={(e) => setApiKeyInput(e.target.value)}
                      placeholder="Paste AIzaSy... key"
                      className="flex-1 px-2.5 py-1.5 text-xs font-mono rounded-md bg-white dark:bg-[#121215] border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                    />
                    <button
                      type="button"
                      onClick={handleSaveApiKey}
                      disabled={isTestingKey}
                      className="px-3 py-1.5 text-xs font-mono font-bold rounded-md bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-100 flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {isTestingKey ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                      <span>{isTestingKey ? 'Testing...' : 'Save'}</span>
                    </button>
                  </div>

                  {keyFeedback && (
                    <div className={`text-[10px] font-mono p-1.5 rounded ${
                      keyFeedback.type === 'success'
                        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
                        : 'bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/20'
                    }`}>
                      {keyFeedback.message}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[10px] font-mono no-scrollbar">
              {[
                { id: 'all', label: `All (${allRecommendations.length})` },
                { id: 'star_quantification', label: 'STAR & Metrics' },
                { id: 'systems_depth', label: 'Systems Depth' },
                { id: 'action_verbs', label: 'Action Verbs' },
                { id: 'missing_skills', label: 'Missing Skills' },
                { id: 'production_scale', label: 'Production' },
              ].map(pill => (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => setSelectedRecCategory(pill.id)}
                  className={`px-2.5 py-1 rounded-full whitespace-nowrap transition-colors cursor-pointer ${
                    selectedRecCategory === pill.id
                      ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 font-bold shadow-xs'
                      : 'bg-zinc-100 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-200 border border-zinc-200/80 dark:border-zinc-700/60'
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>

            {/* Generating Indicator */}
            {isGeneratingRecs && (
              <div className="p-4 rounded-xl bg-zinc-50 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] flex items-center justify-center gap-2.5 text-xs font-mono text-zinc-600 dark:text-zinc-400 animate-pulse">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
                <span>Running Gemini deep resume personalization...</span>
              </div>
            )}

            {/* Recommendations List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase font-bold text-zinc-600 dark:text-zinc-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Personalized Improvements ({filteredRecommendations.length})</span>
                </span>
                <span className="text-[10px] font-mono text-zinc-400">STAR & ATS Aligned</span>
              </div>

              {filteredRecommendations.map((rec) => {
                const isApplied = appliedItemIds[rec.id];

                return (
                  <div 
                    key={rec.id}
                    className="p-3.5 rounded-xl bg-zinc-50 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] space-y-3 shadow-xs transition-all duration-200"
                  >
                    {/* Header Row */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border uppercase ${
                            rec.priority === 'critical'
                              ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20'
                              : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border-zinc-300 dark:border-zinc-700'
                          }`}>
                            {rec.priority}
                          </span>
                          <span className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">
                            +{rec.impactPts} pts
                          </span>
                          <span className="text-[9px] font-mono text-zinc-500 uppercase">
                            [{rec.sectionHint}]
                          </span>
                        </div>
                        <h4 className="text-xs font-bold text-zinc-950 dark:text-zinc-100 leading-snug">
                          {rec.title}
                        </h4>
                      </div>
                    </div>

                    {/* Diagnostic Critique Box */}
                    <div className="p-2.5 rounded-lg bg-zinc-100/70 dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800 text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                      <strong className="text-zinc-900 dark:text-zinc-200">Why Hacky flagged this: </strong>
                      {rec.critique}
                    </div>

                    {/* Interactive Before & After Visual Comparison Box */}
                    <div className="space-y-2 pt-0.5">
                      {/* Before: Current In Your Resume */}
                      {rec.originalText && (
                        <div className="p-2.5 rounded-lg bg-zinc-100 dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800 space-y-1">
                          <div className="text-[10px] font-mono uppercase font-bold text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500" />
                            <span>Current In Your Resume:</span>
                          </div>
                          <div className="text-[11px] text-zinc-700 dark:text-zinc-300 font-mono italic leading-snug">
                            "{rec.originalText}"
                          </div>
                        </div>
                      )}

                      {/* After: Elevated Hacky AI Rewrite */}
                      {rec.improvedText && (
                        <div className="p-2.5 rounded-lg bg-emerald-500/5 dark:bg-emerald-500/5 border border-emerald-500/20 space-y-1">
                          <div className="text-[10px] font-mono uppercase font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-emerald-500" />
                            <span>Suggested Hacky AI Enhancement:</span>
                          </div>
                          <div className="text-[11px] text-zinc-950 dark:text-zinc-50 font-medium leading-snug">
                            {rec.improvedText}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Missing Keywords Action Chips */}
                    {rec.suggestedKeywords && rec.suggestedKeywords.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        <span className="text-[10px] font-mono text-zinc-500">1-Click Insert into Skills:</span>
                        <div className="flex flex-wrap gap-1.5">
                          {rec.suggestedKeywords.map((kw, kIdx) => {
                            const isAdded = appliedItemIds[`${rec.id}-${kw}`];
                            return (
                              <button
                                key={kIdx}
                                type="button"
                                onClick={() => {
                                  onInsertKeyword(kw);
                                  setAppliedItemIds(prev => ({ ...prev, [`${rec.id}-${kw}`]: true }));
                                }}
                                disabled={isAdded}
                                className={`px-2 py-1 rounded text-[10px] font-mono flex items-center gap-1 transition-all cursor-pointer ${
                                  isAdded
                                    ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                                    : 'bg-white dark:bg-[#121215] hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-700 shadow-2xs'
                                }`}
                              >
                                {isAdded ? <Check className="w-2.5 h-2.5 text-emerald-500" /> : <Plus className="w-2.5 h-2.5" />}
                                <span>{kw}</span>
                                {isAdded && <span className="text-[9px] font-bold">Added</span>}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* 1-Click Replace in Resume Button */}
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => handleApplyBulletRecommendation(rec)}
                        disabled={isApplied}
                        className={`w-full py-2 px-3 text-[11px] font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs ${
                          isApplied
                            ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                            : 'bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-950'
                        }`}
                      >
                        {isApplied ? (
                          <>
                            <CheckCheck className="w-3.5 h-3.5 text-emerald-500" />
                            <span>Applied to Document (+{rec.impactPts} pts)</span>
                          </>
                        ) : (
                          <>
                            <Plus className="w-3.5 h-3.5" />
                            <span>{rec.suggestedActionLabel || 'Replace in Resume'}</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Reasoning Footer */}
                    {rec.reasoning && (
                      <div className="text-[10px] font-mono text-zinc-500 pt-0.5 leading-relaxed">
                        💡 {rec.reasoning}
                      </div>
                    )}

                    {/* 1-Page Budget Progress bar inside recommendation card if budget overflow */}
                    {rec.id === 'rec-page-overflow' && (
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center justify-between text-[11px] font-mono">
                          <span className="text-zinc-700 dark:text-zinc-300">Document Line Count:</span>
                          <span className={pageBudgetPercentage <= 100 ? 'text-emerald-500 font-bold' : 'text-amber-500 font-bold'}>
                            {lineCount} / {maxRecommendedLines} lines ({pageBudgetPercentage}%)
                          </span>
                        </div>
                        <div className="w-full bg-zinc-200 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${pageBudgetPercentage <= 100 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                            style={{ width: `${Math.min(100, pageBudgetPercentage)}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

              {/* Verified Layout Guard / Capacity Box */}
              <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] space-y-2.5">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                    <ShieldCheck className={`w-3.5 h-3.5 ${pageBudgetPercentage <= 100 ? 'text-emerald-500' : 'text-amber-500'}`} />
                    <span>Single-Page Capacity Guard</span>
                  </span>
                  <span className={`font-bold ${pageBudgetPercentage <= 100 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                    {pageBudgetPercentage}%
                  </span>
                </div>

                <div className="w-full bg-zinc-200 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${pageBudgetPercentage <= 100 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                    style={{ width: `${Math.min(100, pageBudgetPercentage)}%` }}
                  />
                </div>

                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  {pageBudgetPercentage <= 100
                    ? `Optimal line distribution. Document fits within the 1-page boundary with ${linesRemaining} lines of safety buffer.`
                    : `Document spills onto Page 2 by ${Math.abs(linesRemaining)} lines. Enable compact margins (0.5") or trim wordy bullets.`}
                </p>

                {/* Section breakdown mini table */}
                <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 text-[10px] font-mono space-y-1">
                  {sectionBreakdown.map((sec, idx) => (
                    <div key={idx} className="flex items-center justify-between text-zinc-600 dark:text-zinc-400">
                      <span className="truncate max-w-[180px]">{sec.title}</span>
                      <span>{sec.count} lines</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
        )}

        {/* ── TAB 2: SCORECARD & 6-DIMENSIONAL MATRIX ──────────────────────── */}
        {activeTab === 'rubric' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            {/* Hacky AI Hiring Bar Gauge */}
            <div className="p-4 rounded-xl bg-zinc-50 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-emerald-500" />
                  <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-300">
                    Hacky AI Benchmark
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
                  <span className="text-xs font-mono font-semibold text-zinc-600 dark:text-zinc-400">
                    Grade: <span className="text-emerald-500 font-bold">{grade}</span>
                  </span>
                  <div className="text-[10px] text-zinc-400 font-mono">
                    {matchPercentage}% JD Alignment
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-zinc-200 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-emerald-500 transition-all duration-300"
                  style={{ width: `${score}%` }}
                />
              </div>

              <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed pt-1">
                {hiringBar.summary}
              </p>
            </div>

            {/* 6-Dimensional Competency Matrix */}
            <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] space-y-3">
              <span className="text-xs font-mono uppercase font-bold text-zinc-600 dark:text-zinc-300 flex items-center justify-between">
                <span>6-Dimensional Matrix</span>
                <span className="text-[10px] font-normal text-zinc-400">Weighted Rubric</span>
              </span>

              {/* 1. Hard Skills Match (30%) */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-zinc-700 dark:text-zinc-300">1. Hard Skills Match (30%)</span>
                  <span className="font-bold text-zinc-900 dark:text-zinc-100">
                    {atsReport.breakdown.hardSkillsScore}/100
                  </span>
                </div>
                <div className="w-full bg-zinc-200 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-emerald-500 transition-all duration-300"
                    style={{ width: `${atsReport.breakdown.hardSkillsScore}%` }}
                  />
                </div>
                <div className="text-[10px] text-zinc-400 font-mono">
                  {matchedKeywords.length}/{atsReport.keywords.length} target skills detected in document
                </div>
              </div>

              {/* 2. Production Systems & Scale (15%) */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-zinc-700 dark:text-zinc-300">2. Production Systems (15%)</span>
                  <span className="font-bold text-zinc-900 dark:text-zinc-100">
                    {atsReport.productionExperienceAudit?.score ?? atsReport.breakdown.productionExperienceScore ?? 85}/100
                  </span>
                </div>
                <div className="w-full bg-zinc-200 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-emerald-500 transition-all duration-300"
                    style={{ width: `${atsReport.productionExperienceAudit?.score ?? atsReport.breakdown.productionExperienceScore ?? 85}%` }}
                  />
                </div>
                <div className="text-[10px] text-zinc-400 font-mono">
                  {atsReport.productionExperienceAudit?.productionKeywordsFound.length ?? 0} enterprise infrastructure signals (k8s, AWS, CI/CD, P99)
                </div>
              </div>

              {/* 3. Independent Systems Projects (10%) */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-zinc-700 dark:text-zinc-300">3. Independent Projects (10%)</span>
                  <span className="font-bold text-zinc-900 dark:text-zinc-100">
                    {atsReport.selfProjectsAudit?.score ?? atsReport.breakdown.selfProjectsScore ?? 80}/100
                  </span>
                </div>
                <div className="w-full bg-zinc-200 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-emerald-500 transition-all duration-300"
                    style={{ width: `${atsReport.selfProjectsAudit?.score ?? atsReport.breakdown.selfProjectsScore ?? 80}%` }}
                  />
                </div>
                <div className="text-[10px] text-zinc-400 font-mono">
                  {atsReport.selfProjectsAudit?.hasWorkingLinks ? '✓ Live URLs verified' : '⚠️ Missing live URLs'}
                  {(atsReport.selfProjectsAudit?.tutorialFlags.length ?? 0) > 0 && ' (Tutorial clone flag -25 pts)'}
                </div>
              </div>

              {/* 4. STAR Action Verbs (15%) */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-zinc-700 dark:text-zinc-300">4. STAR Action Verbs (15%)</span>
                  <span className="font-bold text-zinc-900 dark:text-zinc-100">
                    {atsReport.breakdown.actionVerbVitalityScore ?? 85}/100
                  </span>
                </div>
                <div className="w-full bg-zinc-200 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-emerald-500 transition-all duration-300"
                    style={{ width: `${atsReport.breakdown.actionVerbVitalityScore ?? 85}%` }}
                  />
                </div>
                <div className="text-[10px] text-zinc-400 font-mono">
                  {atsReport.actionVerbStrength?.strongCount ?? 8} strong executive verbs (Architected, Engineered, Spearheaded)
                </div>
              </div>

              {/* 5. Quantifiable Impact Metrics (15%) */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-zinc-700 dark:text-zinc-300">5. Quantifiable Metrics (15%)</span>
                  <span className="font-bold text-zinc-900 dark:text-zinc-100">
                    {atsReport.quantificationStats?.percentage ?? atsReport.breakdown.starImpactScore ?? 80}/100
                  </span>
                </div>
                <div className="w-full bg-zinc-200 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-emerald-500 transition-all duration-300"
                    style={{ width: `${atsReport.quantificationStats?.percentage ?? atsReport.breakdown.starImpactScore ?? 80}%` }}
                  />
                </div>
                <div className="text-[10px] text-zinc-400 font-mono">
                  {atsReport.quantificationStats?.quantifiedBullets ?? 4} metrics detected (percentages, latency, revenue, scale)
                </div>
              </div>

              {/* 6. ATS Single-Column Layout (5%) */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-zinc-700 dark:text-zinc-300">6. Single-Column Layout (5%)</span>
                  <span className="font-bold text-zinc-900 dark:text-zinc-100">
                    {atsReport.breakdown.formattingScore}/100
                  </span>
                </div>
                <div className="w-full bg-zinc-200 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-emerald-500 transition-all duration-300"
                    style={{ width: `${atsReport.breakdown.formattingScore}%` }}
                  />
                </div>
                <div className="text-[10px] text-zinc-400 font-mono">
                  ✓ Clean ATS single-column structure
                </div>
              </div>
            </div>

            {/* Hacky AI Verification Rubric & Evidence */}
            <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] space-y-3">
              <span className="text-xs font-mono uppercase font-bold text-zinc-600 dark:text-zinc-300 flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-zinc-900 dark:text-zinc-100" />
                <span>Hacky AI Audits & Evidence</span>
              </span>

              {/* Self Projects Audit */}
              {atsReport.selfProjectsAudit && (
                <div className="p-2.5 rounded-lg bg-zinc-100/70 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between font-semibold text-zinc-900 dark:text-zinc-100">
                    <span className="flex items-center gap-1.5">
                      <span>🛠️ Self Projects Audit:</span>
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

                  {/* Tutorial clone warnings */}
                  {atsReport.selfProjectsAudit.tutorialFlags.length > 0 && (
                    <div className="p-1.5 rounded bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-700 dark:text-amber-400 font-mono">
                      ⚠️ Generic Tutorial Phrasing Detected (-25 pts): {atsReport.selfProjectsAudit.tutorialFlags.join(', ')}
                    </div>
                  )}

                  {/* Complexity signals */}
                  {atsReport.selfProjectsAudit.complexitySignals.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="text-[10px] text-zinc-400 font-mono">Signals:</span>
                      {atsReport.selfProjectsAudit.complexitySignals.map((sig, idx) => (
                        <span key={idx} className="px-1.5 py-0.2 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-[10px] font-mono">
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

              {/* Production Scale Audit */}
              {atsReport.productionExperienceAudit && (
                <div className="p-2.5 rounded-lg bg-zinc-100/70 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between font-semibold text-zinc-900 dark:text-zinc-100">
                    <span className="flex items-center gap-1.5">
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

        {/* ── TAB 3: TARGET ROLE BENCHMARK & STAR TAILORING ─────────────────── */}
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
                    Calibrate Hacky AI Rubric
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

            {/* STAR Method & Tri-Variant Role Framing Diffs Suggestions */}
            <div className="space-y-3 pt-2 border-t border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center justify-between text-xs font-mono text-zinc-500">
                <span>Tailored Role Diffs ({pendingDiffs.length}):</span>
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

              {pendingDiffs.length > 0 && (
                <div className="p-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-mono text-zinc-600 dark:text-zinc-400">
                    <span className="font-semibold uppercase tracking-wider">Role Framing Persona:</span>
                    <span className="text-[10px] text-zinc-500">All Bullets</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1">
                    {[
                      { id: 'primary', label: 'STAR Base' },
                      { id: 'systemsDepth', label: 'Systems Depth' },
                      { id: 'scaleImpact', label: 'Scale & Impact' },
                      { id: 'velocityMvp', label: 'Velocity & MVP' }
                    ].map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleSelectGlobalVariant(p.id as any)}
                        className={`px-1.5 py-1 text-[10px] font-mono font-semibold rounded-md border transition-colors cursor-pointer ${
                          globalVariant === p.id
                            ? 'bg-zinc-950 text-white dark:bg-zinc-100 dark:text-zinc-950 border-zinc-950 dark:border-zinc-100'
                            : 'bg-white dark:bg-[#121215] text-zinc-700 dark:text-zinc-300 border-zinc-300 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-800'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {pendingDiffs.length === 0 ? (
                <div className="p-3 text-center rounded-xl bg-zinc-50 dark:bg-[#18181B] border border-dashed border-zinc-300 dark:border-zinc-700 text-xs text-zinc-500">
                  <CheckCircle2 className="w-5 h-5 mx-auto mb-1 text-emerald-500" />
                  <span>All bullet points currently match active STAR criteria!</span>
                </div>
              ) : (
                pendingDiffs.map((diff, dIdx) => {
                  const diffKey = diff.id || String(dIdx);
                  const activeVariantId = diffVariants[diffKey] || globalVariant;
                  const variants = triVariantService.getAllVariants(diff);
                  const activeText = activeVariantId === 'primary' 
                    ? diff.tailoredText 
                    : variants[activeVariantId as FramingVariantId].text;
                  const charCount = activeText.length;
                  const lineEstimate = Math.max(1, Math.ceil(charCount / 95));

                  return (
                    <div key={diffKey} className="p-3 rounded-xl bg-zinc-50 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] space-y-2.5 text-xs shadow-2xs">
                      <div className="flex items-center justify-between">
                        <div className="text-[10px] font-mono font-semibold uppercase text-emerald-600 dark:text-emerald-400">
                          {activeVariantId === 'primary' ? 'STAR Optimization' : variants[activeVariantId as FramingVariantId].label}
                        </div>
                        <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded border ${
                          lineEstimate === 1
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20'
                        }`}>
                          {charCount} chars • {lineEstimate} line{lineEstimate > 1 ? 's' : ''}
                        </span>
                      </div>

                      {/* Variant Selection Chips */}
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleSelectDiffVariant(diffKey, 'primary')}
                          className={`px-1.5 py-0.5 rounded text-[9px] font-mono border transition-colors cursor-pointer ${
                            activeVariantId === 'primary'
                              ? 'bg-zinc-900 text-white dark:bg-zinc-200 dark:text-zinc-900 border-zinc-900 dark:border-zinc-200'
                              : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-zinc-400'
                          }`}
                        >
                          STAR Base
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSelectDiffVariant(diffKey, 'systemsDepth')}
                          className={`px-1.5 py-0.5 rounded text-[9px] font-mono border transition-colors cursor-pointer ${
                            activeVariantId === 'systemsDepth'
                              ? 'bg-zinc-900 text-white dark:bg-zinc-200 dark:text-zinc-900 border-zinc-900 dark:border-zinc-200'
                              : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-zinc-400'
                          }`}
                        >
                          Systems Depth
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSelectDiffVariant(diffKey, 'scaleImpact')}
                          className={`px-1.5 py-0.5 rounded text-[9px] font-mono border transition-colors cursor-pointer ${
                            activeVariantId === 'scaleImpact'
                              ? 'bg-zinc-900 text-white dark:bg-zinc-200 dark:text-zinc-900 border-zinc-900 dark:border-zinc-200'
                              : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-zinc-400'
                          }`}
                        >
                          Scale & Impact
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSelectDiffVariant(diffKey, 'velocityMvp')}
                          className={`px-1.5 py-0.5 rounded text-[9px] font-mono border transition-colors cursor-pointer ${
                            activeVariantId === 'velocityMvp'
                              ? 'bg-zinc-900 text-white dark:bg-zinc-200 dark:text-zinc-900 border-zinc-900 dark:border-zinc-200'
                              : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-zinc-400'
                          }`}
                        >
                          Velocity & MVP
                        </button>
                      </div>

                      <div className="line-through text-zinc-400 text-[11px] leading-tight">
                        {diff.originalText}
                      </div>
                      <div className="font-medium text-zinc-900 dark:text-zinc-100 leading-snug">
                        • {activeText}
                      </div>
                      {onApplyBulletDiff && (
                        <button
                          type="button"
                          onClick={() => onApplyBulletDiff(dIdx, activeText)}
                          className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition-colors shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <Check className="w-3 h-3" />
                          <span>Apply to Document</span>
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};

export default HackyAiAtsPanel;
