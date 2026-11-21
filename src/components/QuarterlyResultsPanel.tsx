import React, { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { RefreshCw, BarChart3, Calendar, AlertCircle, FileSpreadsheet } from 'lucide-react';
import { AnalysisResult } from '../types';
import { fetchQuarterlyResults, QuarterlyResultsResponse } from '../utils/stockApi';

interface QuarterlyResultsPanelProps {
  data: AnalysisResult;
  compact?: boolean;
}

function formatScaledAmount(val: number | null | undefined, currency: string, currSym: string): string {
  if (val === null || val === undefined || !Number.isFinite(val)) return 'N/A';
  const sign = val < 0 ? '-' : '';
  const abs = Math.abs(val);
  if (currency === 'INR') {
    const cr = abs / 1e7;
    if (cr >= 1) return `${sign}${currSym}${cr.toLocaleString('en-IN', { maximumFractionDigits: 1 })} Cr`;
    const lk = abs / 1e5;
    return `${sign}${currSym}${lk.toLocaleString('en-IN', { maximumFractionDigits: 1 })} L`;
  }
  if (abs >= 1e9) return `${sign}${currSym}${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}${currSym}${(abs / 1e6).toFixed(1)}M`;
  return `${sign}${currSym}${abs.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

function formatChartUnit(val: number, currency: string): number {
  if (!Number.isFinite(val)) return 0;
  return currency === 'INR' ? Number((val / 1e7).toFixed(2)) : Number((val / 1e6).toFixed(2));
}

function fmtPctBadge(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;
}

export const QuarterlyResultsPanel: React.FC<QuarterlyResultsPanelProps> = ({ data, compact = false }) => {
  const [state, setState] = useState<{
    loading: boolean;
    res: QuarterlyResultsResponse | null;
  }>({ loading: true, res: null });

  const [chartMode, setChartMode] = useState<'rev_profit' | 'eps'>('rev_profit');
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    let alive = true;
    setState({ loading: true, res: null });
    fetchQuarterlyResults(data.displaySymbol, data.market).then((res) => {
      if (alive) setState({ loading: false, res });
    });
    return () => {
      alive = false;
    };
  }, [data.displaySymbol, data.market, reloadTick]);

  const res = state.res;
  const currency = res?.currency || (data.market === 'US' ? 'USD' : 'INR');
  const currSym = res?.currencySymbol || data.currencySymbol || '₹';
  const unitLabel = currency === 'INR' ? '₹ Cr' : '$ Millions';

  const latestQ = res?.quarters?.[0] || null;
  const chronologicalQuarters = useMemo(
    () => (res?.quarters ? [...res.quarters].reverse() : []),
    [res?.quarters]
  );

  const chartData = useMemo(() => {
    return chronologicalQuarters.map((q) => ({
      period: q.period,
      revenue: q.revenue !== null ? formatChartUnit(q.revenue, currency) : null,
      netProfit: q.netProfit !== null ? formatChartUnit(q.netProfit, currency) : null,
      epsActual: q.epsActual,
      epsEstimate: q.epsEstimate,
    }));
  }, [chronologicalQuarters, currency]);

  const hasEpsData = chartData.some((d) => d.epsActual !== null || d.epsEstimate !== null);

  return (
    <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-blue-500" />
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              {data.displaySymbol} — Quarterly Financial Results
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1">
            <span>Reported Revenue, Net Profit, Operating Margins & EPS</span>
            <span aria-hidden="true">·</span>
            <span>Unit: {unitLabel}</span>
            {res?.nextEarningsDate && (
              <>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 font-medium">
                  <Calendar className="w-3 h-3" /> Next Earnings: {res.nextEarningsDate}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {hasEpsData && (
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
              <button
                type="button"
                onClick={() => setChartMode('rev_profit')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap cursor-pointer transition-colors ${
                  chartMode === 'rev_profit'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Revenue & Profit
              </button>
              <button
                type="button"
                onClick={() => setChartMode('eps')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap cursor-pointer transition-colors ${
                  chartMode === 'eps'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                EPS Trend
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => setReloadTick((t) => t + 1)}
            disabled={state.loading}
            className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-50 cursor-pointer transition-colors"
            title="Refresh quarterly financials"
          >
            <RefreshCw className={`w-4 h-4 ${state.loading ? 'animate-spin text-blue-500' : ''}`} />
          </button>
        </div>
      </div>

      {state.loading && (
        <div className="space-y-4" aria-busy="true">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((k) => (
              <div key={k} className="h-20 rounded-xl bg-slate-100 dark:bg-slate-800/70 animate-pulse" />
            ))}
          </div>
          <div className="h-56 rounded-xl bg-slate-100 dark:bg-slate-800/70 animate-pulse" />
        </div>
      )}

      {!state.loading && (!res || !res.success || res.quarters.length === 0) && (
        <div className="p-6 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-center space-y-2">
          <AlertCircle className="w-7 h-7 text-slate-400 mx-auto" />
          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
            Quarterly Statements Unavailable for {data.displaySymbol}
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            {data.market === 'INDEX'
              ? 'Market indices represent baskets of stocks and do not publish standalone corporate quarterly income statements.'
              : res?.error || 'Live quarterly financial statements could not be retrieved for this ticker right now.'}
          </p>
        </div>
      )}

      {!state.loading && res && res.success && res.quarters.length > 0 && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 space-y-1">
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">
                Latest Revenue ({latestQ?.period})
              </span>
              <div className="text-lg font-extrabold font-mono tabular-nums text-slate-900 dark:text-white">
                {formatScaledAmount(latestQ?.revenue, currency, currSym)}
              </div>
              <div className="flex items-center gap-2 text-[11px] font-mono tabular-nums">
                <span className={(latestQ?.revenueYoYPct ?? 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                  YoY {fmtPctBadge(latestQ?.revenueYoYPct)}
                </span>
                <span className="text-slate-400">·</span>
                <span className="text-slate-500 dark:text-slate-400">QoQ {fmtPctBadge(latestQ?.revenueQoQPct)}</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 space-y-1">
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">
                Latest Net Profit ({latestQ?.period})
              </span>
              <div className="text-lg font-extrabold font-mono tabular-nums text-slate-900 dark:text-white">
                {formatScaledAmount(latestQ?.netProfit, currency, currSym)}
              </div>
              <div className="flex items-center gap-2 text-[11px] font-mono tabular-nums">
                <span className={(latestQ?.netProfitYoYPct ?? 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                  YoY {fmtPctBadge(latestQ?.netProfitYoYPct)}
                </span>
                <span className="text-slate-400">·</span>
                <span className="text-slate-500 dark:text-slate-400">QoQ {fmtPctBadge(latestQ?.netProfitQoQPct)}</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 space-y-1">
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">
                Profitability Margins
              </span>
              <div className="text-lg font-extrabold font-mono tabular-nums text-slate-900 dark:text-white">
                {latestQ?.netMarginPct !== null && latestQ?.netMarginPct !== undefined
                  ? `${latestQ.netMarginPct.toFixed(1)}% Net`
                  : res.summaryMetrics?.profitMarginPct !== null && res.summaryMetrics?.profitMarginPct !== undefined
                  ? `${res.summaryMetrics.profitMarginPct}% TTM`
                  : 'N/A'}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                Operating:{' '}
                {latestQ?.operatingMarginPct !== null && latestQ?.operatingMarginPct !== undefined
                  ? `${latestQ.operatingMarginPct.toFixed(1)}%`
                  : res.summaryMetrics?.operatingMarginPct !== null && res.summaryMetrics?.operatingMarginPct !== undefined
                  ? `${res.summaryMetrics.operatingMarginPct}%`
                  : 'N/A'}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 space-y-1">
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">
                Diluted EPS ({latestQ?.period})
              </span>
              <div className="text-lg font-extrabold font-mono tabular-nums text-slate-900 dark:text-white">
                {latestQ?.epsActual !== null && latestQ?.epsActual !== undefined
                  ? `${currSym}${latestQ.epsActual.toFixed(2)}`
                  : res.summaryMetrics?.trailingEps !== null && res.summaryMetrics?.trailingEps !== undefined
                  ? `${currSym}${res.summaryMetrics.trailingEps.toFixed(2)} TTM`
                  : 'N/A'}
              </div>
              <div className="text-[11px] font-mono tabular-nums">
                {latestQ?.epsSurprisePct !== null && latestQ?.epsSurprisePct !== undefined ? (
                  <span
                    className={
                      latestQ.epsSurprisePct >= 0
                        ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                        : 'text-rose-600 dark:text-rose-400 font-semibold'
                    }
                  >
                    {latestQ.epsSurprisePct >= 0 ? 'Beat' : 'Miss'} Est. by {Math.abs(latestQ.epsSurprisePct).toFixed(1)}%
                  </span>
                ) : (
                  <span className="text-slate-500 dark:text-slate-400">
                    ROE: {res.summaryMetrics?.roePct !== null && res.summaryMetrics?.roePct !== undefined ? `${res.summaryMetrics.roePct}%` : 'N/A'}
                  </span>
                )}
              </div>
            </div>
          </div>

          {chartData.length > 0 && (
            <div className="pt-1">
              <div className="flex items-center justify-between mb-2 text-xs text-slate-500 dark:text-slate-400">
                <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <BarChart3 className="w-3.5 h-3.5 text-blue-500" />
                  {chartMode === 'rev_profit'
                    ? `Quarterly Revenue vs Net Profit (${unitLabel})`
                    : `Quarterly Diluted EPS (${currSym})`}
                </span>
                <span>{chartData.length} Quarters</span>
              </div>

              <div className={compact ? 'h-56 w-full' : 'h-72 w-full'}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
                    <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} width={58} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#334155',
                        borderRadius: '10px',
                        fontSize: '12px',
                        color: '#f8fafc',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    {chartMode === 'rev_profit' ? (
                      <>
                        <Bar dataKey="revenue" name={`Revenue (${unitLabel})`} fill="#2563eb" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="netProfit" name={`Net Profit (${unitLabel})`} fill="#16a34a" radius={[4, 4, 0, 0]} />
                      </>
                    ) : (
                      <>
                        <Bar dataKey="epsActual" name={`Actual EPS (${currSym})`} fill="#2563eb" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="epsEstimate" name={`Estimated EPS (${currSym})`} fill="#94a3b8" radius={[4, 4, 0, 0]} />
                      </>
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div className="overflow-x-auto pt-1">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                  <th className="py-2.5 pr-4 font-semibold">Quarter</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Revenue</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Rev YoY</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Rev QoQ</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Operating Inc.</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Op. Margin</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Net Profit</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Profit YoY</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Net Margin</th>
                  <th className="py-2.5 pl-3 font-semibold text-right">EPS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono tabular-nums">
                {res.quarters.map((q) => (
                  <tr key={q.asOfDate} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-2.5 pr-4 font-sans font-bold text-slate-900 dark:text-white whitespace-nowrap">
                      {q.period}
                    </td>
                    <td className="py-2.5 px-3 text-right font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                      {formatScaledAmount(q.revenue, currency, currSym)}
                    </td>
                    <td
                      className={`py-2.5 px-3 text-right whitespace-nowrap ${
                        q.revenueYoYPct === null
                          ? 'text-slate-400'
                          : q.revenueYoYPct >= 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {fmtPctBadge(q.revenueYoYPct)}
                    </td>
                    <td
                      className={`py-2.5 px-3 text-right whitespace-nowrap ${
                        q.revenueQoQPct === null
                          ? 'text-slate-400'
                          : q.revenueQoQPct >= 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {fmtPctBadge(q.revenueQoQPct)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {formatScaledAmount(q.operatingIncome, currency, currSym)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {q.operatingMarginPct !== null ? `${q.operatingMarginPct.toFixed(1)}%` : '—'}
                    </td>
                    <td
                      className={`py-2.5 px-3 text-right font-semibold whitespace-nowrap ${
                        (q.netProfit ?? 0) >= 0 ? 'text-slate-900 dark:text-white' : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {formatScaledAmount(q.netProfit, currency, currSym)}
                    </td>
                    <td
                      className={`py-2.5 px-3 text-right whitespace-nowrap ${
                        q.netProfitYoYPct === null
                          ? 'text-slate-400'
                          : q.netProfitYoYPct >= 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {fmtPctBadge(q.netProfitYoYPct)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {q.netMarginPct !== null ? `${q.netMarginPct.toFixed(1)}%` : '—'}
                    </td>
                    <td className="py-2.5 pl-3 text-right font-semibold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                      {q.epsActual !== null ? `${currSym}${q.epsActual.toFixed(2)}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {res.summaryMetrics && (
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
              <div className="flex flex-wrap items-center gap-4 font-mono tabular-nums">
                <span>
                  TTM Profit Margin:{' '}
                  <strong className="text-slate-900 dark:text-white">
                    {res.summaryMetrics.profitMarginPct !== null ? `${res.summaryMetrics.profitMarginPct}%` : 'N/A'}
                  </strong>
                </span>
                <span>
                  ROE:{' '}
                  <strong className="text-slate-900 dark:text-white">
                    {res.summaryMetrics.roePct !== null ? `${res.summaryMetrics.roePct}%` : 'N/A'}
                  </strong>
                </span>
                <span>
                  Debt / Equity:{' '}
                  <strong className="text-slate-900 dark:text-white">
                    {res.summaryMetrics.debtToEquity !== null ? res.summaryMetrics.debtToEquity : 'N/A'}
                  </strong>
                </span>
              </div>
              <span>Source: {res.source || 'Yahoo Finance'}</span>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default QuarterlyResultsPanel;
