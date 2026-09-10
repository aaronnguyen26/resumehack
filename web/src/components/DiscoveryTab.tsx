import React, { useState, useMemo, useEffect } from 'react';
import { JobPosting, ApplicationRecord } from '../types/index.js';
import { enrichJobDetails } from '../services/github-tracker.js';
import {
  Search,
  MapPin,
  DollarSign,
  Sparkles,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  Clock,
  Zap,
  Building2,
  Briefcase,
  GraduationCap,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Bookmark,
  BookmarkCheck,
  Code2,
  ShieldCheck,
  Target,
  X,
  Maximize2,
  BookOpen,
  Lightbulb,
  CheckCircle,
  LayoutGrid,
  Columns2,
  Gift,
  ArrowRight
} from 'lucide-react';

interface DiscoveryTabProps {
  jobs: JobPosting[];
  onSelectJobForTailoring: (job: JobPosting) => void;
  onSyncGitHub: () => Promise<void>;
  isSyncing: boolean;
  syncMessage: string | null;
  lastSyncAt: number | null;
  newJobsCount: number;
  resumeText?: string;
  applications?: ApplicationRecord[];
  onBookmarkJob?: (job: JobPosting) => void;
}

function formatTimeAgo(epochMs: number): string {
  const diffMs = Date.now() - epochMs;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  return `${Math.floor(diffH / 24)}d ago`;
}

function getCompanyAvatarColor(company: string): { bg: string; text: string } {
  const colors = [
    { bg: 'from-zinc-800 to-zinc-950', text: 'text-white' },
    { bg: 'from-emerald-700 to-emerald-950', text: 'text-white' },
    { bg: 'from-zinc-700 to-zinc-900', text: 'text-white' },
    { bg: 'from-amber-600 to-amber-900', text: 'text-white' },
    { bg: 'from-stone-700 to-zinc-900', text: 'text-white' },
    { bg: 'from-neutral-800 to-black', text: 'text-white' },
    { bg: 'from-zinc-900 to-zinc-950', text: 'text-white' },
  ];
  let hash = 0;
  for (let i = 0; i < company.length; i++) {
    hash = (hash << 5) - hash + company.charCodeAt(i);
  }
  const idx = Math.abs(hash) % colors.length;
  return colors[idx];
}

export const DiscoveryTab: React.FC<DiscoveryTabProps> = ({
  jobs,
  onSelectJobForTailoring,
  onSyncGitHub,
  isSyncing,
  syncMessage,
  lastSyncAt,
  newJobsCount,
  resumeText = '',
  applications = [],
  onBookmarkJob,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedType, setSelectedType] = useState<string>('All');
  const [selectedWorkModel, setSelectedWorkModel] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'newest' | 'salary' | 'match' | 'company'>('newest');

  // Active Job in the Horizontal Master-Detail Workbench (Stitch MCP Design 1)
  // When activeWorkbenchJobId is set, layout dynamically transforms into a horizontal dual-pane workbench
  const [activeWorkbenchJobId, setActiveWorkbenchJobId] = useState<string | null>(null);

  // Focused Full Modal state for deep reading
  const [focusedJob, setFocusedJob] = useState<JobPosting | null>(null);

  // Copy feedback toast
  const [copiedJobId, setCopiedJobId] = useState<string | null>(null);
  const [actionToast, setActionToast] = useState<string | null>(null);

  const categories = [
    'All',
    'Verified',
    '⚡ Fresh (< 2m)',
    'New (24h)',
    'Business & Strategy',
    'Finance & Accounting',
    'Marketing & Communications',
    'Humanities & Social Sciences',
    'Policy & Non-Profit',
    'Operations & HR',
    'Design & Creative',
    'Legal & Compliance',
    'Software Engineering',
    'Data & AI',
    'Finance & Quant',
    'Product Management',
    'Hardware & Embedded',
  ];
  const types = ['All', 'Internship', 'New Grad'];
  const workModels = ['All', 'Remote', 'Hybrid', 'On-site'];

  // Keyboard shortcut: Escape collapses the horizontal spec sheet or modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (focusedJob) {
          setFocusedJob(null);
        } else if (activeWorkbenchJobId) {
          setActiveWorkbenchJobId(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeWorkbenchJobId, focusedJob]);

  // Ensure 100% of jobs are completely enriched with all structured details
  const enrichedJobsList = useMemo(() => {
    return jobs.map(j => enrichJobDetails(j));
  }, [jobs]);

  // Currently active job being inspected in the Horizontal Split Workbench
  const activeWorkbenchJob = useMemo(() => {
    if (!activeWorkbenchJobId) return null;
    return enrichedJobsList.find(j => j.id === activeWorkbenchJobId) || null;
  }, [activeWorkbenchJobId, enrichedJobsList]);

  // Calculate Resume Match Score
  const computeJobMatch = (job: JobPosting) => {
    if (!resumeText || resumeText.length < 20) return null;
    const lowerResume = resumeText.toLowerCase();
    const allSkills = job.skills || [];
    if (allSkills.length === 0) return null;

    const matched = allSkills.filter(s => lowerResume.includes(s.toLowerCase().split(' ')[0]));
    const missing = allSkills.filter(s => !lowerResume.includes(s.toLowerCase().split(' ')[0]));
    const score = Math.min(99, Math.max(25, Math.round((matched.length / allSkills.length) * 100)));

    return {
      score,
      matched,
      missing,
      total: allSkills.length,
    };
  };

  const isBookmarked = (job: JobPosting) => {
    return applications.some(
      a => a.company.toLowerCase() === job.company.toLowerCase() && a.title.toLowerCase() === job.title.toLowerCase()
    );
  };

  const handleCopyJobSpec = (job: JobPosting) => {
    const spec = `📋 JOB SPECIFICATION: ${job.title} at ${job.company}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Location: ${job.location} (${job.workModel || 'Hybrid'})
• Compensation: ${job.salaryRange || 'Competitive'}
• Term / Season: ${job.season || job.type}
• Education: ${job.educationRequirements || 'CS / STEM Degree'}
• Sponsorship: ${job.sponsorship || 'Available'}

🏢 ABOUT THE TEAM & MISSION:
${job.aboutTeam || job.aboutCompany || job.description}

⚡ KEY RESPONSIBILITIES (WHAT YOU WILL DO):
${(job.responsibilities || []).map(r => `• ${r}`).join('\n')}

🎯 REQUIREMENTS & QUALIFICATIONS:
${(job.requirements || []).map(r => `• ${r}`).join('\n')}

✨ PREFERRED QUALIFICATIONS:
${(job.preferredQualifications || []).map(p => `• ${p}`).join('\n')}

🛠️ TECH STACK & SKILLS:
${(job.skills || []).join(' · ')}

💎 TOTAL COMPENSATION & PERKS:
${(job.benefits || []).map(b => `• ${b}`).join('\n')}

💡 COMPLETE INTERVIEW PROCESS & PREP TIPS:
${(job.interviewProcess || []).map((s, i) => `${i + 1}. ${s}`).join('\n')}
${(job.prepTips || []).map(t => `💡 Tip: ${t}`).join('\n')}

🔗 Official Application Link: ${job.url}`;

    navigator.clipboard.writeText(spec);
    setCopiedJobId(job.id);
    setActionToast(`✓ Copied full role spec for ${job.company}!`);
    setTimeout(() => {
      setCopiedJobId(null);
      setActionToast(null);
    }, 3000);
  };

  const handleBookmark = (job: JobPosting) => {
    if (onBookmarkJob) {
      onBookmarkJob(job);
      setActionToast(isBookmarked(job) ? '📌 Already in Tracker' : `📌 Bookmarked ${job.company}!`);
      setTimeout(() => setActionToast(null), 3000);
    }
  };

  // Filter and Sort Jobs
  const filteredJobs = useMemo(() => {
    return enrichedJobsList
      .filter(job => {
        const q = searchQuery.toLowerCase().trim();
        const matchesSearch =
          !q ||
          job.title.toLowerCase().includes(q) ||
          job.company.toLowerCase().includes(q) ||
          job.location.toLowerCase().includes(q) ||
          job.description.toLowerCase().includes(q) ||
          (job.skills || []).some(s => s.toLowerCase().includes(q)) ||
          (job.aboutTeam || '').toLowerCase().includes(q) ||
          (job.responsibilities || []).some(r => r.toLowerCase().includes(q)) ||
          (job.requirements || []).some(rq => rq.toLowerCase().includes(q));

        const matchesCategory =
          selectedCategory === 'All' ||
          (selectedCategory === 'Verified'
            ? Boolean(job.isVerified)
            : selectedCategory === '⚡ Fresh (< 2m)'
            ? Boolean((job as any).isUltraFresh || (job as any).isFreshAts || (job.daysAgo ?? 999) === 0)
            : selectedCategory === 'New (24h)'
            ? (job.daysAgo ?? 999) === 0
            : job.category === selectedCategory);

        const matchesType = selectedType === 'All' || job.type === selectedType;

        const matchesWorkModel =
          selectedWorkModel === 'All' ||
          (job.workModel || '').toLowerCase() === selectedWorkModel.toLowerCase();

        return matchesSearch && matchesCategory && matchesType && matchesWorkModel;
      })
      .sort((a, b) => {
        if (sortBy === 'newest') {
          return (a.daysAgo ?? 999) - (b.daysAgo ?? 999);
        }
        if (sortBy === 'company') {
          return a.company.localeCompare(b.company);
        }
        if (sortBy === 'salary') {
          const getSalaryNum = (s?: string) => {
            if (!s) return 0;
            const match = s.match(/\$?(\d+)/);
            return match ? parseInt(match[1], 10) : 0;
          };
          return getSalaryNum(b.salaryRange) - getSalaryNum(a.salaryRange);
        }
        if (sortBy === 'match') {
          const matchA = computeJobMatch(a)?.score ?? 0;
          const matchB = computeJobMatch(b)?.score ?? 0;
          return matchB - matchA;
        }
        return 0;
      });
  }, [enrichedJobsList, searchQuery, selectedCategory, selectedType, selectedWorkModel, sortBy, resumeText]);

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { All: enrichedJobsList.length };
    counts['Verified'] = enrichedJobsList.filter(j => Boolean(j.isVerified)).length;
    counts['⚡ Fresh (< 2m)'] = enrichedJobsList.filter(
      j => (j as any).isUltraFresh || (j as any).isFreshAts || (job => (job.daysAgo ?? 999) === 0)(j)
    ).length;
    counts['New (24h)'] = enrichedJobsList.filter(j => (j.daysAgo ?? 999) === 0).length;
    for (const j of enrichedJobsList) {
      if (j.category) {
        counts[j.category] = (counts[j.category] || 0) + 1;
      }
    }
    return counts;
  }, [enrichedJobsList]);

  return (
    <div className="w-full max-w-[1780px] mx-auto px-1 sm:px-2 md:px-4 py-4 space-y-4">
      {/* Toast Notification */}
      {actionToast && (
        <div className="fixed top-16 left-1/2 transform -translate-x-1/2 z-50 bg-zinc-900 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-xl flex items-center gap-2 border border-zinc-700 animate-in fade-in slide-in-from-top-2">
          <span>{actionToast}</span>
        </div>
      )}

      {/* Header & Sync Bar */}
      <div className="bg-white dark:bg-[#121215] border border-zinc-200 dark:border-[#27272A] rounded-xl p-5 shadow-xs space-y-4 transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <span>Tech Job Discovery &amp; Engineering Workbench</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                {newJobsCount > 0 && (
                  <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-bold">
                    +{newJobsCount} new
                  </span>
                )}
              </h2>
              {activeWorkbenchJobId && (
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                  <Columns2 className="w-3 h-3" />
                  Dual-Pane Workbench Active
                </span>
              )}
            </div>
            <p className="text-[11px] text-zinc-500 flex items-center gap-1 mt-0.5">
              <Clock className="w-3 h-3 shrink-0" />
              {lastSyncAt
                ? `Last synced ${formatTimeAgo(lastSyncAt)} · Click any role title or 'View Specs' to activate horizontal workbench`
                : "Click any role title or View Specs to activate the horizontal dual-pane engineering workbench"}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {activeWorkbenchJobId && (
              <button
                onClick={() => setActiveWorkbenchJobId(null)}
                className="px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-mono font-semibold flex items-center gap-1.5 transition-all cursor-pointer border border-zinc-200 dark:border-zinc-700 shadow-2xs"
                title="Collapse workbench back to full catalog grid view"
              >
                <LayoutGrid className="w-3.5 h-3.5 text-zinc-500" />
                <span>Full Catalog Grid</span>
                <span className="text-[10px] text-zinc-400">[Esc]</span>
              </button>
            )}

            <button
              onClick={onSyncGitHub}
              disabled={isSyncing}
              className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-950 text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-all shrink-0 cursor-pointer disabled:opacity-50"
              title="Fetch latest open engineering roles from verified boards"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-emerald-400' : ''}`} />
              <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
            </button>
          </div>
        </div>

        {syncMessage && (
          <div
            className={`p-2.5 rounded-lg text-xs flex items-center gap-2 ${
              syncMessage.startsWith('⚠️')
                ? 'bg-rose-500/10 border border-rose-500/20 text-rose-800 dark:text-rose-200'
                : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-200'
            }`}
          >
            {syncMessage.startsWith('⚠️') ? (
              <span className="shrink-0">⚠️</span>
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            )}
            <span>{syncMessage.replace('⚠️ ', '')}</span>
          </div>
        )}

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 transform -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search role, company, skills, or responsibilities... (e.g. Go, Distributed Systems, Kafka)"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-9 py-2 bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-500 dark:focus:border-zinc-400 transition-colors font-mono"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Category Pills */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {categories.map(cat => {
            const count = categoryCounts[cat] || 0;
            const isFreshPill = cat === '⚡ Fresh (< 2m)';
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                  selectedCategory === cat
                    ? isFreshPill
                      ? 'bg-emerald-600 text-white shadow-xs font-semibold'
                      : cat === 'New (24h)'
                      ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 font-bold shadow-xs'
                      : 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 font-bold shadow-xs'
                    : isFreshPill
                    ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-500/20 font-bold'
                    : 'bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/60 dark:border-zinc-700/60 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                }`}
              >
                <span>{cat === 'New (24h)' ? '🔥 New (24h)' : cat}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    selectedCategory === cat 
                      ? 'bg-white/20 dark:bg-black/20 text-inherit' 
                      : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Sub-Filters & View Mode Controls */}
        <div className="flex items-center justify-between gap-2 pt-1 text-xs flex-wrap bg-zinc-50 dark:bg-zinc-900/50 p-2.5 rounded-lg border border-zinc-200/80 dark:border-zinc-800">
          {/* Type Filter */}
          <div className="flex gap-1.5 items-center">
            <span className="text-[10px] uppercase font-mono font-bold text-zinc-400 mr-1">Type:</span>
            {types.map(type => (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                  selectedType === type
                    ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 font-bold shadow-xs'
                    : 'bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700'
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          {/* Work Model Filter */}
          <div className="flex gap-1.5 items-center">
            <span className="text-[10px] uppercase font-mono font-bold text-zinc-400 mr-1">Model:</span>
            {workModels.map(model => (
              <button
                key={model}
                onClick={() => setSelectedWorkModel(model)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                  selectedWorkModel === model
                    ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 font-bold shadow-xs'
                    : 'bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700'
                }`}
              >
                {model}
              </button>
            ))}
          </div>

          {/* Layout Mode Indicator */}
          <div className="flex items-center gap-1.5 ml-auto">
            {activeWorkbenchJobId ? (
              <button
                onClick={() => setActiveWorkbenchJobId(null)}
                className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-md bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors shadow-2xs cursor-pointer font-mono"
                title="Switch back to standard 3-column catalog grid"
              >
                <LayoutGrid className="w-3.5 h-3.5 text-zinc-500" />
                <span>Restore Grid View [Esc]</span>
              </button>
            ) : (
              <span className="text-[11px] text-zinc-500 font-mono flex items-center gap-1.5">
                <Columns2 className="w-3.5 h-3.5 text-zinc-400" />
                <span>Click any role to expand horizontal workbench</span>
              </span>
            )}
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase font-mono font-bold text-zinc-400">Sort:</span>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-semibold rounded-md px-2 py-1 focus:outline-none focus:border-zinc-500 cursor-pointer shadow-2xs font-mono"
            >
              <option value="newest">🔥 Newest</option>
              <option value="salary">💰 Top Pay</option>
              <option value="match">🎯 Best ATS Match</option>
              <option value="company">🏢 Company (A-Z)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Quick Target Inspector Ribbon (Horizontal Rapid Preview) */}
      <div className="bg-white dark:bg-[#121215] border border-zinc-200 dark:border-[#27272A] rounded-xl p-3 sm:p-3.5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 shrink-0">
          <Sparkles className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          <span className="text-[11px] font-bold uppercase tracking-wider font-mono text-zinc-500 dark:text-zinc-400">
            Quick Spec Inspector:
          </span>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
          {filteredJobs.slice(0, 7).map(targetJob => {
            const match = computeJobMatch(targetJob);
            const isTargetActive = targetJob.id === activeWorkbenchJobId;
            return (
              <button
                key={targetJob.id}
                type="button"
                onClick={() => {
                  if (activeWorkbenchJobId === targetJob.id) {
                    setActiveWorkbenchJobId(null);
                  } else {
                    setActiveWorkbenchJobId(targetJob.id);
                  }
                }}
                className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer border font-mono ${
                  isTargetActive
                    ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 border-emerald-500 dark:border-emerald-500 ring-1 ring-emerald-500/40 shadow-xs'
                    : 'bg-zinc-50 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600'
                }`}
              >
                <span className="truncate max-w-[130px]">{targetJob.company}</span>
                {match && (
                  <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-bold ${
                    isTargetActive
                      ? 'bg-emerald-500 text-white'
                      : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
                  }`}>
                    {match.score}%
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Results Count & Match Tip */}
      <div className="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400 px-0.5 font-mono">
        <span className="font-semibold text-zinc-700 dark:text-zinc-300">
          Showing {filteredJobs.length} opening{filteredJobs.length === 1 ? '' : 's'} · {activeWorkbenchJobId ? 'Dual-Pane Horizontal Workbench Mode' : '3-Column Catalog Grid'}
        </span>
        {resumeText && resumeText.length > 20 && (
          <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
            <CheckCircle className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            Resume Matching Active
          </span>
        )}
      </div>

      {/* ── CORE TRANSFORMATION: HORIZONTAL SPLIT WORKBENCH VS FULL CATALOG GRID ── */}
      {activeWorkbenchJob ? (
        /* ═════════════════════════════════════════════════════════════════════════════
           MODE B: HORIZONTAL DUAL-PANE WORKBENCH (STITCH MCP DESIGN 1 WINNER)
           Left 35%: High-Density Job Stream
           Right 65%: Expansive Horizontal Engineering Spec Sheet Card
           ═════════════════════════════════════════════════════════════════════════════ */
        <div className="flex flex-col lg:flex-row gap-4 items-start animate-in fade-in duration-200">
          
          {/* PANE 1: LEFT MASTER JOB STREAM (35% Width) */}
          <div className="w-full lg:w-[35%] xl:w-[32%] flex flex-col gap-2 shrink-0 max-h-[calc(100vh-140px)] overflow-y-auto pr-1">
            {/* Stream Header Bar */}
            <div className="p-3 rounded-xl bg-white dark:bg-[#121215] border border-zinc-200 dark:border-[#27272A] flex items-center justify-between shadow-2xs">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-mono font-bold text-zinc-900 dark:text-zinc-100">
                  ACTIVE STREAM [{filteredJobs.length}]
                </span>
              </div>
              <button
                onClick={() => setActiveWorkbenchJobId(null)}
                className="text-[11px] font-mono text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 flex items-center gap-1 transition-colors cursor-pointer"
                title="Collapse workbench back to full catalog grid"
              >
                <span>Full Grid</span>
                <span className="text-[10px] text-zinc-400">[Esc]</span>
              </button>
            </div>

            {/* Stream Job Cards */}
            <div className="space-y-2">
              {filteredJobs.map(job => {
                const isSelected = job.id === activeWorkbenchJobId;
                const matchInfo = computeJobMatch(job);
                const avatarColors = getCompanyAvatarColor(job.company);
                const bookmarked = isBookmarked(job);

                return (
                  <div
                    key={job.id}
                    onClick={() => setActiveWorkbenchJobId(job.id)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer relative group ${
                      isSelected
                        ? 'bg-zinc-100/90 dark:bg-[#18181b] border-emerald-500 dark:border-emerald-500 ring-2 ring-emerald-500/30 shadow-sm'
                        : 'bg-white dark:bg-[#121215] border-zinc-200 dark:border-[#27272A] hover:border-zinc-400 dark:hover:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-900/60'
                    }`}
                  >
                    {/* Selected Active Indicator Strip */}
                    {isSelected && (
                      <div className="absolute left-0 top-3 bottom-3 w-1 bg-emerald-500 rounded-r" />
                    )}

                    {/* Top Row: Company & Badges */}
                    <div className="flex items-center justify-between gap-1.5 mb-1.5 pl-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className={`w-6 h-6 rounded-md bg-gradient-to-br ${avatarColors.bg} ${avatarColors.text} flex items-center justify-center font-bold text-[10px] shrink-0`}
                        >
                          {job.company.slice(0, 2).toUpperCase()}
                        </div>
                        <span className="font-bold text-xs text-zinc-900 dark:text-zinc-100 truncate">
                          {job.company}
                        </span>
                        {job.isVerified && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                            Verified
                          </span>
                        )}
                      </div>

                      {matchInfo && (
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                          {matchInfo.score}%
                        </span>
                      )}
                    </div>

                    {/* Role Title */}
                    <h4 className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate pl-1.5 group-hover:text-zinc-950 dark:group-hover:text-white transition-colors">
                      {job.title}
                    </h4>

                    {/* Compensation & Location */}
                    <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-500 dark:text-zinc-400 mt-1 pl-1.5 flex-wrap">
                      <span className="text-emerald-700 dark:text-emerald-400 font-bold">
                        {job.salaryRange || 'Competitive Pay'}
                      </span>
                      <span>•</span>
                      <span className="truncate">{job.location}</span>
                    </div>

                    {/* Tech Stack Mini Tags */}
                    {job.skills && job.skills.length > 0 && (
                      <div className="flex gap-1 overflow-hidden mt-2 pl-1.5">
                        {job.skills.slice(0, 3).map(skill => (
                          <span
                            key={skill}
                            className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200/60 dark:border-zinc-700/60 truncate"
                          >
                            {skill}
                          </span>
                        ))}
                        {job.skills.length > 3 && (
                          <span className="text-[9px] font-mono text-zinc-400">
                            +{job.skills.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* PANE 2: EXPANSIVE HORIZONTAL SPEC SHEET CARD (65% Width) */}
          <div className="w-full lg:w-[65%] xl:w-[68%] bg-white dark:bg-[#121215] border border-zinc-200 dark:border-[#27272A] rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col gap-5 sticky top-4 max-h-[calc(100vh-140px)] overflow-y-auto">
            
            {/* Spec Sheet Header Navigation Bar */}
            <div className="flex items-center justify-between pb-3.5 border-b border-zinc-200 dark:border-[#27272A] flex-wrap gap-2">
              <div className="flex items-center gap-2 font-mono text-xs text-zinc-500">
                <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  ENGINEERING SPEC SHEET
                </span>
                <span className="text-zinc-300 dark:text-zinc-700">//</span>
                <span className="text-zinc-700 dark:text-zinc-300 font-bold">{activeWorkbenchJob.company}</span>
                <span className="text-zinc-300 dark:text-zinc-700">//</span>
                <span className="text-zinc-400 truncate max-w-[200px]">REQ-{activeWorkbenchJob.id.slice(0, 8)}</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setFocusedJob(activeWorkbenchJob)}
                  className="px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-xs font-mono text-zinc-600 dark:text-zinc-300 flex items-center gap-1.5 transition-colors cursor-pointer border border-zinc-200 dark:border-zinc-700"
                  title="Open in distraction-free fullscreen reader"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Fullscreen</span>
                </button>

                <button
                  onClick={() => setActiveWorkbenchJobId(null)}
                  className="px-3 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-xs font-mono font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5 transition-colors cursor-pointer border border-zinc-200 dark:border-zinc-700"
                  title="Close specs and return to 3-column grid"
                >
                  <span>Close Specs</span>
                  <span className="text-[10px] text-zinc-400">[Esc]</span>
                </button>
              </div>
            </div>

            {/* Role Header & Compensation Bracket Bento */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-50 dark:bg-[#18181b] p-4 sm:p-5 rounded-xl border border-zinc-200 dark:border-zinc-800">
              <div className="space-y-1.5 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <div
                    className={`w-7 h-7 rounded-lg bg-gradient-to-br ${getCompanyAvatarColor(activeWorkbenchJob.company).bg} ${getCompanyAvatarColor(activeWorkbenchJob.company).text} flex items-center justify-center font-bold text-xs shrink-0`}
                  >
                    {activeWorkbenchJob.company.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                    {activeWorkbenchJob.company}
                  </span>
                  {activeWorkbenchJob.isVerified && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1 shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Verified Role &amp; Comp
                    </span>
                  )}
                  {activeWorkbenchJob.category && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-zinc-200/70 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                      {activeWorkbenchJob.category}
                    </span>
                  )}
                </div>

                <h1 className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
                  {activeWorkbenchJob.title}
                </h1>

                <div className="flex items-center gap-2 text-xs font-mono text-zinc-500 dark:text-zinc-400 flex-wrap">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-zinc-400" />
                    {activeWorkbenchJob.location}
                  </span>
                  <span>•</span>
                  <span>{activeWorkbenchJob.workModel || 'Hybrid'}</span>
                  <span>•</span>
                  <span>{activeWorkbenchJob.season || activeWorkbenchJob.type}</span>
                  <span>•</span>
                  <span className="text-zinc-400">{activeWorkbenchJob.educationRequirements || 'CS / STEM Degree'}</span>
                </div>
              </div>

              {/* Compensation Bracket Box */}
              <div className="p-3.5 bg-white dark:bg-[#121215] rounded-xl border border-zinc-200 dark:border-zinc-800 text-right min-w-[220px] shrink-0 shadow-2xs">
                <span className="text-[10px] font-mono uppercase text-zinc-400 font-bold tracking-wider block">
                  Total Baseline Bracket
                </span>
                <span className="text-base sm:text-lg font-mono font-bold text-emerald-600 dark:text-emerald-400 block mt-0.5">
                  {activeWorkbenchJob.salaryRange || 'k - k / yr'}
                </span>
                <span className="text-[10px] font-mono text-zinc-400 block mt-0.5">
                  0.15% - 0.25% Equity • Tier 1
                </span>
              </div>
            </div>

            {/* Primary Interactive Action Row */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-zinc-100 dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-2.5 flex-wrap">
                <button
                  onClick={() => onSelectJobForTailoring(activeWorkbenchJob)}
                  className="px-5 py-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-950 text-xs font-bold font-mono flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-emerald-500" />
                  <span>Tailor Resume to Job [1-Click]</span>
                </button>
                <span className="text-[11px] font-mono text-zinc-400 hidden sm:inline">
                  Generates targeted diff in 4s
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCopyJobSpec(activeWorkbenchJob)}
                  className="px-3 py-2 rounded-lg bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-xs font-semibold font-mono text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5 transition-colors border border-zinc-200 dark:border-zinc-700 cursor-pointer"
                  title="Copy full spec to clipboard"
                >
                  {copiedJobId === activeWorkbenchJob.id ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-zinc-400" />
                      <span>Copy Spec</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => handleBookmark(activeWorkbenchJob)}
                  className={`px-3 py-2 rounded-lg border text-xs font-semibold font-mono flex items-center gap-1.5 transition-colors cursor-pointer ${
                    isBookmarked(activeWorkbenchJob)
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400'
                      : 'bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200'
                  }`}
                  title={isBookmarked(activeWorkbenchJob) ? 'Saved in Pipeline Tracker' : 'Save to Pipeline Tracker'}
                >
                  {isBookmarked(activeWorkbenchJob) ? (
                    <>
                      <BookmarkCheck className="w-3.5 h-3.5 fill-amber-500" />
                      <span>Saved</span>
                    </>
                  ) : (
                    <>
                      <Bookmark className="w-3.5 h-3.5 text-zinc-400" />
                      <span>Bookmark</span>
                    </>
                  )}
                </button>

                <a
                  href={activeWorkbenchJob.url}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3.5 py-2 rounded-lg bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-xs font-semibold font-mono text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5 transition-colors border border-zinc-200 dark:border-zinc-700"
                >
                  <span>Careers Site</span>
                  <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
                </a>
              </div>
            </div>

            {/* ATS Keyword Alignment & Skill Radar Bento */}
            {computeJobMatch(activeWorkbenchJob) ? (
              <div className="p-4 rounded-xl bg-zinc-50 dark:bg-[#151518] border border-zinc-200 dark:border-zinc-800 space-y-3.5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-mono font-bold text-sm flex items-center justify-center">
                      {computeJobMatch(activeWorkbenchJob)!.score}%
                    </span>
                    <div>
                      <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                        <span>ATS Keyword Alignment</span>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      </h3>
                      <p className="text-[10px] text-zinc-400 font-mono">
                        Deterministic keyword match against your active resume
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-1 rounded border border-emerald-500/20">
                    High Confidence ATS Fit
                  </span>
                </div>

                {/* Detected Keywords */}
                <div>
                  <span className="text-[10px] font-mono uppercase text-zinc-400 font-bold tracking-wider block mb-1.5">
                    Keywords Detected in Profile ({computeJobMatch(activeWorkbenchJob)!.matched.length} of {computeJobMatch(activeWorkbenchJob)!.total}):
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {computeJobMatch(activeWorkbenchJob)!.matched.map(kw => (
                      <span
                        key={kw}
                        className="px-2 py-0.5 rounded text-[11px] font-mono bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 flex items-center gap-1 font-semibold"
                      >
                        <Check className="w-3 h-3 text-emerald-500" />
                        <span>{kw}</span>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Missing Keywords Gap Alert */}
                {computeJobMatch(activeWorkbenchJob)!.missing.length > 0 && (
                  <div className="pt-2 border-t border-zinc-200/80 dark:border-zinc-800">
                    <span className="text-[10px] font-mono uppercase text-amber-600 dark:text-amber-400 font-bold tracking-wider block mb-1.5">
                      Target Keyword Gaps ({computeJobMatch(activeWorkbenchJob)!.missing.length}) · 1-Click Tailor can add these:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {computeJobMatch(activeWorkbenchJob)!.missing.map(kw => (
                        <span
                          key={kw}
                          className="px-2 py-0.5 rounded text-[11px] font-mono bg-zinc-200/70 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-700 flex items-center gap-1"
                        >
                          <span className="text-amber-500 font-bold">!</span>
                          <span>{kw}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-[#151518] border border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-xs font-mono text-zinc-500">
                <span className="flex items-center gap-1.5">
                  <Lightbulb className="w-4 h-4 text-emerald-500" />
                  <span>Upload your resume in Document Canvas to unlock real-time deterministic ATS keyword matching &amp; gap alerts.</span>
                </span>
                <span className="text-[10px] text-zinc-400 uppercase font-bold">Algorithmic Rubric</span>
              </div>
            )}

            {/* 3-Column Parallel Horizontal Technical Specs Grid */}
            <div className="space-y-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400 block">
                Target Architecture, Responsibilities &amp; Interview Blueprint
              </span>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                
                {/* Column 1: Domain & Team Mission */}
                <div className="p-4 rounded-xl bg-zinc-50 dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-800 space-y-2.5 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 pb-2 border-b border-zinc-200/80 dark:border-zinc-800">
                      <div className="w-6 h-6 rounded bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-zinc-700 dark:text-zinc-300">
                        <Building2 className="w-3.5 h-3.5" />
                      </div>
                      <h4 className="font-bold text-xs text-zinc-900 dark:text-zinc-100 uppercase tracking-wide font-mono">
                        1. Domain &amp; Mission
                      </h4>
                    </div>
                    <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
                      {activeWorkbenchJob.aboutTeam || activeWorkbenchJob.aboutCompany || activeWorkbenchJob.description || 'Tier-1 software development and engineering team.'}
                    </p>
                  </div>
                  {activeWorkbenchJob.teamHighlights && activeWorkbenchJob.teamHighlights.length > 0 && (
                    <div className="pt-2 border-t border-zinc-200/80 dark:border-zinc-800 space-y-1 text-[11px] text-zinc-600 dark:text-zinc-400 font-mono">
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">Team Highlight:</span>
                      <p>{activeWorkbenchJob.teamHighlights[0]}</p>
                    </div>
                  )}
                </div>

                {/* Column 2: Key Responsibilities */}
                <div className="p-4 rounded-xl bg-zinc-50 dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-800 space-y-2.5 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 pb-2 border-b border-zinc-200/80 dark:border-zinc-800">
                      <div className="w-6 h-6 rounded bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-zinc-700 dark:text-zinc-300">
                        <Briefcase className="w-3.5 h-3.5" />
                      </div>
                      <h4 className="font-bold text-xs text-zinc-900 dark:text-zinc-100 uppercase tracking-wide font-mono">
                        2. Key Deliverables
                      </h4>
                    </div>
                    {activeWorkbenchJob.responsibilities && activeWorkbenchJob.responsibilities.length > 0 ? (
                      <ul className="text-xs text-zinc-700 dark:text-zinc-300 space-y-1.5">
                        {activeWorkbenchJob.responsibilities.slice(0, 3).map((r, i) => (
                          <li key={i} className="flex items-start gap-1.5 leading-snug">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 mt-1.5" />
                            <span>{r}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-zinc-500 italic">Engineering deliverables shared during recruiter screen.</p>
                    )}
                  </div>
                </div>

                {/* Column 3: Interview Blueprint & Prep Tips */}
                <div className="p-4 rounded-xl bg-zinc-50 dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-800 space-y-2.5 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 pb-2 border-b border-zinc-200/80 dark:border-zinc-800">
                      <div className="w-6 h-6 rounded bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-zinc-700 dark:text-zinc-300">
                        <Lightbulb className="w-3.5 h-3.5" />
                      </div>
                      <h4 className="font-bold text-xs text-zinc-900 dark:text-zinc-100 uppercase tracking-wide font-mono">
                        3. Interview Blueprint
                      </h4>
                    </div>
                    {activeWorkbenchJob.interviewProcess && activeWorkbenchJob.interviewProcess.length > 0 ? (
                      <div className="space-y-1 text-xs text-zinc-700 dark:text-zinc-300">
                        {activeWorkbenchJob.interviewProcess.map((step, idx) => (
                          <div key={idx} className="flex items-center gap-2 font-mono text-[11px]">
                            <span className="w-4 h-4 rounded bg-zinc-200 dark:bg-zinc-800 font-bold flex items-center justify-center shrink-0 text-[10px]">
                              {idx + 1}
                            </span>
                            <span className="truncate">{step}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-zinc-500">Standard 3-stage technical coding &amp; architectural assessment.</p>
                    )}
                  </div>
                  {activeWorkbenchJob.prepTips && activeWorkbenchJob.prepTips.length > 0 && (
                    <div className="pt-2 border-t border-zinc-200/80 dark:border-zinc-800 text-[11px] text-zinc-600 dark:text-zinc-400">
                      <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase font-mono">Prep Focus:</span>
                      <p className="mt-0.5 leading-snug">{activeWorkbenchJob.prepTips[0]}</p>
                    </div>
                  )}
                </div>

              </div>
            </div>

            {/* Target Tech Stack & Minimum Requirements */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {/* Stack Pills */}
              <div className="p-4 rounded-xl bg-zinc-50 dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-800 space-y-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                  <Code2 className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Target Tech Stack &amp; Runtimes:</span>
                </span>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {activeWorkbenchJob.skills && activeWorkbenchJob.skills.length > 0 ? (
                    activeWorkbenchJob.skills.map(s => (
                      <span
                        key={s}
                        className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700"
                      >
                        {s}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-zinc-500">Full-stack software engineering primitives</span>
                  )}
                </div>
              </div>

              {/* Requirements */}
              <div className="p-4 rounded-xl bg-zinc-50 dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-800 space-y-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Core Qualifications:</span>
                </span>
                <ul className="text-xs text-zinc-700 dark:text-zinc-300 space-y-1 pt-1">
                  {(activeWorkbenchJob.requirements || []).slice(0, 3).map((req, i) => (
                    <li key={i} className="flex items-start gap-1.5 leading-snug">
                      <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{req}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Total Rewards & Benefits */}
            {activeWorkbenchJob.benefits && activeWorkbenchJob.benefits.length > 0 && (
              <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-800 flex items-center gap-3 flex-wrap">
                <span className="text-[10px] font-mono font-bold uppercase text-zinc-400 flex items-center gap-1 shrink-0">
                  <Gift className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Benefits:</span>
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {activeWorkbenchJob.benefits.slice(0, 4).map((b, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded text-[10px] font-mono bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700"
                    >
                      🎁 {b}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Bottom Spec Footer */}
            <div className="pt-2 border-t border-zinc-200 dark:border-[#27272A] flex items-center justify-between text-[11px] font-mono text-zinc-400">
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                <ShieldCheck className="w-3.5 h-3.5" />
                Verified Spec Architecture
              </span>
              <span>Hotkeys: [Esc] Close • Click Stream to Switch</span>
            </div>

          </div>
        </div>
      ) : (
        /* ═════════════════════════════════════════════════════════════════════════════
           MODE A: DEFAULT 3-COLUMN DISCOVERY CATALOG GRID
           ═════════════════════════════════════════════════════════════════════════════ */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-start animate-in fade-in duration-150">
          {filteredJobs.map(job => {
            const matchInfo = computeJobMatch(job);
            const avatarColors = getCompanyAvatarColor(job.company);
            const bookmarked = isBookmarked(job);

            return (
              <div
                key={job.id}
                id={`job-card-${job.id}`}
                className="bg-white dark:bg-[#121215] rounded-xl border border-zinc-200 dark:border-[#27272A] hover:border-zinc-400 dark:hover:border-zinc-600 hover:shadow-sm transition-all duration-200 overflow-hidden shadow-2xs"
              >
                {/* Card Header & Title Bar */}
                <div className="p-4 space-y-3">
                  {/* Top Row: Company Avatar + Name + Badges + Actions */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-lg bg-gradient-to-br ${avatarColors.bg} ${avatarColors.text} flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs`}
                      >
                        {job.company.slice(0, 2).toUpperCase()}
                      </div>

                      <div className="min-w-0 flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-xs text-zinc-900 dark:text-zinc-100 truncate">
                          {job.company}
                        </span>
                        {job.isVerified && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1 shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Verified
                          </span>
                        )}
                        {job.category && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                            {job.category}
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                          {job.season || job.type}
                        </span>
                        {job.workModel && (
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              job.workModel === 'Remote'
                                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20'
                                : job.workModel === 'Hybrid'
                                ? 'bg-zinc-200/80 dark:bg-zinc-700/80 text-zinc-800 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-600'
                                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                            }`}
                          >
                            {job.workModel === 'Remote' ? '🏠 Remote' : job.workModel === 'Hybrid' ? '🏢 Hybrid' : '📍 On-site'}
                          </span>
                        )}
                        {((job as any).isUltraFresh || (job as any).isFreshAts) && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500 text-white flex items-center gap-0.5 shadow-2xs animate-pulse">
                            <Zap className="w-2.5 h-2.5" /> &lt; 2m ATS
                          </span>
                        )}
                        {(job.daysAgo ?? 999) === 0 && !((job as any).isUltraFresh || (job as any).isFreshAts) && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/20">
                            NEW
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Quick Action Icons */}
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleBookmark(job);
                        }}
                        className={`p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors ${
                          bookmarked ? 'text-amber-500' : 'text-zinc-400 hover:text-zinc-600'
                        }`}
                        title={bookmarked ? 'Bookmarked in Tracker' : 'Bookmark to Application Tracker'}
                      >
                        {bookmarked ? (
                          <BookmarkCheck className="w-4 h-4 fill-amber-500" />
                        ) : (
                          <Bookmark className="w-4 h-4" />
                        )}
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setFocusedJob(job);
                        }}
                        className="p-1.5 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                        title="Open Fullscreen Reader"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                      </button>

                      <a
                        href={job.url}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="p-1.5 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                        title="View on Careers Site"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>

                  {/* Clickable Job Title -> Activates Horizontal Dual-Pane Workbench */}
                  <div
                    onClick={() => setActiveWorkbenchJobId(job.id)}
                    className="cursor-pointer group flex items-start justify-between gap-2 py-0.5"
                    title="Click to activate horizontal engineering workbench"
                  >
                    <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 leading-snug group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                      {job.title}
                    </h3>
                    <span className="text-[10px] font-bold font-mono text-zinc-500 dark:text-zinc-400 shrink-0 flex items-center gap-0.5 opacity-80 group-hover:opacity-100 transition-opacity mt-0.5">
                      <span>Inspect Specs</span>
                      <ArrowRight className="w-3 h-3 text-emerald-500 ml-0.5" />
                    </span>
                  </div>

                  {/* Compact Meta Summary Bar (Location + Pay + ATS Match) */}
                  <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400 flex-wrap font-mono">
                    <div className="flex items-center gap-1 truncate">
                      <MapPin className="w-3 h-3 text-zinc-400 shrink-0" />
                      <span className="truncate">{job.location}</span>
                    </div>

                    <div className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-bold text-xs truncate">
                      <DollarSign className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span className="truncate">{job.salaryRange || 'Competitive Pay'}</span>
                    </div>

                    {matchInfo && (
                      <div className="flex items-center gap-1 text-emerald-800 dark:text-emerald-300 font-bold text-[10px] bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        <span>{matchInfo.score}% Match</span>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons Row */}
                  <div className="flex items-center gap-2 pt-1 font-mono">
                    <button
                      onClick={() => setActiveWorkbenchJobId(job.id)}
                      className="flex-1 py-2 px-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700"
                    >
                      <BookOpen className="w-3.5 h-3.5 text-zinc-500" />
                      <span>View Full Specs</span>
                      <ArrowRight className="w-3 h-3 text-emerald-500 ml-0.5" />
                    </button>

                    <button
                      onClick={() => onSelectJobForTailoring(job)}
                      className="flex-1 py-2 px-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-950 text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Tailor Resume</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Zero Results Feedback */}
      {filteredJobs.length === 0 && (
        <div className="text-center py-16 bg-white dark:bg-[#121215] border border-zinc-200 dark:border-[#27272A] rounded-xl p-8 space-y-3 font-mono">
          <p className="text-sm font-bold text-zinc-700 dark:text-zinc-300">
            No openings match your current search and filter criteria.
          </p>
          <p className="text-xs text-zinc-500">
            Try adjusting your search terms or clearing selected category filters.
          </p>
          <div className="flex items-center justify-center gap-2 pt-2">
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Clear Search
              </button>
            )}
            {selectedCategory !== 'All' && (
              <button
                onClick={() => {
                  setSelectedCategory('All');
                  setSelectedType('All');
                  setSelectedWorkModel('All');
                }}
                className="px-3.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-950 rounded-lg text-xs font-bold cursor-pointer"
              >
                View All Openings
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── FOCUS MODAL / FULL SCREEN READER ─────────────────────────────── */}
      {focusedJob && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#121215] w-full max-w-[1680px] max-h-[92vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-zinc-200 dark:border-zinc-800">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-4 font-mono">
              <div className="flex items-center gap-3.5 min-w-0">
                <div
                  className={`w-10 h-10 rounded-xl bg-gradient-to-br ${getCompanyAvatarColor(focusedJob.company).bg} ${getCompanyAvatarColor(focusedJob.company).text} flex items-center justify-center font-bold text-sm shrink-0 shadow-xs`}
                >
                  {focusedJob.company.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-xs text-zinc-500 dark:text-zinc-400">
                      {focusedJob.company}
                    </span>
                    {focusedJob.isVerified && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1 shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Verified
                      </span>
                    )}
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                      {focusedJob.workModel || 'Hybrid'}
                    </span>
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                      {focusedJob.salaryRange || 'Competitive Pay'}
                    </span>
                  </div>
                  <h3 className="font-bold text-sm sm:text-base text-zinc-900 dark:text-zinc-100 truncate font-sans">
                    {focusedJob.title}
                  </h3>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleCopyJobSpec(focusedJob)}
                  className="px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {copiedJobId === focusedJob.id ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-zinc-400" />
                      <span>Copy Spec</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => setFocusedJob(null)}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                  title="Close specifications"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body: 4-COLUMN HORIZONTAL GRID */}
            <div className="p-6 overflow-y-auto max-h-[calc(92vh-130px)] space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-stretch">
                
                {/* Column 1: Role & Company Overview */}
                <div className="bg-zinc-50 dark:bg-[#151518] border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 flex flex-col justify-between space-y-3.5 shadow-2xs">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 pb-2 border-b border-zinc-200/80 dark:border-zinc-800">
                      <div className="w-6 h-6 rounded bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-zinc-700 dark:text-zinc-300">
                        <Building2 className="w-3.5 h-3.5" />
                      </div>
                      <h4 className="font-bold text-xs text-zinc-900 dark:text-zinc-100 uppercase tracking-wide font-mono">
                        1. Role &amp; Overview
                      </h4>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] font-bold font-mono text-zinc-400 uppercase tracking-wider block">
                        Domain &amp; Mission:
                      </span>
                      <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
                        {focusedJob.aboutTeam || focusedJob.aboutCompany || focusedJob.description || 'Tier-1 software development and engineering team.'}
                      </p>
                    </div>

                    <div className="space-y-1.5 bg-white dark:bg-zinc-900/70 p-3 rounded-lg border border-zinc-200/80 dark:border-zinc-800 text-[11px] font-mono">
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-400 text-[10px]">Location:</span>
                        <span className="font-medium text-zinc-800 dark:text-zinc-200 truncate max-w-[170px]">{focusedJob.location}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-400 text-[10px]">Compensation:</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">{focusedJob.salaryRange || 'Competitive Pay'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-400 text-[10px]">Education:</span>
                        <span className="font-medium text-zinc-800 dark:text-zinc-200 truncate max-w-[170px]">{focusedJob.educationRequirements || 'B.S. / M.S. CS or related'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-400 text-[10px]">Authorization:</span>
                        <span className="font-medium text-zinc-800 dark:text-zinc-200 truncate max-w-[170px]">{focusedJob.sponsorship || 'CPT/OPT / Sponsorship Eligible'}</span>
                      </div>
                    </div>
                  </div>

                  {focusedJob.teamHighlights && focusedJob.teamHighlights.length > 0 && (
                    <div className="pt-2 border-t border-zinc-200/80 dark:border-zinc-800 space-y-1.5">
                      <span className="text-[10px] font-bold font-mono text-emerald-700 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                        <Zap className="w-3 h-3" />
                        <span>Why Team Stands Out</span>
                      </span>
                      <div className="space-y-1 text-[11px] text-zinc-700 dark:text-zinc-300">
                        {focusedJob.teamHighlights.slice(0, 2).map((th, i) => (
                          <div key={i} className="flex items-start gap-1.5 leading-snug">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 mt-1.5" />
                            <span>{th}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Column 2: Core Responsibilities & Impact */}
                <div className="bg-zinc-50 dark:bg-[#151518] border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 flex flex-col justify-between space-y-3.5 shadow-2xs">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 pb-2 border-b border-zinc-200/80 dark:border-zinc-800">
                      <div className="w-6 h-6 rounded bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-zinc-700 dark:text-zinc-300">
                        <Briefcase className="w-3.5 h-3.5" />
                      </div>
                      <h4 className="font-bold text-xs text-zinc-900 dark:text-zinc-100 uppercase tracking-wide font-mono">
                        2. Responsibilities &amp; Impact
                      </h4>
                    </div>

                    <span className="text-[10px] font-bold font-mono text-zinc-400 uppercase tracking-wider block">
                      What You Will Build &amp; Own:
                    </span>

                    {focusedJob.responsibilities && focusedJob.responsibilities.length > 0 ? (
                      <ul className="space-y-2 text-xs text-zinc-700 dark:text-zinc-300">
                        {focusedJob.responsibilities.map((resp, i) => (
                          <li key={i} className="flex items-start gap-2 leading-relaxed bg-white dark:bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-200/60 dark:border-zinc-800/60">
                            <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 dark:bg-zinc-400 shrink-0 mt-1.5" />
                            <span>{resp}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 italic">
                        Specific engineering milestones outlined upon preliminary screen.
                      </p>
                    )}
                  </div>

                  {focusedJob.benefits && focusedJob.benefits.length > 0 && (
                    <div className="pt-2 border-t border-zinc-200/80 dark:border-zinc-800 space-y-1">
                      <span className="text-[10px] font-bold font-mono text-zinc-400 uppercase tracking-wider block">
                        Total Rewards &amp; Perks:
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {focusedJob.benefits.slice(0, 3).map((ben, i) => (
                          <span key={i} className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-200/70 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                            🎁 {ben}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Column 3: Tech Stack & Keyword Alignment */}
                <div className="bg-zinc-50 dark:bg-[#151518] border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 flex flex-col justify-between space-y-3.5 shadow-2xs">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 pb-2 border-b border-zinc-200/80 dark:border-zinc-800">
                      <div className="w-6 h-6 rounded bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-zinc-700 dark:text-zinc-300">
                        <Code2 className="w-3.5 h-3.5" />
                      </div>
                      <h4 className="font-bold text-xs text-zinc-900 dark:text-zinc-100 uppercase tracking-wide font-mono">
                        3. Tech Stack &amp; Skills
                      </h4>
                    </div>

                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold font-mono text-zinc-400 uppercase tracking-wider block">
                        Target Technologies:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {focusedJob.skills && focusedJob.skills.length > 0 ? (
                          focusedJob.skills.map(skill => (
                            <span
                              key={skill}
                              className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold border bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border-zinc-200 dark:border-zinc-700"
                            >
                              {skill}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-zinc-500">General Software Engineering</span>
                        )}
                      </div>
                    </div>

                    {focusedJob.requirements && focusedJob.requirements.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        <span className="text-[10px] font-bold font-mono text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                          <Target className="w-3.5 h-3.5 text-zinc-500" />
                          <span>Minimum Requirements:</span>
                        </span>
                        <ul className="space-y-1 text-[11px] text-zinc-700 dark:text-zinc-300">
                          {focusedJob.requirements.slice(0, 3).map((req, i) => (
                            <li key={i} className="flex items-start gap-1.5 leading-snug">
                              <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                              <span>{req}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {focusedJob.preferredQualifications && focusedJob.preferredQualifications.length > 0 && (
                    <div className="pt-2 border-t border-zinc-200/80 dark:border-zinc-800 space-y-1">
                      <span className="text-[10px] font-bold font-mono text-amber-700 dark:text-amber-400 uppercase tracking-wider block">
                        Preferred &amp; Bonus:
                      </span>
                      <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-snug">
                        ★ {focusedJob.preferredQualifications[0]}
                      </p>
                    </div>
                  )}
                </div>

                {/* Column 4: Interview Blueprint & Prep Tips */}
                <div className="bg-zinc-50 dark:bg-[#151518] border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 flex flex-col justify-between space-y-3.5 shadow-2xs">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 pb-2 border-b border-zinc-200/80 dark:border-zinc-800">
                      <div className="w-6 h-6 rounded bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-zinc-700 dark:text-zinc-300">
                        <Lightbulb className="w-3.5 h-3.5" />
                      </div>
                      <h4 className="font-bold text-xs text-zinc-900 dark:text-zinc-100 uppercase tracking-wide font-mono">
                        4. Interview Blueprint
                      </h4>
                    </div>

                    {focusedJob.interviewProcess && focusedJob.interviewProcess.length > 0 ? (
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-bold font-mono text-zinc-400 uppercase tracking-wider block">
                          Hiring Pipeline Timeline:
                        </span>
                        <div className="space-y-1.5">
                          {focusedJob.interviewProcess.map((step, i) => (
                            <div key={i} className="flex items-start gap-2 text-[11px] text-zinc-800 dark:text-zinc-200 font-mono">
                              <span className="w-4 h-4 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5">
                                {i + 1}
                              </span>
                              <span className="leading-tight">{step}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-zinc-500 font-mono">Standard 3-round technical assessment &amp; behavioral review.</p>
                    )}

                    {focusedJob.prepTips && focusedJob.prepTips.length > 0 && (
                      <div className="pt-1.5 space-y-1">
                        <span className="text-[10px] font-bold font-mono text-amber-700 dark:text-amber-400 uppercase tracking-wider block">
                          💡 Key Focus Areas:
                        </span>
                        <p className="text-[11px] text-zinc-700 dark:text-zinc-300 leading-snug pl-2 border-l-2 border-amber-500">
                          {focusedJob.prepTips[0]}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 pt-2 border-t border-zinc-200/80 dark:border-zinc-800">
                    <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 text-[11px] text-zinc-700 dark:text-zinc-300 leading-snug flex items-start gap-2">
                      <span className="text-emerald-500 shrink-0 font-bold">⚡</span>
                      <span>
                        <strong>Hacky AI Insight:</strong> Focus on architectural clarity and past edge-case resolution.
                      </span>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 px-6 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 flex items-center justify-between gap-3 font-mono">
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span>Verified by ResumeHack Algorithmic Intelligence</span>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={focusedJob.url}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-zinc-200 dark:border-zinc-700"
                >
                  <span>Apply on Careers Portal</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>

                <button
                  onClick={() => {
                    const target = focusedJob;
                    setFocusedJob(null);
                    onSelectJobForTailoring(target);
                  }}
                  className="px-5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-950 text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <span>Tailor Resume</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
