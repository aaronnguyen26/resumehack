import { describe, it, expect, vi, afterEach } from 'vitest';
import { GOOGLE_OAUTH_SCOPES } from '../services/google-auth.js';
import { GoogleDocsService } from '../services/google-docs.js';
import { GoogleDriveService } from '../services/google-drive.js';
import fs from 'fs';
import path from 'path';

describe('Step 1: Manifest & OAuth Scopes Verification (drive.file replacement)', () => {
  it('confirms oauth2.scopes in manifest.json contains drive.file and excludes drive.readonly', () => {
    const manifestPath = path.resolve(__dirname, '../../../extension/public/manifest.json');
    const manifestContent = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    const scopes: string[] = manifestContent.oauth2.scopes;
    expect(scopes).toContain('https://www.googleapis.com/auth/documents');
    expect(scopes).toContain('https://www.googleapis.com/auth/drive.file');
    expect(scopes).toContain('https://www.googleapis.com/auth/userinfo.email');
    expect(scopes).not.toContain('https://www.googleapis.com/auth/drive.readonly');
  });

  it('confirms GOOGLE_OAUTH_SCOPES constant contains drive.file and excludes drive.readonly', () => {
    expect(GOOGLE_OAUTH_SCOPES).toContain('https://www.googleapis.com/auth/drive.file');
    expect(GOOGLE_OAUTH_SCOPES).not.toContain('https://www.googleapis.com/auth/drive.readonly');
  });
});

describe('Step 3: Document Operations under drive.file Scope', () => {
  const docsService = new GoogleDocsService();
  const driveService = new GoogleDriveService();
  const testDocId = 'picker-authorized-doc-123';
  const validToken = 'ya29.a0AWY7Ckm_DRIVE_FILE_AUTHORIZED_TOKEN';

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('Step 3.1: Confirms a Picker-selected document can be read via documents.get', async () => {
    const mockDocData = {
      title: 'Alex Chen - Master Resume (Picker Authorized)',
      body: {
        content: [
          {
            startIndex: 1,
            endIndex: 75,
            paragraph: {
              elements: [
                {
                  startIndex: 1,
                  endIndex: 75,
                  textRun: { content: '• Architected distributed caching layer reducing P99 latency by 45ms.\n' }
                }
              ]
            }
          }
        ]
      }
    };

    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      const headers = init?.headers as any;
      const auth = headers?.get ? headers.get('Authorization') : headers?.Authorization;
      expect(auth).toBe(`Bearer ${validToken}`);

      return {
        ok: true,
        status: 200,
        json: async () => mockDocData
      };
    }));

    const result = await docsService.fetchStructuralDocument(testDocId, validToken);
    expect(result.doc.title).toBe('Alex Chen - Master Resume (Picker Authorized)');
    expect(result.paragraphs.length).toBe(1);
    expect(result.paragraphs[0].trimmedText).toContain('Architected distributed caching');
  });

  it('Step 3.1: Confirms a Picker-selected document can be written via batchUpdate', async () => {
    const mockDocData = {
      title: 'Alex Chen - Master Resume',
      body: {
        content: [
          {
            startIndex: 1,
            endIndex: 50,
            paragraph: {
              elements: [
                {
                  startIndex: 1,
                  endIndex: 50,
                  textRun: { content: '• Old bullet text to be tailored\n' }
                }
              ]
            }
          }
        ]
      }
    };

    let batchUpdateExecuted = false;
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes(':batchUpdate')) {
        batchUpdateExecuted = true;
        const body = JSON.parse(init?.body as string);
        expect(body.requests.length).toBeGreaterThanOrEqual(1);
        return {
          ok: true,
          status: 200,
          json: async () => ({
            replies: [{ replaceAllText: { occurrencesChanged: 1 } }]
          })
        };
      }

      return {
        ok: true,
        status: 200,
        json: async () => mockDocData
      };
    }));

    const diffs = [
      {
        id: 'diff-1',
        section: 'Experience',
        organization: 'Acme',
        role: 'SWE',
        originalText: 'Old bullet text to be tailored',
        tailoredText: 'New optimized STAR bullet with Kubernetes',
        injectedKeywords: ['Kubernetes'],
        rationale: 'Power verb',
        charCountDiff: 8,
        status: 'accepted' as const
      }
    ];

    const result = await docsService.applyBatchUpdates(testDocId, diffs, validToken);
    expect(result.success).toBe(true);
    expect(result.updatedCount).toBe(1);
    expect(batchUpdateExecuted).toBe(true);
  });

  it('Step 3.1: Confirms a Picker-selected document can be exported via files.export', async () => {
    const mockPdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]); // %PDF-1.4

    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes('/export?mimeType=application/pdf')) {
        return {
          ok: true,
          status: 200,
          arrayBuffer: async () => mockPdfBytes.buffer
        };
      }
      return { ok: false, status: 404 };
    }));

    const pdfBuffer = await driveService.exportDocumentAsPdf(testDocId, validToken);
    expect(pdfBuffer).toBeDefined();
    expect(pdfBuffer.length).toBe(8);
  });

  it('Step 3.2: Confirms a document NOT selected via Picker fails with clear reselection guidance', async () => {
    const unselectedDocId = 'unauthorized-legacy-doc-999';

    // Simulate Google Drive / Docs API 404 / 403 Forbidden under drive.file
    vi.stubGlobal('fetch', vi.fn(async () => {
      return {
        ok: false,
        status: 404,
        json: async () => ({
          error: {
            code: 404,
            message: 'File not found or insufficient permissions for this file under the drive.file scope.',
            status: 'NOT_FOUND'
          }
        })
      };
    }));

    // 1. Check fetchStructuralDocument error message
    await expect(docsService.fetchStructuralDocument(unselectedDocId, validToken)).rejects.toThrow(
      /Google Drive permission error: This document has not been authorized under the 'drive.file' scope/i
    );

    // 2. Check applyBatchUpdates error message
    const applyRes = await docsService.applyBatchUpdates(unselectedDocId, [{
      id: 'd1', section: 'Exp', organization: 'Acme', role: 'SWE', originalText: 'A', tailoredText: 'B', status: 'accepted'
    }], validToken);

    expect(applyRes.success).toBe(false);
    expect(applyRes.error).toContain("authorized under the 'drive.file' scope");
    expect(applyRes.error).toContain("Google Picker");

    // 3. Check exportDocumentAsPdf error message
    await expect(driveService.exportDocumentAsPdf(unselectedDocId, validToken)).rejects.toThrow(
      /Google Drive PDF export error: This document has not been authorized under the 'drive.file' scope/i
    );
  });
});
