import React, { useId, useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { TrendingUp, TrendingDown, AreaChart as AreaChartIcon } from 'lucide-react';
import type { JournalTrade, PaperAccount, PortfolioHolding } from '../types';
import {
  buildPortfolioValueTrend,
  formatTrendDateFull,
  type HistoricalQuoteLike,
  type PortfolioTrendRange,
  type PortfolioTrendScope,
  type PortfolioValuePoint,
} from '../utils/portfolioHistory';

interface PortfolioValueTrendChartProps {
  holdings: PortfolioHolding[];
  journalTrades: JournalTrade[];
  paperAccount: PaperAccount;
  liveQuotes: Record<string, HistoricalQuoteLike>;
  isLoading: boolean;
  theme?: 'Light' | 'Dark';
  onFocusAddHolding?: () => void;
}

const formatCompactRupees = (val: number): string => {
  const sign = val < 0 ? '-' : '';
  const abs = Math.abs(val);
  if (abs >= 1e7) return `${sign}₹${(abs / 1e7).toFixed(2)}Cr`;
  if (abs >= 1e5) return `${sign}₹${(abs / 1e5).toFixed(2)}L`;
  if (abs >= 1e3) return `${sign}₹${(abs / 1e3).toFixed(1)}k`;
  return `${sign}₹${abs.toFixed(0)}`;
};

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

export const PortfolioValueTrendChart: React.FC<PortfolioValueTrendChartProps> = ({
  holdings,
  journalTrades,
  paperAccount,
  liveQuotes,
  isLoading,
  theme,
  onFocusAddHolding,
}) => {
  const gradientId = useId().replace(/:/g, '');
  const [scope, setScope] = useState<PortfolioTrendScope>('all');
  const [range, setRange] = useState<PortfolioTrendRange>('ALL');
  const [showCostBasis, setShowCostBasis] = useState<boolean>(true);

  const isDark =
    theme === 'Dark' ||
    (theme === undefined &&
      typeof document !== 'undefined' &&
      document.documentElement.classList.contains('dark'));

  const paperTradeCount = Array.isArray(paperAccount?.history) ? paperAccount.history.length : 0;
  const recordedTradeCount = journalTrades.length + paperTradeCount;
  const hasAnyData = holdings.length > 0 || recordedTradeCount > 0;

  const summary = useMemo(
    () =>
      buildPortfolioValueTrend({
        holdings,
        journalTrades,
        paperAccount,
        liveQuotes,
        scope,
        range,
      }),
    [holdings, journalTrades, paperAccount, liveQuotes, scope, range]
  );

  const { points } = summary;

  const yDomain = useMemo<[number, number]>(() => {
    if (points.length === 0) return [0, 100];
    let minV = Infinity;
    let maxV = -Infinity;
    for (const p of points) {
      if (p.totalValue < minV) minV = p.totalValue;
      if (p.totalValue > maxV) maxV = p.totalValue;
      if (showCostBasis) {
        if (p.investedValue < minV) minV = p.investedValue;
        if (p.investedValue > maxV) maxV = p.investedValue;
      }
    }
    if (!Number.isFinite(minV) || !Number.isFinite(maxV)) return [0, 100];
    if (minV === maxV) {
      const pad = Math.max(minV * 0.05, 100);
      return [Math.max(0, Math.floor(minV - pad)), Math.ceil(maxV + pad)];
    }
    const span = maxV - minV;
    const padBottom = span * 0.14;
    const padTop = span * 0.1;
    return [Math.max(0, Math.floor(minV - padBottom)), Math.ceil(maxV + padTop)];
  }, [points, showCostBasis]);

  const isGain = summary.latestPnL >= 0;
  const primaryStroke = isGain ? '#10b981' : '#f43f5e';
  const costStroke = isDark ? '#64748b' : '#94a3b8';
  const gridStroke = isDark ? '#1e293b' : '#e2e8f0';
  const axisTickColor = isDark ? '#94a3b8' : '#64748b';
  const cursorStroke = isDark ? '#475569' : '#94a3b8';

  const firstDate = points[0]?.date;
  const lastDate = points[points.length - 1]?.date;

  return (
    <section
      aria-label="Total Portfolio Value Trend"
      className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 space-y-5"
    >
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div className="space-y-1.5 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
              Total Portfolio Value Trend
            </h3>
            {hasAnyData && points.length > 0 && (
              <span className="text-xs text-slate-500 dark:text-slate-400">
                <span aria-hidden="true">· </span>
                {summary.totalRecordedEvents} recorded{' '}
                {summary.totalRecordedEvents === 1 ? 'trade' : 'trades'}
                {firstDate && lastDate && firstDate !== lastDate ? (
                  <>
                    <span aria-hidden="true"> · </span>
                    {formatTrendDateFull(firstDate)} – {formatTrendDateFull(lastDate)}
                  </>
                ) : null}
              </span>
            )}
          </div>

          {points.length > 0 ? (
            <div className="flex items-baseline gap-3 flex-wrap">
              <span className="text-2xl sm:text-3xl font-extrabold font-mono tabular-nums tracking-tight text-slate-900 dark:text-white">
                {formatRupees(summary.latestValue)}
              </span>

              <span
                className={`inline-flex items-center gap-1 text-xs sm:text-sm font-bold font-mono tabular-nums ${
                  isGain
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {isGain ? (
                  <TrendingUp className="w-4 h-4 shrink-0" />
                ) : (
                  <TrendingDown className="w-4 h-4 shrink-0" />
                )}
                <span>
                  {formatSignedRupees(summary.latestPnL)} ({summary.latestReturnPct >= 0 ? '+' : ''}
                  {summary.latestReturnPct.toFixed(2)}%)
                </span>
              </span>

              {isLoading && (
                <span className="text-xs text-slate-400 dark:text-slate-500">
                  Syncing live quotes...
                </span>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {scope === 'trades'
                ? 'No recorded journal or paper trades found yet.'
                : scope === 'holdings'
                  ? 'No portfolio holdings recorded yet.'
                  : 'Track how your total portfolio equity evolves over time from your recorded trades and holdings.'}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div
            role="group"
            aria-label="Data source filter"
            className="inline-flex items-center rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 border border-slate-200/80 dark:border-slate-700/80"
          >
            {(
              [
                { id: 'all', label: 'All Activity' },
                { id: 'holdings', label: 'Holdings' },
                { id: 'trades', label: 'Trades' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setScope(opt.id)}
                className={`px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  scope === opt.id
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div
            role="group"
            aria-label="Time range"
            className="inline-flex items-center rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 border border-slate-200/80 dark:border-slate-700/80"
          >
            {(['1W', '1M', '3M', 'ALL'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                className={`px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  range === r
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setShowCostBasis((v) => !v)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              showCostBasis
                ? 'bg-blue-50 dark:bg-blue-500/15 border-blue-200 dark:border-blue-500/40 text-blue-700 dark:text-blue-300'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            Cost Basis
          </button>
        </div>
      </div>

      {points.length > 0 ? (
        <>
          <div className="h-[290px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={points} margin={{ top: 10, right: 12, left: 4, bottom: 4 }}>
                <defs>
                  <linearGradient id={`portfolioValueGrad_${gradientId}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={primaryStroke} stopOpacity={isDark ? 0.3 : 0.22} />
                    <stop offset="95%" stopColor={primaryStroke} stopOpacity={0.01} />
                  </linearGradient>
                </defs>

                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />

                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: axisTickColor }}
                  tickLine={false}
                  axisLine={{ stroke: gridStroke }}
                  minTickGap={28}
                />

                <YAxis
                  domain={yDomain}
                  tick={{ fontSize: 11, fill: axisTickColor }}
                  tickLine={false}
                  axisLine={false}
                  width={72}
                  tickFormatter={(v: number) => formatCompactRupees(v)}
                />

                <Tooltip
                  cursor={{ stroke: cursorStroke, strokeDasharray: '3 3', strokeWidth: 1 }}
                  content={({ active, payload }) => {
                    if (!active || !payload || payload.length === 0) return null;
                    const pt = payload[0].payload as PortfolioValuePoint;
                    const pos = pt.netPnL >= 0;

                    return (
                      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm p-3.5 shadow-lg text-xs space-y-2 min-w-[230px]">
                        <div className="font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-1.5 flex items-center justify-between gap-3">
                          <span>
                            {pt.label === 'Cost Basis' || pt.label === 'Now'
                              ? `${formatTrendDateFull(pt.date)} (${pt.label})`
                              : formatTrendDateFull(pt.date)}
                          </span>
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-slate-500 dark:text-slate-400">Portfolio Value</span>
                            <span className="font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                              {formatRupees(pt.totalValue)}
                            </span>
                          </div>

                          <div className="flex items-center justify-between gap-4">
                            <span className="text-slate-500 dark:text-slate-400">Invested Basis</span>
                            <span className="font-semibold font-mono tabular-nums text-slate-700 dark:text-slate-300">
                              {formatRupees(pt.investedValue)}
                            </span>
                          </div>

                          <div className="flex items-center justify-between gap-4">
                            <span className="text-slate-500 dark:text-slate-400">Net Gain / Loss</span>
                            <span
                              className={`font-bold font-mono tabular-nums ${
                                pos
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-rose-600 dark:text-rose-400'
                              }`}
                            >
                              {formatSignedRupees(pt.netPnL)} ({pos ? '+' : ''}
                              {pt.returnPct.toFixed(2)}%)
                            </span>
                          </div>

                          {pt.cashBalance > 0 && (
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-slate-500 dark:text-slate-400">Realized Cash</span>
                              <span className="font-medium font-mono tabular-nums text-slate-600 dark:text-slate-300">
                                {formatRupees(pt.cashBalance)}
                              </span>
                            </div>
                          )}
                        </div>

                        {pt.events.length > 0 && (
                          <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800 space-y-1">
                            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                              Recorded Trades
                            </div>
                            {pt.events.slice(0, 3).map((ev, idx) => (
                              <div
                                key={`${ev.symbol}-${idx}`}
                                className="flex items-center justify-between gap-3 text-[11px] font-mono tabular-nums text-slate-700 dark:text-slate-300"
                              >
                                <span>
                                  {ev.action} {ev.quantity} {ev.symbol}
                                </span>
                                <span className="text-slate-500 dark:text-slate-400">
                                  @ ₹{ev.price.toLocaleString('en-IN', { maximumFractionDigits: 2 })} · {ev.source}
                                </span>
                              </div>
                            ))}
                            {pt.events.length > 3 && (
                              <div className="text-[11px] text-slate-400">
                                +{pt.events.length - 3} more trades on this date
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  }}
                />

                {showCostBasis && (
                  <Area
                    type="stepAfter"
                    dataKey="investedValue"
                    name="Invested Capital"
                    stroke={costStroke}
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    fill="none"
                    dot={false}
                    activeDot={{ r: 3, fill: costStroke, stroke: 'none' }}
                    isAnimationActive={false}
                  />
                )}

                <Area
                  type="monotone"
                  dataKey="totalValue"
                  name="Total Portfolio Value"
                  stroke={primaryStroke}
                  strokeWidth={2.5}
                  fill={`url(#portfolioValueGrad_${gradientId})`}
                  dot={false}
                  activeDot={{
                    r: 5,
                    stroke: primaryStroke,
                    strokeWidth: 2,
                    fill: isDark ? '#0f172a' : '#ffffff',
                  }}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Invested Capital</div>
              <div className="text-sm font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-0.5">
                {formatRupees(summary.latestInvested)}
              </div>
            </div>

            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Period Change ({range})
              </div>
              <div
                className={`text-sm font-bold font-mono tabular-nums mt-0.5 ${
                  summary.periodChange >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {formatSignedRupees(summary.periodChange)} ({summary.periodChangePct >= 0 ? '+' : ''}
                {summary.periodChangePct.toFixed(2)}%)
              </div>
            </div>

            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Period Range (Low – High)</div>
              <div className="text-sm font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-0.5">
                {formatCompactRupees(summary.lowValue)} – {formatCompactRupees(summary.highValue)}
              </div>
            </div>

            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Max Drawdown</div>
              <div className="text-sm font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-0.5">
                {summary.maxDrawdownPct > 0 ? `-${summary.maxDrawdownPct.toFixed(2)}%` : '0.00%'}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>
              {summary.reconstructedFromMarketBars
                ? 'Back-projected using historical daily closes across your active positions.'
                : 'Reconstructed chronologically from recorded trade dates, realized cash flows, and daily market closes.'}
            </span>
            <span className="font-mono tabular-nums">
              {showCostBasis ? 'Solid: Portfolio Value · Dashed: Cost Basis' : 'Solid: Portfolio Value'}
            </span>
          </div>
        </>
      ) : (
        <div className="py-10 px-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/30 text-center space-y-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 mx-auto flex items-center justify-center">
            <AreaChartIcon className="w-5 h-5" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              {hasAnyData
                ? scope === 'trades'
                  ? 'No recorded Journal or Paper trades yet'
                  : 'No portfolio holdings in this view'
                : 'No portfolio trade history yet'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {hasAnyData
                ? 'Switch to All Activity above or record a trade to view its historical value curve.'
                : 'Add a holding with its trade date below, or log trades in Trade Journal or Paper Trading to chart your total portfolio value over time.'}
            </p>
          </div>
          {!hasAnyData && onFocusAddHolding && (
            <button
              type="button"
              onClick={onFocusAddHolding}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              Add First Holding
            </button>
          )}
        </div>
      )}
    </section>
  );
};

export default PortfolioValueTrendChart;
