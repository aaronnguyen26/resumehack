import { AtsAdapter, AtsAdapterResponse, AtsFetchOptions } from './types.js';
import { NormalizedAtsJob } from '../../types/ats.js';
import { inferJobType, inferWorkModel, inferCategory, extractSkills } from './normalize-helpers.js';

export class SmartRecruitersAdapter implements AtsAdapter {
  public readonly atsType = 'smartrecruiters';

  /**
   * SmartRecruiters public postings endpoint paginates with limit/offset.
   * Default ordering is NOT guaranteed newest-first across all boards.
   * To prevent silent job omission on page 2+, we always aggregate all pages
   * across totalFound before returning, avoiding unsafe page-1 ETag short-circuiting.
   */
  public async fetchJobs(boardSlug: string, options: AtsFetchOptions = {}): Promise<AtsAdapterResponse> {
    const fetchFn = options.customFetch || fetch;
    const PAGE_LIMIT = 100;
    let offset = 0;
    let pagesFetched = 0;
    let responseEtag: string | null = null;
    let responseLastModified: string | null = null;
    const allNormalizedJobs: NormalizedAtsJob[] = [];

    try {
      while (true) {
        const url = `https://api.smartrecruiters.com/v1/companies/${boardSlug}/postings?limit=${PAGE_LIMIT}&offset=${offset}`;
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
            error: `SmartRecruiters API returned HTTP ${res.status}: ${res.statusText}`,
          };
        }

        if (pagesFetched === 1) {
          responseEtag = res.headers.get('etag') || res.headers.get('ETag');
          responseLastModified = res.headers.get('last-modified') || res.headers.get('Last-Modified');
        }

        const data = await res.json();
        const content = Array.isArray(data?.content) ? data.content : [];
        const totalFound = typeof data?.totalFound === 'number' ? data.totalFound : content.length;

        if (content.length === 0) {
          break;
        }

        for (const raw of content) {
          const title = (raw.name || '').trim();
          const city = raw.location?.city || '';
          const region = raw.location?.region || '';
          const country = raw.location?.country || '';
          const isRemote = Boolean(raw.location?.remote);
          const locationStr = [city, region, country].filter(Boolean).join(', ') || (isRemote ? 'Remote' : '');
          const department = (raw.department?.label || raw.department?.name || '').trim();
          const empType = (raw.typeOfEmployment?.label || '').trim();
          const jobUrl = `https://jobs.smartrecruiters.com/${boardSlug}/${raw.id}`;
          const descriptionClean = `${title} at ${raw.company?.name || boardSlug}. Department: ${department}. Type: ${empType}.`;

          allNormalizedJobs.push({
            atsJobId: String(raw.id),
            title,
            location: locationStr || undefined,
            department: department || undefined,
            jobUrl,
            descriptionRaw: descriptionClean,
            descriptionClean,
            category: inferCategory(title),
            jobType: inferJobType(`${title} ${empType}`, descriptionClean),
            workModel: isRemote ? 'Remote' : inferWorkModel(locationStr, descriptionClean),
            skills: extractSkills(title),
            rawJson: raw,
          });
        }

        offset += content.length;
        if (offset >= totalFound || content.length === 0) {
          break; // Fully aggregated all pages
        }
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
        error: err?.message || 'Network error fetching SmartRecruiters jobs',
      };
    }
  }
}
