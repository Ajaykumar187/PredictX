import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  ArrowLeftRight,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertTriangle,
  Award,
  Zap,
  Activity,
  Calendar,
  Layers,
  ExternalLink,
  Star,
  ChevronDown,
  X,
  Sliders,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import { MarketType, AnalysisResult } from '../types';
import { fetchAndAnalyzeStock, searchStocksApi } from '../utils/stockApi';
import { ensureCurrencyFmt, formatCurrencyValue } from '../utils/marketData';
import { storage } from '../utils/storage';

interface StockSplitViewProps {
  initialStockA?: { symbol: string; market: MarketType };
  initialStockB?: { symbol: string; market: MarketType };
  theme?: 'Light' | 'Dark';
  onSelectStock?: (symbol: string, market: MarketType) => void;
}

const PRESET_PAIRS = [
  { label: 'TCS vs INFY', a: { symbol: 'TCS', market: 'NSE' as MarketType }, b: { symbol: 'INFY', market: 'NSE' as MarketType }, tag: 'IT Leaders' },
  { label: 'RELIANCE vs TATAMOTORS', a: { symbol: 'RELIANCE', market: 'NSE' as MarketType }, b: { symbol: 'TATAMOTORS', market: 'NSE' as MarketType }, tag: 'Conglomerate & Auto' },
  { label: 'HDFCBANK vs ICICIBANK', a: { symbol: 'HDFCBANK', market: 'NSE' as MarketType }, b: { symbol: 'ICICIBANK', market: 'NSE' as MarketType }, tag: 'Private Banks' },
  { label: 'MARUTI vs M&M', a: { symbol: 'MARUTI', market: 'NSE' as MarketType }, b: { symbol: 'M&M', market: 'NSE' as MarketType }, tag: 'Automobile' },
  { label: 'AAPL vs MSFT', a: { symbol: 'AAPL', market: 'US' as MarketType }, b: { symbol: 'MSFT', market: 'US' as MarketType }, tag: 'US Mega Tech' },
  { label: 'NVDA vs AMD', a: { symbol: 'NVDA', market: 'US' as MarketType }, b: { symbol: 'AMD', market: 'US' as MarketType }, tag: 'Semiconductors' },
];

export const StockSplitView: React.FC<StockSplitViewProps> = ({
  initialStockA = { symbol: 'TCS', market: 'NSE' },
  initialStockB = { symbol: 'INFY', market: 'NSE' },
  theme = 'Dark',
  onSelectStock,
}) => {
  const isDark = theme === 'Dark';

  const [symA, setSymA] = useState(initialStockA.symbol);
  const [marketA, setMarketA] = useState<MarketType>(initialStockA.market);
  const [dataA, setDataA] = useState<AnalysisResult | null>(null);
  const [loadingA, setLoadingA] = useState(false);
  const [errorA, setErrorA] = useState<string | null>(null);

  const [symB, setSymB] = useState(initialStockB.symbol);
  const [marketB, setMarketB] = useState<MarketType>(initialStockB.market);
  const [dataB, setDataB] = useState<AnalysisResult | null>(null);
  const [loadingB, setLoadingB] = useState(false);
  const [errorB, setErrorB] = useState<string | null>(null);

  const [searchQueryA, setSearchQueryA] = useState('');
  const [searchQueryB, setSearchQueryB] = useState('');
  const [suggestionsA, setSuggestionsA] = useState<any[]>([]);
  const [suggestionsB, setSuggestionsB] = useState<any[]>([]);
  const [searchingA, setSearchingA] = useState(false);
  const [searchingB, setSearchingB] = useState(false);
  const [showDropdownA, setShowDropdownA] = useState(false);
  const [showDropdownB, setShowDropdownB] = useState(false);

  const [chartMode, setChartMode] = useState<'percent' | 'price'>('percent');
  const [timeRange, setTimeRange] = useState<'1W' | '1M' | '3M' | 'ALL'>('1M');

  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const reqCountA = useRef(0);
  const reqCountB = useRef(0);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const fetchBothStocks = useCallback(async (
    targetA = symA,
    mktA = marketA,
    targetB = symB,
    mktB = marketB
  ) => {
    const idA = ++reqCountA.current;
    const idB = ++reqCountB.current;

    setLoadingA(true);
    setLoadingB(true);
    setErrorA(null);
    setErrorB(null);

    const promiseA = fetchAndAnalyzeStock(targetA, mktA, (enriched) => {
      if (reqCountA.current === idA) {
        const safe = ensureCurrencyFmt(enriched);
        if (safe) setDataA(safe);
      }
    })
      .then((res) => {
        if (reqCountA.current === idA) {
          const safe = ensureCurrencyFmt(res) || res;
          setDataA(safe);
          setErrorA(null);
        }
      })
      .catch((err: any) => {
        if (reqCountA.current === idA) {
          console.warn('[StockSplitView] Failed fetching Stock A:', err);
          setErrorA(err?.message || `Failed to fetch ${targetA}`);
        }
      })
      .finally(() => {
        if (reqCountA.current === idA) setLoadingA(false);
      });

    const promiseB = fetchAndAnalyzeStock(targetB, mktB, (enriched) => {
      if (reqCountB.current === idB) {
        const safe = ensureCurrencyFmt(enriched);
        if (safe) setDataB(safe);
      }
    })
      .then((res) => {
        if (reqCountB.current === idB) {
          const safe = ensureCurrencyFmt(res) || res;
          setDataB(safe);
          setErrorB(null);
        }
      })
      .catch((err: any) => {
        if (reqCountB.current === idB) {
          console.warn('[StockSplitView] Failed fetching Stock B:', err);
          setErrorB(err?.message || `Failed to fetch ${targetB}`);
        }
      })
      .finally(() => {
        if (reqCountB.current === idB) setLoadingB(false);
      });

    await Promise.allSettled([promiseA, promiseB]);
  }, [symA, marketA, symB, marketB]);

  useEffect(() => {
    fetchBothStocks(symA, marketA, symB, marketB);
  }, []);

  useEffect(() => {
    const q = searchQueryA.trim();
    if (!q) {
      setSuggestionsA([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearchingA(true);
      try {
        const res = await searchStocksApi(q);
        setSuggestionsA(res.slice(0, 6));
      } catch {
        setSuggestionsA([]);
      } finally {
        setSearchingA(false);
      }
    }, 280);
    return () => clearTimeout(t);
  }, [searchQueryA]);

  useEffect(() => {
    const q = searchQueryB.trim();
    if (!q) {
      setSuggestionsB([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearchingB(true);
      try {
        const res = await searchStocksApi(q);
        setSuggestionsB(res.slice(0, 6));
      } catch {
        setSuggestionsB([]);
      } finally {
        setSearchingB(false);
      }
    }, 280);
    return () => clearTimeout(t);
  }, [searchQueryB]);

  const handleSwap = () => {
    const tempSym = symA;
    const tempMkt = marketA;
    const tempData = dataA;
    const tempErr = errorA;

    setSymA(symB);
    setMarketA(marketB);
    setDataA(dataB);
    setErrorA(errorB);

    setSymB(tempSym);
    setMarketB(tempMkt);
    setDataB(tempData);
    setErrorB(tempErr);

    showToast(`Swapped ${symA} ⇄ ${symB}`);
  };

  const handleSelectPreset = (preset: typeof PRESET_PAIRS[0]) => {
    setSymA(preset.a.symbol);
    setMarketA(preset.a.market);
    setSymB(preset.b.symbol);
    setMarketB(preset.b.market);
    fetchBothStocks(preset.a.symbol, preset.a.market, preset.b.symbol, preset.b.market);
  };

  const handleSelectA = (item: any) => {
    const newSym = item.displaySymbol || item.symbol;
    const newMkt = (item.market as MarketType) || marketA;
    setSymA(newSym);
    setMarketA(newMkt);
    setSearchQueryA('');
    setShowDropdownA(false);
    fetchBothStocks(newSym, newMkt, symB, marketB);
  };

  const handleSelectB = (item: any) => {
    const newSym = item.displaySymbol || item.symbol;
    const newMkt = (item.market as MarketType) || marketB;
    setSymB(newSym);
    setMarketB(newMkt);
    setSearchQueryB('');
    setShowDropdownB(false);
    fetchBothStocks(symA, marketA, newSym, newMkt);
  };

  const handleAddToWatchlist = (sym: string, mkt: MarketType) => {
    const list = storage.getWatchlist();
    if (!list.some((item) => item.symbol.toUpperCase() === sym.toUpperCase())) {
      storage.saveWatchlist([...list, { symbol: sym, market: mkt }]);
    }
    showToast(`Added ${sym} to Watchlist`);
  };

  const comparativeChartData = useMemo(() => {
    if (!dataA?.df || !dataB?.df) return [];

    const barsA = dataA.df;
    const barsB = dataB.df;

    let sliceCount = 30;
    if (timeRange === '1W') sliceCount = 5;
    else if (timeRange === '1M') sliceCount = 22;
    else if (timeRange === '3M') sliceCount = 66;
    else sliceCount = Math.min(barsA.length, barsB.length);

    const subA = barsA.slice(-sliceCount);
    const subB = barsB.slice(-sliceCount);

    const minLen = Math.min(subA.length, subB.length);
    if (minLen === 0) return [];

    const basePriceA = subA[0].close || 1;
    const basePriceB = subB[0].close || 1;

    const points = [];
    for (let i = 0; i < minLen; i++) {
      const barA = subA[subA.length - minLen + i];
      const barB = subB[subB.length - minLen + i];
      const dateLabel = (barA.date || barB.date || `D${i}`).slice(5);

      const returnA = Number((((barA.close - basePriceA) / basePriceA) * 100).toFixed(2));
      const returnB = Number((((barB.close - basePriceB) / basePriceB) * 100).toFixed(2));

      points.push({
        date: dateLabel,
        [`${dataA.displaySymbol}_Price`]: barA.close,
        [`${dataB.displaySymbol}_Price`]: barB.close,
        [`${dataA.displaySymbol}_Return`]: returnA,
        [`${dataB.displaySymbol}_Return`]: returnB,
        returnDiff: Number((returnA - returnB).toFixed(2)),
      });
    }

    return points;
  }, [dataA, dataB, timeRange]);

  const comparisonVerdict = useMemo(() => {
    if (!dataA || !dataB) return null;

    let scoreA = 0;
    let scoreB = 0;
    const reasons: string[] = [];

    if (dataA.score > dataB.score) {
      scoreA += 2;
      reasons.push(`${dataA.displaySymbol} holds a higher AI quantitative momentum score (${dataA.score > 0 ? '+' : ''}${dataA.score} vs ${dataB.score > 0 ? '+' : ''}${dataB.score}).`);
    } else if (dataB.score > dataA.score) {
      scoreB += 2;
      reasons.push(`${dataB.displaySymbol} holds a higher AI quantitative momentum score (${dataB.score > 0 ? '+' : ''}${dataB.score} vs ${dataA.score > 0 ? '+' : ''}${dataA.score}).`);
    }

    const sma50A = dataA.df[dataA.df.length - 1]?.sma50;
    const sma50B = dataB.df[dataB.df.length - 1]?.sma50;
    const isAboveA = sma50A ? dataA.latestPrice > sma50A : false;
    const isAboveB = sma50B ? dataB.latestPrice > sma50B : false;
    if (isAboveA && !isAboveB) {
      scoreA += 1;
      reasons.push(`${dataA.displaySymbol} is trading above its 50-day moving average baseline, showing healthier technical trend alignment.`);
    } else if (isAboveB && !isAboveA) {
      scoreB += 1;
      reasons.push(`${dataB.displaySymbol} is trading above its 50-day moving average baseline, showing healthier technical trend alignment.`);
    }

    if (dataA.risk.annual_volatility_pct < dataB.risk.annual_volatility_pct) {
      scoreA += 1;
      reasons.push(`${dataA.displaySymbol} exhibits lower annualized volatility (${dataA.risk.annual_volatility_pct}% vs ${dataB.risk.annual_volatility_pct}%), offering a calmer profile.`);
    } else {
      scoreB += 1;
      reasons.push(`${dataB.displaySymbol} exhibits lower annualized volatility (${dataB.risk.annual_volatility_pct}% vs ${dataA.risk.annual_volatility_pct}%), offering a calmer profile.`);
    }

    if (dataA.risk.max_drawdown_pct < dataB.risk.max_drawdown_pct) {
      scoreA += 1;
      reasons.push(`${dataA.displaySymbol} has experienced less historical drawdown risk (${dataA.risk.max_drawdown_pct}% vs ${dataB.risk.max_drawdown_pct}%).`);
    } else {
      scoreB += 1;
      reasons.push(`${dataB.displaySymbol} has experienced less historical drawdown risk (${dataB.risk.max_drawdown_pct}% vs ${dataA.risk.max_drawdown_pct}%).`);
    }

    const fA = dataA.forecast7d?.[dataA.forecast7d.length - 1];
    const fB = dataB.forecast7d?.[dataB.forecast7d.length - 1];
    const expChgA = fA ? ((fA - dataA.latestPrice) / dataA.latestPrice) * 100 : 0;
    const expChgB = fB ? ((fB - dataB.latestPrice) / dataB.latestPrice) * 100 : 0;

    if (expChgA > expChgB) {
      scoreA += 1;
      reasons.push(`${dataA.displaySymbol} model projects stronger 7-day upside (${expChgA > 0 ? '+' : ''}${expChgA.toFixed(1)}% vs ${expChgB > 0 ? '+' : ''}${expChgB.toFixed(1)}%).`);
    } else if (expChgB > expChgA) {
      scoreB += 1;
      reasons.push(`${dataB.displaySymbol} model projects stronger 7-day upside (${expChgB > 0 ? '+' : ''}${expChgB.toFixed(1)}% vs ${expChgA > 0 ? '+' : ''}${expChgA.toFixed(1)}%).`);
    }

    const leader = scoreA > scoreB ? dataA.displaySymbol : scoreB > scoreA ? dataB.displaySymbol : 'Tied / Neutral';
    const leaderData = scoreA > scoreB ? dataA : scoreB > scoreA ? dataB : null;

    return { leader, scoreA, scoreB, reasons, leaderData };
  }, [dataA, dataB]);

  const isLoadingBoth = loadingA || loadingB;

  return (
    <div className="space-y-6">
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 text-xs font-bold animate-bounce border border-emerald-400">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMsg}</span>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/20">
              <ArrowLeftRight className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                Side-by-Side Stock Split-View
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30">
                  Dual Live Feed
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Simultaneously compare price momentum, technical indicators, valuation ratios, and AI predictive signals.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => fetchBothStocks()}
            disabled={isLoadingBoth}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 active:scale-95 text-white shadow-sm transition-all disabled:opacity-50 cursor-pointer"
            title="Refresh market data for both stocks simultaneously"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingBoth ? 'animate-spin' : ''}`} />
            <span>Sync Both Stocks</span>
          </button>

          <button
            onClick={handleSwap}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 transition-all active:scale-95 cursor-pointer"
            title="Swap Left and Right stocks"
          >
            <ArrowLeftRight className="w-3.5 h-3.5 text-cyan-500" />
            <span>Swap Sides</span>
          </button>
        </div>
      </div>

      <div className="bg-slate-50 dark:bg-slate-900/60 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 flex items-center gap-2 overflow-x-auto custom-scrollbar">
        <span className="text-[11px] font-black uppercase text-slate-500 tracking-wider flex items-center gap-1 whitespace-nowrap pl-1">
          <Zap className="w-3.5 h-3.5 text-amber-500" /> Quick Matchups:
        </span>
        <div className="flex items-center gap-1.5">
          {PRESET_PAIRS.map((pair) => {
            const isMatch =
              (symA === pair.a.symbol && symB === pair.b.symbol) ||
              (symA === pair.b.symbol && symB === pair.a.symbol);
            return (
              <button
                key={pair.label}
                type="button"
                onClick={() => handleSelectPreset(pair)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                  isMatch
                    ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-sm shadow-blue-500/20'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700/80'
                }`}
              >
                <span>{pair.label}</span>
                <span className={`text-[9px] px-1 py-0.2 rounded font-medium ${isMatch ? 'bg-black/20 text-white' : 'text-slate-400 dark:text-slate-400 bg-slate-100 dark:bg-slate-900/60'}`}>
                  {pair.tag}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-cyan-500/30 p-4 sm:p-5 shadow-sm space-y-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 to-blue-500" />

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-cyan-600 dark:text-cyan-400 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
                Stock A (Left Focus)
              </span>

              <div className="flex items-center gap-1">
                {(['NSE', 'BSE', 'US'] as MarketType[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setMarketA(m);
                      fetchBothStocks(symA, m, symB, marketB);
                    }}
                    className={`px-2 py-0.5 rounded text-[10px] font-extrabold cursor-pointer transition-colors ${
                      marketA === m
                        ? 'bg-cyan-500 text-slate-950 font-black'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="relative flex items-center">
                <Search className="w-3.5 h-3.5 absolute left-3 text-slate-400" />
                <input
                  type="text"
                  value={searchQueryA}
                  onChange={(e) => {
                    setSearchQueryA(e.target.value);
                    setShowDropdownA(true);
                  }}
                  onFocus={() => setShowDropdownA(true)}
                  placeholder={`Search Stock A (Current: ${symA})...`}
                  className="w-full bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-white font-semibold pl-8 pr-8 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
                {searchQueryA && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQueryA('');
                      setShowDropdownA(false);
                    }}
                    className="absolute right-2.5 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {showDropdownA && suggestionsA.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white dark:bg-slate-900 border border-cyan-500/50 rounded-xl shadow-2xl divide-y divide-slate-100 dark:divide-slate-800 max-h-52 overflow-y-auto">
                  {suggestionsA.map((res, idx) => (
                    <button
                      key={`a-${res.symbol}-${idx}`}
                      type="button"
                      onClick={() => handleSelectA(res)}
                      className="w-full px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800/80 flex items-center justify-between text-xs cursor-pointer"
                    >
                      <div>
                        <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white">
                          <span>{res.displaySymbol}</span>
                          <span className="text-[9px] px-1 rounded bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 font-mono">
                            {res.market}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[200px] block">
                          {res.longName}
                        </span>
                      </div>
                      <span className="text-[10px] text-cyan-600 dark:text-cyan-400 font-bold">Select</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {loadingA ? (
            <div className="h-32 flex flex-col items-center justify-center gap-2 text-slate-400 text-xs">
              <RefreshCw className="w-5 h-5 animate-spin text-cyan-500" />
              <span>Fetching live market quote for {symA}...</span>
            </div>
          ) : errorA ? (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <AlertTriangle className="w-4 h-4" />
                <span>Error Loading {symA}</span>
              </div>
              <p>{errorA}</p>
              <button
                onClick={() => fetchBothStocks(symA, marketA, symB, marketB)}
                className="mt-2 px-2.5 py-1 rounded-md bg-rose-600 text-white text-[10px] font-bold"
              >
                Retry
              </button>
            </div>
          ) : dataA ? (
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                      {dataA.displaySymbol}
                    </h3>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30">
                      {dataA.market}
                    </span>
                  </div>
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium block truncate max-w-[280px]">
                    {dataA.info?.longName || dataA.displaySymbol}
                  </span>
                </div>

                <div className="text-right">
                  <div className="text-2xl font-black text-slate-900 dark:text-white">
                    {dataA.currencyFmt(dataA.latestPrice)}
                  </div>
                  <div
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${
                      dataA.change >= 0
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                        : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {dataA.change >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    <span>
                      {dataA.change >= 0 ? '+' : ''}
                      {dataA.change} ({dataA.changePct >= 0 ? '+' : ''}
                      {dataA.changePct}%)
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                    AI Signal
                  </span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-black ${
                        dataA.signal === 'BUY'
                          ? 'bg-emerald-500 text-white'
                          : dataA.signal === 'SELL'
                          ? 'bg-rose-500 text-white'
                          : 'bg-amber-500 text-white'
                      }`}
                    >
                      {dataA.signal}
                    </span>
                    <span className="text-slate-500 text-[11px] font-bold">
                      Score: {dataA.score > 0 ? '+' : ''}{dataA.score}/100
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                    52-Week Range
                  </span>
                  <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 mt-0.5">
                    {dataA.currencyFmt(dataA.info?.fiftyTwoWeekLow)} — {dataA.currencyFmt(dataA.info?.fiftyTwoWeekHigh)}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                {onSelectStock && (
                  <button
                    type="button"
                    onClick={() => onSelectStock(dataA.displaySymbol, dataA.market)}
                    className="flex-1 py-1.5 px-2.5 rounded-lg text-xs font-bold bg-cyan-600 hover:bg-cyan-700 text-white transition-colors text-center cursor-pointer"
                  >
                    Load in Main Dashboard
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleAddToWatchlist(dataA.displaySymbol, dataA.market)}
                  className="py-1.5 px-2.5 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors flex items-center gap-1 cursor-pointer"
                  title="Add to Watchlist"
                >
                  <Star className="w-3.5 h-3.5 text-amber-500" />
                  <span>Watch</span>
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-indigo-500/30 p-4 sm:p-5 shadow-sm space-y-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-purple-500" />

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                Stock B (Right Compare)
              </span>

              <div className="flex items-center gap-1">
                {(['NSE', 'BSE', 'US'] as MarketType[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setMarketB(m);
                      fetchBothStocks(symA, marketA, symB, m);
                    }}
                    className={`px-2 py-0.5 rounded text-[10px] font-extrabold cursor-pointer transition-colors ${
                      marketB === m
                        ? 'bg-indigo-500 text-white font-black'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="relative flex items-center">
                <Search className="w-3.5 h-3.5 absolute left-3 text-slate-400" />
                <input
                  type="text"
                  value={searchQueryB}
                  onChange={(e) => {
                    setSearchQueryB(e.target.value);
                    setShowDropdownB(true);
                  }}
                  onFocus={() => setShowDropdownB(true)}
                  placeholder={`Search Stock B (Current: ${symB})...`}
                  className="w-full bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-white font-semibold pl-8 pr-8 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                {searchQueryB && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQueryB('');
                      setShowDropdownB(false);
                    }}
                    className="absolute right-2.5 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {showDropdownB && suggestionsB.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white dark:bg-slate-900 border border-indigo-500/50 rounded-xl shadow-2xl divide-y divide-slate-100 dark:divide-slate-800 max-h-52 overflow-y-auto">
                  {suggestionsB.map((res, idx) => (
                    <button
                      key={`b-${res.symbol}-${idx}`}
                      type="button"
                      onClick={() => handleSelectB(res)}
                      className="w-full px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800/80 flex items-center justify-between text-xs cursor-pointer"
                    >
                      <div>
                        <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white">
                          <span>{res.displaySymbol}</span>
                          <span className="text-[9px] px-1 rounded bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-mono">
                            {res.market}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[200px] block">
                          {res.longName}
                        </span>
                      </div>
                      <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold">Select</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {loadingB ? (
            <div className="h-32 flex flex-col items-center justify-center gap-2 text-slate-400 text-xs">
              <RefreshCw className="w-5 h-5 animate-spin text-indigo-500" />
              <span>Fetching live market quote for {symB}...</span>
            </div>
          ) : errorB ? (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <AlertTriangle className="w-4 h-4" />
                <span>Error Loading {symB}</span>
              </div>
              <p>{errorB}</p>
              <button
                onClick={() => fetchBothStocks(symA, marketA, symB, marketB)}
                className="mt-2 px-2.5 py-1 rounded-md bg-rose-600 text-white text-[10px] font-bold"
              >
                Retry
              </button>
            </div>
          ) : dataB ? (
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                      {dataB.displaySymbol}
                    </h3>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30">
                      {dataB.market}
                    </span>
                  </div>
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium block truncate max-w-[280px]">
                    {dataB.info?.longName || dataB.displaySymbol}
                  </span>
                </div>

                <div className="text-right">
                  <div className="text-2xl font-black text-slate-900 dark:text-white">
                    {dataB.currencyFmt(dataB.latestPrice)}
                  </div>
                  <div
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${
                      dataB.change >= 0
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                        : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {dataB.change >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    <span>
                      {dataB.change >= 0 ? '+' : ''}
                      {dataB.change} ({dataB.changePct >= 0 ? '+' : ''}
                      {dataB.changePct}%)
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                    AI Signal
                  </span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-black ${
                        dataB.signal === 'BUY'
                          ? 'bg-emerald-500 text-white'
                          : dataB.signal === 'SELL'
                          ? 'bg-rose-500 text-white'
                          : 'bg-amber-500 text-white'
                      }`}
                    >
                      {dataB.signal}
                    </span>
                    <span className="text-slate-500 text-[11px] font-bold">
                      Score: {dataB.score > 0 ? '+' : ''}{dataB.score}/100
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                    52-Week Range
                  </span>
                  <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 mt-0.5">
                    {dataB.currencyFmt(dataB.info?.fiftyTwoWeekLow)} — {dataB.currencyFmt(dataB.info?.fiftyTwoWeekHigh)}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                {onSelectStock && (
                  <button
                    type="button"
                    onClick={() => onSelectStock(dataB.displaySymbol, dataB.market)}
                    className="flex-1 py-1.5 px-2.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors text-center cursor-pointer"
                  >
                    Load in Main Dashboard
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleAddToWatchlist(dataB.displaySymbol, dataB.market)}
                  className="py-1.5 px-2.5 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors flex items-center gap-1 cursor-pointer"
                  title="Add to Watchlist"
                >
                  <Star className="w-3.5 h-3.5 text-amber-500" />
                  <span>Watch</span>
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-500" />
              Comparative Performance Trend
            </h3>
            <p className="text-xs text-slate-500">
              {chartMode === 'percent'
                ? 'Normalized percentage return (%) starting from zero at the beginning of the period.'
                : 'Raw price progression on synchronized dual curves.'}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => setChartMode('percent')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  chartMode === 'percent'
                    ? 'bg-white dark:bg-slate-700 text-cyan-600 dark:text-cyan-300 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Normalized Return (%)
              </button>
              <button
                type="button"
                onClick={() => setChartMode('price')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  chartMode === 'price'
                    ? 'bg-white dark:bg-slate-700 text-cyan-600 dark:text-cyan-300 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Raw Price
              </button>
            </div>

            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold">
              {(['1W', '1M', '3M', 'ALL'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setTimeRange(r)}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    timeRange === r
                      ? 'bg-cyan-500 text-slate-950 font-black shadow-sm'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        </div>

        {comparativeChartData.length > 0 && dataA && dataB ? (
          <div className="h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={comparativeChartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#334155' : '#f1f5f9'} />
                <XAxis
                  dataKey="date"
                  stroke={isDark ? '#94a3b8' : '#64748b'}
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  stroke={isDark ? '#94a3b8' : '#64748b'}
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => (chartMode === 'percent' ? `${v}%` : String(v))}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: isDark ? '#0f172a' : '#ffffff',
                    borderColor: isDark ? '#334155' : '#e2e8f0',
                    borderRadius: '0.75rem',
                    fontSize: '11px',
                  }}
                  formatter={(value: any, name: any) => [
                    chartMode === 'percent' ? `${value}%` : Number(value).toLocaleString(),
                    String(name).replace('_Return', '').replace('_Price', ''),
                  ]}
                />
                <Legend
                  wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                  formatter={(value) => String(value).replace('_Return', '').replace('_Price', '')}
                />
                <Line
                  type="monotone"
                  dataKey={chartMode === 'percent' ? `${dataA.displaySymbol}_Return` : `${dataA.displaySymbol}_Price`}
                  name={dataA.displaySymbol}
                  stroke="#06b6d4"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey={chartMode === 'percent' ? `${dataB.displaySymbol}_Return` : `${dataB.displaySymbol}_Price`}
                  name={dataB.displaySymbol}
                  stroke="#8b5cf6"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-48 flex items-center justify-center text-slate-400 text-xs">
            {isLoadingBoth ? 'Synchronizing chart data...' : 'Waiting for both stocks to load.'}
          </div>
        )}
      </div>

      {dataA && dataB && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Sliders className="w-4 h-4 text-cyan-500" />
                Head-to-Head Metrics Breakdown
              </h3>
              <p className="text-xs text-slate-500">
                Direct side-by-side evaluation with automatic leader highlights.
              </p>
            </div>
            <span className="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">
              Green highlight = Edge
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-4 w-1/3">Metric / Indicator</th>
                  <th className="py-3 px-4 w-1/3 text-cyan-600 dark:text-cyan-400 font-extrabold text-center">
                    {dataA.displaySymbol}
                  </th>
                  <th className="py-3 px-4 w-1/3 text-indigo-600 dark:text-indigo-400 font-extrabold text-center">
                    {dataB.displaySymbol}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                  <td className="py-2.5 px-4 font-semibold text-slate-700 dark:text-slate-300">Latest Live Price</td>
                  <td className="py-2.5 px-4 font-bold text-center text-slate-900 dark:text-white font-mono">
                    {dataA.currencyFmt(dataA.latestPrice)}
                  </td>
                  <td className="py-2.5 px-4 font-bold text-center text-slate-900 dark:text-white font-mono">
                    {dataB.currencyFmt(dataB.latestPrice)}
                  </td>
                </tr>

                <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                  <td className="py-2.5 px-4 font-semibold text-slate-700 dark:text-slate-300">Today's Session Change</td>
                  <td className={`py-2.5 px-4 font-bold text-center font-mono ${dataA.changePct > dataB.changePct ? 'text-emerald-500 bg-emerald-500/10 rounded-lg' : 'text-slate-700 dark:text-slate-300'}`}>
                    {dataA.changePct >= 0 ? '+' : ''}{dataA.changePct}%
                  </td>
                  <td className={`py-2.5 px-4 font-bold text-center font-mono ${dataB.changePct > dataA.changePct ? 'text-emerald-500 bg-emerald-500/10 rounded-lg' : 'text-slate-700 dark:text-slate-300'}`}>
                    {dataB.changePct >= 0 ? '+' : ''}{dataB.changePct}%
                  </td>
                </tr>

                <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                  <td className="py-2.5 px-4 font-semibold text-slate-700 dark:text-slate-300">AI Quantitative Signal</td>
                  <td className={`py-2.5 px-4 font-bold text-center ${dataA.score > dataB.score ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : ''}`}>
                    <span className="font-extrabold">{dataA.signal}</span> ({dataA.score > 0 ? '+' : ''}{dataA.score}/100)
                  </td>
                  <td className={`py-2.5 px-4 font-bold text-center ${dataB.score > dataA.score ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : ''}`}>
                    <span className="font-extrabold">{dataB.signal}</span> ({dataB.score > 0 ? '+' : ''}{dataB.score}/100)
                  </td>
                </tr>

                <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                  <td className="py-2.5 px-4 font-semibold text-slate-700 dark:text-slate-300">Model Confidence</td>
                  <td className={`py-2.5 px-4 font-bold text-center font-mono ${dataA.confidence > dataB.confidence ? 'text-emerald-500 bg-emerald-500/10' : ''}`}>
                    {dataA.confidence}%
                  </td>
                  <td className={`py-2.5 px-4 font-bold text-center font-mono ${dataB.confidence > dataA.confidence ? 'text-emerald-500 bg-emerald-500/10' : ''}`}>
                    {dataB.confidence}%
                  </td>
                </tr>

                {(() => {
                  const rsiA = dataA.df[dataA.df.length - 1]?.rsi14 || 50;
                  const rsiB = dataB.df[dataB.df.length - 1]?.rsi14 || 50;
                  return (
                    <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-4 font-semibold text-slate-700 dark:text-slate-300">RSI (14) Momentum</td>
                      <td className="py-2.5 px-4 font-bold text-center font-mono">
                        {rsiA.toFixed(1)}{' '}
                        <span className="text-[10px] text-slate-400 font-normal">
                          ({rsiA > 70 ? 'Overbought' : rsiA < 30 ? 'Oversold' : 'Neutral'})
                        </span>
                      </td>
                      <td className="py-2.5 px-4 font-bold text-center font-mono">
                        {rsiB.toFixed(1)}{' '}
                        <span className="text-[10px] text-slate-400 font-normal">
                          ({rsiB > 70 ? 'Overbought' : rsiB < 30 ? 'Oversold' : 'Neutral'})
                        </span>
                      </td>
                    </tr>
                  );
                })()}

                {(() => {
                  const smaA = dataA.df[dataA.df.length - 1]?.sma50;
                  const smaB = dataB.df[dataB.df.length - 1]?.sma50;
                  const diffA = smaA ? Number((((dataA.latestPrice - smaA) / smaA) * 100).toFixed(1)) : 0;
                  const diffB = smaB ? Number((((dataB.latestPrice - smaB) / smaB) * 100).toFixed(1)) : 0;
                  return (
                    <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-4 font-semibold text-slate-700 dark:text-slate-300">MA-50 Trend Alignment</td>
                      <td className={`py-2.5 px-4 font-bold text-center ${diffA > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {diffA > 0 ? `Above (+${diffA}%)` : `Below (${diffA}%)`}
                      </td>
                      <td className={`py-2.5 px-4 font-bold text-center ${diffB > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {diffB > 0 ? `Above (+${diffB}%)` : `Below (${diffB}%)`}
                      </td>
                    </tr>
                  );
                })()}

                <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                  <td className="py-2.5 px-4 font-semibold text-slate-700 dark:text-slate-300">Annualized Volatility (Risk)</td>
                  <td className={`py-2.5 px-4 font-bold text-center font-mono ${dataA.risk.annual_volatility_pct < dataB.risk.annual_volatility_pct ? 'text-emerald-500 bg-emerald-500/10' : ''}`}>
                    {dataA.risk.annual_volatility_pct}% ({dataA.risk.risk_label})
                  </td>
                  <td className={`py-2.5 px-4 font-bold text-center font-mono ${dataB.risk.annual_volatility_pct < dataA.risk.annual_volatility_pct ? 'text-emerald-500 bg-emerald-500/10' : ''}`}>
                    {dataB.risk.annual_volatility_pct}% ({dataB.risk.risk_label})
                  </td>
                </tr>

                <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                  <td className="py-2.5 px-4 font-semibold text-slate-700 dark:text-slate-300">Max Historical Drawdown</td>
                  <td className={`py-2.5 px-4 font-bold text-center font-mono ${dataA.risk.max_drawdown_pct < dataB.risk.max_drawdown_pct ? 'text-emerald-500 bg-emerald-500/10' : ''}`}>
                    -{dataA.risk.max_drawdown_pct}%
                  </td>
                  <td className={`py-2.5 px-4 font-bold text-center font-mono ${dataB.risk.max_drawdown_pct < dataA.risk.max_drawdown_pct ? 'text-emerald-500 bg-emerald-500/10' : ''}`}>
                    -{dataB.risk.max_drawdown_pct}%
                  </td>
                </tr>

                <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                  <td className="py-2.5 px-4 font-semibold text-slate-700 dark:text-slate-300">Beta (Market Sensitivity)</td>
                  <td className="py-2.5 px-4 font-bold text-center font-mono text-slate-800 dark:text-slate-200">
                    {dataA.risk.beta}
                  </td>
                  <td className="py-2.5 px-4 font-bold text-center font-mono text-slate-800 dark:text-slate-200">
                    {dataB.risk.beta}
                  </td>
                </tr>

                <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                  <td className="py-2.5 px-4 font-semibold text-slate-700 dark:text-slate-300">Trailing P/E Ratio</td>
                  <td className="py-2.5 px-4 font-bold text-center font-mono text-slate-800 dark:text-slate-200">
                    {dataA.info?.trailingPE ? dataA.info.trailingPE.toFixed(2) : '—'}
                  </td>
                  <td className="py-2.5 px-4 font-bold text-center font-mono text-slate-800 dark:text-slate-200">
                    {dataB.info?.trailingPE ? dataB.info.trailingPE.toFixed(2) : '—'}
                  </td>
                </tr>

                <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                  <td className="py-2.5 px-4 font-semibold text-slate-700 dark:text-slate-300">Dividend Yield</td>
                  <td className="py-2.5 px-4 font-bold text-center font-mono text-slate-800 dark:text-slate-200">
                    {dataA.info?.dividendYield ? `${(dataA.info.dividendYield * 100).toFixed(2)}%` : '—'}
                  </td>
                  <td className="py-2.5 px-4 font-bold text-center font-mono text-slate-800 dark:text-slate-200">
                    {dataB.info?.dividendYield ? `${(dataB.info.dividendYield * 100).toFixed(2)}%` : '—'}
                  </td>
                </tr>

                {(() => {
                  const targetA = dataA.forecast7d?.[dataA.forecast7d.length - 1];
                  const targetB = dataB.forecast7d?.[dataB.forecast7d.length - 1];
                  const pA = targetA ? ((targetA - dataA.latestPrice) / dataA.latestPrice) * 100 : 0;
                  const pB = targetB ? ((targetB - dataB.latestPrice) / dataB.latestPrice) * 100 : 0;
                  return (
                    <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-4 font-semibold text-slate-700 dark:text-slate-300">7-Day Projected Move</td>
                      <td className={`py-2.5 px-4 font-bold text-center font-mono ${pA > pB ? 'text-emerald-500 bg-emerald-500/10' : ''}`}>
                        {targetA ? `${dataA.currencyFmt(targetA)} (${pA > 0 ? '+' : ''}${pA.toFixed(1)}%)` : '—'}
                      </td>
                      <td className={`py-2.5 px-4 font-bold text-center font-mono ${pB > pA ? 'text-emerald-500 bg-emerald-500/10' : ''}`}>
                        {targetB ? `${dataB.currencyFmt(targetB)} (${pB > 0 ? '+' : ''}${pB.toFixed(1)}%)` : '—'}
                      </td>
                    </tr>
                  );
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {comparisonVerdict && (
        <div className="bg-gradient-to-br from-slate-900 to-[#0e2138] text-white p-5 rounded-2xl border border-cyan-500/40 shadow-lg space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-black uppercase tracking-wider text-cyan-400 flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-400" />
              Quantitative Comparison Verdict
            </h4>
            <span className="text-xs px-2.5 py-1 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 font-bold">
              Edge Leader: {comparisonVerdict.leader}
            </span>
          </div>

          <div className="space-y-2 text-xs text-slate-300 leading-relaxed">
            {comparisonVerdict.reasons.map((reason, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                <span>{reason}</span>
              </div>
            ))}
          </div>

          <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400">
            Comparative analysis is calculated from simultaneously fetched live market bars, technical momentum (RSI/MACD), moving-average alignment, and multi-day predictive models.
          </div>
        </div>
      )}
    </div>
  );
};

export default StockSplitView;
