import React, { useEffect, useMemo, useState } from 'react';
import { Newspaper, Gauge, Loader2 } from 'lucide-react';
import { AnalysisResult } from '../types';
import { NewsItem, fetchStockNews } from '../utils/stockApi';
import { headlineScore, moodOf, Mood } from '../utils/sentiment';

interface NewsPageProps {
  data: AnalysisResult;
}

const card = 'bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm';
const moodCls: Record<Mood, string> = {
  positive: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
  negative: 'bg-rose-500/20 text-rose-600 dark:text-rose-400',
  neutral: 'bg-slate-500/20 text-slate-500',
};
const moodHi: Record<Mood, string> = { positive: 'positive', negative: 'negative', neutral: 'neutral' };

const ago = (t: number | null) => {
  if (!t) return '';
  const h = Math.max(0, Math.round((Date.now() - t) / 3600000));
  return h < 1 ? 'abhi' : h < 24 ? `${h} ghante pehle` : `${Math.round(h / 24)} din pehle`;
};

export const NewsPage: React.FC<NewsPageProps> = ({ data }) => {
  const [state, setState] = useState<{ loading: boolean; items: NewsItem[]; error?: string }>({ loading: true, items: [] });

  useEffect(() => {
    let alive = true;
    setState({ loading: true, items: [] });
    fetchStockNews(data.displaySymbol, data.market).then((r) => {
      if (alive) setState({ loading: false, items: r.items || [], error: r.success ? undefined : r.error });
    });
    return () => { alive = false; };
  }, [data.displaySymbol, data.market]);

  const scored = useMemo(
    () => state.items.map((n) => ({ ...n, score: headlineScore(n.title) })).map((n) => ({ ...n, mood: moodOf(n.score) })),
    [state.items]
  );
  const count = (m: Mood) => scored.filter((n) => n.mood === m).length;
  const avg = scored.length ? scored.reduce((a, n) => a + n.score, 0) / scored.length : 0;
  const overall = moodOf(avg);

  const rsi = data.df[data.df.length - 1]?.rsi14 || 50;
  const meter = Math.max(5, Math.min(95, Math.round(rsi)));
  const meterLabel = rsi >= 70 ? 'Overbought (garmi)' : rsi >= 55 ? 'Strong' : rsi <= 30 ? 'Oversold (dar)' : rsi <= 45 ? 'Weak' : 'Neutral';

  const diverge =
    scored.length >= 3 &&
    ((overall === 'positive' && data.changePct < -1) || (overall === 'negative' && data.changePct > 1));

  return (
    <div className="space-y-6">
      <div className={`${card} space-y-2`}>
        <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Newspaper className="w-5 h-5 text-blue-500" /> {data.displaySymbol} — news aur mood
        </h3>
        {state.loading && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
        {!state.loading && scored.length === 0 && (
          <p className="text-sm text-slate-500">Is stock ki news abhi nahi mili{state.error ? ` (${state.error})` : ''}.</p>
        )}
        {scored.length > 0 && (
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Pichhli {scored.length} headlines mein {count('positive')} positive, {count('neutral')} neutral, {count('negative')} negative. Overall mood:{' '}
            <strong>{moodHi[overall]}</strong> ({avg >= 0 ? '+' : ''}{avg.toFixed(2)}). Aaj price {data.changePct >= 0 ? '+' : ''}{data.changePct.toFixed(2)}% hai.
            {diverge && ' Mood aur price ulte chal rahe hain — jaldbazi mein kuch na karein.'}
          </p>
        )}
        <p className="text-[11px] text-slate-400">Mood sirf headline ke shabdon (jaise "surge", "fall") ginkar nikala gaya hai, context nahi samajhta. Ek rough ishara hai, signal nahi.</p>
      </div>

      <div className={`${card} space-y-3`}>
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            <Gauge className="w-4 h-4 text-amber-500" /> Momentum meter (RSI-based)
          </h4>
          <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{meterLabel} — RSI {rsi.toFixed(0)}</span>
        </div>
        <div className="w-full h-3 bg-gradient-to-r from-rose-500 via-amber-400 to-emerald-500 rounded-full relative">
          <div className="w-4 h-4 bg-white border-2 border-slate-900 rounded-full absolute -top-0.5 -translate-x-1/2 shadow" style={{ left: `${meter}%` }} />
        </div>
        <p className="text-[11px] text-slate-400">Yeh market ka "Fear & Greed index" nahi hai; sirf is stock ke RSI se bana meter hai.</p>
      </div>

      {scored.length > 0 && (
        <div className={`${card} space-y-3`}>
          <h4 className="text-sm font-bold text-slate-900 dark:text-white">Recent headlines</h4>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {scored.map((n, i) => (
              <div key={i} className="py-3 flex items-start justify-between gap-3 text-xs">
                <div className="space-y-1 min-w-0">
                  <a href={n.link} target="_blank" rel="noopener noreferrer" className="font-semibold text-slate-900 dark:text-white hover:text-blue-600 transition-colors">
                    {n.title}
                  </a>
                  <div className="text-[11px] text-slate-400">{n.publisher}{n.time ? ` • ${ago(n.time)}` : ''}</div>
                </div>
                <span className={`flex-shrink-0 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${moodCls[n.mood]}`}>{n.mood}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default NewsPage;
