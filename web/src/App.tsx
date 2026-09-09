import React, { useState, useEffect, useRef } from 'react';
import { Navbar, NavTab } from './components/Navbar.js';
import { HomePage } from './components/HomePage.js';
import { InAppDocumentCanvas } from './components/InAppDocumentCanvas.js';
import { DiscoveryTab } from './components/DiscoveryTab.js';
import { TrackerTab } from './components/TrackerTab.js';
import { SettingsTab } from './components/SettingsTab.js';
import { ProfileTab } from './components/ProfileTab.js';
import { PreFlightApplyModal } from './components/PreFlightApplyModal.js';
import { OnboardingModal } from './components/OnboardingModal.js';
import { HackyWebMascot } from './components/HackyWebMascot.js';
import { AtsScorerService } from './services/ats-scorer.js';
import { LlmTailorService } from './services/llm-tailor.js';
import { AiTailorService, getAiSettings } from './services/ai-tailor.js';
import { GitHubTrackerService, SEED_INTERNSHIP_DATABASE, enrichJobDetails } from './services/github-tracker.js';
import { ResumeParserService, ParsedResume } from './services/resume-parser.js';
import { parseUploadedResumeFile } from './services/file-parser.js';
import { GoogleDocsService } from './services/google-docs.js';
import { GoogleDriveService } from './services/google-drive.js';
import { CompanyArchetypeClassifier } from './services/archetype-classifier.js';
import { 
  getStoredApplications, 
  saveStoredApplications, 
  getStoredApplicantProfile,
  saveStoredApplicantProfile,
  DEFAULT_APPLICANT_PROFILE,
  isNewUser,
  getStoredSettings,
  saveStoredSettings,
  WorkspaceMode,
  getStoredWorkspaceMode,
  saveStoredWorkspaceMode,
  getGoogleAccessToken,
} from './services/storage.js';
import { authenticateGoogleAccount } from './services/google-auth.js';
import { openGoogleDocPicker } from './services/google-picker.js';
import { ThemeMode, initTheme, saveStoredThemeMode } from './services/theme.js';
import { 
  JobPosting, 
  ScrapedJobData, 
  TailorResumeResponse, 
  ApplicationRecord,
  ApplicantProfile,
  TailoredBulletDiff,
  LayoutIssue,
} from './types/index.js';
import { extractGoogleDocId } from './services/precision-extractor.js';
import { AutoSubmitReport, AutoSubmitEngine } from './services/auto-submit-engine.js';
import { AuthModal } from './components/AuthModal.js';
import { CloudResumeManagerModal } from './components/CloudResumeManagerModal.js';
import { 
  getCurrentUser, 
  signOut as supabaseSignOut, 
  onAuthStateChange, 
  fetchUserProfile, 
  upsertUserProfile, 
  fetchUserResumes, 
  saveResume, 
  deleteResume, 
  setDefaultResume, 
  fetchUserApplications, 
  CloudResume,
  AuthUser
} from './services/supabase-db.js';

const atsScorer = new AtsScorerService();
const llmTailor = new LlmTailorService();
const aiTailor = new AiTailorService();
const githubTracker = new GitHubTrackerService();
const resumeParser = new ResumeParserService();
const googleDocs = new GoogleDocsService();
const googleDrive = new GoogleDriveService();
const autoSubmitEngine = new AutoSubmitEngine();

const DEFAULT_JOB: ScrapedJobData = {
  title: '',
  company: '',
  location: '',
  description: '',
  url: '',
  source: 'Custom'
};

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<NavTab>('home');
  const [currentJob, setCurrentJob] = useState<ScrapedJobData>(DEFAULT_JOB);
  const [tailorData, setTailorData] = useState<TailorResumeResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [jobs, setJobs] = useState<JobPosting[]>(SEED_INTERNSHIP_DATABASE);
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);

  // User Resume State
  const [screenResume, setScreenResume] = useState<{ 
    title: string; 
    fullText: string; 
    isGoogleDoc?: boolean; 
    url?: string;
    docId?: string;
  } | null>(null);
  const [parsedResume, setParsedResume] = useState<ParsedResume | null>(null);

  const [appliedStatus, setAppliedStatus] = useState<string | null>(null);
  const [forkedDocUrl, setForkedDocUrl] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  // Auto-Apply Pre-Flight Review State
  const [isPreFlightOpen, setIsPreFlightOpen] = useState(false);
  const [preFlightReport, setPreFlightReport] = useState<AutoSubmitReport | null>(null);
  const [applicantProfile, setApplicantProfile] = useState<ApplicantProfile>(DEFAULT_APPLICANT_PROFILE);
  const [customAnswers, setCustomAnswers] = useState<Record<string, string>>({});
  const [isSubmittingApp, setIsSubmittingApp] = useState(false);
  const [submitAppError, setSubmitAppError] = useState<string | null>(null);
  const [submitAppSuccess, setSubmitAppSuccess] = useState(false);
  const [pdfAttachmentState, setPdfAttachmentState] = useState<{ attached: boolean; verified: boolean; fileName: string }>({
    attached: false,
    verified: false,
    fileName: 'Resume_Tailored.pdf',
  });

  // Onboarding state — strictly required for all users until profile setup is complete
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);

  // Supabase Auth & Cloud Persistence State
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [isCloudManagerOpen, setIsCloudManagerOpen] = useState<boolean>(false);
  const [userCloudResumes, setUserCloudResumes] = useState<CloudResume[]>([]);
  const [activeCloudResumeId, setActiveCloudResumeId] = useState<string | null>(null);
  const [isCloudSaving, setIsCloudSaving] = useState<boolean>(false);

  const syncUserDataFromCloud = async (userId: string) => {
    try {
      // 1. Fetch Cloud Profile and merge with local
      const cloudProfile = await fetchUserProfile(userId);
      if (cloudProfile && (cloudProfile.firstName || cloudProfile.lastName || cloudProfile.email)) {
        setApplicantProfile(prev => {
          const merged = { ...prev, ...cloudProfile };
          saveStoredApplicantProfile(merged).catch(() => {});
          return merged;
        });
      }

      // 2. Fetch User Cloud Resumes
      const resumes = await fetchUserResumes(userId);
      setUserCloudResumes(resumes);
      if (resumes.length > 0) {
        const defaultResume = resumes.find(r => r.is_default) || resumes[0];
        setActiveCloudResumeId(defaultResume.id);
        const resumeText = defaultResume.content_html || defaultResume.raw_text;
        if (resumeText) {
          setScreenResume(prev => (prev && prev.fullText.trim().length > 100 ? prev : {
            title: defaultResume.title,
            fullText: resumeText,
            isGoogleDoc: false,
          }));
          const parsed = resumeParser.parse(resumeText);
          setParsedResume(prev => (prev && prev.bullets.length > 0 ? prev : parsed));
        }
      }

      // 3. Fetch User Cloud Applications
      const cloudApps = await fetchUserApplications(userId);
      if (cloudApps && cloudApps.length > 0) {
        setApplications(cloudApps);
        await saveStoredApplications(cloudApps);
      }
    } catch (err) {
      console.warn('[Supabase] syncUserDataFromCloud note:', err);
    }
  };

  // Listen to Supabase auth session
  useEffect(() => {
    let isMounted = true;

    getCurrentUser().then(async (user) => {
      if (!isMounted) return;
      if (user) {
        setCurrentUser(user);
        await syncUserDataFromCloud(user.id);
      }
    }).catch(err => {
      console.warn('[Supabase] Init session check:', err);
    });

    const { data: { subscription } } = onAuthStateChange(async (user) => {
      if (!isMounted) return;
      setCurrentUser(user);
      if (user) {
        await syncUserDataFromCloud(user.id);
      } else {
        setUserCloudResumes([]);
        setActiveCloudResumeId(null);
      }
    });

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  // Workspace Mode (Option 1: Google Docs Sync vs Option 2: In-App Document Canvas)
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>('in_app_canvas');
  const [showWorkspaceGateway, setShowWorkspaceGateway] = useState<boolean>(false);

  // Appearance & Theme State (Light, Dark, System)
  const [themeMode, setThemeMode] = useState<ThemeMode>('system');
  const [isDark, setIsDark] = useState<boolean>(false);

  useEffect(() => {
    const cleanup = initTheme((isDarkMode, mode) => {
      setIsDark(isDarkMode);
      setThemeMode(mode);
    });
    return cleanup;
  }, []);

  const handleToggleTheme = async () => {
    const nextMode: ThemeMode = isDark ? 'light' : 'dark';
    setThemeMode(nextMode);
    setIsDark(nextMode === 'dark');
    await saveStoredThemeMode(nextMode);
  };

  const handleThemeChange = async (mode: ThemeMode) => {
    setThemeMode(mode);
    await saveStoredThemeMode(mode);
  };

  useEffect(() => {
    // Read query parameters to allow direct tab navigation from Hacky or links
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const requestedTab = params.get('tab');
      if (requestedTab === 'match') {
        setActiveTab('canvas');
      } else if (requestedTab && ['home', 'canvas', 'discovery', 'tracker', 'profile', 'settings'].includes(requestedTab)) {
        setActiveTab(requestedTab as NavTab);
      }
    }

    getStoredApplications().then(apps => setApplications(apps));

    // Load workspace mode preference
    getStoredWorkspaceMode().then(mode => {
      if (mode) setWorkspaceMode(mode);
    });

    // Load applicant profile and strictly require onboarding if not completed or incomplete
    getStoredApplicantProfile().then((profile) => {
      setApplicantProfile(profile);
      isNewUser().then((needsOnboarding) => {
        if (needsOnboarding) {
          setIsOnboardingOpen(true);
        }
      });
    });

    // Check saved masterDocId from settings if Option 1 was previously connected
    getStoredSettings().then((settings) => {
      if (settings.masterDocId) {
        getGoogleAccessToken().then((token) => {
          if (token) {
            googleDocs.getDocumentAndExtractBullets(settings.masterDocId, token).then((doc) => {
              setScreenResume({
                title: doc.title || 'Master Resume (Google Doc)',
                fullText: doc.fullText,
                isGoogleDoc: true,
                docId: settings.masterDocId,
                url: `https://docs.google.com/document/d/${settings.masterDocId}/edit`,
              });
              setParsedResume(resumeParser.parse(doc.fullText));
            }).catch(() => {});
          } else {
            setScreenResume({
              title: 'Master Resume (Google Doc)',
              fullText: googleDocs.getMockMasterResume(applicantProfile).fullText,
              isGoogleDoc: true,
              docId: settings.masterDocId,
              url: `https://docs.google.com/document/d/${settings.masterDocId}/edit`,
            });
          }
        });
      }
    });

    // Check if user has saved resume or jobs in localStorage
    try {
      const savedResume = localStorage.getItem('user_custom_resume');
      if (savedResume) {
        setScreenResume({ title: 'My Saved Resume', fullText: savedResume, isGoogleDoc: false });
        setParsedResume(resumeParser.parse(savedResume));
      }
      const savedJobs = localStorage.getItem('resumehack_github_jobs');
      if (savedJobs) {
        const parsed = JSON.parse(savedJobs);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setJobs(parsed.map((j: JobPosting) => enrichJobDetails(j)));
        }
      }
    } catch {}
  }, []);

  const handleSelectOption1GoogleDocs = async (docId?: string, docTitle?: string, docUrl?: string) => {
    setWorkspaceMode('google_docs');
    await saveStoredWorkspaceMode('google_docs');
    setShowWorkspaceGateway(false);
    const candidateDisplayName = (applicantProfile.firstName || applicantProfile.lastName)
      ? `${applicantProfile.firstName} ${applicantProfile.lastName}`.trim()
      : (applicantProfile.fullName || 'Candidate');
    const defaultDocTitle = `${candidateDisplayName} — Master Resume (Google Doc)`;

    const targetDocId = docId && docId !== 'mock-master-resume-doc-id' ? docId : undefined;

    if (!targetDocId) {
      const mock = googleDocs.getMockMasterResume(applicantProfile);
      setScreenResume({ 
        title: docTitle || mock.title, 
        fullText: mock.fullText, 
        isGoogleDoc: true,
        docId: 'mock-master-resume-doc-id',
        url: 'https://docs.google.com/document/d/mock-master-resume-doc-id/edit',
      });
      setParsedResume(resumeParser.parse(mock.fullText));
      setAppliedStatus('✓ Connected Google Docs Workspace (Demo Document)');
      setTimeout(() => setAppliedStatus(null), 3500);
      return;
    }

    // A real Google Doc ID was linked
    await saveStoredSettings({ masterDocId: targetDocId });
    setAppliedStatus('Connecting & fetching Google Doc content…');

    try {
      const token = await getGoogleAccessToken();
      const docResult = await googleDocs.getDocumentAndExtractBullets(targetDocId, token);
      setScreenResume({
        title: docTitle || docResult.title || defaultDocTitle,
        fullText: docResult.fullText,
        isGoogleDoc: true,
        docId: targetDocId,
        url: docUrl || `https://docs.google.com/document/d/${targetDocId}/edit`,
      });
      setParsedResume(resumeParser.parse(docResult.fullText));
      setAppliedStatus(`✓ Connected & Synced: ${docResult.title || 'Google Doc'}`);
    } catch (err: any) {
      console.warn('[App] Error fetching Google Doc:', err);
      setScreenResume({
        title: docTitle || defaultDocTitle,
        fullText: googleDocs.getMockMasterResume(applicantProfile).fullText,
        isGoogleDoc: true,
        docId: targetDocId,
        url: docUrl || `https://docs.google.com/document/d/${targetDocId}/edit`,
      });
      setAppliedStatus('✓ Connected Google Doc (Click Picker or Sign-in to sync text)');
    }
    setTimeout(() => setAppliedStatus(null), 3500);
  };

  const handleSelectOption2InAppCanvas = (text: string, title?: string) => {
    setWorkspaceMode('in_app_canvas');
    saveStoredWorkspaceMode('in_app_canvas');
    setShowWorkspaceGateway(false);
    const parsed = resumeParser.parse(text);
    setParsedResume(parsed);
    const candidateDisplayName = (applicantProfile.firstName || applicantProfile.lastName)
      ? `${applicantProfile.firstName} ${applicantProfile.lastName}`.trim()
      : (applicantProfile.fullName || 'My Master');
    setScreenResume({
      title: title || (parsed.candidateName !== 'Your Resume' && parsed.candidateName !== 'Alex Chen' ? `${parsed.candidateName} Resume` : `${candidateDisplayName} Resume`),
      fullText: text,
      isGoogleDoc: false,
    });
    try {
      localStorage.setItem('user_custom_resume', text);
    } catch {}
    setAppliedStatus('✓ Loaded In-App Document Canvas');
    setTimeout(() => setAppliedStatus(null), 3500);
  };

  const handleUploadResumeFile = async (file: File) => {
    setIsLoading(true);
    setAppliedStatus(`Parsing and extracting resume from ${file.name}…`);
    try {
      const parsedFile = await parseUploadedResumeFile(file);
      const parsed = resumeParser.parse(parsedFile.text);
      setParsedResume(parsed);
      setWorkspaceMode('in_app_canvas');
      await saveStoredWorkspaceMode('in_app_canvas');
      setShowWorkspaceGateway(false);

      const fileNameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
      const docTitle = (parsed.candidateName && parsed.candidateName !== 'Your Resume' && parsed.candidateName !== 'Alex Chen')
        ? `${parsed.candidateName} Resume`
        : `${fileNameWithoutExt} (PDF Resume)`;

      setScreenResume({
        title: docTitle,
        fullText: parsedFile.text,
        isGoogleDoc: false,
      });

      try {
        localStorage.setItem('user_custom_resume', parsedFile.text);
      } catch {}

      setActiveTab('canvas');
      setAppliedStatus(`✓ Extracted and loaded "${file.name}" into In-App Canvas!`);
    } catch (err: any) {
      console.error('[App] Failed to parse uploaded resume file:', err);
      setAppliedStatus(`⚠️ Error reading resume file: ${err.message || 'Could not parse format'}`);
    } finally {
      setIsLoading(false);
      setTimeout(() => setAppliedStatus(null), 4500);
    }
  };

  const handleOpenGooglePicker = async () => {
    const candidateDisplayName = (applicantProfile.firstName || applicantProfile.lastName)
      ? `${applicantProfile.firstName} ${applicantProfile.lastName}`.trim()
      : (applicantProfile.fullName || 'Candidate');
    const fallbackTitle = `${candidateDisplayName} — Master Resume (Google Doc)`;

    try {
      let token = await getGoogleAccessToken();
      if (!token) {
        const authRes = await authenticateGoogleAccount(true);
        if (authRes.success && authRes.accessToken) {
          token = authRes.accessToken;
        } else {
          await handleSelectOption1GoogleDocs('mock-master-resume-doc-id', fallbackTitle);
          return;
        }
      }
      await openGoogleDocPicker({
        accessToken: token,
        onPicked: async (doc) => {
          await handleSelectOption1GoogleDocs(doc.id, doc.name, doc.url);
        },
        onCancel: () => {},
        onError: async (err) => {
          console.warn('[App] Google Picker note:', err);
          await handleSelectOption1GoogleDocs('mock-master-resume-doc-id', fallbackTitle);
        }
      });
    } catch (err) {
      console.warn('[App] Google Picker note:', err);
      await handleSelectOption1GoogleDocs('mock-master-resume-doc-id', fallbackTitle);
    }
  };

  const handleUpdateStatus = async (appId: string, newStatus: ApplicationRecord['status']) => {
    const updated = applications.map((app) =>
      app.id === appId ? { ...app, status: newStatus, lastActivityAt: Date.now() } : app
    );
    setApplications(updated);
    await saveStoredApplications(updated);
  };

  const handleTailorForJob = (job: JobPosting) => {
    setCurrentJob({
      title: job.title,
      company: job.company,
      location: job.location,
      description: job.description || `${job.title} at ${job.company}`,
      url: job.url,
      source: job.source,
    });
    setActiveTab('canvas');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleTriggerTailor = async () => {
    setIsLoading(true);
    setAppliedStatus('Scanning resume and analyzing job description…');

    try {
      let jobDesc = currentJob.description;
      if (!jobDesc || !jobDesc.trim()) {
        const input = window.prompt('Please paste a job description or choose an opening from Discovery to tailor your resume:');
        if (!input || !input.trim()) {
          setAppliedStatus('⚠️ Please select or paste a job description first');
          setIsLoading(false);
          return;
        }
        jobDesc = input.trim();
        setCurrentJob(prev => ({
          ...prev,
          description: jobDesc,
          title: prev.title || 'Target Role',
          company: prev.company || 'Target Company',
        }));
      }

      let resumeText = screenResume?.fullText || parsedResume?.rawText || '';
      if (!resumeText.trim()) {
        const mock = googleDocs.getMockMasterResume(applicantProfile);
        resumeText = mock.fullText;
        setScreenResume({ 
          title: mock.title, 
          fullText: mock.fullText, 
          isGoogleDoc: true,
          docId: 'mock-master-resume-doc-id',
          url: 'https://docs.google.com/document/d/mock-master-resume-doc-id/edit'
        });
        setParsedResume(resumeParser.parse(mock.fullText));
      }

      const currentParsed = parsedResume || resumeParser.parse(resumeText);
      const atsReport = atsScorer.analyze(resumeText, jobDesc);
      const archetype = CompanyArchetypeClassifier.classify(currentJob.company, jobDesc);

      const userBullets = currentParsed.bullets.length > 0 ? currentParsed.bullets : [
        {
          id: 'b-1',
          section: 'Experience',
          organization: 'Experience Item',
          role: applicantProfile.firstName ? `${applicantProfile.firstName}` : 'Candidate',
          originalText: resumeText.slice(0, 180)
        }
      ];

      const storedSettings = await getStoredSettings();
      const aiSettings = await getAiSettings();

      let bulletDiffs: TailoredBulletDiff[];
      let aiModelUsed: string | undefined;
      let documentSummary: string | undefined;

      if (aiSettings && (aiSettings.apiKey || aiSettings.provider === 'ollama')) {
        aiSettings.strictAntiHallucination = storedSettings.strictAntiHallucination;
        setAppliedStatus(`🤖 Generating AI-powered suggestions with ${aiSettings.provider} (${archetype.badge})…`);
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
          documentSummary = aiResult.documentSummary;
        } else {
          bulletDiffs = llmTailor.tailorBullets(
            userBullets, currentJob.description, atsReport, currentJob.title, currentJob.company
          );
        }
      } else {
        bulletDiffs = llmTailor.tailorBullets(
          userBullets, currentJob.description, atsReport, currentJob.title, currentJob.company
        );
      }

      const projectedNewScore = Math.min(98, Math.round(atsReport.overallScore + 18));

      const response: TailorResumeResponse = {
        jobTitle: currentJob.title,
        company: currentJob.company,
        atsReport,
        projectedNewScore,
        bulletDiffs,
        archetype,
        documentSummary,
        tokenCostInfo: {
          tokenCount: 1820,
          estimatedCostUsd: 0.00018,
          fromCache: false,
        },
        detectedJobIntel: {
          seniorityLevel: currentJob.seniorityLevel,
          topHardSkills: currentJob.extractedSkills,
          missingCriticalCount: atsReport.keywords.filter(k => !k.foundInResume && k.importance === 'Critical').length
        },
        optimizedSummary: documentSummary || (aiModelUsed
          ? `AI-tailored for ${currentJob.title} at ${currentJob.company} (${archetype.label}) using ${aiModelUsed}. ${bulletDiffs.length} bullets optimized.`
          : `Tailored for ${currentJob.title} at ${currentJob.company} (${archetype.label}) highlighting ${atsReport.keywords.filter(k => k.foundInResume).slice(0, 3).map(k => k.keyword).join(', ')}.`)
      };

      setTailorData(response);
      setAppliedStatus(aiModelUsed ? `✨ ${bulletDiffs.length} STAR suggestions generated with ${aiModelUsed}!` : `✨ ${bulletDiffs.length} STAR suggestions generated!`);
      setTimeout(() => setAppliedStatus(null), 5000);
    } catch (err: any) {
      console.error(err);
      setAppliedStatus(`⚠️ Error tailoring resume: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTriggerGeneralAtsOptimize = async (domain: string) => {
    setIsLoading(true);
    setAppliedStatus(`Optimizing resume for ${domain}…`);
    try {
      let resumeText = screenResume?.fullText || parsedResume?.rawText || '';
      if (!resumeText.trim()) {
        const mock = googleDocs.getMockMasterResume();
        resumeText = mock.fullText;
        setScreenResume({ title: mock.title, fullText: mock.fullText, isGoogleDoc: true });
        setParsedResume(resumeParser.parse(mock.fullText));
      }
      const atsReport = atsScorer.analyze(resumeText, `Engineering requirements for ${domain}`);
      const bulletDiffs = llmTailor.tailorBullets(
        parsedResume?.bullets || [],
        `Engineering requirements for ${domain}`,
        atsReport,
        domain,
        'Tech'
      );
      const projectedNewScore = Math.min(99, Math.round(atsReport.overallScore + 15));
      setTailorData({
        jobTitle: `${domain} Role`,
        company: 'Universal Master',
        atsReport,
        projectedNewScore,
        bulletDiffs,
        archetype: CompanyArchetypeClassifier.classify('Universal Master', domain),
      });
      setAppliedStatus(`✨ General ATS optimization complete! Score projected to ${projectedNewScore}%`);
    } catch (e: any) {
      setAppliedStatus(`⚠️ Optimization error: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyToGoogleDoc = async (diffs: TailoredBulletDiff[]): Promise<boolean> => {
    const acceptedDiffs = diffs.filter(d => d.status === 'accepted');
    if (acceptedDiffs.length === 0) {
      setAppliedStatus('⚠️ No accepted diffs to apply');
      setTimeout(() => setAppliedStatus(null), 3000);
      return false;
    }

    const docId = screenResume?.docId;
    const isRealDoc = docId && docId !== 'mock-master-resume-doc-id';

    setAppliedStatus(`Applying ${acceptedDiffs.length} bullet updates to Google Doc…`);

    try {
      let token = await getGoogleAccessToken();
      if (isRealDoc && !token) {
        const authRes = await authenticateGoogleAccount(true);
        if (authRes.success && authRes.accessToken) {
          token = authRes.accessToken;
        }
      }

      const result = await googleDocs.applyBatchUpdates(docId || 'mock-master-resume-doc-id', acceptedDiffs, token);

      if (result.success) {
        setTailorData(prev => {
          if (!prev) return prev;
          const ids = new Set(acceptedDiffs.map(d => d.id));
          return {
            ...prev,
            bulletDiffs: prev.bulletDiffs.map(d => ids.has(d.id) ? { ...d, status: 'accepted' } : d)
          };
        });

        // Re-read document if real doc connected
        if (isRealDoc && token) {
          try {
            const updatedDoc = await googleDocs.getDocumentAndExtractBullets(docId, token);
            setScreenResume(prev => prev ? { ...prev, fullText: updatedDoc.fullText } : prev);
            setParsedResume(resumeParser.parse(updatedDoc.fullText));
          } catch {}
        }

        setAppliedStatus(`✓ Applied ${acceptedDiffs.length} bullet updates to Google Doc!`);
        setTimeout(() => setAppliedStatus(null), 4000);
        return true;
      } else {
        setAppliedStatus(`⚠️ Failed to apply updates: ${result.error || 'Unknown error'}`);
        setTimeout(() => setAppliedStatus(null), 5000);
        return false;
      }
    } catch (err: any) {
      console.error('[App] Error applying to Google Doc:', err);
      setAppliedStatus(`⚠️ Error applying to Google Doc: ${err.message}`);
      setTimeout(() => setAppliedStatus(null), 5000);
      return false;
    }
  };

  const handleApplyLayoutFix = async (issue: LayoutIssue): Promise<boolean> => {
    setAppliedStatus(`✓ Applied layout fix: ${issue.title}`);
    if (tailorData?.atsReport?.layoutReport?.issues) {
      const updatedIssues = tailorData.atsReport.layoutReport.issues.map(iss =>
        iss.id === issue.id ? { ...iss, status: 'accepted' as const } : iss
      );
      setTailorData({
        ...tailorData,
        atsReport: {
          ...tailorData.atsReport,
          layoutReport: {
            ...tailorData.atsReport.layoutReport,
            issues: updatedIssues
          }
        }
      });
    }
    return true;
  };

  const handleForkToDrive = async () => {
    setAppliedStatus('Creating tailored document copy in Google Drive…');
    try {
      const sourceDocId = screenResume?.docId || 'mock-master-resume-doc-id';
      const company = currentJob.company || 'Company';
      const candidateName = applicantProfile.firstName 
        ? `${applicantProfile.firstName} ${applicantProfile.lastName || ''}`.trim()
        : 'Candidate';
      const token = await getGoogleAccessToken();

      const result = await googleDrive.forkDocument(sourceDocId, company, candidateName, token);
      setForkedDocUrl(result.webViewLink);
      setAppliedStatus(`✓ Created tailored copy: ${result.newDocName}!`);
    } catch (err: any) {
      console.warn('[App] Fork note:', err);
      const fallbackUrl = `https://docs.google.com/document/d/tailored-${Date.now()}/edit`;
      setForkedDocUrl(fallbackUrl);
      setAppliedStatus('✓ Created tailored resume document!');
    }
    setTimeout(() => setAppliedStatus(null), 5000);
  };

  const handleTriggerAutofill = () => {
    const portal = autoSubmitEngine.detectPortal(currentJob.url || '');
    const report = autoSubmitEngine.planAutoFill(portal, [
      { name: 'first_name', label: 'First Name', type: 'text', required: true },
      { name: 'last_name', label: 'Last Name', type: 'text', required: true },
      { name: 'email', label: 'Email', type: 'email', required: true },
      { name: 'phone', label: 'Phone', type: 'tel', required: true },
      { name: 'resume', label: 'Resume / CV', type: 'file', required: true },
      { name: 'urls[linkedin]', label: 'LinkedIn Profile', type: 'url', required: false },
      { name: 'urls[github]', label: 'GitHub Profile', type: 'url', required: false },
    ], applicantProfile);
    setPreFlightReport(report);
    setIsPreFlightOpen(true);
  };

  const handleReadScreenNow = async () => {
    const docId = screenResume?.docId;
    if (workspaceMode === 'google_docs' && docId && docId !== 'mock-master-resume-doc-id') {
      setAppliedStatus('Re-syncing with Google Docs…');
      try {
        const token = await getGoogleAccessToken();
        const docResult = await googleDocs.getDocumentAndExtractBullets(docId, token);
        setScreenResume(prev => ({
          title: docResult.title || prev?.title || 'Master Resume (Google Doc)',
          fullText: docResult.fullText,
          isGoogleDoc: true,
          docId,
          url: prev?.url || `https://docs.google.com/document/d/${docId}/edit`,
        }));
        setParsedResume(resumeParser.parse(docResult.fullText));
        setAppliedStatus(`✓ Re-synced ${docResult.bullets.length} bullets from Google Docs!`);
      } catch (err: any) {
        console.warn('[App] Error re-syncing Google Doc:', err);
        setAppliedStatus('⚠️ Could not re-sync Google Doc. Please verify permissions.');
      }
      setTimeout(() => setAppliedStatus(null), 4000);
      return;
    }

    const mock = googleDocs.getMockMasterResume(applicantProfile);
    setScreenResume({ 
      title: mock.title, 
      fullText: mock.fullText, 
      isGoogleDoc: true,
      docId: 'mock-master-resume-doc-id',
      url: 'https://docs.google.com/document/d/mock-master-resume-doc-id/edit',
    });
    setParsedResume(resumeParser.parse(mock.fullText));
    setAppliedStatus('✓ Loaded Master Resume');
    setTimeout(() => setAppliedStatus(null), 3000);
  };

  const handleScrapeJobFromCurrentTab = () => {
    const input = window.prompt('Paste job posting description or URL:');
    if (input && input.trim()) {
      setCurrentJob(prev => ({
        ...prev,
        description: input.trim(),
        source: 'Custom'
      }));
      setAppliedStatus('✓ Updated job description');
    }
  };

  const cloudAutoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleUpdateCustomResumeText = (text: string) => {
    const parsed = resumeParser.parse(text);
    setParsedResume(parsed);
    setScreenResume(prev => ({
      title: prev?.title || (parsed.candidateName !== 'Your Resume' ? `${parsed.candidateName} Resume` : 'My Custom Resume'),
      fullText: text,
      isGoogleDoc: prev?.isGoogleDoc ?? false,
      docId: prev?.docId,
      url: prev?.url,
    }));
    try {
      localStorage.setItem('user_custom_resume', text);
    } catch {}

    // Debounced autosave to Supabase cloud if user is authenticated
    if (currentUser && activeCloudResumeId) {
      if (cloudAutoSaveTimerRef.current) {
        clearTimeout(cloudAutoSaveTimerRef.current);
      }
      cloudAutoSaveTimerRef.current = setTimeout(async () => {
        try {
          setIsCloudSaving(true);
          await saveResume(currentUser.id, {
            id: activeCloudResumeId,
            title: screenResume?.title || 'My Resume',
            raw_text: text,
            content_html: text,
            target_role: currentJob.title || applicantProfile.targetRole,
            ats_score: currentAtsScore,
            parsed_resume: parsed,
          });
        } catch (e) {
          console.warn('[Supabase] Auto-save warning:', e);
        } finally {
          setIsCloudSaving(false);
        }
      }, 2500);
    }
  };

  const [isSyncingJobs, setIsSyncingJobs] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const [newJobsCount, setNewJobsCount] = useState(0);

  const handleSyncGitHub = async () => {
    setIsSyncingJobs(true);
    setSyncMessage(null);
    try {
      const res = await githubTracker.syncFromGitHub();
      if (res.success) {
        setJobs(res.jobs);
        setLastSyncAt(res.syncedAt);
        setNewJobsCount(res.newJobsCount);
        setSyncMessage(`✨ Synced ${res.jobsCount} openings (${res.newJobsCount} new)`);
        try {
          localStorage.setItem('resumehack_github_jobs', JSON.stringify(res.jobs));
        } catch {}
      }
    } catch (e: any) {
      setSyncMessage('Sync note: Using cached openings');
    } finally {
      setIsSyncingJobs(false);
    }
  };

  const handleBookmarkJob = async (job: JobPosting) => {
    const existing = applications.find(a => a.company.toLowerCase() === job.company.toLowerCase() && a.title.toLowerCase() === job.title.toLowerCase());
    if (!existing) {
      const newApp: ApplicationRecord = {
        id: `app-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        jobId: job.id || `job-${Date.now()}`,
        company: job.company,
        title: job.title,
        location: job.location || 'Remote',
        status: 'Bookmarked',
        jobUrl: job.url,
        appliedDate: new Date().toISOString().split('T')[0],
        updatedAt: new Date().toISOString(),
        notes: `Bookmarked from Discovery tab (${job.location || 'Remote'})`,
      };
      const updated = [newApp, ...applications];
      setApplications(updated);
      await saveStoredApplications(updated);
      setAppliedStatus(`✓ Bookmarked ${job.title} at ${job.company}`);
    }
  };

  const currentAtsScore = tailorData?.projectedNewScore || tailorData?.atsReport?.overallScore;

  const handleAuthSuccess = async (user: AuthUser) => {
    setCurrentUser(user);
    setIsAuthModalOpen(false);
    setAppliedStatus(`✓ Signed in to Supabase Cloud (${user.email})`);
    await syncUserDataFromCloud(user.id);
    setTimeout(() => setAppliedStatus(null), 3500);
  };

  const handleSaveCurrentResumeToCloud = async (customTitle?: string) => {
    if (!currentUser) {
      setIsAuthModalOpen(true);
      return;
    }

    const currentText = screenResume?.fullText || parsedResume?.rawText || '';
    if (!currentText.trim()) {
      setAppliedStatus('⚠️ Resume content is empty. Add content first.');
      setTimeout(() => setAppliedStatus(null), 3000);
      return;
    }

    setIsCloudSaving(true);
    try {
      const candidateDisplayName = (applicantProfile.firstName || applicantProfile.lastName)
        ? `${applicantProfile.firstName} ${applicantProfile.lastName}`.trim()
        : (applicantProfile.fullName || 'Candidate');
      const resumeTitle = customTitle || screenResume?.title || `${candidateDisplayName} — Resume`;

      const result = await saveResume(currentUser.id, {
        id: activeCloudResumeId || undefined,
        title: resumeTitle,
        raw_text: currentText,
        content_html: currentText,
        target_role: currentJob.title || applicantProfile.targetRole || 'Software Engineer',
        ats_score: currentAtsScore,
        parsed_resume: parsedResume,
        is_default: userCloudResumes.length === 0,
      });

      if (result.data) {
        setActiveCloudResumeId(result.data.id);
        const updatedResumes = await fetchUserResumes(currentUser.id);
        setUserCloudResumes(updatedResumes);
        setAppliedStatus(`✓ Resume saved to Supabase Cloud ("${result.data.title}")`);
      } else {
        throw new Error(result.error || 'Failed to save resume');
      }
    } catch (err: any) {
      console.error('[Supabase] Save resume error:', err);
      setAppliedStatus(`⚠️ Cloud save error: ${err.message || 'Check connection'}`);
    } finally {
      setIsCloudSaving(false);
      setTimeout(() => setAppliedStatus(null), 3500);
    }
  };

  const handleSelectCloudResume = (resume: CloudResume) => {
    setActiveCloudResumeId(resume.id);
    const resumeText = resume.content_html || resume.raw_text;
    setScreenResume({
      title: resume.title,
      fullText: resumeText,
      isGoogleDoc: false,
    });
    setParsedResume(resumeParser.parse(resumeText));
    try {
      localStorage.setItem('user_custom_resume', resumeText);
    } catch {}
    setIsCloudManagerOpen(false);
    setActiveTab('canvas');
    setAppliedStatus(`✓ Loaded Cloud Resume: "${resume.title}"`);
    setTimeout(() => setAppliedStatus(null), 3500);
  };

  const handleDeleteCloudResume = async (resumeId: string) => {
    if (!currentUser) return;
    try {
      await deleteResume(resumeId);
      const updated = userCloudResumes.filter(r => r.id !== resumeId);
      setUserCloudResumes(updated);
      if (activeCloudResumeId === resumeId) {
        setActiveCloudResumeId(updated.length > 0 ? updated[0].id : null);
      }
    } catch (err: any) {
      console.error('[Supabase] Delete resume error:', err);
    }
  };

  const handleSetDefaultCloudResume = async (resumeId: string) => {
    if (!currentUser) return;
    try {
      await setDefaultResume(currentUser.id, resumeId);
      const updated = userCloudResumes.map(r => ({
        ...r,
        is_default: r.id === resumeId,
      }));
      setUserCloudResumes(updated);
    } catch (err: any) {
      console.error('[Supabase] Set default resume error:', err);
    }
  };

  const handleSignOut = async () => {
    try {
      await supabaseSignOut();
      setCurrentUser(null);
      setUserCloudResumes([]);
      setActiveCloudResumeId(null);
      setAppliedStatus('✓ Signed out of Supabase Cloud');
      setTimeout(() => setAppliedStatus(null), 3000);
    } catch (err) {
      console.error('[Supabase] Sign out error:', err);
    }
  };

  const handleUpdateApplicantProfile = async (updated: ApplicantProfile) => {
    setApplicantProfile(updated);
    try {
      await saveStoredApplicantProfile(updated);
      if (currentUser) {
        await upsertUserProfile(currentUser.id, {
          firstName: updated.firstName,
          lastName: updated.lastName,
          email: updated.email || currentUser.email,
          phone: updated.phone,
          location: updated.location,
          targetRole: updated.targetRole,
          skills: updated.skills,
          school: updated.school,
          degree: updated.degree,
          major: updated.major,
          gpa: updated.gpa,
          gradMonthYear: updated.gradMonthYear,
          workAuthorization: updated.workAuthorization,
          requiresVisaSponsorship: updated.requiresVisaSponsorship,
          githubUrl: updated.githubUrl,
          linkedinUrl: updated.linkedinUrl,
          portfolioUrl: updated.portfolioUrl,
        });
      }
    } catch (e) {
      console.error('[App] Failed to save profile update:', e);
    }
  };

  return (
    <div className={`min-h-screen flex flex-col bg-[#FAFAFA] dark:bg-[#09090B] text-zinc-900 dark:text-zinc-100 transition-colors duration-200 ${isDark ? 'dark' : ''}`}>
      {/* Top Navigation Bar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        applicantProfile={applicantProfile}
        connectedDocTitle={screenResume?.title || (applicantProfile?.firstName ? `${applicantProfile.firstName}'s Resume` : 'Hacky Web Resume')}
        newJobsCount={newJobsCount}
        themeMode={themeMode}
        isDark={isDark}
        onToggleTheme={handleToggleTheme}
        currentUser={currentUser}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        onSignOut={handleSignOut}
        onOpenCloudManager={() => setIsCloudManagerOpen(true)}
      />

      {/* Main Container */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'home' && (
          <HomePage
            onOpenCanvas={() => {
              const textToLoad = screenResume?.fullText || parsedResume?.rawText || googleDocs.getMockMasterResume(applicantProfile).fullText;
              const candidateTitle = applicantProfile?.firstName ? `${applicantProfile.firstName}'s Master Resume` : 'My Master Resume';
              handleSelectOption2InAppCanvas(textToLoad, screenResume?.title || candidateTitle);
              setActiveTab('canvas');
            }}
            onNavigateToDiscovery={() => setActiveTab('discovery')}
            onNavigateToTracker={() => setActiveTab('tracker')}
            onSelectRoleTarget={(job) => {
              setCurrentJob(job);
              setActiveTab('canvas');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            connectedDocTitle={screenResume?.title}
            recentApplicationsCount={applications.length || 4}
            newJobsCount={newJobsCount}
            onUploadResumeFile={handleUploadResumeFile}
          />
        )}

        {activeTab === 'canvas' && (
          <div className="w-full max-w-7xl mx-auto px-2 sm:px-4 md:px-6 py-4 animate-in fade-in duration-200">
            <InAppDocumentCanvas
              parsedResume={parsedResume}
              rawText={screenResume?.fullText || parsedResume?.rawText || googleDocs.getMockMasterResume(applicantProfile).fullText}
              diffs={tailorData?.bulletDiffs || []}
              onUpdateResumeText={handleUpdateCustomResumeText}
              onApplyBulletDiff={(diffIndex, variantText) => {
                if (!tailorData?.bulletDiffs?.[diffIndex]) return;
                const diff = tailorData.bulletDiffs[diffIndex];
                const replacement = (variantText || diff.tailoredText).trim();
                let current = screenResume?.fullText || parsedResume?.rawText || '';
                if (diff.originalText && current.includes(diff.originalText)) {
                  current = current.replace(diff.originalText, replacement);
                  handleUpdateCustomResumeText(current);
                }
                setTailorData(prev => {
                  if (!prev) return prev;
                  return {
                    ...prev,
                    bulletDiffs: prev.bulletDiffs.map((d, i) => i === diffIndex ? { ...d, tailoredText: replacement, status: 'accepted' as const } : d)
                  };
                });
              }}
              onApplyAllDiffs={() => {
                if (!tailorData?.bulletDiffs) return;
                let current = screenResume?.fullText || parsedResume?.rawText || '';
                for (const diff of tailorData.bulletDiffs) {
                  if (diff.originalText && current.includes(diff.originalText)) {
                    current = current.replace(diff.originalText, diff.tailoredText);
                  }
                }
                handleUpdateCustomResumeText(current);
                setTailorData(prev => {
                  if (!prev) return prev;
                  return {
                    ...prev,
                    bulletDiffs: prev.bulletDiffs.map(d => ({ ...d, status: 'accepted' as const }))
                  };
                });
              }}
              onReopenGateway={() => setShowWorkspaceGateway(true)}
              applicantProfile={applicantProfile}
              isGoogleDocMode={workspaceMode === 'google_docs'}
              docUrl={screenResume?.url}
              onSyncGoogleDoc={handleReadScreenNow}
              onPushToGoogleDoc={tailorData?.bulletDiffs ? () => handleApplyToGoogleDoc(tailorData.bulletDiffs.filter(d => d.status === 'accepted')) : undefined}
              onUploadFile={handleUploadResumeFile}
              documentTitle={screenResume?.title}
              onUpdateDocumentTitle={(title) => {
                if (screenResume) {
                  setScreenResume({ ...screenResume, title });
                }
              }}
              currentJob={currentJob}
              onUpdateCurrentJob={setCurrentJob}
              onTriggerTailor={handleTriggerTailor}
              tailorData={tailorData}
              isTailorLoading={isLoading}
              targetRole={currentJob.title || 'Senior Software Engineer'}
              atsScore={currentAtsScore}
              isCloudSynced={!!currentUser}
              isCloudSaving={isCloudSaving}
              onSaveToCloud={handleSaveCurrentResumeToCloud}
              onOpenCloudManager={() => setIsCloudManagerOpen(true)}
              cloudResumesCount={userCloudResumes.length}
              currentUser={currentUser}
              onOpenAuthModal={() => setIsAuthModalOpen(true)}
            />
          </div>
        )}

        {activeTab === 'discovery' && (
          <DiscoveryTab
            jobs={jobs}
            onSelectJobForTailoring={handleTailorForJob}
            onSyncGitHub={handleSyncGitHub}
            isSyncing={isSyncingJobs}
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

        {activeTab === 'profile' && (
          <ProfileTab
            profile={applicantProfile}
            onUpdateProfile={handleUpdateApplicantProfile}
            onReopenOnboarding={() => setIsOnboardingOpen(true)}
            onNavigateToWorkspace={(mode) => {
              if (mode) {
                setWorkspaceMode(mode);
                saveStoredWorkspaceMode(mode);
                if (mode === 'in_app_canvas') {
                  setActiveTab('canvas');
                  return;
                }
              }
              setActiveTab('canvas');
            }}
            connectedDocTitle={screenResume?.title}
            workspaceMode={workspaceMode}
            currentUser={currentUser}
            onOpenAuthModal={() => setIsAuthModalOpen(true)}
            onSignOut={handleSignOut}
            cloudResumesCount={userCloudResumes.length}
            onOpenCloudManager={() => setIsCloudManagerOpen(true)}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsTab
            currentThemeMode={themeMode}
            onThemeChange={handleThemeChange}
            onReopenOnboarding={() => setIsOnboardingOpen(true)}
          />
        )}
      </main>

      {/* Pre-Flight Apply Modal */}
      <PreFlightApplyModal
        isOpen={isPreFlightOpen}
        onClose={() => setIsPreFlightOpen(false)}
        report={preFlightReport}
        profile={applicantProfile}
        job={currentJob}
        tailoredDocId={(forkedDocUrl ? extractGoogleDocId(forkedDocUrl) : undefined) || undefined}
        tailoredDocUrl={forkedDocUrl || undefined}
        atsScore={currentAtsScore}
        customAnswers={customAnswers}
        onUpdateCustomAnswer={(key, text) => setCustomAnswers(prev => ({ ...prev, [key]: text }))}
        onConfirmSubmit={async () => {
          setIsSubmittingApp(true);
          setTimeout(() => {
            setIsSubmittingApp(false);
            setSubmitAppSuccess(true);
          }, 1000);
        }}
        onTriggerAssistOnly={async () => {
          setIsSubmittingApp(true);
          setTimeout(() => {
            setIsSubmittingApp(false);
            setSubmitAppSuccess(true);
          }, 600);
        }}
        isSubmitting={isSubmittingApp}
        submitError={submitAppError}
        submitSuccess={submitAppSuccess}
        pdfAttachmentState={pdfAttachmentState}
      />

      {/* Mandatory Onboarding Modal — Required for all users */}
      {isOnboardingOpen && (
        <OnboardingModal
          initialProfile={applicantProfile}
          onComplete={(savedProfile) => {
            setApplicantProfile(savedProfile);
            setIsOnboardingOpen(false);
            // Land on uncluttered Home page where user can select Option 1 or Option 2
            setActiveTab('home');
          }}
        />
      )}

      {/* Supabase Authentication Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={handleAuthSuccess}
      />

      {/* Supabase Cloud Resume Manager Modal */}
      {currentUser && (
        <CloudResumeManagerModal
          isOpen={isCloudManagerOpen}
          onClose={() => setIsCloudManagerOpen(false)}
          userId={currentUser.id}
          resumes={userCloudResumes}
          activeResumeId={activeCloudResumeId || undefined}
          onSelectResume={handleSelectCloudResume}
          onRefreshResumes={async () => {
            const updated = await fetchUserResumes(currentUser.id);
            setUserCloudResumes(updated);
          }}
          currentCanvasText={screenResume?.fullText || parsedResume?.rawText || ''}
          currentDocTitle={screenResume?.title}
          currentRole={currentJob.title || applicantProfile.targetRole}
          currentScore={currentAtsScore}
        />
      )}

      {/* Floating Hacky Mascot Web Companion */}
      <HackyWebMascot
        activeTab={activeTab}
        onNavigateTab={setActiveTab}
        atsScore={currentAtsScore}
      />
    </div>
  );
};

export default App;
