import { AtsAdapter, AtsAdapterResponse, AtsFetchOptions } from './types.js';
import { NormalizedAtsJob } from '../../types/ats.js';
import { stripHtml, inferJobType, inferWorkModel, inferCategory, extractSkills } from './normalize-helpers.js';

export class LeverAdapter implements AtsAdapter {
  public readonly atsType = 'lever';

  /**
   * Lever public postings API returns JSON postings.
   * Default ordering is not guaranteed newest-first across all companies.
   * We iterate through all pages via limit/skip to ensure jobs on page 2+ are never missed.
   */
  public async fetchJobs(boardSlug: string, options: AtsFetchOptions = {}): Promise<AtsAdapterResponse> {
    const fetchFn = options.customFetch || fetch;
    const PAGE_LIMIT = 100;
    let skip = 0;
    let pagesFetched = 0;
    let responseEtag: string | null = null;
    let responseLastModified: string | null = null;
    const allNormalizedJobs: NormalizedAtsJob[] = [];

    try {
      while (true) {
        const url = `https://api.lever.co/v0/postings/${boardSlug}?mode=json&limit=${PAGE_LIMIT}&skip=${skip}`;
        const headers: Record<string, string> = {
          'Accept': 'application/json',
          'User-Agent': 'ResumeHack-FreshnessBot/1.0',
        };

        const res = await fetchFn(url, { method: 'GET', headers });
        pagesFetched += 1;

        if (!res.ok) {
          return {
            status: 'error',
            statusCode: res.status,
            jobs: allNormalizedJobs,
            pagesFetched,
            error: `Lever API returned HTTP ${res.status}: ${res.statusText}`,
          };
        }

        if (pagesFetched === 1) {
          responseEtag = res.headers.get('etag') || res.headers.get('ETag');
          responseLastModified = res.headers.get('last-modified') || res.headers.get('Last-Modified');
        }

        const rawList = await res.json();
        if (!Array.isArray(rawList) || rawList.length === 0) {
          break; // No more jobs
        }

        for (const raw of rawList) {
          const title = (raw.text || '').trim();
          const descriptionRaw = raw.description || '';
          const additionalPlain = raw.additionalPlain || '';
          const descriptionClean = `${raw.descriptionPlain || stripHtml(descriptionRaw)} ${additionalPlain}`.trim();
          const locationName = (raw.categories?.location || '').trim();
          const department = (raw.categories?.department || raw.categories?.team || '').trim();
          const commitment = (raw.categories?.commitment || '').trim();

          allNormalizedJobs.push({
            atsJobId: String(raw.id),
            title,
            location: locationName || undefined,
            department: department || undefined,
            jobUrl: raw.hostedUrl || `https://jobs.lever.co/${boardSlug}/${raw.id}`,
            descriptionRaw,
            descriptionClean,
            category: inferCategory(title),
            jobType: inferJobType(`${title} ${commitment}`, descriptionClean),
            workModel: inferWorkModel(locationName, descriptionClean),
            skills: extractSkills(descriptionClean),
            rawJson: raw,
          });
        }

        if (rawList.length < PAGE_LIMIT) {
          break; // Reached last page
        }

        skip += rawList.length;
      }

      return {
        status: 'ok',
        statusCode: 200,
        jobs: allNormalizedJobs,
        etag: responseEtag,
        lastModified: responseLastModified,
        pagesFetched,
      };
    } catch (err: any) {
      return {
        status: 'error',
        statusCode: 0,
        jobs: allNormalizedJobs,
        pagesFetched,
        error: err?.message || 'Network error fetching Lever jobs',
      };
    }
  }
}
