import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceLine,
  CartesianGrid,
  Cell,
  Line,
  ComposedChart,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  Calendar,
  Sparkles,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Percent,
  CheckCircle2,
  Info,
  Layers,
  Activity,
  Award,
  ShieldCheck,
} from 'lucide-react';
import { DividendPayout } from '../types';

export interface DividendYearlyTotalItem {
  year: string;
  total: number;
  count: number;
}

export interface DividendGrowthChartProps {
  yearlyTotals: DividendYearlyTotalItem[];
  currencySymbol: string;
  symbol: string;
  growthRate5Y?: number;
  dividendYield?: number;
  annualPayout?: number;
  payoutRatio?: number;
  dividends?: DividendPayout[];
  onSelectYear?: (year: string) => void;
}

export const DividendGrowthChart: React.FC<DividendGrowthChartProps> = ({
  yearlyTotals = [],
  currencySymbol = '$',
  symbol = 'STOCK',
  growthRate5Y,
  dividendYield = 0,
  annualPayout,
  payoutRatio,
  dividends = [],
  onSelectYear,
}) => {
  const [chartMetric, setChartMetric] = useState<'amount' | 'growth' | 'composed'>('amount');
  
  const [timeHorizon, setTimeHorizon] = useState<'5y' | 'all'>('5y');

  const [activeYear, setActiveYear] = useState<string | null>(null);

  const sortedAllData = useMemo(() => {
    if (!yearlyTotals || yearlyTotals.length === 0) return [];
    return [...yearlyTotals].sort((a, b) => a.year.localeCompare(b.year));
  }, [yearlyTotals]);

  const processedData = useMemo(() => {
    const sourceData = timeHorizon === '5y' ? sortedAllData.slice(-5) : sortedAllData;
    
    return sourceData.map((item, index) => {
      const fullIndex = sortedAllData.findIndex((d) => d.year === item.year);
      const prevItem = fullIndex > 0 ? sortedAllData[fullIndex - 1] : null;
      
      let yoyAmount = 0;
      let yoyPercent = 0;
      let isPositive = true;

      if (prevItem && prevItem.total > 0) {
        yoyAmount = Number((item.total - prevItem.total).toFixed(2));
        yoyPercent = Number((((item.total - prevItem.total) / prevItem.total) * 100).toFixed(1));
        isPositive = yoyAmount >= 0;
      }

      return {
        year: item.year,
        total: Number(item.total.toFixed(2)),
        count: item.count,
        yoyAmount,
        yoyPercent,
        isPositive,
        trendLine: Number(item.total.toFixed(2)),
      };
    });
  }, [sortedAllData, timeHorizon]);

  const fiveYearStats = useMemo(() => {
    const last5 = sortedAllData.slice(-5);
    if (last5.length === 0) {
      return {
        cagr: growthRate5Y ?? 0,
        totalPaid5Y: 0,
        avgAnnual: 0,
        totalGrowth5Y: 0,
        yearsAvailable: 0,
        consistencyStreak: 0,
        highestYear: null as DividendYearlyTotalItem | null,
        lowestYear: null as DividendYearlyTotalItem | null,
        annualizedSharesReturn: 0,
      };
    }

    const firstYear = last5[0];
    const latestYear = last5[last5.length - 1];
    const totalPaid5Y = Number(last5.reduce((sum, item) => sum + item.total, 0).toFixed(2));
    const avgAnnual = Number((totalPaid5Y / last5.length).toFixed(2));

    const yearsSpan = Math.max(1, last5.length - 1);
    let calculatedCagr = 0;
    if (firstYear.total > 0 && latestYear.total > 0 && yearsSpan >= 1) {
      calculatedCagr = Number(
        ((Math.pow(latestYear.total / firstYear.total, 1 / yearsSpan) - 1) * 100).toFixed(1)
      );
    } else if (growthRate5Y != null) {
      calculatedCagr = growthRate5Y;
    }

    const totalGrowth5Y =
      firstYear.total > 0
        ? Number((((latestYear.total - firstYear.total) / firstYear.total) * 100).toFixed(1))
        : 0;

    const consistencyStreak = last5.filter((item) => item.total > 0).length;

    let highest = last5[0];
    let lowest = last5[0];
    for (const item of last5) {
      if (item.total > highest.total) highest = item;
      if (item.total < lowest.total) lowest = item;
    }

    return {
      cagr: calculatedCagr,
      totalPaid5Y,
      avgAnnual,
      totalGrowth5Y,
      yearsAvailable: last5.length,
      consistencyStreak,
      highestYear: highest,
      lowestYear: lowest,
      annualizedSharesReturn: Number((totalPaid5Y * 100).toFixed(2)), 
    };
  }, [sortedAllData, growthRate5Y]);

  const highlightedData = useMemo(() => {
    if (!activeYear) return processedData[processedData.length - 1] || null;
    return processedData.find((d) => d.year === activeYear) || processedData[processedData.length - 1] || null;
  }, [processedData, activeYear]);

  const averagePayoutInView = useMemo(() => {
    if (processedData.length === 0) return 0;
    const sum = processedData.reduce((acc, curr) => acc + curr.total, 0);
    return Number((sum / processedData.length).toFixed(2));
  }, [processedData]);

  if (processedData.length === 0) {
    return (
      <div className="p-8 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-center space-y-2">
        <Info className="w-8 h-8 text-slate-400 mx-auto" />
        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
          No Historical Dividend Growth Data
        </h4>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
          Historical annual totals are not currently available for {symbol}.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              <BarChart3 className="w-4 h-4" />
            </div>
            <h4 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <span>Historical Dividend Growth Trend</span>
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                {timeHorizon === '5y' ? '5-Year Horizon' : 'Full History'}
              </span>
            </h4>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Track annual per-share dividend payout increases, YoY expansion, and consistency for {symbol}.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-slate-100 dark:bg-slate-800/90 p-1 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700/80">
            <button
              onClick={() => setTimeHorizon('5y')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                timeHorizon === '5y'
                  ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm font-extrabold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Last 5 Years
            </button>
            <button
              onClick={() => setTimeHorizon('all')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                timeHorizon === 'all'
                  ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm font-extrabold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              All Years ({sortedAllData.length})
            </button>
          </div>

          <div className="flex items-center bg-slate-100 dark:bg-slate-800/90 p-1 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700/80">
            <button
              onClick={() => setChartMetric('amount')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                chartMetric === 'amount'
                  ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm font-extrabold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Display annual payout amounts in bar chart"
            >
              Payouts ({currencySymbol})
            </button>
            <button
              onClick={() => setChartMetric('growth')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                chartMetric === 'growth'
                  ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm font-extrabold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Display year-over-year growth percentage"
            >
              YoY Growth (%)
            </button>
            <button
              onClick={() => setChartMetric('composed')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                chartMetric === 'composed'
                  ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm font-extrabold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Display payout bars with growth trendline overlay"
            >
              Bars + Trendline
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              5-Year Dividend CAGR
            </span>
            <div className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <Sparkles className="w-3 h-3" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">
              {fiveYearStats.cagr >= 0 ? `+${fiveYearStats.cagr}%` : `${fiveYearStats.cagr}%`}
            </span>
            <span className="text-[10px] text-slate-400 font-semibold">Annualized</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-emerald-500" />
            <span>Compounded annual dividend growth</span>
          </p>
        </div>

        <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              5-Year Cumulative Paid
            </span>
            <div className="w-5 h-5 rounded-full bg-cyan-500/10 text-cyan-500 flex items-center justify-center">
              <DollarSign className="w-3 h-3" />
            </div>
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-xl font-black text-slate-900 dark:text-white">
              {currencySymbol}{fiveYearStats.totalPaid5Y.toFixed(2)}
            </span>
            <span className="text-[10px] text-slate-400">/ share</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-1">
            {currencySymbol}{fiveYearStats.annualizedSharesReturn.toFixed(0)} total income per 100 shares held
          </p>
        </div>

        <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              5Y Net Dividend Expansion
            </span>
            <div className="w-5 h-5 rounded-full bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
              <ArrowUpRight className="w-3 h-3" />
            </div>
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-xl font-black text-indigo-600 dark:text-indigo-400">
              {fiveYearStats.totalGrowth5Y >= 0 ? `+${fiveYearStats.totalGrowth5Y}%` : `${fiveYearStats.totalGrowth5Y}%`}
            </span>
            <span className="text-[10px] text-slate-400">Overall</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-1">
            Growth from {processedData[0]?.year} to {processedData[processedData.length - 1]?.year}
          </p>
        </div>

        <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Average Annual Payout
            </span>
            <div className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <ShieldCheck className="w-3 h-3" />
            </div>
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-xl font-black text-slate-900 dark:text-white">
              {currencySymbol}{fiveYearStats.avgAnnual.toFixed(2)}
            </span>
            <span className="text-[10px] text-slate-400">/ yr avg</span>
          </div>
          <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>{fiveYearStats.consistencyStreak}/{fiveYearStats.yearsAvailable} Years Unbroken Payouts</span>
          </p>
        </div>
      </div>

      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
              {chartMetric === 'amount' && `Annual Dividend Payouts Per Share (${currencySymbol})`}
              {chartMetric === 'growth' && 'Year-over-Year (YoY) Dividend Growth Rate (%)'}
              {chartMetric === 'composed' && `Annual Payouts with 5-Year Growth Trajectory (${currencySymbol})`}
            </span>
            <span className="text-[11px] text-slate-400">
              • Showing {processedData.length} fiscal years ({processedData[0]?.year} - {processedData[processedData.length - 1]?.year})
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs">
            {chartMetric !== 'growth' && (
              <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                <span className="w-3 h-1.5 rounded-full bg-emerald-500"></span>
                <span>Annual Total</span>
              </div>
            )}
            {chartMetric === 'composed' && (
              <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                <span className="w-3 h-0.5 bg-cyan-400"></span>
                <span>Trendline</span>
              </div>
            )}
            {chartMetric === 'growth' && (
              <>
                <div className="flex items-center gap-1 text-emerald-500 font-medium">
                  <span className="w-2.5 h-2.5 rounded bg-emerald-500"></span>
                  <span>Expansion (+)</span>
                </div>
                <div className="flex items-center gap-1 text-rose-500 font-medium">
                  <span className="w-2.5 h-2.5 rounded bg-rose-500"></span>
                  <span>Reduction (-)</span>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="h-72 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            {chartMetric === 'composed' ? (
              <ComposedChart
                data={processedData}
                margin={{ top: 20, right: 20, left: 0, bottom: 5 }}
                onClick={(e) => {
                  if (e && e.activePayload && e.activePayload.length) {
                    const yr = e.activePayload[0].payload.year;
                    setActiveYear(yr);
                    if (onSelectYear) onSelectYear(yr);
                  }
                }}
              >
                <defs>
                  <linearGradient id="divEmeraldGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.95} />
                    <stop offset="100%" stopColor="#047857" stopOpacity={0.8} />
                  </linearGradient>
                  <linearGradient id="divCyanGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.95} />
                    <stop offset="100%" stopColor="#0e7490" stopOpacity={0.8} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} vertical={false} />
                <XAxis
                  dataKey="year"
                  stroke="#94a3b8"
                  tick={{ fontSize: 12, fontWeight: 700 }}
                  tickLine={false}
                />
                <YAxis
                  stroke="#94a3b8"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  tickFormatter={(val) => `${currencySymbol}${val}`}
                />
                <ReferenceLine
                  y={averagePayoutInView}
                  stroke="#64748b"
                  strokeDasharray="4 4"
                  label={{
                    value: `Avg: ${currencySymbol}${averagePayoutInView}`,
                    position: 'top',
                    fill: '#94a3b8',
                    fontSize: 10,
                    fontWeight: 600,
                  }}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const item = payload[0].payload;
                      return (
                        <div className="bg-slate-900/95 text-white p-3.5 rounded-xl border border-slate-700/80 shadow-2xl text-xs space-y-2 backdrop-blur-md min-w-[210px]">
                          <div className="flex items-center justify-between pb-1.5 border-b border-slate-800 font-extrabold">
                            <span className="text-emerald-400 flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5" /> Fiscal Year {item.year}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                              {item.count} {item.count === 1 ? 'Payout' : 'Payouts'}
                            </span>
                          </div>

                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-slate-400">Total Dividend:</span>
                              <span className="font-black text-sm text-white">
                                {currencySymbol}{item.total.toFixed(2)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-slate-400">YoY Change:</span>
                              <span
                                className={`font-bold flex items-center gap-0.5 ${
                                  item.yoyAmount >= 0 ? 'text-emerald-400' : 'text-rose-400'
                                }`}
                              >
                                {item.yoyAmount >= 0 ? '+' : ''}
                                {currencySymbol}{item.yoyAmount.toFixed(2)} ({item.yoyPercent >= 0 ? '+' : ''}{item.yoyPercent}%)
                              </span>
                            </div>
                            <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-[11px]">
                              <span className="text-slate-400">Per 100 Shares:</span>
                              <span className="font-semibold text-emerald-300">
                                {currencySymbol}{(item.total * 100).toFixed(2)}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar
                  dataKey="total"
                  name="Annual Total"
                  radius={[8, 8, 0, 0]}
                  barSize={40}
                >
                  {processedData.map((entry, index) => {
                    const isLatest = index === processedData.length - 1;
                    const isSelected = activeYear === entry.year;
                    return (
                      <Cell
                        key={`bar-${index}`}
                        fill={isLatest || isSelected ? 'url(#divCyanGradient)' : 'url(#divEmeraldGradient)'}
                        stroke={isSelected ? '#38bdf8' : 'none'}
                        strokeWidth={isSelected ? 2 : 0}
                        cursor="pointer"
                      />
                    );
                  })}
                </Bar>
                <Line
                  type="monotone"
                  dataKey="trendLine"
                  name="Growth Trend"
                  stroke="#38bdf8"
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#38bdf8', strokeWidth: 2, stroke: '#0f172a' }}
                  activeDot={{ r: 6, fill: '#38bdf8' }}
                />
              </ComposedChart>
            ) : chartMetric === 'growth' ? (
              <BarChart
                data={processedData}
                margin={{ top: 20, right: 20, left: 0, bottom: 5 }}
                onClick={(e) => {
                  if (e && e.activePayload && e.activePayload.length) {
                    const yr = e.activePayload[0].payload.year;
                    setActiveYear(yr);
                    if (onSelectYear) onSelectYear(yr);
                  }
                }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} vertical={false} />
                <XAxis
                  dataKey="year"
                  stroke="#94a3b8"
                  tick={{ fontSize: 12, fontWeight: 700 }}
                  tickLine={false}
                />
                <YAxis
                  stroke="#94a3b8"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  tickFormatter={(val) => `${val}%`}
                />
                <ReferenceLine y={0} stroke="#64748b" strokeWidth={1.5} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const item = payload[0].payload;
                      return (
                        <div className="bg-slate-900/95 text-white p-3.5 rounded-xl border border-slate-700/80 shadow-2xl text-xs space-y-2 backdrop-blur-md min-w-[210px]">
                          <div className="flex items-center justify-between pb-1.5 border-b border-slate-800 font-extrabold">
                            <span className="text-cyan-400">Fiscal Year {item.year}</span>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                                item.yoyPercent >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                              }`}
                            >
                              {item.yoyPercent >= 0 ? '+' : ''}{item.yoyPercent}% YoY
                            </span>
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-slate-400">Total Payout:</span>
                              <span className="font-bold text-white">
                                {currencySymbol}{item.total.toFixed(2)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-slate-400">Absolute Change:</span>
                              <span className={item.yoyAmount >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                                {item.yoyAmount >= 0 ? '+' : ''}{currencySymbol}{item.yoyAmount.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar
                  dataKey="yoyPercent"
                  name="YoY Growth (%)"
                  radius={[6, 6, 0, 0]}
                  barSize={38}
                >
                  {processedData.map((entry, index) => (
                    <Cell
                      key={`growth-cell-${index}`}
                      fill={entry.yoyPercent >= 0 ? '#10b981' : '#f43f5e'}
                      cursor="pointer"
                    />
                  ))}
                </Bar>
              </BarChart>
            ) : (
              <BarChart
                data={processedData}
                margin={{ top: 20, right: 20, left: 0, bottom: 5 }}
                onClick={(e) => {
                  if (e && e.activePayload && e.activePayload.length) {
                    const yr = e.activePayload[0].payload.year;
                    setActiveYear(yr);
                    if (onSelectYear) onSelectYear(yr);
                  }
                }}
              >
                <defs>
                  <linearGradient id="payoutBarGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.95} />
                    <stop offset="100%" stopColor="#059669" stopOpacity={0.8} />
                  </linearGradient>
                  <linearGradient id="payoutBarHighlight" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.95} />
                    <stop offset="100%" stopColor="#0284c7" stopOpacity={0.8} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} vertical={false} />
                <XAxis
                  dataKey="year"
                  stroke="#94a3b8"
                  tick={{ fontSize: 12, fontWeight: 700 }}
                  tickLine={false}
                />
                <YAxis
                  stroke="#94a3b8"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  tickFormatter={(val) => `${currencySymbol}${val}`}
                />
                <ReferenceLine
                  y={averagePayoutInView}
                  stroke="#64748b"
                  strokeDasharray="4 4"
                  label={{
                    value: `5Y Avg: ${currencySymbol}${averagePayoutInView}`,
                    position: 'top',
                    fill: '#94a3b8',
                    fontSize: 10,
                    fontWeight: 600,
                  }}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const item = payload[0].payload;
                      return (
                        <div className="bg-slate-900/95 text-white p-3.5 rounded-xl border border-slate-700/80 shadow-2xl text-xs space-y-2 backdrop-blur-md min-w-[210px]">
                          <div className="flex items-center justify-between pb-1.5 border-b border-slate-800 font-extrabold">
                            <span className="text-emerald-400 flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5" /> Fiscal Year {item.year}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                              {item.count} {item.count === 1 ? 'Payout' : 'Payouts'}
                            </span>
                          </div>

                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-slate-400">Total Dividend:</span>
                              <span className="font-black text-sm text-white">
                                {currencySymbol}{item.total.toFixed(2)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-slate-400">YoY Growth:</span>
                              <span
                                className={`font-bold flex items-center gap-0.5 ${
                                  item.yoyAmount >= 0 ? 'text-emerald-400' : 'text-rose-400'
                                }`}
                              >
                                {item.yoyAmount >= 0 ? '+' : ''}
                                {currencySymbol}{item.yoyAmount.toFixed(2)} ({item.yoyPercent >= 0 ? '+' : ''}{item.yoyPercent}%)
                              </span>
                            </div>
                            <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-[11px]">
                              <span className="text-slate-400">Est. Income (100 sh):</span>
                              <span className="font-semibold text-emerald-300">
                                {currencySymbol}{(item.total * 100).toFixed(2)}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar
                  dataKey="total"
                  name="Annual Dividend"
                  radius={[8, 8, 0, 0]}
                  barSize={42}
                >
                  {processedData.map((entry, index) => {
                    const isLatest = index === processedData.length - 1;
                    const isSelected = activeYear === entry.year;
                    return (
                      <Cell
                        key={`bar-${index}`}
                        fill={isLatest || isSelected ? 'url(#payoutBarHighlight)' : 'url(#payoutBarGradient)'}
                        stroke={isSelected ? '#38bdf8' : 'none'}
                        strokeWidth={isSelected ? 2 : 0}
                        cursor="pointer"
                      />
                    );
                  })}
                </Bar>
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>

        {highlightedData && (
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold flex-shrink-0">
                <Award className="w-4 h-4" />
              </div>
              <div>
                <span className="font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                  Year {highlightedData.year} Snapshot
                  {highlightedData.year === processedData[processedData.length - 1]?.year && (
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                      Latest Full Year
                    </span>
                  )}
                </span>
                <span className="text-slate-500 dark:text-slate-400 block text-[11px] mt-0.5">
                  {highlightedData.count} dividend distribution{highlightedData.count > 1 ? 's' : ''} paid totaling{' '}
                  <strong className="text-slate-800 dark:text-slate-200">
                    {currencySymbol}{highlightedData.total.toFixed(2)}
                  </strong>{' '}
                  per share
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">YoY Growth</span>
                <span
                  className={`font-black text-sm flex items-center gap-0.5 ${
                    highlightedData.yoyPercent >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {highlightedData.yoyPercent >= 0 ? (
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  ) : (
                    <ArrowDownRight className="w-3.5 h-3.5" />
                  )}
                  {highlightedData.yoyPercent >= 0 ? '+' : ''}{highlightedData.yoyPercent}%
                </span>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">100 Shares Income</span>
                <span className="font-black text-sm text-slate-900 dark:text-white">
                  {currencySymbol}{(highlightedData.total * 100).toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
          <h5 className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-emerald-500" />
            <span>5-Year Dividend Progression & Payout History</span>
          </h5>
          <span className="text-[11px] text-slate-400">
            Click any row to inspect historical growth details
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 uppercase tracking-wider">
                <th className="py-2.5 px-3 font-bold">Year</th>
                <th className="py-2.5 px-3 font-bold">Annual Dividend / Share</th>
                <th className="py-2.5 px-3 font-bold">YoY Growth Rate</th>
                <th className="py-2.5 px-3 font-bold">Net Change</th>
                <th className="py-2.5 px-3 font-bold">Payouts</th>
                <th className="py-2.5 px-3 font-bold text-right">Income (100 Shares)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
              {[...processedData].reverse().map((row, idx) => {
                const isSelected = activeYear === row.year;
                const isLatest = idx === 0;

                return (
                  <tr
                    key={row.year}
                    onClick={() => {
                      setActiveYear(row.year);
                      if (onSelectYear) onSelectYear(row.year);
                    }}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-emerald-500/10 dark:bg-emerald-500/15'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <td className="py-2.5 px-3 font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span>{row.year}</span>
                      {isLatest && (
                        <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                          Latest
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-slate-100">
                      {currencySymbol}{row.total.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-black ${
                          row.yoyPercent > 0
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                            : row.yoyPercent < 0
                            ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                        }`}
                      >
                        {row.yoyPercent > 0 ? (
                          <ArrowUpRight className="w-3 h-3" />
                        ) : row.yoyPercent < 0 ? (
                          <ArrowDownRight className="w-3 h-3" />
                        ) : null}
                        {row.yoyPercent >= 0 ? '+' : ''}{row.yoyPercent}%
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                      {row.yoyAmount !== 0 ? (
                        <span className={row.yoyAmount > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                          {row.yoyAmount > 0 ? '+' : ''}{currencySymbol}{row.yoyAmount.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-slate-400">Base Year</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                      {row.count} distribution{row.count > 1 ? 's' : ''}
                    </td>
                    <td className="py-2.5 px-3 text-right font-extrabold text-emerald-600 dark:text-emerald-400">
                      {currencySymbol}{(row.total * 100).toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
