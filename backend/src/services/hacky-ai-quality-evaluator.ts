/**
 * Hacky AI Recommendation Quality Evaluator
 *
 * An objective, multi-dimensional benchmarking engine that measures the quality,
 * accuracy, domain fidelity, and ATS efficacy of Hacky AI resume recommendations.
 *
 * Rubric Dimensions:
 * 1. Quote Fidelity & Anti-Hallucination (originalText verbatim in resume)
 * 2. Strict Section Isolation (Education/Certifications completely protected)
 * 3. Google X-Y-Z Formula & Metric Quantification (%/ms/RPS/scale present)
 * 4. Action Verb Power & Diversity (Tier-1 executive verbs, zero weak repetition)
 * 5. Domain Calibration (Frontend vitals vs Backend throughput vs ML accuracy)
 * 6. Line Budget & Brevity (Reclaims physical page budget, zero ragged widows)
 * 7. Diagnostic Critique Depth (Actionable hiring committee critique)
 * 8. Hacky AI Persona Masking (Clean Hacky AI branding, zero provider leaks)
 */

import {
  GeminiPersonalizedRecommendation,
  detectRaggedWidow,
} from './gemini-recommendations.js';

export interface QualityDimensionScore {
  name: string;
  score: number; // 0 to 100
  weight: number; // 0.0 to 1.0
  passed: boolean;
  details: string;
}

export interface RecommendationQualityReport {
  overallScore: number; // 0 to 100 weighted
  grade: 'Tier-1 Elite (Top 1%)' | 'Strong Competitive (Top 5%)' | 'Competent' | 'Subpar / Uncalibrated';
  passed: boolean; // overallScore >= 85
  dimensions: {
    quoteFidelity: QualityDimensionScore;
    sectionIsolation: QualityDimensionScore;
    xyzImpactFormula: QualityDimensionScore;
    verbPowerAndDiversity: QualityDimensionScore;
    domainCalibration: QualityDimensionScore;
    lineBudgetBrevity: QualityDimensionScore;
    critiqueDepth: QualityDimensionScore;
    hackyAiMasking: QualityDimensionScore;
  };
  totalRecommendationsEvaluated: number;
  antiHallucinationPassRate: number; // percentage 0-100
  metricQuantificationRate: number; // percentage 0-100
  executivePowerVerbRate: number; // percentage 0-100
  summary: string;
}

// Elite Executive Power Verbs recommended by FAANG & Tier-1 Hiring Committees
const ELITE_POWER_VERBS = new Set([
  'architected',
  'engineered',
  'orchestrated',
  'spearheaded',
  'overhauled',
  'optimized',
  'accelerated',
  'automated',
  'streamlined',
  'instituted',
  'synthesized',
  'deployed',
  'scale',
  'scaled',
  'formulated',
  'pioneered',
  'refactored',
  'standardized',
  'consolidated',
  'decoupled',
  'implemented',
  'designed',
  'developed',
  'built',
  'authored',
  'delivered',
]);

// Weak, passive, or junior verbs flagged by ATS & hiring committees
const WEAK_PASSIVE_VERBS = new Set([
  'worked',
  'helped',
  'assisted',
  'responsible',
  'did',
  'participated',
  'involved',
  'contributed',
  'handled',
  'supported',
  'managed to',
  'tried',
]);

// Metric quantification regex patterns
const METRIC_PATTERNS = [
  /\b\d+(\.\d+)?%/,                         // percentages (e.g. 45%, 99.99%)
  /\b\d+([,\.]\d+)?\s*(ms|s|seconds|minutes)\b/i, // latencies (e.g. 35ms, 1.2s)
  /\b\d+([,\.]\d+)?\s*(k|m|b|million|billion)\b/i, // volume multipliers (e.g. 10M, 450k)
  /\b\d+([,\.]\d+)?\s*(rps|qps|tps|req\/s|msg\/s|msgs\/sec)\b/i, // throughput
  /\$\d+([,\.]\d+)?\s*(k|m|b|thousand|million)?\b/i, // financial impact (e.g. $45k)
  /\b\d+([,\.]\d+)?x\b/i,                   // multipliers (e.g. 3.5x, 10x)
  /\b\d{2,}\+?\s*(users|clients|engineers|customers|nodes|clusters|queries|daily|monthly)\b/i, // scale
];

// Protected education and certification keywords
const EDUCATION_CERT_KEYWORDS = [
  'high school',
  'diploma',
  'bachelor',
  'master',
  'phd',
  'doctorate',
  'degree',
  'university',
  'college',
  'b.s.',
  'm.s.',
  'gpa',
  'dean\'s list',
  'honor roll',
  'honors',
  'bilingual diploma',
  'ged',
  'secondary education',
  'university of',
  'college of',
  'institute of technology',
];

/**
 * Evaluates the quality, accuracy, and depth of Hacky AI recommendations against
 * Tier-1 tech company hiring bars (Google X-Y-Z, Harvard OCS, and ATS semantic matching).
 */
export function evaluateHackyAiRecommendationsQuality(
  recommendations: GeminiPersonalizedRecommendation[],
  resumeText: string,
  targetRole = 'Software Engineer',
  jobDescription = ''
): RecommendationQualityReport {
  if (!recommendations || recommendations.length === 0) {
    return {
      overallScore: 0,
      grade: 'Subpar / Uncalibrated',
      passed: false,
      dimensions: createZeroDimensions(),
      totalRecommendationsEvaluated: 0,
      antiHallucinationPassRate: 0,
      metricQuantificationRate: 0,
      executivePowerVerbRate: 0,
      summary: 'No recommendations provided for evaluation.',
    };
  }

  const cleanResume = resumeText.toLowerCase();

  // 1. Dimension 1: Quote Fidelity & Anti-Hallucination (Weight: 15%)
  let quoteMatches = 0;
  for (const rec of recommendations) {
    const orig = (rec.originalText || '')
      .replace(/^[•\-\*\u2022\u2023\u25E6\u2043\u2219▪▸⁃\s]+/, '')
      .trim()
      .toLowerCase();

    if (orig.length > 10 && cleanResume.includes(orig)) {
      quoteMatches++;
    } else if (orig.length > 20) {
      // Allow partial match if punctuation or subtle token variations occurred
      const snippet = orig.slice(0, 20);
      if (cleanResume.includes(snippet)) quoteMatches++;
    }
  }
  const quoteFidelityScore = Math.round((quoteMatches / recommendations.length) * 100);

  // 2. Dimension 2: Strict Section Isolation & Anti-Corruption (Weight: 15%)
  let corruptedEducationCount = 0;
  for (const rec of recommendations) {
    const targetText = `${rec.originalText} ${rec.improvedText}`.toLowerCase();
    const touchesEducation = EDUCATION_CERT_KEYWORDS.some(kw => targetText.includes(kw));
    if (touchesEducation || rec.sectionHint === 'skills' && (targetText.includes('diploma') || targetText.includes('degree'))) {
      corruptedEducationCount++;
    }
  }
  const sectionIsolationScore = corruptedEducationCount === 0 ? 100 : Math.max(0, 100 - corruptedEducationCount * 50);

  // 3. Dimension 3: Google X-Y-Z Formula & Metric Quantification (Weight: 20%)
  let quantifiedCount = 0;
  let xyzStructuredCount = 0;
  for (const rec of recommendations) {
    const improved = rec.improvedText || '';
    const hasMetric = METRIC_PATTERNS.some(p => p.test(improved));
    if (hasMetric) quantifiedCount++;

    // X-Y-Z structure: Action verb + Accomplished X + as measured by Y + by doing Z
    const hasActionVerb = /^[•\-\*\s]*([A-Z][a-z]+ed|[A-Z][a-z]+ing|[A-Z][a-z]+)\b/.test(improved);
    const hasCausalConnector = /\b(by|via|using|utilizing|through|resulting in|reducing|increasing|driving|sustaining|achieving|delivering|yielding|cutting|accelerating|elevating|preventing|with)\b/i.test(improved);
    if (hasActionVerb && hasMetric && hasCausalConnector) {
      xyzStructuredCount++;
    }
  }
  const metricRatio = quantifiedCount / recommendations.length;
  const xyzRatio = xyzStructuredCount / recommendations.length;
  const xyzImpactScore = Math.round((metricRatio * 50) + (xyzRatio * 50));

  // 4. Dimension 4: Action Verb Power & Diversity (Weight: 15%)
  let powerVerbCount = 0;
  let weakVerbCount = 0;
  const leadVerbs: string[] = [];

  for (const rec of recommendations) {
    const improved = rec.improvedText || '';
    const match = improved.replace(/^[•\-\*\s]+/, '').match(/^([A-Za-z]+)\b/);
    const leadVerb = match ? match[1].toLowerCase() : '';
    leadVerbs.push(leadVerb);

    if (ELITE_POWER_VERBS.has(leadVerb)) {
      powerVerbCount++;
    }
    if (WEAK_PASSIVE_VERBS.has(leadVerb)) {
      weakVerbCount++;
    }
  }

  // Check verb repetition among recommendations
  const verbFreq: Record<string, number> = {};
  leadVerbs.forEach(v => { if (v) verbFreq[v] = (verbFreq[v] || 0) + 1; });
  const maxRepetition = Math.max(...Object.values(verbFreq), 1);
  const repetitionPenalty = maxRepetition > 1 ? (maxRepetition - 1) * 15 : 0;

  const verbPowerScore = Math.max(0, Math.round(
    ((powerVerbCount / recommendations.length) * 100) - (weakVerbCount * 25) - repetitionPenalty
  ));

  // 5. Dimension 5: Domain Calibration & Plausibility (Weight: 15%)
  let domainCalibratedCount = 0;
  for (const rec of recommendations) {
    const improved = (rec.improvedText || '').toLowerCase();
    const domain = rec.domain || 'general';

    let isCalibrated = true;
    if (domain === 'frontend') {
      // Must not hallucinate backend clustering or DB locks
      const hasBadBackend = /\b(redis cluster|database locks|p99 database|kafka partition)\b/i.test(improved);
      const hasFrontendSignal = /\b(lcp|fcp|web vitals|bundle|react|css|ui|accessibility|wcag|responsive|users|latency|interaction)\b/i.test(improved);
      isCalibrated = !hasBadBackend && hasFrontendSignal;
    } else if (domain === 'backend') {
      const hasBackendSignal = /\b(latency|p99|rps|throughput|redis|postgres|api|concurrency|database|microservice|cache)\b/i.test(improved);
      isCalibrated = hasBackendSignal;
    } else if (domain === 'data_ai') {
      const hasDataSignal = /\b(pipeline|dataset|model|accuracy|f1|inference|vector|features|etl|loss|gpu|throughput)\b/i.test(improved);
      isCalibrated = hasDataSignal;
    } else if (domain === 'research_academic') {
      const hasResearchSignal = /\b(presentation|publication|peer review|dataset|proof|complexity|conference|benchmark|research)\b/i.test(improved);
      isCalibrated = hasResearchSignal;
    }

    if (isCalibrated) domainCalibratedCount++;
  }
  const domainCalibrationScore = Math.round((domainCalibratedCount / recommendations.length) * 100);

  // 6. Dimension 6: Line Budget & Brevity Optimization (Weight: 10%)
  let raggedWidowCount = 0;
  for (const rec of recommendations) {
    const text = rec.improvedText || '';
    if (detectRaggedWidow(text)) {
      raggedWidowCount++;
    }
  }
  const lineBudgetScore = Math.max(0, 100 - (raggedWidowCount * 25));

  // 7. Dimension 7: Diagnostic Critique Depth & Hiring Rationale (Weight: 5%)
  let deepCritiqueCount = 0;
  for (const rec of recommendations) {
    const critique = rec.critique || '';
    const reasoning = rec.reasoning || '';
    if (critique.length >= 35 && reasoning.length >= 35 && !critique.includes('This could be better')) {
      deepCritiqueCount++;
    }
  }
  const critiqueDepthScore = Math.round((deepCritiqueCount / recommendations.length) * 100);

  // 8. Dimension 8: Hacky AI Masking & Brand Integrity (Weight: 5%)
  let maskingPassCount = 0;
  for (const rec of recommendations) {
    const idValid = rec.id.startsWith('hacky-rec-') || rec.id.startsWith('rec-');
    const noRawProviderLeak = !rec.title.includes('Gemini') && !rec.critique.includes('Google Gemini');
    if (idValid && noRawProviderLeak) {
      maskingPassCount++;
    }
  }
  const hackyAiMaskingScore = Math.round((maskingPassCount / recommendations.length) * 100);

  // Calculate Weighted Overall Score
  const dimensions = {
    quoteFidelity: {
      name: 'Quote Fidelity & Anti-Hallucination',
      score: quoteFidelityScore,
      weight: 0.15,
      passed: quoteFidelityScore >= 80,
      details: `${quoteMatches}/${recommendations.length} bullets quote actual candidate resume text verbatim.`,
    },
    sectionIsolation: {
      name: 'Strict Section Isolation (Education/Certs Protected)',
      score: sectionIsolationScore,
      weight: 0.15,
      passed: sectionIsolationScore === 100,
      details: corruptedEducationCount === 0 ? 'Zero corruption of candidate Education, Diplomas, or Certifications.' : `Flagged ${corruptedEducationCount} unauthorized modifications to academic credentials.`,
    },
    xyzImpactFormula: {
      name: 'Google X-Y-Z Formula & Metric Quantification',
      score: xyzImpactScore,
      weight: 0.20,
      passed: xyzImpactScore >= 80,
      details: `${quantifiedCount}/${recommendations.length} bullets include hard metric quantification (${Math.round(metricRatio * 100)}%).`,
    },
    verbPowerAndDiversity: {
      name: 'Action Verb Power & Diversity',
      score: verbPowerScore,
      weight: 0.15,
      passed: verbPowerScore >= 80,
      details: `${powerVerbCount}/${recommendations.length} use elite leadership verbs. Repetition penalty: -${repetitionPenalty} pts.`,
    },
    domainCalibration: {
      name: 'Domain Calibration & Technical Plausibility',
      score: domainCalibrationScore,
      weight: 0.15,
      passed: domainCalibrationScore >= 80,
      details: `${domainCalibratedCount}/${recommendations.length} match technical domain mechanics without cross-domain hallucinations.`,
    },
    lineBudgetBrevity: {
      name: 'Line Budget & Ragged Widow Elimination',
      score: lineBudgetScore,
      weight: 0.10,
      passed: lineBudgetScore >= 75,
      details: `${raggedWidowCount} ragged widows detected that spill 1-3 words onto extra lines.`,
    },
    critiqueDepth: {
      name: 'Diagnostic Critique & Hiring Rationale',
      score: critiqueDepthScore,
      weight: 0.05,
      passed: critiqueDepthScore >= 80,
      details: `${deepCritiqueCount}/${recommendations.length} provide actionable hiring committee critiques.`,
    },
    hackyAiMasking: {
      name: 'Hacky AI Persona & Output Masking',
      score: hackyAiMaskingScore,
      weight: 0.05,
      passed: hackyAiMaskingScore >= 90,
      details: `${maskingPassCount}/${recommendations.length} conform to Hacky AI identifier and branding standards.`,
    },
  };

  const overallScore = Math.round(
    quoteFidelityScore * 0.15 +
    sectionIsolationScore * 0.15 +
    xyzImpactScore * 0.20 +
    verbPowerScore * 0.15 +
    domainCalibrationScore * 0.15 +
    lineBudgetScore * 0.10 +
    critiqueDepthScore * 0.05 +
    hackyAiMaskingScore * 0.05
  );

  let grade: RecommendationQualityReport['grade'] = 'Subpar / Uncalibrated';
  if (overallScore >= 92) {
    grade = 'Tier-1 Elite (Top 1%)';
  } else if (overallScore >= 85) {
    grade = 'Strong Competitive (Top 5%)';
  } else if (overallScore >= 70) {
    grade = 'Competent';
  }

  return {
    overallScore,
    grade,
    passed: overallScore >= 85 && sectionIsolationScore === 100 && quoteFidelityScore >= 80,
    dimensions,
    totalRecommendationsEvaluated: recommendations.length,
    antiHallucinationPassRate: quoteFidelityScore,
    metricQuantificationRate: Math.round(metricRatio * 100),
    executivePowerVerbRate: Math.round((powerVerbCount / recommendations.length) * 100),
    summary: `Hacky AI Quality Benchmark: ${overallScore}/100 [${grade}]. ${quantifiedCount}/${recommendations.length} bullets quantified. Education isolation: ${sectionIsolationScore === 100 ? '100% PROTECTED' : 'FAILED'}.`,
  };
}

function createZeroDimensions(): RecommendationQualityReport['dimensions'] {
  const zeroDim = (name: string, weight: number): QualityDimensionScore => ({
    name,
    score: 0,
    weight,
    passed: false,
    details: 'Not evaluated',
  });
  return {
    quoteFidelity: zeroDim('Quote Fidelity & Anti-Hallucination', 0.15),
    sectionIsolation: zeroDim('Strict Section Isolation (Education/Certs Protected)', 0.15),
    xyzImpactFormula: zeroDim('Google X-Y-Z Formula & Metric Quantification', 0.20),
    verbPowerAndDiversity: zeroDim('Action Verb Power & Diversity', 0.15),
    domainCalibration: zeroDim('Domain Calibration & Technical Plausibility', 0.15),
    lineBudgetBrevity: zeroDim('Line Budget & Ragged Widow Elimination', 0.10),
    critiqueDepth: zeroDim('Diagnostic Critique & Hiring Rationale', 0.05),
    hackyAiMasking: zeroDim('Hacky AI Persona & Output Masking', 0.05),
  };
}
