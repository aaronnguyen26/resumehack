import React, { useState } from 'react';
import { 
  X, 
  Cloud, 
  FileText, 
  Check, 
  Trash2, 
  Plus, 
  Clock, 
  Award, 
  ExternalLink, 
  Loader2,
  AlertTriangle,
  BookmarkCheck
} from 'lucide-react';
import { CloudResume, deleteResume, setDefaultResume, saveResume } from '../services/supabase-db.js';

interface CloudResumeManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  resumes: CloudResume[];
  activeResumeId?: string;
  onSelectResume: (resume: CloudResume) => void;
  onRefreshResumes: () => Promise<void>;
  currentCanvasText?: string;
  currentDocTitle?: string;
  currentRole?: string;
  currentScore?: number;
}

export const CloudResumeManagerModal: React.FC<CloudResumeManagerModalProps> = ({
  isOpen,
  onClose,
  userId,
  resumes,
  activeResumeId,
  onSelectResume,
  onRefreshResumes,
  currentCanvasText,
  currentDocTitle,
  currentRole,
  currentScore,
}) => {
  const [isSavingNew, setIsSavingNew] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [isSettingDefaultId, setIsSettingDefaultId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSaveCurrentAsNew = async () => {
    if (!currentCanvasText) return;
    setActionError(null);
    setIsSavingNew(true);
    try {
      const titleToSave = newTitle.trim() || `${currentDocTitle || 'Resume'} (Version ${resumes.length + 1})`;
      const { error } = await saveResume(userId, {
        title: titleToSave,
        raw_text: currentCanvasText,
        target_role: currentRole || 'Senior Software Engineer',
        ats_score: currentScore || 0,
      });

      if (error) throw new Error(error);
      setNewTitle('');
      await onRefreshResumes();
    } catch (err: any) {
      setActionError(err.message || 'Failed to save new resume copy');
    } finally {
      setIsSavingNew(false);
    }
  };

  const handleDeleteResume = async (resumeId: string) => {
    if (!confirm('Are you sure you want to permanently delete this resume from the cloud?')) return;
    setActionError(null);
    setIsDeletingId(resumeId);
    try {
      const { error } = await deleteResume(resumeId);
      if (error) throw new Error(error);
      await onRefreshResumes();
    } catch (err: any) {
      setActionError(err.message || 'Failed to delete resume');
    } finally {
      setIsDeletingId(null);
    }
  };

  const handleSetDefault = async (resumeId: string) => {
    setActionError(null);
    setIsSettingDefaultId(resumeId);
    try {
      const { error } = await setDefaultResume(userId, resumeId);
      if (error) throw new Error(error);
      await onRefreshResumes();
    } catch (err: any) {
      setActionError(err.message || 'Failed to set default resume');
    } finally {
      setIsSettingDefaultId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-xl bg-white dark:bg-[#121215] border border-zinc-200 dark:border-[#27272A] rounded-2xl shadow-xl overflow-hidden text-zinc-900 dark:text-zinc-100 animate-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 pb-4 border-b border-zinc-100 dark:border-[#1E1E22] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 flex items-center justify-center shadow-xs">
              <Cloud className="w-4 h-4 text-emerald-500" />
            </div>
            <div>
              <h3 className="font-bold text-sm font-headline tracking-tight text-zinc-950 dark:text-zinc-50">
                Cloud Resume Manager
              </h3>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                {resumes.length} {resumes.length === 1 ? 'Resume' : 'Resumes'} Saved in Supabase
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action Error */}
        {actionError && (
          <div className="m-4 mb-0 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{actionError}</span>
          </div>
        )}

        {/* Resumes List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {resumes.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-zinc-50 dark:bg-[#18181B] border border-dashed border-zinc-300 dark:border-zinc-700 space-y-2">
              <FileText className="w-8 h-8 mx-auto text-zinc-400" />
              <div className="text-xs font-bold text-zinc-800 dark:text-zinc-200">No Resumes in Cloud Yet</div>
              <p className="text-[11px] text-zinc-500 max-w-sm mx-auto">
                Save your current document canvas to Supabase below to access it from anywhere.
              </p>
            </div>
          ) : (
            resumes.map((res) => {
              const isActive = activeResumeId === res.id;
              const formattedDate = new Date(res.updated_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div 
                  key={res.id}
                  className={`p-3.5 rounded-xl border transition-all text-xs space-y-2.5 ${
                    isActive
                      ? 'bg-zinc-100/80 dark:bg-zinc-800/60 border-zinc-900 dark:border-white shadow-xs'
                      : 'bg-zinc-50 dark:bg-[#18181B] border-zinc-200 dark:border-[#27272A] hover:border-zinc-300 dark:hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-zinc-950 dark:text-zinc-50 text-xs">
                          {res.title}
                        </span>
                        {isActive && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 font-bold">
                            Active in Canvas
                          </span>
                        )}
                        {res.is_default && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-600">
                            Default
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono flex items-center gap-2">
                        <span>Role: {res.target_role || 'Software Engineer'}</span>
                        <span>&bull;</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" /> {formattedDate}
                        </span>
                      </div>
                    </div>

                    {res.ats_score !== undefined && res.ats_score > 0 && (
                      <div className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 font-mono text-[10px] font-bold flex items-center gap-1">
                        <Award className="w-3 h-3 text-emerald-500" />
                        <span>{res.ats_score}/100</span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-1 border-t border-zinc-200/60 dark:border-zinc-800/60 text-[11px] font-mono">
                    <div className="flex items-center gap-2">
                      {!isActive && (
                        <button
                          type="button"
                          onClick={() => {
                            onSelectResume(res);
                            onClose();
                          }}
                          className="px-2.5 py-1 rounded-md bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-950 font-bold cursor-pointer transition-colors shadow-2xs"
                        >
                          Open in Canvas
                        </button>
                      )}
                      {!res.is_default && (
                        <button
                          type="button"
                          disabled={isSettingDefaultId === res.id}
                          onClick={() => handleSetDefault(res.id)}
                          className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 underline cursor-pointer disabled:opacity-50"
                        >
                          {isSettingDefaultId === res.id ? 'Setting…' : 'Set as Default'}
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      disabled={isDeletingId === res.id}
                      onClick={() => handleDeleteResume(res.id)}
                      className="p-1 text-zinc-400 hover:text-rose-500 cursor-pointer transition-colors"
                      title="Delete resume from cloud"
                    >
                      {isDeletingId === res.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Save Current Document Section */}
        {currentCanvasText && (
          <div className="p-4 bg-zinc-50 dark:bg-[#151518] border-t border-zinc-200 dark:border-[#27272A] space-y-2">
            <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5 text-emerald-500" />
              <span>Save Current Canvas as New Cloud Version</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="e.g. Senior Backend Engineer - Stripe Tailored"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-[#121215] border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:border-zinc-900 dark:focus:border-white transition-colors"
              />
              <button
                type="button"
                disabled={isSavingNew}
                onClick={handleSaveCurrentAsNew}
                className="px-3.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-950 font-bold rounded-lg text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs disabled:opacity-50 shrink-0"
              >
                {isSavingNew ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Cloud className="w-3.5 h-3.5" />}
                <span>Save to Cloud</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
