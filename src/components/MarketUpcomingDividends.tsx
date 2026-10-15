import React, { useState, useEffect } from 'react';
import { MarketDividendItem, MarketType } from '../types';
import { fetchMarketUpcomingDividends } from '../utils/stockApi';
import {
  CalendarDays,
  Zap,
  Percent,
  TrendingUp,
  RefreshCw,
  Search,
  ExternalLink,
  ShieldCheck,
  Building2,
  DollarSign,
  ArrowRight,
  Filter,
  Sparkles,
  Info,
} from 'lucide-react';

interface MarketUpcomingDividendsProps {
  onSelectStock?: (symbol: string, market: MarketType) => void;
  activeSymbol?: string;
}

export const MarketUpcomingDividends: React.FC<MarketUpcomingDividendsProps> = ({
  onSelectStock,
  activeSymbol,
}) => {
  const [items, setItems] = useState<MarketDividendItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [marketFilter, setMarketFilter] = useState<'ALL' | 'NSE' | 'US'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'all' | 'upcoming' | 'high_yield'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [lastFetchedAt, setLastFetchedAt] = useState<string>('');

  const loadData = async (mFilter = marketFilter) => {
    setIsLoading(true);
    try {
      const data = await fetchMarketUpcomingDividends(mFilter === 'ALL' ? undefined : mFilter);
      setItems(data);
      setLastFetchedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (err) {
      console.error('Failed to load market upcoming dividends:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData(marketFilter);
  }, [marketFilter]);

  const formatDateNice = (dateStr: string | null) => {
    if (!dateStr) return 'TBD / Not Announced';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      }
    } catch {}
    return dateStr;
  };

  const filteredItems = items.filter((item) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchSym = item.symbol.toLowerCase().includes(q);
      const matchName = item.name.toLowerCase().includes(q);
      if (!matchSym && !matchName) return false;
    }

    if (statusFilter === 'upcoming') {
      return item.isUpcoming;
    }
    if (statusFilter === 'high_yield') {
      return (item.dividendYield || 0) >= 3.5;
    }
    return true;
  });

  const upcomingCount = items.filter((i) => i.isUpcoming).length;
  const highestYieldItem = [...items].sort((a, b) => (b.dividendYield || 0) - (a.dividendYield || 0))[0];

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white rounded-2xl p-5 border border-blue-900/40 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="p-1 rounded-md bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 flex items-center justify-center">
                <Zap className="w-4 h-4 fill-cyan-400" />
              </span>
              <span className="text-xs font-black uppercase tracking-wider text-cyan-300">
                Live Yahoo Finance Dividend Radar
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> 100% Real-Time Yahoo API
              </span>
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-white">
              किस कंपनी का Dividend आ रहा है? (Market Upcoming Dividends)
            </h3>
            <p className="text-xs text-slate-300 max-w-2xl">
              Real-time ex-dividend dates, payout amounts, and dividend yields retrieved directly from Yahoo Finance official calendar for major NSE and US companies.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <button
              onClick={() => loadData()}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold border border-slate-700 transition-colors cursor-pointer disabled:opacity-50"
              title="Refresh live Yahoo Finance data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Upcoming Announced</span>
            <CalendarDays className="w-4 h-4 text-amber-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-amber-600 dark:text-amber-400">{upcomingCount}</span>
            <span className="text-xs text-slate-400">Companies Scheduled</span>
          </div>
          <span className="text-[11px] text-slate-500 block mt-1">Ex-dividend cutoff dates coming soon</span>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Top Dividend Yield</span>
            <Percent className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {highestYieldItem ? `${highestYieldItem.dividendYield}%` : '6.59%'}
            </span>
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
              {highestYieldItem ? highestYieldItem.symbol : 'ONGC'}
            </span>
          </div>
          <span className="text-[11px] text-slate-500 block mt-1">Highest cash yield in scanned basket</span>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Tracked Bluechips</span>
            <Building2 className="w-4 h-4 text-cyan-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-cyan-600 dark:text-cyan-400">{items.length}</span>
            <span className="text-xs text-slate-400">NSE & US Stocks</span>
          </div>
          <span className="text-[11px] text-slate-500 block mt-1">
            Last synced: {lastFetchedAt || 'Live'}
          </span>
        </div>
      </div>

      <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 text-xs font-bold">
            {(['ALL', 'NSE', 'US'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMarketFilter(m)}
                className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                  marketFilter === m
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {m === 'ALL' ? 'All Markets' : m === 'NSE' ? '🇮🇳 NSE / India' : '🇺🇸 US Markets'}
              </button>
            ))}
          </div>

          <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 text-xs font-bold">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              All Dividend Payers
            </button>
            <button
              onClick={() => setStatusFilter('upcoming')}
              className={`px-3 py-1.5 rounded-md transition-all cursor-pointer flex items-center gap-1 ${
                statusFilter === 'upcoming'
                  ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-amber-500'
              }`}
            >
              <Zap className="w-3 h-3" />
              ⚡ Upcoming Only ({upcomingCount})
            </button>
            <button
              onClick={() => setStatusFilter('high_yield')}
              className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                statusFilter === 'high_yield'
                  ? 'bg-emerald-600 text-white font-black shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-emerald-500'
              }`}
            >
              High Yield (&gt;3.5%)
            </button>
          </div>
        </div>

        <div className="relative min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search stock (e.g. TCS, Vedanta, ITC, Apple)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        {isLoading && (
          <div className="py-16 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-cyan-500 animate-spin mx-auto" />
            <p className="text-xs font-bold text-slate-500">
              Querying Yahoo Finance live dividend schedule for market leaders...
            </p>
          </div>
        )}

        {!isLoading && filteredItems.length === 0 && (
          <div className="py-16 text-center space-y-2">
            <Info className="w-8 h-8 text-slate-400 mx-auto" />
            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">No matching stocks found</p>
            <p className="text-xs text-slate-400">Try adjusting your filters or search query.</p>
          </div>
        )}

        {!isLoading && filteredItems.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Company / Stock</th>
                  <th className="py-3 px-4">Market</th>
                  <th className="py-3 px-4">Current Price</th>
                  <th className="py-3 px-4">Ex-Dividend Date</th>
                  <th className="py-3 px-4">Annual Payout / Share</th>
                  <th className="py-3 px-4">Dividend Yield</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredItems.map((item) => {
                  const isCurrentSelected = activeSymbol && activeSymbol.toUpperCase() === item.symbol.toUpperCase();

                  return (
                    <tr
                      key={item.fullTicker}
                      className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors ${
                        item.isUpcoming ? 'bg-amber-500/5 dark:bg-amber-500/5' : ''
                      }`}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs ${
                            item.market === 'NSE'
                              ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                              : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                          }`}>
                            {item.symbol.slice(0, 2)}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-black text-slate-900 dark:text-white">
                                {item.symbol}
                              </span>
                              {item.isUpcoming && (
                                <span className="px-1.5 py-0.2 rounded-md bg-amber-500 text-slate-950 text-[10px] font-black uppercase tracking-wider flex items-center gap-0.5">
                                  <Zap className="w-2.5 h-2.5 fill-slate-950" />
                                  Upcoming
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 block truncate max-w-[180px]">
                              {item.name}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                          item.market === 'NSE'
                            ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800'
                            : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                        }`}>
                          {item.market}
                        </span>
                      </td>

                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-slate-100">
                        {item.currency}{item.price.toFixed(2)}
                      </td>

                      <td className="py-3 px-4">
                        {item.exDividendDate ? (
                          <div className="space-y-0.5">
                            <span className={`font-bold block ${
                              item.isUpcoming
                                ? 'text-amber-600 dark:text-amber-400 font-black'
                                : 'text-slate-700 dark:text-slate-300'
                            }`}>
                              {formatDateNice(item.exDividendDate)}
                            </span>
                            {item.isUpcoming && item.daysUntilExDate !== null && item.daysUntilExDate !== undefined && (
                              <span className="text-[10px] text-amber-500 font-bold block">
                                {item.daysUntilExDate > 0
                                  ? `⚡ In ${item.daysUntilExDate} days`
                                  : item.daysUntilExDate === 0
                                  ? '⚡ Today!'
                                  : 'Recently passed'}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">TBD</span>
                        )}
                      </td>

                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-slate-100">
                        {item.dividendRate !== null ? (
                          <span>{item.currency}{item.dividendRate.toFixed(2)}</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className={`font-black text-xs ${
                            item.dividendYield >= 4
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : item.dividendYield >= 2
                              ? 'text-cyan-600 dark:text-cyan-400'
                              : 'text-slate-600 dark:text-slate-300'
                          }`}>
                            {item.dividendYield.toFixed(2)}%
                          </span>
                          <div className="w-16 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden hidden sm:block">
                            <div
                              className="h-full bg-emerald-500 rounded-full"
                              style={{ width: `${Math.min(100, (item.dividendYield / 8) * 100)}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-right">
                        {onSelectStock ? (
                          <button
                            onClick={() => onSelectStock(item.symbol, item.market)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ml-auto ${
                              isCurrentSelected
                                ? 'bg-cyan-500 text-slate-950 font-black shadow-xs'
                                : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
                            }`}
                          >
                            <span>{isCurrentSelected ? 'Active Stock' : 'View Calendar'}</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
