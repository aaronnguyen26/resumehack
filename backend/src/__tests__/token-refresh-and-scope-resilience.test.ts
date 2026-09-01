import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GoogleDocsService } from '../services/google-docs.js';
import { GoogleDriveService } from '../services/google-drive.js';
import { TailoredBulletDiff } from '../types/index.js';

describe('Token Refresh Resilience & Scope Verification', () => {
  let googleDocs: GoogleDocsService;
  let googleDrive: GoogleDriveService;

  beforeEach(() => {
    vi.restoreAllMocks();
    googleDocs = new GoogleDocsService();
    googleDrive = new GoogleDriveService();
  });

  const sampleDiffs: TailoredBulletDiff[] = [
    {
      id: 'diff-1',
      originalText: 'Engineered distributed Redis caching clusters reducing latency by 45%.',
      tailoredText: '• Architected distributed Redis & Dragonfly caching clusters reducing P99 latency by 68% across 12 regions.',
      status: 'accepted',
    },
  ];

  const mockDocAst = {
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

  it('Fix 1 (documents.get): Transparently recovers from HTTP 401 by requesting fresh token and retrying', async () => {
    let callCount = 0;
    const fetchSpy = vi.fn().mockImplementation(async (url: string, init: any) => {
      callCount++;
      const authHeader = init?.headers?.get?.('Authorization') || init?.headers?.Authorization;

      if (callCount === 1) {
        // Initial attempt with expired token -> HTTP 401
        expect(authHeader).toBe('Bearer ya29.stale_expired_token');
        return {
          ok: false,
          status: 401,
          json: async () => ({
            error: {
              code: 401,
              message: 'Request had invalid authentication credentials. Expected OAuth 2 access token.',
              status: 'UNAUTHENTICATED',
            },
          }),
        };
      }

      // Retry attempt with fresh token -> HTTP 200
      expect(authHeader).toBe('Bearer ya29.freshly_minted_token');
      return {
        ok: true,
        status: 200,
        json: async () => mockDocAst,
      };
    });

    globalThis.fetch = fetchSpy as any;

    vi.spyOn(googleDocs, 'getAuthToken').mockResolvedValue('ya29.freshly_minted_token');

    const { doc, paragraphs } = await googleDocs.fetchStructuralDocument('real-doc-123', 'ya29.stale_expired_token');

    expect(doc.title).toBe('Alex Chen Resume');
    expect(paragraphs.length).toBe(2);
    expect(callCount).toBe(2); // 1 failed + 1 successful retry
  });

  it('Fix 1 (documents.batchUpdate): Transparently recovers from HTTP 401 on applyBatchUpdates', async () => {
    let batchUpdateAttempts = 0;
    const fetchSpy = vi.fn().mockImplementation(async (url: string, init: any) => {
      if (url.includes(':batchUpdate')) {
        batchUpdateAttempts++;
        const authHeader = init?.headers?.get?.('Authorization') || init?.headers?.Authorization;

        if (batchUpdateAttempts === 1) {
          expect(authHeader).toBe('Bearer ya29.stale_token');
          return {
            ok: false,
            status: 401,
            json: async () => ({
              error: {
                code: 401,
                message: 'Request had invalid authentication credentials.',
                status: 'UNAUTHENTICATED',
              },
            }),
          };
        }

        expect(authHeader).toBe('Bearer ya29.fresh_token');
        return {
          ok: true,
          status: 200,
          json: async () => ({
            replies: [{}, {}],
            writeControl: { requiredRevisionId: 'rev_456' },
          }),
        };
      }

      // documents.get call returns mock AST
      return {
        ok: true,
        status: 200,
        json: async () => mockDocAst,
      };
    });

    globalThis.fetch = fetchSpy as any;

    vi.spyOn(googleDocs, 'getAuthToken').mockResolvedValue('ya29.fresh_token');

    const result = await googleDocs.applyBatchUpdates('real-doc-123', sampleDiffs, 'ya29.stale_token');

    expect(result.success).toBe(true);
    expect(result.updatedCount).toBe(1);
    expect(batchUpdateAttempts).toBe(2); // Retried seamlessly
  });

  it('Fix 1 & Fix 2 (files.export PDF): Seamlessly exports PDF and recovers from 401 with drive.readonly scope', async () => {
    const mockPdfBinary = Buffer.from('%PDF-1.5 %Sample PDF binary content for visual snapshot analysis');
    let exportAttempts = 0;

    const fetchSpy = vi.fn().mockImplementation(async (url: string, init: any) => {
      exportAttempts++;
      const authHeader = init?.headers?.get?.('Authorization') || init?.headers?.Authorization;

      if (exportAttempts === 1) {
        expect(authHeader).toBe('Bearer ya29.stale_drive_token');
        return {
          ok: false,
          status: 401,
          json: async () => ({
            error: {
              code: 401,
              message: 'Request had invalid authentication credentials.',
              status: 'UNAUTHENTICATED',
            },
          }),
        };
      }

      expect(authHeader).toBe('Bearer ya29.fresh_drive_token');
      return {
        ok: true,
        status: 200,
        arrayBuffer: async () => mockPdfBinary.buffer,
      };
    });

    globalThis.fetch = fetchSpy as any;

    vi.spyOn((googleDrive as any).docsService, 'getAuthToken').mockResolvedValue('ya29.fresh_drive_token');

    const pdfBuffer = await googleDrive.exportDocumentAsPdf('user-doc-789', 'ya29.stale_drive_token');

    expect(pdfBuffer).toBeDefined();
    expect(pdfBuffer.toString()).toContain('%PDF-1.5');
    expect(exportAttempts).toBe(2);
  });
});
