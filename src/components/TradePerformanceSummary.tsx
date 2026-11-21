import React, { useEffect, useMemo, useState } from 'react';
import {
  RotateCcw,
  TrendingUp,
  TrendingDown,
  Plus,
} from 'lucide-react';
import type { MarketType } from '../types';
import {
  computeTradePerformance,
  filterTradesForSession,
  getTradeSessionStartedAt,
  resetTradeSession,
  subscribeTradeSession,
} from '../utils/tradePerformance';
import type { SessionPerformanceTrade } from '../utils/tradePerformance';

interface TradePerformanceSummaryProps {
  trades: SessionPerformanceTrade[];
  currencySymbol?: string;
  onNewTrade?: () => void;
  newTradeLabel?: string;
  onSelectStock?: (symbol: string, market: MarketType) => void;
}

type ScopeMode = 'SESSION' | 'ALL';

const fmtMoney = (n: number, sym = '₹') => {
  const abs = Math.abs(n);
  if (abs >= 1000) {
    return `${sym}${abs.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
  return `${sym}${abs.toFixed(2)}`;
};

const fmtSignedMoney = (n: number, sym = '₹') => {
  if (n > 0) return `+${fmtMoney(n, sym)}`;
  if (n < 0) return `-${fmtMoney(n, sym)}`;
  return `${sym}0.00`;
};

const fmtSignedPct = (n: number | null) => {
  if (n === null || !Number.isFinite(n)) return '—';
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
};

const fmtSessionClock = (ms: number) => {
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return 'Now';
  return d.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

const fmtTradeTime = (iso?: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const TradePerformanceSummary: React.FC<TradePerformanceSummaryProps> = ({
  trades,
  currencySymbol = '₹',
  onNewTrade,
  newTradeLabel = 'Place Trade',
  onSelectStock,
}) => {
  const [sessionStartedAt, setSessionStartedAt] = useState<number>(() =>
    getTradeSessionStartedAt()
  );
  const [scope, setScope] = useState<ScopeMode>('SESSION');
  const [includeOpen, setIncludeOpen] = useState<boolean>(false);
  const [selectedTradeId, setSelectedTradeId] = useState<string | null>(null);

  useEffect(() => {
    return subscribeTradeSession(() => {
      setSessionStartedAt(getTradeSessionStartedAt());
    });
  }, []);

  const sessionTrades = useMemo(
    () => filterTradesForSession(trades, sessionStartedAt),
    [trades, sessionStartedAt]
  );

  const scopedTrades = scope === 'SESSION' ? sessionTrades : trades;

  const metrics = useMemo(
    () => computeTradePerformance(scopedTrades, { includeOpen }),
    [scopedTrades, includeOpen]
  );

  const maxAbsPnl = useMemo(() => {
    let m = 0;
    for (const t of metrics.evaluatedTrades) {
      const a = Math.abs(t.pnl);
      if (a > m) m = a;
    }
    return m;
  }, [metrics.evaluatedTrades]);

  const activeTrade = useMemo(() => {
    if (!selectedTradeId) return null;
    return metrics.evaluatedTrades.find((t) => t.id === selectedTradeId) ?? null;
  }, [metrics.evaluatedTrades, selectedTradeId]);

  const handleResetSession = () => {
    const nextTs = resetTradeSession();
    setSessionStartedAt(nextTs);
    setSelectedTradeId(null);
  };

  const winShare = metrics.winRatePct ?? 0;
  const lossShare = metrics.lossRatePct ?? 0;

  return (
    <section
      aria-label="Trade Performance Summary"
      className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden"
    >
      {/* Header Bar */}
      <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
            Trade Performance Summary
          </h2>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            {scope === 'SESSION' ? (
              <span>Session since {fmtSessionClock(sessionStartedAt)}</span>
            ) : (
              <span>All logged trades</span>
            )}
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              {metrics.closedCount} closed
            </span>
            {metrics.openCount > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  {metrics.openCount} open
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Scope Segmented Control */}
          <div
            role="group"
            aria-label="Performance scope"
            className="inline-flex items-center p-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
          >
            <button
              type="button"
              onClick={() => {
                setScope('SESSION');
                setSelectedTradeId(null);
              }}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                scope === 'SESSION'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Current Session ({sessionTrades.length})
            </button>
            <button
              type="button"
              onClick={() => {
                setScope('ALL');
                setSelectedTradeId(null);
              }}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                scope === 'ALL'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              All Logged ({trades.length})
            </button>
          </div>

          {metrics.openCount > 0 && (
            <button
              type="button"
              onClick={() => setIncludeOpen((prev) => !prev)}
              aria-pressed={includeOpen}
              className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                includeOpen
                  ? 'border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-950/40 dark:text-blue-300'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              {includeOpen ? 'Showing Open + Closed' : 'Include Open MTM'}
            </button>
          )}

          {scope === 'SESSION' && (
            <button
              type="button"
              onClick={handleResetSession}
              title="Reset current session clock to now"
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Session</span>
            </button>
          )}
        </div>
      </div>

      {/* Body: Empty, Open-only notice, or Full Metrics */}
      {scopedTrades.length === 0 ? (
        <div className="px-5 py-7 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              {scope === 'SESSION'
                ? 'No trades logged in the current session yet'
                : 'No trades logged yet'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xl">
              {scope === 'SESSION'
                ? 'Execute or close a trade during this session to calculate live Win Rate, Average Gain, Average Loss, and Payoff Ratio.'
                : 'Log or close your first trade to start tracking Win Rate, Average Gain, and Average Loss.'}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {scope === 'SESSION' && trades.length > 0 && (
              <button
                type="button"
                onClick={() => setScope('ALL')}
                className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap cursor-pointer transition-colors"
              >
                View All Logged ({trades.length})
              </button>
            )}
            {onNewTrade && (
              <button
                type="button"
                onClick={onNewTrade}
                className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{newTradeLabel}</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* 4-Column Flat KPI Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 dark:divide-slate-800">
            {/* 1. Win Rate */}
            <div className="p-5 space-y-2">
              <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span className="font-medium">Win Rate</span>
                {metrics.winRatePct !== null && (
                  <span
                    className={`inline-flex items-center gap-1 font-semibold ${
                      metrics.winRatePct >= 50
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {metrics.winRatePct >= 50 ? (
                      <TrendingUp className="w-3.5 h-3.5" />
                    ) : (
                      <TrendingDown className="w-3.5 h-3.5" />
                    )}
                    <span>{metrics.winRatePct >= 50 ? 'Positive' : 'Below 50%'}</span>
                  </span>
                )}
              </div>

              <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                {metrics.winRatePct !== null ? `${metrics.winRatePct.toFixed(1)}%` : '—'}
              </div>

              <div className="space-y-1.5">
                <div
                  className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex"
                  role="img"
                  aria-label={
                    metrics.decidedCount > 0
                      ? `${metrics.wins} winning trades and ${metrics.losses} losing trades`
                      : 'No decided trades yet'
                  }
                >
                  {metrics.decidedCount > 0 && (
                    <>
                      <div
                        className="h-full bg-emerald-500 transition-all duration-200"
                        style={{ width: `${winShare}%` }}
                      />
                      <div
                        className="h-full bg-rose-500 transition-all duration-200"
                        style={{ width: `${lossShare}%` }}
                      />
                    </>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                    {metrics.wins}W
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="text-rose-600 dark:text-rose-400 font-semibold">
                    {metrics.losses}L
                  </span>
                  {metrics.breakevens > 0 && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>{metrics.breakevens} Flat</span>
                    </>
                  )}
                  {!includeOpen && metrics.closedCount === 0 && metrics.openCount > 0 && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="font-sans">Awaiting close</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* 2. Average Gain */}
            <div className="p-5 space-y-2">
              <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span className="font-medium">Average Gain</span>
                {metrics.avgGainPct !== null && (
                  <span className="font-mono tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">
                    {fmtSignedPct(metrics.avgGainPct)}
                  </span>
                )}
              </div>

              <div className="text-2xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                {metrics.avgGain !== null
                  ? `+${fmtMoney(metrics.avgGain, currencySymbol)}`
                  : '—'}
              </div>

              <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {metrics.bestTrade ? (
                  <span>
                    Best:{' '}
                    <span className="font-semibold text-slate-700 dark:text-slate-200">
                      {metrics.bestTrade.symbol}
                    </span>{' '}
                    <span className="font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                      +{fmtMoney(metrics.bestTrade.pnl, metrics.bestTrade.currencySymbol || currencySymbol)}
                    </span>
                  </span>
                ) : (
                  <span>No winning trades yet</span>
                )}
              </div>
            </div>

            {/* 3. Average Loss */}
            <div className="p-5 space-y-2">
              <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span className="font-medium">Average Loss</span>
                {metrics.avgLossPct !== null && (
                  <span className="font-mono tabular-nums font-semibold text-rose-600 dark:text-rose-400">
                    {fmtSignedPct(metrics.avgLossPct)}
                  </span>
                )}
              </div>

              <div className="text-2xl font-bold font-mono tabular-nums text-rose-600 dark:text-rose-400">
                {metrics.avgLoss !== null
                  ? `-${fmtMoney(metrics.avgLoss, currencySymbol)}`
                  : '—'}
              </div>

              <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {metrics.worstTrade ? (
                  <span>
                    Worst:{' '}
                    <span className="font-semibold text-slate-700 dark:text-slate-200">
                      {metrics.worstTrade.symbol}
                    </span>{' '}
                    <span className="font-mono tabular-nums text-rose-600 dark:text-rose-400">
                      -{fmtMoney(metrics.worstTrade.pnl, metrics.worstTrade.currencySymbol || currencySymbol)}
                    </span>
                  </span>
                ) : (
                  <span>No losing trades recorded</span>
                )}
              </div>
            </div>

            {/* 4. Net P&L & Payoff / Expectancy */}
            <div className="p-5 space-y-2">
              <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span className="font-medium">
                  {includeOpen ? 'Net Session P&L' : 'Realized P&L'}
                </span>
                {metrics.avgPnL !== null && (
                  <span className="font-mono tabular-nums text-slate-600 dark:text-slate-300">
                    Avg {fmtSignedMoney(metrics.avgPnL, currencySymbol)}
                  </span>
                )}
              </div>

              <div
                className={`text-2xl font-bold font-mono tabular-nums ${
                  metrics.evaluatedCount === 0
                    ? 'text-slate-900 dark:text-white'
                    : metrics.netPnL > 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : metrics.netPnL < 0
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-slate-900 dark:text-white'
                }`}
              >
                {metrics.evaluatedCount > 0
                  ? fmtSignedMoney(metrics.netPnL, currencySymbol)
                  : '—'}
              </div>

              <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                <span>
                  R:R{' '}
                  <strong className="font-semibold text-slate-700 dark:text-slate-200">
                    {metrics.payoffRatio !== null ? `${metrics.payoffRatio.toFixed(2)}x` : '—'}
                  </strong>
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  PF{' '}
                  <strong className="font-semibold text-slate-700 dark:text-slate-200">
                    {metrics.profitFactor === null
                      ? '—'
                      : !Number.isFinite(metrics.profitFactor)
                        ? '∞'
                        : `${metrics.profitFactor.toFixed(2)}x`}
                  </strong>
                </span>
              </div>
            </div>
          </div>

          {/* Open-only guidance bar when 0 closed trades exist in scope */}
          {!includeOpen && metrics.closedCount === 0 && metrics.openCount > 0 && (
            <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/30 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="text-slate-600 dark:text-slate-300">
                <span className="font-semibold text-slate-900 dark:text-white font-mono tabular-nums">
                  {metrics.openCount}
                </span>{' '}
                open {metrics.openCount === 1 ? 'trade' : 'trades'} logged in this scope (Open MTM:{' '}
                <span
                  className={`font-mono tabular-nums font-semibold ${
                    metrics.openUnrealizedPnL > 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : metrics.openUnrealizedPnL < 0
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-slate-700 dark:text-slate-200'
                  }`}
                >
                  {fmtSignedMoney(metrics.openUnrealizedPnL, currencySymbol)}
                </span>
                ). Close a position to lock realized stats, or preview live MTM.
              </div>
              <button
                type="button"
                onClick={() => setIncludeOpen(true)}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap cursor-pointer"
              >
                Include Open MTM
              </button>
            </div>
          )}

          {/* Session Trade Distribution Strip */}
          {metrics.evaluatedTrades.length > 0 && (
            <div className="px-5 py-3.5 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-medium text-slate-500 dark:text-slate-400">
                  Trade Outcomes ({metrics.evaluatedTrades.length}{' '}
                  {metrics.evaluatedTrades.length === 1 ? 'trade' : 'trades'})
                </span>
                {activeTrade ? (
                  <div className="flex flex-wrap items-center gap-2 text-slate-600 dark:text-slate-300">
                    {onSelectStock && activeTrade.market ? (
                      <button
                        type="button"
                        onClick={() => onSelectStock(activeTrade.symbol, activeTrade.market!)}
                        className="font-bold text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 hover:underline cursor-pointer"
                      >
                        {activeTrade.instrument}
                      </button>
                    ) : (
                      <span className="font-bold text-slate-900 dark:text-white">
                        {activeTrade.instrument}
                      </span>
                    )}
                    <span aria-hidden="true">·</span>
                    <span>
                      {activeTrade.side} {activeTrade.status === 'OPEN' ? '(Open)' : '(Closed)'}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span
                      className={`font-mono tabular-nums font-semibold ${
                        activeTrade.pnl > 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : activeTrade.pnl < 0
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {fmtSignedMoney(
                        activeTrade.pnl,
                        activeTrade.currencySymbol || currencySymbol
                      )}{' '}
                      ({fmtSignedPct(activeTrade.pnlPct)})
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums text-slate-400">
                      {fmtTradeTime(activeTrade.closedAt || activeTrade.openedAt)}
                    </span>
                  </div>
                ) : (
                  <span className="text-slate-400 dark:text-slate-500">
                    Select any bar to inspect trade details
                  </span>
                )}
              </div>

              <div className="flex items-end gap-1.5 h-10 overflow-x-auto pb-0.5">
                {metrics.evaluatedTrades.slice(-24).map((t) => {
                  const pctHeight =
                    maxAbsPnl > 0 ? Math.max(22, Math.round((Math.abs(t.pnl) / maxAbsPnl) * 100)) : 28;
                  const isWin = t.pnl > 0;
                  const isLoss = t.pnl < 0;
                  const isSelected = selectedTradeId === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSelectedTradeId(isSelected ? null : t.id)}
                      onMouseEnter={() => setSelectedTradeId(t.id)}
                      title={`${t.instrument}: ${fmtSignedMoney(
                        t.pnl,
                        t.currencySymbol || currencySymbol
                      )} (${fmtSignedPct(t.pnlPct)})`}
                      aria-label={`${t.instrument} ${fmtSignedMoney(
                        t.pnl,
                        t.currencySymbol || currencySymbol
                      )}`}
                      className={`group flex-1 min-w-[14px] max-w-[32px] h-full flex items-end cursor-pointer rounded-sm focus-visible:outline-2 focus-visible:outline-blue-600 ${
                        isSelected ? 'ring-1 ring-slate-400 dark:ring-slate-500' : ''
                      }`}
                    >
                      <span
                        className={`w-full rounded-t-sm transition-opacity ${
                          isWin
                            ? 'bg-emerald-500/85 group-hover:bg-emerald-500'
                            : isLoss
                              ? 'bg-rose-500/85 group-hover:bg-rose-500'
                              : 'bg-slate-300 dark:bg-slate-600'
                        }`}
                        style={{ height: `${pctHeight}%` }}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
};

export default TradePerformanceSummary;
