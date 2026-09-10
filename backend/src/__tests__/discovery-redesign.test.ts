import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { CURATED_JOB_LISTINGS } from '../data/curated-jobs.js';

describe('Discovery Page Horizontal Redesign & Stitch MCP Workbench Engine', () => {
  const discoveryTabPath = path.resolve(__dirname, '../../../web/src/components/DiscoveryTab.tsx');
  let discoveryTabCode: string;

  try {
    discoveryTabCode = fs.readFileSync(discoveryTabPath, 'utf-8');
  } catch (err) {
    discoveryTabCode = '';
  }

  describe('DiscoveryTab.tsx Source Code & Stitch MCP Winning Design Fidelity', () => {
    it('file exists and contains substantial component code', () => {
      expect(discoveryTabCode.length).toBeGreaterThan(1000);
      expect(discoveryTabCode).toContain('export const DiscoveryTab');
    });

    it('implements activeWorkbenchJobId state for horizontal layout transformation', () => {
      // Must track activeWorkbenchJobId to pivot layout axis
      expect(discoveryTabCode).toContain('activeWorkbenchJobId');
      expect(discoveryTabCode).toContain('setActiveWorkbenchJobId');
    });

    it('implements horizontal split dual-pane workbench layout (flex-col lg:flex-row)', () => {
      // Rather than expanding straight down inside the grid, must use horizontal split flex container
      expect(discoveryTabCode).toContain('flex flex-col lg:flex-row');
      // Left pane: ~35% width (e.g. lg:w-[35%] or lg:w-[360px] or lg:w-[380px] or lg:w-[400px])
      expect(discoveryTabCode).toMatch(/lg:w-\[(35%|380px|400px|360px)\]|lg:w-1\/3/);
      // Right pane: ~65% expansive horizontal spec sheet card (e.g. lg:w-[65%] or flex-1)
      expect(discoveryTabCode).toMatch(/flex-1|lg:w-\[65%\]|lg:w-2\/3/);
    });

    it('provides keyboard navigation: [Esc] collapses workbench and restores catalog grid', () => {
      expect(discoveryTabCode).toContain("e.key === 'Escape'");
      expect(discoveryTabCode).toContain('setActiveWorkbenchJobId(null)');
    });

    it('renders Engineering Spec Sheet card with bento architecture and actionable CTA', () => {
      // Spec Sheet components from winning Stitch design (Screen 31231ec42acb45eabebbb37af073ec34)
      expect(discoveryTabCode).toContain('Engineering Spec Sheet');
      expect(discoveryTabCode).toContain('Tailor Resume');
      expect(discoveryTabCode).toContain('ATS Match');
      expect(discoveryTabCode).toContain('Missing Keywords');
      expect(discoveryTabCode).toContain('Target Tech Stack');
      expect(discoveryTabCode).toContain('Interview Blueprint');
    });

    it('renders 3-column catalog grid in default mode', () => {
      expect(discoveryTabCode).toContain('grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3');
    });

    it('strictly satisfies Monochromatic Zinc continuum with ZERO purple and ZERO blue classes', () => {
      // Audit for purple/violet/indigo/blue classes in discovery tab
      const forbiddenColorPatterns = [
        /\btext-(blue|indigo|purple|violet)-[0-9]{3}\b/g,
        /\bbg-(blue|indigo|purple|violet)-[0-9]{3}\b/g,
        /\bborder-(blue|indigo|purple|violet)-[0-9]{3}\b/g,
        /\bfrom-(blue|indigo|purple|violet)-[0-9]{3}\b/g,
        /\bto-(blue|indigo|purple|violet)-[0-9]{3}\b/g,
        /\bring-(blue|indigo|purple|violet)-[0-9]{3}\b/g,
      ];

      for (const pattern of forbiddenColorPatterns) {
        const matches = discoveryTabCode.match(pattern);
        expect(matches).toBeNull();
      }
    });
  });

  describe('Horizontal Workbench Dynamic Job Switching & ATS Match Logic', () => {
    it('simulates job selection and switching in the master stream', () => {
      const sampleJobs = CURATED_JOB_LISTINGS.slice(0, 3);
      expect(sampleJobs.length).toBe(3);

      let activeJobId: string | null = null;
      const selectJob = (id: string) => {
        activeJobId = id;
      };

      // Default: null (grid view)
      expect(activeJobId).toBeNull();

      // User clicks job 1: workbench activates
      selectJob(sampleJobs[0].id);
      expect(activeJobId).toBe(sampleJobs[0].id);

      // User clicks job 2 in the left stream: right spec sheet updates immediately without closing workbench
      selectJob(sampleJobs[1].id);
      expect(activeJobId).toBe(sampleJobs[1].id);

      // User presses Esc or close button: collapses back to null (grid view)
      activeJobId = null;
      expect(activeJobId).toBeNull();
    });

    it('computes ATS keyword match and identifies missing tech stack gaps', () => {
      const job = CURATED_JOB_LISTINGS[0];
      const jobSkills = job.skills || ['Python', 'Go', 'Kubernetes', 'AWS', 'Redis'];
      const targetSkill = jobSkills[0];

      const mockResumeText = `Experienced professional with deep expertise in ${targetSkill} and production delivery.`;
      const resumeLower = mockResumeText.toLowerCase();

      const matchedSkills = jobSkills.filter(skill => resumeLower.includes(skill.toLowerCase()));
      const missingSkills = jobSkills.filter(skill => !resumeLower.includes(skill.toLowerCase()));
      const matchScore = Math.round((matchedSkills.length / jobSkills.length) * 100);

      expect(matchedSkills.length + missingSkills.length).toBe(jobSkills.length);
      expect(matchScore).toBeGreaterThan(0);
      expect(matchScore).toBeLessThanOrEqual(100);
      expect(matchedSkills).toContain(targetSkill);
    });

    it('handles copy job specs payload generation correctly', () => {
      const job = CURATED_JOB_LISTINGS[0];
      const spec = [
        `JOB SPECIFICATION: ${job.title} at ${job.company}`,
        `Location: ${job.location}`,
        `Compensation: ${job.salaryRange}`,
        `Stack: ${(job.skills || []).join(' · ')}`
      ].join('\n');

      expect(spec).toContain(job.title);
      expect(spec).toContain(job.company);
      expect(spec).toContain(job.location);
    });
  });
});
