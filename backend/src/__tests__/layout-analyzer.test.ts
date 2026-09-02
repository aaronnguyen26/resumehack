import { describe, it, expect } from 'vitest';
import { LayoutAnalyzerService } from '../services/layout-analyzer.js';
import { PROVISIONAL_RESUME_LAYOUT_SPEC } from '../services/resume-layout-spec.js';
import { DocumentLayoutInfo, StructuralParagraph } from '../types/index.js';

describe('LayoutAnalyzerService — Canonical Spec & Deterministic AST Suite', () => {
  const analyzer = new LayoutAnalyzerService();

  // ── 1. Spec Constants & Grounding Verification ─────────────────────────────
  describe('Canonical Layout Specification Constants', () => {
    it('grounds margin limits in 0.5" (36pt) to 0.75" (54pt) standard', () => {
      expect(PROVISIONAL_RESUME_LAYOUT_SPEC.margins.minPt).toBe(36);
      expect(PROVISIONAL_RESUME_LAYOUT_SPEC.margins.maxPt).toBe(54);
      expect(PROVISIONAL_RESUME_LAYOUT_SPEC.margins.optimalPt).toBe(36);
    });

    it('establishes minimum heading-to-body typography ratio of 1.18x', () => {
      expect(PROVISIONAL_RESUME_LAYOUT_SPEC.typography.minHeadingToBodyRatio).toBe(1.18);
      expect(PROVISIONAL_RESUME_LAYOUT_SPEC.typography.headingFontPt.optimal).toBe(13.0);
      expect(PROVISIONAL_RESUME_LAYOUT_SPEC.typography.bodyFontPt.optimal).toBe(10.5);
    });

    it('configures widow character threshold at 18 characters', () => {
      expect(PROVISIONAL_RESUME_LAYOUT_SPEC.spacing.widowThresholdChars).toBe(18);
    });

    it('configures bold emphasis density threshold between 4% and 22%', () => {
      expect(PROVISIONAL_RESUME_LAYOUT_SPEC.emphasis.minBoldWordRatio).toBe(0.04);
      expect(PROVISIONAL_RESUME_LAYOUT_SPEC.emphasis.maxBoldWordRatio).toBe(0.22);
    });
  });

  // ── 2. Widow / Orphan Line AST Audit ───────────────────────────────────────
  describe('Widow / Orphan Line Detection', () => {
    it('detects widow line when last line has <= 18 characters and flags content_generating fix', () => {
      // 88 chars per line: 88 + 12 = 100 chars total (2 lines, last line has 12 chars)
      const line1 = 'Architected high-throughput Redis and FastAPI microservices across 12 distributed AWS nodes '; // 92 chars
      const line2 = 'by 35%.'; // 7 chars -> widow!
      const fullText = line1 + line2;

      const paragraphs: StructuralParagraph[] = [
        {
          rawText: `• ${fullText}\n`,
          trimmedText: `• ${fullText}`,
          normalizedText: fullText.toLowerCase(),
          sanitizedText: fullText.toLowerCase(),
          startIndex: 10,
          endIndex: 120,
          textStartIndex: 10,
          textEndIndex: 119,
          hasNativeBullet: true,
          hasVisualBullet: true,
          runs: [{ startIndex: 10, endIndex: 120, content: fullText, fontSize: 10.5 }],
        },
      ];

      const report = analyzer.analyze(undefined, paragraphs);
      const widowIssue = report.issues.find((i) => i.category === 'widow_line');

      expect(widowIssue).toBeDefined();
      expect(widowIssue?.severity).toBe('info');
      expect(widowIssue?.fixTier).toBe('content_generating');
      expect(widowIssue?.title).toContain('Widow Line on Bullet');
    });

    it('does not flag single-line bullets as widow lines', () => {
      const shortText = 'Architected FastAPI microservices in Python.'; // 44 chars -> 1 line

      const paragraphs: StructuralParagraph[] = [
        {
          rawText: `• ${shortText}\n`,
          trimmedText: `• ${shortText}`,
          normalizedText: shortText.toLowerCase(),
          sanitizedText: shortText.toLowerCase(),
          startIndex: 10,
          endIndex: 60,
          textStartIndex: 10,
          textEndIndex: 59,
          hasNativeBullet: true,
          hasVisualBullet: true,
          runs: [{ startIndex: 10, endIndex: 60, content: shortText, fontSize: 10.5 }],
        },
      ];

      const report = analyzer.analyze(undefined, paragraphs);
      const widowIssue = report.issues.find((i) => i.category === 'widow_line');

      expect(widowIssue).toBeUndefined();
    });
  });

  // ── 3. Typography Scale & Inverted Hierarchy Audit ────────────────────────
  describe('Typography Hierarchy & Inversion Detection', () => {
    it('flags inverted hierarchy when heading font size is smaller than body font size', () => {
      const paragraphs: StructuralParagraph[] = [
        {
          rawText: 'EXPERIENCE\n',
          trimmedText: 'EXPERIENCE',
          normalizedText: 'experience',
          sanitizedText: 'experience',
          startIndex: 10,
          endIndex: 22,
          textStartIndex: 10,
          textEndIndex: 21,
          hasNativeBullet: false,
          hasVisualBullet: false,
          paragraphStyle: { namedStyleType: 'HEADING_1' },
          runs: [{ startIndex: 10, endIndex: 22, content: 'EXPERIENCE', fontSize: 10.0 }], // 10pt heading
        },
        {
          rawText: '• Developed scalable backend services in Python.\n',
          trimmedText: '• Developed scalable backend services in Python.',
          normalizedText: 'developed scalable backend services in python.',
          sanitizedText: 'developed scalable backend services in python.',
          startIndex: 23,
          endIndex: 75,
          textStartIndex: 23,
          textEndIndex: 74,
          hasNativeBullet: true,
          hasVisualBullet: true,
          runs: [{ startIndex: 23, endIndex: 75, content: 'Developed scalable backend services in Python.', fontSize: 11.5 }], // 11.5pt body!
        },
      ];

      const report = analyzer.analyze(undefined, paragraphs);
      const typeIssue = report.issues.find((i) => i.category === 'typography_hierarchy');

      expect(typeIssue).toBeDefined();
      expect(typeIssue?.severity).toBe('warning');
      expect(typeIssue?.fixTier).toBe('safe_styling');
      expect(typeIssue?.suggestedFix?.batchUpdateRequests[0].updateTextStyle.textStyle.fontSize.magnitude).toBe(13.0);
    });
  });

  // ── 4. Margin Extremes & Asymmetry Audit ──────────────────────────────────
  describe('Margin Extremes & Asymmetry Detection', () => {
    it('detects margins < 0.5" (36pt) as print clipping risk', () => {
      const layoutInfo: DocumentLayoutInfo = {
        title: 'My Resume',
        hasTables: false,
        tableCount: 0,
        tables: [],
        sectionStyle: {
          columnCount: 1,
          marginTop: 20, // < 36pt
          marginBottom: 20,
          marginLeft: 20,
          marginRight: 20,
        },
      };

      const report = analyzer.analyze(layoutInfo, []);
      const marginIssue = report.issues.find((i) => i.category === 'margin_extremes');

      expect(marginIssue).toBeDefined();
      expect(marginIssue?.title).toContain('Margins Too Narrow');
      expect(marginIssue?.fixTier).toBe('safe_styling');
      expect(marginIssue?.suggestedFix?.batchUpdateRequests[0].updateDocumentStyle.documentStyle.marginLeft.magnitude).toBe(36);
    });

    it('detects margins > 0.75" (54pt) as space wasting', () => {
      const layoutInfo: DocumentLayoutInfo = {
        title: 'My Resume',
        hasTables: false,
        tableCount: 0,
        tables: [],
        sectionStyle: {
          columnCount: 1,
          marginTop: 72, // 1.0"
          marginBottom: 72,
          marginLeft: 72,
          marginRight: 72,
        },
      };

      const report = analyzer.analyze(layoutInfo, []);
      const marginIssue = report.issues.find((i) => i.category === 'margin_extremes');

      expect(marginIssue).toBeDefined();
      expect(marginIssue?.title).toContain('Excessive Margins');
      expect(marginIssue?.fixTier).toBe('safe_styling');
    });
  });

  // ── 5. Bold Emphasis Density Audit ────────────────────────────────────────
  describe('Bold Emphasis Density Detection', () => {
    it('flags excessive bolding (>22% of total document words)', () => {
      const paragraphs: StructuralParagraph[] = [
        {
          rawText: 'Architected distributed caching clusters reducing latency by 45% across production nodes.\n',
          trimmedText: 'Architected distributed caching clusters reducing latency by 45% across production nodes.',
          normalizedText: 'architected distributed caching clusters reducing latency by 45% across production nodes.',
          sanitizedText: 'architected distributed caching clusters reducing latency by 45% across production nodes.',
          startIndex: 10,
          endIndex: 110,
          textStartIndex: 10,
          textEndIndex: 109,
          hasNativeBullet: true,
          hasVisualBullet: true,
          runs: [
            // 70 words total, all bolded
            {
              startIndex: 10,
              endIndex: 110,
              content: 'Architected distributed caching clusters reducing latency by 45% across production nodes in AWS with zero downtime and high availability across all regions for 50000 daily users.',
              bold: true, // 100% bold!
              fontSize: 10.5,
            },
          ],
        },
      ];

      const report = analyzer.analyze(undefined, paragraphs);
      const boldIssue = report.issues.find((i) => i.category === 'bold_density');

      expect(boldIssue).toBeDefined();
      expect(boldIssue?.title).toContain('Excessive Bold Emphasis');
      expect(boldIssue?.severity).toBe('warning');
    });
  });

  // ── 6. Two-Tier Fix Classification Integrity ──────────────────────────────
  describe('Two-Tier Fix Classification (Safe Styling vs Content-Generating)', () => {
    it('categorizes geometric and typographic fixes as safe_styling (1-click ready)', () => {
      const layoutInfo: DocumentLayoutInfo = {
        title: 'Resume',
        hasTables: true,
        tableCount: 1,
        tables: [{ rows: 2, columns: 2, startIndex: 0, endIndex: 50 }],
        sectionStyle: {
          columnCount: 1,
          marginTop: 20,
          marginBottom: 20,
          marginLeft: 20,
          marginRight: 20,
        },
      };

      const paragraphs: StructuralParagraph[] = [
        {
          rawText: 'Senior Software Engineer    June 2022 - Present\n',
          trimmedText: 'Senior Software Engineer    June 2022 - Present',
          normalizedText: 'senior software engineer june 2022 - present',
          sanitizedText: 'senior software engineer june 2022 - present',
          startIndex: 0,
          endIndex: 48,
          textStartIndex: 0,
          textEndIndex: 47,
          hasNativeBullet: false,
          hasVisualBullet: false,
          runs: [{ startIndex: 0, endIndex: 48, content: 'Senior Software Engineer    June 2022 - Present', fontSize: 10.5 }],
        },
      ];

      const report = analyzer.analyze(layoutInfo, paragraphs);

      const tableIssue = report.issues.find((i) => i.category === 'table_risk');
      const marginIssue = report.issues.find((i) => i.category === 'margin_extremes');
      const spaceIssue = report.issues.find((i) => i.category === 'manual_tab_alignment');

      expect(tableIssue?.fixTier).toBe('safe_styling');
      expect(marginIssue?.fixTier).toBe('safe_styling');
      expect(spaceIssue?.fixTier).toBe('safe_styling');
    });

    it('categorizes widow-line compression as content_generating and provides preview text', () => {
      const line1 = 'Architected high-throughput Redis caching clusters across 12 distributed AWS nodes '; // 83 chars
      const line2 = 'in order to scale.'; // 18 chars (total text 101 chars, trimmedText with bullet is 103 chars -> 103 % 88 = 15 chars <= 18)
      const text = line1 + line2;
      const paragraphs: StructuralParagraph[] = [
        {
          rawText: `• ${text}\n`,
          trimmedText: `• ${text}`,
          normalizedText: text.toLowerCase(),
          sanitizedText: text.toLowerCase(),
          startIndex: 0,
          endIndex: 110,
          textStartIndex: 0,
          textEndIndex: 109,
          hasNativeBullet: true,
          hasVisualBullet: true,
          runs: [{ startIndex: 0, endIndex: 110, content: text, fontSize: 10.5 }],
        },
      ];

      const report = analyzer.analyze(undefined, paragraphs);
      const widowIssue = report.issues.find((i) => i.category === 'widow_line');

      expect(widowIssue).toBeDefined();
      expect(widowIssue?.fixTier).toBe('content_generating');
      expect(widowIssue?.proposedReplacementText).toBeDefined();
      expect(typeof widowIssue?.proposedReplacementText).toBe('string');
      expect(widowIssue?.proposedReplacementText!.length).toBeLessThan(text.length);
    });
  });

  // ── 7. Softened Section Volume Advisory (No False Positives) ───────────────
  describe('Contextual Section Volume Advisory', () => {
    it('does NOT flag a legitimate 6-year tenure (5 bullets) followed by a 3-month role (2 bullets)', () => {
      // 7 total bullets distributed across 2 realistic roles
      const paragraphs: StructuralParagraph[] = Array.from({ length: 7 }, (_, idx) => ({
        rawText: `• Built microservice feature ${idx + 1} processing 10000 daily requests.\n`,
        trimmedText: `• Built microservice feature ${idx + 1} processing 10000 daily requests.`,
        normalizedText: `built microservice feature ${idx + 1}`,
        sanitizedText: `built microservice feature ${idx + 1}`,
        startIndex: idx * 50,
        endIndex: (idx + 1) * 50,
        textStartIndex: idx * 50,
        textEndIndex: (idx + 1) * 50 - 1,
        hasNativeBullet: true,
        hasVisualBullet: true,
        runs: [{ startIndex: idx * 50, endIndex: (idx + 1) * 50, content: `Built microservice feature ${idx + 1}`, fontSize: 10.5 }],
      }));

      const report = analyzer.analyze(undefined, paragraphs);
      const volumeIssue = report.issues.find((i) => i.category === 'section_volume_bloat');

      expect(volumeIssue).toBeUndefined();
    });

    it('flags an extreme wall of >8 consecutive un-grouped bullets with severity info and no destructive auto-fix', () => {
      const paragraphs: StructuralParagraph[] = Array.from({ length: 10 }, (_, idx) => ({
        rawText: `• Scaled distributed cluster service ${idx + 1} with Redis caching.\n`,
        trimmedText: `• Scaled distributed cluster service ${idx + 1} with Redis caching.`,
        normalizedText: `scaled distributed cluster service ${idx + 1}`,
        sanitizedText: `scaled distributed cluster service ${idx + 1}`,
        startIndex: idx * 50,
        endIndex: (idx + 1) * 50,
        textStartIndex: idx * 50,
        textEndIndex: (idx + 1) * 50 - 1,
        hasNativeBullet: true,
        hasVisualBullet: true,
        runs: [{ startIndex: idx * 50, endIndex: (idx + 1) * 50, content: `Scaled distributed cluster service ${idx + 1}`, fontSize: 10.5 }],
      }));

      const report = analyzer.analyze(undefined, paragraphs);
      const volumeIssue = report.issues.find((i) => i.category === 'section_volume_bloat');

      expect(volumeIssue).toBeDefined();
      expect(volumeIssue?.severity).toBe('info');
      expect(volumeIssue?.title).toContain('High Bullet Density');
      expect(volumeIssue?.suggestedFix).toBeUndefined(); // Purely advisory, zero destructive auto-fix
    });
  });
});
