import {
  DocumentLayoutInfo,
  StructuralParagraph,
  StructuralRunStyle,
  LayoutAuditReport,
  LayoutIssue,
  VisualLayoutReport,
} from '../types/index.js';
import {
  PROVISIONAL_RESUME_LAYOUT_SPEC,
  RESUME_LAYOUT_SPEC,
} from './resume-layout-spec.js';
import { compressAndPreserveLayout } from './llm-tailor.js';

export class LayoutAnalyzerService {
  /**
   * Performs an authoritative, deterministic structural layout audit of the Google Doc
   * grounded in the Canonical Resume Layout Specification.
   */
  public analyze(
    layoutInfo?: DocumentLayoutInfo,
    paragraphs: StructuralParagraph[] = []
  ): LayoutAuditReport {
    const issues: LayoutIssue[] = [];
    const spec = RESUME_LAYOUT_SPEC;

    const hasTables = Boolean(layoutInfo?.hasTables && layoutInfo.tableCount > 0);
    const tableCount = layoutInfo?.tableCount || 0;
    const columnCount = layoutInfo?.sectionStyle?.columnCount || 1;
    const hasMultiColumn = columnCount > 1;

    // ── 1. Table Layout Risk Audit ───────────────────────────────────────────
    if (hasTables) {
      issues.push({
        id: 'layout-table-risk',
        category: 'table_risk',
        severity: 'warning',
        title: `Table-Based Layout (${tableCount} table${tableCount > 1 ? 's' : ''} found)`,
        description:
          'ATS parsers read tables left-to-right across rows rather than following semantic sections. Embedded tables can split job titles, dates, or contact info.',
        impact: 'High risk of text scrambled across columns in older ATS parsers.',
        fixTier: 'safe_styling',
        status: 'pending',
      });
    }

    // ── 2. Multi-Column Layout Risk Audit ────────────────────────────────────
    if (hasMultiColumn) {
      issues.push({
        id: 'layout-multicolumn-risk',
        category: 'multicolumn_risk',
        severity: 'critical',
        title: `Multi-Column Layout (${columnCount} columns)`,
        description:
          'Multi-column section styles confuse ATS scanning order and can merge text from adjacent columns into garbled sentences.',
        impact: 'Severe ATS parse degradation.',
        fixTier: 'safe_styling',
        status: 'pending',
      });
    }

    // ── 3. Page Margin Extremes & Asymmetry Audit ─────────────────────────────
    if (layoutInfo?.sectionStyle) {
      const { marginTop, marginBottom, marginLeft, marginRight } = layoutInfo.sectionStyle;
      const minPt = spec.margins.minPt;
      const maxPt = spec.margins.maxPt;
      const optimalPt = spec.margins.optimalPt;

      const hasTightMargins = (marginLeft !== undefined && marginLeft < minPt) || (marginRight !== undefined && marginRight < minPt);
      const hasWideMargins = (marginLeft !== undefined && marginLeft > maxPt) || (marginRight !== undefined && marginRight > maxPt);
      const isAsymmetric = marginLeft !== undefined && marginRight !== undefined && Math.abs(marginLeft - marginRight) > spec.margins.maxAsymmetryPt;

      if (hasTightMargins) {
        issues.push({
          id: 'layout-margin-tight',
          category: 'margin_extremes',
          severity: 'warning',
          title: 'Margins Too Narrow (<0.5")',
          description: `Page margins are formatted below the 0.5" (${minPt}pt) safety threshold. Content risks being clipped on physical printers and PDF parsers.`,
          impact: 'Printer and PDF boundary clipping risk.',
          fixTier: 'safe_styling',
          suggestedFix: {
            actionLabel: 'Standardize Margins to 0.5"',
            batchUpdateRequests: [
              {
                updateDocumentStyle: {
                  documentStyle: {
                    marginTop: { magnitude: optimalPt, unit: 'PT' },
                    marginBottom: { magnitude: optimalPt, unit: 'PT' },
                    marginLeft: { magnitude: optimalPt, unit: 'PT' },
                    marginRight: { magnitude: optimalPt, unit: 'PT' },
                  },
                  fields: 'marginTop,marginBottom,marginLeft,marginRight',
                },
              },
            ],
          },
          status: 'pending',
        });
      } else if (hasWideMargins || isAsymmetric) {
        issues.push({
          id: 'layout-margin-wide',
          category: 'margin_extremes',
          severity: 'info',
          title: hasWideMargins ? 'Excessive Margins (>0.75")' : 'Asymmetric Margins',
          description: `Page margins (${Math.round((marginLeft || 72) / 72 * 100) / 100}" left/right) waste valuable printable space. Standard 0.5" margins increase usable page area by 15-20%.`,
          impact: 'Reclaims vertical space to keep resume on 1 compact page.',
          fixTier: 'safe_styling',
          suggestedFix: {
            actionLabel: 'Set Margins to Modern 0.5"',
            batchUpdateRequests: [
              {
                updateDocumentStyle: {
                  documentStyle: {
                    marginTop: { magnitude: optimalPt, unit: 'PT' },
                    marginBottom: { magnitude: optimalPt, unit: 'PT' },
                    marginLeft: { magnitude: optimalPt, unit: 'PT' },
                    marginRight: { magnitude: optimalPt, unit: 'PT' },
                  },
                  fields: 'marginTop,marginBottom,marginLeft,marginRight',
                },
              },
            ],
          },
          status: 'pending',
        });
      }
    }

    // ── 4. Manual Tab & Space-Based Alignment Audit ───────────────────────────
    const spaceAlignedParas = paragraphs.filter((p) => /(?:[^\s][ ]{3,}[^\s]|\t+)/.test(p.rawText));
    for (const p of spaceAlignedParas) {
      const cleaned = p.rawText.replace(/[ ]{3,}|\t+/g, ' — ');
      issues.push({
        id: `layout-space-align-${p.startIndex}`,
        category: 'manual_tab_alignment',
        severity: 'warning',
        title: 'Manual Tab/Space Alignment',
        description: `Line "${p.trimmedText.slice(0, 45)}…" uses repeated spaces or tabs to push dates/locations to the right margin.`,
        impact: 'Fragile visual layout that breaks on narrow viewports/PDF conversions; ATS may ingest unwanted whitespace.',
        affectedStartIndex: p.textStartIndex,
        affectedEndIndex: p.textEndIndex,
        affectedText: p.trimmedText,
        fixTier: 'safe_styling',
        suggestedFix: {
          actionLabel: 'Replace with standard separator ( — )',
          batchUpdateRequests: [
            {
              deleteContentRange: {
                range: {
                  startIndex: p.textStartIndex,
                  endIndex: p.textEndIndex,
                },
              },
            },
            {
              insertText: {
                location: { index: p.textStartIndex },
                text: cleaned.endsWith('\n') ? cleaned.slice(0, -1) : cleaned,
              },
            },
          ],
        },
        status: 'pending',
      });
    }

    // ── 5. Font Family & Dominant Size Calculations ───────────────────────────
    const fontFreq: Record<string, number> = {};
    const runsWithFont: Array<{ para: StructuralParagraph; fontFamily: string; startIndex: number; endIndex: number }> = [];

    for (const p of paragraphs) {
      if (p.runs) {
        for (const r of p.runs) {
          if (r.fontFamily && r.content.trim().length > 1) {
            const font = r.fontFamily.trim();
            fontFreq[font] = (fontFreq[font] || 0) + r.content.length;
            runsWithFont.push({
              para: p,
              fontFamily: font,
              startIndex: r.startIndex,
              endIndex: r.endIndex,
            });
          }
        }
      }
    }

    let dominantFont = 'Arial';
    let maxFontCount = 0;
    for (const [font, count] of Object.entries(fontFreq)) {
      if (count > maxFontCount) {
        maxFontCount = count;
        dominantFont = font;
      }
    }

    let fontConsistencyScore = 100;
    if (dominantFont) {
      const outlierRuns = runsWithFont.filter((r) => r.fontFamily !== dominantFont);
      if (outlierRuns.length > 0) {
        fontConsistencyScore = Math.max(50, Math.round(100 - outlierRuns.length * 15));
        const seenParas = new Set<number>();
        for (const out of outlierRuns) {
          if (seenParas.has(out.para.startIndex)) continue;
          seenParas.add(out.para.startIndex);

          issues.push({
            id: `layout-font-drift-${out.para.startIndex}`,
            category: 'font_inconsistency',
            severity: 'info',
            title: `Inconsistent Font (${out.fontFamily} vs ${dominantFont})`,
            description: `Paragraph "${out.para.trimmedText.slice(0, 40)}…" uses font "${out.fontFamily}", while majority of document uses "${dominantFont}".`,
            impact: 'Visual polish and uniform professional document styling.',
            affectedStartIndex: out.para.startIndex,
            affectedEndIndex: out.para.endIndex,
            affectedText: out.para.trimmedText,
            fixTier: 'safe_styling',
            suggestedFix: {
              actionLabel: `Apply ${dominantFont} to paragraph`,
              batchUpdateRequests: [
                {
                  updateTextStyle: {
                    range: { startIndex: out.para.startIndex, endIndex: out.para.endIndex },
                    textStyle: { weightedFontFamily: { fontFamily: dominantFont } },
                    fields: 'weightedFontFamily',
                  },
                },
              ],
            },
            status: 'pending',
          });
        }
      }
    }

    // ── 6. Typography Scale & Inverted Hierarchy Audit ────────────────────────
    const bulletParas = paragraphs.filter((p) => p.hasNativeBullet || p.hasVisualBullet);
    const headingParas = paragraphs.filter(
      (p) =>
        p.paragraphStyle?.namedStyleType?.startsWith('HEADING') ||
        (p.trimmedText.length >= 3 && p.trimmedText.length <= 35 && /^[A-Z\s]{3,}$/.test(p.trimmedText))
    );

    let dominantBodySize: number = spec.typography.bodyFontPt.optimal;
    const bodySizes: number[] = [];
    for (const bp of bulletParas) {
      const r = bp.runs?.find((run) => run.fontSize && run.content.trim().length > 2);
      if (r?.fontSize) bodySizes.push(Math.round(r.fontSize * 10) / 10);
    }
    if (bodySizes.length > 0) {
      dominantBodySize = bodySizes.sort((a, b) =>
        bodySizes.filter((v) => v === a).length - bodySizes.filter((v) => v === b).length
      ).pop() || spec.typography.bodyFontPt.optimal;
    }

    for (const hp of headingParas) {
      const headRun = hp.runs?.find((r) => r.fontSize);
      const headSize = headRun?.fontSize ? Math.round(headRun.fontSize * 10) / 10 : 12;

      if (headSize <= dominantBodySize) {
        issues.push({
          id: `layout-type-inverted-${hp.startIndex}`,
          category: 'typography_hierarchy',
          severity: 'warning',
          sectionName: hp.trimmedText,
          title: `Inverted / Weak Heading Hierarchy ("${hp.trimmedText}")`,
          description: `Section heading "${hp.trimmedText}" (${headSize}pt) is not sufficiently distinct from body bullets (${dominantBodySize}pt). Headings should be at least ${spec.typography.headingFontPt.optimal}pt bold.`,
          impact: 'Recruiters cannot quickly locate sections during the 6-second scan.',
          affectedStartIndex: hp.startIndex,
          affectedEndIndex: hp.endIndex,
          affectedText: hp.trimmedText,
          fixTier: 'safe_styling',
          suggestedFix: {
            actionLabel: `Set Heading to ${spec.typography.headingFontPt.optimal}pt Bold`,
            batchUpdateRequests: [
              {
                updateTextStyle: {
                  range: { startIndex: hp.startIndex, endIndex: hp.endIndex },
                  textStyle: {
                    fontSize: { magnitude: spec.typography.headingFontPt.optimal, unit: 'PT' },
                    bold: true,
                  },
                  fields: 'fontSize,bold',
                },
              },
            ],
          },
          status: 'pending',
        });
      }
    }

    // ── 7. Widow / Orphan Line Audit (Tier 2: Content-Generating Fix) ─────────
    for (const bp of bulletParas) {
      const charLen = bp.trimmedText.length;
      const charsPerLine = spec.spacing.charsPerLine;
      const lines = Math.max(1, Math.ceil(charLen / charsPerLine));

      if (lines >= 2) {
        const lastLineChars = charLen % charsPerLine || charsPerLine;
        if (lastLineChars <= spec.spacing.widowThresholdChars && lastLineChars > 0) {
          const words = bp.trimmedText.split(/\s+/);
          const trailingWords = words.slice(-3).join(' ');
          const targetMaxChars = charLen - (lastLineChars + 2);
          const proposedText = compressAndPreserveLayout(bp.trimmedText, targetMaxChars);

          issues.push({
            id: `layout-widow-${bp.startIndex}`,
            category: 'widow_line',
            severity: 'info',
            title: `Widow Line on Bullet (${lastLineChars} chars on last line)`,
            description: `Bullet spills onto line ${lines} with only "${trailingWords}", wasting an entire vertical line. Trimming ${lastLineChars + 4} characters pulls it cleanly onto ${lines - 1} line${lines > 2 ? 's' : ''}.`,
            impact: 'Recovers 1 full vertical line in your Google Doc.',
            affectedStartIndex: bp.startIndex,
            affectedEndIndex: bp.endIndex,
            affectedText: bp.trimmedText,
            fixTier: 'content_generating',
            proposedReplacementText: proposedText,
            suggestedFix: {
              actionLabel: 'Apply Anti-Hallucination Compression',
              batchUpdateRequests: [
                {
                  deleteContentRange: {
                    range: {
                      startIndex: bp.textStartIndex,
                      endIndex: bp.textEndIndex,
                    },
                  },
                },
                {
                  insertText: {
                    location: { index: bp.textStartIndex },
                    text: proposedText.replace(/^[•\-*–—▪▸▹‣◦○]\s+/, ''),
                  },
                },
              ],
            },
            status: 'pending',
          });
        }
      }
    }

    // ── 8. Bold Emphasis Density Audit ────────────────────────────────────────
    let totalDocWords = 0;
    let boldDocWords = 0;
    for (const p of paragraphs) {
      if (p.runs) {
        for (const r of p.runs) {
          const words = r.content.trim().split(/\s+/).filter(Boolean).length;
          totalDocWords += words;
          if (r.bold) boldDocWords += words;
        }
      }
    }

    if (totalDocWords >= 20) {
      const boldRatio = Math.round((boldDocWords / totalDocWords) * 100) / 100;
      if (boldRatio > spec.emphasis.maxBoldWordRatio) {
        issues.push({
          id: 'layout-bold-overuse',
          category: 'bold_density',
          severity: 'warning',
          title: `Excessive Bold Emphasis (${Math.round(boldRatio * 100)}% of words)`,
          description: `Over ${Math.round(boldRatio * 100)}% of words are bolded (recommended: ${Math.round(spec.emphasis.minBoldWordRatio * 100)}-${Math.round(spec.emphasis.maxBoldWordRatio * 100)}%). Bolding everything creates visual noise and eliminates anchor points.`,
          impact: 'Degrades recruiter scanning speed and makes resume look cluttered.',
          fixTier: 'safe_styling',
          status: 'pending',
        });
      }
    }

    // ── 9. Contextual Section Volume Bloat Audit (Advisory Only) ──────────────
    if (bulletParas.length >= 7) {
      const consecutiveBullets = bulletParas.length;
      if (consecutiveBullets > 8) {
        issues.push({
          id: 'layout-section-volume-bloat',
          category: 'section_volume_bloat',
          severity: 'info',
          title: 'High Bullet Density (>8 bullets in section)',
          description: 'Consider grouping large bullet lists into sub-projects or focusing on the top 4-5 highest-impact achievements to improve scannability.',
          impact: 'Improves reader retention and scannability.',
          fixTier: 'safe_styling',
          status: 'pending',
        });
      }
    }

    // ── 10. Overall Scoring & Summary ─────────────────────────────────────────
    let score = 100;
    if (hasTables) score -= 20;
    if (hasMultiColumn) score -= 25;
    if (spaceAlignedParas.length > 0) score -= Math.min(15, spaceAlignedParas.length * 5);
    if (fontConsistencyScore < 100) score -= Math.round((100 - fontConsistencyScore) * 0.2);
    if (issues.some((i) => i.category === 'margin_extremes')) score -= 5;
    if (issues.some((i) => i.category === 'typography_hierarchy')) score -= 8;
    if (issues.some((i) => i.category === 'bold_density' && i.severity === 'warning')) score -= 6;
    if (issues.some((i) => i.category === 'widow_line')) score -= Math.min(6, issues.filter((i) => i.category === 'widow_line').length * 2);

    const overallScore = Math.min(100, Math.max(20, score));
    const isSingleColumnStandard = !hasTables && !hasMultiColumn;

    const summary = isSingleColumnStandard
      ? issues.length === 0
        ? 'Gold-standard single-column layout conforming to canonical typography and margin specifications.'
        : `Standard single-column flow with ${issues.length} layout optimization recommendation${issues.length > 1 ? 's' : ''}.`
      : hasTables
      ? `Table layout detected (${tableCount} table${tableCount > 1 ? 's' : ''}) — potential ATS parsing risk.`
      : `Multi-column layout detected (${columnCount} columns) — potential ATS parsing risk.`;

    return {
      overallScore,
      isSingleColumnStandard,
      hasTables,
      tableCount,
      hasMultiColumn,
      columnCount,
      fontConsistencyScore,
      spacingConsistencyScore: 100,
      issues,
      summary,
    };
  }

  /**
   * Merges visual snapshot report with the structural layout report.
   */
  public mergeVisualReport(
    structuralReport: LayoutAuditReport,
    visualReport: VisualLayoutReport
  ): LayoutAuditReport {
    const combinedIssues: LayoutIssue[] = [...structuralReport.issues];

    for (const vIssue of visualReport.issues) {
      if (!combinedIssues.some((ci) => ci.id === vIssue.id || ci.title === vIssue.title)) {
        combinedIssues.push({
          id: vIssue.id,
          category: vIssue.category,
          severity: vIssue.severity,
          title: vIssue.title,
          description: vIssue.description,
          impact: vIssue.impact,
          sectionName: vIssue.sectionName,
          visualObservation: vIssue.visualObservation,
          affectedStartIndex: vIssue.matchedParagraphStartIndex,
          affectedEndIndex: vIssue.matchedParagraphEndIndex,
          fixTier: 'safe_styling',
          suggestedFix: vIssue.suggestedFix,
          status: vIssue.status,
        });
      }
    }

    const blendedScore = Math.round(
      structuralReport.overallScore * 0.6 + visualReport.visualPolishScore * 0.4
    );

    return {
      ...structuralReport,
      overallScore: blendedScore,
      visualPolishScore: visualReport.visualPolishScore,
      visualReport,
      issues: combinedIssues,
      summary: `${structuralReport.summary} Visual Polish: ${visualReport.visualPolishScore}%. ${visualReport.pageFillDescription}`,
    };
  }
}
