import React, { useState } from 'react';
import { 
  X, 
  Mail, 
  Lock, 
  User, 
  CheckCircle2, 
  AlertTriangle, 
  Loader2, 
  Cloud, 
  ShieldCheck, 
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { signIn, signUp, AuthUser } from '../services/supabase-db.js';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (user: AuthUser) => void;
  initialMode?: 'signin' | 'signup';
  isMandatory?: boolean;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onAuthSuccess,
  initialMode = 'signin',
  isMandatory = false,
}) => {
  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Prevent closing the modal via Escape key when sign-in is mandatory
  React.useEffect(() => {
    if (!isMandatory) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isMandatory]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!email.trim() || !password.trim()) {
      setErrorMessage('Please enter both email and password.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    setIsLoading(true);
    try {
      if (mode === 'signup') {
        const { user, session, error } = await signUp(email.trim(), password, firstName.trim(), lastName.trim());
        if (error) throw new Error(error);

        if (user) {
          setSuccessMessage('Account created successfully! Cloud sync is now active.');
          setTimeout(() => {
            onAuthSuccess({
              id: user.id,
              email: user.email,
              firstName: firstName.trim(),
              lastName: lastName.trim(),
            });
            onClose();
          }, 800);
        }
      } else {
        const { user, session, error } = await signIn(email.trim(), password);
        if (error) throw new Error(error);

        if (user) {
          setSuccessMessage('Signed in successfully! Loading your cloud resumes…');
          setTimeout(() => {
            onAuthSuccess({
              id: user.id,
              email: user.email,
              firstName: user.user_metadata?.first_name || '',
              lastName: user.user_metadata?.last_name || '',
            });
            onClose();
          }, 600);
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={isMandatory ? undefined : onClose}
    >
      <div 
        className="relative w-full max-w-md bg-white dark:bg-[#121215] border border-zinc-200 dark:border-[#27272A] rounded-2xl shadow-xl overflow-hidden text-zinc-900 dark:text-zinc-100 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 pb-4 border-b border-zinc-100 dark:border-[#1E1E22] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 flex items-center justify-center shadow-xs">
              <Cloud className="w-4 h-4 text-emerald-500" />
            </div>
            <div>
              <h3 className="font-bold text-sm font-headline tracking-tight text-zinc-950 dark:text-zinc-50">
                {mode === 'signin' ? 'Sign In to ResumeHack' : 'Create Your Cloud Account'}
              </h3>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                {isMandatory ? 'Sign-in required to initialize workspace' : 'Persistent Supabase Cloud Sync'}
              </p>
            </div>
          </div>

          {isMandatory ? (
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
              Required
            </span>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Mode Switcher Tabs */}
        <div className="flex border-b border-zinc-100 dark:border-[#1E1E22] text-xs font-mono">
          <button
            type="button"
            onClick={() => {
              setMode('signin');
              setErrorMessage(null);
            }}
            className={`flex-1 py-2.5 text-center font-semibold transition-colors cursor-pointer border-b-2 ${
              mode === 'signin'
                ? 'border-zinc-900 dark:border-white text-zinc-950 dark:text-white'
                : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('signup');
              setErrorMessage(null);
            }}
            className={`flex-1 py-2.5 text-center font-semibold transition-colors cursor-pointer border-b-2 ${
              mode === 'signup'
                ? 'border-zinc-900 dark:border-white text-zinc-950 dark:text-white'
                : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Body Content & Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Cloud Benefits Highlight */}
          <div className="p-3 rounded-xl bg-zinc-50 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] text-[11px] space-y-1.5 text-zinc-600 dark:text-zinc-400">
            <div className="flex items-center gap-1.5 font-semibold text-zinc-900 dark:text-zinc-100">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>Free Cloud Account Includes:</span>
            </div>
            <div className="grid grid-cols-2 gap-1 text-[10px] font-mono">
              <span className="flex items-center gap-1 text-zinc-700 dark:text-zinc-300">
                <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" /> Auto-Save Resumes
              </span>
              <span className="flex items-center gap-1 text-zinc-700 dark:text-zinc-300">
                <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" /> Multi-Version Backup
              </span>
              <span className="flex items-center gap-1 text-zinc-700 dark:text-zinc-300">
                <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" /> Cross-Device Access
              </span>
              <span className="flex items-center gap-1 text-zinc-700 dark:text-zinc-300">
                <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" /> Encrypted with RLS
              </span>
            </div>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs flex items-start gap-2 animate-in fade-in duration-150">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="leading-snug">{errorMessage}</div>
            </div>
          )}

          {/* Success Banner */}
          {successMessage && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs flex items-start gap-2 animate-in fade-in duration-150">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="leading-snug">{successMessage}</div>
            </div>
          )}

          {/* Sign Up Names */}
          {mode === 'signup' && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] font-mono text-zinc-500">First Name</label>
                <div className="relative">
                  <User className="w-3.5 h-3.5 absolute left-3 top-2.5 text-zinc-400" />
                  <input
                    type="text"
                    required
                    placeholder="Alex"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 text-xs rounded-lg bg-zinc-50 dark:bg-[#18181B] border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:border-zinc-900 dark:focus:border-white transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono text-zinc-500">Last Name</label>
                <div className="relative">
                  <User className="w-3.5 h-3.5 absolute left-3 top-2.5 text-zinc-400" />
                  <input
                    type="text"
                    required
                    placeholder="Chen"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 text-xs rounded-lg bg-zinc-50 dark:bg-[#18181B] border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:border-zinc-900 dark:focus:border-white transition-colors"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Email Input */}
          <div className="space-y-1">
            <label className="text-[10px] font-mono text-zinc-500">Email Address</label>
            <div className="relative">
              <Mail className="w-3.5 h-3.5 absolute left-3 top-2.5 text-zinc-400" />
              <input
                type="email"
                required
                placeholder="developer@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-xs rounded-lg bg-zinc-50 dark:bg-[#18181B] border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:border-zinc-900 dark:focus:border-white transition-colors font-mono"
              />
            </div>
          </div>

          {/* Password Input */}
          <div className="space-y-1">
            <label className="text-[10px] font-mono text-zinc-500">Password</label>
            <div className="relative">
              <Lock className="w-3.5 h-3.5 absolute left-3 top-2.5 text-zinc-400" />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-xs rounded-lg bg-zinc-50 dark:bg-[#18181B] border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:border-zinc-900 dark:focus:border-white transition-colors font-mono"
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 bg-zinc-950 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-950 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Connecting to Supabase…</span>
              </>
            ) : (
              <>
                <span>{mode === 'signin' ? 'Sign In' : 'Create Account & Enable Cloud Sync'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="p-3 bg-zinc-50 dark:bg-[#151518] border-t border-zinc-100 dark:border-[#1E1E22] text-center text-[10px] font-mono text-zinc-400">
          Powered by Supabase &bull; Secured with PostgreSQL Row-Level Security
        </div>
      </div>
    </div>
  );
};
