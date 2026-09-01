import { describe, it, expect } from 'vitest';
import { 
  parseHtmlTable, 
  enrichJobDetails, 
  SEED_INTERNSHIP_DATABASE,
  GitHubRepoSource 
} from '../services/github-tracker.js';
import { CURATED_JOB_LISTINGS } from '../data/curated-jobs.js';

describe('Job Details Enrichment & Live Discovery Engine', () => {
  const mockSource: GitHubRepoSource = {
    name: 'SimplifyJobs Summer 2027',
    repo: 'SimplifyJobs/Summer2027-Internships',
    url: 'https://raw.githubusercontent.com/SimplifyJobs/Summer2027-Internships/dev/README.md',
    category: 'Software Engineering',
    season: 'Summer 2027'
  };

  describe('SEED_INTERNSHIP_DATABASE & CURATED_JOB_LISTINGS Completeness', () => {
    it('all curated jobs have rich, exhaustive role specifications', () => {
      expect(CURATED_JOB_LISTINGS.length).toBeGreaterThan(0);
      for (const job of CURATED_JOB_LISTINGS) {
        expect(job.title).toBeTruthy();
        expect(job.company).toBeTruthy();
        expect(job.location).toBeTruthy();
        expect(job.salaryRange).toBeTruthy();
        expect(job.aboutTeam).toBeTruthy();
        expect(job.responsibilities).toBeDefined();
        expect(job.responsibilities!.length).toBeGreaterThanOrEqual(3);
        expect(job.requirements).toBeDefined();
        expect(job.requirements!.length).toBeGreaterThanOrEqual(3);
        expect(job.skills).toBeDefined();
        expect(job.skills!.length).toBeGreaterThanOrEqual(5);
        expect(job.benefits).toBeDefined();
        expect(job.benefits!.length).toBeGreaterThanOrEqual(3);
        expect(job.interviewProcess).toBeDefined();
        expect(job.interviewProcess!.length).toBeGreaterThanOrEqual(3);
        expect(job.prepTips).toBeDefined();
        expect(job.prepTips!.length).toBeGreaterThanOrEqual(1);
        expect(job.educationRequirements).toBeTruthy();
        expect(job.sponsorship).toBeTruthy();
      }
    });

    it('all seed internship database jobs have rich role specifications', () => {
      expect(SEED_INTERNSHIP_DATABASE.length).toBeGreaterThan(0);
      for (const job of SEED_INTERNSHIP_DATABASE) {
        expect(job.title).toBeTruthy();
        expect(job.company).toBeTruthy();
        expect(job.location).toBeTruthy();
        expect(job.salaryRange).toBeTruthy();
        expect(job.responsibilities).toBeDefined();
        expect(job.responsibilities!.length).toBeGreaterThanOrEqual(3);
        expect(job.requirements).toBeDefined();
        expect(job.requirements!.length).toBeGreaterThanOrEqual(3);
        expect(job.skills).toBeDefined();
        expect(job.skills!.length).toBeGreaterThanOrEqual(5);
        expect(job.interviewProcess).toBeDefined();
        expect(job.interviewProcess!.length).toBeGreaterThanOrEqual(2);
      }
    });
  });

  describe('enrichJobDetails() intelligent role synthesizer', () => {
    it('enriches a minimal raw job with comprehensive Data & AI specifications', () => {
      const raw = {
        title: 'Machine Learning Engineer Intern',
        company: 'Anthropic',
        location: 'San Francisco, CA (Hybrid)',
        url: 'https://anthropic.com/careers',
        daysAgo: 0
      };

      const enriched = enrichJobDetails(raw, mockSource);

      expect(enriched.category).toBe('Data & AI');
      expect(enriched.workModel).toBe('Hybrid');
      expect(enriched.salaryRange).toContain('$');
      expect(enriched.aboutTeam).toContain('Applied AI');
      expect(enriched.responsibilities).toBeDefined();
      expect(enriched.responsibilities!.some(r => r.includes('inference') || r.includes('learning'))).toBe(true);
      expect(enriched.skills).toContain('Python');
      expect(enriched.skills).toContain('PyTorch');
      expect(enriched.interviewProcess).toBeDefined();
      expect(enriched.interviewProcess!.length).toBeGreaterThanOrEqual(3);
      expect(enriched.prepTips).toBeDefined();
    });

    it('enriches a Quant Finance raw job with low-latency and math specifications', () => {
      const raw = {
        title: 'Quantitative Trader & Systems Intern',
        company: 'Jane Street',
        location: 'New York, NY (On-site)',
        daysAgo: 1
      };

      const enriched = enrichJobDetails(raw, { ...mockSource, category: 'Finance & Quant' });

      expect(enriched.category).toBe('Finance & Quant');
      expect(enriched.workModel).toBe('On-site');
      expect(enriched.skills).toContain('C++');
      expect(enriched.responsibilities!.some(r => r.includes('latency') || r.includes('trading'))).toBe(true);
      expect(enriched.interviewProcess!.some(p => p.includes('Coding') || p.includes('Quantitative') || p.includes('OS'))).toBe(true);
    });

    it('enriches a Business & Strategy raw job with consulting and case study specifications', () => {
      const raw = {
        title: 'Management Consulting & Strategy Analyst Intern',
        company: 'Bain & Company',
        location: 'Boston, MA (Hybrid)',
        url: 'https://bain.com/careers',
        daysAgo: 0
      };

      const enriched = enrichJobDetails(raw, { ...mockSource, category: 'Business & Strategy' });

      expect(enriched.category).toBe('Business & Strategy');
      expect(enriched.workModel).toBe('Hybrid');
      expect(enriched.salaryRange).toContain('$');
      expect(enriched.skills).toContain('Management Consulting');
      expect(enriched.responsibilities!.some(r => r.includes('hypothesis') || r.includes('market sizing') || r.includes('business'))).toBe(true);
      expect(enriched.interviewProcess!.some(p => p.includes('Case') || p.includes('Problem Solving'))).toBe(true);
    });

    it('enriches a Humanities & Social Sciences raw job with qualitative research and editorial specifications', () => {
      const raw = {
        title: 'Editorial & Publishing Fellow',
        company: 'Penguin Random House',
        location: 'New York, NY',
        url: 'https://penguinrandomhouse.com/careers',
        daysAgo: 2
      };

      const enriched = enrichJobDetails(raw);

      expect(enriched.category).toBe('Humanities & Social Sciences');
      expect(enriched.skills).toContain('Qualitative Research');
      expect(enriched.responsibilities!.some(r => r.includes('research') || r.includes('editorial') || r.includes('manuscripts'))).toBe(true);
      expect(enriched.educationRequirements).toContain('Humanities');
    });

    it('enriches a Policy & Non-Profit raw job with legislative tracking and policy memo specifications', () => {
      const raw = {
        title: 'Public Policy Research Analyst Intern',
        company: 'Brookings Institution',
        location: 'Washington, DC (Hybrid)',
        url: 'https://brookings.edu/careers',
        daysAgo: 1
      };

      const enriched = enrichJobDetails(raw);

      expect(enriched.category).toBe('Policy & Non-Profit');
      expect(enriched.skills).toContain('Public Policy Analysis');
      expect(enriched.responsibilities!.some(r => r.includes('legislation') || r.includes('policy'))).toBe(true);
    });

    it('enriches a Marketing & Communications raw job with brand and campaign specifications', () => {
      const raw = {
        title: 'Brand Marketing & PR Intern',
        company: 'Nike',
        location: 'Beaverton, OR (On-site)',
        url: 'https://jobs.nike.com',
        daysAgo: 0
      };

      const enriched = enrichJobDetails(raw);

      expect(enriched.category).toBe('Marketing & Communications');
      expect(enriched.workModel).toBe('On-site');
      expect(enriched.skills).toContain('Brand Strategy');
      expect(enriched.responsibilities!.some(r => r.includes('campaign') || r.includes('narratives'))).toBe(true);
    });

    it('enriches a Legal & Compliance raw job with due diligence and regulatory specifications', () => {
      const raw = {
        title: 'Corporate Paralegal Intern',
        company: 'Latham & Watkins',
        location: 'New York, NY (Hybrid)',
        url: 'https://lw.com/careers',
        daysAgo: 1
      };

      const enriched = enrichJobDetails(raw);

      expect(enriched.category).toBe('Legal & Compliance');
      expect(enriched.skills).toContain('Legal Research');
      expect(enriched.responsibilities!.some(r => r.includes('due diligence') || r.includes('governance'))).toBe(true);
    });

    it('correctly classifies work model from location strings', () => {
      const remoteJob = enrichJobDetails({ title: 'SWE Intern', company: 'Automattic', location: 'Remote (US/Canada)' });
      expect(remoteJob.workModel).toBe('Remote');

      const onsiteJob = enrichJobDetails({ title: 'SWE Intern', company: 'Palantir', location: 'New York, NY (On-site)' });
      expect(onsiteJob.workModel).toBe('On-site');

      const hybridJob = enrichJobDetails({ title: 'SWE Intern', company: 'Amazon', location: 'Seattle, WA' });
      expect(hybridJob.workModel).toBe('Hybrid');
    });
  });

  describe('parseHtmlTable() HTML <table> parser with role enrichment', () => {
    it('parses HTML rows and enriches all jobs with deep role details', () => {
      const html = `
        <table>
          <tr>
            <td><strong><a href="https://uber.com">Uber</a></strong></td>
            <td>Software Engineer Intern - Backend & Infrastructure</td>
            <td>San Francisco, CA</td>
            <td><div><a href="https://uber.com/apply/123"><img src="apply.png" alt="Apply"></a></div></td>
            <td>0d</td>
          </tr>
          <tr>
            <td><strong><a href="https://two-sigma.com">Two Sigma</a></strong></td>
            <td>Quantitative Research Intern - Alpha Modeling</td>
            <td>New York, NY (On-site)</td>
            <td><div><a href="https://twosigma.com/apply/456"><img src="apply.png" alt="Apply"></a></div></td>
            <td>1d</td>
          </tr>
        </table>
      `;

      const parsed = parseHtmlTable(html, mockSource);

      expect(parsed.length).toBe(2);

      // Uber Job
      const uber = parsed[0];
      expect(uber.company).toBe('Uber');
      expect(uber.title).toBe('Software Engineer Intern - Backend & Infrastructure');
      expect(uber.category).toBe('Software Engineering');
      expect(uber.responsibilities).toBeDefined();
      expect(uber.responsibilities!.length).toBeGreaterThan(0);
      expect(uber.skills).toBeDefined();
      expect(uber.skills!.length).toBeGreaterThan(0);
      expect(uber.interviewProcess).toBeDefined();

      // Two Sigma Job
      const twoSigma = parsed[1];
      expect(twoSigma.company).toBe('Two Sigma');
      expect(twoSigma.category).toBe('Finance & Quant');
      expect(twoSigma.workModel).toBe('On-site');
      expect(twoSigma.skills).toContain('C++');
      expect(twoSigma.salaryRange).toContain('$');
    });

    it('handles sub-location rows (↳) and inherits parent company info', () => {
      const html = `
        <table>
          <tr>
            <td><strong><a href="https://snowflake.com">Snowflake</a></strong></td>
            <td>Core Database Software Engineer Intern</td>
            <td>San Mateo, CA</td>
            <td><div><a href="https://snowflake.com/job/1"><img src="apply.png"></a></div></td>
            <td>0d</td>
          </tr>
          <tr>
            <td>↳</td>
            <td>Core Database Software Engineer Intern</td>
            <td>Bellevue, WA</td>
            <td><div><a href="https://snowflake.com/job/2"><img src="apply.png"></a></div></td>
            <td>0d</td>
          </tr>
        </table>
      `;

      const parsed = parseHtmlTable(html, mockSource);
      expect(parsed.length).toBe(2);
      expect(parsed[0].company).toBe('Snowflake');
      expect(parsed[1].company).toBe('Snowflake');
      expect(parsed[1].location).toBe('Bellevue, WA');
      expect(parsed[1].responsibilities).toBeDefined();
    });
  });
});
