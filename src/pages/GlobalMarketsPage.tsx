import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Globe, Gauge, RefreshCw } from 'lucide-react';
import type { MarketType } from '../types';
import { fetchBatchQuotes } from '../utils/stockApi';
import type { BatchQuote } from '../utils/stockApi';

interface GlobalMarketsPageProps {
  onSelectStock: (symbol: string, market: MarketType) => void;
}

interface BenchmarkDef {
  id: string;
  symbol: string;
  market: string;
  name: string;
  region: string;
  selectSymbol?: string;
  selectMarket?: MarketType;
}

interface MoverDef {
  symbol: string;
  name: string;
  market: MarketType;
}

const WORLD_BENCHMARKS: BenchmarkDef[] = [
  { id: 'nifty', symbol: 'NIFTY 50', market: 'INDEX', name: 'NIFTY 50', region: 'India', selectSymbol: 'NIFTY 50', selectMarket: 'INDEX' },
  { id: 'banknifty', symbol: 'BANK NIFTY', market: 'INDEX', name: 'BANK NIFTY', region: 'India', selectSymbol: 'BANK NIFTY', selectMarket: 'INDEX' },
  { id: 'sensex', symbol: 'SENSEX', market: 'INDEX', name: 'BSE SENSEX', region: 'India', selectSymbol: 'SENSEX', selectMarket: 'INDEX' },
  { id: 'sp500', symbol: '^GSPC', market: 'US', name: 'S&P 500', region: 'US', selectSymbol: '^GSPC', selectMarket: 'US' },
  { id: 'ndx', symbol: '^NDX', market: 'US', name: 'NASDAQ 100', region: 'US', selectSymbol: '^NDX', selectMarket: 'US' },
  { id: 'dji', symbol: '^DJI', market: 'US', name: 'Dow Jones', region: 'US', selectSymbol: '^DJI', selectMarket: 'US' },
  { id: 'ftse', symbol: '^FTSE', market: 'US', name: 'FTSE 100', region: 'UK', selectSymbol: '^FTSE', selectMarket: 'US' },
  { id: 'n225', symbol: '^N225', market: 'US', name: 'Nikkei 225', region: 'Japan', selectSymbol: '^N225', selectMarket: 'US' },
  { id: 'hsi', symbol: '^HSI', market: 'US', name: 'Hang Seng', region: 'Hong Kong', selectSymbol: '^HSI', selectMarket: 'US' },
  { id: 'dxy', symbol: 'DX-Y.NYB', market: 'US', name: 'Dollar Index (DXY)', region: 'Currency' },
  { id: 'gold', symbol: 'GC=F', market: 'US', name: 'Gold (USD/oz)', region: 'Commodity' },
  { id: 'silver', symbol: 'SI=F', market: 'US', name: 'Silver (USD/oz)', region: 'Commodity' },
  { id: 'brent', symbol: 'BZ=F', market: 'US', name: 'Brent Crude Oil', region: 'Commodity' },
  { id: 'wti', symbol: 'CL=F', market: 'US', name: 'WTI Crude Oil', region: 'Commodity' },
  { id: 'natgas', symbol: 'NG=F', market: 'US', name: 'Natural Gas', region: 'Commodity' },
  { id: 'vix', symbol: 'INDIA VIX', market: 'INDEX', name: 'India VIX', region: 'Volatility', selectSymbol: 'INDIA VIX', selectMarket: 'INDEX' },
];

const TOP_MOVERS: MoverDef[] = [
  { symbol: 'NVDA', name: 'Nvidia Corp', market: 'US' },
  { symbol: 'TMPV', name: 'Tata Motors', market: 'NSE' },
  { symbol: 'RELIANCE', name: 'Reliance Ind', market: 'NSE' },
  { symbol: 'AAPL', name: 'Apple Inc', market: 'US' },
  { symbol: 'TCS', name: 'Tata Consultancy', market: 'NSE' },
  { symbol: 'MSFT', name: 'Microsoft', market: 'US' },
  { symbol: 'HDFCBANK', name: 'HDFC Bank', market: 'NSE' },
  { symbol: 'TSLA', name: 'Tesla Inc', market: 'US' },
  { symbol: 'INFY', name: 'Infosys Ltd', market: 'NSE' },
  { symbol: 'ICICIBANK', name: 'ICICI Bank', market: 'NSE' },
];

const ALL_ITEMS = [
  ...WORLD_BENCHMARKS.map((b) => ({ symbol: b.symbol, market: b.market })),
  ...TOP_MOVERS.map((m) => ({ symbol: m.symbol, market: m.market })),
];

const fmtVol = (v: number) => {
  if (!v || v <= 0) return '—';
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return String(v);
};

const nowTime = () =>
  new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

export const GlobalMarketsPage: React.FC<GlobalMarketsPageProps> = ({ onSelectStock }) => {
  const [quotes, setQuotes] = useState<Record<string, BatchQuote>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [lastSynced, setLastSynced] = useState<string>('');

  const loadAll = useCallback(async (force = false) => {
    setRefreshing(true);
    try {
      const list = await fetchBatchQuotes(ALL_ITEMS, force);
      if (list.length > 0) {
        const next: Record<string, BatchQuote> = {};
        for (const q of list) {
          next[`${q.symbol.toUpperCase()}|${q.market.toUpperCase()}`] = q;
        }
        setQuotes((prev) => ({ ...prev, ...next }));
        setLastSynced(nowTime());
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAll(false);
    const timer = window.setInterval(() => loadAll(false), 15_000);
    return () => window.clearInterval(timer);
  }, [loadAll]);

  const getQuote = (symbol: string, market: string): BatchQuote | undefined =>
    quotes[`${symbol.toUpperCase()}|${market.toUpperCase()}`];

  const moversSorted = useMemo(() => {
    return TOP_MOVERS.map((m) => ({
      ...m,
      quote: getQuote(m.symbol, m.market),
    })).sort((a, b) => (b.quote?.changePct ?? -999) - (a.quote?.changePct ?? -999));
  }, [quotes]);

  const breadth = useMemo(() => {
    const loaded = Object.values(quotes).filter((q) => q.price > 0);
    const total = loaded.length;
    if (total === 0) {
      return { total: 0, adv: 0, dec: 0, advPct: 0, decPct: 0, mood: 'Loading Live Breadth' };
    }
    const adv = loaded.filter((q) => q.changePct > 0).length;
    const dec = loaded.filter((q) => q.changePct < 0).length;
    const decided = Math.max(1, adv + dec);
    const advPct = Number(((adv / decided) * 100).toFixed(1));
    const decPct = Number(((dec / decided) * 100).toFixed(1));
    const mood =
      advPct >= 60
        ? `${advPct}% Bullish Breadth (Positive Bias)`
        : advPct <= 40
          ? `${decPct}% Bearish Breadth (Cautious Bias)`
          : `${advPct}% Neutral Breadth (Mixed Session)`;
    return { total, adv, dec, advPct, decPct, mood };
  }, [quotes]);

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Globe className="w-5 h-5 text-blue-500" />
              <span>World Indices &amp; Commodities Snapshot</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Live global benchmarks, NIFTY &amp; BANK NIFTY, and energy/precious metal commodities · Auto-refreshes every 15s
            </p>
          </div>

          <div className="flex items-center gap-2.5 text-xs">
            {lastSynced && (
              <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400">
                Synced {lastSynced}
              </span>
            )}
            <button
              type="button"
              onClick={() => loadAll(true)}
              disabled={refreshing}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {WORLD_BENCHMARKS.map((idx) => {
            const q = getQuote(idx.symbol, idx.market);
            const pct = q?.changePct ?? 0;
            const isPos = pct >= 0;
            const clickable = Boolean(idx.selectSymbol && idx.selectMarket);
            const TagName = clickable ? 'button' : 'div';
            return (
              <TagName
                key={idx.id}
                {...(clickable
                  ? {
                      type: 'button' as const,
                      onClick: () => onSelectStock(idx.selectSymbol!, idx.selectMarket!),
                    }
                  : {})}
                className={`p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-1 text-left ${
                  clickable
                    ? 'hover:border-blue-400 dark:hover:border-blue-600 transition-colors cursor-pointer'
                    : ''
                }`}
              >
                <div className="flex items-center justify-between text-slate-400 text-[10px] font-semibold uppercase">
                  <span>{idx.region}</span>
                  {q ? (
                    <span
                      className={`font-mono tabular-nums ${
                        isPos ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {isPos ? '+' : ''}
                      {pct.toFixed(2)}%
                    </span>
                  ) : (
                    <span>—</span>
                  )}
                </div>
                <h4 className="font-bold text-xs text-slate-900 dark:text-white truncate">
                  {idx.name}
                </h4>
                <div className="text-sm font-black font-mono tabular-nums text-slate-800 dark:text-slate-100">
                  {q
                    ? q.price.toLocaleString('en-IN', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })
                    : loading
                      ? 'Loading...'
                      : 'Unavailable'}
                </div>
              </TagName>
            );
          })}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="space-y-1">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
            Market Breadth &amp; Sentiment Mood
          </span>
          <h4 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Gauge className="w-5 h-5 text-emerald-500" />
            <span>{breadth.mood}</span>
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            {breadth.total > 0
              ? `${breadth.adv} Advances vs ${breadth.dec} Declines across ${breadth.total} live global indices, commodities & leaders.`
              : 'Syncing live quotes across global benchmarks and equities...'}
          </p>
        </div>
        <div className="flex items-center gap-5 font-mono tabular-nums">
          <div className="text-center">
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-sans font-bold block">
              Advances
            </span>
            <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
              {breadth.total > 0 ? `${breadth.advPct}%` : '—'}
            </span>
          </div>
          <div className="text-center">
            <span className="text-xs text-rose-600 dark:text-rose-400 font-sans font-bold block">
              Declines
            </span>
            <span className="text-lg font-black text-rose-600 dark:text-rose-400">
              {breadth.total > 0 ? `${breadth.decPct}%` : '—'}
            </span>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Top Movers Heatmap</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Live daily performance across active NSE &amp; US leaders
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {moversSorted.map((m) => {
            const q = m.quote;
            const chg = q?.changePct ?? 0;
            const isPos = chg >= 0;
            const curr = m.market === 'US' ? '$' : '₹';
            return (
              <button
                key={`${m.symbol}-${m.market}`}
                type="button"
                onClick={() => onSelectStock(m.symbol, m.market)}
                className={`p-4 rounded-xl text-left transition-transform hover:scale-[1.02] shadow-sm border cursor-pointer ${
                  !q
                    ? 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800'
                    : isPos
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-950 dark:text-emerald-100'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-950 dark:text-rose-100'
                }`}
              >
                <div className="flex justify-between items-start gap-1">
                  <span className="font-black text-sm text-slate-900 dark:text-white truncate">
                    {m.symbol}
                  </span>
                  <span
                    className={`text-xs font-bold font-mono tabular-nums shrink-0 ${
                      !q
                        ? 'text-slate-400'
                        : isPos
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {q ? `${isPos ? '+' : ''}${chg.toFixed(2)}%` : '—'}
                  </span>
                </div>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-1 truncate">
                  {m.name}
                </span>
                <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 font-mono tabular-nums mt-2">
                  <span>{q ? `${curr}${q.price.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : '—'}</span>
                  <span>Vol: {q ? fmtVol(q.volume) : '—'}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
