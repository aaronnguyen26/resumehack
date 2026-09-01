import {
  DocumentLayoutInfo,
  StructuralParagraph,
  StructuralRunStyle,
  LayoutAuditReport,
  LayoutIssue,
  VisualLayoutReport,
} from '../types/index.js';

export class LayoutAnalyzerService {
  /**
   * Performs an authoritative structural layout audit of the Google Doc.
   */
  public analyze(
    layoutInfo?: DocumentLayoutInfo,
    paragraphs: StructuralParagraph[] = []
  ): LayoutAuditReport {
    const issues: LayoutIssue[] = [];

    const hasTables = Boolean(layoutInfo?.hasTables && layoutInfo.tableCount > 0);
    const tableCount = layoutInfo?.tableCount || 0;
    const columnCount = layoutInfo?.sectionStyle?.columnCount || 1;
    const hasMultiColumn = columnCount > 1;

    // 1. Table Layout Risk Audit
    if (hasTables) {
      issues.push({
        id: 'layout-table-risk',
        category: 'table_risk',
        severity: 'warning',
        title: `Table-Based Layout (${tableCount} table${tableCount > 1 ? 's' : ''} found)`,
        description:
          'ATS parsers read tables left-to-right across rows rather than following semantic sections. Embedded tables can split job titles, dates, or contact info.',
        impact: 'High risk of text scrambled across columns in older ATS parsers.',
        status: 'pending',
      });
    }

    // 2. Multi-Column Layout Risk Audit
    if (hasMultiColumn) {
      issues.push({
        id: 'layout-multicolumn-risk',
        category: 'multicolumn_risk',
        severity: 'critical',
        title: `Multi-Column Layout (${columnCount} columns)`,
        description:
          'Multi-column section styles confuse ATS scanning order and can merge text from adjacent columns into garbled sentences.',
        impact: 'Severe ATS parse degradation.',
        status: 'pending',
      });
    }

    // 3. Manual Tab & Consecutive Space-Based Alignment Audit
    const spaceAlignedParas = paragraphs.filter((p) => {
      // Look for 3+ spaces or literal tabs separating words (e.g. "Software Engineer    June 2022 - Present")
      return /(?:[^\s][ ]{3,}[^\s]|\t+)/.test(p.rawText);
    });

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
                location: {
                  index: p.textStartIndex,
                },
                text: cleaned.endsWith('\n') ? cleaned.slice(0, -1) : cleaned,
              },
            },
          ],
        },
        status: 'pending',
      });
    }

    // 4. Font Family Consistency Audit
    const fontFreq: Record<string, number> = {};
    const runsWithFont: Array<{
      para: StructuralParagraph;
      fontFamily: string;
      startIndex: number;
      endIndex: number;
    }> = [];

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

    // Find dominant font family
    let dominantFont = '';
    let maxCount = 0;
    for (const [font, count] of Object.entries(fontFreq)) {
      if (count > maxCount) {
        maxCount = count;
        dominantFont = font;
      }
    }

    let fontConsistencyScore = 100;
    if (dominantFont) {
      const outlierRuns = runsWithFont.filter((r) => r.fontFamily !== dominantFont);
      if (outlierRuns.length > 0) {
        fontConsistencyScore = Math.max(50, Math.round(100 - outlierRuns.length * 15));

        // Group outliers by paragraph
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
            suggestedFix: {
              actionLabel: `Apply ${dominantFont} to paragraph`,
              batchUpdateRequests: [
                {
                  updateTextStyle: {
                    range: {
                      startIndex: out.para.startIndex,
                      endIndex: out.para.endIndex,
                    },
                    textStyle: {
                      weightedFontFamily: {
                        fontFamily: dominantFont,
                      },
                    },
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

    // 5. Body Bullet Font Size Drift Audit
    const bulletParas = paragraphs.filter((p) => p.hasNativeBullet || p.hasVisualBullet);
    const bulletSizeFreq: Record<number, number> = {};
    for (const bp of bulletParas) {
      if (bp.runs) {
        for (const r of bp.runs) {
          if (r.fontSize && r.content.trim().length > 1) {
            const size = Math.round(r.fontSize * 10) / 10;
            bulletSizeFreq[size] = (bulletSizeFreq[size] || 0) + 1;
          }
        }
      }
    }

    let dominantBulletSize = 0;
    let maxBulletSizeCount = 0;
    for (const [sizeStr, count] of Object.entries(bulletSizeFreq)) {
      const size = parseFloat(sizeStr);
      if (count > maxBulletSizeCount) {
        maxBulletSizeCount = count;
        dominantBulletSize = size;
      }
    }

    if (dominantBulletSize > 0 && bulletParas.length >= 3) {
      for (const bp of bulletParas) {
        const primaryRun = bp.runs?.find((r: StructuralRunStyle) => r.fontSize && r.content.trim().length > 2);
        if (primaryRun && primaryRun.fontSize) {
          const runSize = Math.round(primaryRun.fontSize * 10) / 10;
          if (Math.abs(runSize - dominantBulletSize) >= 1.0) {
            issues.push({
              id: `layout-size-drift-${bp.startIndex}`,
              category: 'font_inconsistency',
              severity: 'info',
              title: `Inconsistent Bullet Font Size (${runSize}pt vs ${dominantBulletSize}pt)`,
              description: `Bullet "${bp.trimmedText.slice(0, 40)}…" is formatted at ${runSize}pt instead of standard ${dominantBulletSize}pt.`,
              impact: 'Visual hierarchy and uniform sizing.',
              affectedStartIndex: bp.startIndex,
              affectedEndIndex: bp.endIndex,
              affectedText: bp.trimmedText,
              suggestedFix: {
                actionLabel: `Set font size to ${dominantBulletSize}pt`,
                batchUpdateRequests: [
                  {
                    updateTextStyle: {
                      range: {
                        startIndex: bp.startIndex,
                        endIndex: bp.endIndex,
                      },
                      textStyle: {
                        fontSize: {
                          magnitude: dominantBulletSize,
                          unit: 'PT',
                        },
                      },
                      fields: 'fontSize',
                    },
                  },
                ],
              },
              status: 'pending',
            });
          }
        }
      }
    }

    // 6. Bullet Glyph & Indent Inconsistency
    const nativeBullets = bulletParas.filter((p) => p.hasNativeBullet).length;
    const visualBullets = bulletParas.filter((p) => !p.hasNativeBullet && p.hasVisualBullet).length;
    if (nativeBullets > 0 && visualBullets > 0) {
      issues.push({
        id: 'layout-mixed-bullets',
        category: 'bullet_inconsistency',
        severity: 'warning',
        title: 'Mixed List Formatting',
        description: `Document mixes native Google Docs lists (${nativeBullets} items) with typed visual glyphs (${visualBullets} items).`,
        impact: 'Inconsistent list indentation and spacing.',
        status: 'pending',
      });
    }

    // 7. Spacing Consistency Audit
    let spacingConsistencyScore = 100;
    const parasWithSpaceAfter = paragraphs.filter(
      (p) => p.paragraphStyle?.spaceAfter !== undefined && p.paragraphStyle.spaceAfter > 0
    );
    if (parasWithSpaceAfter.length > 0 && parasWithSpaceAfter.length < paragraphs.length * 0.4) {
      spacingConsistencyScore = 85;
      issues.push({
        id: 'layout-spacing-drift',
        category: 'spacing_drift',
        severity: 'info',
        title: 'Paragraph Spacing Drift',
        description: 'Some paragraphs have custom space-after padding while others rely on empty carriage returns.',
        impact: 'Uneven vertical rhythm between sections.',
        status: 'pending',
      });
    }

    // Calculate Overall Layout / Formatting Score (0 - 100)
    let score = 100;
    if (hasTables) score -= 20;
    if (hasMultiColumn) score -= 25;
    if (spaceAlignedParas.length > 0) score -= Math.min(15, spaceAlignedParas.length * 5);
    if (fontConsistencyScore < 100) score -= Math.round((100 - fontConsistencyScore) * 0.2);
    if (nativeBullets > 0 && visualBullets > 0) score -= 10;
    if (spacingConsistencyScore < 100) score -= 5;

    const overallScore = Math.min(100, Math.max(20, score));

    const isSingleColumnStandard = !hasTables && !hasMultiColumn;

    const summary = isSingleColumnStandard
      ? issues.length === 0
        ? 'Standard single-column flow with clean typography and consistent formatting.'
        : `Standard single-column flow with ${issues.length} minor formatting recommendation${issues.length > 1 ? 's' : ''}.`
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
      spacingConsistencyScore,
      issues,
      summary,
    };
  }

  /**
   * Merges a visual snapshot report into the structural layout report.
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
          suggestedFix: vIssue.suggestedFix,
          status: vIssue.status,
        });
      }
    }

    // Weighted Overall Layout Score: 60% Structural Hygiene + 40% Visual Polish
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
