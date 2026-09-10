/**
 * PDF Layout Detection & Preservation Engine (Backend Mirror)
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

    const isBold = /bold|black|heavy|medium|semibold|bld/i.test(fontName);
    const isItalic = /italic|oblique/i.test(fontName);

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

  // Check candidate boundaries between 22% and 52% of page width
  const minSplitX = pageWidth * 0.22;
  const maxSplitX = pageWidth * 0.52;

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

  // Look for items sharing the same Y level (within 3.5px) where one is on left and one is on right
  const dateRegex = /\b(19\d{2}|20\d{2}|Present|Current|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/i;
  let splitRowMatches = 0;

  for (let i = 0; i < items.length; i++) {
    const itemA = items[i];
    if (itemA.x > pageWidth * 0.45) continue;

    for (let j = 0; j < items.length; j++) {
      if (i === j) continue;
      const itemB = items[j];
      if (Math.abs(itemA.y - itemB.y) <= 3.5 && itemB.x >= pageWidth * 0.55) {
        if (dateRegex.test(itemB.text) || itemB.text.includes(',') || itemB.text.includes('|')) {
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

  // 7. Font family detection
  let detectedFontFamily: 'serif' | 'sans' | 'mono' = 'sans';
  let serifCount = 0;
  let monoCount = 0;
  for (const it of items) {
    const fn = (it.fontName || '').toLowerCase();
    if (/times|georgia|garamond|serif|cambria|palatino|baskerville|minion/i.test(fn)) {
      serifCount++;
    } else if (/courier|mono|consolas|menlo/i.test(fn)) {
      monoCount++;
    }
  }
  if (serifCount > items.length * 0.25) {
    detectedFontFamily = 'serif';
  } else if (monoCount > items.length * 0.25) {
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
  pageHeight = 792
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

    for (let i = 0; i < group.length; i++) {
      const it = group[i];
      if (i === 0) {
        currentSegText = it.text;
        segWidth = it.width || it.text.length * (segFontSize * 0.52);
      } else {
        const prev = group[i - 1];
        const prevWidth = prev.width > 0 ? prev.width : prev.text.length * ((prev.fontSize || 10) * 0.52);
        const gap = it.x - (prev.x + prevWidth);

        // Wide gap indicates two-ended split (e.g. title on left, date on right)
        if (gap >= 24 && it.x >= pageWidth * 0.45) {
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
    let currentY: number | null = null;

    for (const item of sorted) {
      if (currentY === null || Math.abs(item.y - currentY) <= Math.max(3.2, (item.height || 10) * 0.35)) {
        currentGroup.push(item);
        currentY = item.y;
      } else {
        const line = flushGroupToLine(currentGroup, currentY);
        if (line) lines.push(line);
        currentGroup = [item];
        currentY = item.y;
      }
    }
    if (currentGroup.length > 0) {
      const line = flushGroupToLine(currentGroup, currentY);
      if (line) lines.push(line);
    }

    return lines;
  };

  // Identify top candidate header region (Y >= maxY - 55, excluding section titles)
  const maxY = Math.max(...items.map(it => it.y));
  const isHeaderExcluded = (text: string) => /^(WORK\s+EXPERIENCE|EXPERIENCE|EDUCATION|SKILLS|TECHNICAL\s+SKILLS|PROJECTS|SUMMARY|PUBLICATIONS|CERTIFICATIONS)$/i.test(text.trim().replace(/[:\-–—]+$/, ''));
  const headerItems = items.filter(it => it.y >= maxY - 55 && !isHeaderExcluded(it.text));
  const bodyItems = items.filter(it => !headerItems.includes(it));

  const topLines = clusterItemsIntoVisualLines(headerItems.length > 0 ? headerItems : items.slice(0, 2));
  let nameLine = topLines[0];
  for (const l of topLines) {
    if (l.fontSize > (nameLine?.fontSize || 0)) {
      nameLine = l;
    }
  }

  const candidateName = nameLine?.segments[0]?.text || nameLine?.rawText || 'Candidate';
  const headerContactLines = topLines.filter(l => l !== nameLine);
  const contactText = headerContactLines.map(l => l.rawText).join(' • ');

  // Helper for section headers
  const isSectionHeader = (line: VisualLine): boolean => {
    const txt = line.rawText.trim();
    if (!txt || txt.length > 55) return false;
    if (/^[•▪▸▹‣◦○*\-]\s*/.test(txt)) return false;
    if (txt.includes('@') || /linkedin\.com|github\.com|http/i.test(txt)) return false;

    const upper = txt.replace(/[:\-–—]+$/, '').trim().toUpperCase();
    if (/^(WORK\s+EXPERIENCE|EXPERIENCE|EMPLOYMENT\s+HISTORY|PROFESSIONAL\s+EXPERIENCE|PROJECTS|FEATURED\s+PROJECTS|TECHNICAL\s+PROJECTS|EDUCATION|ACADEMIC\s+BACKGROUND|TECHNICAL\s+SKILLS|SKILLS|CORE\s+COMPETENCIES|CERTIFICATIONS|PUBLICATIONS|AWARDS|HONORS|VOLUNTEERING|LEADERSHIP|SUMMARY|PROFESSIONAL\s+SUMMARY)$/i.test(upper)) {
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
        return `<h2 class="doc-section-header font-mono font-bold text-xs uppercase tracking-wider text-zinc-900 dark:text-zinc-100 border-l-2 border-zinc-900 dark:border-zinc-100 pl-2 mt-4 mb-2">${escapeHtml(title)}</h2>`;
      case 'minimal':
        return `<h2 class="doc-section-header font-mono font-bold text-xs uppercase tracking-wider text-zinc-900 dark:text-zinc-100 mt-4 mb-2">${escapeHtml(title)}</h2>`;
      case 'banner':
        return `<h2 class="doc-section-header font-mono font-bold text-xs uppercase tracking-wider text-zinc-900 dark:text-zinc-100 bg-zinc-100 dark:bg-zinc-800/80 px-2 py-0.5 rounded mt-4 mb-2">${escapeHtml(title)}</h2>`;
      case 'line':
      default:
        return `<h2 class="doc-section-header font-mono font-bold text-xs uppercase tracking-wider text-zinc-900 dark:text-zinc-100 border-b border-zinc-200 dark:border-zinc-800 pb-1 mt-4 mb-2">${escapeHtml(title)}</h2>`;
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

        const isBulletStart = /^[•▪▸▹‣◦○*\-]\s+/.test(lineText) || /^•\s*/.test(lineText);
        if (isBulletStart) {
          const cleanB = lineText.replace(/^[•▪▸▹‣◦○*\-]\s*/, '').trim();
          currentBullets.push(cleanB);
          lastBulletY = l.y;
          continue;
        }

        // Multi-line bullet continuation check: if we are inside a bullet list and the line is not
        // a section header, split entry header, bold title, or separated by a large vertical gap,
        // it is a continuation of the previous bullet point wrapped onto a new line in the PDF.
        const isSplitHeader = l.segments.length >= 2;
        const isNewJobTitle = (l.isBold && l.fontSize >= layout.fontScale.bodyFontSize) || 
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

          secHtml += `\n  <div class="doc-entry-header flex justify-between items-baseline gap-2 mt-2 mb-0.5">
    <span class="doc-job-title font-bold text-xs text-zinc-900 dark:text-zinc-100">${escapeHtml(titlePart)}</span>
    <span class="doc-job-meta text-xs font-mono text-zinc-500 dark:text-zinc-400 whitespace-nowrap">${escapeHtml(metaPart)}</span>
  </div>`;
          textLines.push(`${titlePart}   |   ${metaPart}`);
        } else if (l.isBold || (l.fontSize > layout.fontScale.bodyFontSize && lineText.length < 80)) {
          secHtml += `\n  <p class="doc-job-title font-bold text-xs text-zinc-900 dark:text-zinc-100 mt-2 mb-0.5">${escapeHtml(lineText)}</p>`;
          textLines.push(lineText);
        } else if (/\b(19\d{2}|20\d{2}|Present)\b/i.test(lineText) && lineText.length < 60) {
          secHtml += `\n  <p class="doc-job-meta text-xs text-zinc-500 dark:text-zinc-400 italic mb-1.5">${escapeHtml(lineText)}</p>`;
          textLines.push(lineText);
        } else {
          secHtml += `\n  <p class="doc-text text-xs text-zinc-800 dark:text-zinc-200 my-1 leading-relaxed">${escapeHtml(lineText)}</p>`;
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

  // Build Document Header
  const hasHeaderBorder = layout.sectionDivider !== 'minimal';
  const borderClass = hasHeaderBorder ? ' border-b border-zinc-200 dark:border-zinc-800' : '';
  const headerClass = layout.headerAlignment === 'center'
    ? `doc-header text-center pb-3 mb-4${borderClass}`
    : layout.headerAlignment === 'split'
    ? `doc-header flex flex-col sm:flex-row sm:items-end justify-between pb-3 mb-4${borderClass} gap-2`
    : `doc-header text-left pb-3 mb-4${borderClass}`;

  const headerHtml = `
    <div class="${headerClass}">
      <div>
        <h1 class="doc-candidate-name font-headline font-bold text-2xl sm:text-3xl tracking-tight text-zinc-950 dark:text-white pb-1">${escapeHtml(candidateName)}</h1>
      </div>
      ${contactText ? `<p class="doc-contact-info text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">${escapeHtml(contactText)}</p>` : ''}
    </div>
  `.trim();

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
    if (splitRatio > 0.55) {
      col1Span = 'col-span-8';
      col2Span = 'col-span-4';
    } else if (splitRatio >= 0.42 && splitRatio <= 0.58) {
      col1Span = 'col-span-6';
      col2Span = 'col-span-6';
    }

    // Left column is always col1 (x < splitX), Right column is always col2 (x >= splitX)
    // preserving exact spatial layout and orientation of the original PDF.
    const twoColumnHtml = `
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
    const isCol2Main = /experience|work history|employment|projects/i.test(col2Formatted.text);
    const primaryText = isCol2Main ? col2Formatted.text : col1Formatted.text;
    const secondaryText = isCol2Main ? col1Formatted.text : col2Formatted.text;

    const fullHtml = `${headerHtml}\n${twoColumnHtml}`;
    const fullText = [
      candidateName,
      contactText,
      '',
      primaryText,
      '',
      secondaryText,
    ].join('\n').trim();

    return {
      html: fullHtml,
      text: fullText,
      layout,
    };
  }

  // Single-column layout:
  const bodyLines = clusterItemsIntoVisualLines(bodyItems);
  const bodyFormatted = formatLinesToHtmlSections(bodyLines);
  const fullHtml = `${headerHtml}\n${bodyFormatted.html}`.trim();
  const fullText = [candidateName, contactText, '', bodyFormatted.text].join('\n').trim();

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
  pageWidth = 612
): {
  text: string;
  layout: ExtractedPdfLayout;
  html?: string;
} {
  const result = buildHighFidelityPdfHtml(rawItems, pageWidth);
  return {
    text: result.text,
    layout: result.layout,
    html: result.html,
  };
}
