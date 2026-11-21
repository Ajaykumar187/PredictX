import React, { useMemo, useState, useRef, useEffect } from 'react';
import {
  Search,
  TrendingUp,
  TrendingDown,
  Target,
  ShieldAlert,
  ArrowUpRight,
  ArrowDownRight,
  Layers,
  Calendar,
  MessageSquare,
  Info,
  X,
} from 'lucide-react';
import { AnalysisResult, MarketType } from '../types';
import { formatCurrencyValue, StockSearchResult } from '../utils/marketData';
import { searchStocksApi } from '../utils/stockApi';
import { generateExpertAdvice, ExpertVerdict } from '../utils/expertAdvice';

interface ExpertAdvicePanelProps {
  data?: AnalysisResult | null;
  onSelectStock?: (symbol: string, market: MarketType) => void;
  onAskAiPrompt?: (prompt: string) => void;
}

const VERDICT_STYLE: Record<ExpertVerdict, string> = {
  'STRONG BUY': 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30',
  'BUY / ACCUMULATE': 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25',
  'HOLD / WAIT': 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30',
  'BOOK PROFIT / TRIM': 'bg-orange-500/15 text-orange-700 dark:text-orange-300 border border-orange-500/30',
  'SELL / AVOID': 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30',
};

const QUICK_TICKERS: Array<{ symbol: string; market: MarketType }> = [
  { symbol: 'RELIANCE', market: 'NSE' },
  { symbol: 'TCS', market: 'NSE' },
  { symbol: 'HDFCBANK', market: 'NSE' },
  { symbol: 'TATAMOTORS', market: 'NSE' },
  { symbol: 'SUZLON', market: 'NSE' },
  { symbol: 'AAPL', market: 'US' },
  { symbol: 'NVDA', market: 'US' },
];

export const ExpertAdvicePanel: React.FC<ExpertAdvicePanelProps> = ({
  data,
  onSelectStock,
  onAskAiPrompt,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<StockSearchResult[]>([]);
  const [openDropdown, setOpenDropdown] = useState(false);
  const [selectedYears, setSelectedYears] = useState<1 | 3 | 5>(3);
  const [capitalInput, setCapitalInput] = useState<string>(data?.market === 'US' ? '10000' : '100000');

  const searchRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setCapitalInput(data?.market === 'US' ? '10000' : '100000');
  }, [data?.market]);

  useEffect(() => {
    const onOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setOpenDropdown(false);
      }
    };
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, []);

  const handleQueryChange = (val: string) => {
    setQuery(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    const trimmed = val.trim();
    if (!trimmed) {
      setResults([]);
      setOpenDropdown(false);
      return;
    }
    setOpenDropdown(true);
    timerRef.current = setTimeout(async () => {
      const list = await searchStocksApi(trimmed);
      setResults(list);
    }, 180);
  };

  const pickStock = (sym: string, market: MarketType) => {
    setQuery('');
    setResults([]);
    setOpenDropdown(false);
    if (onSelectStock) onSelectStock(sym, market);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = query.trim().toUpperCase();
    if (!clean) return;
    if (results.length > 0) {
      pickStock(results[0].displaySymbol, results[0].market);
    } else {
      pickStock(clean, data?.market || 'NSE');
    }
  };

  const advice = useMemo(() => (data ? generateExpertAdvice(data) : null), [data]);

  const fmt = (val: number) => {
    if (!data) return formatCurrencyValue(val, 'NSE');
    return typeof data.currencyFmt === 'function'
      ? data.currencyFmt(val)
      : formatCurrencyValue(val, data.market);
  };

  const activeProj = advice?.projections.find((p) => p.years === selectedYears) || advice?.projections[1];
  const investedCapital = Math.max(0, Number(capitalInput) || 0);

  return (
    <div className="space-y-5">
      {/* Inline Stock Search Bar for Any Stock */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Analyze Any Stock — Support, Resistance, Buy/Sell & Multi-Year Return
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Search any NSE, BSE, or US ticker to inspect actionable entry/exit levels and 1Y–5Y projections.
            </p>
          </div>

          <div ref={searchRef} className="relative w-full md:w-80">
            <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => handleQueryChange(e.target.value)}
                  onFocus={() => query.trim() && setOpenDropdown(true)}
                  placeholder="Search stock (e.g. RELIANCE, INFY, NVDA)..."
                  className="w-full pl-8 pr-7 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery('');
                      setResults([]);
                      setOpenDropdown(false);
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    aria-label="Clear stock search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <button
                type="submit"
                className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors"
              >
                Analyze
              </button>
            </form>

            {openDropdown && results.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1.5 z-40 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                {results.map((item, idx) => (
                  <button
                    key={`${item.market}-${item.symbol}-${idx}`}
                    type="button"
                    onClick={() => pickStock(item.displaySymbol, item.market)}
                    className="w-full px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-between gap-2 cursor-pointer"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {item.displaySymbol}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {item.longName}
                      </div>
                    </div>
                    <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 shrink-0">
                      {item.market}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100 dark:border-slate-800">
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mr-1">Quick Select:</span>
          {QUICK_TICKERS.map((stk) => {
            const isActive = data?.displaySymbol?.toUpperCase() === stk.symbol && data?.market === stk.market;
            return (
              <button
                key={`${stk.market}-${stk.symbol}`}
                type="button"
                onClick={() => pickStock(stk.symbol, stk.market)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {stk.symbol} · {stk.market}
              </button>
            );
          })}
        </div>
      </div>

      {!data || !advice ? (
        <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 text-center space-y-3">
          <Target className="w-8 h-8 text-blue-500 mx-auto" />
          <h4 className="text-base font-bold text-slate-900 dark:text-white">
            Select a Stock to View Expert Advice
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            Search any company above or tap a quick ticker to view Support & Resistance levels, Buy/Sell entry zones, Stop Loss, and 1-Year to 5-Year return estimates.
          </p>
        </div>
      ) : (
        <>
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span>{data.market}</span>
                  <span aria-hidden="true">·</span>
                  <span>{data.info?.sector || 'Equities'}</span>
                  <span aria-hidden="true">·</span>
                  <span>Risk: {data.risk.risk_label}</span>
                  <span aria-hidden="true">·</span>
                  <span>{advice.convictionLabel}</span>
                </div>
                <div className="flex flex-wrap items-baseline gap-3">
                  <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">
                    {advice.companyName} ({advice.symbol})
                  </h3>
                  <span className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                    {fmt(advice.currentPrice)}
                  </span>
                  <span
                    className={`text-xs font-semibold font-mono tabular-nums ${
                      data.change >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {data.change >= 0 ? '+' : ''}
                    {data.changePct.toFixed(2)}%
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <span className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap ${VERDICT_STYLE[advice.verdict]}`}>
                  {advice.verdict}
                </span>
                {onAskAiPrompt && (
                  <button
                    type="button"
                    onClick={() =>
                      onAskAiPrompt(
                        `Give me complete expert advice for ${advice.symbol}: support resistance, buy sell levels, and 1 to 5 year return outlook.`
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 whitespace-nowrap shrink-0 cursor-pointer transition-colors"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-blue-500" />
                    <span>Discuss in AI Chat</span>
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  <span>Ideal Buy / Accumulate Zone</span>
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div className="text-base font-extrabold font-mono tabular-nums text-slate-900 dark:text-white">
                  {fmt(advice.buyZone.low)} – {fmt(advice.buyZone.high)}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                  {advice.buyZone.note}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold text-blue-600 dark:text-blue-400">
                  <span>Breakout Buy Above</span>
                  <ArrowUpRight className="w-4 h-4" />
                </div>
                <div className="text-base font-extrabold font-mono tabular-nums text-slate-900 dark:text-white">
                  {fmt(advice.breakoutBuyTrigger)}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                  Confirmed daily close above R1 triggers fresh momentum upside.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold text-rose-600 dark:text-rose-400">
                  <span>Stop Loss & Breakdown Sell</span>
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <div className="text-base font-extrabold font-mono tabular-nums text-rose-600 dark:text-rose-400">
                  {fmt(advice.stopLoss)}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                  Max Risk: -{advice.stopLossRiskPct.toFixed(1)}% · Risk:Reward {advice.riskRewardRatio}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold text-amber-600 dark:text-amber-400">
                  <span>Sell / Profit Booking Zone</span>
                  <Target className="w-4 h-4" />
                </div>
                <div className="text-base font-extrabold font-mono tabular-nums text-slate-900 dark:text-white">
                  {fmt(advice.profitBookZone.low)} – {fmt(advice.profitBookZone.high)}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                  Positional T3: {fmt(advice.targets.positional.price)} (+{advice.targets.positional.pct}%)
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <ArrowDownRight className="w-4 h-4 text-emerald-500" />
                  <span>Key Support Levels (Demand Zones)</span>
                </h4>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                  Pivot: {fmt(advice.classicPivot)}
                </span>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {advice.supports.map((lvl) => (
                  <div key={lvl.label} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white">{lvl.label}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">{lvl.basis}</div>
                    </div>
                    <div className="text-right font-mono tabular-nums">
                      <div className="font-bold text-emerald-600 dark:text-emerald-400">{fmt(lvl.price)}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">{lvl.distancePct.toFixed(2)}% from CMP</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 grid grid-cols-3 gap-2 text-xs">
                <div>
                  <span className="text-[11px] text-slate-500 block">50-Day SMA</span>
                  <span className="font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                    {advice.technicalBaselines.sma50 ? fmt(advice.technicalBaselines.sma50) : 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block">200-Day SMA</span>
                  <span className="font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                    {advice.technicalBaselines.sma200 ? fmt(advice.technicalBaselines.sma200) : 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block">52-Week Low</span>
                  <span className="font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                    {fmt(advice.technicalBaselines.fiftyTwoWeekLow)}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-rose-500" />
                  <span>Key Resistance & Upside Targets</span>
                </h4>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                  RSI(14): {advice.technicalBaselines.rsi14}
                </span>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {advice.resistances.map((lvl, idx) => {
                  const tf =
                    idx === 0
                      ? advice.targets.shortTerm.timeframe
                      : idx === 1
                      ? advice.targets.mediumTerm.timeframe
                      : advice.targets.positional.timeframe;
                  return (
                    <div key={lvl.label} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white">
                          {lvl.label} · Target {idx + 1}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {lvl.basis} · Horizon: {tf}
                        </div>
                      </div>
                      <div className="text-right font-mono tabular-nums">
                        <div className="font-bold text-blue-600 dark:text-blue-400">{fmt(lvl.price)}</div>
                        <div className="text-[11px] text-emerald-600 dark:text-emerald-400">
                          +{lvl.distancePct.toFixed(2)}% upside
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 grid grid-cols-3 gap-2 text-xs">
                <div>
                  <span className="text-[11px] text-slate-500 block">20-Day EMA</span>
                  <span className="font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                    {advice.technicalBaselines.ema20 ? fmt(advice.technicalBaselines.ema20) : 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block">ATR (14-Day)</span>
                  <span className="font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                    {fmt(advice.technicalBaselines.atr14)}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block">52-Week High</span>
                  <span className="font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                    {fmt(advice.technicalBaselines.fiftyTwoWeekHigh)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h4 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-500" />
                  <span>Multi-Year Return Projections & Holding Horizon</span>
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Recommended Horizon: <strong className="text-slate-800 dark:text-slate-200">{advice.suitabilityHorizon}</strong> — {advice.horizonSummary}
                </p>
              </div>

              <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800 shrink-0 self-start">
                {([1, 3, 5] as const).map((yr) => (
                  <button
                    key={yr}
                    type="button"
                    onClick={() => setSelectedYears(yr)}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                      selectedYears === yr
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {yr} {yr === 1 ? 'Year' : 'Years'}
                  </button>
                ))}
              </div>
            </div>

            {activeProj && (
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-stretch">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 flex flex-col justify-between gap-2">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Investment Amount ({data.currencySymbol})
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={data.market === 'US' ? 500 : 5000}
                    value={capitalInput}
                    onChange={(e) => setCapitalInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-bold font-mono tabular-nums text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Simulated over {activeProj.years} {activeProj.years === 1 ? 'Year' : 'Years'}
                  </span>
                </div>

                {[
                  {
                    name: 'Conservative Case',
                    cagr: activeProj.conservativeCagr,
                    price: activeProj.conservativePrice,
                    retPct: activeProj.conservativeReturnPct,
                    tone: 'text-slate-700 dark:text-slate-300',
                  },
                  {
                    name: 'Base Expected Case',
                    cagr: activeProj.baseCagr,
                    price: activeProj.basePrice,
                    retPct: activeProj.baseReturnPct,
                    tone: 'text-blue-600 dark:text-blue-400',
                  },
                  {
                    name: 'Optimistic Bull Case',
                    cagr: activeProj.optimisticCagr,
                    price: activeProj.optimisticPrice,
                    retPct: activeProj.optimisticReturnPct,
                    tone: 'text-emerald-600 dark:text-emerald-400',
                  },
                ].map((scen) => {
                  const estValue = investedCapital * (1 + scen.retPct / 100);
                  return (
                    <div
                      key={scen.name}
                      className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 space-y-1"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-600 dark:text-slate-300">{scen.name}</span>
                        <span className={`font-mono tabular-nums font-bold ${scen.tone}`}>
                          {scen.cagr >= 0 ? '+' : ''}
                          {scen.cagr}% CAGR
                        </span>
                      </div>
                      <div className="text-lg font-extrabold font-mono tabular-nums text-slate-900 dark:text-white">
                        {fmt(estValue)}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                        Est. Share Price: {fmt(scen.price)} ({scen.retPct >= 0 ? '+' : ''}
                        {scen.retPct}%)
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                    <th className="py-2.5 pr-4 font-semibold">Holding Horizon</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Conservative Target</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Base Case Target</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Optimistic Target</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Base Total Return</th>
                    <th className="py-2.5 pl-3 font-semibold text-right">Base CAGR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono tabular-nums">
                  {advice.projections.map((p) => (
                    <tr
                      key={p.years}
                      onClick={() => setSelectedYears(p.years)}
                      className={`cursor-pointer transition-colors ${
                        selectedYears === p.years
                          ? 'bg-blue-50/60 dark:bg-blue-950/30'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      <td className="py-2.5 pr-4 font-sans font-semibold text-slate-900 dark:text-white">
                        {p.label}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-700 dark:text-slate-300">
                        {fmt(p.conservativePrice)} ({p.conservativeReturnPct >= 0 ? '+' : ''}
                        {p.conservativeReturnPct}%)
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-blue-600 dark:text-blue-400">
                        {fmt(p.basePrice)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-emerald-600 dark:text-emerald-400">
                        {fmt(p.optimisticPrice)} (+{p.optimisticReturnPct}%)
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                        +{p.baseReturnPct}%
                      </td>
                      <td className="py-2.5 pl-3 text-right font-bold text-slate-900 dark:text-white">
                        {p.baseCagr}% / yr
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Analytical Basis
              </div>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-300">
                {advice.rationale.map((line, i) => (
                  <li key={i} className="leading-relaxed">
                    • {line}
                  </li>
                ))}
              </ul>
              <p className="text-[11px] text-slate-400 flex items-start gap-1.5 pt-1">
                <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{advice.disclaimer}</span>
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ExpertAdvicePanel;
