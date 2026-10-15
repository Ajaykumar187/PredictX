import crypto from 'crypto';
import angelMap from './angelMap.js';

const BASE = process.env.ANGEL_BASE_URL || 'https://apiconnect.angelone.in';

type Session = { jwt: string; feed: string; refresh: string; at: number };
let session: Session | null = null;
let loginInFlight: Promise<Session> | null = null;
const SESSION_TTL_MS = 5 * 60 * 60 * 1000;

export function angelConfigured() {
  return !!(process.env.ANGEL_API_KEY && process.env.ANGEL_CLIENT_CODE && process.env.ANGEL_PIN && process.env.ANGEL_TOTP_SECRET);
}

function base32Decode(s: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const clean = s.replace(/[\s=-]/g, '').toUpperCase();
  let bits = 0, value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = alphabet.indexOf(ch);
    if (idx < 0) throw new Error('ANGEL_TOTP_SECRET is not valid base32');
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function generateTotp(secret: string, now = Date.now()): string {
  const counter = Math.floor(now / 1000 / 30);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const h = crypto.createHmac('sha1', base32Decode(secret)).update(buf).digest();
  const off = h[h.length - 1] & 0xf;
  const code = ((h[off] & 0x7f) << 24) | (h[off + 1] << 16) | (h[off + 2] << 8) | h[off + 3];
  return String(code % 1_000_000).padStart(6, '0');
}

function headers(auth?: string) {
  const h: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'X-UserType': 'USER',
    'X-SourceID': 'WEB',
    'X-ClientLocalIP': '127.0.0.1',
    'X-ClientPublicIP': '127.0.0.1',
    'X-MACAddress': '00:00:00:00:00:00',
    'X-PrivateKey': process.env.ANGEL_API_KEY || '',
  };
  if (auth) h.Authorization = `Bearer ${auth}`;
  return h;
}

async function login(): Promise<Session> {
  const res = await fetch(`${BASE}/rest/auth/angelbroking/user/v1/loginByPassword`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      clientcode: process.env.ANGEL_CLIENT_CODE,
      password: process.env.ANGEL_PIN,
      totp: generateTotp(process.env.ANGEL_TOTP_SECRET!),
    }),
    signal: AbortSignal.timeout(8000),
  });
  const json: any = await res.json().catch(() => ({}));
  if (!json?.status || !json?.data?.jwtToken) {
    throw new Error(`Angel login failed: ${json?.message || res.status} (${json?.errorcode || 'no-code'})`);
  }
  return { jwt: json.data.jwtToken, feed: json.data.feedToken, refresh: json.data.refreshToken, at: Date.now() };
}

async function getSession(force = false): Promise<Session> {
  if (!force && session && Date.now() - session.at < SESSION_TTL_MS) return session;
  if (!loginInFlight) {
    loginInFlight = login().then((s) => (session = s)).finally(() => { loginInFlight = null; });
  }
  return loginInFlight;
}

export async function authedPost(path: string, body: any, retry = true): Promise<any> {
  const s = await getSession();
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: headers(s.jwt),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });
  const json: any = await res.json().catch(() => ({}));
  const tokenBad = res.status === 401 || ['AG8001', 'AG8002', 'AB8050', 'AB8051'].includes(json?.errorcode);
  if (tokenBad && retry) {
    await getSession(true);
    return authedPost(path, body, false);
  }
  if (!json?.status) throw new Error(`Angel ${path} failed: ${json?.message || res.status} (${json?.errorcode || 'no-code'})`);
  return json.data;
}

export interface AngelInstrument { exchange: 'NSE' | 'BSE'; token: string; name: string; isIndex: boolean; symbol: string }

export function resolveInstrument(raw: string, marketHint?: string): AngelInstrument | null {
  if (marketHint === 'US') return null;
  const m: any = angelMap;
  const up = raw.trim().toUpperCase().replace(/\.(NS|BO)$/, '');
  const aliases: Record<string, string> = {
    NIFTY50: 'NIFTY', 'NIFTY 50': 'NIFTY', 'BANK NIFTY': 'BANKNIFTY', 'BSE SENSEX': 'SENSEX',
    TATAMOTORS: 'TMPV', ZOMATO: 'ETERNAL',
  };
  const sym = aliases[up] || up;
  const idx = m.INDEX[sym];
  if (idx) return { exchange: idx[0], token: idx[1], name: sym, isIndex: true, symbol: sym };
  const preferBse = marketHint === 'BSE' || raw.toUpperCase().endsWith('.BO');
  const order: Array<'NSE' | 'BSE'> = preferBse ? ['BSE', 'NSE'] : ['NSE', 'BSE'];
  for (const ex of order) {
    const hit = m[ex][sym];
    if (hit) return { exchange: ex, token: hit[0], name: hit[1], isIndex: false, symbol: sym };
  }
  return null;
}

function istDate(d: Date, endOfDay = false) {
  const ist = new Date(d.getTime() + 5.5 * 3600 * 1000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${ist.getUTCFullYear()}-${p(ist.getUTCMonth() + 1)}-${p(ist.getUTCDate())} ${endOfDay ? '23:59' : '09:00'}`;
}

export async function fetchAngelQuote(inst: AngelInstrument) {
  const data = await authedPost('/rest/secure/angelbroking/market/v1/quote/', {
    mode: 'FULL',
    exchangeTokens: { [inst.exchange]: [inst.token] },
  });
  const q = data?.fetched?.[0];
  if (!q || !(Number(q.ltp) > 0)) throw new Error(`Angel returned no quote for ${inst.exchange}:${inst.symbol}`);
  return q;
}

export async function fetchAngelBars(inst: AngelInstrument, days = 200) {
  const now = new Date();
  const from = new Date(now.getTime() - days * 86400000);
  const data = await authedPost('/rest/secure/angelbroking/historical/v1/getCandleData', {
    exchange: inst.exchange,
    symboltoken: inst.token,
    interval: 'ONE_DAY',
    fromdate: istDate(from),
    todate: istDate(now, true),
  });
  return (Array.isArray(data) ? data : []).map((c: any[]) => ({
    date: String(c[0]).slice(0, 10),
    open: Number(Number(c[1]).toFixed(2)),
    high: Number(Number(c[2]).toFixed(2)),
    low: Number(Number(c[3]).toFixed(2)),
    close: Number(Number(c[4]).toFixed(2)),
    volume: Math.round(Number(c[5]) || 0),
  }));
}

export async function angelStatus() {
  const env = {
    ANGEL_API_KEY: !!process.env.ANGEL_API_KEY,
    ANGEL_CLIENT_CODE: !!process.env.ANGEL_CLIENT_CODE,
    ANGEL_PIN: !!process.env.ANGEL_PIN,
    ANGEL_TOTP_SECRET: !!process.env.ANGEL_TOTP_SECRET,
  };
  if (!angelConfigured()) return { ok: false, stage: 'env', env, error: 'Missing env vars (true = set)' };
  try {
    await getSession(true);
  } catch (e: any) {
    return { ok: false, stage: 'login', env, error: e.message };
  }
  try {
    const inst = resolveInstrument('RELIANCE')!;
    const q = await fetchAngelQuote(inst);
    let bars = 0, barsError: string | null = null;
    try { bars = (await fetchAngelBars(inst, 30)).length; } catch (e: any) { barsError = e.message; }
    return { ok: true, stage: 'quote', env, sample: { symbol: 'RELIANCE', ltp: q.ltp }, candles: bars, candlesError: barsError };
  } catch (e: any) {
    return { ok: false, stage: 'quote', env, error: e.message };
  }
}

export async function fetchAngelQuoteBatch(exchange: string, tokens: string[]): Promise<Map<string, any>> {
  const out = new Map<string, any>();
  for (let i = 0; i < tokens.length; i += 50) {
    const data = await authedPost('/rest/secure/angelbroking/market/v1/quote/', {
      mode: 'FULL',
      exchangeTokens: { [exchange]: tokens.slice(i, i + 50) },
    });
    for (const q of data?.fetched || []) out.set(String(q.symbolToken), q);
  }
  return out;
}
