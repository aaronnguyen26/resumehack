import React, { useState, useEffect } from 'react';
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
  ArrowRight,
  RefreshCw,
  Info
} from 'lucide-react';
import { signIn, signUp, resendVerificationEmail, AuthUser } from '../services/supabase-db.js';

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

  // Email verification state
  const [isAwaitingVerification, setIsAwaitingVerification] = useState(false);
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Prevent closing the modal via Escape key when sign-in is mandatory
  useEffect(() => {
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

  const handleResendVerification = async () => {
    const targetEmail = unconfirmedEmail || email.trim();
    if (!targetEmail) return;

    setIsResending(true);
    setResendMessage(null);
    try {
      const { error } = await resendVerificationEmail(targetEmail);
      if (error) {
        if (error.toLowerCase().includes('rate limit')) {
          setResendMessage('Supabase email rate limit reached. Please wait a few minutes or disable "Confirm email" in Supabase Auth settings.');
        } else {
          setResendMessage(`Could not resend: ${error}`);
        }
      } else {
        setResendMessage(`Verification email resent to ${targetEmail}! Please check your inbox and spam folder.`);
        setResendCooldown(60);
      }
    } catch (err: any) {
      setResendMessage(err.message || 'Failed to resend verification email.');
    } finally {
      setIsResending(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setResendMessage(null);

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

        if (session && user) {
          // Instant session (email autoconfirm enabled on Supabase)
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
        } else if (user && !session) {
          // Email confirmation is required by Supabase project
          setIsAwaitingVerification(true);
          setUnconfirmedEmail(email.trim());
          setResendCooldown(30);
        }
      } else {
        const { user, session, error } = await signIn(email.trim(), password);
        if (error) {
          const lower = error.toLowerCase();
          if (lower.includes('email not confirmed') || lower.includes('not confirmed')) {
            setUnconfirmedEmail(email.trim());
            setErrorMessage('Your email address has not been confirmed yet. Please check your inbox for the verification link or resend it below.');
            return;
          }
          throw new Error(error);
        }

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
                {isAwaitingVerification
                  ? 'Verify Your Email'
                  : mode === 'signin'
                  ? 'Sign In to ResumeHack'
                  : 'Create Your Cloud Account'}
              </h3>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                {isAwaitingVerification
                  ? 'Confirmation link sent to your inbox'
                  : isMandatory
                  ? 'Sign-in required to initialize workspace'
                  : 'Persistent Supabase Cloud Sync'}
              </p>
            </div>
          </div>

          {isMandatory && !isAwaitingVerification ? (
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

        {/* Mode Switcher Tabs (Only shown when not awaiting verification) */}
        {!isAwaitingVerification && (
          <div className="flex border-b border-zinc-100 dark:border-[#1E1E22] text-xs font-mono">
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setErrorMessage(null);
                setUnconfirmedEmail(null);
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
                setUnconfirmedEmail(null);
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
        )}

        {/* Awaiting Email Verification View */}
        {isAwaitingVerification ? (
          <div className="p-6 space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-xs">
              <Mail className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Check Your Email</h4>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                We sent a verification link to:
              </p>
              <p className="text-xs font-mono font-semibold text-zinc-900 dark:text-white px-2.5 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 inline-block">
                {unconfirmedEmail || email}
              </p>
            </div>

            {/* Localhost Redirect Guidance Notice */}
            <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] text-left text-[11px] space-y-2 text-zinc-600 dark:text-zinc-400">
              <div className="flex items-center gap-1.5 font-semibold text-zinc-900 dark:text-zinc-200">
                <Info className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>Next steps after opening your email:</span>
              </div>
              <ul className="list-disc pl-4 space-y-1 text-[10px] leading-relaxed">
                <li>Click the <strong>Confirm your mail</strong> button inside the email.</li>
                <li>
                  If the link opens and says <span className="font-mono text-amber-600 dark:text-amber-400">&ldquo;localhost isn&apos;t connected&rdquo;</span>: change <code className="px-1 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-mono">:3000</code> in your browser address bar to <code className="px-1 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-mono">:5173</code> (or your web app URL).
                </li>
                <li>Once verified, your account will be active immediately.</li>
              </ul>
            </div>

            {/* Resend Status Message */}
            {resendMessage && (
              <div className="p-2.5 rounded-lg bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-700 dark:text-zinc-300">
                {resendMessage}
              </div>
            )}

            {/* Resend Button & Back to Sign In */}
            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={handleResendVerification}
                disabled={isResending || resendCooldown > 0}
                className="w-full py-2.5 bg-zinc-950 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-950 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs disabled:opacity-50"
              >
                {isResending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Resending Email…</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>
                      {resendCooldown > 0
                        ? `Resend Email in ${resendCooldown}s`
                        : 'Resend Verification Email'}
                    </span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsAwaitingVerification(false);
                  setMode('signin');
                  setErrorMessage(null);
                }}
                className="w-full py-2 text-xs font-mono text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors cursor-pointer"
              >
                Back to Sign In
              </button>
            </div>
          </div>
        ) : (
          /* Body Content & Form */
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

            {/* Error Banner with Inline Resend Action */}
            {errorMessage && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs space-y-2 animate-in fade-in duration-150">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="leading-snug">{errorMessage}</div>
                </div>

                {unconfirmedEmail && (
                  <div className="pt-1 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleResendVerification}
                      disabled={isResending || resendCooldown > 0}
                      className="px-2.5 py-1 text-[11px] font-mono font-medium rounded-lg bg-amber-600/20 hover:bg-amber-600/30 text-amber-800 dark:text-amber-300 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {isResending ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3 h-3" />
                      )}
                      <span>
                        {resendCooldown > 0
                          ? `Resend in ${resendCooldown}s`
                          : 'Resend Verification Link'}
                      </span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Resend Status Message */}
            {resendMessage && (
              <div className="p-2.5 rounded-lg bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-700 dark:text-zinc-300 animate-in fade-in duration-150">
                {resendMessage}
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
        )}

        {/* Footer */}
        <div className="p-3 bg-zinc-50 dark:bg-[#151518] border-t border-zinc-100 dark:border-[#1E1E22] text-center text-[10px] font-mono text-zinc-400">
          Powered by Supabase &bull; Secured with PostgreSQL Row-Level Security
        </div>
      </div>
    </div>
  );
};
