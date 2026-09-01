import { describe, it, expect, vi } from 'vitest';
import { GDocsApiExtractor } from '../services/gdocs-api-extractor.js';
import {
  GoogleDocsService,
  extractStructuralParagraphs,
  resolveDiffReplacementRanges,
  buildStructuralBatchUpdateRequests,
  RobustTextMatcher,
} from '../services/google-docs.js';
import { TailoredBulletDiff } from '../types/index.js';

describe('GDocsApiExtractor Structural Element Parser', () => {
  const extractor = new GDocsApiExtractor();

  it('extracts docId accurately from various Google Docs URL formats', () => {
    const urls = [
      'https://docs.google.com/document/d/1a2b3c4d5e6f7g8h9i0j_KLMNOPQRST/edit',
      'https://docs.google.com/document/d/1a2b3c4d5e6f7g8h9i0j_KLMNOPQRST/edit#heading=h.123',
      'https://docs.google.com/document/d/1a2b3c4d5e6f7g8h9i0j_KLMNOPQRST/preview',
    ];

    urls.forEach((url) => {
      expect(extractor.extractDocId(url)).toBe('1a2b3c4d5e6f7g8h9i0j_KLMNOPQRST');
    });

    expect(extractor.extractDocId('https://notion.so/doc/123')).toBeNull();
  });

  it('parses Google Docs API JSON into structured sections and plain text', () => {
    const mockApiResponse = {
      title: 'Alex Chen - Resume',
      body: {
        content: [
          {
            paragraph: {
              paragraphStyle: { namedStyleType: 'TITLE' },
              elements: [{ textRun: { content: 'Alex Chen\n' } }],
            },
          },
          {
            paragraph: {
              paragraphStyle: { namedStyleType: 'NORMAL_TEXT' },
              elements: [{ textRun: { content: 'alex.chen@berkeley.edu | (510) 555-0199\n' } }],
            },
          },
          {
            paragraph: {
              paragraphStyle: { namedStyleType: 'HEADING_1' },
              elements: [{ textRun: { content: 'EXPERIENCE\n' } }],
            },
          },
          {
            paragraph: {
              bullet: { listId: 'kix.list.0' },
              paragraphStyle: { namedStyleType: 'NORMAL_TEXT' },
              elements: [
                { textRun: { content: 'Engineered high-concurrency microservices in Go.\n' } },
              ],
            },
          },
          {
            paragraph: {
              paragraphStyle: { namedStyleType: 'HEADING_1' },
              elements: [{ textRun: { content: 'SKILLS\n' } }],
            },
          },
          {
            paragraph: {
              paragraphStyle: { namedStyleType: 'NORMAL_TEXT' },
              elements: [{ textRun: { content: 'Languages: Python, Go, TypeScript\n' } }],
            },
          },
        ],
      },
    };

    const parsed = extractor.parseDocResponse('doc-12345', mockApiResponse);

    expect(parsed.docId).toBe('doc-12345');
    expect(parsed.candidateName).toBe('Alex Chen');
    expect(parsed.plainText).toContain('Alex Chen');
    expect(parsed.plainText).toContain('EXPERIENCE');
    expect(parsed.plainText).toContain('• Engineered high-concurrency microservices in Go.');
    expect(parsed.structuredSections.length).toBeGreaterThanOrEqual(2);
    const expSection = parsed.structuredSections.find((s) => s.heading === 'EXPERIENCE');
    expect(expSection).toBeDefined();
    expect(expSection?.lines[0]).toBe('• Engineered high-concurrency microservices in Go.');
  });
});

describe('Structural Document Parser & Index Range Resolution', () => {
  it('extracts structural paragraphs with textEndIndex excluding trailing newline', () => {
    const mockDoc = {
      body: {
        content: [
          {
            startIndex: 1,
            endIndex: 11,
            paragraph: {
              elements: [{ textRun: { content: 'Alex Chen\n' } }],
            },
          },
          {
            startIndex: 11,
            endIndex: 75,
            paragraph: {
              bullet: { listId: 'kix.list.0' },
              elements: [{ textRun: { content: 'Engineered high-concurrency microservices in Go with Raft consensus.\n' } }],
            },
          },
        ],
      },
    };

    const paragraphs = extractStructuralParagraphs(mockDoc);
    expect(paragraphs).toHaveLength(2);

    const bulletPara = paragraphs[1];
    expect(bulletPara.startIndex).toBe(11);
    expect(bulletPara.endIndex).toBe(75);
    expect(bulletPara.textStartIndex).toBe(11);
    // CRITICAL: Trailing \n at index 74 is excluded so deleting doesn't merge paragraphs
    expect(bulletPara.textEndIndex).toBe(74);
    expect(bulletPara.hasNativeBullet).toBe(true);
  });

  it('disambiguates duplicate paragraphs without modifying the same range twice', () => {
    const mockParagraphs = [
      {
        rawText: '• Worked on backend services using Python.\n',
        trimmedText: '• Worked on backend services using Python.',
        normalizedText: '• worked on backend services using python.',
        sanitizedText: 'worked on backend services using python.',
        startIndex: 100,
        endIndex: 144,
        textStartIndex: 100,
        textEndIndex: 143,
        hasNativeBullet: false,
        hasVisualBullet: true,
        bulletPrefix: '• ',
      },
      {
        rawText: '• Worked on backend services using Python.\n',
        trimmedText: '• Worked on backend services using Python.',
        normalizedText: '• worked on backend services using python.',
        sanitizedText: 'worked on backend services using python.',
        startIndex: 200,
        endIndex: 244,
        textStartIndex: 200,
        textEndIndex: 243,
        hasNativeBullet: false,
        hasVisualBullet: true,
        bulletPrefix: '• ',
      },
    ];

    const diffs: TailoredBulletDiff[] = [
      {
        id: 'diff-1',
        section: 'Experience',
        organization: 'Acme',
        role: 'Intern',
        originalText: 'Worked on backend services using Python.',
        tailoredText: 'Architected first Python backend system.',
        status: 'accepted',
        charCountDiff: 5,
      },
      {
        id: 'diff-2',
        section: 'Experience',
        organization: 'Acme',
        role: 'Intern',
        originalText: 'Worked on backend services using Python.',
        tailoredText: 'Optimized second Python backend system.',
        status: 'accepted',
        charCountDiff: 5,
      },
    ];

    const { resolved, unresolved } = resolveDiffReplacementRanges(diffs, mockParagraphs);
    expect(resolved).toHaveLength(2);
    expect(unresolved).toHaveLength(0);
    // Disambiguated across two different start indices
    expect(resolved[0].startIndex).toBe(100);
    expect(resolved[1].startIndex).toBe(200);
  });

  it('builds batchUpdate requests sorted in DESCENDING order of startIndex', () => {
    const mockRanges = [
      {
        diff: { id: 'd1', originalText: 'A', tailoredText: 'New A', status: 'accepted' as const, section: '', organization: '', role: '', charCountDiff: 0 },
        startIndex: 50,
        endIndex: 90,
        replacementText: 'New A',
        matchedParagraph: {} as any,
      },
      {
        diff: { id: 'd2', originalText: 'B', tailoredText: 'New B', status: 'accepted' as const, section: '', organization: '', role: '', charCountDiff: 0 },
        startIndex: 300,
        endIndex: 350,
        replacementText: 'New B',
        matchedParagraph: {} as any,
      },
      {
        diff: { id: 'd3', originalText: 'C', tailoredText: 'New C', status: 'accepted' as const, section: '', organization: '', role: '', charCountDiff: 0 },
        startIndex: 150,
        endIndex: 180,
        replacementText: 'New C',
        matchedParagraph: {} as any,
      },
    ];

    const { requests, sortedRanges } = buildStructuralBatchUpdateRequests(mockRanges);

    // Sorted ranges must be 300 -> 150 -> 50
    expect(sortedRanges[0].startIndex).toBe(300);
    expect(sortedRanges[1].startIndex).toBe(150);
    expect(sortedRanges[2].startIndex).toBe(50);

    // Paired deleteContentRange and insertText
    expect(requests).toHaveLength(6);
    expect(requests[0].deleteContentRange.range.startIndex).toBe(300);
    expect(requests[1].insertText.location.index).toBe(300);
    expect(requests[2].deleteContentRange.range.startIndex).toBe(150);
    expect(requests[3].insertText.location.index).toBe(150);
    expect(requests[4].deleteContentRange.range.startIndex).toBe(50);
    expect(requests[5].insertText.location.index).toBe(50);
  });
});

describe('GoogleDocsService Structural REST API Service', () => {
  const docsService = new GoogleDocsService();

  const testDiffs: TailoredBulletDiff[] = [
    {
      id: 'diff-1',
      section: 'Experience',
      organization: 'Acme Cloud',
      role: 'SWE Intern',
      originalText: '• Worked on backend services using Python and Postgres to process customer orders.',
      tailoredText: '• Architected backend microservices using Python and PostgreSQL, scaling order throughput by 40%.',
      injectedKeywords: ['PostgreSQL'],
      rationale: 'Enhanced verbs and added scale metric.',
      charCountDiff: 25,
      status: 'accepted',
    },
    {
      id: 'diff-2',
      section: 'Experience',
      organization: 'Acme Cloud',
      role: 'SWE Intern',
      originalText: 'Helped with CI/CD pipeline automation and fixed broken integration tests.',
      tailoredText: 'Spearheaded CI/CD pipeline automation and resolved integration test suites.',
      injectedKeywords: ['CI/CD'],
      rationale: 'Stronger STAR action verb.',
      charCountDiff: 15,
      status: 'accepted',
    },
    {
      id: 'diff-3',
      section: 'Projects',
      organization: 'Database',
      role: 'Creator',
      originalText: 'Old rejected project bullet',
      tailoredText: 'New rejected project bullet',
      injectedKeywords: [],
      rationale: 'Rejected',
      charCountDiff: 0,
      status: 'rejected',
    },
  ];

  it('executes structural applyBatchUpdates on live document via documents.get + batchUpdate', async () => {
    const originalFetch = globalThis.fetch;
    const fetchCalls: { url: string; body?: any }[] = [];

    globalThis.fetch = vi.fn().mockImplementation((url: string, init?: any) => {
      fetchCalls.push({ url, body: init?.body ? JSON.parse(init.body) : undefined });

      if (url.includes(':batchUpdate')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              replies: [{}, {}, {}, {}],
              writeControl: { requiredRevisionId: 'rev-456' },
            }),
        });
      }

      // documents.get call
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            title: 'Master Resume',
            body: {
              content: [
                {
                  startIndex: 10,
                  endIndex: 94,
                  paragraph: {
                    bullet: { listId: 'kix.list.0' },
                    elements: [
                      { textRun: { content: 'Worked on backend services using Python and Postgres to process customer orders.\n' } },
                    ],
                  },
                },
                {
                  startIndex: 100,
                  endIndex: 175,
                  paragraph: {
                    bullet: { listId: 'kix.list.0' },
                    elements: [
                      { textRun: { content: 'Helped with CI/CD pipeline automation and fixed broken integration tests.\n' } },
                    ],
                  },
                },
              ],
            },
          }),
      });
    });

    try {
      const result = await docsService.applyBatchUpdates('real-doc-123', testDiffs, 'mock-access-token');
      expect(result.success).toBe(true);
      expect(result.updatedCount).toBe(2);
      expect(result.apiExecuted).toBe(true);
      expect(result.writeControl?.requiredRevisionId).toBe('rev-456');

      // Verify two fetch calls: 1. documents.get, 2. batchUpdate
      expect(fetchCalls).toHaveLength(2);
      expect(fetchCalls[0].url).toContain('https://docs.googleapis.com/v1/documents/real-doc-123');
      expect(fetchCalls[1].url).toContain(':batchUpdate');

      // Verify descending index order in payload: index 100 first, then index 10
      const requests = fetchCalls[1].body.requests;
      expect(requests[0].deleteContentRange.range.startIndex).toBe(100);
      expect(requests[1].insertText.location.index).toBe(100);
      expect(requests[2].deleteContentRange.range.startIndex).toBe(10);
      expect(requests[3].insertText.location.index).toBe(10);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
