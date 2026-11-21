import React, { useEffect, useRef, useState } from 'react';
import { Search, FileSpreadsheet, X } from 'lucide-react';
import { AnalysisResult, MarketType } from '../types';
import { StockSearchResult } from '../utils/marketData';
import { searchStocksApi } from '../utils/stockApi';
import { QuarterlyResultsPanel } from '../components/QuarterlyResultsPanel';

interface QuarterlyResultsPageProps {
  data: AnalysisResult;
  onSelectStock?: (symbol: string, market: MarketType) => void;
}

const POPULAR_QUARTERLY_STOCKS: Array<{ symbol: string; market: MarketType }> = [
  { symbol: 'RELIANCE', market: 'NSE' },
  { symbol: 'TCS', market: 'NSE' },
  { symbol: 'HDFCBANK', market: 'NSE' },
  { symbol: 'INFY', market: 'NSE' },
  { symbol: 'ICICIBANK', market: 'NSE' },
  { symbol: 'ITC', market: 'NSE' },
  { symbol: 'AAPL', market: 'US' },
  { symbol: 'NVDA', market: 'US' },
];

export const QuarterlyResultsPage: React.FC<QuarterlyResultsPageProps> = ({ data, onSelectStock }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<StockSearchResult[]>([]);
  const [openDropdown, setOpenDropdown] = useState(false);

  const searchRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setOpenDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const handleQueryChange = (val: string) => {
    setQuery(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    const clean = val.trim();
    if (!clean) {
      setResults([]);
      setOpenDropdown(false);
      return;
    }
    setOpenDropdown(true);
    timerRef.current = setTimeout(async () => {
      const list = await searchStocksApi(clean);
      setResults(list);
    }, 180);
  };

  const selectStock = (sym: string, mkt: MarketType) => {
    setQuery('');
    setResults([]);
    setOpenDropdown(false);
    if (onSelectStock) onSelectStock(sym, mkt);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = query.trim().toUpperCase();
    if (!clean) return;
    if (results.length > 0) {
      selectStock(results[0].displaySymbol, results[0].market);
    } else {
      selectStock(clean, data.market);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
                All-Stocks Quarterly Results Explorer
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Inspect quarterly Revenue, Operating Profit, Net Income, YoY/QoQ growth, and Diluted EPS across NSE, BSE, and US stocks.
              </p>
            </div>
          </div>

          <div ref={searchRef} className="relative w-full md:w-80">
            <form onSubmit={handleSubmit} className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => handleQueryChange(e.target.value)}
                  onFocus={() => query.trim() && setOpenDropdown(true)}
                  placeholder="Check any stock results (e.g. TCS, AAPL)..."
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
                    aria-label="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <button
                type="submit"
                className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors"
              >
                Load
              </button>
            </form>

            {openDropdown && results.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1.5 z-40 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                {results.map((item, idx) => (
                  <button
                    key={`${item.market}-${item.symbol}-${idx}`}
                    type="button"
                    onClick={() => selectStock(item.displaySymbol, item.market)}
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

        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mr-1">Popular Filings:</span>
          {POPULAR_QUARTERLY_STOCKS.map((stk) => {
            const active = data.displaySymbol.toUpperCase() === stk.symbol && data.market === stk.market;
            return (
              <button
                key={`${stk.market}-${stk.symbol}`}
                type="button"
                onClick={() => selectStock(stk.symbol, stk.market)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                  active
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

      <QuarterlyResultsPanel data={data} />
    </div>
  );
};

export default QuarterlyResultsPage;
