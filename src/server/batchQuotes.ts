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
  const up = symbol.trim().toUpperCase();
  const bare = up.replace(/\.(NS|BO)$/, '').replace(/^\^/, '');
  let t = up;
  if (bare === 'NIFTY 50' || bare === 'NIFTY' || bare === 'NIFTY50' || bare === 'NSEI') t = '^NSEI';
  else if (bare === 'BANK NIFTY' || bare === 'BANKNIFTY' || bare === 'NSEBANK') t = '^NSEBANK';
  else if (bare === 'FIN NIFTY' || bare === 'FINNIFTY' || bare === 'NIFTY_FIN_SERVICE') t = 'NIFTY_FIN_SERVICE.NS';
  else if (bare === 'MIDCAP NIFTY' || bare === 'MIDCPNIFTY' || bare === 'NSEMDCP50') t = '^NSEMDCP50';
  else if (bare === 'SENSEX' || bare === 'BSE SENSEX' || bare === 'BSESN') t = '^BSESN';
  else if (bare === 'NIFTY IT' || bare === 'CNXIT') t = '^CNXIT';
  else if (bare === 'INDIA VIX' || bare === 'INDIAVIX') t = '^INDIAVIX';
  else if (bare === 'GOLD') t = 'GC=F';
  else if (bare === 'SILVER') t = 'SI=F';
  else if (bare === 'CRUDEOIL' || bare === 'CRUDE OIL' || bare === 'WTI CRUDE') t = 'CL=F';
  else if (bare === 'BRENT' || bare === 'BRENT CRUDE') t = 'BZ=F';
  else if (bare === 'NATURALGAS' || bare === 'NATURAL GAS') t = 'NG=F';
  else if (bare === 'COPPER') t = 'HG=F';
  else if (['GSPC', 'IXIC', 'DJI', 'NDX', 'RUT', 'VIX', 'FTSE', 'N225', 'HSI', 'GDAXI'].includes(bare)) t = `^${bare}`;
  else if (bare === 'TATAMOTORS') t = market === 'BSE' ? 'TMPV.BO' : 'TMPV.NS';
  else if (bare === 'ZOMATO') t = market === 'BSE' ? 'ETERNAL.BO' : 'ETERNAL.NS';
  else if (market !== 'US' && !up.includes('.') && !up.startsWith('^') && !up.includes('=')) {
    t = market === 'BSE' ? `${up}.BO` : `${up}.NS`;
  }

  for (const host of ['query1.finance.yahoo.com', 'query2.finance.yahoo.com']) {
    try {
      const res = await fetch(`https://${host}/v8/finance/chart/${encodeURIComponent(t)}?range=5d&interval=1d`, {
        headers: { 'User-Agent': UA, Accept: '*/*' },
        signal: AbortSignal.timeout(7000),
      });
      if (!res.ok) continue;
      const result = (await res.json())?.chart?.result?.[0];
      const m = result?.meta;
      const price = num(m?.regularMarketPrice);
      if (!(price > 0)) continue;

      // Compute accurate, consistent 1-day prevClose, change, and changePct
      const rawCloses: any[] = result?.indicators?.quote?.[0]?.close || [];
      const validCloses = rawCloses.filter((c): c is number => typeof c === 'number' && Number.isFinite(c) && c > 0);
      const prevBarClose = validCloses.length >= 2 ? validCloses[validCloses.length - 2] : 0;
      const metaPrev = num(m?.regularMarketPreviousClose ?? m?.previousClose);
      const hasMetaChange = m?.regularMarketChange !== undefined && m?.regularMarketChange !== null && Number.isFinite(Number(m.regularMarketChange));
      const hasMetaPct = m?.regularMarketChangePercent !== undefined && m?.regularMarketChangePercent !== null && Number.isFinite(Number(m.regularMarketChangePercent)) && Number(m.regularMarketChangePercent) > -99;

      let prev = metaPrev > 0 ? metaPrev : (prevBarClose > 0 ? prevBarClose : num(m?.chartPreviousClose));
      let rawChange: number;
      let changePct: number;

      if (hasMetaChange) {
        rawChange = Number(m.regularMarketChange);
        if (!(metaPrev > 0)) prev = price - rawChange;
        changePct = hasMetaPct ? Number(m.regularMarketChangePercent) : (prev > 0 ? (rawChange / prev) * 100 : 0);
      } else if (hasMetaPct) {
        changePct = Number(m.regularMarketChangePercent);
        prev = price / (1 + changePct / 100);
        rawChange = price - prev;
      } else {
        rawChange = prev > 0 ? price - prev : 0;
        changePct = prev > 0 ? (rawChange / prev) * 100 : 0;
      }

      const rawOpens: any[] = result?.indicators?.quote?.[0]?.open || [];
      const validOpens = rawOpens.filter((o): o is number => typeof o === 'number' && Number.isFinite(o) && o > 0);
      const latestOpen = num(m?.regularMarketOpen) || (validOpens.length ? validOpens[validOpens.length - 1] : 0);

      return {
        symbol,
        market,
        price: r2(price),
        change: r2(rawChange),
        changePct: r2(changePct),
        open: r2(latestOpen),
        high: r2(num(m?.regularMarketDayHigh)),
        low: r2(num(m?.regularMarketDayLow)),
        prevClose: r2(prev),
        volume: num(m?.regularMarketVolume),
        high52: r2(num(m?.fiftyTwoWeekHigh)),
        low52: r2(num(m?.fiftyTwoWeekLow)),
        source: 'yahoo',
      };
    } catch {
      // Try fallback Yahoo host
    }
  }
  return null;
}

export async function batchQuotes(items: Array<{ symbol: string; market: string }>): Promise<BatchQuote[]> {
  const results = new Map<string, BatchQuote>();
  const key = (i: { symbol: string; market: string }) => `${i.symbol}|${i.market}`;

  if (angelConfigured()) {
    const byEx: Record<string, Array<{ item: { symbol: string; market: string }; token: string }>> = {};
    for (const item of items) {
      if (item.market === 'US' || item.market === 'COMMODITY') continue;
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
