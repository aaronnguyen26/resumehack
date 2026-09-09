import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  X,
  ChevronRight,
  Send,
  RotateCcw,
  FileText,
  Briefcase,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  Building2,
  Compass,
  ArrowRight,
} from 'lucide-react';

import { NavTab } from './Navbar.js';
import {
  ApplicantProfile,
  ApplicationRecord,
  JobPosting,
  ChatMessage,
  ChatAction,
  ChatDataCard,
} from '../types/index.js';
import { HackyChatbot } from '../services/hacky-chatbot.js';

export interface HackyWebMascotProps {
  activeTab: NavTab;
  onNavigateTab: (tab: NavTab) => void;
  atsScore?: number;
  resumeText?: string;
  applicantProfile?: ApplicantProfile;
  applications?: ApplicationRecord[];
  jobs?: JobPosting[];
  onSelectJobForTailoring?: (job: JobPosting) => void;
}

const CHAT_STORAGE_KEY = 'resumehack_hacky_chat_history';

const INITIAL_MESSAGE: ChatMessage = {
  id: 'init-hacky-welcome',
  sender: 'hacky',
  text:
    "Hi! I'm Hacky, your AI career & resume copilot 🦉.\n\n" +
    "Ask me anything about:\n" +
    "• **Your resume** & how to boost your ATS score\n" +
    "• **How your job applications** & interview pipeline are doing\n" +
    "• **New verified job openings** & internships to apply for!",
  timestamp: Date.now(),
  actions: [
    { label: '📄 How is my resume doing?', action: 'quick_reply', payload: 'How is my resume doing?' },
    { label: '📊 How are my jobs doing?', action: 'quick_reply', payload: 'How are my jobs doing?' },
    { label: '💼 Any new job openings?', action: 'quick_reply', payload: 'Are there any new job openings?' },
  ],
};

const SUGGESTION_CHIPS = [
  'How is my resume doing?',
  'How are my jobs doing?',
  'Any new job openings?',
  'How to quantify bullets?',
];

export const HackyWebMascot: React.FC<HackyWebMascotProps> = ({
  activeTab,
  onNavigateTab,
  atsScore,
  resumeText = '',
  applicantProfile,
  applications = [],
  jobs = [],
  onSelectJobForTailoring,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem(CHAT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [INITIAL_MESSAGE];
  });
  const [inputValue, setInputValue] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new message
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isThinking]);

  // Persist messages to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
    } catch {}
  }, [messages]);

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputValue).trim();
    if (!query || isThinking) return;

    const userMsg: ChatMessage = {
      id: `user-msg-${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputValue('');
    setIsThinking(true);

    try {
      const context = {
        resumeText,
        atsScore,
        applicantProfile,
        applications,
        jobs,
        activeTab,
      };

      const reply = await HackyChatbot.processUserMessage(query, context);
      setMessages((prev) => [...prev, reply]);
    } catch (err) {
      const errorReply: ChatMessage = {
        id: `err-msg-${Date.now()}`,
        sender: 'hacky',
        text: "I encountered a hiccup analyzing that question. Please try asking again in a moment! 🦉",
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorReply]);
    } finally {
      setIsThinking(false);
    }
  };

  const handleActionClick = (action: ChatAction) => {
    if (action.action === 'navigate_tab' && action.tab) {
      onNavigateTab(action.tab);
    } else if (action.action === 'tailor_job' && action.payload && onSelectJobForTailoring) {
      onSelectJobForTailoring(action.payload);
      onNavigateTab('canvas');
    } else if (action.action === 'quick_reply' && action.payload) {
      handleSendMessage(action.payload);
    }
  };

  const handleClearChat = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMessages([INITIAL_MESSAGE]);
    try {
      localStorage.removeItem(CHAT_STORAGE_KEY);
    } catch {}
  };

  // Render text with basic markdown formatting
  const renderMessageContent = (text: string) => {
    const lines = text.split('\n');
    return (
      <div className="space-y-1 text-xs leading-relaxed font-sans">
        {lines.map((line, idx) => {
          if (!line.trim()) return <div key={idx} className="h-1" />;

          // Parse bold text **bold**
          const parts = line.split(/(\*\*.*?\*\*)/g);
          const formattedLine = parts.map((part, pIdx) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return (
                <strong key={pIdx} className="font-semibold text-zinc-950 dark:text-zinc-50">
                  {part.slice(2, -2)}
                </strong>
              );
            }
            return part;
          });

          return (
            <div key={idx} className="leading-normal">
              {formattedLine}
            </div>
          );
        })}
      </div>
    );
  };

  // Render rich data card if attached
  const renderDataCard = (card: ChatDataCard) => {
    if (card.type === 'resume_summary') {
      return (
        <div className="mt-2.5 p-2.5 rounded-xl bg-zinc-50 dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800 space-y-2 text-[11px]">
          <div className="flex items-center justify-between border-b border-zinc-200/60 dark:border-zinc-800/80 pb-1.5">
            <span className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" />
              {card.title}
            </span>
            <span className="px-2 py-0.5 rounded-full font-mono font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 text-[10px]">
              {card.score}% ATS
            </span>
          </div>

          <div className="grid grid-cols-2 gap-1.5 text-zinc-600 dark:text-zinc-400">
            <div className="flex items-center gap-1 bg-white dark:bg-[#18181B] px-2 py-1 rounded border border-zinc-200/50 dark:border-zinc-800/50">
              <span className="text-zinc-900 dark:text-zinc-100 font-semibold">{card.metricsCount}</span> metrics
            </div>
            <div className="flex items-center gap-1 bg-white dark:bg-[#18181B] px-2 py-1 rounded border border-zinc-200/50 dark:border-zinc-800/50">
              <span className="text-zinc-900 dark:text-zinc-100 font-semibold">{card.lineCount}</span> lines ({card.lineCount <= 52 ? '1 page' : '>1 page'})
            </div>
          </div>

          {card.topRecommendations.length > 0 && (
            <div className="text-[10px] text-zinc-500 dark:text-zinc-400 pt-1 flex items-start gap-1">
              <AlertCircle className="w-3 h-3 text-amber-500 shrink-0 mt-0.5" />
              <span>{card.topRecommendations[0]}</span>
            </div>
          )}
        </div>
      );
    }

    if (card.type === 'pipeline_summary') {
      return (
        <div className="mt-2.5 p-2.5 rounded-xl bg-zinc-50 dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800 space-y-2 text-[11px]">
          <div className="flex items-center justify-between border-b border-zinc-200/60 dark:border-zinc-800/80 pb-1.5">
            <span className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" />
              Application Pipeline CRM
            </span>
            <span className="font-mono text-[10px] text-zinc-500 dark:text-zinc-400">
              {card.total} Total
            </span>
          </div>

          <div className="grid grid-cols-3 gap-1.5 text-center">
            <div className="p-1.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300">
              <div className="font-mono font-bold text-xs">{card.interviewing}</div>
              <div className="text-[9px] uppercase tracking-wider">Interview</div>
            </div>
            <div className="p-1.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300">
              <div className="font-mono font-bold text-xs">{card.applied}</div>
              <div className="text-[9px] uppercase tracking-wider">Applied</div>
            </div>
            <div className="p-1.5 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300">
              <div className="font-mono font-bold text-xs">{card.bookmarked}</div>
              <div className="text-[9px] uppercase tracking-wider">Saved</div>
            </div>
          </div>
        </div>
      );
    }

    if (card.type === 'job_openings') {
      return (
        <div className="mt-2.5 space-y-1.5">
          {card.openings.slice(0, 3).map((job) => (
            <div
              key={job.id}
              className="p-2 rounded-xl bg-zinc-50 dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-[11px] gap-2"
            >
              <div className="min-w-0">
                <div className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                  {job.company}
                </div>
                <div className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">
                  {job.title} • {job.location}
                </div>
              </div>
              {onSelectJobForTailoring && (
                <button
                  onClick={() => {
                    const fullJob = jobs.find((j) => j.id === job.id) || {
                      id: job.id,
                      title: job.title,
                      company: job.company,
                      location: job.location,
                      type: 'Internship' as const,
                      url: job.url || '',
                      source: 'CuratedFeed' as const,
                      description: `${job.title} at ${job.company}`,
                    };
                    onSelectJobForTailoring(fullJob);
                    onNavigateTab('canvas');
                  }}
                  className="px-2 py-1 rounded bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-950 font-semibold text-[10px] shrink-0 cursor-pointer transition-colors"
                >
                  Tailor
                </button>
              )}
            </div>
          ))}
        </div>
      );
    }

    return null;
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2.5 pointer-events-none select-none">
      {/* Expanded Chatbot Panel */}
      {isOpen && (
        <div
          className="pointer-events-auto w-[370px] max-w-[calc(100vw-2rem)] h-[510px] max-h-[min(540px,calc(100vh-100px))] flex flex-col bg-white dark:bg-[#121215] border border-zinc-200 dark:border-[#27272A] rounded-2xl shadow-2xl overflow-hidden transition-all duration-200 animate-in fade-in slide-in-from-bottom-3"
          role="dialog"
          aria-label="Ask Hacky AI Chatbot"
        >
          {/* Header */}
          <div className="h-14 px-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-white dark:bg-[#121215] shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="relative w-8 h-8 rounded-lg bg-zinc-100 dark:bg-[#1E1E22] border border-zinc-200 dark:border-[#2E2E33] flex items-center justify-center text-lg">
                <span>🦉</span>
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-[#121215]" />
              </div>
              <div className="flex flex-col text-left">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-xs text-zinc-900 dark:text-zinc-100 font-headline">
                    Ask Hacky
                  </span>
                  {atsScore !== undefined && (
                    <span className="px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 text-[9px] font-mono font-bold">
                      {atsScore}% ATS
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium">
                  Career & Resume Copilot
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleClearChat}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                title="Clear chat history"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                title="Minimize chat"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Context status bar */}
          <div className="px-3.5 py-1.5 bg-zinc-50 dark:bg-[#18181B]/80 border-b border-zinc-100 dark:border-zinc-800/80 text-[10px] text-zinc-500 dark:text-zinc-400 flex items-center justify-between font-mono shrink-0">
            <span className="truncate max-w-[170px]">
              📄 {applicantProfile?.firstName ? `${applicantProfile.firstName}'s Resume` : (resumeText ? 'Resume Loaded' : 'No Resume')}
            </span>
            <span>
              📊 {applications.length} Apps • 💼 {jobs.length || 100}+ Jobs
            </span>
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 ${
                    msg.sender === 'user'
                      ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 rounded-tr-xs shadow-xs font-medium'
                      : 'bg-zinc-100 dark:bg-[#18181B] text-zinc-800 dark:text-zinc-200 border border-zinc-200/80 dark:border-[#27272A] rounded-tl-xs shadow-2xs'
                  }`}
                >
                  {renderMessageContent(msg.text)}

                  {msg.dataCard && renderDataCard(msg.dataCard)}

                  {msg.actions && msg.actions.length > 0 && (
                    <div className="mt-2.5 pt-2 border-t border-zinc-200/60 dark:border-zinc-800/70 flex flex-wrap gap-1.5">
                      {msg.actions.map((act, actIdx) => (
                        <button
                          key={actIdx}
                          type="button"
                          onClick={() => handleActionClick(act)}
                          className="px-2 py-1 rounded-md text-[10px] font-semibold bg-white dark:bg-[#222226] text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-600 transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <span>{act.label}</span>
                          <ChevronRight className="w-2.5 h-2.5 text-zinc-400" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <span className="text-[9px] font-mono text-zinc-400 dark:text-zinc-500 mt-1 px-1">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}

            {isThinking && (
              <div className="flex items-center gap-2 p-2.5 rounded-2xl rounded-tl-xs bg-zinc-100 dark:bg-[#18181B] border border-zinc-200/80 dark:border-[#27272A] text-zinc-500 max-w-[140px]">
                <span className="text-xs">🦉</span>
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Suggestion Chips */}
          <div className="px-3 pt-1.5 pb-2 bg-white dark:bg-[#121215] border-t border-zinc-100 dark:border-zinc-800/80 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
            {SUGGESTION_CHIPS.map((chip, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSendMessage(chip)}
                className="px-2 py-1 rounded-full text-[10px] font-medium bg-zinc-100 dark:bg-[#1C1C20] hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200/60 dark:border-zinc-700/60 whitespace-nowrap transition-colors cursor-pointer"
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Input Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-3 bg-white dark:bg-[#121215] border-t border-zinc-200 dark:border-zinc-800 flex items-center gap-2 shrink-0"
          >
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask Hacky about resume, jobs, or openings..."
              disabled={isThinking}
              className="flex-1 px-3 py-2 text-xs bg-zinc-50 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] rounded-xl text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600 transition-all font-sans"
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || isThinking}
              className="w-8 h-8 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-950 flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shrink-0"
              title="Send message"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}

      {/* Floating Mascot Trigger Button */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="pointer-events-auto relative group flex items-center gap-2 p-3 rounded-full bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-950 shadow-2xl border-2 border-zinc-200 dark:border-zinc-800 transition-all duration-200 cursor-pointer hover:scale-105 active:scale-95"
        title={isOpen ? 'Minimize Hacky' : 'Chat with Hacky'}
      >
        <span className="text-xl leading-none">🦉</span>
        {/* Pulsing online status indicator */}
        <span className="absolute top-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white dark:border-zinc-900 animate-pulse" />
        {!isOpen && (
          <span className="text-xs font-bold pr-1.5 hidden sm:inline-block font-sans">
            Ask Hacky
          </span>
        )}
      </button>
    </div>
  );
};

export default HackyWebMascot;
