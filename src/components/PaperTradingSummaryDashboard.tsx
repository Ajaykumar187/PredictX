import React, { useMemo, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Cell,
} from 'recharts';
import { ClosedPaperTrade, formatTradeDuration } from '../utils/paperTrades';

export type SummaryScope = 'ALL' | 'Equity' | 'Options';
type ChartView = 'buckets' | 'trades';

interface Props {
  closedTrades: ClosedPaperTrade[];
  equityBalance: number;
  equityInitialCash: number;
  optionsBalance: number;
  optionsInitialCash: number;
  showHistoryLink?: boolean;
  onViewHistory?: () => void;
}

interface BucketDatum {
  key: string;
  label: string;
  rangeText: string;
  count: number;
  totalPnL: number;
  sharePct: number;
  kind: 'loss' | 'profit';
}

interface TradeBarDatum {
  id: string;
  label: string;
  instrument: string;
  subtitle: string;
  pnl: number;
  pnlPct: number;
  entryPrice: number;
  exitPrice: number;
  durationText: string;
  closedAt: string;
}

interface CumulativePoint {
  key: string;
  label: string;
  timestampText: string;
  cumulativePnL: number;
  tradePnL: number | null;
  instrument: string;
  subtitle: string;
  tradeIndex: number;
}

const NICE_STEPS = [
  50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000, 250000, 500000,
];

const formatInr = (n: number, decimals = 2) => {
  const abs = Math.abs(n);
  return `₹${abs.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
};

const formatCompactInr = (n: number) =>
  `₹${Math.round(Math.abs(n)).toLocaleString('en-IN')}`;

const formatShortRupee = (n: number) => {
  const abs = Math.abs(n);
  if (abs >= 100000) {
    const v = abs / 100000;
    return `₹${Number.isInteger(v) ? v : v.toFixed(1)}L`;
  }
  if (abs >= 1000) {
    const v = abs / 1000;
    return `₹${Number.isInteger(v) ? v : v.toFixed(1)}k`;
  }
  return `₹${Math.round(abs)}`;
};

function pickBucketStep(maxAbs: number): number {
  const target = Math.max(maxAbs, 100);
  for (const s of NICE_STEPS) {
    if (3 * s >= target) return s;
  }
  const pow = Math.pow(10, Math.floor(Math.log10(target / 3)));
  return Math.ceil(target / 3 / pow) * pow;
}

function buildDistributionBuckets(trades: ClosedPaperTrade[]): BucketDatum[] {
  if (trades.length === 0) return [];
  const maxAbs = Math.max(...trades.map((t) => Math.abs(t.pnl)), 100);
  const step = pickBucketStep(maxAbs);
  const s1 = formatShortRupee(step);
  const s2 = formatShortRupee(step * 2);

  const buckets: BucketDatum[] = [
    {
      key: 'l3',
      label: `≤ -${s2}`,
      rangeText: `Loss ${s2} or more`,
      count: 0,
      totalPnL: 0,
      sharePct: 0,
      kind: 'loss',
    },
    {
      key: 'l2',
      label: `-${s2}..-${s1}`,
      rangeText: `-${s2} to -${s1}`,
      count: 0,
      totalPnL: 0,
      sharePct: 0,
      kind: 'loss',
    },
    {
      key: 'l1',
      label: `-${s1}..₹0`,
      rangeText: `-${s1} to ₹0`,
      count: 0,
      totalPnL: 0,
      sharePct: 0,
      kind: 'loss',
    },
    {
      key: 'p1',
      label: `₹0..+${s1}`,
      rangeText: `₹0 to +${s1}`,
      count: 0,
      totalPnL: 0,
      sharePct: 0,
      kind: 'profit',
    },
    {
      key: 'p2',
      label: `+${s1}..+${s2}`,
      rangeText: `+${s1} to +${s2}`,
      count: 0,
      totalPnL: 0,
      sharePct: 0,
      kind: 'profit',
    },
    {
      key: 'p3',
      label: `≥ +${s2}`,
      rangeText: `Profit ${s2} or more`,
      count: 0,
      totalPnL: 0,
      sharePct: 0,
      kind: 'profit',
    },
  ];

  for (const t of trades) {
    let idx = 3;
    if (t.pnl <= -2 * step) idx = 0;
    else if (t.pnl <= -step) idx = 1;
    else if (t.pnl < 0) idx = 2;
    else if (t.pnl < step) idx = 3;
    else if (t.pnl < 2 * step) idx = 4;
    else idx = 5;

    buckets[idx].count += 1;
    buckets[idx].totalPnL += t.pnl;
  }

  for (const b of buckets) {
    b.sharePct = (b.count / trades.length) * 100;
  }

  return buckets;
}

const BucketTooltip: React.FC<{
  active?: boolean;
  payload?: Array<{ payload: BucketDatum }>;
}> = ({ active, payload }) => {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;
  const pnlColor =
    d.totalPnL > 0
      ? 'text-emerald-600 dark:text-emerald-400'
      : d.totalPnL < 0
      ? 'text-rose-600 dark:text-rose-400'
      : 'text-slate-600 dark:text-slate-300';

  return (
    <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-lg px-3.5 py-2.5 text-xs space-y-1">
      <div className="font-semibold text-slate-900 dark:text-white">{d.rangeText}</div>
      <div className="flex items-center justify-between gap-4 text-slate-600 dark:text-slate-300">
        <span>Trades</span>
        <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
          {d.count} ({d.sharePct.toFixed(0)}%)
        </span>
      </div>
      <div className="flex items-center justify-between gap-4 text-slate-600 dark:text-slate-300">
        <span>Combined P&amp;L</span>
        <span className={`font-mono tabular-nums font-bold ${pnlColor}`}>
          {d.totalPnL > 0 ? '+' : d.totalPnL < 0 ? '-' : ''}
          {formatInr(d.totalPnL)}
        </span>
      </div>
    </div>
  );
};

const TradeBarTooltip: React.FC<{
  active?: boolean;
  payload?: Array<{ payload: TradeBarDatum }>;
}> = ({ active, payload }) => {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;
  const pnlColor =
    d.pnl > 0
      ? 'text-emerald-600 dark:text-emerald-400'
      : d.pnl < 0
      ? 'text-rose-600 dark:text-rose-400'
      : 'text-slate-600 dark:text-slate-300';
  const statusLabel = d.pnl > 0 ? 'Profit' : d.pnl < 0 ? 'Loss' : 'Flat';

  return (
    <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-lg px-3.5 py-2.5 text-xs space-y-1 min-w-[190px]">
      <div className="font-semibold text-slate-900 dark:text-white">{d.instrument}</div>
      <div className="text-slate-500 dark:text-slate-400">{d.subtitle}</div>
      <div className="pt-1 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4">
        <span className="text-slate-500 dark:text-slate-400">{statusLabel}</span>
        <span className={`font-mono tabular-nums font-bold ${pnlColor}`}>
          {d.pnl >= 0 ? '+' : '-'}
          {formatInr(d.pnl)} ({d.pnlPct >= 0 ? '+' : ''}
          {d.pnlPct.toFixed(2)}%)
        </span>
      </div>
      <div className="flex items-center justify-between gap-4 text-slate-500 dark:text-slate-400 font-mono tabular-nums">
        <span>Entry → Exit</span>
        <span className="text-slate-800 dark:text-slate-200">
          ₹{d.entryPrice.toFixed(2)} → ₹{d.exitPrice.toFixed(2)}
        </span>
      </div>
      <div className="flex items-center justify-between gap-4 text-slate-500 dark:text-slate-400 font-mono tabular-nums">
        <span>Duration</span>
        <span className="text-slate-800 dark:text-slate-200">{d.durationText}</span>
      </div>
    </div>
  );
};

function formatAxisTimestamp(iso: string, includeTime: boolean): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  if (includeTime) {
    return d.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

function buildCumulativeSeries(trades: ClosedPaperTrade[]): {
  points: CumulativePoint[];
  peakPnL: number;
  maxDrawdown: number;
} {
  if (trades.length === 0) {
    return { points: [], peakPnL: 0, maxDrawdown: 0 };
  }

  const chronological = [...trades].sort(
    (a, b) => Date.parse(a.closedAt) - Date.parse(b.closedAt)
  );
  const distinctDays = new Set(chronological.map((t) => t.closedAt.slice(0, 10)));
  const includeTime = distinctDays.size < Math.min(chronological.length, 4);

  const points: CumulativePoint[] = [
    {
      key: 'baseline',
      label: 'Start',
      timestampText: formatAxisTimestamp(chronological[0].openedAt, true),
      cumulativePnL: 0,
      tradePnL: null,
      instrument: 'Starting Baseline',
      subtitle: 'Initial realised P&L',
      tradeIndex: 0,
    },
  ];

  let running = 0;
  let peak = 0;
  let maxDrawdown = 0;

  chronological.forEach((t, idx) => {
    running += t.pnl;
    if (running > peak) peak = running;
    const dd = peak - running;
    if (dd > maxDrawdown) maxDrawdown = dd;

    points.push({
      key: t.id,
      label: formatAxisTimestamp(t.closedAt, includeTime),
      timestampText: formatAxisTimestamp(t.closedAt, true),
      cumulativePnL: Number(running.toFixed(2)),
      tradePnL: Number(t.pnl.toFixed(2)),
      instrument: t.instrument,
      subtitle: t.subtitle,
      tradeIndex: idx + 1,
    });
  });

  return { points, peakPnL: peak, maxDrawdown };
}

const CumulativeTooltip: React.FC<{
  active?: boolean;
  payload?: Array<{ payload: CumulativePoint }>;
}> = ({ active, payload }) => {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;
  const cumColor =
    d.cumulativePnL > 0
      ? 'text-emerald-600 dark:text-emerald-400'
      : d.cumulativePnL < 0
      ? 'text-rose-600 dark:text-rose-400'
      : 'text-slate-600 dark:text-slate-300';
  const statusLabel =
    d.cumulativePnL > 0 ? 'Net Profit' : d.cumulativePnL < 0 ? 'Net Loss' : 'Breakeven';

  return (
    <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-lg px-3.5 py-2.5 text-xs space-y-1 min-w-[200px]">
      <div className="font-semibold text-slate-900 dark:text-white">
        {d.tradeIndex > 0 ? `Trade #${d.tradeIndex} · ${d.instrument}` : d.instrument}
      </div>
      <div className="text-slate-500 dark:text-slate-400">
        {d.subtitle} · {d.timestampText}
      </div>
      <div className="pt-1 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4">
        <span className="text-slate-500 dark:text-slate-400">Cumulative ({statusLabel})</span>
        <span className={`font-mono tabular-nums font-bold ${cumColor}`}>
          {d.cumulativePnL > 0 ? '+' : d.cumulativePnL < 0 ? '-' : ''}
          {formatInr(d.cumulativePnL)}
        </span>
      </div>
      {d.tradePnL !== null && (
        <div className="flex items-center justify-between gap-4 text-slate-500 dark:text-slate-400">
          <span>This trade</span>
          <span
            className={`font-mono tabular-nums font-semibold ${
              d.tradePnL > 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : d.tradePnL < 0
                ? 'text-rose-600 dark:text-rose-400'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            {d.tradePnL > 0 ? '+' : d.tradePnL < 0 ? '-' : ''}
            {formatInr(d.tradePnL)}
          </span>
        </div>
      )}
    </div>
  );
};

export const PaperTradingSummaryDashboard: React.FC<Props> = ({
  closedTrades,
  equityBalance,
  equityInitialCash,
  optionsBalance,
  optionsInitialCash,
  showHistoryLink = false,
  onViewHistory,
}) => {
  const [scope, setScope] = useState<SummaryScope>('ALL');
  const [chartView, setChartView] = useState<ChartView>('buckets');

  const scopedTrades = useMemo(() => {
    if (scope === 'ALL') return closedTrades;
    return closedTrades.filter((t) => t.segment === scope);
  }, [closedTrades, scope]);

  const metrics = useMemo(() => {
    const count = scopedTrades.length;
    let totalPnL = 0;
    let grossProfit = 0;
    let grossLoss = 0;
    let wins = 0;
    let losses = 0;
    let flat = 0;
    let totalDurationMs = 0;
    let minDurationMs = Number.POSITIVE_INFINITY;
    let maxDurationMs = 0;
    let bestTrade: ClosedPaperTrade | null = null;
    let worstTrade: ClosedPaperTrade | null = null;

    for (const t of scopedTrades) {
      totalPnL += t.pnl;
      totalDurationMs += t.durationMs;
      if (t.durationMs < minDurationMs) minDurationMs = t.durationMs;
      if (t.durationMs > maxDurationMs) maxDurationMs = t.durationMs;

      if (t.pnl > 0) {
        wins += 1;
        grossProfit += t.pnl;
        if (!bestTrade || t.pnl > bestTrade.pnl) bestTrade = t;
      } else if (t.pnl < 0) {
        losses += 1;
        grossLoss += Math.abs(t.pnl);
        if (!worstTrade || t.pnl < worstTrade.pnl) worstTrade = t;
      } else {
        flat += 1;
      }
    }

    const winRate = count > 0 ? (wins / count) * 100 : 0;
    const lossRate = count > 0 ? (losses / count) * 100 : 0;
    const avgDurationMs = count > 0 ? totalDurationMs / count : 0;
    const avgWin = wins > 0 ? grossProfit / wins : null;
    const avgLoss = losses > 0 ? -(grossLoss / losses) : null;
    const profitFactor =
      grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Number.POSITIVE_INFINITY : null;

    const currentBalance =
      scope === 'Equity'
        ? equityBalance
        : scope === 'Options'
        ? optionsBalance
        : equityBalance + optionsBalance;

    const initialCapital =
      scope === 'Equity'
        ? equityInitialCash
        : scope === 'Options'
        ? optionsInitialCash
        : equityInitialCash + optionsInitialCash;

    const returnPct = initialCapital > 0 ? (totalPnL / initialCapital) * 100 : 0;
    const balanceChange = currentBalance - initialCapital;
    const balanceChangePct = initialCapital > 0 ? (balanceChange / initialCapital) * 100 : 0;

    return {
      count,
      wins,
      losses,
      flat,
      winRate,
      lossRate,
      totalPnL,
      grossProfit,
      grossLoss,
      returnPct,
      avgDurationMs,
      minDurationMs: count > 0 ? minDurationMs : 0,
      maxDurationMs: count > 0 ? maxDurationMs : 0,
      avgWin,
      avgLoss,
      profitFactor,
      bestTrade,
      worstTrade,
      currentBalance,
      initialCapital,
      balanceChange,
      balanceChangePct,
    };
  }, [scopedTrades, scope, equityBalance, equityInitialCash, optionsBalance, optionsInitialCash]);

  const bucketData = useMemo(() => buildDistributionBuckets(scopedTrades), [scopedTrades]);
  const cumulativeSeries = useMemo(() => buildCumulativeSeries(scopedTrades), [scopedTrades]);

  const perTradeData = useMemo<TradeBarDatum[]>(() => {
    const chronological = [...scopedTrades].slice(0, 24).reverse();
    return chronological.map((t, idx) => ({
      id: t.id,
      label: `#${idx + 1} ${t.symbol}`,
      instrument: t.instrument,
      subtitle: t.subtitle,
      pnl: Number(t.pnl.toFixed(2)),
      pnlPct: t.pnlPct,
      entryPrice: t.entryPrice,
      exitPrice: t.exitPrice,
      durationText: formatTradeDuration(t.durationMs),
      closedAt: t.closedAt,
    }));
  }, [scopedTrades]);

  const cumulativeLineStroke = metrics.totalPnL >= 0 ? '#10b981' : '#e11d48';

  const pnlColor =
    metrics.totalPnL > 0
      ? 'text-emerald-600 dark:text-emerald-400'
      : metrics.totalPnL < 0
      ? 'text-rose-600 dark:text-rose-400'
      : 'text-slate-900 dark:text-white';

  const pnlLabel =
    metrics.totalPnL > 0 ? 'Net Profit' : metrics.totalPnL < 0 ? 'Net Loss' : 'Breakeven';

  const balanceDeltaColor =
    metrics.balanceChange >= 0
      ? 'text-emerald-600 dark:text-emerald-400'
      : 'text-rose-600 dark:text-rose-400';

  return (
    <section
      aria-label="Trading performance summary"
      className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 space-y-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Performance Summary
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
            {metrics.count === 0
              ? 'Calculated from closed trades · No closed positions recorded yet'
              : `Calculated from ${metrics.count} closed ${metrics.count === 1 ? 'trade' : 'trades'} · ${metrics.wins} profit · ${metrics.losses} loss${metrics.flat > 0 ? ` · ${metrics.flat} flat` : ''}`}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="inline-flex items-center p-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            {(['ALL', 'Equity', 'Options'] as SummaryScope[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setScope(s)}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  scope === s
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {s === 'ALL' ? 'All Trades' : s === 'Equity' ? 'Equities' : 'Options'}
              </button>
            ))}
          </div>

          {showHistoryLink && onViewHistory && (
            <button
              type="button"
              onClick={onViewHistory}
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>Trading History</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 pt-4 border-t border-slate-100 dark:border-slate-800">
        <div className="space-y-1">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Current Account Balance
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
            {formatCompactInr(metrics.currentBalance)}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            <span className={balanceDeltaColor}>
              {metrics.balanceChange >= 0 ? '+' : '-'}
              {formatCompactInr(metrics.balanceChange)} ({metrics.balanceChangePct >= 0 ? '+' : ''}
              {metrics.balanceChangePct.toFixed(2)}%)
            </span>
          </div>
          {scope === 'ALL' && (
            <div className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
              Equities {formatCompactInr(equityBalance)} · F&amp;O {formatCompactInr(optionsBalance)}
            </div>
          )}
        </div>

        <div className="space-y-1">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Total Realised P&amp;L
          </div>
          <div className={`text-2xl font-bold font-mono tabular-nums ${pnlColor}`}>
            {metrics.totalPnL > 0 ? '+' : metrics.totalPnL < 0 ? '-' : ''}
            {formatInr(metrics.totalPnL)}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            <span className={pnlColor}>{pnlLabel}</span>
            <span aria-hidden="true"> · </span>
            <span>
              {metrics.returnPct >= 0 ? '+' : ''}
              {metrics.returnPct.toFixed(2)}% on capital
            </span>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Win Rate</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
            {metrics.count > 0 ? `${metrics.winRate.toFixed(1)}%` : '—'}
          </div>
          <div
            className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex"
            role="img"
            aria-label={`Win rate ${metrics.winRate.toFixed(1)} percent`}
          >
            {metrics.count > 0 && (
              <>
                <div
                  className="bg-emerald-500 h-full transition-all"
                  style={{ width: `${metrics.winRate}%` }}
                />
                <div
                  className="bg-rose-500 h-full transition-all"
                  style={{ width: `${metrics.lossRate}%` }}
                />
              </>
            )}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {metrics.wins} wins · {metrics.losses} losses
            {metrics.flat > 0 ? ` · ${metrics.flat} flat` : ''}
          </div>
        </div>

        <div className="space-y-1">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Average Trade Duration
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
            {metrics.count > 0 ? formatTradeDuration(metrics.avgDurationMs) : '—'}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            {metrics.count >= 2
              ? `Min ${formatTradeDuration(metrics.minDurationMs)} · Max ${formatTradeDuration(metrics.maxDurationMs)}`
              : metrics.count === 1
              ? 'Based on 1 closed trade'
              : 'Entry to exit hold time'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs">
        <div>
          <div className="text-slate-500 dark:text-slate-400">Profit Factor</div>
          <div className="font-mono tabular-nums font-semibold text-slate-900 dark:text-white mt-0.5">
            {metrics.profitFactor === null
              ? '—'
              : !Number.isFinite(metrics.profitFactor)
              ? '∞'
              : metrics.profitFactor.toFixed(2)}
          </div>
        </div>

        <div>
          <div className="text-slate-500 dark:text-slate-400">Average Win</div>
          <div className="font-mono tabular-nums font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">
            {metrics.avgWin !== null ? `+${formatInr(metrics.avgWin)}` : '—'}
          </div>
        </div>

        <div>
          <div className="text-slate-500 dark:text-slate-400">Average Loss</div>
          <div className="font-mono tabular-nums font-semibold text-rose-600 dark:text-rose-400 mt-0.5">
            {metrics.avgLoss !== null ? `-${formatInr(metrics.avgLoss)}` : '—'}
          </div>
        </div>

        <div>
          <div className="text-slate-500 dark:text-slate-400">Best Trade</div>
          <div className="font-mono tabular-nums font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5 truncate">
            {metrics.bestTrade
              ? `+${formatInr(metrics.bestTrade.pnl)} · ${metrics.bestTrade.symbol}`
              : '—'}
          </div>
        </div>

        <div>
          <div className="text-slate-500 dark:text-slate-400">Worst Trade</div>
          <div className="font-mono tabular-nums font-semibold text-rose-600 dark:text-rose-400 mt-0.5 truncate">
            {metrics.worstTrade
              ? `-${formatInr(metrics.worstTrade.pnl)} · ${metrics.worstTrade.symbol}`
              : '—'}
          </div>
        </div>
      </div>

      <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
        {metrics.count === 0 ? (
          <div className="py-6 text-center rounded-xl bg-slate-50/70 dark:bg-slate-800/30 border border-dashed border-slate-200 dark:border-slate-800">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Close at least one equity or option paper trade to visualize your cumulative P&amp;L curve and profit vs. loss distribution.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-stretch">
            <div className="flex flex-col space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 min-h-[38px]">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                    Cumulative Profit / Loss Over Time
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono tabular-nums">
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                      Peak +{formatCompactInr(cumulativeSeries.peakPnL)}
                    </span>
                    <span aria-hidden="true"> · </span>
                    <span className="text-rose-600 dark:text-rose-400 font-semibold">
                      Max Drawdown -{formatCompactInr(cumulativeSeries.maxDrawdown)}
                    </span>
                  </p>
                </div>
                <div className={`text-xs font-mono tabular-nums font-bold ${pnlColor}`}>
                  {pnlLabel} · {metrics.totalPnL > 0 ? '+' : metrics.totalPnL < 0 ? '-' : ''}
                  {formatCompactInr(metrics.totalPnL)}
                </div>
              </div>

              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={cumulativeSeries.points}
                    margin={{ top: 8, right: 12, left: 4, bottom: 4 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="currentColor"
                      className="text-slate-200 dark:text-slate-800"
                    />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      axisLine={{ stroke: '#cbd5e1' }}
                      tickLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v: number) =>
                        `${v > 0 ? '+' : v < 0 ? '-' : ''}${formatShortRupee(v)}`
                      }
                    />
                    <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="3 3" strokeWidth={1} />
                    <Tooltip content={<CumulativeTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="cumulativePnL"
                      stroke={cumulativeLineStroke}
                      strokeWidth={2.25}
                      dot={{ r: 3, fill: cumulativeLineStroke, strokeWidth: 0 }}
                      activeDot={{ r: 5, fill: cumulativeLineStroke, stroke: '#ffffff', strokeWidth: 2 }}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="flex flex-col space-y-3 xl:pl-6 xl:border-l xl:border-slate-100 dark:xl:border-slate-800">
              <div className="flex flex-wrap items-center justify-between gap-2 min-h-[38px]">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                    Profit vs. Loss Distribution
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono tabular-nums">
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                      Gross Profit +{formatCompactInr(metrics.grossProfit)}
                    </span>
                    <span aria-hidden="true"> · </span>
                    <span className="text-rose-600 dark:text-rose-400 font-semibold">
                      Gross Loss -{formatCompactInr(metrics.grossLoss)}
                    </span>
                  </p>
                </div>

                <div className="inline-flex items-center p-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setChartView('buckets')}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      chartView === 'buckets'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    P&amp;L Buckets
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartView('trades')}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      chartView === 'trades'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    By Trade
                  </button>
                </div>
              </div>

              {chartView === 'buckets' ? (
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={bucketData} margin={{ top: 8, right: 12, left: -12, bottom: 4 }}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="currentColor"
                        className="text-slate-200 dark:text-slate-800"
                      />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 11, fill: '#64748b' }}
                        axisLine={{ stroke: '#cbd5e1' }}
                        tickLine={false}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fontSize: 11, fill: '#64748b' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        cursor={{ fill: 'rgba(148, 163, 184, 0.12)' }}
                        content={<BucketTooltip />}
                      />
                      <Bar dataKey="count" radius={[5, 5, 0, 0]} maxBarSize={52}>
                        {bucketData.map((entry) => (
                          <Cell
                            key={entry.key}
                            fill={entry.kind === 'profit' ? '#10b981' : '#e11d48'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={perTradeData} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="currentColor"
                        className="text-slate-200 dark:text-slate-800"
                      />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 11, fill: '#64748b' }}
                        axisLine={{ stroke: '#cbd5e1' }}
                        tickLine={false}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: '#64748b' }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v: number) =>
                          `${v > 0 ? '+' : v < 0 ? '-' : ''}${formatShortRupee(v)}`
                        }
                      />
                      <ReferenceLine y={0} stroke="#94a3b8" strokeWidth={1} />
                      <Tooltip
                        cursor={{ fill: 'rgba(148, 163, 184, 0.12)' }}
                        content={<TradeBarTooltip />}
                      />
                      <Bar dataKey="pnl" maxBarSize={40}>
                        {perTradeData.map((entry) => (
                          <Cell
                            key={entry.id}
                            fill={
                              entry.pnl > 0
                                ? '#10b981'
                                : entry.pnl < 0
                                ? '#e11d48'
                                : '#64748b'
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default PaperTradingSummaryDashboard;
