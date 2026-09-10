import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Hacky AI Section Height Containment & Independent Scroll Engine', () => {
  const canvasPath = path.resolve(__dirname, '../../../web/src/components/InAppDocumentCanvas.tsx');
  const panelPath = path.resolve(__dirname, '../../../web/src/components/HackyAiAtsPanel.tsx');
  const appPath = path.resolve(__dirname, '../../../web/src/App.tsx');
  const cssPath = path.resolve(__dirname, '../../../web/src/index.css');

  it('verifies InAppDocumentCanvas bounds the workspace and aligns Hacky AI to the exact same length as the canvas', () => {
    const content = fs.readFileSync(canvasPath, 'utf8');

    // Root container must have overflow-hidden, min-h-0, and max-h-full
    expect(content).toContain('flex flex-col h-full max-h-full w-full bg-zinc-50 dark:bg-[#09090B]');
    expect(content).toContain('overflow-hidden min-h-0');

    // Header must have shrink-0 so it never collapses or forces expansion
    expect(content).toMatch(/<header[^>]*shrink-0[^>]*sticky top-0/);

    // Main workspace viewport row must have items-stretch, overflow-hidden, min-h-0, h-full, max-h-full
    expect(content).toContain('flex-1 flex flex-col lg:flex-row items-stretch justify-start relative overflow-hidden min-h-0 h-full max-h-full');

    // Left canvas column must be h-full, max-h-full, min-h-0, and overflow-hidden
    expect(content).toContain('flex-1 flex flex-col min-w-0 bg-zinc-100/70 dark:bg-[#0c0c0e] relative h-full max-h-full min-h-0 overflow-hidden');

    // Left paper stage must have flex-1, overflow-y-auto, min-h-0, and max-h-full (no min-h-[850px] layout blowout)
    expect(content).toContain('flex-1 overflow-y-auto min-h-0 h-full max-h-full p-3 sm:p-5 md:p-6 lg:p-8 flex flex-col items-center justify-start relative');
    expect(content).not.toContain('min-h-[850px]');

    // Right Hacky AI aside wrapper must share items-stretch h-full and max-h-full with the left column
    expect(content).toMatch(/<aside\s+aria-label="Hacky AI ATS Inspector"\s+className="[^"]*h-80 sm:h-96 lg:h-full lg:max-h-full shrink-0 border-t lg:border-t-0 lg:border-l[^"]*min-h-0 overflow-hidden/);
  });

  it('verifies HackyAiAtsPanel implements independent internal scrolling without stretching its container', () => {
    const content = fs.readFileSync(panelPath, 'utf8');

    // Root aside has h-full, max-h-full, min-h-0, overflow-hidden
    expect(content).toMatch(/<aside\s+className="[^"]*w-full h-full max-h-full[^"]*min-h-0 overflow-hidden/);

    // Header has shrink-0 pinned at top
    expect(content).toMatch(/Panel Header[\s\S]*?<div\s+className="[^"]*p-4 border-b[^"]*shrink-0/);

    // Tab buttons have shrink-0
    expect(content).toMatch(/Segmented Navigation Tabs[\s\S]*?<div\s+className="[^"]*flex border-b[^"]*shrink-0/);

    // Content container has flex-1 overflow-y-auto min-h-0 for smooth internal scrolling
    expect(content).toMatch(/<div\s+className="flex-1 overflow-y-auto min-h-0 h-full max-h-full p-4 space-y-4/);
  });

  it('verifies App.tsx locks canvas tab within viewport to prevent page lengthening', () => {
    const appContent = fs.readFileSync(appPath, 'utf8');
    const cssContent = fs.readFileSync(cssPath, 'utf8');

    // Root container in App.tsx sets h-screen max-h-screen overflow-hidden on activeTab === canvas
    expect(appContent).toContain("activeTab === 'canvas' ? 'h-screen max-h-screen overflow-hidden' : 'min-h-screen'");

    // Main tag locks height to calc(100vh - 64px) with overflow-hidden and min-h-0 when canvas is active
    expect(appContent).toContain("activeTab === 'canvas' ? 'max-w-[1780px] px-1 sm:px-2 md:px-3 py-1 h-[calc(100vh-64px)] max-h-[calc(100vh-64px)] min-h-0 overflow-hidden flex flex-col'");

    // Canvas container in App.tsx takes full height and flex-1 with min-h-0 overflow-hidden
    expect(appContent).toContain('<div className="w-full h-full max-h-full flex-1 flex flex-col min-h-0 overflow-hidden animate-in fade-in duration-200">');

    // index.css sets height: 100% on html, body, #root
    expect(cssContent).toContain('html,\nbody,\n#root {\n  height: 100%;\n}');
  });

  it('strictly adheres to monochromatic zinc design with zero purple, violet, indigo, or blue classes', () => {
    const canvasContent = fs.readFileSync(canvasPath, 'utf8');
    const panelContent = fs.readFileSync(panelPath, 'utf8');
    const appContent = fs.readFileSync(appPath, 'utf8');

    const forbiddenRegex = /(?:bg|text|border)-(?:purple|blue|violet|indigo)-\d+/;
    expect(canvasContent).not.toMatch(forbiddenRegex);
    expect(panelContent).not.toMatch(forbiddenRegex);
    expect(appContent).not.toMatch(forbiddenRegex);
  });
});
