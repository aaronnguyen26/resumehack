import { describe, it, expect } from "vitest";
import {
  detectColumns,
  detectHeaderAlignment,
  detectSplitRows,
  detectPdfLayout,
  formatLayoutAwarePdfItems,
  normalizePdfItems,
  buildHighFidelityPdfHtml,
  ExtractedPdfLayout,
  PositionedTextItem,
  isKnownSectionHeader,
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
      expect(html).toContain("border-b-[1.5px] border-zinc-950 dark:border-zinc-200 pb-0.5");
    });

    it("renders accent divider with left border pill", () => {
      const html = rawTextToHtml(resumeText, undefined, { sectionDivider: "accent" });
      expect(html).toContain("border-l-2 border-zinc-950 dark:border-zinc-100 pl-2");
    });

    it("renders minimal divider without border lines", () => {
      const html = rawTextToHtml(resumeText, undefined, { sectionDivider: "minimal" });
      expect(html).not.toContain("border-b");
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

  describe("Part 7: High-Fidelity PDF HTML & Exact Side-by-Side Preservation", () => {
    it("preserves wrapped multi-line bullet points without fragmenting into separate paragraphs", () => {
      const rawPdfItems = [
        { str: "David Mitchell", transform: [1, 0, 0, 1, 40, 720], height: 24, width: 150 },
        { str: "david@mitchell.dev • Austin, TX", transform: [1, 0, 0, 1, 40, 700], height: 10, width: 180 },
        { str: "WORK EXPERIENCE", transform: [1, 0, 0, 1, 40, 660], height: 12, width: 120 },
        { str: "Meta — Senior Software Engineer", transform: [1, 0, 0, 1, 40, 638], height: 11, width: 180 },
        { str: "2021 – Present", transform: [1, 0, 0, 1, 440, 638], height: 10, width: 80 },
        // Bullet point line 1
        { str: "• Spearheaded migration from monolithic services to gRPC event-driven", transform: [1, 0, 0, 1, 40, 618], height: 10, width: 340 },
        // Bullet point line 2 (wrapped continuation without bullet glyph)
        { str: "microservices, slashing P99 API latency by 42% across 14 services.", transform: [1, 0, 0, 1, 52, 604], height: 10, width: 320 },
        // Bullet point 2 line 1
        { str: "• Designed fault-tolerant Kafka stream consumers processing 45k events/sec.", transform: [1, 0, 0, 1, 40, 584], height: 10, width: 380 },
      ];

      const result = buildHighFidelityPdfHtml(rawPdfItems, 612);

      // Verify that bullet 1 is a single continuous <li> element, NOT broken into <p>
      expect(result.html).toContain("doc-bullets");
      expect(result.html).toContain("Spearheaded migration from monolithic services to gRPC event-driven microservices, slashing P99 API latency by 42% across 14 services.");
      
      // Verify no orphaned paragraphs inside the bullet list
      const bulletsMatch = result.html.match(/<ul class="doc-bullets[^>]*>([\s\S]*?)<\/ul>/);
      expect(bulletsMatch).toBeTruthy();
      expect(bulletsMatch![1]).not.toContain("<p");

      // Verify plaintext ATS lines retain the bullet
      expect(result.text).toContain("• Spearheaded migration from monolithic services to gRPC event-driven microservices, slashing P99 API latency by 42% across 14 services.");
    });

    it("preserves left-to-right column spatial orientation in two-column layouts", () => {
      const rawPdfItems = [
        { str: "Jane Developer", transform: [1, 0, 0, 1, 40, 720], height: 24, width: 140 },
        // Left Column (X: 40 to 160) - Sidebar
        { str: "SKILLS", transform: [1, 0, 0, 1, 40, 640], height: 12, width: 50 },
        { str: "• TypeScript, React", transform: [1, 0, 0, 1, 40, 620], height: 10, width: 100 },
        { str: "• Go, Docker", transform: [1, 0, 0, 1, 40, 600], height: 10, width: 80 },
        // Right Column (X: 220 to 550) - Main Content
        { str: "EXPERIENCE", transform: [1, 0, 0, 1, 220, 640], height: 12, width: 90 },
        { str: "Google — Senior Engineer", transform: [1, 0, 0, 1, 220, 620], height: 11, width: 150 },
        { str: "• Built distributed caching engine", transform: [1, 0, 0, 1, 220, 600], height: 10, width: 220 },
      ];

      const result = buildHighFidelityPdfHtml(rawPdfItems, 612);

      // Verify that left column rendered on the left, right column rendered on the right
      expect(result.html).toContain("doc-two-column-layout");
      expect(result.html).toContain("doc-left-column col-span-4");
      expect(result.html).toContain("doc-right-column col-span-8");

      // Verify left column contains SKILLS, right column contains EXPERIENCE
      const leftColMatch = result.html.match(/<aside class="doc-left-column[^>]*>([\s\S]*?)<\/aside>/);
      const rightColMatch = result.html.match(/<main class="doc-right-column[^>]*>([\s\S]*?)<\/main>/);

      expect(leftColMatch).toBeTruthy();
      expect(rightColMatch).toBeTruthy();
      expect(leftColMatch![1]).toContain("SKILLS");
      expect(leftColMatch![1]).toContain("TypeScript, React");
      expect(rightColMatch![1]).toContain("EXPERIENCE");
      expect(rightColMatch![1]).toContain("Google — Senior Engineer");
    });

    it("auto-detects serif font family and compact margins from PDF coordinates and fonts", () => {
      const rawPdfItems = [
        { str: "Prof. Arthur Pendelton", transform: [1, 0, 0, 1, 28, 740], height: 24, width: 200, fontName: "TimesNewRomanPS-BoldMT" },
        { str: "arthur@oxford.ac.uk • Oxford, UK", transform: [1, 0, 0, 1, 28, 715], height: 10, width: 220, fontName: "TimesNewRomanPSMT" },
        { str: "PUBLICATIONS", transform: [1, 0, 0, 1, 28, 670], height: 12, width: 110, fontName: "TimesNewRomanPS-BoldMT" },
        { str: "• Advanced Quantum Algorithms in Topology", transform: [1, 0, 0, 1, 28, 650], height: 10, width: 300, fontName: "TimesNewRomanPSMT" },
        { str: "Journal of Theoretical Physics", transform: [1, 0, 0, 1, 28, 630], height: 10, width: 200, fontName: "TimesNewRomanPS-ItalicMT" },
      ];

      const layout = detectPdfLayout(rawPdfItems, 612);

      expect(layout.detectedFontFamily).toBe("serif");
      expect(layout.detectedMarginSize).toBe("compact");
      expect(layout.margins.left).toBeLessThanOrEqual(36);
    });

    it("generates semantic candidate headers and split job entries in high-fidelity HTML", () => {
      const rawPdfItems = [
        { str: "Sarah Connor", transform: [1, 0, 0, 1, 40, 720], height: 26, width: 140 },
        { str: "sarah@cyberdyne.com • Los Angeles, CA", transform: [1, 0, 0, 1, 40, 696], height: 10, width: 220 },
        { str: "EXPERIENCE", transform: [1, 0, 0, 1, 40, 656], height: 13, width: 90 },
        { str: "Cyberdyne Systems — Lead Engineer", transform: [1, 0, 0, 1, 40, 630], height: 11, width: 210 },
        { str: "2020 – 2024", transform: [1, 0, 0, 1, 460, 630], height: 10, width: 70 },
        { str: "• Defended distributed AI infrastructure against rogue neural processes", transform: [1, 0, 0, 1, 40, 610], height: 10, width: 420 },
      ];

      const result = buildHighFidelityPdfHtml(rawPdfItems, 612);

      expect(result.html).toContain("doc-candidate-name");
      expect(result.html).toContain("Sarah Connor");
      expect(result.html).toContain("doc-contact-info");
      expect(result.html).toContain("sarah@cyberdyne.com");
      expect(result.html).toContain("doc-entry-header flex justify-between items-baseline");
      expect(result.html).toContain("Cyberdyne Systems — Lead Engineer");
      expect(result.html).toContain("2020 – 2024");
      expect(result.html).toContain("Defended distributed AI infrastructure");
    });
  });

  describe("Part 3: Advanced Layout Consistency & Diverse Resume Templates Engine", () => {
    it("detects right-sidebar 2-column layout and formats main content left and sidebar right", () => {
      // Main column on left (X: 40 to 360)
      const leftMainItems: PositionedTextItem[] = [
        { text: "WORK EXPERIENCE", x: 40, y: 640, width: 140, height: 12 },
        { text: "Lead Architect — Distributed Systems Corp", x: 40, y: 620, width: 220, height: 11 },
        { text: "• Built global multi-master database replication cluster", x: 40, y: 600, width: 300, height: 10 },
        { text: "PROJECTS", x: 40, y: 540, width: 80, height: 12 },
        { text: "High-Performance RPC Framework", x: 40, y: 520, width: 180, height: 10 },
      ];

      // Right sidebar on right (X: 410 to 570) at the SAME vertical heights (splitX around 390 / 612 = 63.7%)
      const rightSidebarItems: PositionedTextItem[] = [
        { text: "TECHNICAL SKILLS", x: 410, y: 640, width: 110, height: 12 },
        { text: "• Rust, Go, TypeScript", x: 410, y: 620, width: 130, height: 10 },
        { text: "• Kafka, Redis, Docker", x: 410, y: 600, width: 120, height: 10 },
        { text: "EDUCATION", x: 410, y: 540, width: 80, height: 12 },
        { text: "Stanford University — M.S. CS", x: 410, y: 520, width: 150, height: 10 },
      ];

      const allItems = [
        { text: "Alex Rivera", x: 40, y: 720, width: 150, height: 22 },
        { text: "alex@rivera.dev • San Francisco, CA", x: 40, y: 700, width: 220, height: 10 },
        ...leftMainItems,
        ...rightSidebarItems,
      ];

      const colInfo = detectColumns(allItems, 612);
      expect(colInfo.columnCount).toBe(2);
      expect(colInfo.columnBoundaryX).toBeGreaterThanOrEqual(370);
      expect(colInfo.columnBoundaryX).toBeLessThanOrEqual(410);

      // Verify HTML structure for right-sidebar
      const rawPdfItems = allItems.map(it => ({
        str: it.text,
        transform: [1, 0, 0, 1, it.x, it.y],
        height: it.height,
        width: it.width,
      }));
      const result = buildHighFidelityPdfHtml(rawPdfItems, 612);
      expect(result.html).toContain("doc-main-column col-span-8");
      expect(result.html).toContain("doc-right-sidebar col-span-4");
      expect(result.html).toContain("border-l");
    });

    it("does not generate duplicate candidate headers or promote section titles to h1 on page 2+", () => {
      // Page 2 items starting with a section header at the top
      const page2Items = [
        { str: "EDUCATION & CERTIFICATIONS", transform: [1, 0, 0, 1, 40, 740], height: 14, width: 200 },
        { str: "University of Southern California", transform: [1, 0, 0, 1, 40, 715], height: 11, width: 220 },
        { str: "June 2024", transform: [1, 0, 0, 1, 480, 715], height: 10, width: 60 },
        { str: "B.S. in Computer Science • GPA: 3.9", transform: [1, 0, 0, 1, 40, 695], height: 10, width: 250 },
      ];

      // On Page 2, pageNumber = 2
      const resultPage2 = buildHighFidelityPdfHtml(page2Items, 612, 792, 2);

      // Page 2 must NOT have doc-candidate-name h1 header
      expect(resultPage2.html).not.toContain("doc-candidate-name");
      expect(resultPage2.html).not.toContain("<h1");
      // Must correctly recognize EDUCATION & CERTIFICATIONS as a section header, not candidate name
      expect(resultPage2.html).toContain("doc-section-header");
      expect(resultPage2.html).toContain("EDUCATION &amp; CERTIFICATIONS");
      expect(resultPage2.html).toContain("University of Southern California");
      expect(resultPage2.html).toContain("June 2024");
    });

    it("accurately identifies diverse section header variations via isKnownSectionHeader", () => {
      // Standard expansions
      expect(isKnownSectionHeader("RELEVANT WORK EXPERIENCE")).toBe(true);
      expect(isKnownSectionHeader("CAREER HISTORY")).toBe(true);
      expect(isKnownSectionHeader("TECHNICAL PROFICIENCIES")).toBe(true);
      expect(isKnownSectionHeader("EDUCATION & TRAINING")).toBe(true);
      expect(isKnownSectionHeader("KEY PROJECTS")).toBe(true);

      // Numbered / decorated headers
      expect(isKnownSectionHeader("1. WORK EXPERIENCE")).toBe(true);
      expect(isKnownSectionHeader("02. EDUCATION")).toBe(true);
      expect(isKnownSectionHeader("## TECHNICAL SKILLS")).toBe(true);
      expect(isKnownSectionHeader("EXPERIENCE:")).toBe(true);
      expect(isKnownSectionHeader("--- PROJECTS ---")).toBe(true);

      // Spaced-out letter tracking (common in Canva / LaTeX / InDesign resumes)
      expect(isKnownSectionHeader("E D U C A T I O N")).toBe(true);
      expect(isKnownSectionHeader("E X P E R I E N C E")).toBe(true);
      expect(isKnownSectionHeader("S K I L L S")).toBe(true);

      // Non-headers should be rejected
      expect(isKnownSectionHeader("• Developed cloud native Kubernetes microservices")).toBe(false);
      expect(isKnownSectionHeader("alex@example.com")).toBe(false);
      expect(isKnownSectionHeader("https://github.com/developer")).toBe(false);
    });

    it("correctly handles two-ended split rows with seasons and state abbreviations", () => {
      const items: PositionedTextItem[] = [
        { text: "Staff Software Engineer", x: 40, y: 500, width: 160, height: 11 },
        { text: "Summer 2023 – Present", x: 420, y: 500, width: 140, height: 10 },
        { text: "Senior Frontend Engineer", x: 40, y: 400, width: 160, height: 11 },
        { text: "Austin, TX", x: 460, y: 400, width: 80, height: 10 },
      ];

      expect(detectSplitRows(items, 612)).toBe(true);
    });

    it("detects LaTeX Computer Modern serif fonts accurately", () => {
      const latexItems = [
        { str: "David Hilbert", transform: [1, 0, 0, 1, 40, 720], height: 22, width: 140, fontName: "CMR12" },
        { str: "hilbert@gottingen.edu", transform: [1, 0, 0, 1, 40, 700], height: 10, width: 160, fontName: "CMR10" },
        { str: "PUBLICATIONS", transform: [1, 0, 0, 1, 40, 660], height: 12, width: 90, fontName: "CMBX10" },
        { str: "• Grundlagen der Geometrie", transform: [1, 0, 0, 1, 40, 640], height: 10, width: 220, fontName: "LMRoman10-Regular" },
      ];

      const layout = detectPdfLayout(latexItems, 612);
      expect(layout.detectedFontFamily).toBe("serif");
    });

    it("preserves Word Wingdings and Unicode bullet glyphs with multi-line continuation", () => {
      const bulletItems = [
        { str: "EXPERIENCE", transform: [1, 0, 0, 1, 40, 650], height: 12, width: 80 },
        // Word Wingdings bullet \uF0B7
        { str: "\uF0B7 Engineered low-latency consensus state machine across distributed", transform: [1, 0, 0, 1, 40, 625], height: 10, width: 400 },
        // Continuation line of the bullet wrapped onto line below
        { str: "database nodes yielding 99.999% availability during network splits.", transform: [1, 0, 0, 1, 55, 612], height: 10, width: 380 },
        // Black circle bullet \u25CF
        { str: "● Spearheaded migration to containerized microservices architecture.", transform: [1, 0, 0, 1, 40, 590], height: 10, width: 410 },
      ];

      const result = buildHighFidelityPdfHtml(bulletItems, 612);
      expect(result.html).toContain("Engineered low-latency consensus state machine across distributed database nodes yielding 99.999% availability during network splits.");
      expect(result.html).toContain("Spearheaded migration to containerized microservices architecture.");
    });
  });
});
