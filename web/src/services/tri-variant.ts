/**
 * TriVariantService — Tri-Variant Role Framing Engine.
 * 
 * Allows candidates to instantly frame any tailored bullet through three
 * distinct engineering archetypes:
 * 1. Systems Depth: Architecture, concurrency, memory/CPU, distributed systems, internal mechanics.
 * 2. Scale & Impact: Business metrics, throughput, latency percentiles, revenue, uptime SLAs, active users.
 * 3. Velocity & MVP: 0-to-1 rapid prototyping, automated CI/CD, cross-functional agility, time-to-market.
 */

import { TailoredBulletDiff } from '../types/index.js';

export type FramingVariantId = 'systemsDepth' | 'scaleImpact' | 'velocityMvp';

export interface FramingVariant {
  id: FramingVariantId;
  label: string;
  badge: string;
  description: string;
  text: string;
  charCount: number;
  lineEstimate: number;
  fitsSingleLine: boolean;
  fitsTwoLines: boolean;
}

export class TriVariantService {
  private static readonly CHARS_PER_LINE = 95;

  /**
   * Synthesize or extract all 3 framing variants for a given bullet diff.
   */
  public getAllVariants(diff: TailoredBulletDiff): Record<FramingVariantId, FramingVariant> {
    return {
      systemsDepth: this.getVariant(diff, 'systemsDepth'),
      scaleImpact: this.getVariant(diff, 'scaleImpact'),
      velocityMvp: this.getVariant(diff, 'velocityMvp'),
    };
  }

  /**
   * Get a specific framing variant for a bullet diff.
   */
  public getVariant(diff: TailoredBulletDiff, variantId: FramingVariantId): FramingVariant {
    const text = this.resolveVariantText(diff, variantId);
    const charCount = text.length;
    const lineEstimate = Math.max(1, Math.ceil(charCount / TriVariantService.CHARS_PER_LINE));

    const metadata = this.getVariantMetadata(variantId);

    return {
      id: variantId,
      label: metadata.label,
      badge: metadata.badge,
      description: metadata.description,
      text,
      charCount,
      lineEstimate,
      fitsSingleLine: lineEstimate === 1,
      fitsTwoLines: lineEstimate <= 2,
    };
  }

  /**
   * Apply a selected framing variant to a diff, updating tailoredText and selectedVariant.
   */
  public applyVariantToDiff(diff: TailoredBulletDiff, variantId: FramingVariantId): TailoredBulletDiff {
    const variant = this.getVariant(diff, variantId);
    return {
      ...diff,
      tailoredText: variant.text,
      selectedVariant: variantId,
      charCountDiff: variant.text.length - (diff.originalText?.length || 0),
    };
  }

  /**
   * Apply a uniform framing variant across all diffs.
   */
  public applyGlobalVariant(diffs: TailoredBulletDiff[], variantId: FramingVariantId): TailoredBulletDiff[] {
    return diffs.map((d) => this.applyVariantToDiff(d, variantId));
  }

  /**
   * Resolves the text for a variant, checking pre-computed LLM variations first,
   * then falling back to deterministic AST-style reframing.
   */
  public resolveVariantText(diff: TailoredBulletDiff, variantId: FramingVariantId): string {
    const variations = diff.variations;
    const baseText = diff.tailoredText || diff.originalText || '';

    if (variations) {
      if (variantId === 'systemsDepth') {
        if (variations.technicalDepth && variations.technicalDepth.trim()) {
          return variations.technicalDepth.trim();
        }
        if ((variations as any).systemsDepth && (variations as any).systemsDepth.trim()) {
          return (variations as any).systemsDepth.trim();
        }
      } else if (variantId === 'scaleImpact') {
        if (variations.highImpact && variations.highImpact.trim()) {
          return variations.highImpact.trim();
        }
        if ((variations as any).scaleImpact && (variations as any).scaleImpact.trim()) {
          return (variations as any).scaleImpact.trim();
        }
      } else if (variantId === 'velocityMvp') {
        if (variations.leadership && variations.leadership.trim()) {
          return variations.leadership.trim();
        }
        if ((variations as any).velocityMvp && (variations as any).velocityMvp.trim()) {
          return (variations as any).velocityMvp.trim();
        }
      }
    }

    // Deterministic fallback synthesis
    return this.synthesizeVariantText(diff.originalText || '', baseText, variantId);
  }

  /**
   * Deterministically synthesizes a variant using specialized archetype action verbs
   * and structural framings.
   */
  public synthesizeVariantText(
    originalText: string,
    baseText: string,
    variantId: FramingVariantId
  ): string {
    const cleanBase = baseText.replace(/^[•\-\*]\s*/, '').trim();

    switch (variantId) {
      case 'systemsDepth': {
        // Emphasize internal architecture, concurrency, profiling, low-level efficiency
        if (/architected|engineered|refactored/i.test(cleanBase)) {
          return cleanBase;
        }
        const stripped = cleanBase.replace(/^(developed|built|created|worked on|helped with)\s+/i, '');
        return `Architected and optimized low-latency ${stripped.charAt(0).toLowerCase() + stripped.slice(1)}`;
      }

      case 'scaleImpact': {
        // Emphasize throughput, latency percentiles, reliability, or quantifiable impact
        if (/\d+%|\$\d+|\b(?:scale|throughput|sla|uptime|latency)\b/i.test(cleanBase)) {
          return cleanBase;
        }
        const stripped = cleanBase.replace(/^(developed|built|created|worked on)\s+/i, '');
        return `Scaled high-throughput ${stripped.charAt(0).toLowerCase() + stripped.slice(1)}, sustaining 99.99% availability`;
      }

      case 'velocityMvp': {
        // Emphasize 0-to-1 speed, automated gates, rapid iterative deployment
        if (/spearheaded|delivered|accelerated|streamlined/i.test(cleanBase)) {
          return cleanBase;
        }
        const stripped = cleanBase.replace(/^(developed|built|created|worked on)\s+/i, '');
        return `Spearheaded 0-to-1 delivery of ${stripped.charAt(0).toLowerCase() + stripped.slice(1)}, cutting iteration cycles by 50%`;
      }
    }
  }

  private getVariantMetadata(variantId: FramingVariantId): {
    label: string;
    badge: string;
    description: string;
  } {
    switch (variantId) {
      case 'systemsDepth':
        return {
          label: 'Systems Depth',
          badge: 'ARCH',
          description: 'Highlights technical architecture, concurrency, memory/CPU, and low-level mechanics.',
        };
      case 'scaleImpact':
        return {
          label: 'Scale & Impact',
          badge: 'SCALE',
          description: 'Highlights business ROI, high-volume throughput, latency p99, and enterprise SLAs.',
        };
      case 'velocityMvp':
        return {
          label: 'Velocity & MVP',
          badge: 'SPEED',
          description: 'Highlights rapid delivery, 0-to-1 prototyping, automated CI/CD, and team velocity.',
        };
    }
  }
}
