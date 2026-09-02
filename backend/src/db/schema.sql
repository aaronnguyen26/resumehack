-- ============================================================================
-- ResumeHack ATS Freshness Pipeline — PostgreSQL Schema
-- Migration 001: Companies, ATS Jobs, and Transactional Outbox (Job Events)
-- ============================================================================

-- 1. Companies & ATS Board Registry
CREATE TABLE IF NOT EXISTS companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    ats_type VARCHAR(50) NOT NULL CHECK (ats_type IN ('greenhouse', 'lever', 'ashby', 'smartrecruiters', 'custom')),
    board_slug VARCHAR(255) NOT NULL,
    tier VARCHAR(20) NOT NULL DEFAULT 'tier2' CHECK (tier IN ('tier1', 'tier2', 'tier3')),
    poll_interval_sec INTEGER NOT NULL DEFAULT 120,
    burst_mode_until TIMESTAMPTZ,
    last_polled_at TIMESTAMPTZ,
    next_poll_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_status_code INTEGER,
    etag VARCHAR(255),
    last_modified_header VARCHAR(255),
    consecutive_unchanged_count INTEGER NOT NULL DEFAULT 0,
    historical_posting_velocity FLOAT NOT NULL DEFAULT 0.0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_company_ats_board UNIQUE (ats_type, board_slug)
);

CREATE INDEX IF NOT EXISTS idx_companies_next_poll ON companies(next_poll_at ASC);
CREATE INDEX IF NOT EXISTS idx_companies_tier ON companies(tier);

-- 2. ATS Jobs with Atomic Deduplication Constraint
CREATE TABLE IF NOT EXISTS ats_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    ats_job_id VARCHAR(255) NOT NULL,
    title VARCHAR(500) NOT NULL,
    location VARCHAR(255),
    department VARCHAR(255),
    job_url TEXT NOT NULL,
    description_raw TEXT,
    description_clean TEXT,
    category VARCHAR(100),
    job_type VARCHAR(50) NOT NULL DEFAULT 'unknown' CHECK (job_type IN ('Internship', 'New Grad', 'Full-time', 'unknown')),
    work_model VARCHAR(50) DEFAULT 'Hybrid',
    salary_range VARCHAR(255),
    skills JSONB DEFAULT '[]'::jsonb,
    raw_json JSONB,
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_company_job_id UNIQUE (company_id, ats_job_id)
);

CREATE INDEX IF NOT EXISTS idx_ats_jobs_first_seen ON ats_jobs(first_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_ats_jobs_status_company ON ats_jobs(status, company_id);
CREATE INDEX IF NOT EXISTS idx_ats_jobs_category ON ats_jobs(category);

-- 3. Durable Transactional Outbox (Job Events Stream & Replay Buffer)
CREATE TABLE IF NOT EXISTS job_events (
    id BIGSERIAL PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('JOB_CREATED', 'JOB_CLOSED', 'JOB_UPDATED')),
    job_id UUID NOT NULL REFERENCES ats_jobs(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    payload JSONB NOT NULL,
    emitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_events_id ON job_events(id ASC);
CREATE INDEX IF NOT EXISTS idx_job_events_emitted_at ON job_events(emitted_at DESC);
