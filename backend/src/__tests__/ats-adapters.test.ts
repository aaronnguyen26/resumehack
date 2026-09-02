import { describe, it, expect } from 'vitest';
import {
  GreenhouseAdapter,
  LeverAdapter,
  AshbyAdapter,
  SmartRecruitersAdapter,
  getAtsAdapter,
} from '../services/ats-adapters/index.js';

describe('ATS Adapters — Checkpoint 2 Test Suite', () => {
  // ── 1. Greenhouse Adapter ─────────────────────────────────────────────────
  describe('GreenhouseAdapter', () => {
    const adapter = new GreenhouseAdapter();

    it('fetches and normalizes Greenhouse job listings cleanly', async () => {
      const mockResponse = {
        jobs: [
          {
            id: 4123456,
            title: 'Software Engineering Intern — Summer 2026',
            updated_at: '2026-09-01T14:00:00Z',
            absolute_url: 'https://boards.greenhouse.io/stripe/jobs/4123456',
            location: { name: 'San Francisco, CA' },
            departments: [{ name: 'Core Infrastructure' }],
            content: '&lt;p&gt;We are looking for engineers experienced in &lt;strong&gt;TypeScript&lt;/strong&gt; and &lt;strong&gt;Go&lt;/strong&gt; with Docker &amp;amp; Kubernetes.&lt;/p&gt;',
          },
        ],
      };

      const customFetch = async () => {
        return new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'ETag': '"gh-etag-12345"',
            'Last-Modified': 'Tue, 01 Sep 2026 14:00:00 GMT',
          },
        });
      };

      const result = await adapter.fetchJobs('stripe', { customFetch: customFetch as any });

      expect(result.status).toBe('ok');
      expect(result.statusCode).toBe(200);
      expect(result.etag).toBe('"gh-etag-12345"');
      expect(result.pagesFetched).toBe(1);
      expect(result.jobs).toHaveLength(1);

      const job = result.jobs[0];
      expect(job.atsJobId).toBe('4123456');
      expect(job.title).toBe('Software Engineering Intern — Summer 2026');
      expect(job.location).toBe('San Francisco, CA');
      expect(job.department).toBe('Core Infrastructure');
      expect(job.jobType).toBe('Internship');
      expect(job.workModel).toBe('Hybrid');
      expect(job.category).toBe('Software Engineering');
      expect(job.descriptionClean).toContain('TypeScript and Go with Docker & Kubernetes');
      expect(job.skills).toContain('TypeScript');
      expect(job.skills).toContain('Go');
    });

    it('short-circuits with 304 Not Modified when ETag matches', async () => {
      let sentIfNoneMatch: string | null = null;
      const customFetch = async (_url: string, init: any) => {
        sentIfNoneMatch = init.headers['If-None-Match'];
        return new Response(null, { status: 304 });
      };

      const result = await adapter.fetchJobs('stripe', {
        etag: '"gh-etag-12345"',
        customFetch: customFetch as any,
      });

      expect(sentIfNoneMatch).toBe('"gh-etag-12345"');
      expect(result.status).toBe('not_modified');
      expect(result.statusCode).toBe(304);
      expect(result.jobs).toHaveLength(0);
      expect(result.etag).toBe('"gh-etag-12345"');
    });
  });

  // ── 2. Lever Adapter ──────────────────────────────────────────────────────
  describe('LeverAdapter', () => {
    const adapter = new LeverAdapter();

    it('fetches and normalizes Lever job listings', async () => {
      const mockList = [
        {
          id: 'lever-post-987',
          text: 'Product Designer (New Grad)',
          hostedUrl: 'https://jobs.lever.co/figma/lever-post-987',
          categories: {
            commitment: 'Full-time',
            department: 'Design Studio',
            location: 'New York, NY',
            team: 'Core Canvas',
          },
          description: '<p>Design tools used by millions in Figma.</p>',
          descriptionPlain: 'Design tools used by millions in Figma.',
        },
      ];

      const customFetch = async () => {
        return new Response(JSON.stringify(mockList), {
          status: 200,
          headers: { 'ETag': '"lever-etag-555"' },
        });
      };

      const result = await adapter.fetchJobs('figma', { customFetch: customFetch as any });

      expect(result.status).toBe('ok');
      expect(result.jobs).toHaveLength(1);
      const job = result.jobs[0];
      expect(job.atsJobId).toBe('lever-post-987');
      expect(job.title).toBe('Product Designer (New Grad)');
      expect(job.category).toBe('Design & Creative');
      expect(job.jobType).toBe('New Grad');
      expect(job.department).toBe('Design Studio');
    });

    it('aggregates multi-page Lever responses into a single complete array', async () => {
      // Generate 100 items on page 1, 25 items on page 2
      const page1 = Array.from({ length: 100 }, (_, i) => ({
        id: `lever-p1-${i}`,
        text: `Engineer ${i}`,
        categories: { location: 'San Francisco, CA' },
      }));
      const page2 = Array.from({ length: 25 }, (_, i) => ({
        id: `lever-p2-${i}`,
        text: `Engineer Page 2 - ${i}`,
        categories: { location: 'Remote' },
      }));

      const customFetch = async (url: string) => {
        if (url.includes('skip=0')) {
          return new Response(JSON.stringify(page1), { status: 200 });
        }
        if (url.includes('skip=100')) {
          return new Response(JSON.stringify(page2), { status: 200 });
        }
        return new Response(JSON.stringify([]), { status: 200 });
      };

      const result = await adapter.fetchJobs('figma', { customFetch: customFetch as any });

      expect(result.status).toBe('ok');
      expect(result.pagesFetched).toBe(2);
      expect(result.jobs).toHaveLength(125);
      expect(result.jobs[0].atsJobId).toBe('lever-p1-0');
      expect(result.jobs[124].atsJobId).toBe('lever-p2-24');
    });
  });

  // ── 3. Ashby Adapter ──────────────────────────────────────────────────────
  describe('AshbyAdapter', () => {
    const adapter = new AshbyAdapter();

    it('fetches and normalizes Ashby job listings with remote work model detection', async () => {
      const mockResponse = {
        apiVersion: '1.0',
        jobs: [
          {
            id: 'ashby-111-222',
            title: 'AI Research Scientist',
            departmentName: 'Frontier Alignment',
            locationName: 'San Francisco, CA',
            isRemote: true,
            employmentType: 'FullTime',
            publishedAt: '2026-09-01T15:00:00Z',
            jobUrl: 'https://jobs.ashbyhq.com/openai/ashby-111-222',
            descriptionPlain: 'Train scalable LLM systems using PyTorch and Python.',
          },
        ],
      };

      const customFetch = async () => {
        return new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { 'ETag': '"ashby-tag-777"' },
        });
      };

      const result = await adapter.fetchJobs('openai', { customFetch: customFetch as any });

      expect(result.status).toBe('ok');
      expect(result.jobs).toHaveLength(1);
      const job = result.jobs[0];
      expect(job.atsJobId).toBe('ashby-111-222');
      expect(job.title).toBe('AI Research Scientist');
      expect(job.category).toBe('Data & AI');
      expect(job.workModel).toBe('Remote'); // isRemote = true
      expect(job.skills).toContain('Python');
      expect(job.skills).toContain('PyTorch');
    });

    it('short-circuits on 304 Not Modified for Ashby', async () => {
      const customFetch = async () => new Response(null, { status: 304 });
      const result = await adapter.fetchJobs('openai', {
        etag: '"ashby-tag-777"',
        customFetch: customFetch as any,
      });

      expect(result.status).toBe('not_modified');
      expect(result.jobs).toHaveLength(0);
    });
  });

  // ── 4. SmartRecruiters Adapter ────────────────────────────────────────────
  describe('SmartRecruitersAdapter', () => {
    const adapter = new SmartRecruitersAdapter();

    it('fetches and normalizes SmartRecruiters listings', async () => {
      const mockResponse = {
        totalFound: 1,
        offset: 0,
        limit: 100,
        content: [
          {
            id: 'sr-999-aaa',
            name: 'Data Engineering Intern',
            location: { city: 'Boston', region: 'MA', country: 'US', remote: false },
            department: { label: 'Data Science' },
            typeOfEmployment: { label: 'Internship' },
            company: { name: 'Spotify' },
          },
        ],
      };

      const customFetch = async () => {
        return new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { 'ETag': '"sr-etag-999"' },
        });
      };

      const result = await adapter.fetchJobs('spotify', { customFetch: customFetch as any });

      expect(result.status).toBe('ok');
      expect(result.jobs).toHaveLength(1);
      const job = result.jobs[0];
      expect(job.atsJobId).toBe('sr-999-aaa');
      expect(job.title).toBe('Data Engineering Intern');
      expect(job.location).toBe('Boston, MA, US');
      expect(job.department).toBe('Data Science');
      expect(job.jobType).toBe('Internship');
    });

    it('aggregates multi-page SmartRecruiters offset pagination before diffing', async () => {
      // 100 items on page 1, 50 items on page 2 (totalFound: 150)
      const page1Content = Array.from({ length: 100 }, (_, i) => ({
        id: `sr-p1-${i}`,
        name: `Role Page 1 - ${i}`,
      }));
      const page2Content = Array.from({ length: 50 }, (_, i) => ({
        id: `sr-p2-${i}`,
        name: `Role Page 2 - ${i}`,
      }));

      const customFetch = async (url: string) => {
        if (url.includes('offset=0')) {
          return new Response(JSON.stringify({ totalFound: 150, offset: 0, limit: 100, content: page1Content }), { status: 200 });
        }
        if (url.includes('offset=100')) {
          return new Response(JSON.stringify({ totalFound: 150, offset: 100, limit: 100, content: page2Content }), { status: 200 });
        }
        return new Response(JSON.stringify({ totalFound: 150, offset: 150, limit: 100, content: [] }), { status: 200 });
      };

      const result = await adapter.fetchJobs('spotify', { customFetch: customFetch as any });

      expect(result.status).toBe('ok');
      expect(result.pagesFetched).toBe(2);
      expect(result.jobs).toHaveLength(150);
      expect(result.jobs[0].atsJobId).toBe('sr-p1-0');
      expect(result.jobs[149].atsJobId).toBe('sr-p2-49');
    });

    it('surfaces a new job on Page 2 even when Page 1 items remain unchanged', async () => {
      // Page 1 is stable, Page 2 has a newly added job
      const page1Content = [
        { id: 'sr-stable-1', name: 'Frontend Engineer' },
        { id: 'sr-stable-2', name: 'Backend Engineer' },
      ];
      const page2Content = [
        { id: 'sr-new-page2-job', name: 'AI Engineer (Added on Page 2)' },
      ];

      const customFetch = async (url: string) => {
        if (url.includes('offset=0')) {
          return new Response(JSON.stringify({ totalFound: 3, offset: 0, limit: 2, content: page1Content }), { status: 200 });
        }
        if (url.includes('offset=2')) {
          return new Response(JSON.stringify({ totalFound: 3, offset: 2, limit: 2, content: page2Content }), { status: 200 });
        }
        return new Response(JSON.stringify({ totalFound: 3, offset: 3, limit: 2, content: [] }), { status: 200 });
      };

      const result = await adapter.fetchJobs('spotify', {
        etag: '"previous-page1-etag"',
        customFetch: customFetch as any,
      });

      expect(result.status).toBe('ok');
      expect(result.pagesFetched).toBe(2);
      expect(result.jobs).toHaveLength(3);
      expect(result.jobs.some(j => j.atsJobId === 'sr-new-page2-job')).toBe(true);
    });
  });

  // ── 5. Factory Verification ───────────────────────────────────────────────
  describe('getAtsAdapter factory', () => {
    it('returns the corresponding adapter instance for each ATS type', () => {
      expect(getAtsAdapter('greenhouse')).toBeInstanceOf(GreenhouseAdapter);
      expect(getAtsAdapter('lever')).toBeInstanceOf(LeverAdapter);
      expect(getAtsAdapter('ashby')).toBeInstanceOf(AshbyAdapter);
      expect(getAtsAdapter('smartrecruiters')).toBeInstanceOf(SmartRecruitersAdapter);
    });
  });
});
