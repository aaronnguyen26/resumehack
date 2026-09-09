import React, { useState } from 'react';
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Globe, 
  Linkedin, 
  Github, 
  GraduationCap, 
  Award, 
  Calendar, 
  ShieldCheck, 
  CheckCircle2, 
  Edit3, 
  RotateCcw, 
  FileText, 
  Check, 
  ExternalLink,
  Sparkles,
  ArrowRight,
  Layers,
  Cloud,
  Database,
  LogIn,
  LogOut
} from 'lucide-react';
import { ApplicantProfile } from '../types/index.js';

interface ProfileTabProps {
  profile: ApplicantProfile;
  onUpdateProfile: (updated: ApplicantProfile) => Promise<void> | void;
  onReopenOnboarding: () => void;
  onNavigateToWorkspace?: (mode?: 'google_docs' | 'in_app_canvas') => void;
  connectedDocTitle?: string;
  workspaceMode?: 'google_docs' | 'in_app_canvas';
  currentUser?: { id: string; email?: string; firstName?: string; lastName?: string } | null;
  onOpenAuthModal?: () => void;
  onSignOut?: () => void;
  cloudResumesCount?: number;
  onOpenCloudManager?: () => void;
}

export const ProfileTab: React.FC<ProfileTabProps> = ({
  profile,
  onUpdateProfile,
  onReopenOnboarding,
  onNavigateToWorkspace,
  connectedDocTitle,
  workspaceMode = 'in_app_canvas',
  currentUser,
  onOpenAuthModal,
  onSignOut,
  cloudResumesCount = 0,
  onOpenCloudManager,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<ApplicantProfile>({ ...profile });
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  // Compute initials dynamically from user profile
  const firstName = (profile.firstName || '').trim();
  const lastName = (profile.lastName || '').trim();
  const initials = (firstName || lastName)
    ? `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase()
    : (profile.email?.[0] || 'U').toUpperCase();

  const displayName = firstName || lastName
    ? `${firstName} ${lastName}`.trim()
    : profile.fullName || 'Candidate Profile';

  const academicSubtitle = [profile.degree, profile.major, profile.school]
    .filter(Boolean)
    .join(' • ') || 'Applicant Candidate';

  const formatWorkAuth = (auth: ApplicantProfile['workAuthorization']) => {
    switch (auth) {
      case 'US_CITIZEN':
        return 'US Citizen';
      case 'PERMANENT_RESIDENT':
        return 'Permanent Resident (Green Card)';
      case 'F1_OPT':
        return 'F-1 (OPT / STEM OPT)';
      case 'REQUIRES_SPONSORSHIP':
        return 'Requires Visa Sponsorship';
      default:
        return 'Authorized to Work';
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const updated = {
      ...formData,
      fullName: `${formData.firstName} ${formData.lastName}`.trim(),
    };
    await onUpdateProfile(updated);
    setIsEditing(false);
    setSaveStatus('✓ Profile updated successfully');
    setTimeout(() => setSaveStatus(null), 3500);
  };

  const handleCancel = () => {
    setFormData({ ...profile });
    setIsEditing(false);
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8 animate-in fade-in duration-200 select-none">
      {/* Toast Notification */}
      {saveStatus && (
        <div className="fixed top-20 right-6 z-50 px-4 py-2.5 bg-emerald-600 text-white rounded-lg shadow-lg text-xs font-medium flex items-center gap-2 animate-in slide-in-from-top-2">
          <Check className="w-4 h-4" />
          <span>{saveStatus}</span>
        </div>
      )}

      {/* Profile Hero Header Card */}
      <div className="relative bg-white dark:bg-[#121215] border border-zinc-200 dark:border-[#27272A] rounded-2xl p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Left: Avatar & Identity */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            <div className="relative shrink-0">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-zinc-100 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] flex items-center justify-center font-headline text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 shadow-inner">
                {initials}
              </div>
              {/* Emerald verified badge */}
              <div 
                title="Verified Onboarding Profile"
                className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-white dark:bg-[#121215] border-2 border-white dark:border-[#121215] flex items-center justify-center shadow-xs"
              >
                <CheckCircle2 className="w-5 h-5 text-emerald-500 fill-emerald-500/20" />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="font-headline text-2xl sm:text-3xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50">
                  {displayName}
                </h1>
                <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400 font-medium px-2 py-0.5 rounded bg-zinc-100 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A]">
                  Active Profile
                </span>
              </div>

              <p className="text-sm text-zinc-600 dark:text-zinc-400 font-medium">
                {academicSubtitle}
              </p>

              {/* Status Chips */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Onboarding Complete
                </span>

                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A]">
                  <ShieldCheck className="w-3.5 h-3.5 text-zinc-500" />
                  {formatWorkAuth(profile.workAuthorization)}
                </span>

                {profile.location && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A]">
                    <MapPin className="w-3.5 h-3.5 text-zinc-500" />
                    {profile.location}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-3 shrink-0 self-start lg:self-center">
            <button
              type="button"
              onClick={onReopenOnboarding}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-[#18181B] dark:hover:bg-[#27272A] border border-zinc-200 dark:border-[#27272A] text-zinc-800 dark:text-zinc-200 text-xs font-mono transition-colors shadow-xs"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Re-run Onboarding</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (isEditing) {
                  handleCancel();
                } else {
                  setIsEditing(true);
                }
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-950 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-950 text-xs font-headline font-semibold transition-colors shadow-xs"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>{isEditing ? 'Cancel Edit' : 'Edit Profile'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Supabase Cloud Account & Resume Persistence */}
      <div className="bg-white dark:bg-[#121215] border border-zinc-200 dark:border-[#27272A] rounded-2xl p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
        <div className="flex items-start sm:items-center gap-4">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border ${
            currentUser 
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400' 
              : 'bg-zinc-100 dark:bg-[#18181B] border-zinc-200 dark:border-[#27272A] text-zinc-600 dark:text-zinc-400'
          }`}>
            <Database className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-headline font-bold text-zinc-950 dark:text-zinc-50">
                {currentUser ? 'Supabase Cloud Account Connected' : 'Guest Mode (Local Storage Only)'}
              </h3>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium border ${
                currentUser
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                  : 'bg-zinc-100 dark:bg-[#18181B] border-zinc-200 dark:border-[#27272A] text-zinc-600 dark:text-zinc-400'
              }`}>
                {currentUser ? (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Cloud Synced
                  </>
                ) : (
                  'Unauthenticated'
                )}
              </span>
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-xl">
              {currentUser ? (
                <>
                  Logged in as <strong className="text-zinc-900 dark:text-zinc-200 font-mono">{currentUser.email}</strong>. 
                  Your profile and resumes ({cloudResumesCount} saved version{cloudResumesCount === 1 ? '' : 's'}) are automatically synced to PostgreSQL database.
                </>
              ) : (
                'Your resumes and profile are currently only saved locally in this browser. Create or log into your Supabase account to sync your resumes persistently across devices and prevent loss.'
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-stretch sm:self-auto justify-end">
          {currentUser ? (
            <>
              {onOpenCloudManager && (
                <button
                  type="button"
                  onClick={onOpenCloudManager}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-[#18181B] dark:hover:bg-[#27272A] border border-zinc-200 dark:border-[#27272A] text-xs font-mono font-medium text-zinc-900 dark:text-zinc-100 transition-colors"
                >
                  <Cloud className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Manage Resumes ({cloudResumesCount})</span>
                </button>
              )}
              {onSignOut && (
                <button
                  type="button"
                  onClick={onSignOut}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-transparent hover:bg-zinc-100 dark:hover:bg-[#18181B] border border-transparent hover:border-zinc-200 dark:hover:border-[#27272A] text-xs font-mono text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                  title="Sign out of Supabase"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              )}
            </>
          ) : (
            onOpenAuthModal && (
              <button
                type="button"
                onClick={onOpenAuthModal}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-zinc-950 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-950 text-xs font-headline font-semibold transition-colors shadow-xs"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In / Create Account</span>
              </button>
            )
          )}
        </div>
      </div>
      {isEditing ? (
        <form onSubmit={handleSave} className="bg-white dark:bg-[#121215] border border-zinc-200 dark:border-[#27272A] rounded-2xl p-6 sm:p-8 space-y-6 shadow-xs">
          <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-[#1E1E22]">
            <h2 className="text-base font-headline font-bold text-zinc-950 dark:text-zinc-50">
              Edit Applicant Profile
            </h2>
            <span className="text-xs text-zinc-500 font-mono">Changes apply to Auto-Fill & ATS Engine</span>
          </div>

          {/* Contact Fields */}
          <div className="space-y-4">
            <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-500 font-semibold">
              Contact Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">First Name</label>
                <input
                  type="text"
                  required
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Last Name</label>
                <input
                  type="text"
                  required
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Phone</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-500"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Location</label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="e.g. San Francisco, CA"
                  className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-500"
                />
              </div>
            </div>
          </div>

          {/* Links Fields */}
          <div className="space-y-4 pt-4 border-t border-zinc-100 dark:border-[#1E1E22]">
            <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-500 font-semibold">
              Digital Profiles & Portals
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">LinkedIn URL</label>
                <input
                  type="url"
                  value={formData.linkedinUrl}
                  onChange={(e) => setFormData({ ...formData, linkedinUrl: e.target.value })}
                  placeholder="https://linkedin.com/in/..."
                  className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">GitHub URL</label>
                <input
                  type="url"
                  value={formData.githubUrl}
                  onChange={(e) => setFormData({ ...formData, githubUrl: e.target.value })}
                  placeholder="https://github.com/..."
                  className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Portfolio Website</label>
                <input
                  type="url"
                  value={formData.portfolioUrl || ''}
                  onChange={(e) => setFormData({ ...formData, portfolioUrl: e.target.value })}
                  placeholder="https://mywebsite.dev"
                  className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-500"
                />
              </div>
            </div>
          </div>

          {/* Education Fields */}
          <div className="space-y-4 pt-4 border-t border-zinc-100 dark:border-[#1E1E22]">
            <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-500 font-semibold">
              Education & Academics
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">University / College</label>
                <input
                  type="text"
                  value={formData.school}
                  onChange={(e) => setFormData({ ...formData, school: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Degree Type</label>
                <input
                  type="text"
                  value={formData.degree}
                  onChange={(e) => setFormData({ ...formData, degree: e.target.value })}
                  placeholder="e.g. B.S., M.S."
                  className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Major / Field</label>
                <input
                  type="text"
                  value={formData.major}
                  onChange={(e) => setFormData({ ...formData, major: e.target.value })}
                  placeholder="e.g. Computer Science"
                  className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">GPA</label>
                <input
                  type="text"
                  value={formData.gpa || ''}
                  onChange={(e) => setFormData({ ...formData, gpa: e.target.value })}
                  placeholder="e.g. 3.9"
                  className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Graduation (Month/Year)</label>
                <input
                  type="text"
                  value={formData.gradMonthYear}
                  onChange={(e) => setFormData({ ...formData, gradMonthYear: e.target.value })}
                  placeholder="e.g. May 2026"
                  className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Work Authorization</label>
                <select
                  value={formData.workAuthorization}
                  onChange={(e) => setFormData({ ...formData, workAuthorization: e.target.value as any })}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-500"
                >
                  <option value="US_CITIZEN">US Citizen</option>
                  <option value="PERMANENT_RESIDENT">Permanent Resident (Green Card)</option>
                  <option value="F1_OPT">F-1 (OPT / STEM OPT)</option>
                  <option value="REQUIRES_SPONSORSHIP">Requires Sponsorship</option>
                  <option value="OTHER">Other / Legal Authorization</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-100 dark:border-[#1E1E22]">
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 rounded-lg border border-zinc-200 dark:border-[#27272A] text-zinc-700 dark:text-zinc-300 text-xs font-medium hover:bg-zinc-100 dark:hover:bg-[#18181B]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-zinc-950 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-950 text-xs font-headline font-semibold shadow-xs"
            >
              Save Profile Changes
            </button>
          </div>
        </form>
      ) : (
        /* Presentation Bento Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1: Personal & Contact Information */}
          <div className="bg-white dark:bg-[#121215] border border-zinc-200 dark:border-[#27272A] rounded-xl p-6 space-y-4 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-[#1E1E22]">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
                <h3 className="font-headline font-bold text-sm text-zinc-950 dark:text-zinc-100">
                  Personal &amp; Contact
                </h3>
              </div>
              <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                Verified
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-zinc-500 dark:text-zinc-400 block font-medium">First Name</span>
                <span className="text-zinc-950 dark:text-zinc-100 font-semibold font-headline">
                  {profile.firstName || '—'}
                </span>
              </div>
              <div>
                <span className="text-zinc-500 dark:text-zinc-400 block font-medium">Last Name</span>
                <span className="text-zinc-950 dark:text-zinc-100 font-semibold font-headline">
                  {profile.lastName || '—'}
                </span>
              </div>
              <div>
                <span className="text-zinc-500 dark:text-zinc-400 block font-medium">Email Address</span>
                <span className="text-zinc-950 dark:text-zinc-100 font-mono">
                  {profile.email || '—'}
                </span>
              </div>
              <div>
                <span className="text-zinc-500 dark:text-zinc-400 block font-medium">Phone Number</span>
                <span className="text-zinc-950 dark:text-zinc-100 font-mono">
                  {profile.phone || '—'}
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-zinc-500 dark:text-zinc-400 block font-medium">Location</span>
                <span className="text-zinc-950 dark:text-zinc-100 font-medium">
                  {profile.location || '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: Digital Portals & Links */}
          <div className="bg-white dark:bg-[#121215] border border-zinc-200 dark:border-[#27272A] rounded-xl p-6 space-y-4 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-[#1E1E22]">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
                <h3 className="font-headline font-bold text-sm text-zinc-950 dark:text-zinc-100">
                  Online Profiles &amp; Portals
                </h3>
              </div>
              <span className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400">
                Pre-Flight Enabled
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-50 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A]">
                <div className="flex items-center gap-2">
                  <Linkedin className="w-4 h-4 text-zinc-700 dark:text-zinc-300 shrink-0" />
                  <span className="text-zinc-800 dark:text-zinc-200 font-medium truncate max-w-[200px]">
                    {profile.linkedinUrl || 'Not linked'}
                  </span>
                </div>
                {profile.linkedinUrl && (
                  <a
                    href={profile.linkedinUrl.startsWith('http') ? profile.linkedinUrl : `https://${profile.linkedinUrl}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1 text-zinc-500 hover:text-zinc-950 dark:hover:text-zinc-100"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-50 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A]">
                <div className="flex items-center gap-2">
                  <Github className="w-4 h-4 text-zinc-700 dark:text-zinc-300 shrink-0" />
                  <span className="text-zinc-800 dark:text-zinc-200 font-medium truncate max-w-[200px]">
                    {profile.githubUrl || 'Not linked'}
                  </span>
                </div>
                {profile.githubUrl && (
                  <a
                    href={profile.githubUrl.startsWith('http') ? profile.githubUrl : `https://${profile.githubUrl}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1 text-zinc-500 hover:text-zinc-950 dark:hover:text-zinc-100"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-50 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A]">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-zinc-700 dark:text-zinc-300 shrink-0" />
                  <span className="text-zinc-800 dark:text-zinc-200 font-medium truncate max-w-[200px]">
                    {profile.portfolioUrl || 'Portfolio not set'}
                  </span>
                </div>
                {profile.portfolioUrl && (
                  <a
                    href={profile.portfolioUrl.startsWith('http') ? profile.portfolioUrl : `https://${profile.portfolioUrl}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1 text-zinc-500 hover:text-zinc-950 dark:hover:text-zinc-100"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Card 3: Academic Background & Education */}
          <div className="bg-white dark:bg-[#121215] border border-zinc-200 dark:border-[#27272A] rounded-xl p-6 space-y-4 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-[#1E1E22]">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
                <h3 className="font-headline font-bold text-sm text-zinc-950 dark:text-zinc-100">
                  Education &amp; Academics
                </h3>
              </div>
              <span className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400">
                Verified Higher Ed
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="col-span-2">
                <span className="text-zinc-500 dark:text-zinc-400 block font-medium">University / College</span>
                <span className="text-zinc-950 dark:text-zinc-100 font-bold font-headline text-sm">
                  {profile.school || '—'}
                </span>
              </div>
              <div>
                <span className="text-zinc-500 dark:text-zinc-400 block font-medium">Degree</span>
                <span className="text-zinc-950 dark:text-zinc-100 font-medium">
                  {profile.degree || '—'}
                </span>
              </div>
              <div>
                <span className="text-zinc-500 dark:text-zinc-400 block font-medium">Major</span>
                <span className="text-zinc-950 dark:text-zinc-100 font-medium">
                  {profile.major || '—'}
                </span>
              </div>
              <div>
                <span className="text-zinc-500 dark:text-zinc-400 block font-medium">Cumulative GPA</span>
                <span className="text-zinc-950 dark:text-zinc-100 font-mono font-semibold">
                  {profile.gpa ? `${profile.gpa} / 4.0` : '—'}
                </span>
              </div>
              <div>
                <span className="text-zinc-500 dark:text-zinc-400 block font-medium">Graduation Date</span>
                <span className="text-zinc-950 dark:text-zinc-100 font-mono">
                  {profile.gradMonthYear || '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Card 4: Work Authorization & Legal */}
          <div className="bg-white dark:bg-[#121215] border border-zinc-200 dark:border-[#27272A] rounded-xl p-6 space-y-4 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-[#1E1E22]">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
                <h3 className="font-headline font-bold text-sm text-zinc-950 dark:text-zinc-100">
                  Work Authorization &amp; Legal
                </h3>
              </div>
              <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                Eligible
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-zinc-500 dark:text-zinc-400 block font-medium">Work Authorization Status</span>
                <span className="text-zinc-950 dark:text-zinc-100 font-semibold font-headline">
                  {formatWorkAuth(profile.workAuthorization)}
                </span>
              </div>

              <div>
                <span className="text-zinc-500 dark:text-zinc-400 block font-medium">Visa Sponsorship</span>
                <span className="text-zinc-950 dark:text-zinc-100 font-medium">
                  {profile.requiresVisaSponsorship
                    ? 'Requires current or future visa sponsorship (H-1B, etc.)'
                    : 'Does NOT require visa sponsorship'}
                </span>
              </div>

              <div className="pt-2 border-t border-zinc-100 dark:border-[#1E1E22] text-[11px] text-zinc-500 font-mono">
                Auto-apply engine uses these parameters for Greenhouse, Lever, and Workday compliance screening questions.
              </div>
            </div>
          </div>

          {/* Card 5: Connected Resumes & Master Documents (Spans full width) */}
          <div className="col-span-1 md:col-span-2 bg-white dark:bg-[#121215] border border-zinc-200 dark:border-[#27272A] rounded-xl p-6 space-y-4 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-100 dark:border-[#1E1E22]">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
                  <h3 className="font-headline font-bold text-sm text-zinc-950 dark:text-zinc-100">
                    Connected Documents &amp; ATS Readiness
                  </h3>
                  <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                    Active
                  </span>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {connectedDocTitle ? `Connected to ${connectedDocTitle}` : 'Master resume ready for optimization'}
                </p>
              </div>

              <div className="flex items-center gap-2.5">
                {onNavigateToWorkspace && (
                  <>
                    <button
                      type="button"
                      onClick={() => onNavigateToWorkspace('google_docs')}
                      className="px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-[#18181B] dark:hover:bg-[#27272A] border border-zinc-200 dark:border-[#27272A] text-xs font-mono text-zinc-800 dark:text-zinc-200 transition-colors flex items-center gap-1.5"
                    >
                      <Cloud className="w-3.5 h-3.5" />
                      <span>Google Docs Sync</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onNavigateToWorkspace('in_app_canvas')}
                      className="px-3 py-1.5 rounded-lg bg-zinc-950 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-950 text-xs font-headline font-semibold transition-colors flex items-center gap-1.5 shadow-xs"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>In-App Canvas</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 text-xs font-mono">
              <div className="p-3 bg-zinc-50 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] rounded-lg">
                <span className="text-zinc-500 block text-[11px]">Active Canonical Name</span>
                <span className="text-zinc-950 dark:text-zinc-100 font-semibold truncate block mt-0.5">
                  {displayName.replace(/\s+/g, '_')}_Master_Resume.pdf
                </span>
              </div>
              <div className="p-3 bg-zinc-50 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] rounded-lg">
                <span className="text-zinc-500 block text-[11px]">Format Guard</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold block mt-0.5">
                  ✓ Strict 1-Page Line Budget
                </span>
              </div>
              <div className="p-3 bg-zinc-50 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] rounded-lg">
                <span className="text-zinc-500 block text-[11px]">Hallucination Guard</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold block mt-0.5">
                  ✓ Sourced Verification Active
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileTab;
