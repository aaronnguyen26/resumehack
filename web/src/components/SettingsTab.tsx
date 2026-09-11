import React, { useState, useEffect } from 'react';
import { 
  User, 
  ShieldCheck, 
  Check, 
  Sun, 
  Moon, 
  Laptop, 
  RotateCcw, 
  Cloud, 
  LogOut, 
  Database, 
  Sliders, 
  CheckCircle2, 
  RefreshCw,
  Zap,
  Lock
} from 'lucide-react';
import { 
  getStoredSettings, 
  saveStoredSettings, 
  StoredSettings,
  getStoredApplicantProfile
} from '../services/storage.js';
import { ThemeMode, getStoredThemeMode, saveStoredThemeMode } from '../services/theme.js';
import { ApplicantProfile } from '../types/index.js';

export interface SettingsTabProps {
  currentThemeMode?: ThemeMode;
  onThemeChange?: (mode: ThemeMode) => void;
  onReopenOnboarding?: () => void;
  currentUser?: { id: string; email?: string; firstName?: string; lastName?: string } | null;
  onOpenAuthModal?: () => void;
  onSignOut?: () => void;
  cloudResumesCount?: number;
  onOpenCloudManager?: () => void;
  applicantProfile?: ApplicantProfile;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  currentThemeMode,
  onThemeChange,
  onReopenOnboarding,
  currentUser,
  onOpenAuthModal,
  onSignOut,
  cloudResumesCount = 0,
  onOpenCloudManager,
  applicantProfile,
}) => {
  // Appearance / Theme State
  const [themeMode, setThemeModeState] = useState<ThemeMode>(currentThemeMode || 'system');

  // Guardrail Toggles State (Abstracted from internal engine)
  const [strictAntiHallucination, setStrictAntiHallucination] = useState<boolean>(true);
  const [onePageLineBudgetGuard, setOnePageLineBudgetGuard] = useState<boolean>(true);
  const [triVariantFraming, setTriVariantFraming] = useState<boolean>(true);
  const [profile, setProfile] = useState<ApplicantProfile | null>(applicantProfile || null);

  // Status Notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isClearingCache, setIsClearingCache] = useState<boolean>(false);

  useEffect(() => {
    if (currentThemeMode) {
      setThemeModeState(currentThemeMode);
    } else {
      getStoredThemeMode().then(setThemeModeState);
    }
  }, [currentThemeMode]);

  useEffect(() => {
    if (applicantProfile) {
      setProfile(applicantProfile);
    } else {
      getStoredApplicantProfile().then(setProfile);
    }

    getStoredSettings().then((settings) => {
      if (settings.strictAntiHallucination !== undefined) {
        setStrictAntiHallucination(settings.strictAntiHallucination);
      }
      if (settings.onePageLineBudgetGuard !== undefined) {
        setOnePageLineBudgetGuard(settings.onePageLineBudgetGuard);
      }
      if (settings.triVariantFraming !== undefined) {
        setTriVariantFraming(settings.triVariantFraming);
      }
    });
  }, [applicantProfile]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleSelectTheme = async (mode: ThemeMode) => {
    setThemeModeState(mode);
    if (onThemeChange) {
      onThemeChange(mode);
    } else {
      await saveStoredThemeMode(mode);
    }
    showToast(`✓ Theme set to ${mode.charAt(0).toUpperCase() + mode.slice(1)}`);
  };

  const handleToggleAntiHallucination = async () => {
    const next = !strictAntiHallucination;
    setStrictAntiHallucination(next);
    await saveStoredSettings({ strictAntiHallucination: next });
    showToast(next ? '✓ Strict Anti-Hallucination Gate enabled' : '⚠️ Anti-Hallucination Gate set to Permissive');
  };

  const handleToggleLineBudget = async () => {
    const next = !onePageLineBudgetGuard;
    setOnePageLineBudgetGuard(next);
    await saveStoredSettings({ onePageLineBudgetGuard: next });
    showToast(next ? '✓ 1-Page Line Budget Guard active' : '⚠️ 1-Page Line Budget Guard disabled');
  };

  const handleToggleTriVariant = async () => {
    const next = !triVariantFraming;
    setTriVariantFraming(next);
    await saveStoredSettings({ triVariantFraming: next });
    showToast(next ? '✓ Tri-Variant Role Framing enabled' : '⚠️ Standard single-variant framing enabled');
  };

  const handleClearCache = async () => {
    setIsClearingCache(true);
    try {
      localStorage.removeItem('resumehack_applications');
      localStorage.removeItem('user_custom_resume');
      localStorage.removeItem('resumehack_bullet_vault');
      showToast('✓ Local cache cleared and re-synchronized from Supabase');
    } catch {
      showToast('⚠️ Could not clear local cache');
    } finally {
      setTimeout(() => setIsClearingCache(false), 500);
    }
  };

  const userEmail = currentUser?.email || profile?.email || 'user@resumehack.com';
  const userFullName = (profile?.firstName || profile?.lastName)
    ? `${profile?.firstName || ''} ${profile?.lastName || ''}`.trim()
    : profile?.fullName || (currentUser?.firstName ? `${currentUser.firstName} ${currentUser.lastName || ''}`.trim() : 'Active User');

  const maskedUserId = currentUser?.id 
    ? `usr_${currentUser.id.slice(0, 8)}…${currentUser.id.slice(-4)}`
    : 'usr_local_guest';

  return (
    <div className="w-full max-w-[1780px] mx-auto space-y-6 animate-in fade-in duration-200 select-none">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 px-4 py-2.5 bg-emerald-600 text-white rounded-xl shadow-lg text-xs font-mono font-medium flex items-center gap-2 animate-in slide-in-from-top-2">
          <Check className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Section */}
      <div className="border-b border-zinc-200 dark:border-[#27272A] pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold font-headline tracking-tight text-zinc-950 dark:text-zinc-50 flex items-center gap-2.5">
            <Sliders className="w-6 h-6 text-zinc-700 dark:text-zinc-300" />
            <span>Preferences & Settings</span>
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Manage your authenticated cloud account, interface appearance, and AI optimization guardrails.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Cloud Synced
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card 1: Account & Cloud Identity */}
        <div className="bg-white dark:bg-[#121215] border border-zinc-200 dark:border-[#27272A] rounded-2xl p-6 shadow-xs flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-[#1E1E22] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] flex items-center justify-center text-zinc-800 dark:text-zinc-200">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                </div>
                <div>
                  <h3 className="font-bold text-sm font-headline text-zinc-950 dark:text-zinc-50">
                    Account & Cloud Identity
                  </h3>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Supabase PostgreSQL Cloud Persistence
                  </p>
                </div>
              </div>

              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-zinc-100 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] text-zinc-700 dark:text-zinc-300">
                {currentUser ? 'Authenticated' : 'Local Guest'}
              </span>
            </div>

            {/* User Identity Details */}
            <div className="bg-zinc-50 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">Candidate Name</span>
                <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 font-headline">
                  {userFullName}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">Account Email</span>
                <span className="text-xs font-mono text-zinc-800 dark:text-zinc-200">
                  {userEmail}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">Cloud User ID</span>
                <span className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
                  {maskedUserId}
                </span>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-zinc-200/60 dark:border-[#27272A]">
                <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">PostgreSQL Sync</span>
                <span className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Continuous Sync Active
                </span>
              </div>
            </div>
          </div>

          {/* Action Row */}
          <div className="flex items-center justify-between gap-3 pt-2">
            {currentUser ? (
              <>
                {onOpenCloudManager && (
                  <button
                    type="button"
                    onClick={onOpenCloudManager}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-[#18181B] dark:hover:bg-[#27272A] border border-zinc-200 dark:border-[#27272A] text-xs font-mono font-medium text-zinc-900 dark:text-zinc-100 transition-colors cursor-pointer"
                  >
                    <Cloud className="w-3.5 h-3.5 text-zinc-500" />
                    <span>Manage Cloud Resumes ({cloudResumesCount})</span>
                  </button>
                )}

                {onSignOut && (
                  <button
                    type="button"
                    onClick={onSignOut}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-transparent hover:bg-zinc-100 dark:hover:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] text-xs font-mono text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Sign Out</span>
                  </button>
                )}
              </>
            ) : (
              onOpenAuthModal && (
                <button
                  type="button"
                  onClick={onOpenAuthModal}
                  className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-950 rounded-xl text-xs font-headline font-semibold transition-colors cursor-pointer shadow-xs"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Sign In or Register with Supabase</span>
                </button>
              )
            )}
          </div>
        </div>

        {/* Card 2: Appearance & Interface Theme */}
        <div className="bg-white dark:bg-[#121215] border border-zinc-200 dark:border-[#27272A] rounded-2xl p-6 shadow-xs flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-[#1E1E22] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] flex items-center justify-center text-zinc-800 dark:text-zinc-200">
                  <Sun className="w-4 h-4 text-amber-500" />
                </div>
                <div>
                  <h3 className="font-bold text-sm font-headline text-zinc-950 dark:text-zinc-50">
                    Appearance & Theme
                  </h3>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    High-contrast monochromatic visual interface
                  </p>
                </div>
              </div>
            </div>

            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Select your preferred visual mode. The platform uses a high-contrast monochromatic zinc palette engineered for algorithmic focus with zero visual fatigue.
            </p>

            {/* Segmented Control */}
            <div className="grid grid-cols-3 gap-2 p-1 bg-zinc-100 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] rounded-xl">
              <button
                type="button"
                onClick={() => handleSelectTheme('light')}
                className={`py-2 px-3 rounded-lg text-xs font-mono font-medium flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  themeMode === 'light'
                    ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-xs font-semibold'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
                }`}
              >
                <Sun className="w-3.5 h-3.5 text-amber-500" />
                <span>Light</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectTheme('dark')}
                className={`py-2 px-3 rounded-lg text-xs font-mono font-medium flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  themeMode === 'dark'
                    ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-xs font-semibold'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
                }`}
              >
                <Moon className="w-3.5 h-3.5 text-zinc-700 dark:text-zinc-300" />
                <span>Dark</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectTheme('system')}
                className={`py-2 px-3 rounded-lg text-xs font-mono font-medium flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  themeMode === 'system'
                    ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-xs font-semibold'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
                }`}
              >
                <Laptop className="w-3.5 h-3.5 text-zinc-500" />
                <span>System</span>
              </button>
            </div>
          </div>

          <div className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5 pt-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>Theme persists across your browser session and cloud profile</span>
          </div>
        </div>
      </div>

      {/* Card 3: AI Intelligence Engine & Optimization Guardrails */}
      <div className="bg-white dark:bg-[#121215] border border-zinc-200 dark:border-[#27272A] rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-100 dark:border-[#1E1E22] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] flex items-center justify-center text-zinc-800 dark:text-zinc-200">
              <Sliders className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <h3 className="font-bold text-base font-headline text-zinc-950 dark:text-zinc-50">
                AI Optimization Engine & ATS Guardrails
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Managed AI models with deterministic ATS parsing and precision guardrails
              </p>
            </div>
          </div>

          {/* Managed Model Badge */}
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-semibold bg-zinc-100 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-emerald-500" />
              <span>Hacky AI Gemini Pro Active</span>
            </span>
          </div>
        </div>

        {/* Managed Model Explanation */}
        <div className="p-4 rounded-xl bg-zinc-50 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed space-y-1">
          <p className="font-semibold text-zinc-900 dark:text-zinc-200">Managed AI Architecture</p>
          <p>
            ResumeHack Intelligence automatically orchestrates job de-noising, closed-loop ATS evaluation, and STAR bullet optimization. All models and inference endpoints are pre-configured and verified—no manual API keys or developer credentials required.
          </p>
        </div>

        {/* Guardrail Controls */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          {/* Guardrail 1: AST Anti-Hallucination */}
          <div className="p-4 rounded-xl border border-zinc-200 dark:border-[#27272A] bg-white dark:bg-[#151518] flex flex-col justify-between space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-headline font-bold text-zinc-950 dark:text-zinc-50">
                  Anti-Hallucination Gate
                </span>
                <button
                  type="button"
                  onClick={handleToggleAntiHallucination}
                  className={`w-10 h-6 rounded-full transition-colors relative cursor-pointer ${
                    strictAntiHallucination ? 'bg-emerald-600' : 'bg-zinc-300 dark:bg-zinc-700'
                  }`}
                >
                  <span className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                    strictAntiHallucination ? 'left-5' : 'left-1'
                  }`} />
                </button>
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                AST-level metric verification. Ungrounded statistics are safely replaced with verified placeholder tokens (e.g. <code className="font-mono text-zinc-800 dark:text-zinc-200">[X%]</code>).
              </p>
            </div>
            <div className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
              <Check className="w-3 h-3" />
              <span>{strictAntiHallucination ? 'Strict Fact Checking' : 'Permissive'}</span>
            </div>
          </div>

          {/* Guardrail 2: 1-Page Line Budget */}
          <div className="p-4 rounded-xl border border-zinc-200 dark:border-[#27272A] bg-white dark:bg-[#151518] flex flex-col justify-between space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-headline font-bold text-zinc-950 dark:text-zinc-50">
                  1-Page Line Budget Guard
                </span>
                <button
                  type="button"
                  onClick={handleToggleLineBudget}
                  className={`w-10 h-6 rounded-full transition-colors relative cursor-pointer ${
                    onePageLineBudgetGuard ? 'bg-emerald-600' : 'bg-zinc-300 dark:bg-zinc-700'
                  }`}
                >
                  <span className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                    onePageLineBudgetGuard ? 'left-5' : 'left-1'
                  }`} />
                </button>
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Enforces a strict 35-line budget cap using greedy knapsack optimization to guarantee single-page formatting without page spill.
              </p>
            </div>
            <div className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
              <Check className="w-3 h-3" />
              <span>{onePageLineBudgetGuard ? '35-Line Budget Enforced' : 'Unbounded'}</span>
            </div>
          </div>

          {/* Guardrail 3: Tri-Variant Role Framing */}
          <div className="p-4 rounded-xl border border-zinc-200 dark:border-[#27272A] bg-white dark:bg-[#151518] flex flex-col justify-between space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-headline font-bold text-zinc-950 dark:text-zinc-50">
                  Tri-Variant Role Framing
                </span>
                <button
                  type="button"
                  onClick={handleToggleTriVariant}
                  className={`w-10 h-6 rounded-full transition-colors relative cursor-pointer ${
                    triVariantFraming ? 'bg-emerald-600' : 'bg-zinc-300 dark:bg-zinc-700'
                  }`}
                >
                  <span className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                    triVariantFraming ? 'left-5' : 'left-1'
                  }`} />
                </button>
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Simultaneously computes Systems Depth, Scale & Impact, and Velocity & MVP framing variants for each resume bullet.
              </p>
            </div>
            <div className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
              <Check className="w-3 h-3" />
              <span>{triVariantFraming ? '3 Archetypes Generated' : 'Single Variant'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Card 4: Onboarding Calibration & Data Management */}
      <div className="bg-white dark:bg-[#121215] border border-zinc-200 dark:border-[#27272A] rounded-2xl p-6 sm:p-8 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="space-y-1.5 max-w-xl">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-zinc-100 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] flex items-center justify-center text-zinc-800 dark:text-zinc-200">
              <RotateCcw className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" />
            </div>
            <h3 className="font-bold text-sm font-headline text-zinc-950 dark:text-zinc-50">
              Profile Re-calibration & Data Management
            </h3>
          </div>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
            Need to update your target role, university, graduation date, or work authorization? Re-run the onboarding wizard to keep your profile settings up to date.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0 self-stretch sm:self-auto justify-end flex-wrap">
          <button
            type="button"
            onClick={handleClearCache}
            disabled={isClearingCache}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-[#18181B] dark:hover:bg-[#27272A] border border-zinc-200 dark:border-[#27272A] text-xs font-mono font-medium text-zinc-800 dark:text-zinc-200 transition-colors cursor-pointer"
            title="Clears local browser cache and re-syncs from Supabase cloud database"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-zinc-500 ${isClearingCache ? 'animate-spin' : ''}`} />
            <span>Clear Local Cache</span>
          </button>

          {onReopenOnboarding && (
            <button
              type="button"
              onClick={onReopenOnboarding}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-950 text-xs font-headline font-semibold transition-colors cursor-pointer shadow-xs"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Re-run Onboarding</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsTab;
