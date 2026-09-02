import { describe, it, expect, beforeEach } from 'vitest';
import { newDb, DataType } from 'pg-mem';
import crypto from 'crypto';
import {
  AtsUrlParser,
  CompanyRegistryService,
  INITIAL_TIER1_COMPANIES,
} from '../services/registry-auto-derivation.js';

describe('Company Registry Auto-Derivation — Checkpoint 3 Test Suite', () => {
  // ── 1. AtsUrlParser Pure Regex Unit Tests ─────────────────────────────────
  describe('AtsUrlParser', () => {
    it('accurately parses Greenhouse URLs in all standard formats', () => {
      const u1 = AtsUrlParser.parse('https://boards.greenhouse.io/stripe/jobs/4123456');
      expect(u1).toEqual({
        atsType: 'greenhouse',
        boardSlug: 'stripe',
        originalUrl: 'https://boards.greenhouse.io/stripe/jobs/4123456',
        suggestedName: 'Stripe',
      });

      const u2 = AtsUrlParser.parse('https://job-boards.greenhouse.io/datadog/jobs/7890?gh_jid=7890');
      expect(u2?.atsType).toBe('greenhouse');
      expect(u2?.boardSlug).toBe('datadog');

      const u3 = AtsUrlParser.parse('https://airbnb.greenhouse.io/jobs/111');
      expect(u3?.atsType).toBe('greenhouse');
      expect(u3?.boardSlug).toBe('airbnb');
    });

    it('accurately parses Lever URLs', () => {
      const u1 = AtsUrlParser.parse('https://jobs.lever.co/figma/abc-123-def');
      expect(u1).toEqual({
        atsType: 'lever',
        boardSlug: 'figma',
        originalUrl: 'https://jobs.lever.co/figma/abc-123-def',
        suggestedName: 'Figma',
      });

      const u2 = AtsUrlParser.parse('https://api.lever.co/v0/postings/netflix?mode=json');
      expect(u2?.atsType).toBe('lever');
      expect(u2?.boardSlug).toBe('netflix');
    });

    it('accurately parses Ashby URLs', () => {
      const u1 = AtsUrlParser.parse('https://jobs.ashbyhq.com/openai/1a2b3c-4d5e');
      expect(u1).toEqual({
        atsType: 'ashby',
        boardSlug: 'openai',
        originalUrl: 'https://jobs.ashbyhq.com/openai/1a2b3c-4d5e',
        suggestedName: 'Openai',
      });

      const u2 = AtsUrlParser.parse('https://api.ashbyhq.com/posting-api/job-board/vercel');
      expect(u2?.atsType).toBe('ashby');
      expect(u2?.boardSlug).toBe('vercel');
    });

    it('accurately parses SmartRecruiters URLs', () => {
      const u1 = AtsUrlParser.parse('https://jobs.smartrecruiters.com/Spotify/7439999-data-engineer');
      expect(u1).toEqual({
        atsType: 'smartrecruiters',
        boardSlug: 'spotify',
        originalUrl: 'https://jobs.smartrecruiters.com/Spotify/7439999-data-engineer',
        suggestedName: 'Spotify',
      });

      const u2 = AtsUrlParser.parse('https://api.smartrecruiters.com/v1/companies/visa/postings');
      expect(u2?.atsType).toBe('smartrecruiters');
      expect(u2?.boardSlug).toBe('visa');
    });

    it('returns null for non-ATS career portal URLs', () => {
      expect(AtsUrlParser.parse('https://careers.google.com/jobs/results/123')).toBeNull();
      expect(AtsUrlParser.parse('https://www.linkedin.com/jobs/view/9999999')).toBeNull();
      expect(AtsUrlParser.parse('https://indeed.com/viewjob?jk=abcdef')).toBeNull();
      expect(AtsUrlParser.parse('')).toBeNull();
    });
  });

  // ── 2. Database Auto-Derivation & Deduplication Tests ─────────────────────
  describe('CompanyRegistryService with PostgreSQL', () => {
    let memDb: any;
    let pool: any;
    let registryService: CompanyRegistryService;

    beforeEach(async () => {
      memDb = newDb();
      memDb.public.registerFunction({
        name: 'gen_random_uuid',
        returns: DataType.uuid,
        deterministic: false,
        implementation: () => crypto.randomUUID(),
      });

      const schemaSql = `
        CREATE TABLE companies (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(255) NOT NULL,
          ats_type VARCHAR(50) NOT NULL,
          board_slug VARCHAR(255) NOT NULL,
          tier VARCHAR(20) NOT NULL DEFAULT 'tier2',
          poll_interval_sec INTEGER NOT NULL DEFAULT 120,
          burst_mode_until TIMESTAMPTZ,
          last_polled_at TIMESTAMPTZ,
          next_poll_at TIMESTAMPTZ NOT NULL,
          last_status_code INTEGER,
          etag VARCHAR(255),
          last_modified_header VARCHAR(255),
          consecutive_unchanged_count INTEGER NOT NULL DEFAULT 0,
          historical_posting_velocity FLOAT NOT NULL DEFAULT 0.0,
          created_at TIMESTAMPTZ NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL,
          CONSTRAINT uq_company_ats_board UNIQUE (ats_type, board_slug)
        );
      `;

      const pgAdapter = memDb.adapters.createPg();
      pool = new pgAdapter.Pool();
      await pool.query(schemaSql);
      registryService = new CompanyRegistryService();
    });

    it('registers a company from a raw job URL and avoids duplicates on duplicate calls', async () => {
      const url1 = 'https://boards.greenhouse.io/stripe/jobs/11111';
      const r1 = await registryService.deriveAndRegister(pool, url1, 'Stripe', 'tier1');

      expect(r1).not.toBeNull();
      expect(r1?.isNewCompany).toBe(true);
      expect(r1?.company.name).toBe('Stripe');
      expect(r1?.company.ats_type).toBe('greenhouse');
      expect(r1?.company.board_slug).toBe('stripe');
      expect(r1?.company.tier).toBe('tier1');

      // Attempt to register another job under the same Stripe Greenhouse board
      const url2 = 'https://boards.greenhouse.io/stripe/jobs/22222';
      const r2 = await registryService.deriveAndRegister(pool, url2, 'Stripe Inc');

      expect(r2).not.toBeNull();
      expect(r2?.isNewCompany).toBe(false); // Identified existing company

      // Assert exactly 1 company row exists in the database
      const rows = (await pool.query('SELECT * FROM companies')).rows;
      expect(rows).toHaveLength(1);
      expect(rows[0].board_slug).toBe('stripe');
    });

    it('registers companies across all 4 supported ATS types', async () => {
      const urls = [
        { url: 'https://boards.greenhouse.io/ramp/jobs/1', company: 'Ramp' },
        { url: 'https://jobs.lever.co/figma/2', company: 'Figma' },
        { url: 'https://jobs.ashbyhq.com/openai/3', company: 'OpenAI' },
        { url: 'https://jobs.smartrecruiters.com/spotify/4', company: 'Spotify' },
      ];

      for (const item of urls) {
        const res = await registryService.deriveAndRegister(pool, item.url, item.company);
        expect(res).not.toBeNull();
        expect(res?.isNewCompany).toBe(true);
      }

      const rows = (await pool.query('SELECT * FROM companies ORDER BY name ASC')).rows;
      expect(rows).toHaveLength(4);
      expect(rows.map((r: any) => r.ats_type).sort()).toEqual(['ashby', 'greenhouse', 'lever', 'smartrecruiters']);
    });

    it('seeds the initial tier-1 company list without duplicating rows', async () => {
      const inserted = await registryService.seedTier1Companies(pool);
      expect(inserted).toBe(INITIAL_TIER1_COMPANIES.length);

      // Re-seeding produces 0 new companies due to UNIQUE(ats_type, board_slug)
      const reseedCount = await registryService.seedTier1Companies(pool);
      expect(reseedCount).toBe(0);

      const totalRows = (await pool.query('SELECT count(*) FROM companies')).rows[0].count;
      expect(Number(totalRows)).toBe(INITIAL_TIER1_COMPANIES.length);
    });

    it('batch ingests scraped job postings and ignores unsupported links', async () => {
      const scrapedFeed = [
        { url: 'https://boards.greenhouse.io/datadog/jobs/1', company: 'Datadog' },
        { url: 'https://boards.greenhouse.io/datadog/jobs/2', company: 'Datadog' }, // duplicate board
        { url: 'https://jobs.ashbyhq.com/linear/jobs/3', company: 'Linear' },
        { url: 'https://careers.google.com/jobs/results/999', company: 'Google' }, // non-ATS link
      ];

      const result = await registryService.ingestScrapedJobUrls(pool, scrapedFeed);
      expect(result.processed).toBe(4);
      expect(result.registeredNew).toBe(2); // Datadog and Linear

      const countRes = await pool.query('SELECT count(*) FROM companies');
      expect(Number(countRes.rows[0].count)).toBe(2);
    });
  });
});
