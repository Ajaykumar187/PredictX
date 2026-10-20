import { AnalysisResult, MarketType } from '../types';
import { runFullAnalysis } from './aiEngine';
import { userKey } from './storage';
import { fetchLiveQuote } from './stockApi';

export interface BandPoint {
  day: number;
  mid: number;
  low: number;
  high: number;
}

export const BAND_LEVELS = { 68: 1.0, 80: 1.2816, 95: 1.96 } as const;
export type BandLevel = keyof typeof BAND_LEVELS;

export function dailyVolatility(closes: number[], lookback = 60): number {
  const c = closes.slice(-(lookback + 1));
  const rets: number[] = [];
  for (let i = 1; i < c.length; i++) {
    if (c[i - 1] > 0 && c[i] > 0) rets.push(Math.log(c[i] / c[i - 1]));
  }
  if (rets.length < 5) return 0.02;
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const v = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / rets.length;
  return Math.sqrt(v);
}

export function forecastBand(data: AnalysisResult, horizon: number, level: BandLevel = 80): BandPoint[] {
  const closes = data.df.map((b) => b.close);
  const sigma = dailyVolatility(closes);
  const z = BAND_LEVELS[level];
  const out: BandPoint[] = [];
  const fc = data.forecast30 || [];
  for (let d = 1; d <= Math.min(horizon, fc.length); d++) {
    const mid = fc[d - 1];
    const spread = z * sigma * Math.sqrt(d);
    out.push({
      day: d,
      mid,
      low: Number((mid * Math.exp(-spread)).toFixed(2)),
      high: Number((mid * Math.exp(spread)).toFixed(2)),
    });
  }
  return out;
}

export interface BacktestSample {
  date: string;
  price: number;
  signal: 'BUY' | 'SELL' | 'HOLD';
  target: number;
  actual: number;
  lo: number;
  hi: number;
}

export interface BacktestSummary {
  samples: BacktestSample[];
  horizon: number;
  directional: { calls: number; correct: number; pct: number | null };
  baselineUpPct: number | null;
  mapePct: number | null;
  baselineMapePct: number | null;
  bandHitPct: number | null;
  holdCount: number;
}

export function walkForwardBacktest(data: AnalysisResult, horizon = 7, step = 3, maxSamples = 60): BacktestSummary {
  const bars = data.df;
  const n = bars.length;
  const start = 60;
  const samples: BacktestSample[] = [];

  for (let i = start; i < n - horizon; i += step) {
    try {
      const past = bars.slice(0, i + 1);
      const res = runFullAnalysis(data.displaySymbol, data.market, past, undefined, past[i].close, 0, 0);
      const band = forecastBand(res, horizon, 80);
      const b = band[horizon - 1];
      samples.push({
        date: bars[i].date.slice(0, 10),
        price: bars[i].close,
        signal: res.signal,
        target: res.forecast30[horizon - 1],
        actual: bars[i + horizon].close,
        lo: b.low,
        hi: b.high,
      });
    } catch {
    }
  }
  const used = samples.slice(-maxSamples);

  const calls = used.filter((s) => s.signal !== 'HOLD');
  const correct = calls.filter((s) => (s.signal === 'BUY' ? s.actual > s.price : s.actual < s.price)).length;
  const ups = used.filter((s) => s.actual > s.price).length;
  const mape = used.length
    ? (used.reduce((a, s) => a + Math.abs(s.actual - s.target) / s.actual, 0) / used.length) * 100
    : null;
  const inBand = used.filter((s) => s.actual >= s.lo && s.actual <= s.hi).length;

  return {
    samples: used,
    horizon,
    directional: { calls: calls.length, correct, pct: calls.length ? (correct / calls.length) * 100 : null },
    baselineUpPct: used.length ? (ups / used.length) * 100 : null,
    mapePct: mape,
    baselineMapePct: used.length ? (used.reduce((a, s) => a + Math.abs(s.actual - s.price) / s.actual, 0) / used.length) * 100 : null,
    bandHitPct: used.length ? (inBand / used.length) * 100 : null,
    holdCount: used.length - calls.length,
  };
}

export interface LoggedPrediction {
  id: string;
  symbol: string;
  market: MarketType;
  date: string;
  price: number;
  signal: 'BUY' | 'SELL' | 'HOLD';
  score: number;
  horizon: number;
  target: number;
  lo: number;
  hi: number;
  currencySymbol: string;
  result?: {
    resolvedOn: string;
    actual: number;
    directionCorrect: boolean | null;
    errorPct: number;
    inBand: boolean;
  };
}

const LOG_BASE = 'predictx_prediction_log';
const HORIZON = 7;

export function getPredictionLog(): LoggedPrediction[] {
  try {
    return JSON.parse(localStorage.getItem(userKey(LOG_BASE)) || '[]');
  } catch {
    return [];
  }
}
function savePredictionLog(l: LoggedPrediction[]) {
  try {
    localStorage.setItem(userKey(LOG_BASE), JSON.stringify(l.slice(0, 500)));
  } catch {
  }
}
export function clearPredictionLog() {
  try {
    localStorage.removeItem(userKey(LOG_BASE));
  } catch {
  }
}

export function logPrediction(a: AnalysisResult) {
  const last = a.df[a.df.length - 1];
  if (!last) return;
  const date = last.date.slice(0, 10);
  const log = getPredictionLog();
  if (log.some((p) => p.symbol === a.displaySymbol && p.market === a.market && p.date === date)) return;
  const band = forecastBand(a, HORIZON, 80)[HORIZON - 1];
  if (!band) return;
  log.unshift({
    id: `${a.displaySymbol}-${a.market}-${date}`,
    symbol: a.displaySymbol,
    market: a.market,
    date,
    price: a.latestPrice,
    signal: a.signal,
    score: a.score,
    horizon: HORIZON,
    target: band.mid,
    lo: band.low,
    hi: band.high,
    currencySymbol: a.currencySymbol,
  });
  savePredictionLog(log);
}

export async function resolveDuePredictions(): Promise<boolean> {
  const log = getPredictionLog();
  const pending = log.filter((p) => !p.result);
  if (!pending.length) return false;

  const bySymbol = new Map<string, LoggedPrediction[]>();
  pending.forEach((p) => {
    const k = `${p.symbol}|${p.market}`;
    bySymbol.set(k, [...(bySymbol.get(k) || []), p]);
  });

  let changed = false;
  for (const [, preds] of bySymbol) {
    const quote = await fetchLiveQuote(preds[0].symbol, preds[0].market).catch(() => null);
    if (!quote || !quote.bars?.length) continue;
    for (const p of preds) {
      const after = quote.bars.filter((b) => b.date.slice(0, 10) > p.date);
      if (after.length < p.horizon) continue;
      const bar = after[p.horizon - 1];
      const actual = bar.close;
      p.result = {
        resolvedOn: bar.date.slice(0, 10),
        actual,
        directionCorrect: p.signal === 'HOLD' ? null : p.signal === 'BUY' ? actual > p.price : actual < p.price,
        errorPct: (Math.abs(actual - p.target) / actual) * 100,
        inBand: actual >= p.lo && actual <= p.hi,
      };
      changed = true;
    }
  }
  if (changed) savePredictionLog(log);
  return changed;
}

export interface LiveStats {
  total: number;
  resolved: number;
  pending: number;
  directionalCalls: number;
  directionalCorrect: number;
  directionalPct: number | null;
  mapePct: number | null;
  bandHitPct: number | null;
}

export function liveStats(log: LoggedPrediction[]): LiveStats {
  const res = log.filter((p) => p.result);
  const calls = res.filter((p) => p.result!.directionCorrect !== null);
  const correct = calls.filter((p) => p.result!.directionCorrect).length;
  return {
    total: log.length,
    resolved: res.length,
    pending: log.length - res.length,
    directionalCalls: calls.length,
    directionalCorrect: correct,
    directionalPct: calls.length ? (correct / calls.length) * 100 : null,
    mapePct: res.length ? res.reduce((a, p) => a + p.result!.errorPct, 0) / res.length : null,
    bandHitPct: res.length ? (res.filter((p) => p.result!.inBand).length / res.length) * 100 : null,
  };
}
