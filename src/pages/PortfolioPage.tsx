import React, { useState, useEffect, useCallback, useRef } from 'react';
import { PortfolioHolding, WatchlistItem, MarketType, JournalTrade, PaperAccount } from '../types';
import { storage } from '../utils/storage';
import { formatCurrencyValue } from '../utils/marketData';
import { fetchBatchStockQuotes, fetchStockInfo } from '../utils/stockApi';
import {
  PortfolioDailyGainChart,
  PortfolioLiveQuote,
} from '../components/PortfolioDailyGainChart';
import { PortfolioValueTrendChart } from '../components/PortfolioValueTrendChart';
import { PortfolioOverviewCard } from '../components/PortfolioOverviewCard';
import {
  PortfolioSectorDonut,
  resolveHoldingSector,
} from '../components/PortfolioSectorDonut';
import { downloadPortfolioCsv } from '../utils/portfolioExport';
import {
  PlusCircle,
  Trash2,
  ShieldCheck,
  Star,
  RefreshCw,
  Download,
  Check,
} from 'lucide-react';

interface PortfolioPageProps {
  onSelectStock: (symbol: string, market: MarketType) => void;
  theme?: 'Light' | 'Dark';
}

export const PortfolioPage: React.FC<PortfolioPageProps> = ({ onSelectStock, theme }) => {
  const [holdings, setHoldings] = useState<PortfolioHolding[]>(() => storage.getPortfolio());
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>(() => storage.getWatchlist());
  const [journalTrades, setJournalTrades] = useState<JournalTrade[]>(() => storage.getJournalTrades());
  const [paperAccount, setPaperAccount] = useState<PaperAccount>(() => storage.getPaperAccount());
  const [activeTab, setActiveTab] = useState<'Holdings' | 'Insights' | 'Watchlist'>('Holdings');

  const todayIso = new Date().toISOString().split('T')[0];
  const [hMarket, setHMarket] = useState<MarketType>('NSE');
  const [hSymbol, setHSymbol] = useState('');
  const [hQty, setHQty] = useState('');
  const [hPrice, setHPrice] = useState('');
  const [hDate, setHDate] = useState(todayIso);
  const symbolInputRef = useRef<HTMLInputElement | null>(null);

  const [wSymbol, setWSymbol] = useState('');
  const [wMarket, setWMarket] = useState<MarketType>('NSE');

  const [liveQuotes, setLiveQuotes] = useState<Record<string, PortfolioLiveQuote>>({});
  const [sectorMap, setSectorMap] = useState<Record<string, string>>({});
  const [isLoadingSectors, setIsLoadingSectors] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [justExported, setJustExported] = useState(false);
  const exportTimerRef = useRef<number | null>(null);
  const keyOf = (sym: string) => sym.toUpperCase().replace('.NS', '').replace('.BO', '').trim();

  useEffect(() => {
    return () => {
      if (exportTimerRef.current !== null) {
        window.clearTimeout(exportTimerRef.current);
      }
    };
  }, []);

  // Keep recorded journal & paper trades synced if updated elsewhere
  useEffect(() => {
    const syncRecordedTrades = () => {
      setJournalTrades(storage.getJournalTrades());
      setPaperAccount(storage.getPaperAccount());
    };
    window.addEventListener('focus', syncRecordedTrades);
    window.addEventListener('storage', syncRecordedTrades);
    return () => {
      window.removeEventListener('focus', syncRecordedTrades);
      window.removeEventListener('storage', syncRecordedTrades);
    };
  }, []);

  const refreshPrices = useCallback(async () => {
    const uniqueItems = new Map<string, { symbol: string; market: MarketType }>();
    const addCandidate = (symbol: string, market: MarketType = 'NSE') => {
      const k = keyOf(symbol);
      if (k && !uniqueItems.has(k)) {
        uniqueItems.set(k, { symbol: symbol.toUpperCase().trim(), market });
      }
    };

    for (const h of holdings) addCandidate(h.symbol, h.market);
    for (const w of watchlist) addCandidate(w.symbol, w.market);
    for (const jt of journalTrades) addCandidate(jt.symbol, jt.market);
    for (const pt of paperAccount.history || []) addCandidate(pt.symbol, pt.market || 'NSE');

    const items = Array.from(uniqueItems.values());
    if (items.length === 0) return;
    setIsRefreshing(true);
    try {
      const res = await fetchBatchStockQuotes(items);
      const next: Record<string, PortfolioLiveQuote> = {};
      for (const [k, v] of Object.entries(res)) {
        next[keyOf(k)] = {
          price: v.price,
          change: Number.isFinite(v.change) ? v.change : 0,
          changePct: Number.isFinite(v.changePct) ? v.changePct : 0,
          bars: Array.isArray(v.bars) ? v.bars : [],
        };
      }
      setLiveQuotes((prev) => ({ ...prev, ...next }));
    } finally {
      setIsRefreshing(false);
    }
  }, [holdings, watchlist, journalTrades, paperAccount]);

  useEffect(() => {
    refreshPrices();
    const t = setInterval(refreshPrices, 60000);
    return () => clearInterval(t);
  }, [refreshPrices]);

  useEffect(() => {
    const missing = holdings.filter((h) => !sectorMap[keyOf(h.symbol)]);
    if (missing.length === 0) return;

    let cancelled = false;
    setIsLoadingSectors(true);

    Promise.all(
      missing.map(async (h) => {
        const k = keyOf(h.symbol);
        try {
          const info = await fetchStockInfo(h.symbol, h.market);
          return [k, resolveHoldingSector(h.symbol, h.market, info?.sector)] as const;
        } catch {
          return [k, resolveHoldingSector(h.symbol, h.market)] as const;
        }
      })
    )
      .then((entries) => {
        if (cancelled) return;
        setSectorMap((prev) => {
          const next = { ...prev };
          for (const [k, sec] of entries) {
            next[k] = sec;
          }
          return next;
        });
      })
      .finally(() => {
        if (!cancelled) setIsLoadingSectors(false);
      });

    return () => {
      cancelled = true;
    };
  }, [holdings]);

  const getLiveQuote = (sym: string): PortfolioLiveQuote | null => liveQuotes[keyOf(sym)] ?? null;
  const getLivePrice = (sym: string): number | null => getLiveQuote(sym)?.price ?? null;

  const handleAddHolding = (e: React.FormEvent) => {
    e.preventDefault();
    const qtyNum = Number(hQty);
    const priceNum = Number(hPrice);
    if (!hSymbol.trim() || !Number.isFinite(qtyNum) || qtyNum <= 0 || !Number.isFinite(priceNum) || priceNum <= 0) {
      return;
    }
    const newHolding: PortfolioHolding = {
      id: Date.now().toString(),
      market: hMarket,
      symbol: hSymbol.toUpperCase().trim(),
      quantity: qtyNum,
      buyPrice: priceNum,
      dateAdded: hDate || new Date().toISOString().split('T')[0],
    };
    const updated = [...holdings, newHolding];
    setHoldings(updated);
    storage.savePortfolio(updated);
    setHSymbol('');
    setHQty('');
    setHPrice('');
    setHDate(new Date().toISOString().split('T')[0]);
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
  let totalTodayGain = 0;
  let totalPrevValue = 0;
  let hasLiveDayData = false;

  const enriched = holdings.map((h) => {
    const quote = getLiveQuote(h.symbol);
    const livePrice = quote ? quote.price : null;
    const invested = h.quantity * h.buyPrice;
    const current = livePrice !== null ? h.quantity * livePrice : invested;
    const pnl = current - invested;
    const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0;

    const todayGain = quote ? h.quantity * quote.change : null;
    const todayGainPct = quote ? quote.changePct : null;
    const prevClose = quote ? quote.price - quote.change : null;
    const prevValue = prevClose !== null && prevClose > 0 ? h.quantity * prevClose : current;

    totalInvested += invested;
    totalCurrent += current;
    if (todayGain !== null) {
      totalTodayGain += todayGain;
      totalPrevValue += prevValue;
      hasLiveDayData = true;
    }

    return {
      ...h,
      livePrice,
      invested,
      current,
      pnl,
      pnlPct,
      todayGain,
      todayGainPct,
    };
  });

  const totalPnL = totalCurrent - totalInvested;
  const totalPnLPct = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;
  const totalTodayGainPct = totalPrevValue > 0 ? (totalTodayGain / totalPrevValue) * 100 : 0;
  const profitableCount = enriched.filter((h) => h.pnl >= 0).length;

  const formatSignedMoney = (val: number) => {
    const abs = Math.abs(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `${val >= 0 ? '+' : '-'}₹${abs}`;
  };

  const handleExportCsv = () => {
    const latestJournal = storage.getJournalTrades();
    const latestPaper = storage.getPaperAccount();

    downloadPortfolioCsv({
      summary: {
        holdingsCount: holdings.length,
        profitableCount,
        totalInvested,
        totalCurrent,
        totalPnL,
        totalPnLPct,
        totalTodayGain,
        totalTodayGainPct,
        hasLiveDayData,
      },
      holdings: enriched.map((h) => ({
        symbol: h.symbol,
        market: h.market,
        sector: sectorMap[keyOf(h.symbol)] || resolveHoldingSector(h.symbol, h.market),
        dateAdded: h.dateAdded,
        quantity: h.quantity,
        buyPrice: h.buyPrice,
        livePrice: h.livePrice,
        invested: h.invested,
        current: h.current,
        todayGain: h.todayGain,
        todayGainPct: h.todayGainPct,
        pnl: h.pnl,
        pnlPct: h.pnlPct,
      })),
      journalTrades: latestJournal,
      paperAccount: latestPaper,
    });

    setJustExported(true);
    if (exportTimerRef.current !== null) {
      window.clearTimeout(exportTimerRef.current);
    }
    exportTimerRef.current = window.setTimeout(() => {
      setJustExported(false);
      exportTimerRef.current = null;
    }, 2500);
  };

  return (
    <div className="space-y-6">
      <PortfolioOverviewCard
        holdingsCount={holdings.length}
        profitableCount={profitableCount}
        totalInvested={totalInvested}
        totalCurrent={totalCurrent}
        totalPnL={totalPnL}
        totalPnLPct={totalPnLPct}
        totalTodayGain={totalTodayGain}
        totalTodayGainPct={totalTodayGainPct}
        hasLiveDayData={hasLiveDayData}
        isRefreshing={isRefreshing}
        onRefresh={refreshPrices}
      />

      <div className="flex items-center justify-between gap-3 flex-wrap border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2 flex-wrap">
          {(['Holdings', 'Insights', 'Watchlist'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === tab
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {tab === 'Holdings' && 'Holdings & P/L'}
              {tab === 'Insights' && 'Health Score & Insights'}
              {tab === 'Watchlist' && 'Watchlist'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {holdings.length === 0 && watchlist.length > 0 && (
            <button
              type="button"
              onClick={refreshPrices}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Syncing...' : 'Refresh Prices'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleExportCsv}
            title="Download portfolio summary, current holdings, and recorded trade history as a CSV file"
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              justExported
                ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
            }`}
          >
            {justExported ? (
              <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            <span>{justExported ? 'Exported CSV' : 'Export CSV'}</span>
          </button>
        </div>
      </div>

      {activeTab === 'Holdings' && (
        <div className="space-y-6">
          <PortfolioValueTrendChart
            holdings={holdings}
            journalTrades={journalTrades}
            paperAccount={paperAccount}
            liveQuotes={liveQuotes}
            isLoading={isRefreshing}
            theme={theme}
            onFocusAddHolding={() => {
              symbolInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              symbolInputRef.current?.focus();
            }}
          />

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch">
            <div className="xl:col-span-7 min-w-0">
              <PortfolioDailyGainChart
                holdings={holdings}
                liveQuotes={liveQuotes}
                isLoading={isRefreshing}
                theme={theme}
              />
            </div>

            <div className="xl:col-span-5 min-w-0 flex flex-col">
              <PortfolioSectorDonut
                holdings={enriched.map((h) => ({
                  id: h.id,
                  symbol: h.symbol,
                  market: h.market,
                  currentValue: h.current,
                  investedValue: h.invested,
                  pnl: h.pnl,
                  sector: sectorMap[keyOf(h.symbol)],
                }))}
                isLoadingSectors={isLoadingSectors}
                theme={theme}
                onSelectStock={onSelectStock}
              />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-3">
              <PlusCircle className="w-4 h-4 text-cyan-500" /> Add Holding to Portfolio
            </h3>
            <form onSubmit={handleAddHolding} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
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
                  ref={symbolInputRef}
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
                  onChange={(e) => setHQty(e.target.value)}
                  placeholder="Enter quantity"
                  required
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-bold font-mono tabular-nums"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-500 block mb-1">Buy Price</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={hPrice}
                  onChange={(e) => setHPrice(e.target.value)}
                  placeholder="Enter buy price"
                  required
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-bold font-mono tabular-nums"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-500 block mb-1">Trade Date</label>
                <input
                  type="date"
                  max={todayIso}
                  value={hDate}
                  onChange={(e) => setHDate(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-bold font-mono tabular-nums"
                />
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer"
                >
                  Add Holding
                </button>
              </div>
            </form>
          </div>

          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-x-auto">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Holdings Breakdown</h3>
            {enriched.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 py-6 text-center">
                No holdings added yet. Add a stock above to track live value, today&apos;s gain, and overall P/L.
              </p>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-semibold text-[11px]">
                  <tr>
                    <th className="py-2.5 px-3">Symbol</th>
                    <th className="py-2.5 px-3">Market</th>
                    <th className="py-2.5 px-3 text-right">Qty</th>
                    <th className="py-2.5 px-3 text-right">Buy Price</th>
                    <th className="py-2.5 px-3 text-right">Live Price</th>
                    <th className="py-2.5 px-3 text-right">Invested</th>
                    <th className="py-2.5 px-3 text-right">Current</th>
                    <th className="py-2.5 px-3 text-right">Today&apos;s Gain</th>
                    <th className="py-2.5 px-3 text-right">Overall P/L</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {enriched.map((h) => (
                    <tr key={h.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">
                        <button
                          type="button"
                          onClick={() => onSelectStock(h.symbol, h.market)}
                          className="hover:text-blue-600 dark:hover:text-blue-400 underline decoration-dotted cursor-pointer"
                        >
                          {h.symbol}
                        </button>
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400">{h.market}</td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums font-medium">{h.quantity}</td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums">₹{h.buyPrice.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold">
                        {h.livePrice !== null ? `₹${h.livePrice.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-500 dark:text-slate-400">
                        ₹{h.invested.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold">
                        ₹{h.current.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </td>
                      <td
                        className={`py-2.5 px-3 text-right font-mono tabular-nums font-bold whitespace-nowrap ${
                          h.todayGain === null
                            ? 'text-slate-400'
                            : h.todayGain >= 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {h.todayGain !== null && h.todayGainPct !== null ? (
                          <>
                            {formatSignedMoney(h.todayGain)}{' '}
                            <span className="font-semibold opacity-90">
                              ({h.todayGainPct >= 0 ? '+' : ''}
                              {h.todayGainPct.toFixed(2)}%)
                            </span>
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td
                        className={`py-2.5 px-3 text-right font-mono tabular-nums font-bold whitespace-nowrap ${
                          h.pnl >= 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {formatSignedMoney(h.pnl)} ({h.pnlPct >= 0 ? '+' : ''}
                        {h.pnlPct.toFixed(2)}%)
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleDeleteHolding(h.id)}
                          aria-label={`Remove ${h.symbol}`}
                          className="text-slate-400 hover:text-rose-600 p-1 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {activeTab === 'Insights' && (() => {
        if (enriched.length === 0 || totalCurrent <= 0) {
          return (
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm text-sm text-slate-500">
              Your portfolio is empty. Add stocks in the Holdings tab to view your risk and diversification analysis here.
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
        const label = score >= 75 ? 'Well diversified' : score >= 50 ? 'Moderately concentrated' : 'Highly concentrated';
        const fmt = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-5">
                <PortfolioSectorDonut
                  holdings={enriched.map((h) => ({
                    id: h.id,
                    symbol: h.symbol,
                    market: h.market,
                    currentValue: h.current,
                    investedValue: h.invested,
                    pnl: h.pnl,
                    sector: sectorMap[keyOf(h.symbol)],
                  }))}
                  isLoadingSectors={isLoadingSectors}
                  theme={theme}
                  onSelectStock={onSelectStock}
                />
              </div>

              <div className="lg:col-span-7 space-y-6">
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Diversification Score</span>
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white">
                    {score} / 100 <span className="text-xs font-semibold text-slate-500">({label})</span>
                  </h3>
                  <p className="text-xs text-slate-500 max-w-xl">
                    Scored on single-stock concentration (penalty above 25% in one holding) and total holding count (penalty below 5 stocks). Review the adjacent sector chart for industry balance.
                  </p>
                </div>

                <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" /> Based on Your Portfolio
                  </h4>
              <ul className="text-xs space-y-2 text-slate-600 dark:text-slate-300">
                <li className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                  • Largest holding <strong>{top.symbol}</strong> accounts for <strong>{top.w.toFixed(1)}%</strong> of your portfolio.
                  {top.w > 25 ? ' Holding more than 25% in a single stock can increase concentration risk.' : ' This is within a healthy limit.'}
                </li>
                <li className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                  • Total of {weights.length} stock(s). Top 3 holdings make up {weights.slice(0, 3).reduce((a, x) => a + x.w, 0).toFixed(1)}%.
                </li>
                <li className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                  • Market allocation: {Object.entries(marketSplit).map(([m, w]) => `${m} ${w.toFixed(0)}%`).join(', ')}.
                </li>
              </ul>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">What if the market drops?</h4>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-slate-400">
                    <th className="py-1.5">Market Drop</th>
                    <th>Estimated Portfolio Loss</th>
                    <th>Remaining Value</th>
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
              <p className="text-[11px] text-slate-500">Assumes each stock moves 1:1 with the broader market (beta = 1). Actual moves may be sharper or milder.</p>
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
              const quote = getLiveQuote(w.symbol);
              const price = getLivePrice(w.symbol);
              return (
                <div
                  key={w.symbol}
                  className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between"
                >
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 block">{w.market}</span>
                    <button
                      type="button"
                      onClick={() => onSelectStock(w.symbol, w.market)}
                      className="font-extrabold text-sm text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer"
                    >
                      {w.symbol}
                    </button>
                    <div className="flex items-center gap-1.5 font-mono tabular-nums mt-0.5">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                        {price !== null ? `${w.market === 'US' ? '$' : '₹'}${price.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : '—'}
                      </span>
                      {quote && (
                        <span
                          className={`text-[11px] font-bold ${
                            quote.changePct >= 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {quote.changePct >= 0 ? '+' : ''}
                          {quote.changePct.toFixed(2)}%
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveWatchlist(w.symbol)}
                    aria-label={`Remove ${w.symbol} from watchlist`}
                    className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
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
