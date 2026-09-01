import {
  AtsScoreReport,
  KeywordMatch,
  DocumentLayoutInfo,
  StructuralParagraph,
  LayoutAuditReport,
  SelfProjectsAudit,
  ProductionExperienceAudit,
} from '../types/index.js';
import { LayoutAnalyzerService } from './layout-analyzer.js';

// ── Technical Skill Aliases & Normalizations ────────────────────────────────
const SKILL_ALIASES: Record<string, string[]> = {
  'javascript': ['js', 'ecmascript', 'javascript/typescript', 'js/ts'],
  'js': ['javascript', 'ecmascript'],
  'typescript': ['ts', 'typescript/javascript', 'ts/js'],
  'ts': ['typescript'],
  'kubernetes': ['k8s', 'kube'],
  'k8s': ['kubernetes', 'kube'],
  'postgresql': ['postgres', 'pgsql', 'psql'],
  'postgres': ['postgresql', 'pgsql', 'psql'],
  'go': ['golang'],
  'golang': ['go'],
  'aws': ['amazon web services', 'amazon web service'],
  'amazon web services': ['aws'],
  'gcp': ['google cloud platform', 'google cloud'],
  'google cloud': ['gcp', 'google cloud platform'],
  'google cloud platform': ['gcp', 'google cloud'],
  'machine learning': ['ml'],
  'ml': ['machine learning'],
  'deep learning': ['dl'],
  'dl': ['deep learning'],
  'ci/cd': ['continuous integration', 'continuous deployment', 'ci', 'cd', 'cicd'],
  'continuous integration': ['ci', 'ci/cd', 'cicd'],
  'continuous deployment': ['cd', 'ci/cd', 'cicd'],
  'react': ['react.js', 'reactjs'],
  'node.js': ['node', 'nodejs'],
  'vue': ['vue.js', 'vuejs'],
  'angular': ['angularjs', 'angular.js'],
  'rest api': ['restful api', 'rest apis', 'restful apis', 'rest'],
  'graphql': ['gql'],
  'nosql': ['non-relational db', 'mongodb', 'dynamodb'],
  'sql': ['relational db', 'rdbms', 'mysql', 'postgres', 'postgresql'],
  'docker': ['containerization', 'containers'],
  'tailwind css': ['tailwind', 'tailwindcss'],
};

const SKILL_DICTIONARY: Record<string, { category: KeywordMatch['category']; importance: KeywordMatch['importance'] }> = {
  // Languages
  'python': { category: 'Hard Skill', importance: 'Critical' },
  'typescript': { category: 'Hard Skill', importance: 'Critical' },
  'javascript': { category: 'Hard Skill', importance: 'Critical' },
  'java': { category: 'Hard Skill', importance: 'Critical' },
  'c++': { category: 'Hard Skill', importance: 'Critical' },
  'c#': { category: 'Hard Skill', importance: 'Recommended' },
  'go': { category: 'Hard Skill', importance: 'Critical' },
  'golang': { category: 'Hard Skill', importance: 'Critical' },
  'rust': { category: 'Hard Skill', importance: 'Recommended' },
  'sql': { category: 'Hard Skill', importance: 'Critical' },
  'kotlin': { category: 'Hard Skill', importance: 'Recommended' },
  'swift': { category: 'Hard Skill', importance: 'Recommended' },
  'ruby': { category: 'Hard Skill', importance: 'Recommended' },
  'scala': { category: 'Hard Skill', importance: 'Recommended' },
  'php': { category: 'Hard Skill', importance: 'Bonus' },
  'r': { category: 'Hard Skill', importance: 'Recommended' },
  'bash': { category: 'Hard Skill', importance: 'Recommended' },
  'dart': { category: 'Hard Skill', importance: 'Recommended' },

  // Frontend & Mobile
  'react': { category: 'Tool / Framework', importance: 'Critical' },
  'react native': { category: 'Tool / Framework', importance: 'Recommended' },
  'next.js': { category: 'Tool / Framework', importance: 'Critical' },
  'vue': { category: 'Tool / Framework', importance: 'Recommended' },
  'angular': { category: 'Tool / Framework', importance: 'Recommended' },
  'svelte': { category: 'Tool / Framework', importance: 'Bonus' },
  'tailwind css': { category: 'Tool / Framework', importance: 'Recommended' },
  'redux': { category: 'Tool / Framework', importance: 'Recommended' },
  'zustand': { category: 'Tool / Framework', importance: 'Bonus' },
  'flutter': { category: 'Tool / Framework', importance: 'Recommended' },
  'html/css': { category: 'Hard Skill', importance: 'Recommended' },
  'websockets': { category: 'Hard Skill', importance: 'Recommended' },
  'vite': { category: 'Tool / Framework', importance: 'Bonus' },

  // Backend & Cloud
  'node.js': { category: 'Tool / Framework', importance: 'Critical' },
  'express': { category: 'Tool / Framework', importance: 'Recommended' },
  'nestjs': { category: 'Tool / Framework', importance: 'Recommended' },
  'django': { category: 'Tool / Framework', importance: 'Recommended' },
  'fastapi': { category: 'Tool / Framework', importance: 'Recommended' },
  'flask': { category: 'Tool / Framework', importance: 'Recommended' },
  'spring boot': { category: 'Tool / Framework', importance: 'Recommended' },
  'graphql': { category: 'Tool / Framework', importance: 'Recommended' },
  'grpc': { category: 'Tool / Framework', importance: 'Recommended' },
  'rest api': { category: 'Hard Skill', importance: 'Critical' },
  'microservices': { category: 'Domain Knowledge', importance: 'Critical' },
  'system design': { category: 'Domain Knowledge', importance: 'Critical' },
  'distributed systems': { category: 'Domain Knowledge', importance: 'Critical' },
  'aws': { category: 'Tool / Framework', importance: 'Critical' },
  'gcp': { category: 'Tool / Framework', importance: 'Critical' },
  'google cloud': { category: 'Tool / Framework', importance: 'Critical' },
  'azure': { category: 'Tool / Framework', importance: 'Critical' },
  'docker': { category: 'Tool / Framework', importance: 'Critical' },
  'kubernetes': { category: 'Tool / Framework', importance: 'Critical' },
  'ci/cd': { category: 'Tool / Framework', importance: 'Critical' },
  'terraform': { category: 'Tool / Framework', importance: 'Recommended' },
  'linux': { category: 'Hard Skill', importance: 'Recommended' },

  // Databases & Streaming
  'postgresql': { category: 'Tool / Framework', importance: 'Critical' },
  'postgres': { category: 'Tool / Framework', importance: 'Critical' },
  'mysql': { category: 'Tool / Framework', importance: 'Recommended' },
  'mongodb': { category: 'Tool / Framework', importance: 'Recommended' },
  'redis': { category: 'Tool / Framework', importance: 'Recommended' },
  'kafka': { category: 'Tool / Framework', importance: 'Recommended' },
  'rabbitmq': { category: 'Tool / Framework', importance: 'Bonus' },
  'dynamodb': { category: 'Tool / Framework', importance: 'Recommended' },
  'snowflake': { category: 'Tool / Framework', importance: 'Recommended' },
  'elasticsearch': { category: 'Tool / Framework', importance: 'Recommended' },
  'supabase': { category: 'Tool / Framework', importance: 'Recommended' },
  'firebase': { category: 'Tool / Framework', importance: 'Recommended' },

  // Data & AI / ML
  'pytorch': { category: 'Tool / Framework', importance: 'Critical' },
  'tensorflow': { category: 'Tool / Framework', importance: 'Critical' },
  'scikit-learn': { category: 'Tool / Framework', importance: 'Recommended' },
  'pandas': { category: 'Tool / Framework', importance: 'Recommended' },
  'numpy': { category: 'Tool / Framework', importance: 'Recommended' },
  'spark': { category: 'Tool / Framework', importance: 'Recommended' },
  'machine learning': { category: 'Domain Knowledge', importance: 'Critical' },
  'deep learning': { category: 'Domain Knowledge', importance: 'Recommended' },
  'llm': { category: 'Domain Knowledge', importance: 'Critical' },
  'nlp': { category: 'Domain Knowledge', importance: 'Recommended' },
  'rag': { category: 'Domain Knowledge', importance: 'Recommended' },
  'langchain': { category: 'Tool / Framework', importance: 'Recommended' },
  'computer vision': { category: 'Domain Knowledge', importance: 'Recommended' },

  // Testing & Quality
  'unit testing': { category: 'Hard Skill', importance: 'Critical' },
  'integration testing': { category: 'Hard Skill', importance: 'Recommended' },
  'jest': { category: 'Tool / Framework', importance: 'Recommended' },
  'vitest': { category: 'Tool / Framework', importance: 'Bonus' },
  'cypress': { category: 'Tool / Framework', importance: 'Bonus' },
  'playwright': { category: 'Tool / Framework', importance: 'Bonus' },
  'git': { category: 'Tool / Framework', importance: 'Critical' },

  // Methodologies & Soft Skills
  'agile': { category: 'Domain Knowledge', importance: 'Recommended' },
  'scrum': { category: 'Domain Knowledge', importance: 'Recommended' },
  'cross-functional collaboration': { category: 'Soft Skill', importance: 'Recommended' },
  'leadership': { category: 'Soft Skill', importance: 'Recommended' },
  'problem solving': { category: 'Soft Skill', importance: 'Recommended' },
  'communication': { category: 'Soft Skill', importance: 'Recommended' },
  'mentorship': { category: 'Soft Skill', importance: 'Bonus' },
};

const DOMAIN_BENCHMARKS: Record<string, string[]> = {
  'Software Engineering': ['Git', 'Docker', 'REST API', 'Unit Testing', 'CI/CD', 'SQL', 'PostgreSQL', 'System Design', 'Agile', 'Microservices'],
  'Data & AI': ['Python', 'SQL', 'PostgreSQL', 'Machine Learning', 'Pandas', 'NumPy', 'PyTorch', 'Data Pipelines', 'Git', 'Deep Learning'],
  'Product Management': ['Agile', 'Scrum', 'Cross-functional Collaboration', 'Product Roadmap', 'User Research', 'A/B Testing', 'Data Analysis', 'Leadership', 'System Design'],
  'Finance & Quant': ['Python', 'C++', 'SQL', 'Algorithms', 'Linear Algebra', 'Statistical Modeling', 'Quantitative Analysis', 'Git', 'Data Pipelines'],
  'General': ['Leadership', 'Problem Solving', 'Communication', 'Project Management', 'Data Analysis', 'Agile', 'Git', 'Unit Testing']
};

const TIER_1_ACTION_VERBS = [
  'architected', 'spearheaded', 'engineered', 'orchestrated', 'benchmarked', 'streamlined',
  'overhauled', 'accelerated', 'pioneered', 'automated', 'refactored', 'designed', 'scaled'
];

const STRONG_STAR_VERBS = [
  ...TIER_1_ACTION_VERBS,
  'deployed', 'optimized', 'implemented', 'built', 'developed', 'boosted', 'reduced',
  'created', 'formulated', 'led', 'delivered', 'established', 'authored', 'managed',
  'executed', 'integrated', 'modeled', 'transformed', 'programmed'
];

const WEAK_PASSIVE_VERBS = [
  'worked on', 'helped', 'assisted', 'responsible for', 'handled', 'made', 'participated in',
  'involved in', 'supported', 'attempted', 'duties included'
];

// ── HackerRank-Inspired Category Lexicons (Deterministic Text Patterns) ──────

const PRODUCTION_KEYWORDS = [
  'production', 'deployed', 'deploying', 'shipped', 'shipping', 'on-call', 'on call', 'pagerduty',
  'incident response', 'root cause analysis', 'post-mortem', 'postmortem', 'outage',
  'sla', 'slo', 'sli', '99.9%', '99.99%', 'uptime', 'zero downtime', 'zero-downtime',
  'monitoring', 'datadog', 'prometheus', 'grafana', 'sentry', 'cloudwatch', 'new relic',
  'opentelemetry', 'distributed tracing', 'alerting', 'logging', 'logstash', 'elk stack',
  'kubernetes', 'k8s', 'docker', 'helm', 'terraform', 'ansible', 'ci/cd', 'github actions',
  'gitlab ci', 'jenkins', 'argo cd', 'argocd', 'aws', 'gcp', 'azure', 'cloud infrastructure',
  'ec2', 's3', 'ecs', 'eks', 'gke', 'lambda', 'cloud functions', 'fargate',
  'microservices', 'load balancer', 'horizontal scaling', 'multi-tenant', 'multi-region',
  'database migration', 'failover', 'disaster recovery', 'rate limiting', 'p95', 'p99',
  'high availability', 'fault tolerant', 'circuit breaker', 'throughput', 'concurrency',
  'code review', 'code reviews', 'rfc', 'design doc', 'design documents', 'agile', 'sprints',
  'cross-functional', 'stakeholders', 'enterprise', 'compliance', 'soc2', 'security audit'
];

const PROJECT_COMPLEXITY_KEYWORDS = [
  'distributed', 'microservices', 'caching', 'concurrency', 'async', 'asynchronous',
  'websocket', 'websockets', 'event-driven', 'event driven', 'message queue', 'pub/sub',
  'kafka', 'rabbitmq', 'redis', 'dragonfly', 'vector search', 'embeddings', 'rag', 'llm',
  'neural network', 'deep learning', 'transformer', 'pytorch', 'tensorflow', 'scikit-learn',
  'ast', 'compiler', 'interpreter', 'parser', 'lexer', 'crdt', 'sharding', 'indexeddb',
  'sqlite', 'postgresql', 'fastapi', 'graphql', 'grpc', 'oauth', 'oauth2', 'jwt',
  'webrtc', 'webassembly', 'wasm', 'webgl', 'three.js', 'canvas', 'pwa', 'state management',
  'custom hook', 'middleware', 'data pipeline', 'etl', 'scraper', 'crawler', 'consensus', 'raft'
];

const PROJECT_IMPACT_KEYWORDS = [
  'users', 'dau', 'mau', 'stars', 'github stars', 'downloads', 'installs', 'active users',
  'requests', 'qps', 'rps', 'latency', 'speedup', 'accelerated', 'optimized by', 'reduced by',
  'featured on', 'product hunt', 'hackathon winner', '1st place', 'community', 'contributors',
  'forks', 'subscribers', 'daily active', 'monthly active'
];

const TUTORIAL_FLAG_PATTERNS = [
  /(?:followed|follow)\s+(?:a\s+)?(?:youtube|udemy|coursera|online\s+)?(?:tutorial|guide|course|video)/i,
  /(?:youtube|udemy|coursera|edx|codecademy|freecodecamp)\s+(?:tutorial|course|project|video)/i,
  /(?:class|course|academic|school|coursework|homework|capstone)\s+project/i,
  /completed\s+(?:a\s+)?(?:course|tutorial|class)\s+project/i,
  /(?:todo\s+list|calculator|weather)\s+app/i,
  /(?:clone|copy)\s+of\s+(?:netflix|spotify|amazon|airbnb|twitter|instagram|facebook)\s+(?:from|following|via|tutorial)/i,
  /built\s+(?:a\s+)?clone\s+following/i,
  /guided\s+project/i
];

const URL_PATTERN = /(?:https?:\/\/)?(?:www\.)?(?:github\.com\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+|gitlab\.com\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+|[a-zA-Z0-9_.-]+\.(?:vercel\.app|netlify\.app|herokuapp\.com|github\.io|dev|app|io|tech|com)\/[^\s)]*)/gi;

export class AtsScorerService {
  private layoutAnalyzer = new LayoutAnalyzerService();

  /**
   * Evaluates "Self Projects" category (inspired by HackerRank rubric).
   * Analyzes text for complexity, impact, live/demo links, and penalizes tutorial projects.
   * Deterministic text and pattern-based calculation.
   */
  public auditSelfProjects(resumeText: string): SelfProjectsAudit {
    const norm = resumeText.toLowerCase();
    const rawLines = resumeText.split(/\n+/).map(l => l.trim()).filter(Boolean);

    // 1. Extract Links from Text
    const linksFound = resumeText.match(URL_PATTERN) || [];
    const hasWorkingLinks = linksFound.length > 0;

    // 2. Identify Tutorial / Coursework Flags
    const tutorialFlags: string[] = [];
    for (const pattern of TUTORIAL_FLAG_PATTERNS) {
      const match = resumeText.match(pattern);
      if (match) {
        tutorialFlags.push(match[0]);
      }
    }

    // 3. Detect Complexity Signals
    const complexitySignals: string[] = [];
    for (const kw of PROJECT_COMPLEXITY_KEYWORDS) {
      if (new RegExp(`\\b${kw}\\b`, 'i').test(norm)) {
        complexitySignals.push(kw);
      }
    }

    // 4. Detect Impact Signals
    const impactSignals: string[] = [];
    for (const kw of PROJECT_IMPACT_KEYWORDS) {
      if (new RegExp(`\\b${kw}\\b`, 'i').test(norm)) {
        impactSignals.push(kw);
      }
    }

    // 5. Estimate Project count
    const projectHeaderCount = rawLines.filter(l => 
      /projects?/i.test(l) || 
      (l.includes('|') && (l.includes('github.com') || l.includes('React') || l.includes('Go') || l.includes('Python') || l.includes('TypeScript')))
    ).length;
    const projectCount = Math.max(1, projectHeaderCount > 0 ? projectHeaderCount : (hasWorkingLinks ? 1 : 0));

    // 6. Find Representative Quote for Evidence
    let bestQuote = '';
    const projectLines = rawLines.filter(l => 
      (l.startsWith('•') || l.startsWith('-') || l.startsWith('*')) && 
      (complexitySignals.some(c => l.toLowerCase().includes(c)) || tutorialFlags.some(f => l.toLowerCase().includes(f.toLowerCase())))
    );
    if (projectLines.length > 0) {
      bestQuote = projectLines[0].replace(/^[•\-*]\s*/, '').slice(0, 120);
    } else if (rawLines.length > 0) {
      bestQuote = rawLines[0].slice(0, 100);
    }

    // 7. Calculate Deterministic Score
    let score = 35;
    if (hasWorkingLinks) score += 15;
    score += Math.min(30, complexitySignals.length * 6);
    score += Math.min(25, impactSignals.length * 6);
    if (tutorialFlags.length > 0) {
      score -= tutorialFlags.length * 25;
    }
    score = Math.max(15, Math.min(100, Math.round(score)));

    // 8. Construct Deterministic Evidence String
    let evidence = '';
    if (tutorialFlags.length > 0) {
      evidence = `Self Projects: ${score}/100 — Flagged ${tutorialFlags.length} tutorial-like phrase(s) (${tutorialFlags.map(f => `"${f}"`).join(', ')}). Evidence: "${bestQuote}" indicates coursework/tutorial-guided work rather than independent architecture.`;
    } else if (hasWorkingLinks || complexitySignals.length > 0) {
      evidence = `Self Projects: ${score}/100 — Identified ${projectCount} project(s) with ${complexitySignals.length} complexity signal(s) (${complexitySignals.slice(0, 3).join(', ')})${hasWorkingLinks ? ` and verified repo/demo link (${linksFound[0]})` : ''}. Evidence: "${bestQuote}" demonstrates ${impactSignals.length > 0 ? 'measurable outcomes and ' : ''}technical depth.`;
    } else {
      evidence = `Self Projects: ${score}/100 — No dedicated repository links or complex standalone projects identified in resume text. Adding independent projects with live demo URLs will strengthen portfolio evaluation.`;
    }

    return {
      score,
      evidence,
      projectCount,
      hasWorkingLinks,
      linksFound,
      complexitySignals,
      impactSignals,
      tutorialFlags,
    };
  }

  /**
   * Evaluates "Production Experience" category (inspired by HackerRank rubric).
   * Distinguishes professional roles from projects using production language, tenure, and infrastructure density.
   * Deterministic text and pattern-based calculation.
   */
  public auditProductionExperience(resumeText: string): ProductionExperienceAudit {
    const norm = resumeText.toLowerCase();
    const rawLines = resumeText.split(/\n+/).map(l => l.trim()).filter(Boolean);

    // 1. Detect Tenure Signals (Date Ranges)
    const dateRegex = /(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}|\d{4})\s*[-–—]\s*(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}|\d{4}|Present|Current)/gi;
    const tenureSignals = resumeText.match(dateRegex) || [];

    // 2. Detect Role Count
    const roleRegex = /(?:software\s+engineer(?:ing)?|developer|architect|team\s+lead|tech\s+lead|intern(?:ship)?|analyst|manager|consultant)/gi;
    const roleMatches = resumeText.match(roleRegex) || [];
    const roleCount = Math.max(tenureSignals.length, Math.min(4, Math.floor(roleMatches.length / 2)) || (resumeText.includes('EXPERIENCE') ? 1 : 0));

    // 3. Detect Production Keywords
    const productionKeywordsFound: string[] = [];
    for (const kw of PRODUCTION_KEYWORDS) {
      if (new RegExp(`\\b${kw}\\b`, 'i').test(norm)) {
        productionKeywordsFound.push(kw);
      }
    }

    // 4. Calculate Production Density Ratio
    const bullets = rawLines.filter(l => l.startsWith('•') || l.startsWith('-') || l.startsWith('*'));
    const prodBullets = bullets.filter(b => productionKeywordsFound.some(kw => b.toLowerCase().includes(kw)));
    const productionRatio = bullets.length > 0 ? Number((prodBullets.length / bullets.length).toFixed(2)) : 0;
    const isProductionHeavy = roleCount >= 2 || (productionKeywordsFound.length >= 6 && productionRatio >= 0.4);

    // 5. Best Representative Quote
    let bestQuote = '';
    if (prodBullets.length > 0) {
      bestQuote = prodBullets[0].replace(/^[•\-*]\s*/, '').slice(0, 120);
    } else if (bullets.length > 0) {
      bestQuote = bullets[0].replace(/^[•\-*]\s*/, '').slice(0, 100);
    }

    // 6. Calculate Deterministic Score
    let score = 25;
    if (roleCount > 0) score += Math.min(35, roleCount * 18);
    score += Math.min(30, productionKeywordsFound.length * 4);
    if (productionKeywordsFound.some(k => ['kubernetes', 'k8s', 'docker', 'ci/cd', 'aws', 'gcp'].includes(k))) score += 10;
    if (productionKeywordsFound.some(k => ['sla', 'slo', '99.9%', '99.99%', 'uptime', 'on-call', 'pagerduty', 'monitoring'].includes(k))) score += 10;
    score = Math.max(15, Math.min(100, Math.round(score)));

    // 7. Construct Evidence String
    let evidence = '';
    if (roleCount > 0 && productionKeywordsFound.length > 0) {
      evidence = `Production Experience: ${score}/100 — Identified ${roleCount} professional role(s) with ${productionKeywordsFound.length} production signal(s) (${productionKeywordsFound.slice(0, 4).join(', ')}). Evidence: "${bestQuote}" demonstrates ${isProductionHeavy ? 'enterprise reliability, SLA ownership, and ' : ''}production engineering maturity.`;
    } else {
      evidence = `Production Experience: ${score}/100 — No industry employment or production engineering history identified in resume text. Emphasize internships or work with live production infrastructure.`;
    }

    return {
      score,
      evidence,
      roleCount,
      productionKeywordsFound,
      tenureSignals,
      productionRatio,
      isProductionHeavy,
    };
  }

  /**
   * General Master Resume ATS Audit (Not tied to any single job opening).
   */
  public auditGeneralAts(
    resumeText: string,
    domain: string = 'Software Engineering',
    layoutInfo?: DocumentLayoutInfo,
    structuralParagraphs?: StructuralParagraph[]
  ): AtsScoreReport {
    const norm = resumeText.toLowerCase();
    const benchmarkSkills = DOMAIN_BENCHMARKS[domain] || DOMAIN_BENCHMARKS['Software Engineering'];

    const keywords: KeywordMatch[] = [];
    for (const skill of benchmarkSkills) {
      const found = this.matchKeywordWithAliases(skill, norm);
      keywords.push({
        keyword: skill,
        category: 'Hard Skill',
        foundInResume: found,
        frequencyInJD: 1,
        importance: 'Critical',
      });
    }

    // 1. Action Verb Strength Check
    const { strongCount, weakCount, weakVerbsFound, tier1Count } = this.auditActionVerbs(norm);
    const verbScore = Math.min(100, Math.max(30, Math.round(((tier1Count * 1.5 + strongCount) / (strongCount + weakCount * 2 || 1)) * 100)));

    // 2. Quantifiable Impact / Metric Score
    const { quantifiedBullets, totalBullets, percentage: metricPercentage } = this.auditQuantification(resumeText);
    const metricScore = Math.min(100, Math.max(25, metricPercentage));

    // 3. Formatting & Real Structural Layout Audit
    let formattingScore = this.evaluateFormatting(resumeText);
    let layoutReport: LayoutAuditReport | undefined;

    if (layoutInfo || (structuralParagraphs && structuralParagraphs.length > 0)) {
      layoutReport = this.layoutAnalyzer.analyze(layoutInfo, structuralParagraphs);
      formattingScore = layoutReport.overallScore;
    }

    // 4. Core Domain Benchmark Score
    const matchedCount = keywords.filter(k => k.foundInResume).length;
    const domainScore = Math.round((matchedCount / (keywords.length || 1)) * 100);

    // 5. HackerRank-Inspired Category Audits
    const selfProjectsAudit = this.auditSelfProjects(resumeText);
    const productionExperienceAudit = this.auditProductionExperience(resumeText);

    // Revised 7-Factor ATS Formula:
    // 30% Hard Skills, 15% Production Experience, 10% Self Projects, 15% Metrics, 15% Action Verbs, 10% Domain, 5% Formatting
    const overallScore = Math.round(
      (domainScore * 0.30) +
      (productionExperienceAudit.score * 0.15) +
      (selfProjectsAudit.score * 0.10) +
      (verbScore * 0.15) +
      (metricScore * 0.15) +
      (domainScore * 0.10) +
      (formattingScore * 0.05)
    );

    const suggestions: string[] = [];
    if (selfProjectsAudit.tutorialFlags.length > 0) {
      suggestions.push(`Self Projects: Replace generic tutorial phrasing (${selfProjectsAudit.tutorialFlags.slice(0, 2).map(f => `"${f}"`).join(', ')}) with original system architectures.`);
    }
    if (selfProjectsAudit.hasWorkingLinks === false && selfProjectsAudit.projectCount > 0) {
      suggestions.push('Self Projects: Add GitHub repository or live deployment URLs directly next to your project titles.');
    }
    if (productionExperienceAudit.score < 60) {
      suggestions.push('Production Experience: Emphasize CI/CD, Kubernetes/Docker, monitoring (Datadog/Prometheus), and SLA/uptime metrics in work experience.');
    }
    if (weakCount > 0) {
      suggestions.push(`Found ${weakCount} passive phrases (${weakVerbsFound.slice(0, 3).map(v => `"${v}"`).join(', ')}). Upgrade to Tier-1 STAR action verbs (e.g. Architected, Engineered, Spearheaded).`);
    }
    if (metricScore < 70) {
      suggestions.push('Add more quantifiable metrics (%, $, latency reductions, user scale, throughput) to prove measurable impact.');
    }
    if (domainScore < 60) {
      const missingDomain = keywords.filter(k => !k.foundInResume).slice(0, 3).map(k => k.keyword).join(', ');
      suggestions.push(`Add foundational ${domain} competencies to your skills & experience: ${missingDomain}.`);
    }
    if (layoutReport && layoutReport.issues.length > 0) {
      for (const issue of layoutReport.issues.slice(0, 2)) {
        suggestions.push(`Layout Notice: ${issue.title} — ${issue.description}`);
      }
    }

    return {
      overallScore,
      breakdown: {
        hardSkillsScore: domainScore,
        experienceRelevanceScore: Math.round((productionExperienceAudit.score * 0.6) + (domainScore * 0.4)),
        softSkillsScore: metricScore,
        formattingScore,
        starImpactScore: Math.round((verbScore + metricScore) / 2),
        actionVerbVitalityScore: verbScore,
        selfProjectsScore: selfProjectsAudit.score,
        productionExperienceScore: productionExperienceAudit.score,
      },
      totalKeywords: keywords.length,
      matchedKeywordsCount: matchedCount,
      missingKeywordsCount: keywords.length - matchedCount,
      keywords,
      improvementSuggestions: suggestions.length ? suggestions : ['Your master resume is in excellent ATS-ready shape!'],
      summaryFeedback: overallScore >= 80 
        ? 'Great universal ATS health! High action verb density and strong standard structure.'
        : 'Good foundation. Enhancing action verbs, production signals, and quantifiable metrics will increase ATS parsing score.',
      actionVerbStrength: {
        strongCount,
        weakCount,
        weakVerbsFound,
      },
      quantificationStats: {
        quantifiedBullets,
        totalBullets,
        percentage: metricPercentage,
      },
      selfProjectsAudit,
      productionExperienceAudit,
      layoutReport,
    };
  }

  /**
   * Job-specific ATS analysis with layout awareness.
   */
  public analyze(
    resumeText: string,
    jobDescription: string,
    layoutInfo?: DocumentLayoutInfo,
    structuralParagraphs?: StructuralParagraph[]
  ): AtsScoreReport {
    const normResume = resumeText.toLowerCase();
    const normJD = jobDescription.toLowerCase();

    const extractedKeywords: KeywordMatch[] = [];

    for (const [skill, meta] of Object.entries(SKILL_DICTIONARY)) {
      const isPresentInJD = this.matchKeywordWithAliases(skill, normJD);

      if (isPresentInJD) {
        const resumeMatch = this.matchKeywordWithAliases(skill, normResume);
        
        extractedKeywords.push({
          keyword: this.capitalizeWord(skill),
          category: meta.category,
          foundInResume: resumeMatch,
          frequencyInJD: 1,
          importance: meta.importance,
        });
      }
    }

    const dynamicKeywords = this.extractDynamicKeywords(normJD, normResume);
    for (const dk of dynamicKeywords) {
      if (!extractedKeywords.some(k => k.keyword.toLowerCase() === dk.keyword.toLowerCase())) {
        extractedKeywords.push(dk);
      }
    }

    extractedKeywords.sort((a, b) => {
      if (a.foundInResume === b.foundInResume) {
        return b.frequencyInJD - a.frequencyInJD;
      }
      return a.foundInResume ? 1 : -1;
    });

    const totalKeywords = extractedKeywords.length || 1;
    const matched = extractedKeywords.filter(k => k.foundInResume);
    const missing = extractedKeywords.filter(k => !k.foundInResume);

    const hardSkills = extractedKeywords.filter(k => k.category === 'Hard Skill' || k.category === 'Tool / Framework');
    const domainKnowledge = extractedKeywords.filter(k => k.category === 'Domain Knowledge');
    const softSkills = extractedKeywords.filter(k => k.category === 'Soft Skill');

    const hardScore = this.calcCategoryScore(hardSkills);
    const domainScore = this.calcCategoryScore(domainKnowledge);
    const softScore = this.calcCategoryScore(softSkills);

    // Formatting & Structural Layout Analysis
    let formattingScore = this.evaluateFormatting(resumeText);
    let layoutReport: LayoutAuditReport | undefined;

    if (layoutInfo || (structuralParagraphs && structuralParagraphs.length > 0)) {
      layoutReport = this.layoutAnalyzer.analyze(layoutInfo, structuralParagraphs);
      formattingScore = layoutReport.overallScore;
    }

    // STAR & Verb Auditing
    const { strongCount, weakCount, weakVerbsFound, tier1Count } = this.auditActionVerbs(normResume);
    const { quantifiedBullets, totalBullets, percentage: metricPercentage } = this.auditQuantification(resumeText);
    const verbScore = Math.min(100, Math.max(30, Math.round(((tier1Count * 1.5 + strongCount) / (strongCount + weakCount * 2 || 1)) * 100)));
    const starImpactScore = Math.min(100, Math.max(30, Math.round((verbScore * 0.5) + (metricPercentage * 0.5))));

    // HackerRank-Inspired Category Audits
    const selfProjectsAudit = this.auditSelfProjects(resumeText);
    const productionExperienceAudit = this.auditProductionExperience(resumeText);

    // Revised 7-Factor ATS Formula:
    // - 30% Hard Skills/Tools
    // - 15% Production Experience & Engineering Maturity
    // - 10% Self Projects (Complexity, Live Links, Anti-Tutorial)
    // - 15% Metric Quantification (%, $, scale)
    // - 15% Action Verb Vitality (Tier-1 STAR Verbs)
    // - 10% Domain Relevance
    // - 5% Formatting & Layout Hygiene
    const rawScore = Math.round(
      (hardScore * 0.30) +
      (productionExperienceAudit.score * 0.15) +
      (selfProjectsAudit.score * 0.10) +
      (metricPercentage * 0.15) +
      (verbScore * 0.15) +
      (domainScore * 0.10) +
      (formattingScore * 0.05)
    );
    const overallScore = Math.min(100, Math.max(15, rawScore));

    const suggestions: string[] = [];
    if (selfProjectsAudit.tutorialFlags.length > 0) {
      suggestions.push(`Self Projects: Upgrade tutorial-following project phrasing (${selfProjectsAudit.tutorialFlags.slice(0, 2).map(f => `"${f}"`).join(', ')}) with original system designs.`);
    }
    if (selfProjectsAudit.hasWorkingLinks === false && selfProjectsAudit.projectCount > 0) {
      suggestions.push('Self Projects: Add GitHub repository or live deployment URLs directly next to your project titles.');
    }
    if (productionExperienceAudit.score < 60) {
      suggestions.push('Production Experience: Weave CI/CD pipelines, container orchestration (Docker/Kubernetes), and SLA/uptime metrics into work experience.');
    }
    if (missing.some(k => k.importance === 'Critical')) {
      const critMissing = missing.filter(k => k.importance === 'Critical').slice(0, 3).map(k => k.keyword).join(', ');
      suggestions.push(`High priority missing keywords: ${critMissing}. Weave these into your project or experience bullets.`);
    }
    if (hardScore < 60) {
      suggestions.push('Core technical skills alignment is low. Highlight relevant languages and frameworks in Experience and Skills.');
    }
    if (weakCount > 0) {
      suggestions.push(`Replace ${weakCount} passive phrases (${weakVerbsFound.slice(0, 2).map(v => `"${v}"`).join(', ')}) with punchy Tier-1 STAR action verbs.`);
    }
    if (metricPercentage < 50) {
      suggestions.push('Under 50% of your bullets have numbers. Add measurable impact metrics (%, scale, throughput, users).');
    }
    if (layoutReport && layoutReport.issues.length > 0) {
      for (const issue of layoutReport.issues.slice(0, 2)) {
        suggestions.push(`Layout Notice: ${issue.title} — ${issue.description}`);
      }
    }

    return {
      overallScore,
      breakdown: {
        hardSkillsScore: hardScore,
        experienceRelevanceScore: Math.round((productionExperienceAudit.score * 0.6) + (domainScore * 0.4)),
        softSkillsScore: softScore,
        formattingScore,
        starImpactScore,
        actionVerbVitalityScore: verbScore,
        selfProjectsScore: selfProjectsAudit.score,
        productionExperienceScore: productionExperienceAudit.score,
      },
      totalKeywords,
      matchedKeywordsCount: matched.length,
      missingKeywordsCount: missing.length,
      keywords: extractedKeywords,
      improvementSuggestions: suggestions.length ? suggestions : ['Excellent keyword alignment!'],
      summaryFeedback: overallScore >= 80 
        ? 'Great match! Your resume strongly aligns with the target job opening.'
        : overallScore >= 60
        ? 'Moderate match. Injecting missing key competencies will noticeably boost ATS visibility.'
        : 'Low match. Several critical technical requirements from the job description are absent from your resume.',
      actionVerbStrength: {
        strongCount,
        weakCount,
        weakVerbsFound,
      },
      quantificationStats: {
        quantifiedBullets,
        totalBullets,
        percentage: metricPercentage,
      },
      selfProjectsAudit,
      productionExperienceAudit,
      layoutReport,
    };
  }

  /**
   * Helper: Matches a keyword and any of its technical aliases
   */
  private matchKeywordWithAliases(keyword: string, text: string): boolean {
    const cleanKw = keyword.toLowerCase();
    if (new RegExp(`\\b${this.escapeRegex(cleanKw)}\\b`, 'i').test(text)) {
      return true;
    }

    // Check alias mapping
    const aliases = SKILL_ALIASES[cleanKw] || [];
    for (const alias of aliases) {
      if (new RegExp(`\\b${this.escapeRegex(alias)}\\b`, 'i').test(text)) {
        return true;
      }
    }

    return false;
  }

  private auditActionVerbs(normText: string): { strongCount: number; weakCount: number; weakVerbsFound: string[]; tier1Count: number } {
    let strongCount = 0;
    let weakCount = 0;
    let tier1Count = 0;
    const weakVerbsFound: string[] = [];

    for (const v of TIER_1_ACTION_VERBS) {
      if (new RegExp(`\\b${v}\\b`, 'i').test(normText)) tier1Count++;
    }
    for (const v of STRONG_STAR_VERBS) {
      if (new RegExp(`\\b${v}\\b`, 'i').test(normText)) strongCount++;
    }
    for (const w of WEAK_PASSIVE_VERBS) {
      if (new RegExp(`\\b${w}\\b`, 'i').test(normText)) {
        weakCount++;
        weakVerbsFound.push(w);
      }
    }

    return { strongCount, weakCount, weakVerbsFound, tier1Count };
  }

  private auditQuantification(text: string): { quantifiedBullets: number; totalBullets: number; percentage: number } {
    const rawLines = text.split(/\n+/).map(l => l.trim()).filter(l => l.length > 20);
    const bullets = rawLines.filter(l => l.startsWith('•') || l.startsWith('-') || l.startsWith('*') || /^[A-Z]/.test(l));
    const total = bullets.length || 1;

    let quantified = 0;
    const metricRegex = /\b\d+\s*%|\$\d+(?:,\d{3})*(?:\.\d+)?|\b\d+x\b|\b\d+\s*(?:k|m|b|ms|μs|us|sec|seconds|minutes|hours|days|users|dau|mau|clients|engineers|requests|rps|qps|queries|downloads|percent|pts|gb|tb|pb)\b/i;

    for (const b of bullets) {
      if (metricRegex.test(b)) quantified++;
    }

    const percentage = Math.round((quantified / total) * 100);
    return { quantifiedBullets: quantified, totalBullets: total, percentage };
  }

  private calcCategoryScore(items: KeywordMatch[]): number {
    if (items.length === 0) return 85;
    const matched = items.filter(k => k.foundInResume).length;
    return Math.round((matched / items.length) * 100);
  }

  private evaluateFormatting(text: string): number {
    let score = 80;
    const hasBullets = text.includes('•') || text.includes('- ') || text.includes('* ');
    const hasMetrics = /\b\d+%\b|\$\d+|\b\d+x\b|\b\d+\s+(users|clients|engineers|requests|queries|downloads)\b/i.test(text);
    const hasExperience = /experience|employment|work history/i.test(text);
    const hasEducation = /education|university|college|bachelor|master|phd/i.test(text);
    const hasSkills = /skills|technologies|proficiencies/i.test(text);
    
    if (hasBullets) score += 5;
    if (hasMetrics) score += 5;
    if (hasExperience) score += 4;
    if (hasEducation) score += 3;
    if (hasSkills) score += 3;

    return Math.min(100, score);
  }

  private extractDynamicKeywords(normJD: string, normResume: string): KeywordMatch[] {
    const dynamic: KeywordMatch[] = [];
    const candidates = [
      'distributed systems', 'full-stack development', 'data pipelines', 'cloud infrastructure',
      'code reviews', 'api integration', 'latency optimization', 'system architecture',
      'cross-platform', 'event-driven architecture', 'real-time systems', 'fault tolerance',
      'ci/cd pipeline', 'infrastructure as code', 'load testing', 'threat modeling',
      'concurrency', 'data modeling'
    ];
    
    for (const term of candidates) {
      if (normJD.includes(term) && !SKILL_DICTIONARY[term]) {
        dynamic.push({
          keyword: this.capitalizeWord(term),
          category: 'Domain Knowledge',
          foundInResume: this.matchKeywordWithAliases(term, normResume),
          frequencyInJD: 1,
          importance: 'Recommended',
        });
      }
    }
    return dynamic;
  }

  private escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private capitalizeWord(str: string): string {
    return str.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }
}
