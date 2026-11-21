import type {
  PortfolioHolding,
  PriceAlert,
  UserProfile,
  PaperAccount,
  WatchlistItem,
  JournalTrade,
  TrackRecordSignal,
  RecentSearchItem,
  MarketType,
} from '../types';

const LEGACY_SESSION_KEY = 'predictx_session';
const PROFILE_CACHE_KEY = 'predictx_profile_cache_v1';
const RECENT_SEARCHES_KEY = 'predictx_recent_searches_v2';
export const AUTH_CHANGED_EVENT = 'predictx_auth_changed';

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

export interface StoredUser {
  id?: string;
  username: string;
  email: string;
  createdAt: string;
  phone?: string;
  emailAlertsEnabled?: boolean;
  smsAlertsEnabled?: boolean;
  logins?: string[];
}

export interface AuthActionResult {
  ok: boolean;
  error?: string;
  user?: StoredUser;
}

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
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
  }
};

const removeKey = (k: string) => {
  try {
    localStorage.removeItem(k);
  } catch {
  }
};

const GUEST: UserProfile = {
  username: 'Guest',
  email: '',
  phone: '',
  twoFactorEnabled: false,
  emailAlertsEnabled: false,
  smsAlertsEnabled: false,
};

let inMemorySessionToken: string | null = null;
let activeAuthUser: StoredUser | null = (() => {
  const cached = read<StoredUser | null>(PROFILE_CACHE_KEY, null);
  if (
    cached &&
    typeof cached.email === 'string' &&
    cached.email.includes('@') &&
    typeof cached.username === 'string' &&
    cached.username.trim()
  ) {
    return cached;
  }
  return null;
})();

let authHydrated = false;
let authMutationEpoch = 0;
let hydrateInFlight: Promise<StoredUser | null> | null = null;

function notifyAuthChanged(user: StoredUser | null) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(AUTH_CHANGED_EVENT, { detail: { authenticated: !!user, user } }));
  }
}

function setActiveUser(user: StoredUser | null, sessionToken?: string | null) {
  activeAuthUser = user;
  if (sessionToken !== undefined) {
    inMemorySessionToken = sessionToken;
  } else if (!user) {
    inMemorySessionToken = null;
  }
  removeKey(LEGACY_SESSION_KEY);
  if (user) {
    write(PROFILE_CACHE_KEY, {
      id: user.id,
      username: user.username,
      email: norm(user.email),
      createdAt: user.createdAt,
      phone: user.phone || '',
      emailAlertsEnabled: user.emailAlertsEnabled ?? true,
      smsAlertsEnabled: user.smsAlertsEnabled ?? false,
      logins: Array.isArray(user.logins) ? user.logins.slice(0, 20) : [],
    });
  } else {
    removeKey(PROFILE_CACHE_KEY);
  }
  notifyAuthChanged(user);
}

function migrateGuestDataToUser(email: string) {
  const cleanEmail = norm(email);
  if (!cleanEmail) return;

  const arrayBases = [BASE.PORTFOLIO, BASE.WATCHLIST, BASE.ALERTS, BASE.JOURNAL, BASE.TRACK_RECORD];
  for (const base of arrayBases) {
    const guestVal = read<unknown[]>(`${base}::guest`, []);
    const userVal = read<unknown[]>(`${base}::${cleanEmail}`, []);
    if (Array.isArray(guestVal) && guestVal.length > 0 && (!Array.isArray(userVal) || userVal.length === 0)) {
      write(`${base}::${cleanEmail}`, guestVal);
    }
  }

  const guestPaper = read<PaperAccount | null>(`${BASE.PAPER}::guest`, null);
  const userPaper = read<PaperAccount | null>(`${BASE.PAPER}::${cleanEmail}`, null);
  const hasGuestPaperActivity =
    guestPaper &&
    (Object.keys(guestPaper.positions || {}).length > 0 || (guestPaper.history || []).length > 0);
  if (hasGuestPaperActivity && !userPaper) {
    write(`${BASE.PAPER}::${cleanEmail}`, guestPaper);
  }
}

const currentEmail = (): string => {
  return activeAuthUser?.email ? norm(activeAuthUser.email) : '';
};

export const userKey = (base: string): string => `${base}::${currentEmail() || 'guest'}`;

const emptyPaper = (): PaperAccount => ({ cash: 1000000, initialCash: 1000000, positions: {}, history: [] });

function buildAuthHeaders(withJson = true): Record<string, string> {
  const headers: Record<string, string> = {
    'X-Requested-With': 'PredictX',
  };
  if (withJson) {
    headers['Content-Type'] = 'application/json';
  }
  if (inMemorySessionToken) {
    headers.Authorization = `Bearer ${inMemorySessionToken}`;
  }
  return headers;
}

export const storage = {
  isLoggedIn(): boolean {
    return !!activeAuthUser && !!activeAuthUser.email;
  },

  isAuthHydrated(): boolean {
    return authHydrated;
  },

  async hydrateSession(force = false): Promise<StoredUser | null> {
    if (!force && authHydrated) {
      return activeAuthUser;
    }
    if (hydrateInFlight) return hydrateInFlight;

    const startEpoch = authMutationEpoch;
    hydrateInFlight = (async () => {
      try {
        const res = await fetch('/api/auth/me', {
          method: 'GET',
          credentials: 'include',
          headers: buildAuthHeaders(false),
          cache: 'no-store',
        });

        if (authMutationEpoch !== startEpoch) {
          return activeAuthUser;
        }

        if (!res.ok) {
          authHydrated = true;
          return activeAuthUser;
        }

        const data = await res.json();
        if (authMutationEpoch !== startEpoch) {
          return activeAuthUser;
        }

        authHydrated = true;
        if (data?.authenticated && data?.user?.email) {
          const nextToken = typeof data.sessionToken === 'string' ? data.sessionToken : inMemorySessionToken;
          setActiveUser(data.user as StoredUser, nextToken);
          return data.user as StoredUser;
        }

        if (!inMemorySessionToken) {
          if (activeAuthUser !== null) {
            setActiveUser(null, null);
          } else {
            removeKey(LEGACY_SESSION_KEY);
            removeKey(PROFILE_CACHE_KEY);
            notifyAuthChanged(null);
          }
        }
        return activeAuthUser;
      } catch {
        authHydrated = true;
        return activeAuthUser;
      } finally {
        hydrateInFlight = null;
      }
    })();
    return hydrateInFlight;
  },

  async registerAsync(username: string, email: string, password: string): Promise<AuthActionResult> {
    const u = username.trim();
    const e = norm(email);
    if (u.length < 3 || u.length > 24) {
      return { ok: false, error: 'Username must be 3–24 characters long.' };
    }
    if (!/^[A-Za-z0-9_.-]+$/.test(u)) {
      return { ok: false, error: 'Username can only contain letters, numbers, underscores, dots, and hyphens.' };
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
      return { ok: false, error: 'Please enter a valid email address.' };
    }
    if (password.length < 6) {
      return { ok: false, error: 'Password must be at least 6 characters long.' };
    }

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        credentials: 'include',
        headers: buildAuthHeaders(true),
        body: JSON.stringify({ username: u, email: e, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok || !data?.user) {
        return { ok: false, error: data?.error || 'Could not create account. Please try again.' };
      }
      authMutationEpoch += 1;
      authHydrated = true;
      migrateGuestDataToUser(data.user.email);
      const nextToken = typeof data.sessionToken === 'string' ? data.sessionToken : null;
      setActiveUser(data.user as StoredUser, nextToken);
      return { ok: true, user: data.user as StoredUser };
    } catch {
      return { ok: false, error: 'Unable to reach the server. Please try again.' };
    }
  },

  async loginAsync(email: string, password: string): Promise<AuthActionResult> {
    const e = norm(email);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
      return { ok: false, error: 'Please enter a valid email address.' };
    }
    if (!password) {
      return { ok: false, error: 'Please enter your password.' };
    }

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: buildAuthHeaders(true),
        body: JSON.stringify({ email: e, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok || !data?.user) {
        return { ok: false, error: data?.error || 'Invalid email or password.' };
      }
      authMutationEpoch += 1;
      authHydrated = true;
      const nextToken = typeof data.sessionToken === 'string' ? data.sessionToken : null;
      setActiveUser(data.user as StoredUser, nextToken);
      return { ok: true, user: data.user as StoredUser };
    } catch {
      return { ok: false, error: 'Unable to reach the server. Please try again.' };
    }
  },

  async logoutAsync(): Promise<void> {
    authMutationEpoch += 1;
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
        headers: buildAuthHeaders(true),
      });
    } catch {
    }
    authHydrated = true;
    setActiveUser(null, null);
  },

  logout() {
    void storage.logoutAsync();
  },

  getUser(): UserProfile {
    if (!activeAuthUser) return GUEST;
    const extra = read<Partial<UserProfile>>(userKey(BASE.PROFILE_EXTRA), {});
    return {
      ...GUEST,
      emailAlertsEnabled: activeAuthUser.emailAlertsEnabled ?? true,
      smsAlertsEnabled: activeAuthUser.smsAlertsEnabled ?? false,
      ...extra,
      username: activeAuthUser.username,
      email: activeAuthUser.email,
      phone: activeAuthUser.phone ?? extra.phone ?? '',
    };
  },

  async saveProfileAsync(patch: Partial<UserProfile>): Promise<AuthActionResult> {
    const current = storage.getUser();
    const updated: UserProfile = { ...current, ...patch };
    storage.saveUser(updated);

    if (!activeAuthUser) {
      return { ok: false, error: 'Not signed in.' };
    }

    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        credentials: 'include',
        headers: buildAuthHeaders(true),
        body: JSON.stringify({
          phone: updated.phone,
          emailAlertsEnabled: updated.emailAlertsEnabled,
          smsAlertsEnabled: updated.smsAlertsEnabled,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok || !data?.user) {
        return { ok: false, error: data?.error || 'Could not save profile to server.' };
      }
      authMutationEpoch += 1;
      const nextToken = typeof data.sessionToken === 'string' ? data.sessionToken : inMemorySessionToken;
      setActiveUser(data.user as StoredUser, nextToken);
      return { ok: true, user: data.user as StoredUser };
    } catch {
      return { ok: true, user: activeAuthUser };
    }
  },

  saveUser(user: UserProfile) {
    if (activeAuthUser) {
      activeAuthUser = {
        ...activeAuthUser,
        phone: user.phone,
        emailAlertsEnabled: user.emailAlertsEnabled,
        smsAlertsEnabled: user.smsAlertsEnabled,
      };
      write(PROFILE_CACHE_KEY, activeAuthUser);
    }
    write(userKey(BASE.PROFILE_EXTRA), {
      twoFactorEnabled: user.twoFactorEnabled,
      emailAlertsEnabled: user.emailAlertsEnabled,
      smsAlertsEnabled: user.smsAlertsEnabled,
      smtpHost: user.smtpHost,
    });
  },

  getLoginHistory(): string[] {
    return activeAuthUser?.logins || [];
  },

  getPortfolio(): PortfolioHolding[] {
    return read(userKey(BASE.PORTFOLIO), []);
  },
  savePortfolio(h: PortfolioHolding[]) {
    write(userKey(BASE.PORTFOLIO), h);
  },

  getWatchlist(): WatchlistItem[] {
    return read(userKey(BASE.WATCHLIST), []);
  },
  saveWatchlist(w: WatchlistItem[]) {
    write(userKey(BASE.WATCHLIST), w);
  },

  getAlerts(): PriceAlert[] {
    return read(userKey(BASE.ALERTS), []);
  },
  saveAlerts(a: PriceAlert[]) {
    write(userKey(BASE.ALERTS), a);
  },

  getPaperAccount(): PaperAccount {
    return read(userKey(BASE.PAPER), emptyPaper());
  },
  savePaperAccount(a: PaperAccount) {
    write(userKey(BASE.PAPER), a);
  },

  getJournalTrades(): JournalTrade[] {
    return read(userKey(BASE.JOURNAL), []);
  },
  saveJournalTrades(t: JournalTrade[]) {
    write(userKey(BASE.JOURNAL), t);
  },

  getCustomTrackRecord(): TrackRecordSignal[] {
    return read(userKey(BASE.TRACK_RECORD), []);
  },
  saveCustomTrackRecord(s: TrackRecordSignal[]) {
    write(userKey(BASE.TRACK_RECORD), s);
  },

  getTheme(): 'Light' | 'Dark' {
    try {
      return (localStorage.getItem(THEME_KEY) as 'Light' | 'Dark') || 'Light';
    } catch {
      return 'Light';
    }
  },
  saveTheme(t: 'Light' | 'Dark') {
    try {
      localStorage.setItem(THEME_KEY, t);
    } catch {
    }
  },

  getRecentSearches(): RecentSearchItem[] {
    const raw = read<any[]>(RECENT_SEARCHES_KEY, []);
    return raw
      .map((item) => {
        if (typeof item === 'string') {
          return { symbol: item.toUpperCase(), market: 'NSE' as MarketType };
        }
        return {
          symbol: String(item.symbol || '').toUpperCase(),
          market: (item.market || 'NSE') as MarketType,
          timestamp: typeof item.timestamp === 'number' ? item.timestamp : undefined,
        };
      })
      .filter((item) => item.symbol)
      .slice(0, 12);
  },

  addRecentSearch(symbol: string, market: MarketType = 'NSE'): RecentSearchItem[] {
    const cleanSym = symbol.trim().toUpperCase();
    if (!cleanSym) return storage.getRecentSearches();
    const current = storage.getRecentSearches();
    const filtered = current.filter((item) => item.symbol !== cleanSym);
    const updated: RecentSearchItem[] = [
      { symbol: cleanSym, market, timestamp: Date.now() },
      ...filtered,
    ].slice(0, 12);
    write(RECENT_SEARCHES_KEY, updated);
    return updated;
  },

  removeRecentSearch(symbol: string): RecentSearchItem[] {
    const cleanSym = symbol.trim().toUpperCase();
    const current = storage.getRecentSearches();
    const updated = current.filter((item) => item.symbol !== cleanSym);
    write(RECENT_SEARCHES_KEY, updated);
    return updated;
  },

  clearRecentSearches() {
    removeKey(RECENT_SEARCHES_KEY);
  },
};
