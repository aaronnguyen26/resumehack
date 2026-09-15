/**
 * Job-Specific Tailoring Pipeline Tests
 *
 * Verifies that the Gemini recommendation pipeline correctly:
 * 1. Accepts and stores new job-specific fields on AtsAuditContext
 * 2. Injects job context into the ATS context block from buildAtsContextBlock()
 * 3. Marks job-tailoring mode active when job fields are present
 * 4. Correctly surfaces criticalMissingKeywords in the prompt block
 * 5. Generates fallback recommendations referencing job description
 */

import { describe, it, expect } from 'vitest';
import {
  buildAtsContextBlock,
  AtsAuditContext,
  generatePersonalizedFallbackRecommendations,
} from '../services/gemini-recommendations.js';

function makeBaseContext(overrides: Partial<AtsAuditContext> = {}): AtsAuditContext {
  return {
    overallScore: 62,
    hardSkillsScore: 55,
    actionVerbScore: 40,
    metricScore: 50,
    productionScore: 45,
    selfProjectsScore: 60,
    weakVerbsFound: ['worked on', 'helped'],
    missingKeywords: ['Kubernetes', 'GraphQL'],
    matchedKeywords: ['React', 'TypeScript'],
    quantifiedBullets: 3,
    totalBullets: 8,
    metricPercentage: 38,
    improvementSuggestions: ['Add metrics to bullet 2', 'Replace "worked on" with strong verbs'],
    ...overrides,
  };
}

const JOB_CONTEXT_FIELDS: Partial<AtsAuditContext> = {
  jobTitle: 'Senior Software Engineer',
  jobCompany: 'Stripe',
  jobSeniority: 'Senior',
  jobKeySkills: ['Go', 'PostgreSQL', 'Kafka', 'TypeScript', 'Kubernetes'],
  jobRequirements: [
    '5+ years of backend engineering experience',
    'Experience with distributed systems',
    'Strong Go or Python proficiency',
  ],
  jobPreferredQualifications: ['Experience with payment systems', 'Kafka/event-streaming background'],
  jobResponsibilities: [
    'Design and maintain high-throughput payment processing pipelines',
    'Lead cross-functional incidents and reliability reviews',
  ],
  criticalMissingKeywords: ['Go', 'Kafka', 'distributed systems'],
  jobSpecificScore: 58,
};

// ── 1. AtsAuditContext: Job Fields Storage ────────────────────────────────────

describe('AtsAuditContext — job-specific fields', () => {
  it('accepts all new job-specific fields', () => {
    const ctx: AtsAuditContext = makeBaseContext(JOB_CONTEXT_FIELDS);
    expect(ctx.jobTitle).toBe('Senior Software Engineer');
    expect(ctx.jobCompany).toBe('Stripe');
    expect(ctx.jobSeniority).toBe('Senior');
    expect(ctx.jobKeySkills).toHaveLength(5);
    expect(ctx.jobRequirements).toHaveLength(3);
    expect(ctx.jobPreferredQualifications).toHaveLength(2);
    expect(ctx.jobResponsibilities).toHaveLength(2);
    expect(ctx.criticalMissingKeywords).toEqual(['Go', 'Kafka', 'distributed systems']);
    expect(ctx.jobSpecificScore).toBe(58);
  });

  it('allows job fields to be optional (general mode)', () => {
    const ctx: AtsAuditContext = makeBaseContext();
    expect(ctx.jobTitle).toBeUndefined();
    expect(ctx.jobCompany).toBeUndefined();
    expect(ctx.criticalMissingKeywords).toBeUndefined();
    expect(ctx.jobSpecificScore).toBeUndefined();
  });
});

// ── 2. buildAtsContextBlock — General Mode ────────────────────────────────────

describe('buildAtsContextBlock — general (no job) mode', () => {
  it('returns standard ATS audit report', () => {
    const ctx = makeBaseContext();
    const block = buildAtsContextBlock(ctx);
    expect(block).toContain('── HACKY AI ATS AUDIT REPORT');
    expect(block).toContain('Overall ATS Score: 62/100');
    expect(block).toContain('"worked on"');
    expect(block).toContain('Kubernetes');
    expect(block).toContain('React');
  });

  it('does NOT include job-tailoring section when no job fields set', () => {
    const ctx = makeBaseContext();
    const block = buildAtsContextBlock(ctx);
    expect(block).not.toContain('JOB-SPECIFIC TAILORING CONTEXT');
    expect(block).not.toContain('CRITICAL MISSING KEYWORDS');
    expect(block).not.toContain('TAILORING MANDATE');
  });
});

// ── 3. buildAtsContextBlock — Job-Tailoring Mode ─────────────────────────────

describe('buildAtsContextBlock — job-tailoring mode', () => {
  it('includes JOB-SPECIFIC TAILORING CONTEXT section when job fields present', () => {
    const ctx = makeBaseContext(JOB_CONTEXT_FIELDS);
    const block = buildAtsContextBlock(ctx);
    expect(block).toContain('JOB-SPECIFIC TAILORING CONTEXT');
    expect(block).toContain('Senior Software Engineer @ Stripe');
    expect(block).toContain('Seniority Level: Senior');
    expect(block).toContain('Job-Specific ATS Match Score: 58/100');
  });

  it('lists critical missing keywords with urgency marker', () => {
    const ctx = makeBaseContext(JOB_CONTEXT_FIELDS);
    const block = buildAtsContextBlock(ctx);
    expect(block).toContain('CRITICAL MISSING KEYWORDS');
    expect(block).toContain('Go');
    expect(block).toContain('Kafka');
    expect(block).toContain('distributed systems');
    expect(block).toContain('MUST be woven into at least one bullet rewrite');
  });

  it('lists required JD skills', () => {
    const ctx = makeBaseContext(JOB_CONTEXT_FIELDS);
    const block = buildAtsContextBlock(ctx);
    expect(block).toContain('Required Skills in JD');
    expect(block).toContain('PostgreSQL');
    expect(block).toContain('Kubernetes');
  });

  it('lists required qualifications', () => {
    const ctx = makeBaseContext(JOB_CONTEXT_FIELDS);
    const block = buildAtsContextBlock(ctx);
    expect(block).toContain('Required Qualifications from JD');
    expect(block).toContain('5+ years of backend engineering experience');
  });

  it('lists preferred qualifications', () => {
    const ctx = makeBaseContext(JOB_CONTEXT_FIELDS);
    const block = buildAtsContextBlock(ctx);
    expect(block).toContain('Preferred Qualifications');
    expect(block).toContain('payment systems');
  });

  it('lists core responsibilities', () => {
    const ctx = makeBaseContext(JOB_CONTEXT_FIELDS);
    const block = buildAtsContextBlock(ctx);
    expect(block).toContain('Core Responsibilities');
    expect(block).toContain('payment processing pipelines');
  });

  it('includes tailoring mandate at end of job section', () => {
    const ctx = makeBaseContext(JOB_CONTEXT_FIELDS);
    const block = buildAtsContextBlock(ctx);
    expect(block).toContain('TAILORING MANDATE');
    expect(block).toContain('concrete requirement or skill listed above');
    expect(block).toContain('END JOB-SPECIFIC CONTEXT');
  });

  it('ATS audit block appears before job section', () => {
    const ctx = makeBaseContext(JOB_CONTEXT_FIELDS);
    const block = buildAtsContextBlock(ctx);
    const atsEnd = block.indexOf('END ATS AUDIT REPORT');
    const jobStart = block.indexOf('JOB-SPECIFIC TAILORING CONTEXT');
    expect(atsEnd).toBeGreaterThan(0);
    expect(jobStart).toBeGreaterThan(atsEnd);
  });
});

// ── 4. criticalMissingKeywords edge cases ────────────────────────────────────

describe('criticalMissingKeywords edge cases', () => {
  it('caps at 10 in the block', () => {
    const manyCritical = Array.from({ length: 15 }, (_, i) => `Skill${i}`);
    const ctx = makeBaseContext({ ...JOB_CONTEXT_FIELDS, criticalMissingKeywords: manyCritical });
    const block = buildAtsContextBlock(ctx);
    const matches = block.match(/Skill\d+/g) || [];
    expect(matches.length).toBeLessThanOrEqual(10);
  });

  it('skips CRITICAL MISSING KEYWORDS section when list is empty', () => {
    const ctx = makeBaseContext({ ...JOB_CONTEXT_FIELDS, criticalMissingKeywords: [] });
    const block = buildAtsContextBlock(ctx);
    expect(block).not.toContain('CRITICAL MISSING KEYWORDS');
  });
});

// ── 5. Job mode triggers on jobKeySkills alone ───────────────────────────────

describe('buildAtsContextBlock — triggers on jobKeySkills alone', () => {
  it('shows job section when only jobKeySkills provided', () => {
    const ctx = makeBaseContext({ jobKeySkills: ['Rust', 'WebAssembly'] });
    const block = buildAtsContextBlock(ctx);
    expect(block).toContain('JOB-SPECIFIC TAILORING CONTEXT');
    expect(block).toContain('Rust');
    expect(block).toContain('WebAssembly');
  });
});

// ── 6. Fallback recs with job description ────────────────────────────────────

describe('generatePersonalizedFallbackRecommendations — job description mode', () => {
  const resumeWithBullets = `
John Doe | john@example.com
EXPERIENCE
Software Engineer | Acme Corp | 2022–Present
• Built REST APIs using Node.js and PostgreSQL
• Worked on dashboard features with React

PROJECTS
• Developed a full-stack web app with TypeScript and React
`;

  it('generates recommendations when job description provided', () => {
    const jd = 'Looking for Senior Engineer proficient in Go, Kafka, and Kubernetes.';
    const result = generatePersonalizedFallbackRecommendations(resumeWithBullets, jd, 'Senior Software Engineer');
    expect(result.recommendations.length).toBeGreaterThan(0);
    expect(result.source).toBe('heuristic_fallback');
  });

  it('flags missing JD skills as missing_skills when absent from resume', () => {
    const jd = 'We require Go, Kafka, and Kubernetes experience.';
    const result = generatePersonalizedFallbackRecommendations(resumeWithBullets, jd, 'Senior Software Engineer');
    const skillGap = result.recommendations.find(r => r.category === 'missing_skills');
    expect(skillGap).toBeDefined();
    if (skillGap) {
      expect(skillGap.priority).toBe('critical');
    }
  });

  it('works in general mode (no job description)', () => {
    const result = generatePersonalizedFallbackRecommendations(resumeWithBullets, '', 'Software Engineer');
    expect(result.recommendations.length).toBeGreaterThan(0);
    expect(result.source).toBe('heuristic_fallback');
  });
});

// ── 7. ScrapedJobData field mapping contract ──────────────────────────────────

describe('ScrapedJobData rich field mapping — AtsAuditContext contract', () => {
  it('correctly stores and reflects all mapped fields in context block', () => {
    const atsContext: AtsAuditContext = {
      overallScore: 65,
      hardSkillsScore: 58,
      actionVerbScore: 42,
      metricScore: 50,
      productionScore: 48,
      selfProjectsScore: 55,
      weakVerbsFound: [],
      missingKeywords: ['Go', 'Kafka'],
      matchedKeywords: ['TypeScript', 'PostgreSQL'],
      quantifiedBullets: 4,
      totalBullets: 9,
      metricPercentage: 44,
      improvementSuggestions: [],
      jobTitle: 'Senior Software Engineer',
      jobCompany: 'Stripe',
      jobSeniority: 'Full-time',
      jobKeySkills: ['Go', 'Kafka', 'PostgreSQL', 'TypeScript'],
      jobRequirements: ['5+ years backend experience', 'Distributed systems expertise'],
      jobResponsibilities: ['Build payment APIs', 'Lead incident reviews'],
      criticalMissingKeywords: ['Go', 'Kafka'],
      jobSpecificScore: 65,
    };

    expect(atsContext.jobTitle).toBe('Senior Software Engineer');
    expect(atsContext.jobCompany).toBe('Stripe');
    expect(atsContext.jobKeySkills).toContain('Go');
    expect(atsContext.criticalMissingKeywords).toEqual(['Go', 'Kafka']);

    const block = buildAtsContextBlock(atsContext);
    expect(block).toContain('Senior Software Engineer @ Stripe');
    expect(block).toContain('Go');
    expect(block).toContain('Kafka');
    expect(block).toContain('5+ years backend experience');
    expect(block).toContain('payment APIs');
  });
});
