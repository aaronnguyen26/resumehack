/**
 * PDF Layout Detection & Preservation Engine
 *
 * Analyzes spatial geometry, bounding boxes, font attributes, and horizontal/vertical
 * gutters from PDF text items to detect and preserve:
 * 1. Multi-column vs single-column layouts (preventing cross-column text interleaving)
 * 2. Two-ended justification (Company/Role on left, Date/Location on right)
 * 3. Candidate header alignment (Left-aligned, Centered, Split)
 * 4. Typographic hierarchy (Name font size, section headers, body text, bold weights)
 * 5. Section styling and divider preferences
 */

export interface PositionedTextItem {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontName?: string;
  isBold?: boolean;
  isItalic?: boolean;
  fontSize?: number;
}

export type HeaderAlignment = 'left' | 'center' | 'split';
export type LayoutPreset = 'classic' | 'modern' | 'two_column' | 'minimal';
export type SectionDividerStyle = 'line' | 'accent' | 'minimal' | 'banner';

export interface ExtractedPdfLayout {
  columnCount: 1 | 2;
  columnBoundaryX?: number; // X coordinate separating column 1 from column 2
  headerAlignment: HeaderAlignment;
  hasSplitRows: boolean; // Whether role/company + date/location split rows were detected
  detectedPreset: LayoutPreset;
  sectionDivider: SectionDividerStyle;
  detectedFontFamily?: 'serif' | 'sans' | 'mono';
  detectedMarginSize?: 'compact' | 'standard' | 'relaxed';
  fontScale: {
    nameFontSize: number;
    headerFontSize: number;
    bodyFontSize: number;
  };
  margins: {
    left: number;
    right: number;
    top: number;
    bottom: number;
  };
}

export interface RawPdfItem {
  str?: string;
  transform?: number[];
  height?: number;
  width?: number;
  fontName?: string;
}

export const KNOWN_SECTION_HEADERS = [
  // Work Experience
  'WORK EXPERIENCE',
  'PROFESSIONAL EXPERIENCE',
  'RELEVANT EXPERIENCE',
  'RELEVANT WORK EXPERIENCE',
  'EMPLOYMENT HISTORY',
  'EMPLOYMENT',
  'EXPERIENCE',
  'WORK HISTORY',
  'CAREER HISTORY',
  'PROFESSIONAL BACKGROUND',
  'EXPERIENCE & EMPLOYMENT',
  'WORK EXPERIENCE & LEADERSHIP',
  'SELECTED EXPERIENCE',
  'INDUSTRY EXPERIENCE',
  'INTERNSHIP EXPERIENCE',
  'INTERNSHIPS',

  // Projects
  'FEATURED PROJECTS',
  'TECHNICAL PROJECTS',
  'PERSONAL PROJECTS',
  'ACADEMIC PROJECTS',
  'KEY PROJECTS',
  'SELECTED PROJECTS',
  'OPEN SOURCE PROJECTS',
  'PROJECT EXPERIENCE',
  'SOFTWARE PROJECTS',
  'PROJECTS',

  // Technical & Soft Skills
  'TECHNICAL SKILLS',
  'CORE COMPETENCIES',
  'SKILLS & EXPERTISE',
  'AREAS OF EXPERTISE',
  'SKILLS & INTERESTS',
  'TECHNICAL PROFICIENCIES',
  'SKILLS & TECHNOLOGIES',
  'CORE SKILLS',
  'KEY SKILLS',
  'TECHNICAL BACKGROUND',
  'LANGUAGES & FRAMEWORKS',
  'PROGRAMMING LANGUAGES',
  'TOOLS & TECHNOLOGIES',
  'LANGUAGES & TOOLS',
  'TECHNICAL TOOLKIT',
  'SKILLS & ABILITIES',
  'SKILLS',

  // Education & Academics
  'EDUCATION & CREDENTIALS',
  'EDUCATION',
  'ACADEMIC BACKGROUND',
  'EDUCATION & TRAINING',
  'EDUCATION AND TRAINING',
  'ACADEMIC HISTORY',
  'DEGREES & EDUCATION',
  'EDUCATION & HONORS',
  'COURSEWORK',
  'RELEVANT COURSEWORK',

  // Certifications & Licenses
  'CERTIFICATIONS',
  'LICENSES & CERTIFICATIONS',
  'CERTIFICATES',
  'CREDENTIALS',
  'LICENSES',

  // Honors & Awards
  'HONORS & AWARDS',
  'AWARDS & HONORS',
  'HONORS',
  'AWARDS',
  'HONORS & ACHIEVEMENTS',
  'SCHOLARSHIPS',
  'AWARDS & SCHOLARSHIPS',
  'ACHIEVEMENTS',

  // Research & Publications
  'PUBLICATIONS',
  'PATENTS',
  'RESEARCH EXPERIENCE',
  'RESEARCH',
  'RESEARCH & PUBLICATIONS',
  'PUBLICATIONS & PRESENTATIONS',
  'PRESENTATIONS',
  'TALKS',
  'CONFERENCE PRESENTATIONS',

  // Leadership & Extracurricular
  'LEADERSHIP',
  'ACTIVITIES',
  'EXTRACURRICULAR ACTIVITIES',
  'EXTRACURRICULAR',
  'COMMUNITY INVOLVEMENT',
  'VOLUNTEERING',
  'VOLUNTEER EXPERIENCE',
  'LEADERSHIP & INVOLVEMENT',
  'LEADERSHIP & SERVICE',
  'CAMPUS INVOLVEMENT',
  'COLLEGIATE ACTIVITIES',
  'ORGANIZATIONS',
  'AFFILIATIONS',
  'PROFESSIONAL AFFILIATIONS',
  'MEMBERSHIPS',

  // Summary & Profile
  'SUMMARY',
  'PROFESSIONAL SUMMARY',
  'EXECUTIVE SUMMARY',
  'PROFILE',
  'ABOUT ME',
  'ABOUT',
  'CAREER OBJECTIVE',
  'OBJECTIVE',
  'PROFESSIONAL OBJECTIVE',
  'QUALIFICATIONS',
  'SUMMARY OF QUALIFICATIONS',
  'HIGHLIGHTS OF QUALIFICATIONS',

  // Languages & Interests
  'LANGUAGES',
  'SPOKEN LANGUAGES',
  'FOREIGN LANGUAGES',
  'INTERESTS',
  'PERSONAL INTERESTS',
  'HOBBIES',

  // Specialized
  'MILITARY SERVICE',
  'MILITARY EXPERIENCE',
  'SECURITY CLEARANCES',
  'CLEARANCES',
];

/**
 * Universal, robust section header tester recognizing formatting styles across diverse PDF templates:
 * - Direct known headers
 * - Numbered/bulleted headers e.g. "1. WORK EXPERIENCE", "• EDUCATION"
 * - Spaced letter tracking e.g. "E D U C A T I O N"
 * - Decorated headers with trailing colons, dashes e.g. "EXPERIENCE:", "--- SKILLS ---"
 */
export function isKnownSectionHeader(rawText: string): boolean {
  if (!rawText) return false;
  const trimmed = rawText.trim();
  if (!trimmed || trimmed.length > 55) return false;
  if (trimmed.includes('@') || /https?:\/\//i.test(trimmed) || /linkedin\.com|github\.com/i.test(trimmed)) return false;

  // Clean off leading numbers, bullets, dashes, icons e.g. "1. ", "01. ", "## ", "--- ", "• "
  const cleaned = trimmed
    .replace(/^[\p{Emoji}\p{Symbol}\s#0-9.\-_|=•▪▸▹‣◦○*–—●■◆✦➢✓\uF0B7\u25CF\u25CB\u25A0\u25AA\u2022\u2023\u2043\u2013\u2014]+/u, '')
    .replace(/[:\-–—_.=\s]+$/, '')
    .trim()
    .toUpperCase();

  if (!cleaned) return false;

  if (KNOWN_SECTION_HEADERS.includes(cleaned)) return true;

  // Spaced-out letters e.g. "E D U C A T I O N"
  const noSpaces = cleaned.replace(/\s+/g, '');
  if (KNOWN_SECTION_HEADERS.some(h => h.replace(/\s+/g, '') === noSpaces)) return true;

  // Regex match for standard combinations e.g. "EXPERIENCE & PROJECTS", "TECHNICAL SKILLS & TOOLS"
  if (/^(WORK\s+EXPERIENCE|PROFESSIONAL\s+EXPERIENCE|RELEVANT\s+EXPERIENCE|EMPLOYMENT|EXPERIENCE|PROJECTS|TECHNICAL\s+PROJECTS|SKILLS|TECHNICAL\s+SKILLS|EDUCATION|CERTIFICATIONS|PUBLICATIONS|LEADERSHIP|SUMMARY|AWARDS|HONORS|ACTIVITIES|VOLUNTEERING|COURSEWORK|LANGUAGES|INTERESTS)(?:\s*(?:&|AND|\/|\+)\s*[A-Z\s]+)?$/i.test(cleaned)) {
    return true;
  }

  return false;
}

/**
 * Converts raw PDF.js items into normalized PositionedTextItem models with typography flags.
 */
export function normalizePdfItems(rawItems: RawPdfItem[]): PositionedTextItem[] {
  if (!rawItems || rawItems.length === 0) return [];

  const items: PositionedTextItem[] = [];

  for (const raw of rawItems) {
    const text = raw.str || '';
    if (!text && text.trim() === '') continue;

    const transform = raw.transform || [1, 0, 0, 1, 0, 0];
    const x = transform[4] || 0;
    const y = transform[5] || 0;
    const height = raw.height || Math.abs(transform[3]) || 10;
    const width = raw.width || 0;
    const fontName = raw.fontName || '';

    const isBold = (raw as any).isBold !== undefined
      ? Boolean((raw as any).isBold)
      : /bold|black|heavy|medium|semibold|bld/i.test(fontName);
    const isItalic = (raw as any).isItalic !== undefined
      ? Boolean((raw as any).isItalic)
      : /italic|oblique/i.test(fontName);

    items.push({
      text,
      x,
      y,
      width,
      height,
      fontName,
      isBold,
      isItalic,
      fontSize: height,
    });
  }

  return items;
}

/**
 * Detects whether the document possesses a 2-column layout (e.g. sidebar + main column).
 * Analyzes horizontal gaps and checks for vertical line overlap across columns.
 */
export function detectColumns(
  items: PositionedTextItem[],
  pageWidth = 612
): {
  columnCount: 1 | 2;
  columnBoundaryX?: number;
  column1Items?: PositionedTextItem[];
  column2Items?: PositionedTextItem[];
} {
  if (items.length < 5) {
    return { columnCount: 1 };
  }

  // Find candidate name / top header region to exclude from column detection
  const maxY = Math.max(...items.map(it => it.y));
  const bodyItems = items.filter(it => it.y < maxY - 60);

  if (bodyItems.length < 4) {
    return { columnCount: 1 };
  }

  // Check candidate boundaries between 20% and 80% of page width (supports left sidebar, 50/50, and right sidebar)
  const minSplitX = pageWidth * 0.20;
  const maxSplitX = pageWidth * 0.80;

  let maxSeparationScore = 0;
  let minSplitForMaxScore = 0;
  let maxSplitForMaxScore = 0;

  // Test candidate vertical split gutters every 5 points for precision
  for (let splitX = minSplitX; splitX <= maxSplitX; splitX += 5) {
    const gutterWidth = 14;
    const leftBound = splitX - gutterWidth / 2;
    const rightBound = splitX + gutterWidth / 2;

    const leftCol = bodyItems.filter(it => it.x + it.width <= leftBound + 12);
    const rightCol = bodyItems.filter(it => it.x >= rightBound - 12);
    const crossingItems = bodyItems.filter(
      it => it.x < leftBound && it.x + it.width > rightBound
    );

    // If items frequently cross this boundary, it's not a true 2-column gutter
    if (crossingItems.length > 2) continue;

    // Both columns must have substantive content
    if (leftCol.length >= 2 && rightCol.length >= 2) {
      // Check for vertical overlap between left and right columns
      const leftYMin = Math.min(...leftCol.map(it => it.y));
      const leftYMax = Math.max(...leftCol.map(it => it.y));
      const rightYMin = Math.min(...rightCol.map(it => it.y));
      const rightYMax = Math.max(...rightCol.map(it => it.y));

      const overlapStart = Math.max(leftYMin, rightYMin);
      const overlapEnd = Math.min(leftYMax, rightYMax);
      const overlapHeight = Math.max(0, overlapEnd - overlapStart);

      if (overlapHeight >= 20 || (overlapEnd >= overlapStart && leftCol.length >= 3 && rightCol.length >= 3)) {
        const score = (leftCol.length + rightCol.length) * (Math.max(1, overlapHeight) / 50);
        if (score > maxSeparationScore) {
          maxSeparationScore = score;
          minSplitForMaxScore = splitX;
          maxSplitForMaxScore = splitX;
        } else if (score === maxSeparationScore && maxSeparationScore > 0) {
          maxSplitForMaxScore = splitX;
        }
      }
    }
  }

  if (maxSeparationScore > 0) {
    const bestSplitX = (minSplitForMaxScore + maxSplitForMaxScore) / 2;
    const col1 = items.filter(it => it.x < bestSplitX);
    const col2 = items.filter(it => it.x >= bestSplitX);
    return {
      columnCount: 2,
      columnBoundaryX: Math.round(bestSplitX * 10) / 10,
      column1Items: col1,
      column2Items: col2,
    };
  }

  return { columnCount: 1 };
}

/**
 * Detects header alignment (Centered, Left-aligned, or Split).
 */
export function detectHeaderAlignment(
  items: PositionedTextItem[],
  pageWidth = 612
): HeaderAlignment {
  if (items.length === 0) return 'left';

  // Extract items in top 15% of document
  const maxY = Math.max(...items.map(it => it.y));
  const topItems = items.filter(it => it.y >= maxY - 90);

  if (topItems.length === 0) return 'left';

  // Find candidate name item (largest font height in top region)
  let nameItem = topItems[0];
  for (const it of topItems) {
    if (it.height > nameItem.height) {
      nameItem = it;
    }
  }

  const nameMidX = nameItem.x + (nameItem.width || nameItem.text.length * (nameItem.height * 0.4)) / 2;
  const pageCenter = pageWidth / 2;

  // If candidate name center is within 55px of page center, it's centered
  if (Math.abs(nameMidX - pageCenter) <= 55) {
    return 'center';
  }

  // Check if candidate name is left-aligned but contact details are pushed to far right
  const otherTopItems = topItems.filter(it => it !== nameItem);
  const rightContactItems = otherTopItems.filter(it => it.x > pageWidth * 0.55);
  if (nameItem.x < pageWidth * 0.35 && rightContactItems.length >= 2) {
    return 'split';
  }

  return 'left';
}

/**
 * Detects whether the resume utilizes two-ended rows (e.g. Job Title on Left, Dates/Location on Right).
 */
export function detectSplitRows(items: PositionedTextItem[], pageWidth = 612): boolean {
  if (items.length < 2) return false;

  // Look for items sharing the same Y level (within 4.2px) where one is on left and one is on right
  const dateRegex = /\b(19\d{2}|20\d{2}|Present|Current|Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?|Spring|Summer|Fall|Autumn|Winter|Remote|Hybrid|CA|NY|WA|TX|MA|IL|FL|NC|VA|GA|CO|PA|OH|MI|NJ|AZ|TN|IN|MD|WI|MN|MO|SC|AL|LA|KY|OR|OK|CT|UT|IA|NV|AR|MS|KS|NM|NE|WV|ID|HI|NH|ME|MT|RI|DE|SD|ND|AK|VT|WY|USA|UK|Vietnam)\b/i;
  let splitRowMatches = 0;

  for (let i = 0; i < items.length; i++) {
    const itemA = items[i];
    if (itemA.x > pageWidth * 0.45) continue;

    for (let j = 0; j < items.length; j++) {
      if (i === j) continue;
      const itemB = items[j];
      const maxDelta = Math.max(4.2, (itemA.height || 10) * 0.42);
      if (Math.abs(itemA.y - itemB.y) <= maxDelta && itemB.x >= pageWidth * 0.52) {
        if (dateRegex.test(itemB.text) || itemB.text.includes(',') || itemB.text.includes('|') || /\d{1,2}\/\d{2,4}/.test(itemB.text) || /[-–—]/.test(itemB.text)) {
          splitRowMatches++;
          if (splitRowMatches >= 2) return true;
        }
      }
    }
  }

  return splitRowMatches >= 1;
}

/**
 * Computes full layout audit and presets from PDF text items.
 */
export function detectPdfLayout(
  rawItems: RawPdfItem[],
  pageWidth = 612
): ExtractedPdfLayout {
  const items = normalizePdfItems(rawItems);

  if (items.length === 0) {
    return {
      columnCount: 1,
      headerAlignment: 'left',
      hasSplitRows: true,
      detectedPreset: 'classic',
      sectionDivider: 'line',
      fontScale: {
        nameFontSize: 24,
        headerFontSize: 13,
        bodyFontSize: 10.5,
      },
      margins: { left: 36, right: 36, top: 36, bottom: 36 },
    };
  }

  // 1. Column detection
  const colInfo = detectColumns(items, pageWidth);

  // 2. Header alignment
  const headerAlignment = detectHeaderAlignment(items, pageWidth);

  // 3. Two-ended split rows
  const hasSplitRows = detectSplitRows(items, pageWidth);

  // 4. Typographic scale
  const heights = items.map(it => it.height).filter(h => h > 5 && h < 50);
  const maxHeight = Math.max(...heights, 22);
  const minHeight = Math.min(...heights, 10);
  const sortedHeights = [...heights].sort((a, b) => a - b);
  const medianHeight = sortedHeights[Math.floor(sortedHeights.length / 2)] || 10.5;

  // 5. Determine best matching preset
  let detectedPreset: LayoutPreset = 'classic';
  if (colInfo.columnCount === 2) {
    detectedPreset = 'two_column';
  } else if (headerAlignment === 'center') {
    detectedPreset = 'modern';
  } else if (hasSplitRows) {
    detectedPreset = 'classic';
  } else {
    detectedPreset = 'minimal';
  }

  // 6. Section divider style
  const sectionDivider: SectionDividerStyle = detectedPreset === 'minimal' ? 'minimal' : 'line';

  // 7. Font family detection (including LaTeX Computer Modern and common publishing fonts)
  let detectedFontFamily: 'serif' | 'sans' | 'mono' = 'sans';
  let serifCount = 0;
  let monoCount = 0;
  for (const it of items) {
    const fn = (it.fontName || '').toLowerCase();
    if (/times|georgia|garamond|serif|cambria|palatino|baskerville|minion|roman|charter|pt serif|merriweather|cmr|cmbx|cmti|computermodern|latin modern|lmroman/i.test(fn)) {
      serifCount++;
    } else if (/courier|mono|consolas|menlo|source code|fira code/i.test(fn)) {
      monoCount++;
    }
  }
  if (serifCount > 0 && serifCount >= monoCount && (serifCount >= items.length * 0.12 || serifCount >= 4)) {
    detectedFontFamily = 'serif';
  } else if (monoCount > items.length * 0.2) {
    detectedFontFamily = 'mono';
  }

  // 8. Margins
  const minX = Math.min(...items.map(it => it.x));
  const maxX = Math.max(...items.map(it => it.x + (it.width || 20)));
  const minY = Math.min(...items.map(it => it.y));
  const maxY = Math.max(...items.map(it => it.y));

  let detectedMarginSize: 'compact' | 'standard' | 'relaxed' = 'standard';
  if (minX <= 38 || (pageWidth - maxX) <= 38) {
    detectedMarginSize = 'compact';
  } else if (minX >= 52 && (pageWidth - maxX) >= 52) {
    detectedMarginSize = 'relaxed';
  }

  return {
    columnCount: colInfo.columnCount,
    columnBoundaryX: colInfo.columnBoundaryX,
    headerAlignment,
    hasSplitRows,
    detectedPreset,
    sectionDivider,
    detectedFontFamily,
    detectedMarginSize,
    fontScale: {
      nameFontSize: Math.round(maxHeight * 10) / 10,
      headerFontSize: Math.round((medianHeight * 1.25) * 10) / 10,
      bodyFontSize: Math.round(medianHeight * 10) / 10,
    },
    margins: {
      left: Math.max(20, Math.min(72, Math.round(minX))),
      right: Math.max(20, Math.min(72, Math.round(pageWidth - maxX))),
      top: Math.max(20, Math.min(72, Math.round(792 - maxY))),
      bottom: Math.max(20, Math.min(72, Math.round(minY))),
    },
  };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export interface HighFidelityPdfResult {
  html: string;
  text: string;
  layout: ExtractedPdfLayout;
}

/**
 * Constructs a pixel-faithful, high-fidelity semantic HTML document and ATS-compliant plaintext
 * directly from PDF.js positioned text items.
 *
 * Preserves:
 * 1. Exact typography hierarchy (name, headers, titles, dates, body font sizes in px)
 * 2. Header alignment (centered, left, or split)
 * 3. Two-ended justification (role/company on left, dates/location on right)
 * 4. Section dividers (line, accent, minimal, banner)
 * 5. Multi-column spatial layout (CSS grid with exact sidebar and main column partitioning)
 * 6. Zero content loss: every line, word, date, and bullet from the PDF is preserved.
 */
export function buildHighFidelityPdfHtml(
  rawItems: RawPdfItem[],
  pageWidth = 612,
  pageHeight = 792,
  pageNumber = 1
): HighFidelityPdfResult {
  const items = normalizePdfItems(rawItems);
  const layout = detectPdfLayout(rawItems, pageWidth);

  if (items.length === 0) {
    return {
      html: '',
      text: '',
      layout,
    };
  }

  // Sort items top-to-bottom (Y descending), then left-to-right (X ascending)
  items.sort((a, b) => {
    const yDelta = b.y - a.y;
    if (Math.abs(yDelta) > 3.0) return yDelta;
    return a.x - b.x;
  });

  interface LineSegment {
    text: string;
    x: number;
    width: number;
    height: number;
    fontSize: number;
    isBold: boolean;
    isItalic: boolean;
  }

  interface VisualLine {
    y: number;
    minX: number;
    maxX: number;
    maxHeight: number;
    fontSize: number;
    isBold: boolean;
    isItalic: boolean;
    segments: LineSegment[];
    rawText: string;
  }

  const flushGroupToLine = (group: PositionedTextItem[], lineY: number | null): VisualLine | null => {
    if (group.length === 0) return null;
    group.sort((a, b) => a.x - b.x);

    const segments: LineSegment[] = [];
    let currentSegText = '';
    let segStartX = group[0].x;
    let segWidth = 0;
    let segHeight = group[0].height || 10;
    let segFontSize = group[0].fontSize || 10.5;
    let segIsBold = Boolean(group[0].isBold);
    let segIsItalic = Boolean(group[0].isItalic);

    const dateRegex = /\b(19\d{2}|20\d{2}|Present|Current|Online|Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?|Spring|Summer|Fall|Autumn|Winter|Remote|Hybrid|CA|NY|WA|TX|MA|IL|FL|NC|VA|GA|CO|PA|OH|MI|NJ|AZ|TN|IN|MD|WI|MN|MO|SC|AL|LA|KY|OR|OK|CT|UT|IA|NV|AR|MS|KS|NM|NE|WV|ID|HI|NH|ME|MT|RI|DE|SD|ND|AK|VT|WY|USA|UK|Vietnam|City|Freshman|Senior|Junior|Sophomore)\b/i;

    for (let i = 0; i < group.length; i++) {
      const it = group[i];
      if (i === 0) {
        currentSegText = it.text;
        segWidth = it.width || it.text.length * (segFontSize * 0.52);
      } else {
        const prev = group[i - 1];
        const prevWidth = prev.width > 0 ? prev.width : prev.text.length * ((prev.fontSize || 10) * 0.52);
        const gap = it.x - (prev.x + prevWidth);

        const isDateOrLoc = dateRegex.test(it.text) || /\d{1,2}\/\d{2,4}/.test(it.text) || /[-–—]\s*(?:19\d{2}|20\d{2}|Present)/i.test(it.text);
        const isSplitGap = (gap >= 18 && it.x >= pageWidth * 0.38) || (gap >= 10 && isDateOrLoc && it.x >= pageWidth * 0.35);

        // Wide gap or explicit date/location item indicates two-ended split
        if (isSplitGap) {
          segments.push({
            text: currentSegText.trim(),
            x: segStartX,
            width: segWidth,
            height: segHeight,
            fontSize: segFontSize,
            isBold: segIsBold,
            isItalic: segIsItalic,
          });
          currentSegText = it.text;
          segStartX = it.x;
          segWidth = it.width || it.text.length * ((it.fontSize || 10) * 0.52);
          segHeight = it.height || 10;
          segFontSize = it.fontSize || 10.5;
          segIsBold = Boolean(it.isBold);
          segIsItalic = Boolean(it.isItalic);
        } else if (prev.text.length === 1 && it.text.length === 1 && gap < Math.max(3.2, (it.fontSize || 10) * 0.45)) {
          // Intra-word character tracking / kerning: append without extra space
          currentSegText += it.text;
          segWidth += gap + (it.width || it.text.length * ((it.fontSize || 10) * 0.52));
        } else if (gap > Math.max(1.8, (it.fontSize || 10) * 0.18)) {
          currentSegText += ' ' + it.text;
          segWidth += gap + (it.width || it.text.length * ((it.fontSize || 10) * 0.52));
        } else {
          currentSegText += it.text;
          segWidth += (it.width || it.text.length * ((it.fontSize || 10) * 0.52));
        }
      }
    }

    if (currentSegText.trim()) {
      segments.push({
        text: currentSegText.trim(),
        x: segStartX,
        width: segWidth,
        height: segHeight,
        fontSize: segFontSize,
        isBold: segIsBold,
        isItalic: segIsItalic,
      });
    }

    // Normalize any spaced section headers e.g. "E D U C A T I O N" -> "EDUCATION"
    for (const seg of segments) {
      const stripped = seg.text.replace(/\s+/g, '').toUpperCase();
      const matched = KNOWN_SECTION_HEADERS.find(h => h.replace(/\s+/g, '').toUpperCase() === stripped);
      if (matched && seg.text.includes(' ') && stripped.length > 3) {
        seg.text = matched;
      }
    }

    const minX = Math.min(...group.map(it => it.x));
    const maxX = Math.max(...group.map(it => it.x + (it.width || it.text.length * 6)));
    const maxHeight = Math.max(...group.map(it => it.height || 10));
    const maxFontSize = Math.max(...group.map(it => it.fontSize || it.height || 10));
    const anyBold = group.some(it => it.isBold);
    const anyItalic = group.some(it => it.isItalic);
    const rawText = segments.map(s => s.text).join('   |   ');

    return {
      y: lineY || 0,
      minX,
      maxX,
      maxHeight,
      fontSize: maxFontSize,
      isBold: anyBold,
      isItalic: anyItalic,
      segments,
      rawText,
    };
  };

  const clusterItemsIntoVisualLines = (itemList: PositionedTextItem[]): VisualLine[] => {
    const sorted = [...itemList].sort((a, b) => {
      const yDelta = b.y - a.y;
      if (Math.abs(yDelta) > 3.0) return yDelta;
      return a.x - b.x;
    });

    const lines: VisualLine[] = [];
    let currentGroup: PositionedTextItem[] = [];
    let baseY: number | null = null;

    for (const item of sorted) {
      const itemTolerance = Math.max(3.8, (item.height || 10) * 0.38);
      if (baseY === null || Math.abs(item.y - baseY) <= itemTolerance) {
        currentGroup.push(item);
        if (baseY === null) {
          baseY = item.y;
        }
      } else {
        const line = flushGroupToLine(currentGroup, baseY);
        if (line) lines.push(line);
        currentGroup = [item];
        baseY = item.y;
      }
    }
    if (currentGroup.length > 0) {
      const line = flushGroupToLine(currentGroup, baseY);
      if (line) lines.push(line);
    }

    return lines;
  };

  let candidateName = '';
  let contactText = '';
  let headerHtml = '';
  let bodyItems = items;

  if (pageNumber === 1) {
    // Identify top candidate header region: items above the first section header
    let firstSecHeaderY: number | null = null;
    for (const it of items) {
      if (isKnownSectionHeader(it.text)) {
        if (firstSecHeaderY === null || it.y > firstSecHeaderY) {
          firstSecHeaderY = it.y;
        }
      }
    }

    const maxY = Math.max(...items.map(it => it.y));
    const headerThreshold = firstSecHeaderY !== null ? firstSecHeaderY : (maxY - 80);
    const headerItems = items.filter(it => it.y > headerThreshold && !isKnownSectionHeader(it.text));
    bodyItems = items.filter(it => !headerItems.includes(it));

    const topLines = clusterItemsIntoVisualLines(headerItems.length > 0 ? headerItems : items.slice(0, 2));
    let nameLine = topLines[0];
    for (const l of topLines) {
      if (l.fontSize > (nameLine?.fontSize || 0)) {
        nameLine = l;
      }
    }

    candidateName = nameLine?.segments.map(s => s.text).join(' ') || nameLine?.rawText || 'Candidate';
    const headerContactLines = topLines.filter(l => l !== nameLine);
    contactText = headerContactLines.map(l => l.segments.map(s => s.text).join(' • ')).join(' • ');

    const headerClass = layout.headerAlignment === 'center'
      ? `doc-header text-center pb-2 mb-3`
      : layout.headerAlignment === 'split'
      ? `doc-header flex flex-col sm:flex-row sm:items-end justify-between pb-2 mb-3 gap-2`
      : `doc-header text-left pb-2 mb-3`;

    headerHtml = `
      <div class="${headerClass}">
        <div>
          <h1 class="doc-candidate-name font-bold text-2xl sm:text-3xl tracking-tight text-zinc-950 dark:text-white pb-1">${escapeHtml(candidateName)}</h1>
        </div>
        ${contactText ? `<p class="doc-contact-info text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">${escapeHtml(contactText)}</p>` : ''}
      </div>
    `.trim();
  }

  // Helper for section headers
  const isSectionHeader = (line: VisualLine): boolean => {
    const txt = line.rawText.trim();
    if (!txt || txt.length > 55) return false;
    if (/^[•▪▸▹‣◦○*\-–—●■◆✦➢✓\uF0B7\u25CF\u25CB\u25A0\u25AA\u2022\u2023\u2043\u2013\u2014]\s*/.test(txt)) return false;
    if (txt.includes('@') || /linkedin\.com|github\.com|http/i.test(txt)) return false;

    if (isKnownSectionHeader(txt)) {
      return true;
    }

    if ((line.isBold || /^[A-Z0-9\s&/-]{3,}$/.test(txt)) && line.fontSize >= (layout.fontScale.bodyFontSize + 1.2) && !txt.endsWith('.')) {
      return true;
    }

    return false;
  };

  // Helper to format section header tag
  const formatSectionHeaderTag = (title: string): string => {
    switch (layout.sectionDivider) {
      case 'accent':
        return `<h2 class="doc-section-header font-bold text-xs uppercase text-zinc-950 dark:text-white border-l-2 border-zinc-950 dark:border-zinc-100 pl-2 mt-4 mb-2">${escapeHtml(title)}</h2>`;
      case 'minimal':
        return `<h2 class="doc-section-header font-bold text-xs uppercase text-zinc-950 dark:text-white mt-4 mb-2">${escapeHtml(title)}</h2>`;
      case 'banner':
        return `<h2 class="doc-section-header font-bold text-xs uppercase text-zinc-950 dark:text-white bg-zinc-100 dark:bg-zinc-800/80 px-2 py-0.5 rounded mt-4 mb-2">${escapeHtml(title)}</h2>`;
      case 'line':
      default:
        return `<h2 class="doc-section-header font-bold text-xs uppercase text-zinc-950 dark:text-white border-b-[1.5px] border-zinc-950 dark:border-zinc-200 pb-0.5 mt-4 mb-2">${escapeHtml(title)}</h2>`;
    }
  };

  // Format a list of visual lines into HTML sections and clean plaintext
  const formatLinesToHtmlSections = (lines: VisualLine[]): { html: string; text: string } => {
    interface SectionBlock {
      header: string;
      lines: VisualLine[];
    }

    const sections: SectionBlock[] = [];
    let currentSection: SectionBlock = { header: '', lines: [] };

    for (const l of lines) {
      if (isSectionHeader(l)) {
        if (currentSection.header || currentSection.lines.length > 0) {
          sections.push(currentSection);
        }
        currentSection = { header: l.rawText.trim(), lines: [] };
      } else {
        currentSection.lines.push(l);
      }
    }
    if (currentSection.header || currentSection.lines.length > 0) {
      sections.push(currentSection);
    }

    const htmlParts: string[] = [];
    const textLines: string[] = [];

    const bulletRegex = /^[\uF0B7\u25CF\u25CB\u25A0\u25AA\u2022\u2023\u2043\u2013\u2014•▪▸▹‣◦○*\-●■◆✦➢✓–—]\s*/;

    for (const sec of sections) {
      let secHtml = `<div class="doc-section mb-4">`;
      if (sec.header) {
        secHtml += `\n  ${formatSectionHeaderTag(sec.header)}`;
        textLines.push(sec.header);
      }

      let currentBullets: string[] = [];
      let lastBulletY: number | null = null;
      const flushBullets = () => {
        if (currentBullets.length > 0) {
          secHtml += `\n  <ul class="doc-bullets list-disc pl-5 space-y-1 my-1.5 text-xs text-zinc-800 dark:text-zinc-200">`;
          for (const b of currentBullets) {
            const skillMatch = b.match(/^([A-Za-z0-9\s&/-]+):(\s+.+)$/);
            if (skillMatch && /skills|technologies|competencies/i.test(sec.header)) {
              secHtml += `\n    <li><strong>${escapeHtml(skillMatch[1])}:</strong>${escapeHtml(skillMatch[2])}</li>`;
            } else {
              secHtml += `\n    <li>${escapeHtml(b)}</li>`;
            }
            textLines.push(`• ${b}`);
          }
          secHtml += `\n  </ul>`;
          currentBullets = [];
          lastBulletY = null;
        }
      };

      for (const l of sec.lines) {
        const lineText = l.rawText.trim();
        if (!lineText) continue;

        const isBulletStart = bulletRegex.test(lineText);
        if (isBulletStart) {
          const cleanB = lineText.replace(bulletRegex, '').trim();
          if (cleanB) {
            currentBullets.push(cleanB);
            lastBulletY = l.y;
          }
          continue;
        }

        // Multi-line bullet continuation check: if we are inside a bullet list and the line is not
        // a section header, split entry header, bold title, or separated by a large vertical gap,
        // it is a continuation of the previous bullet point wrapped onto a new line in the PDF.
        const isSplitHeader = l.segments.length >= 2;
        const isNewJobTitle = (l.isBold && l.fontSize >= layout.fontScale.bodyFontSize + 0.5) || 
                              (l.isBold && lineText.length < 50 && !/^[a-z,;.]/.test(lineText));
        const isLargeVerticalGap = lastBulletY !== null && Math.abs(lastBulletY - l.y) > (l.fontSize || 10) * 2.2;

        if (currentBullets.length > 0 && !isSplitHeader && !isNewJobTitle && !isLargeVerticalGap) {
          currentBullets[currentBullets.length - 1] += ' ' + lineText;
          lastBulletY = l.y;
          continue;
        }

        flushBullets();

        // Check if split entry header (left: title/company, right: dates/location)
        if (l.segments.length >= 2) {
          const titlePart = l.segments[0].text;
          const metaPart = l.segments.slice(1).map(s => s.text).join(' | ');
          const titleIsBold = l.segments[0].isBold || l.isBold;
          const titleIsItalic = l.segments[0].isItalic || (!titleIsBold && l.isItalic);
          const titleWeightClass = titleIsBold ? 'font-bold' : titleIsItalic ? 'italic' : 'font-semibold';

          secHtml += `\n  <div class="doc-entry-header flex justify-between items-baseline gap-2 mt-2 mb-0.5">
    <span class="doc-job-title ${titleWeightClass} text-xs text-zinc-950 dark:text-zinc-50">${escapeHtml(titlePart)}</span>
    <span class="doc-job-meta text-xs text-zinc-800 dark:text-zinc-200 whitespace-nowrap text-right font-medium">${escapeHtml(metaPart)}</span>
  </div>`;
          textLines.push(`${titlePart}   |   ${metaPart}`);
        } else if (l.isItalic) {
          secHtml += `\n  <p class="doc-job-subtitle text-xs text-zinc-800 dark:text-zinc-200 italic my-0.5">${escapeHtml(lineText)}</p>`;
          textLines.push(lineText);
        } else if (l.isBold || (l.fontSize > layout.fontScale.bodyFontSize && lineText.length < 80)) {
          secHtml += `\n  <p class="doc-job-title font-bold text-xs text-zinc-950 dark:text-zinc-50 mt-2 mb-0.5">${escapeHtml(lineText)}</p>`;
          textLines.push(lineText);
        } else if (/\b(19\d{2}|20\d{2}|Present)\b/i.test(lineText) && lineText.length < 60) {
          secHtml += `\n  <p class="doc-job-meta text-xs text-zinc-800 dark:text-zinc-200 text-right font-medium mb-1">${escapeHtml(lineText)}</p>`;
          textLines.push(lineText);
        } else {
          const categoryMatch = lineText.match(/^([A-Za-z0-9\s&/-]+):(\s+.+)$/);
          if (categoryMatch && /skills|interests|technologies|languages/i.test(sec.header)) {
            secHtml += `\n  <p class="doc-text text-xs text-zinc-800 dark:text-zinc-200 my-0.5 leading-relaxed"><strong>${escapeHtml(categoryMatch[1])}:</strong>${escapeHtml(categoryMatch[2])}</p>`;
          } else {
            secHtml += `\n  <p class="doc-text text-xs text-zinc-800 dark:text-zinc-200 my-1 leading-relaxed">${escapeHtml(lineText)}</p>`;
          }
          textLines.push(lineText);
        }
      }

      flushBullets();
      secHtml += `\n</div>`;
      htmlParts.push(secHtml);
      textLines.push('');
    }

    return {
      html: htmlParts.join('\n'),
      text: textLines.join('\n'),
    };
  };

  // Multi-column layout:
  if (layout.columnCount === 2 && layout.columnBoundaryX) {
    const splitX = layout.columnBoundaryX;
    const col1Items = bodyItems.filter(it => it.x < splitX);
    const col2Items = bodyItems.filter(it => it.x >= splitX);

    const col1Lines = clusterItemsIntoVisualLines(col1Items);
    const col2Lines = clusterItemsIntoVisualLines(col2Items);

    const col1Formatted = formatLinesToHtmlSections(col1Lines);
    const col2Formatted = formatLinesToHtmlSections(col2Lines);

    // Determine column widths based on splitX boundary ratio
    const splitRatio = splitX / pageWidth;
    let col1Span = 'col-span-4';
    let col2Span = 'col-span-8';
    let isRightSidebar = false;

    if (splitRatio > 0.58) {
      // Main content on left (col1), sidebar on right (col2)
      col1Span = 'col-span-8';
      col2Span = 'col-span-4';
      isRightSidebar = true;
    } else if (splitRatio >= 0.42 && splitRatio <= 0.58) {
      col1Span = 'col-span-6';
      col2Span = 'col-span-6';
    }

    const twoColumnHtml = isRightSidebar
      ? `
      <div class="doc-two-column-layout grid grid-cols-12 gap-5 mt-2">
        <main class="doc-main-column ${col1Span} space-y-4">
          ${col1Formatted.html}
        </main>
        <aside class="doc-right-sidebar ${col2Span} border-l border-zinc-200 dark:border-zinc-800 pl-4 space-y-4">
          ${col2Formatted.html}
        </aside>
      </div>
    `.trim()
      : `
      <div class="doc-two-column-layout grid grid-cols-12 gap-5 mt-2">
        <aside class="doc-left-column ${col1Span} border-r border-zinc-200 dark:border-zinc-800 pr-4 space-y-4">
          ${col1Formatted.html}
        </aside>
        <main class="doc-right-column ${col2Span} space-y-4">
          ${col2Formatted.html}
        </main>
      </div>
    `.trim();

    // For ATS reading order, prioritize the column containing experience/projects
    const isCol2Main = !isRightSidebar && /experience|work history|employment|projects/i.test(col2Formatted.text);
    const primaryText = isCol2Main ? col2Formatted.text : col1Formatted.text;
    const secondaryText = isCol2Main ? col1Formatted.text : col2Formatted.text;

    const fullHtml = headerHtml ? `${headerHtml}\n${twoColumnHtml}` : twoColumnHtml;
    const fullText = [
      candidateName,
      contactText,
      '',
      primaryText,
      '',
      secondaryText,
    ].filter(Boolean).join('\n').trim();

    return {
      html: fullHtml,
      text: fullText,
      layout,
    };
  }

  // Single-column layout:
  const bodyLines = clusterItemsIntoVisualLines(bodyItems);
  const bodyFormatted = formatLinesToHtmlSections(bodyLines);
  const fullHtml = headerHtml ? `${headerHtml}\n${bodyFormatted.html}`.trim() : bodyFormatted.html.trim();
  const fullText = [candidateName, contactText, '', bodyFormatted.text].filter(Boolean).join('\n').trim();

  return {
    html: fullHtml,
    text: fullText,
    layout,
  };
}

/**
 * Formats PDF text items taking column boundaries into account.
 * When a 2-column layout is present, items in Column 1 (sidebar) and Column 2 (main content)
 * are extracted in distinct coherent sections rather than interleaved line-by-line.
 */
export function formatLayoutAwarePdfItems(
  rawItems: RawPdfItem[],
  pageWidth = 612,
  pageHeight = 792,
  pageNumber = 1
): {
  text: string;
  layout: ExtractedPdfLayout;
  html?: string;
} {
  const result = buildHighFidelityPdfHtml(rawItems, pageWidth, pageHeight, pageNumber);
  return {
    text: result.text,
    layout: result.layout,
    html: result.html,
  };
}
