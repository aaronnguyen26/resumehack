import { ResumeBullet, TailoredBulletDiff, AtsScoreReport } from '../types/index.js';

export class LlmTailorService {
  /**
   * Generates tailored bullet points optimized for the target job description and missing keywords.
   * Runs 100% inside the Chrome Extension client!
   */
  public tailorBullets(
    bullets: ResumeBullet[],
    _jobDescription: string,
    atsReport: AtsScoreReport,
    jobTitle: string,
    company: string
  ): TailoredBulletDiff[] {
    const missingCritical = atsReport.keywords
      .filter(k => !k.foundInResume)
      .slice(0, 5)
      .map(k => k.keyword);

    const diffs: TailoredBulletDiff[] = [];

    for (let i = 0; i < bullets.length; i++) {
      const bullet = bullets[i];
      const targetKeyword = missingCritical[i % (missingCritical.length || 1)] || 'Scalability';
      
      const tailored = this.optimizeBulletText(bullet.originalText, targetKeyword, jobTitle, company);

      diffs.push({
        id: bullet.id || `bullet-${i + 1}`,
        section: bullet.section || 'Experience',
        organization: bullet.organization || 'Experience Item',
        role: bullet.role || '',
        originalText: bullet.originalText,
        tailoredText: tailored.text,
        injectedKeywords: tailored.injected,
        rationale: tailored.rationale,
        charCountDiff: tailored.text.length - bullet.originalText.length,
        status: 'pending'
      });
    }

    return diffs;
  }

  private optimizeBulletText(
    original: string,
    targetKeyword: string,
    targetRole: string,
    targetCompany: string
  ): { text: string; injected: string[]; rationale: string } {
    let cleaned = original.trim();
    if (cleaned.startsWith('•') || cleaned.startsWith('-') || cleaned.startsWith('*')) {
      cleaned = cleaned.replace(/^[•\-*]\s*/, '');
    }

    const weakVerbs: Record<string, string> = {
      'worked on': 'Architected and implemented',
      'helped with': 'Spearheaded development of',
      'responsible for': 'Engineered and deployed',
      'assisted in': 'Collaborated on developing',
      'made': 'Designed and implemented',
      'used': 'Leveraged',
      'fixed': 'Diagnosed and resolved',
      'wrote': 'Engineered high-performance'
    };

    let improved = cleaned;
    let verbReplaced = false;
    for (const [weak, strong] of Object.entries(weakVerbs)) {
      const regex = new RegExp(`\\b${weak}\\b`, 'i');
      if (regex.test(improved)) {
        improved = improved.replace(regex, strong);
        verbReplaced = true;
        break;
      }
    }

    if (!verbReplaced && !/^[A-Z][a-z]+ed\b/.test(improved)) {
      improved = `Engineered ${improved.charAt(0).toLowerCase() + improved.slice(1)}`;
    }

    const injected: string[] = [];
    let rationale = '';

    if (targetKeyword && !improved.toLowerCase().includes(targetKeyword.toLowerCase())) {
      if (improved.includes('using') || improved.includes('with')) {
        improved = improved.replace(/(using|with)\s+/i, `$1 ${targetKeyword}, `);
        injected.push(targetKeyword);
      } else {
        improved = `${improved}, leveraging ${targetKeyword} for enhanced maintainability`;
        injected.push(targetKeyword);
      }
      rationale = `Injected high-priority keyword "${targetKeyword}" to match ${targetRole} requirements while strengthening STAR impact.`;
    } else {
      rationale = `Strengthened action verbs and concise impact framing tailored for ${targetCompany}.`;
    }

    return {
      text: improved,
      injected,
      rationale
    };
  }
}
