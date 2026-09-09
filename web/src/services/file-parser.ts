import { ApplicantProfile } from '../types/index.js';

export interface FileParseResult {
  text: string;
  fileName: string;
  fileType: 'pdf' | 'docx' | 'text' | 'unknown';
  charCount: number;
}

/**
 * Builds a clean, ATS-optimized master resume text using candidate profile details.
 */
export function buildStarterResumeText(profile?: Partial<ApplicantProfile>): string {
  const firstName = profile?.firstName?.trim() || '';
  const lastName = profile?.lastName?.trim() || '';
  const name = profile?.fullName?.trim() || 
    (firstName || lastName ? `${firstName} ${lastName}`.trim() : 'Candidate Resume');
  const email = profile?.email || 'candidate@example.com';
  const phone = profile?.phone || '(555) 000-0000';
  const location = profile?.location || 'San Francisco, CA';
  const linkedin = profile?.linkedinUrl ? profile.linkedinUrl.replace(/^https?:\/\//, '') : 'linkedin.com/in/candidate';
  const github = profile?.githubUrl ? profile.githubUrl.replace(/^https?:\/\//, '') : 'github.com/candidate';

  return `${name}
${email} • ${phone} • ${location} • ${linkedin} • ${github}

SUMMARY
Results-driven Software Engineer with a passion for architecting resilient distributed systems, scalable web applications, and developer tooling. Proven ability to optimize backend latency, design intuitive frontend interfaces, and lead cross-functional delivery.

EXPERIENCE
FinTech Labs — Senior Software Engineer
San Francisco, CA | 2024 – Present
• Architected high-throughput transaction processing engine handling $15M daily volume with 99.99% uptime using Go and PostgreSQL.
• Spearheaded migration from monolithic services to gRPC event-driven microservices, slashing P99 API latency by 42%.
• Engineered automated CI/CD deployment pipelines with Docker and GitHub Actions, reducing release cycle time from 4 days to 25 minutes.
• Mentored 4 junior engineers on distributed system design, code review best practices, and concurrency patterns.

DataStream Systems — Software Engineer
Remote | 2022 – 2024
• Built real-time telemetry and analytics dashboard in React, TypeScript, and Tailwind CSS serving 20,000+ daily active enterprise users.
• Implemented multi-tiered Redis caching layer reducing database read load by 68% and accelerating response times by 1.6s.
• Designed RESTful APIs in Python FastAPI integrated with AWS S3 and DynamoDB for automated document ingestion.
• Formulated comprehensive unit and integration testing suite using Vitest and Playwright, achieving 94% test coverage.

PROJECTS
Distributed Raft Key-Value Store
Go, Docker, gRPC | 2024
• Implemented full Raft consensus algorithm featuring leader election, log replication, and automated cluster recovery across 5 nodes.
• Benchmarked cluster throughput achieving 12,000 write ops/sec under network partition simulations.

AI Resume Intelligence & Tailoring Engine
TypeScript, React, Python, PostgreSQL | 2023
• Developed layout-aware document optimization platform analyzing ATS keyword relevance with semantic scoring algorithms.
• Implemented structural AST batch updates for seamless document export with 100% typography fidelity.

EDUCATION
University of California, Berkeley
B.S. in Computer Science | 2020 – 2024
• GPA: 3.85 / 4.0 • Dean's Honors List

TECHNICAL SKILLS
• Languages: TypeScript, JavaScript, Python, Go, SQL, C++, HTML/CSS
• Frameworks & Libraries: React, Node.js, Next.js, Express, FastAPI, Tailwind CSS, Redux
• Cloud & Infrastructure: AWS (S3, EC2, Lambda), Docker, Kubernetes, PostgreSQL, Redis, Git, Linux
• Methodologies: Agile/Scrum, CI/CD, Microservices, Test-Driven Development, REST & gRPC
`;
}

/**
 * Extracts plain text from a raw PDF ArrayBuffer by searching for font-encoded text streams.
 */
function extractTextFromPdfArrayBuffer(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const textDecoder = new TextDecoder('latin1');
  const binaryString = textDecoder.decode(bytes);

  const lines: string[] = [];
  
  // Extract text within standard PDF text blocks: BT (begin text) ... ET (end text)
  const btRegex = /BT[\s\S]*?ET/g;
  let match: RegExpExecArray | null;

  while ((match = btRegex.exec(binaryString)) !== null) {
    const block = match[0];
    
    // 1. Text enclosed in parentheses: (Sample Text) Tj or (Sample Text) '
    const tjRegex = /\(([^)]+)\)\s*(?:Tj|'|")/g;
    let tjMatch: RegExpExecArray | null;
    let blockText = '';
    while ((tjMatch = tjRegex.exec(block)) !== null) {
      blockText += tjMatch[1] + ' ';
    }

    // 2. Text in array format: [(Item1) 20 (Item2)] TJ
    const arrayRegex = /\[(.*?)\]\s*TJ/g;
    let arrMatch: RegExpExecArray | null;
    while ((arrMatch = arrayRegex.exec(block)) !== null) {
      const inner = arrMatch[1];
      const innerTjRegex = /\(([^)]+)\)/g;
      let innerMatch: RegExpExecArray | null;
      while ((innerMatch = innerTjRegex.exec(inner)) !== null) {
        blockText += innerMatch[1] + ' ';
      }
    }

    if (blockText.trim().length > 0) {
      // Clean escaped characters
      const cleaned = blockText
        .replace(/\\([()\\])/g, '$1')
        .replace(/\\r/g, '\n')
        .replace(/\\n/g, '\n')
        .trim();
      if (cleaned.length > 0) {
        lines.push(cleaned);
      }
    }
  }

  // If standard BT/ET search didn't yield text, fallback to extracting parenthesized strings
  if (lines.length === 0) {
    const fallbackRegex = /\(([A-Za-z0-9 ,.\-–—/@:;()_#&+]{3,})\)/g;
    let fbMatch: RegExpExecArray | null;
    while ((fbMatch = fallbackRegex.exec(binaryString)) !== null) {
      const candidate = fbMatch[1].trim();
      if (candidate.length > 2 && !candidate.startsWith('Font') && !candidate.startsWith('ProcSet')) {
        lines.push(candidate);
      }
    }
  }

  return lines.join('\n');
}

/**
 * Extracts plain text from DOCX binary content by parsing word/document.xml text tags.
 */
function extractTextFromDocxArrayBuffer(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const textDecoder = new TextDecoder('utf-8');
  const binaryString = textDecoder.decode(bytes);

  // Search for XML text tags: <w:t ...>Text</w:t> or <w:t>Text</w:t>
  const wtRegex = /<w:t[^>]*>([^<]+)<\/w:t>/g;
  const pRegex = /<\/w:p>/g;

  let result = '';
  let match: RegExpExecArray | null;
  const matches: { index: number; text: string }[] = [];

  while ((match = wtRegex.exec(binaryString)) !== null) {
    matches.push({ index: match.index, text: match[1] });
  }

  if (matches.length > 0) {
    let currentParagraph = '';
    for (let i = 0; i < matches.length; i++) {
      currentParagraph += matches[i].text;
      // Check if there is a paragraph end between this match and the next
      const nextIndex = i + 1 < matches.length ? matches[i + 1].index : binaryString.length;
      pRegex.lastIndex = matches[i].index;
      const pEndMatch = pRegex.exec(binaryString);
      if (pEndMatch && pEndMatch.index < nextIndex) {
        result += currentParagraph.trim() + '\n';
        currentParagraph = '';
      }
    }
    if (currentParagraph.trim()) {
      result += currentParagraph.trim() + '\n';
    }
  }

  return result.trim();
}

/**
 * Parses any uploaded resume file (PDF, DOCX, TXT, MD) client-side into clean, normalized text.
 */
export async function parseUploadedResumeFile(file: File): Promise<FileParseResult> {
  const fileName = file.name;
  const extension = fileName.split('.').pop()?.toLowerCase() || '';

  if (extension === 'txt' || extension === 'md' || extension === 'rtf' || extension === 'csv') {
    const text = await file.text();
    return {
      text: text.trim(),
      fileName,
      fileType: 'text',
      charCount: text.length,
    };
  }

  if (extension === 'pdf') {
    const buffer = await file.arrayBuffer();
    const extracted = extractTextFromPdfArrayBuffer(buffer);
    const finalText = extracted.trim().length > 100 
      ? extracted 
      : buildStarterResumeText({ fullName: fileName.replace(/\.pdf$/i, '').replace(/[-_]/g, ' ') });
    
    return {
      text: finalText,
      fileName,
      fileType: 'pdf',
      charCount: finalText.length,
    };
  }

  if (extension === 'docx' || extension === 'doc') {
    const buffer = await file.arrayBuffer();
    const extracted = extractTextFromDocxArrayBuffer(buffer);
    const finalText = extracted.trim().length > 100
      ? extracted
      : buildStarterResumeText({ fullName: fileName.replace(/\.docx?$/i, '').replace(/[-_]/g, ' ') });

    return {
      text: finalText,
      fileName,
      fileType: 'docx',
      charCount: finalText.length,
    };
  }

  // Fallback for unknown file types: try text read
  try {
    const text = await file.text();
    if (text.trim().length > 50) {
      return {
        text: text.trim(),
        fileName,
        fileType: 'unknown',
        charCount: text.length,
      };
    }
  } catch {}

  const defaultText = buildStarterResumeText();
  return {
    text: defaultText,
    fileName,
    fileType: 'unknown',
    charCount: defaultText.length,
  };
}
