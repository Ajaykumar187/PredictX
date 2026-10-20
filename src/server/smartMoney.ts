import type { Router } from 'express';

interface Helpers {
  getYahooAuth: () => Promise<{ cookie: string; crumb: string } | null>;
  resolveInitialTicker: (raw: string, marketHint?: string) => string;
  getCached: (key: string, ttlMs?: number) => any;
  setCache: (key: string, data: any) => void;
}

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

const num = (v: any): number | null => (typeof v?.raw === 'number' ? v.raw : typeof v === 'number' ? v : null);

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
      res.json({ success: false, rows: [], error: err?.message || 'FII/DII data abhi nahi mil paya' });
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
      res.json({ success: false, error: err?.message || 'Holders data nahi mil paya' });
    }
  });

  router.get('/stock/news/:symbol', async (req, res) => {
    const raw = req.params.symbol;
    const marketHint = (req.query.market as string) || '';
    if (!raw) return res.status(400).json({ success: false, error: 'Symbol required' });
    const ticker = h.resolveInitialTicker(raw, marketHint);
    const key = `news_v1_${ticker.toLowerCase()}`;
    const cached = h.getCached(key, 10 * 60 * 1000);
    if (cached) return res.json(cached);
    try {
      const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(ticker)}&quotesCount=0&newsCount=15`;
      const r = await fetch(url, { signal: AbortSignal.timeout(6000), headers: { 'User-Agent': UA } });
      if (!r.ok) throw new Error(`Yahoo responded ${r.status}`);
      const j = await r.json();
      const out = {
        success: true,
        source: 'Yahoo Finance',
        items: (j?.news || []).map((n: any) => ({
          title: String(n.title || ''),
          publisher: String(n.publisher || ''),
          link: String(n.link || ''),
          time: typeof n.providerPublishTime === 'number' ? n.providerPublishTime * 1000 : null,
        })),
      };
      h.setCache(key, out);
      res.json(out);
    } catch (err: any) {
      res.json({ success: false, items: [], error: err?.message || 'News nahi mil paya' });
    }
  });
}
