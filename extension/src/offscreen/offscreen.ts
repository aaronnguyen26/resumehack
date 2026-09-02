/**
 * ResumeHack Offscreen Document — Persistent SSE Stream Bridge
 *
 * Manifest V3 background service workers are terminated after ~30s of inactivity.
 * This offscreen document provides a sanctioned, persistent DOM context to hold
 * an active EventSource connection to the ResumeHack Express backend (`/api/events/jobs`).
 *
 * When a `job_event` arrives (< 500ms from Postgres NOTIFY), this document relays
 * it to the background service worker via `chrome.runtime.sendMessage()`, which
 * wakes the service worker instantly to notify all open browser tabs and Hacky mascots.
 */

const BACKEND_SSE_URL = 'http://localhost:3001/api/events/jobs';
let eventSource: EventSource | null = null;
let lastEventId: string | null = null;
let reconnectAttempts = 0;
let reconnectTimeout: any = null;

function connectSSE(): void {
  if (eventSource) {
    try {
      eventSource.close();
    } catch {}
  }

  const url = lastEventId
    ? `${BACKEND_SSE_URL}?lastEventId=${encodeURIComponent(lastEventId)}`
    : BACKEND_SSE_URL;

  console.log(`[ResumeHack Offscreen] Connecting to SSE stream at ${url}...`);

  try {
    eventSource = new EventSource(url);

    eventSource.onopen = () => {
      console.log('[ResumeHack Offscreen] SSE connection established successfully.');
      reconnectAttempts = 0;
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
      }
    };

    eventSource.addEventListener('job_event', (event: MessageEvent) => {
      if (event.lastEventId) {
        lastEventId = event.lastEventId;
      }

      try {
        const payload = JSON.parse(event.data);
        console.log('[ResumeHack Offscreen] Received job_event from SSE:', payload);

        // Relay to background service worker
        chrome.runtime.sendMessage({
          type: 'OFFSCREEN_SSE_EVENT',
          eventId: event.lastEventId,
          payload,
          receivedAt: Date.now(),
        }).catch((err) => {
          console.debug('[ResumeHack Offscreen] Note sending to SW:', err?.message);
        });
      } catch (err: any) {
        console.error('[ResumeHack Offscreen] Failed to parse SSE payload:', err);
      }
    });

    eventSource.onerror = (err) => {
      console.warn('[ResumeHack Offscreen] SSE stream disconnected, scheduling reconnect...', err);
      try {
        eventSource?.close();
      } catch {}
      eventSource = null;

      // Exponential backoff with jitter (1s, 2s, 4s, max 15s)
      reconnectAttempts += 1;
      const delay = Math.min(15000, 1000 * Math.pow(2, reconnectAttempts - 1));
      if (!reconnectTimeout) {
        reconnectTimeout = setTimeout(() => {
          reconnectTimeout = null;
          connectSSE();
        }, delay);
      }
    };
  } catch (err) {
    console.error('[ResumeHack Offscreen] Error initializing EventSource:', err);
  }
}

// Start connection on load
connectSSE();

// Listen for ping or reset requests from background service worker
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'OFFSCREEN_HEARTBEAT_PING') {
    const isConnected = eventSource !== null && eventSource.readyState === EventSource.OPEN;
    sendResponse({ status: 'ok', connected: isConnected, lastEventId });
  } else if (message?.type === 'OFFSCREEN_RECONNECT_SSE') {
    connectSSE();
    sendResponse({ status: 'reconnecting' });
  }
  return true;
});
