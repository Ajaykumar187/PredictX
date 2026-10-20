import { PortfolioHolding, PriceAlert, UserProfile, PaperAccount, WatchlistItem, JournalTrade, TrackRecordSignal } from '../types';

const SESSION_KEY = 'predictx_session';
const USERS_KEY = 'predictx_users';

const BASE = {
  PORTFOLIO: 'predictx_portfolio',
  WATCHLIST: 'predictx_watchlist',
  ALERTS: 'predictx_alerts',
  PAPER: 'predictx_paper_account',
  PROFILE_EXTRA: 'predictx_profile_extra',
  JOURNAL: 'predictx_journal',
  TRACK_RECORD: 'predictx_track_record',
};
const THEME_KEY = 'predictx_theme';

const norm = (e: string) => e.trim().toLowerCase();
const read = <T,>(k: string, fallback: T): T => {
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
};
const write = (k: string, v: unknown) => {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* quota / private mode */ }
};

const GUEST: UserProfile = {
  username: 'Guest',
  email: '',
  phone: '',
  twoFactorEnabled: false,
  emailAlertsEnabled: false,
  smsAlertsEnabled: false,
};

export interface StoredUser { username: string; email: string; createdAt: string; phone?: string; logins?: string[] }

const currentEmail = (): string => {
  try { return localStorage.getItem(SESSION_KEY) || ''; } catch { return ''; }
};

export const userKey = (base: string): string => `${base}::${currentEmail() || 'guest'}`;

const emptyPaper = (): PaperAccount => ({ cash: 1000000, initialCash: 1000000, positions: {}, history: [] });

export const storage = {
  isLoggedIn(): boolean { return !!currentEmail(); },
  getUsers(): StoredUser[] { return read<StoredUser[]>(USERS_KEY, []); },

  register(username: string, email: string): { ok: boolean; error?: string } {
    const u = username.trim();
    const e = norm(email);
    if (u.length < 3) return { ok: false, error: 'Username kam se kam 3 characters ka hona chahiye.' };
    if (!/^[A-Za-z0-9_.-]+$/.test(u)) return { ok: false, error: 'Username me sirf letters, numbers, _ . - allowed hain.' };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return { ok: false, error: 'Valid email daalo.' };
    const users = storage.getUsers();
    if (users.some((x) => x.email === e)) return { ok: false, error: 'Ye email pehle se registered hai — Login karo.' };
    if (users.some((x) => x.username.toLowerCase() === u.toLowerCase())) return { ok: false, error: 'Ye username le liya gaya hai, doosra chuno.' };
    users.push({ username: u, email: e, createdAt: new Date().toISOString(), logins: [new Date().toISOString()] });
    write(USERS_KEY, users);
    localStorage.setItem(SESSION_KEY, e);
    return { ok: true };
  },

  login(email: string): { ok: boolean; error?: string } {
    const e = norm(email);
    const users = storage.getUsers();
    const me = users.find((x) => x.email === e);
    if (!me) return { ok: false, error: 'Ye email registered nahi hai — pehle Register karo.' };
    me.logins = [new Date().toISOString(), ...(me.logins || [])].slice(0, 20);
    write(USERS_KEY, users);
    localStorage.setItem(SESSION_KEY, e);
    return { ok: true };
  },

  logout() {
    try { localStorage.removeItem(SESSION_KEY); } catch { }
  },

  getUser(): UserProfile {
    const e = currentEmail();
    const me = storage.getUsers().find((x) => x.email === e);
    if (!me) return GUEST;
    const extra = read<Partial<UserProfile>>(userKey(BASE.PROFILE_EXTRA), {});
    return { ...GUEST, emailAlertsEnabled: true, ...extra, username: me.username, email: me.email, phone: me.phone || '' };
  },

  saveUser(user: UserProfile) {
    const users = storage.getUsers();
    const me = users.find((x) => x.email === currentEmail());
    if (me) { me.phone = user.phone; write(USERS_KEY, users); }
    write(userKey(BASE.PROFILE_EXTRA), {
      twoFactorEnabled: user.twoFactorEnabled,
      emailAlertsEnabled: user.emailAlertsEnabled,
      smsAlertsEnabled: user.smsAlertsEnabled,
      smtpHost: user.smtpHost,
    });
  },

  getLoginHistory(): string[] {
    return storage.getUsers().find((x) => x.email === currentEmail())?.logins || [];
  },

  getPortfolio(): PortfolioHolding[] { return read(userKey(BASE.PORTFOLIO), []); },
  savePortfolio(h: PortfolioHolding[]) { write(userKey(BASE.PORTFOLIO), h); },

  getWatchlist(): WatchlistItem[] { return read(userKey(BASE.WATCHLIST), []); },
  saveWatchlist(w: WatchlistItem[]) { write(userKey(BASE.WATCHLIST), w); },

  getAlerts(): PriceAlert[] { return read(userKey(BASE.ALERTS), []); },
  saveAlerts(a: PriceAlert[]) { write(userKey(BASE.ALERTS), a); },

  getPaperAccount(): PaperAccount { return read(userKey(BASE.PAPER), emptyPaper()); },
  savePaperAccount(a: PaperAccount) { write(userKey(BASE.PAPER), a); },

  getJournalTrades(): JournalTrade[] { return read(userKey(BASE.JOURNAL), []); },
  saveJournalTrades(t: JournalTrade[]) { write(userKey(BASE.JOURNAL), t); },

  getCustomTrackRecord(): TrackRecordSignal[] { return read(userKey(BASE.TRACK_RECORD), []); },
  saveCustomTrackRecord(s: TrackRecordSignal[]) { write(userKey(BASE.TRACK_RECORD), s); },

  getTheme(): 'Light' | 'Dark' {
    try { return (localStorage.getItem(THEME_KEY) as 'Light' | 'Dark') || 'Light'; } catch { return 'Light'; }
  },
  saveTheme(t: 'Light' | 'Dark') {
    try { localStorage.setItem(THEME_KEY, t); } catch { }
  },
};
