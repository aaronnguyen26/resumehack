import {
  DocumentLayoutInfo,
  StructuralParagraph,
  VisualLayoutReport,
  VisualLayoutIssue,
  PageVisualSnapshot,
  AiSettings,
} from '../types/index.js';
import { PdfRasterizerService } from './pdf-rasterizer.js';
import { GoogleDriveService } from './google-drive.js';

export const VISUAL_LAYOUT_SCHEMA = {
  type: 'object',
  properties: {
    visualPolishScore: {
      type: 'number',
      description: 'Overall visual aesthetic and layout score from 0 to 100.',
    },
    pageFillAssessment: {
      type: 'string',
      enum: ['optimal_single_page', 'underfilled', 'awkward_overflow', 'multi_page_balanced'],
      description: 'Whether the resume cleanly fills one page, overflows awkwardly onto a near-empty second page, or is underfilled.',
    },
    pageFillDescription: {
      type: 'string',
      description: 'Detailed human-like visual critique of how well the content fills the page(s).',
    },
    issues: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          category: {
            type: 'string',
            enum: ['visual_crowding', 'page_overflow', 'whitespace_rhythm', 'section_imbalance', 'visual_polish'],
          },
          severity: {
            type: 'string',
            enum: ['critical', 'warning', 'info'],
          },
          sectionName: {
            type: 'string',
            description: 'The section header or area (e.g. EXPERIENCE, EDUCATION, SKILLS, PROJECTS, HEADER, GLOBAL).',
          },
          title: { type: 'string', description: 'Concise title of the visual finding.' },
          description: { type: 'string', description: 'Clear explanation of why this visual defect impairs readability or ATS appeal.' },
          visualObservation: { type: 'string', description: 'Exact visual evidence noticed in the rendered snapshot.' },
          impact: { type: 'string', description: 'How this affects human recruiter scanning and overall visual hierarchy.' },
        },
        required: ['category', 'severity', 'sectionName', 'title', 'description', 'visualObservation', 'impact'],
      },
    },
    overallSummary: {
      type: 'string',
      description: 'Executive summary of visual layout strengths and actionable visual polish recommendations.',
    },
  },
  required: ['visualPolishScore', 'pageFillAssessment', 'pageFillDescription', 'issues', 'overallSummary'],
};

export class VisualLayoutAnalyzerService {
  private pdfRasterizer = new PdfRasterizerService();
  private googleDrive = new GoogleDriveService();

  /**
   * Analyzes the rendered visual snapshot of a Google Doc alongside its structural AST.
   */
  public async analyzeVisualSnapshot(params: {
    documentId?: string;
    pdfBuffer?: Buffer | Uint8Array;
    accessToken?: string;
    structuralParagraphs?: StructuralParagraph[];
    layoutInfo?: DocumentLayoutInfo;
    jobDescription?: string;
    domain?: string;
    settings?: AiSettings;
  }): Promise<VisualLayoutReport> {
    const {
      documentId,
      pdfBuffer: inputPdfBuffer,
      accessToken,
      structuralParagraphs = [],
      layoutInfo,
      jobDescription,
      domain = 'Software Engineering',
      settings,
    } = params;

    let snapshots: PageVisualSnapshot[] = [];
    let pageCount = 1;

    // ── Step 1: Capture Rendered PDF & Rasterize to PNG ───────────────────────
    try {
      let pdfBuffer = inputPdfBuffer;

      if (!pdfBuffer && documentId && accessToken && !documentId.includes('mock') && !documentId.includes('test')) {
        pdfBuffer = await this.googleDrive.exportDocumentAsPdf(documentId, accessToken);
      }

      if (pdfBuffer) {
        const rasterResult = await this.pdfRasterizer.rasterize(pdfBuffer);
        snapshots = rasterResult.snapshots;
        pageCount = rasterResult.pageCount;
      } else {
        const mockResult = this.pdfRasterizer.createMockSnapshot(1);
        snapshots = mockResult.snapshots;
        pageCount = mockResult.pageCount;
      }
    } catch (err: any) {
      console.warn('[VisualLayoutAnalyzerService] Rasterization fallback:', err?.message);
      const fallback = this.pdfRasterizer.createMockSnapshot(1);
      snapshots = fallback.snapshots;
      pageCount = fallback.pageCount;
    }

    // ── Step 2: Send Rendered Image(s) + Structural Extraction to Vision Model ─
    let visionResult: any = null;

    if (settings?.apiKey || process.env.GEMINI_API_KEY) {
      try {
        visionResult = await this.callVisionModel({
          snapshots,
          structuralParagraphs,
          layoutInfo,
          jobDescription,
          domain,
          settings,
        });
      } catch (aiErr: any) {
        console.warn('[VisualLayoutAnalyzerService] AI Vision call note:', aiErr?.message);
      }
    }

    // If AI vision unavailable or offline, use heuristic visual snapshot analyzer
    if (!visionResult) {
      visionResult = this.heuristicVisualAnalysis(snapshots, structuralParagraphs, layoutInfo);
    }

    // ── Step 3: Reconcile Vision Findings Against Structural Paragraph Map ───
    const reconciledIssues = this.reconcileAgainstStructuralAst(
      visionResult.issues || [],
      structuralParagraphs,
      pageCount
    );

    return {
      visualPolishScore: visionResult.visualPolishScore || 85,
      pageCount,
      pageFillAssessment: visionResult.pageFillAssessment || (pageCount === 1 ? 'optimal_single_page' : 'awkward_overflow'),
      pageFillDescription: visionResult.pageFillDescription || (pageCount === 1 ? 'Clean single-page visual density with optimal margins.' : 'Spills onto page 2 with awkward orphan content.'),
      issues: reconciledIssues,
      snapshots,
      overallSummary: visionResult.overallSummary || 'Clean document presentation. Section spacing and visual hierarchy are well-proportioned.',
    };
  }

  /**
   * Dispatches multimodal vision request to Gemini or OpenAI.
   */
  private async callVisionModel(params: {
    snapshots: PageVisualSnapshot[];
    structuralParagraphs: StructuralParagraph[];
    layoutInfo?: DocumentLayoutInfo;
    jobDescription?: string;
    domain: string;
    settings?: AiSettings;
  }): Promise<any> {
    const { snapshots, structuralParagraphs, layoutInfo, jobDescription, domain, settings } = params;
    const apiKey = settings?.apiKey?.trim() || process.env.GEMINI_API_KEY || '';
    const provider = settings?.provider || 'gemini';

    const systemPrompt = `You are Hacky Vision, an expert executive resume typography and visual layout auditor.
Your job is to critically evaluate the RENDERED VISUAL SNAPSHOT of a candidate's resume against gold-standard industry aesthetic guidelines.

CRITICAL INSTRUCTIONS:
1. FOCUS EXCLUSIVELY ON VISUAL & TYPOGRAPHIC QUALITY:
   - Visual balance between sections (Are sections proportioned well, or does one look suffocated or bloated?)
   - Whitespace crowding or excess (Are section headers cramped without top breathing room? Are there dead whitespace chasms?)
   - Page fill & overflow: Does the resume cleanly fill 1 page (90-100% page coverage) or does it spill 2-4 orphan lines onto an awkward near-empty second page?
   - Inconsistent visual rhythm: Inconsistent margins, indentation drift, mismatched bullet spacing or entry gaps.
   - Overall visual polish: Clean professional aesthetic rating from 0 to 100.
2. DO NOT CRITIQUE WORDING OR TEXT CONTENT: The content and keyword matching is handled separately. Only judge visual presentation.
3. REFERENCE SECTIONS BY NAME: When flagging an issue, specify the exact section header (e.g. EXPERIENCE, EDUCATION, SKILLS, PROJECTS, HEADER, GLOBAL).
4. Output strictly valid JSON matching the provided schema.`;

    const paragraphSummary = structuralParagraphs
      .filter((p) => p.trimmedText.length > 0)
      .slice(0, 30)
      .map((p, idx) => `[P${idx + 1} | Range: ${p.startIndex}..${p.endIndex} | Style: ${p.paragraphStyle?.namedStyleType || 'NORMAL'}] ${p.trimmedText.slice(0, 80)}`)
      .join('\n');

    const userPromptText = `TARGET ROLE / DOMAIN: ${domain}
${jobDescription ? `TARGET JOB OPENING (Reference context only):\n${jobDescription.slice(0, 1000)}\n` : ''}
DOCUMENT METADATA:
- Total Rendered Pages: ${snapshots.length}
- Total Paragraph Elements: ${structuralParagraphs.length}
- Table Count: ${layoutInfo?.tableCount || 0}
- Section Column Count: ${layoutInfo?.sectionStyle?.columnCount || 1}

PARAGRAPH EXTRACTION OVERVIEW:
${paragraphSummary}

Analyze the attached visual snapshot image(s) for visual balance, whitespace crowding, page fill, and typography rhythm. Return your findings in the structured JSON schema.`;

    if (provider === 'openai' && apiKey) {
      return await this.callOpenAiVision(snapshots, systemPrompt, userPromptText, apiKey);
    }

    // Default to Google Gemini Multimodal
    return await this.callGeminiVision(snapshots, systemPrompt, userPromptText, apiKey);
  }

  /**
   * Gemini Multimodal Vision API Call.
   */
  private async callGeminiVision(
    snapshots: PageVisualSnapshot[],
    systemPrompt: string,
    userPromptText: string,
    apiKey: string
  ): Promise<any> {
    const candidateModels = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-2.5-flash', 'gemini-1.5-pro'];

    for (const model of candidateModels) {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

      const imageParts = snapshots.map((s) => {
        const rawBase64 = s.dataUrl.replace(/^data:image\/\w+;base64,/, '');
        return {
          inlineData: {
            mimeType: 'image/png',
            data: rawBase64,
          },
        };
      });

      const requestBody: any = {
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
        contents: [
          {
            role: 'user',
            parts: [
              ...imageParts,
              { text: userPromptText },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 2048,
          responseMimeType: 'application/json',
          responseSchema: VISUAL_LAYOUT_SCHEMA,
        },
      };

      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify(requestBody),
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => '');
          console.warn(`[VisualLayoutAnalyzerService] Gemini ${model} HTTP ${res.status}:`, errText.slice(0, 150));
          continue;
        }

        const data = await res.json();
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawText) {
          return JSON.parse(rawText);
        }
      } catch (err: any) {
        console.warn(`[VisualLayoutAnalyzerService] Gemini request note for ${model}:`, err?.message);
        continue;
      }
    }

    return null;
  }

  /**
   * OpenAI Multimodal Vision API Call.
   */
  private async callOpenAiVision(
    snapshots: PageVisualSnapshot[],
    systemPrompt: string,
    userPromptText: string,
    apiKey: string
  ): Promise<any> {
    const contentParts: any[] = [{ type: 'text', text: userPromptText }];

    for (const snap of snapshots) {
      contentParts.push({
        type: 'image_url',
        image_url: {
          url: snap.dataUrl,
          detail: 'high',
        },
      });
    }

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: contentParts },
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' },
      }),
    });

    if (!res.ok) {
      throw new Error(`OpenAI Vision HTTP ${res.status}`);
    }

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content || '';
    return JSON.parse(text);
  }

  /**
   * Reconciles high-level visual observations with the structural paragraph map and builds batchUpdate fixes.
   */
  public reconcileAgainstStructuralAst(
    rawIssues: any[],
    paragraphs: StructuralParagraph[],
    pageCount: number
  ): VisualLayoutIssue[] {
    const reconciled: VisualLayoutIssue[] = [];

    // Helper: Find matching paragraph range by section name or keyword
    const findSectionHeading = (sectionName: string): StructuralParagraph | undefined => {
      const cleanSection = (sectionName || '').toUpperCase().trim();
      return paragraphs.find((p) => {
        const t = p.trimmedText.toUpperCase();
        return t === cleanSection || t.startsWith(cleanSection) || (p.paragraphStyle?.namedStyleType?.startsWith('HEADING') && t.includes(cleanSection));
      });
    };

    // Helper: Find body bullet paragraphs
    const bodyBullets = paragraphs.filter((p) => p.hasNativeBullet || p.hasVisualBullet);

    for (let idx = 0; idx < rawIssues.length; idx++) {
      const issue = rawIssues[idx];
      const matchedHeading = findSectionHeading(issue.sectionName);

      let matchedStartIndex = matchedHeading?.startIndex;
      let matchedEndIndex = matchedHeading?.endIndex;

      let suggestedFix: { actionLabel: string; batchUpdateRequests: any[] } | undefined = undefined;

      // ── Generate Structural BatchUpdate Fixes for Visual Issues ──────────────

      if (issue.category === 'page_overflow' || (pageCount > 1 && issue.description.includes('overflow'))) {
        // Fix for Page Overflow: Reduce paragraph spaceAfter/spaceBefore and slightly reduce bullet body font size
        const fixRequests: any[] = [];

        // 1. Reduce spaceAfter on all paragraphs that have excessive padding
        for (const p of paragraphs) {
          if (p.paragraphStyle && (p.paragraphStyle.spaceAfter || 0) > 4) {
            fixRequests.push({
              updateParagraphStyle: {
                range: { startIndex: p.startIndex, endIndex: p.endIndex },
                paragraphStyle: {
                  spaceAfter: { magnitude: 2, unit: 'PT' },
                  spaceBefore: { magnitude: 0, unit: 'PT' },
                },
                fields: 'spaceAfter,spaceBefore',
              },
            });
          }
        }

        // 2. Reduce bullet font sizes from 11/12pt down to 10pt
        for (const bp of bodyBullets) {
          if (bp.runs) {
            for (const r of bp.runs) {
              if (r.fontSize && r.fontSize > 10.2) {
                fixRequests.push({
                  updateTextStyle: {
                    range: { startIndex: r.startIndex, endIndex: r.endIndex },
                    textStyle: { fontSize: { magnitude: 10, unit: 'PT' } },
                    fields: 'fontSize',
                  },
                });
              }
            }
          }
        }

        if (fixRequests.length > 0) {
          suggestedFix = {
            actionLabel: 'Fit Resume to Exactly 1 Page',
            batchUpdateRequests: fixRequests,
          };
        }
      } else if (issue.category === 'visual_crowding' && matchedHeading) {
        // Fix for Crowded Section Heading: Add top breathing room (spaceBefore: 8pt)
        suggestedFix = {
          actionLabel: `Add Breathing Room to ${matchedHeading.trimmedText}`,
          batchUpdateRequests: [
            {
              updateParagraphStyle: {
                range: { startIndex: matchedHeading.startIndex, endIndex: matchedHeading.endIndex },
                paragraphStyle: {
                  spaceBefore: { magnitude: 8, unit: 'PT' },
                  spaceAfter: { magnitude: 3, unit: 'PT' },
                },
                fields: 'spaceBefore,spaceAfter',
              },
            },
          ],
        };
      } else if (issue.category === 'whitespace_rhythm') {
        // Fix for Whitespace Rhythm: Standardize bullet padding
        const rhythmRequests: any[] = [];
        for (const bp of bodyBullets.slice(0, 10)) {
          rhythmRequests.push({
            updateParagraphStyle: {
              range: { startIndex: bp.startIndex, endIndex: bp.endIndex },
              paragraphStyle: {
                spaceAfter: { magnitude: 2.5, unit: 'PT' },
                spaceBefore: { magnitude: 1, unit: 'PT' },
              },
              fields: 'spaceAfter,spaceBefore',
            },
          });
        }
        if (rhythmRequests.length > 0) {
          suggestedFix = {
            actionLabel: 'Harmonize Vertical Rhythm',
            batchUpdateRequests: rhythmRequests,
          };
        }
      }

      reconciled.push({
        id: `visual-${issue.category}-${idx + 1}`,
        category: issue.category,
        severity: issue.severity || 'warning',
        sectionName: issue.sectionName || 'GLOBAL',
        title: issue.title,
        description: issue.description,
        visualObservation: issue.visualObservation,
        impact: issue.impact,
        matchedParagraphStartIndex: matchedStartIndex,
        matchedParagraphEndIndex: matchedEndIndex,
        suggestedFix,
        status: 'pending',
      });
    }

    return reconciled;
  }

  /**
   * Deterministic heuristic visual analyzer when running offline / without LLM API key.
   */
  private heuristicVisualAnalysis(
    snapshots: PageVisualSnapshot[],
    paragraphs: StructuralParagraph[],
    layoutInfo?: DocumentLayoutInfo
  ): any {
    const issues: any[] = [];
    const pageCount = snapshots.length;

    let score = 90;

    // 1. Page Fill & Overflow Heuristic
    let pageFillAssessment = 'optimal_single_page';
    let pageFillDescription = 'Clean 1-page visual distribution filling the page evenly.';

    if (pageCount === 2) {
      pageFillAssessment = 'awkward_overflow';
      pageFillDescription = 'Content spills onto a 2nd page with low page coverage. Single-page resumes are strongly preferred for early-to-mid career candidates.';
      score -= 15;
      issues.push({
        category: 'page_overflow',
        severity: 'critical',
        sectionName: 'GLOBAL',
        title: 'Awkward Multi-Page Spillover (2 Pages)',
        description: 'Document spills onto page 2 with few lines. Reducing bullet font sizes (to 10pt) and paragraph padding will bring it onto 1 tight page.',
        visualObservation: 'Second page contains orphan lines leaving significant empty space below.',
        impact: 'Recruiters and automated PDF parsers expect compact 1-page density for internship and mid-level roles.',
      });
    }

    // 2. Section Heading Crowding Heuristic
    const headings = paragraphs.filter(
      (p) => p.paragraphStyle?.namedStyleType?.startsWith('HEADING') || /^[A-Z\s]{4,}$/.test(p.trimmedText)
    );

    for (const h of headings) {
      if (h.paragraphStyle && (h.paragraphStyle.spaceBefore || 0) < 3 && h.startIndex > 50) {
        issues.push({
          category: 'visual_crowding',
          severity: 'warning',
          sectionName: h.trimmedText,
          title: `Cramped Section Header ("${h.trimmedText}")`,
          description: `The section header "${h.trimmedText}" is visually suffocated by the preceding content without sufficient top breathing room.`,
          visualObservation: 'Less than 4pt vertical padding between previous item and heading.',
          impact: 'Reduces visual scanning speed when recruiters glance across major sections.',
        });
        score -= 5;
        break;
      }
    }

    // 3. Visual Whitespace Rhythm Heuristic
    const bulletParas = paragraphs.filter((p) => p.hasNativeBullet || p.hasVisualBullet);
    if (bulletParas.length > 5) {
      const spaceVals = bulletParas.map((bp) => bp.paragraphStyle?.spaceAfter ?? 0);
      const uniqueSpaces = new Set(spaceVals);
      if (uniqueSpaces.size > 2) {
        issues.push({
          category: 'whitespace_rhythm',
          severity: 'info',
          sectionName: 'EXPERIENCE',
          title: 'Irregular Vertical Spacing Between Bullets',
          description: 'Bullet entries have fluctuating vertical gaps, disrupting the visual rhythm.',
          visualObservation: 'Gaps between items range inconsistently across experience entries.',
          impact: 'Subtly detracts from the professional visual polish of the document.',
        });
        score -= 4;
      }
    }

    const visualPolishScore = Math.min(100, Math.max(30, score));

    return {
      visualPolishScore,
      pageFillAssessment,
      pageFillDescription,
      issues,
      overallSummary: `Visual snapshot evaluation completed across ${pageCount} rendered page(s). Visual polish score: ${visualPolishScore}%.`,
    };
  }
}
