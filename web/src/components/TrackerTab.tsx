import React, { useState } from 'react';
import { ApplicationRecord } from '../types/index.js';
import { Kanban, FileText, ExternalLink, LayoutList, CheckCircle2, Building2, TrendingUp, Sparkles, Plus } from 'lucide-react';

interface TrackerTabProps {
  applications: ApplicationRecord[];
  onUpdateStatus: (id: string, newStatus: ApplicationRecord['status']) => void;
}

export const TrackerTab: React.FC<TrackerTabProps> = ({
  applications,
  onUpdateStatus
}) => {
  const [activeFilter, setActiveFilter] = useState<string>('All');
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');

  const statuses: ApplicationRecord['status'][] = [
    'Bookmarked',
    'Tailored',
    'Applied',
    'Interviewing',
    'Offered',
    'Rejected'
  ];

  const getStatusBadge = (status: ApplicationRecord['status']) => {
    switch (status) {
      case 'Bookmarked':
        return 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700';
      case 'Tailored':
        return 'bg-zinc-200/80 dark:bg-zinc-700/80 text-zinc-900 dark:text-zinc-100 border-zinc-300 dark:border-zinc-600';
      case 'Applied':
        return 'bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/20';
      case 'Interviewing':
        return 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-500/20';
      case 'Offered':
        return 'bg-emerald-600 text-white font-bold border-transparent';
      case 'Rejected':
        return 'bg-rose-500/10 text-rose-800 dark:text-rose-300 border-rose-500/20';
    }
  };

  const filtered = applications.filter(app => {
    if (activeFilter === 'All') return true;
    return app.status === activeFilter;
  });

  const tailoredCount = applications.filter(a => a.status === 'Tailored' || a.tailoredDocUrl).length;
  const interviewingCount = applications.filter(a => a.status === 'Interviewing').length;
  const offeredCount = applications.filter(a => a.status === 'Offered').length;

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* 1. Header & View Toggle Bar */}
      <div className="bg-white dark:bg-[#121215] border border-zinc-200 dark:border-[#27272A] rounded-xl p-5 shadow-xs transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <span>Application Pipeline CRM</span>
              <span className="px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-[10px] font-mono font-bold">
                {applications.length} Total
              </span>
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Monitor your tailored documents, application milestones, interview stages, and offers.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Switcher */}
            <div className="inline-flex p-1 bg-zinc-100 dark:bg-zinc-800/80 rounded-lg text-xs font-semibold border border-zinc-200/60 dark:border-zinc-700/60">
              <button
                type="button"
                onClick={() => setViewMode('kanban')}
                className={`py-1.5 px-3 rounded-md flex items-center gap-1.5 transition-all cursor-pointer ${
                  viewMode === 'kanban'
                    ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                <Kanban className="w-3.5 h-3.5" />
                <span>Kanban Board</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`py-1.5 px-3 rounded-md flex items-center gap-1.5 transition-all cursor-pointer ${
                  viewMode === 'list'
                    ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                <LayoutList className="w-3.5 h-3.5" />
                <span>List View</span>
              </button>
            </div>
          </div>
        </div>

        {/* Top Summary Metrics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-800 mt-4">
          <div className="p-3 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg border border-zinc-200/60 dark:border-zinc-800">
            <span className="text-[10px] font-mono uppercase font-bold text-zinc-400 block">Total Pipeline</span>
            <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100 font-mono">
              {applications.length}
            </span>
          </div>
          <div className="p-3 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg border border-zinc-200/60 dark:border-zinc-800">
            <span className="text-[10px] font-mono uppercase font-bold text-zinc-400 block">Tailored Resumes</span>
            <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100 font-mono">
              {tailoredCount}
            </span>
          </div>
          <div className="p-3 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg border border-zinc-200/60 dark:border-zinc-800">
            <span className="text-[10px] font-mono uppercase font-bold text-zinc-400 block">In Interview</span>
            <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400 font-mono">
              {interviewingCount}
            </span>
          </div>
          <div className="p-3 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg border border-zinc-200/60 dark:border-zinc-800">
            <span className="text-[10px] font-mono uppercase font-bold text-zinc-400 block">Offers Received</span>
            <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400 font-mono">
              {offeredCount}
            </span>
          </div>
        </div>
      </div>

      {/* 2. KANBAN BOARD VIEW */}
      {viewMode === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 items-start">
          {statuses.map(st => {
            const columnApps = applications.filter(a => a.status === st);
            return (
              <div
                key={st}
                className="bg-zinc-50 dark:bg-[#121215] rounded-xl border border-zinc-200 dark:border-[#27272A] p-3 space-y-3 min-h-[420px] flex flex-col"
              >
                {/* Column Header */}
                <div className="flex items-center justify-between pb-2 border-b border-zinc-200/80 dark:border-zinc-800">
                  <span className="font-bold text-xs text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                    <span>{st}</span>
                  </span>
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                    {columnApps.length}
                  </span>
                </div>

                {/* Cards in Column */}
                <div className="space-y-2.5 flex-1 overflow-y-auto max-h-[70vh]">
                  {columnApps.map(app => (
                    <div
                      key={app.id}
                      className="bg-white dark:bg-[#18181B] p-3.5 rounded-lg border border-zinc-200 dark:border-zinc-700/60 shadow-2xs space-y-2 hover:border-zinc-400 dark:hover:border-zinc-500 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-1.5">
                        <div className="min-w-0">
                          <h4 className="font-bold text-xs text-zinc-900 dark:text-zinc-100 truncate">
                            {app.company}
                          </h4>
                          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                            {app.title}
                          </p>
                        </div>
                      </div>

                      {/* Status Selector */}
                      <select
                        value={app.status}
                        onChange={(e) => onUpdateStatus(app.id, e.target.value as ApplicationRecord['status'])}
                        className={`w-full text-[10px] font-semibold px-2 py-1 rounded-md border focus:outline-none cursor-pointer ${getStatusBadge(app.status)}`}
                      >
                        {statuses.map(s => (
                          <option key={s} value={s} className="bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100">
                            {s}
                          </option>
                        ))}
                      </select>

                      {/* ATS Score & Doc Link */}
                      <div className="flex items-center justify-between text-[10px] pt-1 border-t border-zinc-100 dark:border-zinc-800">
                        {app.atsScoreAtApplication ? (
                          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">
                            {app.atsScoreAtApplication}% ATS
                          </span>
                        ) : (
                          <span className="text-zinc-400 font-mono">--</span>
                        )}

                        {app.tailoredDocUrl && (
                          <a
                            href={app.tailoredDocUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 font-semibold text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white"
                          >
                            <FileText className="w-3 h-3 text-zinc-500" />
                            <span>Doc</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}

                  {columnApps.length === 0 && (
                    <div className="text-center py-8 text-zinc-400 text-[11px] border border-dashed border-zinc-200 dark:border-zinc-800/80 rounded-lg">
                      No roles in {st}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 3. LIST VIEW */}
      {viewMode === 'list' && (
        <div className="space-y-4">
          {/* Status Filter Pills */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {['All', ...statuses].map((st) => (
              <button
                key={st}
                onClick={() => setActiveFilter(st)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
                  activeFilter === st
                    ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 font-bold shadow-xs'
                    : 'bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {/* Applications Table / Cards */}
          <div className="space-y-3">
            {filtered.map((app) => (
              <div
                key={app.id}
                className="bg-white dark:bg-[#121215] p-4 rounded-xl border border-zinc-200 dark:border-[#27272A] shadow-xs space-y-3 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                        {app.company}
                      </h3>
                      {app.salary && (
                        <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
                          • {app.salary}
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-medium text-zinc-600 dark:text-zinc-300 mt-0.5">
                      {app.title}
                    </p>
                  </div>

                  {/* Status Dropdown */}
                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      value={app.status}
                      onChange={(e) => onUpdateStatus(app.id, e.target.value as ApplicationRecord['status'])}
                      className={`text-xs font-semibold px-2.5 py-1 rounded-lg border focus:outline-none cursor-pointer ${getStatusBadge(app.status)}`}
                    >
                      {statuses.map(st => (
                        <option key={st} value={st} className="bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100">
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* ATS Score & Linked Doc */}
                <div className="flex items-center justify-between text-xs pt-2 border-t border-zinc-100 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400">
                  <div className="flex items-center gap-2">
                    {app.atsScoreAtApplication && (
                      <span className="font-mono font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 text-xs">
                        {app.atsScoreAtApplication}% ATS Score
                      </span>
                    )}
                  </div>

                  {app.tailoredDocUrl && (
                    <a
                      href={app.tailoredDocUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white font-semibold"
                    >
                      <FileText className="w-3.5 h-3.5 text-zinc-500" />
                      <span>Tailored Google Doc</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            ))}

            {filtered.length === 0 && (
              <div className="text-center py-16 space-y-3 bg-white dark:bg-[#121215] rounded-xl border border-zinc-200 dark:border-[#27272A] p-8 shadow-xs">
                <div className="text-3xl">📋</div>
                <h4 className="text-zinc-900 dark:text-zinc-100 text-sm font-bold">No applications found</h4>
                <p className="text-zinc-500 dark:text-zinc-400 text-xs leading-relaxed max-w-xs mx-auto">
                  Find a job in the Discovery tab, tailor your resume, then submit — it'll appear in your pipeline CRM automatically.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
