import { describe, it, expect } from 'vitest';
import { extractGoogleDocId } from '../services/precision-extractor.js';
import { GoogleDocsService } from '../services/google-docs.js';
import { TailoredBulletDiff } from '../types/index.js';

describe('Google Docs Access & Real Document Resolution Pipeline', () => {
  const docsService = new GoogleDocsService();

  it('extracts real Google Doc IDs from complex URL patterns with hash, query params, and tab parameters', () => {
    const urls = [
      'https://docs.google.com/document/d/1lm_MnLSGrSIxw7OfXXELGp6EvVa_84yhYvmbsxSv7W4/edit?tab=t.nw04xiwevqxg',
      'https://docs.google.com/document/d/1lm_MnLSGrSIxw7OfXXELGp6EvVa_84yhYvmbsxSv7W4/edit#heading=h.123',
      'https://docs.google.com/document/d/1lm_MnLSGrSIxw7OfXXELGp6EvVa_84yhYvmbsxSv7W4/preview',
      'https://docs.google.com/document/u/0/d/1lm_MnLSGrSIxw7OfXXELGp6EvVa_84yhYvmbsxSv7W4/edit',
    ];

    urls.forEach(url => {
      const docId = extractGoogleDocId(url);
      expect(docId).toBe('1lm_MnLSGrSIxw7OfXXELGp6EvVa_84yhYvmbsxSv7W4');
    });
  });

  it('generates multi-tier batchUpdate replacement requests preserving document integrity', () => {
    const diffs: TailoredBulletDiff[] = [
      {
        id: 'diff-1',
        section: 'Experience',
        organization: 'Google',
        role: 'SWE Intern',
        originalText: '• Worked on backend services using Python and Postgres to process customer orders.',
        tailoredText: 'Architected high-performance backend microservices using Python, PostgreSQL, and Docker, reducing API latency by 35%.',
        injectedKeywords: ['PostgreSQL', 'Docker'],
        rationale: 'Enhanced verb and quantified impact',
        charCountDiff: 32,
        status: 'accepted',
      },
    ];

    const requests = docsService.buildBatchUpdateRequests(diffs);
    expect(requests.length).toBeGreaterThan(0);

    const searchStrings = requests.map(r => r.replaceAllText?.containsText?.text);
    // Should include clean text stripped of bullet symbols
    expect(searchStrings).toContain(
      'Worked on backend services using Python and Postgres to process customer orders.'
    );
  });

  it('reports transparent execution status when token is unconfigured instead of false success', async () => {
    const diffs: TailoredBulletDiff[] = [
      {
        id: 'diff-1',
        section: 'Experience',
        organization: 'Google',
        role: 'SWE Intern',
        originalText: 'Old text',
        tailoredText: 'New text',
        injectedKeywords: [],
        rationale: 'Test',
        charCountDiff: 0,
        status: 'accepted',
      },
    ];

    const result = await docsService.applyBatchUpdates('1lm_MnLSGrSIxw7OfXXELGp6EvVa_84yhYvmbsxSv7W4', diffs);
    // Real Google Docs require OAuth token, returns transparent error instead of false success
    expect(result.success).toBe(false);
    expect(result.apiExecuted).toBe(false);
    expect(result.error).toContain('OAuth authorization required');
  });
});
