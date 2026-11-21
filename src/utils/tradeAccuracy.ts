import type { MarketType } from '../types';
import { userKey } from './storage';
import { getPredictionLog } from './accuracy';
import type { LoggedPrediction } from './accuracy';
import type { ClosedPaperTrade } from './paperTrades';

export type PreTradeSignal =
  | 'BUY'
  | 'SELL'
  | 'HOLD'
  | 'BUY CALL'
  | 'BUY PUT'
  | 'WATCH'
  | 'NO TRADE';

export type PredictedDirection = 'UP' | 'DOWN' | 'FLAT';

export interface PreTradeForecast {
  id: string;
  segment: 'Equity' | 'Options';
  instrument: string;
  symbol: string;
  market?: MarketType;
  tradeSide: 'LONG' | 'SHORT';
  entryPrice: number;
  openedAt: string;
  predictedSignal: PreTradeSignal;
  predictedDirection: PredictedDirection;
  predictedTarget?: number;
  predictedMovePct?: number;
  confidence?: number;
  score?: number;
  rsiAtEntry?: number;
  userStopLoss?: number;
  userTarget?: number;
  summary: string;
  reasons?: string[];
  source: 'pre-trade-model' | 'prediction-log' | 'option-signal' | 'trade-plan';
}

export type OrderPreTradeSnapshot = Omit<
  PreTradeForecast,
  'id' | 'tradeSide' | 'entryPrice' | 'openedAt' | 'userStopLoss' | 'userTarget'
>;

export interface TradeLikeForAccuracy {
  id: string;
  status: 'OPEN' | 'CLOSED';
  segment: 'Equity' | 'Options';
  instrument: string;
  symbol: string;
  market?: MarketType;
  side: 'LONG' | 'SHORT';
  qty: number;
  entryPrice: number;
  actualPrice: number | null;
  pnl: number;
  pnlPct: number;
  openedAt: string;
  closedAt?: string;
  durationMs: number;
  stopLoss?: number;
  target?: number;
}

export type AccuracyVerdict = 'ACCURATE' | 'MISSED' | 'NEUTRAL' | 'UNTRACKED';
export type TradeAlignment = 'FOLLOWED' | 'CONTRARIAN' | 'NEUTRAL';

export interface TradeAccuracyRecord {
  trade: TradeLikeForAccuracy;
  forecast: PreTradeForecast | null;
  actualMovePct: number | null;
  verdict: AccuracyVerdict;
  alignment: TradeAlignment;
  targetHit: boolean | null;
  stopHit: boolean | null;
  targetClosenessPct: number | null;
  whatHappened: string;
}

export interface TradeAccuracySummary {
  totalTrades: number;
  trackedCount: number;
  directionalCalls: number;
  accurateCount: number;
  missedCount: number;
  neutralCount: number;
  accuracyRatePct: number | null;
  followedCount: number;
  followedWins: number;
  followedWinRatePct: number | null;
  followedPnL: number;
  contrarianCount: number;
  contrarianWins: number;
  contrarianWinRatePct: number | null;
  contrarianPnL: number;
  targetTrackedCount: number;
  targetHitCount: number;
  targetHitRatePct: number | null;
  avgExpectedMovePct: number | null;
  avgActualMovePct: number | null;
}

const FORECAST_KEY_BASE = 'predictx_trade_forecasts';
const FORECAST_EVENT = 'predictx_trade_forecasts_updated';
const keyNow = () => userKey(FORECAST_KEY_BASE);

export function getTradeForecasts(): PreTradeForecast[] {
  try {
    const raw = localStorage.getItem(keyNow());
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveTradeForecast(input: Omit<PreTradeForecast, 'id'>): PreTradeForecast {
  const all = getTradeForecasts();
  const entry: PreTradeForecast = {
    ...input,
    id: `tf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  };
  const next = [entry, ...all].slice(0, 300);
  try {
    localStorage.setItem(keyNow(), JSON.stringify(next));
  } catch {
    // ignore storage quota errors
  }
  window.dispatchEvent(new Event(FORECAST_EVENT));
  return entry;
}

export function clearTradeForecasts(segment?: 'Equity' | 'Options'): void {
  try {
    if (!segment) {
      localStorage.removeItem(keyNow());
    } else {
      const kept = getTradeForecasts().filter((f) => f.segment !== segment);
      localStorage.setItem(keyNow(), JSON.stringify(kept));
    }
  } catch {
    // ignore
  }
  window.dispatchEvent(new Event(FORECAST_EVENT));
}

export function subscribeTradeForecasts(cb: () => void): () => void {
  window.addEventListener(FORECAST_EVENT, cb);
  return () => window.removeEventListener(FORECAST_EVENT, cb);
}

export function directionFromSignal(signal: PreTradeSignal): PredictedDirection {
  if (signal === 'BUY' || signal === 'BUY CALL') return 'UP';
  if (signal === 'SELL' || signal === 'BUY PUT') return 'DOWN';
  return 'FLAT';
}

export function alignmentOf(
  tradeSide: 'LONG' | 'SHORT',
  segment: 'Equity' | 'Options',
  instrument: string,
  forecast: PreTradeForecast | null
): TradeAlignment {
  if (!forecast || forecast.predictedDirection === 'FLAT') return 'NEUTRAL';

  if (segment === 'Options') {
    const isPut = /\bPE\b/i.test(instrument);
    const tradeBullish = (tradeSide === 'LONG' && !isPut) || (tradeSide === 'SHORT' && isPut);
    if (forecast.predictedDirection === 'UP') return tradeBullish ? 'FOLLOWED' : 'CONTRARIAN';
    return !tradeBullish ? 'FOLLOWED' : 'CONTRARIAN';
  }

  if (forecast.predictedDirection === 'UP') {
    return tradeSide === 'LONG' ? 'FOLLOWED' : 'CONTRARIAN';
  }
  return tradeSide === 'SHORT' ? 'FOLLOWED' : 'CONTRARIAN';
}

function findMatchingForecast(
  trade: TradeLikeForAccuracy,
  forecasts: PreTradeForecast[],
  predLog: LoggedPrediction[]
): PreTradeForecast | null {
  const openMs = Date.parse(trade.openedAt);
  const symUpper = trade.symbol.toUpperCase();
  const instUpper = trade.instrument.toUpperCase();

  let best: PreTradeForecast | null = null;
  let bestDelta = Infinity;
  for (const f of forecasts) {
    if (f.segment !== trade.segment) continue;
    const sameInstrument = f.instrument.toUpperCase() === instUpper;
    const sameSymbol = f.symbol.toUpperCase() === symUpper;
    if (!sameInstrument && !sameSymbol) continue;

    const fMs = Date.parse(f.openedAt);
    const delta = Number.isFinite(openMs) && Number.isFinite(fMs) ? Math.abs(openMs - fMs) : 0;
    if (delta <= 7 * 24 * 60 * 60 * 1000) {
      const penalty = sameInstrument ? 0 : 12 * 60 * 60 * 1000;
      if (delta + penalty < bestDelta) {
        bestDelta = delta + penalty;
        best = f;
      }
    }
  }
  if (best) return best;

  if (trade.segment === 'Equity') {
    const tradeDate = trade.openedAt.slice(0, 10);
    const matchedLog = predLog.find(
      (p) => p.symbol.toUpperCase() === symUpper && p.date <= tradeDate
    );
    if (matchedLog) {
      const movePct =
        matchedLog.price > 0
          ? Number((((matchedLog.target - matchedLog.price) / matchedLog.price) * 100).toFixed(2))
          : undefined;
      return {
        id: `log-${matchedLog.id}`,
        segment: 'Equity',
        instrument: trade.instrument,
        symbol: matchedLog.symbol,
        market: matchedLog.market,
        tradeSide: trade.side,
        entryPrice: trade.entryPrice,
        openedAt: `${matchedLog.date}T09:15:00.000Z`,
        predictedSignal: matchedLog.signal,
        predictedDirection: directionFromSignal(matchedLog.signal),
        predictedTarget: matchedLog.target,
        predictedMovePct: movePct,
        summary: `Logged ${matchedLog.signal} call on ${matchedLog.date} targeting ${matchedLog.currencySymbol}${matchedLog.target.toFixed(2)}`,
        source: 'prediction-log',
      };
    }
  }

  if (trade.target || trade.stopLoss) {
    const expectedDir: PredictedDirection = trade.side === 'LONG' ? 'UP' : 'DOWN';
    const expectedMovePct =
      trade.target && trade.entryPrice > 0
        ? Number((((trade.target - trade.entryPrice) / trade.entryPrice) * 100).toFixed(2))
        : undefined;
    return {
      id: `plan-${trade.id}`,
      segment: trade.segment,
      instrument: trade.instrument,
      symbol: trade.symbol,
      market: trade.market,
      tradeSide: trade.side,
      entryPrice: trade.entryPrice,
      openedAt: trade.openedAt,
      predictedSignal: trade.side === 'LONG' ? 'BUY' : 'SELL',
      predictedDirection: expectedDir,
      predictedTarget: trade.target,
      predictedMovePct: expectedMovePct,
      userStopLoss: trade.stopLoss,
      userTarget: trade.target,
      summary: `Pre-trade ${trade.side} plan${trade.target ? ` targeting ₹${trade.target.toFixed(2)}` : ''}${trade.stopLoss ? ` · SL ₹${trade.stopLoss.toFixed(2)}` : ''}`,
      source: 'trade-plan',
    };
  }

  return null;
}

export function evaluateTradeAccuracy(
  trades: TradeLikeForAccuracy[],
  forecasts: PreTradeForecast[] = getTradeForecasts(),
  predLog: LoggedPrediction[] = getPredictionLog()
): TradeAccuracyRecord[] {
  return trades.map((trade) => {
    const forecast = findMatchingForecast(trade, forecasts, predLog);
    const actualMovePct =
      trade.actualPrice !== null && trade.entryPrice > 0
        ? Number((((trade.actualPrice - trade.entryPrice) / trade.entryPrice) * 100).toFixed(2))
        : null;

    if (!forecast) {
      return {
        trade,
        forecast: null,
        actualMovePct,
        verdict: 'UNTRACKED',
        alignment: 'NEUTRAL',
        targetHit: null,
        stopHit: null,
        targetClosenessPct: null,
        whatHappened:
          actualMovePct !== null
            ? `No pre-trade forecast recorded · Price moved ${actualMovePct >= 0 ? '+' : ''}${actualMovePct.toFixed(2)}%`
            : 'No pre-trade forecast recorded for this trade.',
      };
    }

    const alignment = alignmentOf(trade.side, trade.segment, trade.instrument, forecast);

    // Determine effective target & SL (prefer explicit user target/SL, fallback to model target)
    const refTarget = forecast.userTarget ?? trade.target ?? forecast.predictedTarget;
    const refStop = forecast.userStopLoss ?? trade.stopLoss;

    let targetHit: boolean | null = null;
    if (refTarget && trade.actualPrice !== null) {
      if (trade.segment === 'Options') {
        targetHit =
          trade.side === 'LONG' ? trade.actualPrice >= refTarget : trade.actualPrice <= refTarget;
      } else {
        targetHit =
          forecast.predictedDirection === 'DOWN'
            ? trade.actualPrice <= refTarget
            : trade.actualPrice >= refTarget;
      }
    }

    let stopHit: boolean | null = null;
    if (refStop && trade.actualPrice !== null) {
      stopHit =
        trade.side === 'LONG' ? trade.actualPrice <= refStop : trade.actualPrice >= refStop;
    }

    let targetClosenessPct: number | null = null;
    if (refTarget && trade.actualPrice !== null && trade.entryPrice > 0) {
      const errPct = (Math.abs(trade.actualPrice - refTarget) / trade.entryPrice) * 100;
      targetClosenessPct = Number(Math.max(0, Math.min(100, 100 - errPct * 5)).toFixed(0));
    }

    let verdict: AccuracyVerdict = 'NEUTRAL';
    if (actualMovePct !== null) {
      if (forecast.predictedDirection === 'FLAT') {
        verdict = 'NEUTRAL';
      } else if (trade.segment === 'Options') {
        // For options trades, grade by option trade P&L direction when aligned with the call
        const callProfitSign = alignment === 'CONTRARIAN' ? -trade.pnlPct : trade.pnlPct;
        if (callProfitSign >= 0.05) verdict = 'ACCURATE';
        else if (callProfitSign <= -0.05) verdict = 'MISSED';
        else verdict = 'NEUTRAL';
      } else if (forecast.predictedDirection === 'UP') {
        if (actualMovePct >= 0.05) verdict = 'ACCURATE';
        else if (actualMovePct <= -0.05) verdict = 'MISSED';
        else verdict = 'NEUTRAL';
      } else if (forecast.predictedDirection === 'DOWN') {
        if (actualMovePct <= -0.05) verdict = 'ACCURATE';
        else if (actualMovePct >= 0.05) verdict = 'MISSED';
        else verdict = 'NEUTRAL';
      }
    }

    const moveText =
      actualMovePct !== null
        ? `${actualMovePct >= 0 ? '+' : ''}${actualMovePct.toFixed(2)}%`
        : 'awaiting price';
    const expectedText =
      typeof forecast.predictedMovePct === 'number'
        ? ` (${forecast.predictedMovePct >= 0 ? '+' : ''}${forecast.predictedMovePct.toFixed(1)}% exp.)`
        : '';
    const outcomeTag = targetHit
      ? ' · Target hit'
      : stopHit
        ? ' · Stop loss hit'
        : verdict === 'ACCURATE'
          ? ' · Direction matched'
          : verdict === 'MISSED'
            ? ' · Moved opposite'
            : '';

    const whatHappened = `Called ${forecast.predictedSignal}${expectedText} · Actually moved ${moveText}${outcomeTag}`;

    return {
      trade,
      forecast,
      actualMovePct,
      verdict,
      alignment,
      targetHit,
      stopHit,
      targetClosenessPct,
      whatHappened,
    };
  });
}

export function computeTradeAccuracySummary(records: TradeAccuracyRecord[]): TradeAccuracySummary {
  let trackedCount = 0;
  let directionalCalls = 0;
  let accurateCount = 0;
  let missedCount = 0;
  let neutralCount = 0;

  let followedCount = 0;
  let followedWins = 0;
  let followedPnL = 0;
  let contrarianCount = 0;
  let contrarianWins = 0;
  let contrarianPnL = 0;

  let targetTrackedCount = 0;
  let targetHitCount = 0;
  const expectedMoves: number[] = [];
  const actualMoves: number[] = [];

  for (const r of records) {
    if (r.forecast) {
      trackedCount += 1;
      if (r.verdict === 'ACCURATE') {
        accurateCount += 1;
        directionalCalls += 1;
      } else if (r.verdict === 'MISSED') {
        missedCount += 1;
        directionalCalls += 1;
      } else if (r.verdict === 'NEUTRAL') {
        neutralCount += 1;
      }

      if (r.alignment === 'FOLLOWED') {
        followedCount += 1;
        if (r.trade.pnl > 0) followedWins += 1;
        followedPnL += r.trade.pnl;
      } else if (r.alignment === 'CONTRARIAN') {
        contrarianCount += 1;
        if (r.trade.pnl > 0) contrarianWins += 1;
        contrarianPnL += r.trade.pnl;
      }

      if (r.targetHit !== null) {
        targetTrackedCount += 1;
        if (r.targetHit) targetHitCount += 1;
      }

      if (typeof r.forecast.predictedMovePct === 'number') {
        expectedMoves.push(r.forecast.predictedMovePct);
      }
      if (typeof r.actualMovePct === 'number') {
        actualMoves.push(r.actualMovePct);
      }
    }
  }

  return {
    totalTrades: records.length,
    trackedCount,
    directionalCalls,
    accurateCount,
    missedCount,
    neutralCount,
    accuracyRatePct:
      directionalCalls > 0 ? Number(((accurateCount / directionalCalls) * 100).toFixed(1)) : null,
    followedCount,
    followedWins,
    followedWinRatePct:
      followedCount > 0 ? Number(((followedWins / followedCount) * 100).toFixed(1)) : null,
    followedPnL,
    contrarianCount,
    contrarianWins,
    contrarianWinRatePct:
      contrarianCount > 0 ? Number(((contrarianWins / contrarianCount) * 100).toFixed(1)) : null,
    contrarianPnL,
    targetTrackedCount,
    targetHitCount,
    targetHitRatePct:
      targetTrackedCount > 0
        ? Number(((targetHitCount / targetTrackedCount) * 100).toFixed(1))
        : null,
    avgExpectedMovePct:
      expectedMoves.length > 0
        ? Number((expectedMoves.reduce((a, b) => a + b, 0) / expectedMoves.length).toFixed(2))
        : null,
    avgActualMovePct:
      actualMoves.length > 0
        ? Number((actualMoves.reduce((a, b) => a + b, 0) / actualMoves.length).toFixed(2))
        : null,
  };
}

export function buildTradesForAccuracy(
  openTrades: Array<{
    id: string;
    segment: 'Equity' | 'Options';
    instrument: string;
    symbol: string;
    market?: MarketType;
    side: 'LONG' | 'SHORT';
    qty: number;
    entryPrice: number;
    currentPrice: number | null;
    pnl: number;
    pnlPct: number;
    openedAt: string;
    durationMs: number;
    stopLoss?: number;
    target?: number;
  }>,
  closedTrades: ClosedPaperTrade[]
): TradeLikeForAccuracy[] {
  const openMapped: TradeLikeForAccuracy[] = openTrades.map((o) => ({
    id: o.id,
    status: 'OPEN',
    segment: o.segment,
    instrument: o.instrument,
    symbol: o.symbol,
    market: o.market,
    side: o.side,
    qty: o.qty,
    entryPrice: o.entryPrice,
    actualPrice: o.currentPrice,
    pnl: o.pnl,
    pnlPct: o.pnlPct,
    openedAt: o.openedAt,
    durationMs: o.durationMs,
    stopLoss: o.stopLoss,
    target: o.target,
  }));

  const closedMapped: TradeLikeForAccuracy[] = closedTrades.map((c) => ({
    id: c.id,
    status: 'CLOSED',
    segment: c.segment,
    instrument: c.instrument,
    symbol: c.symbol,
    market: c.market,
    side: c.side,
    qty: c.qty,
    entryPrice: c.entryPrice,
    actualPrice: c.exitPrice,
    pnl: c.pnl,
    pnlPct: c.pnlPct,
    openedAt: c.openedAt,
    closedAt: c.closedAt,
    durationMs: c.durationMs,
  }));

  return [...openMapped, ...closedMapped];
}
