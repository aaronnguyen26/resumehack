/**
 * Ask Hacky Expanded Assistant & Local Tool Test Suite
 *
 * Verifies that:
 * 1. Ask Hacky is a simple, deterministic local assistant tool that does NOT require AI/LLM calls.
 * 2. It does not invoke fetch or burn user API tokens.
 * 3. Expanded capabilities work reliably:
 *    - 7-Factor ATS Breakdown tool
 *    - Passive / Weak Action Verb Scanner & Power Replacements
 *    - Target Keyword Gap Radar
 *    - Rule-based STAR Bullet Transformer (Google X-Y-Z)
 *    - Line Budget & Ragged Widow Optimizer
 *    - Domain-Calibrated Interview Prep Guide
 *    - Job Search & Outreach Strategy Advisor
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HackyChatbot, HackyChatbotService } from '../services/hacky-chatbot.js';
import { ChatbotContext } from '../types/index.js';

const SAMPLE_RESUME = `
Alex Rivera
alex.rivera@example.com | San Francisco, CA | linkedin.com/in/alexrivera

EXPERIENCE
Senior Software Engineer — TechCorp Inc.
Jan 2023 – Present | San Francisco, CA
• Worked on building scalable microservices handling 12,000 requests/sec with 99.9% uptime.
• Helped with onboarding junior engineers and improved documentation.
• Engineered in-memory Redis caching layer that reduced P99 query latency by 45%.
• Responsible for deploying Docker containers to Kubernetes clusters across 3 AWS regions.

Software Engineer — GrowthStartup
Jun 2021 – Dec 2022 | Austin, TX
• Developed automated data ingestion pipelines processing 250,000+ daily events using PostgreSQL.
• Assisted the QA team by creating 85+ end-to-end integration tests achieving 94% test coverage.
• Handled customer migration scripts and cut database downtime from 4 hours to 15 minutes.

SKILLS
Languages: TypeScript, JavaScript, Python, Go, SQL
Frameworks & Tools: React, Node.js, Express, Next.js, Docker, Kubernetes, AWS, Redis, PostgreSQL, Git
`;

describe('Ask Hacky Expanded Assistant — Non-AI Local Tool Architecture', () => {
  let chatbot: HackyChatbotService;
  let fetchSpy: any;

  beforeEach(() => {
    chatbot = new HackyChatbotService();
    fetchSpy = vi.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  // ── Part 1: Zero External AI / LLM Calls ─────────────────────────────────────

  describe('Part 1: Zero External AI / Network Calls', () => {
    it('handleResumeQuery does NOT invoke external fetch/LLM API', async () => {
      const context: ChatbotContext = {
        resumeText: SAMPLE_RESUME,
        targetRole: 'Senior Software Engineer',
      };

      const reply = await chatbot.handleResumeQuery('How is my resume doing?', context);

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(reply.dataCard?.type).toBe('resume_summary');
      expect(reply.dataCard?.score).toBeGreaterThan(60);
      expect(reply.text).toContain('ATS Score');
    });

    it('handleGeneralQuery does NOT invoke external fetch/LLM API', async () => {
      const context: ChatbotContext = {
        resumeText: SAMPLE_RESUME,
        targetRole: 'Senior Software Engineer',
      };

      const reply = await chatbot.handleGeneralQuery('What can you do for me?', context);

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(reply.text).toContain('Ask Hacky');
      expect(reply.actions?.length).toBeGreaterThan(0);
    });

    it('processUserMessage processes queries completely offline without network latency', async () => {
      const context: ChatbotContext = {
        resumeText: SAMPLE_RESUME,
        targetRole: 'Senior Software Engineer',
      };

      const start = Date.now();
      const reply = await chatbot.processUserMessage('Show score breakdown', context);
      const duration = Date.now() - start;

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(duration).toBeLessThan(100); // Instant local execution
      expect(reply.dataCard?.type).toBe('ats_breakdown');
    });
  });

  // ── Part 2: Intent Detection for Expanded Tools ──────────────────────────────

  describe('Part 2: Intent Detection for Expanded Capabilities', () => {
    it('detects ATS score breakdown intents', () => {
      expect(chatbot.detectIntent('Show score breakdown')).toBe('ats_breakdown');
      expect(chatbot.detectIntent('Why is my ATS score 75?')).toBe('ats_breakdown');
      expect(chatbot.detectIntent('Explain my score')).toBe('ats_breakdown');
      expect(chatbot.detectIntent('What are the 7 factors?')).toBe('ats_breakdown');
      expect(chatbot.detectIntent('ATS rubric')).toBe('ats_breakdown');
    });

    it('detects action and passive verb scanner intents', () => {
      expect(chatbot.detectIntent('Find my weak verbs')).toBe('weak_verbs');
      expect(chatbot.detectIntent('What passive verbs do I have?')).toBe('weak_verbs');
      expect(chatbot.detectIntent('Replace weak verbs')).toBe('weak_verbs');
      expect(chatbot.detectIntent('Action verbs audit')).toBe('weak_verbs');
      expect(chatbot.detectIntent('Power verbs')).toBe('weak_verbs');
    });

    it('detects keyword gap and radar intents', () => {
      expect(chatbot.detectIntent('What keywords am I missing?')).toBe('keyword_gap');
      expect(chatbot.detectIntent('Check missing skills')).toBe('keyword_gap');
      expect(chatbot.detectIntent('Keyword gap')).toBe('keyword_gap');
      expect(chatbot.detectIntent('What skills gap do I have?')).toBe('keyword_gap');
    });

    it('detects bullet elevation and STAR transformer intents', () => {
      expect(chatbot.detectIntent('Elevate bullet: worked on frontend React components')).toBe('elevate_bullet');
      expect(chatbot.detectIntent('Transform bullet: built API with Express')).toBe('elevate_bullet');
      expect(chatbot.detectIntent('Rewrite this bullet: helped with database setup')).toBe('elevate_bullet');
      expect(chatbot.detectIntent('bullet: worked on cloud infrastructure')).toBe('elevate_bullet');
    });

    it('detects line budget and ragged widow intents', () => {
      expect(chatbot.detectIntent('Check line budget')).toBe('line_budget');
      expect(chatbot.detectIntent('Will my resume fit on one page?')).toBe('line_budget');
      expect(chatbot.detectIntent('Find ragged widows')).toBe('line_budget');
      expect(chatbot.detectIntent('How many lines is my resume?')).toBe('line_budget');
      expect(chatbot.detectIntent('Trim lines')).toBe('line_budget');
    });

    it('detects interview preparation blueprint intents', () => {
      expect(chatbot.detectIntent('Interview prep')).toBe('interview_prep');
      expect(chatbot.detectIntent('Technical interview questions')).toBe('interview_prep');
      expect(chatbot.detectIntent('Behavioral questions')).toBe('interview_prep');
      expect(chatbot.detectIntent('System design prep')).toBe('interview_prep');
    });

    it('detects job search strategy intents', () => {
      expect(chatbot.detectIntent('Job search strategy')).toBe('job_strategy');
      expect(chatbot.detectIntent('How to get more interviews')).toBe('job_strategy');
      expect(chatbot.detectIntent('Follow-up strategy')).toBe('job_strategy');
      expect(chatbot.detectIntent('Outreach template')).toBe('job_strategy');
    });
  });

  // ── Part 3: Execution and DataCard Output of Expanded Tools ──────────────────

  describe('Part 3: 7-Factor ATS Breakdown Tool', () => {
    it('returns structured ats_breakdown dataCard with factors and top priority', async () => {
      const context: ChatbotContext = {
        resumeText: SAMPLE_RESUME,
        targetRole: 'Senior Software Engineer',
      };

      const reply = await chatbot.processUserMessage('Show score breakdown', context);

      expect(reply.dataCard?.type).toBe('ats_breakdown');
      if (reply.dataCard?.type === 'ats_breakdown') {
        expect(reply.dataCard.overallScore).toBeGreaterThan(50);
        expect(reply.dataCard.factors.length).toBe(6);
        expect(reply.dataCard.topPriority).toBeTruthy();
        expect(reply.dataCard.factors.some(f => f.name === 'Hard Skills Match')).toBe(true);
        expect(reply.dataCard.factors.some(f => f.name === 'Action Verb Vitality')).toBe(true);
        expect(reply.dataCard.factors.some(f => f.name === 'Quantified Metrics')).toBe(true);
      }
      expect(reply.text).toContain('7-Factor ATS Score Breakdown');
    });
  });

  describe('Part 4: Passive & Weak Verb Scanner Tool', () => {
    it('scans resume for passive verbs and suggests executive replacements', async () => {
      const context: ChatbotContext = {
        resumeText: SAMPLE_RESUME,
        targetRole: 'Senior Software Engineer',
      };

      const reply = await chatbot.processUserMessage('Find my weak verbs', context);

      expect(reply.dataCard?.type).toBe('weak_verbs');
      if (reply.dataCard?.type === 'weak_verbs') {
        expect(reply.dataCard.totalWeakCount).toBeGreaterThan(0);
        expect(reply.dataCard.uniqueWeakVerbs.some(v => v.includes('worked') || v.includes('helped') || v.includes('responsible'))).toBe(true);
        expect(reply.dataCard.verbInstances.length).toBeGreaterThan(0);
        // Verify executive replacement is suggested
        const firstInstance = reply.dataCard.verbInstances[0];
        expect(firstInstance.replacement).toMatch(/Architected|Engineered|Spearheaded|Directed|Orchestrated/);
      }
      expect(reply.text).toContain('Action Verb Diagnostic');
    });
  });

  describe('Part 5: Target Keyword Gap Radar Tool', () => {
    it('separates matched vs missing skills for the target role', async () => {
      const context: ChatbotContext = {
        resumeText: SAMPLE_RESUME,
        targetRole: 'Senior Software Engineer',
      };

      const reply = await chatbot.processUserMessage('What keywords am I missing?', context);

      expect(reply.dataCard?.type).toBe('keyword_gap');
      if (reply.dataCard?.type === 'keyword_gap') {
        expect(reply.dataCard.matchedCount).toBeGreaterThan(0);
        expect(reply.dataCard.matchedSkills.some(s => /TypeScript|React|Go|Node|Docker/i.test(s))).toBe(true);
      }
      expect(reply.text).toContain('Keyword Radar');
    });
  });

  describe('Part 6: Rule-Based STAR Bullet Transformer (Google X-Y-Z)', () => {
    it('transforms frontend bullet with Google X-Y-Z formula and metrics', async () => {
      const context: ChatbotContext = { resumeText: SAMPLE_RESUME };
      const reply = await chatbot.processUserMessage('Elevate bullet: worked on frontend React components for user dashboard', context);

      expect(reply.dataCard?.type).toBe('bullet_elevated');
      if (reply.dataCard?.type === 'bullet_elevated') {
        expect(reply.dataCard.domain).toBe('FRONTEND');
        expect(reply.dataCard.elevatedBullet).toMatch(/Architected|Engineered/);
        expect(reply.dataCard.elevatedBullet).toMatch(/\d+%/); // Has metric
        expect(reply.dataCard.improvements.length).toBeGreaterThan(0);
      }
      expect(reply.text).toContain('STAR Bullet Transformation');
      expect(reply.actions?.some(a => a.label === 'Add to My Resume')).toBe(true);
    });

    it('transforms backend bullet with caching and P99 latency metrics', async () => {
      const context: ChatbotContext = { resumeText: SAMPLE_RESUME };
      const reply = await chatbot.processUserMessage('Transform bullet: helped build express api service with postgres', context);

      expect(reply.dataCard?.type).toBe('bullet_elevated');
      if (reply.dataCard?.type === 'bullet_elevated') {
        expect(reply.dataCard.domain).toBe('BACKEND');
        expect(reply.dataCard.elevatedBullet).toMatch(/Engineered/);
        expect(reply.dataCard.elevatedBullet).toMatch(/P99|latency|requests/i);
      }
    });

    it('transforms devops bullet with deployment cycle and SLA metrics', async () => {
      const context: ChatbotContext = { resumeText: SAMPLE_RESUME };
      const reply = await chatbot.processUserMessage('Elevate bullet: handled docker containers and kubernetes clusters', context);

      expect(reply.dataCard?.type).toBe('bullet_elevated');
      if (reply.dataCard?.type === 'bullet_elevated') {
        expect(reply.dataCard.domain).toBe('DEVOPS');
        expect(reply.dataCard.elevatedBullet).toMatch(/Automated/);
        expect(reply.dataCard.elevatedBullet).toMatch(/Kubernetes|downtime|deployment/i);
      }
    });
  });

  describe('Part 7: Line Budget & Ragged Widow Tool', () => {
    it('analyzes line budget and flags single-page fit status', async () => {
      const context: ChatbotContext = { resumeText: SAMPLE_RESUME };
      const reply = await chatbot.processUserMessage('Check line budget', context);

      expect(reply.dataCard?.type).toBe('line_budget_detail');
      if (reply.dataCard?.type === 'line_budget_detail') {
        expect(reply.dataCard.totalLines).toBeGreaterThan(10);
        expect(reply.dataCard.fitsOnePage).toBe(true);
      }
      expect(reply.text).toContain('Line Budget Analysis');
    });
  });

  describe('Part 8: Interview Preparation Guide', () => {
    it('provides domain-tailored technical and STAR behavioral blueprints', async () => {
      const context: ChatbotContext = {
        resumeText: SAMPLE_RESUME,
        targetRole: 'Senior Software Engineer',
      };

      const reply = await chatbot.processUserMessage('Interview prep', context);

      expect(reply.text).toContain('Technical & Behavioral Interview Blueprint');
      expect(reply.text).toContain('System Design');
      expect(reply.text).toContain('Behavioral STAR Stories');
      expect(reply.actions?.some(a => a.tab === 'tracker')).toBe(true);
    });
  });

  describe('Part 9: Job Search & Outreach Strategy', () => {
    it('provides outreach templates and application velocity rules', async () => {
      const context: ChatbotContext = {
        resumeText: SAMPLE_RESUME,
        applications: [
          { id: '1', company: 'Google', title: 'SWE', status: 'Applied', dateAdded: '2026-09-01' },
          { id: '2', company: 'Stripe', title: 'Backend', status: 'Interviewing', dateAdded: '2026-09-05' },
        ],
      };

      const reply = await chatbot.processUserMessage('Job search strategy', context);

      expect(reply.text).toContain('Application Strategy Blueprint');
      expect(reply.text).toContain('Application Velocity');
      expect(reply.text).toContain('**1** applied and **1** interviewing');
    });
  });
});
