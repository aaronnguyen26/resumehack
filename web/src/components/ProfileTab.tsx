import React, { useState, useMemo } from 'react';
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
  LogOut,
  Plus,
  Star,
  Trash2,
  Search,
  Filter
} from 'lucide-react';
import { ApplicantProfile } from '../types/index.js';
import { BulletVaultService, VaultBullet } from '../services/bullet-vault.js';

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

  // ── Master Bullet Vault State ───────────────────────────────────────────
  const [activeSection, setActiveSection] = useState<'profile' | 'vault'>('profile');
  const vaultService = useMemo(() => new BulletVaultService(), []);

  const [vaultBullets, setVaultBullets] = useState<VaultBullet[]>(() => {
    try {
      const saved = localStorage.getItem('resumehack_bullet_vault');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      // ignore
    }
    return vaultService.getDefaultSeedBullets(displayName);
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [filterCompany, setFilterCompany] = useState('ALL');
  const [isAddingBullet, setIsAddingBullet] = useState(false);
  const [newBulletText, setNewBulletText] = useState('');
  const [newBulletCompany, setNewBulletCompany] = useState('');
  const [newBulletSection, setNewBulletSection] = useState<'Experience' | 'Projects'>('Experience');
  const [newBulletRole, setNewBulletRole] = useState('');
  const [newBulletTags, setNewBulletTags] = useState('');
  const [newBulletStarred, setNewBulletStarred] = useState(false);

  const saveVault = (bullets: VaultBullet[]) => {
    setVaultBullets(bullets);
    try {
      localStorage.setItem('resumehack_bullet_vault', JSON.stringify(bullets));
    } catch (e) {
      // ignore
    }
  };

  const handleToggleStar = (id: string) => {
    const updated = vaultBullets.map(b => b.id === id ? { ...b, isStarred: !b.isStarred } : b);
    saveVault(updated);
  };

  const handleDeleteBullet = (id: string) => {
    const updated = vaultBullets.filter(b => b.id !== id);
    saveVault(updated);
  };

  const handleCreateBullet = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBulletText.trim() || !newBulletCompany.trim()) return;

    const tags = newBulletTags
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);

    const created = vaultService.createBullet({
      rawText: newBulletText,
      companyOrProject: newBulletCompany,
      section: newBulletSection,
      roleTitle: newBulletRole || undefined,
      skillTags: tags,
      isStarred: newBulletStarred,
    });

    saveVault([created, ...vaultBullets]);
    setNewBulletText('');
    setNewBulletCompany('');
    setNewBulletRole('');
    setNewBulletTags('');
    setNewBulletStarred(false);
    setIsAddingBullet(false);
  };

  const handleResetSeedVault = () => {
    const seeds = vaultService.getDefaultSeedBullets(displayName);
    saveVault(seeds);
  };

  const companies = useMemo(() => {
    const set = new Set(vaultBullets.map(b => b.companyOrProject));
    return ['ALL', ...Array.from(set)];
  }, [vaultBullets]);

  const filteredBullets = useMemo(() => {
    return vaultBullets.filter(b => {
      if (filterCompany !== 'ALL' && b.companyOrProject !== filterCompany) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const inText = b.rawText.toLowerCase().includes(q);
        const inComp = b.companyOrProject.toLowerCase().includes(q);
        const inTag = b.skillTags.some(t => t.toLowerCase().includes(q));
        if (!inText && !inComp && !inTag) return false;
      }
      return true;
    });
  }, [vaultBullets, filterCompany, searchQuery]);

  return (
    <div className="w-full max-w-[1780px] mx-auto px-1 sm:px-2 md:px-4 py-4 space-y-6 animate-in fade-in duration-200 select-none">
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

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-[#27272A] pb-3">
        <button
          type="button"
          onClick={() => setActiveSection('profile')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-mono font-semibold transition-colors cursor-pointer ${
            activeSection === 'profile'
              ? 'bg-zinc-950 text-white dark:bg-zinc-100 dark:text-zinc-950 shadow-xs'
              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-[#18181B]'
          }`}
        >
          <User className="w-3.5 h-3.5" />
          <span>Candidate Information</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('vault')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-mono font-semibold transition-colors cursor-pointer ${
            activeSection === 'vault'
              ? 'bg-zinc-950 text-white dark:bg-zinc-100 dark:text-zinc-950 shadow-xs'
              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-[#18181B]'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Master Bullet Vault</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-bold">
            {vaultBullets.length}
          </span>
        </button>
      </div>

      {activeSection === 'profile' && (
        <div className="space-y-8">
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
      )}

      {activeSection === 'vault' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Header & Stats Banner */}
          <div className="bg-white dark:bg-[#121215] border border-zinc-200 dark:border-[#27272A] rounded-2xl p-6 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-headline text-lg font-bold text-zinc-950 dark:text-zinc-50">
                    Master Profile "Bullet Vault"
                  </h2>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold">
                    1-Page Dynamic Rebalancer Ready
                  </span>
                </div>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 max-w-2xl leading-relaxed">
                  Store all your career achievements and verified projects in one central vault. When applying for specific job descriptions, Hacky AI solves the 1-page line budget problem (strictly 48-52 lines) by auto-selecting the highest-impact bullets that match the target role.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddingBullet(!isAddingBullet)}
                  className="px-3.5 py-2 bg-zinc-950 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-950 rounded-lg text-xs font-headline font-semibold transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isAddingBullet ? 'Cancel' : 'Add Bullet'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleResetSeedVault}
                  className="px-3 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-[#18181B] dark:hover:bg-[#27272A] border border-zinc-200 dark:border-[#27272A] text-zinc-700 dark:text-zinc-300 rounded-lg text-xs font-mono transition-colors flex items-center gap-1.5 cursor-pointer"
                  title="Restore default high-impact seed bullets"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Seed Vault</span>
                </button>
              </div>
            </div>

            {/* Metrics Overview Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div className="p-3.5 bg-zinc-50 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] rounded-xl space-y-1">
                <span className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider block">Total Vault Bullets</span>
                <span className="text-2xl font-bold font-mono text-zinc-950 dark:text-zinc-50 block">{vaultBullets.length}</span>
                <span className="text-[10px] text-zinc-400">Canonical achievements</span>
              </div>

              <div className="p-3.5 bg-zinc-50 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] rounded-xl space-y-1">
                <span className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider block">Quantified Impact</span>
                <span className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 block">
                  {vaultBullets.filter(b => b.quantifiableMetrics.length > 0).length}
                </span>
                <span className="text-[10px] text-zinc-400">With verified metrics</span>
              </div>

              <div className="p-3.5 bg-zinc-50 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] rounded-xl space-y-1">
                <span className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider block">Starred Priority</span>
                <span className="text-2xl font-bold font-mono text-zinc-950 dark:text-zinc-50 block">
                  {vaultBullets.filter(b => b.isStarred).length}
                </span>
                <span className="text-[10px] text-zinc-400">Always favored in knapsack</span>
              </div>

              <div className="p-3.5 bg-zinc-50 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] rounded-xl space-y-1">
                <span className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider block">1-Page Line Target</span>
                <span className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 block">
                  48-52
                </span>
                <span className="text-[10px] text-zinc-400">Exact 1-page line budget</span>
              </div>
            </div>
          </div>

          {/* Add Bullet Form */}
          {isAddingBullet && (
            <form onSubmit={handleCreateBullet} className="bg-white dark:bg-[#121215] border border-zinc-200 dark:border-[#27272A] rounded-2xl p-6 shadow-xs space-y-4 animate-in slide-in-from-top-2">
              <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
                <h3 className="font-headline text-sm font-bold text-zinc-950 dark:text-zinc-50">
                  Add New Bullet to Vault
                </h3>
                <span className="text-xs font-mono text-zinc-400">Auto-extracts metrics & skill tags</span>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono text-zinc-600 dark:text-zinc-400 block">
                  Bullet Text (Achievement with quantifiable metric)
                </label>
                <textarea
                  value={newBulletText}
                  onChange={(e) => setNewBulletText(e.target.value)}
                  placeholder="Architected distributed event ingestion pipeline in Go and Kafka processing 45k events/sec with sub-50ms p99 latency."
                  rows={3}
                  className="w-full px-3 py-2 text-xs font-sans rounded-xl bg-zinc-50 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-white"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-mono text-zinc-600 dark:text-zinc-400 block">Company / Project Name</label>
                  <input
                    type="text"
                    value={newBulletCompany}
                    onChange={(e) => setNewBulletCompany(e.target.value)}
                    placeholder="e.g. CloudScale Inc"
                    className="w-full px-3 py-2 text-xs rounded-xl bg-zinc-50 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-white"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-mono text-zinc-600 dark:text-zinc-400 block">Role Title (Optional)</label>
                  <input
                    type="text"
                    value={newBulletRole}
                    onChange={(e) => setNewBulletRole(e.target.value)}
                    placeholder="e.g. Senior Software Engineer"
                    className="w-full px-3 py-2 text-xs rounded-xl bg-zinc-50 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-mono text-zinc-600 dark:text-zinc-400 block">Section</label>
                  <select
                    value={newBulletSection}
                    onChange={(e) => setNewBulletSection(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-zinc-50 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] text-zinc-900 dark:text-zinc-100 focus:outline-none"
                  >
                    <option value="Experience">Experience</option>
                    <option value="Projects">Projects</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-mono text-zinc-600 dark:text-zinc-400 block">
                    Skill Tags (Comma separated)
                  </label>
                  <input
                    type="text"
                    value={newBulletTags}
                    onChange={(e) => setNewBulletTags(e.target.value)}
                    placeholder="Go, Kafka, Distributed Systems, Latency"
                    className="w-full px-3 py-2 text-xs rounded-xl bg-zinc-50 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-white"
                  />
                </div>

                <div className="flex items-center gap-2 pt-6">
                  <input
                    type="checkbox"
                    id="newBulletStarred"
                    checked={newBulletStarred}
                    onChange={(e) => setNewBulletStarred(e.target.checked)}
                    className="w-4 h-4 rounded text-zinc-900 border-zinc-300 focus:ring-0 cursor-pointer"
                  />
                  <label htmlFor="newBulletStarred" className="text-xs font-mono text-zinc-700 dark:text-zinc-300 cursor-pointer">
                    Star this bullet (Always prioritize in 1-page rebalancer)
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddingBullet(false)}
                  className="px-3 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-[#18181B] dark:hover:bg-[#27272A] border border-zinc-200 dark:border-[#27272A] text-zinc-700 dark:text-zinc-300 rounded-lg text-xs font-mono transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-headline font-semibold transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Save to Bullet Vault</span>
                </button>
              </div>
            </form>
          )}

          {/* Filter & Search Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-white dark:bg-[#121215] border border-zinc-200 dark:border-[#27272A] rounded-2xl shadow-xs">
            <div className="relative w-full sm:w-80">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search bullets, skills, companies..."
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-zinc-50 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-white"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
              <select
                value={filterCompany}
                onChange={(e) => setFilterCompany(e.target.value)}
                className="px-2.5 py-1.5 text-xs rounded-xl bg-zinc-50 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] text-zinc-900 dark:text-zinc-100 focus:outline-none"
              >
                {companies.map(c => (
                  <option key={c} value={c}>{c === 'ALL' ? 'All Companies & Projects' : c}</option>
                ))}
              </select>
              <span className="text-[11px] font-mono text-zinc-400 shrink-0">
                {filteredBullets.length} bullet{filteredBullets.length === 1 ? '' : 's'}
              </span>
            </div>
          </div>

          {/* Bullets List */}
          <div className="space-y-3">
            {filteredBullets.length === 0 ? (
              <div className="p-8 text-center rounded-2xl bg-white dark:bg-[#121215] border border-dashed border-zinc-300 dark:border-zinc-700 text-xs text-zinc-500 space-y-2">
                <FileText className="w-8 h-8 mx-auto text-zinc-400 opacity-50" />
                <p className="font-semibold">No bullets match your filter.</p>
                <button
                  type="button"
                  onClick={() => { setSearchQuery(''); setFilterCompany('ALL'); }}
                  className="text-emerald-600 dark:text-emerald-400 underline font-mono text-[11px] cursor-pointer"
                >
                  Clear search filters
                </button>
              </div>
            ) : (
              filteredBullets.map((bullet) => (
                <div
                  key={bullet.id}
                  className="p-4 rounded-2xl bg-white dark:bg-[#121215] border border-zinc-200 dark:border-[#27272A] space-y-3 shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => handleToggleStar(bullet.id)}
                        className={`p-1 rounded-md transition-colors cursor-pointer ${
                          bullet.isStarred
                            ? 'text-amber-500 hover:text-amber-600'
                            : 'text-zinc-300 dark:text-zinc-700 hover:text-zinc-500'
                        }`}
                        title={bullet.isStarred ? 'Starred priority' : 'Star this bullet'}
                      >
                        <Star className={`w-4 h-4 ${bullet.isStarred ? 'fill-amber-500' : ''}`} />
                      </button>

                      <span className="text-xs font-bold font-headline text-zinc-950 dark:text-zinc-50">
                        {bullet.companyOrProject}
                      </span>

                      {bullet.roleTitle && (
                        <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">
                          • {bullet.roleTitle}
                        </span>
                      )}

                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-medium">
                        {bullet.section}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded border font-medium ${
                        bullet.lineCost === 1
                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                          : 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300'
                      }`}>
                        {bullet.lineCost} line{bullet.lineCost > 1 ? 's' : ''}
                      </span>

                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400">
                        Impact: {bullet.impactScore}/100
                      </span>

                      <button
                        type="button"
                        onClick={() => handleDeleteBullet(bullet.id)}
                        className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors cursor-pointer"
                        title="Delete from vault"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-zinc-800 dark:text-zinc-200 leading-relaxed font-sans pl-6">
                    • {bullet.rawText}
                  </p>

                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-zinc-100 dark:border-zinc-800/60 pl-6 flex-wrap">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {bullet.quantifiableMetrics.map((m, mIdx) => (
                        <span
                          key={mIdx}
                          className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                        >
                          {m}
                        </span>
                      ))}

                      {bullet.skillTags.map((tag, tIdx) => (
                        <span
                          key={tIdx}
                          className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>

                    <span className="text-[10px] font-mono text-zinc-400">
                      {bullet.rawText.length} chars
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileTab;
