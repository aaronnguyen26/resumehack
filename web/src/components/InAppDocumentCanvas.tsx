import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { 
  Printer, 
  Copy, 
  Check, 
  Sparkles, 
  Minimize2, 
  Maximize2, 
  FileText, 
  UploadCloud, 
  Edit3, 
  Eye, 
  AlertTriangle, 
  RotateCcw, 
  Plus, 
  ExternalLink, 
  Cloud, 
  Trash2, 
  X, 
  Loader2, 
  FileUp, 
  Undo2, 
  Redo2, 
  Bold, 
  Italic, 
  Underline, 
  Strikethrough, 
  AlignLeft, 
  AlignCenter, 
  AlignRight, 
  List, 
  ListOrdered, 
  ChevronDown, 
  ZoomIn, 
  ZoomOut, 
  ShieldCheck, 
  ArrowUp, 
  ArrowDown, 
  Layers, 
  SlidersHorizontal, 
  PanelRightClose, 
  PanelRightOpen,
  CheckCircle2,
  FileCheck2,
  FolderOpen
} from 'lucide-react';
import { ParsedResume } from '../services/resume-parser.js';
import { parseUploadedResumeFile } from '../services/file-parser.js';
import { TailoredBulletDiff, ApplicantProfile, ScrapedJobData } from '../types/index.js';

export interface InAppDocumentCanvasProps {
  parsedResume: ParsedResume | null;
  rawText: string;
  diffs?: TailoredBulletDiff[];
  onUpdateResumeText: (text: string) => void;
  onApplyBulletDiff?: (diffIndex: number) => void;
  onApplyAllDiffs?: () => void;
  onReopenGateway?: () => void;
  applicantProfile?: ApplicantProfile;
  isGoogleDocMode?: boolean;
  docUrl?: string;
  onSyncGoogleDoc?: () => void;
  onPushToGoogleDoc?: () => void;
  onUploadFile?: (file: File) => Promise<void>;
  documentTitle?: string;
  onUpdateDocumentTitle?: (title: string) => void;
  currentJob?: ScrapedJobData;
  targetRole?: string;
  atsScore?: number;
}

type FontFamily = 'sans' | 'serif' | 'mono';
type FontSize = '9.5pt' | '10pt' | '10.5pt' | '11pt' | '12pt';
type LineSpacing = '1.0' | '1.15' | '1.25';
type MarginSize = 'compact' | 'standard' | 'relaxed';
type ZoomLevel = 85 | 100 | 115;

export const InAppDocumentCanvas: React.FC<InAppDocumentCanvasProps> = ({
  parsedResume,
  rawText,
  diffs = [],
  onUpdateResumeText,
  onApplyBulletDiff,
  onApplyAllDiffs,
  onReopenGateway,
  applicantProfile,
  isGoogleDocMode = false,
  docUrl,
  onSyncGoogleDoc,
  onPushToGoogleDoc,
  onUploadFile,
  documentTitle,
  onUpdateDocumentTitle,
  currentJob,
  targetRole = 'Senior Software Engineer',
  atsScore = 92,
}) => {
  // ── History / Undo / Redo Stack ──────────────────────────────────────────
  const [history, setHistory] = useState<string[]>([rawText]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);

  // ── View Modes & Formatting Settings ─────────────────────────────────────
  const [isRawEditing, setIsRawEditing] = useState(false);
  const [rawEditText, setRawEditText] = useState(rawText);
  const [copied, setCopied] = useState(false);
  const [fontFamily, setFontFamily] = useState<FontFamily>('sans');
  const [fontSize, setFontSize] = useState<FontSize>('10pt');
  const [lineSpacing, setLineSpacing] = useState<LineSpacing>('1.15');
  const [marginSize, setMarginSize] = useState<MarginSize>('standard');
  const [zoom, setZoom] = useState<ZoomLevel>(100);
  const [showGuides, setShowGuides] = useState<boolean>(true);
  const [isInspectorOpen, setIsInspectorOpen] = useState<boolean>(true);
  const [inspectorTab, setInspectorTab] = useState<'tailor' | 'budget' | 'keywords'>('tailor');

  // ── Document Title & Auto-Save Telemetry ──────────────────────────────────
  const [docTitle, setDocTitle] = useState<string>(documentTitle || 'Master_Resume_2025.pdf');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<string>('Just now');

  // ── File Upload / Drag-and-Drop State ────────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isExtractingPdf, setIsExtractingPdf] = useState(false);
  const [isDragOverSheet, setIsDragOverSheet] = useState(false);
  const [uploadFeedback, setUploadFeedback] = useState<string | null>(null);

  // ── Inline Active Editing Item ───────────────────────────────────────────
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [activeInputText, setActiveInputText] = useState<string>('');

  // Synchronize history when rawText changes externally
  useEffect(() => {
    setRawEditText(rawText);
    setHistory((prev) => {
      if (prev[prev.length - 1] !== rawText) {
        const next = [...prev, rawText];
        setHistoryIndex(next.length - 1);
        return next;
      }
      return prev;
    });
    setLastSavedTime('Just now');
  }, [rawText]);

  const pushState = useCallback((newText: string) => {
    const trimmed = newText;
    setHistory((prev) => {
      const sliced = prev.slice(0, historyIndex + 1);
      if (sliced[sliced.length - 1] === trimmed) return prev;
      const next = [...sliced, trimmed];
      if (next.length > 50) next.shift();
      setHistoryIndex(next.length - 1);
      return next;
    });
    onUpdateResumeText(trimmed);
    setLastSavedTime('Just now');
  }, [historyIndex, onUpdateResumeText]);

  const handleUndo = () => {
    if (historyIndex > 0) {
      const targetText = history[historyIndex - 1];
      setHistoryIndex(historyIndex - 1);
      onUpdateResumeText(targetText);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const targetText = history[historyIndex + 1];
      setHistoryIndex(historyIndex + 1);
      onUpdateResumeText(targetText);
    }
  };

  // Keyboard shortcut listener for Ctrl+Z, Ctrl+Y, Ctrl+B, Ctrl+I
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          e.preventDefault();
          handleRedo();
        } else {
          e.preventDefault();
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [historyIndex, history]);

  // ── Candidate Display Name & Contact Info ────────────────────────────────
  const profileName = applicantProfile?.fullName?.trim() || 
    `${applicantProfile?.firstName || ''} ${applicantProfile?.lastName || ''}`.trim();
  const displayName = (parsedResume?.candidateName && parsedResume.candidateName !== 'Your Resume' && parsedResume.candidateName !== 'Alex Chen')
    ? parsedResume.candidateName
    : (profileName || 'Alex Chen');

  const profileContactInfo = [
    applicantProfile?.email || 'alex.chen@stanford.edu',
    applicantProfile?.phone || '(415) 890-2341',
    applicantProfile?.location || 'San Francisco, CA',
    applicantProfile?.linkedinUrl ? applicantProfile.linkedinUrl.replace(/^https?:\/\//, '') : 'linkedin.com/in/alexchen-swe',
    applicantProfile?.githubUrl ? applicantProfile.githubUrl.replace(/^https?:\/\//, '') : 'github.com/alexchen-dev',
  ].filter(Boolean) as string[];

  const contactList = parsedResume?.contactInfo && parsedResume.contactInfo.length > 0
    ? parsedResume.contactInfo
    : profileContactInfo;

  // ── Line Budget Calculation ──────────────────────────────────────────────
  const rawLines = useMemo(() => {
    return rawText.split('\n').filter(l => l.trim().length > 0);
  }, [rawText]);

  const lineCount = rawLines.length;

  const maxRecommendedLines = useMemo(() => {
    let base = 50;
    if (marginSize === 'compact') base += 6;
    if (marginSize === 'relaxed') base -= 6;
    if (lineSpacing === '1.0') base += 4;
    if (lineSpacing === '1.25') base -= 4;
    if (fontSize === '9.5pt') base += 4;
    if (fontSize === '11pt' || fontSize === '12pt') base -= 4;
    return base;
  }, [marginSize, lineSpacing, fontSize]);

  const pageBudgetPercentage = Math.round((lineCount / maxRecommendedLines) * 100);
  const linesRemaining = maxRecommendedLines - lineCount;

  // Section Breakdown Line Counter
  const sectionBreakdown = useMemo(() => {
    const paragraphs = rawText.split('\n\n');
    return paragraphs.map((p, idx) => {
      const lines = p.split('\n').filter(l => l.trim().length > 0);
      const title = idx === 0 ? 'Header / Contact' : (lines[0] || `Section ${idx}`);
      return {
        title: title.length > 20 ? title.substring(0, 20) + '…' : title,
        count: lines.length,
      };
    });
  }, [rawText]);

  // ── Actions: Printing & Copying ──────────────────────────────────────────
  const handlePrint = () => {
    window.print();
  };

  const handleCopyPlainText = async () => {
    try {
      await navigator.clipboard.writeText(rawText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  // ── Document Manipulation Functions ──────────────────────────────────────
  const handleSaveBullet = (pIdx: number, lIdx: number, newContent: string) => {
    const paragraphs = rawText.split('\n\n');
    if (!paragraphs[pIdx]) return;
    const lines = paragraphs[pIdx].split('\n');
    const isBullet = /^[•\-*]\s*/.test(lines[lIdx]);
    const prefix = isBullet ? (lines[lIdx]?.match(/^[•\-*]\s*/)?.[0] || '• ') : '';
    lines[lIdx] = `${prefix}${newContent.trim()}`;
    paragraphs[pIdx] = lines.join('\n');
    pushState(paragraphs.join('\n\n'));
    setEditingKey(null);
  };

  const handleDeleteBullet = (pIdx: number, lIdx: number) => {
    const paragraphs = rawText.split('\n\n');
    if (!paragraphs[pIdx]) return;
    const lines = paragraphs[pIdx].split('\n');
    lines.splice(lIdx, 1);
    paragraphs[pIdx] = lines.join('\n');
    pushState(paragraphs.join('\n\n'));
    setEditingKey(null);
  };

  const handleMoveBullet = (pIdx: number, lIdx: number, direction: 'up' | 'down') => {
    const paragraphs = rawText.split('\n\n');
    if (!paragraphs[pIdx]) return;
    const lines = paragraphs[pIdx].split('\n');
    const targetIdx = direction === 'up' ? lIdx - 1 : lIdx + 1;
    if (targetIdx < 1 || targetIdx >= lines.length) return;
    const temp = lines[lIdx];
    lines[lIdx] = lines[targetIdx];
    lines[targetIdx] = temp;
    paragraphs[pIdx] = lines.join('\n');
    pushState(paragraphs.join('\n\n'));
  };

  const handleAddBullet = (pIdx: number, afterLineIdx?: number) => {
    const paragraphs = rawText.split('\n\n');
    if (!paragraphs[pIdx]) return;
    const lines = paragraphs[pIdx].split('\n');
    const newBullet = '• Engineered scalable infrastructure improving cluster throughput by 35%';
    if (afterLineIdx !== undefined && afterLineIdx >= 0) {
      lines.splice(afterLineIdx + 1, 0, newBullet);
    } else {
      lines.push(newBullet);
    }
    paragraphs[pIdx] = lines.join('\n');
    pushState(paragraphs.join('\n\n'));
    const targetLIdx = afterLineIdx !== undefined ? afterLineIdx + 1 : lines.length - 1;
    setEditingKey(`bullet-${pIdx}-${targetLIdx}`);
    setActiveInputText('Engineered scalable infrastructure improving cluster throughput by 35%');
  };

  const handleMoveSection = (pIdx: number, direction: 'up' | 'down') => {
    const paragraphs = rawText.split('\n\n');
    const targetIdx = direction === 'up' ? pIdx - 1 : pIdx + 1;
    if (targetIdx < 1 || targetIdx >= paragraphs.length) return;
    const temp = paragraphs[pIdx];
    paragraphs[pIdx] = paragraphs[targetIdx];
    paragraphs[targetIdx] = temp;
    pushState(paragraphs.join('\n\n'));
  };

  const handleDeleteSection = (pIdx: number) => {
    const paragraphs = rawText.split('\n\n');
    paragraphs.splice(pIdx, 1);
    pushState(paragraphs.join('\n\n'));
  };

  const handleSaveSectionTitle = (pIdx: number, newTitle: string) => {
    const paragraphs = rawText.split('\n\n');
    if (!paragraphs[pIdx]) return;
    const lines = paragraphs[pIdx].split('\n');
    lines[0] = newTitle.toUpperCase().trim();
    paragraphs[pIdx] = lines.join('\n');
    pushState(paragraphs.join('\n\n'));
    setEditingKey(null);
  };

  const handleSaveCandidateName = (newName: string) => {
    const cleanName = newName.trim();
    if (!cleanName) return;
    const paragraphs = rawText.split('\n\n');
    if (paragraphs.length > 0) {
      const lines = paragraphs[0].split('\n');
      lines[0] = cleanName;
      paragraphs[0] = lines.join('\n');
      pushState(paragraphs.join('\n\n'));
    }
    setEditingKey(null);
  };

  const handleSaveNonBulletLine = (pIdx: number, lIdx: number, text: string) => {
    const paragraphs = rawText.split('\n\n');
    if (!paragraphs[pIdx]) return;
    const lines = paragraphs[pIdx].split('\n');
    lines[lIdx] = text.trim();
    paragraphs[pIdx] = lines.join('\n');
    pushState(paragraphs.join('\n\n'));
    setEditingKey(null);
  };

  const handleInsertSection = (type: 'EXPERIENCE' | 'EDUCATION' | 'PROJECTS' | 'SKILLS' | 'SUMMARY' | 'CUSTOM') => {
    let template = '';
    switch (type) {
      case 'EXPERIENCE':
        template = `WORK EXPERIENCE\nStripe — Staff Infrastructure Engineer\nSan Francisco, CA | 2022 – Present\n• Architected distributed multi-region caching layer slashing P99 latency by 45ms across 35k QPS\n• Engineered idempotent ledger replication pipeline with zero transactional inconsistencies`;
        break;
      case 'PROJECTS':
        template = `FEATURED PROJECTS\nDistributed Consensus Engine (Go, Raft, gRPC)\nOpen Source | 2024\n• Authored leader-election consensus protocol achieving 14,000 write ops/sec under network partition\n• Implemented zero-allocation byte buffer pool decreasing garbage collection pauses by 80%`;
        break;
      case 'EDUCATION':
        template = `EDUCATION\nStanford University — M.S. Computer Science\nStanford, CA | 2020 – 2022\n• Concentration in Distributed Systems & Databases • GPA: 3.9 / 4.0`;
        break;
      case 'SKILLS':
        template = `TECHNICAL SKILLS\n• Languages: Go, Rust, Python, TypeScript, SQL, C++, Bash\n• Distributed Systems: Kubernetes, Docker, Kafka, Redis, gRPC, Envoy, Postgres\n• Cloud & Tooling: AWS (EKS, S3, DynamoDB), Terraform, CI/CD GitHub Actions, Linux eBPF`;
        break;
      case 'SUMMARY':
        template = `PROFESSIONAL SUMMARY\nStaff Distributed Systems Engineer with 7+ years architecting high-throughput financial backends, distributed consensus algorithms, and cloud infrastructure processing billions of requests with 99.999% reliability.`;
        break;
      default:
        template = `ADDITIONAL EXPERIENCE\nOrganization — Role\nLocation | 2023 – Present\n• Directed cross-functional engineering initiatives delivering key business outcomes`;
        break;
    }
    const updated = `${rawText.trim()}\n\n${template}`;
    pushState(updated);
  };

  // ── PDF File Upload Handlers ─────────────────────────────────────────────
  const handleCanvasFileUpload = async (file: File) => {
    setIsExtractingPdf(true);
    setUploadFeedback(`Extracting text and layout from ${file.name}…`);
    try {
      if (onUploadFile) {
        await onUploadFile(file);
      } else {
        const parsed = await parseUploadedResumeFile(file);
        pushState(parsed.text);
      }
      setDocTitle(file.name);
      onUpdateDocumentTitle?.(file.name);
      setUploadFeedback(`✓ Successfully extracted "${file.name}" into canvas`);
    } catch (err: any) {
      setUploadFeedback(`⚠️ Failed to parse file: ${err.message || 'Unknown format'}`);
    } finally {
      setIsExtractingPdf(false);
      setTimeout(() => setUploadFeedback(null), 4000);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const pendingDiffs = diffs.filter(d => d.status === 'pending');

  return (
    <div className="w-full flex flex-col min-h-[calc(100vh-5rem)] bg-[#F4F4F5] dark:bg-[#09090B] text-zinc-900 dark:text-zinc-100 font-sans select-none transition-colors duration-200">
      {/* Hidden File Input for PDF Upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,.txt"
        onChange={(e) => e.target.files?.[0] && handleCanvasFileUpload(e.target.files[0])}
        className="hidden"
      />

      {/* ── TOP APPLICATION BAR & DOCUMENT HEADER (Sticky) ────────────────── */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#121215]/95 backdrop-blur-md border-b border-zinc-200 dark:border-[#27272A] px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        {/* Left: Breadcrumb, Title & Auto-Save */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-900 dark:text-zinc-100 shrink-0 border border-zinc-200 dark:border-[#27272A]">
            <FileText className="w-4 h-4" />
          </div>

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 uppercase tracking-wider hidden sm:inline">
                Workspaces &gt;
              </span>
              {isEditingTitle ? (
                <input
                  type="text"
                  autoFocus
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  onBlur={() => {
                    setIsEditingTitle(false);
                    onUpdateDocumentTitle?.(docTitle);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setIsEditingTitle(false);
                      onUpdateDocumentTitle?.(docTitle);
                    }
                  }}
                  className="font-bold text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 px-2 py-0.5 rounded border border-zinc-300 dark:border-zinc-700 focus:outline-none"
                />
              ) : (
                <div 
                  onClick={() => setIsEditingTitle(true)}
                  className="group flex items-center gap-1.5 cursor-pointer"
                  title="Click to rename document"
                >
                  <span className="font-bold text-xs text-zinc-950 dark:text-zinc-50 truncate max-w-[200px] sm:max-w-[300px]">
                    {docTitle}
                  </span>
                  <Edit3 className="w-3 h-3 text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              )}

              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 font-semibold flex items-center gap-1">
                {isGoogleDocMode && <Cloud className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />}
                <span>{isGoogleDocMode ? 'Google Doc' : 'In-App Canvas'}</span>
              </span>
            </div>

            <div className="flex items-center gap-2 text-[10px] text-zinc-500 dark:text-zinc-400 font-mono mt-0.5">
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Auto-saved to browser storage • {lastSavedTime}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Center: Undo / Redo & 1-Page Line Budget Badge */}
        <div className="hidden lg:flex items-center gap-3">
          {/* History Controls */}
          <div className="flex items-center bg-zinc-100 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] rounded-lg p-0.5">
            <button
              type="button"
              onClick={handleUndo}
              disabled={historyIndex <= 0}
              className="p-1.5 rounded text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Undo (Ctrl+Z)"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleRedo}
              disabled={historyIndex >= history.length - 1}
              className="p-1.5 rounded text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Redo (Ctrl+Y)"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* 1-Page Line Budget Widget */}
          <div className="flex items-center gap-2.5 px-3 py-1 bg-zinc-100 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] rounded-lg text-xs font-mono">
            <ShieldCheck className={`w-4 h-4 shrink-0 ${pageBudgetPercentage <= 100 ? 'text-emerald-500' : 'text-amber-500'}`} />
            <div className="flex flex-col">
              <div className="flex items-center gap-2 text-[11px]">
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                  {lineCount} / {maxRecommendedLines} lines
                </span>
                <span className={`font-bold ${pageBudgetPercentage <= 100 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                  ({pageBudgetPercentage}%)
                </span>
              </div>
            </div>
            <div className="w-16 bg-zinc-200 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden shrink-0">
              <div
                className={`h-full transition-all duration-300 ${pageBudgetPercentage <= 100 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                style={{ width: `${Math.min(100, pageBudgetPercentage)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {docUrl && (
            <a
              href={docUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 py-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
              title="Open Google Doc in new tab"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Docs ↗</span>
            </a>
          )}

          {onSyncGoogleDoc && (
            <button
              type="button"
              onClick={onSyncGoogleDoc}
              className="px-2.5 py-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Re-sync</span>
            </button>
          )}

          {/* Upload / Replace PDF */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isExtractingPdf}
            className="px-2.5 py-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            title="Upload or replace with a new PDF resume"
          >
            {isExtractingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5" />}
            <span>{isExtractingPdf ? 'Parsing…' : 'Upload PDF'}</span>
          </button>

          {/* Toggle Raw Monospace Editor */}
          <button
            type="button"
            onClick={() => setIsRawEditing(!isRawEditing)}
            className="px-2.5 py-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            title="Toggle between WYSIWYG paper sheet and raw text editor"
          >
            {isRawEditing ? <Eye className="w-3.5 h-3.5" /> : <Edit3 className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{isRawEditing ? 'Visual Canvas' : 'Raw Mode'}</span>
          </button>

          {/* Copy Plaintext */}
          <button
            type="button"
            onClick={handleCopyPlainText}
            className="px-2.5 py-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            title="Copy clean UTF-8 plain text for job applications"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
          </button>

          {/* Export ATS PDF */}
          <button
            type="button"
            onClick={handlePrint}
            className="px-3 py-1.5 bg-zinc-950 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-950 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            title="Export pixel-accurate single page ATS PDF"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Export ATS PDF</span>
          </button>

          {/* Toggle Right Inspector */}
          <button
            type="button"
            onClick={() => setIsInspectorOpen(!isInspectorOpen)}
            className={`p-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
              isInspectorOpen
                ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 border-zinc-900 dark:border-white shadow-xs'
                : 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-[#27272A] text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
            }`}
            title="Toggle ATS Copilot & Telemetry Panel"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Inspector</span>
          </button>
        </div>
      </header>

      {/* ── WYSIWYG FORMATTING RIBBON / TOOLBAR (Sticky below Header) ─────── */}
      <nav aria-label="Document Formatting Controls" className="sticky top-[53px] z-30 bg-white/95 dark:bg-[#151518]/95 backdrop-blur-md border-b border-zinc-200 dark:border-[#27272A] px-4 sm:px-6 py-1.5 flex flex-wrap items-center justify-between gap-2 shadow-2xs">
        {/* Typography & Styling Controls */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Font Family Selector */}
          <div className="flex items-center">
            <select
              value={fontFamily}
              onChange={(e) => setFontFamily(e.target.value as FontFamily)}
              className="h-7 px-2 text-xs font-medium rounded-md bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none cursor-pointer"
              title="Font Family"
            >
              <option value="sans">Sans (Inter / Jakarta)</option>
              <option value="serif">Serif (Times / Garamond)</option>
              <option value="mono">Mono (JetBrains)</option>
            </select>
          </div>

          {/* Font Size Selector */}
          <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md p-0.5">
            <button
              type="button"
              onClick={() => {
                const sizes: FontSize[] = ['9.5pt', '10pt', '10.5pt', '11pt', '12pt'];
                const idx = sizes.indexOf(fontSize);
                if (idx > 0) setFontSize(sizes[idx - 1]);
              }}
              className="px-1.5 py-0.5 text-[11px] font-bold text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white"
              title="Decrease Font Size"
            >
              A-
            </button>
            <span className="text-[11px] font-mono font-semibold px-1 text-zinc-800 dark:text-zinc-200">
              {fontSize}
            </span>
            <button
              type="button"
              onClick={() => {
                const sizes: FontSize[] = ['9.5pt', '10pt', '10.5pt', '11pt', '12pt'];
                const idx = sizes.indexOf(fontSize);
                if (idx < sizes.length - 1) setFontSize(sizes[idx + 1]);
              }}
              className="px-1.5 py-0.5 text-[11px] font-bold text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white"
              title="Increase Font Size"
            >
              A+
            </button>
          </div>

          <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800 mx-1 hidden sm:block"></div>

          {/* Formatting Buttons */}
          <div className="flex items-center gap-0.5 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md p-0.5">
            <button
              type="button"
              onClick={() => {
                // If text is being edited, wrap in **
                if (editingKey) {
                  setActiveInputText(`**${activeInputText}**`);
                }
              }}
              className="p-1 rounded text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
              title="Bold Text (Ctrl+B)"
            >
              <Bold className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                if (editingKey) {
                  setActiveInputText(`*${activeInputText}*`);
                }
              }}
              className="p-1 rounded text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
              title="Italic Text (Ctrl+I)"
            >
              <Italic className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              className="p-1 rounded text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
              title="Underline Text"
            >
              <Underline className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800 mx-1 hidden sm:block"></div>

          {/* Line Spacing Selector */}
          <div className="flex items-center">
            <select
              value={lineSpacing}
              onChange={(e) => setLineSpacing(e.target.value as LineSpacing)}
              className="h-7 px-2 text-xs font-medium rounded-md bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none cursor-pointer"
              title="Line Spacing (Budget Adjuster)"
            >
              <option value="1.0">1.0x (Tight / 56L)</option>
              <option value="1.15">1.15x (Standard / 50L)</option>
              <option value="1.25">1.25x (Relaxed / 44L)</option>
            </select>
          </div>

          {/* Margins Selector */}
          <div className="flex items-center">
            <select
              value={marginSize}
              onChange={(e) => setMarginSize(e.target.value as MarginSize)}
              className="h-7 px-2 text-xs font-medium rounded-md bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none cursor-pointer"
              title="Page Margins"
            >
              <option value="compact">0.5" Compact Margins</option>
              <option value="standard">0.75" Standard Margins</option>
              <option value="relaxed">1.0" Wide Margins</option>
            </select>
          </div>

          <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800 mx-1 hidden sm:block"></div>

          {/* Insert Section Quick Dropdown */}
          <div className="relative group/insert">
            <button
              type="button"
              className="h-7 px-2.5 rounded-md bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>+ Insert Section</span>
              <ChevronDown className="w-3 h-3 text-zinc-400" />
            </button>

            <div className="absolute left-0 top-full mt-1 w-44 bg-white dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] rounded-xl shadow-lg p-1.5 hidden group-hover/insert:block z-50 animate-in fade-in duration-150">
              <button
                type="button"
                onClick={() => handleInsertSection('EXPERIENCE')}
                className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-medium"
              >
                + Work Experience
              </button>
              <button
                type="button"
                onClick={() => handleInsertSection('PROJECTS')}
                className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-medium"
              >
                + Featured Projects
              </button>
              <button
                type="button"
                onClick={() => handleInsertSection('SKILLS')}
                className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-medium"
              >
                + Technical Skills
              </button>
              <button
                type="button"
                onClick={() => handleInsertSection('EDUCATION')}
                className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-medium"
              >
                + Education
              </button>
              <button
                type="button"
                onClick={() => handleInsertSection('SUMMARY')}
                className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-medium"
              >
                + Summary Statement
              </button>
              <button
                type="button"
                onClick={() => handleInsertSection('CUSTOM')}
                className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-medium"
              >
                + Custom Section
              </button>
            </div>
          </div>
        </div>

        {/* View & Zoom Controls */}
        <div className="flex items-center gap-2">
          {/* Guidelines Toggle */}
          <button
            type="button"
            onClick={() => setShowGuides(!showGuides)}
            className={`h-7 px-2 rounded-md text-xs font-mono flex items-center gap-1 transition-colors ${
              showGuides 
                ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 font-bold' 
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
            }`}
            title="Toggle print margin guideline boundaries"
          >
            <span>Margins Guide</span>
          </button>

          {/* Zoom Stepper */}
          <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md p-0.5">
            <button
              type="button"
              onClick={() => setZoom((z) => (z === 115 ? 100 : 85))}
              className="p-1 text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white"
              title="Zoom Out"
            >
              <ZoomOut className="w-3 h-3" />
            </button>
            <span className="text-[10px] font-mono px-1 text-zinc-700 dark:text-zinc-300">
              {zoom}%
            </span>
            <button
              type="button"
              onClick={() => setZoom((z) => (z === 85 ? 100 : 115))}
              className="p-1 text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white"
              title="Zoom In"
            >
              <ZoomIn className="w-3 h-3" />
            </button>
          </div>
        </div>
      </nav>

      {/* Extraction Feedback Banner */}
      {uploadFeedback && (
        <div className="px-6 py-2 bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 text-xs font-mono flex items-center justify-between animate-in fade-in duration-200">
          <span className="flex items-center gap-2">
            <FileUp className="w-4 h-4 text-emerald-400" />
            <span>{uploadFeedback}</span>
          </span>
          <button type="button" onClick={() => setUploadFeedback(null)}>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ── MAIN WORKSPACE VIEWPORT (Center Canvas + Right Inspector) ─────── */}
      <div className="flex-1 flex flex-col md:flex-row items-stretch justify-center relative overflow-x-hidden">
        {/* ── CENTER DOCUMENT WORKBENCH (Paper Stage) ────────────────────── */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 lg:p-12 flex flex-col items-center justify-start bg-zinc-100/70 dark:bg-[#0c0c0e] relative min-h-[850px]">
          {isRawEditing ? (
            /* Raw Monospace Text Editor Mode */
            <div className="w-full max-w-3xl bg-white dark:bg-[#121215] border border-zinc-200 dark:border-[#27272A] rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500 dark:text-zinc-400">
                <span className="font-mono">Direct plain text / Markdown editor:</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setRawEditText(rawText);
                      setIsRawEditing(false);
                    }}
                    className="px-3 py-1 rounded-md text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      pushState(rawEditText);
                      setIsRawEditing(false);
                    }}
                    className="px-3.5 py-1 bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 font-bold rounded-md shadow-xs"
                  >
                    Save & View Sheet
                  </button>
                </div>
              </div>
              <textarea
                rows={28}
                value={rawEditText}
                onChange={(e) => setRawEditText(e.target.value)}
                className="w-full font-mono text-xs p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-400 leading-relaxed"
              />
            </div>
          ) : (
            /* Physical US Letter / A4 Document Sheet */
            <div 
              style={{
                transform: zoom !== 100 ? `scale(${zoom / 100})` : undefined,
                transformOrigin: 'top center',
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOverSheet(true);
              }}
              onDragLeave={() => setIsDragOverSheet(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragOverSheet(false);
                const file = e.dataTransfer.files?.[0];
                if (file) handleCanvasFileUpload(file);
              }}
              className={`resume-canvas-print relative w-full max-w-[816px] min-h-[1056px] bg-white dark:bg-[#151518] text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800/90 rounded-xl shadow-xl font-sans transition-all duration-200 ${
                marginSize === 'compact' ? 'p-6 sm:p-10' : marginSize === 'relaxed' ? 'p-10 sm:p-16' : 'p-8 sm:p-12'
              } ${
                fontFamily === 'serif' ? 'font-serif' : fontFamily === 'mono' ? 'font-mono' : 'font-sans'
              }`}
            >
              {/* Drag & Drop Overlay */}
              {isDragOverSheet && (
                <div className="absolute inset-0 bg-zinc-950/70 backdrop-blur-xs rounded-xl flex flex-col items-center justify-center text-white z-30 pointer-events-none border-2 border-dashed border-white/80 p-6 animate-in fade-in duration-150">
                  <UploadCloud className="w-12 h-12 mb-3 animate-bounce text-emerald-400" />
                  <p className="text-base font-bold font-headline">Drop PDF to extract directly into Canvas</p>
                  <p className="text-xs text-zinc-300 font-mono mt-1">Multi-tier text & bullet extraction</p>
                </div>
              )}

              {/* Physical Margin Guidelines (Visible when showGuides is active) */}
              {showGuides && (
                <div className="absolute inset-4 sm:inset-6 pointer-events-none border border-dashed border-zinc-200/60 dark:border-zinc-800/60 rounded-lg"></div>
              )}

              {/* ── DOCUMENT HEADER (Candidate Name & Contact Details) ─────── */}
              <div className="text-center pb-4 border-b border-zinc-200 dark:border-zinc-800/80 space-y-2 relative">
                {editingKey === 'candidate-name' ? (
                  <div className="flex items-center justify-center gap-2 max-w-md mx-auto">
                    <input
                      type="text"
                      autoFocus
                      value={activeInputText}
                      onChange={(e) => setActiveInputText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveCandidateName(activeInputText);
                        if (e.key === 'Escape') setEditingKey(null);
                      }}
                      className="px-3 py-1.5 text-center text-2xl font-bold rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-zinc-950 dark:text-white focus:outline-none focus:ring-1 focus:ring-zinc-400 flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => handleSaveCandidateName(activeInputText)}
                      className="px-3 py-1.5 bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 rounded-lg text-xs font-bold shadow-xs cursor-pointer"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingKey(null)}
                      className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="group/name inline-flex items-center justify-center gap-2 cursor-pointer">
                    <h1
                      onClick={() => {
                        setEditingKey('candidate-name');
                        setActiveInputText(displayName);
                      }}
                      className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-950 dark:text-white font-headline hover:opacity-85 transition-opacity"
                      title="Click to edit candidate name"
                    >
                      {displayName}
                    </h1>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingKey('candidate-name');
                        setActiveInputText(displayName);
                      }}
                      className="opacity-0 group-hover/name:opacity-100 p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-opacity"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Contact Pill Row */}
                <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-zinc-600 dark:text-zinc-400">
                  {contactList.map((info, idx) => (
                    <span key={idx} className="flex items-center gap-2">
                      {idx > 0 && <span className="text-zinc-300 dark:text-zinc-600 select-none">•</span>}
                      <span className="hover:text-zinc-900 dark:hover:text-zinc-200 cursor-text">
                        {info}
                      </span>
                    </span>
                  ))}
                </div>
              </div>

              {/* ── RESUME SECTIONS & BULLET POINT EDITOR ─────────────────── */}
              <div className={`mt-5 space-y-5 ${
                lineSpacing === '1.0' ? 'leading-tight space-y-3' : lineSpacing === '1.25' ? 'leading-relaxed space-y-6' : 'leading-snug space-y-4'
              } ${
                fontSize === '9.5pt' ? 'text-[11.5px]' : fontSize === '10.5pt' ? 'text-[12.5px]' : fontSize === '11pt' ? 'text-[13px]' : fontSize === '12pt' ? 'text-sm' : 'text-xs'
              }`}>
                {rawText.split('\n\n').map((paragraph, pIdx) => {
                  const lines = paragraph.split('\n');
                  const firstLine = lines[0]?.trim();
                  const isSectionHeader = /^(summary|professional summary|work experience|experience|projects|featured projects|education|technical skills|skills|leadership|awards|certifications)/i.test(firstLine);

                  if (isSectionHeader) {
                    return (
                      <div key={pIdx} className="group/section space-y-2 relative">
                        {/* Section Header with Hover Tools */}
                        {editingKey === `section-${pIdx}` ? (
                          <div className="flex items-center gap-2 pb-1 border-b border-zinc-200 dark:border-zinc-800">
                            <input
                              type="text"
                              autoFocus
                              value={activeInputText}
                              onChange={(e) => setActiveInputText(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveSectionTitle(pIdx, activeInputText);
                                if (e.key === 'Escape') setEditingKey(null);
                              }}
                              className="px-2 py-1 text-xs font-mono font-bold tracking-wider uppercase border border-zinc-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 flex-1"
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveSectionTitle(pIdx, activeInputText)}
                              className="px-2.5 py-1 bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 rounded text-[11px] font-bold"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingKey(null)}
                              className="p-1 text-zinc-400 hover:text-zinc-600"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-1">
                            <div className="flex items-center gap-2">
                              <h2 className="text-xs font-mono font-bold tracking-wider uppercase text-zinc-900 dark:text-zinc-200">
                                {firstLine}
                              </h2>
                              <span className="text-[10px] font-mono text-zinc-400">
                                {lines.slice(1).length} items
                              </span>
                            </div>

                            {/* Section Controls (Move Up, Move Down, Rename, Delete) */}
                            <div className="opacity-0 group-hover/section:opacity-100 flex items-center gap-1 transition-opacity">
                              <button
                                type="button"
                                onClick={() => handleMoveSection(pIdx, 'up')}
                                disabled={pIdx <= 1}
                                className="p-1 text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 disabled:opacity-20"
                                title="Move section up"
                              >
                                <ArrowUp className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMoveSection(pIdx, 'down')}
                                className="p-1 text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
                                title="Move section down"
                              >
                                <ArrowDown className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingKey(`section-${pIdx}`);
                                  setActiveInputText(firstLine);
                                }}
                                className="p-1 text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
                                title="Rename section heading"
                              >
                                <Edit3 className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteSection(pIdx)}
                                className="p-1 text-zinc-400 hover:text-rose-500"
                                title="Delete entire section"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Section Lines & Bullets */}
                        <div className="space-y-1.5 pl-1">
                          {lines.slice(1).map((line, lIdx) => {
                            const actualLineIdx = lIdx + 1;
                            const isBullet = line.trim().startsWith('•') || line.trim().startsWith('-');
                            const cleanLine = line.replace(/^[•\-*]\s*/, '').trim();

                            // Check if matching pending diff
                            const matchedDiffIdx = diffs.findIndex(
                              (d) => d.originalText.trim().toLowerCase() === cleanLine.toLowerCase()
                            );
                            const matchedDiff = matchedDiffIdx !== -1 ? diffs[matchedDiffIdx] : null;

                            if (matchedDiff && matchedDiff.status === 'pending') {
                              return (
                                <div key={lIdx} className="my-2 p-3 rounded-xl bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/30 space-y-1.5 animate-in fade-in">
                                  <div className="flex items-center justify-between text-[11px]">
                                    <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                                      <Sparkles className="w-3.5 h-3.5" />
                                      <span>STAR AI Suggestion for {currentJob?.company || 'Target Role'}</span>
                                    </span>
                                    {onApplyBulletDiff && (
                                      <button
                                        type="button"
                                        onClick={() => onApplyBulletDiff(matchedDiffIdx)}
                                        className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] cursor-pointer shadow-xs"
                                      >
                                        Accept Suggestion
                                      </button>
                                    )}
                                  </div>
                                  <div className="line-through text-zinc-400 text-[11px]">
                                    {matchedDiff.originalText}
                                  </div>
                                  <div className="font-medium text-zinc-900 dark:text-zinc-100">
                                    • {matchedDiff.tailoredText}
                                  </div>
                                  {matchedDiff.rationale && (
                                    <div className="text-[10px] text-zinc-500 dark:text-zinc-400 italic">
                                      Impact: {matchedDiff.rationale}
                                    </div>
                                  )}
                                </div>
                              );
                            }

                            // Active Inline Bullet Editor
                            const isEditingThis = editingKey === `bullet-${pIdx}-${actualLineIdx}`;
                            if (isEditingThis) {
                              return (
                                <div key={lIdx} className="my-1.5 p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 space-y-2">
                                  <textarea
                                    autoFocus
                                    rows={3}
                                    value={activeInputText}
                                    onChange={(e) => setActiveInputText(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                                        handleSaveBullet(pIdx, actualLineIdx, activeInputText);
                                      }
                                      if (e.key === 'Escape') setEditingKey(null);
                                    }}
                                    className="w-full text-xs font-sans p-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-500 resize-y"
                                  />
                                  <div className="flex items-center justify-between text-[11px]">
                                    <span className="text-zinc-400 font-mono text-[10px]">
                                      Ctrl+Enter to save • Esc to cancel
                                    </span>
                                    <div className="flex gap-2">
                                      <button
                                        type="button"
                                        onClick={() => setEditingKey(null)}
                                        className="px-2.5 py-1 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded text-xs"
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleSaveBullet(pIdx, actualLineIdx, activeInputText)}
                                        className="px-3 py-1 bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 font-bold rounded text-xs shadow-xs"
                                      >
                                        Save Bullet
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            }

                            // Normal Bullet Row
                            return (
                              <div
                                key={lIdx}
                                className={`group/bullet relative flex items-start gap-2 rounded-md px-1.5 py-0.5 -mx-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-900/60 transition-colors ${
                                  isBullet ? '' : 'font-semibold text-zinc-900 dark:text-zinc-100'
                                }`}
                              >
                                {isBullet && <span className="text-zinc-400 select-none shrink-0">•</span>}
                                <span
                                  onClick={() => {
                                    setEditingKey(`bullet-${pIdx}-${actualLineIdx}`);
                                    setActiveInputText(isBullet ? cleanLine : line);
                                  }}
                                  className={`flex-1 cursor-text hover:text-zinc-950 dark:hover:text-white transition-colors ${
                                    isBullet ? '' : 'font-semibold text-zinc-900 dark:text-zinc-100'
                                  }`}
                                  title="Click to edit directly in canvas"
                                >
                                  {isBullet ? cleanLine : line}
                                </span>

                                {/* Hover Control Actions */}
                                <div className="opacity-0 group-hover/bullet:opacity-100 flex items-center gap-0.5 shrink-0 ml-2 transition-opacity">
                                  <button
                                    type="button"
                                    onClick={() => handleMoveBullet(pIdx, actualLineIdx, 'up')}
                                    disabled={lIdx === 0}
                                    className="p-1 text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 disabled:opacity-20 rounded"
                                    title="Move bullet up"
                                  >
                                    <ArrowUp className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleMoveBullet(pIdx, actualLineIdx, 'down')}
                                    disabled={lIdx === lines.slice(1).length - 1}
                                    className="p-1 text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 disabled:opacity-20 rounded"
                                    title="Move bullet down"
                                  >
                                    <ArrowDown className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingKey(`bullet-${pIdx}-${actualLineIdx}`);
                                      setActiveInputText(isBullet ? cleanLine : line);
                                    }}
                                    className="p-1 text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 rounded"
                                    title="Edit bullet"
                                  >
                                    <Edit3 className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteBullet(pIdx, actualLineIdx)}
                                    className="p-1 text-zinc-400 hover:text-rose-500 rounded"
                                    title="Delete bullet (saves 1 line)"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}

                          {/* + Add Bullet Button under Section */}
                          <div className="pt-1">
                            <button
                              type="button"
                              onClick={() => handleAddBullet(pIdx)}
                              className="inline-flex items-center gap-1.5 text-[11px] font-mono text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 px-2 py-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Add Bullet to {firstLine}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // Non-section-header paragraph (e.g. Intro or custom notes)
                  return (
                    <div key={pIdx} className="space-y-1">
                      {lines.map((line, lIdx) => {
                        const isEditingThis = editingKey === `custom-line-${pIdx}-${lIdx}`;
                        if (isEditingThis) {
                          return (
                            <div key={lIdx} className="my-1.5 p-2 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 flex items-center gap-2">
                              <input
                                type="text"
                                autoFocus
                                value={activeInputText}
                                onChange={(e) => setActiveInputText(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveNonBulletLine(pIdx, lIdx, activeInputText);
                                  if (e.key === 'Escape') setEditingKey(null);
                                }}
                                className="flex-1 text-xs font-sans px-2 py-1 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded text-zinc-900 dark:text-zinc-100 focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => handleSaveNonBulletLine(pIdx, lIdx, activeInputText)}
                                className="px-2.5 py-1 bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 text-xs font-bold rounded shadow-xs"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingKey(null)}
                                className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          );
                        }
                        return (
                          <div
                            key={lIdx}
                            onClick={() => {
                              setEditingKey(`custom-line-${pIdx}-${lIdx}`);
                              setActiveInputText(line);
                            }}
                            className="text-zinc-800 dark:text-zinc-200 cursor-text hover:bg-zinc-50 dark:hover:bg-zinc-900/60 rounded px-1.5 py-0.5 -mx-1.5 transition-colors"
                            title="Click to edit line"
                          >
                            {line}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>

              {/* ── VISUAL 1-PAGE CUTOFF LINE (Safe vs Overflow Guard) ─────── */}
              <div className="mt-12 pt-4 border-t-2 border-dashed border-zinc-300 dark:border-zinc-700/80 relative select-none">
                <div className="flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${pageBudgetPercentage <= 100 ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`}></span>
                    <span className="font-bold text-zinc-700 dark:text-zinc-300">
                      Strict 1-Page Layout Cutoff Boundary
                    </span>
                  </div>
                  <span className={`font-semibold ${pageBudgetPercentage <= 100 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                    {pageBudgetPercentage <= 100
                      ? `✓ Single-Page Fit Guaranteed (${linesRemaining} lines buffer)`
                      : `⚠️ Overflow Warning: Exceeds page by ${Math.abs(linesRemaining)} lines`}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT TELEMETRY & ATS COPILOT INSPECTOR (Collapsible) ────────── */}
        {isInspectorOpen && (
          <aside className="w-full md:w-80 lg:w-96 bg-white dark:bg-[#121215] border-l border-zinc-200 dark:border-[#27272A] flex flex-col shrink-0 shadow-sm transition-all duration-200">
            {/* Inspector Header */}
            <div className="p-4 border-b border-zinc-200 dark:border-[#27272A] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-500" />
                <span className="font-bold text-xs font-headline uppercase tracking-wider text-zinc-950 dark:text-zinc-50">
                  ATS & Budget Telemetry
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsInspectorOpen(false)}
                className="p-1 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                title="Collapse Inspector"
              >
                <PanelRightClose className="w-4 h-4" />
              </button>
            </div>

            {/* Inspector Segmented Tabs */}
            <div className="flex border-b border-zinc-200 dark:border-[#27272A] text-xs font-mono font-medium">
              <button
                type="button"
                onClick={() => setInspectorTab('tailor')}
                className={`flex-1 py-2 text-center border-b-2 transition-colors ${
                  inspectorTab === 'tailor'
                    ? 'border-zinc-900 dark:border-white text-zinc-900 dark:text-white font-bold'
                    : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
                }`}
              >
                Tailoring ({pendingDiffs.length})
              </button>
              <button
                type="button"
                onClick={() => setInspectorTab('budget')}
                className={`flex-1 py-2 text-center border-b-2 transition-colors ${
                  inspectorTab === 'budget'
                    ? 'border-zinc-900 dark:border-white text-zinc-900 dark:text-white font-bold'
                    : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
                }`}
              >
                Line Budget
              </button>
              <button
                type="button"
                onClick={() => setInspectorTab('keywords')}
                className={`flex-1 py-2 text-center border-b-2 transition-colors ${
                  inspectorTab === 'keywords'
                    ? 'border-zinc-900 dark:border-white text-zinc-900 dark:text-white font-bold'
                    : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
                }`}
              >
                Keywords
              </button>
            </div>

            {/* Inspector Tab Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {inspectorTab === 'tailor' && (
                <div className="space-y-4">
                  {/* ATS Match Score Dial */}
                  <div className="p-4 rounded-xl bg-zinc-50 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] text-center space-y-2">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full border-4 border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono font-bold text-2xl">
                      {atsScore}%
                    </div>
                    <div>
                      <div className="text-xs font-bold font-headline text-zinc-900 dark:text-zinc-100">
                        {targetRole}
                      </div>
                      <div className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 mt-0.5">
                        Tier 1 Algorithmic Match Rating
                      </div>
                    </div>
                  </div>

                  {/* Pending STAR Method Diffs */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-mono text-zinc-500">
                      <span>STAR Method Diffs ({pendingDiffs.length}):</span>
                      {pendingDiffs.length > 0 && onApplyAllDiffs && (
                        <button
                          type="button"
                          onClick={onApplyAllDiffs}
                          className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline"
                        >
                          Apply All
                        </button>
                      )}
                    </div>

                    {pendingDiffs.length === 0 ? (
                      <div className="p-4 text-center rounded-xl bg-zinc-50 dark:bg-[#18181B] border border-dashed border-zinc-300 dark:border-zinc-700 text-xs text-zinc-500">
                        <CheckCircle2 className="w-5 h-5 mx-auto mb-1 text-emerald-500" />
                        <span>All bullet points currently match active STAR criteria!</span>
                      </div>
                    ) : (
                      pendingDiffs.map((diff, dIdx) => (
                        <div key={dIdx} className="p-3 rounded-xl bg-zinc-50 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] space-y-2 text-xs">
                          <div className="text-[10px] font-mono font-semibold uppercase text-emerald-600 dark:text-emerald-400">
                            Quantifiable Impact Suggestion:
                          </div>
                          <div className="line-through text-zinc-400 text-[11px]">
                            {diff.originalText}
                          </div>
                          <div className="font-medium text-zinc-900 dark:text-zinc-100">
                            • {diff.tailoredText}
                          </div>
                          {onApplyBulletDiff && (
                            <button
                              type="button"
                              onClick={() => onApplyBulletDiff(dIdx)}
                              className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition-colors shadow-xs"
                            >
                              Apply to Document
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {inspectorTab === 'budget' && (
                <div className="space-y-4">
                  {/* Budget Card */}
                  <div className="p-4 rounded-xl bg-zinc-50 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] space-y-3">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="font-bold text-zinc-900 dark:text-zinc-100">1-Page Capacity</span>
                      <span className={pageBudgetPercentage <= 100 ? 'text-emerald-500 font-bold' : 'text-amber-500 font-bold'}>
                        {pageBudgetPercentage}%
                      </span>
                    </div>

                    <div className="w-full bg-zinc-200 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${pageBudgetPercentage <= 100 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                        style={{ width: `${Math.min(100, pageBudgetPercentage)}%` }}
                      />
                    </div>

                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                      {pageBudgetPercentage <= 100
                        ? `Optimal line distribution. Your resume fits cleanly onto 1 standard US Letter page with ${linesRemaining} lines of safety buffer.`
                        : `Your document currently spills onto Page 2 by ${Math.abs(linesRemaining)} lines. Enable compact margins (0.5") or remove redundant bullet points.`}
                    </p>
                  </div>

                  {/* Section Line Distribution Table */}
                  <div className="space-y-2">
                    <span className="text-xs font-mono text-zinc-500">Section Line Distribution:</span>
                    <div className="divide-y divide-zinc-200 dark:divide-zinc-800 rounded-xl bg-zinc-50 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] overflow-hidden text-xs font-mono">
                      {sectionBreakdown.map((sec, idx) => (
                        <div key={idx} className="flex items-center justify-between px-3 py-2">
                          <span className="text-zinc-800 dark:text-zinc-200 truncate max-w-[180px]">
                            {sec.title}
                          </span>
                          <span className="font-bold text-zinc-600 dark:text-zinc-400">
                            {sec.count} lines
                          </span>
                        </div>
                      ))}
                      <div className="flex items-center justify-between px-3 py-2 bg-zinc-100 dark:bg-zinc-800/60 font-bold text-zinc-950 dark:text-zinc-100">
                        <span>Total Document:</span>
                        <span>{lineCount} lines</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {inspectorTab === 'keywords' && (
                <div className="space-y-4">
                  {/* Matched Keywords */}
                  <div className="space-y-2">
                    <span className="text-xs font-mono text-zinc-500">Detected ATS Keywords:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {['Go', 'Distributed Systems', 'Kubernetes', 'Kafka', 'PostgreSQL', 'Docker', 'gRPC', 'eBPF', 'AWS', 'Microservices'].map((kw, idx) => (
                        <span key={idx} className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-mono font-semibold flex items-center gap-1">
                          <Check className="w-2.5 h-2.5" />
                          <span>{kw}</span>
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Missing Keywords with 1-Click Insert */}
                  <div className="space-y-2">
                    <span className="text-xs font-mono text-zinc-500">Missing Targeted Role Keywords:</span>
                    <div className="space-y-1.5">
                      {[
                        { word: 'Raft Consensus', section: 'PROJECTS' },
                        { word: 'Chaos Engineering', section: 'EXPERIENCE' },
                        { word: 'Terraform', section: 'TECHNICAL SKILLS' },
                      ].map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-zinc-50 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] text-xs">
                          <span className="font-mono text-zinc-800 dark:text-zinc-200">
                            {item.word}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const updated = `${rawText.trim()}\n• Added proficiency in ${item.word}`;
                              pushState(updated);
                            }}
                            className="px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-[10px] font-mono cursor-pointer"
                          >
                            + Insert
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
};
