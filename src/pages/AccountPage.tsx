import React, { useState } from 'react';
import { storage } from '../utils/storage';
import { UserProfile } from '../types';
import { DailyEmailCard } from '../components/DailyEmailCard';
import { CheckCircle, AlertCircle, LogOut, UserPlus, LogIn } from 'lucide-react';

const inputCls = 'w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm font-semibold';
const btnCls = 'px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition-all active:scale-[0.98] inline-flex items-center gap-2';

const AuthCard: React.FC = () => {
  const [mode, setMode] = useState<'register' | 'login'>('register');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const r = mode === 'register' ? storage.register(username, email) : storage.login(email);
    if (!r.ok) { setError(r.error || 'Kuch galat hua.'); return; }
    window.location.reload();
  };

  return (
    <div className="max-w-md mx-auto bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
      <div className="flex gap-2">
        {(['register', 'login'] as const).map((m) => (
          <button key={m} type="button" onClick={() => { setMode(m); setError(null); }}
            className={`flex-1 py-2 rounded-xl text-xs font-bold ${mode === m ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>
            {m === 'register' ? 'Register' : 'Login'}
          </button>
        ))}
      </div>
      <p className="text-xs text-slate-500">
        {mode === 'register'
          ? 'Apna username aur email daalo. Tumhara portfolio, watchlist, alerts aur paper trades sirf tumhare account me save honge.'
          : 'Register kiye hue email se login karo.'}
      </p>
      <form onSubmit={submit} className="space-y-3">
        {mode === 'register' && (
          <div>
            <label className="text-xs font-semibold text-slate-500 block mb-1">Username</label>
            <input className={inputCls} value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. ajay_trader" autoComplete="username" />
          </div>
        )}
        <div>
          <label className="text-xs font-semibold text-slate-500 block mb-1">Email</label>
          <input type="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
        </div>
        {error && (
          <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
          </div>
        )}
        <button type="submit" className={btnCls}>
          {mode === 'register' ? <><UserPlus className="w-4 h-4" /> Create Account</> : <><LogIn className="w-4 h-4" /> Login</>}
        </button>
      </form>
      <p className="text-[10px] text-slate-400">Note: accounts is browser me save hote hain (password nahi hai), isliye shared computer pe sensitive kuch mat rakho.</p>
    </div>
  );
};

export const AccountPage: React.FC = () => {
  const [user, setUser] = useState<UserProfile>(storage.getUser());
  const [tab, setTab] = useState<'Profile' | 'Notifications' | 'Activity'>('Profile');
  const [phone, setPhone] = useState(user.phone);
  const [emailOn, setEmailOn] = useState(user.emailAlertsEnabled);
  const [smsOn, setSmsOn] = useState(user.smsAlertsEnabled);
  const [msg, setMsg] = useState<string | null>(null);

  if (!storage.isLoggedIn()) return <AuthCard />;

  const save = (patch: Partial<UserProfile>, text: string) => {
    const updated = { ...user, ...patch };
    setUser(updated);
    storage.saveUser(updated);
    setMsg(text);
  };

  const history = storage.getLoginHistory();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        {(['Profile', 'Notifications', 'Activity'] as const).map((t) => (
          <button key={t} onClick={() => { setTab(t); setMsg(null); }}
            className={`px-4 py-2 rounded-xl text-xs font-bold ${tab === t ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'}`}>
            {t === 'Profile' && '👤 Profile'}{t === 'Notifications' && '🔔 Notifications'}{t === 'Activity' && '📜 Login Activity'}
          </button>
        ))}
        <button onClick={() => { storage.logout(); window.location.reload(); }} className="ml-auto px-4 py-2 rounded-xl text-xs font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-600 border border-rose-200 dark:border-rose-900 inline-flex items-center gap-2">
          <LogOut className="w-3.5 h-3.5" /> Logout
        </button>
      </div>

      {msg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" /> <span>{msg}</span>
        </div>
      )}

      {tab === 'Profile' && (
        <form onSubmit={(e) => { e.preventDefault(); save({ phone }, 'Profile updated.'); }} className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 max-w-md">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Profile Details</h3>
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
          <button type="submit" className={btnCls}>Save</button>
        </form>
      )}

      {tab === 'Notifications' && (
        <form onSubmit={(e) => { e.preventDefault(); save({ emailAlertsEnabled: emailOn, smsAlertsEnabled: smsOn }, 'Notification preferences saved.'); }} className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 max-w-md">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Alert Preferences</h3>
          <label className="flex items-center gap-3 text-xs font-bold"><input type="checkbox" checked={emailOn} onChange={(e) => setEmailOn(e.target.checked)} /> Email alerts ({user.email})</label>
          <label className="flex items-center gap-3 text-xs font-bold"><input type="checkbox" checked={smsOn} onChange={(e) => setSmsOn(e.target.checked)} /> SMS alerts</label>
          <button type="submit" className={btnCls}>Save</button>
        </form>
      )}

      {tab === 'Notifications' && <div className="max-w-md"><DailyEmailCard /></div>}

      {tab === 'Activity' && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Recent Logins</h3>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            {history.map((h, i) => (<li key={i} className="py-2.5 font-semibold">{new Date(h).toLocaleString()}</li>))}
          </ul>
        </div>
      )}
    </div>
  );
};
