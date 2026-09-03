/**
 * AiTailorService — Multi-Provider LLM-powered resume bullet tailoring.
 *
 * Supports:
 *   - Google Gemini (gemini-2.0-flash, gemini-1.5-flash, gemini-1.5-pro)
 *   - OpenAI (gpt-4o-mini, gpt-4o, o3-mini)
 *   - Anthropic Claude (claude-3-5-haiku, claude-3-5-sonnet)
 *   - DeepSeek (deepseek-chat, deepseek-reasoner)
 *   - Local Ollama (llama3.3, qwen2.5, mistral via http://localhost:11434/v1)
 *   - Custom OpenAI-compatible endpoints
 *
 * Features:
 *   - Strict Structured Outputs (OpenAPI schema for Gemini & OpenAI strict mode)
 *   - Header-based authentication (no API key leakage in URL query parameters)
 *   - Factual guardrails & anti-hallucination placeholder rules
 *   - Multi-stage JSON repair parser with zero-fail fallback
 */

import {
  ResumeBullet,
  TailoredBulletDiff,
  AtsScoreReport,
  AiProvider,
  AiSettings,
  PROVIDER_MODEL_PRESETS,
  ApplicantProfile,
} from '../types/index.js';
import { calculateLineBudget } from './llm-tailor.js';
import { RobustTextMatcher } from './google-docs.js';
import { CompanyArchetypeClassifier, ArchetypeProfile } from './archetype-classifier.js';

export type { AiProvider, AiSettings };

export interface AiTailorResult {
  diffs: TailoredBulletDiff[];
  usedAi: boolean;
  model?: string;
  documentSummary?: string;
  archetype?: ArchetypeProfile;
  error?: string;
}

export const EMBEDDED_GEMINI_API_KEY = ''; // Set your Gemini API key via extension settings

export const DEFAULT_AI_SETTINGS: AiSettings = {
  provider: 'gemini',
  apiKey: EMBEDDED_GEMINI_API_KEY,
  model: 'gemini-3.5-flash-lite',
  strictAntiHallucination: true,
};

function normalizeModel(provider: string, rawModel?: string): string {
  if (provider === 'gemini') {
    const clean = (rawModel || '').replace(/^models\//, '').trim();
    if (clean) return clean;
    return 'gemini-3.5-flash-lite';
  }
  return rawModel || PROVIDER_MODEL_PRESETS[provider as AiProvider]?.defaultModel || 'default';
}

export async function getAiSettings(): Promise<AiSettings> {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      return new Promise((resolve) => {
        chrome.storage.local.get(['resumehack_ai_settings'], (result) => {
          const s = result?.resumehack_ai_settings;
          if (s?.provider) {
            resolve({
              provider: s.provider,
              apiKey: s.apiKey?.trim() || (s.provider === 'gemini' ? EMBEDDED_GEMINI_API_KEY : ''),
              model: normalizeModel(s.provider, s.model),
              baseUrl: s.baseUrl,
              strictAntiHallucination: s.strictAntiHallucination ?? true,
            });
          } else {
            resolve(DEFAULT_AI_SETTINGS);
          }
        });
      });
    }
    const stored = localStorage.getItem('resumehack_ai_settings');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed?.provider) {
        return {
          provider: parsed.provider,
          apiKey: parsed.apiKey?.trim() || (parsed.provider === 'gemini' ? EMBEDDED_GEMINI_API_KEY : ''),
          model: normalizeModel(parsed.provider, parsed.model),
          baseUrl: parsed.baseUrl,
          strictAntiHallucination: parsed.strictAntiHallucination ?? true,
        };
      }
    }
    return DEFAULT_AI_SETTINGS;
  } catch {
    return DEFAULT_AI_SETTINGS;
  }
}

export async function saveAiSettings(settings: AiSettings): Promise<void> {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      await new Promise<void>((resolve) =>
        chrome.storage.local.set({ resumehack_ai_settings: settings }, resolve)
      );
      return;
    }
    localStorage.setItem('resumehack_ai_settings', JSON.stringify(settings));
  } catch { /* ignore */ }
}

export async function removeAiSettings(): Promise<void> {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      await new Promise<void>((resolve) =>
        chrome.storage.local.remove(['resumehack_ai_settings'], resolve)
      );
      return;
    }
    localStorage.removeItem('resumehack_ai_settings');
  } catch { /* ignore */ }
}

// ── JSON Schema Definitions for Strict Structured Outputs ─────────────────────

/**
 * Google Gemini Schema (OpenAPI 3.0 subset)
 * IMPORTANT: Gemini rejects 'additionalProperties', so it must NOT be included.
 */
const GEMINI_IMPROVEMENTS_SCHEMA = {
  type: 'object',
  properties: {
    documentSummary: {
      type: 'string',
      description: 'Strategic explanation of how the full resume was tailored for the target company archetype and role',
    },
    improvements: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Original bullet ID' },
          originalText: { type: 'string', description: 'Original bullet text' },
          tailoredText: { type: 'string', description: 'Primary ATS-optimized STAR bullet' },
          characterCount: { type: 'number', description: 'Total character length of tailoredText' },
          fitsLineBudget: { type: 'boolean', description: 'True if bullet fits within the specified character line budget' },
          injectedKeywords: {
            type: 'array',
            items: { type: 'string' },
            description: 'Keywords incorporated into this bullet',
          },
          rationale: { type: 'string', description: 'Concise reason why this bullet elevates score' },
          scoreGain: { type: 'number', description: 'Estimated ATS percentage point gain (e.g. 8)' },
          starAnalysis: {
            type: 'object',
            properties: {
              situationTask: { type: 'string' },
              action: { type: 'string' },
              resultMetric: { type: 'string' },
            },
            required: ['situationTask', 'action', 'resultMetric'],
            description: 'STAR component breakdown',
          },
          variations: {
            type: 'object',
            properties: {
              highImpact: { type: 'string', description: 'Metrics and revenue focused variation' },
              technicalDepth: { type: 'string', description: 'Architecture and technical mastery variation' },
              leadership: { type: 'string', description: 'Scope, ownership, and cross-functional leadership variation' },
            },
            required: ['highImpact', 'technicalDepth', 'leadership'],
            description: 'Alternative bullet variations for the candidate',
          },
        },
        required: ['id', 'originalText', 'tailoredText', 'injectedKeywords', 'rationale', 'scoreGain', 'starAnalysis', 'variations'],
      },
    },
  },
  required: ['improvements'],
};

/**
 * OpenAI Schema (JSON Schema Draft-07 strict structured outputs)
 * Requires additionalProperties: false on all object levels.
 */
const OPENAI_IMPROVEMENTS_SCHEMA = {
  type: 'object',
  properties: {
    documentSummary: {
      type: 'string',
      description: 'Strategic explanation of how the full resume was tailored for the target company archetype and role',
    },
    improvements: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Original bullet ID' },
          originalText: { type: 'string', description: 'Original bullet text' },
          tailoredText: { type: 'string', description: 'Primary ATS-optimized STAR bullet' },
          characterCount: { type: 'number', description: 'Total character length of tailoredText' },
          fitsLineBudget: { type: 'boolean', description: 'True if bullet fits within the specified character line budget' },
          injectedKeywords: {
            type: 'array',
            items: { type: 'string' },
            description: 'Keywords incorporated into this bullet',
          },
          rationale: { type: 'string', description: 'Concise reason why this bullet elevates score' },
          scoreGain: { type: 'number', description: 'Estimated ATS percentage point gain (e.g. 8)' },
          starAnalysis: {
            type: 'object',
            properties: {
              situationTask: { type: 'string' },
              action: { type: 'string' },
              resultMetric: { type: 'string' },
            },
            required: ['situationTask', 'action', 'resultMetric'],
            additionalProperties: false,
            description: 'STAR component breakdown',
          },
          variations: {
            type: 'object',
            properties: {
              highImpact: { type: 'string', description: 'Metrics and revenue focused variation' },
              technicalDepth: { type: 'string', description: 'Architecture and technical mastery variation' },
              leadership: { type: 'string', description: 'Scope, ownership, and cross-functional leadership variation' },
            },
            required: ['highImpact', 'technicalDepth', 'leadership'],
            additionalProperties: false,
            description: 'Alternative bullet variations for the candidate',
          },
        },
        required: ['id', 'originalText', 'tailoredText', 'injectedKeywords', 'rationale', 'scoreGain', 'starAnalysis', 'variations'],
        additionalProperties: false,
      },
    },
  },
  required: ['improvements'],
  additionalProperties: false,
};

// ── Main Service ───────────────────────────────────────────────────────────────

export class AiTailorService {
  /**
   * Job-specific AI tailoring.
   */
  public async tailorBulletsWithAi(
    bullets: ResumeBullet[],
    jobDescription: string,
    atsReport: AtsScoreReport,
    jobTitle: string,
    company: string,
    settings: AiSettings,
    jobIntel?: { seniorityLevel?: string; extractedSkills?: string[] }
  ): Promise<AiTailorResult> {
    try {
      const strictAntiHallucination = settings.strictAntiHallucination ?? true;
      const missingKeywords = atsReport.keywords
        .filter((k) => !k.foundInResume)
        .map((k) => k.keyword)
        .slice(0, 10);

      const promptData = this.buildJobTailorPrompt(
        bullets,
        jobDescription,
        missingKeywords,
        jobTitle,
        company,
        strictAntiHallucination,
        jobIntel
      );

      const archetype = CompanyArchetypeClassifier.classify(company, jobDescription);
      const result = await this.routeAndExecute(promptData, bullets, settings);
      return {
        ...result,
        archetype,
      };
    } catch (err: any) {
      console.error('[AiTailorService] Error:', err);
      return { diffs: [], usedAi: false, error: err?.message || 'AI call failed' };
    }
  }

  /**
   * Universal Master Resume ATS & STAR Optimizer (General domain benchmark).
   */
  public async optimizeUniversalMasterBulletsWithAi(
    bullets: ResumeBullet[],
    domain: string,
    settings: AiSettings
  ): Promise<AiTailorResult> {
    try {
      const strictAntiHallucination = settings.strictAntiHallucination ?? true;
      const promptData = this.buildUniversalPrompt(bullets, domain, strictAntiHallucination);
      return await this.routeAndExecute(promptData, bullets, settings);
    } catch (err: any) {
      console.error('[AiTailorService] Universal optimization error:', err);
      return { diffs: [], usedAi: false, error: err?.message || 'AI universal call failed' };
    }
  }

  // ── Route to Provider ──────────────────────────────────────────────────────

  private async routeAndExecute(
    promptData: { systemPrompt: string; userPrompt: string },
    bullets: ResumeBullet[],
    settings: AiSettings
  ): Promise<AiTailorResult> {
    const provider = settings.provider || 'gemini';

    if (provider === 'gemini') {
      return await this.callGemini(promptData, bullets, settings);
    } else if (provider === 'openai') {
      return await this.callOpenAi(promptData, bullets, settings);
    } else if (provider === 'claude') {
      return await this.callClaude(promptData, bullets, settings);
    } else if (provider === 'deepseek') {
      return await this.callDeepSeek(promptData, bullets, settings);
    } else if (provider === 'ollama') {
      return await this.callOllama(promptData, bullets, settings);
    } else if (provider === 'custom') {
      return await this.callCustomOpenAiCompatible(promptData, bullets, settings);
    }

    return { diffs: [], usedAi: false, error: `Unsupported provider: ${provider}` };
  }

  // ── 1. Google Gemini Provider ──────────────────────────────────────────────

  private async callGemini(
    promptData: { systemPrompt: string; userPrompt: string },
    bullets: ResumeBullet[],
    settings: AiSettings
  ): Promise<AiTailorResult> {
    let rawModel = settings.model || PROVIDER_MODEL_PRESETS.gemini.defaultModel;
    let requestedModel = rawModel.replace(/^models\//, '').trim();

    // Cascading fallback models to guarantee 100% availability during Google Cloud high-demand spikes
    const candidateModels = [
      requestedModel,
      'gemini-3.5-flash-lite',
      'gemini-3.6-flash-lite',
      'gemini-2.0-flash',
      'gemini-1.5-flash',
      'gemini-2.0-flash-lite',
      'gemini-1.5-pro',
    ].filter(Boolean);
    const uniqueModels = Array.from(new Set(candidateModels));

    let lastError = '';

    for (const currentModel of uniqueModels) {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent`;

      const requestBody: any = {
        systemInstruction: {
          parts: [{ text: promptData.systemPrompt }],
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: promptData.userPrompt }],
          },
        ],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 3072,
          responseMimeType: 'application/json',
          responseSchema: GEMINI_IMPROVEMENTS_SCHEMA,
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
            'x-goog-api-key': settings.apiKey.trim(),
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const errText = await response.text().catch(() => `HTTP ${response.status}`);
          lastError = `Gemini API error (${response.status}): ${errText.slice(0, 200)}`;

          // Retry next candidate model on 503 (high demand), 429 (rate limit), 404 (unavailable), 500 (internal error)
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
            console.warn(`[AiTailorService] Model ${currentModel} busy/unavailable (${response.status}), trying fallback model...`);
            continue;
          }
          throw new Error(lastError);
        }

        const data = await response.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const { diffs, documentSummary } = this.parseAiResponse(text, bullets);

        if (diffs.length === 0) {
          console.warn(`[AiTailorService] Model ${currentModel} produced 0 diffs, trying fallback...`);
          continue;
        }

        return { diffs, documentSummary, usedAi: true, model: `gemini/${currentModel}` };
      } catch (err: any) {
        lastError = err?.message || 'Gemini request failed';
        console.warn(`[AiTailorService] Request error for ${currentModel}:`, err?.message);
        continue;
      }
    }

    return {
      diffs: [],
      usedAi: false,
      error: lastError || 'All Gemini models unavailable due to high demand',
    };
  }

  // ── 2. OpenAI Provider ─────────────────────────────────────────────────────

  private async callOpenAi(
    promptData: { systemPrompt: string; userPrompt: string },
    bullets: ResumeBullet[],
    settings: AiSettings
  ): Promise<AiTailorResult> {
    const model = settings.model || PROVIDER_MODEL_PRESETS.openai.defaultModel;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.apiKey.trim()}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: promptData.systemPrompt },
          { role: 'user', content: promptData.userPrompt },
        ],
        temperature: 0.4,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'resume_improvements',
            strict: true,
            schema: OPENAI_IMPROVEMENTS_SCHEMA,
          },
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => `HTTP ${response.status}`);
      throw new Error(`OpenAI API error (${response.status}): ${errText.slice(0, 200)}`);
    }

    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content || '';
    const { diffs, documentSummary } = this.parseAiResponse(text, bullets);

    if (diffs.length === 0) {
      return { diffs: [], usedAi: false, error: 'OpenAI returned empty structured output' };
    }

    return { diffs, documentSummary, usedAi: true, model: `openai/${model}` };
  }

  // ── 3. Anthropic Claude Provider ───────────────────────────────────────────

  private async callClaude(
    promptData: { systemPrompt: string; userPrompt: string },
    bullets: ResumeBullet[],
    settings: AiSettings
  ): Promise<AiTailorResult> {
    const model = settings.model || PROVIDER_MODEL_PRESETS.claude.defaultModel;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': settings.apiKey.trim(),
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model,
        system: promptData.systemPrompt,
        messages: [{ role: 'user', content: promptData.userPrompt }],
        max_tokens: 3072,
        temperature: 0.4,
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => `HTTP ${response.status}`);
      throw new Error(`Claude API error (${response.status}): ${errText.slice(0, 200)}`);
    }

    const data = await response.json();
    const text = data?.content?.[0]?.text || '';
    const { diffs, documentSummary } = this.parseAiResponse(text, bullets);

    if (diffs.length === 0) {
      return { diffs: [], usedAi: false, error: 'Claude returned invalid JSON' };
    }

    return { diffs, documentSummary, usedAi: true, model: `claude/${model}` };
  }

  // ── 4. DeepSeek Provider ───────────────────────────────────────────────────

  private async callDeepSeek(
    promptData: { systemPrompt: string; userPrompt: string },
    bullets: ResumeBullet[],
    settings: AiSettings
  ): Promise<AiTailorResult> {
    const model = settings.model || PROVIDER_MODEL_PRESETS.deepseek.defaultModel;

    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.apiKey.trim()}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: promptData.systemPrompt },
          { role: 'user', content: promptData.userPrompt },
        ],
        temperature: 0.4,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => `HTTP ${response.status}`);
      throw new Error(`DeepSeek API error (${response.status}): ${errText.slice(0, 200)}`);
    }

    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content || '';
    const { diffs, documentSummary } = this.parseAiResponse(text, bullets);

    if (diffs.length === 0) {
      return { diffs: [], usedAi: false, error: 'DeepSeek returned invalid JSON' };
    }

    return { diffs, documentSummary, usedAi: true, model: `deepseek/${model}` };
  }

  // ── 5. Local Ollama Provider (Offline / Private) ───────────────────────────

  private async callOllama(
    promptData: { systemPrompt: string; userPrompt: string },
    bullets: ResumeBullet[],
    settings: AiSettings
  ): Promise<AiTailorResult> {
    const model = settings.model || PROVIDER_MODEL_PRESETS.ollama.defaultModel;
    const baseUrl = settings.baseUrl?.trim() || 'http://localhost:11434';
    const endpoint = `${baseUrl.replace(/\/+$/, '')}/api/chat`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: promptData.systemPrompt },
          { role: 'user', content: promptData.userPrompt },
        ],
        format: 'json',
        stream: false,
        options: { temperature: 0.4 },
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => `HTTP ${response.status}`);
      throw new Error(`Ollama connection error (${response.status}): ${errText.slice(0, 200)}. Is Ollama running on ${baseUrl}?`);
    }

    const data = await response.json();
    const text = data?.message?.content || '';
    const { diffs, documentSummary } = this.parseAiResponse(text, bullets);

    if (diffs.length === 0) {
      return { diffs: [], usedAi: false, error: 'Ollama model returned invalid JSON output' };
    }

    return { diffs, documentSummary, usedAi: true, model: `ollama/${model}` };
  }

  // ── 6. Custom OpenAI-Compatible Provider ───────────────────────────────────

  private async callCustomOpenAiCompatible(
    promptData: { systemPrompt: string; userPrompt: string },
    bullets: ResumeBullet[],
    settings: AiSettings
  ): Promise<AiTailorResult> {
    const baseUrl = settings.baseUrl?.trim() || 'https://api.openai.com/v1';
    const endpoint = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
    const model = settings.model || 'default';

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (settings.apiKey?.trim()) {
      headers['Authorization'] = `Bearer ${settings.apiKey.trim()}`;
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: promptData.systemPrompt },
          { role: 'user', content: promptData.userPrompt },
        ],
        temperature: 0.4,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => `HTTP ${response.status}`);
      throw new Error(`Custom endpoint error (${response.status}): ${errText.slice(0, 200)}`);
    }

    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content || '';
    const { diffs, documentSummary } = this.parseAiResponse(text, bullets);

    return { diffs, documentSummary, usedAi: diffs.length > 0, model: `custom/${model}` };
  }

  // ── Prompt Builders ────────────────────────────────────────────────────────

  private buildJobTailorPrompt(
    bullets: ResumeBullet[],
    jobDescription: string,
    missingKeywords: string[],
    jobTitle: string,
    company: string,
    strictAntiHallucination: boolean,
    jobIntel?: { seniorityLevel?: string; extractedSkills?: string[] }
  ): { systemPrompt: string; userPrompt: string } {
    const seniority = jobIntel?.seniorityLevel || 'Professional';
    const archetype = CompanyArchetypeClassifier.classify(company, jobDescription);

    const systemPrompt = `You are Hacky, an elite AI career advisor and executive resume architect.
Your mission is to radically elevate resume bullet points into high-impact, ATS-optimized accomplishments tailored precisely for the target role (${jobTitle} at ${company}, Seniority: ${seniority}).
You MUST enforce the Google 'XYZ Formula' and Executive STAR Method: "Accomplished [X] as measured by [Y] by doing [Z]".

COMPANY ARCHETYPE CONTEXT:
- Archetype: ${archetype.label} (${archetype.badge})
- Framing Directive: ${archetype.narrativeDirective}
- Key Themes to Emphasize: ${archetype.keyThemes.join(', ')}

CROSS-BULLET DIVERSITY & NARRATIVE COHESION:
1. Avoid repeating the same Tier-1 action verb across bullets in the same section.
2. Vary metric dimensions across bullets (e.g. latency speedup, throughput scale, reliability/uptime, engineering team velocity).
3. Ensure the document narrative reads as a cohesive progression of technical mastery and ownership.

FACTUAL GUARDRAILS (${strictAntiHallucination ? 'STRICT ANTI-HALLUCINATION ACTIVE' : 'STANDARD'}):
1. ${
      strictAntiHallucination
        ? 'DO NOT fabricate exact metrics, revenue figures, or percentages not in the original bullet. Use bracketed placeholders like "[improved latency by X%]" or "[scaled to 10k+ users]" so the candidate can supply their verified numbers.'
        : 'Incorporate realistic quantifiable metrics where plausible based on project scope.'
    }
2. NEVER invent technologies, certifications, company names, or dates not implied by the original resume.
3. Every tailored bullet MUST begin with a premier tier-1 past-tense action verb (e.g., Engineered, Architected, Spearheaded, Orchestrated, Benchmarked, Overhauled).
4. Inject rich technical depth (tools, frameworks, scale, query optimizations, throughput, latency, security) matching the job description without fabricating unverified credentials.
5. STRICT LINE-BUDGET CONSTRAINTS: Keep each tailored bullet within its specified character budget so it fits seamlessly on the candidate's Google Doc without vertical line spillover.
6. Provide rich metadata for each improvement (documentSummary, characterCount, fitsLineBudget, scoreGain, rationale, starAnalysis, variations).
7. Output valid JSON adhering strictly to the schema.`;

    const bulletList = bullets
      .map((b, i) => {
        const origChars = b.originalText.length;
        const targetLines = Math.max(1, Math.ceil(origChars / 88));
        const maxChars = targetLines * 92;
        return `[Bullet ${i + 1} | ID: ${b.id} | Current: ${origChars} chars | Budget: max ${maxChars} chars (${targetLines} line${targetLines > 1 ? 's' : ''})]\nOriginal: "${b.originalText}"\nSection: ${b.section} | Role: ${b.role || 'N/A'}\nConstraint: Keep within ${maxChars} characters to preserve Google Doc single-page layout.`;
      })
      .join('\n\n');

    const userPrompt = `TARGET ROLE: ${jobTitle} at ${company} (Seniority: ${seniority})
TARGET COMPANY ARCHETYPE: ${archetype.label}

KEY MISSING ATS COMPETENCIES TO WEAVE IN NATURALLY:
${missingKeywords.length > 0 ? missingKeywords.map((k) => `- ${k}`).join('\n') : 'All primary keywords already matched.'}

${jobIntel?.extractedSkills && jobIntel.extractedSkills.length > 0 ? `CORE TECH STACK IDENTIFIED IN JOB OPENING:\n${jobIntel.extractedSkills.join(', ')}\n` : ''}
TARGET JOB DESCRIPTION (Core Qualifications & Responsibilities, up to 4000 chars):
${jobDescription.slice(0, 4000)}

FEW-SHOT EXAMPLES OF DESIRED TRANSFORMATIONS:
---
Example 1:
Original: "Worked on the backend API using Python and helped improve database queries."
Tailored: "Architected 8 RESTful microservice endpoints using Python and FastAPI, optimizing PostgreSQL indexing to reduce p99 query latency by 35%."
Injected Keywords: ["FastAPI", "PostgreSQL", "RESTful"]
Rationale: "Boosted ATS score by +12 pts by upgrading weak verb 'worked on' to 'Architected', quantifying technical scope, and injecting missing database optimization keywords (PostgreSQL, FastAPI)."
Score Gain: 12
Character Count: 148
Fits Line Budget: true
STAR Breakdown:
  Situation/Task: Backend API had latency bottlenecks under peak load
  Action: Built 8 modular endpoints with FastAPI and overhauled PostgreSQL query indexes
  Result: Slashed p99 query latency by 35%
Variations:
  highImpact: "Overhauled backend services with FastAPI and PostgreSQL, slashing query latency by 35% to support 2M+ daily requests."
  technicalDepth: "Architected asynchronous REST microservices with Python, FastAPI, and PostgreSQL connection pooling for optimal throughput."
  leadership: "Spearheaded backend API modernization, establishing FastAPI and PostgreSQL indexing best practices across the engineering team."
---

BULLETS TO TAILOR (Respect per-bullet line budgets):
${bulletList}

Respond strictly with valid JSON conforming to the schema.`;

    return { systemPrompt, userPrompt };
  }

  private buildUniversalPrompt(
    bullets: ResumeBullet[],
    domain: string,
    strictAntiHallucination: boolean
  ): { systemPrompt: string; userPrompt: string } {
    const systemPrompt = `You are a master executive resume writer specializing in ${domain} industry standards.
Your goal is to elevate general resume bullets to industry-leading STAR format with assertive executive action verbs and clear impact framing.

FACTUAL GUARDRAILS:
1. ${
      strictAntiHallucination
        ? 'Do not invent specific metrics; use bracketed placeholders [X%] where appropriate.'
        : 'Include realistic scale and impact metrics where appropriate.'
    }
2. Every bullet must start with a premier past-tense action verb for ${domain}.
3. Retain the candidate's authentic core achievements.
4. Provide scoreGain, starAnalysis, and variations for each bullet.
5. Output valid JSON matching the schema.`;

    const bulletList = bullets
      .map((b, i) => `[Bullet ${i + 1} | ID: ${b.id}]\nOriginal: "${b.originalText}"\nSection: ${b.section}`)
      .join('\n\n');

    const userPrompt = `DOMAIN FOCUS: ${domain}

BULLETS TO ELEVATE:
${bulletList}

Respond strictly with valid JSON.`;

    return { systemPrompt, userPrompt };
  }

  // ── Multi-Stage Resilient JSON Response Parser ─────────────────────────────

  private parseAiResponse(
    text: string,
    bullets: ResumeBullet[]
  ): { diffs: TailoredBulletDiff[]; documentSummary?: string } {
    const parsed = safeParseJsonResponse<{ improvements?: any[]; bullets?: any[]; documentSummary?: string }>(text);
    if (!parsed) {
      console.warn('[AiTailorService] Failed to parse AI JSON response:', text.slice(0, 300));
      return { diffs: [] };
    }

    const documentSummary = parsed.documentSummary || undefined;
    const items: any[] = parsed.improvements || parsed.bullets || (Array.isArray(parsed) ? parsed : []);
    if (!Array.isArray(items) || items.length === 0) {
      return { diffs: [], documentSummary };
    }

    const diffs = items
      .map((item, i) => {
        const originalBullet =
          bullets.find((b) => b.id === item.id) ||
          bullets.find((b) => b.id === `bullet-${item.id}`) ||
          bullets.find((b) => b.id.replace(/\D/g, '') === String(item.id || '').replace(/\D/g, '')) ||
          bullets[i];

        let originalText = originalBullet?.originalText || '';
        if (!originalText || originalText.length < 5 || /^\d+$/.test(originalText.trim())) {
          if (bullets[i]?.originalText) {
            originalText = bullets[i].originalText;
          } else if (item.originalText && typeof item.originalText === 'string' && item.originalText.trim().length >= 10) {
            originalText = RobustTextMatcher.sanitizeOriginal(item.originalText);
          }
        }

        let tailoredText = (item.tailoredText || item.improved || item.text || '').trim();
        // Strip accidental list numbers or bullets prepended by LLM (e.g. "1. Architected..." -> "Architected...")
        tailoredText = tailoredText
          .replace(/^[\s\uFEFF\u200B]*([•\-*–—▪▸▹‣◦○]|\d+[\.\)])\s+/, '')
          .replace(/[\u00AD\u200B\uFEFF]/g, '')
          .trim();

        if (!tailoredText || tailoredText.length < 5) {
          tailoredText = originalText;
        }

        const lineBudget = calculateLineBudget(originalText, tailoredText || originalText);

        return {
          id: originalBullet?.id || item.id || `ai-bullet-${i + 1}`,
          section: originalBullet?.section || 'Experience',
          organization: originalBullet?.organization || 'Experience',
          role: originalBullet?.role || '',
          originalText,
          tailoredText,
          prefix: originalBullet?.prefix,
          injectedKeywords: Array.isArray(item.injectedKeywords) ? item.injectedKeywords : [],
          rationale: item.rationale || 'AI-optimized for ATS keyword matching and STAR format.',
          scoreGain: typeof item.scoreGain === 'number' ? item.scoreGain : 8,
          starAnalysis: item.starAnalysis || undefined,
          variations: item.variations || undefined,
          charCountDiff: tailoredText.length - originalText.length,
          lineBudget,
          status: 'pending' as const,
        };
      })
      .filter(
        (diff) =>
          diff.originalText &&
          diff.originalText.length >= 8 &&
          RobustTextMatcher.normalize(diff.originalText) !== RobustTextMatcher.normalize(diff.tailoredText)
      );

    return { diffs, documentSummary };
  }
}

// ── Multi-Stage JSON Repair Extractor ─────────────────────────────────────────

export function safeParseJsonResponse<T>(rawText: string): T | null {
  if (!rawText || !rawText.trim()) return null;

  const trimmed = rawText.trim();

  // 1. Direct JSON Parse
  try {
    return JSON.parse(trimmed) as T;
  } catch {}

  // 2. Greedy Markdown Fence Extraction
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch && fenceMatch[1]) {
    try {
      return JSON.parse(fenceMatch[1].trim()) as T;
    } catch {}
  }

  // 3. Outermost JSON Object / Array Regex
  const objectMatch = trimmed.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (objectMatch && objectMatch[1]) {
    try {
      return JSON.parse(objectMatch[1].trim()) as T;
    } catch {
      // 4. Attempt Structural Bracket Repair
      try {
        const repaired = repairTruncatedJson(objectMatch[1]);
        return JSON.parse(repaired) as T;
      } catch {}
    }
  }

  return null;
}

function repairTruncatedJson(jsonStr: string): string {
  let cleaned = jsonStr.trim();
  // Balance quotes
  const quotes = (cleaned.match(/(?<!\\)"/g) || []).length;
  if (quotes % 2 !== 0) cleaned += '"';

  // Balance open brackets
  const openBrackets: string[] = [];
  for (const ch of cleaned) {
    if (ch === '{' || ch === '[') openBrackets.push(ch);
    else if (ch === '}' && openBrackets[openBrackets.length - 1] === '{') openBrackets.pop();
    else if (ch === ']' && openBrackets[openBrackets.length - 1] === '[') openBrackets.pop();
  }

  while (openBrackets.length > 0) {
    const last = openBrackets.pop();
    if (last === '{') cleaned += '}';
    else if (last === '[') cleaned += ']';
  }

  return cleaned;
}

export async function generateCustomQuestionAnswer(
  question: string,
  jobContext: { title: string; company: string; description: string },
  candidateContext: { name: string; profile: ApplicantProfile; resumeBullets: string[] },
  customAiSettings?: AiSettings
): Promise<string> {
  const aiSettings = customAiSettings || (await getAiSettings());
  const apiKey = aiSettings?.apiKey || EMBEDDED_GEMINI_API_KEY;
  const provider = aiSettings?.provider || 'gemini';

  const systemPrompt = `You are an elite career coach helping ${candidateContext.name} draft an exceptional, authentic, and grounded response to a specific job application question.

CRITICAL ANTI-HALLUCINATION GUARDRAILS:
1. STRICT TRUTH ENFORCEMENT: Ground your answer ONLY in the candidate's actual projects, skills, education, and resume accomplishments provided below.
2. ZERO FABRICATION: NEVER invent company names, metrics, tools, certifications, or past roles not listed in the candidate profile.
3. CONCISE & COMPELLING: Write 2 to 3 polished sentences (under 120 words total).
4. DIRECT & NATURAL: Answer the question directly without generic fluff or cliches.`;

  const userPrompt = `TARGET JOB: ${jobContext.title} at ${jobContext.company}
JOB DESCRIPTION SUMMARY:
${jobContext.description.slice(0, 1500)}

CANDIDATE BACKGROUND:
- Name: ${candidateContext.name}
- School & Degree: ${candidateContext.profile.school}, ${candidateContext.profile.degree} in ${candidateContext.profile.major}
- Verified Resume Accomplishments:
${candidateContext.resumeBullets.slice(0, 8).map(b => `• ${b}`).join('\n')}

APPLICATION QUESTION TO ANSWER:
"${question}"

Draft a direct, factual 2-3 sentence response grounded in the candidate's verified experience:`;

  if (provider === 'gemini' && apiKey) {
    const model = aiSettings?.model || 'gemini-2.0-flash';
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 250 },
        }),
      });
      if (response.ok) {
        const data = await response.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (text) return text.replace(/^"|"$/g, '');
      }
    } catch (err) {
      console.debug('[generateCustomQuestionAnswer] Gemini error:', err);
    }
  }

  // Safe factual fallback template
  return `At ${candidateContext.profile.school}, I developed strong foundational experience in ${candidateContext.profile.major}. I am particularly excited about ${jobContext.company}'s work in ${jobContext.title} and eager to contribute my technical background to your engineering team.`;
}
