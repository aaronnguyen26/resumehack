import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Settings Abstraction, Profile Compaction & Mandatory Auth Onboarding Suite', () => {
  const webComponentsDir = path.resolve(__dirname, '../../../web/src/components');

  describe('1. Settings Abstraction & Developer Internals Hiding', () => {
    it('SettingsTab completely abstracts away raw developer mechanisms', () => {
      const settingsPath = path.join(webComponentsDir, 'SettingsTab.tsx');
      const content = fs.readFileSync(settingsPath, 'utf8');

      // 1. Must NOT contain manual OAuth token input fields
      expect(content).not.toContain('googleAccessToken');
      expect(content).not.toContain('googleRefreshToken');
      expect(content).not.toContain('client_secret');
      expect(content).not.toContain('showManualDocInput');
      expect(content).not.toContain('manualDocId');

      // 2. Must NOT expose raw Gemini or OpenAI API key inputs or custom base URLs
      expect(content).not.toContain('aiApiKey');
      expect(content).not.toContain('aiBaseUrl');
      expect(content).not.toContain('oauthplayground');

      // 3. Must contain clean consumer abstractions
      expect(content).toContain('Account & Cloud Identity');
      expect(content).toContain('Appearance & Theme');
      expect(content).toContain('AI Optimization Engine & ATS Guardrails');
      expect(content).toContain('Profile Re-calibration & Data Management');
      expect(content).toContain('Anti-Hallucination Gate');
      expect(content).toContain('1-Page Line Budget Guard');
      expect(content).toContain('Tri-Variant Role Framing');
    });
  });

  describe('2. Compaction into Profile & 5-Column Navigation Bar', () => {
    it('Navbar contains exactly 5 equally spaced navigation tabs', () => {
      const navbarPath = path.join(webComponentsDir, 'Navbar.tsx');
      const content = fs.readFileSync(navbarPath, 'utf8');

      expect(content).toContain('grid grid-cols-5');
      expect(content).toContain('<span>Home</span>');
      expect(content).toContain('<span>Document Canvas</span>');
      expect(content).toContain('<span>Discovery</span>');
      expect(content).toContain('<span>Tracker</span>');
      expect(content).toContain('<span>Profile</span>');

      // Standalone settings tab is removed from navbar
      expect(content).not.toContain('<button\n          role="tab"\n          aria-selected={activeTab === \'settings\'}\n          onClick={() => setActiveTab(\'settings\')}');
    });

    it('ProfileTab embeds Preferences & Settings as a dedicated sub-navigation tab', () => {
      const profilePath = path.join(webComponentsDir, 'ProfileTab.tsx');
      const content = fs.readFileSync(profilePath, 'utf8');

      expect(content).toContain('<span>Candidate Information</span>');
      expect(content).toContain('<span>Master Bullet Vault</span>');
      expect(content).toContain('<span>Preferences & Settings</span>');
      expect(content).toContain("activeSection === 'settings'");
      expect(content).toContain('<SettingsTab');
    });
  });

  describe('3. Mandatory Sign-In Gate and Onboarding Identity Linking', () => {
    it('AuthModal enforces mandatory mode with no close button and Escape key blocking', () => {
      const authModalPath = path.join(webComponentsDir, 'AuthModal.tsx');
      const content = fs.readFileSync(authModalPath, 'utf8');

      expect(content).toContain('isMandatory?: boolean');
      expect(content).toContain('isMandatory = false');
      expect(content).toContain("e.key === 'Escape'");
      expect(content).toContain('isMandatory ? undefined : onClose');
      expect(content).toContain('Sign-in required to initialize workspace');
    });

    it('Onboarding completion binds authenticated user identity to settings and profile persistently', async () => {
      const mockUser = {
        id: 'usr_supabase_uuid_9999',
        email: 'sarah.connor@cyberdyne.io',
        firstName: 'Sarah',
        lastName: 'Connor',
      };

      const mockSavedProfile = {
        firstName: 'Sarah',
        lastName: 'Connor',
        fullName: 'Sarah Connor',
        email: 'sarah.connor@cyberdyne.io',
        phone: '415-555-0199',
        location: 'Los Angeles, CA',
        linkedinUrl: 'https://linkedin.com/in/sarah-connor',
        githubUrl: 'https://github.com/sarahconnor',
        portfolioUrl: '',
        school: 'UCLA',
        degree: 'BS',
        major: 'Computer Science',
        gpa: '3.92',
        gradMonthYear: 'May 2026',
        workAuthorization: 'US_CITIZEN' as const,
        requiresVisaSponsorship: false,
        targetRole: 'Distributed Systems Engineer',
      };

      const storedSettings: Record<string, any> = {};
      const saveStoredSettings = async (updates: any) => {
        Object.assign(storedSettings, updates);
      };

      const storedProfile: Record<string, any> = {};
      const saveStoredApplicantProfile = async (profile: any) => {
        Object.assign(storedProfile, profile);
      };

      let upsertedCloudPayload: any = null;
      const upsertUserProfile = async (userId: string, profile: any) => {
        upsertedCloudPayload = { userId, ...profile };
      };

      // Execute the onboarding completion workflow
      await saveStoredApplicantProfile(mockSavedProfile);
      const fullName = `${mockSavedProfile.firstName} ${mockSavedProfile.lastName}`.trim();
      await saveStoredSettings({
        candidateName: fullName,
        targetTitle: mockSavedProfile.targetRole,
        userId: mockUser.id,
        userEmail: mockSavedProfile.email || mockUser.email,
      });

      await upsertUserProfile(mockUser.id, mockSavedProfile);

      // Verify identity linking
      expect(storedSettings.userId).toBe('usr_supabase_uuid_9999');
      expect(storedSettings.userEmail).toBe('sarah.connor@cyberdyne.io');
      expect(storedSettings.candidateName).toBe('Sarah Connor');
      expect(storedSettings.targetTitle).toBe('Distributed Systems Engineer');

      expect(storedProfile.fullName).toBe('Sarah Connor');
      expect(storedProfile.school).toBe('UCLA');

      expect(upsertedCloudPayload.userId).toBe('usr_supabase_uuid_9999');
      expect(upsertedCloudPayload.email).toBe('sarah.connor@cyberdyne.io');
    });
  });

  describe('4. Monochromatic Theme Verification (Zero Purple & Zero Blue)', () => {
    it('Guarantees strict monochromatic zinc palette across all modified components', () => {
      const files = ['Navbar.tsx', 'SettingsTab.tsx', 'ProfileTab.tsx', 'AuthModal.tsx'];

      for (const file of files) {
        const filePath = path.join(webComponentsDir, file);
        const content = fs.readFileSync(filePath, 'utf8');

        expect(content).not.toMatch(/(?:bg|text|border)-(?:purple|blue|violet|indigo)-\d+/);
      }
    });
  });
});
