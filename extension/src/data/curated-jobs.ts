import { JobPosting } from '../types/index.js';

export const CURATED_JOB_LISTINGS: JobPosting[] = [
  {
    id: 'job-1',
    title: 'Software Engineering Intern — Summer 2026',
    company: 'Stripe',
    location: 'San Francisco, CA (Hybrid)',
    type: 'Internship',
    season: 'Summer 2026',
    category: 'Software Engineering',
    source: 'CuratedFeed',
    url: 'https://stripe.com/jobs/search?q=intern',
    salaryRange: '$58 - $65 / hr + Housing',
    description: `About the Role:
We are looking for passionate Software Engineering Interns to join our core infrastructure and product teams for Summer 2026.
You will write clean, well-tested code in Python, Go, and TypeScript, working on distributed systems that process billions of dollars in global transactions.

Responsibilities:
• Design, implement, and deploy high-throughput microservices and REST APIs using Go, Python, and PostgreSQL.
• Collaborate with cross-functional teams to build resilient financial infrastructure.
• Improve latency, system design, observability, and automated unit testing across distributed cloud services (AWS).

Requirements:
• Currently pursuing a B.S. or M.S. in Computer Science or related STEM field (Graduation: Dec 2026 - June 2027).
• Strong fundamentals in Data Structures, Algorithms, and Object-Oriented Programming.
• Hands-on experience with at least one modern programming language: Go, Python, Java, or TypeScript.
• Familiarity with Docker, Linux, Git, and relational databases (SQL / PostgreSQL).`
  },
  {
    id: 'job-2',
    title: 'AI / Full-Stack Engineer Intern',
    company: 'OpenAI',
    location: 'San Francisco, CA',
    type: 'Internship',
    season: 'Summer 2026',
    category: 'Data & AI',
    source: 'CuratedFeed',
    url: 'https://openai.com/careers',
    salaryRange: '$65 - $75 / hr + Housing',
    description: `About the Team:
Join our Applied AI and Developer Experience team building next-generation developer tooling, multi-modal interfaces, and agentic workflows powered by modern LLMs.

Key Responsibilities:
• Build responsive frontend web applications using React, Next.js, and TypeScript.
• Develop scalable backend endpoints in Python (FastAPI) to interface with foundational models.
• Implement real-time streaming, LLM prompt orchestration, and vector indexing using Redis and PostgreSQL.
• Maintain rigorous unit testing and CI/CD pipelines.

Qualifications:
• Strong coding skills in TypeScript, React, and Python.
• Experience building full-stack applications with modern APIs and cloud infrastructure (GCP or AWS).
• Passion for artificial intelligence, agent workflows, and developer productivity tools.`
  },
  {
    id: 'job-3',
    title: 'Backend Software Engineer — New Grad 2026',
    company: 'Datadog',
    location: 'New York, NY',
    type: 'New Grad',
    season: 'Fall 2026',
    category: 'Software Engineering',
    source: 'CuratedFeed',
    url: 'https://datadoghq.com/careers',
    salaryRange: '$145,000 - $165,000 / yr + Equity',
    description: `About Datadog:
Datadog is the essential monitoring and security platform for cloud applications. We process trillions of data points every day.

What You'll Do:
• Build distributed, high-availability microservices in Go and Python.
• Design data ingestion pipelines using Kafka, Redis, and PostgreSQL.
• Optimize system latency, memory allocation, and concurrency across Kubernetes clusters in AWS and GCP.
• Participate in code reviews and architectural discussions.

Qualifications:
• Bachelor's or Master's in Computer Science or equivalent graduating in 2026.
• Experience with Go, Python, or C++ in a Unix/Linux environment.
• Solid grasp of concurrency, networking, and distributed systems architecture.`
  },
  {
    id: 'job-4',
    title: 'Associate Product Manager Intern',
    company: 'Google',
    location: 'Mountain View, CA / New York, NY',
    type: 'Internship',
    season: 'Summer 2026',
    category: 'Product Management',
    source: 'CuratedFeed',
    url: 'https://careers.google.com/jobs',
    salaryRange: '$52 - $60 / hr + Housing',
    description: `As an Associate Product Manager Intern, you will help shape Google products used by billions of people around the globe.

Responsibilities:
• Define product requirements, user stories, and feature roadmaps in collaboration with Engineering and UX.
• Conduct user research, market analysis, and A/B test metric tracking.
• Drive cross-functional collaboration and agile sprint planning.

Requirements:
• Enrolled in a Computer Science, Engineering, or technical degree program.
• Strong leadership, problem-solving, and communication skills.
• Demonstrated technical projects or leadership in student organizations.`
  }
];
