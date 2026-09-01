/**
 * CdpDocsEditorService — Authoritative Structural REST API Google Docs Editor
 *
 * Re-architected: Eliminates all CDP / chrome.debugger UI automation, synthetic
 * keystrokes, offscreen stealth shields, and DOM toast scraping.
 *
 * Directly executes structural Google Docs REST API batchUpdate (deleteContentRange + insertText)
 * using OAuth2 access tokens and documents.get structural index resolution.
 */

import { TailoredBulletDiff } from '../types/index.js';
import { GoogleDocsService, RobustTextMatcher, BatchUpdateResult } from './google-docs.js';

export { RobustTextMatcher };

export interface CdpEditResult {
  success: boolean;
  appliedCount: number;
  error?: string;
  details?: string[];
  replies?: any[];
  writeControl?: any;
}

export class CdpDocsEditorService {
  private docsService: GoogleDocsService;

  constructor(docsService?: GoogleDocsService) {
    this.docsService = docsService || new GoogleDocsService();
  }

  /**
   * Always supported via Google Docs REST API.
   */
  public isSupported(): boolean {
    return true;
  }

  /**
   * Retained for interface backward compatibility.
   */
  public isAttached(_tabId: number): boolean {
    return true;
  }

  /**
   * No-op warm-up retained for interface backward compatibility.
   */
  public async ensureAttached(_tabId: number): Promise<void> {
    // Structural REST API does not require attaching Chrome Debugger
  }

  /**
   * No-op detach retained for interface backward compatibility.
   */
  public async detachDebugger(_tabId: number): Promise<void> {
    // No debugger attached
  }

  /**
   * Directly applies accepted diffs to the target Google Doc using structural
   * REST API batch updates (documents.get + index-resolved batchUpdate).
   */
  public async applyDiffsDirectly(
    tabIdOrDocId: number | string,
    diffs: TailoredBulletDiff[],
    accessToken?: string
  ): Promise<CdpEditResult> {
    const accepted = diffs.filter((d) => d.status === 'accepted');
    if (accepted.length === 0) {
      return { success: true, appliedCount: 0, details: ['No accepted diffs to apply'] };
    }

    let docId: string | null = null;

    if (typeof tabIdOrDocId === 'string') {
      docId = tabIdOrDocId;
    } else if (typeof chrome !== 'undefined' && (chrome as any).tabs?.get) {
      try {
        const tabInfo = await (chrome as any).tabs.get(tabIdOrDocId);
        if (tabInfo?.url) {
          const match = tabInfo.url.match(/docs\.google\.com\/document\/(?:u\/\d+\/)?d\/([a-zA-Z0-9_-]+)/);
          if (match) docId = match[1];
        }
      } catch (err) {
        console.debug('[CdpDocsEditorService] Tab lookup note:', err);
      }
    }

    if (!docId) {
      docId = 'active-doc';
    }

    const result: BatchUpdateResult = await this.docsService.applyBatchUpdates(
      docId,
      accepted,
      accessToken
    );

    return {
      success: result.success,
      appliedCount: result.updatedCount,
      error: result.error,
      details: result.details,
      replies: result.replies,
      writeControl: result.writeControl,
    };
  }
}
