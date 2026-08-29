import { describe, it, expect } from 'vitest';
import { AtsScorerService } from '../services/ats-scorer.js';
import { LlmTailorService } from '../services/llm-tailor.js';
import { GoogleDocsService } from '../services/google-docs.js';

describe('AtsScorerService', () => {
  const scorer = new AtsScorerService();

  const sampleResume = `
  Alex Chen
  alex.chen@example.com
  Languages: Python, JavaScript, SQL
  Frameworks: React, Node.js, PostgreSQL
  Experience:
  • Worked on web apps using Python and React to build customer dashboards.
  • Created database schemas in PostgreSQL and wrote unit tests with 85% coverage.
  `;

  const sampleJD = `
  We are seeking a Software Engineer Intern with experience in Python, Go, TypeScript, Docker, and PostgreSQL.
  You will design scalable REST APIs, microservices, and collaborate in an agile environment with cross-functional teams.
  `;

  it('calculates ATS score and extracts matched and missing keywords correctly', () => {
    const report = scorer.analyze(sampleResume, sampleJD);

    expect(report.overallScore).toBeGreaterThan(30);
    expect(report.overallScore).toBeLessThanOrEqual(100);

    const pythonMatch = report.keywords.find(k => k.keyword.toLowerCase() === 'python');
    expect(pythonMatch?.foundInResume).toBe(true);

    const goMatch = report.keywords.find(k => k.keyword.toLowerCase() === 'go');
    expect(goMatch?.foundInResume).toBe(false);

    const dockerMatch = report.keywords.find(k => k.keyword.toLowerCase() === 'docker');
    expect(dockerMatch?.foundInResume).toBe(false);

    expect(report.missingKeywordsCount).toBeGreaterThan(0);
    expect(report.improvementSuggestions.length).toBeGreaterThan(0);
  });
});

describe('LlmTailorService', () => {
  const scorer = new AtsScorerService();
  const tailor = new LlmTailorService();
  const docsService = new GoogleDocsService();

  it('optimizes bullet points using strong action verbs and injects missing keywords', async () => {
    const { bullets, fullText } = docsService.getMockMasterResume();
    const jobDescription = 'Looking for Go, Kubernetes, and Docker experience for microservices and cloud infrastructure.';
    
    const atsReport = scorer.analyze(fullText, jobDescription);
    const diffs = tailor.tailorBullets(bullets, jobDescription, atsReport, 'Software Engineer', 'Stripe');

    expect(diffs.length).toBe(bullets.length);
    expect(diffs[0].tailoredText).not.toBe(bullets[0].originalText);
    expect(diffs[0].rationale).toBeTruthy();
    expect(diffs[0].status).toBe('pending');
  });
});

describe('GoogleDocsService', () => {
  const docsService = new GoogleDocsService();

  it('correctly generates batch updates for accepted bullet diffs', async () => {
    const diffs = [
      {
        id: '1',
        section: 'Experience',
        organization: 'Acme',
        role: 'SWE',
        originalText: 'Old bullet text',
        tailoredText: 'New optimized STAR bullet text',
        injectedKeywords: ['Docker'],
        rationale: 'Enhanced verb',
        charCountDiff: 10,
        status: 'accepted' as const
      },
      {
        id: '2',
        section: 'Experience',
        organization: 'Acme',
        role: 'SWE',
        originalText: 'Rejected bullet',
        tailoredText: 'Should not apply',
        injectedKeywords: [],
        rationale: 'None',
        charCountDiff: 0,
        status: 'rejected' as const
      }
    ];

    const result = await docsService.applyBatchUpdates('mock-doc-123', diffs);
    expect(result.success).toBe(true);
    expect(result.updatedCount).toBe(1);
    expect(result.requestsExecuted).toBe(1);
  });
});
