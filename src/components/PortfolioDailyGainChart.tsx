import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import { TrendingUp, TrendingDown, BarChart3, Calendar } from 'lucide-react';
import { PortfolioHolding, PriceBar } from '../types';

export interface PortfolioLiveQuote {
  price: number;
  change: number;
  changePct: number;
  bars: PriceBar[];
}

interface PortfolioDailyGainChartProps {
  holdings: PortfolioHolding[];
  liveQuotes: Record<string, PortfolioLiveQuote>;
  isLoading: boolean;
  theme?: 'Light' | 'Dark';
}

interface TrendPoint {
  date: string;
  label: string;
  dailyGain: number;
  dailyPct: number;
  cumulativeGain: number;
  cumulativePct: number;
  portfolioValue: number;
}

const normalizeKey = (sym: string) =>
  sym.toUpperCase().replace('.NS', '').replace('.BO', '').trim();

const formatCompactRupees = (val: number): string => {
  const sign = val < 0 ? '-' : val > 0 ? '+' : '';
  const abs = Math.abs(val);
  if (abs >= 1e7) return `${sign}₹${(abs / 1e7).toFixed(2)}Cr`;
  if (abs >= 1e5) return `${sign}₹${(abs / 1e5).toFixed(2)}L`;
  if (abs >= 1e3) return `${sign}₹${(abs / 1e3).toFixed(1)}k`;
  return `${sign}₹${abs.toFixed(0)}`;
};

const formatSignedRupees = (val: number): string => {
  const abs = Math.abs(val).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${val >= 0 ? '+' : '-'}₹${abs}`;
};

const formatDateShort = (isoDate: string): string => {
  const d = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate.slice(5);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
};

const formatDateFull = (isoDate: string): string => {
  const d = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

export const PortfolioDailyGainChart: React.FC<PortfolioDailyGainChartProps> = ({
  holdings,
  liveQuotes,
  isLoading,
  theme,
}) => {
  const [unitMode, setUnitMode] = useState<'amount' | 'percent'>('amount');
  const [showDailyBars, setShowDailyBars] = useState<boolean>(true);

  const isDark =
    theme === 'Dark' ||
    (theme === undefined &&
      typeof document !== 'undefined' &&
      document.documentElement.classList.contains('dark'));

  const series = useMemo(() => {
    if (holdings.length === 0) return [];

    const holdingSeries = holdings
      .map((h) => {
        const quote = liveQuotes[normalizeKey(h.symbol)];
        if (!quote || !Array.isArray(quote.bars) || quote.bars.length < 2) {
          return null;
        }
        const sortedBars = [...quote.bars]
          .filter((b) => b && b.date && Number.isFinite(b.close) && b.close > 0)
          .sort((a, b) => a.date.localeCompare(b.date));

        if (sortedBars.length < 2) return null;

        const closeByDate = new Map<string, number>();
        for (const bar of sortedBars) {
          closeByDate.set(bar.date, bar.close);
        }

        return {
          holding: h,
          quote,
          sortedBars,
          closeByDate,
          lastBarDate: sortedBars[sortedBars.length - 1].date,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    if (holdingSeries.length === 0) return [];

    const dateSet = new Set<string>();
    for (const item of holdingSeries) {
      for (const bar of item.sortedBars) {
        dateSet.add(bar.date);
      }
    }
    const allDates = Array.from(dateSet).sort((a, b) => a.localeCompare(b));
    if (allDates.length < 2) return [];

    const windowDates = allDates.slice(-31);
    const baseDate = windowDates[0];
    const activeDates = windowDates.slice(1);
    const lastActiveDate = activeDates[activeDates.length - 1];

    const filledCloses = holdingSeries.map((item) => {
      let lastKnown: number | null = null;
      for (const bar of item.sortedBars) {
        if (bar.date <= baseDate) {
          lastKnown = bar.close;
        } else {
          break;
        }
      }
      if (lastKnown === null) {
        lastKnown = item.sortedBars[0].close;
      }

      const closes = new Map<string, number>();
      for (const dt of windowDates) {
        const exact = item.closeByDate.get(dt);
        if (exact !== undefined) {
          lastKnown = exact;
        }
        closes.set(dt, lastKnown);
      }
      return { ...item, closes };
    });

    let basePortfolioValue = 0;
    for (const item of filledCloses) {
      basePortfolioValue += item.holding.quantity * (item.closes.get(baseDate) ?? item.holding.buyPrice);
    }

    let runningCumulativeGain = 0;
    const points: TrendPoint[] = [];

    for (let i = 0; i < activeDates.length; i++) {
      const dt = activeDates[i];
      const prevDt = i === 0 ? baseDate : activeDates[i - 1];
      const isFinalSession = dt === lastActiveDate;

      let dailyGain = 0;
      let prevTotalValue = 0;
      let currentTotalValue = 0;

      for (const item of filledCloses) {
        const prevClose = item.closes.get(prevDt) ?? item.holding.buyPrice;
        let currClose = item.closes.get(dt) ?? prevClose;

        if (isFinalSession && item.quote.price > 0) {
          const livePrev = item.quote.price - item.quote.change;
          if (Number.isFinite(item.quote.change) && livePrev > 0) {
            dailyGain += item.holding.quantity * item.quote.change;
            prevTotalValue += item.holding.quantity * livePrev;
            currentTotalValue += item.holding.quantity * item.quote.price;
            continue;
          }
          currClose = item.quote.price;
        }

        dailyGain += item.holding.quantity * (currClose - prevClose);
        prevTotalValue += item.holding.quantity * prevClose;
        currentTotalValue += item.holding.quantity * currClose;
      }

      runningCumulativeGain += dailyGain;
      const dailyPct = prevTotalValue > 0 ? (dailyGain / prevTotalValue) * 100 : 0;
      const cumulativePct =
        basePortfolioValue > 0 ? (runningCumulativeGain / basePortfolioValue) * 100 : 0;

      points.push({
        date: dt,
        label: formatDateShort(dt),
        dailyGain: Number(dailyGain.toFixed(2)),
        dailyPct: Number(dailyPct.toFixed(2)),
        cumulativeGain: Number(runningCumulativeGain.toFixed(2)),
        cumulativePct: Number(cumulativePct.toFixed(2)),
        portfolioValue: Number(currentTotalValue.toFixed(2)),
      });
    }

    return points;
  }, [holdings, liveQuotes]);

  const stats = useMemo(() => {
    if (series.length === 0) return null;
    const latest = series[series.length - 1];
    let best = series[0];
    let worst = series[0];
    let greenDays = 0;

    for (const pt of series) {
      if (pt.dailyGain > best.dailyGain) best = pt;
      if (pt.dailyGain < worst.dailyGain) worst = pt;
      if (pt.dailyGain >= 0) greenDays++;
    }

    return {
      totalCumulativeGain: latest.cumulativeGain,
      totalCumulativePct: latest.cumulativePct,
      bestDay: best,
      worstDay: worst,
      greenDays,
      totalDays: series.length,
    };
  }, [series]);

  if (holdings.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2 mb-1.5">
          <BarChart3 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            30-Day Cumulative Daily Gain
          </h3>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Add one or more holdings below to visualize your portfolio&apos;s historical 30-session cumulative daily gain trend.
        </p>
      </div>
    );
  }

  const isPositiveTrend = (stats?.totalCumulativeGain ?? 0) >= 0;
  const strokeColor = isPositiveTrend ? '#10b981' : '#f43f5e';
  const gridStroke = isDark ? '#1e293b' : '#e2e8f0';
  const axisTickColor = isDark ? '#94a3b8' : '#64748b';
  const zeroLineColor = isDark ? '#475569' : '#94a3b8';

  return (
    <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              30-Day Cumulative Daily Gain
            </h3>
            {stats && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                <Calendar className="w-3 h-3" />
                {stats.totalDays} trading sessions
              </span>
            )}
          </div>
          {stats ? (
            <div className="flex items-baseline gap-2.5 flex-wrap">
              <span
                className={`text-xl sm:text-2xl font-extrabold font-mono tabular-nums ${
                  isPositiveTrend
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {formatSignedRupees(stats.totalCumulativeGain)}
              </span>
              <span
                className={`inline-flex items-center gap-1 text-xs font-bold font-mono tabular-nums ${
                  isPositiveTrend
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {isPositiveTrend ? (
                  <TrendingUp className="w-3.5 h-3.5" />
                ) : (
                  <TrendingDown className="w-3.5 h-3.5" />
                )}
                {stats.totalCumulativePct >= 0 ? '+' : ''}
                {stats.totalCumulativePct.toFixed(2)}% (30D)
              </span>
            </div>
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isLoading
                ? 'Loading historical trading sessions...'
                : 'Historical bars unavailable for current holdings.'}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex items-center rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 border border-slate-200/80 dark:border-slate-700/80">
            <button
              type="button"
              onClick={() => setUnitMode('amount')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                unitMode === 'amount'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Gain (₹)
            </button>
            <button
              type="button"
              onClick={() => setUnitMode('percent')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                unitMode === 'percent'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Return (%)
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowDailyBars((v) => !v)}
            className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
              showDailyBars
                ? 'bg-blue-50 dark:bg-blue-500/15 border-blue-200 dark:border-blue-500/40 text-blue-700 dark:text-blue-300'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            Daily Bars
          </button>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 flex items-center justify-between gap-2">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Best Session ({stats.bestDay.label})
            </span>
            <span className="text-xs font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
              {formatSignedRupees(stats.bestDay.dailyGain)}
            </span>
          </div>

          <div className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 flex items-center justify-between gap-2">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Worst Session ({stats.worstDay.label})
            </span>
            <span className="text-xs font-bold font-mono tabular-nums text-rose-600 dark:text-rose-400">
              {formatSignedRupees(stats.worstDay.dailyGain)}
            </span>
          </div>

          <div className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 flex items-center justify-between gap-2">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Positive Sessions
            </span>
            <span className="text-xs font-bold font-mono tabular-nums text-slate-900 dark:text-white">
              {stats.greenDays} / {stats.totalDays} (
              {Math.round((stats.greenDays / stats.totalDays) * 100)}%)
            </span>
          </div>
        </div>
      )}

      {series.length > 0 ? (
        <div className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={series}
              margin={{ top: 10, right: 12, left: 4, bottom: 2 }}
            >
              <defs>
                <linearGradient id="portfolioCumulativeFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={strokeColor} stopOpacity={isDark ? 0.28 : 0.2} />
                  <stop offset="95%" stopColor={strokeColor} stopOpacity={0.01} />
                </linearGradient>
              </defs>

              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke={gridStroke}
              />

              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: axisTickColor }}
                tickLine={false}
                axisLine={{ stroke: gridStroke }}
                minTickGap={22}
              />

              <YAxis
                tick={{ fontSize: 11, fill: axisTickColor }}
                tickLine={false}
                axisLine={false}
                width={66}
                tickFormatter={(v: number) =>
                  unitMode === 'amount'
                    ? formatCompactRupees(v)
                    : `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`
                }
              />

              <ReferenceLine
                y={0}
                stroke={zeroLineColor}
                strokeDasharray="4 4"
                strokeWidth={1}
              />

              <Tooltip
                cursor={{ stroke: zeroLineColor, strokeDasharray: '3 3' }}
                content={({ active, payload }) => {
                  if (!active || !payload || payload.length === 0) return null;
                  const pt = payload[0].payload as TrendPoint;
                  const cumPos = pt.cumulativeGain >= 0;
                  const dayPos = pt.dailyGain >= 0;

                  return (
                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm p-3 shadow-lg text-xs space-y-1.5 min-w-[200px]">
                      <div className="font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-1.5">
                        {formatDateFull(pt.date)}
                      </div>

                      <div className="flex items-center justify-between gap-4">
                        <span className="text-slate-500 dark:text-slate-400">
                          Cumulative Gain
                        </span>
                        <span
                          className={`font-bold font-mono tabular-nums ${
                            cumPos
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {formatSignedRupees(pt.cumulativeGain)} ({cumPos ? '+' : ''}
                          {pt.cumulativePct.toFixed(2)}%)
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-4">
                        <span className="text-slate-500 dark:text-slate-400">
                          Daily Gain
                        </span>
                        <span
                          className={`font-semibold font-mono tabular-nums ${
                            dayPos
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {formatSignedRupees(pt.dailyGain)} ({dayPos ? '+' : ''}
                          {pt.dailyPct.toFixed(2)}%)
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-4 pt-1 border-t border-slate-100 dark:border-slate-800">
                        <span className="text-slate-500 dark:text-slate-400">
                          Portfolio Value
                        </span>
                        <span className="font-semibold font-mono tabular-nums text-slate-900 dark:text-white">
                          ₹
                          {pt.portfolioValue.toLocaleString('en-IN', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                    </div>
                  );
                }}
              />

              {showDailyBars && (
                <Bar
                  dataKey={unitMode === 'amount' ? 'dailyGain' : 'dailyPct'}
                  barSize={10}
                  radius={[2, 2, 2, 2]}
                  isAnimationActive={false}
                >
                  {series.map((entry) => (
                    <Cell
                      key={entry.date}
                      fill={entry.dailyGain >= 0 ? '#10b981' : '#f43f5e'}
                      fillOpacity={isDark ? 0.35 : 0.28}
                    />
                  ))}
                </Bar>
              )}

              <Area
                type="monotone"
                dataKey={unitMode === 'amount' ? 'cumulativeGain' : 'cumulativePct'}
                stroke={strokeColor}
                strokeWidth={2.25}
                fill="url(#portfolioCumulativeFill)"
                activeDot={{
                  r: 4.5,
                  stroke: strokeColor,
                  strokeWidth: 2,
                  fill: isDark ? '#0f172a' : '#ffffff',
                }}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-[220px] w-full rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-800 flex items-center justify-center text-xs text-slate-500 dark:text-slate-400">
          {isLoading
            ? 'Fetching 30-day historical market prices for your holdings...'
            : 'Click Refresh Prices to load 30-day historical gain data.'}
        </div>
      )}

      <p className="text-[11px] text-slate-500 dark:text-slate-400">
        Calculated from real daily closing prices across your current holdings over the last 30 trading sessions.
      </p>
    </div>
  );
};

export default PortfolioDailyGainChart;
