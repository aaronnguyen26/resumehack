import { describe, it, expect } from 'vitest';
import { HackyChatbotService } from '../services/hacky-chatbot.js';
import { ChatbotContext, JobPosting, ApplicationRecord } from '../types/index.js';

describe('HackyChatbotService — Conversational Career & Resume Copilot', () => {
  const service = new HackyChatbotService();

  describe('Intent Detection', () => {
    it('accurately identifies resume and ATS queries', () => {
      expect(service.detectIntent('How is my resume doing?')).toBe('resume');
      expect(service.detectIntent('What is my ATS score?')).toBe('resume');
      expect(service.detectIntent('Check my resume')).toBe('resume');
      expect(service.detectIntent('How can I improve my resume and fix line budget?')).toBe('resume');
      expect(service.detectIntent('Do I have enough quantified metrics in my bullets?')).toBe('resume');
    });

    it('accurately identifies job application tracking queries', () => {
      expect(service.detectIntent('How have my jobs been doing?')).toBe('jobs_tracker');
      expect(service.detectIntent('How are my jobs doing?')).toBe('jobs_tracker');
      expect(service.detectIntent('How are my job applications doing?')).toBe('jobs_tracker');
      expect(service.detectIntent('What is the status of my applications?')).toBe('jobs_tracker');
      expect(service.detectIntent('Did I get any interviews?')).toBe('jobs_tracker');
      expect(service.detectIntent('Show me my application pipeline')).toBe('jobs_tracker');
    });

    it('accurately identifies job openings queries', () => {
      expect(service.detectIntent('Are there any new job openings?')).toBe('job_openings');
      expect(service.detectIntent('Any new job openings?')).toBe('job_openings');
      expect(service.detectIntent('What internships are available for Summer 2026?')).toBe('job_openings');
      expect(service.detectIntent('Who is hiring Software Engineers?')).toBe('job_openings');
      expect(service.detectIntent('Find new jobs for me')).toBe('job_openings');
    });

    it('routes general questions to general coaching', () => {
      expect(service.detectIntent('What is the STAR method?')).toBe('general');
      expect(service.detectIntent('How should I prepare for a behavioral interview?')).toBe('general');
    });
  });

  describe('Resume Queries Execution', () => {
    it('returns guidance when no resume text is loaded', async () => {
      const msg = await service.processUserMessage('How is my resume doing?', { resumeText: '' });

      expect(msg.sender).toBe('hacky');
      expect(msg.text).toContain("don't see an active resume loaded");
      expect(msg.actions?.some((a) => a.tab === 'canvas')).toBe(true);
    });

    it('analyzes loaded resume with metrics, skill detection, and line count', async () => {
      const sampleResume = `
Alex Chen
San Francisco, CA • alex@example.com • github.com/alexchen
EDUCATION
University of California, Berkeley — B.S. Computer Science (2025)
EXPERIENCE
Software Engineer Intern — CloudScale (Summer 2024)
• Architected distributed Redis & Dragonfly caching clusters reducing P99 latency by 45% across 12 regions.
• Developed scalable microservices in Python, FastAPI, and Postgres processing 50,000 daily orders.
• Authored 30+ unit and integration tests achieving 94% test coverage.
PROJECTS
Distributed KV Store (Go, Raft)
• Implemented Raft consensus protocol handling node failures with under 150ms leader election.
SKILLS
Languages: Python, Go, TypeScript, Java
Frameworks: React, Docker, Kubernetes, Redis, PostgreSQL
`;
      const context: ChatbotContext = {
        resumeText: sampleResume,
        atsScore: 88,
        applicantProfile: {
          firstName: 'Alex',
          lastName: 'Chen',
          fullName: 'Alex Chen',
          email: 'alex@example.com',
          phone: '555-0199',
          location: 'San Francisco, CA',
          linkedinUrl: 'https://linkedin.com/in/alexchen',
          githubUrl: 'https://github.com/alexchen',
          school: 'UC Berkeley',
          degree: 'B.S.',
          major: 'Computer Science',
          gradMonthYear: 'May 2025',
          workAuthorization: 'US_CITIZEN',
          requiresVisaSponsorship: false,
        },
      };

      const msg = await service.processUserMessage('How is my resume doing?', context);

      expect(msg.sender).toBe('hacky');
      expect(msg.text).toContain('88%');
      expect(msg.dataCard?.type).toBe('resume_summary');
      if (msg.dataCard?.type === 'resume_summary') {
        expect(msg.dataCard.score).toBe(88);
        expect(msg.dataCard.metricsCount).toBeGreaterThanOrEqual(2);
        expect(msg.dataCard.skillsCount).toBeGreaterThan(0);
      }
      expect(msg.actions?.some((a) => a.tab === 'canvas')).toBe(true);
    });
  });

  describe('Job Tracker Queries Execution ("how their jobs have been doing")', () => {
    it('provides onboarding prompt when tracker is empty', async () => {
      const msg = await service.processUserMessage('How are my jobs doing?', { applications: [] });

      expect(msg.text).toContain("don't have any applications tracked");
      expect(msg.actions?.some((a) => a.tab === 'discovery')).toBe(true);
    });

    it('summarizes pipeline health, active interviews, and conversion rate', async () => {
      const applications: ApplicationRecord[] = [
        {
          id: 'app-1',
          jobId: 'job-1',
          company: 'Stripe',
          title: 'Software Engineer Intern',
          location: 'San Francisco, CA',
          status: 'Interviewing',
          jobUrl: 'https://stripe.com/jobs/1',
          appliedDate: '2026-09-01',
          updatedAt: '2026-09-05',
        },
        {
          id: 'app-2',
          jobId: 'job-2',
          company: 'Datadog',
          title: 'Backend Engineering Intern',
          location: 'New York, NY',
          status: 'Applied',
          jobUrl: 'https://datadoghq.com/jobs/2',
          appliedDate: '2026-09-02',
          updatedAt: '2026-09-02',
        },
        {
          id: 'app-3',
          jobId: 'job-3',
          company: 'Google',
          title: 'Software Engineer',
          location: 'Mountain View, CA',
          status: 'Bookmarked',
          jobUrl: 'https://careers.google.com/jobs/3',
          updatedAt: '2026-09-04',
        },
      ];

      const msg = await service.processUserMessage('How have my jobs been doing?', { applications });

      expect(msg.text).toContain('3 tracked application(s)');
      expect(msg.text).toContain('Interviewing:** 1');
      expect(msg.text).toContain('Applied:** 1');
      expect(msg.text).toContain('Stripe');
      expect(msg.dataCard?.type).toBe('pipeline_summary');
      if (msg.dataCard?.type === 'pipeline_summary') {
        expect(msg.dataCard.total).toBe(3);
        expect(msg.dataCard.interviewing).toBe(1);
        expect(msg.dataCard.applied).toBe(1);
        expect(msg.dataCard.bookmarked).toBe(1);
        expect(msg.dataCard.interviewRate).toBe(50); // 1 interviewing out of 2 submitted
      }
      expect(msg.actions?.some((a) => a.tab === 'tracker')).toBe(true);
    });
  });

  describe('Job Openings Queries Execution ("if there are any new job openings")', () => {
    it('returns top verified job openings with tailor action', async () => {
      const jobs: JobPosting[] = [
        {
          id: 'job-stripe',
          title: 'Software Engineer Intern - Systems',
          company: 'Stripe',
          location: 'San Francisco, CA',
          type: 'Internship',
          url: 'https://stripe.com/jobs',
          source: 'CuratedFeed',
          salaryRange: '$65 - $80 / hr',
          description: 'Build core payments infrastructure and distributed systems.',
        },
        {
          id: 'job-datadog',
          title: 'Backend Software Engineer',
          company: 'Datadog',
          location: 'New York, NY',
          type: 'Internship',
          url: 'https://datadoghq.com/careers',
          source: 'CuratedFeed',
          salaryRange: '$60 - $75 / hr',
          description: 'Scale real-time monitoring and observability platforms.',
        },
      ];

      const msg = await service.processUserMessage('Are there any new job openings?', { jobs });

      expect(msg.text).toContain('Stripe');
      expect(msg.text).toContain('Datadog');
      expect(msg.dataCard?.type).toBe('job_openings');
      if (msg.dataCard?.type === 'job_openings') {
        expect(msg.dataCard.openings.length).toBe(2);
        expect(msg.dataCard.openings[0].company).toBe('Stripe');
      }
      expect(msg.actions?.some((a) => a.action === 'tailor_job')).toBe(true);
      expect(msg.actions?.some((a) => a.tab === 'discovery')).toBe(true);
    });
  });

  describe('General Questions Execution', () => {
    it('answers STAR method question with structured advice', async () => {
      const msg = await service.processUserMessage('Can you explain the STAR method?');
      expect(msg.text).toContain('Situation');
      expect(msg.text).toContain('Task');
      expect(msg.text).toContain('Action');
      expect(msg.text).toContain('Result');
    });
  });
});
