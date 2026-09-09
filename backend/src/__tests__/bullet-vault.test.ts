import { describe, it, expect } from 'vitest';
import { BulletVaultService } from '../services/bullet-vault.js';

describe('Phase 5: Master Profile "Bullet Vault" & Dynamic Job Rebalancer', () => {
  const service = new BulletVaultService();

  const sampleBackendJobDescription = `
    Senior Backend Engineer - Core Infrastructure
    Requirements:
    - 5+ years experience building high-throughput distributed systems in Go or Rust.
    - Deep expertise in Apache Kafka, event-driven architectures, and stream processing.
    - Experience with PostgreSQL query optimization, connection pooling, and Redis caching.
    - Hands-on experience with Kubernetes, Docker, and AWS cloud environments.
    - Proven track record of improving p99 latency and system uptime SLAs.
  `;

  it('accurately calculates line costs and extracts metrics and skills', () => {
    const bullet = service.createBullet({
      rawText: 'Architected distributed event-driven ingestion pipeline in Go and Apache Kafka processing 45k events/sec with sub-50ms p99 latency.',
      companyOrProject: 'CloudScale Inc',
    });

    expect(bullet.lineCost).toBeGreaterThanOrEqual(1);
    expect(bullet.quantifiableMetrics).toContain('45k events/sec');
    expect(bullet.quantifiableMetrics).toContain('50ms');
    expect(bullet.skillTags).toContain('Go');
    expect(bullet.skillTags).toContain('Kafka');
  });

  it('rebalances vault to strictly fit single-page budget against target job', () => {
    const seeds = service.getDefaultSeedBullets();
    expect(seeds.length).toBeGreaterThanOrEqual(8);

    const plan = service.rebalanceForJob(seeds, sampleBackendJobDescription, {
      targetLineBudget: 50,
    });

    // Validates knapsack optimization constraints
    expect(plan.targetLineBudget).toBe(50);
    expect(plan.includedBulletsCount).toBeGreaterThan(0);
    expect(plan.reserveBulletsCount).toBeGreaterThan(0);
    expect(plan.includedBulletsCount + plan.reserveBulletsCount).toBe(seeds.length);

    // Line budget must be within 1-page bounds
    expect(plan.totalEstimatedLines).toBeGreaterThanOrEqual(46);
    expect(plan.totalEstimatedLines).toBeLessThanOrEqual(54);
    expect(plan.fitsSinglePageBudget).toBe(true);

    // High relevance Go/Kafka/Postgres bullets must be included
    const includedTexts = plan.recommendations
      .filter((r) => r.recommendedAction === 'include')
      .map((r) => r.bullet.rawText);

    expect(includedTexts.some((t) => t.includes('Kafka'))).toBe(true);
    expect(includedTexts.some((t) => t.includes('Postgres'))).toBe(true);
  });

  it('prioritizes starred bullets and boosts high-impact metrics', () => {
    const customSeeds = service.getDefaultSeedBullets().map((b) => {
      if (b.rawText.includes('Rust')) {
        return { ...b, isStarred: true };
      }
      return { ...b, isStarred: false };
    });

    const plan = service.rebalanceForJob(customSeeds, sampleBackendJobDescription);
    const rustRec = plan.recommendations.find((r) => r.bullet.rawText.includes('Rust'));

    expect(rustRec).toBeDefined();
    expect(rustRec?.recommendedAction).toBe('include');
    expect(rustRec?.relevanceScore).toBeGreaterThan(50);
  });

  it('computes skill coverage ratio and lists missing target competencies', () => {
    const seeds = service.getDefaultSeedBullets();
    const plan = service.rebalanceForJob(seeds, sampleBackendJobDescription);

    expect(plan.coverageRatio).toBeGreaterThan(0);
    expect(plan.coverageRatio).toBeLessThanOrEqual(1.0);
    expect(Array.isArray(plan.uncoveredTargetSkills)).toBe(true);
  });
});
