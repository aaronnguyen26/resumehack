import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { 
  Printer, 
  Copy, 
  Check, 
  Sparkles, 
  FileText, 
  UploadCloud, 
  Edit3, 
  Eye, 
  RotateCcw, 
  Plus, 
  ExternalLink, 
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
  AlignJustify,
  List, 
  ListOrdered, 
  IndentDecrease,
  IndentIncrease,
  RemoveFormatting,
  ChevronDown, 
  ZoomIn, 
  ZoomOut, 
  ShieldCheck, 
  SlidersHorizontal, 
  PanelRightClose, 
  PanelRightOpen,
  CheckCircle2,
  Cloud,
  LayoutGrid,
  Columns,
} from 'lucide-react';
import { ParsedResume } from '../services/resume-parser.js';
import { parseUploadedResumeFile } from '../services/file-parser.js';
import type { ExtractedPdfLayout } from '../services/file-parser.js';
import { 
  rawTextToHtml, 
  extractTextFromDoc, 
  generateSectionHtml, 
  escapeHtml,
} from '../services/canvas-editor.js';
import type { ResumeLayoutOptions } from '../services/canvas-editor.js';
import { TailoredBulletDiff, ApplicantProfile, ScrapedJobData, TailorResumeResponse } from '../types/index.js';
import { HackyAiAtsPanel } from './HackyAiAtsPanel.js';

export interface InAppDocumentCanvasProps {
  parsedResume: ParsedResume | null;
  rawText: string;
  customHtml?: string;
  diffs?: TailoredBulletDiff[];
  onUpdateResumeText: (text: string) => void;
  onApplyBulletDiff?: (diffIndex: number, variantText?: string) => void;
  onApplyAllDiffs?: () => void;
  onReopenGateway?: () => void;
  applicantProfile?: ApplicantProfile;
  isGoogleDocMode?: boolean;
  docUrl?: string;
  onSyncGoogleDoc?: () => void;
  onPushToGoogleDoc?: () => void;
  onUploadFile?: (file: File) => Promise<string | void>;
  documentTitle?: string;
  onUpdateDocumentTitle?: (title: string) => void;
  currentJob?: ScrapedJobData;
  onUpdateCurrentJob?: (job: ScrapedJobData) => void;
  onTriggerTailor?: () => Promise<void>;
  tailorData?: TailorResumeResponse | null;
  isTailorLoading?: boolean;
  targetRole?: string;
  atsScore?: number;
  isCloudSynced?: boolean;
  isCloudSaving?: boolean;
  onSaveToCloud?: () => Promise<void>;
  onOpenCloudManager?: () => void;
  cloudResumesCount?: number;
  currentUser?: { id: string; email?: string } | null;
  onOpenAuthModal?: () => void;
}

type FontFamily = 'sans' | 'serif' | 'mono';
type FontSize = '9.5pt' | '10pt' | '10.5pt' | '11pt' | '12pt';
type LineSpacing = '1.0' | '1.15' | '1.25' | '1.5';
type MarginSize = 'compact' | 'standard' | 'relaxed';
type ZoomLevel = 85 | 100 | 115;

export const InAppDocumentCanvas: React.FC<InAppDocumentCanvasProps> = ({
  parsedResume,
  rawText,
  customHtml,
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
  onUpdateCurrentJob,
  onTriggerTailor,
  tailorData,
  isTailorLoading = false,
  targetRole = 'Senior Software Engineer',
  atsScore = 92,
  isCloudSynced = false,
  isCloudSaving = false,
  onSaveToCloud,
  onOpenCloudManager,
  cloudResumesCount = 0,
  currentUser,
  onOpenAuthModal,
}) => {
  // ── Document ContentEditable Reference & Sync ────────────────────────────
  const editorRef = useRef<HTMLDivElement>(null);
  const isUserTypingRef = useRef<boolean>(false);
  const lastSyncedTextRef = useRef<string>(rawText);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── History / Undo / Redo Stack ──────────────────────────────────────────
  const [history, setHistory] = useState<string[]>([rawText]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);

  // ── View Modes & Formatting Settings ─────────────────────────────────────
  const [isRawEditing, setIsRawEditing] = useState<boolean>(false);
  const [rawEditText, setRawEditText] = useState<string>(rawText);
  const [copied, setCopied] = useState<boolean>(false);
  const [fontFamily, setFontFamily] = useState<FontFamily>('sans');
  const [fontSize, setFontSize] = useState<FontSize>('10pt');
  const [lineSpacing, setLineSpacing] = useState<LineSpacing>('1.15');
  const [marginSize, setMarginSize] = useState<MarginSize>('standard');
  const [zoom, setZoom] = useState<ZoomLevel>(100);
  const [showGuides, setShowGuides] = useState<boolean>(true);
  const [isInspectorOpen, setIsInspectorOpen] = useState<boolean>(true);

  // ── Google Docs Active Formatting State ───────────────────────────────────
  const [activeFormats, setActiveFormats] = useState({
    bold: false,
    italic: false,
    underline: false,
    strike: false,
    alignLeft: false,
    alignCenter: false,
    alignRight: false,
    alignJustify: false,
    unorderedList: false,
    orderedList: false,
  });

  const checkActiveFormats = useCallback(() => {
    if (typeof document === 'undefined') return;
    try {
      setActiveFormats({
        bold: Boolean(document.queryCommandState('bold')),
        italic: Boolean(document.queryCommandState('italic')),
        underline: Boolean(document.queryCommandState('underline')),
        strike: Boolean(document.queryCommandState('strikeThrough')),
        alignLeft: Boolean(document.queryCommandState('justifyLeft')),
        alignCenter: Boolean(document.queryCommandState('justifyCenter')),
        alignRight: Boolean(document.queryCommandState('justifyRight')),
        alignJustify: Boolean(document.queryCommandState('justifyFull')),
        unorderedList: Boolean(document.queryCommandState('insertUnorderedList')),
        orderedList: Boolean(document.queryCommandState('insertOrderedList')),
      });
    } catch {}
  }, []);

  useEffect(() => {
    document.addEventListener('selectionchange', checkActiveFormats);
    return () => document.removeEventListener('selectionchange', checkActiveFormats);
  }, [checkActiveFormats]);

  // ── Layout Preservation & Visual Architecture State ───────────────────────
  const [layoutOptions, setLayoutOptions] = useState<ResumeLayoutOptions>(() => {
    try {
      const saved = localStorage.getItem('user_resume_layout');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch {}
    return {
      preset: 'classic',
      headerAlignment: 'left',
      sectionDivider: 'line',
      columnLayout: 'single',
    };
  });

  const handleUpdateLayout = useCallback((newOptions: Partial<ResumeLayoutOptions>) => {
    setLayoutOptions(prev => {
      const updated: ResumeLayoutOptions = { ...prev, ...newOptions };
      if (newOptions.preset) {
        if (newOptions.preset === 'modern') {
          updated.headerAlignment = newOptions.headerAlignment || 'center';
          updated.columnLayout = newOptions.columnLayout || 'single';
          updated.sectionDivider = newOptions.sectionDivider || 'line';
        } else if (newOptions.preset === 'two_column') {
          updated.columnLayout = 'two_column';
        } else if (newOptions.preset === 'minimal') {
          updated.sectionDivider = 'minimal';
          updated.headerAlignment = newOptions.headerAlignment || 'left';
        } else if (newOptions.preset === 'classic') {
          updated.headerAlignment = 'left';
          updated.columnLayout = 'single';
          updated.sectionDivider = 'line';
        }
      }
      try {
        localStorage.setItem('user_resume_layout', JSON.stringify(updated));
      } catch {}
      if (editorRef.current) {
        const currentText = extractTextFromDoc(editorRef.current) || rawText;
        editorRef.current.innerHTML = rawTextToHtml(currentText, applicantProfile, updated);
      }
      return updated;
    });
  }, [applicantProfile, rawText]);

  // ── Auto-Save Telemetry ──────────────────────────────────────────────────
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [lastSavedTime, setLastSavedTime] = useState<string>('Just now');
  const [docTitle, setDocTitle] = useState<string>(documentTitle || 'Master_Resume.pdf');
  const [isEditingTitle, setIsEditingTitle] = useState<boolean>(false);

  // ── File Upload / Drag-and-Drop State ────────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isExtractingPdf, setIsExtractingPdf] = useState<boolean>(false);
  const [isDragOverSheet, setIsDragOverSheet] = useState<boolean>(false);
  const [uploadFeedback, setUploadFeedback] = useState<string | null>(null);

  // Synchronize when customHtml changes
  useEffect(() => {
    if (customHtml && editorRef.current && editorRef.current.innerHTML !== customHtml) {
      editorRef.current.innerHTML = customHtml;
      const extracted = extractTextFromDoc(editorRef.current) || rawText;
      lastSyncedTextRef.current = extracted;
    }
  }, [customHtml, rawText]);

  // Synchronize history when rawText changes externally (e.g. file upload or reset)
  useEffect(() => {
    setRawEditText(rawText);
    if (editorRef.current && rawText !== lastSyncedTextRef.current && !isUserTypingRef.current) {
      // If customHtml is actively loaded and editor contains it, avoid clobbering
      if (customHtml && editorRef.current.innerHTML === customHtml) {
        lastSyncedTextRef.current = rawText;
        return;
      }
      // If editorRef already contains rendered high-fidelity sections matching the user resume, avoid clobbering
      const currentDocText = extractTextFromDoc(editorRef.current);
      if (currentDocText) {
        const cleanDoc = currentDocText.replace(/\s+/g, ' ').trim();
        const cleanRaw = rawText.replace(/\s+/g, ' ').trim();
        if (cleanDoc === cleanRaw || (cleanDoc.length > 80 && Math.abs(cleanDoc.length - cleanRaw.length) < 40)) {
          lastSyncedTextRef.current = rawText;
          return;
        }
      }
      editorRef.current.innerHTML = rawTextToHtml(rawText, applicantProfile, layoutOptions);
      lastSyncedTextRef.current = rawText;
      setHistory([rawText]);
      setHistoryIndex(0);
    }
  }, [rawText, customHtml, applicantProfile, layoutOptions]);

  // Synchronize documentTitle prop into local state when external title changes
  useEffect(() => {
    if (documentTitle) {
      setDocTitle(documentTitle);
    }
  }, [documentTitle]);

  // Initial load of HTML into contentEditable on mount
  useEffect(() => {
    if (editorRef.current && !editorRef.current.innerHTML.trim()) {
      if (customHtml && customHtml.trim()) {
        editorRef.current.innerHTML = customHtml;
        lastSyncedTextRef.current = extractTextFromDoc(editorRef.current) || rawText;
        return;
      }
      try {
        const savedHtml = localStorage.getItem('user_custom_resume_html');
        if (savedHtml && savedHtml.trim()) {
          editorRef.current.innerHTML = savedHtml;
          lastSyncedTextRef.current = extractTextFromDoc(editorRef.current) || rawText;
          return;
        }
      } catch {}
      editorRef.current.innerHTML = rawTextToHtml(rawText, applicantProfile, layoutOptions);
      lastSyncedTextRef.current = rawText;
    }
  }, [applicantProfile, layoutOptions, rawText, customHtml]);

  const pushState = useCallback((newText: string) => {
    setHistory((prev) => {
      const sliced = prev.slice(0, historyIndex + 1);
      if (sliced[sliced.length - 1] === newText) return prev;
      const next = [...sliced, newText];
      if (next.length > 50) next.shift();
      setHistoryIndex(next.length - 1);
      return next;
    });
    setLastSavedTime('Just now');
  }, [historyIndex]);

  // Handle direct text input inside contentEditable (Google Docs behavior)
  const handleEditorInput = useCallback(() => {
    isUserTypingRef.current = true;
    setIsSaving(true);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      if (editorRef.current) {
        const extracted = extractTextFromDoc(editorRef.current);
        lastSyncedTextRef.current = extracted;
        onUpdateResumeText(extracted);
        pushState(extracted);
        try {
          localStorage.setItem('user_custom_resume', extracted);
        } catch {}
      }
      setIsSaving(false);
      setLastSavedTime('Just now');
      isUserTypingRef.current = false;
    }, 350);
  }, [onUpdateResumeText, pushState]);

  // Handle keyboard shortcuts (Tab indent, Shift+Tab outdent)
  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) {
        document.execCommand('outdent', false);
      } else {
        document.execCommand('indent', false);
      }
      handleEditorInput();
    }
  };

  // Handle pasting clean plain text into the document
  const handleEditorPaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text/plain');
    if (text) {
      e.preventDefault();
      document.execCommand('insertText', false, text);
      handleEditorInput();
    }
  };

  // Undo / Redo controls
  const handleUndo = () => {
    if (historyIndex > 0) {
      const targetText = history[historyIndex - 1];
      setHistoryIndex(historyIndex - 1);
      lastSyncedTextRef.current = targetText;
      onUpdateResumeText(targetText);
      if (editorRef.current) {
        editorRef.current.innerHTML = rawTextToHtml(targetText, applicantProfile, layoutOptions);
      }
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const targetText = history[historyIndex + 1];
      setHistoryIndex(historyIndex + 1);
      lastSyncedTextRef.current = targetText;
      onUpdateResumeText(targetText);
      if (editorRef.current) {
        editorRef.current.innerHTML = rawTextToHtml(targetText, applicantProfile, layoutOptions);
      }
    }
  };

  // Global keyboard shortcuts for Ctrl+Z, Ctrl+Y
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
    if (lineSpacing === '1.5') base -= 8;
    if (fontSize === '9.5pt') base += 4;
    if (fontSize === '11pt' || fontSize === '12pt') base -= 4;
    return base;
  }, [marginSize, lineSpacing, fontSize]);

  const pageBudgetPercentage = Math.round((lineCount / maxRecommendedLines) * 100);
  const linesRemaining = maxRecommendedLines - lineCount;

  // Section Breakdown Line Counter
  const sectionBreakdown = useMemo(() => {
    const paragraphs = rawText.split(/\n\s*\n/);
    return paragraphs.map((p, idx) => {
      const lines = p.split('\n').filter(l => l.trim().length > 0);
      const title = idx === 0 ? 'Header / Contact' : (lines[0] || `Section ${idx}`);
      return {
        title: title.length > 20 ? title.substring(0, 20) + '…' : title,
        count: lines.length,
      };
    });
  }, [rawText]);

  // Actions
  const handlePrint = () => {
    window.print();
  };

  const handleCopyPlainText = async () => {
    try {
      const textToCopy = editorRef.current ? extractTextFromDoc(editorRef.current) : rawText;
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  // Insert section template directly into the live document
  const handleInsertSectionIntoDoc = (type: 'EXPERIENCE' | 'PROJECTS' | 'SKILLS' | 'EDUCATION' | 'SUMMARY' | 'CUSTOM') => {
    const sectionHtml = generateSectionHtml(type);
    if (editorRef.current) {
      editorRef.current.innerHTML += `\n${sectionHtml}`;
      handleEditorInput();
      editorRef.current.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  // Accept tailored bullet from inspector
  const handleApplyBulletDiffFromInspector = (diffIdx: number, variantText?: string) => {
    const diff = diffs[diffIdx];
    if (!diff) return;

    if (onApplyBulletDiff) {
      onApplyBulletDiff(diffIdx, variantText);
    }

    const replacementText = (variantText || diff.tailoredText).trim();

    if (editorRef.current && diff.originalText) {
      const currentHtml = editorRef.current.innerHTML;
      const targetSearch = escapeHtml(diff.originalText.trim());
      const targetReplacement = escapeHtml(replacementText);

      if (currentHtml.includes(targetSearch)) {
        editorRef.current.innerHTML = currentHtml.replace(
          targetSearch,
          `<span class="bg-emerald-500/20 text-emerald-950 dark:text-emerald-100 transition-colors duration-1000">${targetReplacement}</span>`
        );
        handleEditorInput();
      } else {
        let currentText = extractTextFromDoc(editorRef.current);
        if (currentText.includes(diff.originalText)) {
          currentText = currentText.replace(diff.originalText, replacementText);
          editorRef.current.innerHTML = rawTextToHtml(currentText, applicantProfile, layoutOptions);
          handleEditorInput();
        }
      }
    }
  };

  // Insert missing keyword from inspector into document
  const handleInsertKeywordIntoDoc = (keyword: string) => {
    if (editorRef.current) {
      const skillsHeader = Array.from(editorRef.current.querySelectorAll('h2')).find(
        h => /skills/i.test(h.textContent || '')
      );
      if (skillsHeader && skillsHeader.parentElement) {
        const ul = skillsHeader.parentElement.querySelector('ul');
        if (ul) {
          const li = document.createElement('li');
          li.textContent = `Proficient in ${keyword}`;
          ul.appendChild(li);
        } else {
          const p = document.createElement('p');
          p.className = 'text-xs text-zinc-800 dark:text-zinc-200 my-1';
          p.textContent = `• Proficient in ${keyword}`;
          skillsHeader.parentElement.appendChild(p);
        }
      } else {
        editorRef.current.innerHTML += `<p class="text-xs text-zinc-800 dark:text-zinc-200 my-1">• Proficient in ${escapeHtml(keyword)}</p>`;
      }
      handleEditorInput();
    }
  };

  // Insert AI recommended bullet point into document
  const handleInsertBulletIntoDoc = (bulletText: string, sectionHint?: string) => {
    if (editorRef.current) {
      const headers = Array.from(editorRef.current.querySelectorAll('h2'));
      const targetHeader = headers.find(h => {
        const t = (h.textContent || '').toLowerCase();
        if (sectionHint === 'projects') return t.includes('project');
        if (sectionHint === 'skills') return t.includes('skill');
        return t.includes('experience') || t.includes('work') || t.includes('employment');
      }) || headers[0];

      const cleanText = bulletText.replace(/^[•\-\*\s]+/, '').trim();

      if (targetHeader && targetHeader.parentElement) {
        const ul = targetHeader.parentElement.querySelector('ul');
        if (ul) {
          const li = document.createElement('li');
          li.textContent = cleanText;
          ul.appendChild(li);
        } else {
          const p = document.createElement('p');
          p.className = 'text-xs text-zinc-800 dark:text-zinc-200 my-1';
          p.textContent = `• ${cleanText}`;
          targetHeader.parentElement.appendChild(p);
        }
      } else {
        editorRef.current.innerHTML += `<p class="text-xs text-zinc-800 dark:text-zinc-200 my-1">• ${escapeHtml(cleanText)}</p>`;
      }
      handleEditorInput();
    }
  };

  // PDF File Upload Handler with Layout Preservation
  const handleCanvasFileUpload = async (file: File) => {
    setIsExtractingPdf(true);
    setUploadFeedback(`Extracting text and original design layout from ${file.name}…`);
    try {
      isUserTypingRef.current = false;
      let extractedText = '';
      let detectedLayout: ExtractedPdfLayout | undefined;

      const parsed = await parseUploadedResumeFile(file);
      extractedText = parsed.text;
      detectedLayout = parsed.layout;
      const highFidelityHtml = parsed.html;

      // File text and high-fidelity HTML extracted

      if (onUploadFile) {
        try {
          const res: unknown = await onUploadFile(file);
          if (typeof res === 'string' && res.trim()) {
            extractedText = res.trim();
          }
        } catch {}
      }

      const newLayout: ResumeLayoutOptions = detectedLayout ? {
        preset: detectedLayout.detectedPreset,
        headerAlignment: detectedLayout.headerAlignment,
        sectionDivider: detectedLayout.sectionDivider,
        columnLayout: detectedLayout.columnCount === 2 ? 'two_column' : 'single',
      } : layoutOptions;

      setLayoutOptions(newLayout);
      try {
        localStorage.setItem('user_resume_layout', JSON.stringify(newLayout));
      } catch {}

      // Auto-apply detected font family and page margins from original PDF
      if (detectedLayout?.detectedFontFamily) {
        setFontFamily(detectedLayout.detectedFontFamily);
      }
      if (detectedLayout?.detectedMarginSize) {
        setMarginSize(detectedLayout.detectedMarginSize);
      }

      if (extractedText && editorRef.current) {
        if (highFidelityHtml) {
          editorRef.current.innerHTML = highFidelityHtml;
        } else {
          editorRef.current.innerHTML = rawTextToHtml(extractedText, applicantProfile, newLayout);
        }
        lastSyncedTextRef.current = extractedText;
        setHistory([extractedText]);
        setHistoryIndex(0);
        onUpdateResumeText(extractedText);
        try {
          localStorage.setItem('user_custom_resume', extractedText);
          if (highFidelityHtml) {
            localStorage.setItem('user_custom_resume_html', highFidelityHtml);
          }
        } catch {}
      }
      setDocTitle(file.name);
      onUpdateDocumentTitle?.(file.name);

      const layoutDescriptor = detectedLayout?.columnCount === 2
        ? 'Two-Column Spatial Layout'
        : detectedLayout?.headerAlignment === 'center'
        ? 'Centered Executive'
        : detectedLayout?.hasSplitRows
        ? 'Classic Tech (Split Dates)'
        : 'Single-Column';

      setUploadFeedback(`✓ Extracted "${file.name}" with 100% ${layoutDescriptor} copy replica`);
    } catch (err: any) {
      setUploadFeedback(`⚠️ Upload failed: ${err.message || 'Could not parse format'}`);
    } finally {
      setIsExtractingPdf(false);
      setTimeout(() => setUploadFeedback(null), 5000);
    }
  };

  const pendingDiffs = useMemo(() => {
    return diffs.filter(d => d.status === 'pending');
  }, [diffs]);

  // Toolbar button helper: prevents losing editor focus/selection when clicking ribbon buttons
  const preventFocusLoss = (e: React.MouseEvent) => {
    e.preventDefault();
  };

  const documentSheetNode = (
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
      className={`resume-canvas-print relative w-full max-w-[816px] min-h-[1056px] bg-white dark:bg-[#151518] text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800/90 rounded-xl shadow-xl transition-all duration-200 ${
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

      {/* ── GOOGLE DOCS-STYLE DIRECT CLICK-TO-EDIT DOCUMENT CONTENT ── */}
      <div
        ref={editorRef}
        contentEditable={true}
        suppressContentEditableWarning={true}
        spellCheck={true}
        onInput={handleEditorInput}
        onKeyDown={handleEditorKeyDown}
        onPaste={handleEditorPaste}
        className="doc-editable-content w-full h-full min-h-[960px] focus:outline-none cursor-text selection:bg-zinc-200 dark:selection:bg-zinc-700"
        style={{
          lineHeight: lineSpacing === '1.0' ? '1.25' : lineSpacing === '1.25' ? '1.6' : lineSpacing === '1.5' ? '1.8' : '1.4',
          fontSize: fontSize === '9.5pt' ? '12px' : fontSize === '10.5pt' ? '13px' : fontSize === '11pt' ? '14px' : fontSize === '12pt' ? '15px' : '12.5px',
        }}
      />

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
  );

  return (
    <div className="flex flex-col h-full w-full bg-zinc-50 dark:bg-[#09090B] text-zinc-900 dark:text-zinc-100 transition-colors duration-200 select-none">
      {/* Hidden File Input for PDF Upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,.txt"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleCanvasFileUpload(file);
          e.target.value = '';
        }}
        className="hidden"
      />

      {/* ── STICKY TOP HEADER (Breadcrumbs, Status, Primary Actions) ───────── */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#121215]/95 backdrop-blur-md border-b border-zinc-200 dark:border-[#27272A] px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        {/* Left: Breadcrumbs & Document Title */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 flex items-center justify-center font-bold text-xs shadow-xs">
            <FileText className="w-4 h-4" />
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
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
                  className="text-sm font-headline font-bold text-zinc-900 dark:text-zinc-100 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-300 dark:border-zinc-600 focus:outline-none"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setIsEditingTitle(true)}
                  className="group/title flex items-center gap-1.5 text-sm font-headline font-bold text-zinc-950 dark:text-zinc-50 hover:opacity-80 transition-opacity"
                  title="Click to rename document"
                >
                  <span className="truncate max-w-[240px] sm:max-w-xs">{docTitle}</span>
                  <Edit3 className="w-3 h-3 text-zinc-400 group-hover/title:text-zinc-700 dark:group-hover/title:text-zinc-200 opacity-0 group-hover/title:opacity-100 transition-opacity" />
                </button>
              )}
              <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] text-zinc-500 font-semibold">
                {isGoogleDocMode ? 'G-Docs Live' : 'Canvas Studio'}
              </span>
            </div>

            <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
              <span>{rawLines.length} lines detected</span>
              <span>•</span>
              <span>{rawText.length} chars</span>
            </div>
          </div>
        </div>

        {/* Center: Live Google Docs Auto-Save Status Pill & Undo/Redo */}
        <div className="flex items-center gap-3">
          {/* Live Auto-Save Pill */}
          <div className="flex items-center gap-2 px-2.5 py-1 bg-zinc-100 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] rounded-lg text-xs font-mono">
            {isSaving ? (
              <>
                <Loader2 className="w-3 h-3 text-zinc-400 animate-spin" />
                <span className="text-zinc-500">Saving changes…</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                <span className="text-zinc-700 dark:text-zinc-300 font-semibold">All changes saved</span>
              </>
            )}
          </div>

          {/* Undo / Redo */}
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

          {/* Supabase Cloud Persistence Status */}
          {currentUser ? (
            <button
              type="button"
              onClick={onOpenCloudManager}
              className="flex items-center gap-1.5 px-3 py-1 bg-zinc-100 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] hover:border-zinc-300 dark:hover:border-zinc-700 rounded-lg text-xs font-mono cursor-pointer transition-colors shadow-2xs"
              title="Supabase Cloud Sync Active. Click to manage cloud versions."
            >
              <Cloud className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-[11px] font-semibold text-zinc-800 dark:text-zinc-200">
                {isCloudSaving ? 'Saving…' : 'Cloud Synced'}
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenAuthModal}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-zinc-100 dark:bg-[#18181B] border border-dashed border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600 rounded-lg text-xs font-mono cursor-pointer transition-colors shadow-2xs"
              title="Sign in to save this resume persistently to Supabase Cloud"
            >
              <Cloud className="w-3.5 h-3.5 text-zinc-400" />
              <span className="text-[11px] text-zinc-500">Sync to Cloud</span>
            </button>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Supabase Cloud Resumes Manager Button */}
          {currentUser ? (
            <button
              type="button"
              onClick={onOpenCloudManager}
              className="px-2.5 py-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              title="Open Cloud Resume Manager"
            >
              <Cloud className="w-3.5 h-3.5 text-emerald-500" />
              <span className="hidden sm:inline">Cloud Resumes</span>
              {cloudResumesCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[9px] font-mono bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200">
                  {cloudResumesCount}
                </span>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenAuthModal}
              className="px-2.5 py-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              title="Sign in to save this resume to the cloud"
            >
              <Cloud className="w-3.5 h-3.5 text-zinc-400" />
              <span className="hidden sm:inline">Save to Cloud</span>
            </button>
          )}
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
              onClick={() => {
                if (editorRef.current) {
                  const currentText = extractTextFromDoc(editorRef.current);
                  if (currentText.trim()) {
                    onUpdateResumeText(currentText);
                    try { localStorage.setItem('user_custom_resume', currentText); } catch {}
                  }
                }
                onSyncGoogleDoc();
              }}
              className="px-2.5 py-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title={isGoogleDocMode ? 'Re-sync latest text from Google Docs' : 'Re-parse document and synchronize ATS analysis'}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{isGoogleDocMode ? 'Re-sync Docs' : 'Re-sync'}</span>
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

          {/* Toggle Right Hacky AI Inspector */}
          <button
            type="button"
            onClick={() => setIsInspectorOpen(!isInspectorOpen)}
            className={`p-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
              isInspectorOpen
                ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 border-zinc-900 dark:border-white shadow-xs'
                : 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-[#27272A] text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
            }`}
            title="Toggle Hacky AI ATS Architecture Panel"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
            <span className="hidden md:inline font-bold">Hacky AI</span>
          </button>
        </div>
      </header>

      {/* ── MAIN WORKSPACE VIEWPORT (Left Canvas Column + Right Inspector) ─────── */}
      <div className="flex-1 flex flex-col lg:flex-row items-stretch justify-start relative overflow-hidden min-h-0">
        {/* ── LEFT DOCUMENT CANVAS WORKSPACE (Toolbar + Paper Stage) ───────── */}
        <div className="flex-1 flex flex-col min-w-0 bg-zinc-100/70 dark:bg-[#0c0c0e] relative h-full">
          {/* ── GOOGLE DOCS-STYLE FORMATTING TOOLBAR (Strictly Scoped to Document Canvas) ── */}
          <nav 
            aria-label="Document Formatting Controls" 
            className="sticky top-0 z-20 bg-white/95 dark:bg-[#151518]/95 backdrop-blur-md border-b border-zinc-200 dark:border-[#27272A] px-3 sm:px-4 py-1.5 flex items-center justify-between gap-1.5 shadow-2xs overflow-x-auto select-none"
          >
            {/* Left Controls: Google Docs standard components */}
            <div className="flex items-center gap-1 sm:gap-1.5 flex-nowrap shrink-0">
              {/* Undo / Redo / Print */}
              <div className="flex items-center bg-zinc-100 dark:bg-zinc-800/90 border border-zinc-200 dark:border-zinc-700 rounded-md p-0.5">
                <button
                  type="button"
                  onMouseDown={preventFocusLoss}
                  onClick={handleUndo}
                  disabled={historyIndex <= 0}
                  className="p-1 rounded text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="Undo (Ctrl+Z)"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onMouseDown={preventFocusLoss}
                  onClick={handleRedo}
                  disabled={historyIndex >= history.length - 1}
                  className="p-1 rounded text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="Redo (Ctrl+Y)"
                >
                  <Redo2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onMouseDown={preventFocusLoss}
                  onClick={handlePrint}
                  className="p-1 rounded text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white transition-colors"
                  title="Print / Export ATS PDF (Ctrl+P)"
                >
                  <Printer className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800 mx-0.5 shrink-0" />

              {/* Font Family Selector */}
              <div className="flex items-center">
                <select
                  value={fontFamily}
                  onChange={(e) => setFontFamily(e.target.value as FontFamily)}
                  className="h-7 px-2 text-xs font-medium rounded-md bg-zinc-100 dark:bg-zinc-800/90 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none cursor-pointer"
                  title="Font Family"
                >
                  <option value="serif">Serif (Times / Garamond)</option>
                  <option value="sans">Sans (Arial / Inter)</option>
                  <option value="mono">Mono (Courier / JetBrains)</option>
                </select>
              </div>

              {/* Font Size Stepper */}
              <div className="flex items-center bg-zinc-100 dark:bg-zinc-800/90 border border-zinc-200 dark:border-zinc-700 rounded-md p-0.5">
                <button
                  type="button"
                  onMouseDown={preventFocusLoss}
                  onClick={() => {
                    const sizes: FontSize[] = ['9.5pt', '10pt', '10.5pt', '11pt', '12pt'];
                    const idx = sizes.indexOf(fontSize);
                    if (idx > 0) setFontSize(sizes[idx - 1]);
                  }}
                  className="px-1.5 py-0.5 text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white rounded hover:bg-zinc-200 dark:hover:bg-zinc-700"
                  title="Decrease Font Size"
                >
                  -
                </button>
                <span className="text-[11px] font-mono font-semibold px-1 text-zinc-800 dark:text-zinc-200 min-w-[34px] text-center">
                  {fontSize}
                </span>
                <button
                  type="button"
                  onMouseDown={preventFocusLoss}
                  onClick={() => {
                    const sizes: FontSize[] = ['9.5pt', '10pt', '10.5pt', '11pt', '12pt'];
                    const idx = sizes.indexOf(fontSize);
                    if (idx < sizes.length - 1) setFontSize(sizes[idx + 1]);
                  }}
                  className="px-1.5 py-0.5 text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white rounded hover:bg-zinc-200 dark:hover:bg-zinc-700"
                  title="Increase Font Size"
                >
                  +
                </button>
              </div>

              <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800 mx-0.5 shrink-0" />

              {/* Text Styling: Bold, Italic, Underline, Strikethrough with Google Docs active formatting states */}
              <div className="flex items-center gap-0.5 bg-zinc-100 dark:bg-zinc-800/90 border border-zinc-200 dark:border-zinc-700 rounded-md p-0.5">
                <button
                  type="button"
                  onMouseDown={preventFocusLoss}
                  onClick={() => {
                    document.execCommand('bold', false);
                    handleEditorInput();
                    checkActiveFormats();
                  }}
                  className={`p-1 rounded transition-colors ${
                    activeFormats.bold
                      ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 font-bold shadow-2xs'
                      : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                  }`}
                  title="Bold (Ctrl+B)"
                >
                  <Bold className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onMouseDown={preventFocusLoss}
                  onClick={() => {
                    document.execCommand('italic', false);
                    handleEditorInput();
                    checkActiveFormats();
                  }}
                  className={`p-1 rounded transition-colors ${
                    activeFormats.italic
                      ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 font-bold shadow-2xs'
                      : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                  }`}
                  title="Italic (Ctrl+I)"
                >
                  <Italic className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onMouseDown={preventFocusLoss}
                  onClick={() => {
                    document.execCommand('underline', false);
                    handleEditorInput();
                    checkActiveFormats();
                  }}
                  className={`p-1 rounded transition-colors ${
                    activeFormats.underline
                      ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 font-bold shadow-2xs'
                      : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                  }`}
                  title="Underline (Ctrl+U)"
                >
                  <Underline className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onMouseDown={preventFocusLoss}
                  onClick={() => {
                    document.execCommand('strikeThrough', false);
                    handleEditorInput();
                    checkActiveFormats();
                  }}
                  className={`p-1 rounded transition-colors ${
                    activeFormats.strike
                      ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 font-bold shadow-2xs'
                      : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                  }`}
                  title="Strikethrough"
                >
                  <Strikethrough className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800 mx-0.5 shrink-0 hidden sm:block" />

              {/* Alignment: Left, Center, Right, Justify with active states */}
              <div className="flex items-center gap-0.5 bg-zinc-100 dark:bg-zinc-800/90 border border-zinc-200 dark:border-zinc-700 rounded-md p-0.5 hidden sm:flex">
                <button
                  type="button"
                  onMouseDown={preventFocusLoss}
                  onClick={() => {
                    document.execCommand('justifyLeft', false);
                    handleEditorInput();
                    checkActiveFormats();
                  }}
                  className={`p-1 rounded transition-colors ${
                    activeFormats.alignLeft
                      ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-2xs'
                      : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                  }`}
                  title="Align Left (Ctrl+Shift+L)"
                >
                  <AlignLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onMouseDown={preventFocusLoss}
                  onClick={() => {
                    document.execCommand('justifyCenter', false);
                    handleEditorInput();
                    checkActiveFormats();
                  }}
                  className={`p-1 rounded transition-colors ${
                    activeFormats.alignCenter
                      ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-2xs'
                      : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                  }`}
                  title="Align Center (Ctrl+Shift+E)"
                >
                  <AlignCenter className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onMouseDown={preventFocusLoss}
                  onClick={() => {
                    document.execCommand('justifyRight', false);
                    handleEditorInput();
                    checkActiveFormats();
                  }}
                  className={`p-1 rounded transition-colors ${
                    activeFormats.alignRight
                      ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-2xs'
                      : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                  }`}
                  title="Align Right (Ctrl+Shift+R)"
                >
                  <AlignRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onMouseDown={preventFocusLoss}
                  onClick={() => {
                    document.execCommand('justifyFull', false);
                    handleEditorInput();
                    checkActiveFormats();
                  }}
                  className={`p-1 rounded transition-colors ${
                    activeFormats.alignJustify
                      ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-2xs'
                      : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                  }`}
                  title="Justify (Ctrl+Shift+J)"
                >
                  <AlignJustify className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800 mx-0.5 shrink-0 hidden md:block" />

              {/* Line Spacing */}
              <div className="flex items-center hidden md:flex">
                <select
                  value={lineSpacing}
                  onChange={(e) => setLineSpacing(e.target.value as LineSpacing)}
                  className="h-7 px-2 text-xs font-medium rounded-md bg-zinc-100 dark:bg-zinc-800/90 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none cursor-pointer"
                  title="Line Spacing (Single, 1.15, 1.25, 1.5)"
                >
                  <option value="1.0">1.0 (Single)</option>
                  <option value="1.15">1.15 (Standard)</option>
                  <option value="1.25">1.25 (Relaxed)</option>
                  <option value="1.5">1.5 (Wide)</option>
                </select>
              </div>

              <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800 mx-0.5 shrink-0 hidden sm:block" />

              {/* Lists, Indents, and Clear Formatting */}
              <div className="flex items-center gap-0.5 bg-zinc-100 dark:bg-zinc-800/90 border border-zinc-200 dark:border-zinc-700 rounded-md p-0.5 hidden sm:flex">
                <button
                  type="button"
                  onMouseDown={preventFocusLoss}
                  onClick={() => {
                    document.execCommand('insertUnorderedList', false);
                    handleEditorInput();
                    checkActiveFormats();
                  }}
                  className={`p-1 rounded transition-colors ${
                    activeFormats.unorderedList
                      ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-2xs'
                      : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                  }`}
                  title="Bulleted List (•)"
                >
                  <List className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onMouseDown={preventFocusLoss}
                  onClick={() => {
                    document.execCommand('insertOrderedList', false);
                    handleEditorInput();
                    checkActiveFormats();
                  }}
                  className={`p-1 rounded transition-colors ${
                    activeFormats.orderedList
                      ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-2xs'
                      : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                  }`}
                  title="Numbered List"
                >
                  <ListOrdered className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onMouseDown={preventFocusLoss}
                  onClick={() => {
                    document.execCommand('outdent', false);
                    handleEditorInput();
                    checkActiveFormats();
                  }}
                  className="p-1 rounded text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                  title="Decrease Indent (Shift+Tab)"
                >
                  <IndentDecrease className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onMouseDown={preventFocusLoss}
                  onClick={() => {
                    document.execCommand('indent', false);
                    handleEditorInput();
                    checkActiveFormats();
                  }}
                  className="p-1 rounded text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                  title="Increase Indent (Tab)"
                >
                  <IndentIncrease className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onMouseDown={preventFocusLoss}
                  onClick={() => {
                    document.execCommand('removeFormat', false);
                    handleEditorInput();
                    checkActiveFormats();
                  }}
                  className="p-1 rounded text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                  title="Clear Formatting"
                >
                  <RemoveFormatting className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800 mx-0.5 shrink-0 hidden lg:block" />

              {/* Margins Selector */}
              <div className="flex items-center hidden lg:flex">
                <select
                  value={marginSize}
                  onChange={(e) => setMarginSize(e.target.value as MarginSize)}
                  className="h-7 px-2 text-xs font-medium rounded-md bg-zinc-100 dark:bg-zinc-800/90 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none cursor-pointer"
                  title="Page Margins"
                >
                  <option value="compact">0.5" Compact</option>
                  <option value="standard">0.75" Standard</option>
                  <option value="relaxed">1.0" Wide</option>
                </select>
              </div>

              {/* Visual Layout Preset */}
              <div className="flex items-center hidden xl:flex">
                <select
                  value={layoutOptions.preset || 'classic'}
                  onChange={(e) => handleUpdateLayout({ preset: e.target.value as any })}
                  className="h-7 px-2 text-xs font-medium rounded-md bg-zinc-100 dark:bg-zinc-800/90 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none cursor-pointer"
                  title="Resume Visual Design & Architecture Preset"
                >
                  <option value="classic">Layout: Classic Tech (Split Dates)</option>
                  <option value="modern">Layout: Modern Executive (Centered)</option>
                  <option value="two_column">Layout: Two-Column (Sidebar)</option>
                  <option value="minimal">Layout: Minimalist (Clean)</option>
                </select>
              </div>

              {/* Insert Section Quick Dropdown */}
              <div className="relative group/insert hidden sm:block">
                <button
                  type="button"
                  className="h-7 px-2.5 rounded-md bg-zinc-100 dark:bg-zinc-800/90 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Insert Section</span>
                  <ChevronDown className="w-3 h-3 text-zinc-400" />
                </button>

                <div className="absolute left-0 top-full mt-1 w-48 bg-white dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] rounded-xl shadow-lg p-1.5 hidden group-hover/insert:block z-50 animate-in fade-in duration-150">
                  <button
                    type="button"
                    onClick={() => handleInsertSectionIntoDoc('EXPERIENCE')}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-medium"
                  >
                    + Work Experience
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInsertSectionIntoDoc('PROJECTS')}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-medium"
                  >
                    + Featured Projects
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInsertSectionIntoDoc('SKILLS')}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-medium"
                  >
                    + Technical Skills
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInsertSectionIntoDoc('EDUCATION')}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-medium"
                  >
                    + Education
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInsertSectionIntoDoc('SUMMARY')}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-medium"
                  >
                    + Professional Summary
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInsertSectionIntoDoc('CUSTOM')}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-medium"
                  >
                    + Custom Section
                  </button>
                </div>
              </div>
            </div>

            {/* Right Controls: Margins Guide & Zoom */}
            <div className="flex items-center gap-1.5 ml-auto shrink-0">
              <button
                type="button"
                onClick={() => setShowGuides(!showGuides)}
                className={`h-7 px-2 rounded-md text-xs font-mono flex items-center gap-1 transition-colors ${
                  showGuides 
                    ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 font-bold' 
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                }`}
                title="Toggle print margin guideline boundaries"
              >
                <span>Margins Guide</span>
              </button>

              <div className="flex items-center bg-zinc-100 dark:bg-zinc-800/90 border border-zinc-200 dark:border-zinc-700 rounded-md p-0.5">
                <button
                  type="button"
                  onClick={() => setZoom((z) => (z === 115 ? 100 : 85))}
                  className="p-1 text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-3 h-3" />
                </button>
                <span className="text-[10px] font-mono px-1 text-zinc-700 dark:text-zinc-300 min-w-[32px] text-center">
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

          {/* Paper Stage Container */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-5 md:p-6 lg:p-8 flex flex-col items-center justify-start relative min-h-[850px]">
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
                        onUpdateResumeText(rawEditText);
                        pushState(rawEditText);
                        if (editorRef.current) {
                          editorRef.current.innerHTML = rawTextToHtml(rawEditText, applicantProfile, layoutOptions);
                        }
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
              documentSheetNode
            )}
          </div>
        </div>

        {/* ── RIGHT HACKY AI ATS ARCHITECTURE INSPECTOR (Collapsible) ────────── */}
        {isInspectorOpen && (
          <aside aria-label="Hacky AI ATS Inspector" className="w-full lg:w-[380px] shrink-0 border-t lg:border-t-0 lg:border-l border-zinc-200 dark:border-[#27272A] bg-white dark:bg-[#121215] flex flex-col overflow-y-auto">
            <HackyAiAtsPanel
              resumeText={rawEditText || rawText}
              applicantProfile={applicantProfile}
              currentJob={currentJob}
              onUpdateCurrentJob={onUpdateCurrentJob}
              onTriggerTailor={onTriggerTailor}
              tailorData={tailorData}
              isTailorLoading={isTailorLoading}
              targetRole={targetRole}
              diffs={diffs}
              onApplyBulletDiff={(dIdx, variantText) => {
                handleApplyBulletDiffFromInspector(dIdx, variantText);
              }}
              onApplyAllDiffs={() => {
                if (onApplyAllDiffs) {
                  onApplyAllDiffs();
                  if (editorRef.current) {
                    diffs.forEach(d => {
                      if (d.originalText && editorRef.current) {
                        editorRef.current.innerHTML = editorRef.current.innerHTML.replace(
                          escapeHtml(d.originalText.trim()),
                          escapeHtml(d.tailoredText.trim())
                        );
                      }
                    });
                    handleEditorInput();
                  }
                }
              }}
              onInsertKeyword={handleInsertKeywordIntoDoc}
              onInsertBullet={handleInsertBulletIntoDoc}
              onClose={() => setIsInspectorOpen(false)}
              lineCount={lineCount}
              maxRecommendedLines={maxRecommendedLines}
              pageBudgetPercentage={pageBudgetPercentage}
              linesRemaining={linesRemaining}
              sectionBreakdown={sectionBreakdown}
            />
          </aside>
        )}
      </div>
    </div>
  );
};
