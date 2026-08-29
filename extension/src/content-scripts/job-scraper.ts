// Job Scraper Content Script

function scrapeCurrentPage(): { title: string; company: string; description: string; location?: string; source: any; url: string } | null {
  const url = window.location.href;
  let title = '';
  let company = '';
  let description = '';
  let location = '';
  let source = 'Custom';

  if (url.includes('linkedin.com')) {
    source = 'LinkedIn';
    title = document.querySelector('.job-details-jobs-unified-top-card__job-title, .jobs-unified-top-card__job-title, .top-card-layout__title')?.textContent?.trim() || '';
    company = document.querySelector('.job-details-jobs-unified-top-card__company-name, .jobs-unified-top-card__company-name, .topcard__flavor--black-link')?.textContent?.trim() || '';
    description = document.querySelector('#job-details, .jobs-description__content, .show-more-less-html__markup')?.textContent?.trim() || '';
  } else if (url.includes('greenhouse.io')) {
    source = 'Greenhouse';
    title = document.querySelector('.app-title, h1.heading')?.textContent?.trim() || '';
    company = document.querySelector('.company-name')?.textContent?.trim() || 'Greenhouse Company';
    description = document.querySelector('#content, #main')?.textContent?.trim() || '';
  } else if (url.includes('lever.co')) {
    source = 'Lever';
    title = document.querySelector('.posting-headline h2')?.textContent?.trim() || '';
    company = document.querySelector('.main-header-logo img')?.getAttribute('alt') || 'Lever Company';
    description = document.querySelector('.posting-description, [data-qa="job-description"]')?.textContent?.trim() || '';
  } else if (url.includes('myworkdayjobs.com')) {
    source = 'Workday';
    title = document.querySelector('[data-automation-id="jobPostingHeader"]')?.textContent?.trim() || '';
    company = document.querySelector('[data-automation-id="companyName"]')?.textContent?.trim() || 'Workday Company';
    description = document.querySelector('[data-automation-id="jobPostingDescription"]')?.textContent?.trim() || '';
  } else if (url.includes('indeed.com')) {
    source = 'Indeed';
    title = document.querySelector('.jobsearch-JobInfoHeader-title')?.textContent?.trim() || '';
    company = document.querySelector('[data-testid="inlineHeader-companyName"]')?.textContent?.trim() || '';
    description = document.querySelector('#jobDescriptionText')?.textContent?.trim() || '';
  }

  // Fallback if generic page
  if (!title) {
    title = document.querySelector('h1')?.textContent?.trim() || document.title;
  }
  if (!description) {
    description = document.body.innerText.slice(0, 3000);
  }

  if (description.length < 50) return null;

  return {
    title: title || 'Job Title',
    company: company || 'Company Name',
    description,
    location,
    source,
    url
  };
}

function injectFloatingPill(jobData: any) {
  if (document.getElementById('resumehack-floating-pill')) return;

  const pill = document.createElement('div');
  pill.id = 'resumehack-floating-pill';
  pill.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 999999;
    background: #4F46E5;
    color: #FFFFFF;
    padding: 12px 18px;
    border-radius: 9999px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 14px;
    font-weight: 600;
    box-shadow: 0 10px 25px -5px rgba(79, 70, 229, 0.4), 0 8px 10px -6px rgba(79, 70, 229, 0.2);
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: all 0.2s ease;
  `;

  pill.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="m13 2-2 2.5h3L11 9l7-3-2 3.5h3L12 22l2-6.5h-3L14 11l-7 3 2-3.5H6z"/>
    </svg>
    <span>Tailor Resume for ${jobData.company || 'Role'}</span>
  `;

  pill.addEventListener('mouseenter', () => {
    pill.style.transform = 'translateY(-2px) scale(1.03)';
  });
  pill.addEventListener('mouseleave', () => {
    pill.style.transform = 'translateY(0) scale(1)';
  });

  pill.addEventListener('click', () => {
    // Send scraped job data to background
    chrome.runtime.sendMessage({
      type: 'JOB_SCRAPED',
      data: jobData
    });
    chrome.runtime.sendMessage({ type: 'OPEN_SIDEPANEL' });
  });

  document.body.appendChild(pill);
}

// Execute detection
setTimeout(() => {
  const scraped = scrapeCurrentPage();
  if (scraped) {
    chrome.runtime.sendMessage({
      type: 'JOB_SCRAPED',
      data: scraped
    });
    injectFloatingPill(scraped);
  }
}, 1500);
