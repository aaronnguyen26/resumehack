import React, { useState } from 'react';
import { Settings, ShieldCheck, Check, Key, User, FileText, Cloud } from 'lucide-react';

export const SettingsTab: React.FC = () => {
  const [masterDocId, setMasterDocId] = useState('1A2b3C4d5E6F7g8H9i0J_AlexChen_Master');
  const [candidateName, setCandidateName] = useState('Alex Chen');
  const [targetTitle, setTargetTitle] = useState('Software Engineer');
  const [strictAntiHallucination, setStrictAntiHallucination] = useState(true);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="p-4 space-y-4 pb-16">
      <div>
        <h2 className="font-headline font-bold text-sm text-slate-900">
          Settings & Master Resume
        </h2>
        <p className="text-[11px] text-slate-500">
          Configure your Google Docs integration and AI tailoring preferences.
        </p>
      </div>

      {/* Google Account Connection Card */}
      <div className="bg-white p-3.5 rounded-stitch border border-slate-200 shadow-sm space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded bg-brand-50 flex items-center justify-center text-brand-600">
              <Cloud className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-headline font-bold text-xs text-slate-900">
                Google Workspace OAuth
              </h3>
              <p className="text-[10px] text-slate-500">
                Docs & Drive API Access
              </p>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-mono font-bold">
            Connected
          </span>
        </div>
        <p className="text-[11px] text-slate-600">
          Enables automatic live batch editing and 1-click tailored PDF exports directly from Google Drive.
        </p>
      </div>

      {/* Master Profile Form */}
      <div className="bg-white p-3.5 rounded-stitch border border-slate-200 shadow-sm space-y-3">
        <h3 className="font-headline font-bold text-xs text-slate-900">
          Master Resume Configuration
        </h3>

        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-slate-700">Candidate Full Name</label>
          <input
            type="text"
            value={candidateName}
            onChange={(e) => setCandidateName(e.target.value)}
            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs text-slate-900 focus:outline-none focus:border-brand-500"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-slate-700">Target Role Focus</label>
          <input
            type="text"
            value={targetTitle}
            onChange={(e) => setTargetTitle(e.target.value)}
            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs text-slate-900 focus:outline-none focus:border-brand-500"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-slate-700">Default Master Google Doc ID</label>
          <input
            type="text"
            value={masterDocId}
            onChange={(e) => setMasterDocId(e.target.value)}
            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded font-mono text-[11px] text-slate-900 focus:outline-none focus:border-brand-500"
          />
        </div>

        {/* Anti-hallucination toggle */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
          <div className="space-y-0.5 pr-2">
            <span className="text-xs font-semibold text-slate-800 block">Strict Factual Guardrails</span>
            <span className="text-[10px] text-slate-500 block">Never fabricate past experiences or metrics.</span>
          </div>
          <input
            type="checkbox"
            checked={strictAntiHallucination}
            onChange={(e) => setStrictAntiHallucination(e.target.checked)}
            className="w-4 h-4 accent-brand-600 rounded cursor-pointer"
          />
        </div>

        <button
          onClick={handleSave}
          className="w-full py-2 px-3 rounded-stitch bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition-all flex items-center justify-center gap-1.5"
        >
          {saved ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : null}
          <span>{saved ? 'Preferences Saved!' : 'Save Preferences'}</span>
        </button>
      </div>
    </div>
  );
};
