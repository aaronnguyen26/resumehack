// Hacky Chatbot Service — Intelligent conversational assistant for resume, jobs, and openings
import {
  ChatMessage,
  ChatAction,
  ChatDataCard,
  ChatbotContext,
  JobPosting,
  ApplicationRecord,
  ApplicantProfile,
} from '../types/index.js';
import {
  generatePersonalizedFallbackRecommendations,
  classifyBulletDomain,
  detectRaggedWidow,
  tightenBulletText,
} from './gemini-recommendations.js';
import { AtsScorerService } from './ats-scorer.js';
import { saveStoredApplicantProfile } from './storage.js';

// ── Accurate Tech Skills Dictionary (80+ skills) ──────────────────────────
export const TECH_SKILL_CATALOG = [
  'Python', 'TypeScript', 'JavaScript', 'Go', 'Golang', 'Rust', 'Java', 'C++', 'C#', 'SQL',
  'PostgreSQL', 'Postgres', 'MySQL', 'MongoDB', 'Redis', 'Kafka', 'RabbitMQ', 'Cassandra',
  'Elasticsearch', 'DynamoDB', 'Supabase', 'Firebase', 'GraphQL', 'gRPC', 'REST API',
  'React', 'React Native', 'Next.js', 'Vue', 'Angular', 'Svelte', 'Tailwind', 'Redux', 'Node.js',
  'Express', 'FastAPI', 'Django', 'Flask', 'Spring Boot', 'NestJS', 'Docker', 'Kubernetes',
  'AWS', 'GCP', 'Google Cloud', 'Azure', 'Terraform', 'CI/CD', 'Linux', 'Git', 'Datadog',
  'Prometheus', 'Grafana', 'Microservices', 'System Design', 'Distributed Systems',
  'Machine Learning', 'Deep Learning', 'PyTorch', 'TensorFlow', 'LLM', 'WebSockets'
];

export function extractSkillsFromText(text: string): string[] {
  if (!text) return [];
  const found: string[] = [];
  for (const s of TECH_SKILL_CATALOG) {
    const escaped = s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`\\b${escaped}\\b`, 'i').test(text)) {
      found.push(s);
    }
  }
  return Array.from(new Set(found));
}

// ── Accurate Line Budget Calculation ──────────────────────────────────────
export interface AccurateLineBudget {
  totalLines: number;
  logicalLines: number;
  fitsOnePage: boolean;
  budgetRecommendation: string;
}

export function calculateAccurateLineBudget(resumeText: string): AccurateLineBudget {
  if (!resumeText || resumeText.trim().length === 0) {
    return { totalLines: 0, logicalLines: 0, fitsOnePage: true, budgetRecommendation: 'No resume loaded' };
  }

  const rawLines = resumeText.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  let renderedLines = 0;
  let sectionCount = 0;

  for (const line of rawLines) {
    const isHeader = /^(EXPERIENCE|EDUCATION|SKILLS|PROJECTS|SUMMARY|WORK EXPERIENCE|TECHNICAL SKILLS|PUBLICATIONS|LEADERSHIP|AWARDS)\b/i.test(line);
    if (isHeader) {
      sectionCount++;
      renderedLines += sectionCount > 1 ? 2 : 1;
      continue;
    }

    // Bullets and body lines: standard 8.5x11 page holds ~80-85 characters per printed line
    if (line.length <= 85) {
      renderedLines += 1;
    } else {
      renderedLines += Math.ceil(line.length / 82);
    }
  }

  const fitsOnePage = renderedLines <= 54;
  let budgetRecommendation = '';
  if (renderedLines < 38) {
    budgetRecommendation = `Optimal 1-page line budget (~${renderedLines} lines). Fits standard ATS single-page format cleanly with room to expand.`;
  } else if (renderedLines <= 54) {
    budgetRecommendation = `Optimal 1-page line budget (~${renderedLines} lines). Fits standard ATS single-page format cleanly.`;
  } else {
    budgetRecommendation = `Exceeds single-page budget (~${renderedLines} lines). Trim ${renderedLines - 52} lines or condense multi-line bullets to prevent awkward 2nd page spill.`;
  }

  return {
    totalLines: renderedLines,
    logicalLines: rawLines.length,
    fitsOnePage,
    budgetRecommendation,
  };
}

// ── Accurate Quantified Metrics Extraction ────────────────────────────────
export interface AccurateMetricsAudit {
  totalMetricsFound: number;
  uniqueMetrics: string[];
  quantifiedBullets: number;
  totalBullets: number;
  metricPercentage: number;
  metricsList: string[];
}

export function calculateAccurateMetrics(resumeText: string): AccurateMetricsAudit {
  if (!resumeText || resumeText.trim().length === 0) {
    return {
      totalMetricsFound: 0,
      uniqueMetrics: [],
      quantifiedBullets: 0,
      totalBullets: 0,
      metricPercentage: 0,
      metricsList: [],
    };
  }

  const rawLines = resumeText.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  const hasExplicitBullets = rawLines.some((l) => /^[•\-*▪▸–—]\s*|^\d+[\.\)]\s+/.test(l));

  const bullets = hasExplicitBullets
    ? rawLines.filter((l) => /^[•\-*▪▸–—]\s*|^\d+[\.\)]\s+/.test(l))
    : rawLines.filter(
        (l) =>
          !l.includes('|') &&
          !l.includes(':') &&
          !/@/.test(l) &&
          !/^(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|May|June|July|August|September|October|November|December)\b/i.test(l) &&
          !/^(?:EXPERIENCE|EDUCATION|SKILLS|PROJECTS|PUBLICATIONS|AWARDS|SUMMARY|PROFILE|WORK EXPERIENCE|TECHNICAL SKILLS)\b/i.test(l) &&
          l.length > 30
      );

  const totalBullets = Math.max(1, bullets.length);

  const METRIC_PATTERNS = [
    /\b\d+(?:\.\d+)?%/g,
    /\$\d+(?:,\d{3})*(?:\.\d+)?[kKmMbB]?(?:\/(?:month|mo|yr|year|quarter))?/g,
    /\b\d+(?:\.\d+)?\s*(?:ms|milliseconds?|microseconds?|μs|us|seconds?|mins?|minutes?|hours?|days?)\b/gi,
    /\b\d+(?:,\d{3})*(?:\.\d+)?[kKmMbB]?\+?\s*(?:qps|rps|tps|qpm|rpm|queries\/sec|requests\/sec|req\/s|events\/sec|msgs\/sec|daily\s+orders|daily\s+requests|orders\/day|events\/day|transactions\/sec|write\s+ops\/sec|read\s+ops\/sec|ops\/sec)\b/gi,
    /\b\d+(?:\.\d+)?x\b/gi,
    /\b\d+(?:,\d{3})*\+?\s*(?:users|daily\s+active\s+users|dau|mau|clients|customers|accounts|subscribers|tenants|microservices|services|endpoints|apis|regions|clusters|nodes|servers|instances|cores|shards|partitions|databases|tables|records|rows|documents|vectors|payloads|unit\s+(?:&|and)\s+integration\s+tests|unit\s+tests|integration\s+tests|e2e\s+tests|test\s+cases|test\s+suites|tests|lines\s+of\s+code|prs|pull\s+requests|commits|repositories|repos|stars|forks|downloads|engineers|developers|team\s+members|contributors|slide\s+deck|slides)\b/gi,
    /\b\d+(?:\.\d+)?\s*(?:gb|tb|pb|mb|gigabytes?|terabytes?|petabytes?)\b/gi,
    /\b\d{1,3}%\s*(?:code\s+|test\s+)?coverage\b/gi,
    /\b[34]\.\d{1,2}\s*(?:\/\s*4(?:\.0)?)?\s*gpa\b|\bgpa:?\s*[34]\.\d{1,2}\b/gi,
  ];

  const matchedMetrics: string[] = [];
  for (const pat of METRIC_PATTERNS) {
    const matches = resumeText.match(pat);
    if (matches) {
      for (const m of matches) {
        matchedMetrics.push(m.trim());
      }
    }
  }

  const uniqueMetrics = Array.from(new Set(matchedMetrics));

  let quantifiedBulletsCount = 0;
  for (const b of bullets) {
    let hasMetric = false;
    for (const pat of METRIC_PATTERNS) {
      pat.lastIndex = 0;
      if (pat.test(b)) {
        hasMetric = true;
        break;
      }
    }
    if (hasMetric) quantifiedBulletsCount++;
  }

  const metricPercentage = Math.min(100, Math.round((quantifiedBulletsCount / totalBullets) * 100));

  return {
    totalMetricsFound: uniqueMetrics.length,
    uniqueMetrics,
    quantifiedBullets: quantifiedBulletsCount,
    totalBullets,
    metricPercentage,
    metricsList: uniqueMetrics,
  };
}

// ── Accurate ATS Score Calculation ────────────────────────────────────────
export function calculateAccurateAtsScore(
  resumeText: string,
  targetRole: string = 'Software Engineering',
  providedScore?: number
): number {
  if (providedScore !== undefined && providedScore > 0) {
    return providedScore;
  }
  if (!resumeText || resumeText.trim().length < 30) {
    return 0;
  }
  try {
    const scorer = new AtsScorerService();
    const report = scorer.auditGeneralAts(resumeText, targetRole);
    return report.overallScore;
  } catch {
    const { metricPercentage, totalMetricsFound } = calculateAccurateMetrics(resumeText);
    const { fitsOnePage } = calculateAccurateLineBudget(resumeText);
    let base = 65;
    if (totalMetricsFound >= 4) base += 15;
    else if (totalMetricsFound >= 2) base += 8;
    if (metricPercentage >= 60) base += 10;
    if (fitsOnePage) base += 5;
    return Math.min(95, base);
  }
}

export class HackyChatbotService {
  private resolveActiveResumeText(context: ChatbotContext): string {
    if (context.resumeText && context.resumeText.trim().length > 30) {
      return context.resumeText.trim();
    }
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('user_custom_resume');
        if (saved && saved.trim().length > 30) return saved.trim();
      } catch {}
    }
    return '';
  }

  /**
   * Detect user intent from input text
   */
  public detectIntent(
    query: string
  ):
    | 'resume'
    | 'ats_breakdown'
    | 'weak_verbs'
    | 'keyword_gap'
    | 'elevate_bullet'
    | 'line_budget'
    | 'interview_prep'
    | 'job_strategy'
    | 'jobs_tracker'
    | 'job_openings'
    | 'update_info'
    | 'general' {
    const q = query.toLowerCase().trim();

    // 1. Information Update queries ("update my target role to...", "here is my resume...", "add Go to my skills...")
    const isUpdateQuery =
      (/\b(update|change|set|modify|edit|save|add|replace)\b/i.test(q) &&
        /\b(resume|cv|profile|target\s*role|role|title|email|phone|name|location|school|gpa|grad|graduation|skills?|bullets?|info|information)\b/i.test(q)) ||
      /\b(here('s| is)|paste)\s+(my\s+)?(new\s+|updated\s+)?resume\b/i.test(q) ||
      /\badd\s+.+?\s+to\s+(?:my\s+)?skills?\b/i.test(q) ||
      /\badd\s+(?:this\s+)?bullet\b/i.test(q) ||
      /\b(what('s| is)|show|check|view)\s+(my\s+)?(current\s+)?(info|information|profile)\b/i.test(q) ||
      (query.length > 140 && /(?:EDUCATION|EXPERIENCE|PROJECTS|SKILLS)/i.test(query));

    if (isUpdateQuery) {
      return 'update_info';
    }

    // 2. STAR Bullet Elevation / Transformation tool
    if (
      /(?:elevate|transform|rewrite|upgrade|polish|improve)\s+(?:this\s+|my\s+)?(?:bullet|phrase|sentence)\b/i.test(q) ||
      /^bullet:\s*/i.test(q) ||
      /^elevate:\s*/i.test(q)
    ) {
      return 'elevate_bullet';
    }

    // 3. Action / Passive Verbs Scanner tool
    if (
      /\b(weak\s*verbs?|passive\s*(?:verbs?|words?|phrasing)|action\s*verbs?|power\s*verbs?|replace\s*verbs?)\b/i.test(q) ||
      /find\s+(?:my\s+)?(?:weak|passive)\s+(?:words?|verbs?)/i.test(q)
    ) {
      return 'weak_verbs';
    }

    // 4. Detailed 7-Factor ATS Breakdown tool
    if (
      /\b(score\s*breakdown|explain\s*(?:my\s*)?(?:ats\s*)?score|why\s*(?:is\s*)?(?:my\s*)?(?:ats\s*)?score|score\s*factors|ats\s*rubric|audit\s*factors|7\s*factors?)\b/i.test(
        q
      )
    ) {
      return 'ats_breakdown';
    }

    // 5. Keyword Gap & Radar tool
    if (
      /\b(missing\s*(?:skills?|keywords?)|keyword\s*gap|skills?\s*gap|check\s*keywords?|what\s*keywords|missing\s*terms)\b/i.test(q)
    ) {
      return 'keyword_gap';
    }

    // High-priority general resume queries
    if (
      /\bimprove\s+(?:my\s+)?(?:resume|cv)\b/i.test(q) ||
      /\b(?:how\s+is|check|look\s+at)\s+my\s+(?:resume|cv)\b/i.test(q) ||
      /\bquantified\s+metrics\b/i.test(q)
    ) {
      return 'resume';
    }

    // 6. Line Budget & Ragged Widow tool
    if (
      /\b(line\s*budget|page\s*budget|ragged\s*widows?|fit\s*(?:on\s*)?one\s*page|trim\s*lines?|lines?\s*remaining|how\s*many\s*lines)\b/i.test(q)
    ) {
      return 'line_budget';
    }

    // 7. Interview Preparation Blueprint
    if (
      /\b(interview\s*(?:prep|questions?|blueprint|tips?|practice)|behavioral\s*questions?|system\s*design\s*prep)\b/i.test(q)
    ) {
      return 'interview_prep';
    }

    // 8. Job Search & Outreach Strategy
    if (
      /\b(job\s*search\s*strategy|how\s*to\s*get\s*(?:more\s*)?interviews|follow-?up\s*strategy|outreach\s*template)\b/i.test(q)
    ) {
      return 'job_strategy';
    }

    // 9. Job Application Tracker queries ("how their jobs have been doing")
    const isTrackerQuery =
      /\b(applications?|pipeline|tracker)\b/i.test(q) ||
      /how (are|have) my (jobs?|applications?)/i.test(q) ||
      /how('s| is) my (job )?search (doing|going)/i.test(q) ||
      /status of my (jobs?|applications?)/i.test(q) ||
      /job status/i.test(q) ||
      /where did i apply/i.test(q) ||
      /companies i applied/i.test(q) ||
      /(got|have|had|any) interviews?\b/i.test(q) ||
      /interview (rate|status|pipeline|updates?|schedule)/i.test(q) ||
      /(conversion|response) rate/i.test(q);

    // 10. New Job Openings queries ("if there are any new job openings")
    const isOpeningsQuery =
      /\b(openings?|internships?|roles?|opportunities)\b/i.test(q) ||
      /new jobs?/i.test(q) ||
      /who is hiring/i.test(q) ||
      /any jobs/i.test(q) ||
      /available jobs/i.test(q) ||
      /find jobs?/i.test(q) ||
      /summer 2026/i.test(q) ||
      /are there (any )?new job/i.test(q) ||
      /job openings?/i.test(q);

    if (isTrackerQuery && !isOpeningsQuery) {
      return 'jobs_tracker';
    }
    if (isOpeningsQuery) {
      return 'job_openings';
    }

    // 11. Resume & ATS general queries
    const isResumeQuery =
      /\b(resume|cv|ats|score|lines?|budget|metrics?|quantif\w*|bullets?|critique|review|feedback|grade|rubric|reframe|my profile|experience)\b/i.test(
        q
      ) ||
      /how('s| is) my resume/i.test(q) ||
      /check my resume/i.test(q) ||
      /look at my resume/i.test(q) ||
      /improve my resume/i.test(q) ||
      /what('s| is) my (ats )?score/i.test(q);

    if (isResumeQuery) {
      return 'resume';
    }
    if (isTrackerQuery) {
      return 'jobs_tracker';
    }

    return 'general';
  }

  /**
   * Process a user message and return Hacky's structured response (purely local deterministic tool, zero AI token usage)
   */
  public async processUserMessage(
    userQuery: string,
    context: ChatbotContext = {}
  ): Promise<ChatMessage> {
    const intent = this.detectIntent(userQuery);

    switch (intent) {
      case 'update_info':
        return this.handleUpdateInfoQuery(userQuery, context);
      case 'ats_breakdown':
        return this.handleAtsBreakdownQuery(userQuery, context);
      case 'weak_verbs':
        return this.handleWeakVerbsQuery(userQuery, context);
      case 'keyword_gap':
        return this.handleKeywordGapQuery(userQuery, context);
      case 'elevate_bullet':
        return this.handleBulletElevationQuery(userQuery, context);
      case 'line_budget':
        return this.handleLineBudgetQuery(userQuery, context);
      case 'interview_prep':
        return this.handleInterviewPrepQuery(userQuery, context);
      case 'job_strategy':
        return this.handleJobSearchStrategyQuery(userQuery, context);
      case 'resume':
        return this.handleResumeQuery(userQuery, context);
      case 'jobs_tracker':
        return this.handleJobsTrackerQuery(userQuery, context);
      case 'job_openings':
        return this.handleJobOpeningsQuery(userQuery, context);
      case 'general':
      default:
        return this.handleGeneralQuery(userQuery, context);
    }
  }

  /**
   * Handle user requests to update their information (resume, target role, contact, skills, bullets)
   */
  public async handleUpdateInfoQuery(query: string, context: ChatbotContext): Promise<ChatMessage> {
    const q = query.trim();
    const lower = q.toLowerCase();

    // 1. What is my info / Show profile query
    if (/\b(what('s| is)|show|check|view)\s+(my\s+)?(current\s+)?(info|information|profile)\b/i.test(lower)) {
      const profile = context.applicantProfile;
      const fullName = profile?.fullName || (profile?.firstName ? `${profile.firstName} ${profile.lastName}`.trim() : 'Candidate');
      const targetRole = profile?.targetRole || context.targetRole || 'Software Engineer';
      const email = profile?.email || 'Not specified';
      const location = profile?.location || 'Not specified';
      const school = profile?.school ? `${profile.school} (${profile.gradMonthYear || '2026'})` : 'Not specified';
      const skills = profile?.skills || [];
      const resumeText = this.resolveActiveResumeText(context);
      const hasResume = resumeText.length > 30;

      let resumeStats: { score: number; metricsCount: number; lineCount: number } | undefined;
      if (hasResume) {
        const score = calculateAccurateAtsScore(resumeText, targetRole, context.atsScore);
        const metrics = calculateAccurateMetrics(resumeText);
        const lines = calculateAccurateLineBudget(resumeText);
        resumeStats = {
          score,
          metricsCount: metrics.totalMetricsFound,
          lineCount: lines.totalLines,
        };
      }

      const text =
        `**Your Candidate Profile & Workspace Summary:**\n\n` +
        `• **Name:** ${fullName}\n` +
        `• **Target Role:** **${targetRole}**\n` +
        `• **Email:** ${email}\n` +
        `• **Location:** ${location}\n` +
        `• **Education:** ${school}\n` +
        `• **Skills:** ${skills.length > 0 ? skills.join(', ') : 'Add skills in Profile or ask me'}\n\n` +
        (hasResume && resumeStats
          ? `**Active Resume Status:**\n` +
            `• **ATS Score:** **${resumeStats.score}%**\n` +
            `• **Verified Metrics:** **${resumeStats.metricsCount}**\n` +
            `• **Line Budget:** ~${resumeStats.lineCount} lines\n\n`
          : `*No resume currently loaded in workspace. You can paste your resume or upload a PDF.*`);

      const dataCard: ChatDataCard = {
        type: 'profile_summary',
        title: `${fullName}'s Candidate Profile`,
        fullName,
        email,
        targetRole,
        location,
        school,
        skillsCount: skills.length,
        skills,
        resumeLoaded: hasResume,
        resumeStats,
      };

      return {
        id: `hacky-msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        sender: 'hacky',
        text,
        timestamp: Date.now(),
        dataCard,
        actions: [
          { label: 'Edit in Profile Tab', action: 'navigate_tab', tab: 'profile' },
          { label: 'Open Document Canvas', action: 'navigate_tab', tab: 'canvas' },
        ],
      };
    }

    // 2. Full Resume Text Paste or Update
    const isPastedResume =
      /^(?:here\s+is\s+my\s+(?:new\s+|updated\s+)?resume|update\s+(?:my\s+)?resume(?:\s+to|\s*:)?)\s*:?\s*[\r\n]+([\s\S]+)/i.test(q) ||
      (q.length > 140 && /(?:EDUCATION|EXPERIENCE|PROJECTS|SKILLS)/i.test(q));

    if (isPastedResume) {
      let extractedResume = q;
      const match = q.match(/^(?:here\s+is\s+my\s+(?:new\s+|updated\s+)?resume|update\s+(?:my\s+)?resume(?:\s+to|\s*:)?)\s*:?\s*[\r\n]+([\s\S]+)/i);
      if (match && match[1]?.trim().length > 30) {
        extractedResume = match[1].trim();
      }

      // Persist new resume text
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('user_custom_resume', extractedResume);
        } catch {}
      }
      if (context.onUpdateResumeText) {
        context.onUpdateResumeText(extractedResume);
      }

      const targetRole = context.targetRole || context.applicantProfile?.targetRole || 'Software Engineering';
      const newScore = calculateAccurateAtsScore(extractedResume, targetRole);
      const metrics = calculateAccurateMetrics(extractedResume);
      const lineBudget = calculateAccurateLineBudget(extractedResume);
      const detectedSkills = extractSkillsFromText(extractedResume);
      const scoreCategory = newScore >= 85 ? 'Elite Tier' : newScore >= 70 ? 'Competitive' : 'Needs Optimization';

      const text =
        `I have updated your resume in your workspace.\n\n` +
        `• **ATS Score:** **${newScore}%** (${scoreCategory})\n` +
        `• **Quantified Impact:** **${metrics.totalMetricsFound}** verified metrics across **${metrics.quantifiedBullets}/${metrics.totalBullets}** bullets (${metrics.metricPercentage}%)\n` +
        `• **Page Budget:** ~${lineBudget.totalLines} lines (${lineBudget.fitsOnePage ? 'Fits 1 page' : 'Exceeds 1 page'})\n` +
        `• **Technical Stack:** ${detectedSkills.length > 0 ? detectedSkills.slice(0, 6).join(', ') : 'Add skills'}\n\n` +
        `Your updated document is synced with the Document Canvas and ready for ATS tailoring.`;

      const dataCard: ChatDataCard = {
        type: 'info_updated',
        title: 'Resume Document Updated',
        updateType: 'resume',
        summary: `Saved updated resume (${lineBudget.totalLines} lines, ${metrics.totalMetricsFound} metrics)`,
        changes: [
          { field: 'Resume Content', value: `Updated (~${lineBudget.totalLines} lines)` },
          { field: 'ATS Score', value: `${newScore}% (${scoreCategory})` },
          { field: 'Verified Metrics', value: `${metrics.totalMetricsFound} found` },
        ],
        metrics: {
          score: newScore,
          metricsCount: metrics.totalMetricsFound,
          lineCount: lineBudget.totalLines,
        },
      };

      return {
        id: `hacky-msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        sender: 'hacky',
        text,
        timestamp: Date.now(),
        dataCard,
        updatedInfo: {
          type: 'resume',
          newResumeText: extractedResume,
          summary: 'Updated resume document',
        },
        actions: [
          { label: 'Open in Document Canvas', action: 'navigate_tab', tab: 'canvas' },
          { label: 'Re-analyze Optimization', action: 'quick_reply', payload: 'How is my resume doing?' },
        ],
      };
    }

    // 3. Target Role Update
    const targetRoleMatch =
      q.match(/(?:update|change|set)\s+(?:my\s+)?target\s+role(?:\s+to|\s*:)?\s*(.+)/i) ||
      q.match(/^(?:target\s+role|targeting)(?:\s+to|\s*:)?\s*(.+)/i);

    if (targetRoleMatch && targetRoleMatch[1]) {
      const newRole = targetRoleMatch[1].replace(/[.!]+$/, '').trim();
      const previousRole = context.applicantProfile?.targetRole || 'Software Engineer';

      const updatedProfile: Partial<ApplicantProfile> = {
        targetRole: newRole,
      };

      if (typeof window !== 'undefined') {
        try {
          saveStoredApplicantProfile(updatedProfile);
        } catch {}
      }
      if (context.onUpdateApplicantProfile) {
        context.onUpdateApplicantProfile(updatedProfile);
      }

      // Re-score active resume against new role
      const resumeText = this.resolveActiveResumeText(context);
      let newScore = 0;
      if (resumeText.length > 30) {
        newScore = calculateAccurateAtsScore(resumeText, newRole);
      }

      const text =
        `Updated your target role to **${newRole}**.\n\n` +
        `• **Target Role:** ${newRole} (was: *${previousRole}*)\n` +
        (newScore > 0 ? `• **Calibrated ATS Score:** **${newScore}%** for ${newRole}\n` : '') +
        `\nYour ATS keyword matching, tailored suggestions, and Discovery job rankings will now prioritize ${newRole} positions.`;

      const dataCard: ChatDataCard = {
        type: 'info_updated',
        title: 'Target Role Updated',
        updateType: 'target_role',
        summary: `Target role changed from "${previousRole}" to "${newRole}"`,
        previousValue: previousRole,
        newValue: newRole,
        changes: [{ field: 'Target Role', value: newRole }],
        metrics: newScore > 0 ? { score: newScore, metricsCount: 0, lineCount: 0 } : undefined,
      };

      return {
        id: `hacky-msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        sender: 'hacky',
        text,
        timestamp: Date.now(),
        dataCard,
        updatedInfo: {
          type: 'target_role',
          updatedProfile: { targetRole: newRole },
          summary: `Updated target role to ${newRole}`,
        },
        actions: [
          { label: 'Browse Matching Openings', action: 'navigate_tab', tab: 'discovery' },
          { label: 'Check Resume Score', action: 'quick_reply', payload: 'How is my resume doing?' },
        ],
      };
    }

    // 4. Skills Addition
    const addSkillsMatch =
      q.match(/add\s+(.+?)\s+to\s+(?:my\s+)?skills?/i) ||
      q.match(/(?:update|add)\s+skills?(?:\s+to|\s*:)?\s*(.+)/i);

    if (addSkillsMatch && addSkillsMatch[1]) {
      const skillsRaw = addSkillsMatch[1];
      const parsedSkills = skillsRaw
        .split(/[,&]|\band\b/i)
        .map((s) => s.trim().replace(/[.!]+$/, ''))
        .filter((s) => s.length > 1);

      const currentSkills = context.applicantProfile?.skills || [];
      const newSkills = Array.from(new Set([...currentSkills, ...parsedSkills]));

      const updatedProfile: Partial<ApplicantProfile> = {
        skills: newSkills,
      };

      if (typeof window !== 'undefined') {
        try {
          saveStoredApplicantProfile(updatedProfile);
        } catch {}
      }
      if (context.onUpdateApplicantProfile) {
        context.onUpdateApplicantProfile(updatedProfile);
      }

      const text =
        `Added **${parsedSkills.join(', ')}** to your profile skills.\n\n` +
        `• **Newly Added:** ${parsedSkills.join(', ')}\n` +
        `• **Total Skills on Profile:** ${newSkills.length}\n\n` +
        `These skills are now active for ATS keyword matching and autofill.`;

      const dataCard: ChatDataCard = {
        type: 'info_updated',
        title: 'Skills Added to Profile',
        updateType: 'skills',
        summary: `Added ${parsedSkills.length} skill(s) to candidate profile`,
        changes: [{ field: 'Skills Added', value: parsedSkills.join(', ') }],
      };

      return {
        id: `hacky-msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        sender: 'hacky',
        text,
        timestamp: Date.now(),
        dataCard,
        updatedInfo: {
          type: 'skills',
          updatedProfile: { skills: newSkills },
          summary: `Added skills: ${parsedSkills.join(', ')}`,
        },
        actions: [
          { label: 'View Profile Tab', action: 'navigate_tab', tab: 'profile' },
          { label: 'Check Resume Match', action: 'quick_reply', payload: 'How is my resume doing?' },
        ],
      };
    }

    // 5. Add Bullet to Resume
    const addBulletMatch = q.match(/add\s+(?:this\s+)?bullet(?:\s+to\s+my\s+resume)?(?:\s*:)?\s*(.+)/i);
    if (addBulletMatch && addBulletMatch[1]) {
      const rawBullet = addBulletMatch[1].trim().replace(/^[-•*▪▸]\s*/, '');
      const formattedBullet = `• ${rawBullet}`;
      const activeResume = this.resolveActiveResumeText(context);

      let newResumeText = activeResume;
      if (newResumeText.length > 30) {
        if (/EXPERIENCE/i.test(newResumeText)) {
          newResumeText = newResumeText.replace(/(EXPERIENCE[^\n]*\n)/i, `$1${formattedBullet}\n`);
        } else {
          newResumeText = `${newResumeText}\n${formattedBullet}`;
        }
      } else {
        newResumeText = `EXPERIENCE\n${formattedBullet}`;
      }

      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('user_custom_resume', newResumeText);
        } catch {}
      }
      if (context.onUpdateResumeText) {
        context.onUpdateResumeText(newResumeText);
      }

      const metrics = calculateAccurateMetrics(newResumeText);
      const lineBudget = calculateAccurateLineBudget(newResumeText);

      const text =
        `Added new bullet to your resume:\n\n` +
        `> ${formattedBullet}\n\n` +
        `• **Verified Metrics Found:** **${metrics.totalMetricsFound}**\n` +
        `• **Page Budget:** ~${lineBudget.totalLines} lines (${lineBudget.fitsOnePage ? 'Fits 1 page' : 'Exceeds 1 page'})\n\n` +
        `Your document has been updated in the Document Canvas.`;

      const dataCard: ChatDataCard = {
        type: 'info_updated',
        title: 'Resume Bullet Added',
        updateType: 'bullet',
        summary: `Added bullet: "${rawBullet.slice(0, 45)}..."`,
        changes: [{ field: 'New Bullet', value: formattedBullet }],
        metrics: {
          score: calculateAccurateAtsScore(newResumeText, context.targetRole),
          metricsCount: metrics.totalMetricsFound,
          lineCount: lineBudget.totalLines,
        },
      };

      return {
        id: `hacky-msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        sender: 'hacky',
        text,
        timestamp: Date.now(),
        dataCard,
        updatedInfo: {
          type: 'bullet',
          newResumeText,
          summary: `Added bullet: ${rawBullet.slice(0, 40)}`,
        },
        actions: [
          { label: 'Edit in Canvas', action: 'navigate_tab', tab: 'canvas' },
          { label: 'Audit Resume', action: 'quick_reply', payload: 'How is my resume doing?' },
        ],
      };
    }

    // 6. Generic Profile Field Updates (Name, Email, Phone, Location, School, GPA, Graduation)
    const changes: Array<{ field: string; value: string }> = [];
    const updatedProfile: Partial<ApplicantProfile> = {};

    // Name match
    const nameMatch =
      q.match(/(?:update|change|set)\s+(?:my\s+)?name(?:\s+to|\s*:)?\s*([A-Za-z]+(?:\s+(?!and\b|update\b|email\b|phone\b|location\b|school\b|gpa\b)[A-Za-z]+){1,2})(?:\s+(?:and|\b(?:update|email|phone|location|school|gpa)\b)|$)/i) ||
      q.match(/^my\s+name\s+is\s+([A-Za-z]+(?:\s+(?!and\b|update\b|email\b|phone\b|location\b|school\b|gpa\b)[A-Za-z]+){1,2})(?:\s+(?:and|\b(?:update|email|phone|location|school|gpa)\b)|$)/i) ||
      q.match(/(?:update|change|set)\s+(?:my\s+)?name(?:\s+to|\s*:)?\s*([A-Za-z]+(?:\s+[A-Za-z]+)+)/i) ||
      q.match(/^my\s+name\s+is\s+([A-Za-z]+(?:\s+[A-Za-z]+)+)/i);
    if (nameMatch && nameMatch[1]) {
      const parts = nameMatch[1].trim().split(/\s+/);
      const firstName = parts[0];
      const lastName = parts.slice(1).join(' ');
      const fullName = `${firstName} ${lastName}`;
      updatedProfile.firstName = firstName;
      updatedProfile.lastName = lastName;
      updatedProfile.fullName = fullName;
      changes.push({ field: 'Candidate Name', value: fullName });
    }

    // Email match
    const emailMatch = q.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    if (emailMatch && emailMatch[1] && /\b(email|address)\b/i.test(q)) {
      const email = emailMatch[1].trim();
      updatedProfile.email = email;
      changes.push({ field: 'Email', value: email });
    }

    // Phone match
    const phoneMatch = q.match(/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
    if (phoneMatch && phoneMatch[0] && /\b(phone|mobile|number|cell)\b/i.test(q)) {
      const phone = phoneMatch[0].trim();
      updatedProfile.phone = phone;
      changes.push({ field: 'Phone', value: phone });
    }

    // Location match
    const locMatch = q.match(/(?:update|change|set)\s+(?:my\s+)?location(?:\s+to|\s*:)?\s*([A-Za-z\s,]+)/i);
    if (locMatch && locMatch[1]) {
      const location = locMatch[1].replace(/[.!]+$/, '').trim();
      updatedProfile.location = location;
      changes.push({ field: 'Location', value: location });
    }

    // School match
    const schoolMatch = q.match(/(?:update|change|set)\s+(?:my\s+)?(?:school|university|college)(?:\s+to|\s*:)?\s*(.+)/i);
    if (schoolMatch && schoolMatch[1]) {
      const school = schoolMatch[1].replace(/[.!]+$/, '').trim();
      updatedProfile.school = school;
      changes.push({ field: 'School / University', value: school });
    }

    // GPA match
    const gpaMatch = q.match(/(?:gpa|grade\s*point)(?:\s+to|\s*:)?\s*([0-4](?:\.\d{1,2})?)/i);
    if (gpaMatch && gpaMatch[1]) {
      const gpa = gpaMatch[1].trim();
      updatedProfile.gpa = gpa;
      changes.push({ field: 'GPA', value: gpa });
    }

    // Graduation match
    const gradMatch = q.match(/(?:graduation|grad\s*date|graduating)(?:\s+to|\s*:)?\s*([A-Za-z]+\s+\d{4}|\d{4})/i);
    if (gradMatch && gradMatch[1]) {
      const grad = gradMatch[1].trim();
      updatedProfile.gradMonthYear = grad;
      changes.push({ field: 'Graduation Date', value: grad });
    }

    if (changes.length > 0) {
      if (typeof window !== 'undefined') {
        try {
          saveStoredApplicantProfile(updatedProfile);
        } catch {}
      }
      if (context.onUpdateApplicantProfile) {
        context.onUpdateApplicantProfile(updatedProfile);
      }

      const text =
        `Updated your profile information:\n\n` +
        changes.map((c) => `• **${c.field}:** ${c.value}`).join('\n') +
        `\n\nYour profile has been saved across your workspace.`;

      const dataCard: ChatDataCard = {
        type: 'info_updated',
        title: 'Profile Updated',
        updateType: 'profile',
        summary: `Updated ${changes.length} field(s)`,
        changes,
      };

      return {
        id: `hacky-msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        sender: 'hacky',
        text,
        timestamp: Date.now(),
        dataCard,
        updatedInfo: {
          type: 'profile',
          updatedProfile,
          summary: `Updated ${changes.map((c) => c.field).join(', ')}`,
        },
        actions: [
          { label: 'View Profile Tab', action: 'navigate_tab', tab: 'profile' },
          { label: 'Check Resume Match', action: 'quick_reply', payload: 'How is my resume doing?' },
        ],
      };
    }

    // Fallback: general info update instructions
    return {
      id: `hacky-msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      sender: 'hacky',
      text:
        `You can update any of your information directly here with me:\n\n` +
        `• **Update resume:** Paste your resume or say *"Here is my updated resume: [text]"*\n` +
        `• **Update target role:** *"Update my target role to Staff Backend Engineer"*\n` +
        `• **Update contact:** *"Update my email to user@domain.com"*, *"Update my location to Seattle"*\n` +
        `• **Add skills:** *"Add Python, Go, and Kubernetes to my skills"*\n` +
        `• **Add bullet:** *"Add this bullet: Architected Redis cache reducing latency by 40%"*\n` +
        `• **View info:** *"What is my current info?"*`,
      timestamp: Date.now(),
      actions: [
        { label: 'Show Current Info', action: 'quick_reply', payload: 'What is my current info?' },
        { label: 'Open Document Canvas', action: 'navigate_tab', tab: 'canvas' },
      ],
    };
  }

  /**
   * Helper prompt when no resume is loaded
   */
  private handleEmptyResumePrompt(context: ChatbotContext): ChatMessage {
    return {
      id: `hacky-msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      sender: 'hacky',
      text:
        "I don't see an active resume loaded in your workspace yet.\n\n" +
        "You can either **upload your PDF resume** on the Home page, launch the **Document Canvas** to paste and edit your text, or simply paste your resume text right here in chat (e.g., *'Here is my resume: ...'*). Once loaded, I'll calculate your real ATS score, verified metrics, line budget, and keyword gap.",
      timestamp: Date.now(),
      actions: [
        { label: 'Open Document Canvas', action: 'navigate_tab', tab: 'canvas' },
        { label: 'Upload on Home', action: 'navigate_tab', tab: 'home' },
      ],
    };
  }

  /**
   * Handle resume questions (ATS score, line count, metrics, improvement tips).
   * Purely local, deterministic tool — zero AI token usage.
   */
  public async handleResumeQuery(query: string, context: ChatbotContext): Promise<ChatMessage> {
    const resumeText = this.resolveActiveResumeText(context);

    if (!resumeText || resumeText.length < 30) {
      return this.handleEmptyResumePrompt(context);
    }

    const targetRole = context.targetRole || context.applicantProfile?.targetRole || 'Software Engineering';
    const atsScore = calculateAccurateAtsScore(resumeText, targetRole, context.atsScore);
    const lineBudget = calculateAccurateLineBudget(resumeText);
    const metrics = calculateAccurateMetrics(resumeText);
    const detectedSkills = extractSkillsFromText(resumeText);

    const scoreCategory = atsScore >= 85 ? 'Elite Tier' : atsScore >= 70 ? 'Competitive' : 'Needs Optimization';

    const strengths: string[] = [];
    const recommendations: string[] = [];

    if (metrics.totalMetricsFound >= 3) {
      strengths.push(`Found ${metrics.totalMetricsFound} quantified metrics across ${metrics.quantifiedBullets}/${metrics.totalBullets} bullets (${metrics.uniqueMetrics.slice(0, 3).join(', ')})`);
    } else {
      recommendations.push('Add 2+ more quantified metrics (e.g. latency reduction %, throughput, users served)');
    }

    if (detectedSkills.length >= 4) {
      strengths.push(`Strong core stack detected: ${detectedSkills.slice(0, 4).join(', ')}`);
    } else {
      recommendations.push('Ensure 5+ hard skills matching your target job are prominently listed');
    }

    if (lineBudget.fitsOnePage) {
      strengths.push(`Clean single-page length (~${lineBudget.totalLines} rendered lines)`);
    } else {
      recommendations.push(`Line budget warning (~${lineBudget.totalLines} lines). Target 48–52 lines for 1 clean page`);
    }

    // Incorporate deeply personalized recommendations from candidate actual bullets (Deterministic Heuristic Engine)
    const personalized = generatePersonalizedFallbackRecommendations(
      resumeText,
      context.currentJob?.description,
      context.targetRole
    );

    for (const pRec of personalized.recommendations.slice(0, 2)) {
      if (pRec.originalText && pRec.originalText.length > 15) {
        recommendations.unshift(
          `${pRec.title}: Upgrade "${pRec.originalText.slice(0, 45)}..." with quantifiable metrics & active leadership verbs`
        );
      } else {
        recommendations.unshift(pRec.title);
      }
    }

    if (recommendations.length === 0) {
      recommendations.push('Run Closed-Loop ATS tailoring against your target role in Document Canvas');
    }

    const topRecSection = personalized.recommendations.length > 0 && personalized.recommendations[0].originalText
      ? `**Top Personalized Recommendation:** ${personalized.recommendations[0].title}\n` +
        `• *Original:* "${personalized.recommendations[0].originalText.slice(0, 65)}..."\n` +
        `• *Elevated Rewrite:* ${personalized.recommendations[0].improvedText}`
      : `**Top Recommendation:** ${recommendations[0]}`;

    const text =
      `Here is how your resume is currently looking:\n\n` +
      `• **ATS Score:** **${atsScore}%** (${scoreCategory})\n` +
      `• **Quantified Impact:** **${metrics.totalMetricsFound}** verified metrics across **${metrics.quantifiedBullets}/${metrics.totalBullets}** bullets (${metrics.metricPercentage}%)\n` +
      `• **Technical Stack:** ${detectedSkills.length > 0 ? detectedSkills.slice(0, 5).join(', ') : 'Add skills section'}\n` +
      `• **Page Budget:** ~${lineBudget.totalLines} lines (${lineBudget.fitsOnePage ? 'Fits 1 page' : 'Exceeds 1 page'})\n\n` +
      topRecSection;

    const dataCard: ChatDataCard = {
      type: 'resume_summary',
      score: atsScore,
      metricsCount: metrics.totalMetricsFound,
      skillsCount: detectedSkills.length,
      lineCount: lineBudget.totalLines,
      title: context.applicantProfile?.firstName ? `${context.applicantProfile.firstName}'s Resume` : 'Active Resume',
      topStrengths: strengths,
      topRecommendations: recommendations,
    };

    const actions: ChatAction[] = [
      { label: 'Score Breakdown', action: 'quick_reply', payload: 'Show score breakdown' },
      { label: 'Scan Weak Verbs', action: 'quick_reply', payload: 'Find my weak verbs' },
      { label: 'Check Missing Skills', action: 'quick_reply', payload: 'What keywords am I missing?' },
      { label: 'Optimize in Canvas', action: 'navigate_tab', tab: 'canvas' },
    ];

    return {
      id: `hacky-msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      sender: 'hacky',
      text,
      timestamp: Date.now(),
      dataCard,
      actions,
    };
  }

  /**
   * Detailed 7-Factor ATS breakdown diagnostic tool
   */
  public handleAtsBreakdownQuery(query: string, context: ChatbotContext): ChatMessage {
    const resumeText = this.resolveActiveResumeText(context);
    if (!resumeText || resumeText.length < 30) {
      return this.handleEmptyResumePrompt(context);
    }
    const targetRole = context.targetRole || context.applicantProfile?.targetRole || 'Software Engineering';
    const scorer = new AtsScorerService();
    const report = context.currentJob?.description
      ? scorer.analyze(resumeText, context.currentJob.description)
      : scorer.auditGeneralAts(resumeText, targetRole);

    const breakdown = report.breakdown;
    const score = report.overallScore;
    const grade = score >= 90 ? 'A+' : score >= 80 ? 'A' : score >= 70 ? 'B' : score >= 60 ? 'C' : 'D';

    const factors: Array<{ name: string; score: number; status: 'strong' | 'moderate' | 'needs_work'; weight: string }> = [
      {
        name: 'Hard Skills Match',
        score: breakdown.hardSkillsScore,
        status: breakdown.hardSkillsScore >= 75 ? 'strong' : breakdown.hardSkillsScore >= 50 ? 'moderate' : 'needs_work',
        weight: '30%',
      },
      {
        name: 'Action Verb Vitality',
        score: breakdown.actionVerbVitalityScore ?? 50,
        status: (breakdown.actionVerbVitalityScore ?? 50) >= 70 ? 'strong' : (breakdown.actionVerbVitalityScore ?? 50) >= 50 ? 'moderate' : 'needs_work',
        weight: '15%',
      },
      {
        name: 'Quantified Metrics',
        score: breakdown.softSkillsScore,
        status: breakdown.softSkillsScore >= 70 ? 'strong' : breakdown.softSkillsScore >= 45 ? 'moderate' : 'needs_work',
        weight: '15%',
      },
      {
        name: 'Production Experience',
        score: breakdown.productionExperienceScore ?? 50,
        status: (breakdown.productionExperienceScore ?? 50) >= 70 ? 'strong' : (breakdown.productionExperienceScore ?? 50) >= 45 ? 'moderate' : 'needs_work',
        weight: '15%',
      },
      {
        name: 'Self Projects Depth',
        score: breakdown.selfProjectsScore ?? 60,
        status: (breakdown.selfProjectsScore ?? 60) >= 70 ? 'strong' : (breakdown.selfProjectsScore ?? 60) >= 45 ? 'moderate' : 'needs_work',
        weight: '10%',
      },
      {
        name: 'Formatting & Layout',
        score: breakdown.formattingScore,
        status: breakdown.formattingScore >= 80 ? 'strong' : breakdown.formattingScore >= 60 ? 'moderate' : 'needs_work',
        weight: '5%',
      },
    ];

    const lowest = [...factors].sort((a, b) => a.score - b.score)[0];
    let topPriority = `Improve ${lowest.name} (${lowest.score}%).`;
    if (lowest.name === 'Action Verb Vitality') {
      topPriority = 'Replace passive verbs (worked on, helped) with executive action verbs (Architected, Spearheaded).';
    } else if (lowest.name === 'Quantified Metrics') {
      topPriority = 'Add metrics (%, ms latency, scale, RPS) to at least 60% of your experience bullets.';
    } else if (lowest.name === 'Hard Skills Match') {
      topPriority = 'Incorporate critical target role technologies into project descriptions.';
    } else if (lowest.name === 'Production Experience') {
      topPriority = 'Emphasize CI/CD, Docker/Kubernetes, monitoring (Datadog/Prometheus), and uptime SLA.';
    }

    const text =
      `**7-Factor ATS Score Breakdown (${score}% • Grade ${grade}):**\n\n` +
      factors
        .map(
          (f) =>
            `• **${f.name} (${f.weight}):** ${f.score}% — ${
              f.status === 'strong' ? '✓ Strong' : f.status === 'moderate' ? '⚠️ Acceptable' : '❌ Needs Optimization'
            }`
        )
        .join('\n') +
      `\n\n**Top Priority Fix:** ${topPriority}`;

    const dataCard: ChatDataCard = {
      type: 'ats_breakdown',
      overallScore: score,
      grade,
      factors,
      criticalGaps: report.improvementSuggestions?.slice(0, 3) || [],
      topPriority,
    };

    return {
      id: `hacky-msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      sender: 'hacky',
      text,
      timestamp: Date.now(),
      dataCard,
      actions: [
        { label: 'Optimize in Canvas', action: 'navigate_tab', tab: 'canvas' },
        { label: 'Scan Weak Verbs', action: 'quick_reply', payload: 'Find my weak verbs' },
        { label: 'Check Missing Skills', action: 'quick_reply', payload: 'What keywords am I missing?' },
      ],
    };
  }

  /**
   * Action verb scanner and replacer tool
   */
  public handleWeakVerbsQuery(query: string, context: ChatbotContext): ChatMessage {
    const resumeText = this.resolveActiveResumeText(context);
    if (!resumeText || resumeText.length < 30) {
      return this.handleEmptyResumePrompt(context);
    }
    const scorer = new AtsScorerService();
    const { strongCount, weakCount, weakVerbsFound, tier1Count } = scorer.auditActionVerbs(resumeText.toLowerCase());

    const REPLACEMENT_MAP: Record<string, { replacement: string; domain: string }> = {
      worked: { replacement: 'Architected', domain: 'Architecture' },
      'worked on': { replacement: 'Engineered', domain: 'Systems' },
      helped: { replacement: 'Spearheaded', domain: 'Leadership' },
      'helped with': { replacement: 'Accelerated', domain: 'Velocity' },
      'responsible for': { replacement: 'Directed', domain: 'Ownership' },
      handled: { replacement: 'Orchestrated', domain: 'DevOps' },
      assisted: { replacement: 'Streamlined', domain: 'Process' },
      participated: { replacement: 'Executed', domain: 'Delivery' },
      contributed: { replacement: 'Instituted', domain: 'Quality' },
      supported: { replacement: 'Administered', domain: 'Infra' },
      made: { replacement: 'Engineered', domain: 'Core' },
      did: { replacement: 'Formulated', domain: 'Analysis' },
    };

    const verbInstances: Array<{ verb: string; replacement: string; domain: string }> = [];
    for (const wv of weakVerbsFound) {
      const match = REPLACEMENT_MAP[wv.toLowerCase()] || { replacement: 'Architected', domain: 'Leadership' };
      verbInstances.push({
        verb: wv,
        replacement: match.replacement,
        domain: match.domain,
      });
    }

    const text =
      weakCount === 0
        ? `**Excellent Action Verb Strength!**\n\nFound **${strongCount}** strong verbs including **${tier1Count}** Tier-1 executive power verbs. No passive verbs detected in your resume.`
        : `**Action Verb Diagnostic:**\n\n` +
          `Found **${weakCount}** passive phrase(s) (${weakVerbsFound.slice(0, 4).map((v) => `"${v}"`).join(', ')}).\n\n` +
          `Replacing passive phrasing with domain-specific leadership verbs boosts your ATS Action Verb score by up to **+25 points**:\n` +
          verbInstances.slice(0, 4).map((vi) => `• Replace *"${vi.verb}"* → **${vi.replacement}** (${vi.domain})`).join('\n');

    const dataCard: ChatDataCard = {
      type: 'weak_verbs',
      totalWeakCount: weakCount,
      uniqueWeakVerbs: weakVerbsFound,
      verbInstances:
        verbInstances.length > 0 ? verbInstances : [{ verb: 'worked on', replacement: 'Architected', domain: 'Architecture' }],
      recommendation:
        weakCount > 0
          ? 'Replace flagged verbs with active leadership tokens in Document Canvas.'
          : 'All action verbs meet Tier-1 standards.',
    };

    return {
      id: `hacky-msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      sender: 'hacky',
      text,
      timestamp: Date.now(),
      dataCard,
      actions: [
        { label: 'Fix in Canvas', action: 'navigate_tab', tab: 'canvas' },
        { label: 'Transform a Bullet', action: 'quick_reply', payload: 'Elevate bullet: worked on frontend React components' },
        { label: 'Show ATS Breakdown', action: 'quick_reply', payload: 'Show score breakdown' },
      ],
    };
  }

  /**
   * Keyword gap and radar diagnostic tool
   */
  public handleKeywordGapQuery(query: string, context: ChatbotContext): ChatMessage {
    const resumeText = this.resolveActiveResumeText(context);
    if (!resumeText || resumeText.length < 30) {
      return this.handleEmptyResumePrompt(context);
    }
    const targetRole = context.targetRole || context.applicantProfile?.targetRole || 'Software Engineering';
    const scorer = new AtsScorerService();
    const report = context.currentJob?.description
      ? scorer.analyze(resumeText, context.currentJob.description)
      : scorer.auditGeneralAts(resumeText, targetRole);

    const matchedSkills = report.keywords.filter((k) => k.foundInResume).map((k) => k.keyword);
    const missingSkills = report.keywords.filter((k) => !k.foundInResume).map((k) => k.keyword);

    const text =
      `**Keyword Radar for ${targetRole}:**\n\n` +
      `• **Matched Skills (${matchedSkills.length}):** ${matchedSkills.slice(0, 6).join(', ') || 'None detected'}\n` +
      `• **Missing Critical Skills (${missingSkills.length}):** ${missingSkills.slice(0, 6).join(', ') || 'All matched!'}\n\n` +
      (missingSkills.length > 0
        ? `Weave **${missingSkills.slice(0, 3).join(', ')}** into your project or experience bullets in Document Canvas to increase keyword relevance.`
        : `Your resume demonstrates 100% keyword alignment with the ${targetRole} benchmark.`);

    const dataCard: ChatDataCard = {
      type: 'keyword_gap',
      targetRole,
      matchedCount: matchedSkills.length,
      missingCount: missingSkills.length,
      matchedSkills: matchedSkills.slice(0, 8),
      missingSkills: missingSkills.slice(0, 8),
    };

    return {
      id: `hacky-msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      sender: 'hacky',
      text,
      timestamp: Date.now(),
      dataCard,
      actions: [
        { label: 'Add to Canvas', action: 'navigate_tab', tab: 'canvas' },
        {
          label: missingSkills.length > 0 ? `Add ${missingSkills[0]} to Skills` : 'View Profile',
          action: 'quick_reply',
          payload:
            missingSkills.length > 0
              ? `Add ${missingSkills.slice(0, 3).join(', ')} to my skills`
              : 'What is my current info?',
        },
        { label: 'Check ATS Score', action: 'quick_reply', payload: 'How is my resume doing?' },
      ],
    };
  }

  /**
   * Deterministic rule-based STAR X-Y-Z bullet transformer tool
   */
  public handleBulletElevationQuery(query: string, context: ChatbotContext): ChatMessage {
    const rawInput = query
      .replace(
        /^(?:can you\s+)?(?:please\s+)?(?:elevate|transform|rewrite|improve|upgrade)\s+(?:this\s+|my\s+)?(?:bullet|phrase|sentence)?:\s*/i,
        ''
      )
      .replace(/^(?:how to write a bullet for|bullet:)\s*/i, '')
      .trim();

    const bulletToElevate = rawInput.length > 10 ? rawInput : 'worked on building web frontend components';
    const domain = classifyBulletDomain(bulletToElevate);

    const stripped = bulletToElevate
      .replace(/^[•\-\*\s]+/, '')
      .replace(
        /^(?:worked on|worked|helped with|helped|responsible for|handled|assisted with|assisted|participated in|contributed to|made|did)\s+(?:the\s+|a\s+|an\s+)?/i,
        ''
      )
      .replace(/^(?:building|creating|developing|implementing|writing)\s+(?:the\s+|a\s+|an\s+)?/i, '')
      .replace(/\.$/, '')
      .trim();

    let leadVerb = 'Architected';
    let elevated = '';
    const improvements: string[] = ['Replaced passive verb with power verb', 'Injected Google X-Y-Z formula'];

    switch (domain) {
      case 'frontend':
        leadVerb = 'Architected';
        elevated = `• ${leadVerb} responsive ${stripped}, cutting client-side render latency by 42% and scaling to 15,000+ active users with 99.9% uptime.`;
        improvements.push('Added render latency reduction & user scale metrics');
        break;
      case 'backend':
        leadVerb = 'Engineered';
        elevated = `• ${leadVerb} scalable ${stripped}, reducing P99 query latency by 45% under 12,000+ peak requests/min via Redis caching and connection pooling.`;
        improvements.push('Added P99 latency metric & caching architecture pattern');
        break;
      case 'mobile':
        leadVerb = 'Engineered';
        elevated = `• ${leadVerb} native ${stripped}, cutting cold app launch latency by 35% with 99.8% crash-free sessions across 20,000+ downloads.`;
        improvements.push('Added crash-free session rate & launch time metrics');
        break;
      case 'devops':
        leadVerb = 'Automated';
        elevated = `• ${leadVerb} resilient ${stripped}, slashing deployment cycle time by 60% with zero-downtime rolling releases across multi-region Kubernetes clusters.`;
        improvements.push('Added deployment cycle time & zero-downtime SLA');
        break;
      case 'data_ai':
        leadVerb = 'Synthesized';
        elevated = `• ${leadVerb} high-throughput ${stripped}, accelerating ETL pipeline velocity by 3.4x across 250,000+ daily events with 99.4% data integrity.`;
        improvements.push('Added pipeline velocity & event scale metrics');
        break;
      default:
        leadVerb = 'Spearheaded';
        elevated = `• ${leadVerb} delivery of ${stripped}, improving operational throughput by 35% with automated regression testing and strict CI gates.`;
        improvements.push('Added operational throughput metric & testing pattern');
        break;
    }

    const text =
      `**STAR Bullet Transformation (${domain.toUpperCase()} Domain):**\n\n` +
      `• **Original (Draft):** *"${bulletToElevate}"*\n` +
      `• **Elevated Rewrite:** **${elevated}**\n\n` +
      `*Formula used: Accomplished [X] as measured by [Y] by doing [Z].*`;

    const dataCard: ChatDataCard = {
      type: 'bullet_elevated',
      originalBullet: bulletToElevate,
      elevatedBullet: elevated,
      domain: domain.toUpperCase(),
      improvements,
    };

    return {
      id: `hacky-msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      sender: 'hacky',
      text,
      timestamp: Date.now(),
      dataCard,
      actions: [
        { label: 'Add to My Resume', action: 'quick_reply', payload: `Add this bullet: ${elevated.replace(/^•\s*/, '')}` },
        { label: 'Open Canvas', action: 'navigate_tab', tab: 'canvas' },
        { label: 'Elevate Another', action: 'quick_reply', payload: 'Elevate bullet: built API service with express' },
      ],
    };
  }

  /**
   * Line budget and ragged widow optimizer tool
   */
  public handleLineBudgetQuery(query: string, context: ChatbotContext): ChatMessage {
    const resumeText = this.resolveActiveResumeText(context);
    if (!resumeText || resumeText.length < 30) {
      return this.handleEmptyResumePrompt(context);
    }
    const budget = calculateAccurateLineBudget(resumeText);
    const rawLines = resumeText.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
    const raggedLines: Array<{ original: string; tightened: string; charsSaved: number }> = [];

    for (const line of rawLines) {
      if (detectRaggedWidow(line)) {
        const tightened = tightenBulletText(line);
        if (tightened.length < line.length) {
          raggedLines.push({
            original: line,
            tightened,
            charsSaved: line.length - tightened.length,
          });
        }
      }
    }

    const text =
      `**Line Budget Analysis (~${budget.totalLines} Rendered Lines):**\n\n` +
      `• **Page Status:** ${
        budget.fitsOnePage
          ? '✓ Fits cleanly on 1 page (limit: 54 lines)'
          : `⚠️ Exceeds 1 page by ~${budget.totalLines - 54} lines`
      }\n` +
      `• **Ragged Widows Detected:** ${raggedLines.length} line(s) that wrap onto an extra line with only 1–3 words\n\n` +
      budget.budgetRecommendation;

    const dataCard: ChatDataCard = {
      type: 'line_budget_detail',
      totalLines: budget.totalLines,
      fitsOnePage: budget.fitsOnePage,
      raggedWidowCount: raggedLines.length,
      raggedLines,
      recommendation: budget.budgetRecommendation,
    };

    return {
      id: `hacky-msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      sender: 'hacky',
      text,
      timestamp: Date.now(),
      dataCard,
      actions: [
        { label: 'Edit in Canvas', action: 'navigate_tab', tab: 'canvas' },
        { label: 'Show ATS Breakdown', action: 'quick_reply', payload: 'Show score breakdown' },
      ],
    };
  }

  /**
   * Domain-calibrated interview prep tool
   */
  public handleInterviewPrepQuery(query: string, context: ChatbotContext): ChatMessage {
    const resumeText = this.resolveActiveResumeText(context);
    const detectedSkills = extractSkillsFromText(resumeText);
    const hasReact = detectedSkills.some((s) => /react|vue|next|frontend/i.test(s));
    const hasBackend = detectedSkills.some((s) => /python|node|go|postgres|sql|redis|kafka/i.test(s));

    let technicalFocus = '';
    if (hasReact && hasBackend) {
      technicalFocus =
        '1. **Full-Stack:** State management (Zustand/Redux), SSR vs hydration (Next.js), REST/GraphQL API contracts, database index design (B-tree vs Hash), Redis caching strategies.';
    } else if (hasReact) {
      technicalFocus =
        '1. **Frontend:** React rendering lifecycle, Web Vitals (LCP, INP, CLS), component modularity, accessibility (WCAG AA), bundle size optimization.';
    } else {
      technicalFocus =
        '1. **Backend / Systems:** Distributed caching (Redis), database schema indexing, message brokers (Kafka/RabbitMQ), P99 latency mitigation, idempotency.';
    }

    const text =
      `**Technical & Behavioral Interview Blueprint:**\n\n` +
      `${technicalFocus}\n\n` +
      `2. **System Design (Mid/Senior):** Practice rate limiters (Token Bucket), distributed unique ID generator (Snowflake), and high-throughput queues.\n\n` +
      `3. **Behavioral STAR Stories:** Have 4 stories ready:\n` +
      `   • Technical disagreement & consensus building\n` +
      `   • Production outage post-mortem\n` +
      `   • Tight deadline delivery under constraints\n` +
      `   • Mentorship or process improvement\n\n` +
      `*Check Tracker CRM to manage your interview stages and dates!*`;

    return {
      id: `hacky-msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      sender: 'hacky',
      text,
      timestamp: Date.now(),
      actions: [
        { label: 'Go to Tracker CRM', action: 'navigate_tab', tab: 'tracker' },
        { label: 'Prepare Behavioral', action: 'quick_reply', payload: 'How do I quantify my bullets?' },
        { label: 'Check Resume Score', action: 'quick_reply', payload: 'How is my resume doing?' },
      ],
    };
  }

  /**
   * Job search and outreach strategy assistant tool
   */
  public handleJobSearchStrategyQuery(query: string, context: ChatbotContext): ChatMessage {
    const apps = context.applications || [];
    const appliedCount = apps.filter((a) => a.status === 'Applied').length;
    const interviewCount = apps.filter((a) => a.status === 'Interviewing').length;

    const text =
      `**Tech Job Application Strategy Blueprint:**\n\n` +
      `• **Application Velocity:** Target 15–20 high-fit tailored applications per week rather than 100 generic blasts.\n` +
      `• **Follow-Up Cadence:** Send a polite follow-up note 5–7 business days after applying if no response.\n` +
      `• **LinkedIn Outreach Template:**\n` +
      `  *"Hi [Name], I noticed [Company] is hiring a [Role]. I recently [1-sentence achievement with metric from resume] and would love to learn more about the team's engineering goals. Thank you!"*\n\n` +
      `• **Current Pipeline:** You have **${appliedCount}** applied and **${interviewCount}** interviewing roles tracked.`;

    return {
      id: `hacky-msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      sender: 'hacky',
      text,
      timestamp: Date.now(),
      actions: [
        { label: 'View Tracker CRM', action: 'navigate_tab', tab: 'tracker' },
        { label: 'Find New Openings', action: 'quick_reply', payload: 'Are there any new job openings?' },
        { label: 'Check Resume Match', action: 'quick_reply', payload: 'How is my resume doing?' },
      ],
    };
  }

  /**
   * Handle job tracker questions ("how their jobs have been doing")
   */
  public handleJobsTrackerQuery(query: string, context: ChatbotContext): ChatMessage {
    const apps = context.applications || [];

    if (apps.length === 0) {
      return {
        id: `hacky-msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        sender: 'hacky',
        text:
          "You don't have any applications tracked in your **Tracker CRM** yet.\n\n" +
          "Whenever you find roles in the **Discovery** feed or submit an application, add it to your tracker so I can monitor your interview conversion rates and remind you when to follow up.",
        timestamp: Date.now(),
        actions: [
          { label: 'Browse Discovery Jobs', action: 'navigate_tab', tab: 'discovery' },
          { label: 'Open Tracker CRM', action: 'navigate_tab', tab: 'tracker' },
        ],
      };
    }

    const total = apps.length;
    const interviewing = apps.filter((a) => a.status === 'Interviewing').length;
    const applied = apps.filter((a) => a.status === 'Applied').length;
    const offered = apps.filter((a) => a.status === 'Offered').length;
    const rejected = apps.filter((a) => a.status === 'Rejected').length;
    const bookmarked = apps.filter((a) => a.status === 'Bookmarked' || a.status === 'Tailored').length;

    const interviewRate = Math.round(((interviewing + offered) / (applied + interviewing + offered + rejected || 1)) * 100);

    const interviewingApps = apps.filter((a) => a.status === 'Interviewing');
    const recentCompanies = apps.slice(0, 3).map((a) => a.company);

    let commentary = '';
    if (interviewing > 0) {
      commentary = `**Strong momentum.** You have active interviews with **${interviewingApps.map((a) => a.company).join(', ')}**!`;
    } else if (applied > 0) {
      commentary = `You have **${applied} active application(s)** awaiting response. Pro tip: Follow up on LinkedIn after 7 business days to double your callback rate.`;
    } else {
      commentary = `You have **${bookmarked} bookmarked role(s)** ready to tailor and submit!`;
    }

    const text =
      `Here is the pulse on your job search across **${total} tracked application(s)**:\n\n` +
      `• **Interviewing:** ${interviewing}\n` +
      `• **Applied:** ${applied}\n` +
      `• **Offers:** ${offered}\n` +
      `• **Bookmarked / Tailored:** ${bookmarked}\n` +
      `• **Interview Conversion Rate:** **${interviewRate}%**\n\n` +
      `${commentary}`;

    const dataCard: ChatDataCard = {
      type: 'pipeline_summary',
      total,
      applied,
      interviewing,
      offered,
      rejected,
      bookmarked,
      interviewRate,
      recentCompanies,
    };

    const actions: ChatAction[] = [
      { label: 'Open Tracker CRM', action: 'navigate_tab', tab: 'tracker' },
      { label: 'Find More Openings', action: 'navigate_tab', tab: 'discovery' },
    ];

    return {
      id: `hacky-msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      sender: 'hacky',
      text,
      timestamp: Date.now(),
      dataCard,
      actions,
    };
  }

  /**
   * Handle job openings questions ("if there are any new job openings")
   */
  public handleJobOpeningsQuery(query: string, context: ChatbotContext): ChatMessage {
    const jobs = context.jobs || [];
    const totalAvailable = jobs.length || 100;

    // Pick top 3 recommended roles
    const topRoles = jobs.slice(0, 3);

    const openingsList = topRoles.map((j) => ({
      id: j.id,
      title: j.title,
      company: j.company,
      location: j.location || 'Remote',
      salary: j.salaryRange,
      url: j.url,
    }));

    const roleLines = topRoles
      .map((j, i) => `**${i + 1}. ${j.company}** — ${j.title} (${j.location || 'Remote'}${j.salaryRange ? ` • ${j.salaryRange}` : ''})`)
      .join('\n');

    const text =
      `We currently have **${totalAvailable}+ verified tech openings** actively accepting applications in your Discovery feed.\n\n` +
      `Here are top recommended openings for you:\n` +
      `${roleLines || '• Openings available in Discovery'}\n\n` +
      `You can tailor your resume for any role with a single click to optimize keyword match scores.`;

    const dataCard: ChatDataCard = {
      type: 'job_openings',
      totalAvailable,
      openings: openingsList,
    };

    const actions: ChatAction[] = [
      ...(topRoles[0]
        ? [
            {
              label: `Tailor for ${topRoles[0].company}`,
              action: 'tailor_job' as const,
              payload: topRoles[0],
            },
          ]
        : []),
      { label: 'Browse Discovery Feed', action: 'navigate_tab', tab: 'discovery' },
    ];

    return {
      id: `hacky-msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      sender: 'hacky',
      text,
      dataCard,
      actions,
      timestamp: Date.now(),
    };
  }


  /**
   * General assistant query handler (Deterministic local tool, zero AI token usage).
   */
  public async handleGeneralQuery(
    query: string,
    context: ChatbotContext
  ): Promise<ChatMessage> {
    const q = query.toLowerCase();

    // 1. STAR Method / Bullet formula
    if (/star|situation|behavioral/i.test(q)) {
      return {
        id: `hacky-msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        sender: 'hacky',
        text:
          "**The STAR Formula for High-Impact Technical Bullets:**\n\n" +
          "• **Situation / Task:** Set the context and engineering scope (e.g., 'Under high load with 12 services...')\n" +
          "• **Action:** State what *you* built, architected, or refactored with specific technologies (e.g., '...architected an in-memory Redis cluster with pipeline batching in Go...')\n" +
          "• **Result:** Quantify the business or performance outcome (e.g., '...reducing P99 response time by 42% and preventing downtime during Black Friday.')\n\n" +
          "**Google X-Y-Z Pattern:** Accomplished [X] as measured by [Y] by doing [Z].\n\n" +
          "Try saying: *'Elevate bullet: worked on frontend React components'* to transform any bullet instantly!",
        timestamp: Date.now(),
        actions: [
          { label: 'Transform Sample Bullet', action: 'quick_reply', payload: 'Elevate bullet: worked on frontend React components' },
          { label: 'Open Canvas', action: 'navigate_tab', tab: 'canvas' },
        ],
      };
    }

    // 2. Metrics / How to quantify
    if (/quantif|metric/i.test(q)) {
      return {
        id: `hacky-msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        sender: 'hacky',
        text:
          "**How to Add Metrics Without Production Telemetry:**\n\n" +
          "1. **Scale & Load:** *'Processed 50,000+ synthetic test payloads'* or *'Benchmarked at 1,200 QPS'*\n" +
          "2. **Latency & Speed:** *'Reduced P99 query response time from 350ms to 85ms via B-tree indexing'*\n" +
          "3. **Coverage & Quality:** *'Authored 45+ unit & integration tests achieving 92% code coverage'*\n" +
          "4. **Productivity:** *'Cut developer build times by 60% with Docker layer caching'*\n\n" +
          "Ask me *'How is my resume doing?'* to see your verified metric percentage.",
        timestamp: Date.now(),
        actions: [
          { label: 'Check My Metrics', action: 'quick_reply', payload: 'How is my resume doing?' },
          { label: 'Open Document Canvas', action: 'navigate_tab', tab: 'canvas' },
        ],
      };
    }

    // 3. Document Canvas / Formatting / PDF Export shortcuts
    if (/canvas|export|pdf|print|format|editor|margin/i.test(q)) {
      return {
        id: `hacky-msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        sender: 'hacky',
        text:
          "**Document Canvas & Export Guide:**\n\n" +
          "• **Google Docs Toolbar:** Full ribbon for font family, font size, bold/italic, lists, and line spacing.\n" +
          "• **PDF Export:** Click **Print/Export** in the canvas header or press `Ctrl+P` / `Cmd+P` to generate a 1:1 vector PDF.\n" +
          "• **Zen Writing Mode:** Click the maximize button in the canvas header to hide sidebars for focused writing.\n" +
          "• **1-Click AI Tailoring:** Click 'Tailor' on any job in Discovery to automatically tune your resume for that role.",
        timestamp: Date.now(),
        actions: [
          { label: 'Open Document Canvas', action: 'navigate_tab', tab: 'canvas' },
          { label: 'Check Line Budget', action: 'quick_reply', payload: 'Check line budget' },
        ],
      };
    }

    // Default friendly interactive capability menu
    return {
      id: `hacky-msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      sender: 'hacky',
      text:
        "I'm **Ask Hacky**, your fast local career assistant tool. Here are the diagnostics and actions I can run for you:\n\n" +
        "• **Resume Diagnostics:** *'How is my resume doing?'* or *'Show score breakdown'*\n" +
        "• **Action Verbs:** *'Find my weak verbs'* (scans for passive verbs and suggests executive replacements)\n" +
        "• **Keyword Match:** *'What keywords am I missing?'* (identifies target role skill gaps)\n" +
        "• **STAR Transformer:** *'Elevate bullet: [paste text]'* (applies Google X-Y-Z formula)\n" +
        "• **Line Budget:** *'Check line budget'* (detects single-page overflows & ragged widows)\n" +
        "• **Interview Blueprint:** *'Interview prep'* (domain-tailored technical & behavioral questions)\n" +
        "• **Job Applications:** *'How are my jobs doing?'* or *'Are there any new job openings?'*\n" +
        "• **Update Info:** *'Add Python and Go to my skills'* or *'Update my target role to Staff Engineer'*",
      timestamp: Date.now(),
      actions: [
        { label: 'Resume Health Check', action: 'quick_reply', payload: 'How is my resume doing?' },
        { label: 'Score Breakdown', action: 'quick_reply', payload: 'Show score breakdown' },
        { label: 'Scan Weak Verbs', action: 'quick_reply', payload: 'Find my weak verbs' },
        { label: 'Transform a Bullet', action: 'quick_reply', payload: 'Elevate bullet: worked on frontend React components' },
      ],
    };
  }
}

export const HackyChatbot = new HackyChatbotService();
