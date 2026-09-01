import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isValidWebTabUrl,
  isValidWebTab,
  filterWebTabsForInjection,
  groupTabsByWindow,
  shouldInjectOnTabUpdate,
  injectContentScriptIntoTab,
  injectContentScriptsIntoAllTabs,
  handleWindowCreated,
  handleWindowFocusChanged,
  handleTabCreated,
  handleTabUpdated,
  broadcastToAllTabs,
  WebTab
} from '../services/multiwindow-mascot.js';
import { clampMascotPosition } from '../services/mascot-notification.js';

describe('Hacky Mascot — Multi-Window Persistence & Lifecycle Service', () => {
  describe('isValidWebTabUrl', () => {
    it('accepts standard http and https webpage URLs', () => {
      expect(isValidWebTabUrl('https://docs.google.com/document/d/12345/edit')).toBe(true);
      expect(isValidWebTabUrl('https://www.linkedin.com/jobs/view/987654')).toBe(true);
      expect(isValidWebTabUrl('https://boards.greenhouse.io/stripe/jobs/123')).toBe(true);
      expect(isValidWebTabUrl('http://localhost:3000/application')).toBe(true);
      expect(isValidWebTabUrl('http://127.0.0.1:8080')).toBe(true);
    });

    it('rejects browser internal chrome:// and edge:// schemes', () => {
      expect(isValidWebTabUrl('chrome://newtab')).toBe(false);
      expect(isValidWebTabUrl('chrome://extensions')).toBe(false);
      expect(isValidWebTabUrl('chrome://settings')).toBe(false);
      expect(isValidWebTabUrl('chrome-untrusted://terminal')).toBe(false);
      expect(isValidWebTabUrl('edge://settings')).toBe(false);
    });

    it('rejects extension pages, devtools, and special protocols', () => {
      expect(isValidWebTabUrl('chrome-extension://abcdefghijklm/index.html')).toBe(false);
      expect(isValidWebTabUrl('devtools://devtools/bundled/inspector.html')).toBe(false);
      expect(isValidWebTabUrl('about:blank')).toBe(false);
      expect(isValidWebTabUrl('view-source:https://google.com')).toBe(false);
      expect(isValidWebTabUrl('data:text/html,<h1>Hello</h1>')).toBe(false);
      expect(isValidWebTabUrl('javascript:alert(1)')).toBe(false);
    });

    it('handles null, undefined, and non-string inputs safely', () => {
      expect(isValidWebTabUrl(null)).toBe(false);
      expect(isValidWebTabUrl(undefined)).toBe(false);
      expect(isValidWebTabUrl('')).toBe(false);
      expect(isValidWebTabUrl('   ')).toBe(false);
      expect(isValidWebTabUrl(123 as any)).toBe(false);
    });
  });

  describe('isValidWebTab', () => {
    it('returns true for a tab with a positive ID and valid web URL', () => {
      const tab: WebTab = {
        id: 101,
        url: 'https://docs.google.com/document/d/my-resume',
        windowId: 1
      };
      expect(isValidWebTab(tab)).toBe(true);
    });

    it('returns false when tab id is missing or non-positive', () => {
      expect(isValidWebTab({ url: 'https://example.com' })).toBe(false);
      expect(isValidWebTab({ id: 0, url: 'https://example.com' })).toBe(false);
      expect(isValidWebTab({ id: -1, url: 'https://example.com' })).toBe(false);
    });

    it('returns false when tab url is internal or missing', () => {
      expect(isValidWebTab({ id: 102, url: 'chrome://newtab' })).toBe(false);
      expect(isValidWebTab({ id: 103, url: undefined })).toBe(false);
      expect(isValidWebTab({ id: 104, url: '' })).toBe(false);
      expect(isValidWebTab(null)).toBe(false);
      expect(isValidWebTab(undefined)).toBe(false);
    });
  });

  describe('filterWebTabsForInjection', () => {
    it('filters a multi-window tab collection down to injectable web tabs', () => {
      const mockTabs: WebTab[] = [
        // Window 1 tabs
        { id: 1, windowId: 1, url: 'https://docs.google.com/document/d/resume1' },
        { id: 2, windowId: 1, url: 'chrome://newtab' },
        { id: 3, windowId: 1, url: 'https://linkedin.com/jobs/1' },
        // Window 2 tabs
        { id: 4, windowId: 2, url: 'chrome://extensions' },
        { id: 5, windowId: 2, url: 'https://lever.co/jobs/swe' },
        // Window 3 tabs
        { id: 6, windowId: 3, url: 'devtools://devtools/inspector.html' },
        { id: 7, windowId: 3, url: 'https://greenhouse.io/apply' },
        { id: 8, windowId: 3, url: 'about:blank' }
      ];

      const eligible = filterWebTabsForInjection(mockTabs);

      expect(eligible.length).toBe(4);
      expect(eligible.map((t) => t.id)).toEqual([1, 3, 5, 7]);
      expect(eligible.map((t) => t.windowId)).toEqual([1, 1, 2, 3]);
    });

    it('returns empty array when input is empty, null, or undefined', () => {
      expect(filterWebTabsForInjection([])).toEqual([]);
      expect(filterWebTabsForInjection(null)).toEqual([]);
      expect(filterWebTabsForInjection(undefined)).toEqual([]);
    });
  });

  describe('groupTabsByWindow', () => {
    it('groups tabs across multiple browser windows accurately', () => {
      const tabs: WebTab[] = [
        { id: 1, windowId: 10, url: 'https://site-a.com' },
        { id: 2, windowId: 10, url: 'https://site-b.com' },
        { id: 3, windowId: 20, url: 'https://site-c.com' },
        { id: 4, windowId: 30, url: 'https://site-d.com' },
        { id: 5, windowId: 20, url: 'https://site-e.com' }
      ];

      const grouped = groupTabsByWindow(tabs);

      expect(Object.keys(grouped)).toEqual(['10', '20', '30']);
      expect(grouped[10].map((t) => t.id)).toEqual([1, 2]);
      expect(grouped[20].map((t) => t.id)).toEqual([3, 5]);
      expect(grouped[30].map((t) => t.id)).toEqual([4]);
    });

    it('handles tabs with missing windowId by placing them in group -1', () => {
      const tabs: WebTab[] = [{ id: 99, url: 'https://example.com' }];
      const grouped = groupTabsByWindow(tabs);
      expect(grouped[-1]).toBeDefined();
      expect(grouped[-1][0].id).toBe(99);
    });

    it('returns empty object for empty or null inputs', () => {
      expect(groupTabsByWindow([])).toEqual({});
      expect(groupTabsByWindow(null)).toEqual({});
    });
  });

  describe('shouldInjectOnTabUpdate', () => {
    it('returns true when status is complete for a valid web tab', () => {
      const tab: WebTab = { id: 15, url: 'https://docs.google.com/document/d/123' };
      expect(shouldInjectOnTabUpdate({ status: 'complete' }, tab)).toBe(true);
    });

    it('returns false when status is loading', () => {
      const tab: WebTab = { id: 15, url: 'https://docs.google.com/document/d/123' };
      expect(shouldInjectOnTabUpdate({ status: 'loading' }, tab)).toBe(false);
    });

    it('returns false when tab URL is not an injectable web page', () => {
      const internalTab: WebTab = { id: 16, url: 'chrome://settings' };
      expect(shouldInjectOnTabUpdate({ status: 'complete' }, internalTab)).toBe(false);
    });

    it('returns false when changeInfo or tab is null/undefined', () => {
      expect(shouldInjectOnTabUpdate(null, { id: 1, url: 'https://example.com' })).toBe(false);
      expect(shouldInjectOnTabUpdate({ status: 'complete' }, null)).toBe(false);
    });
  });

  describe('injectContentScriptIntoTab', () => {
    it('successfully calls chrome.scripting.executeScript with mascot script', async () => {
      const mockExecuteScript = vi.fn().mockResolvedValue([{ result: true }]);
      const mockScripting = { executeScript: mockExecuteScript };

      const res = await injectContentScriptIntoTab(101, {
        scriptPath: 'content-scripts/content_mascot.js',
        scriptingApi: mockScripting
      });

      expect(res.success).toBe(true);
      expect(res.tabId).toBe(101);
      expect(mockExecuteScript).toHaveBeenCalledWith({
        target: { tabId: 101 },
        files: ['content-scripts/content_mascot.js']
      });
    });

    it('handles script injection failures gracefully without throwing', async () => {
      const mockExecuteScript = vi.fn().mockRejectedValue(new Error('Cannot access contents of url'));
      const mockScripting = { executeScript: mockExecuteScript };

      const res = await injectContentScriptIntoTab(202, {
        scriptingApi: mockScripting
      });

      expect(res.success).toBe(false);
      expect(res.tabId).toBe(202);
      expect(res.error).toContain('Cannot access contents');
    });

    it('returns error when scripting API is not available', async () => {
      const res = await injectContentScriptIntoTab(303, { scriptingApi: null });
      expect(res.success).toBe(false);
      expect(res.error).toContain('API not available');
    });
  });

  describe('injectContentScriptsIntoAllTabs (Multi-Window Injection)', () => {
    it('queries all tabs across all windows and injects mascot into every valid web tab', async () => {
      const allTabs: WebTab[] = [
        { id: 10, windowId: 1, url: 'https://docs.google.com/document/d/resume' },
        { id: 11, windowId: 1, url: 'chrome://newtab' },
        { id: 20, windowId: 2, url: 'https://joinhandshake.com/jobs' },
        { id: 30, windowId: 3, url: 'https://boards.greenhouse.io/stripe' }
      ];

      const mockTabsQuery = vi.fn().mockResolvedValue(allTabs);
      const mockExecuteScript = vi.fn().mockResolvedValue([{ result: true }]);
      const mockScripting = { executeScript: mockExecuteScript };

      const summary = await injectContentScriptsIntoAllTabs({
        tabsQueryApi: mockTabsQuery,
        scriptingApi: mockScripting
      });

      expect(mockTabsQuery).toHaveBeenCalledWith({});
      expect(summary.total).toBe(4);
      expect(summary.eligible).toBe(3);
      expect(summary.injected).toBe(3);
      expect(summary.failed).toBe(0);
      expect(mockExecuteScript).toHaveBeenCalledTimes(3);
      expect(mockExecuteScript).toHaveBeenCalledWith({
        target: { tabId: 10 },
        files: ['content-scripts/content_mascot.js']
      });
      expect(mockExecuteScript).toHaveBeenCalledWith({
        target: { tabId: 20 },
        files: ['content-scripts/content_mascot.js']
      });
      expect(mockExecuteScript).toHaveBeenCalledWith({
        target: { tabId: 30 },
        files: ['content-scripts/content_mascot.js']
      });
    });

    it('accurately tracks failures when certain tabs cannot be injected', async () => {
      const allTabs: WebTab[] = [
        { id: 10, windowId: 1, url: 'https://docs.google.com' },
        { id: 20, windowId: 2, url: 'https://linkedin.com' }
      ];

      const mockTabsQuery = vi.fn().mockResolvedValue(allTabs);
      const mockExecuteScript = vi.fn()
        .mockResolvedValueOnce([{ result: true }])
        .mockRejectedValueOnce(new Error('Frame was removed'));
      const mockScripting = { executeScript: mockExecuteScript };

      const summary = await injectContentScriptsIntoAllTabs({
        tabsQueryApi: mockTabsQuery,
        scriptingApi: mockScripting
      });

      expect(summary.eligible).toBe(2);
      expect(summary.injected).toBe(1);
      expect(summary.failed).toBe(1);
    });
  });

  describe('handleWindowCreated', () => {
    it('queries tabs in the newly created window and injects mascot script', async () => {
      const windowTabs: WebTab[] = [
        { id: 50, windowId: 5, url: 'https://indeed.com/jobs' },
        { id: 51, windowId: 5, url: 'chrome://newtab' }
      ];

      const mockTabsQuery = vi.fn().mockResolvedValue(windowTabs);
      const mockExecuteScript = vi.fn().mockResolvedValue([{ result: true }]);
      const mockScripting = { executeScript: mockExecuteScript };

      const summary = await handleWindowCreated(
        { id: 5 },
        { tabsQueryApi: mockTabsQuery, scriptingApi: mockScripting }
      );

      expect(mockTabsQuery).toHaveBeenCalledWith({ windowId: 5 });
      expect(summary.eligible).toBe(1);
      expect(summary.injected).toBe(1);
      expect(mockExecuteScript).toHaveBeenCalledWith({
        target: { tabId: 50 },
        files: ['content-scripts/content_mascot.js']
      });
    });

    it('ignores invalid window IDs safely', async () => {
      const summary = await handleWindowCreated({ id: -1 });
      expect(summary.total).toBe(0);
      expect(summary.injected).toBe(0);
    });
  });

  describe('handleWindowFocusChanged', () => {
    it('queries active tab in the focused window and ensures mascot is injected', async () => {
      const focusedActiveTabs: WebTab[] = [
        { id: 88, windowId: 8, active: true, url: 'https://docs.google.com/document/d/test' }
      ];

      const mockTabsQuery = vi.fn().mockResolvedValue(focusedActiveTabs);
      const mockExecuteScript = vi.fn().mockResolvedValue([{ result: true }]);
      const mockScripting = { executeScript: mockExecuteScript };

      const summary = await handleWindowFocusChanged(8, {
        tabsQueryApi: mockTabsQuery,
        scriptingApi: mockScripting
      });

      expect(mockTabsQuery).toHaveBeenCalledWith({ windowId: 8, active: true });
      expect(summary.injected).toBe(1);
      expect(mockExecuteScript).toHaveBeenCalledWith({
        target: { tabId: 88 },
        files: ['content-scripts/content_mascot.js']
      });
    });

    it('ignores WINDOW_ID_NONE (-1) when focus leaves all browser windows', async () => {
      const mockTabsQuery = vi.fn();
      const summary = await handleWindowFocusChanged(-1, {
        tabsQueryApi: mockTabsQuery
      });

      expect(mockTabsQuery).not.toHaveBeenCalled();
      expect(summary.total).toBe(0);
    });
  });

  describe('handleTabCreated & handleTabUpdated', () => {
    it('handleTabCreated injects script if tab already has a valid web URL', async () => {
      const tab: WebTab = { id: 77, url: 'https://lever.co/job/1' };
      const mockExecuteScript = vi.fn().mockResolvedValue([{ result: true }]);

      const res = await handleTabCreated(tab, {
        scriptingApi: { executeScript: mockExecuteScript }
      });

      expect(res).not.toBeNull();
      expect(res?.success).toBe(true);
      expect(mockExecuteScript).toHaveBeenCalled();
    });

    it('handleTabCreated returns null for blank or internal tabs', async () => {
      const tab: WebTab = { id: 78, url: 'chrome://newtab' };
      const res = await handleTabCreated(tab);
      expect(res).toBeNull();
    });

    it('handleTabUpdated injects script when status transitions to complete', async () => {
      const tab: WebTab = { id: 99, url: 'https://greenhouse.io/job/swe' };
      const mockExecuteScript = vi.fn().mockResolvedValue([{ result: true }]);

      const res = await handleTabUpdated(99, { status: 'complete' }, tab, {
        scriptingApi: { executeScript: mockExecuteScript }
      });

      expect(res).not.toBeNull();
      expect(res?.success).toBe(true);
      expect(mockExecuteScript).toHaveBeenCalledWith({
        target: { tabId: 99 },
        files: ['content-scripts/content_mascot.js']
      });
    });

    it('handleTabUpdated ignores updates with loading status', async () => {
      const tab: WebTab = { id: 99, url: 'https://greenhouse.io/job/swe' };
      const res = await handleTabUpdated(99, { status: 'loading' }, tab);
      expect(res).toBeNull();
    });
  });

  describe('broadcastToAllTabs (Cross-Window Broadcasting)', () => {
    it('broadcasts messages across all open tabs in all windows', async () => {
      const allTabs: WebTab[] = [
        { id: 101, windowId: 1, url: 'https://site-1.com' },
        { id: 102, windowId: 2, url: 'https://site-2.com' },
        { id: 103, windowId: 3, url: 'https://site-3.com' }
      ];

      const mockTabsQuery = vi.fn().mockResolvedValue(allTabs);
      const mockSendMessage = vi.fn().mockResolvedValue({ status: 'ok' });

      const result = await broadcastToAllTabs(
        { type: 'NOTIFY_NEW_JOBS', count: 5 },
        { tabsQueryApi: mockTabsQuery, tabsSendMessageApi: mockSendMessage }
      );

      expect(mockTabsQuery).toHaveBeenCalledWith({});
      expect(result.total).toBe(3);
      expect(result.sent).toBe(3);
      expect(result.failed).toBe(0);
      expect(mockSendMessage).toHaveBeenCalledTimes(3);
      expect(mockSendMessage).toHaveBeenCalledWith(101, { type: 'NOTIFY_NEW_JOBS', count: 5 });
      expect(mockSendMessage).toHaveBeenCalledWith(102, { type: 'NOTIFY_NEW_JOBS', count: 5 });
      expect(mockSendMessage).toHaveBeenCalledWith(103, { type: 'NOTIFY_NEW_JOBS', count: 5 });
    });

    it('tolerates individual tab broadcast delivery failures without interrupting other tabs', async () => {
      const allTabs: WebTab[] = [
        { id: 101, windowId: 1 },
        { id: 102, windowId: 2 },
        { id: 103, windowId: 3 }
      ];

      const mockTabsQuery = vi.fn().mockResolvedValue(allTabs);
      const mockSendMessage = vi.fn()
        .mockResolvedValueOnce({ status: 'ok' })
        .mockRejectedValueOnce(new Error('Could not establish connection'))
        .mockResolvedValueOnce({ status: 'ok' });

      const result = await broadcastToAllTabs(
        { type: 'UPDATE_JOBS_COUNT', count: 0 },
        { tabsQueryApi: mockTabsQuery, tabsSendMessageApi: mockSendMessage }
      );

      expect(result.total).toBe(3);
      expect(result.sent).toBe(2);
      expect(result.failed).toBe(1);
    });
  });

  describe('Cross-Window Mascot Position Clamping Integration', () => {
    it('safely clamps position coordinates when synced to smaller resolution window', () => {
      // User dragged Hacky to bottom-right corner on 4K monitor (3840x2160)
      const bigScreenPos = { x: 3700, y: 2050 };

      // Another window is on a 13" laptop screen (1440x900)
      const laptopViewport = { width: 1440, height: 900 };
      const mascotSize = { width: 76, height: 76 };
      const margin = 12;

      const clampedPos = clampMascotPosition(bigScreenPos, laptopViewport, mascotSize, margin);

      // Must be safely clamped inside laptop screen bounds:
      // maxX = 1440 - 76 - 12 = 1352
      // maxY = 900 - 76 - 12 = 812
      expect(clampedPos.x).toBe(1352);
      expect(clampedPos.y).toBe(812);
    });

    it('preserves valid coordinates when syncing to larger resolution window', () => {
      const laptopPos = { x: 500, y: 400 };
      const bigScreenViewport = { width: 3840, height: 2160 };

      const clampedPos = clampMascotPosition(laptopPos, bigScreenViewport);

      expect(clampedPos).toEqual({ x: 500, y: 400 });
    });
  });
});
