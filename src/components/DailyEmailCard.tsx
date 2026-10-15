import React, { useEffect, useState } from 'react';
import { Mail } from 'lucide-react';
import { WatchlistItem } from '../types';
import { digestConfigured, setDigest } from '../utils/stockApi';
import { storage, userKey } from '../utils/storage';

const SUB_BASE = 'predictx_digest_on';

export const DailyEmailCard: React.FC = () => {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [email, setEmail] = useState(storage.getUser().email || '');
  const [on, setOn] = useState(() => {
    try { return localStorage.getItem(userKey(SUB_BASE)) === '1'; } catch { return false; }
  });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { digestConfigured().then(setConfigured); }, []);
  if (configured === null) return null;

  const apply = async (enable: boolean) => {
    setBusy(true);
    const list: WatchlistItem[] = storage.getWatchlist();
    const r = await setDigest(email.trim(), list, enable);
    setBusy(false);
    if (r.ok) {
      setOn(enable);
      try { localStorage.setItem(userKey(SUB_BASE), enable ? '1' : '0'); } catch { }
      setMsg({
        ok: true,
        text: !enable
          ? 'Band kar diya.'
          : r.needsConfirm
          ? `Confirmation email bheja gaya (${email.trim()}). Us mein link par click karein, tabhi roz subah ${r.count} stock(s) ka haal aana shuru hoga. Spam folder bhi dekh lein.`
          : `Chalu. Roz subah ${r.count} stock(s) ka haal email hoga (Mon-Fri).`,
      });
    } else {
      setMsg({ ok: false, text: r.error || 'Nahi ho paya' });
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 space-y-3">
      <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
        <Mail className="w-4 h-4 text-blue-600" /> Daily email
      </h3>
      {!configured ? (
        <p className="text-sm text-slate-500">Daily email abhi chalu nahi hai (server par email setup nahi hai).</p>
      ) : (
        <>
          <p className="text-xs text-slate-500">Roz subah ~9 baje "My Watchlist" ke stocks ka price aur badlav email par. Watchlist badalne par yahan dobara "Update" dabayein.</p>
          <div className="flex flex-wrap gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="aapka@email.com"
              className="flex-1 min-w-[220px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-sm"
            />
            <button disabled={busy || !email} onClick={() => apply(true)} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold">
              {on ? 'Update' : 'Chalu karein'}
            </button>
            {on && (
              <button disabled={busy} onClick={() => apply(false)} className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200">
                Band karein
              </button>
            )}
          </div>
        </>
      )}
      {msg && <p className={`text-xs ${msg.ok ? 'text-emerald-600' : 'text-rose-600'}`}>{msg.text}</p>}
    </div>
  );
};

export default DailyEmailCard;
