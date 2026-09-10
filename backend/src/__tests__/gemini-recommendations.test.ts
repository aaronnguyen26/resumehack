import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  extractCandidateBullets,
  generatePersonalizedFallbackRecommendations,
  GeminiRecommendationService,
  getStoredGeminiApiKey,
  setStoredGeminiApiKey,
  testGeminiApiKey,
  STORAGE_KEY_GEMINI_KEY,
} from '../services/gemini-recommendations.js';

describe('Gemini Recommendation Engine Test Suite', () => {
  const sampleResume = `
Alex Rivera
alex.rivera@example.com • San Francisco, CA

WORK EXPERIENCE
Nexis Cloud Systems — Full Stack Engineer
Jan 2023 – Present
• Worked on building the web dashboard for internal analytics
• Engineered distributed Redis caching clusters reducing P99 latency by 55%
• Helped with onboarding new engineers and managing database migrations

PROJECTS
Event Stream Processing Engine
• Responsible for creating an event-driven queue handling message ingestion
• Built Python FastAPI server with PostgreSQL database

SKILLS
JavaScript, TypeScript, React, Node.js, Python, PostgreSQL, Redis, Git
`;

  const sampleJobDescription = `
Senior Platform Engineer
Requirements:
- Strong experience with Docker, Kubernetes, and AWS cloud infrastructure
- Proficiency in Go or TypeScript
- Proven track record with CI/CD deployment pipelines and high availability
- Microservices architecture and distributed caching
`;

  describe('Part 1: Candidate Bullet Extraction & Diagnosis', () => {
    it('extracts real candidate bullets and identifies sections', () => {
      const bullets = extractCandidateBullets(sampleResume);
      expect(bullets.length).toBeGreaterThanOrEqual(4);

      const expBullets = bullets.filter(b => b.section === 'experience');
      expect(expBullets.length).toBeGreaterThanOrEqual(2);

      const projBullets = bullets.filter(b => b.section === 'projects');
      expect(projBullets.length).toBeGreaterThanOrEqual(1);
    });

    it('correctly detects weak passive verbs in real candidate bullets', () => {
      const bullets = extractCandidateBullets(sampleResume);
      const weakVerbBullets = bullets.filter(b => b.hasWeakVerb);

      expect(weakVerbBullets.length).toBeGreaterThanOrEqual(2);
      expect(weakVerbBullets.some(b => b.cleanText.includes('Worked on building'))).toBe(true);
      expect(weakVerbBullets.some(b => b.cleanText.includes('Responsible for creating'))).toBe(true);
    });

    it('correctly detects quantified metrics in candidate bullets', () => {
      const bullets = extractCandidateBullets(sampleResume);
      const quantifiedBullets = bullets.filter(b => b.hasMetric);

      expect(quantifiedBullets.length).toBeGreaterThanOrEqual(1);
      expect(quantifiedBullets[0].cleanText).toContain('55%');
    });
  });

  describe('Part 2: Smart Personalized Heuristic Fallback Engine', () => {
    it('generates recommendations directly quoting the candidate ACTUAL bullets', () => {
      const result = generatePersonalizedFallbackRecommendations(sampleResume, sampleJobDescription);

      expect(result.source).toBe('heuristic_fallback');
      expect(result.recommendations.length).toBeGreaterThanOrEqual(3);

      // Verify that recommendations quote the user's actual text
      const originalTexts = result.recommendations.map(r => r.originalText);
      const matchedUserBullet = originalTexts.some(
        text => sampleResume.includes(text) || text.includes('Worked on building') || text.includes('Responsible for creating')
      );
      expect(matchedUserBullet).toBe(true);
    });

    it('replaces weak verbs with high-impact engineering leadership verbs', () => {
      const result = generatePersonalizedFallbackRecommendations(sampleResume, sampleJobDescription);
      const verbRec = result.recommendations.find(r => r.category === 'action_verbs');

      expect(verbRec).toBeDefined();
      expect(verbRec?.originalText).toContain('Worked on building');
      expect(verbRec?.improvedText).toMatch(/Spearheaded|Architected/i);
      expect(verbRec?.critique).toContain('passive');
    });

    it('upgrades unquantified bullets with STAR impact and latency/throughput metrics', () => {
      const result = generatePersonalizedFallbackRecommendations(sampleResume, sampleJobDescription);
      const quantRec = result.recommendations.find(r => r.category === 'star_quantification');

      expect(quantRec).toBeDefined();
      expect(quantRec?.improvedText).toMatch(/\d+%/);
      expect(quantRec?.priority).toBe('critical');
      expect(quantRec?.impactPts).toBeGreaterThanOrEqual(12);
    });

    it('identifies missing skills from the job description and suggests contextual integration', () => {
      const result = generatePersonalizedFallbackRecommendations(sampleResume, sampleJobDescription);
      const skillRec = result.recommendations.find(r => r.category === 'missing_skills');

      expect(skillRec).toBeDefined();
      expect(skillRec?.suggestedKeywords).toEqual(
        expect.arrayContaining(['Docker', 'Kubernetes', 'AWS'])
      );
      expect(skillRec?.improvedText).toMatch(/Docker|Kubernetes|AWS/);
    });
  });

  describe('Part 3: Gemini API Service & Cascading Fallback', () => {
    let originalFetch: typeof global.fetch;

    beforeEach(() => {
      originalFetch = global.fetch;
    });

    afterEach(() => {
      global.fetch = originalFetch;
      vi.restoreAllMocks();
    });

    it('successfully calls Gemini API with structured JSON output and formats recommendations', async () => {
      const mockGeminiResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    candidateSummary: 'Strong full-stack foundations with distributed caching experience.',
                    recommendations: [
                      {
                        id: 'gemini-rec-1',
                        category: 'star_quantification',
                        title: 'Quantify Analytics Dashboard User Engagement & Latency',
                        priority: 'critical',
                        impactPts: 18,
                        sectionHint: 'experience',
                        originalText: 'Worked on building the web dashboard for internal analytics',
                        improvedText: '• Architected real-time internal analytics web portal using React & TypeScript, supporting 450+ daily active engineers and cutting report generation latency by 62%.',
                        critique: 'Passive verb "Worked on" and lacks scale or user adoption metrics.',
                        reasoning: 'Demonstrating engineer adoption and concrete latency gains proves high business impact.',
                        suggestedKeywords: ['React', 'TypeScript', 'Analytics'],
                      },
                      {
                        id: 'gemini-rec-2',
                        category: 'production_scale',
                        title: 'Incorporate Cloud Native CI/CD & Kubernetes Signals',
                        priority: 'high',
                        impactPts: 15,
                        sectionHint: 'experience',
                        originalText: 'Helped with onboarding new engineers and managing database migrations',
                        improvedText: '• Automated database migrations with zero-downtime rolling deployments via Kubernetes and GitHub Actions CI/CD; authored onboarding runbooks accelerating team ramp-up by 40%.',
                        critique: 'Mentions database migrations without modern automation, zero-downtime execution, or CI/CD.',
                        reasoning: 'Validates production reliability standards required for Senior/Staff roles.',
                        suggestedKeywords: ['Kubernetes', 'CI/CD', 'Zero-Downtime'],
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
        json: async () => mockGeminiResponse,
      });

      const service = new GeminiRecommendationService('test-gemini-key');
      const result = await service.generateRecommendations({
        resumeText: sampleResume,
        jobDescription: sampleJobDescription,
        targetRole: 'Senior Platform Engineer',
      });

      expect(result.source).toBe('gemini');
      expect(result.modelUsed).toBe('gemini-2.0-flash');
      expect(result.recommendations.length).toBe(2);
      expect(result.recommendations[0].title).toContain('Quantify Analytics Dashboard');
      expect(result.recommendations[0].improvedText).toContain('Architected real-time internal analytics');
      expect(result.recommendations[1].improvedText).toContain('Automated database migrations');
    });

    it('cascades to fallback model if primary model returns 503 high demand', async () => {
      const mockGeminiResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    candidateSummary: 'Candidate with good backend skills.',
                    recommendations: [
                      {
                        id: 'gemini-fallback-1',
                        category: 'systems_depth',
                        title: 'Highlight Event Stream Concurrency & Throughput',
                        priority: 'critical',
                        impactPts: 20,
                        sectionHint: 'projects',
                        originalText: 'Responsible for creating an event-driven queue handling message ingestion',
                        improvedText: '• Engineered concurrent event-driven message streaming queue in Go processing 25,000+ msgs/sec with zero message loss.',
                        critique: 'Lacks throughput numbers and architectural guarantees.',
                        reasoning: 'Proves high-concurrency systems design capabilities.',
                      },
                    ],
                  }),
                },
              ],
            },
          },
        ],
      };

      let callCount = 0;
      global.fetch = vi.fn().mockImplementation(async (url: string) => {
        callCount++;
        if (callCount === 1) {
          // Fail primary model with 503
          return {
            ok: false,
            status: 503,
            text: async () => 'Model is temporarily overloaded (high demand)',
          };
        }
        // Succeed on fallback model
        return {
          ok: true,
          status: 200,
          json: async () => mockGeminiResponse,
        };
      });

      const service = new GeminiRecommendationService('test-gemini-key');
      const result = await service.generateRecommendations({
        resumeText: sampleResume,
        jobDescription: sampleJobDescription,
      });

      expect(result.source).toBe('gemini');
      expect(callCount).toBe(2);
      expect(result.recommendations.length).toBe(1);
      expect(result.recommendations[0].improvedText).toContain('25,000+ msgs/sec');
    });

    it('gracefully falls back to personalized heuristic engine if all Gemini calls fail', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network offline or DNS error'));

      const service = new GeminiRecommendationService('test-gemini-key');
      const result = await service.generateRecommendations({
        resumeText: sampleResume,
        jobDescription: sampleJobDescription,
      });

      expect(result.source).toBe('heuristic_fallback');
      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(result.error).toContain('Network offline');
    });

    it('immediately uses personalized heuristic engine when no API key is provided', async () => {
      const service = new GeminiRecommendationService('');
      const result = await service.generateRecommendations({
        resumeText: sampleResume,
        jobDescription: sampleJobDescription,
        apiKey: '',
      });

      expect(result.source).toBe('heuristic_fallback');
      expect(result.recommendations.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Part 4: Gemini Key Storage & Validation Helpers', () => {
    it('stores and retrieves Gemini API key in localStorage', () => {
      setStoredGeminiApiKey('AIzaSyTestKey12345');
      const retrieved = getStoredGeminiApiKey();
      expect(retrieved).toBe('AIzaSyTestKey12345');
    });

    it('validates empty API key with descriptive error', async () => {
      const check = await testGeminiApiKey('');
      expect(check.valid).toBe(false);
      expect(check.error).toContain('cannot be empty');
    });
  });
});
