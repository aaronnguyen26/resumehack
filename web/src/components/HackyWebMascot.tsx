import React, { useState, useEffect } from 'react';
import { Sparkles, X, ChevronRight, Lightbulb } from 'lucide-react';

import { NavTab } from './Navbar.js';

interface HackyWebMascotProps {
  activeTab: string;
  onNavigateTab: (tab: NavTab) => void;
  atsScore?: number;
}

const TIPS: Record<string, string[]> = {
  home: [
    'Hacky: Welcome! Upload your PDF resume or launch Document Canvas to start optimizing.',
    'Pro Tip: Document Canvas protects your single-page line budget and eliminates hallucinations.',
  ],
  canvas: [
    'Hacky: The HackerRank ATS panel updates live next to your canvas as you type!',
    'Tip: Quantify your results with metrics (e.g., "reduced P99 latency by 35%") to boost your ATS score!',
    'Pro Tip: Matching 5+ hard skills from the target role puts you in the top 5% of applicants.',
  ],
  discovery: [
    'Hacky: Over 100+ verified Summer 2026 tech internships are currently accepting applications!',
    'Tip: Apply within 48 hours of posting to triple your recruiter response rate.',
    'Click "Tailor for this Job" on any posting to automatically optimize your resume in the canvas!',
  ],
  tracker: [
    'Tip: Follow up on applications after 7 business days to show genuine enthusiasm.',
    'Hacky: Track your conversion rates from Applied → Interviewing to refine your resume!',
  ],
  profile: [
    'Hacky: Keep your education and links updated so exports and auto-fills are always accurate.',
  ],
  settings: [
    'Hacky: You can bring your own API key (Gemini, OpenAI, Claude) for custom LLM tailoring.',
    'Tip: Make sure your work authorization is updated so applications fill accurately.',
  ],
};

export const HackyWebMascot: React.FC<HackyWebMascotProps> = ({ activeTab, onNavigateTab, atsScore }) => {
  const [isOpen, setIsOpen] = useState(true);
  const [tipIndex, setTipIndex] = useState(0);

  useEffect(() => {
    setTipIndex(0);
  }, [activeTab]);

  const currentTips = TIPS[activeTab] || TIPS.canvas;
  const currentTip = currentTips[tipIndex % currentTips.length];

  const handleNextTip = (e: React.MouseEvent) => {
    e.stopPropagation();
    setTipIndex((prev) => (prev + 1) % currentTips.length);
  };

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2 pointer-events-none select-none">
      {/* Speech Bubble */}
      {isOpen && (
        <div
          className="pointer-events-auto max-w-xs bg-white dark:bg-[#121215] border border-zinc-200 dark:border-[#27272A] shadow-xl rounded-2xl p-4 text-xs text-zinc-800 dark:text-zinc-200 transition-all duration-200 animate-in fade-in slide-in-from-bottom-2"
          role="status"
        >
          <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800 mb-2.5">
            <div className="flex items-center gap-2 font-bold text-zinc-900 dark:text-zinc-100">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Hacky Copilot</span>
              {atsScore !== undefined && (
                <span className="px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 text-[10px] font-mono font-bold">
                  {atsScore}% ATS
                </span>
              )}
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 rounded-md transition-colors cursor-pointer"
              title="Minimize Hacky"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-300 font-sans">
            {currentTip}
          </p>

          <div className="mt-3 pt-2.5 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-[11px]">
            <button
              onClick={handleNextTip}
              className="text-zinc-800 dark:text-zinc-200 hover:underline font-semibold flex items-center gap-1 cursor-pointer"
            >
              <Lightbulb className="w-3 h-3 text-amber-500" />
              <span>Next Tip</span>
            </button>
            {activeTab !== 'canvas' ? (
              <button
                onClick={() => onNavigateTab('canvas')}
                className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white flex items-center gap-0.5 cursor-pointer font-medium"
              >
                <span>Open Canvas</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            ) : (
              <button
                onClick={() => onNavigateTab('discovery')}
                className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white flex items-center gap-0.5 cursor-pointer font-medium"
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
        className="pointer-events-auto relative group flex items-center gap-2 p-3 rounded-full bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-950 shadow-xl border-2 border-zinc-200 dark:border-zinc-800 transition-all duration-200 cursor-pointer hover:scale-105 active:scale-95"
        title={isOpen ? 'Click to minimize Hacky' : 'Click to chat with Hacky'}
      >
        <span className="text-xl leading-none">🦉</span>
        {/* Pulsing online status indicator */}
        <span className="absolute top-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white dark:border-zinc-900 animate-pulse" />
        {!isOpen && (
          <span className="text-xs font-bold pr-1.5 hidden sm:inline-block">
            Ask Hacky
          </span>
        )}
      </button>
    </div>
  );
};
