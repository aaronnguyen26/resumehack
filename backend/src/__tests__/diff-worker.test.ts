import { describe, it, expect, beforeEach } from 'vitest';
import { newDb } from 'pg-mem';
import {
  computeJobDiff,
  calculateNextPollInterval,
  applyDiffInTransaction,
} from '../services/diff-worker.js';
import {
  CompanyRecord,
  AtsJobRecord,
  NormalizedAtsJob,
} from '../types/ats.js';

describe('Diff Worker — Pure Functions', () => {
  const mockCompany: CompanyRecord = {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Stripe',
    ats_type: 'greenhouse',
    board_slug: 'stripe',
    tier: 'tier1',
    poll_interval_sec: 120,
    burst_mode_until: null,
    last_polled_at: null,
    next_poll_at: new Date().toISOString(),
    last_status_code: null,
    etag: null,
    last_modified_header: null,
    consecutive_unchanged_count: 0,
    historical_posting_velocity: 1.5,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const sampleCurrentJobs: NormalizedAtsJob[] = [
    {
      atsJobId: 'job-101',
      title: 'Software Engineer Intern',
      location: 'San Francisco, CA',
      department: 'Engineering',
      jobUrl: 'https://stripe.com/jobs/101',
      descriptionRaw: '<p>Join us</p>',
      descriptionClean: 'Join us',
      category: 'Software Engineering',
      jobType: 'Internship',
      workModel: 'Hybrid',
      skills: ['Go', 'TypeScript'],
    },
    {
      atsJobId: 'job-102',
      title: 'Infrastructure Engineer New Grad',
      location: 'Seattle, WA',
      department: 'Infrastructure',
      jobUrl: 'https://stripe.com/jobs/102',
      descriptionRaw: '<p>Build infrastructure</p>',
      descriptionClean: 'Build infrastructure',
      category: 'Software Engineering',
      jobType: 'New Grad',
      workModel: 'Hybrid',
      skills: ['Kubernetes', 'AWS'],
    },
  ];

  describe('computeJobDiff', () => {
    it('detects all jobs as new when existing database is empty', () => {
      const diff = computeJobDiff(sampleCurrentJobs, []);

      expect(diff.newJobs).toHaveLength(2);
      expect(diff.newJobs[0].atsJobId).toBe('job-101');
      expect(diff.newJobs[1].atsJobId).toBe('job-102');
      expect(diff.updatedJobs).toHaveLength(0);
      expect(diff.reconfirmedJobIds).toHaveLength(0);
      expect(diff.closedJobIds).toHaveLength(0);
      expect(diff.isUnchanged).toBe(false);
    });

    it('detects zero changes when ATS response matches existing active jobs', () => {
      const existingJobs: AtsJobRecord[] = [
        {
          id: 'row-101',
          company_id: mockCompany.id,
          ats_job_id: 'job-101',
          title: 'Software Engineer Intern',
          location: 'San Francisco, CA',
          department: 'Engineering',
          job_url: 'https://stripe.com/jobs/101',
          description_raw: '<p>Join us</p>',
          description_clean: 'Join us',
          category: 'Software Engineering',
          job_type: 'Internship',
          work_model: 'Hybrid',
          salary_range: null,
          skills: ['Go', 'TypeScript'],
          raw_json: {},
          status: 'active',
          first_seen_at: '2026-09-01T12:00:00Z',
          last_seen_at: '2026-09-01T12:00:00Z',
          closed_at: null,
          created_at: '2026-09-01T12:00:00Z',
          updated_at: '2026-09-01T12:00:00Z',
        },
        {
          id: 'row-102',
          company_id: mockCompany.id,
          ats_job_id: 'job-102',
          title: 'Infrastructure Engineer New Grad',
          location: 'Seattle, WA',
          department: 'Infrastructure',
          job_url: 'https://stripe.com/jobs/102',
          description_raw: '<p>Build infrastructure</p>',
          description_clean: 'Build infrastructure',
          category: 'Software Engineering',
          job_type: 'New Grad',
          work_model: 'Hybrid',
          salary_range: null,
          skills: ['Kubernetes', 'AWS'],
          raw_json: {},
          status: 'active',
          first_seen_at: '2026-09-01T12:00:00Z',
          last_seen_at: '2026-09-01T12:00:00Z',
          closed_at: null,
          created_at: '2026-09-01T12:00:00Z',
          updated_at: '2026-09-01T12:00:00Z',
        },
      ];

      const diff = computeJobDiff(sampleCurrentJobs, existingJobs);

      expect(diff.newJobs).toHaveLength(0);
      expect(diff.updatedJobs).toHaveLength(0);
      expect(diff.reconfirmedJobIds).toEqual(['row-101', 'row-102']);
      expect(diff.closedJobIds).toHaveLength(0);
      expect(diff.isUnchanged).toBe(true);
    });

    it('detects a new posting, an updated posting, and a closed posting concurrently', () => {
      const existingJobs: AtsJobRecord[] = [
        {
          id: 'row-101',
          company_id: mockCompany.id,
          ats_job_id: 'job-101',
          title: 'Software Engineer Intern (Old Title)', // Title changed in new fetch
          location: 'San Francisco, CA',
          department: 'Engineering',
          job_url: 'https://stripe.com/jobs/101',
          description_raw: '<p>Join us</p>',
          description_clean: 'Join us',
          category: 'Software Engineering',
          job_type: 'Internship',
          work_model: 'Hybrid',
          salary_range: null,
          skills: ['Go'],
          raw_json: {},
          status: 'active',
          first_seen_at: '2026-09-01T10:00:00Z',
          last_seen_at: '2026-09-01T10:00:00Z',
          closed_at: null,
          created_at: '2026-09-01T10:00:00Z',
          updated_at: '2026-09-01T10:00:00Z',
        },
        {
          id: 'row-999',
          company_id: mockCompany.id,
          ats_job_id: 'job-999-delisted', // Delisted from ATS response
          title: 'Product Manager Intern',
          location: 'Remote',
          department: 'Product',
          job_url: 'https://stripe.com/jobs/999',
          description_raw: '',
          description_clean: '',
          category: 'Product Management',
          job_type: 'Internship',
          work_model: 'Remote',
          salary_range: null,
          skills: [],
          raw_json: {},
          status: 'active',
          first_seen_at: '2026-09-01T10:00:00Z',
          last_seen_at: '2026-09-01T10:00:00Z',
          closed_at: null,
          created_at: '2026-09-01T10:00:00Z',
          updated_at: '2026-09-01T10:00:00Z',
        },
      ];

      const diff = computeJobDiff(sampleCurrentJobs, existingJobs);

      expect(diff.newJobs).toHaveLength(1);
      expect(diff.newJobs[0].atsJobId).toBe('job-102'); // Brand new
      expect(diff.updatedJobs).toHaveLength(1);
      expect(diff.updatedJobs[0].existingId).toBe('row-101'); // Title updated
      expect(diff.closedJobIds).toEqual(['row-999']); // Delisted
      expect(diff.isUnchanged).toBe(false);
    });
  });

  describe('calculateNextPollInterval', () => {
    it('triggers 60s burst mode for 2 hours when a new job is detected', () => {
      const now = new Date('2026-09-01T12:00:00Z');
      const result = calculateNextPollInterval(mockCompany, true, false, now);

      expect(result.intervalSec).toBe(60);
      expect(result.burstModeUntil).toEqual(new Date('2026-09-01T14:00:00Z'));
      expect(result.consecutiveUnchangedCount).toBe(0);
      expect(result.nextPollAt).toEqual(new Date('2026-09-01T12:01:00Z'));
    });

    it('maintains 60s frequency while active in burst mode', () => {
      const companyInBurst: CompanyRecord = {
        ...mockCompany,
        burst_mode_until: '2026-09-01T14:00:00Z',
      };
      const now = new Date('2026-09-01T12:30:00Z');
      const result = calculateNextPollInterval(companyInBurst, false, true, now);

      expect(result.intervalSec).toBe(60);
      expect(result.nextPollAt).toEqual(new Date('2026-09-01T12:31:00Z'));
    });

    it('applies exponential idle decay for prolonged unchanged periods in Tier 1', () => {
      const idleCompany: CompanyRecord = {
        ...mockCompany,
        consecutive_unchanged_count: 10,
      };
      const now = new Date('2026-09-01T12:00:00Z');
      const result = calculateNextPollInterval(idleCompany, false, true, now);

      expect(result.consecutiveUnchangedCount).toBe(11);
      // Base 120s * (1.03^11 = 1.384) ~= 166s
      expect(result.intervalSec).toBeGreaterThan(120);
      expect(result.intervalSec).toBeLessThanOrEqual(180); // Capped at 180s ceiling
    });
  });
});

describe('Diff Worker — Transactional Database Execution & Atomicity', () => {
  let memDb: any;
  let pool: any;

  beforeEach(async () => {
    memDb = newDb();
    memDb.public.registerFunction({
      name: 'gen_random_uuid',
      implementation: () => '22222222-2222-2222-2222-222222222222',
    });
    memDb.public.registerFunction({
      name: 'pg_notify',
      args: ['text', 'text'],
      implementation: () => {},
    });

    const schemaSql = `
      CREATE TABLE companies (
        id UUID PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        ats_type VARCHAR(50) NOT NULL,
        board_slug VARCHAR(255) NOT NULL,
        tier VARCHAR(20) NOT NULL DEFAULT 'tier2',
        poll_interval_sec INTEGER NOT NULL DEFAULT 120,
        burst_mode_until TIMESTAMPTZ,
        last_polled_at TIMESTAMPTZ,
        next_poll_at TIMESTAMPTZ NOT NULL,
        last_status_code INTEGER,
        etag VARCHAR(255),
        last_modified_header VARCHAR(255),
        consecutive_unchanged_count INTEGER NOT NULL DEFAULT 0,
        historical_posting_velocity FLOAT NOT NULL DEFAULT 0.0,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL,
        CONSTRAINT uq_company_ats_board UNIQUE (ats_type, board_slug)
      );

      CREATE TABLE ats_jobs (
        id UUID PRIMARY KEY DEFAULT '22222222-2222-2222-2222-222222222222',
        company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        ats_job_id VARCHAR(255) NOT NULL,
        title VARCHAR(500) NOT NULL,
        location VARCHAR(255),
        department VARCHAR(255),
        job_url TEXT NOT NULL,
        description_raw TEXT,
        description_clean TEXT,
        category VARCHAR(100),
        job_type VARCHAR(50) NOT NULL DEFAULT 'unknown',
        work_model VARCHAR(50) DEFAULT 'Hybrid',
        salary_range VARCHAR(255),
        skills JSONB DEFAULT '[]'::jsonb,
        raw_json JSONB,
        status VARCHAR(50) NOT NULL DEFAULT 'active',
        first_seen_at TIMESTAMPTZ NOT NULL,
        last_seen_at TIMESTAMPTZ NOT NULL,
        closed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uq_company_job_id UNIQUE (company_id, ats_job_id)
      );

      CREATE TABLE job_events (
        id BIGSERIAL PRIMARY KEY,
        event_type VARCHAR(50) NOT NULL,
        job_id UUID NOT NULL,
        company_id UUID NOT NULL,
        payload JSONB NOT NULL,
        emitted_at TIMESTAMPTZ NOT NULL
      );
    `;

    const pgAdapter = memDb.adapters.createPg();
    pool = new pgAdapter.Pool();

    await pool.query(schemaSql);

    // Seed test company
    await pool.query(`
      INSERT INTO companies (
        id, name, ats_type, board_slug, tier, poll_interval_sec, next_poll_at, created_at, updated_at
      ) VALUES (
        '11111111-1111-1111-1111-111111111111', 'Stripe', 'greenhouse', 'stripe', 'tier1', 120, NOW(), NOW(), NOW()
      );
    `);
  });

  it('inserts new jobs and outbox events in a single atomic transaction', async () => {
    const companyRes = await pool.query(`SELECT * FROM companies WHERE id = '11111111-1111-1111-1111-111111111111'`);
    const company: CompanyRecord = companyRes.rows[0];

    const currentJobs: NormalizedAtsJob[] = [
      {
        atsJobId: 'job-stripe-1',
        title: 'Software Engineer Intern',
        location: 'San Francisco, CA',
        jobUrl: 'https://stripe.com/jobs/1',
        descriptionClean: 'Build API platform',
        category: 'Software Engineering',
        jobType: 'Internship',
        workModel: 'Hybrid',
        skills: ['TypeScript', 'Go'],
      },
    ];

    const diff = computeJobDiff(currentJobs, []);
    const client = await pool.connect();
    let result;
    try {
      await client.query('BEGIN');
      result = await applyDiffInTransaction(client, company, diff, { statusCode: 200, etag: '"etag-123"' });
      await client.query('COMMIT');
    } finally {
      client.release();
    }

    expect(result.insertedCount).toBe(1);
    expect(result.createdEvents).toHaveLength(1);
    expect(result.createdEvents[0].event_type).toBe('JOB_CREATED');

    // Verify ats_jobs table has exactly 1 row
    const jobsRes = await pool.query(`SELECT * FROM ats_jobs`);
    expect(jobsRes.rows).toHaveLength(1);
    expect(jobsRes.rows[0].ats_job_id).toBe('job-stripe-1');
    expect(jobsRes.rows[0].status).toBe('active');

    // Verify job_events outbox table has exactly 1 matching row
    const eventsRes = await pool.query(`SELECT * FROM job_events`);
    expect(eventsRes.rows).toHaveLength(1);
    expect(eventsRes.rows[0].event_type).toBe('JOB_CREATED');
    expect(eventsRes.rows[0].payload.companyName).toBe('Stripe');

    // Verify company etag was updated
    const updatedCompany = (await pool.query(`SELECT * FROM companies WHERE id = '${company.id}'`)).rows[0];
    expect(updatedCompany.etag).toBe('"etag-123"');
  });

  it('guarantees rollback atomicity if an error occurs mid-transaction', async () => {
    const backup = memDb.backup();
    const companyRes = await pool.query(`SELECT * FROM companies WHERE id = '11111111-1111-1111-1111-111111111111'`);
    const company: CompanyRecord = companyRes.rows[0];

    const currentJobs: NormalizedAtsJob[] = [
      {
        atsJobId: 'job-stripe-atomic',
        title: 'Backend Engineer',
        jobUrl: 'https://stripe.com/jobs/atomic',
      },
    ];

    const diff = computeJobDiff(currentJobs, []);
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      await applyDiffInTransaction(client, company, diff);
      throw new Error('Simulated network crash before commit');
    } catch {
      await client.query('ROLLBACK');
      backup.restore();
    } finally {
      client.release();
    }

    // Verify zero orphaned rows exist in either ats_jobs or job_events
    const jobsRes = await pool.query(`SELECT * FROM ats_jobs WHERE ats_job_id = 'job-stripe-atomic'`);
    expect(jobsRes.rows).toHaveLength(0);

    const eventsRes = await pool.query(`SELECT * FROM job_events WHERE payload->>'title' = 'Backend Engineer'`);
    expect(eventsRes.rows).toHaveLength(0);
  });
});
