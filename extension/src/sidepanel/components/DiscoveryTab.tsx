import React, { useState } from 'react';
import { JobPosting } from '../../types/index.js';
import { Search, MapPin, DollarSign, Sparkles, ExternalLink, RefreshCw, Github, CheckCircle2 } from 'lucide-react';

interface DiscoveryTabProps {
  jobs: JobPosting[];
  onSelectJobForTailoring: (job: JobPosting) => void;
  onSyncGitHub: () => Promise<void>;
  isSyncing: boolean;
  syncMessage: string | null;
}

export const DiscoveryTab: React.FC<DiscoveryTabProps> = ({
  jobs,
  onSelectJobForTailoring,
  onSyncGitHub,
  isSyncing,
  syncMessage
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedType, setSelectedType] = useState<string>('All');

  const categories = ['All', 'Software Engineering', 'Data & AI', 'Product Management', 'Finance & Quant'];

  const filteredJobs = jobs.filter(job => {
    const matchesSearch = 
      job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.description.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = selectedCategory === 'All' || job.category === selectedCategory;
    const matchesType = selectedType === 'All' || job.type === selectedType;

    return matchesSearch && matchesCategory && matchesType;
  });

  return (
    <div className="p-4 space-y-4 pb-16">
      {/* Header & GitHub Live Sync Action */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-headline font-bold text-sm text-slate-900 flex items-center gap-1.5">
              <span>GitHub Live Jobs Database</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            </h2>
            <p className="text-[11px] text-slate-500">
              Live tracked from SimplifyJobs & Pitt CSC GitHub repos.
            </p>
          </div>

          <button
            onClick={onSyncGitHub}
            disabled={isSyncing}
            className="px-2.5 py-1.5 rounded-stitch bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-semibold flex items-center gap-1 shadow-sm transition-all shrink-0"
            title="Fetch latest open internships directly from GitHub READMEs"
          >
            <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin text-brand-400' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync GitHub'}</span>
          </button>
        </div>

        {syncMessage && (
          <div className="p-2 bg-emerald-50 border border-emerald-200 rounded text-[11px] text-emerald-800 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>{syncMessage}</span>
          </div>
        )}

        {/* Search input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search role, company, or skills..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-stitch text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 shadow-sm"
          />
        </div>

        {/* Category Pills */}
        <div className="flex gap-1 overflow-x-auto pb-1 no-scrollbar">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${
                selectedCategory === cat
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Jobs List */}
      <div className="space-y-3">
        {filteredJobs.map((job) => (
          <div
            key={job.id}
            className="bg-white p-3.5 rounded-stitch border border-slate-200 shadow-sm hover:border-brand-200 transition-all space-y-2.5 group"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-headline font-bold text-xs text-slate-900 group-hover:text-brand-600 transition-colors">
                    {job.company}
                  </span>
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-slate-100 text-slate-600">
                    {job.season || job.type}
                  </span>
                </div>
                <h3 className="font-semibold text-xs text-slate-800 mt-0.5">
                  {job.title}
                </h3>
              </div>

              <a
                href={job.url}
                target="_blank"
                rel="noreferrer"
                className="text-slate-400 hover:text-slate-600 p-1"
                title="View original application page"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            <div className="flex flex-wrap gap-2 text-[11px] text-slate-500 font-medium">
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3 text-slate-400" />
                {job.location}
              </span>
              {job.salaryRange && (
                <span className="flex items-center gap-1 text-emerald-700 font-semibold font-mono text-[10px]">
                  <DollarSign className="w-3 h-3 text-emerald-600" />
                  {job.salaryRange}
                </span>
              )}
            </div>

            <button
              onClick={() => onSelectJobForTailoring(job)}
              className="w-full py-2 px-3 rounded-stitch bg-brand-50 hover:bg-brand-600 text-brand-700 hover:text-white font-semibold text-xs transition-all flex items-center justify-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Tailor Resume for this Role</span>
            </button>
          </div>
        ))}

        {filteredJobs.length === 0 && (
          <div className="text-center py-8 text-slate-400 text-xs">
            No openings found matching your filter criteria.
          </div>
        )}
      </div>
    </div>
  );
};
