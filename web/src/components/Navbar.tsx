import React from 'react';
import { Home, Compass, Kanban, Settings, CheckCircle2, Sun, Moon, Sparkles, FileText, User, Cloud, LogOut } from 'lucide-react';
import { ThemeMode } from '../services/theme.js';
import { ApplicantProfile } from '../types/index.js';

export type NavTab = 'home' | 'canvas' | 'discovery' | 'tracker' | 'profile' | 'settings';

interface NavbarProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  connectedDocTitle?: string;
  newJobsCount?: number;
  themeMode?: ThemeMode;
  isDark?: boolean;
  onToggleTheme?: () => void;
  applicantProfile?: ApplicantProfile;
  currentUser?: { id: string; email?: string; firstName?: string; lastName?: string } | null;
  onOpenAuthModal?: () => void;
  onSignOut?: () => void;
  onOpenCloudManager?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  connectedDocTitle,
  newJobsCount = 0,
  themeMode = 'system',
  isDark = false,
  onToggleTheme,
  applicantProfile,
  currentUser,
  onOpenAuthModal,
  onSignOut,
  onOpenCloudManager,
}) => {
  // Compute user profile initials and display labels dynamically
  const firstName = applicantProfile?.firstName?.trim() || '';
  const lastName = applicantProfile?.lastName?.trim() || '';
  const initials = (firstName || lastName)
    ? `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase()
    : (applicantProfile?.email?.[0] || 'U').toUpperCase();
  const displayName = (firstName || lastName)
    ? `${firstName} ${lastName}`.trim()
    : (applicantProfile?.fullName?.trim() || 'My Profile');
  const displaySubtitle = applicantProfile?.major?.trim() || applicantProfile?.degree?.trim() || 'Candidate Profile';

  return (
    <header className="sticky top-0 z-50 h-16 bg-white/95 dark:bg-[#09090B]/95 backdrop-blur-md border-b border-zinc-200 dark:border-[#27272A] px-4 sm:px-8 lg:px-12 flex items-center justify-between w-full transition-colors duration-200 select-none">
      {/* Left: Brand Workspace Home */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('home')} title="Return to Home">
          <div className="w-8 h-8 rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 flex items-center justify-center font-bold text-xs font-headline tracking-tighter shadow-xs">
            RH
          </div>
          <div className="flex flex-col">
            <span className="font-headline text-sm font-bold tracking-tight text-zinc-950 dark:text-zinc-50 leading-none">
              ResumeHack
            </span>
            <span className="text-[9px] font-mono uppercase tracking-widest text-zinc-500 dark:text-zinc-400 font-semibold leading-tight mt-0.5">
              Intelligence
            </span>
          </div>
        </div>
      </div>

      {/* Center: Desktop Navigation Tabs */}
      <nav className="hidden md:flex items-center gap-1.5 h-full" role="tablist" aria-label="Main Navigation">
        <button
          role="tab"
          aria-selected={activeTab === 'home'}
          onClick={() => setActiveTab('home')}
          className={`h-9 px-4 rounded-lg text-xs font-medium inline-flex items-center gap-2 transition-all ${
            activeTab === 'home'
              ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 font-semibold shadow-xs'
              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-[#18181B]'
          }`}
        >
          <Home className="w-3.5 h-3.5" />
          <span>Home</span>
        </button>

        <button
          role="tab"
          aria-selected={activeTab === 'canvas'}
          onClick={() => setActiveTab('canvas')}
          className={`h-9 px-4 rounded-lg text-xs font-medium inline-flex items-center gap-2 transition-all ${
            activeTab === 'canvas'
              ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 font-semibold shadow-xs'
              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-[#18181B]'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Document Canvas</span>
        </button>

        <button
          role="tab"
          aria-selected={activeTab === 'discovery'}
          onClick={() => setActiveTab('discovery')}
          className={`h-9 px-4 rounded-lg text-xs font-medium inline-flex items-center gap-2 transition-all relative ${
            activeTab === 'discovery'
              ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 font-semibold shadow-xs'
              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-[#18181B]'
          }`}
        >
          <Compass className="w-3.5 h-3.5" />
          <span>Discovery</span>
          {newJobsCount > 0 && (
            <span className="px-1.5 py-0.2 text-[9px] font-mono font-bold bg-emerald-500 text-white rounded-full">
              +{newJobsCount}
            </span>
          )}
        </button>

        <button
          role="tab"
          aria-selected={activeTab === 'tracker'}
          onClick={() => setActiveTab('tracker')}
          className={`h-9 px-4 rounded-lg text-xs font-medium inline-flex items-center gap-2 transition-all ${
            activeTab === 'tracker'
              ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 font-semibold shadow-xs'
              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-[#18181B]'
          }`}
        >
          <Kanban className="w-3.5 h-3.5" />
          <span>Tracker</span>
        </button>

        <button
          role="tab"
          aria-selected={activeTab === 'profile'}
          onClick={() => setActiveTab('profile')}
          className={`h-9 px-4 rounded-lg text-xs font-medium inline-flex items-center gap-2 transition-all ${
            activeTab === 'profile'
              ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 font-semibold shadow-xs'
              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-[#18181B]'
          }`}
        >
          <User className="w-3.5 h-3.5" />
          <span>Profile</span>
        </button>

        <button
          role="tab"
          aria-selected={activeTab === 'settings'}
          onClick={() => setActiveTab('settings')}
          className={`h-9 px-4 rounded-lg text-xs font-medium inline-flex items-center gap-2 transition-all ${
            activeTab === 'settings'
              ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 font-semibold shadow-xs'
              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-[#18181B]'
          }`}
        >
          <Settings className="w-3.5 h-3.5" />
          <span>Settings</span>
        </button>
      </nav>

      {/* Right: Status, Secondary Actions & User Profile */}
      <div className="flex items-center gap-2.5 sm:gap-3.5">
        {/* Supabase Cloud Sync / Auth Button */}
        {currentUser ? (
          <button
            type="button"
            onClick={onOpenCloudManager}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 text-xs font-mono font-semibold cursor-pointer transition-colors shadow-2xs"
            title={`Supabase Cloud Active: ${currentUser.email}. Click to manage cloud resumes.`}
          >
            <Cloud className="w-3.5 h-3.5" />
            <span className="text-[11px]">Cloud Synced</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onOpenAuthModal}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs font-semibold cursor-pointer transition-colors shadow-xs"
            title="Sign in to save and sync your resume persistently with Supabase"
          >
            <Cloud className="w-3.5 h-3.5 text-zinc-400" />
            <span className="text-[11px]">Sign In / Sync</span>
          </button>
        )}

        {/* Quick Theme Toggle Button */}
        {onToggleTheme && (
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            className="w-9 h-9 rounded-lg bg-zinc-100 dark:bg-[#18181B] hover:bg-zinc-200 dark:hover:bg-[#27272A] border border-zinc-200 dark:border-[#27272A] text-zinc-700 dark:text-zinc-300 flex items-center justify-center transition-colors focus-visible:outline-none shadow-xs"
          >
            {isDark ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-zinc-600" />
            )}
          </button>
        )}

        {/* User Profile Monogram Badge */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            aria-label="Open User Profile"
            title="Open User Profile"
            className={`flex items-center gap-2.5 pl-3 border-l border-zinc-200 dark:border-[#27272A] hover:opacity-85 transition-all cursor-pointer group text-left ${
              activeTab === 'profile' ? 'opacity-100' : ''
            }`}
          >
            <div className={`w-8 h-8 rounded-lg font-mono text-xs font-semibold flex items-center justify-center border shadow-xs transition-colors ${
              activeTab === 'profile'
                ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 border-zinc-900 dark:border-white ring-2 ring-zinc-400/30'
                : 'bg-zinc-200 dark:bg-[#27272A] text-zinc-800 dark:text-zinc-200 border-zinc-300 dark:border-[#3F3F46] group-hover:border-zinc-400 dark:group-hover:border-zinc-500'
            }`}>
              {initials}
            </div>
            <div className="hidden xl:flex flex-col text-left">
              <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 leading-none group-hover:text-zinc-950 dark:group-hover:text-white truncate max-w-[130px]">
                {displayName}
              </span>
              <span className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400 leading-tight mt-0.5 truncate max-w-[130px]">
                {displaySubtitle}
              </span>
            </div>
          </button>

          {currentUser && onSignOut && (
            <button
              type="button"
              onClick={onSignOut}
              aria-label="Sign Out"
              title="Sign out of Supabase account"
              className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer ml-1"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

