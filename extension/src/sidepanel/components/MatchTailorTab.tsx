import React, { useState } from 'react';
import { AtsGauge } from './AtsGauge.js';
import { ScrapedJobData, TailorResumeResponse, TailoredBulletDiff } from '../../types/index.js';
import { 
  Sparkles, 
  Check, 
  X, 
  Download, 
  FileEdit, 
  Layers, 
  ExternalLink,
  Zap,
  CheckCircle2,
  Scan,
  Monitor,
  Scissors
} from 'lucide-react';

interface MatchTailorTabProps {
  currentJob: ScrapedJobData;
  tailorData: TailorResumeResponse | null;
  isLoading: boolean;
  onTriggerTailor: () => void;
  onApplyToGoogleDoc: (diffs: TailoredBulletDiff[]) => Promise<void>;
  onForkToDrive: () => Promise<void>;
  onTriggerAutofill: () => void;
  onReadScreenNow: () => void;
  screenResume: { title: string; fullText: string; isGoogleDoc?: boolean } | null;
  screenSelection: string | null;
  appliedStatus: string | null;
  forkedDocUrl: string | null;
  pdfUrl: string | null;
}

export const MatchTailorTab: React.FC<MatchTailorTabProps> = ({
  currentJob,
  tailorData,
  isLoading,
  onTriggerTailor,
  onApplyToGoogleDoc,
  onForkToDrive,
  onTriggerAutofill,
  onReadScreenNow,
  screenResume,
  screenSelection,
  appliedStatus,
  forkedDocUrl,
  pdfUrl
}) => {
  const [diffs, setDiffs] = useState<TailoredBulletDiff[]>(tailorData?.bulletDiffs || []);
  const [activeFilter, setActiveFilter] = useState<'all' | 'missing' | 'matched'>('all');
  const [isApplying, setIsApplying] = useState(false);
  const [isForking, setIsForking] = useState(false);

  React.useEffect(() => {
    if (tailorData?.bulletDiffs) {
      setDiffs(tailorData.bulletDiffs);
    }
  }, [tailorData]);

  const toggleDiffStatus = (id: string, status: 'accepted' | 'rejected') => {
    setDiffs(prev => prev.map(d => {
      if (d.id === id) {
        return { ...d, status: d.status === status ? 'pending' : status };
      }
      return d;
    }));
  };

  const handleApply = async () => {
    setIsApplying(true);
    try {
      await onApplyToGoogleDoc(diffs);
    } finally {
      setIsApplying(false);
    }
  };

  const handleFork = async () => {
    setIsForking(true);
    try {
      await onForkToDrive();
    } finally {
      setIsForking(false);
    }
  };

  return (
    <div className="p-4 space-y-4 pb-24">
      {/* Live Screen Reader Status Card */}
      <div className="bg-gradient-to-r from-brand-900 to-slate-900 text-white p-3.5 rounded-stitch shadow-sm space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Monitor className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-emerald-400 block leading-none">
                {screenResume?.isGoogleDoc ? 'Google Doc Screen Active' : 'Live Screen Reader Active'}
              </span>
              <span className="font-headline font-semibold text-xs text-white truncate max-w-[200px] block mt-0.5">
                {screenResume?.title || 'Detecting Active Resume...'}
              </span>
            </div>
          </div>

          <button
            onClick={onReadScreenNow}
            className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-[10px] font-semibold text-white transition-all flex items-center gap-1 shrink-0"
            title="Re-scan and read current screen text"
          >
            <Scan className="w-3 h-3 text-brand-300" />
            <span>Read Screen</span>
          </button>
        </div>

        {screenResume?.fullText && (
          <div className="text-[11px] text-slate-300 flex items-center justify-between pt-1 border-t border-white/10 font-mono">
            <span>{screenResume.fullText.length.toLocaleString()} chars captured</span>
            <span className="text-emerald-400">● Live Synced</span>
          </div>
        )}
      </div>

      {/* Screen Selection Notice if user highlighted text */}
      {screenSelection && (
        <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-stitch flex items-start justify-between gap-2">
          <div className="text-xs">
            <span className="font-bold text-amber-900 flex items-center gap-1">
              <Scissors className="w-3 h-3 text-amber-600" />
              <span>Highlighted Text on Screen</span>
            </span>
            <p className="text-amber-800 line-clamp-1 italic mt-0.5">
              "{screenSelection}"
            </p>
          </div>
          <button
            onClick={onTriggerTailor}
            className="shrink-0 px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-[10px] font-semibold"
          >
            Tailor This
          </button>
        </div>
      )}

      {/* Active Target Job Card */}
      <div className="bg-white p-3.5 rounded-stitch border border-slate-200 shadow-sm space-y-2">
        <div className="flex items-start justify-between">
          <div>
            <span className="inline-block px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded bg-brand-50 text-brand-700 font-mono">
              {currentJob.source}
            </span>
            <h2 className="font-headline font-bold text-xs text-slate-900 mt-1">
              {currentJob.title}
            </h2>
            <p className="text-xs font-semibold text-slate-600">
              {currentJob.company} {currentJob.location ? `• ${currentJob.location}` : ''}
            </p>
          </div>

          <button
            onClick={onTriggerAutofill}
            className="shrink-0 px-2.5 py-1 text-[11px] font-semibold rounded bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 flex items-center gap-1"
            title="Autofill application form fields on current tab"
          >
            <Zap className="w-3 h-3 text-amber-600" />
            <span>Autofill</span>
          </button>
        </div>
      </div>

      {!tailorData && !isLoading && (
        <button
          onClick={onTriggerTailor}
          className="w-full py-3 px-4 rounded-stitch bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 group"
        >
          <Sparkles className="w-4 h-4 transition-transform group-hover:scale-110" />
          <span>Tailor Screen Resume to this Opening</span>
        </button>
      )}

      {isLoading && (
        <div className="p-6 flex flex-col items-center justify-center space-y-3 text-center bg-white rounded-stitch border border-slate-200 shadow-sm">
          <div className="w-10 h-10 border-3 border-brand-200 border-t-brand-600 rounded-full animate-spin"></div>
          <div>
            <h3 className="font-headline font-bold text-xs text-slate-900">
              Analyzing Screen Resume & Tailoring Bullets...
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Matching ATS keywords and structuring STAR impact.
            </p>
          </div>
        </div>
      )}

      {tailorData && !isLoading && (
        <>
          {/* ATS Gauge */}
          <AtsGauge 
            score={tailorData.atsReport.overallScore} 
            projectedScore={tailorData.projectedNewScore} 
          />

          {/* Keywords Match Breakdown */}
          <div className="bg-white p-3.5 rounded-stitch border border-slate-200 shadow-sm space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-headline font-bold text-xs text-slate-900">
                ATS Keywords & Skills Match
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setActiveFilter('all')}
                  className={`px-1.5 py-0.5 text-[10px] rounded font-semibold ${
                    activeFilter === 'all' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  All ({tailorData.atsReport.keywords.length})
                </button>
                <button
                  onClick={() => setActiveFilter('missing')}
                  className={`px-1.5 py-0.5 text-[10px] rounded font-semibold ${
                    activeFilter === 'missing' ? 'bg-amber-500 text-white' : 'text-amber-700 hover:bg-amber-50'
                  }`}
                >
                  Missing ({tailorData.atsReport.keywords.filter(k => !k.foundInResume).length})
                </button>
                <button
                  onClick={() => setActiveFilter('matched')}
                  className={`px-1.5 py-0.5 text-[10px] rounded font-semibold ${
                    activeFilter === 'matched' ? 'bg-emerald-600 text-white' : 'text-emerald-700 hover:bg-emerald-50'
                  }`}
                >
                  Matched ({tailorData.atsReport.keywords.filter(k => k.foundInResume).length})
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1">
              {tailorData.atsReport.keywords
                .filter(k => activeFilter === 'all' || (activeFilter === 'missing' ? !k.foundInResume : k.foundInResume))
                .map((k, idx) => (
                  <span
                    key={idx}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                      k.foundInResume
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-amber-50 text-amber-800 border border-amber-200'
                    }`}
                  >
                    {k.foundInResume ? (
                      <Check className="w-3 h-3 text-emerald-600" />
                    ) : (
                      <span className="text-amber-600 font-bold">+</span>
                    )}
                    <span>{k.keyword}</span>
                  </span>
                ))}
            </div>
          </div>

          {/* Bullet Diffs */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-headline font-bold text-xs text-slate-900 uppercase tracking-wider">
                Tailored Bullet Diffs ({diffs.filter(d => d.status === 'accepted').length}/{diffs.length} Selected)
              </h3>
              <button
                onClick={() => setDiffs(prev => prev.map(d => ({ ...d, status: 'accepted' })))}
                className="text-[11px] text-brand-600 font-semibold hover:underline"
              >
                Accept All
              </button>
            </div>

            {diffs.map((diff) => (
              <div
                key={diff.id}
                className={`bg-white rounded-stitch border transition-all p-3 space-y-2.5 ${
                  diff.status === 'accepted'
                    ? 'border-brand-500 ring-1 ring-brand-500/20'
                    : diff.status === 'rejected'
                    ? 'border-slate-200 opacity-60'
                    : 'border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase font-bold text-slate-500">
                    {diff.section} • {diff.organization}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => toggleDiffStatus(diff.id, 'accepted')}
                      className={`p-1 rounded text-xs font-semibold flex items-center gap-1 ${
                        diff.status === 'accepted'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span className="text-[10px]">Accept</span>
                    </button>
                    <button
                      onClick={() => toggleDiffStatus(diff.id, 'rejected')}
                      className={`p-1 rounded text-xs font-semibold flex items-center gap-1 ${
                        diff.status === 'rejected'
                          ? 'bg-rose-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-rose-50 hover:text-rose-700'
                      }`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="bg-slate-50 p-2 rounded border border-slate-100 text-slate-500 line-through">
                    {diff.originalText}
                  </div>
                  <div className="bg-brand-50/50 p-2 rounded border border-brand-100 text-slate-900 font-medium">
                    {diff.tailoredText}
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] pt-1 text-slate-500">
                  <span className="text-brand-700 font-medium truncate max-w-[200px]">
                    💡 {diff.rationale}
                  </span>
                  <span className="font-mono text-[10px] text-slate-400">
                    {diff.charCountDiff >= 0 ? `+${diff.charCountDiff}` : diff.charCountDiff} chars
                  </span>
                </div>
              </div>
            ))}
          </div>

          {appliedStatus && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-stitch text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{appliedStatus}</span>
            </div>
          )}

          {forkedDocUrl && (
            <div className="p-3 bg-brand-50 border border-brand-200 rounded-stitch text-xs text-brand-900 flex items-center justify-between">
              <span className="truncate">📂 Tailored copy created in Drive!</span>
              <a
                href={forkedDocUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-bold text-brand-700 hover:underline shrink-0"
              >
                <span>Open Doc</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}

          {/* Sticky Bottom Action Bar */}
          <div className="fixed bottom-0 left-0 right-0 p-3 bg-white border-t border-slate-200 shadow-lg space-y-2 z-40">
            <div className="flex gap-2">
              <button
                onClick={handleApply}
                disabled={isApplying}
                className="flex-1 py-2.5 px-3 rounded-stitch bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold text-xs shadow flex items-center justify-center gap-1.5"
              >
                <FileEdit className="w-3.5 h-3.5" />
                <span>{isApplying ? 'Applying...' : 'Apply to Google Doc'}</span>
              </button>

              <button
                onClick={handleFork}
                disabled={isForking}
                className="py-2.5 px-3 rounded-stitch bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white font-semibold text-xs shadow flex items-center justify-center gap-1.5"
                title="Fork a new copy into your Google Drive"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>{isForking ? 'Forking...' : 'Fork in Drive'}</span>
              </button>

              {pdfUrl && (
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="py-2.5 px-3 rounded-stitch bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow flex items-center justify-center gap-1.5"
                  title="Download tailored PDF"
                >
                  <Download className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
