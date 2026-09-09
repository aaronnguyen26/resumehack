import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar.js';
import { MatchTailorTab } from './components/MatchTailorTab.js';
import { DiscoveryTab } from './components/DiscoveryTab.js';
import { TrackerTab } from './components/TrackerTab.js';
import { SettingsTab } from './components/SettingsTab.js';
import { PreFlightApplyModal } from './components/PreFlightApplyModal.js';
import { OnboardingModal } from './components/OnboardingModal.js';
import { HackyWebMascot } from './components/HackyWebMascot.js';
import { AtsScorerService } from './services/ats-scorer.js';
import { LlmTailorService } from './services/llm-tailor.js';
import { AiTailorService, getAiSettings } from './services/ai-tailor.js';
import { GitHubTrackerService, SEED_INTERNSHIP_DATABASE, enrichJobDetails } from './services/github-tracker.js';
import { ResumeParserService, ParsedResume } from './services/resume-parser.js';
import { GoogleDocsService } from './services/google-docs.js';
import { CompanyArchetypeClassifier } from './services/archetype-classifier.js';
import { 
  getStoredApplications, 
  saveStoredApplications, 
  getStoredApplicantProfile,
  DEFAULT_APPLICANT_PROFILE,
  isNewUser,
  getStoredSettings,
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

const atsScorer = new AtsScorerService();
const llmTailor = new LlmTailorService();
const aiTailor = new AiTailorService();
const githubTracker = new GitHubTrackerService();
const resumeParser = new ResumeParserService();
const googleDocs = new GoogleDocsService();
const autoSubmitEngine = new AutoSubmitEngine();

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
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);

  // User Resume State
  const [screenResume, setScreenResume] = useState<{ title: string; fullText: string; isGoogleDoc?: boolean; url?: string } | null>(null);
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
      const requestedTab = params.get('tab') as 'match' | 'discovery' | 'tracker' | 'settings' | null;
      if (requestedTab && ['match', 'discovery', 'tracker', 'settings'].includes(requestedTab)) {
        setActiveTab(requestedTab);
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

  const handleSelectOption1GoogleDocs = (docId?: string, docTitle?: string) => {
    setWorkspaceMode('google_docs');
    saveStoredWorkspaceMode('google_docs');
    setShowWorkspaceGateway(false);
    if (docId === 'mock-master-resume-doc-id' || !docId) {
      const mock = googleDocs.getMockMasterResume();
      setScreenResume({ title: docTitle || mock.title, fullText: mock.fullText, isGoogleDoc: true });
      setParsedResume(resumeParser.parse(mock.fullText));
    } else {
      setScreenResume({ 
        title: docTitle || 'Linked Google Doc', 
        fullText: screenResume?.fullText || googleDocs.getMockMasterResume().fullText, 
        isGoogleDoc: true 
      });
    }
    setAppliedStatus('✓ Connected Google Docs Workspace');
    setTimeout(() => setAppliedStatus(null), 3500);
  };

  const handleSelectOption2InAppCanvas = (text: string, title?: string) => {
    setWorkspaceMode('in_app_canvas');
    saveStoredWorkspaceMode('in_app_canvas');
    setShowWorkspaceGateway(false);
    const parsed = resumeParser.parse(text);
    setParsedResume(parsed);
    setScreenResume({
      title: title || (parsed.candidateName !== 'Your Resume' ? `${parsed.candidateName} Resume` : 'My Master Resume'),
      fullText: text,
      isGoogleDoc: false,
    });
    try {
      localStorage.setItem('user_custom_resume', text);
    } catch {}
    setAppliedStatus('✓ Loaded In-App Document Canvas');
    setTimeout(() => setAppliedStatus(null), 3500);
  };

  const handleOpenGooglePicker = async () => {
    try {
      let token = await getGoogleAccessToken();
      if (!token) {
        const authRes = await authenticateGoogleAccount(true);
        if (authRes.success && authRes.accessToken) {
          token = authRes.accessToken;
        } else {
          handleSelectOption1GoogleDocs('mock-master-resume-doc-id', 'Alex Chen — Master Resume (Google Doc)');
          return;
        }
      }
      await openGoogleDocPicker({
        accessToken: token,
        onPicked: async (doc) => {
          handleSelectOption1GoogleDocs(doc.id, doc.name);
        },
        onCancel: () => {},
        onError: (err) => {
          console.warn('[App] Google Picker note:', err);
          handleSelectOption1GoogleDocs('mock-master-resume-doc-id', 'Alex Chen — Master Resume (Google Doc)');
        }
      });
    } catch (err) {
      console.warn('[App] Google Picker note:', err);
      handleSelectOption1GoogleDocs('mock-master-resume-doc-id', 'Alex Chen — Master Resume (Google Doc)');
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
    setActiveTab('match');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleTriggerTailor = async () => {
    setIsLoading(true);
    setAppliedStatus('Scanning resume and analyzing job description…');

    try {
      let resumeText = screenResume?.fullText || parsedResume?.rawText || '';
      if (!resumeText.trim()) {
        const mock = googleDocs.getMockMasterResume();
        resumeText = mock.fullText;
        setScreenResume({ title: mock.title, fullText: mock.fullText, isGoogleDoc: true });
        setParsedResume(resumeParser.parse(mock.fullText));
      }

      const currentParsed = parsedResume || resumeParser.parse(resumeText);
      const atsReport = atsScorer.analyze(resumeText, currentJob.description);
      const archetype = CompanyArchetypeClassifier.classify(currentJob.company, currentJob.description);

      const userBullets = currentParsed.bullets.length > 0 ? currentParsed.bullets : [
        {
          id: 'b-1',
          section: 'Experience',
          organization: 'Software Engineer',
          role: 'Candidate',
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
    setAppliedStatus(`✓ Applied ${diffs.length} bullet diffs to tailored resume`);
    setTailorData(prev => {
      if (!prev) return prev;
      const ids = new Set(diffs.map(d => d.id));
      return {
        ...prev,
        bulletDiffs: prev.bulletDiffs.map(d => ids.has(d.id) ? { ...d, status: 'accepted' } : d)
      };
    });
    return true;
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
    setAppliedStatus('Creating tailored document copy…');
    setTimeout(() => {
      const forkedUrl = `https://docs.google.com/document/d/tailored-${Date.now()}/edit`;
      setForkedDocUrl(forkedUrl);
      setAppliedStatus('✓ Created tailored resume document!');
    }, 600);
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

  const handleReadScreenNow = () => {
    const mock = googleDocs.getMockMasterResume();
    setScreenResume({ title: mock.title, fullText: mock.fullText, isGoogleDoc: true });
    setParsedResume(resumeParser.parse(mock.fullText));
    setAppliedStatus('✓ Loaded Master Resume');
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

  const handleUpdateCustomResumeText = (text: string) => {
    const parsed = resumeParser.parse(text);
    setParsedResume(parsed);
    setScreenResume({
      title: parsed.candidateName !== 'Your Resume' ? `${parsed.candidateName} Resume` : 'My Custom Resume',
      fullText: text,
      isGoogleDoc: false
    });
    try {
      localStorage.setItem('user_custom_resume', text);
    } catch {}
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

  return (
    <div className={`min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors ${isDark ? 'dark' : ''}`}>
      {/* Top Navigation Bar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        connectedDocTitle={screenResume?.title || (parsedResume?.candidateName ? `${parsedResume.candidateName} Resume` : 'Hacky Web Resume')}
        newJobsCount={newJobsCount}
        themeMode={themeMode}
        isDark={isDark}
        onToggleTheme={handleToggleTheme}
      />

      {/* Main Container */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
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
            onNavigateToSettings={() => setActiveTab('settings')}
            appliedStatus={appliedStatus}
            forkedDocUrl={forkedDocUrl}
            pdfUrl={pdfUrl}
            workspaceMode={workspaceMode}
            onSetWorkspaceMode={(newMode) => {
              setWorkspaceMode(newMode);
              saveStoredWorkspaceMode(newMode);
            }}
            onOpenGooglePicker={handleOpenGooglePicker}
            onSelectGoogleDoc={handleSelectOption1GoogleDocs}
            applicantProfile={applicantProfile}
            showWorkspaceGateway={showWorkspaceGateway}
            onCloseGateway={() => setShowWorkspaceGateway(false)}
          />
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
            // As requested: after onboarding completes, present the Option 1 vs Option 2 choice on the main page
            setShowWorkspaceGateway(true);
            setActiveTab('match');
          }}
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
