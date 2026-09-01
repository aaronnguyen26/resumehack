// GitHub Internship Tracker & Live Sync Service — v2 with In-Depth Multi-Disciplinary Role Enrichment
// Parses HTML <table> format used by SimplifyJobs repos & enriches each role across Business, Humanities, STEM, and Social Sciences
import { JobPosting } from '../types/index.js';

export interface GitHubRepoSource {
  name: string;
  repo: string;        // owner/repo format — used for SHA commit check
  url: string;         // raw README URL
  category: JobPosting['category'];
  season: string;
}

export const GITHUB_SOURCES: GitHubRepoSource[] = [
  {
    name: 'SimplifyJobs Summer 2027 — Software Engineering',
    repo: 'SimplifyJobs/Summer2027-Internships',
    url: 'https://raw.githubusercontent.com/SimplifyJobs/Summer2027-Internships/dev/README.md',
    category: 'Software Engineering',
    season: 'Summer 2027',
  },
  {
    name: 'SimplifyJobs New Grad 2025–2027',
    repo: 'SimplifyJobs/New-Grad-Positions',
    url: 'https://raw.githubusercontent.com/SimplifyJobs/New-Grad-Positions/dev/README.md',
    category: 'Software Engineering',
    season: 'New Grad',
  },
  {
    name: 'Quant Finance Internships 2027',
    repo: 'SimplifyJobs/Summer2027-Internships',
    url: 'https://raw.githubusercontent.com/SimplifyJobs/Summer2027-Internships/dev/README.md',
    category: 'Finance & Quant',
    season: 'Summer 2027',
  },
];

// Rich Seed Database spanning Business, Humanities, Consulting, Finance, Policy, Marketing, Operations, Legal, Design, and Tech
export const SEED_INTERNSHIP_DATABASE: JobPosting[] = [
  {
    id: 'seed-mckinsey-ba-2027',
    title: 'Business Analyst Intern — Summer 2027',
    company: 'McKinsey & Company',
    location: 'New York, NY / San Francisco, CA / Chicago, IL',
    workModel: 'Hybrid',
    type: 'Internship',
    season: 'Summer 2027',
    category: 'Business & Strategy',
    source: 'CuratedFeed',
    url: 'https://www.mckinsey.com/careers/search-jobs/jobs/business-analyst-intern-summer-2027',
    salaryRange: '$48 – $58 / hr + $10,000 Housing Stipend',
    daysAgo: 0,
    educationRequirements: 'Pursuing Bachelor’s or Master’s in Business, Economics, STEM, or Liberal Arts (Graduation: 2027–2028)',
    sponsorship: 'CPT / OPT Eligible & Full Visa Sponsorship Available',
    aboutCompany: 'McKinsey & Company is a global management consulting firm committed to helping organizations accelerate sustainable and inclusive growth across 90 of the top 100 corporations.',
    aboutTeam: 'You will join an active client engagement team structuring complex business problems, modeling market impact, and advising C-suite leaders on corporate strategy and operations.',
    department: 'Management Consulting & Strategy Practice',
    teamHighlights: [
      'Work on high-profile strategy engagements advising Fortune 500 CEOs',
      'Dedicated Engagement Manager mentor and personal development coach',
      'High conversion rate to Business Analyst new grad positions'
    ],
    responsibilities: [
      'Structure ambiguous client business problems into hypothesis-driven issue trees and analytical work plans.',
      'Conduct quantitative market sizing, financial modeling, pricing elasticity analysis, and cost benchmarking.',
      'Perform primary qualitative research including expert interviews and operational site visits.',
      'Synthesize findings into executive presentation storylines and board-level decks.'
    ],
    requirements: [
      'Enrolled in an undergraduate or master’s program graduating in 2027 or 2028 across any major.',
      'Strong structured problem-solving, numerical logic, and business intuition.',
      'Superior communication and executive presentation skills.'
    ],
    preferredQualifications: [
      'Prior consulting, banking, corporate strategy, or case competition experience.',
      'Advanced proficiency in Excel modeling and slide presentation design.'
    ],
    skills: ['Management Consulting', 'Problem Structuring', 'Market Sizing', 'Financial Modeling', 'Executive Storytelling', 'Excel', 'PowerPoint', 'Strategy'],
    benefits: [
      '$48 – $58 / hr competitive consulting hourly rate',
      '$10,000 lump-sum housing stipend',
      'Full roundtrip airfare and client travel reimbursement',
      'Global Intern Summer Retreat and partner mentorship'
    ],
    interviewProcess: [
      'Stage 1: McKinsey Solve (Imbellus digital ecosystem simulation - 70 mins)',
      'Stage 2: First Round Case Interviews (2x 45 min Case & PEI)',
      'Stage 3: Final Round Partner Superday (3x 45 min Partner Case Interviews)'
    ],
    prepTips: [
      'Master the McKinsey Personal Experience Interview (PEI) with deep STAR leadership stories.',
      'Practice MECE issue tree structuring and mental math calculations under time pressure.'
    ],
    description: 'Business Analyst Intern at McKinsey & Company tackling high-stakes strategy and operational challenges for global leaders.'
  },
  {
    id: 'seed-goldman-ib-2027',
    title: 'Summer Analyst — Investment Banking Division',
    company: 'Goldman Sachs',
    location: 'New York, NY / San Francisco, CA',
    workModel: 'On-site',
    type: 'Internship',
    season: 'Summer 2027',
    category: 'Finance & Accounting',
    source: 'CuratedFeed',
    url: 'https://www.goldmansachs.com/careers/students/programs/summer-analyst-program.html',
    salaryRange: '$55 – $65 / hr ($115k Annualized Prorated) + $5k Sign-on',
    daysAgo: 0,
    educationRequirements: 'B.S., B.A., or M.S. in Finance, Economics, Accounting, Math, or STEM graduating Dec 2027 – June 2028',
    sponsorship: 'CPT / OPT Eligible & H-1B Sponsorship Supported',
    aboutCompany: 'The Goldman Sachs Group, Inc. is a leading global investment banking, securities, and investment management firm advising top enterprises and governments worldwide.',
    aboutTeam: 'You will join Global Banking & Markets in Classic Investment Banking (M&A, Healthcare, TMT, Financial Institutions) or Financing Group (ECM / DCM).',
    department: 'Global Banking & Markets / Classic Investment Banking',
    teamHighlights: [
      'Ranked #1 globally in announced and completed M&A volume',
      'Comprehensive 10-week financial modeling and valuation bootcamp',
      'Converts 85%+ of summer analysts to full-time new grad offers'
    ],
    responsibilities: [
      'Build dynamic DCF, LBO, merger consequence, and comparable company trading valuation models.',
      'Prepare confidential information memorandums (CIM), pitchbooks, and board materials for live M&A mandates.',
      'Analyze corporate 10-K filings, debt covenants, and capital structure alternatives.'
    ],
    requirements: [
      'Pursuing an undergraduate or graduate degree graduating in 2027–2028.',
      'Solid grasp of 3-statement accounting, corporate finance, and valuation methodologies.',
      'Advanced Excel (financial modeling) and PowerPoint skills.'
    ],
    preferredQualifications: [
      'Prior finance, accounting, or private equity internship experience.',
      'Familiarity with Bloomberg Terminal, FactSet, or Capital IQ.'
    ],
    skills: ['Financial Modeling', 'DCF Valuation', 'LBO Modeling', 'M&A Diligence', '3-Statement Accounting', 'Excel', 'PowerPoint', 'Capital IQ'],
    benefits: [
      '$55 – $65 / hr top-tier compensation',
      '$5,000 signing and relocation stipend',
      'Daily subsidized gourmet dining at 200 West cafeteria',
      'Speaker series with CEO David Solomon and global leadership'
    ],
    interviewProcess: [
      'Stage 1: HireVue Video & Commercial Awareness Interview (30 mins)',
      'Stage 2: Technical Phone Screen (45 mins: 3-statement accounting & DCF mechanics)',
      'Stage 3: Superday Round 1 — Accounting & Valuation Deep Dive (45 mins)',
      'Stage 4: Superday Round 2 — Deal Pitch & Stock Pitch (45 mins)',
      'Stage 5: Superday Round 3 — Behavioral & Fit with Managing Director (45 mins)'
    ],
    prepTips: [
      'Know how a $10 depreciation expense flows through the 3 financial statements.',
      'Prepare a clear stock pitch or recent M&A deal rationale with valuation multiples.'
    ],
    description: 'Summer Analyst in Goldman Sachs Investment Banking Division advising clients on landmark M&A transactions and capital raises.'
  },
  {
    id: 'seed-nytimes-fellow-2027',
    title: 'Newsroom Fellowship & Editorial Reporting Intern — Summer 2027',
    company: 'The New York Times',
    location: 'New York, NY (Headquarters)',
    workModel: 'On-site',
    type: 'Internship',
    season: 'Summer 2027',
    category: 'Humanities & Social Sciences',
    source: 'CuratedFeed',
    url: 'https://www.nytco.com/careers/newsroom/newsroom-fellowship/',
    salaryRange: '$32 – $38 / hr + Housing Stipend',
    daysAgo: 0,
    educationRequirements: 'Undergraduate or graduate students in Journalism, English, History, Political Science, or any Liberal Arts field',
    sponsorship: 'CPT / OPT Eligible',
    aboutCompany: 'The New York Times is a global media organization dedicated to independent journalism, having earned 137 Pulitzer Prizes.',
    aboutTeam: 'You will join the National, Metro, Business, Culture, Climate, or Audio desks, reporting enterprise stories alongside veteran editors and reporters.',
    department: 'The New York Times Newsroom / Editorial',
    teamHighlights: [
      'Byline articles published in the world’s leading news publication',
      'Direct mentorship from Pulitzer Prize-winning journalists',
      'Intensive training in FOIA requests, investigative data reporting, and ethics'
    ],
    responsibilities: [
      'Report, write, and pitch enterprise news stories and feature packages on deadline.',
      'Interview primary sources, public officials, and community members across diverse backgrounds.',
      'File Freedom of Information Act (FOIA) requests and analyze public records and regulatory disclosures.'
    ],
    requirements: [
      'Demonstrated commitment to non-fiction storytelling, journalism, or campus reporting.',
      'Exceptional writing, fact-checking, and critical research capabilities.',
      'Adherence to strict standards of accuracy and journalistic integrity.'
    ],
    preferredQualifications: [
      'Portfolio of 3-5 published journalistic articles or investigative reports.',
      'Data journalism skills (Excel, SQL, Python for public datasets).'
    ],
    skills: ['Investigative Reporting', 'Feature Writing', 'Interviewing', 'Fact-Checking', 'FOIA / Public Records', 'NYT Style', 'Data Journalism'],
    benefits: [
      '$32 – $38 / hr competitive hourly pay',
      'Lump-sum housing assistance stipend',
      'Access to daily Times newsroom masterclasses',
      'Pathways to staff reporter and contributor positions'
    ],
    interviewProcess: [
      'Stage 1: Portfolio & Writing Clips Evaluation',
      'Stage 2: Editor Phone Screen (45 mins: Story ideas & reporting background)',
      'Stage 3: Timed Reporting Exercise (90 mins: File a 500-word breaking news piece)',
      'Stage 4: Final Panel with Senior Desk Editors (45 mins)'
    ],
    prepTips: [
      'Prepare 3 actionable story pitches tailored to the specific desk you are applying to.',
      'Highlight original source reporting rather than aggregated secondary commentary.'
    ],
    description: 'Newsroom Fellowship at The New York Times reporting high-impact investigative and feature journalism.'
  },
  {
    id: 'seed-brookings-policy-2027',
    title: 'Policy Research Analyst Intern — Economic & Governance Studies',
    company: 'The Brookings Institution',
    location: 'Washington, DC',
    workModel: 'Hybrid',
    type: 'Internship',
    season: 'Summer 2027',
    category: 'Policy & Non-Profit',
    source: 'CuratedFeed',
    url: 'https://www.brookings.edu/careers/',
    salaryRange: '$25 – $32 / hr + DC Transit Subsidy',
    daysAgo: 0,
    educationRequirements: 'Pursuing Bachelor’s or Master’s in Public Policy, Economics, Political Science, or International Relations (Graduation: 2027–2028)',
    sponsorship: 'CPT / OPT Eligible',
    aboutCompany: 'The Brookings Institution is a nonprofit public policy research think tank in Washington, DC conducting nonpartisan research to solve society’s toughest problems.',
    aboutTeam: 'Fellows collaborate with Senior Policy Fellows and former economists on research reports that inform federal legislation and executive branch policy.',
    department: 'Economic & Governance Public Policy Research',
    teamHighlights: [
      'Ranked among the premier policy think tanks globally',
      'Author policy memos cited in Congressional hearings and national news',
      'Weekly policy seminars with senators, diplomats, and senior economists'
    ],
    responsibilities: [
      'Conduct empirical quantitative and qualitative policy research on pending federal bills and regulations.',
      'Analyze public economic datasets (Census, BLS, Federal Reserve) using R, Stata, or Python.',
      'Draft concise policy briefs, literature reviews, and Congressional testimony memos.'
    ],
    requirements: [
      'Enrolled in Public Policy, Economics, Political Science, or related Social Science program.',
      'Strong research writing skills with ability to distill complex data into clear memos.',
      'Working knowledge of statistical data tools (R, Stata, Python, or Excel).'
    ],
    preferredQualifications: [
      'Previous experience in government, Capitol Hill, state legislature, or policy research.',
      'Coursework in Econometrics, Public Finance, or Microeconomics.'
    ],
    skills: ['Public Policy Analysis', 'Econometrics', 'Policy Brief Writing', 'Legislative Tracking', 'R / Stata / Python', 'Literature Reviews'],
    benefits: [
      '$25 – $32 / hr competitive think-tank rate',
      'Metro transit subsidy for commuting in DC',
      'Full healthcare and wellness coverage',
      'High conversion to full-time pre-law/pre-doc Research Assistant roles'
    ],
    interviewProcess: [
      'Stage 1: Writing Sample & Policy Paper Review',
      'Stage 2: Phone Screen with Research Coordinator (30 mins)',
      'Stage 3: Timed Policy Brief Exercise (60 mins: Draft a 1-page memo on a bill)',
      'Stage 4: Panel Interview with Senior Fellows (45 mins)'
    ],
    prepTips: [
      'Use the Bottom Line Up Front (BLUF) executive structure for policy memo writing.',
      'Be ready to explain how you analyzed empirical data in past research.'
    ],
    description: 'Policy Research Analyst Intern at The Brookings Institution conducting quantitative policy analysis and memo drafting.'
  },
  {
    id: 'seed-apple-supplychain-2027',
    title: 'Global Supply Chain & Operations Management Intern — Summer 2027',
    company: 'Apple',
    location: 'Cupertino, CA / Austin, TX',
    workModel: 'On-site',
    type: 'Internship',
    season: 'Summer 2027',
    category: 'Operations & HR',
    source: 'CuratedFeed',
    url: 'https://jobs.apple.com/en-us/search?search=supply%20chain%20intern',
    salaryRange: '$50 – $60 / hr + $12,000 Housing + Full Relocation',
    daysAgo: 0,
    educationRequirements: 'Currently pursuing Bachelor’s or Master’s in Supply Chain, Industrial Engineering, Operations Research, Business, or Economics (Graduation: 2027–2028)',
    sponsorship: 'CPT / OPT Eligible & H-1B Sponsorship Provided',
    aboutCompany: 'Apple designs world-changing personal technology backed by the #1 ranked global supply chain in the world.',
    aboutTeam: 'You will work within Worldwide Operations managing component allocations, supplier relationships, and manufacturing logistics for flagship product launches.',
    department: 'Worldwide Supply Chain & Operations',
    teamHighlights: [
      'Ranked #1 Global Supply Chain by Gartner',
      'Direct ownership of multi-million unit component allocations',
      'High conversion to Operations Leadership Rotational Program'
    ],
    responsibilities: [
      'Develop dynamic demand forecasting and manufacturing capacity models.',
      'Analyze supply chain risk, safety buffer stocks, and freight lead times using SQL and Tableau.',
      'Partner with Global Supply Managers (GSM) to evaluate supplier cost structures.'
    ],
    requirements: [
      'Enrolled in Supply Chain, Operations, Industrial Engineering, Business, or Economics.',
      'Strong quantitative modeling capabilities in Excel and SQL.',
      'Excellent cross-functional negotiation and communication skills.'
    ],
    preferredQualifications: [
      'Familiarity with Lean Six Sigma, SQL databases, or Tableau dashboards.',
      'Prior operations, manufacturing, or logistics internship experience.'
    ],
    skills: ['Supply Chain Management', 'Demand Forecasting', 'Global Logistics', 'Inventory Optimization', 'SQL', 'Tableau', 'Capacity Planning'],
    benefits: [
      '$50 – $60 / hr top-tier operations compensation',
      '$12,000 housing stipend or paid corporate housing near Apple Park',
      'Generous Apple employee product discounts',
      'Luxury commuter shuttle access with Wi-Fi'
    ],
    interviewProcess: [
      'Stage 1: Operations Recruiter Screen (30 mins)',
      'Stage 2: Technical Supply Chain & Capacity Math Screen (45 mins)',
      'Stage 3: Superday Round 1 — Operations Case Study & Data Modeling (60 mins)',
      'Stage 4: Superday Round 2 — Supplier Negotiation & Problem Solving (45 mins)',
      'Stage 5: Superday Round 3 — Culture Fit with Operations Director (45 mins)'
    ],
    prepTips: [
      'Review core supply chain math: Little’s Law, EOQ, and bottleneck analysis.',
      'Prepare structured frameworks for resolving unexpected global supplier disruptions.'
    ],
    description: 'Supply Chain and Operations Intern at Apple optimizing demand forecasting and manufacturing logistics for flagship devices.'
  },
  {
    id: 'seed-figma-design-2027',
    title: 'Product Design Intern — Summer 2027',
    company: 'Figma',
    location: 'San Francisco, CA / New York, NY (Hybrid)',
    workModel: 'Hybrid',
    type: 'Internship',
    season: 'Summer 2027',
    category: 'Design & Creative',
    source: 'CuratedFeed',
    url: 'https://www.figma.com/careers/',
    salaryRange: '$55 – $65 / hr + $12,000 Housing Stipend',
    daysAgo: 0,
    educationRequirements: 'Currently pursuing Bachelor’s or Master’s in Design, HCI, Art, Cognitive Science, or related creative field (Graduation: 2027–2028)',
    sponsorship: 'CPT / OPT Eligible & H-1B Sponsorship Available',
    aboutCompany: 'Figma is the leading collaborative interface design platform empowering millions of designers and software teams around the world.',
    aboutTeam: 'You will join the Core Product Design team (Design Systems, FigJam, or Dev Mode), designing canvas tools and interactive workflows used by the world’s top product creators.',
    department: 'Product Design & User Experience',
    teamHighlights: [
      'Design tools for millions of fellow world-class designers and engineers',
      'Deeply craft-driven design culture led by CEO Dylan Field',
      'High conversion rate to full-time Product Designer positions'
    ],
    responsibilities: [
      'Design intuitive user interfaces and interaction flows from wireframes to high-fidelity production prototypes.',
      'Contribute to Figma’s design system, token architecture, and component libraries.',
      'Conduct usability testing sessions and iterate rapidly based on designer feedback.'
    ],
    requirements: [
      'Pursuing a degree in Product Design, HCI, Graphic Design, or related field.',
      'Outstanding portfolio showcasing user-centered design rationale and visual craft.',
      'Mastery of Figma: components, auto-layout, variables, and interactive prototyping.'
    ],
    preferredQualifications: [
      'Understanding of frontend web constraints (HTML/CSS/JS) and accessibility (WCAG).',
      'Experience with motion design or published Figma Community plugins.'
    ],
    skills: ['Product Design', 'UI / UX Design', 'Figma (Auto-Layout / Variables)', 'Design Systems', 'Interactive Prototyping', 'User Research'],
    benefits: [
      '$55 – $65 / hr competitive design pay',
      '$12,000 housing stipend or corporate apartments',
      'Figma Config VIP pass and executive design mentorship',
      'Daily catered meals and home workstation budget'
    ],
    interviewProcess: [
      'Stage 1: Portfolio & Case Study Review',
      'Stage 2: 1-on-1 Portfolio Deep Dive (60 mins)',
      'Stage 3: Live App Critique (45 mins: Evaluate UX affordances of a consumer app)',
      'Stage 4: Collaborative Whiteboard Design Session (60 mins)'
    ],
    prepTips: [
      'Frame portfolio case studies around the core problem, user insights, failed explorations, and measurable impact.',
      'During App Critique, focus on the user’s mental model, typography, and edge cases.'
    ],
    description: 'Product Design Intern at Figma creating core interface features and design systems for millions of designers.'
  },
  {
    id: 'seed-latham-legal-2027',
    title: 'Corporate Paralegal & Legal Operations Intern — Summer 2027',
    company: 'Latham & Watkins LLP',
    location: 'New York, NY / Washington, DC / Los Angeles, CA',
    workModel: 'Hybrid',
    type: 'Internship',
    season: 'Summer 2027',
    category: 'Legal & Compliance',
    source: 'CuratedFeed',
    url: 'https://www.lw.com/careers',
    salaryRange: '$30 – $38 / hr + 1.5x Overtime Eligible',
    daysAgo: 0,
    educationRequirements: 'Pursuing Bachelor’s in Political Science, Pre-Law, English, History, Philosophy, or Liberal Arts (Graduation: 2027–2028)',
    sponsorship: 'CPT / OPT Eligible',
    aboutCompany: 'Latham & Watkins LLP is a premier global law firm with over 3,500 attorneys advising top multinational corporations and financial institutions.',
    aboutTeam: 'You will support attorneys in Corporate Transactions, M&A due diligence, SEC filings, and litigation discovery management.',
    department: 'Corporate Transactions & Legal Operations',
    teamHighlights: [
      'Top 3 global law firm by revenue and prestige',
      'Direct exposure to multi-billion dollar M&A deals and IPO filings',
      'Premier pre-law mentorship and law school admissions guidance'
    ],
    responsibilities: [
      'Perform legal research and draft case briefings using Westlaw, LexisNexis, and SEC EDGAR.',
      'Assist in corporate due diligence reviews and organize electronic virtual data rooms (VDR).',
      'Draft and manage corporate governance resolutions, closing certificates, and signature packets.'
    ],
    requirements: [
      'Enrolled in Political Science, Pre-Law, English, History, or related Liberal Arts major.',
      'Meticulous reading comprehension, proofreading precision, and analytical writing.',
      'High ethical discretion with confidential attorney-client privilege materials.'
    ],
    preferredQualifications: [
      'Experience in pre-law societies, mock trial, legal clinics, or court administration.',
      'Familiarity with Westlaw, LexisNexis, or Bluebook legal citations.'
    ],
    skills: ['Legal Research (Westlaw)', 'Contract Due Diligence', 'Corporate Filings (SEC EDGAR)', 'Document Redlining', 'Bluebook Citation'],
    benefits: [
      '$30 – $38 / hr + 1.5x overtime pay',
      'Comprehensive healthcare and wellness benefits',
      'Pre-law speaker series and 1-on-1 mentorship from Latham Partners',
      'Strong recommendation for top law school admissions'
    ],
    interviewProcess: [
      'Stage 1: Application & Writing Sample Review',
      'Stage 2: Paralegal Manager Phone Screen (30 mins)',
      'Stage 3: Timed Proofreading & Legal Document Editing Test (45 mins)',
      'Stage 4: Virtual Panel with Corporate Associates (45 mins)'
    ],
    prepTips: [
      'Emphasize your proofreading accuracy and ability to catch subtle inconsistencies in complex documents.',
      'Understand basic corporate deal mechanics: NDAs, purchase agreements, and closing conditions.'
    ],
    description: 'Corporate Paralegal Intern at Latham & Watkins assisting attorneys on M&A diligence and regulatory corporate filings.'
  },
  {
    id: 'seed-northwood-2027',
    title: 'Software Engineer Intern — Satellite Ground Systems',
    company: 'Northwood Space',
    location: 'Torrance, CA (Greater Los Angeles)',
    workModel: 'On-site',
    type: 'Internship',
    season: 'Summer 2027',
    category: 'Hardware & Embedded',
    source: 'CuratedFeed',
    url: 'https://jobs.ashbyhq.com/NorthwoodSpace/ce3d4b73-461e-4128-a6f1-f933897e8119',
    salaryRange: '$48 – $58 / hr + Housing Assistance',
    daysAgo: 0,
    educationRequirements: 'B.S. or M.S. in Computer Science, Aerospace Engineering, or Computer Engineering graduating 2027–2028',
    sponsorship: 'U.S. Citizen / Permanent Resident (ITAR Compliance Required)',
    aboutCompany: 'Northwood Space is building a data highway between Earth and space, revolutionizing satellite ground architecture to solve the massive data backhaul bottleneck.',
    aboutTeam: 'You will join the Ground Station Software team writing bare-metal embedded control software, RF phased-array beamforming managers, and cloud-to-space orchestration systems.',
    department: 'Ground Station Architecture & Embedded Software',
    teamHighlights: [
      'Backed by top aerospace venture funds (Founders Fund, a16z)',
      'Direct hands-on experience interfacing with phased-array antenna hardware',
      'Fast-paced aerospace startup culture owning flight-critical software modules'
    ],
    responsibilities: [
      'Develop real-time embedded control software in C++20 and Rust for high-frequency antenna positioners.',
      'Write low-latency network telemetry streaming services in Python and Go to route satellite downlink data.',
      'Create hardware-in-the-loop (HIL) automated test benches and RF simulation environments.'
    ],
    requirements: [
      'Enrolled in B.S. or M.S. in Computer Science, Computer Engineering, or Aerospace Engineering.',
      'Proficiency in C++ or Rust with experience in systems-level programming.',
      'Solid grasp of multithreading, socket networking (UDP/TCP), and Linux device drivers.',
      'U.S. Citizenship or Permanent Residency (ITAR requirement).'
    ],
    preferredQualifications: [
      'Experience with Software Defined Radios (SDR), GNU Radio, or university CubeSat / Rocketry teams.',
      'Knowledge of telemetry protocols (CCSDS) or real-time operating systems (RTOS).'
    ],
    skills: ['C++', 'Rust', 'Python', 'Embedded Systems', 'Linux / OS', 'Socket Networking (UDP/TCP)', 'Signal Processing / DSP', 'Git'],
    benefits: [
      '$48 – $58 / hr competitive startup pay',
      'Housing stipend and relocation assistance to Greater Los Angeles',
      'Daily catered lunches near Manhattan Beach',
      'Direct mentorship from SpaceX and Palantir alumni engineers'
    ],
    interviewProcess: [
      'Stage 1: Technical Recruiter Screen (30 mins)',
      'Stage 2: Technical Phone Interview (45 mins: C++ systems & state machines)',
      'Stage 3: Practical Take-Home Project (Mock telemetry parser in C++/Rust - 2-3 hours)',
      'Stage 4: Superday Round 1 — Embedded Systems & Concurrency (60 mins)',
      'Stage 5: Superday Round 2 — Hardware/Software Interface Deep Dive (45 mins)'
    ],
    prepTips: [
      'Review low-level C++ concepts: pointer arithmetic, endianness, ring buffers, and interrupt handling.',
      'Highlight hands-on projects interfacing code with physical microcontrollers or RF antennas.'
    ],
    description: 'Embedded Software Engineer Intern at Northwood Space building bare-metal control systems and real-time satellite telemetry pipelines.'
  },
  {
    id: 'seed-intuit-2027',
    title: 'Software Engineer Intern — Full Stack & Cloud Platform',
    company: 'Intuit',
    location: 'Mountain View, CA / San Diego, CA',
    workModel: 'Hybrid',
    type: 'Internship',
    season: 'Summer 2027',
    category: 'Software Engineering',
    source: 'CuratedFeed',
    url: 'https://jobs.intuit.com/job/mountain-view/summer-2027-software-engineering-intern-full-stack',
    salaryRange: '$52 – $62 / hr + $10,000 Housing Stipend',
    daysAgo: 0,
    educationRequirements: 'Currently pursuing a B.S. or M.S. in Computer Science or related STEM field graduating Dec 2027 – June 2028',
    sponsorship: 'CPT / OPT Eligible & H-1B Sponsorship Available',
    aboutCompany: 'Intuit is the global financial technology platform that powers prosperity with TurboTax, QuickBooks, Mint, Credit Karma, and Mailchimp for 100M+ users.',
    aboutTeam: 'You will join the Core Financial Platform group developing resilient microservices, responsive web dashboards, and real-time financial intelligence pipelines.',
    department: 'Intuit Platform & Consumer Group',
    teamHighlights: [
      'Powers financial software used by 100+ million consumers and small businesses',
      'Pioneers in Kubernetes cloud infrastructure and generative AI financial agents',
      'Robust intern cohort program with designated executive sponsors'
    ],
    responsibilities: [
      'Design, code, and deploy resilient microservices in Java (Spring Boot) and Python for financial workflows.',
      'Build accessible, high-performance UI components using modern React, TypeScript, and Tailwind CSS.',
      'Write scalable database queries and data models backed by PostgreSQL, DynamoDB, and Redis caching.'
    ],
    requirements: [
      'Enrolled in Computer Science, Software Engineering, or related technical discipline.',
      'Strong programming proficiency in Java, Python, or TypeScript/JavaScript.',
      'Solid understanding of Data Structures, Algorithms, OOP Design, and RESTful API patterns.'
    ],
    preferredQualifications: [
      'Experience with React, Next.js, Node.js, Spring Boot, or AWS cloud services.',
      'Familiarity with containerization (Docker, Kubernetes) and CI/CD pipelines.'
    ],
    skills: ['Java', 'Spring Boot', 'TypeScript', 'React', 'Python', 'PostgreSQL', 'Docker', 'AWS', 'REST APIs', 'Git'],
    benefits: [
      '$52 – $62 / hr competitive hourly base rate',
      '$10,000 lump-sum housing stipend or furnished housing',
      'Roundtrip relocation flights covered',
      'Full healthcare, dental, and vision insurance coverage'
    ],
    interviewProcess: [
      'Stage 1: Karat Technical Assessment (60 mins: Coding + System Design fundamentals)',
      'Stage 2: Virtual Onsite Round 1 — Live Coding & Problem Solving (60 mins)',
      'Stage 3: Virtual Onsite Round 2 — Values, Innovation & Culture Fit (45 mins)'
    ],
    prepTips: [
      'Practice clean OOP design in Java or Python and LeetCode Medium data structure problems.',
      'Review REST API conventions, HTTP methods, status codes, and database normalization.'
    ],
    description: 'Full-stack software engineering intern at Intuit building customer-facing financial platforms and resilient backend services.'
  }
];

// ─── Dynamic Job Enrichment Engine ──────────────────────────────────────────

export function enrichJobDetails(raw: Partial<JobPosting>, source?: GitHubRepoSource): JobPosting {
  const title = raw.title || 'Professional Role';
  const company = raw.company || 'Enterprise Organization';
  const location = raw.location || 'United States';
  const category = raw.category || inferCategory(title, source?.category || 'Software Engineering');
  const type = raw.type || (title.toLowerCase().includes('new grad') || title.toLowerCase().includes('full-time') ? 'New Grad' : 'Internship');
  const season = raw.season || source?.season || (type === 'New Grad' ? 'New Grad 2026' : 'Summer 2027');
  const daysAgo = raw.daysAgo ?? 0;
  const url = raw.url || 'https://github.com/SimplifyJobs/Summer2027-Internships';

  const locLower = location.toLowerCase();
  let workModel: 'Remote' | 'Hybrid' | 'On-site' = 'Hybrid';
  if (locLower.includes('remote')) workModel = 'Remote';
  else if (locLower.includes('on-site') || locLower.includes('onsite')) workModel = 'On-site';

  let salaryRange = raw.salaryRange;
  if (!salaryRange) {
    if (category === 'Finance & Quant') {
      salaryRange = type === 'New Grad' ? '$175,000 – $225,000 / yr + Bonus' : '$100 – $140 / hr + Housing';
    } else if (category === 'Business & Strategy') {
      salaryRange = type === 'New Grad' ? '$110,000 – $140,000 / yr + Bonus' : '$45 – $58 / hr + Housing';
    } else if (category === 'Finance & Accounting') {
      salaryRange = type === 'New Grad' ? '$105,000 – $135,000 / yr + Bonus' : '$45 – $60 / hr + Housing';
    } else if (category === 'Marketing & Communications') {
      salaryRange = type === 'New Grad' ? '$85,000 – $115,000 / yr + Bonus' : '$35 – $48 / hr + Housing';
    } else if (category === 'Humanities & Social Sciences') {
      salaryRange = type === 'New Grad' ? '$70,000 – $95,000 / yr' : '$25 – $45 / hr + Stipend';
    } else if (category === 'Policy & Non-Profit') {
      salaryRange = type === 'New Grad' ? '$65,000 – $90,000 / yr' : '$25 – $35 / hr + Stipend';
    } else if (category === 'Operations & HR') {
      salaryRange = type === 'New Grad' ? '$90,000 – $120,000 / yr' : '$40 – $55 / hr + Housing';
    } else if (category === 'Design & Creative' || category === 'Design') {
      salaryRange = type === 'New Grad' ? '$115,000 – $145,000 / yr + Equity' : '$45 – $60 / hr + Housing';
    } else if (category === 'Legal & Compliance') {
      salaryRange = type === 'New Grad' ? '$80,000 – $110,000 / yr' : '$28 – $40 / hr + Overtime';
    } else if (category === 'Data & AI') {
      salaryRange = type === 'New Grad' ? '$150,000 – $185,000 / yr + Equity' : '$60 – $75 / hr + Housing';
    } else if (category === 'Product Management') {
      salaryRange = type === 'New Grad' ? '$130,000 – $160,000 / yr + Equity' : '$50 – $65 / hr + Housing';
    } else {
      salaryRange = type === 'New Grad' ? '$135,000 – $165,000 / yr + Equity' : '$50 – $65 / hr + Housing';
    }
  }

  let aboutCompany = raw.aboutCompany;
  let aboutTeam = raw.aboutTeam;
  let responsibilities = raw.responsibilities;
  let requirements = raw.requirements;
  let preferredQualifications = raw.preferredQualifications;
  let skills = raw.skills;
  let benefits = raw.benefits;
  let educationRequirements = raw.educationRequirements;
  let sponsorship = raw.sponsorship || 'CPT / OPT Eligible & H-1B Sponsorship Available';
  let interviewProcess = raw.interviewProcess;
  let prepTips = raw.prepTips;
  let teamHighlights = raw.teamHighlights;

  if (!aboutCompany) {
    aboutCompany = `${company} is a premier organization driving industry innovation, high-impact strategies, and customer-delighting solutions at scale.`;
  }

  if (category === 'Business & Strategy') {
    if (!aboutTeam) {
      aboutTeam = `You will join the Strategy, Management Consulting, and Business Operations group at ${company}, structuring ambiguous business challenges, conducting market due diligence, and partnering with executive leadership to accelerate growth.`;
    }
    if (!responsibilities) {
      responsibilities = [
        `Structure complex strategic and operational business problems into hypothesis-driven issue trees and analytical work plans.`,
        `Conduct quantitative market sizing, financial modeling, pricing elasticity, and competitor benchmarking.`,
        `Synthesize qualitative industry interviews and research insights into high-impact executive presentation decks.`,
        `Partner with cross-functional stakeholders to define business transformation roadmaps and key performance metrics.`
      ];
    }
    if (!requirements) {
      requirements = [
        `Enrolled in an undergraduate or master’s program in Business, Economics, Humanities, Social Sciences, or STEM.`,
        `Strong structured problem-solving, quantitative reasoning, and business acumen.`,
        `Exceptional written and oral presentation skills with ability to influence leadership stakeholders.`
      ];
    }
    if (!preferredQualifications) {
      preferredQualifications = [
        `Prior consulting, strategy, investment banking, or high-growth startup internship experience.`,
        `Advanced proficiency in Excel modeling and executive slide design.`
      ];
    }
    if (!skills) {
      skills = ['Management Consulting', 'Problem Structuring', 'Market Sizing', 'Financial Modeling', 'Executive Storytelling', 'Excel', 'PowerPoint', 'Strategy'];
    }
    if (!interviewProcess) {
      interviewProcess = [
        `Stage 1: Online Problem Solving / Numerical Assessment (45-60 mins)`,
        `Stage 2: Round 1 Strategy & Profitability Case Interview (45 mins)`,
        `Stage 3: Final Round Partner Superday Case & Leadership Interview (2x 45 mins)`
      ];
    }
    if (!prepTips) {
      prepTips = [
        `Practice MECE (Mutually Exclusive, Collectively Exhaustive) structuring on business case studies.`,
        `Prepare 3-4 structured STAR leadership stories highlighting personal initiative and quantitative results.`
      ];
    }
  } else if (category === 'Finance & Accounting') {
    if (!aboutTeam) {
      aboutTeam = `You will join the Financial Analysis, Corporate Banking, and Accounting advisory team at ${company}, managing capital structure modeling, financial statement reviews, and strategic forecasting.`;
    }
    if (!responsibilities) {
      responsibilities = [
        `Build and maintain dynamic financial models including 3-statement forecasts, DCF valuations, and variance analyses.`,
        `Review balance sheets, cash flows, and income statements in compliance with US GAAP / IFRS standards.`,
        `Prepare executive management reporting packages and investor presentation decks.`,
        `Perform financial due diligence, audit testing, and cost optimization scenario analyses.`
      ];
    }
    if (!requirements) {
      requirements = [
        `Pursuing a degree in Finance, Accounting, Economics, or related quantitative business discipline.`,
        `Solid understanding of corporate accounting, financial statements, and financial metrics.`,
        `Advanced proficiency in Microsoft Excel (pivot tables, financial modeling formulas).`
      ];
    }
    if (!preferredQualifications) {
      preferredQualifications = [
        `Experience with financial analytics tools (Bloomberg, FactSet, PowerBI, Capital IQ).`,
        `Progress towards CPA, CFA, or prior accounting/banking internship experience.`
      ];
    }
    if (!skills) {
      skills = ['Financial Modeling', '3-Statement Accounting', 'DCF Valuation', 'FP&A Forecasting', 'US GAAP', 'Excel (Advanced)', 'PowerBI', 'PowerPoint'];
    }
    if (!interviewProcess) {
      interviewProcess = [
        `Stage 1: Numerical Reasoning & Accounting Basics Video Screen (30 mins)`,
        `Stage 2: Technical Phone Screen: Financial Statements & Valuation (45 mins)`,
        `Stage 3: Final Virtual Superday Interviews (2x 45 mins: Deal/Financial Case & Culture Fit)`
      ];
    }
    if (!prepTips) {
      prepTips = [
        `Understand the linkages between Income Statement, Cash Flow, and Balance Sheet.`,
        `Be prepared to explain how changes in working capital, depreciation, or debt impact free cash flow.`
      ];
    }
  } else if (category === 'Marketing & Communications') {
    if (!aboutTeam) {
      aboutTeam = `You will join the Brand Strategy, Product Marketing, and Public Relations team at ${company}, crafting compelling omnichannel narratives and data-driven marketing campaigns that resonate with millions of consumers.`;
    }
    if (!responsibilities) {
      responsibilities = [
        `Develop creative marketing campaign briefs across digital, social, retail, and experiential channels.`,
        `Analyze consumer insights, media spend efficiency (ROAS), and audience engagement metrics.`,
        `Draft press releases, executive talking points, and thought leadership articles for media distribution.`,
        `Collaborate with creative agencies, designers, and product teams to drive go-to-market (GTM) launches.`
      ];
    }
    if (!requirements) {
      requirements = [
        `Enrolled in Marketing, Communications, PR, Journalism, English, or related Liberal Arts field.`,
        `Outstanding written and visual storytelling skills with strong creative intuition.`,
        `Ability to interpret consumer data and social analytics into actionable marketing strategies.`
      ];
    }
    if (!preferredQualifications) {
      preferredQualifications = [
        `Experience managing social media channels, campus PR, or digital marketing campaigns.`,
        `Familiarity with marketing tools (Google Analytics, Meta Ads, Cision, Figma).`
      ];
    }
    if (!skills) {
      skills = ['Brand Strategy', 'Consumer Insights', 'Digital Marketing', 'Public Relations', 'Copywriting', 'Campaign Analytics', 'Media Pitching', 'Social Media'];
    }
    if (!interviewProcess) {
      interviewProcess = [
        `Stage 1: Portfolio & Writing Sample Review`,
        `Stage 2: Marketing Strategy Screen (45 mins: Brand pitch and campaign breakdown)`,
        `Stage 3: Final Panel Presentation (60 mins: Pitch a marketing launch strategy)`
      ];
    }
    if (!prepTips) {
      prepTips = [
        `Prepare 2-3 examples of successful brand campaigns and analyze why their storytelling succeeded.`,
        `Demonstrate understanding of how to balance creative brand resonance with quantitative conversion metrics.`
      ];
    }
  } else if (category === 'Humanities & Social Sciences') {
    if (!aboutTeam) {
      aboutTeam = `You will join the Research, Editorial, and Human-Centered Insight team at ${company}, conducting qualitative inquiry, archival/editorial analysis, and ethnographic research to illuminate complex human behaviors and cultural contexts.`;
    }
    if (!responsibilities) {
      responsibilities = [
        `Conduct in-depth qualitative research, primary source evaluations, and semi-structured stakeholder interviews.`,
        `Write and edit polished research reports, editorial manuscripts, or didactic exhibition materials.`,
        `Synthesize complex historical, literary, or behavioral findings into accessible frameworks for broad audiences.`,
        `Collaborate with cross-functional teams to integrate humanistic perspectives into core organizational initiatives.`
      ];
    }
    if (!requirements) {
      requirements = [
        `Pursuing a degree in English, History, Literature, Psychology, Sociology, Anthropology, Art History, or related Humanities discipline.`,
        `Exceptional critical reading, investigative research, and analytical writing skills.`,
        `High empathy, intellectual curiosity, and rigorous attention to source citation and factual accuracy.`
      ];
    }
    if (!preferredQualifications) {
      preferredQualifications = [
        `Published writing samples, undergraduate thesis research, or student publication experience.`,
        `Familiarity with qualitative analysis tools (Dovetail, NVivo) or museum/archival collection databases.`
      ];
    }
    if (!skills) {
      skills = ['Qualitative Research', 'Critical Analysis', 'Editorial Writing', 'Primary Source Archiving', 'Human-Centered Insights', 'Synthesis & Storytelling'];
    }
    if (!interviewProcess) {
      interviewProcess = [
        `Stage 1: Writing Sample & Portfolio Review`,
        `Stage 2: In-Depth Research & Methodology Discussion (45 mins)`,
        `Stage 3: Practical Writing or Qualitative Analysis Exercise (60 mins)`,
        `Stage 4: Final Conversational Interview with Team Leads (45 mins)`
      ];
    }
    if (!prepTips) {
      prepTips = [
        `Highlight how your qualitative humanities training enables you to uncover non-obvious human motivations.`,
        `Provide writing samples demonstrating depth of inquiry, clear structure, and engaging narrative prose.`
      ];
    }
  } else if (category === 'Policy & Non-Profit') {
    if (!aboutTeam) {
      aboutTeam = `You will join the Public Policy, Non-Profit Advocacy, and Governance team at ${company}, analyzing legislative proposals, conducting nonpartisan empirical research, and crafting policy recommendations for societal impact.`;
    }
    if (!responsibilities) {
      responsibilities = [
        `Track, synthesize, and analyze federal and state legislation, administrative rulings, and regulatory filings.`,
        `Conduct empirical policy analysis using government databases (Census, BLS, OECD) and academic literature.`,
        `Draft concise policy briefing memos, fact sheets, Congressional testimony summaries, and coalition letters.`,
        `Engage with community partners, advocacy coalitions, and research fellows on public interest initiatives.`
      ];
    }
    if (!requirements) {
      requirements = [
        `Enrolled in Public Policy, Political Science, International Relations, Economics, Pre-Law, or related Social Science program.`,
        `Strong research writing skills with ability to formulate actionable, evidence-based policy solutions.`,
        `Commitment to rigorous empirical inquiry and public interest advancement.`
      ];
    }
    if (!preferredQualifications) {
      preferredQualifications = [
        `Prior experience in legislative offices, government agencies, non-profits, or think tanks.`,
        `Working knowledge of statistical data tools (R, Stata, Python, or Excel for policy analysis).`
      ];
    }
    if (!skills) {
      skills = ['Public Policy Analysis', 'Legislative Tracking', 'Policy Memo Writing (BLUF)', 'Advocacy Strategy', 'Empirical Research', 'Coalition Building'];
    }
    if (!interviewProcess) {
      interviewProcess = [
        `Stage 1: Policy Writing Sample Review`,
        `Stage 2: Policy Analyst Phone Screen (30 mins)`,
        `Stage 3: Timed Policy Briefing Memo Exercise (60 mins)`,
        `Stage 4: Panel Interview with Policy Directors (45 mins)`
      ];
    }
    if (!prepTips) {
      prepTips = [
        `Practice writing policy briefs using the Bottom Line Up Front (BLUF) format with clear recommendations.`,
        `Stay well-versed on contemporary policy debates and statutory interpretation frameworks.`
      ];
    }
  } else if (category === 'Operations & HR') {
    if (!aboutTeam) {
      aboutTeam = `You will join the Global Operations, People Strategy, and Supply Chain group at ${company}, optimizing organizational efficiency, workforce talent programs, and worldwide logistics networks.`;
    }
    if (!responsibilities) {
      responsibilities = [
        `Develop quantitative demand forecasts, inventory buffer models, and supply chain capacity plans.`,
        `Analyze employee engagement, retention metrics, and talent development pipelines using data tools.`,
        `Partner with operational leaders and vendors to resolve logistics bottlenecks and streamline workflows.`,
        `Present process improvement recommendations and workforce strategies to department directors.`
      ];
    }
    if (!requirements) {
      requirements = [
        `Enrolled in Supply Chain, Operations, Human Resources, Business, Industrial Engineering, or Psychology.`,
        `Strong quantitative modeling and data analysis capabilities (Excel, SQL, basic statistics).`,
        `Excellent cross-functional negotiation, empathy, and interpersonal communication skills.`
      ];
    }
    if (!preferredQualifications) {
      preferredQualifications = [
        `Experience with Lean Six Sigma, SQL, Tableau, or people analytics frameworks.`,
        `Prior operations, HR, or procurement internship experience.`
      ];
    }
    if (!skills) {
      skills = ['Supply Chain Management', 'People Analytics', 'Process Optimization', 'Demand Forecasting', 'Talent Strategy', 'SQL / Excel', 'Vendor Negotiations'];
    }
    if (!interviewProcess) {
      interviewProcess = [
        `Stage 1: Recruiter Phone Alignment (30 mins)`,
        `Stage 2: Quantitative Operations / HR Scenario Screen (45 mins)`,
        `Stage 3: Virtual Onsite Round 1 — Operational Case & Data Modeling (60 mins)`,
        `Stage 4: Virtual Onsite Round 2 — Collaboration & Values Alignment (45 mins)`
      ];
    }
    if (!prepTips) {
      prepTips = [
        `Review operational math (Little’s Law, capacity analysis) or data-driven people management frameworks (Project Aristotle).`,
        `Prepare structured examples of how you identified a process bottleneck and implemented a measurable fix.`
      ];
    }
  } else if (category === 'Design & Creative' || category === 'Design') {
    if (!aboutTeam) {
      aboutTeam = `You will join the Product Design and User Experience Studio at ${company}, crafting human-centered interfaces, interaction design systems, and delightful digital experiences.`;
    }
    if (!responsibilities) {
      responsibilities = [
        `Design intuitive user interface wireframes, interactive prototypes, and production-ready visual specifications.`,
        `Maintain and scale comprehensive design systems, component libraries, and design tokens in Figma.`,
        `Conduct usability testing sessions, synthesize feedback, and iterate rapidly on interaction flows.`,
        `Partner with Engineers and Product Managers to ensure accessible (WCAG), pixel-perfect implementation.`
      ];
    }
    if (!requirements) {
      requirements = [
        `Pursuing a degree in Product Design, HCI, Graphic Design, Interaction Design, or related creative discipline.`,
        `Compelling design portfolio showcasing human-centered problem solving and strong visual craft.`,
        `Proficiency in Figma (auto-layout, components, interactive prototyping) and design systems.`
      ];
    }
    if (!preferredQualifications) {
      preferredQualifications = [
        `Understanding of frontend web constraints (HTML/CSS/JS) and accessibility standards.`,
        `Experience with motion design, micro-interactions, or 3D prototyping tools.`
      ];
    }
    if (!skills) {
      skills = ['Product Design', 'UI / UX Design', 'Figma (Auto-Layout / Variables)', 'Design Systems', 'Interactive Prototyping', 'Usability Testing', 'Design Thinking'];
    }
    if (!interviewProcess) {
      interviewProcess = [
        `Stage 1: Portfolio & Case Study Review`,
        `Stage 2: 1-on-1 Portfolio Deep Dive (60 mins)`,
        `Stage 3: Live App Critique (45 mins: Evaluate UX affordance and hierarchy)`,
        `Stage 4: Collaborative Whiteboard Design Session (60 mins)`
      ];
    }
    if (!prepTips) {
      prepTips = [
        `Structure portfolio case studies around the problem statement, user research, iterative failed explorations, and measurable impact.`,
        `During App Critiques, focus on user mental models, hierarchy, accessibility, and delight.`
      ];
    }
  } else if (category === 'Legal & Compliance') {
    if (!aboutTeam) {
      aboutTeam = `You will join the Legal Operations and Corporate Regulatory team at ${company}, supporting corporate counsel in M&A diligence, regulatory compliance reviews, contract administration, and legal research.`;
    }
    if (!responsibilities) {
      responsibilities = [
        `Conduct legal research and draft case briefings using Westlaw, LexisNexis, and SEC EDGAR databases.`,
        `Assist in corporate due diligence, organizing virtual data rooms and reviewing commercial contracts.`,
        `Draft and manage corporate governance filings, compliance logs, and signature packet distributions.`,
        `Review documents for statutory compliance and regulatory reporting deadlines.`
      ];
    }
    if (!requirements) {
      requirements = [
        `Pursuing a Bachelor’s in Political Science, Pre-Law, English, History, Philosophy, or Liberal Arts.`,
        `Meticulous proofreading precision, analytical reading comprehension, and clear written communication.`,
        `High ethical discretion and confidentiality with sensitive corporate and legal materials.`
      ];
    }
    if (!preferredQualifications) {
      preferredQualifications = [
        `Prior experience at a law firm, corporate legal department, pre-law clinic, or court clerk office.`,
        `Familiarity with Bluebook citation, Westlaw, or corporate contract lifecycle tools.`
      ];
    }
    if (!skills) {
      skills = ['Legal Research', 'Contract Due Diligence', 'Corporate Governance', 'Regulatory Compliance', 'Document Redlining', 'Bluebook Citation'];
    }
    if (!interviewProcess) {
      interviewProcess = [
        `Stage 1: Writing Sample & Resume Review`,
        `Stage 2: Legal Operations Screen (30 mins)`,
        `Stage 3: Timed Proofreading & Legal Document Editing Test (45 mins)`,
        `Stage 4: Panel Interview with Corporate Counsel (45 mins)`
      ];
    }
    if (!prepTips) {
      prepTips = [
        `Emphasize your rigorous attention to detail and proofreading methodology.`,
        `Understand standard corporate legal transactions such as NDAs, commercial agreements, and closing conditions.`
      ];
    }
  } else if (category === 'Data & AI') {
    if (!aboutTeam) {
      aboutTeam = `You will join the Applied AI and Machine Learning Engineering team at ${company}, designing scalable inference architectures, LLM agent pipelines, and high-throughput data systems.`;
    }
    if (!responsibilities) {
      responsibilities = [
        `Architect and deploy low-latency machine learning inference microservices in Python (FastAPI/gRPC) and Docker.`,
        `Build end-to-end data ingestion pipelines, vector indexing, and retrieval-augmented generation (RAG) workflows.`,
        `Fine-tune, benchmark, and evaluate generative AI models for latency, safety, and output accuracy.`,
        `Collaborate with full-stack engineers to integrate AI models seamlessly into ${company}'s production applications.`,
        `Write comprehensive automated test suites and participate in CI/CD pipeline automation on cloud infrastructure (AWS/GCP).`
      ];
    }
    if (!requirements) {
      requirements = [
        `Enrolled in a B.S., M.S., or Ph.D. in Computer Science, Data Science, AI/ML, or related STEM discipline.`,
        `Strong proficiency in Python with solid foundations in Data Structures, Algorithms, and Object-Oriented Programming.`,
        `Hands-on experience with modern ML frameworks such as PyTorch, TensorFlow, or Hugging Face.`,
        `Working knowledge of SQL, relational databases (PostgreSQL), and Git version control.`
      ];
    }
    if (!preferredQualifications) {
      preferredQualifications = [
        `Experience with LLM orchestration (LangChain, LlamaIndex), vector databases (Pinecone, Qdrant), or vLLM.`,
        `Knowledge of distributed GPU training/inference (CUDA, Triton, DeepSpeed) or cloud deployment (AWS/GCP).`,
        `Open-source contributions or personal full-stack AI projects demonstrated on GitHub.`
      ];
    }
    if (!skills) {
      skills = ['Python', 'PyTorch', 'FastAPI', 'PostgreSQL', 'LLMs / Agents', 'Vector DBs / RAG', 'Docker', 'AWS', 'Git', 'Data Pipelines'];
    }
    if (!interviewProcess) {
      interviewProcess = [
        `Stage 1: Online Technical Assessment (Python Data Structures & ML Algorithms - 70 mins)`,
        `Stage 2: Technical Phone Screen: Live Coding & Concurrency (45 mins)`,
        `Stage 3: Virtual Onsite Round 1 — Practical ML Systems & RAG Architecture (60 mins)`,
        `Stage 4: Virtual Onsite Round 2 — Problem Solving & Coding Optimization (60 mins)`,
        `Stage 5: Values, Past Projects & Behavioral Alignment (45 mins)`
      ];
    }
    if (!prepTips) {
      prepTips = [
        `Focus on Python asynchronous programming, transformer architectures, and vector search mechanics.`,
        `Be prepared to walk through an end-to-end ML project you built from data ingestion to model deployment.`
      ];
    }
  } else if (category === 'Finance & Quant') {
    if (!aboutTeam) {
      aboutTeam = `You will join the Quantitative Engineering and Trading Infrastructure group at ${company}, developing ultra-low latency execution engines, market data handlers, and mathematical risk management systems.`;
    }
    if (!responsibilities) {
      responsibilities = [
        `Develop high-performance, nanosecond-tier trading components and order execution engines in modern C++20 and Python.`,
        `Build scalable historical simulation and backtesting pipelines processing petabytes of tick-level order book data.`,
        `Optimize CPU cache locality, memory allocation, multithreaded synchronization, and low-latency network sockets.`,
        `Partner with quantitative researchers to implement mathematical signals and algorithmic trading strategies.`
      ];
    }
    if (!requirements) {
      requirements = [
        `Pursuing B.S., M.S., or Ph.D. in Computer Science, Mathematics, Physics, Financial Engineering, or Electrical Engineering.`,
        `Exceptional programming proficiency in modern C++ (C++17/20) or Python with deep knowledge of memory management.`,
        `Strong grasp of Operating Systems internals, CPU caching, concurrency primitives, and algorithmic complexity.`
      ];
    }
    if (!preferredQualifications) {
      preferredQualifications = [
        `Competitive programming background (ICPC, Codeforces, USACO) or Math Olympiad experience.`,
        `Knowledge of Linux kernel profiling (perf, valgrind, gdb) and low-latency network protocols.`
      ];
    }
    if (!skills) {
      skills = ['C++', 'Python', 'Low Latency Systems', 'Multithreading', 'Linux / OS', 'SQL', 'Algorithms', 'Distributed Systems', 'Git'];
    }
    if (!interviewProcess) {
      interviewProcess = [
        `Stage 1: Automated Coding Challenge (Hard Algorithms, C++ Pointers, Concurrency - 90 mins)`,
        `Stage 2: Technical Phone Screen with Senior Quant Developer (60 mins)`,
        `Stage 3: Superday Round 1 — OS Internals & Systems Deep Dive (60 mins)`,
        `Stage 4: Superday Round 2 — Live Algorithmic Optimization & C++ Memory (60 mins)`,
        `Stage 5: Superday Round 3 — Probability, Mental Math & Strategy Discussion (60 mins)`
      ];
    }
    if (!prepTips) {
      prepTips = [
        `Master C++ object layout, virtual tables, cache-line alignment, and lock-free synchronization.`,
        `Review classic probability puzzles (Bayes theorem, expected value, Markov chains) and LeetCode Hard graph problems.`
      ];
    }
  } else if (category === 'Product Management') {
    if (!aboutTeam) {
      aboutTeam = `You will join the Product Management team at ${company}, leading product vision, feature scoping, and customer-centric design across cross-functional engineering and UX teams.`;
    }
    if (!responsibilities) {
      responsibilities = [
        `Define product vision, customer user stories, and comprehensive Product Requirement Documents (PRDs).`,
        `Analyze quantitative telemetry data and user behavior funnels using SQL to identify product growth opportunities.`,
        `Conduct user research, customer interviews, and usability tests to validate product hypotheses.`,
        `Partner daily with Software Engineers, Designers, and Data Analysts to run agile sprints and deliver on roadmaps.`
      ];
    }
    if (!requirements) {
      requirements = [
        `Enrolled in an undergraduate or graduate degree program (CS, HCI, Business, or STEM preferred).`,
        `Strong analytical problem-solving skills, data literacy (SQL), and exceptional communication abilities.`,
        `Demonstrated leadership through campus organizations, student startups, or hackathons.`
      ];
    }
    if (!preferredQualifications) {
      preferredQualifications = [
        `Previous product management, consulting, or technical software development experience.`,
        `Experience with user journey wireframing (Figma) and metric tracking tools.`
      ];
    }
    if (!skills) {
      skills = ['Product Strategy', 'User Research', 'A/B Testing', 'SQL', 'Data Analytics', 'Wireframing', 'Agile / Scrum', 'Roadmapping'];
    }
    if (!interviewProcess) {
      interviewProcess = [
        `Stage 1: Recruiter Phone Screen & Resume Walkthrough (30 mins)`,
        `Stage 2: Product Design & User Sense Interview (45 mins)`,
        `Stage 3: Analytical & Metric Estimation Round (45 mins)`,
        `Stage 4: Leadership & Behavioral Alignment (45 mins)`
      ];
    }
    if (!prepTips) {
      prepTips = [
        `Structure product design answers with the CIRCLES framework: User personas -> Needs -> Prioritization -> Solutions -> Metrics.`,
        `Prepare 3-4 detailed STAR stories showing how you resolved cross-functional conflicts with data.`
      ];
    }
  } else if (category === 'Hardware & Embedded') {
    if (!aboutTeam) {
      aboutTeam = `You will join the Hardware & Embedded Systems Engineering team at ${company}, developing bare-metal firmware, sensor interfaces, and PCB architecture for cutting-edge physical devices.`;
    }
    if (!responsibilities) {
      responsibilities = [
        `Write low-level firmware in C and modern C++ for microcontrollers and embedded processors.`,
        `Design and test digital communication protocols (I2C, SPI, UART, CAN, Ethernet).`,
        `Perform hardware-in-the-loop (HIL) testing using oscilloscopes, logic analyzers, and signal generators.`,
        `Collaborate with mechanical, electrical, and software teams on system bring-up and qualification.`
      ];
    }
    if (!requirements) {
      requirements = [
        `Enrolled in Computer Engineering, Electrical Engineering, Aerospace Engineering, or Computer Science.`,
        `Proficiency in C or C++ for embedded systems with knowledge of memory safety and real-time constraints.`,
        `Solid understanding of digital circuits, microcontroller peripherals, and hardware schematics.`
      ];
    }
    if (!preferredQualifications) {
      preferredQualifications = [
        `Experience with RTOS (FreeRTOS, Zephyr), FPGA design (Verilog/VHDL), or PCB design (KiCad, Altium).`,
        `Participation in robotics clubs, Formula SAE, CubeSat teams, or IoT projects.`
      ];
    }
    if (!skills) {
      skills = ['C', 'C++', 'Embedded Systems', 'RTOS', 'Microcontrollers (ARM/STM32)', 'I2C / SPI / UART', 'Linux / OS', 'Git', 'Hardware Debugging'];
    }
    if (!interviewProcess) {
      interviewProcess = [
        `Stage 1: Embedded Technical Screen (45 mins: Bitwise math, pointers, interrupt handlers)`,
        `Stage 2: Practical Coding / Take-Home Challenge (Embedded state machine & driver)`,
        `Stage 3: Onsite Round 1 — Embedded Concurrency & Memory Constraints (60 mins)`,
        `Stage 4: Onsite Round 2 — Hardware Schematic & Bring-up Troubleshooting (45 mins)`
      ];
    }
    if (!prepTips) {
      prepTips = [
        `Review C bit manipulation (masks, shifts), volatile keywords, interrupt service routines (ISRs), and memory layout.`,
        `Be prepared to walk through how you debug hardware glitches using oscilloscopes and logic analyzers.`
      ];
    }
  } else {
    // Default Software Engineering
    if (!aboutTeam) {
      aboutTeam = `You will join the Core Software Engineering team at ${company}, building scalable distributed systems, resilient microservices, and modern web/mobile interfaces.`;
    }
    if (!responsibilities) {
      responsibilities = [
        `Design, write, and deploy clean, maintainable microservices and REST APIs using modern programming languages.`,
        `Build responsive, accessible frontend interfaces or scalable backend data processing pipelines.`,
        `Optimize database queries, schema designs, and caching layers in PostgreSQL and Redis.`,
        `Write robust automated unit and integration tests, participating in code reviews and CI/CD automation.`
      ];
    }
    if (!requirements) {
      requirements = [
        `Pursuing a B.S. or M.S. in Computer Science, Software Engineering, or related technical discipline.`,
        `Strong foundational mastery of Data Structures, Algorithms, Concurrency, and Object-Oriented Design.`,
        `Hands-on coding experience in at least one modern language: Python, TypeScript/JavaScript, Go, Java, or C++.`,
        `Familiarity with SQL databases, Git version control, and Linux fundamentals.`
      ];
    }
    if (!preferredQualifications) {
      preferredQualifications = [
        `Prior software engineering internship experience or demonstrated impactful full-stack personal projects.`,
        `Familiarity with Docker, cloud infrastructure (AWS/GCP), and modern web frameworks (React, Next.js, Node.js).`
      ];
    }
    if (!skills) {
      skills = ['Python', 'TypeScript', 'React', 'Go (Golang)', 'PostgreSQL', 'REST APIs', 'Docker', 'AWS', 'Git', 'Unit Testing'];
    }
    if (!interviewProcess) {
      interviewProcess = [
        `Stage 1: Online Technical Coding Assessment (HackerRank / CodeSignal - 60-70 mins)`,
        `Stage 2: Technical Phone Screen: Live Data Structures & Algorithms Problem Solving (45 mins)`,
        `Stage 3: Virtual Onsite Round 1 — Practical Coding & Edge Cases (60 mins)`,
        `Stage 4: Virtual Onsite Round 2 — System Architecture & Component Design (60 mins)`,
        `Stage 5: Values, Team Fit & Project Deep Dive (45 mins)`
      ];
    }
    if (!prepTips) {
      prepTips = [
        `Practice writing clean, modular code with descriptive variable names and edge-case unit tests.`,
        `Master LeetCode Medium data structures: Hash Maps, Trees, Graphs, Two Pointers, and Dynamic Programming.`
      ];
    }
  }

  if (!educationRequirements) {
    if (category === 'Business & Strategy' || category === 'Finance & Accounting' || category === 'Marketing & Communications' || category === 'Humanities & Social Sciences' || category === 'Policy & Non-Profit' || category === 'Legal & Compliance' || category === 'Operations & HR') {
      educationRequirements = type === 'New Grad'
        ? 'Bachelor’s or Master’s degree in Business, Humanities, Social Sciences, Economics, or related discipline graduating in 2026'
        : 'Currently enrolled in Bachelor’s or Master’s in Business, Humanities, Social Sciences, Economics, or related discipline graduating Dec 2026 – June 2028';
    } else {
      educationRequirements = type === 'New Grad'
        ? 'B.S., M.S., or Ph.D. in Computer Science or related STEM field graduating in 2026'
        : 'Currently enrolled in B.S., M.S., or Ph.D. in Computer Science or related STEM field graduating Dec 2026 – June 2028';
    }
  }

  if (!benefits) {
    benefits = [
      `Competitive market compensation (${salaryRange})`,
      type === 'Internship' ? `Furnished corporate housing or lump-sum monthly housing stipend` : `Comprehensive health, dental, and vision insurance with 100% employer match`,
      `Roundtrip relocation assistance and travel reimbursement`,
      `Dedicated 1-on-1 mentorship from Senior leaders and manager`,
      `Daily catered gourmet meals, snacks, and home office workstation budget`
    ];
  }

  if (!teamHighlights) {
    teamHighlights = [
      `Direct production impact on real company initiatives from week one`,
      `Pairs every team member with a dedicated mentor and development sponsor`,
      `Strong track record of full-time return offers and accelerated career growth`
    ];
  }

  const id = raw.id || `gh-${company.toLowerCase().replace(/[^a-z0-9]/g, '')}-${title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20)}-${Math.random().toString(36).slice(2, 6)}`;

  return {
    id,
    title,
    company,
    location,
    workModel,
    type,
    season,
    category,
    source: raw.source || 'CuratedFeed',
    url,
    salaryRange,
    daysAgo,
    aboutCompany,
    aboutTeam,
    responsibilities,
    requirements,
    preferredQualifications,
    skills,
    benefits,
    educationRequirements,
    sponsorship,
    interviewProcess,
    prepTips,
    teamHighlights,
    description: raw.description || `${title} at ${company} (${location}). ${aboutTeam}`
  };
}

// ─── HTML Table Parser ────────────────────────────────────────────────────────

function stripHtmlTags(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, ', ')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#?\w+;/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function extractHref(html: string): string | null {
  const m = html.match(/href="([^"]+)"/);
  return m ? m[1] : null;
}

function extractInnerText(tdHtml: string): string {
  const detailsContent = tdHtml.match(/<details[^>]*>.*?<\/summary>([\s\S]*?)<\/details>/i);
  if (detailsContent) {
    return stripHtmlTags(detailsContent[1]).split(',').map(s => s.trim()).filter(Boolean).join(', ');
  }
  return stripHtmlTags(tdHtml);
}

export function parseHtmlTable(html: string, source: GitHubRepoSource): JobPosting[] {
  const jobs: JobPosting[] = [];

  const trMatches = [...html.matchAll(/<tr>([\s\S]*?)<\/tr>/gi)];

  let lastCompany = '';
  let lastCompanyUrl = '';

  for (const trMatch of trMatches) {
    const rowHtml = trMatch[1];

    const tdMatches = [...rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)];
    if (tdMatches.length < 4) continue;

    const td0 = tdMatches[0][1];
    const td1 = tdMatches[1][1];
    const td2 = tdMatches[2][1];
    const td3 = tdMatches[3][1];
    const td4 = tdMatches[4]?.[1] ?? '';

    const companyText = extractInnerText(td0);
    if (companyText === 'Company' || companyText === 'company') continue;

    const isSubRow = companyText.trim() === '↳';

    const companyHref = extractHref(td0) || lastCompanyUrl;
    const company = isSubRow ? lastCompany : (companyText || lastCompany);
    if (!isSubRow) {
      lastCompany = company;
      lastCompanyUrl = companyHref;
    }

    const role = stripHtmlTags(td1);
    if (!role || role === 'Role') continue;

    if (td3.includes('🔒') || td3.toLowerCase().includes('closed')) continue;

    const location = extractInnerText(td2) || 'United States';

    const applyHref = extractHref(td3) || companyHref || 'https://github.com/SimplifyJobs/Summer2027-Internships';
    const applyUrl = applyHref.includes('simplify.jobs/p/') ? applyHref : applyHref;

    const ageText = stripHtmlTags(td4);
    const daysAgo = ageText.endsWith('d') ? parseInt(ageText, 10) || 0 : 0;

    if (!company || !role) continue;

    const enriched = enrichJobDetails({
      title: role,
      company,
      location,
      type: role.toLowerCase().includes('new grad') || role.toLowerCase().includes('full-time') ? 'New Grad' : 'Internship',
      season: source.season,
      category: inferCategory(role, source.category),
      source: 'SimplifyJobs',
      url: applyUrl,
      daysAgo,
    }, source);

    jobs.push(enriched);
  }

  return jobs;
}

export function inferCategory(title: string, defaultCategory: JobPosting['category'] = 'Software Engineering'): JobPosting['category'] {
  const t = title.toLowerCase();

  // 1. Specific domain categories checked first
  if (t.includes('quant') || t.includes('trading') || t.includes('algorithmic trading')) return 'Finance & Quant';
  if (t.includes('investment banking') || t.includes('accounting') || t.includes('audit') || t.includes('fp&a') || t.includes('capital market') || t.includes('wealth management') || t.includes('tax ') || t.includes('cpa') || t.includes('assurance') || (t.includes('finance') && !t.includes('quant'))) return 'Finance & Accounting';
  if (t.includes('marketing') || t.includes('brand') || t.includes('public relations') || t.includes(' pr ') || t.includes('communications') || t.includes('social media') || t.includes('copywriting') || t.includes('advertising')) return 'Marketing & Communications';
  if (t.includes('journalism') || t.includes('editorial') || t.includes('newsroom') || t.includes('reporter') || t.includes('curator') || t.includes('museum') || t.includes('ux research') || t.includes('uxr') || t.includes('curriculum') || t.includes('linguist') || t.includes('publishing') || t.includes('humanities') || t.includes('anthropology') || t.includes('sociology') || t.includes('psychology')) return 'Humanities & Social Sciences';
  if (t.includes('policy') || t.includes('government') || t.includes('civil liberties') || t.includes('think tank') || t.includes('non-profit') || t.includes('nonprofit') || t.includes('advocacy') || t.includes('public affairs') || t.includes('political') || t.includes('international affairs') || t.includes('legislat')) return 'Policy & Non-Profit';
  if (t.includes('supply chain') || t.includes('logistics') || t.includes('human resources') || t.includes(' hr ') || t.includes('people ops') || t.includes('talent') || t.includes('procurement') || t.includes('recruiting') || (t.includes('operations') && !t.includes('devops') && !t.includes('secops') && !t.includes('business operations'))) return 'Operations & HR';
  if (t.includes('product design') || t.includes('interaction design') || t.includes('ui/ux') || t.includes('ui design') || t.includes('ux design') || t.includes('graphic design') || t.includes('visual design') || t.includes('creative director') || t.includes('industrial design')) return 'Design & Creative';
  if (t.includes('legal') || t.includes('paralegal') || t.includes('compliance') || t.includes('regulatory') || t.includes('counsel') || t.includes('law clerk') || t.includes('pre-law')) return 'Legal & Compliance';
  if (t.includes('data') || t.includes('machine learning') || t.includes(' ml') || t.includes('ai ') || t.includes('nlp') || t.includes('deep learning') || t.includes('computer vision')) return 'Data & AI';
  if (t.includes('product manager') || t.includes(' pm ') || t.includes('program manager') || t.includes('apm')) return 'Product Management';
  if (t.includes('hardware') || t.includes('embedded') || t.includes('fpga') || t.includes('firmware') || t.includes('satellite') || t.includes('asic') || t.includes('electrical engineering') || t.includes('mechanical engineering')) return 'Hardware & Embedded';
  if (t.includes('security') || t.includes('cyber') || t.includes('infosec') || t.includes('soc analyst')) return 'Cybersecurity';

  // 2. Business & Strategy consulting/analyst
  if (t.includes('business') || t.includes('consult') || t.includes('strategy') || t.includes('business analyst') || t.includes('management analyst') || (t.includes('analyst') && !t.includes('software') && !t.includes('qa') && !t.includes('test'))) return 'Business & Strategy';

  return defaultCategory;
}

// ─── SHA-Based Change Fingerprinting ─────────────────────────────────────────

async function getLatestCommitSha(repo: string): Promise<string | null> {
  try {
    const r = await fetch(
      `https://api.github.com/repos/${repo}/commits?per_page=1`,
      { headers: { Accept: 'application/vnd.github.v3+json' } }
    );
    if (!r.ok) return null;
    const data = await r.json();
    return data[0]?.sha ?? null;
  } catch {
    return null;
  }
}

// ─── Main Service ─────────────────────────────────────────────────────────────

export interface SyncResult {
  success: boolean;
  jobsCount: number;
  newJobsCount: number;
  jobs: JobPosting[];
  syncedAt: number; // epoch ms
}

export class GitHubTrackerService {
  public async syncFromGitHub(): Promise<SyncResult> {
    const syncedAt = Date.now();

    try {
      const stored = await this.loadStorage();
      const storedShas: Record<string, string> = stored.shas ?? {};
      const previousJobs: JobPosting[] = stored.jobs ?? [...SEED_INTERNSHIP_DATABASE];

      const previousIds = new Set(previousJobs.map(j => `${j.company}-${j.title}`));
      const allJobs: JobPosting[] = [];
      const updatedShas: Record<string, string> = { ...storedShas };

      for (const source of GITHUB_SOURCES) {
        try {
          const latestSha = await getLatestCommitSha(source.repo);
          if (latestSha && latestSha === storedShas[source.repo]) {
            const cached = previousJobs.filter(j => j.season === source.season && j.category === source.category);
            allJobs.push(...cached);
            continue;
          }

          const response = await fetch(source.url);
          if (!response.ok) continue;

          const markdown = await response.text();
          const parsed = parseHtmlTable(markdown, source);

          if (parsed.length > 0) {
            allJobs.push(...parsed.slice(0, 150));
          }

          if (latestSha) updatedShas[source.repo] = latestSha;
        } catch (e) {
          console.warn(`[GitHubTracker] Failed source ${source.name}:`, e);
        }
      }

      for (const seed of SEED_INTERNSHIP_DATABASE) {
        const key = `${seed.company}-${seed.title}`;
        if (!allJobs.some(j => `${j.company}-${j.title}` === key)) {
          allJobs.push(seed);
        }
      }

      const seen = new Map<string, JobPosting>();
      for (const j of allJobs) {
        const key = `${j.company.toLowerCase()}-${j.title.toLowerCase()}`;
        if (!seen.has(key)) seen.set(key, j);
      }
      const deduplicated = Array.from(seen.values());

      const newJobsCount = deduplicated.filter(
        j => !previousIds.has(`${j.company}-${j.title}`)
      ).length;

      await this.saveStorage({
        jobs: deduplicated,
        shas: updatedShas,
        lastSyncAt: syncedAt,
        newJobsCount,
      });

      return { success: true, jobsCount: deduplicated.length, newJobsCount, jobs: deduplicated, syncedAt };
    } catch (err) {
      console.error('[GitHubTracker] Sync error:', err);
      const fallback = SEED_INTERNSHIP_DATABASE;
      return { success: false, jobsCount: fallback.length, newJobsCount: 0, jobs: fallback, syncedAt };
    }
  }

  private async loadStorage(): Promise<{ shas?: Record<string, string>; jobs?: JobPosting[] }> {
    return new Promise((resolve) => {
      if (typeof chrome === 'undefined' || !chrome.storage) {
        resolve({});
        return;
      }
      chrome.storage.local.get(['resumehack_github_jobs', 'resumehack_shas'], (r: any) => {
        resolve({ jobs: r?.resumehack_github_jobs, shas: r?.resumehack_shas });
      });
    });
  }

  private async saveStorage(data: {
    jobs: JobPosting[];
    shas: Record<string, string>;
    lastSyncAt: number;
    newJobsCount: number;
  }): Promise<void> {
    return new Promise((resolve) => {
      if (typeof chrome === 'undefined' || !chrome.storage) { resolve(); return; }
      chrome.storage.local.set({
        resumehack_github_jobs: data.jobs,
        resumehack_shas: data.shas,
        resumehack_last_sync_at: data.lastSyncAt,
        resumehack_new_jobs_count: data.newJobsCount,
      }, resolve);
    });
  }
}
