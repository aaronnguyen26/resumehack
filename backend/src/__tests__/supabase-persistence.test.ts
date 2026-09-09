import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Supabase Cloud Database & Resume Persistence Architecture', () => {
  const rootDir = path.resolve(__dirname, '../../../');
  const webDir = path.resolve(rootDir, 'web');
  const supabaseMigrationPath = path.resolve(
    rootDir,
    'supabase/migrations/20260909000000_resumehack_initial_schema.sql'
  );

  describe('1. Supabase PostgreSQL Schema & Row Level Security (RLS)', () => {
    it('migration file exists and defines all 4 required persistent tables', () => {
      expect(fs.existsSync(supabaseMigrationPath)).toBe(true);
      const sql = fs.readFileSync(supabaseMigrationPath, 'utf8').toLowerCase();

      // Check table definitions
      expect(sql).toContain('create table if not exists public.profiles');
      expect(sql).toContain('create table if not exists public.resumes');
      expect(sql).toContain('create table if not exists public.resume_diffs');
      expect(sql).toContain('create table if not exists public.applications');
    });

    it('enforces Row Level Security (RLS) on all tables with auth.uid() scoping', () => {
      const sql = fs.readFileSync(supabaseMigrationPath, 'utf8').toLowerCase();

      expect(sql).toContain('alter table public.profiles enable row level security;');
      expect(sql).toContain('alter table public.resumes enable row level security;');
      expect(sql).toContain('alter table public.resume_diffs enable row level security;');
      expect(sql).toContain('alter table public.applications enable row level security;');

      // Verify policies verify ownership
      expect(sql).toContain('auth.uid() = id');
      expect(sql).toContain('auth.uid() = user_id');
    });

    it('contains auto-provisioning trigger on auth.users signup and updated_at triggers', () => {
      const sql = fs.readFileSync(supabaseMigrationPath, 'utf8').toLowerCase();

      expect(sql).toContain('create or replace function public.handle_new_user()');
      expect(sql).toContain('create trigger on_auth_user_created');
      expect(sql).toContain('create trigger handle_resumes_updated_at');
    });
  });

  describe('2. Supabase Client & Data Access Layer Contract', () => {
    const dbServicePath = path.resolve(webDir, 'src/services/supabase-db.ts');
    const clientServicePath = path.resolve(webDir, 'src/services/supabase-client.ts');

    it('supabase-client.ts exports configured client with default fallback to active project', () => {
      expect(fs.existsSync(clientServicePath)).toBe(true);
      const content = fs.readFileSync(clientServicePath, 'utf8');

      expect(content).toContain('diuqdjsyhjocgudvmbun.supabase.co');
      expect(content).toContain('createClient(');
      expect(content).toContain('autoRefreshToken: true');
      expect(content).toContain('persistSession: true');
    });

    it('supabase-db.ts implements complete Auth and Profile persistence API', () => {
      expect(fs.existsSync(dbServicePath)).toBe(true);
      const content = fs.readFileSync(dbServicePath, 'utf8');

      expect(content).toContain('export async function signUp');
      expect(content).toContain('export async function signIn');
      expect(content).toContain('export async function signOut');
      expect(content).toContain('export async function getCurrentUser');
      expect(content).toContain('export function onAuthStateChange');
      expect(content).toContain('export async function fetchUserProfile');
      expect(content).toContain('export async function upsertUserProfile');
    });

    it('supabase-db.ts implements multi-version Resume & Application persistence', () => {
      const content = fs.readFileSync(dbServicePath, 'utf8');

      expect(content).toContain('export async function fetchUserResumes');
      expect(content).toContain('export async function fetchResumeById');
      expect(content).toContain('export async function saveResume');
      expect(content).toContain('export async function deleteResume');
      expect(content).toContain('export async function setDefaultResume');
      expect(content).toContain('export async function fetchUserApplications');
      expect(content).toContain('export async function upsertApplication');
    });
  });

  describe('3. Supabase Auth & Cloud Resume UI Components', () => {
    const authModalPath = path.resolve(webDir, 'src/components/AuthModal.tsx');
    const cloudManagerPath = path.resolve(webDir, 'src/components/CloudResumeManagerModal.tsx');
    const navbarPath = path.resolve(webDir, 'src/components/Navbar.tsx');
    const canvasPath = path.resolve(webDir, 'src/components/InAppDocumentCanvas.tsx');
    const profileTabPath = path.resolve(webDir, 'src/components/ProfileTab.tsx');

    it('AuthModal handles sign-in, sign-up with client validation and error handling', () => {
      expect(fs.existsSync(authModalPath)).toBe(true);
      const content = fs.readFileSync(authModalPath, 'utf8');

      expect(content).toContain('signIn(');
      expect(content).toContain('signUp(');
      expect(content).toContain('initialMode');
      expect(content).toContain('onAuthSuccess');
    });

    it('CloudResumeManagerModal lists user resumes, allows switching, deleting, and saving new versions', () => {
      expect(fs.existsSync(cloudManagerPath)).toBe(true);
      const content = fs.readFileSync(cloudManagerPath, 'utf8');

      expect(content).toContain('saveResume(');
      expect(content).toContain('deleteResume(');
      expect(content).toContain('setDefaultResume(');
      expect(content).toContain('onSelectResume(');
      expect(content).toContain('onRefreshResumes');
    });

    it('Navbar displays cloud sync indicator and auth triggers', () => {
      const content = fs.readFileSync(navbarPath, 'utf8');

      expect(content).toContain('currentUser');
      expect(content).toContain('onOpenAuthModal');
      expect(content).toContain('onSignOut');
      expect(content).toContain('onOpenCloudManager');
      expect(content).toContain('Cloud Synced');
    });

    it('InAppDocumentCanvas includes cloud sync toolbar badge and cloud save actions', () => {
      const content = fs.readFileSync(canvasPath, 'utf8');

      expect(content).toContain('isCloudSynced');
      expect(content).toContain('isCloudSaving');
      expect(content).toContain('onSaveToCloud');
      expect(content).toContain('onOpenCloudManager');
      expect(content).toContain('cloudResumesCount');
    });

    it('ProfileTab contains dedicated Supabase Cloud Account & Sync card', () => {
      const content = fs.readFileSync(profileTabPath, 'utf8');

      expect(content).toContain('Supabase Cloud Account Connected');
      expect(content).toContain('Guest Mode (Local Storage Only)');
      expect(content).toContain('onOpenAuthModal');
      expect(content).toContain('onOpenCloudManager');
      expect(content).toContain('cloudResumesCount');
    });
  });

  describe('4. Strict Monochromatic Zinc Theme & Zero Color Bleed Audit', () => {
    const filesToAudit = [
      path.resolve(webDir, 'src/components/AuthModal.tsx'),
      path.resolve(webDir, 'src/components/CloudResumeManagerModal.tsx'),
      path.resolve(webDir, 'src/services/supabase-client.ts'),
      path.resolve(webDir, 'src/services/supabase-db.ts'),
    ];

    it('strictly forbids purple, violet, indigo, and blue classes in all new Supabase components', () => {
      const forbiddenColors = [
        'bg-purple-', 'text-purple-', 'border-purple-',
        'bg-violet-', 'text-violet-', 'border-violet-',
        'bg-indigo-', 'text-indigo-', 'border-indigo-',
        'bg-blue-', 'text-blue-', 'border-blue-',
      ];

      for (const file of filesToAudit) {
        if (fs.existsSync(file)) {
          const content = fs.readFileSync(file, 'utf8');
          for (const pattern of forbiddenColors) {
            const matches = content.includes(pattern);
            expect(matches, `Found forbidden pattern "${pattern}" in ${path.basename(file)}`).toBe(false);
          }
        }
      }
    });
  });
});
