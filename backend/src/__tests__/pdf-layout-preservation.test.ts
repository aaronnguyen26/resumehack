import { describe, it, expect } from "vitest";
import {
  detectColumns,
  detectHeaderAlignment,
  detectSplitRows,
  detectPdfLayout,
  formatLayoutAwarePdfItems,
  normalizePdfItems,
  ExtractedPdfLayout,
  PositionedTextItem,
} from "../services/pdf-layout-engine.js";
import {
  rawTextToHtml,
  extractTextFromDoc,
  extractTextFromHtml,
  isSidebarSection,
  ResumeLayoutOptions,
} from "../../../web/src/services/canvas-editor.js";
import { parseUploadedResumeFile } from "../../../web/src/services/file-parser.js";

describe("PDF Layout Preservation & Design Engine Test Suite", () => {
  describe("Part 1: Multi-Column Detection & Anti-Interleaving Engine", () => {
    it("detects single-column layout when text items span across standard margin width", () => {
      const items: PositionedTextItem[] = [
        { text: "Alexander Hamilton", x: 40, y: 720, width: 140, height: 20 },
        { text: "alexander@treasury.gov • New York, NY", x: 40, y: 700, width: 220, height: 10 },
        { text: "WORK EXPERIENCE", x: 40, y: 660, width: 120, height: 12 },
        { text: "First Secretary of the Treasury — US Government", x: 40, y: 640, width: 300, height: 11 },
        { text: "• Established the Bank of the United States and national financial credit", x: 40, y: 620, width: 450, height: 10 },
        { text: "• Authored the majority of the Federalist Papers", x: 40, y: 600, width: 380, height: 10 },
        { text: "EDUCATION", x: 40, y: 560, width: 80, height: 12 },
        { text: "King's College (Columbia University)", x: 40, y: 540, width: 200, height: 10 },
      ];

      const colInfo = detectColumns(items, 612);
      expect(colInfo.columnCount).toBe(1);
    });

    it("detects 2-column layout when items cluster into distinct left sidebar and right body columns with overlapping vertical bounds", () => {
      // Left sidebar items (X: 40 to 180)
      const leftColItems: PositionedTextItem[] = [
        { text: "SKILLS", x: 40, y: 640, width: 60, height: 12 },
        { text: "• TypeScript, Go, Python", x: 40, y: 620, width: 130, height: 10 },
        { text: "• Kubernetes, Docker", x: 40, y: 600, width: 120, height: 10 },
        { text: "EDUCATION", x: 40, y: 540, width: 80, height: 12 },
        { text: "MIT — B.S. EECS", x: 40, y: 520, width: 100, height: 10 },
        { text: "2018 – 2022", x: 40, y: 505, width: 70, height: 9 },
      ];

      // Right main column items (X: 240 to 560) at the SAME vertical heights
      const rightColItems: PositionedTextItem[] = [
        { text: "WORK EXPERIENCE", x: 240, y: 640, width: 140, height: 12 },
        { text: "Google — Senior Software Engineer", x: 240, y: 620, width: 220, height: 11 },
        { text: "• Architected high-throughput Bigtable consensus cluster", x: 240, y: 600, width: 300, height: 10 },
        { text: "• Reduced tail read latencies by 42% via edge replicas", x: 240, y: 580, width: 290, height: 10 },
        { text: "PROJECTS", x: 240, y: 540, width: 80, height: 12 },
        { text: "Distributed Raft Consensus Engine", x: 240, y: 520, width: 180, height: 10 },
        { text: "• Handled 15,000 write ops/sec across 5-node cluster", x: 240, y: 505, width: 280, height: 10 },
      ];

      const allItems = [
        { text: "Jane Developer", x: 200, y: 720, width: 150, height: 22 },
        ...leftColItems,
        ...rightColItems,
      ];

      const colInfo = detectColumns(allItems, 612);
      expect(colInfo.columnCount).toBe(2);
      expect(colInfo.columnBoundaryX).toBeGreaterThanOrEqual(180);
      expect(colInfo.columnBoundaryX).toBeLessThanOrEqual(240);
    });

    it("prevents cross-column text interleaving when formatting 2-column PDF text items", () => {
      // If sorted purely by Y, "SKILLS" and "WORK EXPERIENCE" would interleave onto the same line
      const rawPdfItems = [
        { str: "Marcus Vance", transform: [1, 0, 0, 1, 40, 720], height: 22, width: 140 },
        { str: "marcus@vance.io • (415) 555-0100", transform: [1, 0, 0, 1, 40, 700], height: 10, width: 200 },
        // Same Y = 640 for both columns:
        { str: "SKILLS", transform: [1, 0, 0, 1, 40, 640], height: 12, width: 60 },
        { str: "WORK EXPERIENCE", transform: [1, 0, 0, 1, 240, 640], height: 12, width: 140 },
        // Same Y = 620:
        { str: "• Go, Rust, Python", transform: [1, 0, 0, 1, 40, 620], height: 10, width: 110 },
        { str: "Stripe — Staff Engineer", transform: [1, 0, 0, 1, 240, 620], height: 11, width: 160 },
        // Same Y = 600:
        { str: "• Docker, K8s", transform: [1, 0, 0, 1, 40, 600], height: 10, width: 80 },
        { str: "• Built distributed payment ledger", transform: [1, 0, 0, 1, 240, 600], height: 10, width: 220 },
      ];

      const { text, layout } = formatLayoutAwarePdfItems(rawPdfItems, 612);

      expect(layout.columnCount).toBe(2);
      // Ensure "SKILLS" and "WORK EXPERIENCE" are NOT mashed onto the same line
      const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
      const mixedLines = lines.filter(l => l.includes("SKILLS") && l.includes("WORK EXPERIENCE"));
      expect(mixedLines.length).toBe(0);

      // Verify that all content is preserved
      expect(text).toContain("Marcus Vance");
      expect(text).toContain("SKILLS");
      expect(text).toContain("WORK EXPERIENCE");
      expect(text).toContain("Stripe — Staff Engineer");
      expect(text).toContain("Built distributed payment ledger");
    });
  });

  describe("Part 2: Two-Ended Justification & Split Row Detection", () => {
    it("detects split rows when job title is on the left and dates/locations are on the far right", () => {
      const items: PositionedTextItem[] = [
        { text: "Google — Staff Platform Engineer", x: 40, y: 620, width: 210, height: 11 },
        { text: "Mountain View, CA | May 2021 – Present", x: 380, y: 620, width: 180, height: 10 },
        { text: "Stripe — Senior Infrastructure Engineer", x: 40, y: 540, width: 220, height: 11 },
        { text: "San Francisco, CA | 2018 – 2021", x: 400, y: 540, width: 160, height: 10 },
      ];

      const hasSplit = detectSplitRows(items, 612);
      expect(hasSplit).toBe(true);
    });

    it("renders split rows with flex two-ended justification in HTML", () => {
      const resumeWithSplit = 
        "Candidate Name\n" +
        "email@example.com\n\n" +
        "WORK EXPERIENCE\n" +
        "Google — Staff Platform Engineer   |   Mountain View, CA | May 2021 – Present\n" +
        "• Architected multi-region consensus protocol\n" +
        "Stripe — Senior Engineer   |   2018 – 2021\n" +
        "• Built distributed payment ledger";

      const html = rawTextToHtml(resumeWithSplit);

      expect(html).toContain("doc-entry-header");
      expect(html).toContain("flex justify-between items-baseline");
      expect(html).toContain("Google — Staff Platform Engineer");
      expect(html).toContain("Mountain View, CA | May 2021 – Present");
    });
  });

  describe("Part 3: Header Alignment & Candidate Contact Architecture", () => {
    it("detects centered header when candidate name bounding box is centered", () => {
      const items: PositionedTextItem[] = [
        // Page width 612, center 306. Name centered with width 180 -> x = 306 - 90 = 216
        { text: "Elena Rostova", x: 216, y: 730, width: 180, height: 24 },
        { text: "elena@stanford.edu • (650) 555-0144 • Palo Alto, CA", x: 120, y: 705, width: 372, height: 10 },
        { text: "EDUCATION", x: 40, y: 660, width: 80, height: 12 },
      ];

      const align = detectHeaderAlignment(items, 612);
      expect(align).toBe("center");

      const html = rawTextToHtml("Elena Rostova\nelena@stanford.edu\n\nEDUCATION\nStanford University", undefined, {
        headerAlignment: "center",
      });
      expect(html).toContain("doc-header text-center");
    });

    it("detects left-aligned header when candidate name starts at left margin", () => {
      const items: PositionedTextItem[] = [
        { text: "Devon Clark", x: 40, y: 730, width: 140, height: 24 },
        { text: "devon@clark.io • Seattle, WA", x: 40, y: 705, width: 200, height: 10 },
        { text: "WORK EXPERIENCE", x: 40, y: 660, width: 120, height: 12 },
      ];

      const align = detectHeaderAlignment(items, 612);
      expect(align).toBe("left");

      const html = rawTextToHtml("Devon Clark\ndevon@clark.io\n\nWORK EXPERIENCE\nAmazon", undefined, {
        headerAlignment: "left",
      });
      expect(html).toContain("doc-header text-left");
    });

    it("detects split header when candidate name is on left and contact info is clustered on right", () => {
      const items: PositionedTextItem[] = [
        { text: "Maya Patel", x: 40, y: 730, width: 120, height: 24 },
        { text: "maya@patel.com", x: 420, y: 735, width: 100, height: 10 },
        { text: "github.com/mayapatel", x: 420, y: 720, width: 120, height: 10 },
        { text: "linkedin.com/in/mayapatel", x: 420, y: 705, width: 140, height: 10 },
        { text: "EXPERIENCE", x: 40, y: 660, width: 100, height: 12 },
      ];

      const align = detectHeaderAlignment(items, 612);
      expect(align).toBe("split");

      const html = rawTextToHtml("Maya Patel\nmaya@patel.com\n\nEXPERIENCE\nUber", undefined, {
        headerAlignment: "split",
      });
      expect(html).toContain("doc-header flex flex-col sm:flex-row sm:items-end justify-between");
    });
  });

  describe("Part 4: Section Divider & Architecture Styles", () => {
    const resumeText = "Candidate\nemail@test.com\n\nWORK EXPERIENCE\nCompany — Role\n• Built software";

    it("renders line divider with bottom border by default", () => {
      const html = rawTextToHtml(resumeText, undefined, { sectionDivider: "line" });
      expect(html).toContain("border-b border-zinc-200 dark:border-zinc-800");
    });

    it("renders accent divider with left border pill", () => {
      const html = rawTextToHtml(resumeText, undefined, { sectionDivider: "accent" });
      expect(html).toContain("border-l-2 border-zinc-900 dark:border-zinc-100 pl-2");
    });

    it("renders minimal divider without border lines", () => {
      const html = rawTextToHtml(resumeText, undefined, { sectionDivider: "minimal" });
      expect(html).not.toContain("border-b border-zinc-200");
      expect(html).not.toContain("border-l-2");
    });

    it("renders banner divider with background badge", () => {
      const html = rawTextToHtml(resumeText, undefined, { sectionDivider: "banner" });
      expect(html).toContain("bg-zinc-100 dark:bg-zinc-800/80 px-2 py-0.5 rounded");
    });
  });

  describe("Part 5: Two-Column Canvas Grid Rendering & ATS Linearization", () => {
    const fullTwoColResume = 
      "Sophia Loren\n" +
      "sophia@tech.io • San Francisco, CA\n\n" +
      "WORK EXPERIENCE\n" +
      "OpenAI — Research Engineer\n" +
      "• Trained multimodal vision transformers\n" +
      "• Reduced inference memory footprint by 40%\n\n" +
      "PROJECTS\n" +
      "High-Performance Vector Indexer\n" +
      "• Built HNSW graph search in C++\n\n" +
      "TECHNICAL SKILLS\n" +
      "• Languages: Python, C++, CUDA, Go\n" +
      "• Frameworks: PyTorch, TensorRT, Triton\n\n" +
      "EDUCATION\n" +
      "UC Berkeley — M.S. Computer Science\n" +
      "2020 – 2022";

    it("correctly partitions skills and education into sidebar and experience/projects into main column", () => {
      expect(isSidebarSection("TECHNICAL SKILLS")).toBe(true);
      expect(isSidebarSection("EDUCATION")).toBe(true);
      expect(isSidebarSection("CERTIFICATIONS")).toBe(true);
      expect(isSidebarSection("WORK EXPERIENCE")).toBe(false);
      expect(isSidebarSection("FEATURED PROJECTS")).toBe(false);
      expect(isSidebarSection("PROFESSIONAL SUMMARY")).toBe(false);

      const html = rawTextToHtml(fullTwoColResume, undefined, {
        columnLayout: "two_column",
      });

      expect(html).toContain("doc-two-column-layout grid grid-cols-12 gap-5");
      expect(html).toContain("doc-sidebar col-span-4");
      expect(html).toContain("doc-main-column col-span-8");

      // Verify sidebar contains skills and education
      const sidebarMatch = html.match(/<aside class="doc-sidebar[^>]*>([\s\S]*?)<\/aside>/);
      expect(sidebarMatch).toBeTruthy();
      expect(sidebarMatch![1]).toContain("TECHNICAL SKILLS");
      expect(sidebarMatch![1]).toContain("EDUCATION");
      expect(sidebarMatch![1]).not.toContain("WORK EXPERIENCE");

      // Verify main column contains work experience and projects
      const mainMatch = html.match(/<main class="doc-main-column[^>]*>([\s\S]*?)<\/main>/);
      expect(mainMatch).toBeTruthy();
      expect(mainMatch![1]).toContain("WORK EXPERIENCE");
      expect(mainMatch![1]).toContain("OpenAI — Research Engineer");
      expect(mainMatch![1]).toContain("PROJECTS");
      expect(mainMatch![1]).not.toContain("TECHNICAL SKILLS");
    });

    it("linearizes two-column layout into clean ATS reading order without data loss", () => {
      const html = rawTextToHtml(fullTwoColResume, undefined, {
        columnLayout: "two_column",
      });

      const extractedText = extractTextFromHtml(html);

      // Verify candidate name is first
      expect(extractedText).toContain("Sophia Loren");
      // Verify main column (Experience) comes before sidebar (Skills) in ATS extraction
      const expIndex = extractedText.indexOf("WORK EXPERIENCE");
      const skillsIndex = extractedText.indexOf("TECHNICAL SKILLS");
      expect(expIndex).toBeGreaterThan(-1);
      expect(skillsIndex).toBeGreaterThan(-1);
      expect(expIndex).toBeLessThan(skillsIndex);

      // Verify all bullet points and keywords are preserved
      expect(extractedText).toContain("Trained multimodal vision transformers");
      expect(extractedText).toContain("Reduced inference memory footprint by 40%");
      expect(extractedText).toContain("Python, C++, CUDA, Go");
      expect(extractedText).toContain("UC Berkeley");
    });
  });

  describe("Part 6: Layout Preservation in PDF Parsing Contract", () => {
    it("detectPdfLayout derives classic preset for standard single-column tech resumes", () => {
      const rawPdfItems = [
        { str: "Marcus Vance", transform: [1, 0, 0, 1, 40, 720], height: 24, width: 140 },
        { str: "marcus@vance.io • (415) 555-0100", transform: [1, 0, 0, 1, 40, 700], height: 10, width: 200 },
        { str: "WORK EXPERIENCE", transform: [1, 0, 0, 1, 40, 660], height: 12, width: 120 },
        { str: "Stripe — Staff Engineer", transform: [1, 0, 0, 1, 40, 638], height: 11, width: 160 },
        { str: "May 2021 – Present", transform: [1, 0, 0, 1, 420, 638], height: 10, width: 100 },
        { str: "• Architected high-throughput ledger", transform: [1, 0, 0, 1, 40, 620], height: 10, width: 240 },
      ];

      const layout = detectPdfLayout(rawPdfItems, 612);
      expect(layout.columnCount).toBe(1);
      expect(layout.headerAlignment).toBe("left");
      expect(layout.hasSplitRows).toBe(true);
      expect(layout.detectedPreset).toBe("classic");
      expect(layout.fontScale.nameFontSize).toBe(24);
    });

    it("detectPdfLayout derives two_column preset when column boundary is identified", () => {
      const rawPdfItems = [
        { str: "Candidate Name", transform: [1, 0, 0, 1, 40, 720], height: 22, width: 140 },
        // Left column
        { str: "SKILLS", transform: [1, 0, 0, 1, 40, 640], height: 12, width: 50 },
        { str: "• TypeScript", transform: [1, 0, 0, 1, 40, 620], height: 10, width: 70 },
        { str: "• Go", transform: [1, 0, 0, 1, 40, 600], height: 10, width: 40 },
        { str: "• Python", transform: [1, 0, 0, 1, 40, 580], height: 10, width: 50 },
        { str: "EDUCATION", transform: [1, 0, 0, 1, 40, 520], height: 12, width: 80 },
        { str: "Stanford B.S.", transform: [1, 0, 0, 1, 40, 500], height: 10, width: 80 },
        // Right column at overlapping Y
        { str: "WORK EXPERIENCE", transform: [1, 0, 0, 1, 260, 640], height: 12, width: 120 },
        { str: "Apple — Senior Engineer", transform: [1, 0, 0, 1, 260, 620], height: 11, width: 160 },
        { str: "• Built Swift runtime features", transform: [1, 0, 0, 1, 260, 600], height: 10, width: 200 },
        { str: "• Optimized ARC compiler passes", transform: [1, 0, 0, 1, 260, 580], height: 10, width: 210 },
        { str: "PROJECTS", transform: [1, 0, 0, 1, 260, 520], height: 12, width: 80 },
        { str: "LLVM Optimization Pass", transform: [1, 0, 0, 1, 260, 500], height: 10, width: 140 },
      ];

      const layout = detectPdfLayout(rawPdfItems, 612);
      expect(layout.columnCount).toBe(2);
      expect(layout.detectedPreset).toBe("two_column");
    });
  });
});
