import React from 'react';

interface AtsGaugeProps {
  score: number;
  projectedScore?: number;
}

export const AtsGauge: React.FC<AtsGaugeProps> = ({ score, projectedScore }) => {
  const getScoreColor = (val: number) => {
    if (val >= 80) return 'text-emerald-700 dark:text-emerald-400 stroke-emerald-500';
    if (val >= 60) return 'text-amber-700 dark:text-amber-400 stroke-amber-500';
    return 'text-rose-700 dark:text-rose-400 stroke-rose-500';
  };

  const getStatusBadge = (val: number) => {
    if (val >= 80) return { label: 'Strong Match', bg: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700/60' };
    if (val >= 60) return { label: 'Skill Gap', bg: 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700/60' };
    return { label: 'Needs Optimization', bg: 'bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-700/60' };
  };

  const status = getStatusBadge(score);
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="flex items-center gap-4 bg-white dark:bg-slate-900 p-3.5 rounded-stitch border border-slate-200 dark:border-slate-800 shadow-sm transition-colors duration-200">
      <div 
        className="relative w-24 h-24 flex items-center justify-center shrink-0"
        role="meter"
        aria-valuenow={score}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`ATS Match Score: ${score}%`}
      >
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 96 96" aria-hidden="true">
          <circle
            cx="48"
            cy="48"
            r={radius}
            className="stroke-slate-100 dark:stroke-slate-800 fill-none"
            strokeWidth="8"
          />
          <circle
            cx="48"
            cy="48"
            r={radius}
            className={`fill-none transition-all duration-1000 ease-out ${getScoreColor(score).split(' ')[2] || 'stroke-emerald-500'}`}
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute flex flex-col items-center justify-center text-center select-none">
          <span className={`font-mono font-bold text-2xl tracking-tighter ${getScoreColor(score).split(' ').slice(0, 2).join(' ')}`}>
            {score}%
          </span>
          <span className="text-[10px] uppercase font-bold text-slate-700 dark:text-slate-400 tracking-wider">
            ATS Match
          </span>
        </div>
      </div>

      <div className="flex-1 space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${status.bg}`}>
            {status.label}
          </span>
          <div className="flex items-center gap-1">
            <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Post-Tailor:</span>
            <span className="font-mono font-bold text-brand-700 dark:text-brand-300 text-xs bg-brand-50 dark:bg-brand-950/50 px-1.5 py-0.5 rounded border border-transparent dark:border-brand-800/40">
              +{Math.max(0, (projectedScore || score + 18) - score)}%
            </span>
          </div>
        </div>
        <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-snug">
          {score >= 80
            ? 'Strong keyword density and formatting match for ATS filters.'
            : score >= 60
            ? 'Good foundation. Injecting missing critical skills will raise callback rates to 90%+.'
            : 'Several essential technical requirements are currently missing.'}
        </p>
      </div>
    </div>
  );
};
