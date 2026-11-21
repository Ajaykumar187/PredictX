import React from 'react';
import { Briefcase, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';

interface PortfolioOverviewCardProps {
  holdingsCount: number;
  profitableCount: number;
  totalInvested: number;
  totalCurrent: number;
  totalPnL: number;
  totalPnLPct: number;
  totalTodayGain: number;
  totalTodayGainPct: number;
  hasLiveDayData: boolean;
  isRefreshing: boolean;
  onRefresh: () => void;
}

const formatRupees = (val: number): string =>
  `₹${val.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatSignedRupees = (val: number): string => {
  const abs = Math.abs(val).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${val >= 0 ? '+' : '-'}₹${abs}`;
};

export const PortfolioOverviewCard: React.FC<PortfolioOverviewCardProps> = ({
  holdingsCount,
  profitableCount,
  totalInvested,
  totalCurrent,
  totalPnL,
  totalPnLPct,
  totalTodayGain,
  totalTodayGainPct,
  hasLiveDayData,
  isRefreshing,
  onRefresh,
}) => {
  const isOverallPositive = totalPnL >= 0;
  const isTodayPositive = totalTodayGain >= 0;
  const losingCount = Math.max(0, holdingsCount - profitableCount);

  const maxVal = Math.max(totalInvested, totalCurrent, 1);
  const investedBarPct = Math.min(100, (totalInvested / maxVal) * 100);
  const currentBarPct = Math.min(100, (totalCurrent / maxVal) * 100);

  return (
    <section
      aria-label="Portfolio Overview"
      className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden"
    >
      <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800/90 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-500/15 border border-blue-200/70 dark:border-blue-500/30 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
            <Briefcase className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white">
              Portfolio Overview
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {holdingsCount === 0
                ? 'Add holdings below to track live valuation and overall returns'
                : `${holdingsCount} active ${holdingsCount === 1 ? 'holding' : 'holdings'} · ${profitableCount} in profit, ${losingCount} in loss`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {holdingsCount > 0 && (
            <div
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold font-mono tabular-nums ${
                isOverallPositive
                  ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200/80 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
                  : 'bg-rose-50 dark:bg-rose-500/10 border-rose-200/80 dark:border-rose-500/30 text-rose-700 dark:text-rose-400'
              }`}
            >
              {isOverallPositive ? (
                <TrendingUp className="w-3.5 h-3.5" />
              ) : (
                <TrendingDown className="w-3.5 h-3.5" />
              )}
              <span>
                {totalPnLPct >= 0 ? '+' : ''}
                {totalPnLPct.toFixed(2)}% Overall
              </span>
            </div>
          )}

          {holdingsCount > 0 && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Syncing...' : 'Refresh'}</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 dark:divide-slate-800/90">
        <div className="p-5">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1.5">
            Total Invested Amount
          </span>
          <div className="text-xl sm:text-2xl font-extrabold font-mono tabular-nums text-slate-900 dark:text-white">
            {formatRupees(totalInvested)}
          </div>
          <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 block">
            Capital cost basis
          </span>
        </div>

        <div className="p-5">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1.5">
            Current Total Value
          </span>
          <div className="text-xl sm:text-2xl font-extrabold font-mono tabular-nums text-slate-900 dark:text-white">
            {formatRupees(totalCurrent)}
          </div>
          <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 block">
            Live market valuation
          </span>
        </div>

        <div className="p-5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Overall Gain (%)
            </span>
            {holdingsCount > 0 &&
              (isOverallPositive ? (
                <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <TrendingDown className="w-4 h-4 text-rose-600 dark:text-rose-400" />
              ))}
          </div>
          <div
            className={`text-xl sm:text-2xl font-extrabold font-mono tabular-nums ${
              holdingsCount === 0
                ? 'text-slate-400 dark:text-slate-500'
                : isOverallPositive
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {holdingsCount === 0
              ? '0.00%'
              : `${totalPnLPct >= 0 ? '+' : ''}${totalPnLPct.toFixed(2)}%`}
          </div>
          <span
            className={`text-xs font-semibold font-mono tabular-nums mt-1 block ${
              holdingsCount === 0
                ? 'text-slate-400 dark:text-slate-500'
                : isOverallPositive
                  ? 'text-emerald-600/90 dark:text-emerald-400/90'
                  : 'text-rose-600/90 dark:text-rose-400/90'
            }`}
          >
            {holdingsCount === 0 ? '₹0.00 net P/L' : `${formatSignedRupees(totalPnL)} net P/L`}
          </span>
        </div>

        <div className="p-5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Today&apos;s Gain
            </span>
            {hasLiveDayData &&
              (isTodayPositive ? (
                <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <TrendingDown className="w-4 h-4 text-rose-600 dark:text-rose-400" />
              ))}
          </div>
          {hasLiveDayData ? (
            <>
              <div
                className={`text-xl sm:text-2xl font-extrabold font-mono tabular-nums ${
                  isTodayPositive
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {formatSignedRupees(totalTodayGain)}
              </div>
              <span
                className={`text-xs font-semibold font-mono tabular-nums mt-1 block ${
                  totalTodayGainPct >= 0
                    ? 'text-emerald-600/90 dark:text-emerald-400/90'
                    : 'text-rose-600/90 dark:text-rose-400/90'
                }`}
              >
                {totalTodayGainPct >= 0 ? '+' : ''}
                {totalTodayGainPct.toFixed(2)}% intraday
              </span>
            </>
          ) : (
            <>
              <div className="text-xl sm:text-2xl font-extrabold font-mono tabular-nums text-slate-400 dark:text-slate-500">
                {holdingsCount === 0 ? '₹0.00' : '—'}
              </div>
              <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 block">
                {holdingsCount === 0 ? 'No active positions' : 'Syncing live quotes'}
              </span>
            </>
          )}
        </div>
      </div>

      {holdingsCount > 0 && totalInvested > 0 && (
        <div className="px-5 py-3 bg-slate-50/70 dark:bg-slate-950/40 border-t border-slate-100 dark:border-slate-800/90 space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span className="font-medium">Invested vs. Current Valuation</span>
            <span className="font-mono tabular-nums font-semibold text-slate-700 dark:text-slate-300">
              {((totalCurrent / totalInvested) * 100).toFixed(1)}% of cost basis
            </span>
          </div>
          <div className="relative h-2 w-full rounded-full bg-slate-200/80 dark:bg-slate-800 overflow-hidden">
            <div
              className={`absolute inset-y-0 left-0 rounded-full transition-all duration-300 ${
                isOverallPositive ? 'bg-emerald-500' : 'bg-rose-500'
              }`}
              style={{ width: `${currentBarPct}%` }}
            />
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-slate-900/25 dark:bg-white/25 transition-all duration-300"
              style={{ width: `${investedBarPct}%` }}
            />
          </div>
        </div>
      )}
    </section>
  );
};

export default PortfolioOverviewCard;
