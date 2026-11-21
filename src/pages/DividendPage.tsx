import React, { useState, useEffect } from 'react';
import { MarketType, DividendResponse, AnalysisResult } from '../types';
import { fetchDividends } from '../utils/stockApi';
import { DividendCalendar } from '../components/DividendCalendar';
import { DividendGrowthChart } from '../components/DividendGrowthChart';
import { DividendHistoryTable } from '../components/DividendHistoryTable';
import { MarketUpcomingDividends } from '../components/MarketUpcomingDividends';
import { PortfolioDividendProjector } from '../components/PortfolioDividendProjector';
import {
  CalendarDays,
  Coins,
  Zap,
  BarChart3,
  Table as TableIcon,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  Info,
  Building2,
  TrendingUp,
  Percent,
  Calendar,
  ExternalLink,
  Wallet,
  PieChart as PieChartIcon,
} from 'lucide-react';

interface DividendPageProps {
  data: AnalysisResult;
  onSelectStock: (symbol: string, market: MarketType) => void;
}

const POPULAR_DIVIDEND_STOCKS: Array<{ symbol: string; market: MarketType; name: string; tag?: string }> = [
  { symbol: 'TCS', market: 'NSE', name: 'Tata Consultancy Services', tag: 'Upcoming Ex-Date' },
  { symbol: 'VEDL', market: 'NSE', name: 'Vedanta Ltd', tag: 'Upcoming Ex-Date' },
  { symbol: 'MSFT', market: 'US', name: 'Microsoft Corp', tag: 'Nov 19 Ex-Date' },
  { symbol: 'COALINDIA', market: 'NSE', name: 'Coal India Ltd', tag: '6.55% Yield' },
  { symbol: 'ONGC', market: 'NSE', name: 'Oil & Natural Gas Corp', tag: '6.59% Yield' },
  { symbol: 'BPCL', market: 'NSE', name: 'Bharat Petroleum', tag: '7.03% Yield' },
  { symbol: 'ITC', market: 'NSE', name: 'ITC Ltd', tag: '6.20% Yield' },
  { symbol: 'INFY', market: 'NSE', name: 'Infosys Ltd', tag: '4.90% Yield' },
  { symbol: 'PFC', market: 'NSE', name: 'Power Finance Corp', tag: '4.62% Yield' },
  { symbol: 'RECLTD', market: 'NSE', name: 'REC Limited', tag: '4.52% Yield' },
  { symbol: 'POWERGRID', market: 'NSE', name: 'Power Grid Corp', tag: '3.61% Yield' },
  { symbol: 'RELIANCE', market: 'NSE', name: 'Reliance Industries', tag: 'Bluechip' },
  { symbol: 'AAPL', market: 'US', name: 'Apple Inc', tag: 'US Tech' },
];

export const DividendPage: React.FC<DividendPageProps> = ({ data, onSelectStock }) => {
  const [activeTab, setActiveTab] = useState<'radar' | 'projector' | 'calendar' | 'chart' | 'table'>('radar');
  const [dividendData, setDividendData] = useState<DividendResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchTicker, setSearchTicker] = useState<string>('');
  const [tableYearFilter, setTableYearFilter] = useState<string>('all');

  const loadDividends = async (sym: string = data.displaySymbol, m: MarketType = data.market) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetchDividends(sym, m);
      if (res && res.success) {
        setDividendData(res);
      } else {
        setDividendData({
          success: true,
          hasDividends: false,
          symbol: sym,
          currencySymbol: m === 'US' ? '$' : '₹',
          dividendYield: 0,
          annualPayout: 0,
          payoutRatio: 0,
          growthRate5Y: 0,
          frequency: 'None (Zero Dividend)',
          dividends: [],
          upcomingDividends: [],
          allDividends: [],
          yearlyTotals: [],
          source: 'Yahoo Finance Live',
        });
      }
    } catch (err: any) {
      console.error('[DividendPage] Error fetching dividend data:', err);
      setErrorMessage('Unable to load live dividend payouts from Yahoo Finance.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDividends(data.displaySymbol, data.market);
  }, [data.displaySymbol, data.market]);

  const handleStockClick = (symbol: string, market: MarketType) => {
    onSelectStock(symbol, market);
    loadDividends(symbol, market);
    setActiveTab('calendar');
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = searchTicker.trim().toUpperCase();
    if (!clean) return;
    const isUs = clean === 'AAPL' || clean === 'MSFT' || clean === 'NVDA' || clean === 'GOOGL' || clean === 'AMZN' || clean === 'TSLA';
    const marketType: MarketType = isUs ? 'US' : 'NSE';
    onSelectStock(clean, marketType);
    loadDividends(clean, marketType);
    setActiveTab('calendar');
    setSearchTicker('');
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 border border-indigo-900/40 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center">
                <Coins className="w-5 h-5 fill-emerald-400" />
              </span>
              <span className="text-xs font-black uppercase tracking-wider text-emerald-300">
                Official Yahoo Finance Dividend Intelligence
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> 100% Real-Time Yahoo API
              </span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Dividend Radar & Payout Schedule
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-3xl leading-relaxed">
              Track exactly <strong>किस कंपनी का Dividend आ रहा है</strong> (which company has an upcoming dividend announced on Yahoo Finance), complete with official ex-dividend cutoff dates, dividend yields, and verified payout history.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
            <button
              onClick={() => setActiveTab('projector')}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black transition-all cursor-pointer shadow-sm"
              title="Calculate projected income from your portfolio holdings"
            >
              <Wallet className="w-4 h-4 fill-slate-950" />
              <span>Project My Portfolio Income</span>
            </button>

            <button
              onClick={() => loadDividends(data.displaySymbol, data.market)}
              disabled={isLoading}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold border border-slate-700 transition-colors cursor-pointer disabled:opacity-50 shadow-sm"
              title="Refresh live dividend data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-emerald-400' : ''}`} />
              <span>Refresh Yahoo API</span>
            </button>
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-slate-800 flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-slate-400 flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            Quick Dividend Tickers:
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            {POPULAR_DIVIDEND_STOCKS.map((stk) => {
              const isSelected = stk.symbol === data.displaySymbol;
              return (
                <button
                  key={stk.symbol}
                  onClick={() => handleStockClick(stk.symbol, stk.market)}
                  className={`text-xs px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-emerald-500 text-slate-950 font-black shadow-sm'
                      : 'bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700/60'
                  }`}
                >
                  <span>{stk.symbol}</span>
                  {stk.tag && (
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-sm ${
                      isSelected
                        ? 'bg-slate-900 text-emerald-300'
                        : stk.tag.includes('Upcoming')
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 font-black'
                        : 'bg-slate-700 text-slate-300'
                    }`}>
                      {stk.tag}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveTab('radar')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'radar'
                ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Zap className="w-3.5 h-3.5 fill-current" />
            <span>Market Upcoming Radar (किस कंपनी का Dividend आ रहा है?)</span>
          </button>

          <button
            onClick={() => setActiveTab('projector')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'projector'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Wallet className="w-3.5 h-3.5" />
            <span>Portfolio Income Projector</span>
            <span className="text-[10px] font-black px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
              NEW
            </span>
          </button>

          <button
            onClick={() => setActiveTab('calendar')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'calendar'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <CalendarDays className="w-3.5 h-3.5" />
            <span>{data.displaySymbol} Calendar View</span>
          </button>

          <button
            onClick={() => setActiveTab('chart')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'chart'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>5-Year Growth Trend</span>
          </button>

          <button
            onClick={() => setActiveTab('table')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'table'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <TableIcon className="w-3.5 h-3.5" />
            <span>History Table</span>
          </button>
        </div>

        <form onSubmit={handleSearchSubmit} className="relative flex items-center">
          <input
            type="text"
            value={searchTicker}
            onChange={(e) => setSearchTicker(e.target.value)}
            placeholder="Inspect any stock (e.g. TCS, ITC, AAPL)..."
            className="w-full sm:w-64 pl-8 pr-3 py-1.5 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:outline-none focus:border-emerald-500 font-semibold"
          />
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
        </form>
      </div>

      {activeTab === 'radar' && (
        <MarketUpcomingDividends
          onSelectStock={handleStockClick}
          activeSymbol={data.displaySymbol}
        />
      )}

      {activeTab === 'projector' && (
        <PortfolioDividendProjector
          onSelectStock={handleStockClick}
          activeSymbol={data.displaySymbol}
        />
      )}

      {activeTab !== 'radar' && activeTab !== 'projector' && isLoading && (
        <div className="py-16 flex flex-col items-center justify-center space-y-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin" />
          <p className="text-xs font-bold text-slate-500">
            Querying Yahoo Finance live dividend schedule for {data.displaySymbol}...
          </p>
        </div>
      )}

      {activeTab !== 'radar' && activeTab !== 'projector' && !isLoading && errorMessage && (
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {activeTab !== 'radar' && activeTab !== 'projector' && !isLoading && dividendData && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Dividend Yield
            </span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                {dividendData.dividendYield}%
              </span>
              <span className="text-xs text-slate-400">Annual</span>
            </div>
            <span className="text-[11px] text-slate-500 block mt-1">
              {dividendData.frequency || 'Annual'}
            </span>
          </div>

          <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Annual Payout
            </span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-2xl font-black text-slate-900 dark:text-white">
                {dividendData.currencySymbol}{dividendData.annualPayout}
              </span>
              <span className="text-xs text-slate-400">/ share</span>
            </div>
            <span className="text-[11px] text-slate-500 block mt-1">
              Trailing 12-Month Total
            </span>
          </div>

          <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              5-Year Dividend CAGR
            </span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className={`text-2xl font-black ${
                (dividendData.growthRate5Y || 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'
              }`}>
                {(dividendData.growthRate5Y || 0) > 0 ? `+${dividendData.growthRate5Y}%` : `${dividendData.growthRate5Y || 0}%`}
              </span>
            </div>
            <span className="text-[11px] text-slate-500 block mt-1">
              Compounded Annual Growth
            </span>
          </div>

          <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Payout Ratio
            </span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-2xl font-black text-blue-600 dark:text-blue-400">
                {dividendData.payoutRatio ? `${dividendData.payoutRatio}%` : '—'}
              </span>
            </div>
            <span className="text-[11px] text-slate-500 block mt-1">
              Earnings Retained & Paid
            </span>
          </div>
        </div>
      )}

      {activeTab === 'calendar' && !isLoading && dividendData && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
          <DividendCalendar
            dividendData={dividendData}
            symbol={data.displaySymbol}
            currencySymbol={data.currencySymbol}
            latestPrice={data.latestPrice}
          />
        </div>
      )}

      {activeTab === 'chart' && !isLoading && dividendData && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
          <DividendGrowthChart
            yearlyTotals={dividendData.yearlyTotals || []}
            currencySymbol={data.currencySymbol}
            symbol={data.displaySymbol}
            growthRate5Y={dividendData.growthRate5Y}
            dividendYield={dividendData.dividendYield}
            annualPayout={dividendData.annualPayout}
            payoutRatio={dividendData.payoutRatio}
            dividends={dividendData.dividends}
            onSelectYear={(yr) => {
              setTableYearFilter(yr);
              setActiveTab('table');
            }}
          />
        </div>
      )}

      {activeTab === 'table' && !isLoading && dividendData && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
          <DividendHistoryTable
            dividends={dividendData.dividends}
            upcomingDividends={dividendData.upcomingDividends}
            currencySymbol={data.currencySymbol}
            symbol={data.displaySymbol}
            latestPrice={data.latestPrice}
            initialYear={tableYearFilter}
            onSelectYear={(yr) => setTableYearFilter(yr)}
          />
        </div>
      )}
    </div>
  );
};

export default DividendPage;
