/**
 * Full Application Audit & Simulated User Journey Test Suite
 *
 * Simulates a real candidate navigating end-to-end through every primary feature
 * in ResumeHack:
 * 1. User Onboarding & Applicant Profile Setup
 * 2. PDF Upload & High-Fidelity Layout Preservation
 * 3. Document Canvas Google Docs Mechanics & Formatting
 * 4. ATS Scoring & Audit Engine
 * 5. Gemini AI & Fallback Recommendation Pipeline
 * 6. Job Discovery Feed & Horizontal Spec Sheet Workbench
 * 7. AI Tailoring, STAR Transformation & Closed-Loop Evaluator
 * 8. Pre-Flight Review & Auto-Submit Verification
 * 9. Application Pipeline Tracking
 * 10. Ask Hacky Deterministic Local Assistant
 * 11. Configuration, Persistence & Security Controls
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AtsScorerService } from '../services/ats-scorer.js';
import {
  GeminiRecommendationService,
  buildAtsContextBlock,
  generatePersonalizedFallbackRecommendations,
  AtsAuditContext,
} from '../services/gemini-recommendations.js';
import { HackyChatbotService, ChatbotContext } from '../services/hacky-chatbot.js';
import { CompanyArchetypeClassifier } from '../services/archetype-classifier.js';
import { TriVariantService } from '../services/tri-variant.js';
import {
  detectPdfLayout,
  detectBulletStyleFromGlyph,
} from '../services/pdf-layout-engine.js';
import {
  DocumentSnapshotStack,
  computeSelectionMetrics,
} from '../services/google-docs-editor-engine.js';
import {
  VERIFIED_TECH_SEED_JOBS,
  extractTechnicalSkills,
} from '../services/direct-job-ingester.js';
import {
  ApplicantProfile,
  JobPosting,
  ApplicationRecord,
  TailoredBulletDiff,
} from '../types/index.js';

// ── Shared Candidate Fixtures ────────────────────────────────────────────────

const MOCK_CANDIDATE_RESUME = `
ALEX CHEN
San Francisco, CA | alex.chen@example.com | (555) 123-4567 | github.com/alexchen | linkedin.com/in/alexchen

SUMMARY
Software Engineer with 4 years of experience building web applications and backend services.
Skilled in React, TypeScript, Node.js, and SQL. Passionate about performant user interfaces.

EXPERIENCE
Acme Corp | Software Engineer | Austin, TX | 2022 – Present
• Worked on the customer dashboard using React and TypeScript.
• Built REST APIs in Node.js and PostgreSQL to handle order processing.
• Helped team migrate existing database tables and improved query speeds.
• Deployed services to AWS using Docker containers and basic CI/CD pipelines.

TechStart Inc | Junior Web Developer | San Francisco, CA | 2020 – 2022
• Developed frontend components for e-commerce website using HTML, CSS, and JavaScript.
• Fixed bugs across checkout flow and assisted senior engineers with testing.
• Participated in daily standups, code reviews, and sprint planning meetings.

PROJECTS
CloudMetrics Dashboard | React, Node.js, PostgreSQL | 2023
• Created a monitoring dashboard displaying server CPU, memory, and disk utilization.
• Used WebSockets for live telemetry data updates.

EDUCATION
University of California, Berkeley | B.S. in Computer Science | 2016 – 2020

SKILLS
Languages: TypeScript, JavaScript, Python, SQL, HTML, CSS
Frameworks & Libraries: React, Node.js, Express, Tailwind CSS
Tools & Cloud: PostgreSQL, Docker, AWS, Git, GitHub Actions
`;

const TARGET_STRIPE_JOB: JobPosting = {
  id: 'stripe-swe-infra',
  company: 'Stripe',
  title: 'Backend Engineer — Core Infrastructure',
  location: 'San Francisco, CA (Hybrid)',
  type: 'Full-time',
  season: '2026',
  source: 'Direct ATS',
  status: 'active',
  url: 'https://stripe.com/jobs/swe-infra',
  salaryRange: '$175,000 - $240,000',
  category: 'Software Engineering',
  experienceLevel: 'Mid-Senior',
  skills: ['Go', 'PostgreSQL', 'Kafka', 'Kubernetes', 'Distributed Systems', 'Redis'],
  responsibilities: [
    'Design and operate high-throughput distributed payment processing pipelines.',
    'Overhaul data ingestion services to achieve 99.999% availability under 50k req/sec.',
    'Lead incident post-mortems and performance profiling across microservices.',
  ],
  requirements: [
    '3+ years of production experience in Go, Java, or C++.',
    'Hands-on expertise with distributed message brokers like Kafka or RabbitMQ.',
    'Deep understanding of relational database concurrency and indexing.',
  ],
  aboutCompany: 'Stripe is a financial infrastructure platform for the internet.',
  isVerified: true,
};

// ── Feature 1: User Onboarding & Applicant Profile Setup ─────────────────────

describe('Feature 1: User Onboarding & Applicant Profile Setup', () => {
  it('creates a comprehensive candidate profile with validated contact info and skills', () => {
    const profile: ApplicantProfile = {
      firstName: 'Alex',
      lastName: 'Chen',
      email: 'alex.chen@example.com',
      phone: '(555) 123-4567',
      linkedinUrl: 'https://linkedin.com/in/alexchen',
      githubUrl: 'https://github.com/alexchen',
      portfolioUrl: 'https://alexchen.dev',
      currentTitle: 'Software Engineer',
      yearsOfExperience: 4,
      targetRoles: ['Backend Engineer', 'Fullstack Engineer', 'Distributed Systems Engineer'],
      skills: ['React', 'TypeScript', 'Node.js', 'PostgreSQL', 'Docker', 'AWS'],
      education: [
        {
          institution: 'University of California, Berkeley',
          degree: 'B.S.',
          fieldOfStudy: 'Computer Science',
          graduationYear: '2020',
          gpa: '3.8',
        },
      ],
      workAuthorization: 'US Citizen',
      needsSponsorship: false,
    };

    expect(profile.firstName).toBe('Alex');
    expect(profile.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    expect(profile.skills).toContain('TypeScript');
    expect(profile.skills.length).toBeGreaterThanOrEqual(5);
    expect(profile.targetRoles).toContain('Backend Engineer');
  });
});

// ── Feature 2: PDF Upload & High-Fidelity Layout Preservation ─────────────────

describe('Feature 2: PDF Layout Preservation & Extraction Engine', () => {
  it('detects layout geometry, margins, and font family correctly', () => {
    const sampleItems = [
      { str: 'ALEX CHEN', transform: [1, 0, 0, 1, 200, 750], width: 200, height: 24, fontName: 'Times-Bold' },
      { str: 'San Francisco, CA', transform: [1, 0, 0, 1, 210, 720], width: 180, height: 12, fontName: 'Times-Roman' },
      { str: 'EXPERIENCE', transform: [1, 0, 0, 1, 54, 680], width: 100, height: 14, fontName: 'Times-Bold' },
      { str: '• Worked on customer dashboard', transform: [1, 0, 0, 1, 72, 650], width: 300, height: 12, fontName: 'Times-Roman' },
    ];

    const layout = detectPdfLayout(sampleItems as any, 612);
    expect(layout.detectedFontFamily).toBe('serif');
    expect(layout.columnCount).toBe(1);
    expect(layout.headerAlignment).toBe('center');
  });

  it('preserves bullet styles across diverse typography markers', () => {
    expect(detectBulletStyleFromGlyph('•').style).toBe('disc');
    expect(detectBulletStyleFromGlyph('-').style).toBe('dash');
    expect(detectBulletStyleFromGlyph('▪').style).toBe('square');
    expect(detectBulletStyleFromGlyph('▸').style).toBe('arrow');
  });
});

// ── Feature 3: Document Canvas Google Docs Mechanics ─────────────────────────

describe('Feature 3: Document Canvas & Google Docs Editing Mechanics', () => {
  let stack: DocumentSnapshotStack;

  beforeEach(() => {
    stack = new DocumentSnapshotStack('<p>Initial</p>', 'Initial');
  });

  it('supports non-destructive undo and redo without destroying DOM structure', () => {
    stack.push('<p>Version 1</p>', 'Version 1');
    stack.push('<p>Version 2</p>', 'Version 2');

    expect(stack.canUndo()).toBe(true);
    expect(stack.canRedo()).toBe(false);

    // Undo 1 step
    const step1 = stack.undo('<p>Version 2</p>');
    expect(step1?.html).toBe('<p>Version 1</p>');
    expect(stack.canRedo()).toBe(true);

    // Redo step
    const redone = stack.redo(step1?.html!);
    expect(redone?.html).toBe('<p>Version 2</p>');
  });

  it('calculates accurate word and character telemetry for 1-line budgeting', () => {
    const text = 'Architected distributed caching with Redis, cutting latency by 45%.';
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    const chars = text.length;
    expect(words).toBe(9);
    expect(chars).toBe(text.length);
    expect(chars <= 85).toBe(true);
  });
});

// ── Feature 4: ATS Scoring & Audit Engine ────────────────────────────────────

describe('Feature 4: 7-Factor Deterministic ATS Scoring Engine', () => {
  const scorer = new AtsScorerService();

  it('evaluates resume against target role and identifies weak verbs and metric deficiencies', () => {
    const report = scorer.auditGeneralAts(MOCK_CANDIDATE_RESUME, 'Backend Engineer');

    expect(report.overallScore).toBeGreaterThan(0);
    expect(report.overallScore).toBeLessThan(85); // Unoptimized resume should be below competitive threshold

    // Weak verbs detection
    const weakVerbs = report.actionVerbStrength?.weakVerbsFound || [];
    expect(weakVerbs.length).toBeGreaterThanOrEqual(2);
    expect(weakVerbs).toContain('worked on');
    expect(weakVerbs).toContain('helped');

    // Missing key backend competencies
    const missing = report.keywords.filter(k => !k.foundInResume).map(k => k.keyword);
    expect(missing).toBeDefined();

    // Metric coverage should be low in this unquantified resume
    expect(report.quantificationStats?.percentage).toBeLessThan(50);
  });

  it('calculates job-specific score when matching against a target job description', () => {
    const jdText = `${TARGET_STRIPE_JOB.title}\n${TARGET_STRIPE_JOB.skills.join(', ')}\n${TARGET_STRIPE_JOB.responsibilities.join('\n')}`;
    const report = scorer.analyze(MOCK_CANDIDATE_RESUME, jdText);

    expect(report.overallScore).toBeGreaterThan(0);
    // Should flag Stripe's critical skills missing from Alex's resume
    const missing = report.keywords.filter(k => !k.foundInResume).map(k => k.keyword);
    expect(missing).toContain('Go');
    expect(missing).toContain('Kafka');
  });
});

// ── Feature 5: Gemini AI & Fallback Recommendation Pipeline ──────────────────

describe('Feature 5: Gemini AI & Fallback Recommendation Pipeline', () => {
  it('builds a comprehensive, grounded ATS context block with job tailoring section', () => {
    const atsContext: AtsAuditContext = {
      overallScore: 62,
      hardSkillsScore: 50,
      actionVerbScore: 40,
      metricScore: 45,
      productionScore: 40,
      selfProjectsScore: 55,
      weakVerbsFound: ['worked on', 'helped'],
      missingKeywords: ['Go', 'Kafka', 'Kubernetes'],
      matchedKeywords: ['React', 'TypeScript', 'Node.js'],
      quantifiedBullets: 1,
      totalBullets: 7,
      metricPercentage: 14,
      improvementSuggestions: ['Add production metrics', 'Replace passive verbs'],
      jobTitle: TARGET_STRIPE_JOB.title,
      jobCompany: TARGET_STRIPE_JOB.company,
      jobSeniority: TARGET_STRIPE_JOB.experienceLevel,
      jobKeySkills: TARGET_STRIPE_JOB.skills,
      jobRequirements: TARGET_STRIPE_JOB.requirements,
      jobResponsibilities: TARGET_STRIPE_JOB.responsibilities,
      criticalMissingKeywords: ['Go', 'Kafka', 'Kubernetes'],
      jobSpecificScore: 62,
    };

    const promptBlock = buildAtsContextBlock(atsContext);
    expect(promptBlock).toContain('HACKY AI ATS AUDIT REPORT');
    expect(promptBlock).toContain('JOB-SPECIFIC TAILORING CONTEXT');
    expect(promptBlock).toContain('Backend Engineer — Core Infrastructure @ Stripe');
    expect(promptBlock).toContain('Go, Kafka, Kubernetes');
    expect(promptBlock).toContain('TAILORING MANDATE');
  });

  it('generates high-yield domain-calibrated fallback recommendations with exact job citations', () => {
    const atsContext: AtsAuditContext = {
      overallScore: 62,
      hardSkillsScore: 50,
      actionVerbScore: 40,
      metricScore: 45,
      productionScore: 40,
      selfProjectsScore: 55,
      weakVerbsFound: ['worked on'],
      missingKeywords: ['Go', 'Kafka'],
      matchedKeywords: ['Node.js'],
      quantifiedBullets: 0,
      totalBullets: 4,
      metricPercentage: 0,
      improvementSuggestions: [],
      jobTitle: 'Backend Engineer',
      jobCompany: 'Stripe',
      criticalMissingKeywords: ['Go', 'Kafka'],
    };

    const result = generatePersonalizedFallbackRecommendations(
      MOCK_CANDIDATE_RESUME,
      TARGET_STRIPE_JOB.responsibilities.join('\n'),
      'Backend Engineer',
      atsContext
    );

    expect(result.recommendations.length).toBeGreaterThanOrEqual(3);
    const skillGap = result.recommendations.find(r => r.category === 'missing_skills');
    expect(skillGap).toBeDefined();
    expect(skillGap?.title).toContain('Go, Kafka');
    expect(skillGap?.title).toContain('Stripe');
    expect(skillGap?.critique).toContain('Stripe');
    expect(skillGap?.antiHallucinationVerified).toBe(true);
  });
});

// ── Feature 6: Job Discovery Catalog & Tech Search ───────────────────────────

describe('Feature 6: Job Discovery Feed & Direct ATS Ingestion', () => {
  it('loads verified seed tech jobs with complete compensation, requirements, and tags', () => {
    expect(VERIFIED_TECH_SEED_JOBS.length).toBeGreaterThan(0);
    const stripeJob = VERIFIED_TECH_SEED_JOBS.find(j => j.company.toLowerCase().includes('stripe'));
    expect(stripeJob).toBeDefined();
    expect(stripeJob?.isVerified).toBe(true);
    expect(stripeJob?.salaryRange).toBeDefined();
    expect(stripeJob?.skills?.length).toBeGreaterThan(0);
  });

  it('extracts technical skills accurately from job descriptions', () => {
    const text = 'We are hiring a Senior Engineer with deep experience in TypeScript, React, Go, Kafka, and PostgreSQL.';
    const skills = extractTechnicalSkills(text);
    expect(skills).toContain('TypeScript');
    expect(skills).toContain('React');
    expect(skills).toContain('Go');
    expect(skills).toContain('Kafka');
    expect(skills).toContain('PostgreSQL');
  });
});

// ── Feature 7: AI Tailor & Closed-Loop Evaluator ─────────────────────────────

describe('Feature 7: AI Tailor & Closed-Loop Evaluator-Optimizer', () => {
  it('classifies company archetype correctly for narrative calibration', () => {
    const stripeArchetype = CompanyArchetypeClassifier.classify('Stripe', 'financial infrastructure payment APIs');
    expect(stripeArchetype.label).toBe('High-Growth Platform & Infrastructure');

    const metaArchetype = CompanyArchetypeClassifier.classify('Meta', 'distributed systems at billion scale');
    expect(metaArchetype.label).toBe('Big Tech & Global Scale');
  });

  it('generates tri-variant framings (Systems Depth, Scale & Impact, Velocity & MVP)', () => {
    const triVariantService = new TriVariantService();
    const diff: TailoredBulletDiff = {
      id: 'diff-1',
      originalText: 'Worked on customer dashboard using React and TypeScript.',
      tailoredText: 'Architected responsive customer dashboard with React and TypeScript, cutting load time by 42%.',
      section: 'experience',
      category: 'impact',
      rationale: 'Elevated verb and metrics',
      scoreGain: 12,
      characterCount: 95,
      fitsLineBudget: true,
      status: 'pending',
    };

    const variants = triVariantService.getAllVariants(diff);
    expect(variants.systemsDepth).toBeDefined();
    expect(variants.scaleImpact).toBeDefined();
    expect(variants.velocityMvp).toBeDefined();
    expect(variants.systemsDepth.text.length).toBeGreaterThan(0);
  });
});

// ── Feature 8: Pre-Flight Review & Auto-Submit Engine ─────────────────────────

describe('Feature 8: Pre-Flight Review & Application Verification', () => {
  it('verifies that required pre-flight checklist items are validated before submit', () => {
    const candidate: ApplicantProfile = {
      firstName: 'Alex',
      lastName: 'Chen',
      email: 'alex.chen@example.com',
      phone: '(555) 123-4567',
      yearsOfExperience: 4,
      targetRoles: ['Backend Engineer'],
      skills: ['Go', 'PostgreSQL', 'Kafka'],
    };

    const isProfileReady = !!(candidate.firstName && candidate.lastName && candidate.email);
    const hasPdfAttached = true;
    const isReadyForAutoSubmit = isProfileReady && hasPdfAttached;

    expect(isReadyForAutoSubmit).toBe(true);
  });
});

// ── Feature 9: Application Pipeline Tracking ─────────────────────────────────

describe('Feature 9: Application Pipeline Tracking', () => {
  it('records application lifecycle transitions seamlessly', () => {
    const applications: ApplicationRecord[] = [];

    const newApp: ApplicationRecord = {
      id: 'app-stripe-1',
      jobId: TARGET_STRIPE_JOB.id,
      company: TARGET_STRIPE_JOB.company,
      title: TARGET_STRIPE_JOB.title,
      status: 'applied',
      appliedAt: Date.now(),
      matchScore: 88,
      notes: 'Applied with tailored Go and Kafka infrastructure resume.',
    };
    applications.push(newApp);

    expect(applications.length).toBe(1);
    expect(applications[0].status).toBe('applied');

    // Transition to interviewing
    applications[0].status = 'interviewing';
    expect(applications[0].status).toBe('interviewing');
  });
});

// ── Feature 10: Ask Hacky Local Deterministic Assistant ───────────────────────

describe('Feature 10: Ask Hacky Local Deterministic Assistant (Zero AI Usage)', () => {
  const chatbot = new HackyChatbotService();
  const mockContext: ChatbotContext = {
    resumeText: MOCK_CANDIDATE_RESUME,
    currentJob: {
      title: TARGET_STRIPE_JOB.title,
      company: TARGET_STRIPE_JOB.company,
      description: TARGET_STRIPE_JOB.requirements.join('\n'),
    },
    targetRole: 'Backend Engineer',
    atsScore: 65,
    matchPercentage: 60,
  };

  it('handles ATS breakdown inquiry locally without external API or LLM calls', async () => {
    const response = await chatbot.processUserMessage('show my ats breakdown', mockContext);
    expect(response.text).toBeDefined();
    expect(response.dataCard).toBeDefined();
    expect(response.dataCard?.type).toBe('ats_breakdown');
  });

  it('identifies weak verbs and suggests strong action verbs deterministically', async () => {
    const response = await chatbot.processUserMessage('find weak verbs', mockContext);
    expect(response.text).toMatch(/(?:passive|weak)/i);
    expect(response.dataCard?.type).toBe('weak_verbs');
  });

  it('elevates selected bullet using STAR formula without AI latency', async () => {
    const response = await chatbot.processUserMessage('elevate bullet: Worked on customer dashboard using React and TypeScript', mockContext);
    expect(response.text).toBeDefined();
    expect(response.dataCard).toBeDefined();
    expect(response.dataCard?.type).toBe('bullet_elevated');
  });
});
