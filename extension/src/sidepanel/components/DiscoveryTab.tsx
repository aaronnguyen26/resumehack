import React, { useState, useMemo } from 'react';
import { JobPosting, ApplicationRecord } from '../../types/index.js';
import { enrichJobDetails } from '../../services/github-tracker.js';
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
    { bg: 'from-blue-600 to-indigo-700', text: 'text-white' },
    { bg: 'from-emerald-500 to-teal-700', text: 'text-white' },
    { bg: 'from-purple-600 to-violet-800', text: 'text-white' },
    { bg: 'from-amber-500 to-orange-600', text: 'text-white' },
    { bg: 'from-rose-500 to-pink-600', text: 'text-white' },
    { bg: 'from-cyan-600 to-blue-700', text: 'text-white' },
    { bg: 'from-slate-700 to-slate-900', text: 'text-white' },
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
          (selectedCategory === '⚡ Fresh (< 2m)'
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
    <div className="p-3.5 space-y-4 pb-20">
      {/* Toast Notification */}
      {actionToast && (
        <div className="fixed top-14 left-1/2 transform -translate-x-1/2 z-50 bg-slate-900 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-xl flex items-center gap-2 animate-bounce border border-slate-700">
          <span>{actionToast}</span>
        </div>
      )}

      {/* Header & Sync Bar */}
      <div className="space-y-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="font-headline font-bold text-sm text-slate-900 flex items-center gap-1.5">
              <span>Full Role Explorer & Live Database</span>
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
            className="px-2.5 py-1.5 rounded-stitch bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-semibold flex items-center gap-1.5 shadow-sm transition-all shrink-0"
            title="Fetch latest open internships from GitHub"
          >
            <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin text-emerald-400' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
          </button>
        </div>

        {syncMessage && (
          <div
            className={`p-2 rounded text-[11px] flex items-center gap-1.5 ${
              syncMessage.startsWith('⚠️')
                ? 'bg-red-50 border border-red-200 text-red-800'
                : 'bg-emerald-50 border border-emerald-200 text-emerald-800'
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
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search role, company, skills, or responsibilities..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-8 py-1.5 bg-white border border-slate-200 rounded-stitch text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 shadow-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
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
                className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all flex items-center gap-1 ${
                  selectedCategory === cat
                    ? isFreshPill
                      ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-400/50'
                      : cat === 'New (24h)'
                      ? 'bg-teal-600 text-white shadow-sm'
                      : 'bg-brand-600 text-white shadow-sm'
                    : isFreshPill
                    ? 'bg-emerald-50 border border-emerald-300 text-emerald-700 hover:bg-emerald-100 font-bold'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span>{cat === 'New (24h)' ? '🔥 New (24h)' : cat}</span>
                <span
                  className={`text-[9px] px-1.5 py-0.2 rounded-full ${
                    selectedCategory === cat ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Sub-Filters & View Mode Controls */}
        <div className="flex items-center justify-between gap-1.5 pt-1 text-[11px] flex-wrap bg-slate-100/70 p-2 rounded-lg border border-slate-200">
          {/* Type Filter */}
          <div className="flex gap-1 items-center">
            <span className="text-[10px] text-slate-500 font-bold mr-0.5">Type:</span>
            {types.map(type => (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                  selectedType === type
                    ? 'bg-slate-900 text-white font-bold shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          {/* Work Model Filter */}
          <div className="flex gap-1 items-center">
            <span className="text-[10px] text-slate-500 font-bold mr-0.5">Model:</span>
            {workModels.map(model => (
              <button
                key={model}
                onClick={() => setSelectedWorkModel(model)}
                className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                  selectedWorkModel === model
                    ? 'bg-brand-700 text-white font-bold shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
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
            className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors ml-auto shadow-2xs"
            title="Toggle showing full details on all cards"
          >
            {expandAll ? <EyeOff className="w-3 h-3 text-slate-500" /> : <Eye className="w-3 h-3 text-brand-600" />}
            <span>{expandAll ? 'Collapse Specs' : 'Expand All Specs'}</span>
          </button>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-slate-500 font-bold">Sort:</span>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="bg-white border border-slate-200 text-slate-700 text-[10px] font-bold rounded px-1.5 py-0.5 focus:outline-none focus:border-brand-500 cursor-pointer shadow-2xs"
            >
              <option value="newest">🔥 Newest</option>
              <option value="salary">💰 Top Pay</option>
              <option value="match">🎯 Best ATS Match</option>
              <option value="company">🏢 Company (A-Z)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Results Count & Match Tip */}
      <div className="flex items-center justify-between text-[11px] text-slate-500 px-0.5">
        <span className="font-semibold text-slate-700">
          Showing {filteredJobs.length} opening{filteredJobs.length === 1 ? '' : 's'} with full in-app specs
        </span>
        {resumeText && resumeText.length > 20 && (
          <span className="text-[10px] text-emerald-700 font-medium flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
            <CheckCircle className="w-3 h-3 text-emerald-600" />
            Resume Matching Active
          </span>
        )}
      </div>

      {/* Jobs List */}
      <div className="space-y-4">
        {filteredJobs.map(job => {
          const isExpanded = isCardExpanded(job.id);
          const matchInfo = computeJobMatch(job);
          const avatarColors = getCompanyAvatarColor(job.company);
          const bookmarked = isBookmarked(job);

          return (
            <div
              key={job.id}
              className={`bg-white rounded-xl border transition-all duration-200 overflow-hidden shadow-sm ${
                isExpanded
                  ? 'border-brand-300 ring-2 ring-brand-100 shadow-md'
                  : 'border-slate-200 hover:border-brand-200 hover:shadow'
              }`}
            >
              {/* Card Header & Title Bar */}
              <div className="p-3.5 space-y-2.5">
                {/* Top Row: Company Avatar + Name + Badges + Actions */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-lg bg-gradient-to-br ${avatarColors.bg} ${avatarColors.text} flex items-center justify-center font-headline font-bold text-xs shrink-0 shadow-2xs`}
                    >
                      {job.company.slice(0, 2).toUpperCase()}
                    </div>

                    <div className="min-w-0 flex items-center gap-1.5 flex-wrap">
                      <span className="font-headline font-bold text-xs text-slate-900 truncate">
                        {job.company}
                      </span>
                      {job.category && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-brand-50 text-brand-700 border border-brand-200">
                          {job.category}
                        </span>
                      )}
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-slate-100 text-slate-700">
                        {job.season || job.type}
                      </span>
                      {job.workModel && (
                        <span
                          className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                            job.workModel === 'Remote'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : job.workModel === 'Hybrid'
                              ? 'bg-purple-50 text-purple-700 border border-purple-200'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {job.workModel === 'Remote' ? '🏠 Remote' : job.workModel === 'Hybrid' ? '🏢 Hybrid' : '📍 On-site'}
                        </span>
                      )}
                      {((job as any).isUltraFresh || (job as any).isFreshAts) && (
                        <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-emerald-500 text-white flex items-center gap-0.5 shadow-xs animate-pulse">
                          <Zap className="w-2.5 h-2.5" /> &lt; 2m ATS
                        </span>
                      )}
                      {(job.daysAgo ?? 999) === 0 && !((job as any).isUltraFresh || (job as any).isFreshAts) && (
                        <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-800">
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
                  <h3 className="font-bold text-sm text-slate-900 leading-snug group-hover:text-brand-600 transition-colors">
                    {job.title}
                  </h3>
                  <span className="text-[10px] font-bold text-brand-600 shrink-0 flex items-center gap-0.5 opacity-80 group-hover:opacity-100 transition-opacity mt-0.5">
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
                <div className="flex items-center gap-2.5 text-[11px] text-slate-600 flex-wrap">
                  <div className="flex items-center gap-1 truncate">
                    <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                    <span className="truncate">{job.location}</span>
                  </div>

                  <div className="flex items-center gap-1 text-emerald-700 font-bold font-mono text-[11px] truncate">
                    <DollarSign className="w-3 h-3 text-emerald-600 shrink-0" />
                    <span className="truncate">{job.salaryRange || 'Competitive Pay'}</span>
                  </div>

                  {matchInfo && (
                    <div className="flex items-center gap-1 text-emerald-800 font-bold text-[10px] bg-emerald-50 px-2 py-0.2 rounded border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span>{matchInfo.score}% ATS Match</span>
                    </div>
                  )}
                </div>

                {/* Action Buttons Row */}
                <div className="flex items-center gap-2 pt-0.5">
                  <button
                    onClick={() => toggleExpand(job.id)}
                    className={`flex-1 py-1.5 px-2.5 rounded-stitch text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all shadow-2xs ${
                      isExpanded
                        ? 'bg-slate-200 text-slate-800 hover:bg-slate-300'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <BookOpen className="w-3.5 h-3.5 text-slate-600" />
                    <span>{isExpanded ? 'Collapse Role Specs' : 'Click to View Full Specs & Guide'}</span>
                    {isExpanded ? (
                      <ChevronUp className="w-3.5 h-3.5 text-slate-600 ml-0.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-slate-600 ml-0.5" />
                    )}
                  </button>

                  <button
                    onClick={() => onSelectJobForTailoring(job)}
                    className="flex-1 py-1.5 px-2.5 rounded-stitch bg-brand-600 hover:bg-brand-700 text-white text-[11px] font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Tailor Resume for Role</span>
                  </button>
                </div>
              </div>

              {/* ── EXPANDED FULL ROLE BREAKDOWN ───────────────────────────────── */}
              {isExpanded && (
                <div className="border-t border-slate-200 bg-slate-50/70 p-4 space-y-4 text-xs animate-in fade-in duration-200">
                  {/* Section 0A: Key Facts Strip (Location, Pay, Education, Sponsorship) */}
                  <div className="grid grid-cols-2 gap-2 text-[11px] bg-white p-3 rounded-lg border border-slate-200">
                    <div className="flex items-center gap-1.5 text-slate-700 truncate">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="font-medium truncate">{job.location}</span>
                    </div>

                    <div className="flex items-center gap-1.5 text-emerald-700 font-bold font-mono text-[11px] truncate">
                      <DollarSign className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span className="truncate">{job.salaryRange || 'Competitive Pay'}</span>
                    </div>

                    {job.educationRequirements && (
                      <div className="flex items-center gap-1.5 text-slate-600 text-[10px] truncate">
                        <GraduationCap className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate font-medium">{job.educationRequirements}</span>
                      </div>
                    )}

                    {job.sponsorship && (
                      <div className="flex items-center gap-1.5 text-slate-600 text-[10px] truncate">
                        <ShieldCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate font-medium">{job.sponsorship}</span>
                      </div>
                    )}
                  </div>

                  {/* Section 0B: Live Resume ATS Match Pill */}
                  {matchInfo && (
                    <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-[11px]">
                      <div className="flex items-center gap-1.5 font-bold text-emerald-800">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span>{matchInfo.score}% ATS Match with your Resume</span>
                      </div>
                      <span className="text-emerald-700 font-semibold text-[10px]">
                        {matchInfo.matched.length}/{matchInfo.total} skills matched
                      </span>
                    </div>
                  )}

                  {/* Section 0C: Role Overview & Domain */}
                  <div className="space-y-1 bg-white p-3 rounded-lg border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Role Summary & Domain:
                    </span>
                    <p className="text-xs text-slate-700 leading-relaxed">
                      {job.aboutTeam || job.aboutCompany || job.description}
                    </p>
                  </div>

                  {/* Section 0D: Key Responsibilities */}
                  {job.responsibilities && job.responsibilities.length > 0 && (
                    <div className="space-y-1.5 bg-white p-3 rounded-lg border border-slate-200">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                        <Briefcase className="w-3.5 h-3.5 text-brand-600" />
                        <span>Key Responsibilities (What You Will Do):</span>
                      </span>
                      <ul className="space-y-1.5 text-[11px] text-slate-700">
                        {job.responsibilities.map((resp, i) => (
                          <li key={i} className="flex items-start gap-1.5 leading-snug">
                            <span className="w-1.5 h-1.5 rounded-full bg-brand-500 shrink-0 mt-1.5" />
                            <span>{resp}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Section 0E: Core Skills & Tech Stack Badges */}
                  {job.skills && job.skills.length > 0 && (
                    <div className="space-y-1.5 bg-white p-3 rounded-lg border border-slate-200">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Required Tech Stack & Skills:
                      </span>
                      <div className="flex flex-wrap gap-1 items-center">
                        {job.skills.map(skill => {
                          const isSkillMatched = matchInfo?.matched.includes(skill);
                          return (
                            <span
                              key={skill}
                              className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-all ${
                                isSkillMatched
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold shadow-2xs'
                                  : 'bg-slate-100 text-slate-700 border-slate-200'
                              }`}
                            >
                              {isSkillMatched ? `✓ ${skill}` : skill}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Section 1: Team Highlights & Scale */}
                  {job.teamHighlights && job.teamHighlights.length > 0 && (
                    <div className="space-y-1.5">
                      <h4 className="font-headline font-bold text-xs text-emerald-900 flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Why This Role & Team Stands Out</span>
                      </h4>
                      <div className="space-y-1.5 bg-emerald-50/70 p-3 rounded-lg border border-emerald-200">
                        {job.teamHighlights.map((th, i) => (
                          <div key={i} className="flex items-start gap-2 text-[11px] text-emerald-950 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                            <span>{th}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Section 2: Minimum Qualifications & Eligibility */}
                  {job.requirements && job.requirements.length > 0 && (
                    <div className="space-y-1.5">
                      <h4 className="font-headline font-bold text-xs text-slate-900 flex items-center gap-1.5">
                        <Target className="w-3.5 h-3.5 text-blue-600" />
                        <span>Minimum Qualifications & Eligibility</span>
                      </h4>
                      <ul className="space-y-1.5 bg-white p-3 rounded-lg border border-slate-200">
                        {job.requirements.map((req, i) => (
                          <li key={i} className="flex items-start gap-2 text-[11px] text-slate-800 leading-relaxed">
                            <Check className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                            <span>{req}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Section 3: Preferred Qualifications */}
                  {job.preferredQualifications && job.preferredQualifications.length > 0 && (
                    <div className="space-y-1.5">
                      <h4 className="font-headline font-bold text-xs text-purple-900 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                        <span>Preferred & Bonus Qualifications</span>
                      </h4>
                      <ul className="space-y-1 bg-purple-50/50 p-3 rounded-lg border border-purple-200">
                        {job.preferredQualifications.map((pref, i) => (
                          <li key={i} className="flex items-start gap-2 text-[11px] text-purple-950">
                            <span className="text-purple-600 font-bold shrink-0">★</span>
                            <span>{pref}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Section 4: Total Compensation & Benefits */}
                  {job.benefits && job.benefits.length > 0 && (
                    <div className="space-y-1.5">
                      <h4 className="font-headline font-bold text-xs text-emerald-900 flex items-center gap-1.5">
                        <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Total Rewards, Housing Stipends & Perks</span>
                      </h4>
                      <ul className="space-y-1 bg-white p-3 rounded-lg border border-slate-200">
                        {job.benefits.map((ben, i) => (
                          <li key={i} className="flex items-start gap-2 text-[11px] text-slate-800">
                            <span className="text-emerald-600 font-bold shrink-0">🎁</span>
                            <span>{ben}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Section 5: Interview Process & Prep Tips */}
                  {job.interviewProcess && job.interviewProcess.length > 0 && (
                    <div className="space-y-2 bg-amber-50/70 p-3.5 rounded-lg border border-amber-200">
                      <h4 className="font-headline font-bold text-xs text-amber-950 flex items-center gap-1.5">
                        <Lightbulb className="w-3.5 h-3.5 text-amber-600" />
                        <span>Interview Process & Insider Preparation Guide</span>
                      </h4>

                      <div className="space-y-1.5">
                        {job.interviewProcess.map((step, i) => (
                          <div key={i} className="flex items-start gap-2 text-[11px] text-amber-950 font-medium">
                            <span className="w-4 h-4 rounded-full bg-amber-200 text-amber-900 flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5">
                              {i + 1}
                            </span>
                            <span>{step}</span>
                          </div>
                        ))}
                      </div>

                      {job.prepTips && job.prepTips.length > 0 && (
                        <div className="pt-2 border-t border-amber-200 space-y-1">
                          <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wide">
                            💡 What Interviewers Test & Key Focus Areas:
                          </span>
                          {job.prepTips.map((tip, i) => (
                            <p key={i} className="text-[11px] text-amber-950 leading-relaxed pl-2 border-l-2 border-amber-400">
                              {tip}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Section 6: Raw Job Description / Notes (If available) */}
                  {job.description && job.description.length > 100 && (
                    <div className="space-y-1.5">
                      <h4 className="font-headline font-bold text-xs text-slate-800 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-slate-600" />
                        <span>Original Job Description Text</span>
                      </h4>
                      <div className="bg-white p-3 rounded-lg border border-slate-200 text-[11px] text-slate-700 whitespace-pre-line leading-relaxed max-h-48 overflow-y-auto font-mono text-[10px]">
                        {job.description}
                      </div>
                    </div>
                  )}

                  {/* Expanded Bottom Action Bar */}
                  <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-200">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleCopyJobSpec(job)}
                        className="px-2.5 py-1.5 rounded-stitch bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-[11px] font-semibold flex items-center gap-1 transition-all"
                        title="Copy formatted job details to clipboard"
                      >
                        {copiedJobId === job.id ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-600" />
                            <span className="text-emerald-700">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3 text-slate-500" />
                            <span>Copy Spec</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => handleBookmark(job)}
                        className={`px-2.5 py-1.5 rounded-stitch border text-[11px] font-semibold flex items-center gap-1 transition-all ${
                          bookmarked
                            ? 'bg-amber-50 border-amber-200 text-amber-800'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {bookmarked ? (
                          <>
                            <BookmarkCheck className="w-3 h-3 text-amber-600" />
                            <span>Bookmarked</span>
                          </>
                        ) : (
                          <>
                            <Bookmark className="w-3 h-3 text-slate-500" />
                            <span>Bookmark</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <a
                        href={job.url}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 rounded-stitch bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-semibold flex items-center gap-1 shadow-xs transition-all"
                      >
                        <span>Apply on Portal</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>

                      <button
                        onClick={() => onSelectJobForTailoring(job)}
                        className="px-3 py-1.5 rounded-stitch bg-brand-600 hover:bg-brand-700 text-white text-[11px] font-semibold flex items-center gap-1 shadow-xs transition-all"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Tailor Resume</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {filteredJobs.length === 0 && (
          <div className="text-center py-12 text-slate-400 text-xs space-y-2.5 bg-white rounded-stitch border border-slate-200 p-6">
            <p className="text-3xl">🔍</p>
            <h3 className="font-bold text-slate-800 text-sm">No openings match your search</h3>
            <p className="text-slate-500 text-[11px] max-w-xs mx-auto">
              {searchQuery
                ? `No job postings match "${searchQuery}". Try searching for another skill, company, or clearing filters.`
                : 'No openings match your current filter selection.'}
            </p>
            <div className="pt-2 flex justify-center gap-2">
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold"
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
                  className="px-3 py-1.5 bg-brand-50 hover:bg-brand-100 text-brand-700 rounded text-xs font-semibold"
                >
                  View All Openings
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── FOCUS MODAL / FULL SCREEN READER ───────────────────────────────── */}
      {focusedJob && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-lg max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-200 flex items-start justify-between gap-3 bg-slate-50">
              <div className="flex items-start gap-3 min-w-0">
                <div
                  className={`w-10 h-10 rounded-xl bg-gradient-to-br ${
                    getCompanyAvatarColor(focusedJob.company).bg
                  } text-white flex items-center justify-center font-headline font-bold text-sm shrink-0 shadow`}
                >
                  {focusedJob.company.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-headline font-bold text-sm text-slate-900">
                      {focusedJob.company}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-700">
                      {focusedJob.season || focusedJob.type}
                    </span>
                  </div>
                  <h3 className="font-bold text-xs text-slate-800 mt-0.5 leading-snug">
                    {focusedJob.title}
                  </h3>
                </div>
              </div>

              <button
                onClick={() => setFocusedJob(null)}
                className="p-1.5 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-colors shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 overflow-y-auto space-y-4 text-xs">
              {/* Quick Info Grid */}
              <div className="grid grid-cols-2 gap-2 bg-slate-100/80 p-3 rounded-xl text-[11px]">
                <div>
                  <span className="text-slate-400 font-medium block text-[10px]">Location & Model</span>
                  <span className="font-semibold text-slate-800">
                    {focusedJob.location} ({focusedJob.workModel || 'Hybrid'})
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-medium block text-[10px]">Compensation</span>
                  <span className="font-semibold text-emerald-700 font-mono">
                    {focusedJob.salaryRange || 'Competitive Pay'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-medium block text-[10px]">Education Level</span>
                  <span className="font-semibold text-slate-800">
                    {focusedJob.educationRequirements || 'B.S. / M.S. in CS or STEM'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-medium block text-[10px]">Work Authorization</span>
                  <span className="font-semibold text-slate-800">
                    {focusedJob.sponsorship || 'Available'}
                  </span>
                </div>
              </div>

              {/* About Team */}
              {focusedJob.aboutTeam && (
                <div className="space-y-1.5">
                  <h4 className="font-headline font-bold text-xs text-slate-900 flex items-center gap-1.5 text-brand-800">
                    <Building2 className="w-3.5 h-3.5 text-brand-600" />
                    <span>About the Role & Product Domain</span>
                  </h4>
                  <p className="text-slate-700 text-xs leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-200">
                    {focusedJob.aboutTeam}
                  </p>
                </div>
              )}

              {/* Key Responsibilities */}
              {focusedJob.responsibilities && focusedJob.responsibilities.length > 0 && (
                <div className="space-y-1.5">
                  <h4 className="font-headline font-bold text-xs text-slate-900 flex items-center gap-1.5">
                    <Briefcase className="w-3.5 h-3.5 text-brand-600" />
                    <span>What You Will Build & Own</span>
                  </h4>
                  <ul className="space-y-1.5 bg-slate-50 p-3 rounded-lg border border-slate-200">
                    {focusedJob.responsibilities.map((resp, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-slate-700 leading-relaxed">
                        <span className="w-1.5 h-1.5 rounded-full bg-brand-500 shrink-0 mt-1.5" />
                        <span>{resp}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Requirements */}
              {focusedJob.requirements && focusedJob.requirements.length > 0 && (
                <div className="space-y-1.5">
                  <h4 className="font-headline font-bold text-xs text-slate-900 flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5 text-blue-600" />
                    <span>Eligibility & Required Qualifications</span>
                  </h4>
                  <ul className="space-y-1.5 bg-slate-50 p-3 rounded-lg border border-slate-200">
                    {focusedJob.requirements.map((req, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-slate-700 leading-relaxed">
                        <Check className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                        <span>{req}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Skills Matrix */}
              {focusedJob.skills && (
                <div className="space-y-1.5">
                  <h4 className="font-headline font-bold text-xs text-slate-900 flex items-center gap-1.5">
                    <Code2 className="w-3.5 h-3.5 text-slate-700" />
                    <span>Core Technologies & Required Skills</span>
                  </h4>
                  <div className="flex flex-wrap gap-1.5 bg-slate-50 p-3 rounded-lg border border-slate-200">
                    {focusedJob.skills.map(s => (
                      <span
                        key={s}
                        className="px-2.5 py-1 rounded bg-white text-slate-800 border border-slate-200 text-xs font-semibold shadow-2xs"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Interview Guide */}
              {focusedJob.interviewProcess && focusedJob.interviewProcess.length > 0 && (
                <div className="space-y-2 bg-amber-50/60 p-3.5 rounded-xl border border-amber-200">
                  <h4 className="font-headline font-bold text-xs text-amber-900 flex items-center gap-1.5">
                    <Lightbulb className="w-4 h-4 text-amber-600" />
                    <span>Complete Interview Pipeline & Insider Tips</span>
                  </h4>
                  <div className="space-y-1.5">
                    {focusedJob.interviewProcess.map((step, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-amber-950">
                        <span className="w-4 h-4 rounded-full bg-amber-200 text-amber-900 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                              {i + 1}
                        </span>
                        <span>{step}</span>
                      </div>
                    ))}
                  </div>
                  {focusedJob.prepTips && focusedJob.prepTips.length > 0 && (
                    <div className="pt-2 border-t border-amber-200 space-y-1">
                      <span className="text-[10px] font-bold text-amber-900 uppercase">
                        💡 Key Topics to Practice:
                      </span>
                      {focusedJob.prepTips.map((tip, i) => (
                        <p key={i} className="text-xs text-amber-900 pl-2 border-l-2 border-amber-400">
                          {tip}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer CTA */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
              <button
                onClick={() => handleCopyJobSpec(focusedJob)}
                className="px-3 py-2 rounded-stitch bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-all"
              >
                <Copy className="w-3.5 h-3.5 text-slate-500" />
                <span>Copy Spec</span>
              </button>

              <div className="flex items-center gap-2">
                <a
                  href={focusedJob.url}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3.5 py-2 rounded-stitch bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
                >
                  <span>Apply on Site</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>

                <button
                  onClick={() => {
                    const target = focusedJob;
                    setFocusedJob(null);
                    onSelectJobForTailoring(target);
                  }}
                  className="px-4 py-2 rounded-stitch bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
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
