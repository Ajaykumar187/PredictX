import { AnalysisResult, DividendResponse, MarketType, PriceBar, StockInfo } from '../types';
import { runFullAnalysis } from './aiEngine';
import { formatCurrencyValue, getStockInfo, StockSearchResult } from './marketData';
import type { OptionChainRow } from './greeks';

export interface LiveQuoteResponse {
  success: boolean;
  symbol: string;
  displaySymbol: string;
  name: string;
  currency: string;
  currencySymbol: string;
  market: MarketType;
  latestPrice: number;
  change: number;
  changePct: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  regularMarketDayHigh: number;
  regularMarketDayLow: number;
  regularMarketVolume: number;
  bars: PriceBar[];
  info?: StockInfo;
  source?: string;
  environment?: string;
  isFallback?: boolean;
}

export async function searchStocksApi(query: string): Promise<StockSearchResult[]> {
  const cleanQ = query.trim();
  if (!cleanQ) return [];

  console.log(`[PredictX Client][Search] Searching stocks with query="${cleanQ}"`);
  try {
    const res = await fetch(`/api/stock/search?q=${encodeURIComponent(cleanQ)}`);
    console.log(`[PredictX Client][Search] /api/stock/search status=${res.status}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.results) && data.results.length > 0) {
        console.log(`[PredictX Client][Search] Got ${data.results.length} results from API`);
        return data.results.map((item: any) => {
          const isUS = item.market === 'US';
          return {
            symbol: item.symbol,
            displaySymbol: item.displaySymbol,
            longName: item.name,
            market: (item.market as MarketType) || 'NSE',
            sector: item.exchange || (isUS ? 'US Equities' : 'Indian Equities'),
            price: 0,
            currencySymbol: isUS ? '$' : '₹',
          };
        });
      }
    }
  } catch (err) {
    console.warn('[PredictX Client][Search] Live search API unavailable:', err);
  }
  return [];
}

export async function fetchLiveQuote(symbol: string, marketHint?: MarketType): Promise<LiveQuoteResponse | null> {
  const cleanSym = symbol.trim();
  if (!cleanSym) {
    console.warn('[PredictX Client][fetchLiveQuote] Empty symbol provided');
    return null;
  }

  const endpoint = `/api/stock/quote/${encodeURIComponent(cleanSym)}?market=${marketHint || ''}`;
  console.log(`[PredictX Client][fetchLiveQuote] >>> Requesting quote from ${endpoint} (cleanSym="${cleanSym}", marketHint="${marketHint || ''}")`);

  const startTime = performance.now();
  try {
    const res = await fetch(endpoint);
    const durationMs = Math.round(performance.now() - startTime);

    console.log(`[PredictX Client][fetchLiveQuote] <<< Received response from ${endpoint}: status=${res.status} (${durationMs}ms)`);

    if (res.ok) {
      const data: LiveQuoteResponse = await res.json();
      console.log(`[PredictX Client][fetchLiveQuote] API Response Payload:`, {
        symbol: data.symbol,
        displaySymbol: data.displaySymbol,
        latestPrice: data.latestPrice,
        currencySymbol: data.currencySymbol,
        change: data.change,
        changePct: data.changePct,
        market: data.market,
        barsCount: data.bars?.length,
        source: data.source || 'unknown',
        environment: data.environment || 'unknown',
      });

      if (data && data.success && Array.isArray(data.bars) && data.bars.length > 0) {
        return data;
      } else {
        console.warn(`[PredictX Client][fetchLiveQuote] Response payload missing bars or invalid structure:`, data);
      }
    } else {
      const errorText = await res.text().catch(() => '');
      console.error(`[PredictX Client][fetchLiveQuote] HTTP ${res.status} error from server:`, errorText);
    }
  } catch (err: any) {
    console.warn(`[PredictX Client][fetchLiveQuote] Network fetch error for ${endpoint}:`, err.message);
  }

  console.log(`[PredictX Client][fetchLiveQuote] Attempting client-side fallback via public CORS proxy...`);
  try {
    let resolvedTicker = cleanSym.toUpperCase();
    if (resolvedTicker === 'NIFTY' || resolvedTicker === 'NIFTY 50') resolvedTicker = '^NSEI';
    else if (resolvedTicker === 'SENSEX') resolvedTicker = '^BSESN';
    else if (resolvedTicker === 'TATAMOTORS') resolvedTicker = marketHint === 'BSE' ? 'TMPV.BO' : 'TMPV.NS';
    else if (resolvedTicker === 'ZOMATO') resolvedTicker = marketHint === 'BSE' ? 'ETERNAL.BO' : 'ETERNAL.NS';
    else if (!resolvedTicker.includes('.') && !resolvedTicker.startsWith('^') && marketHint !== 'US') {
      resolvedTicker = marketHint === 'BSE' ? `${resolvedTicker}.BO` : `${resolvedTicker}.NS`;
    }

    const targetUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(resolvedTicker)}?range=1y&interval=1d`;
    console.log(`[PredictX Client][fetchLiveQuote] Fallback target URL: ${targetUrl}`);

    let pRes: Response | null = null;
    try {
      pRes = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`, {
        signal: AbortSignal.timeout(4000),
      });
      console.log(`[PredictX Client][fetchLiveQuote] allorigins proxy status: ${pRes?.status}`);
    } catch {
      pRes = null;
    }

    if (pRes && pRes.ok) {
      const pData = await pRes.json();
      const r = pData?.chart?.result?.[0];
      if (r) {
        const meta = r.meta || {};
        const timestamps = r.timestamp || [];
        const quote = r.indicators?.quote?.[0] || {};
        const bars: PriceBar[] = [];

        for (let i = 0; i < timestamps.length; i++) {
          const c = quote.close?.[i];
          if (c !== null && c !== undefined && !isNaN(c)) {
            const o = quote.open?.[i] ?? c;
            const h = quote.high?.[i] ?? Math.max(o, c);
            const l = quote.low?.[i] ?? Math.min(o, c);
            const v = quote.volume?.[i] ?? 0;
            const dateStr = new Date(timestamps[i] * 1000).toISOString().split('T')[0];
            bars.push({
              date: dateStr,
              open: Number(o.toFixed(2)),
              high: Number(h.toFixed(2)),
              low: Number(l.toFixed(2)),
              close: Number(c.toFixed(2)),
              volume: Math.round(v),
            });
          }
        }

        if (bars.length > 0) {
          const lastBar = bars[bars.length - 1];
          const prevBar = bars[bars.length - 2] || lastBar;
          const latestPrice = meta.regularMarketPrice ?? lastBar.close;

          let change = 0;
          let changePct = 0;

          if (meta.fulldayChange !== undefined && meta.fulldayChange !== null && !isNaN(meta.fulldayChange)) {
            change = Number(Number(meta.fulldayChange).toFixed(2));
          } else if (meta.regularMarketChange !== undefined && meta.regularMarketChange !== null && !isNaN(meta.regularMarketChange)) {
            change = Number(Number(meta.regularMarketChange).toFixed(2));
          } else if (bars.length >= 2 && prevBar) {
            change = Number((latestPrice - prevBar.close).toFixed(2));
          }

          if (meta.regularMarketChangePercent !== undefined && meta.regularMarketChangePercent !== null && !isNaN(meta.regularMarketChangePercent)) {
            changePct = Number(Number(meta.regularMarketChangePercent).toFixed(2));
          } else if (meta.fulldayChangePercent !== undefined && meta.fulldayChangePercent !== null && !isNaN(meta.fulldayChangePercent)) {
            changePct = Number(Number(meta.fulldayChangePercent).toFixed(2));
          } else if (bars.length >= 2 && prevBar && prevBar.close > 0) {
            changePct = Number(((change / prevBar.close) * 100).toFixed(2));
          }

          const curr = meta.currency || (resolvedTicker.endsWith('.NS') ? 'INR' : 'USD');
          const isUS = curr === 'USD' || marketHint === 'US';

          const fallbackResult: LiveQuoteResponse = {
            success: true,
            symbol: resolvedTicker,
            displaySymbol: resolvedTicker.replace('.NS', '').replace('.BO', '').replace('^', ''),
            name: meta.shortName || meta.symbol || resolvedTicker,
            currency: curr,
            currencySymbol: curr === 'INR' ? '₹' : (curr === 'USD' ? '$' : '₹'),
            market: isUS ? 'US' : 'NSE',
            latestPrice: Number(latestPrice.toFixed(2)),
            change,
            changePct,
            fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh ?? Math.max(...bars.map((b) => b.high)),
            fiftyTwoWeekLow: meta.fiftyTwoWeekLow ?? Math.min(...bars.map((b) => b.low)),
            regularMarketDayHigh: meta.regularMarketDayHigh ?? lastBar.high,
            regularMarketDayLow: meta.regularMarketDayLow ?? lastBar.low,
            regularMarketVolume: meta.regularMarketVolume ?? lastBar.volume,
            bars,
            source: 'client-proxy-fallback',
          };

          console.log(`[PredictX Client][fetchLiveQuote] Client fallback succeeded with price: ${fallbackResult.latestPrice}`);
          return fallbackResult;
        }
      }
    }
  } catch (err2: any) {
    console.warn('[PredictX Client][fetchLiveQuote] Client fallback proxy error:', err2.message);
  }

  console.warn(`[PredictX Client][fetchLiveQuote] All live quote attempts failed for ${cleanSym}`);
  return null;
}

export async function fetchStockInfo(symbol: string, marketHint?: MarketType): Promise<StockInfo | null> {
  const cleanSym = symbol.trim();
  if (!cleanSym) return null;

  try {
    const res = await fetch(`/api/stock/info/${encodeURIComponent(cleanSym)}?market=${marketHint || ''}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.symbol) {
        return data as StockInfo;
      }
    }
  } catch (err) {
    console.warn('[PredictX Client] Failed to fetch live stock info from Yahoo API:', err);
  }
  return null;
}

export async function fetchBatchStockQuotes(
  items: Array<{ symbol: string; market?: MarketType }>
): Promise<Record<string, { price: number; change: number; changePct: number; currencySymbol: string }>> {
  const results: Record<string, { price: number; change: number; changePct: number; currencySymbol: string }> = {};
  if (!items || items.length === 0) return results;

  await Promise.all(
    items.map(async (item) => {
      const key = item.symbol.toUpperCase();
      try {
        const q = await fetchLiveQuote(item.symbol, item.market);
        if (q && q.latestPrice > 0) {
          results[key] = {
            price: q.latestPrice,
            change: q.change,
            changePct: q.changePct,
            currencySymbol: q.currencySymbol,
          };
        }
      } catch (err) {
        console.warn(`[PredictX Client] Batch quote failed for ${item.symbol}:`, err);
      }
    })
  );

  return results;
}

export async function fetchAndAnalyzeStock(
  symbol: string,
  marketHint: MarketType,
  onEnriched?: (a: AnalysisResult) => void
): Promise<AnalysisResult> {
  const quote = await fetchLiveQuote(symbol, marketHint);

  if (quote && quote.bars.length > 0) {
    const build = (liveInfo: StockInfo | null | undefined): AnalysisResult => {
      const baseInfo = getStockInfo(quote.displaySymbol, quote.market);
      const mergedInfo: StockInfo = {
        ...baseInfo,
        ...(liveInfo || {}),
        symbol: quote.symbol,
        displaySymbol: quote.displaySymbol,
        longName: liveInfo?.longName || quote.name || baseInfo.longName,
        market: quote.market,
        currency: quote.currency,
        currencySymbol: quote.currencySymbol,
        fiftyTwoWeekHigh: liveInfo?.fiftyTwoWeekHigh || quote.fiftyTwoWeekHigh || baseInfo.fiftyTwoWeekHigh,
        fiftyTwoWeekLow: liveInfo?.fiftyTwoWeekLow || quote.fiftyTwoWeekLow || baseInfo.fiftyTwoWeekLow,
      };
      return runFullAnalysis(
        quote.displaySymbol,
        quote.market,
        quote.bars,
        mergedInfo,
        quote.latestPrice,
        quote.change,
        quote.changePct
      );
    };

    const liveInfo = quote.info;
    const analysis = build(liveInfo);

    if ((!liveInfo || !liveInfo.longBusinessSummary) && onEnriched) {
      fetchStockInfo(quote.displaySymbol, quote.market)
        .then((fetched) => {
          if (fetched) onEnriched(build(fetched));
        })
        .catch(() => {});
    }
    return analysis;
  }

  throw new Error(`Live data unavailable for "${symbol}". Check the ticker or that the Angel One / Yahoo APIs are reachable.`);
}

export async function fetchDividends(symbol: string, marketHint?: MarketType): Promise<DividendResponse | null> {
  const cleanSym = symbol.trim();
  if (!cleanSym) return null;

  try {
    const res = await fetch(`/api/stock/dividends/${encodeURIComponent(cleanSym)}?market=${marketHint || ''}`);
    if (res.ok) {
      const data: DividendResponse = await res.json();
      if (data && data.success) {
        return data;
      }
    }
  } catch (err) {
    console.warn('[PredictX Client] Failed to fetch live dividends from API:', err);
  }
  return null;
}

export async function fetchMarketUpcomingDividends(market?: string): Promise<import('../types').MarketDividendItem[]> {
  try {
    const url = `/api/market/upcoming-dividends${market ? `?market=${encodeURIComponent(market)}` : ''}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.items)) {
        return data.items;
      }
    }
  } catch (err) {
    console.warn('[PredictX Client] Failed to fetch market upcoming dividends:', err);
  }
  return [];
}

export interface LiveOptionChainResponse {
  success: boolean;
  symbol: string;
  spotPrice: number;
  dayChange: number;
  dayChangePerc: number;
  atmStrike: number;
  pcr: number;
  totalCallOI: number;
  totalPutOI: number;
  totalCallChangeOI: number;
  totalPutChangeOI: number;
  maxPain: number;
  aiSignal: { signal: 'BUY CALL' | 'BUY PUT' | 'WATCH' | 'NO TRADE'; confidence: number; reason: string };
  chain: OptionChainRow[];
  expiries?: string[];
  currentExpiry?: string;
  expiryLotSize?: number;
  strikeStep?: number;
  oiChangeReady?: boolean;
  source?: string;
  fetchedAt?: string;
}

export let lastOptionChainError = '';

export async function fetchLiveOptionChain(symbol: string, expiry?: string, strikes = 10): Promise<LiveOptionChainResponse | null> {
  const clean = symbol.trim();
  if (!clean) return null;
  lastOptionChainError = '';
  try {
    const res = await fetch(`/api/options/chain/${encodeURIComponent(clean)}?strikes=${strikes}${expiry ? `&expiry=${encodeURIComponent(expiry)}` : ''}`, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (data && data.success && Array.isArray(data.chain)) {
        return data as LiveOptionChainResponse;
      }
    } else {
      const body = await res.json().catch(() => null);
      lastOptionChainError = body?.reason || body?.error || `HTTP ${res.status}`;
    }
  } catch (err) {
    console.warn('[PredictX Client] Failed to fetch live option chain:', err);
  }
  return null;
}



export interface BatchQuote {
  symbol: string; market: string; price: number; change: number; changePct: number;
  open: number; high: number; low: number; prevClose: number; volume: number;
  high52: number; low52: number; source: string;
}

export async function fetchBatchQuotes(items: Array<{ symbol: string; market: string }>): Promise<BatchQuote[]> {
  if (!items.length) return [];
  try {
    const q = items.map((i) => `${encodeURIComponent(i.symbol)}:${i.market}`).join(',');
    const res = await fetch(`/api/stock/batch?symbols=${q}`, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (data?.success && Array.isArray(data.quotes)) return data.quotes;
    }
  } catch (err) {
    console.warn('[PredictX Client] batch quotes failed:', err);
  }
  return [];
}

export async function fetchConstituents(symbol: string): Promise<{ isIndex: boolean; quotes: BatchQuote[]; total: number }> {
  try {
    const res = await fetch(`/api/index/constituents/${encodeURIComponent(symbol)}`, { cache: 'no-store' });
    if (res.ok) {
      const d = await res.json();
      return { isIndex: !!d.isIndex, quotes: d.quotes || [], total: d.total || 0 };
    }
  } catch (err) {
    console.warn('[PredictX Client] constituents failed:', err);
  }
  return { isIndex: false, quotes: [], total: 0 };
}

export interface DepthLevel { price: number; quantity: number; orders: number }
export interface DepthResponse {
  success: boolean; error?: string; ltp: number; open: number; high: number; low: number; close: number;
  oi: number; volume: number; totBuyQuan: number; totSellQuan: number; lowerCircuit: number; upperCircuit: number;
  buy: DepthLevel[]; sell: DepthLevel[]; tradingSymbol: string;
}

export async function fetchDepth(exchange: string, token: string): Promise<DepthResponse> {
  try {
    const res = await fetch(`/api/depth?exchange=${exchange}&token=${encodeURIComponent(token)}`, { cache: 'no-store' });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err?.message || 'depth request failed' } as DepthResponse;
  }
}

export interface FiiDiiRow { category: string; date: string; buyValue: number; sellValue: number; netValue: number }
export interface FiiDiiResponse { success: boolean; rows: FiiDiiRow[]; source?: string; error?: string }

export async function fetchFiiDii(): Promise<FiiDiiResponse> {
  try {
    const res = await fetch('/api/market/fii-dii');
    if (!res.ok) return { success: false, rows: [], error: `Server error ${res.status}` };
    return await res.json();
  } catch (e: any) {
    return { success: false, rows: [], error: e?.message || 'Network error' };
  }
}

export interface HoldersResponse {
  success: boolean;
  error?: string;
  source?: string;
  insidersPct?: number | null;
  institutionsPct?: number | null;
  institutionsCount?: number | null;
  topInstitutions?: Array<{ name: string; pct: number | null; shares: number | null; reportDate: string | null }>;
  insiderTransactions?: Array<{ name: string; relation: string; text: string; shares: number | null; value: number | null; date: string | null }>;
  nextEarnings?: string | null;
  exDividendDate?: string | null;
}

export async function fetchHolders(symbol: string, marketHint?: MarketType): Promise<HoldersResponse> {
  try {
    const res = await fetch(`/api/stock/holders/${encodeURIComponent(symbol)}?market=${marketHint || ''}`);
    if (!res.ok) return { success: false, error: `Server error ${res.status}` };
    return await res.json();
  } catch (e: any) {
    return { success: false, error: e?.message || 'Network error' };
  }
}

export interface NewsItem { title: string; publisher: string; link: string; time: number | null }
export interface NewsResponse { success: boolean; items: NewsItem[]; source?: string; error?: string }

export async function fetchStockNews(symbol: string, marketHint?: MarketType): Promise<NewsResponse> {
  try {
    const res = await fetch(`/api/stock/news/${encodeURIComponent(symbol)}?market=${marketHint || ''}`);
    if (!res.ok) return { success: false, items: [], error: `Server error ${res.status}` };
    return await res.json();
  } catch (e: any) {
    return { success: false, items: [], error: e?.message || 'Network error' };
  }
}

export function deviceToken(): string {
  const k = 'predictx_device_token';
  try {
    let t = localStorage.getItem(k);
    if (!t) {
      t = (crypto as any).randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(k, t);
    }
    return t;
  } catch {
    return 'no-storage-token-0000';
  }
}

export interface LeaderRow { username: string; total_value: number; return_pct: number; updated_at: string }

export async function fetchLeaderboard(): Promise<{ configured: boolean; rows: LeaderRow[]; error?: string }> {
  try {
    const r = await fetch('/api/leaderboard');
    if (!r.ok) return { configured: false, rows: [] };
    return await r.json();
  } catch {
    return { configured: false, rows: [], error: 'Network error' };
  }
}

export async function submitLeaderboard(username: string, email: string, totalValue: number): Promise<{ configured?: boolean; ok?: boolean; rank?: number; error?: string }> {
  try {
    const r = await fetch('/api/leaderboard/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, token: deviceToken(), totalValue }),
    });
    return await r.json();
  } catch {
    return { error: 'Network error' };
  }
}

export async function digestConfigured(): Promise<boolean> {
  try {
    const r = await fetch('/api/digest/status');
    return r.ok ? !!(await r.json()).configured : false;
  } catch {
    return false;
  }
}

export async function setDigest(email: string, watchlist: Array<{ symbol: string; market: string }>, enabled: boolean): Promise<{ ok?: boolean; count?: number; needsConfirm?: boolean; error?: string; configured?: boolean }> {
  try {
    const r = await fetch('/api/digest/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, token: deviceToken(), watchlist, enabled }),
    });
    return await r.json();
  } catch {
    return { error: 'Network error' };
  }
}
