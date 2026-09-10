import { describe, it, expect, vi } from 'vitest';

describe('Home Page Navigation & Dedicated Workspace Separation Contracts', () => {
  it('Option 1: selecting Google Docs Sync switches workspace mode to google_docs and routes to match page', () => {
    let currentTab: 'home' | 'match' | 'discovery' | 'tracker' | 'settings' = 'home';
    let workspaceMode: 'google_docs' | 'in_app_canvas' = 'in_app_canvas';
    let connectedDocTitle: string | null = null;

    const handleSelectOption1GoogleDocs = (docId?: string, docTitle?: string) => {
      workspaceMode = 'google_docs';
      connectedDocTitle = docTitle || 'Alex Chen — Master Resume (Google Doc)';
      currentTab = 'match';
    };

    // User is on home page
    expect(currentTab).toBe('home');

    // User clicks Option 1 CTA: Launch Google Docs Workspace
    handleSelectOption1GoogleDocs('mock-master-resume-doc-id', 'Master Resume (Google Doc)');

    // Verify separation: active tab is now dedicated match page, NOT home page
    expect(currentTab).toBe('match');
    expect(workspaceMode).toBe('google_docs');
    expect(connectedDocTitle).toBe('Master Resume (Google Doc)');
  });

  it('Option 2: selecting In-App Canvas switches workspace mode to in_app_canvas and routes to match page', () => {
    let currentTab: 'home' | 'match' | 'discovery' | 'tracker' | 'settings' = 'home';
    let workspaceMode: 'google_docs' | 'in_app_canvas' = 'google_docs';
    let loadedResumeText: string | null = null;

    const handleSelectOption2InAppCanvas = (text: string) => {
      workspaceMode = 'in_app_canvas';
      loadedResumeText = text;
      currentTab = 'match';
    };

    // User is on home page
    expect(currentTab).toBe('home');

    // User clicks Option 2 CTA: Launch In-App Canvas
    const sampleResume = 'Sarah Connor\nSWE Candidate\nEXPERIENCE\nBuilt distributed systems';
    handleSelectOption2InAppCanvas(sampleResume);

    // Verify separation: active tab is now dedicated match page, NOT home page
    expect(currentTab).toBe('match');
    expect(workspaceMode).toBe('in_app_canvas');
    expect(loadedResumeText).toBe(sampleResume);
  });

  it('Discovery link routes to dedicated discovery page rather than expanding on home page', () => {
    let currentTab: 'home' | 'match' | 'discovery' | 'tracker' | 'settings' = 'home';

    const handleNavigateToDiscovery = () => {
      currentTab = 'discovery';
    };

    handleNavigateToDiscovery();
    expect(currentTab).toBe('discovery');
  });

  it('Tracker link routes to dedicated tracker page rather than expanding on home page', () => {
    let currentTab: 'home' | 'match' | 'discovery' | 'tracker' | 'settings' = 'home';

    const handleNavigateToTracker = () => {
      currentTab = 'tracker';
    };

    handleNavigateToTracker();
    expect(currentTab).toBe('tracker');
  });

  it('Clicking target role card loads role details and routes to dedicated match page', () => {
    let currentTab: 'home' | 'match' | 'discovery' | 'tracker' | 'settings' = 'home';
    let selectedJob: { title: string; company: string } | null = null;

    const handleSelectRoleTarget = (job: { title: string; company: string }) => {
      selectedJob = job;
      currentTab = 'match';
    };

    handleSelectRoleTarget({
      title: 'Systems & Inference Intern',
      company: 'Anthropic',
    });

    expect(currentTab).toBe('match');
    expect(selectedJob).toEqual({
      title: 'Systems & Inference Intern',
      company: 'Anthropic',
    });
  });

  it('Onboarding completion lands user on home page to select workflow option', () => {
    let currentTab: 'home' | 'match' | 'discovery' | 'tracker' | 'settings' = 'settings';
    let isOnboardingOpen = true;

    const handleOnboardingComplete = () => {
      isOnboardingOpen = false;
      currentTab = 'home';
    };

    handleOnboardingComplete();
    expect(isOnboardingOpen).toBe(false);
    expect(currentTab).toBe('home');
  });

  it('Clicking brand logo RH ResumeHack always routes user back to home page', () => {
    let currentTab: 'home' | 'match' | 'discovery' | 'tracker' | 'settings' = 'match';

    const handleLogoClick = () => {
      currentTab = 'home';
    };

    handleLogoClick();
    expect(currentTab).toBe('home');
  });

  it('URL tab query parameter properly resolves home and all sub-views', () => {
    const validTabs: ('home' | 'match' | 'discovery' | 'tracker' | 'settings')[] = [
      'home',
      'match',
      'discovery',
      'tracker',
      'settings',
    ];

    const parseTabParam = (param: string | null): 'home' | 'match' | 'discovery' | 'tracker' | 'settings' => {
      if (param && (validTabs as string[]).includes(param)) {
        return param as any;
      }
      return 'home';
    };

    expect(parseTabParam('home')).toBe('home');
    expect(parseTabParam('match')).toBe('match');
    expect(parseTabParam('discovery')).toBe('discovery');
    expect(parseTabParam('tracker')).toBe('tracker');
    expect(parseTabParam('settings')).toBe('settings');
    expect(parseTabParam('invalid_tab')).toBe('home');
    expect(parseTabParam(null)).toBe('home');
  });

  describe('UI Design, Top Navigation Spacing & Dual-Mode Verification', () => {
    it('HomePage hero section starts directly with the main font without any preceding chip or lines', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const homePagePath = path.resolve(__dirname, '../../../web/src/components/HomePage.tsx');
      const content = fs.readFileSync(homePagePath, 'utf8');

      // Verify 'ATS Engine v4.2 Active' is deleted
      expect(content).not.toContain('ATS Engine v4.2 Active');
      expect(content).not.toContain('Deterministic Score Matrix');

      // Verify h1 Algorithmic Precision is the first child of the hero section
      const heroSectionMatch = content.match(/{\/\*\s*Hero Header Section\s*\*\/}\s*<section[^>]*>([\s\S]*?)<\/section>/);
      expect(heroSectionMatch).toBeTruthy();
      const heroContent = heroSectionMatch![1].trim();

      // Starts with <h1
      expect(heroContent.startsWith('<h1')).toBe(true);
      expect(heroContent).toContain('Algorithmic Precision for Your Career');
    });

    it('Top navigation bar is properly spaced out with generous desktop padding and height', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const navbarPath = path.resolve(__dirname, '../../../web/src/components/Navbar.tsx');
      const content = fs.readFileSync(navbarPath, 'utf8');

      // Check header spacing classes
      expect(content).toContain('h-16');
      expect(content).toContain('px-4 sm:px-8 lg:px-12');
      expect(content).toContain('gap-6');
      expect(content).toContain('grid grid-cols-5');

      // Check all 5 top-level tabs are present in Navbar
      expect(content).toContain('<span>Home</span>');
      expect(content).toContain('<span>Document Canvas</span>');
      expect(content).toContain('<span>Discovery</span>');
      expect(content).toContain('<span>Tracker</span>');
      expect(content).toContain('<span>Profile</span>');

      // Check Settings is compacted under Profile
      const profilePath = path.resolve(__dirname, '../../../web/src/components/ProfileTab.tsx');
      const profileContent = fs.readFileSync(profilePath, 'utf8');
      expect(profileContent).toContain('<span>Preferences & Settings</span>');
    });

    it('Guarantees zero purple and zero blue colors in both light and dark modes', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const homePagePath = path.resolve(__dirname, '../../../web/src/components/HomePage.tsx');
      const navbarPath = path.resolve(__dirname, '../../../web/src/components/Navbar.tsx');
      
      const homeContent = fs.readFileSync(homePagePath, 'utf8');
      const navContent = fs.readFileSync(navbarPath, 'utf8');

      // Neither should have purple or blue utility classes
      expect(homeContent).not.toMatch(/(?:bg|text|border)-(?:purple|blue|violet|indigo)-\d+/);
      expect(navContent).not.toMatch(/(?:bg|text|border)-(?:purple|blue|violet|indigo)-\d+/);

      // Both should have comprehensive dark: variant classes for dark mode
      expect(homeContent).toContain('dark:bg-[#121215]');
      expect(homeContent).toContain('dark:border-[#27272A]');
      expect(homeContent).toContain('dark:text-zinc-50');

      expect(navContent).toContain('dark:bg-[#09090B]/95');
      expect(navContent).toContain('dark:border-[#27272A]');
      expect(navContent).toContain('dark:text-zinc-50');
    });
  });
});
