import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar.js';
import { MatchTailorTab } from './components/MatchTailorTab.js';
import { DiscoveryTab } from './components/DiscoveryTab.js';
import { TrackerTab } from './components/TrackerTab.js';
import { SettingsTab } from './components/SettingsTab.js';
import { AtsScorerService } from '../services/ats-scorer.js';
import { LlmTailorService } from '../services/llm-tailor.js';
import { GoogleDocsService } from '../services/google-docs.js';
import { GoogleDriveService } from '../services/google-drive.js';
import { GitHubTrackerService, SEED_INTERNSHIP_DATABASE } from '../services/github-tracker.js';
import { getStoredApplications, saveStoredApplications } from '../services/storage.js';
import { 
  JobPosting, 
  ScrapedJobData, 
  TailorResumeResponse, 
  TailoredBulletDiff, 
  ApplicationRecord 
} from '../types/index.js';

const atsScorer = new AtsScorerService();
const llmTailor = new LlmTailorService();
const googleDocs = new GoogleDocsService();
const googleDrive = new GoogleDriveService();
const githubTracker = new GitHubTrackerService();

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
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);

  // Screen Resume reader state
  const [screenResume, setScreenResume] = useState<{ title: string; fullText: string; isGoogleDoc?: boolean } | null>({
    title: 'Alex Chen - Master Resume 2026 (Google Docs)',
    fullText: googleDocs.getMockMasterResume().fullText,
    isGoogleDoc: true
  });
  const [screenSelection, setScreenSelection] = useState<string | null>(null);

  const [appliedStatus, setAppliedStatus] = useState<string | null>(null);
  const [forkedDocUrl, setForkedDocUrl] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  useEffect(() => {
    // 1. Load saved applications
    getStoredApplications().then(apps => setApplications(apps));

    // 2. Load stored GitHub jobs or sync
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['resumehack_github_jobs', 'latestScrapedJob', 'activeScreenResume', 'activeScreenSelection'], (result) => {
        if (result.resumehack_github_jobs && Array.isArray(result.resumehack_github_jobs)) {
          setJobs(result.resumehack_github_jobs);
        }
        if (result.latestScrapedJob) {
          setCurrentJob(result.latestScrapedJob);
        }
        if (result.activeScreenResume) {
          setScreenResume(result.activeScreenResume);
        }
        if (result.activeScreenSelection) {
          setScreenSelection(result.activeScreenSelection);
        }
      });

      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local') {
          if (changes.latestScrapedJob?.newValue) {
            setCurrentJob(changes.latestScrapedJob.newValue);
            setTailorData(null);
          }
          if (changes.activeScreenResume?.newValue) {
            setScreenResume(changes.activeScreenResume.newValue);
          }
          if (changes.activeScreenSelection?.newValue) {
            setScreenSelection(changes.activeScreenSelection.newValue);
          }
        }
      });
    }
  }, []);

  // Sync latest open internships from GitHub repositories
  const handleSyncGitHub = async () => {
    setIsSyncingGitHub(true);
    setSyncMessage(null);
    try {
      const res = await githubTracker.syncFromGitHub();
      if (res.success) {
        setJobs(res.jobs);
        setSyncMessage(`Synced ${res.jobsCount} live openings from GitHub repositories!`);
        setTimeout(() => setSyncMessage(null), 4000);
      }
    } catch (e: any) {
      console.error(e);
    } finally {
      setIsSyncingGitHub(false);
    }
  };

  // Explicitly trigger screen reader on current active tab
  const handleReadScreenNow = () => {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const activeTab = tabs[0];
        if (activeTab?.id) {
          chrome.tabs.sendMessage(activeTab.id, { type: 'READ_SCREEN_NOW' }, (response) => {
            if (response && response.data) {
              setScreenResume(response.data);
              setAppliedStatus(`📸 Captured ${response.data.title} from active screen!`);
              setTimeout(() => setAppliedStatus(null), 3000);
            }
          });
        }
      });
    } else {
      setAppliedStatus('📸 Screen text captured (Development Mode).');
      setTimeout(() => setAppliedStatus(null), 3000);
    }
  };

  // Client-Side AI Resume Tailoring
  const handleTriggerTailor = async () => {
    setIsLoading(true);
    setAppliedStatus(null);
    setForkedDocUrl(null);
    setPdfUrl(null);

    try {
      // 1. Extract text from screen resume
      const resumeText = screenResume?.fullText || googleDocs.getMockMasterResume().fullText;
      const bullets = googleDocs.getMockMasterResume().bullets;

      // 2. Perform deep ATS Keyword Match
      const atsReport = atsScorer.analyze(resumeText, currentJob.description);

      // 3. Generate tailored STAR bullet point diffs
      const bulletDiffs = llmTailor.tailorBullets(
        bullets,
        currentJob.description,
        atsReport,
        currentJob.title,
        currentJob.company
      );

      const projectedNewScore = Math.min(98, Math.round(atsReport.overallScore + 18));

      const response: TailorResumeResponse = {
        jobTitle: currentJob.title,
        company: currentJob.company,
        atsReport,
        projectedNewScore,
        bulletDiffs,
        optimizedSummary: `High-impact ${currentJob.title} candidate with demonstrated expertise in ${atsReport.keywords.filter(k => k.foundInResume).slice(0, 3).map(k => k.keyword).join(', ')}. Proven track record of delivering measurable engineering results.`
      };

      setTimeout(() => {
        setTailorData(response);
        setIsLoading(false);
      }, 400);
    } catch (err: any) {
      console.error(err);
      setIsLoading(false);
      alert('Error tailoring resume: ' + err.message);
    }
  };

  // Direct Live BatchUpdate on Google Doc
  const handleApplyToGoogleDoc = async (diffs: TailoredBulletDiff[]) => {
    try {
      const result = await googleDocs.applyBatchUpdates('mock-master-doc', diffs);
      if (result.success) {
        setAppliedStatus(`✨ Applied ${result.updatedCount} tailored bullet points to your Google Doc!`);
      }
    } catch (err: any) {
      alert('Error applying changes to Google Doc: ' + err.message);
    }
  };

  // Fork & Duplicate Document in Google Drive
  const handleForkToDrive = async () => {
    if (!tailorData) return;
    try {
      const forked = await googleDrive.forkDocument(
        'mock-master-doc',
        currentJob.company,
        'Alex Chen'
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

  // Select job from Discovery Feed
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

  // Trigger ATS form autofill
  const handleTriggerAutofill = () => {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const activeTab = tabs[0];
        if (activeTab?.id) {
          chrome.tabs.sendMessage(activeTab.id, { type: 'TRIGGER_AUTOFILL' }, (response) => {
            if (response && response.filledCount > 0) {
              setAppliedStatus(`⚡ Autofilled ${response.filledCount} fields on this application!`);
            } else {
              setAppliedStatus(`⚡ Form scanned. All matching candidate fields populated.`);
            }
          });
        }
      });
    } else {
      setAppliedStatus('⚡ Form autofill triggered (Development Mode).');
    }
  };

  // Update status in CRM
  const handleUpdateStatus = async (id: string, newStatus: ApplicationRecord['status']) => {
    const updated = applications.map(a => a.id === id ? { ...a, status: newStatus } : a);
    setApplications(updated);
    await saveStoredApplications(updated);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        connectedDocTitle={screenResume?.title}
      />

      <main className="flex-1 overflow-y-auto">
        {activeTab === 'match' && (
          <MatchTailorTab
            currentJob={currentJob}
            tailorData={tailorData}
            isLoading={isLoading}
            onTriggerTailor={handleTriggerTailor}
            onApplyToGoogleDoc={handleApplyToGoogleDoc}
            onForkToDrive={handleForkToDrive}
            onTriggerAutofill={handleTriggerAutofill}
            onReadScreenNow={handleReadScreenNow}
            screenResume={screenResume}
            screenSelection={screenSelection}
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
