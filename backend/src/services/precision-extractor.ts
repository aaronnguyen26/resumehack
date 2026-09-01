/**
 * PrecisionExtractor — Zero-API-key resume extraction engine
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

// ─── HTML → plain text (for mobilebasic, no DOM available in SW) ──────────────

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
  public async extract(
    tabId: number,
    tabUrl: string,
  ): Promise<ExtractionResult> {
    const platform = detectPlatform(tabUrl);
    let title = 'Scanned Resume';
    return {
      text: '',
      title,
      platform,
      strategyUsed: 'html-semantic',
      qualityScore: 0,
      wordCount: 0,
      url: tabUrl,
    };
  }

  public postProcess(raw: string): string {
    const lines = raw.split('\n');
    const result: string[] = [];
    const recentNorm: string[] = [];

    const ARTIFACT_LINE_PATTERNS = [
      /^(file|edit|view|insert|format|tools|extensions?|help|share|comments?|history)$/i,
      /^(normal text|heading [1-6]|title|subtitle|arial|times new roman|calibri|georgia)$/i,
      /^[\d]{1,2}$/,
      /^page \d+(\s+of\s+\d+)?$/i,
      /^\d{2,3}%$/, // zoom percentages
      /^(undo|redo|cut|copy|paste|select all|find|replace)$/i,
      /^(zoom|print|print layout|download|word count|spell check|explore|voice typing)$/i,
      /^(suggesting|editing|viewing|locked|protected)$/i,
    ];

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (line.length < 2) continue;
      if (line.length > 500) continue;

      if (ARTIFACT_LINE_PATTERNS.some(p => p.test(line))) continue;

      const norm = line.toLowerCase().replace(/[\s\-•*|]+/g, ' ').trim();
      if (recentNorm.includes(norm)) continue;

      recentNorm.push(norm);
      if (recentNorm.length > 25) recentNorm.shift();

      const normalized = line
        .replace(/^[-–—▪▸▹‣◦○]\s+/, '• ')
        .replace(/^\*\s+/, '• ');

      result.push(normalized);
    }

    return result.join('\n');
  }
}
