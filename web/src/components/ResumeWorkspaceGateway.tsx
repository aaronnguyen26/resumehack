import React, { useState, useRef } from 'react';
import { 
  FileText, 
  Cloud, 
  UploadCloud, 
  Sparkles, 
  CheckCircle2, 
  ArrowRight, 
  Layers, 
  Monitor, 
  ExternalLink,
  Zap,
  FileCode,
  ShieldCheck,
  RotateCcw
} from 'lucide-react';
import { WorkspaceMode } from '../services/storage.js';
import { parseUploadedResumeFile, buildStarterResumeText } from '../services/file-parser.js';
import { ApplicantProfile } from '../types/index.js';

export interface ResumeWorkspaceGatewayProps {
  onSelectOption1GoogleDocs: (docId?: string, docTitle?: string) => void;
  onSelectOption2InAppCanvas: (resumeText: string, title?: string) => void;
  onOpenGooglePicker?: () => void;
  applicantProfile?: ApplicantProfile;
  currentMode?: WorkspaceMode | null;
  onDismiss?: () => void;
  isCompact?: boolean;
}

export const ResumeWorkspaceGateway: React.FC<ResumeWorkspaceGatewayProps> = ({
  onSelectOption1GoogleDocs,
  onSelectOption2InAppCanvas,
  onOpenGooglePicker,
  applicantProfile,
  currentMode,
  onDismiss,
  isCompact = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [docUrlInput, setDocUrlInput] = useState('');
  const [isParsingFile, setIsParsingFile] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsingFile(true);
    setErrorMessage(null);

    try {
      const parsed = await parseUploadedResumeFile(file);
      onSelectOption2InAppCanvas(parsed.text, parsed.fileName.replace(/\.[^/.]+$/, ''));
    } catch (err: any) {
      setErrorMessage(`Failed to read file: ${err.message || 'Unknown error'}`);
    } finally {
      setIsParsingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    setIsParsingFile(true);
    setErrorMessage(null);

    try {
      const parsed = await parseUploadedResumeFile(file);
      onSelectOption2InAppCanvas(parsed.text, parsed.fileName.replace(/\.[^/.]+$/, ''));
    } catch (err: any) {
      setErrorMessage(`Failed to read file: ${err.message || 'Unknown error'}`);
    } finally {
      setIsParsingFile(false);
    }
  };

  const handlePasteDocSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!docUrlInput.trim()) return;

    // Extract Google Doc ID from URL or raw ID
    const match = docUrlInput.match(/\/document\/d\/([a-zA-Z0-9-_]+)/);
    const docId = match ? match[1] : docUrlInput.trim();
    onSelectOption1GoogleDocs(docId, 'Linked Google Doc');
  };

  const handleUseStarterTemplate = () => {
    const starterText = buildStarterResumeText(applicantProfile);
    const title = applicantProfile?.firstName ? `${applicantProfile.firstName}'s Master Resume` : 'Master Tech Resume';
    onSelectOption2InAppCanvas(starterText, title);
  };

  const handleUseGoogleDemo = () => {
    const candidateName = (applicantProfile?.firstName || applicantProfile?.lastName)
      ? `${applicantProfile.firstName} ${applicantProfile.lastName || ''}`.trim()
      : (applicantProfile?.fullName || 'Master');
    onSelectOption1GoogleDocs('mock-master-resume-doc-id', `${candidateName} — Master Resume (Google Doc)`);
  };

  return (
    <div className="w-full space-y-6">
      {/* Gateway Header Banner */}
      <div className="bg-gradient-to-b from-zinc-100 to-white dark:from-zinc-900 dark:to-[#121215] border border-zinc-200 dark:border-[#27272A] rounded-2xl p-6 sm:p-8 shadow-xs text-center relative overflow-hidden">
        <div className="max-w-2xl mx-auto space-y-3 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-200/70 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-mono font-semibold">
            <Zap className="w-3.5 h-3.5 text-emerald-500" />
            <span>Choose Your Resume Integration Workspace</span>
          </div>

          <h2 className="text-xl sm:text-2xl font-bold font-headline tracking-tight text-zinc-900 dark:text-zinc-50">
            How would you like to manage and tailor your resume?
          </h2>

          <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed font-sans">
            ResumeHack offers two dedicated architectures. Choose the workflow that matches your preference—you can switch between them at any time.
          </p>

          {currentMode && onDismiss && (
            <div className="pt-2">
              <button
                type="button"
                onClick={onDismiss}
                className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 font-medium underline underline-offset-4 cursor-pointer"
              >
                Return to current workspace ({currentMode === 'google_docs' ? 'Google Docs Sync' : 'In-App Canvas'})
              </button>
            </div>
          )}
        </div>
      </div>

      {errorMessage && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-600 dark:text-rose-400 font-medium">
          {errorMessage}
        </div>
      )}

      {/* The Two Architecture Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
        {/* OPTION 1: Google Docs Cloud Sync */}
        <div className={`flex flex-col justify-between bg-white dark:bg-[#121215] border rounded-2xl p-6 sm:p-7 shadow-xs transition-all hover:border-zinc-400 dark:hover:border-zinc-700 ${
          currentMode === 'google_docs' 
            ? 'border-emerald-500 ring-1 ring-emerald-500/30 shadow-emerald-500/5' 
            : 'border-zinc-200 dark:border-[#27272A]'
        }`}>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-900 dark:text-zinc-100">
                <Cloud className="w-5 h-5" />
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 text-[10px] font-mono font-bold uppercase tracking-wider">
                  Option 1
                </span>
                {currentMode === 'google_docs' && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-[10px] font-mono font-semibold">
                    Active Mode
                  </span>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <span>Google Docs Cloud Sync</span>
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                Connect your Google Drive account. Keep your original formatting, fonts, and headers while pushing tailored STAR bullet suggestions straight to your live Google Doc via official Google APIs.
              </p>
            </div>

            {/* Feature Highlights */}
            <div className="space-y-2 pt-2 border-t border-zinc-100 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-400">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Two-way atomic sync:</strong> Accepted bullet diffs write directly to your Google Doc via <code className="font-mono text-[11px] text-zinc-700 dark:text-zinc-300">batchUpdate</code>.</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Preserves styling:</strong> Maintains fonts, margins, colors, and layouts without re-formatting.</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Instant Drive PDF:</strong> Export verified PDFs directly through Google Drive.</span>
              </div>
            </div>

            {/* Paste Doc URL Input */}
            <form onSubmit={handlePasteDocSubmit} className="pt-2">
              <label htmlFor="gdoc-url-input" className="block text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">
                Paste Google Doc Link or Document ID:
              </label>
              <div className="flex gap-2">
                <input
                  id="gdoc-url-input"
                  type="text"
                  placeholder="https://docs.google.com/document/d/..."
                  value={docUrlInput}
                  onChange={(e) => setDocUrlInput(e.target.value)}
                  className="flex-1 px-3 py-1.5 rounded-lg text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500"
                />
                <button
                  type="submit"
                  disabled={!docUrlInput.trim()}
                  className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 text-white dark:bg-white dark:hover:bg-zinc-200 dark:text-zinc-950 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                >
                  Link
                </button>
              </div>
            </form>
          </div>

          {/* Option 1 Action Footer */}
          <div className="pt-6 border-t border-zinc-100 dark:border-zinc-800 mt-6 space-y-2.5">
            <button
              type="button"
              onClick={() => {
                if (onOpenGooglePicker) {
                  onOpenGooglePicker();
                } else {
                  handleUseGoogleDemo();
                }
              }}
              className="w-full py-2.5 px-4 bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-950 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
            >
              <Cloud className="w-4 h-4" />
              <span>Select from Google Drive (Picker)</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={handleUseGoogleDemo}
              className="w-full py-2 px-3 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>Try with Verified Demo Google Doc</span>
            </button>
          </div>
        </div>

        {/* OPTION 2: In-App Document Canvas & Multi-Format Ingestion */}
        <div className={`flex flex-col justify-between bg-white dark:bg-[#121215] border rounded-2xl p-6 sm:p-7 shadow-xs transition-all hover:border-zinc-400 dark:hover:border-zinc-700 ${
          currentMode === 'in_app_canvas' 
            ? 'border-emerald-500 ring-1 ring-emerald-500/30 shadow-emerald-500/5' 
            : 'border-zinc-200 dark:border-[#27272A]'
        }`}>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-900 dark:text-zinc-100">
                <FileText className="w-5 h-5" />
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 text-[10px] font-mono font-bold uppercase tracking-wider">
                  Option 2
                </span>
                {currentMode === 'in_app_canvas' && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-[10px] font-mono font-semibold">
                    Active Mode
                  </span>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <span>In-App Document Canvas</span>
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                Work directly inside ResumeHack. Upload any PDF, Word (.docx), or text resume, or use our high-impact tech template. Features a real-time 1-page overflow guard and instant PDF export.
              </p>
            </div>

            {/* Feature Highlights */}
            <div className="space-y-2 pt-2 border-t border-zinc-100 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-400">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Universal file drop:</strong> Drag & drop PDF, Word (.docx), Markdown, or plain text.</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>1-Page budget guard:</strong> Live line-count meter prevents your resume from spilling onto page 2.</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Complete autonomy:</strong> Zero cloud account required; instant in-browser PDF download.</span>
              </div>
            </div>

            {/* File Drag-and-Drop Zone */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="mt-2 border-2 border-dashed border-zinc-300 dark:border-zinc-700 hover:border-zinc-500 dark:hover:border-zinc-500 rounded-xl p-4 text-center cursor-pointer transition-colors bg-zinc-50/50 dark:bg-zinc-900/30"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.doc,.txt,.md"
                onChange={handleFileUpload}
                className="hidden"
              />
              <UploadCloud className="w-6 h-6 mx-auto text-zinc-400 mb-1.5" />
              <div className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                {isParsingFile ? 'Extracting Resume Text…' : 'Drop your resume file here or click to browse'}
              </div>
              <div className="text-[10px] text-zinc-400 mt-0.5">
                Supports PDF, DOCX, TXT, Markdown
              </div>
            </div>
          </div>

          {/* Option 2 Action Footer */}
          <div className="pt-6 border-t border-zinc-100 dark:border-zinc-800 mt-6 space-y-2.5">
            <button
              type="button"
              onClick={handleUseStarterTemplate}
              className="w-full py-2.5 px-4 bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-950 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
            >
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span>Use High-Impact Tech Template</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-2 px-3 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>Upload Custom File from Computer</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
