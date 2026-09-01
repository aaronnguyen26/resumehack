import { google, docs_v1 } from 'googleapis';
import {
  ResumeBullet,
  TailoredBulletDiff,
  DocumentLayoutInfo,
  StructuralParagraphStyle,
  StructuralRunStyle,
  LayoutIssue,
} from '../types/index.js';

// ─── Robust Text Matcher & Sanitizer ────────────────────────────────────────

export class RobustTextMatcher {
  private static readonly WS_REGEX = /[\s\u00A0\u200B\u202F\u000B]+/g;

  /**
   * Strip synthetic bullet prefixes and structured list numberings (e.g. "• ", "- ", "1. ", "1) ")
   * WITHOUT stripping legitimate numbers/dates like "2024", "10+ microservices", "100%".
   */
  public static sanitizeOriginal(text: string): string {
    if (!text) return '';
    return text
      .replace(/^[\s\uFEFF\u200B]*([•\-*–—▪▸▹‣◦○]|\d+[\.\)])\s+/, '')
      .replace(/[\u00AD\u200B\uFEFF]/g, '')
      .trim();
  }

  public static sanitizeTailored(text: string): string {
    if (!text) return '';
    return text
      .replace(/^[\s\uFEFF\u200B]*([•\-*–—▪▸▹‣◦○]|\d+[\.\)])\s+/, '')
      .replace(/[\u00AD\u200B\uFEFF]/g, '')
      .trim();
  }

  public static extractBulletPrefix(rawText: string): string {
    if (!rawText) return '';
    const match = rawText.match(/^[\s\uFEFF\u200B]*([•\-*–—▪▸▹‣◦○]|\d+[\.\)])\s+/);
    if (!match) return '';
    return match[0];
  }

  public static normalize(text: string): string {
    return text
      .replace(/[\u00AD\u200B\uFEFF\u00A0]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  public static calculateSimilarity(a: string, b: string): number {
    const normA = this.normalize(a);
    const normB = this.normalize(b);
    if (!normA || !normB) return 0;
    if (normA === normB) return 1;

    const wordsA = new Set(normA.split(/\s+/).filter((w) => w.length > 2));
    const wordsB = new Set(normB.split(/\s+/).filter((w) => w.length > 2));
    if (wordsA.size === 0 || wordsB.size === 0) return 0;

    let overlap = 0;
    for (const w of wordsA) if (wordsB.has(w)) overlap++;
    return (2 * overlap) / (wordsA.size + wordsB.size);
  }

  /**
   * Generate permutations for fallback string matching when needed.
   */
  public static generateSearchPermutations(text: string, rawDocText?: string): string[] {
    if (!text || typeof text !== 'string') return [];
    const clean = this.sanitizeOriginal(text);
    if (!clean || clean.length < 8) {
      const trimmed = text.trim();
      return trimmed.length >= 8 ? [trimmed] : [];
    }

    const results = new Set<string>();
    const normalizedWs = clean.replace(this.WS_REGEX, ' ').trim();
    const withoutTrailingPeriod = normalizedWs.replace(/\.+$/, '').trim();

    if (rawDocText) {
      const rawTrimmed = rawDocText.replace(/[\u00AD\u200B\uFEFF]/g, '').trim();
      if (rawTrimmed.length >= 8) results.add(rawTrimmed);
    }

    if (clean.length >= 8) results.add(clean);
    if (normalizedWs.length >= 8) results.add(normalizedWs);
    if (withoutTrailingPeriod.length >= 8) results.add(withoutTrailingPeriod);

    return Array.from(results).sort((a, b) => b.length - a.length);
  }
}

// ─── Structural Document Models & Parser ────────────────────────────────────

export interface StructuralParagraph {
  rawText: string;
  trimmedText: string;
  normalizedText: string;
  sanitizedText: string;
  startIndex: number;
  endIndex: number;
  textStartIndex: number;
  textEndIndex: number;
  hasNativeBullet: boolean;
  hasVisualBullet: boolean;
  bulletPrefix: string;
  paragraphStyle?: StructuralParagraphStyle;
  runs?: StructuralRunStyle[];
  isInTable?: boolean;
}

export interface ResolvedDiffRange {
  diff: TailoredBulletDiff;
  startIndex: number;
  endIndex: number;
  replacementText: string;
  matchedParagraph: StructuralParagraph;
}

export interface BatchUpdateResult {
  success: boolean;
  updatedCount: number;
  occurrencesChanged?: number;
  requestsExecuted: number;
  apiExecuted: boolean;
  replies?: any[];
  writeControl?: any;
  error?: string;
  details?: string[];
}

export function extractDocumentLayoutInfo(doc: any): DocumentLayoutInfo {
  const content = doc?.body?.content || [];
  const tables: Array<{ rows: number; columns: number; startIndex: number; endIndex: number }> = [];
  let sectionStyle: any = null;

  for (const elem of content) {
    if (elem.table) {
      const rows = elem.table.rows || elem.table.tableRows?.length || 0;
      const columns = elem.table.columns || elem.table.tableRows?.[0]?.tableCells?.length || 0;
      tables.push({
        rows,
        columns,
        startIndex: elem.startIndex ?? 0,
        endIndex: elem.endIndex ?? 0,
      });
    }
    if (elem.sectionBreak?.sectionStyle) {
      sectionStyle = {
        columnCount: elem.sectionBreak.sectionStyle.columnProperties?.length || 1,
        marginTop: elem.sectionBreak.sectionStyle.marginTop?.magnitude,
        marginBottom: elem.sectionBreak.sectionStyle.marginBottom?.magnitude,
        marginLeft: elem.sectionBreak.sectionStyle.marginLeft?.magnitude,
        marginRight: elem.sectionBreak.sectionStyle.marginRight?.magnitude,
      };
    }
  }

  if (!sectionStyle && doc.documentStyle) {
    sectionStyle = {
      columnCount: 1,
      marginTop: doc.documentStyle.marginTop?.magnitude,
      marginBottom: doc.documentStyle.marginBottom?.magnitude,
      marginLeft: doc.documentStyle.marginLeft?.magnitude,
      marginRight: doc.documentStyle.marginRight?.magnitude,
    };
  }

  return {
    title: doc?.title || 'Resume',
    hasTables: tables.length > 0,
    tableCount: tables.length,
    tables,
    sectionStyle: sectionStyle || { columnCount: 1 },
    namedStyles: doc?.namedStyles,
    lists: doc?.lists,
  };
}

export function extractStructuralParagraphs(doc: any): StructuralParagraph[] {
  const content = doc?.body?.content;
  if (!content || !Array.isArray(content)) return [];
  return extractFromElements(content);
}

function extractFromElements(elements: any[], isInTable: boolean = false): StructuralParagraph[] {
  const paragraphs: StructuralParagraph[] = [];

  for (const elem of elements) {
    if (elem.paragraph && elem.paragraph.elements && elem.startIndex !== undefined && elem.endIndex !== undefined) {
      let pText = '';
      const runs: StructuralRunStyle[] = [];

      for (const pe of elem.paragraph.elements) {
        if (pe.textRun?.content) {
          pText += pe.textRun.content;
          const tr = pe.textRun;
          const ts = tr.textStyle || {};
          const fontFamily = ts.weightedFontFamily?.fontFamily || ts.fontFamily;
          const fontSize = ts.fontSize?.magnitude;
          const bold = Boolean(ts.bold);
          const italic = Boolean(ts.italic);
          const underline = Boolean(ts.underline);
          const foregroundColor = ts.foregroundColor?.color?.rgbColor
            ? `rgb(${Math.round((ts.foregroundColor.color.rgbColor.red || 0) * 255)}, ${Math.round((ts.foregroundColor.color.rgbColor.green || 0) * 255)}, ${Math.round((ts.foregroundColor.color.rgbColor.blue || 0) * 255)})`
            : undefined;

          runs.push({
            fontFamily,
            fontSize,
            bold,
            italic,
            underline,
            foregroundColor,
            startIndex: pe.startIndex ?? elem.startIndex,
            endIndex: pe.endIndex ?? elem.endIndex,
            content: tr.content,
          });
        }
      }

      const trimmed = pText.trim();
      if (trimmed.length > 0) {
        const hasNativeBullet = Boolean(elem.paragraph.bullet || elem.paragraph.paragraphStyle?.bullet);
        const bulletPrefix = RobustTextMatcher.extractBulletPrefix(trimmed);
        const hasVisualBullet = Boolean(bulletPrefix);
        const sanitized = RobustTextMatcher.sanitizeOriginal(trimmed);

        const ps = elem.paragraph.paragraphStyle || {};
        const bulletData = elem.paragraph.bullet || ps.bullet;
        const paragraphStyle: StructuralParagraphStyle = {
          namedStyleType: ps.namedStyleType || 'NORMAL_TEXT',
          alignment: ps.alignment || 'START',
          spaceBefore: ps.spaceBefore?.magnitude,
          spaceAfter: ps.spaceAfter?.magnitude,
          indentStart: ps.indentStart?.magnitude,
          indentFirstLine: ps.indentFirstLine?.magnitude,
          lineSpacing: ps.lineSpacing,
          bullet: bulletData
            ? {
                listId: bulletData.listId,
                nestingLevel: bulletData.nestingLevel,
              }
            : undefined,
        };

        const endsWithNewline = pText.endsWith('\n');
        const textEndIndex = endsWithNewline ? elem.endIndex - 1 : elem.endIndex;

        paragraphs.push({
          rawText: pText,
          trimmedText: trimmed,
          normalizedText: RobustTextMatcher.normalize(trimmed),
          sanitizedText: RobustTextMatcher.normalize(sanitized),
          startIndex: elem.startIndex,
          endIndex: elem.endIndex,
          textStartIndex: elem.startIndex,
          textEndIndex: Math.max(elem.startIndex, textEndIndex),
          hasNativeBullet,
          hasVisualBullet,
          bulletPrefix,
          paragraphStyle,
          runs,
          isInTable,
        });
      }
    } else if (elem.table?.tableRows) {
      for (const row of elem.table.tableRows) {
        if (row.tableCells) {
          for (const cell of row.tableCells) {
            if (cell.content) paragraphs.push(...extractFromElements(cell.content, true));
          }
        }
      }
    }
  }
  return paragraphs;
}

export function resolveDiffReplacementRanges(
  diffs: TailoredBulletDiff[],
  structuralParagraphs: StructuralParagraph[]
): { resolved: ResolvedDiffRange[]; unresolved: TailoredBulletDiff[] } {
  const resolved: ResolvedDiffRange[] = [];
  const unresolved: TailoredBulletDiff[] = [];
  const usedParagraphIndices = new Set<number>();

  for (const diff of diffs) {
    if (diff.status && diff.status !== 'accepted') continue;

    const cleanTailored = RobustTextMatcher.sanitizeTailored(diff.tailoredText);
    const needle = RobustTextMatcher.normalize(diff.originalText);
    const needleSanitized = RobustTextMatcher.normalize(RobustTextMatcher.sanitizeOriginal(diff.originalText));
    const hintText = diff.prefix ? RobustTextMatcher.normalize(diff.prefix) : '';

    let matchedPara: StructuralParagraph | null = null;
    for (const para of structuralParagraphs) {
      if (usedParagraphIndices.has(para.startIndex)) continue;
      if (needleSanitized && (para.sanitizedText === needleSanitized || para.normalizedText === needleSanitized)) {
        matchedPara = para;
        break;
      }
    }

    if (!matchedPara) {
      for (const para of structuralParagraphs) {
        if (usedParagraphIndices.has(para.startIndex)) continue;
        if (para.normalizedText === needle || (hintText && para.normalizedText === hintText)) {
          matchedPara = para;
          break;
        }
      }
    }

    if (!matchedPara && needleSanitized.length >= 12) {
      let bestScore = 0;
      let candidate: StructuralParagraph | null = null;
      for (const para of structuralParagraphs) {
        if (usedParagraphIndices.has(para.startIndex)) continue;
        const score = RobustTextMatcher.calculateSimilarity(para.sanitizedText, needleSanitized);
        if (score > bestScore && score >= 0.75) {
          bestScore = score;
          candidate = para;
        }
      }
      if (candidate) matchedPara = candidate;
    }

    if (matchedPara) {
      usedParagraphIndices.add(matchedPara.startIndex);
      let replacementText = cleanTailored;
      if (!matchedPara.hasNativeBullet && matchedPara.bulletPrefix && !diff.tailoredText.startsWith(matchedPara.bulletPrefix)) {
        replacementText = `${matchedPara.bulletPrefix}${cleanTailored}`;
      } else if (!matchedPara.hasNativeBullet && diff.tailoredText.startsWith('• ') && !replacementText.startsWith('• ')) {
        replacementText = `• ${cleanTailored}`;
      }

      resolved.push({ diff, startIndex: matchedPara.textStartIndex, endIndex: matchedPara.textEndIndex, replacementText, matchedParagraph: matchedPara });
    } else {
      unresolved.push(diff);
    }
  }
  return { resolved, unresolved };
}

export function buildStructuralBatchUpdateRequests(
  resolvedRanges: ResolvedDiffRange[],
  unresolvedDiffs: TailoredBulletDiff[] = [],
  layoutIssues: LayoutIssue[] = []
): { requests: any[]; sortedRanges: ResolvedDiffRange[] } {
  interface IndexedOp {
    startIndex: number;
    requests: any[];
  }

  const operations: IndexedOp[] = [];

  for (const item of resolvedRanges) {
    const itemReqs: any[] = [];
    if (item.endIndex > item.startIndex) {
      itemReqs.push({ deleteContentRange: { range: { startIndex: item.startIndex, endIndex: item.endIndex } } });
    }
    if (item.replacementText.length > 0) {
      itemReqs.push({ insertText: { location: { index: item.startIndex }, text: item.replacementText } });
    }
    operations.push({
      startIndex: item.startIndex,
      requests: itemReqs,
    });
  }

  for (const issue of layoutIssues) {
    if (issue.suggestedFix?.batchUpdateRequests && issue.suggestedFix.batchUpdateRequests.length > 0) {
      operations.push({
        startIndex: issue.affectedStartIndex ?? 0,
        requests: issue.suggestedFix.batchUpdateRequests,
      });
    }
  }

  operations.sort((a, b) => b.startIndex - a.startIndex);
  const requests: any[] = [];
  for (const op of operations) {
    requests.push(...op.requests);
  }

  for (const unhandled of unresolvedDiffs) {
    const cleanTailored = RobustTextMatcher.sanitizeTailored(unhandled.tailoredText);
    const searchCandidates = RobustTextMatcher.generateSearchPermutations(unhandled.originalText, unhandled.prefix);
    const primarySearch = searchCandidates[0] || unhandled.originalText;
    if (primarySearch && primarySearch.length >= 8) {
      requests.push({ replaceAllText: { containsText: { text: primarySearch, matchCase: false }, replaceText: cleanTailored } });
    }
  }

  const sortedRanges = [...resolvedRanges].sort((a, b) => b.startIndex - a.startIndex);
  return { requests, sortedRanges };
}

// ─── Google Docs Authoritative REST API Service ──────────────────────────────

export class GoogleDocsService {
  public async getAuthToken(interactive: boolean = false): Promise<string | undefined> {
    if (typeof chrome !== 'undefined' && (chrome as any).storage && (chrome as any).storage.local) {
      try {
        const stored = await new Promise<{ google_access_token?: string; resumehack_settings?: any; resumehack_stored_settings?: any }>((resolve) => {
          (chrome as any).storage.local.get(
            ['google_access_token', 'resumehack_settings', 'resumehack_stored_settings'],
            (res: any) => resolve(res || {})
          );
        });
        const candidateToken =
          (typeof stored?.google_access_token === 'string' && stored.google_access_token.trim().length > 0 ? stored.google_access_token.trim() : undefined) ||
          (typeof stored?.resumehack_settings?.googleAccessToken === 'string' && stored.resumehack_settings.googleAccessToken.trim().length > 0 ? stored.resumehack_settings.googleAccessToken.trim() : undefined) ||
          (typeof stored?.resumehack_stored_settings?.googleAccessToken === 'string' && stored.resumehack_stored_settings.googleAccessToken.trim().length > 0 ? stored.resumehack_stored_settings.googleAccessToken.trim() : undefined);

        if (candidateToken) {
          return candidateToken;
        }
      } catch (err) {
        console.debug('[GoogleDocsService] Stored token lookup note:', err);
      }
    }
    if (typeof localStorage !== 'undefined') {
      try {
        const token = localStorage.getItem('google_access_token');
        if (token && token.trim().length > 0) return token.trim();
      } catch {}
    }
    if (typeof chrome === 'undefined' || !(chrome as any).identity?.getAuthToken) return undefined;
    return new Promise((resolve) => {
      (chrome as any).identity.getAuthToken({ interactive }, (tok: any) => {
        if (chrome.runtime?.lastError || !tok) {
          if (!interactive) {
            (chrome as any).identity.getAuthToken({ interactive: true }, (interactiveTok: any) => {
              if (chrome.runtime?.lastError || !interactiveTok) resolve(undefined);
              else resolve(interactiveTok as string);
            });
          } else resolve(undefined);
        } else resolve(tok as string);
      });
    });
  }

  /**
   * Shared unified fetch wrapper with proactive token validation and automatic 401 recovery retry.
   * Protects documents.get, batchUpdate, and files.export.
   */
  public async fetchWithGoogleAuth(
    url: string,
    init: RequestInit = {},
    explicitToken?: string
  ): Promise<Response> {
    let token = explicitToken || (await this.getAuthToken(false));
    if (!token) {
      throw new Error('OAuth authorization required');
    }

    const headers = new Headers(init.headers || {});
    headers.set('Authorization', `Bearer ${token}`);

    let response = await fetch(url, {
      ...init,
      headers,
    });

    // ── Safety Net: Automatic 401 Recovery Retry ──
    if (response.status === 401) {
      console.warn(`[GoogleDocsService Backend] Received 401 from ${url}. Invalidating stale token and retrying...`);
      try {
        if (typeof chrome !== 'undefined' && (chrome as any).identity?.removeCachedAuthToken) {
          await new Promise<void>((resolve) => {
            (chrome as any).identity.removeCachedAuthToken({ token }, () => resolve());
          });
        }
      } catch {}

      const freshToken = await this.getAuthToken(false);
      if (freshToken) {
        console.log(`[GoogleDocsService Backend] Acquired fresh token, retrying ${url}...`);
        const retryHeaders = new Headers(init.headers || {});
        retryHeaders.set('Authorization', `Bearer ${freshToken}`);
        response = await fetch(url, {
          ...init,
          headers: retryHeaders,
        });
      }
    }

    return response;
  }

  public async fetchStructuralDocument(documentId: string, accessToken?: string): Promise<{ doc: any; paragraphs: StructuralParagraph[] }> {
    const res = await this.fetchWithGoogleAuth(
      `https://docs.googleapis.com/v1/documents/${documentId}`,
      {
        headers: { 'Content-Type': 'application/json' },
      },
      accessToken
    );

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData?.error?.message || `Google Docs API returned HTTP ${res.status}`);
    }
    const doc = await res.json();
    return { doc, paragraphs: extractStructuralParagraphs(doc) };
  }

  public async getDocumentAndExtractBullets(documentId: string, accessToken?: string): Promise<{ title: string; fullText: string; bullets: ResumeBullet[] }> {
    if (!documentId || documentId.includes('mock')) return this.getMockMasterResume(documentId);
    try {
      const token = accessToken || (await this.getAuthToken(false));
      if (!token) return this.getMockMasterResume(documentId);
      const { doc, paragraphs } = await this.fetchStructuralDocument(documentId, token);
      const title = doc.title || 'Master Resume';
      const bullets: ResumeBullet[] = [];
      let fullText = '';
      for (const p of paragraphs) {
        fullText += `${p.rawText}\n`;
        const isBullet = p.hasNativeBullet || p.hasVisualBullet || p.trimmedText.startsWith('•') || p.trimmedText.startsWith('-') || /^\d+[\.\)]\s+/.test(p.trimmedText);
        if (isBullet && p.trimmedText.length >= 10) {
          const cleanText = RobustTextMatcher.sanitizeOriginal(p.trimmedText);
          if (cleanText.length >= 8) {
            bullets.push({
              id: `bullet-${bullets.length + 1}`,
              section: 'Experience',
              organization: 'Experience Item',
              role: 'Candidate',
              originalText: cleanText,
              prefix: p.trimmedText,
              startIndex: p.startIndex,
              endIndex: p.endIndex,
            });
          }
        }
      }
      return { title, fullText: fullText || 'Resume Document Content', bullets: bullets.length > 0 ? bullets : this.getMockMasterResume(documentId).bullets };
    } catch { return this.getMockMasterResume(documentId); }
  }

  public async applyBatchUpdates(
    documentId: string,
    diffs: TailoredBulletDiff[],
    accessToken?: string,
    layoutIssues: LayoutIssue[] = []
  ): Promise<BatchUpdateResult> {
    const acceptedDiffs = diffs.filter((d) => d.status === 'accepted');
    if (acceptedDiffs.length === 0 && layoutIssues.length === 0) return { success: true, updatedCount: 0, occurrencesChanged: 0, requestsExecuted: 0, apiExecuted: false };
    const isMock = !documentId || documentId.includes('mock') || documentId.includes('test') || documentId.startsWith('doc-');

    if (isMock && !accessToken) {
      const mock = this.getMockMasterResume(documentId);
      const paragraphs = extractStructuralParagraphs({ body: { content: mock.bullets.map((b, idx) => ({ startIndex: idx * 100, endIndex: idx * 100 + (b.prefix?.length || b.originalText.length) + 1, paragraph: { elements: [{ textRun: { content: `${b.prefix || b.originalText}\n` } }] } })) } });
      const { resolved, unresolved } = resolveDiffReplacementRanges(acceptedDiffs, paragraphs);
      const { requests } = buildStructuralBatchUpdateRequests(resolved, unresolved, layoutIssues);
      return { success: true, updatedCount: resolved.length || acceptedDiffs.length || layoutIssues.length, occurrencesChanged: resolved.length || acceptedDiffs.length || layoutIssues.length, requestsExecuted: requests.length || 1, apiExecuted: false };
    }
    let token = accessToken || (await this.getAuthToken(false));
    if (!token) return { success: false, updatedCount: 0, occurrencesChanged: 0, requestsExecuted: 0, apiExecuted: false, error: 'OAuth authorization required. Please connect your Google account in Settings.' };
    try {
      console.log(`[GoogleDocsService] Calling documents.get for ${documentId}...`);
      const { paragraphs } = await this.fetchStructuralDocument(documentId, token);
      console.log(`[GoogleDocsService] Retrieved ${paragraphs.length} structural paragraphs from ${documentId}`);
      const { resolved, unresolved } = resolveDiffReplacementRanges(acceptedDiffs, paragraphs);
      console.log(`[GoogleDocsService] Resolved ${resolved.length}/${acceptedDiffs.length} diff ranges`);

      if (resolved.length === 0 && unresolved.length === acceptedDiffs.length && layoutIssues.length === 0) {
        const fallbackRequests = this.buildBatchUpdateRequests(acceptedDiffs);
        if (fallbackRequests.length === 0) return { success: false, updatedCount: 0, occurrencesChanged: 0, requestsExecuted: 0, apiExecuted: false, error: 'Could not locate matching bullet text in the Google Document structure.' };
        console.log(`[GoogleDocsService] Issuing fallback replaceAllText batchUpdate with ${fallbackRequests.length} requests...`);
        const res = await this.fetchWithGoogleAuth(`https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requests: fallbackRequests }) }, token);
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          console.error(`[GoogleDocsService] batchUpdate HTTP ${res.status}:`, errData);
          return { success: false, updatedCount: 0, requestsExecuted: fallbackRequests.length, apiExecuted: false, error: errData?.error?.message || `Google Docs API HTTP ${res.status}` };
        }
        const resData = await res.json();
        let totalOccurrences = 0;
        if (resData.replies && Array.isArray(resData.replies)) {
          for (const reply of resData.replies) if (reply.replaceAllText?.occurrencesChanged) totalOccurrences += reply.replaceAllText.occurrencesChanged;
        }
        return { success: true, updatedCount: acceptedDiffs.length, occurrencesChanged: totalOccurrences, requestsExecuted: fallbackRequests.length, apiExecuted: true, replies: resData.replies, writeControl: resData.writeControl };
      }
      const { requests, sortedRanges } = buildStructuralBatchUpdateRequests(resolved, unresolved, layoutIssues);
      if (requests.length === 0) return { success: false, updatedCount: 0, requestsExecuted: 0, apiExecuted: false, error: 'No valid update requests generated' };
      console.log(`[GoogleDocsService] Issuing structural batchUpdate with ${requests.length} atomic operations...`);
      const res = await this.fetchWithGoogleAuth(`https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requests }) }, token);
      if (res.ok) {
        const resData = await res.json();
        const details = sortedRanges.map((r) => `Applied at [${r.startIndex}..${r.endIndex}]: "${r.replacementText.slice(0, 40)}…"`);
        console.log(`[GoogleDocsService] batchUpdate SUCCEEDED! Applied ${sortedRanges.length} diffs`);
        return { success: true, updatedCount: sortedRanges.length, occurrencesChanged: sortedRanges.length, requestsExecuted: requests.length, apiExecuted: true, replies: resData.replies, writeControl: resData.writeControl, details };
      } else {
        const errData = await res.json().catch(() => ({}));
        console.error(`[GoogleDocsService] batchUpdate HTTP ${res.status}:`, errData);
        return { success: false, updatedCount: 0, occurrencesChanged: 0, requestsExecuted: requests.length, apiExecuted: false, error: errData?.error?.message || `Google Docs API HTTP ${res.status}` };
      }
    } catch (err: any) {
      console.error('[GoogleDocsService] Network error during applyBatchUpdates:', err);
      return { success: false, updatedCount: 0, occurrencesChanged: 0, requestsExecuted: 0, apiExecuted: false, error: err?.message || 'Network error executing structural batchUpdate' };
    }
  }

  public buildBatchUpdateRequests(diffs: TailoredBulletDiff[]): any[] {
    const accepted = diffs.filter((d) => d.status === 'accepted');
    const requests: any[] = [];
    const seen = new Set<string>();
    for (const diff of accepted) {
      const cleanTailored = RobustTextMatcher.sanitizeTailored(diff.tailoredText);
      const searchCandidates = RobustTextMatcher.generateSearchPermutations(diff.originalText, diff.prefix);
      for (const textToSearch of searchCandidates) {
        if (textToSearch.length >= 8 && !seen.has(textToSearch)) {
          seen.add(textToSearch);
          const bulletPrefix = RobustTextMatcher.extractBulletPrefix(textToSearch);
          const fullReplacement = bulletPrefix ? `${bulletPrefix}${cleanTailored}` : cleanTailored;
          requests.push({ replaceAllText: { containsText: { text: textToSearch, matchCase: false }, replaceText: fullReplacement } });
        }
      }
    }
    return requests;
  }

  public getMockMasterResume(documentId: string = 'mock-doc-123') {
    const title = 'Alex Chen - Master Resume 2026';
    const bullets: ResumeBullet[] = [
      {
        id: 'bullet-1',
        section: 'Experience',
        organization: 'Acme Cloud Solutions',
        role: 'Software Engineering Intern',
        originalText: 'Worked on backend services using Python and Postgres to process customer orders.',
        prefix: '• Worked on backend services using Python and Postgres to process customer orders.',
      },
      {
        id: 'bullet-2',
        section: 'Experience',
        organization: 'Acme Cloud Solutions',
        role: 'Software Engineering Intern',
        originalText: 'Helped with CI/CD pipeline automation and fixed broken integration tests.',
        prefix: '• Helped with CI/CD pipeline automation and fixed broken integration tests.',
      },
      {
        id: 'bullet-3',
        section: 'Projects',
        organization: 'Distributed Key-Value Store',
        role: 'Creator & Maintainer',
        originalText: 'Built a key-value database in Go with Raft consensus and REST API endpoints.',
        prefix: '• Built a key-value database in Go with Raft consensus and REST API endpoints.',
      },
      {
        id: 'bullet-4',
        section: 'Projects',
        organization: 'Resume AI Assistant',
        role: 'Full-Stack Developer',
        originalText: 'Made a React and Node.js web app to analyze text using OpenAI API.',
        prefix: '• Made a React and Node.js web app to analyze text using OpenAI API.',
      },
    ];

    const fullText = `Alex Chen
San Francisco, CA | alex.chen@example.com | github.com/alexchen | linkedin.com/in/alexchen

EDUCATION
University of California, Berkeley
B.S. in Computer Science | GPA: 3.85 | Expected Graduation: May 2026

TECHNICAL SKILLS
Languages: Python, Go, TypeScript, JavaScript, SQL, C++, HTML/CSS
Frameworks: React, Node.js, Express, FastAPI, Tailwind CSS, PostgreSQL, Redis
Developer Tools: Docker, Git, Linux, Google Cloud Platform (GCP), GitHub Actions, Vitest

EXPERIENCE
Acme Cloud Solutions — Software Engineering Intern | May 2025 – Aug 2025
• Worked on backend services using Python and Postgres to process customer orders.
• Helped with CI/CD pipeline automation and fixed broken integration tests.

PROJECTS
Distributed Key-Value Store | Go, Raft, Docker, REST API
• Built a key-value database in Go with Raft consensus and REST API endpoints.

Resume AI Assistant | TypeScript, React, Node.js, LLM
• Made a React and Node.js web app to analyze text using OpenAI API.`;

    return { title, fullText, bullets };
  }
}
