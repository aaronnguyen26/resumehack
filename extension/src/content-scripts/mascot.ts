// Hacky — The AI Resume & Job Search Desktop Mascot Companion
// Injected across all webpages as a delightful, interactive floating screen companion in the bottom right corner.
// 100% encapsulated via Shadow DOM. Zero interference with host web pages.

import {
  MascotNotification,
  MascotState
} from '../types/index.js';
import {
  createJobAlertNotification,
  createProTipNotification,
  createContextGreetingNotification,
  clampMascotPosition,
  parseNotificationPayload,
  PRO_TIPS
} from '../services/mascot-notification.js';

const STORAGE_KEY = 'resumehack_mascot_prefs';

class HackyMascot {
  private container: HTMLElement | null = null;
  private shadow: ShadowRoot | null = null;
  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private initialPosX = 0;
  private initialPosY = 0;
  private hasMoved = false;
  private speechTimeout: any = null;
  private blinkInterval: any = null;
  private periodicTipInterval: any = null;
  private domObserver: MutationObserver | null = null;
  private currentJobsCount = 12;
  private currentContext: 'docs' | 'job' | 'form' | 'general' = 'general';
  private detectedTitle = '';
  private detectedCompany = '';
  private activeNotification: MascotNotification | null = null;
  private currentPos: { x: number; y: number } | null = null;

  constructor() {
    // Only run in top window to avoid multiple mounts inside iframes
    if (typeof window !== 'undefined' && window.top !== window.self) {
      return;
    }
    this.detectPageContext();
    this.init();
  }

  private isExtensionValid(): boolean {
    try {
      return Boolean(typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id);
    } catch {
      return false;
    }
  }

  private safeSendMessage(message: any, callback?: (response: any) => void): void {
    try {
      if (!this.isExtensionValid()) return;
      if (callback) {
        chrome.runtime.sendMessage(message, (res) => {
          try {
            if (chrome.runtime?.lastError) return;
            callback(res);
          } catch {
            // context invalidated
          }
        });
      } else {
        const promise = chrome.runtime.sendMessage(message);
        if (promise && typeof promise.catch === 'function') {
          promise.catch(() => {});
        }
      }
    } catch {
      // suppress context invalidated errors
    }
  }

  private detectPageContext(): void {
    const url = (typeof window !== 'undefined' ? window.location.href : '').toLowerCase();

    if (url.includes('docs.google.com/document/d/')) {
      this.currentContext = 'docs';
      const docTitleInput = document.querySelector('.docs-title-input') as HTMLInputElement;
      this.detectedTitle = docTitleInput?.value?.trim() || document.title.replace(' - Google Docs', '').trim() || 'Master Resume';
      return;
    }

    if (url.includes('linkedin.com/jobs') || url.includes('indeed.com') || url.includes('joinhandshake.com')) {
      this.currentContext = 'job';
      const titleEl = document.querySelector('.job-details-jobs-unified-top-card__job-title, .jobs-unified-top-card__job-title, h1');
      const compEl = document.querySelector('.job-details-jobs-unified-top-card__company-name, .jobs-unified-top-card__company-name, [data-testid="inlineHeader-companyName"]');
      this.detectedTitle = titleEl?.textContent?.trim() || 'Job Opening';
      this.detectedCompany = compEl?.textContent?.trim() || 'Target Company';
      return;
    }

    if (url.includes('greenhouse.io') || url.includes('lever.co') || url.includes('myworkdayjobs.com')) {
      const inputs = document.querySelectorAll('input, textarea, select');
      if (inputs.length >= 4) {
        this.currentContext = 'form';
      } else {
        this.currentContext = 'job';
      }
      const titleEl = document.querySelector('.app-title, .posting-headline h2, [data-automation-id="jobPostingHeader"], h1');
      const compEl = document.querySelector('.company-name, .main-header-logo img, [data-automation-id="companyName"]');
      this.detectedTitle = titleEl?.textContent?.trim() || 'Job Opening';
      this.detectedCompany = compEl?.getAttribute('alt') || compEl?.textContent?.trim() || 'Company';
      return;
    }

    const formInputs = document.querySelectorAll('input:not([type="hidden"]), textarea');
    if (formInputs.length >= 5) {
      this.currentContext = 'form';
      return;
    }

    this.currentContext = 'general';
  }

  private async getSavedState(): Promise<MascotState> {
    const defaultState: MascotState = {
      isMinimized: false,
      position: null,
      hasInteracted: false,
      activeTipIndex: 0
    };

    if (this.isExtensionValid() && chrome.storage?.local) {
      try {
        const stored = await chrome.storage.local.get([STORAGE_KEY, 'resumehack_new_jobs_count']);
        if (typeof stored.resumehack_new_jobs_count === 'number') {
          this.currentJobsCount = stored.resumehack_new_jobs_count;
        }
        if (stored[STORAGE_KEY]) {
          return { ...defaultState, ...stored[STORAGE_KEY] };
        }
      } catch { /* fallback */ }
    }

    try {
      const local = localStorage.getItem(STORAGE_KEY);
      if (local) return { ...defaultState, ...JSON.parse(local) };
    } catch { /* fallback */ }

    return defaultState;
  }

  private async saveState(partial: Partial<MascotState>): Promise<void> {
    const current = await this.getSavedState();
    const updated = { ...current, ...partial };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch { /* silent */ }

    if (this.isExtensionValid() && chrome.storage?.local) {
      try {
        await chrome.storage.local.set({ [STORAGE_KEY]: updated });
      } catch { /* silent */ }
    }
  }

  /**
   * Re-attaches container to document if it was removed by host page mutations or navigation
   */
  public ensureContainerMounted(): void {
    if (!this.container) return;
    const existing = document.getElementById('resumehack-mascot-root');
    if (!existing || !document.contains(existing)) {
      const mountTarget = document.body || document.documentElement;
      if (mountTarget && this.container) {
        mountTarget.appendChild(this.container);
      }
    }
  }

  /**
   * Observer to keep mascot resilient against SPA route changes and DOM resets
   */
  private setupDomPersistenceObserver(): void {
    if (this.domObserver || typeof MutationObserver === 'undefined') return;
    try {
      this.domObserver = new MutationObserver(() => {
        const root = document.getElementById('resumehack-mascot-root');
        if (!root && this.container) {
          const mountTarget = document.body || document.documentElement;
          if (mountTarget) {
            mountTarget.appendChild(this.container);
          }
        }
      });

      const observeTarget = document.body || document.documentElement;
      if (observeTarget) {
        this.domObserver.observe(observeTarget, {
          childList: true,
          subtree: false
        });
      }
    } catch (e) {
      console.debug('[ResumeHack Mascot] MutationObserver note:', e);
    }
  }

  /**
   * Synchronizes active state, position, and counts with storage (cross-window)
   */
  public async syncWithStorage(): Promise<void> {
    try {
      const state = await this.getSavedState();
      this.currentPos = state.position;
      this.applyPosition(state.position);

      const dock = this.shadow?.getElementById('hacky-dock');
      if (dock) {
        if (state.isMinimized) {
          dock.classList.add('minimized');
        } else {
          dock.classList.remove('minimized');
        }
      }

      this.updateJobsCount(this.currentJobsCount);
    } catch {
      // silent
    }
  }

  private async init(): Promise<void> {
    // Avoid duplicate injection
    const existingRoot = document.getElementById('resumehack-mascot-root');
    if (existingRoot && document.contains(existingRoot)) {
      this.syncWithStorage();
      return;
    }

    const mountTarget = document.body || document.documentElement;
    if (!mountTarget) {
      // If DOM isn't ready yet, retry when DOMContentLoaded fires
      document.addEventListener('DOMContentLoaded', () => this.init(), { once: true });
      return;
    }

    const state = await this.getSavedState();
    this.currentPos = state.position;

    this.container = document.createElement('div');
    this.container.id = 'resumehack-mascot-root';
    this.container.style.cssText = 'all: initial; position: fixed; bottom: 24px; right: 24px; z-index: 2147483647; pointer-events: none;';
    this.shadow = this.container.attachShadow({ mode: 'open' });
    
    mountTarget.appendChild(this.container);

    this.render(state);
    this.setupListeners();
    this.setupAutoGreeting();
    this.startEyeBlinking();
    this.startPeriodicProTips();
    this.setupDomPersistenceObserver();
  }

  private getGreetingNotification(): MascotNotification {
    return createContextGreetingNotification(this.currentContext, {
      title: this.detectedTitle,
      company: this.detectedCompany
    });
  }

  private getMascotSvg(): string {
    return `
      <svg class="hacky-avatar-svg" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bodyGrad" x1="10" y1="10" x2="90" y2="90" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#FFFFFF" />
            <stop offset="60%" stop-color="#F1F5F9" />
            <stop offset="100%" stop-color="#CBD5E1" />
          </linearGradient>
          <linearGradient id="irisGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#6760FD" />
            <stop offset="50%" stop-color="#4F46E5" />
            <stop offset="100%" stop-color="#312E81" />
          </linearGradient>
          <linearGradient id="capGrad" x1="20" y1="5" x2="80" y2="35" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#1E1B4B" />
            <stop offset="100%" stop-color="#0F172A" />
          </linearGradient>
          <linearGradient id="tasselGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#FDE047" />
            <stop offset="100%" stop-color="#F59E0B" />
          </linearGradient>
          <linearGradient id="haloGrad" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#4F46E5" />
            <stop offset="35%" stop-color="#818CF8" />
            <stop offset="70%" stop-color="#C084FC" />
            <stop offset="100%" stop-color="#4F46E5" />
          </linearGradient>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        <!-- Shadow under character -->
        <ellipse cx="50" cy="94" rx="28" ry="5" fill="rgba(15, 23, 42, 0.25)" class="hacky-shadow" />

        <!-- Floating Aura Glow -->
        <circle cx="50" cy="52" r="38" stroke="url(#haloGrad)" stroke-width="2" fill="none" opacity="0.6" class="hacky-aura-ring" />

        <!-- Main Body (Owl / AI Robot form) -->
        <path d="M 24 54 C 24 32, 76 32, 76 54 C 76 76, 70 88, 50 88 C 30 88, 24 76, 24 54 Z" fill="url(#bodyGrad)" stroke="#94A3B8" stroke-width="1.5" />

        <!-- Belly Plate with Holographic Screen Glow -->
        <path d="M 34 60 C 34 50, 66 50, 66 60 C 66 75, 62 82, 50 82 C 38 82, 34 75, 34 60 Z" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1" />
        
        <!-- Chest AI Core Light -->
        <circle cx="50" cy="68" r="4.5" fill="#4F46E5" filter="url(#glow)" class="hacky-core-pulse" />
        <circle cx="50" cy="68" r="2" fill="#A5B4FC" />

        <!-- Left Wing -->
        <path d="M 24 52 C 16 54, 15 68, 22 74 C 25 70, 26 62, 25 54 Z" fill="#E2E8F0" stroke="#CBD5E1" stroke-width="1" class="hacky-left-wing" />

        <!-- Right Wing (Waving) -->
        <path d="M 76 52 C 84 54, 85 68, 78 74 C 75 70, 74 62, 75 54 Z" fill="#E2E8F0" stroke="#CBD5E1" stroke-width="1" class="hacky-right-wing" />

        <!-- Cheek Blush -->
        <circle cx="34" cy="55" r="4" fill="#F472B6" opacity="0.4" />
        <circle cx="66" cy="55" r="4" fill="#F472B6" opacity="0.4" />

        <!-- Left Eye Socket -->
        <circle cx="38" cy="46" r="10" fill="#0F172A" stroke="#4F46E5" stroke-width="1.5" />
        <!-- Left Eye Iris (Glowing Deep Iris) -->
        <circle cx="38" cy="46" r="7.5" fill="url(#irisGrad)" class="hacky-iris" />
        <!-- Left Eye Pupil & Highlights -->
        <g class="hacky-eye-left">
          <circle cx="38" cy="46" r="5" fill="#0F172A" />
          <circle cx="36" cy="44" r="2.2" fill="#FFFFFF" />
          <circle cx="40" cy="48" r="1" fill="#A5B4FC" />
        </g>

        <!-- Right Eye Socket -->
        <circle cx="62" cy="46" r="10" fill="#0F172A" stroke="#4F46E5" stroke-width="1.5" />
        <!-- Right Eye Iris -->
        <circle cx="62" cy="46" r="7.5" fill="url(#irisGrad)" class="hacky-iris" />
        <!-- Right Eye Pupil & Highlights -->
        <g class="hacky-eye-right">
          <circle cx="62" cy="46" r="5" fill="#0F172A" />
          <circle cx="60" cy="44" r="2.2" fill="#FFFFFF" />
          <circle cx="64" cy="48" r="1" fill="#A5B4FC" />
        </g>

        <!-- Cute Beak / Mouth -->
        <polygon points="50,50 46,55 54,55" fill="#F59E0B" stroke="#D97706" stroke-width="0.75" />

        <!-- Academic Graduation Cap -->
        <g class="hacky-grad-cap">
          <!-- Cap Skull Base -->
          <ellipse cx="50" cy="30" rx="16" ry="4.5" fill="#0F172A" />
          <!-- Diamond Board -->
          <polygon points="50,14 78,24 50,34 22,24" fill="url(#capGrad)" stroke="#312E81" stroke-width="1.2" />
          <!-- Cap Button -->
          <ellipse cx="50" cy="24" rx="2.5" ry="1.5" fill="#F59E0B" />
          <!-- Tassel Ribbon & Charm -->
          <path d="M 50 24 C 65 24, 74 34, 76 44" stroke="url(#tasselGrad)" stroke-width="1.8" fill="none" stroke-linecap="round" class="hacky-tassel" />
          <circle cx="76" cy="44" r="2" fill="#F59E0B" />
        </g>
      </svg>
    `;
  }

  private getStyles(): string {
    return `
      :host {
        all: initial;
        font-family: 'Plus Jakarta Sans', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 13px;
        line-height: 1.4;
        color: #0F172A;
        z-index: 2147483647;
        pointer-events: none;
        user-select: none;
        -webkit-user-select: none;
      }

      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
        pointer-events: auto;
      }

      /* ── Mascot Container (Fixed Bottom-Right with Clamping) ── */
      .hacky-dock {
        position: fixed;
        bottom: 24px;
        right: 24px;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 12px;
        z-index: 2147483647;
        transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease;
        touch-action: none;
      }

      /* ── Mascot Floating Avatar ── */
      .hacky-avatar-btn {
        position: relative;
        width: 76px;
        height: 76px;
        cursor: pointer;
        background: transparent;
        border: none;
        outline: none;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        filter: drop-shadow(0 10px 25px rgba(79, 70, 229, 0.28));
      }

      .hacky-avatar-btn:hover {
        transform: scale(1.08) translateY(-4px);
      }

      .hacky-avatar-btn:active {
        transform: scale(0.95);
      }

      .hacky-avatar-btn.attention-bounce {
        animation: hacky-attention-bounce 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 2;
      }

      @keyframes hacky-attention-bounce {
        0%, 100% { transform: translateY(0) scale(1); }
        50% { transform: translateY(-12px) scale(1.1); }
      }

      .hacky-avatar-svg {
        width: 100%;
        height: 100%;
        animation: hacky-float 3.5s ease-in-out infinite;
      }

      @keyframes hacky-float {
        0%, 100% { transform: translateY(0px); }
        50% { transform: translateY(-7px); }
      }

      .hacky-shadow {
        animation: hacky-shadow-scale 3.5s ease-in-out infinite;
        transform-origin: 50% 94%;
      }

      @keyframes hacky-shadow-scale {
        0%, 100% { transform: scale(1); opacity: 0.25; }
        50% { transform: scale(0.85); opacity: 0.15; }
      }

      .hacky-aura-ring {
        animation: hacky-spin 12s linear infinite;
        transform-origin: 50% 52%;
      }

      @keyframes hacky-spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }

      .hacky-core-pulse {
        animation: hacky-pulse 2s ease-in-out infinite;
      }

      @keyframes hacky-pulse {
        0%, 100% { r: 4.5px; opacity: 1; }
        50% { r: 6.5px; opacity: 0.75; }
      }

      .hacky-right-wing {
        transform-origin: 76px 54px;
        transition: transform 0.3s ease;
      }

      .hacky-avatar-btn:hover .hacky-right-wing {
        animation: hacky-wave 0.8s ease-in-out infinite alternate;
      }

      @keyframes hacky-wave {
        from { transform: rotate(0deg); }
        to { transform: rotate(-22deg); }
      }

      .hacky-tassel {
        transform-origin: 50px 24px;
        animation: hacky-tassel-wiggle 4s ease-in-out infinite;
      }

      @keyframes hacky-tassel-wiggle {
        0%, 100% { transform: rotate(0deg); }
        25% { transform: rotate(6deg); }
        75% { transform: rotate(-5deg); }
      }

      /* ── Live Status Indicator Dot ── */
      .hacky-status-pip {
        position: absolute;
        top: 2px;
        right: 4px;
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: #10B981;
        border: 2.5px solid #FFFFFF;
        box-shadow: 0 0 10px rgba(16, 185, 129, 0.6);
        animation: hacky-pip-glow 2s infinite;
      }

      @keyframes hacky-pip-glow {
        0%, 100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
        50% { box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
      }

      /* ── Hacky Name Tag Badge ── */
      .hacky-name-tag {
        position: absolute;
        bottom: -4px;
        left: 50%;
        transform: translateX(-50%);
        background: linear-gradient(135deg, #4F46E5, #6366F1);
        color: #FFFFFF;
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 0.2px;
        padding: 2px 8px;
        border-radius: 12px;
        border: 1.5px solid #FFFFFF;
        box-shadow: 0 2px 8px rgba(79, 70, 229, 0.45);
        white-space: nowrap;
        pointer-events: none;
        z-index: 2;
        transition: transform 0.2s ease;
      }

      .hacky-avatar-btn:hover .hacky-name-tag {
        transform: translateX(-50%) scale(1.06);
      }

      /* ── Notification Count Badge (Top-Left) ── */
      .hacky-badge-counter {
        position: absolute;
        top: -2px;
        left: -2px;
        background: linear-gradient(135deg, #EF4444, #F59E0B);
        color: #FFFFFF;
        font-size: 10px;
        font-weight: 800;
        padding: 2px 6px;
        border-radius: 12px;
        border: 1.5px solid #FFFFFF;
        box-shadow: 0 2px 6px rgba(239, 68, 68, 0.4);
        letter-spacing: -0.02em;
        transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
        z-index: 3;
        animation: hacky-badge-pulse 1s ease-in-out infinite alternate;
      }

      .hacky-badge-counter.hidden {
        display: none !important;
      }

      @keyframes hacky-badge-pulse {
        from { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
        to { transform: scale(1.15); box-shadow: 0 0 12px rgba(239, 68, 68, 0.9); }
      }

      /* ── Speech Bubble (Context Greeting & Proactive Alert) ── */
      .hacky-speech-bubble {
        width: 300px;
        background: rgba(255, 255, 255, 0.95);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border: 1px solid rgba(226, 232, 240, 0.9);
        border-radius: 18px;
        border-bottom-right-radius: 4px;
        padding: 14px;
        box-shadow: 0 14px 40px -8px rgba(15, 23, 42, 0.18), 0 4px 14px -2px rgba(79, 70, 229, 0.12);
        display: flex;
        flex-direction: column;
        gap: 8px;
        position: relative;
        animation: hacky-pop 0.35s cubic-bezier(0.16, 1, 0.3, 1);
        transform-origin: bottom right;
        transition: all 0.25s ease;
      }

      .hacky-speech-bubble.hidden {
        display: none !important;
      }

      @keyframes hacky-pop {
        from { transform: scale(0.85) translateY(12px); opacity: 0; }
        to { transform: scale(1) translateY(0); opacity: 1; }
      }

      /* Holographic border effect */
      .hacky-speech-bubble::before {
        content: '';
        position: absolute;
        inset: -1px;
        border-radius: inherit;
        padding: 1px;
        background: linear-gradient(135deg, rgba(79, 70, 229, 0.4), rgba(129, 140, 248, 0.4), rgba(192, 132, 252, 0.4), rgba(79, 70, 229, 0.4));
        -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
        -webkit-mask-composite: xor;
        mask-composite: exclude;
        pointer-events: none;
      }

      /* Proactive Job Alert Glow & Highlight Style */
      .hacky-speech-bubble.job-alert {
        border-color: rgba(245, 158, 11, 0.6);
        box-shadow: 0 16px 45px -8px rgba(245, 158, 11, 0.25), 0 6px 20px -2px rgba(79, 70, 229, 0.2);
        animation: hacky-pop 0.35s cubic-bezier(0.16, 1, 0.3, 1), hacky-alert-glow 3s infinite alternate ease-in-out;
      }

      .hacky-speech-bubble.job-alert::before {
        background: linear-gradient(135deg, #F59E0B, #EF4444, #8B5CF6, #F59E0B);
      }

      @keyframes hacky-alert-glow {
        0% { filter: drop-shadow(0 0 6px rgba(245, 158, 11, 0.3)); }
        100% { filter: drop-shadow(0 0 14px rgba(239, 68, 68, 0.5)); }
      }

      .hacky-bubble-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 6px;
      }

      .hacky-bubble-tag {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: #4F46E5;
        background: #EEF2FF;
        padding: 3px 9px;
        border-radius: 12px;
      }

      .hacky-speech-bubble.job-alert .hacky-bubble-tag {
        color: #B45309;
        background: #FEF3C7;
      }

      .hacky-bubble-tag-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #4F46E5;
      }

      .hacky-speech-bubble.job-alert .hacky-bubble-tag-dot {
        background: #F59E0B;
        box-shadow: 0 0 6px #F59E0B;
      }

      .hacky-bubble-close {
        background: transparent;
        border: none;
        color: #94A3B8;
        cursor: pointer;
        font-size: 14px;
        width: 22px;
        height: 22px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.15s ease;
      }

      .hacky-bubble-close:hover {
        background: #F1F5F9;
        color: #0F172A;
      }

      .hacky-bubble-title {
        font-size: 13px;
        font-weight: 700;
        color: #0F172A;
        line-height: 1.35;
      }

      .hacky-bubble-body {
        font-size: 12px;
        color: #475569;
        line-height: 1.45;
      }

      .hacky-btn-main {
        width: 100%;
        background: linear-gradient(135deg, #4F46E5, #6366F1);
        color: #FFFFFF;
        font-weight: 700;
        font-size: 12px;
        padding: 9px 14px;
        border-radius: 10px;
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        box-shadow: 0 4px 12px rgba(79, 70, 229, 0.35);
        transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      }

      .hacky-speech-bubble.job-alert .hacky-btn-main {
        background: linear-gradient(135deg, #4F46E5, #7C3AED);
        box-shadow: 0 4px 14px rgba(124, 58, 237, 0.4);
      }

      .hacky-btn-main:hover {
        background: linear-gradient(135deg, #4338CA, #4F46E5);
        transform: translateY(-1px);
        box-shadow: 0 6px 16px rgba(79, 70, 229, 0.45);
      }

      .hacky-btn-main:active {
        transform: translateY(0);
      }

      /* ── Expandable Quick Actions Menu ── */
      .hacky-quick-menu {
        width: 300px;
        background: rgba(255, 255, 255, 0.96);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border: 1px solid #E2E8F0;
        border-radius: 18px;
        padding: 10px;
        box-shadow: 0 16px 40px -10px rgba(15, 23, 42, 0.2);
        display: flex;
        flex-direction: column;
        gap: 6px;
        animation: hacky-pop 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        transform-origin: bottom right;
      }

      .hacky-quick-menu.hidden {
        display: none !important;
      }

      .hacky-menu-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 4px 8px 8px;
        border-bottom: 1px solid #F1F5F9;
      }

      .hacky-menu-title {
        font-size: 11px;
        font-weight: 800;
        color: #64748B;
        text-transform: uppercase;
        letter-spacing: 0.6px;
      }

      .hacky-menu-action {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 9px 12px;
        border-radius: 10px;
        background: #F8FAFC;
        border: 1px solid #F1F5F9;
        color: #0F172A;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.15s ease;
        text-align: left;
        width: 100%;
      }

      .hacky-menu-action:hover {
        background: #EEF2FF;
        border-color: #C7D2FE;
        color: #4F46E5;
        transform: translateX(-2px);
      }

      .hacky-menu-action-icon {
        font-size: 16px;
        flex-shrink: 0;
      }

      .hacky-menu-action-badge {
        margin-left: auto;
        font-size: 10px;
        font-weight: 800;
        background: #10B981;
        color: #FFFFFF;
        padding: 1px 6px;
        border-radius: 10px;
      }

      /* ── Minimized Floating Pill (When Minimized) ── */
      .hacky-minimized-pill {
        display: none;
        align-items: center;
        gap: 6px;
        background: #0F172A;
        color: #FFFFFF;
        padding: 6px 12px;
        border-radius: 24px;
        cursor: pointer;
        box-shadow: 0 4px 16px rgba(15, 23, 42, 0.35);
        border: 1px solid #334155;
        font-size: 11px;
        font-weight: 700;
        transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        pointer-events: auto;
      }

      .hacky-minimized-pill:hover {
        background: #4F46E5;
        transform: scale(1.05);
      }

      .hacky-dock.minimized .hacky-avatar-btn,
      .hacky-dock.minimized .hacky-speech-bubble,
      .hacky-dock.minimized .hacky-quick-menu {
        display: none !important;
      }

      .hacky-dock.minimized .hacky-minimized-pill {
        display: flex !important;
      }

      /* ── Particle Confetti Stars ── */
      .hacky-particle {
        position: fixed;
        pointer-events: none;
        z-index: 2147483647;
        font-size: 14px;
        animation: hacky-particle-fly 0.9s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      }

      @keyframes hacky-particle-fly {
        0% { transform: translate(0, 0) scale(1) rotate(0deg); opacity: 1; }
        100% { transform: translate(var(--tx), var(--ty)) scale(0) rotate(180deg); opacity: 0; }
      }

      /* Drag handle hover indicator */
      .hacky-drag-hint {
        position: absolute;
        bottom: -16px;
        left: 50%;
        transform: translateX(-50%);
        font-size: 9px;
        font-weight: 800;
        color: #94A3B8;
        background: rgba(255, 255, 255, 0.9);
        padding: 1px 6px;
        border-radius: 6px;
        opacity: 0;
        transition: opacity 0.2s;
        pointer-events: none;
        white-space: nowrap;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      }

      .hacky-avatar-btn:hover .hacky-drag-hint {
        opacity: 0.9;
      }
    `;
  }

  private render(state: MascotState): void {
    if (!this.shadow) return;

    const defaultNotif = this.getGreetingNotification();
    this.activeNotification = defaultNotif;

    this.shadow.innerHTML = `
      <style>${this.getStyles()}</style>

      <div class="hacky-dock ${state.isMinimized ? 'minimized' : ''}" id="hacky-dock">
        
        <!-- Speech Bubble Greeting & Proactive Alert -->
        <div class="hacky-speech-bubble" id="hacky-speech-bubble">
          <div class="hacky-bubble-header">
            <div class="hacky-bubble-tag" id="hacky-bubble-tag">
              <span class="hacky-bubble-tag-dot"></span>
              <span id="hacky-tag-text">${defaultNotif.badge}</span>
            </div>
            <button class="hacky-bubble-close" id="hacky-bubble-close" title="Dismiss notification">✕</button>
          </div>
          <div class="hacky-bubble-title" id="hacky-bubble-title">${defaultNotif.title}</div>
          <div class="hacky-bubble-body" id="hacky-bubble-body">${defaultNotif.body}</div>
          <button class="hacky-btn-main" id="hacky-btn-open-copilot">
            <span id="hacky-btn-text">${defaultNotif.ctaText}</span>
          </button>
        </div>

        <!-- Expandable Quick Actions Menu -->
        <div class="hacky-quick-menu hidden" id="hacky-quick-menu">
          <div class="hacky-menu-header">
            <span class="hacky-menu-title">🦉 Hacky</span>
            <button class="hacky-bubble-close" id="hacky-menu-close">✕</button>
          </div>
          <button class="hacky-menu-action" id="hacky-act-copilot">
            <span class="hacky-menu-action-icon">🚀</span>
            <span>Open Hacky Side Panel</span>
          </button>
          <button class="hacky-menu-action" id="hacky-act-scan">
            <span class="hacky-menu-action-icon">🎯</span>
            <span>Scan Page Resume (ATS Audit)</span>
          </button>
          <button class="hacky-menu-action" id="hacky-act-autofill">
            <span class="hacky-menu-action-icon">⚡</span>
            <span>1-Click Autofill Form</span>
          </button>
          <button class="hacky-menu-action" id="hacky-act-internships">
            <span class="hacky-menu-action-icon">💼</span>
            <span>Browse 2026 Internships</span>
            <span class="hacky-menu-action-badge" id="hacky-menu-badge">+${this.currentJobsCount}</span>
          </button>
          <button class="hacky-menu-action" id="hacky-act-tip">
            <span class="hacky-menu-action-icon">💡</span>
            <span>AI Resume Pro-Tip</span>
          </button>
        </div>

        <!-- Main Mascot Avatar Button -->
        <button class="hacky-avatar-btn" id="hacky-avatar-btn" title="Hacky — Click to open · Drag to move">
          ${this.getMascotSvg()}
          <span class="hacky-status-pip" title="Hacky AI Active"></span>
          <span class="hacky-name-tag" id="hacky-name-tag">Hacky</span>
          <span class="hacky-badge-counter ${this.currentJobsCount > 0 ? '' : 'hidden'}" id="hacky-badge-counter">+${this.currentJobsCount}</span>
          <span class="hacky-drag-hint">Click or Drag</span>
        </button>

        <!-- Minimized Floating Pill -->
        <div class="hacky-minimized-pill" id="hacky-minimized-pill">
          <span>🦉 Hacky</span>
          <span style="color: #A5B4FC;">⚡</span>
        </div>

      </div>
    `;

    this.applyPosition(state.position);
  }

  public applyPosition(pos: { x: number; y: number } | null): void {
    const dock = this.shadow?.getElementById('hacky-dock');
    if (!dock) return;

    if (pos && typeof pos.x === 'number' && typeof pos.y === 'number') {
      const winW = (typeof window !== 'undefined' ? window.innerWidth : 1024) || document.documentElement?.clientWidth || 1024;
      const winH = (typeof window !== 'undefined' ? window.innerHeight : 768) || document.documentElement?.clientHeight || 768;
      const clamped = clampMascotPosition(pos, { width: winW, height: winH }, { width: 76, height: 76 }, 12);
      dock.style.right = 'auto';
      dock.style.bottom = 'auto';
      dock.style.left = `${clamped.x}px`;
      dock.style.top = `${clamped.y}px`;
      this.currentPos = clamped;
    } else {
      dock.style.right = '24px';
      dock.style.bottom = '24px';
      dock.style.left = 'auto';
      dock.style.top = 'auto';
      this.currentPos = null;
    }
  }

  public showNotification(notif: MascotNotification): void {
    if (!this.shadow) return;
    this.activeNotification = notif;

    const bubble = this.shadow.getElementById('hacky-speech-bubble');
    const menu = this.shadow.getElementById('hacky-quick-menu');
    const tagText = this.shadow.getElementById('hacky-tag-text');
    const titleEl = this.shadow.getElementById('hacky-bubble-title');
    const bodyEl = this.shadow.getElementById('hacky-bubble-body');
    const btnText = this.shadow.getElementById('hacky-btn-text');
    const avatarBtn = this.shadow.getElementById('hacky-avatar-btn');

    if (tagText) tagText.textContent = notif.badge;
    if (titleEl) titleEl.textContent = notif.title;
    if (bodyEl) bodyEl.textContent = notif.body;
    if (btnText) btnText.textContent = notif.ctaText;

    if (menu) menu.classList.add('hidden');

    if (bubble) {
      if (notif.type === 'NEW_JOBS_ALERT') {
        bubble.classList.add('job-alert');
      } else {
        bubble.classList.remove('job-alert');
      }
      bubble.classList.remove('hidden');

      // Trigger attention bounce on mascot avatar
      if (avatarBtn) {
        avatarBtn.classList.remove('attention-bounce');
        void avatarBtn.offsetWidth; // trigger reflow
        avatarBtn.classList.add('attention-bounce');
        setTimeout(() => avatarBtn?.classList.remove('attention-bounce'), 1300);
      }

      // Clear previous timeout and set 12-second auto-dismiss
      if (this.speechTimeout) clearTimeout(this.speechTimeout);
      this.speechTimeout = setTimeout(() => {
        if (bubble && !bubble.matches(':hover')) {
          bubble.classList.add('hidden');
        }
      }, 12000);
    }
  }

  public updateJobsCount(count: number): void {
    this.currentJobsCount = count;
    const badge = this.shadow?.getElementById('hacky-badge-counter');
    const menuBadge = this.shadow?.getElementById('hacky-menu-badge');

    if (badge) {
      if (count > 0) {
        badge.textContent = `+${count}`;
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
    }
    if (menuBadge) {
      menuBadge.textContent = `+${count}`;
    }
  }

  private setupListeners(): void {
    if (!this.shadow) return;

    const dock = this.shadow.getElementById('hacky-dock');
    const avatarBtn = this.shadow.getElementById('hacky-avatar-btn');
    const bubble = this.shadow.getElementById('hacky-speech-bubble');
    const bubbleClose = this.shadow.getElementById('hacky-bubble-close');
    const menu = this.shadow.getElementById('hacky-quick-menu');
    const menuClose = this.shadow.getElementById('hacky-menu-close');
    const openBtn = this.shadow.getElementById('hacky-btn-open-copilot');
    const minPill = this.shadow.getElementById('hacky-minimized-pill');

    // Menu Actions
    const actCopilot = this.shadow.getElementById('hacky-act-copilot');
    const actScan = this.shadow.getElementById('hacky-act-scan');
    const actAutofill = this.shadow.getElementById('hacky-act-autofill');
    const actInternships = this.shadow.getElementById('hacky-act-internships');
    const actTip = this.shadow.getElementById('hacky-act-tip');

    // 1. Click on Mascot Avatar -> Pop up ResumeHack Extension (Side Panel & Action Feedback)
    avatarBtn?.addEventListener('click', (e) => {
      if (this.hasMoved) {
        this.hasMoved = false;
        return; // Ignore clicks resulting from a drag
      }
      e.stopPropagation();
      this.detectPageContext();
      this.triggerSparkles(e.clientX, e.clientY);
      this.triggerAttentionBounce();
      const targetTab = this.activeNotification?.targetTab || (this.currentContext === 'form' ? 'tracker' : 'match');
      const autoScan = this.activeNotification?.autoScan !== undefined ? this.activeNotification.autoScan : (this.currentContext === 'docs');
      this.openExtensionSidePanel(targetTab, autoScan);
    });

    // Right-click / context menu on avatar -> Toggle Quick Menu
    avatarBtn?.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.toggleQuickMenu();
    });

    // 2. Click anywhere on Speech Bubble -> Pop up ResumeHack Extension
    bubble?.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target && (target.id === 'hacky-bubble-close' || target.closest('#hacky-bubble-close'))) {
        return; // Let the close button handler handle dismiss
      }
      e.stopPropagation();
      this.detectPageContext();
      this.triggerSparkles(e.clientX, e.clientY);
      this.triggerAttentionBounce();
      const targetTab = this.activeNotification?.targetTab || (this.currentContext === 'form' ? 'tracker' : 'match');
      const autoScan = this.activeNotification?.autoScan !== undefined ? this.activeNotification.autoScan : (this.currentContext === 'docs');
      this.openExtensionSidePanel(targetTab, autoScan);
      bubble.classList.add('hidden');
    });

    // Main CTA in speech bubble
    openBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.detectPageContext();
      this.triggerSparkles(e.clientX, e.clientY);
      this.triggerAttentionBounce();
      const targetTab = this.activeNotification?.targetTab || (this.currentContext === 'form' ? 'tracker' : 'match');
      const autoScan = this.activeNotification?.autoScan !== undefined ? this.activeNotification.autoScan : (this.currentContext === 'docs');
      this.openExtensionSidePanel(targetTab, autoScan);
      bubble?.classList.add('hidden');
    });

    // 3. Speech Bubble Close Button
    bubbleClose?.addEventListener('click', (e) => {
      e.stopPropagation();
      bubble?.classList.add('hidden');
      if (this.speechTimeout) clearTimeout(this.speechTimeout);
    });

    // 4. Quick Menu Close Button
    menuClose?.addEventListener('click', (e) => {
      e.stopPropagation();
      menu?.classList.add('hidden');
    });

    // 5. Minimized Pill Click -> Expand & Pop up Extension
    minPill?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.detectPageContext();
      dock?.classList.remove('minimized');
      this.saveState({ isMinimized: false });
      this.triggerSparkles(e.clientX, e.clientY);
      this.triggerAttentionBounce();
      const targetTab = this.currentContext === 'form' ? 'tracker' : 'match';
      const autoScan = this.currentContext === 'docs';
      this.openExtensionSidePanel(targetTab, autoScan);
    });

    // 6. Action: Open Copilot
    actCopilot?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.detectPageContext();
      this.triggerSparkles(e.clientX, e.clientY);
      this.triggerAttentionBounce();
      this.openExtensionSidePanel('match');
      menu?.classList.add('hidden');
    });

    // 7. Action: Scan Document
    actScan?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.detectPageContext();
      this.triggerSparkles(e.clientX, e.clientY);
      this.triggerAttentionBounce();
      this.openExtensionSidePanel('match', true);
      menu?.classList.add('hidden');
    });

    // 8. Action: Autofill Form
    actAutofill?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.triggerAutofillOnPage();
    });

    // 9. Action: Browse Internships
    actInternships?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.detectPageContext();
      this.triggerSparkles(e.clientX, e.clientY);
      this.triggerAttentionBounce();
      this.openExtensionSidePanel('discovery');
      menu?.classList.add('hidden');
    });

    // 10. Action: Pro-Tip
    actTip?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.showRandomTip();
    });

    // 11. Draggable Physics on Avatar
    this.setupDraggable(avatarBtn);

    // 12. Safe Window Viewport Clamping on Resize
    window.addEventListener('resize', () => {
      if (this.currentPos) {
        this.applyPosition(this.currentPos);
      }
    });

    // 13. Window focus & visibility change listener (survives window blur & stays 100% active)
    window.addEventListener('focus', () => {
      this.detectPageContext();
      this.ensureContainerMounted();
      this.syncWithStorage();
      if (!this.blinkInterval) {
        this.startEyeBlinking();
      }
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.detectPageContext();
        this.ensureContainerMounted();
        this.syncWithStorage();
      }
    });

    // SPA client-side route changes listener
    window.addEventListener('popstate', () => {
      this.detectPageContext();
    });
    window.addEventListener('hashchange', () => {
      this.detectPageContext();
    });

    // 14. Cross-window localStorage sync listener (same-origin tabs/windows)
    window.addEventListener('storage', (e) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed) {
            if (parsed.position !== undefined) {
              this.applyPosition(parsed.position);
            }
            if (dock) {
              if (parsed.isMinimized) {
                dock.classList.add('minimized');
              } else {
                dock.classList.remove('minimized');
              }
            }
          }
        } catch {}
      }
    });

    // 15. Runtime message listener for background push notifications & cross-window messages
    if (this.isExtensionValid() && chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
        try {
          if (message.type === 'PING_MASCOT') {
            sendResponse?.({ status: 'ok', alive: true, version: '1.1.0' });
            return true;
          }

          if (message.type === 'SYNC_MASCOT_STATE') {
            if (message.state) {
              if (message.state.position !== undefined) {
                this.applyPosition(message.state.position);
              }
              if (dock) {
                if (message.state.isMinimized) {
                  dock.classList.add('minimized');
                } else {
                  dock.classList.remove('minimized');
                }
              }
            }
            sendResponse?.({ status: 'ok' });
            return true;
          }

          if (message.type === 'UPDATE_JOBS_COUNT') {
            if (typeof message.count === 'number') {
              this.updateJobsCount(message.count);
            }
            sendResponse?.({ status: 'ok' });
            return true;
          }

          if (message.type === 'SHOW_IN_DOC_DIFFS' && message.payload?.diffs && this.currentContext === 'docs') {
            const currentDocId = (typeof window !== 'undefined' ? window.location.href : '').match(/\/document\/(?:u\/\d+\/)?d\/([a-zA-Z0-9-_]+)/)?.[1];
            if (message.payload.targetDocId && currentDocId && message.payload.targetDocId !== currentDocId) {
              return;
            }
            const count = message.payload.diffs.length;
            const notif: MascotNotification = {
              id: `star-suggestions-${Date.now()}`,
              type: 'CONTEXT_ALERT',
              badge: 'STAR Suggestions Active',
              title: `✨ ${count} STAR Suggestions Ready!`,
              body: 'Your tailored STAR bullet suggestions are live on your document. Click me anytime to reopen full panel.',
              ctaText: 'Reopen Side Panel ⚡',
              targetTab: 'match',
              timestamp: Date.now()
            };
            this.showNotification(notif);
          }

          const parsedNotif = parseNotificationPayload(message);
          if (parsedNotif) {
            if (typeof message.count === 'number') {
              this.updateJobsCount(message.count);
            }
            this.showNotification(parsedNotif);
            sendResponse?.({ status: 'ok', handled: true });
            return true;
          }

          if (message.type === 'NOTIFY_NEW_JOBS') {
            const count = message.count || this.currentJobsCount || 12;
            this.updateJobsCount(count);
            const notif = createJobAlertNotification(count, message.companies || ['Stripe', 'Google', 'OpenAI']);
            this.showNotification(notif);
            sendResponse?.({ status: 'ok' });
            return true;
          }
        } catch {
          // context invalidated
        }
      });
    }

    // 16. Storage change listener for reactive count badges, positions & alerts across all windows
    if (this.isExtensionValid() && chrome.storage?.onChanged) {
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === 'local') {
          if (changes[STORAGE_KEY]) {
            const newState = changes[STORAGE_KEY].newValue;
            if (newState) {
              if (newState.position !== undefined) {
                this.applyPosition(newState.position);
              }
              if (dock) {
                if (newState.isMinimized) {
                  dock.classList.add('minimized');
                } else {
                  dock.classList.remove('minimized');
                }
              }
            }
          }

          if (changes.resumehack_new_jobs_count) {
            const newCount = changes.resumehack_new_jobs_count.newValue;
            if (typeof newCount === 'number') {
              this.updateJobsCount(newCount);
              if (newCount > 0 && newCount !== changes.resumehack_new_jobs_count.oldValue) {
                const alertNotif = createJobAlertNotification(newCount, ['Stripe', 'Google', 'OpenAI']);
                this.showNotification(alertNotif);
              }
            }
          }
        }
      });
    }
  }

  private triggerAttentionBounce(): void {
    const avatarBtn = this.shadow?.getElementById('hacky-avatar-btn');
    if (avatarBtn) {
      avatarBtn.classList.remove('attention-bounce');
      void avatarBtn.offsetWidth; // trigger reflow
      avatarBtn.classList.add('attention-bounce');
      setTimeout(() => avatarBtn?.classList.remove('attention-bounce'), 1300);
    }
  }

  private setupDraggable(target: HTMLElement | null): void {
    if (!target) return;

    let dragStartTime = 0;
    const DRAG_THRESHOLD = 8;

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return; // Left click only
      this.isDragging = true;
      this.hasMoved = false;
      this.dragStartX = e.clientX;
      this.dragStartY = e.clientY;
      dragStartTime = Date.now();

      const dock = this.shadow?.getElementById('hacky-dock');
      if (dock) {
        const rect = dock.getBoundingClientRect();
        this.initialPosX = rect.left;
        this.initialPosY = rect.top;
      }

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!this.isDragging) return;

      const dx = e.clientX - this.dragStartX;
      const dy = e.clientY - this.dragStartY;
      const distance = Math.hypot(dx, dy);

      if (distance >= DRAG_THRESHOLD) {
        this.hasMoved = true;
      }

      const dock = this.shadow?.getElementById('hacky-dock');
      if (dock && this.hasMoved) {
        const newX = this.initialPosX + dx;
        const newY = this.initialPosY + dy;

        const winW = (typeof window !== 'undefined' ? window.innerWidth : 1024) || document.documentElement?.clientWidth || 1024;
        const winH = (typeof window !== 'undefined' ? window.innerHeight : 768) || document.documentElement?.clientHeight || 768;

        const clamped = clampMascotPosition({ x: newX, y: newY }, { width: winW, height: winH });

        dock.style.right = 'auto';
        dock.style.bottom = 'auto';
        dock.style.left = `${clamped.x}px`;
        dock.style.top = `${clamped.y}px`;
        this.currentPos = clamped;
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!this.isDragging) return;
      this.isDragging = false;

      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);

      const dx = e.clientX - this.dragStartX;
      const dy = e.clientY - this.dragStartY;
      const distance = Math.hypot(dx, dy);
      const duration = Date.now() - dragStartTime;

      if (distance < DRAG_THRESHOLD || duration < 180) {
        this.hasMoved = false;
      }

      if (this.hasMoved && this.currentPos) {
        this.saveState({ position: this.currentPos });
      }
    };

    target.addEventListener('pointerdown', onPointerDown);
  }

  private toggleQuickMenu(): void {
    const menu = this.shadow?.getElementById('hacky-quick-menu');
    const bubble = this.shadow?.getElementById('hacky-speech-bubble');
    if (!menu) return;

    if (menu.classList.contains('hidden')) {
      menu.classList.remove('hidden');
      bubble?.classList.add('hidden');
    } else {
      menu.classList.add('hidden');
    }
  }

  private showRandomTip(): void {
    const tipNotif = createProTipNotification();
    this.showNotification(tipNotif);
  }

  private triggerSparkles(x: number, y: number): void {
    const emojis = ['✨', '⚡', '🌟', '🎯', '🚀', '💎'];
    for (let i = 0; i < 8; i++) {
      const p = document.createElement('div');
      p.className = 'hacky-particle';
      p.textContent = emojis[Math.floor(Math.random() * emojis.length)];

      const angle = (i / 8) * Math.PI * 2;
      const dist = 35 + Math.random() * 45;
      const tx = Math.cos(angle) * dist;
      const ty = Math.sin(angle) * dist;

      p.style.left = `${x}px`;
      p.style.top = `${y}px`;
      p.style.setProperty('--tx', `${tx}px`);
      p.style.setProperty('--ty', `${ty}px`);

      const mount = document.body || document.documentElement;
      if (mount) {
        mount.appendChild(p);
        setTimeout(() => p.remove(), 950);
      }
    }
  }

  private openExtensionSidePanel(tab: 'match' | 'discovery' | 'tracker' = 'match', autoScan = false): void {
    if (!this.isExtensionValid()) {
      return;
    }

    try {
      this.detectPageContext();

      // 1. Set initial tab for side panel
      if (chrome.storage?.local) {
        chrome.storage.local.set({
          resumehack_active_tab: tab,
          resumehack_auto_scan: autoScan,
        }).catch(() => {});
      }

      // 2. Request background service worker to open the side panel
      this.safeSendMessage({
        type: 'OPEN_SIDEPANEL',
        tab,
        autoScan,
      }, (res) => {
        if (res?.status === 'opened') {
          console.log(`[ResumeHack Mascot] Extension opened via ${res.target}`);
        }
      });
    } catch (e: any) {
      console.debug('[Hacky Mascot] Note on side panel open:', e);
    }
  }

  private triggerAutofillOnPage(): void {
    const menu = this.shadow?.getElementById('hacky-quick-menu');
    menu?.classList.add('hidden');

    const inputs = document.querySelectorAll('input:not([type="hidden"]), textarea, select');
    let filled = 0;

    const PROFILE = {
      name: 'Alex Chen',
      email: 'alex.chen@example.com',
      phone: '415-555-0199',
      linkedin: 'https://linkedin.com/in/alexchen',
      github: 'https://github.com/alexchen',
      portfolio: 'https://alexchen.dev',
      school: 'UC Berkeley',
      gpa: '3.85'
    };

    inputs.forEach((el) => {
      const input = el as HTMLInputElement;
      const id = `${input.name || ''} ${input.id || ''} ${input.placeholder || ''}`.toLowerCase();
      if (input.value) return;

      if (id.includes('name') && !id.includes('company')) {
        input.value = PROFILE.name;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        filled++;
      } else if (id.includes('email')) {
        input.value = PROFILE.email;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        filled++;
      } else if (id.includes('phone')) {
        input.value = PROFILE.phone;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        filled++;
      } else if (id.includes('linkedin')) {
        input.value = PROFILE.linkedin;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        filled++;
      } else if (id.includes('github')) {
        input.value = PROFILE.github;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        filled++;
      }
    });

    this.showNotification({
      id: `autofill-${Date.now()}`,
      type: 'CONTEXT_ALERT',
      badge: 'Autofill Complete',
      title: `⚡ Autofilled ${filled} Fields!`,
      body: 'Autofilled your candidate details. Review and submit your application!',
      ctaText: 'View Applications 💼',
      targetTab: 'tracker',
      timestamp: Date.now()
    });
  }

  private setupAutoGreeting(): void {
    const bubble = this.shadow?.getElementById('hacky-speech-bubble');
    if (!bubble) return;

    // Show speech bubble on page load, automatically minimize after 9 seconds if not hovered
    this.speechTimeout = setTimeout(() => {
      if (bubble && !bubble.matches(':hover')) {
        bubble.classList.add('hidden');
      }
    }, 9000);
  }

  private startPeriodicProTips(): void {
    // Schedule periodic pro-tips every 90 seconds when idle
    this.periodicTipInterval = setInterval(() => {
      if (!this.isExtensionValid()) {
        if (this.periodicTipInterval) clearInterval(this.periodicTipInterval);
        return;
      }
      const bubble = this.shadow?.getElementById('hacky-speech-bubble');
      const dock = this.shadow?.getElementById('hacky-dock');

      // Only show if speech bubble is currently hidden and mascot is not minimized
      if (bubble?.classList.contains('hidden') && !dock?.classList.contains('minimized')) {
        const notif = createProTipNotification();
        this.showNotification(notif);
      }
    }, 90000);
  }

  private startEyeBlinking(): void {
    this.blinkInterval = setInterval(() => {
      if (!this.isExtensionValid()) {
        if (this.blinkInterval) clearInterval(this.blinkInterval);
        return;
      }
      if (!this.shadow) return;
      const leftEye = this.shadow.querySelector('.hacky-eye-left') as SVGElement;
      const rightEye = this.shadow.querySelector('.hacky-eye-right') as SVGElement;

      if (leftEye && rightEye) {
        leftEye.style.transform = 'scaleY(0.1)';
        leftEye.style.transformOrigin = '38px 46px';
        rightEye.style.transform = 'scaleY(0.1)';
        rightEye.style.transformOrigin = '62px 46px';

        setTimeout(() => {
          leftEye.style.transform = 'scaleY(1)';
          rightEye.style.transform = 'scaleY(1)';
        }, 160);
      }
    }, 4500 + Math.random() * 2000);
  }
}

// ── Initialize Mascot ──────────────────────────────────────────────────────────
function startMascot(): void {
  try {
    if (typeof window !== 'undefined') {
      if ((window as any).__RESUMEHACK_MASCOT_INITIALIZED__) {
        const root = document.getElementById('resumehack-mascot-root');
        if (!root && (window as any).__RESUMEHACK_MASCOT_INSTANCE__) {
          (window as any).__RESUMEHACK_MASCOT_INSTANCE__.ensureContainerMounted();
        }
        return;
      }
      const instance = new HackyMascot();
      (window as any).__RESUMEHACK_MASCOT_INITIALIZED__ = true;
      (window as any).__RESUMEHACK_MASCOT_INSTANCE__ = instance;
    }
  } catch (e) {
    console.debug('[ResumeHack Hacky] Mascot start note:', e);
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startMascot);
  } else {
    startMascot();
  }
}
