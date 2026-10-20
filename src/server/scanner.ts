type Mkt = 'NSE' | 'US';
interface Bar { date: string; open: number; high: number; low: number; close: number; volume: number }

export const SCAN_UNIVERSE: Array<{ symbol: string; market: Mkt }> = [
  ...[
    'RELIANCE', 'TCS', 'HDFCBANK', 'ICICIBANK', 'INFY', 'SBIN', 'BHARTIARTL', 'ITC', 'LT', 'KOTAKBANK',
    'AXISBANK', 'HINDUNILVR', 'BAJFINANCE', 'MARUTI', 'SUNPHARMA', 'TATASTEEL', 'NTPC', 'POWERGRID', 'ONGC', 'COALINDIA',
    'ULTRACEMCO', 'ASIANPAINT', 'TITAN', 'WIPRO', 'HCLTECH', 'TECHM', 'M&M', 'ADANIENT', 'ADANIPORTS', 'JSWSTEEL',
    'BAJAJFINSV', 'NESTLEIND', 'DRREDDY', 'CIPLA', 'HINDALCO', 'GRASIM', 'EICHERMOT', 'BPCL', 'IOC', 'HAL',
    'BEL', 'IRFC', 'TATAPOWER', 'SUZLON', 'ETERNAL', 'TMPV',
  ].map((symbol) => ({ symbol, market: 'NSE' as Mkt })),
  ...['NVDA', 'AAPL', 'MSFT', 'TSLA', 'AMZN', 'META', 'GOOGL', 'AMD', 'NFLX', 'AVGO'].map((symbol) => ({ symbol, market: 'US' as Mkt })),
];

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

async function yahooBars(ticker: string): Promise<Bar[]> {
  const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=2y&interval=1d`, {
    headers: { 'User-Agent': UA, Accept: '*/*' },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Yahoo ${res.status}`);
  const r = (await res.json())?.chart?.result?.[0];
  const ts: number[] = r?.timestamp || [];
  const q = r?.indicators?.quote?.[0] || {};
  const bars: Bar[] = [];
  for (let i = 0; i < ts.length; i++) {
    const c = q.close?.[i];
    if (c == null || isNaN(c)) continue;
    bars.push({
      date: new Date(ts[i] * 1000).toISOString().slice(0, 10),
      open: q.open?.[i] ?? c, high: q.high?.[i] ?? c, low: q.low?.[i] ?? c, close: c, volume: q.volume?.[i] ?? 0,
    });
  }
  return bars;
}

const sma = (a: number[], n: number, end = a.length) => (end >= n ? a.slice(end - n, end).reduce((x, y) => x + y, 0) / n : null);
function rsi14(c: number[]): number | null {
  if (c.length < 15) return null;
  let g = 0, l = 0;
  for (let i = 1; i <= 14; i++) { const d = c[i] - c[i - 1]; d >= 0 ? (g += d) : (l -= d); }
  g /= 14; l /= 14;
  for (let i = 15; i < c.length; i++) {
    const d = c[i] - c[i - 1];
    g = (g * 13 + Math.max(d, 0)) / 14;
    l = (l * 13 + Math.max(-d, 0)) / 14;
  }
  return l === 0 ? 100 : 100 - 100 / (1 + g / l);
}
const r2 = (n: number) => Math.round(n * 100) / 100;

function analyse(symbol: string, market: Mkt, bars: Bar[]) {
  if (bars.length < 30) return null;
  const closes = bars.map((b) => b.close);
  const n = bars.length;
  const last = bars[n - 1];
  const prev = bars[n - 2];
  const out: any = { symbol, market, price: r2(last.close), asOf: last.date };

  const hi = (k: number) => Math.max(...bars.slice(n - 1 - k, n - 1).map((b) => b.high));
  const prior20 = hi(20);
  const avgVol20 = bars.slice(n - 21, n - 1).reduce((s, b) => s + b.volume, 0) / 20;
  if (last.close > prior20) {
    const broke50 = n > 51 && last.close > hi(50);
    out.breakout = {
      prevHigh: r2(prior20),
      volumeSpike: avgVol20 > 0 ? r2(last.volume / avgVol20) : null,
      status: broke50 ? 'Broke 50-day High' : 'Broke 20-day High',
    };
  }

  const gapPct = prev.close > 0 ? ((last.open - prev.close) / prev.close) * 100 : 0;
  if (Math.abs(gapPct) >= 0.5) {
    out.gap = { open: r2(last.open), prevClose: r2(prev.close), gapPct: r2(gapPct), type: gapPct > 0 ? 'GAP UP' : 'GAP DOWN' };
  }

  const roc: Record<string, number> = {};
  for (const k of [5, 10, 15, 20, 25, 30]) if (n > k) roc[k] = r2(((last.close - closes[n - 1 - k]) / closes[n - 1 - k]) * 100);
  out.momentum = { roc, rsi: rsi14(closes) !== null ? r2(rsi14(closes)!) : null };

  const s50 = sma(closes, 50), s200 = sma(closes, 200);
  if (s50 !== null && s200 !== null) {
    let event: string | null = null;
    for (let k = 1; k <= 10 && !event; k++) {
      const a = sma(closes, 50, n - k), b = sma(closes, 200, n - k);
      const a0 = sma(closes, 50, n - k - 1), b0 = sma(closes, 200, n - k - 1);
      if (a !== null && b !== null && a0 !== null && b0 !== null && a0 <= b0 && a > b) event = 'Golden Cross (SMA50 > SMA200)';
    }
    if (!event && s50 > s200) {
      if (Math.abs(last.close - s50) / s50 <= 0.02) event = 'Pullback to SMA50';
      else if (last.close > s50) event = 'Uptrend Confirmation';
    }
    if (event) out.swing = { sma50: r2(s50), sma200: r2(s200), event };
  }
  return out;
}

export interface ScanState {
  status: 'idle' | 'running' | 'done';
  done: number; total: number; failed: string[];
  startedAt: number; finishedAt: number;
  rows: any[];
}
const state: ScanState = { status: 'idle', done: 0, total: SCAN_UNIVERSE.length, failed: [], startedAt: 0, finishedAt: 0, rows: [] };
const FRESH_MS = 10 * 60 * 1000;

export function getScanState() { return state; }

export function ensureScan(angel: any | null) {
  if (state.status === 'running') return;
  if (state.status === 'done' && Date.now() - state.finishedAt < FRESH_MS) return;
  state.status = 'running'; state.done = 0; state.failed = []; state.startedAt = Date.now();
  const rows: any[] = [];
  const useAngel = !!(angel && angel.angelConfigured());

  (async () => {
    const queue = [...SCAN_UNIVERSE];
    const worker = async () => {
      while (queue.length) {
        const item = queue.shift()!;
        try {
          let bars: Bar[] = [];
          if (useAngel && item.market === 'NSE') {
            try {
              const inst = angel.resolveInstrument(item.symbol, 'NSE');
              if (inst) bars = await angel.fetchAngelBars(inst, 430);
            } catch { }
          }
          if (bars.length < 30) {
            bars = await yahooBars(item.market === 'US' ? item.symbol : `${item.symbol}.NS`);
          }
          const a = analyse(item.symbol, item.market, bars);
          if (a) rows.push(a); else state.failed.push(item.symbol);
        } catch {
          state.failed.push(item.symbol);
        }
        state.done++;
        if (useAngel) await new Promise((r) => setTimeout(r, 700)); // Angel historical API ~3 req/sec
      }
    };
    await Promise.all(Array.from({ length: useAngel ? 3 : 5 }, worker));
    state.rows = rows; state.status = 'done'; state.finishedAt = Date.now();
  })().catch(() => { state.status = 'done'; state.finishedAt = Date.now(); });
}
