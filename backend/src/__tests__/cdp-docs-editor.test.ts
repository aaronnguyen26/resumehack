import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CdpDocsEditorService, RobustTextMatcher } from '../services/cdp-docs-editor.js';
import { GoogleDocsService } from '../services/google-docs.js';
import { TailoredBulletDiff } from '../types/index.js';

describe('CdpDocsEditorService — Structural REST API Delegate', () => {
  let cdpService: CdpDocsEditorService;
  let mockDocsService: GoogleDocsService;

  const mockDiffs: TailoredBulletDiff[] = [
    {
      id: 'bullet-1',
      section: 'Experience',
      organization: 'Acme Cloud Solutions',
      role: 'Software Engineering Intern',
      originalText: '• Worked on backend services using Python and Postgres.',
      tailoredText: '• Engineered high-throughput backend services using Python, FastAPI, and PostgreSQL.',
      injectedKeywords: ['FastAPI', 'High-throughput'],
      rationale: 'Stronger impact and keywords',
      charCountDiff: 24,
      status: 'accepted',
    },
    {
      id: 'bullet-2',
      section: 'Experience',
      organization: 'Acme Cloud Solutions',
      role: 'Software Engineering Intern',
      originalText: '• Fixed broken integration tests.',
      tailoredText: '• Automated CI/CD pipelines with GitHub Actions and resolved integration tests.',
      injectedKeywords: ['GitHub Actions', 'CI/CD'],
      rationale: 'Highlights automation',
      charCountDiff: 32,
      status: 'rejected',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockDocsService = new GoogleDocsService();
    cdpService = new CdpDocsEditorService(mockDocsService);
  });

  it('correctly sanitizes bullet prefixes for exact Google Docs matching', () => {
    const raw = '• Built distributed databases with Go (Raft consensus) — 10k RPS';
    const clean = RobustTextMatcher.sanitizeOriginal(raw);
    expect(clean).toBe('Built distributed databases with Go (Raft consensus) — 10k RPS');
    expect(clean.startsWith('•')).toBe(false);
  });

  it('handles empty or zero accepted diffs gracefully', async () => {
    const pendingDiffs: TailoredBulletDiff[] = mockDiffs.map((d) => ({ ...d, status: 'pending' }));
    const result = await cdpService.applyDiffsDirectly('doc-123', pendingDiffs);
    expect(result.success).toBe(true);
    expect(result.appliedCount).toBe(0);
  });

  it('is supported natively via Google Docs REST API', () => {
    expect(cdpService.isSupported()).toBe(true);
  });

  it('delegates applyDiffsDirectly to GoogleDocsService.applyBatchUpdates', async () => {
    const applySpy = vi.spyOn(mockDocsService, 'applyBatchUpdates').mockResolvedValue({
      success: true,
      updatedCount: 1,
      occurrencesChanged: 1,
      requestsExecuted: 2,
      apiExecuted: true,
      replies: [{}, {}],
      writeControl: { requiredRevisionId: 'rev-999' },
      details: ['Applied at [10..50]: "Engineered high-throughput..."'],
    });

    const result = await cdpService.applyDiffsDirectly('real-doc-abc', mockDiffs, 'test-token');

    expect(result.success).toBe(true);
    expect(result.appliedCount).toBe(1);
    expect(result.writeControl?.requiredRevisionId).toBe('rev-999');
    expect(applySpy).toHaveBeenCalledWith('real-doc-abc', [mockDiffs[0]], 'test-token');
  });

  it('resolves tab URL to docId when tabId is provided', async () => {
    (globalThis as any).chrome = {
      tabs: {
        get: vi.fn().mockResolvedValue({
          url: 'https://docs.google.com/document/d/1XyZ_googleDocId12345/edit',
        }),
      },
    };

    const applySpy = vi.spyOn(mockDocsService, 'applyBatchUpdates').mockResolvedValue({
      success: true,
      updatedCount: 1,
      requestsExecuted: 2,
      apiExecuted: true,
    });

    const result = await cdpService.applyDiffsDirectly(1234, mockDiffs, 'test-token');

    expect(result.success).toBe(true);
    expect(applySpy).toHaveBeenCalledWith('1XyZ_googleDocId12345', [mockDiffs[0]], 'test-token');
  });
});

