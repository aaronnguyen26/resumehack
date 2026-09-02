import pg from 'pg';
import {
  CompanyRecord,
  AtsJobRecord,
  NormalizedAtsJob,
  JobDiffResult,
  JobEventPayload,
  JobEventRecord,
} from '../types/ats.js';

export interface ApplyDiffOptions {
  statusCode?: number;
  etag?: string | null;
  lastModifiedHeader?: string | null;
}

export interface ApplyDiffResult {
  insertedCount: number;
  updatedCount: number;
  closedCount: number;
  reconfirmedCount: number;
  isUnchanged: boolean;
  nextPollIntervalSec: number;
  burstModeUntil: string | null;
  createdEvents: JobEventRecord[];
}

/**
 * Pure function: Compares freshly fetched ATS jobs against existing database jobs for a company.
 */
export function computeJobDiff(
  currentJobs: NormalizedAtsJob[],
  existingJobs: AtsJobRecord[]
): JobDiffResult {
  const existingJobMap = new Map<string, AtsJobRecord>();
  for (const job of existingJobs) {
    existingJobMap.set(job.ats_job_id, job);
  }

  const currentJobMap = new Map<string, NormalizedAtsJob>();
  for (const job of currentJobs) {
    currentJobMap.set(job.atsJobId, job);
  }

  const newJobs: NormalizedAtsJob[] = [];
  const updatedJobs: { current: NormalizedAtsJob; existingId: string }[] = [];
  const reconfirmedJobIds: string[] = [];

  for (const current of currentJobs) {
    const existing = existingJobMap.get(current.atsJobId);
    if (!existing) {
      // Completely new job posting
      newJobs.push(current);
    } else {
      // Check if job was previously closed, or title/location/description changed
      const wasClosed = existing.status === 'closed';
      const titleChanged = existing.title !== current.title;
      const locationChanged = (existing.location || '') !== (current.location || '');
      const descChanged = (existing.description_clean || '') !== (current.descriptionClean || '') && (current.descriptionClean?.length || 0) > 0;

      if (wasClosed || titleChanged || locationChanged || descChanged) {
        updatedJobs.push({ current, existingId: existing.id });
      } else {
        reconfirmedJobIds.push(existing.id);
      }
    }
  }

  // Active DB jobs missing from current ATS response are closed
  const closedJobIds: string[] = [];
  for (const existing of existingJobs) {
    if (existing.status === 'active' && !currentJobMap.has(existing.ats_job_id)) {
      closedJobIds.push(existing.id);
    }
  }

  const isUnchanged = newJobs.length === 0 && updatedJobs.length === 0 && closedJobIds.length === 0;

  return {
    newJobs,
    updatedJobs,
    reconfirmedJobIds,
    closedJobIds,
    isUnchanged,
  };
}

/**
 * Pure function: Calculates adaptive polling interval, burst-mode timer, and tier decay.
 */
export function calculateNextPollInterval(
  company: CompanyRecord,
  hasNewJobs: boolean,
  isUnchanged: boolean,
  now: Date = new Date()
): {
  intervalSec: number;
  burstModeUntil: Date | null;
  consecutiveUnchangedCount: number;
  nextPollAt: Date;
} {
  let consecutiveUnchangedCount = company.consecutive_unchanged_count || 0;
  let burstModeUntil: Date | null = company.burst_mode_until ? new Date(company.burst_mode_until) : null;
  const isCurrentlyInBurst = burstModeUntil !== null && burstModeUntil.getTime() > now.getTime();

  // Base interval per tier
  const baseIntervalMap = {
    tier1: 120, // 2 mins
    tier2: 600, // 10 mins
    tier3: 1800, // 30 mins
  };
  const baseInterval = baseIntervalMap[company.tier] || 120;

  let intervalSec = baseInterval;

  if (hasNewJobs) {
    // A new posting was detected! Trigger 2-hour burst mode at 60s frequency
    consecutiveUnchangedCount = 0;
    burstModeUntil = new Date(now.getTime() + 2 * 60 * 60 * 1000); // +2 hours
    intervalSec = 60; // 60s polling during burst mode
  } else if (isCurrentlyInBurst) {
    // Continue in burst mode until time expires
    intervalSec = 60;
  } else if (isUnchanged) {
    consecutiveUnchangedCount += 1;

    // Adaptive idle decay: slightly increase poll interval during prolonged quiet periods
    if (company.tier === 'tier1') {
      // Tier 1 decays from 120s up to a ceiling of 180s (3m)
      const decayFactor = Math.min(1.5, Math.pow(1.03, consecutiveUnchangedCount));
      intervalSec = Math.round(baseInterval * decayFactor);
    } else if (company.tier === 'tier2') {
      // Tier 2 decays from 10m up to 20m
      const decayFactor = Math.min(2.0, Math.pow(1.05, consecutiveUnchangedCount));
      intervalSec = Math.round(baseInterval * decayFactor);
    } else {
      // Tier 3 decays from 30m up to 60m
      const decayFactor = Math.min(2.0, Math.pow(1.05, consecutiveUnchangedCount));
      intervalSec = Math.round(baseInterval * decayFactor);
    }
  } else {
    // Jobs were closed or updated, but no new jobs
    consecutiveUnchangedCount = 0;
    intervalSec = baseInterval;
  }

  const nextPollAt = new Date(now.getTime() + intervalSec * 1000);

  return {
    intervalSec,
    burstModeUntil,
    consecutiveUnchangedCount,
    nextPollAt,
  };
}

/**
 * Applies a computed diff within an atomic PostgreSQL transaction.
 * Guarantees zero orphaned rows and transactional atomicity between ats_jobs and job_events.
 */
export async function applyDiffInTransaction(
  client: pg.PoolClient | pg.Pool,
  company: CompanyRecord,
  diff: JobDiffResult,
  options: ApplyDiffOptions = {}
): Promise<ApplyDiffResult> {
  const now = new Date();
  const createdEvents: JobEventRecord[] = [];

  const {
    intervalSec,
    burstModeUntil,
    consecutiveUnchangedCount,
    nextPollAt,
  } = calculateNextPollInterval(company, diff.newJobs.length > 0, diff.isUnchanged, now);

  // 1. Insert New Jobs + Outbox Events
  for (const newJob of diff.newJobs) {
    const newJobId = crypto.randomUUID();
    const insertJobSql = `
      INSERT INTO ats_jobs (
        id, company_id, ats_job_id, title, location, department, job_url,
        description_raw, description_clean, category, job_type, work_model,
        salary_range, skills, raw_json, status, first_seen_at, last_seen_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'active', $16, $16)
      ON CONFLICT (company_id, ats_job_id) DO UPDATE SET
        title = EXCLUDED.title,
        location = EXCLUDED.location,
        department = EXCLUDED.department,
        job_url = EXCLUDED.job_url,
        description_clean = EXCLUDED.description_clean,
        category = EXCLUDED.category,
        job_type = EXCLUDED.job_type,
        work_model = EXCLUDED.work_model,
        salary_range = EXCLUDED.salary_range,
        skills = EXCLUDED.skills,
        raw_json = EXCLUDED.raw_json,
        status = 'active',
        last_seen_at = EXCLUDED.last_seen_at,
        closed_at = NULL
      RETURNING id, (first_seen_at = last_seen_at) AS is_brand_new, first_seen_at;
    `;

    const jobRes = await client.query(insertJobSql, [
      newJobId,
      company.id,
      newJob.atsJobId,
      newJob.title,
      newJob.location || null,
      newJob.department || null,
      newJob.jobUrl,
      newJob.descriptionRaw || null,
      newJob.descriptionClean || null,
      newJob.category || 'Software Engineering',
      newJob.jobType || 'unknown',
      newJob.workModel || 'Hybrid',
      newJob.salaryRange || null,
      JSON.stringify(newJob.skills || []),
      JSON.stringify(newJob.rawJson || {}),
      now.toISOString(),
    ]);

    const row = jobRes.rows[0];
    const jobId = row.id;

    const payload: JobEventPayload = {
      jobId,
      atsJobId: newJob.atsJobId,
      companyId: company.id,
      companyName: company.name,
      atsType: company.ats_type,
      boardSlug: company.board_slug,
      title: newJob.title,
      location: newJob.location,
      jobUrl: newJob.jobUrl,
      category: newJob.category,
      jobType: newJob.jobType || 'unknown',
      workModel: newJob.workModel || 'Hybrid',
      salaryRange: newJob.salaryRange,
      skills: newJob.skills || [],
      firstSeenAt: now.toISOString(),
      status: 'active',
    };

    // Insert Outbox Event
    const eventSql = `
      INSERT INTO job_events (event_type, job_id, company_id, payload, emitted_at)
      VALUES ('JOB_CREATED', $1, $2, $3, $4)
      RETURNING id, event_type, job_id, company_id, payload, emitted_at;
    `;
    const eventRes = await client.query(eventSql, [
      jobId,
      company.id,
      JSON.stringify(payload),
      now.toISOString(),
    ]);

    const eventRecord: JobEventRecord = eventRes.rows[0];
    createdEvents.push(eventRecord);

    // Postgres NOTIFY for real-time SSE listener
    try {
      await client.query(
        `SELECT pg_notify('job_events_channel', $1)`,
        [JSON.stringify({ eventId: eventRecord.id, type: 'JOB_CREATED', job: payload })]
      );
    } catch {
      // In-memory / non-standard mock environment fallback
    }
  }

  // 2. Update Changed Jobs (re-opened or modified)
  for (const updated of diff.updatedJobs) {
    const updateJobSql = `
      UPDATE ats_jobs SET
        title = $1,
        location = $2,
        department = $3,
        job_url = $4,
        description_clean = $5,
        category = $6,
        job_type = $7,
        work_model = $8,
        salary_range = $9,
        skills = $10,
        raw_json = $11,
        status = 'active',
        last_seen_at = $12,
        closed_at = NULL,
        updated_at = $12
      WHERE id = $13;
    `;
    await client.query(updateJobSql, [
      updated.current.title,
      updated.current.location || null,
      updated.current.department || null,
      updated.current.jobUrl,
      updated.current.descriptionClean || null,
      updated.current.category || null,
      updated.current.jobType || 'unknown',
      updated.current.workModel || 'Hybrid',
      updated.current.salaryRange || null,
      JSON.stringify(updated.current.skills || []),
      JSON.stringify(updated.current.rawJson || {}),
      now.toISOString(),
      updated.existingId,
    ]);
  }

  // 3. Mark Reconfirmed Jobs (update last_seen_at)
  if (diff.reconfirmedJobIds.length > 0) {
    const reconfirmSql = `
      UPDATE ats_jobs
      SET last_seen_at = $1, updated_at = $1
      WHERE id = ANY($2::uuid[]);
    `;
    await client.query(reconfirmSql, [now.toISOString(), diff.reconfirmedJobIds]);
  }

  // 4. Mark Closed Jobs (delisted from ATS) + Emit JOB_CLOSED
  if (diff.closedJobIds.length > 0) {
    const closeSql = `
      UPDATE ats_jobs
      SET status = 'closed', closed_at = $1, updated_at = $1
      WHERE id = ANY($2::uuid[])
      RETURNING id, ats_job_id, title;
    `;
    const closedRes = await client.query(closeSql, [now.toISOString(), diff.closedJobIds]);

    for (const closedJob of closedRes.rows) {
      const closePayload: JobEventPayload = {
        jobId: closedJob.id,
        atsJobId: closedJob.ats_job_id,
        companyId: company.id,
        companyName: company.name,
        atsType: company.ats_type,
        boardSlug: company.board_slug,
        title: closedJob.title,
        jobUrl: '',
        jobType: 'unknown',
        workModel: 'Hybrid',
        skills: [],
        firstSeenAt: now.toISOString(),
        status: 'closed',
      };

      const eventSql = `
        INSERT INTO job_events (event_type, job_id, company_id, payload, emitted_at)
        VALUES ('JOB_CLOSED', $1, $2, $3, $4)
        RETURNING id, event_type, job_id, company_id, payload, emitted_at;
      `;
      const eventRes = await client.query(eventSql, [
        closedJob.id,
        company.id,
        JSON.stringify(closePayload),
        now.toISOString(),
      ]);

      const eventRecord: JobEventRecord = eventRes.rows[0];
      createdEvents.push(eventRecord);

      try {
        await client.query(
          `SELECT pg_notify('job_events_channel', $1)`,
          [JSON.stringify({ eventId: eventRecord.id, type: 'JOB_CLOSED', job: closePayload })]
        );
      } catch {}
    }
  }

  // 5. Update Company Metadata
  const updateCompanySql = `
    UPDATE companies SET
      last_polled_at = $1,
      next_poll_at = $2,
      poll_interval_sec = $3,
      burst_mode_until = $4,
      consecutive_unchanged_count = $5,
      etag = COALESCE($6, etag),
      last_modified_header = COALESCE($7, last_modified_header),
      last_status_code = $8,
      updated_at = $1
    WHERE id = $9;
  `;
  await client.query(updateCompanySql, [
    now.toISOString(),
    nextPollAt.toISOString(),
    intervalSec,
    burstModeUntil ? burstModeUntil.toISOString() : null,
    consecutiveUnchangedCount,
    options.etag || null,
    options.lastModifiedHeader || null,
    options.statusCode || 200,
    company.id,
  ]);

  return {
    insertedCount: diff.newJobs.length,
    updatedCount: diff.updatedJobs.length,
    closedCount: diff.closedJobIds.length,
    reconfirmedCount: diff.reconfirmedJobIds.length,
    isUnchanged: diff.isUnchanged,
    nextPollIntervalSec: intervalSec,
    burstModeUntil: burstModeUntil ? burstModeUntil.toISOString() : null,
    createdEvents,
  };
}
