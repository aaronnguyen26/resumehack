import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Supabase Auth Verification, Redirect URL, & Session Recovery', () => {
  const rootDir = path.resolve(__dirname, '../../../');
  const webDir = path.resolve(rootDir, 'web');
  const dbServicePath = path.resolve(webDir, 'src/services/supabase-db.ts');
  const authModalPath = path.resolve(webDir, 'src/components/AuthModal.tsx');
  const appPath = path.resolve(webDir, 'src/App.tsx');

  describe('1. Dynamic Redirect URL Computation', () => {
    it('supabase-db.ts defines getAuthRedirectUrl() using window.location.origin with production fallback', () => {
      const content = fs.readFileSync(dbServicePath, 'utf8');
      expect(content).toContain('export function getAuthRedirectUrl(): string');
      expect(content).toContain('window.location.origin');
      expect(content).toContain('https://resumehack.vercel.app');
    });

    it('signUp passes dynamic emailRedirectTo option to supabase.auth.signUp', () => {
      const content = fs.readFileSync(dbServicePath, 'utf8');
      expect(content).toContain('const redirectUrl = getAuthRedirectUrl();');
      expect(content).toContain('emailRedirectTo: redirectUrl');
    });

    it('implements resendVerificationEmail with dynamic redirectUrl and error trapping', () => {
      const content = fs.readFileSync(dbServicePath, 'utf8');
      expect(content).toContain('export async function resendVerificationEmail(email: string)');
      expect(content).toContain("type: 'signup'");
      expect(content).toContain('emailRedirectTo: redirectUrl');
    });
  });

  describe('2. AuthModal Verification State & Localhost Guidance', () => {
    it('detects unconfirmed email during sign in and provides inline resend action', () => {
      const content = fs.readFileSync(authModalPath, 'utf8');
      expect(content).toContain("lower.includes('email not confirmed')");
      expect(content).toContain('setUnconfirmedEmail');
      expect(content).toContain('handleResendVerification');
    });

    it('transitions to isAwaitingVerification screen when session is null on sign up', () => {
      const content = fs.readFileSync(authModalPath, 'utf8');
      expect(content).toContain('else if (user && !session)');
      expect(content).toContain('setIsAwaitingVerification(true)');
      expect(content).toContain('setResendCooldown(30)');
    });

    it('provides clear troubleshooting steps for localhost port mismatch (3000 vs 5173)', () => {
      const content = fs.readFileSync(authModalPath, 'utf8');
      expect(content).toContain('localhost isn');
      expect(content).toContain(':3000');
      expect(content).toContain(':5173');
    });

    it('implements rate-limiting cooldown timer for verification email resends', () => {
      const content = fs.readFileSync(authModalPath, 'utf8');
      expect(content).toContain('resendCooldown');
      expect(content).toContain('Resend Email in');
      expect(content).toContain('Resend in');
    });
  });

  describe('3. App.tsx Session URL Parsing & Auth Gate Dismissal', () => {
    it('onAuthStateChange dismisses mandatory auth modal upon successful login or verification', () => {
      const content = fs.readFileSync(appPath, 'utf8');
      expect(content).toContain('setIsAuthModalOpen(false);');
      expect(content).toContain('setIsAuthMandatory(false);');
    });

    it('cleans access_token and code from URL without triggering full page reloads', () => {
      const content = fs.readFileSync(appPath, 'utf8');
      expect(content).toContain('window.history.replaceState(null, \'\', window.location.pathname);');
    });
  });

  describe('4. Strict Color Compliance (Zero Purple / Zero Blue)', () => {
    it('AuthModal.tsx contains zero purple or blue classes', () => {
      const content = fs.readFileSync(authModalPath, 'utf8');
      const forbidden = ['purple', 'violet', 'indigo', 'blue'];
      for (const color of forbidden) {
        expect(content.toLowerCase()).not.toContain(`bg-${color}-`);
        expect(content.toLowerCase()).not.toContain(`text-${color}-`);
        expect(content.toLowerCase()).not.toContain(`border-${color}-`);
      }
    });
  });
});
