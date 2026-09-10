import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  DirectJobIngesterService,
  computeContentHash,
  sanitizeHtml,
  extractTechnicalSkills,
  VERIFIED_TECH_SEED_JOBS,
  VERIFIED_TECH_COMPANIES,
} from '../services/direct-job-ingester.js';
import { JobPosting } from '../types/index.js';

describe('Big Tech Direct Ingestion, Delta Sync & Supabase Persistence Architecture', () => {
  const rootDir = path.resolve(__dirname, '../../../');
  const webDir = path.resolve(rootDir, 'web');
  const migrationPath = path.resolve(
    rootDir,
    'supabase/migrations/20260909010000_verified_job_openings_schema.sql'
  );

  // ── 1. Content Hashing & Sanitization Utilities ──────────────────────────
  describe('1. Content Hashing & Sanitization Utilities', () => {
    it('computes deterministic content hashes for identical input', () => {
      const textA = 'Senior Distributed Systems Engineer at Stripe with Go & Kubernetes';
      const textB = 'Senior Distributed Systems Engineer at Stripe with Go & Kubernetes';
      const textC = 'Senior Distributed Systems Engineer at Stripe with Go & Kubernetes and Kafka';

      const hashA = computeContentHash(textA);
      const hashB = computeContentHash(textB);
      const hashC = computeContentHash(textC);

      expect(hashA).toBe(hashB);
      expect(hashA).not.toBe(hashC);
      expect(hashA.startsWith('h_')).toBe(true);
    });

    it('sanitizes messy HTML entity text from ATS feeds into clean JD text', () => {
      const rawHtml = '<p>We are looking for engineers &amp; leaders.</p><br/><ul><li>TypeScript &amp; Go</li><li>Docker &gt; Podman</li></ul>';
      const clean = sanitizeHtml(rawHtml);

      expect(clean).toContain('We are looking for engineers & leaders.');
      expect(clean).toContain('TypeScript & Go');
      expect(clean).toContain('Docker > Podman');
      expect(clean).not.toContain('<p>');
      expect(clean).not.toContain('<li>');
      expect(clean).not.toContain('&amp;');
    });

    it('extracts technical skills from job title and description text', () => {
      const text = 'Build high-performance microservices in Rust, TypeScript, and Go on AWS with PostgreSQL and Docker';
      const skills = extractTechnicalSkills(text);

      expect(skills).toContain('Rust');
      expect(skills).toContain('TypeScript');
      expect(skills).toContain('Go');
      expect(skills).toContain('AWS');
      expect(skills).toContain('PostgreSQL');
      expect(skills).toContain('Docker');
    });
  });

  // ── 2. Direct ATS Adapters (Greenhouse, Lever, Ashby) ──────────────────────
  describe('2. Direct ATS Ingestion Adapters', () => {
    it('Greenhouse: successfully normalizes Greenhouse board responses with isVerified: true', async () => {
      const mockGhResponse = {
        jobs: [
          {
            id: 991234,
            title: 'Infrastructure Engineer, Storage',
            updated_at: '2026-09-01T12:00:00Z',
            absolute_url: 'https://boards.greenhouse.io/stripe/jobs/991234',
            location: { name: 'San Francisco, CA / Remote' },
            departments: [{ name: 'Core Infrastructure' }],
            content: '<p>Build storage systems in <strong>Go</strong> and <strong>PostgreSQL</strong>.</p>',
          },
        ],
      };

      const customFetch = async () =>
        new Response(JSON.stringify(mockGhResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });

      const ingester = new DirectJobIngesterService(customFetch as any);
      const stripeTarget = VERIFIED_TECH_COMPANIES.find(c => c.id === 'stripe')!;
      const jobs = await ingester.fetchGreenhouseJobs(stripeTarget);

      expect(jobs).toHaveLength(1);
      const job = jobs[0];
      expect(job.id).toBe('gh-stripe-991234');
      expect(job.company).toBe('Stripe');
      expect(job.title).toBe('Infrastructure Engineer, Storage');
      expect(job.isVerified).toBe(true);
      expect(job.status).toBe('active');
      expect(job.source).toBe('Direct ATS');
      expect(job.workModel).toBe('Remote');
      expect(job.skills).toContain('Go');
      expect(job.skills).toContain('PostgreSQL');
      expect(job.contentHash).toBeDefined();
    });

    it('Lever: successfully normalizes Lever postings with isVerified: true', async () => {
      const mockLeverResponse = [
        {
          id: 'netflix-101',
          text: 'Senior Streaming Platform Engineer',
          createdAt: 1725192000000,
          hostedUrl: 'https://jobs.lever.co/netflix/netflix-101',
          categories: {
            commitment: 'Full time',
            department: 'Streaming Architecture',
            location: 'Remote, US',
          },
          descriptionPlain: 'Engineer global edge content delivery in Java, AWS, and Kafka.',
          additionalPlain: 'Requirements: 5+ years experience in distributed systems.',
        },
      ];

      const customFetch = async () =>
        new Response(JSON.stringify(mockLeverResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });

      const ingester = new DirectJobIngesterService(customFetch as any);
      const netflixTarget = VERIFIED_TECH_COMPANIES.find(c => c.id === 'netflix')!;
      const jobs = await ingester.fetchLeverJobs(netflixTarget);

      expect(jobs).toHaveLength(1);
      const job = jobs[0];
      expect(job.id).toBe('lever-netflix-netflix-101');
      expect(job.company).toBe('Netflix');
      expect(job.title).toBe('Senior Streaming Platform Engineer');
      expect(job.isVerified).toBe(true);
      expect(job.status).toBe('active');
      expect(job.workModel).toBe('Remote');
      expect(job.skills).toContain('Java');
      expect(job.skills).toContain('AWS');
      expect(job.skills).toContain('Kafka');
    });

    it('Ashby: successfully normalizes Ashby job boards with isVerified: true', async () => {
      const mockAshbyResponse = {
        jobs: [
          {
            id: 'openai-88',
            title: 'Member of Technical Staff, Applied AI',
            department: 'Applied AI',
            locationName: 'San Francisco, CA',
            jobUrl: 'https://jobs.ashbyhq.com/openai/openai-88',
            descriptionPlain: 'Build frontier reasoning interfaces with TypeScript, Next.js, and Python.',
            publishedAt: '2026-09-02T10:00:00.000Z',
          },
        ],
      };

      const customFetch = async () =>
        new Response(JSON.stringify(mockAshbyResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });

      const ingester = new DirectJobIngesterService(customFetch as any);
      const openaiTarget = VERIFIED_TECH_COMPANIES.find(c => c.id === 'openai')!;
      const jobs = await ingester.fetchAshbyJobs(openaiTarget);

      expect(jobs).toHaveLength(1);
      const job = jobs[0];
      expect(job.id).toBe('ashby-openai-openai-88');
      expect(job.company).toBe('OpenAI');
      expect(job.isVerified).toBe(true);
      expect(job.status).toBe('active');
      expect(job.skills).toContain('TypeScript');
      expect(job.skills).toContain('Next.js');
      expect(job.skills).toContain('Python');
    });
  });

  // ── 3. Delta Sync & Change Detection Engine ────────────────────────────────
  describe('3. Delta Sync & Change Detection Engine', () => {
    const ingester = new DirectJobIngesterService();

    it('detects newly added job openings for a company', () => {
      const previousJobs: JobPosting[] = [
        {
          id: 'gh-stripe-100',
          company: 'Stripe',
          title: 'Backend Engineer',
          location: 'San Francisco, CA',
          type: 'Full-time',
          url: 'https://stripe.com/jobs/100',
          source: 'Direct ATS',
          description: 'Payment infra',
          isVerified: true,
          status: 'active',
          contentHash: computeContentHash('Backend Engineer|Payment infra|San Francisco, CA'),
        },
      ];

      const freshJobs: JobPosting[] = [
        previousJobs[0],
        {
          id: 'gh-stripe-101',
          company: 'Stripe',
          title: 'New Distributed Systems Engineer',
          location: 'Remote',
          type: 'Full-time',
          url: 'https://stripe.com/jobs/101',
          source: 'Direct ATS',
          description: 'Consensus engine',
          isVerified: true,
          status: 'active',
          contentHash: computeContentHash('New Distributed Systems Engineer|Consensus engine|Remote'),
        },
      ];

      const delta = ingester.computeDelta(previousJobs, freshJobs, ['Stripe']);

      expect(delta.newJobs).toHaveLength(1);
      expect(delta.newJobs[0].id).toBe('gh-stripe-101');
      expect(delta.updatedJobs).toHaveLength(0);
      expect(delta.closedJobs).toHaveLength(0);
      expect(delta.activeJobs).toHaveLength(2);
    });

    it('detects when an existing job has been updated (content hash modified)', () => {
      const originalHash = computeContentHash('Old title|Old description|SF');
      const previousJobs: JobPosting[] = [
        {
          id: 'gh-stripe-100',
          company: 'Stripe',
          title: 'Old title',
          location: 'SF',
          type: 'Full-time',
          url: 'https://stripe.com/jobs/100',
          source: 'Direct ATS',
          description: 'Old description',
          isVerified: true,
          status: 'active',
          contentHash: originalHash,
        },
      ];

      const freshJobs: JobPosting[] = [
        {
          id: 'gh-stripe-100',
          company: 'Stripe',
          title: 'Updated Senior Title',
          location: 'San Francisco, CA / Remote',
          type: 'Full-time',
          url: 'https://stripe.com/jobs/100',
          source: 'Direct ATS',
          description: 'Brand new updated description with AI requirements',
          isVerified: true,
          status: 'active',
          contentHash: computeContentHash('Updated Senior Title|Brand new updated description with AI requirements|San Francisco, CA / Remote'),
        },
      ];

      const delta = ingester.computeDelta(previousJobs, freshJobs, ['Stripe']);

      expect(delta.newJobs).toHaveLength(0);
      expect(delta.updatedJobs).toHaveLength(1);
      expect(delta.updatedJobs[0].id).toBe('gh-stripe-100');
      expect(delta.updatedJobs[0].title).toBe('Updated Senior Title');
      expect(delta.closedJobs).toHaveLength(0);
    });

    it('detects when a previously active job has been closed/removed from company board', () => {
      const previousJobs: JobPosting[] = [
        {
          id: 'gh-stripe-100',
          company: 'Stripe',
          title: 'Active Job Still Open',
          location: 'SF',
          type: 'Full-time',
          url: 'https://stripe.com/jobs/100',
          source: 'Direct ATS',
          description: 'Still active',
          isVerified: true,
          status: 'active',
          contentHash: computeContentHash('Active Job Still Open|Still active|SF'),
        },
        {
          id: 'gh-stripe-101',
          company: 'Stripe',
          title: 'Role Filled / Closed Role',
          location: 'SF',
          type: 'Full-time',
          url: 'https://stripe.com/jobs/101',
          source: 'Direct ATS',
          description: 'This role is no longer on Greenhouse',
          isVerified: true,
          status: 'active',
          contentHash: computeContentHash('Role Filled|...|SF'),
        },
      ];

      // In fresh fetch, 101 is gone
      const freshJobs: JobPosting[] = [previousJobs[0]];

      const delta = ingester.computeDelta(previousJobs, freshJobs, ['Stripe']);

      expect(delta.closedJobs).toHaveLength(1);
      expect(delta.closedJobs[0].id).toBe('gh-stripe-101');
      expect(delta.closedJobs[0].status).toBe('closed');
      expect(delta.closedJobs[0].closedAt).toBeDefined();
      expect(delta.activeJobs).toHaveLength(1);
      expect(delta.activeJobs[0].id).toBe('gh-stripe-100');
    });

    it('preserves non-synced jobs from GitHub scrapers and other companies during delta sync', () => {
      const previousJobs: JobPosting[] = [
        {
          id: 'seed-simplify-1',
          company: 'Google',
          title: 'STEP Intern 2027',
          location: 'Mountain View, CA',
          type: 'Internship',
          url: 'https://careers.google.com/jobs',
          source: 'SimplifyJobs',
          description: 'GitHub scraped job',
          status: 'active',
        },
        {
          id: 'gh-stripe-100',
          company: 'Stripe',
          title: 'Stripe Role',
          location: 'SF',
          type: 'Full-time',
          url: 'https://stripe.com/jobs/100',
          source: 'Direct ATS',
          description: 'Stripe',
          isVerified: true,
          status: 'active',
          contentHash: 'hash-stripe',
        },
      ];

      // Fresh sync for Stripe only
      const freshStripeJobs: JobPosting[] = [previousJobs[1]];

      const delta = ingester.computeDelta(previousJobs, freshStripeJobs, ['Stripe']);

      // Google role from GitHub should remain preserved in allJobs
      expect(delta.allJobs.some(j => j.id === 'seed-simplify-1')).toBe(true);
      expect(delta.allJobs.some(j => j.id === 'gh-stripe-100')).toBe(true);
    });
  });

  // ── 4. Supabase Database Schema & Migration Verification ──────────────────
  describe('4. Supabase Cloud Storage Schema & Functions', () => {
    it('migration file defines public.job_postings with all required fields & RLS policies', () => {
      expect(fs.existsSync(migrationPath)).toBe(true);
      const sql = fs.readFileSync(migrationPath, 'utf8').toLowerCase();

      expect(sql).toContain('create table if not exists public.job_postings');
      expect(sql).toContain('id text primary key');
      expect(sql).toContain('company text not null');
      expect(sql).toContain('title text not null');
      expect(sql).toContain('is_verified boolean default true');
      expect(sql).toContain('status text default \'active\'');
      expect(sql).toContain('content_hash text');
      expect(sql).toContain('extracted_skills text[]');
      expect(sql).toContain('alter table public.job_postings enable row level security;');
      expect(sql).toContain('create policy "public can view active job postings"');
      expect(sql).toContain('create trigger handle_job_postings_updated_at');
    });

    it('supabase-db.ts implements fetchVerifiedJobPostings, upsertJobPostings, and syncDeltaToSupabase', () => {
      const dbServicePath = path.resolve(webDir, 'src/services/supabase-db.ts');
      expect(fs.existsSync(dbServicePath)).toBe(true);
      const content = fs.readFileSync(dbServicePath, 'utf8');

      expect(content).toContain('export async function fetchVerifiedJobPostings');
      expect(content).toContain('export async function upsertJobPostings');
      expect(content).toContain('export async function syncDeltaToSupabase');
      expect(content).toContain('.from(\'job_postings\')');
    });
  });

  // ── 5. Discovery Tab UI & Strict "Verified" Badge Verification ────────────
  describe('5. Discovery Tab Verified Badge & Filtering UI', () => {
    const discoveryTabPath = path.resolve(webDir, 'src/components/DiscoveryTab.tsx');

    it('DiscoveryTab renders strictly the word "Verified" badge for verified openings', () => {
      expect(fs.existsSync(discoveryTabPath)).toBe(true);
      const content = fs.readFileSync(discoveryTabPath, 'utf8');

      // Check for isVerified badge rendering with strict word "Verified"
      expect(content).toContain('job.isVerified &&');
      expect(content).toContain('Verified');
      expect(content).toContain('bg-emerald-500/10 text-emerald-700');

      // Check category filter includes 'Verified'
      expect(content).toContain('\'Verified\'');
      expect(content).toContain('selectedCategory === \'Verified\'');
      expect(content).toContain('Boolean(job.isVerified)');
    });

    it('App.tsx initializes with verified seed tech jobs and performs integrated delta sync', () => {
      const appPath = path.resolve(webDir, 'src/App.tsx');
      expect(fs.existsSync(appPath)).toBe(true);
      const content = fs.readFileSync(appPath, 'utf8');

      expect(content).toContain('VERIFIED_TECH_SEED_JOBS');
      expect(content).toContain('directJobIngester.syncAllTechCompanies');
      expect(content).toContain('syncDeltaToSupabase');
      expect(content).toContain('fetchVerifiedJobPostings');
    });
  });

  // ── 6. Design System & Strict Zero Color Bleed Audit ───────────────────────
  describe('6. Design System & Strict Zero Color Bleed Audit', () => {
    const filesToAudit = [
      path.resolve(webDir, 'src/services/direct-job-ingester.ts'),
      path.resolve(webDir, 'src/services/supabase-db.ts'),
      path.resolve(webDir, 'src/components/DiscoveryTab.tsx'),
      path.resolve(webDir, 'src/App.tsx'),
    ];

    it('strictly forbids purple, violet, indigo, and blue classes in all verified tech components', () => {
      const forbiddenColors = [
        'bg-purple-', 'text-purple-', 'border-purple-',
        'bg-violet-', 'text-violet-', 'border-violet-',
        'bg-indigo-', 'text-indigo-', 'border-indigo-',
        'bg-blue-', 'text-blue-', 'border-blue-',
      ];

      for (const file of filesToAudit) {
        if (fs.existsSync(file)) {
          const content = fs.readFileSync(file, 'utf8');
          for (const pattern of forbiddenColors) {
            const matches = content.includes(pattern);
            expect(matches, `Found forbidden pattern "${pattern}" in ${path.basename(file)}`).toBe(false);
          }
        }
      }
    });
  });
});
