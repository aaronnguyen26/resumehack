import { ResumeBullet } from '../types/index.js';

export interface ParsedResume {
  candidateName: string;
  contactInfo: string[];
  skillsText: string;
  skillTokens: string[];      // individual skill tokens for ATS scoring
  bullets: ResumeBullet[];
  sections: Record<string, string[]>;
  rawText: string;
  qualityScore: number;       // 0–100 extraction quality estimate
  extractionMethod: string;   // from PrecisionExtractor.strategyUsed
}

// ─── Section Header Patterns ──────────────────────────────────────────────────

const SECTION_PATTERNS: Record<string, RegExp> = {
  Experience: /^(work\s+)?experience$|^professional\s+experience$|^employment(s)?$|^relevant\s+experience$|^internship(s)?$|^work\s+history$/i,
  Projects: /^(technical\s+|personal\s+|selected\s+|software\s+)?projects?$/i,
  Education: /^education(al\s+background)?$|^academic\s+background$/i,
  Skills: /^(technical\s+|core\s+|professional\s+)?skills?$|^technologies?$|^technical\s+expertise$|^tech\s+stack$/i,
  Leadership: /^leadership(\s+experience)?$|^extracurriculars?$|^campus\s+involvement$/i,
  Activities: /^(campus\s+)?activities$|^involvement$|^volunteer(ing)?$|^community\s+service$/i,
  Research: /^research(\s+experience)?$|^publications?$|^academic\s+research$/i,
  Certifications: /^certifications?$|^licenses?\s*(&|and)?\s*certifications?$/i,
  Awards: /^awards?$|^honors?$|^achievements?$|^scholarships?$/i,
  Summary: /^(professional\s+)?summary$|^(career\s+)?objective$|^profile$|^about(\s+me)?$/i,
  Coursework: /^(relevant\s+)?coursework$|^key\s+courses$|^academic\s+coursework$/i,
};

// ─── Text Cleaning ─────────────────────────────────────────────────────────────

/**
 * Post-process raw extracted text to remove DOM-extraction artifacts:
 * - Deduplicate lines using a sliding window (handles Google Docs wrapper/leaf duplication)
 * - Strip lone page numbers, navigation elements, empty lines
 * - Normalize whitespace
 */
export function cleanRawText(raw: string): string {
  const rawLines = raw.split('\n');
  const result: string[] = [];

  // Sliding window deduplication: tracks last 20 normalized lines
  const recentNorm: string[] = [];

  for (const rawLine of rawLines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Skip navigation / UI artifacts
    if (/^(file|edit|view|insert|format|tools|extensions?|help|share|comments?)$/i.test(line)) continue;
    // Skip lone single digits (page numbers)
    if (/^\d{1,2}$/.test(line)) continue;
    // Skip Google Docs toolbar remnants
    if (line.length < 2) continue;

    // Normalize for dedup comparison: lowercase, collapse whitespace, strip punctuation
    const norm = line.toLowerCase().replace(/[\s\-•*|]+/g, ' ').trim();

    if (recentNorm.includes(norm)) continue; // duplicate — skip

    recentNorm.push(norm);
    if (recentNorm.length > 20) recentNorm.shift(); // keep window at 20

    result.push(line);
  }

  return result.join('\n');
}

// ─── Parser Service ───────────────────────────────────────────────────────────

export class ResumeParserService {
  /**
   * Parse raw text into a structured resume.
   * Works with output from PrecisionExtractor (any platform/strategy).
   *
   * @param rawText   - The extracted text from PrecisionExtractor
   * @param qualityScore  - Quality score from PrecisionExtractor (0–100), defaults to 50
   * @param extractionMethod - Strategy name from PrecisionExtractor
   */
  public parse(
    rawText: string,
    qualityScore = 50,
    extractionMethod = 'html-semantic',
  ): ParsedResume {
    if (!rawText || rawText.trim().length === 0) {
      return {
        candidateName: 'Your Resume',
        contactInfo: [],
        skillsText: '',
        skillTokens: [],
        bullets: [],
        sections: {},
        rawText: '',
        qualityScore: 0,
        extractionMethod,
      };
    }

    const cleaned = cleanRawText(rawText);
    const lines = cleaned.split('\n');

    let candidateName = 'Your Resume';
    let skillsText = '';
    const bullets: ResumeBullet[] = [];
    const sections: Record<string, string[]> = {};

    let currentSection = '';
    let currentOrg = '';
    let currentRole = '';
    let lastBulletIdx = -1;   // index into bullets[] for continuation-line detection

    // ── Header block (before first section header) ──
    const headerLines: string[] = [];
    let firstSectionIdx = lines.length;

    for (let i = 0; i < lines.length; i++) {
      if (this.matchSection(lines[i]) !== null) {
        firstSectionIdx = i;
        break;
      }
      headerLines.push(lines[i]);
    }

    if (headerLines.length > 0) {
      const nameLine = headerLines[0];
      // Reject as name if it contains email/URL/starts with digit
      if (
        nameLine.length <= 60 &&
        !/@/.test(nameLine) &&
        !/https?:\/\//.test(nameLine) &&
        !/^[\d(+]/.test(nameLine)
      ) {
        candidateName = nameLine;
      }
    }
    const contactInfo = headerLines.slice(1, 5).filter(l => l.length > 0);

    // ── Body sections ──
    for (let i = firstSectionIdx; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;

      const sectionMatch = this.matchSection(line);
      if (sectionMatch !== null) {
        currentSection = sectionMatch;
        sections[currentSection] = sections[currentSection] ?? [];
        currentOrg = '';
        currentRole = '';
        continue;
      }

      if (!currentSection) currentSection = 'Experience';
      if (!sections[currentSection]) sections[currentSection] = [];
      sections[currentSection].push(line);

      if (currentSection === 'Skills' || currentSection === 'Coursework') {
        skillsText += ' ' + line;
        continue;
      }

      if (currentSection === 'Education' || currentSection === 'Awards' || currentSection === 'Certifications') {
        continue;
      }

      // Check for bullet prefix
      const bulletInfo = this.extractBulletInfo(line);
      if (bulletInfo !== null) {
        if (bulletInfo.text.length > 10) {
          bullets.push({
            id: `bullet-${bullets.length + 1}`,
            section: currentSection,
            organization: currentOrg || currentSection + ' Item',
            role: currentRole,
            originalText: bulletInfo.text,
            prefix: bulletInfo.prefix,
          });
          lastBulletIdx = bullets.length - 1;
        }
        continue;
      }

      // Check for org/role header
      if (this.looksLikeOrgHeader(line)) {
        const parts = line.split(/\s*[|·—–]\s*/);
        currentOrg = (parts[0] || line).trim().slice(0, 80);
        currentRole = (parts[1] || '').trim().slice(0, 80);
        lastBulletIdx = -1; // reset continuation tracking after new org
        continue;
      }

      // Continuation line detection:
      // If the last line was a bullet, and this line looks like it continues the
      // thought (no date, no section, starts lowercase or with a connector word,
      // short-ish), append it to the previous bullet
      if (
        lastBulletIdx >= 0 &&
        lastBulletIdx < bullets.length &&
        line.length > 5 &&
        line.length < 200 &&
        !this.looksLikeDateLine(line) &&
        !this.looksLikeOrgHeader(line) &&
        (
          /^[a-z]/.test(line) ||                          // starts lowercase
          /^(and|or|also|including|such as|e\.g\.|i\.e\.|through|by|using|via)\b/i.test(line) ||
          /^[,;–—]/.test(line)                            // starts with punctuation connector
        )
      ) {
        bullets[lastBulletIdx].originalText += ' ' + line.trim();
        continue;
      }

      // Long descriptive lines without bullet prefix
      if (
        (currentSection === 'Experience' || currentSection === 'Projects' || currentSection === 'Leadership' || currentSection === 'Research') &&
        line.length > 40 &&
        !this.looksLikeDateLine(line)
      ) {
        bullets.push({
          id: `bullet-${bullets.length + 1}`,
          section: currentSection,
          organization: currentOrg || currentSection + ' Item',
          role: currentRole,
          originalText: line,
        });
        lastBulletIdx = bullets.length - 1;
      }
    }

    // Final fallback: zero bullets → every substantial non-header line becomes a bullet
    if (bullets.length === 0 && lines.length > 2) {
      lines.forEach((line, idx) => {
        if (idx === 0) return;
        if (line.length > 30 && !this.matchSection(line) && !this.looksLikeDateLine(line)) {
          bullets.push({
            id: `bullet-${bullets.length + 1}`,
            section: 'Experience',
            organization: 'Work Experience',
            role: '',
            originalText: line.replace(/^[•\-*–—▪]\s*/, '').trim(),
          });
        }
      });
    }

    const skillTokens = this.tokenizeSkills(skillsText);

    return {
      candidateName,
      contactInfo,
      skillsText: skillsText.trim(),
      skillTokens,
      bullets: bullets.slice(0, 60),
      sections,
      rawText: cleaned,
      qualityScore,
      extractionMethod,
    };
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private matchSection(line: string): string | null {
    const norm = line.trim().toLowerCase().replace(/[:\-_#*•▪▸]/g, '').trim();
    if (!norm || norm.length > 50) return null;
    for (const [section, pattern] of Object.entries(SECTION_PATTERNS)) {
      if (pattern.test(norm)) return section;
    }
    return null;
  }

  private extractBulletInfo(line: string): { prefix: string; text: string } | null {
    const bulletPrefixMatch = line.match(/^(\s*[•\-*–—▪▸▹‣◦○]\s+)/);
    const numberedMatch = line.match(/^(\s*\d+[.)]\s+)/);
    if (bulletPrefixMatch) {
      return {
        prefix: bulletPrefixMatch[1],
        text: line.slice(bulletPrefixMatch[1].length).trim(),
      };
    }
    if (numberedMatch) {
      return {
        prefix: numberedMatch[1],
        text: line.slice(numberedMatch[1].length).trim(),
      };
    }
    return null;
  }

  private looksLikeOrgHeader(line: string): boolean {
    if (line.length > 120 || line.endsWith('.')) return false;
    // Must contain a delimiter (pipe, dot, em-dash) between org and role
    const hasDelimiter = /\s*[|·—–]\s*/.test(line);
    // Must be relatively short and start with a capital
    const isShortCapitalized = line.length < 80 && /^[A-Z]/.test(line);
    return hasDelimiter && isShortCapitalized;
  }

  private looksLikeDateLine(line: string): boolean {
    // "Jan 2023 – May 2024", "Summer 2025", "2023 – Present", "May 2024"
    if (/^\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december|summer|fall|spring|winter)[\s,]*\d{4}/i.test(line)) return true;
    if (/^\s*\d{4}\s*[–-]\s*(present|\d{4})/i.test(line)) return true;
    if (line.length < 30 && /\d{4}/.test(line) && !/[a-zA-Z]{4}/.test(line)) return true;
    return false;
  }

  /** Split skills text into individual tokens (comma / semicolon / pipe / newline separated) */
  private tokenizeSkills(raw: string): string[] {
    return raw
      .split(/[,;|\n\/]/)
      .map(s => s.trim())
      .filter(s => s.length >= 2 && s.length <= 40)
      .filter(s => !/^(and|or|the|of|in|for|with|using|including)$/i.test(s))
      .slice(0, 80);
  }
}
