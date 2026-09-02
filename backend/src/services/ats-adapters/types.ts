import { AtsType, NormalizedAtsJob } from '../../types/ats.js';

export interface AtsFetchOptions {
  etag?: string | null;
  lastModified?: string | null;
  customFetch?: typeof fetch;
  timeoutMs?: number;
}

export interface AtsAdapterResponse {
  status: 'ok' | 'not_modified' | 'error';
  statusCode: number;
  jobs: NormalizedAtsJob[];
  etag?: string | null;
  lastModified?: string | null;
  pagesFetched: number;
  error?: string;
}

export interface AtsAdapter {
  readonly atsType: AtsType;
  fetchJobs(boardSlug: string, options?: AtsFetchOptions): Promise<AtsAdapterResponse>;
}
