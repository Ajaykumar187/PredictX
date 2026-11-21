import { angelConfigured, fetchAngelQuoteBatch, resolveInstrument } from './angel.js';

export interface Nse500Constituent {
  symbol: string;
  name: string;
  sector: string;
}

export interface HeatmapStock {
  symbol: string;
  name: string;
  sector: string;
  price: number;
  change: number;
  changePct: number;
  dayHigh: number;
  dayLow: number;
  prevClose: number;
  volume: number;
  marketCap: number;
  turnover: number;
}

export interface HeatmapSectorSummary {
  sector: string;
  count: number;
  advances: number;
  declines: number;
  unchanged: number;
  avgChangePct: number;
  weightedChangePct: number;
  totalMarketCap: number;
}

export interface Nse500HeatmapPayload {
  success: boolean;
  indexName: string;
  source: string;
  totalConstituents: number;
  loadedStocks: number;
  advances: number;
  declines: number;
  unchanged: number;
  avgChangePct: number;
  fetchedAt: string;
  sectors: HeatmapSectorSummary[];
  stocks: HeatmapStock[];
  error?: string;
}

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

const FALLBACK_NSE500: Nse500Constituent[] = [
  // Financial Services
  { symbol: 'HDFCBANK', name: 'HDFC Bank Ltd.', sector: 'Financial Services' },
  { symbol: 'ICICIBANK', name: 'ICICI Bank Ltd.', sector: 'Financial Services' },
  { symbol: 'SBIN', name: 'State Bank of India', sector: 'Financial Services' },
  { symbol: 'KOTAKBANK', name: 'Kotak Mahindra Bank Ltd.', sector: 'Financial Services' },
  { symbol: 'AXISBANK', name: 'Axis Bank Ltd.', sector: 'Financial Services' },
  { symbol: 'BAJFINANCE', name: 'Bajaj Finance Ltd.', sector: 'Financial Services' },
  { symbol: 'BAJAJFINSV', name: 'Bajaj Finserv Ltd.', sector: 'Financial Services' },
  { symbol: 'JIOFIN', name: 'Jio Financial Services Ltd.', sector: 'Financial Services' },
  { symbol: 'SHRIRAMFIN', name: 'Shriram Finance Ltd.', sector: 'Financial Services' },
  { symbol: 'SBILIFE', name: 'SBI Life Insurance Co. Ltd.', sector: 'Financial Services' },
  { symbol: 'HDFCLIFE', name: 'HDFC Life Insurance Co. Ltd.', sector: 'Financial Services' },
  { symbol: 'LICI', name: 'Life Insurance Corp. of India', sector: 'Financial Services' },
  { symbol: 'INDUSINDBK', name: 'IndusInd Bank Ltd.', sector: 'Financial Services' },
  { symbol: 'BANKBARODA', name: 'Bank of Baroda', sector: 'Financial Services' },
  { symbol: 'PNB', name: 'Punjab National Bank', sector: 'Financial Services' },
  { symbol: 'CHOLAFIN', name: 'Cholamandalam Inv. & Fin.', sector: 'Financial Services' },
  { symbol: 'PFC', name: 'Power Finance Corp. Ltd.', sector: 'Financial Services' },
  { symbol: 'RECLTD', name: 'REC Ltd.', sector: 'Financial Services' },
  { symbol: 'MUTHOOTFIN', name: 'Muthoot Finance Ltd.', sector: 'Financial Services' },
  { symbol: 'BSE', name: 'BSE Ltd.', sector: 'Financial Services' },
  // Information Technology
  { symbol: 'TCS', name: 'Tata Consultancy Services', sector: 'Information Technology' },
  { symbol: 'INFY', name: 'Infosys Ltd.', sector: 'Information Technology' },
  { symbol: 'HCLTECH', name: 'HCL Technologies Ltd.', sector: 'Information Technology' },
  { symbol: 'WIPRO', name: 'Wipro Ltd.', sector: 'Information Technology' },
  { symbol: 'TECHM', name: 'Tech Mahindra Ltd.', sector: 'Information Technology' },
  { symbol: 'LTM', name: 'LTIMindtree Ltd.', sector: 'Information Technology' },
  { symbol: 'PERSISTENT', name: 'Persistent Systems Ltd.', sector: 'Information Technology' },
  { symbol: 'COFORGE', name: 'Coforge Ltd.', sector: 'Information Technology' },
  { symbol: 'MPHASIS', name: 'Mphasis Ltd.', sector: 'Information Technology' },
  { symbol: 'OFSS', name: 'Oracle Financial Services', sector: 'Information Technology' },
  // Oil Gas & Consumable Fuels
  { symbol: 'RELIANCE', name: 'Reliance Industries Ltd.', sector: 'Oil Gas & Consumable Fuels' },
  { symbol: 'ONGC', name: 'Oil & Natural Gas Corp.', sector: 'Oil Gas & Consumable Fuels' },
  { symbol: 'IOC', name: 'Indian Oil Corp. Ltd.', sector: 'Oil Gas & Consumable Fuels' },
  { symbol: 'BPCL', name: 'Bharat Petroleum Corp.', sector: 'Oil Gas & Consumable Fuels' },
  { symbol: 'GAIL', name: 'GAIL (India) Ltd.', sector: 'Oil Gas & Consumable Fuels' },
  { symbol: 'COALINDIA', name: 'Coal India Ltd.', sector: 'Oil Gas & Consumable Fuels' },
  { symbol: 'HINDPETRO', name: 'Hindustan Petroleum Corp.', sector: 'Oil Gas & Consumable Fuels' },
  // Fast Moving Consumer Goods
  { symbol: 'ITC', name: 'ITC Ltd.', sector: 'Fast Moving Consumer Goods' },
  { symbol: 'HINDUNILVR', name: 'Hindustan Unilever Ltd.', sector: 'Fast Moving Consumer Goods' },
  { symbol: 'NESTLEIND', name: 'Nestle India Ltd.', sector: 'Fast Moving Consumer Goods' },
  { symbol: 'VBL', name: 'Varun Beverages Ltd.', sector: 'Fast Moving Consumer Goods' },
  { symbol: 'BRITANNIA', name: 'Britannia Industries Ltd.', sector: 'Fast Moving Consumer Goods' },
  { symbol: 'TATACONSUM', name: 'Tata Consumer Products', sector: 'Fast Moving Consumer Goods' },
  { symbol: 'GODREJCP', name: 'Godrej Consumer Products', sector: 'Fast Moving Consumer Goods' },
  { symbol: 'DABUR', name: 'Dabur India Ltd.', sector: 'Fast Moving Consumer Goods' },
  { symbol: 'MARICO', name: 'Marico Ltd.', sector: 'Fast Moving Consumer Goods' },
  // Automobile and Auto Components
  { symbol: 'M&M', name: 'Mahindra & Mahindra Ltd.', sector: 'Automobile and Auto Components' },
  { symbol: 'MARUTI', name: 'Maruti Suzuki India Ltd.', sector: 'Automobile and Auto Components' },
  { symbol: 'TMPV', name: 'Tata Motors Passenger Vehicles', sector: 'Automobile and Auto Components' },
  { symbol: 'BAJAJ-AUTO', name: 'Bajaj Auto Ltd.', sector: 'Automobile and Auto Components' },
  { symbol: 'EICHERMOT', name: 'Eicher Motors Ltd.', sector: 'Automobile and Auto Components' },
  { symbol: 'TVSMOTOR', name: 'TVS Motor Company Ltd.', sector: 'Automobile and Auto Components' },
  { symbol: 'HEROMOTOCO', name: 'Hero MotoCorp Ltd.', sector: 'Automobile and Auto Components' },
  { symbol: 'MOTHERSON', name: 'Samvardhana Motherson Intl.', sector: 'Automobile and Auto Components' },
  { symbol: 'BHARATFORG', name: 'Bharat Forge Ltd.', sector: 'Automobile and Auto Components' },
  // Healthcare
  { symbol: 'SUNPHARMA', name: 'Sun Pharmaceutical Inds.', sector: 'Healthcare' },
  { symbol: 'CIPLA', name: 'Cipla Ltd.', sector: 'Healthcare' },
  { symbol: 'DRREDDY', name: "Dr. Reddy's Laboratories", sector: 'Healthcare' },
  { symbol: 'DIVISLAB', name: "Divi's Laboratories Ltd.", sector: 'Healthcare' },
  { symbol: 'APOLLOHOSP', name: 'Apollo Hospitals Enterprise', sector: 'Healthcare' },
  { symbol: 'MAXHEALTH', name: 'Max Healthcare Institute', sector: 'Healthcare' },
  { symbol: 'LUPIN', name: 'Lupin Ltd.', sector: 'Healthcare' },
  { symbol: 'TORNTPHARM', name: 'Torrent Pharmaceuticals', sector: 'Healthcare' },
  // Capital Goods & Construction
  { symbol: 'LT', name: 'Larsen & Toubro Ltd.', sector: 'Construction' },
  { symbol: 'HAL', name: 'Hindustan Aeronautics Ltd.', sector: 'Capital Goods' },
  { symbol: 'BEL', name: 'Bharat Electronics Ltd.', sector: 'Capital Goods' },
  { symbol: 'SIEMENS', name: 'Siemens Ltd.', sector: 'Capital Goods' },
  { symbol: 'ABB', name: 'ABB India Ltd.', sector: 'Capital Goods' },
  { symbol: 'CGPOWER', name: 'CG Power & Industrial Sol.', sector: 'Capital Goods' },
  { symbol: 'MAZDOCK', name: 'Mazagon Dock Shipbuilders', sector: 'Capital Goods' },
  { symbol: 'POLYCAB', name: 'Polycab India Ltd.', sector: 'Capital Goods' },
  { symbol: 'SUZLON', name: 'Suzlon Energy Ltd.', sector: 'Capital Goods' },
  // Power & Telecommunication & Metals & Consumer
  { symbol: 'BHARTIARTL', name: 'Bharti Airtel Ltd.', sector: 'Telecommunication' },
  { symbol: 'INDUSTOWER', name: 'Indus Towers Ltd.', sector: 'Telecommunication' },
  { symbol: 'NTPC', name: 'NTPC Ltd.', sector: 'Power' },
  { symbol: 'POWERGRID', name: 'Power Grid Corp. of India', sector: 'Power' },
  { symbol: 'TATAPOWER', name: 'Tata Power Co. Ltd.', sector: 'Power' },
  { symbol: 'ADANIGREEN', name: 'Adani Green Energy Ltd.', sector: 'Power' },
  { symbol: 'TATASTEEL', name: 'Tata Steel Ltd.', sector: 'Metals & Mining' },
  { symbol: 'JSWSTEEL', name: 'JSW Steel Ltd.', sector: 'Metals & Mining' },
  { symbol: 'HINDALCO', name: 'Hindalco Industries Ltd.', sector: 'Metals & Mining' },
  { symbol: 'VEDL', name: 'Vedanta Ltd.', sector: 'Metals & Mining' },
  { symbol: 'ADANIENT', name: 'Adani Enterprises Ltd.', sector: 'Metals & Mining' },
  { symbol: 'TITAN', name: 'Titan Company Ltd.', sector: 'Consumer Durables' },
  { symbol: 'ASIANPAINT', name: 'Asian Paints Ltd.', sector: 'Consumer Durables' },
  { symbol: 'HAVELLS', name: 'Havells India Ltd.', sector: 'Consumer Durables' },
  { symbol: 'DIXON', name: 'Dixon Technologies (India)', sector: 'Consumer Durables' },
  { symbol: 'TRENT', name: 'Trent Ltd.', sector: 'Consumer Services' },
  { symbol: 'ETERNAL', name: 'Eternal Ltd. (Zomato)', sector: 'Consumer Services' },
  { symbol: 'INDIGO', name: 'InterGlobe Aviation Ltd.', sector: 'Services' },
  { symbol: 'ADANIPORTS', name: 'Adani Ports & SEZ Ltd.', sector: 'Services' },
  { symbol: 'ULTRACEMCO', name: 'UltraTech Cement Ltd.', sector: 'Construction Materials' },
  { symbol: 'GRASIM', name: 'Grasim Industries Ltd.', sector: 'Construction Materials' },
  { symbol: 'DLF', name: 'DLF Ltd.', sector: 'Realty' },
  { symbol: 'LODHA', name: 'Macrotech Developers Ltd.', sector: 'Realty' },
];

let cachedConstituents: { list: Nse500Constituent[]; fetchedAt: number } | null = null;
const CONSTITUENTS_TTL_MS = 12 * 3600 * 1000;

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      out.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

function parseNifty500Csv(csvText: string): Nse500Constituent[] {
  const lines = csvText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 20) return [];
  const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
  const nameIdx = header.findIndex((h) => h.includes('company'));
  const sectorIdx = header.findIndex((h) => h.includes('industry'));
  const symIdx = header.findIndex((h) => h.includes('symbol'));
  if (symIdx === -1) return [];

  const seen = new Set<string>();
  const list: Nse500Constituent[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    const rawSym = (cols[symIdx] || '').trim().toUpperCase();
    if (!rawSym || rawSym.startsWith('DUMMY') || seen.has(rawSym)) continue;
    seen.add(rawSym);
    const name = (nameIdx >= 0 ? cols[nameIdx] : '') || rawSym;
    const sector = (sectorIdx >= 0 ? cols[sectorIdx] : '') || 'Other';
    list.push({ symbol: rawSym, name, sector });
  }
  return list;
}

export async function getNse500Constituents(): Promise<Nse500Constituent[]> {
  if (cachedConstituents && Date.now() - cachedConstituents.fetchedAt < CONSTITUENTS_TTL_MS) {
    return cachedConstituents.list;
  }

  const urls = [
    'https://www.niftyindices.com/IndexConstituent/ind_nifty500list.csv',
    'https://nsearchives.nseindia.com/content/indices/ind_nifty500list.csv',
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(7000),
        headers: { 'User-Agent': UA, Accept: 'text/csv,text/plain,*/*' },
      });
      if (!res.ok) continue;
      const text = await res.text();
      const parsed = parseNifty500Csv(text);
      if (parsed.length >= 250) {
        cachedConstituents = { list: parsed, fetchedAt: Date.now() };
        return parsed;
      }
    } catch {
    }
  }

  return FALLBACK_NSE500;
}

const num = (v: any): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const r2 = (n: number): number => Math.round(n * 100) / 100;

interface RawQuoteRow {
  price: number;
  change: number;
  changePct: number;
  dayHigh: number;
  dayLow: number;
  prevClose: number;
  volume: number;
  marketCap: number;
  name?: string;
}

async function fetchYahooBatchChunk(
  symbols: string[],
  auth: { cookie: string; crumb: string },
): Promise<Map<string, RawQuoteRow>> {
  const out = new Map<string, RawQuoteRow>();
  if (!symbols.length) return out;
  const yahooSyms = symbols.map((s) => `${s}.NS`).join(',');
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(yahooSyms)}&crumb=${encodeURIComponent(auth.crumb)}`;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(9000),
      headers: { 'User-Agent': UA, Cookie: auth.cookie, Accept: 'application/json' },
    });
    if (!res.ok) return out;
    const json = await res.json();
    const results: any[] = json?.quoteResponse?.result || [];
    for (const q of results) {
      const rawSym = String(q.symbol || '').toUpperCase().replace(/\.(NS|BO)$/, '');
      const price = num(q.regularMarketPrice);
      if (!rawSym || !(price > 0)) continue;
      const prevClose = num(q.regularMarketPreviousClose);
      const change = Number.isFinite(Number(q.regularMarketChange))
        ? num(q.regularMarketChange)
        : prevClose > 0
          ? price - prevClose
          : 0;
      const changePct = Number.isFinite(Number(q.regularMarketChangePercent))
        ? num(q.regularMarketChangePercent)
        : prevClose > 0
          ? (change / prevClose) * 100
          : 0;
      out.set(rawSym, {
        price: r2(price),
        change: r2(change),
        changePct: r2(changePct),
        dayHigh: r2(num(q.regularMarketDayHigh)),
        dayLow: r2(num(q.regularMarketDayLow)),
        prevClose: r2(prevClose),
        volume: num(q.regularMarketVolume),
        marketCap: num(q.marketCap),
        name: q.longName || q.shortName || undefined,
      });
    }
  } catch {
  }
  return out;
}

export async function fetchNse500HeatmapData(
  getYahooAuth: () => Promise<{ cookie: string; crumb: string } | null>,
): Promise<Nse500HeatmapPayload> {
  const constituents = await getNse500Constituents();
  const quoteMap = new Map<string, RawQuoteRow>();
  let sourceUsed = 'Yahoo Finance (Real-Time NSE Batch)';

  const auth = await getYahooAuth();
  if (auth) {
    const chunks: string[][] = [];
    for (let i = 0; i < constituents.length; i += 100) {
      chunks.push(constituents.slice(i, i + 100).map((c) => c.symbol));
    }
    const chunkResults = await Promise.all(chunks.map((c) => fetchYahooBatchChunk(c, auth)));
    for (const map of chunkResults) {
      for (const [sym, row] of map.entries()) {
        quoteMap.set(sym, row);
      }
    }
  }

  if (angelConfigured()) {
    const resolved: Array<{ symbol: string; token: string }> = [];
    for (const c of constituents) {
      const inst = resolveInstrument(c.symbol, 'NSE');
      if (inst && inst.exchange === 'NSE') {
        resolved.push({ symbol: c.symbol, token: inst.token });
      }
    }
    if (resolved.length > 0) {
      try {
        const angelQuotes = await fetchAngelQuoteBatch('NSE', resolved.map((r) => r.token));
        let angelHits = 0;
        for (const r of resolved) {
          const aq = angelQuotes.get(r.token);
          const ltp = num(aq?.ltp);
          if (!aq || !(ltp > 0)) continue;
          angelHits++;
          const prevClose = num(aq.close);
          const change = Number.isFinite(Number(aq.netChange))
            ? num(aq.netChange)
            : prevClose > 0
              ? ltp - prevClose
              : 0;
          const changePct = Number.isFinite(Number(aq.percentChange))
            ? num(aq.percentChange)
            : prevClose > 0
              ? (change / prevClose) * 100
              : 0;
          const existing = quoteMap.get(r.symbol);
          quoteMap.set(r.symbol, {
            price: r2(ltp),
            change: r2(change),
            changePct: r2(changePct),
            dayHigh: r2(num(aq.high) || existing?.dayHigh || ltp),
            dayLow: r2(num(aq.low) || existing?.dayLow || ltp),
            prevClose: r2(prevClose || existing?.prevClose || 0),
            volume: num(aq.tradeVolume) || existing?.volume || 0,
            marketCap: existing?.marketCap || 0,
            name: existing?.name,
          });
        }
        if (angelHits > 0) {
          sourceUsed = 'Angel One SmartAPI + NSE 500 Live';
        }
      } catch (e: any) {
        console.warn('[Heatmap] Angel One batch overlay skipped:', e?.message || e);
      }
    }
  }

  const stocks: HeatmapStock[] = [];
  for (const c of constituents) {
    const q = quoteMap.get(c.symbol);
    if (!q || !(q.price > 0)) continue;
    const turnover = Math.round(q.price * q.volume);
    const marketCap = q.marketCap > 0 ? Math.round(q.marketCap) : Math.max(turnover, 100_000_000);
    stocks.push({
      symbol: c.symbol,
      name: c.name || q.name || c.symbol,
      sector: c.sector || 'Other',
      price: q.price,
      change: q.change,
      changePct: q.changePct,
      dayHigh: q.dayHigh,
      dayLow: q.dayLow,
      prevClose: q.prevClose,
      volume: q.volume,
      marketCap,
      turnover,
    });
  }

  stocks.sort((a, b) => b.marketCap - a.marketCap);

  let advances = 0;
  let declines = 0;
  let unchanged = 0;
  let pctSum = 0;

  const sectorMap = new Map<
    string,
    {
      count: number;
      advances: number;
      declines: number;
      unchanged: number;
      pctSum: number;
      weightedNum: number;
      totalMcap: number;
    }
  >();

  for (const s of stocks) {
    pctSum += s.changePct;
    if (s.changePct > 0.01) advances++;
    else if (s.changePct < -0.01) declines++;
    else unchanged++;

    const sec = sectorMap.get(s.sector) || {
      count: 0,
      advances: 0,
      declines: 0,
      unchanged: 0,
      pctSum: 0,
      weightedNum: 0,
      totalMcap: 0,
    };
    sec.count++;
    if (s.changePct > 0.01) sec.advances++;
    else if (s.changePct < -0.01) sec.declines++;
    else sec.unchanged++;
    sec.pctSum += s.changePct;
    sec.weightedNum += s.changePct * s.marketCap;
    sec.totalMcap += s.marketCap;
    sectorMap.set(s.sector, sec);
  }

  const sectors: HeatmapSectorSummary[] = Array.from(sectorMap.entries())
    .map(([sector, d]) => ({
      sector,
      count: d.count,
      advances: d.advances,
      declines: d.declines,
      unchanged: d.unchanged,
      avgChangePct: d.count > 0 ? r2(d.pctSum / d.count) : 0,
      weightedChangePct: d.totalMcap > 0 ? r2(d.weightedNum / d.totalMcap) : 0,
      totalMarketCap: d.totalMcap,
    }))
    .sort((a, b) => b.totalMarketCap - a.totalMarketCap);

  if (stocks.length === 0) {
    return {
      success: false,
      indexName: 'NIFTY 500',
      source: sourceUsed,
      totalConstituents: constituents.length,
      loadedStocks: 0,
      advances: 0,
      declines: 0,
      unchanged: 0,
      avgChangePct: 0,
      fetchedAt: new Date().toISOString(),
      sectors: [],
      stocks: [],
      error: 'Live NSE 500 quote feed is temporarily unavailable. Please retry in a few seconds.',
    };
  }

  return {
    success: true,
    indexName: 'NIFTY 500',
    source: sourceUsed,
    totalConstituents: constituents.length,
    loadedStocks: stocks.length,
    advances,
    declines,
    unchanged,
    avgChangePct: r2(pctSum / stocks.length),
    fetchedAt: new Date().toISOString(),
    sectors,
    stocks,
  };
}
