import { describe, it, expect } from 'vitest';
import { LlmTailorService, calculateLineBudget, compressAndPreserveLayout } from '../services/llm-tailor.js';
import { AtsScorerService } from '../services/ats-scorer.js';
import { ResumeBullet, AtsScoreReport } from '../types/index.js';

describe('Diff Engine & LLM Bullet Tailoring with Layout Preservation', () => {
  const tailor = new LlmTailorService();
  const scorer = new AtsScorerService();

  const testBullets: ResumeBullet[] = [
    {
      id: 'b1',
      section: 'Experience',
      organization: 'TechCorp',
      role: 'SWE Intern',
      originalText: 'worked on backend services using Python and Postgres to process customer orders.',
      prefix: '• ',
    },
    {
      id: 'b2',
      section: 'Experience',
      organization: 'TechCorp',
      role: 'SWE Intern',
      originalText: 'helped with CI/CD pipeline automation and fixed broken integration tests.',
      prefix: '- ',
    },
    {
      id: 'b3',
      section: 'Projects',
      organization: 'KV Store',
      role: 'Creator',
      originalText: 'made a key-value database in Go with Raft consensus and REST API endpoints.',
      prefix: '• ',
    },
  ];

  it('optimizes bullets with domain-specific action verbs for Software Engineering', () => {
    const diffs = tailor.optimizeMasterResumeBullets(testBullets, 'Software Engineering');

    expect(diffs).toHaveLength(3);
    expect(diffs[0].status).toBe('pending');
    expect(diffs[0].tailoredText).toMatch(/^(Architected|Engineered|Spearheaded|Optimized|Deployed|Implemented)/);
    expect(diffs[0].tailoredText.toLowerCase()).not.toContain('worked on');
    expect(diffs[1].tailoredText).toContain('Spearheaded');
    expect(diffs[2].tailoredText).toContain('Engineered');
  });

  it('preserves bullet line budget and prevents multi-line overflow', () => {
    const diffs = tailor.optimizeMasterResumeBullets(testBullets, 'Software Engineering');

    diffs.forEach(diff => {
      expect(diff.lineBudget).toBeDefined();
      expect(diff.lineBudget?.originalChars).toBe(diff.originalText.length);
      expect(diff.lineBudget?.tailoredChars).toBe(diff.tailoredText.length);
      expect(diff.lineBudget?.fitsOriginalLineBudget).toBe(true);
      expect(diff.lineBudget?.spilloverRisk).not.toBe('high');
    });
  });

  it('preserves original bullet prefixes and formatting', () => {
    const diffs = tailor.optimizeMasterResumeBullets(testBullets, 'Software Engineering');

    expect(diffs[0].prefix).toBe('• ');
    expect(diffs[1].prefix).toBe('- ');
    expect(diffs[2].prefix).toBe('• ');
  });

  it('compresses wordy phrases when tailored text approaches boundary limits', () => {
    const wordy = 'Engineered in order to deploy high-performance and scalable backend services seamlessly';
    const compressed = compressAndPreserveLayout(wordy, 70);
    expect(compressed.length).toBeLessThanOrEqual(70);
    expect(compressed).not.toContain('in order to');
    expect(compressed).not.toContain('seamlessly');
  });

  it('calculates line budget correctly for 1-line and 2-line bullets', () => {
    const singleLineOrig = 'Architected high-throughput REST APIs using Python and Django.'; // 62 chars
    const singleLineTailored = 'Architected high-scale REST APIs using Python, Django, and Redis.'; // 65 chars

    const budget1 = calculateLineBudget(singleLineOrig, singleLineTailored);
    expect(budget1.originalLines).toBe(1);
    expect(budget1.tailoredLines).toBe(1);
    expect(budget1.fitsOriginalLineBudget).toBe(true);

    const twoLineOrig = 'Architected high-throughput REST APIs using Python and Django, serving over 10,000 requests per second with 99.99% uptime across production clusters.'; // 150 chars
    const twoLineTailored = 'Architected distributed REST APIs using Python, Django, and Redis, serving 15k RPS with 99.99% uptime across global Kubernetes clusters.'; // 137 chars

    const budget2 = calculateLineBudget(twoLineOrig, twoLineTailored);
    expect(budget2.originalLines).toBe(2);
    expect(budget2.tailoredLines).toBe(2);
    expect(budget2.fitsOriginalLineBudget).toBe(true);
  });

  it('injects high-priority missing keywords for specific job descriptions while respecting budget', () => {
    const jobDescription = `
      Seeking a Software Engineer to develop Kubernetes, Docker, and Distributed Systems infrastructure.
      Experience with REST APIs and high-availability PostgreSQL is required.
    `;

    const atsReport: AtsScoreReport = scorer.analyze(
      testBullets.map(b => b.originalText).join('\n'),
      jobDescription
    );

    const diffs = tailor.tailorBullets(
      testBullets,
      jobDescription,
      atsReport,
      'Infrastructure Engineer',
      'Stripe'
    );

    expect(diffs).toHaveLength(3);
    diffs.forEach(diff => {
      expect(diff.tailoredText).not.toBe(diff.originalText);
      expect(diff.rationale).toBeTruthy();
      expect(diff.injectedKeywords.length).toBeGreaterThan(0);
      expect(diff.lineBudget).toBeDefined();
    });
  });
});
