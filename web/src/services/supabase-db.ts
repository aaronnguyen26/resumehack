import { supabase } from './supabase-client.js';
import { ApplicantProfile, ApplicationRecord, JobPosting } from '../types/index.js';

export interface CloudResume {
  id: string;
  user_id: string;
  title: string;
  raw_text: string;
  content_html?: string;
  target_role?: string;
  ats_score?: number;
  ats_breakdown?: any;
  parsed_resume?: any;
  is_default?: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthUser {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
}

// ── Authentication API ───────────────────────────────────────────────────────

/**
 * Compute appropriate redirect URL based on current environment
 */
export function getAuthRedirectUrl(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return 'https://resumehack.vercel.app';
}

/**
 * Register a new user with email and password
 */
export async function signUp(email: string, password: string, firstName?: string, lastName?: string) {
  try {
    const redirectUrl = getAuthRedirectUrl();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          first_name: firstName || '',
          last_name: lastName || '',
        },
      },
    });

    if (error) throw error;
    return { user: data.user, session: data.session, error: null };
  } catch (err: any) {
    return { user: null, session: null, error: err.message || 'Sign up failed' };
  }
}

/**
 * Resend verification email for an unconfirmed account
 */
export async function resendVerificationEmail(email: string) {
  try {
    const redirectUrl = getAuthRedirectUrl();
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: redirectUrl,
      },
    });

    if (error) throw error;
    return { error: null };
  } catch (err: any) {
    return { error: err.message || 'Failed to resend confirmation email' };
  }
}

/**
 * Sign in existing user with email and password
 */
export async function signIn(email: string, password: string) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    return { user: data.user, session: data.session, error: null };
  } catch (err: any) {
    return { user: null, session: null, error: err.message || 'Sign in failed' };
  }
}

/**
 * Sign out current user session
 */
export async function signOut() {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    return { error: null };
  } catch (err: any) {
    return { error: err.message || 'Sign out failed' };
  }
}

/**
 * Get the currently authenticated user
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return null;

    return {
      id: user.id,
      email: user.email,
      firstName: user.user_metadata?.first_name || '',
      lastName: user.user_metadata?.last_name || '',
    };
  } catch {
    return null;
  }
}

/**
 * Listen to auth state changes (sign in, sign out, token refresh)
 */
export function onAuthStateChange(callback: (user: AuthUser | null, event?: string) => void) {
  return supabase.auth.onAuthStateChange((event, session) => {
    if (session?.user) {
      callback({
        id: session.user.id,
        email: session.user.email,
        firstName: session.user.user_metadata?.first_name || '',
        lastName: session.user.user_metadata?.last_name || '',
      }, event);
    } else {
      callback(null, event);
    }
  });
}

// ── Profile Persistence API ──────────────────────────────────────────────────

/**
 * Fetch user profile from Supabase profiles table
 */
export async function fetchUserProfile(userId: string): Promise<ApplicantProfile | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error || !data) return null;

    return {
      firstName: data.first_name || '',
      lastName: data.last_name || '',
      fullName: `${data.first_name || ''} ${data.last_name || ''}`.trim(),
      email: data.email || '',
      phone: data.phone || '',
      location: data.location || '',
      githubUrl: data.github_url || '',
      linkedinUrl: data.linkedin_url || '',
      portfolioUrl: data.portfolio_url || '',
      school: data.raw_profile_data?.school || '',
      degree: data.raw_profile_data?.degree || '',
      major: data.raw_profile_data?.major || '',
      gpa: data.raw_profile_data?.gpa || '',
      gradMonthYear: data.raw_profile_data?.gradMonthYear || '',
      workAuthorization: data.raw_profile_data?.workAuthorization || 'US_CITIZEN',
      requiresVisaSponsorship: data.raw_profile_data?.requiresVisaSponsorship || false,
    };
  } catch {
    return null;
  }
}

/**
 * Save / update user profile in Supabase profiles table
 */
export async function upsertUserProfile(userId: string, profile: Partial<ApplicantProfile>): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        first_name: profile.firstName || '',
        last_name: profile.lastName || '',
        email: profile.email || '',
        phone: profile.phone || '',
        location: profile.location || '',
        target_role: profile.targetRole || '',
        skills: profile.skills || [],
        github_url: profile.githubUrl || '',
        linkedin_url: profile.linkedinUrl || '',
        portfolio_url: profile.portfolioUrl || '',
        raw_profile_data: {
          school: profile.school || '',
          degree: profile.degree || '',
          major: profile.major || '',
          gpa: profile.gpa || '',
          gradMonthYear: profile.gradMonthYear || '',
          workAuthorization: profile.workAuthorization || 'US_CITIZEN',
          requiresVisaSponsorship: profile.requiresVisaSponsorship || false,
        },
        updated_at: new Date().toISOString(),
      });

    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update profile' };
  }
}

// ── Resumes Persistence API ──────────────────────────────────────────────────

/**
 * Fetch all saved resumes for the current user
 */
export async function fetchUserResumes(userId: string): Promise<CloudResume[]> {
  try {
    const { data, error } = await supabase
      .from('resumes')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (error || !data) return [];
    return data as CloudResume[];
  } catch {
    return [];
  }
}

/**
 * Fetch a specific resume by ID
 */
export async function fetchResumeById(resumeId: string): Promise<CloudResume | null> {
  try {
    const { data, error } = await supabase
      .from('resumes')
      .select('*')
      .eq('id', resumeId)
      .maybeSingle();

    if (error || !data) return null;
    return data as CloudResume;
  } catch {
    return null;
  }
}

/**
 * Save or update a resume in Supabase
 */
export async function saveResume(
  userId: string,
  resumeData: {
    id?: string;
    title: string;
    raw_text: string;
    content_html?: string;
    target_role?: string;
    ats_score?: number;
    ats_breakdown?: any;
    parsed_resume?: any;
    is_default?: boolean;
  }
): Promise<{ data: CloudResume | null; error?: string }> {
  try {
    const payload: any = {
      user_id: userId,
      title: resumeData.title || 'My Resume',
      raw_text: resumeData.raw_text || '',
      content_html: resumeData.content_html || '',
      target_role: resumeData.target_role || 'Senior Software Engineer',
      ats_score: resumeData.ats_score ?? 0,
      ats_breakdown: resumeData.ats_breakdown || {},
      parsed_resume: resumeData.parsed_resume || {},
      is_default: resumeData.is_default ?? false,
      updated_at: new Date().toISOString(),
    };

    if (resumeData.id) {
      payload.id = resumeData.id;
    }

    const { data, error } = await supabase
      .from('resumes')
      .upsert(payload)
      .select()
      .single();

    if (error) throw error;
    return { data: data as CloudResume, error: undefined };
  } catch (err: any) {
    return { data: null, error: err.message || 'Failed to save resume' };
  }
}

/**
 * Delete a resume by ID
 */
export async function deleteResume(resumeId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('resumes')
      .delete()
      .eq('id', resumeId);

    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to delete resume' };
  }
}

/**
 * Set a resume as the default active resume
 */
export async function setDefaultResume(userId: string, resumeId: string): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Reset all user's resumes is_default to false
    await supabase
      .from('resumes')
      .update({ is_default: false })
      .eq('user_id', userId);

    // 2. Set target resume is_default to true
    const { error } = await supabase
      .from('resumes')
      .update({ is_default: true, updated_at: new Date().toISOString() })
      .eq('id', resumeId)
      .eq('user_id', userId);

    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to set default resume' };
  }
}

// ── Applications Tracker Persistence API ─────────────────────────────────────

/**
 * Fetch all applications for the current user
 */
export async function fetchUserApplications(userId: string): Promise<ApplicationRecord[]> {
  try {
    const { data, error } = await supabase
      .from('applications')
      .select('*')
      .eq('user_id', userId)
      .order('applied_date', { ascending: false });

    if (error || !data) return [];

    return data.map((row: any) => ({
      id: row.id,
      jobId: row.id,
      company: row.company,
      title: row.role,
      location: row.location || 'Remote',
      status: row.status as any,
      appliedDate: row.applied_date,
      jobUrl: row.job_url || '',
      notes: row.notes || '',
      salary: row.salary || '',
      atsScoreAtApplication: row.ats_score ? Number(row.ats_score) : undefined,
      updatedAt: row.updated_at,
    }));
  } catch {
    return [];
  }
}

/**
 * Upsert an application record in Supabase
 */
export async function upsertApplication(userId: string, app: ApplicationRecord): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('applications')
      .upsert({
        id: app.id,
        user_id: userId,
        company: app.company,
        role: app.title,
        status: app.status,
        applied_date: app.appliedDate || new Date().toISOString(),
        location: app.location || '',
        job_url: app.jobUrl || '',
        notes: app.notes || '',
        salary: app.salary || '',
        ats_score: app.atsScoreAtApplication,
        updated_at: new Date().toISOString(),
      });

    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to save application' };
  }
}

/**
 * Delete an application record
 */
export async function deleteApplication(appId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('applications')
      .delete()
      .eq('id', appId);

    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to delete application' };
  }
}

// ── Job Postings Persistence API ─────────────────────────────────────────────

/**
 * Fetch verified job openings from Supabase job_postings table
 */
export async function fetchVerifiedJobPostings(options?: { category?: string; limit?: number }): Promise<JobPosting[]> {
  try {
    let query = supabase
      .from('job_postings')
      .select('*')
      .eq('is_verified', true)
      .eq('status', 'active')
      .order('updated_at', { ascending: false });

    if (options?.category && options.category !== 'All') {
      query = query.eq('category', options.category);
    }
    if (options?.limit) {
      query = query.limit(options.limit);
    } else {
      query = query.limit(200);
    }

    const { data, error } = await query;
    if (error || !data || data.length === 0) return [];

    return data.map((row: any) => ({
      id: row.id,
      company: row.company,
      title: row.title,
      location: row.location || 'Remote',
      type: row.type || 'Full-time',
      source: row.source || 'Direct ATS',
      sourceType: 'direct_ats',
      url: row.url,
      description: row.description || '',
      salaryRange: row.salary_range || undefined,
      category: row.category || 'Software Engineering',
      season: row.season || undefined,
      workModel: row.work_model || 'Hybrid',
      experienceLevel: row.experience_level || undefined,
      isVerified: row.is_verified ?? true,
      status: row.status ?? 'active',
      contentHash: row.content_hash || undefined,
      skills: Array.isArray(row.extracted_skills) ? row.extracted_skills : [],
      responsibilities: Array.isArray(row.responsibilities) ? row.responsibilities : [],
      requirements: Array.isArray(row.requirements) ? row.requirements : [],
      preferredQualifications: Array.isArray(row.preferred_qualifications) ? row.preferred_qualifications : [],
      updatedAt: row.updated_at,
    }));
  } catch {
    return [];
  }
}

/**
 * Save / Upsert verified job postings to Supabase
 */
export async function upsertJobPostings(jobs: JobPosting[]): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    if (!jobs || jobs.length === 0) return { success: true, count: 0 };

    const payload = jobs.map(j => ({
      id: j.id,
      company: j.company,
      title: j.title,
      location: j.location || 'Remote',
      type: j.type || 'Full-time',
      source: j.source || 'Direct ATS',
      url: j.url,
      description: j.description || '',
      salary_range: j.salaryRange || null,
      category: j.category || 'Software Engineering',
      season: j.season || null,
      work_model: j.workModel || 'Hybrid',
      experience_level: j.experienceLevel || null,
      is_verified: j.isVerified ?? true,
      status: j.status || 'active',
      content_hash: j.contentHash || null,
      extracted_skills: j.skills || [],
      responsibilities: j.responsibilities || [],
      requirements: j.requirements || [],
      preferred_qualifications: j.preferredQualifications || [],
      updated_at: j.updatedAt || new Date().toISOString(),
    }));

    const chunkSize = 50;
    let savedCount = 0;
    for (let i = 0; i < payload.length; i += chunkSize) {
      const chunk = payload.slice(i, i + chunkSize);
      const { error } = await supabase
        .from('job_postings')
        .upsert(chunk, { onConflict: 'id' });
      if (error) {
        console.warn('[Supabase DB] Job upsert note:', error.message);
      } else {
        savedCount += chunk.length;
      }
    }

    return { success: true, count: savedCount };
  } catch (err: any) {
    return { success: false, count: 0, error: err.message || 'Failed to upsert job postings' };
  }
}

/**
 * Sync delta result (new, updated, closed) directly into Supabase
 */
export async function syncDeltaToSupabase(delta: {
  newJobs: JobPosting[];
  updatedJobs: JobPosting[];
  closedJobs: JobPosting[];
}): Promise<{ success: boolean; upserted: number; error?: string }> {
  try {
    const toUpsert = [...delta.newJobs, ...delta.updatedJobs, ...delta.closedJobs];
    const res = await upsertJobPostings(toUpsert);
    return { success: res.success, upserted: res.count, error: res.error };
  } catch (err: any) {
    return { success: false, upserted: 0, error: err.message };
  }
}

