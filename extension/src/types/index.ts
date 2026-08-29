export interface JobPosting {
  id: string;
  title: string;
  company: string;
  location: string;
  type: 'Internship' | 'New Grad' | 'Full-time';
  url: string;
  source: 'LinkedIn' | 'Greenhouse' | 'Lever' | 'Workday' | 'Handshake' | 'CuratedFeed';
  salaryRange?: string;
  description: string;
  postedDate?: string;
  season?: string;
  category?: 'Software Engineering' | 'Product Management' | 'Data & AI' | 'Finance & Quant' | 'Design';
}

export interface KeywordMatch {
  keyword: string;
  category: 'Hard Skill' | 'Tool / Framework' | 'Soft Skill' | 'Domain Knowledge' | 'Certification';
  foundInResume: boolean;
  frequencyInJD: number;
  importance: 'Critical' | 'Recommended' | 'Bonus';
  contextSnippet?: string;
}

export interface AtsScoreReport {
  overallScore: number;
  breakdown: {
    hardSkillsScore: number;
    experienceRelevanceScore: number;
    softSkillsScore: number;
    formattingScore: number;
  };
  totalKeywords: number;
  matchedKeywordsCount: number;
  missingKeywordsCount: number;
  keywords: KeywordMatch[];
  improvementSuggestions: string[];
  summaryFeedback: string;
}

export interface ResumeBullet {
  id: string;
  section: string;
  organization: string;
  role: string;
  originalText: string;
  startIndex?: number;
  endIndex?: number;
}

export interface TailoredBulletDiff {
  id: string;
  section: string;
  organization: string;
  role: string;
  originalText: string;
  tailoredText: string;
  injectedKeywords: string[];
  rationale: string;
  charCountDiff: number;
  status: 'pending' | 'accepted' | 'rejected';
}

export interface TailorResumeResponse {
  jobId?: string;
  jobTitle: string;
  company: string;
  atsReport: AtsScoreReport;
  projectedNewScore: number;
  bulletDiffs: TailoredBulletDiff[];
  optimizedSummary?: string;
}

export interface ApplicationRecord {
  id: string;
  jobId: string;
  company: string;
  title: string;
  location: string;
  status: 'Bookmarked' | 'Tailored' | 'Applied' | 'Interviewing' | 'Offered' | 'Rejected';
  appliedDate?: string;
  jobUrl: string;
  masterDocId?: string;
  tailoredDocId?: string;
  tailoredDocUrl?: string;
  pdfExportUrl?: string;
  atsScoreAtApplication?: number;
  notes?: string;
  salary?: string;
  updatedAt: string;
}

export interface ScrapedJobData {
  title: string;
  company: string;
  location?: string;
  description: string;
  url: string;
  source: 'LinkedIn' | 'Greenhouse' | 'Lever' | 'Workday' | 'Indeed' | 'Handshake' | 'CuratedFeed' | 'Custom';
}
