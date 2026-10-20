export type Market = 'NSE' | 'BSE' | 'US';

export interface LiveQuote {
  symbol: string;
  displaySymbol: string;
  name: string;
  currency: string;
  currencySymbol: string;
  latestPrice: number;
  change: number;
  changePct: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  regularMarketDayHigh?: number;
  regularMarketDayLow?: number;
  regularMarketVolume?: number;
  source: string;
  fetchedAt: string;
}

export interface SearchResult {
  symbol: string;
  displaySymbol: string;
  name: string;
  market: string;
}

export async function searchStocksApi(query: string): Promise<SearchResult[]> {
  const q = query.trim();
  if (!q) return [];
  try {
    const res = await fetch(`/api/stock/search?q=${encodeURIComponent(q)}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.results) ? data.results : [];
  } catch {
    return [];
  }
}

function parseYahooMeta(json: any, ticker: string): LiveQuote | null {
  const r = json?.chart?.result?.[0];
  const meta = r?.meta;
  if (!meta || typeof meta.regularMarketPrice !== 'number') return null;
  const price: number = meta.regularMarketPrice;
  const prev: number | undefined = meta.chartPreviousClose ?? meta.previousClose;
  const change = prev ? Number((price - prev).toFixed(2)) : 0;
  const changePct = prev ? Number(((change / prev) * 100).toFixed(2)) : 0;
  const currency = meta.currency || 'INR';
  return {
    symbol: ticker,
    displaySymbol: ticker.replace('.NS', '').replace('.BO', '').replace('^', ''),
    name: meta.shortName || meta.longName || ticker,
    currency,
    currencySymbol: currency === 'INR' ? '₹' : currency === 'USD' ? '$' : currency + ' ',
    latestPrice: Number(price.toFixed(2)),
    change,
    changePct,
    fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh,
    fiftyTwoWeekLow: meta.fiftyTwoWeekLow,
    regularMarketDayHigh: meta.regularMarketDayHigh,
    regularMarketDayLow: meta.regularMarketDayLow,
    regularMarketVolume: meta.regularMarketVolume,
    source: 'browser-proxy',
    fetchedAt: new Date().toISOString(),
  };
}

function resolveTicker(raw: string, market: Market): string {
  const u = raw.trim().toUpperCase();
  if (['NIFTY', 'NIFTY 50', 'NIFTY50'].includes(u)) return '^NSEI';
  if (['SENSEX', 'BSE SENSEX'].includes(u)) return '^BSESN';
  if (['BANKNIFTY', 'BANK NIFTY'].includes(u)) return '^NSEBANK';
  if (u === 'TATAMOTORS') return market === 'BSE' ? 'TMPV.BO' : 'TMPV.NS';
  if (u === 'ZOMATO') return market === 'BSE' ? 'ETERNAL.BO' : 'ETERNAL.NS';
  if (u.includes('.') || u.startsWith('^')) return u;
  if (market === 'US') return u;
  return market === 'BSE' ? `${u}.BO` : `${u}.NS`;
}

export async function fetchLiveQuote(symbol: string, market: Market): Promise<LiveQuote | null> {
  const clean = symbol.trim();
  if (!clean) return null;

  try {
    const res = await fetch(`/api/stock/quote/${encodeURIComponent(clean)}?market=${market}`, { cache: 'no-store' });
    if (res.ok) {
      const d = await res.json();
      if (d?.success && typeof d.latestPrice === 'number') return d as LiveQuote;
    }
  } catch {
  }

  const ticker = resolveTicker(clean, market);
  const candidates = [ticker];
  if (ticker.endsWith('.NS')) candidates.push(ticker.replace('.NS', '.BO'));
  const proxies: Array<(u: string) => string> = [
    (u) => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
    (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
    (u) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
  ];
  for (const t of candidates) {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(t)}?range=5d&interval=1d`;
    for (const wrap of proxies) {
      try {
        const r = await fetch(wrap(url), { signal: AbortSignal.timeout(7000) });
        if (!r.ok) continue;
        const q = parseYahooMeta(await r.json(), t);
        if (q) return q;
      } catch {
      }
    }
  }
  return null;
}
