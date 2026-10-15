import { fetchAngelQuoteBatch, resolveInstrument, angelConfigured } from './angel.js';

export interface BatchQuote {
  symbol: string; market: string; price: number; change: number; changePct: number;
  open: number; high: number; low: number; prevClose: number; volume: number;
  high52: number; low52: number; source: string;
}
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
const num = (v: any) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const r2 = (n: number) => Math.round(n * 100) / 100;

async function yahooQuote(symbol: string, market: string): Promise<BatchQuote | null> {
  const up = symbol.toUpperCase();
  let t = up;
  if (up === 'NIFTY 50' || up === 'NIFTY') t = '^NSEI';
  else if (up === 'BANK NIFTY' || up === 'BANKNIFTY') t = '^NSEBANK';
  else if (up === 'SENSEX') t = '^BSESN';
  else if (up === 'TATAMOTORS') t = market === 'BSE' ? 'TMPV.BO' : 'TMPV.NS';
  else if (up === 'ZOMATO') t = market === 'BSE' ? 'ETERNAL.BO' : 'ETERNAL.NS';
  else if (market !== 'US' && !up.includes('.') && !up.startsWith('^')) t = market === 'BSE' ? `${up}.BO` : `${up}.NS`;
  try {
    const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(t)}?range=5d&interval=1d`, {
      headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(7000),
    });
    if (!res.ok) return null;
    const m = (await res.json())?.chart?.result?.[0]?.meta;
    const price = num(m?.regularMarketPrice);
    if (!(price > 0)) return null;
    const prev = num(m.chartPreviousClose ?? m.previousClose);
    const change = prev > 0 ? price - prev : 0;
    return {
      symbol, market, price: r2(price), change: r2(change), changePct: prev > 0 ? r2((change / prev) * 100) : 0,
      open: 0, high: r2(num(m.regularMarketDayHigh)), low: r2(num(m.regularMarketDayLow)), prevClose: r2(prev),
      volume: num(m.regularMarketVolume), high52: r2(num(m.fiftyTwoWeekHigh)), low52: r2(num(m.fiftyTwoWeekLow)), source: 'yahoo',
    };
  } catch { return null; }
}

export async function batchQuotes(items: Array<{ symbol: string; market: string }>): Promise<BatchQuote[]> {
  const results = new Map<string, BatchQuote>();
  const key = (i: { symbol: string; market: string }) => `${i.symbol}|${i.market}`;

  if (angelConfigured()) {
    const byEx: Record<string, Array<{ item: { symbol: string; market: string }; token: string }>> = {};
    for (const item of items) {
      if (item.market === 'US') continue;
      const inst = resolveInstrument(item.symbol, item.market);
      if (inst) (byEx[inst.exchange] ||= []).push({ item, token: inst.token });
    }
    for (const [ex, list] of Object.entries(byEx)) {
      try {
        const q = await fetchAngelQuoteBatch(ex, list.map((l) => l.token));
        for (const { item, token } of list) {
          const x = q.get(token);
          if (!x || !(num(x.ltp) > 0)) continue;
          const prev = num(x.close);
          const change = Number.isFinite(Number(x.netChange)) ? num(x.netChange) : num(x.ltp) - prev;
          results.set(key(item), {
            symbol: item.symbol, market: item.market, price: r2(num(x.ltp)), change: r2(change),
            changePct: Number.isFinite(Number(x.percentChange)) ? r2(num(x.percentChange)) : (prev > 0 ? r2((change / prev) * 100) : 0),
            open: r2(num(x.open)), high: r2(num(x.high)), low: r2(num(x.low)), prevClose: r2(prev), volume: num(x.tradeVolume),
            high52: r2(num(x['52WeekHigh'])), low52: r2(num(x['52WeekLow'])), source: 'angel',
          });
        }
      } catch (e: any) {
        console.warn('[batchQuotes] Angel batch failed:', e?.message || e);
      }
    }
  }

  const missing = items.filter((i) => !results.has(key(i)));
  const queue = [...missing];
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (queue.length) {
      const it = queue.shift()!;
      const q = await yahooQuote(it.symbol, it.market);
      if (q) results.set(key(it), q);
    }
  }));
  return items.map((i) => results.get(key(i))).filter((x): x is BatchQuote => !!x);
}
