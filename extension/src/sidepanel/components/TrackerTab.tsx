import React, { useState } from 'react';
import { ApplicationRecord } from '../../types/index.js';
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
      case 'Bookmarked': return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'Tailored': return 'bg-brand-50 text-brand-700 border-brand-200';
      case 'Applied': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Interviewing': return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'Offered': return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'Rejected': return 'bg-rose-50 text-rose-700 border-rose-200';
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
          <h2 className="font-headline font-bold text-sm text-slate-900">
            Application Pipeline CRM
          </h2>
          <p className="text-[11px] text-slate-500">
            Track your tailored resumes, interview stages, and offers.
          </p>
        </div>
        <span className="font-mono text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
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
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
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
            className="bg-white p-3.5 rounded-stitch border border-slate-200 shadow-sm space-y-2.5"
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-headline font-bold text-xs text-slate-900">
                  {app.company}
                </h3>
                <p className="text-xs font-semibold text-slate-700">
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
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </div>

            {/* ATS Score & Linked Doc */}
            <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-100 text-slate-500">
              <div className="flex items-center gap-2">
                {app.atsScoreAtApplication && (
                  <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200 text-[10px]">
                    {app.atsScoreAtApplication}% ATS
                  </span>
                )}
                {app.salary && (
                  <span className="font-mono text-[10px] text-slate-600">
                    {app.salary}
                  </span>
                )}
              </div>

              {app.tailoredDocUrl && (
                <a
                  href={app.tailoredDocUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-brand-700 hover:text-brand-900 font-semibold"
                >
                  <FileText className="w-3 h-3 text-brand-600" />
                  <span>Tailored Doc</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              )}
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="text-center py-8 text-slate-400 text-xs">
            No applications in this category yet.
          </div>
        )}
      </div>
    </div>
  );
};
