import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  MinusCircle,
  HelpCircle,
  Search,
  Download,
  ChevronDown,
  ChevronUp,
  Target,
  ArrowRight,
  Compass,
} from 'lucide-react';
import type { MarketType } from '../types';
import { computeTradeAccuracySummary } from '../utils/tradeAccuracy';
import type { TradeAccuracyRecord } from '../utils/tradeAccuracy';

interface Props {
  records: TradeAccuracyRecord[];
  embedded?: boolean;
  onSelectStock?: (symbol: string, market: MarketType) => void;
  onStartTrade?: () => void;
  onOpenOptions?: () => void;
}

type AccuracyFilter = 'ALL' | 'ACCURATE' | 'MISSED' | 'FOLLOWED' | 'CONTRARIAN' | 'OPEN' | 'CLOSED';

const fmtMoney = (n: number) => {
  const abs = Math.abs(n);
  if (abs >= 1000) {
    return `₹${abs.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `₹${abs.toFixed(2)}`;
};

const fmtSignedPct = (v: number | null, digits = 2) =>
  v === null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(digits)}%`;

const fmtDateTime = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const TradeAccuracyPanel: React.FC<Props> = ({
  records,
  embedded = false,
  onSelectStock,
  onStartTrade,
  onOpenOptions,
}) => {
  const [filter, setFilter] = useState<AccuracyFilter>('ALL');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const summary = useMemo(() => computeTradeAccuracySummary(records), [records]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return records.filter((r) => {
      if (filter === 'ACCURATE' && r.verdict !== 'ACCURATE') return false;
      if (filter === 'MISSED' && r.verdict !== 'MISSED') return false;
      if (filter === 'FOLLOWED' && r.alignment !== 'FOLLOWED') return false;
      if (filter === 'CONTRARIAN' && r.alignment !== 'CONTRARIAN') return false;
      if (filter === 'OPEN' && r.trade.status !== 'OPEN') return false;
      if (filter === 'CLOSED' && r.trade.status !== 'CLOSED') return false;
      if (q) {
        const hay = `${r.trade.instrument} ${r.trade.symbol} ${r.forecast?.predictedSignal || ''} ${r.verdict}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [records, filter, search]);

  const exportCsv = () => {
    const headers = [
      'Instrument',
      'Segment',
      'Status',
      'Side',
      'Opened At',
      'Entry Price',
      'Pre-Trade Signal',
      'Expected Move %',
      'Pre-Trade Target',
      'Actual Price',
      'Actual Move %',
      'P&L',
      'P&L %',
      'Call Verdict',
      'Alignment',
      'Summary',
    ];
    const lines = [headers.join(',')];
    filtered.forEach((r) => {
      const cols = [
        r.trade.instrument,
        r.trade.segment,
        r.trade.status,
        r.trade.side,
        r.trade.openedAt,
        r.trade.entryPrice.toFixed(2),
        r.forecast?.predictedSignal ?? 'UNTRACKED',
        r.forecast?.predictedMovePct ?? '',
        r.forecast?.predictedTarget?.toFixed(2) ?? '',
        r.trade.actualPrice !== null ? r.trade.actualPrice.toFixed(2) : '',
        r.actualMovePct ?? '',
        r.trade.pnl.toFixed(2),
        r.trade.pnlPct.toFixed(2),
        r.verdict,
        r.alignment,
        `"${r.whatHappened.replace(/"/g, '""')}"`,
      ];
      lines.push(cols.join(','));
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
    a.download = 'predictx-trade-accuracy.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const wrapperCls = embedded
    ? 'p-5 space-y-5'
    : 'bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 space-y-5';

  if (records.length === 0) {
    return (
      <div className={`${wrapperCls} text-center py-10`}>
        <div className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 mx-auto flex items-center justify-center">
          <Target className="w-5 h-5" />
        </div>
        <h3 className="text-base font-bold text-slate-900 dark:text-white mt-4">
          Pre-Trade Prediction Accuracy
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1.5 leading-relaxed">
          Before every paper trade starts, PredictX records the model&apos;s pre-trade call (signal, confidence, and target). Once the trade runs or closes, this tracker scores whether the call was accurate or missed.
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          {onStartTrade && (
            <button
              type="button"
              onClick={onStartTrade}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Start a Tracked Trade
            </button>
          )}
          {onOpenOptions && (
            <button
              type="button"
              onClick={onOpenOptions}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>Trade Options</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={wrapperCls}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Pre-Trade Call vs Actual Trade Accuracy
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
            Compares the prediction recorded before each trade started against what actually happened
            <span aria-hidden="true"> · </span>
            <span>{summary.trackedCount} of {summary.totalTrades} tracked</span>
          </p>
        </div>

        <button
          type="button"
          onClick={exportCsv}
          className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export Audit CSV</span>
        </button>
      </div>

      {/* 4-Metric Accuracy Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Pre-Trade Call Accuracy
          </div>
          <div
            className={`text-2xl font-black font-mono tabular-nums mt-0.5 ${
              summary.accuracyRatePct === null
                ? 'text-slate-900 dark:text-white'
                : summary.accuracyRatePct >= 55
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : summary.accuracyRatePct >= 45
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {summary.accuracyRatePct !== null ? `${summary.accuracyRatePct.toFixed(1)}%` : '—'}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums mt-0.5">
            {summary.accurateCount} hit · {summary.missedCount} missed
            {summary.neutralCount > 0 ? ` · ${summary.neutralCount} flat` : ''}
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Followed Call Win Rate
          </div>
          <div className="text-2xl font-black font-mono tabular-nums text-slate-900 dark:text-white mt-0.5">
            {summary.followedWinRatePct !== null ? `${summary.followedWinRatePct.toFixed(0)}%` : '—'}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums mt-0.5">
            {summary.followedCount > 0
              ? `${summary.followedWins}/${summary.followedCount} wins · ${summary.followedPnL >= 0 ? '+' : '-'}${fmtMoney(summary.followedPnL)}`
              : 'No aligned trades yet'}
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Target Hit Rate
          </div>
          <div className="text-2xl font-black font-mono tabular-nums text-slate-900 dark:text-white mt-0.5">
            {summary.targetHitRatePct !== null ? `${summary.targetHitRatePct.toFixed(0)}%` : '—'}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums mt-0.5">
            {summary.targetTrackedCount > 0
              ? `${summary.targetHitCount} of ${summary.targetTrackedCount} targets reached`
              : 'Set or apply targets'}
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Actual vs Expected Move
          </div>
          <div
            className={`text-2xl font-black font-mono tabular-nums mt-0.5 ${
              summary.avgActualMovePct === null
                ? 'text-slate-900 dark:text-white'
                : summary.avgActualMovePct >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {fmtSignedPct(summary.avgActualMovePct, 2)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums mt-0.5">
            Expected avg: {fmtSignedPct(summary.avgExpectedMovePct, 2)}
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1 border-t border-slate-100 dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800">
          {(
            [
              { id: 'ALL', label: 'All', count: records.length },
              { id: 'ACCURATE', label: 'Accurate', count: summary.accurateCount },
              { id: 'MISSED', label: 'Missed', count: summary.missedCount },
              { id: 'FOLLOWED', label: 'Followed', count: summary.followedCount },
              { id: 'CONTRARIAN', label: 'Contrarian', count: summary.contrarianCount },
              { id: 'OPEN', label: 'Open', count: records.filter((r) => r.trade.status === 'OPEN').length },
              { id: 'CLOSED', label: 'Closed', count: records.filter((r) => r.trade.status === 'CLOSED').length },
            ] as Array<{ id: AccuracyFilter; label: string; count: number }>
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                filter === tab.id
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {tab.label}{' '}
              <span className="font-mono tabular-nums opacity-70">{tab.count}</span>
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter symbol..."
            aria-label="Filter trade accuracy records by symbol"
            className="pl-8 pr-3 py-1.5 w-40 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          />
        </div>
      </div>

      {/* Audit Table */}
      {filtered.length === 0 ? (
        <div className="py-10 text-center text-sm text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800">
          No trades match the current filter.
          <div className="mt-2">
            <button
              type="button"
              onClick={() => {
                setFilter('ALL');
                setSearch('');
              }}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              Reset Filter
            </button>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400 text-left">
                <th className="py-2.5 pr-3">Trade</th>
                <th className="py-2.5 px-2">Before Trade (Call)</th>
                <th className="py-2.5 px-2 text-right">Entry → Actual</th>
                <th className="py-2.5 px-2 text-right">Trade P&amp;L</th>
                <th className="py-2.5 px-2">Call Accuracy</th>
                <th className="py-2.5 pl-2 text-right">Alignment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-100">
              {filtered.map((r) => {
                const { trade, forecast } = r;
                const isExpanded = expandedId === trade.id;
                const rowTint =
                  r.verdict === 'ACCURATE'
                    ? 'bg-emerald-50/45 dark:bg-emerald-950/15 hover:bg-emerald-50/80 dark:hover:bg-emerald-950/25'
                    : r.verdict === 'MISSED'
                      ? 'bg-rose-50/45 dark:bg-rose-950/15 hover:bg-rose-50/80 dark:hover:bg-rose-950/25'
                      : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40';
                const pnlTone =
                  trade.pnl > 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : trade.pnl < 0
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-slate-500';
                const signalTone =
                  forecast?.predictedDirection === 'UP'
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : forecast?.predictedDirection === 'DOWN'
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-amber-600 dark:text-amber-400';

                return (
                  <React.Fragment key={trade.id}>
                    <tr
                      className={`transition-colors cursor-pointer ${rowTint}`}
                      onClick={() => setExpandedId(isExpanded ? null : trade.id)}
                    >
                      <td className="py-3 pr-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {trade.segment === 'Equity' && onSelectStock ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSelectStock(trade.symbol, trade.market || 'NSE');
                                }}
                                className="hover:underline text-left cursor-pointer"
                              >
                                {trade.instrument}
                              </button>
                            ) : (
                              trade.instrument
                            )}
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          )}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                          {trade.segment} · {trade.side} · {trade.status === 'OPEN' ? 'Open' : 'Closed'} · {fmtDateTime(trade.openedAt)}
                        </div>
                      </td>

                      <td className="py-3 px-2">
                        {forecast ? (
                          <div>
                            <div className="flex items-center gap-1.5 text-xs">
                              <span className={`font-bold ${signalTone}`}>{forecast.predictedSignal}</span>
                              {typeof forecast.confidence === 'number' && (
                                <>
                                  <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">·</span>
                                  <span className="text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                                    {forecast.confidence.toFixed(0)}% conf
                                  </span>
                                </>
                              )}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums mt-0.5">
                              {forecast.predictedTarget
                                ? `Target ${fmtMoney(forecast.predictedTarget)} (${fmtSignedPct(forecast.predictedMovePct ?? null, 1)})`
                                : forecast.predictedDirection === 'FLAT'
                                  ? 'Range-bound / wait'
                                  : `Expected ${forecast.predictedDirection}`}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">No pre-trade snapshot</span>
                        )}
                      </td>

                      <td className="py-3 px-2 text-right font-mono tabular-nums whitespace-nowrap">
                        <div className="text-xs font-semibold text-slate-900 dark:text-white">
                          {fmtMoney(trade.entryPrice)} → {trade.actualPrice !== null ? fmtMoney(trade.actualPrice) : '—'}
                        </div>
                        <div
                          className={`text-xs mt-0.5 ${
                            r.actualMovePct === null
                              ? 'text-slate-400'
                              : r.actualMovePct >= 0
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          Move {fmtSignedPct(r.actualMovePct, 2)}
                        </div>
                      </td>

                      <td className="py-3 px-2 text-right font-mono tabular-nums whitespace-nowrap">
                        <div className={`font-bold text-xs ${pnlTone}`}>
                          {trade.pnl >= 0 ? '+' : '-'}
                          {fmtMoney(trade.pnl)}
                        </div>
                        <div className={`text-xs mt-0.5 ${pnlTone}`}>
                          {trade.pnlPct >= 0 ? '+' : ''}
                          {trade.pnlPct.toFixed(2)}%
                        </div>
                      </td>

                      <td className="py-3 px-2">
                        {r.verdict === 'ACCURATE' ? (
                          <div className="space-y-0.5">
                            <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                              <span>Accurate</span>
                              {r.targetHit && <span className="font-normal">· Target hit</span>}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 max-w-[240px] truncate" title={r.whatHappened}>
                              {r.whatHappened}
                            </div>
                          </div>
                        ) : r.verdict === 'MISSED' ? (
                          <div className="space-y-0.5">
                            <div className="text-xs font-bold text-rose-600 dark:text-rose-400 inline-flex items-center gap-1">
                              <XCircle className="w-3.5 h-3.5 shrink-0" />
                              <span>Missed</span>
                              {r.stopHit && <span className="font-normal">· SL hit</span>}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 max-w-[240px] truncate" title={r.whatHappened}>
                              {r.whatHappened}
                            </div>
                          </div>
                        ) : r.verdict === 'NEUTRAL' ? (
                          <div className="space-y-0.5">
                            <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 inline-flex items-center gap-1">
                              <MinusCircle className="w-3.5 h-3.5 shrink-0" />
                              <span>Neutral</span>
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 max-w-[240px] truncate" title={r.whatHappened}>
                              {r.whatHappened}
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs text-slate-400 inline-flex items-center gap-1">
                            <HelpCircle className="w-3.5 h-3.5 shrink-0" />
                            <span>Untracked</span>
                          </div>
                        )}
                      </td>

                      <td className="py-3 pl-2 text-right whitespace-nowrap">
                        {r.alignment === 'FOLLOWED' ? (
                          <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 inline-flex items-center gap-1">
                            <Compass className="w-3.5 h-3.5" />
                            Followed
                          </span>
                        ) : r.alignment === 'CONTRARIAN' ? (
                          <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                            Contrarian
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">Neutral</span>
                        )}
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr className="bg-slate-50/70 dark:bg-slate-800/30">
                        <td colSpan={6} className="px-4 py-3 text-xs space-y-2">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <div className="font-bold text-slate-700 dark:text-slate-200">
                                What was predicted before the trade
                              </div>
                              <p className="text-slate-600 dark:text-slate-400">
                                {forecast ? forecast.summary : 'No pre-trade forecast was recorded for this trade.'}
                              </p>
                              {forecast && (
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums pt-0.5">
                                  {typeof forecast.score === 'number' && (
                                    <span>Score {forecast.score > 0 ? '+' : ''}{forecast.score}/100</span>
                                  )}
                                  {typeof forecast.rsiAtEntry === 'number' && (
                                    <span>Entry RSI(14) {forecast.rsiAtEntry.toFixed(1)}</span>
                                  )}
                                  {forecast.userStopLoss && (
                                    <span>SL {fmtMoney(forecast.userStopLoss)}</span>
                                  )}
                                  {forecast.userTarget && (
                                    <span>Plan Target {fmtMoney(forecast.userTarget)}</span>
                                  )}
                                </div>
                              )}
                            </div>

                            <div className="space-y-1">
                              <div className="font-bold text-slate-700 dark:text-slate-200">
                                What actually happened in the trade
                              </div>
                              <p className="text-slate-600 dark:text-slate-400">
                                {r.whatHappened}
                              </p>
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums pt-0.5">
                                <span>Qty {trade.qty.toLocaleString('en-IN')}</span>
                                {r.targetClosenessPct !== null && (
                                  <span>Target proximity {r.targetClosenessPct}%</span>
                                )}
                                {trade.closedAt && <span>Closed {fmtDateTime(trade.closedAt)}</span>}
                              </div>
                            </div>
                          </div>

                          {forecast?.reasons && forecast.reasons.length > 0 && (
                            <div className="pt-2 border-t border-slate-200/70 dark:border-slate-700/60">
                              <div className="font-semibold text-slate-600 dark:text-slate-300 mb-1">
                                Pre-trade model triggers:
                              </div>
                              <ul className="list-disc pl-4 space-y-0.5 text-slate-500 dark:text-slate-400">
                                {forecast.reasons.slice(0, 3).map((reason, idx) => (
                                  <li key={idx}>{reason}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default TradeAccuracyPanel;
