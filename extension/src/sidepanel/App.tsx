import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar.js';
import { MatchTailorTab } from './components/MatchTailorTab.js';
import { DiscoveryTab } from './components/DiscoveryTab.js';
import { TrackerTab } from './components/TrackerTab.js';
import { SettingsTab } from './components/SettingsTab.js';
import { AtsScorerService } from '../services/ats-scorer.js';
import { LlmTailorService } from '../services/llm-tailor.js';
import { AiTailorService, getAiSettings } from '../services/ai-tailor.js';
import { GoogleDocsService } from '../services/google-docs.js';
import { GoogleDriveService } from '../services/google-drive.js';
import { GitHubTrackerService, SEED_INTERNSHIP_DATABASE, enrichJobDetails } from '../services/github-tracker.js';
import { ResumeParserService, ParsedResume } from '../services/resume-parser.js';
import { 
  getStoredApplications, 
  saveStoredApplications, 
  getStoredSettings, 
  getGoogleAccessToken, 
  refreshGoogleAccessToken 
} from '../services/storage.js';
import { 
  JobPosting, 
  ScrapedJobData, 
  TailorResumeResponse, 
  TailoredBulletDiff, 
  ApplicationRecord,
  LayoutIssue,
  DocumentLayoutInfo,
  StructuralParagraph
} from '../types/index.js';
import { extractDocumentLayoutInfo } from '../services/google-docs.js';

import { PrecisionExtractor, extractGoogleDocId } from '../services/precision-extractor.js';
import { CdpDocsEditorService } from '../services/cdp-docs-editor.js';
import { LayoutAnalyzerService } from '../services/layout-analyzer.js';

const atsScorer = new AtsScorerService();
const llmTailor = new LlmTailorService();
const aiTailor = new AiTailorService();
const googleDocs = new GoogleDocsService();
const googleDrive = new GoogleDriveService();
const githubTracker = new GitHubTrackerService();
const resumeParser = new ResumeParserService();
const precisionExtractor = new PrecisionExtractor();
const cdpEditor = new CdpDocsEditorService();
const layoutAnalyzer = new LayoutAnalyzerService();

const DEFAULT_JOB: ScrapedJobData = {
  title: 'Software Engineering Intern — Summer 2026',
  company: 'Stripe',
  location: 'San Francisco, CA (Hybrid)',
  description: 'We are looking for Software Engineering Interns to join our infrastructure and API teams. You will write high-performance Go, Python, and TypeScript code, design scalable REST APIs with PostgreSQL, and automate CI/CD pipelines with Docker and Kubernetes.',
  url: 'https://stripe.com/jobs/search?q=intern',
  source: 'LinkedIn'
};

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'match' | 'discovery' | 'tracker' | 'settings'>('match');
  const [currentJob, setCurrentJob] = useState<ScrapedJobData>(DEFAULT_JOB);
  const [tailorData, setTailorData] = useState<TailorResumeResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [jobs, setJobs] = useState<JobPosting[]>(SEED_INTERNSHIP_DATABASE);
  const [isSyncingGitHub, setIsSyncingGitHub] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const [newJobsCount, setNewJobsCount] = useState<number>(0);
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);

  // User's Real Scanned Resume State
  const [screenResume, setScreenResume] = useState<{ title: string; fullText: string; isGoogleDoc?: boolean; url?: string } | null>(null);
  const [parsedResume, setParsedResume] = useState<ParsedResume | null>(null);

  const [appliedStatus, setAppliedStatus] = useState<string | null>(null);
  const [forkedDocUrl, setForkedDocUrl] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  useEffect(() => {
    getStoredApplications().then(apps => setApplications(apps));

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(
        ['resumehack_github_jobs', 'user_custom_resume', 'activeScreenResume', 'resumehack_last_sync_at', 'resumehack_new_jobs_count', 'resumehack_active_tab', 'resumehack_auto_scan'],
        (result) => {
          if (result.resumehack_active_tab) {
            setActiveTab(result.resumehack_active_tab);
            chrome.storage.local.remove(['resumehack_active_tab']);
          }
          if (result.resumehack_auto_scan) {
            chrome.storage.local.remove(['resumehack_auto_scan']);
            setTimeout(() => handleReadScreenNow(), 300);
          }
          if (result.resumehack_github_jobs && Array.isArray(result.resumehack_github_jobs)) {
            const enrichedList = result.resumehack_github_jobs.map((j: JobPosting) => enrichJobDetails(j));
            setJobs(enrichedList);
          } else {
            setJobs(SEED_INTERNSHIP_DATABASE);
          }
          if (result.resumehack_last_sync_at) setLastSyncAt(result.resumehack_last_sync_at);
          if (result.resumehack_new_jobs_count) setNewJobsCount(result.resumehack_new_jobs_count);
          if (result.activeScreenResume) {
            setScreenResume(result.activeScreenResume);
            setParsedResume(resumeParser.parse(result.activeScreenResume.fullText));
          } else if (result.user_custom_resume) {
            setScreenResume({ title: 'My Saved Resume', fullText: result.user_custom_resume, isGoogleDoc: false });
            setParsedResume(resumeParser.parse(result.user_custom_resume));
          }
        }
      );

      // Listen for interactive changes made on the Google Docs screen dock
      const messageListener = (msg: any) => {
        if ((msg.type === 'IN_DOC_DIFF_STATUS_CHANGED' || msg.type === 'IN_DOC_STATUS_CHANGED') && (msg.payload?.diffs || msg.data?.diffs)) {
          const updatedDiffs = msg.payload?.diffs || msg.data?.diffs;
          setTailorData((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              bulletDiffs: updatedDiffs,
            };
          });
        } else if (msg.type === 'IN_DOC_APPLY_CLICKED' && msg.data?.acceptedDiffs) {
          setTailorData((prev) => {
            if (!prev) return prev;
            const appliedIds = new Set(msg.data.acceptedDiffs.map((d: any) => d.id));
            return {
              ...prev,
              bulletDiffs: prev.bulletDiffs.map(d => 
                appliedIds.has(d.id) ? { ...d, status: 'accepted' } : d
              ),
            };
          });
        }
      };

      const storageListener = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
        if (areaName === 'local' && changes.resumehack_latest_tailor_data?.newValue?.diffs) {
          const updatedDiffs = changes.resumehack_latest_tailor_data.newValue.diffs;
          setTailorData((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              bulletDiffs: updatedDiffs,
            };
          });
        }
      };

      chrome.runtime.onMessage.addListener(messageListener);
      if (chrome.storage?.onChanged) {
        chrome.storage.onChanged.addListener(storageListener);
      }
      return () => {
        chrome.runtime.onMessage.removeListener(messageListener);
        if (chrome.storage?.onChanged) {
          chrome.storage.onChanged.removeListener(storageListener);
        }
      };
    }
  }, []);

  const handleUpdateCustomResumeText = (text: string) => {
    const parsed = resumeParser.parse(text);
    setParsedResume(parsed);
    setScreenResume({
      title: parsed.candidateName !== 'Your Resume' ? `${parsed.candidateName} Resume` : 'My Custom Resume',
      fullText: text,
      isGoogleDoc: screenResume?.isGoogleDoc || false
    });

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ user_custom_resume: text });
    }
  };

  const handleSyncGitHub = async () => {
    setIsSyncingGitHub(true);
    setSyncMessage(null);
    try {
      const res = await githubTracker.syncFromGitHub();
      if (res.success) {
        setJobs(res.jobs);
        setLastSyncAt(res.syncedAt);
        setNewJobsCount(res.newJobsCount);
        setSyncMessage(
          res.newJobsCount > 0
            ? `✨ ${res.newJobsCount} new openings + ${res.jobsCount} total synced from GitHub!`
            : `Synced ${res.jobsCount} live openings — no new roles since last check.`
        );
        setTimeout(() => setSyncMessage(null), 5000);
      }
    } catch (e: any) {
      console.error('[ResumeHack] GitHub sync error:', e);
      setSyncMessage('⚠️ Sync failed — check your connection and try again.');
      setTimeout(() => setSyncMessage(null), 4000);
    } finally {
      setIsSyncingGitHub(false);
    }
  };

  // Clear new-jobs badge when user opens Discovery tab
  const handleDiscoveryTabOpen = () => {
    setActiveTab('discovery');
    if (newJobsCount > 0) {
      setNewJobsCount(0);
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.sendMessage({ type: 'DISCOVERY_VIEWED' }).catch(() => {});
      }
    }
  };

  // Precision Resume Extractor — multi-strategy engine with quality scoring
  // Runs mobilebasic fetch + DOM strategies in parallel, picks the best result
  const handleReadScreenNow = async () => {
    if (typeof chrome === 'undefined' || !chrome.tabs) {
      setAppliedStatus('📸 Screen reader unavailable (Dev Mode).');
      setTimeout(() => setAppliedStatus(null), 3000);
      return;
    }
    try {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!activeTab?.id || !activeTab.url) {
        setAppliedStatus('⚠️ Click into your resume tab first, then try again.');
        setTimeout(() => setAppliedStatus(null), 4000);
        return;
      }

      setAppliedStatus('🔍 Scanning resume — trying all extraction strategies...');

      const result = await precisionExtractor.extract(activeTab.id, activeTab.url);

      if (!result.text || result.wordCount < 15) {
        setAppliedStatus('⚠️ Could not extract text. Make sure your resume is open and fully loaded.');
        setTimeout(() => setAppliedStatus(null), 5000);
        return;
      }

      // Parse the best-quality extracted text
      const parsed = resumeParser.parse(result.text, result.qualityScore, result.strategyUsed);

      // Persist to state + storage
      const screenData = {
        title: result.title,
        fullText: result.text,
        isGoogleDoc: result.platform === 'google-docs',
        url: result.url,
      };
      setScreenResume(screenData);
      setParsedResume(parsed);
      chrome.storage.local.set({ activeScreenResume: screenData });

      // Quality indicator emoji
      const qualityEmoji = result.qualityScore >= 80 ? '✅' : result.qualityScore >= 50 ? '⚡' : '⚠️';
      const strategyLabel: Record<string, string> = {
        'mobilebasic': 'mobilebasic (highest accuracy)',
        'accessibility-tree': 'accessibility tree',
        'keyboard-select': 'keyboard select',
        'leaf-span': 'DOM leaf-span',
        'notion-blocks': 'Notion blocks',
        'word-canvas': 'Word canvas',
        'pdf-textlayer': 'PDF text layer',
        'html-semantic': 'HTML semantic',
      };

      setAppliedStatus(
        `${qualityEmoji} ${result.wordCount.toLocaleString()} words · Quality ${result.qualityScore}% · ${strategyLabel[result.strategyUsed] ?? result.strategyUsed} · ${parsed.bullets.length} bullets`
      );
      setTimeout(() => setAppliedStatus(null), 7000);

    } catch (err: any) {
      console.error('[ResumeHack] Precision scan error:', err);
      const msg = err?.message || '';
      setAppliedStatus(
        msg.includes('Cannot access') || msg.includes('chrome://')
          ? '⚠️ Cannot access this tab. Open your resume in Google Docs or any regular page.'
          : `⚠️ ${msg || 'Scan failed — refresh the resume tab and try again.'}`
      );
      setTimeout(() => setAppliedStatus(null), 6000);
    }
  };

  // Rock-Solid On-Demand Universal Job Scraper via chrome.scripting.executeScript
  const handleScrapeJobFromCurrentTab = async () => {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      try {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!activeTab || !activeTab.id) {
          setAppliedStatus('⚠️ Please focus your job posting tab first.');
          return;
        }

        if (chrome.scripting && chrome.scripting.executeScript) {
          const results = await chrome.scripting.executeScript({
            target: { tabId: activeTab.id },
            func: () => {
              const url = window.location.href;
              let title = '';
              let company = '';
              let description = '';
              let location = '';
              let salary = '';
              let employmentType = '';
              let source: any = 'Custom';

              // 1. Try JSON-LD JobPosting schema first
              try {
                const scripts = document.querySelectorAll('script[type="application/ld+json"]');
                for (const s of Array.from(scripts)) {
                  try {
                    const data = JSON.parse(s.textContent || '');
                    const item = Array.isArray(data) ? data.find((d: any) => d['@type'] === 'JobPosting') : (data['@type'] === 'JobPosting' ? data : null);
                    if (item) {
                      title = item.title || item.name || '';
                      company = item.hiringOrganization?.name || '';
                      const rawDesc = item.description || '';
                      const tempDiv = document.createElement('div');
                      tempDiv.innerHTML = rawDesc;
                      description = tempDiv.textContent?.trim() || rawDesc;
                      if (item.jobLocation?.address) {
                        const addr = item.jobLocation.address;
                        location = [addr.addressLocality, addr.addressRegion, addr.addressCountry].filter(Boolean).join(', ');
                      }
                      break;
                    }
                  } catch {}
                }
              } catch {}

              // 2. Specific Platform Selectors
              if (url.includes('linkedin.com')) {
                source = 'LinkedIn';
                if (!title) {
                  title = document.querySelector(
                    '.job-details-jobs-unified-top-card__job-title, .jobs-unified-top-card__job-title, .top-card-layout__title, .jobs-details__main-content h1'
                  )?.textContent?.trim() || '';
                }
                if (!company) {
                  company = document.querySelector(
                    '.job-details-jobs-unified-top-card__company-name, .jobs-unified-top-card__company-name, .topcard__flavor--black-link'
                  )?.textContent?.trim() || '';
                }
                if (!description) {
                  description = document.querySelector(
                    '#job-details, .jobs-description__content, .show-more-less-html__markup'
                  )?.textContent?.trim() || '';
                }
              } else if (url.includes('greenhouse.io') || url.includes('job-boards.greenhouse.io')) {
                source = 'Greenhouse';
                if (!title) title = document.querySelector('.app-title, h1.heading, .job-title')?.textContent?.trim() || '';
                if (!company) company = document.querySelector('.company-name, .logo-container img')?.getAttribute('alt') || document.querySelector('.company-name')?.textContent?.trim() || '';
                if (!description) description = document.querySelector('#content, #main, .body, [id*="content"]')?.textContent?.trim() || '';
              } else if (url.includes('lever.co')) {
                source = 'Lever';
                if (!title) title = document.querySelector('.posting-headline h2, h2.posting-headline')?.textContent?.trim() || '';
                if (!company) company = document.querySelector('.main-header-logo img')?.getAttribute('alt') || '';
                if (!description) description = document.querySelector('.posting-description, [data-qa="job-description"]')?.textContent?.trim() || '';
              } else if (url.includes('myworkdayjobs.com') || url.includes('myworkday.com')) {
                source = 'Workday';
                if (!title) title = document.querySelector('[data-automation-id="jobPostingHeader"], h2[data-automation-id="jobTitle"]')?.textContent?.trim() || '';
                if (!company) company = document.querySelector('[data-automation-id="companyName"]')?.textContent?.trim() || '';
                if (!description) description = document.querySelector('[data-automation-id="jobPostingDescription"]')?.textContent?.trim() || '';
              } else if (url.includes('indeed.com')) {
                source = 'Indeed';
                if (!title) title = document.querySelector('.jobsearch-JobInfoHeader-title, h1[data-testid="jobsearch-JobInfoHeader-title"]')?.textContent?.trim() || '';
                if (!company) company = document.querySelector('[data-testid="inlineHeader-companyName"]')?.textContent?.trim() || '';
                if (!description) description = document.querySelector('#jobDescriptionText')?.textContent?.trim() || '';
              } else if (url.includes('ashbyhq.com')) {
                source = 'Ashby';
                if (!title) title = document.querySelector('h1, [class*="JobPosting_heading"]')?.textContent?.trim() || '';
                if (!company) company = document.querySelector('[class*="JobPosting_company"]')?.textContent?.trim() || '';
                if (!description) description = document.querySelector('[class*="JobPosting_body"]')?.textContent?.trim() || '';
              } else if (url.includes('workatastartup.com') || url.includes('ycombinator.com')) {
                source = 'WorkAtAStartup';
                if (!title) title = document.querySelector('.job-title, h1.text-xl')?.textContent?.trim() || '';
                if (!company) company = document.querySelector('.company-name')?.textContent?.trim() || '';
                if (!description) description = document.querySelector('.job-description, .prose')?.textContent?.trim() || '';
              }

              // 3. Heuristic Fallbacks
              if (!title) title = document.querySelector('h1')?.textContent?.trim() || document.title.split(/[-–|]/)[0]?.trim() || 'Target Job Opening';
              if (!company) {
                const titleParts = document.title.split(/[-–|]/);
                company = titleParts.length > 1 ? titleParts[1].trim() : 'Hiring Company';
              }
              if (!description) {
                const article = document.querySelector('article, main, #content, [role="main"]');
                description = (article ? article.textContent : document.body.innerText).slice(0, 8000).trim();
              }

              if (description.length < 40) return null;

              // 4. Semantic Extraction
              const normDesc = description.toLowerCase();
              let seniorityLevel = 'Mid-Level';
              if (/intern|internship|co-op/i.test(title) || /intern|internship/i.test(normDesc.slice(0, 300))) {
                seniorityLevel = 'Internship';
              } else if (/new grad|entry level|associate|junior/i.test(title) || /0-2 years|new grad/i.test(normDesc)) {
                seniorityLevel = 'Entry / New Grad';
              } else if (/senior|sr\.|lead|principal|staff|architect/i.test(title)) {
                seniorityLevel = 'Senior+';
              }

              const techDictionary = [
                'Python', 'TypeScript', 'JavaScript', 'Java', 'C++', 'Go', 'Golang', 'Rust', 'SQL',
                'React', 'Next.js', 'Vue', 'Angular', 'Node.js', 'Express', 'Django', 'FastAPI',
                'PostgreSQL', 'MongoDB', 'Redis', 'Kafka', 'AWS', 'GCP', 'Azure', 'Docker',
                'Kubernetes', 'CI/CD', 'GraphQL', 'REST API', 'Microservices', 'PyTorch', 'TensorFlow',
                'Machine Learning', 'LLM', 'System Design', 'Git'
              ];
              const extractedSkills: string[] = [];
              for (const kw of techDictionary) {
                if (new RegExp(`\\b${kw.replace('+', '\\+')}\\b`, 'i').test(description)) {
                  extractedSkills.push(kw);
                }
              }

              return {
                title: title || 'Job Opening',
                company: company || 'Company',
                description,
                location: location || undefined,
                salary: salary || undefined,
                employmentType: employmentType || undefined,
                seniorityLevel,
                extractedSkills: extractedSkills.slice(0, 10),
                source,
                url
              };
            }
          });

          const jobData = results[0]?.result;
          if (jobData && jobData.title) {
            setCurrentJob(jobData);
            setTailorData(null);
            setAppliedStatus(`🎯 Loaded job: ${jobData.title} at ${jobData.company} (${jobData.seniorityLevel || 'Role'})!`);
            setTimeout(() => setAppliedStatus(null), 3000);
            return;
          }
        }

        setAppliedStatus('⚠️ Could not find a job description on this page.');
        setTimeout(() => setAppliedStatus(null), 3000);
      } catch (err: any) {
        console.error('Job scrape error:', err);
        setAppliedStatus(`⚠️ Error reading job tab: ${err.message || 'Try clicking on the job tab first.'}`);
        setTimeout(() => setAppliedStatus(null), 4000);
      }
    }
  };

  // 1. Job-Specific Tailoring
  const handleTriggerTailor = async () => {
    setIsLoading(true);
    setAppliedStatus(null);
    setForkedDocUrl(null);
    setPdfUrl(null);

    try {
      let resumeText = screenResume?.fullText || parsedResume?.rawText || '';

      // Auto-extract from active tab if not loaded yet
      if (!resumeText || resumeText.length < 20) {
        if (typeof chrome !== 'undefined' && chrome.tabs) {
          try {
            const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (activeTab?.id && activeTab.url) {
              const result = await precisionExtractor.extract(activeTab.id, activeTab.url);
              if (result?.text && result.text.length > 20) {
                resumeText = result.text;
                const parsed = resumeParser.parse(result.text, result.qualityScore, result.strategyUsed);
                const screenData = {
                  title: result.title,
                  fullText: result.text,
                  isGoogleDoc: result.platform === 'google-docs',
                  url: result.url,
                };
                setScreenResume(screenData);
                setParsedResume(parsed);
                chrome.storage.local.set({ activeScreenResume: screenData });
              }
            }
          } catch { /* proceed to fallback */ }
        }
      }

      // If still empty (e.g. fresh page or initial load), load mock master resume
      if (!resumeText || resumeText.length < 20) {
        const mock = googleDocs.getMockMasterResume();
        resumeText = mock.fullText;
        const parsed = resumeParser.parse(mock.fullText);
        const screenData = { title: mock.title, fullText: mock.fullText, isGoogleDoc: true };
        setScreenResume(screenData);
        setParsedResume(parsed);
      }

      let layoutInfo: DocumentLayoutInfo | undefined;
      let structuralParagraphs: StructuralParagraph[] | undefined;

      const activeDocId = screenResume?.url ? extractGoogleDocId(screenResume.url) : null;
      if (activeDocId) {
        try {
          const { doc, paragraphs } = await googleDocs.fetchStructuralDocument(activeDocId);
          structuralParagraphs = paragraphs;
          layoutInfo = extractDocumentLayoutInfo(doc);
        } catch (layoutErr) {
          console.debug('[ResumeHack] Layout fetch note:', layoutErr);
        }
      }

      const atsReport = atsScorer.analyze(resumeText, currentJob.description, layoutInfo, structuralParagraphs);

      // Attempt visual layout snapshot analysis via backend if activeDocId is present
      if (activeDocId && atsReport.layoutReport) {
        try {
          const token = await googleDocs.getAuthToken();
          const visRes = await fetch('http://localhost:3001/api/visual-layout/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              documentId: activeDocId,
              accessToken: token,
              structuralParagraphs,
              layoutInfo,
              jobDescription: currentJob.description,
              domain: currentJob.title || 'Software Engineering',
              aiSettings: await getAiSettings(),
            }),
          });
          if (visRes.ok) {
            const visualReport = await visRes.json();
            if (visualReport && atsReport.layoutReport) {
              atsReport.layoutReport = layoutAnalyzer.mergeVisualReport(atsReport.layoutReport, visualReport);
              atsReport.breakdown.formattingScore = atsReport.layoutReport.overallScore;
            }
          }
        } catch (visErr) {
          console.debug('[ResumeHack] Visual layout backend analysis note:', visErr);
        }
      }

      const currentParsed = parsedResume || resumeParser.parse(resumeText);
      const userBullets = currentParsed.bullets.length > 0 ? currentParsed.bullets : [
        {
          id: 'b-1',
          section: 'Experience',
          organization: 'Relevant Experience',
          role: 'Candidate',
          originalText: resumeText.slice(0, 180)
        }
      ];

      // ── Try AI-powered generation first ──────────────────────────────────────
      let bulletDiffs: TailoredBulletDiff[];
      let aiModelUsed: string | undefined;

      const storedSettings = await getStoredSettings();
      const aiSettings = await getAiSettings();
      if (aiSettings && (aiSettings.apiKey || aiSettings.provider === 'ollama')) {
        aiSettings.strictAntiHallucination = storedSettings.strictAntiHallucination;
        setAppliedStatus(`🤖 Generating AI-powered suggestions with ${aiSettings.provider}…`);
        const aiResult = await aiTailor.tailorBulletsWithAi(
          userBullets,
          currentJob.description,
          atsReport,
          currentJob.title,
          currentJob.company,
          aiSettings,
          {
            seniorityLevel: currentJob.seniorityLevel,
            extractedSkills: currentJob.extractedSkills,
          }
        );

        if (aiResult.usedAi && aiResult.diffs.length > 0) {
          bulletDiffs = aiResult.diffs;
          aiModelUsed = aiResult.model;
        } else {
          // AI failed or returned no results — fall back to rule-based
          console.warn('[ResumeHack] AI generation note:', aiResult.error);
          bulletDiffs = llmTailor.tailorBullets(
            userBullets, currentJob.description, atsReport, currentJob.title, currentJob.company
          );
        }
      } else {
        // No AI key configured — use rule-based tailoring
        bulletDiffs = llmTailor.tailorBullets(
          userBullets, currentJob.description, atsReport, currentJob.title, currentJob.company
        );
      }
      // ─────────────────────────────────────────────────────────────────────────

      const projectedNewScore = Math.min(98, Math.round(atsReport.overallScore + 18));

      const response: TailorResumeResponse = {
        jobTitle: currentJob.title,
        company: currentJob.company,
        atsReport,
        projectedNewScore,
        bulletDiffs,
        detectedJobIntel: {
          seniorityLevel: currentJob.seniorityLevel,
          topHardSkills: currentJob.extractedSkills,
          missingCriticalCount: atsReport.keywords.filter(k => !k.foundInResume && k.importance === 'Critical').length
        },
        optimizedSummary: aiModelUsed
          ? `AI-tailored for ${currentJob.title} at ${currentJob.company} using ${aiModelUsed}. ${bulletDiffs.length} bullets optimized.`
          : `Tailored for ${currentJob.title} at ${currentJob.company} highlighting ${atsReport.keywords.filter(k => k.foundInResume).slice(0, 3).map(k => k.keyword).join(', ')}.`
      };

      setTimeout(() => {
        setTailorData(response);
        setIsLoading(false);
        setAppliedStatus(aiModelUsed ? `✨ ${bulletDiffs.length} STAR suggestions generated with ${aiModelUsed}!` : `✨ ${bulletDiffs.length} STAR suggestions generated!`);
        if (aiModelUsed) setTimeout(() => setAppliedStatus(null), 5000);
        
        // Broadcast live STAR suggestions directly to the Google Docs suggestion sidebar
        broadcastDiffsToActiveTab(bulletDiffs, currentJob.title, currentJob.company, projectedNewScore, atsReport.overallScore);

        // Proactively warm up CDP debugger for the active Google Doc tab
        if (typeof chrome !== 'undefined' && chrome.tabs) {
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const activeTab = tabs[0];
            if (activeTab?.id && activeTab.url?.includes('docs.google.com/document/d/')) {
              chrome.runtime.sendMessage({ type: 'CDP_WARM_ATTACH', tabId: activeTab.id }).catch(() => {});
            }
          });
        }
      }, 400);
    } catch (err: any) {
      console.error(err);
      setIsLoading(false);
      setAppliedStatus(null);
      alert('Error tailoring resume: ' + err.message);
    }
  };

  // 2. General Master Resume ATS & STAR Optimizer (Universal)
  const handleTriggerGeneralAtsOptimize = async (domain: string) => {
    setIsLoading(true);
    setAppliedStatus(null);
    setForkedDocUrl(null);
    setPdfUrl(null);

    try {
      let resumeText = screenResume?.fullText || parsedResume?.rawText || '';

      if (!resumeText || resumeText.length < 20) {
        if (typeof chrome !== 'undefined' && chrome.tabs) {
          try {
            const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (activeTab?.id && activeTab.url) {
              const result = await precisionExtractor.extract(activeTab.id, activeTab.url);
              if (result?.text && result.text.length > 20) {
                resumeText = result.text;
                const parsed = resumeParser.parse(result.text, result.qualityScore, result.strategyUsed);
                const screenData = {
                  title: result.title,
                  fullText: result.text,
                  isGoogleDoc: result.platform === 'google-docs',
                  url: result.url,
                };
                setScreenResume(screenData);
                setParsedResume(parsed);
                chrome.storage.local.set({ activeScreenResume: screenData });
              }
            }
          } catch { /* proceed to fallback */ }
        }
      }

      if (!resumeText || resumeText.length < 20) {
        const mock = googleDocs.getMockMasterResume();
        resumeText = mock.fullText;
        const parsed = resumeParser.parse(mock.fullText);
        const screenData = { title: mock.title, fullText: mock.fullText, isGoogleDoc: true };
        setScreenResume(screenData);
        setParsedResume(parsed);
      }

      let layoutInfo: DocumentLayoutInfo | undefined;
      let structuralParagraphs: StructuralParagraph[] | undefined;

      const activeDocId = screenResume?.url ? extractGoogleDocId(screenResume.url) : null;
      if (activeDocId) {
        try {
          const { doc, paragraphs } = await googleDocs.fetchStructuralDocument(activeDocId);
          structuralParagraphs = paragraphs;
          layoutInfo = extractDocumentLayoutInfo(doc);
        } catch (layoutErr) {
          console.debug('[ResumeHack] Layout fetch note:', layoutErr);
        }
      }

      const atsReport = atsScorer.auditGeneralAts(resumeText, domain, layoutInfo, structuralParagraphs);

      // Attempt visual layout snapshot analysis via backend if activeDocId is present
      if (activeDocId && atsReport.layoutReport) {
        try {
          const token = await googleDocs.getAuthToken();
          const visRes = await fetch('http://localhost:3001/api/visual-layout/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              documentId: activeDocId,
              accessToken: token,
              structuralParagraphs,
              layoutInfo,
              domain,
              aiSettings: await getAiSettings(),
            }),
          });
          if (visRes.ok) {
            const visualReport = await visRes.json();
            if (visualReport && atsReport.layoutReport) {
              atsReport.layoutReport = layoutAnalyzer.mergeVisualReport(atsReport.layoutReport, visualReport);
              atsReport.breakdown.formattingScore = atsReport.layoutReport.overallScore;
            }
          }
        } catch (visErr) {
          console.debug('[ResumeHack] Universal visual layout backend analysis note:', visErr);
        }
      }

      const currentParsed = parsedResume || resumeParser.parse(resumeText);
      const userBullets = currentParsed.bullets.length > 0 ? currentParsed.bullets : [
        {
          id: 'b-1',
          section: 'Experience',
          organization: 'Relevant Experience',
          role: 'Candidate',
          originalText: resumeText.slice(0, 180)
        }
      ];

      // ── Check if AI key is available for universal optimization ──────────────
      let bulletDiffs: TailoredBulletDiff[];
      let aiModelUsed: string | undefined;

      const storedSettings = await getStoredSettings();
      const aiSettings = await getAiSettings();
      if (aiSettings && (aiSettings.apiKey || aiSettings.provider === 'ollama')) {
        aiSettings.strictAntiHallucination = storedSettings.strictAntiHallucination;
        setAppliedStatus(`🤖 Elevating bullets to ${domain} standard with ${aiSettings.provider}…`);
        const aiResult = await aiTailor.optimizeUniversalMasterBulletsWithAi(
          userBullets,
          domain,
          aiSettings
        );
        if (aiResult.usedAi && aiResult.diffs.length > 0) {
          bulletDiffs = aiResult.diffs;
          aiModelUsed = aiResult.model;
        } else {
          bulletDiffs = llmTailor.optimizeMasterResumeBullets(userBullets, domain);
        }
      } else {
        bulletDiffs = llmTailor.optimizeMasterResumeBullets(userBullets, domain);
      }
      // ─────────────────────────────────────────────────────────────────────────

      const projectedNewScore = Math.min(99, Math.round(atsReport.overallScore + 16));

      const response: TailorResumeResponse = {
        jobTitle: `${domain} Professional`,
        company: 'Universal ATS Standard',
        atsReport,
        projectedNewScore,
        bulletDiffs,
        optimizedSummary: aiModelUsed
          ? `AI-elevated for ${domain} benchmarks using ${aiModelUsed}. ${bulletDiffs.length} bullets optimized.`
          : `Universal ATS-optimized master resume structured for ${domain} benchmarks with strong STAR action verbs.`
      };

      setTimeout(() => {
        setTailorData(response);
        setIsLoading(false);
        setAppliedStatus(aiModelUsed ? `✨ ${bulletDiffs.length} STAR suggestions elevated with ${aiModelUsed}!` : `✨ ${bulletDiffs.length} STAR suggestions generated!`);
        if (aiModelUsed) setTimeout(() => setAppliedStatus(null), 5000);
        
        // Broadcast live STAR suggestions directly to the Google Docs suggestion sidebar
        broadcastDiffsToActiveTab(bulletDiffs, `${domain} Benchmark`, 'Universal ATS', projectedNewScore, atsReport.overallScore);

        // Proactively warm up CDP debugger for the active Google Doc tab
        if (typeof chrome !== 'undefined' && chrome.tabs) {
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const activeTab = tabs[0];
            if (activeTab?.id && activeTab.url?.includes('docs.google.com/document/d/')) {
              chrome.runtime.sendMessage({ type: 'CDP_WARM_ATTACH', tabId: activeTab.id }).catch(() => {});
            }
          });
        }
      }, 400);
    } catch (err: any) {
      console.error(err);
      setIsLoading(false);
      setAppliedStatus(null);
      alert('Error auditing resume: ' + err.message);
    }
  };

  // Broadcast Red/Green Diffs directly to Google Docs content script overlay
  // Broadcast Red/Green Diffs directly to Google Docs content script overlay
  const broadcastDiffsToActiveTab = async (
    diffs: TailoredBulletDiff[],
    jobTitle: string,
    company: string,
    projectedNewScore?: number,
    originalScore?: number,
    preferredTabId?: number
  ) => {
    if (typeof chrome === 'undefined' || !chrome.tabs) return;
    try {
      const targetDocId = screenResume?.url ? extractGoogleDocId(screenResume.url) : null;

      // 1. Save latest generated diffs and tailor data to storage for persistence across windows
      if (chrome.storage?.local) {
        await chrome.storage.local.set({
          resumehack_latest_diffs: diffs,
          resumehack_latest_tailor_data: {
            jobTitle,
            company,
            projectedNewScore,
            originalScore,
            targetDocId: targetDocId || undefined,
            targetDocUrl: screenResume?.url || undefined,
            diffs,
            timestamp: Date.now()
          }
        }).catch(() => {});
      }

      // 2. Find Google Docs tabs exclusively matching this document
      const tabs = await chrome.tabs.query({});
      let targetTabs = tabs.filter(
        (t) => t.url && t.url.includes('docs.google.com/document/')
      );

      // Strict Doc Scoping: Target ONLY the tab that matches the resume document
      if (preferredTabId) {
        targetTabs = targetTabs.filter((t) => t.id === preferredTabId);
      } else if (targetDocId) {
        const matchingTabs = targetTabs.filter((t) => t.url && t.url.includes(targetDocId));
        if (matchingTabs.length > 0) {
          targetTabs = matchingTabs;
        }
      }

      const msgPayload = {
        type: 'SHOW_IN_DOC_DIFFS',
        payload: {
          jobTitle,
          company,
          projectedNewScore,
          originalScore,
          targetDocId: targetDocId || undefined,
          targetDocUrl: screenResume?.url || undefined,
          diffs,
        },
      };

      for (const tab of targetTabs) {
        if (!tab.id) continue;

        try {
          chrome.tabs.sendMessage(tab.id, msgPayload, (response) => {
            try {
              const hasErr = Boolean(chrome.runtime?.lastError);
              if (hasErr || !response?.success) {
                // If content script wasn't active on tab, inject it directly
                if (chrome.scripting && chrome.scripting.executeScript && tab.id) {
                  chrome.scripting
                    .executeScript({
                      target: { tabId: tab.id },
                      files: ['content-scripts/content_docs.js'],
                    })
                    .then(() => {
                      setTimeout(() => {
                        try {
                          if (tab.id && chrome.tabs?.sendMessage) {
                            chrome.tabs.sendMessage(tab.id, msgPayload).catch(() => {});
                          }
                        } catch {}
                      }, 120);
                    })
                    .catch(() => {});
                }
              }
            } catch {
              // Context invalidated / tab closed
            }
          });
        } catch {
          // Tab communication suppressed
        }
      }

      // 3. Also notify mascot in tabs so Hacky displays a toast/notification
      try {
        if (chrome.runtime?.sendMessage) {
          chrome.runtime.sendMessage({
            type: 'BROADCAST_TO_ALL_TABS',
            payload: {
              type: 'NOTIFY_STAR_SUGGESTIONS',
              count: diffs.length,
              jobTitle,
              company,
              targetDocId: targetDocId || undefined
            }
          }).catch(() => {});
        }
      } catch {}
    } catch (e) {
      console.debug('[ResumeHack] Broadcast error:', e);
    }
  };

  const handleManualShowInDocDiffs = async () => {
    if (!tailorData) {
      setAppliedStatus('⚡ Run ATS Tailoring first to generate STAR bullet suggestions.');
      setTimeout(() => setAppliedStatus(null), 3000);
      return;
    }

    if (typeof chrome === 'undefined' || !chrome.tabs) return;

    try {
      const tabs = await chrome.tabs.query({});
      const targetDocId = screenResume?.url ? extractGoogleDocId(screenResume.url) : null;
      let targetTab = tabs.find(
        (t) =>
          t.url &&
          (t.url.includes('docs.google.com/document') ||
            (targetDocId && t.url.includes(targetDocId)))
      );

      if (!targetTab) {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (activeTab?.url && activeTab.url.includes('docs.google.com/document')) {
          targetTab = activeTab;
        }
      }

      if (targetTab && targetTab.id) {
        // 1. Focus the Google Docs tab
        await chrome.tabs.update(targetTab.id, { active: true });
        if (targetTab.windowId) {
          try {
            await chrome.windows.update(targetTab.windowId, { focused: true });
          } catch {}
        }

        // 2. Broadcast overlay payload and focus command
        const docPayload = {
          jobTitle: tailorData.jobTitle || currentJob.title,
          company: tailorData.company || currentJob.company,
          projectedNewScore: tailorData.projectedNewScore,
          originalScore: tailorData.atsReport?.overallScore,
          targetDocId: targetDocId || undefined,
          targetDocUrl: screenResume?.url || undefined,
          diffs: tailorData.bulletDiffs,
        };

        chrome.tabs.sendMessage(targetTab.id, {
          type: 'SHOW_IN_DOC_DIFFS',
          payload: docPayload,
        }, (res) => {
          if (chrome.runtime?.lastError || !res?.success) {
            if (chrome.scripting && targetTab?.id) {
              chrome.scripting.executeScript({
                target: { tabId: targetTab.id },
                files: ['content-scripts/content_docs.js'],
              }).then(() => {
                setTimeout(() => {
                  if (targetTab?.id) {
                    chrome.tabs.sendMessage(targetTab.id, {
                      type: 'SHOW_IN_DOC_DIFFS',
                      payload: docPayload,
                    }).catch(() => {});
                  }
                }, 150);
              }).catch(() => {});
            }
          }
        });

        chrome.tabs.sendMessage(targetTab.id, {
          type: 'FOCUS_IN_DOC_SUGGESTIONS',
        }).catch(() => {});

        setAppliedStatus('🎯 Opened suggestions in your Google Docs tab!');
        setTimeout(() => setAppliedStatus(null), 3000);
      } else {
        setAppliedStatus('⚠️ Google Docs tab not found. Please open your Google Doc.');
        setTimeout(() => setAppliedStatus(null), 4000);
      }
    } catch (err: any) {
      console.error('[ResumeHack] Error focusing doc tab:', err);
      setAppliedStatus('⚡ Opened suggestion overlay.');
      setTimeout(() => setAppliedStatus(null), 3000);
    }
  };

  const broadcastApplyAcceptedDiffs = async (
    acceptedDiffs: TailoredBulletDiff[],
    preferredTabId?: number
  ): Promise<{ success: boolean; appliedCount?: number }> => {
    if (typeof chrome === 'undefined' || !chrome.tabs) return { success: false };
    const targetDocId = screenResume?.url ? extractGoogleDocId(screenResume.url) : null;
    const msgPayload = {
      type: 'APPLY_ACCEPTED_DIFFS_TO_PAGE',
      payload: {
        diffs: acceptedDiffs,
        acceptedDiffs: acceptedDiffs,
        jobTitle: tailorData?.jobTitle || currentJob.title,
        company: tailorData?.company || currentJob.company,
        projectedNewScore: tailorData?.projectedNewScore,
        originalScore: tailorData?.atsReport?.overallScore,
        targetDocId: targetDocId || undefined,
        targetDocUrl: screenResume?.url || undefined,
      }
    };

    try {
      // 1. If preferred tab is given, message only that tab
      if (preferredTabId) {
        return new Promise<{ success: boolean; appliedCount?: number }>((resolve) => {
          chrome.tabs.sendMessage(preferredTabId, msgPayload, (response) => {
            if (chrome.runtime?.lastError || !response?.success) {
              if (chrome.scripting && preferredTabId) {
                chrome.scripting
                  .executeScript({
                    target: { tabId: preferredTabId },
                    files: ['content-scripts/content_docs.js'],
                  })
                  .then(() => {
                    setTimeout(() => {
                      chrome.tabs?.sendMessage(preferredTabId, msgPayload, (retryRes) => {
                        resolve({ success: Boolean(retryRes?.success), appliedCount: retryRes?.appliedCount });
                      });
                    }, 150);
                  })
                  .catch(() => resolve({ success: false }));
              } else {
                resolve({ success: false });
              }
            } else {
              resolve({ success: true, appliedCount: response.appliedCount });
            }
          });
        });
      }

      // 2. Otherwise search Google Docs tabs strictly scoped to this document
      const tabs = await chrome.tabs.query({});
      let targetTabs = tabs.filter(
        (t) => t.url && t.url.includes('docs.google.com/document/')
      );

      if (targetDocId) {
        const matchingTabs = targetTabs.filter((t) => t.url && t.url.includes(targetDocId));
        if (matchingTabs.length > 0) {
          targetTabs = matchingTabs;
        }
      }

      let anySuccess = false;
      let totalApplied = 0;

      for (const tab of targetTabs) {
        if (!tab.id) continue;
        const res = await new Promise<{ success: boolean; appliedCount?: number }>((resolve) => {
          chrome.tabs.sendMessage(tab.id!, msgPayload, (response) => {
            const hasErr = Boolean(chrome.runtime?.lastError);
            if (hasErr || !response?.success) {
              if (chrome.scripting && chrome.scripting.executeScript && tab.id) {
                chrome.scripting
                  .executeScript({
                    target: { tabId: tab.id },
                    files: ['content-scripts/content_docs.js'],
                  })
                  .then(() => {
                    setTimeout(() => {
                      try {
                        if (tab.id && chrome.tabs?.sendMessage) {
                          chrome.tabs.sendMessage(tab.id, msgPayload, (retryRes) => {
                            resolve({ success: Boolean(retryRes?.success), appliedCount: retryRes?.appliedCount });
                          });
                        } else {
                          resolve({ success: false });
                        }
                      } catch {
                        resolve({ success: false });
                      }
                    }, 150);
                  })
                  .catch(() => resolve({ success: false }));
              } else {
                resolve({ success: false });
              }
            } else {
              resolve({ success: true, appliedCount: response.appliedCount });
            }
          });
        });

        if (res.success) {
          anySuccess = true;
          totalApplied += res.appliedCount || acceptedDiffs.length;
        }
      }

      return { success: anySuccess, appliedCount: totalApplied };
    } catch (e) {
      console.debug('[ResumeHack] Broadcast apply error:', e);
      return { success: false };
    }
  };

  // Apply Changes Directly to Google Doc (Authoritative Structural REST API)
  const handleApplyToGoogleDoc = async (
    diffs: TailoredBulletDiff[],
    customDocId?: string,
    alreadyHandledInDoc?: boolean
  ): Promise<boolean> => {
    try {
      console.log('[ResumeHack App] ── Starting handleApplyToGoogleDoc ──', {
        diffsCount: diffs.length,
        customDocId,
        screenDocUrl: screenResume?.url,
      });

      // 1. Find the Google Docs tab / documentId
      let resolvedDocId: string | null = null;
      let googleDocsTabId: number | undefined;

      if (typeof chrome !== 'undefined' && chrome.tabs) {
        try {
          const allTabs = await chrome.tabs.query({});
          const docTabs = allTabs.filter(
            (t) => t.url && t.url.includes('docs.google.com/document/d/')
          );

          if (docTabs.length > 0) {
            const preferred = screenResume?.url
              ? docTabs.find(
                  (t) =>
                    t.url &&
                    screenResume.url &&
                    t.url.includes(extractGoogleDocId(screenResume.url) || '__none__')
                )
              : null;
            const targetTab = preferred || docTabs[0];
            if (targetTab?.url) {
              resolvedDocId = extractGoogleDocId(targetTab.url);
              googleDocsTabId = targetTab.id;
            }
          } else {
            const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (activeTab?.url && activeTab.url.includes('docs.google.com/document/d/')) {
              resolvedDocId = extractGoogleDocId(activeTab.url);
              googleDocsTabId = activeTab.id;
            }
          }
        } catch (e) {
          console.debug('[ResumeHack App] Tab query note:', e);
        }
      }

      // 2. Fallback: use passed-in docId or stored resume URL or settings masterDocId
      if (!resolvedDocId) {
        resolvedDocId =
          customDocId ||
          (screenResume?.url ? extractGoogleDocId(screenResume.url) : null) ||
          null;
      }

      if (!resolvedDocId) {
        const storedSettings = await getStoredSettings();
        if (storedSettings.masterDocId) {
          resolvedDocId = extractGoogleDocId(storedSettings.masterDocId) || storedSettings.masterDocId;
        }
      }

      const targetDocId = resolvedDocId || 'mock-master-doc';
      const acceptedDiffs =
        diffs.filter((d) => d.status === 'accepted').length > 0
          ? diffs.filter((d) => d.status === 'accepted')
          : diffs.map((d) => ({ ...d, status: 'accepted' as const }));

      if (acceptedDiffs.length === 0) {
        setAppliedStatus('⚠️ No accepted bullet suggestions to apply.');
        setTimeout(() => setAppliedStatus(null), 3000);
        return false;
      }

      setAppliedStatus(`⚡ Applying structural updates to Google Doc (${acceptedDiffs.length} bullets)…`);

      console.log('[ResumeHack App] Dispatching APPLY_DIFFS_TO_DOC to background worker:', {
        targetDocId,
        googleDocsTabId,
        bulletsCount: acceptedDiffs.length,
      });

      // Authoritative Structural Apply via Background Service Worker
      let result: any = null;
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        result = await new Promise<any>((resolve) => {
          let resolved = false;
          const timer = setTimeout(() => {
            if (!resolved) {
              resolved = true;
              console.warn('[ResumeHack App] Apply message timed out after 12s');
              resolve({ success: false, error: 'Background worker request timed out. Please refresh the Google Doc tab and try again.' });
            }
          }, 12000);

          chrome.runtime.sendMessage(
            {
              type: 'APPLY_DIFFS_TO_DOC',
              docId: targetDocId,
              tabId: googleDocsTabId,
              diffs: acceptedDiffs,
            },
            (res) => {
              clearTimeout(timer);
              if (resolved) return;
              resolved = true;
              if (chrome.runtime?.lastError) {
                const errMsg = chrome.runtime.lastError.message || 'Chrome runtime message error';
                console.error('[ResumeHack App] chrome.runtime.lastError:', errMsg);
                resolve({ success: false, error: errMsg });
                return;
              }
              resolve(res || { success: false, error: 'No response received from background service worker' });
            }
          );
        });
      } else {
        // Fallback: direct service call (e.g. dev preview outside extension)
        const storedSettings = await getStoredSettings();
        let token = storedSettings.googleAccessToken || (await getGoogleAccessToken());
        result = await googleDocs.applyBatchUpdates(targetDocId, acceptedDiffs, token);
      }

      console.log('[ResumeHack App] Received apply result:', result);

      if (result?.success) {
        const count = result.appliedCount || result.updatedCount || acceptedDiffs.length;
        setAppliedStatus(`✨ Applied ${count} bullet(s) directly to Google Docs!`);
        setTimeout(() => setAppliedStatus(null), 6000);
        return true;
      } else {
        const errorMsg = result?.error || 'Failed to apply updates to Google Doc. Please check your Google account connection in Settings.';
        console.error('[ResumeHack App] Apply failed with error:', errorMsg);
        setAppliedStatus(`⚠️ Error applying changes: ${errorMsg}`);
        setTimeout(() => setAppliedStatus(null), 8000);
        return false;
      }
    } catch (err: any) {
      console.error('[ResumeHack App] Critical apply exception:', err);
      setAppliedStatus(`⚠️ Error applying changes: ${err.message || 'Check document connection'}`);
      setTimeout(() => setAppliedStatus(null), 8000);
      return false;
    }
  };

  // Fork Document to Drive
  const handleForkToDrive = async () => {
    if (!tailorData) return;
    try {
      const candidateName = parsedResume?.candidateName || 'Candidate';
      const forked = await googleDrive.forkDocument(
        'mock-master-doc',
        currentJob.company,
        candidateName
      );

      await googleDocs.applyBatchUpdates(forked.newDocId, tailorData.bulletDiffs);

      const pdfExport = googleDrive.getPdfExportUrl(forked.newDocId);
      setForkedDocUrl(forked.webViewLink);
      setPdfUrl(pdfExport);
      setAppliedStatus(`📂 Created "${forked.newDocName}" in your Google Drive!`);

      const newApp: ApplicationRecord = {
        id: `app-${Date.now()}`,
        jobId: `job-${Date.now()}`,
        company: currentJob.company,
        title: currentJob.title,
        location: currentJob.location || 'Remote',
        status: 'Tailored',
        jobUrl: currentJob.url,
        tailoredDocId: forked.newDocId,
        tailoredDocUrl: forked.webViewLink,
        pdfExportUrl: pdfExport,
        atsScoreAtApplication: tailorData.projectedNewScore,
        updatedAt: new Date().toISOString()
      };

      const updatedApps = [newApp, ...applications];
      setApplications(updatedApps);
      await saveStoredApplications(updatedApps);
    } catch (err: any) {
      alert('Error forking document: ' + err.message);
    }
  };

  const handleSelectJobForTailoring = (job: JobPosting) => {
    setCurrentJob({
      title: job.title,
      company: job.company,
      location: job.location,
      description: job.description,
      url: job.url,
      source: job.source
    });
    setTailorData(null);
    setActiveTab('match');
  };

  // Safe Autofill via direct scripting
  const handleTriggerAutofill = async () => {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      try {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!activeTab || !activeTab.id) {
          setAppliedStatus('⚠️ Please focus your job application tab first.');
          return;
        }

        if (chrome.scripting && chrome.scripting.executeScript) {
          const results = await chrome.scripting.executeScript({
            target: { tabId: activeTab.id },
            func: () => {
              const inputs = document.querySelectorAll('input, textarea, select');
              let count = 0;
              inputs.forEach((el) => {
                const input = el as HTMLInputElement;
                const fieldId = `${input.name || ''} ${input.id || ''} ${input.placeholder || ''}`.toLowerCase();
                if (input.value && input.value.trim() !== '') return;
                
                if (fieldId.includes('name') && !fieldId.includes('company')) {
                  input.value = 'Candidate';
                  input.dispatchEvent(new Event('input', { bubbles: true }));
                  count++;
                }
              });
              return count;
            }
          });

          const filled = results[0]?.result || 0;
          setAppliedStatus(`⚡ Autofilled ${filled} fields on this application!`);
          setTimeout(() => setAppliedStatus(null), 3000);
        }
      } catch (err: any) {
        console.error('Autofill error:', err);
        setAppliedStatus('⚡ Form scanned.');
        setTimeout(() => setAppliedStatus(null), 3000);
      }
    }
  };

  const handleBookmarkJob = async (job: JobPosting) => {
    const existing = applications.find(
      a => a.company.toLowerCase() === job.company.toLowerCase() && a.title.toLowerCase() === job.title.toLowerCase()
    );
    if (existing) {
      setAppliedStatus(`📌 "${job.title}" at ${job.company} is already in your Tracker!`);
      setTimeout(() => setAppliedStatus(null), 3000);
      return;
    }

    const newApp: ApplicationRecord = {
      id: `app-${Date.now()}`,
      jobId: job.id,
      company: job.company,
      title: job.title,
      location: job.location || 'Remote',
      status: 'Bookmarked',
      jobUrl: job.url,
      salary: job.salaryRange,
      notes: job.aboutTeam || job.description?.slice(0, 200),
      updatedAt: new Date().toISOString()
    };

    const updatedApps = [newApp, ...applications];
    setApplications(updatedApps);
    await saveStoredApplications(updatedApps);
    setAppliedStatus(`📌 Bookmarked "${job.title}" at ${job.company} to your Tracker!`);
    setTimeout(() => setAppliedStatus(null), 3000);
  };

  const handleUpdateStatus = async (id: string, newStatus: ApplicationRecord['status']) => {
    const updated = applications.map(a => a.id === id ? { ...a, status: newStatus } : a);
    setApplications(updated);
    await saveStoredApplications(updated);
  };

  const handleApplyLayoutFix = async (issue: LayoutIssue): Promise<boolean> => {
    if (!issue.suggestedFix?.batchUpdateRequests || issue.suggestedFix.batchUpdateRequests.length === 0) {
      return false;
    }

    let activeDocId: string | null = null;
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      try {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (activeTab?.url) {
          activeDocId = extractGoogleDocId(activeTab.url);
        }
        if (!activeDocId) {
          const docTabs = await chrome.tabs.query({ url: '*://docs.google.com/document/d/*' });
          if (docTabs[0]?.url) {
            activeDocId = extractGoogleDocId(docTabs[0].url);
          }
        }
      } catch {}
    }

    if (!activeDocId && screenResume?.url) {
      activeDocId = extractGoogleDocId(screenResume.url);
    }

    if (!activeDocId) {
      activeDocId = 'mock-master-doc';
    }

    setAppliedStatus(`Applying layout fix: ${issue.title}…`);
    try {
      const response = await new Promise<any>((resolve) => {
        chrome.runtime.sendMessage(
          {
            type: 'APPLY_LAYOUT_FIX_TO_DOC',
            docId: activeDocId,
            layoutIssue: issue,
            layoutIssues: [issue],
          },
          (res) => {
            if (chrome.runtime.lastError) {
              resolve({ success: false, error: chrome.runtime.lastError.message });
            } else {
              resolve(res || { success: false, error: 'No response received' });
            }
          }
        );
      });

      if (response && response.success) {
        setAppliedStatus(`✓ Layout fix applied: ${issue.title}`);
        if (tailorData?.atsReport?.layoutReport?.issues) {
          const updatedIssues = tailorData.atsReport.layoutReport.issues.map((iss) =>
            iss.id === issue.id ? { ...iss, status: 'accepted' as const } : iss
          );
          setTailorData({
            ...tailorData,
            atsReport: {
              ...tailorData.atsReport,
              layoutReport: {
                ...tailorData.atsReport.layoutReport,
                issues: updatedIssues,
              },
            },
          });
        }
        return true;
      } else {
        setAppliedStatus(`⚠️ ${response?.error || 'Failed to apply layout fix'}`);
        return false;
      }
    } catch (err: any) {
      setAppliedStatus(`⚠️ ${err.message || 'Error applying layout fix'}`);
      return false;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        connectedDocTitle={screenResume?.title || (parsedResume?.candidateName ? `${parsedResume.candidateName} Resume` : 'Hacky Resume')}
        newJobsCount={newJobsCount}
      />

      <main className="flex-1 overflow-y-auto">
        {activeTab === 'match' && (
          <MatchTailorTab
            currentJob={currentJob}
            tailorData={tailorData}
            isLoading={isLoading}
            onTriggerTailor={handleTriggerTailor}
            onTriggerGeneralAtsOptimize={handleTriggerGeneralAtsOptimize}
            onApplyToGoogleDoc={handleApplyToGoogleDoc}
            onApplyLayoutFix={handleApplyLayoutFix}
            onForkToDrive={handleForkToDrive}
            onTriggerAutofill={handleTriggerAutofill}
            onReadScreenNow={handleReadScreenNow}
            onScrapeJobFromCurrentTab={handleScrapeJobFromCurrentTab}
            screenResume={screenResume}
            parsedResume={parsedResume}
            onUpdateCustomResumeText={handleUpdateCustomResumeText}
            onShowDiffsOnGoogleDoc={handleManualShowInDocDiffs}
            onNavigateToSettings={() => setActiveTab('settings')}
            appliedStatus={appliedStatus}
            forkedDocUrl={forkedDocUrl}
            pdfUrl={pdfUrl}
          />
        )}

        {activeTab === 'discovery' && (
          <DiscoveryTab
            jobs={jobs}
            onSelectJobForTailoring={handleSelectJobForTailoring}
            onSyncGitHub={handleSyncGitHub}
            isSyncing={isSyncingGitHub}
            syncMessage={syncMessage}
            lastSyncAt={lastSyncAt}
            newJobsCount={newJobsCount}
            resumeText={screenResume?.fullText || parsedResume?.rawText || ''}
            applications={applications}
            onBookmarkJob={handleBookmarkJob}
          />
        )}

        {activeTab === 'tracker' && (
          <TrackerTab
            applications={applications}
            onUpdateStatus={handleUpdateStatus}
          />
        )}

        {activeTab === 'settings' && <SettingsTab />}
      </main>
    </div>
  );
};

export default App;
