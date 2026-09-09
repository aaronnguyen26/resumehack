import React, { useState } from 'react';
import { ApplicationRecord } from '../types/index.js';
import { Kanban, FileText, ExternalLink, Calendar, Plus, CheckCircle } from 'lucide-react';

interface TrackerTabProps {
  applications: ApplicationRecord[];
  onUpdateStatus: (id: string, newStatus: ApplicationRecord['status']) => void;
}

export const TrackerTab: React.FC<TrackerTabProps> = ({
  applications,
  onUpdateStatus
}) => {
  const [activeFilter, setActiveFilter] = useState<string>('All');

  const statuses: ApplicationRecord['status'][] = [
    'Bookmarked',
    'Tailored',
    'Applied',
    'Interviewing',
    'Offered',
    'Rejected'
  ];

  const getStatusColor = (status: ApplicationRecord['status']) => {
    switch (status) {
      case 'Bookmarked': return 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700';
      case 'Tailored': return 'bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 border-brand-200 dark:border-brand-800/60';
      case 'Applied': return 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/60';
      case 'Interviewing': return 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/60';
      case 'Offered': return 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60';
      case 'Rejected': return 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/60';
    }
  };

  const filtered = applications.filter(app => {
    if (activeFilter === 'All') return true;
    return app.status === activeFilter;
  });

  return (
    <div className="p-4 space-y-4 pb-16">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-headline font-bold text-sm text-slate-900 dark:text-white">
            Application Pipeline CRM
          </h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Track your tailored resumes, interview stages, and offers.
          </p>
        </div>
        <span className="font-mono text-[10px] font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full border border-transparent dark:border-slate-700">
          {applications.length} Total
        </span>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1 no-scrollbar">
        {['All', ...statuses].map((st) => (
          <button
            key={st}
            onClick={() => setActiveFilter(st)}
            className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${
              activeFilter === st
                ? 'bg-slate-900 dark:bg-brand-600 text-white shadow-sm'
                : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
          >
            {st}
          </button>
        ))}
      </div>

      {/* Applications List */}
      <div className="space-y-3">
        {filtered.map((app) => (
          <div
            key={app.id}
            className="bg-white dark:bg-slate-900 p-3.5 rounded-stitch border border-slate-200 dark:border-slate-800 shadow-sm space-y-2.5 transition-colors duration-200"
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-headline font-bold text-xs text-slate-900 dark:text-white">
                  {app.company}
                </h3>
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {app.title}
                </p>
              </div>

              {/* Status Select dropdown */}
              <select
                value={app.status}
                onChange={(e) => onUpdateStatus(app.id, e.target.value as ApplicationRecord['status'])}
                className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border focus:outline-none cursor-pointer ${getStatusColor(app.status)}`}
              >
                {statuses.map(st => (
                  <option key={st} value={st} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">{st}</option>
                ))}
              </select>
            </div>

            {/* ATS Score & Linked Doc */}
            <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-2">
                {app.atsScoreAtApplication && (
                  <span className="font-mono font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.2 rounded border border-emerald-200 dark:border-emerald-800/60 text-[10px]">
                    {app.atsScoreAtApplication}% ATS
                  </span>
                )}
                {app.salary && (
                  <span className="font-mono text-[10px] text-slate-600 dark:text-slate-400">
                    {app.salary}
                  </span>
                )}
              </div>

              {app.tailoredDocUrl && (
                <a
                  href={app.tailoredDocUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-brand-700 dark:text-brand-400 hover:text-brand-900 dark:hover:text-brand-300 font-semibold"
                >
                  <FileText className="w-3 h-3 text-brand-600 dark:text-brand-400" />
                  <span>Tailored Doc</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              )}
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="text-center py-10 space-y-2">
            <div className="text-2xl">📋</div>
            <p className="text-slate-600 dark:text-slate-300 text-xs font-semibold">No applications yet</p>
            <p className="text-slate-400 dark:text-slate-500 text-[10px] leading-relaxed max-w-[200px] mx-auto">
              Find a job in the Discovery tab, tailor your resume, then submit — it'll appear here automatically.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
