import { userKey } from './storage';
import type { MarketType, PaperAccount } from '../types';

export interface PaperOrder {
  id: string;
  time: string;
  underlying: string;
  expiry: string;
  strike: number;
  type: 'CE' | 'PE';
  action: 'BUY' | 'SELL';
  qty: number;
  price: number;
  stopLoss?: number;
  target?: number;
  exitReason?: 'SL' | 'TARGET' | 'MANUAL';
}

export interface PaperPosition {
  key: string;
  underlying: string;
  expiry: string;
  strike: number;
  type: 'CE' | 'PE';
  qty: number;
  avg: number;
  realized: number;
  stopLoss?: number;
  target?: number;
}

export interface OptionPositionRisk {
  stopLoss?: number;
  target?: number;
}

export interface OptionPaperMetrics {
  initialCash: number;
  availableCash: number;
  usedCapital: number;
  realizedPnL: number;
  unrealizedPnL: number;
  netEquity: number;
  positions: PaperPosition[];
  openPositions: PaperPosition[];
  closedPositions: PaperPosition[];
}

export interface ClosedPaperTrade {
  id: string;
  segment: 'Equity' | 'Options';
  instrument: string;
  symbol: string;
  market?: MarketType;
  subtitle: string;
  side: 'LONG' | 'SHORT';
  qty: number;
  entryPrice: number;
  exitPrice: number;
  pnl: number;
  pnlPct: number;
  openedAt: string;
  closedAt: string;
  durationMs: number;
}

export const OPTION_PAPER_INITIAL_CASH = 1000000;

const KEY_BASE = 'predictx_paper_option_orders';
const RISK_KEY_BASE = 'predictx_paper_option_risk';
const keyNow = () => userKey(KEY_BASE);
const riskKeyNow = () => userKey(RISK_KEY_BASE);
const EVT = 'predictx_paper_orders_updated';

export function getOptionRiskMap(): Record<string, OptionPositionRisk> {
  try {
    return JSON.parse(localStorage.getItem(riskKeyNow()) || '{}');
  } catch {
    return {};
  }
}

function saveOptionRiskMap(map: Record<string, OptionPositionRisk>) {
  try {
    localStorage.setItem(riskKeyNow(), JSON.stringify(map));
  } catch {
  }
}

export function setOptionPositionRisk(
  positionKey: string,
  risk: { stopLoss?: number; target?: number }
) {
  const map = getOptionRiskMap();
  const sl = risk.stopLoss && Number.isFinite(risk.stopLoss) && risk.stopLoss > 0 ? risk.stopLoss : undefined;
  const tgt = risk.target && Number.isFinite(risk.target) && risk.target > 0 ? risk.target : undefined;

  if (sl === undefined && tgt === undefined) {
    delete map[positionKey];
  } else {
    map[positionKey] = { stopLoss: sl, target: tgt };
  }
  saveOptionRiskMap(map);
  window.dispatchEvent(new Event(EVT));
}

export function checkOptionRiskTrigger(
  pos: Pick<PaperPosition, 'qty' | 'stopLoss' | 'target'>,
  liveLtp: number
): 'SL' | 'TARGET' | null {
  if (!Number.isFinite(liveLtp) || liveLtp <= 0 || pos.qty === 0) return null;
  const isLong = pos.qty > 0;
  if (isLong) {
    if (pos.stopLoss && pos.stopLoss > 0 && liveLtp <= pos.stopLoss) return 'SL';
    if (pos.target && pos.target > 0 && liveLtp >= pos.target) return 'TARGET';
  } else {
    if (pos.stopLoss && pos.stopLoss > 0 && liveLtp >= pos.stopLoss) return 'SL';
    if (pos.target && pos.target > 0 && liveLtp <= pos.target) return 'TARGET';
  }
  return null;
}

export function getOrders(): PaperOrder[] {
  try {
    return JSON.parse(localStorage.getItem(keyNow()) || '[]');
  } catch {
    return [];
  }
}

export function placeOrders(orders: Omit<PaperOrder, 'id' | 'time'>[]) {
  const all = getOrders();
  const now = new Date().toISOString();
  const riskMap = getOptionRiskMap();
  let riskChanged = false;

  orders.forEach((o, i) => {
    all.push({ ...o, id: `${Date.now()}_${i}`, time: now });
    const posKey = `${o.underlying}|${o.expiry}|${o.strike}|${o.type}`;
    if (o.stopLoss !== undefined || o.target !== undefined) {
      const existing = riskMap[posKey] || {};
      const sl = o.stopLoss && o.stopLoss > 0 ? o.stopLoss : existing.stopLoss;
      const tgt = o.target && o.target > 0 ? o.target : existing.target;
      if (sl !== undefined || tgt !== undefined) {
        riskMap[posKey] = { stopLoss: sl, target: tgt };
        riskChanged = true;
      }
    }
  });

  const sliced = all.slice(-300);
  try {
    localStorage.setItem(keyNow(), JSON.stringify(sliced));
  } catch {
  }

  // Clean up stored risk levels for any position that is now flat
  const updatedPositions = derivePositions(sliced);
  for (const p of updatedPositions) {
    if (p.qty === 0 && riskMap[p.key]) {
      delete riskMap[p.key];
      riskChanged = true;
    }
  }
  if (riskChanged) {
    saveOptionRiskMap(riskMap);
  }

  window.dispatchEvent(new Event(EVT));
}

export function clearOrders() {
  try {
    localStorage.removeItem(keyNow());
    localStorage.removeItem(riskKeyNow());
  } catch {
  }
  window.dispatchEvent(new Event(EVT));
}

export function subscribeOrders(cb: () => void) {
  window.addEventListener(EVT, cb);
  return () => window.removeEventListener(EVT, cb);
}

export function derivePositions(orders: PaperOrder[]): PaperPosition[] {
  const map = new Map<string, PaperPosition>();
  const riskMap = getOptionRiskMap();

  for (const o of orders) {
    const key = `${o.underlying}|${o.expiry}|${o.strike}|${o.type}`;
    const p = map.get(key) || {
      key,
      underlying: o.underlying,
      expiry: o.expiry,
      strike: o.strike,
      type: o.type,
      qty: 0,
      avg: 0,
      realized: 0,
    };
    const signed = o.action === 'BUY' ? o.qty : -o.qty;
    if (p.qty === 0 || Math.sign(p.qty) === Math.sign(signed)) {
      const total = Math.abs(p.qty) + o.qty;
      p.avg = (p.avg * Math.abs(p.qty) + o.price * o.qty) / total;
      p.qty += signed;
    } else {
      const closing = Math.min(Math.abs(p.qty), o.qty);
      p.realized += (p.qty > 0 ? o.price - p.avg : p.avg - o.price) * closing;
      const remaining = o.qty - closing;
      p.qty += signed;
      if (p.qty === 0) p.avg = 0;
      else if (remaining > 0) p.avg = o.price;
    }
    map.set(key, p);
  }

  return [...map.values()].map((p) => {
    if (p.qty !== 0) {
      const risk = riskMap[p.key];
      if (risk) {
        return { ...p, stopLoss: risk.stopLoss, target: risk.target };
      }
    }
    return p;
  });
}

export function computeOptionPaperMetrics(
  orders: PaperOrder[],
  ltpLookup?: (p: PaperPosition) => number | null
): OptionPaperMetrics {
  const positions = derivePositions(orders);
  const openPositions = positions.filter((p) => p.qty !== 0);
  const closedPositions = positions.filter((p) => p.qty === 0 && p.realized !== 0);

  const realizedPnL = positions.reduce((sum, p) => sum + p.realized, 0);
  let unrealizedPnL = 0;
  let usedCapital = 0;

  for (const p of openPositions) {
    usedCapital += Math.abs(p.qty) * p.avg;
    const ltp = ltpLookup ? ltpLookup(p) : null;
    if (ltp !== null && Number.isFinite(ltp)) {
      unrealizedPnL += (ltp - p.avg) * p.qty;
    }
  }

  const availableCash = OPTION_PAPER_INITIAL_CASH + realizedPnL - usedCapital;
  const netEquity = OPTION_PAPER_INITIAL_CASH + realizedPnL + unrealizedPnL;

  return {
    initialCash: OPTION_PAPER_INITIAL_CASH,
    availableCash,
    usedCapital,
    realizedPnL,
    unrealizedPnL,
    netEquity,
    positions,
    openPositions,
    closedPositions,
  };
}

function parseTimestampMs(rawIso?: string, id?: string, fallbackDate?: string): number {
  if (rawIso) {
    const t = Date.parse(rawIso);
    if (Number.isFinite(t)) return t;
  }
  if (id) {
    const m = id.match(/^tx-(\d{10,})/) || id.match(/^(\d{10,})_/);
    if (m) {
      const t = Number(m[1]);
      if (Number.isFinite(t)) return t;
    }
  }
  if (fallbackDate) {
    const t = Date.parse(fallbackDate);
    if (Number.isFinite(t)) return t;
  }
  return Date.now();
}

export function formatTradeDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  const totalSec = Math.floor(ms / 1000);
  if (totalSec < 1) return '< 1s';
  if (totalSec < 60) return `${totalSec}s`;
  const totalMin = Math.floor(totalSec / 60);
  const remSec = totalSec % 60;
  if (totalMin < 60) return remSec > 0 ? `${totalMin}m ${remSec}s` : `${totalMin}m`;
  const totalHrs = Math.floor(totalMin / 60);
  const remMin = totalMin % 60;
  if (totalHrs < 24) return remMin > 0 ? `${totalHrs}h ${remMin}m` : `${totalHrs}h`;
  const days = Math.floor(totalHrs / 24);
  const remHrs = totalHrs % 24;
  return remHrs > 0 ? `${days}d ${remHrs}h` : `${days}d`;
}

export function deriveClosedEquityTrades(
  history: PaperAccount['history'],
  positions?: PaperAccount['positions']
): ClosedPaperTrade[] {
  const chronological = [...history].reverse();
  const lotsBySymbol = new Map<string, Array<{ qty: number; price: number; openedMs: number }>>();
  const closed: ClosedPaperTrade[] = [];

  for (const tx of chronological) {
    const txMs = parseTimestampMs(tx.timestamp, tx.id, tx.date);
    const lots = lotsBySymbol.get(tx.symbol) || [];

    if (tx.type === 'BUY') {
      lots.push({ qty: tx.shares, price: tx.price, openedMs: txMs });
      lotsBySymbol.set(tx.symbol, lots);
      continue;
    }

    let remainingToClose = tx.shares;
    let matchedQty = 0;
    let costSum = 0;
    let earliestOpenMs = txMs;

    while (remainingToClose > 0 && lots.length > 0) {
      const lot = lots[0];
      const take = Math.min(lot.qty, remainingToClose);
      if (matchedQty === 0) earliestOpenMs = lot.openedMs;
      matchedQty += take;
      costSum += take * lot.price;
      lot.qty -= take;
      remainingToClose -= take;
      if (lot.qty <= 0) lots.shift();
    }

    lotsBySymbol.set(tx.symbol, lots);

    if (matchedQty > 0) {
      const entryPrice = costSum / matchedQty;
      const exitPrice = tx.price;
      const pnl = (exitPrice - entryPrice) * matchedQty;
      const pnlPct = entryPrice > 0 ? ((exitPrice - entryPrice) / entryPrice) * 100 : 0;
      const durationMs = Math.max(0, txMs - earliestOpenMs);
      const market = tx.market ?? positions?.[tx.symbol]?.market ?? 'NSE';

      closed.push({
        id: `eq-closed-${tx.id}`,
        segment: 'Equity',
        instrument: tx.symbol,
        symbol: tx.symbol,
        market,
        subtitle: `Equity · LONG`,
        side: 'LONG',
        qty: matchedQty,
        entryPrice,
        exitPrice,
        pnl,
        pnlPct,
        openedAt: new Date(earliestOpenMs).toISOString(),
        closedAt: new Date(txMs).toISOString(),
        durationMs,
      });
    }
  }

  return closed.reverse();
}

export function deriveClosedOptionTrades(orders: PaperOrder[]): ClosedPaperTrade[] {
  const lotsByContract = new Map<
    string,
    Array<{ side: 'LONG' | 'SHORT'; qty: number; price: number; openedMs: number }>
  >();
  const closed: ClosedPaperTrade[] = [];

  for (const o of orders) {
    const key = `${o.underlying}|${o.expiry}|${o.strike}|${o.type}`;
    const orderSide: 'LONG' | 'SHORT' = o.action === 'BUY' ? 'LONG' : 'SHORT';
    const orderMs = parseTimestampMs(o.time, o.id);
    const lots = lotsByContract.get(key) || [];

    if (lots.length === 0 || lots[0].side === orderSide) {
      lots.push({ side: orderSide, qty: o.qty, price: o.price, openedMs: orderMs });
      lotsByContract.set(key, lots);
      continue;
    }

    let remaining = o.qty;
    let matchedQty = 0;
    let entrySum = 0;
    let earliestOpenMs = orderMs;
    const closedSide = lots[0].side;

    while (remaining > 0 && lots.length > 0 && lots[0].side === closedSide) {
      const lot = lots[0];
      const take = Math.min(lot.qty, remaining);
      if (matchedQty === 0) earliestOpenMs = lot.openedMs;
      matchedQty += take;
      entrySum += take * lot.price;
      lot.qty -= take;
      remaining -= take;
      if (lot.qty <= 0) lots.shift();
    }

    if (matchedQty > 0) {
      const entryPrice = entrySum / matchedQty;
      const exitPrice = o.price;
      const pnl =
        closedSide === 'LONG'
          ? (exitPrice - entryPrice) * matchedQty
          : (entryPrice - exitPrice) * matchedQty;
      const notional = entryPrice * matchedQty;
      const pnlPct = notional > 0 ? (pnl / notional) * 100 : 0;
      const durationMs = Math.max(0, orderMs - earliestOpenMs);
      const instrument = `${o.underlying} ${o.strike.toLocaleString('en-IN')} ${o.type}`;
      const expiryText = o.expiry ? ` · ${o.expiry}` : '';

      closed.push({
        id: `opt-closed-${o.id}`,
        segment: 'Options',
        instrument,
        symbol: o.underlying,
        subtitle: `Options · ${closedSide}${expiryText}`,
        side: closedSide,
        qty: matchedQty,
        entryPrice,
        exitPrice,
        pnl,
        pnlPct,
        openedAt: new Date(earliestOpenMs).toISOString(),
        closedAt: new Date(orderMs).toISOString(),
        durationMs,
      });
    }

    if (remaining > 0) {
      lots.push({ side: orderSide, qty: remaining, price: o.price, openedMs: orderMs });
    }

    lotsByContract.set(key, lots);
  }

  return closed.reverse();
}

export function deriveOpenEquityTimestamps(history: PaperAccount['history']): Record<string, string> {
  const chronological = [...history].reverse();
  const lotsBySymbol = new Map<string, Array<{ qty: number; openedMs: number }>>();

  for (const tx of chronological) {
    const txMs = parseTimestampMs(tx.timestamp, tx.id, tx.date);
    const lots = lotsBySymbol.get(tx.symbol) || [];
    if (tx.type === 'BUY') {
      lots.push({ qty: tx.shares, openedMs: txMs });
    } else {
      let rem = tx.shares;
      while (rem > 0 && lots.length > 0) {
        const take = Math.min(lots[0].qty, rem);
        lots[0].qty -= take;
        rem -= take;
        if (lots[0].qty <= 0) lots.shift();
      }
    }
    lotsBySymbol.set(tx.symbol, lots);
  }

  const out: Record<string, string> = {};
  lotsBySymbol.forEach((lots, sym) => {
    if (lots.length > 0) {
      out[sym] = new Date(lots[0].openedMs).toISOString();
    }
  });
  return out;
}

export function deriveOpenOptionTimestamps(orders: PaperOrder[]): Record<string, string> {
  const lotsByKey = new Map<string, Array<{ side: 'LONG' | 'SHORT'; qty: number; openedMs: number }>>();

  for (const o of orders) {
    const key = `${o.underlying}|${o.expiry}|${o.strike}|${o.type}`;
    const orderSide: 'LONG' | 'SHORT' = o.action === 'BUY' ? 'LONG' : 'SHORT';
    const orderMs = parseTimestampMs(o.time, o.id);
    const lots = lotsByKey.get(key) || [];

    if (lots.length === 0 || lots[0].side === orderSide) {
      lots.push({ side: orderSide, qty: o.qty, openedMs: orderMs });
    } else {
      let rem = o.qty;
      const openSide = lots[0].side;
      while (rem > 0 && lots.length > 0 && lots[0].side === openSide) {
        const take = Math.min(lots[0].qty, rem);
        lots[0].qty -= take;
        rem -= take;
        if (lots[0].qty <= 0) lots.shift();
      }
      if (rem > 0) {
        lots.push({ side: orderSide, qty: rem, openedMs: orderMs });
      }
    }
    lotsByKey.set(key, lots);
  }

  const out: Record<string, string> = {};
  lotsByKey.forEach((lots, key) => {
    if (lots.length > 0) {
      out[key] = new Date(lots[0].openedMs).toISOString();
    }
  });
  return out;
}
