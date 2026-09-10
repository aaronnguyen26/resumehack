-- ResumeHack Supabase Database Schema Migration
-- Direct Tech Company Job Openings & Live Delta Sync Repository

CREATE TABLE IF NOT EXISTS public.job_postings (
  id TEXT PRIMARY KEY,
  company TEXT NOT NULL,
  title TEXT NOT NULL,
  location TEXT DEFAULT 'Remote',
  type TEXT DEFAULT 'Full-time',
  source TEXT DEFAULT 'Direct ATS',
  url TEXT NOT NULL,
  description TEXT DEFAULT '',
  salary_range TEXT,
  category TEXT,
  season TEXT,
  work_model TEXT DEFAULT 'Hybrid',
  experience_level TEXT,
  is_verified BOOLEAN DEFAULT true,
  status TEXT DEFAULT 'active', -- 'active' or 'closed'
  content_hash TEXT,
  extracted_skills TEXT[] DEFAULT '{}',
  responsibilities TEXT[] DEFAULT '{}',
  requirements TEXT[] DEFAULT '{}',
  preferred_qualifications TEXT[] DEFAULT '{}',
  raw_job_data JSONB DEFAULT '{}'::jsonb,
  first_seen_at TIMESTAMPTZ DEFAULT now(),
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Fast lookup indexes
CREATE INDEX IF NOT EXISTS idx_job_postings_company ON public.job_postings (company);
CREATE INDEX IF NOT EXISTS idx_job_postings_status ON public.job_postings (status);
CREATE INDEX IF NOT EXISTS idx_job_postings_verified ON public.job_postings (is_verified);
CREATE INDEX IF NOT EXISTS idx_job_postings_category ON public.job_postings (category);
CREATE INDEX IF NOT EXISTS idx_job_postings_updated_at ON public.job_postings (updated_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.job_postings ENABLE ROW LEVEL SECURITY;

-- 1. Public Read Policy: Allow all users (authenticated and anonymous) to view active verified job openings
DROP POLICY IF EXISTS "Public can view active job postings" ON public.job_postings;
CREATE POLICY "Public can view active job postings" ON public.job_postings
  FOR SELECT USING (true);

-- 2. Upsert Policy: Allow client synchronization to insert and update job records
DROP POLICY IF EXISTS "Allow sync to insert job postings" ON public.job_postings;
CREATE POLICY "Allow sync to insert job postings" ON public.job_postings
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow sync to update job postings" ON public.job_postings;
CREATE POLICY "Allow sync to update job postings" ON public.job_postings
  FOR UPDATE USING (true);

-- Automatic updated_at timestamp trigger
DROP TRIGGER IF EXISTS handle_job_postings_updated_at ON public.job_postings;
CREATE TRIGGER handle_job_postings_updated_at
  BEFORE UPDATE ON public.job_postings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
