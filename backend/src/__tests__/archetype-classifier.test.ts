import { describe, it, expect } from 'vitest';
import { CompanyArchetypeClassifier, ARCHETYPE_PROFILES } from '../services/archetype-classifier.js';

describe('Company Archetype Classifier Unit Tests', () => {
  it('classifies Tier-1 known companies by name O(1)', () => {
    expect(CompanyArchetypeClassifier.classify('Citadel').archetype).toBe('QUANT_FINANCE');
    expect(CompanyArchetypeClassifier.classify('Google LLC').archetype).toBe('BIG_TECH_SCALE');
    expect(CompanyArchetypeClassifier.classify('Stripe Payments').archetype).toBe('HIGH_GROWTH_INFRA');
    expect(CompanyArchetypeClassifier.classify('OpenAI').archetype).toBe('AI_RESEARCH_PLATFORM');
  });

  it('classifies unlisted companies via JD signal density', () => {
    const quantJd = 'Looking for a C++ engineer experienced in low-latency market data, kernel bypass, and nanosecond order execution.';
    expect(CompanyArchetypeClassifier.classify('Anonymous Prop Shop', quantJd).archetype).toBe('QUANT_FINANCE');

    const aiJd = 'Build distributed training pipelines with PyTorch, CUDA, GPU clusters, and evals for our large language models.';
    expect(CompanyArchetypeClassifier.classify('Stealth Frontier Co', aiJd).archetype).toBe('AI_RESEARCH_PLATFORM');

    const startupJd = 'We are a fast-paced seed stage team looking for a founding engineer who loves 0-to-1 rapid iteration and high ownership.';
    expect(CompanyArchetypeClassifier.classify('Acme Labs', startupJd).archetype).toBe('EARLY_STAGE_STARTUP');

    const infraJd = 'Design public API platform endpoints with zero-downtime database migrations, telemetry, and SOC2 security compliance.';
    expect(CompanyArchetypeClassifier.classify('DeveloperHub Inc', infraJd).archetype).toBe('HIGH_GROWTH_INFRA');
  });

  it('guarantees 100% coverage by falling back to STANDARD_TECH_ENTERPRISE for generic companies', () => {
    const genericJd = 'Software engineer to build internal web portals and business applications using TypeScript and SQL.';
    const result = CompanyArchetypeClassifier.classify('Regional Logistics Corp', genericJd);

    expect(result.archetype).toBe('STANDARD_TECH_ENTERPRISE');
    expect(result.label).toBe('Enterprise & Modern Software Engineering');
    expect(result.narrativeDirective).toContain('clean modular architecture');
  });
});
