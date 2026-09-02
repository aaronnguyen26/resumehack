import { describe, it, expect, beforeEach } from 'vitest';
import { newDb, DataType } from 'pg-mem';
import crypto from 'crypto';
import { AdaptivePollerScheduler } from '../services/adaptive-poller.js';

describe('Adaptive Poller Scheduler — Checkpoint 4 Test Suite', () => {
  let memDb: any;
  let pool: any;

  beforeEach(async () => {
    memDb = newDb();
    memDb.public.registerFunction({
      name: 'gen_random_uuid',
      returns: DataType.uuid,
      deterministic: false,
      implementation: () => crypto.randomUUID(),
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

  it('claims overdue companies and prioritizes Burst and Tier-1 over Tier-2 and Tier-3', async () => {
    // Insert 4 companies with past next_poll_at
    await pool.query(`
      INSERT INTO companies (id, name, ats_type, board_slug, tier, next_poll_at, burst_mode_until, created_at, updated_at)
      VALUES
        ('11111111-1111-1111-1111-111111111111', 'Cold Co', 'greenhouse', 'cold', 'tier3', NOW() - INTERVAL '1 hour', NULL, NOW(), NOW()),
        ('22222222-2222-2222-2222-222222222222', 'Medium Co', 'greenhouse', 'medium', 'tier2', NOW() - INTERVAL '10 minutes', NULL, NOW(), NOW()),
        ('33333333-3333-3333-3333-333333333333', 'Tier1 Co', 'greenhouse', 'tier1', 'tier1', NOW() - INTERVAL '2 minutes', NULL, NOW(), NOW()),
        ('44444444-4444-4444-4444-444444444444', 'Burst Co', 'greenhouse', 'burst', 'tier1', NOW() - INTERVAL '1 minute', NOW() + INTERVAL '1 hour', NOW(), NOW());
    `);

    const customFetch = async () => new Response(JSON.stringify({ jobs: [] }), { status: 200 });
    const scheduler = new AdaptivePollerScheduler(pool, {
      maxConcurrency: 2, // Only claim top 2
      minDomainSpacingMs: 0,
      customFetch: customFetch as any,
    });

    const tickRes = await scheduler.pollTick();
    expect(tickRes.claimed).toBe(2);
    if (tickRes.done) await tickRes.done;

    // Verify top 2 claimed companies were Burst Co (Burst priority) and Tier1 Co (Tier1 priority)
    const claimedRows = (await pool.query(`SELECT name, next_poll_at FROM companies ORDER BY name ASC`)).rows;
    const burst = claimedRows.find((r: any) => r.name === 'Burst Co');
    const tier1 = claimedRows.find((r: any) => r.name === 'Tier1 Co');
    const cold = claimedRows.find((r: any) => r.name === 'Cold Co');

    // Claimed companies have had their next_poll_at postponed into the future
    expect(new Date(burst.next_poll_at).getTime()).toBeGreaterThan(Date.now());
    expect(new Date(tier1.next_poll_at).getTime()).toBeGreaterThan(Date.now());
    // Unclaimed company next_poll_at remains in the past
    expect(new Date(cold.next_poll_at).getTime()).toBeLessThan(Date.now());
  });

  it('processes 20+ companies under concurrency limit without dropping jobs', async () => {
    // Seed 20 Tier-1 companies
    for (let i = 1; i <= 20; i++) {
      const id = crypto.randomUUID();
      await pool.query(`
        INSERT INTO companies (id, name, ats_type, board_slug, tier, next_poll_at, created_at, updated_at)
        VALUES ('${id}', 'Company ${i}', 'greenhouse', 'co-${i}', 'tier1', NOW() - INTERVAL '1 minute', NOW(), NOW());
      `);
    }

    let fetchCount = 0;
    const customFetch = async () => {
      fetchCount += 1;
      return new Response(JSON.stringify({
        jobs: [
          {
            id: `job-batch-${fetchCount}`,
            title: `Software Engineer ${fetchCount}`,
            absolute_url: 'https://boards.greenhouse.io/job',
          },
        ],
      }), { status: 200 });
    };

    const scheduler = new AdaptivePollerScheduler(pool, {
      maxConcurrency: 5,
      minDomainSpacingMs: 0,
      customFetch: customFetch as any,
    });

    // Run ticks until all 20 companies are processed
    let totalProcessed = 0;
    for (let t = 0; t < 5; t++) {
      const tick = await scheduler.pollTick();
      totalProcessed += tick.processed;
      if (tick.done) await tick.done;
    }

    expect(totalProcessed).toBe(20);
    // Allow asynchronous workers to settle
    await new Promise((r) => setTimeout(r, 100));

    // Verify all 20 jobs were created in database
    const jobsCount = (await pool.query('SELECT count(*) FROM ats_jobs')).rows[0].count;
    expect(Number(jobsCount)).toBe(20);

    const eventsCount = (await pool.query('SELECT count(*) FROM job_events')).rows[0].count;
    expect(Number(eventsCount)).toBe(20);
  });

  it('handles 304 Not Modified short-circuits smoothly in scheduler', async () => {
    const id = crypto.randomUUID();
    await pool.query(`
      INSERT INTO companies (id, name, ats_type, board_slug, tier, etag, next_poll_at, created_at, updated_at)
      VALUES ('${id}', 'Stripe', 'greenhouse', 'stripe', 'tier1', '"etag-999"', NOW() - INTERVAL '1 minute', NOW(), NOW());
    `);

    const customFetch = async () => new Response(null, { status: 304 });
    const scheduler = new AdaptivePollerScheduler(pool, {
      maxConcurrency: 1,
      minDomainSpacingMs: 0,
      customFetch: customFetch as any,
    });

    const tick = await scheduler.pollTick();
    if (tick.done) await tick.done;

    // Verify company status code updated to 304 and consecutive_unchanged_count incremented
    const comp = (await pool.query(`SELECT * FROM companies WHERE id = '${id}'`)).rows[0];
    expect(comp.last_status_code).toBe(304);
    expect(comp.consecutive_unchanged_count).toBe(1);

    // Verify 0 events were emitted
    const events = (await pool.query('SELECT count(*) FROM job_events')).rows[0].count;
    expect(Number(events)).toBe(0);
  });
});
