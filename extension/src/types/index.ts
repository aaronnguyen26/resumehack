export type AiProvider = 'gemini' | 'openai' | 'claude' | 'deepseek' | 'ollama' | 'custom';

export interface AiSettings {
  provider: AiProvider;
  apiKey: string;
  model?: string;
  baseUrl?: string;
  strictAntiHallucination?: boolean;
}

export interface ProviderPreset {
  label: string;
  defaultModel: string;
  models: string[];
  placeholderKey: string;
  keyUrl?: string;
}

export const PROVIDER_MODEL_PRESETS: Record<AiProvider, ProviderPreset> = {
  gemini: {
    label: 'Google Gemini',
    defaultModel: 'gemini-3.5-flash-lite',
    models: ['gemini-3.5-flash-lite', 'gemini-3.6-flash-lite', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-pro'],
    placeholderKey: 'AIzaSy...',
    keyUrl: 'https://aistudio.google.com/app/apikey',
  },
  openai: {
    label: 'OpenAI',
    defaultModel: 'gpt-4o-mini',
    models: ['gpt-4o-mini', 'gpt-4o', 'o3-mini', 'o1-mini'],
    placeholderKey: 'sk-proj-...',
    keyUrl: 'https://platform.openai.com/api-keys',
  },
  claude: {
    label: 'Anthropic Claude',
    defaultModel: 'claude-3-5-haiku-20241022',
    models: ['claude-3-5-haiku-20241022', 'claude-3-5-sonnet-20241022'],
    placeholderKey: 'sk-ant-...',
    keyUrl: 'https://console.anthropic.com/settings/keys',
  },
  deepseek: {
    label: 'DeepSeek',
    defaultModel: 'deepseek-chat',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    placeholderKey: 'sk-...',
    keyUrl: 'https://platform.deepseek.com/api_keys',
  },
  ollama: {
    label: 'Local Ollama (Offline / Private)',
    defaultModel: 'llama3.3',
    models: ['llama3.3', 'qwen2.5:14b', 'deepseek-r1:14b', 'mistral'],
    placeholderKey: 'ollama-local (no key needed)',
  },
  custom: {
    label: 'Custom OpenAI-Compatible',
    defaultModel: 'default',
    models: ['default'],
    placeholderKey: 'sk-...',
  },
};

export interface JobPosting {
  id: string;
  title: string;
  company: string;
  location: string;
  type: 'Internship' | 'New Grad' | 'Full-time';
  url: string;
  source: 'LinkedIn' | 'Greenhouse' | 'Lever' | 'Workday' | 'Handshake' | 'CuratedFeed' | 'SimplifyJobs' | 'Custom';
  salaryRange?: string;
  description: string;
  postedDate?: string;
  daysAgo?: number;
  season?: string;
  category?:
    | 'Software Engineering'
    | 'Data & AI'
    | 'Finance & Quant'
    | 'Product Management'
    | 'Business & Strategy'
    | 'Finance & Accounting'
    | 'Marketing & Communications'
    | 'Humanities & Social Sciences'
    | 'Policy & Non-Profit'
    | 'Operations & HR'
    | 'Design & Creative'
    | 'Design'
    | 'Cybersecurity'
    | 'Hardware & Embedded'
    | 'Legal & Compliance'
    | string;
  
  // Rich In-Depth Role Details
  workModel?: 'Remote' | 'Hybrid' | 'On-site';
  experienceLevel?: string;
  aboutCompany?: string;
  aboutTeam?: string;
  department?: string;
  responsibilities?: string[];
  requirements?: string[];
  preferredQualifications?: string[];
  skills?: string[];
  benefits?: string[];
  educationRequirements?: string;
  sponsorship?: 'Available' | 'Not Available' | 'U.S. Citizen / GC Only' | 'CPT / OPT Eligible' | string;
  interviewProcess?: string[];
  prepTips?: string[];
  teamHighlights?: string[];
  deadline?: string;
}

export interface KeywordMatch {
  keyword: string;
  category: 'Hard Skill' | 'Tool / Framework' | 'Soft Skill' | 'Domain Knowledge' | 'Certification';
  foundInResume: boolean;
  frequencyInJD: number;
  importance: 'Critical' | 'Recommended' | 'Bonus';
  contextSnippet?: string;
  matchType?: 'exact' | 'alias' | 'strong_semantic' | 'partial_semantic' | 'missing';
  semanticScore?: number;
}

export interface SelfProjectsAudit {
  score: number; // 0 - 100
  evidence: string;
  projectCount: number;
  hasWorkingLinks: boolean;
  linksFound: string[];
  complexitySignals: string[];
  impactSignals: string[];
  tutorialFlags: string[];
}

export interface ProductionExperienceAudit {
  score: number; // 0 - 100
  evidence: string;
  roleCount: number;
  productionKeywordsFound: string[];
  tenureSignals: string[];
  productionRatio: number; // 0 - 1
  isProductionHeavy: boolean;
}

export interface AtsScoreReport {
  overallScore: number;
  breakdown: {
    hardSkillsScore: number;
    experienceRelevanceScore: number;
    softSkillsScore: number;
    formattingScore: number;
    starImpactScore?: number;
    actionVerbVitalityScore?: number;
    selfProjectsScore?: number;
    productionExperienceScore?: number;
  };
  totalKeywords: number;
  matchedKeywordsCount: number;
  missingKeywordsCount: number;
  keywords: KeywordMatch[];
  improvementSuggestions: string[];
  summaryFeedback: string;
  actionVerbStrength?: {
    strongCount: number;
    weakCount: number;
    weakVerbsFound: string[];
  };
  quantificationStats?: {
    quantifiedBullets: number;
    totalBullets: number;
    percentage: number;
  };
  selfProjectsAudit?: SelfProjectsAudit;
  productionExperienceAudit?: ProductionExperienceAudit;
  layoutReport?: LayoutAuditReport;
}

export interface DocumentLayoutInfo {
  title: string;
  hasTables: boolean;
  tableCount: number;
  tables: Array<{
    rows: number;
    columns: number;
    startIndex: number;
    endIndex: number;
  }>;
  sectionStyle?: {
    columnCount: number;
    marginTop?: number;
    marginBottom?: number;
    marginLeft?: number;
    marginRight?: number;
  };
  namedStyles?: any;
  lists?: any;
}

export interface StructuralParagraphStyle {
  namedStyleType?: string; // 'NORMAL_TEXT', 'HEADING_1', 'HEADING_2', 'TITLE', etc.
  alignment?: 'START' | 'CENTER' | 'END' | 'JUSTIFIED';
  spaceBefore?: number;
  spaceAfter?: number;
  indentStart?: number;
  indentFirstLine?: number;
  lineSpacing?: number;
  bullet?: {
    listId: string;
    nestingLevel?: number;
    glyphType?: string;
  };
}

export interface StructuralRunStyle {
  fontFamily?: string;
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  foregroundColor?: string;
  startIndex: number;
  endIndex: number;
  content: string;
}

export interface StructuralParagraph {
  rawText: string;
  trimmedText: string;
  normalizedText: string;
  sanitizedText: string;
  startIndex: number;
  endIndex: number;
  textStartIndex: number;
  textEndIndex: number;
  hasNativeBullet: boolean;
  hasVisualBullet: boolean;
  bulletPrefix?: string;
  paragraphStyle?: StructuralParagraphStyle;
  runs?: StructuralRunStyle[];
  isInTable?: boolean;
}

export interface PageVisualSnapshot {
  pageNumber: number;
  dataUrl: string;
  width: number;
  height: number;
}

export interface VisualLayoutIssue {
  id: string;
  category: 'visual_crowding' | 'page_overflow' | 'whitespace_rhythm' | 'section_imbalance' | 'visual_polish';
  severity: 'critical' | 'warning' | 'info';
  sectionName: string; // e.g. 'EXPERIENCE', 'EDUCATION', 'HEADER', 'SKILLS', 'PROJECTS', 'GLOBAL'
  title: string;
  description: string;
  visualObservation: string;
  impact: string;
  matchedParagraphStartIndex?: number;
  matchedParagraphEndIndex?: number;
  suggestedFix?: {
    actionLabel: string;
    batchUpdateRequests: any[];
  };
  status: 'pending' | 'accepted' | 'dismissed';
}

export interface VisualLayoutReport {
  visualPolishScore: number; // 0 - 100
  pageCount: number;
  pageFillAssessment: 'optimal_single_page' | 'underfilled' | 'awkward_overflow' | 'multi_page_balanced';
  pageFillDescription: string;
  issues: VisualLayoutIssue[];
  snapshots: PageVisualSnapshot[];
  overallSummary: string;
}

export interface LayoutIssue {
  id: string;
  category:
    | 'table_risk'
    | 'multicolumn_risk'
    | 'font_inconsistency'
    | 'spacing_drift'
    | 'bullet_inconsistency'
    | 'manual_tab_alignment'
    | 'visual_crowding'
    | 'page_overflow'
    | 'whitespace_rhythm'
    | 'section_imbalance'
    | 'visual_polish'
    | 'widow_line'
    | 'typography_hierarchy'
    | 'margin_extremes'
    | 'contact_header_bloat'
    | 'bold_density'
    | 'section_volume_bloat';
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  impact: string;
  sectionName?: string;
  visualObservation?: string;
  affectedStartIndex?: number;
  affectedEndIndex?: number;
  affectedText?: string;
  fixTier?: 'safe_styling' | 'content_generating';
  proposedReplacementText?: string;
  suggestedFix?: {
    actionLabel: string;
    batchUpdateRequests: any[];
  };
  status: 'pending' | 'accepted' | 'dismissed';
}

export interface LayoutAuditReport {
  overallScore: number;
  isSingleColumnStandard: boolean;
  hasTables: boolean;
  tableCount: number;
  hasMultiColumn: boolean;
  columnCount: number;
  fontConsistencyScore: number;
  spacingConsistencyScore: number;
  visualPolishScore?: number;
  visualReport?: VisualLayoutReport;
  issues: LayoutIssue[];
  summary: string;
}

export interface ResumeBullet {
  id: string;
  section: string;
  organization: string;
  role: string;
  originalText: string;
  prefix?: string;
  startIndex?: number;
  endIndex?: number;
}

export interface LineBudgetInfo {
  originalChars: number;
  tailoredChars: number;
  originalLines: number;
  tailoredLines: number;
  maxLineBudgetChars: number;
  fitsOriginalLineBudget: boolean;
  budgetStatus: 'exact_fit' | 'fits_comfortably' | 'approaching_limit' | 'exceeds_budget';
  spilloverRisk: 'none' | 'low' | 'high';
}

export interface TailoredBulletDiff {
  id: string;
  section: string;
  organization: string;
  role: string;
  originalText: string;
  tailoredText: string;
  prefix?: string;
  injectedKeywords: string[];
  rationale: string;
  charCountDiff: number;
  scoreGain?: number;
  starAnalysis?: {
    situationTask?: string;
    action?: string;
    resultMetric?: string;
  };
  variations?: {
    highImpact?: string;
    technicalDepth?: string;
    leadership?: string;
  };
  lineBudget?: LineBudgetInfo;
  status: 'pending' | 'accepted' | 'rejected';
}

export interface TailorResumeResponse {
  jobId?: string;
  jobTitle: string;
  company: string;
  atsReport: AtsScoreReport;
  projectedNewScore: number;
  bulletDiffs: TailoredBulletDiff[];
  layoutIssues?: LayoutIssue[];
  optimizedSummary?: string;
  archetype?: {
    archetype: string;
    label: string;
    badge: string;
    description: string;
    narrativeDirective: string;
    keyThemes: string[];
  };
  documentSummary?: string;
  tokenCostInfo?: {
    tokenCount: number;
    estimatedCostUsd: number;
    fromCache: boolean;
  };
  detectedJobIntel?: {
    seniorityLevel?: string;
    topHardSkills?: string[];
    topTools?: string[];
    missingCriticalCount?: number;
  };
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
  tags?: string[];
  salary?: string;
  updatedAt: string;
}

export interface ScrapedJobData {
  title: string;
  company: string;
  location?: string;
  description: string;
  url: string;
  source: 'LinkedIn' | 'Greenhouse' | 'Lever' | 'Workday' | 'Indeed' | 'Handshake' | 'Ashby' | 'WorkAtAStartup' | 'ZipRecruiter' | 'Glassdoor' | 'CuratedFeed' | 'SimplifyJobs' | 'Custom';
  salary?: string;
  employmentType?: string;
  seniorityLevel?: string;
  extractedSkills?: string[];
  coreResponsibilities?: string[];
  requiredQualifications?: string[];
}

export interface MascotNotification {
  id: string;
  type: 'NEW_JOBS_ALERT' | 'ATS_TIP' | 'CONTEXT_ALERT' | 'PRO_TIP' | 'FOLLOW_UP';
  badge: string;
  title: string;
  body: string;
  ctaText: string;
  targetTab: 'discovery' | 'match' | 'tracker';
  autoScan?: boolean;
  count?: number;
  companies?: string[];
  timestamp: number;
}

export interface MascotState {
  isMinimized: boolean;
  position: { x: number; y: number } | null;
  hasInteracted: boolean;
  activeTipIndex: number;
  lastNotificationSeenAt?: number;
}
