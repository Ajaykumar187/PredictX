import type { Router } from 'express';
import { getLanguageOption } from '../utils/languages.js';

interface Helpers {
  getYahooAuth: () => Promise<{ cookie: string; crumb: string } | null>;
  resolveInitialTicker: (raw: string, marketHint?: string) => string;
  getCached: (key: string, ttlMs?: number) => any;
  setCache: (key: string, data: any) => void;
}

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

const num = (v: any): number | null => (typeof v?.raw === 'number' ? v.raw : typeof v === 'number' ? v : null);

function decodeXml(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_m, n) => String.fromCharCode(Number(n)))
    .trim();
}

function parseGoogleNewsRss(xml: string): Array<{ title: string; publisher: string; link: string; time: number | null }> {
  const items: Array<{ title: string; publisher: string; link: string; time: number | null }> = [];
  const itemMatches = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
  for (const block of itemMatches) {
    const rawTitle = (block.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || '').trim();
    const rawLink = (block.match(/<link>([\s\S]*?)<\/link>/i)?.[1] || '').trim();
    const rawPubDate = (block.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)?.[1] || '').trim();
    const rawSource = (block.match(/<source[^>]*>([\s\S]*?)<\/source>/i)?.[1] || '').trim();

    let title = decodeXml(rawTitle);
    const publisher = decodeXml(rawSource) || 'Google News';
    if (publisher && title.endsWith(` - ${publisher}`)) {
      title = title.slice(0, -(` - ${publisher}`).length).trim();
    } else if (title.includes(' - ') && !rawSource) {
      const idx = title.lastIndexOf(' - ');
      if (idx > 25) title = title.slice(0, idx).trim();
    }

    const link = decodeXml(rawLink);
    const parsedTime = rawPubDate ? Date.parse(rawPubDate) : NaN;
    const time = Number.isFinite(parsedTime) ? parsedTime : null;

    if (title && link) {
      items.push({ title, publisher, link, time });
    }
  }
  return items;
}

function formatQuarterLabel(asOfDate: string): string {
  const m = asOfDate.match(/^(\d{4})-(\d{2})/);
  if (!m) return asOfDate;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${monthNames[Math.max(0, Math.min(11, month - 1))]} ${year}`;
}

function pctGrowth(curr: number | null, prev: number | null): number | null {
  if (curr === null || prev === null || !Number.isFinite(curr) || !Number.isFinite(prev) || Math.abs(prev) < 1e-6) {
    return null;
  }
  return Number((((curr - prev) / Math.abs(prev)) * 100).toFixed(2));
}

async function fetchNseFiiDii(): Promise<any[]> {
  const home = await fetch('https://www.nseindia.com/', {
    signal: AbortSignal.timeout(6000),
    headers: { 'User-Agent': UA, Accept: 'text/html' },
  });
  const raw = (home.headers as any).getSetCookie ? (home.headers as any).getSetCookie() : [home.headers.get('set-cookie') || ''];
  const cookie = raw.map((c: string) => c.split(';')[0]).filter(Boolean).join('; ');
  const res = await fetch('https://www.nseindia.com/api/fiidiiTradeReact', {
    signal: AbortSignal.timeout(6000),
    headers: { 'User-Agent': UA, Accept: 'application/json', Referer: 'https://www.nseindia.com/', Cookie: cookie },
  });
  if (!res.ok) throw new Error(`NSE responded ${res.status}`);
  const json = await res.json();
  if (!Array.isArray(json)) throw new Error('Unexpected NSE response');
  return json;
}

export function registerSmartMoney(router: Router, h: Helpers) {
  router.get('/market/fii-dii', async (_req, res) => {
    const key = 'fii_dii_v1';
    const cached = h.getCached(key, 15 * 60 * 1000);
    if (cached) return res.json(cached);
    try {
      const rows = await fetchNseFiiDii();
      const out = {
        success: true,
        source: 'NSE India',
        rows: rows.map((r: any) => ({
          category: String(r.category || ''),
          date: String(r.date || ''),
          buyValue: Number(r.buyValue),
          sellValue: Number(r.sellValue),
          netValue: Number(r.netValue),
        })),
      };
      h.setCache(key, out);
      res.json(out);
    } catch (err: any) {
      res.json({ success: false, rows: [], error: err?.message || 'FII/DII data is currently unavailable' });
    }
  });

  router.get('/stock/holders/:symbol', async (req, res) => {
    const raw = req.params.symbol;
    const marketHint = (req.query.market as string) || '';
    if (!raw) return res.status(400).json({ success: false, error: 'Symbol required' });
    const ticker = h.resolveInitialTicker(raw, marketHint);
    const key = `holders_v1_${ticker.toLowerCase()}`;
    const cached = h.getCached(key, 30 * 60 * 1000);
    if (cached) return res.json(cached);

    try {
      const auth = await h.getYahooAuth();
      if (!auth) throw new Error('Yahoo auth unavailable');
      const modules = 'majorHoldersBreakdown,institutionOwnership,insiderTransactions,calendarEvents';
      const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ticker)}?modules=${modules}&crumb=${encodeURIComponent(auth.crumb)}`;
      const r = await fetch(url, { signal: AbortSignal.timeout(6000), headers: { 'User-Agent': UA, Cookie: auth.cookie } });
      if (!r.ok) throw new Error(`Yahoo responded ${r.status}`);
      const j = await r.json();
      const d = j?.quoteSummary?.result?.[0] || {};
      const mh = d.majorHoldersBreakdown || {};
      const out = {
        success: true,
        source: 'Yahoo Finance',
        symbol: raw.toUpperCase(),
        insidersPct: num(mh.insidersPercentHeld),
        institutionsPct: num(mh.institutionsPercentHeld),
        institutionsCount: num(mh.institutionsCount),
        topInstitutions: (d.institutionOwnership?.ownershipList || []).slice(0, 8).map((o: any) => ({
          name: o.organization,
          pct: num(o.pctHeld),
          shares: num(o.position),
          reportDate: o.reportDate?.fmt || null,
        })),
        insiderTransactions: (d.insiderTransactions?.transactions || []).slice(0, 10).map((t: any) => ({
          name: t.filerName,
          relation: t.filerRelation,
          text: t.transactionText,
          shares: num(t.shares),
          value: num(t.value),
          date: t.startDate?.fmt || null,
        })),
        nextEarnings: d.calendarEvents?.earnings?.earningsDate?.[0]?.fmt || null,
        exDividendDate: d.calendarEvents?.exDividendDate?.fmt || null,
      };
      h.setCache(key, out);
      res.json(out);
    } catch (err: any) {
      res.json({ success: false, error: err?.message || 'Holders data is currently unavailable' });
    }
  });

  router.get('/stock/quarterly/:symbol', async (req, res) => {
    const raw = req.params.symbol;
    const marketHint = (req.query.market as string) || '';
    if (!raw) return res.status(400).json({ success: false, error: 'Symbol required' });
    const ticker = h.resolveInitialTicker(raw, marketHint);
    const key = `quarterly_v2_${ticker.toLowerCase()}`;
    const cached = h.getCached(key, 30 * 60 * 1000);
    if (cached) return res.json(cached);

    try {
      const nowSec = Math.floor(Date.now() / 1000);
      const startSec = nowSec - 3.5 * 365 * 24 * 3600;
      const types = [
        'quarterlyTotalRevenue',
        'quarterlyOperatingIncome',
        'quarterlyEBIT',
        'quarterlyNetIncome',
        'quarterlyDilutedEPS',
        'quarterlyBasicEPS',
      ].join(',');

      const auth = await h.getYahooAuth().catch(() => null);
      const tsUrl = `https://query1.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/${encodeURIComponent(ticker)}?type=${types}&period1=${startSec}&period2=${nowSec}`;

      const tsFetch = fetch(tsUrl, {
        signal: AbortSignal.timeout(7000),
        headers: auth ? { 'User-Agent': UA, Cookie: auth.cookie } : { 'User-Agent': UA },
      })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);

      const summaryFetch = auth
        ? fetch(
            `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ticker)}?modules=earnings,earningsHistory,financialData,defaultKeyStatistics,price,calendarEvents&crumb=${encodeURIComponent(auth.crumb)}`,
            { signal: AbortSignal.timeout(7000), headers: { 'User-Agent': UA, Cookie: auth.cookie } }
          )
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null)
        : Promise.resolve(null);

      const [tsJson, summaryJson] = await Promise.all([tsFetch, summaryFetch]);

      const summaryResult = summaryJson?.quoteSummary?.result?.[0] || {};
      const finData = summaryResult.financialData || {};
      const keyStats = summaryResult.defaultKeyStatistics || {};
      const priceObj = summaryResult.price || {};
      const currency = finData.financialCurrency || priceObj.currency || (ticker.endsWith('.NS') || ticker.endsWith('.BO') ? 'INR' : 'USD');

      const epsHistoryMap = new Map<string, { epsActual: number | null; epsEstimate: number | null; surprisePct: number | null; quarterLabel: string }>();
      for (const hItem of summaryResult.earningsHistory?.history || []) {
        const fmtDate = hItem?.quarter?.fmt;
        if (!fmtDate) continue;
        const ym = fmtDate.slice(0, 7);
        const rawSurprise = num(hItem.surprisePercent);
        epsHistoryMap.set(ym, {
          epsActual: num(hItem.epsActual),
          epsEstimate: num(hItem.epsEstimate),
          surprisePct: rawSurprise !== null ? Number((rawSurprise * 100).toFixed(2)) : null,
          quarterLabel: formatQuarterLabel(fmtDate),
        });
      }

      const byDate = new Map<
        string,
        {
          asOfDate: string;
          revenue: number | null;
          operatingIncome: number | null;
          netProfit: number | null;
          eps: number | null;
        }
      >();

      const tsList: any[] = tsJson?.timeseries?.result || [];
      for (const series of tsList) {
        const typeName = series?.meta?.type?.[0];
        if (!typeName || !Array.isArray(series[typeName])) continue;
        for (const pt of series[typeName]) {
          const asOf = pt?.asOfDate;
          const val = num(pt?.reportedValue);
          if (!asOf || val === null) continue;
          const row = byDate.get(asOf) || {
            asOfDate: asOf,
            revenue: null,
            operatingIncome: null,
            netProfit: null,
            eps: null,
          };
          if (typeName === 'quarterlyTotalRevenue') row.revenue = val;
          else if (typeName === 'quarterlyOperatingIncome') row.operatingIncome = val;
          else if (typeName === 'quarterlyEBIT' && row.operatingIncome === null) row.operatingIncome = val;
          else if (typeName === 'quarterlyNetIncome') row.netProfit = val;
          else if (typeName === 'quarterlyDilutedEPS') row.eps = val;
          else if (typeName === 'quarterlyBasicEPS' && row.eps === null) row.eps = val;
          byDate.set(asOf, row);
        }
      }

      let chronological = Array.from(byDate.values())
        .filter((r) => r.revenue !== null || r.netProfit !== null || r.eps !== null)
        .sort((a, b) => a.asOfDate.localeCompare(b.asOfDate));

      if (chronological.length < 2) {
        const chartQ: any[] = summaryResult.earnings?.financialsChart?.quarterly || [];
        if (chartQ.length > 0) {
          chronological = chartQ.map((qItem: any, idx: number) => ({
            asOfDate: String(qItem.date || `Q${idx + 1}`),
            revenue: num(qItem.revenue),
            operatingIncome: null,
            netProfit: num(qItem.earnings),
            eps: null,
          }));
        }
      }

      const quarters = chronological
        .map((row, idx) => {
          const prevQ = idx > 0 ? chronological[idx - 1] : null;
          const prevY = idx >= 4 ? chronological[idx - 4] : null;
          const ym = row.asOfDate.slice(0, 7);
          const epsMatch = epsHistoryMap.get(ym);

          const operatingMarginPct =
            row.revenue && row.operatingIncome !== null && row.revenue > 0
              ? Number(((row.operatingIncome / row.revenue) * 100).toFixed(2))
              : null;
          const netMarginPct =
            row.revenue && row.netProfit !== null && row.revenue > 0
              ? Number(((row.netProfit / row.revenue) * 100).toFixed(2))
              : null;

          return {
            period: /^\d{4}-\d{2}/.test(row.asOfDate) ? formatQuarterLabel(row.asOfDate) : row.asOfDate,
            asOfDate: row.asOfDate,
            revenue: row.revenue,
            revenueYoYPct: prevY ? pctGrowth(row.revenue, prevY.revenue) : null,
            revenueQoQPct: prevQ ? pctGrowth(row.revenue, prevQ.revenue) : null,
            operatingIncome: row.operatingIncome,
            operatingMarginPct,
            netProfit: row.netProfit,
            netProfitYoYPct: prevY ? pctGrowth(row.netProfit, prevY.netProfit) : null,
            netProfitQoQPct: prevQ ? pctGrowth(row.netProfit, prevQ.netProfit) : null,
            netMarginPct,
            epsActual: row.eps ?? epsMatch?.epsActual ?? null,
            epsEstimate: epsMatch?.epsEstimate ?? null,
            epsSurprisePct: epsMatch?.surprisePct ?? null,
          };
        })
        .slice(-10)
        .reverse();

      const out = {
        success: true,
        source: tsList.length > 0 ? 'Yahoo Fundamentals Timeseries' : 'Yahoo Finance Summary',
        symbol: raw.toUpperCase(),
        currency,
        currencySymbol: currency === 'INR' ? '₹' : '$',
        nextEarningsDate: summaryResult.calendarEvents?.earnings?.earningsDate?.[0]?.fmt || null,
        summaryMetrics: {
          profitMarginPct: num(finData.profitMargins) !== null ? Number((num(finData.profitMargins)! * 100).toFixed(2)) : null,
          operatingMarginPct: num(finData.operatingMargins) !== null ? Number((num(finData.operatingMargins)! * 100).toFixed(2)) : null,
          roePct: num(finData.returnOnEquity) !== null ? Number((num(finData.returnOnEquity)! * 100).toFixed(2)) : null,
          revenueGrowthYoYPct: num(finData.revenueGrowth) !== null ? Number((num(finData.revenueGrowth)! * 100).toFixed(2)) : null,
          earningsGrowthYoYPct: num(finData.earningsGrowth) !== null ? Number((num(finData.earningsGrowth)! * 100).toFixed(2)) : null,
          debtToEquity: num(finData.debtToEquity) !== null ? Number(num(finData.debtToEquity)!.toFixed(2)) : null,
          trailingEps: num(keyStats.trailingEps),
          forwardEps: num(keyStats.forwardEps),
        },
        quarters,
      };

      h.setCache(key, out);
      res.json(out);
    } catch (err: any) {
      res.json({
        success: false,
        symbol: raw.toUpperCase(),
        currency: 'USD',
        currencySymbol: '$',
        quarters: [],
        error: err?.message || 'Quarterly results are currently unavailable',
      });
    }
  });

  router.get('/stock/news/:symbol', async (req, res) => {
    const raw = req.params.symbol;
    const marketHint = (req.query.market as string) || '';
    const companyName = ((req.query.name as string) || '').trim();
    const rawLang = typeof req.query.lang === 'string' ? req.query.lang.trim().toLowerCase() : 'en';
    const langOpt = getLanguageOption(rawLang);
    const rawSector = typeof req.query.sector === 'string' ? req.query.sector.trim().toLowerCase() : 'all';
    const VALID_SECTORS = new Set(['all', 'markets', 'tech', 'global', 'commodities', 'banking', 'energy']);
    const sector = VALID_SECTORS.has(rawSector) ? rawSector : 'all';

    if (!raw) return res.status(400).json({ success: false, error: 'Symbol required' });

    const ticker = h.resolveInitialTicker(raw, marketHint);
    const cleanSym = raw.toUpperCase().replace(/\.(NS|BO)$/i, '').replace(/^\^/, '').trim();
    const isIndia = marketHint === 'NSE' || marketHint === 'BSE' || marketHint === 'INDEX' || ticker.endsWith('.NS') || ticker.endsWith('.BO') || ticker.startsWith('^');

    const key = `news_v4_${sector}_${isIndia ? 'in' : 'us'}_${sector === 'all' ? `${ticker.toLowerCase()}_${companyName.toLowerCase().slice(0, 24)}` : 'sector'}_${langOpt.code}`;
    const cached = h.getCached(key, 10 * 60 * 1000);
    if (cached) return res.json(cached);

    const SECTOR_QUERIES: Record<string, { yahoo: string; google: string }> = {
      markets: {
        yahoo: isIndia ? 'Nifty Sensex India stock market' : 'S&P 500 Nasdaq Wall Street market',
        google: isIndia
          ? 'Indian stock market Nifty Sensex equity markets news'
          : 'US stock market S&P 500 Nasdaq Wall Street news',
      },
      tech: {
        yahoo: isIndia ? 'India IT tech AI stocks TCS Infosys' : 'technology AI semiconductor stocks',
        google: isIndia
          ? 'India IT technology AI software semiconductor stocks news'
          : 'technology AI semiconductor cloud software stocks news',
      },
      global: {
        yahoo: 'global stock markets Federal Reserve economy',
        google: 'global financial markets central banks Fed macro economy news',
      },
      commodities: {
        yahoo: 'gold silver crude oil commodities futures',
        google: isIndia
          ? 'MCX gold silver crude oil metals commodities price news'
          : 'gold silver crude oil copper commodities market news',
      },
      banking: {
        yahoo: isIndia ? 'India banking RBI HDFC ICICI bank stocks' : 'US banking Federal Reserve bank stocks',
        google: isIndia
          ? 'India banking RBI NBFC financial services bank stocks news'
          : 'banking financial services Fed interest rates bank stocks news',
      },
      energy: {
        yahoo: isIndia ? 'India oil gas renewable power energy stocks' : 'oil gas renewable energy stocks',
        google: isIndia
          ? 'India oil gas solar renewable power energy stocks news'
          : 'oil gas renewable energy power utility stocks news',
      },
    };

    const searchPhrase =
      sector !== 'all' && SECTOR_QUERIES[sector]
        ? SECTOR_QUERIES[sector].google
        : companyName && companyName.toUpperCase() !== cleanSym
          ? `${companyName} ${isIndia ? 'share price news' : 'stock news'}`
          : `${cleanSym} ${isIndia ? 'NSE stock news' : 'stock news'}`;

    const inferSector = (title: string): string => {
      if (sector !== 'all') return sector;
      const lower = title.toLowerCase();
      if (/(gold|silver|crude|oil|brent|wti|copper|mcx|bullion|commodity|commodities|metal|steel|zinc|aluminium|aluminum|natural gas|wheat|cotton)/.test(lower)) {
        return 'commodities';
      }
      if (/(ai\b|artificial intelligence|software|semiconductor|chip|cloud|tech|it sector|saas|cyber|data center|nvidia|apple|microsoft|google|meta|infosys|tcs|wipro|hcl)/.test(lower)) {
        return 'tech';
      }
      if (/(rbi|bank|banking|nbfc|credit|lending|loan|hdfc|icici|sbi|kotak|axis bank|fintech|deposit|net interest|npa|jpmorgan|goldman)/.test(lower)) {
        return 'banking';
      }
      if (/(renewable|solar|wind|ev\b|electric vehicle|power|grid|refinery|petrochemical|biogas|hydrogen|ongc|ntpc|coal|energy|fuel|opec)/.test(lower)) {
        return 'energy';
      }
      if (/(fed\b|federal reserve|wall street|nasdaq|dow jones|s&p 500|europe|china|japan|nikkei|ftse|global|tariff|geopolit|imf|world bank|forex|dollar|us treasury|ecb)/.test(lower)) {
        return 'global';
      }
      return 'markets';
    };

    type RawNewsItem = {
      title: string;
      publisher: string;
      link: string;
      time: number | null;
      language: string;
      isRegionalSource?: boolean;
      sector?: string;
    };

    const yahooSearch = (qStr: string) =>
      fetch(`https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(qStr)}&quotesCount=0&newsCount=12`, {
        signal: AbortSignal.timeout(5500),
        headers: { 'User-Agent': UA },
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) =>
          (j?.news || []).map((n: any): RawNewsItem => {
            const title = String(n.title || '').trim();
            return {
              title,
              publisher: String(n.publisher || 'Yahoo Finance').trim(),
              link: String(n.link || '').trim(),
              time: typeof n.providerPublishTime === 'number' ? n.providerPublishTime * 1000 : null,
              language: 'en',
              isRegionalSource: false,
              sector: inferSector(title),
            };
          })
        )
        .catch(() => [] as RawNewsItem[]);

    const fetchGoogleRss = (hl: string, gl: string, ceid: string, langCode: string, isRegional: boolean) => {
      const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(searchPhrase)}&hl=${encodeURIComponent(hl)}&gl=${encodeURIComponent(gl)}&ceid=${encodeURIComponent(ceid)}`;
      return fetch(rssUrl, {
        signal: AbortSignal.timeout(6000),
        headers: { 'User-Agent': UA, Accept: 'application/rss+xml, application/xml, text/xml' },
      })
        .then((r) => (r.ok ? r.text() : ''))
        .then((xml) =>
          xml
            ? parseGoogleNewsRss(xml).map((item): RawNewsItem => ({
                ...item,
                language: langCode,
                isRegionalSource: isRegional,
                sector: inferSector(item.title),
              }))
            : []
        )
        .catch(() => [] as RawNewsItem[]);
    };

    const enHl = sector === 'global' ? 'en-US' : isIndia ? 'en-IN' : 'en-US';
    const enGl = sector === 'global' ? 'US' : isIndia ? 'IN' : 'US';
    const enCeid = sector === 'global' ? 'US:en' : isIndia ? 'IN:en' : 'US:en';

    try {
      const yahooPrimaryQuery = sector !== 'all' && SECTOR_QUERIES[sector] ? SECTOR_QUERIES[sector].yahoo : ticker;
      const yahooSecondaryQuery =
        sector === 'all' && companyName && companyName.toUpperCase() !== cleanSym ? companyName : '';

      const [yahooTickerNews, yahooNameNews, englishGoogleNews, regionalGoogleNews] = await Promise.all([
        yahooSearch(yahooPrimaryQuery),
        yahooSecondaryQuery ? yahooSearch(yahooSecondaryQuery) : Promise.resolve([] as RawNewsItem[]),
        fetchGoogleRss(enHl, enGl, enCeid, 'en', false),
        langOpt.code !== 'en'
          ? fetchGoogleRss(
              langOpt.googleNews.hl,
              langOpt.googleNews.gl,
              langOpt.googleNews.ceid,
              langOpt.code,
              true
            )
          : Promise.resolve([] as RawNewsItem[]),
      ]);

      const combined = [...regionalGoogleNews, ...yahooTickerNews, ...yahooNameNews, ...englishGoogleNews];
      const seen = new Set<string>();
      const deduped: RawNewsItem[] = [];

      for (const item of combined) {
        if (!item.title || !item.link) continue;
        const normKey = item.title.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '').slice(0, 64);
        if (!normKey || seen.has(normKey)) continue;
        seen.add(normKey);
        deduped.push(item);
      }

      let finalItems: RawNewsItem[];
      if (langOpt.code !== 'en' && regionalGoogleNews.length > 0) {
        const regionalItems = deduped
          .filter((item) => item.isRegionalSource)
          .sort((a, b) => (b.time || 0) - (a.time || 0))
          .slice(0, 10);
        const globalItems = deduped
          .filter((item) => !item.isRegionalSource)
          .sort((a, b) => (b.time || 0) - (a.time || 0))
          .slice(0, Math.max(8, 18 - regionalItems.length));
        finalItems = [...regionalItems, ...globalItems].slice(0, 18);
      } else {
        deduped.sort((a, b) => (b.time || 0) - (a.time || 0));
        finalItems = deduped.slice(0, 18);
      }

      const usedYahoo = yahooTickerNews.length > 0 || yahooNameNews.length > 0;
      const usedGoogle = englishGoogleNews.length > 0 || regionalGoogleNews.length > 0;
      const regionalCount = finalItems.filter((item) => item.isRegionalSource).length;
      const source =
        regionalCount > 0 && usedYahoo
          ? `Regional ${langOpt.name} News & Yahoo Finance`
          : regionalCount > 0
          ? `Regional ${langOpt.name} News`
          : usedYahoo && usedGoogle
          ? 'Yahoo Finance & Google News'
          : usedGoogle
          ? 'Google Finance News'
          : 'Yahoo Finance';

      const out = {
        success: true,
        source,
        language: langOpt.code,
        sector,
        regionalCount,
        items: finalItems,
      };
      h.setCache(key, out);
      res.json(out);
    } catch (err: any) {
      res.json({ success: false, items: [], error: err?.message || 'News is currently unavailable' });
    }
  });
}
