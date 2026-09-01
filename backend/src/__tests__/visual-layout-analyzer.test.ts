import { describe, it, expect } from 'vitest';
import { PdfRasterizerService } from '../services/pdf-rasterizer.js';
import { VisualLayoutAnalyzerService } from '../services/visual-layout-analyzer.js';
import { LayoutAnalyzerService } from '../services/layout-analyzer.js';
import {
  extractStructuralParagraphs,
  extractDocumentLayoutInfo,
} from '../services/google-docs.js';

describe('VisualLayoutAnalyzer & PDF Snapshot Layer', () => {
  const pdfRasterizer = new PdfRasterizerService();
  const visualAnalyzer = new VisualLayoutAnalyzerService();
  const layoutAnalyzer = new LayoutAnalyzerService();

  const mockTwoPageGoogleDoc = {
    documentId: 'two-page-doc-overflow',
    title: 'Alex Chen Resume',
    body: {
      content: [
        {
          startIndex: 1,
          endIndex: 25,
          paragraph: {
            paragraphStyle: { namedStyleType: 'HEADING_1', spaceBefore: { magnitude: 0, unit: 'PT' } },
            elements: [
              {
                startIndex: 1,
                endIndex: 25,
                textRun: {
                  content: 'Alex Chen\n',
                  textStyle: { fontSize: { magnitude: 18, unit: 'PT' }, bold: true },
                },
              },
            ],
          },
        },
        {
          startIndex: 26,
          endIndex: 60,
          paragraph: {
            paragraphStyle: { namedStyleType: 'NORMAL_TEXT', spaceAfter: { magnitude: 12, unit: 'PT' } },
            elements: [
              {
                startIndex: 26,
                endIndex: 60,
                textRun: { content: 'alex.chen@example.com | San Francisco, CA\n' },
              },
            ],
          },
        },
        // Cramped section heading (no spaceBefore)
        {
          startIndex: 61,
          endIndex: 85,
          paragraph: {
            paragraphStyle: { namedStyleType: 'HEADING_2', spaceBefore: { magnitude: 0, unit: 'PT' }, spaceAfter: { magnitude: 2, unit: 'PT' } },
            elements: [
              {
                startIndex: 61,
                endIndex: 85,
                textRun: { content: 'EXPERIENCE\n', textStyle: { bold: true } },
              },
            ],
          },
        },
        // Bullets with large font and excessive spaceAfter
        {
          startIndex: 86,
          endIndex: 180,
          paragraph: {
            paragraphStyle: { namedStyleType: 'NORMAL_TEXT', spaceBefore: { magnitude: 4, unit: 'PT' }, spaceAfter: { magnitude: 14, unit: 'PT' }, bullet: { listId: 'kix.l1' } },
            elements: [
              {
                startIndex: 86,
                endIndex: 180,
                textRun: {
                  content: '• Architected distributed caching layer with Redis & Dragonfly, reducing P99 latency by 45%.\n',
                  textStyle: { fontSize: { magnitude: 11.5, unit: 'PT' } },
                },
              },
            ],
          },
        },
        {
          startIndex: 181,
          endIndex: 280,
          paragraph: {
            paragraphStyle: { namedStyleType: 'NORMAL_TEXT', spaceBefore: { magnitude: 4, unit: 'PT' }, spaceAfter: { magnitude: 14, unit: 'PT' }, bullet: { listId: 'kix.l1' } },
            elements: [
              {
                startIndex: 181,
                endIndex: 280,
                textRun: {
                  content: '• Engineered asynchronous event processing pipelines with FastAPI and PostgreSQL.\n',
                  textStyle: { fontSize: { magnitude: 11.5, unit: 'PT' } },
                },
              },
            ],
          },
        },
      ],
    },
  };

  it('PdfRasterizerService creates high-fidelity rendered snapshots with valid dimensions and dataUrls', () => {
    const mockSingle = pdfRasterizer.createMockSnapshot(1);
    expect(mockSingle.pageCount).toBe(1);
    expect(mockSingle.snapshots.length).toBe(1);
    expect(mockSingle.snapshots[0].dataUrl).toMatch(/^data:image\/png;base64,/);
    expect(mockSingle.snapshots[0].width).toBe(612);
    expect(mockSingle.snapshots[0].height).toBe(792);

    const mockDouble = pdfRasterizer.createMockSnapshot(2);
    expect(mockDouble.pageCount).toBe(2);
    expect(mockDouble.snapshots.length).toBe(2);
  });

  it('VisualLayoutAnalyzerService evaluates visual snapshot, flags awkward overflow & generates single-page batch update fix', async () => {
    const paragraphs = extractStructuralParagraphs(mockTwoPageGoogleDoc);
    const layoutInfo = extractDocumentLayoutInfo(mockTwoPageGoogleDoc);

    const report = await visualAnalyzer.analyzeVisualSnapshot({
      documentId: 'mock-doc-overflow',
      structuralParagraphs: paragraphs,
      layoutInfo,
      domain: 'Software Engineering',
    });

    expect(report.pageCount).toBeGreaterThanOrEqual(1);
    expect(report.visualPolishScore).toBeGreaterThanOrEqual(50);
    expect(report.snapshots.length).toBeGreaterThanOrEqual(1);

    // Reconciled issues should include heading crowding or overflow fixes
    const crowdingIssue = report.issues.find((i) => i.category === 'visual_crowding');
    if (crowdingIssue) {
      expect(crowdingIssue.suggestedFix).toBeDefined();
      expect(crowdingIssue.suggestedFix?.actionLabel).toContain('Breathing Room');
      expect(crowdingIssue.suggestedFix?.batchUpdateRequests[0].updateParagraphStyle).toBeDefined();
    }
  });

  it('reconciles vision findings to exact structural AST paragraphs and builds batch update requests', () => {
    const paragraphs = extractStructuralParagraphs(mockTwoPageGoogleDoc);

    const rawVisionFindings = [
      {
        category: 'visual_crowding',
        severity: 'warning',
        sectionName: 'EXPERIENCE',
        title: 'Cramped Section Header ("EXPERIENCE")',
        description: 'Header lacks top margin breathing room.',
        visualObservation: 'No whitespace above EXPERIENCE header line.',
        impact: 'Impairs visual skimming.',
      },
      {
        category: 'page_overflow',
        severity: 'critical',
        sectionName: 'GLOBAL',
        title: 'Awkward Multi-Page Spillover (2 Pages)',
        description: 'Resume spills onto page 2.',
        visualObservation: 'Second page contains 2 orphan lines.',
        impact: 'Single page resumes are strictly preferred.',
      },
    ];

    const reconciled = visualAnalyzer.reconcileAgainstStructuralAst(rawVisionFindings, paragraphs, 2);

    expect(reconciled.length).toBe(2);

    const headerIssue = reconciled.find((i) => i.category === 'visual_crowding');
    expect(headerIssue?.matchedParagraphStartIndex).toBe(61);
    expect(headerIssue?.suggestedFix?.actionLabel).toContain('Breathing Room');

    const overflowIssue = reconciled.find((i) => i.category === 'page_overflow');
    expect(overflowIssue?.suggestedFix?.actionLabel).toBe('Fit Resume to Exactly 1 Page');
    expect(overflowIssue?.suggestedFix?.batchUpdateRequests.length).toBeGreaterThan(0);
  });

  it('LayoutAnalyzerService seamlessly merges structural and visual audit reports', async () => {
    const paragraphs = extractStructuralParagraphs(mockTwoPageGoogleDoc);
    const layoutInfo = extractDocumentLayoutInfo(mockTwoPageGoogleDoc);

    const structuralReport = layoutAnalyzer.analyze(layoutInfo, paragraphs);
    const visualReport = await visualAnalyzer.analyzeVisualSnapshot({
      documentId: 'mock-doc',
      structuralParagraphs: paragraphs,
      layoutInfo,
    });

    const blendedReport = layoutAnalyzer.mergeVisualReport(structuralReport, visualReport);

    expect(blendedReport.visualPolishScore).toBe(visualReport.visualPolishScore);
    expect(blendedReport.visualReport).toBeDefined();
    expect(blendedReport.issues.length).toBeGreaterThanOrEqual(structuralReport.issues.length);
    expect(blendedReport.summary).toContain('Visual Polish:');
  });
});
