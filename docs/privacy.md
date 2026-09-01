# Privacy Policy — ResumeHack

**Effective Date:** September 1, 2026  
**Project:** ResumeHack (AI Career & Resume Copilot)  
**Maintainer:** [Aaron Nguyen / ResumeHack Team](https://github.com/aaronnguyen26/resumehack)  
**Contact:** [minh78988888@gmail.com](mailto:minh78988888@gmail.com)

---

## Overview

**ResumeHack** is an open-source AI Career & Resume Copilot designed to assist job seekers in optimizing, tailoring, and formatting their resumes for specific job descriptions directly within Google Docs.

We believe that your career data, resume content, and personal documents belong exclusively to you. This Privacy Policy accurately describes the data accessed, processed, transmitted, and stored by the ResumeHack browser extension and its backend proxy service.

---

## 1. Google User Data Accessed & Requested Permissions

ResumeHack requests access to specific Google API scopes strictly required to provide document analysis, live tailoring, and PDF export functionality:

* **Google Docs API (`https://www.googleapis.com/auth/documents`)**:
  * **Read Access:** Parses structural paragraphs and bullet points from your designated master resume document to calculate ATS rubric scores and identify tailoring opportunities.
  * **Write Access (`batchUpdate`):** When you explicitly click "Apply" or "Accept", ResumeHack applies the optimized STAR bullet text directly to your Google Doc via atomic reverse-index batch updates.
* **Google Drive API (`https://www.googleapis.com/auth/drive.file`)**:
  * **Narrow Per-File Scope:** Access is strictly limited to files you explicitly select via the Google Drive Picker modal or files created directly by ResumeHack (e.g., duplicated tailored copies). ResumeHack does **not** have access to arbitrary Google Drive files, folders, or unauthorized documents.
  * **Purpose:** Used solely to fetch the selected resume, duplicate tailored copies (`files.copy`), and export PDF binary streams (`files.export`).
* **User Profile Email (`https://www.googleapis.com/auth/userinfo.email`)**:
  * Used exclusively to display the connected Google account address in the extension's Settings tab so you can confirm which account is actively authenticated.

### Google API Services User Data Policy Compliance

> ResumeHack's use and transfer to any other app of information received from Google APIs will adhere to the [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy), including the Limited Use requirements.

---

## 2. Third-Party Data Transmission & AI Processing

When you trigger an ATS audit or tailoring recommendation:

* **Resume & Job Posting Text Transmission:** The text of your selected resume bullet points and the job description snippet extracted from your active browser tab are transmitted to your configured Large Language Model (LLM) provider (e.g., Google Gemini API, Anthropic Claude API, or a local Ollama instance).
* **Purpose Limitation:** Transmitted text is processed transiently and exclusively for generating STAR bullet rewrites, extracting technical keywords, and computing ATS rubric metrics.
* **No Model Training:** Your resume text and personal information are never used to train or fine-tune third-party foundation AI models.

---

## 3. Data Storage, Retention & Security

ResumeHack is engineered with a **local-first privacy architecture**:

* **Client-Side Storage (`chrome.storage.local`):** OAuth tokens (access tokens and refresh tokens), candidate preferences (e.g., candidate name, target role), and tailoring session state are stored solely on your local device in Chrome's sandboxed extension storage. Tokens are never uploaded to any external database or third-party server.
* **Stateless Backend Proxy:** The ResumeHack backend service (`/api/auth/google/exchange`) operates solely as a stateless OAuth token exchange proxy to keep OAuth client secrets secure without bundling secrets in client-side code. The backend server does **not** log, persist, or store your resume content, job listings, or OAuth tokens on disk or in a database.

---

## 4. Data Sharing & Monetization

* **No Sale of Personal Data:** ResumeHack does not sell, rent, monetize, or trade your personal data, resume content, or Google credentials to advertisers, data brokers, or commercial entities.
* **No Third-Party Tracking:** ResumeHack does not track your browsing history outside of extracting job postings from user-navigated job pages (e.g., LinkedIn, Greenhouse, Lever) when you interact with the extension.

---

## 5. User Control & Data Revocation

You retain full control over your data and connected authorizations at all times:

* **Disconnect Account:** You can disconnect your Google account and remove all stored tokens instantly by clicking **"Disconnect Account"** in the extension Settings tab.
* **Revoke Google Access:** You can revoke ResumeHack's access at any time via [Google Account Third-Party Permissions](https://myaccount.google.com/permissions).
* **Clear Extension Data:** Uninstalling the extension immediately deletes all locally saved preferences and tokens from your machine.

---

## 6. Disclaimer & Trademarks

ResumeHack is an independent open-source tool and is not affiliated with, endorsed by, or sponsored by Google LLC. *Google Docs*, *Google Drive*, and *Google Chrome* are registered trademarks of Google LLC.

---

## 7. Contact Information

If you have questions or inquiries regarding this Privacy Policy or ResumeHack's data practices, please contact:

* **Email:** [minh78988888@gmail.com](mailto:minh78988888@gmail.com)
* **GitHub Issues:** [https://github.com/aaronnguyen26/resumehack/issues](https://github.com/aaronnguyen26/resumehack/issues)
* **Repository:** [https://github.com/aaronnguyen26/resumehack](https://github.com/aaronnguyen26/resumehack)
