import React from 'react';
import { 
  Cloud, 
  FileText, 
  Edit3, 
  Ruler, 
  ShieldCheck, 
  ArrowLeftRight, 
  ArrowRight, 
  CheckCircle2, 
  Compass, 
  Kanban, 
  Lock, 
  ChevronRight, 
  ExternalLink,
  Home
} from 'lucide-react';
import { ScrapedJobData } from '../types/index.js';

interface HomePageProps {
  onSelectOption1GoogleDocs: () => void;
  onSelectOption2InAppCanvas: () => void;
  onNavigateToDiscovery: () => void;
  onNavigateToTracker: () => void;
  onSelectRoleTarget?: (job: ScrapedJobData) => void;
  onOpenGooglePicker?: () => void;
  connectedDocTitle?: string;
  recentApplicationsCount?: number;
  newJobsCount?: number;
}

export const HomePage: React.FC<HomePageProps> = ({
  onSelectOption1GoogleDocs,
  onSelectOption2InAppCanvas,
  onNavigateToDiscovery,
  onNavigateToTracker,
  onSelectRoleTarget,
  onOpenGooglePicker,
  connectedDocTitle,
  recentApplicationsCount = 4,
  newJobsCount = 0,
}) => {
  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-8 md:py-12 animate-in fade-in duration-300">
      {/* Hero Header Section */}
      <section className="text-center max-w-3xl mx-auto pt-2 md:pt-4 mb-12 md:mb-16">
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-headline font-bold text-zinc-950 dark:text-zinc-50 tracking-tight leading-tight mb-4">
          Algorithmic Precision for Your Career
        </h1>

        <p className="text-base sm:text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed mb-8 max-w-2xl mx-auto">
          AI-Powered ATS Optimization & Resume Intelligence. Select your workspace workflow below to begin tailoring for top engineering roles with deterministic precision.
        </p>

        {/* Minimalist Telemetry Badges */}
        <div className="flex flex-wrap items-center justify-center gap-3 text-xs font-mono text-zinc-700 dark:text-zinc-300">
          <div className="flex items-center gap-2 px-3.5 py-1.5 bg-white dark:bg-[#121215] border border-zinc-200 dark:border-[#27272A] rounded-md shadow-xs">
            <Ruler className="w-3.5 h-3.5 text-zinc-900 dark:text-zinc-100" />
            <span>1-Page Line Budget Guard</span>
          </div>
          <div className="flex items-center gap-2 px-3.5 py-1.5 bg-white dark:bg-[#121215] border border-zinc-200 dark:border-[#27272A] rounded-md shadow-xs">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Zero Hallucination Engine</span>
          </div>
          <div className="flex items-center gap-2 px-3.5 py-1.5 bg-white dark:bg-[#121215] border border-zinc-200 dark:border-[#27272A] rounded-md shadow-xs">
            <ArrowLeftRight className="w-3.5 h-3.5 text-amber-500" />
            <span>Two-Way Live Sync</span>
          </div>
        </div>
      </section>

      {/* Primary Workspace Selection Section (2-Column Spacious Cards) */}
      <section className="mb-14">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Select Resume Workspace Workflow
          </h2>
          <span className="text-xs font-mono text-zinc-400 dark:text-zinc-500">
            Dedicated Separate Workspaces
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Option 1 Card: Google Docs Cloud Sync */}
          <div className="group relative flex flex-col justify-between bg-white dark:bg-[#121215] border border-zinc-200 dark:border-[#27272A] hover:border-zinc-400 dark:hover:border-[#3F3F46] rounded-xl p-6 sm:p-8 transition-all duration-200 shadow-xs hover:shadow-md">
            <div>
              {/* Card Header */}
              <div className="flex items-center justify-between mb-5">
                <div className="w-11 h-11 rounded-lg bg-zinc-100 dark:bg-[#18181B] flex items-center justify-center border border-zinc-200 dark:border-[#27272A]">
                  <Cloud className="w-5 h-5 text-zinc-900 dark:text-zinc-100" />
                </div>
                <span className="text-[11px] font-mono px-2.5 py-1 rounded bg-zinc-100 dark:bg-[#18181B] text-emerald-600 dark:text-emerald-400 border border-zinc-200 dark:border-[#27272A] flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Two-Way Sync Ready
                </span>
              </div>

              <div className="mb-2">
                <span className="text-xs font-mono font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-300">
                  Option 1
                </span>
                <h3 className="text-xl font-headline font-bold text-zinc-950 dark:text-zinc-50 mt-0.5">
                  Google Docs Cloud Sync
                </h3>
              </div>

              <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed mb-6">
                Two-way live synchronization with your existing master Google Doc. Applies atomic STAR bullet diffs directly without breaking typography or layout styling.
              </p>

              {/* Features List */}
              <div className="space-y-3 pt-4 border-t border-zinc-100 dark:border-[#1E1E22] mb-8">
                <div className="flex items-center text-xs text-zinc-700 dark:text-zinc-300 gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Google Drive live continuous bidirectional connect</span>
                </div>
                <div className="flex items-center text-xs text-zinc-700 dark:text-zinc-300 gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Preserves bespoke margins, line heights, and fonts</span>
                </div>
                <div className="flex items-center text-xs text-zinc-700 dark:text-zinc-300 gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Instant ATS keyword delta diffing via Google Docs API</span>
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={onSelectOption1GoogleDocs}
                className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-zinc-950 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-950 font-headline font-semibold text-sm rounded-lg active:scale-[0.99] transition-all shadow-xs"
              >
                <span>Launch Google Docs Workspace</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              {onOpenGooglePicker && (
                <button
                  type="button"
                  onClick={onOpenGooglePicker}
                  title="Pick a specific Google Doc from your Drive"
                  className="px-3.5 py-3 bg-zinc-100 hover:bg-zinc-200 dark:bg-[#18181B] dark:hover:bg-[#27272A] border border-zinc-200 dark:border-[#27272A] text-zinc-800 dark:text-zinc-200 text-xs font-mono rounded-lg transition-colors flex items-center justify-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span className="hidden lg:inline">Pick Doc</span>
                </button>
              )}
            </div>
          </div>

          {/* Option 2 Card: In-App Document Canvas */}
          <div className="group relative flex flex-col justify-between bg-white dark:bg-[#121215] border border-zinc-200 dark:border-[#27272A] hover:border-zinc-400 dark:hover:border-[#3F3F46] rounded-xl p-6 sm:p-8 transition-all duration-200 shadow-xs hover:shadow-md">
            <div>
              {/* Card Header */}
              <div className="flex items-center justify-between mb-5">
                <div className="w-11 h-11 rounded-lg bg-zinc-100 dark:bg-[#18181B] flex items-center justify-center border border-zinc-200 dark:border-[#27272A]">
                  <Edit3 className="w-5 h-5 text-zinc-900 dark:text-zinc-100" />
                </div>
                <span className="text-[11px] font-mono px-2.5 py-1 rounded bg-zinc-100 dark:bg-[#18181B] text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-[#27272A]">
                  Native Engine
                </span>
              </div>

              <div className="mb-2">
                <span className="text-xs font-mono font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-300">
                  Option 2
                </span>
                <h3 className="text-xl font-headline font-bold text-zinc-950 dark:text-zinc-50 mt-0.5">
                  In-App Document Canvas
                </h3>
              </div>

              <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed mb-6">
                First-party document editor with multi-format ingestion. Real-time layout budget overflow guard with 1-click ATS-compliant pixel-accurate PDF export.
              </p>

              {/* Features List */}
              <div className="space-y-3 pt-4 border-t border-zinc-100 dark:border-[#1E1E22] mb-8">
                <div className="flex items-center text-xs text-zinc-700 dark:text-zinc-300 gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Multi-format parser (PDF, DOCX, TXT, Markdown)</span>
                </div>
                <div className="flex items-center text-xs text-zinc-700 dark:text-zinc-300 gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Live page-height millimeter budget overflow guard</span>
                </div>
                <div className="flex items-center text-xs text-zinc-700 dark:text-zinc-300 gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Pure plain text, ATS UTF-8 format, and LaTeX export</span>
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-2">
              <button
                type="button"
                onClick={onSelectOption2InAppCanvas}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-zinc-100 hover:bg-zinc-200 dark:bg-[#18181B] dark:hover:bg-[#27272A] border border-zinc-300 dark:border-[#3F3F46] text-zinc-900 dark:text-zinc-100 font-headline font-semibold text-sm rounded-lg active:scale-[0.99] transition-all shadow-xs"
              >
                <span>Launch In-App Canvas</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Secondary Quick Navigation Row (Split Horizontal Modules) */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
        {/* Stream Module */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-xl bg-white dark:bg-[#121215] border border-zinc-200 dark:border-[#27272A] hover:border-zinc-300 dark:hover:border-[#3F3F46] transition-colors shadow-xs">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-lg bg-zinc-100 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] text-zinc-900 dark:text-zinc-100 shrink-0">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold text-zinc-950 dark:text-zinc-100 font-headline">
                  Real-Time Job Stream
                </h4>
                <span className="text-[10px] font-mono px-1.5 py-0.2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded font-semibold">
                  Live Stream {newJobsCount > 0 ? `(+${newJobsCount})` : ''}
                </span>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
                100+ verified SWE & AI openings synced directly from GitHub repos and tech career portals.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onNavigateToDiscovery}
            className="shrink-0 text-xs font-semibold px-4 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-[#18181B] dark:hover:bg-[#27272A] border border-zinc-200 dark:border-[#27272A] text-zinc-900 dark:text-zinc-100 rounded-lg active:scale-95 transition-all flex items-center gap-1.5"
          >
            <span>Explore Discovery</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Pipeline CRM Module */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-xl bg-white dark:bg-[#121215] border border-zinc-200 dark:border-[#27272A] hover:border-zinc-300 dark:hover:border-[#3F3F46] transition-colors shadow-xs">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-lg bg-zinc-100 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] text-zinc-900 dark:text-zinc-100 shrink-0">
              <Kanban className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold text-zinc-950 dark:text-zinc-100 font-headline">
                  Executive Pipeline CRM
                </h4>
                <span className="text-[10px] font-mono px-1.5 py-0.2 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 rounded font-semibold">
                  {recentApplicationsCount} Tracked
                </span>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
                Track status and auto-fill applications across stages (Applied, Screen, Onsite, Offer).
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onNavigateToTracker}
            className="shrink-0 text-xs font-semibold px-4 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-[#18181B] dark:hover:bg-[#27272A] border border-zinc-200 dark:border-[#27272A] text-zinc-900 dark:text-zinc-100 rounded-lg active:scale-95 transition-all flex items-center gap-1.5"
          >
            <span>Open Tracker</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </section>

      {/* Live Active Target Roles Strip */}
      <section className="border border-zinc-200 dark:border-[#27272A] rounded-xl bg-white dark:bg-[#121215] p-5 mb-12 shadow-xs">
        <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-[#1E1E22]">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Active Target Roles
            </span>
            <span className="text-zinc-300 dark:text-zinc-700">•</span>
            <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400">
              Matching active keywords
            </span>
          </div>
          <button
            type="button"
            onClick={onNavigateToTracker}
            className="text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-100 transition-colors flex items-center gap-1 font-mono"
          >
            <span>View pipeline</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
          {/* Role 1: Stripe */}
          <div 
            onClick={() => onSelectRoleTarget?.({
              title: 'Software Engineering Intern — Summer 2026',
              company: 'Stripe',
              location: 'San Francisco, CA (Hybrid)',
              description: 'We are looking for Software Engineering Interns to join our infrastructure and API teams. You will write high-performance Go, Python, and TypeScript code, design scalable REST APIs with PostgreSQL, and automate CI/CD pipelines with Docker and Kubernetes.',
              url: 'https://stripe.com/jobs/search?q=intern',
              source: 'LinkedIn'
            })}
            className="p-3.5 bg-zinc-50 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] hover:border-zinc-400 dark:hover:border-[#3F3F46] rounded-lg cursor-pointer transition-all hover:-translate-y-0.5"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-zinc-950 dark:text-zinc-100 font-headline">Stripe</span>
              <span className="text-[10px] font-mono text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded font-bold">
                98% Match
              </span>
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-300 font-medium truncate">
              SWE Intern (Infrastructure)
            </p>
            <div className="mt-2.5 text-[10px] font-mono text-zinc-600 dark:text-zinc-300 flex items-center justify-between">
              <span>STAR diff ready</span>
              <span className="text-amber-700 dark:text-amber-300 font-semibold">Onsite Stage</span>
            </div>
          </div>

          {/* Role 2: Anthropic */}
          <div 
            onClick={() => onSelectRoleTarget?.({
              title: 'Software Engineering Intern, Systems',
              company: 'Anthropic',
              location: 'San Francisco, CA',
              description: 'Anthropic is seeking systems engineering interns to build robust distributed training and inference platforms with Python, Rust, and PyTorch.',
              url: 'https://anthropic.com/careers',
              source: 'Greenhouse'
            })}
            className="p-3.5 bg-zinc-50 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] hover:border-zinc-400 dark:hover:border-[#3F3F46] rounded-lg cursor-pointer transition-all hover:-translate-y-0.5"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-zinc-950 dark:text-zinc-100 font-headline">Anthropic</span>
              <span className="text-[10px] font-mono text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded font-bold">
                94% Match
              </span>
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-300 font-medium truncate">
              Systems & Inference Intern
            </p>
            <div className="mt-2.5 text-[10px] font-mono text-zinc-600 dark:text-zinc-300 flex items-center justify-between">
              <span>Line budget: 48/52</span>
              <span className="text-zinc-600 dark:text-zinc-300">Applied</span>
            </div>
          </div>

          {/* Role 3: OpenAI */}
          <div 
            onClick={() => onSelectRoleTarget?.({
              title: 'Core Platforms Engineering Intern',
              company: 'OpenAI',
              location: 'San Francisco, CA',
              description: 'Help scale AI systems reliably. Build high-throughput microservices, optimize data pipelines, and improve infrastructure resilience.',
              url: 'https://openai.com/careers',
              source: 'Lever'
            })}
            className="p-3.5 bg-zinc-50 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] hover:border-zinc-400 dark:hover:border-[#3F3F46] rounded-lg cursor-pointer transition-all hover:-translate-y-0.5"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-zinc-950 dark:text-zinc-100 font-headline">OpenAI</span>
              <span className="text-[10px] font-mono text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded font-bold">
                91% Match
              </span>
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-300 font-medium truncate">
              Core Platforms Intern
            </p>
            <div className="mt-2.5 text-[10px] font-mono text-zinc-600 dark:text-zinc-300 flex items-center justify-between">
              <span>STAR ready</span>
              <span className="text-zinc-600 dark:text-zinc-300">Draft</span>
            </div>
          </div>
        </div>
      </section>

      {/* Minimalist Monochromatic Footer */}
      <footer className="w-full border-t border-zinc-200 dark:border-[#27272A] pt-8 pb-4 text-xs text-zinc-500 dark:text-zinc-400">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-4">
          {/* Privacy & Encryption Badge */}
          <div className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300 font-mono text-[11px]">
            <Lock className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span className="font-semibold">Client-Side AES-GCM Encrypted</span>
            <span className="text-zinc-400 dark:text-zinc-600">|</span>
            <span className="text-zinc-500 dark:text-zinc-400 hidden sm:inline">
              No documents leave browser unencrypted
            </span>
          </div>

          {/* Telemetry Specs */}
          <div className="font-mono text-[11px] text-zinc-500 dark:text-zinc-500 flex items-center gap-2">
            <span>v4.2.0</span>
            <span>•</span>
            <span>Zero external telemetry</span>
            <span>•</span>
            <span>Latency 14ms</span>
            <span>•</span>
            <span className="text-zinc-600 dark:text-zinc-300">Serverless WASM engine</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-4 border-t border-zinc-100 dark:border-[#1E1E22] text-[11px]">
          <span>© 2026 ResumeHack Intelligence. All rights reserved.</span>
          <div className="flex items-center gap-4">
            <button 
              type="button" 
              onClick={onNavigateToDiscovery}
              className="hover:text-zinc-950 dark:hover:text-zinc-100 transition-colors"
            >
              Job Stream
            </button>
            <button 
              type="button" 
              onClick={onNavigateToTracker}
              className="hover:text-zinc-950 dark:hover:text-zinc-100 transition-colors"
            >
              Pipeline CRM
            </button>
            <button 
              type="button" 
              onClick={onSelectOption1GoogleDocs}
              className="hover:text-zinc-950 dark:hover:text-zinc-100 transition-colors"
            >
              Google Docs Workspace
            </button>
            <button 
              type="button" 
              onClick={onSelectOption2InAppCanvas}
              className="hover:text-zinc-950 dark:hover:text-zinc-100 transition-colors"
            >
              In-App Canvas
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;
