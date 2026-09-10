import React from 'react';
import { Home, Compass, Kanban, Settings, FileText, User, Sun, Moon } from 'lucide-react';
import { ThemeMode } from '../services/theme.js';
import { ApplicantProfile } from '../types/index.js';

export type NavTab = 'home' | 'canvas' | 'discovery' | 'tracker' | 'profile' | 'settings';

export interface NavbarProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  connectedDocTitle?: string;
  newJobsCount?: number;
  themeMode?: ThemeMode;
  isDark?: boolean;
  onToggleTheme?: () => void;
  applicantProfile?: ApplicantProfile;
  // Supabase Cloud Synced accounts and triggers are managed in ProfileTab and DocumentCanvas
  currentUser?: { id: string; email?: string; firstName?: string; lastName?: string } | null;
  onOpenAuthModal?: () => void;
  onSignOut?: () => void;
  onOpenCloudManager?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  newJobsCount = 0,
  isDark = false,
  onToggleTheme,
}) => {
  return (
    <header className="sticky top-0 z-50 h-16 bg-white/95 dark:bg-[#09090B]/95 backdrop-blur-md border-b border-zinc-200 dark:border-[#27272A] px-4 sm:px-8 lg:px-12 flex items-center justify-between gap-6 w-full text-zinc-950 dark:text-zinc-50 transition-colors duration-200 select-none">
      {/* 5 Navigation Pages Equally Spaced Across the Navigation Bar */}
      <nav className="w-full grid grid-cols-5 gap-2 sm:gap-4 lg:gap-6 h-full items-center" role="tablist" aria-label="Main Navigation">
        <button
          role="tab"
          aria-selected={activeTab === 'home'}
          onClick={() => setActiveTab('home')}
          className={`h-10 px-2 sm:px-4 rounded-xl text-xs font-medium inline-flex items-center justify-center gap-2 transition-all w-full text-center cursor-pointer ${
            activeTab === 'home'
              ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 font-semibold shadow-xs'
              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-[#18181B]'
          }`}
        >
          <Home className="w-4 h-4 shrink-0" />
          <span>Home</span>
        </button>

        <button
          role="tab"
          aria-selected={activeTab === 'canvas'}
          onClick={() => setActiveTab('canvas')}
          className={`h-10 px-2 sm:px-4 rounded-xl text-xs font-medium inline-flex items-center justify-center gap-2 transition-all w-full text-center cursor-pointer ${
            activeTab === 'canvas'
              ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 font-semibold shadow-xs'
              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-[#18181B]'
          }`}
        >
          <FileText className="w-4 h-4 shrink-0" />
          <span>Document Canvas</span>
        </button>

        <button
          role="tab"
          aria-selected={activeTab === 'discovery'}
          onClick={() => setActiveTab('discovery')}
          className={`h-10 px-2 sm:px-4 rounded-xl text-xs font-medium inline-flex items-center justify-center gap-2 transition-all w-full text-center relative cursor-pointer ${
            activeTab === 'discovery'
              ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 font-semibold shadow-xs'
              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-[#18181B]'
          }`}
        >
          <Compass className="w-4 h-4 shrink-0" />
          <span>Discovery</span>
          {newJobsCount > 0 && (
            <span className="px-1.5 py-0.2 text-[9px] font-mono font-bold bg-emerald-500 text-white rounded-full ml-0.5">
              +{newJobsCount}
            </span>
          )}
        </button>

        <button
          role="tab"
          aria-selected={activeTab === 'tracker'}
          onClick={() => setActiveTab('tracker')}
          className={`h-10 px-2 sm:px-4 rounded-xl text-xs font-medium inline-flex items-center justify-center gap-2 transition-all w-full text-center cursor-pointer ${
            activeTab === 'tracker'
              ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 font-semibold shadow-xs'
              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-[#18181B]'
          }`}
        >
          <Kanban className="w-4 h-4 shrink-0" />
          <span>Tracker</span>
        </button>

        <button
          role="tab"
          aria-selected={activeTab === 'profile' || activeTab === 'settings'}
          onClick={() => setActiveTab('profile')}
          className={`h-10 px-2 sm:px-4 rounded-xl text-xs font-medium inline-flex items-center justify-center gap-2 transition-all w-full text-center cursor-pointer ${
            activeTab === 'profile' || activeTab === 'settings'
              ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 font-semibold shadow-xs'
              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-[#18181B]'
          }`}
        >
          <User className="w-4 h-4 shrink-0" />
          <span>Profile</span>
        </button>
      </nav>

      {/* Discrete Quick Theme Toggle Button */}
      {onToggleTheme && (
        <button
          type="button"
          onClick={onToggleTheme}
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          className="ml-3 sm:ml-4 w-9 h-9 rounded-lg bg-zinc-100 dark:bg-[#18181B] hover:bg-zinc-200 dark:hover:bg-[#27272A] border border-zinc-200 dark:border-[#27272A] text-zinc-700 dark:text-zinc-300 flex items-center justify-center transition-colors focus-visible:outline-none shadow-xs shrink-0 cursor-pointer"
        >
          {isDark ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-zinc-600" />
          )}
        </button>
      )}
    </header>
  );
};

export default Navbar;
