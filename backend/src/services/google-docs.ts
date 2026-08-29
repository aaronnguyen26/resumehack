import { google, docs_v1 } from 'googleapis';
import { ResumeBullet, TailoredBulletDiff } from '../types/index.js';

export class GoogleDocsService {
  /**
   * Fetches the Google Doc content and extracts resume bullet points.
   */
  public async getDocumentAndExtractBullets(
    documentId: string,
    accessToken?: string
  ): Promise<{ title: string; fullText: string; bullets: ResumeBullet[] }> {
    if (!accessToken) {
      // Return sample master resume structure for local/demo workflows
      return this.getMockMasterResume(documentId);
    }

    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });
    const docs = google.docs({ version: 'v1', auth });

    const response = await docs.documents.get({ documentId });
    const doc = response.data;
    const title = doc.title || 'Untitled Resume';

    const bullets: ResumeBullet[] = [];
    let fullText = '';

    if (doc.body && doc.body.content) {
      for (const element of doc.body.content) {
        if (element.paragraph && element.paragraph.elements) {
          const paraText = element.paragraph.elements.map(e => e.textRun?.content || '').join('');
          fullText += paraText;

          // Detect bulleted items or lists
          if (element.paragraph.bullet || paraText.trim().startsWith('•') || paraText.trim().startsWith('-')) {
            const cleanText = paraText.trim().replace(/^[•\-*]\s*/, '');
            if (cleanText.length > 15) {
              bullets.push({
                id: `bullet-${bullets.length + 1}`,
                section: 'Experience',
                organization: 'Work Experience',
                role: 'Software Engineer',
                originalText: cleanText,
                startIndex: element.startIndex ?? undefined,
                endIndex: element.endIndex ?? undefined
              });
            }
          }
        }
      }
    }

    return { title, fullText, bullets };
  }

  /**
   * Generates and executes Google Docs batchUpdate requests to apply tailored bullets.
   */
  public async applyBatchUpdates(
    documentId: string,
    diffs: TailoredBulletDiff[],
    accessToken?: string
  ): Promise<{ success: boolean; updatedCount: number; requestsExecuted: number }> {
    const acceptedDiffs = diffs.filter(d => d.status === 'accepted');
    if (acceptedDiffs.length === 0) {
      return { success: true, updatedCount: 0, requestsExecuted: 0 };
    }

    // Build replaceAllText requests for exact string matching
    const requests: docs_v1.Schema$Request[] = acceptedDiffs.map(diff => ({
      replaceAllText: {
        containsText: {
          text: diff.originalText,
          matchCase: true
        },
        replaceText: diff.tailoredText
      }
    }));

    if (accessToken) {
      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: accessToken });
      const docs = google.docs({ version: 'v1', auth });

      await docs.documents.batchUpdate({
        documentId,
        requestBody: { requests }
      });
    }

    return {
      success: true,
      updatedCount: acceptedDiffs.length,
      requestsExecuted: requests.length
    };
  }

  public getMockMasterResume(documentId: string = 'mock-doc-123') {
    const title = 'Alex Chen - Master Resume 2026';
    const bullets: ResumeBullet[] = [
      {
        id: 'bullet-1',
        section: 'Experience',
        organization: 'Acme Cloud Solutions',
        role: 'Software Engineering Intern',
        originalText: 'Worked on backend services using Python and Postgres to process customer orders.'
      },
      {
        id: 'bullet-2',
        section: 'Experience',
        organization: 'Acme Cloud Solutions',
        role: 'Software Engineering Intern',
        originalText: 'Helped with CI/CD pipeline automation and fixed broken integration tests.'
      },
      {
        id: 'bullet-3',
        section: 'Projects',
        organization: 'Distributed Key-Value Store',
        role: 'Creator & Maintainer',
        originalText: 'Built a key-value database in Go with Raft consensus and REST API endpoints.'
      },
      {
        id: 'bullet-4',
        section: 'Projects',
        organization: 'Resume AI Assistant',
        role: 'Full-Stack Developer',
        originalText: 'Made a React and Node.js web app to analyze text using OpenAI API.'
      }
    ];

    const fullText = `Alex Chen
San Francisco, CA | alex.chen@example.com | github.com/alexchen | linkedin.com/in/alexchen

EDUCATION
University of California, Berkeley
B.S. in Computer Science | GPA: 3.85 | Expected Graduation: May 2026

TECHNICAL SKILLS
Languages: Python, Go, TypeScript, JavaScript, SQL, C++, HTML/CSS
Frameworks: React, Node.js, Express, FastAPI, Tailwind CSS, PostgreSQL, Redis
Developer Tools: Docker, Git, Linux, Google Cloud Platform (GCP), GitHub Actions, Vitest

EXPERIENCE
Acme Cloud Solutions — Software Engineering Intern | May 2025 – Aug 2025
• Worked on backend services using Python and Postgres to process customer orders.
• Helped with CI/CD pipeline automation and fixed broken integration tests.

PROJECTS
Distributed Key-Value Store | Go, Raft, Docker, REST API
• Built a key-value database in Go with Raft consensus and REST API endpoints.

Resume AI Assistant | TypeScript, React, Node.js, LLM
• Made a React and Node.js web app to analyze text using OpenAI API.`;

    return { title, fullText, bullets };
  }
}
