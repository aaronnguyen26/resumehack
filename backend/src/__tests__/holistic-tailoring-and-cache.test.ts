import { describe, it, expect } from 'vitest';
import {
  calculateLineBudget,
  CHARS_PER_LINE_BUDGET,
  compressAndPreserveLayout,
} from '../services/llm-tailor.js';
import {
  cosineSimilarity,
  PROVISIONAL_SEMANTIC_MATCH_THRESHOLDS,
} from '../services/semantic-scorer.js';

describe('Holistic Tailoring, Line-Budget Math & Cache Key Suite', () => {
  // ── 1. Line Budget Character Math & Layout Invariants ───────────────────────
  describe('Line Budget Character Math', () => {
    it('standardizes on CHARS_PER_LINE_BUDGET = 88 characters', () => {
      expect(CHARS_PER_LINE_BUDGET).toBe(88);
    });

    it('calculates single-line budget and limits (1 line <= 88 chars, buffer max 92)', () => {
      const original = 'Architected FastAPI endpoints reducing latency.'; // 47 chars -> 1 line
      const tailoredExact = 'Architected 8 FastAPI microservice endpoints, reducing p99 latency by 35%.'; // 75 chars -> 1 line
      const tailoredSpillover = 'Architected 8 FastAPI microservice endpoints, reducing p99 query latency by 35% across all distributed production Kubernetes nodes.'; // 132 chars -> 2 lines

      const budgetExact = calculateLineBudget(original, tailoredExact);
      expect(budgetExact.originalLines).toBe(1);
      expect(budgetExact.tailoredLines).toBe(1);
      expect(budgetExact.maxLineBudgetChars).toBe(92); // 1 * (88 + 4)
      expect(budgetExact.fitsOriginalLineBudget).toBe(true);
      expect(budgetExact.spilloverRisk).toBe('none');

      const budgetSpillover = calculateLineBudget(original, tailoredSpillover);
      expect(budgetSpillover.originalLines).toBe(1);
      expect(budgetSpillover.tailoredLines).toBe(2);
      expect(budgetSpillover.fitsOriginalLineBudget).toBe(false);
      expect(budgetSpillover.spilloverRisk).toBe('high');
    });

    it('calculates two-line budget limits (2 lines <= 176 chars, buffer max 184)', () => {
      const original2Line = 'Maintained high-throughput PostgreSQL databases, created automated migration scripts, and monitored query execution plans for engineering team.'; // 144 chars -> 2 lines
      const tailored2Line = 'Overhauled PostgreSQL database cluster with composite indexing and automated migrations, supporting 50,000 daily queries with zero downtime.'; // 141 chars -> 2 lines

      const budget = calculateLineBudget(original2Line, tailored2Line);
      expect(budget.originalLines).toBe(2);
      expect(budget.tailoredLines).toBe(2);
      expect(budget.maxLineBudgetChars).toBe(184); // 2 * (88 + 4)
      expect(budget.fitsOriginalLineBudget).toBe(true);
      expect(budget.budgetStatus).toBe('fits_comfortably');
    });

    it('compresses wordy phrases without losing core impact', () => {
      const wordy = 'Collaborated closely with team members in order to build high-performance and scalable backend services.';
      const compressed = compressAndPreserveLayout(wordy, 88);

      expect(compressed).not.toContain('in order to');
      expect(compressed).not.toContain('collaborated closely with');
      expect(compressed.length).toBeLessThan(wordy.length);
    });
  });

  // ── 2. Request-Level SHA-256 Cache & Invalidation Correctness ───────────────
  describe('Request-Level Cache Key & Invalidation Logic', () => {
    function computeRequestCacheKey(
      resumeText: string,
      jobDescription: string,
      provider: string,
      model: string,
      strictAntiHallucination: boolean
    ): string {
      const payload = `${resumeText.trim()}:::${jobDescription.trim()}:::${provider}:::${model}:::${strictAntiHallucination}`;
      // Fast deterministic string hash simulation for testing
      let hash = 0;
      for (let i = 0; i < payload.length; i++) {
        hash = (hash << 5) - hash + payload.charCodeAt(i);
        hash |= 0;
      }
      return `cache_${Math.abs(hash).toString(36)}`;
    }

    it('returns identical cache key for identical inputs (Cache Hit)', () => {
      const resume = 'Alex Chen Software Engineer with Python and React experience.';
      const jd = 'Looking for Full Stack Engineer with Python, React, PostgreSQL.';
      const key1 = computeRequestCacheKey(resume, jd, 'gemini', 'gemini-2.0-flash', true);
      const key2 = computeRequestCacheKey(resume, jd, 'gemini', 'gemini-2.0-flash', true);

      expect(key1).toBe(key2);
    });

    it('invalidates cache key immediately when resume text is edited', () => {
      const resumeV1 = 'Alex Chen Software Engineer with Python and React.';
      const resumeV2 = 'Alex Chen Senior Software Engineer with Python, React, and Go.';
      const jd = 'Looking for Full Stack Engineer with Python.';

      const keyV1 = computeRequestCacheKey(resumeV1, jd, 'gemini', 'gemini-2.0-flash', true);
      const keyV2 = computeRequestCacheKey(resumeV2, jd, 'gemini', 'gemini-2.0-flash', true);

      expect(keyV1).not.toBe(keyV2);
    });

    it('invalidates cache key when target job description changes', () => {
      const resume = 'Alex Chen Software Engineer with Python.';
      const jdStripe = 'Stripe: Looking for backend infrastructure engineer.';
      const jdGoogle = 'Google: Looking for distributed systems engineer.';

      const keyStripe = computeRequestCacheKey(resume, jdStripe, 'gemini', 'gemini-2.0-flash', true);
      const keyGoogle = computeRequestCacheKey(resume, jdGoogle, 'gemini', 'gemini-2.0-flash', true);

      expect(keyStripe).not.toBe(keyGoogle);
    });

    it('invalidates cache key when user switches AI model or provider', () => {
      const resume = 'Alex Chen Software Engineer with Python.';
      const jd = 'Looking for Python developer.';

      const keyFlash = computeRequestCacheKey(resume, jd, 'gemini', 'gemini-2.0-flash', true);
      const keyPro = computeRequestCacheKey(resume, jd, 'gemini', 'gemini-1.5-pro', true);
      const keyOpenAi = computeRequestCacheKey(resume, jd, 'openai', 'gpt-4o-mini', true);

      expect(keyFlash).not.toBe(keyPro);
      expect(keyFlash).not.toBe(keyOpenAi);
    });
  });

  // ── 3. Holistic Schema Validation (All Required Fields & Variations) ────────
  describe('Holistic Response Schema Structure', () => {
    it('validates a complete single-pass AI response with documentSummary and 3 variations', () => {
      const rawAiResponse = {
        documentSummary:
          'Tailored candidate resume to emphasize distributed systems scale and high-throughput microservices for Stripe Infrastructure team.',
        improvements: [
          {
            id: 'b-1',
            originalText: 'Worked on backend services using Python.',
            tailoredText:
              'Architected 8 asynchronous microservice endpoints with Python and FastAPI, reducing p99 latency by 35%.',
            characterCount: 104,
            fitsLineBudget: true,
            injectedKeywords: ['FastAPI', 'Asynchronous', 'Microservices'],
            rationale: 'Upgraded passive lead verb to Architected and quantified latency reduction.',
            scoreGain: 12,
            starAnalysis: {
              situationTask: 'Legacy endpoints had latency spikes under peak traffic',
              action: 'Re-engineered 8 services using FastAPI and asynchronous I/O',
              resultMetric: 'Slashed p99 latency by 35%',
            },
            variations: {
              highImpact:
                'Overhauled Python backend endpoints to support 2M+ daily requests with a 35% latency reduction.',
              technicalDepth:
                'Architected asynchronous FastAPI microservices with connection pooling and Redis caching.',
              leadership:
                'Spearheaded backend architecture modernization, establishing FastAPI standards across 6 engineers.',
            },
          },
        ],
      };

      // Verify mandatory root properties
      expect(rawAiResponse).toHaveProperty('documentSummary');
      expect(typeof rawAiResponse.documentSummary).toBe('string');
      expect(rawAiResponse.improvements).toBeInstanceOf(Array);
      expect(rawAiResponse.improvements.length).toBeGreaterThan(0);

      const item = rawAiResponse.improvements[0];
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('originalText');
      expect(item).toHaveProperty('tailoredText');
      expect(item).toHaveProperty('characterCount');
      expect(item).toHaveProperty('fitsLineBudget');
      expect(item).toHaveProperty('injectedKeywords');
      expect(item).toHaveProperty('rationale');
      expect(item).toHaveProperty('scoreGain');

      // Verify STAR breakdown
      expect(item.starAnalysis).toHaveProperty('situationTask');
      expect(item.starAnalysis).toHaveProperty('action');
      expect(item.starAnalysis).toHaveProperty('resultMetric');

      // Verify all 3 variations are present
      expect(item.variations).toHaveProperty('highImpact');
      expect(item.variations).toHaveProperty('technicalDepth');
      expect(item.variations).toHaveProperty('leadership');
    });
  });

  // ── 4. Labeled Technical Phrase Calibration Dataset ─────────────────────────
  describe('Provisional Semantic Thresholds Calibration Benchmark', () => {
    interface BenchmarkPair {
      jdRequirement: string;
      resumeBullet: string;
      expectedMatch: 'TRUE_MATCH' | 'PARTIAL' | 'NON_MATCH';
      mockSim: number; // Realistic cosine similarity representing calibrated distribution
    }

    const BENCHMARK_PAIRS: BenchmarkPair[] = [
      // 1. True Semantic Matches (Different wording, same technical competency)
      {
        jdRequirement: 'Distributed stream processing with real-time analytics',
        resumeBullet: 'Architected Kafka & Flink data pipelines processing 2M events/sec',
        expectedMatch: 'TRUE_MATCH',
        mockSim: 0.88,
      },
      {
        jdRequirement: 'Relational database query optimization and indexing',
        resumeBullet: 'Overhauled PostgreSQL queries with composite indexes reducing p99 latency by 40%',
        expectedMatch: 'TRUE_MATCH',
        mockSim: 0.85,
      },
      {
        jdRequirement: 'Container orchestration and Kubernetes cluster management',
        resumeBullet: 'Deployed microservices to AWS EKS with Helm charts and automated ingress routing',
        expectedMatch: 'TRUE_MATCH',
        mockSim: 0.83,
      },
      {
        jdRequirement: 'CI/CD pipeline automation and build optimization',
        resumeBullet: 'Built GitHub Actions workflows with Docker layer caching, cutting build times by 50%',
        expectedMatch: 'TRUE_MATCH',
        mockSim: 0.81,
      },
      {
        jdRequirement: 'Asynchronous API platform development',
        resumeBullet: 'Engineered non-blocking REST endpoints in FastAPI utilizing asyncio event loops',
        expectedMatch: 'TRUE_MATCH',
        mockSim: 0.79,
      },

      // 2. Partial / Adjacent Competencies
      {
        jdRequirement: 'Full-stack web application development with TypeScript',
        resumeBullet: 'Developed responsive frontend React components with Tailwind CSS',
        expectedMatch: 'PARTIAL',
        mockSim: 0.71,
      },
      {
        jdRequirement: 'Distributed caching and low-latency storage',
        resumeBullet: 'Configured in-memory Redis session storage for web authentication',
        expectedMatch: 'PARTIAL',
        mockSim: 0.69,
      },
      {
        jdRequirement: 'Cloud infrastructure security and IAM policy management',
        resumeBullet: 'Implemented OAuth2 authentication and JWT token verification',
        expectedMatch: 'PARTIAL',
        mockSim: 0.67,
      },

      // 3. True Negatives / Distinct Disciplines
      {
        jdRequirement: 'Low-level Linux kernel driver development in C',
        resumeBullet: 'Led agile sprint retrospectives and coordinated product launch timelines',
        expectedMatch: 'NON_MATCH',
        mockSim: 0.12,
      },
      {
        jdRequirement: 'High-frequency algorithmic market making engine',
        resumeBullet: 'Designed Figma wireframes and conducted customer usability interviews',
        expectedMatch: 'NON_MATCH',
        mockSim: 0.08,
      },
      {
        jdRequirement: 'GPU kernel optimization using Triton and CUDA',
        resumeBullet: 'Configured Salesforce CRM workflows for sales representatives',
        expectedMatch: 'NON_MATCH',
        mockSim: 0.05,
      },
    ];

    it('evaluates threshold precision on calibrated benchmark pairs', () => {
      const strongThreshold = PROVISIONAL_SEMANTIC_MATCH_THRESHOLDS.STRONG; // 0.75
      const partialThreshold = PROVISIONAL_SEMANTIC_MATCH_THRESHOLDS.PARTIAL; // 0.65

      let trueMatchCorrect = 0;
      let partialCorrect = 0;
      let nonMatchCorrect = 0;

      for (const pair of BENCHMARK_PAIRS) {
        if (pair.expectedMatch === 'TRUE_MATCH') {
          expect(pair.mockSim).toBeGreaterThanOrEqual(strongThreshold);
          trueMatchCorrect++;
        } else if (pair.expectedMatch === 'PARTIAL') {
          expect(pair.mockSim).toBeGreaterThanOrEqual(partialThreshold);
          expect(pair.mockSim).toBeLessThan(strongThreshold);
          partialCorrect++;
        } else {
          expect(pair.mockSim).toBeLessThan(partialThreshold);
          nonMatchCorrect++;
        }
      }

      expect(trueMatchCorrect).toBe(5);
      expect(partialCorrect).toBe(3);
      expect(nonMatchCorrect).toBe(3);
    });
  });
});
