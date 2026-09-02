import { AtsAdapter, AtsAdapterResponse, AtsFetchOptions } from './types.js';
import { NormalizedAtsJob } from '../../types/ats.js';
import { stripHtml, inferJobType, inferWorkModel, inferCategory, extractSkills } from './normalize-helpers.js';

export class GreenhouseAdapter implements AtsAdapter {
  public readonly atsType = 'greenhouse';

  public async fetchJobs(boardSlug: string, options: AtsFetchOptions = {}): Promise<AtsAdapterResponse> {
    const fetchFn = options.customFetch || fetch;
    const url = `https://boards-api.greenhouse.io/v1/boards/${boardSlug}/jobs?content=true`;

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
          error: `Greenhouse API returned HTTP ${res.status}: ${res.statusText}`,
        };
      }

      const responseEtag = res.headers.get('etag') || res.headers.get('ETag');
      const responseLastModified = res.headers.get('last-modified') || res.headers.get('Last-Modified');

      const data = await res.json();
      const rawJobs = Array.isArray(data?.jobs) ? data.jobs : [];

      const normalizedJobs: NormalizedAtsJob[] = rawJobs.map((raw: any) => {
        const title = (raw.title || '').trim();
        const descriptionRaw = raw.content || '';
        const descriptionClean = stripHtml(descriptionRaw);
        const locationName = (raw.location?.name || '').trim();
        const departments = Array.isArray(raw.departments) ? raw.departments.map((d: any) => d.name).filter(Boolean) : [];
        const department = departments[0] || (raw.department?.name || '');

        return {
          atsJobId: String(raw.id),
          title,
          location: locationName || undefined,
          department: department || undefined,
          jobUrl: raw.absolute_url || `https://boards.greenhouse.io/${boardSlug}/jobs/${raw.id}`,
          descriptionRaw,
          descriptionClean,
          category: inferCategory(title),
          jobType: inferJobType(title, descriptionClean),
          workModel: inferWorkModel(locationName, descriptionClean),
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
        error: err?.message || 'Network error fetching Greenhouse jobs',
      };
    }
  }
}
