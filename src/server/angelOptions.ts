import { authedPost, fetchAngelQuote, resolveInstrument } from './angel.js';
import angelOptionsMap, { type OptionMap } from './angelOptionsMap.js';

const SCRIP_MASTER_URL =
  process.env.ANGEL_SCRIP_MASTER_URL || 'https://margincalculator.angelone.in/OpenAPI_File/files/OpenAPIScripMaster.json';
const MASTER_TTL_MS = 6 * 3600 * 1000;
const MON: Record<string, string> = { JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06', JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12' };
const MON_REV = Object.fromEntries(Object.entries(MON).map(([k, v]) => [v, k]));

export const todayIST = () => new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);

let liveMaster: { at: number; map: OptionMap } | null = null;
let masterInFlight: Promise<OptionMap | null> | null = null;

async function downloadMaster(): Promise<OptionMap | null> {
  try {
    const res = await fetch(SCRIP_MASTER_URL, { signal: AbortSignal.timeout(40000) });
    if (!res.ok) return null;
    const rows: any[] = await res.json();
    const out: OptionMap = {};
    for (const x of rows) {
      if (x.exch_seg !== 'NFO' || (x.instrumenttype !== 'OPTIDX' && x.instrumenttype !== 'OPTSTK')) continue;
      const m = /^(\d{2})([A-Z]{3})(\d{4})$/.exec(x.expiry);
      const kind = String(x.symbol).endsWith('CE') ? 1 : String(x.symbol).endsWith('PE') ? 2 : 0;
      if (!m || !kind) continue;
      const iso = `${m[3]}-${MON[m[2]]}-${m[1]}`;
      const strike = Math.round((Number(x.strike) / 100) * 100) / 100;
      const u = (out[x.name] ||= { lot: Number(x.lotsize) || 0, e: {} });
      const list = (u.e[iso] ||= []);
      let row = list.find((r) => r[0] === strike);
      if (!row) list.push((row = [strike, '', '']));
      row[kind] = x.token;
    }
    for (const u of Object.values(out)) for (const l of Object.values(u.e)) l.sort((a, b) => a[0] - b[0]);
    return Object.keys(out).length ? out : null;
  } catch (e: any) {
    console.warn('[Angel][Options] scrip master download failed:', e?.message || e);
    return null;
  }
}

async function getMaster(): Promise<OptionMap> {
  if (liveMaster && Date.now() - liveMaster.at < MASTER_TTL_MS) return liveMaster.map;
  if (!masterInFlight) masterInFlight = downloadMaster().finally(() => { masterInFlight = null; });
  const fresh = await masterInFlight;
  if (fresh) {
    liveMaster = { at: Date.now(), map: fresh };
    return fresh;
  }
  if (liveMaster) return liveMaster.map; 
  liveMaster = { at: Date.now() - MASTER_TTL_MS + 10 * 60 * 1000, map: angelOptionsMap }; 
  return angelOptionsMap;
}

const prevOi = new Map<string, { oi: number; day: string }>();
const oiQueue: string[] = [];
let oiWorker = false;

async function fetchPrevOi(token: string) {
  const now = new Date(Date.now() + 5.5 * 3600 * 1000);
  const from = new Date(now.getTime() - 7 * 86400000);
  const fmt = (d: Date, t: string) => `${d.toISOString().slice(0, 10)} ${t}`;
  const data = await authedPost('/rest/secure/angelbroking/historical/v1/getOIData', {
    exchange: 'NFO', symboltoken: token, interval: 'ONE_DAY', fromdate: fmt(from, '09:00'), todate: fmt(now, '23:59'),
  });
  const rows: any[] = Array.isArray(data) ? data : [];
  if (rows.length < 2) return;
  const today = todayIST();
  const last = rows[rows.length - 1];
  const lastDay = String(last.time || '').slice(0, 10);
  const prev = lastDay === today ? rows[rows.length - 2] : last;
  const oi = Number(prev?.oi);
  if (Number.isFinite(oi)) prevOi.set(token, { oi, day: today });
}

function queuePrevOi(tokens: string[]) {
  const today = todayIST();
  for (const t of tokens) if (t && prevOi.get(t)?.day !== today && !oiQueue.includes(t)) oiQueue.push(t);
  if (oiWorker || !oiQueue.length) return;
  oiWorker = true;
  (async () => {
    let fails = 0;
    while (oiQueue.length && fails < 5) {
      const batch = oiQueue.splice(0, 3);
      const results = await Promise.allSettled(batch.map(fetchPrevOi));
      fails += results.filter((r) => r.status === 'rejected').length;
      await new Promise((r) => setTimeout(r, 1100));
    }
    oiQueue.length = 0;
    oiWorker = false;
  })().catch(() => { oiWorker = false; });
}

async function quoteTokens(tokens: string[]): Promise<Map<string, any>> {
  const out = new Map<string, any>();
  for (let i = 0; i < tokens.length; i += 50) {
    const data = await authedPost('/rest/secure/angelbroking/market/v1/quote/', {
      mode: 'FULL',
      exchangeTokens: { NFO: tokens.slice(i, i + 50) },
    });
    for (const q of data?.fetched || []) out.set(String(q.symbolToken), q);
  }
  return out;
}

async function fetchGreeks(name: string, iso: string): Promise<Map<string, { iv: number; delta: number; theta: number }>> {
  const out = new Map<string, { iv: number; delta: number; theta: number }>();
  try {
    const [y, m, d] = iso.split('-');
    const data = await authedPost('/rest/secure/angelbroking/marketData/v1/optionGreek', {
      name, expirydate: `${d}${MON_REV[m]}${y}`,
    });
    for (const g of Array.isArray(data) ? data : []) {
      const k = `${Math.round(Number(g.strikePrice) * 100) / 100}_${g.optionType}`;
      out.set(k, { iv: Number(g.impliedVolatility) || 0, delta: Number(g.delta) || 0, theta: Number(g.theta) || 0 });
    }
  } catch (e: any) {
    console.warn('[Angel][Options] greeks unavailable:', e?.message || e);
  }
  return out;
}

const ALIASES: Record<string, string> = {
  'NIFTY 50': 'NIFTY', NIFTY50: 'NIFTY', NSEI: 'NIFTY',
  'BANK NIFTY': 'BANKNIFTY', NSEBANK: 'BANKNIFTY', 'NIFTY BANK': 'BANKNIFTY',
  'FIN NIFTY': 'FINNIFTY', NIFTY_FIN_SERVICE: 'FINNIFTY', 'NIFTY FIN SERVICE': 'FINNIFTY',
  'MIDCAP NIFTY': 'MIDCPNIFTY', 'NIFTY MID SELECT': 'MIDCPNIFTY',
  TATAMOTORS: 'TMPV', ZOMATO: 'ETERNAL',
};

export interface AngelChainResult {
  symbol: string; spotPrice: number; dayChange: number; dayChangePerc: number;
  expiry: string; expiries: string[]; lotSize: number; strikeStep: number;
  rows: Array<{
    strike: number;
    ce: { ltp: number; oi: number; vol: number; chg: number; chgPct: number; oiChg: number; oiChgPct: number; iv: number | null; delta: number | null; theta: number | null; token: string };
    pe: { ltp: number; oi: number; vol: number; chg: number; chgPct: number; oiChg: number; oiChgPct: number; iv: number | null; delta: number | null; theta: number | null; token: string };
  }>;
  hasOiChange: boolean;
}

export async function fetchAngelOptionChain(rawSymbol: string, expiryParam: string, window = 25): Promise<AngelChainResult> {
  const up = rawSymbol.trim().toUpperCase().replace(/\.(NS|BO)$/, '').replace(/^\^/, '');
  const name = ALIASES[up] || up;
  const master = await getMaster();
  const und = master[name];
  if (!und) throw new Error(`No F&O contracts found for "${name}" in Angel scrip master`);

  const today = todayIST();
  const expiries = Object.keys(und.e).filter((e) => e >= today).sort();
  if (!expiries.length) throw new Error(`No upcoming expiries for ${name} (scrip master is stale — rerun scripts/build-angel-map.mjs)`);
  const expiry = expiryParam && expiries.includes(expiryParam.slice(0, 10)) ? expiryParam.slice(0, 10) : expiries[0];

  const inst = resolveInstrument(name);
  if (!inst) throw new Error(`Angel has no spot instrument for ${name}`);
  const spotQ = await fetchAngelQuote(inst);
  const spot = Number(spotQ.ltp);
  const dayChange = Number(spotQ.netChange ?? 0);
  const dayChangePerc = Number(spotQ.percentChange ?? 0);

  const all = und.e[expiry];
  let atmIdx = 0;
  all.forEach((r, i) => { if (Math.abs(r[0] - spot) < Math.abs(all[atmIdx][0] - spot)) atmIdx = i; });
  const slice = all.slice(Math.max(0, atmIdx - window), atmIdx + window + 1);

  const tokens = slice.flatMap((r) => [r[1], r[2]]).filter(Boolean);
  const [quotes, greeks] = await Promise.all([quoteTokens(tokens), fetchGreeks(name, expiry)]);
  queuePrevOi(
    [...slice].sort((a, b) => Math.abs(a[0] - spot) - Math.abs(b[0] - spot)).flatMap((r) => [r[1], r[2]])
  );

  let hasOiChange = false;
  const side = (token: string, strike: number, type: 'CE' | 'PE') => {
    const q = quotes.get(token) || {};
    const oi = Number(q.opnInterest) || 0;
    const base = prevOi.get(token);
    const oiChg = base ? oi - base.oi : 0;
    if (base) hasOiChange = true;
    const g = greeks.get(`${strike}_${type}`);
    return {
      ltp: Number(q.ltp) || 0, oi, vol: Number(q.tradeVolume) || 0,
      chg: Number(q.netChange) || 0, chgPct: Number(q.percentChange) || 0,
      oiChg, oiChgPct: base && base.oi > 0 ? Number(((oiChg / base.oi) * 100).toFixed(2)) : 0,
      iv: g?.iv ?? null, delta: g?.delta ?? null, theta: g?.theta ?? null, token,
    };
  };

  const rows = slice.map((r) => ({ strike: r[0], ce: side(r[1], r[0], 'CE'), pe: side(r[2], r[0], 'PE') }));
  const gaps = slice.slice(1).map((r, i) => r[0] - slice[i][0]).sort((a, b) => a - b);
  return {
    symbol: name, spotPrice: spot, dayChange, dayChangePerc, expiry, expiries, lotSize: und.lot,
    strikeStep: gaps.length ? gaps[Math.floor(gaps.length / 2)] : 50, rows, hasOiChange,
  };
}
