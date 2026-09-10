/**
 * GeminiRecommendationService — Deeply Personalized AI Resume Recommendation Engine
 *
 * Provides high-impact, personalized recommendations for resume improvement:
 *   - Powered by Google Gemini (gemini-2.0-flash, gemini-1.5-flash, gemini-1.5-pro)
 *   - Diagnoses candidate's ACTUAL bullets (weak verbs, unquantified claims, missing architecture)
 *   - Supplies 1-click Before -> After bullet rewrites ready for in-doc replacement
 *   - Seamless API key management (localStorage, Chrome storage, environment)
 *   - Intelligent heuristic fallback engine that diagnoses real bullets when offline or no key is set
 */

export interface GeminiPersonalizedRecommendation {
  id: string;
  category: 'star_quantification' | 'systems_depth' | 'production_scale' | 'missing_skills' | 'project_elevation' | 'action_verbs';
  title: string;
  priority: 'critical' | 'high' | 'medium';
  impactPts: number;
  sectionHint: 'experience' | 'projects' | 'skills';
  originalText: string;
  improvedText: string;
  critique: string;
  reasoning: string;
  suggestedKeywords?: string[];
  suggestedActionLabel?: string;
  isResolved?: boolean;
}

export interface GeminiRecommendationRequest {
  resumeText: string;
  jobDescription?: string;
  targetRole?: string;
  apiKey?: string;
  model?: string;
}

export interface GeminiRecommendationResult {
  recommendations: GeminiPersonalizedRecommendation[];
  source: 'gemini' | 'heuristic_fallback';
  modelUsed?: string;
  candidateBulletCount: number;
  overallHealthScore: number;
  summary?: string;
  error?: string;
}

export const GEMINI_RECOMMENDATION_MODELS = [
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
];

const GEMINI_RECOMMENDATIONS_SCHEMA = {
  type: 'object',
  properties: {
    candidateSummary: {
      type: 'string',
      description: 'A 1-2 sentence executive assessment of the candidate profile and key strengths.',
    },
    recommendations: {
      type: 'array',
      description: 'List of deeply personalized, high-impact resume improvements citing the candidate actual bullets.',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Unique identifier for the recommendation' },
          category: {
            type: 'string',
            enum: ['star_quantification', 'systems_depth', 'production_scale', 'missing_skills', 'project_elevation', 'action_verbs'],
          },
          title: { type: 'string', description: 'Punchy headline describing the improvement' },
          priority: { type: 'string', enum: ['critical', 'high', 'medium'] },
          impactPts: { type: 'number', description: 'ATS score uplift points between 6 and 22' },
          sectionHint: { type: 'string', enum: ['experience', 'projects', 'skills'] },
          originalText: { type: 'string', description: 'The exact bullet or phrase from the candidate resume that needs elevation' },
          improvedText: { type: 'string', description: 'The rewritten, high-impact bullet ready for in-doc replacement' },
          critique: { type: 'string', description: 'Specific diagnostic explaining why the original was flagged' },
          reasoning: { type: 'string', description: 'Why this elevated rewrite improves hiring manager callbacks' },
          suggestedKeywords: {
            type: 'array',
            items: { type: 'string' },
            description: 'Technical keywords woven into the improved bullet',
          },
        },
        required: ['id', 'category', 'title', 'priority', 'impactPts', 'sectionHint', 'originalText', 'improvedText', 'critique', 'reasoning'],
      },
    },
  },
  required: ['recommendations'],
};

// ── Key Storage Utilities ──────────────────────────────────────────────────

export const STORAGE_KEY_GEMINI_KEY = 'resumehack_gemini_api_key';
let inMemoryKey = '';

export function getStoredGeminiApiKey(): string {
  try {
    if (typeof localStorage !== 'undefined') {
      const direct = localStorage.getItem(STORAGE_KEY_GEMINI_KEY);
      if (direct && direct.trim()) return direct.trim();

      const aiSettings = localStorage.getItem('resumehack_ai_settings');
      if (aiSettings) {
        const parsed = JSON.parse(aiSettings);
        if (parsed.apiKey && parsed.apiKey.trim()) return parsed.apiKey.trim();
      }
    }
  } catch { /* ignore */ }

  if (inMemoryKey) return inMemoryKey;

  const proc = typeof globalThis !== 'undefined' ? (globalThis as any).process : undefined;
  if (proc?.env?.GEMINI_API_KEY) {
    return proc.env.GEMINI_API_KEY.trim();
  }

  return '';
}

export function setStoredGeminiApiKey(key: string): void {
  const trimmed = key.trim();
  inMemoryKey = trimmed;
  try {
    if (typeof localStorage !== 'undefined') {
      if (trimmed) {
        localStorage.setItem(STORAGE_KEY_GEMINI_KEY, trimmed);
      } else {
        localStorage.removeItem(STORAGE_KEY_GEMINI_KEY);
      }

      // Also sync to resumehack_ai_settings for seamless provider interoperability
      const current = localStorage.getItem('resumehack_ai_settings');
      let parsed: any = {};
      try {
        if (current) parsed = JSON.parse(current);
      } catch { /* ignore */ }
      parsed.provider = 'gemini';
      parsed.apiKey = trimmed;
      if (!parsed.model) parsed.model = 'gemini-2.0-flash';
      localStorage.setItem('resumehack_ai_settings', JSON.stringify(parsed));
    }
  } catch { /* ignore */ }
}

export async function testGeminiApiKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
  if (!apiKey || !apiKey.trim()) {
    return { valid: false, error: 'API key cannot be empty' };
  }
  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey.trim(),
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: 'Ping. Respond with "ok".' }] }],
        generationConfig: { maxOutputTokens: 10 },
      }),
    });

    if (res.ok) {
      return { valid: true };
    }
    const errText = await res.text().catch(() => `HTTP ${res.status}`);
    return { valid: false, error: `Gemini API rejected key (${res.status}): ${errText.slice(0, 150)}` };
  } catch (err: any) {
    return { valid: false, error: err?.message || 'Network connection failed' };
  }
}

// ── Candidate Bullet Extraction ─────────────────────────────────────────────

export interface ExtractedCandidateBullet {
  text: string;
  cleanText: string;
  section: 'experience' | 'projects' | 'skills';
  hasMetric: boolean;
  hasWeakVerb: boolean;
  leadWord: string;
}

const WEAK_VERB_REGEX = /^(worked|helped|assisted|responsible for|handled|participated in|supported|made|did|aided|was involved in|tried to|tasked with|contributed to)\b/i;
const METRIC_REGEX = /(\d+(?:\.\d+)?%|\$\d+(?:,\d+)*(?:\.\d+)?[kKmMbB]?|\b\d+\s*(?:ms|s|seconds?|minutes?|hours?)\b|\b\d+[kKmMbB]?\+?\s*(?:users|clients|qps|rps|engineers|requests|queries|stars|downloads|lines|records)\b|\b(?:reduced|increased|accelerated|saved|scaled|optimized)\s+(?:by\s+)?\d+)/i;

export function extractCandidateBullets(resumeText: string): ExtractedCandidateBullet[] {
  if (!resumeText || resumeText.trim().length === 0) return [];

  const lines = resumeText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const results: ExtractedCandidateBullet[] = [];
  let currentSection: 'experience' | 'projects' | 'skills' = 'experience';

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (/^(work\s+experience|experience|employment|professional\s+experience|career)/i.test(lower)) {
      currentSection = 'experience';
      continue;
    } else if (/^(projects|technical\s+projects|academic\s+projects|open\s+source|personal\s+projects)/i.test(lower)) {
      currentSection = 'projects';
      continue;
    } else if (/^(skills|technical\s+skills|core\s+competencies|technologies|tools)/i.test(lower)) {
      currentSection = 'skills';
      continue;
    } else if (/^(education|certifications|awards|summary|contact)/i.test(lower)) {
      continue;
    }

    // Detect bullet formatting or actionable lines
    const isBulletGlyph = /^[•\-\*\u2022\u2023\u25E6\u2043\u2219▪▸⁃]\s*/.test(line);
    const startsWithVerb = /^[A-Z][a-z]+ed\b|^[A-Z][a-z]+ing\b/i.test(line);

    if (isBulletGlyph || (line.length > 35 && startsWithVerb && currentSection !== 'skills')) {
      const clean = line.replace(/^[•\-\*\u2022\u2023\u25E6\u2043\u2219▪▸⁃\s]+/, '').trim();
      if (clean.length >= 25 && !clean.includes(' | ') && !/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\d{4})/i.test(clean)) {
        const leadWord = clean.split(/\s+/)[0] || '';
        const hasMetric = METRIC_REGEX.test(clean);
        const hasWeakVerb = WEAK_VERB_REGEX.test(clean);

        results.push({
          text: line,
          cleanText: clean,
          section: currentSection,
          hasMetric,
          hasWeakVerb,
          leadWord,
        });
      }
    }
  }

  return results;
}

// ── Smart Personalized Fallback Engine ──────────────────────────────────────

export function generatePersonalizedFallbackRecommendations(
  resumeText: string,
  jobDescription?: string,
  targetRole?: string
): GeminiRecommendationResult {
  const extracted = extractCandidateBullets(resumeText);
  const items: GeminiPersonalizedRecommendation[] = [];

  // 1. Weak verb bullets -> Action verb upgrades with candidate's actual text
  const weakVerbBullets = extracted.filter(b => b.hasWeakVerb);
  if (weakVerbBullets.length > 0) {
    const target = weakVerbBullets[0];
    const elevatedLeadVerb = target.section === 'projects' ? 'Architected and engineered' : 'Spearheaded and scaled';
    const upgradedBullet = target.cleanText.replace(WEAK_VERB_REGEX, elevatedLeadVerb);

    items.push({
      id: 'rec-fallback-verb-' + Math.abs(hashCode(target.cleanText)),
      category: 'action_verbs',
      title: 'Replace Passive Action Verb with Engineering Ownership',
      priority: 'critical',
      impactPts: 16,
      sectionHint: target.section,
      originalText: target.cleanText,
      improvedText: `• ${upgradedBullet} with automated testing and continuous deployment.`,
      critique: `Your bullet begins with "${target.leadWord}", which sounds passive and junior. Tier-1 engineering screeners scan for leadership and direct technical stewardship.`,
      reasoning: 'Starting with strong executive verbs (Architected, Spearheaded, Engineered) immediately elevates candidate seniority in automated applicant rankings.',
      suggestedActionLabel: 'Replace in Resume',
    });
  }

  // 2. Unquantified bullets -> STAR metric formula upgrades
  const unquantified = extracted.filter(b => !b.hasMetric && !b.hasWeakVerb);
  if (unquantified.length > 0) {
    const target = unquantified[0];
    const clean = target.cleanText.replace(/\.$/, '');
    const upgraded = `• ${clean}, reducing latency by 35% and improving throughput across 10,000+ operations/sec.`;

    items.push({
      id: 'rec-fallback-quant-' + Math.abs(hashCode(target.cleanText)),
      category: 'star_quantification',
      title: 'Inject Concrete Quantifiable Metrics (Results & Scale)',
      priority: 'critical',
      impactPts: 18,
      sectionHint: target.section,
      originalText: target.cleanText,
      improvedText: upgraded,
      critique: 'This bullet describes tasks without measurable business or technical outcomes. Google and Meta hiring managers look for the X-Y-Z formula (Accomplished [X] as measured by [Y] by doing [Z]).',
      reasoning: 'Quantified bullets achieve a 40% higher recruiter engagement score by demonstrating tangible scale, efficiency gains, and ROI.',
      suggestedActionLabel: 'Replace in Resume',
    });
  }

  // 3. Second unquantified bullet or project bullet
  if (unquantified.length > 1) {
    const target = unquantified[1];
    const clean = target.cleanText.replace(/\.$/, '');
    const upgraded = `• ${clean} utilizing Docker containerization and Redis caching; slashed query execution time by 48%.`;

    items.push({
      id: 'rec-fallback-systems-' + Math.abs(hashCode(target.cleanText)),
      category: 'systems_depth',
      title: 'Highlight Distributed Systems & Architecture Patterns',
      priority: 'high',
      impactPts: 14,
      sectionHint: target.section,
      originalText: target.cleanText,
      improvedText: upgraded,
      critique: 'The description lacks modern architectural depth (caching layers, indexing, concurrency, async queues). Recruiters look for proof of production complexity.',
      reasoning: 'Highlighting architectural patterns proves you design for scalability and operational stability rather than just basic scripting.',
      suggestedActionLabel: 'Replace in Resume',
    });
  }

  // 4. Missing Skills & Job Description Alignment
  if (jobDescription && jobDescription.trim().length > 30) {
    const commonTech = [
      'Docker', 'Kubernetes', 'AWS', 'PostgreSQL', 'Redis', 'TypeScript',
      'Python', 'Go', 'GraphQL', 'CI/CD', 'Kafka', 'React', 'Terraform'
    ];
    const missing = commonTech.filter(tech => {
      const inJd = new RegExp(`\\b${tech}\\b`, 'i').test(jobDescription);
      const inResume = new RegExp(`\\b${tech}\\b`, 'i').test(resumeText);
      return inJd && !inResume;
    });

    if (missing.length > 0) {
      const targetTech = missing.slice(0, 3);
      const hostBullet = extracted.find(b => b.section === 'experience' || b.section === 'projects');
      const orig = hostBullet ? hostBullet.cleanText : 'Developed software solutions for team projects.';
      const upgraded = `• ${orig.replace(/\.$/, '')}, provisioning infrastructure via ${targetTech.join(' & ')} with automated CI/CD deployment pipelines.`;

      items.push({
        id: 'rec-fallback-skills-' + Math.abs(hashCode(targetTech.join('-'))),
        category: 'missing_skills',
        title: `Integrate Target Role Core Skills (${targetTech.join(', ')})`,
        priority: 'critical',
        impactPts: 20,
        sectionHint: hostBullet?.section || 'experience',
        originalText: orig,
        improvedText: upgraded,
        critique: `The job description demands ${targetTech.join(', ')}, but your resume currently lacks these core keywords. Automated ATS filters screen out resumes missing target tech stack tokens.`,
        reasoning: 'Direct keyword alignment in project bullets passes ATS semantic filters while demonstrating hands-on architectural experience to human interviewers.',
        suggestedKeywords: targetTech,
        suggestedActionLabel: 'Replace in Resume',
      });
    }
  }

  // 5. Production & Reliability Signal
  const hasCloudOrContainer = /(docker|kubernetes|aws|gcp|azure|ci\/cd|terraform|datadog|prometheus)/i.test(resumeText);
  if (!hasCloudOrContainer && extracted.length > 0) {
    const host = extracted[extracted.length - 1];
    items.push({
      id: 'rec-fallback-prod-infra',
      category: 'production_scale',
      title: 'Missing Production Infrastructure & Cloud Observability',
      priority: 'high',
      impactPts: 15,
      sectionHint: host.section,
      originalText: host.cleanText,
      improvedText: `• ${host.cleanText.replace(/\.$/, '')}; deployed containerized microservices to AWS with automated GitHub Actions CI/CD pipelines.`,
      critique: 'No cloud infrastructure or containerization keywords detected. Modern tech companies require engineers who understand deployment, CI/CD, and production monitoring.',
      reasoning: 'Adding cloud deployment signals prevents candidate down-leveling from Senior/Staff tiers.',
      suggestedKeywords: ['AWS', 'Docker', 'CI/CD', 'GitHub Actions'],
      suggestedActionLabel: 'Replace in Resume',
    });
  }

  // Calculate health score based on quality of bullets
  const quantifiedRatio = extracted.length > 0 ? (extracted.filter(b => b.hasMetric).length / extracted.length) : 0.5;
  const healthScore = Math.round(Math.min(95, Math.max(45, 55 + (quantifiedRatio * 35))));

  return {
    recommendations: items,
    source: 'heuristic_fallback',
    candidateBulletCount: extracted.length,
    overallHealthScore: healthScore,
    summary: `Analyzed ${extracted.length} resume bullets. Found ${items.length} high-yield opportunities for quantifiable metrics, action verb elevation, and cloud infrastructure framing.`,
  };
}

// ── Gemini API Call Engine ──────────────────────────────────────────────────

export class GeminiRecommendationService {
  private apiKey: string;
  private primaryModel: string;

  constructor(apiKey?: string, model?: string) {
    this.apiKey = (apiKey || getStoredGeminiApiKey()).trim();
    this.primaryModel = model || 'gemini-2.0-flash';
  }

  public setApiKey(key: string): void {
    this.apiKey = key.trim();
  }

  /**
   * Generates deeply personalized recommendations utilizing Google Gemini API.
   * Cascades through models to prevent downtime, with intelligent heuristic fallback.
   */
  public async generateRecommendations(
    request: GeminiRecommendationRequest
  ): Promise<GeminiRecommendationResult> {
    const effectiveKey = (request.apiKey || this.apiKey || getStoredGeminiApiKey()).trim();
    const resumeText = request.resumeText || '';
    const jobDescription = request.jobDescription || '';
    const targetRole = request.targetRole || 'Software Engineer';

    // If no key is provided, return instant heuristic recommendations based on real text
    if (!effectiveKey) {
      return generatePersonalizedFallbackRecommendations(resumeText, jobDescription, targetRole);
    }

    const candidateBullets = extractCandidateBullets(resumeText);
    const candidateBulletsText = candidateBullets.map((b, i) => `[Bullet ${i + 1}] (${b.section}) "${b.cleanText}"`).join('\n');

    const systemPrompt = `You are Hacky, an elite AI Career Architect, Staff Engineer, and Hiring Committee Leader for top tech companies (Google, Meta, Apple, Netflix).
Your mission is to perform a rigorous architectural and ATS audit of the candidate's resume and generate 5 to 7 deeply personalized, high-impact recommendations.

STRICT PERSONALIZATION RULES:
1. Every single recommendation MUST quote an ACTUAL bullet or phrase from the candidate's resume in 'originalText'. Do NOT invent or make up fake bullets.
2. In 'improvedText', provide a rewritten, production-grade bullet that elevates the candidate's ACTUAL project/experience with:
   - The X-Y-Z formula (Accomplished [X] measured by [Y] by doing [Z]).
   - Concrete quantifiable metrics (e.g. latency drops in ms, RPS/QPS throughput, %, dollar savings, user count).
   - High-impact architectural patterns (concurrency, caching, indexing, distributed transactions, CI/CD, containerization).
   - Strong executive action verbs (Architected, Engineered, Spearheaded, Orchestrated instead of 'Worked on', 'Helped', 'Responsible for').
3. Preserve the candidate's true domain and factual integrity (anti-hallucination). If estimating metrics, use realistic engineering figures (e.g. 35% latency drop, 10k+ QPS, 99.9% uptime).
4. In 'critique', provide an incisive diagnostic explaining why the original bullet is weak or fails ATS/interviewer screens.
5. In 'reasoning', explain why the elevated rewrite directly improves interview callback rates.
6. If a Job Description is provided, identify missing critical skills and weave them naturally into the improved bullets.`;

    const userPrompt = `Target Role: ${targetRole}
${jobDescription ? `\nTarget Job Description:\n${jobDescription.slice(0, 3000)}\n` : ''}

Candidate's Actual Resume Text:
"""
${resumeText.slice(0, 6000)}
"""

Candidate's Extracted Bullets:
"""
${candidateBulletsText || 'No explicit bullets detected; analyze the experience descriptions.'}
"""

Please analyze the resume against tier-1 tech hiring standards and produce structured JSON recommendations.`;

    const candidateModels = [
      request.model || this.primaryModel,
      ...GEMINI_RECOMMENDATION_MODELS,
    ].filter(Boolean);
    const uniqueModels = Array.from(new Set(candidateModels));

    let lastError = '';

    for (const currentModel of uniqueModels) {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent`;

      const requestBody = {
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: userPrompt }],
          },
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 3500,
          responseMimeType: 'application/json',
          responseSchema: GEMINI_RECOMMENDATIONS_SCHEMA,
        },
        safetySettings: [
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
        ],
      };

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': effectiveKey,
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const errText = await response.text().catch(() => `HTTP ${response.status}`);
          lastError = `Gemini API error (${response.status}): ${errText.slice(0, 200)}`;

          if (
            response.status === 503 ||
            response.status === 429 ||
            response.status === 404 ||
            response.status >= 500 ||
            errText.includes('high demand') ||
            errText.includes('UNAVAILABLE') ||
            errText.includes('RESOURCE_EXHAUSTED') ||
            errText.includes('not found')
          ) {
            console.warn(`[GeminiRecommendationService] Model ${currentModel} unavailable (${response.status}), trying fallback...`);
            continue;
          }
          throw new Error(lastError);
        }

        const data = await response.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const parsed = this.parseGeminiResponse(text, candidateBullets);

        if (parsed.recommendations && parsed.recommendations.length > 0) {
          return {
            recommendations: parsed.recommendations,
            source: 'gemini',
            modelUsed: currentModel,
            candidateBulletCount: candidateBullets.length,
            overallHealthScore: parsed.healthScore,
            summary: parsed.candidateSummary,
          };
        }
      } catch (err: any) {
        lastError = err?.message || String(err);
        console.warn(`[GeminiRecommendationService] Call failed on ${currentModel}: ${lastError}`);
      }
    }

    // If all Gemini API calls failed, smoothly fall back to our personalized heuristic engine
    console.warn(`[GeminiRecommendationService] All Gemini calls failed, using personalized heuristic fallback: ${lastError}`);
    const fallback = generatePersonalizedFallbackRecommendations(resumeText, jobDescription, targetRole);
    fallback.error = lastError;
    return fallback;
  }

  private parseGeminiResponse(
    rawJson: string,
    candidateBullets: ExtractedCandidateBullet[]
  ): { recommendations: GeminiPersonalizedRecommendation[]; healthScore: number; candidateSummary: string } {
    if (!rawJson || !rawJson.trim()) {
      return { recommendations: [], healthScore: 70, candidateSummary: '' };
    }

    try {
      // Remove any accidental markdown backticks wrapping JSON
      const cleanJson = rawJson.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
      const parsed = JSON.parse(cleanJson);

      const items: GeminiPersonalizedRecommendation[] = [];
      const recs = Array.isArray(parsed?.recommendations) ? parsed.recommendations : [];

      for (let i = 0; i < recs.length; i++) {
        const r = recs[i];
        if (!r.title || !r.improvedText) continue;

        // Ensure originalText is clean and formatted
        let orig = (r.originalText || '').trim();
        if (!orig && candidateBullets.length > i) {
          orig = candidateBullets[i].cleanText;
        }

        let imp = (r.improvedText || '').trim();
        if (!imp.startsWith('•') && !imp.startsWith('-') && !imp.startsWith('*')) {
          imp = `• ${imp}`;
        }

        items.push({
          id: r.id || `gemini-rec-${i + 1}-${Math.abs(hashCode(r.title))}`,
          category: r.category || 'star_quantification',
          title: r.title,
          priority: r.priority || (i < 2 ? 'critical' : 'high'),
          impactPts: typeof r.impactPts === 'number' ? Math.min(25, Math.max(6, r.impactPts)) : 14,
          sectionHint: r.sectionHint || 'experience',
          originalText: orig,
          improvedText: imp,
          critique: r.critique || 'Lacks measurable business impact and active engineering verbs.',
          reasoning: r.reasoning || 'Elevates candidate visibility and passes automated ATS semantic rubrics.',
          suggestedKeywords: Array.isArray(r.suggestedKeywords) ? r.suggestedKeywords : [],
          suggestedActionLabel: 'Replace in Resume',
        });
      }

      return {
        recommendations: items,
        healthScore: Math.min(95, Math.max(50, 60 + items.length * 5)),
        candidateSummary: parsed.candidateSummary || '',
      };
    } catch (e) {
      console.error('[GeminiRecommendationService] Failed to parse JSON response:', e);
      return { recommendations: [], healthScore: 70, candidateSummary: '' };
    }
  }
}

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}
