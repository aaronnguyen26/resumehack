import { describe, it, expect } from 'vitest';
import { TriVariantService } from '../services/tri-variant.js';
import { TailoredBulletDiff } from '../types/index.js';

describe('Phase 4: Tri-Variant Role Framing Engine', () => {
  const service = new TriVariantService();

  const mockDiffWithVariations: TailoredBulletDiff = {
    id: 'diff-1',
    section: 'Experience',
    organization: 'FinTech Corp',
    role: 'Backend Engineer',
    originalText: 'Built the transaction processing service in Go.',
    tailoredText: 'Architected distributed transaction engine in Go with 99.99% reliability.',
    injectedKeywords: ['Go', 'Distributed Systems'],
    rationale: 'Elevates technical depth and reliability.',
    charCountDiff: 24,
    variations: {
      technicalDepth: 'Engineered zero-alloc transaction serializer in Go using lock-free ring buffers and sync.Pool.',
      highImpact: 'Processed $12M daily transaction volume across 400,000 users with zero downtime.',
      leadership: 'Spearheaded 0-to-1 design of fintech payment core, aligning 4 squads to ship 3 weeks ahead of deadline.',
    },
    status: 'pending',
  };

  const mockDiffWithoutVariations: TailoredBulletDiff = {
    id: 'diff-2',
    section: 'Experience',
    organization: 'Startup Inc',
    role: 'Software Engineer',
    originalText: 'Created user dashboard with React and Node.js.',
    tailoredText: 'Engineered responsive analytics dashboard with React and Node.js.',
    injectedKeywords: ['React', 'Node.js'],
    rationale: 'Demonstrates end-to-end full stack execution.',
    charCountDiff: 18,
    status: 'pending',
  };

  it('resolves precomputed LLM variations into three archetypes correctly', () => {
    const variants = service.getAllVariants(mockDiffWithVariations);

    // Systems Depth
    expect(variants.systemsDepth.id).toBe('systemsDepth');
    expect(variants.systemsDepth.label).toBe('Systems Depth');
    expect(variants.systemsDepth.badge).toBe('ARCH');
    expect(variants.systemsDepth.text).toContain('lock-free ring buffers');

    // Scale & Impact
    expect(variants.scaleImpact.id).toBe('scaleImpact');
    expect(variants.scaleImpact.label).toBe('Scale & Impact');
    expect(variants.scaleImpact.badge).toBe('SCALE');
    expect(variants.scaleImpact.text).toContain('$12M daily transaction volume');

    // Velocity & MVP
    expect(variants.velocityMvp.id).toBe('velocityMvp');
    expect(variants.velocityMvp.label).toBe('Velocity & MVP');
    expect(variants.velocityMvp.badge).toBe('SPEED');
    expect(variants.velocityMvp.text).toContain('0-to-1 design');
  });

  it('synthesizes deterministic archetype variants when precomputed variations are absent', () => {
    const variants = service.getAllVariants(mockDiffWithoutVariations);

    expect(variants.systemsDepth.text).toBeTruthy();
    expect(variants.scaleImpact.text).toBeTruthy();
    expect(variants.velocityMvp.text).toBeTruthy();

    expect(variants.systemsDepth.text).toMatch(/architected|engineered|optimized/i);
    expect(variants.scaleImpact.text).toMatch(/scale|throughput|availability|latency/i);
    expect(variants.velocityMvp.text).toMatch(/spearheaded|0-to-1|iteration/i);
  });

  it('calculates line budgets and character count metrics accurately', () => {
    const shortVariant = service.getVariant(
      {
        ...mockDiffWithoutVariations,
        tailoredText: 'Optimized SQL queries.',
      },
      'systemsDepth'
    );

    expect(shortVariant.charCount).toBeGreaterThan(0);
    expect(shortVariant.fitsSingleLine).toBe(true);
    expect(shortVariant.lineEstimate).toBe(1);

    const longVariant = service.getVariant(
      {
        ...mockDiffWithoutVariations,
        tailoredText:
          'Architected an ultra low-latency globally distributed multi-region database replication pipeline utilizing WebSockets, Apache Kafka, gRPC protocols, and custom memory allocators to sustain massive peak loads with sub-millisecond p99 SLA.',
      },
      'systemsDepth'
    );

    expect(longVariant.lineEstimate).toBeGreaterThan(1);
    expect(longVariant.fitsSingleLine).toBe(false);
  });

  it('applies variant to individual diff and across all diffs globally', () => {
    const updated = service.applyVariantToDiff(mockDiffWithVariations, 'systemsDepth');
    expect(updated.selectedVariant).toBe('systemsDepth');
    expect(updated.tailoredText).toContain('lock-free ring buffers');
    expect(updated.charCountDiff).toBe(updated.tailoredText.length - mockDiffWithVariations.originalText.length);

    const globalUpdated = service.applyGlobalVariant(
      [mockDiffWithVariations, mockDiffWithoutVariations],
      'scaleImpact'
    );
    expect(globalUpdated).toHaveLength(2);
    expect(globalUpdated[0].selectedVariant).toBe('scaleImpact');
    expect(globalUpdated[1].selectedVariant).toBe('scaleImpact');
  });
});
