// Multi-Window Tab Lifecycle & Mascot Synchronization Service
export interface WebTab {
  id?: number;
  url?: string;
  windowId?: number;
  active?: boolean;
  status?: string;
  title?: string;
  [key: string]: any;
}

export interface InjectionResult {
  tabId: number;
  success: boolean;
  error?: string;
}

export interface MultiWindowInjectionSummary {
  total: number;
  eligible: number;
  injected: number;
  failed: number;
  results: InjectionResult[];
}

export const RESTRICTED_SCHEMES = [
  'chrome:',
  'chrome-extension:',
  'chrome-untrusted:',
  'devtools:',
  'edge:',
  'about:',
  'view-source:',
  'data:',
  'javascript:',
  'chrome-search:'
];

/**
 * Checks if a given URL is a valid, scriptable web page (http:// or https://).
 * Rejects browser internal pages, developer tools, extensions, and blank tabs.
 */
export function isValidWebTabUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;

  const trimmed = url.trim();
  if (!trimmed) return false;

  const lower = trimmed.toLowerCase();

  for (const scheme of RESTRICTED_SCHEMES) {
    if (lower.startsWith(scheme)) {
      return false;
    }
  }

  // Must be an HTTP or HTTPS web page
  return lower.startsWith('http://') || lower.startsWith('https://');
}

/**
 * Checks if a Chrome tab is eligible for content script injection.
 */
export function isValidWebTab(tab?: WebTab | null): boolean {
  if (!tab || typeof tab !== 'object') return false;
  if (typeof tab.id !== 'number' || tab.id <= 0) return false;
  return isValidWebTabUrl(tab.url);
}

/**
 * Filters an array of Chrome tabs across any number of windows down to injectable web tabs.
 */
export function filterWebTabsForInjection<T extends WebTab>(tabs?: T[] | null): T[] {
  if (!Array.isArray(tabs)) return [];
  return tabs.filter((tab): tab is T => isValidWebTab(tab));
}

/**
 * Groups a collection of tabs by their windowId.
 */
export function groupTabsByWindow<T extends WebTab>(tabs?: T[] | null): Record<number, T[]> {
  if (!Array.isArray(tabs)) return {};
  const groups: Record<number, T[]> = {};

  for (const tab of tabs) {
    const winId = typeof tab.windowId === 'number' ? tab.windowId : -1;
    if (!groups[winId]) {
      groups[winId] = [];
    }
    groups[winId].push(tab);
  }

  return groups;
}

/**
 * Determines whether a tab update event should trigger mascot injection.
 * Triggers when the navigation/load status transitions to 'complete' for a valid web tab.
 */
export function shouldInjectOnTabUpdate(
  changeInfo?: { status?: string; url?: string } | null,
  tab?: WebTab | null
): boolean {
  if (!changeInfo || changeInfo.status !== 'complete') {
    return false;
  }
  return isValidWebTab(tab);
}

/**
 * Injects a script file into a specific tab using chrome.scripting.executeScript.
 */
export async function injectContentScriptIntoTab(
  tabId: number,
  options?: {
    scriptPath?: string;
    scriptingApi?: any;
  }
): Promise<InjectionResult> {
  const scriptPath = options?.scriptPath || 'content-scripts/content_mascot.js';
  const scripting = options?.scriptingApi || (typeof chrome !== 'undefined' ? chrome.scripting : null);

  if (!scripting || typeof scripting.executeScript !== 'function') {
    return {
      tabId,
      success: false,
      error: 'chrome.scripting API not available'
    };
  }

  try {
    await scripting.executeScript({
      target: { tabId },
      files: [scriptPath]
    });
    return { tabId, success: true };
  } catch (err: any) {
    return {
      tabId,
      success: false,
      error: err?.message || String(err)
    };
  }
}

/**
 * Queries all tabs across all windows and injects the mascot content script into every eligible tab.
 */
export async function injectContentScriptsIntoAllTabs(
  options?: {
    scriptPath?: string;
    tabsQueryApi?: any;
    scriptingApi?: any;
  }
): Promise<MultiWindowInjectionSummary> {
  const queryApi = options?.tabsQueryApi || (typeof chrome !== 'undefined' && chrome.tabs?.query ? chrome.tabs.query : null);
  const scriptPath = options?.scriptPath || 'content-scripts/content_mascot.js';

  if (!queryApi) {
    return { total: 0, eligible: 0, injected: 0, failed: 0, results: [] };
  }

  try {
    const tabs: WebTab[] = await queryApi({});
    const total = tabs.length;
    const eligibleTabs = filterWebTabsForInjection(tabs);
    const results: InjectionResult[] = [];

    for (const tab of eligibleTabs) {
      if (tab.id) {
        const res = await injectContentScriptIntoTab(tab.id, {
          scriptPath,
          scriptingApi: options?.scriptingApi
        });
        results.push(res);
      }
    }

    const injected = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return {
      total,
      eligible: eligibleTabs.length,
      injected,
      failed,
      results
    };
  } catch (err) {
    return { total: 0, eligible: 0, injected: 0, failed: 0, results: [] };
  }
}

/**
 * Handles chrome.windows.onCreated event. Injects mascot script into tabs in the new window.
 */
export async function handleWindowCreated(
  window: { id?: number },
  options?: {
    tabsQueryApi?: any;
    scriptingApi?: any;
    scriptPath?: string;
  }
): Promise<MultiWindowInjectionSummary> {
  if (typeof window.id !== 'number' || window.id <= 0) {
    return { total: 0, eligible: 0, injected: 0, failed: 0, results: [] };
  }

  const queryApi = options?.tabsQueryApi || (typeof chrome !== 'undefined' && chrome.tabs?.query ? chrome.tabs.query : null);
  if (!queryApi) {
    return { total: 0, eligible: 0, injected: 0, failed: 0, results: [] };
  }

  try {
    const tabs: WebTab[] = await queryApi({ windowId: window.id });
    const eligible = filterWebTabsForInjection(tabs);
    const results: InjectionResult[] = [];

    for (const tab of eligible) {
      if (tab.id) {
        const res = await injectContentScriptIntoTab(tab.id, {
          scriptPath: options?.scriptPath,
          scriptingApi: options?.scriptingApi
        });
        results.push(res);
      }
    }

    return {
      total: tabs.length,
      eligible: eligible.length,
      injected: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results
    };
  } catch {
    return { total: 0, eligible: 0, injected: 0, failed: 0, results: [] };
  }
}

/**
 * Handles chrome.windows.onFocusChanged event. Ensures the active tab in the focused window is injected.
 */
export async function handleWindowFocusChanged(
  windowId: number,
  options?: {
    tabsQueryApi?: any;
    scriptingApi?: any;
    scriptPath?: string;
  }
): Promise<MultiWindowInjectionSummary> {
  // Ignore unfocused or window closed (-1 / chrome.windows.WINDOW_ID_NONE)
  if (typeof windowId !== 'number' || windowId <= 0) {
    return { total: 0, eligible: 0, injected: 0, failed: 0, results: [] };
  }

  const queryApi = options?.tabsQueryApi || (typeof chrome !== 'undefined' && chrome.tabs?.query ? chrome.tabs.query : null);
  if (!queryApi) {
    return { total: 0, eligible: 0, injected: 0, failed: 0, results: [] };
  }

  try {
    const activeTabs: WebTab[] = await queryApi({ windowId, active: true });
    const eligible = filterWebTabsForInjection(activeTabs);
    const results: InjectionResult[] = [];

    for (const tab of eligible) {
      if (tab.id) {
        const res = await injectContentScriptIntoTab(tab.id, {
          scriptPath: options?.scriptPath,
          scriptingApi: options?.scriptingApi
        });
        results.push(res);
      }
    }

    return {
      total: activeTabs.length,
      eligible: eligible.length,
      injected: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results
    };
  } catch {
    return { total: 0, eligible: 0, injected: 0, failed: 0, results: [] };
  }
}

/**
 * Handles chrome.tabs.onCreated event. Injects script if URL is already available and valid.
 */
export async function handleTabCreated(
  tab: WebTab,
  options?: {
    scriptingApi?: any;
    scriptPath?: string;
  }
): Promise<InjectionResult | null> {
  if (!isValidWebTab(tab) || !tab.id) {
    return null;
  }
  return injectContentScriptIntoTab(tab.id, {
    scriptPath: options?.scriptPath,
    scriptingApi: options?.scriptingApi
  });
}

/**
 * Handles chrome.tabs.onUpdated event. Injects script when status is 'complete' and URL is valid.
 */
export async function handleTabUpdated(
  tabId: number,
  changeInfo: { status?: string; url?: string },
  tab: WebTab,
  options?: {
    scriptingApi?: any;
    scriptPath?: string;
  }
): Promise<InjectionResult | null> {
  if (!shouldInjectOnTabUpdate(changeInfo, tab)) {
    return null;
  }
  return injectContentScriptIntoTab(tabId, {
    scriptPath: options?.scriptPath,
    scriptingApi: options?.scriptingApi
  });
}

/**
 * Broadcasts a message to all tabs across all open windows.
 */
export async function broadcastToAllTabs(
  message: any,
  options?: {
    tabsQueryApi?: any;
    tabsSendMessageApi?: any;
  }
): Promise<{ total: number; sent: number; failed: number }> {
  const queryApi = options?.tabsQueryApi || (typeof chrome !== 'undefined' && chrome.tabs?.query ? chrome.tabs.query : null);
  const sendApi = options?.tabsSendMessageApi || (typeof chrome !== 'undefined' && chrome.tabs?.sendMessage ? chrome.tabs.sendMessage : null);

  if (!queryApi) {
    return { total: 0, sent: 0, failed: 0 };
  }

  try {
    const tabs: WebTab[] = await queryApi({});
    let sent = 0;
    let failed = 0;

    for (const tab of tabs) {
      if (tab.id) {
        try {
          if (sendApi) {
            await sendApi(tab.id, message);
            sent++;
          }
        } catch {
          // Tab may not have content script mounted
          failed++;
        }
      }
    }

    return { total: tabs.length, sent, failed };
  } catch {
    return { total: 0, sent: 0, failed: 0 };
  }
}
