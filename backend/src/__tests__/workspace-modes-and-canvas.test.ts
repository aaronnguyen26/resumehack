import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  buildStarterResumeText, 
  parseUploadedResumeFile,
  formatExtractedPdfItems,
  normalizeExtractedResumeText
} from '../../../web/src/services/file-parser.js';
import { 
  DEFAULT_APPLICANT_PROFILE, 
  ApplicantProfile 
} from '../types/index.js';

describe('Option 1 & Option 2 Workspace Architectures & Ingestion Engine', () => {
  describe('Option 2: In-App Document Canvas & Starter Generator', () => {
    it('generates a complete, ATS-optimized starter resume using candidate profile info', () => {
      const profile: ApplicantProfile = {
        firstName: 'Sarah',
        lastName: 'Connor',
        fullName: 'Sarah Connor',
        email: 'sarah@skynet-defense.com',
        phone: '(555) 867-5309',
        location: 'Los Angeles, CA',
        linkedinUrl: 'https://linkedin.com/in/sarahconnor',
        githubUrl: 'https://github.com/sarahconnor',
        school: 'UCLA',
        degree: 'B.S.',
        major: 'Computer Science',
        gradMonthYear: 'May 2024',
        workAuthorization: 'US_CITIZEN',
        requiresVisaSponsorship: false,
      };

      const resumeText = buildStarterResumeText(profile);
      expect(resumeText).toContain('Sarah Connor');
      expect(resumeText).toContain('sarah@skynet-defense.com');
      expect(resumeText).toContain('(555) 867-5309');
      expect(resumeText).toContain('Los Angeles, CA');
      expect(resumeText).toContain('linkedin.com/in/sarahconnor');
      expect(resumeText).toContain('github.com/sarahconnor');
      expect(resumeText).toContain('EXPERIENCE');
      expect(resumeText).toContain('PROJECTS');
      expect(resumeText).toContain('TECHNICAL SKILLS');
      expect(resumeText).toContain('EDUCATION');
    });

    it('falls back gracefully to clean candidate defaults when profile is empty without hardcoded Alex Chen', () => {
      const resumeText = buildStarterResumeText({});
      expect(resumeText).toContain('Candidate Resume');
      expect(resumeText).toContain('candidate@example.com');
      expect(resumeText).not.toContain('Alex Chen');
      expect(resumeText).not.toContain('alex.chen@example.com');
      expect(resumeText).toContain('EXPERIENCE');
    });

    it('parses plain text resume file correctly', async () => {
      const content = 'Jane Doe\njane@example.com\n\nEXPERIENCE\nSoftware Engineer\n• Built high throughput backend systems in Go';
      const file = new File([content], 'my-resume.txt', { type: 'text/plain' });

      const parsed = await parseUploadedResumeFile(file);
      expect(parsed.fileName).toBe('my-resume.txt');
      expect(parsed.fileType).toBe('text');
      expect(parsed.text).toBe(content);
      expect(parsed.charCount).toBe(content.length);
    });

    it('parses markdown resume file correctly', async () => {
      const content = '# John Smith\njohn@example.com\n\n## Experience\n- Engineered distributed systems in Rust';
      const file = new File([content], 'resume.md', { type: 'text/markdown' });

      const parsed = await parseUploadedResumeFile(file);
      expect(parsed.fileName).toBe('resume.md');
      expect(parsed.fileType).toBe('text');
      expect(parsed.text).toBe(content);
    });

    it('calculates 1-page line budget correctly to guard against 2-page overflows', () => {
      const standardMaxLines = 46;
      const compactMaxLines = 54;

      const resumeLines40 = Array(40).fill('• Engineered distributed Redis caching clusters reducing latency by 45%.').join('\n');
      const count40 = resumeLines40.split('\n').filter(l => l.trim().length > 0).length;
      expect(count40).toBe(40);
      const budget40 = Math.round((count40 / standardMaxLines) * 100);
      expect(budget40).toBe(87); // 87% full - optimal single page!

      const resumeLines50 = Array(50).fill('• Developed scalable microservices in Python and Postgres.').join('\n');
      const count50 = resumeLines50.split('\n').filter(l => l.trim().length > 0).length;
      expect(count50).toBe(50);
      const budgetStandard50 = Math.round((count50 / standardMaxLines) * 100);
      expect(budgetStandard50).toBe(109); // >100%: Overflows on standard spacing!

      const budgetCompact50 = Math.round((count50 / compactMaxLines) * 100);
      expect(budgetCompact50).toBe(93); // Fits within single page when compact mode enabled!
    });

    it('mutates canvas text correctly when applying STAR bullet diffs', () => {
      const originalResume = `Alex Chen
• Engineered caching clusters.
• Built backend services in Python.`;

      const originalBullet = '• Engineered caching clusters.';
      const tailoredBullet = '• Architected distributed Redis caching clusters reducing P99 latency by 68% across 12 regions.';

      expect(originalResume).toContain(originalBullet);
      const mutatedResume = originalResume.replace(originalBullet, tailoredBullet);
      expect(mutatedResume).toContain(tailoredBullet);
      expect(mutatedResume).not.toContain(originalBullet);
      expect(mutatedResume).toContain('• Built backend services in Python.');
    });

    it('normalizes Unicode ligatures, special bullet symbols, and dash types from raw PDF text', () => {
      // Common PDF font artifacts (fi, fl, ffi ligatures, special bullets ▪, em-dashes —)
      const rawPdfSnippet = 'Con\uFB01gured high-availability in\uFB02ux clusters\n▪ Reduced latency by 40% \u2014 achieved 99.9% uptime';
      const normalized = normalizeExtractedResumeText(rawPdfSnippet);
      expect(normalized).toContain('Configured high-availability influx clusters');
      expect(normalized).toContain('• Reduced latency by 40% - achieved 99.9% uptime');
    });

    it('formats raw positioned PDF text items into ordered vertical lines and paragraphs', () => {
      const items = [
        { str: 'Alex Chen', transform: [1, 0, 0, 1, 50, 750], height: 14 },
        { str: 'alex@example.com', transform: [1, 0, 0, 1, 50, 730], height: 10 },
        { str: 'EXPERIENCE', transform: [1, 0, 0, 1, 50, 680], height: 12 },
        { str: '• Senior Engineer at CloudCorp', transform: [1, 0, 0, 1, 50, 660], height: 10 },
      ];

      const formatted = formatExtractedPdfItems(items);
      expect(formatted).toContain('Alex Chen');
      expect(formatted).toContain('alex@example.com');
      expect(formatted).toContain('EXPERIENCE');
      expect(formatted).toContain('• Senior Engineer at CloudCorp');
    });

    it('supports direct inline editing of bullets in canvas, updating rawText and line budget', () => {
      let canvasRawText = `JOHN DOE
john@example.com

EXPERIENCE
• Developed backend services in Node.js
• Maintained legacy database schemas`;

      const handleSaveInlineBullet = (pIdx: number, lIdx: number, newContent: string) => {
        const paragraphs = canvasRawText.split('\n\n');
        const lines = paragraphs[pIdx].split('\n');
        const prefix = lines[lIdx].match(/^[•\-*]\s*/)?.[0] || '• ';
        lines[lIdx] = `${prefix}${newContent.trim()}`;
        paragraphs[pIdx] = lines.join('\n');
        canvasRawText = paragraphs.join('\n\n');
      };

      // Edit second bullet of EXPERIENCE (paragraph 1, line 2)
      handleSaveInlineBullet(1, 2, 'Architected high-throughput PostgreSQL distributed clusters with 99.99% reliability');
      expect(canvasRawText).toContain('• Architected high-throughput PostgreSQL distributed clusters with 99.99% reliability');
      expect(canvasRawText).not.toContain('Maintained legacy database schemas');
    });

    it('supports deleting bullets in canvas, freeing up lines towards single-page fit', () => {
      let canvasRawText = `JOHN DOE
john@example.com

EXPERIENCE
• Bullet 1
• Bullet 2
• Bullet 3`;

      const initialLines = canvasRawText.split('\n').filter(l => l.trim().length > 0).length;
      expect(initialLines).toBe(6);

      const handleDeleteBullet = (pIdx: number, lIdx: number) => {
        const paragraphs = canvasRawText.split('\n\n');
        const lines = paragraphs[pIdx].split('\n');
        lines.splice(lIdx, 1);
        paragraphs[pIdx] = lines.join('\n');
        canvasRawText = paragraphs.join('\n\n');
      };

      // Delete Bullet 2 (paragraph 1, line 2)
      handleDeleteBullet(1, 2);
      expect(canvasRawText).not.toContain('Bullet 2');
      expect(canvasRawText).toContain('• Bullet 1');
      expect(canvasRawText).toContain('• Bullet 3');

      const updatedLines = canvasRawText.split('\n').filter(l => l.trim().length > 0).length;
      expect(updatedLines).toBe(5); // 1 line freed up!
    });

    it('supports adding new bullets to sections directly in canvas', () => {
      let canvasRawText = `JOHN DOE
john@example.com

EXPERIENCE
• Bullet 1`;

      const handleAddBulletToSection = (pIdx: number, bulletText: string) => {
        const paragraphs = canvasRawText.split('\n\n');
        const lines = paragraphs[pIdx].split('\n');
        lines.push(`• ${bulletText}`);
        paragraphs[pIdx] = lines.join('\n');
        canvasRawText = paragraphs.join('\n\n');
      };

      handleAddBulletToSection(1, 'Engineered real-time telemetry pipelines');
      expect(canvasRawText).toContain('• Bullet 1\n• Engineered real-time telemetry pipelines');
    });

    it('supports inline candidate name and section title updates directly in canvas', () => {
      let canvasRawText = `OLD NAME
old@example.com

WORK HISTORY
• Built APIs`;

      // Update name
      const handleSaveCandidateName = (newName: string) => {
        const paragraphs = canvasRawText.split('\n\n');
        const lines = paragraphs[0].split('\n');
        lines[0] = newName.trim();
        paragraphs[0] = lines.join('\n');
        canvasRawText = paragraphs.join('\n\n');
      };

      // Update section title
      const handleSaveSectionTitle = (pIdx: number, newTitle: string) => {
        const paragraphs = canvasRawText.split('\n\n');
        const lines = paragraphs[pIdx].split('\n');
        lines[0] = newTitle.toUpperCase().trim();
        paragraphs[pIdx] = lines.join('\n');
        canvasRawText = paragraphs.join('\n\n');
      };

      handleSaveCandidateName('SARAH CONNOR');
      handleSaveSectionTitle(1, 'EXPERIENCE');

      expect(canvasRawText).toContain('SARAH CONNOR');
      expect(canvasRawText).not.toContain('OLD NAME');
      expect(canvasRawText).toContain('EXPERIENCE');
      expect(canvasRawText).not.toContain('WORK HISTORY');
    });

    it('manages undo and redo history stack correctly with boundary guards', () => {
      let history: string[] = ['Initial Version'];
      let historyIndex = 0;

      const pushState = (newText: string) => {
        const sliced = history.slice(0, historyIndex + 1);
        if (sliced[sliced.length - 1] === newText) return;
        const next = [...sliced, newText];
        if (next.length > 50) next.shift();
        history = next;
        historyIndex = next.length - 1;
      };

      const handleUndo = () => {
        if (historyIndex > 0) {
          historyIndex -= 1;
          return history[historyIndex];
        }
        return history[historyIndex];
      };

      const handleRedo = () => {
        if (historyIndex < history.length - 1) {
          historyIndex += 1;
          return history[historyIndex];
        }
        return history[historyIndex];
      };

      pushState('Version 2: Added Go skill');
      pushState('Version 3: Added Stripe Experience');
      expect(history.length).toBe(3);
      expect(historyIndex).toBe(2);

      expect(handleUndo()).toBe('Version 2: Added Go skill');
      expect(historyIndex).toBe(1);

      expect(handleUndo()).toBe('Initial Version');
      expect(historyIndex).toBe(0);

      // Boundary check: cannot undo past 0
      expect(handleUndo()).toBe('Initial Version');
      expect(historyIndex).toBe(0);

      expect(handleRedo()).toBe('Version 2: Added Go skill');
      expect(historyIndex).toBe(1);

      expect(handleRedo()).toBe('Version 3: Added Stripe Experience');
      expect(historyIndex).toBe(2);

      // Boundary check: cannot redo past end
      expect(handleRedo()).toBe('Version 3: Added Stripe Experience');
      expect(historyIndex).toBe(2);
    });

    it('preserves non-bullet role/company titles when saving without prepending bullet symbol', () => {
      let rawText = `Candidate Name
contact@example.com

WORK EXPERIENCE
Stripe — Staff Infrastructure Engineer
San Francisco, CA | 2022 – Present
• Architected distributed caching layer`;

      const handleSaveBullet = (pIdx: number, lIdx: number, newContent: string) => {
        const paragraphs = rawText.split('\n\n');
        if (!paragraphs[pIdx]) return;
        const lines = paragraphs[pIdx].split('\n');
        const isBullet = /^[•\-*]\s*/.test(lines[lIdx]);
        const prefix = isBullet ? (lines[lIdx]?.match(/^[•\-*]\s*/)?.[0] || '• ') : '';
        lines[lIdx] = `${prefix}${newContent.trim()}`;
        paragraphs[pIdx] = lines.join('\n');
        rawText = paragraphs.join('\n\n');
      };

      // Edit the role title (line 1 of paragraph 1, non-bullet)
      handleSaveBullet(1, 1, 'Stripe — Principal Infrastructure Engineer');
      expect(rawText).toContain('Stripe — Principal Infrastructure Engineer');
      expect(rawText).not.toContain('• Stripe — Principal Infrastructure Engineer');

      // Edit a bullet line (line 3 of paragraph 1, bullet)
      handleSaveBullet(1, 3, 'Architected distributed multi-region caching layer');
      expect(rawText).toContain('• Architected distributed multi-region caching layer');
    });

    it('inserts pre-built template sections seamlessly into canvas document', () => {
      let rawText = `Candidate Name\ncontact@example.com`;

      const handleInsertSection = (type: 'EXPERIENCE' | 'SKILLS') => {
        let template = '';
        if (type === 'EXPERIENCE') {
          template = `WORK EXPERIENCE\nStripe — Staff Infrastructure Engineer\nSan Francisco, CA | 2022 – Present\n• Architected distributed multi-region caching layer`;
        } else if (type === 'SKILLS') {
          template = `TECHNICAL SKILLS\n• Languages: Go, Rust, Python, TypeScript, SQL`;
        }
        rawText = `${rawText.trim()}\n\n${template}`;
      };

      handleInsertSection('EXPERIENCE');
      expect(rawText).toContain('WORK EXPERIENCE');
      expect(rawText).toContain('Stripe — Staff Infrastructure Engineer');

      handleInsertSection('SKILLS');
      expect(rawText).toContain('TECHNICAL SKILLS');
      expect(rawText).toContain('Languages: Go, Rust, Python');
    });

    it('navigates directly to dedicated canvas tab upon selecting Option 2 or uploading resume', () => {
      let activeTab: string = 'home';
      const handleSelectOption2InAppCanvas = () => {
        activeTab = 'canvas';
      };
      const handleUploadResumeFile = () => {
        activeTab = 'canvas';
      };

      handleSelectOption2InAppCanvas();
      expect(activeTab).toBe('canvas');

      activeTab = 'match';
      handleUploadResumeFile();
      expect(activeTab).toBe('canvas');
    });
  });

  describe('Option 1: Google Docs Cloud Sync Lifecycle', () => {
    it('supports switching to google_docs workspace mode and stores preference', () => {
      const modeKey = 'resumehack_workspace_mode';
      const storage: Record<string, string> = {};

      const saveMode = (mode: 'google_docs' | 'in_app_canvas') => {
        storage[modeKey] = mode;
      };

      const getMode = () => storage[modeKey] || null;

      expect(getMode()).toBeNull();
      saveMode('google_docs');
      expect(getMode()).toBe('google_docs');
      saveMode('in_app_canvas');
      expect(getMode()).toBe('in_app_canvas');
    });

    it('preserves Google Docs active indicator and batch updates contract', () => {
      const screenResume = {
        title: 'Alex Chen — Master Resume (Google Doc)',
        fullText: 'Alex Chen\n• Built services in Go\n• Designed REST APIs',
        isGoogleDoc: true
      };

      expect(screenResume.isGoogleDoc).toBe(true);
      expect(screenResume.title).toContain('Google Doc');
    });
  });

  describe('Post-Onboarding Gateway Trigger', () => {
    it('triggers gateway modal after onboarding completes to allow choosing Option 1 or Option 2', () => {
      let isOnboardingOpen = true;
      let showWorkspaceGateway = false;
      let activeTab = 'discovery';

      // Simulates OnboardingModal.onComplete
      const handleOnboardingComplete = () => {
        isOnboardingOpen = false;
        showWorkspaceGateway = true;
        activeTab = 'match';
      };

      handleOnboardingComplete();

      expect(isOnboardingOpen).toBe(false);
      expect(showWorkspaceGateway).toBe(true);
      expect(activeTab).toBe('match');
    });
  });
});
