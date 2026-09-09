import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { AtsScorerService } from '../services/ats-scorer.js';

describe('HackerRank ATS Architecture & Document Canvas Integration', () => {
  const atsScorer = new AtsScorerService();

  describe('HackerRank 6-Dimensional Scoring & Rubrics', () => {
    it('auditSelfProjects detects complexity signals and awards link verification bonus', () => {
      const complexResume = `
Jane Doe
jane@example.com
https://github.com/janedoe/distributed-kv

PROJECTS
Raft Distributed Key-Value Store | Go, Docker, Raft Consensus
https://github.com/janedoe/distributed-kv
• Architected a distributed key-value store utilizing Raft consensus with log compaction.
• Implemented concurrent caching layer reducing P99 read latency by 45%.
`;

      const audit = atsScorer.auditSelfProjects(complexResume);
      expect(audit.hasWorkingLinks).toBe(true);
      expect(audit.linksFound.length).toBeGreaterThan(0);
      expect(audit.complexitySignals).toContain('raft');
      expect(audit.complexitySignals).toContain('caching');
      expect(audit.tutorialFlags.length).toBe(0);
      expect(audit.score).toBeGreaterThanOrEqual(70);
      expect(audit.evidence).toContain('Raft');
    });

    it('auditSelfProjects penalizes generic tutorial / coursework clones', () => {
      const tutorialResume = `
John Doe
john@example.com

PROJECTS
Netflix Clone | React, Firebase
• Followed a YouTube tutorial to create a netflix clone web application.
• Created a simple todo app and calculator in JavaScript.
`;

      const audit = atsScorer.auditSelfProjects(tutorialResume);
      expect(audit.tutorialFlags.length).toBeGreaterThan(0);
      expect(audit.tutorialFlags.some(f => /netflix clone|youtube tutorial|todo app|calculator/i.test(f))).toBe(true);
      // Tutorial penalty reduces score
      expect(audit.score).toBeLessThanOrEqual(40);
      expect(audit.evidence).toContain('Flagged');
    });

    it('auditProductionExperience calculates production density and infra signals', () => {
      const prodResume = `
Alex Rivera
alex@example.com

EXPERIENCE
Staff Infrastructure Engineer | Stripe | June 2023 - Present
• Orchestrated multi-region Kubernetes clusters on AWS serving 50,000 requests/sec.
• Built automated CI/CD deployment pipelines with zero-downtime rolling upgrades.
• Monitored P99 latency SLAs using Datadog and Prometheus alerts, maintaining 99.99% uptime.
• Participated in weekly on-call rotation for critical distributed payments infrastructure.
`;

      const audit = atsScorer.auditProductionExperience(prodResume);
      expect(audit.roleCount).toBeGreaterThanOrEqual(1);
      expect(audit.productionKeywordsFound).toContain('kubernetes');
      expect(audit.productionKeywordsFound).toContain('ci/cd');
      expect(audit.productionKeywordsFound).toContain('aws');
      expect(audit.productionKeywordsFound.some(k => k === 'sla' || k === 'slas')).toBe(true);
      expect(audit.productionKeywordsFound).toContain('p99 latency');
      expect(audit.productionKeywordsFound).toContain('datadog');
      expect(audit.isProductionHeavy).toBe(true);
      expect(audit.score).toBeGreaterThanOrEqual(80);
      expect(audit.evidence).toContain('production engineering maturity');
    });

    it('Deterministic 6-Dimensional rubric correctly weights competencies', () => {
      const candidateResume = `
Sarah Connor
sarah@example.com
https://github.com/sarahconnor/systems-platform

TECHNICAL SKILLS
Languages: Go, Python, TypeScript, SQL, Rust
Infrastructure: Docker, Kubernetes, AWS, PostgreSQL, Redis, CI/CD, Kafka

EXPERIENCE
Systems Software Engineer | Cloudflare | Jan 2024 - Present
• Architected high-throughput distributed microservices in Go processing 200M requests daily.
• Optimized PostgreSQL query execution plans reducing P99 latency by 58%.
• Automated CI/CD release workflows with Docker and Kubernetes achieving 99.99% service SLA.

PROJECTS
Distributed Cache Engine | Go, Raft, eBPF
https://github.com/sarahconnor/cache-engine
• Engineered low-latency in-memory cache supporting Raft consensus and concurrent read replication.
`;

      const report = atsScorer.analyze(
        candidateResume,
        'Senior Software Engineer: Go, Kubernetes, Docker, PostgreSQL, Distributed Systems, CI/CD, AWS'
      );

      // Verify overall score meets competitive engineering bar
      expect(report.overallScore).toBeGreaterThanOrEqual(75);
      expect(report.breakdown.hardSkillsScore).toBeGreaterThanOrEqual(80);
      expect(report.breakdown.productionExperienceScore).toBeGreaterThanOrEqual(80);
      expect(report.breakdown.selfProjectsScore).toBeGreaterThanOrEqual(75);
      expect(report.quantificationStats.percentage).toBeGreaterThanOrEqual(30);
    });
  });

  describe('Disregard Google Docs Sync & Streamlined Ingestion Verification', () => {
    it('Navbar contains Document Canvas and does NOT contain Match & Tailor tab', () => {
      const navbarPath = path.resolve(__dirname, '../../../web/src/components/Navbar.tsx');
      const content = fs.readFileSync(navbarPath, 'utf8');

      expect(content).toContain('<span>Home</span>');
      expect(content).toContain('<span>Document Canvas</span>');
      expect(content).toContain('<span>Discovery</span>');
      expect(content).toContain('<span>Tracker</span>');
      expect(content).toContain('<span>Profile</span>');
      expect(content).toContain('<span>Settings</span>');
      expect(content).not.toContain('<span>Match & Tailor</span>');
      expect(content).not.toContain("'match'");
    });

    it('HomePage completely disregards Option 1 (Google Docs Sync) and focuses on direct PDF upload', () => {
      const homePath = path.resolve(__dirname, '../../../web/src/components/HomePage.tsx');
      const content = fs.readFileSync(homePath, 'utf8');

      // Option 1 Google Docs Cloud Sync card is removed
      expect(content).not.toContain('Option 1');
      expect(content).not.toContain('Option 2');
      expect(content).not.toContain('Google Docs Cloud Sync');
      expect(content).not.toContain('onSelectOption1GoogleDocs');

      // Features direct PDF dropzone & Canvas launchpad
      expect(content).toContain('Upload Resume File');
      expect(content).toContain('Open Document Canvas');
      expect(content).toContain('HackerRank ATS Architecture');
      expect(content).toContain('onOpenCanvas');
    });

    it('MatchTailorTab.tsx has been completely removed from web components', () => {
      const matchTabPath = path.resolve(__dirname, '../../../web/src/components/MatchTailorTab.tsx');
      expect(fs.existsSync(matchTabPath)).toBe(false);
    });

    it('InAppDocumentCanvas mounts HackerRankAtsPanel right next to the canvas', () => {
      const canvasPath = path.resolve(__dirname, '../../../web/src/components/InAppDocumentCanvas.tsx');
      const content = fs.readFileSync(canvasPath, 'utf8');

      expect(content).toContain('HackerRankAtsPanel');
      expect(content).toContain('<HackerRankAtsPanel');
      expect(content).toContain('HackerRank ATS');
    });
  });

  describe('Design System: Strict Monochromatic Zero Purple and Zero Blue', () => {
    it('HackerRankAtsPanel strictly adheres to zero purple and zero blue colors', () => {
      const panelPath = path.resolve(__dirname, '../../../web/src/components/HackerRankAtsPanel.tsx');
      const content = fs.readFileSync(panelPath, 'utf8');

      // Strict check: zero purple/blue/violet/indigo classes
      expect(content).not.toMatch(/(?:bg|text|border)-(?:purple|blue|violet|indigo)-\d+/);

      // Comprehensive dark mode tokens
      expect(content).toContain('dark:bg-[#121215]');
      expect(content).toContain('dark:border-[#27272A]');
      expect(content).toContain('dark:text-zinc-50');

      // Emerald used for passing criteria / verified metrics
      expect(content).toContain('bg-emerald-500');
      expect(content).toContain('text-emerald-500');

      // Amber used for warnings / missing items
      expect(content).toContain('bg-amber-500');
    });
  });
});
