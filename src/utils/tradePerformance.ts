import type { MarketType } from '../types';

export interface SessionPerformanceTrade {
  id: string;
  instrument: string;
  symbol: string;
  market?: MarketType;
  segment?: string;
  side: 'LONG' | 'SHORT';
  status: 'OPEN' | 'CLOSED';
  pnl: number;
  pnlPct: number;
  openedAt: string;
  closedAt?: string;
  currencySymbol?: string;
}

export interface TradePerformanceMetrics {
  totalLogged: number;
  closedCount: number;
  openCount: number;
  evaluatedCount: number;
  wins: number;
  losses: number;
  breakevens: number;
  decidedCount: number;
  winRatePct: number | null;
  lossRatePct: number | null;
  grossProfit: number;
  grossLoss: number;
  netPnL: number;
  avgPnL: number | null;
  avgGain: number | null;
  avgGainPct: number | null;
  avgLoss: number | null;
  avgLossPct: number | null;
  payoffRatio: number | null;
  profitFactor: number | null;
  expectancy: number | null;
  bestTrade: SessionPerformanceTrade | null;
  worstTrade: SessionPerformanceTrade | null;
  openUnrealizedPnL: number;
  evaluatedTrades: SessionPerformanceTrade[];
}

const SESSION_STARTED_KEY = 'predictx_trade_session_started_at';
const SESSION_EVENT = 'predictx_trade_session_updated';

let fallbackSessionStartedAt = Date.now();

export function getTradeSessionStartedAt(): number {
  try {
    const raw = sessionStorage.getItem(SESSION_STARTED_KEY);
    if (raw) {
      const parsed = Number(raw);
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }
    const now = Date.now();
    sessionStorage.setItem(SESSION_STARTED_KEY, String(now));
    fallbackSessionStartedAt = now;
    return now;
  } catch {
    return fallbackSessionStartedAt;
  }
}

export function resetTradeSession(): number {
  const now = Date.now();
  fallbackSessionStartedAt = now;
  try {
    sessionStorage.setItem(SESSION_STARTED_KEY, String(now));
  } catch {
    // Ignore storage quota or private mode restrictions
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(SESSION_EVENT));
  }
  return now;
}

export function subscribeTradeSession(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(SESSION_EVENT, cb);
  return () => window.removeEventListener(SESSION_EVENT, cb);
}

// Initialize session start timestamp as soon as the app loads this module
if (typeof window !== 'undefined') {
  getTradeSessionStartedAt();
}

function parseTimeMs(iso?: string): number {
  if (!iso) return NaN;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : NaN;
}

export function filterTradesForSession(
  trades: SessionPerformanceTrade[],
  sessionStartedAt: number
): SessionPerformanceTrade[] {
  return trades.filter((t) => {
    const openedMs = parseTimeMs(t.openedAt);
    const closedMs = parseTimeMs(t.closedAt);
    return (
      (Number.isFinite(openedMs) && openedMs >= sessionStartedAt) ||
      (Number.isFinite(closedMs) && closedMs >= sessionStartedAt)
    );
  });
}

export function computeTradePerformance(
  trades: SessionPerformanceTrade[],
  options?: { includeOpen?: boolean }
): TradePerformanceMetrics {
  const includeOpen = Boolean(options?.includeOpen);
  const closedTrades = trades.filter((t) => t.status === 'CLOSED');
  const openTrades = trades.filter((t) => t.status === 'OPEN');

  const evaluatedTrades = (includeOpen ? trades : closedTrades)
    .slice()
    .sort((a, b) => {
      const ta = parseTimeMs(a.closedAt) || parseTimeMs(a.openedAt) || 0;
      const tb = parseTimeMs(b.closedAt) || parseTimeMs(b.openedAt) || 0;
      return ta - tb;
    });

  let wins = 0;
  let losses = 0;
  let breakevens = 0;
  let grossProfit = 0;
  let grossLoss = 0;
  let winPctSum = 0;
  let lossPctSum = 0;
  let netPnL = 0;
  let bestTrade: SessionPerformanceTrade | null = null;
  let worstTrade: SessionPerformanceTrade | null = null;

  for (const t of evaluatedTrades) {
    const pnl = Number.isFinite(t.pnl) ? t.pnl : 0;
    const pnlPct = Number.isFinite(t.pnlPct) ? t.pnlPct : 0;
    netPnL += pnl;

    if (pnl > 0) {
      wins += 1;
      grossProfit += pnl;
      winPctSum += pnlPct;
      if (!bestTrade || pnl > bestTrade.pnl) {
        bestTrade = t;
      }
    } else if (pnl < 0) {
      losses += 1;
      grossLoss += Math.abs(pnl);
      lossPctSum += pnlPct;
      if (!worstTrade || pnl < worstTrade.pnl) {
        worstTrade = t;
      }
    } else {
      breakevens += 1;
    }
  }

  const openUnrealizedPnL = openTrades.reduce(
    (sum, t) => sum + (Number.isFinite(t.pnl) ? t.pnl : 0),
    0
  );

  const decidedCount = wins + losses;
  const winRatePct = decidedCount > 0 ? (wins / decidedCount) * 100 : null;
  const lossRatePct = decidedCount > 0 ? (losses / decidedCount) * 100 : null;

  const avgPnL = evaluatedTrades.length > 0 ? netPnL / evaluatedTrades.length : null;
  const avgGain = wins > 0 ? grossProfit / wins : null;
  const avgGainPct = wins > 0 ? winPctSum / wins : null;
  const avgLoss = losses > 0 ? -(grossLoss / losses) : null;
  const avgLossPct = losses > 0 ? lossPctSum / losses : null;

  const payoffRatio =
    avgGain !== null && avgLoss !== null && Math.abs(avgLoss) > 0
      ? avgGain / Math.abs(avgLoss)
      : null;

  const profitFactor =
    grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : null;

  const expectancy =
    winRatePct !== null
      ? (winRatePct / 100) * (avgGain ?? 0) + (1 - winRatePct / 100) * (avgLoss ?? 0)
      : null;

  return {
    totalLogged: trades.length,
    closedCount: closedTrades.length,
    openCount: openTrades.length,
    evaluatedCount: evaluatedTrades.length,
    wins,
    losses,
    breakevens,
    decidedCount,
    winRatePct,
    lossRatePct,
    grossProfit,
    grossLoss,
    netPnL,
    avgPnL,
    avgGain,
    avgGainPct,
    avgLoss,
    avgLossPct,
    payoffRatio,
    profitFactor,
    expectancy,
    bestTrade,
    worstTrade,
    openUnrealizedPnL,
    evaluatedTrades,
  };
}
