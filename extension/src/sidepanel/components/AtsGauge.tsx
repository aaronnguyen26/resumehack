import React from 'react';

interface AtsGaugeProps {
  score: number;
  projectedScore?: number;
}

export const AtsGauge: React.FC<AtsGaugeProps> = ({ score, projectedScore }) => {
  const getScoreColor = (val: number) => {
    if (val >= 80) return 'text-emerald-600 stroke-emerald-500';
    if (val >= 60) return 'text-amber-500 stroke-amber-500';
    return 'text-rose-500 stroke-rose-500';
  };

  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="flex items-center gap-4 bg-white p-3.5 rounded-stitch border border-slate-200 shadow-sm">
      <div className="relative w-24 h-24 flex items-center justify-center shrink-0">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 96 96">
          <circle
            cx="48"
            cy="48"
            r={radius}
            className="stroke-slate-100 fill-none"
            strokeWidth="8"
          />
          <circle
            cx="48"
            cy="48"
            r={radius}
            className={`fill-none transition-all duration-1000 ease-out ${getScoreColor(score).split(' ')[1]}`}
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute flex flex-col items-center justify-center text-center">
          <span className={`font-mono font-bold text-2xl tracking-tighter ${getScoreColor(score).split(' ')[0]}`}>
            {score}%
          </span>
          <span className="text-[10px] uppercase font-bold text-slate-600 tracking-wider">
            ATS Match
          </span>
        </div>
      </div>

      <div className="flex-1 space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-700">Projected with AI Edits:</span>
          <span className="font-mono font-bold text-brand-600 text-sm">
            {projectedScore || Math.min(100, score + 18)}%
          </span>
        </div>
        <p className="text-[11px] text-slate-500 leading-snug">
          {score >= 80
            ? 'Strong keyword density and formatting match for ATS filters.'
            : score >= 60
            ? 'Good foundation. Injecting missing critical skills will raise interview callback rate.'
            : 'Several essential technical requirements are currently missing.'}
        </p>
      </div>
    </div>
  );
};
