# ResumeHack — AI Job & Internship Search + Google Docs Resume Copilot

> A **100% Standalone Chrome Extension (Manifest V3)** that allows job and internship seekers to search openings, analyze ATS keyword gaps, and **tailor resumes directly inside their active Google Doc** with zero backend server required!

---

## 🌟 Key Features

1. **Zero-Friction, 100% Standalone Chrome Extension**
   - **No local backend server or CLI commands needed**: Everything runs natively inside your browser.
   - Built with high-performance client-side AI analysis, ATS keyword extraction, and Google Docs batchUpdate integration.

2. **Direct Google Docs Live Tailoring (Core Innovation)**
   - **Zero Vendor Lock-in**: Works on your real Google Doc master resume.
   - **Atomic Batch Updates**: Uses the official Google Docs API (`documents.batchUpdate`) to swap weak bullet points with high-impact STAR bullets without breaking document margins, fonts, or styling.
   - **1-Click "Fork in Drive"**: Automatically duplicates your master resume into `[Company] - Resume - [Your Name]` in Google Drive and exports an ATS-optimized PDF.

3. **ATS Match & Keyword Gap Scorer (Jobscan-style)**
   - Circular visual ATS gauge (0–100%).
   - Categorized keyword analysis (Hard Skills, Cloud Tools, Soft Skills, Domain Concepts).
   - Missing keyword tags with 1-click insertion suggestions.

4. **2026 Internship & New Grad Discovery Feed (Simplify-style)**
   - Hand-curated, verified tech & finance internships and new grad listings.
   - Filter by Software Engineering, Data & AI, Product Management, and Finance.
   - 1-Click "Tailor Resume for this Role".

5. **Application Pipeline CRM (Teal-style)**
   - Visual Kanban pipeline (Bookmarked $\rightarrow$ Tailored $\rightarrow$ Applied $\rightarrow$ Interviewing $\rightarrow$ Offered) persisted locally via `chrome.storage.local`.
   - Direct links to tailored Google Docs and PDF downloads.

6. **ATS Form Autofill Engine**
   - Automatically fills repetitive application fields on Greenhouse, Lever, and Workday.

7. **Precision Design System (Created with Stitch MCP)**
   - Primary: Deep Iris (`#4F46E5`)
   - Success: Emerald Green (`#10B981`)
   - Warning: Amber Gold (`#F59E0B`)
   - Fonts: *Plus Jakarta Sans* (Headers), *Inter* (Body), *JetBrains Mono* (ATS metrics).

8. **Always-On Desktop Screen Mascot ("Hacky") (Created with Stitch MCP)**
   - **Always-On Screen Assistant**: Floats on the bottom right of your screen across all web pages.
   - **1-Click Side Panel Trigger**: Single click directly launches the ResumeHack Copilot side panel.
   - **Context-Aware Intelligence**:
     - *Google Docs*: Instantly detects your master resume and offers 1-click ATS bullet tailoring.
     - *Job Boards (LinkedIn, Greenhouse, Lever, Workday, Indeed)*: Recognizes job titles & companies and prepares customized resume diffs.
     - *Application Forms*: 1-click candidate profile and link autofill.
     - *Internship Alerts*: Real-time badges for newly synced 2026 tech roles.
   - **Interactive Polish & Drag Physics**: Floating animations, eye blinking, holographic aura, sparkle particle burst on click, and draggable position memory.

---

## 🚀 How to Load into Google Chrome (1 Step)

1. Open **Google Chrome** and navigate to `chrome://extensions/`.
2. Toggle on **Developer mode** in the top-right corner.
3. Click **Load unpacked**.
4. Select the directory:
   ```
   /Users/minhnguyen/Desktop/Coding/resumehack/extension/dist
   ```
5. That's it! Pin the **ResumeHack** extension in Chrome and open the Side Panel. Everything works automatically out of the box.
