import React, { useState, useMemo } from 'react';
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
  SlidersHorizontal,
  Code2,
  ShieldCheck,
  Target,
  X,
  Maximize2,
  BookOpen,
  Lightbulb,
  CheckCircle,
  FileText,
  Eye,
  EyeOff
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
  
  // Controls whether all role specs are expanded by default (default false for clean, title-focused UI)
  const [expandAll, setExpandAll] = useState<boolean>(false);
  const [expandedJobIds, setExpandedJobIds] = useState<Set<string>>(new Set());
  
  // Focused Full Modal state
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

  // Ensure 100% of jobs are completely enriched with all structured details
  const enrichedJobsList = useMemo(() => {
    return jobs.map(j => enrichJobDetails(j));
  }, [jobs]);

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

  const toggleExpand = (jobId: string) => {
    setExpandedJobIds(prev => {
      const next = new Set(prev);
      if (expandAll) {
        if (next.has(jobId)) next.delete(jobId);
        else next.add(jobId);
      } else {
        if (next.has(jobId)) next.delete(jobId);
        else next.add(jobId);
      }
      return next;
    });
  };

  const isCardExpanded = (jobId: string) => {
    if (expandAll) {
      return !expandedJobIds.has(jobId);
    }
    return expandedJobIds.has(jobId);
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
      setActionToast(isBookmarked(job) ? `📌 Already in Tracker` : `📌 Bookmarked ${job.company}!`);
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
            const match = s.match(/\$(\d+)/);
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
      j => (j as any).isUltraFresh || (j as any).isFreshAts || (j.daysAgo ?? 999) === 0
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
            <h2 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <span>Full Role Explorer &amp; Live Database</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              {newJobsCount > 0 && (
                <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-bold">
                  +{newJobsCount} new
                </span>
              )}
            </h2>
            <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
              <Clock className="w-3 h-3 shrink-0" />
              {lastSyncAt
                ? `Last synced ${formatTimeAgo(lastSyncAt)} · Click any role title for full specifications`
                : 'Click any role title to view full specifications, interview guide & prep tips'}
            </p>
          </div>

          <button
            onClick={onSyncGitHub}
            disabled={isSyncing}
            className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-950 text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-all shrink-0 cursor-pointer disabled:opacity-50"
            title="Fetch latest open internships from GitHub"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-emerald-400' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
          </button>
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
            placeholder="Search role, company, skills, or responsibilities..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-9 py-2 bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-500 dark:focus:border-zinc-400 transition-colors"
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

          {/* Expand All Toggle */}
          <button
            onClick={() => {
              setExpandAll(!expandAll);
              setExpandedJobIds(new Set());
            }}
            className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-md bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors ml-auto shadow-2xs cursor-pointer"
            title="Toggle showing full details on all cards"
          >
            {expandAll ? <EyeOff className="w-3.5 h-3.5 text-zinc-400" /> : <Eye className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-300" />}
            <span>{expandAll ? 'Collapse Specs' : 'Expand All Specs'}</span>
          </button>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase font-mono font-bold text-zinc-400">Sort:</span>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-semibold rounded-md px-2 py-1 focus:outline-none focus:border-zinc-500 cursor-pointer shadow-2xs"
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
          {filteredJobs.slice(0, 6).map(targetJob => {
            const match = computeJobMatch(targetJob);
            const isTargetExpanded = expandedJobIds.has(targetJob.id);
            return (
              <button
                key={targetJob.id}
                type="button"
                onClick={() => {
                  toggleExpand(targetJob.id);
                  const el = document.getElementById(`job-card-${targetJob.id}`);
                  el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer border ${
                  isTargetExpanded
                    ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 border-zinc-900 dark:border-white shadow-xs'
                    : 'bg-zinc-50 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600'
                }`}
              >
                <span className="truncate max-w-[130px]">{targetJob.company}</span>
                {match && (
                  <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-bold ${
                    isTargetExpanded
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
      <div className="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400 px-0.5">
        <span className="font-semibold text-zinc-700 dark:text-zinc-300">
          Showing {filteredJobs.length} opening{filteredJobs.length === 1 ? '' : 's'} with horizontal in-app specs
        </span>
        {resumeText && resumeText.length > 20 && (
          <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
            <CheckCircle className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            Resume Matching Active
          </span>
        )}
      </div>

      {/* Jobs List Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
        {filteredJobs.map(job => {
          const isExpanded = isCardExpanded(job.id);
          const matchInfo = computeJobMatch(job);
          const avatarColors = getCompanyAvatarColor(job.company);
          const bookmarked = isBookmarked(job);

          return (
            <div
              key={job.id}
              id={`job-card-${job.id}`}
              className={`bg-white dark:bg-[#121215] rounded-xl border transition-all duration-200 overflow-hidden shadow-xs ${
                isExpanded
                  ? 'col-span-full border-zinc-400 dark:border-zinc-500 ring-2 ring-zinc-300 dark:ring-zinc-700 shadow-md'
                  : 'border-zinc-200 dark:border-[#27272A] hover:border-zinc-400 dark:hover:border-zinc-600 hover:shadow-sm'
              }`}
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

                  {/* Quick Action Icons: Bookmark, Focus Modal & External Link */}
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleBookmark(job);
                      }}
                      className={`p-1.5 rounded hover:bg-slate-100 transition-colors ${
                        bookmarked ? 'text-amber-500' : 'text-slate-400 hover:text-slate-600'
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
                      className="p-1.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                      title="Open Full Screen Reader"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                    </button>

                    <a
                      href={job.url}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="p-1.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                      title="View on Careers Site"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>

                {/* Prominent Clickable Job Title */}
                <div
                  onClick={() => toggleExpand(job.id)}
                  className="cursor-pointer group flex items-start justify-between gap-2 py-0.5"
                  title="Click to view full role specifications & interview guide"
                >
                  <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 leading-snug group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-colors">
                    {job.title}
                  </h3>
                  <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 shrink-0 flex items-center gap-0.5 opacity-80 group-hover:opacity-100 transition-opacity mt-0.5">
                    {isExpanded ? (
                      <>
                        <span>Hide Specs</span>
                        <ChevronUp className="w-3.5 h-3.5" />
                      </>
                    ) : (
                      <>
                        <span>View Specs</span>
                        <ChevronDown className="w-3.5 h-3.5" />
                      </>
                    )}
                  </span>
                </div>

                {/* Compact Meta Summary Bar (Location + Pay + ATS Match) */}
                <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400 flex-wrap">
                  <div className="flex items-center gap-1 truncate">
                    <MapPin className="w-3 h-3 text-zinc-400 shrink-0" />
                    <span className="truncate">{job.location}</span>
                  </div>

                  <div className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-bold font-mono text-xs truncate">
                    <DollarSign className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="truncate">{job.salaryRange || 'Competitive Pay'}</span>
                  </div>

                  {matchInfo && (
                    <div className="flex items-center gap-1 text-emerald-800 dark:text-emerald-300 font-bold text-[10px] bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span>{matchInfo.score}% ATS Match</span>
                    </div>
                  )}
                </div>

                {/* Action Buttons Row */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => toggleExpand(job.id)}
                    className={`flex-1 py-2 px-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs ${
                      isExpanded
                        ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-300 dark:hover:bg-zinc-600'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                    }`}
                  >
                    <BookOpen className="w-3.5 h-3.5 text-zinc-500" />
                    <span>{isExpanded ? 'Collapse Specs' : 'View Full Specs'}</span>
                    {isExpanded ? (
                      <ChevronUp className="w-3.5 h-3.5 text-zinc-500 ml-0.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-zinc-500 ml-0.5" />
                    )}
                  </button>

                  <button
                    onClick={() => onSelectJobForTailoring(job)}
                    className="flex-1 py-2 px-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-950 text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Tailor Resume</span>
                  </button>
                </div>
              </div>

              {/* ── EXPANDED HORIZONTAL MULTI-COLUMN INTELLIGENCE INSPECTOR ────────────────────── */}
              {isExpanded && (
                <div className="border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-[#0c0c0e] p-4 sm:p-6 animate-in fade-in duration-200 space-y-4 text-xs">
                  {/* Section 0: Live ATS Match & Key Parameters Horizontal Ribbon */}
                  <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-[#151518] border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 sm:p-3.5 shadow-2xs">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      {matchInfo ? (
                        <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 font-bold text-xs">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                          <span>{matchInfo.score}% ATS Match</span>
                          <span className="text-emerald-600 dark:text-emerald-400 text-[11px] font-mono">
                            ({matchInfo.matched.length}/{matchInfo.total} skills)
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-semibold">
                          <span>Algorithmic ATS Rubric</span>
                        </div>
                      )}

                      {job.isVerified && (
                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 font-bold text-xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <span>Verified</span>
                        </div>
                      )}

                      <div className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300 font-mono text-xs px-2.5 py-1 rounded bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700">
                        <DollarSign className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span className="font-bold text-emerald-700 dark:text-emerald-400">{job.salaryRange || 'Competitive Pay'}</span>
                      </div>

                      <div className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300 text-xs px-2.5 py-1 rounded bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700">
                        <MapPin className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                        <span>{job.location} ({job.workModel || 'Hybrid'})</span>
                      </div>

                      {job.educationRequirements && (
                        <div className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300 text-[11px] px-2.5 py-1 rounded bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700">
                          <GraduationCap className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                          <span className="truncate max-w-[150px]">{job.educationRequirements}</span>
                        </div>
                      )}

                      {job.sponsorship && (
                        <div className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300 text-[11px] px-2.5 py-1 rounded bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700">
                          <ShieldCheck className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                          <span className="truncate max-w-[150px]">{job.sponsorship}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleCopyJobSpec(job)}
                        className="px-2.5 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                        title="Copy formatted job specifications"
                      >
                        {copiedJobId === job.id ? (
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
                        onClick={() => handleBookmark(job)}
                        className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border ${
                          bookmarked
                            ? 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300'
                            : 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                        }`}
                      >
                        {bookmarked ? (
                          <>
                            <BookmarkCheck className="w-3.5 h-3.5 fill-amber-500 text-amber-600" />
                            <span>Bookmarked</span>
                          </>
                        ) : (
                          <>
                            <Bookmark className="w-3.5 h-3.5 text-zinc-400" />
                            <span>Bookmark</span>
                          </>
                        )}
                      </button>

                      <a
                        href={job.url}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                      >
                        <span>Careers Site</span>
                        <ExternalLink className="w-3 h-3 text-zinc-400" />
                      </a>

                      <button
                        onClick={() => onSelectJobForTailoring(job)}
                        className="px-3.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-950 text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Tailor Resume</span>
                      </button>
                    </div>
                  </div>

                  {/* 4-COLUMN PARALLEL HORIZONTAL INTELLIGENCE GRID */}
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-stretch">
                    {/* ── COLUMN 1: ROLE & COMPANY OVERVIEW ────────────────────── */}
                    <div className="bg-white dark:bg-[#151518] border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 flex flex-col justify-between space-y-3 shadow-2xs">
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 pb-2 border-b border-zinc-200/80 dark:border-zinc-800">
                          <div className="w-6 h-6 rounded bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-700 dark:text-zinc-300">
                            <Building2 className="w-3.5 h-3.5" />
                          </div>
                          <h4 className="font-bold text-xs text-zinc-900 dark:text-zinc-100 uppercase tracking-wide font-mono">
                            1. Role &amp; Overview
                          </h4>
                        </div>

                        {/* Role Domain Summary */}
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold font-mono text-zinc-400 uppercase tracking-wider block">
                            Domain &amp; Mission:
                          </span>
                          <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
                            {job.aboutTeam || job.aboutCompany || job.description || 'Engineering organization developing tier-1 software infrastructure.'}
                          </p>
                        </div>

                        {/* Parameter Highlights */}
                        <div className="space-y-1.5 bg-zinc-50 dark:bg-zinc-900/60 p-3 rounded-lg border border-zinc-200/80 dark:border-zinc-800 text-[11px]">
                          <div className="flex items-center justify-between">
                            <span className="text-zinc-400 font-mono text-[10px]">Location:</span>
                            <span className="font-medium text-zinc-800 dark:text-zinc-200 truncate max-w-[170px]">{job.location}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-zinc-400 font-mono text-[10px]">Compensation:</span>
                            <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">{job.salaryRange || 'Competitive Pay'}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-zinc-400 font-mono text-[10px]">Education:</span>
                            <span className="font-medium text-zinc-800 dark:text-zinc-200 truncate max-w-[170px]">{job.educationRequirements || 'B.S. / M.S. in CS or related'}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-zinc-400 font-mono text-[10px]">Authorization:</span>
                            <span className="font-medium text-zinc-800 dark:text-zinc-200 truncate max-w-[170px]">{job.sponsorship || 'CPT/OPT / Sponsorship Eligible'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Team Highlights / Standouts */}
                      {job.teamHighlights && job.teamHighlights.length > 0 && (
                        <div className="pt-2 border-t border-zinc-200/80 dark:border-zinc-800 space-y-1.5">
                          <span className="text-[10px] font-bold font-mono text-emerald-700 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                            <Zap className="w-3 h-3" />
                            <span>Why Team Stands Out</span>
                          </span>
                          <div className="space-y-1 text-[11px] text-zinc-700 dark:text-zinc-300">
                            {job.teamHighlights.slice(0, 2).map((th, i) => (
                              <div key={i} className="flex items-start gap-1.5 leading-snug">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 mt-1.5" />
                                <span>{th}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* ── COLUMN 2: CORE RESPONSIBILITIES & IMPACT ─────────────── */}
                    <div className="bg-white dark:bg-[#151518] border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 flex flex-col justify-between space-y-3 shadow-2xs">
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 pb-2 border-b border-zinc-200/80 dark:border-zinc-800">
                          <div className="w-6 h-6 rounded bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-700 dark:text-zinc-300">
                            <Briefcase className="w-3.5 h-3.5" />
                          </div>
                          <h4 className="font-bold text-xs text-zinc-900 dark:text-zinc-100 uppercase tracking-wide font-mono">
                            2. Responsibilities &amp; Impact
                          </h4>
                        </div>

                        <span className="text-[10px] font-bold font-mono text-zinc-400 uppercase tracking-wider block">
                          What You Will Build &amp; Own:
                        </span>

                        {job.responsibilities && job.responsibilities.length > 0 ? (
                          <ul className="space-y-2 text-xs text-zinc-700 dark:text-zinc-300">
                            {job.responsibilities.map((resp, i) => (
                              <li key={i} className="flex items-start gap-2 leading-relaxed bg-zinc-50 dark:bg-zinc-900/50 p-2 rounded-lg border border-zinc-200/60 dark:border-zinc-800/60">
                                <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 dark:bg-zinc-400 shrink-0 mt-1.5" />
                                <span>{resp}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-xs text-zinc-500 dark:text-zinc-400 italic">
                            Core engineering deliverables outlined upon initial technical screen.
                          </p>
                        )}
                      </div>

                      {/* Benefits / Total Rewards */}
                      {job.benefits && job.benefits.length > 0 && (
                        <div className="pt-2 border-t border-zinc-200/80 dark:border-zinc-800 space-y-1">
                          <span className="text-[10px] font-bold font-mono text-zinc-400 uppercase tracking-wider block">
                            Total Rewards &amp; Perks:
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {job.benefits.slice(0, 3).map((ben, i) => (
                              <span key={i} className="text-[10px] px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                                🎁 {ben}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* ── COLUMN 3: TECH STACK & KEYWORD ALIGNMENT ─────────────── */}
                    <div className="bg-white dark:bg-[#151518] border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 flex flex-col justify-between space-y-3 shadow-2xs">
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 pb-2 border-b border-zinc-200/80 dark:border-zinc-800">
                          <div className="w-6 h-6 rounded bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-700 dark:text-zinc-300">
                            <Code2 className="w-3.5 h-3.5" />
                          </div>
                          <h4 className="font-bold text-xs text-zinc-900 dark:text-zinc-100 uppercase tracking-wide font-mono">
                            3. Tech Stack &amp; Skills
                          </h4>
                        </div>

                        {/* Skills Tag Matrix */}
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-bold font-mono text-zinc-400 uppercase tracking-wider block">
                            Target Technologies:
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {job.skills && job.skills.length > 0 ? (
                              job.skills.map(skill => {
                                const isSkillMatched = matchInfo?.matched.includes(skill);
                                return (
                                  <span
                                    key={skill}
                                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold border transition-all ${
                                      isSkillMatched
                                        ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-500/30'
                                        : 'bg-zinc-100 dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
                                    }`}
                                  >
                                    {isSkillMatched ? `✓ ${skill}` : skill}
                                  </span>
                                );
                              })
                            ) : (
                              <span className="text-xs text-zinc-500">General Software Engineering</span>
                            )}
                          </div>
                        </div>

                        {/* Minimum Requirements */}
                        {job.requirements && job.requirements.length > 0 && (
                          <div className="space-y-1.5 pt-1">
                            <span className="text-[10px] font-bold font-mono text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                              <Target className="w-3 h-3 text-zinc-500" />
                              <span>Minimum Requirements:</span>
                            </span>
                            <ul className="space-y-1 text-[11px] text-zinc-700 dark:text-zinc-300">
                              {job.requirements.slice(0, 3).map((req, i) => (
                                <li key={i} className="flex items-start gap-1.5 leading-snug">
                                  <Check className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5" />
                                  <span>{req}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>

                      {/* Preferred Qualifications */}
                      {job.preferredQualifications && job.preferredQualifications.length > 0 && (
                        <div className="pt-2 border-t border-zinc-200/80 dark:border-zinc-800 space-y-1">
                          <span className="text-[10px] font-bold font-mono text-amber-700 dark:text-amber-400 uppercase tracking-wider block">
                            Preferred &amp; Bonus:
                          </span>
                          <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-snug">
                            ★ {job.preferredQualifications[0]}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* ── COLUMN 4: INTERVIEW BLUEPRINT & PREP TIPS ────────────── */}
                    <div className="bg-white dark:bg-[#151518] border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 flex flex-col justify-between space-y-3 shadow-2xs">
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 pb-2 border-b border-zinc-200/80 dark:border-zinc-800">
                          <div className="w-6 h-6 rounded bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-700 dark:text-zinc-300">
                            <Lightbulb className="w-3.5 h-3.5" />
                          </div>
                          <h4 className="font-bold text-xs text-zinc-900 dark:text-zinc-100 uppercase tracking-wide font-mono">
                            4. Interview Blueprint
                          </h4>
                        </div>

                        {/* Interview Timeline Steps */}
                        {job.interviewProcess && job.interviewProcess.length > 0 ? (
                          <div className="space-y-1.5">
                            <span className="text-[10px] font-bold font-mono text-zinc-400 uppercase tracking-wider block">
                              Hiring Pipeline Timeline:
                            </span>
                            <div className="space-y-1.5">
                              {job.interviewProcess.map((step, i) => (
                                <div key={i} className="flex items-start gap-2 text-[11px] text-zinc-800 dark:text-zinc-200">
                                  <span className="w-4 h-4 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 flex items-center justify-center text-[9px] font-mono font-bold shrink-0 mt-0.5">
                                    {i + 1}
                                  </span>
                                  <span className="leading-tight">{step}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-zinc-500">Standard 3-round technical assessment &amp; behavioral review.</p>
                        )}

                        {/* Insider Prep Tips */}
                        {job.prepTips && job.prepTips.length > 0 && (
                          <div className="pt-1.5 space-y-1">
                            <span className="text-[10px] font-bold font-mono text-amber-700 dark:text-amber-400 uppercase tracking-wider block">
                              💡 Key Focus Areas:
                            </span>
                            <p className="text-[11px] text-zinc-700 dark:text-zinc-300 leading-snug pl-2 border-l-2 border-amber-500">
                              {job.prepTips[0]}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Hacky AI Pro-Tip Box & Bottom CTA */}
                      <div className="space-y-2 pt-2 border-t border-zinc-200/80 dark:border-zinc-800">
                        <div className="p-2.5 rounded-lg bg-zinc-100 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 text-[11px] text-zinc-700 dark:text-zinc-300 leading-snug flex items-start gap-2">
                          <span className="text-emerald-500 shrink-0 font-bold">⚡</span>
                          <span>
                            <strong>Hacky AI Insight:</strong> Emphasize STAR metrics with concrete scale indicators to maximize ATS &amp; recruiter score.
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => onSelectJobForTailoring(job)}
                            className="flex-1 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-950 text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Tailor Now</span>
                          </button>
                          <button
                            onClick={() => toggleExpand(job.id)}
                            className="py-2 px-2.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                            title="Collapse specifications"
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {filteredJobs.length === 0 && (
          <div className="col-span-full text-center py-16 text-zinc-400 text-xs space-y-3 bg-white dark:bg-[#121215] rounded-xl border border-zinc-200 dark:border-[#27272A] p-8 shadow-xs">
            <p className="text-3xl">🔍</p>
            <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">No openings match your search</h3>
            <p className="text-zinc-500 dark:text-zinc-400 text-xs max-w-sm mx-auto leading-relaxed">
              {searchQuery
                ? `No job postings match "${searchQuery}". Try searching for another skill, company, or clearing filters.`
                : 'No openings match your current filter selection.'}
            </p>
            <div className="pt-2 flex justify-center gap-2">
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
      </div>

      {/* ── FOCUS MODAL / EXPANSIVE HORIZONTAL FULL SCREEN READER ─────────── */}
      {focusedJob && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#121215] w-full max-w-[1680px] max-h-[92vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-zinc-200 dark:border-zinc-800">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-4">
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
                  <h3 className="font-bold text-sm sm:text-base text-zinc-900 dark:text-zinc-100 truncate">
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

                    <div className="space-y-1.5 bg-white dark:bg-zinc-900/70 p-3 rounded-lg border border-zinc-200/80 dark:border-zinc-800 text-[11px]">
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-400 font-mono text-[10px]">Location:</span>
                        <span className="font-medium text-zinc-800 dark:text-zinc-200 truncate max-w-[170px]">{focusedJob.location}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-400 font-mono text-[10px]">Compensation:</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">{focusedJob.salaryRange || 'Competitive Pay'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-400 font-mono text-[10px]">Education:</span>
                        <span className="font-medium text-zinc-800 dark:text-zinc-200 truncate max-w-[170px]">{focusedJob.educationRequirements || 'B.S. / M.S. CS or related'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-400 font-mono text-[10px]">Authorization:</span>
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
                          <span key={i} className="text-[10px] px-2 py-0.5 rounded bg-zinc-200/70 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
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
                          <Target className="w-3 h-3 text-zinc-500" />
                          <span>Minimum Requirements:</span>
                        </span>
                        <ul className="space-y-1 text-[11px] text-zinc-700 dark:text-zinc-300">
                          {focusedJob.requirements.slice(0, 3).map((req, i) => (
                            <li key={i} className="flex items-start gap-1.5 leading-snug">
                              <Check className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5" />
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
                            <div key={i} className="flex items-start gap-2 text-[11px] text-zinc-800 dark:text-zinc-200">
                              <span className="w-4 h-4 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 flex items-center justify-center text-[9px] font-mono font-bold shrink-0 mt-0.5">
                                {i + 1}
                              </span>
                              <span className="leading-tight">{step}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-zinc-500">Standard 3-round technical assessment &amp; behavioral review.</p>
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
            <div className="p-4 px-6 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-zinc-500 font-mono">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span>Verified by ResumeHack Algorithmic Intelligence</span>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={focusedJob.url}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-semibold flex items-center gap-1.5 transition-colors"
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
                  <Sparkles className="w-4 h-4" />
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
