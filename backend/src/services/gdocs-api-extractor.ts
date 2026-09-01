/**
 * GDocsApiExtractor — Tier-1 resume extractor using the Google Docs REST API.
 *
 * When the user is on a Google Docs URL, this service:
 *  1. Extracts the document ID from the URL
 *  2. Silently requests an OAuth token via chrome.identity (no popup unless needed)
 *  3. Fetches the full document structure from docs.googleapis.com/v1/documents/{id}
 *  4. Walks the StructuralElement tree to reconstruct plain text AND detect sections
 *
 * Returns a GDocsExtractResult that the resume parser can consume directly,
 * bypassing all DOM/canvas guesswork.
 *
 * Falls back gracefully (returns null) if:
 *  - Not a Google Docs URL
 *  - User hasn't granted the documents.readonly scope
 *  - The API call fails for any reason
 */

export interface GDocsSection {
  heading: string;
  headingLevel: number; // 1–6
  lines: string[];
}

export interface GDocsExtractResult {
  docId: string;
  title: string;
  plainText: string;
  structuredSections: GDocsSection[];
  candidateName: string;
}

// Google Docs API named style → section heading level
const HEADING_LEVEL: Record<string, number> = {
  TITLE: 0,
  HEADING_1: 1,
  HEADING_2: 2,
  HEADING_3: 3,
  HEADING_4: 4,
  HEADING_5: 5,
  HEADING_6: 6,
};

export class GDocsApiExtractor {
  /**
   * Attempts to extract document content using the Google Docs REST API.
   * Returns null on any failure — caller should fall back to DOM extraction.
   */
  public async extract(tabUrl: string): Promise<GDocsExtractResult | null> {
    const docId = this.extractDocId(tabUrl);
    if (!docId) return null;

    const token = await this.getToken();
    if (!token) return null;

    try {
      const response = await fetch(
        `https://docs.googleapis.com/v1/documents/${docId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!response.ok) {
        console.warn(`[GDocsAPI] HTTP ${response.status} for doc ${docId}`);
        return null;
      }

      const doc = await response.json();
      return this.parseDocResponse(docId, doc);
    } catch (err) {
      console.warn('[GDocsAPI] Fetch error:', err);
      return null;
    }
  }

  /** Extract docId from a Google Docs URL */
  public extractDocId(url: string): string | null {
    const m = url.match(/docs\.google\.com\/document\/(?:u\/\d+\/)?d\/([a-zA-Z0-9_-]{15,})/);
    return m ? m[1] : null;
  }

  /** Silently request OAuth token — shows consent screen once if needed */
  private async getToken(): Promise<string | null> {
    if (typeof chrome === 'undefined' || !chrome.identity) return null;
    return new Promise((resolve) => {
      // Silent attempt first — works if user already granted permission
      chrome.identity.getAuthToken({ interactive: false }, (token?: string) => {
        const err = chrome.runtime?.lastError?.message ?? '';

        if (token) {
          resolve(token);
          return;
        }

        // If signin is disabled or the extension has no OAuth client_id configured,
        // don't bother with interactive — it will fail the same way
        const isUnrecoverable =
          err.includes('browser signin') ||
          err.includes('not signed in') ||
          err.includes('OAuth2') ||
          err.includes('client_id');

        if (isUnrecoverable) {
          console.debug('[GDocsAPI] Auth unavailable — using DOM fallback:', err);
          resolve(null);
          return;
        }

        // Otherwise try interactive (user will see Google consent screen once)
        chrome.identity.getAuthToken({ interactive: true }, (tok?: string) => {
          if (chrome.runtime?.lastError || !tok) {
            console.debug('[GDocsAPI] Interactive auth failed:', chrome.runtime?.lastError?.message);
            resolve(null);
          } else {
            resolve(tok);
          }
        });
      });
    });
  }

  /** Walk the Docs API JSON and reconstruct structured content */
  public parseDocResponse(docId: string, doc: any): GDocsExtractResult {
    const title: string = doc.title || 'Resume';
    const content: any[] = doc.body?.content || [];

    const plainLines: string[] = [];
    const sections: GDocsSection[] = [];
    let currentSection: GDocsSection = { heading: '', headingLevel: 99, lines: [] };
    let candidateName = '';

    for (const element of content) {
      if (!element.paragraph) continue;

      const para = element.paragraph;
      const namedStyle: string = para.paragraphStyle?.namedStyleType || 'NORMAL_TEXT';
      const level = HEADING_LEVEL[namedStyle] ?? 99;

      // Extract all text runs in this paragraph
      const paraText = (para.elements || [])
        .map((el: any) => el.textRun?.content || '')
        .join('')
        .replace(/\n$/, '') // strip trailing newline added by Docs API
        .trim();

      if (!paraText) continue;

      const isList = para.bullet != null;
      const prefix = isList ? '• ' : '';
      plainLines.push(prefix + paraText);

      // TITLE or HEADING_1 → candidate name (first occurrence only)
      if ((namedStyle === 'TITLE' || namedStyle === 'HEADING_1') && !candidateName) {
        candidateName = paraText;
      }

      if (level <= 6 && level >= 1) {
        // Start a new section
        if (currentSection.heading || currentSection.lines.length > 0) {
          sections.push(currentSection);
        }
        currentSection = { heading: paraText, headingLevel: level, lines: [] };
      } else {
        // Body content — check if it's a list item
        const isList = para.bullet != null;
        const prefix = isList ? '• ' : '';
        currentSection.lines.push(prefix + paraText);
      }
    }

    // Push final section
    if (currentSection.heading || currentSection.lines.length > 0) {
      sections.push(currentSection);
    }

    // If no candidate name found, use document title
    if (!candidateName) candidateName = title;

    return {
      docId,
      title,
      plainText: plainLines.join('\n'),
      structuredSections: sections,
      candidateName,
    };
  }
}
