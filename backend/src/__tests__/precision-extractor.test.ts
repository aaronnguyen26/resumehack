import { describe, it, expect } from 'vitest';
import {
  detectPlatform,
  extractGoogleDocId,
  htmlToPlainText,
  scoreCandidate,
  PrecisionExtractor,
} from '../services/precision-extractor.js';

describe('PrecisionExtractor & Platform Detection', () => {
  const extractor = new PrecisionExtractor();

  it('detects Google Docs URLs correctly', () => {
    const url = 'https://docs.google.com/document/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit';
    expect(detectPlatform(url)).toBe('google-docs');
    expect(extractGoogleDocId(url)).toBe('1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms');
  });

  it('detects Notion, Word Online, PDF, and HTML platforms correctly', () => {
    expect(detectPlatform('https://www.notion.so/my-workspace/Resume-12345')).toBe('notion');
    expect(detectPlatform('https://onedrive.live.com/view.aspx?resid=ABCDEF')).toBe('word-online');
    expect(detectPlatform('https://example.com/resume.pdf')).toBe('pdf-viewer');
    expect(detectPlatform('https://john-doe.github.io/resume')).toBe('html-resume');
  });

  it('converts mobilebasic HTML into clean plain text', () => {
    const rawHtml = `
      <div id="doc-content">
        <p><strong>Jane Doe</strong></p>
        <p>jane.doe@berkeley.edu | (510) 555-0199</p>
        <p><strong>EXPERIENCE</strong></p>
        <ul>
          <li>Engineered real-time telemetry streaming using Go and Kafka.</li>
          <li>Optimized PostgreSQL database queries reducing p99 latency by 45%.</li>
        </ul>
      </div>
    `;

    const plain = htmlToPlainText(rawHtml);
    expect(plain).toContain('Jane Doe');
    expect(plain).toContain('jane.doe@berkeley.edu');
    expect(plain).toContain('• Engineered real-time telemetry');
    expect(plain).toContain('• Optimized PostgreSQL');
    expect(plain).not.toContain('<strong>');
    expect(plain).not.toContain('<ul>');
    expect(plain).not.toContain('<li>');
  });

  it('scores high-quality resumes with headers and bullets highly', () => {
    const highQualityResume = `
      Alex Rivera
      alex.rivera@example.com | (415) 555-0142 | San Francisco, CA

      EXPERIENCE
      Acme Corporation — Software Engineer Intern
      • Architected microservices with TypeScript, Node.js, and Redis caching.
      • Implemented automated CI/CD pipeline reducing deployment cycle by 60%.
      • Collaborated with product designers to ship customer-facing analytics dashboard.

      PROJECTS
      Distributed KV Store | Go, Raft, Docker
      • Built fault-tolerant distributed storage engine using Raft consensus protocol.
      • Designed REST API endpoints with 99.9% uptime SLA under high concurrency.

      SKILLS
      Languages: Python, Go, TypeScript, SQL, C++
      Technologies: Docker, Kubernetes, AWS, PostgreSQL, Redis, React
      
      EDUCATION
      University of California, Berkeley — B.S. in Computer Science
    `;

    const score = scoreCandidate({
      text: highQualityResume,
      strategy: 'mobilebasic',
      wordCount: highQualityResume.split(/\s+/).filter(Boolean).length,
    });

    expect(score).toBeGreaterThanOrEqual(60);
  });

  it('penalizes UI artifacts and duplicate content', () => {
    const noisyText = `
      File Edit View Insert Format Tools Extensions Help
      Suggesting Editing Viewing
      Normal text Arial
      1
      Alex Rivera
      Alex Rivera
      Alex Rivera
      Zoom in More options
    `;

    const score = scoreCandidate({
      text: noisyText,
      strategy: 'leaf-span',
      wordCount: noisyText.split(/\s+/).filter(Boolean).length,
    });

    expect(score).toBeLessThan(30);
  });

  it('post-processes and strips UI toolbar artifacts and deduplicates lines', () => {
    const raw = `
      File
      Edit
      View
      Alex Rivera
      alex@example.com
      Normal text
      1
      • Engineered scalable backend services using Go and PostgreSQL.
      • Engineered scalable backend services using Go and PostgreSQL.
      - Developed responsive web interfaces using React and Tailwind CSS.
      Suggesting
    `;

    const cleaned = extractor.postProcess(raw);
    const lines = cleaned.split('\n');

    expect(cleaned).not.toContain('File');
    expect(cleaned).not.toContain('Edit');
    expect(cleaned).not.toContain('Normal text');
    expect(cleaned).not.toContain('Suggesting');
    expect(lines.filter(l => l.includes('Engineered scalable backend')).length).toBe(1);
    expect(cleaned).toContain('• Developed responsive web interfaces');
  });
});
