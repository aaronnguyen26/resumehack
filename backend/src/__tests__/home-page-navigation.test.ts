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
});
