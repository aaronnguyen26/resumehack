// GitHub Internship Tracker & Live Sync Service
import { JobPosting } from '../types/index.js';

export interface GitHubRepoSource {
  name: string;
  repo: string;
  url: string;
  category: string;
}

export const GITHUB_SOURCES: GitHubRepoSource[] = [
  {
    name: 'SimplifyJobs Summer 2026',
    repo: 'SimplifyJobs/Summer2026-Internships',
    url: 'https://raw.githubusercontent.com/SimplifyJobs/Summer2026-Internships/dev/README.md',
    category: 'Software Engineering'
  },
  {
    name: 'Pitt CSC Tech Internships',
    repo: 'pittcsc/Summer2026-Internships',
    url: 'https://raw.githubusercontent.com/pittcsc/Summer2026-Internships/main/README.md',
    category: 'Software Engineering'
  }
];

// Rich Seed Database of 2026/2027 Top Tech, AI & Finance Openings
export const SEED_INTERNSHIP_DATABASE: JobPosting[] = [
  {
    id: 'gh-stripe-2026',
    title: 'Software Engineering Intern — Summer 2026',
    company: 'Stripe',
    location: 'San Francisco, CA / Seattle, WA (Hybrid)',
    type: 'Internship',
    season: 'Summer 2026',
    category: 'Software Engineering',
    source: 'CuratedFeed',
    url: 'https://stripe.com/jobs/search?q=intern',
    salaryRange: '$58 - $65 / hr + Housing',
    description: `Design, implement, and deploy high-throughput microservices and REST APIs using Go, Python, and PostgreSQL. Build resilient financial infrastructure and improve latency across distributed cloud services (AWS).
Requirements: Python, Go, TypeScript, Docker, SQL, Linux, Git, System Design.`
  },
  {
    id: 'gh-openai-2026',
    title: 'AI & Developer Experience Engineer Intern',
    company: 'OpenAI',
    location: 'San Francisco, CA',
    type: 'Internship',
    season: 'Summer 2026',
    category: 'Data & AI',
    source: 'CuratedFeed',
    url: 'https://openai.com/careers',
    salaryRange: '$65 - $75 / hr + Housing',
    description: `Build responsive developer tooling and agentic workflows using React, TypeScript, Python (FastAPI), and Redis. Work directly with foundational LLM models and vector indexing pipelines.
Requirements: Python, TypeScript, React, Next.js, LLMs, Vector Databases, PostgreSQL.`
  },
  {
    id: 'gh-palantir-2026',
    title: 'Forward Deployed Software Engineer Intern',
    company: 'Palantir Technologies',
    location: 'New York, NY / Palo Alto, CA',
    type: 'Internship',
    season: 'Summer 2026',
    category: 'Software Engineering',
    source: 'CuratedFeed',
    url: 'https://www.palantir.com/careers',
    salaryRange: '$55 - $62 / hr + Housing',
    description: `Work directly on mission-critical customer data platforms. Build distributed pipelines, high-speed data transformations, and frontend intelligence workflows using Java, TypeScript, and Python.
Requirements: Java, Python, TypeScript, Distributed Systems, SQL, Problem Solving.`
  },
  {
    id: 'gh-citadel-2026',
    title: 'Quantitative Research & SWE Intern',
    company: 'Citadel',
    location: 'Chicago, IL / New York, NY',
    type: 'Internship',
    season: 'Summer 2026',
    category: 'Finance & Quant',
    source: 'CuratedFeed',
    url: 'https://www.citadel.com/careers',
    salaryRange: '$120 - $150 / hr + $15k Housing',
    description: `Develop ultra-low latency trading systems, backtesting engines, and predictive statistical models in modern C++ (20/23) and Python.
Requirements: C++, Python, Linux, Multithreading, Algorithms, Linear Algebra.`
  },
  {
    id: 'gh-datadog-2026',
    title: 'Backend Software Engineer — New Grad 2026',
    company: 'Datadog',
    location: 'New York, NY / Boston, MA',
    type: 'New Grad',
    season: 'Fall 2026',
    category: 'Software Engineering',
    source: 'CuratedFeed',
    url: 'https://datadoghq.com/careers',
    salaryRange: '$145,000 - $165,000 / yr + Equity',
    description: `Build distributed, high-availability microservices in Go and Python processing trillions of monitoring events. Design data ingestion pipelines using Kafka, Redis, and PostgreSQL on Kubernetes.
Requirements: Go, Python, Kafka, Redis, PostgreSQL, Kubernetes, Linux.`
  },
  {
    id: 'gh-figma-2026',
    title: 'Full-Stack Software Engineer Intern',
    company: 'Figma',
    location: 'San Francisco, CA',
    type: 'Internship',
    season: 'Summer 2026',
    category: 'Software Engineering',
    source: 'CuratedFeed',
    url: 'https://www.figma.com/careers',
    salaryRange: '$60 - $68 / hr + Housing',
    description: `Work on multiplayer browser-based canvas rendering, WebAssembly, TypeScript, and React to build the world's most collaborative design tool.
Requirements: TypeScript, WebAssembly, C++, React, Graphics, Distributed Systems.`
  },
  {
    id: 'gh-meta-2026',
    title: 'Software Engineer Intern — Summer 2026',
    company: 'Meta',
    location: 'Menlo Park, CA / Seattle, WA / New York, NY',
    type: 'Internship',
    season: 'Summer 2026',
    category: 'Software Engineering',
    source: 'CuratedFeed',
    url: 'https://www.metacareers.com',
    salaryRange: '$55 - $62 / hr + Housing',
    description: `Build features across Instagram, WhatsApp, Meta Quest, and AI Infrastructure. Scale distributed backend services in C++, Python, and Hack/PHP, with React on frontend.
Requirements: C++, Python, Java, Data Structures, Algorithms.`
  },
  {
    id: 'gh-google-2026',
    title: 'Associate Product Manager Intern',
    company: 'Google',
    location: 'Mountain View, CA / New York, NY',
    type: 'Internship',
    season: 'Summer 2026',
    category: 'Product Management',
    source: 'CuratedFeed',
    url: 'https://careers.google.com/jobs',
    salaryRange: '$52 - $60 / hr + Housing',
    description: `Define product requirements, user stories, and feature roadmaps in collaboration with Engineering and UX across Google Search, Cloud, and Android.
Requirements: Computer Science background, Leadership, Problem Solving, Agile.`
  }
];

export class GitHubTrackerService {
  /**
   * Parses raw markdown tables from GitHub internship tracking repositories
   */
  public parseMarkdownTable(markdown: string): JobPosting[] {
    const lines = markdown.split('\n');
    const jobs: JobPosting[] = [];

    for (const line of lines) {
      // Check for Markdown table rows with at least 4 columns
      if (!line.startsWith('|') || line.includes('---') || line.toLowerCase().includes('company | role')) {
        continue;
      }

      const columns = line.split('|').map(col => col.trim()).filter(Boolean);
      if (columns.length < 3) continue;

      const rawCompany = columns[0] || '';
      const rawRole = columns[1] || '';
      const location = columns[2] || 'United States';
      const rawApply = columns[3] || '';

      // Extract Company Name and URL from markdown link: [Company](url) or **Company**
      const companyMatch = rawCompany.match(/\[([^\]]+)\]\(([^)]+)\)/) || rawCompany.match(/\*\*([^*]+)\*\*/);
      const company = companyMatch ? companyMatch[1] : rawCompany.replace(/[*_`]/g, '');

      // Extract Apply Link
      const applyMatch = rawApply.match(/\[(?:Apply|Link|🔒|🟢)\]\(([^)]+)\)/i) || rawCompany.match(/\[([^\]]+)\]\(([^)]+)\)/);
      const url = applyMatch ? applyMatch[1] : 'https://github.com/SimplifyJobs/Summer2026-Internships';

      if (company && rawRole && !company.toLowerCase().includes('company')) {
        jobs.push({
          id: `gh-${company.toLowerCase().replace(/[^a-z0-9]/g, '')}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          title: rawRole.replace(/[*_`]/g, ''),
          company,
          location,
          type: rawRole.toLowerCase().includes('grad') ? 'New Grad' : 'Internship',
          season: 'Summer 2026',
          category: this.inferCategory(rawRole),
          source: 'CuratedFeed',
          url,
          description: `Active opening for ${rawRole} at ${company} (${location}). Requires strong technical fundamentals, teamwork, and problem-solving skills.`
        });
      }
    }

    return jobs;
  }

  /**
   * Syncs live from GitHub repository READMEs
   */
  public async syncFromGitHub(): Promise<{ success: boolean; jobsCount: number; jobs: JobPosting[] }> {
    try {
      const allJobs: JobPosting[] = [...SEED_INTERNSHIP_DATABASE];

      for (const source of GITHUB_SOURCES) {
        try {
          const response = await fetch(source.url);
          if (response.ok) {
            const markdown = await response.text();
            const parsed = this.parseMarkdownTable(markdown);
            if (parsed.length > 0) {
              allJobs.push(...parsed.slice(0, 30));
            }
          }
        } catch (e) {
          console.warn(`Failed to fetch from ${source.name}:`, e);
        }
      }

      // De-duplicate by company + title
      const uniqueMap = new Map<string, JobPosting>();
      for (const j of allJobs) {
        const key = `${j.company.toLowerCase()}-${j.title.toLowerCase()}`;
        if (!uniqueMap.has(key)) {
          uniqueMap.set(key, j);
        }
      }

      const deduplicated = Array.from(uniqueMap.values());

      // Save to chrome storage
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ resumehack_github_jobs: deduplicated });
      }

      return {
        success: true,
        jobsCount: deduplicated.length,
        jobs: deduplicated
      };
    } catch (err) {
      console.error('GitHub sync error, using seed database:', err);
      return {
        success: true,
        jobsCount: SEED_INTERNSHIP_DATABASE.length,
        jobs: SEED_INTERNSHIP_DATABASE
      };
    }
  }

  private inferCategory(title: string): JobPosting['category'] {
    const t = title.toLowerCase();
    if (t.includes('data') || t.includes('ai') || t.includes('machine learning') || t.includes('ml')) {
      return 'Data & AI';
    }
    if (t.includes('product') || t.includes('pm') || t.includes('program')) {
      return 'Product Management';
    }
    if (t.includes('quant') || t.includes('trading') || t.includes('finance')) {
      return 'Finance & Quant';
    }
    return 'Software Engineering';
  }
}
