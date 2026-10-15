import React, { useState, useEffect, useCallback } from 'react';
import { MarketType } from '../types';
import { RefreshCw, AlertTriangle } from 'lucide-react';

interface ScannersPageProps {
  onSelectStock: (symbol: string, market: MarketType) => void;
}

interface BaseRow { symbol: string; market: MarketType; price: number }
interface ScanResponse {
  success: boolean;
  status: 'idle' | 'running' | 'done';
  done: number;
  total: number;
  failed: string[];
  asOf: string | null;
  breakout: Array<BaseRow & { prevHigh: number; volumeSpike: number | null; status: string }>;
  gaps: Array<BaseRow & { open: number; prevClose: number; gapPct: number; type: string }>;
  momentum: Array<BaseRow & { roc: Record<string, number>; rsi: number | null }>;
  swing: Array<BaseRow & { sma50: number; sma200: number; event: string }>;
}

const cur = (m: MarketType) => (m === 'US' ? '$' : '₹');
const th = 'py-2.5 px-3';

export const ScannersPage: React.FC<ScannersPageProps> = ({ onSelectStock }) => {
  const [activeTab, setActiveTab] = useState<'Breakout' | 'Gaps' | 'Momentum' | 'Swing'>('Breakout');
  const [minGap, setMinGap] = useState(2.0);
  const [momentumLookback, setMomentumLookback] = useState(10);
  const [data, setData] = useState<ScanResponse | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async (refresh = false) => {
    try {
      const res = await fetch(`/api/scanner${refresh ? '?refresh=1' : ''}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
      setError('');
    } catch (e: any) {
      setError(e?.message || 'Scanner API unreachable');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!data || data.status === 'done') return;
    const t = setTimeout(() => load(), 2500);
    return () => clearTimeout(t);
  }, [data, load]);

  const running = !data || data.status !== 'done';
  const analyze = (r: BaseRow) => (
    <button
      onClick={() => onSelectStock(r.symbol, r.market)}
      className="px-2.5 py-1 bg-cyan-600 hover:bg-cyan-700 text-white font-bold rounded-lg text-[11px]"
    >
      Analyze
    </button>
  );

  const Empty = ({ text }: { text: string }) => (
    <tr>
      <td colSpan={8} className="py-8 text-center text-slate-400">
        {running ? `Scanning live candles… ${data ? `${data.done}/${data.total}` : ''}` : text}
      </td>
    </tr>
  );

  const Card: React.FC<{ title: string; desc: React.ReactNode; right?: React.ReactNode; children: React.ReactNode }> = ({ title, desc, right, children }) => (
    <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">{title}</h3>
          <p className="text-xs text-slate-500">{desc}</p>
        </div>
        {right}
      </div>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );

  const head = 'bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-bold uppercase text-[10px] whitespace-nowrap';
  const body = 'divide-y divide-slate-100 dark:divide-slate-800 [&_td]:whitespace-nowrap';
  const rowCls = 'hover:bg-slate-50 dark:hover:bg-slate-800/40';

  const gaps = (data?.gaps || []).filter((g) => Math.abs(g.gapPct) >= minGap).sort((a, b) => Math.abs(b.gapPct) - Math.abs(a.gapPct));
  const momentum = [...(data?.momentum || [])]
    .filter((m) => m.roc[String(momentumLookback)] !== undefined)
    .sort((a, b) => b.roc[String(momentumLookback)] - a.roc[String(momentumLookback)])
    .slice(0, 15);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex gap-2 overflow-x-auto">
          {(['Breakout', 'Gaps', 'Momentum', 'Swing'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                activeTab === tab
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              {tab === 'Breakout' && '🚀 Breakout'}
              {tab === 'Gaps' && '⚡ Gap Up / Down'}
              {tab === 'Momentum' && '🔥 Momentum'}
              {tab === 'Swing' && '📈 Swing'}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2 text-[11px] text-slate-500">
          {data?.asOf && <span>Updated {new Date(data.asOf).toLocaleTimeString('en-IN')}</span>}
          <button
            onClick={() => load(true)}
            disabled={running}
            title="Rescan with fresh data"
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${running ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        </div>
      </div>

      {(error || (data && data.status === 'done' && data.failed.length > 0)) && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 px-3 py-2 text-xs">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error ? `Scanner error: ${error}` : `Data nahi mila: ${data!.failed.join(', ')}`}</span>
        </div>
      )}

      {activeTab === 'Breakout' && (
        <Card title="Breakout Scanner" desc="Latest close above the prior 20-day high, with volume vs the 20-day average.">
          <table className="w-full text-left text-xs">
            <thead className={head}>
              <tr>
                <th className={th}>Symbol</th><th className={th}>Market</th><th className={th}>Latest Price</th>
                <th className={th}>Prior 20D High</th><th className={th}>Volume vs Avg</th><th className={th}>Status</th>
                <th className={`${th} text-right`}>Action</th>
              </tr>
            </thead>
            <tbody className={body}>
              {(data?.breakout || []).map((r) => (
                <tr key={r.symbol} className={rowCls}>
                  <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">{r.symbol}</td>
                  <td className="py-2.5 px-3 text-slate-500">{r.market}</td>
                  <td className="py-2.5 px-3 font-bold">{cur(r.market)}{r.price.toLocaleString()}</td>
                  <td className="py-2.5 px-3 text-slate-500">{cur(r.market)}{r.prevHigh.toLocaleString()}</td>
                  <td className="py-2.5 px-3 font-bold text-cyan-600 dark:text-cyan-400">{r.volumeSpike !== null ? `${r.volumeSpike}x` : '—'}</td>
                  <td className="py-2.5 px-3"><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">{r.status}</span></td>
                  <td className="py-2.5 px-3 text-right">{analyze(r)}</td>
                </tr>
              ))}
              {(data?.breakout || []).length === 0 && <Empty text="Koi breakout nahi mila." />}
            </tbody>
          </table>
        </Card>
      )}

      {activeTab === 'Gaps' && (
        <Card
          title="Gap Up / Down Scanner"
          desc={`Today's open vs previous close, gaps of at least ${minGap}%.`}
          right={
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">Min Gap %:</span>
              <input type="range" min="0.5" max="5.0" step="0.5" value={minGap} onChange={(e) => setMinGap(Number(e.target.value))} className="w-24 accent-cyan-500" />
              <span className="text-xs font-bold text-cyan-600 dark:text-cyan-400">{minGap}%</span>
            </div>
          }
        >
          <table className="w-full text-left text-xs">
            <thead className={head}>
              <tr>
                <th className={th}>Symbol</th><th className={th}>Market</th><th className={th}>Current</th>
                <th className={th}>Open</th><th className={th}>Prev Close</th><th className={th}>Gap %</th>
                <th className={`${th} text-right`}>Action</th>
              </tr>
            </thead>
            <tbody className={body}>
              {gaps.map((r) => (
                <tr key={r.symbol} className={rowCls}>
                  <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">{r.symbol}</td>
                  <td className="py-2.5 px-3 text-slate-500">{r.market}</td>
                  <td className="py-2.5 px-3 font-bold">{cur(r.market)}{r.price.toLocaleString()}</td>
                  <td className="py-2.5 px-3">{r.open}</td>
                  <td className="py-2.5 px-3 text-slate-500">{r.prevClose}</td>
                  <td className="py-2.5 px-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${r.gapPct > 0 ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/20 text-rose-600 dark:text-rose-400'}`}>
                      {r.gapPct > 0 ? '+' : ''}{r.gapPct}% ({r.type})
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right">{analyze(r)}</td>
                </tr>
              ))}
              {gaps.length === 0 && <Empty text="Is gap % par koi stock nahi mila." />}
            </tbody>
          </table>
        </Card>
      )}

      {activeTab === 'Momentum' && (
        <Card
          title="Momentum Scanner"
          desc={`Top 15 by Rate-of-Change over the past ${momentumLookback} trading days.`}
          right={
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">Lookback Days:</span>
              <input type="range" min="5" max="30" step="5" value={momentumLookback} onChange={(e) => setMomentumLookback(Number(e.target.value))} className="w-24 accent-cyan-500" />
              <span className="text-xs font-bold text-cyan-600 dark:text-cyan-400">{momentumLookback}d</span>
            </div>
          }
        >
          <table className="w-full text-left text-xs">
            <thead className={head}>
              <tr>
                <th className={th}>Rank</th><th className={th}>Symbol</th><th className={th}>Market</th><th className={th}>Latest Price</th>
                <th className={th}>ROC %</th><th className={th}>RSI(14)</th><th className={`${th} text-right`}>Action</th>
              </tr>
            </thead>
            <tbody className={body}>
              {momentum.map((r, i) => {
                const roc = r.roc[String(momentumLookback)];
                return (
                  <tr key={r.symbol} className={rowCls}>
                    <td className="py-2.5 px-3 font-bold text-slate-400">#{i + 1}</td>
                    <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">{r.symbol}</td>
                    <td className="py-2.5 px-3 text-slate-500">{r.market}</td>
                    <td className="py-2.5 px-3 font-bold">{cur(r.market)}{r.price.toLocaleString()}</td>
                    <td className={`py-2.5 px-3 font-bold ${roc >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>{roc > 0 ? '+' : ''}{roc}%</td>
                    <td className="py-2.5 px-3 font-semibold">{r.rsi ?? '—'}</td>
                    <td className="py-2.5 px-3 text-right">{analyze(r)}</td>
                  </tr>
                );
              })}
              {momentum.length === 0 && <Empty text="Momentum data nahi mila." />}
            </tbody>
          </table>
        </Card>
      )}

      {activeTab === 'Swing' && (
        <Card title="Swing & Golden Cross Scanner" desc="SMA50 vs SMA200: fresh golden crosses (last 10 sessions), uptrends and pullbacks to the 50 SMA.">
          <table className="w-full text-left text-xs">
            <thead className={head}>
              <tr>
                <th className={th}>Symbol</th><th className={th}>Market</th><th className={th}>Price</th>
                <th className={th}>50 SMA</th><th className={th}>200 SMA</th><th className={th}>Signal</th>
                <th className={`${th} text-right`}>Action</th>
              </tr>
            </thead>
            <tbody className={body}>
              {(data?.swing || []).map((r) => (
                <tr key={r.symbol} className={rowCls}>
                  <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">{r.symbol}</td>
                  <td className="py-2.5 px-3 text-slate-500">{r.market}</td>
                  <td className="py-2.5 px-3 font-bold">{cur(r.market)}{r.price.toLocaleString()}</td>
                  <td className="py-2.5 px-3 text-slate-500">{r.sma50}</td>
                  <td className="py-2.5 px-3 text-slate-500">{r.sma200}</td>
                  <td className="py-2.5 px-3 font-bold text-cyan-600 dark:text-cyan-400">{r.event}</td>
                  <td className="py-2.5 px-3 text-right">{analyze(r)}</td>
                </tr>
              ))}
              {(data?.swing || []).length === 0 && <Empty text="Koi swing setup nahi mila." />}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
};
