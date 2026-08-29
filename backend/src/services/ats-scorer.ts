import { AtsScoreReport, KeywordMatch } from '../types/index.js';

// Common technical skills, tools, and domain keywords dictionary
const SKILL_DICTIONARY: Record<string, { category: KeywordMatch['category']; importance: KeywordMatch['importance'] }> = {
  // Languages
  'python': { category: 'Hard Skill', importance: 'Critical' },
  'typescript': { category: 'Hard Skill', importance: 'Critical' },
  'javascript': { category: 'Hard Skill', importance: 'Critical' },
  'java': { category: 'Hard Skill', importance: 'Critical' },
  'c++': { category: 'Hard Skill', importance: 'Critical' },
  'c#': { category: 'Hard Skill', importance: 'Recommended' },
  'go': { category: 'Hard Skill', importance: 'Critical' },
  'golang': { category: 'Hard Skill', importance: 'Critical' },
  'rust': { category: 'Hard Skill', importance: 'Recommended' },
  'sql': { category: 'Hard Skill', importance: 'Critical' },
  'html/css': { category: 'Hard Skill', importance: 'Recommended' },
  'r': { category: 'Hard Skill', importance: 'Recommended' },

  // Frontend & Mobile
  'react': { category: 'Tool / Framework', importance: 'Critical' },
  'react native': { category: 'Tool / Framework', importance: 'Recommended' },
  'next.js': { category: 'Tool / Framework', importance: 'Critical' },
  'vue': { category: 'Tool / Framework', importance: 'Recommended' },
  'angular': { category: 'Tool / Framework', importance: 'Recommended' },
  'tailwind css': { category: 'Tool / Framework', importance: 'Recommended' },
  'flutter': { category: 'Tool / Framework', importance: 'Recommended' },
  'swift': { category: 'Hard Skill', importance: 'Recommended' },
  'kotlin': { category: 'Hard Skill', importance: 'Recommended' },

  // Backend & Cloud
  'node.js': { category: 'Tool / Framework', importance: 'Critical' },
  'express': { category: 'Tool / Framework', importance: 'Recommended' },
  'django': { category: 'Tool / Framework', importance: 'Recommended' },
  'fastapi': { category: 'Tool / Framework', importance: 'Recommended' },
  'spring boot': { category: 'Tool / Framework', importance: 'Recommended' },
  'graphql': { category: 'Tool / Framework', importance: 'Recommended' },
  'rest api': { category: 'Hard Skill', importance: 'Critical' },
  'microservices': { category: 'Domain Knowledge', importance: 'Critical' },
  'system design': { category: 'Domain Knowledge', importance: 'Critical' },
  'aws': { category: 'Tool / Framework', importance: 'Critical' },
  'gcp': { category: 'Tool / Framework', importance: 'Critical' },
  'google cloud': { category: 'Tool / Framework', importance: 'Critical' },
  'azure': { category: 'Tool / Framework', importance: 'Critical' },
  'docker': { category: 'Tool / Framework', importance: 'Critical' },
  'kubernetes': { category: 'Tool / Framework', importance: 'Critical' },
  'ci/cd': { category: 'Tool / Framework', importance: 'Critical' },
  'terraform': { category: 'Tool / Framework', importance: 'Recommended' },

  // Data & AI
  'postgresql': { category: 'Tool / Framework', importance: 'Critical' },
  'mongodb': { category: 'Tool / Framework', importance: 'Recommended' },
  'redis': { category: 'Tool / Framework', importance: 'Recommended' },
  'kafka': { category: 'Tool / Framework', importance: 'Recommended' },
  'spark': { category: 'Tool / Framework', importance: 'Recommended' },
  'pandas': { category: 'Tool / Framework', importance: 'Recommended' },
  'numpy': { category: 'Tool / Framework', importance: 'Recommended' },
  'scikit-learn': { category: 'Tool / Framework', importance: 'Recommended' },
  'pytorch': { category: 'Tool / Framework', importance: 'Critical' },
  'tensorflow': { category: 'Tool / Framework', importance: 'Critical' },
  'machine learning': { category: 'Domain Knowledge', importance: 'Critical' },
  'deep learning': { category: 'Domain Knowledge', importance: 'Recommended' },
  'llm': { category: 'Domain Knowledge', importance: 'Critical' },
  'nlp': { category: 'Domain Knowledge', importance: 'Recommended' },

  // Methodologies & Soft Skills
  'agile': { category: 'Domain Knowledge', importance: 'Recommended' },
  'scrum': { category: 'Domain Knowledge', importance: 'Recommended' },
  'cross-functional collaboration': { category: 'Soft Skill', importance: 'Recommended' },
  'leadership': { category: 'Soft Skill', importance: 'Recommended' },
  'problem solving': { category: 'Soft Skill', importance: 'Recommended' },
  'communication': { category: 'Soft Skill', importance: 'Recommended' },
  'project management': { category: 'Soft Skill', importance: 'Recommended' },
  'unit testing': { category: 'Hard Skill', importance: 'Critical' },
  'git': { category: 'Tool / Framework', importance: 'Critical' }
};

export class AtsScorerService {
  /**
   * Analyzes resume text against a job description and produces an ATS match report.
   */
  public analyze(resumeText: string, jobDescription: string): AtsScoreReport {
    const normResume = resumeText.toLowerCase();
    const normJD = jobDescription.toLowerCase();

    const extractedKeywords: KeywordMatch[] = [];

    // Check for known skills present in JD
    for (const [skill, meta] of Object.entries(SKILL_DICTIONARY)) {
      const regex = new RegExp(`\\b${this.escapeRegex(skill)}\\b`, 'gi');
      const matches = normJD.match(regex);

      if (matches && matches.length > 0) {
        const resumeMatch = new RegExp(`\\b${this.escapeRegex(skill)}\\b`, 'i').test(normResume);
        
        extractedKeywords.push({
          keyword: this.capitalizeWord(skill),
          category: meta.category,
          foundInResume: resumeMatch,
          frequencyInJD: matches.length,
          importance: meta.importance
        });
      }
    }

    // Dynamic n-gram extraction for JD-specific phrases not in dictionary
    const dynamicKeywords = this.extractDynamicKeywords(normJD, normResume);
    extractedKeywords.push(...dynamicKeywords);

    // Sort: Critical missing first, then frequency
    extractedKeywords.sort((a, b) => {
      if (a.foundInResume === b.foundInResume) {
        return b.frequencyInJD - a.frequencyInJD;
      }
      return a.foundInResume ? 1 : -1;
    });

    const totalKeywords = extractedKeywords.length || 1;
    const matched = extractedKeywords.filter(k => k.foundInResume);
    const missing = extractedKeywords.filter(k => !k.foundInResume);

    // Calculate sub-scores
    const hardSkills = extractedKeywords.filter(k => k.category === 'Hard Skill');
    const tools = extractedKeywords.filter(k => k.category === 'Tool / Framework');
    const soft = extractedKeywords.filter(k => k.category === 'Soft Skill');

    const hardScore = this.calcCategoryScore(hardSkills);
    const toolScore = this.calcCategoryScore(tools);
    const softScore = this.calcCategoryScore(soft);
    const formattingScore = this.evaluateFormatting(resumeText);

    // Weighted overall ATS score (0-100)
    const rawScore = Math.round(
      (hardScore * 0.40) +
      (toolScore * 0.30) +
      (softScore * 0.15) +
      (formattingScore * 0.15)
    );
    const overallScore = Math.min(100, Math.max(15, rawScore));

    const suggestions: string[] = [];
    if (missing.some(k => k.importance === 'Critical')) {
      const critMissing = missing.filter(k => k.importance === 'Critical').slice(0, 3).map(k => k.keyword).join(', ');
      suggestions.push(`High priority missing keywords detected: ${critMissing}. Weave these into your bullet points.`);
    }
    if (hardScore < 60) {
      suggestions.push('Core technical skills alignment is low. Highlight relevant languages and frameworks in your Experience and Skills sections.');
    }
    if (formattingScore < 85) {
      suggestions.push('Keep bullet points action-driven (Action Verb + Context + Quantifiable Metric).');
    }
    if (suggestions.length === 0) {
      suggestions.push('Excellent keyword alignment! Your resume closely reflects the requirements for this role.');
    }

    return {
      overallScore,
      breakdown: {
        hardSkillsScore: hardScore,
        experienceRelevanceScore: Math.round((hardScore + toolScore) / 2),
        softSkillsScore: softScore,
        formattingScore
      },
      totalKeywords,
      matchedKeywordsCount: matched.length,
      missingKeywordsCount: missing.length,
      keywords: extractedKeywords,
      improvementSuggestions: suggestions,
      summaryFeedback: overallScore >= 80 
        ? 'Great match! Your resume strongly aligns with the target job opening.'
        : overallScore >= 60
        ? 'Moderate match. Injecting missing key competencies will noticeably boost your ATS visibility.'
        : 'Low match. Several critical technical requirements from the job description are absent from your resume.'
    };
  }

  private calcCategoryScore(items: KeywordMatch[]): number {
    if (items.length === 0) return 85; // neutral default
    const matched = items.filter(k => k.foundInResume).length;
    return Math.round((matched / items.length) * 100);
  }

  private evaluateFormatting(text: string): number {
    let score = 90;
    const hasBullets = text.includes('•') || text.includes('- ') || text.includes('* ');
    const hasMetrics = /\b\d+%\b|\$\d+|\b\d+x\b|\b\d+\s+(users|clients|engineers|requests|queries|downloads)\b/i.test(text);
    
    if (hasBullets) score += 5;
    if (hasMetrics) score += 5;
    return Math.min(100, score);
  }

  private extractDynamicKeywords(normJD: string, normResume: string): KeywordMatch[] {
    const dynamic: KeywordMatch[] = [];
    const candidates = ['distributed systems', 'full-stack development', 'data pipelines', 'cloud infrastructure', 'code reviews', 'api integration', 'latency optimization'];
    
    for (const term of candidates) {
      if (normJD.includes(term) && !SKILL_DICTIONARY[term]) {
        dynamic.push({
          keyword: this.capitalizeWord(term),
          category: 'Domain Knowledge',
          foundInResume: normResume.includes(term),
          frequencyInJD: 1,
          importance: 'Recommended'
        });
      }
    }
    return dynamic;
  }

  private escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private capitalizeWord(str: string): string {
    return str.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }
}
