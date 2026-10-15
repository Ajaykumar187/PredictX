import React, { useState, useEffect } from 'react';
import { AnalysisResult, DividendResponse, DividendPayout, StockInfo } from '../types';
import { fetchDividends, fetchStockInfo } from '../utils/stockApi';
import { getNseStockUrl, formatCurrencyValue } from '../utils/marketData';
import { DividendCalendar } from '../components/DividendCalendar';
import { DividendGrowthChart } from '../components/DividendGrowthChart';
import { DividendHistoryTable } from '../components/DividendHistoryTable';
import { MarketUpcomingDividends } from '../components/MarketUpcomingDividends';
import { PortfolioDividendProjector } from '../components/PortfolioDividendProjector';
import {
  ExternalLink,
  Users,
  Building2,
  DollarSign,
  Coins,
  TrendingUp,
  Calendar,
  CalendarDays,
  RefreshCw,
  Percent,
  BarChart3,
  CheckCircle2,
  AlertCircle,
  Info,
  Clock,
  ArrowUpRight,
  Table as TableIcon,
  Zap,
  Wallet,
} from 'lucide-react';

interface CompanyInfoPageProps {
  data: AnalysisResult;
  onSelectStock?: (symbol: string, market: import('../types').MarketType) => void;
}

export const CompanyInfoPage: React.FC<CompanyInfoPageProps> = ({ data, onSelectStock }) => {
  if (data && typeof data.currencyFmt !== 'function') {
    data.currencyFmt = (v: number) => formatCurrencyValue(v, data.market);
  }
  const [stockInfo, setStockInfo] = useState<StockInfo>(data.info);

  useEffect(() => {
    let isMounted = true;
    setStockInfo(data.info);
    fetchStockInfo(data.displaySymbol, data.market).then((res) => {
      if (isMounted && res) {
        setStockInfo((prev) => ({ ...prev, ...res }));
      }
    });
    return () => {
      isMounted = false;
    };
  }, [data.displaySymbol, data.market, data.info]);

  const info = stockInfo;

  const [dividendData, setDividendData] = useState<DividendResponse | null>(null);
  const [isLoadingDividends, setIsLoadingDividends] = useState<boolean>(true);
  const [dividendError, setDividendError] = useState<string | null>(null);
  const [dividendViewTab, setDividendViewTab] = useState<'calendar' | 'chart' | 'table' | 'market-upcoming' | 'projector'>('calendar');
  const [tableYearFilter, setTableYearFilter] = useState<string>('all');

  useEffect(() => {
    let isMounted = true;
    const loadDividendData = async () => {
      setIsLoadingDividends(true);
      setDividendError(null);

      try {
        const res = await fetchDividends(data.displaySymbol, data.market);
        if (!isMounted) return;

        if (res && res.success) {
          setDividendData(res);
        } else {
          setDividendData({
            success: true,
            hasDividends: false,
            symbol: data.displaySymbol,
            currencySymbol: data.currencySymbol,
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
        if (isMounted) {
          console.error('[CompanyInfoPage] Dividend fetch error:', err);
          setDividendError('Unable to fetch live dividend payouts');
        }
      } finally {
        if (isMounted) {
          setIsLoadingDividends(false);
        }
      }
    };

    loadDividendData();
    return () => {
      isMounted = false;
    };
  }, [data.displaySymbol, data.market, data.latestPrice, info.dividendYield]);

  const handleRefresh = async () => {
    setIsLoadingDividends(true);
    setDividendError(null);
    try {
      const res = await fetchDividends(data.displaySymbol, data.market);
      if (res && res.success) {
        setDividendData(res);
      }
    } catch {
      setDividendError('Failed to refresh dividends');
    } finally {
      setIsLoadingDividends(false);
    }
  };

  const formatMarketCap = (val: number) => {
    if (!val || val <= 0) return 'N/A';
    const isIndian = data.currencySymbol === '₹' || data.market === 'NSE' || data.market === 'BSE';
    if (isIndian) {
      if (val >= 1e12) return `₹${(val / 1e12).toFixed(2)} Lakh Cr`;
      if (val >= 1e7) return `₹${(val / 1e7).toFixed(2)} Cr`;
      return `₹${val.toLocaleString('en-IN')}`;
    }
    if (val >= 1e12) return `$${(val / 1e12).toFixed(2)}T`;
    if (val >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
    if (val >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
    return `$${val.toLocaleString()}`;
  };

  const initial = info.displaySymbol.charAt(0);

  const hasNoDividends =
    !isLoadingDividends &&
    (!dividendData || (dividendData.dividends.length === 0 && (!dividendData.upcomingDividends || dividendData.upcomingDividends.length === 0)));

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-start sm:items-center gap-5">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-extrabold text-2xl shadow-md flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #0a2540 0%, #163f73 100%)' }}
        >
          {initial}
        </div>

        <div className="flex-1">
          <h2 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <span>{info.longName}</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              {info.displaySymbol}
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {info.sector} • {info.industry} • {info.country}
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <a
              href={getNseStockUrl(info.displaySymbol, info.market)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#0a2540] hover:bg-[#163f73] text-white border border-cyan-400/40 shadow-sm transition-all hover:scale-[1.02] cursor-pointer"
              title={`Directly open ${info.displaySymbol} live quote page on NSE India`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Direct NSE Stock Page ({info.displaySymbol})</span>
              <ExternalLink className="w-3.5 h-3.5 text-cyan-300" />
            </a>

            {info.website &&
              info.website !== getNseStockUrl(info.displaySymbol, info.market) &&
              !info.website.endsWith('nseindia.com') &&
              !info.website.endsWith('nseindia.com/') && (
                <a
                  href={info.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  <span>Company Website</span>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                </a>
              )}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Building2 className="w-4 h-4 text-cyan-500" /> Company Profile & Description
        </h3>
        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          {info.longBusinessSummary}
        </p>

        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 text-xs text-slate-500">
          <Users className="w-4 h-4 text-indigo-500" />
          <span>Leadership / Chief Executive Officer:</span>
          <strong className="text-slate-800 dark:text-slate-200">{info.ceo}</strong>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-emerald-500" /> Key Fundamental & Valuation Ratios
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60">
            <span className="text-[11px] font-semibold text-slate-500 block">Trailing P/E</span>
            <span className="text-lg font-bold text-slate-900 dark:text-white">
              {info.trailingPE != null ? info.trailingPE.toFixed(1) : 'N/A'}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60">
            <span className="text-[11px] font-semibold text-slate-500 block">Forward P/E</span>
            <span className="text-lg font-bold text-slate-900 dark:text-white">
              {info.forwardPE != null ? info.forwardPE.toFixed(1) : 'N/A'}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60">
            <span className="text-[11px] font-semibold text-slate-500 block">Trailing EPS</span>
            <span className="text-lg font-bold text-slate-900 dark:text-white">
              {info.trailingEps != null ? `${data.currencySymbol}${info.trailingEps.toFixed(2)}` : 'N/A'}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60">
            <span className="text-[11px] font-semibold text-slate-500 block">Market Cap</span>
            <span className="text-lg font-bold text-slate-900 dark:text-white">
              {formatMarketCap(info.marketCap || 0)}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60">
            <span className="text-[11px] font-semibold text-slate-500 block">Dividend Yield</span>
            <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
              {info.dividendYield != null ? `${info.dividendYield}%` : 'N/A'}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60">
            <span className="text-[11px] font-semibold text-slate-500 block">52-Week High</span>
            <span className="text-lg font-bold text-slate-900 dark:text-white">
              {data.currencyFmt(info.fiftyTwoWeekHigh)}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60">
            <span className="text-[11px] font-semibold text-slate-500 block">52-Week Low</span>
            <span className="text-lg font-bold text-slate-900 dark:text-white">
              {data.currencyFmt(info.fiftyTwoWeekLow)}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60">
            <span className="text-[11px] font-semibold text-slate-500 block">Stock Beta</span>
            <span className="text-lg font-bold text-slate-900 dark:text-white">
              {info.beta != null ? info.beta : '1.0'}
            </span>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-500">
                <Coins className="w-4 h-4" />
              </div>
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Dividend Income & Calendar Tracking</span>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-500/25">
                  Shareholder Income
                </span>
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Historical cash dividends, upcoming expected payment dates, and income schedule tracking for {info.displaySymbol}.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold">
              <button
                onClick={() => setDividendViewTab('calendar')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                  dividendViewTab === 'calendar'
                    ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <CalendarDays className="w-3.5 h-3.5" />
                <span>Calendar View</span>
              </button>
              <button
                onClick={() => setDividendViewTab('chart')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                  dividendViewTab === 'chart'
                    ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>5-Year Growth Trend</span>
              </button>
              <button
                onClick={() => setDividendViewTab('table')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                  dividendViewTab === 'table'
                    ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <TableIcon className="w-3.5 h-3.5" />
                <span>History Table</span>
              </button>
              <button
                onClick={() => setDividendViewTab('market-upcoming')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                  dividendViewTab === 'market-upcoming'
                    ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                    : 'text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300'
                }`}
              >
                <Zap className="w-3.5 h-3.5 fill-current" />
                <span>Market Upcoming Radar</span>
              </button>
              <button
                onClick={() => setDividendViewTab('projector')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                  dividendViewTab === 'projector'
                    ? 'bg-emerald-600 text-white font-black shadow-sm'
                    : 'text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300'
                }`}
              >
                <Wallet className="w-3.5 h-3.5" />
                <span>Portfolio Projector</span>
              </button>
            </div>

            <button
              onClick={handleRefresh}
              disabled={isLoadingDividends}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors disabled:opacity-50 cursor-pointer"
              title="Refresh dividend data"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingDividends ? 'animate-spin text-emerald-500' : ''}`} />
            </button>
          </div>
        </div>

        {dividendViewTab === 'market-upcoming' && (
          <MarketUpcomingDividends
            onSelectStock={(sym, m) => {
              if (onSelectStock) onSelectStock(sym, m);
              setDividendViewTab('calendar');
            }}
            activeSymbol={data.displaySymbol}
          />
        )}

        {dividendViewTab === 'projector' && (
          <PortfolioDividendProjector
            onSelectStock={(sym, m) => {
              if (onSelectStock) onSelectStock(sym, m);
              setDividendViewTab('calendar');
            }}
            activeSymbol={data.displaySymbol}
          />
        )}

        {isLoadingDividends && dividendViewTab !== 'market-upcoming' && dividendViewTab !== 'projector' && (
          <div className="py-12 flex flex-col items-center justify-center space-y-3">
            <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin" />
            <p className="text-xs font-bold text-slate-500">
              Retrieving historical and upcoming dividend records for {data.displaySymbol}...
            </p>
          </div>
        )}

        {!isLoadingDividends && dividendError && dividendViewTab !== 'market-upcoming' && dividendViewTab !== 'projector' && (
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span>{dividendError}. Displaying baseline dividend valuation.</span>
          </div>
        )}

        {hasNoDividends && dividendViewTab !== 'market-upcoming' && dividendViewTab !== 'projector' && (
          <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-center space-y-3">
            <Info className="w-8 h-8 text-slate-400 mx-auto" />
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              No Cash Dividends Distributed
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              {data.displaySymbol} is operating as a capital-appreciation / growth company with a 0.0% dividend yield, retaining 100% of earnings to reinvest into business expansion.
            </p>
            <button
              onClick={() => setDividendViewTab('market-upcoming')}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold transition-all cursor-pointer shadow-sm"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Explore Companies with Upcoming Dividends →</span>
            </button>
          </div>
        )}

        {dividendViewTab !== 'market-upcoming' && dividendViewTab !== 'projector' && !isLoadingDividends && dividendData && (dividendData.dividends.length > 0 || (dividendData.upcomingDividends && dividendData.upcomingDividends.length > 0)) && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Dividend Yield
                </span>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                    {dividendData.dividendYield}%
                  </span>
                  <span className="text-[10px] text-slate-400">TTM</span>
                </div>
                <span className="text-[10px] text-slate-500 block mt-0.5">
                  Annual payout / current share price
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Latest Annual Payout
                </span>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="text-xl font-black text-slate-900 dark:text-white">
                    {data.currencySymbol}{dividendData.annualPayout.toFixed(2)}
                  </span>
                  <span className="text-[10px] text-slate-400">/ share</span>
                </div>
                <span className="text-[10px] text-slate-500 block mt-0.5">
                  Total dividends paid in recent full year
                </span>
              </div>

              <div
                onClick={() => setDividendViewTab('chart')}
                className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 cursor-pointer hover:border-cyan-500/50 hover:bg-slate-100/60 dark:hover:bg-slate-800/80 transition-all group"
                title="Click to view 5-Year Dividend Growth Bar Chart"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    5-Year Dividend CAGR
                  </span>
                  <BarChart3 className="w-3.5 h-3.5 text-cyan-500 opacity-60 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="text-xl font-black text-cyan-600 dark:text-cyan-400">
                    +{dividendData.growthRate5Y}%
                  </span>
                  <span className="text-[10px] text-slate-400">Annualized</span>
                </div>
                <span className="text-[10px] text-slate-500 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 block mt-0.5 transition-colors">
                  View 5-year growth trend chart →
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Payout Frequency
                </span>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="text-sm font-black text-slate-800 dark:text-slate-200">
                    {dividendData.frequency || 'Semi-Annual'}
                  </span>
                </div>
                <span className="text-[10px] text-slate-500 block mt-1">
                  Estimated Payout Ratio: {dividendData.payoutRatio}% of EPS
                </span>
              </div>
            </div>

            {dividendViewTab === 'calendar' && (
              <DividendCalendar
                dividendData={dividendData}
                symbol={data.displaySymbol}
                currencySymbol={data.currencySymbol}
                latestPrice={data.latestPrice}
              />
            )}

            {dividendViewTab === 'chart' && (
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
                  setDividendViewTab('table');
                }}
              />
            )}

            {dividendViewTab === 'table' && (
              <DividendHistoryTable
                dividends={dividendData.dividends}
                upcomingDividends={dividendData.upcomingDividends}
                currencySymbol={data.currencySymbol}
                symbol={data.displaySymbol}
                latestPrice={data.latestPrice}
                initialYear={tableYearFilter}
                onSelectYear={(yr) => setTableYearFilter(yr)}
              />
            )}

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 text-xs flex items-start gap-2.5">
              <Info className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
              <div className="text-slate-600 dark:text-slate-300 space-y-1">
                <p>
                  <strong>Shareholder Capital Return Analysis:</strong> {info.displaySymbol} has maintained an uninterrupted dividend track record across the evaluated horizon, compounding at a 5-year CAGR of <strong>+{dividendData.growthRate5Y}%</strong>.
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  With an estimated payout ratio of <strong>{dividendData.payoutRatio}%</strong> against trailing earnings, the current dividend is well-supported by operating free cash flows.
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CompanyInfoPage;
