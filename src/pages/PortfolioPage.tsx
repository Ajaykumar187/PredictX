import React, { useState, useEffect, useCallback } from 'react';
import { PortfolioHolding, WatchlistItem, MarketType } from '../types';
import { storage } from '../utils/storage';
import { formatCurrencyValue } from '../utils/marketData';
import { fetchBatchStockQuotes } from '../utils/stockApi';
import {
  Briefcase,
  PlusCircle,
  Trash2,
  TrendingUp,
  Activity,
  PieChart,
  ShieldCheck,
  Star,
} from 'lucide-react';

interface PortfolioPageProps {
  onSelectStock: (symbol: string, market: MarketType) => void;
}

export const PortfolioPage: React.FC<PortfolioPageProps> = ({ onSelectStock }) => {
  const [holdings, setHoldings] = useState<PortfolioHolding[]>(storage.getPortfolio());
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>(storage.getWatchlist());
  const [activeTab, setActiveTab] = useState<'Holdings' | 'Insights' | 'Watchlist'>('Holdings');

  const [hMarket, setHMarket] = useState<MarketType>('NSE');
  const [hSymbol, setHSymbol] = useState('INFY');
  const [hQty, setHQty] = useState(10);
  const [hPrice, setHPrice] = useState(1800);

  const [wSymbol, setWSymbol] = useState('');
  const [wMarket, setWMarket] = useState<MarketType>('NSE');

  const [livePrices, setLivePrices] = useState<Record<string, number>>({});
  const keyOf = (sym: string) => sym.toUpperCase().replace('.NS', '').replace('.BO', '').trim();

  const refreshPrices = useCallback(async () => {
    const items = [...holdings, ...watchlist].map((x) => ({ symbol: x.symbol, market: x.market }));
    if (items.length === 0) return;
    const res = await fetchBatchStockQuotes(items);
    const next: Record<string, number> = {};
    for (const [k, v] of Object.entries(res)) next[keyOf(k)] = v.price;
    setLivePrices((prev) => ({ ...prev, ...next }));
  }, [holdings, watchlist]);

  useEffect(() => {
    refreshPrices();
    const t = setInterval(refreshPrices, 60000);
    return () => clearInterval(t);
  }, [refreshPrices]);

  const getLivePrice = (sym: string): number | null => livePrices[keyOf(sym)] ?? null;

  const handleAddHolding = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hSymbol.trim()) return;
    const newHolding: PortfolioHolding = {
      id: Date.now().toString(),
      market: hMarket,
      symbol: hSymbol.toUpperCase().trim(),
      quantity: Number(hQty),
      buyPrice: Number(hPrice),
      dateAdded: new Date().toISOString().split('T')[0],
    };
    const updated = [...holdings, newHolding];
    setHoldings(updated);
    storage.savePortfolio(updated);
    setHSymbol('');
  };

  const handleDeleteHolding = (id: string) => {
    const updated = holdings.filter((h) => h.id !== id);
    setHoldings(updated);
    storage.savePortfolio(updated);
  };

  const handleAddWatchlist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!wSymbol.trim()) return;
    const item: WatchlistItem = {
      symbol: wSymbol.toUpperCase().trim(),
      market: wMarket,
    };
    const updated = [...watchlist, item];
    setWatchlist(updated);
    storage.saveWatchlist(updated);
    setWSymbol('');
  };

  const handleRemoveWatchlist = (symbol: string) => {
    const updated = watchlist.filter((w) => w.symbol !== symbol);
    setWatchlist(updated);
    storage.saveWatchlist(updated);
  };

  let totalInvested = 0;
  let totalCurrent = 0;

  const enriched = holdings.map((h) => {
    const livePrice = getLivePrice(h.symbol);
    const invested = h.quantity * h.buyPrice;
    const current = livePrice !== null ? h.quantity * livePrice : invested;
    const pnl = current - invested;
    const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0;
    totalInvested += invested;
    totalCurrent += current;
    return {
      ...h,
      livePrice,
      invested,
      current,
      pnl,
      pnlPct,
    };
  });

  const totalPnL = totalCurrent - totalInvested;
  const totalPnLPct = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex space-x-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        {(['Holdings', 'Insights', 'Watchlist'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === tab
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
            }`}
          >
            {tab === 'Holdings' && '💼 Holdings & P/L'}
            {tab === 'Insights' && '📊 Health Score & Insights'}
            {tab === 'Watchlist' && '⭐ Watchlist'}
          </button>
        ))}
      </div>

      {activeTab === 'Holdings' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-xs font-semibold text-slate-500 uppercase block mb-1">Total Invested</span>
              <span className="text-2xl font-black text-slate-900 dark:text-white">
                ₹{totalInvested.toLocaleString()}
              </span>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-xs font-semibold text-slate-500 uppercase block mb-1">Current Portfolio Value</span>
              <span className="text-2xl font-black text-slate-900 dark:text-white">
                ₹{totalCurrent.toLocaleString()}
              </span>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-xs font-semibold text-slate-500 uppercase block mb-1">Overall P/L</span>
              <div className="flex items-baseline gap-2">
                <span className={`text-2xl font-black ${totalPnL >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {totalPnL >= 0 ? '+' : ''}₹{totalPnL.toLocaleString()}
                </span>
                <span className={`text-xs font-bold ${totalPnLPct >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  ({totalPnLPct >= 0 ? '+' : ''}{totalPnLPct.toFixed(2)}%)
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-3">
              <PlusCircle className="w-4 h-4 text-cyan-500" /> Add Holding to Portfolio
            </h3>
            <form onSubmit={handleAddHolding} className="grid grid-cols-1 sm:grid-cols-5 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-500 block mb-1">Market</label>
                <select
                  value={hMarket}
                  onChange={(e) => setHMarket(e.target.value as MarketType)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-bold"
                >
                  <option value="NSE">NSE</option>
                  <option value="BSE">BSE</option>
                  <option value="US">US</option>
                  <option value="INDEX">INDEX</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-500 block mb-1">Symbol</label>
                <input
                  type="text"
                  value={hSymbol}
                  onChange={(e) => setHSymbol(e.target.value)}
                  placeholder="e.g. INFY"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-bold"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-500 block mb-1">Quantity</label>
                <input
                  type="number"
                  min="1"
                  value={hQty}
                  onChange={(e) => setHQty(Number(e.target.value))}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-bold"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-500 block mb-1">Buy Price</label>
                <input
                  type="number"
                  step="0.01"
                  value={hPrice}
                  onChange={(e) => setHPrice(Number(e.target.value))}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-bold"
                />
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition-colors"
                >
                  Add Holding
                </button>
              </div>
            </form>
          </div>

          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-x-auto">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Holdings Breakdown</h3>
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-bold uppercase text-[10px]">
                <tr>
                  <th className="py-2 px-3">Symbol</th>
                  <th className="py-2 px-3">Market</th>
                  <th className="py-2 px-3">Qty</th>
                  <th className="py-2 px-3">Buy Price</th>
                  <th className="py-2 px-3">Live Price</th>
                  <th className="py-2 px-3">Invested</th>
                  <th className="py-2 px-3">Current</th>
                  <th className="py-2 px-3">P/L (%)</th>
                  <th className="py-2 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {enriched.map((h) => (
                  <tr key={h.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">
                      <button
                        onClick={() => onSelectStock(h.symbol, h.market)}
                        className="hover:text-cyan-500 underline decoration-dotted"
                      >
                        {h.symbol}
                      </button>
                    </td>
                    <td className="py-2.5 px-3 text-slate-500">{h.market}</td>
                    <td className="py-2.5 px-3 font-medium">{h.quantity}</td>
                    <td className="py-2.5 px-3">₹{h.buyPrice.toLocaleString()}</td>
                    <td className="py-2.5 px-3 font-bold">{h.livePrice !== null ? `₹${h.livePrice.toLocaleString()}` : '—'}</td>
                    <td className="py-2.5 px-3 text-slate-500">₹{h.invested.toLocaleString()}</td>
                    <td className="py-2.5 px-3 font-bold">₹{h.current.toLocaleString()}</td>
                    <td className={`py-2.5 px-3 font-bold ${h.pnl >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {h.pnl >= 0 ? '+' : ''}₹{h.pnl.toLocaleString()} ({h.pnlPct.toFixed(2)}%)
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() => handleDeleteHolding(h.id)}
                        className="text-slate-400 hover:text-rose-600 p-1 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'Insights' && (() => {
        if (enriched.length === 0 || totalCurrent <= 0) {
          return (
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm text-sm text-slate-500">
              Portfolio khali hai. Holdings tab mein stocks add karein, phir yahan unka risk analysis dikhega.
            </div>
          );
        }
        const weights = enriched
          .map((h) => ({ symbol: h.symbol, market: h.market, w: (h.current / totalCurrent) * 100 }))
          .sort((x, y) => y.w - x.w);
        const top = weights[0];
        const marketSplit = weights.reduce<Record<string, number>>((acc, x) => {
          acc[x.market] = (acc[x.market] || 0) + x.w;
          return acc;
        }, {});
        let score = 100;
        if (top.w > 25) score -= Math.min(45, (top.w - 25) * 1.2);
        if (weights.length < 5) score -= (5 - weights.length) * 7;
        score = Math.max(0, Math.round(score));
        const label = score >= 75 ? 'Achhi diversification' : score >= 50 ? 'Thodi concentrated' : 'Bahut concentrated';
        const fmt = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
        return (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Diversification score</span>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white">
                {score} / 100 <span className="text-xs font-semibold text-slate-500">({label})</span>
              </h3>
              <p className="text-xs text-slate-500 max-w-xl">
                Sirf do cheezon par: sabse bade stock ka hissa (25% se upar par score ghatta hai) aur kitne stocks hain (5 se kam par ghatta hai). Sector data yahan shamil nahi hai.
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-500" /> Aapke portfolio ke hisaab se
              </h4>
              <ul className="text-xs space-y-2 text-slate-600 dark:text-slate-300">
                <li className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                  • Sabse bada stock <strong>{top.symbol}</strong> portfolio ka <strong>{top.w.toFixed(1)}%</strong> hai.
                  {top.w > 25 ? ' Ek stock par 25% se zyada hona risky ho sakta hai.' : ' Yeh limit ke andar hai.'}
                </li>
                <li className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                  • Kul {weights.length} stock(s). Top 3 milakar {weights.slice(0, 3).reduce((a, x) => a + x.w, 0).toFixed(1)}%.
                </li>
                <li className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                  • Market ke hisaab se: {Object.entries(marketSplit).map(([m, w]) => `${m} ${w.toFixed(0)}%`).join(', ')}.
                </li>
              </ul>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">Agar market girta hai to?</h4>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-slate-400">
                    <th className="py-1.5">Market girawat</th>
                    <th>Portfolio loss (andaza)</th>
                    <th>Bachega</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-200">
                  {[5, 10, 20].map((d) => (
                    <tr key={d}>
                      <td className="py-2">-{d}%</td>
                      <td className="text-rose-600 dark:text-rose-400 font-bold">-{fmt((totalCurrent * d) / 100)}</td>
                      <td>{fmt(totalCurrent * (1 - d / 100))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-[11px] text-slate-500">Maana gaya ki har stock market ke barabar girta hai (beta = 1). Asli mein tez ya dheere gir sakta hai.</p>
            </div>
          </div>
        );
      })()}

      {activeTab === 'Watchlist' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
              <Star className="w-4 h-4 text-amber-500" /> Add to Watchlist
            </h3>
            <form onSubmit={handleAddWatchlist} className="flex gap-3">
              <select
                value={wMarket}
                onChange={(e) => setWMarket(e.target.value as MarketType)}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-bold"
              >
                <option value="NSE">NSE</option>
                <option value="BSE">BSE</option>
                <option value="US">US</option>
                <option value="INDEX">INDEX</option>
              </select>
              <input
                type="text"
                value={wSymbol}
                onChange={(e) => setWSymbol(e.target.value)}
                placeholder="Ticker Symbol (e.g. SBIN)"
                className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-bold"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg"
              >
                Add Symbol
              </button>
            </form>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {watchlist.map((w) => {
              const price = getLivePrice(w.symbol);
              return (
                <div
                  key={w.symbol}
                  className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between"
                >
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 block">{w.market}</span>
                    <button
                      onClick={() => onSelectStock(w.symbol, w.market)}
                      className="font-black text-sm text-slate-900 dark:text-white hover:text-cyan-600"
                    >
                      {w.symbol}
                    </button>
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300 block">
                      {price !== null ? `${w.market === 'US' ? '$' : '₹'}${price.toLocaleString()}` : '—'}
                    </span>
                  </div>
                  <button
                    onClick={() => handleRemoveWatchlist(w.symbol)}
                    className="p-1 text-slate-400 hover:text-rose-600"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
