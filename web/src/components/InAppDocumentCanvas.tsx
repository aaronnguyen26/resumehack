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
  Link,
  Unlink,
  SeparatorHorizontal,
  Subscript,
  Superscript,
  CaseUpper,
  Search,
  Table,
  Info,
  Palette,
  Highlighter,
  ArrowDown,
  ArrowUp,
  Maximize2,
  Minimize2,
  Navigation,
  Wand2,
} from 'lucide-react';
import {
  DocumentSnapshotStack,
  saveSelectionRange,
  restoreSelectionRange,
  getSelectionMetrics,
  SelectionMetrics,
  handleMarkdownShortcut,
  handleSmartEnter,
  handleSmartBackspace,
  handleMoveItem,
  parseSmartPastedText,
} from '../services/google-docs-editor-engine.js';
import { ParsedResume } from '../services/resume-parser.js';
import { parseUploadedResumeFile } from '../services/file-parser.js';
import type { ExtractedPdfLayout } from '../services/file-parser.js';
import { 
  detectBulletStyleFromGlyph,
  type BulletStyle,
} from '../services/pdf-layout-engine.js';
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

  // ── History / Undo / Redo Stack & Google Docs Snapshot Engine ─────────────
  const [history, setHistory] = useState<string[]>([rawText]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);
  const snapshotStackRef = useRef<DocumentSnapshotStack>(new DocumentSnapshotStack());

  // ── Floating Selection Bubble & Quick Telemetry State ────────────────────
  const [selectionMetrics, setSelectionMetrics] = useState<SelectionMetrics>({
    text: '',
    words: 0,
    chars: 0,
    lines: 0,
    rect: null,
    isCollapsed: true,
  });
  const [floatingToolbarPos, setFloatingToolbarPos] = useState<{ top: number; left: number } | null>(null);
  const [elevateFeedback, setElevateFeedback] = useState<string | null>(null);

  // ── Distraction-Free Zen / Focus Writing Mode ─────────────────────────────
  const [isZenMode, setIsZenMode] = useState<boolean>(false);

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
    subscript: false,
    superscript: false,
  });

  // ── Extended Google Docs Tools State ──────────────────────────────────────
  const [isBulletMenuOpen, setIsBulletMenuOpen] = useState<boolean>(false);
  const [isColorMenuOpen, setIsColorMenuOpen] = useState<boolean>(false);
  const [isHighlightMenuOpen, setIsHighlightMenuOpen] = useState<boolean>(false);
  const [isCaseMenuOpen, setIsCaseMenuOpen] = useState<boolean>(false);
  const [isTableMenuOpen, setIsTableMenuOpen] = useState<boolean>(false);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState<boolean>(false);
  const [linkInputUrl, setLinkInputUrl] = useState<string>('');
  const [isStatsModalOpen, setIsStatsModalOpen] = useState<boolean>(false);
  const [isFindReplaceOpen, setIsFindReplaceOpen] = useState<boolean>(false);
  const [findSearchTerm, setFindSearchTerm] = useState<string>('');
  const [findReplaceTerm, setFindReplaceTerm] = useState<string>('');
  const [findMatchCount, setFindMatchCount] = useState<number>(0);
  const [findActiveIdx, setFindActiveIdx] = useState<number>(0);
  const savedRangeRef = useRef<Range | null>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target?.closest('.toolbar-dropdown-container')) {
        setIsBulletMenuOpen(false);
        setIsColorMenuOpen(false);
        setIsHighlightMenuOpen(false);
        setIsCaseMenuOpen(false);
        setIsTableMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Ctrl+F / Cmd+F shortcut to open Find & Replace
  useEffect(() => {
    const handleFindShortcut = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        if (!isRawEditing) {
          e.preventDefault();
          setIsFindReplaceOpen(prev => !prev);
        }
      }
    };
    window.addEventListener('keydown', handleFindShortcut);
    return () => window.removeEventListener('keydown', handleFindShortcut);
  }, [isRawEditing]);

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
        subscript: Boolean(document.queryCommandState('subscript')),
        superscript: Boolean(document.queryCommandState('superscript')),
      });
    } catch {}
  }, []);

  // Update floating selection bubble toolbar position and live word/char metrics
  const updateSelectionState = useCallback(() => {
    checkActiveFormats();
    if (!editorRef.current) return;
    const metrics = getSelectionMetrics(editorRef.current);
    setSelectionMetrics(metrics);
    if (!metrics.isCollapsed && metrics.rect && editorRef.current) {
      const editorRect = editorRef.current.getBoundingClientRect();
      const top = Math.max(10, metrics.rect.top - editorRect.top - 46);
      const left = Math.max(12, Math.min(editorRect.width - 360, metrics.rect.left - editorRect.left + (metrics.rect.width / 2) - 180));
      setFloatingToolbarPos({ top, left });
    } else {
      setFloatingToolbarPos(null);
    }
  }, [checkActiveFormats]);

  useEffect(() => {
    const handleSelectionChange = () => {
      const range = saveSelectionRange();
      if (range && editorRef.current && editorRef.current.contains(range.commonAncestorContainer)) {
        savedRangeRef.current = range;
      }
      updateSelectionState();
    };
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [updateSelectionState]);

  // Esc key closes Zen Mode and floating menus
  useEffect(() => {
    const handleZenEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isZenMode) setIsZenMode(false);
        setFloatingToolbarPos(null);
      }
    };
    window.addEventListener('keydown', handleZenEsc);
    return () => window.removeEventListener('keydown', handleZenEsc);
  }, [isZenMode]);

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

  // Handle direct text input inside contentEditable (Google Docs non-destructive behavior)
  const handleEditorInput = useCallback(() => {
    isUserTypingRef.current = true;
    setIsSaving(true);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      if (editorRef.current) {
        const currentHtml = editorRef.current.innerHTML;
        const extracted = extractTextFromDoc(editorRef.current);
        lastSyncedTextRef.current = extracted;
        onUpdateResumeText(extracted);
        pushState(extracted);
        snapshotStackRef.current.push(currentHtml, extracted);
        try {
          localStorage.setItem('user_custom_resume', extracted);
          localStorage.setItem('user_custom_resume_html', currentHtml);
        } catch {}
      }
      setIsSaving(false);
      setLastSavedTime('Just now');
      isUserTypingRef.current = false;
    }, 350);
  }, [onUpdateResumeText, pushState]);

  // Google Docs Non-Destructive Undo / Redo
  const handleUndo = useCallback(() => {
    // 1. Try native browser undo first
    if (typeof document !== 'undefined') {
      try {
        const undone = document.execCommand('undo', false);
        if (undone && editorRef.current) {
          const extracted = extractTextFromDoc(editorRef.current);
          lastSyncedTextRef.current = extracted;
          onUpdateResumeText(extracted);
          checkActiveFormats();
          return;
        }
      } catch {}
    }
    // 2. Fallback to HTML snapshot stack
    const snapshot = snapshotStackRef.current.undo();
    if (snapshot && editorRef.current) {
      editorRef.current.innerHTML = snapshot.html;
      lastSyncedTextRef.current = snapshot.text;
      onUpdateResumeText(snapshot.text);
      checkActiveFormats();
    }
  }, [checkActiveFormats, onUpdateResumeText]);

  const handleRedo = useCallback(() => {
    // 1. Try native browser redo first
    if (typeof document !== 'undefined') {
      try {
        const redone = document.execCommand('redo', false);
        if (redone && editorRef.current) {
          const extracted = extractTextFromDoc(editorRef.current);
          lastSyncedTextRef.current = extracted;
          onUpdateResumeText(extracted);
          checkActiveFormats();
          return;
        }
      } catch {}
    }
    // 2. Fallback to HTML snapshot stack
    const snapshot = snapshotStackRef.current.redo();
    if (snapshot && editorRef.current) {
      editorRef.current.innerHTML = snapshot.html;
      lastSyncedTextRef.current = snapshot.text;
      onUpdateResumeText(snapshot.text);
      checkActiveFormats();
    }
  }, [checkActiveFormats, onUpdateResumeText]);

  // Comprehensive Google Docs Keyboard Shortcuts Map
  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!editorRef.current) return;

    // 1. Markdown shortcuts on Space (e.g. '* ' -> bullet list, '1. ' -> ordered list, '## ' -> h2, '---' -> hr)
    if (e.key === ' ') {
      if (handleMarkdownShortcut(editorRef.current, e)) {
        handleEditorInput();
        checkActiveFormats();
        return;
      }
    }

    // 2. Smart Enter: exits list if empty bullet, creates clean li if not, handles soft break Shift+Enter
    if (e.key === 'Enter') {
      if (handleSmartEnter(editorRef.current, e)) {
        handleEditorInput();
        checkActiveFormats();
        return;
      }
    }

    // 3. Smart Backspace: unbullets empty li at offset 0
    if (e.key === 'Backspace') {
      if (handleSmartBackspace(editorRef.current, e)) {
        handleEditorInput();
        checkActiveFormats();
        return;
      }
    }

    // 4. Tab / Shift+Tab indent and outdent
    if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) {
        document.execCommand('outdent', false);
      } else {
        document.execCommand('indent', false);
      }
      handleEditorInput();
      checkActiveFormats();
      return;
    }

    // 5. Move item Up / Down via Alt+ArrowUp / Alt+ArrowDown
    if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      const moved = handleMoveItem(editorRef.current, e.key === 'ArrowUp' ? 'up' : 'down');
      if (moved) {
        handleEditorInput();
        return;
      }
    }

    // 6. Complete Google Docs Shortcuts Map
    const isMod = e.ctrlKey || e.metaKey;
    if (isMod) {
      const key = e.key.toLowerCase();

      // Ctrl+K -> Hyperlink Modal
      if (key === 'k') {
        e.preventDefault();
        openLinkModal();
        return;
      }

      // Ctrl+Shift+7 -> Numbered list
      if (e.shiftKey && (e.key === '7' || e.key === '&')) {
        e.preventDefault();
        document.execCommand('insertOrderedList', false);
        handleEditorInput();
        checkActiveFormats();
        return;
      }

      // Ctrl+Shift+8 -> Bullet list
      if (e.shiftKey && (e.key === '8' || e.key === '*')) {
        e.preventDefault();
        document.execCommand('insertUnorderedList', false);
        handleEditorInput();
        checkActiveFormats();
        return;
      }

      // Ctrl+Shift+L -> Left Align
      if (e.shiftKey && key === 'l') {
        e.preventDefault();
        document.execCommand('justifyLeft', false);
        handleEditorInput();
        checkActiveFormats();
        return;
      }

      // Ctrl+Shift+E -> Center Align
      if (e.shiftKey && key === 'e') {
        e.preventDefault();
        document.execCommand('justifyCenter', false);
        handleEditorInput();
        checkActiveFormats();
        return;
      }

      // Ctrl+Shift+R -> Right Align
      if (e.shiftKey && key === 'r') {
        e.preventDefault();
        document.execCommand('justifyRight', false);
        handleEditorInput();
        checkActiveFormats();
        return;
      }

      // Ctrl+Shift+J -> Justify
      if (e.shiftKey && key === 'j') {
        e.preventDefault();
        document.execCommand('justifyFull', false);
        handleEditorInput();
        checkActiveFormats();
        return;
      }

      // Ctrl+\ -> Clear Formatting
      if (key === '\\') {
        e.preventDefault();
        document.execCommand('removeFormat', false);
        handleEditorInput();
        checkActiveFormats();
        return;
      }

      // Ctrl+[ -> Outdent
      if (e.key === '[') {
        e.preventDefault();
        document.execCommand('outdent', false);
        handleEditorInput();
        checkActiveFormats();
        return;
      }

      // Ctrl+] -> Indent
      if (e.key === ']') {
        e.preventDefault();
        document.execCommand('indent', false);
        handleEditorInput();
        checkActiveFormats();
        return;
      }

      // Ctrl+Alt+1 -> Heading 1
      if (e.altKey && e.key === '1') {
        e.preventDefault();
        document.execCommand('formatBlock', false, '<h1>');
        handleEditorInput();
        return;
      }

      // Ctrl+Alt+2 -> Heading 2
      if (e.altKey && e.key === '2') {
        e.preventDefault();
        document.execCommand('formatBlock', false, '<h2>');
        handleEditorInput();
        return;
      }

      // Ctrl+Alt+0 -> Normal Paragraph
      if (e.altKey && e.key === '0') {
        e.preventDefault();
        document.execCommand('formatBlock', false, '<p>');
        handleEditorInput();
        return;
      }
    }
  };

  // Handle pasting clean plain text & multi-line bullets into the document
  const handleEditorPaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text/plain');
    if (!text) return;

    const parsed = parseSmartPastedText(text);
    if (parsed.isBulletList && parsed.items.length > 0) {
      e.preventDefault();
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0 && editorRef.current) {
        let node: Node | null = sel.anchorNode;
        let insideList: HTMLElement | null = null;
        while (node && node !== editorRef.current) {
          if (node.nodeName === 'UL' || node.nodeName === 'OL') {
            insideList = node as HTMLElement;
            break;
          }
          node = node.parentNode;
        }

        if (insideList) {
          const lisHtml = parsed.items.map(item => `<li>${escapeHtml(item)}</li>`).join('');
          document.execCommand('insertHTML', false, lisHtml);
        } else {
          const ulHtml = `<ul class="doc-bullets list-disc pl-5 space-y-1 my-1.5 text-xs text-zinc-800 dark:text-zinc-200">${parsed.items.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
          document.execCommand('insertHTML', false, ulHtml);
        }
        handleEditorInput();
        return;
      }
    }

    e.preventDefault();
    document.execCommand('insertText', false, text);
    handleEditorInput();
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
  }, [handleUndo, handleRedo]);

  // Elevate selected bullet text in place with STAR formula + active metrics
  const handleElevateSelectedText = () => {
    if (!editorRef.current) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;

    const range = sel.getRangeAt(0);
    const selectedText = range.toString().trim();
    if (!selectedText) return;

    const verbs = ['Architected', 'Engineered', 'Spearheaded', 'Orchestrated', 'Optimized', 'Scaled'];
    const chosenVerb = verbs[Math.floor(Math.random() * verbs.length)];
    let clean = selectedText.replace(/^[•\-\*\s]+/, '');
    clean = clean.charAt(0).toUpperCase() + clean.slice(1);

    let elevated = clean;
    if (!/\b(reducing|improving|increasing|slashing|scaling|processing|delivering|benchmarking)\b/i.test(elevated)) {
      elevated = `${chosenVerb} ${elevated.replace(/^(built|worked on|made|created|helped|did)\s+/i, '')}, slashing latency by 42% and ensuring 99.99% fault tolerance across distributed services.`;
    } else {
      elevated = `${chosenVerb} ${elevated.replace(/^(built|worked on|made|created|helped|did)\s+/i, '')}`;
    }

    range.deleteContents();
    const span = document.createElement('span');
    span.className = 'bg-emerald-500/20 text-emerald-950 dark:text-emerald-100 rounded px-0.5 transition-colors duration-1000';
    span.textContent = elevated;
    range.insertNode(span);

    setTimeout(() => {
      span.classList.remove('bg-emerald-500/20');
    }, 2500);

    setElevateFeedback('✓ AI Elevated with STAR metrics (+12 pts)');
    setTimeout(() => setElevateFeedback(null), 3000);
    setFloatingToolbarPos(null);
    handleEditorInput();
  };

  // Smooth scroll to section in canvas
  const handleScrollToSection = (sectionName: string) => {
    if (!editorRef.current) return;
    const headers = Array.from(editorRef.current.querySelectorAll('h2, h1, .doc-section-header'));
    const target = headers.find(h => (h.textContent || '').toLowerCase().includes(sectionName.toLowerCase()));
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target.classList.add('ring-2', 'ring-emerald-500/50', 'rounded');
      setTimeout(() => target.classList.remove('ring-2', 'ring-emerald-500/50', 'rounded'), 1600);
    }
  };

  // 1-Click quick bullet addition to active or first experience section
  const handleQuickAddBullet = () => {
    if (!editorRef.current) return;
    const uls = Array.from(editorRef.current.querySelectorAll('ul.doc-bullets, ul'));
    const targetUl = uls[0];
    if (targetUl) {
      const li = document.createElement('li');
      li.textContent = 'Engineered resilient microservices pipeline processing 50k+ daily transactions with 99.99% uptime';
      targetUl.appendChild(li);
      li.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      const sel = window.getSelection();
      if (sel) {
        const range = document.createRange();
        range.selectNodeContents(li);
        sel.removeAllRanges();
        sel.addRange(range);
      }
      handleEditorInput();
    } else {
      handleInsertSectionIntoDoc('EXPERIENCE');
    }
  };

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

  // ── Extended Google Docs Tools Handlers ──────────────────────────────────
  const handleApplyBulletStyle = (style: BulletStyle) => {
    setIsBulletMenuOpen(false);
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && editorRef.current) {
      let node: Node | null = sel.anchorNode;
      let listEl: HTMLElement | null = null;
      while (node && node !== editorRef.current) {
        if (node.nodeName === 'UL' || node.nodeName === 'OL') {
          listEl = node as HTMLElement;
          break;
        }
        node = node.parentNode;
      }
      if (listEl) {
        if (style === 'numbered') {
          if (listEl.nodeName === 'UL') {
            const ol = document.createElement('ol');
            ol.className = 'doc-bullets list-decimal pl-5 space-y-1 my-1.5 text-xs text-zinc-800 dark:text-zinc-200';
            ol.innerHTML = listEl.innerHTML;
            listEl.parentNode?.replaceChild(ol, listEl);
          }
        } else {
          const info = detectBulletStyleFromGlyph(
            style === 'dash' ? '–' : style === 'square' ? '▪' : style === 'arrow' ? '▸' : style === 'diamond' ? '◆' : style === 'circle' ? '◦' : style === 'check' ? '✓' : '•'
          );
          if (listEl.nodeName === 'OL') {
            const ul = document.createElement('ul');
            ul.className = info.cssListStyle === 'disc'
              ? 'doc-bullets list-disc pl-4 space-y-1 my-1.5 text-xs text-zinc-800 dark:text-zinc-200'
              : 'doc-bullets pl-4 space-y-1 my-1.5 text-xs text-zinc-800 dark:text-zinc-200';
            if (info.cssListStyle !== 'disc') {
              ul.style.listStyleType = info.cssListStyle;
            }
            ul.setAttribute('data-bullet-style', style);
            ul.innerHTML = listEl.innerHTML;
            listEl.parentNode?.replaceChild(ul, listEl);
          } else {
            listEl.className = info.cssListStyle === 'disc'
              ? 'doc-bullets list-disc pl-4 space-y-1 my-1.5 text-xs text-zinc-800 dark:text-zinc-200'
              : 'doc-bullets pl-4 space-y-1 my-1.5 text-xs text-zinc-800 dark:text-zinc-200';
            if (info.cssListStyle === 'disc') {
              listEl.style.removeProperty('list-style-type');
            } else {
              listEl.style.listStyleType = info.cssListStyle;
            }
            listEl.setAttribute('data-bullet-style', style);
          }
        }
        handleEditorInput();
        checkActiveFormats();
        return;
      }
    }
    // If not currently in a list, insert list and apply style
    if (style === 'numbered') {
      document.execCommand('insertOrderedList', false);
    } else {
      document.execCommand('insertUnorderedList', false);
      const info = detectBulletStyleFromGlyph(
        style === 'dash' ? '–' : style === 'square' ? '▪' : style === 'arrow' ? '▸' : style === 'diamond' ? '◆' : style === 'circle' ? '◦' : style === 'check' ? '✓' : '•'
      );
      if (editorRef.current) {
        const uls = editorRef.current.querySelectorAll('ul');
        const lastUl = uls[uls.length - 1];
        if (lastUl) {
          if (info.cssListStyle !== 'disc') {
            lastUl.style.listStyleType = info.cssListStyle;
          }
          lastUl.setAttribute('data-bullet-style', style);
        }
      }
    }
    handleUpdateLayout({ bulletStyle: style });
    handleEditorInput();
    checkActiveFormats();
  };

  const handleApplyTextColor = (color: string) => {
    setIsColorMenuOpen(false);
    document.execCommand('foreColor', false, color);
    handleEditorInput();
  };

  const handleApplyHighlightColor = (color: string) => {
    setIsHighlightMenuOpen(false);
    document.execCommand('hiliteColor', false, color);
    handleEditorInput();
  };

  const openLinkModal = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      savedRangeRef.current = sel.getRangeAt(0).cloneRange();
    }
    setIsLinkModalOpen(true);
  };

  const handleInsertLink = () => {
    if (!linkInputUrl.trim()) return;
    let url = linkInputUrl.trim();
    if (!/^https?:\/\//i.test(url) && !/^mailto:/i.test(url)) {
      url = `https://${url}`;
    }
    if (savedRangeRef.current) {
      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(savedRangeRef.current);
      }
    }
    document.execCommand('createLink', false, url);
    if (editorRef.current) {
      const links = editorRef.current.querySelectorAll('a');
      links.forEach(a => {
        a.setAttribute('target', '_blank');
        a.setAttribute('rel', 'noopener noreferrer');
        a.className = 'text-zinc-900 dark:text-zinc-100 underline decoration-zinc-400 hover:decoration-zinc-900 transition-colors';
      });
    }
    setIsLinkModalOpen(false);
    setLinkInputUrl('');
    handleEditorInput();
  };

  const handleRemoveLink = () => {
    document.execCommand('unlink', false);
    handleEditorInput();
  };

  const handleInsertHorizontalRule = () => {
    document.execCommand('insertHorizontalRule', false);
    if (editorRef.current) {
      const hrs = editorRef.current.querySelectorAll('hr:not(.doc-page-break)');
      hrs.forEach(hr => {
        hr.className = 'my-3 border-t border-zinc-300 dark:border-zinc-700';
      });
    }
    handleEditorInput();
  };

  const handleConvertCase = (mode: 'upper' | 'lower' | 'title') => {
    setIsCaseMenuOpen(false);
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
    const range = sel.getRangeAt(0);
    const selectedText = range.toString();
    if (!selectedText) return;

    let converted = selectedText;
    if (mode === 'upper') {
      converted = selectedText.toUpperCase();
    } else if (mode === 'lower') {
      converted = selectedText.toLowerCase();
    } else if (mode === 'title') {
      converted = selectedText.replace(/\w\S*/g, txt => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase());
    }

    document.execCommand('insertText', false, converted);
    handleEditorInput();
  };

  const handleInsertTable = (rows: number, cols: number) => {
    setIsTableMenuOpen(false);
    let tableHtml = `<table class="doc-table w-full my-3 border border-zinc-200 dark:border-zinc-700/80 rounded border-collapse text-xs text-zinc-800 dark:text-zinc-200">\n  <tbody>`;
    for (let r = 0; r < rows; r++) {
      tableHtml += `\n    <tr>`;
      for (let c = 0; c < cols; c++) {
        tableHtml += `\n      <td class="p-2 border border-zinc-200 dark:border-zinc-700/80 min-w-[80px] align-top">${r === 0 ? `<strong>Col ${c + 1}</strong>` : 'Content'}</td>`;
      }
      tableHtml += `\n    </tr>`;
    }
    tableHtml += `\n  </tbody>\n</table>\n<p class="my-1"><br></p>`;
    document.execCommand('insertHTML', false, tableHtml);
    handleEditorInput();
  };

  // Find & Replace Handlers
  const handleFindNext = (backwards = false) => {
    if (!findSearchTerm.trim()) return;
    if (typeof window !== 'undefined' && (window as any).find) {
      const found = (window as any).find(findSearchTerm, false, backwards, true, false, false, false);
      if (!found) {
        (window as any).find(findSearchTerm, false, backwards, false, false, false, false);
      }
    }
  };

  const handleReplaceCurrent = () => {
    if (!findSearchTerm) return;
    const sel = window.getSelection();
    if (sel && sel.toString().toLowerCase() === findSearchTerm.toLowerCase()) {
      document.execCommand('insertText', false, findReplaceTerm);
      handleEditorInput();
      handleFindNext(false);
    } else {
      handleFindNext(false);
    }
  };

  const handleReplaceAll = () => {
    if (!findSearchTerm || !editorRef.current) return;
    const currentHtml = editorRef.current.innerHTML;
    const escapedTerm = findSearchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedTerm, 'gi');
    const newHtml = currentHtml.replace(regex, findReplaceTerm);
    editorRef.current.innerHTML = newHtml;
    handleEditorInput();
    setFindMatchCount(0);
  };

  useEffect(() => {
    if (!findSearchTerm.trim()) {
      setFindMatchCount(0);
      return;
    }
    const fullText = editorRef.current ? extractTextFromDoc(editorRef.current) : rawText;
    const escaped = findSearchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const matches = fullText.match(new RegExp(escaped, 'gi'));
    setFindMatchCount(matches ? matches.length : 0);
  }, [findSearchTerm, rawText]);

  // Document Statistics
  const documentStats = useMemo(() => {
    const fullText = editorRef.current ? extractTextFromDoc(editorRef.current) : rawText;
    const words = fullText.trim().split(/\s+/).filter(Boolean).length;
    const charsWithSpaces = fullText.length;
    const charsNoSpaces = fullText.replace(/\s+/g, '').length;
    const bulletRegex = /^[\uF0B7\u25CF\u25CB\u25A0\u25AA\u2022\u2023\u2043\u2013\u2014•▪▸▹‣◦○*\-●■◆✦➢✓–—]/;
    const bulletsCount = fullText.split('\n').filter(l => bulletRegex.test(l.trim())).length;
    const readingTime = Math.max(1, Math.ceil(words / 200));
    return {
      words,
      charsWithSpaces,
      charsNoSpaces,
      lines: rawLines.length,
      sections: sectionBreakdown.length,
      bullets: bulletsCount,
      readingTime,
    };
  }, [rawText, rawLines, sectionBreakdown]);

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

  // Replace an existing bullet in the document canvas with elevated AI recommendation
  const handleReplaceBulletText = (originalText: string, newText: string) => {
    if (!editorRef.current) return;

    const cleanOriginal = originalText.replace(/^[•\-\*\u2022\u2023\u25E6\u2043\u2219▪▸⁃\s]+/, '').trim();
    const cleanNew = newText.replace(/^[•\-\*\u2022\u2023\u25E6\u2043\u2219▪▸⁃\s]+/, '').trim();

    // 1. Direct DOM traversal through <li> elements for exact precision
    const listItems = Array.from(editorRef.current.querySelectorAll('li'));
    let replaced = false;

    for (const li of listItems) {
      const liText = (li.textContent || '').trim();
      if (
        liText.includes(cleanOriginal) ||
        cleanOriginal.includes(liText) ||
        (cleanOriginal.length > 25 && liText.includes(cleanOriginal.slice(0, 25)))
      ) {
        li.innerHTML = `<span class="bg-emerald-500/20 text-emerald-950 dark:text-emerald-100 transition-colors duration-1000">${escapeHtml(cleanNew)}</span>`;
        replaced = true;
        break;
      }
    }

    // 2. Second attempt: Check paragraph elements or innerHTML text match
    if (!replaced) {
      const paragraphs = Array.from(editorRef.current.querySelectorAll('p'));
      for (const p of paragraphs) {
        const pText = (p.textContent || '').trim();
        if (pText.includes(cleanOriginal) || cleanOriginal.includes(pText)) {
          const bulletGlyph = pText.startsWith('•') ? '• ' : pText.startsWith('-') ? '- ' : '';
          p.innerHTML = `${bulletGlyph}<span class="bg-emerald-500/20 text-emerald-950 dark:text-emerald-100 transition-colors duration-1000">${escapeHtml(cleanNew)}</span>`;
          replaced = true;
          break;
        }
      }
    }

    // 3. Third attempt: innerHTML string replacement
    if (!replaced) {
      const currentHtml = editorRef.current.innerHTML;
      const targetEscaped = escapeHtml(cleanOriginal);
      if (currentHtml.includes(targetEscaped)) {
        editorRef.current.innerHTML = currentHtml.replace(
          targetEscaped,
          `<span class="bg-emerald-500/20 text-emerald-950 dark:text-emerald-100 transition-colors duration-1000">${escapeHtml(cleanNew)}</span>`
        );
        replaced = true;
      }
    }

    // 4. Fallback: if bullet was not found in document, append it cleanly
    if (!replaced) {
      handleInsertBulletIntoDoc(cleanNew);
      return;
    }

    handleEditorInput();
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

      {/* ── GOOGLE DOCS FLOATING SELECTION BUBBLE TOOLBAR ── */}
      {floatingToolbarPos && !isRawEditing && (
        <div 
          style={{ top: floatingToolbarPos.top, left: floatingToolbarPos.left }}
          className="absolute z-40 bg-zinc-950/95 dark:bg-zinc-900/95 text-white border border-zinc-700/80 rounded-xl shadow-2xl p-1 flex items-center gap-1 backdrop-blur-md animate-in fade-in zoom-in-95 duration-100 select-none text-xs"
        >
          <button
            type="button"
            onMouseDown={preventFocusLoss}
            onClick={() => {
              document.execCommand('bold', false);
              handleEditorInput();
              checkActiveFormats();
            }}
            className={`px-2 py-1 rounded font-bold transition-colors ${
              activeFormats.bold ? 'bg-white text-zinc-950' : 'hover:bg-zinc-800 text-zinc-200'
            }`}
            title="Bold (Ctrl+B)"
          >
            B
          </button>
          <button
            type="button"
            onMouseDown={preventFocusLoss}
            onClick={() => {
              document.execCommand('italic', false);
              handleEditorInput();
              checkActiveFormats();
            }}
            className={`px-2 py-1 rounded italic transition-colors ${
              activeFormats.italic ? 'bg-white text-zinc-950' : 'hover:bg-zinc-800 text-zinc-200'
            }`}
            title="Italic (Ctrl+I)"
          >
            I
          </button>
          <button
            type="button"
            onMouseDown={preventFocusLoss}
            onClick={() => {
              document.execCommand('underline', false);
              handleEditorInput();
              checkActiveFormats();
            }}
            className={`px-2 py-1 rounded underline transition-colors ${
              activeFormats.underline ? 'bg-white text-zinc-950' : 'hover:bg-zinc-800 text-zinc-200'
            }`}
            title="Underline (Ctrl+U)"
          >
            U
          </button>
          <button
            type="button"
            onMouseDown={preventFocusLoss}
            onClick={() => {
              document.execCommand('strikeThrough', false);
              handleEditorInput();
              checkActiveFormats();
            }}
            className={`px-2 py-1 rounded line-through transition-colors ${
              activeFormats.strike ? 'bg-white text-zinc-950' : 'hover:bg-zinc-800 text-zinc-200'
            }`}
            title="Strikethrough"
          >
            S
          </button>

          <div className="h-3.5 w-px bg-zinc-700 mx-0.5" />

          <button
            type="button"
            onMouseDown={preventFocusLoss}
            onClick={() => handleApplyHighlightColor('#bbf7d0')}
            className="p-1.5 rounded hover:bg-zinc-800 text-zinc-300 transition-colors"
            title="Highlight with Emerald"
          >
            <Highlighter className="w-3.5 h-3.5 text-emerald-400" />
          </button>

          <button
            type="button"
            onMouseDown={preventFocusLoss}
            onClick={openLinkModal}
            className="p-1.5 rounded hover:bg-zinc-800 text-zinc-300 transition-colors"
            title="Add Link (Ctrl+K)"
          >
            <Link className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onMouseDown={preventFocusLoss}
            onClick={() => handleConvertCase('title')}
            className="px-1.5 py-1 rounded text-[11px] font-mono hover:bg-zinc-800 text-zinc-300 transition-colors"
            title="Convert to Title Case"
          >
            Aa
          </button>

          <div className="h-3.5 w-px bg-zinc-700 mx-0.5" />

          {/* AI Elevate Bullet */}
          <button
            type="button"
            onMouseDown={preventFocusLoss}
            onClick={handleElevateSelectedText}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] font-mono shadow-xs transition-colors cursor-pointer"
            title="Elevate selected bullet with STAR formula + active metrics"
          >
            <Sparkles className="w-3 h-3 text-emerald-200 animate-pulse" />
            <span>Elevate</span>
          </button>

          {/* Selection word/char count badge */}
          <div className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
            selectionMetrics.words <= 22 
              ? 'bg-zinc-900 text-emerald-400 border-zinc-800' 
              : 'bg-zinc-900 text-amber-400 border-zinc-800'
          }`} title={`${selectionMetrics.words} words, ${selectionMetrics.chars} characters`}>
            {selectionMetrics.words}w • {selectionMetrics.chars}c
          </div>
        </div>
      )}

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
    <div className="flex flex-col h-full w-full bg-zinc-50 dark:bg-[#09090B] text-zinc-900 dark:text-zinc-100 transition-colors duration-200 select-none overflow-hidden min-h-0 rounded-xl border border-zinc-200/80 dark:border-[#27272A] shadow-xs">
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
      <header className="shrink-0 sticky top-0 z-40 bg-white/95 dark:bg-[#121215]/95 backdrop-blur-md border-b border-zinc-200 dark:border-[#27272A] px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-xs">
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

          {/* Toggle Focus Mode / Zen Writing */}
          <button
            type="button"
            onClick={() => {
              setIsZenMode(prev => !prev);
              if (!isZenMode) {
                setIsInspectorOpen(false);
              } else {
                setIsInspectorOpen(true);
              }
            }}
            className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs ${
              isZenMode
                ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 border-zinc-900 dark:border-white'
                : 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-[#27272A] text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
            }`}
            title="Focus Mode / Fullscreen Writing Canvas (Esc to exit)"
          >
            {isZenMode ? <Minimize2 className="w-3.5 h-3.5 text-emerald-400" /> : <Maximize2 className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{isZenMode ? 'Exit Focus' : 'Focus Mode'}</span>
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
      <div className="flex-1 flex flex-col lg:flex-row items-stretch justify-start relative overflow-hidden min-h-0 h-full">
        {/* ── LEFT DOCUMENT CANVAS WORKSPACE (Toolbar + Paper Stage) ───────── */}
        <div className="flex-1 flex flex-col min-w-0 bg-zinc-100/70 dark:bg-[#0c0c0e] relative h-full min-h-0 overflow-hidden">
          {/* ── GOOGLE DOCS-STYLE FORMATTING TOOLBAR (Strictly Scoped to Document Canvas) ── */}
          <nav 
            aria-label="Document Formatting Controls" 
            className="shrink-0 sticky top-0 z-20 bg-white/95 dark:bg-[#151518]/95 backdrop-blur-md border-b border-zinc-200 dark:border-[#27272A] px-3 sm:px-4 py-1.5 flex items-center justify-between gap-1.5 shadow-2xs overflow-x-auto select-none"
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

              {/* Text Styling: Bold, Italic, Underline, Strikethrough, Subscript, Superscript */}
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
                <button
                  type="button"
                  onMouseDown={preventFocusLoss}
                  onClick={() => {
                    document.execCommand('subscript', false);
                    handleEditorInput();
                    checkActiveFormats();
                  }}
                  className={`p-1 rounded transition-colors ${
                    activeFormats.subscript
                      ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-2xs'
                      : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                  }`}
                  title="Subscript (x₂)"
                >
                  <Subscript className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onMouseDown={preventFocusLoss}
                  onClick={() => {
                    document.execCommand('superscript', false);
                    handleEditorInput();
                    checkActiveFormats();
                  }}
                  className={`p-1 rounded transition-colors ${
                    activeFormats.superscript
                      ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-2xs'
                      : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                  }`}
                  title="Superscript (x²)"
                >
                  <Superscript className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800 mx-0.5 shrink-0" />

              {/* Text Color & Highlight Swatches */}
              <div className="flex items-center gap-0.5 bg-zinc-100 dark:bg-zinc-800/90 border border-zinc-200 dark:border-zinc-700 rounded-md p-0.5">
                {/* Text Color Dropdown */}
                <div className="relative toolbar-dropdown-container">
                  <button
                    type="button"
                    onMouseDown={preventFocusLoss}
                    onClick={() => {
                      setIsColorMenuOpen(!isColorMenuOpen);
                      setIsHighlightMenuOpen(false);
                      setIsBulletMenuOpen(false);
                      setIsCaseMenuOpen(false);
                      setIsTableMenuOpen(false);
                    }}
                    className="p-1 rounded text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 flex items-center gap-0.5"
                    title="Text color"
                  >
                    <Palette className="w-3.5 h-3.5" />
                    <ChevronDown className="w-2.5 h-2.5 text-zinc-400" />
                  </button>

                  {isColorMenuOpen && (
                    <div className="absolute left-0 top-full mt-1.5 w-44 bg-white dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] rounded-xl shadow-xl p-2 z-50 animate-in fade-in duration-150">
                      <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block mb-1.5 px-1">Text Color</span>
                      <div className="grid grid-cols-4 gap-1.5">
                        {[
                          { label: 'Default', value: 'inherit', color: 'bg-zinc-900 dark:bg-zinc-100' },
                          { label: 'Charcoal', value: '#27272a', color: 'bg-zinc-800' },
                          { label: 'Muted Zinc', value: '#71717a', color: 'bg-zinc-500' },
                          { label: 'Slate', value: '#475569', color: 'bg-slate-600' },
                          { label: 'Emerald', value: '#059669', color: 'bg-emerald-600' },
                          { label: 'Amber', value: '#d97706', color: 'bg-amber-600' },
                          { label: 'Rose', value: '#e11d48', color: 'bg-rose-600' },
                          { label: 'Deep Steel', value: '#1e293b', color: 'bg-slate-800' },
                        ].map(swatch => (
                          <button
                            key={swatch.value}
                            type="button"
                            onMouseDown={preventFocusLoss}
                            onClick={() => handleApplyTextColor(swatch.value)}
                            className="w-8 h-8 rounded-lg flex items-center justify-center hover:scale-110 transition-transform border border-zinc-300 dark:border-zinc-700"
                            title={swatch.label}
                          >
                            <span className={`w-4 h-4 rounded-full ${swatch.color}`}></span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Highlight Color Dropdown */}
                <div className="relative toolbar-dropdown-container">
                  <button
                    type="button"
                    onMouseDown={preventFocusLoss}
                    onClick={() => {
                      setIsHighlightMenuOpen(!isHighlightMenuOpen);
                      setIsColorMenuOpen(false);
                      setIsBulletMenuOpen(false);
                      setIsCaseMenuOpen(false);
                      setIsTableMenuOpen(false);
                    }}
                    className="p-1 rounded text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 flex items-center gap-0.5"
                    title="Highlight color"
                  >
                    <Highlighter className="w-3.5 h-3.5" />
                    <ChevronDown className="w-2.5 h-2.5 text-zinc-400" />
                  </button>

                  {isHighlightMenuOpen && (
                    <div className="absolute left-0 top-full mt-1.5 w-44 bg-white dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] rounded-xl shadow-xl p-2 z-50 animate-in fade-in duration-150">
                      <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block mb-1.5 px-1">Highlight</span>
                      <div className="grid grid-cols-3 gap-1.5">
                        {[
                          { label: 'None', value: 'transparent', preview: 'border border-dashed border-zinc-400' },
                          { label: 'Yellow', value: '#fef08a', preview: 'bg-amber-200' },
                          { label: 'Emerald', value: '#bbf7d0', preview: 'bg-emerald-200' },
                          { label: 'Amber', value: '#fde68a', preview: 'bg-amber-300' },
                          { label: 'Zinc', value: '#e4e4e7', preview: 'bg-zinc-300' },
                          { label: 'Slate', value: '#cbd5e1', preview: 'bg-slate-300' },
                        ].map(swatch => (
                          <button
                            key={swatch.label}
                            type="button"
                            onMouseDown={preventFocusLoss}
                            onClick={() => handleApplyHighlightColor(swatch.value)}
                            className="h-7 px-1.5 rounded-lg flex items-center justify-center text-[10px] font-medium border border-zinc-200 dark:border-zinc-700 hover:scale-105 transition-transform"
                            title={swatch.label}
                          >
                            <span className={`w-3.5 h-3.5 rounded-full mr-1 ${swatch.preview}`}></span>
                            <span className="text-zinc-700 dark:text-zinc-300 truncate">{swatch.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
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

              {/* Bullet Styles & Lists: Google Docs Bullet Dropdown, Numbered List, Indents */}
              <div className="flex items-center gap-0.5 bg-zinc-100 dark:bg-zinc-800/90 border border-zinc-200 dark:border-zinc-700 rounded-md p-0.5">
                {/* Bullet Style Dropdown */}
                <div className="relative toolbar-dropdown-container">
                  <button
                    type="button"
                    onMouseDown={preventFocusLoss}
                    onClick={() => {
                      setIsBulletMenuOpen(!isBulletMenuOpen);
                      setIsColorMenuOpen(false);
                      setIsHighlightMenuOpen(false);
                      setIsCaseMenuOpen(false);
                      setIsTableMenuOpen(false);
                    }}
                    className={`p-1 rounded flex items-center gap-0.5 transition-colors ${
                      activeFormats.unorderedList
                        ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-2xs'
                        : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                    }`}
                    title="Bullet points & style picker"
                  >
                    <List className="w-3.5 h-3.5" />
                    <ChevronDown className="w-2.5 h-2.5 text-zinc-400" />
                  </button>

                  {isBulletMenuOpen && (
                    <div className="absolute left-0 top-full mt-1.5 w-52 bg-white dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] rounded-xl shadow-xl p-1.5 z-50 animate-in fade-in duration-150">
                      <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block mb-1 px-2 py-0.5">Bullet Point Styles</span>
                      {[
                        { style: 'disc' as BulletStyle, glyph: '•', label: 'Disc (Standard)' },
                        { style: 'dash' as BulletStyle, glyph: '–', label: 'En-Dash (Modern)' },
                        { style: 'square' as BulletStyle, glyph: '▪', label: 'Square (Technical)' },
                        { style: 'arrow' as BulletStyle, glyph: '▸', label: 'Right Arrow' },
                        { style: 'diamond' as BulletStyle, glyph: '◆', label: 'Filled Diamond' },
                        { style: 'circle' as BulletStyle, glyph: '◦', label: 'Open Circle' },
                        { style: 'check' as BulletStyle, glyph: '✓', label: 'Checkmark' },
                        { style: 'numbered' as BulletStyle, glyph: '1.', label: 'Numbered List' },
                      ].map(item => (
                        <button
                          key={item.style}
                          type="button"
                          onMouseDown={preventFocusLoss}
                          onClick={() => handleApplyBulletStyle(item.style)}
                          className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors ${
                            layoutOptions.bulletStyle === item.style
                              ? 'bg-zinc-100 dark:bg-zinc-800 font-semibold text-zinc-900 dark:text-zinc-100'
                              : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <span className="w-4 text-center font-bold text-zinc-900 dark:text-zinc-100">{item.glyph}</span>
                            <span>{item.label}</span>
                          </span>
                          {layoutOptions.bulletStyle === item.style && (
                            <Check className="w-3 h-3 text-emerald-500" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

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
              </div>

              <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800 mx-0.5 shrink-0 hidden lg:block" />

              {/* Insertion Tools: Links, Horizontal Rule, Tables */}
              <div className="flex items-center gap-0.5 bg-zinc-100 dark:bg-zinc-800/90 border border-zinc-200 dark:border-zinc-700 rounded-md p-0.5 hidden lg:flex">
                <button
                  type="button"
                  onMouseDown={preventFocusLoss}
                  onClick={openLinkModal}
                  className="p-1 rounded text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                  title="Insert Hyperlink (Ctrl+K)"
                >
                  <Link className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onMouseDown={preventFocusLoss}
                  onClick={handleRemoveLink}
                  className="p-1 rounded text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                  title="Remove Hyperlink"
                >
                  <Unlink className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onMouseDown={preventFocusLoss}
                  onClick={handleInsertHorizontalRule}
                  className="p-1 rounded text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                  title="Insert Horizontal Divider Line"
                >
                  <SeparatorHorizontal className="w-3.5 h-3.5" />
                </button>

                {/* Quick Table Insert Dropdown */}
                <div className="relative toolbar-dropdown-container">
                  <button
                    type="button"
                    onMouseDown={preventFocusLoss}
                    onClick={() => {
                      setIsTableMenuOpen(!isTableMenuOpen);
                      setIsBulletMenuOpen(false);
                      setIsColorMenuOpen(false);
                      setIsHighlightMenuOpen(false);
                      setIsCaseMenuOpen(false);
                    }}
                    className="p-1 rounded text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 flex items-center gap-0.5"
                    title="Insert Table"
                  >
                    <Table className="w-3.5 h-3.5" />
                    <ChevronDown className="w-2.5 h-2.5 text-zinc-400" />
                  </button>

                  {isTableMenuOpen && (
                    <div className="absolute left-0 top-full mt-1.5 w-44 bg-white dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] rounded-xl shadow-xl p-1.5 z-50 animate-in fade-in duration-150">
                      <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block mb-1 px-2 py-0.5">Quick Table</span>
                      {[
                        { rows: 2, cols: 2, label: '2 × 2 Skills Table' },
                        { rows: 3, cols: 2, label: '3 × 2 Columns' },
                        { rows: 3, cols: 3, label: '3 × 3 Grid' },
                        { rows: 4, cols: 2, label: '4 × 2 Extended' },
                      ].map(tbl => (
                        <button
                          key={tbl.label}
                          type="button"
                          onMouseDown={preventFocusLoss}
                          onClick={() => handleInsertTable(tbl.rows, tbl.cols)}
                          className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                        >
                          {tbl.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800 mx-0.5 shrink-0 hidden md:block" />

              {/* Case Conversion, Clear Formatting, Find & Replace, Stats */}
              <div className="flex items-center gap-0.5 bg-zinc-100 dark:bg-zinc-800/90 border border-zinc-200 dark:border-zinc-700 rounded-md p-0.5 hidden md:flex">
                {/* Case Conversion Dropdown */}
                <div className="relative toolbar-dropdown-container">
                  <button
                    type="button"
                    onMouseDown={preventFocusLoss}
                    onClick={() => {
                      setIsCaseMenuOpen(!isCaseMenuOpen);
                      setIsBulletMenuOpen(false);
                      setIsColorMenuOpen(false);
                      setIsHighlightMenuOpen(false);
                      setIsTableMenuOpen(false);
                    }}
                    className="p-1 rounded text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 flex items-center gap-0.5"
                    title="Change text case"
                  >
                    <CaseUpper className="w-3.5 h-3.5" />
                    <ChevronDown className="w-2.5 h-2.5 text-zinc-400" />
                  </button>

                  {isCaseMenuOpen && (
                    <div className="absolute left-0 top-full mt-1.5 w-40 bg-white dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] rounded-xl shadow-xl p-1.5 z-50 animate-in fade-in duration-150">
                      <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block mb-1 px-2 py-0.5">Text Case</span>
                      <button
                        type="button"
                        onMouseDown={preventFocusLoss}
                        onClick={() => handleConvertCase('upper')}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      >
                        UPPERCASE
                      </button>
                      <button
                        type="button"
                        onMouseDown={preventFocusLoss}
                        onClick={() => handleConvertCase('lower')}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      >
                        lowercase
                      </button>
                      <button
                        type="button"
                        onMouseDown={preventFocusLoss}
                        onClick={() => handleConvertCase('title')}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      >
                        Title Case
                      </button>
                    </div>
                  )}
                </div>

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

                <button
                  type="button"
                  onMouseDown={preventFocusLoss}
                  onClick={() => setIsFindReplaceOpen(!isFindReplaceOpen)}
                  className={`p-1 rounded transition-colors ${
                    isFindReplaceOpen
                      ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-2xs'
                      : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                  }`}
                  title="Find & Replace (Ctrl+F)"
                >
                  <Search className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onMouseDown={preventFocusLoss}
                  onClick={() => setIsStatsModalOpen(true)}
                  className="p-1 rounded text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                  title="Document Statistics & Metrics"
                >
                  <Info className="w-3.5 h-3.5" />
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

          {/* ── GOOGLE DOCS FLOATING FIND & REPLACE BAR ── */}
          {isFindReplaceOpen && (
            <div className="absolute top-12 right-6 z-30 bg-white dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] rounded-xl shadow-xl p-2.5 flex flex-wrap items-center gap-2 text-xs font-mono animate-in fade-in slide-in-from-top-2 duration-150 max-w-lg">
              <div className="flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg px-2 py-1 border border-zinc-200 dark:border-zinc-700">
                <Search className="w-3.5 h-3.5 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Find in document..."
                  value={findSearchTerm}
                  onChange={(e) => setFindSearchTerm(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleFindNext(e.shiftKey);
                    }
                  }}
                  autoFocus
                  className="bg-transparent border-none text-xs focus:outline-none w-32 sm:w-40 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400"
                />
                {findSearchTerm && (
                  <span className="text-[10px] text-zinc-500 font-semibold px-1">
                    {findMatchCount} {findMatchCount === 1 ? 'match' : 'matches'}
                  </span>
                )}
                <button
                  type="button"
                  onMouseDown={preventFocusLoss}
                  onClick={() => handleFindNext(true)}
                  className="p-0.5 text-zinc-500 hover:text-zinc-900 dark:hover:text-white rounded"
                  title="Previous match (Shift+Enter)"
                >
                  <ArrowUp className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onMouseDown={preventFocusLoss}
                  onClick={() => handleFindNext(false)}
                  className="p-0.5 text-zinc-500 hover:text-zinc-900 dark:hover:text-white rounded"
                  title="Next match (Enter)"
                >
                  <ArrowDown className="w-3 h-3" />
                </button>
              </div>

              <div className="flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg px-2 py-1 border border-zinc-200 dark:border-zinc-700">
                <input
                  type="text"
                  placeholder="Replace with..."
                  value={findReplaceTerm}
                  onChange={(e) => setFindReplaceTerm(e.target.value)}
                  className="bg-transparent border-none text-xs focus:outline-none w-28 sm:w-36 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400"
                />
                <button
                  type="button"
                  onMouseDown={preventFocusLoss}
                  onClick={handleReplaceCurrent}
                  className="px-1.5 py-0.5 bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 rounded text-[11px] font-sans font-medium text-zinc-800 dark:text-zinc-200 cursor-pointer"
                >
                  Replace
                </button>
                <button
                  type="button"
                  onMouseDown={preventFocusLoss}
                  onClick={handleReplaceAll}
                  className="px-1.5 py-0.5 bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 rounded text-[11px] font-sans font-medium text-zinc-800 dark:text-zinc-200 cursor-pointer"
                >
                  All
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsFindReplaceOpen(false)}
                className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded cursor-pointer"
                title="Close (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* ── DOCUMENT STATISTICS MODAL ── */}
          {isStatsModalOpen && (
            <div className="fixed inset-0 z-50 bg-zinc-950/60 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] rounded-2xl shadow-2xl max-w-md w-full p-6 text-zinc-900 dark:text-zinc-100 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                      <Info className="w-4 h-4 text-emerald-500" />
                    </div>
                    <h3 className="text-sm font-headline font-bold">Document Statistics</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsStatsModalOpen(false)}
                    className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-md cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="py-4 grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-zinc-50 dark:bg-zinc-900/60 rounded-xl border border-zinc-200 dark:border-zinc-800">
                    <span className="text-zinc-500 block font-mono text-[10px] uppercase">Words</span>
                    <span className="text-lg font-bold font-mono">{documentStats.words.toLocaleString()}</span>
                  </div>
                  <div className="p-3 bg-zinc-50 dark:bg-zinc-900/60 rounded-xl border border-zinc-200 dark:border-zinc-800">
                    <span className="text-zinc-500 block font-mono text-[10px] uppercase">Characters</span>
                    <span className="text-lg font-bold font-mono">{documentStats.charsWithSpaces.toLocaleString()}</span>
                  </div>
                  <div className="p-3 bg-zinc-50 dark:bg-zinc-900/60 rounded-xl border border-zinc-200 dark:border-zinc-800">
                    <span className="text-zinc-500 block font-mono text-[10px] uppercase">Characters (no spaces)</span>
                    <span className="text-lg font-bold font-mono">{documentStats.charsNoSpaces.toLocaleString()}</span>
                  </div>
                  <div className="p-3 bg-zinc-50 dark:bg-zinc-900/60 rounded-xl border border-zinc-200 dark:border-zinc-800">
                    <span className="text-zinc-500 block font-mono text-[10px] uppercase">Lines / Page Budget</span>
                    <span className="text-lg font-bold font-mono">{documentStats.lines} / {maxRecommendedLines}</span>
                  </div>
                  <div className="p-3 bg-zinc-50 dark:bg-zinc-900/60 rounded-xl border border-zinc-200 dark:border-zinc-800">
                    <span className="text-zinc-500 block font-mono text-[10px] uppercase">Bullet Points</span>
                    <span className="text-lg font-bold font-mono">{documentStats.bullets}</span>
                  </div>
                  <div className="p-3 bg-zinc-50 dark:bg-zinc-900/60 rounded-xl border border-zinc-200 dark:border-zinc-800">
                    <span className="text-zinc-500 block font-mono text-[10px] uppercase">Est. Reading Time</span>
                    <span className="text-lg font-bold font-mono">~{documentStats.readingTime} min</span>
                  </div>
                </div>

                <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setIsStatsModalOpen(false)}
                    className="px-4 py-1.5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 font-semibold text-xs rounded-lg hover:opacity-90 cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── HYPERLINK MODAL ── */}
          {isLinkModalOpen && (
            <div className="fixed inset-0 z-50 bg-zinc-950/60 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] rounded-2xl shadow-2xl max-w-sm w-full p-5 text-zinc-900 dark:text-zinc-100 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between pb-2 border-b border-zinc-200 dark:border-zinc-800">
                  <h3 className="text-xs font-headline font-bold flex items-center gap-1.5">
                    <Link className="w-3.5 h-3.5 text-zinc-500" />
                    <span>Insert Hyperlink</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => setIsLinkModalOpen(false)}
                    className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="py-3">
                  <label className="text-[11px] font-mono text-zinc-500 block mb-1">Target URL</label>
                  <input
                    type="text"
                    placeholder="https://linkedin.com/in/... or github.com/..."
                    value={linkInputUrl}
                    onChange={(e) => setLinkInputUrl(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleInsertLink();
                      }
                    }}
                    autoFocus
                    className="w-full px-2.5 py-1.5 text-xs bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100 focus:outline-none"
                  />
                </div>
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setIsLinkModalOpen(false)}
                    className="px-3 py-1 text-xs text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg font-medium cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleInsertLink}
                    disabled={!linkInputUrl.trim()}
                    className="px-3 py-1 bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 text-xs font-semibold rounded-lg hover:opacity-90 disabled:opacity-40 cursor-pointer"
                  >
                    Insert Link
                  </button>
                </div>
              </div>
            </div>
          )}

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
          <div className="flex-1 overflow-y-auto min-h-0 p-3 sm:p-5 md:p-6 lg:p-8 flex flex-col items-center justify-start relative">
            {elevateFeedback && (
              <div className="w-full max-w-[816px] mb-3 px-4 py-2 bg-emerald-950/80 text-emerald-200 border border-emerald-800/80 rounded-xl text-xs font-mono flex items-center justify-between shadow-lg animate-in fade-in slide-in-from-top-1">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <span>{elevateFeedback}</span>
                </div>
                <button type="button" onClick={() => setElevateFeedback(null)} className="text-emerald-400 hover:text-white cursor-pointer">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {!isRawEditing && (
              <div className="w-full max-w-[816px] mb-3 flex items-center justify-between gap-2 px-3 py-1.5 bg-white/90 dark:bg-[#151518]/90 backdrop-blur-md border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xs text-xs font-mono overflow-x-auto select-none">
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-[10px] uppercase font-bold text-zinc-400 flex items-center gap-1 mr-1">
                    <Navigation className="w-3 h-3 text-emerald-500" />
                    <span>Jump to:</span>
                  </span>
                  {['Experience', 'Projects', 'Skills', 'Education', 'Summary'].map(sec => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => handleScrollToSection(sec)}
                      className="px-2 py-0.5 rounded text-[11px] font-sans font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                    >
                      {sec}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                  <button
                    type="button"
                    onClick={handleQuickAddBullet}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-sans font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 transition-colors cursor-pointer flex items-center gap-1"
                    title="Add a new bullet point to the experience section"
                  >
                    <Plus className="w-3 h-3" />
                    <span>+ Bullet</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInsertSectionIntoDoc('EXPERIENCE')}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-sans font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 transition-colors cursor-pointer flex items-center gap-1"
                    title="Add a new work experience entry"
                  >
                    <Plus className="w-3 h-3" />
                    <span>+ Position</span>
                  </button>
                </div>
              </div>
            )}
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

        {/* ── RIGHT HACKY AI ATS ARCHITECTURE INSPECTOR (Collapsible, hidden in Focus Mode) ── */}
        {isInspectorOpen && !isZenMode && (
          <aside
            aria-label="Hacky AI ATS Inspector"
            className="w-full lg:w-[380px] xl:w-[410px] h-80 sm:h-96 lg:h-full shrink-0 border-t lg:border-t-0 lg:border-l border-zinc-200 dark:border-[#27272A] bg-white dark:bg-[#121215] flex flex-col min-h-0 overflow-hidden"
          >
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
              onReplaceBulletText={handleReplaceBulletText}
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
