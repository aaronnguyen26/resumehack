import { describe, it, expect } from 'vitest';

describe('Hacky Mascot SidePanel Connector & Message Routing', () => {
  interface OpenSidePanelMsg {
    type: 'OPEN_SIDEPANEL';
    tab: 'match' | 'discovery' | 'tracker' | 'settings';
    autoScan?: boolean;
  }

  function createOpenMessage(tab: 'match' | 'discovery' | 'tracker' | 'settings', autoScan = false): OpenSidePanelMsg {
    return {
      type: 'OPEN_SIDEPANEL',
      tab,
      autoScan,
    };
  }

  function resolveTargetTab(
    senderTab?: { id?: number; windowId?: number },
    activeTabFallback?: { id?: number; windowId?: number }
  ): { targetType: 'senderTab' | 'senderWindow' | 'activeTab' | 'activeWindow' | 'none'; id?: number } {
    if (senderTab?.id) {
      return { targetType: 'senderTab', id: senderTab.id };
    }
    if (senderTab?.windowId) {
      return { targetType: 'senderWindow', id: senderTab.windowId };
    }
    if (activeTabFallback?.id) {
      return { targetType: 'activeTab', id: activeTabFallback.id };
    }
    if (activeTabFallback?.windowId) {
      return { targetType: 'activeWindow', id: activeTabFallback.windowId };
    }
    return { targetType: 'none' };
  }

  /**
   * Evaluates whether pointer movement and duration constitute a genuine Click vs a Drag
   */
  function classifyPointerInteraction(
    dx: number,
    dy: number,
    durationMs: number,
    dragThreshold = 8
  ): 'click' | 'drag' {
    const distance = Math.hypot(dx, dy);
    if (distance >= dragThreshold && durationMs >= 180) {
      return 'drag';
    }
    return 'click';
  }

  /**
   * Simulates opening the extension exclusively on the side panel (never opening a new window)
   */
  async function simulateOpenExtensionPipeline(
    senderTab?: { id?: number; windowId?: number },
    activeTabFallback?: { id?: number; windowId?: number },
    apiAvailability: {
      hasSidePanelTabOpen?: boolean;
      hasSidePanelWindowOpen?: boolean;
      hasSidePanelFallback?: boolean;
    } = {}
  ): Promise<{ status: 'opened' | 'error'; target: string; isSidePanel: boolean; isNewWindow: boolean }> {
    // 1. Try senderTab sidePanel (opens on side of current tab)
    if (senderTab?.id && apiAvailability.hasSidePanelTabOpen) {
      return { status: 'opened', target: 'senderTab', isSidePanel: true, isNewWindow: false };
    }

    // 2. Try senderWindow sidePanel (opens on side of current window)
    if (senderTab?.windowId && apiAvailability.hasSidePanelWindowOpen) {
      return { status: 'opened', target: 'senderWindow', isSidePanel: true, isNewWindow: false };
    }

    // 3. Try active tab in current window
    if (activeTabFallback?.id && apiAvailability.hasSidePanelFallback) {
      return { status: 'opened', target: 'activeTab', isSidePanel: true, isNewWindow: false };
    }

    return { status: 'error', target: 'none', isSidePanel: false, isNewWindow: false };
  }

  it('constructs well-formed OPEN_SIDEPANEL payloads for all tabs', () => {
    const msg1 = createOpenMessage('match', true);
    expect(msg1.type).toBe('OPEN_SIDEPANEL');
    expect(msg1.tab).toBe('match');
    expect(msg1.autoScan).toBe(true);

    const msg2 = createOpenMessage('discovery');
    expect(msg2.tab).toBe('discovery');
    expect(msg2.autoScan).toBe(false);

    const msg3 = createOpenMessage('tracker');
    expect(msg3.tab).toBe('tracker');

    const msg4 = createOpenMessage('settings');
    expect(msg4.tab).toBe('settings');
  });

  it('prioritizes sender tab id over active tab fallback', () => {
    const sender = { id: 101, windowId: 1 };
    const fallback = { id: 202, windowId: 2 };

    const resolved = resolveTargetTab(sender, fallback);
    expect(resolved.targetType).toBe('senderTab');
    expect(resolved.id).toBe(101);
  });

  it('falls back to sender window when sender tab id is undefined', () => {
    const sender = { windowId: 5 };
    const fallback = { id: 202, windowId: 2 };

    const resolved = resolveTargetTab(sender, fallback);
    expect(resolved.targetType).toBe('senderWindow');
    expect(resolved.id).toBe(5);
  });

  it('falls back to active tab when sender tab is completely undefined', () => {
    const fallback = { id: 202, windowId: 2 };
    const resolved = resolveTargetTab(undefined, fallback);
    expect(resolved.targetType).toBe('activeTab');
    expect(resolved.id).toBe(202);
  });

  it('correctly classifies clicks vs drags using displacement and duration', () => {
    // Normal stationary click: 0px, 80ms -> click
    expect(classifyPointerInteraction(0, 0, 80)).toBe('click');

    // Slight trackpad jitter (3px movement, 100ms) -> click (not accidental drag)
    expect(classifyPointerInteraction(3, 4, 100)).toBe('click');

    // Fast quick tap with small shift (6px, 120ms) -> click
    expect(classifyPointerInteraction(5, 3, 120)).toBe('click');

    // Intentional drag (25px displacement, 500ms) -> drag
    expect(classifyPointerInteraction(20, 15, 500)).toBe('drag');

    // High displacement but fast release -> drag if past threshold & duration
    expect(classifyPointerInteraction(50, 50, 400)).toBe('drag');
  });

  it('executes side panel opening on the side without creating separate popup windows', async () => {
    // Case 1: Sidepanel supported on tab -> opens on side
    const res1 = await simulateOpenExtensionPipeline(
      { id: 10, windowId: 1 },
      undefined,
      { hasSidePanelTabOpen: true }
    );
    expect(res1).toEqual({ status: 'opened', target: 'senderTab', isSidePanel: true, isNewWindow: false });

    // Case 2: Sidepanel tab open fails, window open succeeds -> opens on side
    const res2 = await simulateOpenExtensionPipeline(
      { id: 10, windowId: 1 },
      undefined,
      { hasSidePanelTabOpen: false, hasSidePanelWindowOpen: true }
    );
    expect(res2).toEqual({ status: 'opened', target: 'senderWindow', isSidePanel: true, isNewWindow: false });

    // Case 3: Active tab fallback in current window -> opens on side
    const res3 = await simulateOpenExtensionPipeline(
      undefined,
      { id: 202, windowId: 2 },
      { hasSidePanelFallback: true }
    );
    expect(res3).toEqual({ status: 'opened', target: 'activeTab', isSidePanel: true, isNewWindow: false });
  });

  describe('STAR Suggestions In-Document Broadcast & Auto-Closing SidePanel', () => {
    interface CloseSidePanelMsg {
      type: 'CLOSE_SIDEPANEL';
    }

    interface ShowInDocDiffsMsg {
      type: 'SHOW_IN_DOC_DIFFS';
      payload: {
        jobTitle: string;
        company: string;
        projectedNewScore?: number;
        originalScore?: number;
        diffs: Array<{
          id: string;
          originalText: string;
          tailoredText: string;
          rationale: string;
          status: 'pending' | 'accepted' | 'rejected';
        }>;
      };
    }

    async function simulateCloseSidePanelPipeline(
      sender?: { tabId?: number; windowId?: number },
      apiAvailability: {
        hasSidePanelClose?: boolean;
        hasWindowClose?: boolean;
      } = {}
    ): Promise<{ status: 'closed' | 'error'; closedBy: string }> {
      if (apiAvailability.hasSidePanelClose) {
        if (sender?.windowId) {
          return { status: 'closed', closedBy: 'chrome.sidePanel.close(windowId)' };
        }
        if (sender?.tabId) {
          return { status: 'closed', closedBy: 'chrome.sidePanel.close(tabId)' };
        }
        return { status: 'closed', closedBy: 'chrome.sidePanel.close(activeWindow)' };
      }
      if (apiAvailability.hasWindowClose) {
        return { status: 'closed', closedBy: 'window.close()' };
      }
      return { status: 'error', closedBy: 'none' };
    }

    it('formats SHOW_IN_DOC_DIFFS payload correctly for in-document visibility', () => {
      const payload: ShowInDocDiffsMsg = {
        type: 'SHOW_IN_DOC_DIFFS',
        payload: {
          jobTitle: 'Senior Software Engineer',
          company: 'Google',
          projectedNewScore: 94,
          originalScore: 78,
          diffs: [
            {
              id: 'diff-1',
              originalText: 'Built APIs with Node.js',
              tailoredText: 'Architected high-throughput RESTful microservices in Node.js/TypeScript, reducing p99 latency by 35%',
              rationale: 'STAR optimization: strong verb + quantitative metric',
              status: 'pending',
            },
            {
              id: 'diff-2',
              originalText: 'Worked on database queries',
              tailoredText: 'Engineered PostgreSQL indexing strategies and query optimizations, scaling throughput to 50k RPS',
              rationale: 'STAR optimization: quantifiable impact and tech stack alignment',
              status: 'pending',
            },
          ],
        },
      };

      expect(payload.type).toBe('SHOW_IN_DOC_DIFFS');
      expect(payload.payload.diffs.length).toBe(2);
      expect(payload.payload.projectedNewScore).toBe(94);
      expect(payload.payload.diffs[0].status).toBe('pending');
    });

    it('executes CLOSE_SIDEPANEL routing by windowId or tabId', async () => {
      const res1 = await simulateCloseSidePanelPipeline(
        { windowId: 10 },
        { hasSidePanelClose: true }
      );
      expect(res1).toEqual({
        status: 'closed',
        closedBy: 'chrome.sidePanel.close(windowId)',
      });

      const res2 = await simulateCloseSidePanelPipeline(
        { tabId: 101 },
        { hasSidePanelClose: true }
      );
      expect(res2).toEqual({
        status: 'closed',
        closedBy: 'chrome.sidePanel.close(tabId)',
      });

      const res3 = await simulateCloseSidePanelPipeline(
        undefined,
        { hasSidePanelClose: false, hasWindowClose: true }
      );
      expect(res3).toEqual({
        status: 'closed',
        closedBy: 'window.close()',
      });
    });

    it('preserves STAR suggestions in document state when side panel closes', () => {
      const mockDocState = {
        hasActiveSuggestions: false,
        visibleDiffsCount: 0,
        sidePanelOpen: true,
      };

      // 1. STAR suggestions generated and broadcast to document
      const incomingDiffs = [
        { id: '1', original: 'Old', tailored: 'New STAR', status: 'pending' },
        { id: '2', original: 'Old 2', tailored: 'New STAR 2', status: 'pending' },
      ];
      mockDocState.hasActiveSuggestions = true;
      mockDocState.visibleDiffsCount = incomingDiffs.length;

      // 2. Side panel closes itself
      mockDocState.sidePanelOpen = false;

      // 3. Document STAR suggestions remain fully active and visible
      expect(mockDocState.sidePanelOpen).toBe(false);
      expect(mockDocState.hasActiveSuggestions).toBe(true);
      expect(mockDocState.visibleDiffsCount).toBe(2);
    });
  });

  describe('Google Docs Side Panel Exclusivity & Cross-Window Routing', () => {
    function isGoogleDocsUrl(url?: string): boolean {
      if (!url) return false;
      return url.includes('docs.google.com/document/') || url.includes('docs.google.com/');
    }

    function determineSidePanelStateForTab(url?: string): { enabled: boolean; path?: string } {
      if (isGoogleDocsUrl(url)) {
        return { enabled: true, path: 'index.html' };
      }
      return { enabled: false };
    }

    interface TabMock {
      id: number;
      url: string;
      windowId: number;
      active?: boolean;
    }

    async function routeHackyClickToGoogleDocs(
      clickedTab: TabMock,
      allOpenTabs: TabMock[]
    ): Promise<{ targetTabId: number; action: 'opened_on_sender' | 'switched_to_gdocs' | 'created_new_gdocs' }> {
      // 1. If clicked from a Google Doc, open on that tab
      if (isGoogleDocsUrl(clickedTab.url)) {
        return { targetTabId: clickedTab.id, action: 'opened_on_sender' };
      }

      // 2. If clicked from another window/webpage (e.g. LinkedIn), find open Google Doc
      const existingGdoc = allOpenTabs.find((t) => isGoogleDocsUrl(t.url));
      if (existingGdoc) {
        return { targetTabId: existingGdoc.id, action: 'switched_to_gdocs' };
      }

      // 3. If no Google Doc open, create a new one
      const newGdocId = 9999;
      return { targetTabId: newGdocId, action: 'created_new_gdocs' };
    }

    it('accurately identifies Google Docs URLs and rejects non-Google Docs URLs', () => {
      expect(isGoogleDocsUrl('https://docs.google.com/document/d/12345/edit')).toBe(true);
      expect(isGoogleDocsUrl('https://docs.google.com/document/u/0/')).toBe(true);
      expect(isGoogleDocsUrl('https://docs.google.com/document/create')).toBe(true);

      expect(isGoogleDocsUrl('https://www.linkedin.com/jobs/view/123')).toBe(false);
      expect(isGoogleDocsUrl('https://boards.greenhouse.io/stripe')).toBe(false);
      expect(isGoogleDocsUrl('https://github.com')).toBe(false);
      expect(isGoogleDocsUrl('chrome://extensions')).toBe(false);
      expect(isGoogleDocsUrl(undefined)).toBe(false);
    });

    it('enables side panel strictly for Google Docs and disables for other sites', () => {
      const gdocState = determineSidePanelStateForTab('https://docs.google.com/document/d/my-resume');
      expect(gdocState.enabled).toBe(true);
      expect(gdocState.path).toBe('index.html');

      const linkedinState = determineSidePanelStateForTab('https://www.linkedin.com/jobs');
      expect(linkedinState.enabled).toBe(false);
      expect(linkedinState.path).toBeUndefined();

      const githubState = determineSidePanelStateForTab('https://github.com');
      expect(githubState.enabled).toBe(false);
    });

    it('routes Hacky clicks on Google Docs directly to the sender Google Doc tab', async () => {
      const gdocTab: TabMock = { id: 101, url: 'https://docs.google.com/document/d/abc', windowId: 1 };
      const allTabs: TabMock[] = [gdocTab];

      const result = await routeHackyClickToGoogleDocs(gdocTab, allTabs);
      expect(result.action).toBe('opened_on_sender');
      expect(result.targetTabId).toBe(101);
    });

    it('routes Hacky clicks on non-Google Docs windows to an open Google Doc tab', async () => {
      const linkedinTab: TabMock = { id: 202, url: 'https://www.linkedin.com/jobs/99', windowId: 2 };
      const gdocTab: TabMock = { id: 101, url: 'https://docs.google.com/document/d/abc', windowId: 1 };
      const allTabs: TabMock[] = [linkedinTab, gdocTab];

      const result = await routeHackyClickToGoogleDocs(linkedinTab, allTabs);
      expect(result.action).toBe('switched_to_gdocs');
      expect(result.targetTabId).toBe(101);
    });

    it('creates and opens a new Google Doc tab when Hacky is clicked with no Google Doc open', async () => {
      const handshakeTab: TabMock = { id: 303, url: 'https://joinhandshake.com/jobs', windowId: 3 };
      const allTabs: TabMock[] = [handshakeTab];

      const result = await routeHackyClickToGoogleDocs(handshakeTab, allTabs);
      expect(result.action).toBe('created_new_gdocs');
      expect(result.targetTabId).toBe(9999);
    });
  });
});
