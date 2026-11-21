import React, { useEffect, useState } from 'react';
import { AUTH_CHANGED_EVENT, storage } from '../utils/storage';
import type { UserProfile } from '../types';
import { DailyEmailCard } from '../components/DailyEmailCard';
import {
  CheckCircle,
  AlertCircle,
  LogOut,
  UserPlus,
  LogIn,
  ShieldCheck,
  Eye,
  EyeOff,
  Loader2,
} from 'lucide-react';

const inputCls =
  'w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40';
const btnCls =
  'px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow-md transition-all active:scale-[0.98] inline-flex items-center justify-center gap-2 cursor-pointer';

interface AuthCardProps {
  onSuccess: (message: string) => void;
}

const AuthCard: React.FC<AuthCardProps> = ({ onSuccess }) => {
  const [mode, setMode] = useState<'register' | 'login'>('register');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);

    const r =
      mode === 'register'
        ? await storage.registerAsync(username, email, password)
        : await storage.loginAsync(email, password);

    setBusy(false);

    if (!r.ok) {
      setError(r.error || 'Something went wrong.');
      return;
    }

    onSuccess(
      mode === 'register'
        ? 'Account created! You are now permanently signed in until you click Logout.'
        : 'Welcome back! Your permanent session is active.'
    );
  };

  return (
    <div className="max-w-md mx-auto bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
      <div className="flex gap-2">
        {(['register', 'login'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              setError(null);
            }}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
              mode === m
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            {m === 'register' ? 'Register' : 'Login'}
          </button>
        ))}
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400">
        {mode === 'register'
          ? 'Create your permanent PredictX account. You stay logged in automatically across reloads and visits until you explicitly log out.'
          : 'Sign in with your registered email and password.'}
      </p>

      <form onSubmit={submit} className="space-y-3">
        {mode === 'register' && (
          <div>
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">
              Username
            </label>
            <input
              className={inputCls}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. ajay_trader"
              autoComplete="username"
              required
            />
          </div>
        )}

        <div>
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">
            Email
          </label>
          <input
            type="email"
            className={inputCls}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">
            Password
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              className={inputCls + ' pr-10'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'register' ? 'Minimum 6 characters' : 'Enter your password'}
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              minLength={mode === 'register' ? 6 : 1}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {error && (
          <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" /> <span>{error}</span>
          </div>
        )}

        <button type="submit" disabled={busy} className={btnCls + ' w-full'}>
          {busy ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {mode === 'register' ? 'Creating Account...' : 'Signing In...'}
            </>
          ) : mode === 'register' ? (
            <>
              <UserPlus className="w-4 h-4" /> Create Account & Stay Signed In
            </>
          ) : (
            <>
              <LogIn className="w-4 h-4" /> Login
            </>
          )}
        </button>
      </form>

      <div className="flex items-start gap-2 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-900/60 p-3 text-[11px] text-emerald-800 dark:text-emerald-300">
        <ShieldCheck className="w-4 h-4 flex-shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
        <span>
          Your account is saved on the server with a persistent session cookie — refreshing or reopening the app will keep you signed in automatically.
        </span>
      </div>
    </div>
  );
};

export const AccountPage: React.FC = () => {
  const [loggedIn, setLoggedIn] = useState<boolean>(() => storage.isLoggedIn());
  const [checkingSession, setCheckingSession] = useState<boolean>(() => !storage.isAuthHydrated());
  const [user, setUser] = useState<UserProfile>(() => storage.getUser());
  const [history, setHistory] = useState<string[]>(() => storage.getLoginHistory());
  const [tab, setTab] = useState<'Profile' | 'Notifications' | 'Activity'>('Profile');
  const [phone, setPhone] = useState(user.phone);
  const [emailOn, setEmailOn] = useState(user.emailAlertsEnabled);
  const [smsOn, setSmsOn] = useState(user.smsAlertsEnabled);
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const syncFromStorage = () => {
    const isNowLoggedIn = storage.isLoggedIn();
    const u = storage.getUser();
    setLoggedIn(isNowLoggedIn);
    setUser(u);
    setPhone(u.phone);
    setEmailOn(u.emailAlertsEnabled);
    setSmsOn(u.smsAlertsEnabled);
    setHistory(storage.getLoginHistory());
  };

  useEffect(() => {
    let active = true;
    const onAuthChanged = () => {
      if (!active) return;
      syncFromStorage();
      setCheckingSession(false);
    };
    window.addEventListener(AUTH_CHANGED_EVENT, onAuthChanged);

    if (!storage.isAuthHydrated()) {
      storage.hydrateSession().finally(() => {
        if (!active) return;
        syncFromStorage();
        setCheckingSession(false);
      });
    } else {
      syncFromStorage();
      setCheckingSession(false);
    }

    return () => {
      active = false;
      window.removeEventListener(AUTH_CHANGED_EVENT, onAuthChanged);
    };
  }, []);

  if (checkingSession && !loggedIn) {
    return (
      <div className="max-w-md mx-auto bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-center gap-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
        <Loader2 className="w-4 h-4 animate-spin text-blue-600" /> Restoring your session...
      </div>
    );
  }

  if (!loggedIn) {
    return (
      <AuthCard
        onSuccess={(welcomeText) => {
          syncFromStorage();
          setTab('Profile');
          setErrMsg(null);
          setMsg(welcomeText);
        }}
      />
    );
  }

  const save = async (patch: Partial<UserProfile>, text: string) => {
    setSaving(true);
    setErrMsg(null);
    setMsg(null);
    const res = await storage.saveProfileAsync(patch);
    setSaving(false);
    if (!res.ok) {
      setErrMsg(res.error || 'Failed to update profile.');
      return;
    }
    syncFromStorage();
    setMsg(text);
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    await storage.logoutAsync();
    setLoggingOut(false);
    setMsg(null);
    setErrMsg(null);
    syncFromStorage();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        {(['Profile', 'Notifications', 'Activity'] as const).map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t);
              setMsg(null);
              setErrMsg(null);
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer ${
              tab === t
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            {t === 'Profile' && 'Profile'}
            {t === 'Notifications' && 'Notifications'}
            {t === 'Activity' && 'Login Activity'}
          </button>
        ))}

        <div className="ml-auto flex items-center gap-2">
          <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <ShieldCheck className="w-3.5 h-3.5" /> Permanently Signed In
          </span>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-600 border border-rose-200 dark:border-rose-900 inline-flex items-center gap-2 cursor-pointer disabled:opacity-60"
          >
            {loggingOut ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
            Logout
          </button>
        </div>
      </div>

      {msg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" /> <span>{msg}</span>
        </div>
      )}

      {errMsg && (
        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" /> <span>{errMsg}</span>
        </div>
      )}

      {tab === 'Profile' && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save({ phone }, 'Profile updated.');
          }}
          className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 max-w-md"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Profile Details</h3>
            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">Active Session</span>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 block mb-1">Username</label>
            <input disabled value={user.username} className={inputCls + ' opacity-70 cursor-not-allowed'} />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 block mb-1">Email</label>
            <input disabled value={user.email} className={inputCls + ' opacity-70 cursor-not-allowed'} />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 block mb-1">Mobile (optional)</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} placeholder="+91 ..." />
          </div>
          <button type="submit" disabled={saving} className={btnCls}>
            {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...</> : 'Save'}
          </button>
        </form>
      )}

      {tab === 'Notifications' && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save(
              { emailAlertsEnabled: emailOn, smsAlertsEnabled: smsOn },
              'Notification preferences saved.'
            );
          }}
          className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 max-w-md"
        >
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Alert Preferences</h3>
          <label className="flex items-center gap-3 text-xs font-bold">
            <input type="checkbox" checked={emailOn} onChange={(e) => setEmailOn(e.target.checked)} /> Email alerts (
            {user.email})
          </label>
          <label className="flex items-center gap-3 text-xs font-bold">
            <input type="checkbox" checked={smsOn} onChange={(e) => setSmsOn(e.target.checked)} /> SMS alerts
          </label>
          <button type="submit" disabled={saving} className={btnCls}>
            {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...</> : 'Save'}
          </button>
        </form>
      )}

      {tab === 'Notifications' && (
        <div className="max-w-md">
          <DailyEmailCard />
        </div>
      )}

      {tab === 'Activity' && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Recent Logins</h3>
          {history.length === 0 ? (
            <p className="text-xs text-slate-500">No login events recorded yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {history.map((h, i) => (
                <li key={i} className="py-2.5 font-semibold">
                  {new Date(h).toLocaleString()}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
