import React, { useEffect, useMemo, useState } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import type { OptionChainRow } from '../../utils/greeks';
import { fetchLiveQuote, fetchConstituents, fetchStockInfo, LiveQuoteResponse, BatchQuote } from '../../utils/stockApi';
import type { StockInfo, MarketType } from '../../types';
import { OptionOiChart } from '../OptionOiChart';
import { OptionChangeOiChart } from '../OptionChangeOiChart';

export interface ChainSummary {
  pcr: number; maxPain: number;
  totalCallOI: number; totalPutOI: number; totalCallChangeOI: number; totalPutChangeOI: number;
  aiSignal?: { signal: string; confidence: number; reason: string };
  source?: string;
}

const INDEX_NAMES = ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY'];
const marketFor = (sym: string): MarketType => (INDEX_NAMES.includes(sym.toUpperCase()) ? 'INDEX' : 'NSE');
const fmt = (n: number, d = 2) => n.toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d });
const lakh = (n: number) => (Math.abs(n) >= 1e7 ? `${(n / 1e7).toFixed(2)} Cr` : Math.abs(n) >= 1e5 ? `${(n / 1e5).toFixed(2)} L` : n.toLocaleString('en-IN'));
const tone = (n: number) => (n > 0 ? 'text-emerald-600 dark:text-emerald-400' : n < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500');

function useUnderlying(symbol: string) {
  const [q, setQ] = useState<LiveQuoteResponse | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setQ(null);
    fetchLiveQuote(symbol, marketFor(symbol)).then((r) => {
      if (alive) { setQ(r); setLoading(false); }
    });
    return () => { alive = false; };
  }, [symbol]);
  return { q, loading };
}

const Card: React.FC<{ label: string; value: React.ReactNode; sub?: React.ReactNode }> = ({ label, value, sub }) => (
  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
    <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</div>
    <div className="mt-1 text-sm font-black font-mono text-slate-900 dark:text-white">{value}</div>
    {sub && <div className="text-[10px] text-slate-500 mt-0.5">{sub}</div>}
  </div>
);

export const ChartTab: React.FC<{ symbol: string; spotPrice: number; chain: OptionChainRow[]; atmStrike: number }> = ({ symbol, spotPrice, chain, atmStrike }) => {
  const { q, loading } = useUnderlying(symbol);
  const [range, setRange] = useState<30 | 90 | 250>(90);
  const data = useMemo(() => (q?.bars || []).slice(-range).map((b) => ({ date: b.date, close: b.close })), [q, range]);
  const up = data.length > 1 && data[data.length - 1].close >= data[0].close;
  const color = up ? '#059669' : '#e11d48';

  return (
    <div className="p-3 sm:p-4 space-y-4">
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-black text-slate-900 dark:text-white">{symbol} · Daily Close</h4>
          <div className="flex gap-1">
            {([[30, '1M'], [90, '3M'], [250, '1Y']] as const).map(([n, l]) => (
              <button key={l} onClick={() => setRange(n)} className={`px-2 py-0.5 rounded text-[10px] font-bold ${range === n ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>{l}</button>
            ))}
          </div>
        </div>
        {loading ? (
          <div className="h-56 flex items-center justify-center text-xs text-slate-400">Loading price history…</div>
        ) : data.length === 0 ? (
          <div className="h-56 flex items-center justify-center text-xs text-slate-400">Price history available nahi hai.</div>
        ) : (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="px-area" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.25)" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} minTickGap={40} />
                <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10 }} width={52} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Area type="monotone" dataKey="close" stroke={color} fill="url(#px-area)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
      <OptionOiChart chain={chain} atmStrike={atmStrike} spotPrice={spotPrice} indexName={symbol} />
      <OptionChangeOiChart chain={chain} atmStrike={atmStrike} spotPrice={spotPrice} indexName={symbol} />
    </div>
  );
};

export const OverviewTab: React.FC<{
  symbol: string; spotPrice: number; dayChange: number; dayChangePerc: number; chain: OptionChainRow[]; atmStrike: number;
  summary: ChainSummary; expiry: string; lotSize: number; isLiveFeed: boolean;
}> = ({ symbol, spotPrice, dayChange, dayChangePerc, chain, atmStrike, summary, expiry, lotSize, isLiveFeed }) => {
  const { q } = useUnderlying(symbol);
  const atm = chain.find((r) => r.strike === atmStrike);
  const straddle = atm ? atm.callLTP + atm.putLTP : 0;
  const topCall = chain.reduce((b, r) => (r.callOI > b.callOI ? r : b), chain[0]);
  const topPut = chain.reduce((b, r) => (r.putOI > b.putOI ? r : b), chain[0]);
  const bias = summary.pcr > 1.25 ? 'Bullish' : summary.pcr > 0 && summary.pcr < 0.8 ? 'Bearish' : 'Neutral';
  const sig = summary.aiSignal;

  return (
    <div className="p-3 sm:p-4 space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        <Card label="Spot" value={fmt(spotPrice)} sub={<span className={tone(dayChange)}>{dayChange >= 0 ? '+' : ''}{fmt(dayChange)} ({dayChangePerc >= 0 ? '+' : ''}{fmt(dayChangePerc)}%)</span>} />
        <Card label="Day High / Low" value={q ? `${fmt(q.regularMarketDayHigh)} / ${fmt(q.regularMarketDayLow)}` : '—'} />
        <Card label="52W High / Low" value={q ? `${fmt(q.fiftyTwoWeekHigh)} / ${fmt(q.fiftyTwoWeekLow)}` : '—'} />
        <Card label="Volume" value={q?.regularMarketVolume ? lakh(q.regularMarketVolume) : '—'} />
        <Card label="PCR (shown strikes)" value={summary.pcr > 0 ? summary.pcr.toFixed(2) : '—'} sub={`Bias: ${bias}`} />
        <Card label="Max Pain" value={fmt(summary.maxPain, 0)} />
        <Card label="Resistance (max Call OI)" value={topCall ? fmt(topCall.strike, 0) : '—'} sub={topCall ? `OI ${lakh(topCall.callOI)}` : ''} />
        <Card label="Support (max Put OI)" value={topPut ? fmt(topPut.strike, 0) : '—'} sub={topPut ? `OI ${lakh(topPut.putOI)}` : ''} />
        <Card label="Total Call OI" value={lakh(summary.totalCallOI)} sub={<span className={tone(-summary.totalCallChangeOI)}>Chg {lakh(summary.totalCallChangeOI)}</span>} />
        <Card label="Total Put OI" value={lakh(summary.totalPutOI)} sub={<span className={tone(summary.totalPutChangeOI)}>Chg {lakh(summary.totalPutChangeOI)}</span>} />
        <Card label="ATM Straddle" value={straddle > 0 ? `₹${fmt(straddle)}` : '—'} sub={straddle > 0 && spotPrice > 0 ? `Implied move ±${((straddle / spotPrice) * 100).toFixed(2)}%` : ''} />
        <Card label="Lot Size / Expiry" value={`${lotSize} · ${expiry || '—'}`} sub={isLiveFeed ? (summary.source || 'Live feed') : 'Estimated model'} />
      </div>
      {sig && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 text-xs space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase text-slate-400">PCR-based view</span>
            <span className={`px-2 py-0.5 rounded font-black text-[10px] ${sig.signal === 'BUY CALL' ? 'bg-emerald-500/15 text-emerald-600' : sig.signal === 'BUY PUT' ? 'bg-rose-500/15 text-rose-600' : 'bg-slate-500/15 text-slate-500'}`}>{sig.signal}</span>
            {sig.confidence > 0 && <span className="text-slate-400">{sig.confidence}%</span>}
          </div>
          <p className="text-slate-600 dark:text-slate-300">{sig.reason}</p>
          <p className="text-[10px] text-slate-400">Sirf OI/PCR par based indicator hai — trading advice nahi.</p>
        </div>
      )}
    </div>
  );
};

type SortKey = 'symbol' | 'price' | 'changePct';
export const CompositionTab: React.FC<{ symbol: string }> = ({ symbol }) => {
  const [loading, setLoading] = useState(true);
  const [isIndex, setIsIndex] = useState(false);
  const [rows, setRows] = useState<BatchQuote[]>([]);
  const [total, setTotal] = useState(0);
  const [info, setInfo] = useState<StockInfo | null>(null);
  const [sort, setSort] = useState<{ k: SortKey; dir: 1 | -1 }>({ k: 'changePct', dir: -1 });

  useEffect(() => {
    let alive = true;
    setLoading(true);
    (async () => {
      const c = await fetchConstituents(symbol);
      if (!alive) return;
      setIsIndex(c.isIndex); setRows(c.quotes); setTotal(c.total);
      if (!c.isIndex) setInfo(await fetchStockInfo(symbol, 'NSE'));
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, [symbol]);

  const sorted = useMemo(() => [...rows].sort((a, b) => {
    const x = sort.k === 'symbol' ? a.symbol.localeCompare(b.symbol) : (a[sort.k] as number) - (b[sort.k] as number);
    return x * sort.dir;
  }), [rows, sort]);
  const adv = rows.filter((r) => r.changePct > 0).length;
  const dec = rows.filter((r) => r.changePct < 0).length;
  const head = (k: SortKey, label: string, right = false) => (
    <th className={`py-2 px-3 cursor-pointer select-none ${right ? 'text-right' : 'text-left'}`} onClick={() => setSort((s) => ({ k, dir: s.k === k ? (s.dir === 1 ? -1 : 1) : -1 }))}>
      {label}{sort.k === k ? (sort.dir === 1 ? ' ▲' : ' ▼') : ''}
    </th>
  );

  if (loading) return <div className="p-10 text-center text-xs text-slate-400">Loading composition…</div>;

  if (!isIndex) {
    return (
      <div className="p-3 sm:p-4 space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          <Card label="Sector" value={info?.sector || '—'} />
          <Card label="Industry" value={info?.industry || '—'} />
          <Card label="Market Cap" value={info?.marketCap ? lakh(info.marketCap) : '—'} />
          <Card label="Trailing P/E" value={info?.trailingPE ? fmt(info.trailingPE) : '—'} />
          <Card label="Dividend Yield" value={info?.dividendYield ? `${fmt(info.dividendYield)}%` : '—'} />
          <Card label="Beta" value={info?.beta ? fmt(info.beta) : '—'} />
          <Card label="EPS (TTM)" value={info?.trailingEps ? fmt(info.trailingEps) : '—'} />
          <Card label="52W High / Low" value={info?.fiftyTwoWeekHigh ? `${fmt(info.fiftyTwoWeekHigh)} / ${fmt(info.fiftyTwoWeekLow)}` : '—'} />
        </div>
        {info?.longBusinessSummary ? (
          <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">{info.longBusinessSummary}</p>
        ) : (
          <p className="text-xs text-slate-400">{symbol} ek single stock hai — index composition lagu nahi. Company profile Yahoo se load nahi hua.</p>
        )}
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <span className="font-black text-slate-900 dark:text-white">{symbol} constituents</span>
        <span className="text-emerald-600 font-bold">▲ {adv} advancing</span>
        <span className="text-rose-600 font-bold">▼ {dec} declining</span>
        <span className="text-slate-400">{rows.length}/{total} quotes loaded</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-800 flex">
        <div className="bg-emerald-500" style={{ width: `${rows.length ? (adv / rows.length) * 100 : 0}%` }} />
        <div className="bg-rose-500" style={{ width: `${rows.length ? (dec / rows.length) * 100 : 0}%` }} />
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
        <table className="w-full text-xs whitespace-nowrap">
          <thead className="bg-slate-50 dark:bg-slate-800/60 text-[10px] uppercase text-slate-500">
            <tr>{head('symbol', 'Stock')}{head('price', 'LTP', true)}<th className="py-2 px-3 text-right">Chg</th>{head('changePct', 'Chg %', true)}<th className="py-2 px-3 text-right hidden sm:table-cell">Day Low – High</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
            {sorted.map((r) => (
              <tr key={r.symbol}>
                <td className="py-2 px-3 font-sans font-black text-slate-900 dark:text-white">{r.symbol}</td>
                <td className="py-2 px-3 text-right font-bold">{fmt(r.price)}</td>
                <td className={`py-2 px-3 text-right ${tone(r.change)}`}>{r.change >= 0 ? '+' : ''}{fmt(r.change)}</td>
                <td className={`py-2 px-3 text-right font-bold ${tone(r.changePct)}`}>{r.changePct >= 0 ? '+' : ''}{fmt(r.changePct)}%</td>
                <td className="py-2 px-3 text-right text-slate-500 hidden sm:table-cell">{r.low ? `${fmt(r.low)} – ${fmt(r.high)}` : '—'}</td>
              </tr>
            ))}
            {sorted.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-slate-400 font-sans">Constituent quotes load nahi hue (Angel/Yahoo check karein).</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-slate-400">Index weights API se available nahi hain, isliye sirf live price/change dikha rahe hain. Stock list static hai, prices live.</p>
    </div>
  );
};
