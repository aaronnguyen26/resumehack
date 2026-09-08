import React from 'react';
import { Target, Compass, Kanban, Settings, CheckCircle2, Sun, Moon } from 'lucide-react';
import { ThemeMode } from '../../services/theme.js';

interface NavbarProps {
  activeTab: 'match' | 'discovery' | 'tracker' | 'settings';
  setActiveTab: (tab: 'match' | 'discovery' | 'tracker' | 'settings') => void;
  connectedDocTitle?: string;
  newJobsCount?: number;
  themeMode?: ThemeMode;
  isDark?: boolean;
  onToggleTheme?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  connectedDocTitle,
  newJobsCount = 0,
  themeMode = 'system',
  isDark = false,
  onToggleTheme,
}) => {
  return (
    <header className="sticky top-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200 dark:border-slate-800 px-4 py-3 shadow-xs transition-colors duration-200">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-stitch bg-brand-600 flex items-center justify-center text-white shadow-sm font-headline font-bold text-base select-none">
            RH
          </div>
          <div>
            <div className="font-headline font-bold text-sm tracking-tight text-slate-900 dark:text-white leading-tight">
              ResumeHack
            </div>
            <div className="text-[10px] font-mono text-brand-600 dark:text-brand-400 uppercase tracking-wider font-semibold">
              Hacky AI
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Google Doc connectivity indicator */}
          <div 
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 max-w-[155px] truncate"
            title={connectedDocTitle ? `Connected to: ${connectedDocTitle}` : 'No Google Doc currently detected'}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="truncate text-[11px] font-medium text-slate-800 dark:text-slate-200">
              {connectedDocTitle ? connectedDocTitle.replace(' - Google Docs', '') : 'Doc Ready'}
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 animate-pulse" aria-hidden="true"></span>
          </div>

          {/* Quick Theme Toggle Button */}
          {onToggleTheme && (
            <button
              type="button"
              onClick={onToggleTheme}
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              className="p-1.5 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              {isDark ? (
                <Sun className="w-3.5 h-3.5 text-amber-400" />
              ) : (
                <Moon className="w-3.5 h-3.5 text-slate-600" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Tabs with ARIA accessibility & notification badge */}
      <nav className="flex items-center gap-1 p-1 bg-slate-100/80 dark:bg-slate-800/80 rounded-stitch transition-colors duration-200" role="tablist" aria-label="Sidepanel Navigation">
        <button
          role="tab"
          aria-selected={activeTab === 'match'}
          onClick={() => setActiveTab('match')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 min-h-[36px] rounded-md text-xs font-semibold tab-transition focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none ${
            activeTab === 'match'
              ? 'bg-white dark:bg-slate-900 text-brand-700 dark:text-brand-400 shadow-sm border border-transparent dark:border-slate-700/60'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Target className="w-3.5 h-3.5" />
          <span>Tailor</span>
        </button>

        <button
          role="tab"
          aria-selected={activeTab === 'discovery'}
          onClick={() => setActiveTab('discovery')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 min-h-[36px] rounded-md text-xs font-semibold tab-transition relative focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none ${
            activeTab === 'discovery'
              ? 'bg-white dark:bg-slate-900 text-brand-700 dark:text-brand-400 shadow-sm border border-transparent dark:border-slate-700/60'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Compass className="w-3.5 h-3.5" />
          <span>Jobs</span>
          {newJobsCount > 0 && (
            <span className="px-1.5 py-0.2 text-[9px] font-mono font-bold bg-emerald-600 dark:bg-emerald-500 text-white rounded-full leading-tight">
              +{newJobsCount}
            </span>
          )}
        </button>

        <button
          role="tab"
          aria-selected={activeTab === 'tracker'}
          onClick={() => setActiveTab('tracker')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 min-h-[36px] rounded-md text-xs font-semibold tab-transition focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none ${
            activeTab === 'tracker'
              ? 'bg-white dark:bg-slate-900 text-brand-700 dark:text-brand-400 shadow-sm border border-transparent dark:border-slate-700/60'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Kanban className="w-3.5 h-3.5" />
          <span>Tracker</span>
        </button>

        <button
          role="tab"
          aria-selected={activeTab === 'settings'}
          aria-label="Extension Settings"
          onClick={() => setActiveTab('settings')}
          className={`flex items-center justify-center py-2 px-2.5 min-h-[36px] min-w-[36px] rounded-md text-xs font-semibold tab-transition focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none ${
            activeTab === 'settings'
              ? 'bg-white dark:bg-slate-900 text-brand-700 dark:text-brand-400 shadow-sm border border-transparent dark:border-slate-700/60'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Settings className="w-3.5 h-3.5" />
        </button>
      </nav>
    </header>
  );
};
