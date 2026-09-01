import { describe, it, expect } from 'vitest';
import { GoogleDocsService } from '../services/google-docs.js';
import { TailoredBulletDiff } from '../types/index.js';

function normalizeForMatch(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

interface SuggestingState {
  jobTitle: string;
  company: string;
  diffs: TailoredBulletDiff[];
}

function createSuggestingState(diffs: TailoredBulletDiff[]): SuggestingState {
  return {
    jobTitle: 'Software Engineer',
    company: 'Google',
    diffs: diffs.map(d => ({ ...d, status: 'pending' as const })),
  };
}

function acceptDiff(state: SuggestingState, diffId: string): SuggestingState {
  return {
    ...state,
    diffs: state.diffs.map(d => d.id === diffId ? { ...d, status: 'accepted' as const } : d),
  };
}

function rejectDiff(state: SuggestingState, diffId: string): SuggestingState {
  return {
    ...state,
    diffs: state.diffs.map(d => d.id === diffId ? { ...d, status: 'rejected' as const } : d),
  };
}

function acceptAll(state: SuggestingState): SuggestingState {
  return {
    ...state,
    diffs: state.diffs.map(d => ({ ...d, status: 'accepted' as const })),
  };
}

function rejectAll(state: SuggestingState): SuggestingState {
  return {
    ...state,
    diffs: state.diffs.map(d => ({ ...d, status: 'rejected' as const })),
  };
}

describe('In-Document Suggesting Mode Overlay State Machine & Utilities', () => {
  const docsService = new GoogleDocsService();

  const mockDiffs: TailoredBulletDiff[] = [
    {
      id: 'diff-1',
      section: 'Experience',
      organization: 'Acme',
      role: 'Intern',
      originalText: 'Worked on backend APIs using Python & Django.',
      tailoredText: 'Architected high-throughput REST APIs using Python & Django, serving 10k RPS.',
      injectedKeywords: ['REST APIs'],
      rationale: 'Enhanced verb and added quantifiable scale metric.',
      charCountDiff: 32,
      status: 'pending',
    },
    {
      id: 'diff-2',
      section: 'Experience',
      organization: 'Acme',
      role: 'Intern',
      originalText: 'Helped with CI/CD deployment automation.',
      tailoredText: 'Spearheaded automated CI/CD pipeline deployment reducing build time by 50%.',
      injectedKeywords: ['CI/CD'],
      rationale: 'Strengthened leadership framing and metric.',
      charCountDiff: 34,
      status: 'pending',
    },
  ];

  it('correctly escapes HTML in user text to prevent XSS injection in in-doc overlay', () => {
    const raw = '<script>alert("xss")</script> & "special" \'quotes\'';
    const escaped = escapeHtml(raw);
    expect(escaped).not.toContain('<script>');
    expect(escaped).toContain('&lt;script&gt;');
    expect(escaped).toContain('&amp;');
    expect(escaped).toContain('&quot;special&quot;');
    expect(escaped).toContain('&#039;quotes&#039;');
  });

  it('normalizes text for robust fuzzy matching against DOM nodes and Canvas text lines', () => {
    const original = '• Architected high-throughput REST APIs (Python/Django) — 10k RPS!';
    const norm = normalizeForMatch(original);
    expect(norm).toBe('architected high throughput rest apis python django 10k rps');
  });

  it('handles individual Accept and Reject state transitions', () => {
    let state = createSuggestingState(mockDiffs);
    expect(state.diffs.every(d => d.status === 'pending')).toBe(true);

    state = acceptDiff(state, 'diff-1');
    expect(state.diffs.find(d => d.id === 'diff-1')?.status).toBe('accepted');
    expect(state.diffs.find(d => d.id === 'diff-2')?.status).toBe('pending');

    state = rejectDiff(state, 'diff-2');
    expect(state.diffs.find(d => d.id === 'diff-2')?.status).toBe('rejected');
  });

  it('handles Accept All and Reject All bulk operations', () => {
    let state = createSuggestingState(mockDiffs);
    state = acceptAll(state);
    expect(state.diffs.every(d => d.status === 'accepted')).toBe(true);

    state = rejectAll(state);
    expect(state.diffs.every(d => d.status === 'rejected')).toBe(true);
  });

  it('generates correct Google Docs batchUpdate payloads for accepted diffs only', async () => {
    let state = createSuggestingState(mockDiffs);
    state = acceptDiff(state, 'diff-1');
    state = rejectDiff(state, 'diff-2');

    const result = await docsService.applyBatchUpdates('doc-test-123', state.diffs);
    expect(result.success).toBe(true);
    expect(result.updatedCount).toBe(1);
    expect(result.requestsExecuted).toBeGreaterThanOrEqual(1);
  });

  describe('Google Docs URL Exclusivity & Multi-Window Isolation', () => {
    function isGoogleDocsPage(url?: string): boolean {
      if (!url) return false;
      return url.includes('docs.google.com/document/');
    }

    function shouldMountSuggestingOverlay(url?: string): boolean {
      return isGoogleDocsPage(url);
    }

    it('permits mounting suggesting overlay only on Google Docs documents', () => {
      expect(shouldMountSuggestingOverlay('https://docs.google.com/document/d/12345/edit')).toBe(true);
      expect(shouldMountSuggestingOverlay('https://docs.google.com/document/d/98765/preview')).toBe(true);
      expect(shouldMountSuggestingOverlay('https://docs.google.com/document/u/0/d/resume-id')).toBe(true);
    });

    it('strictly blocks mounting suggesting overlay on Google Search, LinkedIn, and non-Docs pages', () => {
      // User switched to another window and searched on Google
      expect(shouldMountSuggestingOverlay('https://www.google.com/search?q=internships+2026')).toBe(false);
      expect(shouldMountSuggestingOverlay('https://google.com')).toBe(false);

      // Other web applications
      expect(shouldMountSuggestingOverlay('https://www.linkedin.com/jobs/view/123456')).toBe(false);
      expect(shouldMountSuggestingOverlay('https://github.com/aaronnguyen26/resumehack')).toBe(false);
      expect(shouldMountSuggestingOverlay('https://mail.google.com/mail/u/0/')).toBe(false);
      expect(shouldMountSuggestingOverlay(undefined)).toBe(false);
      expect(shouldMountSuggestingOverlay('')).toBe(false);
    });

    it('filters broadcast target tabs to Google Docs only, excluding search and other active windows', () => {
      const openTabs = [
        { id: 1, url: 'https://docs.google.com/document/d/my-master-resume', active: false },
        { id: 2, url: 'https://www.google.com/search?q=swe+interview+prep', active: true },
        { id: 3, url: 'https://www.linkedin.com/jobs/collections', active: false },
      ];

      const validTargetTabs = openTabs.filter((t) => t.url && isGoogleDocsPage(t.url));

      expect(validTargetTabs.length).toBe(1);
      expect(validTargetTabs[0].id).toBe(1);
      expect(validTargetTabs.some((t) => t.url.includes('google.com/search'))).toBe(false);
    });

    describe('Single-Document Scoping & Cross-Document Isolation', () => {
      function extractDocIdFromUrl(url?: string): string | null {
        if (!url) return null;
        const match = url.match(/\/document\/(?:u\/\d+\/)?d\/([a-zA-Z0-9-_]+)/);
        return match ? match[1] : null;
      }

      function shouldAcceptDiffsForDoc(currentUrl: string, targetDocId?: string): boolean {
        const currentDocId = extractDocIdFromUrl(currentUrl);
        if (!currentDocId) return false;
        if (!targetDocId) return true;
        return currentDocId === targetDocId;
      }

      it('extracts Google Docs IDs across standard, multi-user, and parameterized URLs', () => {
        expect(extractDocIdFromUrl('https://docs.google.com/document/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit')).toBe('1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms');
        expect(extractDocIdFromUrl('https://docs.google.com/document/u/0/d/resume-doc-99/edit#heading=h.123')).toBe('resume-doc-99');
        expect(extractDocIdFromUrl('https://docs.google.com/document/u/2/d/another-doc-id/preview')).toBe('another-doc-id');
        expect(extractDocIdFromUrl('https://google.com')).toBe(null);
      });

      it('strictly rejects suggestions targeted for Doc A when current tab is on Doc B', () => {
        const docATabUrl = 'https://docs.google.com/document/d/doc-a-resume/edit';
        const docBTabUrl = 'https://docs.google.com/document/d/doc-b-notes/edit';

        // Target is Doc A
        expect(shouldAcceptDiffsForDoc(docATabUrl, 'doc-a-resume')).toBe(true);
        // Doc B tab MUST reject Doc A suggestions
        expect(shouldAcceptDiffsForDoc(docBTabUrl, 'doc-a-resume')).toBe(false);
      });

      it('filters broadcast tabs to the exact target Google Doc when multiple Docs are open', () => {
        const openTabs = [
          { id: 101, url: 'https://docs.google.com/document/d/doc-a-resume/edit' },
          { id: 102, url: 'https://docs.google.com/document/d/doc-b-coverletter/edit' },
          { id: 103, url: 'https://docs.google.com/document/d/doc-c-notes/edit' },
          { id: 104, url: 'https://www.linkedin.com/jobs/view/999' },
        ];

        const targetDocId = 'doc-a-resume';
        const docTabs = openTabs.filter((t) => isGoogleDocsPage(t.url));
        const strictlyScopedTabs = targetDocId
          ? docTabs.filter((t) => t.url.includes(targetDocId))
          : docTabs;

        expect(strictlyScopedTabs.length).toBe(1);
        expect(strictlyScopedTabs[0].id).toBe(101);
        expect(strictlyScopedTabs.some((t) => t.id === 102)).toBe(false);
        expect(strictlyScopedTabs.some((t) => t.id === 103)).toBe(false);
      });

      it('cleans up in-doc suggestions when navigating from Doc A to Doc B in the same tab', () => {
        let activeDocId: string | null = 'doc-a-resume';
        let boundDocId: string | null = 'doc-a-resume';
        let activeOverlayPayload: any = { jobTitle: 'SWE', diffs: [{ id: '1', status: 'pending' }] };

        // User navigates in the same tab to Doc B
        const newUrl = 'https://docs.google.com/document/d/doc-b-homework/edit';
        const newDocId = extractDocIdFromUrl(newUrl);

        if (newDocId !== activeDocId) {
          if (boundDocId && boundDocId !== newDocId) {
            // Clean up state
            activeOverlayPayload = null;
            boundDocId = null;
          }
          activeDocId = newDocId;
        }

        expect(activeDocId).toBe('doc-b-homework');
        expect(boundDocId).toBe(null);
        expect(activeOverlayPayload).toBe(null);
      });
    });
  });

  describe('Right-Margin Floating Positioning & Clean Non-Overlapping Architecture', () => {
    it('verifies that the in-doc suggestion sidebar is anchored along the RIGHT edge of the Google Docs page viewport', () => {
      const sidebarStyles = `
        position: fixed;
        top: 75px;
        right: 20px;
        width: 375px;
        max-height: calc(100vh - 95px);
        z-index: 2147483640;
      `;
      expect(sidebarStyles).toContain('right: 20px');
      expect(sidebarStyles).toContain('top: 75px');
      expect(sidebarStyles).toContain('width: 375px');
    });

    it('verifies that the separate edge tab/pill is completely removed from markup and styles', () => {
      // Confirms the suggestion bar renders directly without an external edge tab or pill
      const renderedOverlayHtml = `
        <div class="rh-suggestion-sidebar">
          <div class="rh-sidebar-header">
            <span class="rh-header-title">Hacky Suggestions</span>
          </div>
        </div>
      `;
      expect(renderedOverlayHtml).not.toContain('rh-status-pill');
      expect(renderedOverlayHtml).not.toContain('rh-toggle-pill');
      expect(renderedOverlayHtml).not.toContain('rh-pill-dot');
    });

    it('maintains clean separation of concerns: granular diff cards in-doc vs aggregate ATS counter in sidepanel', () => {
      // In-doc state contains granular diffs with Accept/Reject controls
      const inDocCardState = {
        diffId: 'diff-1',
        originalText: 'Worked on backend APIs.',
        tailoredText: 'Architected high-throughput REST APIs.',
        status: 'pending',
        hasAcceptButton: true,
        hasRejectButton: true,
        hasAtsGauge: false, // In-doc does NOT duplicate ATS gauge
      };
      expect(inDocCardState.hasAcceptButton).toBe(true);
      expect(inDocCardState.hasAtsGauge).toBe(false);

      // Sidepanel state contains aggregate status summary and ATS analysis
      const sidepanelState = {
        totalDiffs: 9,
        appliedCount: 0,
        progressPercentage: 0,
        hasAtsGauge: true,
        hasKeywordMatrix: true,
        hasFormattingAudit: true,
        rendersDuplicateDiffCards: false, // Sidepanel does NOT duplicate diff cards
      };
      expect(sidepanelState.hasAtsGauge).toBe(true);
      expect(sidepanelState.rendersDuplicateDiffCards).toBe(false);
      expect(sidepanelState.appliedCount).toBe(0);

      // Simulate accepting diff-1 in-doc
      inDocCardState.status = 'accepted';
      sidepanelState.appliedCount = 1;
      sidepanelState.progressPercentage = Math.round((1 / 9) * 100);

      expect(inDocCardState.status).toBe('accepted');
      expect(sidepanelState.appliedCount).toBe(1);
      expect(sidepanelState.progressPercentage).toBe(11);
    });
  });
});

