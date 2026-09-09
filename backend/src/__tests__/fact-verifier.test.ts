import { describe, it, expect } from 'vitest';
import { FactVerificationService } from '../services/fact-verifier.js';

describe('Phase 3: Automated Anti-Hallucination Fact Verification Engine', () => {
  const verifier = new FactVerificationService();

  it('approves fully grounded metrics present in original candidate bullet', () => {
    const original = 'Engineered REST API endpoints in Python reducing latency by 35% for 10k users.';
    const tailored = 'Architected 8 modular RESTful endpoints in Python and FastAPI, reducing latency by 35% across 10k users.';

    const report = verifier.verifyAndSanitize(original, tailored);

    expect(report.isFullyGrounded).toBe(true);
    expect(report.unverifiedClaims.length).toBe(0);
    expect(report.bracketedPlaceholdersCount).toBe(0);
    expect(report.sanitizedText).toBe(tailored);
  });

  it('detects fabricated percentages, latencies, and user volumes not present in original', () => {
    const original = 'Worked on backend API and improved database query performance.';
    const tailored = 'Architected asynchronous microservices with FastAPI and PostgreSQL, slashing query latency by 45% across 250,000 active users.';

    const report = verifier.verifyAndSanitize(original, tailored);

    expect(report.isFullyGrounded).toBe(false);
    expect(report.unverifiedClaims.length).toBeGreaterThanOrEqual(1);
    expect(report.unverifiedClaims.some((c) => c.includes('45%'))).toBe(true);
    expect(report.unverifiedClaims.some((c) => c.includes('250,000'))).toBe(true);
  });

  it('automatically sanitizes unverified metrics into candidate bracketed placeholders', () => {
    const original = 'Built payment processing pipeline in Go.';
    const tailored = 'Engineered distributed payment pipeline in Go processing $5M monthly transaction volume with 99.99% uptime.';

    const report = verifier.verifyAndSanitize(original, tailored);

    expect(report.isFullyGrounded).toBe(false);
    expect(report.bracketedPlaceholdersCount).toBeGreaterThanOrEqual(1);
    // Dollar and percentage values should be converted to placeholders
    expect(report.sanitizedText).toContain('[$X]');
    expect(report.sanitizedText).toContain('[X%]');
    expect(report.sanitizedText).not.toContain('$5M');
    expect(report.sanitizedText).not.toContain('99.99%');
  });
});
