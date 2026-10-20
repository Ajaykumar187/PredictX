import React, { useEffect, useRef, useState } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { MarketType } from '../types';
import { StockSearchResult } from '../utils/marketData';
import { searchStocksApi } from '../utils/stockApi';

interface EmptyStateProps {
  isLoading: boolean;
  errorMessage?: string | null;
  onLoadStock: (symbol: string, market: MarketType) => void;
  title?: string;
}

const MARKETS: { id: MarketType; label: string }[] = [
  { id: 'NSE', label: 'NSE' },
  { id: 'BSE', label: 'BSE' },
  { id: 'US', label: 'US' },
];

export const EmptyState: React.FC<EmptyStateProps> = ({
  isLoading,
  errorMessage,
  onLoadStock,
  title = 'Koi stock search karein',
}) => {
  const [market, setMarket] = useState<MarketType>('NSE');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<StockSearchResult[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (!query.trim()) {
      setResults([]);
      return;
    }
    timer.current = setTimeout(async () => {
      try {
        const r = await searchStocksApi(query);
        setResults((r || []).slice(0, 6));
      } catch {
        setResults([]);
      }
    }, 200);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [query]);

  const submit = (sym: string, m: MarketType = market) => {
    const clean = sym.trim().toUpperCase();
    if (!clean) return;
    onLoadStock(clean, m);
  };

  return (
    <div className="max-w-xl mx-auto mt-6 md:mt-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 md:p-8 shadow-sm">
      <h2 className="text-xl font-extrabold text-slate-900 dark:text-white text-center">{title}</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 text-center mt-1">
        Naam ya symbol likhein, phir analysis aur forecast dekhein.
      </p>

      <div className="flex justify-center gap-1.5 mt-5">
        {MARKETS.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setMarket(m.id)}
            className={`px-3 py-1 rounded-lg text-xs font-bold border transition-colors ${
              market === m.id
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(query);
        }}
        className="relative mt-3"
      >
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Stock ka naam ya symbol..."
          className="w-full pl-10 pr-24 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={isLoading || !query.trim()}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5"
        >
          {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
          Analyze
        </button>
      </form>

      {results.length > 0 && (
        <ul className="mt-2 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
          {results.map((r) => (
            <li key={`${r.market}-${r.symbol}`}>
              <button
                type="button"
                onClick={() => submit(r.displaySymbol || r.symbol, r.market)}
                className="w-full flex items-center justify-between gap-3 px-3.5 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-slate-900 dark:text-white">{r.displaySymbol || r.symbol}</span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400 truncate">{r.longName}</span>
                </span>
                <span className="text-[10px] font-bold text-slate-400">{r.market}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {errorMessage && (
        <p className="mt-3 text-xs text-rose-600 dark:text-rose-400 text-center">{errorMessage}</p>
      )}
    </div>
  );
};

export default EmptyState;
