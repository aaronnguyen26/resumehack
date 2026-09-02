// Chrome Extension Background Service Worker (Manifest V3)
import { GitHubTrackerService } from '../services/github-tracker.js';
import { htmlToPlainText, extractGoogleDocId } from '../services/precision-extractor.js';
import {
  injectContentScriptsIntoAllTabs,
  injectContentScriptIntoTab,
  handleWindowCreated,
  handleWindowFocusChanged,
  handleTabCreated,
  handleTabUpdated,
  broadcastToAllTabs,
  isValidWebTab
} from '../services/multiwindow-mascot.js';
import { CdpDocsEditorService } from '../services/cdp-docs-editor.js';
import { GoogleDocsService } from '../services/google-docs.js';
import { getStoredSettings, getGoogleAccessToken, refreshGoogleAccessToken } from '../services/storage.js';

const cdpEditor = new CdpDocsEditorService();
const googleDocsService = new GoogleDocsService();

const ALARM_NAME = 'resumehack-daily-sync';
const ALARM_FRESHNESS_HEARTBEAT = 'resumehack-freshness-heartbeat';
const ALARM_FRESHNESS_POLL = 'resumehack-freshness-poll';

// ── Offscreen Document Guardian ──────────────────────────────────────────────
let creatingOffscreenPromise: Promise<void> | null = null;

export async function ensureOffscreenDocument(): Promise<void> {
  if (!chrome.offscreen) return;
  try {
    const hasDoc = await chrome.offscreen.hasDocument();
    if (hasDoc) return;

    if (creatingOffscreenPromise) {
      await creatingOffscreenPromise;
      return;
    }

    creatingOffscreenPromise = chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['WORKERS' as any],
      justification: 'Maintain real-time SSE push connection for sub-5-second job freshness notifications',
    });

    await creatingOffscreenPromise;
    console.log('[ResumeHack] Offscreen SSE document bridge created.');
  } catch (err: any) {
    console.warn('[ResumeHack] Note creating offscreen document:', err?.message);
  } finally {
    creatingOffscreenPromise = null;
  }
}

// ── Setup: run on install and every cold start ──────────────────────────────
chrome.runtime.onInstalled.addListener(async () => {
  console.log('[ResumeHack] Extension installed/updated.');

  if (chrome.sidePanel?.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
      .catch((e: any) => console.log('[ResumeHack] Side panel setup note:', e?.message));
  }

  // Globally enable side panel for all windows so it always opens on the side
  if (chrome.sidePanel?.setOptions) {
    chrome.sidePanel.setOptions({ path: 'index.html', enabled: true }).catch(() => {});
  }

  await ensureDailyAlarm();
  await ensureFreshnessAlarms();
  await ensureOffscreenDocument();

  // Inject Hacky mascot content script into all tabs across all existing browser windows
  try {
    const injectionSummary = await injectContentScriptsIntoAllTabs();
    console.log(`[ResumeHack] Initial multi-window injection complete: ${injectionSummary.injected}/${injectionSummary.eligible} tabs injected across windows.`);
  } catch (err) {
    console.debug('[ResumeHack] Multi-window injection on install error:', err);
  }

  // Run an immediate sync on install so the user has fresh data right away
  runDailySync();
});

// Also ensure alarm, offscreen, and mascot injection survive service worker restarts / browser startup
chrome.runtime.onStartup.addListener(async () => {
  await ensureDailyAlarm();
  await ensureFreshnessAlarms();
  await ensureOffscreenDocument();

  if (chrome.sidePanel?.setOptions) {
    chrome.sidePanel.setOptions({ path: 'index.html', enabled: true }).catch(() => {});
  }
  if (chrome.sidePanel?.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
  }
  try {
    await injectContentScriptsIntoAllTabs();
  } catch (err) {
    console.debug('[ResumeHack] Multi-window injection on startup error:', err);
  }
});

// Top-level service worker execution check for offscreen bridge
ensureOffscreenDocument().catch(() => {});

// ── Multi-Window & Tab Lifecycle Event Listeners ─────────────────────────────
// 1. Newly created window -> inject mascot into its tabs
if (chrome.windows?.onCreated) {
  chrome.windows.onCreated.addListener(async (window) => {
    try {
      await handleWindowCreated(window);
    } catch (err) {
      console.debug('[ResumeHack] Error handling window created:', err);
    }
  });
}

// 2. Window focus changed -> ensure focused window's active tab has mascot active
if (chrome.windows?.onFocusChanged) {
  chrome.windows.onFocusChanged.addListener(async (windowId) => {
    try {
      if (windowId !== chrome.windows.WINDOW_ID_NONE) {
        await handleWindowFocusChanged(windowId);
      }
    } catch (err) {
      console.debug('[ResumeHack] Error handling window focus changed:', err);
    }
  });
}

// 3. Newly created tab -> inject mascot if valid
if (chrome.tabs?.onCreated) {
  chrome.tabs.onCreated.addListener(async (tab) => {
    try {
      if (tab?.id && isValidWebTab(tab)) {
        await handleTabCreated(tab);
      }
    } catch (err) {
      console.debug('[ResumeHack] Error handling tab created:', err);
    }
  });
}

// 4. Tab updated -> inject mascot when status is 'complete' on valid web pages
if (chrome.tabs?.onUpdated) {
  chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    try {
      if (changeInfo.status === 'complete' && tab && isValidWebTab(tab)) {
        await handleTabUpdated(tabId, changeInfo, tab);
      }
    } catch (err) {
      console.debug('[ResumeHack] Error handling tab updated:', err);
    }
  });
}

async function ensureDailyAlarm(): Promise<void> {
  const existing = await chrome.alarms.get(ALARM_NAME);
  if (!existing) {
    chrome.alarms.create(ALARM_NAME, {
      delayInMinutes: 5,          // first fire 5 min after startup
      periodInMinutes: 1440,      // then every 24 hours
    });
    console.log('[ResumeHack] Daily sync alarm created.');
  }
}

async function ensureFreshnessAlarms(): Promise<void> {
  const heartbeat = await chrome.alarms.get(ALARM_FRESHNESS_HEARTBEAT);
  if (!heartbeat) {
    chrome.alarms.create(ALARM_FRESHNESS_HEARTBEAT, {
      delayInMinutes: 1,
      periodInMinutes: 5,
    });
  }

  const poll = await chrome.alarms.get(ALARM_FRESHNESS_POLL);
  if (!poll) {
    chrome.alarms.create(ALARM_FRESHNESS_POLL, {
      delayInMinutes: 5,
      periodInMinutes: 5,
    });
  }
}

// ── Alarm handler ────────────────────────────────────────────────────────────
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARM_NAME) {
    await runDailySync();
  } else if (alarm.name === ALARM_FRESHNESS_HEARTBEAT) {
    await ensureOffscreenDocument();
  } else if (alarm.name === ALARM_FRESHNESS_POLL) {
    await pollFreshJobsFallback();
  }
});

async function pollFreshJobsFallback(): Promise<void> {
  try {
    const res = await fetch('http://localhost:3001/api/jobs?fresh=true');
    if (!res.ok) return;
    const data = await res.json();
    if (Array.isArray(data?.jobs) && data.jobs.length > 0) {
      console.log(`[ResumeHack] Polled ${data.jobs.length} fresh jobs via fallback.`);
      chrome.action.setBadgeText({ text: '⚡' });
      chrome.action.setBadgeBackgroundColor({ color: '#3B82F6' });
    }
  } catch (err) {
    console.debug('[ResumeHack] Fallback fresh job poll note:', err);
  }
}

async function runDailySync(): Promise<void> {
  console.log('[ResumeHack] Running daily job sync...');
  try {
    const tracker = new GitHubTrackerService();
    const result = await tracker.syncFromGitHub();

    console.log(`[ResumeHack] Sync complete: ${result.jobsCount} jobs, ${result.newJobsCount} new.`);

    // Extract top companies for rich notification previews
    const sampleCompanies = Array.from(new Set(result.jobs.map((j) => j.company)))
      .filter(Boolean)
      .slice(0, 3);

    const alertCount = result.newJobsCount > 0 ? result.newJobsCount : result.jobsCount;

    // Show badge with count of new jobs
    if (result.newJobsCount > 0) {
      chrome.action.setBadgeText({ text: result.newJobsCount.toString() });
      chrome.action.setBadgeBackgroundColor({ color: '#10B981' }); // Emerald
    }

    // Broadcast proactive notification alert to Hacky mascot across all open windows & tabs
    await broadcastToAllTabs({
      type: 'NOTIFY_NEW_JOBS',
      count: alertCount,
      totalCount: result.jobsCount,
      companies: sampleCompanies,
      headline: `🔥 ${alertCount} New 2026 Internships Added (${sampleCompanies.join(', ') || 'Stripe, Google, OpenAI'})!`,
      timestamp: Date.now()
    });
  } catch (err) {
    console.error('[ResumeHack] Daily sync failed:', err);
  }
}

// ── Toolbar icon click → open side panel on the side ─────────────────────────
if (chrome.action?.onClicked) {
  chrome.action.onClicked.addListener((tab) => {
    if (tab?.id && chrome.sidePanel?.open) {
      chrome.sidePanel.open({ tabId: tab.id })
        .catch(() => {
          if (tab.windowId) {
            chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => {});
          }
        });
    } else if (tab?.windowId && chrome.sidePanel?.open) {
      chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => {});
    }
  });
}

// ── Message listener ─────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  try {
    if (message.type === 'OFFSCREEN_SSE_EVENT') {
      const payload = message.payload;
      console.log('[ResumeHack SW] Processing real-time SSE job event:', payload);

      if (payload?.title && payload?.companyName) {
        // Update badge
        chrome.action.setBadgeText({ text: '⚡' });
        chrome.action.setBadgeBackgroundColor({ color: '#10B981' });

        // Save fresh job to local storage cache for discovery feed
        chrome.storage.local.get(['ats_fresh_jobs'], (res) => {
          const freshList = Array.isArray(res.ats_fresh_jobs) ? res.ats_fresh_jobs : [];
          const updated = [
            {
              id: payload.jobId,
              atsJobId: payload.atsJobId,
              company: payload.companyName,
              title: payload.title,
              location: payload.location || 'Remote / Hybrid',
              jobUrl: payload.jobUrl,
              category: payload.category || 'Software Engineering',
              type: payload.jobType || 'Internship',
              postedDate: 'Just now (< 2m ago)',
              isFreshAts: true,
              receivedAt: Date.now(),
            },
            ...freshList.filter((j: any) => j.atsJobId !== payload.atsJobId),
          ].slice(0, 50);

          chrome.storage.local.set({ ats_fresh_jobs: updated });
        });

        // Broadcast real-time Hacky alert to all browser tabs
        broadcastToAllTabs({
          type: 'NOTIFY_NEW_JOBS',
          count: 1,
          totalCount: 1,
          companies: [payload.companyName],
          headline: `⚡ Fresh Job Alert: ${payload.companyName} just posted "${payload.title}"!`,
          jobUrl: payload.jobUrl,
          isFreshAts: true,
          timestamp: Date.now(),
        }).catch(() => {});
      }

      sendResponse({ status: 'ok' });
      return true;
    }

    if (message.type === 'JOB_SCRAPED') {
      chrome.storage.local.set({ latestScrapedJob: message.data }, () => sendResponse({ status: 'ok' }));
      return true;
    }

    if (message.type === 'SCREEN_RESUME_DETECTED' || message.type === 'DOCS_DETECTED') {
      chrome.storage.local.set({ activeScreenResume: message.data, activeGoogleDoc: message.data }, () =>
        sendResponse({ status: 'ok' })
      );
      return true;
    }

    if (message.type === 'SCREEN_SELECTION_UPDATED') {
      chrome.storage.local.set({ activeScreenSelection: message.data }, () => sendResponse({ status: 'ok' }));
      return true;
    }

    if (message.type === 'OPEN_SIDEPANEL') {
      const targetTabType = message.tab || 'match'; // e.g. 'discovery', 'match', 'tracker'
      const autoScan = Boolean(message.autoScan);

      if (targetTabType) {
        chrome.storage.local.set({ resumehack_active_tab: targetTabType }).catch(() => {});
      }
      if (autoScan) {
        chrome.storage.local.set({ resumehack_auto_scan: true }).catch(() => {});
      }

      const senderTabId = _sender?.tab?.id;
      const senderWindowId = _sender?.tab?.windowId;

      const handleOpen = async () => {
        try {
          // 1. If senderTabId is available and sidePanel API is present, open on the side for that tab
          if (senderTabId && chrome.sidePanel?.open) {
            try {
              await chrome.sidePanel.open({ tabId: senderTabId });
              sendResponse({ status: 'opened', target: 'senderTab', tabId: senderTabId });
              return;
            } catch (tabErr) {
              console.debug('[ResumeHack] sidePanel.open tab note:', tabErr);
            }
          }

          // 2. If senderWindowId is available, open on the side for that window
          if (senderWindowId && chrome.sidePanel?.open) {
            try {
              await chrome.sidePanel.open({ windowId: senderWindowId });
              sendResponse({ status: 'opened', target: 'senderWindow', windowId: senderWindowId });
              return;
            } catch (winErr) {
              console.debug('[ResumeHack] sidePanel.open window note:', winErr);
            }
          }

          // 3. Fallback: query active tab in the current window and open side panel on the side
          chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
            const activeTab = tabs[0];
            if (activeTab?.id && chrome.sidePanel?.open) {
              try {
                await chrome.sidePanel.open({ tabId: activeTab.id });
                sendResponse({ status: 'opened', target: 'activeTab', tabId: activeTab.id });
                return;
              } catch {}
            }
            if (activeTab?.windowId && chrome.sidePanel?.open) {
              try {
                await chrome.sidePanel.open({ windowId: activeTab.windowId });
                sendResponse({ status: 'opened', target: 'activeWindow', windowId: activeTab.windowId });
                return;
              } catch {}
            }
            sendResponse({ status: 'opened', target: 'sidepanel' });
          });
        } catch (err: any) {
          console.debug('[ResumeHack] OPEN_SIDEPANEL error:', err?.message);
          sendResponse({ status: 'error', error: err?.message });
        }
      };

      handleOpen();
      return true;
    }

    // ── Close Side Panel Handler (Auto-close once STAR suggestions are live on doc) ──
    if (message.type === 'CLOSE_SIDEPANEL') {
      const senderWindowId = _sender?.tab?.windowId;
      const senderTabId = _sender?.tab?.id;

      const performClose = async () => {
        try {
          const sidePanelAny = chrome.sidePanel as any;
          if (sidePanelAny && typeof sidePanelAny.close === 'function') {
            if (senderWindowId) {
              await sidePanelAny.close({ windowId: senderWindowId });
            } else if (senderTabId) {
              await sidePanelAny.close({ tabId: senderTabId });
            } else {
              const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
              if (activeTab?.windowId) {
                await sidePanelAny.close({ windowId: activeTab.windowId });
              } else if (activeTab?.id) {
                await sidePanelAny.close({ tabId: activeTab.id });
              }
            }
          }
        } catch (err: any) {
          console.debug('[ResumeHack] sidePanel close note:', err?.message);
        }
      };

      performClose().then(() => sendResponse({ status: 'closed' }));
      return true;
    }

    // Clear new-jobs badge when user opens Discovery tab and broadcast to all windows
    if (message.type === 'DISCOVERY_VIEWED') {
      chrome.action.setBadgeText({ text: '' });
      chrome.storage.local.set({ resumehack_new_jobs_count: 0 }, () => {
        broadcastToAllTabs({ type: 'UPDATE_JOBS_COUNT', count: 0 }).catch(() => {});
        sendResponse({ status: 'ok' });
      });
      return true;
    }

    // Broadcast mascot message to all windows/tabs on request
    if (message.type === 'BROADCAST_TO_ALL_TABS' || message.type === 'BROADCAST_MASCOT_MESSAGE') {
      const payload = message.payload || message.data || message;
      broadcastToAllTabs(payload).then((summary) => sendResponse({ status: 'ok', summary }));
      return true;
    }

    // Sync mascot state across windows on request
    if (message.type === 'SYNC_MASCOT_STATE') {
      if (message.state) {
        chrome.storage.local.set({ resumehack_mascot_prefs: message.state }, () => {
          broadcastToAllTabs({ type: 'SYNC_MASCOT_STATE', state: message.state }).catch(() => {});
          sendResponse({ status: 'ok' });
        });
        return true;
      }
    }

    if (message.type === 'SYNC_GITHUB_JOBS' || message.type === 'TRIGGER_JOB_ALERT') {
      runDailySync().then(() => sendResponse({ status: 'ok' }));
      return true;
    }

    // ── mobilebasic fetch — no API key, uses existing Google session ─────────
    if (message.type === 'FETCH_MOBILEBASIC') {
      const docId: string = message.docId;
      if (!docId) { sendResponse({ error: 'no docId' }); return false; }

      // Fetch Google's own plain-HTML view — works as long as user is signed in
      const url = `https://docs.google.com/document/d/${docId}/mobilebasic`;
      fetch(url, {
        credentials: 'include',     // send existing Google session cookies
        headers: { 'Accept': 'text/html' },
      })
        .then(async (res) => {
          if (!res.ok) {
            sendResponse({ error: `HTTP ${res.status}` });
            return;
          }
          const html = await res.text();
          // Extract the full document body content
          const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
          const bodyHtml = bodyMatch ? bodyMatch[1] : html;
          const text = htmlToPlainText(bodyHtml);
          sendResponse({ text });
        })
        .catch((err) => {
          console.debug('[ResumeHack] mobilebasic fetch failed:', err?.message);
          sendResponse({ error: err?.message || 'fetch failed' });
        });
      return true; // keep message channel open for async response
    }

    // ── Direct Structural REST API Google Docs Apply Handler ─────────────────
    if (
      message.type === 'APPLY_DIFFS_TO_DOC' ||
      message.type === 'CDP_APPLY_DIFFS_TO_DOC' ||
      message.type === 'DIRECT_APPLY_DIFFS_TO_DOC' ||
      message.type === 'IN_DOC_APPLY_CLICKED' ||
      message.type === 'APPLY_LAYOUT_FIX_TO_DOC'
    ) {
      (async () => {
        const layoutIssues = message.layoutIssues || message.payload?.layoutIssues || (message.layoutIssue ? [message.layoutIssue] : []);
        const diffs = message.diffs || message.acceptedDiffs || message.data?.acceptedDiffs || [];

        console.log('[ResumeHack SW] ── Apply Request Received ──', {
          type: message.type,
          docId: message.docId,
          diffsCount: diffs.length,
          layoutIssuesCount: layoutIssues.length,
        });

        let tabId: number | undefined = message.tabId || _sender?.tab?.id;
        if (!tabId && chrome.tabs?.query) {
          try {
            const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (activeTab?.id) tabId = activeTab.id;
          } catch (tabErr) {
            console.debug('[ResumeHack SW] Active tab query note:', tabErr);
          }
        }

        if (diffs.length === 0 && layoutIssues.length === 0) {
          console.warn('[ResumeHack SW] No diffs or layout issues provided in apply message');
          return { success: true, appliedCount: 0, details: ['No changes provided'] };
        }

        let docId: string | undefined = message.docId || (message.data?.url ? extractGoogleDocId(message.data.url) || undefined : undefined);
        if (!docId && tabId && chrome.tabs?.get) {
          try {
            const tabInfo = await chrome.tabs.get(tabId);
            if (tabInfo?.url) docId = extractGoogleDocId(tabInfo.url) || undefined;
          } catch {}
        }

        // Check if there are any Google Doc tabs open
        if (!docId && chrome.tabs?.query) {
          try {
            const docTabs = await chrome.tabs.query({ url: '*://docs.google.com/document/d/*' });
            if (docTabs.length > 0 && docTabs[0]?.url) {
              docId = extractGoogleDocId(docTabs[0].url) || undefined;
              if (!tabId && docTabs[0].id) tabId = docTabs[0].id;
            }
          } catch {}
        }

        // Fetch OAuth Token
        let token: string | undefined = undefined;
        try {
          const settings = await getStoredSettings();
          if (!docId && settings.masterDocId) {
            docId = extractGoogleDocId(settings.masterDocId) || settings.masterDocId;
          }

          token = settings.googleAccessToken;
          if (!token) token = await getGoogleAccessToken();
          if (!token) {
            console.log('[ResumeHack SW] Access token missing or expired, attempting refresh...');
            const refreshRes = await refreshGoogleAccessToken();
            if (refreshRes.success && refreshRes.accessToken) {
              token = refreshRes.accessToken;
              console.log('[ResumeHack SW] Successfully refreshed Google access token.');
            } else if (refreshRes.error) {
              console.warn('[ResumeHack SW] Token refresh error:', refreshRes.error);
            }
          }
        } catch (authErr) {
          console.debug('[ResumeHack SW] Auth token lookup note:', authErr);
        }

        if (!docId) {
          docId = 'mock-master-doc';
        }

        console.log('[ResumeHack SW] Executing applyBatchUpdates for docId:', docId, 'hasToken:', Boolean(token), 'layoutIssues:', layoutIssues.length);

        // Authoritative Structural REST API Call (documents.get -> reverse-index deleteContentRange + insertText + updateTextStyle)
        const restResult = await googleDocsService.applyBatchUpdates(docId, diffs, token, layoutIssues);

        console.log('[ResumeHack SW] applyBatchUpdates result:', {
          success: restResult.success,
          updatedCount: restResult.updatedCount,
          error: restResult.error,
        });

        // If batch update succeeded, synchronize chrome.storage.local immediately
        if (restResult.success && typeof chrome !== 'undefined' && chrome.storage?.local) {
          try {
            const data = await new Promise<any>((resolve) => {
              chrome.storage.local.get(['resumehack_latest_tailor_data'], (res) => resolve(res || {}));
            });
            if (data?.resumehack_latest_tailor_data?.diffs) {
              const appliedIds = new Set(diffs.map((d: any) => d.id));
              const updatedDiffs = data.resumehack_latest_tailor_data.diffs.map((d: any) =>
                appliedIds.has(d.id) ? { ...d, status: 'accepted' as const, isApplying: false, applyError: undefined } : d
              );
              const updatedTailorData = {
                ...data.resumehack_latest_tailor_data,
                diffs: updatedDiffs,
              };
              await new Promise<void>((resolve) => {
                chrome.storage.local.set({
                  resumehack_latest_tailor_data: updatedTailorData,
                  resumehack_latest_diffs: updatedDiffs,
                }, () => resolve());
              });
            }
          } catch (syncErr) {
            console.debug('[ResumeHack SW] Storage sync note:', syncErr);
          }
        }

        // Notify in-page content script purely for cosmetic feedback (highlighting/scrolling)
        if (restResult.success && tabId && chrome.tabs?.sendMessage) {
          chrome.tabs.sendMessage(tabId, {
            type: 'APPLY_ACCEPTED_DIFFS_TO_PAGE',
            payload: { diffs, acceptedDiffs: diffs, targetDocId: docId },
          }).catch(() => {});
        }

        return {
          success: restResult.success,
          appliedCount: restResult.updatedCount,
          occurrencesChanged: restResult.occurrencesChanged,
          requestsExecuted: restResult.requestsExecuted,
          apiExecuted: restResult.apiExecuted,
          replies: restResult.replies,
          writeControl: restResult.writeControl,
          details: restResult.details,
          error: restResult.error,
        };
      })()
        .then((res) => {
          sendResponse(res);
        })
        .catch((err) => {
          console.error('[ResumeHack SW] Critical error in apply handler:', err);
          sendResponse({
            success: false,
            appliedCount: 0,
            error: err?.message || String(err),
          });
        });
      return true; // Keep message channel open for async response
    }

  } catch (err: any) {
    console.error('[ResumeHack] Service worker message error:', err);
  }

  return false;
});

/**
 * Fallback mechanism if direct sidePanel.open fails:
 * Always targets the side panel on the side of the active browser window/tab.
 */
function openExtensionFallback(sendResponse?: (res: any) => void): void {
  try {
    if (chrome.sidePanel?.open) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0];
        if (tab?.id) {
          chrome.sidePanel.open({ tabId: tab.id })
            .then(() => sendResponse?.({ status: 'opened', target: 'sidepanel' }))
            .catch(() => {
              if (tab.windowId) {
                chrome.sidePanel.open({ windowId: tab.windowId })
                  .then(() => sendResponse?.({ status: 'opened', target: 'sidepanel' }))
                  .catch((e: any) => sendResponse?.({ status: 'error', error: e?.message }));
              }
            });
        }
      });
    } else {
      sendResponse?.({ status: 'ok', target: 'sidepanel' });
    }
  } catch (err: any) {
    sendResponse?.({ status: 'error', error: err?.message });
  }
}
