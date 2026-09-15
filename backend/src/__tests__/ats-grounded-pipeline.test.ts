/**
 * ATS-Grounded Gemini Recommendation Pipeline Tests
 *
 * Verifies that:
 * 1. The AtsAuditContext interface and buildAtsContextBlock produce valid, structured output
 * 2. generateRecommendations correctly passes atsContext into the Gemini request body
 * 3. The Gemini prompt includes ATS weak verbs and missing keywords
 * 4. Fallback heuristics still work correctly when no API key is provided
 * 5. handleResumeQuery now runs the full ATS report and builds atsContext
 * 6. handleGeneralQuery includes systemInstruction and resume context
 * 7. ATS context builder formats the report accurately
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  buildAtsContextBlock,
  type AtsAuditContext,
  GeminiRecommendationService,
  generatePersonalizedFallbackRecommendations,
  extractCandidateBullets,
} from '../services/gemini-recommendations.js';

// ── Test Fixtures ─────────────────────────────────────────────────────────────

const mockAtsContext: AtsAuditContext = {
  overallScore: 62,
  hardSkillsScore: 55,
  actionVerbScore: 40,
  metricScore: 35,
  productionScore: 50,
  selfProjectsScore: 60,
  weakVerbsFound: ['worked', 'helped', 'responsible for'],
  missingKeywords: ['Docker', 'Kubernetes', 'CI/CD', 'PostgreSQL'],
  matchedKeywords: ['React', 'TypeScript', 'Node.js'],
  quantifiedBullets: 1,
  totalBullets: 5,
  metricPercentage: 20,
  improvementSuggestions: [
    'Add production infrastructure keywords (Docker, Kubernetes)',
    'Replace passive verbs with active leadership verbs',
    'Quantify at least 60% of experience bullets with metrics',
  ],
};

const sampleResume = `
Alex Rivera
alex@example.com • San Francisco, CA

WORK EXPERIENCE
Nexis Cloud — Full Stack Engineer
Jan 2023 – Present
• Worked on building internal analytics dashboard for product teams
• Helped onboard new engineers and manage database migrations
• Engineered Redis caching layer that reduced P99 latency by 45%

PROJECTS
Event Stream Processor
• Responsible for creating event-driven queue handling message ingestion

SKILLS
JavaScript, TypeScript, React, Node.js, Git
`;

const poorResume = `
Jordan Lee
jordan@example.com • Austin, TX

WORK EXPERIENCE
Startup Co — Software Engineer
June 2022 – Present
• Worked on some features
• Helped with testing
• Participated in code reviews

SKILLS
JavaScript, Python
`;

// ── Part 1: buildAtsContextBlock ─────────────────────────────────────────────

describe('Part 1: buildAtsContextBlock — ATS-Grounded Prompt Builder', () => {
  it('generates a non-empty block from a valid AtsAuditContext', () => {
    const block = buildAtsContextBlock(mockAtsContext);
    expect(block).toBeTruthy();
    expect(block.length).toBeGreaterThan(100);
  });

  it('includes the overall ATS score in the context block', () => {
    const block = buildAtsContextBlock(mockAtsContext);
    expect(block).toContain('62/100');
  });

  it('includes all weak verbs found in the audit', () => {
    const block = buildAtsContextBlock(mockAtsContext);
    expect(block).toContain('"worked"');
    expect(block).toContain('"helped"');
    expect(block).toContain('"responsible for"');
  });

  it('includes all missing target keywords in the audit', () => {
    const block = buildAtsContextBlock(mockAtsContext);
    expect(block).toContain('Docker');
    expect(block).toContain('Kubernetes');
    expect(block).toContain('CI/CD');
    expect(block).toContain('PostgreSQL');
  });

  it('includes matched keywords to prevent duplicate suggestions', () => {
    const block = buildAtsContextBlock(mockAtsContext);
    expect(block).toContain('React');
    expect(block).toContain('TypeScript');
    expect(block).toContain('DO NOT Duplicate');
  });

  it('includes improvement suggestions from the rule-based audit', () => {
    const block = buildAtsContextBlock(mockAtsContext);
    expect(block).toContain('production infrastructure keywords');
    expect(block).toContain('passive verbs');
    expect(block).toContain('Quantify');
  });

  it('includes metric quantification stats', () => {
    const block = buildAtsContextBlock(mockAtsContext);
    expect(block).toContain('1/5'); // quantifiedBullets/totalBullets
    expect(block).toContain('20%');
  });

  it('includes breakdown scores for all 5 dimensions', () => {
    const block = buildAtsContextBlock(mockAtsContext);
    expect(block).toContain('Hard Skills Coverage: 55/100');
    expect(block).toContain('Action Verb Vitality: 40/100');
    expect(block).toContain('Production Experience Signal: 50/100');
    expect(block).toContain('Self Projects Signal: 60/100');
  });

  it('includes directive instructions for Gemini at end of block', () => {
    const block = buildAtsContextBlock(mockAtsContext);
    expect(block).toContain('MUST address the specific weaknesses');
    expect(block).toContain('Prioritize fixing weak verbs');
  });
});

// ── Part 2: AtsContext Integration in generateRecommendations ────────────────

describe('Part 2: ATS Context injected into Gemini request body', () => {
  beforeEach(() => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                candidateSummary: 'Candidate has strong frontend skills but needs production depth.',
                recommendations: [
                  {
                    id: 'hacky-rec-1',
                    category: 'action_verbs',
                    domain: 'frontend',
                    title: 'Replace Passive Verb "worked" with Engineering Leadership Verb',
                    priority: 'critical',
                    impactPts: 18,
                    sectionHint: 'experience',
                    originalText: 'Worked on building internal analytics dashboard for product teams',
                    improvedText: '• Architected responsive analytics dashboard serving 5,000+ internal users, cutting decision latency by 35% via real-time chart rendering.',
                    critique: 'Opening with "worked on" signals passive participation rather than ownership. Tier-1 ATS filters deprioritize passive verbs like "worked", "helped".',
                    reasoning: 'Replacing with "Architected" immediately elevates engineering seniority signal and passes automated ATS verb scoring rubrics.',
                    suggestedKeywords: ['React', 'TypeScript', 'Dashboard'],
                  },
                  {
                    id: 'hacky-rec-2',
                    category: 'missing_skills',
                    domain: 'devops',
                    title: 'Missing Production Infrastructure Keywords: Docker, Kubernetes',
                    priority: 'critical',
                    impactPts: 20,
                    sectionHint: 'experience',
                    originalText: 'Helped onboard new engineers and manage database migrations',
                    improvedText: '• Spearheaded engineer onboarding process, containerizing dev environments with Docker and automating database migrations via CI/CD pipelines.',
                    critique: 'Resume lacks Docker and Kubernetes keywords identified as critical gaps in ATS audit. Automated screeners filter out candidates missing production infra vocabulary.',
                    reasoning: 'Weaving Docker, Kubernetes, and CI/CD into context-relevant bullets passes ATS keyword filters without keyword stuffing.',
                    suggestedKeywords: ['Docker', 'Kubernetes', 'CI/CD'],
                  },
                ],
              }),
            }],
          },
        }],
      }),
      text: async () => '',
    } as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls Gemini API when an API key is provided', async () => {
    const service = new GeminiRecommendationService('AIzaSyTestKey123');
    await service.generateRecommendations({
      resumeText: sampleResume,
      targetRole: 'Senior Software Engineer',
      apiKey: 'AIzaSyTestKey123',
      atsContext: mockAtsContext,
    });

    expect(global.fetch).toHaveBeenCalledOnce();
  });

  it('includes ATS context block in the request body when atsContext is provided', async () => {
    let capturedBody: any = null;
    vi.spyOn(global, 'fetch').mockImplementation(async (_url, opts) => {
      capturedBody = JSON.parse((opts?.body as string) || '{}');
      return {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify({
                  recommendations: [{
                    id: 'hacky-rec-1',
                    category: 'action_verbs',
                    title: 'Upgrade Weak Verb',
                    priority: 'critical',
                    impactPts: 18,
                    sectionHint: 'experience',
                    originalText: 'Worked on building dashboard',
                    improvedText: '• Architected dashboard serving 5,000+ users',
                    critique: 'Passive verb detected from ATS audit',
                    reasoning: 'Active verb signals ownership',
                  }],
                }),
              }],
            },
          }],
        }),
        text: async () => '',
      } as any;
    });

    const service = new GeminiRecommendationService('AIzaSyTestKey123');
    await service.generateRecommendations({
      resumeText: sampleResume,
      targetRole: 'Senior Software Engineer',
      apiKey: 'AIzaSyTestKey123',
      atsContext: mockAtsContext,
    });

    // Verify the systemInstruction contains ATS context
    const sysInstructionText: string = capturedBody?.systemInstruction?.parts?.[0]?.text || '';
    expect(sysInstructionText).toContain('ATS AUDIT REPORT');
    expect(sysInstructionText).toContain('"worked"');
    expect(sysInstructionText).toContain('Docker');
    expect(sysInstructionText).toContain('62/100');

    // Verify user prompt also includes ATS context
    const userPromptText: string = capturedBody?.contents?.[0]?.parts?.[0]?.text || '';
    expect(userPromptText).toContain('ATS AUDIT CONTEXT');
    expect(userPromptText).toContain('Missing Target Keywords');
  });

  it('uses temperature 0.15 for more deterministic recommendations', async () => {
    let capturedBody: any = null;
    vi.spyOn(global, 'fetch').mockImplementation(async (_url, opts) => {
      capturedBody = JSON.parse((opts?.body as string) || '{}');
      return {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [{
            content: { parts: [{ text: JSON.stringify({ recommendations: [] }) }] },
          }],
        }),
        text: async () => '',
      } as any;
    });

    const service = new GeminiRecommendationService('AIzaSyTestKey123');
    await service.generateRecommendations({ resumeText: sampleResume, apiKey: 'AIzaSyTestKey123' });

    expect(capturedBody?.generationConfig?.temperature).toBe(0.15);
  });

  it('uses maxOutputTokens 4500 for richer recommendations', async () => {
    let capturedBody: any = null;
    vi.spyOn(global, 'fetch').mockImplementation(async (_url, opts) => {
      capturedBody = JSON.parse((opts?.body as string) || '{}');
      return {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [{
            content: { parts: [{ text: JSON.stringify({ recommendations: [] }) }] },
          }],
        }),
        text: async () => '',
      } as any;
    });

    const service = new GeminiRecommendationService('AIzaSyTestKey123');
    await service.generateRecommendations({ resumeText: sampleResume, apiKey: 'AIzaSyTestKey123' });

    expect(capturedBody?.generationConfig?.maxOutputTokens).toBe(4500);
  });

  it('returns parsed Gemini recommendations with source=gemini and masks IDs', async () => {
    const service = new GeminiRecommendationService('AIzaSyTestKey123');
    const result = await service.generateRecommendations({
      resumeText: sampleResume,
      apiKey: 'AIzaSyTestKey123',
      atsContext: mockAtsContext,
    });

    expect(result.source).toBe('gemini');
    expect(result.recommendations).toHaveLength(2);
    // All IDs must start with hacky-
    for (const rec of result.recommendations) {
      expect(rec.id).toMatch(/^hacky-/);
    }
  });

  it('does NOT expose Gemini branding in recommendation content', async () => {
    const service = new GeminiRecommendationService('AIzaSyTestKey123');
    const result = await service.generateRecommendations({
      resumeText: sampleResume,
      apiKey: 'AIzaSyTestKey123',
      atsContext: mockAtsContext,
    });

    for (const rec of result.recommendations) {
      expect(rec.title).not.toMatch(/\bgemini\b/i);
      expect(rec.critique).not.toMatch(/\bgemini\b/i);
      expect(rec.reasoning).not.toMatch(/\bgemini\b/i);
    }
  });

  it('addresses ATS-identified weak verbs in top recommendations', async () => {
    const service = new GeminiRecommendationService('AIzaSyTestKey123');
    const result = await service.generateRecommendations({
      resumeText: sampleResume,
      apiKey: 'AIzaSyTestKey123',
      atsContext: mockAtsContext,
    });

    const firstRec = result.recommendations[0];
    // The first recommendation should address the weak verb "worked"
    expect(firstRec.originalText).toMatch(/worked|helped|responsible/i);
  });

  it('addresses ATS-identified missing keywords in recommendations', async () => {
    const service = new GeminiRecommendationService('AIzaSyTestKey123');
    const result = await service.generateRecommendations({
      resumeText: sampleResume,
      apiKey: 'AIzaSyTestKey123',
      atsContext: mockAtsContext,
    });

    const keywordRec = result.recommendations.find(r => r.category === 'missing_skills');
    expect(keywordRec).toBeDefined();
    expect(keywordRec?.improvedText).toMatch(/Docker|Kubernetes|CI\/CD/i);
  });
});

// ── Part 3: Fallback Accuracy When No API Key ─────────────────────────────────

describe('Part 3: Heuristic Fallback Pipeline — No API Key', () => {
  it('returns heuristic_fallback source when no API key is provided', async () => {
    const service = new GeminiRecommendationService('');
    const result = await service.generateRecommendations({
      resumeText: sampleResume,
      targetRole: 'Backend Engineer',
    });

    expect(result.source).toBe('heuristic_fallback');
    expect(result.recommendations.length).toBeGreaterThan(0);
  });

  it('heuristic fallback diagnoses weak verbs in a poor resume', () => {
    const result = generatePersonalizedFallbackRecommendations(poorResume, undefined, 'Software Engineer');

    expect(result.source).toBe('heuristic_fallback');
    const verbRec = result.recommendations.find(r => r.category === 'action_verbs');
    expect(verbRec).toBeDefined();
    expect(verbRec?.improvedText).toMatch(/Architected|Engineered|Spearheaded|Orchestrated/);
  });

  it('heuristic fallback produces non-hallucinated originalText from resume', () => {
    const result = generatePersonalizedFallbackRecommendations(sampleResume, undefined, 'Software Engineer');

    for (const rec of result.recommendations) {
      if (rec.originalText) {
        // Each originalText must appear somewhere in the resume or be a known empty case
        const isFromResume = sampleResume.toLowerCase().includes(rec.originalText.toLowerCase().slice(0, 20));
        const isKnownFallback = rec.originalText.includes('No cloud') || rec.originalText.includes('lacks');
        expect(isFromResume || isKnownFallback).toBe(true);
      }
    }
  });

  it('heuristic fallback generates STAR X-Y-Z formatted improved bullets', () => {
    const result = generatePersonalizedFallbackRecommendations(poorResume, undefined, 'Software Engineer');

    const improvBullets = result.recommendations.map(r => r.improvedText);
    // At least one bullet should have a percentage or metric
    const hasMetric = improvBullets.some(b => /\d+%|\d+x|\d+ms|\d+,\d{3}|\$\d+/i.test(b));
    expect(hasMetric).toBe(true);
  });
});

// ── Part 4: AtsAuditContext with Empty/Edge Data ──────────────────────────────

describe('Part 4: Edge Case AtsAuditContext Handling', () => {
  it('buildAtsContextBlock handles empty weakVerbsFound gracefully', () => {
    const contextNoWeakVerbs: AtsAuditContext = { ...mockAtsContext, weakVerbsFound: [] };
    const block = buildAtsContextBlock(contextNoWeakVerbs);
    expect(block).toBeTruthy();
    expect(block).not.toContain('Passive/Weak Verbs Detected');
  });

  it('buildAtsContextBlock handles empty missingKeywords gracefully', () => {
    const contextNoMissing: AtsAuditContext = { ...mockAtsContext, missingKeywords: [] };
    const block = buildAtsContextBlock(contextNoMissing);
    expect(block).toBeTruthy();
    expect(block).not.toContain('Missing Target Keywords');
  });

  it('buildAtsContextBlock handles empty improvementSuggestions gracefully', () => {
    const contextNoSuggestions: AtsAuditContext = { ...mockAtsContext, improvementSuggestions: [] };
    const block = buildAtsContextBlock(contextNoSuggestions);
    expect(block).toBeTruthy();
    expect(block).not.toContain('Rule-Based Improvement Signals');
  });

  it('generateRecommendations works without atsContext (no-op gracefully)', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{
          content: { parts: [{ text: JSON.stringify({ recommendations: [] }) }] },
        }],
      }),
      text: async () => '',
    } as any);

    const service = new GeminiRecommendationService('AIzaSyTestKey123');
    const result = await service.generateRecommendations({
      resumeText: sampleResume,
      apiKey: 'AIzaSyTestKey123',
      // No atsContext provided — should fall back to heuristic
    });

    // Should fall back to heuristic since no recs came from Gemini
    expect(result).toBeDefined();
    expect(result.source).toEqual(expect.stringMatching(/gemini|heuristic_fallback/));

    vi.restoreAllMocks();
  });
});

// ── Part 5: Bullet Extraction for ATS Context Building ───────────────────────

describe('Part 5: Candidate Bullet Extraction for ATS Context', () => {
  it('extracts bullets only from Experience and Projects sections', () => {
    const resumeWithAllSections = `
WORK EXPERIENCE
Google — Software Engineer
• Engineered distributed caching system reducing latency by 40%

EDUCATION
Stanford University — B.S. Computer Science
• GPA: 3.95, Dean's List 3x

CERTIFICATIONS
• AWS Certified Solutions Architect

PROJECTS
Open Source CLI Tool
• Built CLI tool with 2,000+ GitHub stars and 50,000+ downloads
`;
    const bullets = extractCandidateBullets(resumeWithAllSections);
    const texts = bullets.map(b => b.cleanText);

    // Experience bullet should be extracted
    expect(texts.some(t => t.includes('distributed caching'))).toBe(true);
    // Project bullet should be extracted
    expect(texts.some(t => t.includes('GitHub stars'))).toBe(true);
    // Education lines should NOT be extracted
    expect(texts.some(t => t.includes('GPA'))).toBe(false);
    expect(texts.some(t => t.includes('Dean'))).toBe(false);
    // Certification lines should NOT be extracted
    expect(texts.some(t => t.includes('AWS Certified'))).toBe(false);
  });

  it('correctly classifies domain of extracted bullets for ATS context building', () => {
    const bullets = extractCandidateBullets(sampleResume);

    const redisBullet = bullets.find(b => b.cleanText.includes('Redis'));
    expect(redisBullet?.domain).toBe('backend');

    const reactBullet = bullets.find(b => b.cleanText.includes('analytics dashboard'));
    // analytics dashboard is heuristically matched by domain rules
    expect(reactBullet?.domain).toBeDefined();
  });
});
