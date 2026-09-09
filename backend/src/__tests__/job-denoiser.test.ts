import { describe, it, expect } from 'vitest';
import { JobDeNoiserService } from '../services/job-denoiser.js';

describe('Phase 2: Job Description De-Noiser & Semantic Skill Graph Engine', () => {
  const denoiser = new JobDeNoiserService();

  const noisyJobPosting = `
Software Engineer, Distributed Systems | Netflix
Location: Los Gatos, CA / Remote

About Netflix:
Netflix is the world's leading streaming entertainment service with over 260 million paid memberships.

Requirements:
• 3+ years of experience with Go, Java, or Python.
• Strong expertise in high throughput distributed systems and caching architectures.
• Hands-on experience with Kubernetes, Docker, and AWS cloud infrastructure.
• Experience with relational databases like PostgreSQL.

Responsibilities:
• Architect scalable microservices handling millions of concurrent streaming sessions.
• Optimize caching and database query performance.

Benefits & Perks:
At Netflix, we offer competitive salaries and comprehensive benefits:
- 401(k) retirement plan with company match
- Unlimited PTO and flexible work arrangements
- Full medical, dental, and vision insurance
- Parental leave and fertility benefits

Equal Employment Opportunity:
Netflix is an equal opportunity employer. All qualified applicants will receive consideration for employment without regard to race, color, religion, sex, national origin, protected veteran status, disability status, or any other characteristic protected by law.
This job description is subject to change. Salary range: $180,000 - $350,000.
`;

  it('strips non-evaluative EEO statements, perks, and compensation noise', () => {
    const report = denoiser.denoise(noisyJobPosting);

    // Verify noise was cleanly removed
    expect(report.cleanDescription).not.toContain('401(k) retirement plan');
    expect(report.cleanDescription).not.toContain('All qualified applicants will receive consideration');
    expect(report.cleanDescription).not.toContain('Salary range: $180,000');
    expect(report.noiseReductionRatio).toBeGreaterThan(0.35);
    expect(report.cleanLength).toBeLessThan(report.originalLength);
  });

  it('preserves core qualifications and responsibilities', () => {
    const report = denoiser.denoise(noisyJobPosting);

    expect(report.cleanDescription).toContain('Go, Java, or Python');
    expect(report.cleanDescription).toContain('Kubernetes, Docker, and AWS');
    expect(report.minimumQualifications.length).toBeGreaterThanOrEqual(2);
    expect(report.coreResponsibilities.length).toBeGreaterThanOrEqual(1);
  });

  it('detects seniority tier accurately from context', () => {
    const seniorJD = `Senior Software Engineer | Stripe\nRequirements: 5+ years experience building cloud systems.`;
    const internJD = `Software Engineering Intern - Summer 2026 | Google\nQualifications: Currently pursuing BS/MS in CS.`;
    const newGradJD = `New Grad Software Engineer (Class of 2026) | Datadog\nQualifications: Recent university graduate.`;

    expect(denoiser.denoise(seniorJD).detectedSeniority).toBe('Senior');
    expect(denoiser.denoise(internJD).detectedSeniority).toBe('Intern');
    expect(denoiser.denoise(newGradJD).detectedSeniority).toBe('New Grad');
  });

  it('expands semantic skill graph from high-level architectural concepts', () => {
    const report = denoiser.denoise(noisyJobPosting);

    // "high throughput", "distributed systems", "caching" should expand into concrete implementations
    expect(report.impliedCompetencies.length).toBeGreaterThan(0);
    const impliedLower = report.impliedCompetencies.map((c) => c.toLowerCase());
    expect(
      impliedLower.some((c) => c.includes('redis') || c.includes('kafka') || c.includes('raft') || c.includes('grpc'))
    ).toBe(true);
  });
});
