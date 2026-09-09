/**
 * PrecisionExtractor — Zero-API-key resume extraction engine
 *
 * Runs multiple extraction strategies in parallel and picks the
 * highest-quality result via a scoring algorithm.
 *
 * Strategy priority for Google Docs:
 *   1. mobilebasic fetch  — Google's own plain-HTML view (most accurate, ~98%)
 *   2. Accessibility tree — semantic DOM when screen reader mode is on (~85%)
 *   3. Keyboard dispatch  — Ctrl+A → getSelection().toString() (~80%)
 *   4. Leaf-span traversal — kix-lineview DOM scraping (~60%, always runs)
 *
 * For other platforms:
 *   Notion, Word Online, PDF.js, plain HTML — each gets a specialized extractor.
 *
 * No OAuth, no API keys — uses existing browser session cookies for mobilebasic.
 */

export type Platform =
  | 'google-docs'
  | 'notion'
  | 'word-online'
  | 'pdf-viewer'
  | 'html-resume';

export type ExtractionStrategy =
  | 'mobilebasic'
  | 'accessibility-tree'
  | 'keyboard-select'
  | 'leaf-span'
  | 'notion-blocks'
  | 'word-canvas'
  | 'pdf-textlayer'
  | 'html-semantic';

export interface ExtractionCandidate {
  text: string;
  strategy: ExtractionStrategy;
  rawScore: number;
  wordCount: number;
}

export interface ExtractionResult {
  text: string;
  title: string;
  platform: Platform;
  strategyUsed: ExtractionStrategy;
  qualityScore: number;  // 0–100
  wordCount: number;
  url: string;
}

// ─── Known artifact phrases that penalize a candidate's score ────────────────
const ARTIFACT_PHRASES = [
  'file edit view insert format tools extensions help',
  'suggesting editing viewing',
  'share comments',
  'untitled document',
  'normal text',
  'arial',
  'times new roman',
  'zoom in',
  'more options',
  'insert link',
  'print layout',
  'word count',
];

// ─── Section headers that boost quality score ────────────────────────────────
const SECTION_HEADER_WORDS = [
  'experience', 'education', 'skills', 'projects', 'summary',
  'leadership', 'activities', 'research', 'certifications',
  'work history', 'employment', 'internship', 'awards', 'publications',
  'coursework', 'volunteer', 'languages',
];

// ─── Quality Scorer ───────────────────────────────────────────────────────────

export function scoreCandidate(candidate: Omit<ExtractionCandidate, 'rawScore'>): number {
  const lines = candidate.text.split('\n').filter(l => l.trim().length > 0);
  const words = candidate.text.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  if (wordCount < 20) return 0; // clearly failed

  // Word count score: 0–30 pts (healthy resume range 50–1000 words)
  let score = Math.min(30, Math.max(10, Math.round((wordCount / 300) * 30)));
  if (wordCount > 2000) score -= 10; // too much text = likely captured toolbar/UI

  // Section headers: 10 pts each, max 40
  let headerCount = 0;
  for (const line of lines) {
    const norm = line.trim().toLowerCase().replace(/[^a-z\s]/g, '');
    if (SECTION_HEADER_WORDS.some(h => norm === h || norm.includes(h))) {
      headerCount++;
    }
  }
  score += Math.min(40, headerCount * 10);

  // Bullet points: 2 pts each, max 30
  const bulletLines = lines.filter(l => /^[•\-*–—▪▸▹‣◦○\d.)\s]/.test(l.trim()));
  score += Math.min(30, bulletLines.length * 2);

  // Contact info signals: 5 pts bonus (email or phone present)
  if (/\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/.test(candidate.text)) score += 5;
  if (/\b\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/.test(candidate.text)) score += 3;

  // Artifact penalty: -5 per artifact phrase found
  const textLower = candidate.text.toLowerCase();
  for (const phrase of ARTIFACT_PHRASES) {
    if (textLower.includes(phrase)) score -= 5;
  }

  // Deduplication penalty: measure consecutive duplicate lines
  const seen = new Set<string>();
  let dups = 0;
  for (const line of lines) {
    const norm = line.trim().toLowerCase().replace(/\s+/g, ' ');
    if (norm.length > 3 && seen.has(norm)) dups++;
    seen.add(norm);
  }
  const dupRatio = dups / Math.max(1, lines.length);
  score -= dupRatio * 30; // up to -30 for 100% duplicate content

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function htmlToPlainText(html: string): string {
  return html
    .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&#?\w+;/g, ' ')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0)
    .join('\n');
}

// ─── Platform Detection ───────────────────────────────────────────────────────

export function detectPlatform(url: string): Platform {
  if (url.includes('docs.google.com/document/d/')) return 'google-docs';
  if (url.includes('notion.so') || url.includes('notion.site')) return 'notion';
  if (url.includes('onedrive.live.com') || url.includes('office.com') ||
      url.includes('sharepoint.com')) return 'word-online';
  if (url.includes('pdf') || url.endsWith('.pdf') ||
      url.includes('drive.google.com/file')) return 'pdf-viewer';
  return 'html-resume';
}

export function extractGoogleDocId(url: string): string | null {
  if (!url || typeof url !== 'string') return null;
  const m = url.match(/docs\.google\.com\/document\/(?:u\/\d+\/)?d\/([a-zA-Z0-9_-]{15,})/);
  return m ? m[1] : null;
}

// ─── Main PrecisionExtractor ──────────────────────────────────────────────────

export class PrecisionExtractor {
  /**
   * Main entry point — extracts resume text from the given tab using
   * the best available strategy. Returns a scored ExtractionResult.
   */
  public async extract(
    tabId: number,
    tabUrl: string,
  ): Promise<ExtractionResult> {
    const platform = detectPlatform(tabUrl);

    // Get title from the tab's document (we always run this)
    let title = 'Scanned Resume';
    try {
      const titleResult = await chrome.scripting.executeScript({
        target: { tabId },
        func: (): string => {
          return document.title
            .replace(/ - Google Docs.*/, '')
            .replace(/ - Word.*/, '')
            .replace(/ - Notion.*/, '')
            .trim();
        },
      });
      title = titleResult?.[0]?.result || title;
    } catch { /* silent */ }

    if (platform === 'google-docs') {
      return this.extractGoogleDocs(tabId, tabUrl, title);
    }
    return this.extractOtherPlatform(tabId, tabUrl, platform, title);
  }

  // ── Google Docs: run all strategies, pick best ──────────────────────────────

  private async extractGoogleDocs(
    tabId: number,
    tabUrl: string,
    title: string,
  ): Promise<ExtractionResult> {
    const docId = extractGoogleDocId(tabUrl);
    const candidates: ExtractionCandidate[] = [];

    // Run strategies in parallel (mobilebasic via background, DOM via executeScript)
    const [mobilebasicResult, domResult] = await Promise.allSettled([
      docId ? this.strategyMobilebasic(docId) : Promise.reject('no doc id'),
      this.strategyDom(tabId),
    ]);

    if (mobilebasicResult.status === 'fulfilled' && mobilebasicResult.value) {
      candidates.push(mobilebasicResult.value);
    }
    if (domResult.status === 'fulfilled' && domResult.value) {
      candidates.push(...domResult.value);
    }

    if (candidates.length === 0) {
      return this.emptyResult(tabUrl, 'google-docs');
    }

    // Score all candidates
    const scored = candidates.map(c => ({
      ...c,
      rawScore: scoreCandidate(c),
    }));

    // Pick winner
    const best = scored.reduce((a, b) => (a.rawScore > b.rawScore ? a : b));

    // Post-process the winner
    const cleaned = this.postProcess(best.text);

    return {
      text: cleaned,
      title,
      platform: 'google-docs',
      strategyUsed: best.strategy,
      qualityScore: best.rawScore,
      wordCount: cleaned.split(/\s+/).filter(Boolean).length,
      url: tabUrl,
    };
  }

  // ── Strategy: mobilebasic fetch via background service worker ───────────────

  private async strategyMobilebasic(docId: string): Promise<ExtractionCandidate | null> {
    try {
      const response: { text?: string; error?: string } = await chrome.runtime.sendMessage({
        type: 'FETCH_MOBILEBASIC',
        docId,
      });

      if (!response?.text || response.text.length < 50) return null;

      const wordCount = response.text.split(/\s+/).filter(Boolean).length;
      return { text: response.text, strategy: 'mobilebasic', rawScore: 0, wordCount };
    } catch {
      return null;
    }
  }

  // ── Strategy: DOM-based (all strategies in a single executeScript call) ──────

  private async strategyDom(tabId: number): Promise<ExtractionCandidate[]> {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        // This function runs in the page's content world — must be self-contained
        func: (): { strategy: string; text: string; wordCount: number }[] => {
          const candidates: { strategy: string; text: string; wordCount: number }[] = [];

          function wc(t: string) { return t.split(/\s+/).filter(Boolean).length; }
          function normLine(s: string) { return s.trim().toLowerCase().replace(/\s+/g, ' '); }

          // ─ Strategy: Accessibility tree (role="paragraph" / aria-label) ─
          try {
            const paragraphs = document.querySelectorAll('[role="paragraph"], [aria-label][class*="kix-paragraph"]');
            if (paragraphs.length > 5) {
              const lines: string[] = [];
              paragraphs.forEach(p => {
                const t = (p as HTMLElement).innerText?.trim();
                if (t) lines.push(t);
              });
              const text = lines.join('\n');
              if (wc(text) > 30) {
                candidates.push({ strategy: 'accessibility-tree', text, wordCount: wc(text) });
              }
            }
          } catch { /* skip */ }

          // ─ Strategy: Keyboard dispatch → getSelection ─
          try {
            const editorFrame = document.querySelector('.docs-texteventtarget-iframe') as HTMLIFrameElement | null;
            const editorTarget = (editorFrame?.contentDocument?.activeElement as HTMLElement)
              || document.querySelector('[contenteditable="true"]') as HTMLElement | null;

            if (editorTarget) {
              editorTarget.focus();
              // Dispatch Ctrl+A
              const event = new KeyboardEvent('keydown', {
                key: 'a', code: 'KeyA', ctrlKey: true,
                bubbles: true, cancelable: true,
              });
              editorTarget.dispatchEvent(event);
              // Small wait — we'll read selection after a brief delay
              // (can't await in synchronous injected func, so read immediately)
              const selected = window.getSelection()?.toString()?.trim() ?? '';
              if (wc(selected) > 30) {
                candidates.push({ strategy: 'keyboard-select', text: selected, wordCount: wc(selected) });
              }
              // Deselect
              window.getSelection()?.removeAllRanges();
            }
          } catch { /* skip */ }

          // ─ Strategy: role="textbox" innerText ─
          try {
            const textBox = document.querySelector('[role="textbox"]') as HTMLElement | null;
            if (textBox?.innerText && wc(textBox.innerText) > 30) {
              candidates.push({ strategy: 'leaf-span', text: textBox.innerText.trim(), wordCount: wc(textBox.innerText) });
            }
          } catch { /* skip */ }

          // ─ Strategy: leaf-span traversal with dedup ─
          try {
            const paras = document.querySelectorAll('.kix-paragraphrenderer');
            if (paras.length > 0) {
              const lines: string[] = [];
              const recentNorm: string[] = [];
              paras.forEach(para => {
                // Walk ONLY leaf spans (no children) inside lineviews
                const lineViews = para.querySelectorAll('.kix-lineview');
                const container = lineViews.length > 0 ? lineViews : [para];
                container.forEach(lv => {
                  const leafSpans = (lv as Element).querySelectorAll('span');
                  let lineText = '';
                  leafSpans.forEach(s => {
                    if (s.children.length === 0) lineText += s.textContent || '';
                  });
                  const clean = lineText.trim();
                  if (!clean) return;
                  const norm = normLine(clean);
                  if (!recentNorm.includes(norm)) {
                    recentNorm.push(norm);
                    if (recentNorm.length > 20) recentNorm.shift();
                    lines.push(clean);
                  }
                });
              });
              const text = lines.join('\n');
              if (wc(text) > 20) {
                candidates.push({ strategy: 'leaf-span', text, wordCount: wc(text) });
              }
            }
          } catch { /* skip */ }

          return candidates;
        },
      });

      const raw = results?.[0]?.result ?? [];
      return raw.map(r => ({
        text: r.text,
        strategy: r.strategy as ExtractionStrategy,
        rawScore: 0,
        wordCount: r.wordCount,
      }));
    } catch {
      return [];
    }
  }

  // ── Non-Google-Docs platforms ───────────────────────────────────────────────

  private async extractOtherPlatform(
    tabId: number,
    tabUrl: string,
    platform: Platform,
    title: string,
  ): Promise<ExtractionResult> {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: (plt: string): { text: string; strategy: string } => {
          function wc(t: string) { return t.split(/\s+/).filter(Boolean).length; }

          let text = '';
          let strategy = 'html-semantic';

          if (plt === 'notion') {
            const blocks = document.querySelectorAll(
              '[data-block-id], .notion-page-content, [data-content-editable-root="true"]'
            );
            const notionTitle = document.querySelector('.notion-title, [data-placeholder="Untitled"]');
            const lines: string[] = [];
            if (notionTitle?.textContent?.trim()) lines.push(notionTitle.textContent.trim());
            blocks.forEach(b => {
              const t = (b as HTMLElement).innerText?.trim();
              if (t) lines.push(t);
            });
            text = lines.join('\n');
            strategy = 'notion-blocks';
          }

          if (plt === 'word-online' || (!text && wc(text) < 30)) {
            const wordEl = document.querySelector(
              '[class*="canvasContainer"], .DeltaDocumentWrapper, [class*="WordDocument"], .word-doc-body'
            ) as HTMLElement | null;
            if (wordEl) { text = wordEl.innerText.trim(); strategy = 'word-canvas'; }
          }

          if (plt === 'pdf-viewer' || (!text && wc(text) < 30)) {
            // PDF.js: collect spans sorted by vertical position for correct reading order
            const spans = Array.from(document.querySelectorAll('.page .textLayer span, .pdfViewer span'))
              .filter(s => (s as HTMLElement).textContent?.trim());
            if (spans.length > 10) {
              const sorted = spans.sort((a, b) => {
                const ra = a.getBoundingClientRect();
                const rb = b.getBoundingClientRect();
                if (Math.abs(ra.top - rb.top) > 5) return ra.top - rb.top;
                return ra.left - rb.left;
              });
              text = sorted.map(s => s.textContent || '').join(' ');
              strategy = 'pdf-textlayer';
            }
          }

          // Generic HTML — try semantic containers in priority order
          if (!text || wc(text) < 30) {
            const selectors = [
              'main', 'article', '[role="main"]',
              '.resume', '#resume', '.cv', '#cv',
              '[class*="resume"]', '[id*="resume"]',
              '[class*="content"]', '#content',
            ];
            for (const sel of selectors) {
              const el = document.querySelector(sel) as HTMLElement | null;
              if (el && wc(el.innerText) > 50) {
                text = el.innerText.trim();
                strategy = 'html-semantic';
                break;
              }
            }
            if (!text || wc(text) < 30) {
              text = document.body.innerText.trim();
            }
          }

          return { text, strategy };
        },
        args: [platform],
      });

      const raw = results?.[0]?.result;
      if (!raw?.text || raw.text.length < 20) return this.emptyResult(tabUrl, platform);

      const cleaned = this.postProcess(raw.text);
      const wordCount = cleaned.split(/\s+/).filter(Boolean).length;

      const candidate: ExtractionCandidate = {
        text: cleaned,
        strategy: raw.strategy as ExtractionStrategy,
        rawScore: 0,
        wordCount,
      };
      const qualityScore = scoreCandidate(candidate);

      return {
        text: cleaned,
        title,
        platform,
        strategyUsed: raw.strategy as ExtractionStrategy,
        qualityScore,
        wordCount,
        url: tabUrl,
      };
    } catch {
      return this.emptyResult(tabUrl, platform);
    }
  }

  // ── Post-Processing Pipeline ─────────────────────────────────────────────────

  public postProcess(raw: string): string {
    const lines = raw.split('\n');
    const result: string[] = [];
    const recentNorm: string[] = [];

    // Known UI artifact lines to discard entirely
    const ARTIFACT_LINE_PATTERNS = [
      /^(file|edit|view|insert|format|tools|extensions?|help|share|comments?|history)$/i,
      /^(normal text|heading [1-6]|title|subtitle|arial|times new roman|calibri|georgia)$/i,
      /^[\d]{1,2}$/, // lone page numbers
      /^page \d+(\s+of\s+\d+)?$/i,
      /^\d{2,3}%$/, // zoom percentages
      /^(undo|redo|cut|copy|paste|select all|find|replace)$/i,
      /^(zoom|print|print layout|download|word count|spell check|explore|voice typing)$/i,
      /^(suggesting|editing|viewing|locked|protected)$/i,
    ];

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (line.length < 2) continue;
      if (line.length > 500) continue; // malformed line

      // Check artifact patterns
      if (ARTIFACT_LINE_PATTERNS.some(p => p.test(line))) continue;

      // Normalize for dedup
      const norm = line.toLowerCase().replace(/[\s\-•*|]+/g, ' ').trim();
      if (recentNorm.includes(norm)) continue;

      recentNorm.push(norm);
      if (recentNorm.length > 25) recentNorm.shift();

      // Normalize bullet characters to •
      const normalized = line
        .replace(/^[-–—▪▸▹‣◦○]\s+/, '• ')
        .replace(/^\*\s+/, '• ');

      result.push(normalized);
    }

    return result.join('\n');
  }

  private emptyResult(url: string, platform: Platform): ExtractionResult {
    return {
      text: '',
      title: 'Resume',
      platform,
      strategyUsed: 'html-semantic',
      qualityScore: 0,
      wordCount: 0,
      url,
    };
  }
}
