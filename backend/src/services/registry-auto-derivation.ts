import pg from 'pg';
import crypto from 'crypto';
import { AtsType, CompanyTier, CompanyRecord } from '../types/ats.js';

export interface ParsedAtsUrl {
  atsType: AtsType;
  boardSlug: string;
  originalUrl: string;
  suggestedName?: string;
}

export interface RegisterCompanyResult {
  company: CompanyRecord;
  isNewCompany: boolean;
}

export class AtsUrlParser {
  private static PATTERNS: Array<{ atsType: AtsType; regex: RegExp; nameExtractor?: (match: RegExpMatchArray) => string }> = [
    // 1. Greenhouse
    // - boards.greenhouse.io/{slug}
    // - job-boards.greenhouse.io/{slug}
    // - jobs.greenhouse.io/{slug}
    // - boards-api.greenhouse.io/v1/boards/{slug}
    // - {slug}.greenhouse.io
    {
      atsType: 'greenhouse',
      regex: /https?:\/\/(?:boards\.greenhouse\.io|job-boards\.greenhouse\.io|jobs\.greenhouse\.io|boards-api\.greenhouse\.io\/v1\/boards)\/([^/?#]+)/i,
      nameExtractor: (m) => m[1].replace(/[-_]/g, ' '),
    },
    {
      atsType: 'greenhouse',
      regex: /https?:\/\/([^.]+)\.greenhouse\.io(?:\/(?!embed)[^?#]*)?/i,
      nameExtractor: (m) => m[1].replace(/[-_]/g, ' '),
    },

    // 2. Lever
    // - jobs.lever.co/{slug}
    // - api.lever.co/v0/postings/{slug}
    {
      atsType: 'lever',
      regex: /https?:\/\/(?:jobs\.lever\.co|api\.lever\.co\/v0\/postings)\/([^/?#]+)/i,
      nameExtractor: (m) => m[1].replace(/[-_]/g, ' '),
    },

    // 3. Ashby
    // - jobs.ashbyhq.com/{slug}
    // - api.ashbyhq.com/posting-api/job-board/{slug}
    {
      atsType: 'ashby',
      regex: /https?:\/\/(?:jobs\.ashbyhq\.com|api\.ashbyhq\.com\/posting-api\/job-board)\/([^/?#]+)/i,
      nameExtractor: (m) => m[1].replace(/[-_]/g, ' '),
    },

    // 4. SmartRecruiters
    // - jobs.smartrecruiters.com/{slug}
    // - api.smartrecruiters.com/v1/companies/{slug}
    {
      atsType: 'smartrecruiters',
      regex: /https?:\/\/(?:jobs\.smartrecruiters\.com|api\.smartrecruiters\.com\/v1\/companies)\/([^/?#]+)/i,
      nameExtractor: (m) => m[1].replace(/[-_]/g, ' '),
    },
  ];

  public static parse(url: string): ParsedAtsUrl | null {
    if (!url || typeof url !== 'string') return null;
    const cleanUrl = url.trim();

    for (const { atsType, regex, nameExtractor } of this.PATTERNS) {
      const match = cleanUrl.match(regex);
      if (match && match[1]) {
        const boardSlug = match[1].toLowerCase().trim();
        // Ignore static system routes
        if (['embed', 'api', 'v0', 'v1', 'search', 'jobs'].includes(boardSlug)) {
          continue;
        }
        const suggestedName = nameExtractor ? nameExtractor(match) : boardSlug;
        return {
          atsType,
          boardSlug,
          originalUrl: cleanUrl,
          suggestedName: capitalizeWords(suggestedName),
        };
      }
    }

    return null;
  }
}

function capitalizeWords(str: string): string {
  return str
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// ── Verified Tier-1 Seed Registry ──────────────────────────────────────────
export const INITIAL_TIER1_COMPANIES: Array<{ name: string; atsType: AtsType; boardSlug: string; tier: CompanyTier }> = [
  // Greenhouse Tier-1
  { name: 'Stripe', atsType: 'greenhouse', boardSlug: 'stripe', tier: 'tier1' },
  { name: 'Airbnb', atsType: 'greenhouse', boardSlug: 'airbnb', tier: 'tier1' },
  { name: 'Coinbase', atsType: 'greenhouse', boardSlug: 'coinbase', tier: 'tier1' },
  { name: 'DoorDash', atsType: 'greenhouse', boardSlug: 'doordash', tier: 'tier1' },
  { name: 'Pinterest', atsType: 'greenhouse', boardSlug: 'pinterest', tier: 'tier1' },
  { name: 'Robinhood', atsType: 'greenhouse', boardSlug: 'robinhood', tier: 'tier1' },
  { name: 'Snap', atsType: 'greenhouse', boardSlug: 'snapchat', tier: 'tier1' },
  { name: 'Datadog', atsType: 'greenhouse', boardSlug: 'datadog', tier: 'tier1' },
  { name: 'Ramp', atsType: 'greenhouse', boardSlug: 'ramp', tier: 'tier1' },
  { name: 'Scale AI', atsType: 'greenhouse', boardSlug: 'scaleai', tier: 'tier1' },
  { name: 'Brex', atsType: 'greenhouse', boardSlug: 'brex', tier: 'tier1' },
  { name: 'Instacart', atsType: 'greenhouse', boardSlug: 'instacart', tier: 'tier1' },
  { name: 'Discord', atsType: 'greenhouse', boardSlug: 'discord', tier: 'tier1' },
  { name: 'Twitch', atsType: 'greenhouse', boardSlug: 'twitch', tier: 'tier1' },
  { name: 'Roblox', atsType: 'greenhouse', boardSlug: 'roblox', tier: 'tier1' },
  { name: 'Cloudflare', atsType: 'greenhouse', boardSlug: 'cloudflare', tier: 'tier1' },
  { name: 'Palantir', atsType: 'greenhouse', boardSlug: 'palantirtechnologies', tier: 'tier1' },

  // Lever Tier-1
  { name: 'Figma', atsType: 'lever', boardSlug: 'figma', tier: 'tier1' },
  { name: 'Netflix', atsType: 'lever', boardSlug: 'netflix', tier: 'tier1' },
  { name: 'Spotify', atsType: 'lever', boardSlug: 'spotify', tier: 'tier1' },
  { name: 'Affirm', atsType: 'lever', boardSlug: 'affirm', tier: 'tier1' },
  { name: 'Atlassian', atsType: 'lever', boardSlug: 'atlassian', tier: 'tier1' },

  // Ashby Tier-1
  { name: 'OpenAI', atsType: 'ashby', boardSlug: 'openai', tier: 'tier1' },
  { name: 'Vercel', atsType: 'ashby', boardSlug: 'vercel', tier: 'tier1' },
  { name: 'Linear', atsType: 'ashby', boardSlug: 'linear', tier: 'tier1' },
  { name: 'Notion', atsType: 'ashby', boardSlug: 'notion', tier: 'tier1' },
  { name: 'Perplexity', atsType: 'ashby', boardSlug: 'perplexity', tier: 'tier1' },
  { name: 'Cursor', atsType: 'ashby', boardSlug: 'anysphere', tier: 'tier1' },
  { name: 'Mistral AI', atsType: 'ashby', boardSlug: 'mistral', tier: 'tier1' },
  { name: 'Replit', atsType: 'ashby', boardSlug: 'replit', tier: 'tier1' },
  { name: 'Cognition', atsType: 'ashby', boardSlug: 'cognition', tier: 'tier1' },

  // SmartRecruiters Tier-1
  { name: 'Visa', atsType: 'smartrecruiters', boardSlug: 'visa', tier: 'tier1' },
  { name: 'Square', atsType: 'smartrecruiters', boardSlug: 'square', tier: 'tier1' },
  { name: 'Block', atsType: 'smartrecruiters', boardSlug: 'block', tier: 'tier1' },
  { name: 'Twitter', atsType: 'smartrecruiters', boardSlug: 'twitter', tier: 'tier1' },
];

export class CompanyRegistryService {
  /**
   * Auto-derives ATS platform + board slug from any job apply URL and registers
   * into the PostgreSQL database.
   */
  public async deriveAndRegister(
    client: pg.PoolClient | pg.Pool,
    url: string,
    companyName?: string,
    tier: CompanyTier = 'tier2'
  ): Promise<RegisterCompanyResult | null> {
    const parsed = AtsUrlParser.parse(url);
    if (!parsed) return null;

    const name = (companyName || parsed.suggestedName || parsed.boardSlug).trim();
    const pollInterval = tier === 'tier1' ? 120 : tier === 'tier2' ? 600 : 1800;

    // Check if company already exists
    const existingRes = await client.query(
      `SELECT * FROM companies WHERE ats_type = $1 AND board_slug = $2`,
      [parsed.atsType, parsed.boardSlug]
    );

    if (existingRes.rows.length > 0) {
      return {
        company: existingRes.rows[0],
        isNewCompany: false,
      };
    }

    const newId = crypto.randomUUID();
    const upsertSql = `
      INSERT INTO companies (id, name, ats_type, board_slug, tier, poll_interval_sec, next_poll_at, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW(), NOW())
      ON CONFLICT (ats_type, board_slug) DO UPDATE
      SET
        name = CASE WHEN companies.name = '' OR companies.name = companies.board_slug THEN EXCLUDED.name ELSE companies.name END,
        updated_at = NOW()
      RETURNING *, (created_at = updated_at) AS is_new_company;
    `;

    const res = await client.query(upsertSql, [newId, name, parsed.atsType, parsed.boardSlug, tier, pollInterval]);
    const row = res.rows[0];

    return {
      company: row,
      isNewCompany: Boolean(row.is_new_company ?? true),
    };
  }

  /**
   * Seeds initial Tier-1 company registry into PostgreSQL
   */
  public async seedTier1Companies(client: pg.PoolClient | pg.Pool): Promise<number> {
    let insertedCount = 0;
    for (const seed of INITIAL_TIER1_COMPANIES) {
      const res = await this.deriveAndRegister(
        client,
        `https://jobs.${seed.atsType === 'greenhouse' ? 'greenhouse.io' : seed.atsType === 'lever' ? 'lever.co' : seed.atsType === 'ashby' ? 'ashbyhq.com' : 'smartrecruiters.com'}/${seed.boardSlug}`,
        seed.name,
        seed.tier
      );
      if (res?.isNewCompany) {
        insertedCount += 1;
      }
    }
    return insertedCount;
  }

  /**
   * Auto-derives and ingests an array of scraped job URLs (e.g. from SimplifyJobs markdown or browser scraping)
   */
  public async ingestScrapedJobUrls(
    client: pg.PoolClient | pg.Pool,
    scrapedJobs: Array<{ url: string; company?: string }>
  ): Promise<{ processed: number; registeredNew: number }> {
    let registeredNew = 0;
    let processed = 0;

    for (const item of scrapedJobs) {
      if (!item.url) continue;
      processed += 1;
      const res = await this.deriveAndRegister(client, item.url, item.company, 'tier2');
      if (res?.isNewCompany) {
        registeredNew += 1;
      }
    }

    return { processed, registeredNew };
  }
}
