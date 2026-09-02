/**
 * Canonical Resume Layout Specification
 *
 * Grounded in technical resume standards from university career development centers
 * (Harvard OCS, Stanford CDL, MIT Career Services) and Google Docs typographic geometry.
 *
 * NOTE: These constants are explicitly labeled as PROVISIONAL heuristics subject to
 * empirical telemetry tuning and user preference overrides.
 */

export interface ResumeLayoutSpecification {
  margins: {
    /** Minimum safe margin in points (36pt = 0.50 in). Below this risks printer/ATS cutoff. */
    minPt: number;
    /** Maximum recommended margin in points (54pt = 0.75 in). Above this wastes page real estate. */
    maxPt: number;
    /** Gold-standard modern technical resume margin in points (36pt = 0.50 in). */
    optimalPt: number;
    /** Maximum allowable asymmetry between left/right or top/bottom margins in points (18pt = 0.25 in). */
    maxAsymmetryPt: number;
  };
  typography: {
    bodyFontPt: { min: 9.5; max: 11.5; optimal: 10.5 };
    headingFontPt: { min: 12.0; max: 14.5; optimal: 13.0 };
    nameTitlePt: { min: 18.0; max: 24.0; optimal: 20.0 };
    /** Minimum ratio between heading font size and body font size for distinct visual hierarchy. */
    minHeadingToBodyRatio: number;
    /** Citable ATS-safe typography families. */
    recommendedFontFamilies: string[];
  };
  spacing: {
    /** Standard characters per line at 0.5" margins and 10.5pt font across 8.5" width. */
    charsPerLine: number;
    /** Character buffer before a line is guaranteed to wrap. */
    charsPerLineSlack: number;
    /** Maximum characters on final line of multi-line bullet before being flagged as an orphan/widow. */
    widowThresholdChars: number;
    headingSpaceBeforePt: { min: 5; max: 12; optimal: 8 };
    headingSpaceAfterPt: { min: 1.5; max: 4; optimal: 2.5 };
    bulletSpaceAfterPt: { min: 1.0; max: 3.5; optimal: 2.0 };
  };
  emphasis: {
    /** Minimum bold word ratio to provide visual recruiter anchor points (job titles, companies, top metric). */
    minBoldWordRatio: number;
    /** Maximum bold word ratio before visual clutter impairs F-pattern scanning. */
    maxBoldWordRatio: number;
    /** Maximum consecutive bold characters before flagging multi-line bold overuse. */
    maxConsecutiveBoldChars: number;
  };
  seniorityPageBudget: {
    /** < 5 YOE -> Strict 1-page budget. */
    earlyCareerMaxYoe: number;
    /** 5-8 YOE -> Strong 1-page preference or tight 2-page. */
    midCareerMaxYoe: number;
    /** > 8 YOE -> 2-page standard acceptable. */
    seniorMinYoe: number;
    /** Target line capacity for a full single page (36-48 lines). */
    minSinglePageCapacityLines: number;
    maxSinglePageCapacityLines: number;
    /** Target line capacity for a balanced two-page resume (75-96 lines). */
    minTwoPageCapacityLines: number;
    maxTwoPageCapacityLines: number;
    /** Line buffer before reaching maximum single page capacity to trigger spillover warning. */
    spilloverWarningBufferLines: number;
  };
}

export const PROVISIONAL_RESUME_LAYOUT_SPEC: ResumeLayoutSpecification = {
  margins: {
    minPt: 36, // 0.50 in
    maxPt: 54, // 0.75 in
    optimalPt: 36,
    maxAsymmetryPt: 18, // 0.25 in
  },
  typography: {
    bodyFontPt: { min: 9.5, max: 11.5, optimal: 10.5 },
    headingFontPt: { min: 12.0, max: 14.5, optimal: 13.0 },
    nameTitlePt: { min: 18.0, max: 24.0, optimal: 20.0 },
    minHeadingToBodyRatio: 1.18, // e.g. 13.0 / 10.5 = 1.238x
    recommendedFontFamilies: [
      'Arial',
      'Calibri',
      'Inter',
      'Roboto',
      'Times New Roman',
      'Garamond',
      'Georgia',
      'Lato',
    ],
  },
  spacing: {
    charsPerLine: 88,
    charsPerLineSlack: 4,
    widowThresholdChars: 18,
    headingSpaceBeforePt: { min: 5, max: 12, optimal: 8 },
    headingSpaceAfterPt: { min: 1.5, max: 4, optimal: 2.5 },
    bulletSpaceAfterPt: { min: 1.0, max: 3.5, optimal: 2.0 },
  },
  emphasis: {
    minBoldWordRatio: 0.04, // 4% bold words
    maxBoldWordRatio: 0.22, // 22% bold words
    maxConsecutiveBoldChars: 120,
  },
  seniorityPageBudget: {
    earlyCareerMaxYoe: 5,
    midCareerMaxYoe: 8,
    seniorMinYoe: 8,
    minSinglePageCapacityLines: 36,
    maxSinglePageCapacityLines: 48,
    minTwoPageCapacityLines: 75,
    maxTwoPageCapacityLines: 96,
    spilloverWarningBufferLines: 4, // Trigger spillover warning 4 lines before max limit (e.g. 44 lines)
  },
};

export const RESUME_LAYOUT_SPEC = PROVISIONAL_RESUME_LAYOUT_SPEC;
