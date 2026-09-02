export type AtsType = 'greenhouse' | 'lever' | 'ashby' | 'smartrecruiters' | 'custom';
export type CompanyTier = 'tier1' | 'tier2' | 'tier3';
export type JobStatus = 'active' | 'closed';
export type JobType = 'Internship' | 'New Grad' | 'Full-time' | 'unknown';
export type WorkModel = 'Remote' | 'Hybrid' | 'On-site';

export interface CompanyRecord {
  id: string;
  name: string;
  ats_type: AtsType;
  board_slug: string;
  tier: CompanyTier;
  poll_interval_sec: number;
  burst_mode_until: string | null;
  last_polled_at: string | null;
  next_poll_at: string;
  last_status_code: number | null;
  etag: string | null;
  last_modified_header: string | null;
  consecutive_unchanged_count: number;
  historical_posting_velocity: number;
  created_at: string;
  updated_at: string;
}

export interface AtsJobRecord {
  id: string;
  company_id: string;
  ats_job_id: string;
  title: string;
  location: string | null;
  department: string | null;
  job_url: string;
  description_raw: string | null;
  description_clean: string | null;
  category: string | null;
  job_type: JobType;
  work_model: WorkModel;
  salary_range: string | null;
  skills: string[];
  raw_json: any;
  status: JobStatus;
  first_seen_at: string;
  last_seen_at: string;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface NormalizedAtsJob {
  atsJobId: string;
  title: string;
  location?: string;
  department?: string;
  jobUrl: string;
  descriptionRaw?: string;
  descriptionClean?: string;
  category?: string;
  jobType?: JobType;
  workModel?: WorkModel;
  salaryRange?: string;
  skills?: string[];
  rawJson?: any;
}

export interface JobDiffResult {
  newJobs: NormalizedAtsJob[];
  updatedJobs: { current: NormalizedAtsJob; existingId: string }[];
  reconfirmedJobIds: string[];
  closedJobIds: string[];
  isUnchanged: boolean;
}

export interface JobEventPayload {
  id?: string;
  jobId: string;
  atsJobId: string;
  companyId: string;
  companyName: string;
  atsType: AtsType;
  boardSlug: string;
  title: string;
  location?: string;
  jobUrl: string;
  category?: string;
  jobType: JobType;
  workModel: WorkModel;
  salaryRange?: string;
  skills: string[];
  firstSeenAt: string;
  status: JobStatus;
}

export interface JobEventRecord {
  id: string;
  event_type: 'JOB_CREATED' | 'JOB_CLOSED' | 'JOB_UPDATED';
  job_id: string;
  company_id: string;
  payload: JobEventPayload;
  emitted_at: string;
}
