/**
 * FactVerificationService — Automated Anti-Hallucination & Metric Grounding Engine.
 *
 * Compares tailored bullets against original candidate claims to detect ungrounded
 * numbers, fabricated metrics, or invented credentials. Automatically sanitizes
 * fabricated metrics into bracketed placeholders (e.g. "[improved latency by X%]")
 * so candidates can verify and provide real metrics before submitting.
 */

export interface FactCheckReport {
  isFullyGrounded: boolean;
  unverifiedClaims: string[];
  sanitizedText: string;
  originalMetrics: string[];
  generatedMetrics: string[];
  bracketedPlaceholdersCount: number;
}

// Regex to capture quantifiable metrics: percentages, numbers with units (ms, req/s, QPS, users, $, x)
const METRIC_PATTERN = /(?:\$\d+(?:,\d{3})*(?:\.\d+)?(?:\s*[kmb])?\b|\b\d+(?:\.\d+)?%|\b\d+(?:\.\d+)?x\b|\b\d+(?:,\d{3})*(?:\.\d+)?\s*(?:k|m|b|ms|μs|us|sec|seconds|minutes|hours|days|active\s+users|users|dau|mau|clients|engineers|requests|rps|qps|queries|downloads|percent|pts|gb|tb|pb)\b)/gi;

export class FactVerificationService {
  /**
   * Verifies and sanitizes a tailored bullet against its original source text.
   */
  public verifyAndSanitize(originalText: string, tailoredText: string): FactCheckReport {
    const originalMetrics = this.extractMetrics(originalText);
    const generatedMetrics = this.extractMetrics(tailoredText);

    // Sort generated metrics descending by length so longer patterns replace first
    generatedMetrics.sort((a, b) => b.length - a.length);

    const unverifiedClaims: string[] = [];
    let sanitizedText = tailoredText;

    for (const genMetric of generatedMetrics) {
      // Check if this metric was present or mathematically similar to an original metric
      const isGrounded = originalMetrics.some((origMetric) =>
        this.isMetricCompatible(origMetric, genMetric)
      );

      if (!isGrounded) {
        unverifiedClaims.push(genMetric);
        // Transform the fabricated metric into a bracketed candidate placeholder
        sanitizedText = this.sanitizeMetric(sanitizedText, genMetric);
      }
    }

    const bracketedPlaceholders = (sanitizedText.match(/\[[^\]]+\]/g) || []).length;
    const isFullyGrounded = unverifiedClaims.length === 0;

    return {
      isFullyGrounded,
      unverifiedClaims,
      sanitizedText,
      originalMetrics,
      generatedMetrics,
      bracketedPlaceholdersCount: bracketedPlaceholders,
    };
  }

  private extractMetrics(text: string): string[] {
    const matches = text.match(METRIC_PATTERN) || [];
    return Array.from(new Set(matches.map((m) => m.trim())));
  }

  private isMetricCompatible(orig: string, gen: string): boolean {
    const cleanOrig = orig.toLowerCase().replace(/\s+/g, '');
    const cleanGen = gen.toLowerCase().replace(/\s+/g, '');

    if (cleanOrig === cleanGen) return true;

    // Check raw number equivalence (e.g. "50%" vs "50 percent")
    const origNum = orig.match(/\d+(?:\.\d+)?/)?.[0];
    const genNum = gen.match(/\d+(?:\.\d+)?/)?.[0];
    if (origNum && genNum && origNum === genNum) return true;

    return false;
  }

  private sanitizeMetric(fullText: string, metric: string): string {
    // Determine the nature of the metric (percentage, latency, scale, dollar)
    let placeholder = '[X]';
    if (/%|percent/i.test(metric)) {
      placeholder = '[X%]';
    } else if (/ms|sec|latency|speed/i.test(metric)) {
      placeholder = '[<X ms]';
    } else if (/\$|usd|revenue/i.test(metric)) {
      placeholder = '[$X]';
    } else if (/users|dau|mau|clients/i.test(metric)) {
      placeholder = '[X+ users]';
    } else if (/qps|rps|requests|queries/i.test(metric)) {
      placeholder = '[X QPS]';
    } else if (/\bx\b/i.test(metric)) {
      placeholder = '[X times]';
    }

    const escaped = metric.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return fullText.replace(new RegExp(escaped, 'g'), () => placeholder);
  }
}
