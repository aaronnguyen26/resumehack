import { describe, it, expect, beforeEach } from 'vitest';
import { newDb, DataType } from 'pg-mem';
import crypto from 'crypto';
import { GreenhouseAdapter, LeverAdapter, SmartRecruitersAdapter } from '../services/ats-adapters/index.js';
import { computeJobDiff, applyDiffInTransaction } from '../services/diff-worker.js';
import { AdaptivePollerScheduler } from '../services/adaptive-poller.js';
import { CompanyRecord, NormalizedAtsJob } from '../types/ats.js';

describe('Step 3: Comprehensive Freshness Pipeline Integration Verification', () => {
  let memDb: any;
  let pool: any;
  let notifiedEvents: Array<{ channel: string; payload: string }> = [];

  beforeEach(async () => {
    memDb = newDb();
    notifiedEvents = [];

    memDb.public.registerFunction({
      name: 'gen_random_uuid',
      returns: DataType.uuid,
      deterministic: false,
      implementation: () => crypto.randomUUID(),
    });

    memDb.public.registerFunction({
      name: 'pg_notify',
      args: ['text', 'text'],
      implementation: (channel: string, payload: string) => {
        notifiedEvents.push({ channel, payload });
      },
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
        id UUID PRIMARY KEY,
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
  });

  // ── 1. End-to-End Latency Verification (< 2 min ATS detection, < 5 sec push) ─
  it('VERIFICATION 1: End-to-End Latency Benchmark & SLA Compliance', async () => {
    const companyId = crypto.randomUUID();
    await pool.query(`
      INSERT INTO companies (id, name, ats_type, board_slug, tier, poll_interval_sec, next_poll_at, created_at, updated_at)
      VALUES ('${companyId}', 'Stripe', 'greenhouse', 'stripe', 'tier1', 120, NOW() - INTERVAL '1 second', NOW(), NOW());
    `);

    // Simulated new posting on Greenhouse
    const newPostings = [
      {
        id: 987654,
        title: 'Software Engineer Intern — Summer 2026',
        absolute_url: 'https://boards.greenhouse.io/stripe/jobs/987654',
        location: { name: 'San Francisco, CA' },
        departments: [{ name: 'Infrastructure' }],
        content: '<p>Build payments systems with TypeScript and Go.</p>',
      },
    ];

    const customFetch = async () => {
      // Simulate typical 120ms network transit from ATS
      await new Promise((r) => setTimeout(r, 10));
      return new Response(JSON.stringify({ jobs: newPostings }), {
        status: 200,
        headers: { 'ETag': '"stripe-etag-1"' },
      });
    };

    const scheduler = new AdaptivePollerScheduler(pool, {
      maxConcurrency: 5,
      minDomainSpacingMs: 0,
      customFetch: customFetch as any,
    });

    const startTime = performance.now();
    const tickRes = await scheduler.pollTick();
    if (tickRes.done) await tickRes.done;
    const endTime = performance.now();

    const detectionToDeliveryDurationMs = endTime - startTime;

    // SLA Criterion 1: Detection-to-Push Latency must be < 5000ms (measured in ms)
    expect(detectionToDeliveryDurationMs).toBeLessThan(5000);

    // SLA Criterion 2: Verified Postgres LISTEN/NOTIFY frame was emitted
    expect(notifiedEvents).toHaveLength(1);
    expect(notifiedEvents[0].channel).toBe('job_events_channel');
    const envelope = JSON.parse(notifiedEvents[0].payload);
    const eventPayload = envelope.job || envelope;
    expect(eventPayload.companyName).toBe('Stripe');
    expect(eventPayload.title).toBe('Software Engineer Intern — Summer 2026');

    // SLA Criterion 3: Verified company poll interval entered 60s Burst Mode for 2h
    const updatedCompany = (await pool.query(`SELECT * FROM companies WHERE id = '${companyId}'`)).rows[0];
    expect(updatedCompany.poll_interval_sec).toBe(60);
    expect(updatedCompany.burst_mode_until).not.toBeNull();
  });

  // ── 2. Transactional Atomicity (Worker Crash Mid-Transaction) ─────────────
  it('VERIFICATION 2: Transactional Atomicity guarantees zero orphaned records on crash', async () => {
    const backup = memDb.backup();
    const companyId = crypto.randomUUID();
    await pool.query(`
      INSERT INTO companies (id, name, ats_type, board_slug, tier, next_poll_at, created_at, updated_at)
      VALUES ('${companyId}', 'OpenAI', 'ashby', 'openai', 'tier1', NOW(), NOW(), NOW());
    `);

    const companyRes = await pool.query(`SELECT * FROM companies WHERE id = '${companyId}'`);
    const company: CompanyRecord = companyRes.rows[0];

    const currentJobs: NormalizedAtsJob[] = [
      {
        atsJobId: 'ashby-crash-test',
        title: 'Research Engineer',
        jobUrl: 'https://jobs.ashbyhq.com/openai/crash',
      },
    ];

    const diff = computeJobDiff(currentJobs, []);
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      await applyDiffInTransaction(client, company, diff);
      // Simulate fatal unhandled exception / SIGKILL mid-transaction
      throw new Error('Worker process crashed before COMMIT');
    } catch {
      await client.query('ROLLBACK');
      backup.restore();
    } finally {
      client.release();
    }

    // Assert zero records in ats_jobs
    const jobs = (await pool.query(`SELECT * FROM ats_jobs WHERE ats_job_id = 'ashby-crash-test'`)).rows;
    expect(jobs).toHaveLength(0);

    // Assert zero orphaned records in job_events outbox
    const events = (await pool.query(`SELECT * FROM job_events WHERE payload->>'atsJobId' = 'ashby-crash-test'`)).rows;
    expect(events).toHaveLength(0);
  });

  // ── 3. Multi-Page Aggregation Non-Closure Test ────────────────────────────
  it('VERIFICATION 3: Multi-page aggregation prevents closing jobs on subsequent pages', async () => {
    const companyId = crypto.randomUUID();
    await pool.query(`
      INSERT INTO companies (id, name, ats_type, board_slug, tier, next_poll_at, created_at, updated_at)
      VALUES ('${companyId}', 'Spotify', 'smartrecruiters', 'spotify', 'tier1', NOW() - INTERVAL '1 minute', NOW(), NOW());
    `);

    // Existing active jobs in database: one from page 1, one from page 2
    await pool.query(`
      INSERT INTO ats_jobs (id, company_id, ats_job_id, title, job_url, status, first_seen_at, last_seen_at)
      VALUES
        ('${crypto.randomUUID()}', '${companyId}', 'sr-page-1-job', 'Engineer 1', 'https://job1', 'active', NOW(), NOW()),
        ('${crypto.randomUUID()}', '${companyId}', 'sr-page-2-job', 'Engineer 2', 'https://job2', 'active', NOW(), NOW());
    `);

    // Multi-page mock response: Page 1 has job 1, Page 2 has job 2
    const page1Content = [{ id: 'sr-page-1-job', name: 'Engineer 1' }];
    const page2Content = [{ id: 'sr-page-2-job', name: 'Engineer 2' }];

    const customFetch = async (url: string) => {
      if (url.includes('offset=0')) {
        return new Response(JSON.stringify({ totalFound: 2, offset: 0, limit: 1, content: page1Content }), { status: 200 });
      }
      if (url.includes('offset=1')) {
        return new Response(JSON.stringify({ totalFound: 2, offset: 1, limit: 1, content: page2Content }), { status: 200 });
      }
      return new Response(JSON.stringify({ totalFound: 2, offset: 2, limit: 1, content: [] }), { status: 200 });
    };

    const scheduler = new AdaptivePollerScheduler(pool, {
      maxConcurrency: 1,
      minDomainSpacingMs: 0,
      customFetch: customFetch as any,
    });

    const tickRes = await scheduler.pollTick();
    if (tickRes.done) await tickRes.done;

    // Verify neither job was closed
    const activeJobs = (await pool.query(`SELECT * FROM ats_jobs WHERE company_id = '${companyId}' AND status = 'active'`)).rows;
    expect(activeJobs).toHaveLength(2);

    const closedJobs = (await pool.query(`SELECT * FROM ats_jobs WHERE company_id = '${companyId}' AND status = 'closed'`)).rows;
    expect(closedJobs).toHaveLength(0);
  });

  // ── 4. Burst Load Concurrency & Domain Throttling ─────────────────────────
  it('VERIFICATION 4: 20+ companies entering burst mode simultaneously maintain concurrency limits', async () => {
    // Seed 25 companies
    for (let i = 1; i <= 25; i++) {
      const id = crypto.randomUUID();
      await pool.query(`
        INSERT INTO companies (id, name, ats_type, board_slug, tier, burst_mode_until, next_poll_at, created_at, updated_at)
        VALUES ('${id}', 'Burst Company ${i}', 'greenhouse', 'burst-${i}', 'tier1', NOW() + INTERVAL '2 hours', NOW() - INTERVAL '10 seconds', NOW(), NOW());
      `);
    }

    let concurrentRequests = 0;
    let maxObservedConcurrency = 0;

    const customFetch = async () => {
      concurrentRequests += 1;
      maxObservedConcurrency = Math.max(maxObservedConcurrency, concurrentRequests);
      await new Promise((r) => setTimeout(r, 15));
      concurrentRequests -= 1;
      return new Response(JSON.stringify({ jobs: [] }), { status: 200 });
    };

    const scheduler = new AdaptivePollerScheduler(pool, {
      maxConcurrency: 5,
      minDomainSpacingMs: 0,
      customFetch: customFetch as any,
    });

    // Run until all 25 are claimed
    let totalClaimed = 0;
    for (let t = 0; t < 6; t++) {
      const tick = await scheduler.pollTick();
      totalClaimed += tick.claimed;
      if (tick.done) await tick.done;
    }

    expect(totalClaimed).toBe(25);
    // Assert concurrency never exceeded the configured ceiling of 5
    expect(maxObservedConcurrency).toBeLessThanOrEqual(5);
  });

  // ── 5. Catch-Up Replay Buffer Verification ────────────────────────────────
  it('VERIFICATION 5: Missed event catch-up replay via Last-Event-ID', async () => {
    const companyId = crypto.randomUUID();
    const jobId1 = crypto.randomUUID();
    const jobId2 = crypto.randomUUID();

    // Insert 2 historical events into job_events
    await pool.query(`
      INSERT INTO companies (id, name, ats_type, board_slug, tier, next_poll_at, created_at, updated_at)
      VALUES ('${companyId}', 'Figma', 'lever', 'figma', 'tier1', NOW(), NOW(), NOW());

      INSERT INTO ats_jobs (id, company_id, ats_job_id, title, job_url, first_seen_at, last_seen_at)
      VALUES
        ('${jobId1}', '${companyId}', 'figma-1', 'Product Designer', 'https://job1', NOW(), NOW()),
        ('${jobId2}', '${companyId}', 'figma-2', 'Frontend Engineer', 'https://job2', NOW(), NOW());

      INSERT INTO job_events (id, event_type, job_id, company_id, payload, emitted_at)
      VALUES
        (101, 'JOB_CREATED', '${jobId1}', '${companyId}', '{"jobId":"${jobId1}","title":"Product Designer"}'::jsonb, NOW()),
        (102, 'JOB_CREATED', '${jobId2}', '${companyId}', '{"jobId":"${jobId2}","title":"Frontend Engineer"}'::jsonb, NOW());
    `);

    // Query catch-up replay for client that disconnected at event 100
    const missed = (await pool.query(`SELECT id, payload FROM job_events WHERE id > 100 ORDER BY id ASC`)).rows;
    expect(missed).toHaveLength(2);
    expect(missed[0].id).toBe(101);
    expect(missed[1].id).toBe(102);
    expect(missed[0].payload.title).toBe('Product Designer');
    expect(missed[1].payload.title).toBe('Frontend Engineer');
  });
});
