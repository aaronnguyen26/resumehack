import pg from 'pg';
import { CompanyRecord, AtsJobRecord } from '../types/ats.js';
import { getAtsAdapter } from './ats-adapters/index.js';
import { computeJobDiff, applyDiffInTransaction, calculateNextPollInterval } from './diff-worker.js';

export interface PollerConfig {
  maxConcurrency?: number;
  minDomainSpacingMs?: number;
  pollLoopIntervalMs?: number;
  customFetch?: typeof fetch;
}

export class AdaptivePollerScheduler {
  private pool: pg.Pool;
  private isRunning = false;
  private timer: NodeJS.Timeout | null = null;
  private activeWorkers = 0;
  private maxConcurrency: number;
  private minDomainSpacingMs: number;
  private pollLoopIntervalMs: number;
  private lastDomainRequestTime = new Map<string, number>();
  private customFetch?: typeof fetch;

  constructor(pool: pg.Pool, config: PollerConfig = {}) {
    this.pool = pool;
    this.maxConcurrency = config.maxConcurrency || 5;
    this.minDomainSpacingMs = config.minDomainSpacingMs || 250;
    this.pollLoopIntervalMs = config.pollLoopIntervalMs || 1000;
    this.customFetch = config.customFetch;
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.scheduleNextTick(0);
    console.log(`[AdaptivePoller] Scheduler started with max concurrency = ${this.maxConcurrency}.`);
  }

  public stop(): void {
    this.isRunning = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    console.log('[AdaptivePoller] Scheduler stopped.');
  }

  private scheduleNextTick(delayMs: number): void {
    if (!this.isRunning) return;
    this.timer = setTimeout(async () => {
      try {
        await this.pollTick();
      } catch (err: any) {
        console.error('[AdaptivePoller] Error in poll tick:', err.message);
      } finally {
        this.scheduleNextTick(this.pollLoopIntervalMs);
      }
    }, delayMs);
  }

  /**
   * Executes a single polling tick: claims overdue companies via FOR UPDATE SKIP LOCKED
   * and processes them respecting concurrency limits and domain throttling.
   */
  public async pollTick(): Promise<{ claimed: number; processed: number }> {
    const availableSlots = this.maxConcurrency - this.activeWorkers;
    if (availableSlots <= 0) {
      return { claimed: 0, processed: 0 };
    }

    const client = await this.pool.connect();
    let claimedCompanies: CompanyRecord[] = [];

    try {
      await client.query('BEGIN');

      // Select overdue companies ordered by Priority Weight (Burst > Tier1 > Tier2 > Tier3)
      let claimRes;
      try {
        const claimSql = `
          SELECT * FROM companies
          WHERE next_poll_at <= NOW()
          ORDER BY
            (CASE WHEN burst_mode_until IS NOT NULL AND burst_mode_until > NOW() THEN 1000 ELSE 0 END) +
            (CASE WHEN tier = 'tier1' THEN 500 WHEN tier = 'tier2' THEN 100 ELSE 10 END) DESC,
            next_poll_at ASC
          LIMIT $1
          FOR UPDATE SKIP LOCKED;
        `;
        claimRes = await client.query(claimSql, [availableSlots]);
      } catch {
        // Fallback for in-memory or environments without SKIP LOCKED
        const fallbackSql = `
          SELECT * FROM companies
          WHERE next_poll_at <= NOW()
          ORDER BY
            (CASE WHEN burst_mode_until IS NOT NULL AND burst_mode_until > NOW() THEN 1000 ELSE 0 END) +
            (CASE WHEN tier = 'tier1' THEN 500 WHEN tier = 'tier2' THEN 100 ELSE 10 END) DESC,
            next_poll_at ASC
          LIMIT $1;
        `;
        claimRes = await client.query(fallbackSql, [availableSlots]);
      }

      claimedCompanies = claimRes.rows;

      if (claimedCompanies.length > 0) {
        // Postpone next_poll_at with adaptive buffer (30s for Tier-1/Burst, 120s for Tier-2)
        // so any worker crash allows re-polling within 30s without violating the 120s SLA.
        for (const company of claimedCompanies) {
          const bufferInterval =
            (company.burst_mode_until && new Date(company.burst_mode_until) > new Date()) || company.tier === 'tier1'
              ? '30 seconds'
              : '120 seconds';
          await client.query(
            `UPDATE companies SET next_poll_at = NOW() + ($1 || ' seconds')::interval WHERE id = $2;`,
            [bufferInterval === '30 seconds' ? 30 : 120, company.id]
          );
        }
      }

      await client.query('COMMIT');
    } catch (err: any) {
      await client.query('ROLLBACK').catch(() => {});
      client.release();
      return { claimed: 0, processed: 0 };
    } finally {
      client.release();
    }

    if (claimedCompanies.length === 0) {
      return { claimed: 0, processed: 0 };
    }

    // Process claimed companies asynchronously
    const workerPromises: Promise<void>[] = [];
    for (const company of claimedCompanies) {
      this.activeWorkers += 1;
      const p = this.processCompany(company).finally(() => {
        this.activeWorkers = Math.max(0, this.activeWorkers - 1);
      });
      workerPromises.push(p);
    }

    const done = Promise.all(workerPromises).then(() => {});

    return { claimed: claimedCompanies.length, processed: claimedCompanies.length, done };
  }

  /**
   * Processes a single company: enforces domain throttle, executes ATS fetch,
   * performs diffing, and applies atomic transactional updates.
   */
  public async processCompany(company: CompanyRecord): Promise<void> {
    const domainKey = company.ats_type;
    await this.enforceDomainThrottle(domainKey);

    const client = await this.pool.connect();
    try {
      const adapter = getAtsAdapter(company.ats_type);
      const fetchRes = await adapter.fetchJobs(company.board_slug, {
        etag: company.etag,
        lastModified: company.last_modified_header,
        customFetch: this.customFetch,
      });

      await client.query('BEGIN');

      if (fetchRes.status === 'not_modified') {
        // 304 Not Modified: Short-circuit update
        const nextInterval = calculateNextPollInterval(company, false, true);
        await client.query(
          `
          UPDATE companies SET
            last_polled_at = NOW(),
            next_poll_at = $1,
            poll_interval_sec = $2,
            consecutive_unchanged_count = $3,
            last_status_code = 304,
            updated_at = NOW()
          WHERE id = $4;
        `,
          [
            nextInterval.nextPollAt.toISOString(),
            nextInterval.intervalSec,
            nextInterval.consecutiveUnchangedCount,
            company.id,
          ]
        );
      } else if (fetchRes.status === 'ok') {
        // 200 OK: Retrieve existing jobs and compute diff
        const existingJobsRes = await client.query(
          `SELECT * FROM ats_jobs WHERE company_id = $1;`,
          [company.id]
        );
        const existingJobs: AtsJobRecord[] = existingJobsRes.rows;

        const diff = computeJobDiff(fetchRes.jobs, existingJobs);

        await applyDiffInTransaction(client, company, diff, {
          statusCode: fetchRes.statusCode,
          etag: fetchRes.etag,
          lastModifiedHeader: fetchRes.lastModified,
        });
      } else {
        // Error / Rate-limit: Apply exponential penalty backoff
        const penaltySec = Math.min(3600, (company.poll_interval_sec || 120) * 2);
        await client.query(
          `
          UPDATE companies SET
            last_polled_at = NOW(),
            next_poll_at = NOW() + ($1 || ' seconds')::interval,
            last_status_code = $2,
            updated_at = NOW()
          WHERE id = $3;
        `,
          [penaltySec, fetchRes.statusCode || 500, company.id]
        );
      }

      await client.query('COMMIT');
    } catch (err: any) {
      await client.query('ROLLBACK').catch(() => {});
      console.error(`[AdaptivePoller] Failed to process ${company.name} (${company.board_slug}):`, err.message);
    } finally {
      client.release();
    }
  }

  private async enforceDomainThrottle(domain: string): Promise<void> {
    const now = Date.now();
    const lastTime = this.lastDomainRequestTime.get(domain) || 0;
    const elapsed = now - lastTime;
    if (elapsed < this.minDomainSpacingMs) {
      const waitTime = this.minDomainSpacingMs - elapsed;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
    this.lastDomainRequestTime.set(domain, Date.now());
  }

  public getActiveWorkerCount(): number {
    return this.activeWorkers;
  }
}
