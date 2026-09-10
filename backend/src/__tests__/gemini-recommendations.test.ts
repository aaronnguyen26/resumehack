import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  extractCandidateBullets,
  classifyBulletDomain,
  detectRaggedWidow,
  tightenBulletText,
  detectRepetitiveVerbs,
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

  const complexResumeWithEducationAndCerts = `
Minh Nguyen (Aaron)
minh@example.com • Los Angeles, CA

WORK EXPERIENCE
Apex Digital Media — Frontend Engineer
Jan 2024 – Present
• Worked on building customer-facing React components for data visualization
• Implemented client-side caching with Zustand and modern Tailwind styling

PROJECTS
Distributed Algorithms Benchmark Suite
• Formulated algorithms research under faculty mentorship of Professor Dinh
• Built Python simulations analyzing matrix multiplication complexity

EDUCATION
University of Southern California — B.S. in Computer Science
Expected June 2028 • GPA: 3.92 • Dean's Honor Roll
John F. Kennedy High School — High School Diploma
Certification: High School Diploma, IB Bilingual Diploma: 37

CERTIFICATIONS
• AWS Certified Cloud Practitioner
• Meta Certified Frontend Developer
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

  describe('Part 2: Strict Section Isolation & Anti-Leakage Protection', () => {
    it('NEVER extracts education degrees, diplomas, or certifications as experience accomplishment bullets', () => {
      const bullets = extractCandidateBullets(complexResumeWithEducationAndCerts);

      // Verify that education and diploma lines were completely excluded
      const allExtractedText = bullets.map(b => b.cleanText.toLowerCase()).join(' ');

      expect(allExtractedText).not.toContain('high school diploma');
      expect(allExtractedText).not.toContain('ib bilingual diploma');
      expect(allExtractedText).not.toContain("dean's honor roll");
      expect(allExtractedText).not.toContain('aws certified cloud practitioner');

      // Verify that only valid work/project bullets were captured
      expect(bullets.some(b => b.cleanText.includes('customer-facing React components'))).toBe(true);
      expect(bullets.some(b => b.cleanText.includes('algorithms research'))).toBe(true);
    });

    it('ensures fallback recommendations never corrupt or inject engineering metrics into education lines', () => {
      const result = generatePersonalizedFallbackRecommendations(complexResumeWithEducationAndCerts, sampleJobDescription);

      expect(result.recommendations.length).toBeGreaterThanOrEqual(2);

      // Verify that no recommendation targets or outputs a High School Diploma or degree
      for (const rec of result.recommendations) {
        expect(rec.originalText.toLowerCase()).not.toContain('high school diploma');
        expect(rec.originalText.toLowerCase()).not.toContain('bilingual diploma');
        expect(rec.improvedText.toLowerCase()).not.toContain('high school diploma');
        expect(rec.improvedText.toLowerCase()).not.toContain('bilingual diploma');
      }
    });
  });

  describe('Part 3: Domain & Semantic Bullet Classification', () => {
    it('accurately identifies technical domains across bullets', () => {
      expect(classifyBulletDomain('Built responsive React UI components with Tailwind CSS and Redux')).toBe('frontend');
      expect(classifyBulletDomain('Architected PostgreSQL database with Redis caching and REST APIs in Node.js')).toBe('backend');
      expect(classifyBulletDomain('Engineered Swift iOS mobile app with SwiftUI and offline CoreData storage')).toBe('mobile');
      expect(classifyBulletDomain('Deployed Kubernetes clusters on AWS with Docker and GitHub Actions CI/CD')).toBe('devops');
      expect(classifyBulletDomain('Trained PyTorch deep learning models on a 2.5M image dataset for object classification')).toBe('data_ai');
      expect(classifyBulletDomain('Conducted algorithms research under faculty mentorship and co-authored conference paper')).toBe('research_academic');
      expect(classifyBulletDomain('Mentored 4 junior engineers and managed agile sprint backlogs')).toBe('leadership');
    });

    it('assigns detected domains to extracted candidate bullets', () => {
      const bullets = extractCandidateBullets(complexResumeWithEducationAndCerts);
      const reactBullet = bullets.find(b => b.cleanText.includes('React'));
      const researchBullet = bullets.find(b => b.cleanText.includes('research'));

      expect(reactBullet).toBeDefined();
      expect(reactBullet?.domain).toBe('frontend');

      expect(researchBullet).toBeDefined();
      expect(researchBullet?.domain).toBe('research_academic');
    });
  });

  describe('Part 4: Domain-Calibrated Elevation (Zero-Hallucination Guardrails)', () => {
    it('elevates frontend bullets with Web Vitals / UX responsiveness, NOT backend caching', () => {
      const frontendOnlyResume = `
WORK EXPERIENCE
Web Developer — Studio UI
• Built React components for user profile settings
`;
      const result = generatePersonalizedFallbackRecommendations(frontendOnlyResume);
      const quantRec = result.recommendations.find(r => r.category === 'star_quantification');

      expect(quantRec).toBeDefined();
      expect(quantRec?.domain).toBe('frontend');
      // Should mention LCP or client performance, NOT Redis or backend latency
      expect(quantRec?.improvedText).toMatch(/Largest Contentful Paint|LCP|client-side|render|active user/i);
      expect(quantRec?.improvedText).not.toMatch(/redis|database connection pooling/i);
    });

    it('elevates backend bullets with P99 latency and throughput metrics', () => {
      const backendOnlyResume = `
WORK EXPERIENCE
API Engineer — Cloud Corp
• Developed REST APIs with PostgreSQL database
`;
      const result = generatePersonalizedFallbackRecommendations(backendOnlyResume);
      const quantRec = result.recommendations.find(r => r.category === 'star_quantification');

      expect(quantRec).toBeDefined();
      expect(quantRec?.domain).toBe('backend');
      expect(quantRec?.improvedText).toMatch(/latency|throughput|requests|p99/i);
    });

    it('elevates research bullets with academic and benchmark metrics', () => {
      const researchOnlyResume = `
PROJECTS
Theoretical Computer Science
• Conducted algorithms research under faculty mentorship of professor
`;
      const result = generatePersonalizedFallbackRecommendations(researchOnlyResume);
      const quantRec = result.recommendations.find(r => r.category === 'star_quantification');

      expect(quantRec).toBeDefined();
      expect(quantRec?.domain).toBe('research_academic');
      expect(quantRec?.improvedText).toMatch(/findings|attendees|trials|benchmark/i);
    });
  });

  describe('Part 5: Smart Personalized Heuristic Fallback Engine', () => {
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

  describe('Part 6: Gemini API Service & Cascading Fallback', () => {
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
                        domain: 'frontend',
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
                        domain: 'devops',
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
      expect(result.recommendations[0].domain).toBe('frontend');
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
                        domain: 'backend',
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

  describe('Part 7: Gemini Key Storage & Validation Helpers', () => {
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

  describe('Part 8: Ragged Widow Line Budgeting & Repetitive Verb Detection', () => {
    it('accurately identifies ragged widow lines that spill 1-3 words onto a second line', () => {
      const tightLine = 'Built responsive React dashboard with TypeScript.';
      const raggedLine = 'Engineered automated data ingestion microservice with PostgreSQL and Redis caching for analytics.';
      
      expect(detectRaggedWidow(tightLine)).toBe(false);
      expect(detectRaggedWidow(raggedLine)).toBe(true);
    });

    it('tightens verbose bullet phrasing to reclaim single-line canvas budget', () => {
      const verboseBullet = 'Worked in order to be responsible for the development of web portals utilizing multiple different tools.';
      const tightened = tightenBulletText(verboseBullet);

      expect(tightened.length).toBeLessThan(verboseBullet.length - 10);
      expect(tightened).not.toContain('in order to');
      expect(tightened).not.toContain('responsible for the development of');
      expect(tightened).not.toContain('utilizing');
    });

    it('detects repetitive action verbs across extracted candidate bullets', () => {
      const repetitiveResume = `
WORK EXPERIENCE
Software Engineer — Tech Co
• Built internal analytics dashboard for engineering teams
• Built real-time message stream processor with Kafka
• Built automated CI/CD pipeline using GitHub Actions
`;
      const bullets = extractCandidateBullets(repetitiveResume);
      const rep = detectRepetitiveVerbs(bullets);

      expect(rep).toBeDefined();
      expect(rep?.verb).toBe('built');
      expect(rep?.count).toBe(3);
    });

    it('generates line budget and verb variation recommendations in fallback engine', () => {
      const resumeWithRaggedAndRepetition = `
WORK EXPERIENCE
Full Stack Engineer — NextGen
• Built internal analytics dashboard for engineering teams
• Built real-time customer event stream processing queue with Kafka in order to deliver messages to client apps.
`;
      const result = generatePersonalizedFallbackRecommendations(resumeWithRaggedAndRepetition);

      // Should contain verb repetition recommendation
      const repRec = result.recommendations.find(r => r.title.includes('Action Verb Repetition'));
      expect(repRec).toBeDefined();
      expect(repRec?.improvedText).toMatch(/Architected|Engineered|Spearheaded/);

      // Should contain brevity line budget recommendation
      const brevityRec = result.recommendations.find(r => r.category === 'brevity_line_budget');
      expect(brevityRec).toBeDefined();
      expect(brevityRec?.title).toContain('Ragged Widow');
      expect(brevityRec?.improvedText).not.toContain('in order to');
    });
  });
});
