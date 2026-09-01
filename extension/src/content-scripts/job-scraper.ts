// Universal Multi-Board Semantic Job Scraper Content Script (Zero intrusive badges)

interface ScrapedJobResult {
  title: string;
  company: string;
  description: string;
  location?: string;
  source: 'LinkedIn' | 'Greenhouse' | 'Lever' | 'Workday' | 'Indeed' | 'Handshake' | 'Ashby' | 'WorkAtAStartup' | 'ZipRecruiter' | 'Glassdoor' | 'CuratedFeed' | 'SimplifyJobs' | 'Custom';
  url: string;
  salary?: string;
  employmentType?: string;
  seniorityLevel?: string;
  extractedSkills?: string[];
  coreResponsibilities?: string[];
  requiredQualifications?: string[];
}

function extractJsonLdJobPosting(): Partial<ScrapedJobResult> | null {
  try {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const s of Array.from(scripts)) {
      try {
        const data = JSON.parse(s.textContent || '');
        const item = Array.isArray(data) ? data.find((d) => d['@type'] === 'JobPosting') : (data['@type'] === 'JobPosting' ? data : null);
        if (item) {
          const title = item.title || item.name || '';
          const company = item.hiringOrganization?.name || '';
          const rawDesc = item.description || '';
          // Strip HTML tags for clean text
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = rawDesc;
          const description = tempDiv.textContent?.trim() || rawDesc;

          let location = '';
          if (item.jobLocation?.address) {
            const addr = item.jobLocation.address;
            location = [addr.addressLocality, addr.addressRegion, addr.addressCountry].filter(Boolean).join(', ');
          }

          let salary = '';
          if (item.baseSalary?.value) {
            const val = item.baseSalary.value;
            const currency = item.baseSalary.currency || '$';
            salary = `${currency}${val.minValue || val.value || ''}${val.maxValue ? ' - ' + currency + val.maxValue : ''} / ${item.baseSalary.value?.unitText || 'yr'}`;
          }

          return {
            title,
            company,
            description,
            location: location || undefined,
            salary: salary || undefined,
            employmentType: item.employmentType || undefined,
          };
        }
      } catch {}
    }
  } catch {}
  return null;
}

function scrapeCurrentPage(): ScrapedJobResult | null {
  const url = window.location.href;
  let title = '';
  let company = '';
  let description = '';
  let location = '';
  let salary = '';
  let employmentType = '';
  let source: ScrapedJobResult['source'] = 'Custom';

  // 1. Try JSON-LD first (used by Google Jobs, Greenhouse, Lever, Ashby, Workday)
  const jsonLdData = extractJsonLdJobPosting();

  // 2. Specific Platform Selectors
  if (url.includes('linkedin.com')) {
    source = 'LinkedIn';
    title = document.querySelector(
      '.job-details-jobs-unified-top-card__job-title, .jobs-unified-top-card__job-title, .top-card-layout__title, .jobs-details__main-content h1'
    )?.textContent?.trim() || '';
    company = document.querySelector(
      '.job-details-jobs-unified-top-card__company-name, .jobs-unified-top-card__company-name, .topcard__flavor--black-link, .job-details-jobs-unified-top-card__primary-description a'
    )?.textContent?.trim() || '';
    location = document.querySelector(
      '.job-details-jobs-unified-top-card__bullet, .topcard__flavor--bullet, .jobs-unified-top-card__bullet'
    )?.textContent?.trim() || '';
    description = document.querySelector(
      '#job-details, .jobs-description__content, .show-more-less-html__markup, .jobs-box__htmlContent'
    )?.textContent?.trim() || '';
  } else if (url.includes('greenhouse.io') || url.includes('job-boards.greenhouse.io')) {
    source = 'Greenhouse';
    title = document.querySelector('.app-title, h1.heading, .job-title')?.textContent?.trim() || '';
    company = document.querySelector('.company-name, .logo-container img')?.getAttribute('alt') || document.querySelector('.company-name')?.textContent?.trim() || '';
    location = document.querySelector('.location, .job-location')?.textContent?.trim() || '';
    description = document.querySelector('#content, #main, .body, [id*="content"]')?.textContent?.trim() || '';
  } else if (url.includes('lever.co')) {
    source = 'Lever';
    title = document.querySelector('.posting-headline h2, h2.posting-headline')?.textContent?.trim() || '';
    company = document.querySelector('.main-header-logo img')?.getAttribute('alt') || document.querySelector('.main-header a')?.textContent?.trim() || '';
    location = document.querySelector('.sort-by-time.posting-category, .posting-categories .location')?.textContent?.trim() || '';
    description = document.querySelector('.posting-description, [data-qa="job-description"], .section-wrapper')?.textContent?.trim() || '';
  } else if (url.includes('myworkdayjobs.com') || url.includes('myworkday.com')) {
    source = 'Workday';
    title = document.querySelector('[data-automation-id="jobPostingHeader"], h2[data-automation-id="jobTitle"]')?.textContent?.trim() || '';
    company = document.querySelector('[data-automation-id="companyName"], header a img')?.getAttribute('alt') || '';
    location = document.querySelector('[data-automation-id="locations"]')?.textContent?.trim() || '';
    description = document.querySelector('[data-automation-id="jobPostingDescription"], .job-description')?.textContent?.trim() || '';
  } else if (url.includes('indeed.com')) {
    source = 'Indeed';
    title = document.querySelector('.jobsearch-JobInfoHeader-title, h1[data-testid="jobsearch-JobInfoHeader-title"]')?.textContent?.trim() || '';
    company = document.querySelector('[data-testid="inlineHeader-companyName"], .jobsearch-CompanyInfoContainer a')?.textContent?.trim() || '';
    location = document.querySelector('[data-testid="inlineHeader-companyLocation"], .jobsearch-JobInfoHeader-companyLocation')?.textContent?.trim() || '';
    description = document.querySelector('#jobDescriptionText, .jobsearch-jobDescriptionText')?.textContent?.trim() || '';
  } else if (url.includes('ashbyhq.com')) {
    source = 'Ashby';
    title = document.querySelector('h1, [class*="JobPosting_heading"], [class*="heading"]')?.textContent?.trim() || '';
    company = document.querySelector('[class*="JobPosting_company"], [class*="companyName"]')?.textContent?.trim() || '';
    location = document.querySelector('[class*="JobPosting_location"], [class*="location"]')?.textContent?.trim() || '';
    description = document.querySelector('[class*="JobPosting_body"], [class*="description"], [class*="jobDetails"]')?.textContent?.trim() || '';
  } else if (url.includes('workatastartup.com') || url.includes('ycombinator.com')) {
    source = 'WorkAtAStartup';
    title = document.querySelector('.job-title, h1.text-xl, h2.font-bold')?.textContent?.trim() || '';
    company = document.querySelector('.company-name, .font-semibold.text-lg')?.textContent?.trim() || '';
    description = document.querySelector('.job-description, .prose, .text-gray-700')?.textContent?.trim() || '';
  } else if (url.includes('joinhandshake.com')) {
    source = 'Handshake';
    title = document.querySelector('[data-hook="job-title"], h1')?.textContent?.trim() || '';
    company = document.querySelector('[data-hook="employer-name"], .employer-name')?.textContent?.trim() || '';
    description = document.querySelector('.job-description, [data-hook="job-description"]')?.textContent?.trim() || '';
  } else if (url.includes('ziprecruiter.com')) {
    source = 'ZipRecruiter';
    title = document.querySelector('.job_title, h1')?.textContent?.trim() || '';
    company = document.querySelector('.hiring_company_text, .company_name')?.textContent?.trim() || '';
    description = document.querySelector('.jobDescriptionSection, .job_description')?.textContent?.trim() || '';
  } else if (url.includes('glassdoor.com')) {
    source = 'Glassdoor';
    title = document.querySelector('[data-test="job-title"], h1')?.textContent?.trim() || '';
    company = document.querySelector('[data-test="employer-name"]')?.textContent?.trim() || '';
    description = document.querySelector('.jobDescriptionContent, #JobDescriptionContainer')?.textContent?.trim() || '';
  }

  // 3. Fallbacks: JSON-LD merge or Heuristic DOM
  if (jsonLdData) {
    if (!title && jsonLdData.title) title = jsonLdData.title;
    if (!company && jsonLdData.company) company = jsonLdData.company;
    if (!description && jsonLdData.description) description = jsonLdData.description;
    if (!location && jsonLdData.location) location = jsonLdData.location;
    if (!salary && jsonLdData.salary) salary = jsonLdData.salary;
    if (!employmentType && jsonLdData.employmentType) employmentType = jsonLdData.employmentType;
  }

  if (!title) {
    const h1 = document.querySelector('h1');
    title = h1?.textContent?.trim() || document.title.split(/[-–|]/)[0]?.trim() || 'Job Opening';
  }
  if (!company) {
    const titleParts = document.title.split(/[-–|]/);
    if (titleParts.length > 1) {
      company = titleParts[1].trim();
    } else {
      company = 'Hiring Company';
    }
  }
  if (!description) {
    const article = document.querySelector('article, main, #content, [role="main"]');
    description = (article ? article.textContent : document.body.innerText).slice(0, 8000).trim();
  }

  if (description.length < 40) return null;

  // 4. Semantic Extraction: Seniority Level & Core Skills
  const normDesc = description.toLowerCase();
  let seniorityLevel = 'Mid-Level';
  if (/intern|internship|co-op/i.test(title) || /intern|internship/i.test(normDesc.slice(0, 300))) {
    seniorityLevel = 'Internship';
  } else if (/new grad|entry level|associate|junior/i.test(title) || /0-2 years|new grad/i.test(normDesc)) {
    seniorityLevel = 'Entry / New Grad';
  } else if (/senior|sr\.|lead|principal|staff|architect/i.test(title)) {
    seniorityLevel = 'Senior+';
  }

  // Extract core tech keywords from JD
  const popularKeywords = [
    'Python', 'TypeScript', 'JavaScript', 'Java', 'C++', 'Go', 'Golang', 'Rust', 'SQL',
    'React', 'Next.js', 'Vue', 'Angular', 'Node.js', 'Express', 'Django', 'FastAPI',
    'PostgreSQL', 'MongoDB', 'Redis', 'Kafka', 'AWS', 'GCP', 'Azure', 'Docker',
    'Kubernetes', 'CI/CD', 'GraphQL', 'REST API', 'Microservices', 'PyTorch', 'TensorFlow',
    'Machine Learning', 'LLM', 'System Design', 'Git'
  ];
  const extractedSkills: string[] = [];
  for (const kw of popularKeywords) {
    if (new RegExp(`\\b${kw.replace('+', '\\+')}\\b`, 'i').test(description)) {
      extractedSkills.push(kw);
    }
  }

  return {
    title: title || 'Target Job Opening',
    company: company || 'Hiring Company',
    description,
    location: location || undefined,
    salary: salary || undefined,
    employmentType: employmentType || undefined,
    seniorityLevel,
    extractedSkills: extractedSkills.slice(0, 12),
    source,
    url
  };
}

// Respond on-demand when requested by sidepanel
if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
  try {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.type === 'SCRAPE_JOB_NOW') {
        const data = scrapeCurrentPage();
        sendResponse({ success: true, data });
      }
      return true;
    });
  } catch { /* context invalidated */ }
}

