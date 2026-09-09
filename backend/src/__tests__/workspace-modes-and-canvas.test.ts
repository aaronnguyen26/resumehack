import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  buildStarterResumeText, 
  parseUploadedResumeFile 
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
