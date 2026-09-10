// Hacky Chatbot Service — Intelligent conversational assistant for resume, jobs, and openings
import {
  ChatMessage,
  ChatAction,
  ChatDataCard,
  ChatbotContext,
  JobPosting,
  ApplicationRecord,
} from '../types/index.js';
import { getAiSettings } from './ai-tailor.js';
import { generatePersonalizedFallbackRecommendations } from './gemini-recommendations.js';

export class HackyChatbotService {
  /**
   * Detect user intent from input text
   */
  public detectIntent(query: string): 'resume' | 'jobs_tracker' | 'job_openings' | 'general' {
    const q = query.toLowerCase().trim();

    // 1. Resume & ATS queries
    const isResumeQuery =
      /\b(resume|cv|ats|score|lines?|budget|metrics?|quantif\w*|bullets?|critique|review|feedback|grade|rubric|reframe|my profile|experience)\b/i.test(
        q
      ) ||
      /how('s| is) my resume/i.test(q) ||
      /check my resume/i.test(q) ||
      /look at my resume/i.test(q) ||
      /improve my resume/i.test(q) ||
      /what('s| is) my (ats )?score/i.test(q);

    // 2. Job Application Tracker queries ("how their jobs have been doing")
    const isTrackerQuery =
      /\b(applications?|pipeline|tracker)\b/i.test(q) ||
      /how (are|have) my (jobs?|applications?)/i.test(q) ||
      /how('s| is) my (job )?search (doing|going)/i.test(q) ||
      /status of my (jobs?|applications?)/i.test(q) ||
      /job status/i.test(q) ||
      /where did i apply/i.test(q) ||
      /companies i applied/i.test(q) ||
      /(got|have|had|any) interviews?\b/i.test(q) ||
      /interview (rate|status|pipeline|updates?|schedule)/i.test(q) ||
      /(conversion|response) rate/i.test(q);

    // 3. New Job Openings queries ("if there are any new job openings")
    const isOpeningsQuery =
      /\b(openings?|internships?|roles?|opportunities)\b/i.test(q) ||
      /new jobs?/i.test(q) ||
      /who is hiring/i.test(q) ||
      /any jobs/i.test(q) ||
      /available jobs/i.test(q) ||
      /find jobs?/i.test(q) ||
      /summer 2026/i.test(q) ||
      /are there (any )?new job/i.test(q) ||
      /job openings?/i.test(q);

    // Prioritize specific intent matches
    if (isTrackerQuery && !isOpeningsQuery) {
      return 'jobs_tracker';
    }
    if (isOpeningsQuery) {
      return 'job_openings';
    }
    if (isResumeQuery) {
      return 'resume';
    }
    if (isTrackerQuery) {
      return 'jobs_tracker';
    }

    return 'general';
  }

  /**
   * Process a user message and return Hacky's structured response
   */
  public async processUserMessage(
    userQuery: string,
    context: ChatbotContext = {}
  ): Promise<ChatMessage> {
    const intent = this.detectIntent(userQuery);

    switch (intent) {
      case 'resume':
        return this.handleResumeQuery(userQuery, context);
      case 'jobs_tracker':
        return this.handleJobsTrackerQuery(userQuery, context);
      case 'job_openings':
        return this.handleJobOpeningsQuery(userQuery, context);
      case 'general':
      default:
        return this.handleGeneralQuery(userQuery, context);
    }
  }

  /**
   * Handle resume questions (ATS score, line count, metrics, improvement tips)
   */
  public handleResumeQuery(query: string, context: ChatbotContext): ChatMessage {
    const resumeText = context.resumeText?.trim() || '';
    const atsScore = context.atsScore !== undefined ? context.atsScore : 75;

    // Empty resume text case
    if (!resumeText || resumeText.length < 30) {
      return {
        id: `hacky-msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        sender: 'hacky',
        text:
          "I don't see an active resume loaded in your workspace yet! 🦉\n\n" +
          "You can either **upload your PDF resume** on the Home page or launch the **Document Canvas** to paste and edit your text directly. Once loaded, I'll give you instant ATS scoring, metric verification, and layout checks.",
        timestamp: Date.now(),
        actions: [
          { label: 'Open Document Canvas', action: 'navigate_tab', tab: 'canvas' },
          { label: 'Upload on Home', action: 'navigate_tab', tab: 'home' },
        ],
      };
    }

    // Analyze loaded resume
    const lines = resumeText.split('\n').filter((l) => l.trim().length > 0);
    const lineCount = lines.length;

    // Extract metrics
    const metricMatches = resumeText.match(
      /(\d+(?:\.\d+)?%|\$\d+(?:,\d+)*(?:\.\d+)?[kKmMbB]?|\b\d+\s*(?:ms|s|seconds?|minutes?)\b|\b\d+[kKmMbB]?\+?\s*(?:users|clients|qps|rps|engineers|requests|queries|stars)\b)/gi
    ) || [];
    const uniqueMetrics = Array.from(new Set(metricMatches.map((m) => m.trim())));
    const metricsCount = uniqueMetrics.length;

    // Extract common tech skills
    const techSkillSet = [
      'Python', 'TypeScript', 'JavaScript', 'Go', 'Golang', 'Rust', 'Java', 'C++', 'React',
      'Next.js', 'Node.js', 'PostgreSQL', 'Redis', 'Docker', 'Kubernetes', 'AWS', 'GCP',
      'Kafka', 'GraphQL', 'FastAPI', 'Tailwind', 'Git'
    ];
    const detectedSkills = techSkillSet.filter((s) => {
      const escaped = s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`\\b${escaped}\\b`, 'i').test(resumeText);
    });

    // Determine status label & recommendations
    const scoreCategory = atsScore >= 85 ? 'Elite Tier' : atsScore >= 70 ? 'Competitive' : 'Needs Optimization';
    
    const strengths: string[] = [];
    const recommendations: string[] = [];

    if (metricsCount >= 3) {
      strengths.push(`Found ${metricsCount} quantified metrics (${uniqueMetrics.slice(0, 3).join(', ')})`);
    } else {
      recommendations.push('Add 2+ more quantified metrics (e.g. latency reduction %, throughput, users served)');
    }

    if (detectedSkills.length >= 4) {
      strengths.push(`Strong core stack detected: ${detectedSkills.slice(0, 4).join(', ')}`);
    } else {
      recommendations.push('Ensure 5+ hard skills matching your target job are prominently listed');
    }

    if (lineCount <= 52) {
      strengths.push(`Clean single-page length (~${lineCount} content lines)`);
    } else {
      recommendations.push(`Line budget warning (~${lineCount} lines). Target 48–52 lines for 1 clean page`);
    }

    // Incorporate deeply personalized recommendations from candidate actual bullets
    const personalized = generatePersonalizedFallbackRecommendations(
      resumeText,
      context.currentJob?.description,
      context.targetRole
    );

    for (const pRec of personalized.recommendations.slice(0, 2)) {
      if (pRec.originalText && pRec.originalText.length > 15) {
        recommendations.unshift(
          `${pRec.title}: Upgrade "${pRec.originalText.slice(0, 45)}..." with quantifiable metrics & active leadership verbs`
        );
      } else {
        recommendations.unshift(pRec.title);
      }
    }

    if (recommendations.length === 0) {
      recommendations.push('Run Closed-Loop ATS tailoring against your target role in Document Canvas');
    }

    const topRecSection = personalized.recommendations.length > 0 && personalized.recommendations[0].originalText
      ? `**Top Personalized Recommendation:** ${personalized.recommendations[0].title}\n` +
        `• *Original:* "${personalized.recommendations[0].originalText.slice(0, 65)}..."\n` +
        `• *Elevated Rewrite:* ${personalized.recommendations[0].improvedText}`
      : `**Top Recommendation:** ${recommendations[0]}`;

    const text =
      `Here is how your resume is currently looking: 🦉\n\n` +
      `• **ATS Score:** **${atsScore}%** (${scoreCategory})\n` +
      `• **Quantified Impact:** **${metricsCount}** verified metrics found\n` +
      `• **Technical Stack:** ${detectedSkills.length > 0 ? detectedSkills.slice(0, 5).join(', ') : 'Add skills section'}\n` +
      `• **Page Budget:** ~${lineCount} lines (${lineCount <= 52 ? 'Fits 1 page ✅' : 'Exceeds 1 page ⚠️'})\n\n` +
      topRecSection;

    const dataCard: ChatDataCard = {
      type: 'resume_summary',
      score: atsScore,
      metricsCount,
      skillsCount: detectedSkills.length,
      lineCount,
      title: context.applicantProfile?.firstName ? `${context.applicantProfile.firstName}'s Resume` : 'Active Resume',
      topStrengths: strengths,
      topRecommendations: recommendations,
    };

    const actions: ChatAction[] = [
      { label: 'Optimize in Canvas', action: 'navigate_tab', tab: 'canvas' },
      { label: 'View Bullet Vault', action: 'navigate_tab', tab: 'profile' },
    ];

    return {
      id: `hacky-msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      sender: 'hacky',
      text,
      timestamp: Date.now(),
      dataCard,
      actions,
    };
  }

  /**
   * Handle job tracker questions ("how their jobs have been doing")
   */
  public handleJobsTrackerQuery(query: string, context: ChatbotContext): ChatMessage {
    const apps = context.applications || [];

    if (apps.length === 0) {
      return {
        id: `hacky-msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        sender: 'hacky',
        text:
          "You don't have any applications tracked in your **Tracker CRM** yet! 📊\n\n" +
          "Whenever you find roles in the **Discovery** feed or submit an application, add it to your tracker so I can monitor your interview conversion rates and remind you when to follow up.",
        timestamp: Date.now(),
        actions: [
          { label: 'Browse Discovery Jobs', action: 'navigate_tab', tab: 'discovery' },
          { label: 'Open Tracker CRM', action: 'navigate_tab', tab: 'tracker' },
        ],
      };
    }

    const total = apps.length;
    const interviewing = apps.filter((a) => a.status === 'Interviewing').length;
    const applied = apps.filter((a) => a.status === 'Applied').length;
    const offered = apps.filter((a) => a.status === 'Offered').length;
    const rejected = apps.filter((a) => a.status === 'Rejected').length;
    const bookmarked = apps.filter((a) => a.status === 'Bookmarked' || a.status === 'Tailored').length;

    const interviewRate = Math.round(((interviewing + offered) / (applied + interviewing + offered + rejected || 1)) * 100);

    const interviewingApps = apps.filter((a) => a.status === 'Interviewing');
    const recentCompanies = apps.slice(0, 3).map((a) => a.company);

    let commentary = '';
    if (interviewing > 0) {
      commentary = `🔥 **Great momentum!** You have active interviews with **${interviewingApps.map((a) => a.company).join(', ')}**!`;
    } else if (applied > 0) {
      commentary = `You have **${applied} active application(s)** awaiting response. Pro tip: Follow up on LinkedIn after 7 business days to double your callback rate.`;
    } else {
      commentary = `You have **${bookmarked} bookmarked role(s)** ready to tailor and submit!`;
    }

    const text =
      `Here is the pulse on your job search across **${total} tracked application(s)**: 📊\n\n` +
      `• **Interviewing:** ${interviewing}\n` +
      `• **Applied:** ${applied}\n` +
      `• **Offers:** ${offered}\n` +
      `• **Bookmarked / Tailored:** ${bookmarked}\n` +
      `• **Interview Conversion Rate:** **${interviewRate}%**\n\n` +
      `${commentary}`;

    const dataCard: ChatDataCard = {
      type: 'pipeline_summary',
      total,
      applied,
      interviewing,
      offered,
      rejected,
      bookmarked,
      interviewRate,
      recentCompanies,
    };

    const actions: ChatAction[] = [
      { label: 'Open Tracker CRM', action: 'navigate_tab', tab: 'tracker' },
      { label: 'Find More Openings', action: 'navigate_tab', tab: 'discovery' },
    ];

    return {
      id: `hacky-msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      sender: 'hacky',
      text,
      timestamp: Date.now(),
      dataCard,
      actions,
    };
  }

  /**
   * Handle job openings questions ("if there are any new job openings")
   */
  public handleJobOpeningsQuery(query: string, context: ChatbotContext): ChatMessage {
    const jobs = context.jobs || [];
    const totalAvailable = jobs.length || 100;

    // Pick top 3 recommended roles
    const topRoles = jobs.slice(0, 3);

    const openingsList = topRoles.map((j) => ({
      id: j.id,
      title: j.title,
      company: j.company,
      location: j.location || 'Remote',
      salary: j.salaryRange,
      url: j.url,
    }));

    const roleLines = topRoles
      .map((j, i) => `**${i + 1}. ${j.company}** — ${j.title} (${j.location || 'Remote'}${j.salaryRange ? ` • ${j.salaryRange}` : ''})`)
      .join('\n');

    const text =
      `Yes! We currently have **${totalAvailable}+ verified tech openings** actively accepting applications in your Discovery feed! 💼\n\n` +
      `Here are top recommended openings for you:\n` +
      `${roleLines || '• Openings available in Discovery'}\n\n` +
      `You can tailor your resume for any role with a single click to optimize keyword match scores.`;

    const dataCard: ChatDataCard = {
      type: 'job_openings',
      totalAvailable,
      openings: openingsList,
    };

    const actions: ChatAction[] = [
      ...(topRoles[0]
        ? [
            {
              label: `Tailor for ${topRoles[0].company}`,
              action: 'tailor_job' as const,
              payload: topRoles[0],
            },
          ]
        : []),
      { label: 'Explore 100+ Jobs (Discovery)', action: 'navigate_tab', tab: 'discovery' },
    ];

    return {
      id: `hacky-msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      sender: 'hacky',
      text,
      timestamp: Date.now(),
      dataCard,
      actions,
    };
  }

  /**
   * Handle general career coaching questions
   */
  public async handleGeneralQuery(query: string, context: ChatbotContext): Promise<ChatMessage> {
    const q = query.toLowerCase();

    // 1. STAR method
    if (/star/i.test(q)) {
      return {
        id: `hacky-msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        sender: 'hacky',
        text:
          "**The STAR Method for Engineering Resumes:**\n\n" +
          "• **S (Situation):** Context of the problem (e.g., 'High Redis memory usage during peak traffic')\n" +
          "• **T (Task):** The objective you owned (e.g., 'Targeted 40% memory reduction without dropping cache hits')\n" +
          "• **A (Action):** The technical engineering you executed (e.g., 'Implemented Dragonfly tiered caching & binary serialization')\n" +
          "• **R (Result):** Quantified outcome (e.g., 'Reduced P99 latency by 45% and saved $12K/month in cloud infrastructure')\n\n" +
          "Want to frame your bullets in STAR, Systems Depth, or Scale & Impact? Check the Document Canvas!",
        timestamp: Date.now(),
        actions: [{ label: 'Try in Document Canvas', action: 'navigate_tab', tab: 'canvas' }],
      };
    }

    // 2. Metrics / How to quantify
    if (/quantif|metric/i.test(q)) {
      return {
        id: `hacky-msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        sender: 'hacky',
        text:
          "**How to Add Metrics When You Don't Have Exact Production Data:** 💡\n\n" +
          "1. **Scale & Load:** 'Processed 50,000+ synthetic test payloads' or 'Benchmarked at 1,200 QPS'\n" +
          "2. **Latency & Speed:** 'Reduced P99 query response time from 350ms to 85ms via B-tree indexing'\n" +
          "3. **Coverage & Quality:** 'Authored 45+ unit & integration tests achieving 92% code coverage'\n" +
          "4. **Productivity:** 'Cut developer build times by 60% with Docker layer caching'\n\n" +
          "Hacky AI automatically detects and verifies these in your Document Canvas!",
        timestamp: Date.now(),
        actions: [{ label: 'Open Canvas', action: 'navigate_tab', tab: 'canvas' }],
      };
    }

    // 3. Interview preparation
    if (/interview/i.test(q)) {
      return {
        id: `hacky-msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        sender: 'hacky',
        text:
          "**Technical Interview Blueprint:** 🎯\n\n" +
          "1. **Data Structures & Algorithms:** Focus on Graphs (BFS/DFS), Dynamic Programming, Sliding Window, and Hash Tables.\n" +
          "2. **System Design (for Senior/Staff):** Practice designing rate limiters, distributed caches (Redis), and message queues (Kafka).\n" +
          "3. **Behavioral (STAR):** Have 4 core stories ready: technical disagreement, project deadline crunch, production incident post-mortem, and leading an initiative.\n\n" +
          "Check your Tracker CRM to monitor upcoming interview dates!",
        timestamp: Date.now(),
        actions: [{ label: 'Go to Tracker CRM', action: 'navigate_tab', tab: 'tracker' }],
      };
    }

    // Optional LLM Call if API key exists
    try {
      const aiSettings = await getAiSettings();
      if (aiSettings?.apiKey && aiSettings.provider === 'gemini') {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${aiSettings.model || 'gemini-2.0-flash'}:generateContent?key=${aiSettings.apiKey}`;
        const sysPrompt = `You are Hacky, an elite AI technical career coach and resume strategist. Respond in 2-3 concise, actionable paragraphs with bullet points. Tone: Encouraging, direct, high-standards engineering culture. Monochromatic zinc theme, zero fluff.`;
        const userPrompt = `Candidate context:
${context.applicantProfile?.firstName ? `Name: ${context.applicantProfile.firstName}` : ''}
Target role: ${context.applicantProfile?.targetRole || 'Software Engineer'}
ATS Score: ${context.atsScore || 75}%
Tracked applications: ${context.applications?.length || 0}
Question: "${query}"`;

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: `${sysPrompt}\n\n${userPrompt}` }] }],
            generationConfig: { temperature: 0.4, maxOutputTokens: 300 },
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const ans = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          if (ans) {
            return {
              id: `hacky-msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              sender: 'hacky',
              text: ans,
              timestamp: Date.now(),
              actions: [
                { label: 'Open Document Canvas', action: 'navigate_tab', tab: 'canvas' },
                { label: 'Explore Jobs', action: 'navigate_tab', tab: 'discovery' },
              ],
            };
          }
        }
      }
    } catch {
      // Fallback cleanly to default response
    }

    // Default friendly assistant fallback
    return {
      id: `hacky-msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      sender: 'hacky',
      text:
        "I'm here to help you land your dream tech role! 🦉\n\n" +
        "Here are a few things you can ask me:\n" +
        "• **'How is my resume doing?'** — I'll analyze your ATS score, line budget, and quantified metrics\n" +
        "• **'How are my jobs doing?'** — I'll check your application tracker pipeline and conversion rates\n" +
        "• **'Are there any new job openings?'** — I'll pull the freshest verified 2026 tech roles\n" +
        "• **'How do I quantify my bullets?'** — I'll share high-impact formulas for engineering resumes",
      timestamp: Date.now(),
      actions: [
        { label: 'How is my resume doing?', action: 'quick_reply', payload: 'How is my resume doing?' },
        { label: 'How are my jobs doing?', action: 'quick_reply', payload: 'How are my jobs doing?' },
        { label: 'Any new job openings?', action: 'quick_reply', payload: 'Are there any new job openings?' },
      ],
    };
  }
}

export const HackyChatbot = new HackyChatbotService();
