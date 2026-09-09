import React from 'react';
import { 
  FileText, 
  Ruler, 
  ShieldCheck, 
  ArrowRight, 
  CheckCircle2, 
  Compass, 
  Kanban, 
  Lock, 
  ChevronRight, 
  UploadCloud, 
  Loader2,
  Award,
  Sparkles
} from 'lucide-react';
import { ScrapedJobData } from '../types/index.js';

interface HomePageProps {
  onOpenCanvas: () => void;
  onUploadResumeFile?: (file: File) => Promise<void>;
  onNavigateToDiscovery: () => void;
  onNavigateToTracker: () => void;
  onSelectRoleTarget?: (job: ScrapedJobData) => void;
  connectedDocTitle?: string;
  recentApplicationsCount?: number;
  newJobsCount?: number;
}

export const HomePage: React.FC<HomePageProps> = ({
  onOpenCanvas,
  onUploadResumeFile,
  onNavigateToDiscovery,
  onNavigateToTracker,
  onSelectRoleTarget,
  connectedDocTitle,
  recentApplicationsCount = 4,
  newJobsCount = 0,
}) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const [isUploadingPdf, setIsUploadingPdf] = React.useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (onUploadResumeFile) {
      setIsUploadingPdf(true);
      try {
        await onUploadResumeFile(file);
      } finally {
        setIsUploadingPdf(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    } else {
      onOpenCanvas();
    }
  };

  const handleDropFile = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (onUploadResumeFile) {
      setIsUploadingPdf(true);
      try {
        await onUploadResumeFile(file);
      } finally {
        setIsUploadingPdf(false);
      }
    } else {
      onOpenCanvas();
    }
  };

  return (
    <div className="w-full max-w-[1720px] mx-auto px-2 sm:px-4 md:px-6 py-6 md:py-8 animate-in fade-in duration-300">
      {/* Hero Header Section */}
      <section className="text-center max-w-5xl mx-auto pt-2 md:pt-4 mb-8 md:mb-10">
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-headline font-bold text-zinc-950 dark:text-zinc-50 tracking-tight leading-tight mb-4">
          Algorithmic Precision for Your Career
        </h1>

        <p className="text-base sm:text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed mb-8 max-w-3xl mx-auto">
          AI-Powered ATS Optimization & Hacky AI Architecture. Upload your resume to edit directly on the canvas and benchmark against tier-1 engineering rubrics.
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
            <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
            <span>Hacky AI ATS Architecture</span>
          </div>
        </div>
      </section>

      {/* Primary Action Box: Resume Upload & Canvas Studio Launchpad */}
      <section className="mb-12">
        <div className="bg-white dark:bg-[#121215] border border-zinc-200 dark:border-[#27272A] rounded-2xl p-6 sm:p-10 shadow-xs">
          <div className="max-w-4xl mx-auto">
            {/* Dropzone Container */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDropFile}
              onClick={() => !isUploadingPdf && fileInputRef.current?.click()}
              className={`group/drop p-8 sm:p-12 border-2 border-dashed rounded-xl text-center cursor-pointer transition-all duration-200 ${
                isDragging
                  ? 'border-zinc-900 dark:border-white bg-zinc-100 dark:bg-zinc-800/80 scale-[1.01]'
                  : 'border-zinc-300 dark:border-[#3F3F46] hover:border-zinc-500 dark:hover:border-zinc-400 bg-zinc-50/70 dark:bg-[#18181B]/50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.txt"
                onChange={handleFileChange}
                className="hidden"
              />

              {isUploadingPdf ? (
                <div className="py-6 flex flex-col items-center justify-center gap-3">
                  <Loader2 className="w-8 h-8 text-zinc-900 dark:text-zinc-100 animate-spin" />
                  <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 font-headline">
                    Parsing resume & extracting structure...
                  </span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                    Running layout analyzer & multi-tier Flate extraction
                  </span>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center">
                  <div className="w-14 h-14 rounded-2xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center mb-4 text-zinc-800 dark:text-zinc-200 group-hover/drop:text-zinc-950 dark:group-hover/drop:text-white transition-colors shadow-xs">
                    <UploadCloud className="w-7 h-7" />
                  </div>
                  <div className="text-lg font-bold text-zinc-950 dark:text-zinc-50 font-headline mb-1">
                    Upload Resume File
                  </div>
                  <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 max-w-md mb-4">
                    Drag and drop your resume (<span className="font-mono font-medium text-zinc-700 dark:text-zinc-300">PDF, DOCX, or TXT</span>) here or click to browse. Automatically ingested into the in-app canvas.
                  </p>

                  <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
                    <span className="px-2.5 py-1 rounded bg-zinc-200/60 dark:bg-zinc-800/60 border border-zinc-300/40 dark:border-zinc-700/40">
                      Standard US Letter
                    </span>
                    <span className="px-2.5 py-1 rounded bg-zinc-200/60 dark:bg-zinc-800/60 border border-zinc-300/40 dark:border-zinc-700/40">
                      Multi-Tier PDF Parser
                    </span>
                    <span className="px-2.5 py-1 rounded bg-zinc-200/60 dark:bg-zinc-800/60 border border-zinc-300/40 dark:border-zinc-700/40">
                      Instant In-App Canvas
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Launch Actions */}
            <div className="mt-6 flex flex-col sm:flex-row items-center gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full sm:flex-1 py-3.5 px-6 bg-zinc-950 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-950 font-headline font-semibold text-sm rounded-xl active:scale-[0.99] transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <UploadCloud className="w-4 h-4" />
                <span>Upload PDF File</span>
              </button>

              <button
                type="button"
                onClick={onOpenCanvas}
                className="w-full sm:w-auto py-3.5 px-6 bg-zinc-100 hover:bg-zinc-200 dark:bg-[#18181B] dark:hover:bg-[#27272A] border border-zinc-200 dark:border-[#27272A] text-zinc-900 dark:text-zinc-100 font-headline font-semibold text-sm rounded-xl active:scale-[0.99] transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <FileText className="w-4 h-4" />
                <span>Open Document Canvas</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* Feature Highlights Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8 pt-8 border-t border-zinc-100 dark:border-[#1E1E22] text-xs">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-zinc-900 dark:text-zinc-100">Direct In-App Canvas</div>
                  <div className="text-zinc-500 dark:text-zinc-400 text-[11px] mt-0.5">Google Docs-style live typing, continuous auto-save, and formatting ribbon.</div>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-zinc-900 dark:text-zinc-100">Hacky AI ATS Rubric</div>
                  <div className="text-zinc-500 dark:text-zinc-400 text-[11px] mt-0.5">6-dimensional scoring, production signals, and tutorial flag penalty audit.</div>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-zinc-900 dark:text-zinc-100">1-Page Line Guard</div>
                  <div className="text-zinc-500 dark:text-zinc-400 text-[11px] mt-0.5">Real-time line capacity meter prevents awkward two-page overflow.</div>
                </div>
              </div>
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
              onClick={onOpenCanvas}
              className="hover:text-zinc-950 dark:hover:text-zinc-100 transition-colors cursor-pointer"
            >
              Document Canvas
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;
