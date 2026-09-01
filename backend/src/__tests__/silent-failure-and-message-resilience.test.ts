import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GoogleDocsService } from '../services/google-docs.js';
import { TailoredBulletDiff } from '../types/index.js';

describe('Google Docs Apply Message Resilience & Error Propagation', () => {
  let googleDocs: GoogleDocsService;

  beforeEach(() => {
    vi.restoreAllMocks();
    googleDocs = new GoogleDocsService();
  });

  const sampleDiffs: TailoredBulletDiff[] = [
    {
      id: 'diff-1',
      originalText: 'Engineered distributed Redis caching clusters reducing latency by 45%.',
      tailoredText: '• Architected distributed Redis & Dragonfly caching clusters reducing P99 latency by 68% across 12 regions.',
      status: 'accepted',
    },
  ];

  it('never fails silently when OAuth token is missing: returns clear error object', async () => {
    const result = await googleDocs.applyBatchUpdates('real-doc-12345', sampleDiffs, undefined);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain('OAuth authorization required');
    expect(result.updatedCount).toBe(0);
  });

  it('propagates HTTP 401 / 403 API errors with full descriptive message', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({
        error: {
          code: 401,
          message: 'Request is missing required authentication credential. Expected OAuth 2 access token.',
          status: 'UNAUTHENTICATED',
        },
      }),
    } as any);

    const result = await googleDocs.applyBatchUpdates('real-doc-12345', sampleDiffs, 'ya29.expired_token');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Request is missing required authentication credential');
    expect(result.updatedCount).toBe(0);
  });

  it('propagates HTTP 404 Entity Not Found error when docId is invalid', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({
        error: {
          code: 404,
          message: 'Requested entity was not found.',
          status: 'NOT_FOUND',
        },
      }),
    } as any);

    const result = await googleDocs.applyBatchUpdates('invalid-doc-id', sampleDiffs, 'ya29.valid_token');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Google Drive permission error');
  });

  it('correctly executes full atomic batchUpdate when docId and token are valid', async () => {
    const mockDoc = {
      title: 'Alex Chen Resume',
      body: {
        content: [
          {
            startIndex: 1,
            endIndex: 11,
            paragraph: { elements: [{ textRun: { content: 'Alex Chen\n' } }] },
          },
          {
            startIndex: 11,
            endIndex: 83,
            paragraph: {
              bullet: { listId: 'kix.list1' },
              elements: [{ textRun: { content: 'Engineered distributed Redis caching clusters reducing latency by 45%.\n' } }],
            },
          },
        ],
      },
    };

    globalThis.fetch = vi
      .fn()
      // First call: documents.get
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockDoc,
      } as any)
      // Second call: documents.batchUpdate
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          replies: [{}, {}],
          writeControl: { requiredRevisionId: 'rev_123' },
        }),
      } as any);

    const result = await googleDocs.applyBatchUpdates('real-doc-12345', sampleDiffs, 'ya29.valid_token');

    expect(result.success).toBe(true);
    expect(result.updatedCount).toBe(1);
    expect(result.requestsExecuted).toBe(2); // 1 deleteContentRange + 1 insertText
    expect(result.apiExecuted).toBe(true);
    expect(result.details).toBeDefined();
    expect(result.details![0]).toContain('Applied at [11..82]');
  });
});
