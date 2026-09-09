// Hacky Mascot Proactive Notification & Alert System Service
import { MascotNotification, MascotState } from '../types/index.js';

export const PRO_TIPS: Array<{ category: string; tip: string }> = [
  {
    category: 'STAR Strategy',
    tip: 'Use the STAR method: Situation, Task, Action, Result for high-impact resume bullets!'
  },
  {
    category: 'ATS Optimization',
    tip: 'Quantify results! Metrics like "reduced latency by 35%" boost ATS match scores by 40%.'
  },
  {
    category: 'Keyword Matching',
    tip: 'Match exact hard skills and tool keywords from job descriptions to pass ATS filters.'
  },
  {
    category: 'Resume Formatting',
    tip: 'Keep your resume to 1 clean page for internships and new grad engineering roles.'
  },
  {
    category: 'Action Verbs',
    tip: 'Lead with strong verbs: "Architected", "Engineered", "Spearheaded", and "Orchestrated".'
  },
  {
    category: 'Discovery Sync',
    tip: 'Sync verified 2026 tech internships with 1-click in the ResumeHack Discovery feed!'
  },
  {
    category: 'ATS Parsing',
    tip: 'Avoid multi-column layouts and text boxes that can break automated resume parsers.'
  },
  {
    category: 'Impact Formula',
    tip: 'Use the Google XYZ formula: "Accomplished [X] as measured by [Y] by doing [Z]".'
  }
];

/**
 * Creates a proactive job alert notification when new internships/jobs are synced.
 */
export function createJobAlertNotification(
  newJobsCount: number,
  companies: string[] | string,
  totalCount?: number
): MascotNotification {
  const companyList = Array.isArray(companies)
    ? companies.filter(Boolean)
    : companies
      ? companies.split(',').map((s) => s.trim()).filter(Boolean)
      : [];

  const topCompanies = companyList.slice(0, 3);
  const companySnippet = topCompanies.length > 0 ? ` (${topCompanies.join(', ')})` : '';
  const count = Math.max(1, newJobsCount || 1);

  const title = `🔥 ${count} New 2026 Internships Added${companySnippet}!`;
  const body = topCompanies.length > 0
    ? `Top roles open at ${topCompanies.join(', ')}. 1-click apply and tailor your resume!`
    : `${count} verified internship openings just synced. Tailor your resume in 1-click!`;

  return {
    id: `job-alert-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type: 'NEW_JOBS_ALERT',
    badge: '🔥 New Openings',
    title,
    body,
    ctaText: 'View Jobs 💼',
    targetTab: 'discovery',
    count,
    companies: topCompanies,
    timestamp: Date.now()
  };
}

/**
 * Generates a pro-tip notification for resume improvement and ATS optimization.
 */
export function createProTipNotification(tipIndex?: number): MascotNotification {
  const index = typeof tipIndex === 'number' && tipIndex >= 0 && tipIndex < PRO_TIPS.length
    ? tipIndex
    : Math.floor(Math.random() * PRO_TIPS.length);

  const selected = PRO_TIPS[index];

  return {
    id: `protip-${Date.now()}-${index}`,
    type: 'PRO_TIP',
    badge: `💡 ${selected.category}`,
    title: 'AI Resume Pro-Tip',
    body: selected.tip,
    ctaText: 'Tailor Resume ⚡',
    targetTab: 'match',
    autoScan: false,
    timestamp: Date.now()
  };
}

/**
 * Creates a context-aware greeting notification based on the active webpage.
 */
export function createContextGreetingNotification(
  context: 'docs' | 'job' | 'form' | 'general',
  details?: { title?: string; company?: string }
): MascotNotification {
  switch (context) {
    case 'docs':
      return {
        id: `context-docs-${Date.now()}`,
        type: 'CONTEXT_ALERT',
        badge: 'Google Docs Connected',
        title: 'Google Doc Resume Detected!',
        body: `Found "${details?.title || 'your resume'}". Click to audit ATS match & tailor bullets!`,
        ctaText: 'Tailor with Hacky ⚡',
        targetTab: 'match',
        autoScan: true,
        timestamp: Date.now()
      };
    case 'job':
      return {
        id: `context-job-${Date.now()}`,
        type: 'CONTEXT_ALERT',
        badge: 'Job Opening Ready',
        title: 'Target Role Detected!',
        body: `Detected "${details?.title || 'Job Opening'}"${details?.company ? ` at ${details.company}` : ''}. 1-click tailor your resume for this role!`,
        ctaText: 'Tailor for This Job 🎯',
        targetTab: 'match',
        timestamp: Date.now()
      };
    case 'form':
      return {
        id: `context-form-${Date.now()}`,
        type: 'CONTEXT_ALERT',
        badge: 'Autofill Ready',
        title: 'Application Form Detected!',
        body: 'Ready to 1-click autofill your candidate profile, LinkedIn, and details on this form!',
        ctaText: 'Autofill Form Now ⚡',
        targetTab: 'tracker',
        timestamp: Date.now()
      };
    default:
      return {
        id: `context-general-${Date.now()}`,
        type: 'CONTEXT_ALERT',
        badge: 'Hacky AI Active',
        title: 'Hacky at your service!',
        body: '100+ verified 2026 tech internships & instant AI ATS resume tailoring ready.',
        ctaText: 'Open Hacky ⚡',
        targetTab: 'match',
        timestamp: Date.now()
      };
  }
}

/**
 * Clamps mascot coordinates within the visible screen viewport with safe padding.
 */
export function clampMascotPosition(
  pos: { x: number; y: number } | null,
  viewport: { width: number; height: number },
  mascotSize = { width: 76, height: 76 },
  margin = 12
): { x: number; y: number } {
  const defaultPos = {
    x: Math.max(margin, viewport.width - mascotSize.width - 24),
    y: Math.max(margin, viewport.height - mascotSize.height - 24)
  };

  if (!pos || typeof pos.x !== 'number' || typeof pos.y !== 'number' || !Number.isFinite(pos.x) || !Number.isFinite(pos.y)) {
    return defaultPos;
  }

  const minX = margin;
  const minY = margin;
  const maxX = Math.max(minX, viewport.width - mascotSize.width - margin);
  const maxY = Math.max(minY, viewport.height - mascotSize.height - margin);

  const clampedX = Math.round(Math.max(minX, Math.min(pos.x, maxX)));
  const clampedY = Math.round(Math.max(minY, Math.min(pos.y, maxY)));

  return { x: clampedX, y: clampedY };
}

/**
 * Validates and parses incoming background messages for notification dispatch.
 */
export function parseNotificationPayload(rawMessage: any): MascotNotification | null {
  if (!rawMessage || typeof rawMessage !== 'object') return null;

  if (rawMessage.type === 'NOTIFY_NEW_JOBS') {
    const count = typeof rawMessage.count === 'number' ? rawMessage.count : 1;
    const companies = rawMessage.companies || [];
    return createJobAlertNotification(count, companies, rawMessage.totalCount);
  }

  if (rawMessage.type === 'NOTIFY_ATS_TIP' || rawMessage.type === 'SHOW_PRO_TIP') {
    const tipIndex = typeof rawMessage.tipIndex === 'number' ? rawMessage.tipIndex : undefined;
    return createProTipNotification(tipIndex);
  }

  if (rawMessage.type === 'NOTIFY_CONTEXT_ALERT') {
    return createContextGreetingNotification(
      rawMessage.context || 'general',
      rawMessage.details
    );
  }

  if (rawMessage.type === 'NOTIFY_STAR_SUGGESTIONS') {
    const count = typeof rawMessage.count === 'number' ? rawMessage.count : 3;
    return {
      id: `star-suggestions-${Date.now()}`,
      type: 'CONTEXT_ALERT',
      badge: 'STAR Suggestions Active',
      title: `✨ ${count} STAR Suggestions Ready!`,
      body: 'Your tailored STAR bullet suggestions are live on your document. Click me anytime to reopen full panel.',
      ctaText: 'Reopen Side Panel ⚡',
      targetTab: 'match',
      timestamp: Date.now()
    };
  }

  return null;
}

/**
 * Pure state reducer for mascot state updates.
 */
export function updateMascotState(
  currentState: MascotState,
  partial: Partial<MascotState>
): MascotState {
  return {
    ...currentState,
    ...partial,
    position: partial.position !== undefined ? partial.position : currentState.position
  };
}
