import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Download, 
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
  FileUp
} from 'lucide-react';
import { ParsedResume } from '../services/resume-parser.js';
import { parseUploadedResumeFile } from '../services/file-parser.js';
import { TailoredBulletDiff, ApplicantProfile } from '../types/index.js';

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
}

interface EditingTarget {
  type: 'bullet' | 'section' | 'name' | 'line';
  pIdx?: number;
  lIdx?: number;
  text: string;
}

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
}) => {
  const [isRawEditing, setIsRawEditing] = useState(false);
  const [editText, setEditText] = useState(rawText);
  const [isCompact, setIsCompact] = useState(false);
  const [copied, setCopied] = useState(false);

  // Direct visual inline editing state
  const [editingTarget, setEditingTarget] = useState<EditingTarget | null>(null);

  // File upload / replace state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isExtractingPdf, setIsExtractingPdf] = useState(false);
  const [isDragOverSheet, setIsDragOverSheet] = useState(false);
  const [uploadFeedback, setUploadFeedback] = useState<string | null>(null);

  // Dynamic candidate name & contact details derived from user's onboarded profile
  const profileName = applicantProfile?.fullName?.trim() || 
    `${applicantProfile?.firstName || ''} ${applicantProfile?.lastName || ''}`.trim();
  const displayName = (parsedResume?.candidateName && parsedResume.candidateName !== 'Your Resume' && parsedResume.candidateName !== 'Alex Chen')
    ? parsedResume.candidateName
    : (profileName || 'Master Tech Resume');

  const profileContactInfo = [
    applicantProfile?.email,
    applicantProfile?.phone,
    applicantProfile?.location,
    applicantProfile?.linkedinUrl ? applicantProfile.linkedinUrl.replace(/^https?:\/\//, '') : undefined,
    applicantProfile?.githubUrl ? applicantProfile.githubUrl.replace(/^https?:\/\//, '') : undefined,
  ].filter(Boolean) as string[];

  const contactList = parsedResume?.contactInfo && parsedResume.contactInfo.length > 0
    ? parsedResume.contactInfo
    : (profileContactInfo.length > 0 ? profileContactInfo : ['candidate@example.com', 'San Francisco, CA']);

  // Sync edit text when raw text changes
  useEffect(() => {
    setEditText(rawText);
  }, [rawText]);

  // Page Budget Estimation (1-Page Letter is ~48-52 lines / ~3,500 characters)
  const lineCount = useMemo(() => {
    return rawText.split('\n').filter(l => l.trim().length > 0).length;
  }, [rawText]);

  const maxRecommendedLines = isCompact ? 54 : 46;
  const pageBudgetPercentage = Math.round((lineCount / maxRecommendedLines) * 100);

  const handleSaveRaw = () => {
    onUpdateResumeText(editText);
    setIsRawEditing(false);
  };

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

  // Direct Inline Bullet Edit Save
  const handleSaveInlineBullet = (pIdx: number, lIdx: number, newContent: string) => {
    const paragraphs = rawText.split('\n\n');
    if (!paragraphs[pIdx]) return;
    const lines = paragraphs[pIdx].split('\n');
    const prefix = lines[lIdx]?.match(/^[•\-*]\s*/)?.[0] || '• ';
    lines[lIdx] = `${prefix}${newContent.trim()}`;
    paragraphs[pIdx] = lines.join('\n');
    const updated = paragraphs.join('\n\n');
    onUpdateResumeText(updated);
    setEditingTarget(null);
  };

  // Direct Delete Bullet
  const handleDeleteBullet = (pIdx: number, lIdx: number) => {
    const paragraphs = rawText.split('\n\n');
    if (!paragraphs[pIdx]) return;
    const lines = paragraphs[pIdx].split('\n');
    lines.splice(lIdx, 1);
    paragraphs[pIdx] = lines.join('\n');
    const updated = paragraphs.join('\n\n');
    onUpdateResumeText(updated);
    if (editingTarget?.pIdx === pIdx && editingTarget?.lIdx === lIdx) {
      setEditingTarget(null);
    }
  };

  // Direct Add Bullet under Section
  const handleAddBulletToSection = (pIdx: number) => {
    const paragraphs = rawText.split('\n\n');
    if (!paragraphs[pIdx]) return;
    const lines = paragraphs[pIdx].split('\n');
    const newBulletText = 'Architected and delivered scalable solutions improving performance by 25%';
    lines.push(`• ${newBulletText}`);
    paragraphs[pIdx] = lines.join('\n');
    const updated = paragraphs.join('\n\n');
    onUpdateResumeText(updated);
    setEditingTarget({
      type: 'bullet',
      pIdx,
      lIdx: lines.length - 1,
      text: newBulletText,
    });
  };

  // Direct Section Title Save
  const handleSaveSectionTitle = (pIdx: number, newTitle: string) => {
    const paragraphs = rawText.split('\n\n');
    if (!paragraphs[pIdx]) return;
    const lines = paragraphs[pIdx].split('\n');
    lines[0] = newTitle.toUpperCase().trim();
    paragraphs[pIdx] = lines.join('\n');
    const updated = paragraphs.join('\n\n');
    onUpdateResumeText(updated);
    setEditingTarget(null);
  };

  // Direct Candidate Name Save
  const handleSaveCandidateName = (newName: string) => {
    const cleanName = newName.trim();
    if (!cleanName) {
      setEditingTarget(null);
      return;
    }
    const paragraphs = rawText.split('\n\n');
    if (paragraphs.length > 0) {
      const lines = paragraphs[0].split('\n');
      lines[0] = cleanName;
      paragraphs[0] = lines.join('\n');
      const updated = paragraphs.join('\n\n');
      onUpdateResumeText(updated);
    }
    setEditingTarget(null);
  };

  // Direct Non-bullet Line Save (e.g. Job Title, Company, Date)
  const handleSaveNonBulletLine = (pIdx: number, lIdx: number, newContent: string) => {
    const paragraphs = rawText.split('\n\n');
    if (!paragraphs[pIdx]) return;
    const lines = paragraphs[pIdx].split('\n');
    lines[lIdx] = newContent.trim();
    paragraphs[pIdx] = lines.join('\n');
    const updated = paragraphs.join('\n\n');
    onUpdateResumeText(updated);
    setEditingTarget(null);
  };

  // Direct Add Section
  const handleAddSection = (sectionName: string) => {
    const defaultBullet = '• Engineered core infrastructure using modern frameworks and cloud tooling';
    const newSectionBlock = `${sectionName.toUpperCase()}\nCompany or Project Name — Role Title\nLocation | 2024 – Present\n${defaultBullet}`;
    const updated = `${rawText.trim()}\n\n${newSectionBlock}`;
    onUpdateResumeText(updated);
  };

  // Handle PDF File Upload / Replacement
  const handleCanvasFileUpload = async (file: File) => {
    setIsExtractingPdf(true);
    setUploadFeedback(`Extracting text from ${file.name}…`);
    try {
      if (onUploadFile) {
        await onUploadFile(file);
      } else {
        const parsed = await parseUploadedResumeFile(file);
        onUpdateResumeText(parsed.text);
      }
      setUploadFeedback(`✓ Loaded ${file.name} directly into canvas`);
    } catch (err: any) {
      console.error('[InAppDocumentCanvas] Upload error:', err);
      setUploadFeedback(`⚠️ Failed to parse PDF: ${err.message || 'Unknown format'}`);
    } finally {
      setIsExtractingPdf(false);
      setTimeout(() => setUploadFeedback(null), 4000);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleCanvasFileUpload(file);
  };

  const handleDropOnSheet = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOverSheet(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleCanvasFileUpload(file);
  };

  const pendingDiffs = diffs.filter(d => d.status === 'pending');

  return (
    <div className="space-y-4">
      {/* Hidden File Input for PDF Upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,.txt"
        onChange={handleFileInputChange}
        className="hidden"
      />

      {/* Top Document Controls Bar */}
      <div className="bg-white dark:bg-[#121215] border border-zinc-200 dark:border-[#27272A] rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-900 dark:text-zinc-100">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs text-zinc-900 dark:text-zinc-100">
                {parsedResume?.candidateName || (isGoogleDocMode ? 'Google Doc Master' : 'Master Tech Resume')}
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 font-semibold flex items-center gap-1">
                {isGoogleDocMode && <Cloud className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />}
                <span>{isGoogleDocMode ? 'Google Doc (Cloud Synced)' : 'In-App Canvas'}</span>
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              {parsedResume?.bullets?.length || lineCount} bullet items • {rawText.length.toLocaleString()} characters
            </p>
          </div>
        </div>

        {/* Action Buttons */}
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
              <span>Open in Docs ↗</span>
            </a>
          )}

          {onSyncGoogleDoc && (
            <button
              type="button"
              onClick={onSyncGoogleDoc}
              className="px-2.5 py-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Re-sync content with Google Docs"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Re-sync</span>
            </button>
          )}

          {onPushToGoogleDoc && (
            <button
              type="button"
              onClick={onPushToGoogleDoc}
              className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              title="Push accepted diffs to Google Doc"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Push Fixes</span>
            </button>
          )}

          {/* Upload / Replace PDF Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isExtractingPdf}
            className="px-2.5 py-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Upload or replace with a new PDF resume"
          >
            {isExtractingPdf ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <UploadCloud className="w-3.5 h-3.5" />
            )}
            <span>{isExtractingPdf ? 'Extracting…' : 'Upload PDF'}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsCompact(!isCompact)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
              isCompact 
                ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-950' 
                : 'bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300'
            }`}
            title="Toggle compact line spacing to fit on 1 page"
          >
            {isCompact ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            <span>{isCompact ? 'Compact Mode' : 'Standard'}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsRawEditing(!isRawEditing)}
            className="px-2.5 py-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Toggle raw plaintext editor"
          >
            {isRawEditing ? <Eye className="w-3.5 h-3.5" /> : <Edit3 className="w-3.5 h-3.5" />}
            <span>{isRawEditing ? 'Visual Canvas' : 'Raw Text'}</span>
          </button>

          <button
            type="button"
            onClick={handleCopyPlainText}
            className="px-2.5 py-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy Text'}</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-950 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Export ATS PDF</span>
          </button>

          {onReopenGateway && (
            <button
              type="button"
              onClick={onReopenGateway}
              className="px-2.5 py-1.5 border border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 rounded-lg text-xs font-medium transition-colors cursor-pointer"
              title="Switch to Google Docs Sync or upload a new file"
            >
              Switch Mode
            </button>
          )}
        </div>
      </div>

      {/* Extraction Feedback Banner */}
      {uploadFeedback && (
        <div className="p-3 bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl flex items-center gap-2.5 text-xs text-zinc-800 dark:text-zinc-200 font-mono animate-in fade-in duration-200">
          <FileUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{uploadFeedback}</span>
        </div>
      )}

      {/* Real-time 1-Page Budget & Overflow Guard */}
      <div className="bg-white dark:bg-[#121215] border border-zinc-200 dark:border-[#27272A] rounded-xl p-3.5 flex items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="flex-1 max-w-xs">
            <div className="flex items-center justify-between text-[11px] mb-1 font-mono">
              <span className="text-zinc-500 dark:text-zinc-400">1-Page Target Budget:</span>
              <span className={`font-bold ${
                pageBudgetPercentage <= 100 
                  ? 'text-emerald-600 dark:text-emerald-400' 
                  : 'text-amber-600 dark:text-amber-400'
              }`}>
                {pageBudgetPercentage}% ({lineCount}/{maxRecommendedLines} lines)
              </span>
            </div>
            <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-300 ${
                  pageBudgetPercentage <= 100 
                    ? 'bg-emerald-500' 
                    : 'bg-amber-500'
                }`}
                style={{ width: `${Math.min(100, pageBudgetPercentage)}%` }}
              />
            </div>
          </div>

          <div className="text-[11px] text-zinc-500 dark:text-zinc-400 hidden sm:block">
            {pageBudgetPercentage <= 100 ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                <Check className="w-3.5 h-3.5" />
                <span>Single-page fit guaranteed</span>
              </span>
            ) : (
              <span className="text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Exceeds 1 page. Delete a bullet or enable Compact Mode</span>
              </span>
            )}
          </div>
        </div>

        {pendingDiffs.length > 0 && onApplyAllDiffs && (
          <button
            type="button"
            onClick={onApplyAllDiffs}
            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Apply All {pendingDiffs.length} STAR Suggestions</span>
          </button>
        )}
      </div>

      {/* Editor or Visual Interactive Canvas */}
      {isRawEditing ? (
        <div className="bg-white dark:bg-[#121215] border border-zinc-200 dark:border-[#27272A] rounded-xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
            <span>Edit plain text resume directly:</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsRawEditing(false)}
                className="px-3 py-1 rounded-md text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveRaw}
                className="px-3.5 py-1 bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 font-bold rounded-md transition-colors shadow-xs cursor-pointer"
              >
                Save & Update Canvas
              </button>
            </div>
          </div>
          <textarea
            rows={24}
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            className="w-full font-mono text-xs p-4 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-400 leading-relaxed"
          />
        </div>
      ) : (
        /* Paginated Visual Document Sheet (US Letter / A4 aspect) */
        <div 
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOverSheet(true);
          }}
          onDragLeave={() => setIsDragOverSheet(false)}
          onDrop={handleDropOnSheet}
          className="resume-canvas-print relative bg-white dark:bg-[#151518] text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 sm:p-12 shadow-sm font-sans space-y-6 transition-all"
        >
          {/* Drag Overlay */}
          {isDragOverSheet && (
            <div className="absolute inset-0 bg-zinc-900/60 dark:bg-black/75 backdrop-blur-xs rounded-2xl flex flex-col items-center justify-center text-white z-30 pointer-events-none border-2 border-dashed border-white/80 p-6 animate-in fade-in duration-150">
              <UploadCloud className="w-12 h-12 mb-3 animate-bounce" />
              <p className="text-base font-bold font-headline">Drop PDF to load resume into canvas</p>
              <p className="text-xs text-zinc-300 font-mono mt-1">Extracts text and bullet points directly</p>
            </div>
          )}

          {/* Document Header with Editable Candidate Name */}
          <div className="text-center pb-4 border-b border-zinc-200 dark:border-zinc-800/80 space-y-2">
            {editingTarget?.type === 'name' ? (
              <div className="flex items-center justify-center gap-2 max-w-md mx-auto">
                <input
                  type="text"
                  autoFocus
                  value={editingTarget.text}
                  onChange={(e) => setEditingTarget({ ...editingTarget, text: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveCandidateName(editingTarget.text);
                    if (e.key === 'Escape') setEditingTarget(null);
                  }}
                  className="px-3 py-1.5 text-center text-xl font-bold rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-zinc-950 dark:text-white focus:outline-none focus:ring-1 focus:ring-zinc-400 flex-1"
                />
                <button
                  type="button"
                  onClick={() => handleSaveCandidateName(editingTarget.text)}
                  className="px-3 py-1.5 bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 rounded-lg text-xs font-bold"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setEditingTarget(null)}
                  className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="group/name inline-flex items-center justify-center gap-2 cursor-pointer">
                <h1 
                  onClick={() => setEditingTarget({ type: 'name', text: displayName })}
                  className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-950 dark:text-white font-headline hover:opacity-80 transition-opacity"
                  title="Click to edit candidate name"
                >
                  {displayName}
                </h1>
                <button
                  type="button"
                  onClick={() => setEditingTarget({ type: 'name', text: displayName })}
                  className="opacity-0 group-hover/name:opacity-100 p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-opacity"
                  title="Edit candidate name"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-zinc-600 dark:text-zinc-400">
              {contactList.map((info, idx) => (
                <span key={idx} className="flex items-center gap-2">
                  {idx > 0 && <span className="text-zinc-300 dark:text-zinc-600">•</span>}
                  <span>{info}</span>
                </span>
              ))}
            </div>
          </div>

          {/* Render Sections with Direct Inline Editing */}
          <div className={`space-y-5 ${isCompact ? 'text-[12px] leading-snug space-y-3.5' : 'text-xs leading-relaxed'}`}>
            {rawText.split('\n\n').map((paragraph, pIdx) => {
              const lines = paragraph.split('\n');
              const firstLine = lines[0]?.trim();
              const isSectionHeader = /^(summary|experience|projects|education|technical skills|skills|leadership|awards)/i.test(firstLine);

              if (isSectionHeader) {
                return (
                  <div key={pIdx} className="space-y-2">
                    {/* Section Header */}
                    {editingTarget?.type === 'section' && editingTarget.pIdx === pIdx ? (
                      <div className="flex items-center gap-2 pb-1 border-b border-zinc-200 dark:border-zinc-800">
                        <input
                          type="text"
                          autoFocus
                          value={editingTarget.text}
                          onChange={(e) => setEditingTarget({ ...editingTarget, text: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveSectionTitle(pIdx, editingTarget.text);
                            if (e.key === 'Escape') setEditingTarget(null);
                          }}
                          className="px-2 py-1 text-xs font-mono font-bold tracking-wider uppercase border border-zinc-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 flex-1"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveSectionTitle(pIdx, editingTarget.text)}
                          className="px-2.5 py-1 bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 rounded text-[11px] font-bold"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingTarget(null)}
                          className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="group/sec flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-1">
                        <h2 className="text-xs font-mono font-bold tracking-wider uppercase text-zinc-900 dark:text-zinc-200">
                          {firstLine}
                        </h2>
                        <button
                          type="button"
                          onClick={() => setEditingTarget({ type: 'section', pIdx, text: firstLine })}
                          className="opacity-0 group-hover/sec:opacity-100 p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-opacity"
                          title="Rename section heading"
                        >
                          <Edit3 className="w-3 h-3" />
                        </button>
                      </div>
                    )}

                    {/* Section Lines & Bullets */}
                    <div className="space-y-1.5 pl-1">
                      {lines.slice(1).map((line, lIdx) => {
                        const actualLineIdx = lIdx + 1;
                        const isBullet = line.trim().startsWith('•') || line.trim().startsWith('-');
                        const cleanLine = line.replace(/^[•\-*]\s*/, '').trim();

                        // Check if there is a pending diff matching this bullet
                        const matchedDiffIdx = diffs.findIndex(
                          (d) => d.originalText.trim().toLowerCase() === cleanLine.toLowerCase()
                        );
                        const matchedDiff = matchedDiffIdx !== -1 ? diffs[matchedDiffIdx] : null;

                        if (matchedDiff && matchedDiff.status === 'pending') {
                          return (
                            <div key={lIdx} className="my-2 p-2.5 rounded-lg bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/30 space-y-1.5">
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                                  <Sparkles className="w-3 h-3" />
                                  <span>STAR Suggestion Available</span>
                                </span>
                                {onApplyBulletDiff && (
                                  <button
                                    type="button"
                                    onClick={() => onApplyBulletDiff(matchedDiffIdx)}
                                    className="px-2.5 py-0.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] cursor-pointer"
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
                                  Why: {matchedDiff.rationale}
                                </div>
                              )}
                            </div>
                          );
                        }

                        // Inline Editor for this Bullet
                        const isEditingThis = editingTarget?.type === 'bullet' && 
                          editingTarget.pIdx === pIdx && 
                          editingTarget.lIdx === actualLineIdx;

                        if (isEditingThis) {
                          return (
                            <div key={lIdx} className="my-1.5 p-2 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 space-y-2">
                              <textarea
                                autoFocus
                                rows={3}
                                value={editingTarget.text}
                                onChange={(e) => setEditingTarget({ ...editingTarget, text: e.target.value })}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                                    handleSaveInlineBullet(pIdx, actualLineIdx, editingTarget.text);
                                  }
                                  if (e.key === 'Escape') setEditingTarget(null);
                                }}
                                className="w-full text-xs font-sans p-2 rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-500 resize-y"
                              />
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="text-zinc-400 font-mono">Press Ctrl+Enter to save</span>
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setEditingTarget(null)}
                                    className="px-2.5 py-1 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleSaveInlineBullet(pIdx, actualLineIdx, editingTarget.text)}
                                    className="px-3 py-1 bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 font-bold rounded shadow-xs"
                                  >
                                    Save Bullet
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        }

                        // Normal Bullet or Line Row with Hover Controls
                        return (
                          <div 
                            key={lIdx} 
                            className={`group/bullet relative flex items-start gap-2 rounded-md px-1.5 py-0.5 -mx-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors ${
                              isBullet ? '' : 'font-semibold text-zinc-900 dark:text-zinc-100'
                            }`}
                          >
                            {isBullet && <span className="text-zinc-400 select-none shrink-0">•</span>}
                            <span 
                              onClick={() => {
                                if (isBullet) {
                                  setEditingTarget({
                                    type: 'bullet',
                                    pIdx,
                                    lIdx: actualLineIdx,
                                    text: cleanLine,
                                  });
                                } else {
                                  setEditingTarget({
                                    type: 'line',
                                    pIdx,
                                    lIdx: actualLineIdx,
                                    text: line,
                                  });
                                }
                              }}
                              className={`flex-1 cursor-text hover:text-zinc-950 dark:hover:text-white transition-colors ${
                                isBullet ? '' : 'text-zinc-900 dark:text-zinc-100'
                              }`}
                              title="Click to edit directly in canvas"
                            >
                              {isBullet ? cleanLine : line}
                            </span>

                            {/* Action Buttons on Hover */}
                            <div className="opacity-0 group-hover/bullet:opacity-100 flex items-center gap-1 shrink-0 ml-2 transition-opacity">
                              <button
                                type="button"
                                onClick={() => setEditingTarget({
                                  type: isBullet ? 'bullet' : 'line',
                                  pIdx,
                                  lIdx: actualLineIdx,
                                  text: isBullet ? cleanLine : line,
                                })}
                                className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
                                title="Edit text"
                              >
                                <Edit3 className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteBullet(pIdx, actualLineIdx)}
                                className="p-1 text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
                                title="Delete item (frees up 1 line on page)"
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
                          onClick={() => handleAddBulletToSection(pIdx)}
                          className="inline-flex items-center gap-1 text-[11px] font-mono text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 px-2 py-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Add Bullet</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              }

              // Paragraph that is not a recognized section header (e.g. intro/title block)
              return (
                <div key={pIdx} className="space-y-1">
                  {lines.map((line, lIdx) => (
                    <div key={lIdx} className="text-zinc-800 dark:text-zinc-200">
                      {line}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          {/* Bottom Actions: Quick Add Sections */}
          <div className="pt-6 border-t border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-500 dark:text-zinc-400">
            <span className="font-mono text-[11px]">Click any bullet, line, or candidate name to edit directly</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-mono text-zinc-400 mr-1">+ Add Section:</span>
              <button
                type="button"
                onClick={() => handleAddSection('EXPERIENCE')}
                className="px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-[10px] font-mono transition-colors cursor-pointer"
              >
                Experience
              </button>
              <button
                type="button"
                onClick={() => handleAddSection('PROJECTS')}
                className="px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-[10px] font-mono transition-colors cursor-pointer"
              >
                Projects
              </button>
              <button
                type="button"
                onClick={() => handleAddSection('SKILLS')}
                className="px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-[10px] font-mono transition-colors cursor-pointer"
              >
                Skills
              </button>
              <button
                type="button"
                onClick={() => handleAddSection('EDUCATION')}
                className="px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-[10px] font-mono transition-colors cursor-pointer"
              >
                Education
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
