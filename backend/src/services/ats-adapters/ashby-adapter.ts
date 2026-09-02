import { AtsAdapter, AtsAdapterResponse, AtsFetchOptions } from './types.js';
import { NormalizedAtsJob } from '../../types/ats.js';
import { stripHtml, inferJobType, inferWorkModel, inferCategory, extractSkills } from './normalize-helpers.js';

export class AshbyAdapter implements AtsAdapter {
  public readonly atsType = 'ashby';

  public async fetchJobs(boardSlug: string, options: AtsFetchOptions = {}): Promise<AtsAdapterResponse> {
    const fetchFn = options.customFetch || fetch;
    const url = `https://api.ashbyhq.com/posting-api/job-board/${boardSlug}`;

    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'User-Agent': 'ResumeHack-FreshnessBot/1.0',
    };

    if (options.etag) {
      headers['If-None-Match'] = options.etag;
    }
    if (options.lastModified) {
      headers['If-Modified-Since'] = options.lastModified;
    }

    try {
      const res = await fetchFn(url, { method: 'GET', headers });

      if (res.status === 304) {
        return {
          status: 'not_modified',
          statusCode: 304,
          jobs: [],
          etag: options.etag,
          lastModified: options.lastModified,
          pagesFetched: 1,
        };
      }

      if (!res.ok) {
        return {
          status: 'error',
          statusCode: res.status,
          jobs: [],
          pagesFetched: 1,
          error: `Ashby API returned HTTP ${res.status}: ${res.statusText}`,
        };
      }

      const responseEtag = res.headers.get('etag') || res.headers.get('ETag');
      const responseLastModified = res.headers.get('last-modified') || res.headers.get('Last-Modified');

      const data = await res.json();
      const rawJobs = Array.isArray(data?.jobs) ? data.jobs : [];

      const normalizedJobs: NormalizedAtsJob[] = rawJobs.map((raw: any) => {
        const title = (raw.title || '').trim();
        const descriptionRaw = raw.descriptionHtml || raw.description || '';
        const descriptionClean = raw.descriptionPlain || stripHtml(descriptionRaw);
        const locationName = (raw.locationName || raw.location?.name || '').trim();
        const department = (raw.departmentName || raw.department?.name || raw.department || '').trim();
        const isRemote = Boolean(raw.isRemote);
        const employmentType = (raw.employmentType || '').trim();

        return {
          atsJobId: String(raw.id),
          title,
          location: locationName || (isRemote ? 'Remote' : undefined),
          department: department || undefined,
          jobUrl: raw.jobUrl || `https://jobs.ashbyhq.com/${boardSlug}/${raw.id}`,
          descriptionRaw,
          descriptionClean,
          category: inferCategory(title),
          jobType: inferJobType(`${title} ${employmentType}`, descriptionClean),
          workModel: isRemote ? 'Remote' : inferWorkModel(locationName, descriptionClean),
          skills: extractSkills(descriptionClean),
          rawJson: raw,
        };
      });

      return {
        status: 'ok',
        statusCode: res.status,
        jobs: normalizedJobs,
        etag: responseEtag,
        lastModified: responseLastModified,
        pagesFetched: 1,
      };
    } catch (err: any) {
      return {
        status: 'error',
        statusCode: 0,
        jobs: [],
        pagesFetched: 0,
        error: err?.message || 'Network error fetching Ashby jobs',
      };
    }
  }
}
