import { ApplicationRecord } from '../types/index.js';

const DEFAULT_APPLICATIONS: ApplicationRecord[] = [
  {
    id: 'app-1',
    jobId: 'job-1',
    company: 'Stripe',
    title: 'Software Engineering Intern',
    location: 'San Francisco, CA',
    status: 'Tailored',
    jobUrl: 'https://stripe.com/jobs/search?q=intern',
    masterDocId: 'mock-master-doc',
    tailoredDocId: 'tailored-stripe-1',
    tailoredDocUrl: 'https://docs.google.com/document/d/tailored-stripe-1/edit',
    pdfExportUrl: 'https://docs.google.com/document/d/tailored-stripe-1/export?format=pdf',
    atsScoreAtApplication: 92,
    salary: '$58 - $65 / hr',
    updatedAt: new Date().toISOString()
  },
  {
    id: 'app-2',
    jobId: 'job-2',
    company: 'OpenAI',
    title: 'AI / Full-Stack Engineer Intern',
    location: 'San Francisco, CA',
    status: 'Applied',
    appliedDate: '2026-08-20',
    jobUrl: 'https://openai.com/careers',
    masterDocId: 'mock-master-doc',
    tailoredDocId: 'tailored-openai-1',
    tailoredDocUrl: 'https://docs.google.com/document/d/tailored-openai-1/edit',
    atsScoreAtApplication: 95,
    salary: '$65 - $75 / hr',
    updatedAt: new Date().toISOString()
  }
];

export async function getStoredApplications(): Promise<ApplicationRecord[]> {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    return new Promise((resolve) => {
      chrome.storage.local.get(['resumehack_applications'], (result) => {
        if (result.resumehack_applications) {
          resolve(result.resumehack_applications);
        } else {
          // Initialize with default
          chrome.storage.local.set({ resumehack_applications: DEFAULT_APPLICATIONS });
          resolve(DEFAULT_APPLICATIONS);
        }
      });
    });
  }

  const stored = localStorage.getItem('resumehack_applications');
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return DEFAULT_APPLICATIONS;
    }
  }
  localStorage.setItem('resumehack_applications', JSON.stringify(DEFAULT_APPLICATIONS));
  return DEFAULT_APPLICATIONS;
}

export async function saveStoredApplications(apps: ApplicationRecord[]): Promise<void> {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ resumehack_applications: apps }, () => resolve());
    });
  }
  localStorage.setItem('resumehack_applications', JSON.stringify(apps));
}
