/**
 * Company Archetype Classifier
 *
 * Implements a 3-tier hierarchical classifier ensuring 100% coverage across all 500+
 * polled companies and custom scraped openings:
 *   Tier 1: Known registry / named company list (O(1) lookup)
 *   Tier 2: JD signal density scoring (keyword pattern density threshold >= 3)
 *   Tier 3: Universal Standard Enterprise fallback ("STANDARD_TECH_ENTERPRISE")
 */

export type CompanyArchetype =
  | 'QUANT_FINANCE'
  | 'BIG_TECH_SCALE'
  | 'HIGH_GROWTH_INFRA'
  | 'AI_RESEARCH_PLATFORM'
  | 'EARLY_STAGE_STARTUP'
  | 'STANDARD_TECH_ENTERPRISE';

export interface ArchetypeProfile {
  archetype: CompanyArchetype;
  label: string;
  badge: string;
  description: string;
  narrativeDirective: string;
  keyThemes: string[];
}

export const ARCHETYPE_PROFILES: Record<CompanyArchetype, ArchetypeProfile> = {
  QUANT_FINANCE: {
    archetype: 'QUANT_FINANCE',
    label: 'Quantitative Finance & Low-Latency',
    badge: '⚡ Quant / Low-Latency',
    description: 'High-frequency trading, market data engines, and algorithmic precision.',
    narrativeDirective: 'Emphasize sub-millisecond latency (µs/ns), memory layout, lock-free concurrency, algorithmic determinism, and hardware cache locality.',
    keyThemes: ['Microsecond Latency', 'Lock-Free Concurrency', 'Deterministic Execution', 'C++ / Systems'],
  },
  BIG_TECH_SCALE: {
    archetype: 'BIG_TECH_SCALE',
    label: 'Big Tech & Global Scale',
    badge: '🌐 Big Tech Scale',
    description: 'Massive distributed systems, multi-region infrastructure, and cross-functional leadership.',
    narrativeDirective: 'Emphasize massive horizontal scale (10M+ DAU, petabyte scale, 10k+ QPS), multi-team stakeholder leadership, architectural RFCs, and 99.99% high-availability SLAs.',
    keyThemes: ['Petabyte Scale', 'Multi-Region High Availability', 'Cross-Functional RFCs', 'System Reliability'],
  },
  HIGH_GROWTH_INFRA: {
    archetype: 'HIGH_GROWTH_INFRA',
    label: 'High-Growth Platform & Infrastructure',
    badge: '🚀 High-Growth Infra',
    description: 'Developer platforms, API ecosystems, and mission-critical cloud infrastructure.',
    narrativeDirective: 'Emphasize developer experience, API idempotency, backward compatibility, zero-downtime database migrations, telemetry/observability, and SOC2 security compliance.',
    keyThemes: ['API Ergonomics', 'Zero-Downtime Deployments', 'Observability & Telemetry', 'Idempotency & Security'],
  },
  AI_RESEARCH_PLATFORM: {
    archetype: 'AI_RESEARCH_PLATFORM',
    label: 'AI Research & Frontier Models',
    badge: '🤖 AI Research & Frontier',
    description: 'Foundation model training, GPU orchestration, and frontier AI evaluation platforms.',
    narrativeDirective: 'Emphasize GPU cluster throughput (TFLOPs), evaluation harnesses, inference optimization, vector search, embeddings, model fine-tuning, and scalable pipeline orchestration.',
    keyThemes: ['GPU Cluster Throughput', 'Model Evaluation & Benchmarking', 'Inference Latency', 'Vector Search & RAG'],
  },
  EARLY_STAGE_STARTUP: {
    archetype: 'EARLY_STAGE_STARTUP',
    label: 'Early-Stage Startup & 0-to-1',
    badge: '🌱 0-to-1 Startup',
    description: 'Rapid product shipping, broad full-stack ownership, and zero-to-one feature velocity.',
    narrativeDirective: 'Emphasize 0-to-1 feature velocity, broad full-stack ownership, product intuition, rapid prototyping, and pragmatic unblocked shipping.',
    keyThemes: ['0-to-1 Velocity', 'Full-Stack Ownership', 'Pragmatic Execution', 'Rapid Iteration'],
  },
  STANDARD_TECH_ENTERPRISE: {
    archetype: 'STANDARD_TECH_ENTERPRISE',
    label: 'Enterprise & Modern Software Engineering',
    badge: '🏢 Modern Enterprise',
    description: 'Pragmatic software delivery, modular architecture, and measurable business impact.',
    narrativeDirective: 'Emphasize clean modular architecture, test-driven reliability, measurable business impact, maintainable codebases, and strong agile collaboration.',
    keyThemes: ['Modular Architecture', 'Business Impact & ROI', 'Quality & Test Coverage', 'Agile Collaboration'],
  },
};

// ── Tier 1: Known Seed Lists (O(1) Normalization) ───────────────────────────
const QUANT_COMPANIES = new Set([
  'citadel', 'citadel securities', 'jane street', 'two sigma', 'hudson river trading',
  'hrt', 'jump trading', 'optiver', 'imc trading', 'virtu financial', 'drw', 'five rings',
  'akuna capital', 'tower research', 'de shaw', 'point72', 'millennium', 'sig', 'susquehanna',
]);

const BIG_TECH_COMPANIES = new Set([
  'google', 'alphabet', 'meta', 'facebook', 'amazon', 'aws', 'microsoft',
  'apple', 'netflix', 'salesforce', 'oracle', 'uber', 'airbnb', 'adobe', 'linkedin',
]);

const INFRA_COMPANIES = new Set([
  'stripe', 'cloudflare', 'datadog', 'plaid', 'vercel', 'snowflake', 'databricks',
  'confluent', 'hashicorp', 'mongodb', 'elastic', 'twilio', 'postman', 'sentry',
]);

const AI_LAB_COMPANIES = new Set([
  'openai', 'anthropic', 'deepmind', 'xai', 'mistral', 'cohere', 'scale ai',
  'hugging face', 'perplexity', 'midjourney', 'stability ai',
]);

// ── Tier 2: Signal Keywords & Patterns ──────────────────────────────────────
const QUANT_SIGNALS = [
  'low latency', 'low-latency', 'microsecond', 'nanosecond', 'kernel bypass', 'c++',
  'fpga', 'order execution', 'market data', 'high frequency', 'hft', 'order routing',
  'lock-free', 'simd', 'hardware acceleration', 'algorithmic trading',
];

const BIG_TECH_SIGNALS = [
  'billions of users', 'hundreds of millions', 'petabyte', 'exabyte', 'cross-functional',
  'rfc', 'design doc', 'design documents', '99.99%', 'four nines', 'high availability',
  'stakeholder management', 'multi-region', 'distributed systems', 'horizontal scaling',
];

const INFRA_SIGNALS = [
  'api platform', 'developer experience', 'devex', 'telemetry', 'observability',
  'zero downtime', 'zero-downtime', 'idempotency', 'idempotent', 'rate limiting',
  'soc2', 'security compliance', 'connection pooling', 'grpc', 'kafka',
];

const AI_SIGNALS = [
  'large language model', 'llm', 'transformer', 'distributed training', 'gpu cluster',
  'evals', 'checkpointing', 'vector database', 'rag', 'embeddings', 'inference optimization',
  'pytorch', 'cuda', 'triton', 'fine-tuning',
];

const STARTUP_SIGNALS = [
  '0-to-1', 'zero to one', 'founding engineer', 'scrappy', 'wear multiple hats',
  'fast-paced', 'early stage', 'early-stage', 'seed stage', 'series a', 'series b',
  'rapid iteration', 'high ownership', 'product-market fit',
];

export class CompanyArchetypeClassifier {
  /**
   * Classifies a company and job description into an actionable archetype.
   * Guaranteed 100% coverage (falls back to STANDARD_TECH_ENTERPRISE).
   */
  public static classify(companyName: string, jobDescription: string = ''): ArchetypeProfile {
    const normCompany = (companyName || '').toLowerCase().trim();
    const normJD = (jobDescription || '').toLowerCase();

    // ── Tier 1: Known Registry / Name Exact Match ──
    if (QUANT_COMPANIES.has(normCompany)) return ARCHETYPE_PROFILES.QUANT_FINANCE;
    if (BIG_TECH_COMPANIES.has(normCompany)) return ARCHETYPE_PROFILES.BIG_TECH_SCALE;
    if (INFRA_COMPANIES.has(normCompany)) return ARCHETYPE_PROFILES.HIGH_GROWTH_INFRA;
    if (AI_LAB_COMPANIES.has(normCompany)) return ARCHETYPE_PROFILES.AI_RESEARCH_PLATFORM;

    // Check substring in company name (e.g. "Google LLC" or "Stripe Payments")
    for (const q of QUANT_COMPANIES) if (normCompany.includes(q)) return ARCHETYPE_PROFILES.QUANT_FINANCE;
    for (const b of BIG_TECH_COMPANIES) if (normCompany.includes(b)) return ARCHETYPE_PROFILES.BIG_TECH_SCALE;
    for (const inf of INFRA_COMPANIES) if (normCompany.includes(inf)) return ARCHETYPE_PROFILES.HIGH_GROWTH_INFRA;
    for (const ai of AI_LAB_COMPANIES) if (normCompany.includes(ai)) return ARCHETYPE_PROFILES.AI_RESEARCH_PLATFORM;

    // ── Tier 2: JD Signal Density Scoring ──
    const countSignals = (signals: string[]) => {
      let count = 0;
      for (const sig of signals) {
        if (normJD.includes(sig)) count++;
      }
      return count;
    };

    const quantScore = countSignals(QUANT_SIGNALS);
    const aiScore = countSignals(AI_SIGNALS);
    const infraScore = countSignals(INFRA_SIGNALS);
    const startupScore = countSignals(STARTUP_SIGNALS);
    const bigTechScore = countSignals(BIG_TECH_SIGNALS);

    const scores = [
      { type: 'QUANT_FINANCE' as CompanyArchetype, score: quantScore },
      { type: 'AI_RESEARCH_PLATFORM' as CompanyArchetype, score: aiScore },
      { type: 'HIGH_GROWTH_INFRA' as CompanyArchetype, score: infraScore },
      { type: 'EARLY_STAGE_STARTUP' as CompanyArchetype, score: startupScore },
      { type: 'BIG_TECH_SCALE' as CompanyArchetype, score: bigTechScore },
    ];

    scores.sort((a, b) => b.score - a.score);

    // If highest score >= 3, select that archetype
    if (scores[0].score >= 3) {
      return ARCHETYPE_PROFILES[scores[0].type];
    }

    // If highest score >= 2 and clearly ahead of others
    if (scores[0].score >= 2 && scores[0].score > scores[1].score) {
      return ARCHETYPE_PROFILES[scores[0].type];
    }

    // ── Tier 3: Universal Standard Tech Enterprise Fallback (100% Coverage) ──
    return ARCHETYPE_PROFILES.STANDARD_TECH_ENTERPRISE;
  }
}
