// Native In-Document Google Docs Suggestion Sidebar & Helper Content Script
// - Right-Margin Interactive Suggestion Sidebar (Shadow DOM Encapsulated)
// - Precision Text Extractor for Screen Resume Reading
// - Safe In-Doc Apply Trigger directly modifying document via Background Service Worker

import { TailoredBulletDiff, ScrapedJobData } from '../types/index.js';
import { RobustTextMatcher } from '../services/google-docs.js';

function isExtensionValid(): boolean {
  try {
    return Boolean(typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id);
  } catch {
    return false;
  }
}

function safeSendMessage(message: any, callback?: (response: any) => void): void {
  try {
    if (!isExtensionValid()) {
      if (callback) callback({ success: false, error: 'Extension context invalidated. Please reload the tab.' });
      return;
    }

    if (callback) {
      let callbackCalled = false;
      const safeCallback = (res: any) => {
        if (callbackCalled) return;
        callbackCalled = true;
        callback(res);
      };

      // 10-second timeout fallback
      const timer = setTimeout(() => {
        console.warn('[ResumeHack Docs] sendMessage timed out for:', message.type);
        safeCallback({ success: false, error: 'Request to background service worker timed out (10s)' });
      }, 10000);

      chrome.runtime.sendMessage(message, (res) => {
        clearTimeout(timer);
        try {
          if (chrome.runtime?.lastError) {
            const errMsg = chrome.runtime.lastError.message || 'Chrome runtime message error';
            console.error('[ResumeHack Docs] chrome.runtime.lastError:', errMsg);
            safeCallback({ success: false, error: errMsg });
            return;
          }
          safeCallback(res || { success: false, error: 'Empty response received from background' });
        } catch (cbErr: any) {
          console.error('[ResumeHack Docs] Message callback error:', cbErr);
          safeCallback({ success: false, error: cbErr?.message || String(cbErr) });
        }
      });
    } else {
      const promise = chrome.runtime.sendMessage(message);
      if (promise && typeof promise.catch === 'function') {
        promise.catch((err) => console.debug('[ResumeHack Docs] sendMessage catch:', err));
      }
    }
  } catch (err: any) {
    console.error('[ResumeHack Docs] Top-level safeSendMessage error:', err);
    if (callback) callback({ success: false, error: err?.message || String(err) });
  }
}

export function extractDocIdFromUrl(url: string = window.location.href): string | null {
  if (!url) return null;
  const match = url.match(/\/document\/(?:u\/\d+\/)?d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

interface InDocBulletDiff extends TailoredBulletDiff {
  isApplying?: boolean;
  applyError?: string;
}

interface SuggestingPayload {
  jobTitle: string;
  company: string;
  projectedNewScore?: number;
  originalScore?: number;
  targetDocId?: string;
  targetDocUrl?: string;
  diffs: InDocBulletDiff[];
}

let inDocRoot: HTMLElement | null = null;
let shadowRoot: ShadowRoot | null = null;
let activePayload: SuggestingPayload | null = null;
let boundDocId: string | null = null;
let isSidebarOpen: boolean = true;

// ─── Text Extraction from Screen ───────────────────────────────────────────────

function notifyScreenResume(): void {
  try {
    const data = extractScreenResume();
    if (data.fullText.length > 30) {
      safeSendMessage({
        type: 'SCREEN_RESUME_DETECTED',
        data: {
          docId: data.isGoogleDoc ? extractDocIdFromUrl(data.url) || 'active-doc' : 'screen-doc',
          title: data.title,
          fullText: data.fullText,
          url: data.url,
          isGoogleDoc: data.isGoogleDoc,
          lastSynced: new Date().toISOString(),
        },
      });
    }
  } catch (err) {
    console.debug('[ResumeHack Docs] Screen notification note:', err);
  }
}

function extractGoogleDocsText(): string {
  // 1. Accessibility paragraphs & full paragraph renderers (cleanest text representation)
  const paragraphElements = document.querySelectorAll(
    '[role="paragraph"], .kix-paragraphrenderer'
  );
  if (paragraphElements.length > 0) {
    const pLines: string[] = [];
    paragraphElements.forEach((el) => {
      const txt = (el.textContent || '').replace(/[\u00AD\u200B\uFEFF]/g, '').trim();
      if (txt.length > 0 && !pLines.includes(txt)) {
        pLines.push(txt);
      }
    });
    if (pLines.join('\n').length > 50) {
      return pLines.join('\n');
    }
  }

  // 2. Leaf line views
  const textBlocks = document.querySelectorAll('.kix-lineview-text-block, .kix-lineview');
  if (textBlocks.length > 0) {
    const lines: string[] = [];
    textBlocks.forEach((el) => {
      const txt = (el.textContent || '').replace(/[\u00AD\u200B\uFEFF]/g, '').trim();
      if (txt.length > 0 && !lines.includes(txt)) {
        lines.push(txt);
      }
    });
    if (lines.join('\n').length > 50) {
      return lines.join('\n');
    }
  }

  const editor = document.querySelector(
    '.kix-appview-editor, #kix-appview, .docs-editor, [role="document"], .kix-page-content'
  );
  if (editor && (editor as HTMLElement).innerText && (editor as HTMLElement).innerText.length > 50) {
    return (editor as HTMLElement).innerText;
  }

  return document.body.innerText;
}

function extractScreenResume(): {
  title: string;
  fullText: string;
  url: string;
  isGoogleDoc: boolean;
} {
  const url = window.location.href;
  const isGoogleDoc = url.includes('docs.google.com/document/d/');

  let title = document.title.replace(' - Google Docs', '').trim();
  if (isGoogleDoc) {
    const docTitleInput = document.querySelector('.docs-title-input') as HTMLInputElement;
    if (docTitleInput && docTitleInput.value) {
      title = docTitleInput.value.trim();
    }
  }

  const fullText = isGoogleDoc ? extractGoogleDocsText() : document.body.innerText;

  return {
    title: title || 'Active Google Doc',
    fullText: fullText.slice(0, 30000),
    url,
    isGoogleDoc,
  };
}

function isGoogleDocsPage(): boolean {
  return (
    typeof window !== 'undefined' &&
    Boolean(window.location?.href?.includes('docs.google.com/document/'))
  );
}

// ─── Suggestion Actions & Event Handlers ───────────────────────────────────────

// ─── Direct In-Document Applied Engine ────────────────────────────────────────

function ensureHighlightStylesInjected(): void {
  if (document.getElementById('rh-highlight-style')) return;
  const style = document.createElement('style');
  style.id = 'rh-highlight-style';
  style.textContent = `
    @keyframes rhGlowPulse {
      0% { background-color: rgba(34, 197, 94, 0.40); outline: 2px solid rgba(34, 197, 94, 0.85); border-radius: 4px; }
      50% { background-color: rgba(34, 197, 94, 0.20); outline: 2px solid rgba(34, 197, 94, 0.50); }
      100% { background-color: transparent; outline: 2px solid transparent; }
    }
    .rh-applied-highlight {
      animation: rhGlowPulse 2.8s ease-out forwards !important;
    }
  `;
  (document.head || document.documentElement).appendChild(style);
}

class GoogleDocsDirectApplicator {
  /**
   * Finds the best-matching paragraph/line element in Google Docs DOM.
   */
  public static findMatchingParagraphElement(originalText: string): HTMLElement | null {
    if (!originalText || originalText.trim().length < 5) return null;

    const normOriginal = RobustTextMatcher.normalize(originalText);
    const cleanOriginal = RobustTextMatcher.normalize(RobustTextMatcher.sanitizeOriginal(originalText));

    const candidates = Array.from(
      document.querySelectorAll<HTMLElement>(
        '.kix-paragraphrenderer, [role="paragraph"], .kix-lineview, .kix-lineview-text-block'
      )
    );

    // Pass 1: Exact normalized text match or contains cleanOriginal
    for (const el of candidates) {
      const rawText = el.textContent || '';
      const normEl = RobustTextMatcher.normalize(rawText);
      const cleanEl = RobustTextMatcher.normalize(RobustTextMatcher.sanitizeOriginal(rawText));

      if (normEl === normOriginal || cleanEl === cleanOriginal) {
        return el;
      }
    }

    // Pass 2: Substring inclusion (for multi-line or long bullets)
    for (const el of candidates) {
      const rawText = el.textContent || '';
      const normEl = RobustTextMatcher.normalize(rawText);
      const cleanEl = RobustTextMatcher.normalize(RobustTextMatcher.sanitizeOriginal(rawText));

      if (
        (cleanOriginal.length >= 15 && cleanEl.includes(cleanOriginal)) ||
        (cleanEl.length >= 15 && cleanOriginal.includes(cleanEl))
      ) {
        return el;
      }
    }

    // Pass 3: Opening lead phrase match (first 25-40 chars)
    if (cleanOriginal.length >= 25) {
      const leadPhrase = cleanOriginal.slice(0, 35).replace(/\s+\S*$/, '').trim();
      if (leadPhrase.length >= 15) {
        for (const el of candidates) {
          const cleanEl = RobustTextMatcher.normalize(RobustTextMatcher.sanitizeOriginal(el.textContent || ''));
          if (cleanEl.includes(leadPhrase)) {
            return el;
          }
        }
      }
    }

    // Pass 4: Fuzzy similarity scoring
    let bestEl: HTMLElement | null = null;
    let bestScore = 0;

    for (const el of candidates) {
      const cleanEl = RobustTextMatcher.normalize(RobustTextMatcher.sanitizeOriginal(el.textContent || ''));
      if (cleanEl.length < 8) continue;

      const score = RobustTextMatcher.calculateSimilarity(cleanOriginal, cleanEl);
      if (score > bestScore && score >= 0.55) {
        bestScore = score;
        bestEl = el;
      }
    }

    return bestEl;
  }

  /**
   * Attaches a glowing emerald highlight animation to the modified paragraph.
   */
  public static applyVisualHighlight(element: HTMLElement): void {
    ensureHighlightStylesInjected();
    element.classList.remove('rh-applied-highlight');
    void element.offsetWidth; // Force reflow
    element.classList.add('rh-applied-highlight');
    setTimeout(() => {
      element.classList.remove('rh-applied-highlight');
    }, 2800);
  }
}

async function handleAcceptInDoc(diffId: string): Promise<void> {
  if (!activePayload) {
    console.warn('[ResumeHack Docs] handleAcceptInDoc: activePayload is null');
    return;
  }

  const diff = activePayload.diffs.find((d) => d.id === diffId);
  if (!diff) {
    console.warn('[ResumeHack Docs] handleAcceptInDoc: diff not found:', diffId);
    return;
  }

  console.log('[ResumeHack Docs] Starting in-doc apply for diff:', diffId, diff.originalText.slice(0, 40));
  diff.isApplying = true;
  diff.applyError = undefined;
  renderSuggestingSidebar();

  try {
    // Send to background service worker for Authoritative Cloud REST API batchUpdate
    const response: any = await new Promise((resolve) => {
      safeSendMessage(
        {
          type: 'IN_DOC_APPLY_CLICKED',
          data: {
            acceptedDiffs: [{ ...diff, status: 'accepted' }],
            url: window.location.href,
          },
        },
        (res) => resolve(res || { success: false, error: 'No response from background worker' })
      );
    });

    console.log('[ResumeHack Docs] in-doc apply response:', response);
    diff.isApplying = false;

    if (response?.success) {
      diff.status = 'accepted';
      diff.applyError = undefined;

      // Apply cosmetic highlight to the affected paragraph
      const targetElement = GoogleDocsDirectApplicator.findMatchingParagraphElement(diff.originalText);
      if (targetElement) {
        try {
          targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          GoogleDocsDirectApplicator.applyVisualHighlight(targetElement);
        } catch {}
      }
    } else {
      // Hard invariant: never mark accepted or highlight on error
      diff.status = 'pending';
      diff.applyError = response?.error || 'Failed to apply update to Google Doc';
      console.error('[ResumeHack Docs] In-doc apply failed:', diff.applyError);
    }
  } catch (err: any) {
    diff.isApplying = false;
    diff.status = 'pending';
    diff.applyError = err?.message || 'Unexpected in-doc apply error';
    console.error('[ResumeHack Docs] In-doc apply error exception:', err);
  }

  renderSuggestingSidebar();
  notifyStatusChanged();
}

function handleUndoInDoc(diffId: string): void {
  if (!activePayload) return;

  const diff = activePayload.diffs.find((d) => d.id === diffId);
  if (!diff) return;

  diff.status = 'pending';
  diff.applyError = undefined;
  diff.isApplying = false;
  renderSuggestingSidebar();
  notifyStatusChanged();
}

function handleRejectInDoc(diffId: string): void {
  if (!activePayload) return;

  const diff = activePayload.diffs.find((d) => d.id === diffId);
  if (!diff) return;

  diff.status = 'rejected';
  diff.applyError = undefined;
  diff.isApplying = false;
  renderSuggestingSidebar();
  notifyStatusChanged();
}

async function handleAcceptAllInDoc(): Promise<void> {
  if (!activePayload) return;
  const pending = activePayload.diffs.filter((d) => d.status === 'pending');
  if (pending.length === 0) return;

  console.log('[ResumeHack Docs] Starting in-doc Apply All for', pending.length, 'diffs');
  for (const diff of pending) {
    diff.isApplying = true;
    diff.applyError = undefined;
  }
  renderSuggestingSidebar();

  try {
    const response: any = await new Promise((resolve) => {
      safeSendMessage(
        {
          type: 'IN_DOC_APPLY_CLICKED',
          data: {
            acceptedDiffs: pending.map((d) => ({ ...d, status: 'accepted' as const })),
            url: window.location.href,
          },
        },
        (res) => resolve(res || { success: false, error: 'No response from background worker' })
      );
    });

    console.log('[ResumeHack Docs] in-doc Apply All response:', response);

    for (const diff of pending) {
      diff.isApplying = false;
      if (response?.success) {
        diff.status = 'accepted';
        diff.applyError = undefined;
        const targetElement = GoogleDocsDirectApplicator.findMatchingParagraphElement(diff.originalText);
        if (targetElement) {
          try {
            targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            GoogleDocsDirectApplicator.applyVisualHighlight(targetElement);
          } catch {}
        }
      } else {
        diff.status = 'pending';
        diff.applyError = response?.error || 'Failed to apply updates to Google Doc';
      }
    }
  } catch (err: any) {
    console.error('[ResumeHack Docs] In-doc Apply All error exception:', err);
    for (const diff of pending) {
      diff.isApplying = false;
      diff.status = 'pending';
      diff.applyError = err?.message || 'Unexpected in-doc Apply All error';
    }
  }

  renderSuggestingSidebar();
  notifyStatusChanged();
}

async function notifyStatusChanged(): Promise<void> {
  if (!activePayload) return;
  try {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      await chrome.storage.local.set({
        resumehack_latest_tailor_data: activePayload,
        resumehack_latest_diffs: activePayload.diffs,
      });
    }
    safeSendMessage({
      type: 'IN_DOC_STATUS_CHANGED',
      payload: {
        docId: boundDocId,
        diffs: activePayload.diffs,
      },
    });
  } catch (err) {
    console.debug('[ResumeHack Docs] notifyStatusChanged note:', err);
  }
}

function cleanupGoogleDocsSidebar(): void {
  if (inDocRoot) {
    try {
      inDocRoot.remove();
    } catch {}
    inDocRoot = null;
    shadowRoot = null;
  }
  activePayload = null;
  boundDocId = null;
}

function initGoogleDocsSidebar(): void {
  if (!isGoogleDocsPage()) {
    cleanupGoogleDocsSidebar();
    return;
  }

  const currentDocId = extractDocIdFromUrl(window.location.href);
  if (boundDocId && currentDocId && boundDocId !== currentDocId && boundDocId !== 'mock-master-doc' && boundDocId !== 'screen-doc' && boundDocId !== 'active-doc') {
    cleanupGoogleDocsSidebar();
    return;
  }

  if (currentDocId) {
    boundDocId = currentDocId;
  }

  if (inDocRoot && document.contains(inDocRoot)) {
    renderSuggestingSidebar();
    return;
  }

  inDocRoot = document.createElement('div');
  inDocRoot.id = 'resumehack-suggesting-root';
  inDocRoot.style.cssText = 'all: initial; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 2147483640; pointer-events: none;';
  shadowRoot = inDocRoot.attachShadow({ mode: 'open' });
  const mountTarget = document.body || document.documentElement;
  if (mountTarget) {
    mountTarget.appendChild(inDocRoot);
  }

  renderSuggestingSidebar();
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

// ─── Shadow DOM Suggestion Sidebar Styles ──────────────────────────────────────

function getSidebarStyles(): string {
  return `
    :host {
      all: initial;
      font-family: 'Google Sans', Roboto, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 13px;
      line-height: 1.4;
      color: #202124;
      z-index: 2147483640;
      pointer-events: none;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      pointer-events: auto;
    }

    /* ── Right-Margin Floating Suggestion Sidebar (Docked on Google Docs Right Margin) ── */
    .rh-suggestion-sidebar {
      position: fixed;
      top: 75px;
      right: 20px;
      width: 375px;
      max-height: calc(100vh - 95px);
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 16px;
      box-shadow: 0 10px 36px rgba(15, 23, 42, 0.18), 0 2px 10px rgba(15, 23, 42, 0.08);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      z-index: 2147483640;
      animation: rh-slide-in-right 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      pointer-events: auto;
    }

    @keyframes rh-slide-in-right {
      from { transform: translateX(30px); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }

    /* ── Sidebar Header ── */
    .rh-sidebar-header {
      padding: 12px 16px;
      background: #f8fafd;
      border-bottom: 1px solid #e8eaed;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    .rh-header-left {
      display: flex;
      align-items: center;
      gap: 8px;
      overflow: hidden;
    }

    .rh-header-icon {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: linear-gradient(135deg, #4f46e5, #1a73e8);
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      flex-shrink: 0;
      box-shadow: 0 2px 6px rgba(79, 70, 229, 0.3);
    }

    .rh-header-title-box {
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .rh-header-title {
      font-size: 12px;
      font-weight: 700;
      color: #202124;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .rh-header-subtitle {
      font-size: 10px;
      color: #5f6368;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .rh-header-actions {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-shrink: 0;
    }

    .rh-btn-apply-all {
      background: #188038;
      color: #ffffff;
      border: none;
      font-size: 11px;
      font-weight: 700;
      padding: 5px 10px;
      border-radius: 14px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      transition: all 0.15s ease;
      box-shadow: 0 1px 3px rgba(24, 128, 56, 0.3);
    }

    .rh-btn-apply-all:hover {
      background: #137333;
      transform: translateY(-1px);
      box-shadow: 0 2px 6px rgba(24, 128, 56, 0.4);
    }

    .rh-btn-apply-all:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
    }

    .rh-btn-close-sidebar {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: transparent;
      border: none;
      color: #5f6368;
      font-size: 13px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s ease;
    }

    .rh-btn-close-sidebar:hover {
      background: #e8eaed;
      color: #202124;
    }

    /* ── Cards Scroll Container ── */
    .rh-sidebar-cards {
      padding: 12px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 12px;
      max-height: calc(100vh - 160px);
    }

    .rh-sidebar-cards::-webkit-scrollbar {
      width: 5px;
    }
    .rh-sidebar-cards::-webkit-scrollbar-thumb {
      background: #dadce0;
      border-radius: 4px;
    }

    /* ── Suggestion Card ── */
    .rh-card {
      background: #ffffff;
      border: 1px solid #dadce0;
      border-radius: 12px;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      box-shadow: 0 1px 3px rgba(60, 64, 67, 0.08);
      transition: all 0.2s ease;
    }

    .rh-card:hover {
      border-color: #aecbfa;
      box-shadow: 0 2px 8px rgba(60, 64, 67, 0.12);
    }

    .rh-card.applied {
      border-color: #34a853;
      background: #f6fbf7;
    }

    .rh-card.rejected {
      border-color: #dadce0;
      background: #f8f9fa;
      opacity: 0.6;
    }

    .rh-card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 11px;
    }

    .rh-card-meta {
      font-weight: 700;
      color: #202124;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .rh-badge-gain {
      background: #e6f4ea;
      color: #137333;
      font-size: 10px;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 8px;
    }

    /* ── Diff Compare Boxes ── */
    .rh-del-box {
      background: #fce8e6;
      border-left: 3px solid #d93025;
      padding: 6px 8px;
      border-radius: 0 6px 6px 0;
      font-size: 11px;
    }

    .rh-del-label {
      font-size: 9px;
      font-weight: 800;
      color: #c5221f;
      text-transform: uppercase;
      margin-bottom: 2px;
    }

    .rh-del-text {
      color: #5f6368;
      text-decoration: line-through;
      line-height: 1.35;
    }

    .rh-ins-box {
      background: #e6f4ea;
      border-left: 3px solid #188038;
      padding: 6px 8px;
      border-radius: 0 6px 6px 0;
      font-size: 11px;
    }

    .rh-ins-label {
      font-size: 9px;
      font-weight: 800;
      color: #137333;
      text-transform: uppercase;
      margin-bottom: 2px;
    }

    .rh-ins-text {
      color: #137333;
      font-weight: 600;
      line-height: 1.35;
    }

    .rh-card-rationale {
      font-size: 11px;
      color: #5f6368;
      background: #f8f9fa;
      padding: 6px 8px;
      border-radius: 6px;
      line-height: 1.3;
    }

    .rh-card-actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 6px;
      margin-top: 4px;
    }

    .rh-btn-card {
      border: 1px solid transparent;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 600;
      padding: 4px 10px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      transition: all 0.15s ease;
    }

    .rh-btn-accept {
      background: #188038;
      color: #ffffff;
    }
    .rh-btn-accept:hover {
      background: #137333;
    }
    .rh-btn-accept:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .rh-btn-dismiss {
      background: #ffffff;
      color: #5f6368;
      border-color: #dadce0;
    }
    .rh-btn-dismiss:hover {
      background: #fce8e6;
      color: #d93025;
      border-color: #f6aea9;
    }

    .rh-btn-copy {
      background: #f1f3f4;
      color: #5f6368;
      font-size: 10px;
      padding: 4px 8px;
    }
    .rh-btn-copy:hover {
      background: #e8eaed;
      color: #202124;
    }

    .rh-status-applied {
      font-size: 11px;
      font-weight: 700;
      color: #137333;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    .rh-btn-undo {
      background: #ffffff;
      color: #1a73e8;
      border-color: #dadce0;
      font-size: 10px;
      padding: 3px 8px;
    }
    .rh-btn-undo:hover {
      background: #e8f0fe;
      border-color: #aecbfa;
      color: #174ea6;
    }

    /* ── Celebration Box ── */
    .rh-celebration-card {
      background: #ffffff;
      border: 1.5px solid #bbf7d0;
      border-radius: 10px;
      padding: 16px;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
    }

    .rh-celebration-badge {
      background: #dcfce7;
      color: #15803d;
      font-size: 11px;
      font-weight: 800;
      padding: 3px 9px;
      border-radius: 12px;
    }

    .rh-celebration-title {
      font-size: 12px;
      font-weight: 700;
      color: #14532d;
    }

    .rh-celebration-sub {
      font-size: 11px;
      color: #4b5563;
    }
  `;
}

// ─── Render Google Docs Suggestion Sidebar & Status Pill ───────────────────────

function renderSuggestingSidebar(): void {
  if (!shadowRoot) return;

  const currentDocId = extractDocIdFromUrl(window.location.href);
  if (boundDocId && currentDocId && boundDocId !== currentDocId) {
    cleanupGoogleDocsSidebar();
    return;
  }

  if (!activePayload || !activePayload.diffs || activePayload.diffs.length === 0) {
    shadowRoot.innerHTML = '';
    return;
  }

  const { jobTitle, company, diffs } = activePayload;
  const pendingDiffs = diffs.filter((d) => d.status === 'pending');
  const pendingCount = pendingDiffs.length;
  const acceptedCount = diffs.filter((d) => d.status === 'accepted').length;

  let contentHtml = '';

  if (isSidebarOpen && activePayload && diffs.length > 0) {
    const cardsHtml = diffs
      .map((diff, idx) => {
        const isAccepted = diff.status === 'accepted';
        const isRejected = diff.status === 'rejected';
        const isApplying = Boolean(diff.isApplying);

        let cardClass = 'rh-card';
        if (isAccepted) cardClass += ' applied';
        if (isRejected) cardClass += ' rejected';

        return `
          <div class="${cardClass}" data-id="${diff.id}">
            <div class="rh-card-header">
              <div class="rh-card-meta">
                <span>Bullet #${idx + 1}</span>
                ${diff.organization ? `<span style="font-weight: 400; color: #5f6368;">· ${escapeHtml(diff.organization)}</span>` : ''}
              </div>
              ${diff.scoreGain ? `<span class="rh-badge-gain">+${diff.scoreGain}% ATS</span>` : '<span class="rh-badge-gain">+STAR</span>'}
            </div>

            <div class="rh-del-box">
              <div class="rh-del-label">Original</div>
              <div class="rh-del-text">${escapeHtml(diff.originalText)}</div>
            </div>

            <div class="rh-ins-box">
              <div class="rh-ins-label">Tailored Replacement</div>
              <div class="rh-ins-text">${escapeHtml(diff.tailoredText)}</div>
            </div>

            ${diff.rationale ? `<div class="rh-card-rationale">💡 ${escapeHtml(diff.rationale)}</div>` : ''}
            ${diff.applyError ? `<div style="background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; padding: 6px 10px; border-radius: 6px; font-size: 11px; margin-top: 6px; font-weight: 500;">⚠️ ${escapeHtml(diff.applyError)}</div>` : ''}

            <div class="rh-card-actions">
              <button class="rh-btn-card rh-btn-copy" data-action="copy" data-id="${diff.id}" title="Copy to clipboard">
                Copy
              </button>

              ${
                isAccepted
                  ? `
                  <span class="rh-status-applied">✓ Applied to Doc</span>
                  <button class="rh-btn-card rh-btn-undo" data-action="undo" data-id="${diff.id}" title="Revert back to original">
                    ⎌ Undo
                  </button>
                `
                  : isRejected
                  ? '<span style="font-size: 11px; color: #5f6368; font-weight: 600;">✕ Dismissed</span>'
                  : `
                  <button class="rh-btn-card rh-btn-dismiss" data-action="reject" data-id="${diff.id}">
                    ✕ Dismiss
                  </button>
                  <button class="rh-btn-card rh-btn-accept" data-action="accept" data-id="${diff.id}" ${isApplying ? 'disabled' : ''}>
                    ${isApplying ? 'Applying…' : '✓ Accept & Apply'}
                  </button>
                `
              }
            </div>
          </div>
        `;
      })
      .join('');

    const celebrationHtml = `
      <div class="rh-celebration-card">
        <span class="rh-celebration-badge">🎉 All Suggestions Applied!</span>
        <span class="rh-celebration-title">Google Doc Successfully Updated</span>
        <span class="rh-celebration-sub">Your resume is 100% tailored with STAR bullets.</span>
      </div>
    `;

    contentHtml = `
      <div class="rh-suggestion-sidebar">
        <div class="rh-sidebar-header">
          <div class="rh-header-left">
            <div class="rh-header-icon">🦉</div>
            <div class="rh-header-title-box">
              <span class="rh-header-title">Hacky Suggestions</span>
              <span class="rh-header-subtitle">
                ${escapeHtml(jobTitle)} ${company ? `· ${escapeHtml(company)}` : ''} (${pendingCount} remaining)
              </span>
            </div>
          </div>

          <div class="rh-header-actions">
            ${pendingCount > 0 ? '<button class="rh-btn-apply-all" id="rh-btn-apply-all">⚡ Apply All</button>' : ''}
            <button class="rh-btn-close-sidebar" id="rh-btn-close" title="Minimize sidebar">✕</button>
          </div>
        </div>

        <div class="rh-sidebar-cards">
          ${diffs.length > 0 && pendingCount === 0 ? celebrationHtml : cardsHtml}
        </div>
      </div>
    `;
  } else {
    contentHtml = '';
  }

  shadowRoot.innerHTML = `
    <style>${getSidebarStyles()}</style>
    ${contentHtml}
  `;

  attachSidebarEventHandlers();
}

function attachSidebarEventHandlers(): void {
  if (!shadowRoot) return;

  shadowRoot.getElementById('rh-btn-close')?.addEventListener('click', () => {
    isSidebarOpen = false;
    renderSuggestingSidebar();
  });

  shadowRoot.getElementById('rh-btn-apply-all')?.addEventListener('click', () => {
    handleAcceptAllInDoc();
  });

  shadowRoot.querySelectorAll('.rh-btn-card').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const target = e.currentTarget as HTMLElement;
      const action = target.getAttribute('data-action');
      const diffId = target.getAttribute('data-id');
      if (!diffId) return;

      if (action === 'accept') {
        handleAcceptInDoc(diffId);
      } else if (action === 'undo') {
        handleUndoInDoc(diffId);
      } else if (action === 'reject') {
        handleRejectInDoc(diffId);
      } else if (action === 'copy') {
        const diff = activePayload?.diffs.find((d) => d.id === diffId);
        if (diff?.tailoredText) {
          navigator.clipboard.writeText(diff.tailoredText);
          target.textContent = 'Copied!';
          setTimeout(() => {
            target.textContent = 'Copy';
          }, 1500);
        }
      }
    });
  });
}

// ─── Storage Auto-Restore & Live Synchronization ──────────────────────────────

async function checkStorageForActiveSuggestions(): Promise<void> {
  if (!isGoogleDocsPage()) return;
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return;

  try {
    const data = await new Promise<any>((resolve) => {
      chrome.storage.local.get(['resumehack_latest_tailor_data'], (res) => resolve(res || {}));
    });

    if (data?.resumehack_latest_tailor_data) {
      const stored = data.resumehack_latest_tailor_data;
      const currentDocId = extractDocIdFromUrl(window.location.href);

      const isMatchingDoc =
        !stored.targetDocId ||
        !currentDocId ||
        stored.targetDocId === currentDocId ||
        (stored.targetDocUrl && stored.targetDocUrl.includes(currentDocId));

      if (isMatchingDoc && stored.diffs && stored.diffs.length > 0) {
        console.log('[ResumeHack Docs] Restored active suggestions from storage:', stored.diffs.length);
        boundDocId = stored.targetDocId || currentDocId;
        activePayload = {
          jobTitle: stored.jobTitle || 'Tailored Role',
          company: stored.company || '',
          projectedNewScore: stored.projectedNewScore,
          originalScore: stored.originalScore,
          targetDocId: boundDocId || undefined,
          targetDocUrl: stored.targetDocUrl,
          diffs: stored.diffs,
        };
        isSidebarOpen = true;
        initGoogleDocsSidebar();
      }
    }
  } catch (err) {
    console.debug('[ResumeHack Docs] Storage restore note:', err);
  }
}

if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
  try {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local' && changes.resumehack_latest_tailor_data) {
        const newVal = changes.resumehack_latest_tailor_data.newValue;
        if (newVal && newVal.diffs && newVal.diffs.length > 0) {
          const currentDocId = extractDocIdFromUrl(window.location.href);
          const isMatchingDoc =
            !newVal.targetDocId ||
            !currentDocId ||
            newVal.targetDocId === currentDocId ||
            (newVal.targetDocUrl && newVal.targetDocUrl.includes(currentDocId));

          if (isMatchingDoc) {
            console.log('[ResumeHack Docs] Live storage update received:', newVal.diffs.length);
            boundDocId = newVal.targetDocId || currentDocId;
            activePayload = {
              jobTitle: newVal.jobTitle || 'Tailored Role',
              company: newVal.company || '',
              projectedNewScore: newVal.projectedNewScore,
              originalScore: newVal.originalScore,
              targetDocId: boundDocId || undefined,
              targetDocUrl: newVal.targetDocUrl,
              diffs: newVal.diffs,
            };
            isSidebarOpen = true;
            initGoogleDocsSidebar();
          }
        }
      }
    });
  } catch {}
}

// ─── Message Listener with Strict Document ID Scoping ──────────────────────────

if (isExtensionValid() && chrome.runtime?.onMessage) {
  try {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (!isExtensionValid()) return false;
      try {
        if (!isGoogleDocsPage()) {
          cleanupGoogleDocsSidebar();
          if (
            message.type === 'SHOW_IN_DOC_DIFFS' ||
            message.type === 'APPLY_ACCEPTED_DIFFS_TO_PAGE' ||
            message.type === 'CLEAR_IN_DOC_DIFFS' ||
            message.type === 'FOCUS_IN_DOC_SUGGESTIONS'
          ) {
            try {
              sendResponse({ success: false, reason: 'not_google_docs' });
            } catch {}
            return true;
          }
        }

        // 1. Clear In-Doc Suggestions on Demand
        if (message.type === 'CLEAR_IN_DOC_DIFFS') {
          cleanupGoogleDocsSidebar();
          try {
            sendResponse({ success: true, cleared: true });
          } catch {}
          return true;
        }

        // 2. Read Screen
        if (message.type === 'READ_SCREEN_NOW') {
          const data = extractScreenResume();
          try {
            sendResponse({ success: true, data });
          } catch {}
          return true;
        }

        // 3. Focus / Open Suggestion Overlay
        if (message.type === 'FOCUS_IN_DOC_SUGGESTIONS') {
          isSidebarOpen = true;
          if (!activePayload) {
            checkStorageForActiveSuggestions();
          } else {
            initGoogleDocsSidebar();
          }
          try {
            sendResponse({ success: true, opened: true });
          } catch {}
          return true;
        }

        // 4. Show In-Doc Diffs (Mounts the Left-Margin Floating Suggestion Sidebar on Google Docs)
        if (message.type === 'SHOW_IN_DOC_DIFFS' && message.payload) {
          const currentDocId = extractDocIdFromUrl(window.location.href);
          const rawTarget = message.payload.targetDocId;
          const isRealTargetDocId = Boolean(
            rawTarget &&
            rawTarget !== 'mock-master-doc' &&
            rawTarget !== 'screen-doc' &&
            rawTarget !== 'active-doc'
          );

          if (isRealTargetDocId && currentDocId && rawTarget !== currentDocId) {
            console.warn('[ResumeHack Docs] targetDocId mismatch note:', { currentDocId, rawTarget });
          }

          boundDocId = currentDocId || rawTarget || undefined;

          const payloadDiffs = (message.payload.diffs || []).map((d: any) => ({
            ...d,
            status: d.status || 'pending',
          }));
          activePayload = {
            ...message.payload,
            diffs: payloadDiffs,
            targetDocId: boundDocId || undefined,
          };
          isSidebarOpen = true;
          initGoogleDocsSidebar();
          try {
            sendResponse({ success: true, count: payloadDiffs.length });
          } catch {}
          return true;
        }

        // 5. Highlight applied diffs in Google Docs when triggered from sidepanel
        if (message.type === 'APPLY_ACCEPTED_DIFFS_TO_PAGE' && message.payload) {
          const incomingDiffs: TailoredBulletDiff[] =
            message.payload.diffs || message.payload.acceptedDiffs || [];
          if (incomingDiffs.length > 0) {
            (async () => {
              for (const diff of incomingDiffs) {
                const targetElement = GoogleDocsDirectApplicator.findMatchingParagraphElement(diff.originalText);
                if (targetElement) {
                  try {
                    targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    GoogleDocsDirectApplicator.applyVisualHighlight(targetElement);
                  } catch {}
                }
                await new Promise((r) => setTimeout(r, 80));
              }
              if (activePayload) {
                const appliedIds = new Set(incomingDiffs.map((d: any) => d.id));
                activePayload.diffs.forEach((d) => {
                  if (appliedIds.has(d.id)) {
                    d.status = 'accepted';
                    d.applyError = undefined;
                    d.isApplying = false;
                  }
                });
                renderSuggestingSidebar();
              }
            })();
          }
          try {
            sendResponse({ success: true, count: incomingDiffs.length });
          } catch {}
          return true;
        }
      } catch (err) {
        console.debug('[ResumeHack Docs] Message handler note:', err);
      }
      return true;
    });
  } catch {
    /* context invalidated */
  }
}

// ─── Initialization on Content Script Load ────────────────────────────────────

if (isGoogleDocsPage()) {
  setTimeout(() => {
    notifyScreenResume();
    checkStorageForActiveSuggestions();
  }, 600);
}
