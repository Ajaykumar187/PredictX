import type { Request, Response, Router } from 'express';
import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export interface ServerUserRecord {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  passwordSalt: string;
  phone: string;
  emailAlertsEnabled: boolean;
  smsAlertsEnabled: boolean;
  createdAt: string;
  logins: string[];
}

interface ServerSessionRecord {
  tokenHash: string;
  email: string;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: number;
}

interface AuthStoreData {
  users: Record<string, ServerUserRecord>;
  sessions: Record<string, ServerSessionRecord>;
  revokedTokens: Record<string, number>;
}

export interface PublicAuthUser {
  id: string;
  username: string;
  email: string;
  phone: string;
  emailAlertsEnabled: boolean;
  smsAlertsEnabled: boolean;
  createdAt: string;
  logins: string[];
}

interface SignedSessionPayload {
  v: 1;
  id: string;
  u: string;
  e: string;
  p: string;
  ea: boolean;
  sa: boolean;
  ca: string;
  exp: number;
}

interface CompactVaultUser {
  id: string;
  u: string;
  e: string;
  ph: string;
  ps: string;
  p: string;
  ea: boolean;
  sa: boolean;
  ca: string;
  ll?: string;
}

interface SignedVaultPayload {
  v: 1;
  a: CompactVaultUser[];
}

const SESSION_COOKIE_NAME = 'predictx_sid';
const VAULT_COOKIE_NAME = 'predictx_vault';
const SESSION_MAX_AGE_SEC = 365 * 24 * 60 * 60; 
const SESSION_TTL_MS = SESSION_MAX_AGE_SEC * 1000;
const LAST_SEEN_TOUCH_MS = 10 * 60 * 1000;
const MAX_VAULT_ACCOUNTS = 3;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[A-Za-z0-9_.-]{3,24}$/;

const EPHEMERAL_FALLBACK_SECRET = randomBytes(32).toString('hex');

function getSigningKey(): Buffer {
  const configured =
    (process.env.AUTH_SECRET || '').trim() ||
    (process.env.SESSION_SECRET || '').trim() ||
    (process.env.CRON_SECRET || '').trim() ||
    (process.env.SUPABASE_SERVICE_KEY || '').trim();
  return createHash('sha256')
    .update(`${configured || EPHEMERAL_FALLBACK_SECRET}:predictx-auth-v1`)
    .digest();
}

// Optional Supabase persistence when SUPABASE_URL + SUPABASE_SERVICE_KEY are configured
function getSupabaseConfig(): { url: string; key: string } | null {
  const url = (process.env.SUPABASE_URL || '').trim().replace(/\/$/, '');
  const key = (process.env.SUPABASE_SERVICE_KEY || '').trim();
  if (!url || !key) return null;
  return { url, key };
}

async function supabaseFindUserByEmail(email: string): Promise<ServerUserRecord | null> {
  const cfg = getSupabaseConfig();
  if (!cfg) return null;
  try {
    const res = await fetch(
      `${cfg.url}/rest/v1/auth_users?select=*&email=eq.${encodeURIComponent(email)}&limit=1`,
      {
        signal: AbortSignal.timeout(4000),
        headers: {
          apikey: cfg.key,
          Authorization: `Bearer ${cfg.key}`,
          'Content-Type': 'application/json',
        },
      }
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as any[];
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row || !row.email || !row.password_hash || !row.password_salt) return null;
    return {
      id: String(row.id || randomBytes(12).toString('hex')),
      username: String(row.username || ''),
      email: String(row.email).toLowerCase(),
      passwordHash: String(row.password_hash),
      passwordSalt: String(row.password_salt),
      phone: String(row.phone || ''),
      emailAlertsEnabled: Boolean(row.email_alerts_enabled ?? true),
      smsAlertsEnabled: Boolean(row.sms_alerts_enabled ?? false),
      createdAt: String(row.created_at || new Date().toISOString()),
      logins: Array.isArray(row.logins) ? row.logins.slice(0, 20) : [],
    };
  } catch {
    return null;
  }
}

async function supabaseFindUserByUsername(username: string): Promise<boolean> {
  const cfg = getSupabaseConfig();
  if (!cfg) return false;
  try {
    const res = await fetch(
      `${cfg.url}/rest/v1/auth_users?select=email&username=ilike.${encodeURIComponent(username)}&limit=1`,
      {
        signal: AbortSignal.timeout(4000),
        headers: {
          apikey: cfg.key,
          Authorization: `Bearer ${cfg.key}`,
          'Content-Type': 'application/json',
        },
      }
    );
    if (!res.ok) return false;
    const rows = (await res.json()) as any[];
    return Array.isArray(rows) && rows.length > 0;
  } catch {
    return false;
  }
}

async function supabaseUpsertUser(user: ServerUserRecord): Promise<void> {
  const cfg = getSupabaseConfig();
  if (!cfg || !user.passwordHash || !user.passwordSalt) return;
  try {
    await fetch(`${cfg.url}/rest/v1/auth_users?on_conflict=email`, {
      method: 'POST',
      signal: AbortSignal.timeout(4000),
      headers: {
        apikey: cfg.key,
        Authorization: `Bearer ${cfg.key}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify({
        id: user.id,
        email: user.email,
        username: user.username,
        password_hash: user.passwordHash,
        password_salt: user.passwordSalt,
        phone: user.phone || '',
        email_alerts_enabled: Boolean(user.emailAlertsEnabled),
        sms_alerts_enabled: Boolean(user.smsAlertsEnabled),
        created_at: user.createdAt,
        logins: (user.logins || []).slice(0, 20),
      }),
    });
  } catch {
  }
}

function resolveStorePath(): string {
  if (process.env.VERCEL) {
    return path.join(os.tmpdir(), 'predictx-auth-store.json');
  }
  return path.resolve(process.cwd(), '.predictx-data', 'auth-store.json');
}

const PRIMARY_STORE_PATH = resolveStorePath();
const TMP_STORE_PATH = path.join(os.tmpdir(), 'predictx-auth-store.json');
let activeStorePath = PRIMARY_STORE_PATH;
let storeCache: AuthStoreData | null = null;
let storeCacheMtimeMs = 0;

function emptyStore(): AuthStoreData {
  return { users: {}, sessions: {}, revokedTokens: {} };
}

function readStoreFile(filePath: string): { data: AuthStoreData; mtimeMs: number } | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    const stat = fs.statSync(filePath);
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    return {
      mtimeMs: stat.mtimeMs,
      data: {
        users: parsed && typeof parsed.users === 'object' && parsed.users ? parsed.users : {},
        sessions: parsed && typeof parsed.sessions === 'object' && parsed.sessions ? parsed.sessions : {},
        revokedTokens: parsed && typeof parsed.revokedTokens === 'object' && parsed.revokedTokens ? parsed.revokedTokens : {},
      },
    };
  } catch {
    return null;
  }
}

function loadStore(): AuthStoreData {
  try {
    if (fs.existsSync(activeStorePath)) {
      const mtimeMs = fs.statSync(activeStorePath).mtimeMs;
      if (storeCache && mtimeMs === storeCacheMtimeMs) {
        return storeCache;
      }
      const fresh = readStoreFile(activeStorePath);
      if (fresh) {
        storeCache = fresh.data;
        storeCacheMtimeMs = fresh.mtimeMs;
        return storeCache;
      }
    }
  } catch {
    // Fall back to in-memory cache or tmp store
  }

  if (storeCache) return storeCache;
  const fallback = readStoreFile(TMP_STORE_PATH);
  if (fallback) {
    storeCache = fallback.data;
    storeCacheMtimeMs = fallback.mtimeMs;
    return storeCache;
  }
  storeCache = emptyStore();
  return storeCache;
}

function writeStoreAtomically(filePath: string, store: AuthStoreData): boolean {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    }
    const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(store, null, 2), { encoding: 'utf-8', mode: 0o600 });
    fs.renameSync(tmpPath, filePath);
    try {
      storeCacheMtimeMs = fs.statSync(filePath).mtimeMs;
    } catch {
      storeCacheMtimeMs = Date.now();
    }
    return true;
  } catch {
    return false;
  }
}

function persistStore(store: AuthStoreData): void {
  storeCache = store;
  if (writeStoreAtomically(activeStorePath, store)) return;
  if (activeStorePath !== TMP_STORE_PATH && writeStoreAtomically(TMP_STORE_PATH, store)) {
    activeStorePath = TMP_STORE_PATH;
  }
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function signPayload<T>(payload: T): string {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');
  const sig = createHmac('sha256', getSigningKey()).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

function verifySignedPayload<T>(token: string): T | null {
  if (!token || typeof token !== 'string') return null;
  const dotIdx = token.lastIndexOf('.');
  if (dotIdx <= 0) return null;
  const encoded = token.slice(0, dotIdx);
  const sig = token.slice(dotIdx + 1);
  if (!encoded || !sig) return null;

  const expectedSig = createHmac('sha256', getSigningKey()).update(encoded).digest('base64url');
  const gotBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (gotBuf.length !== expBuf.length || !timingSafeEqual(gotBuf, expBuf)) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(encoded, 'base64url').toString('utf-8')) as T;
  } catch {
    return null;
  }
}

function hashPassword(password: string, salt: string): string {
  return scryptSync(password, salt, 64).toString('hex');
}

function verifyPassword(password: string, salt: string, storedHash: string): boolean {
  try {
    if (!salt || !storedHash) return false;
    const derived = Buffer.from(hashPassword(password, salt), 'hex');
    const expected = Buffer.from(storedHash, 'hex');
    return derived.length === expected.length && timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

function sanitizeUser(
  u: Pick<
    ServerUserRecord,
    'id' | 'username' | 'email' | 'phone' | 'emailAlertsEnabled' | 'smsAlertsEnabled' | 'createdAt' | 'logins'
  >
): PublicAuthUser {
  return {
    id: u.id,
    username: u.username,
    email: u.email,
    phone: u.phone || '',
    emailAlertsEnabled: Boolean(u.emailAlertsEnabled),
    smsAlertsEnabled: Boolean(u.smsAlertsEnabled),
    createdAt: u.createdAt,
    logins: Array.isArray(u.logins) ? u.logins.slice(0, 20) : [],
  };
}

function parseCookies(req: Request): Record<string, string> {
  const header = req.headers.cookie;
  const out: Record<string, string> = {};
  if (!header || typeof header !== 'string') return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) {
      try {
        out[key] = decodeURIComponent(val);
      } catch {
        out[key] = val;
      }
    }
  }
  return out;
}

function isHttpsRequest(req: Request): boolean {
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase();
  const origin = String(req.headers.origin || '').trim().toLowerCase();
  const referer = String(req.headers.referer || '').trim().toLowerCase();
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim().toLowerCase();
  const isLocalHost = host.startsWith('localhost') || host.startsWith('127.0.0.1') || host.startsWith('[::1]');
  if (req.secure || forwardedProto === 'https' || origin.startsWith('https://') || referer.startsWith('https://')) {
    return true;
  }
  if (!isLocalHost && Boolean(process.env.VERCEL || process.env.K_SERVICE || process.env.CLOUD_RUN_JOB)) {
    return true;
  }
  return false;
}

function formatCookie(name: string, value: string, maxAgeSec: number, secure: boolean): string {
  return [
    `${name}=${value}`,
    'Path=/',
    `Max-Age=${maxAgeSec}`,
    'HttpOnly',
    secure ? 'Secure' : '',
    secure ? 'SameSite=None' : 'SameSite=Lax',
    secure ? 'Partitioned' : '',
  ]
    .filter(Boolean)
    .join('; ');
}

function unpackVaultUser(c: CompactVaultUser): ServerUserRecord {
  return {
    id: c.id,
    username: c.u,
    email: c.e,
    passwordHash: c.ph,
    passwordSalt: c.ps,
    phone: c.p || '',
    emailAlertsEnabled: Boolean(c.ea),
    smsAlertsEnabled: Boolean(c.sa),
    createdAt: c.ca,
    logins: c.ll ? [c.ll] : [],
  };
}

function packVaultUser(u: ServerUserRecord): CompactVaultUser {
  return {
    id: u.id,
    u: u.username,
    e: u.email,
    ph: u.passwordHash,
    ps: u.passwordSalt,
    p: u.phone || '',
    ea: Boolean(u.emailAlertsEnabled),
    sa: Boolean(u.smsAlertsEnabled),
    ca: u.createdAt,
    ll: u.logins?.[0] || u.createdAt,
  };
}

function readVaultAccounts(req: Request): ServerUserRecord[] {
  const cookies = parseCookies(req);
  const rawVault = cookies[VAULT_COOKIE_NAME];
  if (!rawVault) return [];
  const parsed = verifySignedPayload<SignedVaultPayload>(rawVault);
  if (!parsed || parsed.v !== 1 || !Array.isArray(parsed.a)) return [];
  return parsed.a
    .filter(
      (c) =>
        c &&
        typeof c.e === 'string' &&
        typeof c.u === 'string' &&
        typeof c.ph === 'string' &&
        typeof c.ps === 'string' &&
        c.ph.length > 0 &&
        c.ps.length > 0
    )
    .map(unpackVaultUser);
}

function buildVaultCookieValue(req: Request, upsertedUser: ServerUserRecord): string {
  const existing = readVaultAccounts(req)
    .filter((a) => a.email !== upsertedUser.email)
    .map(packVaultUser);
  const payload: SignedVaultPayload = {
    v: 1,
    a: [packVaultUser(upsertedUser), ...existing].slice(0, MAX_VAULT_ACCOUNTS),
  };
  return signPayload(payload);
}

function buildSignedSessionToken(user: ServerUserRecord): string {
  const payload: SignedSessionPayload = {
    v: 1,
    id: user.id,
    u: user.username,
    e: user.email,
    p: user.phone || '',
    ea: Boolean(user.emailAlertsEnabled),
    sa: Boolean(user.smsAlertsEnabled),
    ca: user.createdAt,
    exp: Date.now() + SESSION_TTL_MS,
  };
  return signPayload(payload);
}

function setAuthCookies(req: Request, res: Response, sessionToken: string, user: ServerUserRecord): void {
  const secure = isHttpsRequest(req);
  const sidCookie = formatCookie(SESSION_COOKIE_NAME, sessionToken, SESSION_MAX_AGE_SEC, secure);
  if (user.passwordHash && user.passwordSalt) {
    const vaultCookie = formatCookie(VAULT_COOKIE_NAME, buildVaultCookieValue(req, user), SESSION_MAX_AGE_SEC, secure);
    res.setHeader('Set-Cookie', [sidCookie, vaultCookie]);
  } else {
    res.setHeader('Set-Cookie', sidCookie);
  }
}

function setSessionOnlyCookie(req: Request, res: Response, sessionToken: string): void {
  const secure = isHttpsRequest(req);
  res.setHeader('Set-Cookie', formatCookie(SESSION_COOKIE_NAME, sessionToken, SESSION_MAX_AGE_SEC, secure));
}

function clearSessionCookie(req: Request, res: Response): void {
  const secure = isHttpsRequest(req);
  res.setHeader('Set-Cookie', formatCookie(SESSION_COOKIE_NAME, '', 0, secure));
}

function normalizeHost(raw: string): string {
  return raw.trim().toLowerCase().replace(/:(80|443)$/, '');
}

export function isSameOriginRequest(req: Request): boolean {
  const origin = req.headers.origin;
  if (!origin || typeof origin !== 'string') return true;
  try {
    const parsed = new URL(origin);
    const originHost = normalizeHost(parsed.host);
    const forwardedHost = normalizeHost(String(req.headers['x-forwarded-host'] || '').split(',')[0] || '');
    const directHost = normalizeHost(String(req.headers.host || ''));
    return (
      (!!forwardedHost && originHost === forwardedHost) ||
      (!!directHost && originHost === directHost)
    );
  } catch {
    return false;
  }
}

function verifyCsrfAndOrigin(req: Request, res: Response): boolean {
  if (!isSameOriginRequest(req)) {
    res.status(403).json({ ok: false, error: 'Cross-origin auth requests are not permitted.' });
    return false;
  }
  const hasOrigin = typeof req.headers.origin === 'string' && req.headers.origin.length > 0;
  const xrw = String(req.headers['x-requested-with'] || '').trim();
  if (!hasOrigin && xrw !== 'PredictX') {
    res.status(403).json({ ok: false, error: 'Missing required X-Requested-With header.' });
    return false;
  }
  return true;
}

function extractSessionToken(req: Request): string {
  const cookies = parseCookies(req);
  if (cookies[SESSION_COOKIE_NAME]) {
    return cookies[SESSION_COOKIE_NAME];
  }
  const authHeader = String(req.headers.authorization || '').trim();
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }
  return '';
}

function pruneExpiredSessions(store: AuthStoreData): void {
  const now = Date.now();
  for (const [hash, sess] of Object.entries(store.sessions)) {
    if (!sess || typeof sess.expiresAt !== 'number' || sess.expiresAt <= now) {
      delete store.sessions[hash];
    }
  }
  if (store.revokedTokens) {
    for (const [hash, exp] of Object.entries(store.revokedTokens)) {
      if (typeof exp !== 'number' || exp <= now) {
        delete store.revokedTokens[hash];
      }
    }
  }
}

function issueSession(store: AuthStoreData, user: ServerUserRecord): string {
  pruneExpiredSessions(store);
  const signedToken = buildSignedSessionToken(user);
  const tokenHash = sha256(signedToken);
  const nowIso = new Date().toISOString();
  store.sessions[tokenHash] = {
    tokenHash,
    email: user.email,
    createdAt: nowIso,
    lastSeenAt: nowIso,
    expiresAt: Date.now() + SESSION_TTL_MS,
  };
  return signedToken;
}

interface ResolvedAuth {
  store: AuthStoreData;
  rawToken: string;
  user: ServerUserRecord;
  session?: ServerSessionRecord;
}

async function getAuthenticatedSession(req: Request): Promise<ResolvedAuth | null> {
  const rawToken = extractSessionToken(req);
  if (!rawToken || rawToken.length < 24) return null;

  const store = loadStore();
  const tokenHash = sha256(rawToken);
  if (store.revokedTokens && store.revokedTokens[tokenHash]) {
    return null;
  }
  const vaultUsers = readVaultAccounts(req);

  const storedSession = store.sessions[tokenHash];
  if (storedSession) {
    if (Date.now() > storedSession.expiresAt) {
      delete store.sessions[tokenHash];
      persistStore(store);
      return null;
    }
    let user = store.users[storedSession.email];
    if (!user) {
      const fromVault = vaultUsers.find((a) => a.email === storedSession.email);
      if (fromVault) {
        store.users[fromVault.email] = fromVault;
        user = fromVault;
      } else {
        const fromSupa = await supabaseFindUserByEmail(storedSession.email);
        if (fromSupa) {
          store.users[fromSupa.email] = fromSupa;
          user = fromSupa;
        }
      }
    }
    if (user) {
      return { store, rawToken, user, session: storedSession };
    }
  }

  const verified = verifySignedPayload<SignedSessionPayload>(rawToken);
  if (!verified || verified.v !== 1 || !verified.e || Date.now() > verified.exp) {
    return null;
  }

  let user = store.users[verified.e];
  if (!user) {
    const fromVault = vaultUsers.find((a) => a.email === verified.e);
    if (fromVault) {
      user = {
        ...fromVault,
        phone: verified.p || fromVault.phone,
        emailAlertsEnabled: verified.ea,
        smsAlertsEnabled: verified.sa,
      };
      store.users[user.email] = user;
    } else {
      const fromSupa = await supabaseFindUserByEmail(verified.e);
      if (fromSupa) {
        user = fromSupa;
        store.users[user.email] = user;
      } else {
        user = {
          id: verified.id,
          username: verified.u,
          email: verified.e,
          passwordHash: '',
          passwordSalt: '',
          phone: verified.p || '',
          emailAlertsEnabled: Boolean(verified.ea),
          smsAlertsEnabled: Boolean(verified.sa),
          createdAt: verified.ca || new Date().toISOString(),
          logins: [],
        };
      }
    }
  }

  return { store, rawToken, user };
}

export function registerAuth(router: Router): void {
  router.use('/auth', (req, res, next) => {
    const origin = req.headers.origin;
    if (origin && isSameOriginRequest(req)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Vary', 'Origin');
    } else {
      res.removeHeader('Access-Control-Allow-Origin');
      res.removeHeader('Access-Control-Allow-Credentials');
    }
    res.setHeader('Cache-Control', 'no-store');
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
      return res.status(204).end();
    }
    next();
  });

  router.get('/auth/me', async (req, res) => {
    const auth = await getAuthenticatedSession(req);
    if (!auth) {
      return res.json({ ok: true, authenticated: false, user: null });
    }

    const { store, session, user, rawToken } = auth;
    if (session) {
      const lastSeenMs = Date.parse(session.lastSeenAt) || 0;
      if (Date.now() - lastSeenMs > LAST_SEEN_TOUCH_MS) {
        session.lastSeenAt = new Date().toISOString();
        session.expiresAt = Date.now() + SESSION_TTL_MS;
        persistStore(store);
      }
    }

    setSessionOnlyCookie(req, res, rawToken);

    return res.json({
      ok: true,
      authenticated: true,
      user: sanitizeUser(user),
      sessionToken: rawToken,
    });
  });

  router.post('/auth/register', async (req, res) => {
    if (!verifyCsrfAndOrigin(req, res)) return;

    const rawUsername = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
    const rawEmail = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const rawPassword = typeof req.body?.password === 'string' ? req.body.password : '';

    if (rawUsername.length < 3 || rawUsername.length > 24 || !USERNAME_RE.test(rawUsername)) {
      return res.status(400).json({
        ok: false,
        error: 'Username must be 3–24 characters using only letters, numbers, underscores, dots, or hyphens.',
      });
    }
    if (!EMAIL_RE.test(rawEmail)) {
      return res.status(400).json({ ok: false, error: 'Please enter a valid email address.' });
    }
    if (rawPassword.length < 6 || rawPassword.length > 128) {
      return res.status(400).json({ ok: false, error: 'Password must be at least 6 characters long.' });
    }

    const store = loadStore();
    const vaultUsers = readVaultAccounts(req);
    const supaExisting = await supabaseFindUserByEmail(rawEmail);

    if (store.users[rawEmail] || supaExisting || vaultUsers.some((a) => a.email === rawEmail)) {
      return res.status(409).json({
        ok: false,
        error: 'This email is already registered — please log in instead.',
      });
    }
    const usernameTaken =
      Object.values(store.users).some((u) => u.username.toLowerCase() === rawUsername.toLowerCase()) ||
      vaultUsers.some((u) => u.username.toLowerCase() === rawUsername.toLowerCase()) ||
      (await supabaseFindUserByUsername(rawUsername));
    if (usernameTaken) {
      return res.status(409).json({
        ok: false,
        error: 'This username is already taken. Please choose another.',
      });
    }

    const nowIso = new Date().toISOString();
    const salt = randomBytes(16).toString('hex');
    const user: ServerUserRecord = {
      id: randomBytes(12).toString('hex'),
      username: rawUsername,
      email: rawEmail,
      passwordHash: hashPassword(rawPassword, salt),
      passwordSalt: salt,
      phone: '',
      emailAlertsEnabled: true,
      smsAlertsEnabled: false,
      createdAt: nowIso,
      logins: [nowIso],
    };

    store.users[rawEmail] = user;
    const sessionToken = issueSession(store, user);
    persistStore(store);
    await supabaseUpsertUser(user);

    setAuthCookies(req, res, sessionToken, user);
    return res.status(201).json({
      ok: true,
      authenticated: true,
      user: sanitizeUser(user),
      sessionToken,
    });
  });

  router.post('/auth/login', async (req, res) => {
    if (!verifyCsrfAndOrigin(req, res)) return;

    const rawEmail = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const rawPassword = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!EMAIL_RE.test(rawEmail) || rawPassword.length < 1) {
      return res.status(400).json({ ok: false, error: 'Please enter your email and password.' });
    }

    const store = loadStore();
    let user = store.users[rawEmail];

    if (!user || !user.passwordHash || !user.passwordSalt) {
      const fromSupa = await supabaseFindUserByEmail(rawEmail);
      if (fromSupa) {
        user = fromSupa;
        store.users[rawEmail] = user;
      }
    }

    if (!user || !user.passwordHash || !user.passwordSalt) {
      const vaultMatch = readVaultAccounts(req).find((a) => a.email === rawEmail);
      if (vaultMatch) {
        user = { ...vaultMatch };
        store.users[rawEmail] = user;
      }
    }

    if (!user || !user.passwordHash || !user.passwordSalt || !verifyPassword(rawPassword, user.passwordSalt, user.passwordHash)) {
      return res.status(401).json({ ok: false, error: 'Invalid email or password.' });
    }

    user.logins = [new Date().toISOString(), ...(user.logins || [])].slice(0, 20);
    const sessionToken = issueSession(store, user);
    persistStore(store);
    await supabaseUpsertUser(user);

    setAuthCookies(req, res, sessionToken, user);
    return res.json({
      ok: true,
      authenticated: true,
      user: sanitizeUser(user),
      sessionToken,
    });
  });

  router.patch('/auth/profile', async (req, res) => {
    if (!verifyCsrfAndOrigin(req, res)) return;
    const auth = await getAuthenticatedSession(req);
    if (!auth) {
      return res.status(401).json({ ok: false, error: 'Please log in to update your profile.' });
    }

    const { store, user, rawToken } = auth;
    const existingDiskUser = store.users[user.email];
    const targetUser: ServerUserRecord = existingDiskUser && existingDiskUser.passwordHash
      ? existingDiskUser
      : user;

    if (typeof req.body?.phone === 'string') {
      targetUser.phone = req.body.phone.trim().slice(0, 32);
    }
    if (typeof req.body?.emailAlertsEnabled === 'boolean') {
      targetUser.emailAlertsEnabled = req.body.emailAlertsEnabled;
    }
    if (typeof req.body?.smsAlertsEnabled === 'boolean') {
      targetUser.smsAlertsEnabled = req.body.smsAlertsEnabled;
    }

    const oldHash = sha256(rawToken);
    delete store.sessions[oldHash];
    if (targetUser.passwordHash && targetUser.passwordSalt) {
      store.users[targetUser.email] = targetUser;
      await supabaseUpsertUser(targetUser);
    }
    const nextToken = issueSession(store, targetUser);
    persistStore(store);

    setAuthCookies(req, res, nextToken, targetUser);

    return res.json({
      ok: true,
      authenticated: true,
      user: sanitizeUser(targetUser),
      sessionToken: nextToken,
    });
  });

  router.post('/auth/logout', (req, res) => {
    if (!verifyCsrfAndOrigin(req, res)) return;
    const rawToken = extractSessionToken(req);
    if (rawToken) {
      const store = loadStore();
      const tokenHash = sha256(rawToken);
      delete store.sessions[tokenHash];
      store.revokedTokens = store.revokedTokens || {};
      store.revokedTokens[tokenHash] = Date.now() + SESSION_TTL_MS;
      persistStore(store);
    }
    clearSessionCookie(req, res);
    return res.json({ ok: true, authenticated: false });
  });
}
