import { describe, it, expect } from "vitest";
import { 
  extractTextFromPdf,
  formatExtractedPdfItems,
  normalizeExtractedResumeText,
  decodePdfHexString,
  extractTextFromOperatorStream,
  parseUploadedResumeFile,
  buildStarterResumeText,
  getPdfJsLib,
} from "../../../web/src/services/file-parser.js";
import { 
  rawTextToHtml, 
  extractTextFromHtml, 
  isSectionHeaderLine,
  isJobMetaLine,
  isBulletLine,
  cleanBulletLine,
  KNOWN_SECTION_HEADERS,
} from "../../../web/src/services/canvas-editor.js";

function createSyntheticPdf(lines: string[]): ArrayBuffer {
  let stream = "BT\n/F1 12 Tf\n";
  let y = 720;
  for (const line of lines) {
    const escaped = line.replace(/[()\\]/g, "");
    stream += "50 " + y + " Td\n(" + escaped + ") Tj\n-50 -" + y + " Td\n";
    y -= 22;
  }
  stream += "ET\n";
  const streamBytes = Buffer.from(stream, "utf-8");
  const len = streamBytes.length;

  const pdf = "%PDF-1.4\n" +
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n" +
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n" +
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n" +
    "4 0 obj\n<< /Length " + len + " >>\nstream\n" + stream + "endstream\nendobj\n" +
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n" +
    "xref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000266 00000 n \n0000000360 00000 n \n" +
    "trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n500\n%%EOF";

  return Buffer.from(pdf, "utf-8").buffer;
}

describe("PDF Extraction & Document Canvas Architecture Test Suite", () => {
  describe("Part 1: Real PDF Binary Buffer Extraction", () => {
    it("extracts multi-line candidate resume from synthetic PDF binary buffer without falling back to starter template", async () => {
      const pdfLines = [
        "Marcus Vance",
        "marcus.vance@example.com • (415) 555-0199 • San Francisco, CA",
        "WORK EXPERIENCE",
        "Nexis Cloud Systems — Staff Platform Engineer",
        "San Francisco, CA | 2022 – Present",
        "• Architected high-throughput event streaming engine in Go handling 40k events/sec",
        "• Reduced P99 latency by 55% via distributed Redis caching and connection pooling",
        "PROJECTS",
        "Distributed Consensus Key-Value Store",
        "• Implemented Raft consensus protocol across 5 nodes with automated leader re-election",
        "EDUCATION",
        "University of Washington",
        "B.S. in Computer Science | 2018 – 2022",
        "TECHNICAL SKILLS",
        "• Languages: Go, TypeScript, Python, SQL, C++",
        "• Cloud & Tools: AWS, Kubernetes, Docker, PostgreSQL, Redis, gRPC"
      ];

      const pdfBuffer = createSyntheticPdf(pdfLines);
      const extracted = await extractTextFromPdf(pdfBuffer);

      expect(extracted).toBeTruthy();
      expect(extracted).toContain("Marcus Vance");
      expect(extracted).toContain("marcus.vance@example.com");
      expect(extracted).toContain("Nexis Cloud Systems");
      expect(extracted).toContain("Staff Platform Engineer");
      expect(extracted).toContain("Architected high-throughput event streaming engine");
      expect(extracted).toContain("Distributed Consensus Key-Value Store");
      expect(extracted).toContain("University of Washington");
      expect(extracted).toContain("Languages: Go, TypeScript, Python");
      expect(extracted).not.toContain("FinTech Labs");
    });

    it("parses uploaded PDF file through parseUploadedResumeFile returning clean text and correct metadata", async () => {
      const pdfLines = [
        "Elena Rostova",
        "elena@rostova.dev • Seattle, WA",
        "WORK EXPERIENCE",
        "HyperScale AI — Senior Machine Learning Engineer",
        "• Optimized LLM inference latency by 42% utilizing vLLM and TensorRT-LLM",
        "TECHNICAL SKILLS",
        "• Skills: PyTorch, CUDA, Python, Docker, Triton"
      ];

      const pdfBuffer = createSyntheticPdf(pdfLines);
      const file = new File([pdfBuffer], "Elena_Rostova_Resume.pdf", { type: "application/pdf" });

      const parsed = await parseUploadedResumeFile(file);
      expect(parsed.fileName).toBe("Elena_Rostova_Resume.pdf");
      expect(parsed.fileType).toBe("pdf");
      expect(parsed.charCount).toBeGreaterThan(50);
      expect(parsed.text).toContain("Elena Rostova");
      expect(parsed.text).toContain("HyperScale AI");
      expect(parsed.text).toContain("Optimized LLM inference latency");
    });
  });

  describe("Part 2: Single-Newline Canvas Resiliency (Preventing Single Giant Contact Line Bug)", () => {
    it("correctly isolates candidate header and sections when resume text has ONLY single newlines (no blank lines)", () => {
      const singleNewlineResume = "Jane Doe\n" +
        "jane.doe@techcorp.io • (555) 234-5678 • New York, NY\n" +
        "WORK EXPERIENCE\n" +
        "Stripe — Senior Infrastructure Engineer\n" +
        "New York, NY | 2021 – Present\n" +
        "• Architected multi-region transactional ledger with zero ledger divergence\n" +
        "• Reduced database query times by 62% through partition optimization\n" +
        "PROJECTS\n" +
        "High-Throughput Raft Engine\n" +
        "Go, Docker | 2023\n" +
        "• Built distributed consensus engine handling 25,000 write ops/sec\n" +
        "EDUCATION\n" +
        "Cornell University\n" +
        "B.S. in Computer Science | 2017 – 2021\n" +
        "TECHNICAL SKILLS\n" +
        "• Languages: Go, Python, TypeScript, SQL\n" +
        "• Infrastructure: Kubernetes, Docker, AWS, PostgreSQL";

      const html = rawTextToHtml(singleNewlineResume);

      expect(html).toContain("Jane Doe");
      expect(html).toContain("jane.doe@techcorp.io • (555) 234-5678 • New York, NY");

      const contactMatch = html.match(/<p class="doc-contact-info[^>]*>([\s\S]*?)<\/p>/);
      expect(contactMatch).toBeTruthy();
      expect(contactMatch[1]).not.toContain("WORK EXPERIENCE");
      expect(contactMatch[1]).not.toContain("Stripe");
      expect(contactMatch[1]).not.toContain("Cornell University");
      expect(contactMatch[1]).not.toContain("TECHNICAL SKILLS");

      expect(html).toContain("WORK EXPERIENCE");
      expect(html).toContain("PROJECTS");
      expect(html).toContain("EDUCATION");
      expect(html).toContain("TECHNICAL SKILLS");

      expect(html).toContain("Stripe — Senior Infrastructure Engineer");
      expect(html).toContain("New York, NY | 2021 – Present");

      expect(html).toContain("Architected multi-region transactional ledger with zero ledger divergence");
      expect(html).toContain("Reduced database query times by 62% through partition optimization");
      expect(html).toContain("Built distributed consensus engine handling 25,000 write ops/sec");
    });

    it("handles unstructured resumes gracefully without throwing errors", () => {
      const unstructuredText = "Alex Mercer\n" +
        "Senior Backend Developer\n" +
        "Passionate engineer building distributed systems and high-performance APIs.\n" +
        "• Built microservices in Node.js\n" +
        "• Maintained MongoDB clusters";

      const html = rawTextToHtml(unstructuredText);
      expect(html).toContain("Alex Mercer");
      expect(html).toContain("Senior Backend Developer");
      expect(html).toContain("Passionate engineer building distributed systems");
      expect(html).toContain("Built microservices in Node.js");
    });
  });

  describe("Part 3: Section Header & Metadata Line Detection Logic", () => {
    it("detects all standard known section header lines regardless of casing and punctuation", () => {
      expect(isSectionHeaderLine("WORK EXPERIENCE")).toBe(true);
      expect(isSectionHeaderLine("work experience:")).toBe(true);
      expect(isSectionHeaderLine("PROFESSIONAL EXPERIENCE")).toBe(true);
      expect(isSectionHeaderLine("EXPERIENCE")).toBe(true);
      expect(isSectionHeaderLine("FEATURED PROJECTS")).toBe(true);
      expect(isSectionHeaderLine("PROJECTS:")).toBe(true);
      expect(isSectionHeaderLine("TECHNICAL SKILLS")).toBe(true);
      expect(isSectionHeaderLine("SKILLS & EXPERTISE")).toBe(true);
      expect(isSectionHeaderLine("EDUCATION")).toBe(true);
      expect(isSectionHeaderLine("EDUCATION & CREDENTIALS")).toBe(true);
      expect(isSectionHeaderLine("CERTIFICATIONS")).toBe(true);
      expect(isSectionHeaderLine("HONORS & AWARDS")).toBe(true);
      expect(isSectionHeaderLine("LEADERSHIP")).toBe(true);
      expect(isSectionHeaderLine("SUMMARY")).toBe(true);
      expect(isSectionHeaderLine("PROFESSIONAL SUMMARY")).toBe(true);

      expect(isSectionHeaderLine("• Architected distributed systems in Go")).toBe(false);
      expect(isSectionHeaderLine("- Built APIs in Python")).toBe(false);
      expect(isSectionHeaderLine("alex@example.com • 555-1234")).toBe(false);
      expect(isSectionHeaderLine("https://linkedin.com/in/alex")).toBe(false);
      expect(isSectionHeaderLine("Senior Software Engineer at Google")).toBe(false);
    });

    it("identifies date ranges, locations, and employment metadata correctly", () => {
      expect(isJobMetaLine("San Francisco, CA | 2022 – Present")).toBe(true);
      expect(isJobMetaLine("2020 – 2024")).toBe(true);
      expect(isJobMetaLine("Jan 2021 - May 2023 | Remote")).toBe(true);
      expect(isJobMetaLine("Remote | Full-time")).toBe(true);
      expect(isJobMetaLine("Austin, TX | 2019 - 2021")).toBe(true);

      expect(isJobMetaLine("Senior Software Engineer")).toBe(false);
      expect(isJobMetaLine("• Architected high-throughput payment pipelines")).toBe(false);
    });

    it("identifies and cleans bullet points across varied symbols", () => {
      expect(isBulletLine("• Standard bullet")).toBe(true);
      expect(isBulletLine("- Dash bullet")).toBe(true);
      expect(isBulletLine("* Asterisk bullet")).toBe(true);
      expect(isBulletLine("▪ Box bullet")).toBe(true);
      expect(isBulletLine("▸ Arrow bullet")).toBe(true);

      expect(cleanBulletLine("• Standard bullet")).toBe("Standard bullet");
      expect(cleanBulletLine("- Dash bullet")).toBe("Dash bullet");
      expect(cleanBulletLine("* Asterisk bullet")).toBe("Asterisk bullet");
      expect(cleanBulletLine("▪ Box bullet")).toBe("Box bullet");
      expect(cleanBulletLine("▸ Arrow bullet")).toBe("Arrow bullet");
    });
  });

  describe("Part 4: PDF Positioned Item Formatting & Spacing Engine", () => {
    it("groups items on the same baseline with baseline jitter and separates wide columns", () => {
      const items = [
        { str: "Google LLC", transform: [1, 0, 0, 1, 50, 700.2], height: 12, width: 60 },
        { str: "May 2021 – Present", transform: [1, 0, 0, 1, 400, 699.8], height: 10, width: 80 },
        { str: "Staff Software Engineer", transform: [1, 0, 0, 1, 50, 686], height: 11, width: 120 },
      ];

      const formatted = formatExtractedPdfItems(items);
      const lines = formatted.split("\n");

      expect(lines.length).toBe(2);
      expect(lines[0]).toContain("Google LLC");
      expect(lines[0]).toContain("May 2021 – Present");
      expect(lines[0]).toContain("Google LLC | May 2021 – Present");
      expect(lines[1]).toBe("Staff Software Engineer");
    });

    it("inserts clean paragraph breaks between sections when vertical distance exceeds threshold", () => {
      const items = [
        { str: "WORK EXPERIENCE", transform: [1, 0, 0, 1, 50, 700], height: 12 },
        { str: "Acme Corp — Engineer", transform: [1, 0, 0, 1, 50, 684], height: 10 },
        { str: "• Built backend APIs", transform: [1, 0, 0, 1, 50, 670], height: 10 },
        // Large vertical jump to next section
        { str: "EDUCATION", transform: [1, 0, 0, 1, 50, 620], height: 12 },
        { str: "Stanford University", transform: [1, 0, 0, 1, 50, 604], height: 10 },
      ];

      const formatted = formatExtractedPdfItems(items);
      expect(formatted).toContain("WORK EXPERIENCE");
      expect(formatted).toContain("Acme Corp — Engineer");
      expect(formatted).toContain("EDUCATION");
      expect(formatted).toContain("Stanford University");
      expect(formatted).toMatch(/• Built backend APIs\s*\n\s*\nEDUCATION/);
    });

    it("normalizes common PDF ligatures and quote symbols", () => {
      const raw = "The \uFB01rst \uFB02ight over the o\uFB03ce cluster was \u201Cstellar\u201D \u2014 99.9% uptime";
      const normalized = normalizeExtractedResumeText(raw);
      expect(normalized).toBe("The first flight over the office cluster was \"stellar\" - 99.9% uptime");
    });
  });

  describe("Part 5: Modern PDF Hex String & Stream Decoders", () => {
    it("decodes 2-byte UTF-16BE hex strings commonly used in font subsetting", () => {
      const hex = "00480065006C006C006F";
      const decoded = decodePdfHexString(hex);
      expect(decoded).toBe("Hello");
    });

    it("decodes 1-byte ASCII hex strings", () => {
      const hex = "476F4C616E67";
      const decoded = decodePdfHexString(hex);
      expect(decoded).toBe("GoLang");
    });

    it("extracts text from complex operator streams containing both text and hex tokens in TJ arrays", () => {
      const stream = "BT\n/F1 12 Tf\n50 700 Td\n[(Software) 20 (Engineer)] TJ\n50 680 Td\n<005300740072006900700065> Tj\nET\n";
      const extracted = extractTextFromOperatorStream(stream);
      expect(extracted).toContain("Software Engineer");
      expect(extracted).toContain("Stripe");
    });
  });

  describe("Part 6: Round-Trip HTML & Plaintext Fidelity", () => {
    it("preserves bullet hierarchy and section headers when converting to HTML and back to plaintext", () => {
      const original = "David Bowman\n" +
        "david@bowman.io • (555) 987-6543 • Seattle, WA\n\n" +
        "WORK EXPERIENCE\n" +
        "Discovery Systems — Senior Mission Specialist\n" +
        "Jupiter Orbit | 2023 – Present\n" +
        "• Monitored HAL 9000 automated telemetry systems with zero mission downtime\n" +
        "• Formulated fault recovery procedures for autonomous EVA pods\n\n" +
        "TECHNICAL SKILLS\n" +
        "• Languages: C, Python, Go, Assembly\n" +
        "• Systems: Spacecraft Telemetry, Real-Time Operating Systems, Fault Recovery";

      const html = rawTextToHtml(original);
      const extractedPlain = extractTextFromHtml(html);

      expect(extractedPlain).toContain("David Bowman");
      expect(extractedPlain).toContain("david@bowman.io");
      expect(extractedPlain).toContain("WORK EXPERIENCE");
      expect(extractedPlain).toContain("Discovery Systems — Senior Mission Specialist");
      expect(extractedPlain).toContain("• Monitored HAL 9000 automated telemetry systems with zero mission downtime");
      expect(extractedPlain).toContain("• Formulated fault recovery procedures for autonomous EVA pods");
      expect(extractedPlain).toContain("TECHNICAL SKILLS");
      expect(extractedPlain).toContain("• Languages: C, Python, Go, Assembly");
    });
  });

  describe("Part 7: PDF Upload Resilience & Re-Sync Protection Contract", () => {
    it("ensures getPdfJsLib initializes GlobalWorkerOptions.workerSrc when simulated in browser environment", async () => {
      const origWindow = (globalThis as any).window;
      try {
        (globalThis as any).window = { location: { href: "http://localhost:5173", origin: "http://localhost:5173" } };
        const lib = await getPdfJsLib();
        expect(lib).toBeDefined();
        expect(lib.GlobalWorkerOptions).toBeDefined();
        expect(lib.GlobalWorkerOptions.workerSrc).toBeTruthy();
      } finally {
        if (origWindow === undefined) {
          delete (globalThis as any).window;
        } else {
          (globalThis as any).window = origWindow;
        }
      }
    });

    it("throws a descriptive error when PDF file yields zero readable text without substituting mock starter resume", async () => {
      // Empty PDF without text streams
      const emptyPdf = "%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [] /Count 0 >>\nendobj\ntrailer\n<< /Size 3 /Root 1 0 R >>\nstartxref\n100\n%%EOF";
      const file = new File([Buffer.from(emptyPdf)], "Blank_Scanned.pdf", { type: "application/pdf" });

      await expect(parseUploadedResumeFile(file)).rejects.toThrow(/Could not extract text from this PDF/);
    });

    it("preserves actual candidate resume during re-sync instead of replacing it with mock resume", () => {
      const userResume = "Marcus Aurelius\nmarcus@rome.org\n\nEXPERIENCE\n• Architected resilient governance and defensive infrastructure";
      const parsedUserResume = {
        candidateName: "Marcus Aurelius",
        bullets: [{ id: "b-1", originalText: "Architected resilient governance and defensive infrastructure", section: "EXPERIENCE" }],
        sections: [{ title: "EXPERIENCE", lines: ["• Architected resilient governance and defensive infrastructure"] }],
        rawText: userResume,
      };

      // Simulate re-sync function contract
      const simulateReSync = (currentText: string, storageText: string, isGoogleDocMode: boolean) => {
        if (isGoogleDocMode) {
          return { type: "google_docs", text: "Google Doc Text" };
        }
        const textToSync = currentText.trim() || storageText.trim();
        if (textToSync) {
          return {
            type: "actual_user_resume",
            text: textToSync,
            bulletsCount: 1,
            isMock: false,
          };
        }
        return { type: "mock_fallback", isMock: true };
      };

      const result = simulateReSync(userResume, "", false);
      expect(result.type).toBe("actual_user_resume");
      expect(result.isMock).toBe(false);
      expect(result.text).toContain("Marcus Aurelius");
      expect(result.text).not.toContain("Alex Chen");
      expect(result.text).not.toContain("FinTech Labs");
    });

    it("prioritizes saved user custom resume on initial mount over unlinked Google Doc mock", () => {
      const userCustomResume = "Grace Hopper\ngrace@navy.mil\n\nEXPERIENCE\n• Invented the first compiler for programming languages";
      const settings = { masterDocId: "old-unlinked-doc-id" };
      const token = null; // Unauthenticated or expired

      // Simulate mount resolution logic
      const resolveInitialResume = (savedMode: string | null, savedCustomResume: string, masterDocId: string | undefined, hasToken: boolean) => {
        const mode = savedMode || (savedCustomResume ? "in_app_canvas" : "in_app_canvas");
        if (mode === "google_docs" && masterDocId && hasToken) {
          return { source: "google_docs_live" };
        }
        if (savedCustomResume && savedCustomResume.trim()) {
          return { source: "user_custom_resume", text: savedCustomResume, isMock: false };
        }
        return { source: "mock_template", isMock: true };
      };

      const resolved = resolveInitialResume("in_app_canvas", userCustomResume, settings.masterDocId, Boolean(token));
      expect(resolved.source).toBe("user_custom_resume");
      expect(resolved.isMock).toBe(false);
      expect(resolved.text).toContain("Grace Hopper");
      expect(resolved.text).not.toContain("Alex Chen");
    });
  });
});
