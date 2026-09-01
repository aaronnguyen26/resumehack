import { describe, it, expect } from 'vitest';
import { LayoutAnalyzerService } from '../services/layout-analyzer.js';
import {
  extractStructuralParagraphs,
  extractDocumentLayoutInfo,
  buildStructuralBatchUpdateRequests,
  resolveDiffReplacementRanges,
} from '../services/google-docs.js';
import { AtsScorerService } from '../services/ats-scorer.js';
import { TailoredBulletDiff } from '../types/index.js';

describe('LayoutAwareness & LayoutAnalyzerService', () => {
  const analyzer = new LayoutAnalyzerService();
  const atsScorer = new AtsScorerService();

  const mockGoogleDocWithLayoutIssues = {
    documentId: 'doc-with-layout-problems',
    title: 'Alex Chen Resume',
    body: {
      content: [
        {
          startIndex: 1,
          endIndex: 20,
          paragraph: {
            paragraphStyle: { namedStyleType: 'HEADING_1', spaceAfter: { magnitude: 6, unit: 'PT' } },
            elements: [
              {
                startIndex: 1,
                endIndex: 20,
                textRun: {
                  content: 'Alex Chen\n',
                  textStyle: {
                    weightedFontFamily: { fontFamily: 'Calibri' },
                    fontSize: { magnitude: 18, unit: 'PT' },
                    bold: true,
                  },
                },
              },
            ],
          },
        },
        // Table element (ATS multi-column / parsing risk)
        {
          startIndex: 21,
          endIndex: 120,
          table: {
            rows: 2,
            columns: 2,
            tableRows: [
              {
                tableCells: [
                  {
                    content: [
                      {
                        startIndex: 25,
                        endIndex: 60,
                        paragraph: {
                          elements: [{ textRun: { content: 'Left Column: Education\n' } }],
                        },
                      },
                    ],
                  },
                  {
                    content: [
                      {
                        startIndex: 65,
                        endIndex: 115,
                        paragraph: {
                          elements: [{ textRun: { content: 'Right Column: Skills\n' } }],
                        },
                      },
                    ],
                  },
                ],
              },
            ],
          },
        },
        // Section break with 2 columns
        {
          startIndex: 121,
          endIndex: 122,
          sectionBreak: {
            sectionStyle: {
              columnProperties: [{ width: { magnitude: 250, unit: 'PT' } }, { width: { magnitude: 250, unit: 'PT' } }],
            },
          },
        },
        // Paragraph 1: Bullet with manual spaces for date alignment
        {
          startIndex: 123,
          endIndex: 210,
          paragraph: {
            paragraphStyle: {
              namedStyleType: 'NORMAL_TEXT',
              spaceBefore: { magnitude: 2, unit: 'PT' },
              spaceAfter: { magnitude: 2, unit: 'PT' },
              bullet: { listId: 'kix.list1' },
            },
            elements: [
              {
                startIndex: 123,
                endIndex: 210,
                textRun: {
                  content: '• Software Engineer Intern                May 2025 - Aug 2025\n',
                  textStyle: {
                    weightedFontFamily: { fontFamily: 'Calibri' },
                    fontSize: { magnitude: 11, unit: 'PT' },
                  },
                },
              },
            ],
          },
        },
        // Paragraph 2: Bullet with font drift (Comic Sans, 14pt)
        {
          startIndex: 211,
          endIndex: 300,
          paragraph: {
            paragraphStyle: {
              namedStyleType: 'NORMAL_TEXT',
              spaceBefore: { magnitude: 12, unit: 'PT' }, // Spacing drift
              spaceAfter: { magnitude: 12, unit: 'PT' },
              bullet: { listId: 'kix.list1' },
            },
            elements: [
              {
                startIndex: 211,
                endIndex: 300,
                textRun: {
                  content: '• Built backend microservices in Python and Postgres processing 10,000 requests.\n',
                  textStyle: {
                    weightedFontFamily: { fontFamily: 'Comic Sans MS' },
                    fontSize: { magnitude: 14, unit: 'PT' },
                  },
                },
              },
            ],
          },
        },
        // Paragraph 3: Bullet with mixed glyph ('-' instead of '•')
        {
          startIndex: 301,
          endIndex: 380,
          paragraph: {
            paragraphStyle: {
              namedStyleType: 'NORMAL_TEXT',
              spaceBefore: { magnitude: 2, unit: 'PT' },
              spaceAfter: { magnitude: 2, unit: 'PT' },
            },
            elements: [
              {
                startIndex: 301,
                endIndex: 380,
                textRun: {
                  content: '- Architected caching layer with Redis reducing latency by 45%.\n',
                  textStyle: {
                    weightedFontFamily: { fontFamily: 'Calibri' },
                    fontSize: { magnitude: 11, unit: 'PT' },
                  },
                },
              },
            ],
          },
        },
      ],
    },
  };

  it('correctly extracts structural layout info and paragraph formatting', () => {
    const layoutInfo = extractDocumentLayoutInfo(mockGoogleDocWithLayoutIssues);
    const paragraphs = extractStructuralParagraphs(mockGoogleDocWithLayoutIssues);

    expect(layoutInfo.tables.length).toBe(1);
    expect(layoutInfo.tables[0].rows).toBe(2);
    expect(layoutInfo.tables[0].columns).toBe(2);
    expect(layoutInfo.sectionStyle?.columnCount).toBe(2);

    expect(paragraphs.length).toBeGreaterThanOrEqual(4);
    const comicSansPara = paragraphs.find((p) => p.rawText.includes('Built backend'));
    expect(comicSansPara?.runs[0]?.fontFamily).toBe('Comic Sans MS');
    expect(comicSansPara?.runs[0]?.fontSize).toBe(14);
  });

  it('detects table risks, multi-column risks, manual spacing, font drift, and mixed bullets', () => {
    const layoutInfo = extractDocumentLayoutInfo(mockGoogleDocWithLayoutIssues);
    const paragraphs = extractStructuralParagraphs(mockGoogleDocWithLayoutIssues);

    const report = analyzer.analyze(layoutInfo, paragraphs);

    expect(report.isSingleColumnStandard).toBe(false);
    expect(report.overallScore).toBeLessThan(80); // Penalized for table + 2-column + font drift

    const categories = report.issues.map((i) => i.category);
    expect(categories).toContain('table_risk');
    expect(categories).toContain('multicolumn_risk');
    expect(categories).toContain('manual_tab_alignment');
    expect(categories).toContain('font_inconsistency');
    expect(categories).toContain('bullet_inconsistency');

    // Check suggested fixes
    const manualSpaceIssue = report.issues.find((i) => i.category === 'manual_tab_alignment');
    expect(manualSpaceIssue?.suggestedFix?.batchUpdateRequests?.length).toBeGreaterThan(0);

    const fontIssue = report.issues.find((i) => i.category === 'font_inconsistency');
    expect(fontIssue?.suggestedFix?.batchUpdateRequests?.length).toBeGreaterThan(0);
  });

  it('generates layout batchUpdate requests in strict descending index order along with content diffs', () => {
    const layoutInfo = extractDocumentLayoutInfo(mockGoogleDocWithLayoutIssues);
    const paragraphs = extractStructuralParagraphs(mockGoogleDocWithLayoutIssues);
    const layoutReport = analyzer.analyze(layoutInfo, paragraphs);

    const diffs: TailoredBulletDiff[] = [
      {
        id: 'd-1',
        originalText: 'Built backend microservices in Python and Postgres processing 10,000 requests.',
        tailoredText: '• Architected resilient distributed microservices in Python & Postgres processing 50,000 req/sec.',
        prefix: '• Built backend microservices in Python and Postgres processing 10,000 requests.',
        status: 'accepted',
      },
    ];

    const { resolved, unresolved } = resolveDiffReplacementRanges(diffs, paragraphs);
    expect(resolved.length).toBe(1);

    const { requests } = buildStructuralBatchUpdateRequests(resolved, unresolved, layoutReport.issues);
    expect(requests.length).toBeGreaterThanOrEqual(2);

    // Verify all delete/insert ranges are valid Google Docs batchUpdate payloads
    for (const req of requests) {
      if (req.deleteContentRange) {
        expect(req.deleteContentRange.range.startIndex).toBeLessThan(req.deleteContentRange.range.endIndex);
      }
      if (req.updateTextStyle) {
        expect(req.updateTextStyle.fields).toBeDefined();
        expect(req.updateTextStyle.range.startIndex).toBeLessThan(req.updateTextStyle.range.endIndex);
      }
    }
  });

  it('dynamically adjusts ATS scoring based on real document layout issues', () => {
    const resumeText = mockGoogleDocWithLayoutIssues.body.content
      .map((c: any) => c.paragraph?.elements?.map((e: any) => e.textRun?.content).join('') || '')
      .join('\n');

    const jobDescription = 'Software Engineering Intern with Python, Postgres, and microservices experience.';

    const layoutInfo = extractDocumentLayoutInfo(mockGoogleDocWithLayoutIssues);
    const paragraphs = extractStructuralParagraphs(mockGoogleDocWithLayoutIssues);

    const reportWithLayout = atsScorer.analyze(resumeText, jobDescription, layoutInfo, paragraphs);

    expect(reportWithLayout.layoutReport).toBeDefined();
    expect(reportWithLayout.breakdown.formattingScore).toBe(reportWithLayout.layoutReport?.overallScore);
    expect(reportWithLayout.breakdown.formattingScore).toBeLessThan(80);
    expect(reportWithLayout.improvementSuggestions.some((s) => s.includes('Layout Notice'))).toBe(true);
  });
});
