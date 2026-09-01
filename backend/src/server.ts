import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { AtsScorerService } from './services/ats-scorer.js';
import { LlmTailorService } from './services/llm-tailor.js';
import { GoogleDocsService } from './services/google-docs.js';
import { GoogleDriveService } from './services/google-drive.js';
import { VisualLayoutAnalyzerService } from './services/visual-layout-analyzer.js';
import { CURATED_JOB_LISTINGS } from './data/curated-jobs.js';
import { ApplicationRecord, TailorResumeResponse, ResumeBullet } from './types/index.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

const atsScorer = new AtsScorerService();
const llmTailor = new LlmTailorService();
const googleDocs = new GoogleDocsService();
const googleDrive = new GoogleDriveService();
const visualAnalyzer = new VisualLayoutAnalyzerService();

// In-memory application CRM store
const applicationStore: ApplicationRecord[] = [
  {
    id: 'app-1',
    jobId: 'job-1',
    company: 'Stripe',
    title: 'Software Engineering Intern',
    location: 'San Francisco, CA',
    status: 'Tailored',
    jobUrl: 'https://stripe.com/jobs/search?q=intern',
    masterDocId: 'mock-master-doc',
    tailoredDocId: 'tailored-stripe-1',
    tailoredDocUrl: 'https://docs.google.com/document/d/tailored-stripe-1/edit',
    pdfExportUrl: 'https://docs.google.com/document/d/tailored-stripe-1/export?format=pdf',
    atsScoreAtApplication: 92,
    salary: '$58 - $65 / hr',
    updatedAt: new Date().toISOString()
  },
  {
    id: 'app-2',
    jobId: 'job-2',
    company: 'OpenAI',
    title: 'AI / Full-Stack Engineer Intern',
    location: 'San Francisco, CA',
    status: 'Applied',
    appliedDate: '2026-08-20',
    jobUrl: 'https://openai.com/careers',
    masterDocId: 'mock-master-doc',
    tailoredDocId: 'tailored-openai-1',
    tailoredDocUrl: 'https://docs.google.com/document/d/tailored-openai-1/edit',
    atsScoreAtApplication: 95,
    salary: '$65 - $75 / hr',
    updatedAt: new Date().toISOString()
  }
];

// 1. Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'ResumeHack API Engine', version: '1.0.0' });
});

// 2. Curated Jobs & Internship Feed
app.get('/api/jobs', (req: Request, res: Response) => {
  const { category, type, search } = req.query;
  let results = [...CURATED_JOB_LISTINGS];

  if (category && typeof category === 'string') {
    results = results.filter(j => j.category === category);
  }
  if (type && typeof type === 'string') {
    results = results.filter(j => j.type === type);
  }
  if (search && typeof search === 'string') {
    const q = search.toLowerCase();
    results = results.filter(j => 
      j.title.toLowerCase().includes(q) || 
      j.company.toLowerCase().includes(q) ||
      j.description.toLowerCase().includes(q)
    );
  }

  res.json({ count: results.length, jobs: results });
});

// 3. ATS Keyword Analysis & Gap Scorer
app.post('/api/analyze', (req: Request, res: Response) => {
  const { resumeText, jobDescription } = req.body;
  if (!resumeText || !jobDescription) {
    return res.status(400).json({ error: 'resumeText and jobDescription are required.' });
  }

  const report = atsScorer.analyze(resumeText, jobDescription);
  res.json(report);
});

// 3.1. Visual Layout Snapshot & Aesthetic Quality Analysis
app.post('/api/visual-layout/analyze', async (req: Request, res: Response) => {
  try {
    const {
      documentId,
      accessToken,
      structuralParagraphs,
      layoutInfo,
      jobDescription,
      domain,
      aiSettings,
    } = req.body;

    const report = await visualAnalyzer.analyzeVisualSnapshot({
      documentId,
      accessToken,
      structuralParagraphs,
      layoutInfo,
      jobDescription,
      domain,
      settings: aiSettings,
    });

    res.json(report);
  } catch (error: any) {
    console.error('Visual layout analysis error:', error);
    res.status(500).json({ error: error.message || 'Visual layout analysis failed' });
  }
});

// 4. Full Resume Tailoring & Diff Generation
app.post('/api/tailor', async (req: Request, res: Response) => {
  try {
    const { documentId, jobDescription, jobTitle = 'Target Role', company = 'Target Company', accessToken, resumeText: rawResumeText } = req.body;

    if (!jobDescription) {
      return res.status(400).json({ error: 'jobDescription is required.' });
    }

    let extractedBullets: ResumeBullet[] = [];
    let resumeText = rawResumeText || '';

    if (documentId) {
      const docData = await googleDocs.getDocumentAndExtractBullets(documentId, accessToken);
      extractedBullets = docData.bullets;
      if (!resumeText) {
        resumeText = docData.fullText;
      }
    }

    // Run ATS Score analysis
    const atsReport = atsScorer.analyze(resumeText, jobDescription);

    // Generate bullet diffs
    const bulletDiffs = llmTailor.tailorBullets(extractedBullets, jobDescription, atsReport, jobTitle, company);

    const projectedNewScore = Math.min(98, Math.round(atsReport.overallScore + 18));

    const response: TailorResumeResponse = {
      jobTitle,
      company,
      atsReport,
      projectedNewScore,
      bulletDiffs,
      optimizedSummary: `High-impact ${jobTitle} candidate with demonstrated expertise in ${atsReport.keywords.filter(k => k.foundInResume).slice(0, 3).map(k => k.keyword).join(', ')}. Proven track record of architecting scalable systems and delivering measurable results.`
    };

    res.json(response);
  } catch (error: any) {
    console.error('Tailor error:', error);
    res.status(500).json({ error: error.message || 'Internal tailoring error' });
  }
});

// 5. Apply batch updates to Google Doc
app.post('/api/docs/apply', async (req: Request, res: Response) => {
  try {
    const { documentId, diffs, accessToken } = req.body;
    if (!documentId || !diffs) {
      return res.status(400).json({ error: 'documentId and diffs are required.' });
    }

    const result = await googleDocs.applyBatchUpdates(documentId, diffs, accessToken);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 6. Fork Google Doc & Generate Tailored Copy in Drive
app.post('/api/docs/fork', async (req: Request, res: Response) => {
  try {
    const { documentId, company, candidateName, diffs, accessToken } = req.body;
    if (!documentId || !company) {
      return res.status(400).json({ error: 'documentId and company are required.' });
    }

    // Step 1: Duplicate document
    const forked = await googleDrive.forkDocument(documentId, company, candidateName, accessToken);

    // Step 2: If diffs provided, apply them to the new document
    if (diffs && diffs.length > 0) {
      await googleDocs.applyBatchUpdates(forked.newDocId, diffs, accessToken);
    }

    const pdfExportUrl = googleDrive.getPdfExportUrl(forked.newDocId);

    res.json({
      success: true,
      forkedDocId: forked.newDocId,
      docName: forked.newDocName,
      docUrl: forked.webViewLink,
      pdfExportUrl
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 7. Applications CRM Tracker
app.get('/api/applications', (_req: Request, res: Response) => {
  res.json({ applications: applicationStore });
});

app.post('/api/applications', (req: Request, res: Response) => {
  const newApp: ApplicationRecord = {
    id: `app-${Date.now()}`,
    jobId: req.body.jobId || `job-${Date.now()}`,
    company: req.body.company || 'Company',
    title: req.body.title || 'Role',
    location: req.body.location || 'Remote',
    status: req.body.status || 'Bookmarked',
    jobUrl: req.body.jobUrl || '',
    masterDocId: req.body.masterDocId,
    tailoredDocId: req.body.tailoredDocId,
    tailoredDocUrl: req.body.tailoredDocUrl,
    pdfExportUrl: req.body.pdfExportUrl,
    atsScoreAtApplication: req.body.atsScoreAtApplication || 85,
    notes: req.body.notes || '',
    salary: req.body.salary,
    updatedAt: new Date().toISOString()
  };

  applicationStore.unshift(newApp);
  res.status(201).json(newApp);
});

app.patch('/api/applications/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const index = applicationStore.findIndex(a => a.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Application not found' });
  }

  applicationStore[index] = {
    ...applicationStore[index],
    ...req.body,
    updatedAt: new Date().toISOString()
  };

  res.json(applicationStore[index]);
});

// 8. Google OAuth PKCE & Web Application Token Exchange
app.post('/api/auth/google/exchange', async (req: Request, res: Response) => {
  try {
    const { code, codeVerifier, redirectUri, clientId } = req.body;
    if (!code || !codeVerifier) {
      return res.status(400).json({ error: 'code and codeVerifier are required.' });
    }

    const activeClientId = clientId || process.env.GOOGLE_WEB_CLIENT_ID || '';
    const activeClientSecret = process.env.GOOGLE_WEB_CLIENT_SECRET || '';
    const activeRedirectUri = redirectUri || process.env.GOOGLE_REDIRECT_URI || '';

    const bodyParams = new URLSearchParams({
      client_id: activeClientId.trim(),
      client_secret: activeClientSecret.trim(),
      code: code.trim(),
      code_verifier: codeVerifier.trim(),
      grant_type: 'authorization_code',
      redirect_uri: activeRedirectUri,
    });

    const googleRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: bodyParams.toString(),
    });

    const data = await googleRes.json().catch(() => ({}));

    if (!googleRes.ok) {
      console.warn('[Backend Auth] Google token exchange rejected:', data);
      return res.status(googleRes.status).json({
        error: data?.error_description || data?.error || `Google OAuth Error (${googleRes.status})`,
        details: data,
      });
    }

    res.json({
      success: true,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in || 3600,
      scope: data.scope,
      tokenType: data.token_type,
    });
  } catch (err: any) {
    console.error('[Backend Auth] Exchange error:', err);
    res.status(500).json({ error: err?.message || 'Server error during OAuth exchange' });
  }
});

// 9. Google OAuth Refresh Token Renewal
app.post('/api/auth/google/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken, clientId } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: 'refreshToken is required.' });
    }

    const activeClientId = clientId || process.env.GOOGLE_WEB_CLIENT_ID || '';
    const activeClientSecret = process.env.GOOGLE_WEB_CLIENT_SECRET || '';

    const bodyParams = new URLSearchParams({
      client_id: activeClientId.trim(),
      client_secret: activeClientSecret.trim(),
      refresh_token: refreshToken.trim(),
      grant_type: 'refresh_token',
    });

    const googleRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: bodyParams.toString(),
    });

    const data = await googleRes.json().catch(() => ({}));

    if (!googleRes.ok) {
      return res.status(googleRes.status).json({
        error: data?.error_description || data?.error || `Google OAuth Error (${googleRes.status})`,
      });
    }

    res.json({
      success: true,
      accessToken: data.access_token,
      expiresIn: data.expires_in || 3600,
    });
  } catch (err: any) {
    console.error('[Backend Auth] Refresh error:', err);
    res.status(500).json({ error: err?.message || 'Server error refreshing token' });
  }
});

app.listen(PORT, () => {
  console.log(`ResumeHack Backend Engine listening on http://localhost:${PORT}`);
});
