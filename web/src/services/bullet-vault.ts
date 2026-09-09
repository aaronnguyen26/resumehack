/**
 * BulletVaultService — Master Profile "Bullet Vault" & Dynamic Job Rebalancer.
 * 
 * Stores the candidate's canonical repository of verified bullets across all past
 * positions and projects. Dynamically solves the 1-page line budget problem
 * (strictly 48-52 lines) by ranking bullets against target job descriptions and
 * selecting the optimal high-yield subset without white-space or page overflows.
 */

import { SEMANTIC_SKILL_GRAPH, JobDenoiserService } from './job-denoiser.js';

export interface VaultBullet {
  id: string;
  section: 'Experience' | 'Projects' | 'Education' | 'Certifications' | 'Other';
  companyOrProject: string;
  roleTitle?: string;
  dateRange?: string;
  rawText: string;
  skillTags: string[];
  impactScore?: number; // 0-100
  quantifiableMetrics: string[];
  seniorityTier?: 'junior' | 'mid' | 'senior' | 'staff';
  isStarred?: boolean;
  lineCost: number;
}

export interface RebalanceConfig {
  targetLineBudget?: number; // Default 50 lines (ideal 48-52)
  minLinesPerCompany?: number;
  maxLinesPerCompany?: number;
  prioritizeStarred?: boolean;
}

export interface RebalanceRecommendation {
  bulletId: string;
  bullet: VaultBullet;
  relevanceScore: number;
  matchedSkills: string[];
  estimatedLineCost: number;
  recommendedAction: 'include' | 'vault_reserve';
  reason: string;
}

export interface RebalancePlan {
  targetLineBudget: number;
  totalVaultBulletsCount: number;
  includedBulletsCount: number;
  reserveBulletsCount: number;
  totalEstimatedLines: number;
  fitsSinglePageBudget: boolean;
  overallRelevanceScore: number;
  recommendations: RebalanceRecommendation[];
  coverageRatio: number;
  uncoveredTargetSkills: string[];
}

export class BulletVaultService {
  private static readonly CHARS_PER_LINE = 95;
  private static readonly BASELINE_PAGE_OVERHEAD_LINES = 28; // Header, contact, education, skills, section titles & margins

  private denoiser = new JobDenoiserService();

  /**
   * Estimates how many printed resume lines a bullet consumes.
   */
  public calculateLineCost(text: string): number {
    const clean = text.replace(/^[•\-\*]\s*/, '').trim();
    if (!clean) return 1;
    return Math.max(1, Math.ceil(clean.length / BulletVaultService.CHARS_PER_LINE));
  }

  /**
   * Extracts quantifiable metrics from text.
   */
  public extractMetrics(text: string): string[] {
    const metricPattern = /(?:\$\d+(?:,\d{3})*(?:\.\d+)?[kmb]?|\b\d+(?:\.\d+)?%|\b\d+(?:,\d{3})*(?:\.\d+)?\s*(?:k|m|b)?\s*(?:events\/sec|req\/s|rps|qps|queries|ms|us|sec|seconds|active\s+users|users|engineers|discrepancies|stars|github\s+stars|x|times)\b|\b\d+(?:,\d{3})*(?:\.\d+)?\s*(?:k|m|b|ms|us)\b)/gi;
    const matches = text.match(metricPattern) || [];
    return Array.from(new Set(matches.map((m) => m.trim())));
  }

  /**
   * Tags a bullet with matching technologies and concepts from our skill graph.
   */
  public extractSkillTags(text: string): string[] {
    const tags = new Set<string>();
    const lower = text.toLowerCase();

    const CORE_LANGUAGES = ['Go', 'Python', 'Rust', 'TypeScript', 'JavaScript', 'Java', 'C++', 'SQL'];
    for (const lang of CORE_LANGUAGES) {
      const regex = new RegExp(`\\b${lang.replace(/\+/g, '\\+')}\\b`, 'i');
      if (regex.test(text)) {
        tags.add(lang);
      }
    }

    for (const [concept, keywords] of Object.entries(SEMANTIC_SKILL_GRAPH)) {
      if (lower.includes(concept.toLowerCase())) {
        tags.add(concept);
      }
      for (const kw of keywords) {
        if (lower.includes(kw.toLowerCase())) {
          tags.add(kw);
        }
      }
    }

    return Array.from(tags);
  }

  /**
   * Creates a complete VaultBullet instance from partial user input.
   */
  public createBullet(data: Partial<VaultBullet> & { rawText: string; companyOrProject: string }): VaultBullet {
    const lineCost = this.calculateLineCost(data.rawText);
    const metrics = this.extractMetrics(data.rawText);
    const inferredSkills = this.extractSkillTags(data.rawText);
    const allSkills = Array.from(new Set([...(data.skillTags || []), ...inferredSkills]));

    return {
      id: data.id || `vb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      section: data.section || 'Experience',
      companyOrProject: data.companyOrProject,
      roleTitle: data.roleTitle,
      dateRange: data.dateRange,
      rawText: data.rawText.trim(),
      skillTags: allSkills,
      impactScore: data.impactScore ?? Math.min(100, 60 + metrics.length * 15),
      quantifiableMetrics: metrics,
      seniorityTier: data.seniorityTier || 'mid',
      isStarred: data.isStarred || false,
      lineCost,
    };
  }

  /**
   * Rebalances candidate's bullet vault to strictly satisfy single-page budget
   * (48-52 lines) while maximizing target job relevance.
   */
  public rebalanceForJob(
    vaultBullets: VaultBullet[],
    targetJobDescription: string,
    config: RebalanceConfig = {}
  ): RebalancePlan {
    const targetLineBudget = config.targetLineBudget ?? 50;
    const bulletBudgetLines = Math.max(15, targetLineBudget - BulletVaultService.BASELINE_PAGE_OVERHEAD_LINES);

    // Extract target job skills using denoiser
    const denoised = this.denoiser.denoise(targetJobDescription);
    const targetSkills = Array.from(
      new Set([
        ...denoised.tier1HardSkills,
        ...denoised.tier2PreferredSkills,
        ...denoised.impliedCompetencies,
      ])
    ).map((s) => s.toLowerCase());

    // Score all bullets
    const scoredBullets = vaultBullets.map((bullet) => {
      let score = 20; // baseline

      // Matched skills with target job
      const matched = bullet.skillTags.filter((st) =>
        targetSkills.some((ts) => ts === st.toLowerCase() || ts.includes(st.toLowerCase()) || st.toLowerCase().includes(ts))
      );
      score += matched.length * 25;

      // Metrics bonus
      score += (bullet.quantifiableMetrics?.length || 0) * 15;

      // Starred bonus
      if (bullet.isStarred && config.prioritizeStarred !== false) {
        score += 30;
      }

      // Seniority match
      if (denoised.detectedSeniority.toLowerCase() === (bullet.seniorityTier || '').toLowerCase()) {
        score += 15;
      }

      return {
        bullet,
        relevanceScore: score,
        matchedSkills: matched,
        estimatedLineCost: bullet.lineCost,
      };
    });

    // Sort descending by efficiency: relevanceScore / estimatedLineCost
    scoredBullets.sort((a, b) => {
      const effA = a.relevanceScore / a.estimatedLineCost;
      const effB = b.relevanceScore / b.estimatedLineCost;
      return effB - effA;
    });

    // Solve line-budget knapsack
    let linesAccumulated = 0;
    const recommendations: RebalanceRecommendation[] = [];
    const coveredSkillsSet = new Set<string>();

    for (const item of scoredBullets) {
      if (linesAccumulated + item.estimatedLineCost <= bulletBudgetLines) {
        linesAccumulated += item.estimatedLineCost;
        item.matchedSkills.forEach((s) => coveredSkillsSet.add(s.toLowerCase()));

        recommendations.push({
          bulletId: item.bullet.id,
          bullet: item.bullet,
          relevanceScore: item.relevanceScore,
          matchedSkills: item.matchedSkills,
          estimatedLineCost: item.estimatedLineCost,
          recommendedAction: 'include',
          reason: `High relevance (+${item.relevanceScore} pts) matches target skills (${item.matchedSkills.slice(0, 3).join(', ') || 'Core'}).`,
        });
      } else {
        recommendations.push({
          bulletId: item.bullet.id,
          bullet: item.bullet,
          relevanceScore: item.relevanceScore,
          matchedSkills: item.matchedSkills,
          estimatedLineCost: item.estimatedLineCost,
          recommendedAction: 'vault_reserve',
          reason: `Held in reserve to preserve single-page 50-line budget limit. Available for multi-page or alternate roles.`,
        });
      }
    }

    const totalEstimatedLines = linesAccumulated + BulletVaultService.BASELINE_PAGE_OVERHEAD_LINES;
    const fitsSinglePageBudget = totalEstimatedLines >= 46 && totalEstimatedLines <= 54;

    const included = recommendations.filter((r) => r.recommendedAction === 'include');
    const reserve = recommendations.filter((r) => r.recommendedAction === 'vault_reserve');

    const totalTargetSkills = Math.max(1, targetSkills.length);
    const coverageRatio = Math.min(1.0, coveredSkillsSet.size / totalTargetSkills);
    const uncoveredTargetSkills = targetSkills.filter((s) => !coveredSkillsSet.has(s)).slice(0, 6);

    const overallRelevance = included.reduce((sum, r) => sum + r.relevanceScore, 0);

    return {
      targetLineBudget,
      totalVaultBulletsCount: vaultBullets.length,
      includedBulletsCount: included.length,
      reserveBulletsCount: reserve.length,
      totalEstimatedLines,
      fitsSinglePageBudget,
      overallRelevanceScore: overallRelevance,
      recommendations,
      coverageRatio: Math.round(coverageRatio * 100) / 100,
      uncoveredTargetSkills,
    };
  }

  /**
   * Generates realistic seed bullets for demonstration or new users.
   */
  public getDefaultSeedBullets(candidateName: string = 'Candidate'): VaultBullet[] {
    const rawSeeds = [
      {
        section: 'Experience' as const,
        companyOrProject: 'CloudScale Inc',
        roleTitle: 'Senior Software Engineer',
        dateRange: '2023 - Present',
        rawText: 'Architected distributed event-driven ingestion pipeline in Go and Apache Kafka processing 45k events/sec with sub-50ms p99 latency.',
        skillTags: ['Go', 'Distributed Systems', 'Kafka', 'Event-Driven', 'Latency'],
        impactScore: 94,
        isStarred: true,
      },
      {
        section: 'Experience' as const,
        companyOrProject: 'CloudScale Inc',
        roleTitle: 'Senior Software Engineer',
        dateRange: '2023 - Present',
        rawText: 'Redesigned Postgres connection pooling using PgBouncer and Redis multi-tier caching, slashing database CPU utilization by 40%.',
        skillTags: ['PostgreSQL', 'Redis', 'Caching', 'Database Optimization'],
        impactScore: 90,
        isStarred: true,
      },
      {
        section: 'Experience' as const,
        companyOrProject: 'FinCore Systems',
        roleTitle: 'Software Engineer',
        dateRange: '2021 - 2023',
        rawText: 'Engineered automated reconciliation microservice in Python and FastAPI that reconciled $14M daily transactions with zero discrepancies.',
        skillTags: ['Python', 'FastAPI', 'Microservices', 'Fintech', 'Financial Systems'],
        impactScore: 88,
        isStarred: false,
      },
      {
        section: 'Experience' as const,
        companyOrProject: 'FinCore Systems',
        roleTitle: 'Software Engineer',
        dateRange: '2021 - 2023',
        rawText: 'Implemented Kubernetes Helm charts and automated zero-downtime rolling deployment pipelines on AWS EKS across 6 environments.',
        skillTags: ['Kubernetes', 'Docker', 'AWS', 'CI/CD', 'Helm'],
        impactScore: 85,
        isStarred: false,
      },
      {
        section: 'Experience' as const,
        companyOrProject: 'FinCore Systems',
        roleTitle: 'Software Engineer',
        dateRange: '2021 - 2023',
        rawText: 'Spearheaded migration of legacy monolithic SOAP services to modular REST and gRPC endpoints, accelerating release cycles by 3x.',
        skillTags: ['REST', 'gRPC', 'Monolith to Microservices'],
        impactScore: 82,
        isStarred: false,
      },
      {
        section: 'Projects' as const,
        companyOrProject: 'Open Source Distributed Lock',
        roleTitle: 'Creator & Maintainer',
        dateRange: '2023',
        rawText: 'Built raft-based distributed consensus locking library in Rust with formal verification via TLA+, garnering 1,400+ GitHub stars.',
        skillTags: ['Rust', 'Distributed Systems', 'Consensus', 'Raft'],
        impactScore: 92,
        isStarred: true,
      },
      {
        section: 'Projects' as const,
        companyOrProject: 'Real-Time Observability Agent',
        roleTitle: 'Lead Developer',
        dateRange: '2022',
        rawText: 'Created low-overhead eBPF tracing agent in C and Go monitoring Linux kernel syscalls and emitting Prometheus metrics with <1% CPU overhead.',
        skillTags: ['Go', 'eBPF', 'Prometheus', 'Linux', 'Observability'],
        impactScore: 91,
        isStarred: false,
      },
      {
        section: 'Experience' as const,
        companyOrProject: 'EarlyStage Ventures',
        roleTitle: 'Junior Developer',
        dateRange: '2020 - 2021',
        rawText: 'Maintained React frontend components and fixed UI responsiveness bugs across desktop and mobile browsers.',
        skillTags: ['React', 'JavaScript', 'CSS', 'Frontend'],
        impactScore: 68,
        isStarred: false,
      },
      {
        section: 'Projects' as const,
        companyOrProject: 'Distributed Job Scheduler',
        roleTitle: 'Architect & Author',
        dateRange: '2023',
        rawText: 'Engineered high-throughput cron scheduler in Go with Redis distributed locks and persistent task retry queues handling 50k jobs daily.',
        skillTags: ['Go', 'Redis', 'Distributed Systems', 'Queues'],
        impactScore: 89,
        isStarred: false,
      },
      {
        section: 'Experience' as const,
        companyOrProject: 'CloudScale Inc',
        roleTitle: 'Senior Software Engineer',
        dateRange: '2023 - Present',
        rawText: 'Led zero-downtime database migration of 12TB production data to partitioned tables, cutting query latency by 55%.',
        skillTags: ['PostgreSQL', 'Database Migration', 'Partitioning', 'Performance'],
        impactScore: 92,
        isStarred: false,
      },
      {
        section: 'Experience' as const,
        companyOrProject: 'FinCore Systems',
        roleTitle: 'Software Engineer',
        dateRange: '2021 - 2023',
        rawText: 'Automated end-to-end integration test suites with Docker Compose and GitHub Actions, boosting test coverage from 42% to 91%.',
        skillTags: ['Docker', 'CI/CD', 'GitHub Actions', 'Testing'],
        impactScore: 84,
        isStarred: false,
      },
      {
        section: 'Experience' as const,
        companyOrProject: 'EarlyStage Ventures',
        roleTitle: 'Junior Developer',
        dateRange: '2020 - 2021',
        rawText: 'Wrote internal Django management scripts and administrative SQL dashboards for customer support operations.',
        skillTags: ['Python', 'Django', 'SQL'],
        impactScore: 70,
        isStarred: false,
      },
    ];

    return rawSeeds.map((s, idx) => ({
      ...this.createBullet(s),
      id: `seed-vb-${idx + 1}`,
    }));
  }
}
