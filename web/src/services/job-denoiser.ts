/**
 * JobDeNoiserService — Strips non-evaluative boilerplate, legal disclaimers,
 * and HR filler from raw job postings while extracting structured requirements
 * and semantic skill graphs.
 */

export interface DenoisedJobReport {
  cleanDescription: string;
  originalLength: number;
  cleanLength: number;
  noiseReductionRatio: number; // e.g. 0.45 = 45% noise removed
  detectedSeniority: 'Intern' | 'New Grad' | 'Junior' | 'Mid-Level' | 'Senior' | 'Staff / Principal' | 'Lead / Manager';
  tier1HardSkills: string[];
  tier2PreferredSkills: string[];
  impliedCompetencies: string[]; // Expanded technical signals from semantic skill graph
  coreResponsibilities: string[];
  minimumQualifications: string[];
}

// ── Semantic Skill Graph ──────────────────────────────────────────────────────
// Maps high-level architecture concepts in JDs to concrete technical implementations
export const SEMANTIC_SKILL_GRAPH: Record<string, string[]> = {
  'distributed systems': ['Raft', 'Paxos', 'Consistent Hashing', 'Replication', 'gRPC', 'Protobuf', 'CAP Theorem'],
  'high throughput': ['Kafka', 'RabbitMQ', 'Redis Caching', 'Connection Pooling', 'Load Balancing', 'Async I/O'],
  'caching': ['Redis', 'Memcached', 'Cache-Aside', 'Write-Through', 'TTL Eviction'],
  'observability': ['Prometheus', 'Grafana', 'Datadog', 'OpenTelemetry', 'Distributed Tracing', 'SLOs', 'SLAs'],
  'reliability': ['Fault Tolerance', 'Circuit Breaker', 'High Availability', 'Multi-Region Failover', '99.99% Uptime'],
  'cloud native': ['Docker', 'Kubernetes', 'AWS', 'GCP', 'Terraform', 'Helm', 'CI/CD Pipelines'],
  'microservices': ['REST APIs', 'gRPC', 'Service Mesh', 'API Gateway', 'Event-Driven Architecture'],
  'database optimization': ['PostgreSQL', 'Index Tuning', 'EXPLAIN ANALYZE', 'Read Replicas', 'Connection Pooling'],
  'machine learning systems': ['PyTorch', 'TensorFlow', 'Model Serving', 'Inference Latency', 'Vector Embeddings', 'RAG'],
  'frontend architecture': ['React', 'TypeScript', 'State Management', 'Core Web Vitals', 'SSR', 'Component Design'],
};

// ── Boilerplate & Noise Patterns ─────────────────────────────────────────────
const NOISE_SECTION_PATTERNS = [
  // EEO & Diversity statements
  /(?:equal (?:employment )?opportunity|eeo|we are an equal opportunity|diversity, equity|affirmative action)[\s\S]*?(?=\n\s*(?:requirements|responsibilities|qualifications|about you|$))/gi,
  /(?:all qualified applicants will receive consideration)[\s\S]*?(?=\n\s*(?:requirements|responsibilities|qualifications|$))/gi,
  // Benefits & Compensation filler
  /(?:benefits|perks|what we offer|why you'll love working here|compensation & benefits)[\s\S]*?(?=\n\s*(?:requirements|qualifications|responsibilities|about the role|$))/gi,
  /(?:401\(k\)|health insurance|dental and vision|unlimited pto|gym stipend|pet insurance|free lunch)[\s\S]*?(?=\n\s*(?:requirements|qualifications|$))/gi,
  // Physical / Workplace requirements
  /(?:physical requirements|ability to sit|lift up to|prolonged periods of sitting|covid-19 vaccination)[\s\S]*?(?=\n\s*(?:requirements|qualifications|$))/gi,
  // Generic legal / boilerplate footer
  /(?:this job description is subject to change|salary range:? \$[\d,]+|pay transparency)[\s\S]*$/gi,
];

export class JobDeNoiserService {
  /**
   * Sanitizes, de-noises, and extracts structured intelligence from a raw job posting.
   */
  public denoise(rawJobDescription: string): DenoisedJobReport {
    const originalLength = rawJobDescription.length;
    if (!rawJobDescription || !rawJobDescription.trim()) {
      return {
        cleanDescription: '',
        originalLength: 0,
        cleanLength: 0,
        noiseReductionRatio: 0,
        detectedSeniority: 'Mid-Level',
        tier1HardSkills: [],
        tier2PreferredSkills: [],
        impliedCompetencies: [],
        coreResponsibilities: [],
        minimumQualifications: [],
      };
    }

    let clean = rawJobDescription;

    // 1. Strip identifiable noise sections
    for (const pattern of NOISE_SECTION_PATTERNS) {
      clean = clean.replace(pattern, '');
    }

    // 2. Normalize whitespace and broken line artifacts
    clean = clean
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    // If aggressive noise removal removed too much, fall back to preserving original
    if (clean.length < 120 && originalLength > 200) {
      clean = rawJobDescription.trim();
    }

    const cleanLength = clean.length;
    const noiseReductionRatio = Number(
      Math.max(0, (originalLength - cleanLength) / (originalLength || 1)).toFixed(2)
    );

    // 3. Detect Seniority Tier
    const detectedSeniority = this.detectSeniority(clean);

    // 4. Extract Minimum Qualifications & Core Responsibilities
    const { minimumQualifications, coreResponsibilities } = this.extractSections(clean);

    // 5. Categorize Tier-1 vs Tier-2 Skills
    const { tier1HardSkills, tier2PreferredSkills } = this.extractSkillTiers(clean);

    // 6. Expand Semantic Skill Graph
    const impliedCompetencies = this.expandSkillGraph(clean, tier1HardSkills);

    return {
      cleanDescription: clean,
      originalLength,
      cleanLength,
      noiseReductionRatio,
      detectedSeniority,
      tier1HardSkills,
      tier2PreferredSkills,
      impliedCompetencies,
      coreResponsibilities,
      minimumQualifications,
    };
  }

  private detectSeniority(text: string): DenoisedJobReport['detectedSeniority'] {
    const lower = text.toLowerCase();
    if (/\b(?:intern|internship|co-op|summer 2026)\b/i.test(lower)) return 'Intern';
    if (/\b(?:new grad|fresh graduate|entry level|university graduate|class of 2026)\b/i.test(lower)) return 'New Grad';
    if (/\b(?:junior|associate|software engineer i\b|swe i\b)\b/i.test(lower)) return 'Junior';
    if (/\b(?:staff|principal|distinguished|architect)\b/i.test(lower)) return 'Staff / Principal';
    if (/\b(?:senior|sr\.?|lead|software engineer iii|swe iii)\b/i.test(lower)) return 'Senior';
    if (/\b(?:manager|director|vp|head of)\b/i.test(lower)) return 'Lead / Manager';
    return 'Mid-Level';
  }

  private extractSections(text: string): { minimumQualifications: string[]; coreResponsibilities: string[] } {
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    const minimumQualifications: string[] = [];
    const coreResponsibilities: string[] = [];

    let currentSection: 'none' | 'reqs' | 'resps' = 'none';

    for (const line of lines) {
      if (/(?:minimum|basic|required|what you('ll)? (need|bring)|qualifications|requirements)/i.test(line)) {
        currentSection = 'reqs';
        continue;
      } else if (/(?:responsibilities|what you('ll)? do|your role|day-to-day)/i.test(line)) {
        currentSection = 'resps';
        continue;
      } else if (/(?:preferred|bonus|nice to have|about the team|benefits)/i.test(line)) {
        currentSection = 'none';
        continue;
      }

      if (line.startsWith('•') || line.startsWith('-') || line.startsWith('*')) {
        const item = line.replace(/^[•\-*]\s*/, '').trim();
        if (currentSection === 'reqs' && item.length > 10) {
          minimumQualifications.push(item);
        } else if (currentSection === 'resps' && item.length > 10) {
          coreResponsibilities.push(item);
        }
      }
    }

    return { minimumQualifications, coreResponsibilities };
  }

  private extractSkillTiers(text: string): { tier1HardSkills: string[]; tier2PreferredSkills: string[] } {
    const commonSkills = [
      'Python', 'Go', 'Golang', 'TypeScript', 'JavaScript', 'Java', 'C++', 'Rust', 'SQL',
      'PostgreSQL', 'Redis', 'Docker', 'Kubernetes', 'AWS', 'GCP', 'Azure', 'Kafka',
      'React', 'Next.js', 'Node.js', 'FastAPI', 'Spring Boot', 'GraphQL', 'gRPC', 'Microservices',
      'Terraform', 'CI/CD', 'Git'
    ];

    const lower = text.toLowerCase();
    const tier1HardSkills: string[] = [];
    const tier2PreferredSkills: string[] = [];

    for (const skill of commonSkills) {
      const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}\\b`, 'i');
      if (regex.test(lower)) {
        // If skill appears in minimum qualifications or more than once, it's Tier-1
        const matches = lower.match(new RegExp(`\\b${escaped}\\b`, 'gi')) || [];
        if (matches.length >= 2 || /(?:required|minimum|must have|strong proficiency)/i.test(lower)) {
          tier1HardSkills.push(skill);
        } else {
          tier2PreferredSkills.push(skill);
        }
      }
    }

    return {
      tier1HardSkills: Array.from(new Set(tier1HardSkills)),
      tier2PreferredSkills: Array.from(new Set(tier2PreferredSkills)),
    };
  }

  private expandSkillGraph(text: string, existingSkills: string[]): string[] {
    const lower = text.toLowerCase();
    const implied: string[] = [];

    for (const [concept, concreteTechs] of Object.entries(SEMANTIC_SKILL_GRAPH)) {
      if (lower.includes(concept)) {
        for (const tech of concreteTechs) {
          if (!existingSkills.some((s) => s.toLowerCase() === tech.toLowerCase())) {
            implied.push(tech);
          }
        }
      }
    }

    return Array.from(new Set(implied)).slice(0, 8);
  }
}

export { JobDeNoiserService as JobDenoiserService };
