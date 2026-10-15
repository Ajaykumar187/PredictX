import React, { useState } from 'react';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { AnalysisResult } from '../types';
import { BandLevel, forecastBand } from '../utils/accuracy';
import { PageId } from './Sidebar';

interface Props {
  data: AnalysisResult;
  onNavigate: (page: PageId) => void;
}

const signalStyle: Record<string, string> = {
  BUY: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  SELL: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  HOLD: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
};

export const PredictionTrustCard: React.FC<Props> = ({ data, onNavigate }) => {
  const [level, setLevel] = useState<BandLevel>(80);
  const band = forecastBand(data, 30, level);
  const rows = [7, 14, 30].map((d) => band[d - 1]).filter(Boolean);
  const pct = (v: number) => ((v - data.latestPrice) / data.latestPrice) * 100;
  const fmtPct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;

  return (
    <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-blue-600" />
          Forecast range & signal ki wajah
        </h3>
        <div className="flex gap-1">
          {([68, 80, 95] as BandLevel[]).map((l) => (
            <button
              key={l}
              onClick={() => setLevel(l)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold border ${
                level === l
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
              }`}
            >
              {l}%
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-slate-400 text-left">
              <th className="py-1.5 font-bold">Kitne din baad</th>
              <th className="py-1.5 font-bold">Model target</th>
              <th className="py-1.5 font-bold">{level}% range</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {rows.map((r) => (
              <tr key={r.day} className="text-slate-800 dark:text-slate-100">
                <td className="py-2 font-semibold">{r.day} din</td>
                <td className="py-2">
                  {data.currencyFmt(r.mid)} <span className="text-xs text-slate-500">({fmtPct(pct(r.mid))})</span>
                </td>
                <td className="py-2">
                  {data.currencyFmt(r.low)} – {data.currencyFmt(r.high)}
                  <span className="text-xs text-slate-500"> ({fmtPct(pct(r.low))} se {fmtPct(pct(r.high))})</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-slate-500 dark:text-slate-400 -mt-2">
        Range stock ki pichhli 60 din ki volatility se nikalti hai. Isse "kitna upar-neeche ja sakta hai" ka andaza milta hai, guarantee nahi.
      </p>

      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className={`px-2 py-0.5 rounded-md text-xs font-black ${signalStyle[data.signal]}`}>{data.signal}</span>
          <span className="text-xs text-slate-500 dark:text-slate-400">score {data.score > 0 ? '+' : ''}{data.score}/100 — yeh signal kyun aaya:</span>
        </div>
        <ul className="space-y-1.5 text-sm text-slate-700 dark:text-slate-300 list-disc pl-5">
          {data.reasons.slice(0, 5).map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      </div>

      <button
        onClick={() => onNavigate('trackrecord')}
        className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
      >
        Is model ne pehle kitna sahi bataya? <ArrowRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

export default PredictionTrustCard;
