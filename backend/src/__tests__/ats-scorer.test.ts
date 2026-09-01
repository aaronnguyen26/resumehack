import { describe, it, expect } from 'vitest';
import { AtsScorerService } from '../services/ats-scorer.js';
import { LlmTailorService } from '../services/llm-tailor.js';
import { GoogleDocsService } from '../services/google-docs.js';

describe('AtsScorerService — Core ATS & Keyword Matching', () => {
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
    expect(report.breakdown.selfProjectsScore).toBeDefined();
    expect(report.breakdown.productionExperienceScore).toBeDefined();
    expect(report.actionVerbStrength).toBeDefined();
    expect(report.quantificationStats).toBeDefined();
  });

  it('audits general master resume across domain benchmarks with STAR and verb vitality analysis', () => {
    const report = scorer.auditGeneralAts(sampleResume, 'Software Engineering');

    expect(report.overallScore).toBeGreaterThan(20);
    expect(report.actionVerbStrength?.strongCount).toBeGreaterThanOrEqual(1);
    expect(report.quantificationStats?.quantifiedBullets).toBeGreaterThanOrEqual(1);
    expect(report.improvementSuggestions.length).toBeGreaterThan(0);
    expect(report.selfProjectsAudit).toBeDefined();
    expect(report.productionExperienceAudit).toBeDefined();
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

describe('AtsScorerService — HackerRank-Inspired Rubric Categories', () => {
  const scorer = new AtsScorerService();

  const productionHeavyResume = `
  Alex Chen
  San Francisco, CA • alex@example.com • github.com/alexchen • alexchen.dev

  EXPERIENCE
  Software Engineering Intern | Stripe | May 2024 - Aug 2024
  • Architected distributed Redis caching clusters reducing P99 latency by 68% across 12 regions.
  • Shipped backend microservices in Python, FastAPI, and Postgres processing 50,000 daily orders.
  • Deployed to Kubernetes clusters with Prometheus & Datadog monitoring, maintaining 99.99% uptime.
  • Participated in on-call rotation, resolved P1 incident, and authored post-mortem for CI/CD pipeline.

  Full-Stack Developer Intern | OpenAI Labs | Jan 2024 - Apr 2024
  • Built real-time collaborative code editor using WebSockets, WebAssembly, and CRDT synchronization.
  • Implemented automated load testing with Playwright, decreasing production regressions by 40%.

  PROJECTS
  Distributed Task Orchestrator | Go, gRPC, Raft, Docker | github.com/alexchen/raft-orchestrator
  • Built distributed consensus engine implementing Raft protocol handling 10,000 requests/sec with zero failover data loss.
  • Live demo deployed at https://raft-demo.alexchen.dev with 1,200+ monthly active developers.

  ResumeHack AI Copilot | TypeScript, React, Google Docs API | github.com/alexchen/resumehack
  • Developed Chrome extension for real-time ATS scoring and STAR bullet tailoring with 500+ GitHub stars.
  `;

  const tutorialOnlyResume = `
  John Doe
  john.doe@example.com

  PROJECTS
  Weather App
  • Built a weather app following a YouTube tutorial with React and OpenWeatherMap API.
  • Completed a course project displaying 5-day weather forecasts.

  Todo List Application
  • Followed a tutorial to build a simple todo list in JavaScript with local storage.
  • Built a clone following a guided project.
  `;

  it('Step 1: Evaluates complex Self Projects with live links, impact metrics, and technical depth', () => {
    const audit = scorer.auditSelfProjects(productionHeavyResume);

    expect(audit.score).toBeGreaterThanOrEqual(90);
    expect(audit.hasWorkingLinks).toBe(true);
    expect(audit.linksFound.length).toBeGreaterThanOrEqual(2);
    expect(audit.complexitySignals).toContain('distributed');
    expect(audit.complexitySignals).toContain('caching');
    expect(audit.impactSignals).toContain('stars');
    expect(audit.tutorialFlags.length).toBe(0);
    expect(audit.evidence).toContain('Self Projects:');
    expect(audit.evidence).toContain('verified repo/demo link');
  });

  it('Step 1: Penalizes tutorial-following phrasing in Self Projects category', () => {
    const audit = scorer.auditSelfProjects(tutorialOnlyResume);

    expect(audit.score).toBeLessThanOrEqual(45);
    expect(audit.hasWorkingLinks).toBe(false);
    expect(audit.tutorialFlags.length).toBeGreaterThanOrEqual(3);
    expect(audit.evidence).toContain('Flagged');
    expect(audit.evidence).toContain('tutorial-like');
  });

  it('Step 2: Evaluates Production Experience, identifying roles, dates, and infrastructure signals', () => {
    const audit = scorer.auditProductionExperience(productionHeavyResume);

    expect(audit.score).toBeGreaterThanOrEqual(90);
    expect(audit.roleCount).toBeGreaterThanOrEqual(2);
    expect(audit.productionKeywordsFound).toContain('kubernetes');
    expect(audit.productionKeywordsFound).toContain('monitoring');
    expect(audit.productionKeywordsFound).toContain('on-call');
    expect(audit.isProductionHeavy).toBe(true);
    expect(audit.tenureSignals.length).toBeGreaterThanOrEqual(2);
    expect(audit.evidence).toContain('Production Experience:');
    expect(audit.evidence).toContain('production engineering maturity');
  });

  it('Step 2: Handles low production experience gracefully without crashing', () => {
    const audit = scorer.auditProductionExperience(tutorialOnlyResume);

    expect(audit.score).toBeLessThanOrEqual(35);
    expect(audit.roleCount).toBe(0);
    expect(audit.isProductionHeavy).toBe(false);
    expect(audit.evidence).toContain('No industry employment');
  });

  it('Step 3: Weights both categories into the revised 7-factor ATS formula without dominating', () => {
    const jd = 'Seeking a Software Engineer with Python, Kubernetes, Redis, Docker, and Microservices.';
    const report = scorer.analyze(productionHeavyResume, jd);

    // Verify all breakdown components exist
    expect(report.breakdown.hardSkillsScore).toBeDefined();
    expect(report.breakdown.productionExperienceScore).toBeDefined();
    expect(report.breakdown.selfProjectsScore).toBeDefined();
    expect(report.breakdown.softSkillsScore).toBeDefined();
    expect(report.breakdown.formattingScore).toBeDefined();

    // Verify overall score is balanced
    expect(report.overallScore).toBeGreaterThanOrEqual(85);
    expect(report.overallScore).toBeLessThanOrEqual(100);
    expect(report.selfProjectsAudit?.score).toBeGreaterThanOrEqual(90);
    expect(report.productionExperienceAudit?.score).toBeGreaterThanOrEqual(90);
  });

  it('Step 5: Strictly Deterministic — 3 repeated runs on identical input produce identical output', () => {
    const jd = 'Senior Backend Engineer with Python, Go, Docker, Redis, Kubernetes, Distributed Systems, CI/CD.';

    const run1 = scorer.analyze(productionHeavyResume, jd);
    const run2 = scorer.analyze(productionHeavyResume, jd);
    const run3 = scorer.analyze(productionHeavyResume, jd);

    // Check exact equality of overall score and breakdown
    expect(run1.overallScore).toBe(run2.overallScore);
    expect(run2.overallScore).toBe(run3.overallScore);
    expect(run1.breakdown).toEqual(run2.breakdown);
    expect(run2.breakdown).toEqual(run3.breakdown);

    // Check exact equality of evidence strings
    expect(run1.selfProjectsAudit?.evidence).toBe(run2.selfProjectsAudit?.evidence);
    expect(run2.selfProjectsAudit?.evidence).toBe(run3.selfProjectsAudit?.evidence);
    expect(run1.productionExperienceAudit?.evidence).toBe(run2.productionExperienceAudit?.evidence);
    expect(run2.productionExperienceAudit?.evidence).toBe(run3.productionExperienceAudit?.evidence);

    // Check full report equality
    expect(JSON.stringify(run1)).toBe(JSON.stringify(run2));
    expect(JSON.stringify(run2)).toBe(JSON.stringify(run3));
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
