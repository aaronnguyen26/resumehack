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
    expect(report.breakdown.actionVerbVitalityScore).toBeDefined();
    expect(report.breakdown.starImpactScore).toBeDefined();
    expect(report.actionVerbStrength).toBeDefined();
    expect(report.quantificationStats).toBeDefined();
  });

  it('audits general master resume across domain benchmarks with STAR and verb vitality analysis', () => {
    const report = scorer.auditGeneralAts(sampleResume, 'Software Engineering');

    expect(report.overallScore).toBeGreaterThan(20);
    expect(report.actionVerbStrength?.strongCount).toBeGreaterThanOrEqual(1);
    expect(report.quantificationStats?.quantifiedBullets).toBeGreaterThanOrEqual(1);
    expect(report.improvementSuggestions.length).toBeGreaterThan(0);
  });

  it('correctly matches technical keywords using alias mapping (k8s, postgres, aws, js)', () => {
    const aliasResume = `
    Jane Doe
    Skills: K8s, JS, TS, Postgres, AWS, ML, CI/CD
    Experience:
    • Architected microservices with k8s and postgres, reducing p99 latency by 45ms.
    • Spearheaded CI/CD pipelines deploying to AWS cloud with 99.99% availability.
    • Benchmarked real-time throughput handling 50k RPS across 2M MAU.
    `;

    const jobDesc = `
    Looking for a Senior Backend Engineer with Kubernetes, PostgreSQL, TypeScript, Amazon Web Services, and Machine Learning.
    `;

    const report = scorer.analyze(aliasResume, jobDesc);

    const k8sMatch = report.keywords.find(k => k.keyword.toLowerCase() === 'kubernetes');
    expect(k8sMatch?.foundInResume).toBe(true);

    const pgMatch = report.keywords.find(k => k.keyword.toLowerCase() === 'postgresql');
    expect(pgMatch?.foundInResume).toBe(true);

    const awsMatch = report.keywords.find(k => k.keyword.toLowerCase() === 'aws');
    expect(awsMatch?.foundInResume).toBe(true);

    expect(report.quantificationStats?.percentage).toBeGreaterThanOrEqual(75);
    expect(report.actionVerbStrength?.strongCount).toBeGreaterThanOrEqual(3);
    expect(report.overallScore).toBeGreaterThanOrEqual(75);
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
    expect(result.requestsExecuted).toBeGreaterThanOrEqual(1);
  });
});
