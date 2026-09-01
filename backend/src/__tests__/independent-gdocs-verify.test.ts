import { describe, it, expect } from 'vitest';
import {
  extractStructuralParagraphs,
  resolveDiffReplacementRanges,
  buildStructuralBatchUpdateRequests,
  RobustTextMatcher,
  StructuralParagraph,
} from '../services/google-docs.js';
import { TailoredBulletDiff } from '../types/index.js';

describe('Independent End-to-End Google Docs Structural Apply Verification', () => {
  it('executes structural document batch updates accurately with verbatim before/after text verification', () => {
    // 1. Initial Google Docs JSON Model (Real API UTF-16 code units)
    // Paragraph 0: "Alex Chen\n" (len 10) -> [1, 11]
    // Paragraph 1: "• Engineered distributed Redis caching clusters reducing latency by 45%.\n" (len 74) -> [11, 85]
    // Paragraph 2: "• Built backend services in Python and Postgres to process 10,000 daily orders.\n" (len 80) -> [85, 165]
    // Paragraph 3: "• Created React dashboard for monitoring system health.\n" (len 56) -> [165, 221]
    
    const p0 = 'Alex Chen\n';
    const p1 = '• Engineered distributed Redis caching clusters reducing latency by 45%.\n';
    const p2 = '• Built backend services in Python and Postgres to process 10,000 daily orders.\n';
    const p3 = '• Created React dashboard for monitoring system health.\n';

    const idx0_start = 1;
    const idx0_end = idx0_start + p0.length;

    const idx1_start = idx0_end;
    const idx1_end = idx1_start + p1.length;

    const idx2_start = idx1_end;
    const idx2_end = idx2_start + p2.length;

    const idx3_start = idx2_end;
    const idx3_end = idx3_start + p3.length;

    const initialDoc = {
      documentId: 'test-real-resume-doc-123',
      title: 'Alex Chen - Resume',
      body: {
        content: [
          {
            startIndex: idx0_start,
            endIndex: idx0_end,
            paragraph: {
              elements: [
                {
                  startIndex: idx0_start,
                  endIndex: idx0_end,
                  textRun: { content: p0 },
                },
              ],
            },
          },
          {
            startIndex: idx1_start,
            endIndex: idx1_end,
            paragraph: {
              elements: [
                {
                  startIndex: idx1_start,
                  endIndex: idx1_end,
                  textRun: { content: p1 },
                },
              ],
            },
          },
          {
            startIndex: idx2_start,
            endIndex: idx2_end,
            paragraph: {
              elements: [
                {
                  startIndex: idx2_start,
                  endIndex: idx2_end,
                  textRun: { content: p2 },
                },
              ],
            },
          },
          {
            startIndex: idx3_start,
            endIndex: idx3_end,
            paragraph: {
              elements: [
                {
                  startIndex: idx3_start,
                  endIndex: idx3_end,
                  textRun: { content: p3 },
                },
              ],
            },
          },
        ],
      },
    };

    // Extract exact initial document text
    const beforeText = initialDoc.body.content
      .map((elem) => elem.paragraph?.elements?.[0]?.textRun?.content || '')
      .join('');

    console.log('\n=== [STEP 1] INITIAL DOCUMENT TEXT ===\n' + beforeText);

    // 2. Structural Parsing
    const paragraphs = extractStructuralParagraphs(initialDoc);
    expect(paragraphs.length).toBe(4);

    expect(paragraphs[1].textStartIndex).toBe(idx1_start);
    expect(paragraphs[1].textEndIndex).toBe(idx1_end - 1); // Excludes \n
    expect(paragraphs[2].textStartIndex).toBe(idx2_start);
    expect(paragraphs[2].textEndIndex).toBe(idx2_end - 1); // Excludes \n

    // 3. User Diffs
    const diffs: TailoredBulletDiff[] = [
      {
        id: 'diff-1',
        section: 'Experience',
        organization: 'Acme Corp',
        role: 'SWE',
        originalText: 'Engineered distributed Redis caching clusters reducing latency by 45%.',
        tailoredText: '• Architected distributed Redis & Dragonfly caching clusters reducing P99 latency by 68% across 12 regions.',
        injectedKeywords: ['Dragonfly', 'P99', '12 regions'],
        rationale: 'STAR format with quantified impact',
        charCountDiff: 35,
        status: 'accepted',
      },
      {
        id: 'diff-2',
        section: 'Experience',
        organization: 'Acme Corp',
        role: 'SWE',
        originalText: 'Built backend services in Python and Postgres to process 10,000 daily orders.',
        tailoredText: '• Developed scalable microservices in Python, FastAPI, and Postgres processing 50,000 daily orders.',
        injectedKeywords: ['FastAPI', 'microservices', '50,000'],
        rationale: 'Higher ATS keyword density',
        charCountDiff: 24,
        status: 'accepted',
      },
    ];

    // 4. Resolve exact index ranges
    const { resolved, unresolved } = resolveDiffReplacementRanges(diffs, paragraphs);
    expect(resolved.length).toBe(2);
    expect(unresolved.length).toBe(0);

    // 5. Build atomic structural batchUpdate requests
    const { requests, sortedRanges } = buildStructuralBatchUpdateRequests(resolved, unresolved);

    // Verify descending order of requests
    expect(sortedRanges[0].startIndex).toBe(idx2_start); // Diff 2 (lower in doc) processed FIRST
    expect(sortedRanges[1].startIndex).toBe(idx1_start); // Diff 1 (higher in doc) processed SECOND

    console.log('\n=== [STEP 2] GENERATED BATCH UPDATE REQUESTS (DESCENDING ORDER) ===');
    console.log(JSON.stringify(requests, null, 2));

    // 6. Simulate Google Docs Server-Side Batch Execution on Character Buffer (1-indexed matching Docs UTF-16 buffer)
    let charBuffer = ' ' + beforeText; // 1-indexed to match Google Docs API

    for (const req of requests) {
      if (req.deleteContentRange) {
        const { startIndex, endIndex } = req.deleteContentRange.range;
        charBuffer = charBuffer.slice(0, startIndex) + charBuffer.slice(endIndex);
      } else if (req.insertText) {
        const { index } = req.insertText.location;
        const { text } = req.insertText;
        charBuffer = charBuffer.slice(0, index) + text + charBuffer.slice(index);
      }
    }

    const afterText = charBuffer.slice(1);

    console.log('\n=== [STEP 3] MUTATED DOCUMENT TEXT AFTER BATCH UPDATE ===\n' + afterText);

    // 7. Verify Verbatim Document Content
    expect(afterText).toBe(
      'Alex Chen\n' +
      '• Architected distributed Redis & Dragonfly caching clusters reducing P99 latency by 68% across 12 regions.\n' +
      '• Developed scalable microservices in Python, FastAPI, and Postgres processing 50,000 daily orders.\n' +
      '• Created React dashboard for monitoring system health.\n'
    );

    // 8. Generate Unified Diff Evidence
    const beforeLines = beforeText.trim().split('\n');
    const afterLines = afterText.trim().split('\n');

    const diffOutput: string[] = ['--- before.doc', '+++ after.doc'];
    for (let i = 0; i < Math.max(beforeLines.length, afterLines.length); i++) {
      const bLine = beforeLines[i] || '';
      const aLine = afterLines[i] || '';
      if (bLine === aLine) {
        diffOutput.push(` ${bLine}`);
      } else {
        if (bLine) diffOutput.push(`-${bLine}`);
        if (aLine) diffOutput.push(`+${aLine}`);
      }
    }

    console.log('\n=== [STEP 4] VERIFICATION UNIFIED DIFF ===\n' + diffOutput.join('\n'));
    console.log('\nVERDICT: PASS');
  });
});
