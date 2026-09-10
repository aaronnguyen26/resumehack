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

  // 7. Margins
  const minX = Math.min(...items.map(it => it.x));
  const maxX = Math.max(...items.map(it => it.x + (it.width || 20)));
  const minY = Math.min(...items.map(it => it.y));
  const maxY = Math.max(...items.map(it => it.y));

  return {
    columnCount: colInfo.columnCount,
    columnBoundaryX: colInfo.columnBoundaryX,
    headerAlignment,
    hasSplitRows,
    detectedPreset,
    sectionDivider,
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
} {
  const items = normalizePdfItems(rawItems);
  const layout = detectPdfLayout(rawItems, pageWidth);

  if (items.length === 0) {
    return { text: '', layout };
  }

  // Format helper for a list of items belonging to one logical column
  const formatColumnItems = (colItems: PositionedTextItem[]): string[] => {
    // Sort primarily top-to-bottom (Y descending), then left-to-right (X ascending)
    colItems.sort((a, b) => {
      const yDelta = b.y - a.y;
      if (Math.abs(yDelta) > 3.0) return yDelta;
      return a.x - b.x;
    });

    const lines: string[] = [];
    let currentLine: PositionedTextItem[] = [];
    let currentY: number | null = null;
    let lastLineY: number | null = null;

    const flushLine = (lineItems: PositionedTextItem[]) => {
      if (lineItems.length === 0) return;
      lineItems.sort((a, b) => a.x - b.x);

      let lineStr = '';
      for (let i = 0; i < lineItems.length; i++) {
        const it = lineItems[i];
        if (i === 0) {
          lineStr = it.text;
        } else {
          const prev = lineItems[i - 1];
          const gap = it.x - (prev.x + (prev.width || prev.text.length * 6));
          if (gap > 28) {
            lineStr += '   |   ' + it.text;
          } else {
            lineStr += ' ' + it.text;
          }
        }
      }

      lineStr = lineStr.replace(/\s+/g, ' ').trim();
      if (!lineStr) return;

      const lineHeight = lineItems[0]?.height || 10;
      if (lastLineY !== null && Math.abs(lastLineY - (currentY || 0)) > lineHeight * 1.5) {
        if (lines.length > 0 && lines[lines.length - 1] !== '') {
          lines.push('');
        }
      }

      if (/^[•▪▸▹‣◦○*\-]\s+/.test(lineStr) || /^•\s*/.test(lineStr)) {
        lineStr = '• ' + lineStr.replace(/^[•▪▸▹‣◦○*\-]\s*/, '').trim();
      }

      lines.push(lineStr);
      lastLineY = currentY;
    };

    for (const item of colItems) {
      if (currentY === null || Math.abs(item.y - currentY) <= 3.5) {
        currentLine.push(item);
        currentY = item.y;
      } else {
        flushLine(currentLine);
        currentLine = [item];
        currentY = item.y;
      }
    }

    if (currentLine.length > 0) {
      flushLine(currentLine);
    }

    return lines;
  };

  // If 2-column layout detected: extract Header first, then Main Column, then Sidebar
  if (layout.columnCount === 2 && layout.columnBoundaryX) {
    const splitX = layout.columnBoundaryX;
    const maxY = Math.max(...items.map(it => it.y));

    // Items in top 15% span full width (Header: candidate name + contact)
    const headerItems = items.filter(it => it.y >= maxY - 75);
    const bodyItems = items.filter(it => it.y < maxY - 75);

    const leftCol = bodyItems.filter(it => it.x < splitX);
    const rightCol = bodyItems.filter(it => it.x >= splitX);

    const headerLines = formatColumnItems(headerItems);
    const leftLines = formatColumnItems(leftCol);
    const rightLines = formatColumnItems(rightCol);

    // For ATS readability and document structure:
    // Header -> Main Column (Experience/Projects) -> Sidebar (Skills/Education)
    // Identify which column has more experience keywords to put main first
    const leftText = leftLines.join('\n');
    const rightText = rightLines.join('\n');
    const isLeftMain = /experience|work history|employment|projects/i.test(leftText);

    const orderedLines = [
      ...headerLines,
      '',
      ...(isLeftMain ? rightLines : leftLines), // Sidebar first or main first
      '',
      ...(isLeftMain ? leftLines : rightLines),
    ].filter((line, idx, arr) => !(line === '' && arr[idx - 1] === ''));

    return {
      text: orderedLines.join('\n').trim(),
      layout,
    };
  }

  // Single-column layout: standard ordered extraction
  const singleLines = formatColumnItems(items);
  return {
    text: singleLines.join('\n').trim(),
    layout,
  };
}
