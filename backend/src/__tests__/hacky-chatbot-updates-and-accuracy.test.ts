import { describe, it, expect, vi } from 'vitest';
import {
  HackyChatbotService,
  calculateAccurateMetrics,
  calculateAccurateLineBudget,
  calculateAccurateAtsScore,
  extractSkillsFromText,
} from '../services/hacky-chatbot.js';
import { ChatbotContext, ApplicantProfile } from '../types/index.js';

const SAMPLE_RESUME = `
Minh Nguyen (Aaron)
Software Engineer | San Francisco, CA | aaron@example.com | (555) 123-4567 | 3.9 GPA

EDUCATION
University of Southern California
B.S. in Computer Science | June 2026

TECHNICAL SKILLS
Languages & Frameworks: Go, Python, TypeScript, React, Node.js, Next.js
Infrastructure & Tools: Docker, Kubernetes, AWS, Redis, PostgreSQL, Kafka, Git, CI/CD

EXPERIENCE
CloudScale Systems - Software Engineer Intern
June 2024 – August 2024 | San Jose, CA
• Architected distributed Redis caching cluster handling 1,200 QPS across 12 microservices, reducing P99 latency by 45%.
• Streamlined CI/CD deployment pipelines with Docker layer caching, cutting build times by 60% and saving $12K/month in AWS egress costs.
• Authored 45+ unit & integration tests in Go achieving 94% test coverage across core payment processing services.
• Deployed high-throughput Kafka consumers processing 50,000 daily orders with zero data loss.

PROJECTS
Distributed KV Store | Go, Raft, gRPC
• Implemented Raft consensus algorithm supporting leader election in under 150ms across 5 replicated nodes.
• Benchmarked cluster throughput at 15,000 write ops/sec under network partition testing.
`;

describe('Hacky Chatbot Accuracy Engine', () => {
  it('accurately extracts diverse quantified engineering metrics', () => {
    const metrics = calculateAccurateMetrics(SAMPLE_RESUME);

    expect(metrics.totalMetricsFound).toBeGreaterThanOrEqual(8);
    expect(metrics.uniqueMetrics).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/45%/),
        expect.stringMatching(/60%/),
        expect.stringMatching(/1,200\s*QPS/i),
        expect.stringMatching(/\$12K\/month/i),
        expect.stringMatching(/45\+\s*unit/i),
        expect.stringMatching(/94%/),
        expect.stringMatching(/150ms/i),
        expect.stringMatching(/50,000\s*daily\s*orders/i),
      ])
    );
    expect(metrics.quantifiedBullets).toBeGreaterThanOrEqual(5);
    expect(metrics.metricPercentage).toBeGreaterThanOrEqual(70);
  });

  it('accurately calculates line budget with character wrapping and section spacing', () => {
    const budget = calculateAccurateLineBudget(SAMPLE_RESUME);

    expect(budget.totalLines).toBeGreaterThan(20);
    expect(budget.totalLines).toBeLessThanOrEqual(54);
    expect(budget.fitsOnePage).toBe(true);
    expect(budget.budgetRecommendation).toContain('Optimal 1-page line budget');
  });

  it('detects overflow when resume exceeds single-page capacity', () => {
    const longResume = Array(30)
      .fill('• Architected massive scale distributed systems handling millions of concurrent requests across multi-region cloud infrastructure with high availability.')
      .join('\n');
    const budget = calculateAccurateLineBudget(longResume);

    expect(budget.totalLines).toBeGreaterThan(54);
    expect(budget.fitsOnePage).toBe(false);
    expect(budget.budgetRecommendation).toContain('Exceeds single-page budget');
  });

  it('accurately extracts technical skills from dictionary', () => {
    const skills = extractSkillsFromText(SAMPLE_RESUME);

    expect(skills).toEqual(
      expect.arrayContaining(['Go', 'Python', 'TypeScript', 'React', 'Node.js', 'Redis', 'Docker', 'Kubernetes', 'AWS', 'Kafka'])
    );
  });

  it('calculates dynamic ATS score without falling back to hardcoded 75%', () => {
    const score = calculateAccurateAtsScore(SAMPLE_RESUME, 'Software Engineer');

    expect(score).toBeGreaterThan(0);
    expect(score).toBeGreaterThanOrEqual(60);
    expect(typeof score).toBe('number');
  });

  it('preserves user-provided ATS score if already calibrated', () => {
    const score = calculateAccurateAtsScore(SAMPLE_RESUME, 'Software Engineer', 88);
    expect(score).toBe(88);
  });
});

describe('Hacky Chatbot Intent Detection & Information Updates', () => {
  const chatbot = new HackyChatbotService();

  it('detects information update intents correctly', () => {
    expect(chatbot.detectIntent('Update my target role to Staff Systems Engineer')).toBe('update_info');
    expect(chatbot.detectIntent('Here is my resume:\n' + SAMPLE_RESUME)).toBe('update_info');
    expect(chatbot.detectIntent('Add Go, Rust, and Kubernetes to my skills')).toBe('update_info');
    expect(chatbot.detectIntent('Add this bullet: Architected Redis cache reducing latency by 45%')).toBe('update_info');
    expect(chatbot.detectIntent('Update my email to aaron@example.com')).toBe('update_info');
    expect(chatbot.detectIntent('What is my current info?')).toBe('update_info');
    expect(chatbot.detectIntent('Show my profile')).toBe('update_info');
  });

  it('handles resume update and re-scoring via chat', async () => {
    const onUpdateResumeText = vi.fn();
    const context: ChatbotContext = {
      resumeText: '',
      targetRole: 'Distributed Systems Engineer',
      onUpdateResumeText,
    };

    const reply = await chatbot.processUserMessage(
      'Here is my updated resume:\n' + SAMPLE_RESUME,
      context
    );

    expect(onUpdateResumeText).toHaveBeenCalledWith(expect.stringContaining('CloudScale Systems'));
    expect(reply.sender).toBe('hacky');
    expect(reply.dataCard?.type).toBe('info_updated');
    expect(reply.dataCard?.updateType).toBe('resume');
    expect(reply.dataCard?.metrics?.score).toBeGreaterThan(60);
    expect(reply.updatedInfo?.type).toBe('resume');
    expect(reply.updatedInfo?.newResumeText).toContain('CloudScale Systems');
  });

  it('handles target role update and ATS re-calibration via chat', async () => {
    const onUpdateApplicantProfile = vi.fn();
    const context: ChatbotContext = {
      resumeText: SAMPLE_RESUME,
      applicantProfile: {
        firstName: 'Aaron',
        lastName: 'Nguyen',
        targetRole: 'Frontend Developer',
      } as ApplicantProfile,
      onUpdateApplicantProfile,
    };

    const reply = await chatbot.processUserMessage(
      'Update my target role to Senior Backend Engineer',
      context
    );

    expect(onUpdateApplicantProfile).toHaveBeenCalledWith({
      targetRole: 'Senior Backend Engineer',
    });
    expect(reply.text).toContain('Senior Backend Engineer');
    expect(reply.dataCard?.type).toBe('info_updated');
    expect(reply.dataCard?.updateType).toBe('target_role');
    expect(reply.updatedInfo?.updatedProfile?.targetRole).toBe('Senior Backend Engineer');
  });

  it('handles skills addition via chat', async () => {
    const onUpdateApplicantProfile = vi.fn();
    const context: ChatbotContext = {
      applicantProfile: {
        firstName: 'Aaron',
        skills: ['TypeScript', 'React'],
      } as ApplicantProfile,
      onUpdateApplicantProfile,
    };

    const reply = await chatbot.processUserMessage(
      'Add Go, Kubernetes, and Terraform to my skills',
      context
    );

    expect(onUpdateApplicantProfile).toHaveBeenCalledWith({
      skills: expect.arrayContaining(['TypeScript', 'React', 'Go', 'Kubernetes', 'Terraform']),
    });
    expect(reply.text).toContain('Go, Kubernetes, Terraform');
    expect(reply.dataCard?.type).toBe('info_updated');
    expect(reply.dataCard?.updateType).toBe('skills');
  });

  it('handles bullet addition to resume and computes new metrics', async () => {
    const onUpdateResumeText = vi.fn();
    const context: ChatbotContext = {
      resumeText: SAMPLE_RESUME,
      onUpdateResumeText,
    };

    const reply = await chatbot.processUserMessage(
      'Add this bullet: Engineered real-time WebSocket ingestion handling 80,000 msgs/sec with 99.99% uptime.',
      context
    );

    expect(onUpdateResumeText).toHaveBeenCalledWith(
      expect.stringContaining('Engineered real-time WebSocket ingestion handling 80,000 msgs/sec')
    );
    expect(reply.dataCard?.type).toBe('info_updated');
    expect(reply.dataCard?.updateType).toBe('bullet');
    expect(reply.text).toContain('80,000 msgs/sec');
  });

  it('handles profile contact fields update via chat', async () => {
    const onUpdateApplicantProfile = vi.fn();
    const context: ChatbotContext = {
      applicantProfile: {
        firstName: 'Aaron',
      } as ApplicantProfile,
      onUpdateApplicantProfile,
    };

    const reply = await chatbot.processUserMessage(
      'Update my name to Minh Nguyen and update my email to minh@uscalumni.edu and update my location to San Francisco, CA',
      context
    );

    expect(onUpdateApplicantProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        firstName: 'Minh',
        lastName: 'Nguyen',
        email: 'minh@uscalumni.edu',
        location: 'San Francisco, CA',
      })
    );
    expect(reply.dataCard?.type).toBe('info_updated');
  });

  it('returns profile summary card when asked "What is my current info?"', async () => {
    const context: ChatbotContext = {
      resumeText: SAMPLE_RESUME,
      applicantProfile: {
        firstName: 'Minh',
        lastName: 'Nguyen',
        fullName: 'Minh Nguyen',
        targetRole: 'Software Engineer',
        email: 'minh@example.com',
        location: 'San Francisco, CA',
        school: 'University of Southern California',
        gradMonthYear: 'May 2026',
        skills: ['Go', 'TypeScript', 'Kubernetes'],
      } as ApplicantProfile,
    };

    const reply = await chatbot.processUserMessage('What is my current info?', context);

    expect(reply.dataCard?.type).toBe('profile_summary');
    expect(reply.dataCard?.fullName).toBe('Minh Nguyen');
    expect(reply.dataCard?.targetRole).toBe('Software Engineer');
    expect(reply.dataCard?.resumeLoaded).toBe(true);
    expect(reply.dataCard?.resumeStats?.metricsCount).toBeGreaterThanOrEqual(8);
    expect(reply.dataCard?.resumeStats?.score).toBeGreaterThan(60);
    expect(reply.text).toContain('Minh Nguyen');
    expect(reply.text).toContain('Software Engineer');
  });

  it('handleResumeQuery produces accurate numbers and personalized recommendations', async () => {
    const context: ChatbotContext = {
      resumeText: SAMPLE_RESUME,
      targetRole: 'Software Engineer',
    };

    const reply = chatbot.handleResumeQuery('How is my resume doing?', context);

    expect(reply.dataCard?.type).toBe('resume_summary');
    expect(reply.dataCard?.metricsCount).toBeGreaterThanOrEqual(8);
    expect(reply.dataCard?.lineCount).toBeGreaterThan(20);
    expect(reply.dataCard?.score).toBeGreaterThan(50);
    expect(reply.dataCard?.topStrengths?.length).toBeGreaterThan(0);
    expect(reply.text).toContain('verified metrics');
    expect(reply.text).toContain('lines');
  });
});
