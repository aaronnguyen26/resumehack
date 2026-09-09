import { ApplicantProfile } from '../types/index.js';

export function escapeHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function unescapeHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");
}

/**
 * Converts plain text resume into clean, semantically structured editable HTML.
 * The resulting HTML is directly editable via contentEditable like Google Docs.
 */
export function rawTextToHtml(rawText: string, applicantProfile?: Partial<ApplicantProfile>): string {
  if (!rawText || !rawText.trim()) {
    const firstName = applicantProfile?.firstName?.trim() || '';
    const lastName = applicantProfile?.lastName?.trim() || '';
    const profileName = applicantProfile?.fullName?.trim() || 
      (firstName || lastName ? `${firstName} ${lastName}`.trim() : 'Candidate Name');
    const email = applicantProfile?.email || 'candidate@example.com';
    const phone = applicantProfile?.phone || '(555) 000-0000';
    const location = applicantProfile?.location || 'San Francisco, CA';
    const linkedin = applicantProfile?.linkedinUrl ? applicantProfile.linkedinUrl.replace(/^https?:\/\//, '') : 'linkedin.com/in/candidate';
    const github = applicantProfile?.githubUrl ? applicantProfile.githubUrl.replace(/^https?:\/\//, '') : 'github.com/candidate';

    return `
      <div class="doc-header text-center pb-3 mb-4 border-b border-zinc-200 dark:border-zinc-800">
        <h1 class="doc-candidate-name font-headline font-bold text-2xl sm:text-3xl tracking-tight text-zinc-950 dark:text-white pb-1">${escapeHtml(profileName)}</h1>
        <p class="doc-contact-info text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">${escapeHtml(`${email} • ${phone} • ${location} • ${linkedin} • ${github}`)}</p>
      </div>
      <div class="doc-section mb-4">
        <h2 class="doc-section-header font-mono font-bold text-xs uppercase tracking-wider text-zinc-900 dark:text-zinc-100 border-b border-zinc-200 dark:border-zinc-800 pb-1 mt-4 mb-2">WORK EXPERIENCE</h2>
        <p class="doc-job-title font-bold text-xs text-zinc-900 dark:text-zinc-100 mt-2 mb-0.5">Company Name — Software Engineer</p>
        <p class="doc-job-meta text-xs text-zinc-500 dark:text-zinc-400 italic mb-1.5">San Francisco, CA | 2023 – Present</p>
        <ul class="doc-bullets list-disc pl-5 space-y-1 text-xs text-zinc-800 dark:text-zinc-200">
          <li>Architected high-throughput backend services handling 10,000+ daily requests with 99.9% availability using Go and Postgres</li>
          <li>Engineered automated CI/CD deployment pipelines reducing release deployment times from 4 hours to 15 minutes</li>
        </ul>
      </div>
      <div class="doc-section mb-4">
        <h2 class="doc-section-header font-mono font-bold text-xs uppercase tracking-wider text-zinc-900 dark:text-zinc-100 border-b border-zinc-200 dark:border-zinc-800 pb-1 mt-4 mb-2">TECHNICAL SKILLS</h2>
        <ul class="doc-bullets list-disc pl-5 space-y-1 text-xs text-zinc-800 dark:text-zinc-200">
          <li><strong>Languages:</strong> Go, TypeScript, Python, SQL, C++, Bash</li>
          <li><strong>Cloud & Infrastructure:</strong> Docker, Kubernetes, AWS, PostgreSQL, Redis, GitHub Actions</li>
        </ul>
      </div>
    `.trim();
  }

  const paragraphs = rawText.split(/\n\s*\n/);
  const htmlParts: string[] = [];

  paragraphs.forEach((para, pIdx) => {
    const lines = para.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return;

    // Header paragraph (Candidate Name + Contact Details)
    if (pIdx === 0) {
      const name = lines[0];
      const contact = lines.slice(1).join(' • ');
      htmlParts.push(`
        <div class="doc-header text-center pb-3 mb-4 border-b border-zinc-200 dark:border-zinc-800">
          <h1 class="doc-candidate-name font-headline font-bold text-2xl sm:text-3xl tracking-tight text-zinc-950 dark:text-white pb-1">${escapeHtml(name)}</h1>
          ${contact ? `<p class="doc-contact-info text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">${escapeHtml(contact)}</p>` : ''}
        </div>
      `.trim());
      return;
    }

    const firstLine = lines[0];
    const isSectionHeader = /^(summary|professional summary|work experience|experience|projects|featured projects|education|technical skills|skills|leadership|awards|certifications|extracurricular)/i.test(firstLine);

    if (isSectionHeader) {
      let sectionHtml = `
        <div class="doc-section mb-4">
          <h2 class="doc-section-header font-mono font-bold text-xs uppercase tracking-wider text-zinc-900 dark:text-zinc-100 border-b border-zinc-200 dark:border-zinc-800 pb-1 mt-4 mb-2">${escapeHtml(firstLine)}</h2>
      `.trim();

      const remainingLines = lines.slice(1);
      let currentBulletGroup: string[] = [];

      const flushBullets = () => {
        if (currentBulletGroup.length > 0) {
          sectionHtml += `<ul class="doc-bullets list-disc pl-5 space-y-1 my-1.5 text-xs text-zinc-800 dark:text-zinc-200">`;
          currentBulletGroup.forEach(b => {
            sectionHtml += `<li>${escapeHtml(b)}</li>`;
          });
          sectionHtml += `</ul>`;
          currentBulletGroup = [];
        }
      };

      remainingLines.forEach(line => {
        const isBullet = /^[•\-*]\s*/.test(line);
        if (isBullet) {
          const clean = line.replace(/^[•\-*]\s*/, '');
          currentBulletGroup.push(clean);
        } else {
          flushBullets();
          const isMeta = /(\d{4}|present|remote|full-time|part-time|[A-Z]{2}\s*\|)/i.test(line);
          if (isMeta) {
            sectionHtml += `<p class="doc-job-meta text-xs text-zinc-500 dark:text-zinc-400 italic mb-1.5">${escapeHtml(line)}</p>`;
          } else {
            sectionHtml += `<p class="doc-job-title font-bold text-xs text-zinc-900 dark:text-zinc-100 mt-2 mb-0.5">${escapeHtml(line)}</p>`;
          }
        }
      });

      flushBullets();
      sectionHtml += `</div>`;
      htmlParts.push(sectionHtml);
    } else {
      // General paragraph
      let paraHtml = `<div class="doc-block mb-3">`;
      let currentBulletGroup: string[] = [];

      const flushBullets = () => {
        if (currentBulletGroup.length > 0) {
          paraHtml += `<ul class="doc-bullets list-disc pl-5 space-y-1 my-1 text-xs text-zinc-800 dark:text-zinc-200">`;
          currentBulletGroup.forEach(b => {
            paraHtml += `<li>${escapeHtml(b)}</li>`;
          });
          paraHtml += `</ul>`;
          currentBulletGroup = [];
        }
      };

      lines.forEach(line => {
        const isBullet = /^[•\-*]\s*/.test(line);
        if (isBullet) {
          const clean = line.replace(/^[•\-*]\s*/, '');
          currentBulletGroup.push(clean);
        } else {
          flushBullets();
          paraHtml += `<p class="doc-text text-xs text-zinc-800 dark:text-zinc-200 my-1">${escapeHtml(line)}</p>`;
        }
      });

      flushBullets();
      paraHtml += `</div>`;
      htmlParts.push(paraHtml);
    }
  });

  return htmlParts.join('\n');
}

/**
 * Extracts clean, ATS-compliant plaintext from a live DOM contentEditable tree.
 * Preserves bullets with '• ' and ensures proper paragraph line breaks.
 */
export function extractTextFromDoc(root: HTMLElement): string {
  if (!root) return '';

  const clone = root.cloneNode(true) as HTMLElement;

  // Format list items so each has a bullet symbol
  const lis = clone.querySelectorAll('li');
  lis.forEach(li => {
    const text = (li.textContent || '').trim();
    if (!text.startsWith('•') && !text.startsWith('-') && !text.startsWith('*')) {
      li.textContent = `• ${text}`;
    }
  });

  // Ensure headings have linebreaks after them
  const headings = clone.querySelectorAll('h1, h2, h3');
  headings.forEach(h => {
    h.textContent = `${(h.textContent || '').trim()}\n`;
  });

  const raw = clone.innerText || clone.textContent || '';
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Headless fallback for extracting plain text from HTML strings (useful in tests).
 */
export function extractTextFromHtml(html: string): string {
  if (!html) return '';

  if (typeof document !== 'undefined') {
    const div = document.createElement('div');
    div.innerHTML = html;
    return extractTextFromDoc(div);
  }

  // Regex-based fallback for Node/Vitest environments without jsdom
  let text = html
    .replace(/<li[^>]*>/gi, '\n• ')
    .replace(/<\/li>/gi, '')
    .replace(/<h[1-6][^>]*>/gi, '\n\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<p[^>]*>/gi, '\n')
    .replace(/<\/p>/gi, '')
    .replace(/<div[^>]*>/gi, '\n')
    .replace(/<\/div>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '');

  text = unescapeHtml(text);

  return text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Generates section template HTML for instant injection into the canvas document.
 */
export function generateSectionHtml(type: 'EXPERIENCE' | 'PROJECTS' | 'SKILLS' | 'EDUCATION' | 'SUMMARY' | 'CUSTOM'): string {
  let title = 'ADDITIONAL EXPERIENCE';
  let inner = '';

  switch (type) {
    case 'EXPERIENCE':
      title = 'WORK EXPERIENCE';
      inner = `
        <p class="doc-job-title font-bold text-xs text-zinc-900 dark:text-zinc-100 mt-2 mb-0.5">Company Name — Senior Software Engineer</p>
        <p class="doc-job-meta text-xs text-zinc-500 dark:text-zinc-400 italic mb-1.5">San Francisco, CA | 2023 – Present</p>
        <ul class="doc-bullets list-disc pl-5 space-y-1 text-xs text-zinc-800 dark:text-zinc-200">
          <li>Architected distributed multi-region caching layer slashing P99 latency by 45ms across 35k QPS</li>
          <li>Engineered idempotent ledger replication pipeline with zero transactional inconsistencies</li>
        </ul>
      `;
      break;
    case 'PROJECTS':
      title = 'FEATURED PROJECTS';
      inner = `
        <p class="doc-job-title font-bold text-xs text-zinc-900 dark:text-zinc-100 mt-2 mb-0.5">Distributed Consensus Engine (Go, Raft, gRPC)</p>
        <p class="doc-job-meta text-xs text-zinc-500 dark:text-zinc-400 italic mb-1.5">Open Source | 2024</p>
        <ul class="doc-bullets list-disc pl-5 space-y-1 text-xs text-zinc-800 dark:text-zinc-200">
          <li>Authored leader-election consensus protocol achieving 14,000 write ops/sec under network partition</li>
          <li>Implemented zero-allocation byte buffer pool decreasing garbage collection pauses by 80%</li>
        </ul>
      `;
      break;
    case 'SKILLS':
      title = 'TECHNICAL SKILLS';
      inner = `
        <ul class="doc-bullets list-disc pl-5 space-y-1 text-xs text-zinc-800 dark:text-zinc-200">
          <li><strong>Languages:</strong> Go, Rust, Python, TypeScript, SQL, C++, Bash</li>
          <li><strong>Distributed Systems:</strong> Kubernetes, Docker, Kafka, Redis, gRPC, Envoy, PostgreSQL</li>
          <li><strong>Cloud & Tooling:</strong> AWS (EKS, S3, DynamoDB), Terraform, GitHub Actions, Linux eBPF</li>
        </ul>
      `;
      break;
    case 'EDUCATION':
      title = 'EDUCATION';
      inner = `
        <p class="doc-job-title font-bold text-xs text-zinc-900 dark:text-zinc-100 mt-2 mb-0.5">Stanford University — M.S. Computer Science</p>
        <p class="doc-job-meta text-xs text-zinc-500 dark:text-zinc-400 italic mb-1.5">Stanford, CA | 2020 – 2022</p>
        <ul class="doc-bullets list-disc pl-5 space-y-1 text-xs text-zinc-800 dark:text-zinc-200">
          <li>Concentration in Distributed Systems & Databases • GPA: 3.9 / 4.0</li>
        </ul>
      `;
      break;
    case 'SUMMARY':
      title = 'PROFESSIONAL SUMMARY';
      inner = `
        <p class="doc-text text-xs text-zinc-800 dark:text-zinc-200 leading-relaxed my-1">
          Staff Distributed Systems Engineer with 7+ years architecting high-throughput financial backends, distributed consensus algorithms, and cloud infrastructure processing billions of requests with 99.999% reliability.
        </p>
      `;
      break;
    default:
      title = 'ADDITIONAL SECTION';
      inner = `
        <p class="doc-job-title font-bold text-xs text-zinc-900 dark:text-zinc-100 mt-2 mb-0.5">Organization — Role</p>
        <p class="doc-job-meta text-xs text-zinc-500 dark:text-zinc-400 italic mb-1.5">Location | 2023 – Present</p>
        <ul class="doc-bullets list-disc pl-5 space-y-1 text-xs text-zinc-800 dark:text-zinc-200">
          <li>Directed cross-functional engineering initiatives delivering key business outcomes</li>
        </ul>
      `;
      break;
  }

  return `
    <div class="doc-section mb-4">
      <h2 class="doc-section-header font-mono font-bold text-xs uppercase tracking-wider text-zinc-900 dark:text-zinc-100 border-b border-zinc-200 dark:border-zinc-800 pb-1 mt-4 mb-2">${title}</h2>
      ${inner.trim()}
    </div>
  `.trim();
}
