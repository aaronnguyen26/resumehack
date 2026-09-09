import React, { useState, useEffect } from 'react';
import { Sparkles, X, ChevronRight, CheckCircle2, MessageSquare, Lightbulb } from 'lucide-react';

interface HackyWebMascotProps {
  activeTab: string;
  onNavigateTab: (tab: 'match' | 'discovery' | 'tracker' | 'settings') => void;
  atsScore?: number;
}

const TIPS: Record<string, string[]> = {
  match: [
    'Tip: Quantify your results with metrics (e.g., "reduced latency by 35%") to boost your ATS score!',
    'Hacky: Check the diff highlights on your bullet points to verify anti-hallucination sourcing.',
    'Pro Tip: Matching 5+ hard skills from the job description puts you in the top 10% of applicants.',
  ],
  discovery: [
    'Hacky: Over 100+ verified Summer 2026 tech internships are currently accepting applications!',
    'Tip: Apply within 48 hours of posting to triple your recruiter response rate.',
    'Click "Tailor for this Job" on any posting to automatically optimize your resume for it!',
  ],
  tracker: [
    'Tip: Follow up on applications after 7 business days to show genuine enthusiasm.',
    'Hacky: Track your conversion rates from Applied → Interviewing to refine your resume!',
  ],
  settings: [
    'Hacky: You can connect your Google Account or bring your own API key (Gemini, OpenAI, Claude).',
    'Tip: Make sure your work authorization is updated so forms fill accurately.',
  ],
};

export const HackyWebMascot: React.FC<HackyWebMascotProps> = ({ activeTab, onNavigateTab, atsScore }) => {
  const [isOpen, setIsOpen] = useState(true);
  const [tipIndex, setTipIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    setTipIndex(0);
  }, [activeTab]);

  const currentTips = TIPS[activeTab] || TIPS.match;
  const currentTip = currentTips[tipIndex % currentTips.length];

  const handleNextTip = (e: React.MouseEvent) => {
    e.stopPropagation();
    setTipIndex((prev) => (prev + 1) % currentTips.length);
  };

  return (
    <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-2 pointer-events-none select-none">
      {/* Speech Bubble */}
      {isOpen && (
        <div
          className="pointer-events-auto max-w-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl rounded-2xl p-3.5 text-xs text-slate-800 dark:text-slate-200 transition-all duration-200 animate-in fade-in slide-in-from-bottom-2"
          role="status"
        >
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-slate-800 mb-2">
            <div className="flex items-center gap-1.5 font-bold text-brand-600 dark:text-brand-400">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Hacky Copilot</span>
              {atsScore !== undefined && (
                <span className="px-1.5 py-0.5 rounded bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 text-[10px] font-mono font-bold">
                  {atsScore}% ATS
                </span>
              )}
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded transition-colors"
              title="Minimize Hacky"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
            {currentTip}
          </p>

          <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px]">
            <button
              onClick={handleNextTip}
              className="text-brand-600 dark:text-brand-400 hover:underline font-semibold flex items-center gap-0.5 cursor-pointer"
            >
              <Lightbulb className="w-3 h-3" />
              <span>Next Tip</span>
            </button>
            {activeTab !== 'match' ? (
              <button
                onClick={() => onNavigateTab('match')}
                className="text-slate-500 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 flex items-center gap-0.5 cursor-pointer font-medium"
              >
                <span>Tailor Resume</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            ) : (
              <button
                onClick={() => onNavigateTab('discovery')}
                className="text-slate-500 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 flex items-center gap-0.5 cursor-pointer font-medium"
              >
                <span>Explore Jobs</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Floating Mascot Button */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="pointer-events-auto relative group flex items-center gap-2 p-2.5 rounded-full bg-brand-600 hover:bg-brand-500 text-white shadow-lg shadow-brand-500/25 border-2 border-white dark:border-slate-800 transition-all duration-200 cursor-pointer hover:scale-105 active:scale-95"
        title={isOpen ? 'Click to minimize Hacky' : 'Click to chat with Hacky'}
      >
        <span className="text-xl leading-none">🦉</span>
        {/* Pulsing online status indicator */}
        <span className="absolute top-0 right-0 w-3 h-3 rounded-full bg-emerald-400 border-2 border-white dark:border-slate-900 animate-pulse" />
        {!isOpen && (
          <span className="text-xs font-bold pr-1.5 hidden sm:inline-block">
            Ask Hacky
          </span>
        )}
      </button>
    </div>
  );
};
