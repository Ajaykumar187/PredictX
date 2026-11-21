import React, { useEffect, useMemo, useState } from 'react';
import { Award, Download, Loader2, Trash2 } from 'lucide-react';
import { AnalysisResult, MarketType } from '../types';
import {
  LoggedPrediction,
  clearPredictionLog,
  getPredictionLog,
  liveStats,
  resolveDuePredictions,
  walkForwardBacktest,
} from '../utils/accuracy';
import { storage } from '../utils/storage';
import { fetchBatchQuotes, type BatchQuote } from '../utils/stockApi';
import {
  computeOptionPaperMetrics,
  deriveClosedEquityTrades,
  deriveClosedOptionTrades,
  deriveOpenEquityTimestamps,
  deriveOpenOptionTimestamps,
  getOrders,
  subscribeOrders,
} from '../utils/paperTrades';
import {
  buildTradesForAccuracy,
  evaluateTradeAccuracy,
  getTradeForecasts,
  subscribeTradeForecasts,
} from '../utils/tradeAccuracy';
import { TradeAccuracyPanel } from '../components/TradeAccuracyPanel';

interface TrackRecordPageProps {
  currentAnalysis?: AnalysisResult | null;
  theme?: 'Light' | 'Dark';
  onSelectStock?: (symbol: string, market: MarketType) => void;
}

const card = 'bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm';
const fmtPct = (v: number | null, d = 1) => (v === null ? '—' : `${v.toFixed(d)}%`);

const Stat: React.FC<{ label: string; value: string; note?: string }> = ({ label, value, note }) => (
  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</div>
    <div className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">{value}</div>
    {note && <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{note}</div>}
  </div>
);

export const TrackRecordPage: React.FC<TrackRecordPageProps> = ({ currentAnalysis, onSelectStock }) => {
  const [log, setLog] = useState<LoggedPrediction[]>(() => getPredictionLog());
  const [resolving, setResolving] = useState(false);
  const [paperAcc, setPaperAcc] = useState(() => storage.getPaperAccount());
  const [optOrders, setOptOrders] = useState(() => getOrders());
  const [tradeForecasts, setTradeForecasts] = useState(() => getTradeForecasts());
  const [openQuotes, setOpenQuotes] = useState<Record<string, BatchQuote>>({});

  useEffect(() => {
    const unsubOrders = subscribeOrders(() => setOptOrders(getOrders()));
    const unsubForecasts = subscribeTradeForecasts(() => setTradeForecasts(getTradeForecasts()));
    const onFocus = () => setPaperAcc(storage.getPaperAccount());
    window.addEventListener('focus', onFocus);
    return () => {
      unsubOrders();
      unsubForecasts();
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  useEffect(() => {
    const syms = Object.keys(paperAcc.positions);
    if (!syms.length) return;
    let alive = true;
    fetchBatchQuotes(syms.map((s) => ({ symbol: s, market: paperAcc.positions[s].market || 'NSE' })))
      .then((res) => {
        if (!alive) return;
        const m: Record<string, BatchQuote> = {};
        res.forEach((q) => {
          if (q.price > 0) m[q.symbol.toUpperCase()] = q;
        });
        setOpenQuotes(m);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [paperAcc.positions]);

  useEffect(() => {
    let alive = true;
    setResolving(true);
    resolveDuePredictions()
      .then((changed) => {
        if (alive && changed) setLog(getPredictionLog());
      })
      .finally(() => alive && setResolving(false));
    return () => {
      alive = false;
    };
  }, []);

  const tradeAccuracyRecords = useMemo(() => {
    const nowMs = Date.now();
    const eqTimestamps = deriveOpenEquityTimestamps(paperAcc.history);
    const optTimestamps = deriveOpenOptionTimestamps(optOrders);
    const optMetrics = computeOptionPaperMetrics(optOrders);

    const openEq = Object.keys(paperAcc.positions).map((sym) => {
      const p = paperAcc.positions[sym];
      const livePx =
        currentAnalysis && currentAnalysis.displaySymbol.toUpperCase() === sym.toUpperCase()
          ? currentAnalysis.latestPrice
          : openQuotes[sym.toUpperCase()]?.price ?? null;
      const pnl = livePx !== null ? (livePx - p.avgPrice) * p.quantity : 0;
      const pnlPct = livePx !== null && p.avgPrice > 0 ? ((livePx - p.avgPrice) / p.avgPrice) * 100 : 0;
      const openedAt = eqTimestamps[sym] || new Date(nowMs).toISOString();
      return {
        id: `eq-open-${sym}`,
        segment: 'Equity' as const,
        instrument: sym,
        symbol: sym,
        market: p.market,
        side: 'LONG' as const,
        qty: p.quantity,
        entryPrice: p.avgPrice,
        currentPrice: livePx,
        pnl,
        pnlPct,
        openedAt,
        durationMs: Math.max(0, nowMs - Date.parse(openedAt)),
        stopLoss: p.stopLoss,
        target: p.target,
      };
    });

    const openOpt = optMetrics.openPositions.map((p) => {
      const side: 'LONG' | 'SHORT' = p.qty > 0 ? 'LONG' : 'SHORT';
      const openedAt = optTimestamps[p.key] || new Date(nowMs).toISOString();
      return {
        id: `opt-open-${p.key}`,
        segment: 'Options' as const,
        instrument: `${p.underlying} ${p.strike.toLocaleString('en-IN')} ${p.type}`,
        symbol: p.underlying,
        side,
        qty: Math.abs(p.qty),
        entryPrice: p.avg,
        currentPrice: p.avg,
        pnl: 0,
        pnlPct: 0,
        openedAt,
        durationMs: Math.max(0, nowMs - Date.parse(openedAt)),
        stopLoss: p.stopLoss,
        target: p.target,
      };
    });

    const closed = [
      ...deriveClosedEquityTrades(paperAcc.history, paperAcc.positions),
      ...deriveClosedOptionTrades(optOrders),
    ].sort((a, b) => Date.parse(b.closedAt) - Date.parse(a.closedAt));

    return evaluateTradeAccuracy(buildTradesForAccuracy([...openEq, ...openOpt], closed), tradeForecasts, log);
  }, [paperAcc, optOrders, tradeForecasts, openQuotes, currentAnalysis, log]);

  const stats = useMemo(() => liveStats(log), [log]);
  const bt = useMemo(() => (currentAnalysis ? walkForwardBacktest(currentAnalysis, 7) : null), [currentAnalysis]);

  const exportCsv = () => {
    const head = ['Symbol', 'Market', 'Date', 'Signal', 'Price', 'Target7d', 'Low', 'High', 'Actual', 'Direction', 'ErrorPct', 'InRange'];
    const rows = log.map((p) => [
      p.symbol, p.market, p.date, p.signal, p.price, p.target, p.lo, p.hi,
      p.result?.actual ?? '', p.result?.directionCorrect ?? '', p.result ? p.result.errorPct.toFixed(2) : '', p.result?.inBand ?? '',
    ]);
    const csv = [head, ...rows].map((r) => r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'predictx-prediction-log.csv';
    a.click();
  };

  return (
    <div className="space-y-6">
      <div className={`${card} p-5`}>
        <h2 className="text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
          <Award className="w-5 h-5 text-blue-600" /> How Accurate Is the Model?
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Transparent verification using real numbers: pre-trade prediction vs actual trade outcome accuracy, historical walk-forward backtesting, and 7-day logged predictions.
        </p>
      </div>

      <TradeAccuracyPanel records={tradeAccuracyRecords} onSelectStock={onSelectStock} />

      <div className={`${card} p-5 space-y-4`}>
        <div>
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
            Walk-Forward Backtest{currentAnalysis ? `: ${currentAnalysis.displaySymbol}` : ''}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            At each historical date, the model runs using only data available up to that date and compares its 7-day forecast against the actual price 7 sessions later.
          </p>
        </div>

        {!currentAnalysis && <p className="text-sm text-slate-500">Search for a stock first to run the backtest.</p>}

        {bt && bt.samples.length < 8 && (
          <p className="text-sm text-slate-500">Not enough historical data on this stock to run a backtest.</p>
        )}

        {bt && bt.samples.length >= 8 && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Stat
                label="Direction accuracy"
                value={fmtPct(bt.directional.pct, 0)}
                note={`${bt.directional.correct} / ${bt.directional.calls} BUY/SELL calls (${bt.holdCount} HOLD excluded)`}
              />
              <Stat
                label="Always-'Up' baseline"
                value={fmtPct(bt.baselineUpPct, 0)}
                note="Benchmark: how often the stock closed higher 7 days later"
              />
              <Stat
                label="Avg target error (MAPE)"
                value={fmtPct(bt.mapePct, 2)}
                note={`Benchmark: naive "price stays flat" error ${fmtPct(bt.baselineMapePct, 2)}`}
              />
              <Stat label="Within 80% band" value={fmtPct(bt.bandHitPct, 0)} note="Actual price stayed inside the forecast band (near 80% is well-calibrated)" />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {bt.samples.length} test points from {bt.samples[0].date} to {bt.samples[bt.samples.length - 1].date}. Past performance does not guarantee future results.
              {bt.directional.pct !== null && bt.baselineUpPct !== null && (
                <>
                  {' '}
                  {bt.mapePct !== null && bt.baselineMapePct !== null && bt.mapePct > bt.baselineMapePct
                    ? 'Target error exceeded the flat-price baseline — treat the target as a rough estimate. '
                    : ''}
                  {bt.directional.pct > 50 && bt.directional.pct >= Math.max(bt.baselineUpPct, 100 - bt.baselineUpPct) + 3
                    ? 'Model outperformed a simple directional guess.'
                    : 'Model did not meaningfully beat a simple directional guess — do not rely on the signal alone.'}
                </>
              )}
            </p>
          </>
        )}
      </div>

      <div className={`${card} p-5 space-y-4`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              Your Saved Predictions {resolving && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Every time you analyze a stock, its prediction is automatically logged (once per stock per day) and scored 7 trading days later.
            </p>
          </div>
          {log.length > 0 && (
            <div className="flex gap-2">
              <button onClick={exportCsv} className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                <Download className="w-3.5 h-3.5" /> CSV
              </button>
              <button
                onClick={() => {
                  if (confirm('Delete all saved predictions?')) {
                    clearPredictionLog();
                    setLog([]);
                  }
                }}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold text-rose-600 flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" /> Clear
              </button>
            </div>
          )}
        </div>

        {log.length === 0 ? (
          <p className="text-sm text-slate-500">No predictions logged yet. Search for any stock and it will be recorded here automatically.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Stat label="Total / scored" value={`${stats.total} / ${stats.resolved}`} note={`${stats.pending} awaiting 7-day completion`} />
              <Stat
                label="Direction accuracy"
                value={stats.directionalCalls >= 5 ? fmtPct(stats.directionalPct, 0) : '—'}
                note={stats.directionalCalls >= 5 ? `${stats.directionalCorrect} / ${stats.directionalCalls} calls` : `Requires at least 5 scored BUY/SELL calls (currently ${stats.directionalCalls})`}
              />
              <Stat label="Target error" value={fmtPct(stats.mapePct, 1)} />
              <Stat label="Within range" value={fmtPct(stats.bandHitPct, 0)} />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wider text-slate-400 text-left">
                    <th className="py-2">Stock</th>
                    <th>Date</th>
                    <th>Signal</th>
                    <th>Entry Price</th>
                    <th>Target (range)</th>
                    <th>Actual (7d later)</th>
                    <th>Outcome</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-100">
                  {log.slice(0, 100).map((p) => (
                    <tr key={p.id}>
                      <td className="py-2">
                        <button
                          onClick={() => onSelectStock?.(p.symbol, p.market)}
                          className="font-bold hover:underline"
                        >
                          {p.symbol}
                        </button>
                      </td>
                      <td>{p.date}</td>
                      <td>{p.signal}</td>
                      <td>{p.currencySymbol}{p.price.toFixed(2)}</td>
                      <td>
                        {p.currencySymbol}{p.target.toFixed(2)}
                        <span className="text-xs text-slate-500"> ({p.lo.toFixed(0)}–{p.hi.toFixed(0)})</span>
                      </td>
                      <td>{p.result ? `${p.currencySymbol}${p.result.actual.toFixed(2)}` : '—'}</td>
                      <td>
                        {!p.result ? (
                          <span className="text-slate-400 text-xs">Pending</span>
                        ) : p.result.directionCorrect === null ? (
                          <span className="text-slate-500 text-xs">HOLD</span>
                        ) : p.result.directionCorrect ? (
                          <span className="text-emerald-600 font-bold text-xs">Correct</span>
                        ) : (
                          <span className="text-rose-600 font-bold text-xs">Missed</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default TrackRecordPage;
