import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  evaluateHackyAiRecommendationsQuality,
  RecommendationQualityReport,
} from '../services/hacky-ai-quality-evaluator.js';
import {
  generatePersonalizedFallbackRecommendations,
  GeminiRecommendationService,
  GeminiPersonalizedRecommendation,
} from '../services/gemini-recommendations.js';

describe('Hacky AI Recommendation Quality & Accuracy Benchmark Suite', () => {
  const sampleCandidateResume = `
Alex Rivera
alex.rivera@example.com • San Francisco, CA • github.com/arivera

WORK EXPERIENCE
Apex Cloud Systems — Software Engineer
Jan 2023 – Present
• Worked on building the web dashboard for internal analytics
• Engineered distributed Redis caching clusters reducing P99 latency by 55%
• Helped with onboarding new engineers and managing database migrations

Pulse Media — Associate Frontend Developer
Jun 2021 – Dec 2022
• Responsible for creating customer-facing user profile pages in React
• Built automated testing suite for frontend components

PROJECTS
High-Concurrency Event Stream Pipeline
• Built an event-driven queue handling message ingestion in Go
• Implemented PostgreSQL database connection pooling

EDUCATION
University of California, Berkeley — B.S. in Computer Science
Graduated May 2021 • GPA: 3.88 • Honors
Certification: AWS Certified Solutions Architect Associate
`;

  const sampleTargetJobDescription = `
Senior Full Stack / Platform Engineer
Target Tech Stack: React, TypeScript, Node.js, Go, PostgreSQL, Redis, Kubernetes, Docker.
Requirements:
- 3+ years experience designing high-throughput web applications and APIs.
- Experience with real-time UI performance, Core Web Vitals, and responsive state management.
- Demonstrated experience optimizing distributed databases and low-latency microservices.
- Track record of delivering zero-downtime deployments with CI/CD and containerization.
`;

  describe('Part 1: Quality Evaluator Calibration & Sensitivity', () => {
    it('accurately penalizes subpar, generic, and unquantified AI recommendations', () => {
      const subparRecs: GeminiPersonalizedRecommendation[] = [
        {
          id: 'bad-rec-1',
          category: 'star_quantification',
          domain: 'frontend',
          title: 'Make the dashboard sound better',
          priority: 'high',
          impactPts: 10,
          sectionHint: 'experience',
          originalText: 'Completely made-up bullet that candidate never wrote in their life',
          improvedText: '• Worked on significantly improving user dashboards with various different modern web frameworks and tools.',
          critique: 'This could be better.',
          reasoning: 'Makes resume nicer.',
        },
        {
          id: 'bad-rec-2',
          category: 'systems_depth',
          domain: 'backend',
          title: 'Add metrics to university degree',
          priority: 'critical',
          impactPts: 15,
          sectionHint: 'experience',
          originalText: 'Invented fictional university degree from imaginary institute with summa cum laude honors',
          improvedText: '• Graduated with B.S. in Computer Science increasing academic throughput by 85% using Redis caching.',
          critique: 'Degree needs metrics.',
          reasoning: 'Shows performance.',
        },
      ];

      const report = evaluateHackyAiRecommendationsQuality(
        subparRecs,
        sampleCandidateResume,
        'Software Engineer',
        sampleTargetJobDescription
      );

      expect(report.passed).toBe(false);
      expect(report.overallScore).toBeLessThan(50);
      expect(report.grade).toBe('Subpar / Uncalibrated');
      expect(report.dimensions.quoteFidelity.score).toBe(0); // Invented bullet
      expect(report.dimensions.sectionIsolation.score).toBeLessThan(100); // Corrupted education
      expect(report.dimensions.verbPowerAndDiversity.score).toBeLessThan(50); // Passive verb "Worked on"
    });

    it('awards high benchmark score (>= 90/100) to Tier-1 Elite X-Y-Z recommendations', () => {
      const eliteRecs: GeminiPersonalizedRecommendation[] = [
        {
          id: 'hacky-rec-1-analytics',
          category: 'star_quantification',
          domain: 'frontend',
          title: 'Quantify Internal Analytics Portal Throughput & Latency',
          priority: 'critical',
          impactPts: 20,
          sectionHint: 'experience',
          originalText: 'Worked on building the web dashboard for internal analytics',
          improvedText: '• Architected real-time internal analytics web portal in React & TypeScript, supporting 450+ daily active engineers and cutting report latency by 62%.',
          critique: 'Original bullet uses the weak lead verb "Worked on" and provides zero user volume or performance metrics.',
          reasoning: 'Quantifying active engineer adoption and 62% latency reduction directly demonstrates Tier-1 full-stack competence.',
        },
        {
          id: 'hacky-rec-2-pipeline',
          category: 'systems_depth',
          domain: 'backend',
          title: 'Elevate Ingestion Pipeline Throughput & Architectural Guarantees',
          priority: 'critical',
          impactPts: 22,
          sectionHint: 'projects',
          originalText: 'Built an event-driven queue handling message ingestion in Go',
          improvedText: '• Engineered concurrent event streaming ingestion service in Go and PostgreSQL, sustaining 25,000+ msgs/sec with sub-20ms P99 latency and zero message loss.',
          critique: 'Lacks concrete throughput figures, concurrent architectural guarantees, and latency SLA benchmarks.',
          reasoning: 'Proves high-concurrency systems design capability required for Staff/Senior backend hiring committees.',
        },
        {
          id: 'hacky-rec-3-testing',
          category: 'production_scale',
          domain: 'frontend',
          title: 'Quantify Automated Testing & CI/CD Regression Protection',
          priority: 'high',
          impactPts: 16,
          sectionHint: 'experience',
          originalText: 'Built automated testing suite for frontend components',
          improvedText: '• Automated end-to-end integration test suite using Playwright and GitHub Actions, elevating test coverage to 94% and preventing critical production regressions.',
          critique: 'Fails to quantify coverage percentage or CI/CD test automation velocity.',
          reasoning: 'Hiring managers look for software quality ownership and automated testing rigor.',
        },
      ];

      const report = evaluateHackyAiRecommendationsQuality(
        eliteRecs,
        sampleCandidateResume,
        'Software Engineer',
        sampleTargetJobDescription
      );

      expect(report.passed).toBe(true);
      expect(report.overallScore).toBeGreaterThanOrEqual(90);
      expect(report.grade).toBe('Tier-1 Elite (Top 1%)');
      expect(report.dimensions.quoteFidelity.score).toBe(100);
      expect(report.dimensions.sectionIsolation.score).toBe(100);
      expect(report.dimensions.xyzImpactFormula.score).toBe(100);
      expect(report.dimensions.verbPowerAndDiversity.score).toBeGreaterThanOrEqual(90);
      expect(report.dimensions.hackyAiMasking.passed).toBe(true);
    });
  });

  describe('Part 2: Hacky AI Heuristic Fallback Engine Quality Benchmark', () => {
    it('produces high-quality, 100% section-isolated recommendations directly quoting real text', () => {
      const result = generatePersonalizedFallbackRecommendations(
        sampleCandidateResume,
        sampleTargetJobDescription,
        'Senior Full Stack Engineer'
      );

      expect(result.recommendations.length).toBeGreaterThanOrEqual(3);

      const report = evaluateHackyAiRecommendationsQuality(
        result.recommendations,
        sampleCandidateResume,
        'Senior Full Stack Engineer',
        sampleTargetJobDescription
      );

      // Verify strict truth preservation & anti-hallucination
      expect(report.dimensions.sectionIsolation.score).toBe(100); // Zero education mutations
      expect(report.dimensions.quoteFidelity.score).toBeGreaterThanOrEqual(80); // Quoted actual candidate text
      expect(report.dimensions.hackyAiMasking.passed).toBe(true); // Masked as Hacky AI
      expect(report.overallScore).toBeGreaterThanOrEqual(85);
      expect(report.passed).toBe(true);
    });
  });

  describe('Part 3: Hacky AI Model Pipeline Elevation & Masking', () => {
    let originalFetch: typeof global.fetch;

    beforeEach(() => {
      originalFetch = global.fetch;
    });

    afterEach(() => {
      global.fetch = originalFetch;
      vi.restoreAllMocks();
    });

    it('generates Tier-1 quality recommendations masked strictly as Hacky AI with zero provider leaks', async () => {
      const mockHackyAiStructuredResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    candidateSummary: 'Hacky AI Career Intelligence: Strong full-stack foundations with distributed systems potential.',
                    recommendations: [
                      {
                        id: 'hacky-rec-1',
                        category: 'star_quantification',
                        domain: 'frontend',
                        title: 'Quantify Internal Analytics Portal Throughput & Latency',
                        priority: 'critical',
                        impactPts: 20,
                        sectionHint: 'experience',
                        originalText: 'Worked on building the web dashboard for internal analytics',
                        improvedText: '• Architected real-time internal analytics web portal in React & TypeScript, supporting 450+ daily active engineers and cutting report latency by 62%.',
                        critique: 'Passive verb "Worked on" down-levels candidate seniority. Lacks engineering scale or user engagement telemetry.',
                        reasoning: 'Demonstrates user adoption and measurable performance gains required for Senior engineering levels.',
                        suggestedKeywords: ['React', 'TypeScript', 'Analytics'],
                      },
                      {
                        id: 'hacky-rec-2',
                        category: 'systems_depth',
                        domain: 'backend',
                        title: 'Highlight Event Stream Concurrency & Throughput Guarantees',
                        priority: 'critical',
                        impactPts: 22,
                        sectionHint: 'projects',
                        originalText: 'Built an event-driven queue handling message ingestion in Go',
                        improvedText: '• Engineered concurrent event-driven message streaming queue in Go and PostgreSQL, sustaining 25,000+ msgs/sec with sub-20ms latency and zero data loss.',
                        critique: 'Fails to specify throughput numbers, concurrent scale, or message delivery guarantees.',
                        reasoning: 'Directly validates distributed systems design and high-concurrency capabilities.',
                        suggestedKeywords: ['Go', 'PostgreSQL', 'Concurrency'],
                      },
                      {
                        id: 'hacky-rec-3',
                        category: 'production_scale',
                        domain: 'devops',
                        title: 'Incorporate Automated Deployment & Zero-Downtime Migration Signals',
                        priority: 'high',
                        impactPts: 16,
                        sectionHint: 'experience',
                        originalText: 'Helped with onboarding new engineers and managing database migrations',
                        improvedText: '• Automated zero-downtime database schema migrations via GitHub Actions CI/CD and authored onboarding documentation accelerating team ramp-up by 40%.',
                        critique: 'Mentions database migrations passively without automated execution, zero-downtime safety, or CI/CD pipelines.',
                        reasoning: 'Demonstrates production reliability and team leadership signals required by hiring managers.',
                        suggestedKeywords: ['CI/CD', 'GitHub Actions', 'Zero-Downtime'],
                      },
                    ],
                  }),
                },
              ],
            },
          },
        ],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockHackyAiStructuredResponse,
      });

      const service = new GeminiRecommendationService('AIzaSyValidHackyKey');
      const result = await service.generateRecommendations({
        resumeText: sampleCandidateResume,
        jobDescription: sampleTargetJobDescription,
        targetRole: 'Senior Platform Engineer',
      });

      // Verify masking: IDs start with hacky-rec-, not gemini-rec-
      for (const rec of result.recommendations) {
        expect(rec.id).toMatch(/^hacky-rec-/);
        expect(rec.title).not.toContain('Gemini');
      }

      // Verify quality with the quality benchmark evaluator
      const qualityReport = evaluateHackyAiRecommendationsQuality(
        result.recommendations,
        sampleCandidateResume,
        'Senior Platform Engineer',
        sampleTargetJobDescription
      );

      expect(qualityReport.overallScore).toBeGreaterThanOrEqual(92);
      expect(qualityReport.grade).toBe('Tier-1 Elite (Top 1%)');
      expect(qualityReport.passed).toBe(true);
      expect(qualityReport.antiHallucinationPassRate).toBe(100);
      expect(qualityReport.dimensions.sectionIsolation.score).toBe(100);
      expect(qualityReport.dimensions.verbPowerAndDiversity.score).toBeGreaterThanOrEqual(90);
      expect(qualityReport.dimensions.hackyAiMasking.score).toBe(100);
    });
  });
});
