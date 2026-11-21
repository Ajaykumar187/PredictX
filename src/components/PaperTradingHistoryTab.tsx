import React, { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Search,
  History,
  ArrowRight,
  CheckCircle2,
  XCircle,
  MinusCircle,
} from 'lucide-react';
import type { MarketType } from '../types';
import { ClosedPaperTrade, PaperPosition, formatTradeDuration } from '../utils/paperTrades';
import type { TradeAccuracyRecord } from '../utils/tradeAccuracy';

export interface OpenHistoryTrade {
  id: string;
  segment: 'Equity' | 'Options';
  instrument: string;
  symbol: string;
  market?: MarketType;
  subtitle: string;
  side: 'LONG' | 'SHORT';
  qty: number;
  entryPrice: number;
  currentPrice: number | null;
  pnl: number;
  pnlPct: number;
  openedAt: string;
  durationMs: number;
  optionPosition?: PaperPosition;
}

interface UnifiedTradeRow {
  id: string;
  status: 'OPEN' | 'CLOSED';
  segment: 'Equity' | 'Options';
  instrument: string;
  symbol: string;
  market?: MarketType;
  subtitle: string;
  side: 'LONG' | 'SHORT';
  qty: number;
  entryPrice: number;
  exitOrLtp: number | null;
  pnl: number;
  pnlPct: number;
  openedAt: string;
  sortTimeMs: number;
  closedAt?: string;
  durationMs: number;
  optionPosition?: PaperPosition;
}

interface Props {
  trades: ClosedPaperTrade[];
  openTrades?: OpenHistoryTrade[];
  accuracyById?: Record<string, TradeAccuracyRecord>;
  onCloseEquityPosition?: (symbol: string) => void;
  onCloseOptionPosition?: (pos: PaperPosition) => void;
  onSelectStock?: (symbol: string, market: MarketType) => void;
  onTradeEquities: () => void;
  onOpenOptions?: () => void;
  embedded?: boolean;
}

type StatusFilter = 'ALL' | 'OPEN' | 'CLOSED';
type SegmentFilter = 'ALL' | 'Equity' | 'Options';
type OutcomeFilter = 'ALL' | 'PROFIT' | 'LOSS';
type SortField = 'time' | 'pnl' | 'durationMs';
type SortDir = 'asc' | 'desc';

const formatCurrency = (n: number) => {
  const abs = Math.abs(n);
  if (abs >= 1000) {
    return `₹${abs.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `₹${abs.toFixed(2)}`;
};

const formatDateTime = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const PaperTradingHistoryTab: React.FC<Props> = ({
  trades,
  openTrades = [],
  accuracyById,
  onCloseEquityPosition,
  onCloseOptionPosition,
  onSelectStock,
  onTradeEquities,
  onOpenOptions,
  embedded = false,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [segmentFilter, setSegmentFilter] = useState<SegmentFilter>('ALL');
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilter>('ALL');
  const [sortField, setSortField] = useState<SortField>('time');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const allRows = useMemo<UnifiedTradeRow[]>(() => {
    const openRows: UnifiedTradeRow[] = openTrades.map((o) => ({
      id: o.id,
      status: 'OPEN',
      segment: o.segment,
      instrument: o.instrument,
      symbol: o.symbol,
      market: o.market,
      subtitle: o.subtitle,
      side: o.side,
      qty: o.qty,
      entryPrice: o.entryPrice,
      exitOrLtp: o.currentPrice,
      pnl: o.pnl,
      pnlPct: o.pnlPct,
      openedAt: o.openedAt,
      sortTimeMs: Date.parse(o.openedAt) || Date.now(),
      durationMs: o.durationMs,
      optionPosition: o.optionPosition,
    }));

    const closedRows: UnifiedTradeRow[] = trades.map((t) => ({
      id: t.id,
      status: 'CLOSED',
      segment: t.segment,
      instrument: t.instrument,
      symbol: t.symbol,
      market: t.market,
      subtitle: t.subtitle,
      side: t.side,
      qty: t.qty,
      entryPrice: t.entryPrice,
      exitOrLtp: t.exitPrice,
      pnl: t.pnl,
      pnlPct: t.pnlPct,
      openedAt: t.openedAt,
      closedAt: t.closedAt,
      sortTimeMs: Date.parse(t.closedAt) || Date.now(),
      durationMs: t.durationMs,
    }));

    return [...openRows, ...closedRows];
  }, [openTrades, trades]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = allRows.filter((r) => {
      if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
      if (segmentFilter !== 'ALL' && r.segment !== segmentFilter) return false;
      if (outcomeFilter === 'PROFIT' && r.pnl < 0) return false;
      if (outcomeFilter === 'LOSS' && r.pnl >= 0) return false;
      if (q) {
        const hay = `${r.instrument} ${r.symbol} ${r.subtitle} ${r.status}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const mult = sortDir === 'desc' ? -1 : 1;
    return [...list].sort((a, b) => {
      if (sortField === 'time' && sortDir === 'desc' && a.status !== b.status) {
        return a.status === 'OPEN' ? -1 : 1;
      }
      if (sortField === 'time') {
        return (a.sortTimeMs - b.sortTimeMs) * mult;
      }
      if (sortField === 'pnl') {
        return (a.pnl - b.pnl) * mult;
      }
      return (a.durationMs - b.durationMs) * mult;
    });
  }, [allRows, search, statusFilter, segmentFilter, outcomeFilter, sortField, sortDir]);

  const stats = useMemo(() => {
    const count = filteredRows.length;
    let openCount = 0;
    let closedCount = 0;
    let wins = 0;
    let losses = 0;
    let netPnL = 0;
    let totalDurationMs = 0;

    for (const r of filteredRows) {
      if (r.status === 'OPEN') openCount += 1;
      else closedCount += 1;
      netPnL += r.pnl;
      totalDurationMs += r.durationMs;
      if (r.status === 'CLOSED') {
        if (r.pnl > 0) wins += 1;
        else if (r.pnl < 0) losses += 1;
      }
    }

    const decided = wins + losses;
    const winRate = decided > 0 ? (wins / decided) * 100 : 0;

    return {
      count,
      openCount,
      closedCount,
      netPnL,
      winRate,
      avgDurationMs: count > 0 ? totalDurationMs / count : 0,
    };
  }, [filteredRows]);

  const hasActiveFilters =
    search.trim().length > 0 ||
    statusFilter !== 'ALL' ||
    segmentFilter !== 'ALL' ||
    outcomeFilter !== 'ALL';

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />;
    }
    return sortDir === 'desc' ? (
      <ArrowDown className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
    ) : (
      <ArrowUp className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
    );
  };

  if (allRows.length === 0) {
    return (
      <div
        className={
          embedded
            ? 'p-8 text-center'
            : 'bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-8 text-center'
        }
      >
        <div className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 mx-auto flex items-center justify-center">
          <History className="w-5 h-5" />
        </div>
        <h3 className="text-base font-bold text-slate-900 dark:text-white mt-4">
          No paper trades yet
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1.5 leading-relaxed">
          Open and closed paper trades across Equities and Options (F&amp;O) will appear here with live status, entry/exit prices, hold duration, P&amp;L, and instant close actions.
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={onTradeEquities}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Trade Equities
          </button>
          {onOpenOptions && (
            <button
              type="button"
              onClick={onOpenOptions}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>Open Option Chain</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={
        embedded
          ? 'p-5 space-y-4'
          : 'bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 space-y-4'
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Trading History</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
            Showing {filteredRows.length} of {allRows.length}{' '}
            {allRows.length === 1 ? 'trade' : 'trades'}
            <span aria-hidden="true"> · </span>
            <span>{stats.openCount} open</span>
            <span aria-hidden="true"> · </span>
            <span>{stats.closedCount} closed</span>
            {stats.count > 0 && (
              <>
                <span aria-hidden="true"> · </span>
                <span
                  className={`font-mono font-semibold ${
                    stats.netPnL >= 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {stats.netPnL >= 0 ? '+' : '-'}
                  {formatCurrency(stats.netPnL)}
                </span>
              </>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter symbol..."
              aria-label="Filter trading history by symbol"
              className="pl-8 pr-3 py-1.5 w-40 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
          </div>

          <div className="inline-flex items-center p-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            {(['ALL', 'OPEN', 'CLOSED'] as StatusFilter[]).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  statusFilter === st
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {st === 'ALL' ? 'All Status' : st === 'OPEN' ? 'Open' : 'Closed'}
              </button>
            ))}
          </div>

          <div className="inline-flex items-center p-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            {(['ALL', 'Equity', 'Options'] as SegmentFilter[]).map((seg) => (
              <button
                key={seg}
                type="button"
                onClick={() => setSegmentFilter(seg)}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  segmentFilter === seg
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {seg === 'ALL' ? 'All' : seg === 'Equity' ? 'Equities' : 'Options'}
              </button>
            ))}
          </div>

          <div className="inline-flex items-center p-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            {(['ALL', 'PROFIT', 'LOSS'] as OutcomeFilter[]).map((out) => (
              <button
                key={out}
                type="button"
                onClick={() => setOutcomeFilter(out)}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  outcomeFilter === out
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {out === 'ALL' ? 'All P&L' : out === 'PROFIT' ? 'Profit' : 'Loss'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {filteredRows.length === 0 ? (
        <div className="py-10 text-center border-t border-slate-100 dark:border-slate-800">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No trades match the current filters.
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setStatusFilter('ALL');
                setSegmentFilter('ALL');
                setOutcomeFilter('ALL');
              }}
              className="mt-3 px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              Clear Filters
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400 text-left">
                <th className="py-2.5 pr-3">Instrument</th>
                <th className="py-2.5 px-2">Status</th>
                <th className="py-2.5 px-2 text-right">Qty</th>
                <th className="py-2.5 px-2 text-right">Entry Price</th>
                <th className="py-2.5 px-2 text-right">
                  <button
                    type="button"
                    onClick={() => toggleSort('time')}
                    className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <span>Exit / LTP</span>
                    {renderSortIcon('time')}
                  </button>
                </th>
                <th className="py-2.5 px-2 text-right">
                  <button
                    type="button"
                    onClick={() => toggleSort('durationMs')}
                    className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <span>Duration</span>
                    {renderSortIcon('durationMs')}
                  </button>
                </th>
                <th className="py-2.5 px-2 text-right">
                  <button
                    type="button"
                    onClick={() => toggleSort('pnl')}
                    className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <span>Profit / Loss</span>
                    {renderSortIcon('pnl')}
                  </button>
                </th>
                {accuracyById && <th className="py-2.5 px-2">Pre-Trade Call</th>}
                <th className="py-2.5 pl-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-100">
              {filteredRows.map((r) => {
                const isOpen = r.status === 'OPEN';
                const isProfit = r.pnl > 0;
                const isLoss = r.pnl < 0;
                const pnlClass = isProfit
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : isLoss
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-slate-600 dark:text-slate-400';
                const outcomeLabel = isOpen
                  ? 'Open MTM'
                  : isProfit
                  ? 'Profit'
                  : isLoss
                  ? 'Loss'
                  : 'Flat';

                const canInstantClose =
                  isOpen &&
                  ((r.segment === 'Equity' && !!onCloseEquityPosition) ||
                    (r.segment === 'Options' && !!r.optionPosition && !!onCloseOptionPosition));

                return (
                  <tr
                    key={r.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3 pr-3">
                      <div className="font-semibold text-slate-900 dark:text-white">
                        {r.segment === 'Equity' && onSelectStock ? (
                          <button
                            type="button"
                            onClick={() => onSelectStock(r.symbol, r.market || 'NSE')}
                            className="hover:underline text-left cursor-pointer"
                          >
                            {r.instrument}
                          </button>
                        ) : (
                          r.instrument
                        )}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {r.subtitle}
                      </div>
                    </td>

                    <td className="py-3 px-2 whitespace-nowrap">
                      <span
                        className={`text-xs font-semibold ${
                          isOpen
                            ? 'text-blue-600 dark:text-blue-400'
                            : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {isOpen ? 'Open' : 'Closed'}
                      </span>
                    </td>

                    <td className="py-3 px-2 text-right font-mono tabular-nums font-medium">
                      {r.qty.toLocaleString('en-IN')}
                    </td>

                    <td className="py-3 px-2 text-right">
                      <div className="font-mono tabular-nums font-medium">
                        {formatCurrency(r.entryPrice)}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums mt-0.5">
                        {formatDateTime(r.openedAt)}
                      </div>
                    </td>

                    <td className="py-3 px-2 text-right">
                      <div className="font-mono tabular-nums font-medium">
                        {r.exitOrLtp !== null ? formatCurrency(r.exitOrLtp) : '—'}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums mt-0.5">
                        {isOpen
                          ? r.exitOrLtp !== null
                            ? 'Live LTP'
                            : 'Avg Cost'
                          : r.closedAt
                          ? formatDateTime(r.closedAt)
                          : '—'}
                      </div>
                    </td>

                    <td className="py-3 px-2 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {formatTradeDuration(r.durationMs)}
                    </td>

                    <td className="py-3 px-2 text-right whitespace-nowrap">
                      <div className={`font-mono tabular-nums font-bold ${pnlClass}`}>
                        {r.pnl >= 0 ? '+' : '-'}
                        {formatCurrency(r.pnl)}
                      </div>
                      <div className={`text-xs font-mono tabular-nums mt-0.5 ${pnlClass}`}>
                        {outcomeLabel} · {r.pnlPct >= 0 ? '+' : ''}
                        {r.pnlPct.toFixed(2)}%
                      </div>
                    </td>

                    {accuracyById && (() => {
                      const accRec = accuracyById[r.id];
                      if (!accRec || !accRec.forecast) {
                        return (
                          <td className="py-3 px-2 whitespace-nowrap text-xs text-slate-400">
                            —
                          </td>
                        );
                      }
                      return (
                        <td className="py-3 px-2 whitespace-nowrap" title={accRec.whatHappened}>
                          {accRec.verdict === 'ACCURATE' ? (
                            <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Accurate</span>
                            </div>
                          ) : accRec.verdict === 'MISSED' ? (
                            <div className="text-xs font-bold text-rose-600 dark:text-rose-400 inline-flex items-center gap-1">
                              <XCircle className="w-3.5 h-3.5" />
                              <span>Missed</span>
                            </div>
                          ) : (
                            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 inline-flex items-center gap-1">
                              <MinusCircle className="w-3.5 h-3.5" />
                              <span>Neutral</span>
                            </div>
                          )}
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums mt-0.5">
                            {accRec.forecast.predictedSignal}
                            {accRec.targetHit ? ' · Target hit' : accRec.stopHit ? ' · SL hit' : ''}
                          </div>
                        </td>
                      );
                    })()}

                    <td className="py-3 pl-2 text-right whitespace-nowrap">
                      {canInstantClose ? (
                        <button
                          type="button"
                          onClick={() => {
                            if (r.segment === 'Equity') {
                              onCloseEquityPosition?.(r.symbol);
                            } else if (r.optionPosition) {
                              onCloseOptionPosition?.(r.optionPosition);
                            }
                          }}
                          className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          Close
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
  );
};

export default PaperTradingHistoryTab;
