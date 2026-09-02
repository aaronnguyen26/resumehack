import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { AtsScorerService } from './services/ats-scorer.js';
import { LlmTailorService } from './services/llm-tailor.js';
import { GoogleDocsService } from './services/google-docs.js';
import { GoogleDriveService } from './services/google-drive.js';
import { VisualLayoutAnalyzerService } from './services/visual-layout-analyzer.js';
import { CURATED_JOB_LISTINGS } from './data/curated-jobs.js';
import { ApplicationRecord } from './types/index.js';
import { db } from './db/index.js';
import { CompanyRegistryService } from './services/registry-auto-derivation.js';
import { AdaptivePollerScheduler } from './services/adaptive-poller.js';

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
const registryService = new CompanyRegistryService();
let pollerScheduler: AdaptivePollerScheduler | null = null;

// SSE Client Pool
const sseClients = new Set<Response>();

export function broadcastSseJobEvent(payload: any, eventId?: number | string) {
  const data = JSON.stringify(payload);
  const idStr = eventId ? `id: ${eventId}\n` : '';
  const frame = `${idStr}event: job_event\ndata: ${data}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(frame);
    } catch {
      sseClients.delete(client);
    }
  }
}

// 1. Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'ResumeHack API Engine', version: '1.0.0' });
});

// 2. Real-Time SSE Push Stream with Replay Buffer
app.get('/api/events/jobs', async (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  res.write(': connected\n\n');
  sseClients.add(res);

  // Catch-up replay for missed events
  const lastEventId = req.headers['last-event-id'] || req.query.lastEventId;
  if (lastEventId && !isNaN(Number(lastEventId)) && process.env.DATABASE_URL) {
    try {
      const missed = await db.getPool().query(
        `SELECT id, payload FROM job_events WHERE id > $1 ORDER BY id ASC LIMIT 100;`,
        [Number(lastEventId)]
      );
      for (const row of missed.rows) {
        res.write(`id: ${row.id}\nevent: job_event\ndata: ${JSON.stringify(row.payload)}\n\n`);
      }
    } catch (err: any) {
      console.debug('[SSE] Catch-up replay note:', err.message);
    }
  }

  // 15s Heartbeat ping
  const heartbeat = setInterval(() => {
    res.write(': keepalive\n\n');
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients.delete(res);
  });
});

// 2.1 Jobs Feed (Live ATS Database with Curated Fallback)
app.get('/api/jobs', async (req: Request, res: Response) => {
  const { category, type, search, fresh } = req.query;

  if (process.env.DATABASE_URL) {
    try {
      let querySql = `
        SELECT
          j.id,
          j.ats_job_id AS "atsJobId",
          c.name AS company,
          c.ats_type AS "atsType",
          j.title,
          j.location,
          j.department,
          j.job_url AS "jobUrl",
          j.description_clean AS description,
          j.category,
          j.job_type AS type,
          j.work_model AS "workModel",
          j.salary_range AS salary,
          j.skills,
          j.first_seen_at AS "firstSeenAt",
          j.created_at AS "createdAt",
          (j.first_seen_at > NOW() - INTERVAL '2 minutes') AS "isUltraFresh",
          (j.first_seen_at > NOW() - INTERVAL '24 hours') AS "isFreshAts"
        FROM ats_jobs j
        JOIN companies c ON j.company_id = c.id
        WHERE j.status = 'active'
      `;
      const params: any[] = [];

      if (category && typeof category === 'string' && category !== 'All') {
        params.push(category);
        querySql += ` AND j.category = $${params.length}`;
      }
      if (type && typeof type === 'string') {
        params.push(type);
        querySql += ` AND j.job_type = $${params.length}`;
      }
      if (fresh === 'true') {
        querySql += ` AND j.first_seen_at > NOW() - INTERVAL '24 hours'`;
      }
      if (search && typeof search === 'string') {
        params.push(`%${search.toLowerCase()}%`);
        querySql += ` AND (LOWER(j.title) LIKE $${params.length} OR LOWER(c.name) LIKE $${params.length} OR LOWER(j.description_clean) LIKE $${params.length})`;
      }

      querySql += ` ORDER BY j.first_seen_at DESC LIMIT 200;`;

      const dbRes = await db.getPool().query(querySql, params);
      if (dbRes.rows.length > 0) {
        return res.json({ count: dbRes.rows.length, jobs: dbRes.rows });
      }
    } catch (err: any) {
      console.debug('[Jobs API] DB fetch note:', err.message);
    }
  }

  // Fallback to curated listings
  let results = [...CURATED_JOB_LISTINGS];
  if (category && typeof category === 'string' && category !== 'All') {
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

app.listen(PORT, async () => {
  console.log(`ResumeHack Backend Engine listening on http://localhost:${PORT}`);

  if (process.env.DATABASE_URL) {
    try {
      console.log('[PostgreSQL] Running migrations...');
      await db.runMigrations();

      console.log('[PostgreSQL] Seeding initial Tier-1 company registry...');
      await registryService.seedTier1Companies(db.getPool());

      // Immediate crash-recovery: Reset any orphaned Tier-1 or burst companies to poll immediately
      await db.getPool().query(`
        UPDATE companies
        SET next_poll_at = NOW()
        WHERE next_poll_at > NOW() AND (tier = 'tier1' OR (burst_mode_until IS NOT NULL AND burst_mode_until > NOW()));
      `);

      // Start resilient Postgres LISTEN/NOTIFY listener
      await db.listenToJobEvents((eventPayload, eventId) => {
        broadcastSseJobEvent(eventPayload, eventId);
      });

      // Start adaptive poller background scheduler
      pollerScheduler = new AdaptivePollerScheduler(db.getPool(), {
        maxConcurrency: 5,
        minDomainSpacingMs: 250,
      });
      pollerScheduler.start();
      console.log('[AdaptivePoller] Direct ATS Freshness Poller online.');
    } catch (err: any) {
      console.error('[PostgreSQL] Startup initialization error:', err.message);
    }
  } else {
    console.log('[PostgreSQL] DATABASE_URL not set — running with in-memory curated fallback.');
  }
});
