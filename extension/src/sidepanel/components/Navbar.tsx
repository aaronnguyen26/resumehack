import React from 'react';
import { Target, Compass, Kanban, Settings, FileText, CheckCircle2 } from 'lucide-react';

interface NavbarProps {
  activeTab: 'match' | 'discovery' | 'tracker' | 'settings';
  setActiveTab: (tab: 'match' | 'discovery' | 'tracker' | 'settings') => void;
  connectedDocTitle?: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  connectedDocTitle
}) => {
  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-slate-200 px-4 py-3">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-stitch bg-brand-600 flex items-center justify-center text-white shadow-sm font-headline font-bold text-base">
            RH
          </div>
          <div>
            <div className="font-headline font-bold text-sm tracking-tight text-slate-900 leading-tight">
              ResumeHack
            </div>
            <div className="text-[10px] font-mono text-brand-600 uppercase tracking-wider font-semibold">
              Precision Copilot
            </div>
          </div>
        </div>

        {/* Google Doc connectivity indicator */}
        <div 
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-xs font-medium text-slate-700 max-w-[150px] truncate"
          title={connectedDocTitle ? `Connected to: ${connectedDocTitle}` : 'No Google Doc currently detected'}
        >
          <FileText className="w-3.5 h-3.5 text-brand-600 shrink-0" />
          <span className="truncate text-[11px]">
            {connectedDocTitle ? connectedDocTitle.replace(' - Google Docs', '') : 'Doc Ready'}
          </span>
          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
        </div>
      </div>

      {/* Tabs */}
      <nav className="flex items-center gap-1 p-1 bg-slate-100/80 rounded-stitch">
        <button
          onClick={() => setActiveTab('match')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-xs font-semibold tab-transition ${
            activeTab === 'match'
              ? 'bg-white text-brand-700 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Target className="w-3.5 h-3.5" />
          <span>Tailor</span>
        </button>

        <button
          onClick={() => setActiveTab('discovery')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-xs font-semibold tab-transition ${
            activeTab === 'discovery'
              ? 'bg-white text-brand-700 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Compass className="w-3.5 h-3.5" />
          <span>Jobs</span>
        </button>

        <button
          onClick={() => setActiveTab('tracker')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-xs font-semibold tab-transition ${
            activeTab === 'tracker'
              ? 'bg-white text-brand-700 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Kanban className="w-3.5 h-3.5" />
          <span>Tracker</span>
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`flex items-center justify-center py-1.5 px-2 rounded-md text-xs font-semibold tab-transition ${
            activeTab === 'settings'
              ? 'bg-white text-brand-700 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Settings className="w-3.5 h-3.5" />
        </button>
      </nav>
    </header>
  );
};
